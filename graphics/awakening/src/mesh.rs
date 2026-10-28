//! Projected, antialiased primitives shared with the established Step 4 films.
use crate::{lerp3, smooth, Camera, Projected};
pub const STRIDE: usize = 11;
pub type Color = [f32; 4];

pub fn scale(c: Color, k: f32) -> Color {
    [c[0] * k, c[1] * k, c[2] * k, c[3] * k]
}

/// A point of a stroke: position, half width (px), circle of confusion (px).
#[derive(Clone, Copy, Debug)]
pub struct Dot {
    pub at: [f32; 2],
    pub half: f32,
    pub coc: f32,
    pub color: Color,
}

pub struct Mesh {
    pub data: Vec<f32>,
    /// Authored px per device pixel: strokes never get thinner than a pixel.
    pub pixel: f32,
}
impl Default for Mesh {
    fn default() -> Self {
        Self::new(0)
    }
}
impl Mesh {
    pub fn new(capacity: usize) -> Self {
        Self {
            data: Vec::with_capacity(capacity * STRIDE),
            pixel: 1.0,
        }
    }
    pub fn clear(&mut self) {
        self.data.clear();
    }
    pub fn vertices(&self) -> i32 {
        (self.data.len() / STRIDE) as i32
    }
    fn vertex(&mut self, p: [f32; 2], local: [f32; 2], c: Color, shape: [f32; 3]) {
        self.data.extend_from_slice(&[
            p[0], p[1], local[0], local[1], c[0], c[1], c[2], c[3], shape[0], shape[1], shape[2],
        ]);
    }
    /// Two triangles over the corners a b c d (in order).
    pub fn quad(
        &mut self,
        p: [[f32; 2]; 4],
        local: [[f32; 2]; 4],
        c: [Color; 4],
        shape: [[f32; 3]; 4],
    ) {
        for i in [0, 1, 2, 0, 2, 3] {
            self.vertex(p[i], local[i], c[i], shape[i]);
        }
    }
    /// A flat area with a color per corner (fills, gradients, the screen).
    pub fn gradient(&mut self, p: [[f32; 2]; 4], c: [Color; 4]) {
        self.quad(p, [[0.0; 2]; 4], c, [SOLID; 4]);
    }
    /// A radial gradient: a fan from a center to a closed rim.
    pub fn fan(&mut self, center: [f32; 2], rim: &[[f32; 2]], inner: Color, outer: Color) {
        for i in 0..rim.len() {
            let (a, b) = (rim[i], rim[(i + 1) % rim.len()]);
            for (q, c) in [(center, inner), (a, outer), (b, outer)] {
                self.vertex(q, [0.0; 2], c, SOLID);
            }
        }
    }
    /// The lens applied to a stroke of half width `half`: (core, soft, gain).
    fn lens(&self, half: f32, coc: f32) -> (f32, f32, f32) {
        let floor = 0.55 * self.pixel;
        let (half, thin) = if half < floor {
            (floor, half / floor)
        } else {
            (half, 1.0)
        };
        let core = half.max(coc);
        let soft = 0.8 * half.min(coc) + 0.7 * self.pixel;
        (core, soft, thin * half / core)
    }
    /// A speck of light seen through the lens: a sharp point in focus, a
    /// larger disc with a faint bright rim (bokeh) out of focus.
    pub fn disc(&mut self, at: [f32; 2], radius: f32, coc: f32, c: Color) {
        let (core, soft, gain) = self.lens(radius, coc);
        let rim = 0.35 * smooth(2.0, 10.0, coc);
        let r = core + soft + self.pixel;
        let shape = [core, soft, rim];
        self.quad(
            [
                [at[0] - r, at[1] - r],
                [at[0] + r, at[1] - r],
                [at[0] + r, at[1] + r],
                [at[0] - r, at[1] + r],
            ],
            [[-r, -r], [r, -r], [r, r], [-r, r]],
            [scale(c, gain * gain); 4],
            [shape; 4],
        );
    }
    /// A soft glow (no lens: already diffuse).
    pub fn glow(&mut self, at: [f32; 2], radius: f32, c: Color) {
        let r = radius.max(self.pixel);
        let shape = [0.0, r, 0.0];
        self.quad(
            [
                [at[0] - r, at[1] - r],
                [at[0] + r, at[1] - r],
                [at[0] + r, at[1] + r],
                [at[0] - r, at[1] + r],
            ],
            [[-r, -r], [r, -r], [r, r], [-r, r]],
            [c; 4],
            [shape; 4],
        );
    }
    /// A stroke through the dots, each with its own width, blur and color.
    pub fn strip(&mut self, dots: &[Dot]) {
        if dots.len() < 2 {
            return;
        }
        let normal = |i: usize| {
            let a = dots[i.saturating_sub(1)].at;
            let b = dots[(i + 1).min(dots.len() - 1)].at;
            let (dx, dy) = (b[0] - a[0], b[1] - a[1]);
            let l = (dx * dx + dy * dy).sqrt().max(1e-4);
            [-dy / l, dx / l]
        };
        let lensed: Vec<(f32, f32, f32)> = dots.iter().map(|d| self.lens(d.half, d.coc)).collect();
        for i in 0..dots.len() - 1 {
            let mut corners = [[0.0; 2]; 4];
            let mut locals = [[0.0; 2]; 4];
            let mut colors = [[0.0; 4]; 4];
            let mut shapes = [[0.0; 3]; 4];
            for (k, j) in [i, i + 1].into_iter().enumerate() {
                let n = normal(j);
                let (core, soft, gain) = lensed[j];
                let e = core + soft + self.pixel;
                let p = dots[j].at;
                // Corner order: a0 b0 b1 a1.
                let (top, bottom) = if k == 0 { (0, 3) } else { (1, 2) };
                corners[top] = [p[0] + n[0] * e, p[1] + n[1] * e];
                corners[bottom] = [p[0] - n[0] * e, p[1] - n[1] * e];
                locals[top] = [0.0, e];
                locals[bottom] = [0.0, -e];
                colors[top] = scale(dots[j].color, gain);
                colors[bottom] = colors[top];
                shapes[top] = [core, soft, 0.0];
                shapes[bottom] = shapes[top];
            }
            self.quad(corners, locals, colors, shapes);
        }
    }
}
/// Shape of a flat fill: coverage 1 everywhere.
const SOLID: [f32; 3] = [1.0e6, 1.0, 0.0];

