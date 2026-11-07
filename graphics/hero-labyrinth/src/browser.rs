//! Browser adapter: WebGL2 objects and draw order. Every motion value comes
//! from `compose`; the labyrinth's measures reach the shader as defines, so
//! the walls the shader draws are the walls the tests check.
use crate::{
    compose, look, starts, Look, ASPECT, BLOCK, COURT, DISSOLVE, DOOR, ENTRANCE, FIGURE, GAP,
    HEIGHT, JITTER, LANDING, LIFT, LOOP_SECONDS, OUTER, PIECES, RING, RINGS, STILL, WALL,
    WAVE_SPEED,
};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlFramebuffer,
    WebGlProgram, WebGlShader, WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const SCREEN: &str = include_str!("shaders/screen.vert");
const SCENE: &str = include_str!("shaders/scene.frag");
const FINISH: &str = include_str!("shaders/finish.frag");
const HERO_UNIT: i32 = 0;
const SCENE_UNIT: i32 = 1;
/// The ray-marched pass stays under this many pixels; the finish pass's
/// bloom and grain hide the upscale.
const SCENE_PIXELS: f32 = 0.62e6;
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.08, 0.08, 0.1, 0.12];

/// The scene shader with the labyrinth's measures in front of it.
fn scene_source() -> String {
    let mut s = String::from("#version 300 es\nprecision highp float;\n");
    for (name, value) in [
        ("ASPECT", ASPECT),
        ("COURT", COURT),
        ("OUTER", OUTER),
        ("RING", RING),
        ("WALL", WALL),
        ("HEIGHT", HEIGHT),
        ("GAP", GAP),
        ("DOOR", DOOR),
        ("ENTRANCE", ENTRANCE),
        ("LANDING", LANDING),
        ("BLOCK", BLOCK),
        ("FIGURE", FIGURE),
        ("WAVE_SPEED", WAVE_SPEED),
        ("JITTER", JITTER),
        ("DISSOLVE", DISSOLVE),
        ("LIFT", LIFT),
    ] {
        s.push_str(&format!("#define {name} {value:.7}\n"));
    }
    s.push_str(&format!("#define RINGS {RINGS}\n#define PIECES {PIECES}\n"));
    s.push_str(SCENE);
    s
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

/// An offscreen color target, bound to its own texture unit.
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

#[wasm_bindgen]
pub struct HeroLabyrinth {
    gl: Gl,
    canvas: HtmlCanvasElement,
    scene: Pass,
    finish: Pass,
    hero: WebGlTexture,
    view: Option<Target>,
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
impl HeroLabyrinth {
    #[wasm_bindgen(constructor)]
    pub fn new(
        canvas: HtmlCanvasElement,
        hero: HtmlImageElement,
    ) -> Result<HeroLabyrinth, JsValue> {
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
                "u_res", "u_eye", "u_view", "u_walker", "u_trail", "u_figure", "u_wave",
                "u_pieces", "u_paper", "u_stone", "u_moon", "u_lamp", "u_core", "u_ink", "u_hero",
            ],
        )?;
        let finish = Pass::new(
            &gl,
            SCREEN,
            FINISH,
            &[
                "u_scene",
                "u_res",
                "u_paper",
                "u_backdrop",
                "u_post",
                "u_edges",
            ],
        )?;
        let hero = image_texture(&gl, HERO_UNIT, &hero)?;
        gl.use_program(Some(&scene.program));
        gl.uniform1i(scene.at("u_hero"), HERO_UNIT);
        gl.uniform1fv_with_f32_array(scene.at("u_pieces"), &starts());
        gl.use_program(Some(&finish.program));
        gl.uniform1i(finish.at("u_scene"), SCENE_UNIT);
        gl.uniform4fv_with_f32_array(finish.at("u_edges"), &EDGES);
        let screen = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        Ok(Self {
            gl,
            canvas,
            scene,
            finish,
            hero,
            view: None,
            screen,
            look: look(2),
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
    /// Reduced motion holds one composed moment: the walls fallen, the path
    /// alight on the ground, the figure of light standing in the middle.
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
    /// 3 Астрал, 4 Матрица; retired light codes show Тишина).
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
        gl.delete_texture(Some(&self.hero));
        if let Some(view) = self.view.take() {
            view.delete(gl);
        }
        gl.delete_vertex_array(Some(&self.screen));
        for pass in [&self.scene, &self.finish] {
            gl.delete_program(Some(&pass.program));
        }
        self.disposed = true;
    }
}

impl HeroLabyrinth {
    /// The ray-marched pass's target: the canvas, or less on big canvases.
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
    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        if self.ensure_view(width, height).is_err() {
            return;
        }
        let Some(view) = &self.view else {
            return;
        };
        let f = compose(if self.reduced { STILL } else { self.elapsed });
        let gl = &self.gl;
        gl.disable(Gl::BLEND);
        gl.bind_vertex_array(Some(&self.screen));

        // The labyrinth, its light and the figure.
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&view.frame));
        gl.viewport(0, 0, view.size[0], view.size[1]);
        let s = &self.scene;
        let l = &self.look;
        let c = &f.camera;
        gl.use_program(Some(&s.program));
        gl.uniform2f(s.at("u_res"), view.size[0] as f32, view.size[1] as f32);
        gl.uniform3fv_with_f32_array(s.at("u_eye"), &c.eye);
        gl.uniform4f(
            s.at("u_view"),
            c.target[0],
            c.target[1],
            c.target[2],
            c.zoom,
        );
        gl.uniform4fv_with_f32_array(s.at("u_walker"), &f.walker);
        gl.uniform3fv_with_f32_array(s.at("u_trail"), &f.trail);
        gl.uniform3fv_with_f32_array(s.at("u_figure"), &f.figure);
        gl.uniform4f(s.at("u_wave"), f.wave, f.dust, f.dawn, f.time);
        gl.uniform3fv_with_f32_array(s.at("u_paper"), &l.paper);
        gl.uniform3fv_with_f32_array(s.at("u_stone"), &l.stone);
        gl.uniform3fv_with_f32_array(s.at("u_moon"), &l.moon);
        gl.uniform3fv_with_f32_array(s.at("u_lamp"), &l.lamp);
        gl.uniform3fv_with_f32_array(s.at("u_core"), &l.core);
        gl.uniform4f(s.at("u_ink"), l.ink[0], l.ink[1], l.ink[2], l.body);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);

        // Bloom, grain, the seam's night and the page's edges, onto the canvas.
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        gl.viewport(0, 0, width, height);
        let p = &self.finish;
        gl.use_program(Some(&p.program));
        gl.uniform2f(p.at("u_res"), width as f32, height as f32);
        gl.uniform3fv_with_f32_array(p.at("u_paper"), &l.paper);
        gl.uniform3fv_with_f32_array(p.at("u_backdrop"), &self.backdrop);
        gl.uniform4f(
            p.at("u_post"),
            f.shown,
            if self.reduced {
                0.0
            } else {
                (f.time * 24.0).floor() * 0.37
            },
            f32::from(self.soft_edges),
            0.0,
        );
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
