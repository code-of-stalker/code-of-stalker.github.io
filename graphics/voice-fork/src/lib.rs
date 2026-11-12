//! «Камертон»: the hero of Step 3 «Голос».
//!
//! A close portrait: the woman on the left, eyes open, looking up and to the
//! right. Behind her the code rain falls. When she hums, a string of light
//! leaves her lips and runs out to the right edge; it trembles
//! as a standing wave, its envelope drawn like a long exposure, and the code
//! rain parts round it into an open channel. Bright knots run along the
//! string. Between hums she breathes in, the string quietens and the channel
//! narrows, never quite closing. Two hums per loop, the second a higher mode.
//!
//! Only the woman is a raster (Art's chosen heroine, `assets/figure.png`);
//! the rain, the channel, the string and its light are drawn here and in
//! `shaders/scene.frag`. Positions are the image's own pixels, y down.

#[cfg(target_arch = "wasm32")]
mod browser;

use watcher_scene_palette::Palette;

/// The image and the frame: 3:2.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// One loop, seamless.
pub const LOOP_SECONDS: f32 = 12.0;
/// Where her lips meet, at the edge of her profile: the voice leaves here.
pub const MOUTH: [f32; 2] = [588.0, 401.0];
/// The height of the channel's axis at the right side of the frame: the
/// voice rises a little, the way she looks.
pub const AXIS_Y: f32 = 372.0;
/// How gently the string bends from the lips onto the axis, px.
pub const RISE: f32 = 260.0;
/// Where the channel starts and where it is fully open.
pub const REACH: [f32; 2] = [628.0, 1080.0];
/// Half-width of the channel: resting and while she hums.
pub const OPEN: [f32; 2] = [46.0, 112.0];
/// The string's length for its standing wave: a node at the lips.
pub const SPAN: f32 = 1000.0;
/// Half the height of the trembling envelope: resting and full voice, px.
pub const SWING: [f32; 2] = [2.5, 30.0];
/// The string's trembling: cycles per second (a whole number per loop).
pub const TREMBLE: f32 = 2.5;

/// The hums: when each starts, and how long it sounds.
pub const HUMS: [f32; 2] = [0.8, 6.8];
pub const HUM_SECONDS: f32 = 3.6;
const ATTACK: f32 = 0.5;
const RELEASE: f32 = 1.2;
/// Lobes along the string for each hum: the second is higher.
pub const MODES: [f32; 2] = [4.0, 6.0];
/// How fast the sound runs along the string at the start of a hum, px/s.
pub const FRONT_SPEED: f32 = 900.0;

/// Knots of light that run along the string: two per hum.
pub const PULSES: usize = 4;
const PULSE_AFTER: [f32; 2] = [0.0, 1.5];
pub const PULSE_SPEED: f32 = 480.0;
const PULSE_LIFE: f32 = 2.6;

/// Her breath: two per loop, the hum on the out-breath.
pub const BREATH_SECONDS: f32 = 6.0;
/// The still frame for reduced motion: the first hum at full voice.
pub const STILL: f32 = 2.9;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    /// How loud the hum is, 0..1.
    pub hum: f32,
    /// Lobes of the standing wave (glides between hums, never during one).
    pub mode: f32,
    /// The string's phase, radians.
    pub phase: f32,
    /// The channel's half-width where it is fully open, px.
    pub open: f32,
    /// How far along the string the current hum has reached, px.
    pub front: f32,
    /// Half the height of the trembling envelope, px.
    pub swing: f32,
    /// -1 (out) .. 1 (in).
    pub breath: f32,
    /// The glow at her lips, 0..1.
    pub lips: f32,
    /// Knots on the string: px along it from the lips, strength.
    pub pulses: [[f32; 2]; PULSES],
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
fn mix(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}
/// Seconds since `at`, counted round the loop.
fn since(t: f32, at: f32) -> f32 {
    (t - at).rem_euclid(LOOP_SECONDS)
}

/// The string's resting line: y at x (image px).
pub fn axis_y(x: f32) -> f32 {
    let s = (x - MOUTH[0]).max(0.0);
    AXIS_Y + (MOUTH[1] - AXIS_Y) * (-s / RISE).exp()
}
/// How open the channel is at x, 0..1 of `open`.
pub fn reach(x: f32) -> f32 {
    smooth(REACH[0], REACH[1], x)
}

/// The loudness of hum `h` at time t.
fn hum_of(h: usize, t: f32) -> f32 {
    let a = since(t, HUMS[h]);
    smooth(0.0, ATTACK, a) * (1.0 - smooth(HUM_SECONDS - RELEASE, HUM_SECONDS, a))
}
/// The channel follows the voice slowly: it opens over a second and a half
/// and closes over three.
fn part_of(h: usize, t: f32) -> f32 {
    let a = since(t, HUMS[h]);
    smooth(0.2, 1.7, a) * (1.0 - smooth(HUM_SECONDS - 0.6, HUM_SECONDS + 2.4, a))
}

