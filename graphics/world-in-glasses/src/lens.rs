//! The lens outlines come from Art's hand-drawn mask (`assets/lens-mask.svg`),
//! placed on the artwork at scale 1. Both lenses share one panorama, cover-fitted
//! to their common bounds as in Art's Figma layout, with his 2.85 px blur
//! spilling softly over the frame.
use crate::glass::{Glass, CELLS};

const MASK_SVG: &str = include_str!("../assets/lens-mask.svg");
/// Where the SVG's origin sits on the 1536 × 1024 artwork. Found by aligning
/// the outlines with the frame edges; both lenses agree on the same offset.
pub const PLACEMENT: [f32; 2] = [665.25, 109.25];
/// The panorama's rectangle in authored space: full width over the union of
/// both lenses, height by aspect, centred vertically. Checked against the SVG.
pub const WORLD_RECT: [f32; 4] = [665.750, 96.418, 225.059, 112.529];
/// Gaussian σ of Art's blurred copy, authored pixels.
pub const GLOW_SIGMA: f32 = 2.85;
/// The textures cover this authored rectangle around both lenses.
pub const REGION: [f32; 4] = [650.0, 88.0, 256.0, 124.0];
pub const TEXELS_PER_PIXEL: usize = 4;
pub const TEXTURE_SIZE: [usize; 2] = [
    REGION[2] as usize * TEXELS_PER_PIXEL,
    REGION[3] as usize * TEXELS_PER_PIXEL,
];

fn numbers_and_commands(d: &str) -> Vec<Result<char, f32>> {
    let mut out = Vec::new();
    let mut number = String::new();
    let flush = |number: &mut String, out: &mut Vec<Result<char, f32>>| {
        if !number.is_empty() {
            if let Ok(v) = number.parse::<f32>() {
                out.push(Err(v));
            }
            number.clear();
        }
    };
    for c in d.chars() {
        match c {
            'M' | 'C' | 'Z' | 'z' => {
                flush(&mut number, &mut out);
                out.push(Ok(c.to_ascii_uppercase()));
            }
            '-' if !number.ends_with(['e', 'E']) => {
                flush(&mut number, &mut out);
                number.push(c);
            }
            '0'..='9' | '.' | 'e' | 'E' | '-' | '+' => number.push(c),
            _ => flush(&mut number, &mut out),
        }
    }
    flush(&mut number, &mut out);
    out
}

/// Absolute `M`/`C`/`Z` paths, as exported by Figma, sampled into polylines.
pub fn sample_path(d: &str, per_curve: usize) -> Vec<[f32; 2]> {
    let tokens = numbers_and_commands(d);
    let values: Vec<f32> = tokens.iter().filter_map(|t| t.err()).collect();
    let mut points = Vec::new();
    if values.len() < 2 {
        return points;
    }
    let mut current = [values[0], values[1]];
    points.push(current);
    for c in values[2..].chunks_exact(6) {
        let (p1, p2, p3) = ([c[0], c[1]], [c[2], c[3]], [c[4], c[5]]);
        for step in 1..=per_curve {
            let s = step as f32 / per_curve as f32;
            let u = 1.0 - s;
            let b = [u * u * u, 3.0 * u * u * s, 3.0 * u * s * s, s * s * s];
            points.push([
                b[0] * current[0] + b[1] * p1[0] + b[2] * p2[0] + b[3] * p3[0],
                b[0] * current[1] + b[1] * p1[1] + b[2] * p2[1] + b[3] * p3[1],
            ]);
        }
        current = p3;
    }
    if points.len() > 1 && points.first() == points.last() {
        points.pop();
    }
    points
}

/// The two filled shapes of the mask, left lens first, in authored space.
pub fn outlines(per_curve: usize) -> [Vec<[f32; 2]>; 2] {
    let mut shapes: Vec<Vec<[f32; 2]>> = MASK_SVG
        .split("<path")
        .filter(|chunk| chunk.contains("fill=\"#"))
        .filter_map(|chunk| {
            let start = chunk.find(" d=\"")? + 4;
            let end = start + chunk[start..].find('"')?;
            Some(
                sample_path(&chunk[start..end], per_curve)
                    .into_iter()
                    .map(|p| [p[0] + PLACEMENT[0], p[1] + PLACEMENT[1]])
                    .collect(),
            )
        })
        .collect();
    let mean_x = |s: &Vec<[f32; 2]>| s.iter().map(|p| p[0]).sum::<f32>() / s.len().max(1) as f32;
    shapes.sort_by(|a, b| mean_x(a).total_cmp(&mean_x(b)));
    let right = shapes.pop().unwrap_or_default();
    let left = shapes.pop().unwrap_or_default();
    [left, right]
}

