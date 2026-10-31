//! Browser adapter: WebGL2 objects and draw order. Every motion value comes
//! from `compose`; the shaders paint the face, the lid, the lashes, the eye
//! and the world on its cornea.
use crate::generated::{ATLAS, LABEL_BAND, LABEL_INK};
use crate::{
    band_above, compose, line_place, look, smooth, words, Look, DREAM_CYCLES, EYE_Y, FIGURE_FEET,
    FIGURE_HEIGHT, IRIS_R, LOOP_SECONDS, SIZE, STILL,
};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlBuffer,
    WebGlFramebuffer, WebGlProgram, WebGlShader, WebGlTexture, WebGlUniformLocation,
    WebGlVertexArrayObject,
};

const SCREEN: &str = include_str!("shaders/screen.vert");
const ATLAS_UNIT: i32 = 0;
const SCENE_UNIT: i32 = 1;
/// The scene pass stays under this many pixels; the lashes stay fine at it.
const SCENE_PIXELS: f32 = 1.1e6;
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.1, 0.1, 0.12, 0.16];
/// Floats per text vertex: position, atlas position, color.
const TEXT_STRIDE: usize = 8;

/// The eye's measures, from lib.rs, ahead of the scene shader.
fn scene_source() -> String {
    let [a, b, c, d] = DREAM_CYCLES;
    format!(
        "#version 300 es
precision highp float;
const float EYE_Y = {EYE_Y:?};
const float IRIS_R = {IRIS_R:?};
const float FIGURE_FEET = {FIGURE_FEET:?};
const float FIGURE_HEIGHT = {FIGURE_HEIGHT:?};
const vec4 CYCLES = vec4({a:?}, {b:?}, {c:?}, {d:?});
{}",
        include_str!("shaders/scene.frag")
    )
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

/// One program with its uniform locations looked up once.
struct Pass {
    program: WebGlProgram,
    uniforms: Vec<(&'static str, Option<WebGlUniformLocation>)>,
}
impl Pass {
    fn new(gl: &Gl, vertex: &str, fragment: &str, names: &[&'static str]) -> Result<Self, JsValue> {
        let program = program(gl, vertex, fragment)?;
        let uniforms = names
            .iter()
            .map(|name| (*name, gl.get_uniform_location(&program, name)))
            .collect();
        Ok(Self { program, uniforms })
    }
    fn at(&self, name: &str) -> Option<&WebGlUniformLocation> {
        self.uniforms
            .iter()
            .find(|(n, _)| *n == name)
            .and_then(|(_, location)| location.as_ref())
    }
}

fn image_texture(gl: &Gl, slot: i32, image: &HtmlImageElement) -> Result<WebGlTexture, JsValue> {
    let t = gl.create_texture().ok_or("Cannot allocate texture")?;
    gl.active_texture(Gl::TEXTURE0 + slot as u32);
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
    gl.tex_image_2d_with_u32_and_u32_and_html_image_element(
        Gl::TEXTURE_2D,
        0,
        Gl::RGBA as i32,
        Gl::RGBA,
        Gl::UNSIGNED_BYTE,
        image,
    )?;
    gl.generate_mipmap(Gl::TEXTURE_2D);
    Ok(t)
}

/// The scene's offscreen target, its color on its own texture unit.
struct Target {
    texture: WebGlTexture,
    frame: WebGlFramebuffer,
    size: [i32; 2],
}
impl Target {
    fn new(gl: &Gl, slot: i32, size: [i32; 2]) -> Result<Self, JsValue> {
        let texture = gl.create_texture().ok_or("Cannot allocate texture")?;
        gl.active_texture(Gl::TEXTURE0 + slot as u32);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&texture));
        for (name, value) in [
            (Gl::TEXTURE_MIN_FILTER, Gl::LINEAR),
            (Gl::TEXTURE_MAG_FILTER, Gl::LINEAR),
            (Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE),
            (Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE),
        ] {
            gl.tex_parameteri(Gl::TEXTURE_2D, name, value as i32);
        }
        gl.tex_storage_2d(Gl::TEXTURE_2D, 1, Gl::RGBA8, size[0], size[1]);
        let frame = gl
            .create_framebuffer()
            .ok_or("Cannot allocate framebuffer")?;
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&frame));
        gl.framebuffer_texture_2d(
            Gl::FRAMEBUFFER,
            Gl::COLOR_ATTACHMENT0,
            Gl::TEXTURE_2D,
            Some(&texture),
            0,
        );
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        Ok(Self {
            texture,
            frame,
            size,
        })
    }
    fn delete(&self, gl: &Gl) {
        gl.delete_texture(Some(&self.texture));
        gl.delete_framebuffer(Some(&self.frame));
    }
}

