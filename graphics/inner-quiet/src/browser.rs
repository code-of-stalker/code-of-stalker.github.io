//! Browser adapter: WebGL2 programs and their uniforms. Every motion value
//! comes from `compose`. The world is rasterised with a depth buffer at a
//! size the GPU can carry: the sky, the land as a mesh of line rows, him on
//! his card, the sphere, the curves (both rings, the tone, the strands) and
//! the signs. The bright pass keeps what is brighter than contrast(3) at half
//! that size, with mips, for the bloom; the composite lays the world on the
//! canvas with its bloom. The scene is drawn in its own theme colours
//! (`look`) over the page colour, so it does not go through the monochrome
//! theme recolor.
use crate::{
    compose, look, Frame, Look, BLOOM, CALM, CARD, COLUMNS, CURVES, CURVE_SEGMENTS, GRID,
    INNER_ROW, LAND_POW, LAND_X, LAND_Z, LOOP_SECONDS, NOISE_FLOW, NOISE_HEIGHT, RIDGE_WAVE, ROW,
    SIGN_COUNT, SPHERE_LAT, SPHERE_LON, STILL, STRIPS, SWELL_HEIGHT,
};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Warm;
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlFramebuffer,
    WebGlProgram, WebGlRenderbuffer, WebGlShader, WebGlTexture, WebGlUniformLocation,
    WebGlVertexArrayObject,
};

const COMMON: &str = include_str!("shaders/common.glsl");
const SCREEN: &str = include_str!("shaders/screen.vert");
const SKY: &str = include_str!("shaders/sky.frag");
const LAND_VERT: &str = include_str!("shaders/land.vert");
const LAND_FRAG: &str = include_str!("shaders/land.frag");
const FIGURE_VERT: &str = include_str!("shaders/figure.vert");
const FIGURE_FRAG: &str = include_str!("shaders/figure.frag");
const SPHERE_VERT: &str = include_str!("shaders/sphere.vert");
const SPHERE_FRAG: &str = include_str!("shaders/sphere.frag");
const CURVE_VERT: &str = include_str!("shaders/curve.vert");
const CURVE_FRAG: &str = include_str!("shaders/curve.frag");
const SIGN_VERT: &str = include_str!("shaders/sign.vert");
const SIGN_FRAG: &str = include_str!("shaders/sign.frag");
const BRIGHT: &str = include_str!("shaders/bright.frag");
const COMPOSITE: &str = include_str!("shaders/composite.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];
/// The Тишина page, until the app says which page it is.
const PAGE: [f32; 3] = [13.0 / 255.0, 21.0 / 255.0, 32.0 / 255.0];
/// The most pixels the world is drawn at; a bigger canvas gets it scaled.
const WORLD_PIXELS: f32 = 1.6e6;
/// Texture units: his picture, the world, its bright part; and the one new
/// textures are made on.
const FIGURE_UNIT: u32 = 0;
const WORLD_UNIT: u32 = 1;
const BRIGHT_UNIT: u32 = 2;
const SPARE_UNIT: u32 = 3;
const NAMES: [&str; 25] = [
    "u_eye",
    "u_right",
    "u_up",
    "u_fwd",
    "u_view",
    "u_cold",
    "u_warm",
    "u_pale",
    "u_backdrop",
    "u_dusk",
    "u_sky",
    "u_scene",
    "u_land",
    "u_swell",
    "u_spike",
    "u_inner",
    "u_sphere",
    "u_curve",
    "u_sign",
    "u_figure",
    "u_src",
    "u_world",
    "u_bright",
    "u_edges",
    "u_bloom",
];

/// lib.rs's constants as the shaders' `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let v2 = |v: [f32; 2]| format!("vec2({:?}, {:?})", v[0], v[1]);
    let lines = [
        ("LOOP_SECONDS", f(LOOP_SECONDS)),
        ("SIGNS", SIGN_COUNT.to_string()),
        ("CURVES", CURVES.to_string()),
        ("CURVE_SEGMENTS", CURVE_SEGMENTS.to_string()),
        ("SPHERE_LON", SPHERE_LON.to_string()),
        ("SPHERE_LAT", SPHERE_LAT.to_string()),
        ("COLUMNS", COLUMNS.to_string()),
        ("STRIPS", STRIPS.to_string()),
        ("LAND_X", f(LAND_X)),
        ("LAND_Z", v2(LAND_Z)),
        ("LAND_POW", f(LAND_POW)),
        ("ROW", f(ROW)),
        ("GRID", f(GRID)),
        ("CALM", v2(CALM)),
        ("NOISE_HEIGHT", f(NOISE_HEIGHT)),
        ("NOISE_FLOW", f(NOISE_FLOW)),
        (
            "RIDGE_WAVE",
            format!(
                "vec3({:?}, {:?}, {:?})",
                RIDGE_WAVE[0], RIDGE_WAVE[1], RIDGE_WAVE[2]
            ),
        ),
        ("INNER_ROW", f(INNER_ROW)),
        ("SWELL_HEIGHT", f(SWELL_HEIGHT)),
        (
            "CARD",
            format!(
                "vec4({:?}, {:?}, {:?}, {:?})",
                CARD[0], CARD[1], CARD[2], CARD[3]
            ),
        ),
    ];
    lines
        .iter()
        .map(|(name, value)| format!("#define {name} {value}\n"))
        .collect()
}

