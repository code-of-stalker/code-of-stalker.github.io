use crate::{compose, Frame, LOOP_SECONDS, MAX_MOTION_STRENGTH};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Themed;
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlBuffer, WebGlProgram,
    WebGlShader, WebGlTexture, WebGlUniformLocation,
};

fn shader(gl: &Gl, kind: u32, source: &str) -> Result<WebGlShader, JsValue> {
    let shader = gl.create_shader(kind).ok_or("Cannot create shader")?;
    let source = source.replace("// @shared", include_str!("shared.glsl"));
    gl.shader_source(&shader, &source);
    gl.compile_shader(&shader);
    if !gl
        .get_shader_parameter(&shader, Gl::COMPILE_STATUS)
        .as_bool()
        .unwrap_or(false)
    {
        let message = gl.get_shader_info_log(&shader).unwrap_or_default();
        gl.delete_shader(Some(&shader));
        return Err(JsValue::from_str(&message));
    }
    Ok(shader)
}

fn program(gl: &Gl, vert: &str, frag: &str) -> Result<WebGlProgram, JsValue> {
    let v = shader(gl, Gl::VERTEX_SHADER, vert)?;
    let f = shader(gl, Gl::FRAGMENT_SHADER, frag)?;
    let p = gl.create_program().ok_or("Cannot create shader program")?;
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
        let message = gl.get_program_info_log(&p).unwrap_or_default();
        gl.delete_program(Some(&p));
        return Err(JsValue::from_str(&message));
    }
    Ok(p)
}

fn texture(gl: &Gl, slot: u32, image: &HtmlImageElement) -> Result<WebGlTexture, JsValue> {
    if image.natural_width() != 1536 || image.natural_height() != 1024 {
        return Err(JsValue::from_str("Scene layer must be 1536 × 1024"));
    }
    let t = gl.create_texture().ok_or("Cannot create scene texture")?;
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
    gl.tex_image_2d_with_u32_and_u32_and_html_image_element(
        Gl::TEXTURE_2D,
        0,
        Gl::RGBA as i32,
        Gl::RGBA,
        Gl::UNSIGNED_BYTE,
        image,
    )?;
    // The authored layers are much larger than a phone illustration. Filter their
    // fine engraving before minification so motion does not sparkle between texels.
    gl.generate_mipmap(Gl::TEXTURE_2D);
    Ok(t)
}

#[wasm_bindgen]
pub struct CloudDrift {
    gl: Gl,
    canvas: HtmlCanvasElement,
    scene: WebGlProgram,
    spark: WebGlProgram,
    contours: WebGlProgram,
    textures: Vec<WebGlTexture>,
    buffer: WebGlBuffer,
    contour_buffer: WebGlBuffer,
    contour_count: i32,
    uniforms: Vec<Option<WebGlUniformLocation>>,
    contour_uniforms: Vec<Option<WebGlUniformLocation>>,
    spark_view: Option<WebGlUniformLocation>,
    spark_viewport: Option<WebGlUniformLocation>,
    particle_data: Vec<f32>,
    elapsed: f64,
    last_time: Option<f64>,
    amount: f32,
    accent: [f32; 3],
    background: [f32; 3],
    themed: Themed,
    /// The recolor pass owns the page edges while a theme is active.
    offscreen: bool,
    /// Drawn from the light paintings: effects ink the pale page instead of lighting it.
    light: bool,
    original: bool,
    reduced: bool,
    paused: bool,
    wireframe: bool,
    effects: [f32; 3],
    scan_clock: Option<f64>,
    suppress_auto_scan: bool,
    pointer: [f32; 2],
    target: [f32; 2],
    disposed: bool,
    frames: u32,
}

