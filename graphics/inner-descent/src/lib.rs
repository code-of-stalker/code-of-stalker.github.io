//! «Используй свой голос», page 08 of Step 6 «Внутреннее кольцо»,
//! direction «Спуск». A person in a space suit hangs high over the night
//! side of the Earth. Every phrase he says aloud pulls him lower: the word
//! leaves his mouth, then falls as a warm bead onto the thread of his voice,
//! which runs from his feet down toward the ground. An altimeter in the
//! corner counts down. At «Я Есть» he stands on the soil of his own field at
//! dawn, the words lie round him on the ground, and both rings turn as one.
//! «Я Здесь»: 410 km, a storm flashes below, a satellite drifts by.
//! «Я Слышу внешнее»: 110 km, among the aurora's curtains; meteors burn
//! below; the cold first ring scans the space round him.
//! «Я Ощущаю внутреннее»: 35 km, the camera at his face: the word on the
//! visor glass, warm signs of his inside (a heart, a breath, warmth in his
//! hands); the warm second ring scans his body.
//! Then he falls through the clouds (the cut between the orbit and the land
//! hides in them), his helmet still on.
//! «Я Замечаю»: 900 m over the night land; the first ring's brackets mark
//! small things: a train, a car, the village, a flash inside a cloud.
//! «Я Осознаю два кольца»: a few metres over his field, first light; both
//! rings plainly visible, the thread almost taken in.
//! «Я Есть»: his feet on the soil; the beads lie round him as words.
//! Every value here is a pure function of loop time; `browser.rs` uploads
//! it and four passes draw it (the orbit or the land with him in it, the
//! bright parts for the bloom, the composite with everything drawn over).
//! Unit: metres. He hangs at the origin, feet at y = 0 (`body::Pose`); in
//! the land the ground is at y = -altitude, in orbit the Earth is far below.

use crate::body::{add, cross, dot, length, mix, norm, scale, sub, Pose, V, WAIST};
use std::f32::consts::TAU;
use std::sync::OnceLock;
use watcher_scene_palette::Palette;

pub mod body;
mod generated;
pub use generated::{
    ATLAS, GLYPHS, GLYPH_ADV, GLYPH_ROW, GLYPH_X0, LABEL_BAND, LABEL_BASE, LABEL_CAP, LABEL_INK,
};

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerDescent;

pub const LOOP_SECONDS: f32 = 60.0;
/// The frame every key is composed for is 3:2; a canvas of another shape
/// shows more round it.
pub const FRAME_ASPECT: f32 = 1.5;
/// Reduced motion holds «Я Есть»: he stands on the soil, the words round
/// him, the rings turning as one.
pub const STILL: f32 = 53.0;

// ---------- the descent

/// The heights he hangs at (m), one per phrase; he is pulled from one to
/// the next during `PULLS`.
pub const LEVELS: [f32; 6] = [410_000.0, 110_000.0, 35_000.0, 900.0, 3.5, 0.0];
/// When each pull runs (s); smooth in the logarithm of the height, so the
/// fall looks alike from 400 km and from 4 m.
pub const PULLS: [[f32; 2]; 5] = [
    [5.0, 9.5],
    [14.5, 18.5],
    [24.0, 31.0],
    [35.0, 38.5],
    [43.5, 46.5],
];
/// When he says each phrase (s): «Я Здесь», «Я Слышу», «Я Ощущаю», «Я
/// Замечаю», «Я Осознаю», «Я Есть».
pub const SAID: [f32; 6] = [2.0, 11.0, 20.0, 31.8, 39.5, 48.0];
/// A word hangs at his mouth this long after he says it, then falls onto
/// the thread by `LANDS` (s after `SAID`). The pull follows the bead.
pub const HANGS: f32 = 1.8;
pub const LANDS: f32 = 3.0;
/// The cloud deck (m). He falls through it; the orbit becomes the land at
/// its middle (`SWITCH`), hidden in the cloud.
pub const CLOUD_DECK: f32 = 2450.0;
/// How thick the cloud is, in the logarithm of the height.
pub const FOG_WIDTH: f32 = 0.5;
/// The moment he is in the middle of the deck (s).
pub const SWITCH: f32 = 28.593;
/// The scene rises from the page and sinks back into it at the loop's seam.
pub const FADE: [f32; 4] = [0.0, 1.5, 58.3, 60.0];
/// The Earth's radius (km).
pub const EARTH: f32 = 6371.0;

/// The beads on the thread, newest first: how far below his feet (m), how
/// bright, how big their word is (px of an 800 px frame).
pub const DEPTHS: [f32; 5] = [1.5, 4.5, 8.0, 12.0, 17.0];
pub const LIGHTS: [f32; 5] = [1.0, 0.6, 0.35, 0.0, 0.0];
pub const SIZES: [f32; 5] = [30.0, 24.0, 22.0, 22.0, 22.0];
/// The thread's length in orbit (m): it melts away long before the Earth.
pub const THREAD: f32 = 4000.0;

/// At «Я Есть» the five words lie round him on the ground: at these angles
/// (rad, from +x toward +z), this far out (m), letters this high (m).
pub const GROUND_ANGLES: [f32; 5] = [5.95, 5.2, 4.5, 3.48, 2.78];
pub const GROUND_RADIUS: f32 = 2.7;
pub const GROUND_SIZE: f32 = 0.32;
pub const GROUND_LIGHT: f32 = 0.85;
/// When they come out of the soil at his feet (s) and how long they take.
pub const GROUND_FROM: f32 = 46.4;
pub const GROUND_STEP: f32 = 0.3;
pub const GROUND_SPREAD: f32 = 1.8;

/// His mouth and the middle of his helmet, in his own frame.
pub const MOUTH: V = [0.0, 1.668, 0.09];
pub const HELM: V = [0.0, 1.735, 0.012];

// ---------- the land under the clouds (m, the ground plane x, z)

pub const VILLAGE: [f32; 2] = [-1500.0, -700.0];
pub const CITY: [f32; 2] = [-4800.0, -5600.0];
/// The railway: a point on it and its way; the train's length and speed.
pub const RAIL_AT: [f32; 2] = [0.0, -520.0];
pub const RAIL_WAY: [f32; 2] = [1.0, 0.6];
pub const TRAIN_LENGTH: f32 = 330.0;
pub const TRAIN_SPEED: f32 = 22.0;
/// The head of the train at «Я Замечаю» (m along the railway, at 33 s).
pub const TRAIN_AT: f32 = -770.0;
/// The cars from the village toward the city (m/s), one every `CAR_STEP` m.
pub const CAR_SPEED: f32 = 20.0;
pub const CAR_STEP: f32 = 240.0;
/// The storm inside the cloud deck over the land (m).
pub const CLOUD_STORM: [f32; 2] = [-6000.0, -5200.0];

/// Flashes of the storms (s): under him at 410 km, at 35 km, in the cloud
/// deck over the land.
pub const FLASHES: [[f32; 6]; 3] = [
    [2.6, 2.75, 6.2, 6.35, 6.5, 10.4],
    [22.3, 22.45, 24.9, 25.1, 26.4, 27.0],
    [31.2, 31.35, 33.5, 34.85, 35.0, 36.3],
];
/// Where the storms are, as in the storyboard: a point of its 1200 x 800
/// frame (px), the camera's time and his height (km) then.
pub const STORMS: [[f32; 4]; 2] = [[350.0, 700.0, 9.0, 410.0], [260.0, 640.0, 21.5, 35.0]];

/// Meteors at 110 km: when, from (azimuth, elevation) toward (azimuth,
/// elevation), how bright.
pub const METEORS: [[f32; 6]; 3] = [
    [13.6, -2.62, -0.13, -2.55, -0.17, 0.9],
    [15.3, -1.82, -0.2, -1.9, -0.25, 0.7],
    [16.9, -2.95, -0.24, -2.9, -0.27, 0.5],
];
pub const METEOR_SECONDS: f32 = 0.8;

