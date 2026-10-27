//! «Механизм обусловленности»: Step 4, the second block's page 02/08. The
//! seated person of the pages before, still wearing the shell of plates
//! the character was assembled from on page 01/08. Then the page, in order:
//! «Персонаж — это не кто-то» — the camera comes close and the plates turn
//! out to be the parts of a circuit: wires run from plate to plate over
//! the whole shell, a node on every plate, the marks of what the plates
//! were made of fade. There is nobody in it, only nodes and wires.
//! «Это механизм обусловленности, это программа, которая запускается…» —
//! occasions come from outside: a glance from someone deep in the room, a
//! word from another, a dark shard from the floor. Each one starts an
//! impulse where it lands, and every impulse runs the same groove through
//! the body and leaves the mouth as the same ready reaction.
//! «…и живёт собой» — then nothing comes any more, and the last impulse
//! keeps going round on its own, while the lens wanders off.
//! «…пока ты не начнёшь видеть, рассматривать, ощущать, наблюдать,
//! осознавать и различать» — the six words are lit in turn and the camera
//! does each: the lens finds the impulse, comes close, the living light
//! inside the body is felt through the seams, the frame holds still while
//! the impulse's whole way is traced, the whole circuit is seen at once,
//! and at last the circuit and the living body part in depth: two layers,
//! the lens on the body. The program does not vanish here; that is for the
//! pages after.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time. The browser adapter only uploads the values and the shaders only
//! paint them.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod generated;
pub mod geometry;

use generated::{CELLS, LINKS};
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

/// Authored frame, 3 : 2 like the other Step 4 scenes.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// The two paragraphs: a seamless loop.
pub const LOOP_SECONDS: f32 = 66.0;
/// Reduced motion holds this moment: the circuit and the living body
/// apart, the impulse's way traced, «И РАЗЛИЧАТЬ» lit on the card.
pub const STILL: f32 = 57.8;

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
/// The circuit draws itself out from this plate (the chest), wire by wire.
pub const HEART: usize = 12;
pub const WIRING: [f32; 2] = [3.6, 10.0];
/// The marks of the pieces fade while the circuit shows (seconds).
pub const MARKS: [f32; 2] = [4.0, 9.5];

/// The groove: the way every impulse runs, a closed ring of plates joined
/// by wires. From the eye over the crown and down the back, along the
/// thigh to the hand, up the arm and the chest, through the neck to the
/// mouth, and from the mouth back to the eye.
pub const RING: [usize; 26] = [
    1, 0, 2, 3, 5, 6, 8, 11, 14, 17, 20, 26, 29, 27, 31, 28, 24, 23, 22, 19, 15, 12, 9, 7, 6, 4,
];
/// Where the ring ends: the mouth, where the reaction leaves.
pub const MOUTH: usize = 25;
/// Plates per second along the ring.
pub const SPEED: f32 = 8.5;
/// How long a reaction takes to leave and fade (s, at full speed).
pub const REACTION: f32 = 1.5;

/// The occasions, in order: what comes, from where it lands on the ring
/// (index into `RING`), when it sets off and how long it flies.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Occasion {
    /// A glance from someone deep in the room, to the eye.
    Glance,
    /// A word from someone else, to the ear.
    Word,
    /// A dark shard from the floor, to the thigh.
    Shard,
}
pub const OCCASIONS: [(Occasion, usize, f32, f32); 3] = [
    (Occasion::Glance, 0, 17.0, 1.0),
    (Occasion::Word, 3, 21.9, 1.2),
    (Occasion::Shard, 14, 26.4, 1.2),
];
/// When occasion `k` lands and its impulse starts.
pub fn lands(k: usize) -> f32 {
    OCCASIONS[k].2 + OCCASIONS[k].3
}
/// When impulse `k` reaches the mouth (the first time).
pub fn reaches(k: usize) -> f32 {
    lands(k) + (MOUTH - OCCASIONS[k].1) as f32 / SPEED
}

