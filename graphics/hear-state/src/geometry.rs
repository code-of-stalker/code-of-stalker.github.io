//! Mesh generators. Every vertex carries the authored position (px), a local
//! coordinate for the soft profile or a texture, four light channels and a
//! hardness: red is the voice in the room, green the self (contour, inner
//! light, hearing, naming), blue the opaque body and alpha how much it hides.
use crate::{
    bell, channel, envelope, hash, on_figure, smooth, Camera, Frame, Mood, Wave, ATLAS_HEIGHT, EAR,
    FEET, FIGURE, LABEL_INK, LABEL_ROW, LOOP_SECONDS, MOODS, MOUTH, PHRASE, PHRASES, QUESTION,
    SHELL, SHELL_FRONT, SIZE, VOICE_SPEED,
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
            let soft: Vec<Color> = colors.iter().map(|c| scale(*c, 0.16 * halo)).collect();
            self.strip(p, &vec![core * 7.0; n], &soft, 0.0);
        }
        self.strip(p, &vec![core; n], &colors, 0.35);
    }
}
fn scale(c: Color, k: f32) -> Color {
    [c[0] * k, c[1] * k, c[2] * k, c[3] * k]
}
fn voice(k: f32) -> Color {
    [k, 0.0, 0.0, 0.0]
}
fn selfish(k: f32) -> Color {
    [0.0, k, 0.0, 0.0]
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
                    -1.6 + 9.4 * r(1),
                    0.05 + 4.9 * r(2).powf(0.85),
                    -0.9 + 11.5 * r(3).powf(0.8),
                ],
                glow: 0.05 + 0.2 * r(4).powi(3),
                phase: [TAU * r(5), TAU * r(6)],
                warm: r(7),
            });
        }
        // A few out-of-focus specks right in front of the lens.
        for i in 0..14u32 {
            let r = |k: u32| hash(9000 + i * 17 + k);
            motes.push(Mote {
                at: [-2.2 + 5.6 * r(1), 0.4 + 3.4 * r(2), -2.9 + 0.8 * r(3)],
                glow: 0.25 + 0.3 * r(4),
                phase: [TAU * r(5), TAU * r(6)],
                warm: r(7),
            });
        }
        Self { motes }
    }
}

