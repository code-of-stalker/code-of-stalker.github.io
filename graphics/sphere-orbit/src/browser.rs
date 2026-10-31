//! Browser adapter: WebGL2 objects and draw order. Every motion value comes
//! from `compose`; the shaders build the motes, the lines and the glows from
//! nothing but their instance numbers, all added into one frame, and the
//! theme's recolor (scene-palette) maps the finished frame.
use crate::{
    compose, look, Look, APERTURE, BREATH, CAP_GAIN, CIRCLE_SEGMENTS, DIRECTIONS, ENGRAVE_GAMMA,
    ENGRAVE_WHITE, FAR_BLUR, FAR_LIGHT, FAR_SHELL, FOCAL, FRAME_ASPECT, GAZE, GAZE_LIGHT,
    GAZE_SEGMENTS, HALO, HALO_SPREAD, LINE_WIDTH, LOOP_SECONDS, MERIDIANS, MERIDIAN_FROM,
    MERIDIAN_LIGHT, MID_AT, MOTES, MOTE_RUNNER, MOTE_SEEN, NEAR_LIGHT, NEAR_SHELL, NODES,
    NODE_LIGHT, PARALLELS, PARALLEL_LIGHT, RING_LIGHT, RING_SEGMENTS, RUNNER_GLOW, RUNNER_TAIL,
    STILL, TICK, TICKS, TICK_LIGHT, UNNAMED, WAVE_LIGHT, WAVE_WIDTH,
};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Themed;
use web_sys::{
    HtmlCanvasElement, WebGl2RenderingContext as Gl, WebGlFramebuffer, WebGlProgram, WebGlShader,
    WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const COMMON: &str = include_str!("shaders/common.glsl");
const LINE_VERT: &str = include_str!("shaders/line.vert");
const LINE_FRAG: &str = include_str!("shaders/line.frag");
const SPRITE_VERT: &str = include_str!("shaders/sprite.vert");
const SPRITE_FRAG: &str = include_str!("shaders/sprite.frag");
const SCREEN: &str = include_str!("shaders/screen.vert");
const FINISH: &str = include_str!("shaders/finish.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];
/// Every uniform any program reads; a program without one ignores it.
const NAMES: [&str; 21] = [
    "u_eye",
    "u_right",
    "u_up",
    "u_fwd",
    "u_view",
    "u_build",
    "u_sphere",
    "u_runner",
    "u_caps0",
    "u_caps1",
    "u_waves0",
    "u_waves1",
    "u_waves2",
    "u_glow",
    "u_kind",
    "u_out",
    "u_backdrop",
    "u_edges",
    "u_deep",
    "u_mid",
    "u_ink",
];

/// lib.rs's constants as the shaders' `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let v2 = |[x, y]: [f32; 2]| format!("vec2({x:?}, {y:?})");
    let v3 = |[x, y, z]: [f32; 3]| format!("vec3({x:?}, {y:?}, {z:?})");
    let mut lines = vec![
        ("LOOP_SECONDS", f(LOOP_SECONDS)),
        ("APERTURE", f(APERTURE)),
        ("LINE_WIDTH", f(LINE_WIDTH)),
        ("HALO", f(HALO)),
        ("HALO_SPREAD", f(HALO_SPREAD)),
        ("RING_SEGMENTS", RING_SEGMENTS.to_string()),
        ("CIRCLE_SEGMENTS", CIRCLE_SEGMENTS.to_string()),
        ("MERIDIANS", MERIDIANS.to_string()),
        ("MERIDIAN_FROM", f(MERIDIAN_FROM)),
        ("TICKS", TICKS.to_string()),
        ("TICK_SHORT", f(TICK[0])),
        ("TICK_LONG", f(TICK[1])),
        ("GAZE", f(GAZE)),
        ("GAZE_SEGMENTS", GAZE_SEGMENTS.to_string()),
        ("NEAR_MOTES", MOTES[0].to_string()),
        ("NODES", NODES.to_string()),
        ("NEAR_SHELL", v2(NEAR_SHELL)),
        ("FAR_SHELL", v2(FAR_SHELL)),
        ("FAR_BLUR", f(FAR_BLUR)),
        ("RING_LIGHT", f(RING_LIGHT)),
        ("TICK_LIGHT", f(TICK_LIGHT)),
        ("MERIDIAN_LIGHT", f(MERIDIAN_LIGHT)),
        ("PARALLEL_LIGHT", f(PARALLEL_LIGHT)),
        ("GAZE_LIGHT", f(GAZE_LIGHT)),
        ("NODE_LIGHT", f(NODE_LIGHT)),
        ("WAVE_LIGHT", f(WAVE_LIGHT)),
        ("WAVE_WIDTH", f(WAVE_WIDTH)),
        ("NEAR_LIGHT", f(NEAR_LIGHT)),
        ("FAR_LIGHT", f(FAR_LIGHT)),
        ("RUNNER_TAIL", f(RUNNER_TAIL)),
        ("RUNNER_GLOW", f(RUNNER_GLOW)),
        ("MOTE_RUNNER", f(MOTE_RUNNER)),
        ("CAP_GAIN", f(CAP_GAIN)),
        ("MOTE_SEEN", f(MOTE_SEEN)),
        ("BREATH", f(BREATH)),
        ("UNNAMED", v3(UNNAMED)),
    ];
    for (i, latitude) in PARALLELS.iter().enumerate() {
        lines.push((
            ["PARALLEL_0", "PARALLEL_1", "PARALLEL_2", "PARALLEL_3"][i],
            f(latitude.to_radians()),
        ));
    }
    for (i, direction) in DIRECTIONS.iter().enumerate() {
        lines.push((
            [
                "DIRECTION_0",
                "DIRECTION_1",
                "DIRECTION_2",
                "DIRECTION_3",
                "DIRECTION_4",
            ][i],
            v3(*direction),
        ));
    }
    lines
        .iter()
        .map(|(name, value)| format!("#define {name} {value}\n"))
        .collect()
}

/// A shader that shares the scene's camera, timeline and hash.
fn scene_source(defines: &str, body: &str) -> String {
    format!("#version 300 es\n{defines}{COMMON}\n{body}")
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
        // The finish reads the frame from texture unit 2.
        gl.use_program(Some(&p));
        gl.uniform1i(gl.get_uniform_location(&p, "u_frame").as_ref(), 2);
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

fn clamp_and_filter(gl: &Gl, min: u32, mag: u32) {
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MIN_FILTER, min as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MAG_FILTER, mag as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE as i32);
}

/// The frame every pass adds into: half floats where the GPU can blend them,
/// else bytes holding half the light (the finish doubles it back).
struct Target {
    framebuffer: WebGlFramebuffer,
    texture: Option<WebGlTexture>,
    size: (i32, i32),
    float: bool,
}

impl Target {
    fn new(gl: &Gl) -> Result<Self, JsValue> {
        let float = gl
            .get_extension("EXT_color_buffer_float")
            .ok()
            .flatten()
            .is_some();
        Ok(Self {
            framebuffer: gl
                .create_framebuffer()
                .ok_or("Cannot allocate framebuffer")?,
            texture: None,
            size: (0, 0),
            float,
        })
    }
    /// How much of each pass's light the frame keeps.
    fn keep(&self) -> f32 {
        if self.float {
            1.0
        } else {
            0.5
        }
    }
    fn allocate(&mut self, gl: &Gl, width: i32, height: i32) -> Result<(), JsValue> {
        let t = gl.create_texture().ok_or("Cannot allocate texture")?;
        gl.active_texture(Gl::TEXTURE2);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&t));
        clamp_and_filter(gl, Gl::NEAREST, Gl::NEAREST);
        let (internal, kind) = if self.float {
            (Gl::RGBA16F, Gl::HALF_FLOAT)
        } else {
            (Gl::RGBA8, Gl::UNSIGNED_BYTE)
        };
        gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
            Gl::TEXTURE_2D,
            0,
            internal as i32,
            width,
            height,
            0,
            Gl::RGBA,
            kind,
            None,
        )?;
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&self.framebuffer));
        gl.framebuffer_texture_2d(
            Gl::FRAMEBUFFER,
            Gl::COLOR_ATTACHMENT0,
            Gl::TEXTURE_2D,
            Some(&t),
            0,
        );
        let complete = gl.check_framebuffer_status(Gl::FRAMEBUFFER) == Gl::FRAMEBUFFER_COMPLETE;
        gl.bind_texture(Gl::TEXTURE_2D, None);
        gl.active_texture(Gl::TEXTURE0);
        if let Some(old) = self.texture.replace(t) {
            gl.delete_texture(Some(&old));
        }
        self.size = (width, height);
        if !complete {
            if self.float {
                // The extension is there but this GPU cannot draw into half
                // floats: fall back to bytes.
                self.float = false;
                return self.allocate(gl, width, height);
            }
            return Err("Cannot draw into the frame".into());
        }
        Ok(())
    }
    /// Bind the frame for drawing, sized to the canvas.
    fn bind(&mut self, gl: &Gl, width: i32, height: i32) -> Result<(), JsValue> {
        if self.texture.is_none() || self.size != (width, height) {
            self.allocate(gl, width, height)?;
        }
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&self.framebuffer));
        Ok(())
    }
    fn dispose(&mut self, gl: &Gl) {
        if let Some(t) = self.texture.take() {
            gl.delete_texture(Some(&t));
        }
        gl.delete_framebuffer(Some(&self.framebuffer));
    }
}

