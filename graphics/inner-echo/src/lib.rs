//! «Внутрь», page 01 of Step 6 «Внутреннее кольцо», direction «Эхо». A
//! person sits upright on a chair in a dark room. The room exists only where
//! perception touches it: waves run out from the chest as spheres and draw
//! it in cold points (floor, the back wall with its window, the left wall
//! with its door, a table, a floor lamp). The third one stays as the outer
//! ring: the orbit of the sphere of presence, a line of light with runners
//! whose plane keeps turning, so in time it passes over all of the sphere;
//! presence is spherical, all round at once, never a beam, and there is no
//! other outer line (Art: an outer ring and an inner one). «ты переходишь
//! внутрь»: one wave runs back in from the walls to the chest, and where it
//! passes, the inside of the body comes up in warm points; three echoes
//! inside raise it and leave the inner ring, no sphere: a warm ring round the
//! body that scans all of it, from the feet to the crown and back (Art).
//! Each «Без…» shows, slowly, what it is without, with its words under the
//! scene: falling into a thought (everything goes dark, the body too, but
//! the head with a knot of thought in it), analysis (the points lock into a
//! grid), trying to understand or fix (they tremble), going off into images
//! of oneself (the body goes dark but for the head, which projects four
//! different images of himself in front of him: `selves`). Then both rings
//! run together, seen from above, sparks of
//! sensation wake in the body one by one, and at «здесь и сейчас» one wave
//! goes through the body and the sphere. Every value here is
//! a pure function of loop time; `browser.rs` only uploads it and one
//! ray-marched pass draws it. Unit: the person sits about 1.4 high; the
//! floor is y = 0, the person faces +z.
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

pub mod body;
pub mod generated;
pub mod selves;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerEcho;

pub const LOOP_SECONDS: f32 = 66.0;
/// The frame is 3:2; a canvas of another shape keeps the whole 3:2 frame in
/// view.
pub const FRAME_ASPECT: f32 = 1.5;

/// Where perception starts: the chest of the seated person. Every wave and
/// both spheres are round it.
pub const HEART: [f32; 3] = [0.0, 0.97, -0.035];
/// The sphere of presence round the person, this far out; its orbit is a
/// line of light with this many runners going round it.
pub const ORBIT: f32 = 1.5;
pub const ORBIT_RUNNERS: f32 = 6.0;
/// The outer orbit: a great circle whose pole goes round the vertical
/// `ORBIT_TURNS` whole times a loop, tilted `ORBIT_TILT[0]` ± `ORBIT_TILT[1]`
/// degrees and swinging `ORBIT_SWINGS` whole times a loop; its points run
/// round it `ORBIT_FLOW` whole times a loop.
pub const ORBIT_TURNS: f32 = 3.0;
pub const ORBIT_TILT: [f32; 2] = [22.0, 12.0];
pub const ORBIT_SWINGS: f32 = 3.0;
pub const ORBIT_FLOW: f32 = 6.0;
/// The inner ring: level, round the body, it scans all of it, from the feet
/// up to the crown and back down once every `SCAN_SECONDS` (Art: calmer, it
/// was too quick), a whole number of times a loop; its runners go round it
/// `INNER_FLOW` whole times a loop, the other way from the outer ones.
pub const SCAN_SECONDS: f32 = 16.5;
pub const INNER_RUNNERS: f32 = 3.0;
pub const INNER_FLOW: f32 = -10.0;
/// At each height the body's own wrap: (height, centre z, half width across,
/// half depth front to back), from the feet to the crown; between keys it
/// eases from one to the next. The ring itself (`wrap`) keeps clear of all
/// of the body within `SCAN_EASE` up and down and softens over that height,
/// so it never snaps from one part of the body to the next (Art: «дергано
/// переходит от некоторых частей»).
pub const SCAN: [[f32; 4]; 13] = [
    [0.03, 0.54, 0.21, 0.2],
    [0.25, 0.46, 0.2, 0.11],
    [0.42, 0.45, 0.21, 0.12],
    [0.5, 0.2, 0.25, 0.4],
    [0.56, 0.17, 0.27, 0.4],
    // Round the hands on the thighs.
    [0.62, 0.15, 0.3, 0.38],
    [0.68, 0.07, 0.3, 0.3],
    [0.85, -0.04, 0.31, 0.17],
    [1.0, -0.04, 0.3, 0.17],
    [1.1, -0.05, 0.28, 0.13],
    [1.2, -0.035, 0.1, 0.1],
    [1.31, -0.02, 0.14, 0.15],
    [1.42, -0.02, 0.07, 0.07],
];
pub const SCAN_EASE: f32 = 0.1;
/// How far perception reaches: past the room's far corner; it fades from
/// `FADE_FROM` out to here.
pub const REACH: f32 = 4.4;
pub const FADE_FROM: f32 = 3.0;
/// The room: the back wall's face at z = `BACK`, the left wall's at
/// x = `LEFT`; the window (centre x, y, half width, half height) and the door
/// (centre z, y, half width, half height) in them.
pub const BACK: f32 = -2.4;
pub const LEFT: f32 = -2.6;
pub const WINDOW: [f32; 4] = [-0.85, 1.45, 0.6, 0.55];
pub const DOOR: [f32; 4] = [-1.0, 1.02, 0.45, 1.02];
/// The table (its feet) and the floor lamp (its foot).
pub const TABLE: [f32; 3] = [-1.45, 0.0, -1.45];
pub const LAMP: [f32; 3] = [1.9, 0.0, -0.9];
/// The box round the person and the chair: corners.
pub const PERSON: [[f32; 3]; 2] = [[-0.32, 0.0, -0.21], [0.32, 1.46, 0.7]];
/// Point spacing on the skin, the chair, the things, the walls and floor;
/// inside the body.
pub const SPACING: [f32; 4] = [0.022, 0.022, 0.022, 0.045];
pub const INSIDE: f32 = 0.026;