/// What the first ring marks at «Я Замечаю»: the train, a car, the
/// village, the flash in the cloud; when each bracket closes in (s), its
/// size (px of an 800 px frame).
pub const NOTICES: [[f32; 2]; 4] = [[32.4, 22.0], [33.2, 14.0], [34.0, 30.0], [34.8, 26.0]];
pub const NOTICES_GO: [f32; 2] = [37.0, 38.2];

// ---------- the rings

/// The first ring: its plane's normal and radius over time, round his
/// waist; at «Я Есть» it settles onto the ground round his feet.
pub const OUTER: [(f32, [f32; 4]); 12] = [
    (0.0, [0.5, 1.0, 0.6, 2.3]),
    (9.0, [0.5, 1.0, 0.6, 2.3]),
    (13.0, [0.3, 1.0, -0.2, 2.3]),
    (18.0, [0.3, 1.0, -0.2, 2.3]),
    (21.5, [0.45, 1.0, 0.5, 1.15]),
    (26.0, [0.45, 1.0, 0.5, 1.15]),
    (SWITCH, [0.3, 1.0, -0.2, 2.3]),
    (37.0, [0.3, 1.0, -0.2, 2.3]),
    (40.0, [0.35, 1.0, 0.4, 2.3]),
    (46.0, [0.35, 1.0, 0.4, 2.3]),
    (50.0, [0.0, 1.0, 0.0, 2.5]),
    (60.0, [0.0, 1.0, 0.0, 2.5]),
];
pub const SETTLE: [f32; 2] = [46.0, 50.0];
pub const FLOOR: V = [0.0, 0.02, 0.0];
/// The first ring never rests: it rides the sphere round his waist (the
/// keyed radius). Its plane leans `RIDE_TILT` off the keyed one and that
/// lean goes round `RIDE_TURNS` times a loop, while the ring slides up and
/// down the sphere between `RIDE_LATITUDE` (rad) every `RIDE_SECONDS`. On
/// the soil it lies level and slides from the ground at his feet up to
/// `SOIL_TOP` and back, on the ground at `STILL`.
pub const RIDE_TILT: f32 = 0.35;
pub const RIDE_TURNS: f32 = 3.0;
pub const RIDE_LATITUDE: [f32; 2] = [-0.4, 0.4];
pub const RIDE_SECONDS: f32 = 12.0;
pub const SOIL_TOP: f32 = -0.12;
/// Both runners go round `TURNS` times a loop; the second ring runs
/// `EXTRA` turns more until it falls into step with the first at
/// «Я Есть» (`IN_STEP`).
pub const TURNS: f32 = 6.0;
pub const EXTRA: f32 = 2.0;
pub const IN_STEP: [f32; 2] = [47.0, 50.0];
/// The second ring scans his body from his shins to his crown and back.
pub const SCAN: [f32; 2] = [0.35, 1.75];
pub const SCAN_SECONDS: f32 = 10.0;

// ---------- the camera, in his frame

/// In orbit, keyed by time: eye, target, field of view (degrees, across
/// the frame's height).
pub const ORBIT_CAMERA: [(f32, [f32; 7]); 7] = [
    (0.0, [3.3, 0.8, 4.0, -0.9, -0.6, -1.6, 56.0]),
    (9.0, [3.0, 0.9, 3.6, -0.9, -0.6, -1.6, 56.0]),
    (13.0, [2.7, 1.3, 3.3, -1.2, 0.3, -2.0, 60.0]),
    (18.0, [2.5, 1.4, 3.0, -1.2, 0.4, -2.0, 60.0]),
    (21.5, [1.15, 1.9, 1.35, -0.45, 1.2, -0.95, 50.0]),
    (26.0, [1.05, 1.85, 1.25, -0.45, 1.2, -0.95, 50.0]),
    (SWITCH, [1.8, 2.2, 2.0, -0.6, 0.9, -1.2, 54.0]),
];
/// Over the land, from the middle of the cloud deck to the loop's end.
pub const LAND_CAMERA: [(f32, [f32; 7]); 7] = [
    (SWITCH, [3.0, 3.0, 2.6, -1.2, 0.0, -2.2, 62.0]),
    (33.0, [3.4, 2.4, 3.0, -1.6, 0.2, -2.6, 64.0]),
    (37.0, [4.4, 1.4, 4.6, -0.8, -0.4, -1.3, 57.0]),
    (40.0, [5.2, 0.3, 5.9, 0.0, -0.8, 0.0, 50.0]),
    (46.0, [4.4, 0.9, 5.0, -0.15, 0.0, -0.2, 52.0]),
    (50.0, [3.9, 2.95, 4.45, -0.3, 0.7, -0.35, 54.0]),
    (60.0, [4.1, 3.05, 4.7, -0.3, 0.7, -0.35, 55.0]),
];
/// How he hangs: yaw and pitch (rad), eased from key to key.
pub const POSE: [(f32, [f32; 2]); 11] = [
    (0.0, [0.9, 0.25]),
    (9.0, [0.9, 0.25]),
    (13.0, [0.9, 0.2]),
    (18.0, [0.9, 0.2]),
    (21.5, [0.75, 0.12]),
    (26.0, [0.75, 0.12]),
    (SWITCH, [0.9, 0.1]),
    (37.0, [0.9, 0.1]),
    (40.0, [0.9, 0.05]),
    (46.5, [0.9, 0.0]),
    (60.0, [0.9, 0.0]),
];
/// He sways while he floats, and stops once he stands.
pub const SWAY: [f32; 2] = [0.05, 0.025];
pub const STANDS: [f32; 2] = [43.0, 46.5];

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

/// `table` read at a fractional index, clamped to its ends.
fn along(table: &[f32], i: f32) -> f32 {
    let last = table.len() - 1;
    let i = i.clamp(0.0, last as f32);
    let k = (i.floor() as usize).min(last - 1);
    let f = i - k as f32;
    table[k] + (table[k + 1] - table[k]) * f
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

/// A smooth open curve through keys (time, values): Catmull–Rom tangents
/// inside, one-sided ones at the ends, cubic Hermite pieces; held beyond
/// the ends.
fn spline<const N: usize>(keys: &[(f32, [f32; N])], t: f32) -> [f32; N] {
    let n = keys.len();
    let t = t.clamp(keys[0].0, keys[n - 1].0);
    let i = (0..n - 1).rev().find(|&j| keys[j].0 <= t).unwrap_or(0);
    let (t1, t2) = (keys[i].0, keys[i + 1].0);
    let slope = |j: usize, c: usize| {
        let (a, b) = (j.saturating_sub(1), (j + 1).min(n - 1));
        (keys[b].1[c] - keys[a].1[c]) / (keys[b].0 - keys[a].0)
    };
    let h = t2 - t1;
    let s = (t - t1) / h;
    let (s2, s3) = (s * s, s * s * s);
    std::array::from_fn(|c| {
        (2.0 * s3 - 3.0 * s2 + 1.0) * keys[i].1[c]
            + (s3 - 2.0 * s2 + s) * h * slope(i, c)
            + (3.0 * s2 - 2.0 * s3) * keys[i + 1].1[c]
            + (s3 - s2) * h * slope(i + 1, c)
    })
}

/// Keys joined by smoothsteps: never past a key, still at every key.
fn eased<const N: usize>(keys: &[(f32, [f32; N])], t: f32) -> [f32; N] {
    let n = keys.len();
    let t = t.clamp(keys[0].0, keys[n - 1].0);
    let i = (0..n - 1).rev().find(|&j| keys[j].0 <= t).unwrap_or(0);
    let s = smooth(keys[i].0, keys[i + 1].0, t);
    std::array::from_fn(|c| keys[i].1[c] + (keys[i + 1].1[c] - keys[i].1[c]) * s)
}

fn wrap(t: f32) -> f32 {
    if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    }
}

/// A way by azimuth (from +x toward +z) and elevation.
pub fn way(az: f32, el: f32) -> V {
    [az.cos() * el.cos(), el.sin(), az.sin() * el.cos()]
}

// ---------- the height

/// How far down the phrases have pulled him: 0 at 410 km … 5 on the soil.
pub fn level(t: f32) -> f32 {
    let t = wrap(t);
    PULLS.iter().map(|&[a, b]| smooth(a, b, t)).sum()
}

