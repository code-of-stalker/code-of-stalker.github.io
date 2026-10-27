//! Shared vector paint adapter. Original SVG paths remain tessellated triangles;
//! authored transforms/opacity never rebuild their geometry. Soft masks are cached.
//! DOM is an interim scene-description adapter, not the painter or animation clock.
use crate::mesh_cache::{FrameMeshCache, MeshSpec};
use crate::vector_geometry::{self, Matrix, Mesh};
use std::{borrow::Cow, collections::BTreeMap, rc::Rc};
use wasm_bindgen::{JsCast, JsValue};
use web_sys::Element;
use wgpu::util::DeviceExt;
#[path = "vector_masks.rs"]
mod vector_masks;
use vector_masks::MaskCache;
const MASK_DEPTH: usize = 4;
const VERTEX_FLOATS: usize = 10 + MASK_DEPTH * 4;
#[path = "vector_filters.rs"]
mod vector_filters;
use vector_filters::{FilterLayer, FilterLibrary, FilterSpec};

fn error(v: impl ToString) -> JsValue {
    JsValue::from_str(&v.to_string())
}
fn attr(n: &Element, key: &str) -> String {
    n.get_attribute(key).unwrap_or_default()
}
fn number(n: &Element, key: &str, fallback: f32) -> f32 {
    attr(n, key)
        .trim_end_matches("px")
        .parse()
        .unwrap_or(fallback)
}
fn list(root: &Element, selector: &str) -> Vec<Element> {
    root.query_selector_all(selector)
        .map(|n| {
            (0..n.length())
                .filter_map(|i| n.item(i).map(JsCast::unchecked_into))
                .collect()
        })
        .unwrap_or_default()
}
#[derive(Clone)]
struct Style {
    values: BTreeMap<String, String>,
    attributes: BTreeMap<String, String>,
    own: std::collections::BTreeSet<String>,
}
impl Style {
    fn get_property_value(&self, key: &str) -> Result<String, JsValue> {
        Ok(self.values.get(key).cloned().unwrap_or_default())
    }
}
fn css(n: &Element) -> Result<Style, JsValue> {
    let computed = web_sys::window()
        .ok_or_else(|| error("No browser window"))?
        .get_computed_style(n)?
        .ok_or_else(|| error("No vector style"))?;
    // getComputedStyle is live. Snapshot once; never trigger a style/layout flush
    // after Rust writes every animated transform. Dynamic attributes stay Rust-owned.
    let keys = [
        "transform",
        "transform-origin",
        "opacity",
        "display",
        "fill",
        "stroke",
        "stroke-width",
        "fill-rule",
        "stroke-linecap",
        "stroke-linejoin",
        "stroke-dasharray",
        "stroke-dashoffset",
        "color",
        "fill-opacity",
        "stroke-opacity",
        "filter",
        "mask",
        "clip-path",
        "stop-color",
        "stop-opacity",
    ];
    // Each value crosses from the browser once; the parent is asked only when
    // the node declares nothing itself.
    let values: BTreeMap<String, String> = keys
        .iter()
        .map(|key| Ok((key.to_string(), computed.get_property_value(key)?)))
        .collect::<Result<_, JsValue>>()?;
    let attributes: BTreeMap<String, String> = keys
        .iter()
        .map(|key| (key.to_string(), attr(n, key)))
        .collect();
    let style = attr(n, "style");
    let parent = n
        .parent_element()
        .and_then(|p| web_sys::window()?.get_computed_style(&p).ok().flatten());
    let own = keys
        .iter()
        .filter(|key| {
            !attributes[**key].is_empty()
                || declared(&style, key).is_some()
                || parent.as_ref().is_none_or(|p| {
                    p.get_property_value(key).unwrap_or_default() != values[**key]
                })
        })
        .map(|v| v.to_string())
        .collect();
    Ok(Style {
        own,
        values,
        attributes,
    })
}
fn inline(n: &Element, key: &str) -> Option<String> {
    declared(&attr(n, "style"), key)
}
fn declared(style: &str, key: &str) -> Option<String> {
    style.split(';').find_map(|line| {
        let (k, v) = line.split_once(':')?;
        if k.trim() == key {
            Some(v.trim().to_owned())
        } else {
            None
        }
    })
}
fn uri(text: &str) -> Option<String> {
    crate::svg_reference::paint_server_id(text).map(str::to_owned)
}
fn color(text: &str, fallback: [f32; 4]) -> [f32; 4] {
    if let Ok(c) = text.parse::<svgtypes::Color>() {
        [
            c.red as f32 / 255.,
            c.green as f32 / 255.,
            c.blue as f32 / 255.,
            c.alpha as f32 / 255.,
        ]
    } else {
        fallback
    }
}
fn points(n: &Element) -> String {
    let values = crate::tracks::Value::parse(&attr(n, "points")).numbers;
    let mut out = String::new();
    for (i, p) in values.chunks_exact(2).enumerate() {
        out.push_str(&format!(
            "{}{} {}",
            if i == 0 { "M" } else { "L" },
            p[0],
            p[1]
        ));
    }
    if n.tag_name() == "polygon" {
        out.push('Z');
    }
    out
}
fn shape(n: &Element) -> String {
    let x = number(n, "x", 0.);
    let y = number(n, "y", 0.);
    let w = number(n, "width", 0.);
    let h = number(n, "height", 0.);
    match n.tag_name().as_str() {
        "path" => attr(n, "d"),
        "line" => format!(
            "M{} {}L{} {}",
            number(n, "x1", 0.),
            number(n, "y1", 0.),
            number(n, "x2", 0.),
            number(n, "y2", 0.)
        ),
        "polygon" | "polyline" => points(n),
        "circle" | "ellipse" => {
            let cx = number(n, "cx", 0.);
            let cy = number(n, "cy", 0.);
            let rx = number(n, "rx", number(n, "r", 0.));
            let ry = number(n, "ry", rx);
            if rx <= 0. || ry <= 0. {
                return String::new();
            }
            format!(
                "M{} {}A{rx} {ry} 0 1 1 {} {}A{rx} {ry} 0 1 1 {} {}Z",
                cx - rx,
                cy,
                cx + rx,
                cy,
                cx - rx,
                cy
            )
        }
        "rect" => {
            if w <= 0. || h <= 0. {
                return String::new();
            }
            let rx = number(n, "rx", 0.).min(w / 2.);
            let ry = number(n, "ry", rx).min(h / 2.);
            if rx > 0. && ry > 0. {
                format!("M{} {y}H{}A{rx} {ry} 0 0 1 {} {}V{}A{rx} {ry} 0 0 1 {} {}H{}A{rx} {ry} 0 0 1 {x} {}V{}A{rx} {ry} 0 0 1 {} {y}Z",x+rx,x+w-rx,x+w,y+ry,y+h-ry,x+w-rx,y+h,x+rx,y+h-ry,y+ry,x+rx)
            } else {
                format!("M{x} {y}H{}V{}H{x}Z", x + w, y + h)
            }
        }
        _ => String::new(),
    }
}
fn property(n: &Element, base: &Style, key: &str) -> String {
    inline(n, key).unwrap_or_else(|| {
        let current = attr(n, key);
        if !current.is_empty()
            && base
                .attributes
                .get(key)
                .is_some_and(|initial| *initial != current)
        {
            return current;
        }
        if ["fill", "stroke"].contains(&key) && current == "currentColor" {
            return current;
        }
        let computed = base.get_property_value(key).unwrap_or_default();
        if computed.is_empty() {
            attr(n, key)
        } else {
            computed
        }
    })
}
struct State {
    node: Element,
    base: Style,
    initial_transform: String,
    origin: [f32; 2],
    values: BTreeMap<String, String>,
    declared: std::collections::BTreeSet<String>,
    transform_text: String,
    css_transform: bool,
    matrix: Matrix,
}
impl State {
    fn new(node: Element, _prototype: bool) -> Result<Self, JsValue> {
        let base = css(&node)?;
        let origin = crate::tracks::Value::parse(
            &base
                .get_property_value("transform-origin")
                .unwrap_or_default(),
        )
        .numbers;
        let initial_transform = base.get_property_value("transform").unwrap_or_default();
        let mut state = Self {
            node,
            base,
            initial_transform,
            origin: [
                *origin.first().unwrap_or(&0.),
                *origin.get(1).unwrap_or(&0.),
            ],
            values: BTreeMap::new(),
            declared: std::collections::BTreeSet::new(),
            transform_text: String::new(),
            css_transform: false,
            matrix: Matrix::default(),
        };
        state.refresh();
        Ok(state)
    }
    /// One snapshot per node/frame replaces repeated DOM reads for every
    /// primitive inheriting this state. No layout queries occur after motion.
    fn refresh(&mut self) {
        let text = attr(&self.node, "style");
        let inline: BTreeMap<_, _> = text
            .split(';')
            .filter_map(|line| {
                let (key, value) = line.split_once(':')?;
                Some((key.trim(), value.trim()))
            })
            .collect();
        self.declared.clear();
        for (key, computed) in &self.base.values {
            let attribute = self.node.get_attribute(key);
            if self.base.own.contains(key)
                || inline.contains_key(key.as_str())
                || attribute.is_some()
            {
                self.declared.insert(key.clone());
            }
            let current = attribute.as_deref().unwrap_or_default();
            let value = inline.get(key.as_str()).copied().unwrap_or_else(|| {
                if !current.is_empty()
                    && (self.base.attributes.get(key).is_some_and(|v| v != current)
                        || ["fill", "stroke"].contains(&key.as_str()) && current == "currentColor")
                {
                    current
                } else if computed.is_empty() {
                    current
                } else {
                    computed
                }
            });
            self.values.insert(key.clone(), value.to_owned());
        }
        let is_css = inline.contains_key("transform");
        let text = inline
            .get("transform")
            .map(|v| v.to_string())
            .unwrap_or_else(|| {
                let attribute = attr(&self.node, "transform");
                if attribute.is_empty() {
                    self.initial_transform.clone()
                } else {
                    attribute
                }
            });
        if text != self.transform_text || is_css != self.css_transform {
            let normalized = text
                .replace("translateX(", "translate(")
                .replace("translateY(", "translate(0,");
            let m = Matrix::parse(&normalized);
            self.matrix = if is_css {
                let [x, y] = self.origin;
                Matrix([1., 0., 0., 1., x, y])
                    .then(m)
                    .then(Matrix([1., 0., 0., 1., -x, -y]))
            } else {
                m
            };
            self.transform_text = text;
            self.css_transform = is_css;
        }
    }
    fn transform(&self) -> Matrix {
        self.matrix
    }
    fn opacity(&self) -> f32 {
        if self
            .values
            .get("display")
            .is_some_and(|value| value == "none")
        {
            return 0.;
        }
        self.values
            .get("opacity")
            .and_then(|v| v.parse().ok())
            .unwrap_or(1.)
    }
}
#[derive(Clone)]
struct Gradient {
    node: Element,
    row: u32,
    radial: bool,
    user: bool,
    stops: Vec<(f32, [f32; 4])>,
    stop_nodes: Vec<(Element, Style)>,
    stamp: String,
    pub version: u32,
    changed: bool,
}
impl Gradient {
    fn new(node: Element, row: u32) -> Result<Self, JsValue> {
        let radial = node.tag_name() == "radialGradient";
        let user = attr(&node, "gradientUnits") == "userSpaceOnUse";
        let mut stops = Vec::new();
        let mut stop_nodes = Vec::new();
        for stop in list(&node, "stop") {
            let s = css(&stop)?;
            let c = property(&stop, &s, "stop-color");
            let mut c = color(&c, [1., 1., 0., 1.]);
            c[3] *= property(&stop, &s, "stop-opacity").parse().unwrap_or(1.);
            let value = attr(&stop, "offset");
            let offset = if value.ends_with('%') {
                value.trim_end_matches('%').parse::<f32>().unwrap_or(0.) / 100.
            } else {
                value.parse().unwrap_or(0.)
            };
            stops.push((offset, c));
            stop_nodes.push((stop, s));
        }
        if stops.is_empty() {
            stops.push((0., [1.; 4]));
        }
        Ok(Self {
            node,
            row,
            radial,
            user,
            stops,
            stop_nodes,
            stamp: String::new(),
            version: 0,
            changed: true,
        })
    }
    fn refresh(&mut self) -> bool {
        let mut stamp = ["x1", "y1", "x2", "y2", "cx", "cy", "r", "gradientTransform"]
            .iter()
            .map(|k| attr(&self.node, k))
            .collect::<Vec<_>>()
            .join("|");
        let stops = self
            .stop_nodes
            .iter()
            .map(|(n, s)| {
                let offset = attr(n, "offset");
                let mut c = color(&property(n, s, "stop-color"), [1., 1., 0., 1.]);
                c[3] *= property(n, s, "stop-opacity").parse().unwrap_or(1.);
                stamp.push_str(&format!("{offset}:{c:?}|"));
                let position = offset.trim_end_matches('%').parse::<f32>().unwrap_or(0.)
                    / if offset.ends_with('%') { 100. } else { 1. };
                (position, c)
            })
            .collect::<Vec<_>>();
        if stamp == self.stamp {
            return false;
        }
        self.stamp = stamp;
        if !stops.is_empty() {
            self.stops = stops;
        }
        self.version += 1;
        true
    }
    fn affine(&self, bounds: [f32; 4]) -> Matrix {
        let a = self.position([0., 0.], bounds);
        let x = self.position([1., 0.], bounds);
        let y = self.position([0., 1.], bounds);
        Matrix([
            x[0] - a[0],
            x[1] - a[1],
            y[0] - a[0],
            y[1] - a[1],
            a[0],
            a[1],
        ])
    }
    fn rgba(&self, p: f32) -> [u8; 4] {
        let i = self.stops.partition_point(|(at, _)| *at < p);
        let (a, b) = if i == 0 {
            (&self.stops[0], &self.stops[0])
        } else if i >= self.stops.len() {
            (self.stops.last().unwrap(), self.stops.last().unwrap())
        } else {
            (&self.stops[i - 1], &self.stops[i])
        };
        let t = ((p - a.0) / (b.0 - a.0).max(0.00001)).clamp(0., 1.);
        std::array::from_fn(|i| ((a.1[i] + (b.1[i] - a.1[i]) * t) * 255.).round() as u8)
    }
    fn position(&self, p: [f32; 2], bounds: [f32; 4]) -> [f32; 2] {
        let b = [bounds[2] - bounds[0], bounds[3] - bounds[1]];
        let mut p = if self.user {
            p
        } else {
            [
                (p[0] - bounds[0]) / b[0].max(0.0001),
                (p[1] - bounds[1]) / b[1].max(0.0001),
            ]
        };
        p = Matrix::parse(&attr(&self.node, "gradientTransform"))
            .inverse()
            .point(p);
        let v = |key: &str, default: f32, dimension: f32| {
            let s = attr(&self.node, key);
            if s.ends_with('%') {
                s.trim_end_matches('%')
                    .parse::<f32>()
                    .unwrap_or(default * 100.)
                    / 100.
                    * if self.user { dimension } else { 1. }
            } else {
                s.parse().unwrap_or(default)
            }
        };
        if self.radial {
            let cx = v("cx", 0.5, b[0]);
            let cy = v("cy", 0.5, b[1]);
            let r = v("r", 0.5, b[0]).max(0.0001);
            [(p[0] - cx) / r, (p[1] - cy) / r]
        } else {
            let a = [v("x1", 0., b[0]), v("y1", 0., b[1])];
            let b = [v("x2", 1., b[0]), v("y2", 0., b[1])];
            vector_geometry::linear_gradient_position(p, a, b)
        }
    }
}
struct Primitive {
    node: Element,
    ancestors: Vec<usize>,
    source: String,
    stroke_width: f32,
    dash: Vec<f32>,
    dash_offset: f32,
    path_length: f32,
    fill: Rc<Mesh>,
    stroke: Rc<Mesh>,
    mask: Vec<(usize, usize)>,
    matrix_uv: Option<[f32; 9]>,
    matrix_uv_source: String,
}
pub struct VectorLibrary {
    pub layout: wgpu::BindGroupLayout,
    pub sampler: wgpu::Sampler,
    pub pipeline: wgpu::RenderPipeline,
    filters: FilterLibrary,
}
impl VectorLibrary {
    pub fn new(device: &wgpu::Device) -> Self {
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("shared vector atlas"),
            entries: &[0, 1]
                .map(|binding| wgpu::BindGroupLayoutEntry {
                    binding,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                })
                .into_iter()
                .chain([
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 3,
                        visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: wgpu::BufferSize::new(2064),
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 4,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Texture {
                            sample_type: wgpu::TextureSampleType::Float { filterable: true },
                            view_dimension: wgpu::TextureViewDimension::D2,
                            multisampled: false,
                        },
                        count: None,
                    },
                ])
                .collect::<Vec<_>>(),
        });
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        let pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("shared vector pipeline"),
            bind_group_layouts: &[Some(&layout)],
            immediate_size: 0,
        });
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("original contour painter"),
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("../shaders/vector.wgsl"))),
        });
        let pipeline=device.create_render_pipeline(&wgpu::RenderPipelineDescriptor{label:Some("shared original vectors"),layout:Some(&pl),vertex:wgpu::VertexState{module:&shader,entry_point:Some("vector_vs"),compilation_options:Default::default(),buffers:&[Some(wgpu::VertexBufferLayout{array_stride:(VERTEX_FLOATS*4)as u64,step_mode:wgpu::VertexStepMode::Vertex,attributes:&wgpu::vertex_attr_array![0=>Float32x2,1=>Float32x4,2=>Float32x4,3=>Float32x4,4=>Float32x4,5=>Float32x4,6=>Float32x4]})]},primitive:Default::default(),depth_stencil:None,multisample:wgpu::MultisampleState{count:4,..Default::default()},fragment:Some(wgpu::FragmentState{module:&shader,entry_point:Some("vector_fs"),compilation_options:Default::default(),targets:&[Some(wgpu::ColorTargetState{format:wgpu::TextureFormat::Rgba8Unorm,blend:Some(wgpu::BlendState::PREMULTIPLIED_ALPHA_BLENDING),write_mask:wgpu::ColorWrites::ALL})]}),multiview_mask:None,cache:None});
        Self {
            layout,
            sampler,
            pipeline,
            filters: FilterLibrary::new(device),
        }
    }
}
pub struct VectorGpu {
    svg: Element,
    states: Vec<State>,
    primitives: Vec<Primitive>,
    paint_orders: BTreeMap<usize, usize>,
    gradients: BTreeMap<String, Gradient>,
    gradient_texture: wgpu::Texture,
    surface_rain: Option<wgpu::Texture>,
    masks: MaskCache,
    parameters: wgpu::Buffer,
    layers: BTreeMap<usize, FilterLayer>,
    ranges: Vec<(Option<usize>, std::ops::Range<u32>)>,
    filter_specs: BTreeMap<usize, FilterSpec>,
    group: wgpu::BindGroup,
    vertices: wgpu::Buffer,
    indices: wgpu::Buffer,
    data_scratch: Vec<f32>,
    index_scratch: Vec<u32>,
    last_data: Vec<f32>,
    last_indices: Vec<u32>,
    last_parameters: Vec<f32>,
    frame_meshes: FrameMeshCache,
    pub uploaded_bytes: u64,
    vertex_capacity: u64,
    index_capacity: u64,
    index_count: u32,
    msaa: wgpu::Texture,
    size: [u32; 2],
    viewbox: [f32; 4],
    pub meshes_built: u32,
    pub frames: u32,
}
fn texture(device: &wgpu::Device, w: u32, h: u32, samples: u32) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor {
        label: Some("cached vector atlas"),
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
            wgpu::TextureUsages::TEXTURE_BINDING
                | wgpu::TextureUsages::COPY_DST
                | wgpu::TextureUsages::RENDER_ATTACHMENT
        },
        view_formats: &[],
    })
}
fn upload(queue: &wgpu::Queue, texture: &wgpu::Texture, bytes: &[u8]) {
    queue.write_texture(
        wgpu::TexelCopyTextureInfo {
            texture,
            mip_level: 0,
            origin: wgpu::Origin3d::ZERO,
            aspect: wgpu::TextureAspect::All,
        },
        bytes,
        wgpu::TexelCopyBufferLayout {
            offset: 0,
            bytes_per_row: Some(texture.width() * 4),
            rows_per_image: Some(texture.height()),
        },
        wgpu::Extent3d {
            width: texture.width(),
            height: texture.height(),
            depth_or_array_layers: 1,
        },
    );
}
fn primitive_property(p: &Primitive, states: &[State], key: &str) -> String {
    // <use> inherits paint from its actual placement; declarations inside the
    // referenced drawing still win. Do not replace a prototype group's fill
    // with the outer <use>'s default, or all of its outline paths disappear.
    const INHERITED: &[&str] = &[
        "fill",
        "stroke",
        "stroke-width",
        "fill-rule",
        "stroke-linecap",
        "stroke-linejoin",
        "stroke-dasharray",
        "stroke-dashoffset",
        "color",
        "fill-opacity",
        "stroke-opacity",
    ];
    if INHERITED.contains(&key) {
        for id in p.ancestors.iter().rev() {
            let state = &states[*id];
            if state.declared.contains(key) {
                return state.values.get(key).cloned().unwrap_or_default();
            }
        }
    }
    states[p.ancestors[p.ancestors.len() - 1]]
        .values
        .get(key)
        .cloned()
        .unwrap_or_default()
}
fn paint_group(
    device: &wgpu::Device,
    library: &VectorLibrary,
    gradient: &wgpu::Texture,
    masks: &wgpu::Texture,
    parameters: &wgpu::Buffer,
    image: &wgpu::Texture,
) -> wgpu::BindGroup {
    let g = gradient.create_view(&Default::default());
    let m = masks.create_view(&Default::default());
    let i = image.create_view(&Default::default());
    device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: Some("retained vector paint bindings"),
        layout: &library.layout,
        entries: &[
            wgpu::BindGroupEntry {
                binding: 0,
                resource: wgpu::BindingResource::TextureView(&g),
            },
            wgpu::BindGroupEntry {
                binding: 1,
                resource: wgpu::BindingResource::TextureView(&m),
            },
            wgpu::BindGroupEntry {
                binding: 2,
                resource: wgpu::BindingResource::Sampler(&library.sampler),
            },
            wgpu::BindGroupEntry {
                binding: 3,
                resource: parameters.as_entire_binding(),
            },
            wgpu::BindGroupEntry {
                binding: 4,
                resource: wgpu::BindingResource::TextureView(&i),
            },
        ],
    })
}
impl VectorGpu {
    pub fn new(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        library: &VectorLibrary,
        root: &Element,
    ) -> Result<Self, JsValue> {
        let svg = root
            .query_selector("svg")?
            .ok_or_else(|| error("Missing original SVG"))?;
        let v = crate::tracks::Value::parse(&attr(&svg, "viewBox")).numbers;
        let viewbox = [
            *v.first().unwrap_or(&0.),
            *v.get(1).unwrap_or(&0.),
            *v.get(2).unwrap_or(&288.),
            *v.get(3).unwrap_or(&156.),
        ];
        let gradient_texture = texture(
            device,
            512,
            list(&svg, "linearGradient,radialGradient").len().max(1) as u32,
            1,
        );
        let mut gradients = BTreeMap::new();
        let mut pixels =
            vec![255; gradient_texture.width() as usize * gradient_texture.height() as usize * 4];
        for (i, node) in list(&svg, "linearGradient,radialGradient")
            .into_iter()
            .enumerate()
        {
            let id = attr(&node, "id");
            let gradient = Gradient::new(node, i as u32)?;
            for x in 0..512 {
                pixels[(i * 512 + x) * 4..(i * 512 + x) * 4 + 4]
                    .copy_from_slice(&gradient.rgba(x as f32 / 511.));
            }
            gradients.insert(id, gradient);
        }
        upload(queue, &gradient_texture, &pixels);
        let masks = MaskCache::new(device, queue, &svg, &gradients, viewbox)?;
        let parameters = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("cached vector mask parameters"),
            size: 2064,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let surface_rain =
            (!list(&svg, "[data-rust-matrix-uv]").is_empty()).then(|| texture(device, 720, 600, 1));
        let image_view = surface_rain
            .as_ref()
            .unwrap_or(&gradient_texture)
            .create_view(&Default::default());
        let gradient_view = gradient_texture.create_view(&Default::default());
        let mask_view = masks.texture.create_view(&Default::default());
        let group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("cached vector paint"),
            layout: &library.layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&gradient_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&mask_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&library.sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: parameters.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: wgpu::BindingResource::TextureView(&image_view),
                },
            ],
        });
        let vertices = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("reused vector vertices"),
            contents: &[0; VERTEX_FLOATS * 4],
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
        });
        let indices = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("reused vector indices"),
            contents: &[0; 4],
            usage: wgpu::BufferUsages::INDEX | wgpu::BufferUsages::COPY_DST,
        });
        let mut result = Self {
            svg: svg.clone(),
            states: Vec::new(),
            primitives: Vec::new(),
            paint_orders: BTreeMap::new(),
            gradients,
            gradient_texture,
            surface_rain,
            masks,
            parameters,
            layers: BTreeMap::new(),
            ranges: Vec::new(),
            filter_specs: BTreeMap::new(),
            group,
            vertices,
            indices,
            data_scratch: Vec::new(),
            index_scratch: Vec::new(),
            last_data: Vec::new(),
            last_indices: Vec::new(),
            last_parameters: Vec::new(),
            frame_meshes: FrameMeshCache::default(),
            uploaded_bytes: 0,
            vertex_capacity: (VERTEX_FLOATS * 4) as u64,
            index_capacity: 4,
            index_count: 0,
            msaa: texture(device, 1, 1, 4),
            size: [1, 1],
            viewbox,
            meshes_built: 0,
            frames: 0,
        };
        result.walk(svg, Vec::new(), Vec::new(), None, false, 0)?;
        Ok(result)
    }
    fn walk(
        &mut self,
        node: Element,
        mut ancestors: Vec<usize>,
        inherited_mask: Vec<(usize, usize)>,
        use_paint: Option<Element>,
        prototype: bool,
        depth: usize,
    ) -> Result<(), JsValue> {
        if depth > 40 {
            return Err(error("Recursive vector reference"));
        }
        let tag = node.tag_name();
        if [
            "defs",
            "style",
            "title",
            "desc",
            "mask",
            "clipPath",
            "filter",
            "linearGradient",
            "radialGradient",
        ]
        .contains(&tag.as_str())
        {
            return Ok(());
        }
        let id = self.states.len();
        self.states.push(State::new(node.clone(), prototype)?);
        if node.has_attribute("data-paint-order") {
            self.paint_orders.insert(id, usize::MAX);
        }
        if let Some(spec) =
            FilterSpec::parse(&self.svg, &property(&node, &self.states[id].base, "filter"))
        {
            self.filter_specs.insert(id, spec);
        }
        ancestors.push(id);
        let mut mask = inherited_mask;
        for name in ["mask", "clip-path"] {
            let value = property(&node, &self.states[id].base, name);
            if let Some(key) = uri(&value) {
                if let Some(index) = self.masks.ids.get(&key) {
                    if !mask.iter().any(|(i, _)| i == index) {
                        mask.push((*index, id));
                    }
                }
            }
        }
        if tag == "use" {
            let href = attr(&node, "href");
            let href = if href.is_empty() {
                attr(&node, "xlink:href")
            } else {
                href
            };
            if let Some(reference) = href.strip_prefix('#') {
                let target = list(&self.svg, "[id]")
                    .into_iter()
                    .find(|n| attr(n, "id") == reference)
                    .ok_or_else(|| error(format!("Missing vector {reference}")))?;
                return self.walk(target, ancestors, mask, Some(node), true, depth + 1);
            }
            return Ok(());
        }
        if [
            "path", "line", "rect", "circle", "ellipse", "polygon", "polyline",
        ]
        .contains(&tag.as_str())
        {
            // The node's State captured this exact style a moment ago.
            let base = &self.states[id].base;
            let source = shape(&node);
            let stroke_width = property(&node, base, "stroke-width")
                .trim_end_matches("px")
                .parse()
                .unwrap_or(1.);
            let even = property(&node, base, "fill-rule") == "evenodd";
            let round = property(&node, base, "stroke-linecap") == "round";
            let fill = vector_geometry::mesh(&source, None, even, round).map_err(error)?;
            let dash =
                crate::tracks::Value::parse(&property(&node, base, "stroke-dasharray")).numbers;
            let dash_offset = number(&node, "stroke-dashoffset", 0.);
            let path_length = number(&node, "pathLength", 0.);
            let stroke = vector_geometry::dashed_mesh(
                &source,
                stroke_width,
                round,
                &dash,
                dash_offset,
                path_length,
            )
            .map_err(error)?;
            self.meshes_built += 2;
            let matrix_uv = if node.has_attribute("data-rust-matrix-uv") {
                let values =
                    crate::tracks::Value::parse(&attr(&node, "data-rust-matrix-uv")).numbers;
                Some(
                    values
                        .try_into()
                        .map_err(|_| error("Expected nine projective rain UV coefficients"))?,
                )
            } else {
                None
            };
            self.primitives.push(Primitive {
                matrix_uv,
                matrix_uv_source: attr(&node, "data-rust-matrix-uv"),
                node,
                ancestors,
                source,
                stroke_width,
                dash,
                dash_offset,
                path_length,
                fill: Rc::new(fill),
                stroke: Rc::new(stroke),
                mask,
            });
            return Ok(());
        }
        let children = node.children();
        for i in 0..children.length() {
            if let Some(child) = children.item(i) {
                self.walk(
                    child,
                    ancestors.clone(),
                    mask.clone(),
                    use_paint.clone(),
                    prototype,
                    depth + 1,
                )?;
            }
        }
        Ok(())
    }
    pub fn prepare(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        library: &VectorLibrary,
        width: f32,
        height: f32,
        size: [u32; 2],
        cost: u32,
    ) -> Result<(), JsValue> {
        let v = crate::tracks::Value::parse(&attr(&self.svg, "viewBox")).numbers;
        if v.len() == 4 {
            self.viewbox.copy_from_slice(&v);
        }
        let view = self.viewbox;
        let scale = (width / view[2]).min(height / view[3]);
        let offset = [
            (width - view[2] * scale) / 2.,
            (height - view[3] * scale) / 2.,
        ];
        let viewport = Matrix([
            scale,
            0.,
            0.,
            scale,
            offset[0] - view[0] * scale,
            offset[1] - view[1] * scale,
        ]);
        self.states.iter_mut().for_each(State::refresh);
        let mut order_changed = false;
        for (id, previous) in &mut self.paint_orders {
            let rank = attr(&self.states[*id].node, "data-paint-order")
                .parse()
                .unwrap_or(*id);
            order_changed |= rank != *previous;
            *previous = rank;
        }
        if order_changed {
            let mut ranks = (0..self.states.len()).collect::<Vec<_>>();
            for (id, rank) in &self.paint_orders {
                ranks[*id] = *rank;
            }
            self.primitives.sort_by(|a, b| {
                crate::paint_order::compare_paths(&a.ancestors, &b.ancestors, &ranks)
            });
        }
        let transforms = self.states.iter().map(State::transform).collect::<Vec<_>>();
        let opacity = self.states.iter().map(State::opacity).collect::<Vec<_>>();
        for gradient in self.gradients.values_mut() {
            gradient.changed = gradient.refresh();
            if gradient.changed {
                let bytes = (0..512)
                    .flat_map(|x| gradient.rgba(x as f32 / 511.))
                    .collect::<Vec<_>>();
                queue.write_texture(
                    wgpu::TexelCopyTextureInfo {
                        texture: &self.gradient_texture,
                        mip_level: 0,
                        origin: wgpu::Origin3d {
                            x: 0,
                            y: gradient.row,
                            z: 0,
                        },
                        aspect: wgpu::TextureAspect::All,
                    },
                    &bytes,
                    wgpu::TexelCopyBufferLayout {
                        offset: 0,
                        bytes_per_row: Some(2048),
                        rows_per_image: Some(1),
                    },
                    wgpu::Extent3d {
                        width: 512,
                        height: 1,
                        depth_or_array_layers: 1,
                    },
                );
            }
        }
        self.masks.refresh(queue, &self.svg, &self.gradients)?;
        let parameters = self
            .masks
            .parameters(&self.gradients, self.gradient_texture.height());
        if let Some(range) = crate::uploads::changed_span(&self.last_parameters, &parameters) {
            queue.write_buffer(
                &self.parameters,
                (range.start * 4) as u64,
                bytemuck::cast_slice(&parameters[range]),
            );
            self.last_parameters.clear();
            self.last_parameters.extend_from_slice(&parameters);
        }
        let mut data = std::mem::take(&mut self.data_scratch);
        let mut indices = std::mem::take(&mut self.index_scratch);
        data.clear();
        indices.clear();
        self.ranges.clear();
        let mut layer_sources =
            BTreeMap::<usize, (usize, usize, std::ops::Range<u32>, f32, f32, bool)>::new();
        self.frame_meshes.clear();
        for primitive in &mut self.primitives {
            let mut transform = Matrix::default();
            let mut alpha = 1.;
            for id in &primitive.ancestors {
                transform = transform.then(transforms[*id]);
                alpha *= opacity[*id];
            }
            if alpha <= 0.0001 {
                continue;
            }
            let layer = primitive
                .ancestors
                .iter()
                .rev()
                .find(|id| self.filter_specs.contains_key(id))
                .copied();
            let mut composite_alpha = 1.;
            if let Some(layer) = layer {
                alpha = 1.;
                let mut inside = false;
                for id in &primitive.ancestors {
                    if inside {
                        alpha *= opacity[*id];
                    } else {
                        composite_alpha *= opacity[*id];
                    }
                    if *id == layer {
                        inside = true;
                    }
                }
                // SVG filters run before the opacity of their own/outer groups.
                // This also lets opacity animate without invalidating the blur.
                if cost >= 3 {
                    composite_alpha *= 0.65;
                }
            }
            let begin = data.len();
            let first_index = indices.len() as u32;
            // Mask pixels can move while all contour vertices/UVs stay identical.
            // Invalidate only layers that sample those textures, not other artwork.
            let mut paint_changed = primitive
                .mask
                .iter()
                .any(|(id, _)| self.masks.content_changed(*id, &self.gradients));
            if primitive.matrix_uv.is_some() {
                let uv = attr(&primitive.node, "data-rust-matrix-uv");
                if uv != primitive.matrix_uv_source {
                    primitive.matrix_uv = Some(
                        crate::tracks::Value::parse(&uv)
                            .numbers
                            .try_into()
                            .map_err(|_| error("Expected nine projective rain UV coefficients"))?,
                    );
                    primitive.matrix_uv_source = uv;
                    paint_changed = true;
                }
            }
            let source = shape(&primitive.node);
            let stroke_width = primitive_property(primitive, &self.states, "stroke-width")
                .trim_end_matches("px")
                .parse()
                .unwrap_or(1.);
            let even = primitive_property(primitive, &self.states, "fill-rule") == "evenodd";
            let round = primitive_property(primitive, &self.states, "stroke-linecap") == "round";
            let dash = crate::tracks::Value::parse(&primitive_property(
                primitive,
                &self.states,
                "stroke-dasharray",
            ))
            .numbers;
            let dash_offset = primitive_property(primitive, &self.states, "stroke-dashoffset")
                .trim_end_matches("px")
                .parse()
                .unwrap_or(0.);
            let path_length = number(&primitive.node, "pathLength", 0.);
            let path_changed = source != primitive.source;
            let fill_paint = if primitive.matrix_uv.is_some() {
                "#fff".to_owned()
            } else {
                primitive_property(primitive, &self.states, "fill")
            };
            let stroke_paint = primitive_property(primitive, &self.states, "stroke");
            let spec = MeshSpec {
                stroke: None,
                even,
                round,
                dash: &dash,
                offset: dash_offset,
                length: path_length,
            };
            if fill_paint == "none" || fill_paint.is_empty() {
                if !primitive.fill.vertices.is_empty() {
                    primitive.fill = Rc::new(Mesh::default());
                }
            } else if path_changed || primitive.fill.vertices.is_empty() {
                primitive.fill = self.frame_meshes.mesh(&source, spec).map_err(error)?;
            }
            if stroke_paint == "none" || stroke_paint.is_empty() {
                if !primitive.stroke.vertices.is_empty() {
                    primitive.stroke = Rc::new(Mesh::default());
                }
            } else if path_changed
                || stroke_width != primitive.stroke_width
                || dash != primitive.dash
                || dash_offset != primitive.dash_offset
                || path_length != primitive.path_length
                || primitive.stroke.vertices.is_empty()
            {
                primitive.stroke = self
                    .frame_meshes
                    .mesh(
                        &source,
                        MeshSpec {
                            stroke: Some(stroke_width),
                            ..spec
                        },
                    )
                    .map_err(error)?;
            }
            primitive.stroke_width = stroke_width;
            primitive.dash = dash;
            primitive.dash_offset = dash_offset;
            primitive.path_length = path_length;
            primitive.source = source;
            for (stroke, mesh) in [(false, &primitive.fill), (true, &primitive.stroke)] {
                let paint = if stroke { &stroke_paint } else { &fill_paint };
                if paint == "none" || paint.is_empty() {
                    continue;
                }
                let mut color_value = color(paint, [0.9059, 0.8824, 0., 1.]);
                if paint == "currentColor" {
                    color_value = color(
                        &primitive_property(primitive, &self.states, "color"),
                        color_value,
                    );
                }
                color_value[3] *= alpha
                    * primitive_property(
                        primitive,
                        &self.states,
                        if stroke {
                            "stroke-opacity"
                        } else {
                            "fill-opacity"
                        },
                    )
                    .parse::<f32>()
                    .unwrap_or(1.);
                let gradient = uri(paint).and_then(|id| self.gradients.get(&id));
                paint_changed |= gradient.is_some_and(|g| g.changed);
                let gradient_matrix = gradient.map(|g| g.affine(mesh.bounds));
                if primitive.mask.len() > MASK_DEPTH {
                    return Err(error(
                        "Original mask nesting exceeds vector vertex capacity",
                    ));
                }
                let mut mask_transforms = Vec::new();
                for &(mask, parent) in &primitive.mask {
                    let mut m = Matrix::default();
                    for id in primitive.ancestors.iter().take_while(|id| **id != parent) {
                        m = m.then(transforms[*id]);
                    }
                    m = m.then(transforms[parent]);
                    mask_transforms.push((mask, m.inverse()));
                }
                let base = (data.len() / VERTEX_FLOATS) as u32;
                for local in &mesh.vertices {
                    let world = transform.point(*local);
                    let output = viewport.point(world);
                    let mut grad = [0.; 4];
                    if let Some(g) = gradient {
                        let q = gradient_matrix.unwrap().point(*local);
                        grad = [
                            q[0],
                            q[1],
                            (g.row as f32 + 0.5) / self.gradient_texture.height() as f32,
                            if g.radial { 2. } else { 1. },
                        ];
                    }
                    if let Some(m) = primitive.matrix_uv.filter(|_| !stroke) {
                        grad = [
                            m[0] * local[0] + m[1] * local[1] + m[2],
                            m[3] * local[0] + m[4] * local[1] + m[5],
                            m[6] * local[0] + m[7] * local[1] + m[8],
                            -2.,
                        ];
                    }
                    data.extend([output[0] / width * 2. - 1., 1. - output[1] / height * 2.]);
                    data.extend(color_value);
                    data.extend(grad);
                    for i in 0..MASK_DEPTH {
                        data.extend(if let Some((id, m)) = mask_transforms.get(i) {
                            self.masks.coordinates(*id, m.point(world))
                        } else {
                            [0.; 4]
                        });
                    }
                }
                indices.extend(mesh.indices.iter().map(|i| *i + base));
            }
            let last = indices.len() as u32;
            if first_index == last {
                continue;
            }
            if let Some((previous, range)) = self.ranges.last_mut() {
                if *previous == layer {
                    range.end = last;
                } else {
                    self.ranges.push((layer, first_index..last));
                }
            } else {
                self.ranges.push((layer, first_index..last));
            }
            if let Some(id) = layer {
                let mut m = viewport;
                for ancestor in primitive.ancestors.iter() {
                    m = m.then(transforms[*ancestor]);
                    if *ancestor == id {
                        break;
                    }
                }
                let factor = (m.0[0].hypot(m.0[1]) + m.0[2].hypot(m.0[3])) / 2.;
                layer_sources
                    .entry(id)
                    .and_modify(|source| {
                        source.1 = data.len();
                        source.2.end = last;
                        source.5 |= paint_changed;
                    })
                    .or_insert((
                        begin,
                        data.len(),
                        first_index..last,
                        factor,
                        composite_alpha,
                        paint_changed,
                    ));
            }
        }
        self.meshes_built += self.frame_meshes.builds;
        for (id, (begin, end, range, scale, composite_alpha, paint_changed)) in layer_sources {
            let layer = self.layers.entry(id).or_insert_with(|| {
                FilterLayer::new(
                    device,
                    library,
                    &self.gradient_texture,
                    &self.masks.texture,
                    &self.parameters,
                )
            });
            layer.indices = range;
            layer.dirty |= paint_changed;
            layer.prepare(
                device,
                queue,
                library,
                &self.gradient_texture,
                &self.masks.texture,
                &self.parameters,
                &parameters,
                &data[begin..end],
                width,
                height,
                (size[0] as f32 / width).min(size[1] as f32 / height),
                self.filter_specs[&id],
                scale,
                cost,
            )?;
            let [x, y, w, h] = layer.region;
            let base = (data.len() / VERTEX_FLOATS) as u32;
            for (p, uv) in [
                ([x, y], [0., 0.]),
                ([x + w, y], [1., 0.]),
                ([x + w, y + h], [1., 1.]),
                ([x, y + h], [0., 1.]),
            ] {
                data.extend([p[0] / width * 2. - 1., 1. - p[1] / height * 2.]);
                data.extend([1., 1., 1., composite_alpha]);
                data.extend([uv[0], uv[1], 0., -1.]);
                data.extend([0.; MASK_DEPTH * 4]);
            }
            let start = indices.len() as u32;
            indices.extend([0, 1, 2, 0, 2, 3].map(|n| base + n));
            layer.quad = start..indices.len() as u32;
        }
        self.index_count = indices.len() as u32;
        if data.len() as u64 * 4 > self.vertex_capacity {
            self.last_data.clear();
            self.vertices.destroy();
            self.vertex_capacity = (data.len() as u64 * 4).next_power_of_two();
            self.vertices = device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("grown vector vertices"),
                size: self.vertex_capacity,
                usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });
        }
        if indices.len() as u64 * 4 > self.index_capacity {
            self.last_indices.clear();
            self.indices.destroy();
            self.index_capacity = (indices.len() as u64 * 4).next_power_of_two();
            self.indices = device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("grown vector indices"),
                size: self.index_capacity,
                usage: wgpu::BufferUsages::INDEX | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });
        }
        if let Some(range) = crate::uploads::changed_span(&self.last_data, &data) {
            self.uploaded_bytes += (range.len() * 4) as u64;
            queue.write_buffer(
                &self.vertices,
                (range.start * 4) as u64,
                bytemuck::cast_slice(&data[range]),
            );
        }
        if let Some(range) = crate::uploads::changed_span(&self.last_indices, &indices) {
            self.uploaded_bytes += (range.len() * 4) as u64;
            queue.write_buffer(
                &self.indices,
                (range.start * 4) as u64,
                bytemuck::cast_slice(&indices[range]),
            );
        }
        std::mem::swap(&mut self.last_data, &mut data);
        std::mem::swap(&mut self.last_indices, &mut indices);
        self.data_scratch = data;
        self.index_scratch = indices;
        if size != self.size {
            self.msaa.destroy();
            self.msaa = texture(device, size[0], size[1], 4);
            self.size = size;
        }
        Ok(())
    }
    pub fn has_surface_rain(&self) -> bool {
        self.surface_rain.is_some()
    }
    /// Same Laboratory shader, same atlas and preset. Only its canvas is
    /// projected onto authored vector surfaces; no second rain implementation.
    pub fn draw_surface_rain(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        pipeline: &wgpu::RenderPipeline,
        group: &wgpu::BindGroup,
        time: f32,
    ) {
        let Some(texture) = &self.surface_rain else {
            return;
        };
        let _ = self
            .svg
            .set_attribute("data-rust-rain-time", &format!("{time:.4}"));
        let view = texture.create_view(&Default::default());
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
            label: Some("Laboratory rain surface source"),
            color_attachments: &attachments,
            ..Default::default()
        });
        pass.set_pipeline(pipeline);
        pass.set_bind_group(0, group, &[]);
        pass.draw(0..6, 0..(360f32 / 11.).ceil() as u32 * 33);
    }
    pub fn draw(
        &mut self,
        encoder: &mut wgpu::CommandEncoder,
        library: &VectorLibrary,
        output: &wgpu::TextureView,
    ) {
        for layer in self.layers.values_mut() {
            layer.render(encoder, library, &self.vertices, &self.indices);
        }
        let view = self.msaa.create_view(&Default::default());
        let a = [Some(wgpu::RenderPassColorAttachment {
            view: &view,
            depth_slice: None,
            resolve_target: Some(output),
            ops: wgpu::Operations {
                load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                store: wgpu::StoreOp::Discard,
            },
        })];
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Rust vector batch"),
            color_attachments: &a,
            ..Default::default()
        });
        pass.set_pipeline(&library.pipeline);
        pass.set_bind_group(0, &self.group, &[]);
        pass.set_vertex_buffer(0, self.vertices.slice(..));
        pass.set_index_buffer(self.indices.slice(..), wgpu::IndexFormat::Uint32);
        for (id, range) in &self.ranges {
            if let Some(id) = id {
                let layer = &self.layers[id];
                pass.set_bind_group(0, &layer.composite_group, &[]);
                pass.draw_indexed(layer.quad.clone(), 0, 0..1);
            } else {
                pass.set_bind_group(0, &self.group, &[]);
                pass.draw_indexed(range.clone(), 0, 0..1);
            }
        }
        self.frames += 1;
    }
    pub fn texture_stats(&self) -> [u64; 2] {
        let bytes =
            self.gradient_texture.width() as u64 * self.gradient_texture.height() as u64 * 4
                + self.masks.texture.width() as u64 * self.masks.texture.height() as u64 * 4
                + self.msaa.width() as u64 * self.msaa.height() as u64 * 16
                + self
                    .layers
                    .values()
                    .map(|l| l.size[0] as u64 * l.size[1] as u64 * 28)
                    .sum::<u64>();
        [
            3 + self.layers.len() as u64 * 4 + u64::from(self.surface_rain.is_some()),
            bytes
                + self
                    .surface_rain
                    .as_ref()
                    .map_or(0, |t| t.width() as u64 * t.height() as u64 * 4),
        ]
    }
    pub fn counters(&self) -> [u32; 3] {
        [
            self.meshes_built,
            self.masks.uploads,
            self.layers.values().map(|l| l.blur_updates).sum(),
        ]
    }
    pub fn transfer_stats(&self) -> [u64; 2] {
        [
            self.uploaded_bytes,
            self.layers
                .values()
                .map(|layer| layer.allocations as u64)
                .sum(),
        ]
    }
    pub fn dispose(&self) {
        for layer in self.layers.values() {
            layer.dispose();
        }
        if let Some(rain) = &self.surface_rain {
            rain.destroy();
        }
        self.gradient_texture.destroy();
        self.masks.texture.destroy();
        self.parameters.destroy();
        self.msaa.destroy();
        self.vertices.destroy();
        self.indices.destroy();
    }
}

