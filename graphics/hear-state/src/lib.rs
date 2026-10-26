//! «Услышь своё состояние»: Step 4, page 05/15. A seated, grounded person
//! breathes in and speaks aloud. The voice is born inside, from a state:
//! where it starts in the body, how far the breath reaches, how it trembles,
//! flattens, thins out or repeats. It resonates in the chest, throat and head,
//! the person hears it, and only then the state is noticed and named.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time. The browser adapter only uploads the values and the shaders only
//! paint them.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod geometry;

use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

/// Authored frame, 3 : 2 like the other Step 4 scenes.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// One spoken phrase: inhale, speech, listening, noticing, settle.
pub const PHRASE: f32 = 9.6;
pub const PHRASES: usize = 5;
/// The five states of the page text, one phrase each: a seamless 48 s loop.
pub const LOOP_SECONDS: f32 = PHRASE * PHRASES as f32;
/// Reduced motion holds this moment: a grounded voice, heard and named.
pub const STILL: f32 = 7.0;

/// The page asks: «Есть ли в нём уверенность, тревога, маска, отсутствие,
/// автоматизм?» — in this order.
pub const STATES: [&str; 5] = [
    "УВЕРЕННОСТЬ",
    "ТРЕВОГА",
    "МАСКА",
    "ОТСУТСТВИЕ",
    "АВТОМАТИЗМ",
];
/// Measured ink of each row in `labels.png` (x0, x1), rows are 128 px: the
/// five states, then the question.
pub const LABEL_INK: [[f32; 2]; 6] = [
    [239.0, 778.0],
    [340.0, 677.0],
    [391.0, 626.0],
    [264.0, 752.0],
    [264.0, 753.0],
    [11.0, 1006.0],
];
pub const ATLAS_HEIGHT: f32 = 768.0;
/// Label row band in the atlas (top, bottom); the caps are 44 px tall.
pub const LABEL_ROW: [f32; 2] = [26.0, 98.0];

/// Speed of the voice in the room and of its resonance in the body.
pub const VOICE_SPEED: f32 = 3.0;
pub const BODY_SPEED: f32 = 0.6;

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
/// The shell of the mask in front of the face: center and radii (SVG px).
pub const SHELL: [f32; 4] = [112.0, 70.0, 34.0, 52.0];
/// Where a masked voice leaves: the front of the shell at the lips.
pub const SHELL_FRONT: [f32; 3] = on_figure(146.0, 86.0);
/// Caption row in the atlas, after the five states.
pub const QUESTION: usize = 5;
pub const QUESTION_TEXT: &str = "ИЗ КАКОГО СОСТОЯНИЯ?";
/// The inner axis the breath travels and the voice rises along: nose and
/// lips, throat, chest, belly, pelvis on the seat, thigh, knee, shin, sole.
pub const CHANNEL: [[f32; 2]; 9] = [
    [124.0, 84.0],
    [98.0, 124.0],
    [86.0, 176.0],
    [86.0, 232.0],
    [84.0, 290.0],
    [168.0, 298.0],
    [232.0, 302.0],
    [242.0, 405.0],
    [252.0, 505.0],
];
/// The point `at` (0 = lips … 8 = sole) along the inner axis, in world units.
pub fn channel(at: f32) -> [f32; 3] {
    let at = at.clamp(0.0, (CHANNEL.len() - 1) as f32);
    let i = (at.floor() as usize).min(CHANNEL.len() - 2);
    let t = at - i as f32;
    let [a, b] = [CHANNEL[i], CHANNEL[i + 1]];
    on_figure(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
}

/// How one state sounds and where it lives in the body.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Mood {
    pub syllables: usize,
    pub start: f32,
    pub spacing: f32,
    /// Irregular timing, 0..1 of the spacing.
    pub jitter: f32,
    pub amp: [f32; 2],
    pub length: f32,
    pub loud: f32,
    /// Where the voice starts on the inner axis (0 lips … 3 belly).
    pub source: f32,
    /// How deep the inhale reaches (8 = down to the soles).
    pub depth: f32,
    /// Trembling, a flat clipped mask, a hollow middle, machine repetition.
    pub tremor: f32,
    pub clip: f32,
    pub hollow: f32,
    pub rigid: f32,
    /// How far the voice carries into the room.
    pub reach: f32,
}
pub const MOODS: [Mood; 5] = [
    // Уверенность: from the belly, full breath down to the feet, even.
    Mood {
        syllables: 7,
        start: 1.8,
        spacing: 0.46,
        jitter: 0.08,
        amp: [0.82, 1.0],
        length: 0.34,
        loud: 1.0,
        source: 2.6,
        depth: 8.0,
        tremor: 0.0,
        clip: 0.0,
        hollow: 0.0,
        rigid: 0.0,
        reach: 10.0,
    },
    // Тревога: from the throat, a shallow breath, fast and trembling.
    Mood {
        syllables: 12,
        start: 1.75,
        spacing: 0.26,
        jitter: 0.35,
        amp: [0.35, 0.95],
        length: 0.15,
        loud: 0.85,
        source: 1.0,
        depth: 1.4,
        tremor: 1.0,
        clip: 0.0,
        hollow: 0.0,
        rigid: 0.0,
        reach: 7.0,
    },
    // Маска: made at the face, through a shell; even and flat.
    Mood {
        syllables: 8,
        start: 1.8,
        spacing: 0.4,
        jitter: 0.0,
        amp: [0.7, 0.72],
        length: 0.3,
        loud: 0.75,
        source: 0.35,
        depth: 1.8,
        tremor: 0.0,
        clip: 1.0,
        hollow: 0.0,
        rigid: 0.0,
        reach: 8.0,
    },
    // Отсутствие: barely breathed, faint, with nobody inside.
    Mood {
        syllables: 5,
        start: 2.0,
        spacing: 0.62,
        jitter: 0.25,
        amp: [0.2, 0.36],
        length: 0.3,
        loud: 0.55,
        source: 2.0,
        depth: 0.8,
        tremor: 0.0,
        clip: 0.0,
        hollow: 1.0,
        rigid: 0.0,
        reach: 4.5,
    },
    // Автоматизм: identical syllables on a metronome, from the throat.
    Mood {
        syllables: 9,
        start: 1.8,
        spacing: 0.38,
        jitter: 0.0,
        amp: [0.68, 0.68],
        length: 0.2,
        loud: 0.72,
        source: 1.2,
        depth: 1.6,
        tremor: 0.0,
        clip: 0.0,
        hollow: 0.0,
        rigid: 1.0,
        reach: 8.0,
    },
];

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

