//! «Внимание внутрь», page 04 of Step 6 «Внутреннее кольцо», direction
//! «Фонарь». A person sits upright on a chair, dark and matte, seen over the
//! shoulder. Round them lies the cold outer ring, always on; hugging the body
//! the warm inner ring. «Не меняй позу»: the ring rests round the head; «Не
//! напрягай себя»: it scans down to the feet; «направь луч внимания внутрь»:
//! it rises to the crown and turns its light inward, a warm column runs down
//! the spine; «сканируй»: the camera follows the light in through the back.
//! Inside is a dark space; the cold outer ring still shows, turning round it
//! all; the warm inner ring is the rim of a lantern and its beam is
//! attention. Each question brings its own plain thing into the beam:
//! thoughts rise as bubbles with lines of words in them, an emotion rolls
//! over everything as a warm wave, micro-feelings slip across as sparks,
//! impulses flash as little lightnings, an urge drains everything into a
//! warm whirl. «Не пытайся понять», «Не объясняй», «Не ищи причину»: the beam
//! narrows to a needle and chases one thread to a tangled ball, then lets go
//! and the ball sinks into the dark. «Свидетельствуй»: the beam opens wide
//! and just shines on what passes. «ты сканируешь и считываешь»: the camera
//! comes back out to the calmly sitting person.
//! Every value here is a pure function of loop time; `browser.rs` only
//! uploads it and one ray-traced pass draws it. Unit: the
//! person sits about 1.43 high; the floor is y = 0, the person faces +z.
use crate::body::{dot, length, scale, sub, V};
use std::f32::consts::{PI, TAU};
use std::sync::OnceLock;
use watcher_scene_palette::Palette;

pub mod body;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerLantern;

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
/// One meaningful still frame for reduced motion: «Свидетельствуй», the
/// beam wide open and steady, a thought and sparks passing through it.
pub const STILL: f32 = 53.5;

// ---------- the room

/// The outer ring round the person: level, its centre (x, y, z) and radius.
/// It is always on, in the room and inside.
pub const OUTER: [f32; 4] = [0.0, 0.8, 0.1, 1.35];
/// The inner ring hugs the body; by height: (y, centre z, radius).
pub const HUG: [[f32; 3]; 6] = [
    [0.05, 0.56, 0.17],
    [0.35, 0.45, 0.2],
    [0.55, 0.17, 0.42],
    [0.8, 0.0, 0.31],
    [1.1, -0.05, 0.3],
    [1.3, -0.02, 0.18],
];
/// Above the crown, where it turns its light inward: (y, centre z, radius).
pub const HALO: [f32; 3] = [1.47, -0.02, 0.17];
/// It scans from the head down to the feet, fades out there and comes back
/// above the crown; at the end it settles back round the head.
pub const SCAN: [f32; 2] = [4.4, 8.2];
pub const RING_DIP: [f32; 4] = [8.0, 8.7, 8.8, 9.6];
pub const SETTLE: [f32; 2] = [61.0, 63.0];
pub const RING_LIGHT: f32 = 0.9;
/// The light inside the body, crown to pelvis: it runs down from the top
/// for «направь луч», and fades when the camera is out again.
pub const COLUMN: [[f32; 3]; 2] = [[0.0, 1.37, -0.02], [0.0, 0.52, 0.0]];
pub const COLUMN_RUN: [f32; 2] = [9.4, 12.2];
pub const COLUMN_ON: [f32; 4] = [9.0, 10.3, 59.5, 62.5];
/// How far the camera is inside: it crosses the back right after the room
/// fades out, and is out of it again before the room fades back in.
pub const ENTER: [f32; 2] = [14.5, 15.2];
pub const LEAVE: [f32; 2] = [58.9, 59.6];

/// The room camera, keyed through the loop: eye (x, y, z), the point it
/// looks at, the height of the frame (degrees). Over the right shoulder from
/// behind; in toward the back for «сканируй», through it just above the
/// backrest (hidden keys while inside), back out at the end.
pub const ROOM: [(f32, [f32; 7]); 11] = [
    (0.0, [1.55, 1.75, -2.2, 0.0, 0.76, 0.12, 38.0]),
    (4.0, [1.72, 1.8, -2.36, 0.0, 0.72, 0.14, 38.0]),
    (8.2, [1.42, 1.72, -2.05, 0.0, 0.8, 0.1, 38.0]),
    (11.0, [0.62, 1.42, -1.5, 0.0, 0.98, 0.0, 38.0]),
    (13.4, [0.1, 1.1, -0.72, 0.0, 1.03, 0.3, 40.0]),
    (15.2, [0.0, 1.04, -0.162, 0.0, 1.03, 0.6, 42.0]),
    (16.5, [0.0, 1.04, -0.04, 0.0, 1.03, 0.8, 42.0]),
    (57.5, [0.0, 1.04, -0.04, 0.0, 1.03, 0.8, 42.0]),
    (58.9, [0.0, 1.04, -0.162, 0.0, 1.03, 0.6, 42.0]),
    (60.6, [0.15, 1.15, -0.8, 0.0, 1.06, 0.2, 42.0]),
    (62.6, [1.0, 1.55, -1.75, 0.0, 0.82, 0.12, 38.5]),
];

// ---------- inside

/// The lantern: the mouth of the beam, the way it points at rest, the
/// radius of its rim (the inner ring inside).
pub const MOUTH: V = [-1.5, 0.5, -2.3];
pub const AIM: V = [0.58, -0.21, -0.79];
pub const MOUTH_R: f32 = 0.2;
/// The outer ring inside: level, low, round the whole inside; its back half
/// is a wide arc low in the frame, turning like the one in the room.
pub const OUTER_IN: [f32; 4] = [0.0, -2.0, -2.6, 3.0];
/// The outer ring's ticks turn once in this many seconds (two turns a loop).
pub const TURN: f32 = 32.0;
/// The beam's half angle (tangent): scanning, the needle, wide open.
pub const SPREAD: [f32; 3] = [0.12, 0.022, 0.21];
pub const BEAM_ON: [f32; 4] = [14.2, 15.8, 59.8, 61.2];
/// The needle: it narrows, chases one thread to the knot, lets go and opens
/// wide; then back to the scanning width for «ты сканируешь».
pub const NARROW: [f32; 2] = [39.2, 40.8];
pub const CHASE: [f32; 2] = [40.8, 49.3];
pub const LET_GO: [f32; 2] = [49.6, 51.5];
pub const READ: [f32; 2] = [55.0, 56.6];
/// The dark knot the thread leads to: on, off; and how it sinks away.
pub const KNOT_ON: [f32; 4] = [43.5, 46.0, 49.8, 51.5];
pub const SINK: [f32; 2] = [49.8, 51.6];
/// Emotions: a warm tide rolls along the beam; «Свидетельствуй» has a faint
/// one.
pub const TIDE: [f32; 4] = [21.2, 22.4, 24.4, 25.6];
pub const TIDE_CALM: [f32; 4] = [51.3, 52.6, 55.0, 56.5];
/// And waves of it roll out from the beam over the whole frame: when each
/// starts, how long it rolls, how far (frame heights from its centre).
pub const WAVES: [f32; 3] = [21.4, 23.1, 52.2];
pub const WAVE_ALONG: [f32; 3] = [2.2, 3.4, 2.8];
pub const WAVE_STRENGTH: [f32; 3] = [1.0, 0.85, 0.45];
pub const WAVE_LIFE: f32 = 2.6;
pub const WAVE_REACH: f32 = 2.4;
/// Impulses: three jolts, each flashes two little lightnings across the
/// beam, this far along it.
pub const JOLTS: [f32; 3] = [30.8, 31.9, 33.0];
pub const BOLTS: [[f32; 2]; 3] = [[1.7, 3.6], [2.6, 4.4], [1.4, 3.1]];
/// Thoughts: when each rises (its two small bubbles come a little before),
/// how far along the beam, how long it lives, how fast it rises.
pub const THOUGHTS: [f32; 4] = [16.5, 17.1, 17.7, 18.3];
pub const THOUGHT_ALONG: [f32; 4] = [1.5, 2.7, 3.8, 4.8];
pub const THOUGHT_LIFE: f32 = 3.3;
pub const RISE: f32 = 0.34;
/// A bubble pops in its last this many seconds.
pub const POP: f32 = 0.4;
/// The urge: everything is drawn into a warm whirl low on the left, then let
/// go; the pull's way is from the middle of the beam to the whirl.
pub const MAGNET: V = [-1.25, -0.6, -4.1];
pub const PULL: V = [-0.896, -0.284, 0.341];
pub const PULL_ON: [f32; 4] = [35.0, 36.8, 38.0, 39.3];

