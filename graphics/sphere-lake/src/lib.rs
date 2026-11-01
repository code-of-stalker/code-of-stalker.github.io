//! «Тишина воды», page 06 of Step 5 «Внешнее кольцо», the page «Итог». Art's
//! night lake under the stars, a ring of light over the water. At first the
//! lake is stirred four ways (drops, a cross swell, wind ripples, a long
//! swell) and the ring's reflection breaks into glints. Each «Не…» stills
//! one of them; the last leaves a mirror, where the ring and its reflection
//! close into one circle. Then the view settles level on the shore line and
//! the circle sounds once. Every value here is a pure function of loop time;
//! `browser.rs` only uploads it and the shader paints it.
use std::f32::consts::{PI, TAU};
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::SphereLake;

/// The painting, px.
pub const SIZE: [u32; 2] = [1536, 1024];
/// The far shore's waterline, a row of the painting, is the horizon: above
/// it the painting is drawn as it is, below it the water is computed.
pub const SHORE: f32 = 459.5;
/// The painting's focal length, px per unit of tan: about 60° across.
pub const FOCAL: f32 = 1330.0;
pub const LOOP_SECONDS: f32 = 60.0;

/// What stirs the water, in the order the four «Не…» still it.
pub const RAIN: usize = 0;
pub const CROSS: usize = 1;
pub const CHOP: usize = 2;
pub const SWELL: usize = 3;
pub const PARTS: usize = 4;
/// When each «Не…» starts stilling its part, and how long the part takes.
pub const STILL_FROM: [f32; PARTS] = [2.5, 8.5, 14.5, 20.5];
pub const STILL_TAKES: [f32; PARTS] = [2.5, 3.0, 3.0, 4.5];
/// «Просто будь»: the lake is a mirror from here until the wind returns.
pub const MIRROR: f32 = 25.0;
/// The wind comes back and stirs each part again, so the loop closes: the
/// long swell first, the drops last.
pub const RETURN: [[f32; 2]; PARTS] = [[55.0, 60.0], [54.0, 59.5], [53.0, 59.0], [52.0, 58.0]];

/// The view: centre x, centre y and width in painting px. Stirred, it
/// shows the painting as Art framed it; still, it lowers until the shore
/// line runs level across its middle, and leans in while the circle sounds.
pub const VIEW_STIRRED: [f32; 3] = [768.0, 512.0, 1444.0];
pub const VIEW_LEVEL: [f32; 3] = [768.0, SHORE, 1320.0];
pub const LEVEL: [f32; 2] = [31.0, 39.0];
pub const LEAN: f32 = 0.07;
pub const LEAN_IN: [f32; 2] = [40.0, 48.0];
/// Both ease back as the wind returns.
pub const UNLEVEL: [f32; 2] = [51.5, 59.0];
/// While the water is stirred the view is restless: it rolls and drifts,
/// whole cycles a loop. Still, it only breathes. Radians and painting px.
pub const ROLL: f32 = 0.6 * PI / 180.0;
pub const DRIFT: [f32; 2] = [3.0, 4.0];
pub const BREATH: f32 = 2.5;
pub const BREATH_TIMES: f32 = 12.0;

/// The ring over the lake: its centre on the shore line, its radius, px.
/// Only its upper half is in the air; the lower half is its reflection.
pub const RING_CENTRE: [f32; 2] = [768.0, SHORE];
pub const RING_RADIUS: f32 = 225.0;
/// Its glow while the water is stirred; still, it glows fully.
pub const RING_DIM: f32 = 0.55;
/// The circle sounds: light runs from its top and bottom to its sides in
/// `RUN_SECONDS`, then waves of light leave it, px a second.
pub const SOUND: f32 = 42.0;
pub const RUN_SECONDS: f32 = 3.0;
pub const SOUND_WAVES: usize = 2;
pub const SOUND_GAP: f32 = 0.8;
pub const SOUND_SPEED: f32 = 95.0;
pub const SOUND_FADE: f32 = 4.5;

