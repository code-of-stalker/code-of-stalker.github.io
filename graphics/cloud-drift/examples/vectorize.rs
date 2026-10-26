//! Offline vector extraction. Runtime receives immutable polylines, not a raster edge filter.
use std::{collections::HashMap, error::Error, fmt::Write as _, fs, path::PathBuf};
use tiny_skia::Pixmap;

#[derive(Clone, Copy, Debug)]
struct Point {
    x: f32,
    y: f32,
}
impl Point {
    fn key(self) -> (i32, i32) {
        (
            (self.x * 16.0).round() as i32,
            (self.y * 16.0).round() as i32,
        )
    }
    fn distance(self, b: Self) -> f32 {
        (self.x - b.x).hypot(self.y - b.y)
    }
}
struct Drawing {
    layer: u16,
    opacity: f32,
    paths: Vec<Vec<Point>>,
}
fn value(image: &Pixmap, x: usize, y: usize, alpha: bool, region: Option<[f32; 4]>) -> f32 {
    if let Some([cx, cy, rx, ry]) = region {
        if ((x as f32 - cx) / rx).powi(2) + ((y as f32 - cy) / ry).powi(2) > 0.78 {
            return 0.0;
        }
    }
    let p = image.pixels()[y * image.width() as usize + x];
    if alpha {
        return p.alpha() as f32 / 255.0;
    }
    if p.alpha() < 225 {
        return 0.0;
    }
    (p.red() as f32 * 0.3 + p.green() as f32 * 0.6 + p.blue() as f32 * 0.1) / 255.0
}
fn simplify(points: &[Point], tolerance: f32, output: &mut Vec<Point>) {
    if points.len() < 3 {
        output.extend_from_slice(points);
        return;
    }
    let a = points[0];
    let b = points[points.len() - 1];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let length = dx * dx + dy * dy;
    let mut best = 0.0;
    let mut at = 0;
    for (i, p) in points.iter().enumerate().skip(1).take(points.len() - 2) {
        let t = if length > 0.001 {
            (((p.x - a.x) * dx + (p.y - a.y) * dy) / length).clamp(0.0, 1.0)
        } else {
            0.0
        };
        let d = (p.x - a.x - t * dx).hypot(p.y - a.y - t * dy);
        if d > best {
            best = d;
            at = i;
        }
    }
    if best > tolerance {
        simplify(&points[..=at], tolerance, output);
        output.pop();
        simplify(&points[at..], tolerance, output);
    } else {
        output.push(a);
        output.push(b);
    }
}
fn trace(
    image: &Pixmap,
    threshold: f32,
    step: usize,
    alpha: bool,
    region: Option<[f32; 4]>,
    minimum: f32,
) -> Vec<Vec<Point>> {
    let mut segments = Vec::<(Point, Point)>::new();
    for y in (0..image.height() as usize - step).step_by(step) {
        for x in (0..image.width() as usize - step).step_by(step) {
            let corners = [(x, y), (x + step, y), (x + step, y + step), (x, y + step)];
            let values = corners.map(|(px, py)| value(image, px, py, alpha, region));
            let mut edge = Vec::with_capacity(4);
            for i in 0..4 {
                let j = (i + 1) % 4;
                if (values[i] >= threshold) != (values[j] >= threshold) {
                    let t = (threshold - values[i]) / (values[j] - values[i]);
                    edge.push(Point {
                        x: corners[i].0 as f32 + (corners[j].0 as f32 - corners[i].0 as f32) * t,
                        y: corners[i].1 as f32 + (corners[j].1 as f32 - corners[i].1 as f32) * t,
                    });
                }
            }
            if edge.len() == 2 {
                segments.push((edge[0], edge[1]));
            }
            if edge.len() == 4 {
                segments.push((edge[0], edge[1]));
                segments.push((edge[2], edge[3]));
            }
        }
    }
    let mut links: HashMap<(i32, i32), Vec<usize>> = HashMap::new();
    for (i, (a, b)) in segments.iter().enumerate() {
        links.entry(a.key()).or_default().push(i);
        links.entry(b.key()).or_default().push(i);
    }
    let mut used = vec![false; segments.len()];
    let mut paths = Vec::new();
    for start in 0..segments.len() {
        if used[start] {
            continue;
        }
        used[start] = true;
        let (a, b) = segments[start];
        let mut points = vec![a, b];
        let mut length = a.distance(b);
        loop {
            let end = *points.last().unwrap();
            let next = links
                .get(&end.key())
                .and_then(|list| list.iter().find(|&&i| !used[i]))
                .copied();
            let Some(next) = next else {
                break;
            };
            used[next] = true;
            let (c, d) = segments[next];
            let p = if c.key() == end.key() { d } else { c };
            length += end.distance(p);
            points.push(p);
        }
        if length < minimum || points.len() < 5 {
            continue;
        }
        let mut reduced = Vec::new();
        simplify(&points, 0.7, &mut reduced);
        if reduced.len() > 3 {
            paths.push(reduced);
        }
    }
    paths
}

