//! Browser adapter: one WebGL2 program, one texture (the woman). Every
//! motion value comes from `compose` and every colour from `look`; the
//! shader draws the code, the channel and the voice round her raster.
use crate::{
    compose, look, Look, AXIS_Y, LOOP_SECONDS, MOUTH, OPEN, PULSES, REACH, RISE, SIZE, SPAN, STILL,
};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlProgram, WebGlShader,
    WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const SCREEN: &str = include_str!("shaders/screen.vert");
const SCENE: &str = include_str!("shaders/scene.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.0, 0.08, 0.1, 0.12];
/// The Тишина page, until the app says which page it is.
const PAGE: [f32; 3] = [13.0 / 255.0, 21.0 / 255.0, 32.0 / 255.0];
const NAMES: [&str; 13] = [
    "u_res",
    "u_hum",
    "u_chan",
    "u_lips",
    "u_pulse[0]",
    "u_cold",
    "u_warm",
    "u_pale",
    "u_backdrop",
    "u_edges",
    "u_out",
    "u_fig",
    "u_unused",
];

/// lib.rs's constants as the shader's `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let v2 = |v: [f32; 2]| format!("vec2({:?}, {:?})", v[0], v[1]);
    [
        ("LOOP_SECONDS", f(LOOP_SECONDS)),
        ("MOUTH", v2(MOUTH)),
        ("AXIS_Y", f(AXIS_Y)),
        ("RISE", f(RISE)),
        ("REACH", v2(REACH)),
        ("OPEN_MAX", f(OPEN[1])),
        ("SPAN", f(SPAN)),
        ("PULSES", PULSES.to_string()),
    ]
    .iter()
    .map(|(name, value)| format!("#define {name} {value}\n"))
    .collect()
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
fn program(gl: &Gl) -> Result<WebGlProgram, JsValue> {
    let v = shader(gl, Gl::VERTEX_SHADER, SCREEN)?;
    let f = shader(
        gl,
        Gl::FRAGMENT_SHADER,
        &format!("#version 300 es\n{}{SCENE}", defines()),
    )?;
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

#[wasm_bindgen]
pub struct VoiceFork {
    gl: Gl,
    canvas: HtmlCanvasElement,
    program: WebGlProgram,
    uniforms: Vec<Option<WebGlUniformLocation>>,
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
    /// `figure`: assets/figure.webp (R her light, G her silhouette).
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
        let program = program(&gl)?;
        let uniforms = NAMES
            .iter()
            .map(|name| gl.get_uniform_location(&program, name))
            .collect();
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
        let fork = Self {
            gl,
            canvas,
            program,
            uniforms,
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
        };
        fork.gl.use_program(Some(&fork.program));
        fork.gl.uniform1i(fork.at("u_fig"), 0);
        Ok(fork)
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
    /// Reduced motion holds one moment: the first hum at full voice.
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
        gl.delete_program(Some(&self.program));
        self.disposed = true;
    }
}

impl VoiceFork {
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
        let l = self.look;
        let gl = &self.gl;
        gl.viewport(0, 0, width, height);
        gl.disable(Gl::BLEND);
        gl.use_program(Some(&self.program));
        gl.bind_vertex_array(Some(&self.screen));
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&self.figure));
        gl.uniform2f(self.at("u_res"), width as f32, height as f32);
        gl.uniform4f(self.at("u_hum"), f.hum, f.mode, f.phase, f.time);
        gl.uniform4f(self.at("u_chan"), f.open, f.front, f.swing, f.breath);
        gl.uniform4f(self.at("u_lips"), f.lips, 0.0, 0.0, 0.0);
        let mut pulses = [0.0f32; PULSES * 4];
        for (k, p) in f.pulses.iter().enumerate() {
            pulses[k * 4] = p[0];
            pulses[k * 4 + 1] = p[1];
        }
        gl.uniform4fv_with_f32_array(self.at("u_pulse[0]"), &pulses);
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
