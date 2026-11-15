//! «Сохраняй синхронность двух колец.», page 07 of Step 6 «Внутреннее
//! кольцо», direction «Резкость». Blue hour on a river. A person sits
//! upright on a straight backed chair at the end of a wooden pier; behind
//! him, across the water, a city: houses with lit windows, a bell tower, a
//! bridge with a train on it, lamps along the far embankment, gulls. A
//! sphere stands round him far out over the river: the cold first ring
//! rides it, always turning, over the roofs; the warm second ring scans his
//! body from crown to feet and back.
//! The scene is told with focus, as a lens would: the city and the man are
//! two layers, each either sharp or melted into discs of light.
//! «Это главное!»: both rings flash, both layers sharp, the camera comes in.
//! «Внешнее кольцо»: the city sharp, he soft; the ring passes the belfry and
//! the bell rings, the gulls lift, a train crosses the bridge.
//! «Внутреннее кольцо»: he sharp, the city melts into bokeh; warm signs of
//! his inside glow in him (a thought «успею?», then «а если…», a heart, a
//! wave, sparks at his hands), brighter where the second ring passes.
//! «Обе сферы удерживаются одновременно»: he tries to hold both by force:
//! the focus racks back and forth, faster and faster, his shoulders creep
//! up. «Без усилия»: both layers sharp at once, which no lens can do.
//! «Без напряжения»: the shoulders drop, the signs calm, the thought goes.
//! «Просто как два слоя одного Осознавания»: the rings turn in step and
//! pulse together, the camera draws back, a second train crosses.
//! Every value here is a pure function of loop time; `browser.rs` uploads
//! it and four passes draw it (the city, him, the blur, the composite).
//! Unit: metres; he sits about 1.43 high at the origin, the deck is y = 0.
//! His body has its own frame (`to_local`): he faces +z there, and in the
//! world he faces away from the city, which lies toward +x.

use crate::body::{add, cross, dot, length, norm, scale, sub, V};
use std::f32::consts::TAU;
use std::sync::OnceLock;
use watcher_scene_palette::Palette;

pub mod body;
mod generated;
pub use generated::{ATLAS, LABEL_BAND, LABEL_BASE, LABEL_CAP, LABEL_INK};

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerFocus;

pub const LOOP_SECONDS: f32 = 60.0;
/// The frame is 3:2; a canvas of another shape keeps the whole 3:2 frame in
/// view.
pub const FRAME_ASPECT: f32 = 1.5;
/// His frame turned into the world's (radians about y).
pub const YAW: f32 = -2.557;
/// The box (his frame) the person and the chair lie in; the shader marches
/// only there.
pub const BOUNDS: [[f32; 3]; 2] = [[-0.3, -0.01, -0.21], [0.3, 1.47, 0.7]];
/// Where the soles stand (x, z) and the four chair legs, in his frame.
pub const FEET: [[f32; 2]; 2] = [[0.126, 0.6], [-0.126, 0.6]];
pub const LEGS: [[f32; 2]; 4] = [
    [0.195, 0.27],
    [-0.195, 0.27],
    [0.195, -0.12],
    [-0.195, -0.12],
];
/// One meaningful still frame for reduced motion: «Просто как два слоя
/// одного Осознавания»: both layers sharp, the rings in step, he at ease.
pub const STILL: f32 = 49.5;

// ---------- the world (in the world frame)
// A direction into the city is kept as (azimuth, height): the azimuth from
// +x toward +z, the height as the tangent of its elevation above the far
// waterline, which lies `FAR_BANK` away.

pub const FAR_BANK: f32 = 260.0;
/// The pier: its deck is y = 0 up to the rail at x = `RAIL_X`, `PIER_HALF`
/// to either side.
pub const RAIL_X: f32 = 0.95;
pub const PIER_HALF: f32 = 4.5;
/// The bell tower: its azimuth and the height of its bell chamber.
pub const TOWER_AZ: f32 = -0.02;
pub const BELFRY: [f32; 2] = [0.128, 0.152];
/// The bridge from one azimuth to another; a train on it is this long.
pub const BRIDGE: [f32; 2] = [-0.62, -0.12];
pub const TRAIN_LENGTH: f32 = 0.2;
/// The trains: from, to (s); the azimuth of the head from, to. Each one
/// starts and ends off the bridge, so it is never seen to appear.
pub const TRAINS: [[f32; 4]; 2] = [[5.0, 15.0, -0.62, 0.08], [46.0, 57.0, -0.12, -0.82]];
/// The lamps along the far embankment: one each `LAMP_STEP` of azimuth at
/// `LAMP_HEIGHT`; those on the bridge: the first one's azimuth, the step,
/// the height.
pub const LAMP_STEP: f32 = 0.03;
pub const LAMP_HEIGHT: f32 = 0.0065;
pub const BRIDGE_LAMPS: [f32; 3] = [-0.6, 0.053, 0.047];
/// The gulls over the water: azimuth, height, size (px of an 800 px high
/// frame), phase.
pub const GULLS: [[f32; 4]; 6] = [
    [-0.42, 0.09, 15.0, 0.1],
    [-0.34, 0.15, 12.0, 0.7],
    [-0.27, 0.11, 17.0, 0.35],
    [-0.19, 0.17, 11.0, 0.9],
    [-0.12, 0.08, 14.0, 0.55],
    [-0.07, 0.13, 12.0, 0.25],
];

