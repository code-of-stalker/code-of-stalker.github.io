//! «Наблюдай фон и движение, а не содержание», page 05 of Step 6
//! «Внутреннее кольцо», direction «Ветер». The inner field is a night
//! meadow; the person sits upright on a chair in a clearing at its middle,
//! the warm second ring lying round them, the cold first ring turning round
//! the whole meadow. Nothing that happens inside is shown, only how the grass
//! moves, and a plain plate names the fact: «ЕСТЬ МЫСЛЬ» over the track of
//! something that ran through the grass; «ЕСТЬ ЭМОЦИЯ» over a broad warm wave;
//! «ЕСТЬ ИМПУЛЬС» over a sharp parting line; «ЕСТЬ НАПРЯЖЕНИЕ» over grass
//! pressed into a still tight spiral while the wind stops; «ЕСТЬ
//! РАССЛАБЛЕНИЕ» as the spiral lets go and a ripple runs out; «ЕСТЬ
//! ФИЗИОЛОГИЯ» as the whole field breathes. «Без комментариев»: the plate
//! starts to write «, ПОТОМУ ЧТО...» and takes it back. «Не интерпретируй»:
//! seen from above, the wind almost writes «почему» in the grass and scatters
//! it; the plate stays «ЕСТЬ МЫСЛЬ». «Все на фоне динамики внешнего кольца»:
//! the camera pulls back while the first ring's runners comb the rim.
//! Every value here is a pure function of loop time; `browser.rs` uploads it
//! and four passes draw it. Unit: the person sits about 1.43 high, the ground
//! is y = 0, the person faces +z.
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

pub mod generated;
pub use generated::{ADVANCE, ATLAS, CAPS, LABEL_BAND, LABEL_CHARS, ROW, SPACING, TEXT_X, WORD};

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerLabels;

pub type V = [f32; 3];
type P = [f32; 2];

pub const LOOP_SECONDS: f32 = 64.0;
/// The frame the scene is composed for, width over height.
pub const FRAME_ASPECT: f32 = 1.5;
/// The meadow: centre x, z and radius. The clearing round the person is
/// `CLEARING` wide round the same centre.
pub const FIELD: [f32; 3] = [0.0, 0.12, 6.0];
pub const CLEARING: f32 = 0.7;
/// Blade heights, shortest and tallest.
pub const BLADE: [f32; 2] = [0.2, 0.4];
/// The cold first ring round the meadow: centre x, y, z, radius.
pub const OUTER: [f32; 4] = [0.0, 0.55, 0.12, 6.45];
/// The warm second ring round the person: centre x, y, z, radius.
pub const INNER: [f32; 4] = [0.0, 0.3, 0.12, 0.66];
/// How many times the first ring turns in a loop (whole turns keep the loop
/// seamless).
pub const TURNS: f32 = 2.0;
/// The depth range the passes share.
pub const NEAR: f32 = 0.05;
pub const FAR: f32 = 60.0;
/// The box round the chair and the seated person.
pub const BOUNDS: [V; 2] = [[-0.3, -0.01, -0.21], [0.3, 1.46, 0.7]];
/// Points along the track something leaves running through the grass.
pub const SWIRL_POINTS: usize = 10;
/// Reduced motion holds «Есть мысль»: the track in the grass and its plate.
pub const STILL: f32 = 8.0;
/// Where the camera looks from at the start of the loop.
pub const ORBIT: f32 = 0.35;

