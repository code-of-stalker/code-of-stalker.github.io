//! «Внимание внутрь», page 04 of Step 6 «Внутреннее кольцо», direction
//! «Радар». A person sits upright on a chair, a dark matte figure with a cold
//! rim. Level with the chest lies a radar scope round them: a disc of
//! phosphor glass, its cold rim (the outer ring) always on. «Не меняй позу»:
//! only the rim; «Не напрягай себя»: the range rings and spokes come up;
//! «направь луч»: a warm beam grows from the chest out to the rim;
//! «сканируй»: it starts to turn. Each of the five questions is one turn of
//! the beam, and behind it unlabelled marks of that question's kind light up
//! and fade: clusters of dots, soft swelling patches, faint ticks, dashes
//! that jump outward, dots that send out slow rings. «Не пытайся понять»,
//! «Не объясняй», «Не ищи причину»: three times the beam slows on a mark and
//! a bracket closes on it; a measure runs out to it, then lines to earlier
//! marks; each time it lets go and the beam turns on. «Свидетельствуй»:
//! marks come and go by themselves. «Ты не расследуешь —»: a bracket starts
//! round a fresh mark and dissolves before it closes. «ты сканируешь и
//! считываешь»: low, level with the scope; then the beam slows and fades to
//! the loop's start. Every value here is a pure function of loop time;
//! `browser.rs` only uploads it and one ray-traced pass draws it. Unit: the
//! person sits about 1.43 high; the floor is y = 0, the person faces +z.
use std::f32::consts::TAU;
use std::sync::OnceLock;
use watcher_scene_palette::Palette;

pub mod body;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerRadar;

pub const LOOP_SECONDS: f32 = 60.0;
/// The frame is 3:2; a canvas of another shape keeps the whole 3:2 frame in
/// view.
pub const FRAME_ASPECT: f32 = 1.5;
/// The box the person and the chair lie in; the shader marches only there.
pub const BOUNDS: [[f32; 3]; 2] = [[-0.3, -0.01, -0.21], [0.3, 1.46, 0.7]];
/// Where the soles stand (x, z) and the four chair legs.
pub const FEET: [[f32; 2]; 2] = [[0.126, 0.6], [-0.126, 0.6]];
pub const LEGS: [[f32; 2]; 4] = [
    [0.195, 0.27],
    [-0.195, 0.27],
    [0.195, -0.12],
    [-0.195, -0.12],
];

/// The scope: a disc of phosphor glass level with the chest, its centre in
/// the chest (x, z) and its radius. Marks are placed on it in disc
/// coordinates, (x, z) from the centre.
pub const SCOPE_Y: f32 = 0.93;
pub const SCOPE_R: f32 = 1.45;
pub const SCOPE_C: [f32; 2] = [0.0, -0.03];
/// One turn of the beam at full speed.
pub const PERIOD: f32 = 4.8;
/// Where the beam points before it turns: radians in the disc, from +x
/// toward +z (behind the person and to the right, square to the first
/// camera, so the beam is seen growing to its full length).
pub const AIM: f32 = -1.41;
/// «Не напрягай себя»: the range rings and spokes come up out of a faint
/// grid, and go back down at the loop's end.
pub const GRID: [f32; 4] = [3.0, 5.5, 54.0, 58.0];
pub const GRID_LOW: f32 = 0.25;
/// «направь луч»: the beam comes on and grows out to the rim at its first
/// angle; «сканируй»: it starts to turn; at the end it slows and fades.
pub const BEAM: [f32; 4] = [5.6, 6.4, 53.5, 56.5];
pub const REACH: [f32; 2] = [5.8, 8.6];
pub const TURN: [f32; 2] = [8.6, 11.0];
pub const STOP: [f32; 2] = [54.0, 57.0];
/// The five questions, one turn each from here.
pub const QUESTIONS: f32 = 11.0;
/// «Не пытайся понять», «Не объясняй», «Не ищи причину»: the beam slows on a
/// mark (a..b), holds it (b..c), lets go and speeds up again (c..d).
pub const LOCKS: [[f32; 4]; 3] = [
    [35.0, 35.7, 36.7, 37.2],
    [37.5, 38.1, 38.9, 39.4],
    [40.0, 40.6, 41.5, 42.0],
];
/// «Ты не расследуешь —»: a bracket starts round the mark the beam passes at
/// the first time, never closes, and is gone by the second.
pub const FALSE_LOCK: [f32; 2] = [47.4, 48.6];
/// All marks go out with the beam at the end.
pub const FADE: [f32; 2] = [54.0, 57.0];

