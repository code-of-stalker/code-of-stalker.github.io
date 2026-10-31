//! «Используй свой голос», page 05 of Step 5 «Внешнее кольцо». A string of
//! light stands in the middle of a round plate: the voice. Each spoken
//! phrase («Я Здесь» … «Я Есть») sets it ringing; the sound runs out over
//! the plate, shakes its sand into a new figure, rises to the pole and runs
//! down a dome, leaving one belt of it behind, each belt its own
//! standing-wave pattern: «Я Здесь» lights the crown, «Я Есть» sets the dome
//! on the plate. The camera rises with the build and looks down on the
//! closed crown; five pulses read the dome through for the five verbs, and
//! on «Купольности и Многомерности» two more domes open inside and around
//! it. Then the dome sinks back into the plate. Code rains down the walls of
//! the dark round the scene and a projection of dials, glyphs and streams
//! turns on the floor. Every value here is a pure function of loop time;
//! `browser.rs` only uploads it and one ray-traced pass draws it. Unit: the
//! dome's radius.
use std::f32::consts::{FRAC_PI_2, PI, TAU};
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::SphereVoice;

pub const LOOP_SECONDS: f32 = 56.0;

/// The lens: a 3:2 frame 40° tall (1 / tan 20°); a canvas of another shape
/// keeps the whole 3:2 frame in view.
pub const FOCAL: f32 = 2.747_477_4;
pub const FRAME_ASPECT: f32 = 1.5;

/// The plate the dome stands on, the string of the voice in its middle.
pub const PLATE: f32 = 1.35;
pub const VOICE_HEIGHT: f32 = 0.42;
/// The belts' edges, degrees of latitude: six belts and the crown.
pub const BELTS: [f32; 8] = [0.0, 13.0, 26.0, 39.0, 52.0, 64.0, 76.0, 90.0];
/// Each belt's standing wave: cos(m₁φ)·sin(πa₁u) − cos(m₂φ)·sin(πa₂u) across
/// the belt (u 0..1, the crown from its pole); its nodal lines glow. Whole
/// a's keep the belt's edges nodal, so the figures close on the edge lines.
pub const PATTERNS: [[f32; 4]; 7] = [
    [24.0, 1.0, 12.0, 2.0],
    [10.0, 2.0, 20.0, 1.0],
    [18.0, 1.0, 9.0, 3.0],
    [14.0, 2.0, 7.0, 1.0],
    [12.0, 1.0, 6.0, 2.0],
    [8.0, 2.0, 16.0, 1.0],
    [6.0, 3.0, 12.0, 2.0],
];
/// The plate's sand figures in the same form over its radius: at rest
/// (rings), then one for each phrase.
pub const PLATE_MODES: [[f32; 4]; 8] = [
    [0.0, 4.0, 0.0, 0.0],
    [2.0, 3.0, 0.0, 5.0],
    [4.0, 4.0, 2.0, 2.0],
    [3.0, 5.0, 6.0, 3.0],
    [6.0, 4.0, 4.0, 6.0],
    [5.0, 6.0, 10.0, 3.0],
    [8.0, 5.0, 4.0, 7.0],
    [12.0, 6.0, 6.0, 4.0],
];
/// Domes inside and around the voice's own, for «Многомерности», each with
/// one standing wave over its whole height (u = latitude / 90°).
pub const NEST: [f32; 2] = [0.62, 1.5];
pub const NEST_PATTERNS: [[f32; 4]; 2] = [[5.0, 3.0, 10.0, 2.0], [7.0, 5.0, 14.0, 3.0]];

/// «Я Здесь», «Я Говорю», «Я Слышу», «Я Осознаю», «Я Ощущаю», «Я Наблюдаю»,
/// «Я Есть»: each phrase builds the next belt from the crown down.
pub const PHRASES: [f32; 7] = [1.0, 5.5, 10.0, 14.5, 19.0, 23.5, 28.0];
/// «означать, вибрировать, считывать, транслировать, ощущать»: a pulse from
/// the voice up to the pole and down the dome for each verb.
pub const PULSES: [f32; 5] = [33.5, 35.2, 36.9, 38.6, 40.3];
/// «каркас Присутствия формата Купольности и Многомерности»: the other
/// domes open.
pub const FRAME_BEAT: [f32; 2] = [42.5, 46.0];
/// The belts turn, one pattern period each, alternately, while the dome
/// resonates.
pub const TURN: [f32; 2] = [33.0, 47.0];
/// The dome sinks back into the plate, crown first, and the plate's sand
/// settles into rings.
pub const SETTLE: [f32; 2] = [50.0, 55.0];
/// Reduced motion: the whole dome and the other domes.
pub const STILL: f32 = 47.5;

