//! Browser adapter: platform objects, GPU resources and draw order. Every
//! motion value comes from `compose` and the generators in `geometry`.
use crate::geometry::{self, Mesh};
use crate::glass::cell_uniforms;
use crate::lens::{REGION, TEXTURE_SIZE};
use crate::scene::Scene;
use crate::{
    compose, mouth_layers, view, LOOP_SECONDS, MOUTH, MOUTH_COLUMNS, MOUTH_ROWS, MOUTH_SIZE, SIZE,
    WORLD_SIZE,
};
use wasm_bindgen::{prelude::*, JsCast};
use watcher_scene_palette::Themed;
use web_sys::{
    HtmlCanvasElement, HtmlImageElement, WebGl2RenderingContext as Gl, WebGlBuffer, WebGlProgram,
    WebGlShader, WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

const VERTEX: &str = include_str!("shaders/shape.vert");
/// Texture units, bound once.
const BACKGROUND: i32 = 0;
const FIGURE: i32 = 1;
const MOUTHS: i32 = 2;
const WORLD: i32 = 3;
const ORIGINAL: i32 = 4;
const MASK: i32 = 5;
const CELLS: i32 = 6;
/// Mip levels that match the soft bloom (σ ≈ 20 px) and Art's lens blur
/// (σ 2.85 authored px ≈ 22 panorama texels).
const BLOOM_LOD: f32 = 5.3;
/// Left, right, top, bottom: how far the scene melts into the page.
const EDGES: [f32; 4] = [0.1, 0.1, 0.12, 0.16];

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

/// One program with its uniform locations looked up once.
struct Pass {
    program: WebGlProgram,
    uniforms: Vec<(&'static str, Option<WebGlUniformLocation>)>,
}
impl Pass {
    fn new(gl: &Gl, fragment: &str, names: &[&'static str]) -> Result<Self, JsValue> {
        let program = program(gl, VERTEX, fragment)?;
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

/// A premultiplied, mipmapped layer of Art's artwork.
fn image_texture(
    gl: &Gl,
    slot: i32,
    image: &HtmlImageElement,
    size: [f32; 2],
) -> Result<WebGlTexture, JsValue> {
    if image.natural_width() != size[0] as u32 || image.natural_height() != size[1] as u32 {
        return Err(format!("Layer must be {} × {}", size[0], size[1]).into());
    }
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
    gl.pixel_storei(Gl::UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
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
/// Lens coverage (RG8) or shard ids (R8), computed in Rust from Art's mask.
fn data_texture(
    gl: &Gl,
    slot: i32,
    format: [u32; 2],
    filter: u32,
    data: &[u8],
) -> Result<WebGlTexture, JsValue> {
    let t = gl.create_texture().ok_or("Cannot allocate texture")?;
    gl.active_texture(Gl::TEXTURE0 + slot as u32);
    gl.bind_texture(Gl::TEXTURE_2D, Some(&t));
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MIN_FILTER, filter as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MAG_FILTER, filter as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE as i32);
    gl.pixel_storei(Gl::UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.pixel_storei(Gl::UNPACK_ALIGNMENT, 1);
    gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
        Gl::TEXTURE_2D,
        0,
        format[0] as i32,
        TEXTURE_SIZE[0] as i32,
        TEXTURE_SIZE[1] as i32,
        0,
        format[1],
        Gl::UNSIGNED_BYTE,
        Some(data),
    )?;
    Ok(t)
}

/// First vertex and vertex count of one layer in the frame's shared buffer.
type Span = (i32, i32);
fn span(mesh: &mut Mesh, build: impl FnOnce(&mut Mesh)) -> Span {
    let start = mesh.vertices();
    build(mesh);
    (start, mesh.vertices() - start)
}
fn atlas(patch: usize) -> [f32; 4] {
    let (w, h) = (1.0 / MOUTH_COLUMNS as f32, 1.0 / MOUTH_ROWS as f32);
    [
        (patch % MOUTH_COLUMNS) as f32 * w,
        (patch / MOUTH_COLUMNS) as f32 * h,
        w,
        h,
    ]
}
const ARTWORK: [f32; 4] = [0.0, 0.0, SIZE[0], SIZE[1]];
const WHOLE: [f32; 4] = [0.0, 0.0, 1.0, 1.0];

#[wasm_bindgen]
pub struct WorldInGlasses {
    gl: Gl,
    canvas: HtmlCanvasElement,
    image: Pass,
    shape: Pass,
    glyph: Pass,
    lens: Pass,
    bubble: Pass,
    post: Pass,
    themed: Themed,
    textures: Vec<WebGlTexture>,
    vertices: WebGlBuffer,
    layout: WebGlVertexArrayObject,
    scene: Scene,
    mesh: Mesh,
    bytes: Vec<u8>,
    soft_edges: bool,
    backdrop: [f32; 3],
    elapsed: f64,
    last_time: Option<f64>,
    paused: bool,
    reduced: bool,
    disposed: bool,
    frames: u32,
}

#[wasm_bindgen]
impl WorldInGlasses {
    #[wasm_bindgen(constructor)]
    pub fn new(
        canvas: HtmlCanvasElement,
        original: HtmlImageElement,
        background: HtmlImageElement,
        figure: HtmlImageElement,
        mouths: HtmlImageElement,
        world: HtmlImageElement,
    ) -> Result<WorldInGlasses, JsValue> {
        let options = js_sys::Object::new();
        js_sys::Reflect::set(&options, &"alpha".into(), &false.into())?;
        js_sys::Reflect::set(&options, &"antialias".into(), &true.into())?;
        js_sys::Reflect::set(&options, &"preserveDrawingBuffer".into(), &false.into())?;
        let gl: Gl = canvas
            .get_context_with_context_options("webgl2", &options)?
            .ok_or("WebGL2 unavailable")?
            .dyn_into()?;
        let image = Pass::new(
            &gl,
            include_str!("shaders/image.frag"),
            &["u_texture", "u_detail", "u_bloom"],
        )?;
        let shape = Pass::new(
            &gl,
            include_str!("shaders/shape.frag"),
            &["u_clip", "u_mask", "u_region"],
        )?;
        let glyph = Pass::new(
            &gl,
            include_str!("shaders/glyph.frag"),
            &["u_stroke", "u_cover"],
        )?;
        let lens = Pass::new(
            &gl,
            include_str!("shaders/lens.frag"),
            &[
                "u_world",
                "u_ruins",
                "u_mask",
                "u_cells",
                "u_world_map",
                "u_ruins_map",
                "u_cell",
                "u_sun",
                "u_couple",
                "u_life",
                "u_sweep",
            ],
        )?;
        let bubble = Pass::new(&gl, include_str!("shaders/bubble.frag"), &["u_aa"])?;
        let post = Pass::new(
            &gl,
            include_str!("shaders/post.frag"),
            &["u_post", "u_edges", "u_backdrop", "u_pass"],
        )?;
        let themed = Themed::new(&gl, true)?;
        let scene = Scene::new();
        let mouth_size = [
            MOUTH_SIZE[0] * MOUTH_COLUMNS as f32,
            MOUTH_SIZE[1] * MOUTH_ROWS as f32,
        ];
        let textures = vec![
            image_texture(&gl, BACKGROUND, &background, SIZE)?,
            image_texture(&gl, FIGURE, &figure, SIZE)?,
            image_texture(&gl, MOUTHS, &mouths, mouth_size)?,
            image_texture(&gl, WORLD, &world, WORLD_SIZE)?,
            image_texture(&gl, ORIGINAL, &original, SIZE)?,
            data_texture(
                &gl,
                MASK,
                [Gl::RG8, Gl::RG],
                Gl::LINEAR,
                &scene.lenses.mask_texture(),
            )?,
            data_texture(
                &gl,
                CELLS,
                [Gl::R8, Gl::RED],
                Gl::NEAREST,
                &scene.lenses.cell_texture(&scene.glass),
            )?,
        ];
        // Samplers and constants never change after this point.
        gl.use_program(Some(&image.program));
        gl.uniform1i(image.at("u_detail"), FIGURE);
        gl.use_program(Some(&shape.program));
        gl.uniform1i(shape.at("u_mask"), MASK);
        gl.uniform4fv_with_f32_array(shape.at("u_region"), &REGION);
        gl.use_program(Some(&glyph.program));
        gl.uniform1f(glyph.at("u_stroke"), 0.075);
        gl.use_program(Some(&lens.program));
        gl.uniform1i(lens.at("u_world"), WORLD);
        gl.uniform1i(lens.at("u_ruins"), BACKGROUND);
        gl.uniform1i(lens.at("u_mask"), MASK);
        gl.uniform1i(lens.at("u_cells"), CELLS);
        gl.uniform4fv_with_f32_array(lens.at("u_ruins_map"), &geometry::ruins_maps());
        gl.use_program(Some(&post.program));
        gl.uniform4fv_with_f32_array(post.at("u_edges"), &EDGES);

        let layout = gl
            .create_vertex_array()
            .ok_or("Cannot allocate vertex array")?;
        gl.bind_vertex_array(Some(&layout));
        let vertices = gl.create_buffer().ok_or("Cannot allocate buffer")?;
        gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&vertices));
        let stride = (geometry::STRIDE * 4) as i32;
        gl.enable_vertex_attrib_array(0);
        gl.vertex_attrib_pointer_with_i32(0, 4, Gl::FLOAT, false, stride, 0);
        gl.enable_vertex_attrib_array(1);
        gl.vertex_attrib_pointer_with_i32(1, 4, Gl::FLOAT, false, stride, 16);
        gl.enable_vertex_attrib_array(2);
        gl.vertex_attrib_pointer_with_i32(2, 1, Gl::FLOAT, false, stride, 32);
        gl.enable(Gl::BLEND);
        // Everything is premultiplied; alpha 0 adds light.
        gl.blend_func(Gl::ONE, Gl::ONE_MINUS_SRC_ALPHA);
        Ok(Self {
            gl,
            canvas,
            image,
            shape,
            glyph,
            lens,
            bubble,
            post,
            themed,
            textures,
            vertices,
            layout,
            scene,
            mesh: Mesh {
                data: Vec::with_capacity(120_000),
            },
            bytes: Vec::with_capacity(480_000),
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
        self.gl.viewport(0, 0, width as i32, height as i32);
        self.draw();
    }
    pub fn frame(&mut self, milliseconds: f64) {
        if !milliseconds.is_finite() {
            return;
        }
        if !self.paused && !self.reduced {
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
    /// Reduced motion shows Art's still illustration.
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
    /// Set when the renderer was given Art's light paintings: the effects
    /// ink the pale page instead of lighting it.
    pub fn light_paintings(&mut self, value: bool) {
        if self.scene.light != value {
            self.scene.light = value;
            self.gl.use_program(Some(&self.glyph.program));
            self.gl
                .uniform1f(self.glyph.at("u_cover"), f32::from(value));
            self.draw();
        }
    }
    /// The app theme: 0 Искра, 1 Дюна, 2 Тишина, 3 Астрал; others keep
    /// Art's colors.
    pub fn palette(&mut self, code: u32) {
        if self.themed.set(code) {
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
        self.gl.delete_buffer(Some(&self.vertices));
        self.gl.delete_vertex_array(Some(&self.layout));
        self.themed.dispose(&self.gl);
        for pass in [
            &self.image,
            &self.shape,
            &self.glyph,
            &self.lens,
            &self.bubble,
            &self.post,
        ] {
            self.gl.delete_program(Some(&pass.program));
        }
        self.disposed = true;
    }
}

impl WorldInGlasses {
    fn upload(&mut self, mesh: &Mesh) {
        self.bytes.clear();
        for value in &mesh.data {
            self.bytes.extend_from_slice(&value.to_le_bytes());
        }
        self.gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&self.vertices));
        self.gl
            .buffer_data_with_u8_array(Gl::ARRAY_BUFFER, &self.bytes, Gl::DYNAMIC_DRAW);
    }
    fn begin(&self, pass: &Pass, at: [f32; 4]) {
        self.gl.use_program(Some(&pass.program));
        self.gl.uniform4fv_with_f32_array(pass.at("u_view"), &at);
    }
    fn draw_span(&self, (first, count): Span) {
        if count > 0 {
            self.gl.draw_arrays(Gl::TRIANGLES, first, count);
        }
    }
    fn picture(&self, slot: i32, at: [f32; 4], layer: Span, bloom: f32) {
        self.begin(&self.image, at);
        self.gl.uniform1i(self.image.at("u_texture"), slot);
        self.gl.uniform1f(self.image.at("u_bloom"), bloom);
        self.draw_span(layer);
    }
    fn shapes(&self, at: [f32; 4], layer: Span, clip: bool) {
        if layer.1 == 0 {
            return;
        }
        self.begin(&self.shape, at);
        self.gl
            .uniform1f(self.shape.at("u_clip"), if clip { 1.0 } else { 0.0 });
        self.draw_span(layer);
    }

    fn draw(&mut self) {
        if self.disposed || self.gl.is_context_lost() {
            return;
        }
        let gl = &self.gl;
        gl.bind_vertex_array(Some(&self.layout));
        gl.enable(Gl::BLEND);
        gl.blend_func(Gl::ONE, Gl::ONE_MINUS_SRC_ALPHA);
        let (width, height) = (self.canvas.width() as i32, self.canvas.height() as i32);
        // A theme recolors the finished frame, so the scene draws offscreen.
        let themed = self.themed.begin(gl, width, height).unwrap_or(false);
        let mut mesh = std::mem::take(&mut self.mesh);
        mesh.clear();
        let screen = view(1.0, [SIZE[0] / 2.0, SIZE[1] / 2.0]);
        let full = span(&mut mesh, |m| m.image(ARTWORK, WHOLE, 1.0, false));
        let f = compose(self.elapsed);
        if self.reduced {
            self.upload(&mesh);
            self.picture(ORIGINAL, screen, full, 0.0);
        } else {
            let (t, c, s) = (f.time, f.camera, &self.scene);
            let device = self.canvas.width() as f32 / SIZE[0];
            let (back_px, px) = (device * c.back_zoom, device * c.zoom);
            let bloom = span(&mut mesh, |m| m.image(ARTWORK, WHOLE, f.bloom, true));
            let rain = span(&mut mesh, |m| geometry::rain(m, s, t));
            let holes = span(&mut mesh, |m| {
                geometry::flake_holes(m, s, t, back_px);
                geometry::flake_shadows(m, s, t);
            });
            let pieces = span(&mut mesh, |m| geometry::flake_pieces(m, s, t));
            let behind = span(&mut mesh, |m| {
                geometry::flake_rims(m, s, t, back_px);
                geometry::stones(m, s, t, c.back_center, false, back_px);
            });
            let mouths = span(&mut mesh, |m| {
                for layer in mouth_layers(t) {
                    let rect = [MOUTH[0], MOUTH[1], MOUTH_SIZE[0], MOUTH_SIZE[1]];
                    m.image(rect, atlas(layer.patch), layer.alpha, false);
                }
            });
            let lenses = span(&mut mesh, |m| m.image(REGION, WHOLE, 1.0, false));
            let life = span(&mut mesh, |m| geometry::lens_life(m, s, &f));
            let bubble = span(&mut mesh, |m| {
                if let Some((center, radii)) = geometry::bubble_quad(&f) {
                    m.ellipse(center, radii, 0.0, [1.0; 3], 1.0, 1.0);
                }
            });
            let pop = span(&mut mesh, |m| geometry::pop(m, s, &f, px));
            let cracks = span(&mut mesh, |m| geometry::cracks(m, &s.glass, &f, px));
            let front = span(&mut mesh, |m| {
                geometry::chips(m, s, &f);
                geometry::stones(m, s, t, c.center, true, px);
                geometry::dust(m, s, t, c.center);
            });
            let cells = cell_uniforms(&s.glass, t, f.crack, f.growth);
            let light = geometry::lens_light(&f);
            self.upload(&mesh);

            // The ruins, one depth behind her.
            let back = view(c.back_zoom, c.back_center);
            self.picture(BACKGROUND, back, full, 0.0);
            self.picture(BACKGROUND, back, bloom, BLOOM_LOD);
            self.begin(&self.glyph, back);
            self.draw_span(rain);
            self.shapes(back, holes, false);
            self.picture(BACKGROUND, back, pieces, 0.0);
            self.shapes(back, behind, false);

            // Her, the dream in her glasses, the gum and the broken glass.
            let near = view(c.zoom, c.center);
            self.picture(FIGURE, near, full, 0.0);
            self.picture(MOUTHS, near, mouths, 0.0);
            let gl = &self.gl;
            self.begin(&self.lens, near);
            gl.uniform4fv_with_f32_array(self.lens.at("u_world_map"), &light.world_map);
            gl.uniform4fv_with_f32_array(self.lens.at("u_cell"), &cells);
            gl.uniform4fv_with_f32_array(self.lens.at("u_sun"), &light.sun);
            gl.uniform4fv_with_f32_array(self.lens.at("u_couple"), &light.couple);
            gl.uniform4f(self.lens.at("u_life"), f.life, f.glow, 0.0, 0.0);
            gl.uniform4f(
                self.lens.at("u_sweep"),
                f.glint[0],
                f.glint[1],
                f.heal[0],
                f.heal[1],
            );
            self.draw_span(lenses);
            self.shapes(near, life, true);
            if bubble.1 > 0 {
                self.begin(&self.bubble, near);
                let radius = f.bubble.max(1.0) * px;
                gl.uniform1f(self.bubble.at("u_aa"), (1.5 / radius).clamp(0.002, 0.5));
                self.draw_span(bubble);
            }
            self.shapes(near, pop, false);
            self.shapes(near, cracks, true);
            self.shapes(near, front, false);
        }

        // Vignette, film grain, the flash of the pop and the page around it.
        // With a theme the page edges come after the recolor.
        let backdrop = [
            self.backdrop[0],
            self.backdrop[1],
            self.backdrop[2],
            if self.soft_edges && !themed { 1.0 } else { 0.0 },
        ];
        let settings = if self.reduced {
            [0.0; 4]
        } else {
            // A dark vignette muddies the light paintings' pale edges.
            let vignette = if self.scene.light { 0.15 } else { 0.6 };
            [vignette, 0.05, f.flash, (f.time * 24.0).floor()]
        };
        if !self.reduced || backdrop[3] > 0.0 {
            let gl = &self.gl;
            self.begin(&self.post, screen);
            gl.uniform4fv_with_f32_array(self.post.at("u_post"), &settings);
            gl.uniform4fv_with_f32_array(self.post.at("u_backdrop"), &backdrop);
            if !self.reduced {
                gl.uniform1f(self.post.at("u_pass"), 0.0);
                gl.blend_func(Gl::DST_COLOR, Gl::ONE_MINUS_SRC_ALPHA);
                self.draw_span(full);
                gl.blend_func(Gl::ONE, Gl::ONE_MINUS_SRC_ALPHA);
            }
            gl.uniform1f(self.post.at("u_pass"), 1.0);
            self.draw_span(full);
        }
        if themed {
            let edges = self.soft_edges.then_some(EDGES);
            self.themed.present(&self.gl, self.backdrop, edges);
        }
        self.mesh = mesh;
        self.frames = self.frames.wrapping_add(1);
    }
}
