//! Writes the scene's shaders as the browser links them:
//! `cargo run --example shader -- <out-dir>` (world.frag, dof.frag,
//! finish.frag, screen.vert).
use watcher_anywhere_path::shader;

fn main() {
    let out = std::env::args().nth(1).expect("usage: shader <out-dir>");
    let dir = std::path::Path::new(&out);
    std::fs::create_dir_all(dir).expect("make the folder");
    for (name, text) in [
        ("world.frag", shader::source()),
        ("dof.frag", shader::dof_source()),
        ("finish.frag", shader::finish_source()),
        ("screen.vert", shader::SCREEN.to_string()),
    ] {
        std::fs::write(dir.join(name), text).expect("write the shader");
    }
}
