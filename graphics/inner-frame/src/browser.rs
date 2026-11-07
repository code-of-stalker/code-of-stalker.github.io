//! Browser adapter: three WebGL2 passes over the page. The floor grid is
//! traced per pixel (`floor.frag`); every stroke `draw` put into the `Pen`
//! is one instanced quad, lit additively in the theme's cold, pale and warm
//! (`line.vert`/`line.frag`); every callout is one more quad reading the
//! words' atlas, the scene's one loaded input (`label.vert`/`label.frag`).
//! Every value comes from `draw`; this file only uploads it.
use crate::generated::{ATLAS, LABEL_BAND, LABEL_BASE, LABEL_CAP, LABEL_INK};
use crate::pen::{Pen, LABEL_FLOATS, LINE_FLOATS, MAX_LINES};
use crate::{
    draw, look, Look, CENTRE, FRAME_ASPECT, GRID_LIGHT, GRID_REACH, GRID_STEP, LABEL_SIZE,
    LOOP_SECONDS, QUAKE, STILL, WORDS,
};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlBuffer, WebGlProgram,
    WebGlShader, WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const SCREEN: &str = include_str!("shaders/screen.vert");
const FLOOR: &str = include_str!("shaders/floor.frag");
const LINE_VERT: &str = include_str!("shaders/line.vert");
const LINE_FRAG: &str = include_str!("shaders/line.frag");
const LABEL_VERT: &str = include_str!("shaders/label.vert");
const LABEL_FRAG: &str = include_str!("shaders/label.frag");
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.07, 0.07, 0.1, 0.12];
/// The Тишина page, until the app says which page it is.
const PAGE: [f32; 3] = [13.0 / 255.0, 21.0 / 255.0, 32.0 / 255.0];
/// A hidden line: its dashes when it has none of its own, and its light.
const HIDDEN: [f32; 2] = [0.045, 0.45];
/// The most callouts one moment may hold.
const MAX_LABELS: usize = 16;
const NAMES: [&str; 14] = [
    "u_eye",
    "u_right",
    "u_up",
    "u_fwd",
    "u_view",
    "u_frame",
    "u_quake",
    "u_cold",
    "u_warm",
    "u_pale",
    "u_backdrop",
    "u_edges",
    "u_out",
    "u_atlas",
];

/// lib.rs's constants as the shaders' `#define`s, so both read one source.
fn defines() -> String {
    let f = |v: f32| format!("{v:?}");
    let v2 = |v: [f32; 2]| format!("vec2({:?}, {:?})", v[0], v[1]);
    let v3 = |v: [f32; 3]| format!("vec3({:?}, {:?}, {:?})", v[0], v[1], v[2]);
    let ink = LABEL_INK.map(v2).join(", ");
    let lines = [
        ("FRAME_ASPECT", f(FRAME_ASPECT)),
        ("CENTRE", v3(CENTRE)),
        ("HIDDEN", v2(HIDDEN)),
        ("GRID_STEP", v2(GRID_STEP)),
        ("GRID_LIGHT", v2(GRID_LIGHT)),
        ("GRID_REACH", v2(GRID_REACH)),
        ("QUAKE", v3(QUAKE)),
        ("ATLAS", v2(ATLAS)),
        ("WORDS", WORDS.to_string()),
        ("LABEL_INK_LIST", format!("vec2[{WORDS}]({ink})")),
        ("LABEL_BAND", v2(LABEL_BAND)),
        ("LABEL_BASE", f(LABEL_BASE)),
        ("LABEL_CAP", f(LABEL_CAP)),
        ("LABEL_SIZE", v2(LABEL_SIZE)),
    ];
    lines
        .iter()
        .map(|(name, value)| format!("#define {name} {value}\n"))
        .collect()
}

