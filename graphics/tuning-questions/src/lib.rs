//! «Вопросы настройки»: Step 4, page 06/15. «Теперь — скажи вслух любой
//! вывод. И задай себе вопросы». The seated person of pages 04 and 05 says
//! a conclusion aloud; the voice lays it in the air at the lips' height as a sound wave,
//! one swell per syllable, with a full stop — any conclusion, so no letters.
//! Then the page's four questions, one at a time:
//! «Откуда пришёл этот вывод?» — a light goes back along the wave, from the
//! full stop to the lips, and the focus follows it; then sights run over
//! points of the body, the same short look at each, none chosen.
//! «Что явилось стартовой точкой? (ощущение, образ, мысль?)» — an empty ring
//! at the start of the wave; the three words are lit in turn, equally, each
//! with its own picture: a wave rises through the body, a framed image
//! appears beside the head, a short phrase appears beside the head.
//! «Есть ли факт, или это интерпретация?» — the focus moves between the line
//! and what is here (the person, the chair, the floor) and back, then both
//! are sharp. Nothing is labelled as one or the other.
//! «Что я чувствую телом, пока думаю это?» — the line stays lit while a calm
//! scan passes through the whole body, crown to soles, into the floor.
//! Then the line dissolves and the room is wide again.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time. The browser adapter only uploads the values and the shaders only
//! paint them.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod generated;
pub mod geometry;

use std::f32::consts::{PI, TAU};
use watcher_scene_palette::Palette;

/// Authored frame, 3 : 2 like the other Step 4 scenes.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// The instruction and the four questions: a seamless loop.
pub const LOOP_SECONDS: f32 = 70.0;
/// Reduced motion holds this moment: the line and the person both sharp,
/// «Есть ли факт, или это интерпретация?» on the card.
pub const STILL: f32 = 51.6;

/// Metres per unit of the approved figure (spoken-thought-person.svg): 1.3 m
/// from the soles to the crown, as a seated adult.
pub const UNIT: f32 = 1.3 / 505.0;
/// Size of the figure's SVG in its own units.
pub const FIGURE_SVG: [f32; 2] = [335.0, 530.0];
/// The soles of the figure (and the chair's legs) stand on this SVG row.
pub const FLOOR_SVG: f32 = 518.6;
/// The SVG column placed at the world's x = 0.
pub const ORIGIN_SVG: f32 = 160.0;
/// The crown of the head (SVG row): where the scan starts.
pub const CROWN_SVG: f32 = 14.0;

/// A point of the figure in world metres (the figure stands in the plane z = 0).
pub const fn on_figure(x: f32, y: f32) -> [f32; 3] {
    [(x - ORIGIN_SVG) * UNIT, (FLOOR_SVG - y) * UNIT, 0.0]
}
/// World rectangle of the figure: left, bottom, right, top.
pub const FIGURE: [f32; 4] = [
    -ORIGIN_SVG * UNIT,
    (FLOOR_SVG - FIGURE_SVG[1]) * UNIT,
    (FIGURE_SVG[0] - ORIGIN_SVG) * UNIT,
    FLOOR_SVG * UNIT,
];
pub const EYE: [f32; 3] = on_figure(117.0, 56.0);
pub const MOUTH: [f32; 3] = on_figure(131.0, 87.0);
pub const HEEL: [f32; 3] = on_figure(234.0, FLOOR_SVG);
pub const BALL: [f32; 3] = on_figure(296.0, FLOOR_SVG);
pub const CHAIR_LEGS: [[f32; 3]; 2] = [on_figure(20.0, FLOOR_SVG), on_figure(176.0, FLOOR_SVG)];

/// The conclusion: a sound wave in the air before the face, at the height
/// of the lips, a little nearer the camera than the person, so the lens can
/// tell them apart. Its axis: height, depth, where it starts.
pub const LINE_Y: f32 = MOUTH[1];
pub const LINE_Z: f32 = -0.55;
pub const LINE_X: f32 = 0.17;
/// The wave: its greatest height off the axis and its wavelength (m), and
/// the silence between words.
pub const WAVE_AMP: f32 = 0.028;
pub const WAVELENGTH: f32 = 0.0125;
pub const GAP: f32 = 0.028;
/// The full stop: its gap after the last word and its radius.
pub const DOT_GAP: f32 = 0.03;
pub const DOT_RADIUS: f32 = 0.0095;
/// The spoken words: when each is said, how long, how long it lies (m).
pub const WORDS: [(f32, f32, f32); 5] = [
    (3.4, 0.42, 0.085),
    (3.95, 0.55, 0.15),
    (4.65, 0.3, 0.06),
    (5.3, 0.52, 0.13),
    (6.0, 0.4, 0.09),
];
/// Syllables of each word: one swell of the wave each.
pub const SYLLABLES: [u32; 5] = [2, 3, 1, 3, 2];
/// The full stop lands.
pub const STOP_AT: f32 = 6.62;
/// Where the voice leaves the lips towards the line (a quadratic curve).
pub const BEND: [f32; 3] = [0.05, 1.125, -0.3];

/// The start and end (world x) of word `i` on the line.
pub fn word_span(i: usize) -> [f32; 2] {
    let mut x = LINE_X;
    for (k, w) in WORDS.iter().enumerate() {
        if k == i {
            return [x, x + w.2];
        }
        x += w.2 + GAP;
    }
    [x, x]
}
/// The centre of the full stop.
pub fn stop_at() -> [f32; 3] {
    let end = word_span(WORDS.len() - 1)[1];
    [end + DOT_GAP + DOT_RADIUS, LINE_Y, LINE_Z]
}
/// The start of the line: the point the voice first reaches.
pub const START: [f32; 3] = [LINE_X - 0.012, LINE_Y, LINE_Z];

