//! Browser adapter: one WebGL2 program and its uniforms, no textures. Every
//! motion value comes from `compose`; one full-screen pass traces each
//! pixel's ray through the room (the floor, the walls, the window, the chair
//! and the seated person, the sphere and its two rings, the moonlight, his
//! image on the glass) and, through the glass and in him, his sky (the clouds, the warm cloud, the lightning and falling stars
//! Rust has already placed there), in the theme's own cold, warm and
//! pale (`look`) over the page colour. The scene is two-toned, so it does
//! not go through the monochrome theme recolor.
use crate::body::{norm, HAND, REST, SHOULDER};
use crate::{
    compose, look, Look, BAR, BOLT_POINTS, BOUNDS, CHEST, FRAME_ASPECT, GLASS, LAMP, LOOP_SECONDS,
    MOON, MULLION, SCUD_PERIOD, SLOW_PERIOD, SPHERE, STARS, STILL, TRANSOM, WALLS, WINDOW_Z,
};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Warm;
use web_sys::{
    HtmlCanvasElement, WebGl2RenderingContext as Gl, WebGlProgram, WebGlShader,
    WebGlUniformLocation, WebGlVertexArrayObject,
};

const SCENE: &str = include_str!("shaders/scene.frag");
const SCREEN: &str = include_str!("shaders/screen.vert");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];
/// The Тишина page, until the app says which page it is.
const PAGE: [f32; 3] = [13.0 / 255.0, 21.0 / 255.0, 32.0 / 255.0];
const NAMES: [&str; 21] = [
    "u_eye",
    "u_right",
    "u_up",
    "u_fwd",
    "u_view",
    "u_world",
    "u_sky",
    "u_glow",
    "u_flash",
    "u_ring",
    "u_outer",
    "u_beam",
    "u_arm",
    "u_bolt",
    "u_star",
    "u_starL",
    "u_cold",
    "u_warm",
    "u_pale",
    "u_backdrop",
    "u_edges",
];

/// lib.rs's constants as the shader's `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let v3 = |v: [f32; 3]| format!("vec3({:?}, {:?}, {:?})", v[0], v[1], v[2]);
    let v4 = |v: [f32; 4]| format!("vec4({:?}, {:?}, {:?}, {:?})", v[0], v[1], v[2], v[3]);
    let lines = [
        ("LOOP_SECONDS", f(LOOP_SECONDS)),
        ("FRAME_ASPECT", f(FRAME_ASPECT)),
        ("BOUNDS_FROM", v3(BOUNDS[0])),
        ("BOUNDS_TO", v3(BOUNDS[1])),
        ("SPHERE", v4(SPHERE)),
        ("CHEST", v3(CHEST)),
        ("LAMP", v3(LAMP)),
        ("WINDOW_Z", f(WINDOW_Z)),
        ("GLASS", v4(GLASS)),
        ("MULLION", f(MULLION)),
        ("TRANSOM", f(TRANSOM)),
        ("BAR", f(BAR)),
        ("WALLS", v3(WALLS)),
        ("MOON", v3(norm(MOON))),
        ("SLOW_PERIOD", f(SLOW_PERIOD)),
        ("SCUD_PERIOD", f(SCUD_PERIOD)),
        ("BOLT_POINTS", BOLT_POINTS.to_string()),
        ("STARS", STARS.to_string()),
        ("SHOULDER", v3(SHOULDER)),
        ("REST_ELBOW", v3(REST.elbow)),
        ("REST_WRIST", v3(REST.wrist)),
        ("REST_HAND", v3(REST.hand)),
        ("HAND", v3(HAND)),
    ];
    lines
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

fn program_source() -> String {
    format!("#version 300 es\n{}{SCENE}", defines())
}

/// Links the scene's programs in the background on the canvas's own context,
/// so the constructor's links come from the browser's program cache instead of
/// freezing the page (scene-palette `warm.rs`). Drop it after the scene is built.
#[wasm_bindgen]
pub fn warm(canvas: &HtmlCanvasElement) -> Result<Warm, JsValue> {
    let programs = [(SCREEN, program_source())];
    Ok(Warm::start(&context(canvas)?, &programs))
}

