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
/// One loop of page 07, a tape played twice (story.rs, `reel`): the wrong
/// take, its rewind and the right take, over which the city's clock
/// covers one `LOOP`.
pub const CHECK_LOOP: f32 = 126.9;
/// One loop of page 08: down into the underpass, through it, up and on
/// into the street; he covers `REPEAT` and the city's clock two `LOOP`s.
pub const VOICE_LOOP: f32 = 104.0;
pub const STRIDE: f32 = 0.68;
pub const REPEAT: f32 = 2.0 * BLOCK;
/// How far apart the feet land, either side of the walk's line.
pub const STEP_WIDTH: f32 = 0.085;

/// Page 08's underpass, one under each block's first cross street (one
/// every `REPEAT`), along the walker's pavement between the walls
/// `UNDER_X`. Its down flight starts at `UNDER_Z`: `RISERS` steps of
/// `RISE` over treads `TREAD` deep, then the flat floor `FLAT` long and
/// the up flight. The slab over it is `SLAB` thick and leaves `OPEN` open
/// over each flight, a whole number of treads.
pub const UNDER_X: [f32; 2] = [-5.4, -3.2];
pub const UNDER_Z: f32 = 1.88;
pub const RISERS: i32 = 18;
pub const RISE: f32 = 0.17;
pub const TREAD: f32 = 0.32;
pub const FLAT: f32 = 18.0;
pub const SLAB: f32 = 0.42;
pub const OPEN: f32 = 14.0 * TREAD;
/// A flight's length, the floor's depth and the underpass's whole length.
pub const FLIGHT: f32 = (RISERS - 1) as f32 * TREAD;
pub const UNDER_DEPTH: f32 = RISERS as f32 * RISE;
pub const UNDER_LEN: f32 = 2.0 * FLIGHT + FLAT;

/// How far along its underpass z lies, from the top of the down flight,
/// within half a `REPEAT` either way.
pub fn under_along(z: f32) -> f32 {
    let u = (z - UNDER_Z).rem_euclid(REPEAT);
    if u < 0.5 * REPEAT {
        u
    } else {
        u - REPEAT
    }
}

/// The underpass's floor under (x, z): its treads and its flat; 0 beyond
/// it (the pavement's level).
pub fn under_floor(x: f32, z: f32) -> f32 {
    let u = under_along(z);
    if x <= UNDER_X[0] || x >= UNDER_X[1] || !(0.0..UNDER_LEN).contains(&u) {
        0.0
    } else if u < FLIGHT {
        -((u / TREAD).floor() + 1.0) * RISE
    } else if u < FLIGHT + FLAT {
        -UNDER_DEPTH
    } else {
        -((RISERS - 1) as f32 - ((u - FLIGHT - FLAT) / TREAD).floor()) * RISE
    }
}

/// The line over the treads' middles, its corners rounded: how high the
/// walker's pelvis and the camera ride along the underpass.
pub fn under_ramp(z: f32) -> f32 {
    let u = under_along(z);
    let w = 0.3;
    let soft = |x: f32| x.max(0.0) + w * (-x.abs() / w).exp().ln_1p();
    let slope = RISE / TREAD;
    let (top, bottom) = (-0.5 * TREAD, UNDER_DEPTH / slope - 0.5 * TREAD);
    let up = FLIGHT + FLAT - 0.5 * TREAD;
    slope * (soft(u - up) - soft(u - up - UNDER_DEPTH / slope) - soft(u - top) + soft(u - bottom))
}

/// Whether the sky shows over the underpass at z (its two openings).
pub fn under_open(z: f32) -> bool {
    let u = under_along(z);
    (0.0..OPEN).contains(&u) || (UNDER_LEN - OPEN..UNDER_LEN).contains(&u)
}

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

