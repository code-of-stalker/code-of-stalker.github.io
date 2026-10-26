//! Mesh generators. Every vertex carries the authored position (px), a local
//! coordinate for the soft profile or a texture, four light channels and a
//! hardness: red is the voice, green the self (contour, being heard), blue
//! the opaque body and alpha how much it hides what is behind.
use crate::{
    bell, hash, smooth, Camera, Frame, Wave, CHEST, EAR, FEET, FIGURE, LABEL_INK, LABEL_ROW, MOUTH,
    PLATES, PLATE_SIZE, SIZE,
};
use std::f32::consts::{PI, TAU};

pub const STRIDE: usize = 9;
pub type Color = [f32; 4];

#[derive(Default)]
pub struct Mesh {
    pub data: Vec<f32>,
}
impl Mesh {
    pub fn clear(&mut self) {
        self.data.clear();
    }
    pub fn vertices(&self) -> i32 {
        (self.data.len() / STRIDE) as i32
    }
    fn vertex(&mut self, p: [f32; 2], uv: [f32; 2], c: Color, hard: f32) {
        self.data
            .extend_from_slice(&[p[0], p[1], uv[0], uv[1], c[0], c[1], c[2], c[3], hard]);
    }
    /// Two triangles: corners in order a b c d.
    pub fn quad(&mut self, p: [[f32; 2]; 4], uv: [[f32; 2]; 4], c: Color, hard: f32) {
        for i in [0, 1, 2, 0, 2, 3] {
            self.vertex(p[i], uv[i], c, hard);
        }
    }
    /// A round soft light (hard 0) or a lens bokeh disc (hard → 1).
    pub fn disc(&mut self, at: [f32; 2], r: [f32; 2], c: Color, hard: f32) {
        self.quad(
            [
                [at[0] - r[0], at[1] - r[1]],
                [at[0] + r[0], at[1] - r[1]],
                [at[0] + r[0], at[1] + r[1]],
                [at[0] - r[0], at[1] + r[1]],
            ],
            [[-1.0, -1.0], [1.0, -1.0], [1.0, 1.0], [-1.0, 1.0]],
            c,
            hard,
        );
    }
    /// A flat polygon fan (convex), full strength everywhere.
    pub fn fan(&mut self, p: &[[f32; 2]], c: Color) {
        for i in 1..p.len().saturating_sub(1) {
            for q in [p[0], p[i], p[i + 1]] {
                self.vertex(q, [0.0, 0.0], c, 1.0);
            }
        }
    }
    /// A polyline with per-point half width and color; soft across.
    pub fn strip(&mut self, p: &[[f32; 2]], width: &[f32], color: &[Color], hard: f32) {
        if p.len() < 2 {
            return;
        }
        let normal = |i: usize| {
            let a = p[i.saturating_sub(1)];
            let b = p[(i + 1).min(p.len() - 1)];
            let (dx, dy) = (b[0] - a[0], b[1] - a[1]);
            let l = (dx * dx + dy * dy).sqrt().max(1e-4);
            [-dy / l, dx / l]
        };
        for i in 0..p.len() - 1 {
            let (na, nb) = (normal(i), normal(i + 1));
            let (wa, wb) = (width[i], width[i + 1]);
            let a0 = [p[i][0] + na[0] * wa, p[i][1] + na[1] * wa];
            let a1 = [p[i][0] - na[0] * wa, p[i][1] - na[1] * wa];
            let b0 = [p[i + 1][0] + nb[0] * wb, p[i + 1][1] + nb[1] * wb];
            let b1 = [p[i + 1][0] - nb[0] * wb, p[i + 1][1] - nb[1] * wb];
            for (q, u, c) in [
                (a0, 1.0, color[i]),
                (b0, 1.0, color[i + 1]),
                (b1, -1.0, color[i + 1]),
                (a0, 1.0, color[i]),
                (b1, -1.0, color[i + 1]),
                (a1, -1.0, color[i]),
            ] {
                self.vertex(q, [0.0, u], c, hard);
            }
        }
    }
    /// A line of constant color: a sharp core and a wide soft halo.
    pub fn glow_line(&mut self, p: &[[f32; 2]], fade: &[f32], core: f32, c: Color, halo: f32) {
        let n = p.len();
        let colors: Vec<Color> = fade.iter().map(|f| scale(c, *f)).collect();
        if halo > 0.0 {
            let soft: Vec<Color> = colors.iter().map(|c| scale(*c, 0.16)).collect();
            self.strip(p, &vec![core * 7.0; n], &soft, 0.0);
        }
        self.strip(p, &vec![core; n], &colors, 0.35);
    }
}
fn scale(c: Color, k: f32) -> Color {
    [c[0] * k, c[1] * k, c[2] * k, c[3] * k]
}

