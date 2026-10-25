//! Convert the approved concept's exact contours to opaque layered vectors.
//! Offline authoring utility; the runtime only consumes the resulting SVG.
use std::{
    collections::{HashMap, VecDeque},
    error::Error,
    fmt::Write,
};
type P = (f64, f64);

fn distance(p: P, a: P, b: P) -> f64 {
    let v = (b.0 - a.0, b.1 - a.1);
    let t = (((p.0 - a.0) * v.0 + (p.1 - a.1) * v.1) / (v.0 * v.0 + v.1 * v.1).max(1e-12))
        .clamp(0., 1.);
    (p.0 - a.0 - v.0 * t).hypot(p.1 - a.1 - v.1 * t)
}
fn simplify(points: &[P], out: &mut Vec<P>) {
    let mut far = (0, 0.);
    for (i, &p) in points
        .iter()
        .enumerate()
        .skip(1)
        .take(points.len().saturating_sub(2))
    {
        let d = distance(p, points[0], points[points.len() - 1]);
        if d > far.1 {
            far = (i, d);
        }
    }
    if far.1 > 0.65 {
        simplify(&points[..=far.0], out);
        simplify(&points[far.0..], out);
    } else {
        out.push(points[0]);
    }
}
fn trace(mask: &[bool], w: usize, h: usize) -> (String, usize) {
    let mut edges: HashMap<usize, Vec<usize>> = HashMap::new();
    let mut edge = |x: usize, y: usize, xx: usize, yy: usize| {
        edges
            .entry(y * (w + 1) + x)
            .or_default()
            .push(yy * (w + 1) + xx);
    };
    for y in 0..h {
        for x in 0..w {
            if mask[y * w + x] {
                if y == 0 || !mask[(y - 1) * w + x] {
                    edge(x, y, x + 1, y);
                }
                if x + 1 == w || !mask[y * w + x + 1] {
                    edge(x + 1, y, x + 1, y + 1);
                }
                if y + 1 == h || !mask[(y + 1) * w + x] {
                    edge(x + 1, y + 1, x, y + 1);
                }
                if x == 0 || !mask[y * w + x - 1] {
                    edge(x, y + 1, x, y);
                }
            }
        }
    }
    let mut loops = Vec::new();
    while let Some(start) = edges.keys().min().copied() {
        let mut at = start;
        let mut points = Vec::new();
        loop {
            points.push(((at % (w + 1)) as f64, (at / (w + 1)) as f64));
            let ends = edges.get_mut(&at).expect("closed boundary");
            let next = ends.pop().expect("unvisited edge");
            if ends.is_empty() {
                edges.remove(&at);
            }
            at = next;
            if at == start {
                break;
            }
        }
        let area = points
            .iter()
            .zip(points.iter().cycle().skip(1))
            .map(|(a, b)| a.0 * b.1 - b.0 * a.1)
            .sum::<f64>()
            .abs()
            * 0.5;
        if area < 5. {
            continue;
        }
        let half = points.len() / 2;
        let mut small = Vec::new();
        simplify(&points[..=half], &mut small);
        points.push(points[0]);
        simplify(&points[half..], &mut small);
        loops.push(small);
    }
    // Sort by location to keep generated assets reproducible across processes.
    loops.sort_by(|a, b| a[0].1.total_cmp(&b[0].1).then(a[0].0.total_cmp(&b[0].0)));
    let mut d = String::new();
    let mut n = 0;
    for points in loops {
        for (i, (x, y)) in points.iter().enumerate() {
            let _ = write!(d, "{}{x} {y}", if i == 0 { 'M' } else { 'L' });
            n += 1;
        }
        d.push('Z');
    }
    (d, n)
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = std::env::args().collect::<Vec<_>>();
    let image = tiny_skia::Pixmap::load_png(&args[1])?;
    let (w, h) = (image.width() as usize, image.height() as usize);
    let ink = image
        .pixels()
        .iter()
        .map(|p| p.red() > 85 && p.green() > 85 && p.blue() < 90)
        .collect::<Vec<_>>();
    let mut outside = vec![false; w * h];
    let mut queue = VecDeque::new();
    for x in 0..w {
        queue.push_back(x);
        queue.push_back((h - 1) * w + x);
    }
    for y in 0..h {
        queue.push_back(y * w);
        queue.push_back(y * w + w - 1);
    }
    while let Some(i) = queue.pop_front() {
        if outside[i] || ink[i] {
            continue;
        }
        outside[i] = true;
        let (x, y) = (i % w, i / w);
        if x > 0 {
            queue.push_back(i - 1);
        }
        if x + 1 < w {
            queue.push_back(i + 1);
        }
        if y > 0 {
            queue.push_back(i - w);
        }
        if y + 1 < h {
            queue.push_back(i + w);
        }
    }
    let cover = outside.iter().map(|v| !v).collect::<Vec<_>>();
    let splits = (0..h)
        .map(|y| {
            let base = 518. - ((y as f64 - 730.) / 620.).clamp(0., 1.) * 53.;
            if y < 1000 {
                return base;
            }
            let mut runs = Vec::new();
            let mut start = None;
            for x in 0..=w {
                let on = x < w && cover[y * w + x];
                if on && start.is_none() {
                    start = Some(x);
                }
                if !on {
                    if let Some(a) = start.take() {
                        if x - a > 16 {
                            runs.push((a, x));
                        }
                    }
                }
            }
            if runs.len() >= 2 {
                ((runs[0].1 + runs[1].0) / 2) as f64
            } else if y > 1405 {
                800.
            } else {
                base
            }
        })
        .collect::<Vec<_>>();
    let mut svg=format!("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {w} {h}\">\n<title>Approved heroine — exact contour trace</title>\n");
    let mut total = 0;
    for part in ["far", "near", "upper"] {
        let region = |x: usize, y: usize| {
            let split = splits[y];
            let arm = x < 410 && y < 835;
            match part {
                "upper" => y < 735 || arm,
                "near" => y >= 660 && !arm && x as f64 >= split,
                _ => y >= 660 && !arm && (x as f64) < split,
            }
        };
        for (name, source, paint) in [("cover", &cover, "#000000"), ("ink", &ink, "#E7E100")] {
            let mask = source
                .iter()
                .enumerate()
                .map(|(i, &v)| {
                    let (x, y) = (i % w, i / w);
                    let mut on = v && region(x, y);
                    // Complete the hip hidden by the hanging hand in the source.
                    // It is revealed only as the rear leg swings past that hand.
                    if part == "far" && (680..835).contains(&y) {
                        let left = 378. + (y as f64 - 680.) * 0.077;
                        if name == "cover" && x as f64 >= left && (x as f64) < splits[y] {
                            on = true;
                        }
                        if name == "ink" && (x as f64 - left).abs() < 1.8 {
                            on = true;
                        }
                    }
                    on
                })
                .collect::<Vec<_>>();
            let (d, n) = trace(&mask, w, h);
            total += n;
            writeln!(
                svg,
                "<path id=\"{part}-{name}\" fill=\"{paint}\" fill-rule=\"evenodd\" d=\"{d}\"/>"
            )?;
        }
    }
    svg.push_str("</svg>\n");
    std::fs::write(&args[2], svg)?;
    println!(
        "{w}x{h}: {total} contour vertices; opaque mask area {}",
        cover.iter().filter(|v| **v).count()
    );
    Ok(())
}
