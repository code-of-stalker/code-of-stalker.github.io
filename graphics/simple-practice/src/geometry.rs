//! Mesh generators. Every vertex carries the authored position (px), a local
//! coordinate for the soft profile, four channels and a lens shape: red is
//! the light of the room, green the light of the person (contact, weight,
//! presence, attention), blue the opaque body and alpha how much it hides
//! what is behind.
//!
//! The lens is applied here, primitive by primitive: a line or a speck at a
//! depth the camera does not focus on spreads into its circle of confusion
//! and dims by the same factor, so its light is conserved. The figure gets
//! the same radius in its own shader.
use crate::{
    hash, lerp3, smooth, torso_at, Camera, Frame, Projected, ANKLE, BALL, EYE, FIGURE, FLOOR_SVG,
    GAZE_AHEAD, GAZE_FLOOR, HEEL, HIP, KNEE, LOOP_SECONDS, TORSO_DEPTH, UNIT,
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
/// A circle lying on a horizontal plane.
fn circle(o: [f32; 3], r: f32, from: f32, to: f32, steps: usize) -> Vec<[f32; 3]> {
    (0..=steps)
        .map(|i| {
            let a = from + (to - from) * i as f32 / steps as f32;
            [o[0] + r * a.cos(), o[1], o[2] + r * a.sin()]
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
    pub grains: Vec<Grain>,
}
pub struct Mote {
    pub at: [f32; 3],
    pub glow: f32,
    pub phase: [f32; 3],
}
/// A particle of mass inside the torso: SVG row and position across it.
pub struct Grain {
    pub row: f32,
    pub across: f32,
    pub glow: f32,
    pub phase: f32,
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
        let grains = (0..170u32)
            .map(|i| {
                let r = |k: u32| hash(31000 + i * 11 + k);
                Grain {
                    row: 140.0 + 168.0 * r(1),
                    across: 0.12 + 0.76 * r(2),
                    glow: 0.4 + 0.6 * r(3),
                    phase: TAU * r(4),
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
    // The pool of light on the floor, under the person.
    if let Some(rim) = projected_circle(cam, POOL, POOL_RADIUS, 48) {
        if let Some(c) = cam.project(POOL) {
            m.fan(c.at, &rim, [0.1 * l, 0.03 * l, 0.0, 0.0], room(0.0));
        }
    }
    let near = cam.eye[2] + Camera::NEAR + 0.05;
    for i in -12..=12 {
        let x = i as f32 * 0.5;
        let a = [x, 0.0, near.max(-4.0)];
        segment(m, cam, a, [x, 0.0, 9.5], 32, 0.0028, room(0.16 * l));
    }
    for i in 0..=27 {
        let z = -4.0 + i as f32 * 0.5;
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
    // A finer weave around the feet: it shows in the close-ups.
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

/// Layers of support beneath the floor, and the lines that carry the weight
/// of the soles down through them.
pub fn support(m: &mut Mesh, f: &Frame) {
    if f.support < 0.01 {
        return;
    }
    let cam = &f.camera;
    let centre = [(HEEL[0] + BALL[0]) * 0.5, 0.0, 0.0];
    let reach = 1.7;
    for (layer, depth) in [0.3_f32, 0.7, 1.25].iter().enumerate() {
        // Deeper layers answer later: the support goes down.
        let on = f.support * smooth(layer as f32 * 0.22, layer as f32 * 0.22 + 0.45, f.support);
        if on < 0.01 {
            continue;
        }
        let y = -depth;
        let strength = 0.2 * on * (1.0 - 0.18 * layer as f32);
        let fade = |p: [f32; 3]| {
            let d = ((p[0] - centre[0]).powi(2) + (p[2] - centre[2]).powi(2)).sqrt();
            1.0 - smooth(0.2, reach, d)
        };
        for i in -6..=6 {
            let o = i as f32 * 0.25;
            let xs: Vec<[f32; 3]> = (0..=14)
                .map(|k| {
                    [
                        centre[0] + o,
                        y,
                        centre[2] - reach + 2.0 * reach * k as f32 / 14.0,
                    ]
                })
                .collect();
            polyline(m, cam, &xs, 0.0024, 0.0, &|k, _| {
                [
                    strength * 0.6 * fade(xs[k]),
                    strength * 0.4 * fade(xs[k]),
                    0.0,
                    0.0,
                ]
            });
            let zs: Vec<[f32; 3]> = (0..=14)
                .map(|k| {
                    [
                        centre[0] - reach + 2.0 * reach * k as f32 / 14.0,
                        y,
                        centre[2] + o,
                    ]
                })
                .collect();
            polyline(m, cam, &zs, 0.0024, 0.0, &|k, _| {
                [
                    strength * 0.6 * fade(zs[k]),
                    strength * 0.4 * fade(zs[k]),
                    0.0,
                    0.0,
                ]
            });
        }
        // Where a root passes the layer, the layer lights a little ring.
        for o in [HEEL, BALL] {
            let ring = circle([o[0], y, o[2]], 0.09 + 0.05 * layer as f32, 0.0, TAU, 32);
            polyline(m, cam, &ring, 0.003, 0.0, &|_, _| person(0.5 * on));
        }
    }
    // The weight is received: lines of force fan out from each sole down
    // into the ground, a pulse of light travelling along them.
    let reach_down = smooth(0.0, 0.85, f.support);
    for (i, o) in [HEEL, BALL].iter().enumerate() {
        for j in 0..12u32 {
            let seed = i as u32 * 31 + j;
            let a = (j as f32 / 12.0 + 0.06 * hash(seed)) * TAU;
            let spread = 0.4 + 0.6 * hash(seed + 7);
            let deep = 0.45 + 0.5 * hash(seed + 11);
            let end = [o[0] + spread * a.cos(), -deep, o[2] + spread * a.sin()];
            let n = 18;
            let points: Vec<[f32; 3]> = (0..=n)
                .map(|k| {
                    let u = reach_down * k as f32 / n as f32;
                    // Opening early, like roots under a tree: the weight spreads.
                    let open = 1.0 - (1.0 - u) * (1.0 - u);
                    [
                        o[0] + (end[0] - o[0]) * open,
                        end[1] * u.powf(0.8),
                        o[2] + (end[2] - o[2]) * open,
                    ]
                })
                .collect();
            let flow = (f.time * 0.55 + hash(seed + 3)).fract();
            polyline(m, cam, &points, 0.0012, 0.0, &|k, _| {
                let u = k as f32 / n as f32;
                let pulse = (-((u - flow) * 7.0).powi(2)).exp();
                let body = smooth(0.0, 0.12, u) * (1.0 - u);
                [
                    0.05 * f.support * body,
                    f.support * body * (0.06 + 0.26 * pulse),
                    0.0,
                    0.0,
                ]
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
            // The foot of the column takes a little of the pool's light.
            let foot = [
                0.05 * l * k_fog * in_cone([near_edge, 0.0, z]).max(0.3),
                0.0,
                0.5 * k_fog,
                k_fog,
            ];
            m.gradient([d.at, c.at, b.at, a.at], [shade, shade, foot, foot]);
            // The side turned to the person, lit from the top light.
            if let (Some(e), Some(g)) = (
                cam.project([near_edge, 0.0, z + half]),
                cam.project([near_edge, 3.6, z + half]),
            ) {
                let lit = 0.06 * l * k_fog;
                let top = [lit * 0.5, 0.0, 0.5 * k_fog, k_fog];
                let low = [lit * 1.4, 0.0, 0.5 * k_fog, k_fog];
                m.gradient([c.at, g.at, e.at, b.at], [top, top, low, low]);
            }
            // The edge turned to the light catches it.
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
            // Base and capital lines.
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
    // The far wall: tall panels in the haze.
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

/// Dust in the air, lit inside the cone of the top light.
pub fn dust(m: &mut Mesh, s: &Scene, f: &Frame, nearer_than: Option<f32>) {
    let cam = &f.camera;
    let w = f.time / LOOP_SECONDS * TAU;
    for mote in &s.motes {
        let d = 0.05 * f.stir;
        let p = [
            mote.at[0] + d * (w * 2.0 + mote.phase[0]).sin() + 0.03 * (w + mote.phase[2]).sin(),
            mote.at[1] + d * (w * 3.0 + mote.phase[1]).sin()
                - 0.02 * (w * 4.0 + mote.phase[0]).cos(),
            mote.at[2] + d * (w * 2.0 + mote.phase[2]).cos(),
        ];
        // Split around the person: behind first, in front after the figure.
        let front = p[2] < 0.0;
        if front != nearer_than.is_some() {
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

/// The figure's quad in the world (the figure program draws it):
/// corners and texture coordinates, with an optional rotation and lift.
pub fn figure_quad(m: &mut Mesh, cam: &Camera, lift: [f32; 2], turn: f32, mirrored: bool) -> bool {
    let pivot = [0.05, 0.0];
    let (sin, cos) = turn.sin_cos();
    let corner = |x: f32, y: f32| {
        let (dx, dy) = (x - pivot[0], y - pivot[1]);
        let p = [
            pivot[0] + dx * cos - dy * sin + lift[0],
            pivot[1] + dx * sin + dy * cos + lift[1],
            0.0,
        ];
        let p = if mirrored { [p[0], -p[1], p[2]] } else { p };
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
/// The scattered copies of the person (lift in metres, turn in radians).
pub const SCATTER: [([f32; 2], f32); 3] = [
    ([-0.045, 0.07], -0.06),
    ([0.06, 0.11], 0.045),
    ([-0.015, 0.17], 0.075),
];

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

/// Imprints of the soles on the floor while they are felt.
pub fn imprints(m: &mut Mesh, f: &Frame) {
    if f.soles < 0.01 {
        return;
    }
    let cam = &f.camera;
    for (o, rx, rz) in [(HEEL, 0.05, 0.035), (BALL, 0.075, 0.042)] {
        let rim: Option<Vec<[f32; 2]>> = (0..28)
            .map(|i| {
                let a = i as f32 / 28.0 * TAU;
                cam.project([o[0] + rx * a.cos(), 0.0, o[2] + rz * a.sin()])
                    .map(|q| q.at)
            })
            .collect();
        if let (Some(rim), Some(c)) = (rim, cam.project(o)) {
            m.fan(c.at, &rim, person(0.5 * f.soles), person(0.0));
        }
    }
}

/// The gaze: a faint beam from the open eye to where it rests, and the
/// glint of the eye itself.
pub fn gaze(m: &mut Mesh, f: &Frame) {
    let cam = &f.camera;
    let eye = [EYE[0] + 0.004, EYE[1], EYE[2] - 0.02];
    let target = lerp3(GAZE_AHEAD, GAZE_FLOOR, f.gaze);
    let n = 14;
    let points: Vec<[f32; 3]> = (0..=n)
        .map(|i| lerp3(eye, target, i as f32 / n as f32))
        .collect();
    let mut beam = Vec::with_capacity(n + 1);
    let mut line = Vec::with_capacity(n + 1);
    for (i, p) in points.iter().enumerate() {
        let Some(q) = cam.project(*p) else { continue };
        let u = i as f32 / n as f32;
        let half = (0.003 + 0.05 * u) * q.scale;
        let k = f.gaze_light * smooth(0.0, 0.1, u) * (1.0 - 0.6 * u);
        beam.push(Dot {
            at: q.at,
            half: 0.25 * half,
            coc: half + cam.coc(q.depth),
            color: person(0.07 * k),
        });
        // The line of sight itself: fine, quiet.
        line.push(Dot {
            at: q.at,
            half: 0.0008 * q.scale,
            coc: cam.coc(q.depth),
            color: person(0.22 * k * (1.0 - u)),
        });
    }
    m.strip(&beam);
    let dots = line;
    m.strip(&dots);
    // Where the lowered eyes rest on the floor.
    let rest = f.gaze_light * smooth(0.75, 1.0, f.gaze);
    if rest > 0.01 {
        if let (Some(rim), Some(c)) = (
            projected_circle(cam, GAZE_FLOOR, 0.13, 32),
            cam.project(GAZE_FLOOR),
        ) {
            m.fan(c.at, &rim, person(0.14 * rest), person(0.0));
        }
    }
    if let Some(q) = cam.project(eye) {
        let coc = cam.coc(q.depth);
        m.glow(q.at, 0.03 * q.scale + coc, person(0.1 * f.eye));
        m.disc(q.at, 0.0045 * q.scale, coc, person(0.9 * f.eye));
    }
}

/// Weight flowing down the legs: light sinks from the hips through the
/// knees and shins into the soles, faster as it falls.
pub fn weight(m: &mut Mesh, f: &Frame) {
    if f.weight < 0.01 {
        return;
    }
    let cam = &f.camera;
    let path = [HIP, KNEE, ANKLE, [(HEEL[0] + BALL[0]) * 0.5, 0.012, 0.0]];
    let lengths: Vec<f32> = path
        .windows(2)
        .map(|w| ((w[1][0] - w[0][0]).powi(2) + (w[1][1] - w[0][1]).powi(2)).sqrt())
        .collect();
    let total: f32 = lengths.iter().sum();
    let at = |u: f32| {
        let mut s = u.clamp(0.0, 1.0) * total;
        for (i, l) in lengths.iter().enumerate() {
            if s <= *l || i == lengths.len() - 1 {
                let p = lerp3(path[i], path[i + 1], (s / l).min(1.0));
                return [p[0], p[1], -0.012];
            }
            s -= l;
        }
        path[path.len() - 1]
    };
    for i in 0..56u32 {
        let phase = hash(400 + i);
        let u = (f.time * 0.3 + phase).fract();
        // Gravity: slow at the hip, quick into the feet.
        let fall = u * u;
        let k = 0.7 * f.weight * (PI * u).sin().powf(0.7) * (0.4 + 0.6 * hash(500 + i));
        let side = (hash(600 + i) - 0.5) * 0.07;
        let mut p = at(fall);
        p[0] += side * (1.0 - fall);
        let Some(q) = cam.project(p) else { continue };
        let coc = cam.coc(q.depth);
        m.disc(
            q.at,
            (0.0018 + 0.0022 * hash(700 + i)) * q.scale,
            coc,
            person(0.75 * k),
        );
        let tail: Vec<[f32; 3]> = (0..6)
            .map(|j| {
                let mut t = at(fall - 0.05 * j as f32 * (0.3 + fall));
                t[0] += side * (1.0 - fall);
                t
            })
            .collect();
        polyline(m, cam, &tail, 0.0025, 0.0, &|j, _| {
            person(0.3 * k * (1.0 - j as f32 / 6.0))
        });
    }
}

/// Cross-sections of the torso: rings travel from the shoulders to the
/// pelvis and the torso stops being a drawing, it gets a volume.
pub fn scan(m: &mut Mesh, f: &Frame) {
    if f.scan_light < 0.01 {
        return;
    }
    let cam = &f.camera;
    let rows = 9;
    for i in 0..rows {
        let u = i as f32 / (rows - 1) as f32;
        let row = 140.0 + 168.0 * u;
        let reached = smooth(u - 0.04, u + 0.04, f.scan * 1.08);
        if reached < 0.01 {
            continue;
        }
        let fresh = (-((f.scan * 1.08 - u) * 9.0).powi(2)).exp();
        let Some([back, front]) = torso_at(row) else {
            continue;
        };
        let y = (FLOOR_SVG - row) * UNIT;
        let cx = ((back + front) * 0.5 - crate::ORIGIN_SVG) * UNIT;
        let rx = (front - back) * 0.5 * UNIT;
        let rz = rx * TORSO_DEPTH;
        let k = f.scan_light * reached * (0.28 + 0.72 * fresh);
        let ring: Vec<[f32; 3]> = (0..=48)
            .map(|j| {
                let a = j as f32 / 48.0 * TAU;
                [cx + rx * a.cos(), y, rz * a.sin()]
            })
            .collect();
        polyline(m, cam, &ring, 0.0016, 0.0, &|j, _| {
            let a = j as f32 / 48.0 * TAU;
            // The near half bright, the far half seen through the body.
            let near = 0.5 - 0.5 * a.sin();
            [0.22 * k, k * (0.22 + 0.6 * near), 0.0, 0.0]
        });
        // The freshest section glows across: an area, a volume, not a line.
        if fresh > 0.05 {
            let rim: Option<Vec<[f32; 2]>> = ring[..48]
                .iter()
                .map(|p| cam.project(*p).map(|q| q.at))
                .collect();
            if let (Some(rim), Some(c)) = (rim, cam.project([cx, y, 0.0])) {
                m.fan(
                    c.at,
                    &rim,
                    person(0.12 * k * fresh),
                    person(0.03 * k * fresh),
                );
            }
        }
    }
}

/// Mass inside the torso: specks shimmer like an image, then sink and
/// settle as weight.
pub fn mass(m: &mut Mesh, s: &Scene, f: &Frame) {
    if f.mass < 0.01 {
        return;
    }
    let cam = &f.camera;
    let bottom = 312.0;
    for g in &s.grains {
        let jitter = 1.0 - f.settled;
        let row = g.row
            + (bottom - 6.0 - (bottom - g.row) * 0.32 - g.row) * f.settled
            + 3.0 * jitter * (f.time * 3.1 + g.phase).sin();
        let Some([back, front]) = torso_at(row.clamp(TORSO_TOP, bottom)) else {
            continue;
        };
        let across = g.across + 0.03 * jitter * (f.time * 2.3 + g.phase * 2.0).cos();
        let x = back + 4.0 + (front - back - 8.0) * across;
        let p = [
            (x - crate::ORIGIN_SVG) * UNIT,
            (FLOOR_SVG - row) * UNIT,
            -0.01,
        ];
        let Some(q) = cam.project(p) else { continue };
        let k = f.mass * g.glow * (0.55 + 0.45 * f.settled);
        m.disc(
            q.at,
            0.0021 * q.scale,
            cam.coc(q.depth),
            [0.12 * k, 0.5 * k, 0.0, 0.0],
        );
    }
}
const TORSO_TOP: f32 = 135.0;

/// The pictures of imagination: framed images that rise from the head.
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
/// Card: picture, where it floats to (relative to the eye, metres), stagger.
const CARDS: [(Picture, [f32; 3], f32); 8] = [
    (Picture::Mountains, [0.22, 0.42, 0.75], 0.0),
    (Picture::House, [-0.34, 0.33, 0.35], 0.08),
    (Picture::Waves, [0.5, 0.18, -0.3], 0.16),
    (Picture::Heart, [-0.1, 0.62, 1.4], 0.24),
    (Picture::Tree, [0.7, 0.5, 1.9], 0.3),
    (Picture::Star, [-0.56, 0.1, -0.12], 0.36),
    (Picture::Sun, [0.3, 0.12, -1.05], 0.4),
    (Picture::Mountains, [-0.62, 0.55, 2.6], 0.44),
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
            arc([0.76, 0.32], 0.09, 0.0, TAU, 16),
        ],
        Picture::House => vec![
            vec![
                [0.22, 0.18],
                [0.22, 0.52],
                [0.5, 0.78],
                [0.78, 0.52],
                [0.78, 0.18],
                [0.22, 0.18],
            ],
            vec![[0.42, 0.18], [0.42, 0.4], [0.58, 0.4], [0.58, 0.18]],
        ],
        Picture::Waves => (0..3)
            .map(|k| {
                (0..=16)
                    .map(|i| {
                        let x = 0.08 + 0.84 * i as f32 / 16.0;
                        [x, 0.3 + 0.2 * k as f32 + 0.06 * (x * 14.0 + k as f32).sin()]
                    })
                    .collect()
            })
            .collect(),
        Picture::Tree => vec![
            vec![[0.5, 0.14], [0.5, 0.46]],
            arc([0.5, 0.6], 0.2, 0.0, TAU, 20),
            vec![[0.12, 0.14], [0.88, 0.14]],
        ],
        Picture::Heart => vec![(0..=28)
            .map(|i| {
                let a = i as f32 / 28.0 * TAU;
                let x = 16.0 * a.sin().powi(3);
                let y = 13.0 * a.cos()
                    - 5.0 * (2.0 * a).cos()
                    - 2.0 * (3.0 * a).cos()
                    - (4.0 * a).cos();
                [0.5 + x * 0.021, 0.5 + y * 0.021]
            })
            .collect()],
        Picture::Sun => {
            let mut lines = vec![arc([0.5, 0.5], 0.17, 0.0, TAU, 20)];
            for k in 0..8 {
                let a = k as f32 / 8.0 * TAU;
                lines.push(vec![
                    [0.5 + 0.25 * a.cos(), 0.5 + 0.25 * a.sin()],
                    [0.5 + 0.36 * a.cos(), 0.5 + 0.36 * a.sin()],
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
/// World position, width and light of a card at this frame.
pub fn card(f: &Frame, index: usize) -> ([f32; 3], f32, f32) {
    let (_, to, stagger) = CARDS[index];
    let p = smooth(stagger, stagger + 0.55, f.images);
    let start = [EYE[0] - 0.05, EYE[1] + 0.03, 0.0];
    let w = f.time * 0.9 + index as f32 * 1.7;
    let mut at = lerp3(start, [EYE[0] + to[0], EYE[1] + to[1], to[2]], p);
    at[0] += 0.015 * w.sin();
    at[1] += 0.02 * (w * 0.8).cos();
    // The turn: the images lose the attention, sink back and away.
    at[1] += 0.25 * f.retreat;
    at[2] += 2.8 * f.retreat * (0.6 + 0.4 * hash(80 + index as u32));
    let light = f.images_light * smooth(0.0, 0.25, p) * (1.0 - 0.5 * f.retreat);
    (at, 0.15 * (0.35 + 0.65 * p), light)
}
/// The cards behind (`behind` true: z ≥ 0) or in front of the figure.
pub fn images(m: &mut Mesh, f: &Frame, behind: bool) {
    if f.images_light < 0.01 {
        return;
    }
    let cam = &f.camera;
    for (i, (kind, _, _)) in CARDS.iter().enumerate() {
        let (at, width, light) = card(f, i);
        if (at[2] >= 0.0) != behind || light < 0.01 {
            continue;
        }
        let height = width * 0.74;
        let to_world = |u: [f32; 2]| {
            [
                at[0] + (u[0] - 0.5) * width,
                at[1] + (u[1] - 0.5) * height,
                at[2],
            ]
        };
        let corners: Vec<[f32; 3]> = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
            .iter()
            .map(|u| to_world(*u))
            .collect();
        let Some(q) = cam.project(at) else { continue };
        let coc = cam.coc(q.depth);
        // A faint screen of the picture: imagination glows by itself.
        let screen: Option<Vec<[f32; 2]>> = corners
            .iter()
            .map(|p| cam.project(*p).map(|q| q.at))
            .collect();
        if let Some(s) = screen {
            let glow = room(0.07 * light / (1.0 + coc * 0.05));
            m.gradient(
                [s[0], s[1], s[2], s[3]],
                [scale(glow, 0.5), scale(glow, 0.8), glow, scale(glow, 0.7)],
            );
        }
        let mut frame = corners.clone();
        frame.push(corners[0]);
        polyline(m, cam, &frame, 0.0012, 0.0, &|_, _| room(0.75 * light));
        for line in picture(*kind) {
            let points: Vec<[f32; 3]> = line
                .iter()
                .map(|u| to_world([0.1 + 0.8 * u[0], 0.1 + 0.8 * u[1]]))
                .collect();
            polyline(m, cam, &points, 0.001, 0.0, &|_, _| room(0.6 * light));
        }
    }
}
/// Threads from the head to the images; they snap and recoil at the turn.
pub fn threads(m: &mut Mesh, f: &Frame) {
    let visible = f.threads.max(if f.snap > 0.0 && f.snap < 1.0 {
        1.0 - f.snap
    } else {
        0.0
    });
    if visible < 0.01 || f.images_light < 0.01 {
        return;
    }
    let cam = &f.camera;
    let root = [EYE[0] - 0.06, EYE[1] + 0.07, 0.0];
    for i in 0..CARDS.len() {
        let (at, width, light) = card(f, i);
        let end = [at[0] - width * 0.5, at[1] - width * 0.37, at[2]];
        let n = 18;
        let wave = f.time * 4.0 + i as f32;
        let point = |u: f32| {
            let mut p = lerp3(root, end, u);
            // A slack thread sags a little and trembles.
            p[1] -= 0.04 * (PI * u).sin();
            p[0] += 0.006 * (wave + u * 9.0).sin() * (PI * u).sin();
            p
        };
        // After the snap each half recoils towards its own end.
        let gap = smooth(0.0, 1.0, f.snap);
        let cut = 0.45 + 0.1 * hash(90 + i as u32);
        let spans = if f.snap > 0.0 {
            vec![(0.0, cut * (1.0 - gap)), (cut + (1.0 - cut) * gap, 1.0)]
        } else {
            vec![(0.0, 1.0)]
        };
        let k = 0.38
            * light
            * if f.snap > 0.0 {
                1.0 - f.snap
            } else {
                f.threads
            };
        for (a, b) in spans {
            if b - a < 0.01 {
                continue;
            }
            let points: Vec<[f32; 3]> = (0..=n)
                .map(|j| point(a + (b - a) * j as f32 / n as f32))
                .collect();
            polyline(m, cam, &points, 0.0009, 0.0, &|_, _| room(k));
        }
    }
}

/// The attention: a light that leaves through the eyes and comes back down.
pub fn mote(m: &mut Mesh, f: &Frame) {
    if f.mote_light < 0.01 {
        return;
    }
    let cam = &f.camera;
    let trail: Vec<[f32; 3]> = (0..10)
        .map(|j| crate::compose_mote(f.time - 0.035 * j as f32))
        .collect();
    polyline(m, cam, &trail, 0.003, 0.0, &|j, _| {
        person(0.35 * f.mote_light * (1.0 - j as f32 / 10.0))
    });
    if let Some(q) = cam.project([f.mote[0], f.mote[1], f.mote[2] - 0.015]) {
        let coc = cam.coc(q.depth);
        m.glow(q.at, 0.05 * q.scale + coc, person(0.16 * f.mote_light));
        m.disc(q.at, 0.007 * q.scale, coc, person(1.1 * f.mote_light));
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

/// Ink strength of the scattered copies.
pub fn scatter_alpha(f: &Frame) -> f32 {
    0.55 * f.scatter
}
