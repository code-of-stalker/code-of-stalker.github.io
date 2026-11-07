//! «Каркас», page 02 of Step 6 «Внутреннее кольцо», direction «Стройка».
//! The outer orbit is drawn as a construction: a ring truss (three chords,
//! cross-sections, Warren diagonals) on six legs, a 3D blueprint in thin
//! cold lines over a floor grid, its hidden lines dashed, under a camera that
//! keeps slowly going round it. «Устойчиво держи внешнюю орбиту»: a plan
//! circle is set out on the floor, the truss is drawn module by module round
//! it and stands on its legs. «динамичным и активным»: the ring starts to
//! turn on its bearings and runners go along its chords. «слышать, ощущать и
//! сканировать»: faint survey rays reach out from the ring. The six signals
//! of the list come one by one as drawn waves, each with its callout, and
//! where one reaches the ring its node flashes and two pulses run round it:
//! arcs of sound, a moving cube, a lamp with its light and the ring's shadow,
//! rising heat, rings running over the floor that shake the legs, and the
//! room's own box with its dimensions. «якорь»: piles go down into the
//! ground under every leg. «не должен выключаться»: everything around goes
//! dark and the truss alone stays lit. «каркас»: posts rise from the legs
//! and the next tiers are drawn in warm dashes over it. Then the drawing is
//! wiped off in the order it was drawn.
//!
//! Every stroke is a pure function of loop time: `draw` fills a `Pen` with
//! straight 3D segments and callouts, and `browser.rs` only uploads them.
//! Unit: the ring is 1 across its middle; the floor is y = 0; azimuths are
//! degrees from +x toward +z.
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

pub mod generated;
pub mod pen;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerFrame;

use pen::{add, cross, dot, length, lerp, normalize, scale, sub, Ink, Pen, COLD, PALE, WARM};

pub const LOOP_SECONDS: f32 = 60.0;
/// The frame is 3:2; a canvas of another shape keeps the whole 3:2 frame in
/// view.
pub const FRAME_ASPECT: f32 = 1.5;
/// The middle of the truss: hidden lines are the ones behind it.
pub const CENTRE: [f32; 3] = [0.0, 0.88, 0.0];

/// The floor: grid steps (minor, major), their light, and the radius over
/// which the grid fades out.
pub const GRID_STEP: [f32; 2] = [0.25, 1.0];
pub const GRID_LIGHT: [f32; 2] = [0.05, 0.11];
pub const GRID_REACH: [f32; 2] = [1.6, 4.3];
pub const GRID_IN: [f32; 2] = [0.0, 1.6];
pub const GRID_OUT: [f32; 2] = [58.4, 60.0];
/// The plan circle set out on the floor first, its radius.
pub const PLAN: f32 = 1.0;
pub const PLAN_IN: [f32; 2] = [0.6, 2.4];
pub const PLAN_OUT: [f32; 2] = [58.2, 59.4];

/// The truss: 40 modules round; its chords (radius, height): lower outer,
/// lower inner, top.
pub const MODULES: usize = 40;
pub const CHORDS: [[f32; 2]; 3] = [[1.06, 0.8], [0.94, 0.8], [1.0, 0.97]];
const LO: usize = 0;
const LI: usize = 1;
const TP: usize = 2;
/// One module, degrees.
pub const MODULE: f32 = 360.0 / MODULES as f32;
/// It is drawn from this azimuth on round the ring: the chords' pen goes
/// round in `BUILD`, and each module's members are drawn in
/// `MEMBER_SECONDS` once the chords span it.
pub const BUILD_FROM: f32 = 50.0;
pub const BUILD: [f32; 2] = [2.0, 5.8];
pub const MEMBER_SECONDS: f32 = 0.55;
/// The wipe goes the same way round: each module's members go in the half
/// second before the chords' eraser passes it.
pub const UNBUILD: [f32; 2] = [55.9, 58.6];
pub const UNMEMBER_SECONDS: f32 = 0.5;

/// Six legs, the first at `LEG_FROM`, then every 60°: the roller the ring
/// turns on (radius, height of its centre; its size), the foot, the side of
/// the footing. A leg comes down once its module is drawn, then its footing.
pub const LEGS: usize = 6;
pub const LEG_FROM: f32 = 15.0;
pub const LEG_TOP: [f32; 2] = [1.0, 0.77];
pub const ROLLER: f32 = 0.03;
pub const LEG_FOOT: [f32; 2] = [1.12, 0.0];
pub const FOOTING: f32 = 0.16;
pub const LEG_SECONDS: [f32; 2] = [0.35, 0.25];

/// «Первый уровень остается динамичным и активным»: the ring turns on its
/// legs, easing in and out (degrees a second), and runners go along the top
/// and the outer chords, opposite ways.
pub const SPIN: f32 = 6.0;
pub const SPIN_UP: [f32; 2] = [7.0, 9.5];
pub const SPIN_DOWN: [f32; 2] = [52.0, 54.5];
pub const RUNNERS: usize = 3;
pub const RUNNER_SPEED: f32 = 50.0;
pub const RUNNERS_ON: [f32; 4] = [7.0, 8.5, 53.5, 55.0];

/// «Ты продолжаешь слышать, ощущать и сканировать»: a survey ray to every
/// signal's place, one after another.
pub const SURVEY: f32 = 10.5;
pub const SURVEY_GAP: f32 = 0.45;
/// The six signals, `SIGNAL_SECONDS` each from `SIGNALS`; afterwards each
/// stays at `LINGER` until the quiet.
pub const SIGNALS: f32 = 14.0;
pub const SIGNAL_SECONDS: f32 = 3.5;
pub const LINGER: f32 = 0.28;
/// Sound: its source (azimuth, radius, height), arcs every `ARC_GAP` at
/// `ARC_SPEED`.
pub const SOUND: [f32; 3] = [142.0, 2.05, 0.95];
pub const ARC_GAP: f32 = 0.5;
pub const ARC_SPEED: f32 = 0.9;
/// Motion: a wire cube's path (azimuth at the start, degrees a second,
/// radius, height) and its edge.
pub const PATH: [f32; 4] = [10.0, 46.0, 1.72, 0.55];
pub const CUBE: f32 = 0.11;
/// Light and shadow: the lamp (azimuth at the start, degrees a second,
/// radius, height).
pub const LAMP: [f32; 4] = [-28.0, -7.0, 1.8, 2.0];
/// Temperature: the warm spot on the floor; its heat rises this high.
pub const HEAT: [f32; 3] = [46.0, 1.42, 0.0];
pub const HEAT_TOP: f32 = 1.7;
/// Floor vibration: the epicentre (azimuth, radius, height) and its rings
/// (speed, when the first leaves, the gap between them).
pub const QUAKE_AT: [f32; 3] = [230.0, 2.0, 0.0];
pub const QUAKE: [f32; 3] = [1.4, 0.25, 0.45];
/// The volume of the space: a box (half its side, its height).
pub const ROOM: [f32; 2] = [1.7, 2.2];

/// «Это твой внешний якорь»: piles go this deep under the legs.
pub const ANCHOR: f32 = 35.0;
pub const PILE_DEPTH: f32 = -0.85;
/// «Он не должен выключаться»: everything around goes dark, the grid to
/// `QUIET_GRID` of itself, and the truss stays lit, a little brighter.
pub const QUIET: [f32; 2] = [39.0, 41.5];
pub const QUIET_GRID: f32 = 0.25;
/// «каркас для выстраивания последующих уровней»: posts rise from the legs
/// to `POST_TOP`, warm tiers are drawn at `TIERS` (an inner ring at the
/// first).
pub const POSTS: f32 = 43.0;
pub const POST_TOP: f32 = 2.55;
pub const TIERS: [f32; 2] = [1.75, 2.55];
pub const INNER_TIER: f32 = 0.42;
/// Reduced motion: the frame drawn whole, its callout up.
pub const STILL: f32 = 51.0;