/// His height over the ground (m).
pub fn altitude(t: f32) -> f32 {
    let t = wrap(t);
    let ln = PULLS
        .iter()
        .enumerate()
        .fold(LEVELS[0].ln_1p(), |ln, (k, &[a, b])| {
            ln + (LEVELS[k + 1].ln_1p() - LEVELS[k].ln_1p()) * smooth(a, b, t)
        });
    ln.exp_m1().max(0.0)
}

/// How deep in the cloud deck he is: 1 in its middle.
pub fn fog(t: f32) -> f32 {
    let h = altitude(t);
    if h <= 1.0 {
        return 0.0;
    }
    let x = (h / CLOUD_DECK).ln() / FOG_WIDTH;
    (-x * x).exp()
}

/// Whether the land is drawn (below the middle of the cloud deck).
pub fn over_land(t: f32) -> bool {
    wrap(t) >= SWITCH
}

/// The altimeter: the number it shows and whether in metres (else km).
pub fn reading(t: f32) -> (u32, bool) {
    let h = altitude(t);
    if h >= 1000.0 {
        ((h / 1000.0 + 1e-3).floor() as u32, false)
    } else {
        ((h + 1e-3).floor() as u32, true)
    }
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
    /// How far a point is along the view.
    pub fn depth(&self, p: V) -> f32 {
        dot(sub(p, self.eye), self.forward)
    }
    /// Where a point lands in px of an 800 px high frame, y up, 0 at the
    /// frame's middle (the storyboard's 1200 x 800 px, recentred).
    pub fn screen(&self, p: V) -> Option<[f32; 2]> {
        self.project(p).map(|[x, y]| [400.0 * x, 400.0 * y])
    }
    /// How many of those px a metre is at that point's depth.
    pub fn per_metre(&self, p: V) -> f32 {
        400.0 / (self.lens * self.depth(p).max(0.02))
    }
    /// The way through a point of the storyboard's 1200 x 800 frame (px).
    fn way_through(&self, x: f32, y: f32) -> V {
        let (fx, fy) = ((x - 600.0) / 400.0, (400.0 - y) / 400.0);
        norm(add(
            self.forward,
            scale(add(scale(self.right, fx), scale(self.up, fy)), self.lens),
        ))
    }
}

pub fn in_frame([x, y]: [f32; 2]) -> bool {
    x.abs() < FRAME_ASPECT && y.abs() < 1.0
}

pub fn camera(t: f32) -> Camera {
    let t = wrap(t);
    let keys: &[(f32, [f32; 7])] = if over_land(t) {
        &LAND_CAMERA
    } else {
        &ORBIT_CAMERA
    };
    let [ex, ey, ez, tx, ty, tz, fov] = spline(keys, t);
    Camera::toward([ex, ey, ez], [tx, ty, tz], fov)
}

/// How he hangs.
pub fn pose(t: f32) -> Pose {
    let t = wrap(t);
    let [yaw, pitch] = eased(&POSE, t);
    let float = 1.0 - smooth(STANDS[0], STANDS[1], t);
    let w = TAU * t / LOOP_SECONDS;
    Pose {
        yaw: yaw + SWAY[0] * float * (2.0 * w).sin(),
        pitch: pitch + SWAY[1] * float * (3.0 * w + 1.0).sin(),
    }
}

// ---------- the rings

/// A ring: its centre and radius, its plane's normal, its first axis (the
/// angle 0), its runner's angle, its light.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Ring {
    pub centre: V,
    pub radius: f32,
    pub normal: V,
    pub axis: V,
    pub turn: f32,
    pub light: f32,
}

impl Ring {
    fn new(centre: V, radius: f32, normal: V, turn: f32, light: f32) -> Ring {
        let normal = norm(normal);
        // The first axis toward +x, so both rings count their angle from
        // the same side.
        let x = [1.0, 0.0, 0.0];
        let axis = norm(sub(x, scale(normal, dot(x, normal))));
        Ring {
            centre,
            radius,
            normal,
            axis,
            turn,
            light,
        }
    }
    pub fn at(&self, a: f32) -> V {
        let second = cross(self.normal, self.axis);
        add(
            self.centre,
            add(
                scale(self.axis, self.radius * a.cos()),
                scale(second, self.radius * a.sin()),
            ),
        )
    }
}

/// The first ring: cold, scanning the space round him, riding the sphere
/// round his waist; at «Я Есть» it lies level and rides up from the ground
/// round his feet.
pub fn outer(t: f32) -> Ring {
    let t = wrap(t);
    let [nx, ny, nz, r] = eased(&OUTER, t);
    let settle = smooth(SETTLE[0], SETTLE[1], t);
    // The lean of its plane goes round the keyed normal.
    let keyed = norm([nx, ny, nz]);
    let side = norm(cross(keyed, [0.0, 0.0, 1.0]));
    let other = cross(keyed, side);
    let (lean, round) = (
        RIDE_TILT * (1.0 - settle),
        TAU * RIDE_TURNS * t / LOOP_SECONDS,
    );
    let normal = add(
        scale(keyed, lean.cos()),
        scale(
            add(scale(side, round.cos()), scale(other, round.sin())),
            lean.sin(),
        ),
    );
    // Up and down the sphere; on the soil from his feet up and back.
    let [lo, hi] = RIDE_LATITUDE;
    let wave = (TAU * (t - STILL) / RIDE_SECONDS).cos();
    let ride = 0.5 * (lo + hi) + 0.5 * (hi - lo) * wave;
    let ground = -((WAIST - FLOOR[1]) / r).clamp(-1.0, 1.0).asin();
    let soil = ground + (SOIL_TOP - ground) * (0.5 - 0.5 * wave);
    let latitude = ride + (soil - ride) * settle;
    let centre = add([0.0, WAIST, 0.0], scale(normal, r * latitude.sin()));
    let turn = TAU * TURNS * t / LOOP_SECONDS + 0.6;
    Ring::new(centre, r * latitude.cos(), normal, turn, 0.95)
}

/// Where the second ring scans him (m up his body).
pub fn scan(t: f32) -> f32 {
    let m = 0.5 * (SCAN[0] + SCAN[1]);
    let a = 0.5 * (SCAN[1] - SCAN[0]);
    m - a * (TAU * wrap(t) / SCAN_SECONDS).cos()
}

/// The second ring: warm, round his body at the height it scans, as wide as
/// he is there.
pub fn inner(t: f32, pose: &Pose) -> Ring {
    let t = wrap(t);
    let y = scan(t);
    let r = 0.32 + 0.12 * smooth(0.8, 1.05, y);
    let r = r + (0.3 - r) * smooth(1.5, 1.65, y);
    let centre = pose.to_world([0.0, y, 0.0]);
    let normal = add(pose.way([0.0, 1.0, 0.0]), [0.03, 0.0, 0.02]);
    // Its own extra turns run out over IN_STEP: in step afterwards.
    let own = t - ramp(IN_STEP[0], IN_STEP[1], t);
    let extra = EXTRA / (IN_STEP[0] + 0.5 * (IN_STEP[1] - IN_STEP[0]));
    let turn = TAU * TURNS * t / LOOP_SECONDS + 1.1 + TAU * extra * own;
    Ring::new(centre, r, normal, turn, 1.0)
}

// ---------- his voice

/// A bead on the thread: how far below his feet (m), how bright, which
/// word (atlas row), how big its word is (px of an 800 px frame).
pub type Bead = [f32; 4];

/// The beads the phrases «Я Здесь» … «Я Осознаю» left on the thread.
pub fn beads(t: f32) -> [Bead; 5] {
    let t = wrap(t);
    let lift = altitude(t);
    let land = over_land(t);
    std::array::from_fn(|i| {
        let lands = SAID[i] + LANDS;
        // How many newer beads pushed it down: it makes way while the newer
        // word falls, so the two never sit in one place.
        let rank: f32 = (i + 1..5)
            .map(|j| smooth(SAID[j] + HANGS, SAID[j] + LANDS, t))
            .sum();
        let wanted = along(&DEPTHS, rank);
        let mut light = along(&LIGHTS, rank) * smooth(lands - 0.05, lands + 0.15, t);
        let mut depth = wanted;
        if land {
            // Over the land the thread ends on the ground: a bead that would
            // hang lower goes into the soil.
            light *= smooth(-0.2, 0.3, lift - wanted + 0.3);
            depth = depth.min(lift);
        }
        [depth, light, i as f32, along(&SIZES, rank)]
    })
}