// ---------- the rings

/// The sphere round him: centre, radius. It stands far out over the river,
/// in front of the far bank.
pub const SPHERE: [f32; 4] = [0.0, 1.0, 0.0, 230.0];
/// The first ring's axis leans this far off up and goes round once a loop;
/// the ring rides the sphere between these latitudes, there and back each
/// `LATITUDE_SECONDS`.
pub const TILT: f32 = 0.06;
pub const LATITUDE: [f32; 2] = [0.03, 0.17];
pub const LATITUDE_SECONDS: f32 = 15.0;
/// Whole turns of the first ring a loop, and its runners.
pub const TURNS: f32 = 2.0;
pub const RUNNERS: usize = 6;
/// The second ring round his body (his frame, legs together); by height,
/// feet to head: (y, centre z, radius). Its plane leans by `INNER_NORMAL`.
pub const HUG: [[f32; 3]; 6] = [
    [0.05, 0.25, 0.47],
    [0.3, 0.22, 0.46],
    [0.55, 0.17, 0.42],
    [0.8, 0.0, 0.31],
    [1.1, -0.05, 0.3],
    [1.3, -0.02, 0.18],
];
pub const INNER_NORMAL: V = [0.04, 1.0, 0.02];
/// The second ring scans him crown to feet and back each `SCAN_SECONDS`,
/// at the crown at `SCAN_CROWN`.
pub const SCAN_SECONDS: f32 = 12.0;
pub const SCAN_CROWN: f32 = 17.5;
/// While he is inside (on, full, slowing, off) the second ring races ahead
/// of the first by `RACE_TURNS` whole turns, then runs in step with it.
pub const RACE: [f32; 4] = [16.0, 18.0, 40.0, 44.0];
pub const RACE_TURNS: f32 = 5.0;
/// «Это главное!»: both rings flash. At the end they pulse together.
pub const FLASH: [f32; 4] = [0.0, 0.6, 1.6, 3.0];
pub const SYNC: [f32; 4] = [48.0, 50.0, 58.0, 60.0];
pub const SYNC_SECONDS: f32 = 3.0;

// ---------- focus

/// The circle of confusion of the near layer (him) and the far one (the
/// city) when fully out of focus: its radius in px of an 800 px high frame.
pub const BLUR: [f32; 2] = [16.0, 12.0];
/// The focus racks from one layer to the other between these times, ever
/// faster: `RACK_RATE` turns a second at first, plus `RACK_SPEEDUP` a
/// second each second.
pub const RACK: [f32; 2] = [30.0, 41.5];
pub const RACK_RATE: f32 = 0.25;
pub const RACK_SPEEDUP: f32 = 0.065;

// ---------- his inside (his frame)

pub const HEAD: V = [0.0, 1.33, 0.0];
pub const CHEST: V = [0.03, 0.97, 0.08];
pub const BELLY: V = [0.0, 0.72, 0.1];
pub const HANDS: [V; 2] = [[0.17, 0.63, 0.33], [-0.17, 0.63, 0.33]];
/// The signs of his inside are on (on, full, fading, off); the thought; its
/// two words one after the other; they calm (from, to).
pub const SIGNS: [f32; 4] = [17.0, 18.5, 52.0, 57.0];
pub const THOUGHT: [f32; 4] = [17.0, 18.5, 46.0, 48.0];
pub const WORDS: [[f32; 4]; 2] = [[17.5, 18.5, 23.0, 23.6], [23.6, 24.2, 46.0, 48.0]];
pub const CALM: [f32; 4] = [44.0, 47.5, 58.0, 60.0];
/// His shoulders creep up while he forces it, and drop.
pub const SHRUG: [f32; 4] = [30.0, 34.0, 44.0, 47.5];
pub const SHRUG_HEIGHT: f32 = 0.035;
/// The bell rings each time the first ring passes the belfry while the
/// city is heard (from, to), and dies away over `BELL_DECAY` s.
pub const BELLS: [[f32; 2]; 2] = [[3.0, 16.0], [46.0, 57.0]];
pub const BELL_DECAY: f32 = 1.6;
/// Where the bell's crossings are found from.
const BELL_EYE: V = [-2.1, 1.2, -1.0];
/// His heart: beats a second, and how many fewer it beats a loop once he
/// is at ease (it slows from `CALM[0]` and is back by the loop's end).
pub const HEART: [f32; 2] = [1.2, 5.0];
/// The gulls' wing beats a second (whole beats a loop).
pub const FLAP: f32 = 2.5;
/// The slots the signs take in `Frame::signs`.
pub const SIGN_SLOTS: usize = 9;

// ---------- the camera
// (time, [eye xyz, target xyz, vertical field of view in degrees]), a
// closed curve through the loop. It looks past him at the city.

