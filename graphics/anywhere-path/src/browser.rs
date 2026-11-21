//! Browser adapter: WebGL2 objects and the draw. Every motion value comes
//! from `Scene::frame` and every color from `look`. The places' boxes go into
//! the data texture once (after the figures' rows, which change every
//! frame); the constants of lib.rs, body.rs, place.rs and scenery.rs reach
//! the shader as `#define`s, so both read one source.
use crate::scenery::{car_spacing, Scenery};
use crate::shader::{source, GROUPS, SCREEN};
use crate::{look, Look, Scene, DATA_W, FIGS, FIG_TEXELS, LOOP};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Warm;
use web_sys::{
    HtmlCanvasElement, WebGl2RenderingContext as Gl, WebGlProgram, WebGlShader, WebGlTexture,
    WebGlUniformLocation, WebGlVertexArrayObject,
};

/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.09, 0.09, 0.12, 0.15];
/// At most this many pixels a frame: one ray each, through a whole world.
const MAX_PIXELS: f32 = 1.3e6;
const NAMES: [&str; 14] = [
    "u_d[0]",
    "u_res",
    "u_data",
    "u_g[0]",
    "u_fig[0]",
    "u_out",
    "u_backdrop",
    "u_edges",
    "u_paper",
    "u_ink",
    "u_cold",
    "u_warm",
    "u_pale",
    "u_code",
];

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

