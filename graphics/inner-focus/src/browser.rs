//! Browser adapter: four WebGL2 passes and their uniforms. Every motion
//! value comes from `compose`. The far pass draws the city across the river
//! (houses and windows, the bell tower, the bridge and its train, the water
//! and what it reflects, the gulls); the near pass traces him on his chair,
//! the deck and the rail, the second ring and the signs of his inside; each
//! layer is blurred by its own circle of confusion at half size when it is
//! out of focus; the composite lays him over the city and adds what is
//! brighter than a frame holds: the first ring and its runners, the lamps,
//! the windows' discs. The scene is two-toned (`look`) over the page colour,
//! so it does not go through the monochrome theme recolor.
use crate::body::{ELBOW, ELBOW_FOLLOWS, HAND, HAND_AT, SHOULDER, WRIST};
use crate::{
    compose, look, Frame, Look, Ring, ATLAS, BELFRY, BOUNDS, BRIDGE, BRIDGE_LAMPS, CHEST, FAR_BANK,
    FRAME_ASPECT, LABEL_BAND, LABEL_BASE, LABEL_CAP, LABEL_INK, LAMP_HEIGHT, LAMP_STEP,
    LOOP_SECONDS, PIER_HALF, RAIL_X, RUNNERS, SIGN_SLOTS, STILL, TOWER_AZ, TRAIN_LENGTH, YAW,
};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Warm;
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlFramebuffer,
    WebGlProgram, WebGlShader, WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const COMMON: &str = include_str!("shaders/common.glsl");
const FAR: &str = include_str!("shaders/far.frag");
const NEAR: &str = include_str!("shaders/near.frag");
const BLUR: &str = include_str!("shaders/blur.frag");
const COMPOSITE: &str = include_str!("shaders/composite.frag");
const SCREEN: &str = include_str!("shaders/screen.vert");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];
/// The Тишина page, until the app says which page it is.
const PAGE: [f32; 3] = [13.0 / 255.0, 21.0 / 255.0, 32.0 / 255.0];
/// Below this circle of confusion (canvas px) a layer is drawn sharp and
/// its blur pass is skipped.
const SHARP: f32 = 0.3;
/// Texture units: the words, the two layers, their blurs; and the one new
/// textures are made on.
const ATLAS_UNIT: u32 = 0;
const FAR_UNIT: u32 = 1;
const NEAR_UNIT: u32 = 2;
const FAR_BLUR_UNIT: u32 = 3;
const NEAR_BLUR_UNIT: u32 = 4;
const SPARE_UNIT: u32 = 5;
const NAMES: [&str; 33] = [
    "u_eye",
    "u_right",
    "u_up",
    "u_fwd",
    "u_view",
    "u_blur",
    "u_cold",
    "u_warm",
    "u_pale",
    "u_backdrop",
    "u_dusk",
    "u_sky",
    "u_ring0",
    "u_ring1",
    "u_ring2",
    "u_bell",
    "u_train",
    "u_gull",
    "u_inner0",
    "u_inner1",
    "u_inner2",
    "u_innerRun",
    "u_body",
    "u_sign",
    "u_atlas",
    "u_src",
    "u_coc",
    "u_far",
    "u_near",
    "u_farBlur",
    "u_nearBlur",
    "u_run",
    "u_edges",
];

/// lib.rs's and body.rs's constants as the shaders' `#define`s, so both read
/// one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let v2 = |v: [f32; 2]| format!("vec2({:?}, {:?})", v[0], v[1]);
    let v3 = |v: [f32; 3]| format!("vec3({:?}, {:?}, {:?})", v[0], v[1], v[2]);
    let (sin, cos) = YAW.sin_cos();
    let ink = LABEL_INK
        .iter()
        .map(|&span| v2(span))
        .collect::<Vec<_>>()
        .join(", ");
    let lines = [
        ("LOOP_SECONDS", f(LOOP_SECONDS)),
        ("FRAME_ASPECT", f(FRAME_ASPECT)),
        ("YAW_SC", v2([sin, cos])),
        ("BOUNDS_FROM", v3(BOUNDS[0])),
        ("BOUNDS_TO", v3(BOUNDS[1])),
        ("RAIL_X", f(RAIL_X)),
        ("PIER_HALF", f(PIER_HALF)),
        ("FAR_BANK", f(FAR_BANK)),
        ("TOWER_AZ", f(TOWER_AZ)),
        ("BELFRY", v2(BELFRY)),
        ("BRIDGE", v2(BRIDGE)),
        ("TRAIN_LENGTH", f(TRAIN_LENGTH)),
        ("LAMP_STEP", f(LAMP_STEP)),
        ("LAMP_HEIGHT", f(LAMP_HEIGHT)),
        ("BRIDGE_LAMPS", v3(BRIDGE_LAMPS)),
        ("RUNNERS", RUNNERS.to_string()),
        ("SIGN_SLOTS", SIGN_SLOTS.to_string()),
        ("CHEST", v3(CHEST)),
        ("SHOULDER", v3(SHOULDER)),
        ("ELBOW", v3(ELBOW)),
        ("WRIST", v3(WRIST)),
        ("HAND_AT", v3(HAND_AT)),
        ("HAND", v3(HAND)),
        ("ELBOW_FOLLOWS", f(ELBOW_FOLLOWS)),
        ("ATLAS", v2(ATLAS)),
        (
            "LABEL_INK_LIST",
            format!("vec2[{}]({ink})", LABEL_INK.len()),
        ),
        ("LABEL_BAND", v2(LABEL_BAND)),
        ("LABEL_BASE", f(LABEL_BASE)),
        ("LABEL_CAP", f(LABEL_CAP)),
    ];
    lines
        .iter()
        .map(|(name, value)| format!("#define {name} {value}\n"))
        .collect()
}

