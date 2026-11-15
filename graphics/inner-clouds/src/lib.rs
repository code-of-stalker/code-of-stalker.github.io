//! «Дай внутреннему проявляться свободно», page 06 of Step 6 «Внутреннее
//! кольцо», direction «Окно». Night. A person sits upright on a straight
//! backed chair facing a tall window; the room is dark, the moon comes in
//! through the glass, lays the window on the floor and throws his shadow
//! back toward us. Outside is his sky, and it does whatever it does by
//! itself; in the glass his own faint reflection, and the clouds pass
//! through it. The cold outer ring turns round him low over the floor, the
//! warm inner ring rests round his chest.
//! «Мысли могут быть быстрыми»: low scud races across the sky. «эмоции —
//! тихими»: one cloud glows warm from inside, the inner ring warms with it;
//! «или резкими»: lightning, twice, the room flashes. «импульсы — редкими»:
//! one falling star; «или хаотичными»: a swarm of short ones every which
//! way. «не управлять и не менять»: a cloud takes the moon, the room dims,
//! his hand lifts toward the window, falters and goes back to his knee, and
//! the moon comes back by itself. «а просто наблюдать … облака, которые
//! плывут по небу»: the camera draws back and the slow clouds go on.
//! Every value here is a pure function of loop time; `browser.rs` only
//! uploads it and one ray-traced pass draws it. Unit: the person sits about
//! 1.43 high; the floor is y = 0, the window wall is at z = `WINDOW_Z`.
use crate::body::{add, dot, length, mix, norm, scale, sub, Arm, V};
use std::f32::consts::TAU;
use std::sync::OnceLock;
use watcher_scene_palette::Palette;

pub mod body;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerClouds;

pub const LOOP_SECONDS: f32 = 64.0;
/// The frame is 3:2; a canvas of another shape keeps the whole 3:2 frame in
/// view.
pub const FRAME_ASPECT: f32 = 1.5;
/// The box the person and the chair lie in; the shader marches only there.
pub const BOUNDS: [[f32; 3]; 2] = [[-0.3, -0.01, -0.21], [0.3, 1.46, 0.7]];
/// Where the soles stand (x, z) and the four chair legs.
pub const FEET: [[f32; 2]; 2] = [[0.126, 0.6], [-0.126, 0.6]];
pub const LEGS: [[f32; 2]; 4] = [
    [0.195, 0.27],
    [-0.195, 0.27],
    [0.195, -0.12],
    [-0.195, -0.12],
];
/// One meaningful still frame for reduced motion: «эмоции — тихими», seen
/// from the side, one cloud glowing warm and the inner ring warm with it.
pub const STILL: f32 = 17.6;

// ---------- the room

/// The window wall's plane.
pub const WINDOW_Z: f32 = 1.1;
/// The glass: x from, x to, y from, y to; two mullions at ±`MULLION`, a
/// transom at `TRANSOM`, each bar 2 × `BAR` wide.
pub const GLASS: [f32; 4] = [-0.875, 0.875, 0.665, 2.205];
pub const MULLION: f32 = 0.3;
pub const TRANSOM: f32 = 1.78;
pub const BAR: f32 = 0.02;
/// The other walls: x half width, the ceiling, the back wall's z.
pub const WALLS: [f32; 3] = [2.3, 2.8, -3.6];
/// The way to the moon (not unit), high and a little to the left; its light
/// comes in through the glass.
pub const MOON: V = [-0.22, 0.62, 1.0];

/// The outer ring, level, low round the chair: centre (x, y, z), radius.
pub const OUTER: [f32; 4] = [0.0, 0.5, 0.05, 0.95];
/// The inner ring, level round the chest.
pub const INNER: [f32; 4] = [0.0, 0.86, -0.03, 0.3];
/// The outer ring's ticks turn this many times a loop.
pub const TURNS: f32 = 3.0;

// ---------- the beats

/// «Фиксируй»: the inner ring flares once.
pub const NOTICE: [f32; 4] = [3.0, 3.5, 4.0, 5.2];
/// «Мысли могут быть быстрыми»: the scud races.
pub const FAST: [f32; 4] = [5.0, 6.8, 12.5, 14.5];
/// «эмоции — тихими»: one cloud glows warm from inside.
pub const GLOW: [f32; 4] = [15.4, 16.8, 19.0, 21.0];
pub const GLOW_LIGHT: f32 = 1.6;
/// «или резкими»: two strikes of lightning.
pub const STRIKES: [f32; 2] = [22.0, 23.6];
/// The scud thickens round them.
pub const STORM: [f32; 4] = [20.5, 21.6, 24.4, 26.0];
/// «импульсы — редкими»: one falling star, from, to.
pub const METEOR: [f32; 2] = [27.0, 28.4];
/// «или хаотичными»: a swarm of short ones.
pub const SWARM: [f32; 2] = [30.3, 34.6];
/// «не управлять и не менять»: a cloud takes the moon and gives it back; the
/// hand lifts, falters, goes back.
pub const DIM: [f32; 4] = [36.3, 38.3, 40.3, 42.6];
pub const LIFT: [f32; 2] = [36.0, 38.4];
pub const FALTER: [f32; 4] = [38.4, 38.8, 39.0, 39.5];
pub const LOWER: [f32; 2] = [39.8, 42.0];
pub const REACH: f32 = 0.85;

