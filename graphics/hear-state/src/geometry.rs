//! Mesh generators. Every vertex carries the authored position (px), a local
//! coordinate for the soft profile or a texture, four light channels and a
//! hardness: red is the voice in the room, green the self (contour, inner
//! light, hearing, the scan, the question), blue the opaque body and alpha
//! how much it hides.
use crate::silhouette::SILHOUETTE;
use crate::{
    envelope, hash, on_figure, smooth, Camera, Frame, Wave, ATLAS_HEIGHT, BELLY, CROWN, EAR, FEET,
    FIGURE, LABEL_INK, LABEL_ROW, LOOP_SECONDS, MOUTH, NOSE, PHRASE, PHRASES, QUESTION, SIZE,
    SOLES, THROAT, VOICE_SPEED,
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
    /// A horizontal band from `top` to `bottom` whose light fades from
    /// `from` (0 full … 1 none) at the top to `to` at the bottom.
    fn band(&mut self, x: [f32; 2], top: f32, bottom: f32, (from, to): (f32, f32), c: Color) {
        self.quad(
            [[x[0], top], [x[1], top], [x[1], bottom], [x[0], bottom]],
            [[0.0, from], [0.0, from], [0.0, to], [0.0, to]],
            c,
            0.0,
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
/// A point on the quadratic curve a → c bending towards b.
fn curve(a: [f32; 3], b: [f32; 3], c: [f32; 3], t: f32) -> [f32; 3] {
    let u = 1.0 - t;
    std::array::from_fn(|k| u * u * a[k] + 2.0 * u * t * b[k] + t * t * c[k])
}
/// An open arc (radians, screen space, 0 = forward), fading at both ends.
fn arc(at: [f32; 2], r: f32, (from, to): (f32, f32)) -> (Vec<[f32; 2]>, Vec<f32>) {
    let n = 64;
    (0..=n)
        .map(|i| {
            let t = i as f32 / n as f32;
            let a = from + (to - from) * t;
            (
                [at[0] + r * a.cos(), at[1] - r * a.sin()],
                (PI * t).sin().powf(1.2),
            )
        })
        .unzip()
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
    for w in waves {
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
/// floor, and the light around the soles once the scan has reached them.
pub fn floor(m: &mut Mesh, f: &Frame, px: f32) {
    let cam = &f.camera;
    let fog = |z: f32| (-(z - cam.eye[2] - 3.0).max(0.0) / 9.0).exp();
    let grid = |q: [f32; 3]| {
        let v = fronts(&f.waves, q, 0.3);
        let k = 0.07 * fog(q[2]) * smooth(-1.2, 0.5, q[2]);
        let near = (-((q[0] - FEET[0]).powi(2) + q[2].powi(2)) / 1.4).exp();
        (
            0.9,
            [k * (1.0 + 4.0 * v), k * 4.0 * f.ground * near, 0.0, 0.0],
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
            let glow = 0.1 + 0.06 * f.breath + 0.45 * f.ground;
            m.disc(
                at,
                [r * s, r * s * 0.16],
                [glow * k * 0.25, glow * k * 0.7, 0.0, 0.0],
                0.0,
            );
        }
    }
    // The scan ends in the floor: two slow rings from the soles.
    if f.ground > 0.01 {
        for k in 0..2 {
            let p = (f.time / 3.2 + k as f32 / 2.0).fract();
            let r = 0.2 + 1.9 * p;
            let ring = project_all(
                cam,
                (0..=64).map(|i| {
                    let a = i as f32 / 64.0 * TAU;
                    [FEET[0] + r * a.cos(), 0.0, r * a.sin()]
                }),
            );
            let fade = vec![1.0; ring.len()];
            let a = 0.28 * f.ground * (PI * p).sin().powi(2);
            m.glow_line(&ring, &fade, 0.9 / px.max(0.5), selfish(a), 1.0);
        }
    }
    // The voice meets the floor: a widening ellipse in perspective.
    for w in &f.waves {
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
        let k = 0.28 * w.strength * smooth(h, h + 0.6, w.radius);
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
            p[j] += v / l * 0.05 * lit;
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
        let red = e * (base * (0.55 + 0.45 * mote.warm) + 1.2 * lit);
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

/// Where the scan is in the figure's texture (0 crown … 1 floor).
pub fn scan_row(f: &Frame) -> f32 {
    CROWN + f.scan[0] * (SOLES - CROWN)
}
/// The silhouette's left and right edges (texture u) around row `v`,
/// softened over a few rows so the marks glide instead of jumping.
pub fn edges(v: f32) -> Option<[f32; 2]> {
    let at = v.clamp(0.0, 1.0) * 64.0;
    let (mut sum, mut weight) = ([0.0; 2], 0.0);
    for (i, row) in SILHOUETTE.iter().enumerate() {
        let d = (i as f32 - at) / 2.2;
        if d.abs() > 3.0 || row[1] - row[0] < 1e-3 {
            continue;
        }
        let w = (-d * d).exp();
        sum = [sum[0] + row[0] * w, sum[1] + row[1] * w];
        weight += w;
    }
    (weight > 0.2).then(|| [sum[0] / weight, sum[1] / weight])
}

/// Light inside the body, drawn through the figure's cover so it never
/// spills out: the breath, hearing oneself from within and the scan that
/// passes through the whole body for every word. Nothing here says where a
/// state lives. `glow` scales the soft lights: a light page takes them as
/// faint ink.
pub fn inner(m: &mut Mesh, f: &Frame, px: f32, glow: f32) {
    let cam = &f.camera;
    let line = 1.0 / px.max(0.5);
    // The breath: in at the nose, down to the belly, a fading comet.
    if f.inhale[1] > 0.01 {
        let bend = on_figure(92.0, 132.0);
        let head = f.inhale[0];
        let path = project_all(
            cam,
            (0..=40).map(|i| curve(NOSE, bend, BELLY, i as f32 / 40.0)),
        );
        let fade: Vec<f32> = (0..path.len())
            .map(|i| {
                let t = i as f32 / 40.0;
                smooth(head - 0.45, head, t) * (1.0 - smooth(head, head + 0.02, t))
            })
            .collect();
        m.glow_line(&path, &fade, line, selfish(0.4 * f.inhale[1]), 0.8);
        if let Some((at, s)) = cam.project(curve(NOSE, bend, BELLY, head)) {
            let r = 0.11 * s;
            let k = f.inhale[1] * (1.0 - smooth(0.75, 1.0, head));
            m.disc(at, [r, r], selfish(0.4 * glow * k), 0.0);
        }
    }
    // Hearing from within: the throat to the inner ear.
    if f.heard > 0.005 {
        let path = project_all(
            cam,
            (0..=24).map(|i| curve(THROAT, on_figure(98.0, 70.0), EAR, i as f32 / 24.0)),
        );
        let fade: Vec<f32> = (0..path.len())
            .map(|i| {
                let t = i as f32 / (path.len().max(2) - 1) as f32;
                (0.5 + 0.5 * (t * 7.0 - f.time * 6.0).sin()).powi(2)
            })
            .collect();
        m.glow_line(&path, &fade, line, selfish(0.45 * f.heard), 0.8);
    }
    // The scan: attention passing through the whole body, crown to soles.
    let Some(rect) = figure_rect(cam) else {
        return;
    };
    let a = f.scan[1];
    if a + f.felt < 0.003 {
        return;
    }
    let x = [rect[0], rect[0] + rect[2]];
    let y = rect[1] + scan_row(f) * rect[3];
    let top = rect[1];
    // What the scan has passed stays a little more present.
    let reach = if a > 0.002 { y } else { rect[1] + rect[3] };
    if f.felt > 0.003 && reach > top {
        m.band(x, top, reach, (0.0, 0.0), selfish(0.05 * glow * f.felt));
    }
    if a > 0.003 {
        let trail = 0.08 * rect[3];
        let lead = 0.014 * rect[3];
        m.band(x, y - trail, y, (1.0, 0.0), selfish(0.26 * glow * a));
        m.band(x, y, y + lead, (0.0, 1.0), selfish(0.26 * glow * a));
        let p: Vec<[f32; 2]> = (0..=48)
            .map(|i| [x[0] + (x[1] - x[0]) * i as f32 / 48.0, y])
            .collect();
        let fade: Vec<f32> = (0..=48)
            .map(|i| 0.8 + 0.2 * (i as f32 * 0.7 - f.time * 1.5).sin())
            .collect();
        m.glow_line(&p, &fade, line * 0.9, selfish(0.75 * a), 1.0);
    }
}

/// Everything in front of the figure: the voice in the room, its ribbon,
/// hearing oneself, the marks of the scan, the question and the near dust.
pub fn front(m: &mut Mesh, s: &Scene, f: &Frame, px: f32, glow: f32) {
    let cam = &f.camera;
    let line = 1.1 / px.max(0.5);
    // Wavefronts around the lips, only on the side they travel to: one
    // front and its faint echo.
    for w in &f.waves {
        let Some((at, scale)) = cam.project(w.origin) else {
            continue;
        };
        for (lag, k) in [(0.0, 1.0), (0.16, 0.35)] {
            let r = (w.radius - lag).max(0.0) * scale;
            if r < 4.0 {
                continue;
            }
            let (p, fade) = arc(at, r, (-0.42 * PI, 0.42 * PI));
            m.glow_line(
                &p,
                &fade,
                line * (1.0 + 0.5 * k),
                voice(0.55 * w.strength * k),
                if lag == 0.0 { 1.0 } else { 0.0 },
            );
        }
    }
    ribbon(m, f, px);
    // The lips.
    if let Some((at, _)) = cam.project(MOUTH) {
        let v = f.voice;
        m.disc(
            [at[0] + 6.0, at[1]],
            [20.0 + 20.0 * v, 20.0 + 20.0 * v],
            voice(0.25 * glow * v),
            0.0,
        );
        m.disc([at[0] + 3.0, at[1]], [4.5, 4.5], voice(0.4 * v), 0.0);
    }
    // Listening: the sound comes back around the head into the ear.
    if let Some((at, scale)) = cam.project(EAR) {
        for k in 0..2 {
            let p = (f.time * 0.6 + k as f32 / 2.0).fract();
            let r = scale * (0.46 - 0.3 * p);
            let a =
                0.45 * f.listening.max(f.heard) * (PI * p).sin().powi(2) * (0.4 + 0.6 * f.heard);
            if a < 0.003 {
                continue;
            }
            let (ring, fade) = arc(at, r, (-0.55 * PI, 0.55 * PI));
            m.glow_line(&ring, &fade, line, selfish(a), 0.0);
        }
        m.disc(
            at,
            [scale * 0.12, scale * 0.12],
            selfish(0.3 * glow * f.heard),
            0.0,
        );
    }
    scan_marks(m, f, px);
    card(m, f, px);
    motes(m, s, f, -10.0, 0.0, px);
}

/// Two quiet marks on either side of the silhouette at the scan's height.
fn scan_marks(m: &mut Mesh, f: &Frame, px: f32) {
    let a = f.scan[1];
    if a < 0.003 {
        return;
    }
    let Some(rect) = figure_rect(&f.camera) else {
        return;
    };
    let v = scan_row(f);
    let Some([u0, u1]) = edges(v) else {
        return;
    };
    let y = rect[1] + v * rect[3];
    let left = rect[0] + u0 * rect[2] - 12.0;
    let right = rect[0] + u1 * rect[2] + 12.0;
    let line = 0.9 / px.max(0.5);
    for (from, to) in [(left - 22.0, left), (right + 22.0, right)] {
        let p = [[from, y], [to, y]];
        m.glow_line(&p, &[0.0, 1.0], line, selfish(0.7 * a), 0.6);
        m.disc([to, y], [2.2, 2.2], selfish(0.8 * a), 0.4);
    }
}

/// Where the question stands: right of the chest, above the hands.
pub fn label_card(f: &Frame) -> Option<([f32; 2], [f32; 2], f32)> {
    let (chest, s) = f.camera.project(on_figure(86.0, 176.0))?;
    let cap = 0.135 * s;
    let [x0, x1] = LABEL_INK[f.word];
    let width = (x1 - x0) / 44.0 * cap + 2.2 * cap;
    let center = [chest[0] + 0.75 * s + width * 0.5, chest[1] + 0.22 * s];
    Some((center, [width * 0.5, cap * 1.25], cap))
}
/// The card that holds the asked word; it points nowhere in the body.
fn card(m: &mut Mesh, f: &Frame, px: f32) {
    let a = f.asked;
    if a < 0.005 {
        return;
    }
    let Some((c, [w, h], _)) = label_card(f) else {
        return;
    };
    let line = 0.8 / px.max(0.5);
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
    m.glow_line(&ring, &fade, line, selfish(0.7 * a), 0.6);
    let tick = [
        [c[0] - w + cut * 1.2, c[1] + h * 0.6],
        [c[0] - w + cut * 3.0, c[1] + h * 0.6],
    ];
    m.glow_line(&tick, &[1.0, 1.0], line * 1.4, selfish(a), 1.0);
}
/// Label quads: «ЕСТЬ ЛИ В НЁМ» above the card and the word inside it.
pub fn labels(m: &mut Mesh, f: &Frame) {
    let Some((c, [w, h], cap)) = label_card(f) else {
        return;
    };
    let question_cap = cap * 0.52;
    let question_at = [
        c[0] - w + (LABEL_INK[QUESTION][1] - LABEL_INK[QUESTION][0]) / 88.0 * question_cap,
        c[1] - h - question_cap * 1.4,
    ];
    for (row, at, size, k) in [
        (QUESTION, question_at, question_cap, 0.6 * f.asked),
        (
            f.word,
            [c[0] + cap * 0.35, c[1] - cap * 0.05],
            cap,
            f.asked * smooth(0.25, 0.8, f.asked),
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

/// The voice as a calm woven ribbon travelling from the lips into the room;
/// its amplitude is that of the moment it left the lips.
fn ribbon(m: &mut Mesh, f: &Frame, px: f32) {
    let cam = &f.camera;
    let a = MOUTH;
    let b = [1.0, 3.1, 2.2];
    let c = [7.8, 2.8, 11.0];
    let length = 12.5;
    let side = [0.18, 0.0, -0.98];
    for strand in 0..3 {
        let phase = strand as f32 * 0.55;
        let mut p = Vec::with_capacity(97);
        let mut w = Vec::with_capacity(97);
        let mut col = Vec::with_capacity(97);
        for i in 0..=96 {
            let t = i as f32 / 96.0;
            let base = curve(a, b, c, t);
            let then = (f.time - t * length / VOICE_SPEED).rem_euclid(LOOP_SECONDS);
            let index = ((then / PHRASE) as usize).min(PHRASES - 1);
            let env = envelope(index, then - index as f32 * PHRASE);
            let taper = smooth(0.0, 0.08, t) * (1.0 - smooth(0.45, 0.9, t));
            let amp = (0.015 + 0.14 * env) * taper * (1.0 + 0.1 * strand as f32);
            let x = 3.0 * t * TAU - f.carrier + phase;
            let up = amp * x.sin();
            let out = amp * 0.45 * (x + 1.3).sin();
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
            let k = (0.1 + 0.75 * env) * fog * taper * if strand == 1 { 1.0 } else { 0.45 };
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
    [1180.0, 120.0, 820.0, 0.6 + 0.4 * f.ambient + 0.12 * f.felt]
}
