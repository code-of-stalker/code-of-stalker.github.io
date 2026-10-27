//! «Персонаж: сон, в который поверил Абсолют»: Step 4, the second block's
//! page 01/08. The seated person of pages 04–06, at first just themself: a
//! quiet, even light of Presence inside the body. Then the page's three
//! paragraphs, in order:
//! «Человек живёт не собой, а персонажем — ментальной конструкцией,
//! собранной из образов, заимствованных установок, страхов и памяти» —
//! pieces come from the room and lock onto the body as the plates of a
//! mosaic shell: images (framed pictures out of the air), borrowed attitudes
//! (letterless lines brought from other people deep in the room), fears
//! (dark trembling shards rising from below) and memory (faded frames from
//! behind). The living light is then seen only through the seams.
//! «Он живёт в картине мира, где уже ментальной матрицей задано, что можно,
//! а что нельзя, что хорошо, а что плохо» — a picture frame stands up
//! around the person, a matrix inside it; a sweep shows that every cell is
//! already marked МОЖНО, НЕЛЬЗЯ, ХОРОШО or ПЛОХО. Nothing is written: it was
//! there before.
//! «Он верит в образ себя … не в живое Я, не в Присутствие — а в «я
//! такой-то», или «я не такой», «я должен», или «я хочу»» — tags are pinned
//! to the shell one by one; the lens stays on them while the living light
//! inside goes on, out of focus, unlooked at.
//! The character never falls apart here: that is for the pages after.
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
/// Reduced motion holds this moment: the shell, the picture of the world
/// behind it and the four tags, «не в живое Я, не в Присутствие» on the card.
pub const STILL: f32 = 52.4;

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
/// The middle of the body: where the pieces gather around.
pub const CENTRE: [f32; 3] = on_figure(150.0, 250.0);

/// What the character is assembled from, in the page's order.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Piece {
    /// «Образы»: framed pictures that come out of the air.
    Image,
    /// «Заимствованные установки»: letterless lines brought from others.
    Attitude,
    /// «Страхи»: dark trembling shards that rise from below.
    Fear,
    /// «Память»: faded frames that come from behind.
    Memory,
}
pub const PIECES: [Piece; 4] = [Piece::Image, Piece::Attitude, Piece::Fear, Piece::Memory];
/// The number of plates: one piece each.
pub const PLATES: usize = CELLS.len();
/// When each kind of piece starts coming (s), and how long it is lit on the
/// card.
pub const KIND_AT: [f32; 4] = [5.2, 8.8, 12.4, 16.0];
pub const KIND_SECONDS: f32 = 3.6;
/// The pieces of one kind leave within this span, each flies this long.
pub const SPREAD: f32 = 2.3;
pub const FLIGHT: f32 = 1.3;

/// The kind of the piece for plate `i`. Neighbouring plates come in fours
/// (the sites are listed top to bottom), and each four holds every kind in
/// its own order: the kinds are mixed evenly over the whole body, none owns
/// a part of it.
pub fn kind(i: usize) -> Piece {
    let group = (i / 4) as u32;
    let start = (hash(900 + group) * 4.0) as usize;
    let step = if hash(950 + group) < 0.5 { 1 } else { 3 };
    PIECES[(start + step * (i % 4)) % 4]
}
pub fn kind_index(i: usize) -> usize {
    PIECES.iter().position(|p| *p == kind(i)).unwrap_or(0)
}
/// When the piece for plate `i` leaves; it locks on `FLIGHT` later.
pub fn departs(i: usize) -> f32 {
    let k = kind_index(i);
    let same: Vec<usize> = (0..PLATES).filter(|j| kind_index(*j) == k).collect();
    // In a shuffled order, so the plates of a kind appear all over the body.
    let rank = same
        .iter()
        .filter(|j| hash(300 + **j as u32) < hash(300 + i as u32))
        .count();
    KIND_AT[k] + 0.15 + SPREAD * rank as f32 / same.len().max(1) as f32
}
pub fn arrives(i: usize) -> f32 {
    departs(i) + FLIGHT
}