/// How loud the conclusion is at a point of the line (0..1): one swell per
/// syllable, quiet at the ends of a word, silent between words.
pub fn envelope(x: f32) -> f32 {
    for (i, syllables) in SYLLABLES.iter().enumerate() {
        let [x0, x1] = word_span(i);
        if x < x0 || x > x1 {
            continue;
        }
        let s = (x - x0) / (x1 - x0);
        let n = *syllables as f32;
        let j = ((s * n) as u32).min(syllables - 1);
        let q = s * n - j as f32;
        let swell = (PI * q).sin().max(0.0).powf(0.8) * (0.6 + 0.4 * hash(31 + 7 * i as u32 + j));
        let ends = (PI * s).sin().max(0.0).powf(0.35);
        return ends * (0.22 + 0.78 * swell);
    }
    0.0
}
/// The conclusion's wave at a point of the line: its height off the axis
/// (m). Strand 0 is the voice, strand 1 a quieter overtone beside it.
pub fn wave(x: f32, strand: u32) -> f32 {
    let Some(i) = (0..WORDS.len()).find(|i| {
        let [x0, x1] = word_span(*i);
        x >= x0 && x <= x1
    }) else {
        return 0.0;
    };
    // Each word has its own pitch.
    let pitch = 0.85 + 0.3 * hash(61 + i as u32);
    let k = TAU * (x - word_span(i)[0]) / WAVELENGTH * pitch;
    let v = if strand == 0 {
        k.sin() + 0.3 * (2.3 * k + 0.7).sin()
    } else {
        0.55 * (1.18 * k + 1.9).sin() + 0.2 * (3.1 * k).sin()
    };
    WAVE_AMP * envelope(x) * v / 1.3
}

/// A point on the quadratic curve a → c bending towards b.
pub fn curve(a: [f32; 3], b: [f32; 3], c: [f32; 3], t: f32) -> [f32; 3] {
    let u = 1.0 - t;
    std::array::from_fn(|k| u * u * a[k] + 2.0 * u * t * b[k] + t * t * c[k])
}
fn distance(a: [f32; 3], b: [f32; 3]) -> f32 {
    ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt()
}
/// Length of the voice's way from the lips to the start of the line.
pub fn thread_length() -> f32 {
    (0..24)
        .map(|i| {
            distance(
                curve(MOUTH, BEND, START, i as f32 / 24.0),
                curve(MOUTH, BEND, START, (i + 1) as f32 / 24.0),
            )
        })
        .sum()
}
/// The whole way of the conclusion, lips (0) → start of the line → full
/// stop (1), by length: where the light that goes back is.
pub fn route(u: f32) -> [f32; 3] {
    let thread = thread_length();
    let line = stop_at()[0] - START[0];
    let s = u.clamp(0.0, 1.0) * (thread + line);
    if s <= thread {
        // Nearly even along the curve: its speed changes little.
        curve(MOUTH, BEND, START, s / thread)
    } else {
        [START[0] + (s - thread), LINE_Y, LINE_Z]
    }
}
/// The share of the route that is the voice's way (before the line).
pub fn thread_share() -> f32 {
    let thread = thread_length();
    thread / (thread + stop_at()[0] - START[0])
}

/// The first question: the light goes back from the full stop to the lips.
pub const TRACE: [f32; 2] = [12.0, 17.0];
/// Then sights run over points of the body (SVG): the same glide and the
/// same short look at each, in no order of importance.
pub const SIGHTS: [[f32; 2]; 6] = [
    [105.0, 182.0],
    [92.0, 42.0],
    [96.0, 118.0],
    [98.0, 228.0],
    [226.0, 287.0],
    [262.0, 497.0],
];
pub const SIGHT_AT: f32 = 18.8;
pub const SIGHT_STEP: f32 = 1.0;
pub const SIGHT_GLIDE: f32 = 0.45;
/// The second question: each possible starting point is lit for the same
/// time (rise, hold, fall); the start of the line answers each equally.
pub const OPTIONS: [f32; 3] = [28.0, 31.6, 35.2];
pub const OPTION_SECONDS: f32 = 3.4;
/// «Ощущение»: a wave rises through the body, soles to crown (s).
pub const RIPPLE_SECONDS: f32 = 1.9;
/// «Образ» and «мысль» appear beside the head, behind it: the centre of
/// the image and of the phrase (world).
pub const THOUGHT_AT: [f32; 3] = [-0.6, 1.36, -0.04];
/// The fourth question: the scan, crown to soles.
pub const SCAN: [f32; 2] = [55.6, 61.6];
/// The cards: the instruction, then the four questions (in, out).
pub const CARDS: [[f32; 2]; 5] = [
    [1.6, 9.4],
    [10.4, 25.0],
    [25.6, 40.4],
    [41.0, 52.8],
    [53.4, 65.0],
];
/// The line dissolves (start, end).
pub const DISSOLVE: [f32; 2] = [64.8, 67.8];

pub fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
pub fn bell(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}
pub fn hash(n: u32) -> f32 {
    let mut x = n.wrapping_mul(0x9E37_79B9) ^ 0x85EB_CA6B;
    x ^= x >> 15;
    x = x.wrapping_mul(0x2C1B_3C6D);
    x ^= x >> 12;
    x = x.wrapping_mul(0x297A_2D39);
    x ^= x >> 15;
    (x & 0x00FF_FFFF) as f32 / 16_777_216.0
}
pub fn lerp3(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    std::array::from_fn(|i| a[i] + (b[i] - a[i]) * t)
}
/// Mostly even speed, easing a little at both ends.
fn glide(a: f32, b: f32, t: f32) -> f32 {
    let x = ((t - a) / (b - a)).clamp(0.0, 1.0);
    0.65 * x + 0.35 * x * x * (3.0 - 2.0 * x)
}