#[wasm_bindgen]
pub struct InnerClouds {
    gl: Gl,
    canvas: HtmlCanvasElement,
    scene: Prog,
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
impl InnerClouds {
    /// Everything is traced in the shader: no images to load.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> Result<InnerClouds, JsValue> {
        let gl: Gl = context(&canvas)?;
        let scene = Prog::new(&gl, SCREEN, &program_source())?;
        let empty = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        Ok(Self {
            gl,
            canvas,
            scene,
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
    /// Reduced motion holds one moment: «эмоции — тихими», the warm cloud
    /// seen from beside him.
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
        gl.delete_vertex_array(Some(&self.empty));
        gl.delete_program(Some(&self.scene.program));
        self.disposed = true;
    }
}

impl InnerClouds {
    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        let f = compose(if self.reduced { STILL } else { self.elapsed });
        let gl = &self.gl;
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        gl.viewport(0, 0, width, height);
        gl.disable(Gl::BLEND);
        gl.bind_vertex_array(Some(&self.empty));

        // The whole 3:2 frame stays in view on a canvas of any shape: frame
        // y runs -1..1 across its height, x -1.5..1.5 across its width.
        let (w, h) = (width as f32, height as f32);
        let aspect = w / h;
        let view = [
            1.0 / aspect.max(FRAME_ASPECT),
            aspect.min(FRAME_ASPECT) / FRAME_ASPECT,
            w,
            h,
        ];
        let p = &self.scene;
        let flat = |rows: &[[f32; 4]]| rows.iter().flatten().copied().collect::<Vec<f32>>();
        let c = f.camera;
        let [ex, ey, ez] = c.eye;
        let [rx, ry, rz] = c.right;
        let [ux, uy, uz] = c.up;
        let [fx, fy, fz] = c.forward;
        let [gx, gy, gz] = f.glow_way;
        let [lx, ly, lz] = f.flash_way;
        let a = f.arm;
        let arm = [
            [a.elbow[0], a.elbow[1], a.elbow[2], 0.0],
            [a.wrist[0], a.wrist[1], a.wrist[2], 0.0],
            [a.hand[0], a.hand[1], a.hand[2], 0.0],
        ];
        gl.use_program(Some(&p.program));
        gl.uniform4f(p.at("u_eye"), ex, ey, ez, f.time);
        gl.uniform4f(p.at("u_right"), rx, ry, rz, 0.0);
        gl.uniform4f(p.at("u_up"), ux, uy, uz, 0.0);
        gl.uniform4f(p.at("u_fwd"), fx, fy, fz, c.lens);
        gl.uniform4fv_with_f32_array(p.at("u_view"), &view);
        gl.uniform4f(
            p.at("u_world"),
            f.ticks,
            f.moon,
            f.flash,
            f32::from(self.soft_edges),
        );
        gl.uniform4f(p.at("u_sky"), f.slow, f.scud, f.scud_amount, f.glow);
        gl.uniform4f(p.at("u_glow"), gx, gy, gz, 0.0);
        gl.uniform4f(p.at("u_flash"), lx, ly, lz, 0.0);
        gl.uniform4fv_with_f32_array(p.at("u_ring"), &f.ring);
        gl.uniform4f(p.at("u_outer"), f.outer[0], f.outer[1], 0.0, 0.0);
        gl.uniform4fv_with_f32_array(p.at("u_beam"), &f.beam);
        gl.uniform4fv_with_f32_array(p.at("u_arm"), &flat(&arm));
        gl.uniform4fv_with_f32_array(p.at("u_bolt"), &flat(&f.bolt));
        gl.uniform4fv_with_f32_array(p.at("u_star"), &flat(&f.stars));
        gl.uniform4fv_with_f32_array(p.at("u_starL"), &flat(&f.star_light));
        gl.uniform3fv_with_f32_array(p.at("u_cold"), &self.look.cold);
        gl.uniform3fv_with_f32_array(p.at("u_warm"), &self.look.warm);
        gl.uniform3fv_with_f32_array(p.at("u_pale"), &self.look.pale);
        gl.uniform3fv_with_f32_array(p.at("u_backdrop"), &self.backdrop);
        gl.uniform4fv_with_f32_array(p.at("u_edges"), &EDGES);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