/// The cars: per lane how many in one `REPEAT` and how many `REPEAT`s
/// they cover in one loop.
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
pub const SLOTS: usize = 40;
pub const SLOT_VIEW: usize = 4;
pub const SLOT_PUFF: usize = 17;
pub const SLOT_STEP: usize = 19;
/// The passers' boxes (low, high each), the phone's screen (centre and
/// light, facing), then the sphere round him and its rings.
pub const SLOT_PASS: usize = 27;
pub const SLOT_SCREEN: usize = 31;
pub const SLOT_SPHERE: usize = 33;
/// Page 07: the frame's tunnel, the muted city, the soles' light and the
/// support's rings; the car out of the side street; each ring's light and
/// his own screen's.
pub const SLOT_CHECK: usize = 35;
/// His umbrella: the canopy's rim (centre, radius; 0 none), its crown and
/// whether his own parts (thumbs, umbrella) are drawn.
pub const SLOT_BROLLY: usize = 38;
/// Every figure the shaders draw: him, then the passers-by.
pub const FIGURES: usize = 1 + story::PASSERS;
// The slots follow one another and fit the 224 vectors WebGL2 promises a
// shader (ANGLE keeps a few of its own); the cones' uniform block fits the
// 16 KB (1024 vectors) it promises a block.
const _: () = {
    assert!(SLOT_STEP + STEP_MARKS <= SLOT_PASS);
    assert!(SLOT_PASS + 2 * story::PASSERS <= SLOT_SCREEN);
    assert!(SLOT_SPHERE + 2 <= SLOT_CHECK);
    assert!(SLOT_CHECK + 3 <= SLOT_BROLLY);
    assert!(SLOT_BROLLY + 2 <= SLOTS);
    assert!(SLOTS + 4 <= 200);
    assert!((FIGURES * body::PRIMITIVES + body::OWN) * 3 <= 1024);
};
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
    /// Page 07 «Главная проверка: не потерять два первых кольца».
    Check,
    /// Page 08 «Используй свой голос (как настройку трех колец)».
    Voice,
}