#[derive(Clone, Debug)]
pub struct Lenses {
    pub outlines: [Vec<[f32; 2]>; 2],
    pub centers: [[f32; 2]; 2],
}
impl Lenses {
    pub fn new() -> Self {
        let outlines = outlines(24);
        let centers = std::array::from_fn(|i| {
            let o = &outlines[i];
            let n = o.len().max(1) as f32;
            [
                o.iter().map(|p| p[0]).sum::<f32>() / n,
                o.iter().map(|p| p[1]).sum::<f32>() / n,
            ]
        });
        Self { outlines, centers }
    }
    fn texel_outline(&self, lens: usize) -> Vec<[f32; 2]> {
        to_texels(&self.outlines[lens])
    }

    /// RG8: R = sharp antialiased coverage, G = Art's blurred copy of it.
    pub fn mask_texture(&self) -> Vec<u8> {
        let [w, h] = TEXTURE_SIZE;
        let mut sharp = vec![0.0f32; w * h];
        let shapes = [self.texel_outline(0), self.texel_outline(1)];
        let mut xs = Vec::new();
        for row in 0..h {
            let line = &mut sharp[row * w..(row + 1) * w];
            for sub in 0..4 {
                let y = row as f32 + (sub as f32 + 0.5) / 4.0;
                for shape in &shapes {
                    crossings(shape, y, &mut xs);
                    for span in xs.chunks_exact(2) {
                        add_span(line, span[0], span[1], 0.25);
                    }
                }
            }
        }
        let mut soft: Vec<f32> = sharp.iter().map(|v| v.min(1.0)).collect();
        // Three box passes approximate the Gaussian (σ² = 3 · (width² − 1) / 12).
        let sigma = GLOW_SIGMA * TEXELS_PER_PIXEL as f32;
        let radius = (((12.0 * sigma * sigma / 3.0 + 1.0).sqrt() - 1.0) / 2.0).round() as usize;
        for _ in 0..3 {
            box_blur(&mut soft, w, h, radius, 1, w);
        }
        for _ in 0..3 {
            box_blur(&mut soft, h, w, radius, w, 1);
        }
        sharp
            .iter()
            .zip(&soft)
            .flat_map(|(s, g)| [unorm(*s), unorm(*g)])
            .collect()
    }

    /// R8: 0 outside the shards, otherwise 1 + lens · 32 + shard. A shard only
    /// claims texels inside its own lens.
    pub fn cell_texture(&self, glass: &[Glass; 2]) -> Vec<u8> {
        let [w, h] = TEXTURE_SIZE;
        let mut ids = vec![0u8; w * h];
        let mut member = vec![false; w * h];
        for (lens, shards) in glass.iter().enumerate() {
            member.fill(false);
            fill_centers(&self.texel_outline(lens), w, h, |i| member[i] = true);
            for (c, cell) in shards.cells.iter().enumerate() {
                let id = (1 + lens * CELLS + c) as u8;
                fill_centers(&to_texels(&cell.outline), w, h, |i| {
                    if member[i] {
                        ids[i] = id;
                    }
                });
            }
        }
        ids
    }
}
impl Default for Lenses {
    fn default() -> Self {
        Self::new()
    }
}

fn unorm(v: f32) -> u8 {
    (v.clamp(0.0, 1.0) * 255.0).round() as u8
}

fn to_texels(points: &[[f32; 2]]) -> Vec<[f32; 2]> {
    let s = TEXELS_PER_PIXEL as f32;
    points
        .iter()
        .map(|p| [(p[0] - REGION[0]) * s, (p[1] - REGION[1]) * s])
        .collect()
}

/// Inside spans of the polygon at height `y`, as start/end pairs. Uses the
/// non-zero winding rule, like the canvas clip in the prototype, so bent
/// cracks that fold a shard over itself still fill it.
fn crossings(shape: &[[f32; 2]], y: f32, out: &mut Vec<f32>) {
    let mut edges: Vec<(f32, i32)> = Vec::new();
    for (i, a) in shape.iter().enumerate() {
        let b = shape[(i + 1) % shape.len()];
        if (a[1] <= y) != (b[1] <= y) {
            let x = a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]);
            edges.push((x, if b[1] > a[1] { 1 } else { -1 }));
        }
    }
    edges.sort_by(|p, q| p.0.total_cmp(&q.0));
    out.clear();
    let mut winding = 0;
    for (x, direction) in edges {
        let before = winding;
        winding += direction;
        if (before == 0) != (winding == 0) {
            out.push(x);
        }
    }
}

fn add_span(line: &mut [f32], x0: f32, x1: f32, weight: f32) {
    let w = line.len() as f32;
    let (x0, x1) = (x0.clamp(0.0, w), x1.clamp(0.0, w));
    if x1 <= x0 {
        return;
    }
    let (i0, i1) = (x0.floor() as usize, x1.floor() as usize);
    if i0 == i1 {
        line[i0.min(line.len() - 1)] += (x1 - x0) * weight;
        return;
    }
    line[i0] += (i0 as f32 + 1.0 - x0) * weight;
    for v in &mut line[i0 + 1..i1] {
        *v += weight;
    }
    if i1 < line.len() {
        line[i1] += (x1 - i1 as f32) * weight;
    }
}

