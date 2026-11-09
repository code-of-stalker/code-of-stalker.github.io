//! Page 09's loop as numbers: where he is on the rope, how he moves, what
//! the camera does, and what the rings, the sun, the fog and his shadow do.
//!
//! 0–6 s    out of the fog sea: the camera rises up the tower's side to
//!          him standing on its roof before dawn, the stars still out;
//! 6–12 s   he steps onto the rope; the first ring (the world outside)
//!          opens wide round him at chest height: a gust, a beacon, a bird,
//!          the city's hum each touch it and run round it as a pulse
//!          («Три уровня…», the first);
//! 12–18 s  close, his profile: the second ring (the world inside) round
//!          his chest rises and falls with the breath and flashes with the
//!          heart; sparks of thought by his head;
//! 18–24 s  low from the side: the third ring (the action) is a wheel that
//!          rolls along the rope with him and flashes at every step;
//! 24–30 s  high behind him: all three at once, each at its own pace; two
//!          steps strike one chord through all of them («синхронно,
//!          одномоментно … каждый по отдельности»);
//! 30–40 s  he stops; the world stops with him (the birds in mid-flap, the
//!          scarf, the rope); only his breath and the second ring move;
//!          the camera goes round him («Осознанно помни:»);
//! 40–45 s  a pale double of him rises out of his body, wavers and is drawn
//!          back into it («Абсолют просыпается не вне тела,»);
//! 45–52 s  the sun clears the clouds behind his chest; a golden thread runs
//!          along the rope to his soles and the light rises in him to the
//!          crown («…а через тело.»);
//! 52–68 s  he walks on; the fog opens on the living city under him and he
//!          looks down into it («Не уходом от жизни,»);
//! 68–88 s  his huge shadow on the fog, a glory round its head; a gust: he
//!          balances evenly while the shadow flails, grabs, hunches, looks
//!          back, takes out a phone; it lags, tears off and crumbles into
//!          code as he steps onto the far roof («а Разотождествлением…»);
//! 88–96 s  the camera dives off the roof back into the fog.
use crate::body::{build, Body, Carry, Pose, Step, Walk, PRIMITIVES};
use crate::math::{monotone, pulse, rotate, smooth, softmin, v3, window, window_integral, V3, Y};
use crate::{
    Chapter, FOG_TOP, LOOP, POLE_DROOP, POLE_HALF, ROPE_DIP, ROPE_ROUND, ROPE_SAG, SHADOW_SCALE,
    SPAN, TOWER_Z,
};
use std::f32::consts::TAU;

/// One crossing: `STEPS` steps of `STRIDE`, the first landing at
/// `FIRST_Z` (still on the near roof), one a second in two bouts.
pub const STEPS: i32 = 60;
pub const STRIDE: f32 = SPAN / STEPS as f32;
pub const FIRST_Z: f32 = 2.4;
const FIRST_BOUT: i32 = 24;
/// When each bout's first step lands.
pub const BOUTS: [f32; 2] = [6.5, 52.5];
/// A foot is in the air this long, s.
const SWING: f32 = 0.62;
/// On the rope the toes turn out this much (radians) and the swinging foot
/// bows this far round the standing one.
const TOE_OUT: f32 = 0.3;
const ARC: f32 = 0.07;

/// When step `k` lands (k counts on into the loops before and after).
pub fn landing(k: i32) -> f32 {
    let (n, j) = (k.div_euclid(STEPS), k.rem_euclid(STEPS));
    let at = if j < FIRST_BOUT {
        BOUTS[0] + j as f32
    } else {
        BOUTS[1] + (j - FIRST_BOUT) as f32
    };
    n as f32 * LOOP + at
}

/// The world stops while he stands: it slows to a halt over the first
/// second, holds, and starts again over the last.
pub const FREEZE: [f32; 4] = [30.6, 31.6, 38.4, 39.4];

/// How still the world is, 0 … 1.
pub fn frozen(t: f32) -> f32 {
    window(t, FREEZE[0], FREEZE[1], FREEZE[2], FREEZE[3])
}

/// The world's own clock: it stops while the world is still. The birds,
/// the rope, the scarf, the fog and the city run on it; his breath and
/// his heart do not.
pub fn world_time(t: f32) -> f32 {
    t - window_integral(t, FREEZE[0], FREEZE[1], FREEZE[2], FREEZE[3])
}

/// Toward the sun: low behind him and to his left (35° off the rope), so
/// his shadow falls on the open fog ahead on his right, clear of the far
/// tower.
pub fn sun_dir() -> V3 {
    v3(0.5736, 0.1441, -0.8192).normalize()
}

/// The way the wind blows (x, z): from ahead on his right, back over his
/// left shoulder, toward the sun.
pub const WIND: [f32; 2] = [0.410_365, -0.911_922];

/// The storm gust: it rises, buffets him, and dies as he reaches the far
/// roof.
pub const STORM: [f32; 4] = [69.5, 71.0, 75.0, 76.5];

/// How hard the wind blows, 0 … 1: the first gust and the storm.
pub fn gust(t: f32) -> f32 {
    let d = world_time(t) - FIRST_GUST;
    let first = if d > 0.0 {
        smooth(0.0, 0.25, d) * (-d / 1.7).exp()
    } else {
        0.0
    };
    first.max(window(t, STORM[0], STORM[1], STORM[2], STORM[3]))
}
const FIRST_GUST: f32 = 8.3;

/// The rope's span at z: where it leaves its tower and how long it is.
pub fn span_of(z: f32) -> (f32, f32) {
    let k = (z / SPAN).floor();
    let z0 = k * SPAN + TOWER_Z;
    (z0, SPAN - 2.0 * TOWER_Z)
}