/// A pinhole camera looking along +z with a real lens: `focus` is the
/// sharp distance and `aperture` the lens diameter in metres.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Camera {
    pub eye: [f32; 3],
    /// Focal length in authored px.
    pub focal: f32,
    /// Where the line of sight meets the frame (lens shift), authored px.
    pub center: [f32; 2],
    pub focus: f32,
    pub aperture: f32,
}
/// A projected point: authored px, px per metre at its depth, and the depth.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Projected {
    pub at: [f32; 2],
    pub scale: f32,
    pub depth: f32,
}
impl Camera {
    pub const NEAR: f32 = 0.08;
    pub fn project(&self, p: [f32; 3]) -> Option<Projected> {
        let depth = p[2] - self.eye[2];
        if depth < Self::NEAR {
            return None;
        }
        let scale = self.focal / depth;
        Some(Projected {
            at: [
                self.center[0] + (p[0] - self.eye[0]) * scale,
                self.center[1] - (p[1] - self.eye[1]) * scale,
            ],
            scale,
            depth,
        })
    }
    /// Radius of the circle of confusion (authored px) at a depth: thin lens.
    pub fn coc(&self, depth: f32) -> f32 {
        let depth = depth.max(Self::NEAR);
        0.5 * self.aperture * self.focal * (depth - self.focus).abs() / (depth * self.focus)
    }
    /// Distance from the lens to the figure's plane.
    pub fn subject(&self) -> f32 {
        -self.eye[2]
    }
}

/// One framing of the film.
#[derive(Clone, Copy, Debug, PartialEq)]
struct Shot {
    eye: [f32; 3],
    focal: f32,
    horizon: f32,
    aperture: f32,
}
const fn shot(eye: [f32; 3], focal: f32, horizon: f32, aperture: f32) -> Shot {
    Shot {
        eye,
        focal,
        horizon,
        aperture,
    }
}
/// The whole room, the seated person and the air before the face.
const WIDE: Shot = shot([0.25, 0.85, -4.2], 1450.0, 480.0, 0.02);
/// The camera's moves: each one starts, eases and arrives (start, end, shot).
const MOVES: [(f32, f32, Shot); 9] = [
    // «Скажи вслух любой вывод»: the face and the air above it.
    (1.2, 4.6, shot([0.32, 1.2, -2.4], 1500.0, 460.0, 0.035)),
    // «Откуда пришёл этот вывод?»: close, the whole wave and the face.
    (9.6, 12.0, shot([0.38, 1.15, -1.8], 1550.0, 430.0, 0.05)),
    // Drifting back with the light, towards the lips.
    (
        12.0,
        TRACE[1],
        shot([0.2, 1.13, -1.65], 1550.0, 450.0, 0.05),
    ),
    // The sights: the whole body, the wave above it.
    (17.2, 19.6, shot([0.15, 0.85, -2.9], 1350.0, 455.0, 0.02)),
    // «Что явилось стартовой точкой?»: the start of the wave, the whole
    // body and the air beside the head.
    (24.6, 27.2, shot([0.25, 0.95, -2.75], 1300.0, 400.0, 0.018)),
    // «Есть ли факт, или это интерпретация?»: close, the wave large and
    // near, the person behind it, a wide lens that can only hold one of
    // them sharp.
    (40.0, 43.0, shot([0.38, 1.15, -1.6], 1300.0, 330.0, 0.07)),
    // Then the lens closes: both are seen at once.
    (49.8, 51.4, shot([0.38, 1.15, -1.62], 1300.0, 330.0, 0.007)),
    // «Что я чувствую телом, пока думаю это?»: the whole body and the wave.
    (53.0, 56.0, shot([0.2, 0.85, -3.3], 1450.0, 470.0, 0.02)),
    (64.6, 69.0, WIDE),
];
fn blend(a: Shot, b: Shot, t: f32) -> Shot {
    Shot {
        eye: lerp3(a.eye, b.eye, t),
        focal: a.focal + (b.focal - a.focal) * t,
        horizon: a.horizon + (b.horizon - a.horizon) * t,
        aperture: a.aperture + (b.aperture - a.aperture) * t,
    }
}
/// Where the focus lies (world z): the person's plane is 0, the line is
/// `LINE_Z`. (start, end, plane), each eased.
const FOCUS: [(f32, f32, f32); 8] = [
    // The words are laid: the focus goes to them.
    (3.2, 4.6, LINE_Z),
    // The first question replaces this span with the light going back;
    // the sights then stay on the person.
    (TRACE[0], TRACE[1], 0.0),
    // The start of the wave and the person: between them, both seen.
    (25.6, 27.4, LINE_Z * 0.4),
    // Fact or interpretation: the wave, the person, the wave, between.
    (41.4, 43.0, LINE_Z),
    (44.8, 46.8, 0.0),
    (47.6, 49.2, LINE_Z),
    (49.8, 51.4, LINE_Z * 0.6),
    (52.6, 54.6, 0.0),
];

/// The light going back, lips (0) … full stop (1).
pub fn trace_at(t: f32) -> f32 {
    1.0 - glide(TRACE[0], TRACE[1], t)
}
/// The plane the lens is focused on at a loop time.
pub fn focus_plane(t: f32) -> f32 {
    if t > TRACE[0] && t < TRACE[1] {
        // The focus follows the light: on the line, then down its way to the lips.
        return route(trace_at(t))[2];
    }
    let mut z = 0.0;
    for (start, end, to) in FOCUS {
        if t >= end {
            z = to;
        } else if t > start {
            z += (to - z) * smooth(start, end, t);
            break;
        } else {
            break;
        }
    }
    z
}