/// The camera, keyed through the loop: eye (x, y, z), the point it looks
/// at, the height of the frame (degrees). Wide from the back of the room;
/// over the shoulder for the fast thoughts; from the side for the
/// emotions; back for the stars; beside him for the hand; back again.
pub const CAMERA: [(f32, [f32; 7]); 13] = [
    (0.0, [0.25, 1.75, -3.2, 0.0, 1.2, 0.8, 50.0]),
    (3.5, [0.35, 1.68, -2.6, -0.05, 1.25, 0.9, 48.0]),
    (7.0, [0.6, 1.6, -1.55, -0.12, 1.3, 1.1, 46.0]),
    (12.0, [0.52, 1.55, -1.4, -0.12, 1.28, 1.1, 46.0]),
    (16.5, [1.9, 1.15, -1.5, -0.15, 1.2, 0.9, 50.0]),
    (22.5, [1.75, 1.2, -1.35, -0.18, 1.25, 0.95, 50.0]),
    (27.0, [1.2, 1.3, -1.9, -0.2, 1.35, 1.1, 48.0]),
    (32.5, [1.05, 1.33, -2.05, -0.2, 1.35, 1.1, 48.0]),
    (38.5, [1.7, 1.1, -0.9, -0.05, 1.0, 0.7, 50.0]),
    (42.5, [1.6, 1.15, -1.0, -0.05, 1.05, 0.75, 50.0]),
    (48.0, [0.62, 1.5, -1.9, 0.0, 1.25, 0.9, 48.0]),
    (55.0, [0.3, 1.72, -2.9, 0.0, 1.2, 0.8, 50.0]),
    (60.0, [0.26, 1.74, -3.12, 0.0, 1.2, 0.8, 50.0]),
];

// ---------- the sky

/// The clouds are noise that repeats across the sky every this many units
/// of its own; over the loop the slow layer drifts exactly one repeat and
/// the scud a whole number of them, so the sky joins up.
pub const SLOW_PERIOD: f32 = 4.0;
pub const SCUD_PERIOD: f32 = 8.0;
/// The scud's speed at rest and how much faster it runs for the thoughts.
pub const SCUD_SPEED: [f32; 2] = [0.22, 1.5];
/// Shader slots: the points of the lightning, the falling stars.
pub const BOLT_POINTS: usize = 52;
pub const STARS: usize = 12;

// ---------- small math

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
fn window(t: f32, [a, b, c, d]: [f32; 4]) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

/// The integral of `smooth(a, b, s)` over s up to `t`.
fn ramp(a: f32, b: f32, t: f32) -> f32 {
    if t <= a {
        0.0
    } else if t >= b {
        0.5 * (b - a) + (t - b)
    } else {
        let x = (t - a) / (b - a);
        (b - a) * (x * x * x - 0.5 * x * x * x * x)
    }
}