fn main() -> Result<(), Box<dyn Error>> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets");
    let source = Pixmap::load_png(root.join("original.png"))?;
    let hero = Pixmap::load_png(root.join("hero.png"))?;
    let sky = Pixmap::load_png(root.join("background-clean.png"))?;
    let mut drawings = Vec::new();
    let silhouette = trace(&hero, 0.5, 2, true, None, 18.0);
    drawings.push(Drawing {
        layer: 0,
        opacity: 0.9,
        paths: silhouette.clone(),
    });
    // Keep a single silhouette; reject inner brightness contours near its rim.
    let mut inside = Vec::new();
    for path in trace(&hero, 0.22, 2, false, None, 22.0) {
        let mut run = Vec::new();
        for p in path {
            let safe = [
                (-4.0, 0.0),
                (4.0, 0.0),
                (0.0, -4.0),
                (0.0, 4.0),
                (-3.0, -3.0),
                (3.0, 3.0),
            ]
            .iter()
            .all(|(dx, dy)| {
                let x = (p.x + dx).clamp(0.0, 1535.0) as usize;
                let y = (p.y + dy).clamp(0.0, 1023.0) as usize;
                hero.pixels()[y * 1536 + x].alpha() > 240
            });
            if safe {
                run.push(p);
            } else {
                if run.len() > 3 {
                    inside.push(std::mem::take(&mut run));
                }
                run.clear();
            }
        }
        if run.len() > 3 {
            inside.push(run);
        }
    }
    drawings.push(Drawing {
        layer: 0,
        opacity: 0.68,
        paths: inside,
    });
    for (i, region) in [
        [903.0, 109.0, 128.0, 113.0],
        [1211.0, 111.0, 128.0, 114.0],
        [1163.0, 347.0, 100.0, 125.0],
        [1409.0, 307.0, 126.0, 139.0],
    ]
    .into_iter()
    .enumerate()
    {
        let paths = trace(&source, 0.32, 1, false, Some(region), 19.0);
        drawings.push(Drawing {
            layer: i as u16 + 1,
            opacity: 0.9,
            paths,
        });
    }
    drawings.push(Drawing {
        layer: 5,
        opacity: 0.34,
        paths: trace(&sky, 0.29, 3, false, None, 75.0),
    });
    let mut binary = Vec::new();
    let mut svg=String::from("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1536 1024\" width=\"1536\" height=\"1024\"><title>В облаках — векторные грани</title><rect width=\"1536\" height=\"1024\" fill=\"#000\"/><g fill=\"none\" stroke=\"#e6ce56\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">");
    let mut report = String::new();
    let mut masked = false;
    for drawing in drawings.iter().rev() {
        if drawing.layer == 0 && !masked {
            svg.push_str("<path fill=\"#000\" fill-rule=\"evenodd\" stroke=\"none\" transform=\"translate(-9 126) scale(.8)\" d=\"");
            for path in &silhouette {
                for (i, p) in path.iter().enumerate() {
                    write!(
                        svg,
                        "{} {:.2} {:.2} ",
                        if i == 0 { 'M' } else { 'L' },
                        p.x,
                        p.y
                    )?;
                }
                svg.push_str("Z ");
            }
            svg.push_str("\"/>");
            masked = true;
        }
        let transform = if drawing.layer == 0 {
            "translate(-9 126) scale(.8)"
        } else if drawing.layer == 5 {
            "translate(768 512) scale(1.0638298) translate(-768 -512)"
        } else {
            ""
        };
        write!(
            svg,
            "<g opacity=\"{}\" transform=\"{transform}\">",
            drawing.opacity
        )?;
        let mut count = 0;
        for path in &drawing.paths {
            svg.push_str("<path d=\"");
            for (i, p) in path.iter().enumerate() {
                write!(
                    svg,
                    "{} {:.2} {:.2} ",
                    if i == 0 { 'M' } else { 'L' },
                    p.x,
                    p.y
                )?;
            }
            svg.push_str("\"/>");
            for line in path.windows(2) {
                if line[0].distance(line[1]) < 0.2 {
                    continue;
                }
                for v in [line[0].x, line[0].y, line[1].x, line[1].y] {
                    binary.extend_from_slice(&((v * 8.0).round() as u16).to_le_bytes());
                }
                binary.extend_from_slice(&drawing.layer.to_le_bytes());
                binary.extend_from_slice(&((drawing.opacity * 65535.0) as u16).to_le_bytes());
                count += 1;
            }
        }
        svg.push_str("</g>");
        writeln!(
            report,
            "Layer {}: {} paths, {} segments",
            drawing.layer,
            drawing.paths.len(),
            count
        )?;
    }
    svg.push_str("</g></svg>");
    fs::write(root.join("contours.bin"), &binary)?;
    fs::write(root.join("edges.svg"), svg)?;
    fs::write(root.join("contours-report.txt"), &report)?;
    println!("{report}Vector geometry: {} bytes", binary.len());
    Ok(())
}
