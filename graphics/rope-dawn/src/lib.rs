//! «Канатоходец на рассвете»: Step 7 page 09 «Итог третьего уровня». A man
//! walks a rope with a long pole between two towers of a city of towers;
//! below them lies a sea of fog over the waking streets. His three rings
//! show one by one and then strike together; he stops and the world stops
//! with him; a pale double rises out of him and is drawn back; the sun comes
//! out behind him and the light rises in him from the soles; the fog opens
//! on the living city; his huge shadow on the fog (the persona) panics in a
//! gust, lags and crumbles into code while he walks on evenly to the far
//! roof.
//!
//! The pure core lives here and in `story.rs`: the rope, the walk, the
//! camera, the sun, the fog and the shadow, all as numbers the shaders read.
//! `browser.rs` only binds them to WebGL2. Metres; the rope runs along +z
//! at x = 0, up is +y, the roofs of the towers are at y = 0. One tower
//! stands every `SPAN` along z, so the world repeats where his crossing
//! ends and the loop is seamless.
pub mod body;
pub mod math;
pub mod story;

#[cfg(target_arch = "wasm32")]
mod browser;

pub use story::{Frame, Story};
use watcher_scene_palette::Palette;

/// From one tower to the next; the world repeats itself every `SPAN`.
pub const SPAN: f32 = 24.3;
/// One loop: he crosses one span.
pub const LOOP: f32 = 96.0;
/// A tower's half width across the rope (x) and along it (z); its roof is
/// at y = 0 and its foot at the city's streets.
pub const TOWER_X: f32 = 3.2;
pub const TOWER_Z: f32 = 2.5;
/// The rope's radius, and how far it sags at its middle with no one on it.
pub const ROPE_R: f32 = 0.013;
pub const ROPE_SAG: f32 = 0.22;
/// How far his weight presses the rope down at mid span, and how round the
/// bend under him is (the soft minimum's width over the bend's two sides,
/// each rising 0 … 1 from its tower to him).
pub const ROPE_DIP: f32 = 0.16;
pub const ROPE_ROUND: f32 = 0.25;
/// The pole: its half length, its radius, how far its tips droop.
pub const POLE_HALF: f32 = 3.4;
pub const POLE_R: f32 = 0.016;
pub const POLE_DROOP: f32 = 0.3;
/// The fog sea's top (it rises and falls a little), the city's streets
/// far under it, its lots along x and z (three to a span).
pub const FOG_TOP: f32 = -38.0;
pub const STREET: f32 = -96.0;
pub const LOT_X: f32 = 11.0;
pub const LOT_Z: f32 = SPAN / 3.0;
/// The shadow on the fog: radians of the view a metre of him spans.
pub const SHADOW_SCALE: f32 = 0.3;

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
pub const EXPOSURE: f32 = 1.3;
/// How much of the frame's light blooms round its brightest points.
pub const BLOOM: f32 = 0.11;
/// Light a byte target keeps of each pass when the GPU cannot draw into
/// half floats.
pub const BYTE_KEEP: f32 = 0.5;
/// The haze over distance, per metre, and the mist that thickens down to
/// the fog's top (per metre there, falling off over `MIST_HEIGHT`).
pub const HAZE: f32 = 0.0012;
pub const MIST: f32 = 0.004;
pub const MIST_HEIGHT: f32 = 8.0;

/// The uniform slots the shaders read (common.glsl names them): the
/// camera, the figure's box, the sphere and its rings, the beats, the pole,
/// the rope, the sun, the light in him, the fog, the world's clock, the
/// double, the birds, the shadow; then the shadow's cones, two slots each.
pub const SLOT_VIEW: usize = 4;
pub const SLOT_SHADOW: usize = 27;
pub const SLOTS: usize = SLOT_SHADOW + 2 * body::PRIMITIVES;
// The world's uniforms fit the 256 vectors phones give a fragment shader
// (WebGL2 promises 224; ANGLE keeps a few of its own).
const _: () = assert!(SLOTS + body::PRIMITIVES * 3 + 4 <= 224);

/// Which page's loop plays: only page 09.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Chapter {
    /// Page 09 «Итог третьего уровня».
    Summary,
}

impl Chapter {
    pub fn from_code(_code: u32) -> Chapter {
        Chapter::Summary
    }
    pub fn loop_seconds(self) -> f32 {
        LOOP
    }
    /// Reduced motion holds this moment: before him on the rope, the sun
    /// out behind his chest and the light risen in him to the crown.
    pub fn still(self) -> f32 {
        51.2
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
        // The low sun: an ember on Искра, pale gold on Тишина, a rose dawn
        // on Астрал, amber against Матрица's green.
        Palette::Dark => rgb(255, 128, 48),
        Palette::Neutral => rgb(244, 196, 138),
        Palette::Violet => rgb(246, 166, 140),
        _ => rgb(255, 190, 80),
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
    s[7] = f.sphere;
    s[8] = f.ring1;
    s[9] = f.ring2;
    s[10] = f.ring2b;
    s[11] = f.ring3;
    s[12] = f.ring_events;
    s[13] = f.beat;
    s[14] = v(f.pole[0], f.pole_seen);
    s[15] = v(f.pole[1], POLE_DROOP);
    s[16] = f.rope;
    s[17] = v(f.sun, f.sun_out);
    s[18] = f.glow;
    s[19] = f.fog;
    s[20] = f.world;
    s[21] = f.double;
    s[22] = f.birds;
    s[23] = f.birds2;
    s[24] = f.shadow;
    s[25] = f.shadow_box;
    s[26] = f.shadow_pole;
    for (i, c) in f.shadow_cones.iter().enumerate() {
        s[SLOT_SHADOW + i] = *c;
    }
    s
}

/// The figure's cones, as the shaders' `u_b` reads them.
pub fn cones(f: &Frame) -> Vec<f32> {
    f.body.cones.iter().flatten().copied().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_figure_is_sent() {
        let f = Story::new(Chapter::Summary).compose(10.0);
        assert_eq!(cones(&f).len(), body::PRIMITIVES * 12);
        assert_eq!(f.shadow_cones.len(), 2 * body::PRIMITIVES);
    }

    #[test]
    fn the_still_frame_is_in_the_loop() {
        let chapter = Chapter::from_code(0);
        assert!(chapter.still() < chapter.loop_seconds());
    }

    #[test]
    fn the_city_repeats_with_the_span() {
        let lots = SPAN / LOT_Z;
        assert!((lots - lots.round()).abs() < 1e-4);
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