/// The words of the caption at `t`: quads of the atlas, each cut into
/// slices so a line can be written in from the left.
fn caption(t: f32, look: &Look, out: &mut Vec<f32>) {
    out.clear();
    for line in words(t) {
        if line.alpha < 0.004 {
            continue;
        }
        let [left, cap_top, cap] = line_place(line.row);
        let per = cap / 44.0;
        let [ink0, ink1] = LABEL_INK[line.row];
        let pad = 6.0;
        let top = cap_top - band_above() * per;
        let height = (LABEL_BAND[1] - LABEL_BAND[0]) * per;
        let x0 = left - pad * per;
        let width = (ink1 - ink0 + 2.0 * pad) * per;
        let v0 = (line.row as f32 * 128.0 + LABEL_BAND[0]) / ATLAS[1];
        let v1 = (line.row as f32 * 128.0 + LABEL_BAND[1]) / ATLAS[1];
        let u0 = (ink0 - pad) / ATLAS[0];
        let u1 = (ink1 + pad) / ATLAS[0];
        let color = if line.key { look.word } else { look.lead };
        let wipe = line.wipe * 1.25;
        let n = 16;
        let light = |s: usize| line.alpha * (1.0 - smooth(wipe - 0.25, wipe, s as f32 / n as f32));
        for s in 0..n {
            let (s0, s1) = (s as f32 / n as f32, (s + 1) as f32 / n as f32);
            let (a0, a1) = (light(s), light(s + 1));
            if a0 < 0.002 && a1 < 0.002 {
                continue;
            }
            let (xa, xb) = (x0 + width * s0, x0 + width * s1);
            let (ua, ub) = (u0 + (u1 - u0) * s0, u0 + (u1 - u0) * s1);
            let corner = |x: f32, y: f32, u: f32, v: f32, a: f32| {
                [x, y, u, v, color[0] * a, color[1] * a, color[2] * a, a]
            };
            let q = [
                corner(xa, top, ua, v0, a0),
                corner(xb, top, ub, v0, a1),
                corner(xb, top + height, ub, v1, a1),
                corner(xa, top + height, ua, v1, a0),
            ];
            for i in [0, 1, 2, 0, 2, 3] {
                out.extend_from_slice(&q[i]);
            }
        }
    }
}