/// Callouts: their capitals' height (share of the frame height) and the
/// least it may be (CSS px).
pub const LABEL_SIZE: [f32; 2] = [0.018, 6.5];

/// The callouts' rows in the label atlas (`tools/prepare-assets.py`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Word {
    Sounds,
    Motion,
    Light,
    Heat,
    Floor,
    Volume,
    Anchor,
    Frame,
}
pub const WORDS: usize = 8;

/// The camera, keyed through the loop: round the ring (degrees from +x
/// toward +z), over the floor (degrees), how far, the point it looks at, and
/// the height of the frame (degrees). It keeps going round one way while
/// the signals come, pulls back for the room's box, sinks for the piles and
/// rises with the frame.
pub const CAMERA: [(f32, [f32; 7]); 13] = [
    (0.0, [46.0, 17.0, 4.3, 0.0, 0.45, 0.0, 38.0]),
    (7.0, [53.0, 16.0, 4.1, 0.0, 0.5, 0.0, 38.0]),
    (12.5, [58.0, 16.0, 4.4, 0.0, 0.58, 0.0, 40.0]),
    (15.5, [62.0, 15.0, 4.5, -0.15, 0.75, 0.1, 40.0]),
    (19.0, [66.0, 14.0, 4.3, 0.0, 0.7, 0.1, 40.0]),
    (22.5, [70.0, 20.0, 4.6, 0.15, 0.85, -0.05, 42.0]),
    (26.0, [74.0, 15.0, 4.3, 0.1, 0.75, 0.1, 40.0]),
    (29.5, [79.0, 21.0, 4.7, -0.1, 0.55, 0.15, 40.0]),
    (33.5, [84.0, 22.0, 6.4, 0.0, 0.95, 0.0, 42.0]),
    (37.5, [82.0, 14.0, 5.0, 0.0, 0.35, 0.0, 40.0]),
    (41.5, [74.0, 16.0, 5.3, 0.0, 1.0, 0.0, 41.0]),
    (47.5, [66.0, 15.0, 5.5, 0.0, 1.3, 0.0, 42.0]),
    (53.5, [58.0, 15.0, 5.5, 0.0, 1.32, 0.0, 42.0]),
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    /// Loop time.
    pub time: f32,
    /// The camera: its place and axes, and the tangent of half the frame's
    /// height.
    pub eye: [f32; 3],
    pub right: [f32; 3],
    pub up: [f32; 3],
    pub forward: [f32; 3],
    pub lens: f32,
    /// The floor grid's light (0..1).
    pub grid: f32,
    /// Floor vibration for the grid's ripple: the epicentre (x, z), seconds
    /// since its signal began, its light.
    pub quake: [f32; 4],
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
fn window(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

/// `smooth(a, b, ·)` summed up to `t`: how far something has gone that
/// eases from standing to one unit a second between `a` and `b`.
fn eased(a: f32, b: f32, t: f32) -> f32 {
    if t <= a {
        return 0.0;
    }
    if t >= b {
        return 0.5 * (b - a) + (t - b);
    }
    let x = (t - a) / (b - a);
    (b - a) * (x * x * x - 0.5 * x * x * x * x)
}

/// A point at azimuth `deg`, `r` from the axis, at height `y`.
pub fn polar(deg: f32, r: f32, y: f32) -> [f32; 3] {
    let (s, c) = deg.to_radians().sin_cos();
    [r * c, y, r * s]
}

fn at(p: [f32; 3]) -> [f32; 3] {
    polar(p[0], p[1], p[2])
}

/// Degrees into -180..180.
fn turn(d: f32) -> f32 {
    (d + 180.0).rem_euclid(360.0) - 180.0
}

fn loop_time(t: f32) -> f32 {
    if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    }
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

/// How far the ring has turned on its legs (degrees).
pub fn spin(t: f32) -> f32 {
    SPIN * (eased(SPIN_UP[0], SPIN_UP[1], t) - eased(SPIN_DOWN[0], SPIN_DOWN[1], t))
}

pub fn compose(t: f32) -> Frame {
    let time = loop_time(t);
    let [azimuth, elevation, distance, tx, ty, tz, height] =
        std::array::from_fn(|c| camera(c, time));
    let (sa, ca) = azimuth.to_radians().sin_cos();
    let (se, ce) = elevation.to_radians().sin_cos();
    let out = [ca * ce, se, sa * ce];
    let eye = [
        tx + distance * out[0],
        ty + distance * out[1],
        tz + distance * out[2],
    ];
    let forward = out.map(|v| -v);
    // Level with the floor however high the camera climbs.
    let right = [sa, 0.0, -ca];
    let up = cross(right, forward);
    let quiet = smooth(QUIET[0], QUIET[1], time);
    let q = signal_time(4, time);
    let quake_at = at(QUAKE_AT);
    Frame {
        time,
        eye,
        right,
        up,
        forward,
        lens: (height.to_radians() * 0.5).tan(),
        grid: smooth(GRID_IN[0], GRID_IN[1], time)
            * (1.0 - smooth(GRID_OUT[0], GRID_OUT[1], time))
            * (1.0 - (1.0 - QUIET_GRID) * quiet),
        quake: [quake_at[0], quake_at[2], q, window(q, 0.15, 0.4, 3.6, 4.4)],
    }
}

/// Where a world point lands in the 3:2 frame, -1..1 both ways; None behind
/// the camera.
pub fn project(f: &Frame, point: [f32; 3]) -> Option<[f32; 2]> {
    let v = sub(point, f.eye);
    let z = dot(v, f.forward);
    (z > 0.0).then(|| {
        [
            dot(v, f.right) / (z * f.lens * FRAME_ASPECT),
            dot(v, f.up) / (z * f.lens),
        ]
    })
}

// ---------- inks

const CHORD: Ink = Ink::new(1.3, 0.9, COLD).behind();
const MEMBER: Ink = Ink::new(0.9, 0.55, COLD).behind();
const LEG: Ink = Ink::new(1.1, 0.7, COLD).behind();
const PLAN_INK: Ink = Ink::new(0.8, 0.35, COLD).dashed(0.06, 0.55);
const SIGNAL: Ink = Ink::new(0.9, 0.7, PALE);
const FAINT: Ink = Ink::new(0.8, 0.3, PALE).dashed(0.05, 0.5);
const SHADOW: Ink = Ink::new(0.9, 0.4, COLD).dashed(0.05, 0.55);
const PILE: Ink = Ink::new(1.0, 0.6, COLD).dashed(0.05, 0.55);
const POST: Ink = Ink::new(1.2, 0.95, WARM).behind();
const TIER: Ink = Ink::new(1.2, 1.0, WARM).dashed(0.07, 0.6).behind();
const AXIS: Ink = Ink::new(0.8, 0.55, WARM).dashed(0.16, 0.72);
const RUNNER: [f32; 3] = [0.45, 0.55, 0.0];

// ---------- the truss

/// Time the chords' pen reaches `j` modules round.
fn built(j: usize) -> f32 {
    BUILD[0] + (BUILD[1] - BUILD[0]) * j as f32 / MODULES as f32
}

/// Time the chords' eraser reaches `j` modules round.
fn wiped(j: usize) -> f32 {
    UNBUILD[0] + (UNBUILD[1] - UNBUILD[0]) * j as f32 / MODULES as f32
}

/// How much of module `i`'s members is drawn and how much already wiped.
pub fn members(i: usize, t: f32) -> [f32; 2] {
    [
        ((t - built(i + 1)) / MEMBER_SECONDS).clamp(0.0, 1.0),
        ((t - wiped(i) + UNMEMBER_SECONDS) / UNMEMBER_SECONDS).clamp(0.0, 1.0),
    ]
}

/// How far round (degrees from `BUILD_FROM`) the chords are drawn, and how
/// far they are wiped.
pub fn chords(t: f32) -> [f32; 2] {
    let run = |a: f32, b: f32| 360.0 * ((t - a) / (b - a)).clamp(0.0, 1.0);
    [run(BUILD[0], BUILD[1]), run(UNBUILD[0], UNBUILD[1])]
}

/// The total turn by the end of the loop: the ring stands still again when
/// it is wiped.
pub fn spun() -> f32 {
    spin(LOOP_SECONDS)
}

fn node(c: usize, deg: f32) -> [f32; 3] {
    polar(deg, CHORDS[c][0], CHORDS[c][1])
}

/// A signal's moment on the ring: when it lands, where (azimuth), how
/// strongly, whether the whole ring answers at once, and the node it
/// flashes.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Hit {
    pub at: f32,
    pub angle: f32,
    pub strength: f32,
    pub whole: bool,
    pub node: [f32; 3],
}

pub fn leg_angle(k: usize) -> f32 {
    LEG_FROM + 60.0 * k as f32
}

fn leg_top(k: usize) -> [f32; 3] {
    polar(leg_angle(k), LEG_TOP[0], LEG_TOP[1])
}

fn leg_foot(k: usize) -> [f32; 3] {
    polar(leg_angle(k), LEG_FOOT[0], LEG_FOOT[1])
}

fn signal_from(k: usize) -> f32 {
    SIGNALS + SIGNAL_SECONDS * k as f32
}

/// Seconds since signal `k` began (negative before).
fn signal_time(k: usize, t: f32) -> f32 {
    t - signal_from(k)
}

/// The sound's first arc reaches the ring this long after the sound starts.
fn sound_reaches() -> f32 {
    let d = length(sub(node(TP, SOUND[0]), at(SOUND)));
    0.2 + (d - 0.06) / ARC_SPEED
}

/// When the floor's first ring reaches leg `k`'s foot (seconds into the
/// vibration).
pub fn quake_reaches(k: usize) -> f32 {
    let e = at(QUAKE_AT);
    let f = leg_foot(k);
    let d = ((e[0] - f[0]).powi(2) + (e[2] - f[2]).powi(2)).sqrt();
    QUAKE[1] + d / QUAKE[0]
}

const CLIMB: f32 = 0.35;
const HEAT_RISE: f32 = 0.75;
const LIGHT_HIT: f32 = 0.91;
const MOTION_HIT: f32 = (66.0 - PATH[0]) / PATH[1];

pub fn hits() -> [Hit; 11] {
    let one = |k: usize, tau: f32, angle: f32| Hit {
        at: signal_from(k) + tau,
        angle,
        strength: 1.0,
        whole: false,
        node: node(TP, angle),
    };
    let lamp = lamp_angle(LIGHT_HIT);
    let floor = |k: usize| Hit {
        at: signal_from(4) + quake_reaches(k) + CLIMB,
        angle: leg_angle(k),
        strength: 0.6,
        whole: false,
        node: leg_top(k),
    };
    [
        one(0, sound_reaches(), SOUND[0]),
        one(1, MOTION_HIT, 66.0),
        one(2, LIGHT_HIT, lamp),
        one(3, CHORDS[TP][1] / HEAT_RISE + 0.05, HEAT[0]),
        floor(0),
        floor(1),
        floor(2),
        floor(3),
        floor(4),
        floor(5),
        Hit {
            at: signal_from(5) + 2.2,
            angle: 0.0,
            strength: 1.0,
            whole: true,
            node: CENTRE,
        },
    ]
}

/// How much the ring is lit up at azimuth `angle` by the signals landing on
/// it: two pulses run each way round from a hit; a whole hit lights it all.
pub fn glow(angle: f32, t: f32) -> f32 {
    let mut g = 0.0;
    for h in hits() {
        let dt = t - h.at;
        if !(0.0..3.0).contains(&dt) {
            continue;
        }
        let a = h.strength * smooth(0.0, 0.12, dt) * (1.0 - smooth(2.4, 3.0, dt));
        if h.whole {
            g += a * (-dt).exp();
            continue;
        }
        let a = a * (-dt / 0.9).exp();
        // The node itself, then two pulses running off it.
        let here = turn(angle - h.angle) / 12.0;
        g += a * (-dt / 0.6).exp() * (-here * here).exp();
        for side in [-1.0, 1.0] {
            let d = turn(angle - h.angle - side * 150.0 * dt) / 10.0;
            g += a * (-d * d).exp();
        }
    }
    g
}

/// The truss's own light: brighter once everything around has gone.
fn truss_light(t: f32) -> f32 {
    1.0 + 0.25 * smooth(QUIET[0], QUIET[1], t)
}

fn truss(t: f32, pen: &mut Pen) {
    let rot = spin(t);
    let [drawn, wiped_round] = chords(t);
    let base = truss_light(t);
    let half = 0.5 * MODULE;
    for i in 0..MODULES {
        let a0 = BUILD_FROM + MODULE * i as f32;
        let lit = base * (1.0 + 1.2 * glow(a0 + half + rot, t));
        // The chords, two straight pieces a module, drawn up to the pen and
        // from the eraser on.
        for piece in 0..2 {
            let w0 = MODULE * i as f32 + half * piece as f32;
            let from = (wiped_round - w0) / half;
            let to = (drawn - w0) / half;
            if to <= 0.0 || from >= 1.0 {
                continue;
            }
            for (c, ink) in [(LO, CHORD), (LI, CHORD), (TP, CHORD)] {
                let r = CHORDS[c][0];
                let (d0, d1) = (a0 + half * piece as f32, a0 + half * (piece + 1) as f32);
                let (p, q) = (node(c, d0 + rot), node(c, d1 + rot));
                let s = r * (d0 - BUILD_FROM).to_radians();
                let l = length(sub(q, p));
                let (from, to) = (from.clamp(0.0, 1.0), to.clamp(0.0, 1.0));
                pen.stroke(
                    lerp(p, q, from),
                    lerp(p, q, to),
                    [s + l * from, s + l * to],
                    ink.lit(lit),
                );
            }
        }
        let [made, gone] = members(i, t);
        if made <= 0.0 || gone >= 1.0 {
            continue;
        }
        let a1 = a0 + MODULE;
        let ink = MEMBER.lit(lit);
        // The cross-section first, then the diagonals; wiped the same way.
        let section = [(made * 1.6).min(1.0), (gone * 1.6).min(1.0)];
        let diagonal = [
            ((made - 0.35) * 1.6).clamp(0.0, 1.0),
            ((gone - 0.35) * 1.6).clamp(0.0, 1.0),
        ];
        for (c0, c1) in [(LO, LI), (LI, TP), (TP, LO)] {
            pen.part(
                node(c0, a0 + rot),
                node(c1, a0 + rot),
                section[1],
                section[0],
                ink,
            );
        }
        for (c0, c1) in [(LO, LI), (LO, TP), (LI, TP)] {
            let (p, q) = if i % 2 == 0 {
                (node(c0, a0 + rot), node(c1, a1 + rot))
            } else {
                (node(c1, a0 + rot), node(c0, a1 + rot))
            };
            pen.part(p, q, diagonal[1], diagonal[0], ink);
        }
    }
    // A glint at the pen and at the eraser while they go round.
    let pen_on = window(t, BUILD[0], BUILD[0] + 0.2, BUILD[1] - 0.2, BUILD[1]);
    let eraser_on = window(
        t,
        UNBUILD[0],
        UNBUILD[0] + 0.2,
        UNBUILD[1] - 0.2,
        UNBUILD[1],
    );
    for (round, on) in [(drawn, pen_on), (wiped_round, eraser_on)] {
        for c in [LO, LI, TP] {
            pen.dot(node(c, BUILD_FROM + round + rot), 6.0, 0.8 * on, PALE);
        }
    }
    // Where a signal lands, its node flashes.
    for h in hits() {
        let dt = t - h.at;
        if h.whole || !(0.0..2.5).contains(&dt) {
            continue;
        }
        let a = h.strength * smooth(0.0, 0.08, dt) * (-dt / 0.45).exp();
        pen.dot(h.node, 6.0 + 10.0 * a, a, PALE);
    }
}

/// Which module stands over leg `k` when the ring has turned `rot`.
fn module_over(k: usize, rot: f32) -> usize {
    ((leg_angle(k) - rot - BUILD_FROM).rem_euclid(360.0) / MODULE) as usize % MODULES
}

/// When leg `k` starts down: once the module over it is drawn.
pub fn leg_drops(k: usize) -> f32 {
    built(module_over(k, 0.0) + 1) + MEMBER_SECONDS
}

/// How much of leg `k` (and its footing) is drawn, and how much is wiped,
/// with the module over it at the end.
fn leg_state(k: usize, t: f32) -> [f32; 3] {
    let from = leg_drops(k);
    let leg = ((t - from) / LEG_SECONDS[0]).clamp(0.0, 1.0);
    let footing = ((t - from - LEG_SECONDS[0]) / LEG_SECONDS[1]).clamp(0.0, 1.0);
    let [_, gone] = members(module_over(k, spun()), t);
    [leg, footing, gone]
}

/// The footing's shake when the floor's rings reach it.
fn shake(k: usize, t: f32) -> [f32; 3] {
    let dt = signal_time(4, t) - quake_reaches(k);
    if !(0.0..1.5).contains(&dt) {
        return [0.0; 3];
    }
    let a = 0.012 * smooth(0.0, 0.05, dt) * (-dt / 0.25).exp() * (70.0 * dt).sin();
    let side = polar(leg_angle(k) + 90.0, 1.0, 0.0);
    scale(side, a)
}

fn legs(t: f32, pen: &mut Pen) {
    let lit = truss_light(t);
    for k in 0..LEGS {
        let [leg, footing, gone] = leg_state(k, t);
        if leg <= 0.0 || gone >= 1.0 {
            continue;
        }
        let a = leg_angle(k);
        let top = leg_top(k);
        let foot = add(leg_foot(k), shake(k, t));
        let ink = LEG.lit(lit);
        // The roller the ring turns on, then the leg down to the floor.
        let tangent = polar(a + 90.0, 1.0, 0.0);
        let roll = (leg * 2.5).min(1.0);
        pen.curve(12, (gone * 2.0).min(1.0), roll, ink.wide(0.9), |u| {
            let (s, c) = (u * TAU).sin_cos();
            add(top, add(scale(tangent, ROLLER * s), [0.0, ROLLER * c, 0.0]))
        });
        let under = [top[0], top[1] - ROLLER, top[2]];
        pen.part(under, foot, 0.0, leg.min(1.0 - gone), ink);
        // The footing: a square round the foot, drawn once the leg lands.
        let radial = polar(a, 1.0, 0.0);
        let h = 0.5 * FOOTING;
        let corner = |x: f32, z: f32| add(foot, add(scale(radial, x * h), scale(tangent, z * h)));
        let square = [(-1.0, -1.0), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)];
        let shown = footing.min(1.0 - (gone * 2.0).min(1.0));
        for e in 0..4 {
            let (x0, z0) = square[e];
            let (x1, z1) = square[(e + 1) % 4];
            pen.part(corner(x0, z0), corner(x1, z1), 0.0, shown, ink.wide(0.9));
        }
        // It lands with a flash.
        let landed = t - leg_drops(k) - LEG_SECONDS[0];
        let flash = smooth(-0.05, 0.03, landed) * (-landed.max(0.0) / 0.35).exp();
        pen.dot(foot, 8.0, 0.7 * flash, PALE);
    }
}

