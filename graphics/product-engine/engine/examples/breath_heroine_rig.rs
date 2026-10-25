//! Save deterministic frames of the approved silhouette's rig for visual review.
use std::error::Error;
use tiny_skia::{Color, FillRule, Paint, PathBuilder, Pixmap, Transform};
use watcher_graphics::breath_heroine::{paths, FootTarget, Pose, ANKLES};

fn main() -> Result<(), Box<dyn Error>> {
    let output = std::env::args().nth(1).ok_or("output path required")?;
    let mut image = Pixmap::new(1600, 1000).ok_or("allocation")?;
    image.fill(Color::from_rgba8(7, 9, 7, 255));
    for i in 0..4 {
        let pose = match i {
            0 => Pose::default(),
            1 => Pose {
                feet: Some([(640., 1330.), (300., 1320.)].map(|ankle| FootTarget {
                    ankle,
                    angle: 0.,
                    scale: 1.,
                })),
                walk: 1.,
                ..Pose::default()
            },
            2 => Pose {
                feet: Some([(480., 1280.), (460., 1348.)].map(|ankle| FootTarget {
                    ankle,
                    angle: 0.,
                    scale: 1.,
                })),
                walk: 1.,
                time: 0.46,
                ..Pose::default()
            },
            _ => Pose {
                feet: Some([(390., 1330.), (550., 1260.)].map(|ankle| FootTarget {
                    ankle,
                    angle: 0.,
                    scale: 1.,
                })),
                walk: 1.,
                time: 0.92,
                ..Pose::default()
            },
        };
        for (j, d) in paths(pose, (i as f64 * 400. - 110., 20.), 0.64)
            .iter()
            .enumerate()
        {
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
            } else {
                Color::from_rgba8(231, 225, 0, 255)
            });
            image.fill_path(&p, &paint, FillRule::Winding, Transform::identity(), None);
        }
    }
    image.save_png(output)?;
    println!("Rendered four poses; source anchors {ANKLES:?}");
    Ok(())
}
