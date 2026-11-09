//! Browser adapter: WebGL2 objects and draw order. Every motion value comes
//! from the `Story`; the shaders trace the dawn from nothing but those
//! numbers. Three passes: the world (one ray a pixel, at a share of the
//! canvas), the lens (its blur, then its mips for the bloom), and the
//! finish, which the theme's recolor (scene-palette) maps before the warm
//! light is added back over it.
//!
//! The world is itself drawn in parts: one program finds what the eye's ray
//! meets and keeps it in float frames, then the sky and the fog, the towers
//! and the rope, him, the city under the fog, the air and his double each
//! add their light. One program for all of it takes Windows' shader compiler too
//! long; each part takes it a few seconds, and with
//! KHR_parallel_shader_compile the page keeps running while it works.
use crate::body::{
    BLEND, CAP, COLLAR, CUT_ROUND, FACE, HANDS, HEAD, NECK, PRIMITIVES, PROP, SCARF, SCARF_LINKS,
};
use crate::story::{HEART, SPHERE_Y, WIND};
use crate::{
    cones, look, pack, recolor_code, Chapter, Look, Story, BLOOM, BLUR_MAX, BYTE_KEEP, EXPOSURE,
    FOG_TOP, FRAME_ASPECT, HAZE, LOOP, LOT_X, LOT_Z, MIST, MIST_HEIGHT, POLE_R, RAD_SCALE, ROPE_R,
    ROPE_ROUND, ROPE_SAG, SLOTS, SLOT_SHADOW, SLOT_VIEW, SPAN, STREET, TOWER_X, TOWER_Z,
    WORLD_SCALE, WORLD_WIDTH,
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
const FINISH: &str = include_str!("shaders/finish.frag");
const WARM: &str = include_str!("shaders/warm.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];
/// Every uniform any program reads; a program without one ignores it.
const NAMES: [&str; 12] = [
    "u_d",
    "u_b",
    "u_res",
    "u_world",
    "u_dof",
    "u_out",
    "u_backdrop",
    "u_edges",
    "u_warm",
    "u_h0",
    "u_h1",
    "u_h2",
];
/// The texture units of the world's frame and the lens's.
const UNIT_WORLD: u32 = 0;
const UNIT_DOF: u32 = 1;
/// The first of the hit records' units; unit 3 is where frames are made.
const UNIT_HITS: u32 = 4;
/// The hit records: the eye's hit, its normal and the line's distance, the
/// line's normal.
const RECORDS: u32 = 3;
/// KHR_parallel_shader_compile's query: whether a program has linked yet.
const COMPLETION_STATUS: u32 = 0x91B1;
/// The world's parts, in the order they are linked.
const PASSES: [&str; 7] = ["HITS", "FOG", "SET", "FIGURE", "CITY", "AIR", "GHOST"];

/// lib.rs's constants as the shaders' `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let lines = [
        ("SLOTS", SLOTS.to_string()),
        ("SLOT_SHADOW", SLOT_SHADOW.to_string()),
        ("CONES", PRIMITIVES.to_string()),
        ("CONE_NECK", NECK.to_string()),
        ("CONE_HEAD", HEAD.to_string()),
        ("CONE_COLLAR", COLLAR.to_string()),
        ("CONE_FACE", FACE.to_string()),
        ("CONE_CAP", CAP.to_string()),
        ("CONE_SCARF", SCARF.to_string()),
        ("SCARF_LINKS", SCARF_LINKS.to_string()),
        ("CONE_PROP", PROP.to_string()),
        ("CONE_HAND_L", HANDS[0].to_string()),
        ("CONE_HAND_R", HANDS[1].to_string()),
        ("CUT_ROUND", f(CUT_ROUND)),
        (
            "BLENDS",
            BLEND.iter().map(|&b| f(b)).collect::<Vec<_>>().join(", "),
        ),
        ("SPAN", f(SPAN)),
        ("LOOP", f(LOOP)),
        ("TOWER_X", f(TOWER_X)),
        ("TOWER_Z", f(TOWER_Z)),
        ("ROPE_R", f(ROPE_R)),
        ("ROPE_SAG", f(ROPE_SAG)),
        ("ROPE_ROUND", f(ROPE_ROUND)),
        ("POLE_R", f(POLE_R)),
        ("FOG_TOP", f(FOG_TOP)),
        ("STREET", f(STREET)),
        ("LOT_X", f(LOT_X)),
        ("LOT_Z", f(LOT_Z)),
        ("BLUR_MAX", f(BLUR_MAX)),
        ("RAD_SCALE", f(RAD_SCALE)),
        ("BLOOM", f(BLOOM)),
        ("EXPOSURE", f(EXPOSURE)),
        ("HAZE", f(HAZE)),
        ("MIST", f(MIST)),
        ("MIST_HEIGHT", f(MIST_HEIGHT)),
        ("SPHERE_Y", f(SPHERE_Y)),
        ("WIND_X", f(WIND[0])),
        ("WIND_Z", f(WIND[1])),
        ("HEART", f(HEART)),
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

/// Hands the GPU a shader to compile; whether it compiled is asked once its
/// program has linked, so the compiles of every program can overlap.
fn shader(gl: &Gl, kind: u32, source: &str) -> Result<WebGlShader, JsValue> {
    let s = gl.create_shader(kind).ok_or("Cannot allocate shader")?;
    gl.shader_source(&s, source);
    gl.compile_shader(&s);
    Ok(s)
}

/// Why a shader step failed, never blank: when the GPU drops the context
/// mid-link the driver leaves no log at all.
fn failure(gl: &Gl, step: &str, log: &str) -> String {
    let log = log.trim();
    if !log.is_empty() {
        format!("{step} failed: {log}")
    } else if gl.is_context_lost() {
        format!("{step} failed: the GPU dropped the WebGL context")
    } else {
        format!("{step} failed without a log")
    }
}

struct Prog {
    program: WebGlProgram,
    uniforms: Vec<(&'static str, Option<WebGlUniformLocation>)>,
}

impl Prog {
    /// Links a program and waits for it.
    fn new(gl: &Gl, vertex: &str, frag: &str) -> Result<Self, JsValue> {
        Linking::start(gl, vertex, frag)?.finish(gl)
    }
    fn at(&self, name: &str) -> Option<&WebGlUniformLocation> {
        self.uniforms
            .iter()
            .find(|(n, _)| *n == name)
            .and_then(|(_, location)| location.as_ref())
    }
}

/// A program the GPU may still be compiling and linking.
struct Linking {
    program: WebGlProgram,
    shaders: [WebGlShader; 2],
}

impl Linking {
    fn start(gl: &Gl, vertex: &str, frag: &str) -> Result<Self, JsValue> {
        let shaders = [
            shader(gl, Gl::VERTEX_SHADER, vertex)?,
            shader(gl, Gl::FRAGMENT_SHADER, frag)?,
        ];
        let program = gl.create_program().ok_or("Cannot allocate program")?;
        for s in &shaders {
            gl.attach_shader(&program, s);
        }
        gl.link_program(&program);
        Ok(Self { program, shaders })
    }
    /// Whether asking about the link would not wait: always without
    /// KHR_parallel_shader_compile, where asking simply waits.
    fn done(&self, gl: &Gl, parallel: bool) -> bool {
        !parallel
            || gl
                .get_program_parameter(&self.program, COMPLETION_STATUS)
                .as_bool()
                .unwrap_or(true)
    }
    /// The linked program, its uniforms found and its samplers on their
    /// units; or why it failed, from the shader's log when one did not
    /// compile.
    fn finish(self, gl: &Gl) -> Result<Prog, JsValue> {
        let linked = gl
            .get_program_parameter(&self.program, Gl::LINK_STATUS)
            .as_bool()
            .unwrap_or(false);
        let error = (!linked).then(|| {
            let compile = self.shaders.iter().find_map(|s| {
                let ok = gl
                    .get_shader_parameter(s, Gl::COMPILE_STATUS)
                    .as_bool()
                    .unwrap_or(false);
                (!ok).then(|| gl.get_shader_info_log(s).unwrap_or_default())
            });
            match compile {
                Some(log) => failure(gl, "shader compile", &log),
                None => failure(
                    gl,
                    "shader link",
                    &gl.get_program_info_log(&self.program).unwrap_or_default(),
                ),
            }
        });
        for s in &self.shaders {
            gl.delete_shader(Some(s));
        }
        if let Some(error) = error {
            gl.delete_program(Some(&self.program));
            return Err(error.into());
        }
        let uniforms = NAMES
            .iter()
            .map(|name| (*name, gl.get_uniform_location(&self.program, name)))
            .collect();
        let prog = Prog {
            program: self.program,
            uniforms,
        };
        gl.use_program(Some(&prog.program));
        gl.uniform1i(prog.at("u_world"), UNIT_WORLD as i32);
        gl.uniform1i(prog.at("u_dof"), UNIT_DOF as i32);
        for (i, name) in ["u_h0", "u_h1", "u_h2"].iter().enumerate() {
            gl.uniform1i(prog.at(name), (UNIT_HITS + i as u32) as i32);
        }
        Ok(prog)
    }
    fn dispose(self, gl: &Gl) {
        for s in &self.shaders {
            gl.delete_shader(Some(s));
        }
        gl.delete_program(Some(&self.program));
    }
}

/// How the world is drawn.
enum World {
    /// The hits into the records, then the light in six parts.
    Passes {
        hits: Prog,
        fog: Prog,
        set: Prog,
        figure: Prog,
        city: Prog,
        air: Prog,
        ghost: Prog,
    },
    /// One program, for a GPU that cannot keep the hits in float frames.
    Whole(Prog),
}

impl World {
    fn programs(&self) -> Vec<&Prog> {
        match self {
            World::Passes {
                hits,
                fog,
                set,
                figure,
                city,
                air,
                ghost,
            } => vec![hits, fog, set, figure, city, air, ghost],
            World::Whole(all) => vec![all],
        }
    }
}

struct Programs {
    world: World,
    dof: Prog,
    finish: Prog,
    warm: Prog,
}

impl Programs {
    /// From the linked programs in the order `RopeDawn::new` started them.
    fn from_linked(mut linked: Vec<Prog>) -> Result<Self, JsValue> {
        let missing = |_| JsValue::from_str("A program is missing");
        let others = linked.split_off(linked.len().saturating_sub(3));
        let [dof, finish, warm]: [Prog; 3] = others.try_into().map_err(missing)?;
        let world = if linked.len() == PASSES.len() {
            let [hits, fog, set, figure, city, air, ghost]: [Prog; 7] =
                linked.try_into().map_err(missing)?;
            World::Passes {
                hits,
                fog,
                set,
                figure,
                city,
                air,
                ghost,
            }
        } else {
            let [all]: [Prog; 1] = linked.try_into().map_err(missing)?;
            World::Whole(all)
        };
        Ok(Self {
            world,
            dof,
            finish,
            warm,
        })
    }
    fn dispose(&self, gl: &Gl) {
        for p in self.world.programs() {
            gl.delete_program(Some(&p.program));
        }
        for p in [&self.dof, &self.finish, &self.warm] {
            gl.delete_program(Some(&p.program));
        }
    }
}

/// The world program for one part, or for all of it.
fn world_source(defines: &str, pass: &str) -> String {
    scene_source(&format!("{defines}#define PASS_{pass} 1\n"), WORLD_FRAG)
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

/// The hits pass's records: three frames of 32-bit floats, read texel by
/// texel, so a hit's distance keeps its centimetres at a hundred metres.
struct Records {
    framebuffer: WebGlFramebuffer,
    textures: Vec<WebGlTexture>,
    size: (i32, i32),
}

impl Records {
    fn new(gl: &Gl) -> Result<Self, JsValue> {
        Ok(Self {
            framebuffer: gl
                .create_framebuffer()
                .ok_or("Cannot allocate framebuffer")?,
            textures: Vec::new(),
            size: (0, 0),
        })
    }
    /// Returns whether the records can be drawn into.
    fn allocate(&mut self, gl: &Gl, width: i32, height: i32) -> Result<bool, JsValue> {
        for t in self.textures.drain(..) {
            gl.delete_texture(Some(&t));
        }
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&self.framebuffer));
        gl.active_texture(Gl::TEXTURE3);
        let buffers = js_sys::Array::new();
        for i in 0..RECORDS {
            let t = gl.create_texture().ok_or("Cannot allocate texture")?;
            gl.bind_texture(Gl::TEXTURE_2D, Some(&t));
            for (key, value) in [
                (Gl::TEXTURE_MIN_FILTER, Gl::NEAREST),
                (Gl::TEXTURE_MAG_FILTER, Gl::NEAREST),
                (Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE),
                (Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE),
            ] {
                gl.tex_parameteri(Gl::TEXTURE_2D, key, value as i32);
            }
            gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
                Gl::TEXTURE_2D,
                0,
                Gl::RGBA32F as i32,
                width,
                height,
                0,
                Gl::RGBA,
                Gl::FLOAT,
                None,
            )?;
            gl.framebuffer_texture_2d(
                Gl::FRAMEBUFFER,
                Gl::COLOR_ATTACHMENT0 + i,
                Gl::TEXTURE_2D,
                Some(&t),
                0,
            );
            buffers.push(&JsValue::from(Gl::COLOR_ATTACHMENT0 + i));
            self.textures.push(t);
        }
        gl.draw_buffers(&buffers);
        let complete = gl.check_framebuffer_status(Gl::FRAMEBUFFER) == Gl::FRAMEBUFFER_COMPLETE;
        gl.bind_texture(Gl::TEXTURE_2D, None);
        gl.active_texture(Gl::TEXTURE0);
        self.size = (width, height);
        Ok(complete)
    }
    fn ready(&self, width: i32, height: i32) -> bool {
        !self.textures.is_empty() && self.size == (width, height)
    }
    fn bind(&self, gl: &Gl) {
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&self.framebuffer));
        gl.viewport(0, 0, self.size.0, self.size.1);
    }
    fn read(&self, gl: &Gl) {
        for (i, t) in self.textures.iter().enumerate() {
            gl.active_texture(Gl::TEXTURE0 + UNIT_HITS + i as u32);
            gl.bind_texture(Gl::TEXTURE_2D, Some(t));
        }
    }
    fn dispose(&mut self, gl: &Gl) {
        for t in self.textures.drain(..) {
            gl.delete_texture(Some(&t));
        }
        gl.delete_framebuffer(Some(&self.framebuffer));
    }
}

