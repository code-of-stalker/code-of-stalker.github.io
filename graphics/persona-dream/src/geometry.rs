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
use crate::generated::{ATLAS, LABEL_BAND, LABEL_INK};
use crate::{
    card_rows, curve, hash, lerp3, plate_at, site, smooth, source, tag_row, verdict_row, Camera,
    Frame, Kind, Piece, Projected, COLUMNS, FIGURE, FRAME_RECT, FRAME_Z, LOOP_SECONDS, ROWS, TAGS,
    TAG_Z, UNIT, VERDICTS,
};
use std::f32::consts::{PI, TAU};

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

/// A rectangle facing the lens around `at` (world), `w` × `h` metres:
/// corners from the bottom left, counter-clockwise.
fn facing(at: [f32; 3], w: f32, h: f32) -> [[f32; 3]; 4] {
    [
        [at[0] - 0.5 * w, at[1] - 0.5 * h, at[2]],
        [at[0] + 0.5 * w, at[1] - 0.5 * h, at[2]],
        [at[0] + 0.5 * w, at[1] + 0.5 * h, at[2]],
        [at[0] - 0.5 * w, at[1] + 0.5 * h, at[2]],
    ]
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
/// Flat screen fill of four world corners (none behind the lens).
fn fill(m: &mut Mesh, cam: &Camera, corners: &[[f32; 3]; 4], c: [Color; 4]) {
    let screen: Option<Vec<[f32; 2]>> = corners
        .iter()
        .map(|p| cam.project(*p).map(|q| q.at))
        .collect();
    if let Some(s) = screen {
        m.gradient([s[0], s[1], s[2], s[3]], c);
    }
}

/// The pictures an image piece carries.
#[derive(Clone, Copy)]
enum Picture {
    Mountains,
    House,
    Waves,
    Tree,
    Heart,
    Star,
    Sun,
}
const PICTURES: [Picture; 7] = [
    Picture::Mountains,
    Picture::House,
    Picture::Waves,
    Picture::Heart,
    Picture::Tree,
    Picture::Star,
    Picture::Sun,
];
fn picture(p: Picture) -> Vec<Vec<[f32; 2]>> {
    let arc = |c: [f32; 2], r: f32, a0: f32, a1: f32, n: usize| -> Vec<[f32; 2]> {
        (0..=n)
            .map(|i| {
                let a = a0 + (a1 - a0) * i as f32 / n as f32;
                [c[0] + r * a.cos(), c[1] + r * a.sin()]
            })
            .collect()
    };
    match p {
        Picture::Mountains => vec![
            vec![
                [0.06, 0.2],
                [0.3, 0.62],
                [0.44, 0.42],
                [0.62, 0.74],
                [0.94, 0.2],
            ],
            arc([0.78, 0.72], 0.08, 0.0, TAU, 14),
        ],
        Picture::House => vec![
            vec![
                [0.22, 0.12],
                [0.22, 0.5],
                [0.5, 0.82],
                [0.78, 0.5],
                [0.78, 0.12],
                [0.22, 0.12],
            ],
            vec![[0.42, 0.12], [0.42, 0.38], [0.58, 0.38], [0.58, 0.12]],
        ],
        Picture::Waves => (0..3)
            .map(|k| {
                (0..=14)
                    .map(|i| {
                        let x = 0.08 + 0.84 * i as f32 / 14.0;
                        [
                            x,
                            0.25 + 0.25 * k as f32 + 0.06 * (x * 14.0 + k as f32).sin(),
                        ]
                    })
                    .collect()
            })
            .collect(),
        Picture::Tree => vec![
            vec![[0.5, 0.12], [0.5, 0.44]],
            arc([0.5, 0.62], 0.2, 0.0, TAU, 18),
            vec![[0.12, 0.12], [0.88, 0.12]],
        ],
        Picture::Heart => vec![(0..=24)
            .map(|i| {
                let a = i as f32 / 24.0 * TAU;
                let x = 16.0 * a.sin().powi(3);
                let y = 13.0 * a.cos()
                    - 5.0 * (2.0 * a).cos()
                    - 2.0 * (3.0 * a).cos()
                    - (4.0 * a).cos();
                [0.5 + x * 0.021, 0.5 + y * 0.021]
            })
            .collect()],
        Picture::Sun => {
            let mut lines = vec![arc([0.5, 0.5], 0.16, 0.0, TAU, 18)];
            for k in 0..8 {
                let a = k as f32 / 8.0 * TAU;
                lines.push(vec![
                    [0.5 + 0.24 * a.cos(), 0.5 + 0.24 * a.sin()],
                    [0.5 + 0.34 * a.cos(), 0.5 + 0.34 * a.sin()],
                ]);
            }
            lines
        }
        Picture::Star => vec![(0..=10)
            .map(|i| {
                let a = PI * 0.5 + i as f32 / 10.0 * TAU;
                let r = if i % 2 == 0 { 0.34 } else { 0.14 };
                [0.5 + r * a.cos(), 0.48 + r * a.sin()]
            })
            .collect()],
    }
}

/// The pieces on their way to the shell: behind the person (`behind`, z > 0)
/// or before them. Each kind has its own look; all of them are the room's
/// ink, not the person's light.
pub fn pieces(m: &mut Mesh, f: &Frame, behind: bool) {
    let cam = &f.camera;
    let l = f.light;
    for p in &f.flights {
        if (p.at[2] > 0.0) != behind || p.alpha < 0.005 {
            continue;
        }
        let a = p.alpha * l;
        let i = p.plate;
        match p.kind {
            Piece::Image => {
                let (w, h) = (p.size, p.size * 0.74);
                let corners = facing(p.at, w, h);
                let glow = room(0.06 * a);
                fill(
                    m,
                    cam,
                    &corners,
                    [scale(glow, 0.5), scale(glow, 0.8), glow, scale(glow, 0.7)],
                );
                polyline(m, cam, &closed(&corners), 0.0011, 0.0, &|_, _| {
                    room(0.8 * a)
                });
                let o = corners[0];
                for line in picture(PICTURES[i % PICTURES.len()]) {
                    let points: Vec<[f32; 3]> = line
                        .iter()
                        .map(|u| {
                            [
                                o[0] + (0.12 + 0.76 * u[0]) * w,
                                o[1] + (0.12 + 0.76 * u[1]) * h,
                                o[2],
                            ]
                        })
                        .collect();
                    polyline(m, cam, &points, 0.0009, 0.0, &|_, _| room(0.6 * a));
                }
            }
            Piece::Attitude => {
                // The way it came, from the other person: a thin thread.
                let (from, bend) = source(i);
                let e = p.along * p.along * (3.0 - 2.0 * p.along);
                let n = 24;
                let way: Vec<[f32; 3]> = (0..=n)
                    .map(|k| curve(from, bend, plate_at(i), e * k as f32 / n as f32))
                    .collect();
                polyline(m, cam, &way, 0.0009, 0.0, &|k, _| {
                    room(0.4 * a * (k as f32 / n as f32).powf(0.7))
                });
                // A tag of letterless lines: what was said, not whose words.
                let (w, h) = (p.size, p.size * 0.46);
                let [b0, b1, _, t0] = facing(p.at, w, h);
                let cut = 0.22 * h;
                let outline = [
                    b0,
                    b1,
                    [b1[0], t0[1] - cut, b1[2]],
                    [b1[0] - cut, t0[1], b1[2]],
                    t0,
                ];
                let glow = room(0.04 * a);
                fill(
                    m,
                    cam,
                    &[b0, b1, [b1[0], t0[1], b1[2]], t0],
                    [glow, glow, scale(glow, 0.6), scale(glow, 0.6)],
                );
                polyline(m, cam, &closed(&outline), 0.001, 0.0, &|_, _| {
                    room(0.75 * a)
                });
                for (k, length) in [0.78_f32, 0.56, 0.68].iter().enumerate() {
                    let y = t0[1] - h * (0.3 + 0.22 * k as f32);
                    let x0 = b0[0] + 0.12 * w;
                    let x1 =
                        x0 + 0.76 * w * length * (0.85 + 0.3 * hash(400 + 3 * i as u32 + k as u32));
                    segment(
                        m,
                        cam,
                        [x0, y, p.at[2]],
                        [x1.min(b1[0] - 0.1 * w), y, p.at[2]],
                        3,
                        0.0013,
                        room(0.6 * a),
                    );
                }
            }
            Piece::Fear => {
                // A dark shard with a sharp, trembling edge and two cracks.
                let n = 5;
                let rim: Vec<[f32; 3]> = (0..n)
                    .map(|k| {
                        let r = |j: u32| hash(500 + 11 * i as u32 + 3 * k as u32 + j);
                        let ang = (k as f32 + 0.35 * r(1)) / n as f32 * TAU + 0.9 * i as f32;
                        let radius = 0.5 * p.size * (0.45 + 0.55 * r(2));
                        [
                            p.at[0] + radius * ang.cos(),
                            p.at[1] + radius * ang.sin(),
                            p.at[2],
                        ]
                    })
                    .collect();
                let screen: Option<Vec<[f32; 2]>> =
                    rim.iter().map(|q| cam.project(*q).map(|q| q.at)).collect();
                if let (Some(s), Some(c)) = (screen, cam.project(p.at)) {
                    let k = 0.85 * p.alpha;
                    m.fan(c.at, &s, [0.0, 0.0, 0.5 * k, k], [0.0, 0.0, 0.5 * k, k]);
                }
                polyline(m, cam, &closed(&rim), 0.0009, 0.0, &|_, _| room(0.85 * a));
                for k in [0, 2] {
                    segment(m, cam, p.at, rim[k], 3, 0.0006, room(0.4 * a));
                }
            }
            Piece::Memory => {
                // A faded frame of film: soft, dimmer, with sprocket holes.
                let a = 0.6 * a;
                let (w, h) = (p.size, p.size * 0.72);
                let corners = facing(p.at, w, h);
                let glow = room(0.035 * a);
                fill(m, cam, &corners, [glow; 4]);
                polyline(m, cam, &closed(&corners), 0.0016, 0.0, &|_, _| {
                    room(0.5 * a)
                });
                let hole = 0.06 * w;
                for k in 0..5 {
                    let x = corners[0][0] + w * (0.14 + 0.18 * k as f32);
                    for y in [corners[0][1] + 0.1 * h, corners[2][1] - 0.1 * h] {
                        let sq = facing([x, y, p.at[2]], hole, hole);
                        polyline(m, cam, &closed(&sq), 0.0007, 0.0, &|_, _| room(0.4 * a));
                    }
                }
                let y = corners[0][1] + 0.42 * h;
                segment(
                    m,
                    cam,
                    [corners[0][0] + 0.12 * w, y, p.at[2]],
                    [corners[1][0] - 0.12 * w, y, p.at[2]],
                    4,
                    0.0012,
                    room(0.35 * a),
                );
                let sun = upright([p.at[0] + 0.18 * w, y + 0.16 * h, p.at[2]], 0.07 * w, 14);
                polyline(m, cam, &sun, 0.0011, 0.0, &|_, _| room(0.3 * a));
            }
        }
    }
}

/// The picture of the world behind the person: its frame drawn around, the
/// matrix of cells, hatching in the cells that forbid or condemn, the sweep
/// that shows what is already there, and the cells of a verdict while it
/// is lit.
pub fn world_picture(m: &mut Mesh, f: &Frame) {
    if f.frame < 0.002 && f.grid < 0.002 {
        return;
    }
    let cam = &f.camera;
    let l = f.light * f.picture;
    let [x0, y0, x1, y1] = FRAME_RECT;
    let z = FRAME_Z;
    // Two lines a little apart, drawn from the floor up the left side,
    // across the top and down the right.
    for (gap, k) in [(0.0, 0.55), (0.035, 0.32)] {
        let path = dense(
            &[
                [x0 - gap, y0, z],
                [x0 - gap, y1 + gap, z],
                [x1 + gap, y1 + gap, z],
                [x1 + gap, y0, z],
            ],
            24,
        );
        polyline(m, cam, &partial(&path, f.frame), 0.0024, 0.0, &|_, _| {
            room(k * l)
        });
    }
    // Small squares in the corners once it is drawn.
    let corners = smooth(0.85, 1.0, f.frame);
    if corners > 0.002 {
        for (x, y) in [(x0, y1), (x1, y1)] {
            let sq = facing([x, y, z], 0.07, 0.07);
            polyline(m, cam, &closed(&sq), 0.002, 0.0, &|_, _| {
                room(0.45 * corners * l)
            });
        }
    }
    let g = f.grid;
    if g < 0.002 {
        return;
    }
    let w = (x1 - x0) / COLUMNS as f32;
    let h = (y1 - y0) / ROWS as f32;
    for c in 1..COLUMNS {
        let x = x0 + c as f32 * w;
        segment(
            m,
            cam,
            [x, y0, z],
            [x, y1, z],
            10,
            0.0018,
            room(0.24 * g * l),
        );
    }
    for r in 1..ROWS {
        let y = y0 + r as f32 * h;
        segment(
            m,
            cam,
            [x0, y, z],
            [x1, y, z],
            10,
            0.0018,
            room(0.24 * g * l),
        );
    }
    for (r, row) in VERDICTS.iter().enumerate() {
        for (c, v) in row.iter().enumerate() {
            let shown = revealed(f, c);
            let [cx, cy, _] = crate::cell_centre(r, c);
            // НЕЛЬЗЯ and ПЛОХО: a few diagonal strokes across the cell.
            if *v == 1 || *v == 3 {
                for k in 0..4 {
                    let s = (k as f32 + 0.5) / 4.0 - 0.5;
                    let a = [cx - 0.42 * w + s * 0.5 * w, cy - 0.42 * h, z];
                    let b = [a[0] + 0.32 * w, cy + 0.42 * h, z];
                    segment(m, cam, a, b, 3, 0.0011, room(0.1 * g * shown * l));
                }
            }
            // The cells of the verdict lit now.
            let lit = f.verdicts[*v] * shown;
            if lit > 0.005 {
                let inner = facing([cx, cy, z - 0.005], 0.86 * w, 0.82 * h);
                polyline(m, cam, &closed(&inner), 0.0014, 0.0, &|_, _| {
                    person(0.5 * lit * l)
                });
                if let Some(q) = cam.project([cx, cy, z]) {
                    m.glow(q.at, 0.3 * w * q.scale, person(0.06 * lit * l));
                }
            }
        }
    }
    let [u, alpha] = f.sweep;
    if alpha > 0.005 {
        let x = x0 + (x1 - x0) * u;
        for (half, k) in [(0.03, 0.05), (0.012, 0.14), (0.0016, 0.75)] {
            segment(
                m,
                cam,
                [x, y0, z - 0.01],
                [x, y1 + 0.02, z - 0.01],
                10,
                half,
                person(k * alpha * l),
            );
        }
    }
}
/// How far the sweep has shown column `c` of the matrix (0..1).
fn revealed(f: &Frame, c: usize) -> f32 {
    let centre = (c as f32 + 0.5) / COLUMNS as f32;
    smooth(centre - 0.06, centre + 0.04, f.sweep[0])
}
/// The words in the matrix's cells: faintly there as soon as the grid is,
/// clear once the sweep has passed, brighter while their verdict is lit.
pub fn world_words(m: &mut Mesh, f: &Frame) {
    let g = f.grid;
    if g < 0.002 {
        return;
    }
    let cam = &f.camera;
    for (r, row) in VERDICTS.iter().enumerate() {
        for (c, v) in row.iter().enumerate() {
            let shown = 0.12 + 0.88 * revealed(f, c);
            let Some(q) = cam.project(crate::cell_centre(r, c)) else {
                continue;
            };
            let k = 0.8 * g * shown * (0.55 + 0.45 * f.verdicts[*v]) * f.light * f.picture;
            word(
                m,
                verdict_row(*v),
                q.at,
                WORD_CAP * q.scale,
                k,
                cam.coc(q.depth),
            );
        }
    }
}
/// Capital height of the matrix's words (m).
pub const WORD_CAP: f32 = 0.05;

/// The tags: capital height of their words and their padding (m).
pub const TAG_CAP: f32 = 0.03;
pub const TAG_PAD: f32 = 0.016;
/// Where tag `k` hangs: its pin on the shell, the hole it hangs by and its
/// panel (left, bottom, right, top), all in the tag's plane except the pin.
pub struct TagPlace {
    pub pin: [f32; 3],
    pub hole: [f32; 3],
    pub panel: [f32; 4],
    pub text_left: f32,
}
pub fn tag_place(f: &Frame, k: usize) -> TagPlace {
    let (plate, offset, _) = TAGS[k];
    let [sx, sy] = site(plate, f.time);
    let pin = [
        (sx - crate::ORIGIN_SVG) * UNIT,
        (crate::FLOOR_SVG - sy) * UNIT,
        -0.03,
    ];
    let hole = [pin[0] + offset[0] + f.tags[k][2], pin[1] + offset[1], TAG_Z];
    let text = ink_width(tag_row(k)) / 44.0 * TAG_CAP;
    let w = text + 2.0 * TAG_PAD + 0.018;
    let h = TAG_CAP + 2.0 * TAG_PAD;
    let (left, text_left) = if offset[0] >= 0.0 {
        (hole[0] - 0.014, hole[0] + 0.016)
    } else {
        (hole[0] + 0.014 - w, hole[0] - 0.016 - text)
    };
    TagPlace {
        pin,
        hole,
        panel: [left, hole[1] - 0.5 * h, left + w, hole[1] + 0.5 * h],
        text_left,
    }
}
/// The tags pinned to the character: a pin on its plate, a slack string to
/// the tag, the tag's panel with the hole it hangs by.
pub fn tags(m: &mut Mesh, f: &Frame) {
    let cam = &f.camera;
    for k in 0..TAGS.len() {
        let [string, shown, _] = f.tags[k];
        if string < 0.005 {
            continue;
        }
        let place = tag_place(f, k);
        let (pin, hole) = (place.pin, place.hole);
        if let Some(q) = cam.project(pin) {
            let coc = cam.coc(q.depth);
            m.disc(q.at, 0.005 * q.scale, coc, person(0.95 * string));
            m.glow(q.at, 0.03 * q.scale + coc, person(0.1 * string));
        }
        let sag = [
            0.5 * (pin[0] + hole[0]),
            0.5 * (pin[1] + hole[1]) - 0.05,
            0.5 * (pin[2] + hole[2]),
        ];
        let n = 24;
        let way: Vec<[f32; 3]> = (0..=n)
            .map(|i| curve(pin, sag, hole, i as f32 / n as f32))
            .collect();
        polyline(m, cam, &partial(&way, string), 0.0008, 0.0, &|_, _| {
            person(0.55 * string)
        });
        if shown < 0.005 {
            continue;
        }
        let [x0, y0, x1, y1] = place.panel;
        let z = TAG_Z;
        let cut = 0.012;
        let outline = if place.text_left > hole[0] {
            vec![
                [x0, y0 + cut, z],
                [x0 + cut, y0, z],
                [x1, y0, z],
                [x1, y1, z],
                [x0 + cut, y1, z],
                [x0, y1 - cut, z],
            ]
        } else {
            vec![
                [x0, y0, z],
                [x1 - cut, y0, z],
                [x1, y0 + cut, z],
                [x1, y1 - cut, z],
                [x1 - cut, y1, z],
                [x0, y1, z],
            ]
        };
        // The panel hides what is behind it: nearly opaque, so the words of
        // the picture behind do not show through.
        let screen: Option<Vec<[f32; 2]>> = outline
            .iter()
            .map(|p| cam.project(*p).map(|q| q.at))
            .collect();
        if let Some(s) = screen {
            let k = 0.88 * shown;
            m.polygon(&s, [0.0, 0.02 * shown, 0.5 * k, k]);
        }
        let path = dense(&closed(&outline), 6);
        polyline(
            m,
            cam,
            &partial(&path, smooth(0.0, 0.8, shown)),
            0.0008,
            0.0,
            &|_, _| person(0.7 * shown),
        );
        polyline(m, cam, &upright(hole, 0.0055, 16), 0.0007, 0.0, &|_, _| {
            person(0.7 * shown)
        });
    }
}
/// The tags' words, wiped in as each tag comes.
fn tag_words(m: &mut Mesh, f: &Frame) {
    let cam = &f.camera;
    for k in 0..TAGS.len() {
        let shown = f.tags[k][1];
        if shown < 0.005 {
            continue;
        }
        let place = tag_place(f, k);
        let Some(q) = cam.project([place.text_left, place.hole[1], TAG_Z]) else {
            continue;
        };
        let cap = TAG_CAP * q.scale;
        let per = cap / 44.0;
        let top = q.at[1] - 0.5 * cap - (42.0 - LABEL_BAND[0]) * per;
        let left = q.at[0] - 6.0 * per;
        let wipe = smooth(0.2, 1.0, shown) * 1.25;
        let n = 16;
        let light: Vec<f32> = (0..=n)
            .map(|i| 0.95 * shown * (1.0 - smooth(wipe - 0.25, wipe, i as f32 / n as f32)))
            .collect();
        text_row(
            m,
            tag_row(k),
            left,
            top,
            per,
            &light,
            blur_bias(cam.coc(q.depth)),
        );
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
/// The parts lit in turn stand two to a line.
pub fn card_layout(card: usize) -> (Vec<Line>, [f32; 4]) {
    let rows = card_rows(card);
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
    let option_cap = options
        .chunks(2)
        .map(|pair| {
            let width: f32 = pair.iter().map(|r| ink_width(*r) / 44.0).sum::<f32>()
                + gap * (pair.len() - 1) as f32;
            CARD_WIDTH / width
        })
        .fold(19.0, f32::min);
    let lead = 16.0;
    let mut lines = Vec::with_capacity(rows.len());
    let x = CARD_AT[0] + CARD_PAD[0];
    let mut y = CARD_AT[1] + CARD_PAD[1];
    let mut right: f32 = x;
    let mut option_x = x;
    let mut in_line = 0;
    let mut options_started = false;
    for (row, kind) in rows {
        match kind {
            Kind::Lead | Kind::Key | Kind::Late => {
                let cap = if *kind == Kind::Key { key } else { lead };
                // A quiet half sits close above its bright half; a new
                // sentence part after a bright half gets a breath of space.
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
                } else if in_line == 2 {
                    y += 1.7 * option_cap;
                    option_x = x;
                    in_line = 0;
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
/// The panel of the card: a quiet fill, an outline drawn around as it
/// opens, a small tick, and under a part a mark while it is lit.
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
    m.polygon(&outline, [0.0, 0.02 * a, 0.5 * a, 0.5 * a]);
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
/// The card's words and the tags' words: textured quads for the text
/// program, wiped in from the left. `local` holds the atlas coordinates.
pub fn labels(m: &mut Mesh, f: &Frame) {
    tag_words(m, f);
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
            Kind::Late => 0.62 * f.late,
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
        text_row(m, line.row, left, top, per, &light, 0.0);
    }
}

/// How far the lens softens a word: a mip bias from its circle of confusion.
fn blur_bias(coc: f32) -> f32 {
    (1.0 + 0.9 * coc).log2()
}
/// The atlas band of a row, cut into slices of its ink, each with its own
/// light, as screen quads from `left`, `top` at `per` px per atlas px.
fn text_row(m: &mut Mesh, row: usize, left: f32, top: f32, per: f32, light: &[f32], bias: f32) {
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
            [[bias, 0.0, 0.0]; 4],
        );
    }
}
/// One word centred on `centre` (px), capitals `cap` px tall.
fn word(m: &mut Mesh, row: usize, centre: [f32; 2], cap: f32, k: f32, coc: f32) {
    if k < 0.004 {
        return;
    }
    let per = cap / 44.0;
    let width = ink_width(row) * per;
    let top = centre[1] - 0.5 * cap - (42.0 - LABEL_BAND[0]) * per;
    let left = centre[0] - 0.5 * width - 6.0 * per;
    text_row(m, row, left, top, per, &[k, k], blur_bias(coc));
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
    use crate::{compose, CARDS, LOOP_SECONDS, SIZE};

    #[test]
    fn every_card_fits_its_place() {
        for card in 0..3 {
            let (lines, [x0, y0, x1, y1]) = card_layout(card);
            assert!(!lines.is_empty());
            assert!(x1 < SIZE[0] * 0.9 - 4.0, "card {card} right edge {x1}");
            assert!(y1 < SIZE[1] * 0.84, "card {card} bottom {y1}");
            assert!(x1 - x0 > 200.0 && y1 - y0 > 60.0);
            for l in &lines {
                assert!(l.cap >= 15.0, "card {card}: {} px capitals", l.cap);
            }
        }
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
            // The body, the frame's corners and words, the tags.
            for p in [
                crate::EYE,
                crate::HEEL,
                crate::BALL,
                crate::on_figure(85.0, crate::CROWN_SVG),
            ] {
                let q = cam.project(p).unwrap();
                assert!(
                    !near(q.at, panel),
                    "body under card {} at {}",
                    f.card,
                    f.time
                );
            }
            // The words of the matrix while it is the subject.
            if f.grid > 0.02 && f.card == 1 {
                for (r, row) in VERDICTS.iter().enumerate() {
                    for (c, v) in row.iter().enumerate() {
                        let q = cam.project(crate::cell_centre(r, c)).unwrap();
                        let w = 0.5 * ink_width(verdict_row(*v)) / 44.0 * WORD_CAP * q.scale;
                        for x in [q.at[0] - w, q.at[0] + w] {
                            assert!(
                                !near([x, q.at[1]], panel),
                                "word {r},{c} under the card at {}",
                                f.time
                            );
                        }
                    }
                }
            }
            for k in 0..TAGS.len() {
                if f.tags[k][1] < 0.02 {
                    continue;
                }
                let [x0, y0, x1, y1] = tag_place(&f, k).panel;
                for p in [
                    [x0, y0, TAG_Z],
                    [x1, y1, TAG_Z],
                    [x1, y0, TAG_Z],
                    [x0, y1, TAG_Z],
                ] {
                    let q = cam.project(p).unwrap();
                    assert!(!near(q.at, panel), "tag {k} under the card at {}", f.time);
                }
            }
        }
    }

    #[test]
    fn every_tag_is_in_the_shot() {
        for t in [44.0, 50.0, 53.0, 57.0] {
            let f = compose(t);
            for k in 0..TAGS.len() {
                if f.tags[k][1] < 0.02 {
                    continue;
                }
                let [x0, y0, x1, y1] = tag_place(&f, k).panel;
                for p in [[x0, y0, TAG_Z], [x1, y1, TAG_Z]] {
                    let q = f.camera.project(p).unwrap();
                    assert!(
                        q.at[0] > 40.0 && q.at[0] < SIZE[0] - 40.0 && q.at[1] > 30.0,
                        "tag {k} at {t}: {:?}",
                        q.at
                    );
                }
            }
        }
    }

    #[test]
    fn tags_do_not_cover_each_other_or_the_face() {
        let f = compose(CARDS[2][1] - 1.0);
        let panels: Vec<[f32; 4]> = (0..TAGS.len()).map(|k| tag_place(&f, k).panel).collect();
        for a in 0..panels.len() {
            for b in a + 1..panels.len() {
                let (p, q) = (panels[a], panels[b]);
                let apart = p[2] < q[0] || q[2] < p[0] || p[3] < q[1] || q[3] < p[1];
                assert!(apart, "tags {a} and {b} overlap");
            }
            // Not over the eye: the face stays seen.
            let [x0, y0, x1, y1] = panels[a];
            let eye = crate::EYE;
            assert!(
                !(eye[0] > x0 && eye[0] < x1 && eye[1] > y0 && eye[1] < y1),
                "tag {a}"
            );
        }
    }

    #[test]
    fn a_frame_builds_without_gaps() {
        let s = Scene::new();
        for t in [
            0.0, 6.0, 9.5, 13.0, 17.0, 20.0, 24.0, 28.0, 33.0, 42.0, 46.0, 52.0, 60.0, 65.0,
        ] {
            let f = compose(t);
            let mut m = Mesh::new(1000);
            floor(&mut m, &f);
            architecture(&mut m, &f);
            dust(&mut m, &s, &f, false);
            world_picture(&mut m, &f);
            world_words(&mut m, &f);
            pieces(&mut m, &f, true);
            pieces(&mut m, &f, false);
            tags(&mut m, &f);
            card(&mut m, &f);
            labels(&mut m, &f);
            assert_eq!(m.data.len() % (STRIDE * 3), 0);
            assert!(m.data.iter().all(|v| v.is_finite()), "{t}");
        }
    }
}
