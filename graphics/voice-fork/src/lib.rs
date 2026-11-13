//! «Камертон»: the hero of Step 3 «Голос».
//!
//! A close portrait: the woman on the left, eyes open, looking up and to the
//! right. Behind her the code rain falls, whole, with no line in it. She
//! draws one long note: her mouth opens and her voice leaves her lips and
//! crosses the whole frame. Every glyph it reaches flares once and comes
//! apart: it breaks into grains that the voice carries away from her, and
//! they drift, settle and fade. While she sings, the air round her is clear.
//! When she falls silent the code is written back, column by column, from
//! the top, as the code rain always writes.
//!
//! Only the woman is a raster (Art's chosen heroine, `assets/figure.png`),
//! with her mouth drawn closed, half open and open (`tools/prepare.py`).
//! The shader passes through the three as she opens it. The rain, its dust
//! and its writing are drawn in `shaders/scene.frag`. Positions are the
//! image's own pixels, y down.

#[cfg(target_arch = "wasm32")]
mod browser;

use watcher_scene_palette::Palette;

/// The image and the frame: 3:2.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// One loop, seamless.
pub const LOOP_SECONDS: f32 = 10.0;
/// The front of her open mouth: the sound leaves here.
pub const MOUTH: [f32; 2] = [576.0, 417.0];
/// Where her mouth and jaw change as she sings, [x0, y0, x1, y1]; the
/// half-open mouth is kept `MOUTH_SHIFT` px to the right of it, in an empty
/// part of the image (`tools/prepare.py` has the same two constants).
pub const MOUTH_BOX: [f32; 4] = [220.0, 340.0, 700.0, 620.0];
pub const MOUTH_SHIFT: f32 = 800.0;

/// The note: when it starts, and how long it sounds.
pub const HUM: f32 = 1.0;
pub const HUM_SECONDS: f32 = 5.0;
const ATTACK: f32 = 0.5;
const RELEASE: f32 = 1.2;
/// The mouth opens this long before the sound.
const ANTICIPATE: f32 = 0.25;
/// How fast the voice crosses the frame, px/s.
pub const SOUND_SPEED: f32 = 760.0;
/// When the voice, loud enough, breaks the code at her lips; everywhere
/// else `distance / SOUND_SPEED` later.
pub const BREAK_AT: f32 = HUM + 0.15;
/// How long a broken glyph's grains drift before the last one fades.
pub const DUST_SECONDS: f32 = 3.0;
/// The code is written back from this moment: each column starts within
/// `WRITE_SPREAD` and runs down at a speed in `WRITE_SPEED`, px/s.
pub const WRITE_AT: f32 = HUM + HUM_SECONDS - 0.2;
pub const WRITE_SPREAD: f32 = 0.5;
pub const WRITE_SPEED: [f32; 2] = [800.0, 1600.0];

/// Her breath: one per loop, in before the note, out along it.
pub const BREATH_SECONDS: f32 = LOOP_SECONDS;
/// The still frame for reduced motion: the voice halfway across the frame,
/// the code broken round her and still whole far off.
pub const STILL: f32 = 1.95;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    /// How loud the note is, 0..1.
    pub hum: f32,
    /// How far her mouth is open, 0 (closed) .. 1 (singing).
    pub mouth: f32,
    /// -1 (out) .. 1 (in).
    pub breath: f32,
    /// The glow in her mouth, 0..1.
    pub lips: f32,
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// The farthest the voice has to go: from her lips to the far corner.
pub fn reach() -> f32 {
    let dx = SIZE[0] - MOUTH[0];
    let dy = SIZE[1] - MOUTH[1];
    dx.hypot(dy)
}