fn source(pass: &str) -> String {
    format!("#version 300 es\n{}{COMMON}{pass}", defines())
}

fn sources() -> [String; 4] {
    [FAR, NEAR, BLUR, COMPOSITE].map(source)
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

/// A frame to draw into and read back: RGBA8, smooth reads, with mips for
/// the layers the blur gathers from.
struct Target {
    framebuffer: WebGlFramebuffer,
    texture: Option<WebGlTexture>,
    size: (i32, i32),
    mips: bool,
}

impl Target {
    fn new(gl: &Gl, mips: bool) -> Result<Self, JsValue> {
        Ok(Self {
            framebuffer: gl
                .create_framebuffer()
                .ok_or("Cannot allocate framebuffer")?,
            texture: None,
            size: (0, 0),
            mips,
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
    let programs = sources().map(|frag| (SCREEN, frag));
    Ok(Warm::start(&context(canvas)?, &programs))
}

fn ring_uniforms(gl: &Gl, p: &Prog, names: [&str; 3], r: &Ring) {
    let [cx, cy, cz] = r.centre;
    let [nx, ny, nz] = r.normal;
    let [ax, ay, az] = r.axis;
    gl.uniform4f(p.at(names[0]), cx, cy, cz, r.radius);
    gl.uniform4f(p.at(names[1]), nx, ny, nz, r.turn);
    gl.uniform4f(p.at(names[2]), ax, ay, az, r.light);
}

fn flat(rows: &[[f32; 4]]) -> Vec<f32> {
    rows.iter().flatten().copied().collect()
}

#[wasm_bindgen]
pub struct InnerFocus {
    gl: Gl,
    canvas: HtmlCanvasElement,
    far: Prog,
    near: Prog,
    blur: Prog,
    composite: Prog,
    far_frame: Target,
    near_frame: Target,
    far_blur: Target,
    near_blur: Target,
    labels: WebGlTexture,
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
impl InnerFocus {
    /// One image: the words of his thought. The shaders trace the rest.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement, labels: HtmlImageElement) -> Result<InnerFocus, JsValue> {
        let gl: Gl = context(&canvas)?;
        let [far, near, blur, composite] = sources().map(|frag| Prog::new(&gl, SCREEN, &frag));
        let (far, near, blur, composite) = (far?, near?, blur?, composite?);
        let labels = image_texture(&gl, ATLAS_UNIT, &labels)?;
        let empty = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        Ok(Self {
            far_frame: Target::new(&gl, true)?,
            near_frame: Target::new(&gl, true)?,
            far_blur: Target::new(&gl, false)?,
            near_blur: Target::new(&gl, false)?,
            gl,
            canvas,
            far,
            near,
            blur,
            composite,
            labels,
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
    /// Reduced motion holds one moment: «Просто как два слоя одного
    /// Осознавания», both layers sharp at once.
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
        for target in [
            &mut self.far_frame,
            &mut self.near_frame,
            &mut self.far_blur,
            &mut self.near_blur,
        ] {
            target.dispose(gl);
        }
        gl.delete_texture(Some(&self.labels));
        gl.delete_vertex_array(Some(&self.empty));
        for p in [&self.far, &self.near, &self.blur, &self.composite] {
            gl.delete_program(Some(&p.program));
        }
        self.disposed = true;
    }
}

impl InnerFocus {
    /// The frames at this canvas's size; false while one cannot be drawn into.
    fn targets(&mut self, width: i32, height: i32) -> bool {
        let gl = &self.gl;
        let (hw, hh) = ((width + 1) / 2, (height + 1) / 2);
        let mut ok = true;
        for (target, w, h) in [
            (&mut self.far_frame, width, height),
            (&mut self.near_frame, width, height),
            (&mut self.far_blur, hw, hh),
            (&mut self.near_blur, hw, hh),
        ] {
            if !target.ready(w, h) {
                ok &= target.allocate(gl, w, h).unwrap_or(false);
            }
        }
        ok
    }

    /// What every pass reads: the camera, the frame, the colours, the first
    /// ring.
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
        gl.uniform4f(
            p.at("u_blur"),
            f.blur[0],
            f.blur[1],
            f32::from(self.soft_edges),
            0.0,
        );
        gl.uniform3fv_with_f32_array(p.at("u_cold"), &self.look.cold);
        gl.uniform3fv_with_f32_array(p.at("u_warm"), &self.look.warm);
        gl.uniform3fv_with_f32_array(p.at("u_pale"), &self.look.pale);
        gl.uniform3fv_with_f32_array(p.at("u_backdrop"), &self.backdrop);
        let [dr, dg, db] = self.look.dusk;
        gl.uniform4f(p.at("u_dusk"), dr, dg, db, self.look.code);
        gl.uniform3fv_with_f32_array(p.at("u_sky"), &self.look.sky);
        ring_uniforms(gl, p, ["u_ring0", "u_ring1", "u_ring2"], &f.outer);
    }

    /// Blur `from` (read on `unit`) into `into` by a circle of confusion of
    /// `radius` canvas px.
    fn blur_layer(&self, from: &Target, unit: u32, into: &Target, radius: f32) {
        let gl = &self.gl;
        let p = &self.blur;
        into.bind(gl);
        from.read(gl, unit);
        gl.use_program(Some(&p.program));
        gl.uniform1i(p.at("u_src"), unit as i32);
        // The mip whose texels are about as far apart as the taps.
        let spacing = radius * (std::f32::consts::PI / 48.0).sqrt();
        gl.uniform4f(p.at("u_coc"), radius, spacing.max(1.0).log2(), 0.0, 0.0);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
    }

    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        if !self.targets(width, height) {
            return;
        }
        let f = compose(if self.reduced { STILL } else { self.elapsed });
        let gl = &self.gl;
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
        let px800 = view[1] * h / 800.0;

        // The city.
        self.far_frame.bind(gl);
        let p = &self.far;
        self.shared(p, &f, &view);
        gl.uniform4fv_with_f32_array(p.at("u_bell"), &f.bell);
        gl.uniform4f(p.at("u_train"), f.train[0], f.train[1], 0.0, 0.0);
        gl.uniform4fv_with_f32_array(p.at("u_gull"), &flat(&f.gulls));
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);

        // Him.
        self.near_frame.bind(gl);
        let p = &self.near;
        self.shared(p, &f, &view);
        ring_uniforms(gl, p, ["u_inner0", "u_inner1", "u_inner2"], &f.inner);
        gl.uniform4fv_with_f32_array(p.at("u_innerRun"), &f.inner_runner);
        gl.uniform4f(p.at("u_body"), f.shrug, 0.0, 0.0, 0.0);
        gl.uniform4fv_with_f32_array(p.at("u_sign"), &flat(&f.signs));
        gl.active_texture(Gl::TEXTURE0 + ATLAS_UNIT);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&self.labels));
        gl.uniform1i(p.at("u_atlas"), ATLAS_UNIT as i32);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);

        // Each layer out of focus is blurred by its own circle.
        let [near_coc, far_coc] = f.blur.map(|b| b * px800);
        if far_coc >= SHARP {
            self.far_frame.mipmap(gl);
            self.blur_layer(&self.far_frame, FAR_UNIT, &self.far_blur, far_coc);
        }
        if near_coc >= SHARP {
            self.near_frame.mipmap(gl);
            self.blur_layer(&self.near_frame, NEAR_UNIT, &self.near_blur, near_coc);
        }

        // Together, onto the canvas.
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        gl.viewport(0, 0, width, height);
        self.far_frame.read(gl, FAR_UNIT);
        self.near_frame.read(gl, NEAR_UNIT);
        self.far_blur.read(gl, FAR_BLUR_UNIT);
        self.near_blur.read(gl, NEAR_BLUR_UNIT);
        let p = &self.composite;
        self.shared(p, &f, &view);
        gl.uniform1i(p.at("u_far"), FAR_UNIT as i32);
        gl.uniform1i(p.at("u_near"), NEAR_UNIT as i32);
        gl.uniform1i(p.at("u_farBlur"), FAR_BLUR_UNIT as i32);
        gl.uniform1i(p.at("u_nearBlur"), NEAR_BLUR_UNIT as i32);
        let runners: Vec<[f32; 4]> = f.runners.iter().map(|&[x, y, l]| [x, y, l, 0.0]).collect();
        gl.uniform4fv_with_f32_array(p.at("u_run"), &flat(&runners));
        gl.uniform4fv_with_f32_array(p.at("u_edges"), &EDGES);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
