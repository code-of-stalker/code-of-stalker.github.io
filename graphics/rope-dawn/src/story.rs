//! Page 09's loop as numbers: where he is on the rope, how he moves, what
//! the camera does, and what the sun, the fog and his shadow do.
//!
//! 0–4 s    from far, the camera flies in to him on the tower's roof;
//! 4–11 s   before him, his three rings each at its own pace: the first
//!          (wind and city) runs over the sphere's glass, the second
//!          (breath and heart) up and down his body, the third (the step
//!          on the rope) turns round him; the first dims, a gust, the rope
//!          sways and he catches it with the pole
//!          («Три уровня должны работать синхронно…»);
//! 11–18 s  his eyes: the rope ahead, the far tower, the fog below; the
//!          third ring dims, the rope sways again;
//! 18–27 s  from the side: he stops mid-rope, the pole level
//!          («Осознанно помни:»);
//! 27–40 s  before him, looking back: the sun comes out behind him, light
//!          wakes in his soles and rises to the crown, and stays
//!          («Абсолют просыпается не вне тела, а через тело.»);
//! 40–52 s  over his shoulder, looking down: he walks on, the fog thins,
//!          the city wakes under it (windows, a tram, birds); he looks down
//!          into it («Не уходом от жизни,»);
//! 52–64 s  high behind him: his huge shadow on the fog, the glory round
//!          its head; from 54 s it twitches with old habits (a glance back, a hand to
//!          the pocket, a flinch) while he walks on evenly; it lags, pales
//!          and dissolves; he reaches the far tower
//!          («а Разотождествлением с обусловленностью…»);
//! 64–72 s  the camera draws back to where it began, the sun goes behind
//!          the clouds, the fog closes.
use crate::body::{build, Body, Step, Walk, JACKET, PRIMITIVES};
use crate::math::{mix, monotone, rotate, smooth, softmin, v3, window, V3, Y};
use crate::{
    Chapter, FOG_TOP, LOOP, POLE_DROOP, POLE_HALF, ROPE_DIP, ROPE_ROUND, ROPE_SAG, SHADOW_SCALE,
    SPAN, TOWER_Z,
};
use std::f32::consts::{PI, TAU};

/// One crossing: `STEPS` steps of `STRIDE`, the first landing at
/// `FIRST_Z`, one a second; he stands still on the rope over `HALT`.
pub const STEPS: i32 = 54;
pub const STRIDE: f32 = SPAN / STEPS as f32;
pub const FIRST_Z: f32 = 1.3;
pub const HALT: [f32; 2] = [21.5, 40.5];
const FIRST_BOUT: i32 = 22;
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
        0.5 + j as f32
    } else {
        HALT[1] + (j - FIRST_BOUT) as f32
    };
    n as f32 * LOOP + at
}

/// Toward the sun: low behind him, a little to his left.
pub fn sun_dir() -> V3 {
    v3(0.3, 0.15, -1.0).normalize()
}

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

/// The gusts: when each comes and how far it sways the rope at him.
const GUSTS: [(f32, f32); 2] = [(8.3, 0.075), (14.3, 0.06)];

/// The rope's sway aside at him at `t`: a slow breath of the rope (whole
/// cycles a loop) and the gusts dying away.
fn sway(t: f32) -> f32 {
    let mut s = 0.01 * (TAU * 5.0 * t / LOOP).sin() + 0.005 * (TAU * 13.0 * t / LOOP + 1.0).sin();
    for (when, a) in GUSTS {
        let d = t - when;
        if d > 0.0 {
            s += a * smooth(0.0, 0.25, d) * (-d / 1.7).exp() * (TAU * d / 1.5).sin();
        }
    }
    s
}

