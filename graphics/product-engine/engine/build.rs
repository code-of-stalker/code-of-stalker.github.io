//! Asset preparation is Rust at build time. No SVG parser, font rasterizer or
//! tessellation runs in the animation loop; only original paths are used.
#[path = "src/breath_bridge_copy.rs"]
mod breath_bridge_copy;
#[path = "src/spoken_copy.rs"]
mod spoken_copy;
use lyon_tessellation::{
    path::{math::point, Path},
    *,
};
use std::{fs, path::PathBuf};
use tiny_skia::{Paint, PathBuilder as SkiaBuilder, Pixmap, Transform};

fn paths(d: &str) -> (Path, tiny_skia::Path) {
    let mut l = Path::builder();
    let mut s = SkiaBuilder::new();
    let mut open = false;
    for segment in svgtypes::PathParser::from(d) {
        match segment.unwrap() {
            svgtypes::PathSegment::MoveTo { abs: true, x, y } => {
                if open {
                    l.end(false);
                }
                l.begin(point(x as f32, y as f32));
                s.move_to(x as f32, y as f32);
                open = true;
            }
            svgtypes::PathSegment::LineTo { abs: true, x, y } => {
                l.line_to(point(x as f32, y as f32));
                s.line_to(x as f32, y as f32);
            }
            svgtypes::PathSegment::CurveTo {
                abs: true,
                x1,
                y1,
                x2,
                y2,
                x,
                y,
            } => {
                l.cubic_bezier_to(
                    point(x1 as f32, y1 as f32),
                    point(x2 as f32, y2 as f32),
                    point(x as f32, y as f32),
                );
                s.cubic_to(
                    x1 as f32, y1 as f32, x2 as f32, y2 as f32, x as f32, y as f32,
                );
            }
            svgtypes::PathSegment::Quadratic {
                abs: true,
                x1,
                y1,
                x,
                y,
            } => {
                l.quadratic_bezier_to(point(x1 as f32, y1 as f32), point(x as f32, y as f32));
                s.quad_to(x1 as f32, y1 as f32, x as f32, y as f32);
            }
            svgtypes::PathSegment::ClosePath { .. } => {
                l.end(true);
                s.close();
                open = false;
            }
            other => {
                panic!("Unsupported SVG path segment {other:?}; do not silently change the artwork")
            }
        }
    }
    if open {
        l.end(false);
    }
    (l.build(), s.finish().unwrap())
}
fn mesh(d: &str, stroke: Option<f32>) -> (Vec<[f32; 2]>, Vec<u32>) {
    let path = paths(d).0;
    let mut geometry: VertexBuffers<[f32; 2], u32> = VertexBuffers::new();
    if let Some(width) = stroke {
        StrokeTessellator::new()
            .tessellate_path(
                &path,
                &StrokeOptions::default()
                    .with_line_width(width)
                    .with_tolerance(0.025),
                &mut BuffersBuilder::new(&mut geometry, |v: StrokeVertex| v.position().to_array()),
            )
            .unwrap();
    } else {
        FillTessellator::new()
            .tessellate_path(
                &path,
                &FillOptions::default()
                    .with_fill_rule(FillRule::EvenOdd)
                    .with_tolerance(0.025),
                &mut BuffersBuilder::new(&mut geometry, |v: FillVertex| v.position().to_array()),
            )
            .unwrap();
    }
    (geometry.vertices, geometry.indices)
}
fn raster(path: &tiny_skia::Path, w: u32, h: u32, transform: Transform) -> Vec<f32> {
    let mut image = Pixmap::new(w, h).unwrap();
    let mut paint = Paint::default();
    paint.set_color_rgba8(255, 255, 255, 255);
    image.fill_path(path, &paint, tiny_skia::FillRule::EvenOdd, transform, None);
    image
        .data()
        .chunks_exact(4)
        .map(|p| p[3] as f32 / 255.)
        .collect()
}
fn blur(input: &[f32], width: usize, height: usize, sigma: f32) -> Vec<f32> {
    let radius = (sigma * 3.).ceil() as i32;
    let mut weights: Vec<f32> = (-radius..=radius)
        .map(|i| (-0.5 * (i as f32 / sigma).powi(2)).exp())
        .collect();
    let sum: f32 = weights.iter().sum();
    for v in &mut weights {
        *v /= sum;
    }
    let mut temp = vec![0.; input.len()];
    let mut out = temp.clone();
    for y in 0..height {
        for x in 0..width {
            for (i, weight) in weights.iter().enumerate() {
                let xx = x as i32 + i as i32 - radius;
                if xx >= 0 && xx < width as i32 {
                    temp[y * width + x] += input[y * width + xx as usize] * weight;
                }
            }
        }
    }
    for y in 0..height {
        for x in 0..width {
            for (i, weight) in weights.iter().enumerate() {
                let yy = y as i32 + i as i32 - radius;
                if yy >= 0 && yy < height as i32 {
                    out[y * width + x] += temp[yy as usize * width + x] * weight;
                }
            }
        }
    }
    out
}
struct GlyphBuilder(SkiaBuilder);
impl ttf_parser::OutlineBuilder for GlyphBuilder {
    fn move_to(&mut self, x: f32, y: f32) {
        self.0.move_to(x, y);
    }
    fn line_to(&mut self, x: f32, y: f32) {
        self.0.line_to(x, y);
    }
    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.0.quad_to(x1, y1, x, y);
    }
    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.0.cubic_to(x1, y1, x2, y2, x, y);
    }
    fn close(&mut self) {
        self.0.close();
    }
}
fn prepare_observer(dest: &PathBuf) {
    let source = "assets/attention.svg";
    println!("cargo:rerun-if-changed={source}");
    println!("cargo:rerun-if-changed=../public/fonts/Disket-Mono-Regular.ttf");
    println!("cargo:rerun-if-changed=../public/fonts/NotoSansJP.ttf");
    let svg = fs::read_to_string(source).unwrap();
    let doc = roxmltree::Document::parse(&svg).unwrap();
    let observer = doc
        .descendants()
        .find(|n| n.attribute("data-person") == Some("observer"))
        .unwrap();
    let other = doc
        .descendants()
        .find(|n| n.attribute("data-person") == Some("other"))
        .unwrap();
    let body = |n: roxmltree::Node| {
        n.children()
            .find(|n| n.attribute("class") == Some("maw-person"))
            .unwrap()
            .attribute("d")
            .unwrap()
            .to_owned()
    };
    let eye = |n: roxmltree::Node| {
        n.children()
            .find(|n| n.attribute("class") == Some("maw-eye"))
            .unwrap()
            .attribute("d")
            .unwrap()
            .to_owned()
    };
    let mask = doc
        .descendants()
        .find(|n| n.attribute("id") == Some("maw-id-observer-occlusion"))
        .unwrap()
        .children()
        .find(|n| n.has_tag_name("path"))
        .unwrap()
        .attribute("d")
        .unwrap();
    let bodies = [
        body(observer),
        eye(observer),
        body(other),
        eye(other),
        mask.to_owned(),
        mask.to_owned(),
    ];
    let mut vertices = Vec::<f32>::new();
    let mut indices = Vec::<u32>::new();
    let mut ranges = Vec::new();
    for (id, d) in bodies.iter().enumerate() {
        let (v, i) = mesh(d, if id == 5 { Some(0.5) } else { None });
        let base = (vertices.len() / 3) as u32;
        let start = indices.len();
        for xy in v {
            vertices.extend([xy[0], xy[1], id as f32]);
        }
        indices.extend(i.into_iter().map(|i| i + base));
        ranges.push([start as u32, indices.len() as u32]);
    }
    fs::write(
        dest.join("observer.vertices"),
        vertices
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect::<Vec<_>>(),
    )
    .unwrap();
    fs::write(
        dest.join("observer.indices"),
        indices
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect::<Vec<_>>(),
    )
    .unwrap();
    fs::write(dest.join("geometry.rs"),format!("pub const RANGES:[[u32;2];6]={ranges:?};\npub const VERTEX_COUNT:usize={};\npub const INDEX_COUNT:usize={};",vertices.len()/3,indices.len())).unwrap();
    // Cache only the soft lighting of the original geometry. Main silhouettes
    // remain triangles. 4 texels per original SVG unit also cover the close-up.
    let (w, h) = (488, 976);
    let transform = Transform::from_row(4., 0., 0., 4., -112., 0.);
    let alpha = raster(&paths(&bodies[0]).1, w, h, transform);
    let halo = blur(&alpha, w as usize, h as usize, 14.);
    let core = blur(&alpha, w as usize, h as usize, 3.2);
    let solid = observer
        .descendants()
        .find(|n| n.attribute("opacity") == Some(".08"))
        .unwrap()
        .attribute("d")
        .unwrap();
    let silhouette = raster(&paths(solid).1, w, h, transform);
    let glow: Vec<u8> = halo
        .iter()
        .zip(core)
        .zip(silhouette)
        .map(|((h, c), s)| {
            ((1. - (1. - h * 0.9) * (1. - s * 0.08) * (1. - c * 0.7)) * 255.).round() as u8
        })
        .collect();
    fs::write(dest.join("observer.glow"), glow).unwrap();
}
// Vector speech uses the same font as the application, with no system fallback.
// These control points are prepared once and morphed by the Rust scene clock.
fn prepare_spoken_glyphs(dest: &std::path::Path, face: &ttf_parser::Face<'_>) {
    struct Outline {
        commands: Vec<(u8, [f64; 6])>,
        units: f64,
    }
    impl Outline {
        fn add(&mut self, kind: u8, points: &[f32]) {
            let mut p = [0.; 6];
            for (to, from) in p.iter_mut().zip(points) {
                *to = *from as f64 / self.units;
            }
            self.commands.push((kind, p));
        }
    }
    impl ttf_parser::OutlineBuilder for Outline {
        fn move_to(&mut self, x: f32, y: f32) {
            self.add(1, &[x, y]);
        }
        fn line_to(&mut self, x: f32, y: f32) {
            self.add(2, &[x, y]);
        }
        fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
            self.add(3, &[x1, y1, x, y]);
        }
        fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
            self.add(4, &[x1, y1, x2, y2, x, y]);
        }
        fn close(&mut self) {
            self.add(0, &[]);
        }
    }
    let mut output = String::from("pub fn glyph(c: char) -> &'static [(u8,[f64;6])] { match c {\n");
    println!("cargo:rerun-if-changed=src/spoken_copy.rs");
    println!("cargo:rerun-if-changed=src/breath_bridge_copy.rs");
    let characters: std::collections::BTreeSet<char> = spoken_copy::PHRASES
        .iter()
        .chain(breath_bridge_copy::PHRASES.iter())
        .chain(["БОЛЬ", "ВИНА", "МЫСЛЬ", "Я СЛЫШУ", "Я ВИЖУ", "Я ОСОЗНАЮ"].iter())
        .flat_map(|s| s.chars())
        .filter(|c| !c.is_whitespace())
        .collect();
    for ch in characters {
        let mut outline = Outline {
            commands: Vec::new(),
            units: face.units_per_em() as f64,
        };
        let glyph = face
            .glyph_index(ch)
            .expect("Bundled font must contain spoken Cyrillic");
        face.outline_glyph(glyph, &mut outline)
            .expect("Speech glyph has an outline");
        output.push_str(&format!("{ch:?} => &{:?},\n", outline.commands));
    }
    output.push_str("_ => &[], } }\n");
    fs::write(dest.join("spoken_glyphs.rs"), output).unwrap();
}

