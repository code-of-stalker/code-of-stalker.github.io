//! Browser adapter: WebGL2 objects and draw order. Every motion value comes
//! from the chapter's `Story`; the shaders trace the street from nothing but
//! those numbers. Four passes: the world (one ray a pixel, at a share of the
//! canvas), the lens (its blur, then its mips for the bloom), the rain (sharp
//! streaks at the canvas's size), and the finish, which the theme's recolor
//! (scene-palette) maps before the warm light is added back over it.
use crate::body::{BLEND, PRIMITIVES};
use crate::story::PUFF_LIFE;
use crate::{
    look, pack, recolor_code, Chapter, Look, Story, AIR, BLOCK, BLOOM, BLUR_MAX, BYTE_KEEP, CARS,
    CAR_LANE, CAR_LIGHT, CELL, CROSS, CURB, EXPOSURE, FACADE, FRAME_ASPECT, HAZE, LAMP_GAP,
    LAMP_HEAD, LAMP_LIGHT, LAMP_POLE, LOOP, PALM_DROPS, PUFFS, RAD_SCALE, RAIN, RAIN_BOX,
    RAIN_FALL, RAIN_LIGHT, RAIN_STREAK, REPEAT, ROAD, SHOP_LIGHT, SLOTS, SLOT_PUFF, SLOT_STEP,
    SLOT_VIEW, SPLASH, STEP_MARKS, TOWER_CELL, WORLD_SCALE, WORLD_WIDTH,
};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Themed;
use web_sys::{
    HtmlCanvasElement, WebGl2RenderingContext as Gl, WebGlFramebuffer, WebGlProgram, WebGlShader,
    WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const COMMON: &str = include_str!("shaders/common.glsl");
const SCREEN: &str = include_str!("shaders/screen.vert");
const WORLD_FRAG: &str = include_str!("shaders/world.frag");
const DOF_FRAG: &str = include_str!("shaders/dof.frag");
const RAIN_VERT: &str = include_str!("shaders/rain.vert");
const RAIN_FRAG: &str = include_str!("shaders/rain.frag");
const FINISH: &str = include_str!("shaders/finish.frag");
const WARM: &str = include_str!("shaders/warm.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];
/// Every uniform any program reads; a program without one ignores it.
const NAMES: [&str; 10] = [
    "u_d",
    "u_b",
    "u_res",
    "u_world",
    "u_dof",
    "u_rain",
    "u_out",
    "u_backdrop",
    "u_edges",
    "u_warm",
];
/// The texture units of the world's frame, the lens's and the rain's.
const UNIT_WORLD: u32 = 0;
const UNIT_DOF: u32 = 1;
const UNIT_RAIN: u32 = 2;

/// lib.rs's constants as the shaders' `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let lines = [
        ("SLOTS", SLOTS.to_string()),
        ("SLOT_PUFF", SLOT_PUFF.to_string()),
        ("SLOT_STEP", SLOT_STEP.to_string()),
        ("PUFFS", PUFFS.to_string()),
        ("STEP_MARKS", STEP_MARKS.to_string()),
        ("CONES", PRIMITIVES.to_string()),
        (
            "BLENDS",
            BLEND.iter().map(|&b| f(b)).collect::<Vec<_>>().join(", "),
        ),
        ("ROAD", f(ROAD)),
        ("CURB", f(CURB)),
        ("FACADE", f(FACADE)),
        ("CELL", f(CELL)),
        ("CROSS", CROSS.to_string()),
        ("BLOCK", f(BLOCK)),
        ("TOWER_CELL", f(TOWER_CELL)),
        ("LAMP_GAP", f(LAMP_GAP)),
        ("LAMP_POLE", f(LAMP_POLE)),
        ("LAMP_HEAD_X", f(LAMP_HEAD[0])),
        ("LAMP_HEAD_Y", f(LAMP_HEAD[1])),
        ("LOOP", f(LOOP)),
        ("REPEAT", f(REPEAT)),
        ("RAIN", RAIN.to_string()),
        ("RAIN_BOX_X", f(RAIN_BOX[0])),
        ("RAIN_BOX_Y", f(RAIN_BOX[1])),
        ("RAIN_BOX_Z", f(RAIN_BOX[2])),
        ("RAIN_FALL", f(RAIN_FALL)),
        ("RAIN_STREAK", f(RAIN_STREAK)),
        ("RAIN_LIGHT", f(RAIN_LIGHT)),
        ("SPLASH", SPLASH.to_string()),
        ("PALM_DROPS", PALM_DROPS.to_string()),
        ("CAR_LANE", f(CAR_LANE)),
        ("CARS_0_COUNT", f(CARS[0][0])),
        ("CARS_0_REPEATS", f(CARS[0][1])),
        ("CARS_1_COUNT", f(CARS[1][0])),
        ("CARS_1_REPEATS", f(CARS[1][1])),
        ("BLUR_MAX", f(BLUR_MAX)),
        ("RAD_SCALE", f(RAD_SCALE)),
        ("BLOOM", f(BLOOM)),
        ("LAMP_LIGHT", f(LAMP_LIGHT)),
        ("SHOP_LIGHT", f(SHOP_LIGHT)),
        ("CAR_LIGHT", f(CAR_LIGHT)),
        ("AIR", f(AIR)),
        ("HAZE", f(HAZE)),
        ("PUFF_LIFE", f(PUFF_LIFE)),
    ];
    lines
        .iter()
        .map(|(name, value)| format!("#define {name} {value}\n"))
        .collect()
}