fn fill_centers(shape: &[[f32; 2]], w: usize, h: usize, mut set: impl FnMut(usize)) {
    let mut xs = Vec::new();
    for row in 0..h {
        crossings(shape, row as f32 + 0.5, &mut xs);
        for span in xs.chunks_exact(2) {
            let start = (span[0] - 0.5).ceil().max(0.0) as usize;
            let end = ((span[1] - 0.5).ceil().max(0.0) as usize).min(w);
            for x in start..end {
                set(row * w + x);
            }
        }
    }
}

/// Running-sum box blur along `count` lines of `length` samples.
fn box_blur(
    data: &mut [f32],
    length: usize,
    count: usize,
    radius: usize,
    step: usize,
    stride: usize,
) {
    let mut line = vec![0.0f32; length];
    let width = (2 * radius + 1) as f32;
    for n in 0..count {
        let base = n * stride;
        for (i, v) in line.iter_mut().enumerate() {
            *v = data[base + i * step];
        }
        let sample = |i: isize| -> f32 {
            if i < 0 || i as usize >= length {
                0.0
            } else {
                line[i as usize]
            }
        };
        let mut sum: f32 = (-(radius as isize)..=radius as isize).map(sample).sum();
        for i in 0..length {
            data[base + i * step] = sum / width;
            sum += sample(i as isize + radius as isize + 1) - sample(i as isize - radius as isize);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mask_has_two_lenses_inside_the_frame() {
        let lenses = Lenses::new();
        for (i, o) in lenses.outlines.iter().enumerate() {
            assert!(o.len() > 100);
            let c = lenses.centers[i];
            assert!(c[1] > 140.0 && c[1] < 160.0);
        }
        assert!(lenses.centers[0][0] < 730.0 && lenses.centers[1][0] > 830.0);
    }

    #[test]
    fn world_rect_cover_fits_the_union_of_both_lenses() {
        let shapes = outlines(200);
        let all = shapes.iter().flatten();
        let (mut x0, mut y0, mut x1, mut y1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
        for p in all {
            x0 = x0.min(p[0]);
            y0 = y0.min(p[1]);
            x1 = x1.max(p[0]);
            y1 = y1.max(p[1]);
        }
        let (w, cy) = (x1 - x0, (y0 + y1) / 2.0);
        let expected = [x0, cy - w / 4.0, w, w / 2.0];
        for (a, b) in WORLD_RECT.iter().zip(expected) {
            assert!((a - b).abs() < 0.02, "{a} vs {b}");
        }
        // The panorama covers both lenses entirely.
        assert!(WORLD_RECT[1] <= y0 && WORLD_RECT[1] + WORLD_RECT[3] >= y1);
    }

    #[test]
    fn mask_texture_is_sharp_inside_and_soft_around() {
        let lenses = Lenses::new();
        let tex = lenses.mask_texture();
        let [w, _] = TEXTURE_SIZE;
        let at = |p: [f32; 2]| {
            let x = ((p[0] - REGION[0]) * 4.0) as usize;
            let y = ((p[1] - REGION[1]) * 4.0) as usize;
            (tex[(y * w + x) * 2], tex[(y * w + x) * 2 + 1])
        };
        assert_eq!(at(lenses.centers[0]).0, 255);
        assert_eq!(at(lenses.centers[1]).0, 255);
        // Between the lenses (nose bridge) there is no lens, only a little glow.
        let bridge = at([785.0, 120.0]);
        assert_eq!(bridge.0, 0);
        // Far outside: nothing at all.
        assert_eq!(at([652.0, 90.0]), (0, 0));
    }

    #[test]
    fn every_lens_texel_belongs_to_one_shard_of_its_own_lens() {
        let lenses = Lenses::new();
        let glass = crate::glass::lenses();
        let ids = lenses.cell_texture(&glass);
        let [w, _] = TEXTURE_SIZE;
        for (lens, c) in lenses.centers.iter().enumerate() {
            let x = ((c[0] - REGION[0]) * 4.0) as usize;
            let y = ((c[1] - REGION[1]) * 4.0) as usize;
            let id = ids[y * w + x] as usize;
            assert!(id > lens * CELLS && id <= (lens + 1) * CELLS);
        }
        let covered = ids.iter().filter(|&&v| v > 0).count();
        let inside = lenses
            .mask_texture()
            .chunks(2)
            .filter(|m| m[0] == 255)
            .count();
        assert!(covered as f32 > inside as f32 * 0.97);
    }
}
