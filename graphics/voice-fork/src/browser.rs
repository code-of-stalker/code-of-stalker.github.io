//! Browser adapter: one WebGL2 program, one texture (the woman). Every
//! motion value comes from `compose` and lib.rs's timing constants, every
//! colour from `look`; the shader draws the code, its dust and its writing
//! round her raster, and opens her mouth. The program links in the
//! background where the GPU allows it (KHR_parallel_shader_compile), so the
//! page keeps running while Windows' shader compiler works (`ready`).
use crate::{
    compose, look, Look, ATTACK, BREAK_AT, DEPTH, DUST_SECONDS, FIRST_CREST, GRAINY, HUM,
    HUM_SECONDS, LAYERS, LOOP_SECONDS, MELT_SECONDS, MOUTH, MOUTH_BOX, MOUTH_SHIFT, RELEASE, SIZE,
    SOUND_SPEED, STILL, VOICE_DIR, WAVE_PERIOD, WRITE_AT, WRITE_SPEED, WRITE_SPREAD,
};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlProgram, WebGlShader,
    WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const SCREEN: &str = include_str!("shaders/screen.vert");
const SCENE: &str = include_str!("shaders/scene.frag");
/// KHR_parallel_shader_compile's query: whether a program has linked yet.
const COMPLETION_STATUS: u32 = 0x91B1;
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.0, 0.08, 0.1, 0.12];
/// The Тишина page, until the app says which page it is.
const PAGE: [f32; 3] = [13.0 / 255.0, 21.0 / 255.0, 32.0 / 255.0];
const NAMES: [&str; 10] = [
    "u_res",
    "u_hum",
    "u_say",
    "u_cold",
    "u_warm",
    "u_pale",
    "u_backdrop",
    "u_edges",
    "u_out",
    "u_fig",
];

/// lib.rs's constants as the shader's `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let v2 = |v: [f32; 2]| format!("vec2({:?}, {:?})", v[0], v[1]);
    let v4 = |v: [f32; 4]| format!("vec4({:?}, {:?}, {:?}, {:?})", v[0], v[1], v[2], v[3]);
    [
        ("LOOP_SECONDS", f(LOOP_SECONDS)),
        ("MOUTH", v2(MOUTH)),
        ("MOUTH_BOX", v4(MOUTH_BOX)),
        ("MOUTH_SHIFT", f(MOUTH_SHIFT)),
        ("SOUND_SPEED", f(SOUND_SPEED)),
        ("HUM", f(HUM)),
        ("HUM_SECONDS", f(HUM_SECONDS)),
        ("ATTACK", f(ATTACK)),
        ("RELEASE", f(RELEASE)),
        ("WAVE_PERIOD", f(WAVE_PERIOD)),
        ("VOICE_DIR", v2(VOICE_DIR)),
        ("LAYERS", LAYERS.to_string()),
        ("DEPTHS", DEPTH.map(f).join(", ")),
        ("GRAIN_FIRST", GRAINY[0].to_string()),
        ("GRAIN_LAST", GRAINY[1].to_string()),
        ("BREAK_AT", f(BREAK_AT)),
        ("FIRST_CREST", f(FIRST_CREST)),
        ("DUST_SECONDS", f(DUST_SECONDS)),
        ("MELT_SECONDS", f(MELT_SECONDS)),
        ("WRITE_AT", f(WRITE_AT)),
        ("WRITE_SPREAD", f(WRITE_SPREAD)),
        ("WRITE_SPEED", v2(WRITE_SPEED)),
    ]
    .iter()
    .map(|(name, value)| format!("#define {name} {value}\n"))
    .collect()
}

/// Hands the GPU a shader to compile; whether it compiled is asked once its
/// program has linked.
fn shader(gl: &Gl, kind: u32, source: &str) -> Result<WebGlShader, JsValue> {
    let s = gl.create_shader(kind).ok_or("Cannot allocate shader")?;
    gl.shader_source(&s, source);
    gl.compile_shader(&s);
    Ok(s)
}