/// «взгляд, слух, восприятие раскрываются как орбита»: three waves out from
/// the chest, each this long from `WAVE_FROM` to `REACH`; each leaves the
/// room this much brighter. The third leaves the sphere and its orbit.
pub const WAVES: [f32; 3] = [0.4, 1.6, 2.8];
pub const WAVE_SECONDS: f32 = 2.4;
pub const WAVE_FROM: f32 = 0.15;
pub const LEVELS: [f32; 3] = [0.45, 0.3, 0.25];
/// «ты переходишь внутрь»: one wave back in from `REACH` to the chest; the
/// inside of the body comes up where it has passed, this bright.
pub const INWARD: [f32; 2] = [6.5, 9.5];
pub const INNER_BASE: f32 = 0.4;
/// «внутреннее замечается так же ясно, как внешнее»: three echoes out from
/// the chest to the feet, like the three waves in the room; each leaves the
/// inside this much brighter, the third leaves the inner ring.
pub const ECHOES: [f32; 3] = [10.0, 11.0, 12.0];
pub const ECHO_SECONDS: f32 = 1.0;
pub const ECHO_REACH: f32 = 1.2;
pub const ECHO_LEVELS: [f32; 3] = [0.25, 0.2, 0.15];
/// «Без проваливания», «Без анализа», «Без попытки понять или исправить»,
/// «Без ухода в образы себя»: the heart of the page, half the loop (Art:
/// more time on them, less on the rest; then more again on the falling in
/// and the images). Each starts here, pulls, holds and lets go before the
/// next.
pub const WITHOUT: [f32; 4] = [14.0, 24.0, 30.5, 37.0];
pub const PULL: [f32; 4] = [1.4, 1.2, 1.2, 1.8];
pub const HOLD: [f32; 4] = [6.8, 3.5, 3.5, 7.4];
pub const RELEASE: [f32; 4] = [1.4, 1.4, 1.4, 1.4];
/// Falling into a thought: everything outside the person goes dark, and the
/// body too below the head (from .. to, Art: «тело исчезало а оставалась
/// голова»); the thought is a knot of `KNOT_POINTS` points this big in the
/// head, turning `KNOT_TURNS` whole times a loop.
pub const THOUGHT: [f32; 3] = [0.0, 1.32, -0.01];
pub const HEAD: [f32; 2] = [1.12, 1.22];
pub const KNOT: f32 = 0.019;
pub const KNOT_POINTS: f32 = 72.0;
pub const KNOT_TURNS: f32 = 8.0;
/// Images of oneself: the body goes dark but for the head, and light runs
/// out of the eyes to four images of himself in front of him (`selves`),
/// one after another: each starts forming here and is whole this much later.
pub const EYES: [f32; 3] = [0.0, 1.335, 0.07];
pub const SELF_FORM: [f32; 4] = [38.0, 39.4, 40.8, 42.2];
pub const SELF_FORM_SECONDS: f32 = 1.2;
/// The words under the scene for each «Без…»: their rows in the label atlas,
/// the second -1 for a single line.
pub const CAPTIONS: [[f32; 2]; 4] = [[0.0, -1.0], [1.0, -1.0], [2.0, 3.0], [4.0, -1.0]];
/// Their capitals' height (share of the frame width), the lower baseline
/// (share of the frame height, up from its bottom), the gap between two
/// lines' baselines (capitals).
pub const CAPTION: [f32; 3] = [0.03, 0.06, 1.8];
/// «Это — Наблюдение внутреннего кольца, которое раскрывается на фоне
/// внешнего кольца и его сканирования»: the camera rises over both rings.
pub const BOTH: f32 = 48.0;
/// «точности, бдительности и честности … живое Ощущение»: sparks of
/// sensation wake one by one, the first at `SPARK_WAKE`, each next
/// `SPARK_GAP` later: a shoulder, a hand, a knee, the other forearm, the
/// other shoulder, the back.
pub const SPARK_WAKE: f32 = 53.0;
pub const SPARK_GAP: f32 = 0.4;
pub const SPARK_POINTS: [[f32; 3]; 6] = [
    [0.2, 1.06, -0.05],
    [0.166, 0.625, 0.335],
    [-0.112, 0.53, 0.43],
    [-0.196, 0.722, 0.15],
    [-0.2, 1.06, -0.05],
    [0.0, 0.82, -0.1],
];
/// «здесь и сейчас»: one wave from the chest through the body and the room
/// together, this long.
pub const TOGETHER: f32 = 57.0;
pub const TOGETHER_SECONDS: f32 = 2.8;
/// The inside goes dark, then the room, back to the person alone.
pub const INNER_OUT: [f32; 2] = [60.6, 64.2];
pub const ROOM_OUT: [f32; 2] = [61.2, 65.4];
/// Reduced motion: the room and the inside both clear, both rings seen from
/// above.
pub const STILL: f32 = 51.5;

/// The skin's own cold light: the perceiver is there from the first frame;
/// it steps back while the inside is lit.
pub const SKIN: f32 = 1.0;
pub const SKIN_INSIDE: f32 = 0.35;

