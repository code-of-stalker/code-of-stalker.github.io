pub fn polygons(source: &str) -> Result<Vec<Vec<[f32; 2]>>, String> {
    let mut all = Vec::new();
    let mut points = Vec::new();
    let mut x = 0.;
    let mut y = 0.;
    for part in svgtypes::PathParser::from(source) {
        match part.map_err(|e| e.to_string())? {
            svgtypes::PathSegment::MoveTo {
                abs: true,
                x: xx,
                y: yy,
            } => {
                if points.len() >= 3 {
                    all.push(std::mem::take(&mut points));
                }
                x = xx as f32;
                y = yy as f32;
                points.push([x, y]);
            }
            svgtypes::PathSegment::LineTo {
                abs: true,
                x: xx,
                y: yy,
            } => {
                x = xx as f32;
                y = yy as f32;
                points.push([x, y]);
            }
            svgtypes::PathSegment::HorizontalLineTo { abs: true, x: xx } => {
                x = xx as f32;
                points.push([x, y]);
            }
            svgtypes::PathSegment::VerticalLineTo { abs: true, y: yy } => {
                y = yy as f32;
                points.push([x, y]);
            }
            svgtypes::PathSegment::ClosePath { .. } => {
                if points.len() >= 3 {
                    all.push(std::mem::take(&mut points));
                }
            }
            _ => return Err("Unsupported panel contour; keep the approved line geometry".into()),
        }
    }
    if points.len() >= 3 {
        all.push(points);
    }
    if all.is_empty() {
        return Err("Empty contour".into());
    }
    Ok(all)
}
fn distance(x: f32, y: f32, all: &[Vec<[f32; 2]>]) -> f32 {
    let mut d = f32::INFINITY;
    let mut inside = false;
    for p in all {
        let mut hit = false;
        for i in 0..p.len() {
            let [ax, ay] = p[(i + p.len() - 1) % p.len()];
            let [bx, by] = p[i];
            if (ay > y) != (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax {
                hit = !hit;
            }
            let dx = bx - ax;
            let dy = by - ay;
            let t =
                (((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy).max(1e-12)).clamp(0., 1.);
            d = d.min((x - ax - t * dx).powi(2) + (y - ay - t * dy).powi(2));
        }
        inside |= hit;
    }
    if inside {
        -d.sqrt()
    } else {
        d.sqrt()
    }
}
pub fn pixels(source: &str, w: f32, h: f32) -> Result<(Vec<u8>, u32, u32), String> {
    let all = polygons(source)?;
    let width = (w.round() as u32).clamp(16, 192);
    let height = ((width as f32 * h / w).round() as u32).clamp(16, 384);
    let mut out = vec![0; width as usize * height as usize * 4];
    for y in 0..height {
        for x in 0..width {
            let d = distance(
                (x as f32 + 0.5) * w / width as f32,
                (y as f32 + 0.5) * h / height as f32,
                &all,
            ) / h;
            let v = ((d.clamp(-1., 1.) + 1.) * 0.5 * 65535.).round() as u16;
            let i = (y * width + x) as usize * 4;
            out[i] = (v >> 8) as u8;
            out[i + 1] = v as u8;
            out[i + 3] = 255;
        }
    }
    Ok((out, width, height))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn independent_notched_polygons() {
        let p = polygons("M0 0H100V20L80 10H60L50 20H0ZM0 30H100V80H0Z").unwrap();
        assert_eq!(p.len(), 2);
        assert!(distance(10., 10., &p) < 0.);
        assert!(distance(10., 25., &p) > 0.);
        assert!(distance(10., 50., &p) < 0.);
    }
    #[test]
    fn refuses_silent_shape_change() {
        assert!(polygons("M0 0C0 5 5 5 10 10Z").is_err());
    }
}
