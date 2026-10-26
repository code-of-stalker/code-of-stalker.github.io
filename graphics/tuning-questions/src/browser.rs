//! Browser adapter: WebGL2 objects and draw order. Every motion value comes
//! from `compose` and the generators in `geometry`.
use crate::geometry::{self, Mesh, Scene};
use crate::{compose, look, Frame, Look, FIGURE, LOOP_SECONDS, SIZE, STILL};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlBuffer,
    WebGlFramebuffer, WebGlProgram, WebGlShader, WebGlTexture, WebGlUniformLocation,
    WebGlVertexArrayObject,
};

const VERTEX: &str = include_str!("shaders/shape.vert");
const FIGURE_UNIT: i32 = 0;
const ATLAS_UNIT: i32 = 1;
const SCENE: i32 = 2;
const BLOOM: i32 = 3;
const WIDE: i32 = 4;
const SPARE: i32 = 5;
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.1, 0.1, 0.12, 0.16];
/// Authored px → clip.
const VIEW: [f32; 4] = [2.0 / SIZE[0], -2.0 / SIZE[1], -1.0, 1.0];

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
fn program(gl: &Gl, frag: &str) -> Result<WebGlProgram, JsValue> {
    let v = shader(gl, Gl::VERTEX_SHADER, VERTEX)?;
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
    Ok(p)
}

/// One program with its uniform locations looked up once.
struct Pass {
    program: WebGlProgram,
    uniforms: Vec<(&'static str, Option<WebGlUniformLocation>)>,
}
impl Pass {
    fn new(gl: &Gl, fragment: &str, names: &[&'static str]) -> Result<Self, JsValue> {
        let program = program(gl, fragment)?;
        let uniforms = std::iter::once("u_view")
            .chain(names.iter().copied())
            .map(|name| (name, gl.get_uniform_location(&program, name)))
            .collect();
        Ok(Self { program, uniforms })
    }
    fn at(&self, name: &str) -> Option<&WebGlUniformLocation> {
        self.uniforms
            .iter()
            .find(|(n, _)| *n == name)
            .and_then(|(_, location)| location.as_ref())
    }
}

fn image_texture(gl: &Gl, slot: i32, image: &HtmlImageElement) -> Result<WebGlTexture, JsValue> {
    let t = gl.create_texture().ok_or("Cannot allocate texture")?;
    gl.active_texture(Gl::TEXTURE0 + slot as u32);
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

/// An offscreen color target.
struct Target {
    texture: WebGlTexture,
    frame: WebGlFramebuffer,
    size: [i32; 2],
}
impl Target {
    fn new(gl: &Gl, slot: i32, size: [i32; 2]) -> Result<Self, JsValue> {
        let texture = gl.create_texture().ok_or("Cannot allocate texture")?;
        gl.active_texture(Gl::TEXTURE0 + slot as u32);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&texture));
        for (name, value) in [
            (Gl::TEXTURE_MIN_FILTER, Gl::LINEAR),
            (Gl::TEXTURE_MAG_FILTER, Gl::LINEAR),
            (Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE),
            (Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE),
        ] {
            gl.tex_parameteri(Gl::TEXTURE_2D, name, value as i32);
        }
        gl.tex_storage_2d(Gl::TEXTURE_2D, 1, Gl::RGBA8, size[0], size[1]);
        let frame = gl
            .create_framebuffer()
            .ok_or("Cannot allocate framebuffer")?;
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&frame));
        gl.framebuffer_texture_2d(
            Gl::FRAMEBUFFER,
            Gl::COLOR_ATTACHMENT0,
            Gl::TEXTURE_2D,
            Some(&texture),
            0,
        );
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        Ok(Self {
            texture,
            frame,
            size,
        })
    }
    fn delete(&self, gl: &Gl) {
        gl.delete_texture(Some(&self.texture));
        gl.delete_framebuffer(Some(&self.frame));
    }
}

/// First vertex and vertex count of one layer in the frame's shared buffer.
type Span = (i32, i32);
fn span(mesh: &mut Mesh, build: impl FnOnce(&mut Mesh)) -> Span {
    let start = mesh.vertices();
    build(mesh);
    (start, mesh.vertices() - start)
}
/// One draw of the figure program: its quad and its mode.
struct FigureDraw {
    quad: Span,
    mode: f32,
}