fn cross(a: V, b: V) -> V {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

/// Two unit vectors square to `d` and to each other: the first level, the
/// second as near to up as it can be.
fn across(d: V) -> (V, V) {
    let level = cross(d, [0.0, 1.0, 0.0]);
    let side = if length(level) > 1e-3 {
        norm(level)
    } else {
        [1.0, 0.0, 0.0]
    };
    (side, cross(side, d))
}

/// A smooth closed curve through `n` keys (time, value) around the loop:
/// Catmull–Rom tangents, cubic Hermite pieces.
fn spline_by(n: usize, key: impl Fn(usize) -> (f32, f32), t: f32) -> f32 {
    let count = n as isize;
    let mut t = t.rem_euclid(LOOP_SECONDS);
    let i = (0..n)
        .rev()
        .find(|&j| key(j).0 <= t)
        .map_or(count - 1, |j| j as isize);
    let at = |j: isize| {
        let (time, value) = key(j.rem_euclid(count) as usize);
        (time + LOOP_SECONDS * j.div_euclid(count) as f32, value)
    };
    let [(t0, v0), (t1, v1), (t2, v2), (t3, v3)] = [i - 1, i, i + 1, i + 2].map(at);
    if t < t1 {
        t += LOOP_SECONDS;
    }
    let (m1, m2) = ((v2 - v0) / (t2 - t0), (v3 - v1) / (t3 - t1));
    let h = t2 - t1;
    let s = (t - t1) / h;
    let (s2, s3) = (s * s, s * s * s);
    (2.0 * s3 - 3.0 * s2 + 1.0) * v1
        + (s3 - 2.0 * s2 + s) * h * m1
        + (3.0 * s2 - 2.0 * s3) * v2
        + (s3 - s2) * h * m2
}

fn keyed(keys: &[(f32, [f32; 7])], t: f32) -> [f32; 7] {
    std::array::from_fn(|c| spline_by(keys.len(), |i| (keys[i].0, keys[i].1[c]), t))
}

fn noise(i: u32) -> f32 {
    let mut x = i.wrapping_mul(0x9e37_79b9) ^ 0x632b_e5ab;
    x ^= x >> 16;
    x = x.wrapping_mul(0x7feb_352d);
    x ^= x >> 15;
    x = x.wrapping_mul(0x846c_a68b);
    x ^= x >> 16;
    (x >> 8) as f32 / 16_777_215.0
}

// ---------- the camera

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Camera {
    pub eye: V,
    pub right: V,
    pub up: V,
    pub forward: V,
    /// The tangent of half the frame's height.
    pub lens: f32,
}

impl Camera {
    fn toward(eye: V, target: V, fov: f32) -> Camera {
        let forward = norm(sub(target, eye));
        let (right, up) = across(forward);
        Camera {
            eye,
            right,
            up,
            forward,
            lens: (fov.to_radians() * 0.5).tan(),
        }
    }
    /// Where a point lands in the frame: y -1..1 across its height, x
    /// -1.5..1.5 across its width; None behind the camera.
    pub fn project(&self, p: V) -> Option<[f32; 2]> {
        let v = sub(p, self.eye);
        let z = dot(v, self.forward);
        (z > 0.02).then(|| {
            [
                dot(v, self.right) / (z * self.lens),
                dot(v, self.up) / (z * self.lens),
            ]
        })
    }
    /// Where a far way (the sky) lands in the frame.
    pub fn project_way(&self, d: V) -> Option<[f32; 2]> {
        self.project(add(self.eye, scale(norm(d), 1000.0)))
    }
}

pub fn in_frame([x, y]: [f32; 2]) -> bool {
    x.abs() < FRAME_ASPECT && y.abs() < 1.0
}

pub fn camera(t: f32) -> Camera {
    let [ex, ey, ez, tx, ty, tz, fov] = keyed(&CAMERA, t);
    Camera::toward([ex, ey, ez], [tx, ty, tz], fov)
}

// ---------- the sky through the glass
// A way into the sky is kept as its gnomonic point (x / z, y / z): the
// shader finds the same point for every pixel that looks through the glass.

/// Whether the way `d` from `eye` goes out through a pane (not a bar).
pub fn through_glass(eye: V, d: V) -> bool {
    if d[2] <= 0.0 {
        return false;
    }
    let t = (WINDOW_Z - eye[2]) / d[2];
    let [x, y] = [eye[0] + d[0] * t, eye[1] + d[1] * t];
    x > GLASS[0]
        && x < GLASS[1]
        && y > GLASS[2]
        && y < GLASS[3]
        && (x.abs() - MULLION).abs() > BAR
        && (y - TRANSOM).abs() > BAR
}

/// Above the far hills: the shader's ridge is never above 0.045 over -0.1.
pub fn above_hills(s: [f32; 2]) -> bool {
    let d = norm([s[0], s[1], 1.0]);
    d[1] > -0.055 + 0.01
}

/// The sky seen through the opening from `eye`, `fx`, `fy` of the way
/// across it (0..1), the lowest sky just above the hills.
fn sky_at(eye: V, fx: f32, fy: f32) -> [f32; 2] {
    let dz = WINDOW_Z - eye[2];
    let x = mix(
        [(GLASS[0] - eye[0]) / dz, 0.0, 0.0],
        [(GLASS[1] - eye[0]) / dz, 0.0, 0.0],
        fx,
    )[0];
    let low = ((GLASS[2] - eye[1]) / dz).max(0.0);
    let y = low + ((GLASS[3] - eye[1]) / dz - low) * fy;
    [x, y]
}

fn way(s: [f32; 2]) -> V {
    norm([s[0], s[1], 1.0])
}

/// The way of the warm cloud, picked from the camera of the still frame.
pub fn glow_way() -> V {
    way(sky_at(camera(STILL).eye, 0.17, 0.5))
}

// ---------- lightning

/// One branching bolt in the sky: its points (x, y, width, how far along
/// the leader reaches it 0..1). A negative width starts a new strand.
#[derive(Clone, Debug, PartialEq)]
pub struct Bolt {
    pub at: f32,
    pub points: Vec<[f32; 4]>,
    pub way: V,
}

fn jag(seed: u32, a: [f32; 2], b: [f32; 2], depth: u32, rough: f32) -> Vec<[f32; 2]> {
    let mut points = vec![a, b];
    let mut k = 0u32;
    for _ in 0..depth {
        let mut next = vec![points[0]];
        for w in points.windows(2) {
            let (p, q) = (w[0], w[1]);
            let l = ((q[0] - p[0]).powi(2) + (q[1] - p[1]).powi(2))
                .sqrt()
                .max(1e-6);
            let n = [-(q[1] - p[1]) / l, (q[0] - p[0]) / l];
            let o = (noise(seed.wrapping_mul(977).wrapping_add(k)) - 0.5) * l * rough;
            k += 1;
            next.push([
                (p[0] + q[0]) * 0.5 + n[0] * o,
                (p[1] + q[1]) * 0.5 + n[1] * o,
            ]);
            next.push(q);
        }
        points = next;
    }
    points
}

/// Each strike: when, the seed, top and bottom across the opening seen
/// from the camera then; the bottom is below the hills.
const STRIKE_SHAPE: [(u32, [f32; 2], [f32; 2]); 2] = [
    (11, [0.36, 0.96], [0.46, -0.08]),
    (29, [0.74, 1.0], [0.62, -0.08]),
];

fn make_bolt(i: usize) -> Bolt {
    let at = STRIKES[i];
    let (seed, top, low) = STRIKE_SHAPE[i];
    let eye = camera(at + 0.15).eye;
    let a = sky_at(eye, top[0], top[1]);
    let x = sky_at(eye, low[0], 0.0)[0];
    let b = [x, low[1]];
    let main = jag(seed, a, b, 5, 0.28);
    let span = ((b[0] - a[0]).powi(2) + (b[1] - a[1]).powi(2)).sqrt();
    let width = 0.0016;
    let n = main.len() as f32 - 1.0;
    let mut points: Vec<[f32; 4]> = main
        .iter()
        .enumerate()
        .map(|(j, p)| {
            let w = if j == 0 { -width } else { width };
            [p[0], p[1], w, j as f32 / n]
        })
        .collect();
    for k in 0..2u32 {
        let r = |m: u32| noise(seed * 31 + k * 7 + m);
        let j = ((main.len() as f32) * (0.25 + 0.4 * r(1))) as usize;
        let from = main[j];
        let side = if k == 0 { -1.0 } else { 1.0 };
        let angle = (b[1] - a[1]).atan2(b[0] - a[0]) + side * (0.5 + 0.4 * r(2));
        let len = span * (0.2 + 0.15 * r(3));
        let to = [from[0] + angle.cos() * len, from[1] + angle.sin() * len];
        let branch = jag(seed + 20 + k, from, to, 3, 0.3);
        let m = branch.len() as f32 - 1.0;
        let start = j as f32 / n;
        points.extend(branch.iter().enumerate().map(|(q, p)| {
            let w = if q == 0 { -width * 0.6 } else { width * 0.6 };
            [p[0], p[1], w, start + (1.0 - start) * 0.6 * q as f32 / m]
        }));
    }
    let mid = main[main.len() / 3];
    Bolt {
        at,
        points,
        way: way(mid),
    }
}

pub fn bolts() -> &'static [Bolt; 2] {
    static ALL: OnceLock<[Bolt; 2]> = OnceLock::new();
    ALL.get_or_init(|| [make_bolt(0), make_bolt(1)])
}

