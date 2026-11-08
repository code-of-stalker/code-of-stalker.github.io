//! «Ночной город»: Step 7 pages 06–10. A walker on the wet pavement of a
//! night street, in the rain, under the lamps; the camera works in levels,
//! from his eyes over his shoulder to a crane high over the block.
//!
//! The pure core lives here and in `story.rs`: the street's plan, the
//! chapters' timing, the camera and the figure, all as numbers the shaders
//! read. `browser.rs` only binds them to WebGL2. Metres; the street runs
//! along +z, its middle is x = 0, up is +y; the walker goes along +z on the
//! pavement at x = `WALK_X`, so his left (+x) is the carriageway and his
//! right the shop windows.
pub mod body;
pub mod math;
pub mod story;

#[cfg(target_arch = "wasm32")]
mod browser;

pub use story::{Frame, Story};
use watcher_scene_palette::Palette;

/// Half the carriageway's width.
pub const ROAD: f32 = 3.2;
/// The carriageway lies this far below the pavement.
pub const CURB: f32 = 0.14;
/// The building line, either side.
pub const FACADE: f32 = 6.0;
/// Where the walker goes.
pub const WALK_X: f32 = -4.3;
/// One lot along the street; every fifth cell, the one with
/// `cell mod 5 == CROSS`, is a cross street.
pub const CELL: f32 = 8.16;
pub const CROSS: i32 = 2;
/// From one cross street to the next.
pub const BLOCK: f32 = 5.0 * CELL;
/// The street lamps: one every `LAMP_GAP` on either side (the far side's
/// halfway between), the pole at |x| `LAMP_POLE`, the head over the road.
pub const LAMP_GAP: f32 = 13.6;
pub const LAMP_POLE: f32 = 3.45;
pub const LAMP_HEAD: [f32; 2] = [2.75, 5.35];
/// The tall towers behind the street stand one per `TOWER_CELL`.
pub const TOWER_CELL: f32 = BLOCK / 2.0;

/// One loop of page 06: 120 steps of `STRIDE`, so the walker covers
/// `REPEAT`, and the city repeats itself every `REPEAT` along the street;
/// the frame at the loop's end is the frame at its start.
pub const LOOP: f32 = 64.0;
pub const STEPS: i32 = 120;
pub const STRIDE: f32 = 0.68;
pub const REPEAT: f32 = 2.0 * BLOCK;
/// How far apart the feet land, either side of the walk's line.
pub const STEP_WIDTH: f32 = 0.085;

/// The rain: drops in a box that travels with the camera, wrapping round
/// it; the fall and the box are chosen so the drops are where they were
/// one loop and one `REPEAT` later.
pub const RAIN: u32 = 9000;
pub const RAIN_BOX: [f32; 3] = [26.0, 16.0, REPEAT / 2.0];
pub const RAIN_FALL: f32 = 8.0;
/// The streak a drop draws in one frame's exposure, metres.
pub const RAIN_STREAK: f32 = 0.24;
/// Drops thrown up by the step into the puddle, and by the rain on the palm.
pub const SPLASH: u32 = 64;
pub const PALM_DROPS: u32 = 72;

/// Cars are only their lights, drawn out into streaks: per lane how many
/// in one `REPEAT` and how many `REPEAT`s they cover in one loop.
pub const CAR_LANE: f32 = 1.6;
pub const CARS: [[f32; 2]; 2] = [[2.0, 10.0], [3.0, -9.0]];

/// The lens: the whole 3:2 frame stays in view on a canvas of any shape.
pub const FRAME_ASPECT: f32 = 1.5;
/// The world is drawn at most this wide (px) and at this share of the
/// canvas, then blurred by the lens and scaled up.
pub const WORLD_SCALE: f32 = 0.6;
pub const WORLD_WIDTH: f32 = 1200.0;
/// The widest blur of the lens, px of the world's frame, and how densely
/// the lens's spiral gathers (smaller is denser).
pub const BLUR_MAX: f32 = 14.0;
pub const RAD_SCALE: f32 = 1.1;
/// The frame's exposure: how much the finished light is raised.
pub const EXPOSURE: f32 = 1.35;
/// How much of the frame's light blooms round its brightest points.
pub const BLOOM: f32 = 0.09;
/// Light a byte target keeps of each pass when the GPU cannot draw into
/// half floats.
pub const BYTE_KEEP: f32 = 0.5;

/// The uniform slots the shaders read (common.glsl names them).
pub const SLOTS: usize = 27;
pub const SLOT_VIEW: usize = 4;
pub const SLOT_PUFF: usize = 17;
pub const SLOT_STEP: usize = 19;
pub const PUFFS: usize = 2;
pub const STEP_MARKS: usize = 8;

/// How brightly a lit drop of rain shines.
pub const RAIN_LIGHT: f32 = 0.95;
/// The light of one street lamp (its head's intensity), of a lit shop
/// window and of a car's lamp.
pub const LAMP_LIGHT: f32 = 9.0;
pub const SHOP_LIGHT: f32 = 0.9;
pub const CAR_LIGHT: f32 = 2.2;
/// How much light the air in the rain scatters toward the eye.
pub const AIR: f32 = 0.012;
/// The haze over distance, per metre.
pub const HAZE: f32 = 0.009;

