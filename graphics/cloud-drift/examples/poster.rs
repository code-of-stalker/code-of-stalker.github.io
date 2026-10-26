//! Raster fallback uses the same Rust-authored edge coverage as the live scene.
use std::{error::Error, path::PathBuf};
use tiny_skia::{Pixmap, PremultipliedColorU8};
use watcher_cloud_drift::edge_coverage;

fn main() -> Result<(), Box<dyn Error>> {
    let assets = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets");
    let mut image = Pixmap::load_png(assets.join("original.png"))?;
    let width = image.width() as usize;
    let height = image.height() as usize;
    for (index, pixel) in image.pixels_mut().iter_mut().enumerate() {
        let coverage = edge_coverage(
            (index % width) as f32 / (width - 1) as f32,
            (index / width) as f32 / (height - 1) as f32,
        );
        let scale = |channel: u8| (f32::from(channel) * coverage).round() as u8;
        *pixel = PremultipliedColorU8::from_rgba(
            scale(pixel.red()),
            scale(pixel.green()),
            scale(pixel.blue()),
            scale(pixel.alpha()),
        )
        .ok_or("Invalid poster alpha")?;
    }
    image.save_png(assets.join("poster.png"))?;
    Ok(())
}