pub fn compose(t: f32) -> Frame {
    let t = t.rem_euclid(LOOP_SECONDS);
    let a = t - HUM;
    let hum = smooth(0.0, ATTACK, a) * (1.0 - smooth(HUM_SECONDS - RELEASE, HUM_SECONDS, a));
    let m = a + ANTICIPATE;
    let mouth = smooth(0.0, 0.45, m) * (1.0 - smooth(HUM_SECONDS - 0.3, HUM_SECONDS + 0.35, m));
    Frame {
        time: t,
        hum,
        mouth,
        breath: (std::f32::consts::TAU * a / BREATH_SECONDS).cos(),
        lips: hum,
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// Her light and the code.
    pub cold: [f32; 3],
    /// The voice: the glow in her mouth.
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
    fn the_loop_starts_in_silence_with_the_code_whole() {
        for t in samples().take_while(|t| *t < HUM - ANTICIPATE) {
            let f = compose(t);
            assert!(f.hum < 1e-4 && f.mouth < 1e-3 && f.lips < 1e-4, "at {t}");
        }
        // Nothing breaks before she sings.
        const { assert!(BREAK_AT > HUM) };
    }

    #[test]
    fn her_mouth_opens_for_the_note() {
        assert!(compose(HUM).mouth > 0.1, "it opens before the sound");
        assert!(compose(HUM + HUM_SECONDS * 0.5).mouth > 0.99);
        assert!(compose(HUM + HUM_SECONDS * 0.5).hum > 0.99);
        assert!(compose(HUM + HUM_SECONDS + 0.5).mouth < 1e-3);
        // The mouth is in its box, and the half-open copy is in the image.
        let [x0, y0, x1, y1] = MOUTH_BOX;
        assert!(MOUTH[0] > x0 && MOUTH[0] < x1 && MOUTH[1] > y0 && MOUTH[1] < y1);
        assert!(x1 + MOUTH_SHIFT <= SIZE[0] && MOUTH_SHIFT >= x1 - x0);
    }

    #[test]
    fn the_air_is_clear_before_the_code_is_written_back() {
        // The voice reaches the far corner while she still sings at full
        // voice, and the last drifting grain fades before the writing
        // starts; only a few glinting motes hang on until the code returns.
        let crossed = BREAK_AT + reach() / SOUND_SPEED;
        assert!(crossed < HUM + HUM_SECONDS - RELEASE);
        assert!(crossed + DUST_SECONDS <= WRITE_AT);
        // The writing starts as her voice fades, not before.
        const { assert!(WRITE_AT > HUM + HUM_SECONDS - RELEASE) };
    }

    #[test]
    fn the_code_is_whole_again_before_the_loop_ends() {
        // The slowest column, starting last, writes past the bottom (and a
        // cell more) with a quiet second to spare.
        let done = WRITE_AT + WRITE_SPREAD + (SIZE[1] + 2.0 * 39.0) / WRITE_SPEED[0];
        assert!(done + 1.0 < LOOP_SECONDS + HUM - ANTICIPATE, "{done}");
        assert!(done < LOOP_SECONDS);
        const { assert!(WRITE_SPEED[0] < WRITE_SPEED[1]) };
    }

    #[test]
    fn the_still_frame_is_the_voice_halfway() {
        let f = compose(STILL);
        assert!(f.hum > 0.95 && f.mouth > 0.99);
        let front = (STILL - BREAK_AT) * SOUND_SPEED;
        assert!(front > 0.3 * reach() && front < 0.7 * reach(), "{front}");
    }

    #[test]
    fn the_loop_closes_and_nothing_jumps() {
        let close = |a: &Frame, b: &Frame| {
            (a.hum - b.hum).abs() < 0.02
                && (a.mouth - b.mouth).abs() < 0.03
                && (a.breath - b.breath).abs() < 0.02
        };
        let end = compose(LOOP_SECONDS - 1e-4);
        assert!(close(&compose(0.0), &end));
        let mut last = compose(0.0);
        for t in samples().skip(1) {
            let f = compose(t);
            assert!(close(&last, &f), "jump at {t}");
            last = f;
        }
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
