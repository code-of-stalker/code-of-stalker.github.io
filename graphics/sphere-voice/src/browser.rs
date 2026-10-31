//! Browser adapter: WebGL2 objects and draw order. Every motion value comes
//! from `compose`; one full-screen pass traces each pixel's ray through the
//! plate, the dome's shells and the string, the finish engraves or recolors
//! the frame, and the theme's recolor (scene-palette) maps it.
use crate::{
    compose, look, Look, BACK, BELTS, DIALS, EDGE_LIGHT, ENGRAVE_GAMMA, ENGRAVE_WHITE, FLOOR_LIGHT,
    FOCAL, FRAME_ASPECT, FRONT_LIGHT, FRONT_WIDTH, GLYPH_RINGS, HALO, HALO_SPREAD, LINE_WIDTH,
    LOOP_SECONDS, MID_AT, NEST, NEST_LIGHT, NEST_PATTERNS, PANELS, PANEL_FLOAT, PANEL_LIGHT,
    PATTERNS, PATTERN_LIGHT, PLATE, PLATE_FILL, PROJECTION_LIGHT, RAIN, RAIN_HEIGHT, RIM_LIGHT,
    SAND_GRAIN, SAND_LIGHT, SAND_WIDTH, SHEEN, STILL, STREAMS, STREAM_LIGHT, VOICE_HEIGHT,
    VOICE_HZ, VOICE_LIGHT, WAVES,
};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Themed;
use web_sys::{
    HtmlCanvasElement, WebGl2RenderingContext as Gl, WebGlFramebuffer, WebGlProgram, WebGlShader,
    WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const SCENE: &str = include_str!("shaders/scene.frag");
const SCREEN: &str = include_str!("shaders/screen.vert");
const FINISH: &str = include_str!("shaders/finish.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];
/// Every uniform any program reads; a program without one ignores it.
const NAMES: [&str; 20] = [
    "u_eye",
    "u_right",
    "u_up",
    "u_fwd",
    "u_view",
    "u_voice",
    "u_waves",
    "u_belts",
    "u_dome",
    "u_mode0",
    "u_mode1",
    "u_misc",
    "u_turn",
    "u_glow",
    "u_out",
    "u_backdrop",
    "u_edges",
    "u_deep",
    "u_mid",
    "u_ink",
];

/// lib.rs's constants as the shader's `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let v3 = |[x, y, z]: [f32; 3]| format!("vec3({x:?}, {y:?}, {z:?})");
    let v4 = |[x, y, z, w]: [f32; 4]| format!("vec4({x:?}, {y:?}, {z:?}, {w:?})");
    let lines = [
        ("LOOP_SECONDS", f(LOOP_SECONDS)),
        ("PLATE", f(PLATE)),
        ("VOICE_HEIGHT", f(VOICE_HEIGHT)),
        ("WAVES", WAVES.to_string()),
        ("LINE_WIDTH", f(LINE_WIDTH)),
        ("HALO", f(HALO)),
        ("HALO_SPREAD", f(HALO_SPREAD)),
        ("PATTERN_LIGHT", f(PATTERN_LIGHT)),
        ("EDGE_LIGHT", f(EDGE_LIGHT)),
        ("SHEEN", f(SHEEN)),
        ("BACK", f(BACK)),
        ("SAND_LIGHT", f(SAND_LIGHT)),
        ("SAND_WIDTH", f(SAND_WIDTH)),
        ("SAND_GRAIN", f(SAND_GRAIN)),
        ("PLATE_FILL", f(PLATE_FILL)),
        ("RIM_LIGHT", f(RIM_LIGHT)),
        ("FRONT_LIGHT", f(FRONT_LIGHT)),
        ("FRONT_WIDTH", f(FRONT_WIDTH)),
        ("FLOOR_LIGHT", f(FLOOR_LIGHT)),
        ("VOICE_LIGHT", f(VOICE_LIGHT)),
        ("VOICE_HZ", f(VOICE_HZ)),
        ("NEST_LIGHT", f(NEST_LIGHT)),
        ("NEST_0", f(NEST[0])),
        ("NEST_1", f(NEST[1])),
        ("NEST_PATTERN_0", v4(NEST_PATTERNS[0])),
        ("NEST_PATTERN_1", v4(NEST_PATTERNS[1])),
        (
            "BELTS_INIT",
            BELTS.map(|degrees| f(degrees.to_radians())).join(", "),
        ),
        ("PATTERNS_INIT", PATTERNS.map(v4).join(", ")),
        ("RAIN_INIT", RAIN.map(v3).join(", ")),
        ("RAIN_HEIGHT", f(RAIN_HEIGHT)),
        ("DIALS_INIT", DIALS.map(v3).join(", ")),
        ("GLYPH_RINGS_INIT", GLYPH_RINGS.map(v4).join(", ")),
        ("STREAMS", v4(STREAMS)),
        ("PROJECTION_LIGHT", f(PROJECTION_LIGHT)),
        ("STREAM_LIGHT", f(STREAM_LIGHT)),
        (
            "PANELS_INIT",
            PANELS
                .map(|[a, r, w, h]| v4([a.to_radians(), r, w, h]))
                .join(", "),
        ),
        ("PANEL_FLOAT", f(PANEL_FLOAT)),
        ("PANEL_LIGHT", f(PANEL_LIGHT)),
    ];
    lines
        .iter()
        .map(|(name, value)| {
            format!(
                "#define {name} {value}
"
            )
        })
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
pub struct SphereVoice {
    gl: Gl,
    canvas: HtmlCanvasElement,
    scene: Prog,
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
impl SphereVoice {
    /// Nothing to load: the shader traces the whole scene. Light themes
    /// engrave it on the page.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> Result<SphereVoice, JsValue> {
        let options = js_sys::Object::new();
        js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"antialias".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &false.into())?;
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 unavailable")?
            .dyn_into()?;
        let scene = Prog::new(
            &gl,
            SCREEN,
            &format!(
                "#version 300 es
{}{SCENE}",
                defines()
            ),
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
            scene,
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
    /// Reduced motion holds one moment: the whole dome with the domes
    /// inside and around it.
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
        for p in [&self.scene, &self.finish] {
            gl.delete_program(Some(&p.program));
        }
        self.themed.dispose(gl);
        self.disposed = true;
    }
}

impl SphereVoice {
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
        let p = &self.scene;
        let [ex, ey, ez] = f.eye;
        let [rx, ry, rz] = f.right;
        let [ux, uy, uz] = f.up;
        let [fx, fy, fz] = f.forward;
        gl.use_program(Some(&p.program));
        gl.uniform4f(p.at("u_eye"), ex, ey, ez, f.time);
        gl.uniform4f(p.at("u_right"), rx, ry, rz, 0.0);
        gl.uniform4f(p.at("u_up"), ux, uy, uz, 0.0);
        gl.uniform4f(p.at("u_fwd"), fx, fy, fz, 0.0);
        gl.uniform4fv_with_f32_array(p.at("u_view"), &view);
        let [swing, harmonic, voice] = f.voice;
        gl.uniform4f(p.at("u_voice"), swing, harmonic, voice, 0.0);
        gl.uniform4fv_with_f32_array(p.at("u_waves"), &f.waves.concat());
        gl.uniform3fv_with_f32_array(p.at("u_belts"), &f.belts.concat());
        gl.uniform4f(p.at("u_dome"), f.low, f.high, f.dome, f.plate);
        gl.uniform4fv_with_f32_array(p.at("u_mode0"), &f.mode_from);
        gl.uniform4fv_with_f32_array(p.at("u_mode1"), &f.mode_to);
        gl.uniform4f(p.at("u_misc"), f.mode_mix, f.nest[0], f.nest[1], 0.0);
        gl.uniform4f(p.at("u_turn"), f.nest_turn[0], f.nest_turn[1], 0.0, 0.0);
        gl.uniform3fv_with_f32_array(p.at("u_glow"), &self.look.glow);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
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