/// The inside camera, keyed (hidden while in the room): close to the
/// lantern as it comes in, back to a wide side view of the beam, a little
/// closer for the micro-feelings, wider for «Свидетельствуй», drifting back
/// on the way out.
pub const WITHIN: [(f32, [f32; 7]); 11] = [
    (14.3, [-0.95, 0.66, -1.3, -1.08, 0.36, -2.95, 48.0]),
    (17.6, [-0.35, 0.3, -0.45, -0.1, 0.3, -3.4, 56.0]),
    (20.0, [0.0, 0.05, 0.0, 0.15, 0.3, -4.0, 60.0]),
    (26.0, [0.08, 0.04, -0.15, 0.2, 0.28, -4.0, 60.0]),
    (31.5, [0.05, 0.0, -0.35, 0.2, 0.28, -4.0, 58.0]),
    (36.0, [-0.08, 0.04, -0.05, 0.1, 0.25, -4.0, 60.0]),
    (39.5, [0.0, 0.02, -0.1, 0.15, 0.3, -4.0, 60.0]),
    (45.0, [0.1, 0.0, -0.3, 0.2, 0.25, -4.0, 58.0]),
    (51.0, [0.0, 0.06, 0.25, 0.15, 0.3, -4.0, 62.0]),
    (55.5, [-0.05, 0.08, 0.5, 0.1, 0.3, -4.0, 62.0]),
    (59.8, [-0.25, 0.2, 1.1, 0.0, -0.05, -4.0, 58.0]),
];

/// Shader slots: threads of points, sparks, bubbles.
pub const THREADS: usize = 5;
pub const POINTS: usize = 20;
pub const GLINTS: usize = 16;
pub const BUBBLES: usize = 12;

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

fn add(a: V, b: V) -> V {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

fn mix(a: V, b: V, s: f32) -> V {
    add(a, scale(sub(b, a), s))
}

fn cross(a: V, b: V) -> V {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn norm(a: V) -> V {
    scale(a, 1.0 / length(a).max(1e-9))
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

// ---------- the cameras

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
    /// How far ahead a point lies.
    pub fn depth(&self, p: V) -> f32 {
        dot(sub(p, self.eye), self.forward)
    }
}

pub fn in_frame([x, y]: [f32; 2]) -> bool {
    x.abs() < FRAME_ASPECT && y.abs() < 1.0
}

pub fn inside(t: f32) -> f32 {
    smooth(ENTER[0], ENTER[1], t) - smooth(LEAVE[0], LEAVE[1], t)
}

pub fn room(t: f32) -> Camera {
    let [ex, ey, ez, tx, ty, tz, fov] = keyed(&ROOM, t);
    Camera::toward([ex, ey, ez], [tx, ty, tz], fov)
}

// ---------- the room

fn hug(y: f32) -> [f32; 3] {
    let last = HUG.len() - 1;
    let i = HUG
        .iter()
        .rposition(|k| k[0] <= y)
        .unwrap_or(0)
        .min(last - 1);
    let (a, b) = (HUG[i], HUG[i + 1]);
    let s = smooth(a[0], b[0], y);
    [y, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]
}

/// The inner ring in the room: its height, centre z, radius and light.
pub fn ring(t: f32) -> [f32; 4] {
    let head = HUG[HUG.len() - 1][0];
    let feet = HUG[0][0];
    let light = RING_LIGHT * (1.0 - window(t, RING_DIP));
    let [y, z, r] = if t < 0.5 * (RING_DIP[1] + RING_DIP[2]) {
        hug(head + (feet - head) * smooth(SCAN[0], SCAN[1], t))
    } else {
        let s = smooth(SETTLE[0], SETTLE[1], t);
        let rest = hug(head);
        std::array::from_fn(|k| HALO[k] + (rest[k] - HALO[k]) * s)
    };
    [y, z, r, light]
}

/// The column inside the body: how far down its front has run, its light.
pub fn column(t: f32) -> [f32; 2] {
    let top = COLUMN[0][1];
    let low = COLUMN[1][1];
    [
        top + (low - top) * smooth(COLUMN_RUN[0], COLUMN_RUN[1], t),
        window(t, COLUMN_ON),
    ]
}

// ---------- inside: the beam

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Beam {
    pub mouth: V,
    pub aim: V,
    /// Tangent of its half angle.
    pub spread: f32,
    pub light: f32,
}

impl Beam {
    /// How much of the beam's light falls on a point, 0..1.
    pub fn cone(&self, p: V) -> f32 {
        let v = sub(p, self.mouth);
        let along = dot(v, self.aim);
        let off = length(sub(v, scale(self.aim, along)));
        let rad = 0.04 + along.max(0.0) * self.spread;
        (-(off / rad).powi(2) * 2.2).exp() * smooth(-0.1, 0.3, along)
    }
}

fn base() -> V {
    norm(AIM)
}

/// The needle: 0 scanning, 1 while it chases.
pub fn needle(t: f32) -> f32 {
    smooth(NARROW[0], NARROW[1], t) - smooth(LET_GO[0], LET_GO[1], t)
}

/// How far along the chased thread the needle is, 0..0.97.
pub fn chase(t: f32) -> f32 {
    0.97 * (0.8 * smooth(CHASE[0], CHASE[1], t) + 0.2 * smooth(44.0, 46.4, t))
}

pub fn pull(t: f32) -> f32 {
    window(t, PULL_ON)
}

/// How far the pull has carried the dust (the integral of `pull`).
fn pulled(t: f32) -> f32 {
    0.8 * (ramp(PULL_ON[0], PULL_ON[1], t) - ramp(PULL_ON[2], PULL_ON[3], t))
}

/// The jolts of the impulses, 0..1: a quick rise, a slower settling.
pub fn jolt(t: f32) -> f32 {
    JOLTS
        .iter()
        .map(|&j| {
            smooth(j - 0.1, j + 0.1, t)
                * (-(t - j).max(0.0) / 0.5).exp()
                * (1.0 - smooth(j + 1.2, j + 1.8, t))
        })
        .sum()
}

pub fn beam(t: f32) -> Beam {
    let b = base();
    let (side, lift) = across(b);
    let calm = 1.0 - needle(t);
    let yaw = 0.1 * (TAU * (t - 15.0) / 14.0).sin() * calm;
    let pitch = 0.05 * (TAU * (t - 15.0) / 9.3).sin() * calm;
    let mut d = add(b, add(scale(side, yaw), scale(lift, pitch)));
    d = add(d, scale(norm(PULL), 0.06 * pull(t)));
    for &j in &JOLTS {
        let a = t - j;
        if a > 0.0 {
            d = add(
                d,
                scale(lift, 0.025 * (-a / 0.4).exp() * (TAU * a * 2.4).sin()),
            );
        }
    }
    let chased = norm(sub(chase_point(t), MOUTH));
    let aim = norm(mix(norm(d), chased, needle(t)));
    let narrow = smooth(NARROW[0], NARROW[1], t);
    let open = smooth(LET_GO[0], LET_GO[1], t);
    let back = smooth(READ[0], READ[1], t);
    let [scan, thin, wide] = SPREAD;
    Beam {
        mouth: MOUTH,
        aim,
        spread: scan + (thin - scan) * narrow + (wide - thin) * open + (scan - wide) * back,
        light: window(t, BEAM_ON) * (1.0 + 0.25 * needle(t) - 0.15 * (open - back)),
    }
}

/// The warm tide of «какие эмоции»: where along the beam it is, how wide,
/// how strong; and the jolts, which stir the dust.
pub fn tide(t: f32) -> [f32; 4] {
    let along = if t < 40.0 {
        0.6 + 4.9 * smooth(21.0, 25.5, t)
    } else {
        1.0 + 3.5 * smooth(51.0, 56.5, t)
    };
    [
        along,
        1.4,
        window(t, TIDE) + 0.35 * window(t, TIDE_CALM),
        jolt(t),
    ]
}

/// The `i`th wave of an emotion: how far it has rolled out from its centre
/// (frame heights) and how strong it is. It sets off fast and slows, fading.
pub fn wave(i: usize, t: f32) -> [f32; 2] {
    let a = (t - WAVES[i]) / WAVE_LIFE;
    if !(0.0..1.0).contains(&a) {
        return [0.0, 0.0];
    }
    let gone = 1.0 - a;
    [
        WAVE_REACH * (1.0 - gone * gone),
        WAVE_STRENGTH[i] * smooth(0.0, 0.7 / WAVE_LIFE, a) * gone.powf(1.3),
    ]
}

/// The knot the needle chases to, sinking away when it lets go.
pub fn knot(t: f32) -> V {
    let b = base();
    let (side, lift) = across(b);
    let at = add(
        add(MOUTH, scale(b, 6.5)),
        add(scale(side, -0.55), scale(lift, -0.35)),
    );
    add(at, scale(b, 1.6 * smooth(SINK[0], SINK[1], t)))
}

// ---------- inside: bubbles, threads and sparks

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    /// «какие мысли»: bubbles with lines of words rising into the beam.
    Thought,
    /// «какие импульсы»: little lightnings across the beam.
    Impulse,
    /// The one thread the needle chases.
    Chase,
    /// Threads that lead into the knot, a tangled ball.
    Knot,
    /// «Свидетельствуй», «ты сканируешь»: bubbles and sparks that come and
    /// go by themselves.
    Calm,
    /// «какие микро-чувства»: sparks slipping across the beam.
    Micro,
    /// The sparks a jolt throws off.
    Burst,
    /// «есть ли позыв»: sparks drawn into the warm whirl.
    Stream,
}

/// A thread: on/off, its ends, how it drifts, its waves (amplitude,
/// wavelengths along it, how fast they move), seed, light; pinned at its far
/// end (the chased thread and the knot's threads end in the knot).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Strand {
    pub kind: Kind,
    pub on: [f32; 4],
    pub from: V,
    pub to: V,
    pub drift: V,
    pub wave: [f32; 3],
    pub seed: f32,
    pub light: f32,
    pub width: f32,
}

