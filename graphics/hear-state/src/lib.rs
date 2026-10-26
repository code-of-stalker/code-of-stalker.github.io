//! «Услышь своё состояние»: Step 4, page 05/15. A seated, grounded person
//! breathes in and speaks aloud; the voice goes calmly into the room and the
//! person hears it, outside and within. Then the page asks one word at a
//! time — «Есть ли в нём уверенность? тревога? маска? отсутствие?
//! автоматизм?» — and for each word a slow scan passes through the whole
//! body, crown to soles. The scene never shows where a state lives: the
//! person feels it and answers for themselves.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time. The browser adapter only uploads the values and the shaders only
//! paint them.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod geometry;
pub mod silhouette;

use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

/// Authored frame, 3 : 2 like the other Step 4 scenes.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// One word: inhale, speak, listen, the question, the scan, settle.
pub const PHRASE: f32 = 11.2;
pub const PHRASES: usize = 5;
/// The five words of the page text, one each: a seamless 56 s loop.
pub const LOOP_SECONDS: f32 = PHRASE * PHRASES as f32;

/// The page asks: «Есть ли в нём уверенность, тревога, маска, отсутствие,
/// автоматизм?» — in this order, one word per phrase.
pub const STATES: [&str; 5] = [
    "УВЕРЕННОСТЬ?",
    "ТРЕВОГА?",
    "МАСКА?",
    "ОТСУТСТВИЕ?",
    "АВТОМАТИЗМ?",
];
/// Measured ink of each row in `labels.png` (x0, x1), rows are 128 px: the
/// five words, then the words that ask.
pub const LABEL_INK: [[f32; 2]; 6] = [
    [214.0, 803.0],
    [315.0, 702.0],
    [366.0, 651.0],
    [239.0, 778.0],
    [239.0, 778.0],
    [190.0, 828.0],
];
pub const ATLAS_HEIGHT: f32 = 768.0;
/// Label row band in the atlas (top, bottom); the caps are 44 px tall.
pub const LABEL_ROW: [f32; 2] = [22.0, 98.0];
/// The row of «ЕСТЬ ЛИ В НЁМ».
pub const QUESTION: usize = 5;

/// The voice in the room: slow, and only a few fronts per phrase.
pub const VOICE_SPEED: f32 = 2.2;
pub const REACH: f32 = 8.0;
/// Syllables per phrase; a front leaves on every other one.
pub const SYLLABLES: usize = 6;
/// The scan, crown to soles, in seconds.
pub const SCAN_SECONDS: f32 = 3.6;

/// The approved seated figure on the plane z = 0, feet on the floor.
/// Its rectangle in world units: x0, y0 (floor), width, height.
pub const FIGURE: [f32; 4] = [-2.147, 0.0, 2.176, 3.44];
/// Source SVG size, for anatomical points measured on it.
pub const FIGURE_SVG: [f32; 2] = [335.0, 530.0];
pub const fn on_figure(x: f32, y: f32) -> [f32; 3] {
    [
        FIGURE[0] + x / FIGURE_SVG[0] * FIGURE[2],
        FIGURE[1] + (1.0 - y / FIGURE_SVG[1]) * FIGURE[3],
        0.0,
    ]
}
pub const MOUTH: [f32; 3] = on_figure(131.0, 87.0);
pub const EAR: [f32; 3] = on_figure(78.0, 50.0);
pub const FEET: [f32; 3] = on_figure(262.0, 518.0);
pub const THROAT: [f32; 3] = on_figure(98.0, 124.0);
/// The breath goes in at the nose and settles low in the belly.
pub const NOSE: [f32; 3] = on_figure(124.0, 80.0);
pub const BELLY: [f32; 3] = on_figure(86.0, 240.0);
/// Crown and soles in the figure's texture (0 top … 1 bottom).
pub const CROWN: f32 = 0.025;
pub const SOLES: f32 = 0.985;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Camera {
    pub eye: [f32; 3],
    pub focal: f32,
    pub center: [f32; 2],
}
impl Camera {
    /// Screen position (authored px) and px per world unit at that depth.
    pub fn project(&self, p: [f32; 3]) -> Option<([f32; 2], f32)> {
        let z = p[2] - self.eye[2];
        if z < 0.2 {
            return None;
        }
        let s = self.focal / z;
        Some((
            [
                self.center[0] + (p[0] - self.eye[0]) * s,
                self.center[1] - (p[1] - self.eye[1]) * s,
            ],
            s,
        ))
    }
    pub fn depth(&self, p: [f32; 3]) -> f32 {
        p[2] - self.eye[2]
    }
}