/// The kinds of mark, one per question: a thought (a small cluster of
/// dots), an emotion (a soft patch that swells), a micro-feeling (a faint
/// tick), an impulse (a dash that jumps outward and leaves a ghost), an urge
/// (a dot that sends out slow rings). None is labelled.
pub const THOUGHT: usize = 0;
pub const EMOTION: usize = 1;
pub const FLICKER: usize = 2;
pub const IMPULSE: usize = 3;
pub const URGE: usize = 4;
/// How long each kind's light lasts (seconds to fall by e).
pub const DECAY: [f32; 5] = [1.3, 3.4, 0.7, 1.1, 3.0];
/// How big each kind is on the disc: a dot's radius, a patch's, a tick's or
/// a dash's half length, the reach of an urge's rings.
pub const SIZE: [f32; 5] = [0.015, 0.12, 0.014, 0.05, 0.12];
/// What the beam locks on in each of `LOCKS`: the kind and how far out.
pub const HELD: [(usize, f32); 3] = [(EMOTION, 0.95), (IMPULSE, 1.0), (THOUGHT, 0.85)];
/// How many marks the shader takes at once, and the lines to earlier marks
/// of «Не ищи причину».
pub const BLIPS: usize = 32;
pub const LINKS: usize = 4;

/// One meaningful still frame for reduced motion: the beam turning, marks
/// lit and fading behind it, seen from the front and above.
pub const STILL: f32 = 45.0;

/// The camera, keyed through the loop: round the person (degrees from +z
/// toward +x), over the floor (degrees), how far, the point it looks at, and
/// the height of the frame (degrees). From the right side as the beam grows,
/// up over the scope for the questions (in closer for the micro-feelings),
/// down to the front for the locks, round the front for the witnessing, low
/// and level with the scope at the end, back to the start.
pub const CAMERA: [(f32, [f32; 7]); 14] = [
    (0.0, [80.0, 24.0, 3.9, 0.0, 0.78, 0.05, 40.0]),
    (5.5, [72.0, 32.0, 4.1, 0.0, 0.8, 0.03, 40.0]),
    (9.0, [50.0, 58.0, 5.2, 0.0, 0.85, 0.0, 40.0]),
    (11.0, [30.0, 80.0, 5.6, 0.0, 0.9, -0.03, 40.0]),
    (20.6, [15.0, 82.0, 5.6, 0.0, 0.9, -0.03, 40.0]),
    (23.0, [8.0, 74.0, 5.4, 0.0, 0.9, 0.0, 40.0]),
    (27.0, [-2.0, 80.0, 5.6, 0.0, 0.9, -0.03, 40.0]),
    (31.0, [-12.0, 70.0, 5.4, 0.0, 0.9, -0.03, 40.0]),
    (35.5, [-30.0, 34.0, 4.4, 0.0, 0.85, 0.0, 40.0]),
    (42.5, [-10.0, 36.0, 4.3, 0.0, 0.85, 0.0, 40.0]),
    (46.0, [20.0, 28.0, 3.9, 0.0, 0.85, 0.0, 40.0]),
    (50.0, [70.0, 7.0, 3.8, 0.0, 0.9, 0.0, 40.0]),
    (53.0, [78.0, 6.0, 3.8, 0.0, 0.9, 0.0, 40.0]),
    (57.0, [82.0, 16.0, 3.8, 0.0, 0.82, 0.03, 40.0]),
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    /// Loop time, for the shader's own small motions.
    pub time: f32,
    /// The camera: its place and axes, and the tangent of half the frame's
    /// height.
    pub eye: [f32; 3],
    pub right: [f32; 3],
    pub up: [f32; 3],
    pub forward: [f32; 3],
    pub lens: f32,
    /// The beam: its angle on the disc, its light, how far out it reaches,
    /// how long its afterglow is (radians behind it).
    pub beam: f32,
    pub beam_light: f32,
    pub reach: f32,
    pub trail: f32,
    /// The range rings and spokes (the rim is always on), and how far the
    /// rim's ticks have turned.
    pub grid: f32,
    pub rim_turn: f32,
    /// The lit marks, brightest first: (x, z) on the disc, size, light; and
    /// (kind, age, seed, 0).
    pub blips: [[f32; 4]; BLIPS],
    pub kinds: [[f32; 4]; BLIPS],
    /// The bracket: (x, z) of its mark, its half width, its light.
    pub lock: [f32; 4],
    /// «Не объясняй»: (x, z) of the mark the measure runs out to, how far it
    /// has run (0..1), its light.
    pub measure: [f32; 4],
    /// «Не ищи причину»: (x, z) of each earlier mark the lines run to from
    /// the held one (at `links_from`), how far each has run, their light.
    pub links: [[f32; 4]; LINKS],
    pub links_from: [f32; 2],
}

