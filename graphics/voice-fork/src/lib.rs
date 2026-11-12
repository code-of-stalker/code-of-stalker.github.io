//! «Камертон»: the hero of Step 3 «Голос».
//!
//! A close portrait: the woman on the left, eyes open, looking up and to the
//! right. Behind her the code rain falls, whole, with no line in it. When she
//! sounds a note her mouth opens and the sound leaves her lips in rings that
//! cross the whole frame. Where they pass, all the code answers at once, like
//! sand on a sounding plate: it is shaken off the places that ring and
//! gathers, lit, along the still lines of the note (arcs round her lips and
//! rays out from them). When she falls silent the pattern melts back into the
//! rain. Two notes per loop, the second higher: a finer pattern.
//!
//! Only the woman is a raster (Art's chosen heroine, `assets/figure.png`),
//! with her mouth drawn closed, half open and open (`tools/prepare.py`).
//! The shader passes through the three as she opens it. The rain, the rings, the
//! pattern and its light are drawn in `shaders/scene.frag`. Positions are the
//! image's own pixels, y down.

#[cfg(target_arch = "wasm32")]
mod browser;

use watcher_scene_palette::Palette;

/// The image and the frame: 3:2.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// One loop, seamless.
pub const LOOP_SECONDS: f32 = 12.0;
/// The front of her open mouth: the sound leaves here.
pub const MOUTH: [f32; 2] = [576.0, 417.0];
/// Where her mouth and jaw change as she sings, [x0, y0, x1, y1]; the
/// half-open mouth is kept `MOUTH_SHIFT` px to the right of it, in an empty
/// part of the image (`tools/prepare.py` has the same two constants).
pub const MOUTH_BOX: [f32; 4] = [220.0, 340.0, 700.0, 620.0];
pub const MOUTH_SHIFT: f32 = 800.0;

/// The notes: when each starts, and how long it sounds.
pub const HUMS: [f32; 2] = [0.8, 6.6];
pub const HUM_SECONDS: f32 = 3.6;
const ATTACK: f32 = 0.5;
const RELEASE: f32 = 1.2;
/// The mouth opens this long before the sound.
const ANTICIPATE: f32 = 0.25;
/// The order of the pattern for each note: the second is higher, finer.
pub const MODES: [f32; 2] = [4.0, 6.0];
/// How fast the sound crosses the frame, px/s.
pub const SOUND_SPEED: f32 = 900.0;
/// Rings per second (a whole number per loop); they run at the speed of
/// sound, so they lie `SOUND_SPEED / TREMBLE` apart.
pub const TREMBLE: f32 = 2.5;
/// The pattern gathers this long after a note reaches a place, and melts
/// back into the rain from the note's end over `MELT`.
const GATHER: f32 = 0.9;
const MELT: f32 = 1.4;

/// The voice over the whole loop, for the shader: every place in the frame
/// hears it `distance / SOUND_SPEED` late.
pub const TRACK: usize = 128;

/// Her breath: two per loop, the note on the out-breath.
pub const BREATH_SECONDS: f32 = 6.0;
/// The still frame for reduced motion: the first note at full voice.
pub const STILL: f32 = 2.9;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    /// How loud the note is, 0..1.
    pub hum: f32,
    /// The order of the pattern (glides between notes, never during one).
    pub mode: f32,
    /// The rings' phase, radians.
    pub phase: f32,
    /// How far the code has gathered into the note's pattern, 0..1.
    pub order: f32,
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
/// Seconds since `at`, counted round the loop.
fn since(t: f32, at: f32) -> f32 {
    (t - at).rem_euclid(LOOP_SECONDS)
}

/// The loudness of note `h` at time t.
fn hum_of(h: usize, t: f32) -> f32 {
    let a = since(t, HUMS[h]);
    smooth(0.0, ATTACK, a) * (1.0 - smooth(HUM_SECONDS - RELEASE, HUM_SECONDS, a))
}
/// How far the code at her lips has gathered into note `h`'s pattern.
fn order_of(h: usize, t: f32) -> f32 {
    let a = since(t, HUMS[h]);
    smooth(0.0, GATHER, a) * (1.0 - smooth(HUM_SECONDS - 0.2, HUM_SECONDS + MELT, a))
}
/// How far her mouth is open for note `h`, 0..1.
fn mouth_of(h: usize, t: f32) -> f32 {
    let a = since(t, HUMS[h] - ANTICIPATE);
    smooth(0.0, 0.45, a) * (1.0 - smooth(HUM_SECONDS - 0.3, HUM_SECONDS + 0.35, a))
}

