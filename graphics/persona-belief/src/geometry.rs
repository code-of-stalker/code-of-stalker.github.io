//! Mesh generators. Every vertex carries the authored position (px), a local
//! coordinate for the soft profile (or the labels' texture), four channels
//! and a lens shape: red is the ink and light of the room and of the
//! construction, green the light of the person and of the words, blue the
//! opaque body and alpha how much it hides what is behind.
//!
//! The lens is applied here, primitive by primitive: a line or a speck at a
//! depth the camera does not focus on spreads into its circle of confusion
//! and dims by the same factor, so its light is conserved. The figure and
//! the shell get the same radius in their own shaders. The card is not in
//! the room: it stays sharp whatever the lens does.
use crate::generated::{ATLAS, LABEL_BAND, LABEL_INK, LINKS};
use crate::{
    bell, card_rows, chest, curve, hash, lerp3, mouth, on_ring, option_lines, site, smooth, Camera,
    Frame, Kind, Projected, BEYOND, FIGURE, FLOOR_SVG, HEART, LOOP_SECONDS, ORIGIN_SVG, PLATES,
    RING, UNIT,
};
use std::f32::consts::TAU;

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
    /// A convex polygon of one color.
    pub fn polygon(&mut self, p: &[[f32; 2]], c: Color) {
        for i in 1..p.len().saturating_sub(1) {
            for q in [p[0], p[i], p[i + 1]] {
                self.vertex(q, [0.0; 2], c, SOLID);
            }
        }
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
    /// A sharp screen-space line (the card), with a soft halo.
    pub fn hud_line(&mut self, p: &[[f32; 2]], half: f32, fade: &[f32], c: Color, halo: f32) {
        let dots = |w: f32, k: f32| -> Vec<Dot> {
            p.iter()
                .zip(fade)
                .map(|(at, f)| Dot {
                    at: *at,
                    half: w,
                    coc: 0.0,
                    color: scale(c, k * f),
                })
                .collect()
        };
        if halo > 0.0 {
            let soft = dots(half * 6.0, 0.1 * halo);
            self.strip(&soft);
        }
        let core = dots(half, 1.0);
        self.strip(&core);
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
    let widths = vec![half_m; points.len()];
    profile(m, cam, points, &widths, min_px, color);
}
/// A stroke whose width (metres) changes along it.
pub fn profile(
    m: &mut Mesh,
    cam: &Camera,
    points: &[[f32; 3]],
    half_m: &[f32],
    min_px: f32,
    color: &dyn Fn(usize, &Projected) -> Color,
) {
    let mut run: Vec<Dot> = Vec::with_capacity(points.len());
    for (i, p) in points.iter().enumerate() {
        match cam.project(*p) {
            Some(q) => run.push(Dot {
                at: q.at,
                half: (half_m[i] * q.scale).max(min_px),
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
/// A circle lying on a horizontal plane.
fn circle(o: [f32; 3], r: f32, from: f32, to: f32, steps: usize) -> Vec<[f32; 3]> {
    (0..=steps)
        .map(|i| {
            let a = from + (to - from) * i as f32 / steps as f32;
            [o[0] + r * a.cos(), o[1], o[2] + r * a.sin()]
        })
        .collect()
}
/// A circle standing in the plane facing the camera.
fn upright(o: [f32; 3], r: f32, steps: usize) -> Vec<[f32; 3]> {
    (0..=steps)
        .map(|i| {
            let a = i as f32 / steps as f32 * TAU;
            [o[0] + r * a.cos(), o[1] + r * a.sin(), o[2]]
        })
        .collect()
}
fn projected_circle(cam: &Camera, o: [f32; 3], r: f32, steps: usize) -> Option<Vec<[f32; 2]>> {
    circle(o, r, 0.0, TAU, steps)
        .into_iter()
        .take(steps)
        .map(|p| cam.project(p).map(|q| q.at))
        .collect()
}

/// Fixed particle field: dust in the air of the room.
pub struct Scene {
    pub motes: Vec<Mote>,
}
pub struct Mote {
    pub at: [f32; 3],
    pub glow: f32,
    pub phase: [f32; 3],
}
impl Default for Scene {
    fn default() -> Self {
        Self::new()
    }
}
impl Scene {
    pub fn new() -> Self {
        let mut motes = Vec::with_capacity(380);
        for i in 0..340u32 {
            let r = |k: u32| hash(i * 13 + k);
            motes.push(Mote {
                at: [
                    -3.4 + 6.8 * r(1),
                    0.04 + 3.2 * r(2).powf(1.15),
                    -0.9 + 9.0 * r(3).powf(0.9),
                ],
                glow: 0.1 + 0.3 * r(4).powi(3),
                phase: [TAU * r(5), TAU * r(6), TAU * r(7)],
            });
        }
        // Specks between the lens and the person: large, soft, slow.
        for i in 0..28u32 {
            let r = |k: u32| hash(7000 + i * 17 + k);
            motes.push(Mote {
                at: [-1.6 + 3.4 * r(1), 0.1 + 1.8 * r(2), -3.6 + 3.1 * r(3)],
                glow: 0.25 + 0.3 * r(4),
                phase: [TAU * r(5), TAU * r(6), TAU * r(7)],
            });
        }
        Self { motes }
    }
}

const fn room(v: f32) -> Color {
    [v, 0.0, 0.0, 0.0]
}
const fn person(v: f32) -> Color {
    [0.0, v, 0.0, 0.0]
}

/// Where the top light stands and how wide it falls on the floor.
pub const TOP_LIGHT: [f32; 3] = [0.04, 4.4, 0.05];
pub const POOL: [f32; 3] = [0.06, 0.0, 0.02];
pub const POOL_RADIUS: f32 = 1.25;
/// Inside the cone of the top light (0..1, soft).
pub fn in_cone(p: [f32; 3]) -> f32 {
    let h = (p[1] / TOP_LIGHT[1]).clamp(0.0, 1.0);
    let axis = lerp3(POOL, TOP_LIGHT, h);
    let r = POOL_RADIUS + (0.22 - POOL_RADIUS) * h;
    let d = ((p[0] - axis[0]).powi(2) + (p[2] - axis[2]).powi(2)).sqrt();
    1.0 - smooth(0.55 * r, r, d)
}

/// The floor: tiles into the depth, a finer weave near the person, the pool
/// of the top light. Everything behind the person.
pub fn floor(m: &mut Mesh, f: &Frame) {
    let cam = &f.camera;
    let l = f.light;
    if let Some(rim) = projected_circle(cam, POOL, POOL_RADIUS, 48) {
        if let Some(c) = cam.project(POOL) {
            m.fan(c.at, &rim, [0.1 * l, 0.03 * l, 0.0, 0.0], room(0.0));
        }
    }
    let near = cam.eye[2] + Camera::NEAR + 0.05;
    for i in -12..=12 {
        let x = i as f32 * 0.5;
        let a = [x, 0.0, near.max(-4.5)];
        segment(m, cam, a, [x, 0.0, 9.5], 32, 0.0028, room(0.16 * l));
    }
    for i in 0..=28 {
        let z = -4.5 + i as f32 * 0.5;
        if z < near {
            continue;
        }
        segment(
            m,
            cam,
            [-6.0, 0.0, z],
            [6.0, 0.0, z],
            6,
            0.0028,
            room(0.16 * l),
        );
    }
    // A finer weave around the feet.
    let centre = [0.25, 0.0, 0.0];
    for i in -12..=12 {
        let o = i as f32 * 0.125;
        let x = centre[0] + o;
        let z = centre[2] + o;
        let reach = 1.5;
        let fade = |p: [f32; 3]| {
            let d = ((p[0] - centre[0]).powi(2) + (p[2] - centre[2]).powi(2)).sqrt();
            1.0 - smooth(0.4, reach, d)
        };
        let along_x: Vec<[f32; 3]> = (0..=16)
            .map(|k| {
                [
                    x,
                    0.0,
                    (centre[2] - reach + 2.0 * reach * k as f32 / 16.0).max(near),
                ]
            })
            .collect();
        polyline(m, cam, &along_x, 0.0016, 0.0, &|k, _| {
            room(0.11 * l * fade(along_x[k]))
        });
        let along_z: Vec<[f32; 3]> = (0..=16)
            .map(|k| [centre[0] - reach + 2.0 * reach * k as f32 / 16.0, 0.0, z])
            .collect();
        if z > near {
            polyline(m, cam, &along_z, 0.0016, 0.0, &|k, _| {
                room(0.11 * l * fade(along_z[k]))
            });
        }
    }
}

/// Columns standing in rows into the depth, and panels on the far wall.
pub fn architecture(m: &mut Mesh, f: &Frame) {
    let cam = &f.camera;
    let l = f.light;
    for side in [-2.35_f32, 2.95] {
        for k in 0..5 {
            let z = 1.1 + k as f32 * 2.0;
            let half = 0.11;
            let near_edge = if side < 0.0 { side + half } else { side - half };
            let far_edge = if side < 0.0 { side - half } else { side + half };
            let (Some(a), Some(b), Some(c), Some(d)) = (
                cam.project([far_edge, 0.0, z - half]),
                cam.project([near_edge, 0.0, z - half]),
                cam.project([near_edge, 3.6, z - half]),
                cam.project([far_edge, 3.6, z - half]),
            ) else {
                continue;
            };
            // A dark solid face that hides the floor behind it (blue holds
            // the cover in its lower half).
            let k_fog = fog(a.depth);
            let shade = [0.0, 0.0, 0.5 * k_fog, k_fog];
            let foot = [
                0.05 * l * k_fog * in_cone([near_edge, 0.0, z]).max(0.3),
                0.0,
                0.5 * k_fog,
                k_fog,
            ];
            m.gradient([d.at, c.at, b.at, a.at], [shade, shade, foot, foot]);
            if let (Some(e), Some(g)) = (
                cam.project([near_edge, 0.0, z + half]),
                cam.project([near_edge, 3.6, z + half]),
            ) {
                let lit = 0.06 * l * k_fog;
                let top = [lit * 0.5, 0.0, 0.5 * k_fog, k_fog];
                let low = [lit * 1.4, 0.0, 0.5 * k_fog, k_fog];
                m.gradient([c.at, g.at, e.at, b.at], [top, top, low, low]);
            }
            let lit = 0.55 * in_cone([near_edge, 1.0, z]).max(0.25);
            segment(
                m,
                cam,
                [near_edge, 0.0, z - half],
                [near_edge, 3.6, z - half],
                8,
                0.0035,
                room(0.32 * l * lit),
            );
            segment(
                m,
                cam,
                [far_edge, 0.0, z - half],
                [far_edge, 3.6, z - half],
                8,
                0.0025,
                room(0.12 * l),
            );
            segment(
                m,
                cam,
                [near_edge, 0.0, z + half],
                [near_edge, 3.6, z + half],
                8,
                0.0025,
                room(0.1 * l),
            );
            for y in [0.12, 3.35] {
                segment(
                    m,
                    cam,
                    [far_edge, y, z - half],
                    [near_edge, y, z - half],
                    2,
                    0.002,
                    room(0.12 * l),
                );
            }
        }
    }
    for i in -7..=7 {
        let x = i as f32 * 0.75;
        segment(
            m,
            cam,
            [x, 0.0, 10.0],
            [x, 4.2, 10.0],
            4,
            0.004,
            room(0.12 * l),
        );
    }
    segment(
        m,
        cam,
        [-6.0, 0.02, 10.0],
        [6.0, 0.02, 10.0],
        4,
        0.004,
        room(0.18 * l),
    );
}

/// Dust in the air, lit inside the cone of the top light: the far side
/// (behind the person) or the near side.
pub fn dust(m: &mut Mesh, s: &Scene, f: &Frame, near: bool) {
    let cam = &f.camera;
    let w = f.time / LOOP_SECONDS * TAU;
    for mote in &s.motes {
        let d = 0.05;
        let p = [
            mote.at[0] + d * (w * 2.0 + mote.phase[0]).sin() + 0.03 * (w + mote.phase[2]).sin(),
            mote.at[1] + d * (w * 3.0 + mote.phase[1]).sin()
                - 0.02 * (w * 4.0 + mote.phase[0]).cos(),
            mote.at[2] + d * (w * 2.0 + mote.phase[2]).cos(),
        ];
        if (p[2] < 0.0) != near {
            continue;
        }
        let Some(q) = cam.project(p) else {
            continue;
        };
        if q.at[0] < -120.0 || q.at[0] > 1660.0 || q.at[1] < -120.0 || q.at[1] > 1150.0 {
            continue;
        }
        let lit = 0.25 + 1.6 * in_cone(p) + if p[2] < 0.0 { 0.6 } else { 0.0 };
        let twinkle = 0.75 + 0.25 * (w * 5.0 + mote.phase[1]).sin();
        let k = mote.glow * lit * twinkle * f.light * fog(q.depth);
        m.disc(
            q.at,
            (0.0032 * q.scale).max(0.6),
            cam.coc(q.depth),
            [0.55 * k, 0.12 * k, 0.0, 0.0],
        );
    }
}

/// The figure's quad in the world (the figure program draws it): the person
/// at the origin, another person deep in the room (`at`: world x, z;
/// `left`: facing left), or the person's reflection in the polished floor.
pub fn figure_quad(m: &mut Mesh, cam: &Camera, at: [f32; 2], left: bool, mirrored: bool) -> bool {
    let corner = |x: f32, y: f32| {
        let p = [at[0] + x, if mirrored { -y } else { y }, at[1]];
        cam.project(p).map(|q| q.at)
    };
    let [l, b, r, t] = FIGURE;
    let (Some(lt), Some(rt), Some(rb), Some(lb)) =
        (corner(l, t), corner(r, t), corner(r, b), corner(l, b))
    else {
        return false;
    };
    let (u0, u1) = if left { (1.0, 0.0) } else { (0.0, 1.0) };
    m.quad(
        [lt, rt, rb, lb],
        [[u0, 0.0], [u1, 0.0], [u1, 1.0], [u0, 1.0]],
        [[0.0; 4]; 4],
        [[0.0; 3]; 4],
    );
    true
}

fn closed(points: &[[f32; 3]]) -> Vec<[f32; 3]> {
    let mut v = points.to_vec();
    v.push(points[0]);
    v
}
/// The same path with `n` points on every side, so the lens and the
/// drawing-on can change along it.
fn dense(points: &[[f32; 3]], n: usize) -> Vec<[f32; 3]> {
    let mut out = Vec::with_capacity(points.len() * n);
    for w in points.windows(2) {
        for k in 0..n {
            out.push(lerp3(w[0], w[1], k as f32 / n as f32));
        }
    }
    if let Some(last) = points.last() {
        out.push(*last);
    }
    out
}
/// The first part of a polyline, `k` of its length.
fn partial(points: &[[f32; 3]], k: f32) -> Vec<[f32; 3]> {
    let lengths: Vec<f32> = points
        .windows(2)
        .map(|w| {
            ((w[1][0] - w[0][0]).powi(2)
                + (w[1][1] - w[0][1]).powi(2)
                + (w[1][2] - w[0][2]).powi(2))
            .sqrt()
        })
        .collect();
    let mut left = k.clamp(0.0, 1.0) * lengths.iter().sum::<f32>();
    let mut out = vec![points[0]];
    for (i, l) in lengths.iter().enumerate() {
        if left >= *l {
            out.push(points[i + 1]);
            left -= l;
        } else {
            out.push(lerp3(points[i], points[i + 1], left / l.max(1e-6)));
            break;
        }
    }
    out
}
/// Plate `i`'s node of the circuit (world): on its plate, just before the
/// shell.
pub fn node(f: &Frame, i: usize) -> [f32; 3] {
    let [x, y] = site(i, f.time);
    [(x - ORIGIN_SVG) * UNIT, (FLOOR_SVG - y) * UNIT, -0.03]
}
/// Whether the wire between plates `a` and `b` is part of the groove.
fn in_groove(a: usize, b: usize) -> bool {
    let n = RING.len();
    (0..n).any(|i| {
        let (p, q) = (RING[i], RING[(i + 1) % n]);
        (p, q) == (a, b) || (p, q) == (b, a)
    })
}
/// A stretch of the ring (plates since the eye, `from` → `to`), as points.
fn ring_path(f: &Frame, from: f32, to: f32) -> Vec<[f32; 3]> {
    let steps = (((to - from) * 6.0).ceil() as usize).max(1);
    (0..=steps)
        .map(|k| {
            let a = from + (to - from) * k as f32 / steps as f32;
            on_ring(a, &|i| node(f, i))
        })
        .collect()
}

/// The circuit of page 02/08 over the shell: its wires, the groove a
/// little brighter, a node on every plate (lit while the impulse passes),
/// and the impulse with its short trail.
pub fn circuit(m: &mut Mesh, f: &Frame) {
    let a = f.circuit * f.light;
    if a < 0.005 {
        return;
    }
    let cam = &f.camera;
    for [p, q] in LINKS {
        let path = dense(&[node(f, p), node(f, q)], 6);
        let groove = if in_groove(p, q) { f.groove } else { 0.0 };
        let k = (0.32 + 0.4 * groove) * a;
        let half = 0.0011 + 0.0007 * groove;
        polyline(m, cam, &path, half, 0.0, &|_, _| room(k));
    }
    for i in 0..PLATES {
        let at = node(f, i);
        let lit = f.lit[i];
        let ring = upright(at, 0.0075, 14);
        polyline(m, cam, &ring, 0.0009, 0.0, &|_, _| {
            room((0.42 + 0.5 * lit) * a)
        });
        if let Some(q) = cam.project(at) {
            let coc = cam.coc(q.depth);
            m.disc(q.at, 0.0035 * q.scale, coc, room((0.28 + 0.7 * lit) * a));
            if lit > 0.01 {
                m.glow(q.at, 0.03 * q.scale + coc, room(0.12 * lit * a));
            }
        }
    }
    let p = f.impulse;
    if p.alpha < 0.005 {
        return;
    }
    let k = p.alpha * f.circuit;
    let path = ring_path(f, p.along - 3.0, p.along);
    let last = path.len().max(2) - 1;
    polyline(m, cam, &path, 0.0022, 0.0, &|i, _| {
        let u = (i as f32 / last as f32).powi(2);
        [0.9 * k * u, 0.2 * k * u, 0.0, 0.0]
    });
    let at = on_ring(p.along, &|i| node(f, i));
    if let Some(q) = cam.project(at) {
        let coc = cam.coc(q.depth);
        m.disc(q.at, 0.011 * q.scale, coc, [1.0 * k, 0.45 * k, 0.0, 0.0]);
        m.glow(q.at, 0.09 * q.scale + coc, [0.3 * k, 0.08 * k, 0.0, 0.0]);
    }
}

/// What a tablet says: lines without letters (x0, x1, y in the tablet's
/// writing area, 0..1 from the top left). Seven writings: the six beliefs
/// of the card in turn and the person's own. They differ in count, length
/// and order of the lines, never in the tablet's shape.
pub fn writing(k: usize) -> Vec<[f32; 3]> {
    let lines: &[[f32; 3]] = match k {
        0 => &[[0.0, 0.86, 0.18], [0.0, 0.6, 0.5], [0.0, 0.74, 0.82]],
        1 => &[
            [0.22, 1.0, 0.12],
            [0.06, 1.0, 0.37],
            [0.4, 1.0, 0.62],
            [0.2, 1.0, 0.87],
        ],
        2 => &[[0.0, 1.0, 0.3], [0.16, 0.84, 0.7]],
        3 => &[
            [0.0, 0.42, 0.15],
            [0.52, 1.0, 0.15],
            [0.0, 1.0, 0.5],
            [0.0, 0.36, 0.85],
        ],
        4 => &[
            [0.0, 1.0, 0.0],
            [0.0, 0.72, 0.25],
            [0.0, 0.9, 0.5],
            [0.0, 0.6, 0.75],
            [0.0, 0.82, 1.0],
        ],
        5 => {
            // The same short word over and over, line after line.
            return (0..3)
                .flat_map(|row| {
                    (0..6).map(move |j| {
                        let x = j as f32 * 0.16 + if row == 1 { 0.06 } else { 0.0 };
                        [x, x + 0.1, 0.15 + 0.35 * row as f32]
                    })
                })
                .collect();
        }
        _ => &[[0.1, 0.9, 0.22], [0.0, 1.0, 0.5], [0.2, 0.8, 0.78]],
    };
    lines.to_vec()
}

/// A tablet's corners and lines in the world: centre `at`, `w` × `h`
/// metres, turned by `swing` about the middle of its top edge. Returns its
/// outline (cut at the top right) and the points of its writing area.
struct Board {
    outline: Vec<[f32; 3]>,
    area: [[f32; 3]; 2],
    pin: [f32; 3],
    swing: f32,
}
impl Board {
    fn new(at: [f32; 3], w: f32, h: f32, swing: f32) -> Self {
        let pin = [at[0], at[1] + 0.5 * h, at[2]];
        let cut = 0.2 * h;
        let raw = [
            [at[0] - 0.5 * w, at[1] - 0.5 * h],
            [at[0] + 0.5 * w, at[1] - 0.5 * h],
            [at[0] + 0.5 * w, at[1] + 0.5 * h - cut],
            [at[0] + 0.5 * w - cut, at[1] + 0.5 * h],
            [at[0] - 0.5 * w, at[1] + 0.5 * h],
        ];
        let mut b = Self {
            outline: Vec::new(),
            area: [
                [at[0] - 0.36 * w, at[1] + 0.28 * h, at[2]],
                [at[0] + 0.36 * w, at[1] - 0.3 * h, at[2]],
            ],
            pin,
            swing,
        };
        b.outline = raw.iter().map(|p| b.turn([p[0], p[1], at[2]])).collect();
        b
    }
    /// A point of the board turned about its pin.
    fn turn(&self, p: [f32; 3]) -> [f32; 3] {
        let (s, c) = self.swing.sin_cos();
        let (dx, dy) = (p[0] - self.pin[0], p[1] - self.pin[1]);
        [
            self.pin[0] + c * dx - s * dy,
            self.pin[1] + s * dx + c * dy,
            p[2],
        ]
    }
    /// A point of the writing area (u across, v down, 0..1).
    fn on(&self, u: f32, v: f32) -> [f32; 3] {
        let [a, b] = self.area;
        self.turn([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * v, a[2]])
    }
    /// The board drawn: a warm halo, an opaque fill that hides what is
    /// behind it, its outline and its writing (the first of `writings`
    /// fading out while the second is written in, `change` 0..1).
    #[allow(clippy::too_many_arguments)]
    fn draw(
        &self,
        m: &mut Mesh,
        cam: &Camera,
        alpha: f32,
        glow: f32,
        ink: f32,
        writings: [usize; 2],
        change: f32,
        line: f32,
    ) {
        if alpha < 0.005 {
            return;
        }
        let centre = lerp3(self.outline[0], self.outline[2], 0.5);
        if let Some(q) = cam.project(centre) {
            let coc = cam.coc(q.depth);
            if glow > 0.005 {
                m.glow(q.at, 0.16 * q.scale + coc, room(0.16 * glow));
            }
        }
        let screen: Option<Vec<[f32; 2]>> = self
            .outline
            .iter()
            .map(|p| cam.project(*p).map(|q| q.at))
            .collect();
        if let Some(s) = screen {
            let c = 0.92 * alpha;
            m.polygon(&s, [0.14 * glow, 0.0, 0.5 * c, c]);
        }
        polyline(m, cam, &closed(&self.outline), line, 0.0, &|_, _| {
            room((0.42 * alpha + 0.5 * glow) * ink)
        });
        let fading = 1.0 - smooth(0.0, 0.35, change);
        let written = smooth(0.3, 1.0, change);
        let mut lines = |which: usize, length: f32, k: f32| {
            for [x0, x1, y] in writing(which) {
                let points = dense(&[self.on(x0, y), self.on(x0 + (x1 - x0) * length, y)], 3);
                polyline(m, cam, &points, 1.6 * line, 0.0, &|_, _| {
                    room((0.26 * alpha + 0.6 * glow) * ink * k)
                });
            }
        };
        if writings[0] != writings[1] && fading > 0.005 {
            lines(writings[0], 1.0, fading);
        }
        // The new writing is written in from the start of every line.
        if written > 0.005 {
            lines(writings[1], written, 1.0);
        }
    }
}

/// Where the person's tablet hangs (its centre, world).
pub fn tablet_at(f: &Frame) -> [f32; 3] {
    let n = node(f, HEART);
    [n[0] - 0.012, n[1] - 0.005, f.tablet.z]
}
const TABLET: [f32; 2] = [0.14, 0.095];
const SMALL: [f32; 2] = [0.11, 0.075];
fn board(f: &Frame) -> Board {
    Board::new(tablet_at(f), TABLET[0], TABLET[1], f.tablet.swing)
}

/// The tablet of belief on the chest: warmly lit, written over at every
/// pass of the impulse in the second paragraph, dark when the living light
/// rises, lifted on its thread at «знаю?».
pub fn tablet(m: &mut Mesh, f: &Frame) {
    let s = &f.tablet;
    let a = s.shown * f.light;
    if a < 0.005 {
        return;
    }
    // The impulse lights it as it lights every node, unless it is dark.
    let lit = f.lit[HEART] * s.glow;
    board(f).draw(
        &mut *m,
        &f.camera,
        s.shown,
        (0.6 * s.glow + 0.9 * lit) * a,
        f.light * (1.0 + 0.8 * lit),
        s.writing,
        s.change,
        0.0011,
    );
}

/// One stretch of the chain (world points): from a tablet's pin along a
/// hanging thread to the next mouth, then down to that one's own tablet
/// (the last runs into the dark). `thread` says how many of the points are
/// the thread itself.
fn hop(f: &Frame, k: usize) -> (Vec<[f32; 3]>, usize) {
    let from = if k == 0 {
        board(f).pin
    } else {
        other_board(k - 1).pin
    };
    let to = if k < 3 { mouth(k) } else { BEYOND };
    let d =
        ((to[0] - from[0]).powi(2) + (to[1] - from[1]).powi(2) + (to[2] - from[2]).powi(2)).sqrt();
    let mid = lerp3(from, to, 0.5);
    let sag = [mid[0], mid[1] - 0.08 * d, mid[2]];
    let n = 40;
    let mut points: Vec<[f32; 3]> = (0..=n)
        .map(|i| curve(from, sag, to, i as f32 / n as f32))
        .collect();
    let thread = points.len();
    if k < 3 {
        points.extend(dense(&[to, other_board(k).pin], 8).into_iter().skip(1));
    }
    (points, thread)
}
fn other_board(k: usize) -> Board {
    Board::new(chest(k), SMALL[0], SMALL[1], 0.0)
}

/// The runs of a path on one side of the person's plane: behind it (z > 0,
/// where the body hides it) or before it.
fn runs(points: &[[f32; 3]], behind: bool) -> Vec<Vec<[f32; 3]>> {
    let mut out = Vec::new();
    let mut run = Vec::new();
    for p in points {
        if (p[2] > 0.0) == behind {
            run.push(*p);
        } else if !run.is_empty() {
            out.push(std::mem::take(&mut run));
        }
    }
    out.push(run);
    out.retain(|r| r.len() > 1);
    out
}

/// Those who said it: each deep in the room with a tablet of their own, the
/// threads between them, and the light that follows the chain back into
/// the dark. Drawn in two parts: what lies behind the person (`behind`)
/// and what lies before.
pub fn chain(m: &mut Mesh, f: &Frame, behind: bool) {
    let cam = &f.camera;
    let l = f.light;
    if behind {
        for k in 0..3 {
            let a = f.chain[k] * l;
            if a < 0.005 {
                continue;
            }
            // Their tablet flares as the light reaches it.
            let at = k as f32 + 1.0;
            let flare = bell(f.traced, at - 0.15, at, at + 0.2, at + 1.0);
            let b = other_board(k);
            let depth = b.pin[2] - cam.eye[2];
            b.draw(
                &mut *m,
                cam,
                f.chain[k],
                0.5 * flare * a,
                a * fog(depth) * (1.0 + 0.8 * flare),
                [k, k],
                1.0,
                0.0011,
            );
        }
    }
    for k in 0..4 {
        let grown = f.threads[k];
        if grown < 0.005 {
            continue;
        }
        let (points, thread) = hop(f, k);
        for run in runs(&partial(&points[..thread], grown), behind) {
            polyline(m, cam, &run, 0.0008, 0.0, &|_, _| room(0.34 * l * f.trail));
        }
    }
    let a = f.trail * l;
    if f.traced < 0.005 || a < 0.005 {
        return;
    }
    for k in 0..4 {
        let u = (f.traced - k as f32).clamp(0.0, 1.0);
        if u < 0.005 {
            continue;
        }
        let (points, _) = hop(f, k);
        let drawn = partial(&points, u);
        for run in runs(&drawn, behind) {
            polyline(m, cam, &run, 0.005, 0.0, &|_, _| person(0.07 * a));
            polyline(m, cam, &run, 0.0014, 0.0, &|_, _| person(0.7 * a));
        }
        // The bright point at the head of the light.
        let Some(head) = drawn.last().copied() else {
            continue;
        };
        if u < 1.0 && f.bead > 0.005 && (head[2] > 0.0) == behind {
            if let Some(q) = cam.project(head) {
                let coc = cam.coc(q.depth);
                let k = f.bead * l;
                m.disc(q.at, 0.012 * q.scale, coc, [0.5 * k, 0.8 * k, 0.0, 0.0]);
                m.glow(q.at, 0.1 * q.scale + coc, [0.12 * k, 0.2 * k, 0.0, 0.0]);
            }
        }
    }
}

/// The card on screen: where it stands (top left, authored px).
pub const CARD_AT: [f32; 2] = [880.0, 640.0];
/// Widest text a card may hold (authored px), and its padding.
pub const CARD_WIDTH: f32 = 440.0;
pub const CARD_PAD: [f32; 2] = [24.0, 20.0];
/// One row of text on the card: atlas row, kind, top-left of the
/// capitals (px), cap height (px).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Line {
    pub row: usize,
    pub kind: Kind,
    pub at: [f32; 2],
    pub cap: f32,
}
fn ink_width(row: usize) -> f32 {
    LABEL_INK[row][1] - LABEL_INK[row][0]
}
/// The text of a card laid out, and the panel around it (x0, y0, x1, y1).
/// The parts lit in turn stand as many to a line as `option_lines` says.
pub fn card_layout(card: usize) -> (Vec<Line>, [f32; 4]) {
    let rows = card_rows(card);
    let per_line = option_lines(card);
    let widest_key = rows
        .iter()
        .filter(|(_, k)| *k == Kind::Key)
        .map(|(r, _)| ink_width(*r))
        .fold(0.0, f32::max);
    let key = (CARD_WIDTH * 44.0 / widest_key.max(1.0)).min(30.0);
    let options: Vec<usize> = rows
        .iter()
        .filter(|(_, k)| matches!(k, Kind::Option(_)))
        .map(|(r, _)| *r)
        .collect();
    let gap = 1.1;
    let mut option_cap: f32 = 19.0;
    let mut from = 0;
    for count in per_line {
        let line = &options[from.min(options.len())..(from + count).min(options.len())];
        from += count;
        if line.is_empty() {
            break;
        }
        let width: f32 =
            line.iter().map(|r| ink_width(*r) / 44.0).sum::<f32>() + gap * (line.len() - 1) as f32;
        option_cap = option_cap.min(CARD_WIDTH / width);
    }
    let lead = 16.0;
    let mut lines = Vec::with_capacity(rows.len());
    let x = CARD_AT[0] + CARD_PAD[0];
    let mut y = CARD_AT[1] + CARD_PAD[1];
    let mut right: f32 = x;
    let mut option_x = x;
    let mut in_line = 0;
    let mut line_index = 0;
    let mut options_started = false;
    for (row, kind) in rows {
        match kind {
            Kind::Lead | Kind::Key => {
                let cap = if *kind == Kind::Key { key } else { lead };
                // A quiet half after a bright half gets a breath of space.
                if *kind != Kind::Key && lines.last().is_some_and(|l: &Line| l.kind == Kind::Key) {
                    y += 0.6 * lead;
                }
                lines.push(Line {
                    row: *row,
                    kind: *kind,
                    at: [x, y],
                    cap,
                });
                right = right.max(x + ink_width(*row) / 44.0 * cap);
                y += cap + if *kind == Kind::Key { 0.6 } else { 0.7 } * lead;
            }
            Kind::Option(_) => {
                if !options_started {
                    y += 0.8 * option_cap;
                    options_started = true;
                } else if in_line == per_line[line_index.min(per_line.len() - 1)] {
                    y += 1.7 * option_cap;
                    option_x = x;
                    in_line = 0;
                    line_index += 1;
                }
                lines.push(Line {
                    row: *row,
                    kind: *kind,
                    at: [option_x, y],
                    cap: option_cap,
                });
                option_x += (ink_width(*row) / 44.0 + gap) * option_cap;
                right = right.max(option_x - gap * option_cap);
                in_line += 1;
            }
        }
    }
    if options_started {
        y += option_cap + 0.45 * lead;
    }
    let panel = [
        CARD_AT[0],
        CARD_AT[1],
        right + CARD_PAD[0],
        y - 0.45 * lead + CARD_PAD[1] + 4.0,
    ];
    (lines, panel)
}
/// The panel of the card: a nearly opaque fill, an outline drawn around as
/// it opens, a small tick, and under a part a mark while it is lit.
pub fn card(m: &mut Mesh, f: &Frame) {
    let a = f.shown;
    if a < 0.005 {
        return;
    }
    let (lines, [x0, y0, x1, y1]) = card_layout(f.card);
    let cut = 14.0;
    let outline = [
        [x0, y0],
        [x1 - cut, y0],
        [x1, y0 + cut],
        [x1, y1],
        [x0 + cut, y1],
        [x0, y1 - cut],
    ];
    let k = 0.88 * a;
    m.polygon(&outline, [0.0, 0.02 * a, 0.5 * k, k]);
    let mut ring = outline.to_vec();
    ring.push(outline[0]);
    // Densify, so the outline can be drawn around little by little.
    let mut path = Vec::with_capacity(ring.len() * 12);
    for pair in ring.windows(2) {
        for k in 0..12 {
            let t = k as f32 / 12.0;
            path.push([
                pair[0][0] + (pair[1][0] - pair[0][0]) * t,
                pair[0][1] + (pair[1][1] - pair[0][1]) * t,
            ]);
        }
    }
    path.push(ring[ring.len() - 1]);
    let reveal = smooth(0.0, 0.75, a);
    let fade: Vec<f32> = (0..path.len())
        .map(|i| smooth(0.0, 0.08, reveal - i as f32 / path.len() as f32 * 0.9))
        .collect();
    let half = 0.45 * m.pixel.max(1.0);
    m.hud_line(&path, half, &fade, person(0.6 * a), 0.6);
    let tick = [[x0 + cut * 1.2, y1 - 7.0], [x0 + cut * 3.2, y1 - 7.0]];
    m.hud_line(&tick, half * 1.6, &[1.0, 1.0], person(0.9 * a), 1.0);
    for line in &lines {
        if let Kind::Option(i) = line.kind {
            let k = f.options[i] * a;
            if k < 0.005 {
                continue;
            }
            let w = ink_width(line.row) / 44.0 * line.cap;
            let y = line.at[1] + line.cap * 1.45;
            let mark = [[line.at[0], y], [line.at[0] + w * smooth(0.0, 0.6, k), y]];
            m.hud_line(&mark, half * 1.4, &[1.0, 1.0], person(0.85 * k), 1.0);
        }
    }
}
/// The card's words: textured quads for the text program, wiped in from
/// the left. `local` holds the atlas coordinates.
pub fn labels(m: &mut Mesh, f: &Frame) {
    let a = f.shown;
    if a < 0.005 {
        return;
    }
    let (lines, _) = card_layout(f.card);
    let wipe = smooth(0.15, 1.0, a) * 1.25;
    for line in &lines {
        let k = match line.kind {
            Kind::Lead => 0.55,
            Kind::Key => 1.0,
            Kind::Option(i) => 0.42 * f.listed.max(0.0) + 0.58 * f.options[i],
        } * a;
        if k < 0.004 {
            continue;
        }
        let per = line.cap / 44.0;
        // Capitals start 13 px below the band's top in a row (see the atlas).
        let top = line.at[1] - (42.0 - LABEL_BAND[0]) * per;
        let left = line.at[0] - 6.0 * per;
        let n = 16;
        let light: Vec<f32> = (0..=n)
            .map(|s| k * (1.0 - smooth(wipe - 0.25, wipe, s as f32 / n as f32)))
            .collect();
        text_row(m, line.row, left, top, per, &light);
    }
}

/// The atlas band of a row, cut into slices of its ink, each with its own
/// light, as screen quads from `left`, `top` at `per` px per atlas px.
fn text_row(m: &mut Mesh, row: usize, left: f32, top: f32, per: f32, light: &[f32]) {
    let [ink0, ink1] = LABEL_INK[row];
    let pad = 6.0;
    let height = (LABEL_BAND[1] - LABEL_BAND[0]) * per;
    let width = (ink1 - ink0 + 2.0 * pad) * per;
    let v0 = (row as f32 * 128.0 + LABEL_BAND[0]) / ATLAS[1];
    let v1 = (row as f32 * 128.0 + LABEL_BAND[1]) / ATLAS[1];
    let u0 = (ink0 - pad) / ATLAS[0];
    let u1 = (ink1 + pad) / ATLAS[0];
    let slices = light.len() - 1;
    for s in 0..slices {
        let (s0, s1) = (s as f32 / slices as f32, (s + 1) as f32 / slices as f32);
        let (c0, c1) = (person(light[s]), person(light[s + 1]));
        let (xa, xb) = (left + width * s0, left + width * s1);
        let (ua, ub) = (u0 + (u1 - u0) * s0, u0 + (u1 - u0) * s1);
        m.quad(
            [[xa, top], [xb, top], [xb, top + height], [xa, top + height]],
            [[ua, v0], [ub, v0], [ub, v1], [ua, v1]],
            [c0, c1, c1, c0],
            [[0.0; 3]; 4],
        );
    }
}

/// Key light for the air: the projected cone of the top light (apex,
/// apex half width, floor centre, floor half width), all in authored px.
pub fn cone(cam: &Camera) -> [f32; 8] {
    let apex = cam.project(TOP_LIGHT);
    let floor = cam.project(POOL);
    match (apex, floor) {
        (Some(a), Some(b)) => [
            a.at[0],
            a.at[1],
            0.22 * a.scale,
            0.0,
            b.at[0],
            b.at[1],
            POOL_RADIUS * b.scale,
            POOL_RADIUS * b.scale * (cam.eye[1] / b.depth).clamp(0.05, 1.0),
        ],
        _ => [0.0; 8],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{compose, SIZE};

    #[test]
    fn every_card_fits_its_place() {
        for card in 0..6 {
            let (lines, [x0, y0, x1, y1]) = card_layout(card);
            assert!(!lines.is_empty());
            assert!(x1 < SIZE[0] * 0.9 - 4.0, "card {card} right edge {x1}");
            assert!(y1 < SIZE[1] * 0.84, "card {card} bottom {y1}");
            assert!(x1 - x0 > 200.0 && y1 - y0 > 60.0);
            for l in &lines {
                assert!(l.cap >= 15.0, "card {card}: {} px capitals", l.cap);
            }
        }
        // The six beliefs: two lines of two names, then one to a line.
        let (lines, _) = card_layout(1);
        let rows: Vec<f32> = lines.iter().skip(1).map(|l| l.at[1]).collect();
        assert!(rows[0] == rows[1] && rows[2] == rows[3] && rows[3] < rows[4] && rows[4] < rows[5]);
    }

    #[test]
    fn nothing_that_matters_runs_under_the_card() {
        let near = |q: [f32; 2], [x0, y0, x1, y1]: [f32; 4]| {
            q[0] > x0 - 8.0 && q[0] < x1 + 8.0 && q[1] > y0 - 8.0 && q[1] < y1 + 8.0
        };
        for i in 0..(LOOP_SECONDS * 10.0) as usize {
            let f = compose(i as f32 * 0.1);
            if f.shown < 0.02 {
                continue;
            }
            let (_, panel) = card_layout(f.card);
            let cam = &f.camera;
            let mut points = vec![
                crate::EYE,
                crate::HEEL,
                crate::BALL,
                crate::on_figure(85.0, crate::CROWN_SVG),
            ];
            if f.tablet.shown > 0.02 {
                points.push(tablet_at(&f));
            }
            for k in 0..3 {
                if f.chain[k] > 0.02 {
                    points.push(mouth(k));
                    points.push(chest(k));
                }
            }
            for p in points {
                let q = cam.project(p).unwrap();
                assert!(
                    !near(q.at, panel),
                    "{p:?} under card {} at {}",
                    f.card,
                    f.time
                );
            }
        }
    }

    #[test]
    fn the_tablet_keeps_its_shape_whatever_it_says() {
        for k in 0..=crate::OWN {
            let lines = writing(k);
            assert!(lines.len() >= 2, "writing {k}");
            for [x0, x1, y] in lines {
                assert!((0.0..=1.0).contains(&x0) && x0 < x1 && x1 <= 1.0 + 1e-6);
                assert!((0.0..=1.0).contains(&y));
            }
        }
        // Every writing differs from every other.
        for a in 0..=crate::OWN {
            for b in a + 1..=crate::OWN {
                assert_ne!(writing(a), writing(b), "{a} {b}");
            }
        }
        // The tablet stays where it hangs while it is written over.
        let a = tablet_at(&compose(crate::passes(crate::FIRST_BELIEF) + 0.2));
        let b = tablet_at(&compose(crate::passes(crate::FIRST_BELIEF + 5) + 0.2));
        for e in 0..3 {
            assert!((a[e] - b[e]).abs() < 0.01);
        }
    }

    #[test]
    fn the_chain_is_followed_into_the_dark() {
        let f = compose(crate::STILL);
        let mut ends = Vec::new();
        for k in 0..4 {
            let (points, thread) = hop(&f, k);
            assert!(thread > 2 && thread <= points.len());
            ends.push((points[0], points[points.len() - 1]));
        }
        // Each hop starts where the one before ended, deeper in the room.
        for k in 1..4 {
            let (_, end) = ends[k - 1];
            let (start, _) = ends[k];
            for e in 0..3 {
                assert!((end[e] - start[e]).abs() < 1e-4, "hop {k}");
            }
            assert!(ends[k].1[2] > ends[k - 1].1[2]);
        }
        assert_eq!(ends[3].1, BEYOND);
    }

    #[test]
    fn a_frame_builds_without_gaps() {
        let s = Scene::new();
        for t in [
            0.0, 5.0, 8.0, 12.0, 15.0, 17.6, 22.5, 26.9, 29.5, 34.0, 40.0, 42.0, 47.0, 50.0, 53.0,
            55.0, 56.5, 59.6, 62.0, 65.0,
        ] {
            let f = compose(t);
            let mut m = Mesh::new(1000);
            floor(&mut m, &f);
            architecture(&mut m, &f);
            dust(&mut m, &s, &f, false);
            circuit(&mut m, &f);
            chain(&mut m, &f, true);
            tablet(&mut m, &f);
            chain(&mut m, &f, false);
            card(&mut m, &f);
            labels(&mut m, &f);
            assert_eq!(m.data.len() % (STRIDE * 3), 0);
            assert!(m.data.iter().all(|v| v.is_finite()), "{t}");
        }
    }
}
