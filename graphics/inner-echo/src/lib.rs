//! «Внутрь», page 01 of Step 6 «Внутреннее кольцо», direction «Эхо». A
//! person sits upright on a chair in a dark room. The room exists only where
//! perception touches it: waves run out from the chest as spheres and draw
//! it in cold points (floor, the back wall with its window, the left wall
//! with its door, a table, a floor lamp). The third one stays: a sphere of
//! presence round the person, a shell of points with an orbit, a ring of
//! points that runs round the sphere while its plane turns, so in time it
//! passes over all of it. Then the space inside the sphere fills: presence
//! is spherical, all round at once, never a beam (Art). «ты переходишь
//! внутрь»: one wave runs back in from the walls to the chest, and where it
//! passes, the inside of the body comes up in warm points; three echoes
//! inside raise it and leave the inner sphere round the heart with its own
//! orbit. Each «Без…» shows, once, what it is without, with its words under
//! the scene: falling into a thought (everything outside the person goes
//! dark and the warm points draw up into a knot in the head), analysis (they
//! lock into a grid), trying to understand or fix (they tremble), going off
//! into images of oneself (the body goes dark but for the head, which
//! projects a double of it in front). Then the inner sphere opens against
//! the outer one, sparks of sensation wake in the body one by one, and at
//! «здесь и сейчас» one wave goes through both spheres. Every value here is
//! a pure function of loop time; `browser.rs` only uploads it and one
//! ray-marched pass draws it. Unit: the person sits about 1.4 high; the
//! floor is y = 0, the person faces +z.
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

pub mod body;
pub mod generated;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerEcho;

