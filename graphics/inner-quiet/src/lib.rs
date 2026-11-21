//! «Тише шума», page 09 of Step 6 «Внутреннее кольцо», direction Б
//! «Ландшафт звука». A man in his own clothes stands in a landscape drawn
//! as lines of sound, a spectrogram seen from inside: row after row of
//! glowing lines over a dark land. The noise of his inside rises out of it as
//! jagged spikes, and every phrase is one spike with its sign on top: a
//! thought bubble with lines of words, a chain of older bubbles back to the
//! horizon, a heart with its pulse riding a swell, a bolt of impulse, a
//! whirlpool of urge. He does not follow any of them; the warm second ring
//! notices each one (warm brackets close on it) and it sinks back into the
//! land. Then the camera comes close and his inside shows the same lines as
//! the land, sharp; both rings light up and the space gets its levels; the
//! old noise goes quiet, the land lies flat, and one calm sine ridge runs
//! through his soles while a tone rises up through his form.
//!
//! «Не вовлекайся во внутреннее содержание»: a thought spike rises beside
//! him, its bubble fills with words and sends a dotted strand toward his
//! head; it never reaches him, the warm brackets notice it, it sinks.
//! «Не анализируй историю мысли»: a bubble, and behind it older bubbles
//! light up one by one back to the horizon; noticed, the chain unravels from
//! its far end.
//! «Не отталкивай эмоцию и не проваливайся в нее»: a swell rolls through the
//! land with a heart over its crest; it lifts him and passes on; he neither
//! cuts it nor sinks.
//! «Замечай — но не обуславливайся»: a bolt, a whirlpool, a bubble; each is
//! noticed and sinks; he stays as he is.
//! «Второй уровень…»: close on him: the lines inside him go from a blur to
//! as sharp as the land's.
//! «Когда оба кольца активны…»: the camera cranes up; both rings brighten,
//! the sphere shows its levels, the land a precise grid.
//! «…тише становится старый ментальный шум…»: the land flattens.
//! «…яснее звучит потенциальность Присутствия через твою форму»: one sine
//! ridge through his soles, a tone up through his body into the sky.
//!
//! Every value here is a pure function of loop time; `browser.rs` uploads it
//! and the shaders draw the sky, the land, him, the sphere, the curves (both
//! rings, the strands, the tone) and the signs, then bloom and the page.
//! Unit: metres. He stands at the origin facing the camera (-z); his soles
//! are at y = `lift` (the swell lifts him), the land's rows run along x.

use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerQuiet;

pub type V = [f32; 3];

pub const LOOP_SECONDS: f32 = 70.0;
/// The frame: 3:2.
pub const FRAME_ASPECT: f32 = 1.5;
/// Reduced motion's moment: the land quiet, the ridge through his soles, the
/// tone up his body, both rings round him.
pub const STILL: f32 = 68.0;
/// Where each phrase's beat starts (s): the noise rising, then the page's
/// phrases in order.
pub const BEATS: [f32; 10] = [0.0, 4.0, 12.0, 20.0, 29.0, 37.0, 46.0, 54.0, 57.0, 63.0];

// ---------- the land

/// Half its width (m) and its near and far edges.
pub const LAND_X: f32 = 40.0;
pub const LAND_Z: [f32; 2] = [-7.0, 60.0];
/// Its strips crowd near the camera: z = near + (far - near) s^POW; its
/// columns crowd round him: x = LAND_X (0.25 u + 0.75 u^3), u -1..1.
pub const LAND_POW: f32 = 1.6;
pub const COLUMNS: u32 = 560;
pub const STRIPS: u32 = 420;
/// One line of sound every ROW metres along z; the grid's lines along x.
pub const ROW: f32 = 0.2;
pub const GRID: f32 = 0.6;
/// The calm round him (m): no noise inside the first radius, all of it past
/// the second.
pub const CALM: [f32; 2] = [1.1, 3.2];
/// The old noise at its loudest (m), and how fast it flows toward him (m/s).
pub const NOISE_HEIGHT: f32 = 0.5;
pub const NOISE_FLOW: f32 = 0.45;
/// The calm sine ridge through his soles: its height (m), its wavenumber
/// (rad/m), the time a crest takes to pass (s, a whole number a loop).
pub const RIDGE_WAVE: [f32; 3] = [0.13, 2.2, 2.0];
/// The lines inside him (m apart).
pub const INNER_ROW: f32 = 0.05;
/// The bloom: how much, its blur (px of an 800 px high frame).
pub const BLOOM: [f32; 2] = [0.45, 8.0];
/// How loud the old noise is.
pub const NOISE: [(f32, [f32; 1]); 8] = [
    (0.0, [0.0]),
    (4.0, [1.0]),
    (37.0, [1.0]),
    (44.0, [0.75]),
    (54.0, [0.55]),
    (57.5, [0.5]),
    (62.5, [0.0]),
    (70.0, [0.0]),
];
/// The ridge through his soles: off by `RIDGE[1]`, back from `RIDGE[2]` to
/// `RIDGE[3]`.
pub const RIDGE: [f32; 4] = [0.0, 3.5, 63.5, 67.0];
/// The precise grid and the sphere's levels: «оба кольца активны».
pub const GRID_ON: [f32; 4] = [47.0, 49.5, 53.5, 56.5];
pub const LEVELS_ON: [f32; 4] = [46.8, 49.0, 53.5, 56.5];
pub const RINGS_BRIGHT: [f32; 4] = [46.5, 48.5, 53.0, 55.5];