pub const CAMERA: [(f32, [f32; 7]); 11] = [
    (0.0, [-3.4, 1.55, -1.7, 4.0, 0.75, 0.2, 46.0]),
    (4.5, [-2.2, 1.22, -0.9, 4.0, 0.62, -0.4, 46.0]),
    (10.0, [-2.1, 1.2, -1.0, 4.0, 0.63, -0.3, 46.0]),
    (15.5, [-2.05, 1.2, -0.95, 4.0, 0.62, -0.25, 45.0]),
    (18.5, [-1.98, 1.2, -0.95, 4.0, 0.62, -0.2, 42.0]),
    (28.0, [-1.85, 1.18, -0.9, 4.0, 0.62, -0.2, 40.0]),
    (32.0, [-1.95, 1.2, -0.95, 4.0, 0.65, -0.2, 42.0]),
    (39.0, [-1.95, 1.2, -0.95, 4.0, 0.65, -0.2, 42.0]),
    (44.0, [-2.1, 1.25, -1.05, 4.0, 0.68, -0.1, 44.0]),
    (49.0, [-2.3, 1.3, -1.15, 4.0, 0.7, -0.05, 45.0]),
    (57.0, [-3.4, 1.55, -1.7, 4.0, 0.75, 0.2, 46.0]),
];

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

fn wrap(t: f32) -> f32 {
    if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    }
}

/// His frame to the world's, and back.
pub fn to_world(l: V) -> V {
    let (s, c) = YAW.sin_cos();
    [c * l[0] + s * l[2], l[1], -s * l[0] + c * l[2]]
}
pub fn to_local(p: V) -> V {
    let (s, c) = YAW.sin_cos();
    [c * p[0] - s * p[2], p[1], s * p[0] + c * p[2]]
}

/// The way from the eye at `eye` into the city at azimuth `az` and height
/// `h` above the far waterline.
pub fn city_way(eye: V, az: f32, h: f32) -> V {
    norm([az.cos(), h - eye[1] / FAR_BANK, az.sin()])
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
    /// Where a far way lands in the frame.
    pub fn project_way(&self, d: V) -> Option<[f32; 2]> {
        self.project(add(self.eye, scale(norm(d), 1000.0)))
    }
    /// How far a point is along the view, and how big a metre is there in
    /// frame units.
    pub fn depth(&self, p: V) -> f32 {
        dot(sub(p, self.eye), self.forward)
    }
}

pub fn in_frame([x, y]: [f32; 2]) -> bool {
    x.abs() < FRAME_ASPECT && y.abs() < 1.0
}

pub fn camera(t: f32) -> Camera {
    let [ex, ey, ez, tx, ty, tz, fov] = keyed(&CAMERA, t);
    Camera::toward([ex, ey, ez], [tx, ty, tz], fov)
}

// ---------- focus

/// Where the focus is (0 the city, 1 him) and how much both are sharp at
/// once (1: both, whatever the focus).
pub fn focus(t: f32) -> (f32, f32) {
    let t = wrap(t);
    let f = if t < 4.5 {
        0.5 * (1.0 - smooth(3.0, 4.5, t))
    } else if t < 16.0 {
        0.0
    } else if t < RACK[0] {
        smooth(16.0, 17.5, t)
    } else if t < RACK[1] {
        let u = t - RACK[0];
        let turns = RACK_RATE * u + 0.5 * RACK_SPEEDUP * u * u;
        0.5 + 0.5 * (1.0 - smooth(39.0, RACK[1], t)) * (TAU * turns).cos()
    } else {
        0.5
    };
    let both = 1.0 - smooth(3.0, 4.5, t) + smooth(40.0, RACK[1], t);
    (f, both.min(1.0))
}

/// The circles of confusion (near, far) in px of an 800 px high frame.
pub fn blur(t: f32) -> [f32; 2] {
    let (f, both) = focus(t);
    [BLUR[0] * (1.0 - f) * (1.0 - both), BLUR[1] * f * (1.0 - both)]
}

// ---------- the rings

/// One ring: its centre and radius, the normal of its plane, the first
/// axis in its plane (the second is normal × first), its runner's angle,
/// its light.
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
        // The first axis toward world +x, so both rings count their angle
        // from the same side.
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
    /// The angle of the ring's point toward the way `d` (level).
    fn angle_toward(&self, d: V) -> f32 {
        let second = cross(self.normal, self.axis);
        dot(d, second).atan2(dot(d, self.axis))
    }
}

/// The first ring's turn (radians).
pub fn turn(t: f32) -> f32 {
    TAU * TURNS * t / LOOP_SECONDS
}

/// Its latitude on the sphere.
pub fn latitude(t: f32) -> f32 {
    let [lo, hi] = LATITUDE;
    0.5 * (lo + hi) - 0.5 * (hi - lo) * (TAU * t / LATITUDE_SECONDS).cos()
}

fn outer_ring(t: f32, light: f32) -> Ring {
    let p = TAU * t / LOOP_SECONDS;
    // Leaning away from the city at the start, so the ring rides high over
    // it while the city is heard.
    let normal = [-TILT.sin() * p.cos(), TILT.cos(), -TILT.sin() * p.sin()];
    let lat = latitude(t);
    let r = SPHERE[3];
    let centre = add([SPHERE[0], SPHERE[1], SPHERE[2]], scale(normal, r * lat.sin()));
    Ring::new(centre, r * lat.cos(), normal, turn(t), light)
}

/// How far up his body the second ring is: 0 at his feet, 1 at his crown.
pub fn scan(t: f32) -> f32 {
    0.5 + 0.5 * (TAU * (t - SCAN_CROWN) / SCAN_SECONDS).cos()
}

