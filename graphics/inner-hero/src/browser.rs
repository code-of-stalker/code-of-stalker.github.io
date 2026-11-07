//! Browser adapter: WebGL2 objects and the draw. Every motion value comes
//! from `compose` and every color from `look`; the shader recolors the
//! painting itself and adds the cold and warm light on top, so the warm
//! inside survives the theme's mapping.
use crate::{compose, look, window, Look, GEOMETRY, LOOP_SECONDS, SIZE, STILL};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlProgram, WebGlShader,
    WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const SCREEN: &str = include_str!("shaders/screen.vert");
const SCENE: &str = include_str!("shaders/scene.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.09, 0.09, 0.12, 0.15];
const NAMES: [&str; 18] = [
    "u_res",
    "u_window",
    "u_out",
    "u_backdrop",
    "u_edges",
    "u_cam",
    "u_beat",
    "u_mode",
    "u_paper",
    "u_accent",
    "u_highlight",
    "u_cold",
    "u_warm",
    "u_pale",
    "u_geo[0]",
    "u_paint",
    "u_depth",
    "u_px",
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

/// One image on its own texture unit. The painting gets mipmaps: its fine
/// specks shimmer under the drift unless filtered, and the shader reads a
/// coarse level as the local average.
fn texture(
    gl: &Gl,
    slot: u32,
    image: &HtmlImageElement,
    size: [u32; 2],
    mipmaps: bool,
) -> Result<WebGlTexture, JsValue> {
    if image.natural_width() != size[0] || image.natural_height() != size[1] {
        return Err("The painting must be 1536 × 1024 and its depth map 768 × 512".into());
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

#[wasm_bindgen]
pub struct InnerHero {
    gl: Gl,
    canvas: HtmlCanvasElement,
    program: WebGlProgram,
    uniforms: Vec<Option<WebGlUniformLocation>>,
    textures: Vec<WebGlTexture>,
    screen: WebGlVertexArrayObject,
    look: Look,
    soft_edges: bool,
    /// A home card: crop the painting to cover the card's shape.
    cover: bool,
    backdrop: [f32; 3],
    elapsed: f32,
    last_time: Option<f64>,
    paused: bool,
    reduced: bool,
    disposed: bool,
    frames: u32,
}

#[wasm_bindgen]
impl InnerHero {
    /// Art's painting (its ring erased) and the depth map from `tools/prepare.py`.
    #[wasm_bindgen(constructor)]
    pub fn new(
        canvas: HtmlCanvasElement,
        painting: HtmlImageElement,
        depth: HtmlImageElement,
    ) -> Result<InnerHero, JsValue> {
        let options = js_sys::Object::new();
        js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"antialias".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &false.into())?;
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 unavailable")?
            .dyn_into()?;
        let program = program(&gl, SCREEN, SCENE)?;
        let uniforms = NAMES
            .iter()
            .map(|name| gl.get_uniform_location(&program, name))
            .collect();
        let full = [SIZE[0] as u32, SIZE[1] as u32];
        let textures = vec![
            texture(&gl, 0, &painting, full, true)?,
            texture(&gl, 1, &depth, [full[0] / 2, full[1] / 2], false)?,
        ];
        let screen = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        let hero = Self {
            gl,
            canvas,
            program,
            uniforms,
            textures,
            screen,
            look: look(2),
            soft_edges: false,
            cover: false,
            backdrop: look(2).paper,
            elapsed: 0.0,
            last_time: None,
            paused: false,
            reduced: false,
            disposed: false,
            frames: 0,
        };
        hero.gl.use_program(Some(&hero.program));
        hero.gl.uniform1i(hero.at("u_paint"), 0);
        hero.gl.uniform1i(hero.at("u_depth"), 1);
        Ok(hero)
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
    /// Reduced motion holds one moment: the body is warm and the ring lit.
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
    /// Cover a frame of any shape with a crop of the painting (a home card).
    pub fn cover(&mut self, enabled: bool) {
        if self.cover != enabled {
            self.cover = enabled;
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

impl InnerHero {
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
        let view = window(self.cover, width as f32, height as f32);
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
        gl.uniform4f(self.at("u_cam"), f.drift[0], f.drift[1], f.dolly, f.phase);
        gl.uniform4f(self.at("u_beat"), f.beat, f.spin, f.breath, f.climb);
        gl.uniform4f(self.at("u_mode"), l.mode, 0.0, 0.0, 0.0);
        gl.uniform3fv_with_f32_array(self.at("u_paper"), &l.paper);
        gl.uniform3fv_with_f32_array(self.at("u_accent"), &l.accent);
        gl.uniform3fv_with_f32_array(self.at("u_highlight"), &l.highlight);
        gl.uniform3fv_with_f32_array(self.at("u_cold"), &l.cold);
        gl.uniform3fv_with_f32_array(self.at("u_warm"), &l.warm);
        gl.uniform3fv_with_f32_array(self.at("u_pale"), &l.pale);
        gl.uniform4fv_with_f32_array(self.at("u_geo[0]"), &GEOMETRY);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