#[wasm_bindgen]
pub struct SphereOrbit {
    gl: Gl,
    canvas: HtmlCanvasElement,
    line: Prog,
    sprite: Prog,
    finish: Prog,
    target: Target,
    empty: WebGlVertexArrayObject,
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
impl SphereOrbit {
    /// Nothing to load: every line and mote is built on the GPU. Light
    /// themes engrave the scene on the page.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> Result<SphereOrbit, JsValue> {
        let options = js_sys::Object::new();
        js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"antialias".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &false.into())?;
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 unavailable")?
            .dyn_into()?;
        let defines = defines();
        let line = Prog::new(
            &gl,
            &scene_source(&defines, LINE_VERT),
            &scene_source(&defines, LINE_FRAG),
        )?;
        let sprite = Prog::new(
            &gl,
            &scene_source(&defines, SPRITE_VERT),
            &scene_source(&defines, SPRITE_FRAG),
        )?;
        let finish = Prog::new(&gl, SCREEN, FINISH)?;
        let target = Target::new(&gl)?;
        let themed = Themed::new(&gl, false)?;
        let empty = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        Ok(Self {
            gl,
            canvas,
            line,
            sprite,
            finish,
            target,
            empty,
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
    /// Reduced motion holds one moment: the whole sphere lit, all around.
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
        self.target.dispose(gl);
        gl.delete_vertex_array(Some(&self.empty));
        for p in [&self.line, &self.sprite, &self.finish] {
            gl.delete_program(Some(&p.program));
        }
        self.themed.dispose(gl);
        self.disposed = true;
    }
}

impl SphereOrbit {
    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        if self.target.bind(&self.gl, width, height).is_err() {
            return;
        }
        let f = compose(if self.reduced { STILL } else { self.elapsed });
        let keep = self.target.keep();
        let gl = &self.gl;
        gl.viewport(0, 0, width, height);
        gl.clear_color(0.0, 0.0, 0.0, 1.0);
        gl.clear(Gl::COLOR_BUFFER_BIT);
        gl.enable(Gl::BLEND);
        gl.blend_func(Gl::CONSTANT_COLOR, Gl::ONE);
        gl.blend_color(keep, keep, keep, keep);
        gl.bind_vertex_array(Some(&self.empty));