/// A strike `u` seconds in: (its light, how far its leader has run). The
/// leader runs down dim, then the stroke flickers and fades.
pub fn strike(u: f32) -> (f32, f32) {
    if !(0.0..1.2).contains(&u) {
        return (0.0, 0.0);
    }
    let leader = (u / 0.06).min(1.0);
    let light = if u < 0.06 {
        0.3
    } else if u < 0.12 {
        1.0
    } else if u < 0.17 {
        0.3
    } else if u < 0.26 {
        0.9
    } else {
        0.9 * (-(u - 0.26) / 0.18).exp()
    };
    (light, leader)
}

// ---------- falling stars

/// One falling star: when it starts, how long it falls, from, to (sky).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Star {
    pub at: f32,
    pub falls: f32,
    pub from: [f32; 2],
    pub to: [f32; 2],
    pub light: f32,
    pub width: f32,
}

impl Star {
    /// How far through its fall at `t` (None when not falling).
    fn phase(&self, t: f32) -> Option<f32> {
        let u = (t - self.at) / self.falls;
        (0.0..1.0).contains(&u).then_some(u)
    }
    /// The tail and the head in the sky, and its light.
    pub fn at_time(&self, t: f32) -> Option<([f32; 4], f32)> {
        let u = self.phase(t)?;
        let p = |s: f32| {
            let s = s.clamp(0.0, 1.0);
            [
                self.from[0] + (self.to[0] - self.from[0]) * s,
                self.from[1] + (self.to[1] - self.from[1]) * s,
            ]
        };
        let (head, tail) = (p(u), p(u - 0.45));
        let light = self.light * smooth(0.0, 0.15, u) * (1.0 - smooth(0.7, 1.0, u));
        Some(([tail[0], tail[1], head[0], head[1]], light))
    }
}