fn with_defines(source: &str) -> String {
    format!("#version 300 es\n{}{source}", defines())
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

/// The words on texture unit `slot`, mipmapped so they stay clean when drawn
/// smaller than baked, and blurred at the coarser levels for the knockout
/// under each word.
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

/// A vertex array reading `vec4` attributes 0.. from one instanced buffer
/// of `floats` a record, sized for `capacity` records.
fn instanced(
    gl: &Gl,
    floats: usize,
    capacity: usize,
) -> Result<(WebGlVertexArrayObject, WebGlBuffer), JsValue> {
    let vao = gl
        .create_vertex_array()
        .ok_or("Cannot allocate vertex array")?;
    let buffer = gl.create_buffer().ok_or("Cannot allocate buffer")?;
    gl.bind_vertex_array(Some(&vao));
    gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&buffer));
    gl.buffer_data_with_i32(
        Gl::ARRAY_BUFFER,
        (capacity * floats * 4) as i32,
        Gl::DYNAMIC_DRAW,
    );
    let stride = (floats * 4) as i32;
    for slot in 0..floats / 4 {
        let index = slot as u32;
        gl.enable_vertex_attrib_array(index);
        gl.vertex_attrib_pointer_with_i32(index, 4, Gl::FLOAT, false, stride, (slot * 16) as i32);
        gl.vertex_attrib_divisor(index, 1);
    }
    gl.bind_vertex_array(None);
    gl.bind_buffer(Gl::ARRAY_BUFFER, None);
    Ok((vao, buffer))
}

/// Writes `data` at the start of `buffer` (already sized for it).
fn upload(gl: &Gl, buffer: &WebGlBuffer, data: &[f32]) {
    gl.bind_buffer(Gl::ARRAY_BUFFER, Some(buffer));
    // SAFETY: the view is read by `bufferSubData` at once, before anything
    // can allocate in this module's memory and move `data`.
    let view = unsafe { js_sys::Float32Array::view(data) };
    gl.buffer_sub_data_with_i32_and_array_buffer_view(Gl::ARRAY_BUFFER, 0, &view);
    gl.bind_buffer(Gl::ARRAY_BUFFER, None);
}

#[wasm_bindgen]
pub struct InnerFrame {
    gl: Gl,
    canvas: HtmlCanvasElement,
    floor: Prog,
    lines: Prog,
    words: Prog,
    labels: WebGlTexture,
    empty: WebGlVertexArrayObject,
    line_vao: WebGlVertexArrayObject,
    line_buffer: WebGlBuffer,
    label_vao: WebGlVertexArrayObject,
    label_buffer: WebGlBuffer,
    pen: Pen,
    look: Look,
    soft_edges: bool,
    backdrop: [f32; 3],
    density: f32,
    elapsed: f32,
    last_time: Option<f64>,
    paused: bool,
    reduced: bool,
    disposed: bool,
    frames: u32,
}