/// The word at his mouth: its row, its light, how far it has fallen onto
/// the thread (0..1), and the sound arcs' light.
pub fn voice(t: f32) -> [f32; 4] {
    let t = wrap(t);
    let land = if over_land(t) { 1.0 } else { 0.0 };
    for (i, &said) in SAID.iter().enumerate().rev() {
        if t < said - 0.1 {
            continue;
        }
        if i == 5 {
            // «Я Есть» stays: it falls nowhere.
            let light = window(t, [said, said + 0.4, 57.5, 58.3]);
            let arcs = window(t, [said - 0.1, said + 0.15, said + 2.5, said + 3.5]);
            return [i as f32, light, 0.0, arcs * land];
        }
        if t > said + LANDS + 0.2 {
            break;
        }
        // It goes out exactly as its bead lights up (`beads`), in one place.
        let light = smooth(said - 0.05, said + 0.35, t)
            * (1.0 - smooth(said + LANDS - 0.05, said + LANDS + 0.15, t));
        let fall = smooth(said + HANGS, said + LANDS, t);
        let arcs = window(t, [said - 0.1, said + 0.15, said + 1.3, said + 1.9]);
        return [i as f32, light, fall, arcs * land];
    }
    [0.0; 4]
}

/// How warm his face glows: brighter while he speaks and at his close-up.
pub fn face(t: f32) -> f32 {
    let t = wrap(t);
    let speaking = SAID
        .iter()
        .map(|&s| window(t, [s - 0.2, s + 0.2, s + 1.6, s + 2.6]))
        .fold(0.0, f32::max);
    (0.35 + 0.65 * speaking).max(0.9 * window(t, [20.0, 21.0, 26.5, 28.0]))
}

/// The five words round his feet at «Я Есть»: how far out (m) and how
/// bright each is.
pub fn ground_words(t: f32) -> [[f32; 2]; 5] {
    let t = wrap(t);
    std::array::from_fn(|i| {
        let from = GROUND_FROM + GROUND_STEP * i as f32;
        let out = smooth(from, from + GROUND_SPREAD, t);
        let light = GROUND_LIGHT
            * smooth(from, from + 0.6 * GROUND_SPREAD, t)
            * (1.0 - smooth(FADE[2], FADE[3], t));
        [0.6 + (GROUND_RADIUS - 0.6) * out, light]
    })
}

// ---------- the world round him

fn flash(t: f32, times: &[f32]) -> f32 {
    times
        .iter()
        .map(|&k| (-((t - k) / 0.07).powi(2)).exp())
        .sum::<f32>()
        .min(1.0)
}

/// The Earth's surface point under the way `rd` from `alt` km, in the
/// stretched map the orbit shader paints (`earth` in orbit.frag).
fn earth_map(rd: V, alt: f32) -> [f32; 2] {
    let oc = [0.0, EARTH + alt, 0.0];
    let b = dot(oc, rd);
    let h = b * b - (dot(oc, oc) - EARTH * EARTH);
    if h < 0.0 {
        return [0.0; 2];
    }
    let ps = add(oc, scale(rd, -b - h.sqrt()));
    let k = (410.0 / alt).powf(0.6);
    [ps[0] * k, ps[2] * k]
}

/// The way from `alt` km to the point `q` of that map.
fn earth_way(q: [f32; 2], alt: f32) -> V {
    let k = (alt / 410.0).powf(0.6);
    let (x, z) = (q[0] * k, q[1] * k);
    let y = (EARTH * EARTH - x * x - z * z).max(0.0).sqrt();
    norm([x, y - EARTH - alt, z])
}

fn storms() -> &'static [[f32; 2]; 2] {
    static AT: OnceLock<[[f32; 2]; 2]> = OnceLock::new();
    AT.get_or_init(|| {
        STORMS.map(|[x, y, time, alt]| earth_map(camera(time).way_through(x, y), alt))
    })
}

/// The storm: where (the orbit's map, or the land's metres), its flash.
pub fn storm(t: f32) -> ([f32; 2], f32) {
    let t = wrap(t);
    if over_land(t) {
        (CLOUD_STORM, flash(t, &FLASHES[2]))
    } else if t < 16.0 {
        (storms()[0], flash(t, &FLASHES[0]))
    } else {
        (storms()[1], flash(t, &FLASHES[1]))
    }
}

/// The way to the storm seen from orbit at `t`, for the lightning bolt.
pub fn storm_way(t: f32) -> V {
    let (q, _) = storm(t);
    earth_way(q, altitude(t) / 1000.0)
}

/// The head of the train (m along the railway).
pub fn train(t: f32) -> f32 {
    TRAIN_AT + TRAIN_SPEED * (wrap(t) - 33.0)
}

/// Where the car the first ring marks is (m, ground plane).
pub fn car(t: f32) -> [f32; 2] {
    let w = norm([CITY[0] - VILLAGE[0], CITY[1] - VILLAGE[1], 0.0]);
    let a = CAR_SPEED * wrap(t) - 0.5 * CAR_STEP;
    [VILLAGE[0] + w[0] * a, VILLAGE[1] + w[1] * a]
}

/// The brackets of «Я Замечаю»: each a point (m, his frame) and a size
/// (px of an 800 px frame, 0 when not shown) and its light.
pub fn notices(t: f32) -> [[f32; 5]; 4] {
    let t = wrap(t);
    let ground = -altitude(t);
    let w = norm([RAIL_WAY[0], RAIL_WAY[1], 0.0]);
    let middle = train(t) - 0.5 * TRAIN_LENGTH;
    let rail = [RAIL_AT[0] + w[0] * middle, RAIL_AT[1] + w[1] * middle];
    let c = car(t);
    let at: [V; 4] = [
        [rail[0], ground, rail[1]],
        [c[0], ground, c[1]],
        [VILLAGE[0], ground, VILLAGE[1]],
        [CLOUD_STORM[0], ground + CLOUD_DECK, CLOUD_STORM[1]],
    ];
    std::array::from_fn(|i| {
        let [from, size] = NOTICES[i];
        let light = if over_land(t) {
            window(t, [from, from + 0.25, NOTICES_GO[0], NOTICES_GO[1]])
        } else {
            0.0
        };
        let closing = 1.0 + 0.6 * (1.0 - smooth(from, from + 0.35, t));
        let [x, y, z] = at[i];
        [x, y, z, size * closing, 0.9 * light]
    })
}

/// The meteors at 110 km: the way to each head and tail, and its light.
pub fn meteors(t: f32) -> [(V, V, f32); 3] {
    let t = wrap(t);
    METEORS.map(|[from, a0, e0, a1, e1, light]| {
        let u = (t - from) / METEOR_SECONDS;
        if !(0.0..=1.0).contains(&u) {
            return ([0.0, -1.0, 0.0], [0.0, -1.0, 0.0], 0.0);
        }
        let (d0, d1) = (way(a0, e0), way(a1, e1));
        let head = norm(mix(d0, d1, u));
        let tail = norm(mix(d0, d1, (u - 0.55).max(0.0)));
        (head, tail, light * (std::f32::consts::PI * u).sin().sqrt())
    })
}

/// The satellite drifting by at 410 km: its way and light.
pub fn satellite(t: f32) -> (V, f32) {
    let t = wrap(t);
    let s = t - 4.5;
    (
        norm([-0.2 + 0.012 * s, 0.08 + 0.003 * s, -1.0]),
        window(t, [0.0, 0.8, 10.5, 12.5]),
    )
}

