//! Browser adapter: WebGL2 objects and draw order. Every motion value comes
//! from the `Story`; the shaders trace the house and the day from nothing
//! but those numbers and the scene's data texture (lib.rs `Scene`: the
//! house's primitives, the moving ones and the people's cones). Three
//! passes: the world (one ray a pixel, at a share of the canvas), the lens
//! (its blur, then its mips for the bloom), and the finish, which the
//! theme's recolor (scene-palette) maps before the warm light is added back
//! over it.
//!
//! The world is itself drawn in parts: one program finds what the eye's ray
//! meets and keeps it in float frames, one lights it, one adds the light in
//! the air (the rings, the line of his day). One program for all of it takes
//! Windows' shader compiler too long; each part takes it a few seconds, and
//! with KHR_parallel_shader_compile the page keeps running while it works.
use crate::body::{BLEND, CAP, CUT_ROUND, FACE, FEET, HANDS, HEAD, LEGS, NECK, PRIMITIVES, TOES};
use crate::house::{self, cell, flag, kind, mat};
use crate::story::{BEADS, ROUTE};
use crate::{
    look, pack, recolor_code, Chapter, Look, Scene, Story, BLOOM, BLUR_MAX, BYTE_KEEP, DATA_W,
    DYN_ROWS, EXPOSURE, FIGS, FRAME_ASPECT, LAMPS, LOOP, PATH_POINTS, RAD_SCALE, SLOTS, SLOT_LAMPS,
    SLOT_PATH, SLOT_VIEW, WORLD_SCALE, WORLD_WIDTH,
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
const NAMES: [&str; 14] = [
    "u_d",
    "u_res",
    "u_world",
    "u_dof",
    "u_out",
    "u_backdrop",
    "u_edges",
    "u_warm",
    "u_h0",
    "u_shadow",
    "u_data",
    "u_c",
    "u_fig",
    "u_refl",
];
/// The texture units of the world's frame and the lens's.
const UNIT_WORLD: u32 = 0;
const UNIT_DOF: u32 = 1;
/// The first of the hit records' units; unit 3 is where frames are made.
const UNIT_HITS: u32 = 4;
/// The hit records: what the eye's ray met and its normal, in one frame
/// (Chrome on Windows builds a pass that writes several twice).
const RECORDS: u32 = 1;
/// Where the sun reaches.
const UNIT_SHADOW: u32 = 5;
// A record keeps the cell or the person in 5 bits.
const _: () = assert!(FIGS <= 32 && cell::COUNT <= 32);
/// The scene's data texture.
const UNIT_DATA: u32 = 7;
/// The table's reflection, which the lacquer reads.
const UNIT_REFL: u32 = 8;
/// `u_res.w` while the world is drawn from the eye mirrored under the
/// table (for its reflection).
const MIRROR: f32 = 5.0;
/// KHR_parallel_shader_compile's query: whether a program has linked yet.
const COMPLETION_STATUS: u32 = 0x91B1;
/// The world's parts, in the order they are linked.
const PASSES: [&str; 4] = ["HITS", "SHADOW", "LIGHT", "FX"];

/// The materials by the shaders' names.
const MATERIALS: [(&str, u32); 37] = [
    ("PLASTER", mat::PLASTER),
    ("TILE", mat::TILE),
    ("BOARDS", mat::BOARDS),
    ("WOOD", mat::WOOD),
    ("FABRIC", mat::FABRIC),
    ("METAL", mat::METAL),
    ("BRASS", mat::BRASS),
    ("LAMP", mat::LAMP),
    ("SCREEN", mat::SCREEN),
    ("PAPER", mat::PAPER),
    ("CERAMIC", mat::CERAMIC),
    ("PLANT", mat::PLANT),
    ("BREAD", mat::BREAD),
    ("GOODS", mat::GOODS),
    ("BOOKS", mat::BOOKS),
    ("BRICK", mat::BRICK),
    ("PAVING", mat::PAVING),
    ("RAIL", mat::RAIL),
    ("TRAM", mat::TRAM),
    ("PLINTH", mat::PLINTH),
    ("BACKDROP", mat::BACKDROP),
    ("ROOF", mat::ROOF),
    ("GRASS", mat::GRASS),
    ("RUG", mat::RUG),
    ("CANVAS", mat::CANVAS),
    ("FRAME", mat::FRAME),
    ("CLOTH", mat::CLOTH),
    ("CALENDAR", mat::CALENDAR),
    ("SIGN", mat::SIGN),
    ("DARK", mat::DARK),
    ("GLASS", mat::GLASS),
    ("BARK", mat::BARK),
    ("TOY", mat::TOY),
    ("FUR", mat::FUR),
    ("STONE", mat::STONE),
    ("FRIDGE", mat::FRIDGE),
    ("STREETLAMP", mat::STREETLAMP),
];

/// lib.rs's constants as the shaders' `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let u = |v: u32| v.to_string();
    let n = |v: usize| v.to_string();
    let lamps = (0..cell::COUNT)
        .map(|c| {
            let p = house::lamp_at(c);
            format!("vec3({:?}, {:?}, {:?})", p.x, p.y, p.z)
        })
        .collect::<Vec<_>>()
        .join(", ");
    let lines = [
        ("SLOTS", n(SLOTS)),
        ("SLOT_LAMPS", n(SLOT_LAMPS)),
        ("LAMP_SLOTS", n(LAMPS.div_ceil(4))),
        ("SLOT_PATH", n(SLOT_PATH)),
        ("PATH_POINTS", n(PATH_POINTS)),
        ("ROUTE", n(ROUTE)),
        ("BEADS", n(BEADS)),
        ("CELLS", n(cell::COUNT)),
        ("DATA_W", n(DATA_W)),
        ("FIGS", n(FIGS)),
        ("CONES", n(PRIMITIVES)),
        ("CONE_NECK", n(NECK)),
        ("CONE_HEAD", n(HEAD)),
        ("CONE_FACE", n(FACE)),
        ("CONE_CAP", n(CAP)),
        ("LEG_A", n(LEGS[0])),
        ("LEG_B", n(LEGS[1])),
        ("HAND_L", n(HANDS[0])),
        ("HAND_R", n(HANDS[1])),
        ("FOOT_L", n(FEET[0])),
        ("TOE_R", n(TOES[1])),
        ("CUT_ROUND", f(CUT_ROUND)),
        (
            "BLENDS",
            BLEND.iter().map(|&b| f(b)).collect::<Vec<_>>().join(", "),
        ),
        ("LAMP_LIST", lamps),
        ("KIND_BOX", u(kind::BOX)),
        ("KIND_CYL", u(kind::CYL)),
        ("KIND_BALL", u(kind::BALL)),
        ("KIND_TORUS", u(kind::TORUS)),
        ("KIND_CONE", u(kind::CONE)),
        ("KIND_STAIRS", u(kind::STAIRS)),
        ("KIND_SHELF", u(kind::SHELF)),
        ("KIND_CAGE", u(kind::CAGE)),
        ("KIND_LEAVES", u(kind::LEAVES)),
        ("KIND_WINDOW", u(kind::WINDOW)),
        ("F_WALL", u(flag::WALL)),
        ("F_SLAB", u(flag::SLAB)),
        ("F_FLAT", u(flag::FLAT)),
        ("F_GLOSS", u(flag::GLOSS)),
        ("F_NEAR", u(flag::NEAR)),
        ("STOREY", f(house::STOREY)),
        ("FLOORS", n(house::FLOORS)),
        ("SIDE_X", f(house::SIDE)),
        ("BACK_Z", f(house::BACK)),
        ("ROOF_Y", f(house::ROOF)),
        ("TABLE_Y", f(house::TABLE)),
        ("BACKDROP_HALF", f(house::BACKDROP_HALF)),
        ("BACKDROP_TOP", f(house::BACKDROP_TOP)),
        ("MIRROR", f(MIRROR)),
        ("TRACK_Z", f(house::TRACK_Z)),
        ("COL_1", f(house::COLUMNS[1][0])),
        ("COL_2", f(house::COLUMNS[2][0])),
        ("CELL_ROOF", n(cell::ROOF)),
        ("CELL_LIFT", n(cell::LIFT)),
        ("CELL_STREET_L", n(cell::STREET_L)),
        ("CELL_STREET_M", n(cell::STREET_M)),
        ("CELL_STREET_R", n(cell::STREET_R)),
        ("CELL_YARD", n(cell::YARD)),
        ("CELL_PLINTH", n(cell::PLINTH)),
        ("CELL_TRAM", n(cell::TRAM)),
        ("CELL_MOVE", n(cell::MOVE)),
        ("LOOP", f(LOOP)),
        ("BLUR_MAX", f(BLUR_MAX)),
        ("RAD_SCALE", f(RAD_SCALE)),
        ("BLOOM", f(BLOOM)),
        ("EXPOSURE", f(EXPOSURE)),
    ];
    let mut out: String = lines
        .iter()
        .map(|(name, value)| format!("#define {name} {value}\n"))
        .collect();
    for (name, code) in MATERIALS {
        out.push_str(&format!("#define M_{name} {code}\n"));
    }
    out
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
        gl.uniform1i(prog.at("u_h0"), UNIT_HITS as i32);
        gl.uniform1i(prog.at("u_shadow"), UNIT_SHADOW as i32);
        gl.uniform1i(prog.at("u_data"), UNIT_DATA as i32);
        gl.uniform1i(prog.at("u_refl"), UNIT_REFL as i32);
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
    /// The hits into the records, the sun's shadow, then their light,
    /// then the light in the air.
    Passes {
        hits: Prog,
        shadow: Prog,
        light: Prog,
        fx: Prog,
    },
    /// One program, for a GPU that cannot keep the hits in float frames.
    Whole(Prog),
}

