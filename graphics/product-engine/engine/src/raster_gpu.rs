//! The supplied gallery/mirror are raster artwork. Only their immutable pixels
//! and soft intermediates are cached; Rust evaluates every movement at active time.
use std::borrow::Cow;
mod gallery {
    include!("../assets/gallery-atlas.rs");
}
mod mirror {
    include!("../assets/mirror-atlas.rs");
}
#[derive(Clone, Copy)]
pub enum Kind {
    Gallery,
    Mirror,
    VoicePresence,
}
impl Kind {
    /// Authored gallery, mask-colored mirror and the voice painting have
    /// separate palette paths.
    pub fn presentation_role(self) -> f32 {
        match self {
            Self::Gallery => 1.,
            Self::Mirror => 2.,
            Self::VoicePresence => 3.,
        }
    }
}
pub struct RasterLibrary {
    layout: wgpu::BindGroupLayout,
    sampler: wgpu::Sampler,
    normal: wgpu::RenderPipeline,
    screen: wgpu::RenderPipeline,
    mirror: wgpu::RenderPipeline,
    voice: wgpu::RenderPipeline,
    fade: wgpu::RenderPipeline,
    assets: std::cell::RefCell<[Option<wgpu::Texture>; 6]>,
}
impl RasterLibrary {
    fn atlas(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        kind: Kind,
        palette: crate::palette::Palette,
    ) -> wgpu::Texture {
        let at = match kind {
            Kind::Gallery if palette == crate::palette::Palette::Light => 2,
            Kind::Gallery => 0,
            Kind::Mirror => 1,
            Kind::VoicePresence => 3,
        };
        self.assets.borrow_mut()[at]
            .get_or_insert_with(|| {
                upload(
                    device,
                    queue,
                    match at {
                        3 => include_bytes!("../assets/voice-presence.png"),
                        2 => include_bytes!("../assets/gallery-sand-atlas.png"),
                        1 => include_bytes!("../assets/mirror-atlas.png"),
                        _ => include_bytes!("../assets/gallery-atlas.png"),
                    },
                )
            })
            .clone()
    }
    fn voice_layers(&self, device: &wgpu::Device, queue: &wgpu::Queue) -> wgpu::Texture {
        self.assets.borrow_mut()[4]
            .get_or_insert_with(|| {
                upload_rgba(
                    device,
                    queue,
                    1536,
                    1024,
                    &crate::voice_presence::environment_layers(),
                )
            })
            .clone()
    }
    fn voice_portrait(&self, device: &wgpu::Device, queue: &wgpu::Queue) -> wgpu::Texture {
        self.assets.borrow_mut()[5]
            .get_or_insert_with(|| {
                upload_image(device, queue, &crate::voice_presence::user_portrait())
            })
            .clone()
    }
    pub fn new(device: &wgpu::Device) -> Self {
        let texture = |binding| wgpu::BindGroupLayoutEntry {
            binding,
            visibility: wgpu::ShaderStages::FRAGMENT,
            ty: wgpu::BindingType::Texture {
                sample_type: wgpu::TextureSampleType::Float { filterable: true },
                view_dimension: wgpu::TextureViewDimension::D2,
                multisampled: false,
            },
            count: None,
        };
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("shared authored raster layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: wgpu::BufferSize::new(128),
                    },
                    count: None,
                },
                texture(1),
                texture(2),
                texture(4),
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        let pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("shared authored raster pipeline"),
            bind_group_layouts: &[Some(&layout)],
            immediate_size: 0,
        });
        let sprites = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("gallery portraits / particles"),
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("../shaders/raster.wgsl"))),
        });
        let wall = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("approved mirror shader"),
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("../shaders/mirror.wgsl"))),
        });
        let voice_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("approved voice presence"),
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!(
                "../shaders/voice-presence.wgsl"
            ))),
        });
        let attributes = wgpu::vertex_attr_array![0=>Float32x2,1=>Float32x2,2=>Float32x2,3=>Float32x4,4=>Float32x4,5=>Float32x4];
        let buffers = [Some(wgpu::VertexBufferLayout {
            array_stride: 72,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &attributes,
        })];
        let make = |shader: &wgpu::ShaderModule,
                    vs: &str,
                    fs: &str,
                    blend: wgpu::BlendState,
                    vertices: bool| {
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some(vs),
                layout: Some(&pl),
                vertex: wgpu::VertexState {
                    module: shader,
                    entry_point: Some(vs),
                    compilation_options: Default::default(),
                    buffers: if vertices { &buffers } else { &[] },
                },
                primitive: Default::default(),
                depth_stencil: None,
                multisample: wgpu::MultisampleState {
                    count: 4,
                    ..Default::default()
                },
                fragment: Some(wgpu::FragmentState {
                    module: shader,
                    entry_point: Some(fs),
                    compilation_options: Default::default(),
                    targets: &[Some(wgpu::ColorTargetState {
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        blend: Some(blend),
                        write_mask: wgpu::ColorWrites::ALL,
                    })],
                }),
                multiview_mask: None,
                cache: None,
            })
        };
        let normal_blend = wgpu::BlendState::PREMULTIPLIED_ALPHA_BLENDING;
        let normal = make(&sprites, "sprite_vs", "sprite_fs", normal_blend, true);
        let screen = make(
            &sprites,
            "sprite_vs",
            "sprite_fs",
            wgpu::BlendState {
                color: wgpu::BlendComponent {
                    src_factor: wgpu::BlendFactor::One,
                    dst_factor: wgpu::BlendFactor::OneMinusSrc,
                    operation: wgpu::BlendOperation::Add,
                },
                alpha: wgpu::BlendComponent::OVER,
            },
            true,
        );
        let mirror = make(&wall, "mirror_vs", "mirror_fs", normal_blend, false);
        let voice = make(&voice_shader, "voice_vs", "voice_fs", normal_blend, false);
        // Multiply destination RGB and alpha together, preserving premultiplication.
        // One final triangle in the existing pass; no extra texture or scene reset.
        let multiply_alpha = wgpu::BlendComponent {
            src_factor: wgpu::BlendFactor::Zero,
            dst_factor: wgpu::BlendFactor::SrcAlpha,
            operation: wgpu::BlendOperation::Add,
        };
        let fade = make(
            &wall,
            "mirror_vs",
            "fade_fs",
            wgpu::BlendState {
                color: multiply_alpha,
                alpha: multiply_alpha,
            },
            false,
        );
        Self {
            layout,
            sampler,
            normal,
            screen,
            mirror,
            voice,
            fade,
            assets: std::cell::RefCell::new([None, None, None, None, None, None]),
        }
    }
}
impl RasterLibrary {
    pub fn texture_stats(&self) -> [u64; 2] {
        let assets = self.assets.borrow();
        [
            assets.iter().flatten().count() as u64,
            assets
                .iter()
                .flatten()
                .map(|t| t.width() as u64 * t.height() as u64 * 4)
                .sum(),
        ]
    }
}