/// The light of the land: sun (dawn), moon, cloud cover; and the aurora's
/// curtains in orbit.
pub fn sky(t: f32) -> [f32; 4] {
    let t = wrap(t);
    if !over_land(t) {
        return [0.0, 1.0, 0.0, window(t, [8.5, 11.0, 18.5, 21.0])];
    }
    let sun = 0.6 * smooth(36.0, 41.0, t) + 0.4 * smooth(41.0, 47.0, t);
    let moon = 0.25 + 0.45 * smooth(35.0, 41.0, t) - 0.1 * smooth(42.0, 48.0, t);
    let cover = 1.0 - 0.55 * smooth(35.0, 41.0, t) - 0.1 * smooth(42.0, 48.0, t);
    [sun, moon, cover, 0.0]
}

/// His inside: how brightly its signs glow; the word on his visor.
pub fn inside(t: f32) -> [f32; 2] {
    let t = wrap(t);
    [
        0.95 * window(t, [20.6, 22.0, 26.6, 28.2]) + 0.5 * window(t, [39.6, 41.5, 58.3, 60.0]),
        window(t, [21.0, 21.8, 26.0, 27.2]),
    ]
}

// ---------- the frame

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    pub pose: Pose,
    pub land: bool,
    /// His height (m).
    pub altitude: f32,
    pub level: f32,
    pub fog: f32,
    /// 1 while the scene is up, 0 at the loop's seam.
    pub fade: f32,
    pub face: f32,
    /// Sun, moon, cloud cover, aurora.
    pub sky: [f32; 4],
    /// Where the storm is, its flash, the train's head.
    pub storm: [f32; 4],
    /// The way to the storm from orbit, and the bolt's light.
    pub bolt: [f32; 4],
    pub outer: Ring,
    pub inner: Ring,
    /// The top of the thread (between his feet) and its length (m).
    pub thread: [f32; 4],
    /// Its light.
    pub thread_light: f32,
    pub beads: [Bead; 5],
    pub voice: [f32; 4],
    pub ground_words: [[f32; 2]; 5],
    pub notices: [[f32; 5]; 4],
    pub meteors: [(V, V, f32); 3],
    pub satellite: (V, f32),
    /// Inside, the visor's word.
    pub inside: [f32; 2],
    /// The altimeter: number, metres (1) or km (0), the marker (0..5), light.
    pub altimeter: [f32; 4],
}

pub fn compose(t: f32) -> Frame {
    let t = wrap(t);
    let pose = pose(t);
    let land = over_land(t);
    let h = altitude(t);
    let (at, flashing) = storm(t);
    let bolt = if land { 0.0 } else { flashing };
    let top = pose.to_world([0.0, 0.02, 0.0]);
    let (length, thread_light) = if land {
        ((h + 0.02).max(0.0), 0.9 * smooth(0.05, 0.6, h))
    } else {
        (THREAD, 0.9)
    };
    let (number, metres) = reading(t);
    let level = level(t);
    let [bx, by, bz] = storm_way(t);
    Frame {
        time: t,
        camera: camera(t),
        pose,
        land,
        altitude: h,
        level,
        fog: fog(t),
        fade: window(t, FADE),
        face: face(t),
        sky: sky(t),
        storm: [at[0], at[1], flashing, train(t)],
        bolt: [bx, by, bz, 0.85 * bolt],
        outer: outer(t),
        inner: inner(t, &pose),
        thread: [top[0], top[1], top[2], length],
        thread_light,
        beads: beads(t),
        voice: voice(t),
        ground_words: ground_words(t),
        notices: notices(t),
        meteors: meteors(t),
        satellite: satellite(t),
        inside: inside(t),
        altimeter: [number as f32, if metres { 1.0 } else { 0.0 }, level, 0.95],
    }
}

// ---------- the marks drawn over the world

/// How many labels, glow dots and words lying in the scene the composite
/// draws (`Marks`).
pub const LABELS: usize = 7;
pub const DOTS: usize = 22;
pub const TEXTS: usize = 6;
/// His heart beats and his breath goes round this many times a loop.
pub const HEARTBEATS: f32 = 66.0;
pub const BREATHS: f32 = 32.0;
/// The colours a mark is inked in.
pub const WARM_INK: f32 = 0.0;
pub const COLD_INK: f32 = 1.0;
pub const PALE_INK: f32 = 2.0;
/// The middle of the letters inside an atlas row (px).
const ROW_MIDDLE: f32 = 64.0;
/// A word lying in the scene that he hides is flagged by this added to its
/// atlas row.
pub const MASKED_ROW: f32 = 8.0;

/// What the composite draws over the world, for one frame. Places on the
/// screen are px of an 800 px high frame, y up, 0 at the frame's middle
/// (`Camera::screen`), as the storyboard drew them.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Marks {
    /// Words from the atlas: the left of the text, its baseline, its size
    /// (px), its row; its light, whether it glows. 0..4 the beads' words, 5
    /// the word at his mouth, 6 «тепло» in his thought.
    pub labels: [[f32; 8]; LABELS],
    /// Glow dots: x, y, radius (px), light; ink, whether he hides it.
    pub dots: [[f32; 8]; DOTS],
    /// Words lying in the scene: their middle (m), their letters' size (m);
    /// the way along the line, the row (+ `MASKED_ROW` when he hides it);
    /// the way up the letters, the light.
    pub texts: [[f32; 12]; TEXTS],
    /// The rings in the camera's frame (`ring_marks`): centre, first and
    /// second half-axes; their turn, light, ticks, ink.
    pub rings: [[f32; 16]; 2],
    /// Boxes round the rings on the screen: min x, min y, max x, max y.
    pub boxes: [[f32; 4]; 2],
    /// The thread on the screen (`thread_marks`).
    pub thread: [f32; 12],
    /// The brackets: x, y, size, light.
    pub notices: [[f32; 4]; 4],
    /// The lightning bolt: x, y, light.
    pub bolt: [f32; 4],
    /// The meteors: tail x, y, head x, y; and their lights.
    pub meteors: [[f32; 4]; 3],
    pub meteor_light: [f32; 4],
    /// The satellite: x, y, light.
    pub satellite: [f32; 4],
    /// His inside: head (x, y, px a metre, the thought's light), chest (x,
    /// y, light, the heartbeat 0..1), belly (x, y, light, the breath 0..1),
    /// hand (x, y, light).
    pub signs: [[f32; 4]; 4],
    /// The sound of his voice: mouth x, y, size, light; the way (rad, y up),
    /// the arcs' half-spread.
    pub arcs: [f32; 8],
    /// The altimeter: number, metres (1) or km (0), the marker, light.
    pub altimeter: [f32; 4],
}

fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

/// A label whose letters' middle is at `middle`.
fn label_at(left: f32, middle: f32, size: f32, row: f32, light: f32, glow: bool) -> [f32; 8] {
    let per = size / 64.0;
    let baseline = middle - (LABEL_BASE - ROW_MIDDLE) * per;
    [
        left,
        baseline,
        size,
        row,
        light,
        f32::from(u8::from(glow)),
        0.0,
        0.0,
    ]
}

/// The left of a label centred at x (every row starts at `GLYPH_X0`).
fn centred(x: f32, size: f32, row: usize) -> f32 {
    let [a, b] = LABEL_INK[row.min(LABEL_INK.len() - 1)];
    x - (0.5 * (a + b) - GLYPH_X0) * size / 64.0
}

fn dot_at([x, y]: [f32; 2], radius: f32, light: f32, ink: f32, masked: bool) -> [f32; 8] {
    if light <= 0.0 || radius <= 0.0 {
        return [0.0; 8];
    }
    [
        x,
        y,
        radius,
        light,
        ink,
        f32::from(u8::from(masked)),
        0.0,
        0.0,
    ]
}

fn level_way(v: V) -> V {
    norm([v[0], 0.0, v[2]])
}

/// Turns the ways of a word lying in the scene so its line runs to the
/// right of the screen and its letters stand up on it.
fn facing(c: &Camera, p: V, along: V, up: V) -> (V, V) {
    let at = c.screen(p).unwrap_or([0.0; 2]);
    let to = |w: V| c.screen(add(p, scale(w, 0.01))).unwrap_or(at);
    let along = if to(along)[0] < at[0] {
        scale(along, -1.0)
    } else {
        along
    };
    let up = if to(up)[1] < at[1] {
        scale(up, -1.0)
    } else {
        up
    };
    (along, up)
}