/// The camera at a loop time. Moves ease in and out; a slow breathing drift
/// (periodic in the loop) keeps the frame alive between them. The room comes
/// out of blur at the start and returns to it at the end of the loop.
pub fn camera(time: f32) -> Camera {
    let mut s = WIDE;
    for (start, end, next) in MOVES {
        if time >= end {
            s = next;
        } else if time > start {
            s = blend(s, next, smooth(start, end, time));
            break;
        } else {
            break;
        }
    }
    let w = time / LOOP_SECONDS * TAU;
    let drift = [
        0.012 * (2.0 * w).sin() + 0.006 * (5.0 * w).sin(),
        0.008 * (3.0 * w).sin(),
        0.02 * (2.0 * w).cos() - 0.02,
    ];
    let eye = [
        s.eye[0] + drift[0],
        s.eye[1] + drift[1],
        s.eye[2] + drift[2],
    ];
    let blur = 1.4 * (1.0 - smooth(0.3, 2.9, time)) + 1.4 * smooth(FADE, LOOP_SECONDS, time);
    Camera {
        eye,
        focal: s.focal,
        center: [SIZE[0] * 0.5, s.horizon],
        focus: (focus_plane(time) - eye[2]) * (1.0 + blur),
        aperture: s.aperture * (1.0 + 0.6 * blur.min(1.0)),
    }
}

/// A ring spreading over the floor (or in the air) from a point.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Ring {
    pub origin: [f32; 3],
    pub radius: f32,
    pub strength: f32,
}
/// How fast contact rings spread (m/s) and how long they live (s).
pub const RING_SPEED: f32 = 0.5;
pub const RING_LIFE: f32 = 3.4;
/// The scan reaches the soles: contact with the floor (time, strength).
const GROUND: [(f32, f32); 2] = [(61.5, 0.8), (62.9, 0.5)];
/// The room sinks back into the loop's seam from here.
const FADE: f32 = 67.4;

/// One front of the voice around the lips (world radius).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Wave {
    pub radius: f32,
    pub strength: f32,
}
pub const VOICE_SPEED: f32 = 1.4;
pub const REACH: f32 = 2.4;

/// A sight over a point of the body: where (world), how visible, how far it
/// has settled on the point (0 gliding … 1 held) and the pulse of its
/// arrival (0..1 of its life, 0 none).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Sight {
    pub at: [f32; 3],
    pub alpha: f32,
    pub settle: f32,
    pub lock: f32,
}
/// The end of the sights.
pub const SIGHT_END: f32 = SIGHT_AT + SIGHTS.len() as f32 * SIGHT_STEP;
/// When the sight arrives at point `k` (it holds from here to the next step).
pub fn sight_arrives(k: usize) -> f32 {
    SIGHT_AT + k as f32 * SIGHT_STEP + SIGHT_GLIDE
}
pub fn sight(t: f32) -> Option<Sight> {
    let alpha = bell(
        t,
        SIGHT_AT - 0.4,
        SIGHT_AT + 0.1,
        SIGHT_END - 0.1,
        SIGHT_END + 0.5,
    );
    if alpha <= 0.0 {
        return None;
    }
    let k = (((t - SIGHT_AT) / SIGHT_STEP).max(0.0) as usize).min(SIGHTS.len() - 1);
    let into = t - SIGHT_AT - k as f32 * SIGHT_STEP;
    let (from, to) = (SIGHTS[k.saturating_sub(1)], SIGHTS[k]);
    // The first sight is already over its point when it appears.
    let g = if k == 0 {
        1.0
    } else {
        smooth(0.0, SIGHT_GLIDE, into)
    };
    let at = on_figure(
        from[0] + (to[0] - from[0]) * g,
        from[1] + (to[1] - from[1]) * g,
    );
    let held = into - SIGHT_GLIDE;
    Some(Sight {
        at: [at[0], at[1], -0.02],
        alpha,
        settle: smooth(0.0, 0.25, held),
        lock: if (0.0..0.5).contains(&held) {
            held / 0.5
        } else {
            0.0
        },
    })
}

/// All motion of one instant.
#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// Exposure of the room: low at the loop seam, full while practising.
    pub light: f32,
    pub breath: f32,
    /// Strength of the figure's contour.
    pub contour: f32,
    /// Loudness at the lips, 0..1, and the fronts in the air.
    pub voice: f32,
    pub waves: Vec<Wave>,
    /// How much of each word is laid (0..1).
    pub written: [f32; 5],
    /// The full stop: visible, and the pulse of its landing (0..1 of its life).
    pub stop: f32,
    pub landing: f32,
    /// Brightness of the conclusion while it stands.
    pub line: f32,
    /// The voice's way from the lips to the line.
    pub thread: f32,
    /// The light going back: where (route 0 lips … 1 full stop) and alpha;
    /// how much of the way it has lit stays lit; the glow at the lips.
    pub trace: [f32; 2],
    pub traced: f32,
    pub lips: f32,
    /// The sight running over the body, and a faint mark where it has looked.
    pub sight: Option<Sight>,
    pub marks: [f32; 6],
    /// The empty ring at the start of the line and its pulses.
    pub start: f32,
    pub pulses: Vec<Ring>,
    /// The three possible starting points on the card: base and lit.
    pub options: [f32; 3],
    pub listed: f32,
    /// «Ощущение»: two fronts rising through the body (SVG row, alpha each).
    pub ripple: [f32; 4],
    /// «Образ»: the image beside the head (alpha, how far it is drawn).
    pub image: [f32; 2],
    /// «Мысль»: the phrase beside the head (alpha, how much is written).
    pub phrase: [f32; 2],
    /// The scan: SVG row and alpha; what it has passed; contact rings.
    pub scan: [f32; 2],
    pub felt: f32,
    pub rings: Vec<Ring>,
    /// The card on screen and its visibility (0 instruction, 1–4 questions).
    pub card: usize,
    pub shown: f32,
    /// The conclusion dissolving at the end.
    pub dissolve: f32,
}