/// The sphere round him (the three rings), its centre over the rope at
/// `SPHERE_Y`, its radius. The first ring runs over its glass from the top
/// to the bottom and back in `RING_FIRST`, the second up and down his
/// body in `RING_SECOND`, the third, a meridian, turns once in
/// `RING_THIRD`: three paces, every one whole times a loop.
pub const SPHERE_R: f32 = 1.45;
pub const SPHERE_Y: f32 = 0.95;
pub const RING_FIRST: f32 = 9.0;
pub const RING_SECOND: f32 = 6.0;
pub const RING_THIRD: f32 = 12.0;
const SECOND_RING: [f32; 2] = [0.04, 1.8];
/// How plainly the rings show, from inside the sphere and from well out.
const SPHERE_SEEN: [f32; 2] = [0.35, 1.0];

/// A camera key, relative to the point on the rope under him (x his left,
/// z ahead): where the eye is, where it looks, what it keeps sharp, the
/// lens, the aperture and how much it is his own eyes.
struct Key {
    at: f32,
    eye: [f32; 3],
    look: [f32; 3],
    focus: [f32; 3],
    lens: f32,
    aperture: f32,
    own: f32,
}

const fn key(
    at: f32,
    eye: [f32; 3],
    look: [f32; 3],
    focus: [f32; 3],
    lens: f32,
    aperture: f32,
    own: f32,
) -> Key {
    Key {
        at,
        eye,
        look,
        focus,
        lens,
        aperture,
        own,
    }
}

const fn at(t: f32, k: Key) -> Key {
    Key { at: t, ..k }
}

/// From far beside the tower, its roof and the rope and the fog in view.
const WIDE: Key = key(
    0.0,
    [-15.0, 4.6, -11.0],
    [0.0, -2.0, 7.0],
    [0.0, 1.0, 0.0],
    1.25,
    0.0,
    0.0,
);
const MINE: Key = key(
    11.0,
    [-0.3, 1.7, 0.3],
    [0.0, 1.0, 8.0],
    [0.0, 0.0, 6.0],
    1.6,
    0.0025,
    1.0,
);
const SIDE: Key = key(
    20.8,
    [-5.4, 1.0, 0.7],
    [0.0, 0.85, 0.7],
    [0.0, 1.0, 0.3],
    1.6,
    0.005,
    0.0,
);
const FACING: Key = key(
    27.0,
    [-0.95, 1.0, 3.6],
    [0.0, 1.22, 0.0],
    [0.0, 1.1, 0.25],
    1.7,
    0.007,
    0.0,
);
const DOWN: Key = key(
    40.5,
    [0.75, 2.3, -1.7],
    [-0.5, -8.0, 9.0],
    [0.0, 1.0, 0.0],
    1.6,
    0.003,
    0.0,
);
const HIGH: Key = key(
    53.0,
    [0.5, 3.6, -5.2],
    [-6.0, -4.0, 14.0],
    [0.0, 1.0, 0.0],
    1.3,
    0.0,
    0.0,
);