/// A ring in the camera's frame: a point v of it lands at v.xy / v.z px.
/// Centre (x, y, depth, height), the first and the second half-axis (the
/// same, with their height), and its turn, light, ticks, ink. With a box
/// round it on the screen, everything when part of it is behind the camera.
fn ring_marks(c: &Camera, r: &Ring, ticked: bool, ink: f32) -> ([f32; 16], [f32; 4]) {
    let k = 400.0 / c.lens;
    let frame = |v: V| {
        [
            dot(v, c.right) * k,
            dot(v, c.up) * k,
            dot(v, c.forward),
            v[1],
        ]
    };
    let centre = frame(sub(r.centre, c.eye));
    let centre = [centre[0], centre[1], centre[2], r.centre[1]];
    let first = frame(scale(r.axis, r.radius));
    let second = frame(scale(cross(r.normal, r.axis), r.radius));
    let mut out = [0.0; 16];
    out[..4].copy_from_slice(&centre);
    out[4..8].copy_from_slice(&first);
    out[8..12].copy_from_slice(&second);
    out[12..].copy_from_slice(&[
        r.turn.rem_euclid(TAU),
        r.light,
        f32::from(u8::from(ticked)),
        ink,
    ]);
    let (mut lo, mut hi) = ([f32::MAX; 2], [f32::MIN; 2]);
    for i in 0..48 {
        match c.screen(r.at(TAU * i as f32 / 48.0)) {
            Some([x, y]) => {
                lo = [lo[0].min(x), lo[1].min(y)];
                hi = [hi[0].max(x), hi[1].max(y)];
            }
            None => return (out, [-1e5, -1e5, 1e5, 1e5]),
        }
    }
    (
        out,
        [lo[0] - 32.0, lo[1] - 32.0, hi[0] + 32.0, hi[1] + 32.0],
    )
}

/// The ring's runner as two dots (a wide glow and a pale core), hidden by
/// him on the far side, and nothing of it under the ground.
fn runner_dots(c: &Camera, r: &Ring, glow: f32, ink: f32, lift: f32) -> [[f32; 8]; 2] {
    let p = r.at(r.turn);
    let Some(at) = c.screen(p) else {
        return [[0.0; 8]; 2];
    };
    let back = dot(sub(p, r.centre), c.forward) > 0.0;
    let light = r.light * smooth(-0.015, 0.015, p[1] + lift);
    // The storyboard draws it twice, sharp and blurred: a little brighter.
    [
        dot_at(at, glow, 0.9 * 1.25 * light, ink, back),
        dot_at(at, 4.0, 1.25 * light, PALE_INK, back),
    ]
}

/// How much of a screen segment from `a` (inside) to `b` stays within
/// `m` px of the middle.
fn kept(a: [f32; 2], b: [f32; 2], m: f32) -> f32 {
    let mut u: f32 = 1.0;
    for k in 0..2 {
        let d = b[k] - a[k];
        if b[k] > m {
            u = u.min((m - a[k]) / d);
        } else if b[k] < -m {
            u = u.min((-m - a[k]) / d);
        }
    }
    u.clamp(0.0, 1.0)
}

