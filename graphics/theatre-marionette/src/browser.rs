//! Browser adapter: platform objects and GPU resources; choreography is in lib.rs.
use crate::{
    atmosphere::{self, Atmosphere, Plane},
    compose, control_point, deform, particle, strings, Frame, LOOP_SECONDS, MAX_STRENGTH, SIZE,
};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlBuffer, WebGlProgram,
    WebGlShader, WebGlTexture, WebGlUniformLocation,
};

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
fn program(gl: &Gl, vert: &str, frag: &str) -> Result<WebGlProgram, JsValue> {
    let v = shader(gl, Gl::VERTEX_SHADER, vert)?;
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
fn texture(gl: &Gl, slot: u32, image: &HtmlImageElement) -> Result<WebGlTexture, JsValue> {
    if image.natural_width() != 1536 || image.natural_height() != 1024 {
        return Err("Layer must be 1536 × 1024".into());
    }
    let t = gl.create_texture().ok_or("Cannot allocate texture")?;
    gl.active_texture(Gl::TEXTURE0 + slot);
    gl.bind_texture(Gl::TEXTURE_2D, Some(&t));
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MIN_FILTER, Gl::LINEAR as i32);
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
    Ok(t)
}
fn buffer(gl: &Gl, target: u32, bytes: i32) -> Result<WebGlBuffer, JsValue> {
    let b = gl.create_buffer().ok_or("Cannot allocate buffer")?;
    gl.bind_buffer(target, Some(&b));
    gl.buffer_data_with_i32(target, bytes, Gl::DYNAMIC_DRAW);
    Ok(b)
}

#[wasm_bindgen]
pub struct Marionette {
    gl: Gl,
    canvas: HtmlCanvasElement,
    image: WebGlProgram,
    line: WebGlProgram,
    spark: WebGlProgram,
    rain: WebGlProgram,
    textures: Vec<WebGlTexture>,
    vertices: WebGlBuffer,
    indices: WebGlBuffer,
    lines: WebGlBuffer,
    particles: WebGlBuffer,
    rain_buffer: WebGlBuffer,
    sampler: Option<WebGlUniformLocation>,
    kind: Option<WebGlUniformLocation>,
    light: Option<WebGlUniformLocation>,
    line_color: Option<WebGlUniformLocation>,
    point_density: Option<WebGlUniformLocation>,
    environment: Option<WebGlUniformLocation>,
    beams: Option<WebGlUniformLocation>,
    haze: Option<WebGlUniformLocation>,
    edge_widths: Option<WebGlUniformLocation>,
    backdrop_uniform: Option<WebGlUniformLocation>,
    soft_edges: bool,
    backdrop: [f32; 4],
    points: Vec<[f32; 2]>,
    mesh_data: Vec<f32>,
    line_data: Vec<f32>,
    particle_data: Vec<f32>,
    rain_data: Vec<f32>,
    background_points: Vec<[f32; 2]>,
    index_count: i32,
    elapsed: f64,
    last_time: Option<f64>,
    amount: f32,
    paused: bool,
    original: bool,
    reduced: bool,
    atmosphere_enabled: bool,
    disposed: bool,
    frames: u32,
}

