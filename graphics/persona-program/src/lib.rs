//! «Механизм обусловленности»: Step 4, the second block's page 02/08.
//! «Шкатулка»: no room and no seated person, a music box on a dark table.
//! Under its glass lid a pinned brass drum turns and plucks a steel comb;
//! on the lid a faceless wooden figurine turns on a little table and makes
//! the same three moves over and over: it reaches out, lowers its arm and
//! bows. The lens starts at its blank head and goes down into what moves it:
//! «Персонаж — это не кто-то» — the head, then the whole figure on the box.
//! «Это механизм обусловленности» — down the shaft through the glass to the
//! gears and the drum. «Это программа, которая запускается и живёт собой»
//! — the key turns by itself, the whole mechanism runs.
//! «…пока ты не начнёшь» and the six ways of looking, one beat each:
//! видеть — a lamp switches on over the box; рассматривать — close on the
//! pins; ощущать — the comb's teeth tremble; наблюдать — the whole box from
//! afar; осознавать — the pins, read in passing, spell «НАДО», «НЕЛЬЗЯ»;
//! различать — the drum slows and stops, the figurine freezes mid-gesture.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time and of the drum's pin map. The browser adapter only uploads the
//! values and the shaders only paint them.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod generated;

use generated::LABEL_BAND;
use std::f32::consts::{FRAC_PI_2, PI, TAU};
use watcher_scene_palette::Palette;

/// Authored frame, 3 : 2 like the other Step 4 scenes.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// The whole page: a seamless loop.
pub const LOOP_SECONDS: f32 = 70.0;
/// Reduced motion holds this moment: the drum stopped, the figurine frozen
/// with its arm half raised under the lamp, «И РАЗЛИЧАТЬ.» lit.
pub const STILL: f32 = 60.0;

// The box, in world units: the drum's axis is x through the origin, up is
// y, we look in from the front along +z. Mirrored in shaders/scene.frag.
pub const DRUM_R: f32 = 0.18;
/// The drum's pins: rows around it, columns along it (one per tooth).
pub const ROWS: usize = 56;
pub const COLS: usize = 37;
/// Between two teeth, and two columns of pins.
pub const PITCH: f32 = 0.028;
pub const ROW_STEP: f32 = TAU / ROWS as f32;
/// A pin meets the comb's tips here: straight back (+z), at the axis' height.
/// Angles on the drum run from up (+y, 0) towards the comb (+z, π/2).
pub const PLUCK: f32 = FRAC_PI_2;
/// The drum at rest: its pins stand half a row away from the comb.
pub const REST: f32 = PLUCK + 0.5 * ROW_STEP;
/// The drum turns three times in a loop.
pub const TURNS: f32 = 3.0;
/// The turntable turns 40 : 30 against the drum (end gear, crown gear).
pub const TABLE_RATIO: f32 = 4.0 / 3.0;
/// The winding key turns twice for each turn of the drum.
pub const KEY_RATIO: f32 = 2.0;
/// The spring barrel's 18 teeth drive the drum's 6-tooth pinion: the
/// barrel turns a third as fast, the other way, once round in a loop.
pub const BARREL_RATIO: f32 = 6.0 / 18.0;
/// The barrel's centre from the drum's axis (y, z), as the shader has it.
pub const BARREL_AT: [f32; 2] = [-0.2, 0.02];
/// Where the figurine stands: the turntable's top, on the glass lid.
pub const FIG: [f32; 3] = [0.675, 0.445, 0.0];
/// The lamp over the box, front left.
pub const LAMP: [f32; 3] = [-1.2, 2.2, -1.4];

/// The drum's speed, of its full speed: it starts, plays, slows for the
/// reading and stops for «различать»: (from, to, change).
const RAMPS: [(f32, f32, f32); 3] = [(0.3, 2.3, 1.0), (46.6, 47.8, -0.4), (55.4, 57.8, -0.6)];
/// From here to the loop's end the drum stands still.
pub const STOPPED: f32 = 57.8;
/// The two words the pins spell, and when each faces the lens.
pub const WORDS: [(&str, f32); 2] = [("НАДО", 49.6), ("НЕЛЬЗЯ", 54.2)];
/// The drum's angle where a word faces the lens.
pub const READ_AT: f32 = -1.2;

/// A plucked tooth: how far its tip swings and how fast it dies away.
pub const TOOTH_AMP: f32 = 0.004;
pub const TOOTH_DECAY: f32 = 0.9;

/// The figurine's program: one gesture per quarter turn of the drum, and
/// the phase of it where the drum stops (the arm half raised).
pub const GESTURE: f32 = TAU / 4.0;
pub const FROZEN_PHASE: f32 = 0.22;
/// The figurine's turn when the drum stops: three quarters to the lens.
pub const YAW_REST: f32 = -0.5;
pub const JOINTS: usize = 26;

/// The lamp switches on with «видеть».
pub const SWITCH: f32 = 25.6;

