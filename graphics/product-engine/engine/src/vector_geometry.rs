//! Platform-independent vector geometry. Transform/opacity edits reuse meshes;
//! only an authored path morph or stroke change retessellates a contour.
use lyon_tessellation::{
    path::{math::point, Path},
    *,
};
#[derive(Clone, Copy, Debug)]
pub struct Matrix(pub [f32; 6]);
impl Default for Matrix {
    fn default() -> Self {
        Self([1., 0., 0., 1., 0., 0.])
    }
}
impl Matrix {
    pub fn then(self, b: Self) -> Self {
        let a = self.0;
        let b = b.0;
        Self([
            a[0] * b[0] + a[2] * b[1],
            a[1] * b[0] + a[3] * b[1],
            a[0] * b[2] + a[2] * b[3],
            a[1] * b[2] + a[3] * b[3],
            a[0] * b[4] + a[2] * b[5] + a[4],
            a[1] * b[4] + a[3] * b[5] + a[5],
        ])
    }
    pub fn point(self, p: [f32; 2]) -> [f32; 2] {
        let a = self.0;
        [
            a[0] * p[0] + a[2] * p[1] + a[4],
            a[1] * p[0] + a[3] * p[1] + a[5],
        ]
    }
    /// Largest singular value: include rotation, nonuniform scale and shear.
    pub fn max_scale(self) -> f32 {
        let [a, b, c, d, _, _] = self.0;
        let sum = a * a + b * b + c * c + d * d;
        let det = a * d - b * c;
        ((sum + (sum * sum - 4. * det * det).max(0.).sqrt()) / 2.).sqrt()
    }
    pub fn inverse(self) -> Self {
        let a = self.0;
        let det = a[0] * a[3] - a[1] * a[2];
        if det.abs() < 1e-9 {
            return Self::default();
        }
        Self([
            a[3] / det,
            -a[1] / det,
            -a[2] / det,
            a[0] / det,
            (a[2] * a[5] - a[3] * a[4]) / det,
            (a[1] * a[4] - a[0] * a[5]) / det,
        ])
    }
    pub fn parse(text: &str) -> Self {
        let mut out = Self::default();
        let text = text.replace("px", "").replace("deg", "");
        for t in svgtypes::TransformListParser::from(text.as_str()).flatten() {
            use svgtypes::TransformListToken::*;
            let m = match t {
                Matrix { a, b, c, d, e, f } => {
                    Self([a as f32, b as f32, c as f32, d as f32, e as f32, f as f32])
                }
                Translate { tx, ty } => Self([1., 0., 0., 1., tx as f32, ty as f32]),
                Scale { sx, sy } => Self([sx as f32, 0., 0., sy as f32, 0., 0.]),
                Rotate { angle } => {
                    let a = (angle as f32).to_radians();
                    Self([a.cos(), a.sin(), -a.sin(), a.cos(), 0., 0.])
                }
                SkewX { angle } => Self([1., 0., (angle as f32).to_radians().tan(), 1., 0., 0.]),
                SkewY { angle } => Self([1., (angle as f32).to_radians().tan(), 0., 1., 0., 0.]),
            };
            out = out.then(m);
        }
        out
    }
}
/// Coordinates in the gradient's along/across basis. The painter samples x;
/// retain y so the CPU mask adapter can invert this map for its shader transform.
/// A zero across component makes every linear gradient singular and discards
/// the authored position/direction when a soft SVG mask is rasterized.
pub fn linear_gradient_position(p: [f32; 2], start: [f32; 2], end: [f32; 2]) -> [f32; 2] {
    let d = [end[0] - start[0], end[1] - start[1]];
    let v = [p[0] - start[0], p[1] - start[1]];
    let length_squared = (d[0] * d[0] + d[1] * d[1]).max(0.00001);
    [
        (v[0] * d[0] + v[1] * d[1]) / length_squared,
        (-v[0] * d[1] + v[1] * d[0]) / length_squared,
    ]
}
pub fn path(source: &str) -> Result<Path, String> {
    let mut builder = Path::builder();
    let mut open = false;
    for part in svgtypes::SimplifyingPathParser::from(source) {
        use svgtypes::SimplePathSegment::*;
        match part.map_err(|e| e.to_string())? {
            MoveTo { x, y } => {
                if open {
                    builder.end(false);
                }
                builder.begin(point(x as f32, y as f32));
                open = true;
            }
            LineTo { x, y } => {
                builder.line_to(point(x as f32, y as f32));
            }
            CurveTo {
                x1,
                y1,
                x2,
                y2,
                x,
                y,
            } => {
                builder.cubic_bezier_to(
                    point(x1 as f32, y1 as f32),
                    point(x2 as f32, y2 as f32),
                    point(x as f32, y as f32),
                );
            }
            Quadratic { x1, y1, x, y } => {
                builder.quadratic_bezier_to(point(x1 as f32, y1 as f32), point(x as f32, y as f32));
            }
            ClosePath => {
                builder.end(true);
                open = false;
            }
        }
    }
    if open {
        builder.end(false);
    }
    Ok(builder.build())
}
#[derive(Default, Clone)]
pub struct Mesh {
    pub vertices: Vec<[f32; 2]>,
    pub indices: Vec<u32>,
    pub bounds: [f32; 4],
}
/// Hard contour masks must retain enough samples for their displayed scale.
/// Keep one cache for the widest product viewport and maximum artwork density;
/// quality changes and the authored 1% breathing motion then reuse that cache.
pub fn contour_mask_density(view_width: f32, display_width: f32, local_scale: f32) -> f32 {
    crate::quality::MAX_DENSITY * display_width.max(1.) / view_width.max(1.)
        * local_scale.max(1.)
        * 1.1
}
pub fn mesh(
    source: &str,
    stroke: Option<f32>,
    even_odd: bool,
    round: bool,
) -> Result<Mesh, String> {
    if source.trim().is_empty() {
        return Ok(Mesh::default());
    }
    let p = path(source)?;
    tessellate(&p, stroke, even_odd, round)
}
fn tessellate(p: &Path, stroke: Option<f32>, even_odd: bool, round: bool) -> Result<Mesh, String> {
    let mut geometry: VertexBuffers<[f32; 2], u32> = VertexBuffers::new();
    if let Some(width) = stroke {
        if width <= 0. {
            return Ok(Mesh::default());
        }
        let options = StrokeOptions::default()
            .with_line_width(width)
            .with_tolerance(0.025)
            .with_line_cap(if round { LineCap::Round } else { LineCap::Butt })
            .with_line_join(if round {
                LineJoin::Round
            } else {
                LineJoin::Miter
            });
        StrokeTessellator::new()
            .tessellate_path(
                p,
                &options,
                &mut BuffersBuilder::new(&mut geometry, |v: StrokeVertex| v.position().to_array()),
            )
            .map_err(|e| format!("Stroke: {e:?}"))?;
    } else {
        FillTessellator::new()
            .tessellate_path(
                p,
                &FillOptions::default()
                    .with_fill_rule(if even_odd {
                        FillRule::EvenOdd
                    } else {
                        FillRule::NonZero
                    })
                    .with_tolerance(0.025),
                &mut BuffersBuilder::new(&mut geometry, |v: FillVertex| v.position().to_array()),
            )
            .map_err(|e| format!("Fill: {e:?}"))?;
    }
    let mut bounds = [
        f32::INFINITY,
        f32::INFINITY,
        f32::NEG_INFINITY,
        f32::NEG_INFINITY,
    ];
    for v in &geometry.vertices {
        bounds[0] = bounds[0].min(v[0]);
        bounds[1] = bounds[1].min(v[1]);
        bounds[2] = bounds[2].max(v[0]);
        bounds[3] = bounds[3].max(v[1]);
    }
    if geometry.vertices.is_empty() {
        bounds = [0.; 4];
    }
    Ok(Mesh {
        vertices: geometry.vertices,
        indices: geometry.indices,
        bounds,
    })
}