#[wasm_bindgen]
pub struct TuningQuestions {
    gl: Gl,
    canvas: HtmlCanvasElement,
    soft: Pass,
    figure: Pass,
    text: Pass,
    blur: Pass,
    composite: Pass,
    texture: WebGlTexture,
    atlas: WebGlTexture,
    targets: Option<[Target; 4]>,
    vertices: WebGlBuffer,
    layout: WebGlVertexArrayObject,
    scene: Scene,
    mesh: Mesh,
    bytes: Vec<u8>,
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
impl TuningQuestions {
    #[wasm_bindgen(constructor)]
    pub fn new(
        canvas: HtmlCanvasElement,
        figure: HtmlImageElement,
        labels: HtmlImageElement,
    ) -> Result<TuningQuestions, JsValue> {
        let options = js_sys::Object::new();
        js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"antialias".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &false.into())?;
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 unavailable")?
            .dyn_into()?;
        let soft = Pass::new(&gl, include_str!("shaders/soft.frag"), &[])?;
        let figure_pass = Pass::new(
            &gl,
            include_str!("shaders/figure.frag"),
            &["u_figure", "u_mode", "u_light", "u_scan"],
        )?;
        let text = Pass::new(&gl, include_str!("shaders/text.frag"), &["u_atlas"])?;
        let blur = Pass::new(
            &gl,
            include_str!("shaders/bloom.frag"),
            &["u_source", "u_step", "u_threshold", "u_body"],
        )?;
        let composite = Pass::new(
            &gl,
            include_str!("shaders/composite.frag"),
            &[
                "u_scene",
                "u_bloom",
                "u_wide",
                "u_paper",
                "u_room",
                "u_person",
                "u_body",
                "u_haze",
                "u_backdrop",
                "u_cone_a",
                "u_cone_b",
                "u_air",
                "u_post",
                "u_edges",
            ],
        )?;
        let texture = image_texture(&gl, FIGURE_UNIT, &figure)?;
        let atlas = image_texture(&gl, ATLAS_UNIT, &labels)?;
        gl.use_program(Some(&figure_pass.program));
        gl.uniform1i(figure_pass.at("u_figure"), FIGURE_UNIT);
        gl.use_program(Some(&text.program));
        gl.uniform1i(text.at("u_atlas"), ATLAS_UNIT);
        gl.use_program(Some(&composite.program));
        gl.uniform1i(composite.at("u_scene"), SCENE);
        gl.uniform1i(composite.at("u_bloom"), BLOOM);
        gl.uniform1i(composite.at("u_wide"), WIDE);
        gl.uniform4fv_with_f32_array(composite.at("u_edges"), &EDGES);

        let layout = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        gl.bind_vertex_array(Some(&layout));
        let vertices = gl.create_buffer().ok_or("Cannot allocate buffer")?;
        gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&vertices));
        let stride = (geometry::STRIDE * 4) as i32;
        for (index, size, offset) in [(0, 2, 0), (1, 2, 8), (2, 4, 16), (3, 3, 32)] {
            gl.enable_vertex_attrib_array(index);
            gl.vertex_attrib_pointer_with_i32(index, size, Gl::FLOAT, false, stride, offset);
        }
        Ok(Self {
            gl,
            canvas,
            soft,
            figure: figure_pass,
            text,
            blur,
            composite,
            texture,
            atlas,
            targets: None,
            vertices,
            layout,
            scene: Scene::new(),
            mesh: Mesh::new(40_000),
            bytes: Vec::with_capacity(40_000 * geometry::STRIDE * 4),
            look: look(0),
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
    /// Reduced motion holds one composed moment: the line and the person,
    /// both seen.
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
        self.gl.delete_texture(Some(&self.texture));
        self.gl.delete_texture(Some(&self.atlas));
        if let Some(targets) = self.targets.take() {
            for t in &targets {
                t.delete(&self.gl);
            }
        }
        self.gl.delete_buffer(Some(&self.vertices));
        self.gl.delete_vertex_array(Some(&self.layout));
        for pass in [
            &self.soft,
            &self.figure,
            &self.text,
            &self.blur,
            &self.composite,
        ] {
            self.gl.delete_program(Some(&pass.program));
        }
        self.disposed = true;
    }
}