impl Chapter {
    pub fn from_code(code: u32) -> Chapter {
        match code {
            1 => Chapter::Check,
            2 => Chapter::Voice,
            _ => Chapter::Fact,
        }
    }
    pub fn loop_seconds(self) -> f32 {
        match self {
            Chapter::Fact => LOOP,
            Chapter::Check => CHECK_LOOP,
            Chapter::Voice => VOICE_LOOP,
        }
    }
    /// Reduced motion holds this moment. Page 06: over the shoulder,
    /// mid-step, the street lit and calm. Page 07: the right take, drawn
    /// back from him at the kerb, the sphere wide open, all three rings lit.
    /// Page 08: in the underpass, the echo gone into him, the lines of code
    /// on the tiles.
    pub fn still(self) -> f32 {
        match self {
            Chapter::Fact => 21.0,
            Chapter::Check => 71.0,
            Chapter::Voice => 33.0,
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
    s[10] = [f.voice[2], f.voice[3], f.walls, f.tape[2]];
    s[11] = f.echo;
    s[12] = v(f.body.head, f.track);
    s[13] = [f.agitation, f.signal, f.prints, f.crane];
    s[14] = v(f.palm, f.palm_rain);
    s[15] = v(f.rain_centre, f.tape[0]);
    s[16] = [f.puddle[0], f.puddle[1], f.puddle[2], f.tape[1]];
    for (i, p) in f.puffs.iter().enumerate() {
        s[SLOT_PUFF + i] = *p;
    }
    for (i, p) in f.steps.iter().enumerate() {
        s[SLOT_STEP + i] = *p;
    }
    for (i, b) in f.passers.iter().enumerate() {
        s[SLOT_PASS + 2 * i] = v(b.low, 0.0);
        s[SLOT_PASS + 2 * i + 1] = v(b.high, 0.0);
    }
    let phone = &f.passers[story::PHONE];
    s[SLOT_SCREEN] = v(phone.screen[0], story::SCREEN_LIGHT);
    s[SLOT_SCREEN + 1] = v(phone.screen[1], 0.0);
    s[SLOT_SPHERE] = f.sphere;
    s[SLOT_SPHERE + 1] = f.rings;
    s[SLOT_CHECK] = f.check;
    s[SLOT_CHECK + 1] = f.cross_car;
    s[SLOT_CHECK + 2] = f.ring_light;
    let at = |c: usize, j: usize| f.body.cones[3 * c + j];
    let [cx, cy, cz, radius] = at(body::CANOPY, 0);
    let [rx, ry, rz, _] = at(body::CANOPY, 1);
    let open = radius > 0.01;
    s[SLOT_BROLLY] = [rx, ry, rz, if open { radius } else { 0.0 }];
    s[SLOT_BROLLY + 1] = [cx, cy, cz, if f.body.own { 1.0 } else { 0.0 }];
    s
}

/// Every figure's cones, him first, as the shaders' `Cones` block holds
/// them; then his own parts, which the passers do not have.
pub fn cones(f: &Frame) -> Vec<f32> {
    let shared = 3 * body::PRIMITIVES;
    std::iter::once(&f.body)
        .chain(&f.passers)
        .flat_map(|b| &b.cones[..shared])
        .chain(&f.body.cones[shared..])
        .flatten()
        .copied()
        .collect()
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
        assert_eq!(story::UMBRELLA_STEPS % 2, 0);
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
    fn every_figure_is_sent() {
        for chapter in [Chapter::Fact, Chapter::Check, Chapter::Voice] {
            let f = Story::new(chapter).compose(10.0);
            let all = FIGURES * body::PRIMITIVES + body::OWN;
            assert_eq!(cones(&f).len(), all * 12);
        }
    }

    #[test]
    fn every_page_has_its_chapter() {
        assert_eq!(Chapter::from_code(0), Chapter::Fact);
        assert_eq!(Chapter::from_code(1), Chapter::Check);
        assert_eq!(Chapter::from_code(2), Chapter::Voice);
        for chapter in [Chapter::Fact, Chapter::Check, Chapter::Voice] {
            assert!(chapter.still() < chapter.loop_seconds());
        }
    }

    #[test]
    fn the_underpass_fits_its_street() {
        // It comes round with the street, its openings end on a tread's
        // edge and the ramp rides over the treads.
        const { assert!(UNDER_Z + UNDER_LEN < REPEAT) };
        assert!(near(OPEN / TREAD, (OPEN / TREAD).round()));
        assert!(near(under_floor(WALK_X, UNDER_Z + 0.5 * TREAD), -RISE));
        assert!(near(
            under_floor(WALK_X, UNDER_Z + FLIGHT + 1.0),
            -UNDER_DEPTH
        ));
        assert!(near(under_floor(WALK_X, UNDER_Z + UNDER_LEN - 0.1), -RISE));
        assert!(near(under_floor(WALK_X, UNDER_Z - 0.1), 0.0));
        assert!(near(under_floor(-6.0, UNDER_Z + 9.0), 0.0));
        let mut last = under_ramp(UNDER_Z - 6.0);
        let mut z = UNDER_Z - 6.0;
        while z < UNDER_Z + UNDER_LEN + 6.0 {
            let floor = under_floor(WALK_X, z);
            let ramp = under_ramp(z);
            assert!((ramp - floor).abs() < 0.25, "{z}: {ramp} over {floor}");
            assert!((ramp - last).abs() < 0.01, "{z}");
            last = ramp;
            z += 0.01;
        }
        assert!(near(under_ramp(UNDER_Z + REPEAT - 6.0), 0.0));
        assert!(under_open(UNDER_Z + 1.0) && !under_open(UNDER_Z + 10.0));
        assert!(under_open(UNDER_Z + UNDER_LEN - 1.0) && !under_open(UNDER_Z + UNDER_LEN + 1.0));
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
