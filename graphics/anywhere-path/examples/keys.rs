//! Prints the story's key times: `cargo run --release --example keys`.
fn main() {
    let scene = watcher_anywhere_path::Scene::new();
    println!("{:#?}", scene.story.keys);
}