/// One mark on the disc: when the beam passes it (or for a held mark, when
/// it starts to show), where it lies, what kind, how big, its own seed, and
/// which of `LOCKS` holds it.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Blip {
    pub at: f32,
    pub angle: f32,
    pub radius: f32,
    pub kind: usize,
    pub size: f32,
    pub seed: f32,
    pub held: Option<usize>,
}

impl Blip {
    /// Its place on the disc, (x, z) from the centre.
    pub fn place(&self) -> [f32; 2] {
        let (s, c) = self.angle.sin_cos();
        [self.radius * c, self.radius * s]
    }
    /// Its place in the world.
    pub fn world(&self) -> [f32; 3] {
        let [x, z] = self.place();
        [SCOPE_C[0] + x, SCOPE_Y, SCOPE_C[1] + z]
    }
    /// Its light at `t`: up as the beam passes, then fading by its kind; a
    /// held mark shows ahead of the beam, stays while it is held and fades
    /// once it is let go. Everything goes out at the end.
    pub fn light(&self, t: f32) -> f32 {
        let end = 1.0 - smooth(FADE[0], FADE[1], t);
        let age = t - self.at;
        if age < 0.0 {
            return 0.0;
        }
        let lit = match self.held {
            Some(i) => {
                let [_, _, c, _] = LOCKS[i];
                smooth(0.0, 0.3, age) * if t < c { 1.0 } else { fade(t - c, 1.2) }
            }
            None => smooth(0.0, 0.08, age) * fade(age, DECAY[self.kind]),
        };
        lit * end
    }
}

