//! Writes the resting role marks for the native app:
//! `cargo run --example stills` (from anywhere; the path is the repo's).
use std::path::Path;

fn main() -> std::io::Result<()> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let path = root.join(watcher_role_marks::NATIVE_MODULE);
    std::fs::write(&path, watcher_role_marks::native_module())?;
    println!("Wrote {}", watcher_role_marks::NATIVE_MODULE);
    Ok(())
}