/// The other people deep in the room the attitudes are borrowed from:
/// where each sits (world x, z) and whether it faces left.
pub const OTHERS: [(f32, f32, bool); 3] =
    [(-2.0, 3.4, false), (2.25, 2.8, true), (1.05, 5.6, true)];
/// Where an attitude leaves another person: before their face.
pub fn other_face(k: usize) -> [f32; 3] {
    let (x, z, left) = OTHERS[k % OTHERS.len()];
    let p = on_figure(if left { 335.0 - 128.0 } else { 128.0 }, 72.0);
    [x + p[0] + if left { -0.08 } else { 0.08 }, p[1], z]
}

/// The picture of the world: a frame standing just behind the person, from
/// the floor up (left, bottom, right, top, in its plane `FRAME_Z`), and its
/// matrix of cells.
pub const FRAME_Z: f32 = 0.34;
pub const FRAME_RECT: [f32; 4] = [-0.84, 0.0, 0.98, 1.7];
pub const COLUMNS: usize = 5;
pub const ROWS: usize = 4;
/// What each cell of the matrix already says: 0 МОЖНО, 1 НЕЛЬЗЯ, 2 ХОРОШО,
/// 3 ПЛОХО. A fixed table, top row first.
pub const VERDICTS: [[usize; COLUMNS]; ROWS] = [
    [1, 2, 0, 3, 1],
    [3, 0, 1, 2, 0],
    [2, 1, 3, 0, 3],
    [0, 3, 2, 1, 2],
];
/// The centre of a matrix cell (world).
pub fn cell_centre(row: usize, column: usize) -> [f32; 3] {
    let [x0, y0, x1, y1] = FRAME_RECT;
    let w = (x1 - x0) / COLUMNS as f32;
    let h = (y1 - y0) / ROWS as f32;
    [
        x0 + (column as f32 + 0.5) * w,
        y1 - (row as f32 + 0.5) * h,
        FRAME_Z,
    ]
}
pub const FRAME_DRAW: [f32; 2] = [23.0, 25.2];
pub const GRID: [f32; 2] = [24.6, 26.0];
/// The sweep that shows what is already there, left to right.
pub const SWEEP: [f32; 2] = [26.4, 29.6];
/// Each verdict lit in turn, for the same time.
pub const VERDICT_AT: [f32; 4] = [30.0, 31.7, 33.4, 35.1];
pub const VERDICT_SECONDS: f32 = 1.7;

/// The tags pinned to the character: the plate each hangs from, where the
/// tag hangs (world offset from that plate) and when it is pinned. The
/// words: «Я ТАКОЙ-ТО», «Я НЕ ТАКОЙ», «Я ДОЛЖЕН», «Я ХОЧУ».
pub const TAGS: [(usize, [f32; 2], f32); 4] = [
    (4, [0.2, 0.15], 41.0),
    (12, [0.31, -0.01], 43.4),
    (8, [-0.14, 0.4], 45.8),
    (28, [0.16, 0.16], 48.2),
];
/// The tags hang a little nearer the camera than the person.
pub const TAG_Z: f32 = -0.16;
/// «Не в живое Я, не в Присутствие»: the living light swells, unlooked at.
pub const LIVING: [f32; 2] = [50.4, 54.6];