/// The camera: (time, [azimuth offset, range, pitch in degrees, look-at
/// point ahead of the person, its height, its side offset, vertical field of
/// view]). The camera circles the meadow once a loop; the offset slows or
/// holds it, as over «Не интерпретируй», where it looks straight down.
pub const VIEWS: [(f32, [f32; 7]); 18] = [
    (0.0, [0.0, 6.2, 30.0, 1.3, 0.15, 0.0, 44.0]),
    (4.5, [0.0, 5.8, 29.0, 1.4, 0.15, 0.2, 44.0]),
    (8.5, [0.05, 5.0, 27.0, 1.6, 0.2, 0.3, 44.0]),
    (11.5, [0.1, 4.6, 14.0, 1.5, 0.4, 0.0, 50.0]),
    (14.0, [0.1, 4.2, 7.0, 1.4, 0.5, 0.0, 50.0]),
    (16.6, [0.1, 4.3, 8.0, 1.4, 0.5, 0.0, 50.0]),
    (19.0, [0.12, 4.6, 20.0, 1.7, 0.3, 0.0, 48.0]),
    (23.5, [0.12, 5.9, 34.0, 1.5, 0.05, 0.0, 44.0]),
    (28.0, [0.1, 6.0, 35.0, 1.5, 0.05, 0.0, 44.0]),
    (32.0, [0.08, 5.8, 31.0, 1.4, 0.1, 0.0, 46.0]),
    (37.5, [0.05, 7.3, 32.0, 0.8, 0.0, 0.0, 46.0]),
    (41.5, [0.05, 5.9, 31.0, 1.2, 0.1, 0.0, 44.0]),
    (44.5, [0.08, 5.3, 32.0, 1.5, 0.1, 0.0, 44.0]),
    (47.8, [-0.14, 6.2, 46.0, 1.6, 0.0, 0.0, 46.0]),
    (50.5, [-0.4, 6.0, 50.0, 1.7, 0.0, 0.0, 46.0]),
    (54.0, [-0.74, 6.0, 50.0, 1.7, 0.0, 0.0, 46.0]),
    (57.5, [-0.55, 6.4, 52.0, 1.0, 0.1, 0.0, 46.0]),
    (61.0, [-0.25, 7.0, 33.0, 0.9, 0.15, 0.0, 45.0]),
];

/// «Ты фиксируешь Сам факт Присутствия»: the second ring lights up.
pub const PRESENCE: [f32; 4] = [1.0, 2.2, 3.4, 4.8];
/// «Есть мысль» and «Без комментариев»: something runs through the grass
/// (the head runs from .0 to .1) and its track stays a while (on, off).
pub const THOUGHTS: [([f32; 2], [f32; 4]); 2] = [
    ([5.6, 7.5], [5.5, 5.8, 9.6, 10.9]),
    ([41.6, 43.1], [41.5, 41.8, 46.6, 48.4]),
];
/// «Есть эмоция»: a broad warm wave rolls through toward the camera, a
/// second, weaker one behind it.
pub const WAVE: [f32; 4] = [11.6, 12.6, 15.8, 17.0];
pub const WAVE_SECOND: [f32; 4] = [12.6, 13.6, 16.2, 17.2];
/// «Есть импульс»: the parting runs along its line, then the grass slowly
/// stands again.
pub const IMPULSE: [f32; 2] = [17.3, 17.55];
pub const IMPULSE_GONE: [f32; 2] = [20.5, 21.8];
/// «Есть напряжение»: the wind stops, the grass winds into a spiral and
/// holds it; «Есть расслабление»: it lets go.
pub const TENSION: [f32; 2] = [22.4, 24.0];
pub const RELEASE: [f32; 2] = [29.0, 30.8];
pub const RIPPLE: f32 = 29.1;
/// «Есть физиология»: the field breathes out from the person, two breaths.
pub const BREATH: [f32; 4] = [34.8, 35.6, 40.3, 41.3];
pub const BREATH_FROM: f32 = 35.0;
/// «Не интерпретируй»: the word writes itself left to right, then scatters
/// from the right.
pub const WRITE: [f32; 2] = [47.6, 50.4];
pub const SCATTER: [f32; 2] = [51.6, 54.2];
pub const WORD_ON: [f32; 4] = [47.4, 47.7, 53.8, 55.4];
/// The word on the ground: width and the point (ahead, side) of its middle
/// in the frame of the camera looking down.
pub const WORD_SIZE: f32 = 4.4;
pub const WORD_AT: P = [2.05, 0.0];
/// When the plates stand: (on, off, row of the atlas).
pub const LABELS: [(f32, f32, usize); 7] = [
    (6.4, 10.2, 0),
    (12.6, 16.4, 1),
    (17.5, 21.3, 2),
    (23.9, 28.8, 3),
    (30.1, 34.2, 4),
    (36.0, 40.6, 5),
    (42.0, 48.8, 6),
];
/// «Без комментариев»: the comment types on, waits and is taken back to
/// «ЕСТЬ МЫСЛЬ» (start, end of typing; start, end of erasing).
pub const COMMENT: [f32; 4] = [43.3, 44.45, 44.9, 45.5];

// ---------- small math

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
fn window(t: f32, [a, b, c, d]: [f32; 4]) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