impl Strand {
    pub fn env(&self, t: f32) -> f32 {
        window(t, self.on)
    }
    fn pinned(&self) -> bool {
        matches!(self.kind, Kind::Chase | Kind::Knot)
    }
    /// The point `s` (0..1) along it at `t`.
    pub fn point(&self, s: f32, t: f32) -> V {
        let (n1, n2) = across(norm(sub(self.to, self.from)));
        let [amp, waves, speed] = self.wave;
        let ph = self.seed * TAU;
        let pin = if self.pinned() { 1.0 - s * s } else { 1.0 };
        let w1 = amp * pin * (TAU * waves * s + ph + speed * t).sin();
        let w2 = 0.6 * amp * pin * (TAU * waves * 0.6 * s + 1.7 * ph + 0.7 * speed * t).sin();
        let mut p = mix(self.from, self.to, s);
        p = add(p, scale(self.drift, t - self.on[0]));
        p = add(p, add(scale(n1, w1), scale(n2, w2)));
        if self.kind == Kind::Impulse {
            // A lightning: every point knocked aside at random, the ends held.
            let i = (s * (POINTS - 1) as f32).round() as u32;
            let k = (self.seed * 65_536.0) as u32 * 31 + i;
            let amp = 0.055 * (PI * s).sin();
            p = add(
                p,
                add(
                    scale(n1, amp * (2.0 * noise(k) - 1.0)),
                    scale(n2, 0.4 * amp * (2.0 * noise(k + 977) - 1.0)),
                ),
            );
        }
        add(p, scale(norm(PULL), pull(t) * (0.3 + 0.5 * s) * 0.8))
    }
    /// The light of the point `s` at `t` under the beam.
    pub fn light(&self, s: f32, p: V, t: f32, beam: &Beam) -> f32 {
        let lit = beam.cone(p) * beam.light;
        let mut l = self.light * (0.22 + 1.6 * lit);
        match self.kind {
            Kind::Impulse => {
                // A flash, then a flicker as it dies.
                let a = (t - self.on[1]).max(0.0);
                let flash = 1.3 * (-a / 0.18).exp();
                let flicker = 0.85 + 0.15 * (a * 63.0 + self.seed * TAU).sin();
                l = self.light * (0.4 + 1.1 * lit + flash) * flicker;
            }
            Kind::Chase => {
                let u = chase(t);
                let near = (-((s - u) / 0.05).powi(2)).exp();
                let behind = if s <= u { (-(u - s) / 0.2).exp() } else { 0.0 };
                l += 0.12 + needle(t) * (0.9 * near + 0.25 * behind);
            }
            Kind::Knot => l += 0.16,
            _ => {}
        }
        self.env(t) * l
    }
}

/// A spark: when it starts, how long it lives, where from, how it moves,
/// its size and light.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Spark {
    pub kind: Kind,
    pub at: f32,
    pub life: f32,
    pub from: V,
    pub vel: V,
    pub light: f32,
}

impl Spark {
    pub fn env(&self, t: f32) -> f32 {
        let a = t - self.at;
        if a > 0.0 && a < self.life {
            (PI * a / self.life).sin().powi(2)
        } else {
            0.0
        }
    }
    pub fn place(&self, t: f32) -> V {
        add(self.from, scale(self.vel, t - self.at))
    }
}

