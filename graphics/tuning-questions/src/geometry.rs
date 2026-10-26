//! Mesh generators. Every vertex carries the authored position (px), a local
//! coordinate for the soft profile (or the labels' texture), four channels
//! and a lens shape: red is the light of the room and of the conclusion,
//! green the light of the person and of the questions, blue the opaque body
//! and alpha how much it hides what is behind.
//!
//! The lens is applied here, primitive by primitive: a line or a speck at a
//! depth the camera does not focus on spreads into its circle of confusion
//! and dims by the same factor, so its light is conserved. The figure gets
//! the same radius in its own shader. The card is not in the room: it stays
//! sharp whatever the lens does.
use crate::generated::{ATLAS, LABEL_BAND, LABEL_INK, SILHOUETTE};
use crate::{
    card_rows, curve, hash, lerp3, route, smooth, stop_at, thread_length, word_span, Camera, Frame,
    Kind, Projected, BEND, DOT_RADIUS, FIGURE, FLOOR_SVG, LINE_Y, LINE_Z, LOOP_SECONDS, MOUTH,
    ORIGIN_SVG, START, UNIT, WORDS, WORD_HALF,
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

/// Fixed particle fields: dust in the air of the room, and the grains the
/// conclusion falls apart into at the end.
pub struct Scene {
    pub motes: Vec<Mote>,
    pub grains: Vec<Grain>,
}
pub struct Mote {
    pub at: [f32; 3],
    pub glow: f32,
    pub phase: [f32; 3],
}
/// A grain of a word: which word, where along it, how it drifts away.
pub struct Grain {
    pub word: usize,
    pub along: f32,
    pub drift: [f32; 3],
    pub delay: f32,
    pub glow: f32,
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
        // Six grains per word and three for the full stop (word 5).
        let grains = (0..33u32)
            .map(|i| {
                let r = |k: u32| hash(52000 + i * 11 + k);
                Grain {
                    word: (i / 6) as usize,
                    along: r(1),
                    drift: [0.04 * (r(2) - 0.3), 0.07 + 0.12 * r(3), -0.05 * r(4)],
                    delay: 0.25 * r(5),
                    glow: 0.5 + 0.5 * r(6),
                }
            })
            .collect();
        Self { motes, grains }
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

/// The figure's quad in the world (the figure program draws it), or its
/// reflection in the polished floor.
pub fn figure_quad(m: &mut Mesh, cam: &Camera, mirrored: bool) -> bool {
    let corner = |x: f32, y: f32| {
        let p = if mirrored { [x, -y, 0.0] } else { [x, y, 0.0] };
        cam.project(p).map(|q| q.at)
    };
    let [l, b, r, t] = FIGURE;
    let (Some(lt), Some(rt), Some(rb), Some(lb)) =
        (corner(l, t), corner(r, t), corner(r, b), corner(l, b))
    else {
        return false;
    };
    m.quad(
        [lt, rt, rb, lb],
        [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]],
        [[0.0; 4]; 4],
        [[0.0; 3]; 4],
    );
    true
}

/// Contact rings on the floor: the far half goes behind the person, the
/// near half in front.
pub fn rings(m: &mut Mesh, f: &Frame, near: bool) {
    let cam = &f.camera;
    for r in &f.rings {
        let (from, to) = if near { (PI, TAU) } else { (0.0, PI) };
        let points = circle(r.origin, r.radius, from, to, 40);
        polyline(m, cam, &points, 0.0026, 0.0, &|_, _| {
            [0.25 * r.strength, 0.55 * r.strength, 0.0, 0.0]
        });
    }
}

/// Where a point of the line is on the route (0 lips … 1 full stop).
fn on_route(x: f32) -> f32 {
    let thread = thread_length();
    let total = thread + stop_at()[0] - START[0];
    (thread + x - START[0]) / total
}
/// The axis of a word from `x0` to `x1` as a capsule: rounded ends, an
/// even body. Points and their half heights.
fn capsule(x0: f32, x1: f32, half: f32) -> (Vec<[f32; 3]>, Vec<f32>) {
    let half = half.min((x1 - x0) * 0.5).max(1e-5);
    let mut points = Vec::with_capacity(20);
    let mut widths = Vec::with_capacity(20);
    for i in 0..=5 {
        let a = i as f32 / 5.0 * PI * 0.5;
        points.push([x0 + half * (1.0 - a.cos()), LINE_Y, LINE_Z]);
        widths.push(half * a.sin().max(0.15));
    }
    for i in 1..8 {
        points.push([
            x0 + half + (x1 - x0 - 2.0 * half) * i as f32 / 8.0,
            LINE_Y,
            LINE_Z,
        ]);
        widths.push(half);
    }
    for i in 0..=5 {
        let a = i as f32 / 5.0 * PI * 0.5;
        points.push([x1 - half + half * a.sin(), LINE_Y, LINE_Z]);
        widths.push(half * a.cos().max(0.15));
    }
    (points, widths)
}

/// The conclusion: the voice's way from the lips, the words laid along the
/// line one by one, the full stop and its landing; at the end it falls
/// apart into grains that drift away.
pub fn conclusion(m: &mut Mesh, s: &Scene, f: &Frame) {
    let cam = &f.camera;
    let gone = 1.0 - smooth(0.0, 0.45, f.dissolve);
    // The voice's way: faint, with each word travelling along it as it is said.
    if f.thread > 0.005 {
        let n = 32;
        let way: Vec<[f32; 3]> = (0..=n)
            .map(|i| curve(MOUTH, BEND, START, i as f32 / n as f32))
            .collect();
        polyline(m, cam, &way, 0.0011, 0.0, &|i, _| {
            let u = i as f32 / n as f32;
            room(0.32 * f.thread * smooth(0.0, 0.15, u) * gone)
        });
    }
    for (i, (at, _, _)) in WORDS.iter().enumerate() {
        // A word leaves the lips a moment before it is laid.
        let fly = (f.time - (at - 0.38)) / 0.38;
        if (0.0..1.0).contains(&fly) {
            let target = on_route(word_span(i)[0]);
            let u = target * (1.0 - (1.0 - fly).powi(2));
            let tail: Vec<[f32; 3]> = (0..8)
                .map(|k| route((u - 0.02 * k as f32).max(0.0)))
                .collect();
            polyline(m, cam, &tail, 0.0022, 0.0, &|k, _| {
                room(0.55 * (1.0 - k as f32 / 8.0))
            });
        }
    }
    let brightness = f.line * gone;
    for (i, w) in f.written.iter().enumerate() {
        if *w < 0.002 || brightness < 0.002 {
            continue;
        }
        let [x0, x1] = word_span(i);
        let tip = x0 + (x1 - x0) * w;
        let (points, widths) = capsule(x0, tip, WORD_HALF);
        profile(m, cam, &points, &widths, 0.0, &|_, _| {
            room(0.85 * brightness)
        });
        // The tip that is still being laid glows.
        if *w < 1.0 {
            if let Some(q) = cam.project([tip, LINE_Y, LINE_Z - 0.002]) {
                let coc = cam.coc(q.depth);
                m.glow(q.at, 0.03 * q.scale + coc, room(0.25));
                m.disc(q.at, 0.006 * q.scale, coc, [0.9, 0.3, 0.0, 0.0]);
            }
        }
    }
    let stop = stop_at();
    if f.stop > 0.002 && brightness > 0.002 {
        if let Some(q) = cam.project(stop) {
            let coc = cam.coc(q.depth);
            m.disc(
                q.at,
                DOT_RADIUS * q.scale,
                coc,
                room(1.05 * brightness * f.stop),
            );
        }
    }
    // The full stop lands: one ring, a short settling.
    if f.landing > 0.0 {
        let k = (1.0 - f.landing).powi(2);
        let ring = upright(stop, DOT_RADIUS * 1.6 + 0.07 * f.landing.sqrt(), 48);
        polyline(m, cam, &ring, 0.0012, 0.0, &|_, _| room(0.5 * k));
        if let Some(q) = cam.project(stop) {
            m.glow(q.at, (0.02 + 0.05 * f.landing) * q.scale, room(0.18 * k));
        }
    }
    // Falling apart: each word into a few grains that rise and fade.
    if f.dissolve > 0.0 && f.dissolve < 1.0 {
        for g in &s.grains {
            let base = if g.word < WORDS.len() {
                let [x0, x1] = word_span(g.word);
                [x0 + (x1 - x0) * g.along, LINE_Y, LINE_Z]
            } else {
                stop
            };
            let d = ((f.dissolve - g.delay) / (1.0 - g.delay)).clamp(0.0, 1.0);
            if d <= 0.0 {
                continue;
            }
            let p = [
                base[0] + g.drift[0] * d,
                base[1] + g.drift[1] * d * d.sqrt(),
                base[2] + g.drift[2] * d,
            ];
            let Some(q) = cam.project(p) else { continue };
            let k = 0.7 * g.glow * (PI * d).sin().powf(0.6) * (1.0 - d);
            m.disc(q.at, 0.0028 * q.scale, cam.coc(q.depth), room(k));
        }
    }
}

/// «Откуда пришёл этот вывод?»: the light going back from the full stop to
/// the lips. What it has passed stays lit for a while; at the lips it rests
/// and goes out. Nothing beyond the lips.
pub fn trace(m: &mut Mesh, f: &Frame) {
    let cam = &f.camera;
    let [u, alpha] = f.trace;
    if f.traced > 0.005 {
        // The lit way: from the light back up to the full stop.
        let n = 64;
        let way: Vec<[f32; 3]> = (0..=n)
            .map(|i| {
                let v = u + (1.0 - u) * i as f32 / n as f32;
                let mut p = route(v);
                p[2] -= 0.003;
                p
            })
            .collect();
        polyline(m, cam, &way, 0.0013, 0.0, &|i, _| {
            let v = i as f32 / n as f32;
            person(0.3 * f.traced * (0.45 + 0.55 * (1.0 - v)))
        });
    }
    if alpha > 0.005 {
        let tail: Vec<[f32; 3]> = (0..14)
            .map(|k| {
                let mut p = route((u + 0.011 * k as f32).min(1.0));
                p[2] -= 0.004;
                p
            })
            .collect();
        polyline(m, cam, &tail, 0.0034, 0.0, &|k, _| {
            person(0.55 * alpha * (1.0 - k as f32 / 14.0).powi(2))
        });
        let mut head = route(u);
        head[2] -= 0.006;
        if let Some(q) = cam.project(head) {
            let coc = cam.coc(q.depth);
            m.glow(q.at, 0.045 * q.scale + coc, person(0.16 * alpha));
            m.disc(q.at, 0.006 * q.scale, coc, person(1.2 * alpha));
        }
    }
    if f.lips > 0.005 {
        if let Some(q) = cam.project([MOUTH[0] + 0.006, MOUTH[1], MOUTH[2] - 0.01]) {
            let coc = cam.coc(q.depth);
            m.glow(q.at, 0.06 * q.scale + coc, person(0.12 * f.lips));
            m.disc(q.at, 0.005 * q.scale, coc, person(0.7 * f.lips));
        }
    }
}

/// «Что явилось стартовой точкой?»: an empty ring around the start of the
/// line, and a pulse from it for each possible start, the same each time.
pub fn start(m: &mut Mesh, f: &Frame) {
    if f.start < 0.005 {
        return;
    }
    let cam = &f.camera;
    let ring = upright([START[0], START[1], START[2] - 0.004], 0.026, 64);
    polyline(m, cam, &ring, 0.0012, 0.0, &|_, _| person(0.75 * f.start));
    // Four short ticks around it, like a sight that waits.
    for k in 0..4 {
        let a = k as f32 * PI * 0.5 + PI * 0.25;
        let (c, s) = (a.cos(), a.sin());
        let p0 = [START[0] + 0.034 * c, START[1] + 0.034 * s, START[2] - 0.004];
        let p1 = [START[0] + 0.044 * c, START[1] + 0.044 * s, START[2] - 0.004];
        segment(m, cam, p0, p1, 2, 0.001, person(0.5 * f.start));
    }
    for r in &f.pulses {
        let ring = upright(
            [r.origin[0], r.origin[1], r.origin[2] - 0.004],
            r.radius,
            64,
        );
        polyline(m, cam, &ring, 0.001, 0.0, &|_, _| {
            person(0.45 * r.strength * f.start)
        });
    }
}

/// The voice in the air: a few calm fronts on the side the face turns to.
pub fn voice(m: &mut Mesh, f: &Frame) {
    let cam = &f.camera;
    let Some(q) = cam.project(MOUTH) else {
        return;
    };
    let coc = cam.coc(q.depth);
    for w in &f.waves {
        let r = w.radius * q.scale;
        if r < 4.0 {
            continue;
        }
        let n = 48;
        let dots: Vec<Dot> = (0..=n)
            .map(|i| {
                let t = i as f32 / n as f32;
                let a = -0.42 * PI + 0.84 * PI * t;
                Dot {
                    at: [q.at[0] + r * a.cos(), q.at[1] - r * a.sin()],
                    half: 0.9 * m.pixel,
                    coc,
                    color: room(0.45 * w.strength * (PI * t).sin().max(0.0).powf(1.2)),
                }
            })
            .collect();
        m.strip(&dots);
    }
    if f.voice > 0.005 {
        m.glow(
            [q.at[0] + 4.0, q.at[1]],
            0.04 * q.scale + coc,
            room(0.14 * f.voice),
        );
    }
}

/// The body's back and front (world x) at an SVG row, if there is body.
pub fn body_edges(row: f32) -> Option<[f32; 2]> {
    let at = (row / 530.0).clamp(0.0, 1.0) * 64.0;
    let (mut sum, mut weight) = ([0.0; 2], 0.0);
    for (i, e) in SILHOUETTE.iter().enumerate() {
        let d = (i as f32 - at) / 1.6;
        if d.abs() > 3.0 || e[1] - e[0] < 1.0 {
            continue;
        }
        let w = (-d * d).exp();
        sum = [sum[0] + e[0] * w, sum[1] + e[1] * w];
        weight += w;
    }
    (weight > 0.2).then(|| {
        [
            (sum[0] / weight - ORIGIN_SVG) * UNIT,
            (sum[1] / weight - ORIGIN_SVG) * UNIT,
        ]
    })
}
/// Two quiet marks on either side of the body at the scan's height.
pub fn scan_marks(m: &mut Mesh, f: &Frame) {
    let [row, a] = f.scan;
    if a < 0.005 {
        return;
    }
    let Some([back, front]) = body_edges(row) else {
        return;
    };
    let cam = &f.camera;
    let y = (FLOOR_SVG - row) * UNIT;
    for (from, to) in [(back - 0.085, back - 0.03), (front + 0.085, front + 0.03)] {
        let points = [[from, y, -0.01], [to, y, -0.01]];
        polyline(m, cam, &points, 0.0011, 0.0, &|i, _| {
            person(0.65 * a * i as f32)
        });
        if let Some(q) = cam.project([to, y, -0.01]) {
            m.disc(q.at, 0.004 * q.scale, cam.coc(q.depth), person(0.8 * a));
        }
    }
}

/// The card on screen: where it stands (top left, authored px).
pub const CARD_AT: [f32; 2] = [892.0, 646.0];
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
    let option_cap = if options.is_empty() {
        0.0
    } else {
        let width: f32 = options.iter().map(|r| ink_width(*r) / 44.0).sum::<f32>()
            + gap * (options.len() - 1) as f32;
        (CARD_WIDTH / width).min(19.0)
    };
    let lead = 16.0;
    let mut lines = Vec::with_capacity(rows.len());
    let x = CARD_AT[0] + CARD_PAD[0];
    let mut y = CARD_AT[1] + CARD_PAD[1];
    let mut right: f32 = x;
    let mut option_x = x;
    let mut options_started = false;
    for (row, kind) in rows {
        match kind {
            Kind::Lead | Kind::Key => {
                let cap = if *kind == Kind::Lead { lead } else { key };
                if *kind == Kind::Key && !lines.is_empty() {
                    y += 0.55 * cap;
                }
                lines.push(Line {
                    row: *row,
                    kind: *kind,
                    at: [x, y],
                    cap,
                });
                right = right.max(x + ink_width(*row) / 44.0 * cap);
                y += cap * if *kind == Kind::Lead { 1.25 } else { 1.0 } + 0.45 * lead;
            }
            Kind::Option(_) => {
                if !options_started {
                    y += 0.8 * option_cap;
                    options_started = true;
                }
                lines.push(Line {
                    row: *row,
                    kind: *kind,
                    at: [option_x, y],
                    cap: option_cap,
                });
                option_x += (ink_width(*row) / 44.0 + gap) * option_cap;
                right = right.max(option_x - gap * option_cap);
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
/// opens, a small tick, and under a possible starting point a mark while it
/// is lit.
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
/// The card's words: textured quads for the text program, wiped in from
/// the left as the card opens. `local` holds the atlas coordinates.
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
        let [ink0, ink1] = LABEL_INK[line.row];
        let pad = 6.0;
        // Capitals start 13 px below the band's top in a row (see the atlas).
        let top = line.at[1] - (42.0 - LABEL_BAND[0]) * per;
        let height = (LABEL_BAND[1] - LABEL_BAND[0]) * per;
        let left = line.at[0] - pad * per;
        let width = (ink1 - ink0 + 2.0 * pad) * per;
        let v0 = (line.row as f32 * 128.0 + LABEL_BAND[0]) / ATLAS[1];
        let v1 = (line.row as f32 * 128.0 + LABEL_BAND[1]) / ATLAS[1];
        let u0 = (ink0 - pad) / ATLAS[0];
        let u1 = (ink1 + pad) / ATLAS[0];
        let slices = 16;
        for s in 0..slices {
            let (s0, s1) = (s as f32 / slices as f32, (s + 1) as f32 / slices as f32);
            let shown = |x: f32| k * (1.0 - smooth(wipe - 0.25, wipe, x));
            let (c0, c1) = (person(shown(s0)), person(shown(s1)));
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

    #[test]
    fn every_card_fits_its_place() {
        for card in 0..5 {
            let (lines, [x0, y0, x1, y1]) = card_layout(card);
            assert!(!lines.is_empty());
            assert!(
                x1 < crate::SIZE[0] * 0.9 - 4.0,
                "card {card} right edge {x1}"
            );
            assert!(y1 < crate::SIZE[1] * 0.84, "card {card} bottom {y1}");
            assert!(x1 - x0 > 200.0 && y1 - y0 > 60.0);
            for l in &lines {
                assert!(l.cap >= 15.0, "card {card}: {} px capitals", l.cap);
            }
        }
    }

    #[test]
    fn the_body_has_edges_where_the_scan_passes() {
        for row in [40.0, 120.0, 250.0, 400.0, 500.0] {
            let [back, front] = body_edges(row).unwrap();
            assert!(front > back + 0.03, "{row}");
        }
    }

    #[test]
    fn a_frame_builds_without_gaps() {
        let s = Scene::new();
        for t in [0.0, 5.0, 6.8, 14.0, 27.0, 39.0, 50.0, 58.0] {
            let f = crate::compose(t);
            let mut m = Mesh::new(1000);
            floor(&mut m, &f);
            architecture(&mut m, &f);
            dust(&mut m, &s, &f, false);
            conclusion(&mut m, &s, &f);
            trace(&mut m, &f);
            start(&mut m, &f);
            voice(&mut m, &f);
            scan_marks(&mut m, &f);
            card(&mut m, &f);
            labels(&mut m, &f);
            assert_eq!(m.data.len() % (STRIDE * 3), 0);
            assert!(m.data.iter().all(|v| v.is_finite()), "{t}");
        }
    }
}