/// Loudness of the voice: one gentle swell per word.
pub fn loudness(t: f32) -> f32 {
    WORDS
        .iter()
        .enumerate()
        .map(|(i, (at, length, _))| {
            (0.6 + 0.3 * hash(17 + i as u32))
                * bell(t, at - 0.05, at + 0.1, at + length * 0.6, at + length)
        })
        .fold(0.0, f32::max)
}

/// The whole choreography at `seconds` (wrapped to the loop).
pub fn compose(seconds: f32) -> Frame {
    let t = if seconds.is_finite() {
        seconds.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let dissolve = smooth(DISSOLVE[0], DISSOLVE[1], t);
    // Gone once dissolved; the dissolving itself is drawn by the geometry.
    let standing = if t < DISSOLVE[1] { 1.0 } else { 0.0 };
    let written = std::array::from_fn(|i| {
        let (at, length, _) = WORDS[i];
        smooth(at, at + length, t) * standing
    });
    let mut waves = Vec::with_capacity(3);
    for i in [0, 2, 4] {
        let age = t - WORDS[i].0;
        let radius = age * VOICE_SPEED;
        if age > 0.0 && radius < REACH {
            waves.push(Wave {
                radius,
                strength: 0.5 * smooth(0.0, 0.2, radius) * (1.0 - radius / REACH).powf(1.5),
            });
        }
    }
    let mut pulses = Vec::with_capacity(3);
    for at in OPTIONS {
        let age = t - (at + 0.2);
        if age > 0.0 && age < 2.0 {
            pulses.push(Ring {
                origin: START,
                radius: 0.024 + 0.05 * age,
                strength: smooth(0.0, 0.15, age) * (1.0 - age / 2.0).powf(1.5),
            });
        }
    }
    let mut rings = Vec::with_capacity(GROUND.len() * 4);
    for (start, strength) in GROUND {
        let age = t - start;
        if age <= 0.0 || age >= RING_LIFE {
            continue;
        }
        let k = strength * smooth(0.0, 0.18, age) * (1.0 - age / RING_LIFE).powf(1.5);
        for o in [HEEL, BALL] {
            rings.push(Ring {
                origin: o,
                radius: 0.03 + age * RING_SPEED,
                strength: k,
            });
        }
    }
    let mut card = 0;
    let mut shown = 0.0;
    for (i, [a, b]) in CARDS.iter().enumerate() {
        if t >= a - 0.1 && t <= b + 0.1 {
            card = i;
            shown = bell(t, *a, a + 1.0, b - 0.8, *b);
        }
    }
    let lit = |at: f32| {
        bell(
            t,
            at,
            at + 0.45,
            at + OPTION_SECONDS - 0.45,
            at + OPTION_SECONDS,
        )
    };
    let scan = glide(SCAN[0], SCAN[1], t);
    // «Ощущение»: two fronts, one after the other, from below the soles to
    // above the crown.
    let front = |from: f32| {
        let u = glide(from, from + RIPPLE_SECONDS, t);
        let (low, high) = (FLOOR_SVG + 24.0, CROWN_SVG - 40.0);
        let alpha = bell(
            t,
            from - 0.1,
            from + 0.3,
            from + RIPPLE_SECONDS - 0.5,
            from + RIPPLE_SECONDS,
        );
        (low + (high - low) * u, alpha)
    };
    let (first, second) = (front(OPTIONS[0] + 0.35), front(OPTIONS[0] + 1.15));
    let held = |at: f32| {
        bell(
            t,
            at + 0.15,
            at + 0.6,
            at + OPTION_SECONDS - 0.5,
            at + OPTION_SECONDS,
        )
    };
    let marks = std::array::from_fn(|k| {
        let at = sight_arrives(k);
        0.5 * bell(t, at, at + 0.3, SIGHT_END + 0.2, SIGHT_END + 1.0)
    });
    Frame {
        time: t,
        camera: camera(t),
        light: 0.34 + 0.66 * smooth(0.0, 2.6, t) - 0.66 * smooth(FADE, LOOP_SECONDS, t),
        // Twelve breaths per loop.
        breath: 0.5 - 0.5 * (t / LOOP_SECONDS * 12.0 * TAU).cos(),
        contour: 0.3 + 0.55 * smooth(0.4, 2.6, t) - 0.55 * smooth(FADE, LOOP_SECONDS, t),
        voice: loudness(t),
        waves,
        written,
        stop: smooth(STOP_AT - 0.08, STOP_AT + 0.05, t) * standing,
        landing: if t > STOP_AT && t < STOP_AT + 1.6 {
            (t - STOP_AT) / 1.6
        } else {
            0.0
        },
        // Bright while it is said, steady while it stands, a little more
        // present while the body is felt «пока думаю это».
        line: 0.62 + 0.38 * bell(t, 3.3, 3.6, 6.8, 8.6) + 0.18 * bell(t, 54.0, 55.4, 62.6, 64.6),
        thread: 0.85 * bell(t, 3.2, 3.5, 6.7, 8.2) + 0.1 * smooth(6.7, 8.2, t) * (1.0 - dissolve),
        trace: [
            trace_at(t),
            bell(t, 11.7, 12.2, TRACE[1] - 0.15, TRACE[1] + 0.5),
        ],
        traced: bell(t, 12.0, 12.6, 17.6, 19.4),
        lips: bell(
            t,
            TRACE[1] - 0.5,
            TRACE[1] + 0.3,
            TRACE[1] + 1.1,
            TRACE[1] + 2.8,
        ),
        sight: sight(t),
        marks,
        start: bell(t, 26.2, 27.2, 39.4, 40.4),
        pulses,
        options: [lit(OPTIONS[0]), lit(OPTIONS[1]), lit(OPTIONS[2])],
        listed: bell(t, 26.6, 27.6, 39.2, 40.2),
        ripple: [first.0, first.1, second.0, second.1],
        image: [
            held(OPTIONS[1]),
            smooth(OPTIONS[1] + 0.2, OPTIONS[1] + 1.7, t),
        ],
        phrase: [
            held(OPTIONS[2]),
            ((t - OPTIONS[2] - 0.55) / 1.2).clamp(0.0, 1.0),
        ],
        scan: [
            CROWN_SVG + scan * (FLOOR_SVG - CROWN_SVG),
            bell(
                t,
                SCAN[0] - 0.3,
                SCAN[0] + 0.3,
                SCAN[1] - 0.2,
                SCAN[1] + 0.4,
            ),
        ],
        felt: bell(
            t,
            SCAN[0] + 0.4,
            SCAN[0] + 1.6,
            SCAN[1] + 1.0,
            SCAN[1] + 2.6,
        ),
        rings,
        card,
        shown,
        dissolve,
    }
}

/// Colors for the composite pass: the page, the ink of the room and of the
/// conclusion (red channel), the light of the person and of the questions
/// (green), the person's body (blue) and the haze of the bloom on light pages.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub paper: [f32; 3],
    pub room: [f32; 3],
    pub person: [f32; 3],
    pub body: [f32; 3],
    pub haze: [f32; 3],
    pub light: bool,
}
const fn rgb(v: u32) -> [f32; 3] {
    [
        ((v >> 16) & 255) as f32 / 255.0,
        ((v >> 8) & 255) as f32 / 255.0,
        (v & 255) as f32 / 255.0,
    ]
}
fn mix(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    lerp3(a, b, t)
}
/// The app theme by its `graphicsPalette` code. Light themes (Дюна, Мираж,
/// Рассвет) lay ink on a pale page; dark themes light a dark room.
pub fn look(code: u32) -> Look {
    let palette = Palette::from_code(code);
    let dark = |paper: [f32; 3], accent: [f32; 3], highlight: [f32; 3]| Look {
        paper,
        room: accent,
        person: mix(highlight, [1.0; 3], 0.25),
        body: mix(paper, [0.0; 3], 0.45),
        haze: accent,
        light: false,
    };
    match palette {
        // Дюна: a soft sepia print, brown ink on sand, never an orange flood.
        Palette::Light => {
            let paper = rgb(0xFAE18F);
            Look {
                paper,
                room: rgb(0xC9601E),
                person: rgb(0x8E3A00),
                body: mix(paper, rgb(0xFFF4D0), 0.35),
                haze: mix(paper, rgb(0xBE4C00), 0.35),
                light: true,
            }
        }
        Palette::Original => dark(rgb(0x000000), rgb(0xF5DD07), rgb(0xF5DD07)),
        _ => match palette.colors() {
            Some(c) if palette.is_light() => Look {
                paper: c.paper,
                room: c.accent,
                person: c.highlight,
                body: mix(c.paper, [1.0; 3], 0.3),
                haze: mix(c.paper, c.detail, 0.5),
                light: true,
            },
            Some(c) => dark(c.paper, c.accent, c.highlight),
            None => dark(rgb(0x000000), rgb(0xF5DD07), rgb(0xF5DD07)),
        },
    }
}