pub fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
/// Quintic ease: still at both ends, for the lens.
fn ease(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
}
pub fn bell(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}
fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}
pub fn lerp3(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    [
        lerp(a[0], b[0], t),
        lerp(a[1], b[1], t),
        lerp(a[2], b[2], t),
    ]
}
fn add(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
fn sub(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn scale(a: [f32; 3], k: f32) -> [f32; 3] {
    a.map(|v| v * k)
}
fn dot(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
fn length(a: [f32; 3]) -> f32 {
    dot(a, a).sqrt()
}
fn normalize(a: [f32; 3]) -> [f32; 3] {
    let l = length(a).max(1e-6);
    a.map(|v| v / l)
}

/// ∫ of one smoothstep ramp from `a` to `b`: u³ − u⁴/2 inside it.
fn ramp_area(a: f32, b: f32, t: f32) -> f32 {
    if t <= a {
        0.0
    } else if t >= b {
        0.5 * (b - a) + (t - b)
    } else {
        let u = (t - a) / (b - a);
        (b - a) * u * u * u * (1.0 - 0.5 * u)
    }
}
/// The drum's speed now, 0 (still) to 1 (full).
pub fn speed(t: f32) -> f32 {
    RAMPS.iter().map(|&(a, b, k)| k * smooth(a, b, t)).sum()
}
fn travel(t: f32) -> f32 {
    RAMPS.iter().map(|&(a, b, k)| k * ramp_area(a, b, t)).sum()
}
/// The drum's angle: at REST over the seam, three whole turns on at the stop.
pub fn drum(t: f32) -> f32 {
    let t = t.clamp(0.0, STOPPED);
    REST + TURNS * TAU * travel(t) / travel(STOPPED)
}
/// When the drum reaches `angle` (between REST and three turns on).
fn when(angle: f32) -> f32 {
    let (mut lo, mut hi) = (0.0_f32, STOPPED);
    for _ in 0..40 {
        let mid = 0.5 * (lo + hi);
        if drum(mid) < angle {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    0.5 * (lo + hi)
}
/// An angle folded into (−π, π].
pub fn wrap(a: f32) -> f32 {
    let w = (a + PI).rem_euclid(TAU) - PI;
    if w <= -PI {
        w + TAU
    } else {
        w
    }
}

/// The dot-matrix letters the pins spell, five columns by seven rows.
const GLYPHS: [(char, [&str; 7]); 9] = [
    (
        'Н',
        [
            "#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#",
        ],
    ),
    (
        'А',
        [
            "..#..", ".#.#.", "#...#", "#...#", "#####", "#...#", "#...#",
        ],
    ),
    (
        'Д',
        [
            ".###.", ".#.#.", ".#.#.", ".#.#.", ".#.#.", "#####", "#...#",
        ],
    ),
    (
        'О',
        [
            ".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###.",
        ],
    ),
    (
        'Е',
        [
            "#####", "#....", "#....", "####.", "#....", "#....", "#####",
        ],
    ),
    (
        'Л',
        [
            "..###", ".#..#", ".#..#", ".#..#", ".#..#", ".#..#", "#...#",
        ],
    ),
    (
        'Ь',
        [
            "#....", "#....", "#....", "####.", "#...#", "#...#", "####.",
        ],
    ),
    (
        'З',
        [
            ".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###.",
        ],
    ),
    (
        'Я',
        [
            ".####", "#...#", "#...#", ".####", "..#.#", ".#..#", "#...#",
        ],
    ),
];
/// The tune between the words: a pin per row, a second one on every
/// fourth, walking up and down the comb.
const TUNE: [usize; 16] = [
    14, 18, 21, 25, 21, 18, 14, 11, 16, 20, 23, 27, 23, 20, 16, 9,
];

/// The drum's pins, fixed for good: the program. Built once.
#[derive(Clone, Debug, PartialEq)]
pub struct Program {
    /// One bit per column, for each row around the drum.
    pub rows: [u64; ROWS],
    /// The top row of each word (its letters run down the following rows).
    pub word_tops: [usize; 2],
    /// When each tooth is plucked in a loop, sorted.
    pub plucks: Vec<Vec<f32>>,
}
impl Default for Program {
    fn default() -> Self {
        Self::new()
    }
}
impl Program {
    pub fn new() -> Self {
        let mut rows = [0_u64; ROWS];
        let mut word_tops = [0; 2];
        for (w, (word, at)) in WORDS.iter().enumerate() {
            // Row r faces READ_AT when −r·ROW_STEP + drum(at) = READ_AT.
            let centre = ((drum(*at) - READ_AT) / ROW_STEP).round() as i64;
            let top = (centre - 3).rem_euclid(ROWS as i64) as usize;
            word_tops[w] = top;
            let letters: Vec<char> = word.chars().collect();
            let width = letters.len() * 6 - 1;
            let start = (COLS - width) / 2;
            for (l, ch) in letters.iter().enumerate() {
                let Some((_, glyph)) = GLYPHS.iter().find(|(c, _)| c == ch) else {
                    continue;
                };
                for (y, line) in glyph.iter().enumerate() {
                    for (x, cell) in line.chars().enumerate() {
                        if cell == '#' {
                            rows[(top + y) % ROWS] |= 1 << (start + l * 6 + x);
                        }
                    }
                }
            }
        }
        let near_word = |r: usize| word_tops.iter().any(|&top| (r + ROWS - top + 1) % ROWS < 9);
        for (r, row) in rows.iter_mut().enumerate() {
            if near_word(r) {
                continue;
            }
            let note = TUNE[r % TUNE.len()] + (r / TUNE.len()) % 3;
            *row |= 1 << note;
            if r % 4 == 0 {
                *row |= 1 << (note - 8);
            }
        }
        let mut plucks = vec![Vec::new(); COLS];
        for (r, row) in rows.iter().enumerate() {
            for (c, list) in plucks.iter_mut().enumerate() {
                if (row >> c) & 1 == 0 {
                    continue;
                }
                // The row is at the comb when the drum stands at this angle,
                // once a turn.
                let base = PLUCK + r as f32 * ROW_STEP;
                for k in -1..=4 {
                    let angle = base + k as f32 * TAU;
                    if angle > REST && angle < REST + TURNS * TAU {
                        list.push(when(angle));
                    }
                }
            }
        }
        for list in &mut plucks {
            list.sort_by(f32::total_cmp);
        }
        Self {
            rows,
            word_tops,
            plucks,
        }
    }
    /// The rows as the shader's `uvec4 u_pins[28]`: low and high bits of
    /// each row in turn.
    pub fn packed(&self) -> [u32; ROWS * 2] {
        let mut out = [0; ROWS * 2];
        for (r, row) in self.rows.iter().enumerate() {
            out[2 * r] = *row as u32;
            out[2 * r + 1] = (*row >> 32) as u32;
        }
        out
    }
    pub fn pin(&self, row: usize, col: usize) -> bool {
        col < COLS && (self.rows[row % ROWS] >> col) & 1 == 1
    }
    /// How far each tooth's tip is bent now (up is +), the last three
    /// plucks ringing out.
    pub fn teeth(&self, t: f32) -> [f32; 40] {
        let mut out = [0.0; 40];
        for (c, list) in self.plucks.iter().enumerate() {
            let n = list.len();
            if n == 0 {
                continue;
            }
            let after = list.partition_point(|&e| e <= t);
            let f = tooth_frequency(c);
            for back in 1..=3.min(n) {
                let at = if back <= after {
                    list[after - back]
                } else {
                    list[n + after - back] - LOOP_SECONDS
                };
                let dt = t - at;
                out[c] -= TOOTH_AMP * (-dt / TOOTH_DECAY).exp() * (TAU * f * dt).sin();
            }
        }
        out
    }
}
/// The bass teeth on the left ring slower than the treble on the right.
pub fn tooth_frequency(col: usize) -> f32 {
    7.0 + 7.0 * col as f32 / (COLS - 1) as f32
}

/// The figurine's program at one moment: how high the right arm reaches and
/// how deep the bow is (0..1 each).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Pose {
    pub raise: f32,
    pub bow: f32,
}
/// Where in its gesture the figurine is, at the drum's angle.
pub fn gesture(angle: f32) -> f32 {
    ((angle - REST) / GESTURE + FROZEN_PHASE).rem_euclid(1.0)
}
/// The gesture: reach out and up, lower the arm, bow, straighten.
pub fn pose(g: f32) -> Pose {
    Pose {
        raise: smooth(0.02, 0.30, g) * (1.0 - smooth(0.36, 0.55, g)),
        bow: smooth(0.57, 0.71, g) * (1.0 - smooth(0.80, 0.97, g)),
    }
}
/// The barrel's angle at the drum's angle: phased so that a gap between
/// its teeth faces the pinion whenever a pinion tooth points at it.
pub fn barrel(angle: f32) -> f32 {
    let [y, z] = BARREL_AT;
    let towards = z.atan2(y);
    let back = towards - PI;
    back + (towards - REST) * BARREL_RATIO - 0.5 * TAU / 18.0 - BARREL_RATIO * (angle - REST)
}
/// The turntable's angle at the drum's angle.
pub fn table(angle: f32) -> f32 {
    YAW_REST + TABLE_RATIO * (angle - REST)
}
/// Tilted forward (towards −z, where the figurine faces) by `b` about x.
fn tilt(v: [f32; 3], b: f32) -> [f32; 3] {
    let (s, c) = b.sin_cos();
    [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c]
}
/// A limb pointing down (0) and swung forward-up by `a` about x.
fn swing(side: f32, a: f32) -> [f32; 3] {
    normalize([side, -a.cos(), -a.sin()])
}
/// The figurine's joints in the world: a jointed wooden mannequin 0.49
/// tall, standing on both feet, facing −z before the turntable turns it.
/// 0 pelvis, 1 chest, 2 neck, 3 head; 4–7 left shoulder, elbow, wrist,
/// hand; 8–11 the right; 12–15 left hip, knee, ankle, toe; 16–19 the right;
/// 20, 21 the thumbs; 22 the torso's up and 23 its front (directions);
/// 24, 25 the heels. Its right side is −x.
pub fn figure(angle: f32) -> [[f32; 3]; JOINTS] {
    let Pose { raise, bow } = pose(gesture(angle));
    let b = 0.5 * bow;
    let a = 2.1 * raise;
    let bend = 0.18 + 0.4 * raise;
    let hang = 0.18 + 0.12 * bow;
    let nod = 0.3 * bow - 0.35 * raise;
    let pelvis = [0.0, 0.262, 0.0];
    let at = |v: [f32; 3]| add(pelvis, tilt(v, b));
    let neck = at([0.0, 0.143, 0.0]);
    let head = add(neck, tilt([0.0, 0.047, 0.0], b + nod));
    let shoulder = [at([0.056, 0.133, 0.0]), at([-0.056, 0.133, 0.0])];
    // The left arm hangs; the right one makes the gesture.
    let arm = |s: [f32; 3], side: f32, up: f32, fore: f32| {
        let elbow = add(s, scale(swing(0.12 * side, up), 0.085));
        let wrist = add(elbow, scale(swing(0.06 * side, fore), 0.075));
        let hand = swing(0.03 * side, fore + 0.15);
        let tip = add(wrist, scale(hand, 0.035));
        let palm = [0.0, (fore + 0.15).sin(), -(fore + 0.15).cos()];
        let thumb = normalize(add(
            add(scale(hand, 0.55), [-0.45 * side, 0.0, 0.0]),
            scale(palm, 0.6),
        ));
        [s, elbow, wrist, tip, add(wrist, scale(thumb, 0.022))]
    };
    let left = arm(shoulder[0], 1.0, 0.0, hang);
    let right = arm(shoulder[1], -1.0, a, a + bend);
    let leg = |x: f32| {
        [
            [0.030 * x, 0.245, 0.0],
            [0.033 * x, 0.135, -0.004],
            [0.035 * x, 0.024, 0.0],
            [0.038 * x, 0.007, -0.042],
            [0.035 * x, 0.0095, 0.012],
        ]
    };
    let (l, r) = (leg(1.0), leg(-1.0));
    let local = [
        pelvis,
        at([0.0, 0.093, 0.0]),
        neck,
        head,
        left[0],
        left[1],
        left[2],
        left[3],
        right[0],
        right[1],
        right[2],
        right[3],
        l[0],
        l[1],
        l[2],
        l[3],
        r[0],
        r[1],
        r[2],
        r[3],
        left[4],
        right[4],
        tilt([0.0, 1.0, 0.0], b),
        tilt([0.0, 0.0, -1.0], b),
        l[4],
        r[4],
    ];
    let (s, c) = table(angle).sin_cos();
    let turn = |v: [f32; 3]| [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
    let mut out = [[0.0; 3]; JOINTS];
    for (i, v) in local.iter().enumerate() {
        out[i] = if i == 22 || i == 23 {
            turn(*v)
        } else {
            add(FIG, turn(*v))
        };
    }
    out
}

/// The lens: where it is, what it looks at, how long it is (the screen's
/// half height is 0.5 at `zoom` = 1 unit away), where it is sharp and how
/// quickly it blurs (authored px of blur circle per unit of defocus).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Camera {
    pub eye: [f32; 3],
    pub target: [f32; 3],
    pub zoom: f32,
    pub focus: f32,
    pub aperture: f32,
}
impl Camera {
    /// Forward, right, up: screen right is +x when looking along +z.
    pub fn basis(&self) -> [[f32; 3]; 3] {
        let fw = normalize(sub(self.target, self.eye));
        let rt = normalize(cross([0.0, 1.0, 0.0], fw));
        let up = cross(fw, rt);
        [fw, rt, up]
    }
    /// Distance along the view.
    pub fn depth(&self, p: [f32; 3]) -> f32 {
        dot(sub(p, self.eye), self.basis()[0])
    }
    /// A point on the authored 1536 × 1024 frame, as the shader sees it.
    pub fn project(&self, p: [f32; 3]) -> Option<[f32; 2]> {
        let [fw, rt, up] = self.basis();
        let v = sub(p, self.eye);
        let z = dot(v, fw);
        if z < 0.01 {
            return None;
        }
        let x = dot(v, rt) * self.zoom / z;
        let y = dot(v, up) * self.zoom / z;
        Some([SIZE[0] * 0.5 + x * SIZE[1], SIZE[1] * 0.5 - y * SIZE[1]])
    }
    /// The blur circle's radius (authored px) of a point at this depth.
    pub fn coc(&self, depth: f32) -> f32 {
        (self.aperture * (depth - self.focus) / depth.max(0.01))
            .abs()
            .min(22.0)
    }
}

/// One held shot: the lens and the point it keeps sharp.
#[derive(Clone, Copy, Debug)]
struct Shot {
    eye: [f32; 3],
    target: [f32; 3],
    zoom: f32,
    sharp: [f32; 3],
    aperture: f32,
    /// How high the lens's path arcs on its way into this shot.
    arc: f32,
    /// Whether the lens gets here round the box (about the vertical through
    /// its middle) rather than straight across it.
    orbit: bool,
    /// Between shots, the focus distance the lens has racked to (0 in a
    /// held shot: sharp on its point).
    rack: f32,
}
const fn shot(eye: [f32; 3], target: [f32; 3], zoom: f32, sharp: [f32; 3], aperture: f32) -> Shot {
    Shot {
        eye,
        target,
        zoom,
        sharp,
        aperture,
        arc: 0.0,
        orbit: false,
        rack: 0.0,
    }
}
impl Shot {
    /// Where the lens is sharp: on its point, or where it has racked to.
    fn focus(&self) -> f32 {
        if self.rack > 0.0 {
            return self.rack;
        }
        dot(
            sub(self.sharp, self.eye),
            normalize(sub(self.target, self.eye)),
        )
        .max(0.05)
    }
}
/// The blank head, close.
const FACE: Shot = shot(
    [0.61, 0.905, -0.36],
    [0.672, 0.888, 0.0],
    2.3,
    [0.673, 0.896, 0.0],
    12.0,
);
/// The figurine on its turntable, the glass and the box under it.
const FIGURE: Shot = shot(
    [0.30, 0.82, -1.25],
    [0.50, 0.66, 0.0],
    2.0,
    [0.675, 0.70, 0.0],
    9.0,
);
/// Under the glass: the shaft and the gears that turn the figurine.
const SHAFT: Shot = shot(
    [0.40, 0.33, -0.44],
    [0.60, 0.12, 0.04],
    1.8,
    [0.58, 0.17, 0.0],
    12.0,
);
/// The pinned drum.
const DRUM: Shot = shot(
    [0.05, 0.16, -0.62],
    [-0.15, 0.0, 0.1],
    1.7,
    [-0.1, 0.1, -0.12],
    10.0,
);
/// The key that winds itself, outside the left wall.
const KEY: Shot = shot(
    [-1.42, -0.05, -0.62],
    [-1.02, -0.20, 0.02],
    2.0,
    [-1.075, -0.20, 0.02],
    10.0,
);
/// The whole mechanism running by itself.
const ITSELF: Shot = shot(
    [-0.9, 0.55, -1.35],
    [0.05, 0.0, 0.1],
    1.75,
    [0.0, 0.1, -0.1],
    7.0,
);
/// The lamp switches on: a little closer.
const SEE: Shot = shot(
    [-0.78, 0.5, -1.22],
    [0.05, 0.0, 0.1],
    1.8,
    [0.0, 0.1, -0.1],
    7.0,
);
/// Close on the pins, as they come up the drum.
const PINS: Shot = shot(
    [-0.1, 0.20, -0.36],
    [0.02, 0.12, -0.10],
    2.2,
    [0.0, 0.135, -0.119],
    18.0,
);
/// From behind: the comb's tips and the drum's pins passing them. The
/// lens gets there over the drum's top, under the glass.
const COMB: Shot = Shot {
    arc: 0.13,
    ..shot(
        [0.22, 0.16, 0.60],
        [0.0, 0.0, 0.2],
        1.9,
        [0.08, 0.0, 0.21],
        14.0,
    )
};
/// The whole box from afar, behind and to the figurine's side: the lens
/// pulls back from the comb to here.
const WIDE_BACK: Shot = shot(
    [3.12, 1.55, 1.59],
    [0.0, -0.35, 0.0],
    1.25,
    [0.1, 0.0, 0.0],
    4.0,
);
/// …and goes slowly round the box to its front: watching it from every side.
const WIDE: Shot = Shot {
    orbit: true,
    ..shot(
        [1.5, 1.55, -3.16],
        [0.0, -0.35, 0.0],
        1.25,
        [0.1, 0.0, 0.0],
        4.0,
    )
};
/// Square onto the drum's front, where the words come up.
const READ: Shot = shot(
    [0.0, 0.38, -1.30],
    [0.0, 0.0, -0.1],
    1.5,
    [0.0, 0.065, -0.168],
    8.0,
);
/// The frozen figurine under the lamp.
const FROZEN: Shot = shot(
    [0.20, 0.98, -1.05],
    [0.62, 0.72, 0.0],
    1.9,
    [0.675, 0.78, 0.0],
    10.0,
);
/// Held shots: (arrive, leave, shot); the lens eases from one to the next,
/// and from the last back into the first across the seam.
const SHOTS: [(f32, f32, Shot); 13] = [
    (0.0, 3.0, FACE),
    (6.6, 9.2, FIGURE),
    (12.2, 13.2, SHAFT),
    (14.8, 15.6, DRUM),
    (17.2, 18.6, KEY),
    (20.6, 23.4, ITSELF),
    (25.2, 29.8, SEE),
    (32.2, 35.8, PINS),
    (37.8, 40.0, COMB),
    (42.6, 42.6, WIDE_BACK),
    (46.8, 46.8, WIDE),
    (48.8, 54.6, READ),
    (58.4, 65.0, FROZEN),
];

/// Where a keyframed value stands at `t`: held inside a key, eased between
/// keys, the last easing into the first across the loop's seam.
fn keyed<T: Copy, const N: usize>(
    keys: &[(f32, f32, T); N],
    t: f32,
    blend: impl Fn(T, T, f32) -> T,
) -> T {
    for i in 0..N {
        let (arrive, leave, value) = keys[i];
        if t >= arrive && t <= leave {
            return value;
        }
        let (next_arrive, _, next) = keys[(i + 1) % N];
        let next_arrive = if i + 1 == N {
            next_arrive + LOOP_SECONDS
        } else {
            next_arrive
        };
        if t > leave && t < next_arrive {
            return blend(value, next, ease((t - leave) / (next_arrive - leave)));
        }
    }
    keys[0].2
}

/// The lens's place between two shots: straight across, or round the box
/// the shorter way, lifted by the arc of the shot it goes to.
fn travel_eye(a: &Shot, b: &Shot, k: f32) -> [f32; 3] {
    let lift = [0.0, 4.0 * k * (1.0 - k) * b.arc, 0.0];
    if !b.orbit {
        return add(lerp3(a.eye, b.eye, k), lift);
    }
    let polar = |e: [f32; 3]| (e[0].atan2(e[2]), e[0].hypot(e[2]));
    let ((ta, ra), (tb, rb)) = (polar(a.eye), polar(b.eye));
    let turn = ta + wrap(tb - ta) * k;
    let r = lerp(ra, rb, k);
    let y = lerp(a.eye[1], b.eye[1], k);
    add([r * turn.sin(), y, r * turn.cos()], lift)
}

pub fn camera(t: f32) -> Camera {
    // Between shots the focus racks evenly in diopters, as a lens turns.
    let s = keyed(&SHOTS, t, |a, b, k| Shot {
        eye: travel_eye(&a, &b, k),
        target: lerp3(a.target, b.target, k),
        zoom: lerp(a.zoom, b.zoom, k),
        sharp: lerp3(a.sharp, b.sharp, k),
        aperture: lerp(a.aperture, b.aperture, k),
        arc: 0.0,
        orbit: false,
        rack: 1.0 / lerp(1.0 / a.focus(), 1.0 / b.focus(), k),
    });
    // A hand-held breath, periodic with the loop, smaller up close.
    let w = TAU * t / LOOP_SECONDS;
    let reach = (length(sub(s.sharp, s.eye)) / 1.4).min(1.0);
    let eye = [
        s.eye[0] + 0.012 * reach * (3.0 * w).sin(),
        s.eye[1] + 0.006 * reach * (5.0 * w + 1.0).sin(),
        s.eye[2] + 0.01 * reach * (2.0 * w + 2.0).sin(),
    ];
    Camera {
        eye,
        target: s.target,
        zoom: s.zoom,
        focus: s.focus(),
        aperture: s.aperture,
    }
}

/// The light: the dim room, and the lamp over the box (0..1 each).
pub fn light(t: f32) -> [f32; 2] {
    let out = 1.0 - smooth(64.0, 68.4, t);
    let murk = smooth(0.0, 1.8, t) * out;
    let on = smooth(SWITCH, SWITCH + 0.08, t)
        * (1.0 - 0.6 * bell(t, SWITCH + 0.14, SWITCH + 0.18, SWITCH + 0.24, SWITCH + 0.3))
        * out;
    [murk, on]
}

/// The captions, in the order of the page.
pub const CARDS: [[f32; 2]; 4] = [[1.0, 9.0], [9.6, 15.0], [15.6, 21.8], [22.4, 63.4]];
/// «И ЖИВЁТ СОБОЙ,» joins its caption.
pub const LIVES: f32 = 18.6;
/// The six verbs, one at a time under «ПОКА ТЫ НЕ НАЧНЁШЬ».
pub const VERBS: [[f32; 2]; 6] = [
    [25.0, 30.6],
    [30.8, 36.2],
    [36.4, 41.8],
    [42.0, 47.4],
    [47.6, 55.0],
    [55.2, 63.4],
];

/// One caption line: its row in the atlas, whether it is the bright one,
/// its light and how much of it is written (0..1 from the left).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Line {
    pub row: usize,
    pub key: bool,
    pub alpha: f32,
    pub wipe: f32,
}
pub const LEAD_CAP: f32 = 19.0;
pub const KEY_CAP: f32 = 28.0;
/// The bottom of the last line of every caption (authored px).
pub const WORDS_BOTTOM: f32 = 940.0;
/// The captions stand at the lower left.
pub const WORDS_LEFT: f32 = 112.0;
/// The lines of the caption at `t`, top to bottom.
pub fn words(t: f32) -> Vec<Line> {
    let Some(card) = CARDS.iter().position(|[a, b]| t >= *a && t < *b) else {
        return Vec::new();
    };
    let [a, b] = CARDS[card];
    let line = |row, key, from: f32, till: f32| Line {
        row,
        key,
        alpha: bell(t, from, from + 0.5, till - 0.6, till),
        wipe: smooth(from, from + 0.7, t),
    };
    let mut lines = match card {
        0 => vec![line(0, false, a, b), line(1, true, a + 0.6, b)],
        1 => vec![line(2, false, a, b), line(3, true, a + 0.6, b)],
        2 => vec![
            line(4, false, a, b),
            line(5, true, a + 0.6, b),
            line(6, true, LIVES, b),
        ],
        _ => {
            let mut v = vec![line(7, false, a, b)];
            for (k, [from, till]) in VERBS.iter().enumerate() {
                v.push(line(8 + k, true, *from, *till));
            }
            v
        }
    };
    lines.retain(|l| l.alpha > 0.0);
    lines
}
/// Where a caption line sits: left edge, cap top, cap height (authored px).
/// The bright line sits lowest; the quiet one above it.
pub fn line_place(row: usize) -> [f32; 3] {
    let key = matches!(row, 1 | 3 | 5 | 6 | 8..=13);
    let cap = if key { KEY_CAP } else { LEAD_CAP };
    let top = match row {
        4 => 835.0,
        5 => 870.0,
        0 | 2 | 7 => 877.0,
        _ => WORDS_BOTTOM - KEY_CAP,
    };
    [WORDS_LEFT, top, cap]
}
/// The atlas band of a row stands this far above the capitals' top
/// (atlas px; capitals start 42 px into a row).
pub fn band_above() -> f32 {
    42.0 - LABEL_BAND[0]
}

/// Everything the browser needs for one frame.
#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// The drum's angle, the key's, the turntable's and the barrel's.
    pub drum: [f32; 4],
    pub speed: f32,
    /// How far each tooth's tip is bent.
    pub teeth: [f32; 40],
    pub joints: [[f32; 3]; JOINTS],
    /// The dim room and the lamp.
    pub light: [f32; 2],
    /// How much of the words' corner is shown.
    pub shown: f32,
}
pub fn compose(t: f32, program: &Program) -> Frame {
    let t = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let angle = drum(t);
    let turned = angle - REST;
    Frame {
        time: t,
        camera: camera(t),
        drum: [angle, -KEY_RATIO * turned, table(angle), barrel(angle)],
        speed: speed(t),
        teeth: program.teeth(t),
        joints: figure(angle),
        light: light(t),
        shown: words(t).iter().fold(0.0_f32, |m, l| m.max(l.alpha)),
    }
}

/// Colors of one theme: every theme on the site is dark.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// The air, the table's darkness, the page.
    pub paper: [f32; 3],
    /// The lamp and the room's dim light.
    pub key: [f32; 3],
    /// The cool fill from behind, the steel's sheen.
    pub fill: [f32; 3],
    /// The bright and the quiet caption lines.
    pub word: [f32; 3],
    pub lead: [f32; 3],
}
const fn rgb(v: u32) -> [f32; 3] {
    [
        ((v >> 16) & 255) as f32 / 255.0,
        ((v >> 8) & 255) as f32 / 255.0,
        (v & 255) as f32 / 255.0,
    ]
}
/// The app theme by its `graphicsPalette` code: Искра 0, Тишина 2, Астрал 3,
/// Матрица 4. The retired light themes (1, 5, 6) and unknown codes get
/// Тишина.
pub fn look(code: u32) -> Look {
    let palette = match code {
        0 | 2 | 3 | 4 => Palette::from_code(code),
        _ => Palette::Neutral,
    };
    let (paper, accent, highlight) = match palette.colors() {
        Some(c) => (c.paper, c.accent, c.highlight),
        None => (rgb(0x0D1520), rgb(0x86C9C7), rgb(0xD6DAD2)),
    };
    Look {
        paper,
        key: lerp3(highlight, [1.0; 3], 0.1),
        fill: accent,
        word: lerp3(highlight, [1.0; 3], 0.15),
        lead: lerp3(highlight, paper, 0.25),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::generated::LABEL_INK;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }
    fn times(step: f32) -> impl Iterator<Item = f32> {
        (0..(LOOP_SECONDS / step) as usize).map(move |i| i as f32 * step)
    }
    fn inside(c: &Camera, p: [f32; 3], margin: f32) -> bool {
        c.project(p).is_some_and(|q| {
            q[0] > margin && q[0] < SIZE[0] - margin && q[1] > margin && q[1] < SIZE[1] - margin
        })
    }
    /// A pin's head: row, column, at the drum's angle.
    fn pin_at(row: usize, col: usize, angle: f32) -> [f32; 3] {
        let a = -(row as f32) * ROW_STEP + angle;
        let r = DRUM_R + 0.008;
        [(col as f32 - 18.0) * PITCH, r * a.cos(), r * a.sin()]
    }
    /// The captions' corner, where nothing that matters may stand.
    fn under_words(q: [f32; 2]) -> bool {
        q[0] < 760.0 && q[1] > 820.0
    }

    #[test]
    fn the_loop_has_no_seam() {
        let p = Program::new();
        let (a, b) = (compose(0.0, &p), compose(LOOP_SECONDS, &p));
        assert_eq!(a, b);
        let (x, y) = (compose(LOOP_SECONDS - 0.004, &p), compose(0.004, &p));
        for e in 0..3 {
            assert!(close(x.camera.eye[e], y.camera.eye[e], 0.003));
        }
        assert!(close(x.camera.focus, y.camera.focus, 0.02));
        for i in 0..JOINTS {
            for e in 0..3 {
                assert!(close(x.joints[i][e], y.joints[i][e], 1e-4), "joint {i}");
            }
        }
        for k in 0..4 {
            assert!(close(wrap(x.drum[k] - y.drum[k]), 0.0, 1e-3), "angle {k}");
        }
        // Dark and still at the seam: no light, no words, no ringing.
        for f in [&x, &y] {
            assert!(f.light[0] < 0.01 && f.light[1] < 0.01 && f.shown < 0.01);
            assert!(f.teeth.iter().all(|d| d.abs() < 1e-5));
        }
    }

    #[test]
    fn the_camera_never_jumps() {
        let mut previous = camera(0.0);
        for t in times(0.01).skip(1) {
            let c = camera(t);
            // the lens moves no faster than 2 m a second, or far off about
            // 1.2 of its distance from what it looks at (sweeping wide)
            let reach = 0.02_f32.max(0.006 + 0.012 * length(sub(c.target, c.eye)));
            for e in 0..3 {
                assert!(close(c.eye[e], previous.eye[e], reach), "eye at {t}");
                assert!(
                    close(c.target[e], previous.target[e], 0.03),
                    "target at {t}"
                );
            }
            assert!(close(c.zoom, previous.zoom, 0.01));
            // focus racks are smooth in diopters, as a lens turns
            assert!(
                close(1.0 / c.focus, 1.0 / previous.focus, 0.06),
                "focus at {t}"
            );
            // the iris opens or closes at most ten units a second
            assert!(close(c.aperture, previous.aperture, 0.1), "aperture at {t}");
            previous = c;
        }
    }

    #[test]
    fn values_stay_finite_and_bounded() {
        let p = Program::new();
        for t in times(0.01) {
            let f = compose(t, &p);
            assert!((0.0..=1.0).contains(&f.light[0]) && (0.0..=1.0).contains(&f.light[1]));
            assert!((-1e-6..=1.0 + 1e-6).contains(&f.speed));
            assert!(f.teeth.iter().all(|d| d.abs() <= 3.0 * TOOTH_AMP));
            assert!(f.drum.iter().all(|v| v.is_finite()));
            assert!(f.joints.iter().flatten().all(|v| v.is_finite()));
            assert!(f.camera.eye[1] > -0.4 && f.camera.focus > 0.0);
            for l in words(t) {
                assert!((0.0..=1.0).contains(&l.alpha) && (0.0..=1.0).contains(&l.wipe));
            }
        }
        assert_eq!(compose(f32::NAN, &p), compose(0.0, &p));
    }

    #[test]
    fn the_drum_turns_three_times_and_stops() {
        assert!(close(drum(LOOP_SECONDS) - drum(0.0), TURNS * TAU, 1e-3));
        let mut previous = drum(0.0);
        for t in times(0.01).skip(1) {
            let a = drum(t);
            assert!(a >= previous - 1e-5, "{t}");
            previous = a;
        }
        for t in [0.0, 0.29, STOPPED + 0.01, 63.0, LOOP_SECONDS] {
            assert!(speed(t).abs() < 1e-5, "{t}");
        }
        assert!(close(speed(20.0), 1.0, 1e-6) && close(speed(51.0), 0.6, 1e-6));
        // the key, the barrel and the turntable come round whole too
        let p = Program::new();
        let (a, b) = (compose(0.0, &p), compose(LOOP_SECONDS - 1e-4, &p));
        for k in 1..4 {
            assert!(close(wrap(a.drum[k] - b.drum[k]), 0.0, 1e-3), "{k}");
        }
    }

    #[test]
    fn every_pin_plucks_its_tooth_once_a_turn() {
        let p = Program::new();
        let pins: usize = p.rows.iter().map(|r| r.count_ones() as usize).sum();
        let plucks: usize = p.plucks.iter().map(Vec::len).sum();
        assert_eq!(plucks, pins * TURNS as usize);
        for list in &p.plucks {
            assert!(list.iter().all(|&t| t > 0.3 && t < STOPPED));
        }
        // the tune plays: every row away from the words has a pin
        let near = |r: usize| {
            p.word_tops
                .iter()
                .any(|&top| (r + ROWS - top + 1) % ROWS < 9)
        };
        assert!((0..ROWS).all(|r| near(r) || p.rows[r] != 0));
        assert!(p.rows.iter().all(|r| *r >> COLS == 0));
    }

    #[test]
    fn the_pins_read_nado_nelzya() {
        let p = Program::new();
        let [a, b] = p.word_tops;
        // seven rows each, at least one empty row between them
        let gap = (b + ROWS - a) % ROWS;
        assert!((8..=ROWS - 8).contains(&gap), "{a} {b}");
        for (w, (word, at)) in WORDS.iter().enumerate() {
            let top = p.word_tops[w];
            let centre = (top + 3) % ROWS;
            // the word's middle row faces the lens when it is read
            let facing = -(centre as f32) * ROW_STEP + drum(*at);
            assert!(close(wrap(facing - READ_AT), 0.0, 0.5 * ROW_STEP + 1e-3));
            // the rows just above and below the word are empty
            assert_eq!(p.rows[(top + ROWS - 1) % ROWS], 0, "{word}");
            assert_eq!(p.rows[(top + 7) % ROWS], 0, "{word}");
            // the word stands square in the lens, sharp, above the caption
            let c = camera(*at);
            let width = word.chars().count() * 6 - 1;
            let start = (COLS - width) / 2;
            let angle = drum(*at);
            for (row, col) in [
                (top, start),
                (top, start + width - 1),
                (top + 6, start),
                (top + 6, start + width - 1),
            ] {
                let q = c.project(pin_at(row, col, angle)).unwrap();
                assert!(inside(&c, pin_at(row, col, angle), 60.0), "{word} {q:?}");
                assert!(q[1] < 780.0, "{word} under the caption {q:?}");
            }
            assert!(c.coc(c.depth(pin_at(centre, 18, angle))) < 1.0, "{word}");
        }
        // «НАДО» starts with Н: its first column is pinned on every row
        let start = (COLS - 23) / 2;
        for y in 0..7 {
            assert!(p.pin(a + y, start), "Н row {y}");
        }
    }

    #[test]
    fn the_page_is_told_in_order() {
        let p = Program::new();
        // «Персонаж — это не кто-то»: the lens at the blank head, then the
        // whole figurine on the box.
        let head = figure(drum(1.5))[3];
        let c = camera(1.5);
        assert!(
            inside(&c, head, 200.0) && c.coc(c.depth(head)) < 1.0,
            "{:?} {} {head:?}",
            c.project(head),
            c.coc(c.depth(head))
        );
        let f = compose(8.0, &p);
        for j in [3, 11, 15, 19] {
            let q = f.camera.project(f.joints[j]).unwrap();
            assert!(
                inside(&f.camera, f.joints[j], 40.0) && !under_words(q),
                "{j}"
            );
        }
        // «…которая запускается»: the key turns by itself, in the shot.
        let (k0, k1) = (compose(17.2, &p), compose(18.6, &p));
        assert!((k1.drum[1] - k0.drum[1]).abs() > 0.5);
        assert!(inside(&k0.camera, [-1.075, -0.2, 0.02], 200.0));
        // Each verb is lit alone in its turn.
        for (k, [a, b]) in VERBS.iter().enumerate() {
            let lit: Vec<_> = words(0.5 * (a + b))
                .into_iter()
                .filter(|l| l.key && l.alpha > 0.5)
                .collect();
            assert_eq!(lit.len(), 1);
            assert_eq!(lit[0].row, 8 + k);
        }
        // видеть: dark until the word, then the lamp.
        for t in times(0.05) {
            let [murk, on] = light(t);
            if (2.0..SWITCH).contains(&t) {
                assert!(on < 1e-6 && murk > 0.99, "{t}");
            }
            if (SWITCH + 0.4..64.0).contains(&t) {
                assert!(on > 0.99, "{t}");
            }
        }
        assert!(VERBS[0][0] < SWITCH);
        // рассматривать: close on the pins, sharp on them.
        let c = camera(34.0);
        let sharp = [0.0, 0.135, -0.119];
        assert!(length(sub(sharp, c.eye)) < 0.4 && c.coc(c.depth(sharp)) < 0.5);
        // ощущать: sharp on the comb's tips while they ring.
        let c = camera(39.5);
        assert!(c.coc(c.depth([0.08, 0.0, 0.21])) < 0.5);
        let ring = (0..400)
            .map(|i| p.teeth(37.8 + i as f32 * 0.01))
            .fold(0.0_f32, |m, d| d.iter().fold(m, |m, v| m.max(v.abs())));
        assert!(ring > 0.5 * TOOTH_AMP);
        // наблюдать: the whole box from afar, nothing under the caption.
        let f = compose(45.0, &p);
        for x in [-0.98, 0.98] {
            for y in [-0.5, 0.42] {
                for z in [-0.56, 0.56] {
                    assert!(inside(&f.camera, [x, y, z], 20.0), "{x} {y} {z}");
                }
            }
        }
        let q = f.camera.project(f.joints[3]).unwrap();
        assert!(inside(&f.camera, f.joints[3], 40.0) && !under_words(q));
        // различать: the drum stops and the figurine freezes, in the lens.
        let still = figure(drum(STOPPED));
        for t in [STOPPED + 0.01, 60.0, 65.0, LOOP_SECONDS] {
            assert_eq!(figure(drum(t)), still);
        }
        let f = compose(STILL, &p);
        assert!(f.speed.abs() < 1e-6 && f.light[1] > 0.99);
        assert!(f.camera.coc(f.camera.depth(f.joints[3])) < 1.0);
        for j in [3, 7, 11, 15, 19] {
            let q = f.camera.project(f.joints[j]).unwrap();
            assert!(
                inside(&f.camera, f.joints[j], 40.0) && !under_words(q),
                "{j}"
            );
        }
        assert!(words(STILL).iter().any(|l| l.row == 13 && l.alpha > 0.99));
        let Pose { raise, bow } = pose(gesture(drum(STILL)));
        assert!(raise > 0.6 && bow < 1e-6);
    }

    #[test]
    fn the_figurine_stands_and_keeps_its_build() {
        let rest = figure(drum(0.0));
        let bones = [
            (0, 2),
            (2, 3),
            (4, 5),
            (5, 6),
            (6, 7),
            (8, 9),
            (9, 10),
            (10, 11),
            (12, 13),
            (13, 14),
            (16, 17),
            (17, 18),
        ];
        let size = |f: &[[f32; 3]; JOINTS], (a, b): (usize, usize)| length(sub(f[a], f[b]));
        for t in times(0.05) {
            let f = figure(drum(t));
            for bone in bones {
                assert!(close(size(&f, bone), size(&rest, bone), 1e-4), "{bone:?}");
            }
            // both feet stay on the turntable, both heels down
            for j in [14, 15, 18, 19, 24, 25] {
                assert!(close(f[j][1], rest[j][1], 1e-5));
                assert!(f[j][1] >= FIG[1]);
            }
            // nothing goes through the turntable or the glass
            assert!(f.iter().take(22).all(|p| p[1] > FIG[1]));
            // the gesture: a hand never goes behind the head
            assert!(f[11][1] < 1.1);
        }
        assert_eq!(rest.len(), JOINTS);
    }

    #[test]
    fn every_caption_fits() {
        for (row, [ink0, ink1]) in LABEL_INK.iter().enumerate() {
            let [x, top, cap] = line_place(row);
            let width = (ink1 - ink0) * cap / 44.0;
            assert!(
                x > SIZE[0] * 0.05 && x + width < SIZE[0] * 0.62,
                "row {row}"
            );
            assert!(top > SIZE[1] * 0.75 && top + cap <= WORDS_BOTTOM + 0.1);
            assert!(cap >= 15.0);
        }
        // lines of one caption never overlap
        for t in times(0.1) {
            let mut slots: Vec<[f32; 2]> = words(t)
                .iter()
                .filter(|l| l.alpha > 0.02)
                .map(|l| {
                    let [_, top, cap] = line_place(l.row);
                    [top, top + cap]
                })
                .collect();
            slots.sort_by(|a, b| a[0].total_cmp(&b[0]));
            for w in slots.windows(2) {
                assert!(w[0][1] + 8.0 < w[1][0], "{t}: {w:?}");
            }
        }
    }

    #[test]
    fn every_theme_has_a_look() {
        let luma = |c: [f32; 3]| 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        for code in 0..8 {
            let l = look(code);
            assert!(luma(l.word) > luma(l.paper) + 0.4, "{code}");
            assert!(luma(l.key) > luma(l.paper) + 0.3, "{code}");
            assert!(luma(l.paper) < 0.1, "{code}");
        }
        assert_eq!(look(1), look(2));
        assert_ne!(look(0), look(2));
    }
}