/// A shader that shares the scene's camera, slots, plan and hash.
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
        gl.use_program(Some(&prog.program));
        gl.uniform1i(prog.at("u_world"), UNIT_WORLD as i32);
        gl.uniform1i(prog.at("u_dof"), UNIT_DOF as i32);
        gl.uniform1i(prog.at("u_rain"), UNIT_RAIN as i32);
        Ok(prog)
    }
    fn at(&self, name: &str) -> Option<&WebGlUniformLocation> {
        self.uniforms
            .iter()
            .find(|(n, _)| *n == name)
            .and_then(|(_, location)| location.as_ref())
    }
}

/// A frame one pass draws and the next reads: half floats where the GPU can
/// draw into them, else bytes holding `BYTE_KEEP` of the light.
struct Target {
    framebuffer: WebGlFramebuffer,
    texture: Option<WebGlTexture>,
    size: (i32, i32),
    float: bool,
    /// Linear reads, and for the lens's frame mips for the bloom.
    linear: bool,
    mips: bool,
}

impl Target {
    fn new(gl: &Gl, linear: bool, mips: bool) -> Result<Self, JsValue> {
        Ok(Self {
            framebuffer: gl
                .create_framebuffer()
                .ok_or("Cannot allocate framebuffer")?,
            texture: None,
            size: (0, 0),
            float: true,
            linear,
            mips,
        })
    }
    /// Returns whether the frame can be drawn into.
    fn allocate(&mut self, gl: &Gl, width: i32, height: i32, float: bool) -> Result<bool, JsValue> {
        let t = gl.create_texture().ok_or("Cannot allocate texture")?;
        gl.active_texture(Gl::TEXTURE3);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&t));
        let (min, mag) = match (self.linear, self.mips) {
            (_, true) => (Gl::LINEAR_MIPMAP_LINEAR, Gl::LINEAR),
            (true, false) => (Gl::LINEAR, Gl::LINEAR),
            (false, false) => (Gl::NEAREST, Gl::NEAREST),
        };
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MIN_FILTER, min as i32);
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MAG_FILTER, mag as i32);
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE as i32);
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE as i32);
        let (internal, kind) = if float {
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
        let complete = gl.check_framebuffer_status(Gl::FRAMEBUFFER) == Gl::FRAMEBUFFER_COMPLETE;
        gl.bind_texture(Gl::TEXTURE_2D, None);
        gl.active_texture(Gl::TEXTURE0);
        if let Some(old) = self.texture.replace(t) {
            gl.delete_texture(Some(&old));
        }
        self.size = (width, height);
        self.float = float;
        Ok(complete)
    }
    fn ready(&self, width: i32, height: i32, float: bool) -> bool {
        self.texture.is_some() && self.size == (width, height) && self.float == float
    }
    fn bind(&self, gl: &Gl) {
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&self.framebuffer));
        gl.viewport(0, 0, self.size.0, self.size.1);
    }
    fn read(&self, gl: &Gl, unit: u32) {
        gl.active_texture(Gl::TEXTURE0 + unit);
        gl.bind_texture(Gl::TEXTURE_2D, self.texture.as_ref());
    }
    fn dispose(&mut self, gl: &Gl) {
        if let Some(t) = self.texture.take() {
            gl.delete_texture(Some(&t));
        }
        gl.delete_framebuffer(Some(&self.framebuffer));
    }
}

