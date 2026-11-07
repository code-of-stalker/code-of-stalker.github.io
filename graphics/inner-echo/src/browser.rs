//! Browser adapter: one WebGL2 program, its uniforms, the baked inside of
//! the body and the four images of himself (small 3D textures) and the words
//! under the scene (an atlas image, the scene's one loaded input). Every
//! motion value comes from `compose`; one full-screen pass traces each
//! pixel's ray through the room, the chair, the person, the outer orbit, the
//! scanning inner ring and the images, and adds the light straight onto the
//! page in the theme's own cold, warm and pale (`look`). The scene is
//! two-toned, so it does not go through the monochrome theme recolor.
use crate::body::{occupancy, CELLS, CELL_FROM};
use crate::generated::{ATLAS, LABEL_BAND, LABEL_BASE, LABEL_CAP, LABEL_INK};
use crate::selves::{self, SELF_CELL, SELF_CELLS, SELF_FROM, SELVES};
use crate::{
    compose, look, Look, BACK, CAPTION, DOOR, ECHO_LEVELS, EYES, FADE_FROM, FRAME_ASPECT, HEAD,
    HEART, INNER_BASE, INNER_FLOW, INNER_RUNNERS, INSIDE, KNOT, KNOT_POINTS, LAMP, LEFT, LEVELS,
    LOOP_SECONDS, ORBIT, ORBIT_FLOW, ORBIT_RUNNERS, PERSON, REACH, SPACING, SPARK_POINTS, STILL,
    TABLE, THOUGHT, WINDOW,
};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlProgram, WebGlShader,
    WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const SCENE: &str = include_str!("shaders/scene.frag");
const SCREEN: &str = include_str!("shaders/screen.vert");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];
/// The Тишина page, until the app says which page it is.
const PAGE: [f32; 3] = [13.0 / 255.0, 21.0 / 255.0, 32.0 / 255.0];
const NAMES: [&str; 28] = [
    "u_eye",
    "u_right",
    "u_up",
    "u_fwd",
    "u_view",
    "u_wave",
    "u_front",
    "u_echo",
    "u_echo_l",
    "u_room",
    "u_inner",
    "u_orbit",
    "u_ring",
    "u_noise",
    "u_misc",
    "u_self",
    "u_text",
    "u_flare_a",
    "u_flare_b",
    "u_cold",
    "u_warm",
    "u_pale",
    "u_backdrop",
    "u_edges",
    "u_out",
    "u_body",
    "u_selves",
    "u_atlas",
];