fn sub(a: V, b: V) -> V {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn dot(a: V, b: V) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
fn length(a: V) -> f32 {
    dot(a, a).sqrt()
}
fn scale(a: V, s: f32) -> V {
    a.map(|v| v * s)
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
fn lerp(a: P, b: P, s: f32) -> P {
    [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]
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
        let level = cross(forward, [0.0, 1.0, 0.0]);
        let right = if length(level) > 1e-4 {
            norm(level)
        } else {
            [1.0, 0.0, 0.0]
        };
        Camera {
            eye,
            right,
            up: cross(right, forward),
            forward,
            lens: (fov.to_radians() * 0.5).tan(),
        }
    }
    /// Where a point lands in the frame: y -1..1 across its height, x
    /// -1.5..1.5 across its width; None behind the camera.
    pub fn project(&self, p: V) -> Option<P> {
        let v = sub(p, self.eye);
        let z = dot(v, self.forward);
        (z > NEAR).then(|| {
            [
                dot(v, self.right) / (z * self.lens),
                dot(v, self.up) / (z * self.lens),
            ]
        })
    }
}

pub fn in_frame([x, y]: P) -> bool {
    x.abs() < FRAME_ASPECT && y.abs() < 1.0
}

/// Which way the camera looks across the ground at `t`, as an angle.
pub fn azimuth(t: f32) -> f32 {
    ORBIT + TAU * t / LOOP_SECONDS + spline_by(VIEWS.len(), |i| (VIEWS[i].0, VIEWS[i].1[0]), t)
}

/// The camera's level forward and right on the ground (x, z).
fn ground_axes(azimuth: f32) -> (P, P) {
    let (s, c) = azimuth.sin_cos();
    ([-s, c], [-c, -s])
}

/// A point on the ground given ahead of and to the side of the person, as
/// the camera at `azimuth` sees it.
pub fn ground(azimuth: f32, [ahead, side]: P) -> P {
    let (f, r) = ground_axes(azimuth);
    [f[0] * ahead + r[0] * side, f[1] * ahead + r[1] * side]
}

pub fn camera(t: f32) -> Camera {
    let [_, range, pitch, ahead, height, side, fov] = keyed(&VIEWS, t);
    let az = azimuth(t);
    let (f, _) = ground_axes(az);
    let [tx, tz] = ground(az, [ahead, side]);
    let (sp, cp) = pitch.clamp(3.0, 89.6).to_radians().sin_cos();
    let eye = [
        tx - f[0] * range * cp,
        height + range * sp,
        tz - f[1] * range * cp,
    ];
    Camera::toward(eye, [tx, height, tz], fov)
}

// ---------- what happens in the grass

/// A track on the ground through `SWIRL_POINTS` points: it sets off from
/// `from` (ahead, side) heading `heading` (radians from the camera's right
/// toward ahead), turning by `curl` as it goes, `length` long.
fn track(azimuth: f32, from: P, heading: f32, curl: f32, length: f32) -> [P; SWIRL_POINTS] {
    let step = length / (SWIRL_POINTS - 1) as f32;
    let mut at = from;
    let mut points = [ground(azimuth, from); SWIRL_POINTS];
    for (i, point) in points.iter_mut().enumerate().skip(1) {
        let s = (i as f32 - 0.5) / (SWIRL_POINTS - 1) as f32;
        let (sin, cos) = (heading + curl * s * s).sin_cos();
        at = [at[0] + step * sin, at[1] + step * cos];
        *point = ground(azimuth, at);
    }
    points
}

/// The two tracks: «Есть мысль» and «Без комментариев».
pub fn tracks() -> [[P; SWIRL_POINTS]; 2] {
    [
        track(azimuth(8.0), [2.7, -1.7], 0.35, 2.7, 3.7),
        track(
            azimuth(43.2),
            [2.0, 1.4],
            std::f32::consts::PI - 0.3,
            -2.4,
            3.2,
        ),
    ]
}

/// The point at `s` (0..1) along a track.
pub fn along(points: &[P; SWIRL_POINTS], s: f32) -> P {
    let x = s.clamp(0.0, 1.0) * (SWIRL_POINTS - 1) as f32;
    let i = (x.floor() as usize).min(SWIRL_POINTS - 2);
    lerp(points[i], points[i + 1], x - i as f32)
}

pub fn thought(t: f32) -> Option<(usize, f32, f32)> {
    THOUGHTS.iter().enumerate().find_map(|(i, &(run, on))| {
        let strength = window(t, on);
        (strength > 0.0).then(|| {
            let x = ((t - run[0]) / (run[1] - run[0])).clamp(0.0, 1.0);
            (i, 1.0 - (1.0 - x) * (1.0 - x), strength)
        })
    })
}

/// The emotion's way across the ground (toward the camera) and its front.
pub fn wave_way() -> (P, P) {
    let (f, r) = ground_axes(azimuth(14.0));
    ([-f[0], -f[1]], r)
}
pub fn wave_front(t: f32) -> f32 {
    -6.5 + (t - 11.8) * 2.5
}

/// The impulse's line on the ground, from near the person outward.
pub fn impulse_line() -> (P, P) {
    let az = azimuth(19.2);
    (ground(az, [1.4, 0.55]), ground(az, [4.5, 2.1]))
}

/// The middle of the tension's spiral.
pub fn spiral_at() -> P {
    ground(azimuth(26.0), [2.4, -1.1])
}

/// Where «Есть физиология» points: into the breathing field.
pub fn breath_at() -> V {
    let [x, z] = ground(azimuth(38.0), [2.3, 1.7]);
    [x, 0.35, z]
}

/// The word on the ground: its left-bottom corner, the way it is written
/// (U), the way its letters stand (V), its width and height.
pub fn word_frame() -> (P, P, P, P) {
    let (f, r) = ground_axes(azimuth(51.0));
    let centre = ground(azimuth(51.0), WORD_AT);
    let size = [
        WORD_SIZE,
        WORD_SIZE * (WORD[3] - WORD[1]) / (WORD[2] - WORD[0]),
    ];
    let corner = [
        centre[0] - r[0] * size[0] * 0.5 - f[0] * size[1] * 0.5,
        centre[1] - r[1] * size[0] * 0.5 - f[1] * size[1] * 0.5,
    ];
    (corner, r, f, size)
}

/// A point of the word: `u` along it, `v` up its letters, both 0..1.
pub fn word_point(u: f32, v: f32) -> P {
    let (c, a, b, size) = word_frame();
    [
        c[0] + a[0] * size[0] * u + b[0] * size[1] * v,
        c[1] + a[1] * size[0] * u + b[1] * size[1] * v,
    ]
}

// ---------- the labels

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Label {
    pub row: usize,
    pub alpha: f32,
    /// Letters shown (typing), and letters the plate is wide for.
    pub chars: f32,
    pub wide: f32,
    /// The point in the world it names.
    pub anchor: V,
}

fn at_height([x, z]: P, y: f32) -> V {
    [x, y, z]
}

fn anchor(row: usize, t: f32) -> V {
    let tracks = tracks();
    match row {
        0 => at_height(along(&tracks[0], 0.72), 0.3),
        1 => {
            let (way, side) = wave_way();
            let s = wave_front(t).min(-0.8);
            at_height(
                [
                    FIELD[0] + way[0] * s + side[0] * 0.7,
                    FIELD[1] + way[1] * s + side[1] * 0.7,
                ],
                0.35,
            )
        }
        2 => {
            let (a, b) = impulse_line();
            at_height(lerp(a, b, 0.62), 0.3)
        }
        3 | 4 => at_height(spiral_at(), 0.25),
        5 => breath_at(),
        _ => at_height(along(&tracks[1], 0.72), 0.3),
    }
}

pub fn label(t: f32) -> Option<Label> {
    LABELS.iter().find_map(|&(on, off, row)| {
        let alpha = smooth(on, on + 0.25, t) * (1.0 - smooth(off - 0.5, off, t));
        if alpha <= 0.0 {
            return None;
        }
        let full = LABEL_CHARS[row];
        let typed = ((t - on - 0.12) / 0.028).clamp(0.0, LABEL_CHARS[0]);
        let chars = if row == 6 {
            let [a, b, c, d] = COMMENT;
            let more = (full - LABEL_CHARS[0]) * (smooth(a, b, t) - smooth(c, d, t));
            typed + (more * 4.0).round() / 4.0
        } else {
            ((t - on - 0.12) / 0.028).clamp(0.0, full)
        };
        Some(Label {
            row,
            alpha,
            chars,
            wide: if row == 6 {
                chars.max(LABEL_CHARS[0])
            } else {
                full
            },
            anchor: anchor(row, t),
        })
    })
}

/// A plate in canvas pixels (y up from the bottom): the plate, the text's
/// left edge and the top of its capitals, how many canvas px an atlas px is,
/// and the leader from the named point to the plate.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Plate {
    pub rect: [f32; 4],
    pub text: [f32; 3],
    pub lead: [f32; 4],
    pub cap: f32,
}

