//! Browser adapter: WebGL2 objects and the draw. Every motion value comes
//! from `compose` and every color from `look`; the shader recolors Art's
//! layers and adds the cold and warm light on top. The constants of lib.rs
//! reach the shader as `#define`s, so both read one source.
use crate::{
    compose, geometry, look, spike_uniforms, window, Look, AXIS, BUBBLES, CLOSE_METRES, CROWN,
    DEPTH_MAX, DISTANCE, EYE, FEET, FOCAL, HEAD_X, HORIZON, LOOP_SECONDS, MOTES, PATCH_DEPTH,
    PATCH_REACH, PIVOT, SIZE, STILL, WORDS_DISC,
};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Warm;
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlProgram, WebGlShader,
    WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const SCREEN: &str = include_str!("shaders/screen.vert");
const SCENE: &str = include_str!("shaders/scene.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.09, 0.09, 0.12, 0.15];
/// The layers' texture units, in the constructor's order.
const SAMPLERS: [&str; 5] = ["u_noise", "u_quiet", "u_figure", "u_depth", "u_terrain"];
const NAMES: [&str; 24] = [
    "u_res",
    "u_window",
    "u_px",
    "u_out",
    "u_backdrop",
    "u_edges",
    "u_mode",
    "u_paper",
    "u_accent",
    "u_highlight",
    "u_cold",
    "u_warm",
    "u_pale",
    "u_cam",
    "u_land",
    "u_ring[0]",
    "u_fx[0]",
    "u_spike[0]",
    "u_geo[0]",
    "u_noise",
    "u_quiet",
    "u_figure",
    "u_depth",
    "u_terrain",
];

fn float(x: f32) -> String {
    // Debug always writes a decimal point or an exponent: a GLSL float.
    format!("{x:?}")
}
fn vec(values: &[f32]) -> String {
    let parts: Vec<String> = values.iter().map(|v| float(*v)).collect();
    format!("vec{}({})", values.len(), parts.join(", "))
}
/// lib.rs constants as the shader's `#define`s.
fn defines() -> String {
    let mut lines = vec![
        ("SIZE", vec(&SIZE)),
        ("PIVOT", vec(&PIVOT)),
        ("HORIZON", float(HORIZON)),
        ("AXIS", float(AXIS)),
        ("FOCAL", float(FOCAL)),
        ("EYE", float(EYE)),
        ("DISTANCE", float(DISTANCE)),
        ("FEET", float(FEET)),
        ("CROWN", float(CROWN)),
        ("HEAD_X", float(HEAD_X)),
        ("DEPTH_MAX", float(DEPTH_MAX)),
        ("CLOSE_METRES", float(CLOSE_METRES)),
        ("PATCH_REACH", float(PATCH_REACH)),
        ("PATCH_DEPTH", float(PATCH_DEPTH)),
        ("MOTES", MOTES.to_string()),
        ("WORDS_DISC", vec(&WORDS_DISC)),
    ];
    for (i, b) in BUBBLES.iter().enumerate() {
        lines.push((["BUBBLE0", "BUBBLE1", "BUBBLE2"][i], vec(b)));
    }
    lines
        .iter()
        .map(|(name, value)| format!("#define {name} {value}\n"))
        .collect()
}
fn source() -> String {
    format!("#version 300 es\n{}{SCENE}", defines())
}

fn shader(gl: &Gl, kind: u32, source: &str) -> Result<WebGlShader, JsValue> {
    let s = gl.create_shader(kind).ok_or("Cannot allocate shader")?;
    gl.shader_source(&s, source);
    gl.compile_shader(&s);
    if !gl
        .get_shader_parameter(&s, Gl::COMPILE_STATUS)
        .as_bool()
        .unwrap_or(false)
    {
        let log = gl.get_shader_info_log(&s).unwrap_or_default();
        gl.delete_shader(Some(&s));
        return Err(log.into());
    }
    Ok(s)
}
fn program(gl: &Gl, vertex: &str, frag: &str) -> Result<WebGlProgram, JsValue> {
    let v = shader(gl, Gl::VERTEX_SHADER, vertex)?;
    let f = shader(gl, Gl::FRAGMENT_SHADER, frag)?;
    let p = gl.create_program().ok_or("Cannot allocate program")?;
    gl.attach_shader(&p, &v);
    gl.attach_shader(&p, &f);
    gl.link_program(&p);
    gl.delete_shader(Some(&v));
    gl.delete_shader(Some(&f));
    if !gl
        .get_program_parameter(&p, Gl::LINK_STATUS)
        .as_bool()
        .unwrap_or(false)
    {
        let log = gl.get_program_info_log(&p).unwrap_or_default();
        gl.delete_program(Some(&p));
        return Err(log.into());
    }
    Ok(p)
}

/// One layer on its own texture unit. The painted layers get mipmaps: their
/// fine strings shimmer under the drift unless filtered, and the shader reads
/// a coarse level as the local average.
fn texture(
    gl: &Gl,
    slot: u32,
    image: &HtmlImageElement,
    size: [u32; 2],
    mipmaps: bool,
) -> Result<WebGlTexture, JsValue> {
    if image.natural_width() != size[0] || image.natural_height() != size[1] {
        return Err("The layers must be 1536 × 1024 and the depth map 768 × 512".into());
    }
    let t = gl.create_texture().ok_or("Cannot allocate texture")?;
    gl.active_texture(Gl::TEXTURE0 + slot);
    gl.bind_texture(Gl::TEXTURE_2D, Some(&t));
    let min = if mipmaps {
        Gl::LINEAR_MIPMAP_LINEAR
    } else {
        Gl::LINEAR
    };
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MIN_FILTER, min as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MAG_FILTER, Gl::LINEAR as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE as i32);
    // His cut-out keeps straight alpha; the shader mixes him over the land.
    gl.pixel_storei(Gl::UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    // The depth map's channels are data, not color: no conversion on upload.
    gl.pixel_storei(Gl::UNPACK_COLORSPACE_CONVERSION_WEBGL, Gl::NONE as i32);
    gl.tex_image_2d_with_u32_and_u32_and_html_image_element(
        Gl::TEXTURE_2D,
        0,
        Gl::RGBA as i32,
        Gl::RGBA,
        Gl::UNSIGNED_BYTE,
        image,
    )?;
    if mipmaps {
        gl.generate_mipmap(Gl::TEXTURE_2D);
    }
    Ok(t)
}

fn context(canvas: &HtmlCanvasElement) -> Result<Gl, JsValue> {
    let options = js_sys::Object::new();
    js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
    js_sys::Reflect::set(&options, &"antialias".into(), &false.into())?;
    js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &false.into())?;
    Ok(canvas
        .get_context_with_context_options("webgl2", &options)?
        .ok_or("WebGL2 unavailable")?
        .dyn_into()?)
}