pub fn stars() -> &'static [Star] {
    static ALL: OnceLock<Vec<Star>> = OnceLock::new();
    ALL.get_or_init(|| {
        // The rare one: long and slow across the opening.
        let [a, b] = METEOR;
        let eye = camera((a + b) * 0.5).eye;
        let mut all = vec![Star {
            at: a,
            falls: b - a,
            from: sky_at(eye, 0.22, 0.88),
            to: sky_at(eye, 0.62, 0.42),
            light: 1.0,
            width: 0.0016,
        }];
        // The chaotic ones: short, every which way, one after another and
        // some at once.
        let n = 12u32;
        for i in 0..n {
            let r = |m: u32| noise(500 + i * 13 + m);
            let at = SWARM[0] + (SWARM[1] - SWARM[0] - 0.6) * (i as f32 + 0.6 * r(1)) / n as f32;
            let falls = 0.35 + 0.25 * r(2);
            let eye = camera(at + falls * 0.5).eye;
            let c = sky_at(eye, 0.2 + 0.6 * r(3), 0.35 + 0.5 * r(4));
            let angle = TAU * r(5);
            let len = 0.05 + 0.06 * r(6);
            let h = [angle.cos() * len * 0.5, angle.sin() * len * 0.5];
            all.push(Star {
                at,
                falls,
                from: [c[0] - h[0], c[1] - h[1]],
                to: [c[0] + h[0], c[1] + h[1]],
                light: 0.75 + 0.25 * r(7),
                width: 0.0012,
            });
        }
        all
    })
}

// ---------- the drift of the clouds

/// How far the scud has gone at `t`: its speed integrated, scaled so a loop
/// is a whole number of repeats.
pub fn scud_drift(t: f32) -> f32 {
    let [v0, v1] = SCUD_SPEED;
    let [a, b, c, d] = FAST;
    let gone = |t: f32| v0 * t + v1 * (ramp(a, b, t) - ramp(c, d, t));
    let all = gone(LOOP_SECONDS);
    let whole = (all / SCUD_PERIOD).round().max(1.0) * SCUD_PERIOD;
    whole * gone(t) / all
}

pub fn slow_drift(t: f32) -> f32 {
    SLOW_PERIOD * t / LOOP_SECONDS
}

/// How far the hand has lifted toward the window.
pub fn reach(t: f32) -> f32 {
    let up = REACH * smooth(LIFT[0], LIFT[1], t) - 0.08 * window(t, FALTER);
    up * (1.0 - smooth(LOWER[0], LOWER[1], t))
}

// ---------- one frame

#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// The outer ring's turn (radians).
    pub ticks: f32,
    /// The moonlight, the flash of the lightning.
    pub moon: f32,
    pub flash: f32,
    /// How far the slow clouds and the scud have drifted, how much scud.
    pub slow: f32,
    pub scud: f32,
    pub scud_amount: f32,
    /// The warm cloud's light and way; the inner ring's light.
    pub glow: f32,
    pub glow_way: V,
    pub ring: f32,
    /// The way of the lightning (for the flash), and its points now.
    pub flash_way: V,
    pub bolt: [[f32; 4]; BOLT_POINTS],
    /// The falling stars now: tail, head; light, width.
    pub stars: [[f32; 4]; STARS],
    pub star_light: [[f32; 4]; STARS],
    pub arm: Arm,
}