/// The thread on the screen: its top and its (cut) end; the depths of its
/// top and of its end in front of the camera, how much of its length that
/// end reaches, its light; how much of the top–end line is on the screen.
/// The shader finds the share of the length at a point from these, so the
/// thread fades along its length as in the storyboard.
fn thread_marks(c: &Camera, f: &Frame) -> [f32; 12] {
    const NEAR: f32 = 0.05;
    let top = [f.thread[0], f.thread[1], f.thread[2]];
    let length = f.thread[3];
    let bottom = sub(top, [0.0, length, 0.0]);
    let (za, zb) = (c.depth(top), c.depth(bottom));
    if f.thread_light <= 0.0 || length <= 1e-4 || za <= NEAR {
        return [0.0; 12];
    }
    let reach = if zb < NEAR {
        (za - NEAR) / (za - zb)
    } else {
        1.0
    };
    let end = mix(top, bottom, reach);
    let (Some(a), Some(b)) = (c.screen(top), c.screen(end)) else {
        return [0.0; 12];
    };
    let u = kept(a, b, 2400.0);
    let b = [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    [
        a[0],
        a[1],
        b[0],
        b[1],
        za,
        c.depth(end),
        reach,
        f.thread_light,
        u,
        0.0,
        0.0,
        0.0,
    ]
}

pub fn marks(f: &Frame) -> Marks {
    let c = &f.camera;
    let t = f.time;
    let lift = f.altitude;
    let mut labels = [[0.0; 8]; LABELS];
    let mut dots = [[0.0; 8]; DOTS];
    let mut texts = [[0.0; 12]; TEXTS];

    // The beads on the thread, each a warm glow with its word beside it.
    let top = [f.thread[0], f.thread[1], f.thread[2]];
    let bead_at = |i: usize| c.screen(sub(top, [0.0, f.beads[i][0], 0.0]));
    for (i, &[_, light, row, size]) in f.beads.iter().enumerate() {
        if light <= 0.0 {
            continue;
        }
        if let Some(at) = bead_at(i) {
            labels[i] = label_at(at[0] + 18.0, at[1], size, row, light, true);
            dots[i] = dot_at(at, 26.0 * light, 0.8 * light, WARM_INK, false);
            dots[5 + i] = dot_at(at, 5.0, light, PALE_INK, false);
        }
    }

    // The word at his mouth, falling onto its bead's place.
    let [row, light, fall, arcs] = f.voice;
    // While his word is on the visor glass, it is not also in front of it.
    let light = light * (1.0 - f.inside[1]);
    let mouth = f.pose.to_world(add(MOUTH, [0.0, 0.08, 0.6]));
    if light > 0.0 {
        if let Some([x, y]) = c.screen(mouth) {
            let r = row as usize;
            let size = (0.14 * c.per_metre(mouth)).clamp(18.0, 30.0);
            let (mut left, mut middle, mut size) = (centred(x, size, r), y, size);
            if r < 5 && fall > 0.0 {
                if let Some(at) = bead_at(r) {
                    left = lerp(left, at[0] + 18.0, fall);
                    middle = lerp(middle, at[1], fall);
                    size = lerp(size, f.beads[r][3], fall);
                }
            }
            labels[5] = label_at(left, middle, size, row, light, true);
        }
    }

    // Where the thread meets the ground under him, over the land.
    if f.land {
        let k = smooth(0.4, 0.8, lift) * f.fade;
        if let Some(at) = c.screen([0.0, -lift, 0.0]) {
            dots[10] = dot_at(at, 30.0, 0.55 * k, WARM_INK, false);
            dots[11] = dot_at(at, 5.0, 0.9 * k, PALE_INK, false);
        }
    }

    // The satellite and the meteors, far off.
    let far = |w: V, d: f32| c.screen(add(c.eye, scale(w, d)));
    let (way, sat) = f.satellite;
    let mut satellite = [0.0; 4];
    if sat > 0.0 {
        if let Some(at) = far(way, 5000.0) {
            dots[12] = dot_at(at, 10.0, 0.7 * sat, PALE_INK, false);
            dots[13] = dot_at(at, 2.5, sat, PALE_INK, false);
            satellite = [at[0], at[1], sat, 0.0];
        }
    }
    let mut meteors = [[0.0; 4]; 3];
    let mut meteor_light = [0.0; 4];
    for (i, &(head, tail, light)) in f.meteors.iter().enumerate() {
        if light <= 0.0 {
            continue;
        }
        if let (Some(h), Some(s)) = (far(head, 5000.0), far(tail, 5000.0)) {
            meteors[i] = [s[0], s[1], h[0], h[1]];
            meteor_light[i] = light;
            dots[14 + i] = dot_at(h, 9.0, light, PALE_INK, false);
        }
    }
    let [bx, by, bz, bolt_light] = f.bolt;
    let bolt = match far([bx, by, bz], 1000.0) {
        Some(at) if bolt_light > 0.0 => [at[0], at[1], bolt_light, 0.0],
        _ => [0.0; 4],
    };

    // The rings and their runners.
    let (outer, outer_box) = ring_marks(c, &f.outer, true, COLD_INK);
    let (inner, inner_box) = ring_marks(c, &f.inner, false, WARM_INK);
    let [a, b] = runner_dots(c, &f.outer, 20.0, COLD_INK, lift);
    dots[18] = a;
    dots[19] = b;
    let [a, b] = runner_dots(c, &f.inner, 14.0, WARM_INK, lift);
    dots[20] = a;
    dots[21] = b;

    // His inside: the heart, the breath, warm hands.
    let mut signs = [[0.0; 4]; 4];
    let [inside, visor] = f.inside;
    let body = |l: V| c.screen(f.pose.to_world(l));
    if inside > 0.0 {
        let s0 = c.per_metre(f.pose.to_world([0.0, 1.2, 0.0]));
        if let (Some(head), Some(chest), Some(belly), Some(hand)) = (
            body([0.0, 1.76, 0.0]),
            body([0.03, 1.36, 0.1]),
            body([0.0, 1.1, 0.12]),
            body([0.31, 0.96, 0.2]),
        ) {
            let beat = (t * HEARTBEATS / LOOP_SECONDS).fract();
            let breath = (t * BREATHS / LOOP_SECONDS).fract();
            signs = [
                [head[0], head[1], s0, 0.0],
                [chest[0], chest[1], inside, beat],
                [belly[0], belly[1], inside, breath],
                [hand[0], hand[1], inside, 0.0],
            ];
            let s = 0.032 * s0;
            dots[17] = dot_at(
                [chest[0], chest[1] + 0.25 * s],
                1.6 * s,
                0.35 * inside,
                WARM_INK,
                false,
            );
        }
    }

    // The words lying round his feet at «Я Есть»; he hides those behind him.
    let waist = c.depth(f.pose.to_world([0.0, WAIST, 0.0]));
    for (i, &[radius, light]) in f.ground_words.iter().enumerate() {
        if light <= 0.0 {
            continue;
        }
        let a = GROUND_ANGLES[i];
        let p = [a.cos() * radius, -lift + 0.012, a.sin() * radius];
        let (along, up) = facing(c, p, level_way(c.right), level_way(c.forward));
        let row = i as f32 + if c.depth(p) > waist { MASKED_ROW } else { 0.0 };
        texts[i] = [
            p[0],
            p[1],
            p[2],
            GROUND_SIZE,
            along[0],
            along[1],
            along[2],
            row,
            up[0],
            up[1],
            up[2],
            light,
        ];
    }
    // «Я Ощущаю» on the glass of his visor.
    if visor > 0.0 {
        let p = f.pose.to_world(add(HELM, [0.0, -0.025, 0.216]));
        let (along, up) = facing(
            c,
            p,
            f.pose.way([1.0, 0.0, 0.0]),
            f.pose.way([0.0, 1.0, 0.0]),
        );
        texts[5] = [
            p[0],
            p[1],
            p[2],
            0.045,
            along[0],
            along[1],
            along[2],
            2.0,
            up[0],
            up[1],
            up[2],
            0.95 * visor,
        ];
    }

    // The sound of his voice, out of his mouth.
    let mut sound = [0.0; 8];
    if arcs > 0.0 {
        let m = f.pose.to_world(add(MOUTH, [0.0, 0.0, 0.03]));
        let ahead = f.pose.to_world(add(MOUTH, [0.0, 0.0, 0.6]));
        if let (Some(pm), Some(pa)) = (c.screen(m), c.screen(ahead)) {
            let way = (pa[1] - pm[1]).atan2(pa[0] - pm[0]);
            sound = [
                pm[0],
                pm[1],
                0.05 * c.per_metre(m),
                arcs,
                way,
                0.6,
                0.0,
                0.0,
            ];
        }
    }

    // The brackets of «Я Замечаю».
    let notices = f
        .notices
        .map(|[x, y, z, size, light]| match c.screen([x, y, z]) {
            Some(at) if light > 0.0 => [at[0], at[1], size, light],
            _ => [0.0; 4],
        });

    Marks {
        labels,
        dots,
        texts,
        rings: [outer, inner],
        boxes: [outer_box, inner_box],
        thread: thread_marks(c, f),
        notices,
        bolt,
        meteors,
        meteor_light,
        satellite,
        signs,
        arcs: sound,
        altimeter: f.altimeter,
    }
}

// ---------- the themes

/// The scene's colours in a theme: the cold first ring, his warm voice and
/// second ring, the pale of stars and lamps, a black page's own dark, the
/// air's glow; Матрица's code.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub cold: [f32; 3],
    pub warm: [f32; 3],
    pub pale: [f32; 3],
    pub dusk: [f32; 3],
    pub sky: [f32; 3],
    pub code: f32,
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

pub fn look(code: u32) -> Look {
    match Palette::from_code(code) {
        // Искра: the yellow of the theme, an ember warmth; an ember dark,
        // the air's glow orange, not the yellow (on black that reads olive).
        Palette::Dark => Look {
            cold: rgb(245, 221, 7),
            warm: rgb(255, 122, 40),
            pale: rgb(255, 244, 170),
            dusk: rgb(21, 14, 8),
            sky: rgb(255, 120, 36),
            code: 0.0,
        },
        // Астрал: the blue of the theme, a rose-peach warmth.
        Palette::Violet => Look {
            cold: rgb(98, 150, 245),
            warm: rgb(240, 158, 128),
            pale: rgb(200, 212, 248),
            dusk: [0.0; 3],
            sky: rgb(98, 150, 245),
            code: 0.0,
        },
        // Матрица: code green, amber; a green-black dark.
        Palette::Matrix => Look {
            cold: rgb(0, 255, 65),
            warm: rgb(255, 184, 64),
            pale: rgb(190, 255, 205),
            dusk: rgb(4, 17, 9),
            sky: rgb(0, 255, 65),
            code: 1.0,
        },
        // Тишина: sea glass, warm sand.
        _ => Look {
            cold: rgb(134, 201, 199),
            warm: rgb(242, 179, 117),
            pale: rgb(214, 218, 210),
            dusk: [0.0; 3],
            sky: rgb(134, 201, 199),
            code: 0.0,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn the_scene_rises_from_the_page_and_sinks_back_at_the_seam() {
        assert_eq!(compose(0.0).fade, 0.0);
        assert!(compose(59.99).fade < 1e-3);
        every(0.1, |t| {
            if (FADE[1]..=FADE[2]).contains(&t) {
                assert_eq!(compose(t).fade, 1.0, "{t}");
            }
        });
    }

    #[test]
    fn each_phrase_pulls_him_lower_until_he_stands() {
        let mut last = f32::INFINITY;
        every(0.05, |t| {
            let h = altitude(t);
            assert!(h <= last + 1e-3, "{t}: {h} > {last}");
            last = h;
        });
        assert!((altitude(0.0) - 410_000.0).abs() < 1.0);
        assert!(altitude(50.0) < 1e-3);
        // Each storyboard frame is held at its height.
        for (t, h) in [
            (3.0, 410_000.0),
            (13.0, 110_000.0),
            (21.5, 35_000.0),
            (33.0, 900.0),
            (40.0, 3.5),
            (50.0, 0.0),
        ] {
            let a = altitude(t);
            assert!((a - h).abs() <= h * 1e-3 + 1e-3, "{t}: {a}");
        }
        // Each word reaches the thread before its pull starts.
        for (k, &[from, _]) in PULLS.iter().enumerate() {
            assert!(SAID[k] + LANDS <= from, "{k}");
        }
        assert!(SAID[5] > PULLS[4][1], "«Я Есть» once he stands");
    }

    #[test]
    fn the_cut_to_the_land_hides_in_the_middle_of_the_clouds() {
        assert!(
            (altitude(SWITCH) - CLOUD_DECK).abs() < 25.0,
            "{}",
            altitude(SWITCH)
        );
        assert!(fog(SWITCH) > 0.99);
        assert!(fog(SWITCH - 0.05) > 0.98 && fog(SWITCH + 0.05) > 0.98);
        // Clear air at every storyboard frame.
        for t in [3.0, 13.0, 21.5, 26.0, 33.0, 40.0, 50.0] {
            assert!(fog(t) < 0.02, "{t}: {}", fog(t));
        }
        // The camera only jumps at the cut.
        let mut last = camera(0.0).eye;
        every(0.02, |t| {
            let eye = camera(t).eye;
            if (t - SWITCH).abs() > 0.03 {
                assert!(distance(eye, last) < 0.1, "{t}");
            }
            last = eye;
        });
    }

    #[test]
    fn he_stays_in_the_frame_and_the_camera_above_the_ground() {
        every(0.1, |t| {
            let c = camera(t);
            let f = compose(t);
            if f.land {
                assert!(
                    c.eye[1] > -f.altitude + 0.25,
                    "{t}: eye {:?} lift {}",
                    c.eye,
                    f.altitude
                );
            }
            for p in [[0.0, WAIST, 0.0], f.pose.to_world([0.0, 1.6, 0.0])] {
                let at = c.project(p).unwrap_or([9.0, 9.0]);
                assert!(in_frame(at), "{t}: {p:?} at {at:?}");
            }
        });
    }

    #[test]
    fn the_rings_fall_into_step_at_i_am() {
        let gap = |t: f32| (inner(t, &pose(t)).turn - outer(t).turn).rem_euclid(TAU);
        let g = gap(50.0);
        every(0.25, |t| {
            if t >= 50.0 {
                assert!((gap(t) - g).abs() < 1e-3, "{t}");
            }
        });
        // Before, the second ring runs its own way.
        assert!((gap(20.0) - gap(30.0)).abs() > 0.1);
        // Both always turn.
        every(0.5, |t| {
            assert!(outer(t + 0.1).turn > outer(t).turn);
            assert!(inner(t + 0.1, &pose(t)).turn > inner(t, &pose(t)).turn);
        });
        // At «Я Есть» the first ring lies on the ground round his feet.
        let r = outer(STILL);
        assert!(distance(r.centre, FLOOR) < 1e-4 && r.normal[1] > 0.999);
        // And it never rests: its plane and its place move all the time.
        every(0.5, |t| {
            let (a, b) = (outer(t), outer(t + 0.5));
            assert!(
                distance(a.centre, b.centre) + distance(a.normal, b.normal) > 0.01,
                "{t}"
            );
        });
    }

    #[test]
    fn the_words_hang_on_the_thread_and_then_lie_round_him() {
        // One bead after «Я Здесь», two after «Я Слышу».
        let lit = |t: f32| beads(t).iter().filter(|b| b[1] > 0.05).count();
        assert_eq!(lit(4.0), 0);
        assert_eq!(lit(7.0), 1);
        assert_eq!(lit(16.0), 2);
        // The newest bead is the brightest and the highest.
        let b = beads(26.0);
        assert!(b[2][1] > b[1][1] && b[2][0] < b[1][0]);
        // Over the land no bead hangs below the ground.
        every(0.1, |t| {
            if over_land(t) {
                for bead in beads(t) {
                    assert!(bead[0] <= altitude(t) + 1e-4, "{t}");
                }
            }
        });
        // On the soil the thread is gone, the words lie round him.
        let f = compose(STILL);
        assert!(f.thread_light < 1e-3);
        assert!(f.beads.iter().all(|b| b[1] < 1e-3));
        assert!(f
            .ground_words
            .iter()
            .all(|w| (w[0] - GROUND_RADIUS).abs() < 1e-3 && w[1] > 0.8));
        // And «Я Есть» is at his mouth.
        assert_eq!(f.voice[0], 5.0);
        assert!(f.voice[1] > 0.9);
    }

    #[test]
    fn the_altimeter_reads_the_storyboard() {
        for (t, number, metres) in [
            (3.0, 410, false),
            (13.0, 110, false),
            (21.5, 35, false),
            (33.0, 900, true),
            (40.0, 3, true),
            (50.0, 0, true),
        ] {
            assert_eq!(reading(t), (number, metres), "{t}");
        }
        assert_eq!(GLYPHS.chars().count(), 12);
    }

    #[test]
    fn the_storms_lie_under_him() {
        for (i, [_, _, time, alt]) in STORMS.iter().enumerate() {
            let q = storms()[i];
            assert!(q[0].abs() + q[1].abs() > 1.0, "{i}");
            let back = earth_map(earth_way(q, *alt), *alt);
            assert!(
                (back[0] - q[0]).abs() < 0.5 && (back[1] - q[1]).abs() < 0.5,
                "{i}"
            );
            // The bolt is where the storyboard drew it.
            let c = camera(*time);
            let at = c
                .project(add(c.eye, scale(earth_way(q, *alt), 1000.0)))
                .unwrap();
            let px = [600.0 + 400.0 * at[0], 400.0 - 400.0 * at[1]];
            assert!(
                (px[0] - STORMS[i][0]).abs() < 2.0 && (px[1] - STORMS[i][1]).abs() < 2.0,
                "{px:?}"
            );
        }
    }

    #[test]
    fn each_word_falls_exactly_onto_its_bead() {
        for (i, said) in SAID.iter().take(5).enumerate() {
            let f = compose(said + LANDS);
            if f.inside[1] > 0.0 {
                // «Я Ощущаю» is on his visor glass then, not in front of it.
                assert_eq!(i, 2);
                continue;
            }
            let m = marks(&f);
            let (word, bead) = (m.labels[5], m.labels[i]);
            assert!(word[4] > 0.0 && bead[4] > 0.0, "{i}");
            for (w, b) in word.iter().zip(&bead).take(4) {
                assert!((w - b).abs() < 1e-2, "{i}: {word:?} {bead:?}");
            }
        }
    }

    #[test]
    fn every_mark_is_a_number() {
        every(0.1, |t| {
            let m = marks(&compose(t));
            let all = m
                .labels
                .iter()
                .flatten()
                .chain(m.dots.iter().flatten())
                .chain(m.texts.iter().flatten())
                .chain(m.rings.iter().flatten())
                .chain(m.boxes.iter().flatten())
                .chain(m.thread.iter())
                .chain(m.notices.iter().flatten())
                .chain(m.bolt.iter())
                .chain(m.meteors.iter().flatten())
                .chain(m.meteor_light.iter())
                .chain(m.satellite.iter())
                .chain(m.signs.iter().flatten())
                .chain(m.arcs.iter())
                .chain(m.altimeter.iter());
            for v in all {
                assert!(v.is_finite(), "{t}: {m:?}");
            }
        });
    }

    #[test]
    fn the_boxes_hold_the_rings_runners() {
        every(0.25, |t| {
            let m = marks(&compose(t));
            for (ring, dot) in [(0, 18), (1, 20)] {
                let [x, y, _, light, ..] = m.dots[dot];
                if light <= 0.0 {
                    continue;
                }
                let [x0, y0, x1, y1] = m.boxes[ring];
                assert!(x0 <= x && x <= x1 && y0 <= y && y <= y1, "{t}: {ring}");
            }
        });
    }

    #[test]
    fn the_signs_of_his_inside_beat_with_the_loop() {
        // A whole number of heartbeats and breaths a loop, so the seam is
        // not seen.
        assert_eq!(HEARTBEATS.fract(), 0.0);
        assert_eq!(BREATHS.fract(), 0.0);
        let m = marks(&compose(24.0));
        assert!(m.signs[1][2] > 0.5);
        // No thought bubble: Art had «тепло» taken out.
        assert!(m.signs[0][3] == 0.0 && m.labels[6][4] == 0.0);
        assert!(m.texts[5][11] > 0.5);
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

    #[test]
    fn only_black_pages_get_a_dusk_and_only_matrix_runs_code() {
        for code in [2, 3] {
            let l = look(code);
            assert_eq!(l.dusk, [0.0; 3]);
            assert_eq!(l.sky, l.cold);
            assert_eq!(l.code, 0.0);
        }
        for code in [0, 4] {
            let d = look(code).dusk;
            let lum = 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
            assert!(lum > 0.04 && lum < 0.09, "{code}: {lum}");
        }
        let ember = look(0).sky;
        assert!(ember[1] < 0.6 * ember[0]);
        assert_eq!(look(4).code, 1.0);
        assert_eq!(look(0).code, 0.0);
    }
}
