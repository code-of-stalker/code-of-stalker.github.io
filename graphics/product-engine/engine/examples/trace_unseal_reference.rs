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
    if far.1 > 0.45 {
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
    let args: Vec<_> = std::env::args().collect();
    let image = tiny_skia::Pixmap::load_png(&args[1])?;
    let w = image.width() as usize;
    let h = image.height() as usize;
    let ink: Vec<bool> = image
        .pixels()
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let x = i % w;
            let y = i / w;
            (1115..1445).contains(&x)
                && (145..877).contains(&y)
                && p.red() > 145
                && p.green() > 125
                && p.blue() < 125
        })
        .collect();
    // Close isolated one-pixel gaps in the luminous reference contour.
    let mut barrier = ink.clone();
    for y in 146..876 {
        for x in 1116..1444 {
            let i = y * w + x;
            barrier[i] = ink[i] || (ink[i - 1] && ink[i + 1]) || (ink[i - w] && ink[i + w]);
        }
    }
    let mut outside = vec![false; w * h];
    let mut q = VecDeque::new();
    for x in 0..w {
        q.push_back(x);
        q.push_back((h - 1) * w + x);
    }
    for y in 0..h {
        q.push_back(y * w);
        q.push_back(y * w + w - 1);
    }
    // The air between the arm and the trunk remains a real hole.
    for (x, y) in [(1215, 400), (1350, 410)] {
        q.push_back(y * w + x);
    }
    while let Some(i) = q.pop_front() {
        if outside[i] || barrier[i] {
            continue;
        }
        outside[i] = true;
        let x = i % w;
        let y = i / w;
        if x > 0 {
            q.push_back(i - 1);
        }
        if x + 1 < w {
            q.push_back(i + 1);
        }
        if y > 0 {
            q.push_back(i - w);
        }
        if y + 1 < h {
            q.push_back(i + w);
        }
    }
    let inside: Vec<bool> = outside.iter().map(|v| !v).collect();
    // Retain only the figure's connected cover, excluding falling chain fragments.
    let mut cover = vec![false; w * h];
    let mut q = VecDeque::from([400 * w + 1280]);
    while let Some(i) = q.pop_front() {
        if cover[i] || !inside[i] {
            continue;
        }
        cover[i] = true;
        let x = i % w;
        let y = i / w;
        if x > 0 {
            q.push_back(i - 1);
        }
        if x + 1 < w {
            q.push_back(i + 1);
        }
        if y > 0 {
            q.push_back(i - w);
        }
        if y + 1 < h {
            q.push_back(i + w);
        }
    }
    let visible: Vec<bool> = ink
        .iter()
        .enumerate()
        .map(|(i, &v)| v && cover[i])
        .collect();
    let area = cover.iter().filter(|v| **v).count();
    assert!(area > 30_000, "cover leaked: {area}");
    let mut svg =
        format!("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"1115 145 330 732\">\n");
    // A cut passes through the shoulder sockets and pelvis; source outlines
    // remain intact and cover overlaps conceal only the invisible cut edges.
    for part in ["far-arm", "far-leg", "near-leg", "trunk", "near-arm"] {
        let region = |x: usize, y: usize| {
            let near_arm = if y < 360 {
                (x as f64) < 1247. - (y as f64 - 280.) * 0.21 && y > 265
            } else {
                (x as f64) < 1230. - (y as f64 - 360.) * 0.18 && y < 580
            };
            let far_arm = if y < 360 {
                x as f64 > 1300. + (y as f64 - 300.) * 0.15 && y > 280
            } else {
                x as f64 > 1300. + (y as f64 - 300.) * 0.15 && y < 590
            };
            let split = 1285. - ((y as f64 - 520.) / 220.).clamp(0., 1.) * 40.;
            match part {
                "near-arm" => near_arm,
                "far-arm" => far_arm,
                "far-leg" => y > 485 && !near_arm && !far_arm && x as f64 >= split,
                "near-leg" => y > 485 && !near_arm && !far_arm && (x as f64) < split,
                _ => y < 525 && !near_arm && !far_arm,
            }
        };
        for (name, source, color) in [("cover", &cover, "#000000"), ("ink", &visible, "#E7E100")] {
            let mask: Vec<bool> = source
                .iter()
                .enumerate()
                .map(|(i, &v)| v && region(i % w, i / w))
                .collect();
            let (d, n) = trace(&mask, w, h);
            writeln!(
                svg,
                "<path id=\"{part}-{name}\" fill=\"{color}\" fill-rule=\"evenodd\" d=\"{d}\"/>"
            )?;
            println!("{part}-{name}: {n} vertices");
        }
    }
    svg.push_str("</svg>");
    std::fs::write(&args[2], svg)?;
    println!("cover pixels {area}");
    for y in [
        160, 200, 250, 280, 320, 360, 400, 440, 480, 520, 560, 640, 720, 800, 850,
    ] {
        let mut runs = Vec::new();
        let mut start = None;
        for x in 1115..1446 {
            let on = x < 1445 && cover[y * w + x];
            if on && start.is_none() {
                start = Some(x);
            }
            if !on {
                if let Some(a) = start.take() {
                    runs.push((a, x));
                }
            }
        }
        println!("row {y}: {runs:?}");
    }
    Ok(())
}