#[wasm_bindgen]
impl InnerFrame {
    /// `labels` is the callouts' atlas (`assets/labels.webp`), decoded;
    /// everything else is drawn from `draw`.
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement, labels: HtmlImageElement) -> Result<InnerFrame, JsValue> {
        let options = js_sys::Object::new();
        js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"antialias".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &false.into())?;
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 unavailable")?
            .dyn_into()?;
        let floor = Prog::new(&gl, SCREEN, &with_defines(FLOOR))?;
        let lines = Prog::new(&gl, &with_defines(LINE_VERT), &with_defines(LINE_FRAG))?;
        let words = Prog::new(&gl, &with_defines(LABEL_VERT), &with_defines(LABEL_FRAG))?;
        let labels = image_texture(&gl, 0, &labels)?;
        gl.use_program(Some(&words.program));
        gl.uniform1i(words.at("u_atlas"), 0);
        let empty = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        let (line_vao, line_buffer) = instanced(&gl, LINE_FLOATS, MAX_LINES)?;
        let (label_vao, label_buffer) = instanced(&gl, LABEL_FLOATS, MAX_LABELS)?;
        Ok(Self {
            gl,
            canvas,
            floor,
            lines,
            words,
            labels,
            empty,
            line_vao,
            line_buffer,
            label_vao,
            label_buffer,
            pen: Pen::default(),
            look: look(2),
            soft_edges: false,
            backdrop: PAGE,
            density: 1.0,
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
    /// Canvas pixels per CSS pixel: the callouts never get smaller than a
    /// readable size on the page.
    pub fn density(&mut self, value: f32) {
        let value = if value.is_finite() {
            value.clamp(0.5, 4.0)
        } else {
            1.0
        };
        if self.density != value {
            self.density = value;
            self.draw();
        }
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
    /// Reduced motion holds one moment: the truss on its legs with the
    /// frame of the next levels over it, «КАРКАС» written by it.
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
        gl.delete_texture(Some(&self.labels));
        gl.delete_buffer(Some(&self.line_buffer));
        gl.delete_buffer(Some(&self.label_buffer));
        gl.delete_vertex_array(Some(&self.empty));
        gl.delete_vertex_array(Some(&self.line_vao));
        gl.delete_vertex_array(Some(&self.label_vao));
        for p in [&self.floor, &self.lines, &self.words] {
            gl.delete_program(Some(&p.program));
        }
        self.disposed = true;
    }
}

impl InnerFrame {
    /// The uniforms every pass shares.
    fn common(&self, p: &Prog, f: &crate::Frame, view: &[f32; 4], frame: &[f32; 4]) {
        let gl = &self.gl;
        let [ex, ey, ez] = f.eye;
        let [rx, ry, rz] = f.right;
        let [ux, uy, uz] = f.up;
        let [fx, fy, fz] = f.forward;
        gl.use_program(Some(&p.program));
        gl.uniform4f(p.at("u_eye"), ex, ey, ez, f.time);
        gl.uniform4f(p.at("u_right"), rx, ry, rz, 0.0);
        gl.uniform4f(p.at("u_up"), ux, uy, uz, 0.0);
        gl.uniform4f(p.at("u_fwd"), fx, fy, fz, 0.0);
        gl.uniform4fv_with_f32_array(p.at("u_view"), view);
        gl.uniform4fv_with_f32_array(p.at("u_frame"), frame);
        gl.uniform4fv_with_f32_array(p.at("u_quake"), &f.quake);
        gl.uniform3fv_with_f32_array(p.at("u_cold"), &self.look.cold);
        gl.uniform3fv_with_f32_array(p.at("u_warm"), &self.look.warm);
        gl.uniform3fv_with_f32_array(p.at("u_pale"), &self.look.pale);
        gl.uniform3fv_with_f32_array(p.at("u_backdrop"), &self.backdrop);
        gl.uniform4fv_with_f32_array(p.at("u_edges"), &EDGES);
        gl.uniform4f(p.at("u_out"), f32::from(self.soft_edges), 0.0, 0.0, 0.0);
    }

    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let f = draw(
            if self.reduced { STILL } else { self.elapsed },
            &mut self.pen,
        );
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
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
        // Pixels of a 720-high frame, the floor's light, the page density.
        let frame_height = h.min(w / FRAME_ASPECT);
        let frame = [frame_height / 720.0, f.grid, self.density, 0.0];
        let lines = self.pen.line_count().min(MAX_LINES);
        let labels = self.pen.label_count().min(MAX_LABELS);
        let gl = &self.gl;
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        gl.viewport(0, 0, width, height);

        // The page and the floor grid.
        gl.disable(Gl::BLEND);
        self.common(&self.floor, &f, &view, &frame);
        gl.bind_vertex_array(Some(&self.empty));
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);

        // Every stroke, as light added onto it.
        if lines > 0 {
            upload(
                gl,
                &self.line_buffer,
                &self.pen.lines[..lines * LINE_FLOATS],
            );
            gl.enable(Gl::BLEND);
            gl.blend_func(Gl::ONE, Gl::ONE);
            self.common(&self.lines, &f, &view, &frame);
            gl.bind_vertex_array(Some(&self.line_vao));
            gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, lines as i32);
        }

        // The callouts, each knocking the lines out behind its letters.
        if labels > 0 {
            upload(
                gl,
                &self.label_buffer,
                &self.pen.labels[..labels * LABEL_FLOATS],
            );
            gl.enable(Gl::BLEND);
            gl.blend_func(Gl::ONE, Gl::ONE_MINUS_SRC_ALPHA);
            self.common(&self.words, &f, &view, &frame);
            gl.active_texture(Gl::TEXTURE0);
            gl.bind_texture(Gl::TEXTURE_2D, Some(&self.labels));
            gl.bind_vertex_array(Some(&self.label_vao));
            gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 6, labels as i32);
        }
        gl.disable(Gl::BLEND);
        gl.bind_vertex_array(None);
        self.frames = self.frames.wrapping_add(1);
    }
}