        // The whole 3:2 frame stays in view on a canvas of any shape.
        let (w, h) = (width as f32, height as f32);
        let aspect = w / h;
        let view = [
            FOCAL / aspect.max(FRAME_ASPECT),
            FOCAL * aspect.min(FRAME_ASPECT) / FRAME_ASPECT,
            w,
            h,
        ];
        let [ex, ey, ez] = f.eye;
        let [rx, ry, rz] = f.right;
        let [ux, uy, uz] = f.up;
        let [fx, fy, fz] = f.forward;
        let c = f.caps;
        let w = f.waves;
        let scene = |p: &Prog, kind: f32| {
            gl.use_program(Some(&p.program));
            gl.uniform4f(p.at("u_eye"), ex, ey, ez, f.focus);
            gl.uniform4f(p.at("u_right"), rx, ry, rz, f.time);
            gl.uniform4f(p.at("u_up"), ux, uy, uz, f.breath);
            gl.uniform4f(p.at("u_fwd"), fx, fy, fz, 0.0);
            gl.uniform4fv_with_f32_array(p.at("u_view"), &view);
            gl.uniform4f(p.at("u_build"), f.ring, f.orbit, f.ticks, f.point);
            gl.uniform4f(p.at("u_sphere"), f.tilt, f.fan, f.slide, f.sphere);
            gl.uniform4f(p.at("u_runner"), f.runner[0], f.runner[1], 0.0, 0.0);
            gl.uniform4f(p.at("u_caps0"), c[0], c[1], c[2], c[3]);
            gl.uniform4f(p.at("u_caps1"), c[4], c[5], 0.0, 0.0);
            gl.uniform4f(p.at("u_waves0"), w[0][0], w[0][1], w[1][0], w[1][1]);
            gl.uniform4f(p.at("u_waves1"), w[2][0], w[2][1], w[3][0], w[3][1]);
            gl.uniform4f(p.at("u_waves2"), w[4][0], w[4][1], w[5][0], w[5][1]);
            gl.uniform3fv_with_f32_array(p.at("u_glow"), &self.look.glow);
            gl.uniform4f(p.at("u_kind"), kind, 0.0, 0.0, 0.0);
        };

