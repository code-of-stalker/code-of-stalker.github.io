//! «Я это действительно знаю?»: Step 4, the second block's page 03/08. The
//! seated person of the pages before, in the shell of plates, the circuit of
//! page 02/08 under it and its impulse going round. Then the page, in order:
//! «Даже вера — является программой» — on the chest, over the plate the
//! circuit grew from, hangs a tablet of letterless lines, warmly lit, the
//! most precious plate of all; and the impulse runs through it as it runs
//! through any other node.
//! «Человек может верить в Бога, в Аллаха, в Будду, в Кришну, в правильность
//! молитвы или мантры» — the names are only on the card. Each time the
//! impulse passes the tablet, what is written on it changes; its shape, its
//! place and the way through it stay the same.
//! «…но никогда не задаваться вопросом» — the lens wanders off, the program
//! runs unwatched.
//! Then the three questions, and the camera asks each: «А я это чувствую как
//! Истину?» — close on the chest, the living light rises inside the body and
//! shows through every seam, but not through the tablet: it stays dark, its
//! glow was borrowed. «Я это действительно Знаю?» — the lens looks for where
//! it grows from: it lifts off the chest and swings, it hangs on a thread.
//! «Или мне просто так сказали, и я поверил?» — the thread leads to someone
//! deep in the room, from their tablet to someone further, and further,
//! into the dark; the lens follows it and comes back to the person. No
//! answer is given: the tablet stays, but now it is seen where it is from.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time. The browser adapter only uploads the values and the shaders only
//! paint them.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod generated;
pub mod geometry;

use generated::CELLS;
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

/// Authored frame, 3 : 2 like the other Step 4 scenes.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// The three paragraphs: a seamless loop.
pub const LOOP_SECONDS: f32 = 66.0;
/// Reduced motion holds this moment: the tablet lifted on its thread, the
/// chain of those who said it traced into the dark, the lens back on the
/// person, «И Я ПОВЕРИЛ?» lit on the card.
pub const STILL: f32 = 59.6;

/// Metres per unit of the approved figure (spoken-thought-person.svg): 1.3 m
/// from the soles to the crown, as a seated adult.
pub const UNIT: f32 = 1.3 / 505.0;
/// Size of the figure's SVG in its own units.
pub const FIGURE_SVG: [f32; 2] = [335.0, 530.0];
/// The soles of the figure (and the chair's legs) stand on this SVG row.
pub const FLOOR_SVG: f32 = 518.6;
/// The SVG column placed at the world's x = 0.
pub const ORIGIN_SVG: f32 = 160.0;
/// The crown of the head (SVG row).
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
pub const HEEL: [f32; 3] = on_figure(234.0, FLOOR_SVG);
pub const BALL: [f32; 3] = on_figure(296.0, FLOOR_SVG);
pub const CHAIR_LEGS: [[f32; 3]; 2] = [on_figure(20.0, FLOOR_SVG), on_figure(176.0, FLOOR_SVG)];

/// The number of plates, one node of the circuit on each.
pub const PLATES: usize = CELLS.len();
/// The plate on the chest the circuit grew from: the tablet hangs over it.
pub const HEART: usize = 12;

/// The groove of page 02/08: the way the impulse runs, a closed ring of
/// plates joined by wires. From the eye over the crown and down the back,
/// along the thigh to the hand, up the arm and the chest, through the neck
/// to the mouth, and from the mouth back to the eye.
pub const RING: [usize; 26] = [
    1, 0, 2, 3, 5, 6, 8, 11, 14, 17, 20, 26, 29, 27, 31, 28, 24, 23, 22, 19, 15, 12, 9, 7, 6, 4,
];
/// Where the tablet's plate lies on the ring.
pub const THROUGH: usize = 21;
/// Plates per second along the ring.
pub const SPEED: f32 = 10.0;
/// When the impulse sets off from the eye.
pub const RUNS: f32 = 5.0;
/// When the impulse passes the tablet for the `n`-th time.
pub fn passes(n: usize) -> f32 {
    RUNS + (THROUGH + n * RING.len()) as f32 / SPEED
}
/// The passes at which the six beliefs of the card are written in turn
/// (the seventh: what was written before comes back).
pub const FIRST_BELIEF: usize = 3;
/// What the tablet says before the names and after them.
pub const OWN: usize = 6;

