//! Browser adapter: WebGL2 objects and draw order. Every motion value comes
//! from the chapter's `Story`; the shaders build the figure, the rings, the
//! floor and the motes from nothing but their instance numbers, all added
//! into one frame, and the theme's recolor (scene-palette) maps the
//! finished frame.
use crate::body::{BLEND, PRIMITIVES};
use crate::{
    cone_points, look, pack, Chapter, Look, Story, ATMOSPHERE_LIGHT, BEADS, BEAD_LIGHT, BODY_DOT,
    BODY_LIGHT, BODY_POINTS, BODY_SIZE, BOX_HALF, BRANCHES, BRANCH_DEPTH, BRANCH_LIGHT,
    BRANCH_SEGMENTS, BRANCH_SHRINK, CASTERS, COLUMNS, COLUMN_DOTS, COLUMN_GAP, COLUMN_LIGHT,
    CONSTELLATIONS, CONSTELLATION_LIGHT, CONSTELLATION_STARS, CONTACT_LIGHT, CROWN_GAP,
    CROWN_LIGHT, CUP, DEBRIS, DEBRIS_FADE, DEBRIS_LIGHT, DESK_AHEAD, DESK_HALF, DESK_LEGS,
    DESK_LIGHT, DESK_LINES, DESK_PIECES, DESK_SLAB, DESK_TOP, ENGRAVE_GAMMA, ENGRAVE_WHITE, EVENTS,
    FACT_LIGHT, FLASH_GAIN, FLOOR_CELL, FLOOR_GRID, FLOOR_LIGHT, FLOOR_POOL, FOCAL, FRAME_ASPECT,
    GHOSTS, GHOST_LIGHT, GHOST_SEGMENTS, GLASS_FOG, GLYPHS, GLYPH_COLUMNS, GLYPH_ROWS, HALO,
    HALO_SPREAD, INNER_LINE_LIGHT, KEY_COLUMNS, KEY_ROWS, LAMP_AIR, LAMP_BODY, LAMP_CORE,
    LAMP_DUST, LAMP_FLAT, LAMP_FLOOR, LAMP_GLASS, LAMP_GLINT, LAMP_GROUND, LAMP_HALO, LAMP_MIST,
    LAMP_PRINT, LAMP_REACH, LAMP_SIZE, LAPTOP_FRONT, LAPTOP_HALF, LAPTOP_TOP, LID_HEIGHT,
    LID_HINGE, LID_OPEN, LINE_WIDTH, MELT_BAND, MID_AT, MOTES, MOTE_LIGHT, MOTE_SPAN, NEBULA_LIGHT,
    OTHER_LIGHT, PHONE, PLANET_CELL, PLANET_LIGHT, PLANET_RADIUS, PLANET_REACH, PRINTS, PRINT_FADE,
    PRINT_LIGHT, PRINT_SEGMENTS, PROP_LIGHT, PROP_LINES, PULL_NEAR, PULL_STRETCH, RING_SEGMENTS,
    RIPPLE_LIGHT, RIPPLE_REACH, RIPPLE_SECONDS, RIPPLE_SEGMENTS, SCAN_LIGHT, SCAN_WIDTH, SEATS,
    SEAT_HALF, SEAT_LEVELS, SEAT_LIGHT, SEAT_PIECES, SEAT_TOP, SHELL, SHELL_GRID, SHELL_LATENT,
    SHELL_LIGHT, SHELL_WAVE, SLICE, SLICE_GLOW, SLICE_LIGHT, SLOTS, SLOT_CASTER, SLOT_DESK,
    SLOT_FEET, SLOT_GHOST, SLOT_INNER, SLOT_LAMP, SLOT_META, SLOT_PRINT, SLOT_PROP, SLOT_RING,
    SLOT_SEAT, SLOT_TENTACLE, SLOT_THING, SLOT_VIEW, SLOT_VOICE, SLOT_WORLD, SPIN_LIGHT, SPIN_STEP,
    SPIN_TRAIL, SPIRES, SPIRE_LIGHT, SPIRE_PIECES, SPOKES, SPOKE_BEADS, SPOKE_LIGHT, STARS,
    STAR_LIGHT, SWEEP, TENTACLES, TENTACLE_BREAK, TENTACLE_LIGHT, TENTACLE_SEGMENTS,
    TENTACLE_STRANDS, THINGS, THING_LIGHT, THING_PIECES, THING_RING, UNSCANNED, VOICES,
    VOICE_LIGHT, VOICE_SEGMENTS, WAVE_GAIN, WRITHE, WRITHE_REACH,
};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Themed;
use watcher_scene_palette::Warm;
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
const WORLD_FRAG: &str = include_str!("shaders/world.frag");
const SCREEN: &str = include_str!("shaders/screen.vert");
const FINISH: &str = include_str!("shaders/finish.frag");
const WARM: &str = include_str!("shaders/warm.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];
/// Every uniform any program reads; a program without one ignores it.
const NAMES: [&str; 12] = [
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
    "u_warm",
];

/// lib.rs's constants as the shaders' `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let n = |v: u32| v.to_string();
    let mut lines = vec![
        ("SLOTS", SLOTS.to_string()),
        ("SLOT_RING", SLOT_RING.to_string()),
        ("SLOT_WORLD", SLOT_WORLD.to_string()),
        ("SLOT_GHOST", SLOT_GHOST.to_string()),
        ("SLOT_PRINT", SLOT_PRINT.to_string()),
        ("SLOT_FEET", SLOT_FEET.to_string()),
        ("SLOT_TENTACLE", SLOT_TENTACLE.to_string()),
        ("SLOT_META", SLOT_META.to_string()),
        ("SLOT_THING", SLOT_THING.to_string()),
        ("SLOT_SEAT", SLOT_SEAT.to_string()),
        ("SEAT_TOP", f(SEAT_TOP)),
        ("SEAT_HALF_X", f(SEAT_HALF[0])),
        ("SEAT_HALF_Z", f(SEAT_HALF[1])),
        ("SEAT_LEVELS", n(SEAT_LEVELS)),
        ("SEAT_PIECES", n(SEAT_PIECES)),
        ("SEAT_LIGHT", f(SEAT_LIGHT)),
        ("SLOT_VOICE", SLOT_VOICE.to_string()),
        ("SLOT_DESK", SLOT_DESK.to_string()),
        ("VOICE_SEGMENTS", n(VOICE_SEGMENTS)),
        ("VOICE_LIGHT", f(VOICE_LIGHT)),
        ("DESK_AHEAD", f(DESK_AHEAD)),
        ("DESK_HALF_X", f(DESK_HALF[0])),
        ("DESK_HALF_Z", f(DESK_HALF[1])),
        ("DESK_TOP", f(DESK_TOP)),
        ("DESK_SLAB", f(DESK_SLAB)),
        ("DESK_LEGS_X", f(DESK_LEGS[0])),
        ("DESK_LEGS_Z", f(DESK_LEGS[1])),
        ("DESK_PIECES", n(DESK_PIECES)),
        ("DESK_LINES", n(DESK_LINES)),
        ("DESK_LIGHT", f(DESK_LIGHT)),
        ("LAPTOP_HALF", f(LAPTOP_HALF)),
        ("LAPTOP_TOP", f(LAPTOP_TOP)),
        ("LAPTOP_FRONT", f(LAPTOP_FRONT)),
        ("LID_HINGE", f(LID_HINGE)),
        ("LID_HEIGHT", f(LID_HEIGHT)),
        ("LID_OPEN", f(LID_OPEN)),
        ("GLYPH_COLUMNS", n(GLYPH_COLUMNS)),
        ("GLYPH_ROWS", n(GLYPH_ROWS)),
        ("GLYPHS", n(GLYPHS)),
        ("KEY_COLUMNS", n(KEY_COLUMNS)),
        ("KEY_ROWS", n(KEY_ROWS)),
        ("PRINTS", PRINTS.to_string()),
        ("TENTACLES", TENTACLES.to_string()),
        ("CONES", PRIMITIVES.to_string()),
        ("RING_SEGMENTS", n(RING_SEGMENTS)),
        ("BEADS", n(BEADS)),
        ("GHOST_SEGMENTS", n(GHOST_SEGMENTS)),
        ("SPOKES", n(SPOKES)),
        ("SPOKE_BEADS", n(SPOKE_BEADS)),
        ("SPIN_TRAIL", n(SPIN_TRAIL)),
        ("TENTACLE_STRANDS", n(TENTACLE_STRANDS)),
        ("TENTACLE_SEGMENTS", n(TENTACLE_SEGMENTS)),
        ("DEBRIS", n(DEBRIS)),
        ("THING_PIECES", n(THING_PIECES)),
        ("THING_RING", n(THING_RING)),
        ("SPIRE_PIECES", n(SPIRE_PIECES)),
        ("PRINT_SEGMENTS", n(PRINT_SEGMENTS)),
        ("RIPPLE_SEGMENTS", n(RIPPLE_SEGMENTS)),
        ("FLOOR_GRID", n(FLOOR_GRID)),
        ("STARS", n(STARS)),
        ("CONSTELLATION_STARS", n(CONSTELLATION_STARS)),
        ("COLUMN_DOTS", n(COLUMN_DOTS)),
        ("SWEEP", f(SWEEP)),
        ("SPIN_STEP", f(SPIN_STEP)),
        ("SLICE", f(SLICE)),
        ("SLICE_GLOW", f(SLICE_GLOW)),
        ("UNSCANNED", f(UNSCANNED)),
        ("TENTACLE_BREAK", f(TENTACLE_BREAK)),
        ("DEBRIS_FADE", f(DEBRIS_FADE)),
        ("WRITHE", f(WRITHE)),
        ("WRITHE_REACH", f(WRITHE_REACH)),
        ("LINE_WIDTH", f(LINE_WIDTH)),
        ("HALO", f(HALO)),
        ("HALO_SPREAD", f(HALO_SPREAD)),
        ("SHELL", f(SHELL)),
        ("SHELL_LIGHT", f(SHELL_LIGHT)),
        ("SHELL_GRID", f(SHELL_GRID)),
        ("SHELL_LATENT", f(SHELL_LATENT)),
        ("SHELL_WAVE", f(SHELL_WAVE)),
        ("GLASS_FOG", f(GLASS_FOG)),
        ("PLANET_RADIUS", f(PLANET_RADIUS)),
        ("PLANET_CELL", f(PLANET_CELL)),
        ("PLANET_REACH", f(PLANET_REACH)),
        ("CROWN_GAP", f(CROWN_GAP)),
        ("SCAN_WIDTH", f(SCAN_WIDTH)),
        ("PRINT_FADE", f(PRINT_FADE)),
        ("RIPPLE_SECONDS", f(RIPPLE_SECONDS)),
        ("RIPPLE_REACH", f(RIPPLE_REACH)),
        ("FLOOR_CELL", f(FLOOR_CELL)),
        ("FLOOR_POOL", f(FLOOR_POOL)),
        ("COLUMN_GAP", f(COLUMN_GAP)),
        ("BODY_SIZE", f(BODY_SIZE)),
        ("BODY_DOT", f(BODY_DOT)),
        ("CROWN_LIGHT", f(CROWN_LIGHT)),
        ("BEAD_LIGHT", f(BEAD_LIGHT)),
        ("INNER_LINE_LIGHT", f(INNER_LINE_LIGHT)),
        ("SPIN_LIGHT", f(SPIN_LIGHT)),
        ("SLICE_LIGHT", f(SLICE_LIGHT)),
        ("CONTACT_LIGHT", f(CONTACT_LIGHT)),
        ("GHOST_LIGHT", f(GHOST_LIGHT)),
        ("SPOKE_LIGHT", f(SPOKE_LIGHT)),
        ("THING_LIGHT", f(THING_LIGHT)),
        ("TENTACLE_LIGHT", f(TENTACLE_LIGHT)),
        ("DEBRIS_LIGHT", f(DEBRIS_LIGHT)),
        ("SPIRE_LIGHT", f(SPIRE_LIGHT)),
        ("SCAN_LIGHT", f(SCAN_LIGHT)),
        ("PRINT_LIGHT", f(PRINT_LIGHT)),
        ("RIPPLE_LIGHT", f(RIPPLE_LIGHT)),
        ("FLOOR_LIGHT", f(FLOOR_LIGHT)),
        ("PLANET_LIGHT", f(PLANET_LIGHT)),
        ("ATMOSPHERE_LIGHT", f(ATMOSPHERE_LIGHT)),
        ("NEBULA_LIGHT", f(NEBULA_LIGHT)),
        ("MOTE_LIGHT", f(MOTE_LIGHT)),
        ("STAR_LIGHT", f(STAR_LIGHT)),
        ("CONSTELLATION_LIGHT", f(CONSTELLATION_LIGHT)),
        ("COLUMN_LIGHT", f(COLUMN_LIGHT)),
        ("BODY_LIGHT", f(BODY_LIGHT)),
        ("FLASH_GAIN", f(FLASH_GAIN)),
        ("WAVE_GAIN", f(WAVE_GAIN)),
        ("MOTE_SPAN_X", f(MOTE_SPAN[0])),
        ("MOTE_SPAN_Y", f(MOTE_SPAN[1])),
        ("SLOT_LAMP", SLOT_LAMP.to_string()),
        ("SLOT_CASTER", SLOT_CASTER.to_string()),
        ("SLOT_INNER", SLOT_INNER.to_string()),
        ("EVENTS", EVENTS.to_string()),
        ("BRANCHES", BRANCHES.to_string()),
        ("BRANCH_DEPTH", BRANCH_DEPTH.to_string()),
        ("BRANCH_SEGMENTS", BRANCH_SEGMENTS.to_string()),
        ("BRANCH_SHRINK", f(BRANCH_SHRINK)),
        ("BRANCH_LIGHT", f(BRANCH_LIGHT)),
        ("FACT_LIGHT", f(FACT_LIGHT)),
        ("PULL_NEAR", f(PULL_NEAR)),
        ("PULL_STRETCH", f(PULL_STRETCH)),
        ("MELT_BAND", f(MELT_BAND)),
        ("SLOT_PROP", SLOT_PROP.to_string()),
        ("PROP_LIGHT", f(PROP_LIGHT)),
        ("CUP_TOP", f(CUP[0])),
        ("CUP_FOOT", f(CUP[1])),
        ("CUP_HALF", f(CUP[2])),
        ("PHONE_X", f(PHONE[0])),
        ("PHONE_Y", f(PHONE[1])),
        ("PHONE_Z", f(PHONE[2])),
        ("BOX_HALF", f(BOX_HALF)),
        ("CASTERS", CASTERS.to_string()),
        ("LAMP_REACH", f(LAMP_REACH)),
        ("LAMP_SIZE", f(LAMP_SIZE)),
        ("LAMP_FLAT", f(LAMP_FLAT)),
        ("LAMP_MIST", f(LAMP_MIST)),
        ("LAMP_GROUND", f(LAMP_GROUND)),
        ("LAMP_FLOOR", f(LAMP_FLOOR)),
        ("LAMP_PRINT", f(LAMP_PRINT)),
        ("LAMP_GLASS", f(LAMP_GLASS)),
        ("LAMP_GLINT", f(LAMP_GLINT)),
        ("LAMP_BODY", f(LAMP_BODY)),
        ("LAMP_DUST", f(LAMP_DUST)),
        ("LAMP_AIR", f(LAMP_AIR)),
        ("LAMP_CORE", f(LAMP_CORE)),
        ("LAMP_HALO", f(LAMP_HALO)),
    ];
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
    let defines = defines();
    let source = |body| scene_source(&defines, body);
    let programs = [
        (SCREEN.into(), source(WORLD_FRAG)),
        (source(LINE_VERT), source(LINE_FRAG)),
        (source(SPRITE_VERT), source(SPRITE_FRAG)),
        (source(BODY_VERT), source(BODY_FRAG)),
        (SCREEN.into(), FINISH.into()),
        (SCREEN.into(), WARM.into()),
        (
            watcher_scene_palette::VERTEX.into(),
            watcher_scene_palette::FRAGMENT.into(),
        ),
    ];
    Ok(Warm::start(&context(canvas)?, &programs))
}