/// The others deep in the room: where each sits (world x, z) and whether it
/// faces left. The first speaks the word, the second gives the glance.
pub const OTHERS: [(f32, f32, bool); 2] = [(-2.0, 3.4, false), (2.25, 2.8, true)];
/// The face of another person (world).
pub fn other_face(k: usize) -> [f32; 3] {
    let (x, z, left) = OTHERS[k];
    let p = on_figure(if left { 335.0 - 128.0 } else { 128.0 }, 72.0);
    [x + p[0] + if left { -0.08 } else { 0.08 }, p[1], z]
}

/// The six ways of looking, lit in turn on the third card (start of each).
pub const VERBS_AT: [f32; 6] = [38.4, 41.8, 45.2, 48.6, 52.0, 55.4];
pub const VERB_SECONDS: f32 = 3.4;
/// «Различать»: how far the circuit parts from the body, towards the lens.
pub const APART: f32 = 0.25;

/// The cards: one per sentence part (in, out).
pub const CARDS: [[f32; 2]; 3] = [[1.6, 12.8], [13.8, 36.2], [37.2, 61.0]];
/// The parts of the second card: «запускается», then «живёт собой».
pub const PROGRAM_AT: [[f32; 2]; 2] = [[17.0, 29.6], [29.8, 35.9]];
/// The room sinks back into the loop's seam from here.
const FADE: f32 = 61.6;

