//! Two immutable textures and one draw call. The adapter owns WebGL resources;
//! the deterministic Rust frame and fragment shader own every visual change.
use crate::{
    compose, look, material_set, Look, MaterialSet, CONTACT, HAND_SCALE, LOOP_SECONDS, SOURCE_TIP,
    STILL,
};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlProgram, WebGlShader,
    WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

fn shader(gl: &Gl, kind: u32, source: &str) -> Result<WebGlShader, JsValue> {
    let object = gl.create_shader(kind).ok_or("Cannot allocate shader")?;
    gl.shader_source(&object, source);
    gl.compile_shader(&object);
    if !gl
        .get_shader_parameter(&object, Gl::COMPILE_STATUS)
        .as_bool()
        .unwrap_or(false)
    {
        let message = gl.get_shader_info_log(&object).unwrap_or_default();
        gl.delete_shader(Some(&object));
        return Err(message.into());
    }
    Ok(object)
}

fn program(gl: &Gl) -> Result<WebGlProgram, JsValue> {
    let vertex = shader(gl, Gl::VERTEX_SHADER, include_str!("shaders/screen.vert"))?;
    let fragment = match shader(gl, Gl::FRAGMENT_SHADER, include_str!("shaders/scene.frag")) {
        Ok(value) => value,
        Err(error) => {
            gl.delete_shader(Some(&vertex));
            return Err(error);
        }
    };
    let Some(object) = gl.create_program() else {
        gl.delete_shader(Some(&vertex));
        gl.delete_shader(Some(&fragment));
        return Err("Cannot allocate program".into());
    };
    gl.attach_shader(&object, &vertex);
    gl.attach_shader(&object, &fragment);
    gl.link_program(&object);
    gl.delete_shader(Some(&vertex));
    gl.delete_shader(Some(&fragment));
    if !gl
        .get_program_parameter(&object, Gl::LINK_STATUS)
        .as_bool()
        .unwrap_or(false)
    {
        let message = gl.get_program_info_log(&object).unwrap_or_default();
        gl.delete_program(Some(&object));
        return Err(message.into());
    }
    Ok(object)
}

fn upload_image(
    gl: &Gl,
    slot: u32,
    object: &WebGlTexture,
    image: &HtmlImageElement,
) -> Result<(), JsValue> {
    if image.natural_width() == 0 || image.natural_height() == 0 {
        return Err("Scene illustration is not decoded".into());
    }
    if gl.is_context_lost() {
        return Err("WebGL context was lost while changing scene materials".into());
    }
    gl.active_texture(Gl::TEXTURE0 + slot);
    gl.bind_texture(Gl::TEXTURE_2D, Some(object));
    gl.tex_parameteri(
        Gl::TEXTURE_2D,
        Gl::TEXTURE_MIN_FILTER,
        Gl::LINEAR_MIPMAP_LINEAR as i32,
    );
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MAG_FILTER, Gl::LINEAR as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE as i32);
    gl.pixel_storei(Gl::UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.pixel_storei(Gl::UNPACK_FLIP_Y_WEBGL, 0);
    gl.tex_image_2d_with_u32_and_u32_and_html_image_element(
        Gl::TEXTURE_2D,
        0,
        Gl::RGBA as i32,
        Gl::RGBA,
        Gl::UNSIGNED_BYTE,
        image,
    )?;
    gl.generate_mipmap(Gl::TEXTURE_2D);
    let error = gl.get_error();
    if error != Gl::NO_ERROR {
        return Err(format!("Scene material upload failed: WebGL 0x{error:04x}").into());
    }
    Ok(())
}

fn image_texture(gl: &Gl, slot: u32, image: &HtmlImageElement) -> Result<WebGlTexture, JsValue> {
    let object = gl.create_texture().ok_or("Cannot allocate scene texture")?;
    if let Err(error) = upload_image(gl, slot, &object, image) {
        gl.delete_texture(Some(&object));
        return Err(error);
    }
    Ok(object)
}

/// Decoded CPU-side sources; changing theme reuses the same two GPU objects.
struct SourceImages {
    dark_hand: HtmlImageElement,
    dark_world: HtmlImageElement,
    light_hand: HtmlImageElement,
    light_world: HtmlImageElement,
}