pub const LOOP_SECONDS: f32 = 60.0;
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
pub const ORBIT_SWINGS: f32 = 2.0;
pub const ORBIT_FLOW: f32 = 6.0;
/// The inner sphere round the heart: its radius closed and open, its orbit's
/// runners, and its orbit, quicker and the other way round.
pub const INNER_SPHERE: [f32; 2] = [0.22, 0.46];
pub const INNER_RUNNERS: f32 = 4.0;
pub const INNER_TURNS: f32 = -5.0;
pub const INNER_TILT: [f32; 2] = [35.0, 20.0];
pub const INNER_SWINGS: f32 = 3.0;
pub const INNER_FLOW: f32 = -10.0;
/// Points on the two shells, this far apart: outer, inner.
pub const SHELL_SPACING: [f32; 2] = [0.08, 0.034];
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
pub const WAVES: [f32; 3] = [0.4, 2.2, 4.0];
pub const WAVE_SECONDS: f32 = 2.8;
pub const WAVE_FROM: f32 = 0.15;
pub const LEVELS: [f32; 3] = [0.45, 0.3, 0.25];
/// «и ты ощущаешь Пространство вокруг тела без вовлечения»: the space inside
/// the sphere fills, all round at once, and breathes `BREATHS` whole times a
/// loop.
pub const PRESENCE: [f32; 2] = [5.6, 7.6];
pub const BREATHS: f32 = 10.0;
/// «ты переходишь внутрь»: one wave back in from `REACH` to the chest; the
/// inside of the body comes up where it has passed, this bright.
pub const INWARD: [f32; 2] = [10.0, 14.2];
pub const INNER_BASE: f32 = 0.4;
/// «внутреннее замечается так же ясно, как внешнее»: three echoes out from
/// the chest to the feet, like the three waves in the room; each leaves the
/// inside this much brighter, the third leaves the inner sphere.
pub const ECHOES: [f32; 3] = [15.0, 16.4, 17.8];
pub const ECHO_SECONDS: f32 = 1.4;
pub const ECHO_REACH: f32 = 1.2;
pub const ECHO_LEVELS: [f32; 3] = [0.25, 0.2, 0.15];
/// «Без проваливания», «Без анализа», «Без попытки понять или исправить»,
/// «Без ухода в образы себя»: each starts here, pulls, holds and lets go
/// before the next.
pub const WITHOUT: [f32; 4] = [20.0, 23.1, 26.2, 29.3];
pub const PULL: [f32; 4] = [0.9, 0.7, 0.7, 1.2];
pub const HOLD: [f32; 4] = [0.8, 0.8, 0.8, 1.0];
pub const RELEASE: [f32; 4] = [1.2, 1.1, 1.1, 1.4];
/// Falling into a thought: everything outside the person goes dark; the
/// inside draws up toward the thought in the head, `DRAW_UP` of the way
/// smaller, and goes dark below the head (rest height, from .. to); the
/// thought is a knot of `KNOT_POINTS` points this big, turning `KNOT_TURNS`
/// whole times a loop.
pub const THOUGHT: [f32; 3] = [0.0, 1.32, -0.01];
pub const DRAW_UP: f32 = 0.38;
pub const HEAD: [f32; 2] = [1.12, 1.22];
pub const KNOT: f32 = 0.019;
pub const KNOT_POINTS: f32 = 72.0;
pub const KNOT_TURNS: f32 = 8.0;
/// Images of oneself: the double sits in front, facing the person (the body
/// mirrored through z = `DOUBLE_Z`); the head projects it from the eyes onto
/// these points of the body (rest shape; the shader mirrors them).
pub const DOUBLE_Z: f32 = 0.9;
pub const EYES: [f32; 3] = [0.0, 1.335, 0.07];
pub const PROJECT_TO: [[f32; 3]; 13] = [
    [0.0, 1.29, 0.0],
    [0.2, 1.08, -0.05],
    [-0.2, 1.08, -0.05],
    [0.222, 0.81, 0.0],
    [-0.222, 0.81, 0.0],
    [0.166, 0.625, 0.33],
    [-0.166, 0.625, 0.33],
    [0.112, 0.53, 0.43],
    [-0.112, 0.53, 0.43],
    [0.126, 0.04, 0.62],
    [-0.126, 0.04, 0.62],
    [0.0, 0.79, -0.04],
    [0.0, 0.6, 0.0],
];
/// The words under the scene for each «Без…»: their rows in the label atlas,
/// the second -1 for a single line.
pub const CAPTIONS: [[f32; 2]; 4] = [[0.0, -1.0], [1.0, -1.0], [2.0, 3.0], [4.0, -1.0]];
/// Their capitals' height (share of the frame width), the lower baseline
/// (share of the frame height, up from its bottom), the gap between two
/// lines' baselines (capitals).
pub const CAPTION: [f32; 3] = [0.03, 0.06, 1.8];
/// «Это — Наблюдение внутреннего кольца, которое раскрывается на фоне
/// внешнего кольца и его сканирования»: the inner sphere opens.
pub const INNER_OPEN: [f32; 2] = [33.2, 35.2];
/// «точности, бдительности и честности … живое Ощущение»: sparks of
/// sensation wake one by one, the first at `SPARK_WAKE`, each next
/// `SPARK_GAP` later: a shoulder, a hand, a knee, the other forearm, the
/// other shoulder, the back.
pub const SPARK_WAKE: f32 = 43.0;
pub const SPARK_GAP: f32 = 0.45;
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
pub const TOGETHER: f32 = 50.0;
pub const TOGETHER_SECONDS: f32 = 2.8;
/// The inside goes dark, then the room, back to the person alone.
pub const INNER_OUT: [f32; 2] = [54.6, 58.2];
pub const ROOM_OUT: [f32; 2] = [55.2, 59.4];
/// Reduced motion: the room and the inside both clear, the inner sphere
/// open against the outer one.
pub const STILL: f32 = 39.0;

/// The skin's own cold light: the perceiver is there from the first frame;
/// it steps back while the inside is lit.
pub const SKIN: f32 = 1.0;
pub const SKIN_INSIDE: f32 = 0.35;