/// A point `along` the resting beam, `s` to its side and `l` up from it.
fn by_beam(along: f32, s: f32, l: f32) -> V {
    let b = base();
    let (side, lift) = across(b);
    add(
        add(MOUTH, scale(b, along)),
        add(scale(side, s), scale(lift, l)),
    )
}

/// The beam's radius `along` it while scanning.
fn reach(along: f32) -> f32 {
    0.04 + along * SPREAD[0]
}

/// A thread centred at `c`, `len` long, lying along `dir`.
fn laid(kind: Kind, on: [f32; 4], c: V, dir: V, len: f32, seed: u32) -> Strand {
    let d = scale(norm(dir), 0.5 * len);
    Strand {
        kind,
        on,
        from: sub(c, d),
        to: add(c, d),
        drift: [0.0; 3],
        wave: [
            0.035 + 0.03 * noise(seed),
            1.0 + 0.5 * noise(seed + 1),
            0.6 + 0.5 * noise(seed + 2),
        ],
        seed: noise(seed + 3),
        light: 1.0,
        width: 0.009,
    }
}

pub fn strands() -> &'static [Strand] {
    static ALL: OnceLock<Vec<Strand>> = OnceLock::new();
    ALL.get_or_init(|| {
        let b = base();
        let (side, lift) = across(b);
        let mut all = Vec::new();
        // Impulses: each jolt flashes two little lightnings across the beam,
        // standing nearly upright.
        for (j, (&tj, alongs)) in JOLTS.iter().zip(&BOLTS).enumerate() {
            for (i, &along) in alongs.iter().enumerate() {
                let k = (j * 2 + i) as u32 * 5 + 61;
                let dir = add(scale(lift, 0.9), scale(side, 0.5 * (noise(k) - 0.5)));
                let c = by_beam(
                    along,
                    0.5 * reach(along) * (noise(k + 1) - 0.5),
                    0.1 * (noise(k + 2) - 0.5),
                );
                let o = 0.07 * i as f32;
                let mut s = laid(
                    Kind::Impulse,
                    [tj - 0.02 + o, tj + 0.06 + o, tj + 0.25 + o, tj + 0.9],
                    c,
                    dir,
                    2.4 * reach(along) + 0.25,
                    k,
                );
                s.wave = [0.0, 1.0, 0.0];
                s.width = 0.007;
                all.push(s);
            }
        }
        // The chased thread: from near the lantern, wandering across, into
        // the knot.
        let mut chased = laid(
            Kind::Chase,
            [38.6, 39.6, 50.4, 51.6],
            [0.0; 3],
            [1.0, 0.0, 0.0],
            1.0,
            131,
        );
        chased.from = by_beam(1.8, 0.9, 0.15);
        chased.to = knot(0.0);
        chased.wave = [0.12, 1.1, 0.3];
        chased.width = 0.012;
        all.push(chased);
        // Threads that lead into the knot.
        let ways: [V; 4] = [
            [0.9, 0.5, 0.2],
            [-0.6, 0.7, -0.4],
            [0.3, -0.8, 0.6],
            [-0.8, -0.4, 0.1],
        ];
        for (i, w) in ways.iter().enumerate() {
            let k = i as u32 * 3 + 151;
            let o = 0.5 * i as f32;
            let p = 0.2 * i as f32;
            let to = knot(0.0);
            let from = add(to, scale(norm(*w), 1.2 + 0.8 * noise(k)));
            let mut s = laid(
                Kind::Knot,
                [44.0 + o, 45.5 + o, 49.4 + p, 50.6 + p],
                [0.0; 3],
                [1.0, 0.0, 0.0],
                1.0,
                k,
            );
            s.from = from;
            s.to = to;
            s.light = 0.7;
            all.push(s);
        }
        all
    })
}

/// A bubble: a thought with lines of words in it, or one of the two small
/// ones trailing below it. When it comes, how long it lives, where it is
/// when it comes, how it rises, its radius, the seed of its thought.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Bubble {
    pub kind: Kind,
    pub at: f32,
    pub life: f32,
    pub from: V,
    pub vel: V,
    pub radius: f32,
    pub words: bool,
    pub seed: f32,
}

impl Bubble {
    /// How far it has popped, 0..1, over its last `POP` seconds.
    pub fn pop(&self, t: f32) -> f32 {
        let end = self.at + self.life;
        smooth(end - POP, end, t)
    }
    pub fn env(&self, t: f32) -> f32 {
        let a = t - self.at;
        if a > 0.0 && a < self.life {
            smooth(0.0, 0.5, a) * (1.0 - self.pop(t))
        } else {
            0.0
        }
    }
    /// How much of its words have been written, line by line, 0..1.
    pub fn written(&self, t: f32) -> f32 {
        smooth(self.at + 0.3, self.at + 1.8, t)
    }
    /// Where it is: rising, all of its thought swaying together.
    pub fn place(&self, t: f32) -> V {
        let (side, _) = across(base());
        let sway = 0.035 * (TAU * (0.4 * t + self.seed)).sin();
        add(
            add(self.from, scale(self.vel, t - self.at)),
            scale(side, sway),
        )
    }
}

/// A thought: a big bubble with words and two small ones trailing below,
/// which come a little before it and pop a little after. It rises at `rise`
/// from the dark and crosses the beam `along` it, `s` to its side, halfway
/// through its `life`.
fn thought(
    kind: Kind,
    born: f32,
    life: f32,
    along: f32,
    s: f32,
    rise: f32,
    seed: u32,
) -> [Bubble; 3] {
    let (side, _) = across(base());
    let up = [0.0, 1.0, 0.0];
    let radius = 0.24 + 0.05 * noise(seed);
    let vel = scale(up, rise);
    // Where the swaying beam really is when it crosses it.
    let crossing = add(
        add(MOUTH, scale(beam(born + 0.5 * life).aim, along)),
        scale(side, s),
    );
    let centre = sub(crossing, scale(vel, 0.5 * life));
    let group = noise(seed + 1);
    // (radius, how far below, how far aside), in the big one's radii.
    let trail = [(1.0, 0.0, 0.0), (0.3, 1.32, -0.3), (0.16, 1.85, -0.62)];
    std::array::from_fn(|i| {
        let (size, down, aside) = trail[i];
        let at = born - 0.15 * i as f32;
        let offset = add(scale(up, -down * radius), scale(side, aside * radius));
        Bubble {
            kind,
            at,
            life: life + 0.27 * i as f32,
            from: add(add(centre, offset), scale(vel, at - born)),
            vel,
            radius: size * radius,
            words: i == 0,
            seed: group,
        }
    })
}

pub fn bubbles() -> &'static [Bubble] {
    static ALL: OnceLock<Vec<Bubble>> = OnceLock::new();
    ALL.get_or_init(|| {
        let mut all = Vec::new();
        // Thoughts rise out of the dark into the beam, one side and the
        // other, and pop.
        for (i, (&born, &along)) in THOUGHTS.iter().zip(&THOUGHT_ALONG).enumerate() {
            let s = if i % 2 == 0 { -0.3 } else { 0.3 } * reach(along);
            let k = 701 + i as u32 * 7;
            all.extend(thought(
                Kind::Thought,
                born,
                THOUGHT_LIFE,
                along,
                s,
                RISE,
                k,
            ));
        }
        // «Свидетельствуй», «ты сканируешь»: two pass slowly by themselves.
        all.extend(thought(
            Kind::Calm,
            51.9,
            4.4,
            2.4,
            0.2 * reach(2.4),
            0.2,
            761,
        ));
        all.extend(thought(
            Kind::Calm,
            55.2,
            4.0,
            3.6,
            -0.25 * reach(3.6),
            0.22,
            771,
        ));
        all
    })
}