        // The world outside, then the lines, then the point, the runner and
        // the glints.
        scene(&self.sprite, 0.0);
        gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, (MOTES[0] + MOTES[1]) as i32);
        let families = [
            (f.orbit, RING_SEGMENTS),
            (f.orbit * f.ticks, TICKS),
            (f.sphere, MERIDIANS * CIRCLE_SEGMENTS),
            (f.sphere * f.slide, PARALLELS.len() as u32 * CIRCLE_SEGMENTS),
            (f.orbit * f.runner[1], GAZE_SEGMENTS),
            (
                f.sphere * w.iter().map(|w| w[1]).fold(0.0, f32::max),
                w.len() as u32 * CIRCLE_SEGMENTS,
            ),
        ];
        for (kind, (on, count)) in families.iter().enumerate() {
            if *on > 0.0 {
                scene(&self.line, kind as f32);
                gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, *count as i32);
            }
        }
        scene(&self.sprite, 1.0);
        gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, 5);
        if f.sphere > 0.0 {
            scene(&self.sprite, 2.0);
            gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, NODES as i32);
        }
        gl.disable(Gl::BLEND);

        // A dark theme recolors the finished frame, so the finish draws
        // offscreen; the light engravings draw straight to the canvas.
        let offscreen = self.themed.begin(gl, width, height).unwrap_or(false);
        if !offscreen {
            gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        }
        gl.viewport(0, 0, width, height);
        let p = &self.finish;
        gl.use_program(Some(&p.program));
        gl.active_texture(Gl::TEXTURE2);
        gl.bind_texture(Gl::TEXTURE_2D, self.target.texture.as_ref());
        gl.uniform4f(
            p.at("u_out"),
            f32::from(!offscreen),
            f32::from(self.soft_edges),
            f32::from(self.look.light),
            1.0 / keep,
        );
        gl.uniform3fv_with_f32_array(p.at("u_backdrop"), &self.backdrop);
        gl.uniform4fv_with_f32_array(p.at("u_edges"), &EDGES);
        gl.uniform3fv_with_f32_array(p.at("u_deep"), &self.look.deep);
        gl.uniform3fv_with_f32_array(p.at("u_mid"), &self.look.mid);
        gl.uniform4f(p.at("u_ink"), ENGRAVE_WHITE, ENGRAVE_GAMMA, MID_AT, 0.0);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_texture(Gl::TEXTURE_2D, None);
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_vertex_array(None);
        if offscreen {
            let edges = self.soft_edges.then_some(EDGES);
            self.themed.present(gl, self.backdrop, edges);
        }
        self.frames = self.frames.wrapping_add(1);
    }
}