/// The camera, keyed through the loop: round the person (degrees from +z
/// toward +x), over the floor (degrees), how far, the point it looks at, and
/// the height of the frame (degrees). Wide for the room, close for the
/// inside, close on the head as it falls into a thought, from the side for
/// the double in front, high over both spheres, close again, back.
pub const CAMERA: [(f32, [f32; 7]); 12] = [
    (0.0, [34.0, 18.0, 4.9, -0.3, 0.8, -0.6, 52.0]),
    (7.5, [26.0, 19.0, 4.75, -0.3, 0.8, -0.55, 52.0]),
    (12.0, [34.0, 15.0, 3.6, -0.15, 0.7, -0.25, 48.0]),
    (15.5, [42.0, 12.0, 2.9, -0.06, 0.64, 0.0, 46.0]),
    (21.2, [30.0, 10.0, 3.0, -0.02, 0.47, 0.02, 44.0]),
    (25.5, [46.0, 13.0, 3.1, -0.1, 0.5, 0.06, 46.0]),
    (30.6, [155.0, 15.0, 3.0, 0.0, 0.48, 0.9, 58.0]),
    (36.0, [42.0, 38.0, 4.1, -0.05, 0.62, -0.15, 54.0]),
    (41.0, [22.0, 44.0, 4.2, -0.05, 0.58, -0.2, 54.0]),
    (46.5, [50.0, 15.0, 2.8, -0.04, 0.64, 0.0, 46.0]),
    (51.0, [40.0, 22.0, 3.8, -0.12, 0.7, -0.2, 50.0]),
    (55.5, [34.0, 20.0, 4.5, -0.25, 0.8, -0.5, 52.0]),
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
    /// The room's light (0..1), the outer sphere's shell and orbit, the
    /// skin's, the presence filling the sphere.
    pub room: f32,
    pub shell: f32,
    pub skin: f32,
    pub presence: f32,
    /// The outer orbit: its pole and how far its points have run.
    pub orbit: [f32; 3],
    pub orbit_flow: f32,
    /// The inside: its light, the inner sphere's, the inner sphere's radius,
    /// its orbit's pole and how far its points have run.
    pub inner: f32,
    pub ring: f32,
    pub ring_radius: f32,
    pub ring_orbit: [f32; 3],
    pub ring_flow: f32,
    /// The four pulls (0..1 each): falling into a thought, the grid,
    /// trembling, images of oneself.
    pub fall: f32,
    pub grid: f32,
    pub tremble: f32,
    pub image: f32,
    /// Falling in: what is left of everything outside the person, how big
    /// the inside is round the thought, how far the knot has turned.
    pub outside: f32,
    pub draw_up: f32,
    pub knot_turn: f32,
    /// Images of oneself: the projection from the head, the double's light.
    pub projection: f32,
    pub twin: f32,
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

/// The inner orbit at `t`.
pub fn ring_orbit(t: f32) -> ([f32; 3], f32) {
    orbit_at(INNER_TURNS, INNER_TILT, INNER_SWINGS, 1.0, INNER_FLOW, t)
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

/// When the sphere and the inner sphere light: as the third wave out, and
/// the third echo, reach them.
pub fn orbit_lit() -> f32 {
    crossing(WAVES[2], WAVE_SECONDS, WAVE_FROM, REACH, ORBIT)
}
pub fn ring_lit() -> f32 {
    crossing(ECHOES[2], ECHO_SECONDS, 0.0, ECHO_REACH, INNER_SPHERE[0])
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
    // Both spheres flash once as the «здесь и сейчас» wave passes them.
    let flash = |radius: f32| {
        let at = crossing(TOGETHER, TOGETHER_SECONDS, 0.0, REACH, radius);
        smooth(at - 0.25, at + 0.15, time) * (-(time - at - 0.15).max(0.0) / 0.7).exp()
    };
    let orbit_at = orbit_lit();
    let ring_at = ring_lit();
    let room_out = 1.0 - smooth(ROOM_OUT[0], ROOM_OUT[1], time);
    let inner_out = 1.0 - smooth(INNER_OUT[0], INNER_OUT[1], time);
    let open = window(
        time,
        INNER_OPEN[0],
        INNER_OPEN[1],
        INNER_OUT[0],
        INNER_OUT[1],
    );
    let ring_radius = INNER_SPHERE[0] + (INNER_SPHERE[1] - INNER_SPHERE[0]) * open;
    let fall = pull(0, time);
    let image = pull(3, time);
    let outside = 1.0 - fall;
    let projection = smooth(0.0, 0.6, image);
    let breath = 1.0 + 0.12 * (TAU * BREATHS * time / LOOP_SECONDS).sin();
    let (orbit, orbit_flow) = orbit(time);
    let (ring_orbit, ring_flow) = ring_orbit(time);

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
        presence: window(
            time,
            PRESENCE[0],
            PRESENCE[1],
            ROOM_OUT[0],
            ROOM_OUT[1] - 1.0,
        ) * outside
            * breath,
        orbit,
        orbit_flow,
        inner: window(time, INWARD[0], INWARD[0] + 0.5, INNER_OUT[0], INNER_OUT[1]),
        ring: (smooth(ring_at, ring_at + 0.5, time) * inner_out + 0.8 * flash(ring_radius))
            * (1.0 - 0.85 * fall)
            * (1.0 - 0.7 * projection),
        ring_radius,
        ring_orbit,
        ring_flow,
        fall,
        grid: pull(1, time),
        tremble: pull(2, time),
        image,
        outside,
        draw_up: 1.0 - DRAW_UP * fall,
        knot_turn: TAU * KNOT_TURNS * time / LOOP_SECONDS,
        projection,
        twin: smooth(0.3, 1.0, image),
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

/// A point of the body as the double holds it: mirrored through
/// z = `DOUBLE_Z`, so it sits in front, facing the person.
pub fn doubled(p: [f32; 3]) -> [f32; 3] {
    [-p[0], p[1], 2.0 * DOUBLE_Z - p[2]]
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
            assert!(
                close(before.ring_orbit[i], after.ring_orbit[i], 1e-3),
                "{i}"
            );
        }
        assert!(close(before.lens, after.lens, 1e-4));
        for turn in [
            before.orbit_flow - after.orbit_flow,
            before.ring_flow - after.ring_flow,
            before.knot_turn - after.knot_turn,
        ] {
            assert!(close(turn.cos(), 1.0, 1e-4) && close(turn.sin(), 0.0, 5e-3));
        }
        // Across the seam only the person is there: no room, no spheres, no
        // inside, no fronts, no words, the skin at rest.
        for f in [before, after] {
            assert!(f.room < 1e-3 && f.inner < 1e-3, "{f:?}");
            assert!(
                f.shell < 1e-3 && f.ring < 1e-3 && f.presence < 1e-3,
                "{f:?}"
            );
            assert!(f.waves.iter().all(|w| w[1] == 0.0));
            assert!(f.echoes.iter().all(|w| w[1] == 0.0));
            assert!(f.inward[1] == 0.0 && f.together[1] == 0.0);
            assert!(f.caption[2] == 0.0 && f.flares.iter().all(|&s| s < 1e-3));
            assert!(close(f.skin, SKIN, 1e-4));
        }
    }

    #[test]
    fn both_orbits_run_round_their_spheres_and_their_planes_keep_turning() {
        for turns in [
            ORBIT_TURNS,
            ORBIT_SWINGS,
            ORBIT_FLOW,
            INNER_TURNS,
            INNER_SWINGS,
            INNER_FLOW,
            KNOT_TURNS,
            BREATHS,
        ] {
            assert_eq!(turns.fract(), 0.0);
        }
        // Art: «Внешнее кольцо стоит на месте почему? это орбита сферы». The
        // plane of each orbit is never still: its pole moves at least this
        // much every five seconds, and over the loop it leans every way.
        every(0.25, |t| {
            let (a, _) = orbit(t);
            let (b, _) = orbit(t + 5.0);
            assert!(angle(a, b) > 15.0, "{t}: {}", angle(a, b));
            let (c, _) = ring_orbit(t);
            let (d, _) = ring_orbit(t + 5.0);
            assert!(angle(c, d) > 25.0, "{t}: {}", angle(c, d));
            for p in [a, c] {
                assert!(close(dot(p, p), 1.0, 1e-5));
            }
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
    fn the_sphere_comes_with_the_third_wave_and_presence_fills_it_after() {
        let at = orbit_lit();
        assert!(close(wave(2, at)[0], ORBIT, 1e-3));
        assert!(compose(at - 0.05).shell < 1e-3);
        assert!(compose(at + 0.7).shell > 0.99);
        assert!(PRESENCE[0] > at);
        assert!(compose(PRESENCE[1]).presence > 0.85);
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
                assert!(
                    (f.ring_orbit[i] - previous.ring_orbit[i]).abs() < 0.02,
                    "ring at {t}"
                );
            }
            assert!((f.lens - previous.lens).abs() < 0.003, "lens at {t}");
            assert!((f.ring_radius - previous.ring_radius).abs() < 0.005, "{t}");
            let lights = |f: &Frame| {
                [
                    f.room,
                    f.shell,
                    f.skin,
                    f.presence,
                    f.inner,
                    f.ring,
                    f.fall,
                    f.grid,
                    f.tremble,
                    f.image,
                    f.outside,
                    f.draw_up,
                    f.projection,
                    f.twin,
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
        assert!(at > ECHOES[2] && at < ECHOES[2] + 0.4);
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
            let next = WITHOUT.get(i + 1).copied().unwrap_or(INNER_OPEN[0]);
            assert!(done + 0.2 <= next, "{i}: {done} > {next}");
            assert!(at(done + 0.01).iter().all(|&d| d == 0.0));
            assert_eq!(compose(done + 0.01).caption[2], 0.0, "{i}");
        }
        // Before the pulls the inside is fully lit; the inner sphere is on.
        let f = compose(WITHOUT[0]);
        assert!(f.inner > 0.99 && f.ring > 0.99);
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
    fn falling_into_a_thought_leaves_only_the_person() {
        // Art: «потерять наблюдение за внешним кольцом погрузившись внутрь
        // мысли … выключить всё внешнее кроме персонажа».
        let f = compose(WITHOUT[0] + PULL[0] + 0.5 * HOLD[0]);
        assert!(f.outside < 1e-3 && f.room < 1e-3 && f.shell < 1e-3 && f.presence < 1e-3);
        assert!(f.ring < 0.2 && f.inner > 0.99);
        assert!(close(f.skin, SKIN_INSIDE, 1e-3));
        assert!(close(f.draw_up, 1.0 - DRAW_UP, 1e-3));
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
    fn the_double_sits_in_front_facing_the_person() {
        // Art: «двойник был не сбоку а спереди … голова как бы проецировала
        // двойника».
        let front = BODY.iter().map(|p| p[2]).fold(f32::MIN, f32::max);
        for p in BODY {
            let q = doubled(p);
            assert!(q[2] > front + 0.3, "{q:?}");
            assert!(close(q[0], -p[0], 0.0) && close(q[1], p[1], 0.0));
        }
        // Its face looks back at the person: the double's nose is nearer
        // the person than the back of its head.
        assert!(doubled([0.0, 1.31, 0.08])[2] < doubled([0.0, 1.31, -0.12])[2]);
        // The projection leaves the face and lands on the double.
        assert!(body::figure(EYES) < 0.0 && body::figure(EYES) > -0.03);
        for p in PROJECT_TO {
            assert!(body::figure(p) < 0.0, "{p:?}");
        }
        let f = compose(WITHOUT[3] + PULL[3] + 0.5 * HOLD[3]);
        assert!(f.projection > 0.99 && f.twin > 0.99);
        assert!(f.outside > 0.999);
    }

    #[test]
    fn both_spheres_are_clear_together_and_the_wave_goes_through_both() {
        let f = compose(STILL);
        assert!(f.presence > 0.85 && f.inner > 0.99 && f.room > 0.99);
        assert!(f.shell > 0.99 && f.ring > 0.99);
        assert!(close(f.ring_radius, INNER_SPHERE[1], 1e-4));
        assert_eq!([f.fall, f.grid, f.tremble, f.image], [0.0; 4]);
        assert_eq!(f.caption[2], 0.0);
        // One wave from the chest passes the inner sphere, then the outer.
        let inner = crossing(TOGETHER, TOGETHER_SECONDS, 0.0, REACH, INNER_SPHERE[1]);
        let outer = crossing(TOGETHER, TOGETHER_SECONDS, 0.0, REACH, ORBIT);
        assert!(inner < outer && outer - TOGETHER < 0.7);
        assert!(compose(outer + 0.1).shell > 1.6);
        assert!(compose(inner + 0.1).ring > 1.6);
        const { assert!(INNER_OUT[0] > TOGETHER + TOGETHER_SECONDS) };
        const { assert!(ROOM_OUT[0] > INNER_OUT[0]) };
        // The inner sphere opens after the last «Без» has let go.
        const { assert!(INNER_OPEN[0] >= WITHOUT[3] + PULL[3] + HOLD[3] + RELEASE[3]) };
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
            println!("{t:5.1} x {x0:6.2}..{x1:6.2} y {y0:6.2}..{y1:6.2}");
            t += 0.5;
        }
    }

    #[test]
    fn the_person_and_the_double_stay_in_frame() {
        every(0.1, |t| {
            let f = compose(t);
            for p in BODY {
                let [x, y] = project(&f, p).expect("in front");
                assert!(x.abs() < 0.85 && y.abs() < 0.85, "{t}: {p:?} at {x} {y}");
            }
            // The words keep clear of the person's feet.
            if f.caption[2] > 0.0 {
                for p in BODY {
                    let [_, y] = project(&f, p).unwrap();
                    assert!(y > -0.62, "{t}: {p:?} at {y}");
                }
            }
        });
        for t in [
            WITHOUT[3] + PULL[3] * 0.5,
            WITHOUT[3] + PULL[3] + 0.5 * HOLD[3],
            without_end(3) - 0.5,
        ] {
            let f = compose(t);
            for p in BODY {
                let q = doubled(p);
                let [x, y] = project(&f, q).expect("in front");
                assert!(
                    x.abs() < 0.9 && y.abs() < 0.85,
                    "{t}: double {q:?} at {x} {y}"
                );
            }
        }
    }

    #[test]
    fn the_inner_sphere_shows_against_the_outer_one_from_above() {
        // P3: high enough to see into the sphere, the whole outer orbit in
        // frame.
        for t in [37.0, 39.0, 41.0] {
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
        // Close up the inner sphere is at least a tenth of the frame wide.
        for t in [WITHOUT[1], 47.0] {
            let f = compose(t);
            let r = f.ring_radius;
            let [a, _] = project(
                &f,
                [
                    HEART[0] - r * f.right[0],
                    HEART[1],
                    HEART[2] - r * f.right[2],
                ],
            )
            .unwrap();
            let [b, _] = project(
                &f,
                [
                    HEART[0] + r * f.right[0],
                    HEART[1],
                    HEART[2] + r * f.right[2],
                ],
            )
            .unwrap();
            assert!((b - a).abs() > 0.2, "{t}: {}", (b - a).abs());
        }
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
        // They wake after the inner sphere has opened, and all are up before
        // the «здесь и сейчас» wave.
        const { assert!(SPARK_WAKE > INNER_OPEN[1]) };
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