/// Gravity in eye heights a second², a little slowed so the lake moves calmly.
pub const GRAVITY: f32 = 3.0;
/// One wave train: its part, where it travels (radians, 0 away from the
/// viewer, PI toward), wavelength in eye heights, steepness.
pub const TRAINS: [(usize, f32, f32, f32); 12] = [
    (SWELL, 3.05, 0.9, 0.01),
    (SWELL, 3.4, 0.62, 0.008),
    (SWELL, 2.75, 1.3, 0.006),
    (CROSS, 2.35, 0.35, 0.05),
    (CROSS, 0.8, 0.27, 0.04),
    (CHOP, 0.4, 0.085, 0.03),
    (CHOP, 2.1, 0.11, 0.03),
    (CHOP, 4.2, 0.07, 0.025),
    (CHOP, 5.3, 0.13, 0.03),
    (CHOP, 3.6, 0.06, 0.02),
    (CHOP, 1.0, 0.095, 0.025),
    (CHOP, 2.9, 0.15, 0.03),
];
/// Drops: each cell of water this wide (eye heights) gets two drops a
/// period; rings spread from where they land and die down.
pub const RAIN_CELL: f32 = 0.6;
pub const RAIN_PERIOD: f32 = 3.0;
pub const DROP_SPEED: f32 = 0.14;
pub const DROP_LIFE: f32 = 1.4;
pub const DROP_WAVE: f32 = 0.035;
pub const DROP_STEEP: f32 = 0.1;

/// Water: how much it reflects looking straight down, and how much of the
/// painting's own dark water shows through.
pub const F0: f32 = 0.12;
pub const BODY: f32 = 0.7;
/// The light themes print the dark painting as an engraving: its brightest
/// tones above the shore (the 99.7th percentile of luma) are full ink,
/// black is the page.
pub const ENGRAVE_WHITE: f32 = 0.6307;
pub const ENGRAVE_GAMMA: f32 = 0.75;

/// Reduced motion: a mirror, the circle whole, the view level.
pub const STILL: f32 = 40.0;

/// The geometry and timing above as the shader's `u_geo` array.
pub const GEOMETRY: [f32; 28] = [
    SHORE,
    FOCAL,
    SIZE[0] as f32,
    SIZE[1] as f32,
    RING_CENTRE[0],
    RING_CENTRE[1],
    RING_RADIUS,
    RING_DIM,
    RAIN_CELL,
    RAIN_PERIOD,
    DROP_SPEED,
    DROP_LIFE,
    DROP_WAVE,
    DROP_STEEP,
    LOOP_SECONDS,
    RUN_SECONDS,
    SOUND_GAP,
    SOUND_SPEED,
    SOUND_FADE,
    ENGRAVE_WHITE,
    ENGRAVE_GAMMA,
    F0,
    BODY,
    SOUND_WAVES as f32,
    STILL_FROM[RAIN],
    STILL_FROM[RAIN] + STILL_TAKES[RAIN],
    RETURN[RAIN][0],
    RETURN[RAIN][1],
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    /// The view: centre x, centre y and width in painting px, roll.
    pub view: [f32; 4],
    /// How stirred each part is, 1 … 0 still: rain, cross, chop, swell.
    pub stir: [f32; PARTS],
    /// The ring's glow 0..1, and seconds since it began to sound.
    pub ring: [f32; 2],
    /// The loop's phase, 0..TAU, for the stars and the breath.
    pub phase: f32,
}

/// How stirred one part of the water is at loop time `t`.
pub fn stir(part: usize, t: f32) -> f32 {
    let still = smooth(STILL_FROM[part], STILL_FROM[part] + STILL_TAKES[part], t);
    let back = smooth(RETURN[part][0], RETURN[part][1], t);
    (1.0 - still + back).clamp(0.0, 1.0)
}

/// How far the view has settled level on the shore line, 0..1.
pub fn level(t: f32) -> f32 {
    smooth(LEVEL[0], LEVEL[1], t) * (1.0 - smooth(UNLEVEL[0], UNLEVEL[1], t))
}