/// The data texture: the figures' cones in the first rows (every frame),
/// the places' boxes after them (once).
fn data_texture(gl: &Gl, scenery: &Scenery) -> Result<(WebGlTexture, usize), JsValue> {
    let texture = gl.create_texture().ok_or("Cannot allocate texture")?;
    gl.active_texture(Gl::TEXTURE0);
    gl.bind_texture(Gl::TEXTURE_2D, Some(&texture));
    for (key, value) in [
        (Gl::TEXTURE_MIN_FILTER, Gl::NEAREST),
        (Gl::TEXTURE_MAG_FILTER, Gl::NEAREST),
        (Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE),
        (Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE),
    ] {
        gl.tex_parameteri(Gl::TEXTURE_2D, key, value as i32);
    }
    let start = FIGS * FIG_TEXELS;
    let total = start + scenery.texels.len();
    let rows = total.div_ceil(DATA_W);
    let mut all = vec![0.0f32; 4 * DATA_W * rows];
    for (i, t) in scenery.texels.iter().enumerate() {
        all[4 * (start + i)..4 * (start + i) + 4].copy_from_slice(t);
    }
    let view = js_sys::Float32Array::from(all.as_slice());
    gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_array_buffer_view(
        Gl::TEXTURE_2D,
        0,
        Gl::RGBA32F as i32,
        DATA_W as i32,
        rows as i32,
        0,
        Gl::RGBA,
        Gl::FLOAT,
        Some(&view),
    )?;
    Ok((texture, rows))
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
pub struct AnywherePath {
    gl: Gl,
    canvas: HtmlCanvasElement,
    program: WebGlProgram,
    uniforms: Vec<Option<WebGlUniformLocation>>,
    data: WebGlTexture,
    screen: WebGlVertexArrayObject,
    scene: Scene,
    groups: Vec<[f32; 4]>,
    car: [[f32; 4]; 2],
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
impl AnywherePath {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> Result<AnywherePath, JsValue> {
        let gl: Gl = context(&canvas)?;
        let program = program(&gl, SCREEN, &source())?;
        let uniforms = NAMES
            .iter()
            .map(|name| gl.get_uniform_location(&program, name))
            .collect();
        let scenery = Scenery::new(FIGS * FIG_TEXELS);
        let (data, _) = data_texture(&gl, &scenery)?;
        // The still places: bounds in the world, angle 0.
        let mut groups = Vec::with_capacity(3 * GROUPS);
        for g in &scenery.places {
            groups.push([g.lo[0], g.lo[1], g.lo[2], g.first as f32]);
            groups.push([g.hi[0], g.hi[1], g.hi[2], g.count as f32]);
            groups.push([1.0, 0.0, 0.0, 0.0]);
        }
        let c = &scenery.car;
        let car = [
            [c.lo[0], c.lo[1], c.lo[2], c.first as f32],
            [c.hi[0], c.hi[1], c.hi[2], c.count as f32],
        ];
        let screen = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        let out = Self {
            gl,
            canvas,
            program,
            uniforms,
            data,
            screen,
            scene: Scene::new(),
            groups,
            car,
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
        out.gl.use_program(Some(&out.program));
        out.gl.uniform1i(out.at("u_data"), 0);
        Ok(out)
    }
    pub fn resize(&mut self, width: u32, height: u32) {
        let (mut w, mut h) = (width.clamp(2, 4096) as f32, height.clamp(2, 4096) as f32);
        let k = (MAX_PIXELS / (w * h)).sqrt();
        if k < 1.0 {
            w = (w * k).floor();
            h = (h * k).floor();
        }
        let (w, h) = (w.max(2.0) as u32, h.max(2.0) as u32);
        if self.canvas.width() != w || self.canvas.height() != h {
            self.canvas.set_width(w);
            self.canvas.set_height(h);
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
                self.elapsed = (self.elapsed + dt).rem_euclid(LOOP);
            }
        }
        self.last_time = Some(milliseconds);
        self.draw();
    }
    pub fn seek(&mut self, seconds: f64) {
        self.elapsed = if seconds.is_finite() {
            (seconds as f32).rem_euclid(LOOP)
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
    /// Reduced motion holds one moment: at the table, one on one, his
    /// sphere and its rings round him.
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
        gl.delete_texture(Some(&self.data));
        gl.delete_vertex_array(Some(&self.screen));
        gl.delete_program(Some(&self.program));
        self.disposed = true;
    }
}

impl AnywherePath {
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
        let t = if self.reduced {
            self.scene.still()
        } else {
            self.elapsed
        };
        let f = self.scene.frame(t);
        let slots = self.scene.pack(&f);
        let people = self.scene.people(&f);
        let cones = self.scene.cones(&f);
        // The three cars, each in its own frame round the ring.
        let mut groups = self.groups.clone();
        for k in 0..3 {
            let phi = f.train[0] + (k as f32 - 1.0) * car_spacing();
            groups.push(self.car[0]);
            groups.push(self.car[1]);
            groups.push([phi.cos(), phi.sin(), 0.0, 0.0]);
        }
        let l = self.look;
        let gl = &self.gl;
        gl.viewport(0, 0, width, height);
        gl.disable(Gl::BLEND);
        gl.use_program(Some(&self.program));
        gl.bind_vertex_array(Some(&self.screen));
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&self.data));
        let flat: Vec<f32> = cones.iter().flatten().copied().collect();
        let view = js_sys::Float32Array::from(flat.as_slice());
        // A failed upload leaves last frame's figures: nothing to report.
        let _ = gl.tex_sub_image_2d_with_i32_and_i32_and_u32_and_type_and_opt_array_buffer_view(
            Gl::TEXTURE_2D,
            0,
            0,
            0,
            DATA_W as i32,
            FIGS as i32,
            Gl::RGBA,
            Gl::FLOAT,
            Some(&view),
        );
        gl.uniform4fv_with_f32_array(self.at("u_d[0]"), slots.as_flattened());
        gl.uniform4f(self.at("u_res"), width as f32, height as f32, 0.0, 0.0);
        gl.uniform4fv_with_f32_array(self.at("u_g[0]"), groups.as_flattened());
        gl.uniform4fv_with_f32_array(self.at("u_fig[0]"), people.as_flattened());
        gl.uniform4f(self.at("u_out"), f32::from(self.soft_edges), 0.0, 0.0, 0.0);
        gl.uniform3fv_with_f32_array(self.at("u_backdrop"), &self.backdrop);
        gl.uniform4fv_with_f32_array(self.at("u_edges"), &EDGES);
        gl.uniform3fv_with_f32_array(self.at("u_paper"), &l.paper);
        gl.uniform3fv_with_f32_array(self.at("u_ink"), &l.ink);
        gl.uniform3fv_with_f32_array(self.at("u_cold"), &l.cold);
        gl.uniform3fv_with_f32_array(self.at("u_warm"), &l.warm);
        gl.uniform3fv_with_f32_array(self.at("u_pale"), &l.pale);
        gl.uniform3fv_with_f32_array(self.at("u_code"), &l.code);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