/// How far his weight at `w` presses his span's rope down.
pub fn rope_load(w: f32) -> f32 {
    let (z0, len) = span_of(w);
    let u = ((w - z0) / len).clamp(0.0, 1.0);
    ROPE_DIP * 4.0 * u * (1.0 - u)
}

/// The rope's top at z off its straight line (x aside, y down), with him
/// at `w` pressing it `dip` down and swaying it `sway` aside: a sag, and
/// under him a rounded bend. Over the roofs, nothing. common.glsl's
/// `ropeOffset` is the same.
pub fn rope_offset(z: f32, w: f32, dip: f32, sway: f32) -> (f32, f32) {
    let (z0, len) = span_of(z);
    let u = (z - z0) / len;
    if !(0.0..1.0).contains(&u) {
        return (0.0, 0.0);
    }
    let mut y = -ROPE_SAG * 4.0 * u * (1.0 - u);
    let mut x = 0.0;
    if (w / SPAN).floor() == (z / SPAN).floor() {
        let uw = ((w - z0) / len).clamp(0.02, 0.98);
        let v = softmin(u / uw, (1.0 - u) / (1.0 - uw), ROPE_ROUND).max(0.0);
        y -= dip * v;
        x = sway * v;
    }
    (x, y)
}

/// The rope's sway aside at him at `t`: its slow breathing, the first gust
/// dying away, the storm's buffeting; all on the world's clock.
fn sway(t: f32) -> f32 {
    let w = world_time(t);
    let mut s = 0.01 * (TAU * w / 9.3).sin() + 0.005 * (TAU * w / 4.1 + 1.0).sin();
    let d = w - FIRST_GUST;
    if d > 0.0 {
        s += 0.075 * smooth(0.0, 0.25, d) * (-d / 1.7).exp() * (TAU * d / 1.5).sin();
    }
    let storm = window(t, STORM[0], STORM[1], STORM[2], STORM[3]);
    s + 0.11 * storm * ((TAU * w / 1.9).sin() + 0.45 * (TAU * w / 0.85 + 1.3).sin())
}

/// The sphere round him, its centre this high over the rope under him.
pub const SPHERE_Y: f32 = 0.95;
/// The first ring: its height over the rope, its radius.
pub const RING1: [f32; 2] = [1.45, 2.6];
/// The third ring, a wheel rolling on the rope: its radius.
pub const RING3_R: f32 = 0.95;
/// One heartbeat, s (66 a minute): a thump, and a softer one after.
pub const HEART: f32 = 60.0 / 66.0;

/// How plainly each ring shows over the loop: each comes in its turn, all
/// three strike together, then they keep quiet under what happens.
const RING_LIGHT: [&[(f32, f32)]; 3] = [
    &[
        (6.2, 0.0),
        (7.4, 1.0),
        (12.0, 1.0),
        (13.0, 0.35),
        (23.6, 0.35),
        (24.6, 1.0),
        (30.0, 1.0),
        (31.5, 0.22),
        (40.0, 0.22),
        (41.0, 0.08),
        (51.0, 0.08),
        (53.0, 0.4),
        (68.0, 0.4),
        (69.0, 0.25),
        (88.0, 0.25),
        (90.0, 0.0),
    ],
    &[
        (12.0, 0.0),
        (12.8, 1.0),
        (18.0, 1.0),
        (19.0, 0.35),
        (23.6, 0.35),
        (24.6, 1.0),
        (30.0, 1.0),
        (31.5, 0.7),
        (39.5, 0.7),
        (41.0, 0.12),
        (51.0, 0.12),
        (53.0, 0.25),
        (88.0, 0.25),
        (90.0, 0.0),
    ],
    &[
        (18.0, 0.0),
        (18.8, 1.0),
        (30.0, 1.0),
        (31.5, 0.2),
        (40.0, 0.2),
        (41.0, 0.08),
        (51.0, 0.08),
        (53.0, 0.3),
        (69.0, 0.3),
        (70.5, 0.85),
        (76.0, 0.85),
        (77.5, 0.3),
        (88.0, 0.3),
        (90.0, 0.0),
    ],
];

/// What touches the first ring, and from where round it (radians from
/// ahead toward his left): a beacon on the far tower, the first gust, a
/// bird, the city's hum below; then the city waking under the fog, the
/// storm.
const RING_EVENTS: [(f32, f32); 15] = [
    (7.2, 0.0),
    (8.2, -0.42),
    (9.6, -1.35),
    (10.9, 2.5),
    (25.6, 1.1),
    (27.6, -2.1),
    (54.5, 0.8),
    (57.5, -2.3),
    (60.5, 2.8),
    (63.5, -0.6),
    (66.0, 1.9),
    (70.2, -0.42),
    (72.4, -0.42),
    (74.4, -0.42),
    (81.0, 1.2),
];

/// The two steps that strike one chord through all three rings.
const CHORDS: [f32; 2] = [26.5, 28.5];

/// A camera key, relative to the point on the rope under him (x his left,
/// z ahead): where the eye is, where it looks, what it keeps sharp, the
/// lens and the aperture.
struct Key {
    at: f32,
    eye: [f32; 3],
    look: [f32; 3],
    focus: [f32; 3],
    lens: f32,
    aperture: f32,
}

const fn key(
    at: f32,
    eye: [f32; 3],
    look: [f32; 3],
    focus: [f32; 3],
    lens: f32,
    aperture: f32,
) -> Key {
    Key {
        at,
        eye,
        look,
        focus,
        lens,
        aperture,
    }
}

const HIM: [f32; 3] = [0.0, 1.1, 0.0];

