//! The offscreen frame a themed scene draws into, and the pass that recolors
//! it onto the canvas. With the original palette nothing is allocated and the
//! scene keeps drawing straight to the canvas.
use crate::{Palette, FRAGMENT, VERTEX};
use wasm_bindgen::JsValue;
use web_sys::{
    WebGl2RenderingContext as Gl, WebGlFramebuffer, WebGlProgram, WebGlRenderbuffer, WebGlShader,
    WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

/// The scenes bind their artwork to the low units once; this one is theirs to keep.
const UNIT: u32 = 15;
const NAMES: [&str; 7] = [
    "u_image",
    "u_mode",
    "u_paper",
    "u_accent",
    "u_highlight",
    "u_backdrop",
    "u_edges",
];

struct Frame {
    size: [i32; 2],
    /// Multisampled color, when the scene relies on antialiasing.
    samples: Option<(WebGlFramebuffer, WebGlRenderbuffer)>,
    resolved: WebGlFramebuffer,
    texture: WebGlTexture,
}

pub struct Themed {
    palette: Palette,
    samples: i32,
    program: WebGlProgram,
    uniforms: Vec<Option<WebGlUniformLocation>>,
    layout: WebGlVertexArrayObject,
    frame: Option<Frame>,
}

fn shader(gl: &Gl, kind: u32, source: &str) -> Result<WebGlShader, JsValue> {
    let shader = gl.create_shader(kind).ok_or("Cannot create shader")?;
    gl.shader_source(&shader, source);
    gl.compile_shader(&shader);
    if gl
        .get_shader_parameter(&shader, Gl::COMPILE_STATUS)
        .as_bool()
        == Some(true)
    {
        Ok(shader)
    } else {
        Err(gl.get_shader_info_log(&shader).unwrap_or_default().into())
    }
}

impl Themed {
    /// `multisample` matches the `antialias` option the scene's canvas uses.
    pub fn new(gl: &Gl, multisample: bool) -> Result<Self, JsValue> {
        let program = gl.create_program().ok_or("Cannot create program")?;
        let vertex = shader(gl, Gl::VERTEX_SHADER, VERTEX)?;
        let fragment = shader(gl, Gl::FRAGMENT_SHADER, FRAGMENT)?;
        gl.attach_shader(&program, &vertex);
        gl.attach_shader(&program, &fragment);
        gl.link_program(&program);
        gl.delete_shader(Some(&vertex));
        gl.delete_shader(Some(&fragment));
        if gl
            .get_program_parameter(&program, Gl::LINK_STATUS)
            .as_bool()
            != Some(true)
        {
            return Err(gl.get_program_info_log(&program).unwrap_or_default().into());
        }
        let uniforms: Vec<_> = NAMES
            .iter()
            .map(|name| gl.get_uniform_location(&program, name))
            .collect();
        gl.use_program(Some(&program));
        gl.uniform1i(uniforms[0].as_ref(), UNIT as i32);
        let samples = if multisample {
            gl.get_parameter(Gl::MAX_SAMPLES)?
                .as_f64()
                .map_or(0, |value| (value as i32).min(4))
        } else {
            0
        };
        Ok(Self {
            palette: Palette::Original,
            samples,
            program,
            uniforms,
            layout: gl
                .create_vertex_array()
                .ok_or("Cannot allocate vertex array")?,
            frame: None,
        })
    }
    /// Returns whether the palette changed.
    pub fn set(&mut self, code: u32) -> bool {
        let palette = Palette::from_code(code);
        let changed = palette != self.palette;
        self.palette = palette;
        changed
    }
    /// Whether frames pass through the recolor; Дюна's light paintings and
    /// the originals draw straight to the canvas.
    pub fn active(&self) -> bool {
        self.palette.colors().is_some()
    }
    /// Directs the scene's draws into the offscreen frame when a theme is
    /// active and returns whether it did.
    pub fn begin(&mut self, gl: &Gl, width: i32, height: i32) -> Result<bool, JsValue> {
        if !self.active() {
            self.release(gl);
            return Ok(false);
        }
        if self.frame.as_ref().map(|frame| frame.size) != Some([width, height]) {
            self.release(gl);
            self.frame = Some(self.allocate(gl, width, height)?);
        }
        let frame = self.frame.as_ref().ok_or("No frame")?;
        let target = frame
            .samples
            .as_ref()
            .map_or(&frame.resolved, |(framebuffer, _)| framebuffer);
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(target));
        gl.clear_color(0.0, 0.0, 0.0, 1.0);
        gl.clear(Gl::COLOR_BUFFER_BIT);
        Ok(true)
    }
    /// Recolors the offscreen frame onto the canvas. `edges` (left, right,
    /// top, bottom) melt the scene into `backdrop`, the page around it.
    pub fn present(&self, gl: &Gl, backdrop: [f32; 3], edges: Option<[f32; 4]>) {
        let (Some(frame), Some(colors)) = (&self.frame, self.palette.colors()) else {
            return;
        };
        let [width, height] = frame.size;
        if let Some((framebuffer, _)) = &frame.samples {
            gl.bind_framebuffer(Gl::READ_FRAMEBUFFER, Some(framebuffer));
            gl.bind_framebuffer(Gl::DRAW_FRAMEBUFFER, Some(&frame.resolved));
            gl.blit_framebuffer(
                0,
                0,
                width,
                height,
                0,
                0,
                width,
                height,
                Gl::COLOR_BUFFER_BIT,
                Gl::NEAREST,
            );
        }
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        gl.disable(Gl::BLEND);
        gl.use_program(Some(&self.program));
        gl.active_texture(Gl::TEXTURE0 + UNIT);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&frame.texture));
        let u = &self.uniforms;
        gl.uniform4f(
            u[1].as_ref(),
            self.palette.mode(),
            if edges.is_some() { 1.0 } else { 0.0 },
            0.0,
            0.0,
        );
        gl.uniform3fv_with_f32_array(u[2].as_ref(), &colors.paper);
        gl.uniform3fv_with_f32_array(u[3].as_ref(), &colors.accent);
        gl.uniform3fv_with_f32_array(u[4].as_ref(), &colors.highlight);
        gl.uniform3fv_with_f32_array(u[5].as_ref(), &backdrop);
        gl.uniform4fv_with_f32_array(u[6].as_ref(), &edges.unwrap_or([0.0; 4]));
        gl.bind_vertex_array(Some(&self.layout));
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_vertex_array(None);
    }
    pub fn dispose(&mut self, gl: &Gl) {
        self.release(gl);
        gl.delete_vertex_array(Some(&self.layout));
        gl.delete_program(Some(&self.program));
    }
    fn allocate(&self, gl: &Gl, width: i32, height: i32) -> Result<Frame, JsValue> {
        let texture = gl.create_texture().ok_or("Cannot allocate texture")?;
        gl.active_texture(Gl::TEXTURE0 + UNIT);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&texture));
        gl.tex_storage_2d(Gl::TEXTURE_2D, 1, Gl::RGBA8, width, height);
        for (name, value) in [
            (Gl::TEXTURE_MIN_FILTER, Gl::NEAREST),
            (Gl::TEXTURE_MAG_FILTER, Gl::NEAREST),
            (Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE),
            (Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE),
        ] {
            gl.tex_parameteri(Gl::TEXTURE_2D, name, value as i32);
        }
        let resolved = gl
            .create_framebuffer()
            .ok_or("Cannot allocate framebuffer")?;
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&resolved));
        gl.framebuffer_texture_2d(
            Gl::FRAMEBUFFER,
            Gl::COLOR_ATTACHMENT0,
            Gl::TEXTURE_2D,
            Some(&texture),
            0,
        );
        let mut complete = gl.check_framebuffer_status(Gl::FRAMEBUFFER) == Gl::FRAMEBUFFER_COMPLETE;
        let samples = if self.samples > 0 {
            let color = gl
                .create_renderbuffer()
                .ok_or("Cannot allocate renderbuffer")?;
            gl.bind_renderbuffer(Gl::RENDERBUFFER, Some(&color));
            gl.renderbuffer_storage_multisample(
                Gl::RENDERBUFFER,
                self.samples,
                Gl::RGBA8,
                width,
                height,
            );
            let framebuffer = gl
                .create_framebuffer()
                .ok_or("Cannot allocate framebuffer")?;
            gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&framebuffer));
            gl.framebuffer_renderbuffer(
                Gl::FRAMEBUFFER,
                Gl::COLOR_ATTACHMENT0,
                Gl::RENDERBUFFER,
                Some(&color),
            );
            complete &= gl.check_framebuffer_status(Gl::FRAMEBUFFER) == Gl::FRAMEBUFFER_COMPLETE;
            Some((framebuffer, color))
        } else {
            None
        };
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        let frame = Frame {
            size: [width, height],
            samples,
            resolved,
            texture,
        };
        if !complete {
            Self::delete(gl, &frame);
            return Err("Incomplete offscreen frame".into());
        }
        Ok(frame)
    }
    fn release(&mut self, gl: &Gl) {
        if let Some(frame) = self.frame.take() {
            Self::delete(gl, &frame);
        }
    }
    fn delete(gl: &Gl, frame: &Frame) {
        if let Some((framebuffer, color)) = &frame.samples {
            gl.delete_framebuffer(Some(framebuffer));
            gl.delete_renderbuffer(Some(color));
        }
        gl.delete_framebuffer(Some(&frame.resolved));
        gl.delete_texture(Some(&frame.texture));
    }
}