#[wasm_bindgen]
pub struct RopeDawn {
    gl: Gl,
    canvas: HtmlCanvasElement,
    /// The programs once all of them have linked.
    programs: Option<Programs>,
    /// Until then, the ones the GPU is still working on.
    linking: Vec<Linking>,
    /// Whether the GPU says when a link is done without waiting for it.
    parallel: bool,
    /// Why the programs did not link.
    failed: Option<String>,
    defines: String,
    records: Records,
    /// Whether the world is drawn in parts, its hits kept in `records`.
    passes: bool,
    world_frame: Target,
    lens_frame: Target,
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
impl RopeDawn {
    /// Nothing to load: the sky, the fog, the towers and the walker are
    /// built on the GPU. The programs link in the background; `ready` says when the
    /// scene can draw, and frames before that draw nothing.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> Result<RopeDawn, JsValue> {
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
        let parallel = gl
            .get_extension("KHR_parallel_shader_compile")
            .ok()
            .flatten()
            .is_some();
        let defines = defines();
        let passes = float;
        let mut sources: Vec<(String, String)> = if passes {
            PASSES
                .iter()
                .map(|pass| (SCREEN.to_string(), world_source(&defines, pass)))
                .collect()
        } else {
            vec![(SCREEN.to_string(), world_source(&defines, "ALL"))]
        };
        sources.push((SCREEN.to_string(), scene_source(&defines, DOF_FRAG)));
        sources.push((SCREEN.to_string(), scene_source(&defines, FINISH)));
        sources.push((SCREEN.to_string(), scene_source(&defines, WARM)));
        let mut linking = Vec::with_capacity(sources.len());
        for (vertex, frag) in &sources {
            match Linking::start(&gl, vertex, frag) {
                Ok(l) => linking.push(l),
                Err(error) => {
                    for l in linking {
                        l.dispose(&gl);
                    }
                    return Err(error);
                }
            }
        }
        let themed = Themed::new(&gl, false)?;
        let empty = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        Ok(Self {
            world_frame: Target::new(&gl, true, false)?,
            lens_frame: Target::new(&gl, true, true)?,
            records: Records::new(&gl)?,
            gl,
            canvas,
            programs: None,
            linking,
            parallel,
            failed: None,
            defines,
            passes,
            float,
            empty,
            themed,
            look: look(4),
            story: Story::new(Chapter::Summary),
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
    /// Which page's loop to play: only page 09, so any code plays it.
    pub fn chapter(&mut self, _code: u32) {}
    /// Whether the programs have linked and the scene draws; it never
    /// waits where the GPU can say. An error says why they did not link.
    pub fn ready(&mut self) -> Result<bool, JsValue> {
        let was = self.programs.is_some();
        let now = self.poll()?;
        if now && !was {
            self.draw();
        }
        Ok(now)
    }
    pub fn loop_seconds(&self) -> f64 {
        f64::from(self.story.loop_seconds())
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
                self.elapsed = (self.elapsed + dt).rem_euclid(self.story.loop_seconds());
            }
        }
        self.last_time = Some(milliseconds);
        self.draw();
    }
    pub fn seek(&mut self, seconds: f64) {
        self.elapsed = if seconds.is_finite() {
            (seconds as f32).rem_euclid(self.story.loop_seconds())
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
    /// Reduced motion holds one moment: the sun out behind him on the rope
    /// and the light risen in him.
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
        self.records.dispose(gl);
        gl.delete_vertex_array(Some(&self.empty));
        for l in self.linking.drain(..) {
            l.dispose(gl);
        }
        if let Some(programs) = self.programs.take() {
            programs.dispose(gl);
        }
        self.themed.dispose(gl);
        self.disposed = true;
    }
}

impl RopeDawn {
    /// Finishes the programs once the GPU has linked every one of them.
    fn poll(&mut self) -> Result<bool, JsValue> {
        if self.programs.is_some() {
            return Ok(true);
        }
        if let Some(error) = &self.failed {
            return Err(error.as_str().into());
        }
        let gl = &self.gl;
        if gl.is_context_lost() || !self.linking.iter().all(|l| l.done(gl, self.parallel)) {
            return Ok(false);
        }
        let mut linked = Vec::with_capacity(self.linking.len());
        let mut error = None;
        for l in self.linking.drain(..) {
            match l.finish(gl) {
                Ok(p) => linked.push(p),
                Err(e) => {
                    error.get_or_insert(e);
                }
            }
        }
        let programs = match error {
            None => Programs::from_linked(linked),
            Some(e) => {
                for p in linked {
                    gl.delete_program(Some(&p.program));
                }
                Err(e)
            }
        };
        match programs {
            Ok(p) => {
                self.programs = Some(p);
                Ok(true)
            }
            Err(e) => {
                let why = e.as_string().unwrap_or_else(|| "shader link failed".into());
                self.failed = Some(why);
                Err(e)
            }
        }
    }