/// A light falling by e every `decay` seconds that reaches 0 (at about 3.5
/// times `decay`), so a mark is gone, not just dim.
fn fade(age: f32, decay: f32) -> f32 {
    (((-age / decay).exp() - 0.03) / 0.97).max(0.0)
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
fn window(t: f32, [a, b, c, d]: [f32; 4]) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

/// The integral of `smooth(a, b, s)` over s up to `t`: how far a speed that
/// eases on from `a` to `b` has carried by `t`.
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

/// Camera channel `c` (see `CAMERA`) at `t`.
pub fn camera(c: usize, t: f32) -> f32 {
    spline_by(CAMERA.len(), |i| (CAMERA[i].0, CAMERA[i].1[c]), t)
}

/// How fast the beam turns at `t`, 1 at full speed: it starts for
/// «сканируй», slows to a stop on each held mark and speeds up again, and
/// stops at the end.
pub fn speed(t: f32) -> f32 {
    let held: f32 = LOCKS
        .iter()
        .map(|&[a, b, c, d]| smooth(a, b, t) - smooth(c, d, t))
        .sum();
    smooth(TURN[0], TURN[1], t) - smooth(STOP[0], STOP[1], t) - held
}

/// How far the beam has turned by `t` (radians): the integral of `speed`.
pub fn phase(t: f32) -> f32 {
    let held: f32 = LOCKS
        .iter()
        .map(|&[a, b, c, d]| ramp(a, b, t) - ramp(c, d, t))
        .sum();
    TAU / PERIOD * (ramp(TURN[0], TURN[1], t) - ramp(STOP[0], STOP[1], t) - held)
}

/// The beam's angle on the disc at `t`.
pub fn beam(t: f32) -> f32 {
    AIM + phase(t)
}

fn noise(i: u32) -> f32 {
    let mut x = i.wrapping_mul(0x9e37_79b9) ^ 0x632b_e5ab;
    x ^= x >> 16;
    x = x.wrapping_mul(0x7feb_352d);
    x ^= x >> 15;
    x = x.wrapping_mul(0x846c_a68b);
    x ^= x >> 16;
    (x >> 8) as f32 / 16_777_215.0
}

struct Marks {
    list: Vec<Blip>,
    n: u32,
}

impl Marks {
    fn next(&mut self) -> f32 {
        self.n += 1;
        noise(self.n)
    }
    /// A mark of `kind` the beam passes at `at`, `radius` out; a thought is a
    /// cluster of three dots close behind one another.
    fn add(&mut self, at: f32, radius: f32, kind: usize) {
        let held = None;
        self.place(at, beam(at), radius, kind, held);
    }
    fn place(&mut self, at: f32, angle: f32, radius: f32, kind: usize, held: Option<usize>) {
        let grow = 0.85 + 0.3 * self.next();
        let dots: &[(f32, f32, f32)] = if kind == THOUGHT {
            &[(0.0, 0.0, 0.0), (0.04, 0.055, 0.035), (0.08, -0.04, -0.03)]
        } else {
            &[(0.0, 0.0, 0.0)]
        };
        for &(later, out, turn) in dots {
            let seed = self.next();
            let jitter = 0.015 * (self.next() - 0.5);
            // A cluster's dots follow the beam (held: they sit round the mark).
            let (at, angle) = match held {
                None => (at + later, beam(at + later)),
                Some(_) => (at + 0.5 * later, angle + turn),
            };
            self.list.push(Blip {
                at,
                angle,
                radius: radius + out + jitter,
                kind,
                size: SIZE[kind] * grow,
                seed,
                held,
            });
        }
    }
}

/// Every mark in the loop, in the order they light: one turn of marks per
/// question, each kind its own; the three the beam holds; the marks of
/// «Свидетельствуй» and after, of all kinds, coming and going by themselves.
pub fn schedule() -> &'static [Blip] {
    static LIST: OnceLock<Vec<Blip>> = OnceLock::new();
    LIST.get_or_init(|| {
        let mut m = Marks {
            list: Vec::new(),
            n: 7,
        };
        let turns: [(usize, &[f32], f32, f32); 5] = [
            (THOUGHT, &[0.1, 0.36, 0.6, 0.83], 0.55, 0.65),
            (EMOTION, &[0.14, 0.48, 0.79], 0.65, 0.45),
            (FLICKER, &[], 0.45, 0.8),
            (IMPULSE, &[0.1, 0.36, 0.62, 0.86], 0.55, 0.5),
            (URGE, &[0.18, 0.5, 0.8], 0.65, 0.4),
        ];
        for (q, &(kind, at, near, spread)) in turns.iter().enumerate() {
            let start = QUESTIONS + PERIOD * q as f32;
            // The micro-feelings are many and faint: fourteen round the turn.
            let flickers: Vec<f32> = (0..14)
                .map(|k| (k as f32 + 0.2 + 0.6 * noise(100 + k)) / 14.0)
                .collect();
            let at = if kind == FLICKER { &flickers[..] } else { at };
            for &f in at {
                let r = near + spread * m.next();
                m.add(start + PERIOD * f, r, kind);
            }
        }
        for (i, &(kind, r)) in HELD.iter().enumerate() {
            let [a, b, _, _] = LOCKS[i];
            m.place(a + 0.2, beam(b), r, kind, Some(i));
        }
        // «Свидетельствуй»: twelve marks of all kinds.
        for (k, &kind) in [0, 1, 2, 3, 4, 2, 0, 3, 1, 2, 4, 2].iter().enumerate() {
            let at = 42.6 + 0.36 * k as f32 + 0.15 * m.next();
            let r = 0.5 + 0.7 * m.next();
            m.add(at, r, kind);
        }
        // «Ты не расследуешь —»: the mark the bracket starts round.
        m.add(FALSE_LOCK[0], 1.0, THOUGHT);
        // «ты сканируешь и считываешь»: the scope goes on reading.
        for (k, &kind) in [2, 1, 0, 3, 2, 4, 0, 2].iter().enumerate() {
            let at = 48.2 + 0.65 * k as f32 + 0.2 * m.next();
            let r = 0.5 + 0.7 * m.next();
            m.add(at, r, kind);
        }
        m.list
    })
}

/// The first mark held by lock `i` (a cluster's first dot).
pub fn held(i: usize) -> &'static Blip {
    schedule()
        .iter()
        .find(|b| b.held == Some(i))
        .expect("every lock holds a mark")
}

/// The mark the false bracket starts round.
pub fn false_mark() -> &'static Blip {
    schedule()
        .iter()
        .find(|b| b.held.is_none() && b.at == FALSE_LOCK[0])
        .expect("the false lock has its mark")
}

fn gap(a: f32, b: f32) -> f32 {
    let d = (a - b).rem_euclid(TAU);
    d.min(TAU - d)
}

/// «Не ищи причину»: the earlier marks the lines run to from the held
/// thought, long gone out: one of each of four kinds, the nearest round the
/// disc that is not too close.
pub fn linked() -> [&'static Blip; LINKS] {
    static LIST: OnceLock<[usize; LINKS]> = OnceLock::new();
    let list = schedule();
    let found = LIST.get_or_init(|| {
        let from = held(2);
        [EMOTION, IMPULSE, FLICKER, THOUGHT].map(|kind| {
            list.iter()
                .enumerate()
                .filter(|(_, b)| b.kind == kind && b.held.is_none() && b.at < LOCKS[0][0])
                .filter(|(_, b)| b.light(LOCKS[2][0]) == 0.0)
                .filter(|(_, b)| gap(b.angle, from.angle) > 0.45)
                .min_by(|(_, a), (_, b)| {
                    gap(a.angle, from.angle).total_cmp(&gap(b.angle, from.angle))
                })
                .map(|(i, _)| i)
                .expect("an earlier mark of each kind")
        })
    });
    found.map(|i| &list[i])
}

