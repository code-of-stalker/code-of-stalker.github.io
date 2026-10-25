fn main() {
    let output = std::env::args().nth(1).expect("output PNG");
    watcher_graphics::voice_presence::portrait_matte()
        .save_png(output)
        .unwrap();
}