/// Fixed particle field: a volume of dust the voice passes through.
pub struct Scene {
    pub motes: Vec<Mote>,
}
pub struct Mote {
    pub at: [f32; 3],
    pub glow: f32,
    pub phase: [f32; 2],
    pub warm: f32,
}
impl Default for Scene {
    fn default() -> Self {
        Self::new()
    }
}
impl Scene {
    pub fn new() -> Self {
        let mut motes = Vec::with_capacity(760);
        for i in 0..740u32 {
            let r = |k: u32| hash(i * 13 + k);
            motes.push(Mote {
                at: [
                    -1.4 + 9.0 * r(1),
                    0.05 + 4.9 * r(2).powf(0.85),
                    -0.9 + 11.5 * r(3).powf(0.8),
                ],
                glow: 0.05 + 0.2 * r(4).powi(3),
                phase: [TAU * r(5), TAU * r(6)],
                warm: r(7),
            });
        }
        // A few out-of-focus specks right in front of the lens.
        for i in 0..16u32 {
            let r = |k: u32| hash(9000 + i * 17 + k);
            motes.push(Mote {
                at: [-2.6 + 5.6 * r(1), 0.4 + 3.4 * r(2), -3.0 + 0.9 * r(3)],
                glow: 0.25 + 0.3 * r(4),
                phase: [TAU * r(5), TAU * r(6)],
                warm: r(7),
            });
        }
        Self { motes }
    }
}

/// How strongly the fronts light a point: (voice, echo).
fn fronts(waves: &[Wave], p: [f32; 3], width: f32) -> (f32, f32) {
    let mut voice = 0.0;
    let mut echo = 0.0;
    for w in waves {
        let d = [p[0] - w.origin[0], p[1] - w.origin[1], p[2] - w.origin[2]];
        let r = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt();
        let miss = (r - w.radius) / width;
        let shell = (-miss * miss).exp() * w.strength;
        if w.echo {
            // The echo travels back, towards the listener.
            let to = [
                EAR[0] - w.origin[0],
                EAR[1] - w.origin[1],
                EAR[2] - w.origin[2],
            ];
            let l = (to[0] * to[0] + to[1] * to[1] + to[2] * to[2]).sqrt();
            let along = (d[0] * to[0] + d[1] * to[1] + d[2] * to[2]) / (l * r.max(1e-3));
            echo += shell * smooth(0.1, 0.8, along);
        } else {
            voice += shell * smooth(-0.35, 0.55, d[0] / r.max(1e-3));
        }
    }
    (voice, echo)
}

pub fn background(m: &mut Mesh) {
    m.quad(
        [
            [0.0, 0.0],
            [SIZE[0], 0.0],
            [SIZE[0], SIZE[1]],
            [0.0, SIZE[1]],
        ],
        [
            [0.0, 0.0],
            [SIZE[0], 0.0],
            [SIZE[0], SIZE[1]],
            [0.0, SIZE[1]],
        ],
        [0.0; 4],
        0.0,
    );
}

fn line3(
    m: &mut Mesh,
    cam: &Camera,
    a: [f32; 3],
    b: [f32; 3],
    steps: usize,
    look: impl Fn([f32; 3]) -> (f32, Color),
    px: f32,
) {
    let mut p = Vec::with_capacity(steps + 1);
    let mut w = Vec::with_capacity(steps + 1);
    let mut c = Vec::with_capacity(steps + 1);
    for i in 0..=steps {
        let t = i as f32 / steps as f32;
        let q = [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
        ];
        if let Some((s, _)) = cam.project(q) {
            let (width, color) = look(q);
            p.push(s);
            w.push(width.max(0.7 / px));
            c.push(color);
        }
    }
    m.strip(&p, &w, &c, 0.0);
}