const SHOTS: [Key; 30] = [
    // Out of the fog, up the tower's side to him on its roof.
    key(0.0, [9.0, -47.0, -4.0], [0.0, 1.0, 1.0], HIM, 1.3, 0.0),
    key(2.2, [8.5, -37.0, -4.0], [0.0, 1.0, 1.0], HIM, 1.3, 0.0),
    key(4.2, [7.0, -12.0, -3.5], [0.0, 1.5, 0.0], HIM, 1.35, 0.0),
    key(6.0, [4.6, 1.9, 1.5], [0.0, 1.2, 0.0], HIM, 1.5, 0.002),
    // The first ring: before him, on his left, the ring wide round him.
    key(7.2, [2.8, 1.6, 3.4], [0.0, 1.1, 0.0], HIM, 1.6, 0.003),
    key(11.5, [2.4, 1.65, 3.7], [0.0, 1.1, 0.0], HIM, 1.6, 0.003),
    // The second: close, his profile against the dawn.
    key(
        12.7,
        [-1.4, 1.5, 1.25],
        [0.0, 1.28, 0.05],
        [0.0, 1.3, 0.0],
        2.3,
        0.006,
    ),
    key(
        17.6,
        [-1.3, 1.47, 1.1],
        [0.0, 1.28, 0.05],
        [0.0, 1.3, 0.0],
        2.3,
        0.006,
    ),
    // The third: low from the side, the wheel on the rope.
    key(
        18.8,
        [-2.4, 0.5, 1.2],
        [0.0, 0.8, 0.2],
        [0.0, 0.9, 0.0],
        1.6,
        0.004,
    ),
    key(
        23.6,
        [-2.3, 0.45, 1.6],
        [0.0, 0.8, 0.2],
        [0.0, 0.9, 0.0],
        1.6,
        0.004,
    ),
    // All three: high behind him.
    key(26.4, [-3.2, 4.6, -3.0], [0.0, 0.6, 1.2], HIM, 1.45, 0.002),
    key(29.4, [-3.4, 4.1, -2.4], [0.0, 0.7, 1.0], HIM, 1.45, 0.002),
    // He stops, the world stops: round him.
    key(31.0, [-3.4, 2.6, -1.6], [0.0, 1.1, 0.3], HIM, 1.6, 0.004),
    key(34.0, [-3.8, 1.35, 0.6], [0.0, 1.15, 0.0], HIM, 1.65, 0.005),
    key(37.0, [-2.6, 1.3, 2.9], [0.0, 1.15, 0.0], HIM, 1.7, 0.005),
    key(39.8, [0.2, 1.2, 3.8], [0.0, 1.3, 0.0], HIM, 1.7, 0.005),
    // The double rises out of him.
    key(
        41.0,
        [0.5, 0.9, 3.9],
        [0.0, 1.95, 0.0],
        [0.0, 1.7, 0.0],
        1.4,
        0.004,
    ),
    key(
        44.2,
        [0.6, 0.85, 3.7],
        [0.0, 1.95, 0.0],
        [0.0, 1.7, 0.0],
        1.4,
        0.004,
    ),
    // The sun behind his chest.
    key(45.6, [-1.95, 0.5, 2.85], [0.0, 1.1, 0.0], HIM, 1.7, 0.005),
    key(50.9, [-1.85, 0.55, 2.65], [0.0, 1.1, 0.0], HIM, 1.7, 0.005),
    // Round his right side, then over his shoulder, down into the city;
    // then straight down.
    key(53.0, [-2.4, 2.0, 0.2], [0.0, -1.0, 3.5], HIM, 1.55, 0.003),
    key(55.0, [0.9, 2.4, -1.8], [-0.5, -11.0, 9.0], HIM, 1.5, 0.003),
    key(59.0, [0.8, 2.6, -1.6], [-0.5, -13.0, 9.0], HIM, 1.5, 0.003),
    key(61.2, [0.3, 6.0, -0.5], [-0.3, -40.0, 6.0], HIM, 1.3, 0.0),
    key(65.6, [0.3, 6.2, -0.4], [-0.3, -40.0, 6.0], HIM, 1.3, 0.0),
    // Behind him on his right: he on the left, his shadow on the fog on
    // the right, clear of the far roof he walks toward.
    key(69.6, [-2.0, 2.8, -6.2], [-4.9, -2.6, 13.0], HIM, 1.4, 0.0),
    key(86.0, [-2.3, 2.6, -6.6], [-4.6, -2.9, 12.6], HIM, 1.4, 0.0),
    // Off the far roof, down into the fog.
    key(
        89.6,
        [1.5, 3.5, 3.0],
        [0.5, -6.0, 12.0],
        [0.0, -3.0, 10.0],
        1.4,
        0.0,
    ),
    key(
        92.6,
        [4.0, -20.0, 9.0],
        [4.0, -60.0, 20.0],
        [0.0, -30.0, 10.0],
        1.4,
        0.0,
    ),
    key(
        LOOP,
        [5.0, -46.0, 10.0],
        [5.0, -80.0, 22.0],
        [0.0, -50.0, 10.0],
        1.4,
        0.0,
    ),
];

/// One breath: in for `INHALE` s, out for the rest of `BREATH`.
pub const BREATH: f32 = 4.0;
pub const INHALE: f32 = 1.6;

