//! «Всплытие»: Step 3, page 6 «Проговоренное — уже не скрытое».
//!
//! A woman of soft light (her skin, her hair drawn up, her brows apart, a
//! dark dress with long sleeves) stands still in a dark sea of matrix code,
//! deep under it: at first the water fills the whole frame. The lens is half
//! in the water: its waterline is the water's level, so when the level falls
//! the line comes down into the frame and slides down it, uncovering her. She never moves up; only her speaking
//! moves the water. Each time she speaks, her lips move and the voice leaves
//! her mouth as a ray down into the depth; there it lights a knot and draws it
//! up. The knot breaks the surface and opens, stroke by stroke, into a word in
//! the air (БОЛЬ, ВИНА, МЫСЛЬ), and as it opens the water falls a step: off
//! her mouth, off her breast, and after the last word it drains away
//! altogether. Each word moves off and hangs apart in the dark. In the
//! silence at the end the words dissolve upward, the water comes back, and
//! the loop begins again.
//!
//! This module is the choreography: pure functions of loop time, tested here.
//! `browser.rs` hands every value to one full-screen shader pass.
use std::f32::consts::{PI, TAU};
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::VoiceSurface;

pub const LOOP_SECONDS: f32 = 44.0;
/// The authored frame is 3:2; a canvas of another shape still shows all of it.
pub const FRAME_ASPECT: f32 = 1.5;
/// Half the frame's height as a tangent: the frame is 34° tall.
pub const LENS: f32 = 0.3057;
/// The camera's two eyes: the air half above the water, the water half under it (m).
pub const AIR_EYE: f32 = 0.022;
pub const WATER_EYE: f32 = -0.028;
/// The lens's waterline meets the world's at this distance, hers: what lies
/// above the level there is seen through the air, below it through the water.
pub const DOME: f32 = 1.57;
/// Water magnifies what lies under it, so the body breaks at the waterline.
pub const ZOOM: f32 = 1.12;

/// Her feet. She stands here the whole loop.
pub const STAND: [f32; 3] = [-0.28, -1.36, -1.55];
/// She stands turned toward the words, in three-quarters to the camera (radians).
pub const YAW: f32 = 1.0;
/// Her height, from the soles to the crown.
pub const HEIGHT: f32 = 1.655;
/// The jugular notch and the pivot of the neck, in her own frame (feet at the
/// origin, facing +z).
pub const NOTCH: [f32; 3] = [0.0, 1.375, 0.05];
pub const NECK: [f32; 3] = [0.0, 1.43, -0.005];
/// The middle of her eyes in her head's frame.
pub const EYES: [f32; 3] = [0.0, 1.534, 0.074];

/// Where her lips meet, in her head's frame: the voice leaves here.
pub const MOUTH: [f32; 3] = [0.0, 1.468, 0.1];
pub const BREATH_SECONDS: f32 = 5.5;
pub const BREATH: f32 = 0.004;

/// Each word: the voice starts, after CALL the knot starts to rise from
/// KNOT_DEPTH, ASCENT later it breaks the surface, then UNFOLDs into letters.
pub const WORDS: usize = 3;
pub const WORD_AT: [f32; WORDS] = [3.0, 11.0, 19.0];
pub const CALL: f32 = 0.35;
pub const ASCENT: f32 = 2.9;
pub const UNFOLD: f32 = 2.1;
pub const KNOT_DEPTH: f32 = -0.78;
pub const KNOT_RADIUS: f32 = 0.05;
/// Syllables: how often her mouth opens while she speaks, per loop (3.2 a second).
pub const SYLLABLES: f32 = 140.0;
/// Before she speaks the water is over the whole frame (Art, 13.11: «всплытие
/// должно изначально полностью залито водой»); her first word draws it down
/// to her brow while its knot rises (FIRST_FALL, s after the word starts and
/// before the knot is out).
pub const FLOOD: f32 = 0.56;
pub const FIRST_FALL: [f32; 2] = [0.3, CALL + ASCENT - 0.3];
/// The water's level (world y) as each knot breaks the surface and after
/// the last: over her eyes (she says the first word under the water), then
/// at her neck, under her breast, and after the last word it is gone: far
/// under the frame.
pub const LEVELS: [f32; WORDS + 1] = [0.21, 0.03, -0.16, -1.2];
/// How long the water takes to fall each step once the knot is out; the
/// last step drains it away.
pub const DROPS: [f32; WORDS] = [2.6, 2.6, 4.6];
/// Under this level no water is left in the frame (the far sea has faded).
pub const DRY: f32 = -0.9;
/// In the silence at the end the water comes back.
pub const RETURN: [f32; 2] = [36.4, 43.8];
/// Where each word opens, in front of her and nearer the camera, and the
/// height it opens at: above the water as it was when she said it.
pub const FORM: [f32; 3] = [0.24, 0.14, -1.2];
pub const WORD_Y: [f32; WORDS] = [0.3, 0.17, 0.14];
/// Where each word comes to rest, apart over the water, and its size there:
/// a word that moves off grows, so it still reads.
pub const REST: [[f32; 3]; WORDS] = [[-0.02, 0.72, -3.6], [0.55, 0.47, -2.3], FORM];
pub const REST_SCALE: [f32; WORDS] = [1.7, 1.35, 1.0];
pub const REST_LIGHT: [f32; WORDS] = [0.62, 0.72, 1.0];
/// After the next word's voice: when a word starts and ends moving off.
pub const DRIFT: [f32; 2] = [0.2, 3.2];
/// All three hang apart and the sea calms; then they dissolve upward.
pub const CALM: [f32; 2] = [26.5, 34.0];
pub const FADE: [f32; 2] = [34.0, 38.0];
/// Reduced motion holds this moment: three words over a calm sea.
pub const STILL: f32 = 31.0;