    /// Sizes the frames to the canvas; a GPU that cannot draw into half
    /// floats after all gets bytes, and one that cannot keep the hits in
    /// float frames draws the world in one program.
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
            ] {
                if !target.ready(tw, th, float) {
                    ok &= target.allocate(&self.gl, tw, th, float)?;
                }
            }
            if ok {
                if self.passes && !self.records.ready(world.0, world.1) {
                    self.passes = float && self.records.allocate(&self.gl, world.0, world.1)?;
                }
                if !self.passes || !float {
                    self.passes = false;
                    self.whole_world()?;
                }
                return Ok(world);
            }
            if !float {
                return Err("Cannot draw into the frames".into());
            }
            self.float = false;
        }
    }

    /// Swaps the world's parts for its one program, waiting for the link:
    /// only for a GPU that turned out unable to draw the records.
    fn whole_world(&mut self) -> Result<(), JsValue> {
        let Some(programs) = self.programs.as_mut() else {
            return Ok(());
        };
        if let World::Passes { .. } = programs.world {
            let all = Prog::new(&self.gl, SCREEN, &world_source(&self.defines, "ALL"))?;
            for p in programs.world.programs() {
                self.gl.delete_program(Some(&p.program));
            }
            programs.world = World::Whole(all);
        }
        Ok(())
    }

    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() || !matches!(self.poll(), Ok(true)) {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        let Ok((ww, wh)) = self.prepare(width, height) else {
            return;
        };
        let at = if self.reduced {
            Chapter::Summary.still()
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
        let cones = cones(&f);
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
        let Some(programs) = self.programs.as_ref() else {
            return;
        };
        let world = |p: &Prog| {
            scene(p, ww, wh, 0.0);
            gl.uniform4fv_with_f32_array(p.at("u_b"), &cones);
            gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        };
        match &programs.world {
            World::Passes {
                hits,
                fog,
                set,
                figure,
                city,
                air,
                ghost,
            } => {
                self.records.bind(gl);
                world(hits);
                // The sky and the fog also write the depth and the blur; the
                // others add their light over it.
                self.world_frame.bind(gl);
                self.records.read(gl);
                world(fog);
                gl.enable(Gl::BLEND);
                gl.blend_func(Gl::ONE, Gl::ONE);
                for p in [set, figure, city, air, ghost] {
                    world(p);
                }
                gl.disable(Gl::BLEND);
            }
            World::Whole(all) => {
                self.world_frame.bind(gl);
                world(all);
            }
        }

        // The lens's blur, then its mips for the bloom.
        self.lens_frame.bind(gl);
        self.world_frame.read(gl, UNIT_WORLD);
        scene(&programs.dof, ww, wh, 1.0);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        self.lens_frame.read(gl, UNIT_DOF);
        gl.generate_mipmap(Gl::TEXTURE_2D);

        // The finish, recolored by the theme.
        let offscreen = self.themed.begin(gl, width, height).unwrap_or(false);
        if !offscreen {
            gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        }
        gl.viewport(0, 0, width, height);
        let edges = self.soft_edges;
        scene(&programs.finish, width, height, 3.0);
        self.lens_frame.read(gl, UNIT_DOF);
        gl.uniform4f(
            programs.finish.at("u_out"),
            f32::from(!offscreen),
            f32::from(edges),
            0.0,
            EXPOSURE / keep,
        );
        gl.uniform3fv_with_f32_array(programs.finish.at("u_backdrop"), &self.backdrop);
        gl.uniform4fv_with_f32_array(programs.finish.at("u_edges"), &EDGES);
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
        scene(&programs.warm, width, height, 4.0);
        self.lens_frame.read(gl, UNIT_DOF);
        gl.uniform4f(
            programs.warm.at("u_out"),
            f32::from(self.look.soft),
            f32::from(edges),
            0.0,
            EXPOSURE / keep,
        );
        gl.uniform4fv_with_f32_array(programs.warm.at("u_edges"), &EDGES);
        gl.uniform3fv_with_f32_array(programs.warm.at("u_warm"), &self.look.warm);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.disable(Gl::BLEND);
        let units = [UNIT_WORLD, UNIT_DOF].into_iter();
        for unit in units.chain(UNIT_HITS..UNIT_HITS + RECORDS) {
            gl.active_texture(Gl::TEXTURE0 + unit);
            gl.bind_texture(Gl::TEXTURE_2D, None);
        }
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