pub fn compose(t: f32) -> Frame {
    let t = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let glow = window(t, GLOW);
    let mut flash = 0.0;
    let mut flash_way = bolts()[0].way;
    let mut bolt = [[0.0; 4]; BOLT_POINTS];
    for b in bolts() {
        let (light, leader) = strike(t - b.at);
        if light > 0.0 {
            flash = light;
            flash_way = b.way;
            for (slot, p) in bolt.iter_mut().zip(&b.points) {
                let on = if p[3] <= leader { light } else { 0.0 };
                *slot = [p[0], p[1], p[2], on];
            }
        }
    }
    let mut star_slots = [[0.0; 4]; STARS];
    let mut star_light = [[0.0; 4]; STARS];
    let mut n = 0;
    for s in stars() {
        if let Some((seg, light)) = s.at_time(t) {
            if n < STARS && light > 0.0 {
                star_slots[n] = seg;
                star_light[n] = [light, s.width, 0.0, 0.0];
                n += 1;
            }
        }
    }
    Frame {
        time: t,
        camera: camera(t),
        ticks: TAU * TURNS * t / LOOP_SECONDS,
        moon: 1.0 - 0.65 * window(t, DIM),
        flash,
        slow: slow_drift(t),
        scud: scud_drift(t),
        scud_amount: (0.3 + 0.7 * window(t, FAST) + 0.3 * window(t, STORM)).min(1.0),
        glow: GLOW_LIGHT * glow,
        glow_way: glow_way(),
        ring: 0.7 + 0.5 * glow + 0.6 * window(t, NOTICE),
        flash_way,
        bolt,
        stars: star_slots,
        star_light,
        arm: body::arm(reach(t)),
    }
}

// ---------- the themes

/// The scene's own colours per theme: the cold of the outer ring and the
/// rims, the warm of the inner ring and the glowing cloud, the pale of the
/// moon and the lightning.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub cold: [f32; 3],
    pub warm: [f32; 3],
    pub pale: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