/// Haze of distance: far lines sink into the air of the room.
pub fn fog(depth: f32) -> f32 {
    (-(depth - 2.5).max(0.0) / 7.5).exp()
}

/// A stroke in the world: points with a width in metres (never under
/// `min_px`), color fading with the haze. Breaks where a point is behind
/// the lens.
pub fn polyline(
    m: &mut Mesh,
    cam: &Camera,
    points: &[[f32; 3]],
    half_m: f32,
    min_px: f32,
    color: &dyn Fn(usize, &Projected) -> Color,
) {
    let mut run: Vec<Dot> = Vec::with_capacity(points.len());
    for (i, p) in points.iter().enumerate() {
        match cam.project(*p) {
            Some(q) => run.push(Dot {
                at: q.at,
                half: (half_m * q.scale).max(min_px),
                coc: cam.coc(q.depth),
                color: scale(color(i, &q), fog(q.depth)),
            }),
            None => {
                m.strip(&run);
                run.clear();
            }
        }
    }
    m.strip(&run);
}
/// A straight segment cut into steps (the blur and the haze change along it).
pub fn segment(
    m: &mut Mesh,
    cam: &Camera,
    a: [f32; 3],
    b: [f32; 3],
    steps: usize,
    half_m: f32,
    c: Color,
) {
    let points: Vec<[f32; 3]> = (0..=steps)
        .map(|i| lerp3(a, b, i as f32 / steps as f32))
        .collect();
    polyline(m, cam, &points, half_m, 0.0, &|_, _| c);
}
