//! A scene's shader programs, linked in the background before the scene is built.
//!
//! Chrome on Windows links WebGL programs through ANGLE on D3D11, where FXC
//! compiles each shader. The first `LINK_STATUS` query (or uniform lookup, or
//! draw) waits on the page's main thread until FXC is done: on a cold shader
//! cache one scene froze the page for 19 s. With `KHR_parallel_shader_compile`
//! the link runs on the browser's worker threads and `COMPLETION_STATUS` says,
//! without waiting, when it has finished.
//!
//! [`Warm::start`] links every program a scene is about to link, on the scene's
//! own context; [`Warm::done`] polls them. Once all are complete it resolves
//! them (`LINK_STATUS`, now instant), which stores each linked binary in the
//! browser's program cache. The scene's constructor then links the same sources
//! as before and gets every program from that cache in milliseconds: the scene,
//! its programs and every frame it draws stay exactly what they were.
//!
//! The warm programs live until the `Warm` is dropped, after the scene is
//! built: deleting them just before the real link made that link slow again in
//! measurements (580 ms against 14 ms). Without the extension nothing is
//! started and the scene links synchronously, as it always did.
use wasm_bindgen::prelude::*;
use web_sys::{WebGl2RenderingContext as Gl, WebGlProgram};

/// `COMPLETION_STATUS_KHR` from `KHR_parallel_shader_compile`.
const COMPLETION_STATUS: u32 = 0x91B1;

#[wasm_bindgen]
pub struct Warm {
    gl: Gl,
    programs: Vec<WebGlProgram>,
    resolved: bool,
}

/// Compiles and links one program without asking how it went: any question
/// would wait for the compiler. Failures surface in the scene's own link.
fn link(gl: &Gl, vertex: &str, fragment: &str) -> Option<WebGlProgram> {
    let program = gl.create_program()?;
    for (kind, source) in [(Gl::VERTEX_SHADER, vertex), (Gl::FRAGMENT_SHADER, fragment)] {
        let shader = gl.create_shader(kind)?;
        gl.shader_source(&shader, source);
        gl.compile_shader(&shader);
        gl.attach_shader(&program, &shader);
        gl.delete_shader(Some(&shader));
    }
    gl.link_program(&program);
    Some(program)
}

impl Warm {
    /// Starts linking every `(vertex, fragment)` pair on `gl`, the context the
    /// scene will draw with.
    pub fn start<V: AsRef<str>, F: AsRef<str>>(gl: &Gl, pairs: &[(V, F)]) -> Self {
        let parallel = gl
            .get_extension("KHR_parallel_shader_compile")
            .ok()
            .flatten()
            .is_some();
        let programs = if parallel {
            pairs
                .iter()
                .filter_map(|(vertex, fragment)| link(gl, vertex.as_ref(), fragment.as_ref()))
                .collect()
        } else {
            Vec::new()
        };
        Self {
            gl: gl.clone(),
            programs,
            resolved: false,
        }
    }
}

#[wasm_bindgen]
impl Warm {
    /// True once every program has finished linking. Never waits.
    pub fn done(&mut self) -> bool {
        if self.resolved {
            return true;
        }
        // A lost context answers null: nothing left to wait for.
        let complete = self.programs.iter().all(|program| {
            self.gl
                .get_program_parameter(program, COMPLETION_STATUS)
                .as_bool()
                .unwrap_or(true)
        });
        if complete {
            for program in &self.programs {
                let _ = self.gl.get_program_parameter(program, Gl::LINK_STATUS);
            }
            self.resolved = true;
        }
        complete
    }
}

impl Drop for Warm {
    fn drop(&mut self) {
        for program in &self.programs {
            self.gl.delete_program(Some(program));
        }
    }
}
