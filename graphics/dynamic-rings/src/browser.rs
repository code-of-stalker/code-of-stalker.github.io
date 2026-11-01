//! Browser adapter: WebGL2 objects and draw order. Every motion value comes
//! from the chapter's `Story`; the shaders build the figure, the rings, the
//! floor and the motes from nothing but their instance numbers, all added
//! into one frame, and the theme's recolor (scene-palette) maps the
//! finished frame.
use crate::body::{BLEND, PRIMITIVES};
use crate::{
    cone_points, look, pack, Chapter, Look, Story, ACTION_LIGHT, ACTION_SEGMENTS, APERTURE, BEADS,
    BODY_DOT, BODY_LIGHT, BODY_POINTS, BODY_SIZE, ENGRAVE_GAMMA, ENGRAVE_WHITE, FLASH_GAIN,
    FLOOR_CELL, FLOOR_GRID, FLOOR_LIGHT, FLOOR_POOL, FLOOR_RING_LIGHT, FOCAL, FRAME_ASPECT, GAZE,
    GAZE_LIGHT, GAZE_SEGMENTS, GHOSTS, GHOST_LIGHT, GHOST_SEGMENTS, HALO, HALO_SPREAD, LINE_WIDTH,
    MID_AT, MOTES, MOTE_GAZE, MOTE_LIGHT, MOTE_SPAN, ORBIT_LIGHT, ORBIT_START, PRINTS, PRINT_FADE,
    PRINT_LIGHT, PRINT_SEGMENTS, RING_SEGMENTS, RIPPLE_LIGHT, RIPPLE_REACH, RIPPLE_SECONDS,
    RIPPLE_SEGMENTS, RUNNER_GLOW, RUNNER_TAIL, SLOTS, SLOT_FEET, SLOT_GHOST, SLOT_GHOST_NORMAL,
    SLOT_META, SLOT_PRINT, SLOT_VIEW, SPHERE_LATITUDES, SPHERE_LIGHT, SPHERE_MERIDIANS,
    SPHERE_SEGMENTS, STARS, STAR_LIGHT, TICK, TICKS, TICK_LIGHT, WAVE_GAIN,
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
const BODY_VERT: &str = include_str!("shaders/body.vert");
const BODY_FRAG: &str = include_str!("shaders/body.frag");
const SCREEN: &str = include_str!("shaders/screen.vert");
const FINISH: &str = include_str!("shaders/finish.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];
/// Every uniform any program reads; a program without one ignores it.
const NAMES: [&str; 11] = [
    "u_d",
    "u_b",
    "u_glow",
    "u_kind",
    "u_out",
    "u_backdrop",
    "u_edges",
    "u_deep",
    "u_mid",
    "u_ink",
    "u_frame",
];

/// lib.rs's constants as the shaders' `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let n = |v: u32| v.to_string();
    let mut lines = vec![
        ("SLOTS", SLOTS.to_string()),
        ("SLOT_GHOST", SLOT_GHOST.to_string()),
        ("SLOT_GHOST_NORMAL", SLOT_GHOST_NORMAL.to_string()),
        ("SLOT_PRINT", SLOT_PRINT.to_string()),
        ("SLOT_FEET", SLOT_FEET.to_string()),
        ("SLOT_META", SLOT_META.to_string()),
        ("CONES", PRIMITIVES.to_string()),
        ("APERTURE", f(APERTURE)),
        ("LINE_WIDTH", f(LINE_WIDTH)),
        ("HALO", f(HALO)),
        ("HALO_SPREAD", f(HALO_SPREAD)),
        ("RING_SEGMENTS", n(RING_SEGMENTS)),
        ("TICKS", n(TICKS)),
        ("TICK_SHORT", f(TICK[0])),
        ("TICK_LONG", f(TICK[1])),
        ("GAZE_FROM", f(GAZE[0])),
        ("GAZE_TO", f(GAZE[1])),
        ("GAZE_SEGMENTS", n(GAZE_SEGMENTS)),
        ("ORBIT_START", f(ORBIT_START)),
        ("RUNNER_TAIL", f(RUNNER_TAIL)),
        ("SPHERE_MERIDIANS", n(SPHERE_MERIDIANS)),
        ("SPHERE_SEGMENTS", n(SPHERE_SEGMENTS)),
        ("ACTION_SEGMENTS", n(ACTION_SEGMENTS)),
        ("BEADS", n(BEADS)),
        ("GHOST_SEGMENTS", n(GHOST_SEGMENTS)),
        ("PRINTS", PRINTS.to_string()),
        ("PRINT_SEGMENTS", n(PRINT_SEGMENTS)),
        ("PRINT_FADE", f(PRINT_FADE)),
        ("RIPPLE_SECONDS", f(RIPPLE_SECONDS)),
        ("RIPPLE_REACH", f(RIPPLE_REACH)),
        ("RIPPLE_SEGMENTS", n(RIPPLE_SEGMENTS)),
        ("FLOOR_CELL", f(FLOOR_CELL)),
        ("FLOOR_GRID", n(FLOOR_GRID)),
        ("FLOOR_POOL", f(FLOOR_POOL)),
        ("MOTE_SPAN_X", f(MOTE_SPAN[0])),
        ("MOTE_SPAN_Y", f(MOTE_SPAN[1])),
        ("BODY_SIZE", f(BODY_SIZE)),
        ("BODY_DOT", f(BODY_DOT)),
        ("ORBIT_LIGHT", f(ORBIT_LIGHT)),
        ("TICK_LIGHT", f(TICK_LIGHT)),
        ("GAZE_LIGHT", f(GAZE_LIGHT)),
        ("RUNNER_GLOW", f(RUNNER_GLOW)),
        ("SPHERE_LIGHT", f(SPHERE_LIGHT)),
        ("ACTION_LIGHT", f(ACTION_LIGHT)),
        ("GHOST_LIGHT", f(GHOST_LIGHT)),
        ("PRINT_LIGHT", f(PRINT_LIGHT)),
        ("RIPPLE_LIGHT", f(RIPPLE_LIGHT)),
        ("FLOOR_LIGHT", f(FLOOR_LIGHT)),
        ("FLOOR_RING_LIGHT", f(FLOOR_RING_LIGHT)),
        ("MOTE_LIGHT", f(MOTE_LIGHT)),
        ("MOTE_GAZE", f(MOTE_GAZE)),
        ("STAR_LIGHT", f(STAR_LIGHT)),
        ("BODY_LIGHT", f(BODY_LIGHT)),
        ("FLASH_GAIN", f(FLASH_GAIN)),
        ("WAVE_GAIN", f(WAVE_GAIN)),
    ];
    for (i, latitude) in SPHERE_LATITUDES.iter().enumerate() {
        lines.push((
            [
                "SPHERE_LAT_0",
                "SPHERE_LAT_1",
                "SPHERE_LAT_2",
                "SPHERE_LAT_3",
                "SPHERE_LAT_4",
            ][i],
            f(latitude.to_radians()),
        ));
    }
    let list = |items: Vec<String>| items.join(", ");
    lines.push(("BLENDS", list(BLEND.iter().map(|&b| f(b)).collect())));
    lines.push((
        "CONE_ENDS",
        list(cone_points().iter().map(|e| e.to_string()).collect()),
    ));
    lines
        .iter()
        .map(|(name, value)| format!("#define {name} {value}\n"))
        .collect()
}

/// A shader that shares the scene's camera, slots and hash.
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
        let prog = Self {
            program: p,
            uniforms,
        };
        // The finish reads the frame from texture unit 2.
        gl.use_program(Some(&prog.program));
        gl.uniform1i(prog.at("u_frame"), 2);
        Ok(prog)
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
pub struct DynamicRings {
    gl: Gl,
    canvas: HtmlCanvasElement,
    line: Prog,
    sprite: Prog,
    body: Prog,
    finish: Prog,
    target: Target,
    empty: WebGlVertexArrayObject,
    themed: Themed,
    look: Look,
    story: Story,
    largest_point: f32,
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
impl DynamicRings {
    /// Nothing to load: the figure, the rings and the world are built on the
    /// GPU. Light themes engrave the scene on the page.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> Result<DynamicRings, JsValue> {
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
        let body = Prog::new(
            &gl,
            &scene_source(&defines, BODY_VERT),
            &scene_source(&defines, BODY_FRAG),
        )?;
        let finish = Prog::new(&gl, SCREEN, FINISH)?;
        let target = Target::new(&gl)?;
        let themed = Themed::new(&gl, false)?;
        let empty = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        let largest_point = gl
            .get_parameter(Gl::ALIASED_POINT_SIZE_RANGE)
            .ok()
            .and_then(|range| range.dyn_into::<js_sys::Float32Array>().ok())
            .map_or(64.0, |range| range.get_index(1));
        Ok(Self {
            gl,
            canvas,
            line,
            sprite,
            body,
            finish,
            target,
            empty,
            themed,
            look: look(4),
            story: Story::new(Chapter::Hero),
            largest_point,
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
    /// Which page's loop to play: 0 the step's cover, 1 page 01.
    pub fn chapter(&mut self, code: u32) {
        let chapter = Chapter::from_code(code);
        if chapter != self.story.chapter {
            self.story = Story::new(chapter);
            self.elapsed = 0.0;
            self.last_time = None;
            self.draw();
        }
    }
    pub fn loop_seconds(&self) -> f64 {
        f64::from(self.story.loop_seconds)
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
                self.elapsed = (self.elapsed + dt).rem_euclid(self.story.loop_seconds);
            }
        }
        self.last_time = Some(milliseconds);
        self.draw();
    }
    pub fn seek(&mut self, seconds: f64) {
        self.elapsed = if seconds.is_finite() {
            (seconds as f32).rem_euclid(self.story.loop_seconds)
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
    /// Reduced motion holds one moment: the figure mid-step, all three rings.
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
        for p in [&self.line, &self.sprite, &self.body, &self.finish] {
            gl.delete_program(Some(&p.program));
        }
        self.themed.dispose(gl);
        self.disposed = true;
    }
}

impl DynamicRings {
    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        if self.target.bind(&self.gl, width, height).is_err() {
            return;
        }
        let at = if self.reduced {
            self.story.chapter.still()
        } else {
            self.elapsed
        };
        let f = self.story.compose(at);
        let mut slots = pack(&f, &self.story);
        // The whole 3:2 frame stays in view on a canvas of any shape.
        let (w, h) = (width as f32, height as f32);
        let aspect = w / h;
        slots[SLOT_VIEW] = [
            FOCAL / aspect.max(FRAME_ASPECT),
            FOCAL * aspect.min(FRAME_ASPECT) / FRAME_ASPECT,
            w,
            h,
        ];
        let flat: Vec<f32> = slots.iter().flatten().copied().collect();
        let cones: Vec<f32> = f.body.cones.iter().flatten().copied().collect();
        let keep = self.target.keep();
        let gl = &self.gl;
        gl.viewport(0, 0, width, height);
        gl.clear_color(0.0, 0.0, 0.0, 1.0);
        gl.clear(Gl::COLOR_BUFFER_BIT);
        gl.enable(Gl::BLEND);
        gl.blend_func(Gl::CONSTANT_COLOR, Gl::ONE);
        gl.blend_color(keep, keep, keep, keep);
        gl.bind_vertex_array(Some(&self.empty));
        let largest = self.largest_point;
        let scene = |p: &Prog, kind: f32| {
            gl.use_program(Some(&p.program));
            gl.uniform4fv_with_f32_array(p.at("u_d"), &flat);
            gl.uniform3fv_with_f32_array(p.at("u_glow"), &self.look.glow);
            gl.uniform4f(p.at("u_kind"), kind, largest, 0.0, 0.0);
        };

        // The world: far stars, the floor, the motes in the air.
        let sprites = [
            (f.motes, STARS, 3.0),
            (f.floor, FLOOR_GRID * FLOOR_GRID, 1.0),
            (f.motes, MOTES, 0.0),
        ];
        for (on, count, kind) in sprites {
            if on > 0.0 {
                scene(&self.sprite, kind);
                gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, count as i32);
            }
        }
        // The lines.
        let ghosts = f.ghosts.iter().map(|g| g.2).fold(0.0, f32::max);
        let families = [
            (f.orbit.light, RING_SEGMENTS),
            (f.orbit.light * f.orbit.extra[0], TICKS),
            (
                f.orbit.light * f.orbit.extra[3] * f.orbit.extra[4],
                GAZE_SEGMENTS,
            ),
            (
                f.inner.light,
                (SPHERE_LATITUDES.len() as u32 + SPHERE_MERIDIANS) * SPHERE_SEGMENTS,
            ),
            (f.action.light, ACTION_SEGMENTS),
            (ghosts, GHOSTS as u32 * GHOST_SEGMENTS),
            (f.floor, PRINTS as u32 * RIPPLE_SEGMENTS),
            (f.floor, PRINTS as u32 * PRINT_SEGMENTS),
            (f.orbit.light * f.floor, RING_SEGMENTS),
            (f.lock[3] * f32::from(f.lock_radius > 0.0), RING_SEGMENTS),
        ];
        for (kind, (on, count)) in families.iter().enumerate() {
            if *on > 0.0 {
                scene(&self.line, kind as f32);
                gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, *count as i32);
            }
        }
        // The figure.
        if f.body_light > 0.0 {
            scene(&self.body, 0.0);
            gl.uniform4fv_with_f32_array(self.body.at("u_b"), &cones);
            gl.draw_arrays(Gl::POINTS, 0, BODY_POINTS as i32);
        }
        // The lights, and the waist ring's beads.
        scene(&self.sprite, 2.0);
        gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, 8);
        if f.action.light > 0.0 {
            scene(&self.sprite, 4.0);
            gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, BEADS as i32);
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