impl SourceImages {
    fn pair(&self, materials: MaterialSet) -> (&HtmlImageElement, &HtmlImageElement) {
        match materials {
            MaterialSet::Dark => (&self.dark_hand, &self.dark_world),
            MaterialSet::Light => (&self.light_hand, &self.light_world),
        }
    }
}

#[wasm_bindgen]
pub struct Witnessing {
    gl: Gl,
    canvas: HtmlCanvasElement,
    program: WebGlProgram,
    uniforms: Vec<(&'static str, Option<WebGlUniformLocation>)>,
    texture: WebGlTexture,
    world_texture: WebGlTexture,
    sources: SourceImages,
    materials: MaterialSet,
    layout: WebGlVertexArrayObject,
    look: Look,
    backdrop: [f32; 3],
    soft_edges: bool,
    elapsed: f32,
    last_time: Option<f64>,
    paused: bool,
    reduced: bool,
    disposed: bool,
    frames: u32,
}

#[wasm_bindgen]
impl Witnessing {
    #[wasm_bindgen(constructor)]
    pub fn new(
        canvas: HtmlCanvasElement,
        dark_hand: HtmlImageElement,
        dark_world: HtmlImageElement,
        light_hand: HtmlImageElement,
        light_world: HtmlImageElement,
    ) -> Result<Self, JsValue> {
        let options = js_sys::Object::new();
        for (name, value) in [
            ("alpha", false),
            ("antialias", false),
            ("preserveDrawingBuffer", false),
        ] {
            js_sys::Reflect::set(&options, &name.into(), &value.into())?;
        }
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 unavailable")?
            .dyn_into()?;
        let program = program(&gl)?;
        let texture = match image_texture(&gl, 0, &dark_hand) {
            Ok(value) => value,
            Err(error) => {
                gl.delete_program(Some(&program));
                return Err(error);
            }
        };
        let world_texture = match image_texture(&gl, 1, &dark_world) {
            Ok(value) => value,
            Err(error) => {
                gl.delete_program(Some(&program));
                gl.delete_texture(Some(&texture));
                return Err(error);
            }
        };
        let Some(layout) = gl.create_vertex_array() else {
            gl.delete_program(Some(&program));
            gl.delete_texture(Some(&texture));
            gl.delete_texture(Some(&world_texture));
            return Err("Cannot allocate vertex array".into());
        };
        let uniforms = [
            "u_resolution",
            "u_contact",
            "u_source",
            "u_clock",
            "u_detail",
            "u_story",
            "u_drop",
            "u_paper",
            "u_ink",
            "u_highlight",
            "u_light",
            "u_hand",
            "u_world",
        ]
        .into_iter()
        .map(|name| (name, gl.get_uniform_location(&program, name)))
        .collect();
        let look = look(0);
        let backdrop = look.paper;
        Ok(Self {
            gl,
            canvas,
            program,
            uniforms,
            texture,
            world_texture,
            sources: SourceImages {
                dark_hand,
                dark_world,
                light_hand,
                light_world,
            },
            materials: MaterialSet::Dark,
            layout,
            look,
            backdrop,
            soft_edges: false,
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
        if self.canvas.width() != width {
            self.canvas.set_width(width);
        }
        if self.canvas.height() != height {
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
    pub fn elapsed(&self) -> f64 {
        f64::from(self.elapsed)
    }
    pub fn seek(&mut self, seconds: f64) {
        self.elapsed = if seconds.is_finite() {
            seconds.rem_euclid(f64::from(LOOP_SECONDS)) as f32
        } else {
            0.0
        };
        self.last_time = None;
        self.draw();
    }
    pub fn suspend(&mut self) {
        self.last_time = None;
    }
    pub fn pause(&mut self, value: bool) {
        self.paused = value;
        self.last_time = None;
    }
    pub fn reduced(&mut self, value: bool) {
        if self.reduced != value {
            self.reduced = value;
            self.last_time = None;
            self.draw();
        }
    }
    pub fn soft_edges(&mut self, value: bool) {
        if self.soft_edges != value {
            self.soft_edges = value;
            self.draw();
        }
    }
    pub fn palette(&mut self, code: u32) -> Result<(), JsValue> {
        if self.disposed || self.gl.is_context_lost() {
            return Ok(());
        }
        let next = look(code);
        let materials = material_set(code);
        if self.materials != materials {
            if let Err(error) = self.upload_materials(materials) {
                // A failed second upload must not leave one light and one dark
                // illustration attached to the old palette. Restore its pair.
                if let Err(rollback) = self.upload_materials(self.materials) {
                    return Err(format!(
                        "Material switch failed: {}. Restoring previous materials failed: {}",
                        error
                            .as_string()
                            .unwrap_or_else(|| "texture upload error".into()),
                        rollback
                            .as_string()
                            .unwrap_or_else(|| "texture upload error".into()),
                    )
                    .into());
                }
                return Err(error);
            }
            self.materials = materials;
        }
        if self.look != next {
            self.look = next;
            self.draw();
        }
        Ok(())
    }
    pub fn backdrop(&mut self, red: f32, green: f32, blue: f32) {
        if ![red, green, blue].iter().all(|v| v.is_finite()) {
            return;
        }
        let next = [red, green, blue].map(|v| v.clamp(0.0, 1.0));
        if self.backdrop != next {
            self.backdrop = next;
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
        self.gl.delete_texture(Some(&self.world_texture));
        self.gl.delete_vertex_array(Some(&self.layout));
        self.gl.delete_program(Some(&self.program));
        self.disposed = true;
    }
}

impl Witnessing {
    fn upload_materials(&self, materials: MaterialSet) -> Result<(), JsValue> {
        let (hand, world) = self.sources.pair(materials);
        upload_image(&self.gl, 0, &self.texture, hand)?;
        upload_image(&self.gl, 1, &self.world_texture, world)
    }

    fn at(&self, name: &str) -> Option<&WebGlUniformLocation> {
        self.uniforms
            .iter()
            .find(|(key, _)| *key == name)
            .and_then(|(_, value)| value.as_ref())
    }
    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let f = compose(if self.reduced { STILL } else { self.elapsed });
        let gl = &self.gl;
        let width = self.canvas.width().max(1);
        let height = self.canvas.height().max(1);
        gl.viewport(0, 0, width as i32, height as i32);
        gl.disable(Gl::BLEND);
        gl.disable(Gl::DEPTH_TEST);
        gl.disable(Gl::CULL_FACE);
        gl.use_program(Some(&self.program));
        gl.bind_vertex_array(Some(&self.layout));
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&self.texture));
        gl.uniform1i(self.at("u_hand"), 0);
        gl.active_texture(Gl::TEXTURE1);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&self.world_texture));
        gl.uniform1i(self.at("u_world"), 1);
        gl.uniform2f(self.at("u_resolution"), width as f32, height as f32);
        gl.uniform2f(self.at("u_contact"), CONTACT[0], CONTACT[1]);
        gl.uniform3f(
            self.at("u_source"),
            SOURCE_TIP[0],
            SOURCE_TIP[1],
            HAND_SCALE,
        );
        gl.uniform4f(self.at("u_clock"), f.phase, f.press, f.lift, f.angle);
        gl.uniform4f(
            self.at("u_detail"),
            f.ripple_age,
            f.breath,
            f.time,
            f32::from(self.soft_edges),
        );
        gl.uniform4f(
            self.at("u_story"),
            f.world_presence,
            f.front_radius,
            f.drop_y,
            f.drop_alpha,
        );
        gl.uniform4f(
            self.at("u_drop"),
            f.drop_x,
            f.drop_stretch,
            f.secondary_age,
            f.reset,
        );
        gl.uniform3fv_with_f32_array(self.at("u_paper"), &self.backdrop);
        gl.uniform3fv_with_f32_array(self.at("u_ink"), &self.look.ink);
        gl.uniform3fv_with_f32_array(self.at("u_highlight"), &self.look.highlight);
        gl.uniform1f(self.at("u_light"), f32::from(self.look.light));
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        self.frames = self.frames.wrapping_add(1);
    }
}