// ---------- the swell of emotion

/// Its window (s): it rolls from `SWELL_PATH[0]` to `SWELL_PATH[1]` (z)
/// between the window's ends.
pub const SWELL: [f32; 4] = [20.5, 22.5, 26.5, 28.5];
pub const SWELL_PATH: [f32; 2] = [15.0, -10.0];
pub const SWELL_HEIGHT: f32 = 0.75;
/// Its crest's half width along z, and across x.
pub const SWELL_WIDTH: f32 = 2.4;
pub const SWELL_SPAN: f32 = 10.0;

// ---------- him

/// The figure card (m): width, height, how far it reaches below his soles,
/// its shift along x so his middle stands at x = 0 (figure.png: 1024 x 1536
/// px, him 1366 px from crown to soles, centred at 502 px).
pub const CARD: [f32; 4] = [1.3494, 2.024, 0.1291, 0.0132];
pub const CROWN: f32 = 1.8;
pub const HEAD: f32 = 1.68;
pub const WAIST: f32 = 1.0;

// ---------- the sphere and the rings

/// The sphere round him: its centre over his soles, its radius.
pub const SPHERE: [f32; 2] = [1.0, 2.3];
/// The first ring, cold, level: sweeps the sphere from near its crown
/// (latitude, rad) down to just over the land and back every
/// `SWEEP_SECONDS`, as on page 08.
pub const SWEEP: [f32; 2] = [1.2, -0.4];
pub const SWEEP_SECONDS: f32 = 10.0;
/// The second ring, warm: scans his body (m over his soles) up and down
/// every `SCAN_SECONDS`.
pub const SCAN: [f32; 2] = [0.35, 1.75];
pub const SCAN_SECONDS: f32 = 10.0;
/// Turns of each ring's runner a loop.
pub const RUNS: [f32; 2] = [5.0, -7.0];
/// Line widths (px of an 800 px high frame).
pub const WIDTHS: [f32; 4] = [1.6, 2.1, 1.5, 1.3];
/// The tone up his body: how high it reaches over his soles, when it rises,
/// how long each pulse takes to run up.
pub const TONE_TOP: f32 = 3.9;
pub const TONE: [f32; 4] = [0.0, 2.5, 64.5, 67.5];
pub const TONE_PULSE: f32 = 2.5;

// ---------- the signs

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    /// A thought: a cloud with lines of words, small bubbles under it.
    Bubble = 0,
    /// An emotion: a heart with its pulse.
    Heart = 1,
    /// An impulse: a bolt.
    Bolt = 2,
    /// An urge: a whirlpool.
    Whirl = 3,
}

/// A sign on its spike: where the spike stands (x, z), its height and
/// radius, the sign's size, when it rises (from, to) and sinks (from, to),
/// when the warm ring notices it.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Sign {
    pub kind: Kind,
    pub at: [f32; 2],
    pub spike: [f32; 2],
    pub size: f32,
    pub life: [f32; 4],
    pub notice: Option<f32>,
}

const fn sign(
    kind: Kind,
    at: [f32; 2],
    spike: [f32; 2],
    size: f32,
    life: [f32; 4],
    notice: Option<f32>,
) -> Sign {
    Sign {
        kind,
        at,
        spike,
        size,
        life,
        notice,
    }
}