/// How strongly the voice fronts in the room light a point.
fn fronts(waves: &[Wave], p: [f32; 3], width: f32) -> f32 {
    let mut lit = 0.0;
    for w in waves.iter().filter(|w| !w.inner) {
        let d = [p[0] - w.origin[0], p[1] - w.origin[1], p[2] - w.origin[2]];
        let r = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt();
        let miss = (r - w.radius) / width;
        lit += (-miss * miss).exp() * w.strength * smooth(-0.35, 0.55, d[0] / r.max(1e-3));
    }
    lit
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
fn project_all(cam: &Camera, points: impl Iterator<Item = [f32; 3]>) -> Vec<[f32; 2]> {
    points
        .filter_map(|q| cam.project(q).map(|(s, _)| s))
        .collect()
}

/// Floor grid fading into the depth, ripples where the voice meets the
/// floor, and the grounded light around the soles.
pub fn floor(m: &mut Mesh, f: &Frame, px: f32) {
    let cam = &f.camera;
    let fog = |z: f32| (-(z - cam.eye[2] - 3.0).max(0.0) / 9.0).exp();
    let grid = |q: [f32; 3]| {
        let v = fronts(&f.waves, q, 0.3);
        let k = 0.07 * fog(q[2]) * smooth(-1.2, 0.5, q[2]);
        let near = (-((q[0] - FEET[0]).powi(2) + q[2].powi(2)) / 1.4).exp();
        (
            0.9,
            [k * (1.0 + 5.0 * v), k * 5.0 * f.ground * near, 0.0, 0.0],
        )
    };
    for i in -12..=18 {
        let x = i as f32 * 0.5;
        line3(m, cam, [x, 0.0, -2.0], [x, 0.0, 15.0], 24, grid, px);
    }
    for i in 0..30 {
        let z = -1.5 + i as f32 * 0.55;
        line3(m, cam, [-7.0, 0.0, z], [10.0, 0.0, z], 24, grid, px);
    }
    // Contact: the soles and the chair legs rest on the floor.
    for (x, r, k) in [(FEET[0], 0.55, 1.0), (FEET[0] - 1.25, 0.7, 0.45)] {
        if let Some((at, s)) = cam.project([x, 0.0, 0.0]) {
            let glow = 0.1 + 0.06 * f.breath + 0.5 * f.ground;
            m.disc(
                at,
                [r * s, r * s * 0.16],
                [glow * k * 0.25, glow * k * 0.7, 0.0, 0.0],
                0.0,
            );
        }
    }
    // A grounded voice spreads through the floor from the soles.
    if f.ground > 0.01 {
        for k in 0..3 {
            let p = (f.time / 2.4 + k as f32 / 3.0).fract();
            let r = 0.2 + 2.2 * p;
            let ring = project_all(
                cam,
                (0..=64).map(|i| {
                    let a = i as f32 / 64.0 * TAU;
                    [FEET[0] + r * a.cos(), 0.0, r * a.sin()]
                }),
            );
            let fade = vec![1.0; ring.len()];
            let a = 0.32 * f.ground * (PI * p).sin().powi(2);
            m.glow_line(&ring, &fade, 0.9 / px.max(0.5), selfish(a), 1.0);
        }
    }
    // The voice meets the floor: a widening ellipse in perspective.
    for w in f.waves.iter().filter(|w| !w.inner) {
        let h = w.origin[1];
        if w.radius <= h {
            continue;
        }
        let r = (w.radius * w.radius - h * h).sqrt();
        let mut p = Vec::new();
        let mut fade = Vec::new();
        for i in 0..=48 {
            let a = -0.5 * PI + PI * i as f32 / 48.0;
            let q = [w.origin[0] + r * a.cos(), 0.0, w.origin[2] + r * a.sin()];
            if let Some((s, _)) = cam.project(q) {
                p.push(s);
                fade.push((PI * i as f32 / 48.0).sin().powf(0.7) * fog(q[2]));
            }
        }
        let k = 0.35 * w.strength * smooth(h, h + 0.6, w.radius);
        m.glow_line(&p, &fade, 1.0 / px.max(0.5), voice(k), 1.0);
    }
}

/// Dust whose world depth lies in (near, far].
pub fn motes(m: &mut Mesh, s: &Scene, f: &Frame, near: f32, far: f32, px: f32) {
    let cam = &f.camera;
    let focus = 6.5;
    let w = f.time / LOOP_SECONDS * TAU;
    for (i, mote) in s.motes.iter().enumerate() {
        if mote.at[2] <= near || mote.at[2] > far {
            continue;
        }
        let k = 1.0 + (i % 3) as f32;
        let mut p = [
            mote.at[0] + 0.07 * (k * w + mote.phase[0]).sin(),
            mote.at[1] + 0.05 * ((4.0 - k) * w + mote.phase[1]).sin(),
            mote.at[2],
        ];
        let lit = fronts(&f.waves, p, 0.22);
        // The front nudges the dust outwards as it passes.
        let d = [p[0] - MOUTH[0], p[1] - MOUTH[1], p[2] - MOUTH[2]];
        let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt().max(1e-3);
        for (j, v) in d.iter().enumerate() {
            p[j] += v / l * 0.06 * lit;
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
        let e = energy * fog;
        let red = e * (base * (0.55 + 0.45 * mote.warm) + 1.4 * lit);
        let green = e * base * 0.35 * (1.0 - mote.warm);
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

/// The approved seated figure on its plane: (screen rect x, y, w, h).
pub fn figure_rect(cam: &Camera) -> Option<[f32; 4]> {
    let (a, _) = cam.project([FIGURE[0], FIGURE[1] + FIGURE[3], 0.0])?;
    let (b, _) = cam.project([FIGURE[0] + FIGURE[2], FIGURE[1], 0.0])?;
    Some([a[0], a[1], b[0] - a[0], b[1] - a[1]])
}
pub fn figure(m: &mut Mesh, cam: &Camera) {
    if let Some([x, y, w, h]) = figure_rect(cam) {
        m.quad(
            [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
            [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]],
            [0.0; 4],
            0.0,
        );
    }
}

/// A ring of resonance shaped by the state: trembling, flattened, hollow
/// (broken) or rigid (polygonal). `from`/`to` limit the arc (radians,
/// screen space, 0 = forward).
fn shaped_ring(
    at: [f32; 2],
    r: f32,
    mood: &Mood,
    time: f32,
    (from, to): (f32, f32),
) -> (Vec<[f32; 2]>, Vec<f32>) {
    let segments = if mood.rigid > 0.5 { 9 } else { 96 };
    let mut p = Vec::with_capacity(segments + 1);
    let mut fade = Vec::with_capacity(segments + 1);
    for i in 0..=segments {
        let t = i as f32 / segments as f32;
        let a = from + (to - from) * t;
        // A tremor of a few px, whatever the radius.
        let wobble = mood.tremor
            * (3.5 * (23.0 * a + time * 37.0).sin() + 2.0 * (41.0 * a - time * 53.0).sin());
        let rr = r + wobble;
        let x = rr * (a.cos() * (1.0 - 0.85 * mood.clip) + 0.92 * 0.85 * mood.clip);
        let y = rr * a.sin() * (1.0 - 0.2 * mood.clip);
        p.push([at[0] + x, at[1] - y]);
        let edge = if (to - from) < TAU - 0.01 {
            (PI * t).sin().powf(1.2)
        } else {
            1.0
        };
        let gap = if mood.hollow > 0.5 {
            smooth(
                0.35,
                0.5,
                ((a / PI * 4.0 + r * 0.01).rem_euclid(1.0) - 0.5).abs() * 2.0,
            )
        } else {
            1.0
        };
        let flicker = 1.0 - mood.tremor * 0.45 * (0.5 + 0.5 * (time * 41.0 + a * 5.0).sin());
        fade.push(edge * gap * flicker);
    }
    (p, fade)
}

/// Light inside the body, drawn through the figure's cover so it never
/// spills out: the inner axis, the inhale, the voice rising from its source,
/// the resonance of every syllable and the sound reaching the inner ear.
/// `glow` scales the soft lights: a light page takes them as faint ink.
pub fn inner(m: &mut Mesh, f: &Frame, px: f32, glow: f32) {
    let cam = &f.camera;
    let mood = &MOODS[f.mood];
    let line = 1.0 / px.max(0.5);
    let axis: Vec<f32> = (0..=96).map(|i| i as f32 / 96.0 * 8.0).collect();
    let points = project_all(cam, axis.iter().map(|a| channel(*a)));
    if points.len() != axis.len() {
        return;
    }
    // The axis itself: faint, brighter where the breath has been.
    let base: Vec<f32> = axis
        .iter()
        .map(|a| {
            0.05 + 0.1 * f.inhale[1] * (1.0 - smooth(f.inhale[0] - 0.2, f.inhale[0] + 0.4, *a))
        })
        .collect();
    m.glow_line(&points, &base, line * 0.9, selfish(1.0), 0.6);
    // The inhale: a light travelling down the axis as far as the breath goes.
    if f.inhale[1] > 0.01 {
        if let Some((at, s)) = cam.project(channel(f.inhale[0])) {
            let r = 0.16 * s;
            m.disc(at, [r, r], selfish(0.55 * glow * f.inhale[1]), 0.0);
        }
    }
    // The voice rises from its source to the lips.
    let source = f.source[0];
    if f.rising > 0.01 {
        let span: Vec<f32> = axis
            .iter()
            .map(|a| if *a <= source { 1.0 } else { 0.0 })
            .collect();
        let pulse: Vec<f32> = axis
            .iter()
            .zip(&span)
            .map(|(a, inside)| {
                let flow = (0.5 + 0.5 * ((a - source) * 4.0 + f.time * 9.0).sin()).powi(3);
                inside * (0.25 + 0.75 * flow) * (0.4 + 0.6 * f.voice)
            })
            .collect();
        m.glow_line(&points, &pulse, line * 1.4, selfish(0.55 * f.rising), 1.0);
    }
    // The source: where this state speaks from.
    if let Some((at, s)) = cam.project(channel(source)) {
        let lit = f.source[1] * (0.35 + 0.65 * f.voice) + 0.06 * f.breath;
        let r = s * (0.3 + 0.08 * f.voice);
        if mood.hollow > 0.5 {
            // Nobody inside: a ring with an empty middle.
            let (p, fade) = shaped_ring(at, r * 0.5, mood, f.time, (0.0, TAU));
            // Undo the dimming of the hollow state: the empty ring itself must read.
            let k =
                0.14 + 0.6 * (f.source[1] / (1.0 - 0.55 * mood.hollow)).min(1.0) + 0.08 * f.breath;
            m.glow_line(&p, &fade, line * 1.2, selfish(k), 1.0);
        } else {
            m.disc(at, [r, r * 1.1], selfish(0.55 * glow * lit), 0.0);
            m.disc(at, [r * 0.18, r * 0.18], selfish(0.6 * lit), 0.0);
        }
    }
    // Every syllable resonates in the body around its source.
    for w in f.waves.iter().filter(|w| w.inner) {
        let Some((at, s)) = cam.project(w.origin) else {
            continue;
        };
        let m2 = &MOODS[w.mood];
        let r = w.radius * s;
        if r < 3.0 {
            continue;
        }
        let (p, fade) = shaped_ring(at, r, m2, f.time, (0.0, TAU));
        m.glow_line(&p, &fade, line * 1.1, selfish(0.7 * w.strength), 1.0);
    }
    // Hearing from within: the throat to the inner ear.
    let path = project_all(
        cam,
        (0..=24).map(|i| {
            let t = i as f32 / 24.0;
            let a = channel(1.0);
            let c = on_figure(98.0, 70.0);
            std::array::from_fn(|k| {
                (1.0 - t) * (1.0 - t) * a[k] + 2.0 * (1.0 - t) * t * c[k] + t * t * EAR[k]
            })
        }),
    );
    let fade: Vec<f32> = (0..path.len())
        .map(|i| {
            let t = i as f32 / (path.len().max(2) - 1) as f32;
            (0.5 + 0.5 * (t * 9.0 - f.time * 11.0).sin()).powi(2)
        })
        .collect();
    m.glow_line(&path, &fade, line, selfish(0.6 * f.heard), 0.8);
}

/// Everything in front of the figure: the voice in the room, its ribbon,
/// the mask, hearing oneself, the named state and the near dust.
pub fn front(m: &mut Mesh, s: &Scene, f: &Frame, px: f32, glow: f32) {
    let cam = &f.camera;
    let line = 1.1 / px.max(0.5);
    // Wavefronts around the lips, only on the side they travel to.
    for w in f.waves.iter().filter(|w| !w.inner) {
        let Some((at, scale)) = cam.project(w.origin) else {
            continue;
        };
        let mood = &MOODS[w.mood];
        let arc = if mood.clip > 0.5 { 0.3 * PI } else { 0.44 * PI };
        for (lag, k) in [(0.0, 1.0), (0.11, 0.42), (0.24, 0.18)] {
            let r = (w.radius - lag).max(0.0) * scale;
            if r < 4.0 {
                continue;
            }
            let (p, fade) = shaped_ring(at, r, mood, f.time + lag, (-arc, arc));
            let a = 0.75 * w.strength * k;
            m.glow_line(
                &p,
                &fade,
                line * (1.0 + 0.6 * k),
                voice(a),
                if lag == 0.0 { 1.0 } else { 0.0 },
            );
        }
    }
    ribbon(m, f, px);
    // The mask: a shell held in front of the face; the voice passes it.
    if f.mask > 0.01 {
        let shell: Vec<[f32; 3]> = (0..=40)
            .map(|i| {
                let a = -1.3 + 2.6 * i as f32 / 40.0;
                on_figure(SHELL[0] + SHELL[2] * a.cos(), SHELL[1] - SHELL[3] * a.sin())
            })
            .collect();
        let p = project_all(cam, shell.iter().copied());
        let fade: Vec<f32> = (0..p.len())
            .map(|i| {
                (PI * i as f32 / (p.len().max(2) - 1) as f32)
                    .sin()
                    .powf(0.5)
            })
            .collect();
        let k = f.mask * (0.45 + 0.55 * f.voice);
        m.glow_line(&p, &fade, line * 1.3, voice(k), 1.0);
        let inset: Vec<[f32; 2]> = p.iter().map(|q| [q[0] - 7.0, q[1]]).collect();
        m.glow_line(&inset, &fade, line * 0.7, voice(0.35 * k), 0.0);
    }
    // The lips.
    let lips = if f.mask > 0.5 { SHELL_FRONT } else { MOUTH };
    if let Some((at, _)) = cam.project(lips) {
        let v = f.voice;
        m.disc(
            [at[0] + 6.0, at[1]],
            [24.0 + 26.0 * v, 24.0 + 26.0 * v],
            voice(0.3 * glow * v),
            0.0,
        );
        m.disc([at[0] + 3.0, at[1]], [5.0, 5.0], voice(0.45 * v), 0.0);
    }
    // Listening: the sound comes back around the head into the ear.
    if let Some((at, scale)) = cam.project(EAR) {
        for k in 0..3 {
            let p = (f.time * 1.1 + k as f32 / 3.0).fract();
            let r = scale * (0.5 - 0.38 * p);
            let a = 0.6 * f.listening.max(f.heard) * (PI * p).sin().powi(2) * (0.4 + 0.6 * f.heard);
            if a < 0.003 {
                continue;
            }
            let (ring, fade) = shaped_ring(at, r, &MOODS[0], f.time, (-0.55 * PI, 0.55 * PI));
            m.glow_line(&ring, &fade, line, selfish(a), 0.0);
        }
        m.disc(
            at,
            [scale * 0.12, scale * 0.12],
            selfish(0.35 * glow * f.heard),
            0.0,
        );
    }
    noticed(m, f, px);
    motes(m, s, f, -10.0, 0.0, px);
}

/// Where the named state appears: right of the chest, above the hands.
pub fn label_card(f: &Frame) -> Option<([f32; 2], [f32; 2], f32)> {
    let (chest, s) = f.camera.project(channel(2.0))?;
    let cap = 0.135 * s;
    let [x0, x1] = LABEL_INK[f.mood];
    let width = (x1 - x0) / 44.0 * cap + 2.2 * cap;
    let center = [chest[0] + 0.75 * s + width * 0.5, chest[1] + 0.22 * s];
    Some((center, [width * 0.5, cap * 1.25], cap))
}
/// The state, named once it has been heard: a quiet card joined by a thread
/// of light to where the voice came from, under the page's question.
fn noticed(m: &mut Mesh, f: &Frame, px: f32) {
    let a = f.noticed.max(0.0);
    let ask = f.listening * (1.0 - 0.5 * a);
    if a + ask < 0.005 {
        return;
    }
    let Some((c, [w, h], _)) = label_card(f) else {
        return;
    };
    let line = 0.8 / px.max(0.5);
    if a > 0.005 {
        let cut = 0.4 * h;
        let outline = [
            [c[0] - w, c[1] - h],
            [c[0] + w - cut, c[1] - h],
            [c[0] + w, c[1] - h + cut],
            [c[0] + w, c[1] + h],
            [c[0] - w + cut, c[1] + h],
            [c[0] - w, c[1] + h - cut],
        ];
        m.fan(&outline, [0.0, 0.02 * a, 0.5 * a, 0.5 * a]);
        let mut ring = outline.to_vec();
        ring.push(outline[0]);
        let reveal = smooth(0.0, 0.7, a);
        let fade: Vec<f32> = (0..ring.len())
            .map(|i| smooth(0.0, 0.15, reveal - i as f32 / ring.len() as f32 * 0.85))
            .collect();
        m.glow_line(&ring, &fade, line, selfish(0.75 * a), 0.6);
        let tick = [
            [c[0] - w + cut * 1.2, c[1] + h * 0.6],
            [c[0] - w + cut * 3.0, c[1] + h * 0.6],
        ];
        m.glow_line(&tick, &[1.0, 1.0], line * 1.4, selfish(a), 1.0);
        // A thread of light from the source to the card.
        if let Some((from, _)) = f.camera.project(channel(f.source[0])) {
            let to = [c[0] - w, c[1]];
            let bend = [from[0] + (to[0] - from[0]) * 0.55, to[1]];
            let p: Vec<[f32; 2]> = (0..=24)
                .map(|i| {
                    let t = i as f32 / 24.0;
                    let u = 1.0 - t;
                    [
                        u * u * from[0] + 2.0 * u * t * bend[0] + t * t * to[0],
                        u * u * from[1] + 2.0 * u * t * bend[1] + t * t * to[1],
                    ]
                })
                .collect();
            let fade: Vec<f32> = (0..p.len())
                .map(|i| smooth(0.0, 0.1, reveal - i as f32 / p.len() as f32))
                .collect();
            m.glow_line(&p, &fade, line, selfish(0.55 * a), 0.5);
            m.disc(to, [3.0 / px.max(0.5), 3.0 / px.max(0.5)], selfish(a), 0.4);
        }
    }
}
/// Label quads: the question while listening, the state once noticed.
pub fn labels(m: &mut Mesh, f: &Frame) {
    let Some((c, [w, h], cap)) = label_card(f) else {
        return;
    };
    let ask = f.listening * (1.0 - smooth(0.0, 0.6, f.noticed));
    let question_cap = cap * 0.52;
    let question_at = [
        c[0] - w + (LABEL_INK[QUESTION][1] - LABEL_INK[QUESTION][0]) / 88.0 * question_cap,
        c[1] - h - question_cap * 1.4,
    ];
    for (row, at, size, k) in [
        (QUESTION, question_at, question_cap, 0.55 * ask),
        (
            f.mood,
            [c[0] + cap * 0.35, c[1] - cap * 0.05],
            cap,
            f.noticed * smooth(0.25, 0.8, f.noticed),
        ),
    ] {
        if k < 0.004 {
            continue;
        }
        let per = size / 44.0;
        let [x0, x1] = LABEL_INK[row];
        let pad = 10.0;
        let half_w = (x1 - x0 + 2.0 * pad) * 0.5 * per;
        let half_h = (LABEL_ROW[1] - LABEL_ROW[0]) * 0.5 * per;
        let (u0, u1) = ((x0 - pad) / 1024.0, (x1 + pad) / 1024.0);
        let v0 = (row as f32 * 128.0 + LABEL_ROW[0]) / ATLAS_HEIGHT;
        let v1 = (row as f32 * 128.0 + LABEL_ROW[1]) / ATLAS_HEIGHT;
        m.quad(
            [
                [at[0] - half_w, at[1] - half_h],
                [at[0] + half_w, at[1] - half_h],
                [at[0] + half_w, at[1] + half_h],
                [at[0] - half_w, at[1] + half_h],
            ],
            [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
            selfish(k),
            0.0,
        );
    }
}

/// The carrier of a state's voice: even, trembling, clipped flat, thin or
/// mechanical.
fn carrier(mood: &Mood, x: f32, time: f32) -> f32 {
    let even = x.sin();
    let trembling = 0.7 * (1.8 * x).sin() + 0.3 * (4.3 * x + time * 23.0).sin();
    let flat = (2.6 * x.sin()).clamp(-1.0, 1.0) * 0.75;
    let mechanical = 2.0 / PI * x.sin().asin();
    let mut v = even;
    v += (trembling - even) * mood.tremor;
    v += (flat - v) * mood.clip;
    v += (mechanical - v) * mood.rigid;
    v * (1.0 - 0.45 * mood.hollow)
}

/// The voice as a woven ribbon travelling from the lips into the room; its
/// amplitude and shape are those of the moment it left the lips.
fn ribbon(m: &mut Mesh, f: &Frame, px: f32) {
    let cam = &f.camera;
    let a = if f.mask > 0.5 { SHELL_FRONT } else { MOUTH };
    let b = [1.0, 3.1, 2.2];
    let c = [7.8, 2.8, 11.0];
    let length = 12.5;
    let side = [0.18, 0.0, -0.98];
    for strand in 0..4 {
        let phase = strand as f32 * 0.42;
        let mut p = Vec::with_capacity(97);
        let mut w = Vec::with_capacity(97);
        let mut col = Vec::with_capacity(97);
        for i in 0..=96 {
            let t = i as f32 / 96.0;
            let u = 1.0 - t;
            let base: [f32; 3] =
                std::array::from_fn(|k| u * u * a[k] + 2.0 * u * t * b[k] + t * t * c[k]);
            let then = (f.time - t * length / VOICE_SPEED).rem_euclid(LOOP_SECONDS);
            let index = ((then / PHRASE) as usize).min(PHRASES - 1);
            let mood = &MOODS[index];
            let env = envelope(index, then - index as f32 * PHRASE);
            let taper = smooth(0.0, 0.08, t) * (1.0 - smooth(0.5, 1.0, t));
            let reach = 1.0 - smooth(mood.reach / 12.0 - 0.25, mood.reach / 12.0, t);
            let amp = (0.02 + 0.28 * env) * taper * (1.0 + 0.12 * strand as f32);
            let x = (6.0 + 3.0 * mood.tremor) * t * TAU - f.carrier + phase;
            let up = amp * carrier(mood, x, f.time);
            let out = amp * 0.45 * carrier(mood, x + 1.3, f.time);
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
            let k = (0.12 + 0.9 * env) * fog * taper * reach * if strand == 1 { 1.0 } else { 0.5 };
            col.push(voice(k));
        }
        let halo: Vec<f32> = w.iter().map(|v| v * 6.0).collect();
        let soft: Vec<Color> = col.iter().map(|c| scale(*c, 0.12)).collect();
        m.strip(&p, &halo, &soft, 0.0);
        m.strip(&p, &w, &col, 0.3);
    }
}

/// The room's key light: (x, y, radius, strength) in authored px.
pub fn key_light(f: &Frame) -> [f32; 4] {
    let lift = 0.6 + 0.4 * f.ambient + 0.2 * bell(f.noticed, 0.0, 0.5, 2.0, 3.0);
    [1180.0, 120.0, 820.0, lift]
}
