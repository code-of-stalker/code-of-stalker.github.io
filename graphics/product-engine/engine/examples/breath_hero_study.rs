//! Render the standalone art-direction sheet with Rust, without altering the app.
#[path = "../src/breath_hero_study.rs"]
mod study;

use std::{error::Error, path::Path};
use tiny_skia::{
    Color, FillRule, LineCap, LineJoin, Paint, PathBuilder, Pixmap, Stroke, Transform,
};

fn draw(
    target: &mut Pixmap,
    pose: study::Pose,
    transform: Transform,
) -> Result<(), Box<dyn Error>> {
    for c in study::contours(pose) {
        let mut builder = PathBuilder::new();
        for part in svgtypes::SimplifyingPathParser::from(c.d.as_str()) {
            use svgtypes::SimplePathSegment::*;
            match part? {
                MoveTo { x, y } => builder.move_to(x as f32, y as f32),
                LineTo { x, y } => builder.line_to(x as f32, y as f32),
                CurveTo {
                    x1,
                    y1,
                    x2,
                    y2,
                    x,
                    y,
                } => builder.cubic_to(
                    x1 as f32, y1 as f32, x2 as f32, y2 as f32, x as f32, y as f32,
                ),
                Quadratic { x1, y1, x, y } => {
                    builder.quad_to(x1 as f32, y1 as f32, x as f32, y as f32)
                }
                ClosePath => builder.close(),
            }
        }
        let path = builder.finish().ok_or("empty contour")?;
        let mut paint = Paint::default();
        paint.set_color(Color::BLACK);
        if c.opaque {
            target.fill_path(&path, &paint, FillRule::Winding, transform, None);
        }
        paint.set_color_rgba8((231. * c.ink) as u8, (225. * c.ink) as u8, 0, 255);
        let stroke = Stroke {
            width: c.width,
            line_cap: LineCap::Round,
            line_join: LineJoin::Round,
            ..Stroke::default()
        };
        target.stroke_path(&path, &paint, &stroke, transform, None);
    }
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    let output = std::env::args().nth(1).ok_or("output directory required")?;
    let output = Path::new(&output);
    std::fs::create_dir_all(output)?;
    let mut sheet = Pixmap::new(1280, 1080).ok_or("image allocation failed")?;
    sheet.fill(Color::BLACK);
    draw(
        &mut sheet,
        study::Pose::Stand,
        Transform::from_row(1.45, 0., 0., 1.45, 85., 25.),
    )?;
    draw(
        &mut sheet,
        study::Pose::Step,
        Transform::from_row(1.45, 0., 0., 1.45, 600., 25.),
    )?;
    sheet.save_png(output.join("heroine-study.png"))?;
    for (name, pose) in [
        ("heroine-standing", study::Pose::Stand),
        ("heroine-stepping", study::Pose::Step),
    ] {
        std::fs::write(output.join(format!("{name}.svg")), study::svg(pose))?;
        let mut png = Pixmap::new(700, 1340).ok_or("image allocation failed")?;
        draw(&mut png, pose, Transform::from_scale(2., 2.))?;
        png.save_png(output.join(format!("{name}.png")))?;
    }
    println!("Character study: {}", output.display());
    Ok(())
}