/// Floor grid fading into the depth, ripples where the fronts meet the
/// floor, and the grounded light under the feet and chair.
pub fn floor(m: &mut Mesh, f: &Frame, px: f32) {
    let cam = &f.camera;
    let fog = |z: f32| (-(z - cam.eye[2] - 3.0).max(0.0) / 9.0).exp();
    let grid = |q: [f32; 3]| {
        let (v, e) = fronts(&f.waves, q, 0.3);
        let k = 0.07 * fog(q[2]) * smooth(-1.2, 0.5, q[2]);
        (0.9, [k * (1.0 + 5.0 * v), k * 4.0 * e, 0.0, 0.0])
    };
    for i in -12..=18 {
        let x = i as f32 * 0.5;
        line3(m, cam, [x, 0.0, -2.0], [x, 0.0, 15.0], 24, grid, px);
    }
    for i in 0..30 {
        let z = -1.5 + i as f32 * 0.55;
        line3(m, cam, [-7.0, 0.0, z], [10.0, 0.0, z], 24, grid, px);
    }
    // The light under the soles: contact with the ground.
    for (x, r, k) in [(FEET[0], 0.55, 1.0), (FEET[0] - 1.25, 0.7, 0.6)] {
        if let Some((at, s)) = cam.project([x, 0.0, 0.0]) {
            let glow = 0.16 + 0.1 * f.breath + 0.25 * f.heard;
            m.disc(
                at,
                [r * s, r * s * 0.16],
                [glow * k * 0.6, glow * k * 0.4, 0.0, 0.0],
                0.0,
            );
        }
    }
    // Wave meets the floor: a widening ellipse in perspective.
    for w in &f.waves {
        let h = w.origin[1];
        if w.radius <= h {
            continue;
        }
        let r = (w.radius * w.radius - h * h).sqrt();
        let (from, to) = if w.echo {
            (0.55 * PI, 1.45 * PI)
        } else {
            (-0.5 * PI, 0.5 * PI)
        };
        let mut p = Vec::new();
        let mut fade = Vec::new();
        for i in 0..=48 {
            let a = from + (to - from) * i as f32 / 48.0;
            let q = [w.origin[0] + r * a.cos(), 0.0, w.origin[2] + r * a.sin()];
            if let Some((s, _)) = cam.project(q) {
                p.push(s);
                fade.push((PI * i as f32 / 48.0).sin().powf(0.7) * fog(q[2]));
            }
        }
        let k = 0.4 * w.strength * smooth(h, h + 0.6, w.radius);
        let c = if w.echo {
            [0.0, k, 0.0, 0.0]
        } else {
            [k, 0.0, 0.0, 0.0]
        };
        m.glow_line(&p, &fade, 1.0 / px.max(0.5), c, 1.0);
    }
}

/// Dust whose world depth lies in (near, far].
pub fn motes(m: &mut Mesh, s: &Scene, f: &Frame, near: f32, far: f32, px: f32) {
    let cam = &f.camera;
    let focus = 7.0;
    for (i, mote) in s.motes.iter().enumerate() {
        if mote.at[2] <= near || mote.at[2] > far {
            continue;
        }
        let w = f.time / crate::LOOP_SECONDS * TAU;
        let k = 1.0 + (i % 3) as f32;
        let mut p = [
            mote.at[0] + 0.07 * (k * w + mote.phase[0]).sin(),
            mote.at[1] + 0.05 * ((4.0 - k) * w + mote.phase[1]).sin(),
            mote.at[2],
        ];
        let (voice, echo) = fronts(&f.waves, p, 0.22);
        // The front nudges the dust outwards as it passes.
        let d = [p[0] - MOUTH[0], p[1] - MOUTH[1], p[2] - MOUTH[2]];
        let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt().max(1e-3);
        for (j, v) in d.iter().enumerate() {
            p[j] += v / l * 0.06 * voice;
        }
        let Some((at, scale)) = cam.project(p) else {
            continue;
        };
        let depth = cam.depth(p);
        let sharp = 1.6 + 2.0 * scale / 160.0;
        let blur = (34.0 * (depth - focus).abs() / depth).min(110.0);
        let r = (sharp * sharp + blur * blur).sqrt();
        let energy = (sharp / r).powi(2).max(0.012);
        let fog = (-(depth - 6.0).max(0.0) / 10.0).exp();
        let base = mote.glow * (0.6 + 0.4 * f.ambient);
        let lit = energy * fog;
        let red = lit * (base * (0.55 + 0.45 * mote.warm) + 1.4 * voice);
        let green = lit * (base * 0.35 * (1.0 - mote.warm) + 1.6 * echo);
        if red + green < 0.004 {
            continue;
        }
        let r = r.max(1.1 / px);
        m.disc(
            at,
            [r, r],
            [red, green, 0.0, 0.0],
            if blur > 6.0 { 0.72 } else { 0.0 },
        );
    }
}

