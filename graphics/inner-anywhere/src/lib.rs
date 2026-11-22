//! «Он тот же», page 10 of Step 6 «Внутреннее кольцо» («Пробуй в любой
//! среде»). A fixed camera; the glass man stands in the middle, dark smoky
//! glass with warm light inside and a star in his chest. Around him the world
//! changes through the seven places of the text, painted for this page: an
//! open field, a room, a kitchen with one other person at the table, a station
//! hall in a crowd, a train in motion, a lake pier in silence, a café street
//! with someone talking to him. He and his two rings never change.
//!
//! The layers (assets/): `places-a` the luminance of places 1–3 in R, G, B,
//! `places-b` places 4–6, `places-c` place 7; `hero` him, cut off his green,
//! 384 × 1024 with straight alpha. All seven share one eye-level camera: the
//! horizon at row 512, the vanishing point on his axis.
//!
//! The beats, phrase by phrase:
//! «Пробуй делать эту практику в любой среде: …» The first (cold) ring rides
//! a sphere round him, down and up. Each time it goes down, the next place
//! pours in from the top behind it, a cold scan line across the frame at its
//! edge: field, room, one on one, crowd, motion, silence, dialogue.
//! «Позволь телу запомнить…» The second (warm) ring, which scans his body up
//! and down all the time, climbs him and leaves him lit behind it; the light
//! in him trembles, his body's response, then settles.
//! «Перепроверяй себя на предмет … Целостности и Неделимости…» The seven
//! places open round his chest star as seven sectors, turn slowly, their
//! seams melt, and all seven become one image, every line converging on him;
//! out of it the open field comes back, and the loop starts again.
//!
//! Every value here is a pure function of loop time; `browser.rs` uploads it
//! and `scene.frag` paints it. Positions are the places' own pixels
//! (1024 × 1024, y down); the world in metres, him at the origin.
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerAnywhere;

/// The places' canvas, in their own pixels (y down).
pub const SIZE: [f32; 2] = [1024.0, 1024.0];
pub const LOOP_SECONDS: f32 = 65.0;
/// Reduced motion: halfway through a change, the crowd's hall above the scan
/// line, the kitchen with its sitter below, him whole in front of both.
pub const STILL: f32 = 11.25;

/// The places' camera: the horizon row, the column straight ahead, the focal
/// length in px, the eye's height and his distance, metres.
pub const HORIZON: f32 = 512.0;
pub const AXIS: f32 = 512.0;
pub const FOCAL: f32 = 800.0;
pub const EYE: f32 = 1.676;
pub const DISTANCE: f32 = 4.5;
/// His soles and the top of his head (rows); his chest star.
pub const FEET: f32 = 810.0;
pub const CROWN: f32 = 490.0;
pub const HEART: [f32; 2] = [512.0, 560.0];
/// His texture: its size, his crown and soles rows and his axis column in it.
pub const HERO_TEX: [f32; 2] = [384.0, 1024.0];
pub const HERO_CROWN: f32 = 22.0;
pub const HERO_SOLES: f32 = 1002.0;
pub const HERO_AXIS: f32 = 192.0;
/// The middle row of what a 3:2 canvas shows: him whole, the lamps above.
pub const WINDOW_Y: f32 = 520.0;
/// The painted places are dark; their luminance is lifted this much before
/// the theme's recolor.
pub const PLACE_GAIN: f32 = 1.8;
pub const PLACES: usize = 7;

/// The first ring (cold) rides a sphere round him: its centre height and
/// radius, metres; one sweep down and up in `COLD_SECONDS`. In each of the
/// first `SWAPS` sweeps down the next place pours in behind it.
pub const SPHERE: [f32; 2] = [1.0, 1.4];
pub const COLD_SECONDS: f32 = 5.0;
pub const SWAPS: usize = 6;
/// The lowest the cold ring goes (just above the floor), metres, and how far
/// past the window's top and bottom the scan line starts and ends, px.
pub const COLD_FLOOR: f32 = 0.04;
pub const LINE_MARGIN: f32 = 30.0;
/// The second ring (warm) climbs his body and back: lowest and highest
/// height, its radius, metres, `WARM_SECONDS` a climb and a return.
pub const WARM_SPAN: [f32; 2] = [0.3, 1.75];
pub const WARM_RADIUS: f32 = 0.3;
pub const WARM_SECONDS: f32 = 6.5;
/// The runners' turns a loop: the cold one way, the warm the other.
pub const COLD_TURNS: f32 = 13.0;
pub const WARM_TURNS: f32 = -20.0;
/// The rings' light at rest and when the places become one.
pub const RING_LIGHT: [f32; 2] = [0.75, 1.1];
pub const BRIGHT: [f32; 4] = [50.5, 53.0, 58.0, 61.5];