/// Where plates may stand: left, right, bottom, top, as parts of the canvas,
/// inside the soft edges.
pub const PLATE_ROOM: [f32; 4] = [0.085, 0.915, 0.14, 0.88];

/// Lays out a plate for a label whose point lands at `at` (canvas px) on a
/// canvas `size` px big, `css` CSS px high: capitals 7.5–12 CSS px tall.
/// The person and the chair on a canvas `size` px big (left, bottom, right,
/// top), or None when part of them is behind the camera.
pub fn person_on_canvas(camera: &Camera, size: P) -> Option<[f32; 4]> {
    let mut r = [f32::MAX, f32::MAX, f32::MIN, f32::MIN];
    for i in 0..8 {
        let corner = [
            BOUNDS[i & 1][0],
            BOUNDS[(i >> 1) & 1][1],
            BOUNDS[(i >> 2) & 1][2],
        ];
        let [x, y] = to_canvas(camera.project(corner)?, size);
        r = [r[0].min(x), r[1].min(y), r[2].max(x), r[3].max(y)];
    }
    Some(r)
}

pub fn plate(at: P, size: P, css: f32, label: &Label, avoid: Option<[f32; 4]>) -> Plate {
    let ratio = if css > 1.0 { size[1] / css } else { 1.0 };
    let css = if css > 1.0 { css } else { size[1] };
    let cap = (0.021 * css).clamp(7.5, 12.0) * ratio;
    let k = cap / (CAPS[1] - CAPS[0]);
    let text = |n: f32| (n * ADVANCE - SPACING) * k;
    let (pad_x, pad_y) = (0.95 * cap, 0.8 * cap);
    let (w, h) = (text(label.wide) + 2.0 * pad_x, cap + 2.0 * pad_y);
    let full = text(LABEL_CHARS[label.row]) + 2.0 * pad_x;
    let room = [
        PLATE_ROOM[0] * size[0],
        PLATE_ROOM[1] * size[0],
        PLATE_ROOM[2] * size[1],
        PLATE_ROOM[3] * size[1],
    ];
    let (gap, rise) = (1.6 * cap, 2.4 * cap);
    // Up and to the right of the point; to the left or below when there is
    // no room or the person stands there. The comment's plate is placed for
    // its full length.
    let place = |x: f32, y: f32| {
        let x0 = x.clamp(room[0], (room[1] - full).max(room[0]));
        let y0 = y.clamp(room[2], (room[3] - h).max(room[2]));
        let hit = avoid.map_or(0.0, |a| {
            let m = 0.4 * cap;
            let ox = ((x0 + full).min(a[2] + m) - x0.max(a[0] - m)).max(0.0);
            let oy = ((y0 + h).min(a[3] + m) - y0.max(a[1] - m)).max(0.0);
            ox * oy
        });
        let cost = 10.0 * hit / (cap * cap) + ((x0 - x).abs() + (y0 - y).abs()) / cap;
        (x0, y0, cost)
    };
    let (right, left) = (at[0] + gap, at[0] - gap - full);
    let (up, down) = (at[1] + rise, at[1] - rise - h);
    let (x0, y0, _) = [(right, up), (left, up), (right, down), (left, down)]
        .iter()
        .enumerate()
        .map(|(i, &(x, y))| {
            let (x0, y0, cost) = place(x, y);
            (x0, y0, cost + 0.5 * i as f32)
        })
        .fold(
            (0.0, 0.0, f32::MAX),
            |best, c| if c.2 < best.2 { c } else { best },
        );
    let rect = [x0, y0, x0 + w, y0 + h];
    let end = [at[0].clamp(rect[0], rect[2]), at[1].clamp(rect[1], rect[3])];
    Plate {
        rect,
        text: [x0 + pad_x, y0 + h - pad_y, k],
        lead: [at[0], at[1], end[0], end[1]],
        cap,
    }
}