/// The sound's front, units a second: out over the plate to the dome's rim
/// (1) while it rises from the string to the pole, then down the dome's arc
/// (radius 1) and on along the floor.
pub const WAVE_SPEED: f32 = 1.5;
/// A new belt's light comes up over this long after the front reaches it,
/// and flashes this much as the front closes it.
pub const BELT_FADE: f32 = 1.0;
pub const FLASH: f32 = 0.4;
/// An unbuilt dome's edge waits this far over the pole, so nothing shows.
pub const CLEAR: f32 = 0.02;
/// How long a front lights the floor as it runs out to the horizon.
pub const FLOOR_SECONDS: f32 = 5.0;
/// Each phrase's wave, then each verb's pulse.
pub const WAVES: usize = PHRASES.len() + PULSES.len();
/// The string rings at its phrase's harmonic, this wide, for this long.
pub const VOICE_SWING: f32 = 0.05;
pub const VOICE_DECAY: f32 = 1.2;
pub const PULSE_HARMONIC: f32 = 4.0;

/// Light of each part before the timeline's own gains.
pub const PATTERN_LIGHT: f32 = 0.75;
pub const EDGE_LIGHT: f32 = 0.6;
pub const SHEEN: f32 = 0.045;
/// The dome's far side against its near side.
pub const BACK: f32 = 0.38;
pub const SAND_LIGHT: f32 = 0.55;
/// The sand's lines, half width, and its grains (units).
pub const SAND_WIDTH: f32 = 0.012;
pub const SAND_GRAIN: f32 = 0.005;
pub const PLATE_FILL: f32 = 0.012;
pub const RIM_LIGHT: f32 = 0.35;
/// A front on the dome: its light, its half width (radians).
pub const FRONT_LIGHT: f32 = 1.4;
pub const FRONT_WIDTH: f32 = 0.05;
pub const FLOOR_LIGHT: f32 = 0.5;
pub const VOICE_LIGHT: f32 = 0.9;
/// How fast the ringing string visibly swings (a whole number of times a
/// loop).
pub const VOICE_HZ: f32 = 2.5;
pub const NEST_LIGHT: f32 = 0.55;
/// Lines' Gaussian width in canvas heights; their halo is `HALO_SPREAD`
/// times wider at `HALO` of their peak.
pub const LINE_WIDTH: f32 = 0.0011;
pub const HALO: f32 = 0.12;
pub const HALO_SPREAD: f32 = 4.0;

/// Code rain on four walls round the scene, only their far side: each
/// wall's radius, column width and light; glyphs fall from this high. The
/// nearest stands on the floor behind the dome, the others in the dark.
pub const RAIN: [[f32; 3]; 4] = [
    [4.2, 0.09, 0.3],
    [7.0, 0.13, 0.6],
    [9.5, 0.16, 0.45],
    [13.0, 0.2, 0.32],
];
pub const RAIN_HEIGHT: f32 = 7.0;
/// The projection on the floor round the plate. Dials: radius, ticks, ticks
/// turned a loop. Glyph rings: inner radius, width, glyphs, glyphs turned a
/// loop. Streams of code running in to the plate: from radius, columns, row
/// length, out to radius.
pub const DIALS: [[f32; 3]; 2] = [[1.42, 240.0, 5.0], [1.74, 180.0, -3.0]];
pub const GLYPH_RINGS: [[f32; 4]; 2] = [[1.54, 0.12, 90.0, 7.0], [1.86, 0.14, 110.0, -9.0]];
pub const STREAMS: [f32; 4] = [2.1, 128.0, 0.16, 6.5];
pub const PROJECTION_LIGHT: f32 = 0.4;
pub const STREAM_LIGHT: f32 = 0.32;
/// Projections standing round the scene behind the dome, facing it: where
/// round it (degrees, the camera keeps near 20°), how far out, how wide and
/// tall; how high they float, their light. Lines of code scroll up them and
/// each shows the voice's own wave.
pub const PANELS: [[f32; 4]; 5] = [
    [200.0, 3.2, 0.9, 1.2],
    [156.0, 3.0, 0.7, 0.9],
    [244.0, 3.0, 0.7, 0.9],
    [116.0, 3.4, 0.6, 0.75],
    [284.0, 3.4, 0.6, 0.75],
];
pub const PANEL_FLOAT: f32 = 0.3;
pub const PANEL_LIGHT: f32 = 0.5;