fn source(pass: &str) -> String {
    format!("#version 300 es\n{}{COMMON}{pass}", defines())
}

/// Every program's vertex and fragment source: the sky, the land, him, the
/// sphere, the curves, the signs, the bright part, the composite.
fn sources() -> [(String, String); 8] {
    let screen = || SCREEN.to_string();
    [
        (screen(), source(SKY)),
        (source(LAND_VERT), source(LAND_FRAG)),
        (source(FIGURE_VERT), source(FIGURE_FRAG)),
        (source(SPHERE_VERT), source(SPHERE_FRAG)),
        (source(CURVE_VERT), source(CURVE_FRAG)),
        (source(SIGN_VERT), source(SIGN_FRAG)),
        (screen(), source(BRIGHT)),
        (screen(), source(COMPOSITE)),
    ]
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

struct Prog {
    program: WebGlProgram,
    uniforms: Vec<(&'static str, Option<WebGlUniformLocation>)>,
}

impl Prog {
    fn new(gl: &Gl, vertex: &str, frag: &str) -> Result<Self, JsValue> {
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
        let uniforms = NAMES
            .iter()
            .map(|name| (*name, gl.get_uniform_location(&p, name)))
            .collect();
        Ok(Self {
            program: p,
            uniforms,
        })
    }
    fn at(&self, name: &str) -> Option<&WebGlUniformLocation> {
        self.uniforms
            .iter()
            .find(|(n, _)| *n == name)
            .and_then(|(_, location)| location.as_ref())
    }
}

/// A frame to draw into and read back: RGBA8, smooth reads; with mips for
/// the bright part the bloom gathers from, or with a depth buffer for the
/// world.
struct Target {
    framebuffer: WebGlFramebuffer,
    texture: Option<WebGlTexture>,
    depth: Option<WebGlRenderbuffer>,
    size: (i32, i32),
    mips: bool,
    with_depth: bool,
}

impl Target {
    fn new(gl: &Gl, mips: bool, with_depth: bool) -> Result<Self, JsValue> {
        Ok(Self {
            framebuffer: gl
                .create_framebuffer()
                .ok_or("Cannot allocate framebuffer")?,
            texture: None,
            depth: None,
            size: (0, 0),
            mips,
            with_depth,
        })
    }
    /// Returns whether the frame can be drawn into.
    fn allocate(&mut self, gl: &Gl, width: i32, height: i32) -> Result<bool, JsValue> {
        let t = gl.create_texture().ok_or("Cannot allocate texture")?;
        gl.active_texture(Gl::TEXTURE0 + SPARE_UNIT);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&t));
        let min = if self.mips {
            Gl::LINEAR_MIPMAP_LINEAR
        } else {
            Gl::LINEAR
        };
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MIN_FILTER, min as i32);
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MAG_FILTER, Gl::LINEAR as i32);
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE as i32);
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE as i32);
        gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
            Gl::TEXTURE_2D,
            0,
            Gl::RGBA8 as i32,
            width,
            height,
            0,
            Gl::RGBA,
            Gl::UNSIGNED_BYTE,
            None,
        )?;
        if self.mips {
            gl.generate_mipmap(Gl::TEXTURE_2D);
        }
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&self.framebuffer));
        gl.framebuffer_texture_2d(
            Gl::FRAMEBUFFER,
            Gl::COLOR_ATTACHMENT0,
            Gl::TEXTURE_2D,
            Some(&t),
            0,
        );
        if self.with_depth {
            let d = gl
                .create_renderbuffer()
                .ok_or("Cannot allocate renderbuffer")?;
            gl.bind_renderbuffer(Gl::RENDERBUFFER, Some(&d));
            gl.renderbuffer_storage(Gl::RENDERBUFFER, Gl::DEPTH_COMPONENT24, width, height);
            gl.framebuffer_renderbuffer(
                Gl::FRAMEBUFFER,
                Gl::DEPTH_ATTACHMENT,
                Gl::RENDERBUFFER,
                Some(&d),
            );
            gl.bind_renderbuffer(Gl::RENDERBUFFER, None);
            if let Some(old) = self.depth.replace(d) {
                gl.delete_renderbuffer(Some(&old));
            }
        }
        let complete = gl.check_framebuffer_status(Gl::FRAMEBUFFER) == Gl::FRAMEBUFFER_COMPLETE;
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        gl.bind_texture(Gl::TEXTURE_2D, None);
        gl.active_texture(Gl::TEXTURE0);
        if let Some(old) = self.texture.replace(t) {
            gl.delete_texture(Some(&old));
        }
        self.size = (width, height);
        Ok(complete)
    }
    fn ready(&self, width: i32, height: i32) -> bool {
        self.texture.is_some() && self.size == (width, height)
    }
    fn bind(&self, gl: &Gl) {
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&self.framebuffer));
        gl.viewport(0, 0, self.size.0, self.size.1);
    }
    fn read(&self, gl: &Gl, unit: u32) {
        gl.active_texture(Gl::TEXTURE0 + unit);
        gl.bind_texture(Gl::TEXTURE_2D, self.texture.as_ref());
    }
    /// Its mips, after it was drawn.
    fn mipmap(&self, gl: &Gl) {
        self.read(gl, SPARE_UNIT);
        gl.generate_mipmap(Gl::TEXTURE_2D);
        gl.bind_texture(Gl::TEXTURE_2D, None);
    }
    fn dispose(&mut self, gl: &Gl) {
        if let Some(t) = self.texture.take() {
            gl.delete_texture(Some(&t));
        }
        if let Some(d) = self.depth.take() {
            gl.delete_renderbuffer(Some(&d));
        }
        gl.delete_framebuffer(Some(&self.framebuffer));
    }
}