fn plate_corners(cam: &Camera, i: usize) -> Option<([f32; 2], f32)> {
    cam.project(PLATES[i])
}
fn fog_at(cam: &Camera, p: [f32; 3]) -> f32 {
    (-(cam.depth(p) - 6.0).max(0.0) / 9.0).exp()
}
/// The glass card of one state: body, contour, a lit tick and a scan line.
pub fn plate(m: &mut Mesh, f: &Frame, i: usize, answering: bool, px: f32) {
    let cam = &f.camera;
    let Some((c, s)) = plate_corners(cam, i) else {
        return;
    };
    let lit = f.plates[i];
    let fog = fog_at(cam, PLATES[i]);
    let (w, h) = (PLATE_SIZE[0] * s * 0.5, PLATE_SIZE[1] * s * 0.5);
    let cut = 0.2 * h * 2.0;
    let outline = [
        [c[0] - w, c[1] - h],
        [c[0] + w - cut, c[1] - h],
        [c[0] + w, c[1] - h + cut],
        [c[0] + w, c[1] + h],
        [c[0] - w + cut, c[1] + h],
        [c[0] - w, c[1] + h - cut],
    ];
    // Dark glass: hides part of what is behind it.
    m.fan(&outline, [0.025 * lit * fog, 0.0, 0.55, 0.55]);
    // A faint inner glow while it rings.
    m.disc(
        c,
        [w * 1.05, h * 1.6],
        [0.12 * lit * fog, 0.0, 0.0, 0.0],
        0.0,
    );
    let mut ring: Vec<[f32; 2]> = outline.to_vec();
    ring.push(outline[0]);
    let ink = (0.22 + 0.78 * lit) * fog;
    let fade = vec![1.0; ring.len()];
    m.glow_line(&ring, &fade, 0.75 / px.max(0.5), [ink, 0.0, 0.0, 0.0], lit);
    // Inner bevel, offset inwards, much quieter.
    let inset: Vec<[f32; 2]> = ring
        .iter()
        .map(|p| [c[0] + (p[0] - c[0]) * 0.965, c[1] + (p[1] - c[1]) * 0.86])
        .collect();
    m.glow_line(
        &inset,
        &fade,
        0.5 / px.max(0.5),
        [ink * 0.3, 0.0, 0.0, 0.0],
        0.0,
    );
    // The tick at the lower left lights first.
    let tick = [
        [c[0] - w + cut * 1.4, c[1] + h * 0.62],
        [c[0] - w + cut * 3.2, c[1] + h * 0.62],
    ];
    m.glow_line(
        &tick,
        &[1.0, 1.0],
        1.1 / px.max(0.5),
        [(0.2 + 0.8 * lit) * fog, 0.0, 0.0, 0.0],
        1.0,
    );
    // Corner ticks outside the card: the instrument's registration marks.
    let mark = 0.18 * h;
    for (corner, dx, dy) in [(outline[0], -1.0, -1.0), (outline[3], 1.0, 1.0)] {
        let o = [corner[0] + dx * mark * 1.5, corner[1] + dy * mark * 1.5];
        m.glow_line(
            &[
                [o[0], o[1] - dy * mark * 3.0],
                o,
                [o[0] - dx * mark * 3.0, o[1]],
            ],
            &[1.0; 3],
            0.5 / px.max(0.5),
            [ink * 0.55, 0.0, 0.0, 0.0],
            0.0,
        );
    }
    if answering && f.scan[2] > 0.0 {
        let x = c[0] - w + 2.0 * w * f.scan[0];
        let a = f.scan[2] * fog;
        m.glow_line(
            &[[x, c[1] - h * 1.35], [x, c[1] + h * 1.35]],
            &[0.0, 1.0],
            1.0 / px.max(0.5),
            [a, 0.0, 0.0, 0.0],
            1.0,
        );
    }
}
/// The label of one state, textured from the atlas row `i`.
pub fn label(m: &mut Mesh, f: &Frame, i: usize) {
    let cam = &f.camera;
    let Some((c, s)) = plate_corners(cam, i) else {
        return;
    };
    let lit = f.plates[i];
    let fog = fog_at(cam, PLATES[i]);
    // Cap height ≈ 30 % of the card; the atlas row is 72 px for 44 px caps.
    let px_per_atlas = PLATE_SIZE[1] * s * 0.3 / 44.0;
    let [x0, x1] = LABEL_INK[i];
    let pad = 10.0;
    let half_w = (x1 - x0 + 2.0 * pad) * 0.5 * px_per_atlas;
    let half_h = (LABEL_ROW[1] - LABEL_ROW[0]) * 0.5 * px_per_atlas;
    let (u0, u1) = ((x0 - pad) / 1024.0, (x1 + pad) / 1024.0);
    let v0 = (i as f32 * 128.0 + LABEL_ROW[0]) / 640.0;
    let v1 = (i as f32 * 128.0 + LABEL_ROW[1]) / 640.0;
    let at = [
        c[0] + PLATE_SIZE[0] * s * 0.04,
        c[1] - PLATE_SIZE[1] * s * 0.04,
    ];
    let k = (0.4 + 0.6 * lit) * fog;
    m.quad(
        [
            [at[0] - half_w, at[1] - half_h],
            [at[0] + half_w, at[1] - half_h],
            [at[0] + half_w, at[1] + half_h],
            [at[0] - half_w, at[1] + half_h],
        ],
        [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
        [k, 0.0, 0.0, 0.0],
        0.0,
    );
}

/// The approved seated figure on its plane; rim and contour light come in
/// as uniforms, the texture carries cover (red) and ink (green).
pub fn figure(m: &mut Mesh, cam: &Camera) {
    let top_left = cam.project([FIGURE[0], FIGURE[1] + FIGURE[3], 0.0]);
    let bottom_right = cam.project([FIGURE[0] + FIGURE[2], FIGURE[1], 0.0]);
    if let (Some((a, _)), Some((b, _))) = (top_left, bottom_right) {
        m.quad(
            [a, [b[0], a[1]], b, [a[0], b[1]]],
            [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]],
            [0.0; 4],
            0.0,
        );
    }
}