/// Where a frame point lands on a canvas `size` px big (y up), the whole
/// 3:2 frame in view.
pub fn to_canvas([x, y]: P, size: P) -> P {
    let aspect = size[0] / size[1];
    let view = [
        1.0 / aspect.max(FRAME_ASPECT),
        aspect.min(FRAME_ASPECT) / FRAME_ASPECT,
    ];
    [
        (x * view[0] + 1.0) * 0.5 * size[0],
        (y * view[1] + 1.0) * 0.5 * size[1],
    ]
}

// ---------- one frame

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// How much the ambient wind blows (0 still), how hard the first ring's
    /// runners comb the rim, how far the first ring has turned.
    pub calm: f32,
    pub comb: f32,
    pub turn: f32,
    /// The second ring's light.
    pub ring: f32,
    pub swirl: [P; SWIRL_POINTS],
    /// Head (0..1), strength, half width, length.
    pub swirl_s: [f32; 4],
    /// The emotion: its way (x, z), front, strength; the second front,
    /// strength, the fronts' width.
    pub wave: [f32; 4],
    pub wave2: [f32; 4],
    /// The impulse: from (x, z), to (x, z); head, strength, sheen, half width.
    pub crack: [f32; 4],
    pub crack_s: [f32; 4],
    /// The spiral: centre (x, z), radius, strength; the ripple: radius,
    /// strength, width, how far the spiral has wound in.
    pub spiral: [f32; 4],
    pub ripple: [f32; 4],
    /// The breath: seconds since it began, strength.
    pub breath: [f32; 2],
    /// The word: corner (x, z), along (x, z); up (x, z), width, height;
    /// written (0..1), scattered from (1..0), strength.
    pub word: [f32; 4],
    pub word_v: [f32; 4],
    pub word_s: [f32; 3],
    pub label: Option<Label>,
}