#[wasm_bindgen]
pub struct NightCity {
    gl: Gl,
    canvas: HtmlCanvasElement,
    world: Prog,
    dof: Prog,
    rain: Prog,
    finish: Prog,
    warm: Prog,
    world_frame: Target,
    lens_frame: Target,
    rain_frame: Target,
    /// Whether the frames hold half floats.
    float: bool,
    empty: WebGlVertexArrayObject,
    themed: Themed,
    look: Look,
    story: Story,
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
impl NightCity {
    /// Nothing to load: the street, the walker and the rain are built on the
    /// GPU.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> Result<NightCity, JsValue> {
        let options = js_sys::Object::new();
        js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"antialias".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &false.into())?;
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 unavailable")?
            .dyn_into()?;
        let float = gl
            .get_extension("EXT_color_buffer_float")
            .ok()
            .flatten()
            .is_some();
        let defines = defines();
        let world = Prog::new(&gl, SCREEN, &scene_source(&defines, WORLD_FRAG))?;
        let dof = Prog::new(&gl, SCREEN, &scene_source(&defines, DOF_FRAG))?;
        let rain = Prog::new(
            &gl,
            &scene_source(&defines, RAIN_VERT),
            &scene_source(&defines, RAIN_FRAG),
        )?;
        let finish = Prog::new(&gl, SCREEN, &scene_source(&defines, FINISH))?;
        let warm = Prog::new(&gl, SCREEN, &scene_source(&defines, WARM))?;
        let themed = Themed::new(&gl, false)?;
        let empty = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        Ok(Self {
            world_frame: Target::new(&gl, true, false)?,
            lens_frame: Target::new(&gl, true, true)?,
            rain_frame: Target::new(&gl, false, false)?,
            gl,
            canvas,
            world,
            dof,
            rain,
            finish,
            warm,
            float,
            empty,
            themed,
            look: look(4),
            story: Story::new(Chapter::Fact),
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
    /// Which page's loop to play: 0 page 06.
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
    /// Reduced motion holds one moment: over his shoulder, mid-step.
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
    /// The app theme by its `graphicsPalette` code; the retired light codes
    /// play as Матрица.
    pub fn palette(&mut self, code: u32) {
        let code = recolor_code(code);
        let next = look(code);
        let changed = self.themed.set(code);
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
        self.world_frame.dispose(gl);
        self.lens_frame.dispose(gl);
        self.rain_frame.dispose(gl);
        gl.delete_vertex_array(Some(&self.empty));
        for p in [&self.world, &self.dof, &self.rain, &self.finish, &self.warm] {
            gl.delete_program(Some(&p.program));
        }
        self.themed.dispose(gl);
        self.disposed = true;
    }
}

impl NightCity {
    /// Sizes the three frames to the canvas; a GPU that cannot draw into
    /// half floats after all gets bytes.
    fn prepare(&mut self, width: i32, height: i32) -> Result<(i32, i32), JsValue> {
        let w = (width as f32 * WORLD_SCALE).clamp(2.0, WORLD_WIDTH);
        let world = (
            w.round() as i32,
            (w * height as f32 / width as f32).round().max(2.0) as i32,
        );
        loop {
            let float = self.float;
            let mut ok = true;
            for (target, (tw, th)) in [
                (&mut self.world_frame, world),
                (&mut self.lens_frame, world),
                (&mut self.rain_frame, (width, height)),
            ] {
                if !target.ready(tw, th, float) {
                    ok &= target.allocate(&self.gl, tw, th, float)?;
                }
            }
            if ok {
                return Ok(world);
            }
            if !float {
                return Err("Cannot draw into the frames".into());
            }
            self.float = false;
        }
    }

    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        let Ok((ww, wh)) = self.prepare(width, height) else {
            return;
        };
        let at = if self.reduced {
            self.story.chapter.still()
        } else {
            self.elapsed
        };
        let f = self.story.compose(at);
        let mut slots = pack(&f);
        // The whole 3:2 frame stays in view on a canvas of any shape.
        let aspect = width as f32 / height as f32;
        slots[SLOT_VIEW] = [
            f.lens / aspect.max(FRAME_ASPECT),
            f.lens * aspect.min(FRAME_ASPECT) / FRAME_ASPECT,
            0.0,
            0.0,
        ];
        let flat: Vec<f32> = slots.iter().flatten().copied().collect();
        let cones: Vec<f32> = f.body.cones.iter().flatten().copied().collect();
        let keep = if self.float { 1.0 } else { BYTE_KEEP };
        let gl = &self.gl;
        gl.bind_vertex_array(Some(&self.empty));
        let scene = |p: &Prog, w: i32, h: i32, kind: f32| {
            gl.use_program(Some(&p.program));
            gl.uniform4fv_with_f32_array(p.at("u_d"), &flat);
            gl.uniform4f(p.at("u_res"), w as f32, h as f32, keep, kind);
        };
        gl.disable(Gl::BLEND);

        // The world: one ray a pixel.
        self.world_frame.bind(gl);
        scene(&self.world, ww, wh, 0.0);
        gl.uniform4fv_with_f32_array(self.world.at("u_b"), &cones);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);

        // The lens's blur, then its mips for the bloom.
        self.lens_frame.bind(gl);
        self.world_frame.read(gl, UNIT_WORLD);
        scene(&self.dof, ww, wh, 1.0);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        self.lens_frame.read(gl, UNIT_DOF);
        gl.generate_mipmap(Gl::TEXTURE_2D);

        // The rain, sharp at the canvas's size, behind what the world drew
        // nearer.
        self.rain_frame.bind(gl);
        gl.clear_color(0.0, 0.0, 0.0, 0.0);
        gl.clear(Gl::COLOR_BUFFER_BIT);
        gl.enable(Gl::BLEND);
        gl.blend_func(Gl::ONE, Gl::ONE);
        scene(&self.rain, width, height, 2.0);
        gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, (RAIN + SPLASH + PALM_DROPS) as i32);
        gl.disable(Gl::BLEND);
        self.rain_frame.read(gl, UNIT_RAIN);