/// Everything in front of the figure: the voice fronts at the mouth, the
/// returning echo, the woven ribbon of the voice, inner light and near dust.
pub fn front(m: &mut Mesh, s: &Scene, f: &Frame, px: f32) {
    let cam = &f.camera;
    let line = 1.1 / px.max(0.5);
    // Wavefront silhouettes around their origin, only on the travelling side.
    for w in &f.waves {
        let Some((at, scale)) = cam.project(w.origin) else {
            continue;
        };
        let (from, to) = if w.echo {
            (0.62 * PI, 1.38 * PI)
        } else {
            (-0.44 * PI, 0.44 * PI)
        };
        for (lag, k) in [(0.0, 1.0), (0.11, 0.42), (0.24, 0.18)] {
            let r = (w.radius - lag).max(0.0) * scale;
            if r < 4.0 {
                continue;
            }
            let mut p = Vec::with_capacity(65);
            let mut fade = Vec::with_capacity(65);
            for i in 0..=64 {
                let t = i as f32 / 64.0;
                let a = from + (to - from) * t;
                p.push([at[0] + r * a.cos(), at[1] - r * a.sin() * 0.96]);
                fade.push((PI * t).sin().powf(1.6));
            }
            let a = w.strength * k * if w.echo { 0.9 } else { 0.7 };
            let c = if w.echo {
                [0.0, a, 0.0, 0.0]
            } else {
                [a, 0.0, 0.0, 0.0]
            };
            m.glow_line(
                &p,
                &fade,
                line * (1.0 + 0.6 * k),
                c,
                if lag == 0.0 { 1.0 } else { 0.0 },
            );
        }
    }
    ribbon(m, f, px);
    // The voice is born at the lips.
    if let Some((at, _)) = cam.project(MOUTH) {
        let v = f.voice;
        m.disc(
            [at[0] + 6.0, at[1]],
            [26.0 + 30.0 * v, 26.0 + 30.0 * v],
            [0.35 * v, 0.0, 0.0, 0.0],
            0.0,
        );
        m.disc(
            [at[0] + 3.0, at[1]],
            [5.0, 5.0],
            [0.5 * v, 0.0, 0.0, 0.0],
            0.0,
        );
    }
    // The state inside: breathes, and fills when the echo is heard.
    if let Some((at, scale)) = cam.project(CHEST) {
        let r = scale * (0.26 + 0.05 * f.breath + 0.1 * f.heard);
        let g = 0.035 + 0.035 * f.breath + 0.16 * f.heard;
        m.disc(at, [r, r * 1.15], [0.0, g, 0.0, 0.0], 0.0);
        m.disc(
            at,
            [r * 0.18, r * 0.18],
            [0.0, 0.25 * f.heard + 0.08, 0.0, 0.0],
            0.0,
        );
    }
    // Hearing: rings close in on the ear as the echo arrives.
    if let Some((at, scale)) = cam.project(EAR) {
        for k in 0..3 {
            let p = (f.time * 0.9 + k as f32 / 3.0).fract();
            let r = scale * (0.42 - 0.3 * p);
            let a = 0.55 * f.heard * (PI * p).sin().powi(2);
            if a < 0.003 {
                continue;
            }
            let mut ring = Vec::with_capacity(49);
            for i in 0..=48 {
                let t = i as f32 / 48.0 * TAU;
                ring.push([at[0] + r * t.cos(), at[1] + r * t.sin()]);
            }
            m.glow_line(&ring, &[1.0; 49], line, [0.0, a, 0.0, 0.0], 0.0);
        }
    }
    motes(m, s, f, -10.0, 0.0, px);
}