fn main() {
    let dest = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    println!("cargo:rerun-if-changed=assets/fonts");
    prepare_observer(&dest);
    // Same bundled fonts in Canvas reference and Rust. No OS-specific fallback.
    let disk = fs::read("assets/fonts/Disket-Mono-Regular.ttf").unwrap();
    let jp = fs::read("assets/fonts/NotoSansJP.ttf").unwrap();
    let disk = ttf_parser::Face::parse(&disk, 0).unwrap();
    prepare_spoken_glyphs(&dest, &disk);
    let mut jp = ttf_parser::Face::parse(&jp, 0).unwrap();
    jp.set_variation(ttf_parser::Tag::from_bytes(b"wght"), 400.);
    let chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789";
    let (cell, cols, rows) = (48usize, 16usize, 3usize);
    let width = cell * cols;
    let mut atlas = vec![0u8; width * cell * rows * 4];
    for (id, ch) in chars.chars().enumerate() {
        let face = if disk.glyph_index(ch).is_some() {
            &disk
        } else {
            &jp
        };
        let glyph = face.glyph_index(ch).expect("Missing rain character");
        let mut builder = GlyphBuilder(SkiaBuilder::new());
        face.outline_glyph(glyph, &mut builder).unwrap();
        let path = builder.0.finish().unwrap();
        let scale = 20. / face.units_per_em() as f32;
        let advance = face.glyph_hor_advance(glyph).unwrap() as f32 * scale;
        let baseline = 24. + (face.ascender() + face.descender()) as f32 * scale * 0.5;
        let core = raster(
            &path,
            48,
            48,
            Transform::from_row(scale, 0., 0., -scale, 24. - advance * 0.5, baseline),
        );
        // Canvas shadowBlur=12 device px corresponds to sigma=6.
        let shadow = blur(&core, 48, 48, 6.);
        for y in 0..cell {
            for x in 0..cell {
                let index = ((id / cols * cell + y) * width + id % cols * cell + x) * 4;
                let k = y * cell + x;
                atlas[index] = (core[k] * 255.).round() as u8;
                atlas[index + 1] = (shadow[k] * 255.).round() as u8;
                atlas[index + 3] = 255;
            }
        }
    }
    fs::write(dest.join("rain.atlas"), atlas).unwrap();
}