/// The cards: one per paragraph (in, out).
pub const CARDS: [[f32; 2]; 3] = [[1.6, 20.6], [22.0, 37.2], [38.4, 57.6]];
/// The room sinks back into the loop's seam from here.
const FADE: f32 = 61.6;

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
const MOVES: [(f32, f32, Shot); 7] = [
    // «Человек живёт не собой…»: the whole body and the air around it,
    // where the pieces come from.
    (1.2, 4.4, shot([0.3, 0.88, -3.2], 1400.0, 470.0, 0.025)),
    // The shell is complete: a little nearer.
    (16.8, 20.4, shot([0.24, 0.9, -2.7], 1400.0, 455.0, 0.03)),
    // «Он живёт в картине мира…»: back, the whole frame around the person.
    (21.2, 24.4, shot([0.68, 0.9, -3.75], 1380.0, 430.0, 0.02)),
    // «Он верит в образ себя…»: close, the upper body and the tags.
    (37.6, 40.6, shot([0.28, 0.98, -2.3], 1300.0, 410.0, 0.04)),
    // «Не в живое Я…»: a little nearer still, the lens on the tags.
    (50.0, 54.4, shot([0.3, 0.99, -2.2], 1300.0, 410.0, 0.045)),
    // Everything stands: wide.
    (56.4, 60.4, shot([0.36, 0.88, -3.9], 1420.0, 465.0, 0.02)),
    (62.0, 65.6, WIDE),
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
const FOCUS: [(f32, f32, f32); 4] = [
    // The sweep over the matrix: its words sharp.
    (25.8, 27.2, FRAME_Z),
    (35.6, 37.4, 0.0),
    // The tags: the lens stays on them.
    (40.0, 41.4, TAG_Z),
    (56.6, 58.6, 0.0),
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

/// Plate `i`'s site on the body (SVG units) at `t`: the mosaic breathes a
/// little, like a dream, never further than a few millimetres from where
/// it rests (periodic in the loop).
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

/// A piece on its way to its plate: where (world), its size (m), how far
/// it has come (0..1) and how visible it is.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Flight {
    pub plate: usize,
    pub kind: Piece,
    pub at: [f32; 3],
    pub size: f32,
    pub along: f32,
    pub alpha: f32,
}
/// Where plate `i` is on the shell (world), as it rests.
pub fn plate_at(i: usize) -> [f32; 3] {
    let [x, y] = CELLS[i];
    let p = on_figure(x, y);
    [p[0], p[1], -0.02]
}
/// Where the piece for plate `i` comes from, and the point its way bends
/// towards (world).
pub fn source(i: usize) -> ([f32; 3], [f32; 3]) {
    let r = |k: u32| hash(1000 + 17 * i as u32 + k);
    let to = plate_at(i);
    match kind(i) {
        Piece::Image => {
            // Out of the air around the upper body; some nearer the lens.
            let a = TAU * r(1);
            let from = [
                CENTRE[0] + (0.75 + 0.45 * r(2)) * a.cos(),
                (CENTRE[1] + 0.35 + (0.55 + 0.3 * r(3)) * a.sin().abs()).min(2.2),
                -1.1 + 1.0 * r(4),
            ];
            let bend = lerp3(from, to, 0.5);
            (from, [bend[0], bend[1] + 0.18, bend[2] - 0.1])
        }
        Piece::Attitude => {
            let from = other_face(i);
            let bend = lerp3(from, to, 0.5);
            (from, [bend[0], bend[1] + 0.32, bend[2]])
        }
        Piece::Fear => {
            // From the floor's shadows, rising.
            let side = if r(1) < 0.5 { -1.0 } else { 1.0 };
            let from = [
                CENTRE[0] + side * (0.55 + 0.5 * r(2)),
                0.02,
                -0.7 + 1.1 * r(3),
            ];
            (
                from,
                [to[0] + side * 0.25, (to[1] * 0.4).max(0.12), to[2] - 0.15],
            )
        }
        Piece::Memory => {
            // From behind the person, coming round to the front.
            let side = if r(1) < 0.5 { -1.0 } else { 1.0 };
            let from = [
                CENTRE[0] + side * (0.9 + 0.5 * r(2)),
                0.3 + 1.1 * r(3),
                1.3 + 1.1 * r(4),
            ];
            (
                from,
                [to[0] + side * 0.75, (from[1] + to[1]) * 0.5 + 0.1, -0.35],
            )
        }
    }
}
/// The piece for plate `i` at time `t`, while it flies.
pub fn flight(i: usize, t: f32) -> Option<Flight> {
    let start = departs(i);
    let u = (t - start) / FLIGHT;
    if !(0.0..1.0).contains(&u) {
        return None;
    }
    // Eased: it sets off, glides, settles onto its plate.
    let e = u * u * (3.0 - 2.0 * u);
    let (from, bend) = source(i);
    let mut at = curve(from, bend, plate_at(i), e);
    let kind = kind(i);
    if kind == Piece::Fear {
        // Fear trembles all the way, less as it locks.
        let k = 0.012 * (1.0 - e);
        at[0] += k * (t * 41.0 + i as f32).sin();
        at[1] += k * (t * 37.0 + 2.0 * i as f32).cos();
    }
    let size = match kind {
        Piece::Image => 0.19,
        Piece::Attitude => 0.18,
        Piece::Fear => 0.15,
        Piece::Memory => 0.19,
    };
    Some(Flight {
        plate: i,
        kind,
        at,
        // Each shrinks to the size of its plate as it arrives.
        size: size + (0.07 - size) * smooth(0.5, 1.0, u),
        along: u,
        alpha: smooth(0.0, 0.18, u) * (1.0 - smooth(0.9, 1.0, u)),
    })
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
    /// The others deep in the room, while the attitudes are borrowed.
    pub others: f32,
    /// Each plate of the shell: how far it is in place, and the flash of
    /// its locking (0..1).
    pub plates: [f32; PLATES],
    pub flash: [f32; PLATES],
    /// The pieces flying now.
    pub flights: Vec<Flight>,
    /// The whole construction, sinking with the room at the loop's seam.
    pub stands: f32,
    /// The picture of the world: frame drawn (0..1), grid, the sweep
    /// (where 0..1, alpha), what the sweep has shown, each verdict lit.
    pub frame: f32,
    pub grid: f32,
    /// How much the picture is the subject: full while it is told, then a
    /// quieter background behind the tags.
    pub picture: f32,
    pub sweep: [f32; 2],
    pub verdicts: [f32; 4],
    /// The tags: string drawn, tag shown, its swing (m).
    pub tags: [[f32; 3]; 4],
    /// The card on screen and its visibility; the parts lit in turn; the
    /// late half of the third card.
    pub card: usize,
    pub shown: f32,
    pub options: [f32; 4],
    pub listed: f32,
    pub late: f32,
}

/// Where the sweep is (0 left … 1 right of the frame) at `t`.
pub fn sweep_at(t: f32) -> f32 {
    let x = ((t - SWEEP[0]) / (SWEEP[1] - SWEEP[0])).clamp(0.0, 1.0);
    0.75 * x + 0.25 * x * x * (3.0 - 2.0 * x)
}

/// The whole choreography at `seconds` (wrapped to the loop).
pub fn compose(seconds: f32) -> Frame {
    let t = if seconds.is_finite() {
        seconds.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let stands = 1.0 - smooth(FADE, LOOP_SECONDS - 0.4, t);
    let plates = std::array::from_fn(|i| smooth(arrives(i) - 0.05, arrives(i) + 0.3, t) * stands);
    let flash = std::array::from_fn(|i| {
        let age = t - arrives(i);
        if (0.0..1.0).contains(&age) {
            smooth(0.0, 0.08, age) * (1.0 - age).powi(2)
        } else {
            0.0
        }
    });
    let flights = (0..PLATES).filter_map(|i| flight(i, t)).collect();
    let mut card = 0;
    let mut shown = 0.0;
    for (i, [a, b]) in CARDS.iter().enumerate() {
        if t >= a - 0.1 && t <= b + 0.1 {
            card = i;
            shown = bell(t, *a, a + 1.0, b - 0.8, *b);
        }
    }
    let lit = |at: f32, seconds: f32| bell(t, at, at + 0.4, at + seconds - 0.4, at + seconds);
    let options = match card {
        0 => std::array::from_fn(|k| lit(KIND_AT[k], KIND_SECONDS)),
        1 => std::array::from_fn(|k| lit(VERDICT_AT[k], VERDICT_SECONDS)),
        _ => [0.0; 4],
    };
    let listed = match card {
        0 => bell(
            t,
            KIND_AT[0] - 1.0,
            KIND_AT[0],
            CARDS[0][1] - 1.0,
            CARDS[0][1],
        ),
        1 => bell(
            t,
            SWEEP[1] - 0.6,
            SWEEP[1] + 0.2,
            CARDS[1][1] - 1.0,
            CARDS[1][1],
        ),
        _ => 0.0,
    };
    let tags = std::array::from_fn(|k| {
        let at = TAGS[k].2;
        let age = t - at - 0.55;
        let swing = if age > 0.0 {
            0.035 * (-age / 0.9).exp() * (age * 5.2).sin()
        } else {
            0.0
        };
        [
            smooth(at, at + 0.55, t) * stands,
            smooth(at + 0.35, at + 0.8, t) * stands,
            swing,
        ]
    });
    Frame {
        time: t,
        camera: camera(t),
        light: 0.34 + 0.66 * smooth(0.0, 2.6, t) - 0.66 * smooth(FADE, LOOP_SECONDS, t),
        // Eleven breaths per loop.
        breath: 0.5 - 0.5 * (t / LOOP_SECONDS * 11.0 * TAU).cos(),
        contour: 0.3 + 0.55 * smooth(0.4, 2.6, t) - 0.55 * smooth(FADE, LOOP_SECONDS, t),
        // The living light is there from the start and never goes out; it
        // swells once while the card says what is not believed in.
        presence: (0.35 + 0.65 * smooth(0.6, 3.6, t) - 0.65 * smooth(FADE, LOOP_SECONDS, t))
            * (1.0 + 0.4 * bell(t, LIVING[0], LIVING[0] + 1.4, LIVING[1] - 1.4, LIVING[1])),
        others: bell(
            t,
            KIND_AT[1] - 1.0,
            KIND_AT[1] + 0.2,
            KIND_AT[1] + 3.8,
            KIND_AT[1] + 5.0,
        ),
        plates,
        flash,
        flights,
        stands,
        frame: smooth(FRAME_DRAW[0], FRAME_DRAW[1], t) * stands,
        grid: smooth(GRID[0], GRID[1], t) * stands,
        picture: 1.0 - 0.55 * smooth(CARDS[1][1] - 0.4, CARDS[2][0] + 2.0, t),
        sweep: [
            sweep_at(t),
            bell(
                t,
                SWEEP[0] - 0.2,
                SWEEP[0] + 0.2,
                SWEEP[1] - 0.2,
                SWEEP[1] + 0.4,
            ),
        ],
        verdicts: std::array::from_fn(|k| lit(VERDICT_AT[k], VERDICT_SECONDS)),
        tags,
        card,
        shown,
        options,
        listed,
        late: smooth(LIVING[0], LIVING[0] + 1.0, t),
    }
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
    /// A part lit in turn (index 0..4); two to a line.
    Option(usize),
    /// A quiet half that comes later, with the living light.
    Late,
}
/// The rows of each card, in the atlas order of `tools/prepare-assets.mjs`.
pub fn card_rows(card: usize) -> &'static [(usize, Kind)] {
    const ROWS: [&[(usize, Kind)]; 3] = [
        &[
            (0, Kind::Lead),
            (1, Kind::Key),
            (2, Kind::Option(0)),
            (3, Kind::Option(1)),
            (4, Kind::Option(2)),
            (5, Kind::Option(3)),
        ],
        &[
            (6, Kind::Lead),
            (7, Kind::Key),
            (8, Kind::Option(0)),
            (9, Kind::Option(1)),
            (10, Kind::Option(2)),
            (11, Kind::Option(3)),
        ],
        &[
            (12, Kind::Lead),
            (13, Kind::Key),
            (14, Kind::Late),
            (15, Kind::Late),
        ],
    ];
    ROWS[card.min(2)]
}
/// The atlas row of tag `k` and of the matrix's verdict `v`.
pub const fn tag_row(k: usize) -> usize {
    16 + k
}
pub const fn verdict_row(v: usize) -> usize {
    20 + v
}

#[cfg(test)]
mod tests {
    use super::*;

    fn distance(a: [f32; 3], b: [f32; 3]) -> f32 {
        ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt()
    }
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
            (x.presence, y.presence),
            (x.shown, y.shown),
            (x.frame, y.frame),
            (x.grid, y.grid),
        ] {
            assert!(close(p, q, 0.01), "{p} vs {q}");
        }
        for e in 0..3 {
            assert!(close(x.camera.eye[e], y.camera.eye[e], 0.003));
        }
        assert!(close(x.camera.focus, y.camera.focus, 0.02));
        // Nothing of the character is left at the seam.
        for f in [&x, &y] {
            assert!(f.plates.iter().all(|p| *p < 0.01) && f.flights.is_empty());
            assert!(f.tags.iter().all(|t| t[0] < 0.01 && t[1] < 0.01));
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
                f.light, f.breath, f.contour, f.others, f.stands, f.frame, f.grid, f.picture,
                f.sweep[0], f.sweep[1], f.shown, f.listed, f.late,
            ] {
                assert!(v.is_finite() && (0.0..=1.0).contains(&v), "{v} at {t}");
            }
            assert!(f.presence.is_finite() && (0.0..=1.4).contains(&f.presence));
            assert!(f
                .plates
                .iter()
                .chain(&f.flash)
                .chain(&f.verdicts)
                .chain(&f.options)
                .all(|v| (0.0..=1.0).contains(v)));
            for tag in &f.tags {
                assert!((0.0..=1.0).contains(&tag[0]) && (0.0..=1.0).contains(&tag[1]));
                assert!(tag[2].abs() < 0.04);
            }
            for p in &f.flights {
                assert!(p.at.iter().all(|v| v.is_finite()) && p.size > 0.05 && p.size < 0.2);
                assert!((0.0..=1.0).contains(&p.alpha) && (0.0..1.0).contains(&p.along));
            }
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
    }

    #[test]
    fn the_kinds_are_mixed_over_the_whole_body() {
        let mut count = [0; 4];
        for i in 0..PLATES {
            count[kind_index(i)] += 1;
        }
        assert!(count.iter().all(|c| *c >= PLATES / 4 - 1), "{count:?}");
        // Every four neighbouring plates hold every kind.
        for g in 0..PLATES / 4 {
            let mut seen = [false; 4];
            for i in 4 * g..4 * g + 4 {
                seen[kind_index(i)] = true;
            }
            assert!(seen.iter().all(|s| *s), "group {g}");
        }
        // The head, the trunk and the legs each get every kind.
        for (top, bottom) in [(0.0, 120.0), (120.0, 330.0), (330.0, 530.0)] {
            let mut seen = [false; 4];
            for (i, c) in CELLS.iter().enumerate() {
                if c[1] >= top && c[1] < bottom {
                    seen[kind_index(i)] = true;
                }
            }
            assert!(seen.iter().all(|s| *s), "{top}..{bottom}");
        }
    }

    #[test]
    fn the_page_is_told_in_order() {
        // At first the person is only themself: the living light, no shell.
        let first = compose(4.0);
        assert!(first.presence > 0.9 && first.plates.iter().all(|p| *p == 0.0));
        // The kinds come in the page's order, each while it is lit on the card.
        for i in 0..PLATES {
            let k = kind_index(i);
            assert!(departs(i) >= KIND_AT[k] && arrives(i) <= KIND_AT[k] + KIND_SECONDS + 0.2);
            if k > 0 {
                assert!(departs(i) >= KIND_AT[k - 1] + 1.0);
            }
        }
        for (k, at) in KIND_AT.iter().enumerate() {
            let f = compose(at + KIND_SECONDS * 0.5);
            assert!(f.card == 0 && f.options[k] > 0.99, "kind {k}");
        }
        // The attitudes are borrowed from the others, who are there meanwhile.
        assert!(compose(KIND_AT[1] + 1.5).others > 0.99);
        assert_eq!(compose(KIND_AT[0] + 1.0).others, 0.0);
        // The shell is complete before the picture of the world.
        let built = compose(CARDS[0][1]);
        assert!(built.plates.iter().all(|p| *p > 0.99) && built.flights.is_empty());
        assert!(built.frame == 0.0 && built.grid == 0.0);
        // The marks are already there: the sweep shows them, it never writes.
        assert!(compose(SWEEP[0] - 0.1).grid > 0.99);
        assert!(compose(SWEEP[1] - 0.1).card == 1);
        for (k, at) in VERDICT_AT.iter().enumerate() {
            let f = compose(at + 0.85);
            assert!(f.verdicts[k] > 0.99 && f.options[k] > 0.99, "verdict {k}");
            assert!(f.verdicts.iter().filter(|v| **v > 0.5).count() == 1);
        }
        // Then the tags, one after another, while the third card stands.
        for k in 1..4 {
            assert!(TAGS[k].2 > TAGS[k - 1].2 + 1.0);
        }
        for (k, tag) in TAGS.iter().enumerate() {
            let f = compose(tag.2 + 1.0);
            assert!(f.card == 2 && f.tags[k][1] > 0.99, "tag {k}");
            assert!(f.tags[k + 1..].iter().all(|t| t[0] == 0.0));
        }
        // «Не в живое Я»: the living light swells while the lens stays on the tags.
        let living = compose((LIVING[0] + LIVING[1]) * 0.5);
        assert!(living.presence > 1.3 && living.late > 0.99);
        assert!(close(
            living.camera.focus,
            TAG_Z - living.camera.eye[2],
            0.02
        ));
        // And everything stands until the room sinks into the seam.
        let end = compose(FADE - 0.2);
        assert!(end.plates.iter().all(|p| *p > 0.99) && end.frame > 0.99);
        assert!(end.tags.iter().all(|t| t[1] > 0.99));
    }

    #[test]
    fn every_piece_lands_on_its_plate() {
        for i in 0..PLATES {
            let last = flight(i, arrives(i) - 1e-3).unwrap();
            assert!(distance(last.at, plate_at(i)) < 0.01, "plate {i}");
            assert!(flight(i, arrives(i) + 0.01).is_none());
            // It never jumps on the way.
            let mut previous = flight(i, departs(i) + 1e-3).unwrap().at;
            for k in 1..100 {
                let p = flight(i, departs(i) + FLIGHT * k as f32 / 100.0)
                    .unwrap()
                    .at;
                assert!(distance(p, previous) < 0.1, "plate {i} at {k}");
                previous = p;
            }
            // The attitudes start at the others' faces; memory behind the person.
            let (from, _) = source(i);
            match kind(i) {
                Piece::Attitude => assert!(from[2] > 2.0),
                Piece::Memory => assert!(from[2] > 1.0),
                Piece::Fear => assert!(from[1] < 0.05),
                Piece::Image => assert!(from[1] > CENTRE[1]),
            }
        }
    }

    #[test]
    fn the_subject_is_framed_in_every_shot() {
        let inside = |c: &Camera, p: [f32; 3]| {
            let q = c.project(p).unwrap();
            q.at[0] > 50.0 && q.at[0] < SIZE[0] - 50.0 && q.at[1] > 30.0 && q.at[1] < SIZE[1] - 50.0
        };
        let body = [EYE, HEEL, BALL, CHAIR_LEGS[0], on_figure(85.0, CROWN_SVG)];
        for t in [0.0, 3.0, 10.0, 18.0, 22.0, 30.0, 58.0, 65.0] {
            for p in body {
                assert!(inside(&camera(t), p), "{t} {p:?}");
            }
        }
        // The picture of the world: all of it.
        let [x0, y0, x1, y1] = FRAME_RECT;
        for t in [26.0, 30.0, 36.0] {
            for p in [
                [x0, y0, FRAME_Z],
                [x1, y1, FRAME_Z],
                [x0, y1, FRAME_Z],
                [x1, y0, FRAME_Z],
            ] {
                assert!(inside(&camera(t), p), "{t} {p:?}");
            }
        }
        // The tags and what they hang from.
        for t in [44.0, 50.0, 53.0] {
            for (plate, offset, _) in TAGS {
                let p = plate_at(plate);
                assert!(inside(&camera(t), p), "{t} plate {plate}");
                let tag = [p[0] + offset[0], p[1] + offset[1], TAG_Z];
                assert!(inside(&camera(t), tag), "{t} tag {plate}");
            }
        }
    }

    #[test]
    fn the_lens_stays_on_the_tags() {
        for t in [44.0, 48.0, 52.0] {
            let c = camera(t);
            assert!(c.coc(TAG_Z - c.eye[2]) < 0.3, "{t}");
        }
        // The words of the matrix are sharp while the sweep shows them.
        let c = camera(28.0);
        assert!(c.coc(FRAME_Z - c.eye[2]) < 0.3);
    }

    #[test]
    fn every_theme_has_a_look() {
        for code in 0..8 {
            let l = look(code);
            assert_eq!(l.light, matches!(code, 1 | 5 | 6));
        }
    }
}