fn runners(t: f32, pen: &mut Pen) {
    let on = window(
        t,
        RUNNERS_ON[0],
        RUNNERS_ON[1],
        RUNNERS_ON[2],
        RUNNERS_ON[3],
    );
    if on <= 0.0 {
        return;
    }
    let rot = spin(t);
    let run = RUNNER_SPEED * (t - RUNNERS_ON[0]);
    for j in 0..RUNNERS {
        for (c, start, way) in [
            (TP, BUILD_FROM + 120.0 * j as f32, 1.0),
            (LO, BUILD_FROM + 60.0 + 120.0 * j as f32, -1.0),
        ] {
            let head = start + way * run + rot;
            pen.dot(node(c, head), 7.0, 0.9 * on, RUNNER);
            let ink = Ink::new(1.6, 0.75 * on, RUNNER);
            pen.curve_lit(
                10,
                0.0,
                1.0,
                ink,
                |u| node(c, head - way * 20.0 * u),
                |u| 1.0 - u,
            );
        }
    }
}

fn plan(t: f32, pen: &mut Pen) {
    let gone = smooth(PLAN_OUT[0], PLAN_OUT[1], t);
    let drawn = smooth(PLAN_IN[0], PLAN_IN[1], t);
    let y = 0.002;
    pen.curve(96, gone, drawn, PLAN_INK, |u| {
        polar(BUILD_FROM + 360.0 * u, PLAN, y)
    });
    // The centre cross and one radius with its tick.
    let cross_drawn = smooth(PLAN_IN[0] + 0.3, PLAN_IN[0] + 0.9, t);
    let shown = cross_drawn * (1.0 - gone);
    let ink = PLAN_INK.dashed(0.0, 0.5);
    for d in [[0.12, 0.0], [0.0, 0.12]] {
        pen.part(
            [-d[0], y, -d[1]],
            [d[0], y, d[1]],
            0.5 - 0.5 * shown,
            0.5 + 0.5 * shown,
            ink,
        );
    }
    let radius = smooth(PLAN_IN[0] + 0.6, PLAN_IN[1], t);
    let r = polar(-44.0, PLAN, y);
    pen.part([0.0, y, 0.0], r, gone, radius, ink.lit(0.8));
    let tick = scale(add(polar(-44.0, 1.0, 0.0), polar(46.0, 1.0, 0.0)), 0.03);
    let tick_on = smooth(PLAN_IN[1] - 0.2, PLAN_IN[1], t) * (1.0 - gone);
    pen.line(sub(r, tick), add(r, tick), ink.lit(tick_on));
}

