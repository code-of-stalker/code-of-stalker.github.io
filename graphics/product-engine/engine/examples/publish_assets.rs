//! Publishes the engine's external inputs (assets/external.txt) for the web build:
//! cargo run -p watcher-graphics --example publish_assets -- public/graphics/pkg/assets
fn main() {
    let folder = std::env::args().nth(1).expect("output folder");
    watcher_graphics::asset_store::publish(std::path::Path::new(&folder)).unwrap();
}