pub const SIGN_COUNT: usize = 10;
/// The heart rides the swell: its z follows the crest.
pub const HEART: usize = 6;
pub const SIGNS: [Sign; SIGN_COUNT] = [
    // «Не вовлекайся во внутреннее содержание».
    sign(
        Kind::Bubble,
        [-2.1, 1.3],
        [1.55, 0.95],
        0.62,
        [4.5, 6.6, 10.4, 12.0],
        Some(9.2),
    ),
    // «Не анализируй историю мысли»: the bubble, and its story back to the
    // horizon, sinking from the far end.
    sign(
        Kind::Bubble,
        [2.0, 1.8],
        [1.45, 1.0],
        0.6,
        [12.4, 14.0, 18.6, 20.0],
        Some(17.0),
    ),
    sign(
        Kind::Bubble,
        [3.4, 5.2],
        [1.1, 0.9],
        0.5,
        [14.2, 15.0, 18.1, 19.1],
        None,
    ),
    sign(
        Kind::Bubble,
        [4.9, 9.4],
        [1.0, 0.9],
        0.46,
        [15.0, 15.8, 17.8, 18.8],
        None,
    ),
    sign(
        Kind::Bubble,
        [6.7, 14.6],
        [0.95, 0.9],
        0.44,
        [15.8, 16.6, 17.5, 18.4],
        None,
    ),
    sign(
        Kind::Bubble,
        [8.8, 21.0],
        [0.9, 0.9],
        0.42,
        [16.6, 17.2, 17.3, 18.1],
        None,
    ),
    // «Не отталкивай эмоцию и не проваливайся в нее».
    sign(
        Kind::Heart,
        [1.25, 0.0],
        [0.0, 0.0],
        0.55,
        [21.5, 22.5, 25.0, 26.0],
        Some(23.8),
    ),
    // «Замечай — но не обуславливайся».
    sign(
        Kind::Bolt,
        [-2.4, 0.9],
        [1.35, 0.95],
        0.5,
        [29.6, 30.1, 31.6, 32.6],
        Some(30.6),
    ),
    sign(
        Kind::Whirl,
        [2.5, 1.2],
        [1.4, 1.1],
        0.55,
        [31.4, 33.0, 34.6, 36.0],
        Some(33.5),
    ),
    sign(
        Kind::Bubble,
        [-1.1, 4.4],
        [1.2, 1.0],
        0.5,
        [33.2, 34.2, 35.6, 36.6],
        Some(34.8),
    ),
];
/// How high over its spike's tip a sign stands (m), and the heart over the
/// swell's crest.
pub const SIGN_GAP: f32 = 0.1;
pub const HEART_OVER: f32 = 1.25;
/// The dotted strand from the first thought toward his head: when it
/// reaches out, how far it gets (never all the way), when it fades.
pub const STRAND: [f32; 4] = [6.9, 9.0, 9.5, 10.5];
pub const STRAND_REACH: f32 = 0.8;

/// Curves: the first ring, the second, the tone, the strand, the four links
/// of the thought's story.
pub const CURVES: usize = 8;
pub const CURVE_SEGMENTS: u32 = 128;
/// The sphere's mesh.
pub const SPHERE_LON: u32 = 72;
pub const SPHERE_LAT: u32 = 36;

// ---------- the camera: eye xyz, target xyz, vertical field (deg), a
// cyclic curve through the loop

pub const CAMERA: [(f32, [f32; 7]); 16] = [
    (0.0, [0.0, 1.0, -7.0, 0.0, 1.15, 0.0, 38.0]),
    (4.0, [0.4, 1.1, -6.6, -0.3, 1.25, 0.2, 38.0]),
    (7.5, [1.4, 1.45, -6.0, -0.8, 1.6, 0.7, 38.0]),
    (11.0, [1.6, 1.5, -5.6, -0.7, 1.55, 0.7, 38.0]),
    (14.5, [3.3, 1.7, -5.6, 1.3, 1.5, 4.0, 40.0]),
    (18.5, [3.6, 1.8, -5.4, 1.6, 1.5, 4.5, 40.0]),
    (22.0, [1.0, 1.5, -4.6, 0.5, 1.4, 0.5, 38.0]),
    (27.0, [0.8, 1.55, -4.3, 0.4, 1.4, 0.0, 38.0]),
    (30.5, [0.0, 1.65, -6.9, 0.0, 1.5, 0.9, 40.0]),
    (35.5, [-0.4, 1.6, -6.7, 0.0, 1.5, 0.9, 40.0]),
    (39.5, [0.3, 1.4, -3.4, 0.0, 1.25, 0.0, 36.0]),
    (45.0, [0.2, 1.38, -3.1, 0.0, 1.25, 0.0, 36.0]),
    (50.0, [-2.0, 4.0, -8.8, 0.0, 1.0, 0.5, 40.0]),
    (54.5, [-1.6, 4.4, -9.6, 0.0, 0.9, 0.5, 40.0]),
    (58.0, [-0.8, 3.8, -10.2, 0.0, 0.95, 0.5, 40.0]),
    (63.5, [0.0, 2.2, -9.6, 0.0, 1.1, 0.0, 38.0]),
];

// ---------- the inside of him

/// How sharp the lines inside him are, and how bright.
pub const SHARP: [(f32, [f32; 1]); 5] = [
    (0.0, [1.0]),
    (3.5, [0.15]),
    (38.0, [0.15]),
    (42.5, [1.0]),
    (70.0, [1.0]),
];
pub const INNER_LIGHT: [(f32, [f32; 1]); 6] = [
    (0.0, [0.6]),
    (3.5, [0.3]),
    (38.0, [0.3]),
    (42.5, [1.0]),
    (63.0, [1.0]),
    (70.0, [0.6]),
];

