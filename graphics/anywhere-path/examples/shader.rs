//! Writes the scene's fragment shader as the browser links it:
//! `cargo run --example shader -- <out.frag>`.
fn main() {
    let out = std::env::args().nth(1).expect("usage: shader <out.frag>");
    std::fs::write(&out, watcher_anywhere_path::shader::source()).expect("write the shader");
    let vert = format!("{out}.vert");
    std::fs::write(&vert, watcher_anywhere_path::shader::SCREEN).expect("write the vertex shader");
}