/// The voice as a woven ribbon travelling from the lips into the room; its
/// amplitude is the loudness, delayed by the distance it has travelled.
fn ribbon(m: &mut Mesh, f: &Frame, px: f32) {
    let cam = &f.camera;
    let a = MOUTH;
    let b = [1.2, 3.25, 2.4];
    let c = [8.0, 3.0, 11.0];
    let length = 13.0;
    let side = [0.18, 0.0, -0.98];
    for strand in 0..5 {
        let phase = strand as f32 * 0.42;
        let mut p = Vec::with_capacity(97);
        let mut w = Vec::with_capacity(97);
        let mut col = Vec::with_capacity(97);
        for i in 0..=96 {
            let t = i as f32 / 96.0;
            let u = 1.0 - t;
            let base: [f32; 3] =
                std::array::from_fn(|k| u * u * a[k] + 2.0 * u * t * b[k] + t * t * c[k]);
            let delay = t * length / crate::VOICE_SPEED;
            let local = f.time - delay;
            let index =
                ((local.rem_euclid(crate::LOOP_SECONDS)) / crate::PHRASE) as usize % crate::PHRASES;
            let env = crate::envelope(
                index,
                local.rem_euclid(crate::LOOP_SECONDS) - index as f32 * crate::PHRASE,
            );
            let taper = smooth(0.0, 0.08, t) * (1.0 - smooth(0.55, 1.0, t));
            let amp = (0.03 + 0.26 * env) * taper * (1.0 + 0.12 * strand as f32);
            let wave = 7.0 * t * TAU - f.carrier + phase;
            let up = amp * wave.sin();
            let out = amp * 0.45 * (wave + 1.3).cos();
            let q = [
                base[0] + side[0] * out,
                base[1] + up,
                base[2] + side[2] * out,
            ];
            let Some((s, scale)) = cam.project(q) else {
                continue;
            };
            p.push(s);
            w.push((0.009 * scale).max(0.7 / px));
            let fog = (-(cam.depth(q) - 6.0).max(0.0) / 8.0).exp();
            let k =
                (0.18 + 0.9 * env) * fog * taper.max(0.0) * if strand == 2 { 1.0 } else { 0.55 };
            col.push(if strand == 4 {
                [0.0, k * 0.7, 0.0, 0.0]
            } else {
                [k, 0.0, 0.0, 0.0]
            });
        }
        let halo: Vec<f32> = w.iter().map(|v| v * 6.0).collect();
        let soft: Vec<Color> = col.iter().map(|c| scale(*c, 0.12)).collect();
        m.strip(&p, &halo, &soft, 0.0);
        m.strip(&p, &w, &col, 0.3);
    }
}

/// Light that tells where the room is brighter while the voice sounds: kept
/// for the background shader as (x, y, radius, strength) in authored px.
pub fn key_light(f: &Frame) -> [f32; 4] {
    let lift = 0.6 + 0.4 * f.ambient + 0.3 * bell(f.heard, 0.0, 0.5, 2.0, 3.0);
    [1180.0, 120.0, 820.0, lift]
}