/// The second ring round his body `h` of the way from his feet (0) to his
/// crown (1): its height, centre z and radius (his frame).
pub fn hug(h: f32) -> [f32; 3] {
    let last = HUG.len() - 1;
    let y = HUG[0][0] + (HUG[last][0] - HUG[0][0]) * h.clamp(0.0, 1.0);
    let i = (0..last).rfind(|&i| HUG[i][0] <= y).unwrap_or(0);
    let (a, b) = (HUG[i], HUG[i + 1]);
    let s = ((y - a[0]) / (b[0] - a[0])).clamp(0.0, 1.0);
    [y, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]
}

/// How far the second ring has run ahead of the first (radians): whole
/// turns once the race is over.
pub fn race(t: f32) -> f32 {
    let [a, b, c, d] = RACE;
    let span = 0.5 * (b - a) + (c - b) + 0.5 * (d - c);
    TAU * RACE_TURNS / span * (ramp(a, b, t) - ramp(c, d, t))
}

fn inner_ring(t: f32, light: f32) -> Ring {
    let [y, z, r] = hug(scan(t));
    Ring::new(
        to_world([0.0, y, z]),
        r,
        to_world(INNER_NORMAL),
        turn(t) + race(t),
        light,
    )
}

/// The two rings' pulse together at the end.
pub fn sync(t: f32) -> f32 {
    window(t, SYNC) * (0.5 + 0.5 * (TAU * (t - SYNC[0]) / SYNC_SECONDS).cos())
}

// ---------- the bell

fn ring_height_toward(ring: &Ring, eye: V, az: f32) -> f32 {
    let p = ring.at(ring.angle_toward([az.cos(), 0.0, az.sin()]));
    (p[1] - eye[1]) / length([p[0] - eye[0], 0.0, p[2] - eye[2]]) + eye[1] / FAR_BANK
}

/// When the first ring passes the belfry (its height over the far
/// waterline crosses the bell chamber's middle), within `BELLS`.
pub fn bell_rings() -> &'static [f32] {
    static RINGS: OnceLock<Vec<f32>> = OnceLock::new();
    RINGS.get_or_init(|| {
        let mid = 0.5 * (BELFRY[0] + BELFRY[1]);
        let at = |t: f32| ring_height_toward(&outer_ring(t, 1.0), BELL_EYE, TOWER_AZ) - mid;
        let step = 0.005;
        let mut out = Vec::new();
        for [from, to] in BELLS {
            let mut t = from;
            let mut last = at(t);
            while t + step <= to {
                let now = at(t + step);
                if (last < 0.0) != (now < 0.0) {
                    out.push(t + step * last / (last - now));
                }
                last = now;
                t += step;
            }
        }
        out
    })
}

/// The bell's light and how long since it was last struck.
pub fn bell(t: f32) -> (f32, f32) {
    let mut light = 0.0;
    let mut age = 99.0;
    for &c in bell_rings() {
        let u = t - c;
        if u >= 0.0 {
            light += smooth(0.0, 0.15, u) * (-u / BELL_DECAY).exp();
            age = u;
        }
    }
    (light * (1.0 - smooth(58.0, LOOP_SECONDS, t)), age)
}

/// How far the gulls have lifted after the bell.
pub fn lift(t: f32) -> f32 {
    let up = bell_rings()
        .iter()
        .map(|&c| window(t - c, [0.0, 0.8, 2.5, 5.5]))
        .fold(0.0, f32::max);
    up * (1.0 - smooth(57.5, LOOP_SECONDS, t))
}

/// The head of the train on the bridge (azimuth) and which way it goes; the
/// head is far away when there is none.
pub fn train(t: f32) -> [f32; 2] {
    for [a, b, from, to] in TRAINS {
        if t >= a && t <= b {
            let s = (t - a) / (b - a);
            return [from + (to - from) * s, (to - from).signum()];
        }
    }
    [9.0, 1.0]
}

// ---------- his inside

/// The light of a sign at height `y` of him: on while he is inside, and
/// brighter where the second ring passes.
fn sign_light(ring_y: f32, y: f32, gate: f32) -> f32 {
    gate * (0.45 + 0.55 * (-((ring_y - y) / 0.15).powi(2)).exp())
}

/// How many times his heart has beaten by `t`: whole beats a loop.
pub fn heartbeats(t: f32) -> f32 {
    let [a, b, c, d] = [CALM[0], CALM[0] + 3.0, LOOP_SECONDS - 3.0, LOOP_SECONDS];
    let slow = ramp(a, b, t) - ramp(c, d, t);
    let whole = ramp(a, b, LOOP_SECONDS) - ramp(c, d, LOOP_SECONDS);
    HEART[0] * t - HEART[1] * slow / whole
}

/// His heart's beat now, 0..1 (lub-dub), slower once he is at ease.
pub fn beat(t: f32) -> f32 {
    let phase = heartbeats(t);
    let pulse = |u: f32| {
        let w = u - u.round();
        (-(w / 0.06).powi(2)).exp()
    };
    pulse(phase) + 0.6 * pulse(phase - 0.18)
}

// ---------- one frame