#[wasm_bindgen]
impl Marionette {
    #[wasm_bindgen(constructor)]
    pub fn new(
        canvas: HtmlCanvasElement,
        source: HtmlImageElement,
        background: HtmlImageElement,
        heroine: HtmlImageElement,
    ) -> Result<Marionette, JsValue> {
        let options = js_sys::Object::new();
        js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"antialias".into(), &true.into())?;
        // Export creates each VideoFrame synchronously after seek(), before
        // yielding to presentation; the interactive buffer can be discarded.
        js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &false.into())?;
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 unavailable")?
            .dyn_into()?;
        let image = program(&gl, include_str!("image.vert"), include_str!("image.frag"))?;
        let line = program(&gl, include_str!("solid.vert"), include_str!("solid.frag"))?;
        let spark = program(
            &gl,
            include_str!("particle.vert"),
            include_str!("particle.frag"),
        )?;
        let rain = program(&gl, include_str!("rain.vert"), include_str!("rain.frag"))?;
        let textures = vec![
            texture(&gl, 0, &source)?,
            texture(&gl, 1, &background)?,
            texture(&gl, 2, &heroine)?,
        ];
        let sampler = gl.get_uniform_location(&image, "u_texture");
        let kind = gl.get_uniform_location(&image, "u_kind");
        let light = gl.get_uniform_location(&image, "u_light");
        let line_color = gl.get_uniform_location(&line, "u_color");
        let point_density = gl.get_uniform_location(&spark, "u_density");
        let environment = gl.get_uniform_location(&image, "u_environment");
        let beams = gl.get_uniform_location(&image, "u_beams[0]");
        let haze = gl.get_uniform_location(&image, "u_haze");
        let edge_widths = gl.get_uniform_location(&image, "u_edge_widths");
        let backdrop_uniform = gl.get_uniform_location(&image, "u_backdrop");
        const COLS: usize = 68;
        const ROWS: usize = 88;
        let mut points = Vec::with_capacity((COLS + 1) * (ROWS + 1));
        for y in 0..=ROWS {
            for x in 0..=COLS {
                points.push([
                    464.0 + x as f32 * 672.0 / COLS as f32,
                    90.0 + y as f32 * 912.0 / ROWS as f32,
                ]);
            }
        }
        let mut index_data = Vec::with_capacity(COLS * ROWS * 6);
        for y in 0..ROWS {
            for x in 0..COLS {
                let a = (y * (COLS + 1) + x) as u16;
                let b = a + 1;
                let c = a + (COLS + 1) as u16;
                let d = c + 1;
                index_data.extend_from_slice(&[a, b, c, b, d, c]);
            }
        }
        let index_count = index_data.len() as i32;
        let vertices = buffer(&gl, Gl::ARRAY_BUFFER, (points.len() * 16) as i32)?;
        let indices = buffer(&gl, Gl::ELEMENT_ARRAY_BUFFER, (index_data.len() * 2) as i32)?;
        gl.buffer_data_with_array_buffer_view(
            Gl::ELEMENT_ARRAY_BUFFER,
            &js_sys::Uint16Array::from(index_data.as_slice()),
            Gl::STATIC_DRAW,
        );
        let lines = buffer(&gl, Gl::ARRAY_BUFFER, 32768)?;
        let particles = buffer(&gl, Gl::ARRAY_BUFFER, 1024)?;
        // 548 glyphs, six vertices each, eight floats per vertex; one reusable
        // stream allocation for all depth planes. No GPU resources per tick.
        let rain_buffer = buffer(&gl, Gl::ARRAY_BUFFER, 120_000)?;
        let mut background_points = Vec::with_capacity(30 * 18 * 6);
        for y in 0..18 {
            for x in 0..30 {
                let p = [x as f32 * 1536.0 / 30.0, y as f32 * 1024.0 / 18.0];
                let q = [
                    (x + 1) as f32 * 1536.0 / 30.0,
                    (y + 1) as f32 * 1024.0 / 18.0,
                ];
                background_points.extend_from_slice(&[
                    p,
                    [q[0], p[1]],
                    [p[0], q[1]],
                    [p[0], q[1]],
                    [q[0], p[1]],
                    q,
                ]);
            }
        }
        let mesh_data = Vec::with_capacity(points.len() * 4);
        Ok(Self {
            gl,
            canvas,
            image,
            line,
            spark,
            rain,
            textures,
            vertices,
            indices,
            lines,
            particles,
            rain_buffer,
            sampler,
            kind,
            light,
            line_color,
            point_density,
            environment,
            beams,
            haze,
            edge_widths,
            backdrop_uniform,
            soft_edges: false,
            backdrop: [0.0, 0.0, 0.0, 1.0],
            points,
            mesh_data,
            line_data: Vec::with_capacity(8000),
            particle_data: Vec::with_capacity(160),
            rain_data: Vec::with_capacity(30_000),
            background_points,
            index_count,
            elapsed: 0.0,
            last_time: None,
            amount: MAX_STRENGTH,
            paused: false,
            original: false,
            reduced: false,
            atmosphere_enabled: true,
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
        self.gl.viewport(0, 0, width as i32, height as i32);
        self.draw();
    }
    pub fn frame(&mut self, milliseconds: f64) {
        if !milliseconds.is_finite() {
            return;
        }
        if !self.paused && !self.original && !self.reduced {
            if let Some(previous) = self.last_time {
                let dt = ((milliseconds - previous) / 1000.0).clamp(0.0, 0.1);
                self.elapsed = (self.elapsed + dt).rem_euclid(LOOP_SECONDS);
            }
        }
        self.last_time = Some(milliseconds);
        self.draw();
    }
    pub fn seek(&mut self, seconds: f64) {
        self.elapsed = if seconds.is_finite() {
            seconds.rem_euclid(LOOP_SECONDS)
        } else {
            0.0
        };
        self.last_time = None;
        self.draw();
    }
    pub fn elapsed(&self) -> f64 {
        self.elapsed
    }
    pub fn suspend(&mut self) {
        self.last_time = None;
    }
    pub fn pause(&mut self, value: bool) {
        self.paused = value;
        self.last_time = None;
    }
    pub fn original(&mut self, value: bool) {
        self.original = value;
        self.last_time = None;
        self.draw();
    }
    pub fn reduced(&mut self, value: bool) {
        self.reduced = value;
        self.last_time = None;
        self.draw();
    }
    pub fn strength(&mut self, value: f32) {
        self.amount = if value.is_finite() {
            value.clamp(0.0, MAX_STRENGTH)
        } else {
            1.0
        };
        self.draw();
    }
    pub fn atmosphere(&mut self, enabled: bool) {
        self.atmosphere_enabled = enabled;
        self.draw();
    }
    /// Embed the entire scene into the surrounding page, without changing its
    /// choreography or rebuilding any GPU resources.
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
        let color = [
            red.clamp(0.0, 1.0),
            green.clamp(0.0, 1.0),
            blue.clamp(0.0, 1.0),
            1.0,
        ];
        if self.backdrop != color {
            self.backdrop = color;
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
        for texture in &self.textures {
            self.gl.delete_texture(Some(texture));
        }
        for b in [
            &self.vertices,
            &self.indices,
            &self.lines,
            &self.particles,
            &self.rain_buffer,
        ] {
            self.gl.delete_buffer(Some(b));
        }
        for p in [&self.image, &self.line, &self.spark, &self.rain] {
            self.gl.delete_program(Some(p));
        }
        self.disposed = true;
    }
}