/// The three locks' bracket, measure and lines at `t`.
fn locks(t: f32) -> ([f32; 4], [f32; 4], [[f32; 4]; LINKS], [f32; LINKS]) {
    let base = 0.07;
    let mut lock = [0.0; 4];
    for (i, &[a, b, c, _]) in LOCKS.iter().enumerate() {
        let alpha = window(t, [a + 0.2, a + 0.5, c, c + 0.4]);
        if alpha > 0.0 {
            let close = smooth(a + 0.25, b + 0.1, t);
            let open = smooth(c, c + 0.4, t);
            let half = base * (3.0 + (1.2 - 3.0) * close + 0.8 * open);
            let [x, z] = held(i).place();
            lock = [x, z, half, alpha];
        }
    }
    // «Ты не расследуешь —»: half as bright, it shrinks only so far.
    let [f0, f1] = FALSE_LOCK;
    let alpha = 0.5 * window(t, [f0 + 0.05, f0 + 0.3, f0 + 0.7, f1]);
    if alpha > 0.0 {
        let [x, z] = false_mark().place();
        lock = [
            x,
            z,
            base * (3.0 - 0.8 * smooth(f0 + 0.05, f1 - 0.2, t)),
            alpha,
        ];
    }
    let [_, b, c, _] = LOCKS[1];
    let [x, z] = held(1).place();
    let measure = [
        x,
        z,
        smooth(b - 0.1, b + 0.5, t),
        smooth(b - 0.15, b, t) * (1.0 - smooth(c, c + 0.4, t)),
    ];
    let [_, b, c, _] = LOCKS[2];
    let alpha = smooth(b - 0.15, b, t) * (1.0 - smooth(c, c + 0.35, t));
    let mut relight = [0.0; LINKS];
    let links = std::array::from_fn(|k| {
        let late = 0.08 * k as f32;
        let run = smooth(b - 0.1 + late, b + 0.7 + late, t);
        relight[k] = 0.35 * smooth(0.85, 1.0, run) * alpha;
        let [x, z] = linked()[k].place();
        [x, z, run, alpha]
    });
    (lock, measure, links, relight)
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let [azimuth, elevation, distance, tx, ty, tz, height] =
        std::array::from_fn(|c| camera(c, time));
    // While the beam holds a mark the camera leans in toward it.
    let mut target = [tx, ty, tz];
    let mut closer = 0.0;
    for (i, &[a, b, c, d]) in LOCKS.iter().enumerate() {
        let lean = window(time, [a + 0.1, b + 0.3, c, d + 0.4]);
        let p = held(i).world();
        for (k, v) in target.iter_mut().enumerate() {
            *v += 0.2 * lean * (p[k] - *v);
        }
        closer += lean;
    }
    let distance = distance * (1.0 - 0.08 * closer);
    let (sa, ca) = azimuth.to_radians().sin_cos();
    let (se, ce) = elevation.to_radians().sin_cos();
    let out = [sa * ce, se, ca * ce];
    let eye = std::array::from_fn(|k| target[k] + distance * out[k]);
    let forward = out.map(|v| -v);
    // Level with the floor however high the camera climbs.
    let right = [ca, 0.0, -sa];
    let up = cross(right, forward);

    let (lock, measure, links, relight) = locks(time);
    let marks = linked();
    let mut lit: Vec<(f32, &Blip)> = schedule()
        .iter()
        .map(|b| {
            let again = (0..LINKS)
                .filter(|&k| std::ptr::eq(marks[k], b))
                .map(|k| relight[k])
                .fold(0.0, f32::max);
            (
                b.light(time)
                    .max(again * (1.0 - smooth(FADE[0], FADE[1], time))),
                b,
            )
        })
        .filter(|(l, _)| *l > 0.002)
        .collect();
    lit.sort_by(|a, b| b.0.total_cmp(&a.0));
    let mut blips = [[0.0; 4]; BLIPS];
    let mut kinds = [[0.0; 4]; BLIPS];
    for (i, (light, b)) in lit.iter().take(BLIPS).enumerate() {
        let [x, z] = b.place();
        blips[i] = [x, z, b.size, *light];
        kinds[i] = [b.kind as f32, (time - b.at).max(0.0), b.seed, 0.0];
    }

    let beam_light = window(time, BEAM);
    Frame {
        time,
        eye,
        right,
        up,
        forward,
        lens: (height.to_radians() * 0.5).tan(),
        beam: beam(time),
        beam_light,
        reach: SCOPE_R * smooth(REACH[0], REACH[1], time),
        trail: 0.65 * speed(time).clamp(0.0, 1.0),
        grid: GRID_LOW + (1.0 - GRID_LOW) * window(time, GRID),
        rim_turn: TAU / 8.0 * time / LOOP_SECONDS,
        blips,
        kinds,
        lock,
        measure,
        links,
        links_from: held(2).place(),
    }
}

