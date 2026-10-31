//! Browser adapter: WebGL2 objects and draw order. Every motion value comes
//! from `compose`; the shaders place the painting's points in the room, the
//! air's particles and the scanner's sheet, all added into one frame, and the
//! theme's recolor (scene-palette) maps the finished frame.
use crate::{
    compose, look, sweep_strength, Look, AFTERGLOW, BAND, BEAM, CENTRE, COLUMNS, CUP, DIM,
    DISPARITY_MAX, DOT_GAIN, DOT_SPRITE, DUST, ENGRAVE_GAMMA, ENGRAVE_WHITE, FAR, FOCAL, GLASS,
    HORIZON, LOOP_SECONDS, MID_AT, MOON, POINTS, ROOM_CENTRE, ROOM_MAX, ROOM_MIN, SIZE,
    SOUND_SPEED, STILL, STRIDE,
};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Themed;
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlFramebuffer,
    WebGlProgram, WebGlShader, WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const COMMON: &str = include_str!("shaders/common.glsl");
const ROOM: &str = include_str!("shaders/room.vert");
const DUST_VERT: &str = include_str!("shaders/dust.vert");
const DOT: &str = include_str!("shaders/dot.frag");
const SCREEN: &str = include_str!("shaders/screen.vert");
const SHEET: &str = include_str!("shaders/sheet.frag");
const FINISH: &str = include_str!("shaders/finish.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];
/// Every uniform any program reads; a program without one ignores it.
const NAMES: [&str; 18] = [
    "u_cam",
    "u_turn",
    "u_px",
    "u_wake",
    "u_scanAxis[0]",
    "u_scan[0]",
    "u_layers0",
    "u_layers1",
    "u_sound[0]",
    "u_soundOn",
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
    let v2 = |[x, y]: [f32; 2]| format!("vec2({x:?}, {y:?})");
    let v3 = |[x, y, z]: [f32; 3]| format!("vec3({x:?}, {y:?}, {z:?})");
    let lines = [
        ("SIZE", v2(SIZE.map(|v| v as f32))),
        ("FOCAL", format!("{FOCAL:?}")),
        ("HORIZON", format!("{HORIZON:?}")),
        ("CENTRE", format!("{CENTRE:?}")),
        ("DISPARITY_MAX", format!("{DISPARITY_MAX:?}")),
        ("FAR", format!("{FAR:?}")),
        ("GLASS", format!("{GLASS:?}")),
        ("STRIDE", format!("{:?}", STRIDE as f32)),
        ("COLUMNS", COLUMNS.to_string()),
        ("DOT_SPRITE", format!("{DOT_SPRITE:?}")),
        ("DOT_GAIN", format!("{DOT_GAIN:?}")),
        ("DIM", format!("{DIM:?}")),
        ("AFTERGLOW", format!("{AFTERGLOW:?}")),
        ("BAND", format!("{BAND:?}")),
        ("SOUND_SPEED", format!("{SOUND_SPEED:?}")),
        ("LOOP_SECONDS", format!("{LOOP_SECONDS:?}")),
        ("ROOM_MIN", v3(ROOM_MIN)),
        ("ROOM_MAX", v3(ROOM_MAX)),
        ("ROOM_CENTRE", v3(ROOM_CENTRE)),
        ("MOON", v2(MOON)),
        ("BEAM_TOP", v3(BEAM[0])),
        ("BEAM_FLOOR", v3(BEAM[1])),
        ("CUP", v3(CUP)),
    ];
    lines
        .iter()
        .map(|(name, value)| format!("#define {name} {value}\n"))
        .collect()
}

/// A shader that shares the scene's camera, depth map and scanner.
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
        // Fixed texture units: the painting, the depth map, the frame.
        gl.use_program(Some(&p));
        for (name, unit) in [("u_room", 0), ("u_depth", 1), ("u_frame", 2)] {
            gl.uniform1i(gl.get_uniform_location(&p, name).as_ref(), unit);
        }
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

fn check_size(image: &HtmlImageElement, what: &str) -> Result<(), JsValue> {
    if image.natural_width() != SIZE[0] || image.natural_height() != SIZE[1] {
        return Err(format!("The {what} must be 1536 × 1024").into());
    }
    Ok(())
}

fn clamp_and_filter(gl: &Gl, min: u32, mag: u32) {
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MIN_FILTER, min as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MAG_FILTER, mag as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE as i32);
}