/// Why a shader step failed, never blank: when the GPU drops the context
/// mid-link the driver leaves no log at all.
fn failure(gl: &Gl, step: &str, log: &str) -> String {
    let log = log.trim();
    if !log.is_empty() {
        format!("{step} failed: {log}")
    } else if gl.is_context_lost() {
        format!("{step} failed: the GPU dropped the WebGL context")
    } else {
        format!("{step} failed without a log")
    }
}

/// The program while the GPU may still be compiling and linking it.
struct Linking {
    program: WebGlProgram,
    shaders: [WebGlShader; 2],
}

impl Linking {
    fn start(gl: &Gl) -> Result<Self, JsValue> {
        let shaders = [
            shader(gl, Gl::VERTEX_SHADER, SCREEN)?,
            shader(
                gl,
                Gl::FRAGMENT_SHADER,
                &format!("#version 300 es\n{}{SCENE}", defines()),
            )?,
        ];
        let program = gl.create_program().ok_or("Cannot allocate program")?;
        for s in &shaders {
            gl.attach_shader(&program, s);
        }
        gl.link_program(&program);
        Ok(Self { program, shaders })
    }
    /// Whether asking about the link would not wait: always without
    /// KHR_parallel_shader_compile, where asking simply waits.
    fn done(&self, gl: &Gl, parallel: bool) -> bool {
        !parallel
            || gl
                .get_program_parameter(&self.program, COMPLETION_STATUS)
                .as_bool()
                .unwrap_or(true)
    }
    /// The linked program, or why it failed, from the shader's log when one
    /// did not compile.
    fn finish(self, gl: &Gl) -> Result<WebGlProgram, String> {
        let linked = gl
            .get_program_parameter(&self.program, Gl::LINK_STATUS)
            .as_bool()
            .unwrap_or(false);
        let error = (!linked).then(|| {
            let compile = self.shaders.iter().find_map(|s| {
                let ok = gl
                    .get_shader_parameter(s, Gl::COMPILE_STATUS)
                    .as_bool()
                    .unwrap_or(false);
                (!ok).then(|| gl.get_shader_info_log(s).unwrap_or_default())
            });
            match compile {
                Some(log) => failure(gl, "shader compile", &log),
                None => failure(
                    gl,
                    "shader link",
                    &gl.get_program_info_log(&self.program).unwrap_or_default(),
                ),
            }
        });
        for s in &self.shaders {
            gl.delete_shader(Some(s));
        }
        if let Some(error) = error {
            gl.delete_program(Some(&self.program));
            return Err(error);
        }
        Ok(self.program)
    }
    fn dispose(self, gl: &Gl) {
        for s in &self.shaders {
            gl.delete_shader(Some(s));
        }
        gl.delete_program(Some(&self.program));
    }
}

#[wasm_bindgen]
pub struct VoiceFork {
    gl: Gl,
    canvas: HtmlCanvasElement,
    /// The program once it has linked, and its uniforms.
    program: Option<WebGlProgram>,
    uniforms: Vec<Option<WebGlUniformLocation>>,
    linking: Option<Linking>,
    parallel: bool,
    failed: Option<String>,
    figure: WebGlTexture,
    screen: WebGlVertexArrayObject,
    look: Look,
    soft_edges: bool,
    backdrop: [f32; 3],
    elapsed: f32,
    last_time: Option<f64>,
    paused: bool,
    reduced: bool,
    disposed: bool,
    frames: u32,
}