#[wasm_bindgen]
pub struct DynamicRings {
    gl: Gl,
    canvas: HtmlCanvasElement,
    world: Prog,
    line: Prog,
    sprite: Prog,
    body: Prog,
    finish: Prog,
    warm: Prog,
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
        let gl: Gl = context(&canvas)?;
        let defines = defines();
        let world = Prog::new(&gl, SCREEN, &scene_source(&defines, WORLD_FRAG))?;
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
        let warm = Prog::new(&gl, SCREEN, WARM)?;
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
            world,
            line,
            sprite,
            body,
            finish,
            warm,
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
    /// Reduced motion holds one moment: the figure mid-step, every ring.
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
        for p in [
            &self.world,
            &self.line,
            &self.sprite,
            &self.body,
            &self.finish,
            &self.warm,
        ] {
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
            FOCAL * f.lens / aspect.max(FRAME_ASPECT),
            FOCAL * f.lens * aspect.min(FRAME_ASPECT) / FRAME_ASPECT,
            w,
            h,
        ];
        let flat: Vec<f32> = slots.iter().flatten().copied().collect();
        let cones: Vec<f32> = f.body.cones.iter().flatten().copied().collect();
        let keep = self.target.keep();
        let gl = &self.gl;
        gl.viewport(0, 0, width, height);
        // Alpha holds page 04's warm light, so it starts empty.
        gl.clear_color(0.0, 0.0, 0.0, 0.0);
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