/// Art's painting, with mip levels: each point takes its cell's average.
fn painting(gl: &Gl, image: &HtmlImageElement) -> Result<WebGlTexture, JsValue> {
    check_size(image, "painting")?;
    let t = gl.create_texture().ok_or("Cannot allocate texture")?;
    gl.active_texture(Gl::TEXTURE0);
    gl.bind_texture(Gl::TEXTURE_2D, Some(&t));
    let levels = 32 - SIZE[0].max(SIZE[1]).leading_zeros();
    gl.tex_storage_2d(
        Gl::TEXTURE_2D,
        levels as i32,
        Gl::RGBA8,
        SIZE[0] as i32,
        SIZE[1] as i32,
    );
    clamp_and_filter(gl, Gl::LINEAR_MIPMAP_LINEAR, Gl::LINEAR);
    gl.pixel_storei(Gl::UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.tex_sub_image_2d_with_u32_and_u32_and_html_image_element(
        Gl::TEXTURE_2D,
        0,
        0,
        0,
        Gl::RGBA,
        Gl::UNSIGNED_BYTE,
        image,
    )?;
    gl.generate_mipmap(Gl::TEXTURE_2D);
    Ok(t)
}

/// The depth map, its bytes exactly as written: no colour conversion, no
/// filtering between neighbours at different depths.
fn depth_map(gl: &Gl, image: &HtmlImageElement) -> Result<WebGlTexture, JsValue> {
    check_size(image, "depth map")?;
    let t = gl.create_texture().ok_or("Cannot allocate texture")?;
    gl.active_texture(Gl::TEXTURE1);
    gl.bind_texture(Gl::TEXTURE_2D, Some(&t));
    clamp_and_filter(gl, Gl::NEAREST, Gl::NEAREST);
    gl.pixel_storei(Gl::UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.pixel_storei(Gl::UNPACK_COLORSPACE_CONVERSION_WEBGL, Gl::NONE as i32);
    let uploaded = gl.tex_image_2d_with_u32_and_u32_and_html_image_element(
        Gl::TEXTURE_2D,
        0,
        Gl::RGBA8 as i32,
        Gl::RGBA,
        Gl::UNSIGNED_BYTE,
        image,
    );
    gl.pixel_storei(
        Gl::UNPACK_COLORSPACE_CONVERSION_WEBGL,
        Gl::BROWSER_DEFAULT_WEBGL as i32,
    );
    gl.active_texture(Gl::TEXTURE0);
    uploaded?;
    Ok(t)
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
pub struct SphereRoom {
    gl: Gl,
    canvas: HtmlCanvasElement,
    room: Prog,
    dust: Prog,
    sheet: Prog,
    finish: Prog,
    painting: WebGlTexture,
    depth: WebGlTexture,
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
impl SphereRoom {
    /// Art's night room and its depth map; light themes engrave the scene
    /// on the page.
    #[wasm_bindgen(constructor)]
    pub fn new(
        canvas: HtmlCanvasElement,
        room: HtmlImageElement,
        depth: HtmlImageElement,
    ) -> Result<SphereRoom, JsValue> {
        let options = js_sys::Object::new();
        js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"antialias".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &false.into())?;
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 unavailable")?
            .dyn_into()?;
        let defines = defines();
        let points = Prog::new(&gl, &scene_source(&defines, ROOM), DOT)?;
        let dust = Prog::new(&gl, &scene_source(&defines, DUST_VERT), DOT)?;
        let sheet = Prog::new(&gl, SCREEN, &scene_source(&defines, SHEET))?;
        let finish = Prog::new(&gl, SCREEN, FINISH)?;
        let painting = painting(&gl, &room)?;
        let depth = depth_map(&gl, &depth)?;
        let target = Target::new(&gl)?;
        let themed = Themed::new(&gl, false)?;
        let empty = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        Ok(Self {
            gl,
            canvas,
            room: points,
            dust,
            sheet,
            finish,
            painting,
            depth,
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
    /// Reduced motion holds one moment: the light-and-shadow line, its plane
    /// halfway down the moonbeam.
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
        gl.delete_texture(Some(&self.painting));
        gl.delete_texture(Some(&self.depth));
        self.target.dispose(gl);
        gl.delete_vertex_array(Some(&self.empty));
        for p in [&self.room, &self.dust, &self.sheet, &self.finish] {
            gl.delete_program(Some(&p.program));
        }
        self.themed.dispose(gl);
        self.disposed = true;
    }
}

impl SphereRoom {
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
        gl.active_texture(Gl::TEXTURE1);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&self.depth));
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&self.painting));

        // The painting covers the canvas whatever its shape.
        let (w, h) = (width as f32, height as f32);
        let aspect = (w / h) / (SIZE[0] as f32 / SIZE[1] as f32);
        let px = [
            (w / SIZE[0] as f32).max(h / SIZE[1] as f32),
            f.time,
            (1.0 / aspect).max(1.0),
            aspect.max(1.0),
        ];
        let [x, y, z] = f.eye;
        let cam = [x, y, z, f.zoom];
        let turn = [f.yaw.cos(), f.yaw.sin(), f.pitch.cos(), f.pitch.sin()];
        let mut axes = [0.0; 8];
        let mut scans = [0.0; 8];
        for (k, s) in f.sweeps.iter().enumerate() {
            let [x, y, z] = s.axis;
            axes[k * 4..k * 4 + 4].copy_from_slice(&[x, y, z, f32::from(s.sphere)]);
            scans[k * 4..k * 4 + 4].copy_from_slice(&[s.from, s.to, f.since[k], s.seconds]);
        }
        let l = f.layers;
        let mut sounds = [0.0; 12];
        for (k, (at, _)) in crate::SOUNDS.iter().enumerate() {
            sounds[k * 4..k * 4 + 4].copy_from_slice(&[at[0], at[1], at[2], f.sounds[k][0]]);
        }
        let sound_on = [f.sounds[0][1], f.sounds[1][1], f.sounds[2][1], 0.0];
        let scene = |p: &Prog| {
            gl.use_program(Some(&p.program));
            gl.uniform4fv_with_f32_array(p.at("u_cam"), &cam);
            gl.uniform4fv_with_f32_array(p.at("u_turn"), &turn);
            gl.uniform4fv_with_f32_array(p.at("u_px"), &px);
            gl.uniform4f(p.at("u_wake"), f.reveal, f.awake, 0.0, 0.0);
            gl.uniform4fv_with_f32_array(p.at("u_scanAxis[0]"), &axes);
            gl.uniform4fv_with_f32_array(p.at("u_scan[0]"), &scans);
            gl.uniform4f(p.at("u_layers0"), l[0], l[1], l[2], l[3]);
            gl.uniform4f(p.at("u_layers1"), l[4], l[5], f.breath, 0.0);
            gl.uniform4fv_with_f32_array(p.at("u_sound[0]"), &sounds);
            gl.uniform4fv_with_f32_array(p.at("u_soundOn"), &sound_on);
            gl.uniform3fv_with_f32_array(p.at("u_glow"), &self.look.glow);
        };

        // The room's points, then what moves in its air, then the sheet.
        scene(&self.room);
        gl.draw_arrays(Gl::POINTS, 0, POINTS as i32);
        scene(&self.dust);
        for (kind, count) in DUST.iter().enumerate() {
            gl.uniform4f(self.dust.at("u_kind"), kind as f32, 0.0, 0.0, 0.0);
            gl.draw_arrays(Gl::POINTS, 0, *count as i32);
        }
        if sweep_strength(&f.sweeps[0], f.since[0]) > 0.0 {
            scene(&self.sheet);
            gl.draw_arrays(Gl::TRIANGLES, 0, 3);
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