#[wasm_bindgen]
impl VoiceFork {
    /// `figure`: assets/figure.webp (R her light, G her silhouette, B her mouth half open and open).
    /// The program links in the background; `ready` says when the scene can
    /// draw, and frames before that draw nothing.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement, figure: HtmlImageElement) -> Result<VoiceFork, JsValue> {
        if figure.natural_width() != SIZE[0] as u32 || figure.natural_height() != SIZE[1] as u32 {
            return Err("The figure must be 1536 × 1024".into());
        }
        let options = js_sys::Object::new();
        js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"antialias".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &false.into())?;
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 unavailable")?
            .dyn_into()?;
        let parallel = gl
            .get_extension("KHR_parallel_shader_compile")
            .ok()
            .flatten()
            .is_some();
        let linking = Linking::start(&gl)?;
        let t = gl.create_texture().ok_or("Cannot allocate texture")?;
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&t));
        gl.tex_parameteri(
            Gl::TEXTURE_2D,
            Gl::TEXTURE_MIN_FILTER,
            Gl::LINEAR_MIPMAP_LINEAR as i32,
        );
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MAG_FILTER, Gl::LINEAR as i32);
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE as i32);
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE as i32);
        gl.pixel_storei(Gl::UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
        // The channels are data (light, silhouette), not colour.
        gl.pixel_storei(Gl::UNPACK_COLORSPACE_CONVERSION_WEBGL, Gl::NONE as i32);
        gl.tex_image_2d_with_u32_and_u32_and_html_image_element(
            Gl::TEXTURE_2D,
            0,
            Gl::RGBA as i32,
            Gl::RGBA,
            Gl::UNSIGNED_BYTE,
            &figure,
        )?;
        gl.generate_mipmap(Gl::TEXTURE_2D);
        let screen = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        Ok(Self {
            gl,
            canvas,
            program: None,
            uniforms: Vec::new(),
            linking: Some(linking),
            parallel,
            failed: None,
            figure: t,
            screen,
            look: look(2),
            soft_edges: false,
            backdrop: PAGE,
            elapsed: 0.0,
            last_time: None,
            paused: false,
            reduced: false,
            disposed: false,
            frames: 0,
        })
    }
    /// Whether the program has linked and the scene draws; it never waits
    /// where the GPU can say. An error says why it did not link.
    pub fn ready(&mut self) -> Result<bool, JsValue> {
        let was = self.program.is_some();
        let now = self.poll().map_err(|e| JsValue::from_str(&e))?;
        if now && !was {
            self.draw();
        }
        Ok(now)
    }
    pub fn resize(&mut self, width: u32, height: u32) {
        let width = width.clamp(2, 3072);
        let height = height.clamp(2, 2048);
        if self.canvas.width() != width || self.canvas.height() != height {
            self.canvas.set_width(width);
            self.canvas.set_height(height);
        }
        self.draw();
    }
    pub fn frame(&mut self, milliseconds: f64) {
        if !milliseconds.is_finite() {
            return;
        }
        if !self.paused && !self.reduced {
            if let Some(previous) = self.last_time {
                let dt = ((milliseconds - previous) / 1000.0).clamp(0.0, 0.1) as f32;
                self.elapsed = (self.elapsed + dt).rem_euclid(LOOP_SECONDS);
            }
        }
        self.last_time = Some(milliseconds);
        self.draw();
    }
    pub fn seek(&mut self, seconds: f64) {
        self.elapsed = if seconds.is_finite() {
            (seconds as f32).rem_euclid(LOOP_SECONDS)
        } else {
            0.0
        };
        self.last_time = None;
        self.draw();
    }
    pub fn elapsed(&self) -> f64 {
        f64::from(self.elapsed)
    }
    pub fn suspend(&mut self) {
        self.last_time = None;
    }
    pub fn pause(&mut self, value: bool) {
        self.paused = value;
        self.last_time = None;
    }
    /// Reduced motion holds one moment: the voice halfway across the frame.
    pub fn reduced(&mut self, value: bool) {
        self.reduced = value;
        self.last_time = None;
        self.draw();
    }
    /// Melt the scene into the surrounding page instead of a hard frame.
    pub fn soft_edges(&mut self, enabled: bool) {
        if self.soft_edges != enabled {
            self.soft_edges = enabled;
            self.draw();
        }
    }
    pub fn backdrop(&mut self, red: f32, green: f32, blue: f32) {
        if ![red, green, blue].iter().all(|value| value.is_finite()) {
            return;
        }
        let color = [red, green, blue].map(|value| value.clamp(0.0, 1.0));
        if self.backdrop != color {
            self.backdrop = color;
            self.draw();
        }
    }
    /// The app theme by its `graphicsPalette` code (0 Искра, 2 Тишина,
    /// 3 Астрал, 4 Матрица; any other shows Тишина).
    pub fn palette(&mut self, code: u32) {
        let next = look(code);
        if self.look != next {
            self.look = next;
            self.draw();
        }
    }
    pub fn frame_count(&self) -> u32 {
        self.frames
    }
    pub fn gpu_error(&self) -> u32 {
        self.gl.get_error()
    }
    pub fn dispose(&mut self) {
        if self.disposed {
            return;
        }
        let gl = &self.gl;
        gl.delete_texture(Some(&self.figure));
        gl.delete_vertex_array(Some(&self.screen));
        if let Some(p) = self.program.take() {
            gl.delete_program(Some(&p));
        }
        if let Some(l) = self.linking.take() {
            l.dispose(gl);
        }
        self.disposed = true;
    }
}