/// lib.rs's constants as the shader's `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let v2 = |v: [f32; 2]| format!("vec2({:?}, {:?})", v[0], v[1]);
    let v3 = |v: [f32; 3]| format!("vec3({:?}, {:?}, {:?})", v[0], v[1], v[2]);
    let v4 = |v: [f32; 4]| format!("vec4({:?}, {:?}, {:?}, {:?})", v[0], v[1], v[2], v[3]);
    let iv3 = |v: [i32; 3]| format!("ivec3({}, {}, {})", v[0], v[1], v[2]);
    let sparks = SPARK_POINTS.map(v3).join(", ");
    // Each image of himself: where it stands and how big, how it turns, and
    // the points of it the head's light lands on, in the room.
    let at: [usize; SELVES] = std::array::from_fn(|i| i);
    let places = selves::PLACES.map(v4).join(", ");
    let turns = at
        .map(|i| {
            let (s, c) = selves::yaw(i).sin_cos();
            v2([c, s])
        })
        .join(", ");
    let beams = at
        .map(|i| {
            selves::beam_targets(i)
                .map(|q| v3(selves::to_world(i, q)))
                .join(", ")
        })
        .join(", ");
    let ink = LABEL_INK.map(v2).join(", ");
    let lines = [
        ("LOOP_SECONDS", f(LOOP_SECONDS)),
        ("HEART", v3(HEART)),
        ("ORBIT", f(ORBIT)),
        ("ORBIT_RUNNERS", f(ORBIT_RUNNERS)),
        ("INNER_RUNNERS", f(INNER_RUNNERS)),
        // Which way each orbit's runners go, for their tails.
        ("ORBIT_DIR", f(ORBIT_FLOW.signum())),
        ("INNER_DIR", f(INNER_FLOW.signum())),
        ("REACH", f(REACH)),
        ("FADE_FROM", f(FADE_FROM)),
        ("BACK", f(BACK)),
        ("LEFT", f(LEFT)),
        ("WINDOW", v4(WINDOW)),
        ("DOOR", v4(DOOR)),
        ("TABLE", v3(TABLE)),
        ("LAMP", v3(LAMP)),
        ("PERSON_FROM", v3(PERSON[0])),
        ("PERSON_TO", v3(PERSON[1])),
        ("SPACING", v4(SPACING)),
        ("INSIDE", f(INSIDE)),
        ("CELL_FROM", iv3(CELL_FROM)),
        ("CELLS", iv3(CELLS.map(|n| n as i32))),
        ("LEVELS", v3(LEVELS)),
        ("ECHO_LEVELS", v3(ECHO_LEVELS)),
        ("INNER_BASE", f(INNER_BASE)),
        ("SPARK_LIST", format!("vec3[6]({sparks})")),
        ("THOUGHT", v3(THOUGHT)),
        ("HEAD", v2(HEAD)),
        ("KNOT", f(KNOT)),
        ("KNOT_POINTS", f(KNOT_POINTS)),
        ("EYES", v3(EYES)),
        ("SELVES", SELVES.to_string()),
        ("SELF_CELL", f(SELF_CELL)),
        ("SELF_FROM", iv3(SELF_FROM)),
        ("SELF_CELLS", iv3(SELF_CELLS.map(|n| n as i32))),
        ("SELF_AT_LIST", format!("vec4[{SELVES}]({places})")),
        ("SELF_TURN_LIST", format!("vec2[{SELVES}]({turns})")),
        ("BEAM_LIST", format!("vec3[{}]({beams})", SELVES * 5)),
        ("FRAME_ASPECT", f(FRAME_ASPECT)),
        ("CAPTION", v3(CAPTION)),
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

/// A baked lattice (the inside of the body, or the images of himself) as a
/// 3D texture on unit `slot`: one byte a cell, read exactly (no filtering).
fn lattice_texture(
    gl: &Gl,
    slot: u32,
    [w, h, d]: [i32; 3],
    cells: &[u8],
) -> Result<WebGlTexture, JsValue> {
    let texture = gl.create_texture().ok_or("Cannot allocate texture")?;
    gl.active_texture(Gl::TEXTURE0 + slot);
    gl.bind_texture(Gl::TEXTURE_3D, Some(&texture));
    gl.pixel_storei(Gl::UNPACK_ALIGNMENT, 1);
    gl.tex_image_3d_with_opt_u8_array(
        Gl::TEXTURE_3D,
        0,
        Gl::R8 as i32,
        w,
        h,
        d,
        0,
        Gl::RED,
        Gl::UNSIGNED_BYTE,
        Some(cells),
    )?;
    for (name, value) in [
        (Gl::TEXTURE_MIN_FILTER, Gl::NEAREST),
        (Gl::TEXTURE_MAG_FILTER, Gl::NEAREST),
        (Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE),
        (Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE),
        (Gl::TEXTURE_WRAP_R, Gl::CLAMP_TO_EDGE),
    ] {
        gl.tex_parameteri(Gl::TEXTURE_3D, name, value as i32);
    }
    gl.bind_texture(Gl::TEXTURE_3D, None);
    Ok(texture)
}

/// The words under the scene on texture unit `slot`, mipmapped so they stay
/// clean when drawn smaller than baked.
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
    gl.bind_texture(Gl::TEXTURE_2D, None);
    Ok(t)
}

