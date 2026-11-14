//! Browser adapter: WebGL2 objects and draw order. Every motion value comes
//! from `compose`; the shader traces the strip and the glass ball, and the
//! theme's recolor (scene-palette) maps the finished frame.
use crate::{compose, look, Look, GEOMETRY, HALF, LOOP_SECONDS, SIZE, STILL};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Themed;
use watcher_scene_palette::Warm;
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlProgram, WebGlShader,
    WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const SCREEN: &str = include_str!("shaders/screen.vert");
const SCENE: &str = include_str!("shaders/scene.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];

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

/// One half of the strip, columns `first .. first + HALF`: the whole strip
/// is wider than many phones' largest texture.
fn half(gl: &Gl, unit: u32, image: &HtmlImageElement, first: u32) -> Result<WebGlTexture, JsValue> {
    let t = gl.create_texture().ok_or("Cannot allocate texture")?;
    gl.active_texture(unit);
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
    // From an image WebGL2 takes the sub-rectangle at the skipped pixels,
    // as wide and high as asked.
    gl.pixel_storei(Gl::UNPACK_SKIP_PIXELS, first as i32);
    let uploaded = gl
        .tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_html_image_element(
            Gl::TEXTURE_2D,
            0,
            Gl::RGBA8 as i32,
            HALF as i32,
            SIZE[1] as i32,
            0,
            Gl::RGBA,
            Gl::UNSIGNED_BYTE,
            image,
        );
    gl.pixel_storei(Gl::UNPACK_SKIP_PIXELS, 0);
    uploaded?;
    // Far and slanted parts of the strip read it blurred: the mipmaps hold it.
    gl.generate_mipmap(Gl::TEXTURE_2D);
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

/// Links the scene's programs in the background on the canvas's own context,
/// so the constructor's links come from the browser's program cache instead of
/// freezing the page (scene-palette `warm.rs`). Drop it after the scene is built.
#[wasm_bindgen]
pub fn warm(canvas: &HtmlCanvasElement) -> Result<Warm, JsValue> {
    let programs = [
        (SCREEN, SCENE),
        (
            watcher_scene_palette::VERTEX,
            watcher_scene_palette::FRAGMENT,
        ),
    ];
    Ok(Warm::start(&context(canvas)?, &programs))
}

#[wasm_bindgen]
pub struct SphereEverywhere {
    gl: Gl,
    canvas: HtmlCanvasElement,
    program: WebGlProgram,
    uniforms: Vec<(&'static str, Option<WebGlUniformLocation>)>,
    textures: [WebGlTexture; 2],
    screen: WebGlVertexArrayObject,
    themed: Themed,
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
impl SphereEverywhere {
    /// Art's strip of places, dark; light themes engrave it on the page.
    #[wasm_bindgen(constructor)]
    pub fn new(
        canvas: HtmlCanvasElement,
        strip: HtmlImageElement,
    ) -> Result<SphereEverywhere, JsValue> {
        if strip.natural_width() != SIZE[0] || strip.natural_height() != SIZE[1] {
            return Err("The strip must be 6144 × 1024".into());
        }
        let gl: Gl = context(&canvas)?;
        let program = program(&gl, SCREEN, SCENE)?;
        let names = [
            "u_res",
            "u_out",
            "u_backdrop",
            "u_edges",
            "u_eye",
            "u_target",
            "u_ball",
            "u_rang",
            "u_lit",
            "u_state",
            "u_time",
            "u_glow",
            "u_deep",
            "u_mid",
        ];
        let uniforms = names
            .iter()
            .map(|name| (*name, gl.get_uniform_location(&program, name)))
            .collect();
        let textures = [
            half(&gl, Gl::TEXTURE0, &strip, 0)?,
            half(&gl, Gl::TEXTURE1, &strip, HALF)?,
        ];
        gl.use_program(Some(&program));
        gl.uniform1i(gl.get_uniform_location(&program, "u_left").as_ref(), 0);
        gl.uniform1i(gl.get_uniform_location(&program, "u_right").as_ref(), 1);
        // The geometry never changes: set it once.
        gl.uniform4fv_with_f32_array(
            gl.get_uniform_location(&program, "u_geo[0]").as_ref(),
            &GEOMETRY,
        );
        let themed = Themed::new(&gl, false)?;
        let screen = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        Ok(Self {
            gl,
            canvas,
            program,
            uniforms,
            textures,
            screen,
            themed,
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
    /// Reduced motion holds one moment: every place closed into the ring
    /// round the ball, each band alight.
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
        // Light themes engrave here in their own inks, so they draw straight
        // to the canvas like Дюна.
        let changed = self.themed.set(if next.light { 1 } else { code });
        if changed || self.look != next {
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
        self.themed.dispose(gl);
        self.disposed = true;
    }
}

impl SphereEverywhere {
    fn at(&self, name: &str) -> Option<&WebGlUniformLocation> {
        self.uniforms
            .iter()
            .find(|(n, _)| *n == name)
            .and_then(|(_, location)| location.as_ref())
    }
    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        // A dark theme recolors the finished frame, so the scene draws
        // offscreen; the light engravings draw straight to the canvas.
        let offscreen = self.themed.begin(&self.gl, width, height).unwrap_or(false);
        let f = compose(if self.reduced { STILL } else { self.elapsed });
        let gl = &self.gl;
        gl.viewport(0, 0, width, height);
        gl.disable(Gl::BLEND);
        gl.use_program(Some(&self.program));
        gl.bind_vertex_array(Some(&self.screen));
        for (unit, t) in [Gl::TEXTURE0, Gl::TEXTURE1].into_iter().zip(&self.textures) {
            gl.active_texture(unit);
            gl.bind_texture(Gl::TEXTURE_2D, Some(t));
        }
        gl.uniform2f(self.at("u_res"), width as f32, height as f32);
        gl.uniform4f(
            self.at("u_out"),
            f32::from(!offscreen),
            f32::from(self.soft_edges),
            f32::from(self.look.light),
            0.0,
        );
        gl.uniform3fv_with_f32_array(self.at("u_backdrop"), &self.backdrop);
        gl.uniform4fv_with_f32_array(self.at("u_edges"), &EDGES);
        gl.uniform4fv_with_f32_array(self.at("u_eye"), &f.eye);
        gl.uniform4f(
            self.at("u_target"),
            f.target[0],
            f.target[1],
            f.target[2],
            f.seam,
        );
        gl.uniform4fv_with_f32_array(self.at("u_ball"), &f.ball);
        gl.uniform4fv_with_f32_array(self.at("u_rang"), &f.rang);
        gl.uniform4fv_with_f32_array(self.at("u_lit"), &f.lit);
        gl.uniform4f(self.at("u_state"), f.along, f.hum, f.scan[0], f.scan[1]);
        gl.uniform4f(self.at("u_time"), f.time, f.phase, f.shine, f.flash);
        gl.uniform3fv_with_f32_array(self.at("u_glow"), &self.look.glow);
        gl.uniform3fv_with_f32_array(self.at("u_deep"), &self.look.deep);
        gl.uniform3fv_with_f32_array(self.at("u_mid"), &self.look.mid);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_vertex_array(None);
        gl.active_texture(Gl::TEXTURE0);
        if offscreen {
            let edges = self.soft_edges.then_some(EDGES);
            self.themed.present(gl, self.backdrop, edges);
        }
        self.frames = self.frames.wrapping_add(1);
    }
}