fn paint_mask(
    svg: &Element,
    node: &Element,
    pixmap: &mut tiny_skia::Pixmap,
    matrix: Matrix,
    gradients: &BTreeMap<String, Gradient>,
    _root: bool,
    depth: usize,
) -> Result<(), JsValue> {
    fn draw(
        svg: &Element,
        node: &Element,
        pixmap: &mut tiny_skia::Pixmap,
        matrix: Matrix,
        gradients: &BTreeMap<String, Gradient>,
        fill: &str,
        stroke: &str,
        stroke_width: f32,
        opacity: f32,
        clip: bool,
        depth: usize,
    ) -> Result<(), JsValue> {
        if depth > 40 {
            return Err(error("Recursive mask"));
        }
        let tag = node.tag_name();
        if ["defs", "filter", "style"].contains(&tag.as_str()) {
            return Ok(());
        }
        let inherited = |key: &str, current: &str| {
            inline(node, key)
                .or_else(|| {
                    let v = attr(node, key);
                    if v.is_empty() {
                        None
                    } else {
                        Some(v)
                    }
                })
                .unwrap_or_else(|| current.into())
        };
        let fill = inherited("fill", fill);
        let stroke = inherited("stroke", stroke);
        let stroke_width = inherited("stroke-width", &stroke_width.to_string())
            .parse::<f32>()
            .unwrap_or(stroke_width);
        let opacity = opacity * inherited("opacity", "1").parse::<f32>().unwrap_or(1.);
        if opacity <= 0.00001 {
            return Ok(());
        }
        let matrix = matrix.then(State::new(node.clone(), false)?.transform());
        if tag == "use" {
            let href = inherited("href", &attr(node, "xlink:href"));
            if let Some(id) = href.strip_prefix('#') {
                if let Some(target) = list(svg, "[id]").into_iter().find(|n| attr(n, "id") == id) {
                    draw(
                        svg,
                        &target,
                        pixmap,
                        matrix,
                        gradients,
                        &fill,
                        &stroke,
                        stroke_width,
                        opacity,
                        clip,
                        depth + 1,
                    )?;
                }
            }
            return Ok(());
        }
        let source = shape(node);
        if !source.is_empty() {
            let path = vector_geometry::path(&source).map_err(error)?;
            let mut builder = tiny_skia::PathBuilder::new();
            for event in path.iter() {
                use lyon_tessellation::path::Event::*;
                match event {
                    Begin { at } => builder.move_to(at.x, at.y),
                    Line { to, .. } => builder.line_to(to.x, to.y),
                    Quadratic { ctrl, to, .. } => builder.quad_to(ctrl.x, ctrl.y, to.x, to.y),
                    Cubic {
                        ctrl1, ctrl2, to, ..
                    } => builder.cubic_to(ctrl1.x, ctrl1.y, ctrl2.x, ctrl2.y, to.x, to.y),
                    End { close, .. } => {
                        if close {
                            builder.close();
                        }
                    }
                }
            }
            if let Some(path) = builder.finish() {
                let a = matrix.0;
                let transform = tiny_skia::Transform::from_row(a[0], a[1], a[2], a[3], a[4], a[5]);
                for (is_stroke, text) in [
                    (false, if clip { "white" } else { fill.as_str() }),
                    (true, stroke.as_str()),
                ] {
                    if text == "none" {
                        continue;
                    }
                    let mut paint = tiny_skia::Paint::default();
                    let mut c = color(text, [1.; 4]);
                    c[3] *= opacity
                        * inherited(
                            if is_stroke {
                                "stroke-opacity"
                            } else {
                                "fill-opacity"
                            },
                            "1",
                        )
                        .parse::<f32>()
                        .unwrap_or(1.);
                    paint.set_color(
                        tiny_skia::Color::from_rgba(c[0], c[1], c[2], c[3].clamp(0., 1.))
                            .unwrap_or(tiny_skia::Color::WHITE),
                    );
                    if let Some(g) = uri(text).and_then(|id| gradients.get(&id)) {
                        let stops = g
                            .stops
                            .iter()
                            .filter_map(|(p, c)| {
                                tiny_skia::Color::from_rgba(
                                    c[0],
                                    c[1],
                                    c[2],
                                    (c[3] * opacity).clamp(0., 1.),
                                )
                                .map(|c| tiny_skia::GradientStop::new(*p, c))
                            })
                            .collect::<Vec<_>>();
                        let b = path.bounds();
                        let bounds = [b.left(), b.top(), b.right(), b.bottom()];
                        let matrix = g.affine(bounds).inverse().0;
                        let transform = tiny_skia::Transform::from_row(
                            matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5],
                        );
                        let shader = if g.radial {
                            tiny_skia::RadialGradient::new(
                                tiny_skia::Point::from_xy(0., 0.),
                                0.,
                                tiny_skia::Point::from_xy(0., 0.),
                                1.,
                                stops,
                                tiny_skia::SpreadMode::Pad,
                                transform,
                            )
                        } else {
                            tiny_skia::LinearGradient::new(
                                tiny_skia::Point::from_xy(0., 0.),
                                tiny_skia::Point::from_xy(1., 0.),
                                stops,
                                tiny_skia::SpreadMode::Pad,
                                transform,
                            )
                        };
                        if let Some(shader) = shader {
                            paint.shader = shader;
                        }
                    }
                    if is_stroke {
                        pixmap.stroke_path(
                            &path,
                            &paint,
                            &tiny_skia::Stroke {
                                width: stroke_width,
                                line_cap: tiny_skia::LineCap::Round,
                                line_join: tiny_skia::LineJoin::Round,
                                ..Default::default()
                            },
                            transform,
                            None,
                        );
                    } else {
                        pixmap.fill_path(
                            &path,
                            &paint,
                            if inherited("fill-rule", "") == "evenodd" {
                                tiny_skia::FillRule::EvenOdd
                            } else {
                                tiny_skia::FillRule::Winding
                            },
                            transform,
                            None,
                        );
                    }
                }
            }
        }
        let children = node.children();
        for i in 0..children.length() {
            if let Some(child) = children.item(i) {
                draw(
                    svg,
                    &child,
                    pixmap,
                    matrix,
                    gradients,
                    &fill,
                    &stroke,
                    stroke_width,
                    opacity,
                    clip,
                    depth + 1,
                )?;
            }
        }
        Ok(())
    }
    draw(
        svg,
        node,
        pixmap,
        matrix,
        gradients,
        "white",
        "none",
        1.,
        1.,
        node.tag_name() == "clipPath",
        depth,
    )
}