#[wasm_bindgen]
impl CloudDrift {
    #[wasm_bindgen(constructor)]
    pub fn new(
        canvas: HtmlCanvasElement,
        source: HtmlImageElement,
        plate: HtmlImageElement,
        person: HtmlImageElement,
        // Only the light paintings pass the matte of their floating visions.
        matte: Option<HtmlImageElement>,
    ) -> Result<CloudDrift, JsValue> {
        let options = js_sys::Object::new();
        js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"antialias".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &true.into())?;
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 is unavailable")?
            .dyn_into()?;
        let scene = program(&gl, include_str!("scene.vert"), include_str!("scene.frag"))?;
        let spark = program(
            &gl,
            include_str!("particles.vert"),
            include_str!("particles.frag"),
        )?;
        let contours = program(
            &gl,
            include_str!("contours.vert"),
            include_str!("contours.frag"),
        )?;
        let mut textures = vec![
            texture(&gl, 0, &source)?,
            texture(&gl, 1, &plate)?,
            texture(&gl, 2, &person)?,
        ];
        let light = matte.is_some();
        if let Some(matte) = &matte {
            textures.push(texture(&gl, 3, matte)?);
        }
        for p in [&scene, &contours] {
            gl.use_program(Some(p));
            for (i, name) in ["u_source", "u_plate", "u_person", "u_matte"]
                .iter()
                .enumerate()
            {
                gl.uniform1i(gl.get_uniform_location(p, name).as_ref(), i as i32);
            }
        }
        let names = [
            "u_camera",
            "u_hero",
            "u_cloth",
            "u_cloud",
            "u_objects[0]",
            "u_control",
            "u_wind",
            "u_scan",
            "u_effects",
            "u_viewport",
            "u_accent",
            "u_background",
        ];
        let uniforms = names
            .iter()
            .map(|n| gl.get_uniform_location(&scene, n))
            .collect();
        let contour_uniforms = names
            .iter()
            .map(|n| gl.get_uniform_location(&contours, n))
            .collect();
        let spark_view = gl.get_uniform_location(&spark, "u_view");
        let spark_viewport = gl.get_uniform_location(&spark, "u_viewport");
        let themed = Themed::new(&gl, false)?;
        let buffer = gl.create_buffer().ok_or("Cannot create particle buffer")?;
        let contour_buffer = gl.create_buffer().ok_or("Cannot create contour buffer")?;
        let mut vertices = Vec::new();
        for record in include_bytes!("../assets/contours.bin").chunks_exact(12) {
            let number = |i: usize| u16::from_le_bytes([record[i * 2], record[i * 2 + 1]]) as f32;
            let ends = [
                number(0) / 8.0,
                number(1) / 8.0,
                number(2) / 8.0,
                number(3) / 8.0,
            ];
            for (t, side) in [
                (0.0, -1.0),
                (0.0, 1.0),
                (1.0, -1.0),
                (1.0, -1.0),
                (0.0, 1.0),
                (1.0, 1.0),
            ] {
                vertices.extend_from_slice(&ends);
                vertices.extend_from_slice(&[t, side, number(4), number(5) / 65535.0]);
            }
        }
        let contour_count = (vertices.len() / 8) as i32;
        gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&contour_buffer));
        gl.buffer_data_with_array_buffer_view(
            Gl::ARRAY_BUFFER,
            &js_sys::Float32Array::from(vertices.as_slice()),
            Gl::STATIC_DRAW,
        );
        Ok(Self {
            gl,
            canvas,
            scene,
            spark,
            contours,
            textures,
            buffer,
            contour_buffer,
            contour_count,
            uniforms,
            contour_uniforms,
            spark_view,
            spark_viewport,
            particle_data: Vec::with_capacity(128),
            elapsed: 0.0,
            last_time: None,
            amount: MAX_MOTION_STRENGTH,
            accent: [245.0 / 255.0, 221.0 / 255.0, 7.0 / 255.0],
            background: [0.0; 3],
            themed,
            offscreen: false,
            light,
            original: false,
            reduced: false,
            paused: false,
            wireframe: false,
            effects: [1.0; 3],
            scan_clock: None,
            suppress_auto_scan: false,
            pointer: [0.0; 2],
            target: [0.0; 2],
            disposed: false,
            frames: 0,
        })
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        let width = width.clamp(2, 2304);
        let height = height.clamp(2, 1536);
        if self.canvas.width() != width || self.canvas.height() != height {
            self.canvas.set_width(width);
            self.canvas.set_height(height);
        }
        self.gl.viewport(0, 0, width as i32, height as i32);
        self.draw();
    }
    pub fn frame(&mut self, milliseconds: f64) {
        if !self.paused && !self.reduced && !self.original {
            if let Some(previous) = self.last_time {
                let dt = ((milliseconds - previous) / 1000.0).clamp(0.0, 0.08);
                let next = (self.elapsed + dt).rem_euclid(LOOP_SECONDS);
                if next < self.elapsed {
                    self.suppress_auto_scan = false;
                }
                self.elapsed = next;
                if let Some(t) = self.scan_clock {
                    self.scan_clock = if t + dt < 4.6 { Some(t + dt) } else { None };
                }
                let follow = (1.0 - (-dt * 3.8).exp()) as f32;
                for i in 0..2 {
                    self.pointer[i] += (self.target[i] - self.pointer[i]) * follow;
                }
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
        self.pointer = [0.0; 2];
        self.target = [0.0; 2];
        self.last_time = None;
        self.scan_clock = None;
        self.suppress_auto_scan = false;
        self.draw();
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
            value.clamp(0.0, MAX_MOTION_STRENGTH)
        } else {
            1.0
        };
        self.draw();
    }
    pub fn pointer(&mut self, x: f32, y: f32) {
        if x.is_finite() && y.is_finite() {
            self.target = [x.clamp(-1.0, 1.0) * 7.0, y.clamp(-1.0, 1.0) * 5.0];
        }
    }
    pub fn accent(&mut self, red: f32, green: f32, blue: f32) {
        if [red, green, blue].iter().all(|value| value.is_finite()) {
            self.accent = [red, green, blue].map(|value| value.clamp(0.0, 1.0));
            self.draw();
        }
    }
    pub fn background(&mut self, red: f32, green: f32, blue: f32) {
        if [red, green, blue].iter().all(|value| value.is_finite()) {
            self.background = [red, green, blue].map(|value| value.clamp(0.0, 1.0));
            self.draw();
        }
    }
    pub fn motion_strength(&self) -> f32 {
        self.amount
    }
    pub fn frame_count(&self) -> u32 {
        self.frames
    }
    pub fn gpu_error(&self) -> u32 {
        self.gl.get_error()
    }
    /// The app theme: 0 Искра, 1 Дюна, 2 Тишина, 3 Астрал; others keep the
    /// engraving's own gold.
    pub fn palette(&mut self, code: u32) {
        if self.themed.set(code) {
            self.draw();
        }
    }
    pub fn wireframe(&mut self, value: bool) {
        self.wireframe = value;
        self.draw();
    }
    pub fn effects(&mut self, rain: bool, wind: bool, scanner: bool) {
        self.effects = [f32::from(rain), f32::from(wind), f32::from(scanner)];
        self.draw();
    }
    pub fn scan(&mut self) {
        self.scan_clock = Some(0.0);
        self.suppress_auto_scan = true;
        self.wireframe = false;
        self.draw();
    }
    pub fn dispose(&mut self) {
        if self.disposed {
            return;
        }
        for t in &self.textures {
            self.gl.delete_texture(Some(t));
        }
        self.gl.delete_buffer(Some(&self.buffer));
        self.gl.delete_buffer(Some(&self.contour_buffer));
        self.gl.delete_program(Some(&self.scene));
        self.gl.delete_program(Some(&self.spark));
        self.gl.delete_program(Some(&self.contours));
        self.themed.dispose(&self.gl);
        self.disposed = true;
    }
}

