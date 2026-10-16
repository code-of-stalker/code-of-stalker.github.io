//! Level panels move their bottom vertices instead of scaling the whole artwork.
use std::fmt::Write;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LevelContour {
    Basic,
    Intensive,
    Guidance,
}

impl TryFrom<&str> for LevelContour {
    type Error = &'static str;
    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "basic" => Ok(Self::Basic),
            "intensive" => Ok(Self::Intensive),
            "guidance" => Ok(Self::Guidance),
            _ => Err("Unknown level contour"),
        }
    }
}

pub struct LevelGeometry {
    pub vertices: [[f64; 2]; 6],
    pub cut: f64,
}

impl LevelGeometry {
    pub fn new(level: LevelContour, width: f64, height: f64) -> Option<Self> {
        if !width.is_finite() || !height.is_finite() || width < 1. || height < 1. {
            return None;
        }
        // Reserve half the maximum approved 0.75px stroke. Selection changes
        // stroke weight without nudging the contour's anchors by a quarter pixel.
        let inset = 0.375;
        let right = width - inset;
        let bottom = height - inset;
        let cut = 20_f64
            .min((width - inset * 2.) / 2.)
            .min((height - inset * 2.) / 2.);
        let vertices = match level {
            LevelContour::Basic => [
                [inset, inset],
                [right - cut, inset],
                [right, inset + cut],
                [right, bottom],
                [inset + cut, bottom],
                [inset, bottom - cut],
            ],
            LevelContour::Intensive => [
                [inset + cut, inset],
                [right, inset],
                [right, bottom],
                [inset + cut, bottom],
                [inset, bottom - cut],
                [inset, inset + cut],
            ],
            LevelContour::Guidance => [
                [inset + cut, inset],
                [right, inset],
                [right, bottom - cut],
                [right - cut, bottom],
                [inset, bottom],
                [inset, inset + cut],
            ],
        };
        Some(Self { vertices, cut })
    }

    pub fn path(&self) -> String {
        let mut path = String::with_capacity(150);
        for (index, [x, y]) in self.vertices.iter().enumerate() {
            let command = if index == 0 { 'M' } else { 'L' };
            let _ = write!(path, "{command}{x:.3} {y:.3}");
        }
        path.push('Z');
        path
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expansion_keeps_cuts_at_45_degrees_and_only_translates_bottom_anchors() {
        for level in [
            LevelContour::Basic,
            LevelContour::Intensive,
            LevelContour::Guidance,
        ] {
            for width in [288., 335., 416.] {
                let closed = LevelGeometry::new(level, width, 62.).unwrap();
                assert_eq!(closed.cut, 20.);
                for height in [70., 96., 153.5, 254., 368.] {
                    let open = LevelGeometry::new(level, width, height).unwrap();
                    assert_eq!(open.cut, closed.cut);
                    for (a, b) in closed.vertices.iter().zip(open.vertices) {
                        assert_eq!(a[0], b[0]);
                        let expected_shift = if a[1] > 31. { height - 62. } else { 0. };
                        assert!((b[1] - a[1] - expected_shift).abs() < 1e-9);
                    }
                    let mut diagonal_count = 0;
                    for index in 0..6 {
                        let a = open.vertices[index];
                        let b = open.vertices[(index + 1) % 6];
                        let dx = (b[0] - a[0]).abs();
                        let dy = (b[1] - a[1]).abs();
                        if dx > 0. && dy > 0. {
                            diagonal_count += 1;
                            assert!((dx - dy).abs() < 1e-9);
                            assert!((dx - open.cut).abs() < 1e-9);
                        }
                    }
                    assert_eq!(diagonal_count, 2);
                }
            }
        }
    }

    #[test]
    fn invalid_sizes_are_ignored_and_small_shapes_remain_inside_their_bounds() {
        for (width, height) in [(f64::NAN, 62.), (288., f64::INFINITY), (0., 62.)] {
            assert!(LevelGeometry::new(LevelContour::Basic, width, height).is_none());
        }
        let small = LevelGeometry::new(LevelContour::Intensive, 10., 8.).unwrap();
        assert!(small
            .vertices
            .iter()
            .all(|[x, y]| *x >= 0. && *x <= 10. && *y >= 0. && *y <= 8.));
        assert!(LevelContour::try_from("other").is_err());
    }
}