/// A spark crossing the beam at `along`, through the point `off` from its
/// axis, at `at`, for `life`, `speed` fast.
fn crossing(kind: Kind, at: f32, life: f32, along: f32, seed: u32, speed: f32) -> Spark {
    let b = base();
    let (side, lift) = across(b);
    let r = reach(along);
    let a = TAU * noise(seed);
    let dir = add(scale(side, a.cos()), scale(lift, a.sin()));
    let c = by_beam(
        along,
        0.5 * r * (noise(seed + 1) - 0.5),
        0.5 * r * (noise(seed + 2) - 0.5),
    );
    let vel = scale(dir, speed);
    Spark {
        kind,
        at,
        life,
        from: sub(c, scale(vel, 0.5 * life)),
        vel,
        light: 1.0,
    }
}

pub fn sparks() -> &'static [Spark] {
    static ALL: OnceLock<Vec<Spark>> = OnceLock::new();
    ALL.get_or_init(|| {
        let mut all = Vec::new();
        // Micro-feelings: quick sparks slipping across the beam.
        for i in 0..28u32 {
            let k = 301 + i * 5;
            let at = 25.6 + 3.6 * i as f32 / 27.0 + 0.15 * (noise(k) - 0.5);
            let life = 0.9 + 0.6 * noise(k + 1);
            let along = 0.8 + 4.5 * noise(k + 2);
            all.push(crossing(
                Kind::Micro,
                at,
                life,
                along,
                k + 3,
                2.2 * reach(along) / life,
            ));
        }
        // What each jolt throws off, from its two lightnings.
        for (j, &tj) in JOLTS.iter().enumerate() {
            for i in 0..5u32 {
                let k = 421 + j as u32 * 31 + i * 5;
                let line = strands()
                    .iter()
                    .filter(|s| s.kind == Kind::Impulse)
                    .nth(2 * j + i as usize % 2)
                    .copied()
                    .expect("two lightnings a jolt");
                let from = mix(line.from, line.to, 0.2 + 0.6 * noise(k));
                let a = TAU * noise(k + 1);
                let z = 2.0 * noise(k + 2) - 1.0;
                let r = (1.0 - z * z).sqrt();
                all.push(Spark {
                    kind: Kind::Burst,
                    at: tj + 0.03 * i as f32,
                    life: 0.5 + 0.3 * noise(k + 3),
                    from,
                    vel: [0.5 * r * a.cos(), 0.5 * z, 0.5 * r * a.sin()],
                    light: 0.9,
                });
            }
        }
        // The urge: sparks from all over the beam are drawn into the whirl.
        for i in 0..12u32 {
            let k = 521 + i * 5;
            let along = 1.0 + 4.0 * noise(k);
            let r = reach(along);
            let from = by_beam(
                along,
                1.4 * r * (noise(k + 1) - 0.5),
                1.4 * r * (noise(k + 2) - 0.5),
            );
            let life = 1.3 + 0.4 * noise(k + 3);
            all.push(Spark {
                kind: Kind::Stream,
                at: 35.2 + 2.6 * i as f32 / 11.0,
                life,
                from,
                vel: scale(sub(MAGNET, from), 0.85 / life),
                light: 1.0,
            });
        }
        // «Свидетельствуй» and «ты сканируешь»: a few slow ones.
        for i in 0..10u32 {
            let k = 621 + i * 5;
            let at = if i < 6 {
                51.6 + 3.7 * i as f32 / 5.0
            } else {
                55.8 + 2.4 * (i - 6) as f32 / 3.0
            };
            let life = 1.0 + 0.5 * noise(k);
            let along = 1.0 + 4.0 * noise(k + 1);
            all.push(crossing(Kind::Calm, at, life, along, k + 2, 0.25));
        }
        all
    })
}

/// The point the needle points at: where it is on the chased thread.
pub fn chase_point(t: f32) -> V {
    let chased = strands()
        .iter()
        .find(|s| s.kind == Kind::Chase)
        .expect("the chased thread");
    chased.point(chase(t), t)
}

pub fn within(t: f32) -> Camera {
    let [ex, ey, ez, tx, ty, tz, fov] = keyed(&WITHIN, t);
    let (mut eye, mut target) = ([ex, ey, ez], [tx, ty, tz]);
    // While the needle chases, the camera turns after it.
    let n = needle(t);
    if n > 0.0 {
        let c = chase_point(t);
        target = mix(target, c, 0.4 * n);
        eye = mix(eye, c, 0.12 * n);
    }
    Camera::toward(eye, target, fov)
}

// ---------- one frame

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    /// Loop time, for the shader's own small motions.
    pub time: f32,
    /// 0 in the room, 1 inside.
    pub inside: f32,
    pub room: Camera,
    pub within: Camera,
    /// The inner ring in the room (y, centre z, radius, light), the column
    /// (front y, light), how far the outer ring's ticks have turned.
    pub ring: [f32; 4],
    pub column: [f32; 2],
    pub ticks: f32,
    pub beam: Beam,
    pub tide: [f32; 4],
    /// The pull: its way (x, y, z) and how far it has carried the dust; and
    /// its strength.
    pub pull: [f32; 4],
    pub tug: f32,
    /// The knot in the frame: x, y, size, light.
    pub knot: [f32; 4],
    /// The whirl of the urge in the frame: x, y, size, strength.
    pub magnet: [f32; 4],
    /// The waves of an emotion: their centre in the frame, how far they have
    /// rolled, how strong.
    pub waves: [[f32; 4]; 2],
    /// The bubbles, brightest first: (x, y, radius, light); and for each
    /// (has words, seed, how far popped, how much of the words is written).
    pub bubbles: [[f32; 4]; BUBBLES],
    pub marks: [[f32; 4]; BUBBLES],
    /// Each thread's points in the frame (x, y, half width, light), and the
    /// box round each (min x, min y, max x, max y).
    pub threads: [[f32; 4]; THREADS * POINTS],
    pub boxes: [[f32; 4]; THREADS],
    /// The sparks, brightest first: (x, y, size, light), and the streak
    /// behind each (dx, dy).
    pub glints: [[f32; 4]; GLINTS],
    pub tails: [[f32; 4]; GLINTS],
}