// ---------- the signals

/// Signal `k`'s light: up with its line, lingering after it, out in the
/// quiet.
pub fn signal_light(k: usize, t: f32) -> f32 {
    let from = signal_from(k);
    smooth(from, from + 0.4, t)
        * (1.0
            - (1.0 - LINGER) * smooth(from + SIGNAL_SECONDS - 0.4, from + SIGNAL_SECONDS + 0.1, t))
        * (1.0 - smooth(QUIET[0], QUIET[1], t))
}

/// A callout's light and how much of it is typed, for the signal (or line)
/// starting at `from` and standing `seconds`.
fn callout_state(from: f32, seconds: f32, t: f32) -> [f32; 2] {
    [
        window(
            t,
            from + 0.15,
            from + 0.45,
            from + seconds,
            from + seconds + 0.6,
        ),
        (t - from - 0.3) / 0.6,
    ]
}

/// A callout: a dot at `anchor`, a leader to where the word is pinned
/// (`offset` px of a 720-high frame off the anchor, right and up on the
/// screen), and the word.
fn callout(
    pen: &mut Pen,
    f: &Frame,
    anchor: [f32; 3],
    offset: [f32; 2],
    word: Word,
    [light, reveal]: [f32; 2],
) {
    if light <= 0.0 {
        return;
    }
    let z = dot(sub(anchor, f.eye), f.forward).max(0.1);
    let px = 2.0 * z * f.lens / 720.0;
    let pin = add(
        anchor,
        add(scale(f.right, offset[0] * px), scale(f.up, offset[1] * px)),
    );
    let leader = Ink::new(0.8, 0.55 * light, PALE);
    pen.dot(anchor, 5.0, 0.7 * light, PALE);
    pen.part(anchor, pin, 0.0, smooth(-0.2, 0.3, reveal), leader);
    let align = if offset[0] < 0.0 { 1.0 } else { 0.0 };
    pen.label(pin, word as usize, light, reveal, align);
}