/// Rings on the water: how many at once, how fast they run (m/s), how long they live.
pub const RINGS: usize = 4;
pub const RING_SPEED: f32 = 0.3;
pub const RING_LIFE: f32 = 7.0;

/// Letters are strokes in a 4 × 6 cell; LETTER metres per unit.
pub const LETTER: f32 = 0.012;
pub const ADVANCE: f32 = 5.5;
type Glyph = &'static [[f32; 4]];
const BE: Glyph = &[
    [4.0, 6.0, 0.0, 6.0],
    [0.0, 6.0, 0.0, 0.0],
    [0.0, 0.0, 3.0, 0.0],
    [3.0, 0.0, 4.0, 1.0],
    [4.0, 1.0, 4.0, 2.5],
    [4.0, 2.5, 3.0, 3.5],
    [3.0, 3.5, 0.0, 3.5],
];
const O: Glyph = &[
    [1.0, 0.0, 3.0, 0.0],
    [3.0, 0.0, 4.0, 1.0],
    [4.0, 1.0, 4.0, 5.0],
    [4.0, 5.0, 3.0, 6.0],
    [3.0, 6.0, 1.0, 6.0],
    [1.0, 6.0, 0.0, 5.0],
    [0.0, 5.0, 0.0, 1.0],
    [0.0, 1.0, 1.0, 0.0],
];
const EL: Glyph = &[
    [0.0, 0.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 6.0],
    [1.0, 6.0, 4.0, 6.0],
    [4.0, 6.0, 4.0, 0.0],
];
const SOFT: Glyph = &[
    [0.0, 6.0, 0.0, 0.0],
    [0.0, 0.0, 3.0, 0.0],
    [3.0, 0.0, 4.0, 1.0],
    [4.0, 1.0, 4.0, 2.5],
    [4.0, 2.5, 3.0, 3.5],
    [3.0, 3.5, 0.0, 3.5],
];
const VE: Glyph = &[
    [0.0, 0.0, 0.0, 6.0],
    [0.0, 6.0, 3.0, 6.0],
    [3.0, 6.0, 3.8, 5.2],
    [3.8, 5.2, 3.8, 4.1],
    [3.8, 4.1, 3.0, 3.3],
    [0.0, 3.3, 3.0, 3.3],
    [3.0, 3.3, 4.0, 2.4],
    [4.0, 2.4, 4.0, 0.9],
    [4.0, 0.9, 3.1, 0.0],
    [3.1, 0.0, 0.0, 0.0],
];
const I: Glyph = &[
    [0.0, 6.0, 0.0, 0.0],
    [0.0, 0.0, 4.0, 6.0],
    [4.0, 6.0, 4.0, 0.0],
];
const EN: Glyph = &[
    [0.0, 0.0, 0.0, 6.0],
    [4.0, 0.0, 4.0, 6.0],
    [0.0, 3.0, 4.0, 3.0],
];
const A: Glyph = &[
    [0.0, 0.0, 0.0, 5.0],
    [0.0, 5.0, 1.0, 6.0],
    [1.0, 6.0, 3.0, 6.0],
    [3.0, 6.0, 4.0, 5.0],
    [4.0, 5.0, 4.0, 0.0],
    [0.0, 2.6, 4.0, 2.6],
];
const EM: Glyph = &[
    [0.0, 0.0, 0.0, 6.0],
    [0.0, 6.0, 2.0, 3.0],
    [2.0, 3.0, 4.0, 6.0],
    [4.0, 6.0, 4.0, 0.0],
];
const YERY: Glyph = &[
    [0.0, 6.0, 0.0, 0.0],
    [0.0, 0.0, 1.8, 0.0],
    [1.8, 0.0, 2.6, 0.8],
    [2.6, 0.8, 2.6, 2.7],
    [2.6, 2.7, 1.8, 3.5],
    [1.8, 3.5, 0.0, 3.5],
    [4.0, 0.0, 4.0, 6.0],
];
const ES: Glyph = &[
    [4.0, 5.0, 3.0, 6.0],
    [3.0, 6.0, 1.0, 6.0],
    [1.0, 6.0, 0.0, 5.0],
    [0.0, 5.0, 0.0, 1.0],
    [0.0, 1.0, 1.0, 0.0],
    [1.0, 0.0, 3.0, 0.0],
    [3.0, 0.0, 4.0, 1.0],
];
/// БОЛЬ, ВИНА, МЫСЛЬ.
pub const SPELLING: [&[Glyph]; WORDS] = [
    &[BE, O, EL, SOFT],
    &[VE, I, EN, A],
    &[EM, YERY, ES, EL, SOFT],
];
/// Where each word's strokes start in the segment list, and the total.
pub const WORD_STARTS: [usize; WORDS + 1] = [0, 25, 47, 75];
pub const SEGMENTS: usize = 75;