impl VoiceFork {
    fn at(&self, name: &str) -> Option<&WebGlUniformLocation> {
        NAMES
            .iter()
            .position(|n| *n == name)
            .and_then(|i| self.uniforms.get(i))
            .and_then(Option::as_ref)
    }
    /// Takes the program once the GPU has linked it; true when it draws.
    fn poll(&mut self) -> Result<bool, String> {
        if self.program.is_some() {
            return Ok(true);
        }
        if let Some(error) = &self.failed {
            return Err(error.clone());
        }
        let gl = &self.gl;
        let waiting = match &self.linking {
            Some(l) => gl.is_context_lost() || !l.done(gl, self.parallel),
            None => true,
        };
        if waiting {
            return Ok(false);
        }
        let Some(linking) = self.linking.take() else {
            return Ok(false);
        };
        match linking.finish(gl) {
            Ok(program) => {
                self.uniforms = NAMES
                    .iter()
                    .map(|name| gl.get_uniform_location(&program, name))
                    .collect();
                gl.use_program(Some(&program));
                self.program = Some(program);
                gl.uniform1i(self.at("u_fig"), 0);
                Ok(true)
            }
            Err(e) => {
                self.failed = Some(e.clone());
                Err(e)
            }
        }
    }
    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() || !matches!(self.poll(), Ok(true)) {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        let f = compose(if self.reduced { STILL } else { self.elapsed });
        let l = self.look;
        let gl = &self.gl;
        gl.viewport(0, 0, width, height);
        gl.disable(Gl::BLEND);
        gl.use_program(self.program.as_ref());
        gl.bind_vertex_array(Some(&self.screen));
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&self.figure));
        gl.uniform2f(self.at("u_res"), width as f32, height as f32);
        gl.uniform4f(self.at("u_hum"), f.hum, 0.0, 0.0, f.time);
        gl.uniform4f(self.at("u_say"), f.mouth, f.lips, f.breath, 0.0);
        gl.uniform3fv_with_f32_array(self.at("u_cold"), &l.cold);
        gl.uniform3fv_with_f32_array(self.at("u_warm"), &l.warm);
        gl.uniform3fv_with_f32_array(self.at("u_pale"), &l.pale);
        gl.uniform3fv_with_f32_array(self.at("u_backdrop"), &self.backdrop);
        gl.uniform4fv_with_f32_array(self.at("u_edges"), &EDGES);
        gl.uniform4f(self.at("u_out"), f32::from(self.soft_edges), 0.0, 0.0, 0.0);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