/// One spherical front of the voice in the room.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Wave {
    pub origin: [f32; 3],
    pub radius: f32,
    pub strength: f32,
}

/// All motion of one instant.
#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// The word of the current phrase.
    pub word: usize,
    /// Loudness at the lips, 0..1.
    pub voice: f32,
    /// Phase of the carrier inside the voice (for the ribbon).
    pub carrier: f32,
    pub breath: f32,
    /// The inhale: 0 nose … 1 belly, and its alpha.
    pub inhale: [f32; 2],
    /// Hearing oneself: the sound at the ear and from within.
    pub heard: f32,
    pub listening: f32,
    /// The question «ЕСТЬ ЛИ В НЁМ … ?», 0..1.
    pub asked: f32,
    /// The scan: crown 0 … soles 1, and its alpha.
    pub scan: [f32; 2],
    /// What the scan has passed stays a little more present.
    pub felt: f32,
    /// The scan has reached the soles: contact with the floor.
    pub ground: f32,
    pub waves: Vec<Wave>,
    /// Ambient lift of the room while the voice sounds.
    pub ambient: f32,
}

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

#[derive(Clone, Copy, Debug)]
pub struct Syllable {
    pub at: f32,
    pub amp: f32,
    pub length: f32,
}
/// An ordinary spoken phrase, a little different each time: two short
/// groups of three syllables.
pub fn syllables(phrase: usize) -> [Syllable; SYLLABLES] {
    let mut at = 1.8;
    std::array::from_fn(|j| {
        let seed = (phrase * 31 + j * 7) as u32;
        let s = Syllable {
            at,
            amp: 0.55 + 0.3 * hash(seed),
            length: 0.26 + 0.1 * hash(seed + 101),
        };
        at += 0.36 + 0.1 * hash(seed + 211) + if j == 2 { 0.28 } else { 0.0 };
        s
    })
}
/// Loudness of one phrase at its local time.
pub fn envelope(phrase: usize, local: f32) -> f32 {
    syllables(phrase)
        .iter()
        .map(|s| {
            s.amp
                * bell(
                    local,
                    s.at - 0.06,
                    s.at + 0.08,
                    s.at + s.length * 0.5,
                    s.at + s.length,
                )
        })
        .fold(0.0, f32::max)
}
/// (first syllable, end of the last, start of the scan) of one phrase.
pub fn timing(phrase: usize) -> (f32, f32, f32) {
    let s = syllables(phrase);
    let last = s[SYLLABLES - 1].at + s[SYLLABLES - 1].length;
    (s[0].at, last, last + 1.4)
}
/// Reduced motion holds this moment: the first word asked, the scan at the
/// chest.
pub fn still() -> f32 {
    timing(0).2 + 1.2
}

/// Contributions of one phrase whose own clock reads `local` (may exceed the
/// phrase: its voice keeps sounding into the next one).
fn phrase(f: &mut Frame, index: usize, local: f32) {
    let (first, last, scan) = timing(index);
    for s in syllables(index).iter().step_by(2) {
        let age = local - s.at;
        let radius = age * VOICE_SPEED;
        if age > 0.0 && radius < REACH {
            f.waves.push(Wave {
                origin: MOUTH,
                radius,
                strength: 0.8
                    * s.amp
                    * smooth(0.0, 0.25, radius)
                    * (1.0 - radius / REACH).powf(1.5),
            });
        }
    }
    f.inhale[1] += bell(local, 0.1, 0.5, 1.7, 2.4);
    f.listening += bell(local, first + 0.3, first + 1.0, last + 0.8, last + 2.0);
    f.asked += bell(
        local,
        last + 0.4,
        last + 1.2,
        scan + SCAN_SECONDS + 0.4,
        scan + SCAN_SECONDS + 1.3,
    );
    let t = ((local - scan) / SCAN_SECONDS).clamp(0.0, 1.0);
    let alpha = bell(
        local,
        scan - 0.2,
        scan + 0.3,
        scan + SCAN_SECONDS - 0.2,
        scan + SCAN_SECONDS + 0.3,
    );
    if alpha > f.scan[1] {
        // Mostly even speed, easing a little at both ends.
        f.scan = [0.7 * t + 0.3 * t * t * (3.0 - 2.0 * t), alpha];
    }
    let end = scan + SCAN_SECONDS;
    f.felt += bell(local, scan + 0.4, scan + 1.4, end + 0.6, end + 1.5);
    f.ground += bell(local, end - 0.4, end + 0.1, end + 0.6, end + 1.5);
    f.ambient += bell(local, first, first + 0.6, last, last + 1.8);
}