pub struct Story {
    walk: Walk,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub eye: V3,
    pub right: V3,
    pub up: V3,
    pub forward: V3,
    pub lens: f32,
    pub focus: f32,
    pub aperture: f32,
    pub body: Body,
    /// The walk's point on the rope's line, along z.
    pub track: f32,
    /// The camera is inside his head: the head is not drawn.
    pub head_hidden: f32,
    pub rim: f32,
    /// The sphere round him: centre, how much of its glass shows.
    pub sphere: [f32; 4],
    /// The first ring: its height, radius, how lit, how far turned.
    pub ring1: [f32; 4],
    /// The second ring round his chest: centre, radius; how lit, the
    /// heart's beat, the breath.
    pub ring2: [f32; 4],
    pub ring2b: [f32; 4],
    /// The third, the wheel: its centre's height, radius, how lit, how far
    /// it has rolled.
    pub ring3: [f32; 4],
    /// What last touched the first ring: where round it and how long ago,
    /// the newest and the one before.
    pub ring_events: [f32; 4],
    /// The last step: how long ago it landed, where; the chord; the
    /// sparks of thought.
    pub beat: [f32; 4],
    /// The pole: its middle and its half along it (the tips droop
    /// `POLE_DROOP` under the line), and how much of it there is.
    pub pole: [V3; 2],
    pub pole_seen: f32,
    /// The rope under him: his z, how far he presses it down, how far it
    /// sways aside, the wind.
    pub rope: [f32; 4],
    /// Toward the sun, and how much of it shows over the clouds.
    pub sun: V3,
    pub sun_out: f32,
    /// The light in him: his soles' height, how high it has risen over
    /// them, how bright it is, how far the thread along the rope has come.
    pub glow: [f32; 4],
    /// The fog: its top, how thick it is, how awake the city is under it,
    /// how gold.
    pub fog: [f32; 4],
    /// The world's clock, how still it stands, how deep the camera is in
    /// the fog, how far the dawn has come.
    pub world: [f32; 4],
    /// The double: how high it has risen out of him, how much of it shows,
    /// how it wavers; and the golden thread's light.
    pub double: [f32; 4],
    /// The flock: its centre and how much of it there is; its heading,
    /// its birds' size, its spread.
    pub birds: [f32; 4],
    pub birds2: [f32; 4],
    /// His shadow on the fog, the persona: how much it is there, how far
    /// it has crumbled, how much of its pole shows; its box on the
    /// shadow's plane (metres of him); its pole's two ends there; its cones
    /// there, two slots each (end, radius).
    pub shadow: [f32; 4],
    pub shadow_box: [f32; 4],
    pub shadow_pole: [f32; 4],
    pub shadow_cones: Vec<[f32; 4]>,
}

/// The walker's pose put on the rope: rolled `roll` about the rope's line
/// (left side up), and every point carried with the rope under it.
struct Placing {
    track: f32,
    dip: f32,
    sway: f32,
    roll: f32,
}

impl Placing {
    fn point(&self, p: V3) -> V3 {
        let q = rotate(p, v3(0.0, 0.0, 1.0), self.roll);
        let (x, y) = rope_offset(p.z, self.track, self.dip, self.sway);
        q + v3(x, y, 0.0)
    }
    fn axis(&self, a: V3) -> V3 {
        rotate(a, v3(0.0, 0.0, 1.0), self.roll)
    }
}

/// The pole's middle and its half along it, for a pose, tilted `tilt`
/// (left tip up).
fn pole_of(pelvis: V3, tilt: f32) -> (V3, V3) {
    let centre = pelvis + v3(0.0, 0.2, 0.33);
    let half = v3(tilt.cos(), tilt.sin(), 0.0) * POLE_HALF;
    (centre, half)
}

/// Where each hand holds the pole (left, right).
fn grips(centre: V3, half: V3) -> [V3; 2] {
    let s = 0.36 / POLE_HALF;
    let droop = Y * (POLE_DROOP * s * s);
    [centre + half * s - droop, centre - half * s - droop]
}

/// The heart: a thump and a softer one after, 0 … 1.
pub fn heartbeat(t: f32) -> f32 {
    let s = t.rem_euclid(HEART);
    let thump = |d: f32| {
        if d < 0.0 {
            0.0
        } else {
            (d / 0.035).min(1.0) * (-d / 0.11).exp()
        }
    };
    (thump(s) + 0.6 * thump(s - 0.28)).min(1.0)
}

/// The flocks: the first crosses close by him and stops with the world in
/// mid-flap; the second, bigger, wheels low over the fog above the city.
/// Each: when it is there (world time), where it is at `from`, how fast it
/// flies, its birds' size, its spread.
struct Flock {
    on: [f32; 4],
    from: f32,
    at: [f32; 3],
    velocity: [f32; 3],
    size: f32,
    spread: f32,
}

const FLOCKS: [Flock; 2] = [
    Flock {
        on: [24.5, 26.0, 34.0, 36.5],
        from: 25.0,
        at: [-29.5, 0.4, 6.5],
        velocity: [5.5, 0.3, 1.0],
        size: 0.32,
        spread: 1.3,
    },
    Flock {
        on: [44.5, 46.5, 58.0, 60.0],
        from: 44.0,
        at: [-22.0, -26.0, 20.0],
        velocity: [3.0, 0.2, 0.6],
        size: 0.45,
        spread: 3.6,
    },
];

impl Story {
    pub fn new(_chapter: Chapter) -> Story {
        let first = -STEPS - 2;
        let z = |k: i32| FIRST_Z + STRIDE * k as f32;
        let steps: Vec<Step> = (first..2 * STEPS)
            .map(|k| Step {
                side: k.rem_euclid(2) as usize,
                lift: landing(k) - SWING,
                land: landing(k),
                x: 0.0,
                z: z(k),
            })
            .collect();
        let start = [[0.0, z(first - 2)], [0.0, z(first - 1)]];
        let walk = Walk::new(start, steps, 6.0).on_line(TOE_OUT, ARC);
        Story { walk }
    }

    pub fn loop_seconds(&self) -> f32 {
        LOOP
    }

