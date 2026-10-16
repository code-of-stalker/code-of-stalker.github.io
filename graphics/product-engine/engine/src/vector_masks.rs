//! Original masks use local coordinate systems. Static soft cutouts are cached;
//! animated rectangular reveals and their gradients are evaluated in the shader.
use super::*;
pub const CAPACITY: usize = 32;
pub struct MaskCache {
    pub texture: wgpu::Texture,
    pub entries: Vec<MaskEntry>,
    pub ids: BTreeMap<String, usize>,
    pub uploads: u32,
    changed: [bool; CAPACITY],
}
pub struct MaskEntry {
    root: Element,
    rect: Option<State>,
    pub bounds: [f32; 4],
    tile: crate::atlas::Rect,
    alpha: bool,
    hash: String,
    watchers: Vec<Element>,
    gradient_ids: Vec<String>,
    coordinates: Matrix,
}
impl MaskCache {
    pub fn new(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        svg: &Element,
        gradients: &BTreeMap<String, Gradient>,
        view: [f32; 4],
    ) -> Result<Self, JsValue> {
        let nodes = list(svg, "mask,clipPath");
        if nodes.len() + 1 > CAPACITY {
            return Err(error("Too many original vector masks"));
        }
        let mut entries = Vec::new();
        let mut sizes = vec![[1, 1]];
        let mut ids = BTreeMap::new();
        for (i, root) in nodes.into_iter().enumerate() {
            let children = root.children();
            let only = if children.length() == 1 {
                children.item(0)
            } else {
                None
            };
            let rect = only
                .filter(|n| n.tag_name() == "rect" && number(n, "rx", 0.) == 0.)
                .map(|n| State::new(n, false))
                .transpose()?;
            let alpha =
                root.tag_name() == "clipPath" || attr(&root, "style").contains("mask-type:alpha");
            let mut bounds = mask_bounds(svg, &root, view)?;
            let density = if root
                .query_selector("[data-distance-line-weight]")?
                .is_some()
            {
                // This is the approved filled silhouette with its thin black trim,
                // not a soft glow. Its parent scales it by ~2 before the viewport
                // scales it again. The old 512px tile magnified those trim pixels.
                let key = attr(&root, "id");
                let mut maximum_scale = 1_f32;
                let mut visible_bottom = f32::NEG_INFINITY;
                for reference in list(svg, "[mask]") {
                    if uri(&attr(&reference, "mask")).as_deref() != Some(key.as_str()) {
                        continue;
                    }
                    let mut transform = Matrix::default();
                    let mut ancestor = Some(reference);
                    while let Some(node) = ancestor {
                        transform = State::new(node.clone(), false)?.transform().then(transform);
                        if node == *svg {
                            break;
                        }
                        ancestor = node.parent_element();
                    }
                    maximum_scale = maximum_scale.max(transform.max_scale());
                    let inverse = transform.inverse();
                    for x in [view[0], view[0] + view[2]] {
                        for y in [view[1], view[1] + view[3]] {
                            visible_bottom = visible_bottom.max(inverse.point([x, y])[1]);
                        }
                    }
                }
                // The cover already clips the lower body to its SVG viewport.
                // Keep generous parallax/breathing room, not invisible full legs.
                if visible_bottom.is_finite() {
                    bounds[3] = (visible_bottom + 16. - bounds[1]).clamp(1., bounds[3]);
                }
                vector_geometry::contour_mask_density(view[2], 480., maximum_scale)
            } else {
                (512. / bounds[2].max(bounds[3]).max(1.)).min(2.5)
            };
            sizes.push(if rect.is_some() {
                [1, 1]
            } else {
                [
                    (bounds[2] * density).ceil().max(1.) as u32,
                    (bounds[3] * density).ceil().max(1.) as u32,
                ]
            });
            let content = root.inner_html();
            let watchers = list(&root, "[data-rust-dynamic]");
            let gradient_ids = gradients
                .keys()
                .filter(|key| content.contains(key.as_str()))
                .cloned()
                .collect();
            ids.insert(attr(&root, "id"), i + 1);
            entries.push(MaskEntry {
                root,
                rect,
                bounds,
                tile: Default::default(),
                alpha,
                hash: String::new(),
                watchers,
                gradient_ids,
                coordinates: Matrix::default(),
            });
        }
        let (tiles, size) =
            crate::atlas::pack(&sizes, device.limits().max_texture_dimension_2d).map_err(error)?;
        let texture = texture(device, size[0], size[1], 1);
        for (entry, tile) in entries.iter_mut().zip(tiles.into_iter().skip(1)) {
            entry.tile = tile;
            entry
                .root
                .set_attribute("data-rust-mask-buffer", &format!("{}x{}", tile.w, tile.h))?;
        }
        let mut cache = Self {
            texture,
            entries,
            ids,
            uploads: 0,
            changed: [false; CAPACITY],
        };
        cache.refresh(queue, svg, gradients)?;
        Ok(cache)
    }
    pub fn refresh(
        &mut self,
        queue: &wgpu::Queue,
        svg: &Element,
        gradients: &BTreeMap<String, Gradient>,
    ) -> Result<(), JsValue> {
        self.changed.fill(false);
        for (index, entry) in self.entries.iter_mut().enumerate() {
            if entry.rect.is_some() {
                continue;
            }
            // Only content/gradient changes invalidate soft cutouts. A moving parent or
            // changing main render density never rerasterizes these immutable masks.
            let mut hash = String::from("ready:");
            for node in &entry.watchers {
                for key in [
                    "d",
                    "x",
                    "y",
                    "width",
                    "height",
                    "transform",
                    "opacity",
                    "style",
                    "fill",
                    "stroke",
                    "stroke-width",
                ] {
                    hash.push_str(&attr(node, key));
                    hash.push('|');
                }
            }
            for id in &entry.gradient_ids {
                hash.push_str(&gradients[id].version.to_string());
            }
            if hash == entry.hash {
                continue;
            }
            entry.hash = hash;
            let tile = entry.tile;
            let b = entry.bounds;
            let mut pixmap =
                tiny_skia::Pixmap::new(tile.w, tile.h).ok_or_else(|| error("Mask allocation"))?;
            paint_mask(
                svg,
                &entry.root,
                &mut pixmap,
                Matrix([
                    tile.w as f32 / b[2],
                    0.,
                    0.,
                    tile.h as f32 / b[3],
                    -b[0] * tile.w as f32 / b[2],
                    -b[1] * tile.h as f32 / b[3],
                ]),
                gradients,
                true,
                0,
            )?;
            // Tiny-skia stores premultiplied RGBA. Alpha masks retain alpha, luminance
            // masks retain premultiplied RGB; the final shader selects the right channel.
            queue.write_texture(
                wgpu::TexelCopyTextureInfo {
                    texture: &self.texture,
                    mip_level: 0,
                    origin: wgpu::Origin3d {
                        x: tile.x,
                        y: tile.y,
                        z: 0,
                    },
                    aspect: wgpu::TextureAspect::All,
                },
                pixmap.data(),
                wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(tile.w * 4),
                    rows_per_image: Some(tile.h),
                },
                wgpu::Extent3d {
                    width: tile.w,
                    height: tile.h,
                    depth_or_array_layers: 1,
                },
            );
            self.uploads += 1;
            self.changed[index + 1] = true;
        }
        Ok(())
    }
    /// Include sampled texture contents in a blur layer's cache contract.
    /// Analytic masks sample gradient rows; rasterized masks sample atlas tiles.
    pub fn content_changed(&self, id: usize, gradients: &BTreeMap<String, Gradient>) -> bool {
        self.changed[id]
            || self.entries[id - 1]
                .gradient_ids
                .iter()
                .any(|key| gradients[key].changed)
    }
    pub fn parameters(
        &mut self,
        gradients: &BTreeMap<String, Gradient>,
        gradient_height: u32,
    ) -> [f32; CAPACITY * 16 + 4] {
        let mut out = [0.; CAPACITY * 16 + 4];
        out[..4].copy_from_slice(&[1., 1., 0., 0.]);
        for (index, entry) in self.entries.iter_mut().enumerate() {
            let at = 4 + (index + 1) * 16;
            let tile = entry.tile;
            let b = entry.bounds;
            entry.coordinates = Matrix([1. / b[2], 0., 0., 1. / b[3], -b[0] / b[2], -b[1] / b[3]]);
            out[at..at + 4].copy_from_slice(&[
                tile.x as f32 / self.texture.width() as f32,
                tile.y as f32 / self.texture.height() as f32,
                tile.w as f32 / self.texture.width() as f32,
                tile.h as f32 / self.texture.height() as f32,
            ]);
            out[at + 14] = if entry.alpha { 0. } else { 1. };
            out[at + 15] = 1.;
            if let Some(rect) = &mut entry.rect {
                rect.refresh();
                let n = &rect.node;
                let b = [
                    number(n, "x", 0.),
                    number(n, "y", 0.),
                    number(n, "width", 0.),
                    number(n, "height", 0.),
                ];
                entry.coordinates = Matrix([
                    1. / b[2].max(1e-5),
                    0.,
                    0.,
                    1. / b[3].max(1e-5),
                    -b[0] / b[2].max(1e-5),
                    -b[1] / b[3].max(1e-5),
                ])
                .then(rect.transform().inverse());
                let fill = property(n, &rect.base, "fill");
                let alpha = property(n, &rect.base, "opacity")
                    .parse::<f32>()
                    .unwrap_or(1.)
                    * property(n, &rect.base, "fill-opacity")
                        .parse::<f32>()
                        .unwrap_or(1.);
                if let Some(g) = uri(&fill).and_then(|key| gradients.get(&key)) {
                    let bounds = [b[0], b[1], b[0] + b[2], b[1] + b[3]];
                    let a = g.position([b[0], b[1]], bounds);
                    let x = g.position([b[0] + b[2], b[1]], bounds);
                    let y = g.position([b[0], b[1] + b[3]], bounds);
                    out[at + 4..at + 8].copy_from_slice(&[
                        x[0] - a[0],
                        x[1] - a[1],
                        y[0] - a[0],
                        y[1] - a[1],
                    ]);
                    out[at + 8..at + 12].copy_from_slice(&[
                        a[0],
                        a[1],
                        (g.row as f32 + 0.5) / gradient_height as f32,
                        if g.radial { 1. } else { 0. },
                    ]);
                    out[at + 14] = if entry.alpha { 3. } else { 4. };
                    out[at + 15] = alpha;
                } else {
                    let c = color(&fill, [1.; 4]);
                    out[at + 14] = 2.;
                    out[at + 15] = alpha
                        * c[3]
                        * if entry.alpha {
                            1.
                        } else {
                            c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722
                        };
                }
            }
        }
        out
    }
    pub fn coordinates(&self, id: usize, p: [f32; 2]) -> [f32; 4] {
        let point = self.entries[id - 1].coordinates.point(p);
        [point[0], point[1], id as f32, 0.]
    }
}
fn mask_bounds(svg: &Element, node: &Element, view: [f32; 4]) -> Result<[f32; 4], JsValue> {
    let width = number(node, "width", 0.);
    let height = number(node, "height", 0.);
    if width > 0. && height > 0. {
        return Ok([number(node, "x", 0.), number(node, "y", 0.), width, height]);
    }
    let mut bounds = [
        f32::INFINITY,
        f32::INFINITY,
        f32::NEG_INFINITY,
        f32::NEG_INFINITY,
    ];
    fn collect(
        svg: &Element,
        node: &Element,
        transform: Matrix,
        bounds: &mut [f32; 4],
        depth: usize,
    ) -> Result<(), JsValue> {
        if depth > 40 {
            return Err(error("Recursive mask bounds"));
        }
        let m = transform.then(State::new(node.clone(), false)?.transform());
        let source = shape(node);
        if !source.is_empty() {
            let mesh = vector_geometry::mesh(&source, None, false, false).map_err(error)?;
            for v in mesh.vertices {
                let p = m.point(v);
                bounds[0] = bounds[0].min(p[0]);
                bounds[1] = bounds[1].min(p[1]);
                bounds[2] = bounds[2].max(p[0]);
                bounds[3] = bounds[3].max(p[1]);
            }
        }
        if node.tag_name() == "use" {
            let href = attr(node, "href");
            if let Some(id) = href.strip_prefix('#') {
                if let Some(target) = list(svg, "[id]").into_iter().find(|n| attr(n, "id") == id) {
                    collect(svg, &target, m, bounds, depth + 1)?;
                }
            }
        }
        let children = node.children();
        for i in 0..children.length() {
            if let Some(child) = children.item(i) {
                collect(svg, &child, m, bounds, depth + 1)?;
            }
        }
        Ok(())
    }
    collect(svg, node, Matrix::default(), &mut bounds, 0)?;
    if bounds.iter().all(|v| v.is_finite()) && bounds[2] > bounds[0] && bounds[3] > bounds[1] {
        Ok([
            bounds[0],
            bounds[1],
            bounds[2] - bounds[0],
            bounds[3] - bounds[1],
        ])
    } else {
        Ok(view)
    }
}