/// Where a world point lands in the 3:2 frame, -1..1 both ways; None behind
/// the camera.
pub fn project(f: &Frame, point: [f32; 3]) -> Option<[f32; 2]> {
    let v = [0, 1, 2].map(|i| point[i] - f.eye[i]);
    let z = dot(v, f.forward);
    (z > 0.0).then(|| {
        [
            dot(v, f.right) / (z * f.lens * FRAME_ASPECT),
            dot(v, f.up) / (z * f.lens),
        ]
    })
}

/// The scene's three lights in a theme's colors: the cold rim of the scope
/// and of the figure, the warm beam and marks, and the pale of the grid and
/// the measures. The page itself comes from the app (`backdrop`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub cold: [f32; 3],
    pub warm: [f32; 3],
    pub pale: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

/// The app theme by its `graphicsPalette` code (0 Искра, 2 Тишина, 3 Астрал,
/// 4 Матрица). The cold light is the theme's accent; the warm one is a
/// second tone that stays apart from it. The site shows only the dark
/// themes; the retired light codes fall back to Тишина.
pub fn look(code: u32) -> Look {
    match Palette::from_code(code) {
        // Искра: the yellow of the theme, an ember beam.
        Palette::Dark => Look {
            cold: rgb(245, 221, 7),
            warm: rgb(255, 122, 40),
            pale: rgb(255, 244, 170),
        },
        // Астрал: the blue of the theme, a rose-peach beam.
        Palette::Violet => Look {
            cold: rgb(98, 150, 245),
            warm: rgb(240, 158, 128),
            pale: rgb(200, 212, 248),
        },
        // Матрица: code green, an amber beam.
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
    use crate::body::{chair, figure, solid};

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

    fn distance(a: [f32; 3], b: [f32; 3]) -> f32 {
        (0..3).map(|i| (a[i] - b[i]).powi(2)).sum::<f32>().sqrt()
    }

    const HEAD: [f32; 3] = [0.0, 1.31, -0.02];
    const CROWN: [f32; 3] = [0.0, 1.43, -0.02];

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
        assert!(close(before.lens, after.lens, 1e-4));
        assert!(close(before.grid, after.grid, 1e-4));
        // The rim's ticks repeat every eighth of a turn.
        let turn = (after.rim_turn - before.rim_turn).rem_euclid(TAU / 8.0);
        assert!(turn < 1e-3 || TAU / 8.0 - turn < 1e-3, "{turn}");
        // Across the seam only the rim and the faint grid show: no beam, no
        // marks, no bracket.
        for f in [before, after] {
            assert!(f.beam_light == 0.0 && f.grid == GRID_LOW, "{f:?}");
            assert!(f.blips.iter().all(|b| b[3] == 0.0));
            assert!(f.lock[3] == 0.0 && f.measure[3] == 0.0);
            assert!(f.links.iter().all(|l| l[3] == 0.0));
        }
    }

    #[test]
    fn the_beam_grows_still_then_turns_once_for_each_question() {
        // It holds its first angle while it comes on and grows to the rim.
        every(0.01, |t| {
            if t < TURN[0] {
                assert!(phase(t) == 0.0, "{t}");
            }
            if t < BEAM[0] {
                assert!(compose(t).beam_light == 0.0);
            }
        });
        assert!(close(compose(REACH[1]).reach, SCOPE_R, 1e-5));
        assert!(compose(REACH[0]).reach == 0.0);
        // One full turn for each question, at full speed.
        for q in 0..=5 {
            let t = QUESTIONS + PERIOD * q as f32;
            let turned = phase(t) - phase(QUESTIONS);
            assert!(close(turned, TAU * q as f32, 1e-3), "{q}: {turned}");
            assert!(close(speed(t - 0.01), 1.0, 1e-6) || q == 5 || q == 0);
        }
        // It never turns back; it stands still while it holds a mark and
        // after it has stopped at the end.
        let mut last = phase(0.0);
        every(0.01, |t| {
            let now = phase(t);
            assert!(now >= last - 1e-4, "{t}");
            assert!((-1e-6..=1.0 + 1e-6).contains(&speed(t)), "{t}");
            last = now;
        });
        for [_, b, c, _] in LOCKS {
            assert!(close(phase(b), phase(c), 1e-4));
            assert!(close(speed(0.5 * (b + c)), 0.0, 1e-6));
        }
        assert!(close(phase(STOP[1]), phase(LOOP_SECONDS - 0.01), 1e-4));
        // The integral matches the speed.
        every(0.05, |t| {
            let numeric = (phase(t + 1e-2) - phase(t - 1e-2)) / 2e-2;
            assert!(close(numeric, TAU / PERIOD * speed(t), 0.02), "{t}");
        });
    }

    #[test]
    fn each_question_turn_brings_its_own_kind_of_mark() {
        for b in schedule().iter().filter(|b| b.held.is_none()) {
            let q = ((b.at - QUESTIONS) / PERIOD).floor();
            if (0.0..5.0).contains(&q) {
                assert_eq!(b.kind, q as usize, "{b:?}");
            }
            // It lights right where the beam is as it passes.
            assert!(close(gap(b.angle, beam(b.at)), 0.0, 1e-4), "{b:?}");
        }
        for kind in [THOUGHT, EMOTION, FLICKER, IMPULSE, URGE] {
            let n = schedule()
                .iter()
                .filter(|b| b.kind == kind && b.at < LOCKS[0][0])
                .count();
            assert!(n >= 3, "{kind}: {n}");
        }
    }

    #[test]
    fn the_marks_lie_on_the_disc_off_the_body_and_all_fit_the_shader() {
        for b in schedule() {
            assert!(b.radius > 0.4 && b.radius < SCOPE_R - 0.15, "{b:?}");
            assert!(solid(b.world()) > 0.1, "{b:?}");
        }
        every(0.02, |t| {
            let shown = schedule().iter().filter(|b| b.light(t) > 0.002).count();
            assert!(shown <= BLIPS - LINKS, "{t}: {shown}");
            for b in compose(t).blips {
                assert!((0.0..=1.0).contains(&b[3]));
            }
        });
    }

    #[test]
    fn the_beam_holds_each_mark_and_lets_it_go() {
        for (i, &[_, b, c, d]) in LOCKS.iter().enumerate() {
            let m = held(i);
            // It stops right on the mark.
            assert!(close(gap(beam(b), m.angle), 0.0, 1e-4), "{i}");
            // The mark is lit ahead of the beam and stays while held.
            assert!(close(m.light(b), 1.0, 1e-4) && close(m.light(c), 1.0, 1e-4));
            assert!(m.light(d + 3.0) < 0.1);
            // The bracket closes on it, then opens and goes.
            let f = compose(0.5 * (b + c));
            let [x, z] = m.place();
            assert!(close(f.lock[0], x, 1e-5) && close(f.lock[1], z, 1e-5));
            assert!(
                f.lock[3] == 1.0 && close(f.lock[2], 0.07 * 1.2, 1e-4),
                "{f:?}"
            );
            assert!(compose(c + 0.45).lock[3] == 0.0);
        }
        // «Не объясняй»: the measure runs out to the mark and goes.
        let [_, b, c, _] = LOCKS[1];
        assert!(compose(b + 0.6).measure[2] == 1.0 && compose(b + 0.6).measure[3] == 1.0);
        assert!(compose(c + 0.5).measure[3] == 0.0 && compose(LOCKS[0][2]).measure[3] == 0.0);
        // «Не ищи причину»: lines to four earlier marks long gone out, one of
        // each of four kinds; they light again faintly as the lines reach
        // them.
        let [_, b, c, _] = LOCKS[2];
        let f = compose(c - 0.05);
        let marks = linked();
        for (k, (line, mark)) in f.links.iter().zip(marks.iter()).enumerate() {
            assert!(line[2] > 0.9 && line[3] == 1.0, "{k}");
            assert!(mark.light(b) < 0.01, "{k}");
            let shown = f.blips.iter().find(|p| {
                let [x, z] = mark.place();
                close(p[0], x, 1e-5) && close(p[1], z, 1e-5)
            });
            assert!(shown.is_some_and(|p| p[3] > 0.2), "{k}");
        }
        assert!(compose(c + 0.4).links.iter().all(|l| l[3] == 0.0));
        // «Ты не расследуешь —»: never closes, never full, and gone.
        every(0.01, |t| {
            if (FALSE_LOCK[0]..FALSE_LOCK[1]).contains(&t) {
                let f = compose(t);
                assert!(f.lock[3] <= 0.5, "{t}");
                assert!(f.lock[3] == 0.0 || f.lock[2] >= 0.07 * 2.2 - 1e-4, "{t}");
            }
        });
        assert!(compose(FALSE_LOCK[1]).lock[3] == 0.0);
    }

    /// Nothing solid lies between the eye and `p`.
    fn seen(f: &Frame, p: [f32; 3]) -> bool {
        (1..400).all(|i| {
            let s = i as f32 / 400.0;
            let q = std::array::from_fn(|k| f.eye[k] + (p[k] - f.eye[k]) * s);
            solid(q) > 0.0
        })
    }

    #[test]
    fn the_camera_keeps_the_person_and_the_held_marks_in_frame() {
        every(0.02, |t| {
            let f = compose(t);
            assert!(f.eye[1] > 0.5, "{t}: {:?}", f.eye);
            assert!(figure(f.eye) > 1.0 && chair(f.eye) > 1.0, "{t}");
            // The head is always in the frame, clear of its soft edges.
            for p in [CROWN, HEAD] {
                let s = project(&f, p).unwrap();
                assert!(s[0].abs() < 0.8 && s[1].abs() < 0.8, "{t}: {s:?}");
            }
        });
        // While the beam holds a mark, the mark is in the frame and the
        // person does not hide it.
        for (i, &[_, b, c, _]) in LOCKS.iter().enumerate() {
            for t in [b, 0.5 * (b + c), c] {
                let f = compose(t);
                let p = held(i).world();
                let s = project(&f, p).unwrap();
                assert!(s[0].abs() < 0.8 && s[1].abs() < 0.8, "{i} {t}: {s:?}");
                assert!(seen(&f, p), "{i} {t}");
            }
        }
        // So is the false bracket's mark, and the lines' marks.
        let f = compose(FALSE_LOCK[0] + 0.5);
        assert!(seen(&f, false_mark().world()));
        let f = compose(LOCKS[2][2] - 0.05);
        for m in linked() {
            let s = project(&f, m.world()).unwrap();
            assert!(s[0].abs() < 0.9 && s[1].abs() < 0.9, "{s:?}");
        }
    }

    /// How far out the scope's rim reaches in the frame: the largest |x| and
    /// |y| of points round it, -1..1 edge to edge.
    fn rim_reach(f: &Frame) -> [f32; 2] {
        (0..96).fold([0.0f32; 2], |m, k| {
            let a = TAU * k as f32 / 96.0;
            let p = [
                SCOPE_C[0] + SCOPE_R * a.cos(),
                SCOPE_Y,
                SCOPE_C[1] + SCOPE_R * a.sin(),
            ];
            let s = project(f, p).map_or([9.0; 2], |s| s.map(f32::abs));
            [m[0].max(s[0]), m[1].max(s[1])]
        })
    }

    #[test]
    fn the_whole_rim_stays_in_the_frame() {
        // The outer ring is never cut by the frame or lost in its soft edges.
        every(0.02, |t| {
            let [x, y] = rim_reach(&compose(t));
            assert!(x < 0.86 && y < 0.8, "{t}: {x} {y}");
        });
    }

    #[test]
    fn the_motion_is_smooth() {
        let step = 1.0 / 60.0;
        every(step, |t| {
            let (a, b) = (compose(t), compose(t + step));
            assert!(distance(a.eye, b.eye) < 0.03, "{t}");
            assert!(distance(a.forward, b.forward) < 0.02, "{t}");
            assert!((a.beam_light - b.beam_light).abs() < 0.05, "{t}");
            if a.beam_light > 0.0 && t + step < LOOP_SECONDS {
                assert!(gap(a.beam, b.beam) < TAU / PERIOD * step + 1e-4, "{t}");
            }
            assert!((a.lock[3] - b.lock[3]).abs() < 0.12, "{t}");
            if a.lock[3] > 0.0 && b.lock[3] > 0.0 {
                assert!((a.lock[2] - b.lock[2]).abs() < 0.02, "{t}");
            }
        });
    }

    #[test]
    fn the_still_frame_shows_the_beam_turning_and_marks_fading_behind_it() {
        let f = compose(STILL);
        assert!(f.beam_light == 1.0 && f.reach == SCOPE_R && f.grid == 1.0);
        assert!(close(f.trail, 0.65, 1e-4));
        let lit = f.blips.iter().filter(|b| b[3] > 0.2).count();
        assert!(lit >= 4, "{lit}");
        assert!(f.lock[3] == 0.0 && f.measure[3] == 0.0);
        let s = project(&f, HEAD).unwrap();
        assert!(s[0].abs() < 0.5 && s[1].abs() < 0.6);
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
}
