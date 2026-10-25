//! Contact sheet of the actual crossing choreography, not invented review poses.
use std::error::Error;
use tiny_skia::{Color, FillRule, Paint, PathBuilder, Pixmap, Transform};
use watcher_graphics::{
    breath_axis::heroine_review_pose,
    breath_heroine::{paths, Rig, SOLES},
};

fn main() -> Result<(), Box<dyn Error>> {
    let output = std::env::args().nth(1).ok_or("output path required")?;
    let start = std::env::args()
        .nth(2)
        .unwrap_or("6.44".into())
        .parse::<f64>()?;
    let increment = std::env::args()
        .nth(3)
        .unwrap_or("0.17".into())
        .parse::<f64>()?;
    let mut image = Pixmap::new(1760, 1240).ok_or("allocation")?;
    image.fill(Color::BLACK);
    for i in 0..8 {
        let t = start + i as f64 * increment;
        let (pose, _, _) = heroine_review_pose(t);
        let origin = ((i % 4) as f64 * 440. - 10., (i / 4) as f64 * 620. + 16.);
        let scale = 0.39;
        for (j, d) in paths(pose, origin, scale).iter().enumerate() {
            let mut b = PathBuilder::new();
            for s in svgtypes::PathParser::from(d.as_str()) {
                match s? {
                    svgtypes::PathSegment::MoveTo { x, y, .. } => b.move_to(x as f32, y as f32),
                    svgtypes::PathSegment::LineTo { x, y, .. } => b.line_to(x as f32, y as f32),
                    svgtypes::PathSegment::ClosePath { .. } => b.close(),
                    _ => unreachable!(),
                }
            }
            let p = b.finish().ok_or("empty outline")?;
            let mut paint = Paint::default();
            paint.set_color(if j % 2 == 0 {
                Color::BLACK
            } else if j == 1 {
                Color::from_rgba8(145, 142, 0, 255)
            } else {
                Color::from_rgba8(231, 225, 0, 255)
            });
            image.fill_path(&p, &paint, FillRule::Winding, Transform::identity(), None);
        }
        let rig = Rig::new(pose);
        let soles = [rig.point(SOLES[0], 1), rig.point(SOLES[0], 0)];
        println!(
            "{t:.2}s upper={:?} soles={soles:?}",
            rig.point((480., 600.), 2)
        );
    }
    image.save_png(output)?;
    Ok(())
}