impl CloudDrift {
    fn frame_uniforms(&self, locations: &[Option<WebGlUniformLocation>], f: &Frame, still: bool) {
        let gl = &self.gl;
        for (i, data) in [&f.camera, &f.hero, &f.cloth, &f.cloud].iter().enumerate() {
            gl.uniform4fv_with_f32_array(locations[i].as_ref(), *data);
        }
        let objects: [f32; 16] = std::array::from_fn(|i| f.objects[i / 4][i % 4]);
        gl.uniform4fv_with_f32_array(locations[4].as_ref(), &objects);
        gl.uniform4f(
            locations[5].as_ref(),
            f32::from(still),
            self.pointer[0],
            self.pointer[1],
            f32::from(self.wireframe),
        );
        gl.uniform4fv_with_f32_array(locations[6].as_ref(), &f.wind);
        gl.uniform4fv_with_f32_array(locations[7].as_ref(), &f.scan);
        gl.uniform4f(
            locations[8].as_ref(),
            self.effects[0],
            self.effects[1],
            self.effects[2],
            f32::from(self.light),
        );
        gl.uniform4f(
            locations[9].as_ref(),
            self.canvas.width() as f32,
            self.canvas.height() as f32,
            f32::from(self.offscreen),
            0.0,
        );
        gl.uniform3fv_with_f32_array(locations[10].as_ref(), &self.accent);
        gl.uniform3fv_with_f32_array(locations[11].as_ref(), &self.background);
    }
    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let mut f = compose(self.elapsed, self.amount);
        if let Some(t) = self.scan_clock {
            f.scan = compose(6.0 + t, self.amount).scan;
        } else if self.suppress_auto_scan {
            f.scan[1] = 0.0;
        }
        let still = self.original || self.reduced;
        // A theme recolors the finished frame, so the scene draws offscreen.
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        self.offscreen = self.themed.begin(&self.gl, width, height).unwrap_or(false);
        let gl = &self.gl;
        gl.disable(Gl::BLEND);
        gl.use_program(Some(&self.scene));
        self.frame_uniforms(&self.uniforms, &f, still);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        if !still && ((f.scan[1] > 0.0 && self.effects[2] > 0.0) || self.wireframe) {
            gl.use_program(Some(&self.contours));
            self.frame_uniforms(&self.contour_uniforms, &f, false);
            gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&self.contour_buffer));
            gl.enable_vertex_attrib_array(0);
            gl.enable_vertex_attrib_array(1);
            gl.vertex_attrib_pointer_with_i32(0, 4, Gl::FLOAT, false, 32, 0);
            gl.vertex_attrib_pointer_with_i32(1, 4, Gl::FLOAT, false, 32, 16);
            gl.enable(Gl::BLEND);
            if self.light {
                gl.blend_func(Gl::SRC_ALPHA, Gl::ONE_MINUS_SRC_ALPHA);
            } else {
                gl.blend_func(Gl::SRC_ALPHA, Gl::ONE);
            }
            gl.draw_arrays(Gl::TRIANGLES, 0, self.contour_count);
            gl.disable_vertex_attrib_array(0);
            gl.disable_vertex_attrib_array(1);
            gl.disable(Gl::BLEND);
        }
        if !still && self.amount > 0.0 && !self.wireframe {
            self.particle_data.clear();
            let p = f.phase;
            // Sparse, deterministic glints. Every track closes over the same loop.
            for i in 0..28 {
                let seed = i as f32;
                let x = (seed * 373.13 + 155.0) % 1470.0 + 25.0;
                let y = (seed * 219.37 + 73.0) % 910.0 + 32.0;
                let phase = seed * 2.399;
                let visibility = (0.5 + 0.5 * (p * 2.0 + phase).sin()).powi(6);
                let radius = if i % 7 == 0 { 15.0 } else { 5.0 };
                self.particle_data.extend_from_slice(&[
                    x + (p + phase).sin() * 8.0 * self.amount
                        + f.wind[0] * self.effects[1] * (15.0 + seed),
                    y + (p + phase).cos() * 14.0 * self.amount + f.wind[1] * self.effects[1] * 3.0,
                    radius,
                    visibility * (0.45 + f.wind[0] * self.effects[1] * 0.2) * self.amount,
                ]);
            }
            gl.use_program(Some(&self.spark));
            gl.uniform4f(
                self.spark_viewport.as_ref(),
                self.canvas.width() as f32,
                self.canvas.height() as f32,
                f32::from(self.offscreen),
                0.0,
            );
            gl.uniform4f(
                self.spark_view.as_ref(),
                f.camera[0] + self.pointer[0],
                f.camera[1] + self.pointer[1],
                f.camera[2],
                self.canvas.width() as f32 / 1536.0,
            );
            gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&self.buffer));
            let data = js_sys::Float32Array::from(self.particle_data.as_slice());
            gl.buffer_data_with_array_buffer_view(Gl::ARRAY_BUFFER, &data, Gl::DYNAMIC_DRAW);
            gl.enable_vertex_attrib_array(0);
            gl.vertex_attrib_pointer_with_i32(0, 4, Gl::FLOAT, false, 16, 0);
            gl.enable(Gl::BLEND);
            gl.blend_func(Gl::SRC_ALPHA, Gl::ONE);
            gl.draw_arrays(Gl::POINTS, 0, 28);
            gl.disable_vertex_attrib_array(0);
            gl.disable(Gl::BLEND);
        }
        if self.offscreen {
            // The same widths as `edge_coverage` in shared.glsl.
            let edges = Some([0.10, 0.10, 0.15, 0.15]);
            self.themed.present(&self.gl, self.background, edges);
        }
        self.frames = self.frames.wrapping_add(1);
    }
}
