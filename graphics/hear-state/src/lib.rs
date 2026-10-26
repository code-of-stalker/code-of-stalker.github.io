//! «Услышь своё состояние»: Step 4, page 05/15. A seated person speaks; the
//! voice travels through a deep room as spherical wavefronts, touches the
//! state it comes from, and the echo returns to the one who listens.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time: the camera, syllables, wavefronts, echoes, plates and light. The
//! browser adapter only uploads the values and the shaders only paint them.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod geometry;

use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

/// Authored frame, 3 : 2 like the other Step 4 scenes.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// One spoken phrase: inhale, speech, resonance, echo, being heard, settle.
pub const PHRASE: f32 = 9.6;
pub const PHRASES: usize = 5;
/// Five phrases, each answered by another state: a seamless 48-second loop.
pub const LOOP_SECONDS: f32 = PHRASE * PHRASES as f32;
/// Reduced motion shows this moment: the voice has found its state.
pub const STILL: f32 = PHRASE + 4.9;

pub const STATES: [&str; 5] = [
    "УВЕРЕННОСТЬ",
    "ТРЕВОГА",
    "МАСКА",
    "ОТСУТСТВИЕ",
    "АВТОМАТИЗМ",
];
/// Which state answers each phrase: near and far alternate.
pub const ORDER: [usize; PHRASES] = [2, 0, 3, 1, 4];
/// Measured ink of each label row in `labels.png` (x0, x1), rows are 128 px.
pub const LABEL_INK: [[f32; 2]; 5] = [
    [239.0, 778.0],
    [340.0, 677.0],
    [391.0, 626.0],
    [264.0, 752.0],
    [264.0, 753.0],
];
/// Label row band in the atlas (top, bottom) and its cap height in px.
pub const LABEL_ROW: [f32; 2] = [26.0, 98.0];

/// Speed of the voice and of its echo, world units per second.
pub const VOICE_SPEED: f32 = 3.0;
pub const ECHO_SPEED: f32 = 3.6;
/// Wavefronts fade out by this radius.
pub const REACH: f32 = 11.0;

/// The approved seated figure stands on the plane z = 0, feet on the floor.
/// Its rectangle in world units: x0, y0 (floor), width, height.
pub const FIGURE: [f32; 4] = [-2.512, 0.0, 2.176, 3.44];
/// Source SVG size, for anatomical points measured on it.
const FIGURE_SVG: [f32; 2] = [335.0, 530.0];
const fn on_figure(x: f32, y: f32) -> [f32; 3] {
    [
        FIGURE[0] + x / FIGURE_SVG[0] * FIGURE[2],
        FIGURE[1] + (1.0 - y / FIGURE_SVG[1]) * FIGURE[3],
        0.0,
    ]
}
pub const MOUTH: [f32; 3] = on_figure(130.0, 87.0);
pub const EAR: [f32; 3] = on_figure(78.0, 50.0);
pub const CHEST: [f32; 3] = on_figure(96.0, 175.0);
pub const FEET: [f32; 3] = on_figure(262.0, 518.0);

/// World centers of the five state plates (same order as `STATES`).
pub const PLATES: [[f32; 3]; 5] = [
    [0.74, 4.33, 2.6],
    [5.17, 2.26, 5.2],
    [0.49, 1.62, 1.3],
    [2.98, 0.59, 3.6],
    [4.68, 4.62, 4.8],
];
/// Plate size in world units.
pub const PLATE_SIZE: [f32; 2] = [1.86, 0.42];

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

/// One spherical front: the voice (from the mouth) or its echo (from a state).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Wave {
    pub origin: [f32; 3],
    pub radius: f32,
    pub strength: f32,
    pub echo: bool,
}

/// All motion of one instant.
#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// Loudness at the mouth, 0..1.
    pub voice: f32,
    /// Phase of the carrier inside the voice (for the ribbon).
    pub carrier: f32,
    pub breath: f32,
    /// The echo has reached the ear: the person hears their state.
    pub heard: f32,
    pub plates: [f32; 5],
    /// A light line crossing the answering plate, 0..1 position, alpha.
    pub scan: [f32; 3],
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
fn distance(a: [f32; 3], b: [f32; 3]) -> f32 {
    ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt()
}

#[derive(Clone, Copy, Debug)]
pub struct Syllable {
    pub at: f32,
    pub amp: f32,
    pub length: f32,
}
pub const SYLLABLES: usize = 8;
/// A phrase of eight syllables between 1.7 s and 5.1 s, different each time.
pub fn syllables(phrase: usize) -> [Syllable; SYLLABLES] {
    let mut at = 1.7;
    std::array::from_fn(|j| {
        let seed = (phrase * 31 + j * 7) as u32;
        let s = Syllable {
            at,
            amp: if j == 0 { 1.0 } else { 0.42 + 0.5 * hash(seed) },
            length: 0.2 + 0.14 * hash(seed + 101),
        };
        // A short pause splits the phrase in two words.
        at += 0.34 + 0.14 * hash(seed + 211) + if j == 3 { 0.32 } else { 0.0 };
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
                    s.at + 0.07,
                    s.at + s.length * 0.5,
                    s.at + s.length,
                )
        })
        .fold(0.0, f32::max)
}
/// When the first voice front reaches the state and when its echo leaves.
pub fn echo_times(phrase: usize) -> (f32, f32, f32) {
    let plate = PLATES[ORDER[phrase]];
    let first = syllables(phrase)[0].at;
    let hit = first + distance(plate, MOUTH) / VOICE_SPEED;
    let leave = hit + 0.35;
    let arrive = leave + distance(plate, EAR) / ECHO_SPEED;
    (hit, leave, arrive)
}