// ---------- small math

pub fn add(a: V, b: V) -> V {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
pub fn sub(a: V, b: V) -> V {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
pub fn scale(a: V, s: f32) -> V {
    [a[0] * s, a[1] * s, a[2] * s]
}
pub fn dot(a: V, b: V) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
pub fn cross(a: V, b: V) -> V {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
pub fn length(a: V) -> f32 {
    dot(a, a).sqrt()
}
pub fn norm(a: V) -> V {
    scale(a, 1.0 / length(a).max(1e-6))
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
fn window(t: f32, [a, b, c, d]: [f32; 4]) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

fn wrap(t: f32) -> f32 {
    if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    }
}

/// Keys joined by smoothsteps: never past a key, still at every key.
fn eased<const N: usize>(keys: &[(f32, [f32; N])], t: f32) -> [f32; N] {
    let n = keys.len();
    let t = t.clamp(keys[0].0, keys[n - 1].0);
    let i = (0..n - 1).rev().find(|&j| keys[j].0 <= t).unwrap_or(0);
    let s = smooth(keys[i].0, keys[i + 1].0, t);
    std::array::from_fn(|c| keys[i].1[c] + (keys[i + 1].1[c] - keys[i].1[c]) * s)
}

/// A smooth closed curve through keys over the loop (the first key at 0,
/// the last joined back to it): cubic Hermite pieces whose tangents never
/// overshoot a key (a slope is 0 where the curve turns, and at most three
/// times either neighbouring chord).
fn cyclic<const N: usize>(keys: &[(f32, [f32; N])], t: f32) -> [f32; N] {
    let n = keys.len() as isize;
    let t = wrap(t);
    let time = |j: isize| keys[j.rem_euclid(n) as usize].0 + LOOP_SECONDS * j.div_euclid(n) as f32;
    let value = |j: isize, c: usize| keys[j.rem_euclid(n) as usize].1[c];
    let i = (0..n).rev().find(|&j| time(j) <= t).unwrap_or(0);
    let slope = |j: isize, c: usize| {
        let before = (value(j, c) - value(j - 1, c)) / (time(j) - time(j - 1));
        let after = (value(j + 1, c) - value(j, c)) / (time(j + 1) - time(j));
        if before * after <= 0.0 {
            return 0.0;
        }
        let m = (value(j + 1, c) - value(j - 1, c)) / (time(j + 1) - time(j - 1));
        let limit = 3.0 * before.abs().min(after.abs());
        m.clamp(-limit, limit)
    };
    let (t1, t2) = (time(i), time(i + 1));
    let h = t2 - t1;
    let s = (t - t1) / h;
    let (s2, s3) = (s * s, s * s * s);
    std::array::from_fn(|c| {
        (2.0 * s3 - 3.0 * s2 + 1.0) * value(i, c)
            + (s3 - 2.0 * s2 + s) * h * slope(i, c)
            + (3.0 * s2 - 2.0 * s3) * value(i + 1, c)
            + (s3 - s2) * h * slope(i + 1, c)
    })
}

// ---------- the land under him

/// The swell's height, its crest's z.
pub fn swell(t: f32) -> (f32, f32) {
    let t = wrap(t);
    let s = ((t - SWELL[0]) / (SWELL[3] - SWELL[0])).clamp(0.0, 1.0);
    let z = SWELL_PATH[0] + (SWELL_PATH[1] - SWELL_PATH[0]) * s;
    (SWELL_HEIGHT * window(t, SWELL), z)
}

/// The swell at a point of the land (the same sum as `land.vert`).
pub fn swell_at(t: f32, x: f32, z: f32) -> f32 {
    let (height, crest) = swell(t);
    height * (-((z - crest) / SWELL_WIDTH).powi(2)).exp() * (-(x / SWELL_SPAN).powi(2)).exp()
}

/// How high his soles stand: the land is calm under him, so only the swell
/// lifts him.
pub fn lift(t: f32) -> f32 {
    swell_at(t, 0.0, 0.0)
}

pub fn noise(t: f32) -> f32 {
    eased(&NOISE, wrap(t))[0]
}

pub fn ridge(t: f32) -> f32 {
    let t = wrap(t);
    (1.0 - smooth(RIDGE[0], RIDGE[1], t)) + smooth(RIDGE[2], RIDGE[3], t)
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
        let right = norm(cross([0.0, 1.0, 0.0], forward));
        let up = cross(forward, right);
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
        (z > 0.05).then(|| {
            [
                dot(v, self.right) / (z * self.lens),
                dot(v, self.up) / (z * self.lens),
            ]
        })
    }
}

pub fn camera(t: f32) -> Camera {
    let [ex, ey, ez, tx, ty, tz, fov] = cyclic(&CAMERA, t);
    let lift = lift(t);
    Camera::toward([ex, ey + 0.6 * lift, ez], [tx, ty + lift, tz], fov)
}

// ---------- the rings

/// The first ring: its height (m) and radius, on the sphere.
pub fn outer(t: f32) -> (f32, f32) {
    let t = wrap(t);
    let [top, bottom] = SWEEP;
    let latitude = top + (bottom - top) * (0.5 - 0.5 * (TAU * t / SWEEP_SECONDS).cos());
    let [centre, radius] = SPHERE;
    (
        lift(t) + centre + radius * latitude.sin(),
        radius * latitude.cos(),
    )
}

/// Where the second ring scans him (m over his soles).
pub fn scan(t: f32) -> f32 {
    let m = 0.5 * (SCAN[0] + SCAN[1]);
    let a = 0.5 * (SCAN[1] - SCAN[0]);
    m - a * (TAU * wrap(t) / SCAN_SECONDS).cos()
}

/// The second ring's radius at a height over his soles: round his legs,
/// wider round his chest and arms, closer round his head.
pub fn girth(h: f32) -> f32 {
    0.27 + 0.07 * smooth(0.9, 1.35, h) - 0.08 * smooth(1.5, 1.65, h)
}

// ---------- the signs

/// A sign this moment: where its spike's tip is, its spike's height, how
/// much of it shows, how warm the notice has made it, the warm brackets'
/// light and size, its own motion (the words written, the pulse, the turn).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Shown {
    pub tip: V,
    pub height: f32,
    pub light: f32,
    pub warmth: f32,
    pub brackets: [f32; 2],
    pub motion: f32,
}

pub fn shown(i: usize, t: f32) -> Shown {
    let t = wrap(t);
    let s = &SIGNS[i];
    let [r0, r1, f0, f1] = s.life;
    let grown = smooth(r0, r1, t) * (1.0 - smooth(f0, f1, t));
    let light = smooth(r0 + 0.55 * (r1 - r0), r1, t) * (1.0 - smooth(f0, f0 + 0.5 * (f1 - f0), t));
    let (x, z) = if i == HEART {
        (s.at[0], swell(t).1)
    } else {
        (s.at[0], s.at[1])
    };
    let base = swell_at(t, x, z);
    let height = s.spike[0] * grown;
    let y = if i == HEART {
        base + HEART_OVER
    } else {
        base + height + SIGN_GAP
    };
    let (warmth, brackets) = match s.notice {
        Some(n) => (
            0.85 * window(t, [n + 0.1, n + 0.5, f0, f1]),
            [
                window(t, [n, n + 0.25, n + 1.3, n + 1.9]),
                1.75 - 0.55 * smooth(n, n + 0.55, t),
            ],
        ),
        None => (0.0, [0.0, 1.0]),
    };
    let motion = match s.kind {
        Kind::Bubble => smooth(r1 - 0.2, r1 + 0.9, t),
        Kind::Heart => t * 0.9,
        Kind::Bolt => t,
        Kind::Whirl => -2.2 * t,
    };
    Shown {
        tip: [x, y, z],
        height,
        light,
        warmth,
        brackets,
        motion,
    }
}

/// The middle of a sign's picture (its cloud, heart, bolt or whirl).
pub fn sign_middle(i: usize, t: f32) -> V {
    let s = shown(i, t);
    add(s.tip, [0.0, 0.95 * SIGNS[i].size, 0.0])
}

// ---------- the frame

/// Everything one moment needs.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    pub lift: f32,
    /// The noise, the ridge, the grid, the sphere's levels.
    pub land: [f32; 4],
    /// The swell's height, its crest's z, its width, its span.
    pub swell: [f32; 4],
    /// Per spike: x, z, height, radius; then its warmth.
    pub spikes: [[f32; 4]; SIGN_COUNT * 2],
    /// Inside him: the noise, sharpness, light, the second ring's height.
    pub inner: [f32; 4],
    /// The sphere: its centre's height, radius, light.
    pub sphere: [f32; 4],
    /// Per curve: (a, b, style, span) — see `ring_curve` and `segment`.
    pub curves: [[f32; 4]; CURVES * 4],
    /// Per sign: (tip, size), (kind, light, warmth, motion), (brackets'
    /// light, their size, 0, 0).
    pub signs: [[f32; 4]; SIGN_COUNT * 3],
}