/// Which page's loop plays.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Chapter {
    /// Page 06 «Наблюдай не только смысл действия — а сам факт динамики».
    Fact,
}

impl Chapter {
    pub fn from_code(_code: u32) -> Chapter {
        Chapter::Fact
    }
    pub fn loop_seconds(self) -> f32 {
        match self {
            Chapter::Fact => LOOP,
        }
    }
    /// Reduced motion holds this moment: over the shoulder, mid-step, the
    /// street lit and calm.
    pub fn still(self) -> f32 {
        match self {
            Chapter::Fact => 21.0,
        }
    }
}

/// The theme: how its light colours read the frame. The scene keeps its
/// cold light in the frame's luminance (the theme's one-colour recolor)
/// and its warm light apart, added back over it in `warm`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub warm: [f32; 3],
    /// The theme inks its light softly (Тишина, Астрал), as scene-palette's
    /// recolor does.
    pub soft: bool,
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

/// The app theme by its `graphicsPalette` code; the site shows only the
/// dark ones (0, 2, 3, 4), and a retired light code reads as Матрица.
pub fn look(code: u32) -> Look {
    let palette = Palette::from_code(code);
    let soft = palette.mode() == 2.0;
    let warm = match palette {
        // Sodium lamps: an ember on Искра, sand on Тишина, a rose glow on
        // Астрал, amber against Матрица's green.
        Palette::Dark => rgb(255, 122, 40),
        Palette::Neutral => rgb(242, 179, 117),
        Palette::Violet => rgb(240, 158, 128),
        _ => rgb(255, 184, 64),
    };
    Look { warm, soft }
}

/// The palette code the recolor runs with: retired light themes fall back
/// to Матрица.
pub fn recolor_code(code: u32) -> u32 {
    if Palette::from_code(code).is_light() {
        4
    } else {
        code
    }
}

/// One frame's numbers for the shaders, slot by slot (common.glsl).
pub fn pack(f: &Frame) -> [[f32; 4]; SLOTS] {
    let mut s = [[0.0; 4]; SLOTS];
    let v = |p: math::V3, w: f32| [p.x, p.y, p.z, w];
    s[0] = v(f.eye, f.focus);
    s[1] = v(f.right, f.time);
    s[2] = v(f.up, f.aperture);
    s[3] = v(f.forward, f.lens);
    // s[SLOT_VIEW] is the canvas's: browser.rs fills it.
    s[5] = v(f.body.low, f.head_hidden);
    s[6] = v(f.body.high, f.rim);
    s[7] = v(f.body.mouth, f.breath);
    s[8] = v(f.voice_from[0], f.voice[0]);
    s[9] = v(f.voice_from[1], f.voice[1]);
    s[10] = [f.voice[2], f.voice[3], f.walls, 0.0];
    s[11] = f.echo;
    s[12] = v(f.body.head, f.track);
    s[13] = [f.agitation, f.signal, f.prints, f.crane];
    s[14] = v(f.palm, f.palm_rain);
    s[15] = v(f.rain_centre, 0.0);
    s[16] = [f.puddle[0], f.puddle[1], f.puddle[2], 0.0];
    for (i, p) in f.puffs.iter().enumerate() {
        s[SLOT_PUFF + i] = *p;
    }
    for (i, p) in f.steps.iter().enumerate() {
        s[SLOT_STEP + i] = *p;
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn near(a: f32, b: f32) -> bool {
        (a - b).abs() < 1e-3
    }

    #[test]
    fn the_city_repeats_where_the_walk_ends() {
        assert!(near(STEPS as f32 * STRIDE, REPEAT));
        assert!(near(REPEAT / LAMP_GAP, (REPEAT / LAMP_GAP).round()));
        assert!(near(REPEAT / CELL, (REPEAT / CELL).round()));
        assert!(near(REPEAT / TOWER_CELL, (REPEAT / TOWER_CELL).round()));
        assert_eq!(STEPS % 2, 0, "the same foot leads again");
    }

    #[test]
    fn the_rain_and_the_cars_come_round_with_the_loop() {
        let falls = RAIN_FALL * LOOP / RAIN_BOX[1];
        assert!(near(falls, falls.round()));
        let boxes = REPEAT / RAIN_BOX[2];
        assert!(near(boxes, boxes.round()));
        for [count, repeats] in CARS {
            assert!(count >= 1.0 && near(count, count.round()));
            assert!(near(repeats, repeats.round()));
        }
    }

    #[test]
    fn every_dark_theme_has_its_warm_light() {
        for code in [0, 2, 3, 4] {
            let l = look(code);
            assert!(l.warm.iter().any(|&c| c > 0.5), "{code}");
            assert_eq!(recolor_code(code), code);
        }
        assert!(look(2).soft && look(3).soft && !look(4).soft && !look(0).soft);
        for code in [1, 5, 6] {
            assert_eq!(recolor_code(code), 4);
        }
    }
}