fn image_texture(gl: &Gl, slot: u32, image: &HtmlImageElement) -> Result<WebGlTexture, JsValue> {
    let t = gl.create_texture().ok_or("Cannot allocate texture")?;
    gl.active_texture(Gl::TEXTURE0 + slot);
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
    gl.pixel_storei(Gl::UNPACK_ALIGNMENT, 4);
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
    Ok(Warm::start(&context(canvas)?, &sources()))
}

fn flat<const N: usize>(rows: &[[f32; N]]) -> Vec<f32> {
    rows.iter().flatten().copied().collect()
}

#[wasm_bindgen]
pub struct InnerQuiet {
    gl: Gl,
    canvas: HtmlCanvasElement,
    sky: Prog,
    land: Prog,
    figure: Prog,
    sphere: Prog,
    curve: Prog,
    sign: Prog,
    bright: Prog,
    composite: Prog,
    world: Target,
    glow: Target,
    picture: WebGlTexture,
    empty: WebGlVertexArrayObject,
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
    /// One image: him, Art's figure 1. The shaders draw the rest.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement, figure: HtmlImageElement) -> Result<InnerQuiet, JsValue> {
        let gl: Gl = context(&canvas)?;
        let [sky, land, fig, sphere, curve, sign, bright, composite] =
            sources().map(|(v, f)| Prog::new(&gl, &v, &f));
        let picture = image_texture(&gl, FIGURE_UNIT, &figure)?;
        let empty = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        Ok(Self {
            world: Target::new(&gl, false, true)?,
            glow: Target::new(&gl, true, false)?,
            sky: sky?,
            land: land?,
            figure: fig?,
            sphere: sphere?,
            curve: curve?,
            sign: sign?,
            bright: bright?,
            composite: composite?,
            gl,
            canvas,
            picture,
            empty,
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
    /// Reduced motion holds one moment: the land quiet, the ridge through
    /// his soles, the tone up through him, both rings round him.
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
    /// The app theme by its `graphicsPalette` code (0 Искра … 4 Матрица).
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
        self.world.dispose(gl);
        self.glow.dispose(gl);
        gl.delete_texture(Some(&self.picture));
        gl.delete_vertex_array(Some(&self.empty));
        for p in [
            &self.sky,
            &self.land,
            &self.figure,
            &self.sphere,
            &self.curve,
            &self.sign,
            &self.bright,
            &self.composite,
        ] {
            gl.delete_program(Some(&p.program));
        }
        self.disposed = true;
    }
}

impl InnerQuiet {
    /// The world's frame and its bright half; false while one cannot be
    /// drawn into.
    fn targets(&mut self, width: i32, height: i32) -> bool {
        let gl = &self.gl;
        let mut ok = true;
        for (target, w, h) in [
            (&mut self.world, width, height),
            (&mut self.glow, (width + 1) / 2, (height + 1) / 2),
        ] {
            if !target.ready(w, h) {
                ok &= target.allocate(gl, w, h).unwrap_or(false);
            }
        }
        ok
    }