pub fn look(code: u32) -> Look {
    match Palette::from_code(code) {
        // Искра: the yellow of the theme, an ember warmth.
        Palette::Dark => Look {
            cold: rgb(245, 221, 7),
            warm: rgb(255, 122, 40),
            pale: rgb(255, 244, 170),
        },
        // Астрал: the blue of the theme, a rose-peach warmth.
        Palette::Violet => Look {
            cold: rgb(98, 150, 245),
            warm: rgb(240, 158, 128),
            pale: rgb(200, 212, 248),
        },
        // Матрица: code green, amber.
        Palette::Matrix => Look {
            cold: rgb(0, 255, 65),
            warm: rgb(255, 184, 64),
            pale: rgb(190, 255, 205),
        },
        // Тишина: sea glass, warm sand.
        _ => Look {
            cold: rgb(134, 201, 199),
            warm: rgb(242, 179, 117),
            pale: rgb(214, 218, 210),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::body::{solid, solid_with};

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    fn every(step: f32, mut check: impl FnMut(f32)) {
        let mut t = 0.0;
        while t < LOOP_SECONDS {
            check(t);
            t += step;
        }
    }

    fn distance(a: V, b: V) -> f32 {
        length(sub(a, b))
    }

    const HEAD: V = [0.0, 1.31, -0.02];
    const PANE: V = [0.0, 1.43, WINDOW_Z];

    #[test]
    fn the_loop_closes_without_a_jump() {
        let (a, b) = (compose(0.0), compose(LOOP_SECONDS - 1e-3));
        assert!(distance(a.camera.eye, b.camera.eye) < 1e-3);
        assert!(distance(a.camera.forward, b.camera.forward) < 1e-3);
        assert!(close(a.ring, b.ring, 1e-3) && close(a.moon, b.moon, 1e-3));
        assert!(a.flash == 0.0 && b.flash == 0.0 && a.glow == 0.0 && b.glow == 0.0);
        assert_eq!(a.arm, b.arm);
        // The clouds have gone whole repeats of their noise.
        assert!(close(b.slow - a.slow, SLOW_PERIOD, 1e-3), "{}", b.slow);
        let scud = scud_drift(LOOP_SECONDS);
        assert!(scud >= SCUD_PERIOD && close((scud / SCUD_PERIOD).fract(), 0.0, 1e-4));
        assert!(close(b.scud, scud, 1e-2), "{} {scud}", b.scud);
        assert!(close(b.scud_amount, a.scud_amount, 1e-3));
        // The ring's ticks turn whole turns.
        assert!(TURNS.fract() == 0.0 && TURNS >= 2.0);
        assert!(close((b.ticks - a.ticks) / TAU, TURNS, 1e-3));
        assert_eq!(compose(LOOP_SECONDS), a);
        assert_eq!(compose(f32::NAN), a);
        assert_eq!(compose(-LOOP_SECONDS), a);
    }

    #[test]
    fn the_camera_stays_in_the_room_clear_of_him_and_sees_him_and_the_window() {
        every(0.02, |t| {
            let c = camera(t);
            let [x, y, z] = c.eye;
            assert!(
                x.abs() < WALLS[0] - 0.2 && y > 0.4 && y < WALLS[1] - 0.3,
                "{t}"
            );
            assert!(z > WALLS[2] + 0.2 && z < WINDOW_Z - 0.6, "{t}");
            assert!(solid_with(c.eye, &body::arm(reach(t))) > 0.4, "{t}");
            for p in [HEAD, PANE] {
                let s = c.project(p).expect("ahead");
                assert!(s[0].abs() < 1.3 && s[1].abs() < 0.9, "{t}: {p:?} {s:?}");
            }
        });
        assert!(solid(camera(0.0).eye) > 1.0);
    }

    #[test]
    fn the_outer_ring_is_always_in_view_and_turns_visibly() {
        every(0.05, |t| {
            let c = camera(t);
            let [x, y, z, r] = OUTER;
            let seen = (0..360)
                .filter(|i| {
                    let a = TAU * *i as f32 / 360.0;
                    c.project([x + r * a.sin(), y, z + r * a.cos()])
                        .is_some_and(in_frame)
                })
                .count();
            assert!(seen >= 40, "{t}: {seen}");
        });
        // Its edge runs at least 0.25 a second.
        let w = compose(10.0).ticks - compose(9.0).ticks;
        assert!(w * OUTER[3] > 0.25, "{w}");
    }

    #[test]
    fn the_rings_clear_the_body() {
        // The inner ring round the chest misses the body and the resting
        // arms; the outer ring misses the chair.
        let [x, y, z, r] = INNER;
        let [ox, oy, oz, or] = OUTER;
        for i in 0..360 {
            let a = TAU * i as f32 / 360.0;
            assert!(solid([x + r * a.sin(), y, z + r * a.cos()]) > 0.02, "{i}");
            assert!(
                solid([ox + or * a.sin(), oy, oz + or * a.cos()]) > 0.3,
                "{i}"
            );
        }
    }

    #[test]
    fn the_sky_shows_each_thing_through_the_glass_at_its_time() {
        // The warm cloud, from the camera all through its glow.
        let g = glow_way();
        every(0.05, |t| {
            if window(t, GLOW) > 0.2 {
                let c = camera(t);
                assert!(through_glass(c.eye, g), "{t}");
                assert!(c.project_way(g).is_some_and(in_frame), "{t}");
            }
        });
        // Every brightly lit point of a bolt, every falling star's head.
        every(0.01, |t| {
            let f = compose(t);
            let eye = f.camera.eye;
            for p in f.bolt.iter().filter(|p| p[3] > 0.3) {
                if above_hills([p[0], p[1]]) {
                    let d = way([p[0], p[1]]);
                    let inside = (WINDOW_Z - eye[2]) / d[2];
                    let x = eye[0] + d[0] * inside;
                    let y = eye[1] + d[1] * inside;
                    assert!(x > GLASS[0] - 0.05 && x < GLASS[1] + 0.05, "{t}: {p:?}");
                    assert!(y > GLASS[2] - 0.05 && y < GLASS[3] + 0.05, "{t}: {p:?}");
                }
            }
            for (s, l) in f.stars.iter().zip(&f.star_light) {
                if l[0] > 0.3 {
                    let head = [s[2], s[3]];
                    assert!(above_hills(head), "{t}: {head:?}");
                    let d = way(head);
                    let inside = (WINDOW_Z - eye[2]) / d[2];
                    let x = eye[0] + d[0] * inside;
                    let y = eye[1] + d[1] * inside;
                    assert!(x > GLASS[0] && x < GLASS[1], "{t}: {head:?}");
                    assert!(y > GLASS[2] && y < GLASS[3], "{t}: {head:?}");
                }
            }
        });
        // Each bolt reaches down below the hills.
        for b in bolts() {
            assert!(b.points.iter().any(|p| !above_hills([p[0], p[1]])));
            assert!(b.points.len() <= BOLT_POINTS && b.points[0][2] < 0.0);
        }
    }

    #[test]
    fn each_line_brings_its_own_sky() {
        let at = compose;
        // Fast thoughts: the scud runs several times faster.
        let speed = |t: f32| (scud_drift(t + 0.5) - scud_drift(t - 0.5)).abs();
        assert!(
            speed(10.0) > 4.0 * speed(50.0),
            "{} {}",
            speed(10.0),
            speed(50.0)
        );
        assert!(at(10.0).scud_amount > 0.9 && at(50.0).scud_amount < 0.4);
        // Quiet emotion: one warm cloud, the inner ring warm with it.
        assert!(at(17.6).glow > 1.5 && at(17.6).ring > 1.1 && at(10.0).glow == 0.0);
        // Sharp ones: two strikes that flash the room.
        for s in STRIKES {
            assert!(at(s + 0.08).flash == 1.0);
            assert!(at(s + 0.08).bolt.iter().filter(|p| p[3] > 0.0).count() > 40);
        }
        assert!(at(STRIKES[0] - 0.5).flash == 0.0 && at(STRIKES[1] + 1.5).flash == 0.0);
        // Rare: one star alone; chaotic: several at once, going different
        // ways.
        let falling = |t: f32| at(t).star_light.iter().filter(|l| l[0] > 0.0).count();
        assert_eq!(falling(27.7), 1);
        assert!((SWARM[0]..SWARM[1])
            .step_by_hundredths()
            .into_iter()
            .any(|t| falling(t) >= 3));
        let ways: Vec<f32> = stars()[1..]
            .iter()
            .map(|s| (s.to[1] - s.from[1]).atan2(s.to[0] - s.from[0]))
            .collect();
        let spread = ways.iter().fold(f32::MIN, |m, w| m.max(*w))
            - ways.iter().fold(f32::MAX, |m, w| m.min(*w));
        assert!(spread > 3.5, "{spread}");
        // Not to change: the moon dims and comes back; the hand lifts, then
        // rests.
        assert!(at(39.3).moon < 0.45 && at(50.0).moon == 1.0);
        assert!(reach(38.4) > 0.8 && reach(35.0) == 0.0 && reach(42.5) == 0.0);
        let c = camera(38.6);
        let hand = at(38.6).arm.hand;
        assert!(c.project(hand).is_some_and(in_frame));
        assert!(hand[1] > 0.95);
    }

    trait Hundredths {
        fn step_by_hundredths(self) -> Vec<f32>;
    }
    impl Hundredths for std::ops::Range<f32> {
        fn step_by_hundredths(self) -> Vec<f32> {
            let n = ((self.end - self.start) * 100.0) as usize;
            (0..n).map(|i| self.start + i as f32 / 100.0).collect()
        }
    }

    #[test]
    fn the_slots_never_overflow() {
        assert_eq!(stars().len(), 13);
        every(0.01, |t| {
            let live = stars().iter().filter(|s| s.at_time(t).is_some()).count();
            assert!(live <= STARS, "{t}");
        });
        for b in bolts() {
            assert!(b.points.len() <= BOLT_POINTS);
        }
    }

    #[test]
    fn the_motion_is_smooth() {
        let step = 1.0 / 60.0;
        every(step, |t| {
            if t + step >= LOOP_SECONDS {
                return;
            }
            let (a, b) = (compose(t), compose(t + step));
            assert!(distance(a.camera.eye, b.camera.eye) < 0.02, "{t}");
            assert!(distance(a.camera.forward, b.camera.forward) < 0.012, "{t}");
            assert!((a.moon - b.moon).abs() < 0.02, "{t}");
            assert!((a.glow - b.glow).abs() < 0.04, "{t}");
            assert!((a.ring - b.ring).abs() < 0.04, "{t}");
            assert!((a.scud_amount - b.scud_amount).abs() < 0.02, "{t}");
            assert!((a.scud - b.scud).abs() < 0.05, "{t}");
            assert!((a.slow - b.slow).abs() < 0.01, "{t}");
            assert!(distance(a.arm.hand, b.arm.hand) < 0.012, "{t}");
        });
    }

    #[test]
    fn the_still_frame_is_the_warm_cloud_from_the_side() {
        let f = compose(STILL);
        assert!(close(f.glow, GLOW_LIGHT, 1e-4) && f.flash == 0.0 && f.moon == 1.0);
        assert!(f.star_light.iter().all(|l| l[0] == 0.0));
        assert!(through_glass(f.camera.eye, f.glow_way));
        // From the side: he and the window both in view, the camera off his
        // back.
        assert!(f.camera.eye[0] > 1.2);
        assert!(f.camera.project(HEAD).is_some_and(in_frame));
    }

    #[test]
    fn every_dark_theme_has_its_own_cold_and_warm() {
        let codes = [0, 2, 3, 4];
        for (i, &a) in codes.iter().enumerate() {
            let l = look(a);
            assert!(distance(l.cold, l.warm) > 0.3, "{a}");
            for &b in &codes[i + 1..] {
                assert_ne!(look(a), look(b));
            }
        }
        for retired in [1, 5, 6] {
            assert_eq!(look(retired), look(2));
        }
    }
}