/// A ring facing the camera.
fn disc(pen: &mut Pen, f: &Frame, centre: [f32; 3], radius: f32, ink: Ink) {
    let (right, up) = (f.right, f.up);
    pen.curve(24, 0.0, 1.0, ink, |u| {
        let (s, c) = (u * TAU).sin_cos();
        add(centre, add(scale(right, radius * c), scale(up, radius * s)))
    });
}

/// Where a signal is: what the survey rays reach for and the callouts hang
/// from.
fn sources() -> [[f32; 3]; 6] {
    [
        at(SOUND),
        cube_at(0.0),
        lamp_at(0.0),
        at(HEAT),
        at(QUAKE_AT),
        [-ROOM[0], 0.75 * ROOM[1], -ROOM[0]],
    ]
}

fn survey(t: f32, f: &Frame, pen: &mut Pen) {
    let out = 1.0 - smooth(QUIET[0], QUIET[1], t);
    for (k, s) in sources().into_iter().enumerate() {
        let from = SURVEY + SURVEY_GAP * k as f32;
        let drawn = smooth(from, from + 0.8, t);
        if drawn <= 0.0 || out <= 0.0 {
            continue;
        }
        let light = (0.5 + 0.5 * (1.0 - smooth(from + 0.8, from + 2.0, t))) * out;
        let azimuth = s[2].atan2(s[0]).to_degrees();
        let start = polar(azimuth, CHORDS[LO][0], CENTRE[1]);
        pen.part(start, s, 0.0, drawn, FAINT.lit(light));
        // A cross where it lands.
        let mark = smooth(from + 0.7, from + 0.9, t) * light;
        for axis in [f.right, f.up] {
            let d = scale(axis, 0.04);
            pen.line(sub(s, d), add(s, d), FAINT.dashed(0.0, 0.5).lit(mark));
        }
    }
}

fn sound(t: f32, f: &Frame, pen: &mut Pen) {
    let l = signal_light(0, t);
    if l <= 0.0 {
        return;
    }
    let tau = signal_time(0, t);
    let s = at(SOUND);
    disc(pen, f, s, 0.05, SIGNAL.lit(l));
    pen.dot(s, 9.0, 0.8 * l, PALE);
    let d = normalize(sub(node(TP, SOUND[0]), s));
    let side = normalize(cross([0.0, 1.0, 0.0], d));
    let lift = cross(d, side);
    let (st, ct) = 25f32.to_radians().sin_cos();
    let tilt = add(scale(side, ct), scale(lift, st));
    let life = 1.2 / ARC_SPEED;
    let last = ((tau - 0.2) / ARC_GAP).floor();
    let mut n = (last - (life / ARC_GAP).ceil()).max(0.0);
    while n <= last {
        let age = tau - 0.2 - ARC_GAP * n;
        n += 1.0;
        let rho = 0.06 + ARC_SPEED * age;
        if age < 0.0 || rho > 1.2 {
            continue;
        }
        let light = l * 0.85 * smooth(0.0, 0.1, age) * (1.0 - smooth(0.85, 1.2, rho));
        pen.curve(18, 0.0, 1.0, SIGNAL.lit(light), |u| {
            let (sp, cp) = (-38.0 + 76.0 * u).to_radians().sin_cos();
            add(s, scale(add(scale(d, cp), scale(tilt, sp)), rho))
        });
    }
    callout(
        pen,
        f,
        s,
        [18.0, 30.0],
        Word::Sounds,
        callout_state(signal_from(0), SIGNAL_SECONDS, t),
    );
}

pub fn cube_at(tau: f32) -> [f32; 3] {
    polar(
        PATH[0] + PATH[1] * tau,
        PATH[2],
        PATH[3] + 0.3 * (1.3 * tau).sin(),
    )
}

fn motion(t: f32, f: &Frame, pen: &mut Pen) {
    let l = signal_light(1, t);
    if l <= 0.0 {
        return;
    }
    let tau = signal_time(1, t);
    let c = cube_at(tau);
    // The cube, turning as it goes.
    let (sy, cy) = (1.6 * tau).sin_cos();
    let (sx, cx) = (0.9 * tau + 0.4).sin_cos();
    let h = 0.5 * CUBE;
    let corner = |i: usize| {
        let p = [
            if i & 1 == 0 { -h } else { h },
            if i & 2 == 0 { -h } else { h },
            if i & 4 == 0 { -h } else { h },
        ];
        let p = [p[0], p[1] * cx - p[2] * sx, p[1] * sx + p[2] * cx];
        let p = [p[0] * cy + p[2] * sy, p[1], -p[0] * sy + p[2] * cy];
        add(c, p)
    };
    let ink = SIGNAL.lit(l);
    for i in 0..8 {
        for bit in [1, 2, 4] {
            if i & bit == 0 {
                pen.line(corner(i), corner(i | bit), ink);
            }
        }
    }
    // Its dashed trail behind, a chevron ahead.
    let back = (tau - 70.0 / PATH[1]).max(0.0);
    let trail = FAINT.lit(1.8 * l);
    pen.curve_lit(
        24,
        0.0,
        1.0,
        trail,
        |u| cube_at(back + (tau - back) * u),
        |u| 0.25 + 0.75 * u,
    );
    let (tip, behind) = (cube_at(tau + 0.3), cube_at(tau + 0.2));
    let dir = normalize(sub(tip, behind));
    let side = normalize(cross([0.0, 1.0, 0.0], dir));
    for w in [-1.0, 1.0] {
        let wing = add(sub(tip, scale(dir, 0.06)), scale(side, 0.035 * w));
        pen.line(wing, tip, ink);
    }
    // The ring tracks it as it passes.
    let track = (-((tau - MOTION_HIT) / 0.35).powi(2)).exp();
    let azimuth = c[2].atan2(c[0]).to_degrees();
    pen.line(
        node(TP, azimuth),
        c,
        FAINT.dashed(0.0, 0.5).lit(1.6 * l * track),
    );
    callout(
        pen,
        f,
        c,
        [16.0, 26.0],
        Word::Motion,
        callout_state(signal_from(1), SIGNAL_SECONDS, t),
    );
}

/// The lamp drifts as it shines, then slower.
fn lamp_angle(tau: f32) -> f32 {
    let drift = if tau < SIGNAL_SECONDS {
        tau
    } else {
        SIGNAL_SECONDS + 0.35 * (tau - SIGNAL_SECONDS)
    };
    LAMP[0] + LAMP[1] * drift
}

pub fn lamp_at(tau: f32) -> [f32; 3] {
    polar(lamp_angle(tau), LAMP[2], LAMP[3])
}

/// Where the lamp at `lamp` throws the point `p` on the floor.
fn shade(lamp: [f32; 3], p: [f32; 3]) -> [f32; 3] {
    let k = lamp[1] / (lamp[1] - p[1]).max(1e-3);
    let s = add(lamp, scale(sub(p, lamp), k));
    [s[0], 0.003, s[2]]
}

fn light(t: f32, f: &Frame, pen: &mut Pen) {
    let l = signal_light(2, t);
    if l <= 0.0 {
        return;
    }
    let tau = signal_time(2, t);
    let lamp = lamp_at(tau);
    let ink = SIGNAL.lit(l);
    disc(pen, f, lamp, 0.06, ink);
    pen.dot(lamp, 14.0, 0.9 * l, PALE);
    for j in 0..8 {
        let (s, c) = (j as f32 / 8.0 * TAU).sin_cos();
        let d = add(scale(f.right, c), scale(f.up, s));
        pen.line(add(lamp, scale(d, 0.09)), add(lamp, scale(d, 0.15)), ink);
    }
    // Its light down onto the ring.
    let azimuth = lamp_angle(tau);
    for j in 0..5 {
        let at = 0.15 + 0.08 * j as f32;
        let drawn = smooth(at, at + 0.6, tau);
        let target = node(TP, azimuth - 40.0 + 20.0 * j as f32);
        pen.part(lamp, target, 0.0, drawn, Ink::new(0.7, 0.45 * l, PALE));
    }
    // The ring's and the legs' shadows on the floor.
    let cast = smooth(0.5, 1.3, tau);
    pen.curve(96, 0.0, cast, SHADOW.lit(l), |u| {
        shade(
            lamp,
            polar(azimuth + 180.0 + 360.0 * u, CHORDS[LO][0], CHORDS[LO][1]),
        )
    });
    for k in 0..LEGS {
        pen.part(
            leg_foot(k),
            shade(lamp, leg_top(k)),
            0.0,
            cast,
            SHADOW.lit(l),
        );
    }
    callout(
        pen,
        f,
        lamp,
        [-16.0, 22.0],
        Word::Light,
        callout_state(signal_from(2), SIGNAL_SECONDS, t),
    );
}