impl World {
    fn programs(&self) -> Vec<&Prog> {
        match self {
            World::Passes {
                hits,
                shadow,
                light,
                fx,
            } => vec![hits, shadow, light, fx],
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
    /// From the linked programs in the order `DayHouse::new` started them.
    fn from_linked(mut linked: Vec<Prog>) -> Result<Self, JsValue> {
        let missing = |_| JsValue::from_str("A program is missing");
        let others = linked.split_off(linked.len().saturating_sub(3));
        let [dof, finish, warm]: [Prog; 3] = others.try_into().map_err(missing)?;
        let world = if linked.len() == PASSES.len() {
            let [hits, shadow, light, fx]: [Prog; 4] = linked.try_into().map_err(missing)?;
            World::Passes {
                hits,
                shadow,
                light,
                fx,
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

/// The scene's data texture: 32-bit float texels, `DATA_W` a row; the
/// still rows are written once, the moving ones every frame.
struct Data {
    texture: WebGlTexture,
    /// The first moving row.
    row: i32,
}

impl Data {
    fn new(gl: &Gl, scene: &Scene) -> Result<Self, JsValue> {
        let texture = gl.create_texture().ok_or("Cannot allocate texture")?;
        gl.active_texture(Gl::TEXTURE0 + UNIT_DATA);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&texture));
        for (key, value) in [
            (Gl::TEXTURE_MIN_FILTER, Gl::NEAREST),
            (Gl::TEXTURE_MAG_FILTER, Gl::NEAREST),
            (Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE),
            (Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE),
        ] {
            gl.tex_parameteri(Gl::TEXTURE_2D, key, value as i32);
        }
        let rows = scene.rows();
        let mut all = vec![0.0f32; 4 * DATA_W * rows];
        for (i, t) in scene.texels.iter().enumerate() {
            all[4 * i..4 * i + 4].copy_from_slice(t);
        }
        let view = js_sys::Float32Array::from(all.as_slice());
        gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_array_buffer_view(
            Gl::TEXTURE_2D,
            0,
            Gl::RGBA32F as i32,
            DATA_W as i32,
            rows as i32,
            0,
            Gl::RGBA,
            Gl::FLOAT,
            Some(&view),
        )?;
        gl.bind_texture(Gl::TEXTURE_2D, None);
        gl.active_texture(Gl::TEXTURE0);
        Ok(Self {
            texture,
            row: (scene.dynamic / DATA_W) as i32,
        })
    }
    /// This frame's moving rows.
    fn update(&self, gl: &Gl, moving: &[[f32; 4]]) {
        let flat: Vec<f32> = moving.iter().flatten().copied().collect();
        let view = js_sys::Float32Array::from(flat.as_slice());
        gl.active_texture(Gl::TEXTURE0 + UNIT_DATA);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&self.texture));
        // A failed upload leaves last frame's rows: nothing to report.
        let _ = gl.tex_sub_image_2d_with_i32_and_i32_and_u32_and_type_and_opt_array_buffer_view(
            Gl::TEXTURE_2D,
            0,
            0,
            self.row,
            DATA_W as i32,
            DYN_ROWS as i32,
            Gl::RGBA,
            Gl::FLOAT,
            Some(&view),
        );
    }
    fn dispose(&self, gl: &Gl) {
        gl.delete_texture(Some(&self.texture));
    }
}

#[wasm_bindgen]
pub struct DayHouse {
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
    /// Where the sun reaches, from the eye's hits.
    shadow_frame: Target,
    /// The table's reflection at half size: its hits, then its light.
    mirror_records: Records,
    mirror_frame: Target,
    lens_frame: Target,
    /// Whether the frames hold half floats.
    float: bool,
    empty: WebGlVertexArrayObject,
    themed: Themed,
    look: Look,
    story: Story,
    scene: Scene,
    data: Data,
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
impl DayHouse {
    /// Nothing to load: the house, its people and the sky are built here
    /// and on the GPU. The programs link in the background; `ready` says when the
    /// scene can draw, and frames before that draw nothing.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> Result<DayHouse, JsValue> {
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
        let scene = Scene::new();
        let data = Data::new(&gl, &scene)?;
        let themed = Themed::new(&gl, false)?;
        let empty = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        Ok(Self {
            world_frame: Target::new(&gl, true, false)?,
            lens_frame: Target::new(&gl, true, true)?,
            records: Records::new(&gl)?,
            shadow_frame: Target::new(&gl, false, false)?,
            mirror_records: Records::new(&gl)?,
            mirror_frame: Target::new(&gl, true, false)?,
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
            story: Story::new(Chapter::Everyday),
            scene,
            data,
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
    /// Which page's loop to play: only page 10, so any code plays it.
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
    /// Reduced motion holds one moment: the night house, the line of his
    /// day drawn through it, the three rings striking together round him.
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
        self.shadow_frame.dispose(gl);
        self.mirror_records.dispose(gl);
        self.mirror_frame.dispose(gl);
        self.data.dispose(gl);
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

impl DayHouse {
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
                    self.passes = float
                        && self.records.allocate(&self.gl, world.0, world.1)?
                        && self
                            .shadow_frame
                            .allocate(&self.gl, world.0, world.1, false)?;
                }
                let half = ((world.0 + 1) / 2, (world.1 + 1) / 2);
                if self.passes && !self.mirror_records.ready(half.0, half.1) {
                    self.passes = self.mirror_records.allocate(&self.gl, half.0, half.1)?
                        && self.mirror_frame.allocate(&self.gl, half.0, half.1, true)?;
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
            Chapter::Everyday.still()
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
        // The eye mirrored under the table: its reflection's camera.
        let mut mirrored = slots;
        mirrored[0][1] = 2.0 * house::TABLE - mirrored[0][1];
        for axis in &mut mirrored[1..4] {
            axis[1] = -axis[1];
        }
        let mirrored: Vec<f32> = mirrored.iter().flatten().copied().collect();
        let (moving, cells) = self.scene.moving(&f);
        let cells: Vec<f32> = cells.iter().flatten().copied().collect();
        let people: Vec<f32> = self.scene.people(&f).iter().flatten().copied().collect();
        self.data.update(&self.gl, &moving);
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
        gl.active_texture(Gl::TEXTURE0 + UNIT_DATA);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&self.data.texture));
        let world = |p: &Prog, eye: &[f32], (w, h): (i32, i32), kind: f32| {
            gl.use_program(Some(&p.program));
            gl.uniform4fv_with_f32_array(p.at("u_d"), eye);
            gl.uniform4f(p.at("u_res"), w as f32, h as f32, keep, kind);
            gl.uniform4fv_with_f32_array(p.at("u_c"), &cells);
            gl.uniform4fv_with_f32_array(p.at("u_fig"), &people);
            gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        };
        match &programs.world {
            World::Passes {
                hits,
                shadow,
                light,
                fx,
            } => {
                // The table's reflection first: the same passes from the
                // mirrored eye, at half size. Its light reads no reflection
                // and no shadow; the lens's frame only fills their units.
                let half = self.mirror_frame.size;
                self.mirror_records.bind(gl);
                world(hits, &mirrored, half, MIRROR);
                self.mirror_frame.bind(gl);
                self.mirror_records.read(gl);
                self.lens_frame.read(gl, UNIT_REFL);
                self.lens_frame.read(gl, UNIT_SHADOW);
                world(light, &mirrored, half, MIRROR);
                gl.enable(Gl::BLEND);
                gl.blend_func(Gl::ONE, Gl::ONE);
                world(fx, &mirrored, half, MIRROR);
                gl.disable(Gl::BLEND);
                // The eye's own: the light also writes the depth and the
                // blur; the light in the air is added over it.
                self.records.bind(gl);
                world(hits, &flat, (ww, wh), 0.0);
                self.shadow_frame.bind(gl);
                self.records.read(gl);
                world(shadow, &flat, (ww, wh), 0.0);
                self.world_frame.bind(gl);
                self.shadow_frame.read(gl, UNIT_SHADOW);
                self.mirror_frame.read(gl, UNIT_REFL);
                world(light, &flat, (ww, wh), 0.0);
                gl.enable(Gl::BLEND);
                gl.blend_func(Gl::ONE, Gl::ONE);
                world(fx, &flat, (ww, wh), 0.0);
                gl.disable(Gl::BLEND);
            }
            World::Whole(all) => {
                self.world_frame.bind(gl);
                world(all, &flat, (ww, wh), 0.0);
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
        let units = [UNIT_WORLD, UNIT_DOF, UNIT_DATA, UNIT_REFL, UNIT_SHADOW].into_iter();
        for unit in units.chain(UNIT_HITS..UNIT_HITS + RECORDS) {
            gl.active_texture(Gl::TEXTURE0 + unit);
            gl.bind_texture(Gl::TEXTURE_2D, None);
        }
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