const SHOTS: [Key; 15] = [
    WIDE,
    key(
        4.0,
        [-2.6, 1.85, 2.5],
        [0.0, 1.1, 0.2],
        [0.0, 1.1, 0.0],
        1.7,
        0.006,
        0.0,
    ),
    key(
        9.8,
        [-2.25, 1.45, 2.7],
        [0.0, 1.05, 0.1],
        [0.0, 1.1, 0.0],
        1.7,
        0.006,
        0.0,
    ),
    MINE,
    at(17.2, MINE),
    key(
        18.6,
        [-1.6, 1.5, 0.3],
        [0.0, 1.1, 0.8],
        [0.0, 1.1, 0.3],
        1.6,
        0.004,
        0.0,
    ),
    SIDE,
    key(
        24.6,
        [-4.6, 1.05, 0.9],
        [0.0, 0.95, 0.6],
        [0.0, 1.0, 0.3],
        1.65,
        0.005,
        0.0,
    ),
    FACING,
    key(
        38.6,
        [-0.8, 1.05, 3.1],
        [0.0, 1.2, 0.0],
        [0.0, 1.1, 0.25],
        1.75,
        0.007,
        0.0,
    ),
    DOWN,
    key(
        50.5,
        [0.6, 2.1, -1.9],
        [-0.5, -5.0, 9.0],
        [0.0, 1.0, 0.0],
        1.6,
        0.003,
        0.0,
    ),
    HIGH,
    key(
        63.0,
        [0.2, 4.4, -6.6],
        [-6.5, -4.5, 14.0],
        [0.0, 1.0, 0.0],
        1.3,
        0.0,
        0.0,
    ),
    at(LOOP, WIDE),
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
    /// The sphere round him: centre, radius.
    pub sphere: [f32; 4],
    /// Its rings: the first's height, the second's, the third's turn
    /// (radians), how plainly they show; and how lit each one is.
    pub rings: [f32; 4],
    pub ring_light: [f32; 4],
    /// The pole: its middle and its half along it (the tips droop
    /// `POLE_DROOP` under the line), and how much of it there is.
    pub pole: [V3; 2],
    pub pole_seen: f32,
    /// The rope under him: his z, how far he presses it down, how far it
    /// sways aside.
    pub rope: [f32; 4],
    /// Toward the sun, and how much of it shows over the clouds.
    pub sun: V3,
    pub sun_out: f32,
    /// The light in him: his soles' height, how high it has risen over
    /// them, how bright it is.
    pub glow: [f32; 4],
    /// The fog: its top, how thick it is, how awake the city is under it,
    /// the birds.
    pub fog: [f32; 4],
    /// His shadow on the fog, the persona: how much it is there, how far
    /// it has come apart, how much of its pole shows; its box on the
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
    fn pose(&self, t: f32, tilt: f32) -> (crate::body::Pose, V3, V3) {
        let mut pose = self.walk.pose(t, Self::breath(t));
        pose.coat = JACKET;
        // He looks down along the rope from his eyes, and down into the
        // waking city.
        pose.nod = 0.12
            + 0.16 * window(t, 10.4, 11.4, 17.4, 18.6)
            + 0.3 * window(t, 42.8, 44.6, 47.6, 49.6);
        pose.turn = -0.12 * window(t, 43.0, 44.6, 47.6, 49.6);
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

    /// The persona: his shadow's own figure, at first his very pose; from
    /// 54 s it lets go of the pole and its old habits take it (a glance
    /// back, a hand to the pocket, a hunch, a flinch), and its steps fall
    /// behind his.
    fn persona(&self, t: f32) -> (Body, f32) {
        let lag = 1.2 * smooth(55.0, 63.0, t);
        let tilt = 2.2 * sway(t - 0.25);
        let (mut pose, ..) = self.pose(t - lag, tilt);
        let free = smooth(54.0, 55.2, t);
        let probe = build(&pose);
        let c = probe.chest_axes;
        // Let go: the hands drop to the sides and swing with the walk.
        for side in 0..2 {
            pose.hands[side][3] = 1.0 - free;
        }
        pose.turn -= window(t, 54.4, 55.1, 56.2, 57.0);
        pose.nod += 0.45 * window(t, 58.2, 58.8, 60.2, 61.2);
        let pocket = window(t, 56.4, 57.2, 58.8, 59.7);
        if pocket > 0.0 {
            let p = probe.chest + c.forward * 0.28 - c.left * 0.06 + Y * 0.12;
            pose.hands[1] = [p.x, p.y, p.z, pocket];
            pose.wrists[1] = -0.2 * pocket;
        }
        let flinch = window(t, 60.4, 60.75, 61.4, 62.3);
        if flinch > 0.0 {
            let p = probe.head + c.left * 0.25 + c.forward * 0.15 + Y * 0.05;
            pose.hands[0] = [p.x, p.y, p.z, flinch];
        }
        // A twitch of the shoulders now and then.
        pose.roll +=
            0.12 * window(t, 57.4, 57.6, 57.8, 58.1) - 0.1 * window(t, 62.4, 62.6, 62.8, 63.2);
        let place = self.placing(t);
        let body = build(&pose).mapped(|p| place.point(p), |a| place.axis(a), 1.0);
        (body, 1.0 - free)
    }

    pub fn compose(&self, t: f32) -> Frame {
        let t = t.rem_euclid(LOOP);
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
        let eye_k = keyed([|k| k.eye[0], |k| k.eye[1], |k| k.eye[2]]);
        let look_k = keyed([|k| k.look[0], |k| k.look[1], |k| k.look[2]]);
        let focus_k = keyed([|k| k.focus[0], |k| k.focus[1], |k| k.focus[2]]);
        let own_eyes = curve(|k| k.own).clamp(0.0, 1.0);
        let lens = curve(|k| k.lens);
        let aperture = curve(|k| k.aperture).max(0.0);
        let face = body.face;
        let eye_own = body.mouth + face.up * 0.085 + face.forward * 0.01;
        let eye = eye_k.lerp(eye_own, own_eyes);
        let dir_k = (look_k - eye_k).normalize();
        let forward = dir_k.lerp(face.forward, own_eyes).normalize();
        let right = forward.cross(Y).normalize();
        let up = right.cross(forward);
        let focus_far = (focus_k - eye).length().max(0.3);
        let focus = mix(focus_far, 7.0, own_eyes);
        let head_centre = body.head - face.up * 0.08;
        let head_hidden = f32::from((eye - head_centre).length() < 0.3);

        // The sphere and its rings, over the rope under him.
        let c = base + v3(place.sway, SPHERE_Y, 0.0);
        let phase = |period: f32| 0.5 - 0.5 * (TAU * t / period).cos();
        let first = c.y + SPHERE_R * mix(0.35, PI - 0.35, phase(RING_FIRST)).cos();
        let second = under + mix(SECOND_RING[0], SECOND_RING[1], phase(RING_SECOND));
        let third = (TAU * t / RING_THIRD).rem_euclid(TAU);
        let away = (eye - c).length();
        let seen = mix(
            SPHERE_SEEN[0],
            SPHERE_SEEN[1],
            smooth(SPHERE_R + 0.1, SPHERE_R + 0.7, away),
        );
        let dim = |a: f32| 1.0 - 0.85 * window(t, a, a + 0.6, a + 1.8, a + 2.8);
        let ring_light = [dim(7.8), 1.0, dim(13.8), 0.0];

        let sun = sun_dir();
        let sun_out = monotone(
            &[
                (0.0, 0.0),
                (26.6, 0.0),
                (29.2, 1.0),
                (63.6, 1.0),
                (68.4, 0.0),
            ],
            t,
        );
        let rise = monotone(&[(28.8, 0.0), (36.0, 1.85)], t);
        let glow = [under, rise, window(t, 28.6, 29.4, 63.8, 69.8), 0.0];
        let thin = window(t, 40.0, 51.0, 63.0, 71.5);
        let fog = [
            FOG_TOP - 6.0 * thin,
            1.0 - 0.72 * thin,
            window(t, 39.0, 50.0, 64.0, 71.8),
            window(t, 42.0, 45.0, 60.0, 63.5),
        ];

        // The shadow on the fog, seen from the sun: every point of the
        // persona on the plane across the sun's way, from his head; it
        // drifts off down the fog as it comes apart.
        let away_sun = -sun;
        let e1 = away_sun.cross(Y).normalize();
        let e2 = e1.cross(away_sun);
        let (persona, holds) = self.persona(t);
        let drift = smooth(57.0, 67.0, t);
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
        let pole_shadow = holds * window(t, 28.0, 31.0, 64.0, 66.0);
        if pole_shadow > 0.0 {
            for q in tips {
                for i in 0..2 {
                    lo[i] = lo[i].min(q[i] - 0.05);
                    hi[i] = hi[i].max(q[i] + 0.05);
                }
            }
        }
        let shadow_seen = window(t, 28.5, 32.0, 60.0, 67.0);
        let shadow = [
            shadow_seen,
            smooth(58.0, 67.0, t),
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
            sphere: [c.x, c.y, c.z, SPHERE_R],
            rings: [first, second, third, seen],
            ring_light,
            pole,
            pole_seen: 1.0,
            rope: [track, place.dip, place.sway, 0.0],
            sun,
            sun_out,
            glow,
            fog,
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

    fn story() -> Story {
        Story::new(Chapter::Summary)
    }

    #[test]
    fn the_crossing_comes_round_one_span_on() {
        assert!((STRIDE * STEPS as f32 - SPAN).abs() < 1e-4);
        assert_eq!(STEPS % 2, 0, "the same foot leads again");
        assert!((landing(STEPS) - landing(0) - LOOP).abs() < 1e-4);
        assert!((landing(FIRST_BOUT - 1) - HALT[0]).abs() < 1e-4);
        assert!((landing(FIRST_BOUT) - HALT[1]).abs() < 1e-4);
        let s = story();
        for t in [0.3, 7.0, 30.0] {
            let next = s.walk.pose(t + LOOP, 0.5);
            let here = s.walk.pose(t, 0.5);
            assert!((next.pelvis.z - here.pelvis.z - SPAN).abs() < 2e-3, "{t}");
            assert!((next.pelvis.y - here.pelvis.y).abs() < 2e-3, "{t}");
        }
    }

    #[test]
    fn the_loop_is_seamless() {
        let s = story();
        let (a, b) = (s.compose(0.0), s.compose(LOOP - 1e-3));
        let shifted = b.eye - v3(0.0, 0.0, SPAN);
        assert!((shifted - a.eye).length() < 0.02, "{shifted:?} {:?}", a.eye);
        assert!((b.forward - a.forward).length() < 0.01);
        assert!((b.sun_out - a.sun_out).abs() < 1e-3);
        assert!((b.fog[0] - a.fog[0]).abs() < 0.05 && (b.fog[1] - a.fog[1]).abs() < 0.01);
        assert!(b.shadow[0] < 1e-3 && a.shadow[0] < 1e-3);
        assert!((b.glow[2] - a.glow[2]).abs() < 1e-3);
    }

    #[test]
    fn the_rope_carries_his_feet() {
        let s = story();
        for i in 0..1440 {
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
        for t in [2.0, 9.0, 25.0, 45.0, 60.0] {
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
    fn the_sun_rises_behind_him_and_the_shadow_falls_ahead() {
        let sun = sun_dir();
        assert!(sun.z < -0.9 && sun.y > 0.05 && sun.y < 0.18);
        let f = story().compose(45.0);
        assert!(f.sun_out > 0.99 && f.shadow[0] > 0.99);
        // The shadow's head is near the plane's centre, its feet below.
        assert!(f.shadow_box[1] < -1.5 && f.shadow_box[3] > 0.0);
        assert!(f.shadow_box[0] < 0.0 && f.shadow_box[2] > 0.0);
    }

    #[test]
    fn the_swinging_foot_passes_round_the_standing_one() {
        let s = story();
        for i in 0..1440 {
            let t = i as f32 * 0.05;
            let b = s.body(t);
            // Cones 11 and 12 are the feet, 13 and 14 the toes: sample each
            // along its length and keep the closest pass.
            let along = |c: usize, k: f32| {
                let [ax, ay, az, ar] = b.cones[3 * c];
                let [bx, by, bz, br] = b.cones[3 * c + 1];
                (v3(ax, ay, az).lerp(v3(bx, by, bz), k), mix(ar, br, k))
            };
            let mut gap = f32::MAX;
            for (l, r) in [(11, 12), (11, 14), (13, 12), (13, 14)] {
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
    fn the_shadow_comes_and_dissolves() {
        let s = story();
        assert_eq!(s.compose(10.0).shadow[0], 0.0);
        assert!(s.compose(45.0).shadow[0] > 0.99);
        assert!(s.compose(69.0).shadow[0] < 1e-3);
        let (early, late) = (s.compose(50.0), s.compose(64.0));
        assert!(early.shadow[1] < 1e-3 && late.shadow[1] > 0.5);
        assert!(early.shadow[2] > 0.99 && late.shadow[2] < 1e-3);
    }
}