#[wasm_bindgen]
pub struct InnerEcho {
    gl: Gl,
    canvas: HtmlCanvasElement,
    scene: Prog,
    body: WebGlTexture,
    selves: WebGlTexture,
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
impl InnerEcho {
    /// `labels` is the words' atlas (`assets/labels.webp`), decoded; the
    /// inside of the body and the images of himself are baked here and the
    /// shader traces the rest.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement, labels: HtmlImageElement) -> Result<InnerEcho, JsValue> {
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
            &format!("#version 300 es\n{}{SCENE}", defines()),
        )?;
        let body = lattice_texture(&gl, 0, CELLS.map(|n| n as i32), &occupancy())?;
        let [sw, sh, sd] = SELF_CELLS.map(|n| n as i32);
        let selves = lattice_texture(&gl, 2, [sw, sh, sd * SELVES as i32], &selves::occupancy())?;
        let labels = image_texture(&gl, 1, &labels)?;
        gl.use_program(Some(&scene.program));
        gl.uniform1i(scene.at("u_body"), 0);
        gl.uniform1i(scene.at("u_atlas"), 1);
        gl.uniform1i(scene.at("u_selves"), 2);
        let empty = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        Ok(Self {
            gl,
            canvas,
            scene,
            body,
            selves,
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
    /// Reduced motion holds one moment: the room and the inside both clear,
    /// the inner ring round the body inside the outer orbit.
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
        gl.delete_texture(Some(&self.body));
        gl.delete_texture(Some(&self.selves));
        gl.delete_texture(Some(&self.labels));
        gl.delete_vertex_array(Some(&self.empty));
        gl.delete_program(Some(&self.scene.program));
        self.disposed = true;
    }
}

impl InnerEcho {
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
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_texture(Gl::TEXTURE_3D, Some(&self.body));
        gl.active_texture(Gl::TEXTURE1);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&self.labels));
        gl.active_texture(Gl::TEXTURE2);
        gl.bind_texture(Gl::TEXTURE_3D, Some(&self.selves));

        // The whole 3:2 frame stays in view on a canvas of any shape.
        let (w, h) = (width as f32, height as f32);
        let aspect = w / h;
        let focal = 1.0 / f.lens;
        let view = [
            focal / aspect.max(FRAME_ASPECT),
            focal * aspect.min(FRAME_ASPECT) / FRAME_ASPECT,
            w,
            h,
        ];
        let p = &self.scene;
        let [ex, ey, ez] = f.eye;
        let [rx, ry, rz] = f.right;
        let [ux, uy, uz] = f.up;
        let [fx, fy, fz] = f.forward;
        let [w0, w1, w2] = f.waves;
        let [e0, e1, e2] = f.echoes;
        gl.use_program(Some(&p.program));
        gl.uniform4f(p.at("u_eye"), ex, ey, ez, f.time);
        gl.uniform4f(p.at("u_right"), rx, ry, rz, 0.0);
        gl.uniform4f(p.at("u_up"), ux, uy, uz, 0.0);
        gl.uniform4f(p.at("u_fwd"), fx, fy, fz, 0.0);
        gl.uniform4fv_with_f32_array(p.at("u_view"), &view);
        gl.uniform4f(p.at("u_wave"), w0[0], w1[0], w2[0], f.inward[0]);
        gl.uniform4f(p.at("u_front"), w0[1], w1[1], w2[1], f.inward[1]);
        gl.uniform4f(p.at("u_echo"), e0[0], e1[0], e2[0], f.together[0]);
        gl.uniform4f(p.at("u_echo_l"), e0[1], e1[1], e2[1], f.together[1]);
        let [ox, oy, oz] = f.orbit;
        let [sy, sz, sx, sd] = f.scan;
        let [s0, s1, s2, s3, s4, s5] = f.flares;
        let [row0, row1, words] = f.caption;
        gl.uniform4f(p.at("u_room"), f.room, f.shell, f.skin, 0.0);
        gl.uniform4f(p.at("u_inner"), f.inner, f.ring, f.ring_flow, f.outside);
        gl.uniform4f(p.at("u_orbit"), ox, oy, oz, f.orbit_flow);
        gl.uniform4f(p.at("u_ring"), sy, sz, sx, sd);
        gl.uniform4f(p.at("u_noise"), f.fall, f.grid, f.tremble, 0.0);
        gl.uniform4f(p.at("u_misc"), 0.0, f.knot_turn, f.projection, 0.0);
        gl.uniform4fv_with_f32_array(p.at("u_self"), &f.selves);
        gl.uniform4f(p.at("u_text"), row0, row1, words, 0.0);
        gl.uniform4f(p.at("u_flare_a"), s0, s1, s2, s3);
        gl.uniform4f(p.at("u_flare_b"), s4, s5, 0.0, 0.0);
        gl.uniform3fv_with_f32_array(p.at("u_cold"), &self.look.cold);
        gl.uniform3fv_with_f32_array(p.at("u_warm"), &self.look.warm);
        gl.uniform3fv_with_f32_array(p.at("u_pale"), &self.look.pale);
        gl.uniform3fv_with_f32_array(p.at("u_backdrop"), &self.backdrop);
        gl.uniform4fv_with_f32_array(p.at("u_edges"), &EDGES);
        gl.uniform4f(p.at("u_out"), f32::from(self.soft_edges), 0.0, 0.0, 0.0);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