pub fn compose(t: f32) -> Frame {
    let t = t.rem_euclid(LOOP_SECONDS);
    let tracks = tracks();
    let (swirl, swirl_s) = match thought(t) {
        Some((i, head, strength)) => (tracks[i], [head, strength, 0.32, 3.5]),
        None => (tracks[0], [0.0; 4]),
    };
    let (way, _) = wave_way();
    let front = wave_front(t);
    let (a, b) = impulse_line();
    let hit = smooth(IMPULSE[0], IMPULSE[0] + 0.1, t);
    let crack_k = hit
        * (-(t - 17.8).max(0.0) / 1.4).exp()
        * (1.0 - smooth(IMPULSE_GONE[0], IMPULSE_GONE[1], t));
    let crack_sheen = hit * 1.4 * (-(t - 17.45).max(0.0) / 0.7).exp() + 0.3 * crack_k;
    let centre = spiral_at();
    let wound = smooth(TENSION[0], TENSION[1], t);
    let ripple_k = smooth(RIPPLE, RIPPLE + 0.3, t)
        * (-(t - RIPPLE - 0.3).max(0.0) / 2.6).exp()
        * (1.0 - smooth(33.5, 34.5, t));
    let (corner, along_w, up_w, size) = word_frame();
    let label = label(t);
    let pulses: f32 = LABELS
        .iter()
        .map(|&(on, _, _)| 0.8 * (-((t - on - 0.15) / 0.45).powi(2)).exp())
        .sum();
    Frame {
        time: t,
        camera: camera(t),
        calm: 1.0
            - 0.92 * window(t, [22.2, 23.6, 30.0, 32.5])
            - 0.6 * window(t, [46.5, 48.0, 54.0, 56.0])
            - 0.35 * window(t, [55.5, 57.5, 62.0, 63.8]),
        comb: 0.4 + 0.6 * window(t, [55.5, 57.5, 62.0, 63.8]),
        turn: TAU * TURNS * t / LOOP_SECONDS,
        ring: 0.55 + 0.9 * window(t, PRESENCE) + pulses,
        swirl,
        swirl_s,
        wave: [way[0], way[1], front, window(t, WAVE)],
        wave2: [front - 3.2, 0.55 * window(t, WAVE_SECOND), 0.95, 0.0],
        crack: [a[0], a[1], b[0], b[1]],
        crack_s: [
            smooth(IMPULSE[0], IMPULSE[1], t),
            crack_k,
            crack_sheen,
            0.13,
        ],
        spiral: [
            centre[0],
            centre[1],
            1.35,
            wound * (1.0 - smooth(RELEASE[0], RELEASE[1], t)),
        ],
        ripple: [(t - RIPPLE).max(0.0) * 1.5, ripple_k, 0.55, wound],
        breath: [t - BREATH_FROM, window(t, BREATH)],
        word: [corner[0], corner[1], along_w[0], along_w[1]],
        word_v: [up_w[0], up_w[1], size[0], size[1]],
        word_s: [
            ((t - WRITE[0]) / (WRITE[1] - WRITE[0])).clamp(0.0, 1.0) * 1.04,
            1.05 - 1.15 * smooth(SCATTER[0], SCATTER[1], t),
            window(t, WORD_ON),
        ],
        label,
    }
}