impl Marionette {
    fn draw_background(&mut self, f: &Frame, scene: &Atmosphere) {
        self.gl.use_program(Some(&self.image));
        self.gl.uniform1f(
            self.environment.as_ref(),
            if self.atmosphere_enabled { 1.0 } else { 0.0 },
        );
        let mut beams = [0.0; 12];
        for (target, source) in beams.as_chunks_mut::<4>().0.iter_mut().zip(scene.beams) {
            target.copy_from_slice(&source);
        }
        self.gl
            .uniform4fv_with_f32_array(self.beams.as_ref(), &beams);
        self.gl
            .uniform4fv_with_f32_array(self.haze.as_ref(), &scene.haze);
        if !self.atmosphere_enabled {
            self.quad(1, 0.0, f.light);
            return;
        }
        self.mesh_data.clear();
        for &p in &self.background_points {
            let uv = atmosphere::background_uv(p, scene);
            self.mesh_data
                .extend_from_slice(&[p[0], p[1], uv[0], uv[1]]);
        }
        self.image_binding(1, 0.0, f.light);
        self.image_vertices(&self.mesh_data);
    }

    fn draw_rain(&mut self, f: &Frame, scene: &Atmosphere, planes: &[Plane]) {
        self.rain_data.clear();
        for &plane in planes {
            for column in 0..plane.columns() {
                for row in 0..plane.length() {
                    let g = atmosphere::glyph(plane, column, row, f, scene);
                    if g.alpha < 0.002 {
                        continue;
                    }
                    for uv in [[0., 0.], [1., 0.], [0., 1.], [0., 1.], [1., 0.], [1., 1.]] {
                        self.rain_data.extend_from_slice(&[
                            g.position[0] + (uv[0] - 0.5) * g.size[0],
                            g.position[1] + uv[1] * g.size[1],
                            uv[0],
                            uv[1],
                            g.strokes as f32,
                            g.alpha,
                            g.softness,
                            0.0,
                        ]);
                    }
                }
            }
        }
        let gl = &self.gl;
        gl.use_program(Some(&self.rain));
        gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&self.rain_buffer));
        gl.buffer_sub_data_with_i32_and_array_buffer_view(
            Gl::ARRAY_BUFFER,
            0,
            &js_sys::Float32Array::from(self.rain_data.as_slice()),
        );
        gl.enable_vertex_attrib_array(0);
        gl.vertex_attrib_pointer_with_i32(0, 4, Gl::FLOAT, false, 32, 0);
        gl.enable_vertex_attrib_array(1);
        gl.vertex_attrib_pointer_with_i32(1, 4, Gl::FLOAT, false, 32, 16);
        gl.draw_arrays(Gl::TRIANGLES, 0, (self.rain_data.len() / 8) as i32);
        gl.disable_vertex_attrib_array(1);
    }

    fn image_binding(&self, slot: i32, kind: f32, light: f32) {
        let gl = &self.gl;
        gl.use_program(Some(&self.image));
        gl.uniform1i(self.sampler.as_ref(), slot);
        gl.uniform1f(self.kind.as_ref(), kind);
        gl.uniform1f(self.light.as_ref(), light);
        gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&self.vertices));
        gl.enable_vertex_attrib_array(0);
        gl.vertex_attrib_pointer_with_i32(0, 4, Gl::FLOAT, false, 16, 0);
    }
    fn image_vertices(&self, data: &[f32]) {
        let gl = &self.gl;
        gl.buffer_sub_data_with_i32_and_array_buffer_view(
            Gl::ARRAY_BUFFER,
            0,
            &js_sys::Float32Array::from(data),
        );
        gl.draw_arrays(Gl::TRIANGLES, 0, (data.len() / 4) as i32);
    }
    fn quad(&self, slot: i32, kind: f32, light: f32) {
        self.image_binding(slot, kind, light);
        self.image_vertices(&[
            0., 0., 0., 0., 1536., 0., 1., 0., 0., 1024., 0., 1., 0., 1024., 0., 1., 1536., 0., 1.,
            0., 1536., 1024., 1., 1.,
        ]);
    }
    fn draw_bar(&mut self, f: &Frame) {
        // Tight authored polygons retain the actual wooden control texture.
        // Only their world positions move; the source UVs and corner shape stay fixed.
        const PARTS: [&[[f32; 2]]; 2] = [
            &[
                [576., 1.],
                [605., 0.],
                [947., 72.],
                [939., 98.],
                [580., 28.],
            ],
            &[[616., 80.], [827., 0.], [886., 0.], [630., 110.]],
        ];
        self.mesh_data.clear();
        for part in PARTS {
            for i in 1..part.len() - 1 {
                for p in [part[0], part[i], part[i + 1]] {
                    let world = control_point(p, f);
                    self.mesh_data.extend_from_slice(&[
                        world[0],
                        world[1],
                        p[0] / SIZE[0],
                        p[1] / SIZE[1],
                    ]);
                }
            }
        }
        self.image_binding(0, 3.0, 1.0);
        self.image_vertices(&self.mesh_data);
    }
    fn draw_hero(&mut self, f: &Frame) {
        self.mesh_data.clear();
        for &p in &self.points {
            let world = deform(p, f);
            self.mesh_data
                .extend_from_slice(&[world[0], world[1], p[0] / SIZE[0], p[1] / SIZE[1]]);
        }
        self.image_binding(2, 1.0, 1.0);
        self.gl.buffer_sub_data_with_i32_and_array_buffer_view(
            Gl::ARRAY_BUFFER,
            0,
            &js_sys::Float32Array::from(self.mesh_data.as_slice()),
        );
        self.gl
            .bind_buffer(Gl::ELEMENT_ARRAY_BUFFER, Some(&self.indices));
        self.gl
            .draw_elements_with_i32(Gl::TRIANGLES, self.index_count, Gl::UNSIGNED_SHORT, 0);
    }
    fn draw_strings(&mut self, f: &Frame, width: f32, alpha: f32) {
        self.line_data.clear();
        for (index, (a, b)) in strings(f).into_iter().enumerate() {
            let length = ((b[0] - a[0]).powi(2) + (b[1] - a[1]).powi(2))
                .sqrt()
                .max(1.0);
            let normal = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
            let bend = (f.phase * 2.0 + index as f32 * 1.7).sin() * 1.5 * f.strength;
            let point = |t: f32| {
                [
                    a[0] + (b[0] - a[0]) * t + normal[0] * (t * std::f32::consts::PI).sin() * bend,
                    a[1] + (b[1] - a[1]) * t + normal[1] * (t * std::f32::consts::PI).sin() * bend,
                ]
            };
            for step in 0..24 {
                let p = point(step as f32 / 24.0);
                let q = point((step + 1) as f32 / 24.0);
                for (v, side) in [(p, -1.), (p, 1.), (q, -1.), (q, -1.), (p, 1.), (q, 1.)] {
                    self.line_data.extend_from_slice(&[
                        v[0] + normal[0] * width * side / 2.0,
                        v[1] + normal[1] * width * side / 2.0,
                    ]);
                }
            }
        }
        let gl = &self.gl;
        gl.use_program(Some(&self.line));
        gl.uniform4f(self.line_color.as_ref(), 1.0, 0.81, 0.26, alpha);
        gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&self.lines));
        gl.buffer_sub_data_with_i32_and_array_buffer_view(
            Gl::ARRAY_BUFFER,
            0,
            &js_sys::Float32Array::from(self.line_data.as_slice()),
        );
        gl.enable_vertex_attrib_array(0);
        gl.vertex_attrib_pointer_with_i32(0, 2, Gl::FLOAT, false, 8, 0);
        gl.draw_arrays(Gl::TRIANGLES, 0, (self.line_data.len() / 2) as i32);
    }
    fn draw_particles(&mut self, f: &Frame, near: bool) {
        self.particle_data.clear();
        let count = if near { 18 } else { 40 };
        for i in 0..count {
            self.particle_data.extend_from_slice(&if near {
                atmosphere::near_particle(i, f)
            } else {
                particle(i, f)
            });
        }
        let gl = &self.gl;
        gl.use_program(Some(&self.spark));
        gl.uniform1f(
            self.point_density.as_ref(),
            self.canvas.width() as f32 / 1536.0,
        );
        gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&self.particles));
        gl.buffer_sub_data_with_i32_and_array_buffer_view(
            Gl::ARRAY_BUFFER,
            0,
            &js_sys::Float32Array::from(self.particle_data.as_slice()),
        );
        gl.enable_vertex_attrib_array(0);
        gl.vertex_attrib_pointer_with_i32(0, 4, Gl::FLOAT, false, 16, 0);
        gl.draw_arrays(Gl::POINTS, 0, count as i32);
    }
    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        self.gl.disable(Gl::BLEND);
        if self.original || self.reduced {
            self.quad(0, 2.0, 1.0);
        } else {
            let f = compose(self.elapsed, self.amount);
            let scene = atmosphere::sample(&f);
            self.draw_background(&f, &scene);
            self.gl.enable(Gl::BLEND);
            self.gl.blend_func(Gl::SRC_ALPHA, Gl::ONE);
            if self.atmosphere_enabled {
                self.draw_rain(&f, &scene, &[Plane::Far, Plane::Middle]);
                self.draw_particles(&f, false);
            }
            let width = (1536.0 / self.canvas.width() as f32).max(1.2);
            self.draw_strings(&f, width * 4.0, 0.13);
            self.draw_strings(&f, width, 0.88);
            self.gl.blend_func(Gl::SRC_ALPHA, Gl::ONE_MINUS_SRC_ALPHA);
            self.draw_hero(&f);
            self.draw_bar(&f);
            self.gl.blend_func(Gl::SRC_ALPHA, Gl::ONE);
            if self.atmosphere_enabled {
                self.draw_rain(&f, &scene, &[Plane::Near]);
                self.quad(1, 4.0, 1.0);
                self.draw_particles(&f, true);
            } else {
                self.draw_particles(&f, false);
            }
            self.gl.disable(Gl::BLEND);
        }
        if self.soft_edges {
            self.gl.use_program(Some(&self.image));
            // Left, right, top, bottom: preserve the central heroine while
            // letting the floor reflection fade gently into the page.
            self.gl
                .uniform4f(self.edge_widths.as_ref(), 0.12, 0.12, 0.14, 0.18);
            self.gl
                .uniform4fv_with_f32_array(self.backdrop_uniform.as_ref(), &self.backdrop);
            self.gl.enable(Gl::BLEND);
            self.gl.blend_func(Gl::SRC_ALPHA, Gl::ONE_MINUS_SRC_ALPHA);
            self.quad(0, 5.0, 1.0);
            self.gl.disable(Gl::BLEND);
        }
        self.gl.disable_vertex_attrib_array(0);
        self.frames = self.frames.wrapping_add(1);
    }
}