impl TuningQuestions {
    fn ensure_targets(&mut self, width: i32, height: i32) -> Result<(), JsValue> {
        let quarter = [(width / 4).max(1), (height / 4).max(1)];
        let eighth = [(width / 8).max(1), (height / 8).max(1)];
        if let Some(t) = &self.targets {
            if t[0].size == [width, height] {
                return Ok(());
            }
        }
        if let Some(old) = self.targets.take() {
            for t in &old {
                t.delete(&self.gl);
            }
        }
        let gl = &self.gl;
        self.targets = Some([
            Target::new(gl, SCENE, [width, height])?,
            Target::new(gl, BLOOM, quarter)?,
            Target::new(gl, WIDE, eighth)?,
            Target::new(gl, SPARE, quarter)?,
        ]);
        Ok(())
    }
    fn upload(&mut self, mesh: &Mesh) {
        self.bytes.clear();
        for value in &mesh.data {
            self.bytes.extend_from_slice(&value.to_le_bytes());
        }
        self.gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&self.vertices));
        self.gl
            .buffer_data_with_u8_array(Gl::ARRAY_BUFFER, &self.bytes, Gl::DYNAMIC_DRAW);
    }
    fn begin(&self, pass: &Pass) {
        self.gl.use_program(Some(&pass.program));
        self.gl.uniform4fv_with_f32_array(pass.at("u_view"), &VIEW);
    }
    fn draw_span(&self, (first, count): Span) {
        if count > 0 {
            self.gl.draw_arrays(Gl::TRIANGLES, first, count);
        }
    }
    fn render_to(&self, target: Option<&Target>) {
        let gl = &self.gl;
        match target {
            Some(t) => {
                gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&t.frame));
                gl.viewport(0, 0, t.size[0], t.size[1]);
            }
            None => {
                gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
                gl.viewport(
                    0,
                    0,
                    self.canvas.width() as i32,
                    self.canvas.height() as i32,
                );
            }
        }
    }
    /// One blur direction from `source` (bound to `unit`) into `target`.
    fn blur_pass(
        &self,
        unit: i32,
        source: [i32; 2],
        target: &Target,
        along: [f32; 2],
        threshold: f32,
        quad: Span,
    ) {
        self.render_to(Some(target));
        self.begin(&self.blur);
        let gl = &self.gl;
        gl.uniform1i(self.blur.at("u_source"), unit);
        gl.uniform2f(
            self.blur.at("u_step"),
            along[0] / source[0] as f32,
            along[1] / source[1] as f32,
        );
        gl.uniform1f(self.blur.at("u_threshold"), threshold);
        gl.uniform1f(self.blur.at("u_body"), f32::from(unit == SCENE));
        self.draw_span(quad);
    }
    fn figure_draw(&self, f: &Frame, d: &FigureDraw) {
        let gl = &self.gl;
        let cam = &f.camera;
        let depth = cam.subject();
        let coc = cam.coc(depth);
        let px_per_m = cam.focal / depth;
        let size = [
            (FIGURE[2] - FIGURE[0]) * px_per_m,
            (FIGURE[3] - FIGURE[1]) * px_per_m,
        ];
        // The reflection lies a little deeper: softer.
        let extra = if d.mode == 1.0 { 1.8 } else { 1.0 };
        gl.uniform4f(
            self.figure.at("u_mode"),
            d.mode,
            1.0,
            coc * extra / size[0],
            coc * extra / size[1],
        );
        self.draw_span(d.quad);
    }

    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        if self.ensure_targets(width, height).is_err() {
            return;
        }
        let f = compose(if self.reduced { STILL } else { self.elapsed });
        let mut mesh = std::mem::take(&mut self.mesh);
        mesh.clear();
        mesh.pixel = (SIZE[0] / width.max(1) as f32).max(0.5);
        let s = &self.scene;
        let quad = span(&mut mesh, |m| {
            // The screen in texture coordinates (GL rows start at the bottom).
            m.quad(
                [
                    [0.0, 0.0],
                    [SIZE[0], 0.0],
                    [SIZE[0], SIZE[1]],
                    [0.0, SIZE[1]],
                ],
                [[0.0, 1.0], [1.0, 1.0], [1.0, 0.0], [0.0, 0.0]],
                [[0.0; 4]; 4],
                [[0.0; 3]; 4],
            )
        });
        let behind = span(&mut mesh, |m| {
            geometry::floor(m, &f);
            geometry::architecture(m, &f);
            geometry::dust(m, s, &f, false);
            geometry::rings(m, &f, false);
        });
        let cam = f.camera;
        let figures = [
            FigureDraw {
                quad: span(&mut mesh, |m| {
                    geometry::figure_quad(m, &cam, true);
                }),
                mode: 1.0,
            },
            FigureDraw {
                quad: span(&mut mesh, |m| {
                    geometry::figure_quad(m, &cam, false);
                }),
                mode: 0.0,
            },
        ];
        let front = span(&mut mesh, |m| {
            geometry::rings(m, &f, true);
            geometry::scan_marks(m, &f);
            geometry::voice(m, &f);
            geometry::conclusion(m, s, &f);
            geometry::trace(m, &f);
            geometry::start(m, &f);
            geometry::dust(m, s, &f, true);
            geometry::card(m, &f);
        });
        let words = span(&mut mesh, |m| geometry::labels(m, &f));
        self.upload(&mesh);
        self.mesh = mesh;

        let Some(targets) = &self.targets else {
            return;
        };
        let gl = &self.gl;
        gl.bind_vertex_array(Some(&self.layout));
        self.render_to(Some(&targets[0]));
        gl.clear_color(0.0, 0.0, 0.0, 0.0);
        gl.clear(Gl::COLOR_BUFFER_BIT);
        gl.enable(Gl::BLEND);
        gl.blend_func(Gl::ONE, Gl::ONE_MINUS_SRC_ALPHA);
        self.begin(&self.soft);
        self.draw_span(behind);
        self.begin(&self.figure);
        gl.uniform4f(
            self.figure.at("u_light"),
            f.contour,
            f.breath,
            f.time,
            f.light,
        );
        gl.uniform4f(self.figure.at("u_scan"), f.scan[0], f.scan[1], f.felt, 9.0);
        for d in &figures {
            self.figure_draw(&f, d);
        }
        self.begin(&self.soft);
        self.draw_span(front);
        self.begin(&self.text);
        self.draw_span(words);

        // Bloom: a quarter-size glow and a wider eighth-size one.
        gl.disable(Gl::BLEND);
        let full = targets[0].size;
        let quarter = targets[1].size;
        self.blur_pass(SCENE, full, &targets[3], [2.0, 0.0], 0.03, quad);
        self.blur_pass(SPARE, quarter, &targets[1], [0.0, 1.0], 0.0, quad);
        self.blur_pass(BLOOM, quarter, &targets[3], [1.0, 0.0], 0.0, quad);
        self.blur_pass(SPARE, quarter, &targets[2], [0.0, 2.0], 0.0, quad);

        // The air, the theme, grain and the page edges, onto the canvas.
        self.render_to(None);
        self.begin(&self.composite);
        let l = &self.look;
        let c = &self.composite;
        gl.uniform3fv_with_f32_array(c.at("u_paper"), &l.paper);
        gl.uniform3fv_with_f32_array(c.at("u_room"), &l.room);
        gl.uniform3fv_with_f32_array(c.at("u_person"), &l.person);
        gl.uniform3fv_with_f32_array(c.at("u_body"), &l.body);
        gl.uniform3fv_with_f32_array(c.at("u_haze"), &l.haze);
        gl.uniform3fv_with_f32_array(c.at("u_backdrop"), &self.backdrop);
        let cone = geometry::cone(&f.camera);
        gl.uniform4fv_with_f32_array(c.at("u_cone_a"), &cone[..4]);
        gl.uniform4fv_with_f32_array(c.at("u_cone_b"), &cone[4..]);
        gl.uniform4f(
            c.at("u_air"),
            f.camera.center[1],
            f.light,
            f.time / LOOP_SECONDS * std::f32::consts::TAU,
            f.camera.eye[0],
        );
        gl.uniform4f(
            c.at("u_post"),
            f32::from(l.light),
            if l.light { 0.0 } else { 0.5 },
            if self.reduced {
                0.0
            } else {
                (f.time * 24.0).floor() * 0.37
            },
            f32::from(self.soft_edges),
        );
        self.draw_span(quad);
        self.frames = self.frames.wrapping_add(1);
    }
}