/// One spherical front of the voice in the room, or a ring of resonance
/// inside the body.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Wave {
    pub origin: [f32; 3],
    pub radius: f32,
    pub strength: f32,
    pub mood: usize,
    pub inner: bool,
}

/// All motion of one instant.
#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// The state of the current phrase.
    pub mood: usize,
    /// Loudness at the lips, 0..1.
    pub voice: f32,
    /// Phase of the carrier inside the voice (for the ribbon).
    pub carrier: f32,
    pub breath: f32,
    /// The inhale: the light's place on the inner axis and its alpha.
    pub inhale: [f32; 2],
    /// Where the voice starts on the inner axis and how much it glows.
    pub source: [f32; 2],
    /// The voice rising from its source to the lips, 0..1.
    pub rising: f32,
    /// Light in the soles and on the floor: a voice from the ground.
    pub ground: f32,
    /// Hearing oneself: the sound around the head and inside it.
    pub heard: f32,
    pub listening: f32,
    /// The state noticed and named, 0..1.
    pub noticed: f32,
    /// The shell in front of the face (Маска), 0..1.
    pub mask: f32,
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
/// The syllables of one phrase, shaped by its state.
pub fn syllables(phrase: usize) -> Vec<Syllable> {
    let m = &MOODS[phrase % PHRASES];
    (0..m.syllables)
        .map(|j| {
            let seed = (phrase * 31 + j * 7) as u32;
            let shift = (hash(seed + 211) - 0.5) * m.jitter * m.spacing;
            Syllable {
                at: m.start + j as f32 * m.spacing + if j == 0 { 0.0 } else { shift },
                amp: m.amp[0] + (m.amp[1] - m.amp[0]) * hash(seed),
                length: m.length * (0.85 + 0.3 * hash(seed + 101) * (1.0 - m.rigid)),
            }
        })
        .collect()
}
/// Loudness of one phrase at its local time.
pub fn envelope(phrase: usize, local: f32) -> f32 {
    syllables(phrase)
        .iter()
        .map(|s| {
            s.amp
                * bell(
                    local,
                    s.at - 0.05,
                    s.at + 0.06,
                    s.at + s.length * 0.5,
                    s.at + s.length,
                )
        })
        .fold(0.0, f32::max)
        * MOODS[phrase % PHRASES].loud
}
/// Where in time the phrase speaks: (first syllable, end of the last).
pub fn speech(phrase: usize) -> (f32, f32) {
    let s = syllables(phrase);
    let last = s.last().map_or(0.0, |s| s.at + s.length);
    (s[0].at, last)
}

