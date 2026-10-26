//! Per-frame geometry, generated from a `Frame` and the seeded `Scene`.
//!
//! Every vertex has nine floats: position (authored px), a local coordinate,
//! straight RGBA and one extra value. Shapes use the local coordinate for a
//! soft radial or cross-line falloff and the extra value for its hardness;
//! a negative hardness adds light instead of covering. Images use the local
//! coordinate as texture UV; glyphs use it as glyph UV with stroke bits in
//! the extra value.
use crate::glass::{self, Glass};
use crate::scene::{Flake, Scene, Stone, RAIN_LAP};
use crate::{
    bubble_center, clamp01, ease_in_out, ease_out, fract, hash, lerp, smoothstep, world_point,
    Frame, LIPS, LOOP_SECONDS, POP, SIZE,
};
use std::f32::consts::{PI, TAU};

pub const STRIDE: usize = 9;
pub type Rgb = [f32; 3];

const fn rgb(r: u8, g: u8, b: u8) -> Rgb {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}
pub const GOLD_FILL: Rgb = rgb(246, 200, 84);
pub const GOLD_RIM: Rgb = rgb(255, 228, 150);
const BLACK: Rgb = [0.0, 0.0, 0.0];
const WHITE: Rgb = [1.0, 1.0, 1.0];
/// The shade of holes and shadows in the light paintings' pale stone.
const UMBER: Rgb = rgb(122, 60, 12);

/// Holes and shadows: black on the dark originals, umber on the light paintings.
fn hollow(scene: &Scene) -> Rgb {
    if scene.light {
        UMBER
    } else {
        BLACK
    }
}

#[derive(Clone, Debug, Default)]
pub struct Mesh {
    pub data: Vec<f32>,
}

/// A 2-D affine map `p → origin + p.x · x + p.y · y`.
#[derive(Clone, Copy, Debug)]
pub struct Affine {
    pub origin: [f32; 2],
    pub x: [f32; 2],
    pub y: [f32; 2],
}
impl Affine {
    pub fn place(at: [f32; 2], rotation: f32, scale: [f32; 2]) -> Self {
        let (s, c) = rotation.sin_cos();
        Self {
            origin: at,
            x: [c * scale[0], s * scale[0]],
            y: [-s * scale[1], c * scale[1]],
        }
    }
    pub fn apply(&self, p: [f32; 2]) -> [f32; 2] {
        [
            self.origin[0] + p[0] * self.x[0] + p[1] * self.y[0],
            self.origin[1] + p[0] * self.x[1] + p[1] * self.y[1],
        ]
    }
}