pub fn compose(t: f32) -> Frame {
    let t = t.rem_euclid(LOOP_SECONDS);
    let hum = hum_of(0, t) + hum_of(1, t);
    let part = (part_of(0, t) + part_of(1, t)).min(1.0);
    // Glide to the next hum's mode in the quiet after each hum.
    let first_end = HUMS[0] + HUM_SECONDS + 0.2;
    let second_end = HUMS[1] + HUM_SECONDS + 0.2;
    let up = smooth(first_end, first_end + 2.0, t);
    let down = smooth(second_end, LOOP_SECONDS, t);
    let mode = MODES[0] + (MODES[1] - MODES[0]) * (up - down);
    let current = if since(t, HUMS[1]) < since(t, HUMS[0]) {
        1
    } else {
        0
    };
    let front = since(t, HUMS[current]) * FRONT_SPEED;
    let mut pulses = [[0.0; 2]; PULSES];
    for (k, p) in pulses.iter_mut().enumerate() {
        let age = since(t, HUMS[k / 2] + PULSE_AFTER[k % 2]);
        if age < PULSE_LIFE {
            let strength = smooth(0.0, 0.15, age) * (1.0 - smooth(1.6, PULSE_LIFE, age));
            *p = [age * PULSE_SPEED, strength];
        }
    }
    Frame {
        time: t,
        hum,
        mode,
        phase: std::f32::consts::TAU * TREMBLE * t,
        open: mix(OPEN[0], OPEN[1], part),
        front,
        swing: mix(SWING[0], SWING[1], hum),
        breath: (std::f32::consts::TAU * (t - HUMS[0]) / BREATH_SECONDS).cos(),
        lips: 0.25 + 0.75 * hum,
        pulses,
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// Her light and the code.
    pub cold: [f32; 3],
    /// The voice: the lips, the string's knots.
    pub warm: [f32; 3],
    /// White-hot cores.
    pub pale: [f32; 3],
}
const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}
/// The theme's colours by its `graphicsPalette` code. Retired light codes
/// fall back to Тишина.
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

    fn samples() -> impl Iterator<Item = f32> {
        (0..2400).map(|i| i as f32 * LOOP_SECONDS / 2400.0)
    }

    #[test]
    fn the_string_leaves_the_lips_and_settles_on_the_axis() {
        assert!((axis_y(MOUTH[0]) - MOUTH[1]).abs() < 1e-3);
        assert!((axis_y(SIZE[0]) - AXIS_Y).abs() < 1.0);
        // It rises steadily, never dips below the lips.
        let mut last = MOUTH[1];
        for x in (MOUTH[0] as i32..SIZE[0] as i32).step_by(8) {
            let y = axis_y(x as f32);
            assert!(y <= last + 1e-3);
            last = y;
        }
    }

    #[test]
    fn two_hums_each_one_mode() {
        for (h, at) in HUMS.iter().enumerate() {
            let f = compose(at + HUM_SECONDS * 0.5);
            assert!(f.hum > 0.99, "hum {h} at full voice");
            assert!((f.mode - MODES[h]).abs() < 1e-3, "mode of hum {h}");
            // The mode never moves while she hums.
            for k in 0..20 {
                let g = compose(at + HUM_SECONDS * k as f32 / 20.0);
                assert!((g.mode - MODES[h]).abs() < 1e-3);
            }
        }
        // Silence between hums.
        assert!(compose(HUMS[0] + HUM_SECONDS + 0.5).hum < 1e-3);
        assert!(compose(HUMS[1] - 0.2).hum < 1e-3);
    }

    #[test]
    fn the_channel_opens_with_the_voice_and_never_closes() {
        for t in samples() {
            let f = compose(t);
            assert!(f.open >= OPEN[0] - 1e-3 && f.open <= OPEN[1] + 1e-3);
        }
        assert!(compose(HUMS[0] + 2.5).open > OPEN[1] - 2.0);
        assert!(compose(HUMS[1] - 0.1).open < OPEN[0] + 8.0);
    }

    #[test]
    fn knots_run_out_from_the_lips() {
        for (k, after) in [0.0, 1.5, 0.0, 1.5].iter().enumerate() {
            let start = HUMS[k / 2] + after;
            let a = compose(start + 0.3).pulses[k];
            let b = compose(start + 1.3).pulses[k];
            assert!(a[1] > 0.5 && b[1] > 0.5, "knot {k} is lit");
            assert!(b[0] > a[0] + 400.0, "knot {k} runs outward");
        }
    }

    #[test]
    fn the_still_frame_is_full_voice() {
        let f = compose(STILL);
        assert!(f.hum > 0.99);
        assert!(f.open > OPEN[1] - 4.0);
        assert!(f.front > SIZE[0]);
    }

    #[test]
    fn the_loop_closes_and_nothing_jumps() {
        let close = |a: &Frame, b: &Frame, k: f32| {
            (a.hum - b.hum).abs() < 0.02 * k
                && (a.mode - b.mode).abs() < 0.02 * k
                && (a.open - b.open).abs() < 0.5 * k
                && (a.swing - b.swing).abs() < 0.6 * k
                && (a.breath - b.breath).abs() < 0.02 * k
        };
        let end = compose(LOOP_SECONDS - 1e-4);
        assert!(close(&compose(0.0), &end, 1.0));
        let mut last = compose(0.0);
        for t in samples().skip(1) {
            let f = compose(t);
            assert!(close(&last, &f, 1.0), "jump at {t}");
            last = f;
        }
        // The tremble closes too: a whole number of cycles per loop.
        assert!((TREMBLE * LOOP_SECONDS).fract().abs() < 1e-4);
    }

    #[test]
    fn the_themes_differ() {
        let all = [0, 2, 3, 4].map(look);
        for i in 0..all.len() {
            for j in i + 1..all.len() {
                assert_ne!(all[i], all[j]);
            }
        }
        assert_eq!(look(1), look(2));
    }
}