/// «Позволь телу запомнить»: the warm ring's climb that fills him (one of its
/// own climbs: it starts at its lowest), the fill's fade, the trembling.
pub const FILL: [f32; 2] = [32.5, 35.75];
pub const FILL_OUT: [f32; 2] = [41.5, 44.5];
pub const TREMBLE: [f32; 4] = [33.0, 34.5, 41.0, 44.0];
/// «Перепроверяй себя…»: the sectors open round his chest, their seams melt
/// into one image, the field comes back out of it; the star's glow.
pub const SECTORS: [f32; 2] = [44.0, 47.0];
pub const MERGE: [f32; 2] = [50.5, 55.5];
pub const RESOLVE: [f32; 2] = [57.0, 62.0];
/// How wide each sector's place spreads (radians): sharp, then all of them.
pub const SECTOR_WIDTH: [f32; 2] = [0.3, 2.6];
/// The sectors' slow turn, radians a second.
pub const SECTOR_SPIN: f32 = 0.06;
pub const STAR: [f32; 4] = [44.5, 47.0, 58.0, 62.0];

/// The sweep's progress, 0 at the top and 1 at the bottom: the cold ring and
/// the scan line go down and up together.
pub fn sweep(t: f32) -> f32 {
    0.5 - 0.5 * (TAU * t / COLD_SECONDS).cos()
}

/// The rows a canvas of 3:2 shows, top and bottom.
fn default_rows() -> [f32; 2] {
    let half = SIZE[0] / 1.5 * 0.5;
    [WINDOW_Y - half, WINDOW_Y + half]
}

/// The scan line's row at a sweep progress, for a window's top and bottom.
pub fn line_row(s: f32, top: f32, bottom: f32) -> f32 {
    top - LINE_MARGIN + (bottom - top + 2.0 * LINE_MARGIN) * s
}

/// The cold ring's height (metres) at `t`: on his body it rides with the
/// scan line; above his sphere and below his feet it waits for it.
pub fn cold_height(t: f32) -> f32 {
    let [top, bottom] = default_rows();
    let row = line_row(sweep(t), top, bottom);
    let h = EYE - (row - HORIZON) * DISTANCE / FOCAL;
    h.clamp(COLD_FLOOR, SPHERE[0] + 0.92 * SPHERE[1])
}
/// The warm ring's height: up his body and back.
pub fn warm_height(t: f32) -> f32 {
    WARM_SPAN[0] + (WARM_SPAN[1] - WARM_SPAN[0]) * (0.5 - 0.5 * (TAU * t / WARM_SECONDS).cos())
}

/// A world point (metres: x across, y up, z away) as the places' camera sees it.
pub fn project(world: [f32; 3]) -> [f32; 2] {
    let z = world[2].max(0.1);
    [
        AXIS + FOCAL * world[0] / z,
        HORIZON + FOCAL * (EYE - world[1]) / z,
    ]
}

/// A level ring round him (height, radius, metres): centre, A, B; the ring is
/// centre + A sin θ + B cos θ, its front at θ = 0.
pub fn ring(height: f32, radius: f32) -> [[f32; 2]; 3] {
    let at = |x: f32, z: f32| project([x, height, z]);
    let front = at(0.0, DISTANCE - radius);
    let back = at(0.0, DISTANCE + radius);
    let right = at(radius, DISTANCE);
    let left = at(-radius, DISTANCE);
    let centre = [0, 1].map(|i| (front[i] + back[i] + right[i] + left[i]) * 0.25);
    [
        centre,
        [0, 1].map(|i| (right[i] - left[i]) * 0.5),
        [0, 1].map(|i| (front[i] - back[i]) * 0.5),
    ]
}

/// The places' window a canvas shows: centre x, y, width, height. Any canvas
/// is covered with a crop of the square, never stretched, kept on him.
pub fn window(width: f32, height: f32) -> [f32; 4] {
    if !(width > 0.0 && height > 0.0) {
        return [AXIS, WINDOW_Y, SIZE[0], SIZE[0] / 1.5];
    }
    let scale = (width / SIZE[0]).max(height / SIZE[1]);
    let shown = [width / scale, height / scale];
    let rise = ((SIZE[1] - shown[1]) * 0.5).max(0.0);
    let mid = SIZE[1] * 0.5;
    // max/min, not clamp: clamp's runtime bound check links the panic formatter.
    [
        AXIS,
        WINDOW_Y.max(mid - rise).min(mid + rise),
        shown[0],
        shown[1],
    ]
}