/// The camera, keyed through the loop: round the person (degrees from +z
/// toward +x), over the floor (degrees), how far, the point it looks at, and
/// the height of the frame (degrees). Wide for the room, close for the
/// inside, close on the head while the body is gone into a thought, slowly
/// round the person through the grid and the trembling, up over his right
/// shoulder (high, so the lamp stays below and behind) and down behind him
/// for the images of himself in front, up over the shoulder again and high
/// over both rings, close again, back.
pub const CAMERA: [(f32, [f32; 7]); 21] = [
    (0.0, [34.0, 18.0, 4.9, -0.3, 0.8, -0.6, 52.0]),
    (4.5, [26.0, 19.0, 4.75, -0.3, 0.8, -0.55, 52.0]),
    (8.0, [34.0, 15.0, 3.6, -0.15, 0.7, -0.25, 48.0]),
    (11.5, [42.0, 12.0, 2.9, -0.06, 0.6, 0.0, 46.0]),
    (14.9, [32.0, 10.0, 3.0, -0.02, 0.5, 0.02, 44.0]),
    (16.8, [26.0, 8.0, 2.4, 0.0, 1.3, 0.0, 22.0]),
    (17.3, [25.5, 8.0, 2.4, 0.0, 1.3, 0.0, 22.0]),
    (20.1, [21.5, 8.0, 2.4, 0.0, 1.3, 0.0, 22.0]),
    (20.6, [21.0, 8.0, 2.4, 0.0, 1.3, 0.0, 22.0]),
    (23.0, [36.0, 11.0, 3.0, -0.06, 0.5, 0.04, 45.0]),
    (26.5, [46.0, 13.0, 3.1, -0.1, 0.5, 0.06, 46.0]),
    (32.5, [36.0, 12.0, 3.0, -0.08, 0.5, 0.06, 46.0]),
    (35.0, [90.0, 22.0, 2.6, 0.0, 0.7, 0.4, 50.0]),
    (37.0, [125.0, 48.0, 2.5, 0.0, 0.6, 0.6, 58.0]),
    (39.0, [155.0, 25.0, 3.1, 0.0, 0.62, 1.0, 55.0]),
    (46.0, [160.0, 25.0, 3.1, 0.0, 0.62, 1.0, 52.0]),
    (48.5, [118.0, 46.0, 2.7, 0.0, 0.7, 0.3, 55.0]),
    (51.5, [60.0, 42.0, 4.2, -0.05, 0.6, -0.2, 54.0]),
    (56.0, [48.0, 16.0, 2.9, -0.04, 0.64, 0.0, 46.0]),
    (59.0, [40.0, 22.0, 3.8, -0.12, 0.7, -0.2, 50.0]),
    (62.5, [34.0, 20.0, 4.5, -0.25, 0.8, -0.5, 52.0]),
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    /// Loop time, for the shader's own small motions.
    pub time: f32,
    /// The camera: its place and axes, and the tangent of half the frame's
    /// height.
    pub eye: [f32; 3],
    pub right: [f32; 3],
    pub up: [f32; 3],
    pub forward: [f32; 3],
    pub lens: f32,
    /// The three waves out: radius and front light each (0 before it
    /// starts, `REACH` once it has passed everything).
    pub waves: [[f32; 2]; 3],
    /// The wave back in: radius and light. The inside is touched farther
    /// than this from the heart.
    pub inward: [f32; 2],
    /// The three echoes inside: radius and front light.
    pub echoes: [[f32; 2]; 3],
    /// «здесь и сейчас»: the wave through both, radius and light.
    pub together: [f32; 2],
    /// The room's light (0..1), the outer sphere's rim and orbit, the
    /// skin's.
    pub room: f32,
    pub shell: f32,
    pub skin: f32,
    /// The outer orbit: its pole and how far its points have run.
    pub orbit: [f32; 3],
    pub orbit_flow: f32,
    /// The inside: its light, the inner ring's, where the ring is (height,
    /// centre z, half width, half depth: see `SCAN`) and how far its
    /// runners have run.
    pub inner: f32,
    pub ring: f32,
    pub scan: [f32; 4],
    pub ring_flow: f32,
    /// The four pulls (0..1 each): falling into a thought, the grid,
    /// trembling, images of oneself.
    pub fall: f32,
    pub grid: f32,
    pub tremble: f32,
    pub image: f32,
    /// Falling in: what is left of everything outside the person, how far
    /// the knot has turned.
    pub outside: f32,
    pub knot_turn: f32,
    /// Images of oneself: the projection from the head, each image's light.
    pub projection: f32,
    pub selves: [f32; 4],
    /// The words under the scene: first row, second row (-1 for none), light.
    pub caption: [f32; 3],
    /// Each spark's light.
    pub flares: [f32; 6],
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
fn window(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn dot(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
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

/// Camera channel `c` (see `CAMERA`) at `t`.
pub fn camera(c: usize, t: f32) -> f32 {
    spline_by(CAMERA.len(), |i| (CAMERA[i].0, CAMERA[i].1[c]), t)
}

/// A wave that starts at `start` and runs from `from` to `to` in `seconds`,
/// fast at first and easing out: its radius and its front's light. Before it
/// starts its radius is 0; after, `to`.
fn spread(start: f32, seconds: f32, from: f32, to: f32, t: f32) -> [f32; 2] {
    let age = t - start;
    if age < 0.0 {
        return [0.0, 0.0];
    }
    let x = (age / seconds).min(1.0);
    [
        from + (to - from) * (1.0 - (1.0 - x).powf(1.6)),
        smooth(0.0, 0.45, age) * (1.0 - smooth(seconds * 0.6, seconds, age)),
    ]
}

/// When a wave from `start` reaches `radius`.
fn crossing(start: f32, seconds: f32, from: f32, to: f32, radius: f32) -> f32 {
    let x = 1.0 - (1.0 - (radius - from) / (to - from)).powf(1.0 / 1.6);
    start + x * seconds
}

/// Outward wave `i` at `t`.
pub fn wave(i: usize, t: f32) -> [f32; 2] {
    spread(WAVES[i], WAVE_SECONDS, WAVE_FROM, REACH, t)
}

/// Echo `i` inside the body at `t`.
pub fn echo(i: usize, t: f32) -> [f32; 2] {
    spread(ECHOES[i], ECHO_SECONDS, 0.0, ECHO_REACH, t)
}

/// The wave back in: from `REACH` to the heart, quick through the room, slow
/// through the body so it fills from the feet and hands in.
pub fn inward(t: f32) -> [f32; 2] {
    let x = ((t - INWARD[0]) / (INWARD[1] - INWARD[0])).clamp(0.0, 1.0);
    [
        REACH * (1.0 - x) * (1.0 - x),
        smooth(INWARD[0], INWARD[0] + 0.5, t) * (1.0 - smooth(INWARD[1] - 0.5, INWARD[1] + 0.3, t)),
    ]
}

/// When pull `i` has let go.
pub fn without_end(i: usize) -> f32 {
    WITHOUT[i] + PULL[i] + HOLD[i] + RELEASE[i]
}

/// How hard pull `i` holds at `t`.
pub fn pull(i: usize, t: f32) -> f32 {
    let at = WITHOUT[i] + PULL[i] + HOLD[i];
    smooth(WITHOUT[i], WITHOUT[i] + PULL[i], t) * (1.0 - smooth(at, at + RELEASE[i], t))
}

/// The words under the scene at `t`: first row, second row, light. Each
/// «Без…» shows its own while it pulls and lets go.
pub fn caption(t: f32) -> [f32; 3] {
    for (i, rows) in CAPTIONS.iter().enumerate() {
        let (from, to) = (WITHOUT[i], without_end(i));
        if (from..to).contains(&t) {
            let light = smooth(from, from + 0.5, t) * (1.0 - smooth(to - 0.55, to, t));
            return [rows[0], rows[1], light];
        }
    }
    [0.0, -1.0, 0.0]
}

/// An orbit at `t`: its pole (unit) and how far its points have run round
/// it (radians). The pole goes round the vertical `turns` whole times a
/// loop, tilted `tilt[0]` ± `tilt[1]` degrees, swinging `swings` whole times
/// a loop from `phase`.
fn orbit_at(
    turns: f32,
    tilt: [f32; 2],
    swings: f32,
    phase: f32,
    flow: f32,
    t: f32,
) -> ([f32; 3], f32) {
    let x = t / LOOP_SECONDS;
    let theta = (tilt[0] + tilt[1] * (TAU * swings * x + phase).sin()).to_radians();
    let (st, ct) = theta.sin_cos();
    let (sp, cp) = (TAU * turns * x).sin_cos();
    ([st * cp, ct, st * sp], TAU * flow * x)
}

/// The outer orbit at `t`.
pub fn orbit(t: f32) -> ([f32; 3], f32) {
    orbit_at(ORBIT_TURNS, ORBIT_TILT, ORBIT_SWINGS, 0.0, ORBIT_FLOW, t)
}

/// The body's own wrap at height `y`, eased between the `SCAN` keys: its
/// front and back (z) and half width.
fn tight(y: f32) -> [f32; 3] {
    let y = y.clamp(SCAN[0][0], SCAN[SCAN.len() - 1][0]);
    let i = (0..SCAN.len() - 1)
        .find(|&i| y <= SCAN[i + 1][0])
        .unwrap_or(SCAN.len() - 2);
    let (a, b) = (SCAN[i], SCAN[i + 1]);
    let s = smooth(a[0], b[0], y);
    let [z, w, d] = [1, 2, 3].map(|k| a[k] + (b[k] - a[k]) * s);
    [z + d, z - d, w]
}

/// Heights tried within `SCAN_EASE` of a height, -1..1 of it.
const EASE_TAPS: usize = 8;
fn ease_tap(k: usize) -> f32 {
    (2 * k + 1) as f32 / EASE_TAPS as f32 - 1.0
}

/// The inner ring wrapping the body at height `y`: (height, centre z, half
/// width, half depth). It keeps clear of all of the body within `SCAN_EASE`
/// up and down, softened over the same height, so it changes shape slowly
/// and never cuts into the body.
pub fn wrap(y: f32) -> [f32; 4] {
    let reach = |y: f32| {
        (0..EASE_TAPS).fold([f32::MIN, f32::MAX, f32::MIN], |r, k| {
            let [front, back, w] = tight(y + SCAN_EASE * ease_tap(k));
            [r[0].max(front), r[1].min(back), r[2].max(w)]
        })
    };
    let (mut sum, mut weight) = ([0.0f32; 3], 0.0f32);
    for k in 0..EASE_TAPS {
        let x = ease_tap(k);
        let share = 0.5 + 0.5 * (std::f32::consts::PI * x).cos();
        for (total, v) in sum.iter_mut().zip(reach(y + SCAN_EASE * x)) {
            *total += share * v;
        }
        weight += share;
    }
    let [front, back, w] = sum.map(|v| v / weight);
    [y, 0.5 * (front + back), w, 0.5 * (front - back)]
}

/// The inner ring at `t`: it comes up at the chest as the third echo
/// passes, rising, and scans from the feet to the crown and back once every
/// `SCAN_SECONDS`.
pub fn scan(t: f32) -> [f32; 4] {
    let (low, high) = (SCAN[0][0], SCAN[SCAN.len() - 1][0]);
    let chest = (1.0 - 2.0 * (HEART[1] - low) / (high - low)).acos();
    let phase = TAU * (t - ring_lit()) / SCAN_SECONDS + chest;
    wrap(low + (high - low) * 0.5 * (1.0 - phase.cos()))
}

/// Point `a` (radians) of the inner ring `scan` whose runners have run
/// `flow`. The shader builds the same ellipse.
pub fn ring_point(scan: [f32; 4], flow: f32, a: f32) -> [f32; 3] {
    let (s, c) = (a + flow).sin_cos();
    [scan[2] * c, scan[0], scan[1] + scan[3] * s]
}

/// Point `a` (radians) of an orbit with pole `pole` whose points have run
/// `flow`, on a sphere of `radius` round `centre`. The shader builds the
/// same circle: one axis level, across the pole's lean, the other the cross.
pub fn orbit_point(pole: [f32; 3], flow: f32, a: f32, centre: [f32; 3], radius: f32) -> [f32; 3] {
    let lean = pole[0].hypot(pole[2]);
    let e1 = [-pole[2] / lean, 0.0, pole[0] / lean];
    let e2 = cross(pole, e1);
    let (s, c) = (a + flow).sin_cos();
    std::array::from_fn(|i| centre[i] + radius * (c * e1[i] + s * e2[i]))
}

/// Spark `k`'s light at `t`: it wakes in its turn, then glows on its own
/// slow beat until the inside goes.
pub fn flare(k: usize, t: f32) -> f32 {
    let wake = SPARK_WAKE + SPARK_GAP * k as f32;
    let out = 1.0 - smooth(INNER_OUT[0] - 0.5, INNER_OUT[0] + 0.8, t);
    let beat = 0.65 + 0.35 * (TAU * (t - wake - 0.8) / (1.3 + 0.17 * k as f32)).cos();
    smooth(wake, wake + 0.8, t) * out * beat
}

/// When the sphere lights: as the third wave out reaches it; the inner ring,
/// as the third echo is halfway out.
pub fn orbit_lit() -> f32 {
    crossing(WAVES[2], WAVE_SECONDS, WAVE_FROM, REACH, ORBIT)
}
pub fn ring_lit() -> f32 {
    ECHOES[2] + 0.5 * ECHO_SECONDS
}

/// Image `i` of oneself at `t`: it forms in its turn and goes with the rest
/// as the pull lets go.
pub fn self_light(i: usize, t: f32) -> f32 {
    let go = WITHOUT[3] + PULL[3] + HOLD[3];
    smooth(SELF_FORM[i], SELF_FORM[i] + SELF_FORM_SECONDS, t)
        * (1.0 - smooth(go, go + RELEASE[3], t))
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let [azimuth, elevation, distance, tx, ty, tz, height] =
        std::array::from_fn(|c| camera(c, time));
    let (sa, ca) = azimuth.to_radians().sin_cos();
    let (se, ce) = elevation.to_radians().sin_cos();
    let out = [sa * ce, se, ca * ce];
    let eye = [
        tx + distance * out[0],
        ty + distance * out[1],
        tz + distance * out[2],
    ];
    let forward = out.map(|v| -v);
    // Level with the floor however high the camera climbs.
    let right = [ca, 0.0, -sa];
    let up = cross(right, forward);

    let together = spread(TOGETHER, TOGETHER_SECONDS, 0.0, REACH, time);
    // Both rings flash once as the «здесь и сейчас» wave passes them.
    let flash = |radius: f32| {
        let at = crossing(TOGETHER, TOGETHER_SECONDS, 0.0, REACH, radius);
        smooth(at - 0.25, at + 0.15, time) * (-(time - at - 0.15).max(0.0) / 0.7).exp()
    };
    let orbit_at = orbit_lit();
    let ring_at = ring_lit();
    let room_out = 1.0 - smooth(ROOM_OUT[0], ROOM_OUT[1], time);
    let inner_out = 1.0 - smooth(INNER_OUT[0], INNER_OUT[1], time);
    let fall = pull(0, time);
    let image = pull(3, time);
    let outside = 1.0 - fall;
    // The body goes quickly as the images start, and comes back only once
    // they are gone and the words have left.
    let held = WITHOUT[3] + PULL[3] + HOLD[3];
    let projection = if time < held {
        smooth(0.0, 0.45, image)
    } else {
        1.0 - smooth(held + RELEASE[3] - 0.2, held + RELEASE[3] + 0.8, time)
    };
    let (orbit, orbit_flow) = orbit(time);
    let scan = scan(time);

    Frame {
        time,
        eye,
        right,
        up,
        forward,
        lens: (height.to_radians() * 0.5).tan(),
        waves: std::array::from_fn(|i| wave(i, time)),
        inward: inward(time),
        echoes: std::array::from_fn(|i| echo(i, time)),
        together,
        room: smooth(0.0, 1.2, time) * room_out * outside,
        shell: (smooth(orbit_at, orbit_at + 0.6, time) * room_out + 0.8 * flash(ORBIT)) * outside,
        skin: SKIN
            - (SKIN - SKIN_INSIDE)
                * window(
                    time,
                    INWARD[1] - 2.0,
                    ECHOES[2] + 1.0,
                    INNER_OUT[0],
                    INNER_OUT[1],
                ),
        orbit,
        orbit_flow,
        inner: window(time, INWARD[0], INWARD[0] + 0.5, INNER_OUT[0], INNER_OUT[1]),
        ring: (smooth(ring_at, ring_at + 0.5, time) * inner_out + 0.8 * flash(0.4))
            * outside
            * (1.0 - 0.7 * projection),
        scan,
        ring_flow: TAU * INNER_FLOW * time / LOOP_SECONDS,
        fall,
        grid: pull(1, time),
        tremble: pull(2, time),
        image,
        outside,
        knot_turn: TAU * KNOT_TURNS * time / LOOP_SECONDS,
        projection,
        selves: std::array::from_fn(|i| self_light(i, time)),
        caption: caption(time),
        flares: std::array::from_fn(|k| flare(k, time)),
    }
}

/// Where a world point lands in the 3:2 frame, -1..1 both ways; None behind
/// the camera.
pub fn project(f: &Frame, point: [f32; 3]) -> Option<[f32; 2]> {
    let v = [0, 1, 2].map(|i| point[i] - f.eye[i]);
    let z = dot(v, f.forward);
    (z > 0.0).then(|| {
        [
            dot(v, f.right) / (z * f.lens * FRAME_ASPECT),
            dot(v, f.up) / (z * f.lens),
        ]
    })
}

/// The scene's three lights in a theme's colors: the cold room and skin, the
/// warm inside, and the pale of sparks, wave fronts and words. The page
/// itself comes from the app (`backdrop`).
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
        // Искра: the yellow of the theme, an ember inside.
        Palette::Dark => Look {
            cold: rgb(245, 221, 7),
            warm: rgb(255, 122, 40),
            pale: rgb(255, 244, 170),
        },
        // Астрал: the blue of the theme, a rose-peach inside.
        Palette::Violet => Look {
            cold: rgb(98, 150, 245),
            warm: rgb(240, 158, 128),
            pale: rgb(200, 212, 248),
        },
        // Матрица: code green, amber inside.
        Palette::Matrix => Look {
            cold: rgb(0, 255, 65),
            warm: rgb(255, 184, 64),
            pale: rgb(190, 255, 205),
        },
        // Тишина: sea glass, warm sand inside.
        _ => Look {
            cold: rgb(134, 201, 199),
            warm: rgb(242, 179, 117),
            pale: rgb(214, 218, 210),
        },
    }
}

#[cfg(test)]
mod tests {
    /// Points tried round an orbit's circle.
    const SAMPLES: usize = 90;
    use super::*;
    use crate::generated::{LABEL_CAP, LABEL_INK};

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

    fn distance(a: [f32; 3], b: [f32; 3]) -> f32 {
        (0..3).map(|i| (a[i] - b[i]).powi(2)).sum::<f32>().sqrt()
    }

    fn angle(a: [f32; 3], b: [f32; 3]) -> f32 {
        dot(a, b).clamp(-1.0, 1.0).acos().to_degrees()
    }

    const BODY: [[f32; 3]; 7] = [
        [0.0, 1.43, -0.02],
        [0.13, 0.03, 0.66],
        [-0.13, 0.03, 0.66],
        [0.22, 0.81, 0.0],
        [-0.22, 0.81, 0.0],
        [0.0, 0.55, 0.47],
        [0.0, 0.0, -0.15],
    ];

    #[test]
    fn the_loop_closes_without_a_jump() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
        let before = compose(LOOP_SECONDS - 0.001);
        let after = compose(0.001);
        for i in 0..3 {
            assert!(close(before.eye[i], after.eye[i], 1e-3), "{i}");
            assert!(close(before.forward[i], after.forward[i], 1e-3), "{i}");
            assert!(close(before.orbit[i], after.orbit[i], 1e-3), "{i}");
        }
        // The scan runs fast (up to ~0.75 a second), so 2 ms move it a little.
        for i in 0..4 {
            assert!(close(before.scan[i], after.scan[i], 4e-3), "{i}");
        }
        assert!(close(before.lens, after.lens, 1e-4));
        for turn in [
            before.orbit_flow - after.orbit_flow,
            before.ring_flow - after.ring_flow,
            before.knot_turn - after.knot_turn,
        ] {
            assert!(close(turn.cos(), 1.0, 1e-4) && close(turn.sin(), 0.0, 5e-3));
        }
        // Across the seam only the person is there: no room, no rings, no
        // inside, no fronts, no words, the skin at rest.
        for f in [before, after] {
            assert!(f.room < 1e-3 && f.inner < 1e-3, "{f:?}");
            assert!(f.shell < 1e-3 && f.ring < 1e-3, "{f:?}");
            assert!(f.waves.iter().all(|w| w[1] == 0.0));
            assert!(f.echoes.iter().all(|w| w[1] == 0.0));
            assert!(f.inward[1] == 0.0 && f.together[1] == 0.0);
            assert!(f.caption[2] == 0.0 && f.flares.iter().all(|&s| s < 1e-3));
            assert!(close(f.skin, SKIN, 1e-4));
        }
    }

    #[test]
    fn the_outer_orbit_runs_round_its_sphere_and_its_plane_keeps_turning() {
        for turns in [
            ORBIT_TURNS,
            ORBIT_SWINGS,
            ORBIT_FLOW,
            INNER_FLOW,
            KNOT_TURNS,
            LOOP_SECONDS / SCAN_SECONDS,
        ] {
            assert_eq!(turns.fract(), 0.0);
        }
        // Art: «Внешнее кольцо стоит на месте почему? это орбита сферы». The
        // plane of the orbit is never still: its pole moves at least this
        // much every five seconds, and over the loop it leans every way.
        every(0.25, |t| {
            let (a, _) = orbit(t);
            let (b, _) = orbit(t + 5.0);
            assert!(angle(a, b) > 15.0, "{t}: {}", angle(a, b));
            assert!(close(dot(a, a), 1.0, 1e-5));
        });
        // The outer orbit stays above the floor and in the room.
        every(0.25, |t| {
            let (pole, flow) = orbit(t);
            for k in 0..SAMPLES {
                let a = k as f32 / SAMPLES as f32 * TAU;
                let p = orbit_point(pole, flow, a, HEART, ORBIT);
                assert!(close(distance(p, HEART), ORBIT, 1e-4));
                assert!(close(
                    dot([0, 1, 2].map(|i| p[i] - HEART[i]), pole),
                    0.0,
                    1e-4
                ));
                assert!(
                    p[1] > 0.1 && p[0] > LEFT + 0.5 && p[2] > BACK + 0.5,
                    "{t}: {p:?}"
                );
            }
        });
    }

    #[test]
    fn the_inner_ring_scans_the_whole_person_and_never_cuts_through_it() {
        // Art: «внутреннее кольцо тоже без сферы. оно должно сканировать
        // человека полностью».
        const { assert!(SCAN[0][0] < 0.05 && SCAN[SCAN.len() - 1][0] > 1.4) };
        let (mut low, mut high) = (9f32, -9f32);
        every(0.02, |t| {
            if (ring_lit()..ring_lit() + SCAN_SECONDS).contains(&t) {
                low = low.min(scan(t)[0]);
                high = high.max(scan(t)[0]);
            }
        });
        assert!(low < SCAN[0][0] + 1e-3 && high > SCAN[SCAN.len() - 1][0] - 1e-3);
        // It comes up at the chest, where the echoes start.
        assert!(close(scan(ring_lit())[0], HEART[1], 1e-3));
        // At every height it goes round the body, outside the skin and
        // close to it.
        let mut y = SCAN[0][0];
        while y <= SCAN[SCAN.len() - 1][0] {
            let ring = wrap(y);
            let mut nearest = f32::MAX;
            for k in 0..SAMPLES {
                let a = k as f32 / SAMPLES as f32 * TAU;
                let d = body::figure(ring_point(ring, 0.0, a));
                assert!(d > 0.004, "{y}: {k} at {d}");
                nearest = nearest.min(d);
            }
            assert!(nearest < 0.16, "{y}: {nearest}");
            y += 0.01;
        }
        for i in 1..SCAN.len() {
            assert!(SCAN[i][0] > SCAN[i - 1][0], "{i}");
        }
        // Calm (Art: «слишком быстрое и дерганно переходит от некоторых
        // частей»): per 1/60 s it climbs little and changes its shape a little,
        // even where the body changes from one part to the next.
        let step = 1.0 / 60.0;
        let (mut climb, mut reshape) = (0f32, 0f32);
        every(step, |t| {
            let (a, b) = (scan(t), scan(t + step));
            climb = climb.max((b[0] - a[0]).abs());
            for k in 1..4 {
                reshape = reshape.max((b[k] - a[k]).abs());
            }
        });
        assert!(climb < 0.005 && reshape < 0.011, "{climb} {reshape}");
    }

    #[test]
    fn the_first_wave_comes_at_once_and_each_reaches_the_far_corner() {
        // Art: a loop must not open with a long empty beat.
        const _: () = assert!(WAVES[0] <= 0.5);
        assert!(compose(WAVES[0] + 0.5).waves[0][1] > 0.9);
        let corner = distance(HEART, [LEFT, HEART[1], BACK]);
        assert!(FADE_FROM < corner && corner < REACH - 0.5, "{corner}");
        for i in 0..3 {
            assert!(close(wave(i, WAVES[i] + 0.001)[0], WAVE_FROM, 0.02), "{i}");
            assert!(close(wave(i, WAVES[i] + WAVE_SECONDS)[0], REACH, 1e-4));
            // Each wave is out before the next one starts, so they read one
            // by one: взгляд, слух, восприятие.
            if i < 2 {
                assert!(wave(i, WAVES[i + 1])[0] > ORBIT + 1.0);
            }
        }
        // The room is fully lit once all three have passed.
        assert!(close(LEVELS.iter().sum::<f32>(), 1.0, 1e-6));
    }

    #[test]
    fn the_sphere_comes_with_the_third_wave() {
        let at = orbit_lit();
        assert!(close(wave(2, at)[0], ORBIT, 1e-3));
        assert!(compose(at - 0.05).shell < 1e-3);
        assert!(compose(at + 0.7).shell > 0.99);
        // The sphere sits in the room: inside both walls, the person and the
        // chair inside it.
        const { assert!(HEART[2] - ORBIT > BACK + 0.5 && HEART[0] - ORBIT > LEFT + 0.5) };
        for p in BODY {
            assert!(distance(p, HEART) < ORBIT - 0.25, "{p:?}");
        }
    }

    #[test]
    fn the_spline_passes_through_its_keys_and_closes() {
        for c in 0..7 {
            for &(at, values) in &CAMERA {
                assert!(close(camera(c, at), values[c], 1e-4), "{c} at {at}");
            }
            assert!(close(camera(c, LOOP_SECONDS - 1e-3), camera(c, 0.0), 1e-2));
        }
    }

    #[test]
    fn the_motion_is_smooth() {
        let step = 1.0 / 60.0;
        let mut previous = compose(0.0);
        let mut t = step;
        while t < LOOP_SECONDS {
            let f = compose(t);
            for i in 0..3 {
                assert!((f.eye[i] - previous.eye[i]).abs() < 0.04, "eye at {t}");
                assert!(
                    (f.forward[i] - previous.forward[i]).abs() < 0.01,
                    "forward at {t}"
                );
                assert!(
                    (f.orbit[i] - previous.orbit[i]).abs() < 0.01,
                    "orbit at {t}"
                );
            }
            // The ring eases from the shins out round the thighs within a
            // few frames, never in one.
            for i in 0..4 {
                assert!(
                    (f.scan[i] - previous.scan[i]).abs() < 0.08,
                    "scan {i} at {t}"
                );
            }
            assert!((f.lens - previous.lens).abs() < 0.003, "lens at {t}");
            let lights = |f: &Frame| {
                [
                    f.room,
                    f.shell,
                    f.skin,
                    f.inner,
                    f.ring,
                    f.fall,
                    f.grid,
                    f.tremble,
                    f.image,
                    f.outside,
                    f.projection,
                    f.selves[0],
                    f.selves[1],
                    f.selves[2],
                    f.selves[3],
                    f.caption[2],
                    f.inward[1],
                    f.together[1],
                ]
            };
            for (a, b) in lights(&f).into_iter().zip(lights(&previous)) {
                assert!((a - b).abs() < 0.06, "light at {t}: {a} {b}");
            }
            for k in 0..6 {
                assert!(
                    (f.flares[k] - previous.flares[k]).abs() < 0.08,
                    "{k} at {t}"
                );
            }
            for i in 0..3 {
                assert!((f.waves[i][1] - previous.waves[i][1]).abs() < 0.06);
                assert!((f.echoes[i][1] - previous.echoes[i][1]).abs() < 0.08);
            }
            previous = f;
            t += step;
        }
    }

    #[test]
    fn the_wave_back_in_passes_the_room_then_fills_the_body_from_its_ends() {
        assert!(close(inward(INWARD[0])[0], REACH, 1e-6));
        assert!(close(inward(INWARD[1])[0], 0.0, 1e-6));
        let mut previous = REACH;
        every(0.02, |t| {
            if (INWARD[0]..=INWARD[1]).contains(&t) {
                let r = inward(t)[0];
                assert!(r <= previous + 1e-6, "{t}");
                previous = r;
            }
        });
        // It reaches the feet halfway: half its time is inside the body.
        let feet = distance(HEART, [0.126, 0.03, 0.62]);
        assert!(feet < ECHO_REACH);
        let half = INWARD[0] + 0.5 * (INWARD[1] - INWARD[0]);
        assert!(inward(half - 0.3)[0] > feet && inward(half + 0.3)[0] < feet);
        // The echoes start once the inside is fully touched.
        const { assert!(ECHOES[0] >= INWARD[1] + 0.5) };
    }

    #[test]
    fn three_echoes_make_the_inside_as_clear_as_the_room() {
        assert!(close(
            INNER_BASE + ECHO_LEVELS.iter().sum::<f32>(),
            1.0,
            1e-6
        ));
        for i in 0..3 {
            assert!(close(
                echo(i, ECHOES[i] + ECHO_SECONDS)[0],
                ECHO_REACH,
                1e-5
            ));
            if i < 2 {
                assert!(ECHOES[i] + ECHO_SECONDS <= ECHOES[i + 1] + 0.05);
            }
        }
        let at = ring_lit();
        assert!(at > ECHOES[2] && at < ECHOES[2] + ECHO_SECONDS);
        assert!(compose(at - 0.02).ring < 1e-3 && compose(at + 0.6).ring > 0.99);
        const { assert!(ECHOES[2] + ECHO_SECONDS < WITHOUT[0]) };
    }

    #[test]
    fn each_without_pulls_once_with_its_words_and_lets_go_before_the_next() {
        let at = |t: f32| {
            let f = compose(t);
            [f.fall, f.grid, f.tremble, f.image]
        };
        assert!(at(WITHOUT[0] - 0.01).iter().all(|&d| d == 0.0));
        assert_eq!(compose(WITHOUT[0] - 0.25).caption[2], 0.0);
        for i in 0..4 {
            let held = WITHOUT[i] + PULL[i] + 0.5 * HOLD[i];
            for (j, d) in at(held).iter().enumerate() {
                assert_eq!(*d > 0.99, i == j, "{i}: {j} at {d}");
                if i != j {
                    assert_eq!(*d, 0.0, "{i}: {j}");
                }
            }
            // Its words stand under the scene while it holds.
            let [first, second, light] = compose(held).caption;
            assert_eq!([first, second], CAPTIONS[i]);
            assert!(light > 0.99, "{i}");
            let done = without_end(i);
            let next = WITHOUT.get(i + 1).copied().unwrap_or(BOTH);
            assert!(done + 0.2 <= next, "{i}: {done} > {next}");
            assert!(at(done + 0.01).iter().all(|&d| d == 0.0));
            assert_eq!(compose(done + 0.01).caption[2], 0.0, "{i}");
        }
        // Before the pulls the inside is fully lit; the inner ring is on.
        let f = compose(WITHOUT[0]);
        assert!(f.inner > 0.99 && f.ring > 0.99);
        // Art: «больше времени на части "без..." меньше на остальные». The
        // four take nearly half the loop, each holds its words a while.
        assert!(without_end(3) - WITHOUT[0] > 0.45 * LOOP_SECONDS);
        for (i, &from) in WITHOUT.iter().enumerate() {
            assert!(without_end(i) - from > 6.0, "{i}");
        }
        // No words anywhere else in the loop.
        every(0.05, |t| {
            if t < WITHOUT[0] - 0.2 || t > without_end(3) {
                assert_eq!(compose(t).caption[2], 0.0, "{t}");
            }
        });
    }

    #[test]
    fn the_words_fit_a_phone_under_the_scene() {
        for (i, ink) in LABEL_INK.iter().enumerate() {
            let wide = (ink[1] - ink[0]) / LABEL_CAP * CAPTION[0];
            assert!(wide < 0.86, "row {i}: {wide} of the frame");
        }
        // Two lines stay in the lowest fifth of the frame.
        let cap = CAPTION[0] * FRAME_ASPECT;
        assert!(CAPTION[1] + cap * (CAPTION[2] + 1.0) < 0.2);
        for rows in CAPTIONS {
            assert!((rows[0] as usize) < LABEL_INK.len());
            assert!(rows[1] < 0.0 || (rows[1] as usize) < LABEL_INK.len());
        }
    }

    #[test]
    fn falling_into_a_thought_leaves_only_the_head() {
        // Art: «потерять наблюдение за внешним кольцом погрузившись внутрь
        // мысли … выключить всё внешнее кроме персонажа», then «на
        // проваливании … тело исчезало а оставалась голова». Both rings go;
        // the shader takes the body below `HEAD` down with `fall`, and the
        // inside keeps its place (nothing draws up into a second, smaller
        // person).
        let f = compose(WITHOUT[0] + PULL[0] + 0.5 * HOLD[0]);
        assert!(f.outside < 1e-3 && f.room < 1e-3 && f.shell < 1e-3);
        assert!(f.ring < 1e-3 && f.inner > 0.99 && f.fall > 0.999);
        assert!(close(f.skin, SKIN_INSIDE, 1e-3));
        const { assert!(HEAD[0] > 1.1 && HEAD[1] < 1.25) };
        // The thought is in the head; the knot fits inside it.
        assert!(body::figure(THOUGHT) < -0.06, "{}", body::figure(THOUGHT));
        const { assert!(THOUGHT[1] > HEAD[1]) };
        for k in 0..KNOT_POINTS as usize {
            let u = k as f32 / KNOT_POINTS * TAU;
            let p = [
                (u.sin() + 2.0 * (2.0 * u).sin()) * KNOT,
                (u.cos() - 2.0 * (2.0 * u).cos()) * KNOT,
                -(3.0 * u).sin() * KNOT,
            ];
            let r = (dot(p, p)).sqrt();
            assert!(r < 0.065, "{k}: {r}");
        }
        // Everything outside is back once it lets go.
        let f = compose(without_end(0) + 0.01);
        assert!(f.outside > 0.999 && f.room > 0.99 && f.shell > 0.99);
    }

    #[test]
    fn the_head_projects_its_images_one_after_another() {
        // Art: «он должен проецировать разные образы самого себя а не просто
        // зеркально сидящую копию себя». The light leaves the face.
        assert!(body::figure(EYES) < 0.0 && body::figure(EYES) > -0.03);
        let held = WITHOUT[3] + PULL[3] + 0.5 * HOLD[3];
        let f = compose(held);
        assert!(f.projection > 0.99 && f.outside > 0.999);
        // Each forms in its turn, after the body has gone dark; the next is
        // not there yet while one forms; all are whole before letting go.
        for i in 0..4 {
            assert_eq!(self_light(i, SELF_FORM[i] - 0.01), 0.0);
            if i < 3 {
                assert!(SELF_FORM[i + 1] - SELF_FORM[i] > 0.75 * SELF_FORM_SECONDS);
            }
            assert!(self_light(i, WITHOUT[3] + PULL[3] + HOLD[3]) > 0.999, "{i}");
            assert_eq!(self_light(i, without_end(3)), 0.0);
        }
        const { assert!(SELF_FORM[0] > WITHOUT[3] + 0.5 * PULL[3]) };
        let image = |t: f32| compose(t).selves;
        every(0.05, |t| {
            if !(WITHOUT[3]..without_end(3)).contains(&t) {
                assert!(image(t).iter().all(|&v| v == 0.0), "{t}");
            }
        });
    }

    #[test]
    fn both_rings_are_clear_together_and_the_wave_goes_through_both() {
        let f = compose(STILL);
        assert!(f.inner > 0.99 && f.room > 0.99);
        assert!(f.shell > 0.99 && f.ring > 0.99);
        assert_eq!([f.fall, f.grid, f.tremble, f.image], [0.0; 4]);
        assert_eq!(f.caption[2], 0.0);
        // One wave from the chest passes the inner ring, then the outer.
        let inner = crossing(TOGETHER, TOGETHER_SECONDS, 0.0, REACH, 0.4);
        let outer = crossing(TOGETHER, TOGETHER_SECONDS, 0.0, REACH, ORBIT);
        assert!(inner < outer && outer - TOGETHER < 0.7);
        assert!(compose(outer + 0.1).shell > 1.6);
        assert!(compose(inner + 0.1).ring > 1.6);
        const { assert!(INNER_OUT[0] > TOGETHER + TOGETHER_SECONDS) };
        const { assert!(ROOM_OUT[0] > INNER_OUT[0]) };
        // Both come together after the last «Без» has let go.
        const { assert!(BOTH >= WITHOUT[3] + PULL[3] + HOLD[3] + RELEASE[3]) };
    }

    #[test]
    fn the_camera_stays_in_the_room_and_off_the_person() {
        every(0.05, |t| {
            let f = compose(t);
            let [x, y, z] = f.eye;
            assert!(
                x > LEFT + 0.6 && z > BACK + 0.6 && y > 0.6,
                "{t}: {:?}",
                f.eye
            );
            // Off the person and the chair (their box, with room), and out of
            // the sphere.
            let [lo, hi] = PERSON;
            let gap: [f32; 3] =
                std::array::from_fn(|i| (lo[i] - f.eye[i]).max(f.eye[i] - hi[i]).max(0.0));
            assert!(gap.iter().map(|g| g * g).sum::<f32>().sqrt() > 0.8, "{t}");
            assert!(distance(f.eye, HEART) > ORBIT + 0.5, "{t}");
            // Off the lamp and the table, and when near one, not looking at it:
            // its points would fill the frame.
            for (at, half, tall) in [(LAMP, 0.19, 1.72), (TABLE, 0.36, 0.76)] {
                let lo = [at[0] - half, 0.0, at[2] - half];
                let hi = [at[0] + half, tall, at[2] + half];
                let gap: [f32; 3] =
                    std::array::from_fn(|i| (lo[i] - f.eye[i]).max(f.eye[i] - hi[i]).max(0.0));
                let gap = gap.iter().map(|g| g * g).sum::<f32>().sqrt();
                assert!(gap > 0.55, "{t}: {gap} from {at:?}");
                for y in [0.3, 0.9, 0.5 * tall + 0.5 * tall.min(1.6)] {
                    let p = [at[0], y, at[2]];
                    if distance(f.eye, p) < 1.7 {
                        if let Some([x, y]) = project(&f, p) {
                            assert!(x.abs() > 1.1 || y.abs() > 1.1, "{t}: {at:?} at {x} {y}");
                        }
                    }
                }
            }
            // Level-ish: never under the floor's horizon, never straight down.
            let elevation = (-f.forward[1]).asin().to_degrees();
            assert!(elevation > 5.0 && elevation < 60.0, "{t}: {elevation}");
        });
    }

    #[test]
    #[ignore]
    fn print_framing() {
        let mut t = 0.0;
        while t < LOOP_SECONDS {
            let f = compose(t);
            let (mut x0, mut x1, mut y0, mut y1) = (9f32, -9f32, 9f32, -9f32);
            for p in BODY {
                let [x, y] = project(&f, p).unwrap();
                x0 = x0.min(x);
                x1 = x1.max(x);
                y0 = y0.min(y);
                y1 = y1.max(y);
            }
            let [lo, hi] = PERSON;
            let gap: [f32; 3] =
                std::array::from_fn(|i| (lo[i] - f.eye[i]).max(f.eye[i] - hi[i]).max(0.0));
            let gap = gap.iter().map(|g| g * g).sum::<f32>().sqrt();
            let [ex, ey, ez] = f.eye;
            let lamp = distance(f.eye, [LAMP[0], 1.5, LAMP[2]]);
            let seen = project(&f, [LAMP[0], 1.5, LAMP[2]])
                .map(|[x, y]| format!("{x:5.2} {y:5.2}"))
                .unwrap_or_default();
            println!(
                "{t:5.1} x {x0:6.2}..{x1:6.2} y {y0:6.2}..{y1:6.2} eye {ex:5.2} {ey:5.2} {ez:5.2} gap {gap:4.2} az {:6.1} lamp {lamp:4.2} {seen}",
                camera(0, t)
            );
            t += 0.5;
        }
    }

    /// How much of the body at `p` shows: below the head it goes with the
    /// fall into a thought and mostly with the projection.
    fn shown(f: &Frame, p: [f32; 3]) -> f32 {
        if p[1] < HEAD[0] {
            (1.0 - f.fall) * (1.0 - 0.85 * f.projection)
        } else {
            1.0
        }
    }

    #[test]
    fn the_person_and_the_images_stay_in_frame() {
        every(0.1, |t| {
            let f = compose(t);
            for p in BODY {
                if shown(&f, p) > 0.3 {
                    let [x, y] = project(&f, p).expect("in front");
                    assert!(x.abs() < 0.85 && y.abs() < 0.85, "{t}: {p:?} at {x} {y}");
                    // The words keep clear of the person's feet.
                    if f.caption[2] > 0.0 {
                        assert!(y > -0.62, "{t}: {p:?} at {y}");
                    }
                }
            }
        });
        // Every image, whole, in frame and above the words, wherever it shows.
        let [w, h, _] = selves::SELF_CELLS;
        let cells = selves::occupancy();
        let n = selves::SELF_CELLS.iter().product::<usize>();
        every(0.1, |t| {
            let f = compose(t);
            for i in 0..4 {
                if f.selves[i] > 0.05 {
                    for (k, _) in cells[i * n..(i + 1) * n]
                        .iter()
                        .enumerate()
                        .filter(|(_, &v)| v > 0)
                    {
                        let q = selves::cell_centre(k % w, (k / w) % h, k / (w * h));
                        let p = selves::to_world(i, q);
                        let [x, y] = project(&f, p).expect("in front");
                        assert!(x.abs() < 0.9 && y.abs() < 0.85, "{t}: image {i} at {x} {y}");
                        assert!(y > -0.55, "{t}: image {i} at {y}");
                    }
                }
            }
        });
    }

    #[test]
    fn both_rings_show_from_above_and_the_scan_stays_in_frame() {
        // High enough to see the inner ring inside the outer orbit, the whole
        // outer orbit in frame.
        for t in [STILL - 1.0, STILL, STILL + 1.0] {
            let f = compose(t);
            let elevation = (-f.forward[1]).asin().to_degrees();
            assert!(elevation > 35.0, "{t}: {elevation}");
            for k in 0..SAMPLES {
                let a = k as f32 / SAMPLES as f32 * TAU;
                let p = orbit_point(f.orbit, f.orbit_flow, a, HEART, ORBIT);
                let [x, y] = project(&f, p).expect("in front");
                assert!(x.abs() < 0.95 && y.abs() < 0.95, "{t}: {k} at {x} {y}");
            }
        }
        // Wherever the inner ring shows, all of it is in frame.
        every(0.1, |t| {
            let f = compose(t);
            if f.ring > 0.05 {
                for k in 0..SAMPLES {
                    let a = k as f32 / SAMPLES as f32 * TAU;
                    let p = ring_point(f.scan, f.ring_flow, a);
                    let [x, y] = project(&f, p).expect("in front");
                    assert!(x.abs() < 0.95 && y.abs() < 0.95, "{t}: {k} at {x} {y}");
                }
            }
        });
    }

    #[test]
    fn the_sparks_sit_inside_the_body_and_wake_one_by_one() {
        for (i, &p) in SPARK_POINTS.iter().enumerate() {
            assert!(body::figure(p) < -0.005, "{i}: {}", body::figure(p));
            let wake = SPARK_WAKE + SPARK_GAP * i as f32;
            assert_eq!(flare(i, wake - 0.01), 0.0);
            assert!(flare(i, wake + 0.8) > 0.5);
            // The next one is still dark when this one is up.
            if i < 5 {
                assert!(flare(i + 1, wake + SPARK_GAP * 0.99) < 1e-6);
            }
        }
        // They wake after both rings are clear together, and all are up
        // before the «здесь и сейчас» wave.
        const { assert!(SPARK_WAKE > BOTH) };
        const { assert!(SPARK_WAKE + 5.0 * SPARK_GAP + 0.8 < TOGETHER) };
    }

    #[test]
    fn every_dark_theme_keeps_its_accent_cold_and_a_warm_apart_from_it() {
        for code in [0, 2, 3, 4] {
            let look = look(code);
            let accent = Palette::from_code(code).colors().unwrap().accent;
            assert_eq!(look.cold, accent, "{code}");
            let apart = (0..3)
                .map(|i| (look.warm[i] - look.cold[i]).powi(2))
                .sum::<f32>();
            assert!(look.warm[0] > look.warm[2] + 0.3, "{code}");
            assert!(apart.sqrt() > 0.3, "{code}: {}", apart.sqrt());
        }
        assert_eq!(look(1), look(2));
        assert_eq!(look(99), look(2));
    }
}