impl Mesh {
    pub fn clear(&mut self) {
        self.data.clear();
    }
    pub fn vertices(&self) -> i32 {
        (self.data.len() / STRIDE) as i32
    }
    fn push(&mut self, p: [f32; 2], local: [f32; 2], color: Rgb, alpha: f32, extra: f32) {
        self.data.extend_from_slice(&[
            p[0], p[1], local[0], local[1], color[0], color[1], color[2], alpha, extra,
        ]);
    }
    fn quad(
        &mut self,
        corners: [[f32; 2]; 4],
        locals: [[f32; 2]; 4],
        color: Rgb,
        alpha: f32,
        extra: f32,
    ) {
        for i in [0, 1, 2, 2, 1, 3] {
            self.push(corners[i], locals[i], color, alpha, extra);
        }
    }
    /// A textured rectangle (image program); `alpha` is its opacity.
    pub fn image(&mut self, rect: [f32; 4], uv: [f32; 4], alpha: f32, additive: bool) {
        let [x, y, w, h] = rect;
        let [u, v, du, dv] = uv;
        self.quad(
            [[x, y], [x + w, y], [x, y + h], [x + w, y + h]],
            [[u, v], [u + du, v], [u, v + dv], [u + du, v + dv]],
            WHITE,
            alpha,
            if additive { -1.0 } else { 1.0 },
        );
    }
    /// A soft disc or ellipse: opacity falls linearly to zero at its rim
    /// (`hardness` 1) or stays solid with an antialiased rim (larger values).
    pub fn ellipse(
        &mut self,
        center: [f32; 2],
        radii: [f32; 2],
        rotation: f32,
        color: Rgb,
        alpha: f32,
        hardness: f32,
    ) {
        let m = Affine::place(center, rotation, radii);
        let corners = [[-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0]];
        self.quad(corners.map(|c| m.apply(c)), corners, color, alpha, hardness);
    }
    pub fn disc(&mut self, center: [f32; 2], radius: f32, color: Rgb, alpha: f32, hardness: f32) {
        self.ellipse(center, [radius, radius], 0.0, color, alpha, hardness);
    }
    /// A flat polygon fanned from its centroid, coloured per vertex.
    pub fn fan(
        &mut self,
        points: &[[f32; 2]],
        mut color: impl FnMut([f32; 2]) -> (Rgb, f32),
        additive: bool,
    ) {
        if points.len() < 3 {
            return;
        }
        let n = points.len() as f32;
        let c = [
            points.iter().map(|p| p[0]).sum::<f32>() / n,
            points.iter().map(|p| p[1]).sum::<f32>() / n,
        ];
        let extra = if additive { -1.0 } else { 1.0 };
        let (cc, ca) = color(c);
        for i in 0..points.len() {
            let (a, b) = (points[i], points[(i + 1) % points.len()]);
            let (ac, aa) = color(a);
            let (bc, ba) = color(b);
            self.push(c, [0.0, 0.0], cc, ca, extra);
            self.push(a, [0.0, 0.0], ac, aa, extra);
            self.push(b, [0.0, 0.0], bc, ba, extra);
        }
    }
    /// A textured polygon (image program), fanned from its centroid.
    pub fn textured_fan(
        &mut self,
        points: &[[f32; 2]],
        uv: impl Fn([f32; 2]) -> [f32; 2],
        world: impl Fn([f32; 2]) -> [f32; 2],
        alpha: f32,
    ) {
        if points.len() < 3 {
            return;
        }
        let n = points.len() as f32;
        let c = [
            points.iter().map(|p| p[0]).sum::<f32>() / n,
            points.iter().map(|p| p[1]).sum::<f32>() / n,
        ];
        for i in 0..points.len() {
            let (a, b) = (points[i], points[(i + 1) % points.len()]);
            for p in [c, a, b] {
                self.push(world(p), uv(p), WHITE, alpha, 1.0);
            }
        }
    }
    /// An antialiased segment. `px` is device pixels per authored pixel; very
    /// thin lines keep a one-pixel footprint and lose opacity instead.
    #[allow(clippy::too_many_arguments)]
    pub fn line(
        &mut self,
        a: [f32; 2],
        b: [f32; 2],
        width: f32,
        color: Rgb,
        alpha: f32,
        additive: bool,
        px: f32,
    ) {
        let len = (b[0] - a[0]).hypot(b[1] - a[1]);
        if len < 1e-4 || alpha <= 0.0 {
            return;
        }
        let w_px = width * px;
        let (w_px, alpha) = if w_px < 1.0 {
            (1.0, alpha * w_px)
        } else {
            (w_px, alpha)
        };
        let half = (w_px / 2.0 + 0.5) / px;
        let n = [-(b[1] - a[1]) / len * half, (b[0] - a[0]) / len * half];
        let hard = w_px / 2.0 + 0.5;
        self.quad(
            [
                [a[0] - n[0], a[1] - n[1]],
                [a[0] + n[0], a[1] + n[1]],
                [b[0] - n[0], b[1] - n[1]],
                [b[0] + n[0], b[1] + n[1]],
            ],
            [[-1.0, 0.0], [1.0, 0.0], [-1.0, 0.0], [1.0, 0.0]],
            color,
            alpha,
            if additive { -hard } else { hard },
        );
    }
    #[allow(clippy::too_many_arguments)]
    pub fn polyline(
        &mut self,
        points: &[[f32; 2]],
        closed: bool,
        width: f32,
        color: Rgb,
        alpha: f32,
        additive: bool,
        px: f32,
    ) {
        let n = points.len();
        let segments = if closed { n } else { n.saturating_sub(1) };
        for i in 0..segments {
            self.line(
                points[i],
                points[(i + 1) % n],
                width,
                color,
                alpha,
                additive,
                px,
            );
        }
    }
    /// One glyph of falling code: box corner, size, stroke bits.
    pub fn glyph(&mut self, at: [f32; 2], size: [f32; 2], strokes: u16, color: Rgb, alpha: f32) {
        let [x, y] = at;
        let [w, h] = size;
        self.quad(
            [[x, y], [x + w, y], [x, y + h], [x + w, y + h]],
            [[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [1.0, 1.0]],
            color,
            alpha,
            f32::from(strokes),
        );
    }
}

/// Angular numerals and code marks, as stroke bits (see `glyph.frag`).
const GLYPHS: [u16; 20] = [
    0x007d, 0x0060, 0x0057, 0x0067, 0x006a, 0x002f, 0x003f, 0x0061, 0x007f, 0x006f, 0x1083, 0x0281,
    0x0421, 0x0c02, 0x1082, 0x0901, 0x1202, 0x0481, 0x0883, 0x00b5,
];

/// Falling code over the ruins, in the back layer.
pub fn rain(mesh: &mut Mesh, scene: &Scene, t: f32) {
    let ticks = (t * 6.0).floor();
    for c in &scene.rain {
        let head = (t * c.speed + c.offset).rem_euclid(RAIN_LAP) - 40.0;
        for k in 0..c.length {
            let y = head - k as f32 * 12.0;
            if !(0.0..=420.0).contains(&y) {
                continue;
            }
            let fade =
                (1.0 - k as f32 / c.length as f32) * (1.0 - smoothstep(300.0, 420.0, y)) * c.alpha;
            let pick = hash(f64::from(c.seed) + k as f64 * 7.0 + f64::from(ticks) + k as f64);
            let strokes = GLYPHS[(pick * GLYPHS.len() as f32) as usize % GLYPHS.len()];
            // Light code on the dark originals, amber ink on the light paintings.
            let (color, alpha) = match (scene.light, k == 0) {
                (false, true) => (rgb(255, 240, 170), fade),
                (false, false) => (rgb(255, 205, 40), fade * 0.7),
                (true, true) => (rgb(176, 72, 0), fade * 0.8),
                (true, false) => (rgb(214, 124, 24), fade * 0.55),
            };
            mesh.glyph([c.x - 3.2, y - 8.0], [6.4, 9.0], strokes, color, alpha);
        }
    }
}

fn flake_state(f: &Flake, t: f32) -> f32 {
    fract(t / LOOP_SECONDS as f32 * f.cycles + f.phase)
}

/// The wall around each flake: a glowing crack, then the dark hole that heals.
pub fn flake_holes(mesh: &mut Mesh, scene: &Scene, t: f32, px: f32) {
    for f in &scene.flakes {
        let k = flake_state(f, t);
        let glow = smoothstep(0.0, 0.2, k) * (1.0 - smoothstep(0.75, 1.0, k));
        let outline: Vec<[f32; 2]> = f
            .outline
            .iter()
            .map(|p| [p[0] + f.at[0], p[1] + f.at[1]])
            .collect();
        if k > 0.2 {
            let a = if scene.light { 0.7 } else { 0.85 } * (1.0 - smoothstep(0.7, 1.0, k));
            mesh.fan(&outline, |_| (hollow(scene), a), false);
            // A gold rim glows around the opening.
            mesh.polyline(
                &outline,
                true,
                4.0,
                rgb(255, 200, 40),
                0.18 * glow,
                true,
                px,
            );
            mesh.polyline(
                &outline,
                true,
                0.9,
                rgb(255, 205, 60),
                0.45 * glow,
                false,
                px,
            );
        } else if glow > 0.0 {
            // A dashed crack appears before the piece comes loose.
            let mut walked = 0.0;
            for i in 0..outline.len() {
                let (a, b) = (outline[i], outline[(i + 1) % outline.len()]);
                let len = (b[0] - a[0]).hypot(b[1] - a[1]);
                let steps = (len / 0.5).ceil().max(1.0) as usize;
                for s in 0..steps {
                    let (s0, s1) = (s as f32 / steps as f32, (s + 1) as f32 / steps as f32);
                    if (walked + len * s0).rem_euclid(5.0) < 3.0 {
                        let p = |s: f32| [lerp(a[0], b[0], s), lerp(a[1], b[1], s)];
                        mesh.line(p(s0), p(s1), 0.7, rgb(255, 220, 90), 0.35 * glow, false, px);
                    }
                }
                walked += len;
            }
        }
    }
}

/// Where a flake piece is drawn at time `t` (and whether it is still up).
pub fn flake_piece(f: &Flake, t: f32) -> Option<(Affine, f32)> {
    let k = flake_state(f, t);
    if k >= 0.88 {
        return None;
    }
    let peel = smoothstep(0.2, 0.4, k);
    let fall = clamp01((k - 0.4) / 0.45);
    let lift = f.size * 0.8 * (1.0 - fall);
    let at = [
        f.at[0] + f.drift * fall,
        f.at[1] + 700.0 * fall * fall - lift,
    ];
    let rotation = f.spin * fall + peel * 0.25 * f.spin.signum();
    let m = Affine::place(at, rotation, [1.0, 1.0 - 0.35 * peel + 0.2 * fall]);
    // Pivot at the piece's lower edge, like the prototype's translate pair.
    let pivot = m.apply([0.0, lift]);
    Some((Affine { origin: pivot, ..m }, peel))
}

/// Shadows and rims of the loose pieces (the textured pieces are drawn by the
/// image program between `flake_shadows` and `flake_rims`).
pub fn flake_shadows(mesh: &mut Mesh, scene: &Scene, t: f32) {
    for f in &scene.flakes {
        if let Some((m, peel)) = flake_piece(f, t) {
            if peel > 0.0 {
                let pts: Vec<_> = f
                    .outline
                    .iter()
                    .map(|&p| {
                        let q = m.apply(p);
                        [q[0], q[1] + 3.0 * peel]
                    })
                    .collect();
                let a = if scene.light { 0.3 } else { 0.45 };
                mesh.fan(&pts, |_| (hollow(scene), a * peel), false);
            }
        }
    }
}
pub fn flake_pieces(mesh: &mut Mesh, scene: &Scene, t: f32) {
    for f in &scene.flakes {
        if let Some((m, _)) = flake_piece(f, t) {
            mesh.textured_fan(
                &f.outline,
                |p| [(p[0] + f.at[0]) / SIZE[0], (p[1] + f.at[1]) / SIZE[1]],
                |p| m.apply(p),
                1.0,
            );
        }
    }
}
pub fn flake_rims(mesh: &mut Mesh, scene: &Scene, t: f32, px: f32) {
    for f in &scene.flakes {
        if let Some((m, peel)) = flake_piece(f, t) {
            let pts: Vec<_> = f.outline.iter().map(|&p| m.apply(p)).collect();
            mesh.polyline(
                &pts,
                true,
                1.0,
                rgb(255, 214, 70),
                0.15 + 0.35 * peel,
                false,
                px,
            );
        }
    }
}

/// Falling stones. `near` selects the ones passing in front of her; `center`
/// is the camera centre of the layer they belong to.
pub fn stones(mesh: &mut Mesh, scene: &Scene, t: f32, center: [f32; 2], near: bool, px: f32) {
    for s in &scene.stones {
        if (s.depth > 1.0) != near {
            continue;
        }
        if let Some((m, fade)) = stone_place(s, t, center) {
            let pts: Vec<_> = s.outline.iter().map(|&p| m.apply(p)).collect();
            let shade = |local: [f32; 2]| clamp01((local[0] + local[1] + 20.0) / 40.0);
            let dark = if scene.light {
                [rgb(251, 233, 190), rgb(204, 138, 62)]
            } else {
                [rgb(58, 50, 16), rgb(11, 9, 3)]
            };
            let color = |p: [f32; 2]| {
                // Undo the placement to find the gradient position.
                let d = [p[0] - m.origin[0], p[1] - m.origin[1]];
                let det = m.x[0] * m.y[1] - m.y[0] * m.x[1];
                let local = [
                    (d[0] * m.y[1] - d[1] * m.y[0]) / det,
                    (d[1] * m.x[0] - d[0] * m.x[1]) / det,
                ];
                let k = shade(local);
                (
                    [
                        lerp(dark[0][0], dark[1][0], k),
                        lerp(dark[0][1], dark[1][1], k),
                        lerp(dark[0][2], dark[1][2], k),
                    ],
                    fade * if near { 0.9 } else { 1.0 },
                )
            };
            mesh.fan(&pts, color, false);
            let lit = pts.len().div_ceil(2);
            mesh.polyline(
                &pts[..lit],
                false,
                0.9,
                rgb(255, 214, 70),
                0.55 * fade,
                false,
                px,
            );
        }
    }
}
/// Placement and opacity; a stone fades just before it starts over at the top.
pub fn stone_place(s: &Stone, t: f32, center: [f32; 2]) -> Option<(Affine, f32)> {
    let period = LOOP_SECONDS as f32 / s.cycles;
    let k = fract(t / period + s.phase);
    let tau = k * period;
    let y = s.y0 + 0.5 * s.gravity * tau * tau * 0.25;
    let x = s.x + s.vx * tau;
    if y > SIZE[1] + 80.0 {
        return None;
    }
    let p = [
        center[0] + (x - center[0]) * s.depth,
        center[1] + (y - center[1]) * s.depth,
    ];
    let fade = smoothstep(0.0, 0.03, k) * (1.0 - smoothstep(0.94, 1.0, k));
    Some((Affine::place(p, s.spin * tau, [1.0, 1.0]), fade))
}

/// Gold dust drifting at several depths around the figure. Each mote fades in
/// and out over the loop at its own phase, so the loop has no visible seam.
pub fn dust(mesh: &mut Mesh, scene: &Scene, t: f32, center: [f32; 2]) {
    let span = LOOP_SECONDS as f32;
    for p in &scene.dust {
        let k = fract(t / span + p.phase / 10.0);
        let travel = (k - 0.5) * span * if p.rising { -p.speed } else { p.speed * 0.6 };
        let x = p.at[0] + 10.0 * (t * TAU / span + p.phase).sin();
        let y = (p.at[1] + travel).rem_euclid(SIZE[1]);
        let at = [
            center[0] + (x - center[0]) * p.depth,
            center[1] + (y - center[1]) * p.depth,
        ];
        let a = (0.25 + 0.25 * (t * 4.0 * TAU / span + p.phase * 3.0).sin())
            * if p.rising { 1.0 } else { 0.6 }
            * (k * PI).sin();
        if scene.light {
            // Light adds nothing to a pale page; the motes are amber specks.
            mesh.disc(at, p.size * 3.0, rgb(206, 120, 30), a * 0.7, 1.0);
        } else {
            mesh.disc(at, p.size * 3.0, rgb(255, 225, 110), a, -1.0);
        }
    }
}

/// Leaves falling from the tree and motes rising in the dream (clipped to the lenses).
pub fn lens_life(mesh: &mut Mesh, scene: &Scene, frame: &Frame) {
    let t = frame.time;
    let life = frame.life;
    if life <= 0.0 {
        return;
    }
    let span = LOOP_SECONDS as f32;
    for l in &scene.leaves {
        let k = fract(t / span * l.cycles + l.phase);
        let at = [
            l.at[0] + (k * 9.0 + l.phase * 6.0).sin() * l.sway + k * 10.0,
            l.at[1] + k * 80.0,
        ];
        mesh.ellipse(
            at,
            [1.3, 0.6],
            k * 8.0,
            rgb(255, 236, 150),
            life * (k * PI).sin() * 0.9,
            -2.0,
        );
    }
    for m in &scene.motes {
        let k = fract(t / span * m.cycles + m.phase);
        let c = scene.lenses.centers[m.lens];
        let at = [
            c[0] - 45.0 + m.x * 90.0 + (k * 8.0 + m.phase * 9.0).sin() * 3.0,
            c[1] + 40.0 - k * 80.0,
        ];
        mesh.disc(
            at,
            m.size,
            rgb(255, 248, 200),
            life * (k * PI).sin() * 0.7,
            -2.0,
        );
    }
}

/// Light of the pop and the torn film snapping back onto the lips.
pub fn pop(mesh: &mut Mesh, scene: &Scene, frame: &Frame, px: f32) {
    let k = frame.since_pop;
    if !(0.0..=0.35).contains(&k) {
        return;
    }
    let [bx, by] = bubble_center(56.0);
    mesh.disc(
        [bx, by],
        90.0 + k * 200.0,
        rgb(255, 240, 180),
        0.45 * (1.0 - k / 0.35),
        -1.0,
    );
    if k >= 0.32 {
        return;
    }
    let al = clamp01(1.0 - k / 0.32) * 0.8;
    for f in &scene.gum {
        let o = if k < 0.05 {
            lerp(1.0, f.fly, ease_out(k / 0.05))
        } else {
            f.fly * (1.0 - ease_in_out((k - 0.05) / 0.27))
        };
        let back = if k < 0.05 { 0.0 } else { 1.0 - o / f.fly };
        let c = [lerp(bx, LIPS[0], back), lerp(by, LIPS[1] + 3.0, back)];
        let radius = 56.0 * o;
        let a0 = f.angle + f.spin * k;
        let at = |q: usize, r: f32| {
            let a = a0 + f.span * q as f32 / 8.0;
            [c[0] + a.cos() * radius * r, c[1] + a.sin() * radius * r]
        };
        let outer: Vec<_> = (0..9).map(|q| at(q, f.outer[q])).collect();
        let inner: Vec<_> = (0..9)
            .map(|q| at(q, 1.0 - (1.0 - f.inner[q]) * 0.4))
            .collect();
        for q in 0..8 {
            mesh.quad(
                [outer[q], outer[q + 1], inner[q], inner[q + 1]],
                [[0.0; 2]; 4],
                GOLD_FILL,
                al * 0.28,
                1.0,
            );
        }
        let mut rim = outer.clone();
        rim.extend(inner.iter().rev());
        mesh.polyline(&rim, true, f.width * 0.3, GOLD_RIM, al * 0.6, false, px);
    }
}

/// Crack lines in both lenses (clipped to the lens mask by the caller).
pub fn cracks(mesh: &mut Mesh, glass: &[Glass; 2], frame: &Frame, px: f32) {
    let amt = frame.crack;
    if amt <= 0.0 {
        return;
    }
    let grow = frame.growth;
    let since = frame.since_pop;
    for g in glass {
        let mut lines: Vec<Vec<[f32; 2]>> = g
            .rays
            .iter()
            .map(|ray| {
                glass::grown(ray, grow)
                    .iter()
                    .map(|p| [p[0], p[1]])
                    .collect()
            })
            .collect();
        lines.extend(
            g.rings
                .iter()
                .filter(|r| glass::ring_visible(r, grow))
                .map(|r| r.points.to_vec()),
        );
        let tapered =
            |mesh: &mut Mesh, offset: f32, width: f32, color: Rgb, alpha: f32, additive: bool| {
                for l in &lines {
                    for q in 1..l.len() {
                        let taper = 1.0 - q as f32 / l.len() as f32 * 0.6;
                        let a = [l[q - 1][0] + offset, l[q - 1][1] + offset];
                        let b = [l[q][0] + offset, l[q][1] + offset];
                        mesh.line(a, b, width * taper, color, alpha * amt, additive, px);
                    }
                }
            };
        // A dark groove with a thin bright bevel beside it.
        tapered(mesh, 0.0, 0.8, rgb(20, 14, 2), 0.55, false);
        tapered(mesh, -0.35, 0.32, rgb(255, 231, 160), 0.85, false);
        for d in &g.crush {
            let end = [g.impact[0] + d[0] * grow, g.impact[1] + d[1] * grow];
            mesh.line(g.impact, end, 0.3, rgb(255, 236, 170), 0.7 * amt, false, px);
        }
        mesh.disc(g.impact, 4.0, rgb(255, 240, 190), 0.55 * amt, 1.0);
        if since < 0.5 {
            tapered(
                mesh,
                0.0,
                0.5,
                rgb(255, 233, 168),
                (1.0 - since / 0.5) * 0.7,
                true,
            );
        }
    }
}

/// Glass chips falling from the lenses for two seconds after the pop.
pub fn chips(mesh: &mut Mesh, scene: &Scene, frame: &Frame) {
    let k = frame.since_pop;
    if !(0.0..2.0).contains(&k) {
        return;
    }
    for s in &scene.chips {
        let q = k - s.delay;
        if q < 0.0 {
            continue;
        }
        let at = [
            s.at[0] + s.velocity[0] * q * 0.6,
            s.at[1] + 40.0 + s.velocity[1] * q * 0.5 + 260.0 * q * q,
        ];
        let m = Affine::place(at, s.rotation + s.spin * q, [1.0, 1.0]);
        let twinkle = 0.5 + 0.5 * (q * 30.0 + s.rotation * 5.0).sin();
        let tri = [
            [-s.size * 0.6, -s.size * 0.25],
            [s.size * 0.6, 0.0],
            [-s.size * 0.2, s.size * 0.45],
        ]
        .map(|p| m.apply(p));
        let a = (1.0 - q / 2.0) * (0.25 + 0.5 * twinkle);
        mesh.fan(&tri, |_| (rgb(255, 224, 140), a), true);
    }
}

/// Uniform values for the lens shader at this moment.
#[derive(Clone, Debug, PartialEq)]
pub struct LensLight {
    /// Panorama UV = p · xy + zw, for authored p.
    pub world_map: [f32; 4],
    /// Sun position, pulse opacity and ray rotation.
    pub sun: [f32; 4],
    /// Glow on the couple: position and opacity.
    pub couple: [f32; 4],
}
pub fn lens_light(frame: &Frame) -> LensLight {
    let v = frame.world;
    let r = crate::lens::WORLD_RECT;
    let [w, h] = crate::WORLD_SIZE;
    let sx = v[2] / r[2] / w;
    let sy = v[3] / r[3] / h;
    let t = frame.time;
    let sun = world_point(v, [1400.0, 395.0]);
    let couple = world_point(v, [1490.0, 560.0]);
    // Whole cycles per loop keep every light continuous across the seam.
    let cycle = t * TAU / LOOP_SECONDS as f32;
    let pulse = 0.5 + 0.5 * (cycle * 4.0).sin();
    LensLight {
        world_map: [sx, sy, v[0] / w - r[0] * sx, v[1] / h - r[1] * sy],
        sun: [
            sun[0],
            sun[1],
            0.32 * frame.life * (0.6 + 0.4 * pulse),
            cycle * 0.3,
        ],
        couple: [
            couple[0],
            couple[1],
            0.4 * frame.life * (0.5 + 0.5 * (cycle * 5.0).sin()),
            0.0,
        ],
    }
}
/// Ruins seen through a turned shard: bg rect drawn into the old lens rect.
pub fn ruins_maps() -> [f32; 8] {
    let rects = [[660.0f32, 104.0, 116.0, 96.0], [793.0, 108.0, 103.0, 94.0]];
    let sources = [
        [20.0f32, 250.0, 400.0, 340.0],
        [1150.0, 250.0, 400.0, 340.0],
    ];
    let mut out = [0.0; 8];
    for i in 0..2 {
        let (d, s) = (rects[i], sources[i]);
        let (x0, y0, w, h) = (d[0] - 4.0, d[1] - 4.0, d[2] + 8.0, d[3] + 8.0);
        let ax = s[2] / w / SIZE[0];
        let ay = s[3] / h / SIZE[1];
        out[i * 4..i * 4 + 4].copy_from_slice(&[
            ax,
            ay,
            s[0] / SIZE[0] - x0 * ax,
            s[1] / SIZE[1] - y0 * ay,
        ]);
    }
    out
}

/// Bubble quad in authored space, with its wobble.
pub fn bubble_quad(frame: &Frame) -> Option<([f32; 2], [f32; 2])> {
    let r = frame.bubble;
    if r <= 0.0 {
        return None;
    }
    let wobble = 1.0 + 0.018 * (frame.time * 9.0).sin();
    let c = bubble_center(r);
    Some((c, [r * wobble, r / wobble]))
}

pub fn before_pop(frame: &Frame) -> bool {
    frame.time < POP
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compose;

    #[test]
    fn geometry_is_finite_through_the_loop() {
        let scene = Scene::new();
        let mut mesh = Mesh::default();
        for tick in 0..280 {
            let f = compose(tick as f64 * 0.05);
            mesh.clear();
            rain(&mut mesh, &scene, f.time);
            flake_holes(&mut mesh, &scene, f.time, 1.5);
            flake_shadows(&mut mesh, &scene, f.time);
            flake_pieces(&mut mesh, &scene, f.time);
            flake_rims(&mut mesh, &scene, f.time, 1.5);
            stones(&mut mesh, &scene, f.time, f.camera.back_center, false, 1.5);
            stones(&mut mesh, &scene, f.time, f.camera.center, true, 1.5);
            dust(&mut mesh, &scene, f.time, f.camera.center);
            lens_life(&mut mesh, &scene, &f);
            pop(&mut mesh, &scene, &f, 3.0);
            cracks(&mut mesh, &scene.glass, &f, 3.0);
            chips(&mut mesh, &scene, &f);
            assert_eq!(mesh.data.len() % STRIDE, 0);
            assert!(mesh.data.iter().all(|v| v.is_finite()));
            assert!(mesh.data.len() < 400_000);
        }
    }

    #[test]
    fn light_paintings_draw_no_black_and_ink_the_dust() {
        let mut scene = Scene::new();
        scene.light = true;
        let (mut mesh, mut motes) = (Mesh::default(), Mesh::default());
        for step in 0..60 {
            let t = step as f32 * LOOP_SECONDS as f32 / 60.0;
            flake_holes(&mut mesh, &scene, t, 1.5);
            flake_shadows(&mut mesh, &scene, t);
            stones(&mut mesh, &scene, t, [768.0, 512.0], false, 1.5);
            stones(&mut mesh, &scene, t, [768.0, 512.0], true, 1.5);
            dust(&mut motes, &scene, t, [768.0, 512.0]);
        }
        for vertex in mesh.data.chunks_exact(STRIDE) {
            let [r, g, b] = [vertex[4], vertex[5], vertex[6]];
            assert!(r + g + b > 0.6, "near-black {r} {g} {b}");
        }
        // Added light vanishes on the pale page; the motes cover it instead.
        assert!(motes.data.chunks_exact(STRIDE).all(|v| v[8] > 0.0));
    }

    #[test]
    fn dust_and_rain_close_the_loop() {
        let scene = Scene::new();
        let (mut a, mut b) = (Mesh::default(), Mesh::default());
        dust(&mut a, &scene, 0.0, [768.0, 512.0]);
        dust(&mut b, &scene, LOOP_SECONDS as f32 - 1e-3, [768.0, 512.0]);
        for (x, y) in a.data.iter().zip(&b.data) {
            assert!((x - y).abs() < 0.2, "{x} vs {y}");
        }
        for c in &scene.rain {
            let start = (c.offset).rem_euclid(RAIN_LAP);
            let end = (LOOP_SECONDS as f32 * c.speed + c.offset).rem_euclid(RAIN_LAP);
            assert!((start - end).abs() < 0.05 || (start - end).abs() > RAIN_LAP - 0.05);
        }
    }

    #[test]
    fn world_map_matches_world_point() {
        let f = compose(7.0);
        let light = lens_light(&f);
        let p = [800.0, 150.0];
        let uv = [
            p[0] * light.world_map[0] + light.world_map[2],
            p[1] * light.world_map[1] + light.world_map[3],
        ];
        let back = world_point(
            f.world,
            [uv[0] * crate::WORLD_SIZE[0], uv[1] * crate::WORLD_SIZE[1]],
        );
        assert!((back[0] - p[0]).abs() < 1e-2 && (back[1] - p[1]).abs() < 1e-2);
    }
}