fn upload(gl: &Gl, buffer: &WebGlBuffer, floats: &[f32], bytes: &mut Vec<u8>) {
    bytes.clear();
    for value in floats {
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    gl.bind_buffer(Gl::ARRAY_BUFFER, Some(buffer));
    gl.buffer_data_with_u8_array(Gl::ARRAY_BUFFER, bytes, Gl::DYNAMIC_DRAW);
}

#[wasm_bindgen]
pub struct TrueSight {
    gl: Gl,
    canvas: HtmlCanvasElement,
    scene: Pass,
    finish: Pass,
    text: Pass,
    atlas: WebGlTexture,
    view: Option<Target>,
    screen: WebGlVertexArrayObject,
    layout: WebGlVertexArrayObject,
    vertices: WebGlBuffer,
    floats: Vec<f32>,
    bytes: Vec<u8>,
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
impl TrueSight {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement, labels: HtmlImageElement) -> Result<TrueSight, JsValue> {
        let options = js_sys::Object::new();
        js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"antialias".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &false.into())?;
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 unavailable")?
            .dyn_into()?;
        let scene = Pass::new(
            &gl,
            SCREEN,
            &scene_source(),
            &[
                "u_res", "u_cam", "u_eye", "u_state", "u_light", "u_paper", "u_key", "u_fill",
                "u_warm", "u_dream", "u_holo",
            ],
        )?;
        let finish = Pass::new(
            &gl,
            SCREEN,
            include_str!("shaders/finish.frag"),
            &[
                "u_scene",
                "u_paper",
                "u_backdrop",
                "u_lamp",
                "u_ink",
                "u_post",
                "u_edges",
            ],
        )?;
        let text = Pass::new(
            &gl,
            include_str!("shaders/text.vert"),
            include_str!("shaders/text.frag"),
            &["u_atlas", "u_size"],
        )?;
        let atlas = image_texture(&gl, ATLAS_UNIT, &labels)?;
        gl.use_program(Some(&finish.program));
        gl.uniform1i(finish.at("u_scene"), SCENE_UNIT);
        gl.uniform4fv_with_f32_array(finish.at("u_edges"), &EDGES);
        gl.use_program(Some(&text.program));
        gl.uniform1i(text.at("u_atlas"), ATLAS_UNIT);
        gl.uniform2f(text.at("u_size"), SIZE[0], SIZE[1]);

        let array = || {
            gl.create_vertex_array()
                .ok_or_else(|| JsValue::from("Cannot allocate vertex array"))
        };
        let (screen, layout) = (array()?, array()?);
        gl.bind_vertex_array(Some(&layout));
        let vertices = gl.create_buffer().ok_or("Cannot allocate buffer")?;
        gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&vertices));
        let stride = (TEXT_STRIDE * 4) as i32;
        for (index, size, offset) in [(0, 2, 0), (1, 2, 8), (2, 4, 16)] {
            gl.enable_vertex_attrib_array(index);
            gl.vertex_attrib_pointer_with_i32(index, size, Gl::FLOAT, false, stride, offset);
        }
        gl.bind_vertex_array(None);
        Ok(Self {
            gl,
            canvas,
            scene,
            finish,
            text,
            atlas,
            view: None,
            screen,
            layout,
            vertices,
            floats: Vec::with_capacity(1 << 13),
            bytes: Vec::with_capacity(1 << 15),
            look: look(0),
            soft_edges: false,
            backdrop: [0.0; 3],
            elapsed: 0.0,
            last_time: None,
            paused: false,
            reduced: false,
            disposed: false,
            frames: 0,
        })
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
    /// Reduced motion holds one composed moment: the eye open and seeing,
    /// the world sharp on its cornea, «ТЫ АБСОЛЮТНЫЙ, ТЫ НАСТОЯЩИЙ.»
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
    /// The app theme by its `graphicsPalette` code (0 Искра … 6 Рассвет).
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
        gl.delete_texture(Some(&self.atlas));
        if let Some(view) = self.view.take() {
            view.delete(gl);
        }
        gl.delete_buffer(Some(&self.vertices));
        for array in [&self.screen, &self.layout] {
            gl.delete_vertex_array(Some(array));
        }
        for pass in [&self.scene, &self.finish, &self.text] {
            gl.delete_program(Some(&pass.program));
        }
        self.disposed = true;
    }
}