        // The world: the planet, the air, the glass.
        scene(&self.world, 0.0);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        // Far stars, the columns over the horizon, the floor, the motes.
        let sprites = [
            (f.world, STARS + CONSTELLATIONS * CONSTELLATION_STARS, 3.0),
            (f.world, COLUMNS * COLUMN_DOTS, 6.0),
            (f.floor, FLOOR_GRID * FLOOR_GRID, 1.0),
            (f.world, MOTES, 0.0),
        ];
        for (on, count, kind) in sprites {
            if on > 0.0 {
                scene(&self.sprite, kind);
                gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, count as i32);
            }
        }
        // The lines.
        let [crown, scanner, spin] = f.rings.map(|r| r.light);
        let ghosts = f.ghosts.iter().map(|g| g.3).fold(0.0, f32::max);
        let glass = f.floor * (SHELL_LATENT * f.latent + f.filled);
        let wires = f.tentacles.iter().map(|w| w.light).fold(0.0, f32::max);
        let families = [
            (crown, 2 * RING_SEGMENTS),
            (ghosts, GHOSTS as u32 * GHOST_SEGMENTS),
            (scanner, 2 * RING_SEGMENTS),
            (spin, SPIN_TRAIL * RING_SEGMENTS),
            (glass, RING_SEGMENTS),
            (f.floor, PRINTS as u32 * RIPPLE_SEGMENTS),
            (f.floor, PRINTS as u32 * PRINT_SEGMENTS),
            (f.lock[3] * f32::from(f.lock_radius > 0.0), RING_SEGMENTS),
            (f.world, CONSTELLATIONS * (CONSTELLATION_STARS - 1)),
            (
                wires,
                TENTACLES as u32 * TENTACLE_STRANDS * TENTACLE_SEGMENTS,
            ),
            (f.things, THINGS * (12 * THING_PIECES + THING_RING)),
            (f.world, SPIRES * SPIRE_PIECES),
            (
                f.seats.iter().map(|s| s[2] * s[3]).fold(0.0, f32::max),
                SEATS as u32 * SEAT_PIECES * (12 + 4 * SEAT_LEVELS),
            ),
            (
                f.voices.iter().map(|v| v[7]).fold(0.0, f32::max),
                VOICES as u32 * VOICE_SEGMENTS,
            ),
            (
                f.desks.iter().map(|d| d[2]).fold(0.0, f32::max),
                SEATS as u32 * DESK_LINES,
            ),
            (
                f.branches
                    .iter()
                    .skip(2)
                    .step_by(3)
                    .map(|b| b[1])
                    .fold(0.0, f32::max),
                EVENTS as u32 * BRANCHES * BRANCH_SEGMENTS,
            ),
            (f.props[2][3], PROP_LINES),
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
        // The one it meets, fainter and in half the points, outside the glass.
        if f.other_light > 0.0 {
            let other: Vec<f32> = f.other.cones.iter().flatten().copied().collect();
            scene(&self.body, 0.0);
            gl.uniform4fv_with_f32_array(self.body.at("u_b"), &other);
            let light = f.other_light * OTHER_LIGHT;
            gl.uniform4f(self.body.at("u_kind"), 0.0, largest, 1.0, light);
            gl.draw_arrays(Gl::POINTS, 0, BODY_POINTS as i32 / 2);
        }
        // The lights (the feet, the crown's knots, page 03's lantern), the
        // rings' beads, the spokes between them, the wires' dust and the
        // spires' lights.
        let lights = [
            (1.0, 6, 2.0),
            (crown.max(scanner), 2 * BEADS, 4.0),
            (f.spokes, SPOKES * SPOKE_BEADS, 5.0),
            (f.world, TENTACLES as u32 * (DEBRIS + 2) + SPIRES, 7.0),
            (
                f.facts.iter().map(|b| b[3]).fold(0.0, f32::max),
                EVENTS as u32,
                8.0,
            ),
        ];
        for (on, count, kind) in lights {
            if on > 0.0 {
                scene(&self.sprite, kind);
                gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, count as i32);
            }
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
            // Page 04's warm light, added over the recolored frame.
            let warm = f.warmth > 0.0
                || f.branches.iter().skip(2).step_by(3).any(|b| b[1] > 0.0)
                || f.facts.iter().any(|b| b[3] > 0.0);
            if warm && self.look.warm != [0.0; 3] {
                let p = &self.warm;
                gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
                gl.viewport(0, 0, width, height);
                gl.enable(Gl::BLEND);
                gl.blend_func(Gl::ONE, Gl::ONE);
                gl.use_program(Some(&p.program));
                gl.active_texture(Gl::TEXTURE2);
                gl.bind_texture(Gl::TEXTURE_2D, self.target.texture.as_ref());
                gl.uniform4f(
                    p.at("u_out"),
                    f32::from(self.look.soft),
                    f32::from(self.soft_edges),
                    0.0,
                    1.0 / keep,
                );
                gl.uniform4fv_with_f32_array(p.at("u_edges"), &EDGES);
                gl.uniform3fv_with_f32_array(p.at("u_warm"), &self.look.warm);
                gl.bind_vertex_array(Some(&self.empty));
                gl.draw_arrays(Gl::TRIANGLES, 0, 3);
                gl.bind_vertex_array(None);
                gl.bind_texture(Gl::TEXTURE_2D, None);
                gl.active_texture(Gl::TEXTURE0);
                gl.disable(Gl::BLEND);
            }
        }
        self.frames = self.frames.wrapping_add(1);
    }
}