        // The finish, recolored by the theme.
        let offscreen = self.themed.begin(gl, width, height).unwrap_or(false);
        if !offscreen {
            gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        }
        gl.viewport(0, 0, width, height);
        let edges = self.soft_edges;
        scene(&self.finish, width, height, 3.0);
        self.lens_frame.read(gl, UNIT_DOF);
        self.rain_frame.read(gl, UNIT_RAIN);
        gl.uniform4f(
            self.finish.at("u_out"),
            f32::from(!offscreen),
            f32::from(edges),
            0.0,
            EXPOSURE / keep,
        );
        gl.uniform3fv_with_f32_array(self.finish.at("u_backdrop"), &self.backdrop);
        gl.uniform4fv_with_f32_array(self.finish.at("u_edges"), &EDGES);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        if offscreen {
            self.themed
                .present(gl, self.backdrop, edges.then_some(EDGES));
        }

        // The warm light, added back over the recolored frame.
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        gl.viewport(0, 0, width, height);
        gl.enable(Gl::BLEND);
        gl.blend_func(Gl::ONE, Gl::ONE);
        gl.bind_vertex_array(Some(&self.empty));
        scene(&self.warm, width, height, 4.0);
        self.lens_frame.read(gl, UNIT_DOF);
        self.rain_frame.read(gl, UNIT_RAIN);
        gl.uniform4f(
            self.warm.at("u_out"),
            f32::from(self.look.soft),
            f32::from(edges),
            0.0,
            EXPOSURE / keep,
        );
        gl.uniform4fv_with_f32_array(self.warm.at("u_edges"), &EDGES);
        gl.uniform3fv_with_f32_array(self.warm.at("u_warm"), &self.look.warm);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.disable(Gl::BLEND);
        for unit in [UNIT_WORLD, UNIT_DOF, UNIT_RAIN] {
            gl.active_texture(Gl::TEXTURE0 + unit);
            gl.bind_texture(Gl::TEXTURE_2D, None);
        }
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