#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// Circles of confusion of him and of the city (px of an 800 px frame).
    pub blur: [f32; 2],
    pub outer: Ring,
    /// The first ring's runners in the frame: x, y, light.
    pub runners: [[f32; 3]; RUNNERS],
    pub inner: Ring,
    /// The second ring's runner: frame x, y, its depth along the view, light.
    pub inner_runner: [f32; 4],
    /// How far his shoulders are up.
    pub shrug: f32,
    /// The belfry in the frame (x, y), the bell's light, how long since it
    /// was struck.
    pub bell: [f32; 4],
    /// The train's head (azimuth) and way.
    pub train: [f32; 2],
    /// The gulls in the frame: x, y, size (frame units), wings (-1 down, 1
    /// up).
    pub gulls: [[f32; 4]; 6],
    /// The signs of his inside, in the frame (see `signs`).
    pub signs: [[f32; 4]; SIGN_SLOTS],
}

/// The signs: 0 head (x, y, a metre in frame units there); 1 the thought
/// (x, y, size, light); 2 its two small bubbles (x, y, x, y); 3 its words'
/// light (first, second), how calm he is; 4 the heart (x, y, size, light);
/// 5 the belly's wave (x, y, size, light); 6, 7 the hands' sparks (x, y,
/// size, light); 8 the heart's beat, the wave's phase.
fn signs(t: f32, cam: &Camera, ring_y: f32) -> [[f32; 4]; SIGN_SLOTS] {
    let mut out = [[0.0; 4]; SIGN_SLOTS];
    let gate = window(t, SIGNS);
    let calm = window(t, CALM);
    let at = |l: V| {
        let p = to_world(l);
        let s = cam.project(p).unwrap_or([9.0, 9.0]);
        let metre = 1.0 / (cam.depth(p).max(0.1) * cam.lens);
        (s, metre)
    };
    let (head, metre) = at(HEAD);
    out[0] = [head[0], head[1], metre, 0.0];
    let size = (0.24 * metre).clamp(0.18, 0.3);
    let (w, h) = (1.25 * size, 0.84 * size);
    let bx = (head[0] - 0.45 * metre).clamp(-FRAME_ASPECT + w + 0.04, FRAME_ASPECT - w - 0.04);
    let by = (head[1] + 0.36 * metre).clamp(-1.0 + h + 0.04, 1.0 - h - 0.04);
    let thought = window(t, THOUGHT) * (0.6 + 0.4 * (-((ring_y - HEAD[1]) / 0.2).powi(2)).exp());
    out[1] = [bx, by, size, thought];
    let tail = |k: f32| [head[0] + (bx - head[0]) * k, head[1] + (by - head[1]) * k];
    let (a, b) = (tail(0.5), tail(0.31));
    out[2] = [a[0], a[1], b[0], b[1]];
    out[3] = [window(t, WORDS[0]), window(t, WORDS[1]), calm, 0.0];
    let (chest, m) = at(CHEST);
    out[4] = [chest[0], chest[1], 0.065 * m, sign_light(ring_y, CHEST[1], gate)];
    let (belly, m) = at(BELLY);
    out[5] = [
        belly[0],
        belly[1],
        0.115 * m,
        sign_light(ring_y, BELLY[1], gate) * (1.0 - 0.4 * calm),
    ];
    for (k, hand) in HANDS.iter().enumerate() {
        let (p, m) = at(*hand);
        out[6 + k] = [
            p[0],
            p[1],
            0.04 * m,
            sign_light(ring_y, hand[1], gate) * (1.0 - 0.65 * calm),
        ];
    }
    out[8] = [
        beat(t) * (1.0 - 0.4 * calm),
        (TAU * 0.9 * t).rem_euclid(TAU),
        heartbeats(t).rem_euclid(1.0),
        0.0,
    ];
    out
}

pub fn compose(t: f32) -> Frame {
    let t = wrap(t);
    let camera = camera(t);
    let flash = window(t, FLASH);
    let together = sync(t);
    let outer = outer_ring(t, 1.0 + 0.8 * flash + 0.6 * together);
    let runners = std::array::from_fn(|k| {
        let p = outer.at(outer.turn + TAU * k as f32 / RUNNERS as f32);
        camera.project(p).map_or([9.0, 9.0, 0.0], |s| [s[0], s[1], 1.0])
    });
    let inner = inner_ring(t, 0.9 + 0.8 * flash + 0.6 * together);
    let run = inner.at(inner.turn);
    let inner_runner = camera
        .project(run)
        .map_or([9.0, 9.0, 0.0, 0.0], |s| [s[0], s[1], camera.depth(run), 1.0]);
    let (light, age) = bell(t);
    let belfry = camera
        .project_way(city_way(camera.eye, TOWER_AZ, 0.5 * (BELFRY[0] + BELFRY[1])))
        .unwrap_or([9.0, 9.0]);
    let up = lift(t);
    let gulls = std::array::from_fn(|i| {
        let [az, h, px, ph] = GULLS[i];
        let az = az + 0.03 * (TAU * (t / LOOP_SECONDS + ph)).sin();
        let h = h + 0.01 * (TAU * (2.0 * t / LOOP_SECONDS + ph * 1.7)).sin() + 0.03 * up;
        let s = camera
            .project_way(city_way(camera.eye, az, h))
            .unwrap_or([9.0, 9.0]);
        let glide = 0.5 + 0.5 * (TAU * (5.0 * t / LOOP_SECONDS + ph)).sin();
        let flap = (TAU * (FLAP * t + ph)).sin() * (0.35 + 0.65 * glide.max(up));
        [s[0], s[1], px / 400.0, flap]
    });
    let ring_y = hug(scan(t))[0];
    Frame {
        time: t,
        camera,
        blur: blur(t),
        outer,
        runners,
        inner,
        inner_runner,
        shrug: SHRUG_HEIGHT * window(t, SHRUG),
        bell: [belfry[0], belfry[1], light, age],
        train: train(t),
        gulls,
        signs: signs(t, &camera, ring_y),
    }
}