/// The whole choreography at `seconds` (wrapped to the loop).
pub fn compose(seconds: f32) -> Frame {
    let time = if seconds.is_finite() {
        seconds.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let index = ((time / PHRASE) as usize).min(PHRASES - 1);
    let local = time - index as f32 * PHRASE;
    let previous = (index + PHRASES - 1) % PHRASES;
    let heard = envelope(index, local - 0.12).max(envelope(previous, local + PHRASE - 0.12));
    let mut f = Frame {
        time,
        camera: camera(time, local),
        word: index,
        voice: envelope(index, local).max(envelope(previous, local + PHRASE)),
        // 36 turns per loop (about 4 rad/s), so the ribbon has no seam.
        carrier: time / LOOP_SECONDS * 36.0 * TAU,
        breath: 0.5 - 0.5 * (local / PHRASE * TAU).cos(),
        inhale: [smooth(0.2, 1.8, local), 0.0],
        heard,
        listening: 0.0,
        asked: 0.0,
        scan: [0.0; 2],
        felt: 0.0,
        ground: 0.0,
        waves: Vec::with_capacity(8),
        ambient: 0.0,
    };
    phrase(&mut f, previous, local + PHRASE);
    phrase(&mut f, index, local);
    for v in [
        &mut f.inhale[1],
        &mut f.listening,
        &mut f.asked,
        &mut f.felt,
        &mut f.ground,
        &mut f.ambient,
        &mut f.heard,
        &mut f.voice,
    ] {
        *v = v.clamp(0.0, 1.0);
    }
    f
}

/// A slow drift and a gentle dolly towards the person while they speak.
/// Every term is periodic in the loop, so the seam is invisible.
pub fn camera(time: f32, local: f32) -> Camera {
    let w = time / LOOP_SECONDS * TAU;
    let push = bell(local, 1.2, 4.8, 8.0, 11.0);
    Camera {
        eye: [
            0.12 * w.sin() + 0.04 * (3.0 * w).sin(),
            1.652 + 0.035 * (2.0 * w).sin(),
            -3.95 + 0.16 * push,
        ],
        focal: 1000.0,
        center: [SIZE[0] * 0.5, SIZE[1] * 0.5],
    }
}

/// Colors for the composite pass: the page, the voice ink, the ink of the
/// self (contour, inner light, hearing, naming), the body and the haze.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub paper: [f32; 3],
    pub voice: [f32; 3],
    pub selfish: [f32; 3],
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
    std::array::from_fn(|i| a[i] + (b[i] - a[i]) * t)
}
/// The app theme by its `graphicsPalette` code. Light themes (Дюна, Мираж,
/// Рассвет) ink a pale page; dark themes light a dark room.
pub fn look(code: u32) -> Look {
    let palette = Palette::from_code(code);
    let dark = |paper: [f32; 3], accent: [f32; 3], highlight: [f32; 3]| Look {
        paper,
        voice: accent,
        selfish: mix(highlight, [1.0; 3], 0.2),
        body: mix(paper, [0.0; 3], 0.55),
        haze: accent,
        light: false,
    };
    match palette {
        // Дюна: a soft sepia print, brown ink on sand, never an orange flood.
        Palette::Light => {
            let paper = rgb(0xFAE18F);
            Look {
                paper,
                voice: rgb(0xD95A10),
                selfish: rgb(0xBE4C00),
                body: mix(paper, rgb(0xBE4C00), 0.07),
                haze: mix(paper, rgb(0xBE4C00), 0.45),
                light: true,
            }
        }
        Palette::Original => dark(rgb(0x000000), rgb(0xF5DD07), rgb(0xF5DD07)),
        _ => match palette.colors() {
            Some(c) if palette.is_light() => Look {
                paper: c.paper,
                voice: c.accent,
                selfish: c.highlight,
                body: mix(c.paper, c.highlight, 0.07),
                haze: mix(c.paper, c.detail, 0.6),
                light: true,
            },
            Some(c) => dark(c.paper, c.accent, c.highlight),
            None => dark(rgb(0x000000), rgb(0xF5DD07), rgb(0xF5DD07)),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_loop_has_no_seam() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        for k in 1..=PHRASES {
            let t = k as f32 * PHRASE;
            let (x, y) = (compose(t - 0.002), compose(t + 0.002));
            for (a, b) in [
                (x.voice, y.voice),
                (x.heard, y.heard),
                (x.ambient, y.ambient),
                (x.asked, y.asked),
                (x.felt, y.felt),
                (x.ground, y.ground),
                (x.scan[1], y.scan[1]),
                (x.inhale[1], y.inhale[1]),
                (x.listening, y.listening),
            ] {
                assert!((a - b).abs() < 0.02, "seam at {t}: {a} vs {b}");
            }
            for e in 0..3 {
                assert!((x.camera.eye[e] - y.camera.eye[e]).abs() < 0.002);
            }
        }
    }

    #[test]
    fn every_word_is_spoken_heard_asked_then_scanned() {
        for p in 0..PHRASES {
            let (first, last, scan) = timing(p);
            assert!(first > 1.6 && last < 5.2, "phrase {p}: {first}..{last}");
            assert!(scan + SCAN_SECONDS + 1.5 < PHRASE, "phrase {p} ends late");
            let at = |local: f32| compose(p as f32 * PHRASE + local);
            assert!(at(first + 0.05).voice > 0.1);
            assert!(at(last + 0.5).listening > 0.5);
            // The question stands for the whole scan.
            for k in 0..=10 {
                let f = at(scan + 0.3 + k as f32 * 0.3);
                assert!(f.asked > 0.95 && f.scan[1] > 0.9 && f.word == p);
            }
            // The scan goes down, crown to soles, and reaches the floor.
            assert!(at(scan + 0.5).scan[0] < at(scan + 2.0).scan[0]);
            assert!(at(scan + SCAN_SECONDS).scan[0] > 0.99);
            assert!(at(scan + SCAN_SECONDS + 0.3).ground > 0.9);
            assert!(at(0.05).asked < 0.05 && at(0.05).voice < 0.05);
        }
    }

    #[test]
    fn the_voice_is_calm_and_sparse() {
        // Three fronts per phrase at most, never a crowd.
        for i in 0..5600 {
            let f = compose(i as f32 * 0.01);
            assert!(f.waves.len() <= 4, "{} fronts at {}", f.waves.len(), f.time);
        }
    }

    #[test]
    fn values_stay_finite_and_bounded() {
        for i in 0..5600 {
            let f = compose(i as f32 * 0.01);
            for v in [
                f.voice,
                f.heard,
                f.breath,
                f.ambient,
                f.asked,
                f.felt,
                f.ground,
                f.listening,
                f.scan[0],
                f.scan[1],
                f.inhale[0],
                f.inhale[1],
            ] {
                assert!(v.is_finite() && (0.0..=1.0).contains(&v));
            }
            for w in &f.waves {
                assert!(w.radius >= 0.0 && w.strength.is_finite() && w.strength >= 0.0);
            }
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
    }

    #[test]
    fn the_figure_stands_in_the_frame() {
        let c = camera(0.0, 0.0);
        let (mouth, _) = c.project(MOUTH).unwrap();
        assert!(mouth[0] > 380.0 && mouth[0] < 560.0 && mouth[1] > 120.0 && mouth[1] < 330.0);
        let (feet, _) = c.project(FEET).unwrap();
        assert!(feet[1] < 960.0 && feet[1] > 860.0);
        let (top, _) = c.project([FIGURE[0], FIGURE[3], 0.0]).unwrap();
        assert!(top[1] > 30.0);
    }

    #[test]
    fn every_theme_has_a_look() {
        for code in 0..8 {
            assert_eq!(look(code).light, matches!(code, 1 | 5 | 6));
        }
    }
}