pub struct Frame {
    pub time: f32,
    pub eye: [f32; 3],
    pub right: [f32; 3],
    pub up: [f32; 3],
    pub forward: [f32; 3],
    /// Her feet (x, y, z) and how she is turned.
    pub body: [f32; 4],
    /// Her head turned (yaw) and lifted (pitch) on the neck, radians.
    pub head: [f32; 2],
    /// Her mouth in the world and the light of the voice there.
    pub voice: [f32; 4],
    /// The water's level, the waterline on the lens (a tangent), how open
    /// her mouth is.
    pub water: [f32; 4],
    /// What lights her face (the word she looks at), and how strongly.
    pub lamp: [f32; 4],
    /// The voice reaching down to the knot: x, z, its lower end, its light.
    pub beam: [f32; 4],
    /// Rings on the water: x, z, age (s), strength.
    pub rings: [[f32; 4]; RINGS],
    /// Every stroke: from (xyz, light), to (xyz, warmth).
    pub segments: [[f32; 8]; SEGMENTS],
    /// Each word's bounding sphere (centre, radius; radius 0 when dark).
    pub words: [[f32; 4]; WORDS],
    /// How busy the code in the water is.
    pub sea: f32,
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
fn mix(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}
fn mix3(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]
}
fn add(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
fn sub(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn scale(a: [f32; 3], k: f32) -> [f32; 3] {
    [a[0] * k, a[1] * k, a[2] * k]
}
fn dot(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
fn length(a: [f32; 3]) -> f32 {
    dot(a, a).sqrt()
}
fn normalize(a: [f32; 3]) -> [f32; 3] {
    scale(a, 1.0 / length(a).max(1e-9))
}
fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
/// A repeatable number in 0..1 for (a, b).
fn hash(a: u32, b: u32) -> f32 {
    let mut x = a.wrapping_mul(0x9e37_79b9) ^ b.wrapping_mul(0x85eb_ca6b).wrapping_add(0x632b_e5ab);
    x ^= x >> 16;
    x = x.wrapping_mul(0x7feb_352d);
    x ^= x >> 15;
    x = x.wrapping_mul(0x846c_a68b);
    x ^= x >> 16;
    (x >> 8) as f32 / 16_777_215.0
}
/// Seconds since `at`, counted round the loop.
fn since(t: f32, at: f32) -> f32 {
    (t - at).rem_euclid(LOOP_SECONDS)
}

/// A point of her body (her own frame) in the world, for feet at `base`.
pub fn to_world(base: [f32; 3], yaw: f32, p: [f32; 3]) -> [f32; 3] {
    let (s, c) = yaw.sin_cos();
    [
        base[0] + p[0] * c + p[2] * s,
        base[1] + p[1],
        base[2] - p[0] * s + p[2] * c,
    ]
}
/// A point of her head (its own frame, upright) on the turned and lifted head.
pub fn head_to_body(head: [f32; 2], p: [f32; 3]) -> [f32; 3] {
    let [yaw, pitch] = head;
    let f = [
        yaw.sin() * pitch.cos(),
        pitch.sin(),
        yaw.cos() * pitch.cos(),
    ];
    let r = normalize(cross([0.0, 1.0, 0.0], f));
    let u = cross(f, r);
    let v = sub(p, NECK);
    add(
        NECK,
        add(add(scale(r, v[0]), scale(u, v[1])), scale(f, v[2])),
    )
}

/// Her feet over the loop: she stands and breathes, nothing more.
pub fn feet(t: f32) -> [f32; 3] {
    let breath = BREATH * (TAU * t / BREATH_SECONDS).sin();
    [STAND[0], STAND[1] + breath, STAND[2]]
}

/// When knot `w` breaks the surface.
pub fn surfaces(w: usize) -> f32 {
    WORD_AT[w] + CALL + ASCENT
}
/// The water's level: over the frame until she speaks, down to her brow
/// with her first word, a step down after each word is out, back over the
/// frame in the silence at the end.
pub fn level(t: f32) -> f32 {
    let first = WORD_AT[0];
    let mut l =
        FLOOD + (LEVELS[0] - FLOOD) * smooth(first + FIRST_FALL[0], first + FIRST_FALL[1], t);
    for w in 0..WORDS {
        l += (LEVELS[w + 1] - LEVELS[w]) * smooth(surfaces(w), surfaces(w) + DROPS[w], t);
    }
    l + (FLOOD - LEVELS[WORDS]) * smooth(RETURN[0], RETURN[1], t)
}
/// Where the waterline crosses the lens, as a tangent.
pub fn split(t: f32) -> f32 {
    (level(t) - AIR_EYE) / DOME
}
/// While she speaks word `w` (0..1): from the voice's start until its knot is out.
fn speaking(w: usize, t: f32) -> f32 {
    let at = WORD_AT[w];
    smooth(at, at + 0.5, t) * (1.0 - smooth(surfaces(w) - 0.4, surfaces(w) + 0.4, t))
}
/// How far her mouth opens: syllable by syllable while she speaks.
pub fn mouth(t: f32) -> f32 {
    let on = (0..WORDS).map(|w| speaking(w, t)).fold(0.0f32, f32::max);
    on * (0.5 - 0.5 * (TAU * SYLLABLES * t / LOOP_SECONDS).cos())
}

/// The strokes of word `w`, centred, in letter units.
pub fn strokes(w: usize) -> Vec<[f32; 4]> {
    let letters = SPELLING[w];
    let width = (letters.len() as f32 - 1.0) * ADVANCE + 4.0;
    let mut out = Vec::new();
    for (k, glyph) in letters.iter().enumerate() {
        let dx = k as f32 * ADVANCE - width * 0.5;
        for s in glyph.iter() {
            out.push([s[0] + dx, s[1] - 3.0, s[2] + dx, s[3] - 3.0]);
        }
    }
    out
}

/// Where a word's knot or letters are centred, how large they are, how much
/// they glow, whether they are open (0 knot … 1 letters), and how much they
/// have dissolved.
struct WordState {
    centre: [f32; 3],
    size: f32,
    light: f32,
    open: f32,
    warmth: f32,
    gone: f32,
}

fn word_state(w: usize, t: f32) -> WordState {
    let start = WORD_AT[w];
    let surfaced = start + CALL + ASCENT;
    let opened = surfaced + UNFOLD;
    // Not yet called (or already gone round the loop): dark, deep.
    if t < start {
        return WordState {
            centre: [FORM[0], KNOT_DEPTH, FORM[2]],
            size: 1.0,
            light: 0.0,
            open: 0.0,
            warmth: 0.9,
            gone: 0.0,
        };
    }
    let rise = smooth(start + CALL, surfaced, t);
    let open = smooth(surfaced, opened, t);
    let bob = 0.004 * (TAU * 4.0 * t / LOOP_SECONDS + w as f32 * 2.1).sin() * open;
    // Up to the water as it is when she speaks, then out and up to its line.
    let mut centre = [
        FORM[0],
        mix(KNOT_DEPTH, LEVELS[w] - 0.02, rise) + (WORD_Y[w] - LEVELS[w] + 0.02) * open + bob,
        FORM[2],
    ];
    let mut size = 1.0;
    let mut light = smooth(start + CALL - 0.1, start + CALL + 0.9, t) * mix(0.6, 1.0, open);
    let mut warmth = mix(0.9, 0.3, open);
    // Moving off when the next word is called.
    if w + 1 < WORDS {
        let off = smooth(WORD_AT[w + 1] + DRIFT[0], WORD_AT[w + 1] + DRIFT[1], t);
        centre = add(mix3(centre, REST[w], off), [0.0, bob * off, 0.0]);
        size = mix(1.0, REST_SCALE[w], off);
        light *= mix(1.0, REST_LIGHT[w], off);
        warmth = mix(warmth, 0.15, off);
    }
    let gone = smooth(FADE[0], FADE[1], t);
    light *= 1.0 - gone;
    WordState {
        centre,
        size,
        light,
        open,
        warmth,
        gone,
    }
}

/// A direction on the ball of the knot for stroke `i` of word `w`, end `e`.
fn knot_point(w: usize, i: usize, e: u32) -> [f32; 3] {
    let k = (w * 97 + i) as u32;
    let a = [
        hash(k, 1) * 2.0 - 1.0,
        hash(k, 2) * 2.0 - 1.0,
        hash(k, 3) * 2.0 - 1.0,
    ];
    let a = normalize(a);
    if e == 0 {
        return scale(a, 0.55 + 0.45 * hash(k, 4));
    }
    // The other end runs along the ball, so the strokes wind round it.
    let b = [
        hash(k, 5) * 2.0 - 1.0,
        hash(k, 6) * 2.0 - 1.0,
        hash(k, 7) * 2.0 - 1.0,
    ];
    scale(normalize(add(a, scale(b, 1.3))), 0.6 + 0.4 * hash(k, 8))
}

/// The world position of both ends of each stroke of word `w`.
fn word_segments(w: usize, t: f32, eye: [f32; 3], out: &mut [[f32; 8]; SEGMENTS]) -> [f32; 4] {
    let s = word_state(w, t);
    let to_eye = normalize([eye[0] - s.centre[0], 0.0, eye[2] - s.centre[2]]);
    let right = normalize(cross([0.0, 1.0, 0.0], to_eye));
    let up = [0.0, 1.0, 0.0];
    let unit = LETTER * s.size;
    let spin = TAU * 3.0 * t / LOOP_SECONDS + w as f32;
    let (ss, cs) = spin.sin_cos();
    let list = strokes(w);
    let n = list.len() as f32;
    let mut lo = [f32::MAX; 3];
    let mut hi = [f32::MIN; 3];
    for (i, st) in list.iter().enumerate() {
        let k = WORD_STARTS[w] + i;
        // Strokes open in reading order, each along a small arc.
        let p = smooth(0.0, 1.0, (s.open - 0.45 * i as f32 / n) / 0.55);
        let mut ends = [[0.0f32; 3]; 2];
        for (e, end) in ends.iter_mut().enumerate() {
            let letter = add(
                s.centre,
                add(
                    scale(right, st[2 * e] * unit),
                    scale(up, st[2 * e + 1] * unit),
                ),
            );
            let d = scale(knot_point(w, i, e as u32), KNOT_RADIUS);
            let turned = [d[0] * cs + d[2] * ss, d[1], -d[0] * ss + d[2] * cs];
            let knot = add([FORM[0], s.centre[1], FORM[2]], turned);
            let mut at = add(mix3(knot, letter, p), [0.0, 0.025 * (PI * p).sin(), 0.0]);
            // Dissolving: each stroke shrinks to a spark at its middle, and
            // the sparks drift up and a little apart.
            if s.gone > 0.0 {
                let mid = add(
                    s.centre,
                    add(
                        scale(right, (st[0] + st[2]) * 0.5 * unit),
                        scale(up, (st[1] + st[3]) * 0.5 * unit),
                    ),
                );
                let wander = [
                    hash(k as u32, 11) - 0.5,
                    hash(k as u32, 13),
                    hash(k as u32, 17) - 0.5,
                ];
                let shrink = smooth(0.0, 0.8, s.gone);
                at = add(
                    mix3(at, mid, shrink),
                    add(
                        scale(sub(mid, s.centre), 0.25 * s.gone),
                        scale(add([0.0, 0.1, 0.0], scale(wander, 0.06)), s.gone * s.gone),
                    ),
                );
            }
            for c in 0..3 {
                lo[c] = lo[c].min(at[c]);
                hi[c] = hi[c].max(at[c]);
            }
            *end = at;
        }
        let light = s.light * mix(0.6, 1.0, p);
        let warmth = mix(0.9, s.warmth, p);
        out[k] = [
            ends[0][0], ends[0][1], ends[0][2], light, ends[1][0], ends[1][1], ends[1][2], warmth,
        ];
    }
    if s.light < 0.002 {
        return [0.0; 4];
    }
    let centre = scale(add(lo, hi), 0.5);
    let radius = length(sub(hi, lo)) * 0.5 + 0.03;
    [centre[0], centre[1], centre[2], radius]
}

/// Where she looks: up toward the surface as she rises, then at each knot
/// and word in turn, at the three of them while the sea calms, then ahead.
pub fn gaze(t: f32) -> [f32; 3] {
    let base = feet(t);
    let ahead = to_world(base, YAW, [0.0, 1.85, 1.2]);
    let mut g = ahead;
    for (w, at) in WORD_AT.iter().enumerate() {
        let blend = smooth(at - 0.4, at + 1.6, t);
        g = mix3(g, word_state(w, t).centre, blend);
    }
    let all = scale(
        (0..WORDS).fold([0.0; 3], |sum, w| add(sum, word_state(w, t).centre)),
        1.0 / WORDS as f32,
    );
    g = mix3(g, all, smooth(CALM[0] + 1.0, CALM[0] + 4.0, t));
    mix3(g, ahead, smooth(FADE[0] + 1.0, FADE[1] + 1.0, t))
}

/// Her head turned toward `gaze`: most of the turn in the neck, the rest in the eyes.
pub fn head(t: f32) -> [f32; 2] {
    let base = feet(t);
    let eyes = to_world(base, YAW, EYES);
    let d = sub(gaze(t), eyes);
    let yaw = d[0].atan2(d[2]) - YAW;
    let pitch = d[1].atan2((d[0] * d[0] + d[2] * d[2]).sqrt());
    // She looks down at a knot with her eyes more than her head, so her
    // mouth stays clear of the water once it is out.
    let limit = if pitch < 0.0 { 0.2 } else { 0.38 };
    [soft(yaw * 0.75, 0.6), soft(pitch * 0.75, limit)]
}
/// Toward `x`, but easing off before `limit`.
fn soft(x: f32, limit: f32) -> f32 {
    x / (1.0 + (x / limit).powi(2)).sqrt()
}

/// The light at her mouth: it swells with each syllable while she speaks,
/// and a low glow stays while the words hang in the calm.
pub fn voice(t: f32) -> f32 {
    let on = (0..WORDS).map(|w| speaking(w, t)).fold(0.0f32, f32::max);
    let calm = smooth(CALM[0], CALM[0] + 2.0, t) * (1.0 - smooth(FADE[0], FADE[1], t));
    (0.65 * on + 0.3 * mouth(t)).max(0.1 * calm)
}

/// Ripples: the voice going into the water (once her mouth is out of it),
/// and each knot breaking the surface.
pub fn ripples(t: f32) -> [[f32; 4]; RINGS] {
    // Where the voice, on its way from her mouth down to the depth, enters the water.
    let entry = [mix(STAND[0], FORM[0], 0.35), mix(STAND[2], FORM[2], 0.35)];
    let mut events: Vec<(f32, [f32; 2], f32)> = Vec::new();
    for (w, at) in WORD_AT.iter().enumerate() {
        if w > 0 {
            events.push((at + 0.2, entry, 0.7));
        }
        events.push((surfaces(w), [FORM[0], FORM[2]], 0.9));
    }
    let mut live: Vec<[f32; 4]> = events
        .iter()
        .map(|(at, xz, k)| [xz[0], xz[1], since(t, *at), *k])
        .filter(|r| r[2] < RING_LIFE)
        .collect();
    live.sort_by(|a, b| a[2].total_cmp(&b[2]));
    let mut out = [[0.0, 0.0, RING_LIFE, 0.0]; RINGS];
    for (slot, ring) in out.iter_mut().zip(live) {
        // A ring fades in over its first moments so it never pops.
        *slot = [
            ring[0],
            ring[1],
            ring[2],
            ring[3]
                * smooth(0.0, 0.15, ring[2])
                * (1.0 - smooth(RING_LIFE - 2.0, RING_LIFE, ring[2])),
        ];
    }
    out
}
/// How busy the code in the water is: calmer once the words are out, busy
/// again as the water comes back.
pub fn sea(t: f32) -> f32 {
    1.0 - 0.15 * smooth(surfaces(0), surfaces(0) + 2.0, t) - 0.4 * smooth(CALM[0], CALM[0] + 3.0, t)
        + 0.55 * smooth(RETURN[0], RETURN[1] - 0.5, t)
}

pub fn compose(t: f32) -> Frame {
    let t = t.rem_euclid(LOOP_SECONDS);
    let sway = TAU * t / LOOP_SECONDS;
    let eye = [0.012 * sway.sin(), AIR_EYE, 0.0];
    let a = 0.012 * (sway + 1.0).sin();
    let forward = [a.sin(), 0.0, -a.cos()];
    let right = [a.cos(), 0.0, a.sin()];
    let base = feet(t);
    let head = head(t);
    let lips = to_world(base, YAW, head_to_body(head, MOUTH));
    let mut segments = [[0.0; 8]; SEGMENTS];
    let mut words = [[0.0; 4]; WORDS];
    for (w, bound) in words.iter_mut().enumerate() {
        *bound = word_segments(w, t, eye, &mut segments);
    }
    // The light that falls on her face comes from what she looks at, once it is a word.
    let lit = (0..WORDS)
        .map(|w| {
            let s = word_state(w, t);
            s.open * s.light
        })
        .fold(0.0f32, f32::max);
    let g = gaze(t);
    // The voice reaches from her mouth down to the knot and draws it up.
    let mut beam = [FORM[0], FORM[2], 0.0, 0.0];
    for (w, at) in WORD_AT.iter().enumerate() {
        let on = smooth(*at, at + CALL + 0.3, t)
            * (1.0 - smooth(surfaces(w) - 0.3, surfaces(w) + 0.4, t));
        if on > beam[3] {
            beam = [FORM[0], FORM[2], word_state(w, t).centre[1], on];
        }
    }
    Frame {
        time: t,
        eye,
        right,
        up: [0.0, 1.0, 0.0],
        forward,
        body: [base[0], base[1], base[2], YAW],
        head,
        voice: [lips[0], lips[1], lips[2], voice(t)],
        water: [level(t), split(t), mouth(t), 0.0],
        lamp: [g[0], g[1], g[2], 0.7 * lit],
        beam,
        rings: ripples(t),
        segments,
        words,
        sea: sea(t),
    }
}

/// Where a world point lands in the air half of the frame, -1..1 each way.
pub fn project(f: &Frame, p: [f32; 3]) -> Option<[f32; 2]> {
    let v = sub(p, f.eye);
    let z = dot(v, f.forward);
    if z <= 0.0 {
        return None;
    }
    Some([
        dot(v, f.right) / z / (LENS * FRAME_ASPECT),
        dot(v, f.up) / z / LENS,
    ])
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub cold: [f32; 3],
    pub warm: [f32; 3],
    pub pale: [f32; 3],
}
const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}
/// The theme's cold (water, code, her lines), warm (the knot, the voice) and
/// pale (the words) by its `graphicsPalette` code. Retired light codes fall
/// back to Тишина.
pub fn look(code: u32) -> Look {
    match Palette::from_code(code) {
        Palette::Dark => Look {
            cold: rgb(245, 221, 7),
            warm: rgb(255, 122, 40),
            pale: rgb(255, 244, 170),
        },
        Palette::Violet => Look {
            cold: rgb(98, 150, 245),
            warm: rgb(240, 158, 128),
            pale: rgb(200, 212, 248),
        },
        Palette::Matrix => Look {
            cold: rgb(0, 255, 65),
            warm: rgb(255, 184, 64),
            pale: rgb(190, 255, 205),
        },
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

    fn near(a: f32, b: f32, e: f32) -> bool {
        (a - b).abs() <= e
    }
    /// The screen box of word `w`'s strokes.
    fn word_box(f: &Frame, w: usize) -> [f32; 4] {
        let mut b = [f32::MAX, f32::MAX, f32::MIN, f32::MIN];
        for s in &f.segments[WORD_STARTS[w]..WORD_STARTS[w + 1]] {
            for p in [[s[0], s[1], s[2]], [s[4], s[5], s[6]]] {
                let q = project(f, p).expect("in front");
                b = [
                    b[0].min(q[0]),
                    b[1].min(q[1]),
                    b[2].max(q[0]),
                    b[3].max(q[1]),
                ];
            }
        }
        b
    }
    fn head_box(f: &Frame) -> [f32; 4] {
        let base = [f.body[0], f.body[1], f.body[2]];
        let mut b = [f32::MAX, f32::MAX, f32::MIN, f32::MIN];
        for p in [
            [0.0, 1.655, -0.01],
            [0.0, 1.42, 0.09],
            [0.0, 1.5, 0.125],
            [0.0, 1.55, -0.11],
            [0.085, 1.53, 0.0],
            [-0.085, 1.53, 0.0],
        ] {
            let q = project(f, to_world(base, f.body[3], head_to_body(f.head, p))).unwrap();
            b = [
                b[0].min(q[0]),
                b[1].min(q[1]),
                b[2].max(q[0]),
                b[3].max(q[1]),
            ];
        }
        b
    }
    fn apart(a: [f32; 4], b: [f32; 4], gap: f32) -> bool {
        a[2] + gap < b[0] || b[2] + gap < a[0] || a[3] + gap < b[1] || b[3] + gap < a[1]
    }

    #[test]
    fn letters_fit_their_cell_and_the_count() {
        for (w, letters) in SPELLING.iter().enumerate() {
            let n: usize = letters.iter().map(|g| g.len()).sum();
            assert_eq!(n, WORD_STARTS[w + 1] - WORD_STARTS[w]);
            for g in letters.iter() {
                for s in g.iter() {
                    assert!(s.iter().step_by(2).all(|x| (0.0..=4.0).contains(x)));
                    assert!(s.iter().skip(1).step_by(2).all(|y| (0.0..=6.0).contains(y)));
                }
            }
        }
        assert_eq!(WORD_STARTS[WORDS], SEGMENTS);
    }

    #[test]
    fn she_stands_and_the_water_falls_as_she_speaks() {
        // She never moves but for her breath.
        for i in 0..440 {
            let t = i as f32 * 0.1;
            assert!((feet(t)[1] - STAND[1]).abs() <= BREATH + 1e-6);
        }
        let mouth_y = |t: f32| compose(t).voice[1];
        // At first the water fills the whole frame, over her crown.
        let crown = STAND[1] + HEIGHT;
        for t in [0.0, WORD_AT[0], LOOP_SECONDS - 0.01] {
            assert!(split(t) > LENS * 1.05 && level(t) > crown + 0.2, "at {t}");
        }
        // The first word she says under the water; it draws the water down
        // to her brow before its knot is out.
        let first = mouth_y(WORD_AT[0] + 1.0);
        assert!(level(WORD_AT[0] + 1.0) > first + 0.05, "mouth {first}");
        assert!(near(level(surfaces(0) - 0.3), LEVELS[0], 1e-4));
        for w in 0..WORDS {
            // The water stands while she speaks the word, falls a step once it is out.
            if w > 0 {
                assert!(near(level(WORD_AT[w]), LEVELS[w], 1e-4), "before word {w}");
            }
            assert!(near(level(surfaces(w) - 0.01), LEVELS[w], 1e-4), "word {w}");
            assert!(
                near(level(surfaces(w) + DROPS[w]), LEVELS[w + 1], 1e-4),
                "after word {w}"
            );
            // The others she says with her mouth out of the water.
            if w > 0 {
                let mut t = WORD_AT[w];
                while t < surfaces(w) {
                    let m = mouth_y(t);
                    assert!(m > level(t) + 0.025, "word {w}: mouth {m} at {t}");
                    t += 0.1;
                }
            }
        }
        // It only falls until the silence at the end, then comes back.
        let mut last = level(0.0);
        let mut t = 0.0;
        while t < RETURN[0] {
            assert!(level(t) <= last + 1e-6, "the water rose at {t}");
            last = level(t);
            t += 0.05;
        }
        assert!(near(level(LOOP_SECONDS - 0.001), FLOOD, 1e-3));
        // Her mouth moves only while she speaks, and opens and closes then.
        assert!(mouth(1.0) < 1e-4 && mouth(STILL) < 1e-4);
        let (lo, hi) = (0..40)
            .map(|k| mouth(WORD_AT[1] + 1.0 + k as f32 * 0.05))
            .fold((1.0f32, 0.0f32), |(a, b), m| (a.min(m), b.max(m)));
        assert!(lo < 0.1 && hi > 0.9, "mouth {lo}..{hi}");
        // The lens's waterline follows the water, and after the last word it
        // leaves the frame: no water is left.
        assert!(split(WORD_AT[0]) > 0.1 && split(STILL) < -LENS * 1.5);
        assert!(level(STILL) < DRY && level(CALM[0]) < -0.6);
    }

    #[test]
    fn each_knot_rises_from_the_depth_and_opens_into_its_word() {
        for w in 0..WORDS {
            let deep = compose(WORD_AT[w] + CALL + 0.2);
            let open = compose(WORD_AT[w] + CALL + ASCENT + UNFOLD + 0.1);
            let list = strokes(w);
            for (i, k) in (WORD_STARTS[w]..WORD_STARTS[w + 1]).enumerate() {
                let (a, b) = (deep.segments[k], open.segments[k]);
                assert!(a[1] < -0.6 && a[5] < -0.6, "word {w} stroke {i} not deep");
                assert!(a[3] > 0.0, "word {w}'s knot is dark when called");
                assert!(
                    b[1] > LEVELS[w] + 0.02 && b[5] > LEVELS[w] + 0.02,
                    "word {w} stroke {i} under water"
                );
                // Open: the strokes stand where the letters say.
                let height = (b[5] - b[1]) / LETTER;
                assert!(
                    near(height, list[i][3] - list[i][1], 0.05),
                    "word {w} stroke {i}"
                );
            }
        }
    }

    #[test]
    fn three_words_read_apart_and_clear_of_her() {
        let f = compose(STILL);
        let boxes: Vec<[f32; 4]> = (0..WORDS).map(|w| word_box(&f, w)).collect();
        let head = head_box(&f);
        for (w, b) in boxes.iter().enumerate() {
            assert!(
                b[0] > -0.9 && b[2] < 0.9 && b[1] > 0.05 && b[3] < 0.8,
                "word {w} out of frame: {b:?}"
            );
            assert!(
                apart(*b, head, 0.05),
                "word {w} over her head: {b:?} {head:?}"
            );
            for (v, c) in boxes.iter().enumerate().skip(w + 1) {
                assert!(
                    apart(*b, *c, 0.02),
                    "words {w} and {v} overlap: {b:?} {c:?}"
                );
            }
            // Large enough to read: about a twentieth of the frame's height.
            assert!(b[3] - b[1] > 0.09, "word {w} too small: {b:?}");
        }
        assert!(
            head[0] > -0.85 && head[3] < 0.85 && head[1] > 0.0,
            "head {head:?}"
        );
    }

    #[test]
    fn the_still_frame_holds_three_words_over_a_calm_sea() {
        let f = compose(STILL);
        for w in 0..WORDS {
            let lit = f.segments[WORD_STARTS[w]..WORD_STARTS[w + 1]]
                .iter()
                .map(|s| s[3])
                .fold(1.0f32, f32::min);
            assert!(lit > 0.5, "word {w} dim: {lit}");
            assert!(f.words[w][3] > 0.0);
        }
        assert!(f.sea < 0.6);
        assert!(f.water[0] < DRY, "the water is gone");
        assert!(f.lamp[3] > 0.3);
    }

    #[test]
    fn the_loop_closes() {
        let a = compose(0.0);
        let b = compose(LOOP_SECONDS - 0.001);
        for i in 0..4 {
            assert!(near(a.body[i], b.body[i], 2e-3));
        }
        assert!(near(a.head[0], b.head[0], 2e-3) && near(a.head[1], b.head[1], 2e-3));
        assert!(near(a.voice[3], b.voice[3], 2e-3) && near(a.sea, b.sea, 2e-3));
        for i in 0..3 {
            assert!(near(a.water[i], b.water[i], 2e-3), "water {i}");
        }
        assert!(a
            .segments
            .iter()
            .chain(b.segments.iter())
            .all(|s| s[3] < 1e-3));
        for (r, q) in a.rings.iter().zip(b.rings.iter()) {
            assert!(near(r[3], q[3], 2e-2), "{r:?} {q:?}");
        }
    }

    #[test]
    fn nothing_jumps() {
        let step = 0.02;
        let mut prev = compose(LOOP_SECONDS - step);
        let mut t = 0.0;
        while t < LOOP_SECONDS {
            let f = compose(t);
            assert!((f.body[1] - prev.body[1]).abs() < 0.01, "body at {t}");
            assert!((f.head[0] - prev.head[0]).abs() < 0.03, "head yaw at {t}");
            assert!((f.head[1] - prev.head[1]).abs() < 0.03, "head pitch at {t}");
            assert!((f.voice[3] - prev.voice[3]).abs() < 0.12, "voice at {t}");
            assert!((f.sea - prev.sea).abs() < 0.01, "sea at {t}");
            assert!((f.water[0] - prev.water[0]).abs() < 0.008, "level at {t}");
            assert!((f.water[2] - prev.water[2]).abs() < 0.25, "mouth at {t}");
            for c in 0..3 {
                assert!((f.voice[c] - prev.voice[c]).abs() < 0.01, "lips at {t}");
            }
            for (s, p) in f.segments.iter().zip(prev.segments.iter()) {
                if s[3] > 0.01 && p[3] > 0.01 {
                    for c in [0, 1, 2, 4, 5, 6] {
                        assert!((s[c] - p[c]).abs() < 0.03, "stroke at {t}: {s:?} {p:?}");
                    }
                }
                assert!((s[3] - p[3]).abs() < 0.08, "stroke light at {t}");
            }
            // Every ring that shows was there a moment ago, a moment younger.
            for r in f.rings.iter().filter(|r| r[3] > 0.05) {
                let before = prev.rings.iter().any(|q| {
                    near(q[0], r[0], 1e-4)
                        && near(q[1], r[1], 1e-4)
                        && near(q[2], r[2] - step, 1e-3)
                });
                assert!(before || r[2] < 0.2, "ring appeared at {t}: {r:?}");
            }
            prev = f;
            t += step;
        }
    }

    #[test]
    fn the_themes_differ() {
        let codes = [0, 2, 3, 4];
        for (i, a) in codes.iter().enumerate() {
            for b in codes.iter().skip(i + 1) {
                assert_ne!(look(*a), look(*b));
            }
        }
        for retired in [1, 5, 6] {
            assert_eq!(look(retired), look(2));
        }
    }
}