/// Links the scene's program in the background on the canvas's own context,
/// so the constructor's link comes from the browser's program cache instead of
/// freezing the page (scene-palette `warm.rs`). Drop it after the scene is built.
#[wasm_bindgen]
pub fn warm(canvas: &HtmlCanvasElement) -> Result<Warm, JsValue> {
    let programs = [(SCREEN.to_string(), source())];
    Ok(Warm::start(&context(canvas)?, &programs))
}

#[wasm_bindgen]
pub struct InnerQuiet {
    gl: Gl,
    canvas: HtmlCanvasElement,
    program: WebGlProgram,
    uniforms: Vec<Option<WebGlUniformLocation>>,
    textures: Vec<WebGlTexture>,
    screen: WebGlVertexArrayObject,
    geometry: [f32; 60],
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
impl InnerQuiet {
    /// Art's «Струны» in layers: the land of noise, the quiet land, him, the
    /// depth map and the land behind the spikes.
    #[wasm_bindgen(constructor)]
    pub fn new(
        canvas: HtmlCanvasElement,
        noise: HtmlImageElement,
        quiet: HtmlImageElement,
        figure: HtmlImageElement,
        depth: HtmlImageElement,
        terrain: HtmlImageElement,
    ) -> Result<InnerQuiet, JsValue> {
        let gl: Gl = context(&canvas)?;
        let program = program(&gl, SCREEN, &source())?;
        let uniforms = NAMES
            .iter()
            .map(|name| gl.get_uniform_location(&program, name))
            .collect();
        let full = [SIZE[0] as u32, SIZE[1] as u32];
        let textures = vec![
            texture(&gl, 0, &noise, full, true)?,
            texture(&gl, 1, &quiet, full, true)?,
            texture(&gl, 2, &figure, full, true)?,
            texture(&gl, 3, &depth, [full[0] / 2, full[1] / 2], false)?,
            texture(&gl, 4, &terrain, full, true)?,
        ];
        let screen = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        let scene = Self {
            gl,
            canvas,
            program,
            uniforms,
            textures,
            screen,
            geometry: geometry(),
            look: look(2),
            soft_edges: false,
            backdrop: look(2).paper,
            elapsed: 0.0,
            last_time: None,
            paused: false,
            reduced: false,
            disposed: false,
            frames: 0,
        };
        scene.gl.use_program(Some(&scene.program));
        for (slot, name) in SAMPLERS.iter().enumerate() {
            scene.gl.uniform1i(scene.at(name), slot as i32);
        }
        Ok(scene)
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
    /// Reduced motion holds one moment: the noise up, the five spikes with
    /// their signs, words writing themselves into the cloud.
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
        for t in &self.textures {
            gl.delete_texture(Some(t));
        }
        gl.delete_vertex_array(Some(&self.screen));
        gl.delete_program(Some(&self.program));
        self.disposed = true;
    }
}

impl InnerQuiet {
    fn at(&self, name: &str) -> Option<&WebGlUniformLocation> {
        NAMES
            .iter()
            .position(|n| *n == name)
            .and_then(|i| self.uniforms[i].as_ref())
    }
    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        let f = compose(if self.reduced { STILL } else { self.elapsed });
        let view = window(width as f32, height as f32);
        let l = self.look;
        let gl = &self.gl;
        gl.viewport(0, 0, width, height);
        gl.disable(Gl::BLEND);
        gl.use_program(Some(&self.program));
        gl.bind_vertex_array(Some(&self.screen));
        for (slot, t) in self.textures.iter().enumerate() {
            gl.active_texture(Gl::TEXTURE0 + slot as u32);
            gl.bind_texture(Gl::TEXTURE_2D, Some(t));
        }
        gl.uniform2f(self.at("u_res"), width as f32, height as f32);
        gl.uniform4fv_with_f32_array(self.at("u_window"), &view);
        // Painting px per canvas px: thin lines never get thinner than a pixel.
        gl.uniform1f(self.at("u_px"), view[2] / width.max(1) as f32);
        gl.uniform4f(self.at("u_out"), f32::from(self.soft_edges), 0.0, 0.0, 0.0);
        gl.uniform3fv_with_f32_array(self.at("u_backdrop"), &self.backdrop);
        gl.uniform4fv_with_f32_array(self.at("u_edges"), &EDGES);
        gl.uniform1f(self.at("u_mode"), l.mode);
        gl.uniform3fv_with_f32_array(self.at("u_paper"), &l.paper);
        gl.uniform3fv_with_f32_array(self.at("u_accent"), &l.accent);
        gl.uniform3fv_with_f32_array(self.at("u_highlight"), &l.highlight);
        gl.uniform3fv_with_f32_array(self.at("u_cold"), &l.cold);
        gl.uniform3fv_with_f32_array(self.at("u_warm"), &l.warm);
        gl.uniform3fv_with_f32_array(self.at("u_pale"), &l.pale);
        gl.uniform4fv_with_f32_array(self.at("u_cam"), &f.cam);
        gl.uniform4fv_with_f32_array(self.at("u_land"), &f.land);
        gl.uniform4fv_with_f32_array(self.at("u_ring[0]"), f.rings.as_flattened());
        gl.uniform4fv_with_f32_array(self.at("u_fx[0]"), f.fx.as_flattened());
        gl.uniform4fv_with_f32_array(self.at("u_spike[0]"), &spike_uniforms(&f));
        gl.uniform4fv_with_f32_array(self.at("u_geo[0]"), &self.geometry);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