pub fn compose(t: f32) -> Frame {
    let t = t.rem_euclid(LOOP_SECONDS);
    let hum = hum_of(0, t) + hum_of(1, t);
    // Glide to the next note's order in the quiet after each note.
    let first_end = HUMS[0] + HUM_SECONDS + MELT;
    let second_end = HUMS[1] + HUM_SECONDS + MELT;
    let up = smooth(first_end, HUMS[1] - 0.1, t);
    let down = smooth(second_end, LOOP_SECONDS, t);
    let mode = MODES[0] + (MODES[1] - MODES[0]) * (up - down);
    let open = mouth_of(0, t) + mouth_of(1, t);
    Frame {
        time: t,
        hum,
        mode,
        phase: std::f32::consts::TAU * TREMBLE * t,
        order: order_of(0, t) + order_of(1, t),
        mouth: open,
        breath: (std::f32::consts::TAU * (t - HUMS[0]) / BREATH_SECONDS).cos(),
        lips: hum,
    }
}

/// The voice over the loop for the shader: loudness, order, mode, 0 at
/// `TRACK` even steps.
pub fn track() -> [[f32; 4]; TRACK] {
    let mut out = [[0.0; 4]; TRACK];
    for (i, o) in out.iter_mut().enumerate() {
        let f = compose(i as f32 * LOOP_SECONDS / TRACK as f32);
        *o = [f.hum, f.order, f.mode, 0.0];
    }
    out
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
    fn the_loop_starts_in_silence_with_the_rain_whole() {
        for t in samples().take_while(|t| *t < HUMS[0] - ANTICIPATE) {
            let f = compose(t);
            assert!(
                f.hum < 1e-4 && f.order < 1e-4 && f.mouth < 1e-3 && f.lips < 1e-4,
                "at {t}"
            );
        }
        // Between the notes the pattern melts away entirely.
        let f = compose(HUMS[1] - 0.05);
        assert!(f.order < 1e-3 && f.hum < 1e-3);
    }

    #[test]
    fn two_notes_each_one_mode() {
        for (h, at) in HUMS.iter().enumerate() {
            let f = compose(at + HUM_SECONDS * 0.5);
            assert!(f.hum > 0.99, "note {h} at full voice");
            assert!(f.order > 0.99, "the pattern of note {h} gathers");
            assert!((f.mode - MODES[h]).abs() < 1e-3, "mode of note {h}");
            // The mode never moves while the pattern stands.
            for k in 0..40 {
                let t = at + (HUM_SECONDS + MELT) * k as f32 / 40.0;
                assert!((compose(t).mode - MODES[h]).abs() < 1e-3, "mode at {t}");
            }
        }
    }

    #[test]
    fn her_mouth_opens_for_each_note() {
        for at in HUMS {
            assert!(compose(at).mouth > 0.1, "it opens before the sound");
            assert!(compose(at + HUM_SECONDS * 0.5).mouth > 0.99);
            assert!(compose(at + HUM_SECONDS + 0.5).mouth < 1e-3);
        }
        // The mouth is in its box, and the half-open copy is in the image.
        let [x0, y0, x1, y1] = MOUTH_BOX;
        assert!(MOUTH[0] > x0 && MOUTH[0] < x1 && MOUTH[1] > y0 && MOUTH[1] < y1);
        assert!(x1 + MOUTH_SHIFT <= SIZE[0] && MOUTH_SHIFT >= x1 - x0);
    }

    #[test]
    fn the_rings_run_at_the_speed_of_sound() {
        assert!((TREMBLE * LOOP_SECONDS).fract().abs() < 1e-4);
        let gap = SOUND_SPEED / TREMBLE;
        assert!(gap > 200.0 && gap < SIZE[0] / 2.0);
    }

    #[test]
    fn the_track_is_the_voice() {
        let tr = track();
        for (i, s) in tr.iter().enumerate() {
            let f = compose(i as f32 * LOOP_SECONDS / TRACK as f32);
            assert_eq!(*s, [f.hum, f.order, f.mode, 0.0]);
        }
        // Fine enough for the attack: no step jumps more than a third.
        for i in 0..TRACK {
            let (a, b) = (tr[i], tr[(i + 1) % TRACK]);
            assert!((a[0] - b[0]).abs() < 0.34 && (a[1] - b[1]).abs() < 0.34);
        }
    }

    #[test]
    fn the_still_frame_is_full_voice() {
        let f = compose(STILL);
        assert!(f.hum > 0.99 && f.order > 0.99 && f.mouth > 0.99);
        // The sound has crossed the whole frame by then.
        assert!((STILL - HUMS[0]) * SOUND_SPEED > SIZE[0]);
    }

    #[test]
    fn the_loop_closes_and_nothing_jumps() {
        let close = |a: &Frame, b: &Frame| {
            (a.hum - b.hum).abs() < 0.02
                && (a.mode - b.mode).abs() < 0.05
                && (a.order - b.order).abs() < 0.02
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