/// Contributions of one phrase whose own clock reads `local` (may exceed the
/// phrase: its voice keeps sounding into the next one).
fn phrase(f: &mut Frame, index: usize, local: f32) {
    let m = &MOODS[index];
    let (first, last) = speech(index);
    for s in syllables(index) {
        let age = local - s.at;
        if age <= 0.0 {
            continue;
        }
        let radius = age * VOICE_SPEED;
        if radius < m.reach {
            let strength =
                s.amp * m.loud * smooth(0.0, 0.2, radius) * (1.0 - radius / m.reach).powf(1.3);
            f.waves.push(Wave {
                origin: if m.clip > 0.5 { SHELL_FRONT } else { MOUTH },
                radius,
                strength,
                mood: index,
                inner: false,
            });
        }
        // The same syllable resonates inside, around its source.
        let inner = age * BODY_SPEED;
        let span = 0.45 + 0.3 * (1.0 - m.hollow);
        if inner < span {
            f.waves.push(Wave {
                origin: channel(m.source),
                radius: inner,
                strength: s.amp * m.loud * (1.0 - inner / span) * smooth(0.0, 0.08, inner),
                mood: index,
                inner: true,
            });
        }
    }
    let speaking = bell(local, first - 0.5, first + 0.2, last, last + 1.0);
    f.source[1] += speaking * m.loud * (1.0 - 0.55 * m.hollow);
    f.rising += speaking;
    f.ground += bell(local, 1.0, 2.2, last + 2.0, last + 3.6) * smooth(3.0, 8.0, m.depth);
    f.inhale[1] += bell(local, 0.1, 0.5, 1.6, 2.3);
    f.listening += bell(local, first + 0.3, first + 1.0, last + 1.2, last + 2.6);
    f.noticed += bell(local, last + 0.9, last + 1.7, 8.4, 9.3);
    f.mask += m.clip * bell(local, 0.7, 1.5, last + 0.8, last + 2.2);
    f.ambient += m.loud * bell(local, first, first + 0.6, last, last + 1.8);
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
    let m = &MOODS[index];
    // The ear hears the lips a moment later.
    let heard = envelope(index, local - 0.12).max(envelope(previous, local + PHRASE - 0.12));
    let mut f = Frame {
        time,
        camera: camera(time, local),
        mood: index,
        voice: envelope(index, local).max(envelope(previous, local + PHRASE)),
        carrier: time * 9.0,
        breath: 0.5 - 0.5 * (local / PHRASE * TAU).cos(),
        inhale: [smooth(0.2, 1.7, local) * m.depth, 0.0],
        source: [m.source, 0.0],
        rising: 0.0,
        ground: 0.0,
        heard,
        listening: 0.0,
        noticed: 0.0,
        mask: 0.0,
        waves: Vec::with_capacity(32),
        ambient: 0.0,
    };
    phrase(&mut f, previous, local + PHRASE);
    phrase(&mut f, index, local);
    for v in [
        &mut f.inhale[1],
        &mut f.source[1],
        &mut f.rising,
        &mut f.ground,
        &mut f.listening,
        &mut f.noticed,
        &mut f.mask,
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
    let push = bell(local, 1.2, 4.6, 6.6, 9.5);
    Camera {
        eye: [
            0.14 * w.sin() + 0.05 * (3.0 * w).sin(),
            1.652 + 0.04 * (2.0 * w).sin(),
            -3.95 + 0.2 * push,
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
                (x.noticed, y.noticed),
                (x.mask, y.mask),
                (x.ground, y.ground),
                (x.source[1], y.source[1]),
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
    fn every_state_speaks_then_is_heard_then_named() {
        for p in 0..PHRASES {
            let (first, last) = speech(p);
            assert!(first > 1.6 && last < 5.8, "phrase {p}: {first}..{last}");
            let at = |local: f32| compose(p as f32 * PHRASE + local);
            assert!(at(first + 0.05).voice > 0.1);
            assert!(at(last + 0.5).listening > 0.5);
            assert!(at(last + 2.2).noticed > 0.95);
            assert!(at(0.05).noticed < 0.05 && at(0.05).voice < 0.05);
        }
    }

    #[test]
    fn states_differ_where_the_text_says() {
        let confident = &MOODS[0];
        // Only a grounded, confident voice reaches the feet.
        assert!(confident.depth > 7.0 && MOODS[1..].iter().all(|m| m.depth < 2.0));
        assert!(compose(STILL).ground > 0.9 && compose(PHRASE + STILL).ground < 0.05);
        // Anxiety is quicker, absence quieter, automatism perfectly even.
        assert!(MOODS[1].spacing < confident.spacing && MOODS[3].loud < 0.6);
        let auto = syllables(4);
        assert!(auto
            .windows(2)
            .all(|w| (w[1].at - w[0].at - MOODS[4].spacing).abs() < 1e-5));
        assert!(auto.iter().all(|s| (s.amp - auto[0].amp).abs() < 1e-5));
        // Only the mask builds the shell.
        assert!(compose(2.0 * PHRASE + 3.0).mask > 0.9 && compose(3.0).mask == 0.0);
    }

    #[test]
    fn values_stay_finite_and_bounded() {
        for i in 0..4800 {
            let f = compose(i as f32 * 0.01);
            for v in [
                f.voice,
                f.heard,
                f.breath,
                f.ambient,
                f.noticed,
                f.mask,
                f.ground,
                f.rising,
                f.listening,
                f.source[1],
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