/// How far it leans in while the circle sounds, 0..1.
pub fn lean(t: f32) -> f32 {
    smooth(LEAN_IN[0], LEAN_IN[1], t) * (1.0 - smooth(UNLEVEL[0], UNLEVEL[1], t))
}

/// The view at loop time `t` with the water stirred `restless` (0..1).
pub fn view(t: f32, restless: f32) -> [f32; 4] {
    let k = level(t);
    let phase = t / LOOP_SECONDS * TAU;
    let width = mix(VIEW_STIRRED[2], VIEW_LEVEL[2], k) * (1.0 - LEAN * lean(t));
    let roll =
        ROLL * restless * (0.6 * (13.0 * phase + 0.3).sin() + 0.4 * (29.0 * phase + 1.1).sin());
    let dx = DRIFT[0] * restless * (11.0 * phase + 0.7).sin();
    let dy =
        DRIFT[1] * restless * (17.0 * phase + 2.0).sin() + BREATH * (BREATH_TIMES * phase).sin();
    [
        mix(VIEW_STIRRED[0], VIEW_LEVEL[0], k) + dx,
        mix(VIEW_STIRRED[1], VIEW_LEVEL[1], k) + dy,
        width,
        roll,
    ]
}

/// The wave trains as the shader's `u_wave`: wavenumber across and ahead,
/// amplitude in eye heights, angular speed. The speed follows deep water,
/// rounded to whole cycles a loop so the loop closes.
pub fn waves() -> [[f32; 4]; 12] {
    TRAINS.map(|(_, direction, length, steep)| {
        let k = TAU / length;
        let cycles = ((GRAVITY * k).sqrt() * LOOP_SECONDS / TAU).round();
        [
            k * direction.sin(),
            k * direction.cos(),
            steep / k,
            cycles * TAU / LOOP_SECONDS,
        ]
    })
}

/// The part each wave train belongs to, as the shader's `u_part`.
pub fn parts() -> [f32; 12] {
    TRAINS.map(|(part, ..)| part as f32)
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let stir = [RAIN, CROSS, CHOP, SWELL].map(|part| stir(part, time));
    let restless = stir.iter().sum::<f32>() / PARTS as f32;
    Frame {
        time,
        view: view(time, restless),
        stir,
        ring: [RING_DIM + (1.0 - RING_DIM) * (1.0 - restless), time - SOUND],
        phase: time / LOOP_SECONDS * TAU,
    }
}

/// How one theme prints the scene: dark themes keep the painting's own
/// green, which the theme's recolor maps; light themes engrave it on the
/// page in two muted inks, the brightest tones deepest.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub light: bool,
    /// The light the ring and the drops add, in the painting's own green.
    pub glow: [f32; 3],
    pub deep: [f32; 3],
    pub mid: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}
const GREEN: [f32; 3] = [0.56, 1.0, 0.62];
/// Where the middle ink sits on the way from full ink to the page.
const MID_AT: f32 = 0.45;
const LUMA: [f32; 3] = [0.2126, 0.7152, 0.0722];

/// The app theme by its `graphicsPalette` code (0 Искра … 6 Рассвет).
/// The light inks are the Step 5 hero's: one print across the step.
pub fn look(code: u32) -> Look {
    let print = |deep, mid| Look {
        light: true,
        glow: GREEN,
        deep,
        mid,
    };
    match Palette::from_code(code) {
        // Дюна: soft sepia, never orange.
        Palette::Light => print(rgb(110, 52, 18), rgb(162, 98, 52)),
        // Мираж: navy text ink, then cobalt dulled toward lilac.
        Palette::Mirage => print(rgb(38, 59, 107), rgb(93, 97, 162)),
        // Рассвет: plum text ink, then wine dulled toward copper.
        Palette::Dawn => print(rgb(96, 51, 70), rgb(140, 84, 79)),
        _ => Look {
            light: false,
            glow: GREEN,
            deep: [0.0; 3],
            mid: [0.0; 3],
        },
    }
}