/// A level ring: its centre and radius; style: width (px800), light,
/// warmth (0 cold, 1 warm), dashes per metre; its runner's place (0..1)
/// and which way it runs (±1).
fn ring_curve(centre: V, radius: f32, style: [f32; 4], run: f32, t: f32) -> [[f32; 4]; 4] {
    let [x, y, z] = centre;
    [
        [x, y, z, radius],
        [0.0, 0.0, 0.0, 0.0],
        style,
        [
            0.0,
            1.0,
            (run * t / LOOP_SECONDS).rem_euclid(1.0),
            run.signum(),
        ],
    ]
}

/// A bowed segment from `a` to `b`, its middle raised by `sag`; drawn over
/// `span` of its length, with a pulse running at `pulse` (<0: none).
fn segment(a: V, b: V, sag: f32, style: [f32; 4], span: [f32; 2], pulse: f32) -> [[f32; 4]; 4] {
    [
        [a[0], a[1], a[2], sag],
        [b[0], b[1], b[2], 1.0],
        style,
        [span[0], span[1], pulse, 0.0],
    ]
}

/// A curve that draws nothing.
const NONE: [[f32; 4]; 4] = [[0.0; 4]; 4];

pub fn compose(t: f32) -> Frame {
    let t = wrap(t);
    let camera = camera(t);
    let lift = lift(t);
    let (height, crest) = swell(t);
    let bright = window(t, RINGS_BRIGHT);

    let mut spikes = [[0.0; 4]; SIGN_COUNT * 2];
    let mut signs = [[0.0; 4]; SIGN_COUNT * 3];
    let shows: [Shown; SIGN_COUNT] = std::array::from_fn(|i| shown(i, t));
    for (i, (s, sh)) in SIGNS.iter().zip(shows.iter()).enumerate() {
        spikes[2 * i] = [sh.tip[0], sh.tip[2], sh.height, s.spike[1]];
        spikes[2 * i + 1] = [sh.warmth, 0.0, 0.0, 0.0];
        let [x, y, z] = sh.tip;
        signs[3 * i] = [x, y, z, s.size];
        signs[3 * i + 1] = [s.kind as u8 as f32, sh.light, sh.warmth, sh.motion];
        signs[3 * i + 2] = [sh.brackets[0], sh.brackets[1], 0.0, 0.0];
    }

    let mut curves = [[0.0; 4]; CURVES * 4];
    let mut put = |k: usize, c: [[f32; 4]; 4]| curves[4 * k..4 * k + 4].copy_from_slice(&c);

    // The first ring, cold, sweeping the sphere; the second, warm, scanning him.
    let (y, r) = outer(t);
    let light = 0.85 + 0.5 * bright;
    put(
        0,
        ring_curve([0.0, y, 0.0], r, [WIDTHS[0], light, 0.0, 0.0], RUNS[0], t),
    );
    let h = scan(t);
    put(
        1,
        ring_curve(
            [0.0, lift + h, 0.0],
            girth(h),
            [WIDTHS[1], light, 1.0, 0.0],
            RUNS[1],
            t,
        ),
    );

    // The tone up through his form, a little nearer the camera than him.
    let toward = norm([-camera.forward[0], 0.0, -camera.forward[2]]);
    let foot = add([0.0, lift, 0.0], scale(toward, 0.12));
    let tone_light = (1.0 - smooth(TONE[0], TONE[1], t)) + smooth(TONE[2], TONE[2] + 0.5, t);
    let tone_reach = if t > 30.0 {
        smooth(TONE[2], TONE[3], t)
    } else {
        1.0
    };
    if tone_light > 0.0 {
        put(
            2,
            segment(
                foot,
                add(foot, [0.0, TONE_TOP, 0.0]),
                0.0,
                [WIDTHS[2], 0.9 * tone_light, 0.35, 0.0],
                [0.0, tone_reach],
                (t / TONE_PULSE).rem_euclid(1.0),
            ),
        );
    } else {
        put(2, NONE);
    }

    // The strand of the first thought, reaching toward his head.
    let strand = window(t, [STRAND[0], STRAND[0] + 0.4, STRAND[2], STRAND[3]]);
    if strand > 0.0 {
        let from = add(sign_middle(0, t), [0.25 * SIGNS[0].size, 0.0, 0.0]);
        put(
            3,
            segment(
                from,
                [0.0, lift + HEAD, 0.0],
                0.25,
                [WIDTHS[3], 0.9 * strand, 0.0, 14.0],
                [0.0, STRAND_REACH * smooth(STRAND[0], STRAND[1], t)],
                -1.0,
            ),
        );
    } else {
        put(3, NONE);
    }

    // The thought's story: a dotted link to each older bubble.
    for j in 0..4 {
        let (a, b) = (1 + j, 2 + j);
        let light = shows[a].light.min(shows[b].light);
        let [r0, r1, _, _] = SIGNS[b].life;
        if light > 0.0 {
            put(
                4 + j,
                segment(
                    sign_middle(a, t),
                    sign_middle(b, t),
                    0.3,
                    [WIDTHS[3], 0.8 * light, 0.0, 6.0],
                    [0.0, smooth(r0, r1, t)],
                    -1.0,
                ),
            );
        } else {
            put(4 + j, NONE);
        }
    }

    let sharp = eased(&SHARP, t)[0];
    let noise = noise(t);
    Frame {
        time: t,
        camera,
        lift,
        land: [
            noise,
            ridge(t),
            0.55 * window(t, GRID_ON),
            window(t, LEVELS_ON),
        ],
        swell: [height, crest, SWELL_WIDTH, SWELL_SPAN],
        spikes,
        inner: [0.85 * noise, sharp, eased(&INNER_LIGHT, t)[0], h],
        sphere: [lift + SPHERE[0], SPHERE[1], 0.9 + 0.4 * bright, 0.0],
        curves,
        signs,
    }
}