const EMPTY: [f32; 4] = [9.0, 9.0, -9.0, -9.0];

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let cam = within(time);
    let beam = beam(time);
    let mut threads = [[0.0; 4]; THREADS * POINTS];
    let mut boxes = [EMPTY; THREADS];
    let alive = strands().iter().filter(|s| s.env(time) > 0.0);
    for (slot, s) in alive.take(THREADS).enumerate() {
        let mut bx = EMPTY;
        for (i, out) in threads[slot * POINTS..(slot + 1) * POINTS]
            .iter_mut()
            .enumerate()
        {
            let u = i as f32 / (POINTS - 1) as f32;
            let p = s.point(u, time);
            let Some([x, y]) = cam.project(p) else {
                *out = [9.0, 9.0, 0.0, 0.0];
                continue;
            };
            let w = s.width / (cam.depth(p) * cam.lens);
            *out = [x, y, w, s.light(u, p, time, &beam).min(1.6)];
            let pad = 12.0 * w + 0.03;
            bx = [
                bx[0].min(x - pad),
                bx[1].min(y - pad),
                bx[2].max(x + pad),
                bx[3].max(y + pad),
            ];
        }
        boxes[slot] = bx;
    }
    let mut lit: Vec<([f32; 4], [f32; 4])> = sparks()
        .iter()
        .filter(|s| s.env(time) > 0.0)
        .filter_map(|s| {
            let p = s.place(time);
            let [x, y] = cam.project(p)?;
            let tail = if s.kind == Kind::Stream { 0.3 } else { 0.12 };
            let [bx, by] = cam.project(sub(p, scale(s.vel, tail)))?;
            let size = 0.02 / (cam.depth(p) * cam.lens);
            let light = s.env(time) * s.light * (0.3 + 1.4 * beam.cone(p) * beam.light);
            Some(([x, y, size, light], [bx - x, by - y, 0.0, 0.0]))
        })
        .collect();
    lit.sort_by(|a, b| b.0[3].total_cmp(&a.0[3]));
    let mut glints = [[0.0; 4]; GLINTS];
    let mut tails = [[0.0; 4]; GLINTS];
    for (i, (g, tail)) in lit.into_iter().take(GLINTS).enumerate() {
        glints[i] = g;
        tails[i] = tail;
    }
    let k = knot(time);
    let knot = match cam.project(k) {
        Some([x, y]) => [x, y, 0.4 / (cam.depth(k) * cam.lens), window(time, KNOT_ON)],
        None => [9.0, 9.0, 0.0, 0.0],
    };
    let magnet = match cam.project(MAGNET) {
        Some([x, y]) => [x, y, 0.55 / (cam.depth(MAGNET) * cam.lens), pull(time)],
        None => [9.0, 9.0, 0.0, 0.0],
    };
    let mut waves = [[9.0, 9.0, 0.0, 0.0]; 2];
    let rolling = WAVE_ALONG.iter().enumerate().filter_map(|(i, &along)| {
        let [r, strength] = wave(i, time);
        let [x, y] = cam.project(by_beam(along, 0.0, 0.0))?;
        (strength > 0.0).then_some([x, y, r, strength])
    });
    for (slot, w) in waves.iter_mut().zip(rolling) {
        *slot = w;
    }
    let mut floating: Vec<([f32; 4], [f32; 4])> = bubbles()
        .iter()
        .filter(|b| b.env(time) > 0.0)
        .filter_map(|b| {
            let p = b.place(time);
            let [x, y] = cam.project(p)?;
            let pop = b.pop(time);
            let r = (b.radius * (1.0 + 0.3 * pop) / (cam.depth(p) * cam.lens)).min(0.6);
            let light = b.env(time) * (0.45 + 1.1 * beam.cone(p) * beam.light);
            Some((
                [x, y, r, light],
                [f32::from(u8::from(b.words)), b.seed, pop, b.written(time)],
            ))
        })
        .collect();
    floating.sort_by(|a, b| b.0[3].total_cmp(&a.0[3]));
    let mut bubbles_in = [[0.0; 4]; BUBBLES];
    let mut marks = [[0.0; 4]; BUBBLES];
    for (i, (b, m)) in floating.into_iter().take(BUBBLES).enumerate() {
        bubbles_in[i] = b;
        marks[i] = m;
    }
    let [px, py, pz] = norm(PULL);
    Frame {
        time,
        inside: inside(time),
        room: room(time),
        within: cam,
        ring: ring(time),
        column: column(time),
        ticks: TAU * time / TURN,
        beam,
        tide: tide(time),
        pull: [px, py, pz, pulled(time)],
        tug: pull(time),
        knot,
        magnet,
        waves,
        bubbles: bubbles_in,
        marks,
        threads,
        boxes,
        glints,
        tails,
    }
}

/// The scene's three lights in a theme's colors: the cold outer ring and
/// rims, the warm inner ring and beam, the pale in threads and sparks. The
/// page itself comes from the app (`backdrop`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub cold: [f32; 3],
    pub warm: [f32; 3],
    pub pale: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