    /// What every pass reads: the camera, the frame, the colours, the land.
    fn shared(&self, p: &Prog, f: &Frame, view: &[f32; 4]) {
        let gl = &self.gl;
        let c = f.camera;
        let [ex, ey, ez] = c.eye;
        let [rx, ry, rz] = c.right;
        let [ux, uy, uz] = c.up;
        let [fx, fy, fz] = c.forward;
        gl.use_program(Some(&p.program));
        gl.uniform4f(p.at("u_eye"), ex, ey, ez, f.time);
        gl.uniform4f(p.at("u_right"), rx, ry, rz, 0.0);
        gl.uniform4f(p.at("u_up"), ux, uy, uz, 0.0);
        gl.uniform4f(p.at("u_fwd"), fx, fy, fz, c.lens);
        gl.uniform4fv_with_f32_array(p.at("u_view"), view);
        gl.uniform3fv_with_f32_array(p.at("u_cold"), &self.look.cold);
        gl.uniform3fv_with_f32_array(p.at("u_warm"), &self.look.warm);
        gl.uniform3fv_with_f32_array(p.at("u_pale"), &self.look.pale);
        gl.uniform3fv_with_f32_array(p.at("u_backdrop"), &self.backdrop);
        let [dr, dg, db] = self.look.dusk;
        gl.uniform4f(p.at("u_dusk"), dr, dg, db, 0.0);
        gl.uniform3fv_with_f32_array(p.at("u_sky"), &self.look.sky);
        gl.uniform4f(
            p.at("u_scene"),
            f.lift,
            f32::from(u8::from(self.soft_edges)),
            0.0,
            0.0,
        );
        gl.uniform4fv_with_f32_array(p.at("u_land"), &f.land);
        gl.uniform4fv_with_f32_array(p.at("u_swell"), &f.swell);
        gl.uniform4fv_with_f32_array(p.at("u_spike"), &flat(&f.spikes));
    }

    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        let (w, h) = (width as f32, height as f32);
        let scale = (WORLD_PIXELS / (w * h)).sqrt().min(1.0);
        let world_w = ((w * scale).round() as i32).max(2);
        let world_h = ((h * scale).round() as i32).max(2);
        if !self.targets(world_w, world_h) {
            return;
        }
        let f = compose(if self.reduced { STILL } else { self.elapsed });
        let gl = &self.gl;
        gl.disable(Gl::BLEND);
        gl.disable(Gl::DEPTH_TEST);
        gl.bind_vertex_array(Some(&self.empty));