fn texture(device: &wgpu::Device, w: u32, h: u32, samples: u32) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor {
        label: Some("immutable authored raster texture"),
        size: wgpu::Extent3d {
            width: w,
            height: h,
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: samples,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: if samples > 1 {
            wgpu::TextureUsages::RENDER_ATTACHMENT
        } else {
            wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST
        },
        view_formats: &[],
    })
}
fn upload(device: &wgpu::Device, queue: &wgpu::Queue, bytes: &[u8]) -> wgpu::Texture {
    let image = tiny_skia::Pixmap::decode_png(bytes).expect("validated supplied raster atlas");
    upload_image(device, queue, &image)
}
fn upload_image(
    device: &wgpu::Device,
    queue: &wgpu::Queue,
    image: &tiny_skia::Pixmap,
) -> wgpu::Texture {
    upload_rgba(device, queue, image.width(), image.height(), image.data())
}
fn upload_rgba(
    device: &wgpu::Device,
    queue: &wgpu::Queue,
    width: u32,
    height: u32,
    rgba: &[u8],
) -> wgpu::Texture {
    let t = texture(device, width, height, 1);
    queue.write_texture(
        wgpu::TexelCopyTextureInfo {
            texture: &t,
            mip_level: 0,
            origin: wgpu::Origin3d::ZERO,
            aspect: wgpu::TextureAspect::All,
        },
        rgba,
        wgpu::TexelCopyBufferLayout {
            offset: 0,
            bytes_per_row: Some(width * 4),
            rows_per_image: Some(height),
        },
        wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        },
    );
    t
}
pub struct RasterGpu {
    pub kind: Kind,
    atlas: wgpu::Texture,
    groups: [Option<wgpu::BindGroup>; 2],
    palette: crate::palette::Palette,
    msaa: wgpu::Texture,
    size: [u32; 2],
    params: wgpu::Buffer,
    vertices: wgpu::Buffer,
    indices: wgpu::Buffer,
    capacity: [u64; 2],
    group: wgpu::BindGroup,
    ranges: Vec<(bool, std::ops::Range<u32>)>,
    pub frames: u32,
}
struct Batch {
    vertices: Vec<f32>,
    indices: Vec<u32>,
    ranges: Vec<(bool, std::ops::Range<u32>)>,
    css: [f32; 2],
    logical: [f32; 2],
    matrix: crate::vector_geometry::Matrix,
}
impl Batch {
    fn new(width: f32, height: f32, logical: [f32; 2]) -> Self {
        Self {
            vertices: Vec::new(),
            indices: Vec::new(),
            ranges: Vec::new(),
            css: [width, height],
            logical,
            matrix: Default::default(),
        }
    }
    fn point(&self, p: [f32; 2]) -> [f32; 2] {
        let p = self.matrix.point(p);
        let scale = (self.css[0] / self.logical[0]).min(self.css[1] / self.logical[1]);
        [
            (p[0] * scale + (self.css[0] - self.logical[0] * scale) / 2.) / self.css[0] * 2. - 1.,
            1. - (p[1] * scale + (self.css[1] - self.logical[1] * scale) / 2.) / self.css[1] * 2.,
        ]
    }
    fn quad(
        &mut self,
        rect: [f32; 4],
        uv: [f32; 4],
        color: [f32; 4],
        effect: [f32; 4],
        screen: bool,
    ) {
        let [x, y, w, h] = rect;
        let base = (self.vertices.len() / 18) as u32;
        for [p, q] in [
            [[x, y], [uv[0], uv[1]]],
            [[x + w, y], [uv[0] + uv[2], uv[1]]],
            [[x + w, y + h], [uv[0] + uv[2], uv[1] + uv[3]]],
            [[x, y + h], [uv[0], uv[1] + uv[3]]],
        ] {
            let output = self.point(p);
            let world = self.matrix.point(p);
            self.vertices.extend(output);
            self.vertices.extend(world);
            self.vertices.extend(q);
            self.vertices.extend(uv);
            self.vertices.extend(color);
            self.vertices.extend(effect);
        }
        let start = self.indices.len() as u32;
        self.indices.extend([0, 1, 2, 0, 2, 3].map(|i| base + i));
        self.range(screen, start, self.indices.len() as u32);
    }
    fn range(&mut self, screen: bool, start: u32, end: u32) {
        if let Some((previous, range)) = self.ranges.last_mut() {
            if *previous == screen {
                range.end = end;
                return;
            }
        }
        self.ranges.push((screen, start..end));
    }
    fn sprite(&mut self, rect: [f32; 4], uv: [f32; 4], alpha: f32, screen: bool, kind: f32) {
        if alpha > 0.00001 {
            self.quad(rect, uv, [1., 1., 1., alpha], [kind, 0., 0., 0.], screen);
        }
    }
    fn line(
        &mut self,
        a: [f32; 2],
        b: [f32; 2],
        width: f32,
        color: [f32; 4],
        white: [f32; 4],
        screen: bool,
        kind: f32,
    ) {
        let dx = b[0] - a[0];
        let dy = b[1] - a[1];
        let length = dx.hypot(dy).max(0.00001);
        let n = [-dy / length * width / 2., dx / length * width / 2.];
        let base = (self.vertices.len() / 18) as u32;
        for p in [
            [a[0] + n[0], a[1] + n[1]],
            [b[0] + n[0], b[1] + n[1]],
            [b[0] - n[0], b[1] - n[1]],
            [a[0] - n[0], a[1] - n[1]],
        ] {
            let output = self.point(p);
            let world = self.matrix.point(p);
            self.vertices.extend(output);
            self.vertices.extend(world);
            self.vertices.extend([white[0] + 0.5, white[1] + 0.5]);
            self.vertices.extend(white);
            self.vertices.extend(color);
            self.vertices.extend([kind, 0., 0., 0.]);
        }
        let start = self.indices.len() as u32;
        self.indices.extend([0, 1, 2, 0, 2, 3].map(|i| base + i));
        self.range(screen, start, self.indices.len() as u32);
    }
    fn arc(
        &mut self,
        c: [f32; 2],
        r: [f32; 2],
        from: f32,
        to: f32,
        width: f32,
        color: [f32; 4],
        white: [f32; 4],
        screen: bool,
    ) {
        let steps = ((to - from).abs() * r[0].max(r[1]) / 3.).ceil().max(2.) as u32;
        let mut a = [c[0] + from.cos() * r[0], c[1] + from.sin() * r[1]];
        for i in 1..=steps {
            let t = from + (to - from) * i as f32 / steps as f32;
            let b = [c[0] + t.cos() * r[0], c[1] + t.sin() * r[1]];
            self.line(a, b, width, color, white, screen, 0.);
            a = b;
        }
    }
    fn glyph(&mut self, rect: [f32; 4], index: usize, alpha: f32, kind: f32) {
        let uv = [
            (index % 16 * 48 + 4) as f32,
            (index / 16 * 48 + 4) as f32,
            40.,
            40.,
        ];
        self.sprite(rect, uv, alpha, true, kind);
    }
}
fn edge(points: &[[f32; 2]; 4], distance: f32) -> [f32; 2] {
    let lengths = std::array::from_fn::<_, 4, _>(|i| {
        (points[(i + 1) % 4][0] - points[i][0]).hypot(points[(i + 1) % 4][1] - points[i][1])
    });
    let mut d = distance.rem_euclid(lengths.iter().sum());
    for i in 0..4 {
        if d <= lengths[i] {
            let k = d / lengths[i];
            return [
                points[i][0] + (points[(i + 1) % 4][0] - points[i][0]) * k,
                points[i][1] + (points[(i + 1) % 4][1] - points[i][1]) * k,
            ];
        }
        d -= lengths[i];
    }
    points[0]
}
fn random(n: f32) -> f32 {
    let value = (n * 127.1 + 37.7).sin() * 43758.5453;
    value - value.floor()
}
fn glitch(t: f32) -> [f32; 4] {
    let heads = [
        [65., 179.],
        [145., 148.],
        [322., 134.],
        [439., 176.],
        [530., 159.],
    ];
    let epoch = (t / 2.4).floor();
    let start = 0.2 + random(epoch + 4.) * 1.2;
    let duration = 0.14 + random(epoch + 9.) * 0.2;
    let age = (t - epoch * 2.4 - start) / duration;
    let amplitude = if age > 0. && age < 1. && random(epoch + 2.) > 0.18 {
        (age * std::f32::consts::PI).sin().powi(2)
    } else {
        0.
    };
    let head = heads[(random(epoch + 13.) * 5.).floor().min(4.) as usize];
    [
        head[0] + (random(epoch + 7.) - 0.5) * 35.,
        head[1] + (random(epoch + 18.) - 0.5) * 75.,
        amplitude,
        if random(epoch + 5.) > 0.5 { 1. } else { -1. },
    ]
}
impl RasterGpu {
    pub fn new(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        library: &RasterLibrary,
        glyphs: &wgpu::Texture,
        kind: Kind,
        palette: crate::palette::Palette,
    ) -> Self {
        let atlas = library.atlas(device, queue, kind, palette);
        let params = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("small raster state uniform"),
            size: 128,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let av = atlas.create_view(&Default::default());
        let gv = if matches!(kind, Kind::VoicePresence) {
            library
                .voice_layers(device, queue)
                .create_view(&Default::default())
        } else {
            glyphs.create_view(&Default::default())
        };
        let pv = if matches!(kind, Kind::VoicePresence) {
            library
                .voice_portrait(device, queue)
                .create_view(&Default::default())
        } else {
            av.clone()
        };
        let group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("reused raster atlas bindings"),
            layout: &library.layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: params.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&av),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::TextureView(&gv),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: wgpu::BindingResource::Sampler(&library.sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: wgpu::BindingResource::TextureView(&pv),
                },
            ],
        });
        let vertices = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("reused authored vertices"),
            size: 72,
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let indices = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("reused authored indices"),
            size: 4,
            usage: wgpu::BufferUsages::INDEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        Self {
            kind,
            groups: if palette == crate::palette::Palette::Light && matches!(kind, Kind::Gallery) {
                [None, Some(group.clone())]
            } else {
                [Some(group.clone()), None]
            },
            palette,
            atlas,
            params,
            vertices,
            indices,
            capacity: [72, 4],
            group,
            msaa: texture(device, 1, 1, 4),
            size: [1, 1],
            ranges: Vec::new(),
            frames: 0,
        }
    }
    /// Theme switches reuse geometry, clocks, buffers, pipelines and cached atlases.
    pub fn palette(
        &mut self,
        palette: crate::palette::Palette,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        library: &RasterLibrary,
        glyphs: &wgpu::Texture,
    ) {
        if self.palette == palette {
            return;
        }
        self.palette = palette;
        if !matches!(self.kind, Kind::Gallery) {
            return;
        }
        let at = usize::from(palette == crate::palette::Palette::Light);
        let atlas = library.atlas(device, queue, self.kind, palette);
        let group = self.groups[at].get_or_insert_with(|| {
            let av = atlas.create_view(&Default::default());
            let gv = glyphs.create_view(&Default::default());
            let group = device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("cached sand portrait bindings"),
                layout: &library.layout,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: self.params.as_entire_binding(),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::TextureView(&av),
                    },
                    wgpu::BindGroupEntry {
                        binding: 2,
                        resource: wgpu::BindingResource::TextureView(&gv),
                    },
                    wgpu::BindGroupEntry {
                        binding: 3,
                        resource: wgpu::BindingResource::Sampler(&library.sampler),
                    },
                    wgpu::BindGroupEntry {
                        binding: 4,
                        resource: wgpu::BindingResource::TextureView(&av),
                    },
                ],
            });
            group
        });
        self.atlas = atlas;
        self.group = group.clone();
    }
    pub fn prepare(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        seconds: f64,
        width: f32,
        height: f32,
        size: [u32; 2],
        quality: crate::quality::Quality,
        reduced: bool,
    ) {
        let t = if reduced {
            0.
        } else {
            seconds as f32
                * match self.kind {
                    Kind::Gallery => 0.45,
                    Kind::Mirror => 0.65,
                    Kind::VoicePresence => 1.,
                }
        };
        let mut values = [0f32; 32];
        values[0] = t;
        values[4] = self.atlas.width() as f32;
        values[5] = self.atlas.height() as f32;
        values[6] = quality.cost as f32;
        values[7] = f32::from(self.palette == crate::palette::Palette::Light);
        values[28] = match self.palette {
            crate::palette::Palette::Dark => 0.,
            crate::palette::Palette::Light => 1.,
            crate::palette::Palette::Neutral => 2.,
            crate::palette::Palette::Violet => 3.,
        };
        values[29] = f32::from(matches!(self.kind, Kind::Mirror));
        let mut b = Batch::new(
            width,
            height,
            match self.kind {
                Kind::Gallery => [1487., 1058.],
                Kind::Mirror => [576., 412.],
                Kind::VoicePresence => crate::voice_presence::ARTWORK_SIZE,
            },
        );
        match self.kind {
            Kind::Gallery => {
                values[8..12].copy_from_slice(&gallery::BASE);
                values[20..24].copy_from_slice(&gallery::FLOOR_MASK);
                self.gallery(&mut b, t, quality);
            }
            Kind::Mirror => {
                values[8..12].copy_from_slice(&mirror::BASE);
                values[12..16].copy_from_slice(&mirror::MASK);
                values[16..20].copy_from_slice(&mirror::ENERGY);
                values[24..28].copy_from_slice(&glitch(t));
                self.mirror(&mut b, t, quality);
            }
            Kind::VoicePresence => {
                // Apply the shared end-of-pass edge mask to the entire image,
                // including departing code fragments and reduced-motion frames.
                values[30] = 1.;
                let frame = crate::voice_presence::frame(seconds, reduced);
                values[0..4].copy_from_slice(&[
                    frame.seconds,
                    frame.breath,
                    frame.voice,
                    frame.motion,
                ]);
                values[8..12].copy_from_slice(&[
                    frame.waves[0][0],
                    frame.waves[0][1],
                    frame.waves[1][0],
                    frame.waves[1][1],
                ]);
                values[12..16].copy_from_slice(&[
                    frame.waves[2][0],
                    frame.waves[2][1],
                    frame.restore,
                    0.,
                ]);
                values[16] = frame.code_seconds;
                for fragment in crate::voice_presence::fragments(frame, quality.cost > 1) {
                    let c = fragment.rotation.cos() * fragment.scale;
                    let s = fragment.rotation.sin() * fragment.scale;
                    b.matrix = crate::vector_geometry::Matrix([
                        c,
                        s,
                        -s,
                        c,
                        fragment.center[0],
                        fragment.center[1],
                    ]);
                    b.sprite(
                        [-24., -26., 48., 52.],
                        fragment.source,
                        fragment.opacity,
                        true,
                        9.,
                    );
                }
                b.matrix = Default::default();
            }
        }
        queue.write_buffer(&self.params, 0, bytemuck::cast_slice(&values));
        let need = [b.vertices.len() as u64 * 4, b.indices.len() as u64 * 4];
        for i in 0..2 {
            if need[i] > self.capacity[i] {
                self.capacity[i] = need[i].next_power_of_two();
                let buffer = device.create_buffer(&wgpu::BufferDescriptor {
                    label: Some("grown reusable authored buffer"),
                    size: self.capacity[i],
                    usage: if i == 0 {
                        wgpu::BufferUsages::VERTEX
                    } else {
                        wgpu::BufferUsages::INDEX
                    } | wgpu::BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                });
                if i == 0 {
                    self.vertices.destroy();
                    self.vertices = buffer;
                } else {
                    self.indices.destroy();
                    self.indices = buffer;
                }
            }
        }
        if !b.vertices.is_empty() {
            queue.write_buffer(&self.vertices, 0, bytemuck::cast_slice(&b.vertices));
            queue.write_buffer(&self.indices, 0, bytemuck::cast_slice(&b.indices));
        }
        self.ranges = b.ranges;
        if size != self.size {
            self.msaa.destroy();
            self.msaa = texture(device, size[0], size[1], 4);
            self.size = size;
        }
    }
    pub fn draw(
        &mut self,
        encoder: &mut wgpu::CommandEncoder,
        library: &RasterLibrary,
        output: &wgpu::TextureView,
    ) {
        let view = self.msaa.create_view(&Default::default());
        let a = [Some(wgpu::RenderPassColorAttachment {
            view: &view,
            depth_slice: None,
            resolve_target: Some(output),
            ops: wgpu::Operations {
                load: wgpu::LoadOp::Clear(
                    if matches!(self.kind, Kind::Gallery)
                        && self.palette == crate::palette::Palette::Light
                    {
                        wgpu::Color::TRANSPARENT
                    } else {
                        wgpu::Color::BLACK
                    },
                ),
                store: wgpu::StoreOp::Discard,
            },
        })];
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Rust authored raster scene"),
            color_attachments: &a,
            ..Default::default()
        });
        pass.set_bind_group(0, &self.group, &[]);
        if matches!(self.kind, Kind::Mirror) {
            pass.set_pipeline(&library.mirror);
            pass.draw(0..3, 0..1);
        }
        if matches!(self.kind, Kind::VoicePresence) {
            pass.set_pipeline(&library.voice);
            pass.draw(0..3, 0..1);
        }
        pass.set_vertex_buffer(0, self.vertices.slice(..));
        pass.set_index_buffer(self.indices.slice(..), wgpu::IndexFormat::Uint32);
        for (screen, range) in &self.ranges {
            pass.set_pipeline(if *screen {
                &library.screen
            } else {
                &library.normal
            });
            pass.draw_indexed(range.clone(), 0, 0..1);
        }
        pass.set_pipeline(&library.fade);
        pass.draw(0..3, 0..1);
        self.frames += 1;
    }
    fn gallery(&self, b: &mut Batch, t: f32, q: crate::quality::Quality) {
        use crate::vector_geometry::Matrix;
        let pi = std::f32::consts::PI;
        let tau = 2. * pi;
        let fraction = q.particle_fraction();
        b.sprite([0., 0., 1487., 1058.], gallery::BASE, 1., false, 0.);
        let textures = [
            gallery::CARD0,
            gallery::CARD1,
            gallery::CARD2,
            gallery::CARD3,
            gallery::CARD4,
            gallery::CARD5,
        ];
        let lights = [
            gallery::LIGHT0,
            gallery::LIGHT1,
            gallery::LIGHT2,
            gallery::LIGHT3,
            gallery::LIGHT4,
            gallery::LIGHT5,
        ];
        let points = [
            [[52., 247.], [234., 314.], [233., 709.], [52., 761.]],
            [[255., 175.], [432., 236.], [432., 574.], [255., 633.]],
            [[464., 161.], [615., 214.], [615., 512.], [464., 547.]],
            [[873., 214.], [1024., 161.], [1024., 547.], [873., 512.]],
            [[1055., 237.], [1232., 175.], [1232., 633.], [1055., 580.]],
            [[1254., 315.], [1436., 247.], [1436., 761.], [1254., 709.]],
        ];
        for i in 0..6 {
            let [x, y, w, h] = gallery::CARDS[i];
            let phase = i as f32 * 1.19 + 0.3;
            let depth = [1.2, 0.85, 0.6, 0.65, 0.9, 1.15][i];
            let dx = (t * 0.38 + phase).sin() * 3.6 * depth;
            let dy = ((t * 0.48 + phase).sin() * 10. + (t * 0.19 + phase).sin() * 2.) * depth;
            let tilt = (t * 0.29 + phase).sin() * 0.0032 * 1.4;
            let shear = (t * 0.31 + phase).sin() * 0.009 * 1.4 * if i < 3 { -1. } else { 1. };
            let sx = 1. + (t * 0.37 + phase).sin() * 0.006 * 1.4;
            b.matrix = Matrix([1., 0., 0., 1., x + w / 2. + dx, y + h / 2. + dy])
                .then(Matrix([
                    tilt.cos(),
                    tilt.sin(),
                    -tilt.sin(),
                    tilt.cos(),
                    0.,
                    0.,
                ]))
                .then(Matrix([sx, shear, 0., 1., 0., 0.]));
            let middle = (t * 0.07 + phase * 0.15).fract() * (h + 90.) - 45.;
            let amplitude = (0.8 + (0.5 + 0.5 * (t * 0.9 - phase).sin()).powi(2) * 2.4) * 1.1;
            b.quad(
                [-w / 2., -h / 2., w, h],
                textures[i],
                [1.; 4],
                [1., middle, amplitude, phase],
                false,
            );
            let light = (0.015 + 0.085 * (0.5 + 0.5 * (t * 0.66 - phase).sin()).powi(3)) * 2.;
            b.sprite([-w / 2., -h / 2., w, h], lights[i], light, true, 0.);
            let local = points[i].map(|p| [p[0] - x - w / 2., p[1] - y - h / 2.]);
            let perimeter = (0..4)
                .map(|k| {
                    (local[(k + 1) % 4][0] - local[k][0]).hypot(local[(k + 1) % 4][1] - local[k][1])
                })
                .sum::<f32>();
            let head = t * 91. + phase * perimeter * 0.29;
            for pass in 0..if q.secondary_glow() { 3 } else { 1 } {
                let index = if q.secondary_glow() { pass } else { 2 };
                for k in 0..21 {
                    let a = edge(&local, head - k as f32 * 5.);
                    let z = edge(&local, head - (k + 1) as f32 * 5.);
                    let alpha = (1. - k as f32 / 22.).powf(1.4) * [0.075, 0.20, 0.88][index] * 1.1;
                    b.line(
                        a,
                        z,
                        [7., 2.8, 0.95][index],
                        [1., 224. / 255., 123. / 255., alpha],
                        gallery::WHITE,
                        true,
                        0.,
                    );
                }
            }
            let p = edge(&local, head);
            b.sprite(
                [p[0] - 15., p[1] - 15., 30., 30.],
                gallery::GLINT,
                0.88,
                true,
                0.,
            );
        }
        b.matrix = Matrix::default();
        let chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789"
            .chars()
            .count();
        for ring in 0..16 {
            let r = 108. + ring as f32 * 32.;
            let count = (tau * r / 37.).round() as u32;
            for k in 0..count {
                let a = k as f32 / count as f32 * tau + (ring % 2) as f32 * 0.07;
                let seed = (k as f32 * 39.21 + ring as f32 * 77.71).sin().abs();
                if seed > 0.6 * 0.62 * fraction {
                    continue;
                }
                let radius = r + (seed - 0.5) * 8.;
                let age = (t * 84. * 0.65 - radius + 60.).rem_euclid(346.);
                if age > 195. {
                    continue;
                }
                let edge = (1. - (radius / 650.).powi(3)).max(0.);
                let envelope = (1. - (-age / 8.).exp()) * (-age / 66.).exp() * edge;
                let sine = a.sin();
                let x = 743. + a.cos() * radius;
                let y = 839. + sine * radius * 0.235;
                let size = 32. + (sine + 1.) * 5.;
                b.matrix = Matrix([1., 0., a.cos() * 0.12, 0.56 + sine * 0.04, x, y]);
                b.glyph(
                    [-size / 2., -size / 2., size, size],
                    (seed * chars as f32).floor() as usize % chars,
                    envelope * (0.68 + seed * 0.5) * 0.4,
                    if sine < 0. { 4. } else { 3. },
                );
            }
        }
        b.matrix = Matrix::default();
        for i in 0..2 {
            let r = 72. + (t * 84. * 0.65 + i as f32 * 346.).rem_euclid(692.);
            if r < 650. {
                b.arc(
                    [743., 839.],
                    [r, r * 0.235],
                    0.,
                    tau,
                    0.8,
                    [
                        245. / 255.,
                        193. / 255.,
                        53. / 255.,
                        (1. - r / 690.) * 0.17 * 0.4,
                    ],
                    gallery::WHITE,
                    true,
                );
            }
        }
        for (x, y, r) in [
            (351., 701., 14.),
            (523., 678., 6.),
            (965., 678., 6.),
            (1135., 701., 14.),
        ] {
            let a = ((y - 753.084f32) / 84.593).atan2((x - 743.) / 496.) + t * 0.19 * 0.7;
            let sine = a.sin();
            let p = [743. + a.cos() * 496., 753.084 + sine * 84.593];
            let size = 0.85 + (sine + 1.) * 0.13;
            let kind = if sine < 0. { 5. } else { 0. };
            b.sprite(
                [p[0] - 26. * size, p[1] - 26. * size, 52. * size, 52. * size],
                gallery::GLINT,
                1.,
                true,
                kind,
            );
            b.sprite(
                [p[0] - 32. * size, p[1] - 32. * size, 64. * size, 64. * size],
                if r > 10. {
                    gallery::SPHERE_LARGE
                } else {
                    gallery::SPHERE_SMALL
                },
                1.,
                false,
                kind,
            );
            for n in 0..9 {
                b.arc(
                    [743., 753.084],
                    [496., 84.593],
                    a - (n + 1) as f32 * 0.018,
                    a - n as f32 * 0.018,
                    1.1,
                    [1., 213. / 255., 60. / 255., (1. - n as f32 / 9.) * 0.25],
                    gallery::WHITE,
                    true,
                );
            }
        }
        let pulse = 0.5 + 0.5 * (t * 0.79 - 0.9).sin();
        let shimmer = 0.5 + 0.5 * (t * 1.53 + 0.6).sin();
        b.sprite(
            [625., 0., 234., 1058.],
            gallery::EMISSION,
            (0.04 + 0.22 * pulse) * 2.,
            true,
            0.,
        );
        if q.secondary_glow() {
            b.sprite(
                [623., 65., 240., 890.],
                gallery::BASE_HALO,
                (0.1 + 0.16 * pulse + 0.025 * shimmer) * 2.,
                true,
                0.,
            );
            b.sprite(
                [714., -180., 58., 700.],
                gallery::TOP_HALO,
                (0.08 + 0.24 * pulse) * 2.,
                true,
                0.,
            );
            b.sprite(
                [480., 791., 526., 108.],
                gallery::GROUND_HALO,
                (0.1 + 0.20 * pulse) * 2.,
                true,
                0.,
            );
        }
        for i in 0..(10. * fraction).ceil() as usize {
            let cycle = (t * 0.047 + i as f32 * 0.127).fract();
            let y = 906. - cycle * 839.;
            let x = 743.
                + (i as f32 * 4.72).sin()
                    * (0.5 + (cycle * pi).sin() * 0.5)
                    * if i < 3 { 8. } else { 58. };
            let alpha = (cycle * pi).sin().powi(2) * (0.12 + (i % 3) as f32 * 0.07) * 2.;
            b.sprite([x - 9., y - 22., 18., 44.], gallery::GLINT, alpha, true, 0.);
        }
        let sweep = (t * 0.07).fract();
        let y = 883. - sweep * 880.;
        b.sprite(
            [719., y - 100., 48., 210.],
            gallery::TOP_HALO,
            (sweep * pi).sin().powi(3) * 0.20 * 2.,
            true,
            0.,
        );
        for (cx, cy, rx, ry, offset, speed, alpha) in [
            (743., 836., 216., 42., 0.3, 0.20, 1.4),
            (743., 849., 432., 77., 3.4, -0.105, 1.2),
            (743., 850., 523., 97., 2.2, 0.065, 0.9),
            (743., 64., 254., 69., 4.6, 0.115, 1.),
        ] {
            let a = t * speed + offset;
            b.arc(
                [cx, cy],
                [rx, ry],
                a - 0.20,
                a,
                0.85,
                [1., 216. / 255., 66. / 255., alpha * 0.65],
                gallery::WHITE,
                true,
            );
            let x = cx + a.cos() * rx;
            let y = cy + a.sin() * ry;
            b.sprite(
                [x - 14., y - 14., 28., 28.],
                gallery::GLINT,
                alpha,
                true,
                0.,
            );
        }
    }
    fn mirror(&self, b: &mut Batch, t: f32, q: crate::quality::Quality) {
        let columns = [
            35., 48., 72., 95., 119., 151., 169., 184., 211., 223., 266., 278., 304., 337., 351.,
            382., 410., 425., 441., 462., 490., 514., 536., 550.,
        ];
        let characters = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789";
        let digits = characters.chars().position(|c| c == '0').unwrap();
        for (i, x) in columns.into_iter().enumerate() {
            if i as f32 / 24. > q.particle_fraction() {
                continue;
            }
            let speed = 14. + (i * 17 % 22) as f32;
            let head = (t * speed + i as f32 * 47.).rem_euclid(370.);
            for n in 0..17 {
                let y = head - n as f32 * 9.6;
                if y < 0. || y > 330. {
                    continue;
                }
                let digit = (i * 23 + n * 17 + (t * 1.3).floor() as usize) % 7 > 2;
                let alpha = (1. - n as f32 / 17.).powf(1.7) * 0.8 * if n == 0 { 1. } else { 0.55 };
                b.glyph(
                    [x - 5., y - 6., 10., 12.],
                    digits + usize::from(digit),
                    alpha,
                    8.,
                );
                if n == 0 {
                    b.sprite(
                        [x - 6., y - 12., 12., 24.],
                        mirror::GLINT,
                        0.18 * 0.8,
                        true,
                        6.,
                    );
                }
            }
        }
        let wall = [[43., 77.], [550., 10.], [548., 305.], [42., 281.]];
        let head = t * 34. + 80.;
        for i in 0..16 {
            b.line(
                edge(&wall, head - i as f32 * 3.),
                edge(&wall, head - (i + 1) as f32 * 3.),
                1.,
                [
                    1.,
                    229. / 255.,
                    107. / 255.,
                    (1. - i as f32 / 16.) * 0.8 * 0.8,
                ],
                mirror::WHITE,
                false,
                7.,
            );
        }
        let p = edge(&wall, head);
        b.sprite(
            [p[0] - 12., p[1] - 12., 24., 24.],
            mirror::GLINT,
            0.7 * 0.8,
            false,
            7.,
        );
        let pulse = 0.5 + 0.5 * (t * 0.83 - 0.8).sin();
        b.sprite(
            [0., 0., 576., 410.],
            mirror::EMISSION,
            0.025 + 0.12 * pulse,
            true,
            0.,
        );
    }
    pub fn texture_stats(&self) -> [u64; 2] {
        [1, self.msaa.width() as u64 * self.msaa.height() as u64 * 16]
    }
    pub fn dispose(&self) {
        self.msaa.destroy();
        self.params.destroy();
        self.vertices.destroy();
        self.indices.destroy();
    }
}