/// SVG dash lengths use authored pathLength units. The contour stays a vector;
/// only a changed dash/morph retessellates the stroke, never its fill.
pub fn dashed_mesh(
    source: &str,
    width: f32,
    round: bool,
    dashes: &[f32],
    offset: f32,
    declared_length: f32,
) -> Result<Mesh, String> {
    use lyon_tessellation::path::iterator::PathIterator;
    let original = path(source)?;
    if dashes.is_empty() || dashes.iter().all(|v| *v <= 0.) {
        return tessellate(&original, Some(width), false, round);
    }
    let events = original.iter().flattened(0.025).collect::<Vec<_>>();
    let length = events
        .iter()
        .map(|event| match event {
            lyon_tessellation::path::Event::Line { from, to } => (*to - *from).length(),
            lyon_tessellation::path::Event::End {
                last,
                first,
                close: true,
            } => (*first - *last).length(),
            _ => 0.,
        })
        .sum::<f32>();
    let ratio = if declared_length > 0. {
        length / declared_length
    } else {
        1.
    };
    let mut pattern = dashes.iter().map(|v| v.max(0.) * ratio).collect::<Vec<_>>();
    if pattern.len() % 2 == 1 {
        pattern.extend_from_within(..);
    }
    let total = pattern.iter().sum::<f32>();
    if total < 1e-6 {
        return tessellate(&original, Some(width), false, round);
    }
    let mut builder = Path::builder();
    let mut open = false;
    let mut index = 0;
    let mut remaining = pattern[0];
    let mut initial = (offset * ratio).rem_euclid(total);
    while initial >= remaining {
        initial -= remaining;
        index = (index + 1) % pattern.len();
        remaining = pattern[index];
    }
    remaining -= initial;
    let initial_index = index;
    let initial_remaining = remaining;
    for event in events {
        use lyon_tessellation::path::Event::*;
        if matches!(event, Begin { .. }) {
            if open {
                builder.end(false);
                open = false;
            }
            index = initial_index;
            remaining = initial_remaining;
            continue;
        }
        let pair = match event {
            Line { from, to } => Some((from, to)),
            End {
                last,
                first,
                close: true,
            } => Some((last, first)),
            _ => None,
        };
        if let Some((from, to)) = pair {
            let length = (to - from).length();
            let mut at = 0.;
            while at < length - 1e-6 {
                while remaining <= 1e-6 {
                    index = (index + 1) % pattern.len();
                    remaining = pattern[index];
                }
                let step = remaining.min(length - at);
                let end = at + step;
                if index % 2 == 0 {
                    if !open {
                        builder.begin(from + (to - from) * (at / length));
                        open = true;
                    }
                    builder.line_to(from + (to - from) * (end / length));
                } else if open {
                    builder.end(false);
                    open = false;
                }
                at = end;
                remaining -= step;
                if remaining <= 1e-6 && index % 2 == 0 && open {
                    builder.end(false);
                    open = false;
                }
            }
        }
        if matches!(event, End { .. }) && open {
            builder.end(false);
            open = false;
        }
    }
    if open {
        builder.end(false);
    }
    tessellate(&builder.build(), Some(width), false, round)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn gradient_map(start: [f32; 2], end: [f32; 2]) -> Matrix {
        let o = linear_gradient_position([0., 0.], start, end);
        let x = linear_gradient_position([1., 0.], start, end);
        let y = linear_gradient_position([0., 1.], start, end);
        Matrix([
            x[0] - o[0],
            x[1] - o[1],
            y[0] - o[0],
            y[1] - o[1],
            o[0],
            o[1],
        ])
    }
    #[test]
    fn linear_gradient_basis_retains_direction_and_is_invertible() {
        for (start, end) in [
            ([0., 70.], [0., 86.]),
            ([70., 0.], [86., 0.]),
            ([30., 70.], [46., 86.]),
        ] {
            let map = gradient_map(start, end);
            let middle = [(start[0] + end[0]) / 2., (start[1] + end[1]) / 2.];
            let unit = map.point(middle);
            assert!((unit[0] - 0.5).abs() < 0.0001 && unit[1].abs() < 0.0001);
            let point = [18., 122.];
            let restored = map.inverse().point(map.point(point));
            assert!(
                (restored[0] - point[0]).abs() < 0.001 && (restored[1] - point[1]).abs() < 0.001
            );
        }
    }
    #[test]
    fn rasterized_scanner_mask_keeps_light_inside_the_moving_band() {
        use tiny_skia::*;
        // Exercise the pinned mask rasterizer with the same unit-gradient adapter
        // as the SVG renderer, at different scanner positions and axis directions.
        for horizontal in [false, true] {
            for top in [12., 70., 133., 188.] {
                let bottom = top + 16.;
                let (start, end) = if horizontal {
                    ([top, 0.], [bottom, 0.])
                } else {
                    ([0., top], [0., bottom])
                };
                let m = gradient_map(start, end).inverse().0;
                let shader = LinearGradient::new(
                    Point::from_xy(0., 0.),
                    Point::from_xy(1., 0.),
                    vec![
                        GradientStop::new(0., Color::BLACK),
                        GradientStop::new(0.25, Color::WHITE),
                        GradientStop::new(0.75, Color::WHITE),
                        GradientStop::new(1., Color::BLACK),
                    ],
                    SpreadMode::Pad,
                    Transform::from_row(m[0], m[1], m[2], m[3], m[4], m[5]),
                )
                .expect("valid scanner gradient transform");
                let mut pixels = Pixmap::new(240, 240).unwrap();
                let path = PathBuilder::from_rect(Rect::from_xywh(0., 0., 240., 240.).unwrap());
                let paint = Paint {
                    shader,
                    ..Default::default()
                };
                pixels.fill_path(
                    &path,
                    &paint,
                    FillRule::Winding,
                    Transform::identity(),
                    None,
                );
                for at in 0..240 {
                    let pixel = if horizontal {
                        pixels.pixel(at, 30)
                    } else {
                        pixels.pixel(30, at)
                    }
                    .unwrap();
                    let position = at as f32 + 0.5;
                    if position < top || position > bottom {
                        assert_eq!(
                            pixel.red(),
                            0,
                            "scanner leaked outside {top}..{bottom} at {position}"
                        );
                    } else if position >= top + 4. && position <= bottom - 4. {
                        assert_eq!(
                            pixel.red(),
                            255,
                            "scanner disappeared inside band at {position}"
                        );
                    }
                }
            }
        }
    }
    #[test]
    fn contour_cache_covers_scaled_silhouette_at_all_product_widths() {
        let scale = Matrix::parse("translate(-18 -8) scale(2.05)").max_scale();
        let cached = contour_mask_density(288., 480., scale);
        for width in [320., 375., 416., 480.] {
            for density in [1.5, 2., 2.5] {
                let rendered_scale = width / 288. * scale * 1.02;
                assert!(cached / rendered_scale >= density);
            }
        }
        assert!(cached > 9. && cached < 10.);
    }
    #[test]
    fn maximum_scale_accounts_for_shear_and_rotation() {
        let rotated = Matrix::parse("rotate(41) scale(2.05)");
        assert!((rotated.max_scale() - 2.05).abs() < 0.001);
        assert!(Matrix::parse("skewX(45)").max_scale() > 1.6);
    }
    #[test]
    fn original_arc_and_relative_paths_remain_vectors() {
        let m = mesh("M10 20h30a10 10 0 0 1 10 10v20z", None, false, true).unwrap();
        assert!(m.indices.len() > 9);
        assert!(m.bounds[2] >= 49.9);
    }
    #[test]
    fn resize_transform_and_inverse_preserve_points() {
        let m = Matrix::parse("translate(144 77) scale(1.3) translate(-144 -77)");
        let p = [12., 32.];
        let q = m.inverse().point(m.point(p));
        assert!((q[0] - p[0]).abs() < 0.0001 && (q[1] - p[1]).abs() < 0.0001);
    }
    #[test]
    fn authored_path_length_and_offsets_preserve_dash_arc() {
        let first = dashed_mesh("M0 0H100", 2., false, &[25., 75.], 0., 100.).unwrap();
        assert!(first.bounds[0].abs() < 0.001 && (first.bounds[2] - 25.).abs() < 0.001);
        let shifted = dashed_mesh("M0 0H100", 2., false, &[25., 75.], -25., 100.).unwrap();
        assert!((shifted.bounds[0] - 25.).abs() < 0.001 && (shifted.bounds[2] - 50.).abs() < 0.001);
        let normalized = dashed_mesh("M0 0H200", 2., false, &[25., 75.], 0., 100.).unwrap();
        assert!((normalized.bounds[2] - 50.).abs() < 0.001);
    }
    #[test]
    fn original_scene_paths_are_parseable_without_replacing_artwork() {
        for (kind, source) in [
            ("cells", include_str!("../assets/cells.svg")),
            ("diary", include_str!("../assets/diary.svg")),
            ("insight", include_str!("../assets/insight.svg")),
            ("crowd", include_str!("../assets/crowd.svg")),
            ("distance", include_str!("../assets/distance.svg")),
        ] {
            let doc = roxmltree::Document::parse(source).unwrap();
            for node in doc.descendants().filter(|n| n.has_tag_name("path")) {
                let d = node.attribute("d").unwrap_or("");
                path(d).unwrap_or_else(|e| {
                    panic!("{kind} path {:?}: {e}; {d}", node.attribute("class"))
                });
            }
        }
    }
}