/// The card's rows: label row in the atlas and its kind.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    /// The quiet half of a sentence.
    Lead,
    /// The bright half.
    Key,
    /// One of the possible starting points (index 0..3).
    Option(usize),
}
/// The rows of each card, in the atlas order of `tools/prepare-assets.mjs`.
pub fn card_rows(card: usize) -> &'static [(usize, Kind)] {
    const ROWS: [&[(usize, Kind)]; 5] = [
        &[(0, Kind::Lead), (1, Kind::Key)],
        &[(2, Kind::Lead), (3, Kind::Key)],
        &[
            (4, Kind::Lead),
            (5, Kind::Key),
            (6, Kind::Option(0)),
            (7, Kind::Option(1)),
            (8, Kind::Option(2)),
        ],
        &[
            (9, Kind::Lead),
            (10, Kind::Key),
            (11, Kind::Lead),
            (12, Kind::Key),
        ],
        &[(13, Kind::Lead), (14, Kind::Key)],
    ];
    ROWS[card.min(4)]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }
    fn times(step: f32) -> impl Iterator<Item = f32> {
        (0..(LOOP_SECONDS / step) as usize).map(move |i| i as f32 * step)
    }

    #[test]
    fn the_loop_has_no_seam() {
        let (a, b) = (compose(0.0), compose(LOOP_SECONDS));
        assert_eq!(a, b);
        let (x, y) = (compose(LOOP_SECONDS - 0.004), compose(0.004));
        for (p, q) in [
            (x.light, y.light),
            (x.contour, y.contour),
            (x.line, y.line),
            (x.shown, y.shown),
            (x.stop, y.stop),
        ] {
            assert!(close(p, q, 0.01), "{p} vs {q}");
        }
        for e in 0..3 {
            assert!(close(x.camera.eye[e], y.camera.eye[e], 0.003));
        }
        assert!(close(x.camera.focus, y.camera.focus, 0.02));
        // Nothing of the conclusion is left at the seam.
        assert!(x.written.iter().all(|w| *w == 0.0) && y.written.iter().all(|w| *w == 0.0));
    }

    #[test]
    fn the_camera_never_jumps() {
        let mut previous = camera(0.0);
        for t in times(0.01).skip(1) {
            let c = camera(t);
            for e in 0..3 {
                assert!(close(c.eye[e], previous.eye[e], 0.025), "eye at {t}");
            }
            assert!(close(c.focal, previous.focal, 4.0));
            assert!(close(c.center[1], previous.center[1], 4.0), "shift at {t}");
            assert!(close(c.focus, previous.focus, 0.05), "focus at {t}");
            assert!(
                close(c.aperture, previous.aperture, 0.003),
                "aperture at {t}"
            );
            previous = c;
        }
    }

    #[test]
    fn values_stay_finite_and_bounded() {
        for t in times(0.01) {
            let f = compose(t);
            for v in [
                f.light, f.breath, f.contour, f.voice, f.stop, f.landing, f.line, f.thread,
                f.trace[0], f.trace[1], f.traced, f.lips, f.start, f.listed, f.scan[1], f.felt,
                f.shown, f.dissolve,
            ] {
                assert!(v.is_finite() && (0.0..=1.0).contains(&v), "{v} at {t}");
            }
            assert!(f
                .written
                .iter()
                .chain(&f.options)
                .chain(&f.marks)
                .chain(&f.image)
                .chain(&f.phrase)
                .chain([&f.ripple[1], &f.ripple[3]])
                .all(|v| (0.0..=1.0).contains(v)));
            if let Some(s) = f.sight {
                for v in [s.alpha, s.settle, s.lock] {
                    assert!((0.0..=1.0).contains(&v), "sight {v} at {t}");
                }
                assert!(s.at.iter().all(|v| v.is_finite()));
            }
            for row in [f.ripple[0], f.ripple[2]] {
                assert!((CROWN_SVG - 40.0..=FLOOR_SVG + 24.0).contains(&row));
            }
            assert!(f.scan[0] >= CROWN_SVG && f.scan[0] <= FLOOR_SVG);
            for r in f.rings.iter().chain(&f.pulses) {
                assert!(r.radius > 0.0 && r.strength.is_finite() && r.strength >= 0.0);
            }
            assert!(
                f.waves.len() <= 2,
                "a calm voice: {} fronts at {t}",
                f.waves.len()
            );
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
    }

    #[test]
    fn the_page_is_told_in_order() {
        // The conclusion is said and stands before the first question.
        let said = compose(7.5);
        assert!(said.written.iter().all(|w| *w > 0.99) && said.stop > 0.99);
        assert_eq!(compose(5.0).card, 0);
        // Each question has its own card, in the page's order.
        for (k, t) in [(1, 14.0), (2, 33.0), (3, 46.0), (4, 58.0)] {
            let f = compose(t);
            assert!(f.card == k && f.shown > 0.99, "card {k} at {t}");
        }
        // The light goes back from the full stop to the lips, and only that far.
        assert!(compose(TRACE[0] + 0.01).trace[0] > 0.99);
        assert!(compose(TRACE[1]).trace[0] < 0.01);
        let lips = route(0.0);
        assert!(close(lips[0], MOUTH[0], 1e-4) && close(lips[1], MOUTH[1], 1e-4));
        let mut previous = 1.0;
        for t in times(0.05).filter(|t| *t > TRACE[0] && *t < TRACE[1]) {
            let u = compose(t).trace[0];
            assert!(u <= previous + 1e-5, "the light never turns at {t}");
            previous = u;
        }
        // The lens follows it: sharp on the line first, on the lips at the end.
        assert!(close(
            compose(TRACE[0] + 0.5).camera.focus,
            LINE_Z - compose(TRACE[0] + 0.5).camera.eye[2],
            0.02
        ));
        let end = compose(TRACE[1] + 0.2);
        assert!(close(end.camera.focus, -end.camera.eye[2], 0.03));
        // Only then the sights run over the body, while the question stands.
        assert!(compose(TRACE[1]).sight.is_none());
        assert!(compose(SIGHT_AT + 0.5).sight.is_some() && compose(SIGHT_AT + 0.5).card == 1);
        assert!(compose(SIGHT_END).card == 1);
        // The scan goes from the crown down to the soles, then the floor answers.
        assert!(compose(SCAN[0] + 1.0).scan[0] < compose(SCAN[0] + 3.0).scan[0]);
        assert!(compose(SCAN[1]).scan[0] > FLOOR_SVG - 0.5);
        assert!(!compose(SCAN[1] + 0.8).rings.is_empty());
        // The conclusion is still lit while the body is felt.
        let thinking = compose(SCAN[0] + 2.0);
        assert!(thinking.line > 0.7 && thinking.written[4] > 0.99);
    }

    #[test]
    fn no_starting_point_is_chosen() {
        // Each word is lit for the same time and as brightly; the ring at the
        // start of the line answers each the same way.
        let mut lit = [0.0; 3];
        let mut peak = [0.0_f32; 3];
        for t in times(0.01) {
            let f = compose(t);
            for i in 0..3 {
                lit[i] += f.options[i] * 0.01;
                peak[i] = peak[i].max(f.options[i]);
            }
            assert!(f.options.iter().filter(|v| **v > 0.5).count() <= 1);
        }
        for i in 1..3 {
            assert!(close(lit[i], lit[0], 0.02) && close(peak[i], peak[0], 0.01));
        }
        // Each starting point shows its own picture, only while it is lit.
        for t in times(0.01) {
            let f = compose(t);
            let during = |i: usize| t >= OPTIONS[i] && t <= OPTIONS[i] + OPTION_SECONDS;
            for (i, v) in [f.ripple[1].max(f.ripple[3]), f.image[0], f.phrase[0]]
                .into_iter()
                .enumerate()
            {
                assert!(v == 0.0 || during(i), "picture {i} at {t}");
            }
        }
        for (i, f) in OPTIONS.iter().map(|at| compose(at + 1.6)).enumerate() {
            let v = [f.ripple[1].max(f.ripple[3]), f.image[0], f.phrase[0]][i];
            assert!(v > 0.9, "picture {i}");
        }
        let strengths: Vec<f32> = OPTIONS
            .iter()
            .map(|at| {
                compose(at + 0.9)
                    .pulses
                    .iter()
                    .map(|r| r.strength)
                    .fold(0.0, f32::max)
            })
            .collect();
        assert!(strengths.iter().all(|s| close(*s, strengths[0], 0.01)));
    }

    #[test]
    fn the_sights_look_at_each_point_alike() {
        for (k, p) in SIGHTS.iter().enumerate() {
            let at = sight_arrives(k);
            let s = compose(at + 0.3).sight.unwrap();
            let target = on_figure(p[0], p[1]);
            assert!(close(s.at[0], target[0], 1e-4) && close(s.at[1], target[1], 1e-4));
            assert!(s.settle > 0.99 && s.alpha > 0.99, "point {k}");
            // The same pulse of arrival, and the same hold.
            assert!(close(compose(at + 0.25).sight.unwrap().lock, 0.5, 1e-3));
            assert!(close(
                compose(at + SIGHT_STEP - SIGHT_GLIDE - 0.05)
                    .sight
                    .unwrap()
                    .at[1],
                target[1],
                1e-4
            ));
        }
        // It never jumps between points.
        let mut previous = compose(SIGHT_AT).sight.unwrap().at;
        for t in times(0.01).filter(|t| *t > SIGHT_AT && *t < SIGHT_END) {
            let at = compose(t).sight.unwrap().at;
            assert!(distance(at, previous) < 0.03, "sight at {t}");
            previous = at;
        }
    }

    #[test]
    fn the_conclusion_sounds_as_a_wave() {
        // Silent between words, a swell in each, never beyond its height.
        for i in 1..WORDS.len() {
            let x = word_span(i - 1)[1] + GAP * 0.5;
            assert_eq!(wave(x, 0), 0.0);
        }
        for i in 0..WORDS.len() {
            let [x0, x1] = word_span(i);
            let loudest = (0..200)
                .map(|k| wave(x0 + (x1 - x0) * k as f32 / 200.0, 0).abs())
                .fold(0.0, f32::max);
            assert!(loudest > 0.4 * WAVE_AMP && loudest <= WAVE_AMP, "word {i}");
        }
        // Level with the lips.
        assert!(close(LINE_Y, MOUTH[1], 1e-4));
    }

    #[test]
    fn fact_or_interpretation_is_never_settled_by_the_lens() {
        // The focus visits the line and the person, and ends with both sharp.
        let on_line = compose(44.0).camera;
        let on_person = compose(47.2).camera;
        let both = compose(STILL).camera;
        let line_depth = |c: &Camera| LINE_Z - c.eye[2];
        let person_depth = |c: &Camera| -c.eye[2];
        assert!(
            on_line.coc(line_depth(&on_line)) < 0.5 && on_line.coc(person_depth(&on_line)) > 5.0
        );
        assert!(
            on_person.coc(person_depth(&on_person)) < 0.5
                && on_person.coc(line_depth(&on_person)) > 5.0
        );
        assert!(both.coc(line_depth(&both)) < 1.0 && both.coc(person_depth(&both)) < 1.0);
    }

    #[test]
    fn the_subject_is_framed_in_every_shot() {
        let inside = |c: &Camera, p: [f32; 3]| {
            let q = c.project(p).unwrap();
            q.at[0] > 60.0 && q.at[0] < SIZE[0] - 60.0 && q.at[1] > 40.0 && q.at[1] < SIZE[1] - 60.0
        };
        let line = [START, stop_at(), [START[0], LINE_Y + WAVE_AMP, LINE_Z]];
        let body = [EYE, HEEL, BALL, CHAIR_LEGS[0], on_figure(85.0, CROWN_SVG)];
        // Wide: the whole person and the whole wave.
        for t in [0.0, 2.0, 58.0, 69.0] {
            let c = camera(t);
            for p in body.iter().chain(&line) {
                assert!(inside(&c, *p), "{t} {p:?}");
            }
        }
        // Speaking and the first question: the lips and the whole wave.
        for t in [6.0, 12.5] {
            let c = camera(t);
            for p in line.iter().chain(&[MOUTH]) {
                assert!(inside(&c, *p), "{t} {p:?}");
            }
        }
        assert!(inside(&camera(TRACE[1]), MOUTH));
        // The sights: every point they look at.
        for t in [20.0, 24.0] {
            for p in SIGHTS {
                assert!(inside(&camera(t), on_figure(p[0], p[1])), "{t} {p:?}");
            }
        }
        // The starting point: the start of the wave, the whole body and the
        // air beside the head where the image and the phrase appear.
        let side = [
            [THOUGHT_AT[0] - 0.35, THOUGHT_AT[1] + 0.12, THOUGHT_AT[2]],
            [THOUGHT_AT[0] + 0.26, THOUGHT_AT[1] - 0.12, THOUGHT_AT[2]],
        ];
        for t in [30.0, 33.0, 37.0] {
            for p in body.iter().chain(&side).chain(&[START]) {
                assert!(inside(&camera(t), *p), "{t} {p:?}");
            }
        }
        // Fact or interpretation: the wave near, the person to the knees.
        for p in line
            .iter()
            .chain(&[on_figure(110.0, 20.0), on_figure(262.0, 300.0)])
        {
            assert!(inside(&camera(47.0), *p), "{p:?}");
        }
    }

    #[test]
    fn the_route_runs_from_the_lips_to_the_full_stop() {
        assert!(close(route(1.0)[0], stop_at()[0], 1e-4));
        let share = thread_share();
        assert!(share > 0.1 && share < 0.6);
        let mut previous = route(0.0);
        for i in 1..=200 {
            let p = route(i as f32 / 200.0);
            let step = distance(p, previous);
            assert!(step < 0.012, "an even route: {step} at {i}");
            previous = p;
        }
        for i in 1..WORDS.len() {
            assert!(word_span(i)[0] > word_span(i - 1)[1]);
        }
    }

    #[test]
    fn every_theme_has_a_look() {
        for code in 0..8 {
            let l = look(code);
            assert_eq!(l.light, matches!(code, 1 | 5 | 6));
        }
    }
}