fn heat(t: f32, f: &Frame, pen: &mut Pen) {
    let l = signal_light(3, t);
    if l <= 0.0 {
        return;
    }
    let tau = signal_time(3, t);
    let spot = at(HEAT);
    let ring = smooth(0.0, 0.4, tau);
    for r in [0.16, 0.08] {
        pen.curve(32, 0.0, ring, SHADOW.lit(1.5 * l).dashed(0.04, 0.5), |u| {
            add(spot, polar(360.0 * u, r, 0.003))
        });
    }
    let n = normalize([spot[0], 0.0, spot[2]]);
    let side = [-n[2], 0.0, n[0]];
    let tint = [0.0, 0.7, 0.3];
    for k in 0..5 {
        let top = (HEAT_RISE * (tau - 0.1 * k as f32)).min(HEAT_TOP);
        if top <= 0.0 {
            continue;
        }
        let base = add(spot, polar(72.0 * k as f32, 0.05, 0.0));
        let phase = k as f32;
        pen.curve_lit(
            20,
            0.0,
            1.0,
            Ink::new(0.9, 0.7 * l, tint),
            |u| {
                let y = top * u;
                let sway = 0.035 * (9.0 * y - 4.0 * tau + phase).sin();
                let inward = -0.3 * (y / HEAT_TOP).powi(2);
                add(
                    base,
                    add(add(scale(side, sway), scale(n, inward)), [0.0, y, 0.0]),
                )
            },
            |u| 1.0 - 0.65 * top * u / HEAT_TOP,
        );
    }
    // Pinned low on the rising heat, clear of the ring above it.
    let low = add(spot, [-0.1 * n[0], 0.35, -0.1 * n[2]]);
    callout(
        pen,
        f,
        low,
        [18.0, 12.0],
        Word::Heat,
        callout_state(signal_from(3), SIGNAL_SECONDS, t),
    );
}

fn floor(t: f32, f: &Frame, pen: &mut Pen) {
    let l = signal_light(4, t);
    if l <= 0.0 {
        return;
    }
    let tau = signal_time(4, t);
    let e = at(QUAKE_AT);
    let ink = SIGNAL.lit(l);
    let mark = smooth(0.0, 0.3, tau);
    for d in [[0.08, 0.08], [0.08, -0.08]] {
        pen.part(
            [e[0] - d[0], 0.003, e[2] - d[1]],
            [e[0] + d[0], 0.003, e[2] + d[1]],
            0.5 - 0.5 * mark,
            0.5 + 0.5 * mark,
            ink,
        );
    }
    for j in 0..3 {
        let age = tau - QUAKE[1] - QUAKE[2] * j as f32;
        let r = QUAKE[0] * age;
        if age <= 0.0 || r > GRID_REACH[1] {
            continue;
        }
        let light = 0.75 * smooth(0.0, 0.1, age) * (1.0 - smooth(2.5, GRID_REACH[1], r));
        pen.curve(96, 0.0, 1.0, ink.lit(light), |u| {
            add([e[0], 0.003, e[2]], polar(360.0 * u, r, 0.0))
        });
    }
    // Where the first ring reaches a footing, a pulse climbs the leg.
    for k in 0..LEGS {
        let u = (tau - quake_reaches(k)) / CLIMB;
        if (0.0..1.0).contains(&u) {
            let p = lerp(leg_foot(k), leg_top(k), u);
            pen.dot(p, 8.0, 0.9 * (u * std::f32::consts::PI).sin(), PALE);
        }
    }
    // Pinned on the floor left of the epicentre, where the rings run out
    // past the ring's side (the epicentre itself is behind the ring).
    callout(
        pen,
        f,
        add(e, scale(f.right, -1.3)),
        [-14.0, 26.0],
        Word::Floor,
        callout_state(signal_from(4), SIGNAL_SECONDS, t),
    );
}

fn volume(t: f32, f: &Frame, pen: &mut Pen) {
    let l = signal_light(5, t);
    if l <= 0.0 {
        return;
    }
    let tau = signal_time(5, t);
    let [b, h] = ROOM;
    let c = |x: f32, y: f32, z: f32| [x * b, y * h, z * b];
    let ink = Ink::new(0.8, 0.55 * l, PALE).dashed(0.09, 0.55);
    let square = [(-1.0, -1.0), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)];
    let bottom = smooth(0.2, 1.0, tau);
    let sides = smooth(0.8, 1.6, tau);
    let top = smooth(1.4, 2.2, tau);
    for e in 0..4 {
        let (x0, z0) = square[e];
        let (x1, z1) = square[(e + 1) % 4];
        pen.part(c(x0, 0.0, z0), c(x1, 0.0, z1), 0.0, bottom, ink);
        pen.part(c(x0, 0.0, z0), c(x0, 1.0, z0), 0.0, sides, ink);
        pen.part(c(x0, 1.0, z0), c(x1, 1.0, z1), 0.0, top, ink);
        pen.dot(c(x0, 0.0, z0), 6.0, 0.6 * l * smooth(0.3, 0.5, tau), PALE);
        pen.dot(c(x0, 1.0, z0), 6.0, 0.6 * l * smooth(1.5, 1.7, tau), PALE);
    }
    // Dimension lines with their ticks: over the front, up the front
    // corner, along the side on the floor.
    let dims = smooth(1.8, 2.8, tau);
    let dim = Ink::new(0.7, 0.5 * l, PALE);
    let off = 0.22;
    let lines = [
        (c(-1.0, 1.0, 1.0), c(1.0, 1.0, 1.0), [0.0, off, 0.0]),
        (c(1.0, 0.0, 1.0), c(1.0, 1.0, 1.0), [off, 0.0, 0.0]),
        (c(1.0, 0.0, 1.0), c(1.0, 0.0, -1.0), [off, 0.0, 0.0]),
    ];
    for (a, z, out) in lines {
        let (a1, z1) = (add(a, out), add(z, out));
        pen.part(a1, z1, 0.5 - 0.5 * dims, 0.5 + 0.5 * dims, dim);
        let ext = scale(out, 1.3);
        let along = normalize(sub(z1, a1));
        let tick = scale(add(along, normalize(out)), 0.035);
        for p in [a, z] {
            pen.part(p, add(p, ext), 0.0, dims, dim);
            let q = add(p, out);
            pen.line(sub(q, tick), add(q, tick), dim.lit(smooth(0.8, 1.0, dims)));
        }
    }
    callout(
        pen,
        f,
        c(0.0, 1.0, 1.0),
        [14.0, 14.0],
        Word::Volume,
        callout_state(signal_from(5), SIGNAL_SECONDS, t),
    );
}

// ---------- the anchor and the frame

/// Leg `k`'s pile: how far it has gone down.
fn pile(k: usize, t: f32) -> f32 {
    let from = ANCHOR + 0.12 * k as f32;
    smooth(from, from + 1.0, t) * (1.0 - smooth(55.0 + 0.1 * k as f32, 55.9 + 0.1 * k as f32, t))
}