/// The camera climbs as the dome is built: its height over the plate
/// (degrees), distance and the height it looks at, keyed through the loop.
/// Just over the crown for «Я Здесь», straight above it after «Я Есть», down
/// to three quarters for the other domes, then low again.
pub const ELEVATION: [(f32, f32); 14] = [
    (0.0, 14.0),
    (5.5, 16.0),
    (10.0, 19.0),
    (14.5, 23.0),
    (19.0, 25.0),
    (23.5, 35.0),
    (28.0, 52.0),
    (31.5, 78.0),
    (35.5, 83.0),
    (39.5, 83.0),
    (43.0, 60.0),
    (46.5, 30.0),
    (50.0, 22.0),
    (53.5, 15.0),
];
pub const DISTANCE: [(f32, f32); 7] = [
    (0.0, 3.3),
    (14.5, 3.5),
    (28.0, 3.9),
    (36.0, 4.0),
    (45.5, 5.2),
    (50.0, 4.8),
    (53.5, 3.5),
];
pub const TARGET: [(f32, f32); 7] = [
    (0.0, 0.45),
    (10.0, 0.45),
    (19.0, 0.42),
    (31.5, 0.1),
    (39.5, 0.0),
    (45.5, 0.25),
    (53.5, 0.4),
];
/// A slow sway round the dome, back where it began each loop.
pub const AZIMUTH: f32 = 20.0 * PI / 180.0;
pub const SWAY: f32 = 22.0 * PI / 180.0;

/// The light themes engrave the scene: brightness up to this level
/// becomes ink, along this curve.
pub const ENGRAVE_WHITE: f32 = 0.9;
pub const ENGRAVE_GAMMA: f32 = 0.75;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    /// Loop time, for the shaders' own small motions.
    pub time: f32,
    /// The camera: round the dome, over the plate (radians), how far from
    /// the point it looks at; its place and axes.
    pub azimuth: f32,
    pub elevation: f32,
    pub distance: f32,
    pub eye: [f32; 3],
    pub right: [f32; 3],
    pub up: [f32; 3],
    pub forward: [f32; 3],
    /// The string: how wide it swings, at which harmonic, its light.
    pub voice: [f32; 3],
    /// Each wave: its front (out over the plate to 1 as it rises to the
    /// pole, then down the dome's arc), its light on the dome and on the
    /// floor, where it stops on the way down.
    pub waves: [[f32; 4]; WAVES],
    /// Each belt, from the plate up: how much of it is drawn, its light, how
    /// far it has turned (radians).
    pub belts: [[f32; 3]; 7],
    /// The latitudes the dome shows between (radians): built down to `low`,
    /// taken down from `high` as it settles; its light.
    pub low: f32,
    pub high: f32,
    pub dome: f32,
    /// The plate's sand: the figure it leaves, the one it goes to, how far
    /// between (0..1); its light.
    pub mode_from: [f32; 4],
    pub mode_to: [f32; 4],
    pub mode_mix: f32,
    pub plate: f32,
    /// The inner and the outer dome: light, and how far each has turned.
    pub nest: [f32; 2],
    pub nest_turn: [f32; 2],
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