// ---------- the themes

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub cold: [f32; 3],
    pub warm: [f32; 3],
    pub pale: [f32; 3],
}

fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r, g, b].map(|v| f32::from(v) / 255.0)
}

/// The dark themes by their `graphicsPalette` code; the light ones are
/// retired from the site and fall back to Тишина.
pub fn look(code: u32) -> Look {
    match Palette::from_code(code) {
        // Искра: the yellow of the theme, ember warmth.
        Palette::Dark => Look {
            cold: rgb(245, 221, 7),
            warm: rgb(255, 122, 40),
            pale: rgb(255, 244, 170),
        },
        // Астрал: the blue of the theme, rose-peach warmth.
        Palette::Violet => Look {
            cold: rgb(98, 150, 245),
            warm: rgb(240, 158, 128),
            pale: rgb(200, 212, 248),
        },
        // Матрица: code green, amber warmth.
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

    fn every(step: f32, mut check: impl FnMut(f32)) {
        let mut t = 0.0;
        while t < LOOP_SECONDS {
            check(t);
            t += step;
        }
    }

    fn dist(a: P, b: P) -> f32 {
        ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2)).sqrt()
    }

    fn from_field(p: P) -> f32 {
        dist(p, [FIELD[0], FIELD[1]])
    }

    #[test]
    fn the_loop_is_seamless() {
        let a = compose(0.0);
        let b = compose(LOOP_SECONDS - 1e-3);
        let close = |x: V, y: V| length(sub(x, y)) < 2e-3;
        assert!(close(a.camera.eye, b.camera.eye));
        assert!(close(a.camera.forward, b.camera.forward));
        assert!((a.calm - b.calm).abs() < 1e-3);
        assert!((a.comb - b.comb).abs() < 1e-3);
        assert!((a.ring - b.ring).abs() < 1e-2);
        assert!((a.turn - (b.turn - TAU * TURNS)).abs() < 1e-3);
        assert!(a.label.is_none() && b.label.is_none());
    }

    #[test]
    fn the_camera_moves_smoothly_and_stays_above_the_grass() {
        let mut last = camera(0.0);
        every(0.02, |t| {
            let c = camera(t);
            assert!(c.eye[1] > 0.65, "camera in the grass at {t}: {:?}", c.eye);
            assert!(
                length(sub(c.eye, [0.0, 0.8, 0.2])) > 1.2,
                "camera too close to the person at {t}"
            );
            assert!(length(sub(c.eye, last.eye)) < 0.06, "camera jumps at {t}");
            assert!(dot(c.up, last.up) > 0.99, "camera rolls at {t}");
            last = c;
        });
    }

    #[test]
    fn the_person_is_in_view_except_from_above() {
        every(0.25, |t| {
            if (47.5..=54.5).contains(&t) {
                return;
            }
            let p = camera(t).project([0.0, 0.8, 0.2]).expect("person behind");
            assert!(
                p[0].abs() < 1.3 && p[1].abs() < 0.9,
                "person out at {t}: {p:?}"
            );
        });
    }

    #[test]
    fn what_happens_lies_in_the_meadow_off_the_clearing() {
        for points in tracks() {
            for p in points {
                let r = from_field(p);
                assert!(r > CLEARING + 0.35 && r < FIELD[2] - 0.6, "track at {p:?}");
            }
        }
        let (a, b) = impulse_line();
        for p in [a, b] {
            let r = from_field(p);
            assert!(r > CLEARING + 0.2 && r < FIELD[2] - 0.6, "impulse at {p:?}");
        }
        let r = from_field(spiral_at());
        assert!(r > CLEARING + 1.4 && r < FIELD[2] - 1.5, "spiral at {r}");
        for (u, v) in [(0.0, 0.0), (1.0, 0.0), (0.0, 1.0), (1.0, 1.0)] {
            let r = from_field(word_point(u, v));
            assert!(r > CLEARING + 0.4 && r < FIELD[2] - 0.5, "word at {r}");
        }
    }

    #[test]
    fn the_word_reads_left_to_right_level() {
        every(0.1, |t| {
            if !(48.0..=54.2).contains(&t) {
                return;
            }
            let c = camera(t);
            let left = c.project(at_height(word_point(0.0, 0.5), 0.3)).unwrap();
            let right = c.project(at_height(word_point(1.0, 0.5), 0.3)).unwrap();
            let low = c.project(at_height(word_point(0.5, 0.0), 0.3)).unwrap();
            let high = c.project(at_height(word_point(0.5, 1.0), 0.3)).unwrap();
            let tilt = (right[1] - left[1]).atan2(right[0] - left[0]).to_degrees();
            assert!(tilt.abs() < 7.0, "word tilts {tilt}° at {t}");
            assert!(high[1] > low[1], "word upside down at {t}");
            for p in [left, right, low, high] {
                assert!(
                    p[0].abs() < 1.3 && p[1].abs() < 0.85,
                    "word out at {t}: {p:?}"
                );
            }
        });
    }

    #[test]
    fn events_are_in_view_while_they_happen() {
        let check = |t: f32, p: P, what: &str| {
            let f = camera(t).project(at_height(p, 0.3));
            assert!(
                f.is_some_and(|f| f[0].abs() < 1.3 && f[1].abs() < 0.9),
                "{what} out of view at {t}: {f:?}"
            );
        };
        let tracks = tracks();
        for (i, &(run, on)) in THOUGHTS.iter().enumerate() {
            let mut t = run[0];
            while t < on[2].min(47.0) {
                for s in [0.0, 0.5, 1.0] {
                    check(t, along(&tracks[i], s), "track");
                }
                t += 0.1;
            }
        }
        let (a, b) = impulse_line();
        for t in [17.3, 18.0, 19.0, 20.0, 21.0] {
            check(t, a, "impulse");
            check(t, b, "impulse");
        }
        for t in [22.5, 24.0, 26.0, 28.0, 30.0, 32.0, 34.0] {
            check(t, spiral_at(), "spiral");
        }
    }

    #[test]
    fn plates_stand_in_the_frame_on_phone_and_wide() {
        // Phone (343 CSS px wide at 2×), tablet and desktop, all 3:2.
        for (size, css) in [
            ([686.0, 457.0], 228.7),
            ([1536.0, 1024.0], 512.0),
            ([2080.0, 1387.0], 693.3),
        ] {
            every(0.05, |t| {
                let Some(l) = label(t) else { return };
                let c = camera(t);
                let at = c.project(l.anchor).expect("label point behind");
                assert!(
                    at[0].abs() < 1.35 && at[1].abs() < 0.85,
                    "label {} points out of frame at {t}: {at:?}",
                    l.row
                );
                let p = plate(
                    to_canvas(at, size),
                    size,
                    css,
                    &l,
                    person_on_canvas(&c, size),
                );
                let [x0, y0, x1, y1] = p.rect;
                let eps = 0.5;
                assert!(x0 >= PLATE_ROOM[0] * size[0] - eps, "plate left at {t}");
                assert!(x1 <= PLATE_ROOM[1] * size[0] + eps, "plate right at {t}");
                assert!(y0 >= PLATE_ROOM[2] * size[1] - eps, "plate low at {t}");
                assert!(y1 <= PLATE_ROOM[3] * size[1] + eps, "plate high at {t}");
                assert!(p.cap / (size[1] / css) >= 7.49, "letters too small");
            });
        }
    }

    #[test]
    fn the_comment_writes_and_is_taken_back() {
        let at = |t: f32| label(t).unwrap();
        assert_eq!(at(42.6).chars, LABEL_CHARS[0]);
        assert_eq!(at(44.6).chars, LABEL_CHARS[6]);
        assert_eq!(at(46.0).chars, LABEL_CHARS[0]);
        assert_eq!(at(48.0).chars, LABEL_CHARS[0]);
        assert_eq!(at(48.0).row, 6);
        assert!(label(50.0).is_none(), "the word stands alone");
        assert_eq!(at(8.0).row, 0);
        assert!(label(11.5).is_none());
    }

    #[test]
    fn one_thing_at_a_time() {
        every(0.05, |t| {
            let f = compose(t);
            let busy = [
                f.swirl_s[1],
                f.wave[3],
                f.crack_s[1],
                f.spiral[3],
                f.ripple[1],
                f.breath[1],
                f.word_s[2],
            ]
            .iter()
            .filter(|&&k| k > 0.05)
            .count();
            assert!(busy <= 2, "{busy} events at once at {t}");
        });
    }

    #[test]
    fn every_dark_theme_has_its_own_look() {
        let looks = [0, 2, 3, 4].map(look);
        for (i, a) in looks.iter().enumerate() {
            for b in &looks[i + 1..] {
                assert_ne!(a, b);
            }
        }
    }
}