fn anchor(t: f32, f: &Frame, pen: &mut Pen) {
    for k in 0..LEGS {
        let down = pile(k, t);
        if down <= 0.0 {
            continue;
        }
        let foot = leg_foot(k);
        let tip = [foot[0], PILE_DEPTH, foot[2]];
        pen.part(foot, tip, 0.0, down, PILE);
        let point = smooth(0.85, 1.0, down);
        let side = polar(leg_angle(k) + 90.0, 0.03, 0.05);
        for w in [-1.0, 1.0] {
            let wing = add(tip, [side[0] * w, side[1], side[2] * w]);
            pen.line(wing, tip, PILE.dashed(0.0, 0.5).lit(point));
        }
    }
    // Every bearing glows the same: the ring holds.
    let hold = 0.8 * window(t, 35.6, 36.3, 37.2, 38.6) + 0.3 * window(t, 36.3, 37.5, 54.0, 55.4);
    for k in 0..LEGS {
        pen.dot(leg_top(k), 9.0, hold, PALE);
    }
    callout(
        pen,
        f,
        [leg_foot(1)[0], 0.5 * PILE_DEPTH, leg_foot(1)[2]],
        [18.0, 6.0],
        Word::Anchor,
        callout_state(ANCHOR + 0.3, 3.4, t),
    );
}

/// How far post `k` has risen (0..1) at `t`.
pub fn post_rise(k: usize, t: f32) -> f32 {
    let from = POSTS + 0.3 * k as f32;
    smooth(from, from + 0.8, t)
}

fn posts(t: f32, f: &Frame, pen: &mut Pen) {
    for k in 0..LEGS {
        let up = post_rise(k, t);
        let down = smooth(54.6 + 0.08 * k as f32, 55.5 + 0.08 * k as f32, t);
        let a = leg_angle(k);
        pen.part(
            polar(a, CHORDS[TP][0], CHORDS[TP][1]),
            polar(a, CHORDS[TP][0], POST_TOP),
            0.0,
            up.min(1.0 - down),
            POST,
        );
    }
    let gone = smooth(54.0, 55.6, t);
    let circle = |r: f32, y: f32| move |u: f32| polar(LEG_FROM + 360.0 * u, r, y);
    pen.curve(96, gone, smooth(45.2, 47.2, t), TIER, circle(1.0, TIERS[0]));
    pen.curve(
        48,
        gone,
        smooth(47.0, 48.4, t),
        TIER,
        circle(INNER_TIER, TIERS[0]),
    );
    for k in 0..LEGS {
        let from = 47.4 + 0.15 * k as f32;
        let a = leg_angle(k);
        pen.part(
            polar(a, INNER_TIER, TIERS[0]),
            polar(a, 1.0, TIERS[0]),
            gone,
            smooth(from, from + 0.8, t),
            TIER.lit(0.8),
        );
    }
    pen.curve(96, gone, smooth(48.6, 50.6, t), TIER, circle(1.0, TIERS[1]));
    pen.part(
        [0.0, 0.0, 0.0],
        [0.0, 2.9, 0.0],
        gone,
        smooth(48.6, 50.0, t),
        AXIS,
    );
    callout(
        pen,
        f,
        polar(LEG_FROM, 1.0, POST_TOP),
        [18.0, 18.0],
        Word::Frame,
        callout_state(45.5, 7.4, t),
    );
}

/// The whole drawing at `t`: the camera, and every stroke and callout into
/// `pen` (cleared first).
pub fn draw(t: f32, pen: &mut Pen) -> Frame {
    let f = compose(t);
    let t = f.time;
    pen.clear();
    plan(t, pen);
    truss(t, pen);
    legs(t, pen);
    runners(t, pen);
    anchor(t, &f, pen);
    posts(t, &f, pen);
    survey(t, &f, pen);
    sound(t, &f, pen);
    motion(t, &f, pen);
    light(t, &f, pen);
    heat(t, &f, pen);
    floor(t, &f, pen);
    volume(t, &f, pen);
    f
}