        // The whole 3:2 frame stays in view on a canvas of any shape: frame
        // y runs -1..1 across its height, x -1.5..1.5 across its width.
        let aspect = w / h;
        let vx = 1.0 / aspect.max(crate::FRAME_ASPECT);
        let vy = aspect.min(crate::FRAME_ASPECT) / crate::FRAME_ASPECT;
        let view = [vx, vy, world_w as f32, world_h as f32];

        // The world: the sky, then the land, him, and what is added to the
        // light, each hidden by what stands in front of it.
        self.world.bind(gl);
        gl.depth_mask(true);
        gl.clear_depth(1.0);
        gl.clear(Gl::DEPTH_BUFFER_BIT);
        self.shared(&self.sky, &f, &view);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);

        gl.enable(Gl::DEPTH_TEST);
        gl.depth_func(Gl::LEQUAL);
        self.shared(&self.land, &f, &view);
        gl.draw_arrays_instanced(
            Gl::TRIANGLE_STRIP,
            0,
            2 * (COLUMNS as i32 + 1),
            STRIPS as i32,
        );

        gl.enable(Gl::BLEND);
        gl.blend_func_separate(
            Gl::SRC_ALPHA,
            Gl::ONE_MINUS_SRC_ALPHA,
            Gl::ONE,
            Gl::ONE_MINUS_SRC_ALPHA,
        );
        gl.active_texture(Gl::TEXTURE0 + FIGURE_UNIT);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&self.picture));
        let p = &self.figure;
        self.shared(p, &f, &view);
        gl.uniform1i(p.at("u_figure"), FIGURE_UNIT as i32);
        gl.uniform4fv_with_f32_array(p.at("u_inner"), &f.inner);
        gl.draw_arrays(Gl::TRIANGLE_STRIP, 0, 4);

        gl.depth_mask(false);
        gl.blend_func(Gl::ONE, Gl::ONE);
        let p = &self.sphere;
        self.shared(p, &f, &view);
        gl.uniform4fv_with_f32_array(p.at("u_sphere"), &f.sphere);
        gl.draw_arrays_instanced(
            Gl::TRIANGLE_STRIP,
            0,
            2 * (SPHERE_LON as i32 + 1),
            SPHERE_LAT as i32,
        );

        let p = &self.curve;
        self.shared(p, &f, &view);
        gl.uniform4fv_with_f32_array(p.at("u_curve"), &flat(&f.curves));
        gl.draw_arrays_instanced(
            Gl::TRIANGLE_STRIP,
            0,
            2 * (CURVE_SEGMENTS as i32 + 1),
            CURVES as i32,
        );

        let p = &self.sign;
        self.shared(p, &f, &view);
        gl.uniform4fv_with_f32_array(p.at("u_sign"), &flat(&f.signs));
        gl.draw_arrays_instanced(Gl::TRIANGLE_STRIP, 0, 4, SIGN_COUNT as i32);

        gl.depth_mask(true);
        gl.disable(Gl::DEPTH_TEST);
        gl.disable(Gl::BLEND);

        // Its bright part, with mips for the bloom.
        self.glow.bind(gl);
        self.world.read(gl, WORLD_UNIT);
        let p = &self.bright;
        gl.use_program(Some(&p.program));
        gl.uniform4f(p.at("u_eye"), 0.0, 0.0, 0.0, f.time);
        gl.uniform1i(p.at("u_src"), WORLD_UNIT as i32);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        self.glow.mipmap(gl);

        // Onto the canvas.
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        gl.viewport(0, 0, width, height);
        self.world.read(gl, WORLD_UNIT);
        self.glow.read(gl, BRIGHT_UNIT);
        let p = &self.composite;
        self.shared(p, &f, &[vx, vy, w, h]);
        gl.uniform1i(p.at("u_world"), WORLD_UNIT as i32);
        gl.uniform1i(p.at("u_bright"), BRIGHT_UNIT as i32);
        gl.uniform4fv_with_f32_array(p.at("u_edges"), &EDGES);
        let [amount, blur] = BLOOM;
        gl.uniform4f(p.at("u_bloom"), amount, blur, world_w as f32 / w, 0.0);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