/// One pixel of the dark scene engraved on `page`, as the shader's
/// `engrave` does it.
pub fn engrave(look: &Look, page: [f32; 3], dark: [f32; 3]) -> [f32; 3] {
    let level: f32 = (0..3).map(|i| dark[i] * LUMA[i]).sum();
    let g = (level / ENGRAVE_WHITE).clamp(0.0, 1.0).powf(ENGRAVE_GAMMA);
    let t = 1.0 - g;
    [0, 1, 2].map(|i| {
        let ink = if t < MID_AT {
            mix(look.deep[i], look.mid[i], t / MID_AT)
        } else {
            mix(look.mid[i], page[i], (t - MID_AT) / (1.0 - MID_AT))
        };
        ink.min(page[i])
    })
}

fn mix(a: f32, b: f32, t: f32) -> f32 {
    a * (1.0 - t) + b * t
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    #[test]
    fn the_loop_closes_without_a_jump() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        let before = compose(LOOP_SECONDS - 0.001);
        let after = compose(0.001);
        assert!((0..4).all(|i| close(before.view[i], after.view[i], 2e-2)));
        assert!((0..PARTS).all(|i| close(before.stir[i], after.stir[i], 1e-4)));
        assert!(close(before.ring[0], after.ring[0], 1e-4));
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
    }

    #[test]
    fn each_not_stills_its_own_part_before_the_next() {
        for part in 0..PARTS {
            let from = STILL_FROM[part];
            let done = from + STILL_TAKES[part];
            assert_eq!(stir(part, from - 0.01), 1.0, "{part}");
            assert_eq!(stir(part, done), 0.0, "{part}");
            // The parts after it are still stirred while it settles.
            for later in part + 1..PARTS {
                assert_eq!(stir(later, done), 1.0, "{part} {later}");
            }
            if part + 1 < PARTS {
                assert!(done <= STILL_FROM[part + 1]);
            }
        }
        // The rings of the last drops have died down before the mirror.
        const { assert!(STILL_FROM[RAIN] + STILL_TAKES[RAIN] + 2.0 * RAIN_PERIOD <= MIRROR) };
        assert_eq!(STILL_FROM[SWELL] + STILL_TAKES[SWELL], MIRROR);
    }

    #[test]
    fn the_lake_only_calms_until_the_wind_returns() {
        let back = RETURN.iter().map(|r| r[0]).fold(f32::MAX, f32::min);
        let mut last = f32::MAX;
        for i in 0..=6000 {
            let t = i as f32 * 0.01;
            let f = compose(t);
            let total: f32 = f.stir.iter().sum();
            if t < back {
                assert!(total <= last + 1e-6, "{t}");
            }
            if (MIRROR..back).contains(&t) {
                assert_eq!(total, 0.0, "{t}");
                assert_eq!(f.ring[0], 1.0);
            }
            last = total;
        }
    }

    #[test]
    fn the_view_stays_on_the_painting_and_moves_gently() {
        // A 3:2 frame: every point above the shore lies on the painting.
        let mut last = compose(0.0).view;
        for i in 0..=6000 {
            let v = compose(i as f32 * 0.01).view;
            let (c, s) = (v[3].cos(), v[3].sin());
            for j in 0..=20 {
                for m in 0..=20 {
                    let x = (j as f32 / 20.0 - 0.5) * v[2];
                    let y = (m as f32 / 20.0 - 0.5) * v[2] / 1.5;
                    let p = [v[0] + c * x - s * y, v[1] + s * x + c * y];
                    if p[1] < SHORE {
                        assert!(p[1] >= 0.0, "{i} {p:?}");
                        assert!(p[0] >= 0.0 && p[0] <= SIZE[0] as f32, "{i} {p:?}");
                    }
                }
            }
            // Never more than 3 px a frame at 100 frames a second.
            assert!((0..3).all(|k| (v[k] - last[k]).abs() < 3.0), "{i}");
            assert!((v[3] - last[3]).abs() < 3e-4, "{i}");
            last = v;
        }
    }

    #[test]
    fn still_the_shore_runs_level_through_the_middle() {
        for i in 0..=100 {
            let t = LEVEL[1] + (UNLEVEL[0] - LEVEL[1]) * i as f32 / 100.0;
            let v = compose(t).view;
            assert_eq!(v[3], 0.0, "{t}");
            assert!(close(v[1], SHORE, BREATH + 1e-4), "{t}");
            assert!(close(v[0], RING_CENTRE[0], 1e-4));
        }
    }

    #[test]
    fn the_whole_circle_fits_the_level_view() {
        // Leaned in the most, the circle and its reflection keep a margin.
        let v = compose(LEAN_IN[1]).view;
        let half = [v[2] / 2.0, v[2] / 3.0];
        assert!(RING_RADIUS < 0.6 * half[1], "{half:?}");
        assert!(RING_RADIUS < 0.6 * half[0]);
        // The sound has faded before the wind returns.
        let last = SOUND + RUN_SECONDS + (SOUND_WAVES - 1) as f32 * SOUND_GAP + SOUND_FADE;
        assert!(last <= RETURN.iter().map(|r| r[0]).fold(f32::MAX, f32::min));
        const { assert!(SOUND > LEVEL[1]) };
    }

    #[test]
    fn the_waves_close_the_loop_and_stay_gentle() {
        let mut steep = 0.0;
        for (i, w) in waves().iter().enumerate() {
            let cycles = w[3] * LOOP_SECONDS / TAU;
            assert!(close(cycles, cycles.round(), 1e-3) && cycles >= 1.0, "{i}");
            let k = (w[0] * w[0] + w[1] * w[1]).sqrt();
            assert!(close(k * w[2], TRAINS[i].3, 1e-6));
            steep += k * w[2];
        }
        // Even where every crest meets, the water tilts less than 30°.
        assert!(steep + DROP_STEEP < 0.55, "{steep}");
        assert!(parts().iter().all(|p| (*p as usize) < PARTS));
        // Each part has a wave train but the drops, which the shader rains.
        for part in [CROSS, CHOP, SWELL] {
            assert!(TRAINS.iter().any(|t| t.0 == part));
        }
        assert!(TRAINS.iter().all(|t| t.0 != RAIN));
        const { assert!(LOOP_SECONDS % RAIN_PERIOD == 0.0) };
    }

    #[test]
    fn the_still_is_a_mirror_with_the_circle_whole() {
        let f = compose(STILL);
        assert_eq!(f.stir, [0.0; PARTS]);
        assert_eq!(level(STILL), 1.0);
        assert_eq!(f.ring[0], 1.0);
        assert!(f.ring[1] < 0.0);
    }

    #[test]
    fn every_theme_has_a_look() {
        for code in 0..7 {
            let l = look(code);
            assert_eq!(l.light, Palette::from_code(code).is_light());
            assert!(l.glow.iter().all(|c| (0.0..=1.0).contains(c)));
        }
        assert!(!look(255).light);
    }

    #[test]
    fn the_engraving_keeps_the_page_and_never_outshines_it() {
        let pages = [
            (1, [250, 225, 143]),
            (5, [241, 223, 184]),
            (6, [243, 216, 199]),
        ];
        for (code, page) in pages {
            let page = page.map(|c| c as f32 / 255.0);
            let l = look(code);
            assert_eq!(engrave(&l, page, [0.0; 3]), page);
            let mut last = f32::MAX;
            for step in 0..=20 {
                let v = step as f32 / 20.0;
                let ink = engrave(&l, page, [v * 0.4, v, v * 0.5]);
                assert!((0..3).all(|i| ink[i] <= page[i]), "{code} {v}");
                let level: f32 = (0..3).map(|i| ink[i] * LUMA[i]).sum();
                assert!(level <= last + 1e-5, "{code} {v}");
                last = level;
            }
            assert_eq!(engrave(&l, page, [1.0; 3]), l.deep);
        }
    }
}