// ---------- the themes

/// The scene's own colours per theme: the cold of the outer ring and the
/// rims, the warm of the inner ring and his signs, the pale of the lamps
/// and the windows.
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

    fn same_angle(a: f32, b: f32, tolerance: f32) -> bool {
        let d = (a - b).rem_euclid(TAU);
        d < tolerance || TAU - d < tolerance
    }

    #[test]
    fn the_loop_closes_without_a_jump() {
        let (a, b) = (compose(0.0), compose(LOOP_SECONDS - 1e-3));
        assert!(distance(a.camera.eye, b.camera.eye) < 1e-3);
        assert!(distance(a.camera.forward, b.camera.forward) < 1e-3);
        assert!(close(a.blur[0], b.blur[0], 1e-3) && close(a.blur[1], b.blur[1], 1e-3));
        assert!(distance(a.outer.centre, b.outer.centre) < 0.05);
        assert!(close(a.outer.radius, b.outer.radius, 0.01));
        assert!(same_angle(a.outer.turn, b.outer.turn, 1e-3));
        assert!(same_angle(a.inner.turn, b.inner.turn, 1e-3));
        assert!(distance(a.inner.centre, b.inner.centre) < 1e-3);
        assert!(close(a.outer.light, b.outer.light, 0.01));
        assert!(close(a.inner.light, b.inner.light, 0.01));
        assert!(close(a.shrug, b.shrug, 1e-4));
        assert!(close(a.bell[2], b.bell[2], 1e-3) && a.bell[2] < 1e-3);
        for (g, h) in a.gulls.iter().zip(&b.gulls) {
            assert!(close(g[0], h[0], 0.01) && close(g[1], h[1], 0.01) && close(g[3], h[3], 0.05));
        }
        assert!(a.train[0] > 5.0 && b.train[0] > 5.0);
        for (s, z) in a.signs.iter().zip(&b.signs).take(SIGN_SLOTS - 1) {
            for i in 0..4 {
                assert!(close(s[i], z[i], 0.02), "{s:?} {z:?}");
            }
        }
        assert!(close(a.signs[8][0], b.signs[8][0], 0.02));
        let beats = heartbeats(LOOP_SECONDS) - heartbeats(0.0);
        assert!(close(beats, beats.round(), 1e-3), "{beats}");
        assert!((FLAP * LOOP_SECONDS).fract() == 0.0);
        assert!((LOOP_SECONDS / LATITUDE_SECONDS).fract() == 0.0);
        assert!((LOOP_SECONDS / SCAN_SECONDS).fract() == 0.0);
        assert!(TURNS.fract() == 0.0 && RACE_TURNS.fract() == 0.0);
        assert_eq!(compose(LOOP_SECONDS), a);
        assert_eq!(compose(f32::NAN), a);
        assert_eq!(compose(-LOOP_SECONDS), a);
    }

    #[test]
    fn the_camera_stays_on_the_pier_clear_of_him_and_sees_him_and_the_city() {
        every(0.02, |t| {
            let c = camera(t);
            let [x, y, z] = c.eye;
            assert!(x < RAIL_X - 0.5 && y > 0.8 && y < 2.0 && z.abs() < PIER_HALF - 1.0, "{t}");
            assert!(solid(to_local(c.eye), 0.0) > 0.8, "{t}");
            let head = c.project(to_world(HEAD)).expect("ahead");
            assert!(head[0].abs() < 1.3 && head[1].abs() < 0.85, "{t}: {head:?}");
            let chest = c.project(to_world(CHEST)).expect("ahead");
            assert!(in_frame(chest), "{t}: {chest:?}");
            // The city lies behind him: the belfry and the bridge's east end.
            for (az, h) in [(TOWER_AZ, BELFRY[1]), (-0.2, 0.04)] {
                let s = c.project_way(city_way(c.eye, az, h)).expect("ahead");
                assert!(in_frame(s), "{t}: {az} {s:?}");
            }
        });
    }

    #[test]
    fn the_first_ring_is_always_in_view_over_the_city_and_turns_visibly() {
        every(0.05, |t| {
            let f = compose(t);
            let seen = (0..360)
                .filter(|&i| {
                    let p = f.outer.at(TAU * i as f32 / 360.0);
                    f.camera.project(p).is_some_and(in_frame)
                })
                .count();
            assert!(seen >= 40, "{t}: {seen}");
            // In front of the far bank, and high over the water.
            let [x, _, z] = f.outer.centre;
            assert!(f.outer.radius + length([x, 0.0, z]) < FAR_BANK - 20.0, "{t}");
            assert!(f.outer.centre[1] - f.camera.eye[1] > 5.0, "{t}");
        });
        // Its runners go round 12 degrees a second; one is always near.
        let w = compose(10.0).outer.turn - compose(9.0).outer.turn;
        assert!(w > 0.2, "{w}");
        every(0.5, |t| {
            let f = compose(t);
            let near = f.runners.iter().filter(|r| r[2] > 0.0 && r[0].abs() < 3.0).count();
            assert!(near >= 1, "{t}");
        });
    }

    #[test]
    fn the_rings_ride_and_scan_and_never_rest() {
        // The first ring rides the sphere up and down, the second scans him
        // crown to feet.
        let lats: Vec<f32> = (0..600).map(|i| latitude(i as f32 * 0.1)).collect();
        let (lo, hi) = lats.iter().fold((9f32, -9f32), |(a, b), &v| (a.min(v), b.max(v)));
        assert!(close(lo, LATITUDE[0], 1e-3) && close(hi, LATITUDE[1], 1e-3));
        assert!(close(hug(scan(SCAN_CROWN))[0], HUG[5][0], 1e-4));
        assert!(close(hug(scan(SCAN_CROWN + 0.5 * SCAN_SECONDS))[0], HUG[0][0], 1e-4));
        every(0.25, |t| {
            let a = compose(t);
            let (mut outer, mut inner) = (0f32, 0f32);
            for k in 1..=8 {
                let b = compose(t + 0.25 * k as f32);
                outer = outer.max(distance(a.outer.centre, b.outer.centre));
                inner = inner.max(distance(a.inner.centre, b.inner.centre));
            }
            assert!(outer > 0.5 && inner > 0.05, "{t}: {outer} {inner}");
            assert!(turn(t + 2.0) - turn(t) > 0.3, "{t}");
            assert!(race(t + 2.0) >= race(t) - 1e-4, "{t}");
        });
    }

    #[test]
    fn the_second_ring_clears_him_and_the_chair() {
        for k in 0..=100 {
            let [y, z, r] = hug(k as f32 / 100.0);
            let ring = Ring::new(to_world([0.0, y, z]), r, to_world(INNER_NORMAL), 0.0, 1.0);
            for i in 0..180 {
                let p = to_local(ring.at(TAU * i as f32 / 180.0));
                for dy in [0.0, SHRUG_HEIGHT] {
                    assert!(solid(p, dy) > 0.012, "{k}: {p:?} {}", solid(p, dy));
                }
            }
        }
    }

    #[test]
    fn the_rings_run_in_step_except_while_he_is_inside() {
        for t in [0.0, 5.0, 15.9, 44.0, 50.0, 59.0] {
            let f = compose(t);
            assert!(same_angle(f.inner.turn, f.outer.turn, 1e-3), "{t}");
        }
        for t in [20.0, 25.0, 30.0, 35.0] {
            let f = compose(t);
            assert!(!same_angle(f.inner.turn, f.outer.turn, 0.3), "{t}");
        }
        // And at the end they pulse together.
        assert!(sync(51.0) > 0.9 && sync(52.5) < 0.1 && sync(10.0) == 0.0);
    }

    #[test]
    fn the_focus_tells_the_story() {
        let sharp = |t: f32| blur(t).iter().all(|&b| b < 0.05);
        for t in [0.0, 2.0, 42.0, 45.0, 50.0, 59.5] {
            assert!(sharp(t), "{t}: {:?}", blur(t));
        }
        // The city sharp and he soft, then the other way round.
        for t in [6.0, 10.0, 15.0] {
            let [n, f] = blur(t);
            assert!(close(n, BLUR[0], 1e-3) && f == 0.0, "{t}");
        }
        for t in [18.0, 25.0, 29.9] {
            let [n, f] = blur(t);
            assert!(n < 1e-3 && close(f, BLUR[1], 1e-3), "{t}");
        }
        // The rack goes back and forth ever faster.
        let mut swings = Vec::new();
        let mut last = focus(RACK[0]).0 - 0.5;
        let mut t = RACK[0];
        while t < 40.0 {
            t += 0.005;
            let now = focus(t).0 - 0.5;
            if (last < 0.0) != (now < 0.0) {
                swings.push(t);
            }
            last = now;
        }
        assert!(swings.len() >= 9, "{swings:?}");
        let gaps: Vec<f32> = swings.windows(2).map(|w| w[1] - w[0]).collect();
        assert!(gaps.windows(2).all(|g| g[1] < g[0] + 1e-3), "{gaps:?}");
        assert!(gaps[0] > 1.2 && *gaps.last().unwrap() < 0.75, "{gaps:?}");
    }

    #[test]
    fn the_bell_rings_when_the_first_ring_passes_the_belfry() {
        let rings = bell_rings();
        assert!(rings.iter().any(|&c| c > 4.5 && c < 15.0), "{rings:?}");
        assert!(rings.iter().any(|&c| c > 46.0), "{rings:?}");
        assert!(rings.windows(2).all(|w| w[1] - w[0] > 2.0), "{rings:?}");
        let mid = 0.5 * (BELFRY[0] + BELFRY[1]);
        for &c in rings {
            assert!(bell(c + 0.3).0 > 0.6 && bell(c - 0.05).0 < bell(c + 0.3).0);
            // The ring is at the belfry as the camera sees it when it rings.
            let f = compose(c);
            let h = ring_height_toward(&f.outer, f.camera.eye, TOWER_AZ);
            assert!(close(h, mid, 0.006), "{c}: {h}");
            assert!(in_frame([f.bell[0], f.bell[1]]), "{c}: {:?}", f.bell);
        }
        assert!(bell(0.0).0 == 0.0 && bell(2.9).0 == 0.0 && bell(59.99).0 < 1e-3);
        // The gulls lift after it.
        let c = rings[0];
        assert!(lift(c + 1.5) > 0.9 && lift(c - 0.1) == 0.0);
    }

    #[test]
    fn the_trains_cross_the_bridge_unseen_at_both_ends() {
        for [a, b, _, _] in TRAINS {
            for t in [a, b] {
                let [head, way] = train(t);
                let tail = head - way * TRAIN_LENGTH;
                let (lo, hi) = (head.min(tail), head.max(tail));
                assert!(hi <= BRIDGE[0] + 1e-4 || lo >= BRIDGE[1] - 1e-4, "{t}: {head} {tail}");
            }
            let [head, _] = train(0.5 * (a + b));
            assert!(head > BRIDGE[0] && head < BRIDGE[1] + TRAIN_LENGTH);
        }
        assert!(train(30.0)[0] > 5.0);
    }

    #[test]
    fn his_signs_live_while_he_is_inside_and_calm_at_the_end() {
        let s = |t: f32| compose(t).signs;
        assert!(s(10.0).iter().skip(4).take(4).all(|v| v[3] == 0.0));
        assert!(s(10.0)[1][3] == 0.0);
        let mid = s(25.0);
        for i in [1, 4, 5, 6, 7] {
            assert!(mid[i][3] > 0.4, "{i}");
        }
        // The thought's words, one after the other, and gone by the end.
        assert!(s(20.0)[3][0] > 0.99 && s(20.0)[3][1] == 0.0);
        assert!(s(30.0)[3][0] == 0.0 && s(30.0)[3][1] > 0.99);
        assert!(s(50.0)[1][3] == 0.0 && s(50.0)[3][1] == 0.0);
        // At ease the sparks die down and the heart slows.
        assert!(s(50.0)[6][3] < 0.4);
        let beats = |a: f32, b: f32| {
            let mut n = 0;
            let mut t = a;
            while t < b {
                if beat(t) > 0.9 && beat(t - 0.01) <= 0.9 {
                    n += 1;
                }
                t += 0.01;
            }
            n as f32 / (b - a)
        };
        assert!(beats(20.0, 40.0) > 1.1 && beats(47.0, 57.0) <= 0.9);
        // The signs sit on him, the thought over him, all in the frame.
        every(0.1, |t| {
            let f = compose(t);
            let [bx, by, size, _] = f.signs[1];
            assert!(bx.abs() + 1.25 * size < FRAME_ASPECT && by.abs() + 0.84 * size < 1.0, "{t}");
            for i in [4, 5, 6, 7] {
                let [x, y, _, _] = f.signs[i];
                assert!(in_frame([x, y]), "{t}: {i}");
            }
        });
        // His shoulders go up while he forces it.
        assert!(compose(36.0).shrug > 0.03 && compose(20.0).shrug == 0.0 && compose(50.0).shrug == 0.0);
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
            assert!(distance(a.camera.forward, b.camera.forward) < 0.01, "{t}");
            assert!((a.blur[0] - b.blur[0]).abs() < 1.2, "{t}");
            assert!((a.blur[1] - b.blur[1]).abs() < 1.2, "{t}");
            assert!(distance(a.outer.centre, b.outer.centre) < 0.3, "{t}");
            assert!(distance(a.inner.centre, b.inner.centre) < 0.01, "{t}");
            assert!((a.inner.turn - b.inner.turn).abs() < 0.05, "{t}");
            assert!((a.outer.light - b.outer.light).abs() < 0.05, "{t}");
            assert!((a.bell[2] - b.bell[2]).abs() < 0.25, "{t}");
            assert!((a.shrug - b.shrug).abs() < 0.001, "{t}");
            for (g, h) in a.gulls.iter().zip(&b.gulls) {
                assert!((g[1] - h[1]).abs() < 0.01, "{t}");
            }
            for (s, z) in a.signs.iter().zip(&b.signs).take(8) {
                assert!((s[3] - z[3]).abs() < 0.06, "{t}");
            }
        });
    }

    #[test]
    fn the_still_frame_is_both_layers_sharp_and_him_at_ease() {
        let f = compose(STILL);
        assert!(f.blur.iter().all(|&b| b == 0.0));
        assert!(f.shrug == 0.0 && f.signs[1][3] == 0.0 && f.signs[4][3] > 0.4);
        assert!(same_angle(f.inner.turn, f.outer.turn, 1e-3));
        assert!(f.camera.project(to_world(HEAD)).is_some_and(in_frame));
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
    fn the_frames_are_the_world_turned() {
        let p = [0.3, 1.0, -0.7];
        assert!(distance(to_local(to_world(p)), p) < 1e-6);
        // He faces away from the city (+x).
        assert!(to_world([0.0, 0.0, 1.0])[0] < -0.5);
    }
}
