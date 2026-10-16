use std::{env, fs, path::PathBuf};

fn main() {
    let directory = PathBuf::from(env::args().nth(1).expect("shader directory"));
    for name in ["glass", "blur"] {
        let source = fs::read_to_string(directory.join(format!("{name}.frag"))).unwrap();
        let module = naga::front::glsl::Frontend::default()
            .parse(&naga::front::glsl::Options::from(naga::ShaderStage::Fragment), &source)
            .unwrap_or_else(|error| panic!("{name}: {}", error.emit_to_string(&source)));
        let info = naga::valid::Validator::new(naga::valid::ValidationFlags::all(), naga::valid::Capabilities::all())
            .validate(&module).unwrap_or_else(|error| panic!("{name}: {error:?}"));
        let wgsl = naga::back::wgsl::write_string(&module, &info, naga::back::wgsl::WriterFlags::EXPLICIT_TYPES).unwrap();
        fs::write(directory.join(format!("{name}.wgsl")), wgsl).unwrap();
        println!("Validated {name}: GLSL -> WGSL");
    }
    let source=fs::read_to_string(directory.join("scene.wgsl")).unwrap();
    let module=naga::front::wgsl::parse_str(&source).unwrap_or_else(|e|panic!("{}",e.emit_to_string(&source)));
    naga::valid::Validator::new(naga::valid::ValidationFlags::all(),naga::valid::Capabilities::all())
        .validate(&module).unwrap_or_else(|e|panic!("scene: {}",e.emit_to_string(&source)));
    println!("Validated full-scene WGSL");
}