/// The cards: one per sentence part (in, out).
pub const CARDS: [[f32; 2]; 6] = [
    [1.6, 12.4],
    [13.2, 31.4],
    [32.0, 37.8],
    [38.4, 44.8],
    [45.4, 51.4],
    [52.0, 61.0],
];
/// «И я поверил?»: lit on the last card.
pub const BELIEVED: [f32; 2] = [57.2, 60.6];
/// The room sinks back into the loop's seam from here.
const FADE: f32 = 61.6;

/// «Чувствую как Истину?»: the living light rises (s).
pub const FEEL: [f32; 4] = [39.0, 40.8, 44.4, 46.4];
/// «Действительно Знаю?»: the tablet lifts off the chest (s), and how far (m).
pub const LIFT: [f32; 2] = [45.6, 47.6];
pub const LIFTED: f32 = 0.12;
/// Where the tablet hangs before it lifts (m before the body).
pub const PINNED: f32 = 0.07;

/// Those who said it, deep in the room, one behind the other: where each
/// sits (world x, z), all facing the person (left).
pub const CHAIN: [(f32, f32); 3] = [(2.25, 2.8), (1.6, 5.6), (0.3, 8.4)];
/// The face of someone in the chain (world): their mouth.
pub fn mouth(k: usize) -> [f32; 3] {
    let (x, z) = CHAIN[k];
    let p = on_figure(335.0 - 128.0, 72.0);
    [x + p[0] - 0.08, p[1], z]
}
/// The chest of someone in the chain (world), where their own tablet hangs.
pub fn chest(k: usize) -> [f32; 3] {
    let (x, z) = CHAIN[k];
    [
        x + (175.0 - 108.5) * UNIT,
        (FLOOR_SVG - 176.2) * UNIT,
        z - PINNED,
    ]
}
/// Where the last thread goes: into the dark beyond the room.
pub const BEYOND: [f32; 3] = [-1.2, 2.3, 10.0];
/// The threads of the chain drawn out (s): the first is found at «знаю?»,
/// the others while the lens follows them.
pub const THREADS: [[f32; 2]; 4] = [[48.0, 50.0], [53.6, 54.2], [55.0, 55.5], [56.1, 56.6]];
/// The light that follows the chain: one hop per thread (s).
pub const HOPS: [[f32; 2]; 4] = [[52.6, 53.6], [54.1, 55.0], [55.3, 56.1], [56.3, 57.0]];
/// The others come out of the dark (s, fully visible at the second value).
pub const APPEAR: [[f32; 2]; 3] = [[48.8, 50.2], [53.2, 54.2], [54.6, 55.6]];
/// Everything of the chain sinks before the seam.
pub const GONE: [f32; 2] = [61.0, 62.6];

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
/// A point on the quadratic curve a → c bending towards b.
pub fn curve(a: [f32; 3], b: [f32; 3], c: [f32; 3], t: f32) -> [f32; 3] {
    let u = 1.0 - t;
    std::array::from_fn(|k| u * u * a[k] + 2.0 * u * t * b[k] + t * t * c[k])
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
/// The whole room and the seated person.
const WIDE: Shot = shot([0.25, 0.85, -4.2], 1450.0, 480.0, 0.02);
/// The camera's moves: each one starts, eases and arrives (start, end, shot).
const MOVES: [(f32, f32, Shot); 10] = [
    // «Даже вера…»: the person in the shell.
    (1.2, 4.4, shot([0.3, 0.88, -3.2], 1400.0, 470.0, 0.025)),
    // «…является программой»: close on the chest, the tablet and the impulse.
    (5.0, 9.6, shot([0.12, 1.0, -1.5], 1250.0, 380.0, 0.035)),
    // «Человек может верить…»: the upper body, the tablet read.
    (12.6, 16.0, shot([0.22, 0.98, -2.0], 1300.0, 410.0, 0.03)),
    (18.0, 30.0, shot([0.18, 0.98, -1.8], 1300.0, 400.0, 0.03)),
    // «…но никогда не задаваться вопросом»: unattended, the lens drifts off.
    (31.0, 36.6, shot([0.95, 0.96, -4.0], 1400.0, 455.0, 0.04)),
    // «Чувствую как Истину?»: close on the chest.
    (38.0, 41.2, shot([0.1, 0.98, -1.55], 1250.0, 400.0, 0.04)),
    // «Действительно Знаю?»: aside, the tablet against the body.
    (45.2, 48.4, shot([0.3, 1.0, -1.7], 1300.0, 400.0, 0.07)),
    // …the thread, and who is at its end.
    (48.8, 51.4, shot([0.6, 0.98, -2.6], 1300.0, 400.0, 0.06)),
    // «Или мне просто так сказали…»: back, the chain into the depth.
    (51.8, 54.6, shot([1.05, 0.95, -3.6], 1400.0, 430.0, 0.08)),
    (61.2, 65.6, WIDE),
];
fn blend(a: Shot, b: Shot, t: f32) -> Shot {
    Shot {
        eye: lerp3(a.eye, b.eye, t),
        focal: a.focal + (b.focal - a.focal) * t,
        horizon: a.horizon + (b.horizon - a.horizon) * t,
        aperture: a.aperture + (b.aperture - a.aperture) * t,
    }
}
/// Where the focus lies (world z): the person's plane is 0. (start, end,
/// plane), each eased.
const FOCUS: [(f32, f32, f32); 7] = [
    // «Никогда не задаваться вопросом»: the lens is on the far wall.
    (31.6, 36.2, 4.5),
    // «Чувствую?»: back on the person.
    (38.2, 40.0, 0.0),
    // «Знаю?»: on the tablet, lifted off the chest.
    (46.0, 47.6, -PINNED - LIFTED),
    // «Сказали»: along the chain, one after another…
    (52.8, 53.8, CHAIN[0].1),
    (54.2, 55.1, CHAIN[1].1),
    (55.4, 56.3, CHAIN[2].1),
    // «…и я поверил?»: back to the person.
    (57.0, 59.4, 0.0),
];
/// The plane the lens is focused on at a loop time.
pub fn focus_plane(t: f32) -> f32 {
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
/// (periodic in the loop) keeps the frame alive between them. The room
/// comes out of blur at the start and returns to it at the end of the loop.
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

/// Plate `i`'s site on the body (SVG units) at `t`: the mosaic breathes a
/// little, as on page 01/08 (periodic in the loop).
pub fn site(i: usize, t: f32) -> [f32; 2] {
    let w = t / LOOP_SECONDS * TAU;
    let r = |k: u32| hash(2000 + 7 * i as u32 + k);
    let [x, y] = CELLS[i];
    let (a, b) = (3.0 + (4.0 * r(1)).floor(), 2.0 + (4.0 * r(3)).floor());
    [
        x + 1.1 * (w * a + TAU * r(2)).sin(),
        y + 1.1 * (w * b + TAU * r(4)).cos(),
    ]
}

/// The kind of piece plate `i` was made of on page 01/08 (0 image, 1
/// attitude, 2 fear, 3 memory): the faint mark it still carries.
pub fn piece(i: usize) -> usize {
    let group = (i / 4) as u32;
    let start = (hash(900 + group) * 4.0) as usize;
    let step = if hash(950 + group) < 0.5 { 1 } else { 3 };
    (start + step * (i % 4)) % 4
}

/// The impulse on the ring: where (plates since the eye) and how bright.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Impulse {
    pub along: f32,
    pub alpha: f32,
}

/// The tablet of belief on the chest.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Tablet {
    /// How much of it is there.
    pub shown: f32,
    /// Where it hangs (world z: before the body, towards the lens).
    pub z: f32,
    /// Its own warm glow: borrowed, it goes out when the living light rises.
    pub glow: f32,
    /// What it says, before and after the last change (an index into the
    /// writings of `geometry`), and how far that change has gone (0..1).
    pub writing: [usize; 2],
    pub change: f32,
    /// How it swings on its thread once it is lifted (radians).
    pub swing: f32,
}