    /// The breath: 0 out … 1 in.
    pub fn breath(t: f32) -> f32 {
        let s = t.rem_euclid(BREATH);
        if s < INHALE {
            smooth(0.0, INHALE, s)
        } else {
            1.0 - smooth(INHALE, BREATH, s)
        }
    }

    fn placing(&self, t: f32) -> Placing {
        let track = self.walk.track(t);
        Placing {
            track,
            dip: rope_load(track),
            sway: sway(t),
            roll: -0.9 * sway(t - 0.12),
        }
    }

    /// His pose at `t`, holding the pole tilted `tilt`; the pole in the
    /// walk's own frame.
    fn pose(&self, t: f32, tilt: f32) -> (Pose, V3, V3) {
        let mut pose = self.walk.pose(t, Self::breath(t));
        // He looks down along the rope; lifts his chin in profile, while
        // he stands and in the sun; looks down into the waking city.
        let city = window(t, 55.5, 57.0, 64.5, 66.5);
        pose.nod = 0.12
            - 0.08 * window(t, 12.2, 13.0, 17.6, 18.4)
            - 0.1 * window(t, 30.5, 32.0, 52.0, 53.0)
            + 0.3 * city;
        pose.turn = -0.12 * city;
        // The scarf's tail on the wind: it streams back over his left
        // shoulder, flutters, and stops with the world.
        let w = world_time(t);
        let strength = (0.32 + 0.1 * (TAU * w / 7.3).sin() + 0.6 * gust(t)).min(1.0);
        pose.scarf = [WIND[0], WIND[1], 1.7 * w, strength];
        let (centre, half) = pole_of(pose.pelvis, tilt);
        let g = grips(centre, half);
        for (side, p) in g.iter().enumerate() {
            pose.hands[side] = [p.x, p.y, p.z, 1.0];
            pose.wrists[side] = 0.35;
        }
        (pose, centre, half)
    }

    /// The figure at `t` of the loop, on the rope.
    pub fn body(&self, t: f32) -> Body {
        let t = t.rem_euclid(LOOP);
        let place = self.placing(t);
        let (pose, ..) = self.pose(t, 2.2 * sway(t - 0.25));
        build(&pose).mapped(|p| place.point(p), |a| place.axis(a), 1.0)
    }

    /// The persona: his shadow's own figure, at first his very pose. In the
    /// storm it lets go of the pole and its old habits take it: it flails,
    /// grabs at the air, hunches, looks back, takes out a phone; then its
    /// steps fall behind his.
    fn persona(&self, t: f32) -> (Body, f32) {
        let lag = 1.1 * smooth(77.0, 84.0, t);
        let tilt = 2.2 * sway(t - lag - 0.25);
        let (mut pose, ..) = self.pose(t - lag, tilt);
        let free = smooth(70.4, 71.2, t);
        let probe = build(&pose);
        let c = probe.chest_axes;
        for side in 0..2 {
            pose.hands[side][3] *= 1.0 - free;
        }
        let flail = window(t, 70.6, 71.2, 73.4, 74.2);
        if flail > 0.0 {
            let k = TAU * 1.4 * t;
            pose.arms[0] += flail * (1.1 + 0.8 * k.sin());
            pose.arms[1] += flail * (0.9 + 0.8 * (k + 2.1).sin());
            pose.bend[0] += 0.5 * flail * (0.5 + 0.5 * (k + 0.7).sin());
            pose.bend[1] += 0.5 * flail * (0.5 + 0.5 * (k + 2.6).sin());
        }
        let grab = window(t, 73.6, 74.2, 75.2, 75.8);
        if grab > 0.0 {
            for (side, s) in [1.0f32, -1.0].iter().enumerate() {
                let p = probe.chest + c.forward * 0.45 + Y * 0.1 + c.left * (0.12 * s);
                pose.hands[side] = [p.x, p.y, p.z, grab];
            }
        }
        let hunch = window(t, 73.8, 74.6, 77.6, 78.6);
        pose.lean += 0.3 * hunch;
        pose.nod += 0.35 * hunch;
        pose.turn -= 1.1 * window(t, 75.8, 76.3, 76.9, 77.5);
        let phone = window(t, 77.4, 78.2, 82.0, 83.0);
        if phone > 0.0 {
            let p = probe.chest + c.forward * 0.3 + Y * 0.12 - c.left * 0.04;
            pose.hands[1] = [p.x, p.y, p.z, phone];
            pose.wrists[1] = -0.3 * phone;
            pose.carry = Carry::Screen(phone);
            pose.nod += 0.4 * phone;
        }
        // A twitch of the shoulders now and then.
        pose.roll +=
            0.12 * window(t, 72.0, 72.2, 72.4, 72.7) - 0.1 * window(t, 79.5, 79.7, 79.9, 80.3);
        let place = self.placing(t);
        let body = build(&pose).mapped(|p| place.point(p), |a| place.axis(a), 1.0);
        (body, 1.0 - free)
    }