/// The scene's three lights in a theme's colors: the cold truss, the pale
/// signals and words, the warm frame of the next levels. The page itself
/// comes from the app (`backdrop`).
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
/// 4 Матрица): the same three lights as page 01. The site shows only the
/// dark themes; the retired light codes fall back to Тишина.
pub fn look(code: u32) -> Look {
    match Palette::from_code(code) {
        // Искра: the yellow of the theme, an ember for the frame.
        Palette::Dark => Look {
            cold: rgb(245, 221, 7),
            warm: rgb(255, 122, 40),
            pale: rgb(255, 244, 170),
        },
        // Астрал: the blue of the theme, rose-peach.
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
    use crate::generated::{LABEL_CAP, LABEL_INK};
    use crate::pen::{LABEL_FLOATS, LINE_FLOATS, MAX_LINES};

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

    fn drawn(t: f32) -> (Frame, Pen) {
        let mut pen = Pen::default();
        let f = draw(t, &mut pen);
        (f, pen)
    }

    /// The light of the strokes of one tone (cold, pale, warm).
    fn tone_light(pen: &Pen, tone: usize) -> f32 {
        pen.lines
            .chunks(LINE_FLOATS)
            .map(|l| l[9] * l[12 + tone])
            .sum()
    }

    fn inside(f: &Frame, p: [f32; 3], margin: f32) -> bool {
        project(f, p).is_some_and(|[x, y]| x.abs() < 1.0 - margin && y.abs() < 1.0 - margin)
    }

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
        }
        assert!(close(before.lens, after.lens, 1e-4));
        // Across the seam nothing is drawn: no floor, no strokes, no words.
        for t in [LOOP_SECONDS - 0.001, 0.001] {
            let (f, pen) = drawn(t);
            assert!(f.grid < 1e-3, "{t}: {}", f.grid);
            assert_eq!((pen.line_count(), pen.label_count()), (0, 0), "{t}");
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
    fn the_camera_moves_smoothly() {
        let step = 1.0 / 60.0;
        let mut previous = compose(0.0);
        let mut t = step;
        while t < LOOP_SECONDS {
            let f = compose(t);
            for i in 0..3 {
                assert!((f.eye[i] - previous.eye[i]).abs() < 0.03, "eye at {t}");
                assert!(
                    (f.forward[i] - previous.forward[i]).abs() < 0.006,
                    "forward at {t}"
                );
            }
            assert!((f.lens - previous.lens).abs() < 0.002, "lens at {t}");
            assert!((f.grid - previous.grid).abs() < 0.03, "grid at {t}");
            previous = f;
            t += step;
        }
    }

    #[test]
    fn the_truss_is_drawn_round_once_and_wiped_round_once() {
        // Nothing of it before the pen starts; all of it once the last
        // module's members are in.
        let count = |t: f32| drawn(t).1.line_count();
        assert_eq!(
            count(BUILD[0] - 0.01),
            drawn(BUILD[0] - 0.01).1.line_count()
        );
        const { assert!(BUILD[1] + MEMBER_SECONDS < SPIN_UP[0]) };
        for i in 0..MODULES {
            assert_eq!(members(i, BUILD[1] + MEMBER_SECONDS), [1.0, 0.0], "{i}");
            assert_eq!(members(i, BUILD[0]), [0.0, 0.0], "{i}");
            assert_eq!(members(i, UNBUILD[1]), [1.0, 1.0], "{i}");
        }
        assert_eq!(chords(BUILD[1]), [360.0, 0.0]);
        assert_eq!(chords(UNBUILD[1]), [360.0, 360.0]);
        // A module's members come only once the chords span it, and go
        // before the eraser takes the chords.
        for i in 0..MODULES {
            let end = MODULE * (i + 1) as f32;
            let start = MODULE * i as f32;
            every(0.01, |t| {
                let [made, gone] = members(i, t);
                let [round, wiped] = chords(t);
                if made > 0.0 {
                    assert!(round >= end - 1e-3, "{i} at {t}");
                }
                if wiped > start + 1e-3 {
                    assert!(gone >= 1.0, "{i} at {t}");
                }
            });
        }
        // The ring stands still while it is drawn and wiped.
        assert_eq!(spin(BUILD[1] + 1.0), 0.0);
        assert!(close(spin(UNBUILD[0]), spun(), 1e-4));
        assert!(close(spun(), 270.0, 1e-3), "{}", spun());
    }

    #[test]
    fn every_leg_stands_once_its_module_is_drawn() {
        for k in 0..LEGS {
            let i = module_over(k, 0.0);
            let a0 = BUILD_FROM + MODULE * i as f32;
            assert!(turn(leg_angle(k) - a0) >= 0.0 && turn(leg_angle(k) - a0) < MODULE);
            assert!(leg_drops(k) + LEG_SECONDS[0] + LEG_SECONDS[1] < SPIN_UP[0]);
            assert_eq!(leg_state(k, SPIN_UP[0]), [1.0, 1.0, 0.0]);
            assert_eq!(leg_state(k, UNBUILD[1]), [1.0, 1.0, 1.0]);
        }
    }

    #[test]
    fn the_ring_spins_smoothly_and_its_runners_run() {
        let step = 1.0 / 60.0;
        let mut previous = spin(0.0);
        every(step, |t| {
            if t > 0.0 {
                let s = spin(t);
                let speed = (s - previous) / step;
                assert!((-1e-3..=SPIN + 1e-2).contains(&speed), "{t}: {speed}");
                previous = s;
            }
        });
        assert!(close(spin(30.0) - spin(29.0), SPIN, 1e-3));
    }

    #[test]
    fn each_signal_lands_inside_its_line() {
        let h = hits();
        for (k, &range) in [0usize, 1, 2, 3, 4, 4, 4, 4, 4, 4, 5].iter().enumerate() {
            let from = signal_from(range);
            assert!(
                h[k].at > from + 0.5 && h[k].at < from + SIGNAL_SECONDS - 0.2,
                "{k}: {} in {from}",
                h[k].at
            );
        }
        // A hit lights the ring where it lands and fades within 3 s.
        for hit in &h[..4] {
            assert!(glow(hit.angle, hit.at + 0.15) > 0.5 * hit.strength);
            assert!(glow(hit.angle + 75.0, hit.at + 0.5) > 0.4 * hit.strength);
            assert!(glow(hit.angle + 180.0, hit.at + 0.15) < 0.01);
            assert!(glow(hit.angle, hit.at + 3.01) == 0.0 || hit.at + 3.01 > h[10].at);
        }
        assert!(glow(0.0, h[10].at + 0.2) > 0.7 && glow(180.0, h[10].at + 0.2) > 0.7);
        // The signals come one by one: each is lingering before the next.
        for k in 0..5 {
            assert!(signal_light(k, signal_from(k + 1) + 0.1) < LINGER + 1e-3);
        }
        every(0.05, |t| {
            if t >= QUIET[1] || t < SIGNALS {
                for k in 0..6 {
                    assert_eq!(signal_light(k, t), 0.0, "{k} at {t}");
                }
            }
        });
    }

    #[test]
    fn the_drawing_stays_in_the_frame() {
        // The truss and its legs while they stand.
        every(0.1, |t| {
            if t < BUILD[0] || t > UNBUILD[0] {
                return;
            }
            let f = compose(t);
            for a in (0..36).map(|k| 10.0 * k as f32) {
                for c in [LO, TP] {
                    assert!(inside(&f, node(c, a), 0.05), "{t}: {c} at {a}");
                }
            }
            for k in 0..LEGS {
                assert!(inside(&f, leg_foot(k), 0.05), "{t}: foot {k}");
            }
        });
        // The frame while it rises and stands: every post's tip, clear of
        // the soft top edge.
        every(0.05, |t| {
            if !(POSTS..54.0).contains(&t) {
                return;
            }
            let f = compose(t);
            for k in 0..LEGS {
                let y = CHORDS[TP][1] + (POST_TOP - CHORDS[TP][1]) * post_rise(k, t);
                assert!(
                    inside(&f, polar(leg_angle(k), CHORDS[TP][0], y), 0.12),
                    "{t}: post {k}"
                );
            }
            assert!(t < 48.6 || inside(&f, [0.0, 2.9, 0.0], 0.06), "{t}: axis");
        });
        // Every callout's pin stays clear of the frame's edges while its
        // word is up.
        every(0.05, |t| {
            let (f, pen) = drawn(t);
            for l in pen.labels.chunks(LABEL_FLOATS) {
                if l[4] < 0.2 {
                    continue;
                }
                let pin = [l[0], l[1], l[2]];
                let [x, y] = project(&f, pin).expect("in front");
                assert!(
                    x.abs() < 0.9 && y.abs() < 0.85,
                    "{t}: row {} at {x} {y}",
                    l[3]
                );
                // The word runs into the frame from its pin (the shader keeps
                // it inside the frame anyway).
                let cap = 2.0 * LABEL_SIZE[0];
                let ink = LABEL_INK[l[3] as usize];
                let wide = (ink[1] - ink[0]) / LABEL_CAP * cap / FRAME_ASPECT;
                let end = if l[6] > 0.5 { x - wide } else { x + wide };
                assert!(end.abs() < 1.02, "{t}: row {} ends at {end}", l[3]);
            }
        });
        // The signals' places, while each is up.
        for k in 0..6 {
            let from = signal_from(k);
            every(0.1, |t| {
                if !(from..from + SIGNAL_SECONDS).contains(&t) {
                    return;
                }
                let f = compose(t);
                let s = match k {
                    1 => cube_at(t - from),
                    2 => lamp_at(t - from),
                    _ => sources()[k],
                };
                assert!(inside(&f, s, 0.08), "{k} at {t}");
            });
        }
    }

    #[test]
    fn the_still_frame_is_the_whole_frame() {
        let (f, pen) = drawn(STILL);
        assert_eq!(pen.label_count(), 1);
        assert_eq!(pen.labels[3], Word::Frame as usize as f32);
        assert!(pen.labels[5] >= 1.0 && pen.labels[4] > 0.99);
        // The truss, the legs, the posts and both tiers; no signals.
        assert!(tone_light(&pen, 0) > 100.0);
        assert!(tone_light(&pen, 2) > 100.0, "{}", tone_light(&pen, 2));
        for k in 0..6 {
            assert_eq!(signal_light(k, STILL), 0.0);
        }
        assert!(close(f.grid, QUIET_GRID, 1e-3));
        for i in 0..MODULES {
            assert_eq!(members(i, STILL), [1.0, 0.0]);
        }
    }

    #[test]
    fn the_quiet_leaves_only_the_truss() {
        let (f, pen) = drawn(QUIET[1] + 0.2);
        assert!(close(f.grid, QUIET_GRID, 1e-3));
        assert_eq!(pen.label_count(), 0);
        // Pale only from the runners and the bearings.
        let pale = tone_light(&pen, 1);
        let (_, before) = drawn(QUIET[0] - 0.2);
        assert!(pale < 0.5 * tone_light(&before, 1), "{pale}");
        assert!(tone_light(&pen, 2) < 1e-3);
    }

    #[test]
    fn the_pen_never_runs_out() {
        let mut most = 0;
        every(0.05, |t| {
            let (_, pen) = drawn(t);
            most = most.max(pen.line_count());
            assert!(pen.labels.len() % LABEL_FLOATS == 0);
        });
        assert!(most < MAX_LINES / 2, "{most}");
    }

    #[test]
    fn each_word_has_its_row() {
        assert_eq!(LABEL_INK.len(), WORDS);
        assert_eq!(Word::Frame as usize, WORDS - 1);
        for ink in LABEL_INK {
            assert!(ink[1] > ink[0] + 100.0);
        }
    }

    #[test]
    fn every_dark_theme_has_its_own_look() {
        let looks = [0, 2, 3, 4].map(look);
        for i in 0..4 {
            for j in i + 1..4 {
                assert_ne!(looks[i], looks[j]);
            }
        }
        for code in [1, 5, 6] {
            assert_eq!(look(code), look(2));
        }
    }
}