// ---------- the theme's colours

/// The theme's colours: the cold line (the land, him, the first ring), the
/// warm (the second ring, the notice), a pale one, a black page's own dusk,
/// the air's glow.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub cold: [f32; 3],
    pub warm: [f32; 3],
    pub pale: [f32; 3],
    pub dusk: [f32; 3],
    pub sky: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

pub fn look(code: u32) -> Look {
    match Palette::from_code(code) {
        // Искра: the yellow of the theme, an ember warmth, an ember dark.
        Palette::Dark => Look {
            cold: rgb(245, 221, 7),
            warm: rgb(255, 122, 40),
            pale: rgb(255, 244, 170),
            dusk: rgb(21, 14, 8),
            sky: rgb(255, 120, 36),
        },
        // Астрал: the blue of the theme, a rose-peach warmth.
        Palette::Violet => Look {
            cold: rgb(98, 150, 245),
            warm: rgb(240, 158, 128),
            pale: rgb(200, 212, 248),
            dusk: [0.0; 3],
            sky: rgb(98, 150, 245),
        },
        // Матрица: code green, amber; a green-black dark.
        Palette::Matrix => Look {
            cold: rgb(0, 255, 65),
            warm: rgb(255, 184, 64),
            pale: rgb(190, 255, 205),
            dusk: rgb(4, 17, 9),
            sky: rgb(0, 255, 65),
        },
        // Тишина: sea glass, warm sand.
        _ => Look {
            cold: rgb(134, 201, 199),
            warm: rgb(242, 179, 117),
            pale: rgb(214, 218, 210),
            dusk: [0.0; 3],
            sky: rgb(134, 201, 199),
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

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    #[test]
    fn the_loop_has_no_seam() {
        let (a, b) = (compose(0.0), compose(LOOP_SECONDS - 1e-3));
        for k in 0..3 {
            assert!(close(a.camera.eye[k], b.camera.eye[k], 1e-2));
            assert!(close(a.camera.forward[k], b.camera.forward[k], 1e-2));
        }
        for k in 0..4 {
            assert!(close(a.land[k], b.land[k], 1e-2), "land {k}");
            assert!(close(a.inner[k], b.inner[k], 1e-2), "inner {k}");
            assert!(close(a.sphere[k], b.sphere[k], 1e-2), "sphere {k}");
        }
        for (x, y) in a.curves.iter().zip(b.curves.iter()) {
            for k in 0..4 {
                // A runner's place may wrap from 1 to 0.
                let d = (x[k] - y[k]).abs();
                assert!(d < 2e-2 || (d - 1.0).abs() < 2e-2, "{x:?} {y:?}");
            }
        }
        // The camera glides through the seam: no jump in its speed.
        let v0 = sub(camera(0.05).eye, camera(0.0).eye);
        let v1 = sub(camera(0.0).eye, camera(LOOP_SECONDS - 0.05).eye);
        assert!(length(sub(v0, v1)) < 2e-3);
    }

    #[test]
    fn the_rings_turn_a_whole_number_of_times_a_loop() {
        for period in [SWEEP_SECONDS, SCAN_SECONDS, TONE_PULSE, RIDGE_WAVE[2]] {
            let n = LOOP_SECONDS / period;
            assert!(close(n, n.round(), 1e-4), "{period}");
        }
        for run in RUNS {
            assert!(close(run, run.round(), 1e-6));
        }
    }

    #[test]
    fn the_first_ring_rides_the_sphere_and_the_second_his_body() {
        every(0.1, |t| {
            let (y, r) = outer(t);
            let dy = y - (lift(t) + SPHERE[0]);
            assert!(close(dy * dy + r * r, SPHERE[1] * SPHERE[1], 1e-3));
            assert!(
                y > lift(t) + 0.05,
                "the first ring stays over the land at {t}"
            );
            let h = scan(t);
            assert!((SCAN[0] - 1e-4..=SCAN[1] + 1e-4).contains(&h));
            assert!((0.18..0.36).contains(&girth(h)));
        });
        // Both always move.
        every(0.5, |t| {
            assert!(outer(t) != outer(t + 0.25), "{t}");
            assert!(!close(scan(t), scan(t + 0.25), 1e-4), "{t}");
        });
    }

    #[test]
    fn he_stays_in_the_frame() {
        every(0.05, |t| {
            let c = camera(t);
            let l = lift(t);
            for (h, margin) in [(CROWN + 0.05, 0.97), (WAIST, 0.9)] {
                let [x, y] = c.project([0.0, l + h, 0.0]).expect("in front");
                assert!(
                    x.abs() < FRAME_ASPECT * margin && y.abs() < margin,
                    "{t} {h}: {x} {y}"
                );
            }
            let close_up = (38.5..47.0).contains(&t);
            if !close_up {
                let [x, y] = c.project([0.0, l, 0.0]).expect("in front");
                assert!(
                    x.abs() < FRAME_ASPECT && y.abs() < 0.97,
                    "{t} soles: {x} {y}"
                );
            }
        });
    }

    #[test]
    fn every_sign_is_seen_while_it_shows() {
        every(0.05, |t| {
            let c = camera(t);
            for i in 0..SIGN_COUNT {
                let s = shown(i, t);
                if s.light < 0.4 {
                    continue;
                }
                let [x, y] = c.project(sign_middle(i, t)).expect("in front");
                assert!(
                    x.abs() < 0.95 * FRAME_ASPECT && y.abs() < 0.95,
                    "sign {i} at {t}: {x} {y}"
                );
            }
        });
    }

    #[test]
    fn no_spike_rises_in_the_calm_round_him() {
        for (i, s) in SIGNS.iter().enumerate() {
            if i == HEART {
                continue;
            }
            let d = (s.at[0] * s.at[0] + s.at[1] * s.at[1]).sqrt();
            assert!(d - s.spike[1] >= 1.5, "sign {i}");
            assert!(s.life[0] < s.life[1] && s.life[1] <= s.life[2] && s.life[2] < s.life[3]);
        }
    }

    #[test]
    fn each_sign_lives_in_its_phrase() {
        let beat_of = |t: f32| BEATS.iter().rposition(|&b| b <= t).unwrap();
        for s in SIGNS {
            assert_eq!(beat_of(s.life[0]), beat_of(s.life[3] - 0.01), "{s:?}");
            if let Some(n) = s.notice {
                assert!(s.life[1] <= n && n < s.life[2] + 0.5, "{s:?}");
            }
        }
    }

    #[test]
    fn the_swell_lifts_him_only_while_it_passes() {
        every(0.05, |t| {
            let l = lift(t);
            assert!((0.0..=SWELL_HEIGHT).contains(&l));
            if !(SWELL[0]..SWELL[3]).contains(&t) {
                assert_eq!(l, 0.0, "{t}");
            }
        });
        assert!(lift(25.5) > 0.5);
    }

    #[test]
    fn the_strand_never_reaches_him() {
        every(0.05, |t| {
            let f = compose(t);
            let span = f.curves[4 * 3 + 3];
            assert!(span[1] <= STRAND_REACH + 1e-6);
        });
    }

    #[test]
    fn the_noise_is_quiet_at_the_seam_and_loud_in_the_phrases() {
        assert_eq!(noise(0.0), 0.0);
        assert_eq!(noise(65.0), 0.0);
        assert_eq!(noise(20.0), 1.0);
        assert_eq!(ridge(0.0), 1.0);
        assert_eq!(ridge(30.0), 0.0);
        assert_eq!(ridge(68.0), 1.0);
    }

    #[test]
    fn the_beats_and_keys_run_forward() {
        assert_eq!(BEATS[0], 0.0);
        assert!(BEATS.windows(2).all(|w| w[0] < w[1]));
        assert_eq!(CAMERA[0].0, 0.0);
        assert!(CAMERA.windows(2).all(|w| w[0].0 < w[1].0));
        assert!(CAMERA[CAMERA.len() - 1].0 < LOOP_SECONDS);
    }

    #[test]
    fn every_dark_theme_has_its_own_colours() {
        let looks = [0, 2, 3, 4].map(look);
        for (i, a) in looks.iter().enumerate() {
            for b in &looks[i + 1..] {
                assert_ne!(a.cold, b.cold);
            }
        }
        assert_eq!(look(2), look(99));
    }

    #[test]
    fn reduced_motion_holds_the_quiet() {
        let f = compose(STILL);
        assert_eq!(f.land[0], 0.0);
        assert!(f.land[1] > 0.99);
        assert!(f.curves[4 * 2 + 3][1] > 0.99, "the tone is up");
    }
}