/// All motion of one instant.
#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// Exposure of the room: low at the loop seam, full otherwise.
    pub light: f32,
    pub breath: f32,
    /// Strength of the figure's contour.
    pub contour: f32,
    /// The living light inside the body (Presence), and how much of it
    /// gathers at the heart, behind the tablet.
    pub presence: f32,
    pub heart: f32,
    /// How much of the pieces' marks the plates still show.
    pub marks: f32,
    /// The circuit as a whole (it sinks with the room at the seam), and its
    /// worn groove.
    pub circuit: f32,
    pub groove: f32,
    pub impulse: Impulse,
    /// Each plate's node, lit while the impulse passes.
    pub lit: [f32; PLATES],
    pub tablet: Tablet,
    /// Those who said it, deep in the room.
    pub chain: [f32; 3],
    /// How much of each thread of the chain is drawn out (0..1).
    pub threads: [f32; 4],
    /// The light that follows the chain: how far (threads, 0..4), how much
    /// of its trail is left, and the bright point at its head.
    pub traced: f32,
    pub trail: f32,
    pub bead: f32,
    /// The card on screen and its visibility; the parts lit in turn.
    pub card: usize,
    pub shown: f32,
    pub options: [f32; 6],
    pub listed: f32,
}

/// The whole choreography at `seconds` (wrapped to the loop).
pub fn compose(seconds: f32) -> Frame {
    let t = if seconds.is_finite() {
        seconds.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let n = RING.len() as f32;
    // The program runs from the start of the first paragraph to the seam;
    // once nobody watches it, it is quieter, but it does not stop.
    let impulse = Impulse {
        along: SPEED * (t - RUNS),
        alpha: smooth(RUNS - 0.1, RUNS + 0.05, t)
            * (1.0 - 0.6 * smooth(31.0, 33.0, t))
            * (1.0 - smooth(FADE, FADE + 1.8, t)),
    };
    let mut lit = [0.0_f32; PLATES];
    if impulse.alpha > 0.0 {
        for (j, plate) in RING.iter().enumerate() {
            let d = (impulse.along - j as f32).rem_euclid(n);
            let k = if d < 1.8 {
                (1.0 - d / 1.8).powi(2)
            } else if d > n - 0.35 {
                (d - (n - 0.35)) / 0.35
            } else {
                0.0
            };
            lit[*plate] = lit[*plate].max(k.min(1.0) * impulse.alpha);
        }
    }
    // Every pass of the impulse through the tablet during the second
    // paragraph writes the next belief; the last pass brings back its own.
    let mut writing = [OWN, OWN];
    let mut change = 1.0;
    for k in 0..=6 {
        let at = passes(FIRST_BELIEF + k) - 0.15;
        if t >= at {
            writing = [
                if k == 0 { OWN } else { k - 1 },
                if k == 6 { OWN } else { k },
            ];
            change = ((t - at) / 0.75).clamp(0.0, 1.0);
        }
    }
    let lift = smooth(LIFT[0], LIFT[1], t);
    let tablet = Tablet {
        shown: smooth(2.8, 4.6, t) * (1.0 - smooth(FADE, FADE + 2.0, t)),
        z: -(PINNED + LIFTED * lift),
        glow: 1.0 - 0.85 * smooth(FEEL[0], FEEL[1], t) + 0.4 * smooth(FEEL[2], FEEL[3], t),
        writing,
        change,
        swing: lift * 0.1 * (TAU * 0.42 * (t - LIFT[0])).sin(),
    };
    let gone = 1.0 - smooth(GONE[0], GONE[1], t);
    let chain = std::array::from_fn(|k| smooth(APPEAR[k][0], APPEAR[k][1], t) * gone);
    let threads = std::array::from_fn(|k| smooth(THREADS[k][0], THREADS[k][1], t) * gone);
    let traced = HOPS.iter().map(|[a, b]| smooth(*a, *b, t)).sum();
    let mut card = 0;
    let mut shown = 0.0;
    for (i, [a, b]) in CARDS.iter().enumerate() {
        if t >= a - 0.1 && t <= b + 0.1 {
            card = i;
            shown = bell(t, *a, a + 1.0, b - 0.8, *b);
        }
    }
    let lit_part = |a: f32, b: f32| bell(t, a, a + 0.4, b - 0.4, b);
    let options = match card {
        1 => std::array::from_fn(|k| {
            lit_part(passes(FIRST_BELIEF + k), passes(FIRST_BELIEF + k + 1))
        }),
        5 => [lit_part(BELIEVED[0], BELIEVED[1]), 0.0, 0.0, 0.0, 0.0, 0.0],
        _ => [0.0; 6],
    };
    let listed = match card {
        1 => bell(
            t,
            passes(FIRST_BELIEF) - 1.0,
            passes(FIRST_BELIEF),
            CARDS[1][1] - 1.0,
            CARDS[1][1],
        ),
        5 => bell(
            t,
            CARDS[5][0] + 0.5,
            CARDS[5][0] + 1.5,
            CARDS[5][1] - 1.0,
            CARDS[5][1],
        ),
        _ => 0.0,
    };
    let circuit = smooth(0.4, 3.2, t) * (1.0 - smooth(FADE, LOOP_SECONDS - 1.5, t));
    Frame {
        time: t,
        camera: camera(t),
        light: 0.34 + 0.66 * smooth(0.0, 2.6, t) - 0.66 * smooth(FADE, LOOP_SECONDS, t),
        // Eleven breaths per loop.
        breath: 0.5 - 0.5 * (t / LOOP_SECONDS * 11.0 * TAU).cos(),
        contour: 0.3 + 0.55 * smooth(0.4, 2.6, t) - 0.55 * smooth(FADE, LOOP_SECONDS, t),
        // The living light is always there; «чувствую?» brings it out.
        presence: (0.35 + 0.65 * smooth(0.6, 3.6, t) - 0.65 * smooth(FADE, LOOP_SECONDS, t))
            * (1.0 + 0.9 * bell(t, FEEL[0], FEEL[1], FEEL[2], FEEL[3])),
        heart: bell(t, FEEL[0], FEEL[1] + 0.6, FEEL[2] - 0.4, FEEL[3]),
        // The pieces' marks faded on page 02/08.
        marks: 0.2,
        circuit,
        groove: 0.6 * circuit,
        impulse,
        lit,
        tablet,
        chain,
        threads,
        traced,
        trail: gone,
        bead: bell(
            t,
            HOPS[0][0] - 0.1,
            HOPS[0][0] + 0.1,
            HOPS[3][1] - 0.3,
            HOPS[3][1] + 0.2,
        ),
        card,
        shown,
        options,
        listed,
    }
}

/// Where on the ring (world) the impulse is: between two plates' nodes.
pub fn on_ring(along: f32, node: &dyn Fn(usize) -> [f32; 3]) -> [f32; 3] {
    let n = RING.len();
    let base = along.floor();
    let i = (base as i64).rem_euclid(n as i64) as usize;
    lerp3(node(RING[i]), node(RING[(i + 1) % n]), along - base)
}

/// Colors for the composite pass: the page, the ink of the room and of the
/// construction (red channel), the light of the person and of the words
/// (green), the person's body (blue) and the color light takes on light
/// pages (where white would vanish).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub paper: [f32; 3],
    pub room: [f32; 3],
    pub person: [f32; 3],
    pub body: [f32; 3],
    pub lamp: [f32; 3],
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
        lamp: accent,
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
                // A warm lamp light: visible on sand, kept inside the body.
                lamp: rgb(0xE8912E),
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
                // Мираж glows in its blue, Рассвет in its copper.
                lamp: if palette == Palette::Dawn {
                    c.detail
                } else {
                    c.accent
                },
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
    /// A part lit in turn (index 0..6).
    Option(usize),
}
/// The rows of each card, in the atlas order of `tools/prepare-assets.mjs`.
pub fn card_rows(card: usize) -> &'static [(usize, Kind)] {
    const ROWS: [&[(usize, Kind)]; 6] = [
        &[(0, Kind::Lead), (1, Kind::Key)],
        &[
            (2, Kind::Lead),
            (3, Kind::Option(0)),
            (4, Kind::Option(1)),
            (5, Kind::Option(2)),
            (6, Kind::Option(3)),
            (7, Kind::Option(4)),
            (8, Kind::Option(5)),
        ],
        &[(9, Kind::Lead), (10, Kind::Key)],
        &[(11, Kind::Lead), (12, Kind::Key)],
        &[(13, Kind::Lead), (14, Kind::Key)],
        &[(15, Kind::Lead), (16, Kind::Key), (17, Kind::Option(0))],
    ];
    ROWS[card.min(5)]
}
/// How many of a card's parts stand on each line, line by line.
pub fn option_lines(card: usize) -> &'static [usize] {
    if card == 1 {
        &[2, 2, 1, 1]
    } else {
        &[1; 6]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use generated::LINKS;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }
    fn times(step: f32) -> impl Iterator<Item = f32> {
        (0..(LOOP_SECONDS / step) as usize).map(move |i| i as f32 * step)
    }
    fn linked(a: usize, b: usize) -> bool {
        LINKS.iter().any(|l| *l == [a, b] || *l == [b, a])
    }

    #[test]
    fn the_loop_has_no_seam() {
        let (a, b) = (compose(0.0), compose(LOOP_SECONDS));
        assert_eq!(a, b);
        let (x, y) = (compose(LOOP_SECONDS - 0.004), compose(0.004));
        for (p, q) in [
            (x.light, y.light),
            (x.contour, y.contour),
            (x.presence, y.presence),
            (x.shown, y.shown),
            (x.circuit, y.circuit),
            (x.tablet.shown, y.tablet.shown),
        ] {
            assert!(close(p, q, 0.01), "{p} vs {q}");
        }
        for e in 0..3 {
            assert!(close(x.camera.eye[e], y.camera.eye[e], 0.003));
        }
        assert!(close(x.camera.focus, y.camera.focus, 0.02));
        // Nothing of the program, the tablet or the chain at the seam.
        for f in [&x, &y] {
            assert!(f.impulse.alpha < 0.01 && f.tablet.shown < 0.01);
            assert!(f.chain.iter().chain(&f.threads).all(|v| *v < 0.01));
            assert!(f.trail < 0.01 || f.traced < 0.01);
        }
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
            assert!(close(c.focus, previous.focus, 0.06), "focus at {t}");
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
                f.light,
                f.breath,
                f.contour,
                f.marks,
                f.circuit,
                f.groove,
                f.shown,
                f.listed,
                f.impulse.alpha,
                f.tablet.shown,
                f.tablet.glow,
                f.tablet.change,
                f.trail,
                f.bead,
                f.heart,
            ] {
                assert!(v.is_finite() && (0.0..=1.0).contains(&v), "{v} at {t}");
            }
            assert!(f.presence.is_finite() && (0.0..=1.9).contains(&f.presence));
            assert!(f.impulse.along.is_finite() && (0.0..=4.0).contains(&f.traced));
            assert!(f.tablet.z <= -PINNED + 1e-6 && f.tablet.z >= -PINNED - LIFTED - 1e-6);
            assert!(f.tablet.swing.abs() <= 0.1 && f.tablet.writing.iter().all(|w| *w <= OWN));
            assert!(f
                .lit
                .iter()
                .chain(&f.options)
                .chain(&f.chain)
                .chain(&f.threads)
                .all(|v| (0.0..=1.0).contains(v)));
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
    }

    #[test]
    fn the_ring_runs_along_wires() {
        let n = RING.len();
        for i in 0..n {
            assert!(linked(RING[i], RING[(i + 1) % n]), "{i}");
        }
        // The impulse passes the tablet's plate once a lap.
        assert_eq!(RING[THROUGH], HEART);
        assert_eq!(RING.iter().filter(|p| **p == HEART).count(), 1);
    }

    #[test]
    fn the_page_is_told_in_order() {
        // «Даже вера — является программой»: the tablet hangs on the chest
        // before the impulse first runs through it, and it is lit like any
        // other node when it does.
        assert!(compose(passes(0) - 1.0).tablet.shown > 0.99);
        assert!(compose(passes(0)).lit[HEART] > 0.95);
        assert!(passes(0) > CARDS[0][0] + 2.0 && passes(2) < CARDS[0][1]);
        // The six beliefs, each written as the impulse passes, one at a time
        // on the card; then the tablet's own words come back.
        for k in 0..6 {
            let f = compose(passes(FIRST_BELIEF + k) + 1.0);
            assert!(f.card == 1 && f.options[k] > 0.99, "belief {k}");
            assert_eq!(f.options.iter().filter(|v| **v > 0.5).count(), 1);
            assert_eq!(f.tablet.writing[1], k);
            assert!(f.tablet.change > 0.99);
        }
        assert!(passes(FIRST_BELIEF) > CARDS[1][0] + 1.0);
        assert!(passes(FIRST_BELIEF + 6) < CARDS[1][1]);
        assert_eq!(
            compose(passes(FIRST_BELIEF + 6) + 1.0).tablet.writing[1],
            OWN
        );
        assert_eq!(
            compose(passes(FIRST_BELIEF) - 0.5).tablet.writing,
            [OWN, OWN]
        );
        // «…никогда не задаваться вопросом»: the lens is elsewhere.
        let away = camera(35.8);
        assert!(away.coc(away.subject()) > 2.0);
        // «Чувствую как Истину?»: the living light rises, the tablet goes
        // dark, the lens is on the person.
        let feel = compose(42.0);
        assert!(feel.card == 3 && feel.presence > 1.7 && feel.tablet.glow < 0.2);
        assert!(feel.camera.coc(feel.camera.subject()) < 0.3);
        // «Действительно Знаю?»: it lifts off, swings, the lens on it; the
        // thread is found and leads to someone.
        let know = compose(48.6);
        let c = know.camera;
        assert!(know.card == 4 && close(know.tablet.z, -PINNED - LIFTED, 1e-3));
        assert!(c.coc(know.tablet.z - c.eye[2]) < 0.3);
        assert!(c.coc(c.subject()) > c.coc(know.tablet.z - c.eye[2]));
        assert!(compose(50.6).threads[0] > 0.99 && compose(50.6).chain[0] > 0.99);
        // «Или мне просто так сказали…»: the light follows the chain into
        // the dark, the lens with it, then back to the person.
        for (k, [_, end]) in HOPS.iter().enumerate() {
            assert!(close(compose(*end).traced, k as f32 + 1.0, 1e-3));
            assert!(THREADS[k][0] < HOPS[k][0] + 0.1 && THREADS[k][1] <= HOPS[k][1]);
            if k < 3 {
                assert!(APPEAR[k][1] <= HOPS[k][1] + 0.01, "{k}");
                let f = compose(HOPS[k][1] + 0.25);
                let depth = CHAIN[k].1 - f.camera.eye[2];
                assert!(f.camera.coc(depth) < 1.0, "lens on {k}");
            }
        }
        let believed = compose(STILL);
        assert!(believed.card == 5 && believed.options[0] > 0.99);
        let c = believed.camera;
        assert!(c.coc(c.subject()) < 0.3 && c.coc(CHAIN[2].1 - c.eye[2]) > 4.0);
        assert!(believed.traced > 3.99 && believed.chain.iter().all(|v| *v > 0.99));
    }

    #[test]
    fn the_subject_is_framed_in_every_shot() {
        let inside = |c: &Camera, p: [f32; 3]| {
            let q = c.project(p).unwrap();
            q.at[0] > 50.0 && q.at[0] < SIZE[0] - 50.0 && q.at[1] > 30.0 && q.at[1] < SIZE[1] - 50.0
        };
        let body = [EYE, HEEL, BALL, CHAIR_LEGS[0], on_figure(85.0, CROWN_SVG)];
        for t in [0.0, 3.0, 34.0, 56.0, 59.6, 65.0] {
            for p in body {
                assert!(inside(&camera(t), p), "{t} {p:?}");
            }
        }
        // The close shots keep the head and the chest with its tablet.
        for t in [9.0, 14.0, 25.0, 42.0, 47.0, 50.0] {
            for p in [EYE, on_figure(85.0, CROWN_SVG), on_figure(108.5, 176.2)] {
                assert!(inside(&camera(t), p), "{t} {p:?}");
            }
        }
        // Those who said it, while they are there.
        for t in [50.6, 53.6, 55.0, 56.4, 59.6] {
            let f = compose(t);
            for k in 0..3 {
                if f.chain[k] > 0.5 {
                    assert!(inside(&f.camera, mouth(k)), "{t} mouth {k}");
                    assert!(inside(&f.camera, chest(k)), "{t} chest {k}");
                }
            }
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