/// A smooth closed curve through `keys` (time, value) around the loop:
/// Catmull–Rom tangents, cubic Hermite pieces.
pub fn spline(keys: &[(f32, f32)], t: f32) -> f32 {
    let n = keys.len() as isize;
    let mut t = t.rem_euclid(LOOP_SECONDS);
    let i = keys
        .iter()
        .rposition(|k| k.0 <= t)
        .map_or(n - 1, |i| i as isize);
    let key = |j: isize| {
        let (at, value) = keys[j.rem_euclid(n) as usize];
        (at + LOOP_SECONDS * j.div_euclid(n) as f32, value)
    };
    let [(t0, v0), (t1, v1), (t2, v2), (t3, v3)] = [i - 1, i, i + 1, i + 2].map(key);
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

/// The belt phrase `k` builds: the crown first, the plate's own belt last.
pub fn belt_of(k: usize) -> usize {
    PHRASES.len() - 1 - k
}

/// Where a latitude lies along a front's path: up to the pole (1), then
/// down the arc.
fn path_to(latitude: f32) -> f32 {
    1.0 + FRAC_PI_2 - latitude
}

/// Where belt `b`'s lower edge lies along a front's path.
pub fn belt_end(b: usize) -> f32 {
    path_to(BELTS[b].to_radians())
}

/// When wave `i` starts, and how far down the dome it runs.
pub fn wave_plan(i: usize) -> (f32, f32) {
    if i < PHRASES.len() {
        (PHRASES[i], belt_end(belt_of(i)))
    } else {
        (PULSES[i - PHRASES.len()], path_to(0.0))
    }
}

/// Wave `i` at `t`: its front, its light on the dome and on the floor,
/// where it stops. On the dome it dies at the edge it closes.
pub fn wave(i: usize, t: f32) -> [f32; 4] {
    let (from, end) = wave_plan(i);
    let age = t - from;
    if !(0.0..FLOOR_SECONDS).contains(&age) {
        return [0.0, 0.0, 0.0, end];
    }
    let front = WAVE_SPEED * age;
    let strength = if i < PHRASES.len() { 1.0 } else { 0.7 };
    let start = smooth(0.0, 0.4, age);
    [
        front,
        strength * start * (1.0 - smooth(end, end + 0.5, front)),
        strength * start * (1.0 - smooth(0.0, FLOOR_SECONDS, age)).powi(2),
        end,
    ]
}

/// How far down the phrases' fronts have built the dome at `t` (radians of
/// latitude); just over the pole until the first one arrives.
pub fn low(t: f32) -> f32 {
    (0..PHRASES.len())
        .map(|k| {
            let from = PHRASES[k];
            let lowest = BELTS[belt_of(k)].to_radians();
            if t >= from + FLOOR_SECONDS {
                lowest
            } else if t >= from {
                (FRAC_PI_2 + 1.0 - wave(k, t)[0]).clamp(lowest, FRAC_PI_2 + CLEAR)
            } else {
                FRAC_PI_2 + CLEAR
            }
        })
        .fold(FRAC_PI_2 + CLEAR, f32::min)
}

/// Where the dome is taken down to as it settles, crown first.
pub fn high(t: f32) -> f32 {
    FRAC_PI_2 - (FRAC_PI_2 + CLEAR) * smooth(SETTLE[0], SETTLE[1], t)
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let azimuth = AZIMUTH + SWAY * (TAU * time / LOOP_SECONDS).sin();
    let elevation = spline(&ELEVATION, time).to_radians();
    let distance = spline(&DISTANCE, time);
    let target = spline(&TARGET, time);
    let (sa, ca) = azimuth.sin_cos();
    let (se, ce) = elevation.sin_cos();
    let eye = [
        distance * sa * ce,
        target + distance * se,
        distance * ca * ce,
    ];
    let forward = [-sa * ce, -se, -ca * ce];
    // Level with the plate however high the camera climbs.
    let right = [ca, 0.0, -sa];
    let up = cross(right, forward);

    let waves: [[f32; 4]; WAVES] = std::array::from_fn(|i| wave(i, time));
    let (low, high) = (low(time), high(time));
    let gone = 1.0 - smooth(SETTLE[0], SETTLE[0] + 3.0, time);
    let turned = smooth(TURN[0], TURN[1], time);
    let belts: [[f32; 3]; 7] = std::array::from_fn(|b| {
        let (lo, hi) = (BELTS[b].to_radians(), BELTS[b + 1].to_radians());
        let drawn = ((hi.min(high) - lo.max(low)) / (hi - lo)).clamp(0.0, 1.0);
        // The light comes up softly behind the front, flashes gently as the
        // front closes the belt, then stays.
        let from = PHRASES[PHRASES.len() - 1 - b];
        let arrive = from + path_to(hi) / WAVE_SPEED;
        let done = from + belt_end(b) / WAVE_SPEED;
        let on = smooth(arrive, done + BELT_FADE, time);
        let flash =
            FLASH * smooth(done - 0.3, done + 0.3, time) * (-(time - done - 0.3).max(0.0)).exp();
        let side = if b % 2 == 0 { 1.0 } else { -1.0 };
        [
            drawn,
            on * (1.0 + flash) * gone,
            side * TAU / PATTERNS[b][0] * turned,
        ]
    });

    // The voice rings at each phrase's harmonic, softer for the verbs.
    let ring = |from: f32| {
        let age = time - from;
        if age < 0.0 {
            0.0
        } else {
            smooth(0.0, 0.15, age) * (-age / VOICE_DECAY).exp()
        }
    };
    let (mut swing, mut harmonic) = (0.0, 1.0);
    for (k, &at) in PHRASES.iter().enumerate() {
        let a = ring(at);
        swing += a;
        if time >= at {
            harmonic = k as f32 + 1.0;
        }
    }
    for &at in &PULSES {
        swing += 0.6 * ring(at);
        if time >= at {
            harmonic = PULSE_HARMONIC;
        }
    }
    let voice = [VOICE_SWING * swing, harmonic, 1.0 + 1.5 * swing.min(1.0)];

    // The sand: at rest in rings, a new figure on each phrase, rings again
    // as the dome settles.
    let passed = PHRASES.iter().filter(|&&at| time >= at).count();
    let (mode_from, mode_to, mode_mix) = if time >= SETTLE[0] {
        (
            PLATE_MODES[PHRASES.len()],
            PLATE_MODES[0],
            smooth(SETTLE[0] + 1.0, SETTLE[1], time),
        )
    } else if passed == 0 {
        (PLATE_MODES[0], PLATE_MODES[0], 0.0)
    } else {
        let at = PHRASES[passed - 1] + 1.0 / WAVE_SPEED * 0.3;
        (
            PLATE_MODES[passed - 1],
            PLATE_MODES[passed],
            smooth(at, at + 0.9, time),
        )
    };

    Frame {
        time,
        azimuth,
        elevation,
        distance,
        eye,
        right,
        up,
        forward,
        voice,
        waves,
        belts,
        low,
        high,
        dome: 1.0,
        mode_from,
        mode_to,
        mode_mix,
        plate: 1.0,
        nest: [
            window(
                time,
                FRAME_BEAT[0] + 0.5,
                FRAME_BEAT[1],
                SETTLE[0] - 1.5,
                SETTLE[0] + 0.5,
            ),
            window(
                time,
                FRAME_BEAT[0] + 1.2,
                FRAME_BEAT[1] + 0.8,
                SETTLE[0] - 1.5,
                SETTLE[0] + 0.5,
            ),
        ],
        nest_turn: [
            -0.5 * smooth(FRAME_BEAT[0], SETTLE[0] + 0.5, time),
            0.35 * smooth(FRAME_BEAT[0], SETTLE[0] + 0.5, time),
        ],
    }
}

/// Where a world point lands in a 3:2 frame, -1..1 both ways; None behind
/// the camera.
pub fn project(f: &Frame, point: [f32; 3]) -> Option<[f32; 2]> {
    let v = [0, 1, 2].map(|i| point[i] - f.eye[i]);
    let z = dot(v, f.forward);
    (z > 0.0).then(|| {
        [
            dot(v, f.right) / z * FOCAL / FRAME_ASPECT,
            dot(v, f.up) / z * FOCAL,
        ]
    })
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub light: bool,
    /// The scene's light, in the step's matrix green.
    pub glow: [f32; 3],
    pub deep: [f32; 3],
    pub mid: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}
const GREEN: [f32; 3] = [0.56, 1.0, 0.62];
/// Where the middle ink sits on the way from full ink to the page.
pub const MID_AT: f32 = 0.45;
const LUMA: [f32; 3] = [0.2126, 0.7152, 0.0722];

fn mix(a: f32, b: f32, t: f32) -> f32 {
    a * (1.0 - t) + b * t
}

/// The app theme by its `graphicsPalette` code (0 Искра … 6 Рассвет).
/// The light inks are the Step 5 hero's: one print across the step.
pub fn look(code: u32) -> Look {
    let print = |deep, mid| Look {
        light: true,
        glow: GREEN,
        deep,
        mid,
    };
    match Palette::from_code(code) {
        // Дюна: soft sepia, never orange.
        Palette::Light => print(rgb(110, 52, 18), rgb(162, 98, 52)),
        // Мираж: navy text ink, then cobalt dulled toward lilac.
        Palette::Mirage => print(rgb(38, 59, 107), rgb(93, 97, 162)),
        // Рассвет: plum text ink, then wine dulled toward copper.
        Palette::Dawn => print(rgb(96, 51, 70), rgb(140, 84, 79)),
        _ => Look {
            light: false,
            glow: GREEN,
            deep: [0.0; 3],
            mid: [0.0; 3],
        },
    }
}

/// One pixel of the dark scene engraved on `page`, as the shader's
/// `engrave` does it.
pub fn engrave(look: &Look, page: [f32; 3], dark: [f32; 3]) -> [f32; 3] {
    let level: f32 = (0..3).map(|i| dark[i] * LUMA[i]).sum();
    let g = (level / ENGRAVE_WHITE).clamp(0.0, 1.0).powf(ENGRAVE_GAMMA);
    let t = 1.0 - g;
    [0, 1, 2].map(|i| {
        let ink = if t < MID_AT {
            mix(look.deep[i], look.mid[i], t / MID_AT)
        } else {
            mix(look.mid[i], page[i], (t - MID_AT) / (1.0 - MID_AT))
        };
        ink.min(page[i])
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
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
        // Only the plate at rest and the quiet string across the seam.
        for f in [before, after] {
            assert!(f.high <= f.low.max(0.0), "{f:?}");
            assert!(f.belts.iter().all(|b| b[0] == 0.0), "{f:?}");
            assert!(f.waves.iter().all(|w| w[1] == 0.0 && w[2] == 0.0));
            assert_eq!(f.nest, [0.0, 0.0]);
            assert!(f.voice[0] < 1e-3);
            let rest = if f.mode_mix > 0.5 {
                f.mode_to
            } else {
                f.mode_from
            };
            assert_eq!(rest, PLATE_MODES[0]);
        }
    }

    #[test]
    fn the_first_phrase_comes_at_once() {
        // Art: «9 секунд без сюжета это слишком много».
        const _: () = assert!(PHRASES[0] <= 1.5);
        assert!(compose(PHRASES[0] + 0.5).waves[0][1] > 0.5);
    }

    #[test]
    fn the_spline_passes_through_its_keys_and_closes() {
        for keys in [&ELEVATION[..], &DISTANCE[..], &TARGET[..]] {
            for &(at, value) in keys {
                assert!(close(spline(keys, at), value, 1e-4), "{at}");
            }
            assert!(close(
                spline(keys, LOOP_SECONDS - 1e-3),
                spline(keys, 0.0),
                1e-3
            ));
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
                assert!((f.eye[i] - previous.eye[i]).abs() < 0.05, "eye at {t}");
                assert!(
                    (f.forward[i] - previous.forward[i]).abs() < 0.01,
                    "forward at {t}"
                );
            }
            assert!((f.low - previous.low).abs() < 0.05, "low at {t}");
            assert!((f.high - previous.high).abs() < 0.05, "high at {t}");
            for (a, b) in [
                (f.nest[0], previous.nest[0]),
                (f.nest[1], previous.nest[1]),
                (f.voice[0], previous.voice[0]),
            ] {
                assert!((a - b).abs() < 0.03, "light at {t}");
            }
            for k in 0..7 {
                assert!(
                    (f.belts[k][1] - previous.belts[k][1]).abs() < 0.06,
                    "belt {k} light at {t}"
                );
            }
            for i in 0..WAVES {
                for j in 1..3 {
                    assert!(
                        (f.waves[i][j] - previous.waves[i][j]).abs() < 0.08,
                        "wave {i} at {t}"
                    );
                }
            }
            previous = f;
            t += step;
        }
    }

    #[test]
    fn each_phrase_builds_its_own_belt_from_the_crown_down() {
        for k in 0..7 {
            let b = belt_of(k);
            let before = compose(PHRASES[k] - 0.01);
            assert!(before.belts[b][0] == 0.0, "{k} too early");
            let done = PHRASES[k] + belt_end(b) / WAVE_SPEED;
            let after = compose(done + 0.1);
            for (j, belt) in after.belts.iter().enumerate() {
                assert_eq!(belt[0] == 1.0, j >= b, "{k}: belt {j} at {}", belt[0]);
            }
            assert!(compose(done + BELT_FADE + 0.1).belts[b][1] >= 1.0, "{k}");
            // The sand has taken the phrase's figure.
            assert_eq!(compose(PHRASES[k] + 1.5).mode_to, PLATE_MODES[k + 1]);
            assert_eq!(compose(PHRASES[k] + 1.5).mode_mix, 1.0);
        }
        assert_eq!(belt_of(0), 6, "«Я Здесь» lights the crown");
        // «Я Есть» sets the whole dome on the plate.
        let f = compose(PULSES[0]);
        assert!(close(f.low, 0.0, 1e-6) && close(f.high, FRAC_PI_2, 1e-6));
    }

    #[test]
    fn every_belt_comes_up_softly() {
        // Art: the first step came in sharply, the others softly.
        for (k, &from) in PHRASES.iter().enumerate() {
            let b = belt_of(k);
            let arrive = from + path_to(BELTS[b + 1].to_radians()) / WAVE_SPEED;
            assert!(compose(arrive + 0.3).belts[b][1] < 0.5, "{k}");
            let mut previous = compose(arrive - 0.5).belts[b][1];
            let mut t = arrive - 0.5;
            while t < arrive + 4.0 {
                let light = compose(t).belts[b][1];
                assert!((light - previous).abs() < 0.03, "{k} at {t}");
                previous = light;
                t += 1.0 / 60.0;
            }
        }
    }

    #[test]
    fn the_camera_climbs_with_the_dome_and_looks_down_on_the_crown() {
        let mut previous = compose(0.0).elevation;
        for (k, &at) in PHRASES.iter().enumerate().skip(1) {
            let e = compose(at).elevation;
            assert!(e > previous, "{k}");
            previous = e;
        }
        let mut t = 0.0;
        while t < LOOP_SECONDS {
            let f = compose(t);
            assert!(f.elevation.to_degrees() < 88.0, "{t}");
            assert!(f.elevation.to_degrees() > 5.0, "{t}");
            t += 0.05;
        }
        for &at in &PULSES {
            assert!(compose(at).elevation.to_degrees() > 75.0, "{at}");
        }
    }

    #[test]
    fn the_dome_stays_inside_the_frame() {
        let mut t = 0.0;
        while t < LOOP_SECONDS {
            let f = compose(t);
            let shown = f.high - f.low.max(0.0);
            let shells = [(1.0, shown), (NEST[0], f.nest[0]), (NEST[1], f.nest[1])];
            for (r, on) in shells {
                if on <= 0.0 {
                    continue;
                }
                let (from, to) = if r == 1.0 {
                    (f.low.max(0.0), f.high)
                } else {
                    (0.0, FRAC_PI_2)
                };
                for lat in (0..=6).map(|k| from + k as f32 / 6.0 * (to - from)) {
                    for lon in (0..24).map(|k| k as f32 * 15.0_f32.to_radians()) {
                        let p = [
                            r * lat.cos() * lon.sin(),
                            r * lat.sin(),
                            r * lat.cos() * lon.cos(),
                        ];
                        let [x, y] = project(&f, p).expect("in front");
                        assert!(x.abs() < 0.92 && y.abs() < 0.88, "{t}: {r} {x} {y}");
                    }
                }
            }
            // The string's top stays in view.
            let [_, y] = project(&f, [0.0, VOICE_HEIGHT, 0.0]).expect("in front");
            assert!(y.abs() < 0.8, "{t}");
            t += 0.25;
        }
    }

    #[test]
    fn the_verbs_read_the_closed_dome_and_the_frame_opens() {
        for (i, &at) in PULSES.iter().enumerate() {
            let w = compose(at + 1.2).waves[PHRASES.len() + i];
            assert!(w[1] > 0.5, "{i}");
            assert!(w[0] > 1.0, "{i}: climbing the dome");
        }
        let f = compose(STILL);
        assert!(f.nest.iter().all(|&n| n > 0.99));
        assert!(close(f.low, 0.0, 1e-6) && close(f.high, FRAC_PI_2, 1e-6));
        assert!(f.belts.iter().all(|b| b[0] == 1.0 && b[1] > 0.99));
    }

    #[test]
    fn the_light_themes_never_light_the_page() {
        let pages = [
            (1, rgb(0xFA, 0xE1, 0x8F)),
            (5, rgb(0xF1, 0xDF, 0xB8)),
            (6, rgb(0xF3, 0xD8, 0xC7)),
        ];
        for (code, page) in pages {
            let look = look(code);
            assert!(look.light);
            for level in 0..=40 {
                let v = level as f32 / 20.0;
                let ink = engrave(&look, page, [v * 0.5, v, v * 0.6]);
                for i in 0..3 {
                    assert!(ink[i] <= page[i] + 1e-6);
                }
            }
            assert_eq!(engrave(&look, page, [0.0; 3]), page);
        }
        for code in [0, 2, 3, 4] {
            assert!(!look(code).light);
        }
    }
}
