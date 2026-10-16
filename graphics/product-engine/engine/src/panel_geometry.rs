//! Frame resizing preserves authored corner offsets in both axes.
use crate::contour::polygons;
use std::fmt::Write;

pub fn fit_path(source: &str, original: [f64; 2], target: [f64; 2]) -> Result<String, String> {
    if original
        .iter()
        .chain(target.iter())
        .any(|v| !v.is_finite() || *v <= 0.)
    {
        return Err("Invalid panel size".into());
    }
    let polygons = polygons(source)?;
    let mut caps = [1_f64; 4]; // left, right, top, bottom
    for points in &polygons {
        for index in 0..points.len() {
            let a = points[index];
            let b = points[(index + 1) % points.len()];
            let dx = (f64::from(a[0]) - f64::from(b[0])).abs();
            let dy = (f64::from(a[1]) - f64::from(b[1])).abs();
            if dx > 0.001 && dy > 0.001 && (0.5..=2.).contains(&(dx / dy)) {
                let left = f64::from(a[0].max(b[0])) + 0.001;
                let right = original[0] - f64::from(a[0].min(b[0])) + 0.001;
                let top = f64::from(a[1].max(b[1])) + 0.001;
                let bottom = original[1] - f64::from(a[1].min(b[1])) + 0.001;
                let horizontal = if left <= right { 0 } else { 1 };
                let vertical = if top <= bottom { 2 } else { 3 };
                caps[horizontal] = caps[horizontal].max(left.min(right));
                caps[vertical] = caps[vertical].max(top.min(bottom));
            }
        }
    }
    for (axis, length) in original.iter().enumerate() {
        let index = axis * 2;
        let factor = 1_f64.min(length / (caps[index] + caps[index + 1]));
        caps[index] *= factor;
        caps[index + 1] *= factor;
    }
    // Only genuinely undersized panels may reduce both corner axes together.
    let scale = 1_f64
        .min(target[0] / (caps[0] + caps[1]))
        .min(target[1] / (caps[2] + caps[3]));
    let axis = |value: f64, original: f64, target: f64, leading: f64, trailing: f64| {
        if value <= leading {
            value * scale
        } else if value >= original - trailing {
            target - (original - value) * scale
        } else {
            leading * scale
                + (value - leading) / (original - leading - trailing)
                    * (target - (leading + trailing) * scale)
        }
    };
    let mut result = String::with_capacity(source.len() * 2);
    for points in polygons {
        for (index, point) in points.iter().enumerate() {
            let command = if index == 0 { 'M' } else { 'L' };
            let x = axis(
                f64::from(point[0]),
                original[0],
                target[0],
                caps[0],
                caps[1],
            );
            let y = axis(
                f64::from(point[1]),
                original[1],
                target[1],
                caps[2],
                caps[3],
            );
            let _ = write!(result, "{command}{x:.6} {y:.6}");
        }
        result.push('Z');
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn width_and_height_move_edges_without_distorting_corner_offsets() {
        let source = "M0.125 0.125H268L288 20.125V180L268 200.125H0.125Z";
        for width in [250., 288.125, 335., 416., 700.] {
            for height in [62., 200.125, 370., 1000.] {
                let fitted = fit_path(source, [288.125, 200.25], [width, height]).unwrap();
                let points = &polygons(&fitted).unwrap()[0];
                assert!((points[0][0] - 0.125).abs() < 0.0001);
                assert!((points[2][0] - (width - 0.125) as f32).abs() < 0.0001);
                assert!((points[4][1] - (height - 0.125) as f32).abs() < 0.0001);
                assert!((points[2][0] - points[1][0] - 20.).abs() < 0.0001);
                assert!((points[2][1] - points[1][1] - 20.).abs() < 0.0001);
            }
        }
    }

    #[test]
    fn interior_header_notch_moves_as_one_shape_and_preserves_its_depth() {
        let source = "M.25 .25H287.75V57.5L259 25.25H212L200 37.25H164L152 25.25H.25ZM.25 33.75H152L164 45.75H200L212 33.75H259L287.75 65.75V313.75H.25Z";
        let fitted = fit_path(source, [288., 314.], [416., 700.]).unwrap();
        let points = polygons(&fitted).unwrap();
        assert_eq!(points[0][4], [340., 25.25]);
        assert_eq!(points[0][5], [328., 37.25]);
        assert_eq!(points[0][7], [280., 25.25]);
        assert_eq!(points[1][6], [415.75, 65.75]);
        assert_eq!(points[1][7], [415.75, 699.75]);
    }

    #[test]
    fn rectangles_keep_insets_and_invalid_contracts_fail_explicitly() {
        let fitted = fit_path(
            "M.125 .125H287.875V199.875H.125Z",
            [288., 200.],
            [416., 500.],
        )
        .unwrap();
        assert_eq!(
            polygons(&fitted).unwrap()[0],
            vec![
                [0.125, 0.125],
                [415.875, 0.125],
                [415.875, 499.875],
                [0.125, 499.875]
            ]
        );
        assert!(fit_path("M0 0C0 5 5 5 10 10Z", [100., 100.], [200., 200.]).is_err());
        assert!(fit_path("M0 0H10V10Z", [0., 100.], [200., 200.]).is_err());
    }
}