pub fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
/// The integral of `smooth(a, b, ·)` from `a` to `x` (seconds).
pub fn smooth_integral(a: f32, b: f32, x: f32) -> f32 {
    if x <= a {
        return 0.0;
    }
    if x >= b {
        return 0.5 * (b - a) + (x - b);
    }
    let u = (x - a) / (b - a);
    (b - a) * (u * u * u - 0.5 * u * u * u * u)
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
const MOVES: [(f32, f32, Shot); 9] = [
    // «Персонаж — …»: the whole person in the shell.
    (1.2, 4.4, shot([0.3, 0.88, -3.2], 1400.0, 470.0, 0.025)),
    // «…это не кто-то»: close on the head and the chest, the circuit.
    (5.6, 10.8, shot([0.05, 1.06, -1.45], 1250.0, 380.0, 0.035)),
    // «Это механизм…»: back, the others deep in the room.
    (12.6, 16.2, shot([0.35, 0.95, -2.6], 1350.0, 440.0, 0.025)),
    // «…и живёт собой»: unattended, the lens drifts off.
    (30.2, 36.8, shot([0.95, 0.96, -4.0], 1400.0, 455.0, 0.04)),
    // «Видеть»: back to it.
    (38.4, 41.4, shot([0.42, 0.92, -3.1], 1400.0, 450.0, 0.03)),
    // «Рассматривать»: close.
    (41.8, 45.0, shot([0.3, 0.98, -2.35], 1320.0, 415.0, 0.04)),
    // «Осознавать»: the whole of it at once.
    (52.0, 54.9, shot([0.36, 0.9, -3.0], 1400.0, 455.0, 0.03)),
    // «Различать»: aside a little, so the two layers part, a wider lens.
    (55.4, 58.0, shot([0.66, 0.92, -2.8], 1400.0, 450.0, 0.12)),
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
const FOCUS: [(f32, f32, f32); 2] = [
    // «Живёт собой»: the lens is on the far wall, the program runs unseen.
    (30.4, 35.6, 4.5),
    // «Видеть»: it finds the impulse again.
    (38.6, 40.4, 0.0),
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

/// «Наблюдать»: the frame holds still (0 drifting … 1 still).
pub fn still(t: f32) -> f32 {
    bell(t, VERBS_AT[3], VERBS_AT[3] + 1.2, 59.0, FADE)
}

/// The camera at a loop time. Moves ease in and out; a slow breathing drift
/// (periodic in the loop) keeps the frame alive between them, except while
/// it observes. The room comes out of blur at the start and returns to it
/// at the end of the loop.
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
    let k = 1.0 - still(time);
    let drift = [
        k * (0.012 * (2.0 * w).sin() + 0.006 * (5.0 * w).sin()),
        k * 0.008 * (3.0 * w).sin(),
        k * (0.02 * (2.0 * w).cos() - 0.02),
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

/// How many wires each plate lies from the heart of the circuit (found
/// once, breadth first).
fn depths() -> &'static [usize; PLATES] {
    static DEPTHS: std::sync::OnceLock<[usize; PLATES]> = std::sync::OnceLock::new();
    DEPTHS.get_or_init(|| {
        let mut seen = [usize::MAX; PLATES];
        let mut queue = std::collections::VecDeque::from([HEART]);
        seen[HEART] = 0;
        while let Some(a) = queue.pop_front() {
            for [p, q] in LINKS {
                let b = if p == a {
                    q
                } else if q == a {
                    p
                } else {
                    continue;
                };
                if seen[b] == usize::MAX {
                    seen[b] = seen[a] + 1;
                    queue.push_back(b);
                }
            }
        }
        seen
    })
}
pub fn depth(i: usize) -> usize {
    depths()[i]
}
/// When plate `i`'s node shows: the circuit grows out from the heart (s).
pub fn node_at(i: usize) -> f32 {
    let deepest = depths().iter().copied().max().unwrap_or(1).max(1);
    WIRING[0] + (WIRING[1] - WIRING[0] - 0.8) * depth(i) as f32 / deepest as f32
}
/// When wire `k` starts to draw, from its nearer plate (s).
pub fn wired_at(k: usize) -> f32 {
    let [a, b] = LINKS[k];
    node_at(a).min(node_at(b))
}
/// Whether the wire between plates `a` and `b` is part of the groove.
pub fn in_groove(a: usize, b: usize) -> bool {
    let n = RING.len();
    (0..n).any(|i| {
        let (p, q) = (RING[i], RING[(i + 1) % n]);
        (p, q) == (a, b) || (p, q) == (b, a)
    })
}

/// The last impulse (the shard's) goes round on its own after it reaches
/// the mouth; it slows while the circuit and the body part. Its place on
/// the ring (plates since the eye, growing without end).
pub fn round(t: f32) -> f32 {
    let (_, from, _, _) = OCCASIONS[2];
    let slow = 0.4 * smooth_integral(VERBS_AT[5], VERBS_AT[5] + 1.6, t);
    from as f32 + SPEED * (t - lands(2) - slow)
}

/// One impulse on the ring: where (plates since the eye) and how bright.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Impulse {
    pub along: f32,
    pub alpha: f32,
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
    /// The living light inside the body (Presence).
    pub presence: f32,
    /// How much of the pieces' marks the plates still show.
    pub marks: f32,
    /// The circuit as a whole (it sinks with the room at the seam), and
    /// how much of it is seen at once («осознавать»).
    pub circuit: f32,
    pub whole: f32,
    /// How worn the groove is: every impulse that runs it leaves it brighter.
    pub groove: f32,
    /// How far the circuit stands before the body (m, towards the lens).
    pub layer: f32,
    /// The others deep in the room, while they give their occasion.
    pub others: [f32; 2],
    /// Each occasion: how far it has come (0..1) and how visible it is.
    pub occasions: [[f32; 2]; 3],
    /// The impulses running now.
    pub impulses: Vec<Impulse>,
    /// The reaction leaving the mouth: how far (0..1) and how strong.
    pub reaction: [f32; 2],
    /// Each plate's node, lit while an impulse passes.
    pub lit: [f32; PLATES],
    /// «Наблюдать»: the impulse's way traced (from, to: plates since the eye).
    pub traced: [f32; 2],
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
    let mut impulses = Vec::with_capacity(3);
    let mut reaction = [0.0, 0.0];
    let mut react = |since: f32, strength: f32| {
        // Plates since the mouth: the reaction leaves while the impulse
        // would have gone on that far.
        let age = since / (SPEED * REACTION);
        if (0.0..1.0).contains(&age) {
            reaction = [age, strength];
        }
    };
    for (k, occasion) in OCCASIONS.iter().enumerate() {
        let start = lands(k);
        if t < start - 0.1 {
            continue;
        }
        let from = occasion.1 as f32;
        let along = if k == 2 {
            round(t)
        } else {
            from + SPEED * (t - start)
        };
        let fade = 1.0 - smooth(FADE, FADE + 1.8, t);
        let on = smooth(start - 0.1, start + 0.05, t) * fade;
        if k < 2 {
            // The first two leave by the mouth.
            if along < MOUTH as f32 {
                impulses.push(Impulse { along, alpha: on });
            }
            react(along - MOUTH as f32, 1.0);
        } else {
            impulses.push(Impulse { along, alpha: on });
            // It goes on round, and the program answers by itself: the same
            // reaction, quieter, every time it passes the mouth.
            let past = along - MOUTH as f32;
            if past >= 0.0 {
                let laps = (past / n).floor();
                react(past - laps * n, if laps < 1.0 { 1.0 } else { 0.5 } * fade);
            }
        }
    }
    let mut lit = [0.0_f32; PLATES];
    for p in &impulses {
        for (j, plate) in RING.iter().enumerate() {
            let d = (p.along - j as f32).rem_euclid(n);
            let k = if d < 1.8 {
                (1.0 - d / 1.8).powi(2)
            } else if d > n - 0.35 {
                (d - (n - 0.35)) / 0.35
            } else {
                0.0
            };
            lit[*plate] = lit[*plate].max(k * p.alpha);
        }
    }
    let occasions = std::array::from_fn(|k| {
        let (_, _, at, flies) = OCCASIONS[k];
        let u = ((t - at) / flies).clamp(0.0, 1.0);
        let alpha = if k == 0 {
            // The glance stays a moment as a line, then is gone.
            bell(t, at - 0.05, at + 0.15, at + flies + 0.2, at + flies + 1.2)
        } else {
            bell(t, at - 0.05, at + 0.2, at + flies - 0.12, at + flies)
        };
        [u, alpha]
    });
    let others = [
        bell(t, 20.6, 21.4, 25.2, 26.6),
        bell(t, 16.0, 16.8, 20.6, 22.0),
    ];
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
        1 => [
            lit_part(PROGRAM_AT[0][0], PROGRAM_AT[0][1]),
            lit_part(PROGRAM_AT[1][0], PROGRAM_AT[1][1]),
            0.0,
            0.0,
            0.0,
            0.0,
        ],
        2 => std::array::from_fn(|k| lit_part(VERBS_AT[k], VERBS_AT[k] + VERB_SECONDS)),
        _ => [0.0; 6],
    };
    let listed = match card {
        1 => bell(
            t,
            PROGRAM_AT[0][0] - 1.0,
            PROGRAM_AT[0][0],
            CARDS[1][1] - 1.0,
            CARDS[1][1],
        ),
        2 => bell(
            t,
            VERBS_AT[0] - 1.0,
            VERBS_AT[0],
            CARDS[2][1] - 1.0,
            CARDS[2][1],
        ),
        _ => 0.0,
    };
    let circuit = 1.0 - smooth(FADE, LOOP_SECONDS - 1.5, t);
    let observed = VERBS_AT[3];
    let traced = if t >= observed {
        let from = round(observed);
        [from, round(t).min(from + n)]
    } else {
        [0.0, 0.0]
    };
    Frame {
        time: t,
        camera: camera(t),
        light: 0.34 + 0.66 * smooth(0.0, 2.6, t) - 0.66 * smooth(FADE, LOOP_SECONDS, t),
        // Eleven breaths per loop.
        breath: 0.5 - 0.5 * (t / LOOP_SECONDS * 11.0 * TAU).cos(),
        contour: 0.3 + 0.55 * smooth(0.4, 2.6, t) - 0.55 * smooth(FADE, LOOP_SECONDS, t),
        // The living light is always there; «ощущать» brings it out.
        presence: (0.35 + 0.65 * smooth(0.6, 3.6, t) - 0.65 * smooth(FADE, LOOP_SECONDS, t))
            * (1.0 + 0.8 * bell(t, VERBS_AT[2], VERBS_AT[2] + 1.8, 59.0, FADE + 1.2)),
        marks: 1.0 - 0.8 * smooth(MARKS[0], MARKS[1], t)
            + 0.8 * smooth(FADE, LOOP_SECONDS - 0.6, t),
        circuit,
        whole: bell(t, VERBS_AT[4], VERBS_AT[4] + 1.5, 59.0, FADE),
        groove: (0.35 * smooth(reaches(0), reaches(0) + 0.7, t)
            + 0.3 * smooth(reaches(1), reaches(1) + 0.7, t)
            + 0.35 * smooth(reaches(2), reaches(2) + 0.7, t))
            * circuit,
        layer: -APART
            * smooth(VERBS_AT[5], VERBS_AT[5] + 2.2, t)
            * (1.0 - smooth(FADE, LOOP_SECONDS - 0.6, t)),
        others,
        occasions,
        impulses,
        reaction,
        lit,
        traced,
        card,
        shown,
        options,
        listed,
    }
}

/// Where on the ring (world) an impulse is: between two plates' nodes.
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
    const ROWS: [&[(usize, Kind)]; 3] = [
        &[(0, Kind::Lead), (1, Kind::Key)],
        &[
            (2, Kind::Lead),
            (3, Kind::Key),
            (4, Kind::Key),
            (5, Kind::Option(0)),
            (6, Kind::Option(1)),
        ],
        &[
            (7, Kind::Lead),
            (8, Kind::Option(0)),
            (9, Kind::Option(1)),
            (10, Kind::Option(2)),
            (11, Kind::Option(3)),
            (12, Kind::Option(4)),
            (13, Kind::Option(5)),
        ],
    ];
    ROWS[card.min(2)]
}
/// How many of a card's parts stand on one line.
pub fn options_per_line(card: usize) -> usize {
    if card == 2 {
        2
    } else {
        1
    }
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
            (x.marks, y.marks),
            (x.circuit, 0.0),
            (x.layer, y.layer),
        ] {
            assert!(close(p, q, 0.01), "{p} vs {q}");
        }
        for e in 0..3 {
            assert!(close(x.camera.eye[e], y.camera.eye[e], 0.003));
        }
        assert!(close(x.camera.focus, y.camera.focus, 0.02));
        // Nothing of the program runs at the seam.
        for f in [&x, &y] {
            assert!(f.impulses.iter().all(|p| p.alpha < 0.01));
            assert!(f.reaction[1] < 0.01 || f.reaction[0] >= 1.0);
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
                f.whole,
                f.groove,
                f.shown,
                f.listed,
                f.reaction[0],
                f.reaction[1],
            ] {
                assert!(v.is_finite() && (0.0..=1.0).contains(&v), "{v} at {t}");
            }
            assert!(f.presence.is_finite() && (0.0..=1.8).contains(&f.presence));
            assert!(f.layer <= 0.0 && f.layer >= -APART);
            assert!(f
                .lit
                .iter()
                .chain(&f.options)
                .chain(&f.others)
                .chain(f.occasions.iter().flatten())
                .all(|v| (0.0..=1.0).contains(v)));
            for p in &f.impulses {
                assert!(p.along.is_finite() && (0.0..=1.0).contains(&p.alpha));
            }
            assert!(f.traced[0] <= f.traced[1]);
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
    }

    #[test]
    fn the_ring_runs_along_wires() {
        let n = RING.len();
        for i in 0..n {
            assert!(linked(RING[i], RING[(i + 1) % n]), "{i}");
        }
        // It passes the eye, the ear, the thigh and leaves by the mouth.
        assert_eq!(RING[OCCASIONS[0].1], 1);
        assert_eq!(RING[OCCASIONS[1].1], 3);
        assert_eq!(RING[OCCASIONS[2].1], 31);
        assert_eq!(RING[MOUTH], 4);
        // Every plate is wired to the heart of the circuit.
        for i in 0..PLATES {
            assert!(depth(i) < PLATES, "plate {i}");
        }
    }

    #[test]
    fn the_page_is_told_in_order() {
        // «Не кто-то»: the circuit is drawn and the marks fade before the
        // program starts.
        let wired = compose(CARDS[0][1]);
        assert!(wired.marks < 0.25 && wired.impulses.is_empty());
        assert!((0..LINKS.len()).all(|k| wired_at(k) < WIRING[1]));
        assert!(compose(WIRING[0] - 0.1).marks > 0.99);
        // The occasions come one after another, each in its own time, and
        // every impulse runs the same groove to the mouth.
        for (k, occasion) in OCCASIONS.iter().enumerate() {
            assert!(occasion.2 > CARDS[1][0] && reaches(k) < PROGRAM_AT[0][1]);
            if k > 0 {
                assert!(OCCASIONS[k].2 > reaches(k - 1) + 0.5);
            }
            let f = compose(reaches(k) + 0.5);
            assert!(f.reaction[1] > 0.99, "reaction {k}");
            assert!(compose(lands(k) + 0.3).options[0] > 0.99);
        }
        // The others are there while they give their occasion.
        assert!(compose(OCCASIONS[0].2 + 0.5).others[1] > 0.99);
        assert!(compose(OCCASIONS[1].2 + 0.5).others[0] > 0.99);
        // «Живёт собой»: nothing comes any more, the impulse goes on round
        // and the program answers by itself.
        for t in [32.0, 40.0, 50.0, 60.0] {
            let f = compose(t);
            assert!(f.occasions.iter().all(|o| o[1] == 0.0) && f.others == [0.0; 2]);
            assert!(f.impulses.len() == 1 && f.impulses[0].alpha > 0.99, "{t}");
        }
        assert!(compose(33.0).options[1] > 0.99);
        // The lens is elsewhere meanwhile, and finds it again at «видеть».
        let away = camera(35.8);
        assert!(away.coc(away.subject()) > 2.0);
        let seen = camera(VERBS_AT[0] + 2.5);
        assert!(seen.coc(seen.subject()) < 0.3);
        // The six words in turn, one at a time.
        for (k, at) in VERBS_AT.iter().enumerate() {
            let f = compose(at + 0.5 * VERB_SECONDS);
            assert!(f.card == 2 && f.options[k] > 0.99, "verb {k}");
            assert_eq!(f.options.iter().filter(|v| **v > 0.5).count(), 1);
        }
        // «Ощущать», «наблюдать», «осознавать», «различать».
        assert!(compose(VERBS_AT[2] + 2.5).presence > 1.7);
        assert!(still(VERBS_AT[3] + 2.0) > 0.99);
        let traced = compose(VERBS_AT[3] + 3.3).traced;
        assert!(traced[1] - traced[0] > RING.len() as f32 - 0.01);
        assert!(compose(VERBS_AT[4] + 2.0).whole > 0.99);
        let apart = compose(VERBS_AT[5] + 3.0);
        assert!(close(apart.layer, -APART, 1e-3));
        let c = apart.camera;
        assert!(c.coc(c.subject()) < 0.3 && c.coc(c.subject() + apart.layer) > 2.0);
        // The program slows, but it does not stop.
        let slow = round(VERBS_AT[5] + 3.1) - round(VERBS_AT[5] + 3.0);
        assert!(slow > 0.4 * SPEED * 0.1 && slow < 0.7 * SPEED * 0.1);
    }

    #[test]
    fn the_subject_is_framed_in_every_shot() {
        let inside = |c: &Camera, p: [f32; 3]| {
            let q = c.project(p).unwrap();
            q.at[0] > 50.0 && q.at[0] < SIZE[0] - 50.0 && q.at[1] > 30.0 && q.at[1] < SIZE[1] - 50.0
        };
        let body = [EYE, HEEL, BALL, CHAIR_LEGS[0], on_figure(85.0, CROWN_SVG)];
        for t in [0.0, 3.0, 18.0, 25.0, 34.0, 40.0, 54.0, 58.0, 65.0] {
            for p in body {
                assert!(inside(&camera(t), p), "{t} {p:?}");
            }
        }
        // The close shots keep the head and the chest.
        for t in [10.0, 44.0] {
            for p in [EYE, on_figure(85.0, CROWN_SVG), on_figure(150.0, 300.0)] {
                assert!(inside(&camera(t), p), "{t} {p:?}");
            }
        }
        // The others, while they give their occasion.
        for (k, t) in [(1, 17.5), (0, 22.4)] {
            assert!(inside(&camera(t), other_face(k)), "other {k}");
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
