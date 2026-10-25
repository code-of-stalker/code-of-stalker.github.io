use crate::{
    atlas::{self, Rect},
    clock::Clock,
    contour,
    motion::Motion,
    palette::Palette,
    quality::{EffectSurface, PaintCadence, Quality},
};
use std::{borrow::Cow, collections::BTreeMap};
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;
#[path = "observer_gpu.rs"]
mod observer_gpu;
#[path = "raster_gpu.rs"]
mod raster_gpu;
#[path = "uniforms.rs"]
mod uniforms;
#[path = "vector_gpu.rs"]
mod vector_gpu;
use uniforms::*;
#[path = "material.rs"]
mod material;
const VERTEX: &str = r#"struct V{@builtin(position)position:vec4<f32>,@location(0)uv:vec2<f32>}
@vertex fn main(@builtin(vertex_index)i:u32)->V{let q=array<vec2<f32>,3>(vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));var v:V;v.position=vec4(q[i],0.,1.);v.uv=q[i]*.5+.5;return v;}"#;
const COPY: &str = include_str!("../shaders/presentation.wgsl");
fn err(v: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&v.to_string())
}
fn texture(d: &wgpu::Device, w: u32, h: u32) -> wgpu::Texture {
    d.create_texture(&wgpu::TextureDescriptor {
        label: Some("product effect resource"),
        size: wgpu::Extent3d {
            width: w,
            height: h,
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::COPY_DST
            | wgpu::TextureUsages::TEXTURE_BINDING
            | wgpu::TextureUsages::RENDER_ATTACHMENT,
        view_formats: &[],
    })
}
fn buffer(d: &wgpu::Device) -> wgpu::Buffer {
    d.create_buffer(&wgpu::BufferDescriptor {
        label: Some("product uniforms"),
        size: 2048,
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    })
}
fn group(
    d: &wgpu::Device,
    l: &wgpu::BindGroupLayout,
    b: &wgpu::Buffer,
    s: &wgpu::Texture,
    blur: &wgpu::Texture,
    c: &wgpu::Texture,
    sampler: &wgpu::Sampler,
) -> wgpu::BindGroup {
    let sv = s.create_view(&Default::default());
    let bv = blur.create_view(&Default::default());
    let cv = c.create_view(&Default::default());
    d.create_bind_group(&wgpu::BindGroupDescriptor {
        label: Some("product cached bindings"),
        layout: l,
        entries: &[
            wgpu::BindGroupEntry {
                binding: 0,
                resource: b.as_entire_binding(),
            },
            wgpu::BindGroupEntry {
                binding: 1,
                resource: wgpu::BindingResource::TextureView(&sv),
            },
            wgpu::BindGroupEntry {
                binding: 2,
                resource: wgpu::BindingResource::TextureView(&bv),
            },
            wgpu::BindGroupEntry {
                binding: 3,
                resource: wgpu::BindingResource::Sampler(sampler),
            },
            wgpu::BindGroupEntry {
                binding: 4,
                resource: wgpu::BindingResource::TextureView(&cv),
            },
        ],
    })
}
fn pipeline(
    d: &wgpu::Device,
    l: &wgpu::PipelineLayout,
    fragment: &str,
    format: wgpu::TextureFormat,
) -> wgpu::RenderPipeline {
    let vs = d.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("product vertex"),
        source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(VERTEX)),
    });
    let fs = d.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("approved product shader"),
        source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(fragment)),
    });
    d.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: Some("product pipeline"),
        layout: Some(l),
        vertex: wgpu::VertexState {
            module: &vs,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            buffers: &[],
        },
        primitive: Default::default(),
        depth_stencil: None,
        multisample: Default::default(),
        fragment: Some(wgpu::FragmentState {
            module: &fs,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            targets: &[Some(wgpu::ColorTargetState {
                format,
                blend: None,
                write_mask: wgpu::ColorWrites::ALL,
            })],
        }),
        multiview_mask: None,
        cache: None,
    })
}
fn pass(
    e: &mut wgpu::CommandEncoder,
    view: &wgpu::TextureView,
    p: &wgpu::RenderPipeline,
    g: &wgpu::BindGroup,
) {
    let attachments = [Some(wgpu::RenderPassColorAttachment {
        view,
        depth_slice: None,
        resolve_target: None,
        ops: wgpu::Operations {
            load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
            store: wgpu::StoreOp::Store,
        },
    })];
    let mut r = e.begin_render_pass(&wgpu::RenderPassDescriptor {
        label: Some("product effect"),
        color_attachments: &attachments,
        ..Default::default()
    });
    r.set_pipeline(p);
    r.set_bind_group(0, g, &[]);
    r.draw(0..3, 0..1);
}
struct Node {
    applied_quality: Quality,
    width: f32,
    height: f32,
    size: [u32; 2],
    rect: Rect,
    path: String,
    orbs: bool,
    active: bool,
    reduced: bool,
    scan: bool,
    dirty: bool,
    background_dirty: bool,
    rain: bool,
    motion: Motion,
    clock: Clock,
    last_time: f64,
    paint_cadence: PaintCadence,
    params: [f32; 512],
    palette: Palette,
    glass: wgpu::Buffer,
    h: wgpu::Buffer,
    v: wgpu::Buffer,
    source: wgpu::Texture,
    horizontal: wgpu::Texture,
    vertical: wgpu::Texture,
    contour: wgpu::Texture,
    output: wgpu::Texture,
    source_view: wgpu::TextureView,
    horizontal_view: wgpu::TextureView,
    vertical_view: wgpu::TextureView,
    output_view: wgpu::TextureView,
    glass_group: wgpu::BindGroup,
    h_group: wgpu::BindGroup,
    v_group: wgpu::BindGroup,
    source_group: wgpu::BindGroup,
    copy_group: wgpu::BindGroup,
    draws: u32,
    blur_updates: u32,
    source_updates: u32,
    contour_updates: u32,
    observer: Option<observer_gpu::ObserverGpu>,
    vector: Option<vector_gpu::VectorGpu>,
    vector_motion: Option<crate::SvgTimeline>,
    raster: Option<raster_gpu::RasterGpu>,
}
impl Node {
    fn effect_surface(&self) -> EffectSurface {
        if self.vector.is_none() && self.raster.is_none() && self.observer.is_none() && !self.rain {
            EffectSurface::Glass
        } else {
            EffectSurface::Artwork
        }
    }
    fn moving(&self) -> bool {
        self.motion.moving()
            || self.rain
            || self.observer.is_some()
            || self.vector.is_some()
            || self.raster.is_some()
            || (self.orbs
                && self.params[U_FLOW_ENABLED] > 0.5
                && self.params[U_FLOW_SPEED] > 0.0
                && self.params[U_FLOW_STRENGTH] > 0.0)
    }
    fn new(d: &wgpu::Device, l: &wgpu::BindGroupLayout, s: &wgpu::Sampler) -> Self {
        let source = texture(d, 1, 1);
        let horizontal = texture(d, 1, 1);
        let vertical = texture(d, 1, 1);
        let contour = texture(d, 1, 1);
        let output = texture(d, 1, 1);
        let glass = buffer(d);
        let h = buffer(d);
        let v = buffer(d);
        let glass_group = group(d, l, &glass, &source, &vertical, &contour, s);
        let h_group = group(d, l, &h, &source, &source, &contour, s);
        let v_group = group(d, l, &v, &horizontal, &horizontal, &contour, s);
        // The procedural background does not sample the output it writes.
        // A distinct cached texture keeps the shared layout valid on WebGL2.
        let source_group = group(d, l, &glass, &contour, &contour, &contour, s);
        let copy_group = group(d, l, &glass, &output, &output, &contour, s);
        let source_view = source.create_view(&Default::default());
        let horizontal_view = horizontal.create_view(&Default::default());
        let vertical_view = vertical.create_view(&Default::default());
        let output_view = output.create_view(&Default::default());
        Self {
            applied_quality: Quality::default(),
            width: 1.,
            height: 1.,
            size: [1, 1],
            rect: Rect::default(),
            path: String::new(),
            orbs: false,
            active: false,
            reduced: false,
            scan: true,
            dirty: true,
            background_dirty: true,
            rain: false,
            motion: Motion::default(),
            clock: Clock::default(),
            last_time: 0.,
            paint_cadence: PaintCadence::default(),
            params: material::DEFAULTS,
            palette: Palette::Dark,
            glass,
            h,
            v,
            source,
            horizontal,
            vertical,
            contour,
            output,
            source_view,
            horizontal_view,
            vertical_view,
            output_view,
            glass_group,
            h_group,
            v_group,
            source_group,
            copy_group,
            draws: 0,
            blur_updates: 0,
            source_updates: 0,
            contour_updates: 0,
            observer: None,
            vector: None,
            vector_motion: None,
            raster: None,
        }
    }
    fn resize(
        &mut self,
        d: &wgpu::Device,
        q: &wgpu::Queue,
        l: &wgpu::BindGroupLayout,
        s: &wgpu::Sampler,
        quality: Quality,
        w: f32,
        h: f32,
        path: &str,
        orbs: bool,
    ) -> Result<(), JsValue> {
        if !w.is_finite() || !h.is_finite() || w <= 0. || h <= 0. {
            return Err(err("Invalid effect size"));
        }
        let surface = self.effect_surface();
        let quality = quality.budgeted(w, h, surface);
        let size = quality.size(w, h, surface);
        if size
            .iter()
            .any(|v| *v > d.limits().max_texture_dimension_2d)
        {
            return Err(err(
                "Effect exceeds GPU texture limit at its permitted resolution",
            ));
        }
        let resized = self.size != size;
        let contour_changed = self.path != path || self.width != w || self.height != h;
        let source_changed = resized || self.orbs != orbs;
        self.width = w;
        self.height = h;
        self.orbs = orbs;
        self.params = material::DEFAULTS;
        self.palette.write(&mut self.params);
        self.params[crate::palette::OFFSET + 1] = self
            .raster
            .as_ref()
            .map_or(0., |r| r.kind.presentation_role());
        self.params[U_RESOLUTION..U_RESOLUTION + 2]
            .copy_from_slice(&[size[0] as f32, size[1] as f32]);
        self.params[U_PIXEL_RATIO] = quality.density;
        self.params[U_CONTOUR_ASPECT] = w / h;
        self.params[U_SOURCE_ASPECT] = w / h;
        self.params[508] = 1.;
        self.params[504..506].copy_from_slice(&[w, h]);
        let limit = w.min(h) * 0.75;
        self.params[U_OPTICAL_TRAVEL] = -limit
            * (-self.params[U_GLASS_OPTICS + 2] * self.params[U_GLASS_OPTICS + 1] * 2.2 / limit)
                .exp_m1();
        // Reduce secondary cost without changing the independent glass resolution.
        if quality.cost >= 2 {
            self.params[U_GLASS_OPTICS + 3] = 0.;
        }
        if quality.cost >= 3 {
            self.params[U_PULSE_OPACITY] = 0.;
        }
        if resized {
            self.source.destroy();
            self.horizontal.destroy();
            self.vertical.destroy();
            self.output.destroy();
            let glass = surface == EffectSurface::Glass;
            self.source = if glass {
                texture(d, size[0], size[1])
            } else {
                texture(d, 1, 1)
            };
            self.output = texture(d, size[0], size[1]);
            self.horizontal = if glass {
                texture(d, (size[0] + 1) / 2, (size[1] + 1) / 2)
            } else {
                texture(d, 1, 1)
            };
            self.vertical = if glass {
                texture(d, (size[0] + 1) / 2, (size[1] + 1) / 2)
            } else {
                texture(d, 1, 1)
            };
            self.source_view = self.source.create_view(&Default::default());
            self.horizontal_view = self.horizontal.create_view(&Default::default());
            self.vertical_view = self.vertical.create_view(&Default::default());
            self.output_view = self.output.create_view(&Default::default());
            self.size = size;
        }
        if contour_changed {
            let (p, cw, ch) = if self.vector.is_some()
                || self.raster.is_some()
                || self.observer.is_some()
                || self.rain
            {
                (vec![255; 4], 1, 1)
            } else {
                contour::pixels(path, w, h).map_err(err)?
            };
            self.contour.destroy();
            self.contour = texture(d, cw, ch);
            q.write_texture(
                wgpu::TexelCopyTextureInfo {
                    texture: &self.contour,
                    mip_level: 0,
                    origin: wgpu::Origin3d::ZERO,
                    aspect: wgpu::TextureAspect::All,
                },
                &p,
                wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(cw * 4),
                    rows_per_image: Some(ch),
                },
                wgpu::Extent3d {
                    width: cw,
                    height: ch,
                    depth_or_array_layers: 1,
                },
            );
            self.path = path.into();
            self.contour_updates += 1;
        }
        if resized || contour_changed {
            self.glass_group = group(
                d,
                l,
                &self.glass,
                &self.source,
                &self.vertical,
                &self.contour,
                s,
            );
            self.h_group = group(d, l, &self.h, &self.source, &self.source, &self.contour, s);
            self.v_group = group(
                d,
                l,
                &self.v,
                &self.horizontal,
                &self.horizontal,
                &self.contour,
                s,
            );
            self.source_group = group(
                d,
                l,
                &self.glass,
                &self.contour,
                &self.contour,
                &self.contour,
                s,
            );
            self.copy_group = group(
                d,
                l,
                &self.glass,
                &self.output,
                &self.output,
                &self.contour,
                s,
            );
        }
        let radius = (material::DEFAULTS[U_BACKGROUND_BLUR] * quality.density * 0.5).min(36.);
        let steps = (radius.ceil() as u32).min((quality.blur_samples() - 1) / 2);
        let sigma = (radius / 3.).max(0.001);
        let spacing = radius / steps.max(1) as f32;
        let mut weights = vec![0.; 37];
        let mut sum = 0.;
        for i in 0..=steps as usize {
            weights[i] = (-0.5 * (i as f32 * spacing / sigma).powi(2)).exp();
            sum += weights[i] * if i == 0 { 1. } else { 2. };
        }
        for v in &mut weights {
            *v /= sum;
        }
        for (horizontal, b) in [(true, &self.h), (false, &self.v)] {
            let mut values = [0.; 512];
            values[0] = if horizontal { 1. } else { 0. };
            values[8] = w / h;
            values[12] = w / h;
            values[16] = if horizontal {
                spacing / self.horizontal.width() as f32
            } else {
                0.
            };
            values[17] = if horizontal {
                0.
            } else {
                spacing / self.vertical.height() as f32
            };
            values[20] = steps as f32;
            for (i, v) in weights.iter().enumerate() {
                values[24 + i * 4] = *v;
            }
            q.write_buffer(b, 0, bytemuck::cast_slice(&values));
        }
        self.params[U_BLUR_ENABLED] = if orbs { 1. } else { 0. };
        self.dirty = true;
        self.background_dirty |= source_changed;
        self.applied_quality = quality;
        q.write_buffer(&self.glass, 0, bytemuck::cast_slice(&self.params));
        Ok(())
    }
    fn texture_stats(&self) -> [u64; 2] {
        let mut stats = [
            5,
            [
                &self.source,
                &self.horizontal,
                &self.vertical,
                &self.contour,
                &self.output,
            ]
            .iter()
            .map(|t| t.width() as u64 * t.height() as u64 * 4)
            .sum(),
        ];
        for more in [
            self.vector.as_ref().map(|v| v.texture_stats()),
            self.raster.as_ref().map(|v| v.texture_stats()),
            self.observer.as_ref().map(|v| v.texture_stats()),
        ]
        .into_iter()
        .flatten()
        {
            stats[0] += more[0];
            stats[1] += more[1];
        }
        stats
    }
    fn destroy(&mut self) {
        if let Some(observer) = &self.observer {
            observer.dispose();
        }
        if let Some(vector) = &self.vector {
            vector.dispose();
        }
        if let Some(raster) = &self.raster {
            raster.dispose();
        }
        if let Some(motion) = &mut self.vector_motion {
            motion.dispose();
        }
        for t in [
            &self.source,
            &self.horizontal,
            &self.vertical,
            &self.contour,
            &self.output,
        ] {
            t.destroy();
        }
        for b in [&self.glass, &self.h, &self.v] {
            b.destroy();
        }
    }
}
/// A single device/surface for the active application; individual plaques have
/// cached resources, never independent contexts or independent animation loops.
struct SceneSnapshot {
    id: u32,
    width: f32,
    height: f32,
    path: String,
    orbs: bool,
    active: bool,
    reduced: bool,
    scan: bool,
    rain: bool,
    observer: bool,
    raster: Option<raster_gpu::Kind>,
    vector_motion: Option<crate::SvgTimeline>,
    motion: Motion,
    clock: Clock,
    draws: u32,
}
/// Opaque CPU state. Surface recovery moves the live clocks/envelopes/gestures;
/// JavaScript neither reconstructs intermediate frames nor serializes keyframes.
#[wasm_bindgen]
pub struct ProductState {
    scenes: Vec<SceneSnapshot>,
    next: u32,
    quality: Quality,
    palette: Palette,
}
#[wasm_bindgen]
pub struct ProductRenderer {
    instance: wgpu::Instance,
    adapter: wgpu::Adapter,
    outputs: BTreeMap<u32, DirectOutput>,
    canvas: HtmlCanvasElement,
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    layout: wgpu::BindGroupLayout,
    sampler: wgpu::Sampler,
    glass_pipeline: wgpu::RenderPipeline,
    blur_pipeline: wgpu::RenderPipeline,
    source_pipeline: wgpu::RenderPipeline,
    copy_pipeline: wgpu::RenderPipeline,
    rain_pipeline: wgpu::RenderPipeline,
    rain_atlas: wgpu::Texture,
    vector_library: vector_gpu::VectorLibrary,
    raster_library: raster_gpu::RasterLibrary,
    nodes: BTreeMap<u32, Node>,
    next: u32,
    quality: Quality,
    palette: Palette,
    backend: String,
    layout_dirty: bool,
    frames: u32,
    disposed: bool,
    lost: std::sync::Arc<std::sync::atomic::AtomicBool>,
}
/// WebGPU surfaces share one device/queue. WebGL keeps the atlas adapter:
/// independent browser GL contexts cannot share its resource objects.
struct DirectOutput {
    canvas: HtmlCanvasElement,
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
    presented: u32,
}
fn acquire(
    surface: &wgpu::Surface<'_>,
    device: &wgpu::Device,
    config: &wgpu::SurfaceConfiguration,
) -> Result<Option<wgpu::SurfaceTexture>, JsValue> {
    match surface.get_current_texture() {
        wgpu::CurrentSurfaceTexture::Success(frame)
        | wgpu::CurrentSurfaceTexture::Suboptimal(frame) => Ok(Some(frame)),
        wgpu::CurrentSurfaceTexture::Timeout | wgpu::CurrentSurfaceTexture::Occluded => Ok(None),
        wgpu::CurrentSurfaceTexture::Outdated => {
            surface.configure(device, config);
            Ok(None)
        }
        problem => Err(err(format!("Graphics surface: {problem:?}"))),
    }
}
#[wasm_bindgen]
impl ProductRenderer {
    pub async fn create(
        canvas: HtmlCanvasElement,
        force_gl: bool,
    ) -> Result<ProductRenderer, JsValue> {
        let mut desc = wgpu::InstanceDescriptor::new_without_display_handle();
        desc.backends = if force_gl {
            wgpu::Backends::GL
        } else {
            wgpu::Backends::BROWSER_WEBGPU | wgpu::Backends::GL
        };
        let instance = wgpu::util::new_instance_with_webgpu_detection(desc).await;
        let surface = instance
            .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
            .map_err(err)?;
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                ..Default::default()
            })
            .await
            .map_err(err)?;
        let backend = format!("Rust / wgpu {:?}", adapter.get_info().backend);
        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("Watcher shared graphics"),
                required_limits: wgpu::Limits::downlevel_webgl2_defaults()
                    .using_resolution(adapter.limits()),
                ..Default::default()
            })
            .await
            .map_err(err)?;
        let lost = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let flag = lost.clone();
        device.set_device_lost_callback(move |_, _| {
            flag.store(true, std::sync::atomic::Ordering::Relaxed);
        });
        let caps = surface.get_capabilities(&adapter);
        let mut config = surface
            .get_default_config(&adapter, 1, 1)
            .ok_or_else(|| err("Graphics surface unavailable"))?;
        if let Some(f) = caps.formats.iter().find(|f| !f.is_srgb()) {
            config.format = *f;
        }
        // wgpu 30's browser backend advertises only Opaque, but configure()
        // explicitly supports PreMultiplied. Auto would flatten our transparent
        // atlas into black when the browser copies it to the visible 2D canvases.
        if adapter.get_info().backend == wgpu::Backend::BrowserWebGpu
            || caps
                .alpha_modes
                .contains(&wgpu::CompositeAlphaMode::PreMultiplied)
        {
            config.alpha_mode = wgpu::CompositeAlphaMode::PreMultiplied;
        }
        surface.configure(&device, &config);
        let mut entries = vec![wgpu::BindGroupLayoutEntry {
            binding: 0,
            visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
            ty: wgpu::BindingType::Buffer {
                ty: wgpu::BufferBindingType::Uniform,
                has_dynamic_offset: false,
                min_binding_size: wgpu::BufferSize::new(2048),
            },
            count: None,
        }];
        for binding in [1, 2, 4] {
            entries.push(wgpu::BindGroupLayoutEntry {
                binding,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Texture {
                    sample_type: wgpu::TextureSampleType::Float { filterable: true },
                    view_dimension: wgpu::TextureViewDimension::D2,
                    multisampled: false,
                },
                count: None,
            });
        }
        entries.push(wgpu::BindGroupLayoutEntry {
            binding: 3,
            visibility: wgpu::ShaderStages::FRAGMENT,
            ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
            count: None,
        });
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("shared material layout"),
            entries: &entries,
        });
        let pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("shared material pipeline"),
            bind_group_layouts: &[Some(&layout)],
            immediate_size: 0,
        });
        let scope = device.push_error_scope(wgpu::ErrorFilter::Validation);
        let glass_pipeline = pipeline(
            &device,
            &pl,
            include_str!("../shaders/glass.wgsl"),
            wgpu::TextureFormat::Rgba8Unorm,
        );
        let blur_pipeline = pipeline(
            &device,
            &pl,
            include_str!("../shaders/blur.wgsl"),
            wgpu::TextureFormat::Rgba8Unorm,
        );
        let source_pipeline = pipeline(
            &device,
            &pl,
            include_str!("../shaders/source.wgsl"),
            wgpu::TextureFormat::Rgba8Unorm,
        );
        let copy_pipeline = pipeline(&device, &pl, COPY, config.format);
        let rain_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("approved matrix rain"),
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("../shaders/rain.wgsl"))),
        });
        let rain_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("shared rain"),
            layout: Some(&pl),
            vertex: wgpu::VertexState {
                module: &rain_shader,
                entry_point: Some("rain_vs"),
                compilation_options: Default::default(),
                buffers: &[],
            },
            primitive: Default::default(),
            depth_stencil: None,
            multisample: Default::default(),
            fragment: Some(wgpu::FragmentState {
                module: &rain_shader,
                entry_point: Some("rain_fs"),
                compilation_options: Default::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format: wgpu::TextureFormat::Rgba8Unorm,
                    blend: Some(wgpu::BlendState::PREMULTIPLIED_ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            multiview_mask: None,
            cache: None,
        });
        let rain_atlas = texture(&device, 768, 144);
        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &rain_atlas,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            include_bytes!(concat!(env!("OUT_DIR"), "/rain.atlas")),
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(768 * 4),
                rows_per_image: Some(144),
            },
            wgpu::Extent3d {
                width: 768,
                height: 144,
                depth_or_array_layers: 1,
            },
        );
        let vector_library = vector_gpu::VectorLibrary::new(&device);
        let raster_library = raster_gpu::RasterLibrary::new(&device);
        if let Some(e) = scope.pop().await {
            return Err(err(e));
        }
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("shared linear sampler"),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        Ok(Self {
            instance,
            adapter,
            outputs: BTreeMap::new(),
            canvas,
            surface,
            device,
            queue,
            config,
            layout,
            sampler,
            glass_pipeline,
            blur_pipeline,
            source_pipeline,
            copy_pipeline,
            rain_pipeline,
            rain_atlas,
            vector_library,
            raster_library,
            nodes: BTreeMap::new(),
            next: 1,
            quality: Quality::default(),
            palette: Palette::Dark,
            backend,
            layout_dirty: true,
            frames: 0,
            disposed: false,
            lost,
        })
    }
    pub fn backend(&self) -> String {
        self.backend.clone()
    }
    pub fn present_to(&mut self, id: u32, canvas: HtmlCanvasElement) -> Result<bool, JsValue> {
        if self.adapter.get_info().backend != wgpu::Backend::BrowserWebGpu {
            return Ok(false);
        }
        if !self.nodes.contains_key(&id) {
            return Err(err("Unknown graphics scene"));
        }
        let surface = self
            .instance
            .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
            .map_err(err)?;
        let mut config = self.config.clone();
        config.width = 1;
        config.height = 1;
        canvas.set_width(1);
        canvas.set_height(1);
        surface.configure(&self.device, &config);
        self.outputs.insert(
            id,
            DirectOutput {
                canvas,
                surface,
                config,
                presented: u32::MAX,
            },
        );
        self.layout_dirty = true;
        Ok(true)
    }
    pub fn snapshot(&mut self) -> ProductState {
        let mut scenes = Vec::new();
        for (id, mut n) in std::mem::take(&mut self.nodes) {
            let mut vector_motion = n.vector_motion.take();
            if let Some(m) = &mut vector_motion {
                m.reset_clock();
            }
            n.clock.suspend();
            scenes.push(SceneSnapshot {
                id,
                width: n.width,
                height: n.height,
                path: n.path.clone(),
                orbs: n.orbs,
                active: n.active,
                reduced: n.reduced,
                scan: n.scan,
                rain: n.rain,
                observer: n.observer.is_some(),
                raster: n.raster.as_ref().map(|r| r.kind),
                vector_motion,
                motion: std::mem::take(&mut n.motion),
                clock: std::mem::take(&mut n.clock),
                draws: n.draws,
            });
            n.destroy();
        }
        ProductState {
            scenes,
            next: self.next,
            quality: self.quality,
            palette: self.palette,
        }
    }
    pub fn restore(&mut self, state: ProductState) -> Result<(), JsValue> {
        self.quality = state.quality;
        self.palette = state.palette;
        self.next = state.next;
        for s in state.scenes {
            let mut n = Node::new(&self.device, &self.layout, &self.sampler);
            n.palette = self.palette;
            n.scan = s.scan;
            n.rain = s.rain;
            n.active = s.active;
            n.reduced = s.reduced;
            n.draws = s.draws;
            n.motion = s.motion;
            n.clock = s.clock;
            if s.observer {
                n.observer = Some(observer_gpu::ObserverGpu::new(
                    &self.device,
                    &self.queue,
                    wgpu::TextureFormat::Rgba8Unorm,
                    2,
                    &self.rain_atlas,
                ));
            }
            if let Some(kind) = s.raster {
                n.raster = Some(raster_gpu::RasterGpu::new(
                    &self.device,
                    &self.queue,
                    &self.raster_library,
                    &self.rain_atlas,
                    kind,
                    self.palette,
                ));
            }
            if let Some(model) = s.vector_motion {
                n.vector = Some(vector_gpu::VectorGpu::new(
                    &self.device,
                    &self.queue,
                    &self.vector_library,
                    &model.model_root(),
                )?);
                n.vector_motion = Some(model);
            }
            if !s.path.is_empty() {
                n.resize(
                    &self.device,
                    &self.queue,
                    &self.layout,
                    &self.sampler,
                    self.quality,
                    s.width,
                    s.height,
                    &s.path,
                    s.orbs,
                )?;
            }
            if n.rain || n.vector.as_ref().is_some_and(|v| v.has_surface_rain()) {
                n.h_group = group(
                    &self.device,
                    &self.layout,
                    &n.h,
                    &self.rain_atlas,
                    &self.rain_atlas,
                    &n.contour,
                    &self.sampler,
                );
            }
            self.nodes.insert(s.id, n);
        }
        self.layout_dirty = true;
        Ok(())
    }
    pub fn add(&mut self, scan: bool) -> u32 {
        let id = self.next;
        self.next += 1;
        let mut node = Node::new(&self.device, &self.layout, &self.sampler);
        node.palette = self.palette;
        node.palette.write(&mut node.params);
        self.queue
            .write_buffer(&node.glass, 0, bytemuck::cast_slice(&node.params));
        node.scan = scan;
        if scan {
            node.motion.replay();
        }
        self.nodes.insert(id, node);
        self.layout_dirty = true;
        id
    }
    /// Presentation palette changes preserve timelines, geometry and allocation.
    pub fn palette(&mut self, code: u32) {
        let palette = Palette::from_code(code);
        if self.palette == palette {
            return;
        }
        self.palette = palette;
        for n in self.nodes.values_mut() {
            n.palette = palette;
            if let Some(model) = &mut n.vector_motion {
                model.reading_palette(code);
            }
            palette.write(&mut n.params);
            if let Some(raster) = &mut n.raster {
                raster.palette(
                    palette,
                    &self.device,
                    &self.queue,
                    &self.raster_library,
                    &self.rain_atlas,
                );
                n.params[crate::palette::OFFSET + 1] = raster.kind.presentation_role();
            }
            self.queue
                .write_buffer(&n.glass, 0, bytemuck::cast_slice(&n.params));
            n.dirty = true;
        }
    }
    pub fn add_rain(&mut self) -> u32 {
        let id = self.add(false);
        self.nodes.get_mut(&id).unwrap().rain = true;
        id
    }
    pub fn add_observer(&mut self) -> u32 {
        let id = self.add(false);
        self.nodes.get_mut(&id).unwrap().observer = Some(observer_gpu::ObserverGpu::new(
            &self.device,
            &self.queue,
            wgpu::TextureFormat::Rgba8Unorm,
            2,
            &self.rain_atlas,
        ));
        id
    }
    pub fn add_raster(&mut self, kind: &str) -> Result<u32, JsValue> {
        let kind = match kind {
            "gallery" => raster_gpu::Kind::Gallery,
            "mirror" => raster_gpu::Kind::Mirror,
            "voice-presence" => raster_gpu::Kind::VoicePresence,
            _ => return Err(err("Unknown raster scene")),
        };
        let mut raster = raster_gpu::RasterGpu::new(
            &self.device,
            &self.queue,
            &self.raster_library,
            &self.rain_atlas,
            kind,
            self.palette,
        );
        raster.palette(
            self.palette,
            &self.device,
            &self.queue,
            &self.raster_library,
            &self.rain_atlas,
        );
        let id = self.add(false);
        let n = self.nodes.get_mut(&id).unwrap();
        n.params[crate::palette::OFFSET + 1] = raster.kind.presentation_role();
        n.raster = Some(raster);
        self.queue
            .write_buffer(&n.glass, 0, bytemuck::cast_slice(&n.params));
        Ok(id)
    }
    pub fn add_vector(
        &mut self,
        root: web_sys::Element,
        kind: &str,
        card: bool,
    ) -> Result<u32, JsValue> {
        let mut motion = crate::SvgTimeline::create(root.clone(), kind, card)?;
        motion.reading_palette(match self.palette {
            Palette::Dark => 0,
            Palette::Light => 1,
            Palette::Neutral => 2,
            Palette::Violet => 3,
        });
        let vector =
            vector_gpu::VectorGpu::new(&self.device, &self.queue, &self.vector_library, &root)?;
        if let Some(svg) = root.query_selector("svg")? {
            let original = svg.get_attribute("style").unwrap_or_default();
            let _ = svg.set_attribute(
                "style",
                &format!("{original};visibility:hidden;animation:none!important;transition:none!important"),
            );
        }
        let id = self.add(false);
        let n = self.nodes.get_mut(&id).unwrap();
        if vector.has_surface_rain() {
            n.h_group = group(
                &self.device,
                &self.layout,
                &n.h,
                &self.rain_atlas,
                &self.rain_atlas,
                &n.contour,
                &self.sampler,
            );
        }
        n.vector = Some(vector);
        n.vector_motion = Some(motion);
        Ok(id)
    }
    pub fn vector_audio(
        &mut self,
        id: u32,
        low: f64,
        mid: f64,
        high: f64,
        contour: Vec<f64>,
        reacting: bool,
        progress: f64,
        locked: bool,
        playback: bool,
    ) {
        if let Some(n) = self.nodes.get_mut(&id) {
            if let Some(motion) = &mut n.vector_motion {
                motion.audio(
                    low, mid, high, contour, reacting, progress, locked, playback,
                );
                n.dirty = true;
            }
        }
    }
    pub fn vector_decoder(&mut self, id: u32, visible: bool) {
        if let Some(n) = self.nodes.get_mut(&id) {
            if let Some(motion) = &mut n.vector_motion {
                motion.decoder_visible(visible);
                n.dirty = true;
            }
        }
    }
    pub fn vector_interact(&mut self, id: u32, action: &str, x: f32, y: f32) {
        if let Some(n) = self.nodes.get_mut(&id) {
            if let Some(motion) = &mut n.vector_motion {
                motion.interact(action, x, y);
                n.dirty = true;
            }
        }
    }
    pub fn vector_pointer_down(&mut self, id: u32, at: f64, w: f64, h: f64, delay: f64) {
        if let Some(n) = self.nodes.get_mut(&id) {
            if let Some(motion) = &mut n.vector_motion {
                motion.pointer_down(at, w, h, delay);
                n.dirty = true;
            }
        }
    }
    pub fn vector_pointer_move(&mut self, id: u32, at: f64, dx: f64, dy: f64) {
        if let Some(n) = self.nodes.get_mut(&id) {
            if let Some(motion) = &mut n.vector_motion {
                motion.pointer_move(at, dx, dy);
                n.dirty = true;
            }
        }
    }
    pub fn vector_pointer_up(&mut self, id: u32, at: f64, inside: bool) -> bool {
        if let Some(n) = self.nodes.get_mut(&id) {
            if let Some(motion) = &mut n.vector_motion {
                n.dirty = true;
                return motion.pointer_up(at, inside);
            }
        }
        false
    }
    pub fn remove(&mut self, id: u32) {
        self.outputs.remove(&id);
        if let Some(mut n) = self.nodes.remove(&id) {
            n.destroy();
            self.layout_dirty = true;
        }
    }
    pub fn resize(
        &mut self,
        id: u32,
        w: f32,
        h: f32,
        path: &str,
        orbs: bool,
    ) -> Result<(), JsValue> {
        let n = self
            .nodes
            .get_mut(&id)
            .ok_or_else(|| err("Unknown effect"))?;
        let old = n.size;
        n.resize(
            &self.device,
            &self.queue,
            &self.layout,
            &self.sampler,
            self.quality,
            w,
            h,
            path,
            orbs,
        )?;
        if let Some(motion) = &mut n.vector_motion {
            motion.resize(w, h);
        }
        if n.rain || n.vector.as_ref().is_some_and(|v| v.has_surface_rain()) {
            n.h_group = group(
                &self.device,
                &self.layout,
                &n.h,
                &self.rain_atlas,
                &self.rain_atlas,
                &n.contour,
                &self.sampler,
            );
        }
        self.layout_dirty |= old != n.size;
        Ok(())
    }
    pub fn quality(&mut self, density: f32, cost: u32, fps: f64) -> Result<(), JsValue> {
        self.quality.set(density, cost, fps);
        // Keep the existing pictures and clocks. Visible scenes adopt the latest
        // request inside frame(), one at a time; hidden scenes wait until active.
        for n in self.nodes.values_mut() {
            n.applied_quality.target_fps = self.quality.target_fps;
        }
        Ok(())
    }
    pub fn quality_pending(&self) -> bool {
        self.nodes.values().any(|n| {
            n.active
                && !n.path.is_empty()
                && n.applied_quality
                    .needs_rebuild(self.quality, n.effect_surface())
        })
    }
    fn apply_next_quality(&mut self) -> Result<(), JsValue> {
        let id = self
            .nodes
            .iter()
            .filter(|(_, n)| {
                n.active
                    && !n.path.is_empty()
                    && n.applied_quality
                        .needs_rebuild(self.quality, n.effect_surface())
            })
            .max_by_key(|(_, n)| n.size[0] as u64 * n.size[1] as u64)
            .map(|(id, _)| *id);
        let Some(id) = id else {
            return Ok(());
        };
        let n = self.nodes.get_mut(&id).unwrap();
        let old = n.size;
        let previous_cost = n.applied_quality.cost;
        let path = n.path.clone();
        n.resize(
            &self.device,
            &self.queue,
            &self.layout,
            &self.sampler,
            self.quality,
            n.width,
            n.height,
            &path,
            n.orbs,
        )?;
        if previous_cost != n.applied_quality.cost && n.orbs {
            n.background_dirty = true;
        }
        if n.rain || n.vector.as_ref().is_some_and(|v| v.has_surface_rain()) {
            n.h_group = group(
                &self.device,
                &self.layout,
                &n.h,
                &self.rain_atlas,
                &self.rain_atlas,
                &n.contour,
                &self.sampler,
            );
        }
        self.layout_dirty |= old != n.size;
        Ok(())
    }
    pub fn active(&mut self, id: u32, active: bool, reduced: bool) {
        if let Some(n) = self.nodes.get_mut(&id) {
            if n.active != active || n.reduced != reduced {
                self.layout_dirty |= n.active != active;
                n.clock.suspend();
                n.last_time = n.clock.elapsed;
                n.dirty = true;
                if !active {
                    n.motion.cancel_contact();
                }
            }
            n.active = active;
            n.reduced = reduced;
            if let Some(motion) = &mut n.vector_motion {
                motion.active(active, reduced);
            }
        }
    }
    pub fn pointer(&mut self, id: u32, x: f32, y: f32, down: bool) {
        if let Some(n) = self.nodes.get_mut(&id) {
            n.motion.pointer(x, y, down);
            n.dirty = true;
        }
    }
    /// Representative optical load; the bridge supplies only delivery time.
    pub fn benchmark(&mut self, id: u32, at: f64) {
        if let Some(n) = self.nodes.get_mut(&id) {
            n.motion.pointer(
                0.5 + (at / 900.).sin() as f32 * 0.3,
                0.5 + (at / 1300.).cos() as f32 * 0.25,
                true,
            );
            n.dirty = true;
        }
    }
    pub fn reset_clock(&mut self) {
        for n in self.nodes.values_mut() {
            n.clock.suspend();
            n.last_time = n.clock.elapsed;
            if let Some(motion) = &mut n.vector_motion {
                motion.reset_clock();
            }
        }
    }
    pub fn reveal(&self, id: u32) -> f32 {
        self.nodes.get(&id).map_or(1., |n| n.motion.reveal)
    }
    pub fn replay_scan(&mut self, id: u32) {
        if let Some(n) = self.nodes.get_mut(&id) {
            if n.scan {
                n.motion.replay();
                n.clock.suspend();
                n.dirty = true;
            }
        }
    }
    pub fn moving(&self, id: u32) -> bool {
        self.nodes
            .get(&id)
            .is_some_and(|n| n.active && !n.reduced && n.moving())
    }
    pub fn commits(&self, id: u32) -> u32 {
        if let Some(output) = self.outputs.get(&id) {
            return if output.presented == u32::MAX {
                0
            } else {
                output.presented
            };
        }
        self.nodes.get(&id).map_or(0, |n| n.draws)
    }
    pub fn rect(&self, id: u32) -> Vec<f64> {
        self.nodes.get(&id).map_or_else(Vec::new, |n| {
            if self.outputs.contains_key(&id) {
                return vec![0., 0., n.size[0] as f64, n.size[1] as f64];
            }
            vec![
                n.rect.x as f64,
                n.rect.y as f64,
                n.rect.w as f64,
                n.rect.h as f64,
            ]
        })
    }
    /// Counters describe allocations/submissions, never GPU execution time.
    pub fn metrics(&self, id: u32) -> Vec<f64> {
        self.nodes.get(&id).map_or_else(Vec::new, |n| {
            let mut stats = self.raster_library.texture_stats();
            stats[0] += 1;
            stats[1] += self.rain_atlas.width() as u64 * self.rain_atlas.height() as u64 * 4;
            for more in self.nodes.values().map(Node::texture_stats) {
                stats[0] += more[0];
                stats[1] += more[1];
            }
            let v = n.vector.as_ref().map_or([0; 3], |v| v.counters());
            let transfers = n.vector.as_ref().map_or([0; 2], |v| v.transfer_stats());
            vec![
                n.size[0] as f64 / n.width as f64,
                n.size[1] as f64 / n.height as f64,
                n.size[0] as f64,
                n.size[1] as f64,
                n.horizontal.width() as f64,
                n.horizontal.height() as f64,
                n.draws as f64,
                (n.blur_updates + v[2]) as f64,
                (n.source_updates + v[1]) as f64,
                (n.contour_updates + v[0]) as f64,
                self.frames as f64,
                self.nodes.len() as f64,
                stats[0] as f64,
                stats[1] as f64,
                n.source.width() as f64,
                n.source.height() as f64,
                transfers[0] as f64,
                transfers[1] as f64,
                n.applied_quality.cost as f64,
                u32::from(
                    n.applied_quality
                        .needs_rebuild(self.quality, n.effect_surface()),
                ) as f64,
            ]
        })
    }
    pub fn frame(&mut self, now: f64) -> Result<bool, JsValue> {
        if self.disposed {
            return Err(err("Graphics disposed"));
        }
        if self.lost.load(std::sync::atomic::Ordering::Relaxed) {
            return Err(err("Graphics surface: device lost"));
        }
        self.apply_next_quality()?;
        let mut changed = self.layout_dirty;
        if self.layout_dirty {
            let ids: Vec<u32> = self
                .nodes
                .iter()
                .filter(|(id, n)| n.active && !n.path.is_empty() && !self.outputs.contains_key(id))
                .map(|(id, _)| *id)
                .collect();
            let sizes: Vec<_> = ids.iter().map(|id| self.nodes[id].size).collect();
            let (rects, size) =
                atlas::pack(&sizes, self.device.limits().max_texture_dimension_2d).map_err(err)?;
            for (id, r) in ids.iter().zip(rects) {
                self.nodes.get_mut(id).unwrap().rect = r;
            }
            if [self.config.width, self.config.height] != size {
                self.canvas.set_width(size[0]);
                self.canvas.set_height(size[1]);
                self.config.width = size[0];
                self.config.height = size[1];
                self.surface.configure(&self.device, &self.config);
            }
            self.layout_dirty = false;
        }
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Watcher shared frame"),
            });
        for n in self.nodes.values_mut() {
            if !n.active || n.path.is_empty() {
                n.clock.suspend();
                continue;
            }
            let dt = n.clock.step(now, true) as f32;
            let time = n.clock.elapsed;
            n.last_time = time;
            let moving = n.moving();
            let c = material::MOTION;
            n.motion.step(dt, c[0], c[1], c[2], n.reduced);
            if !n.scan {
                n.motion.reveal = 1.;
            }
            if !n.dirty && (!moving || n.reduced) {
                continue;
            }
            if n.vector_motion.as_ref().is_some_and(|m| m.is_reading())
                && !n
                    .paint_cadence
                    .due(time * 1000., n.applied_quality.reading_fps(), n.dirty)
            {
                continue;
            }
            changed = true;
            if let Some(vector) = &mut n.vector {
                n.vector_motion.as_mut().unwrap().frame(now);
                vector.prepare(
                    &self.device,
                    &self.queue,
                    &self.vector_library,
                    n.width,
                    n.height,
                    n.size,
                    n.applied_quality.cost,
                )?;
                if vector.has_surface_rain() {
                    let mut params = [0f32; 512];
                    params[0] = 360.;
                    params[1] = 300.;
                    params[2] = if n.reduced { 0. } else { time as f32 };
                    params[15] = n.applied_quality.particle_fraction();
                    self.queue
                        .write_buffer(&n.h, 0, bytemuck::cast_slice(&params));
                    vector.draw_surface_rain(
                        &mut encoder,
                        &self.rain_pipeline,
                        &n.h_group,
                        params[2],
                    );
                }
                vector.draw(&mut encoder, &self.vector_library, &n.output_view);
                n.draws += 1;
                n.dirty = false;
                continue;
            }
            if let Some(raster) = &mut n.raster {
                raster.prepare(
                    &self.device,
                    &self.queue,
                    time,
                    n.width,
                    n.height,
                    n.size,
                    n.applied_quality,
                    n.reduced,
                );
                raster.draw(&mut encoder, &self.raster_library, &n.output_view);
                n.draws += 1;
                n.dirty = false;
                continue;
            }
            if let Some(observer) = &mut n.observer {
                observer.configure(
                    &self.device,
                    wgpu::TextureFormat::Rgba8Unorm,
                    n.width,
                    n.height,
                    (n.size[0] as f32 / n.width).min(n.size[1] as f32 / n.height),
                    n.reduced,
                );
                observer.prepare_time(time, 1., &self.queue);
                observer.observer(&mut encoder);
                let a = [Some(wgpu::RenderPassColorAttachment {
                    view: &n.output_view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                        store: wgpu::StoreOp::Store,
                    },
                })];
                drop(encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("observer transparent output"),
                    color_attachments: &a,
                    ..Default::default()
                }));
                observer.composite(&mut encoder, &n.output_view);
                n.draws += 1;
                n.dirty = false;
                continue;
            }
            if n.rain {
                let mut params = [0f32; 512];
                params[0] = n.width;
                params[1] = n.height;
                params[2] = if n.reduced { 0. } else { time as f32 };
                params[15] = n.applied_quality.particle_fraction();
                self.queue
                    .write_buffer(&n.h, 0, bytemuck::cast_slice(&params));
                let view = &n.output_view;
                let attachments = [Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                        store: wgpu::StoreOp::Store,
                    },
                })];
                let mut r = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("time-based rain"),
                    color_attachments: &attachments,
                    ..Default::default()
                });
                r.set_pipeline(&self.rain_pipeline);
                r.set_bind_group(0, &n.h_group, &[]);
                r.draw(0..6, 0..((n.width / 11.).ceil() as u32 * 33));
                n.draws += 1;
                n.dirty = false;
                continue;
            }
            n.params[U_TIME] = if n.reduced { 0. } else { time as f32 };
            n.params[U_TOUCH..U_TOUCH + 4].copy_from_slice(&[
                n.motion.x,
                1. - n.motion.y,
                n.motion.pressure,
                0.,
            ]);
            n.params[U_SCAN] = n.motion.reveal;
            n.params[U_PULSE_REVEAL..U_PULSE_REVEAL + 3].copy_from_slice(&[
                n.motion.pulse_x * n.width,
                n.motion.pulse_y * n.height,
                n.motion.pulse,
            ]);
            let angle = c[6].to_radians() + (n.motion.x - 0.5) * 0.35 - (n.motion.y - 0.5) * 0.2;
            n.params[U_DIRECTED_LIGHT] = angle.cos();
            n.params[U_DIRECTED_LIGHT + 1] = angle.sin();
            self.queue
                .write_buffer(&n.glass, 0, bytemuck::cast_slice(&n.params));
            if n.background_dirty {
                if n.orbs {
                    pass(
                        &mut encoder,
                        &n.source_view,
                        &self.source_pipeline,
                        &n.source_group,
                    );
                } else {
                    let view = &n.source_view;
                    let a = [Some(wgpu::RenderPassColorAttachment {
                        view: &view,
                        depth_slice: None,
                        resolve_target: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                            store: wgpu::StoreOp::Store,
                        },
                    })];
                    drop(encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                        label: Some("empty backdrop once"),
                        color_attachments: &a,
                        ..Default::default()
                    }));
                }
                n.source_updates += 1;
                if n.orbs {
                    pass(
                        &mut encoder,
                        &n.horizontal_view,
                        &self.blur_pipeline,
                        &n.h_group,
                    );
                    pass(
                        &mut encoder,
                        &n.vertical_view,
                        &self.blur_pipeline,
                        &n.v_group,
                    );
                    n.blur_updates += 2;
                }
                n.background_dirty = false;
            }
            pass(
                &mut encoder,
                &n.output_view,
                &self.glass_pipeline,
                &n.glass_group,
            );
            n.draws += 1;
            n.dirty = false;
        }
        if !changed {
            return Ok(false);
        }
        let mut presents = Vec::new();
        for (id, output) in &mut self.outputs {
            let Some(n) = self.nodes.get_mut(id) else {
                continue;
            };
            if !n.active || n.path.is_empty() || output.presented == n.draws {
                continue;
            }
            if [output.config.width, output.config.height] != n.size {
                output.canvas.set_width(n.size[0]);
                output.canvas.set_height(n.size[1]);
                output.config.width = n.size[0];
                output.config.height = n.size[1];
                output.surface.configure(&self.device, &output.config);
            }
            if let Some(frame) = acquire(&output.surface, &self.device, &output.config)? {
                let view = frame.texture.create_view(&Default::default());
                pass(&mut encoder, &view, &self.copy_pipeline, &n.copy_group);
                presents.push(frame);
                output.presented = n.draws;
            } else {
                n.dirty = true;
            }
        }
        if self
            .nodes
            .iter()
            .any(|(id, n)| n.active && !n.path.is_empty() && !self.outputs.contains_key(id))
        {
            let Some(frame) = acquire(&self.surface, &self.device, &self.config)? else {
                self.nodes.values_mut().for_each(|n| n.dirty = true);
                return Ok(false);
            };
            let view = frame.texture.create_view(&Default::default());
            let attachments = [Some(wgpu::RenderPassColorAttachment {
                view: &view,
                depth_slice: None,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                    store: wgpu::StoreOp::Store,
                },
            })];
            {
                let mut r = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("composite cached effect atlas"),
                    color_attachments: &attachments,
                    ..Default::default()
                });
                r.set_pipeline(&self.copy_pipeline);
                for (id, n) in &self.nodes {
                    if !n.active || n.path.is_empty() || self.outputs.contains_key(id) {
                        continue;
                    }
                    let b = n.rect;
                    r.set_viewport(b.x as f32, b.y as f32, b.w as f32, b.h as f32, 0., 1.);
                    r.set_scissor_rect(b.x, b.y, b.w, b.h);
                    r.set_bind_group(0, &n.copy_group, &[]);
                    r.draw(0..3, 0..1);
                }
            }
            presents.push(frame);
        }
        self.queue.submit(Some(encoder.finish()));
        for frame in presents {
            self.queue.present(frame);
        }
        self.frames += 1;
        Ok(true)
    }
    pub fn dispose(&mut self) {
        if !self.disposed {
            self.outputs.clear();
            for n in self.nodes.values_mut() {
                n.destroy();
            }
            self.nodes.clear();
            self.device.destroy();
            self.disposed = true;
        }
    }
}
