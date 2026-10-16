//! Cropped, persistent GPU filter passes. Geometry stays vector; only soft glow
//! is cached. A layer is blurred again only when its actual source changes.
use super::*;
#[derive(Clone, Copy, Default)]
pub struct FilterSpec {
    pub sigma: f32,
    pub spread: f32,
    pub out: bool,
    pub slope: f32,
}
impl FilterSpec {
    pub fn parse(svg: &Element, text: &str) -> Option<Self> {
        if let Some(key) = uri(text) {
            let node = list(svg, "filter")
                .into_iter()
                .find(|n| attr(n, "id") == key)?;
            let sigma = list(&node, "feGaussianBlur")
                .iter()
                .map(|n| number(n, "stdDeviation", 0.).powi(2))
                .sum::<f32>()
                .sqrt();
            let spread = list(&node, "feMorphology")
                .first()
                .map_or(0., |n| number(n, "radius", 0.));
            let out = list(&node, "feComposite")
                .iter()
                .any(|n| attr(n, "operator") == "out");
            let slope = list(&node, "feFuncA")
                .iter()
                .map(|n| number(n, "slope", 1.))
                .product();
            Some(Self {
                sigma,
                spread,
                out,
                slope,
            })
        } else if let Some(value) = text.strip_prefix("blur(") {
            Some(Self {
                sigma: value
                    .trim_end_matches(')')
                    .trim_end_matches("px")
                    .parse()
                    .ok()?,
                slope: 1.,
                ..Default::default()
            })
        } else {
            None
        }
    }
}
pub struct FilterLibrary {
    layout: wgpu::BindGroupLayout,
    pipeline: wgpu::RenderPipeline,
}
impl FilterLibrary {
    pub fn new(device: &wgpu::Device) -> Self {
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("shared cropped glow layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: wgpu::BufferSize::new(32),
                    },
                    count: None,
                },
            ],
        });
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("shared cropped glow pipeline"),
            bind_group_layouts: &[Some(&layout)],
            immediate_size: 0,
        });
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("original SVG soft filters"),
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!(
                "../shaders/vector-filter.wgsl"
            ))),
        });
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("shared cached blur and rim"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("filter_vs"),
                compilation_options: Default::default(),
                buffers: &[],
            },
            primitive: Default::default(),
            depth_stencil: None,
            multisample: Default::default(),
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("filter_fs"),
                compilation_options: Default::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format: wgpu::TextureFormat::Rgba8Unorm,
                    blend: None,
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            multiview_mask: None,
            cache: None,
        });
        Self { layout, pipeline }
    }
}
fn filter_group(
    device: &wgpu::Device,
    library: &FilterLibrary,
    source: &wgpu::Texture,
    original: &wgpu::Texture,
    sampler: &wgpu::Sampler,
    params: &wgpu::Buffer,
) -> wgpu::BindGroup {
    let s = source.create_view(&Default::default());
    let o = original.create_view(&Default::default());
    device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: Some("reused soft layer"),
        layout: &library.layout,
        entries: &[
            wgpu::BindGroupEntry {
                binding: 0,
                resource: wgpu::BindingResource::TextureView(&s),
            },
            wgpu::BindGroupEntry {
                binding: 1,
                resource: wgpu::BindingResource::TextureView(&o),
            },
            wgpu::BindGroupEntry {
                binding: 2,
                resource: wgpu::BindingResource::Sampler(sampler),
            },
            wgpu::BindGroupEntry {
                binding: 3,
                resource: params.as_entire_binding(),
            },
        ],
    })
}
pub struct FilterLayer {
    pub region: [f32; 4],
    pub size: [u32; 2],
    pub indices: std::ops::Range<u32>,
    pub quad: std::ops::Range<u32>,
    pub dirty: bool,
    raw: wgpu::Texture,
    a: wgpu::Texture,
    b: wgpu::Texture,
    msaa: wgpu::Texture,
    vector_params: wgpu::Buffer,
    fx_params: [wgpu::Buffer; 3],
    source_group: wgpu::BindGroup,
    pub composite_group: wgpu::BindGroup,
    groups: [wgpu::BindGroup; 3],
    spec: FilterSpec,
    last_source: Vec<f32>,
    last_parameters: Vec<f32>,
    pub blur_updates: u32,
    pub allocations: u32,
    has_spread: bool,
    last_cost: u32,
    last_density: f32,
    viewport: [f32; 2],
}
impl FilterLayer {
    pub fn new(
        device: &wgpu::Device,
        library: &VectorLibrary,
        gradient: &wgpu::Texture,
        masks: &wgpu::Texture,
        main_params: &wgpu::Buffer,
    ) -> Self {
        let raw = texture(device, 1, 1, 1);
        let a = texture(device, 1, 1, 1);
        let b = texture(device, 1, 1, 1);
        let msaa = texture(device, 1, 1, 4);
        let vector_params = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("retained layer viewport"),
            size: 2064,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let fx_params = std::array::from_fn(|_| {
            device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("retained soft filter uniform"),
                size: 32,
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            })
        });
        let source_group = paint_group(device, library, gradient, masks, &vector_params, gradient);
        let composite_group = paint_group(device, library, gradient, masks, main_params, &b);
        let groups = [
            filter_group(
                device,
                &library.filters,
                &raw,
                &raw,
                &library.sampler,
                &fx_params[0],
            ),
            filter_group(
                device,
                &library.filters,
                &raw,
                &raw,
                &library.sampler,
                &fx_params[1],
            ),
            filter_group(
                device,
                &library.filters,
                &a,
                &raw,
                &library.sampler,
                &fx_params[2],
            ),
        ];
        Self {
            region: [0., 0., 1., 1.],
            size: [1, 1],
            indices: 0..0,
            quad: 0..0,
            dirty: true,
            raw,
            a,
            b,
            msaa,
            vector_params,
            fx_params,
            source_group,
            composite_group,
            groups,
            spec: Default::default(),
            last_source: Vec::new(),
            last_parameters: Vec::new(),
            blur_updates: 0,
            allocations: 4,
            has_spread: false,
            last_cost: u32::MAX,
            last_density: 0.,
            viewport: [0.; 2],
        }
    }
    pub fn prepare(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        library: &VectorLibrary,
        gradient: &wgpu::Texture,
        masks: &wgpu::Texture,
        main_params: &wgpu::Buffer,
        parameters: &[f32],
        source: &[f32],
        width: f32,
        height: f32,
        density: f32,
        spec: FilterSpec,
        scale: f32,
        cost: u32,
    ) -> Result<(), JsValue> {
        let mut bounds = [
            f32::INFINITY,
            f32::INFINITY,
            f32::NEG_INFINITY,
            f32::NEG_INFINITY,
        ];
        for vertex in source.chunks_exact(VERTEX_FLOATS) {
            let x = (vertex[0] + 1.) * width / 2.;
            let y = (1. - vertex[1]) * height / 2.;
            bounds[0] = bounds[0].min(x);
            bounds[1] = bounds[1].min(y);
            bounds[2] = bounds[2].max(x);
            bounds[3] = bounds[3].max(y);
        }
        let pad = (spec.sigma * 3. + spec.spread) * scale + 2.;
        let left = (bounds[0] - pad).floor().max(0.);
        let top = (bounds[1] - pad).floor().max(0.);
        let right = (bounds[2] + pad).ceil().min(width);
        let bottom = (bounds[3] + pad).ceil().min(height);
        let extent = [(right - left).max(1.), (bottom - top).max(1.)];
        // This is a soft intermediate, not the main render. Main buffers still obey
        // 1.50–2.50 exactly; cached glow can use half density without blurring contours.
        let ratio = (density * 0.5).max(0.75);
        let required = [
            (extent[0] * ratio).ceil() as u32,
            (extent[1] * ratio).ceil() as u32,
        ];
        if required
            .iter()
            .any(|v| *v > device.limits().max_texture_dimension_2d)
        {
            return Err(error("Soft vector layer exceeds texture limit"));
        }
        let size = crate::uploads::filter_extent(
            required,
            self.size,
            self.last_density != density || self.viewport != [width, height],
            device.limits().max_texture_dimension_2d,
        );
        // Match the enlarged tile's logical region: scale, blur radius and UVs
        // stay unchanged. Extra transparent padding is clipped by the main view.
        let region = [left, top, size[0] as f32 / ratio, size[1] as f32 / ratio];
        self.last_density = density;
        self.viewport = [width, height];
        let resized = self.size != size;
        let spread_changed = self.has_spread != (spec.spread > 0.);
        let changed = resized || self.region != region;
        self.dirty |= changed
            || self.last_source != source
            || self.last_parameters != parameters
            || self.spec.sigma != spec.sigma
            || self.spec.spread != spec.spread
            || self.spec.slope != spec.slope
            || self.spec.out != spec.out
            || self.last_cost != cost
            || spread_changed;
        self.last_source.clear();
        self.last_source.extend_from_slice(source);
        self.last_parameters.clear();
        self.last_parameters.extend_from_slice(parameters);
        self.spec = spec;
        self.last_cost = cost;
        self.region = region;
        self.has_spread = spec.spread > 0.;
        if resized {
            self.allocations += 4;
            for t in [&self.raw, &self.a, &self.b, &self.msaa] {
                t.destroy();
            }
            self.raw = texture(device, size[0], size[1], 1);
            self.a = texture(device, size[0], size[1], 1);
            self.b = texture(device, size[0], size[1], 1);
            self.msaa = texture(device, size[0], size[1], 4);
            self.size = size;
        }
        if resized || spread_changed {
            self.composite_group = paint_group(
                device,
                library,
                gradient,
                masks,
                main_params,
                if self.has_spread { &self.a } else { &self.b },
            );
            self.groups = [
                filter_group(
                    device,
                    &library.filters,
                    &self.raw,
                    &self.raw,
                    &library.sampler,
                    &self.fx_params[0],
                ),
                filter_group(
                    device,
                    &library.filters,
                    if self.has_spread { &self.a } else { &self.raw },
                    &self.raw,
                    &library.sampler,
                    &self.fx_params[1],
                ),
                filter_group(
                    device,
                    &library.filters,
                    if self.has_spread { &self.b } else { &self.a },
                    &self.raw,
                    &library.sampler,
                    &self.fx_params[2],
                ),
            ];
        }
        let mut p = parameters.to_vec();
        p[..4].copy_from_slice(&[
            width / region[2],
            height / region[3],
            (width - 2. * left - region[2]) / region[2],
            (-height + 2. * top + region[3]) / region[3],
        ]);
        queue.write_buffer(&self.vector_params, 0, bytemuck::cast_slice(&p));
        let sigma = (spec.sigma * scale * ratio).max(0.01);
        let taps = [25., 17., 13., 9.][cost.min(3) as usize];
        let values = [
            [
                spec.spread * scale * ratio / size[0] as f32,
                spec.spread * scale * ratio / size[1] as f32,
                0.,
                0.,
                2.,
                1.,
                if spec.out { 1. } else { 0. },
                taps,
            ],
            [1. / size[0] as f32, 0., sigma, 0., 0., 1., 0., taps],
            [0., 1. / size[1] as f32, sigma, 0., 1., spec.slope, 0., taps],
        ];
        for (buffer, values) in self.fx_params.iter().zip(values) {
            queue.write_buffer(buffer, 0, bytemuck::cast_slice(&values));
        }
        Ok(())
    }
    pub fn render(
        &mut self,
        encoder: &mut wgpu::CommandEncoder,
        library: &VectorLibrary,
        vertices: &wgpu::Buffer,
        indices: &wgpu::Buffer,
    ) {
        if !self.dirty || self.indices.is_empty() {
            return;
        }
        let raw_view = self.raw.create_view(&Default::default());
        let view = self.msaa.create_view(&Default::default());
        let attachments = [Some(wgpu::RenderPassColorAttachment {
            view: &view,
            depth_slice: None,
            resolve_target: Some(&raw_view),
            ops: wgpu::Operations {
                load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                store: wgpu::StoreOp::Discard,
            },
        })];
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("changed vector glow source"),
                color_attachments: &attachments,
                ..Default::default()
            });
            pass.set_pipeline(&library.pipeline);
            pass.set_bind_group(0, &self.source_group, &[]);
            pass.set_vertex_buffer(0, vertices.slice(..));
            pass.set_index_buffer(indices.slice(..), wgpu::IndexFormat::Uint32);
            pass.draw_indexed(self.indices.clone(), 0, 0..1);
        }
        for stage in if self.has_spread { 0..3 } else { 1..3 } {
            let target = if stage == 0 || !self.has_spread && stage == 1 {
                &self.a
            } else {
                &self.b
            };
            if self.has_spread && stage == 2 {
                let target = &self.a;
                self.filter_pass(encoder, library, stage, target);
            } else {
                self.filter_pass(encoder, library, stage, target);
            }
        }
        self.blur_updates += if self.has_spread { 3 } else { 2 };
        self.dirty = false;
    }
    fn filter_pass(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        library: &VectorLibrary,
        stage: usize,
        target: &wgpu::Texture,
    ) {
        let view = target.create_view(&Default::default());
        let attachments = [Some(wgpu::RenderPassColorAttachment {
            view: &view,
            depth_slice: None,
            resolve_target: None,
            ops: wgpu::Operations {
                load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                store: wgpu::StoreOp::Store,
            },
        })];
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("cached original soft filter"),
            color_attachments: &attachments,
            ..Default::default()
        });
        pass.set_pipeline(&library.filters.pipeline);
        pass.set_bind_group(0, &self.groups[stage], &[]);
        pass.draw(0..3, 0..1);
    }
    pub fn dispose(&self) {
        for t in [&self.raw, &self.a, &self.b, &self.msaa] {
            t.destroy();
        }
        self.vector_params.destroy();
        for b in &self.fx_params {
            b.destroy();
        }
    }
}