impl TrueSight {
    /// The scene pass's target: the canvas, or less on big canvases.
    fn ensure_view(&mut self, width: i32, height: i32) -> Result<(), JsValue> {
        let scale = (SCENE_PIXELS / (width * height).max(1) as f32)
            .sqrt()
            .min(1.0);
        let size = [
            ((width as f32 * scale) as i32).max(1),
            ((height as f32 * scale) as i32).max(1),
        ];
        if self.view.as_ref().is_some_and(|v| v.size == size) {
            return Ok(());
        }
        if let Some(old) = self.view.take() {
            old.delete(&self.gl);
        }
        self.view = Some(Target::new(&self.gl, SCENE_UNIT, size)?);
        Ok(())
    }
    /// The light falls in the theme's colors on a dark page; on a light page
    /// it is white light on black and the finish lays it on in ink.
    fn lights(&self) -> ([f32; 3], [f32; 3], [f32; 3]) {
        let l = &self.look;
        if l.light {
            ([0.0; 3], [1.0; 3], [1.0; 3])
        } else {
            (l.paper, l.key, l.fill)
        }
    }
    fn page(&self) -> [f32; 3] {
        if self.look.light {
            self.backdrop
        } else {
            self.look.paper
        }
    }
    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        if self.ensure_view(width, height).is_err() {
            return;
        }
        let f = compose(if self.reduced { STILL } else { self.elapsed });
        let gl = self.gl.clone();
        let Some(view) = &self.view else {
            return;
        };
        let (paper, key, fill) = self.lights();
        let c = &f.camera;

        // The face and the eye.
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&view.frame));
        gl.viewport(0, 0, view.size[0], view.size[1]);
        gl.disable(Gl::BLEND);
        gl.bind_vertex_array(Some(&self.screen));
        let s = &self.scene;
        gl.use_program(Some(&s.program));
        gl.uniform2f(s.at("u_res"), view.size[0] as f32, view.size[1] as f32);
        gl.uniform3f(s.at("u_cam"), c.center[0], c.center[1], c.half);
        gl.uniform4fv_with_f32_array(s.at("u_eye"), &f.eye);
        gl.uniform4fv_with_f32_array(s.at("u_state"), &f.state);
        gl.uniform4fv_with_f32_array(s.at("u_dream"), &f.dreams);
        gl.uniform4fv_with_f32_array(s.at("u_holo"), &f.holo);
        gl.uniform4f(
            s.at("u_light"),
            f.light,
            f.phase,
            self.look.body,
            f32::from(self.look.light),
        );
        gl.uniform3fv_with_f32_array(s.at("u_paper"), &paper);
        gl.uniform3fv_with_f32_array(s.at("u_key"), &key);
        gl.uniform3fv_with_f32_array(s.at("u_fill"), &fill);
        gl.uniform3fv_with_f32_array(s.at("u_warm"), &self.look.warm);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);

        // Grain, the words' band and the page's edges, onto the canvas.
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        gl.viewport(0, 0, width, height);
        gl.bind_vertex_array(Some(&self.screen));
        let l = &self.look;
        let p = &self.finish;
        gl.use_program(Some(&p.program));
        gl.uniform3fv_with_f32_array(p.at("u_paper"), &self.page());
        gl.uniform3fv_with_f32_array(p.at("u_backdrop"), &self.backdrop);
        gl.uniform3fv_with_f32_array(p.at("u_lamp"), &l.lamp);
        gl.uniform3fv_with_f32_array(p.at("u_ink"), &l.ink);
        gl.uniform4f(
            p.at("u_post"),
            f32::from(l.light),
            f.shown,
            if self.reduced {
                0.0
            } else {
                (f.time * 24.0).floor() * 0.37
            },
            f32::from(self.soft_edges),
        );
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);

        // The words, always sharp, over everything.
        let mut floats = std::mem::take(&mut self.floats);
        caption(f.time, &self.look, &mut floats);
        if !floats.is_empty() {
            gl.bind_vertex_array(Some(&self.layout));
            upload(&gl, &self.vertices, &floats, &mut self.bytes);
            gl.enable(Gl::BLEND);
            gl.blend_func(Gl::ONE, Gl::ONE_MINUS_SRC_ALPHA);
            gl.use_program(Some(&self.text.program));
            gl.draw_arrays(Gl::TRIANGLES, 0, (floats.len() / TEXT_STRIDE) as i32);
            gl.disable(Gl::BLEND);
        }
        self.floats = floats;
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