    pub fn compose(&self, t: f32) -> Frame {
        let t = t.rem_euclid(LOOP);
        let w = world_time(t);
        let place = self.placing(t);
        let tilt = 2.2 * sway(t - 0.25);
        let (pose, centre, half) = self.pose(t, tilt);
        let body = build(&pose).mapped(|p| place.point(p), |a| place.axis(a), 1.0);
        let pole = [place.point(centre), place.axis(half)];
        let track = place.track;
        let (_, under) = rope_offset(track, track, place.dip, 0.0);
        let base = v3(0.0, under, track);

        let curve = |pick: fn(&Key) -> f32| -> f32 {
            let keys: Vec<(f32, f32)> = SHOTS.iter().map(|k| (k.at, pick(k))).collect();
            monotone(&keys, t)
        };
        let keyed =
            |pick: [fn(&Key) -> f32; 3]| base + v3(curve(pick[0]), curve(pick[1]), curve(pick[2]));
        let eye = keyed([|k| k.eye[0], |k| k.eye[1], |k| k.eye[2]]);
        let look = keyed([|k| k.look[0], |k| k.look[1], |k| k.look[2]]);
        let focus_at = keyed([|k| k.focus[0], |k| k.focus[1], |k| k.focus[2]]);
        let lens = curve(|k| k.lens);
        let aperture = curve(|k| k.aperture).max(0.0);
        let forward = (look - eye).normalize();
        let right = forward.cross(Y).normalize();
        let up = right.cross(forward);
        let focus = (focus_at - eye).length().max(0.3);
        let face = body.face;
        let head_centre = body.head - face.up * 0.08;
        let head_hidden = f32::from((eye - head_centre).length() < 0.3);

        // The rings.
        let c = base + v3(place.sway, SPHERE_Y, 0.0);
        let lit = RING_LIGHT.map(|keys| monotone(keys, t));
        let ring1 = [
            under + RING1[0],
            RING1[1],
            lit[0],
            (TAU * w / 40.0).rem_euclid(TAU),
        ];
        let breath = Self::breath(t);
        let chest = body.chest;
        let ring2 = [
            chest.x,
            chest.y - 0.13 + 0.17 * breath,
            chest.z,
            0.36 + 0.04 * breath,
        ];
        let ring2b = [lit[1], heartbeat(t), breath, 0.0];
        let ring3 = [
            under + RING3_R,
            RING3_R,
            lit[2],
            (-track / RING3_R).rem_euclid(TAU),
        ];
        let mut touched = RING_EVENTS
            .iter()
            .filter(|e| e.0 <= t)
            .map(|e| (e.1, w - world_time(e.0)));
        let newest = touched.next_back().unwrap_or((0.0, 99.0));
        let before = touched.next_back().unwrap_or((0.0, 99.0));
        let ring_events = [newest.0, newest.1.min(99.0), before.0, before.1.min(99.0)];
        let (step_age, step_z) = self
            .walk
            .landings(t)
            .next()
            .map_or((99.0, track), |s| ((t - s.land).min(99.0), s.z));
        let chord = CHORDS
            .iter()
            .map(|&at| pulse(t - at))
            .fold(0.0f32, f32::max);
        let sparks =
            0.8 * window(t, 12.4, 13.2, 17.2, 18.2) + 0.3 * window(t, 24.4, 25.4, 29.4, 30.4);
        let beat = [step_age, step_z, chord, sparks];
        let sphere = [
            c.x,
            c.y,
            c.z,
            0.3 * window(t, 24.5, 26.0, 29.5, 31.0) + 0.6 * chord,
        ];

        let sun = sun_dir();
        let sun_out = monotone(&[(44.5, 0.0), (46.5, 1.0)], t);
        let rise = monotone(&[(47.0, 0.0), (51.0, 1.85)], t);
        let bright = monotone(
            &[
                (46.5, 0.0),
                (47.5, 1.0),
                (56.0, 1.0),
                (60.0, 0.55),
                (86.0, 0.55),
                (90.0, 0.0),
            ],
            t,
        );
        let front = track - 12.0 + 12.0 * smooth(45.0, 47.0, t);
        let glow = [under, rise, bright, front];
        let thin = window(t, 52.0, 60.0, 80.0, 88.0);
        let fog_top = FOG_TOP - 6.0 * thin + 0.6 * (TAU * w / 48.0).sin();
        let fog = [
            fog_top,
            1.0 - 0.72 * thin,
            window(t, 51.0, 58.0, 82.0, 88.0),
            smooth(45.0, 49.0, t) * (1.0 - smooth(89.0, 93.0, t)),
        ];
        // How deep the camera is in the fog: the loop's two ends lie
        // wholly in it.
        let veil = smooth(fog_top + 2.0, fog_top - 5.0, eye.y);
        let dawn = monotone(
            &[
                (0.0, 0.0),
                (6.0, 0.1),
                (30.0, 0.45),
                (44.0, 0.7),
                (47.0, 1.0),
            ],
            t,
        );
        let world = [w, frozen(t), veil, dawn];
        let thread = smooth(44.8, 45.8, t)
            * (1.0 - 0.6 * smooth(50.0, 56.0, t))
            * (1.0 - smooth(86.0, 90.0, t));
        let double = [
            monotone(&[(40.3, 0.0), (42.6, 1.05), (43.4, 1.1), (45.0, 0.0)], t),
            window(t, 40.2, 41.2, 44.3, 45.2),
            window(t, 40.5, 41.5, 43.5, 44.8),
            thread,
        ];
        let (birds, birds2) = FLOCKS
            .iter()
            .map(|f| {
                let amount = window(w, f.on[0], f.on[1], f.on[2], f.on[3]);
                let d = w - f.from;
                let at = v3(f.at[0], f.at[1], f.at[2])
                    + v3(f.velocity[0], f.velocity[1], f.velocity[2]) * d;
                let heading = v3(f.velocity[0], 0.0, f.velocity[2]).normalize();
                (
                    [at.x, at.y, at.z, amount],
                    [heading.x, heading.z, f.size, f.spread],
                )
            })
            .max_by(|a, b| a.0[3].total_cmp(&b.0[3]))
            .expect("two flocks");

        // The shadow on the fog, seen from the sun: every point of the
        // persona on the plane across the sun's way, from his head; it
        // drifts off down the fog as it comes apart.
        let away_sun = -sun;
        let e1 = away_sun.cross(Y).normalize();
        let e2 = e1.cross(away_sun);
        let (persona, holds) = self.persona(t);
        let drift = smooth(78.0, 87.0, t);
        let shift = [0.35 * drift, -0.55 * drift * drift];
        let flat = |p: V3| {
            let d = p - head_centre;
            [d.dot(e1) + shift[0], d.dot(e2) + shift[1]]
        };
        let mut shadow_cones = Vec::with_capacity(2 * PRIMITIVES);
        let (mut lo, mut hi) = ([1e9f32; 2], [-1e9f32; 2]);
        for cone in 0..PRIMITIVES {
            for end in 0..2 {
                let [x, y, z, r] = persona.cones[3 * cone + end];
                let q = flat(v3(x, y, z));
                shadow_cones.push([q[0], q[1], r, 0.0]);
                if r > 0.002 {
                    for i in 0..2 {
                        lo[i] = lo[i].min(q[i] - r);
                        hi[i] = hi[i].max(q[i] + r);
                    }
                }
            }
        }
        let tips = [pole[0] + pole[1], pole[0] - pole[1]].map(|p| flat(p - Y * POLE_DROOP));
        let pole_shadow = holds * window(t, 46.0, 49.0, 84.0, 87.0);
        if pole_shadow > 0.0 {
            for q in tips {
                for i in 0..2 {
                    lo[i] = lo[i].min(q[i] - 0.05);
                    hi[i] = hi[i].max(q[i] + 0.05);
                }
            }
        }
        let shadow = [
            window(t, 46.0, 50.0, 85.0, 88.0),
            smooth(79.0, 87.0, t),
            pole_shadow,
            SHADOW_SCALE,
        ];
        let pad = 0.6;
        let shadow_box = [lo[0] - pad, lo[1] - pad, hi[0] + pad, hi[1] + pad];
        let shadow_pole = [tips[0][0], tips[0][1], tips[1][0], tips[1][1]];

        Frame {
            time: t,
            eye,
            right,
            up,
            forward,
            lens,
            focus,
            aperture,
            body,
            track,
            head_hidden,
            rim: 0.45 + 0.9 * sun_out,
            sphere,
            ring1,
            ring2,
            ring2b,
            ring3,
            ring_events,
            beat,
            pole,
            pole_seen: 1.0,
            rope: [track, place.dip, place.sway, gust(t)],
            sun,
            sun_out,
            glow,
            fog,
            world,
            double,
            birds,
            birds2,
            shadow,
            shadow_box,
            shadow_pole,
            shadow_cones,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::body::{FEET, TOES};
    use crate::math::mix;

    fn story() -> Story {
        Story::new(Chapter::Summary)
    }

    #[test]
    fn the_crossing_comes_round_one_span_on() {
        assert!((STRIDE * STEPS as f32 - SPAN).abs() < 1e-4);
        assert_eq!(STEPS % 2, 0, "the same foot leads again");
        assert!((landing(STEPS) - landing(0) - LOOP).abs() < 1e-4);
        assert!((landing(FIRST_BOUT - 1) - 29.5).abs() < 1e-4);
        assert!((landing(STEPS - 1) - 87.5).abs() < 1e-4);
        // He sets out from the near roof and stops on the far one.
        let z = |k: i32| FIRST_Z + STRIDE * k as f32;
        assert!(z(-1) < TOWER_Z);
        assert!(z(STEPS - 1) > SPAN - TOWER_Z && z(STEPS - 1) < SPAN + TOWER_Z);
        let s = story();
        for t in [0.3, 7.0, 30.0, 60.0] {
            let next = s.walk.pose(t + LOOP, 0.5);
            let here = s.walk.pose(t, 0.5);
            assert!((next.pelvis.z - here.pelvis.z - SPAN).abs() < 2e-3, "{t}");
            assert!((next.pelvis.y - here.pelvis.y).abs() < 2e-3, "{t}");
        }
    }

    #[test]
    fn the_world_stops_while_he_stands() {
        assert!(FREEZE[0] > landing(FIRST_BOUT - 1) + 0.5);
        assert!(FREEZE[3] < landing(FIRST_BOUT) - SWING - 0.5);
        assert!((world_time(32.0) - world_time(38.0)).abs() < 1e-3);
        assert!((world_time(20.0) - 20.0).abs() < 1e-5);
        assert!((LOOP - world_time(LOOP) - 7.8).abs() < 1e-3);
        // His breath goes on.
        assert!((Story::breath(33.0) - Story::breath(34.0)).abs() > 0.1);
    }

    #[test]
    fn the_loop_is_seamless() {
        let s = story();
        let (a, b) = (s.compose(0.0), s.compose(LOOP - 1e-3));
        // Both ends lie deep in the fog: the frame there is one even grey.
        assert!(
            a.world[2] > 0.999 && b.world[2] > 0.999,
            "{:?} {:?}",
            a.world,
            b.world
        );
        assert!(b.shadow[0] < 1e-3 && a.shadow[0] < 1e-3);
        for f in [&a, &b] {
            assert!(f.ring1[2] < 1e-3 && f.ring2b[0] < 1e-3 && f.ring3[2] < 1e-3);
            assert!(f.double[1] < 1e-3 && f.birds[3] < 1e-3);
        }
    }

    #[test]
    fn the_camera_moves_smoothly() {
        let s = story();
        let mut last = s.compose(0.0);
        let mut bad: Vec<(f32, f32, f32)> = vec![];
        let mut t = 0.02;
        while t < LOOP {
            let f = s.compose(t);
            assert!(
                f.forward.length().is_finite() && f.right.length() > 0.99,
                "{t}"
            );
            let (de, df) = (
                (f.eye - last.eye).length(),
                (f.forward - last.forward).length(),
            );
            if de > 0.6 || df > 0.08 {
                bad.push((t, de, df));
            }
            last = f;
            t += 0.02;
        }
        assert!(bad.is_empty(), "{bad:?}");
    }

    #[test]
    fn the_rope_carries_his_feet() {
        let s = story();
        for i in 0..1920 {
            let t = i as f32 * 0.05;
            let body = s.body(t);
            let w = s.walk.track(t);
            let (_, under) = rope_offset(w, w, rope_load(w), 0.0);
            // The soles stand on the rope (or the roof), never below it.
            assert!(
                body.low.y > under - 0.03,
                "{t}: {} under {under}",
                body.low.y
            );
            assert!(
                body.low.y < under + 0.03,
                "{t}: {} over {under}",
                body.low.y
            );
        }
    }

    #[test]
    fn the_rope_is_whole_and_smooth() {
        for w in [1.0, 6.0, 12.0, 20.0, 23.5] {
            let dip = rope_load(w);
            let mut last = rope_offset(0.0, w, dip, 0.05);
            let mut z = 0.0;
            while z < SPAN {
                let now = rope_offset(z, w, dip, 0.05);
                assert!((now.1 - last.1).abs() < 0.01, "{w} at {z}");
                assert!((now.0 - last.0).abs() < 0.01, "{w} at {z}");
                assert!(now.1 <= 1e-6);
                last = now;
                z += 0.01;
            }
        }
        // Over the roofs it lies on them.
        assert_eq!(rope_offset(1.0, 1.0, 0.0, 0.0), (0.0, 0.0));
    }

    #[test]
    fn he_holds_the_pole() {
        let s = story();
        for t in [2.0, 9.0, 25.0, 45.0, 60.0, 72.0, 74.0] {
            let f = s.compose(t);
            let tips = [f.pole[0] + f.pole[1], f.pole[0] - f.pole[1]];
            assert!((tips[0] - tips[1]).length() > 6.0);
            for side in 0..2 {
                let hand = crate::body::HANDS[side];
                let [x, y, z, _] = f.body.cones[3 * hand + 1];
                let g = grips(f.pole[0], f.pole[1])[side];
                assert!((v3(x, y, z) - g).length() < 0.16, "{t} {side}");
            }
        }
    }

    #[test]
    fn the_rings_come_one_by_one_then_all_at_once() {
        let s = story();
        let lit = |t: f32| {
            let f = s.compose(t);
            [f.ring1[2], f.ring2b[0], f.ring3[2]]
        };
        let [a, b, c] = lit(9.0);
        assert!(a > 0.9 && b < 1e-3 && c < 1e-3);
        let [_, b, c] = lit(15.0);
        assert!(b > 0.9 && c < 1e-3);
        assert!(lit(21.0)[2] > 0.9);
        assert!(lit(27.0).iter().all(|&l| l > 0.9));
        // The wheel rolls on the rope as he walks.
        let (x, y) = (s.compose(20.0), s.compose(21.0));
        assert!((x.ring3[3] - y.ring3[3]).abs() > 0.2);
    }

    #[test]
    fn the_double_rises_and_returns() {
        let s = story();
        assert!(s.compose(42.8).double[0] > 0.6);
        assert!(s.compose(42.8).double[1] > 0.99);
        let after = s.compose(45.5);
        assert!(after.double[1] < 1e-3 && after.double[0] < 1e-3);
    }

    #[test]
    fn the_sun_rises_behind_him_and_the_shadow_falls_ahead() {
        let sun = sun_dir();
        assert!(sun.z < -0.75 && sun.x > 0.4 && sun.y > 0.05 && sun.y < 0.18);
        let f = story().compose(60.0);
        assert!(f.sun_out > 0.99 && f.shadow[0] > 0.99);
        // The shadow's head is near the plane's centre, its feet below.
        assert!(f.shadow_box[1] < -1.5 && f.shadow_box[3] > 0.0);
        assert!(f.shadow_box[0] < 0.0 && f.shadow_box[2] > 0.0);
    }

    #[test]
    fn the_swinging_foot_passes_round_the_standing_one() {
        let s = story();
        for i in 0..1920 {
            let t = i as f32 * 0.05;
            let b = s.body(t);
            // Sample the feet and the toes along their length and keep the
            // closest pass.
            let along = |c: usize, k: f32| {
                let [ax, ay, az, ar] = b.cones[3 * c];
                let [bx, by, bz, br] = b.cones[3 * c + 1];
                (v3(ax, ay, az).lerp(v3(bx, by, bz), k), mix(ar, br, k))
            };
            let mut gap = f32::MAX;
            for (l, r) in [
                (FEET[0], FEET[1]),
                (FEET[0], TOES[1]),
                (TOES[0], FEET[1]),
                (TOES[0], TOES[1]),
            ] {
                for i in 0..=8 {
                    for j in 0..=8 {
                        let (a, ra) = along(l, i as f32 / 8.0);
                        let (c, rc) = along(r, j as f32 / 8.0);
                        gap = gap.min((a - c).length() - ra - rc);
                    }
                }
            }
            assert!(gap > -0.005, "{t}: {gap}");
        }
    }

    #[test]
    fn the_shadow_comes_and_crumbles() {
        let s = story();
        assert_eq!(s.compose(30.0).shadow[0], 0.0);
        assert!(s.compose(60.0).shadow[0] > 0.99);
        assert!(s.compose(90.0).shadow[0] < 1e-3);
        let (early, late) = (s.compose(60.0), s.compose(86.0));
        assert!(early.shadow[1] < 1e-3 && late.shadow[1] > 0.5);
        assert!(early.shadow[2] > 0.99 && late.shadow[2] < 1e-3);
    }
}