/// Contributions of one phrase whose own clock reads `local` (may exceed the
/// phrase: a phrase keeps sounding into the next one).
fn phrase(f: &mut Frame, index: usize, local: f32) {
    let target = ORDER[index];
    for s in syllables(index) {
        let age = local - s.at;
        let radius = age * VOICE_SPEED;
        if age > 0.0 && radius < REACH {
            let strength = s.amp * smooth(0.0, 0.25, radius) * (1.0 - radius / REACH).powf(1.4);
            f.waves.push(Wave {
                origin: MOUTH,
                radius,
                strength,
                echo: false,
            });
            // Every plate brightens as the front crosses it; the answering
            // state rings fully.
            for (i, plate) in PLATES.iter().enumerate() {
                let miss = (radius - distance(*plate, MOUTH)) / 0.45;
                let gain = if i == target { 1.0 } else { 0.32 };
                f.plates[i] += gain * s.amp * (-miss * miss).exp() * (1.0 - radius / REACH);
            }
        }
    }
    let (hit, leave, arrive) = echo_times(index);
    let resonance = bell(local, hit, hit + 0.5, 8.0, 9.3);
    f.plates[target] = f.plates[target].max(0.85 * resonance);
    if local > hit && local < hit + 1.6 {
        let p = (local - hit) / 1.6;
        f.scan = [p, 1.0, (std::f32::consts::PI * p).sin()];
    }
    let age = local - leave;
    let back = distance(PLATES[target], EAR);
    let radius = age * ECHO_SPEED;
    if age > 0.0 && radius < back + 1.2 {
        f.waves.push(Wave {
            origin: PLATES[target],
            radius,
            strength: 0.9 * smooth(0.0, 0.3, radius) * (1.0 - smooth(back, back + 1.2, radius)),
            echo: true,
        });
    }
    f.heard += bell(local, arrive - 0.15, arrive + 0.6, 7.9, 9.4);
    f.ambient += 0.5 * bell(local, 1.6, 2.4, 5.0, 7.0);
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
    let mut f = Frame {
        time,
        camera: camera(time, local),
        voice: envelope(index, local),
        carrier: time * 9.0,
        breath: 0.5 - 0.5 * (local / PHRASE * TAU).cos(),
        heard: 0.0,
        plates: [0.0; 5],
        scan: [0.0; 3],
        waves: Vec::with_capacity(2 * SYLLABLES + 2),
        ambient: 0.0,
    };
    phrase(&mut f, previous, local + PHRASE);
    phrase(&mut f, index, local);
    f.heard = f.heard.min(1.0);
    f.ambient = f.ambient.min(1.0);
    for p in &mut f.plates {
        *p = p.min(1.0);
    }
    f
}

/// A slow drift and a gentle dolly towards the voice while it sounds.
/// Every term is periodic in the loop, so the seam is invisible.
pub fn camera(time: f32, local: f32) -> Camera {
    let w = time / LOOP_SECONDS * TAU;
    let push = bell(local, 1.2, 4.6, 6.6, 9.5);
    Camera {
        eye: [
            0.16 * w.sin() + 0.05 * (3.0 * w).sin(),
            1.87 + 0.05 * (2.0 * w).sin(),
            -4.0 + 0.22 * push,
        ],
        focal: 1000.0,
        center: [SIZE[0] * 0.5, SIZE[1] * 0.5],
    }
}

/// Colors for the composite pass: the page, the voice ink, the ink of the
/// self (figure contour, being heard), the figure's body and the haze.
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
        let a = compose(0.0);
        let b = compose(LOOP_SECONDS);
        assert_eq!(a, b);
        // Phrase boundaries are continuous too: values just before and after.
        for k in 1..=PHRASES {
            let t = k as f32 * PHRASE;
            let (x, y) = (compose(t - 0.002), compose(t + 0.002));
            assert!((x.voice - y.voice).abs() < 0.02);
            assert!((x.heard - y.heard).abs() < 0.02, "heard at {t}");
            assert!((x.ambient - y.ambient).abs() < 0.02);
            for i in 0..5 {
                assert!((x.plates[i] - y.plates[i]).abs() < 0.03, "plate {i} at {t}");
            }
            for e in 0..3 {
                assert!((x.camera.eye[e] - y.camera.eye[e]).abs() < 0.002);
            }
        }
    }

    #[test]
    fn every_echo_is_heard_inside_its_phrase() {
        for (p, target) in ORDER.iter().enumerate() {
            let (hit, leave, arrive) = echo_times(p);
            assert!(
                hit > 1.7 && leave > hit && arrive < 7.6,
                "phrase {p}: {arrive}"
            );
            // The answering state rings while the person hears it.
            let f = compose(p as f32 * PHRASE + arrive + 0.7);
            assert!(f.heard > 0.9 && f.plates[*target] > 0.8);
        }
    }

    #[test]
    fn values_stay_finite_and_bounded() {
        for i in 0..4800 {
            let f = compose(i as f32 * 0.01);
            for v in [f.voice, f.heard, f.breath, f.ambient]
                .into_iter()
                .chain(f.plates)
            {
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
        assert!(mouth[0] > 250.0 && mouth[0] < 500.0 && mouth[1] > 150.0 && mouth[1] < 400.0);
        let (feet, _) = c.project(FEET).unwrap();
        assert!(feet[1] < SIZE[1] && feet[1] > 900.0);
        for p in PLATES {
            let (at, s) = c.project(p).unwrap();
            let half = PLATE_SIZE[0] * s * 0.5;
            assert!(
                at[0] - half > 600.0 && at[0] + half < SIZE[0] - 60.0,
                "{p:?}"
            );
            assert!(at[1] > 110.0 && at[1] < SIZE[1] - 200.0, "{p:?}");
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