/// The app theme by its `graphicsPalette` code (0 Искра, 2 Тишина, 3 Астрал,
/// 4 Матрица). The cold light is the theme's accent; the warm one is a
/// second tone that stays apart from it. The site shows only the dark
/// themes; the retired light codes fall back to Тишина.
pub fn look(code: u32) -> Look {
    match Palette::from_code(code) {
        // Искра: the yellow of the theme, an ember beam.
        Palette::Dark => Look {
            cold: rgb(245, 221, 7),
            warm: rgb(255, 122, 40),
            pale: rgb(255, 244, 170),
        },
        // Астрал: the blue of the theme, a rose-peach beam.
        Palette::Violet => Look {
            cold: rgb(98, 150, 245),
            warm: rgb(240, 158, 128),
            pale: rgb(200, 212, 248),
        },
        // Матрица: code green, an amber beam.
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
    use crate::body::solid;

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
    const CROWN: V = [0.0, 1.43, -0.02];

    fn alive(t: f32, kind: Kind) -> Vec<&'static Strand> {
        strands()
            .iter()
            .filter(|s| s.kind == kind && s.env(t) > 0.0)
            .collect()
    }

    fn floating(t: f32, kind: Kind) -> Vec<&'static Bubble> {
        bubbles()
            .iter()
            .filter(|b| b.kind == kind && b.env(t) > 0.0)
            .collect()
    }

    fn sparkling(t: f32, kind: Kind) -> Vec<&'static Spark> {
        sparks()
            .iter()
            .filter(|s| s.kind == kind && s.env(t) > 0.0)
            .collect()
    }

    /// The brightest light on a thread at `t`.
    fn brightest(s: &Strand, t: f32) -> f32 {
        let b = beam(t);
        (0..POINTS)
            .map(|i| {
                let u = i as f32 / (POINTS - 1) as f32;
                s.light(u, s.point(u, t), t, &b)
            })
            .fold(0.0, f32::max)
    }

    #[test]
    fn the_loop_closes_without_a_jump() {
        let (a, b) = (compose(0.0), compose(LOOP_SECONDS - 1e-3));
        assert!(distance(a.room.eye, b.room.eye) < 1e-3);
        assert!(distance(a.room.forward, b.room.forward) < 1e-3);
        assert!(close(a.ring[0], b.ring[0], 1e-3) && close(a.ring[3], b.ring[3], 1e-3));
        assert!(a.inside == 0.0 && b.inside == 0.0 && a.column[1] == 0.0);
        assert_eq!(compose(LOOP_SECONDS), a);
        assert_eq!(compose(f32::NAN), a);
        assert_eq!(compose(-LOOP_SECONDS), a);
    }

    #[test]
    fn the_camera_goes_in_through_the_back_and_never_sits_inside_while_the_room_shows() {
        let mut went_in = false;
        every(0.005, |t| {
            let eye = room(t).eye;
            if inside(t) < 1.0 {
                assert!(solid(eye) > 0.003, "{t}: {eye:?} {}", solid(eye));
            } else if solid(eye) < 0.0 {
                went_in = true;
                // In through the back, above the backrest.
                assert!(eye[2] < 0.1 && eye[1] > 0.97, "{t}: {eye:?}");
            }
        });
        assert!(went_in);
        assert!(solid(room(30.0).eye) < -0.05 && inside(30.0) == 1.0);
        // The inside camera stays clear of the lantern's mouth.
        every(0.05, |t| {
            if inside(t) > 0.0 {
                assert!(distance(within(t).eye, MOUTH) > 0.6, "{t}");
            }
        });
    }

    #[test]
    fn the_person_is_in_frame_in_the_room() {
        every(0.05, |t| {
            if !(t <= 11.0 || t >= 62.0) {
                return;
            }
            let c = room(t);
            for p in [HEAD, CROWN, [0.0, 0.6, 0.0]] {
                let s = c.project(p).expect("ahead");
                assert!(s[0].abs() < 1.2 && s[1].abs() < 0.85, "{t}: {p:?} {s:?}");
            }
            // During the scan the ring stays in the frame down to the feet.
            let [y, z, r, light] = ring(t);
            if light > 0.0 {
                let s = c.project([0.0, y, z + r]).expect("ahead");
                assert!(s[0].abs() < 1.3 && s[1].abs() < 0.9, "{t}: {s:?}");
            }
        });
    }

    #[test]
    fn the_outer_ring_is_always_in_view() {
        every(0.05, |t| {
            let f = compose(t);
            let (cam, [x, y, z, r]) = if f.inside < 0.5 {
                (f.room, OUTER)
            } else {
                (f.within, OUTER_IN)
            };
            let seen = (0..360)
                .filter(|i| {
                    let a = TAU * *i as f32 / 360.0;
                    let p = [x + r * a.sin(), y, z + r * a.cos()];
                    cam.project(p).is_some_and(in_frame)
                })
                .count();
            assert!(seen >= 40, "{t}: {seen}");
        });
    }

    #[test]
    fn the_inner_ring_scans_head_to_feet_then_turns_its_light_inward() {
        let head = HUG[HUG.len() - 1][0];
        assert!(close(ring(0.0)[0], head, 1e-4) && close(ring(SCAN[0])[0], head, 1e-4));
        assert!(close(ring(SCAN[1])[0], HUG[0][0], 1e-4));
        let mut last = 9.0;
        let mut t = SCAN[0];
        while t <= SCAN[1] {
            let [y, _, _, light] = ring(t);
            assert!(y <= last && (light == RING_LIGHT || t > RING_DIP[0]), "{t}");
            last = y;
            t += 0.01;
        }
        assert!(ring(8.75)[3] == 0.0);
        assert_eq!(ring(10.0), [HALO[0], HALO[1], HALO[2], RING_LIGHT]);
        assert!(column(9.0)[1] == 0.0 && column(12.5) == [COLUMN[1][1], 1.0]);
        assert!(column(11.0)[0] < COLUMN[0][1] && column(11.0)[0] > COLUMN[1][1]);
        // It settles back round the head on the way out.
        assert!(close(ring(63.5)[0], head, 1e-4) && column(63.0)[1] == 0.0);
    }

    #[test]
    fn each_question_brings_its_own_thing_into_the_beam() {
        every(0.02, |t| {
            if !floating(t, Kind::Thought).is_empty() {
                assert!((16.0..22.5).contains(&t), "thought {t}");
            }
            if !sparkling(t, Kind::Micro).is_empty() {
                assert!((25.3..30.7).contains(&t), "micro {t}");
            }
            if !alive(t, Kind::Impulse).is_empty() || jolt(t) > 0.01 {
                assert!((29.9..35.0).contains(&t), "impulse {t}");
            }
            if pull(t) > 0.0 || !sparkling(t, Kind::Stream).is_empty() {
                assert!((34.7..39.7).contains(&t), "urge {t}");
            }
            let [_, _, strength, _] = tide(t);
            if strength > 0.36 || wave(0, t)[1] > 0.0 || wave(1, t)[1] > 0.0 {
                assert!((21.2..25.8).contains(&t), "emotion {t}");
            }
        });
        // Thoughts: big bubbles with words rise into the beam.
        let b = beam(18.9);
        let words: Vec<_> = floating(18.9, Kind::Thought)
            .into_iter()
            .filter(|x| x.words)
            .collect();
        assert!(words.len() >= 3, "{}", words.len());
        assert!(words.iter().any(|x| b.cone(x.place(18.9)) > 0.5));
        assert!(words.iter().all(|x| x.place(19.0)[1] > x.place(18.9)[1]));
        // Emotions: the tide in the beam, and a wave over the whole frame.
        assert!(tide(23.4)[2] == 1.0);
        let w = compose(22.6).waves[0];
        assert!(w[3] > 0.3 && w[2] > 1.5 && in_frame([w[0], w[1]]), "{w:?}");
        // Micro-feelings: sparks in the beam.
        let b = beam(27.8);
        let sparked = sparkling(27.8, Kind::Micro)
            .iter()
            .filter(|s| s.env(27.8) * b.cone(s.place(27.8)) > 0.3)
            .count();
        assert!(sparked >= 1, "{sparked}");
        // Impulses: two bright lightnings at each jolt.
        let lit = |t: f32, kind| {
            alive(t, kind)
                .iter()
                .filter(|s| brightest(s, t) > 0.5)
                .count()
        };
        assert!(jolt(31.0) > 0.5 && lit(31.0, Kind::Impulse) == 2);
        for &j in &JOLTS {
            assert_eq!(alive(j + 0.1, Kind::Impulse).len(), 2, "{j}");
        }
        // The urge: the whirl is on and draws the sparks in.
        let f = compose(37.4);
        assert!(pull(37.4) == 1.0 && f.magnet[3] == 1.0);
        assert!(in_frame([f.magnet[0], f.magnet[1]]), "{:?}", f.magnet);
        // The dust is pulled the same way, from the beam to the whirl.
        assert!(dot(norm(PULL), norm(sub(MAGNET, by_beam(3.0, 0.0, 0.0)))) > 0.995);
        let drawn = sparkling(37.0, Kind::Stream);
        assert!(drawn.len() >= 3, "{}", drawn.len());
        for s in drawn {
            assert!(distance(s.place(37.1), MAGNET) < distance(s.place(37.0), MAGNET));
        }
    }

    #[test]
    fn thoughts_rise_as_bubbles_with_words_and_pop() {
        let big: Vec<_> = bubbles().iter().filter(|b| b.words).collect();
        assert_eq!(big.len(), THOUGHTS.len() + 2);
        for b in big {
            let end = b.at + b.life;
            assert!(b.written(b.at + 2.0) == 1.0 && b.written(b.at) == 0.0);
            assert!(b.pop(end - POP) == 0.0 && b.pop(end) == 1.0);
            assert!(b.place(end)[1] > b.place(b.at)[1] + 0.5);
            // Two small ones trail below it, rising with it.
            let trail: Vec<_> = bubbles()
                .iter()
                .filter(|s| !s.words && s.seed == b.seed)
                .collect();
            assert_eq!(trail.len(), 2);
            for s in trail {
                assert!(s.at < b.at && s.at + s.life > end);
                for t in [b.at + 0.5, b.at + 1.5, end - 0.1] {
                    assert!(s.place(t)[1] < b.place(t)[1] - b.radius);
                    assert!(s.radius < 0.4 * b.radius);
                }
            }
        }
        // As it pops it widens and fades.
        let b = bubbles().iter().find(|b| b.words).unwrap();
        let end = b.at + b.life;
        assert!(b.env(end - 0.1) < 0.3 && b.env(end - POP - 0.1) == 1.0);
    }

    #[test]
    fn the_outer_ring_turns_visibly_and_joins_up() {
        let turns = LOOP_SECONDS / TURN;
        assert!(turns >= 1.0 && turns.fract() == 0.0);
        // Its edge runs at least 0.2 a second in the room.
        let w = compose(10.0).ticks - compose(9.0).ticks;
        assert!(w * OUTER[3] > 0.2, "{w}");
        // Inside, its far arc is curved, not a flat line: it sags toward
        // the frame's sides.
        let cam = within(STILL);
        let [x, y, z, r] = OUTER_IN;
        let far = cam.project([x, y, z - r]).unwrap();
        let side = cam.project([x + r * 0.8, y, z - r * 0.6]).unwrap();
        assert!(in_frame(far) && far[1] - side[1] > 0.1, "{far:?} {side:?}");
    }

    #[test]
    fn the_needle_narrows_chases_to_the_knot_and_lets_go() {
        assert!(close(beam(38.0).spread, SPREAD[0], 1e-5));
        let mut last = -1.0;
        let mut t = CHASE[0];
        while t < CHASE[1] {
            let b = beam(t);
            assert!(close(b.spread, SPREAD[1], 1e-5), "{t}");
            let to = norm(sub(chase_point(t), MOUTH));
            assert!(dot(to, b.aim) > 0.99999, "{t}");
            let u = chase(t);
            assert!(u >= last, "{t}");
            last = u;
            // The thread glows where the needle is on it.
            let s = strands().iter().find(|s| s.kind == Kind::Chase).unwrap();
            assert!(s.light(u, s.point(u, t), t, &b) > 0.8, "{t}");
            t += 0.05;
        }
        assert!(chase(CHASE[0]) == 0.0 && close(chase(CHASE[1]), 0.97, 1e-5));
        // The needle really travels: it swings across the frame.
        let (a, z) = (beam(CHASE[0]).aim, beam(CHASE[1]).aim);
        assert!(dot(a, z) < 0.94, "{}", dot(a, z));
        // The knot is there while it chases, then sinks into the dark.
        assert!(compose(47.0).knot[3] == 1.0 && compose(51.6).knot[3] == 0.0);
        assert!(distance(knot(52.0), MOUTH) > distance(knot(47.0), MOUTH) + 1.0);
        // Let go: wide open, back to the resting way.
        let w = beam(53.0);
        assert!(close(w.spread, SPREAD[2], 1e-5) && needle(53.0) == 0.0);
        assert!(dot(w.aim, base()) > 0.98);
        assert!(close(beam(57.0).spread, SPREAD[0], 1e-5));
    }

    #[test]
    fn the_slots_never_overflow_and_the_boxes_hold_their_threads() {
        every(0.01, |t| {
            let n = strands().iter().filter(|s| s.env(t) > 0.0).count();
            assert!(n <= THREADS, "{t}: {n}");
            let g = sparks().iter().filter(|s| s.env(t) > 0.0).count();
            assert!(g <= GLINTS, "{t}: {g}");
            let b = bubbles().iter().filter(|b| b.env(t) > 0.0).count();
            assert!(b <= BUBBLES, "{t}: {b}");
        });
        every(0.25, |t| {
            let f = compose(t);
            for (slot, b) in f.boxes.iter().enumerate() {
                for p in &f.threads[slot * POINTS..(slot + 1) * POINTS] {
                    if p[3] > 0.0 {
                        assert!(p[0] > b[0] && p[0] < b[2] && p[1] > b[1] && p[1] < b[3]);
                    }
                }
            }
        });
    }

    #[test]
    fn the_motion_is_smooth() {
        let step = 1.0 / 60.0;
        every(step, |t| {
            let (a, b) = (compose(t), compose(t + step));
            if t + step >= LOOP_SECONDS {
                return;
            }
            if a.inside < 1.0 {
                assert!(distance(a.room.eye, b.room.eye) < 0.02, "{t}");
                assert!(distance(a.room.forward, b.room.forward) < 0.015, "{t}");
            }
            if a.inside > 0.0 {
                assert!(distance(a.within.eye, b.within.eye) < 0.02, "{t}");
                assert!(distance(a.within.forward, b.within.forward) < 0.012, "{t}");
                assert!(distance(a.beam.aim, b.beam.aim) < 0.012, "{t}");
                assert!((a.beam.spread - b.beam.spread).abs() < 0.003, "{t}");
            }
            assert!((a.inside - b.inside).abs() < 0.04, "{t}");
            assert!((a.beam.light - b.beam.light).abs() < 0.02, "{t}");
            assert!((a.ring[3] - b.ring[3]).abs() < 0.04, "{t}");
            if a.ring[3] > 0.0 && b.ring[3] > 0.0 {
                assert!((a.ring[0] - b.ring[0]).abs() < 0.012, "{t}");
            }
            assert!((a.column[1] - b.column[1]).abs() < 0.03, "{t}");
            assert!((a.knot[3] - b.knot[3]).abs() < 0.02, "{t}");
            assert!((a.tide[2] - b.tide[2]).abs() < 0.03, "{t}");
            assert!((a.tug - b.tug).abs() < 0.03, "{t}");
            assert!((a.magnet[3] - b.magnet[3]).abs() < 0.03, "{t}");
            for i in 0..WAVES.len() {
                // Its reach matters only while it is there.
                let (wa, wb) = (wave(i, t), wave(i, t + step));
                assert!((wa[1] - wb[1]).abs() < 0.05, "{t}");
                assert!(wb[1] == 0.0 || (wa[0] - wb[0]).abs() < 0.04, "{t}");
            }
            for x in bubbles() {
                assert!((x.env(t) - x.env(t + step)).abs() < 0.08, "{t}");
                assert!(distance(x.place(t), x.place(t + step)) < 0.02, "{t}");
            }
        });
    }

    #[test]
    fn the_still_frame_is_the_wide_open_beam() {
        let f = compose(STILL);
        assert!(f.inside == 1.0 && needle(STILL) == 0.0);
        assert!(close(f.beam.spread, SPREAD[2], 1e-5) && close(f.beam.light, 0.85, 1e-4));
        assert!(!sparkling(STILL, Kind::Calm).is_empty());
        // A thought passes by itself, its words written, in the frame.
        assert!(floating(STILL, Kind::Calm).iter().any(|x| x.words
            && x.env(STILL) == 1.0
            && x.written(STILL) > 0.9
            && f.within.project(x.place(STILL)).is_some_and(in_frame)));
        assert!(f.bubbles[0][3] > 0.5, "{:?}", f.bubbles[0]);
        let s = f.within.project(by_beam(3.0, 0.0, 0.0)).unwrap();
        assert!(in_frame(s));
        assert!(f.within.project(MOUTH).is_some_and(in_frame));
    }

    #[test]
    fn the_beam_is_seen_from_the_side_inside() {
        every(0.1, |t| {
            if (19.0..58.0).contains(&t) {
                let c = within(t);
                let b = beam(t);
                assert!(dot(c.forward, b.aim).abs() < 0.9, "{t}");
                let far = add(b.mouth, scale(b.aim, 4.0));
                assert!(c.project(far).is_some_and(in_frame), "{t}");
            }
        });
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