/// Which places show at `t`: the one standing, the one pouring in, whether a
/// change is under way (its edge is the scan line).
pub fn places(t: f32) -> (usize, usize, bool) {
    let cycle = (t / COLD_SECONDS).floor().max(0.0) as usize;
    let down = (t / COLD_SECONDS).fract() < 0.5;
    if cycle < SWAPS {
        if down {
            (cycle, cycle + 1, true)
        } else {
            (cycle + 1, cycle + 1, false)
        }
    } else if t < RESOLVE[1] {
        (PLACES - 1, PLACES - 1, false)
    } else {
        (0, 0, false)
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    /// Per ring (cold, warm): centre, A | B, runner angle, light. The ring is
    /// centre + A sin θ + B cos θ, its front at θ = 0.
    pub rings: [[f32; 4]; 4],
    /// (place standing, place pouring in, sweep, changing),
    /// (sectors, sector width, sectors' turn, merge),
    /// (back to the field, fill row, fill, trembling),
    /// (star, loop phase, tremble phase, -).
    pub fx: [[f32; 4]; 4],
}

fn ramp(t: f32, a: f32, b: f32) -> f32 {
    let x = ((t - a) / (b - a)).clamp(0.0, 1.0);
    x * x * (3.0 - 2.0 * x)
}
fn span(t: f32, k: [f32; 4]) -> f32 {
    ramp(t, k[0], k[1]) * (1.0 - ramp(t, k[2], k[3]))
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let phase = time / LOOP_SECONDS;
    let light = RING_LIGHT[0] + (RING_LIGHT[1] - RING_LIGHT[0]) * span(time, BRIGHT);
    let cold = cold_height(time);
    let cold_radius = (SPHERE[1].powi(2) - (cold - SPHERE[0]).powi(2))
        .max(0.0)
        .sqrt();
    let warm = warm_height(time);
    let [c0, a0, b0] = ring(cold, cold_radius);
    let [c1, a1, b1] = ring(warm, WARM_RADIUS);
    let rings = [
        [c0[0], c0[1], a0[0], a0[1]],
        [
            b0[0],
            b0[1],
            (TAU * COLD_TURNS * phase).rem_euclid(TAU),
            light,
        ],
        [c1[0], c1[1], a1[0], a1[1]],
        [
            b1[0],
            b1[1],
            (TAU * WARM_TURNS * phase).rem_euclid(TAU),
            light,
        ],
    ];
    let (standing, coming, changing) = places(time);
    // The sectors and the merge hold until the field is back, then let go at
    // once: at that moment the merged image is the field itself.
    let open = time < RESOLVE[1];
    let sectors = if open {
        ramp(time, SECTORS[0], SECTORS[1])
    } else {
        0.0
    };
    let merge = if open {
        ramp(time, MERGE[0], MERGE[1])
    } else {
        0.0
    };
    let resolve = if open {
        ramp(time, RESOLVE[0], RESOLVE[1])
    } else {
        0.0
    };
    let width = SECTOR_WIDTH[0] + (SECTOR_WIDTH[1] - SECTOR_WIDTH[0]) * merge;
    let turn = SECTOR_SPIN * (time - SECTORS[0]).max(0.0) * f32::from(u8::from(open));
    // The fill follows the warm ring up him, then holds over his crown.
    let fill_row = if time < FILL[1] {
        project([0.0, warm, DISTANCE])[1]
    } else {
        CROWN - 30.0
    };
    let fill = ramp(time, FILL[0], FILL[0] + 0.6) * (1.0 - ramp(time, FILL_OUT[0], FILL_OUT[1]));
    let fx = [
        [
            standing as f32,
            coming as f32,
            sweep(time),
            f32::from(u8::from(changing)),
        ],
        [sectors, width, turn, merge],
        [resolve, fill_row, fill, span(time, TREMBLE)],
        [span(time, STAR), phase, (time * 2.2).fract(), 0.0],
    ];
    Frame { time, rings, fx }
}

/// How one theme maps the places and lights them.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// The recolor of the places (scene-palette `recolor.frag`): 0 the accent
    /// by luminance (Искра, Матрица), 2 an ink on the paper (Тишина, Астрал).
    pub mode: f32,
    pub paper: [f32; 3],
    pub accent: [f32; 3],
    pub highlight: [f32; 3],
    /// The first ring and the scan line.
    pub cold: [f32; 3],
    /// The second ring and the light inside him.
    pub warm: [f32; 3],
    /// White-hot cores.
    pub pale: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

/// The app theme by its `graphicsPalette` code: 0 Искра, 2 Тишина, 3 Астрал,
/// 4 Матрица. The site has only these dark themes; any other code shows Тишина.
pub fn look(code: u32) -> Look {
    let (palette, warm, pale) = match Palette::from_code(code) {
        Palette::Dark => (Palette::Dark, rgb(255, 122, 40), rgb(255, 244, 170)),
        Palette::Violet => (Palette::Violet, rgb(240, 158, 128), rgb(200, 212, 248)),
        Palette::Matrix => (Palette::Matrix, rgb(255, 184, 64), rgb(190, 255, 205)),
        _ => (Palette::Neutral, rgb(242, 179, 117), rgb(214, 218, 210)),
    };
    let colors = palette.colors().expect("a dark theme has its colors");
    Look {
        mode: palette.mode(),
        paper: colors.paper,
        accent: colors.accent,
        highlight: colors.highlight,
        cold: colors.accent,
        warm,
        pale,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    #[test]
    fn the_loop_closes_on_the_open_field() {
        let (a, b) = (compose(LOOP_SECONDS - 0.001), compose(0.001));
        for (r, (ra, rb)) in a.rings.iter().zip(b.rings.iter()).enumerate() {
            for k in 0..4 {
                if r % 2 == 1 && k == 2 {
                    // The runner's angle wraps.
                    assert!(
                        close(ra[k].sin(), rb[k].sin(), 0.01)
                            && close(ra[k].cos(), rb[k].cos(), 0.01)
                    );
                } else {
                    assert!(close(ra[k], rb[k], 0.05), "{ra:?} {rb:?}");
                }
            }
        }
        for f in [a, b] {
            assert_eq!(f.fx[0][0], 0.0);
            // Sectors, merge, field, fill, trembling, star: all out.
            for (row, k) in [(1, 0), (1, 3), (2, 0), (2, 2), (2, 3), (3, 0)] {
                assert!(f.fx[row][k] < 1e-3, "{row} {k} {}", f.time);
            }
        }
        // The scan line is above the window where the loop meets itself.
        assert!(sweep(0.001) < 1e-3);
        for cycles in [
            COLD_TURNS,
            WARM_TURNS,
            LOOP_SECONDS / COLD_SECONDS,
            LOOP_SECONDS / WARM_SECONDS,
        ] {
            assert_eq!(cycles.fract(), 0.0);
        }
    }

    #[test]
    fn every_place_comes_in_order_and_stands_a_while() {
        let mut seen = [0.0_f32; PLACES];
        let mut last = 0;
        for i in 0..6500 {
            let t = i as f32 * 0.01;
            let (standing, coming, changing) = places(t);
            if !changing {
                seen[standing] += 0.01;
            }
            if t < RESOLVE[1] {
                assert!(standing >= last, "{t}");
                last = standing;
            }
            if changing {
                assert_eq!(coming, standing + 1);
            }
        }
        for (k, s) in seen.iter().enumerate() {
            assert!(*s >= 2.4, "place {} stands {s} s", k + 1);
        }
        // A change starts with its line over the window and ends under it.
        for k in 0..SWAPS {
            let t = k as f32 * COLD_SECONDS;
            assert!(sweep(t) < 1e-4 && sweep(t + COLD_SECONDS * 0.5) > 1.0 - 1e-4);
            assert!(places(t + 0.01).2 && !places(t + COLD_SECONDS * 0.5 + 0.01).2);
        }
        assert!(SWAPS as f32 * COLD_SECONDS < FILL[0]);
    }

    #[test]
    fn the_merged_image_is_the_field_when_the_sectors_let_go() {
        let before = compose(RESOLVE[1] - 0.001);
        let after = compose(RESOLVE[1] + 0.001);
        assert!(before.fx[2][0] > 0.999 && before.fx[1][3] > 0.999 && before.fx[1][0] > 0.999);
        assert_eq!(
            (after.fx[0][0], after.fx[1][0], after.fx[1][3]),
            (0.0, 0.0, 0.0)
        );
        // The sectors open over the last place, before the merge.
        const { assert!(SECTORS[1] < MERGE[0] && MERGE[1] < RESOLVE[0]) };
        assert_eq!(compose(SECTORS[0]).fx[0][0], (PLACES - 1) as f32);
    }

    #[test]
    fn the_still_is_the_crowd_pouring_into_the_kitchen() {
        let f = compose(STILL);
        assert_eq!((f.fx[0][0], f.fx[0][1], f.fx[0][3]), (2.0, 3.0, 1.0));
        assert!(close(f.fx[0][2], 0.5, 0.01));
        // The cold ring is on his body there, at his shoulders.
        let h = cold_height(STILL);
        assert!(h > 0.3 && h < 1.75, "{h}");
    }

    #[test]
    fn the_cold_ring_rides_the_scan_line_over_his_body() {
        let [top, bottom] = default_rows();
        for i in 0..=500 {
            let t = i as f32 * 0.01;
            let row = line_row(sweep(t), top, bottom);
            // Where the ring's plane meets his axis.
            let at = project([0.0, cold_height(t), DISTANCE])[1];
            if row > CROWN && row < FEET - 20.0 {
                assert!(close(at, row, 0.5), "{t}: {at} {row}");
            }
        }
    }

    #[test]
    fn the_warm_ring_fills_him_from_the_shins_to_the_crown() {
        let start = compose(FILL[0] + 0.01).fx[2][1];
        let top = compose(FILL[1] - 0.01).fx[2][1];
        assert!(start > 700.0 && start < FEET, "{start}");
        assert!(top < CROWN + 15.0, "{top}");
        assert!(compose(FILL_OUT[1]).fx[2][2] < 1e-3);
    }

    #[test]
    fn the_rings_stay_round_him() {
        for i in 0..=650 {
            let f = compose(i as f32 * 0.1);
            for r in [0, 2] {
                let (c, b) = (f.rings[r], f.rings[r + 1]);
                assert!((c[0] - AXIS).abs() < 1.0, "{c:?}");
                assert!(c[1] > CROWN - 140.0 && c[1] < FEET + 10.0, "{c:?}");
                assert!(c[2] > 20.0 && c[3].abs() < 1.0, "{c:?}");
                assert!(b[0].abs() < 1.0 && b[3] >= RING_LIGHT[0] - 1e-6);
            }
        }
        // Below the eye the front is lower in the frame than the back.
        let [_, _, b] = ring(0.5, 0.5);
        assert!(b[1] > 0.0);
    }

    #[test]
    fn values_stay_finite() {
        for i in 0..=6500 {
            let f = compose(i as f32 * 0.01);
            for v in f.rings.iter().flatten().chain(f.fx.iter().flatten()) {
                assert!(v.is_finite());
            }
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
    }

    #[test]
    fn a_canvas_of_any_shape_is_covered_without_stretching() {
        let wide = window(1536.0, 1024.0);
        assert!(close(wide[2], SIZE[0], 1e-3) && close(wide[1], WINDOW_Y, 1e-3));
        for (width, height) in [
            (300.0, 400.0),
            (640.0, 330.0),
            (1200.0, 800.0),
            (900.0, 300.0),
            (500.0, 500.0),
        ] {
            let [x, y, w, h] = window(width, height);
            assert!(close(w / h, width / height, 1e-4), "{width}×{height}");
            assert!(w <= SIZE[0] + 1e-3 && h <= SIZE[1] + 1e-3);
            assert!(y - h * 0.5 >= -1e-3 && y + h * 0.5 <= SIZE[1] + 1e-3);
            assert!((x - AXIS).abs() < 1e-3);
            // He is whole in every crop no wider than 1.6:1.
            if height / width >= 0.62 {
                assert!(
                    y - h * 0.5 < CROWN - 10.0 && y + h * 0.5 > FEET + 10.0,
                    "{width}×{height}"
                );
            }
        }
    }

    #[test]
    fn the_camera_matches_the_places() {
        let feet = project([0.0, 0.0, DISTANCE]);
        let crown = project([0.0, 1.8, DISTANCE]);
        assert!(close(feet[1], FEET, 1.0) && close(crown[1], CROWN, 1.0));
        // His eyes are on the horizon, as the places were painted.
        assert!(close(project([0.0, EYE, DISTANCE])[1], HORIZON, 1e-3));
        // His texture's crown and soles land on his rows.
        let k = (FEET - CROWN) / (HERO_SOLES - HERO_CROWN);
        assert!(close(CROWN + (HERO_SOLES - HERO_CROWN) * k, FEET, 1e-3));
        const { assert!(HEART[1] > CROWN && HEART[1] < CROWN + 0.3 * (FEET - CROWN)) };
    }

    #[test]
    fn every_dark_theme_keeps_its_accent_cold_and_a_warm_apart_from_it() {
        for code in [0, 2, 3, 4] {
            let l = look(code);
            let palette = Palette::from_code(code);
            assert_eq!(l.cold, palette.colors().unwrap().accent);
            assert_eq!(l.mode, palette.mode());
            let apart: f32 = (0..3).map(|i| (l.warm[i] - l.cold[i]).powi(2)).sum();
            assert!(apart.sqrt() > 0.3, "{code}");
        }
        for code in [1, 5, 6, 255] {
            assert_eq!(look(code), look(2));
        }
    }
}
