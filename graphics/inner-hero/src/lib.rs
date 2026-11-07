//! «Внутренняя сфера», the hero of Step 6. Art's painting: a figure seated
//! on a glass cube inside a glass sphere, an axis of light from the sphere's
//! crown to the floor, a star at the heart and a ring round the chest. The
//! camera drifts and leans in by a depth map, so the figure stands out of the
//! glass and the glass out of the nebula. Rust draws the ring in depth: it
//! turns, its front passes over the body and its back goes behind it.
//!
//! Every 18 seconds a beat: the crown star sends cold light down the axis to
//! the head, and a level plane of light scans the figure from the head down to
//! the feet, showing its inner lines as it passes; at the heart the heart
//! flares warm and the warmth fills the body, at the chest the ring flashes;
//! at the feet a ripple leaves them over the floor and its reflection. The
//! outside keeps the theme's cold light, the inside is warm. Every value here is a pure
//! function of loop time; `browser.rs` uploads it and the shader paints it.
use std::f32::consts::{PI, TAU};
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerHero;

/// The painting's canvas, in its own pixels (y down).
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// Two beats and one full camera orbit.
pub const LOOP_SECONDS: f32 = 36.0;
pub const BEAT_SECONDS: f32 = 18.0;
/// The scene opens quiet; the first beat starts after this.
pub const FIRST_BEAT: f32 = 3.0;

/// The axis of light (its x), and on it the heart, the crown star at the top
/// of the sphere and the root star on the floor under the cube.
pub const AXIS: f32 = 770.5;
pub const HEART: f32 = 351.0;
pub const CROWN: f32 = 33.0;
pub const ROOT: f32 = 954.0;
/// The chest ring as Art painted it (prepare.py erased it): centre and
/// radii. Its lower arc is the front.
pub const RING: [f32; 4] = [767.0, 482.5, 307.5, 21.0];
/// The glass sphere: centre and radius.
pub const SPHERE: [f32; 3] = [767.0, 491.0, 466.0];
/// The floor's far edge, and the row where the feet stand.
pub const HORIZON: f32 = 795.0;
pub const FEET: f32 = 885.0;
/// The middle of each foot on that row, left and right.
pub const FOOT_LEFT: f32 = 683.0;
pub const FOOT_RIGHT: f32 = 862.0;
/// The top of the head, where the scan enters the figure.
pub const SCAN_TOP: f32 = 215.0;

/// Art px a pixel moves per unit of nearness off the figure's (1) at full
/// drift: the nebula (0.4) goes one way, the floor's front edge (1.9) the other.
pub const SWING: f32 = 14.0;
/// The lean toward the heart at its deepest, as a scale per unit nearness.
pub const DOLLY: f32 = 0.008;
/// Nearness above which the lean grows no more (the floor's front edge).
pub const DOLLY_NEAR: f32 = 1.3;
/// The ring's front is this much nearer than the figure, its back as much farther.
pub const RING_DEPTH: f32 = 0.22;
/// The share of the painting the page hero shows: the rest is the drift's margin.
pub const ZOOM: f32 = 0.972;

/// The ring turns this many times a loop, and the heart breathes this often.
pub const RING_TURNS: f32 = 2.0;
pub const BREATHS: f32 = 6.0;
/// Each mote of the helix climbs it this many times a loop.
pub const MOTE_LAPS: f32 = 2.0;

/// Seconds after a beat starts: the cold light from the crown star reaches
/// the head and the scan enters it; the scan comes down, px per second.
pub const SCAN_AT: f32 = 0.7;
pub const SCAN_SPEED: f32 = 240.0;
/// The scan reaches the heart: the heart flares warm.
pub const CONVERGE: f32 = scan_arrival(HEART);
/// The warmth leaves the heart and spreads through the body, px per second,
/// never ahead of the scan.
pub const BODY_START: f32 = CONVERGE + 0.1;
pub const BODY_SPEED: f32 = 260.0;
/// The scan reaches the ring: two runners leave its front and meet at its back.
pub const RING_AT: f32 = scan_arrival(RING[1]);
pub const RING_SPEED: f32 = PI / 1.5;
/// The scan reaches the feet: a ripple leaves them over the floor, px per
/// second, the floor's flattening, and how far it goes.
pub const RIPPLE_AT: f32 = scan_arrival(FEET);
pub const RIPPLE_SPEED: f32 = 380.0;
pub const RIPPLE_FLAT: f32 = 0.16;
pub const RIPPLE_REACH: f32 = 760.0;
/// How long a lit place keeps its afterglow, seconds.
pub const AFTERGLOW: f32 = 3.0;
/// After this, nothing of a beat is left on screen.
pub const BEAT_QUIET: f32 = 10.5;
/// Reduced motion: the scan is in the legs, the body above it warm and the
/// ring lit.
pub const STILL: f32 = FIRST_BEAT + 2.8;

/// The geometry and timing above as the shader's `u_geo` array.
pub const GEOMETRY: [f32; 32] = [
    AXIS,
    HEART,
    CROWN,
    ROOT,
    RING[0],
    RING[1],
    RING[2],
    RING[3],
    SPHERE[0],
    SPHERE[1],
    SPHERE[2],
    HORIZON,
    FEET,
    SWING,
    DOLLY,
    RING_DEPTH,
    CONVERGE,
    BODY_START,
    BODY_SPEED,
    RING_AT,
    RING_SPEED,
    SCAN_AT,
    SCAN_SPEED,
    RIPPLE_AT,
    RIPPLE_SPEED,
    RIPPLE_FLAT,
    RIPPLE_REACH,
    DOLLY_NEAR,
    SCAN_TOP,
    FOOT_LEFT,
    FOOT_RIGHT,
    0.0,
];

/// The painting window a canvas shows, in painting px: centre x, y, width,
/// height. The 3:2 page hero shows the whole window; a home card of another
/// shape covers itself with a crop of it, kept on the axis.
pub fn window(cover: bool, width: f32, height: f32) -> [f32; 4] {
    let full = [SIZE[0] * ZOOM, SIZE[1] * ZOOM];
    let mid = [SIZE[0] * 0.5, SIZE[1] * 0.5];
    if !cover || !(width > 0.0 && height > 0.0) {
        return [mid[0], mid[1], full[0], full[1]];
    }
    let scale = (width / full[0]).max(height / full[1]);
    let view = [width / scale, height / scale];
    let room = ((full[0] - view[0]) * 0.5).max(0.0);
    let rise = ((full[1] - view[1]) * 0.5).max(0.0);
    // A wide card keeps the heart a little above its middle.
    let y = mid[1] - rise.min(mid[1] - (HEART + RING[1]) * 0.5);
    // max/min, not clamp: clamp's runtime bound check links the panic formatter.
    [
        AXIS.max(mid[0] - room).min(mid[0] + room),
        y.max(mid[1] - rise).min(mid[1] + rise),
        view[0],
        view[1],
    ]
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    /// Seconds since the current beat started.
    pub beat: f32,
    /// The camera's offset from rest, -1..1 on each axis.
    pub drift: [f32; 2],
    /// How far the camera leans toward the heart, 0..1.
    pub dolly: f32,
    /// The ring's turn, radians.
    pub spin: f32,
    /// The heart's breath, 0..1.
    pub breath: f32,
    /// How far the motes have climbed the helix, 0..1.
    pub climb: f32,
    /// The loop's phase, 0..TAU, for the ambient cycles.
    pub phase: f32,
}

/// Seconds since the beat that is on screen at `t` started.
pub fn beat_time(t: f32) -> f32 {
    (t - FIRST_BEAT).rem_euclid(BEAT_SECONDS)
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let phase = time / LOOP_SECONDS * TAU;
    let beat = beat_time(time);
    Frame {
        time,
        beat,
        drift: [phase.sin(), 0.45 * (2.0 * phase + 0.9).sin()],
        // Deepest four seconds into each beat, while the warmth fills the body.
        dolly: 0.5 - 0.5 * (TAU * (beat + 5.0) / BEAT_SECONDS).cos(),
        spin: (phase * RING_TURNS).rem_euclid(TAU),
        breath: 0.5 - 0.5 * (phase * BREATHS).cos(),
        climb: (time / LOOP_SECONDS * MOTE_LAPS).fract(),
        phase,
    }
}

/// When the scan plane passes a row of the figure.
pub const fn scan_arrival(y: f32) -> f32 {
    SCAN_AT + (y - SCAN_TOP) / SCAN_SPEED
}

/// When the cold light passes a row of the axis: from the crown star down to
/// the head, then with the scan.
pub fn axis_arrival(y: f32) -> f32 {
    if y <= SCAN_TOP {
        (y - CROWN) / (SCAN_TOP - CROWN) * SCAN_AT
    } else {
        scan_arrival(y)
    }
}

/// When the warmth reaches a point of the body: out from the heart, but only
/// where the scan has been.
pub fn body_arrival(x: f32, y: f32) -> f32 {
    (BODY_START + (x - AXIS).hypot(y - HEART) / BODY_SPEED).max(scan_arrival(y) + 0.1)
}

/// When the runners pass a point of the ring, `angle` radians from its front.
pub fn ring_arrival(angle: f32) -> f32 {
    let a = (angle + PI).rem_euclid(TAU) - PI;
    RING_AT + a.abs() / RING_SPEED
}

/// When the ripple passes a point of the floor: it leaves both feet at once.
pub fn ripple_arrival(x: f32, y: f32) -> f32 {
    let from = |foot: f32| (x - foot).hypot((y - FEET) / RIPPLE_FLAT);
    RIPPLE_AT + from(FOOT_LEFT).min(from(FOOT_RIGHT)) / RIPPLE_SPEED
}

/// Where the drifting, leaning camera shows a painting point of nearness
/// `near` (the shader's `view`).
pub fn view(f: &Frame, p: [f32; 2], near: f32) -> [f32; 2] {
    let scale = 1.0 + DOLLY * f.dolly * near.min(DOLLY_NEAR);
    let pivot = [AXIS, HEART];
    [0, 1].map(|i| pivot[i] + (p[i] - pivot[i]) * scale - f.drift[i] * SWING * (near - 1.0))
}

/// How one theme maps the painting and lights it.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// The recolor of the painting (scene-palette `recolor.frag`): 0 the
    /// accent by luminance (Искра, Матрица), 2 an ink on the paper (Тишина, Астрал).
    pub mode: f32,
    pub paper: [f32; 3],
    pub accent: [f32; 3],
    pub highlight: [f32; 3],
    /// The outside light: the axis pulses, the ring, the motes.
    pub cold: [f32; 3],
    /// The inside light: the heart and the body, and what it sends down.
    pub warm: [f32; 3],
    /// The white-hot cores of stars and runners.
    pub pale: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

/// The app theme by its `graphicsPalette` code: 0 Искра, 2 Тишина, 3 Астрал,
/// 4 Матрица. The site has only these dark themes; any other code shows Тишина.
/// The warm tones are those of the Step 6 page scenes (inner-echo).
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
    fn the_loop_closes_without_a_jump() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        let before = compose(LOOP_SECONDS - 0.001);
        let after = compose(0.001);
        for (a, b) in [
            (before.drift[0], after.drift[0]),
            (before.drift[1], after.drift[1]),
            (before.dolly, after.dolly),
            (before.breath, after.breath),
            (before.spin.sin(), after.spin.sin()),
            (before.spin.cos(), after.spin.cos()),
        ] {
            assert!(close(a, b, 0.01), "{a} {b}");
        }
        // Whole numbers of turns, breaths and laps, so nothing jumps at the seam.
        for cycles in [RING_TURNS, BREATHS, MOTE_LAPS, LOOP_SECONDS / BEAT_SECONDS] {
            assert_eq!(cycles.fract(), 0.0);
        }
    }

    #[test]
    fn nothing_jumps_when_the_next_beat_starts() {
        for k in 0..2 {
            let start = FIRST_BEAT + k as f32 * BEAT_SECONDS;
            let before = compose(start - 0.001);
            let after = compose(start + 0.001);
            assert!(close(before.dolly, after.dolly, 0.001));
            assert!(before.beat > BEAT_SECONDS - 0.01 && after.beat < 0.01);
        }
    }

    #[test]
    fn the_light_comes_down_the_axis_without_a_gap() {
        assert!(close(axis_arrival(CROWN), 0.0, 1e-6));
        assert!(close(axis_arrival(SCAN_TOP), SCAN_AT, 1e-6));
        assert!(close(axis_arrival(SCAN_TOP + 0.01), SCAN_AT, 1e-4));
        assert!(close(axis_arrival(HEART), CONVERGE, 1e-6));
        assert!(close(axis_arrival(FEET), RIPPLE_AT, 1e-6));
        // It only goes down.
        for y in [100.0, 300.0, 500.0, 800.0] {
            assert!(axis_arrival(y + 10.0) > axis_arrival(y));
        }
    }

    #[test]
    fn the_scan_goes_head_heart_ring_feet() {
        let order = [
            SCAN_AT,
            CONVERGE,
            body_arrival(AXIS, HEART),
            RING_AT,
            ring_arrival(PI),
            RIPPLE_AT,
            ripple_arrival(AXIS, FEET + 60.0),
        ];
        assert!(order.windows(2).all(|w| w[0] < w[1]), "{order:?}");
        // The ripple starts under both feet.
        assert!(close(ripple_arrival(FOOT_LEFT, FEET), RIPPLE_AT, 1e-6));
        assert!(close(ripple_arrival(FOOT_RIGHT, FEET), RIPPLE_AT, 1e-6));
        assert!(ripple_arrival(AXIS, FEET) > RIPPLE_AT);
        // The warmth is never ahead of the scan; the head warms after the chest.
        for y in [230.0, 351.0, 500.0, 700.0, FEET] {
            assert!(body_arrival(AXIS, y) > scan_arrival(y), "{y}");
        }
        assert!(body_arrival(AXIS, 260.0) > body_arrival(AXIS, 380.0));
        assert!(body_arrival(AXIS, FEET) > body_arrival(AXIS, 260.0));
    }

    #[test]
    fn a_beat_is_gone_before_the_next_one() {
        let latest = [
            body_arrival(AXIS, FEET),
            body_arrival(AXIS - 200.0, FEET),
            ring_arrival(PI),
            scan_arrival(ROOT),
            RIPPLE_AT + RIPPLE_REACH / RIPPLE_SPEED,
        ];
        for t in latest {
            assert!(t + AFTERGLOW <= BEAT_QUIET, "{t}");
        }
        const { assert!(BEAT_QUIET < BEAT_SECONDS) };
    }

    #[test]
    fn the_still_shows_the_scan_a_warm_body_and_a_lit_ring() {
        let f = compose(STILL);
        assert!(f.beat > body_arrival(AXIS, 500.0), "{}", f.beat);
        assert!(f.beat > RING_AT && f.beat < ring_arrival(PI) + AFTERGLOW);
        // The scan is still in the legs.
        assert!(f.beat > scan_arrival(600.0) && f.beat < RIPPLE_AT);
    }

    #[test]
    fn values_stay_finite_and_small() {
        for i in 0..=3600 {
            let f = compose(i as f32 * 0.01);
            assert!(f.drift.iter().all(|v| v.is_finite() && v.abs() <= 1.0));
            assert!((0.0..=1.0).contains(&f.dolly));
            assert!((0.0..=1.0).contains(&f.breath));
            assert!((0.0..TAU).contains(&f.spin));
            assert!((0.0..1.0).contains(&f.climb));
            assert!(f.beat >= 0.0 && f.beat < BEAT_SECONDS);
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
    }

    #[test]
    fn the_heart_holds_still_and_the_drift_never_shows_an_edge() {
        let margin = [SIZE[0] * (1.0 - ZOOM) * 0.5, SIZE[1] * (1.0 - ZOOM) * 0.5];
        for i in 0..=360 {
            let f = compose(i as f32 * 0.1);
            let heart = view(&f, [AXIS, HEART], 1.0);
            assert!(close(heart[0], AXIS, 1e-3) && close(heart[1], HEART, 1e-3));
            // Each edge of the window shows painting at any nearness the map holds.
            for near in [0.4, 0.85, 1.0, 1.9] {
                for p in [
                    [0.0, 0.0],
                    [SIZE[0], 0.0],
                    [0.0, SIZE[1]],
                    [SIZE[0], SIZE[1]],
                ] {
                    let q = view(&f, p, near);
                    for axis in 0..2 {
                        let inside = if p[axis] == 0.0 {
                            q[axis] <= margin[axis]
                        } else {
                            q[axis] >= SIZE[axis] - margin[axis]
                        };
                        assert!(inside, "{near} {p:?} {q:?}");
                    }
                }
            }
        }
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
            assert!(l.warm[0] > l.warm[2] + 0.3, "{code}");
        }
        // Retired light codes and unknown codes show Тишина.
        for code in [1, 5, 6, 255] {
            assert_eq!(look(code), look(2));
        }
    }

    #[test]
    fn a_card_crops_the_painting_without_stretching_it() {
        let full = window(false, 300.0, 400.0);
        assert_eq!(full, [768.0, 512.0, SIZE[0] * ZOOM, SIZE[1] * ZOOM]);
        assert_eq!(window(true, 0.0, 400.0), full);
        for (width, height) in [
            (300.0, 400.0),
            (640.0, 330.0),
            (1536.0, 1024.0),
            (900.0, 300.0),
        ] {
            let [x, y, w, h] = window(true, width, height);
            assert!(close(w / h, width / height, 1e-4), "{width}×{height}");
            assert!(x - w * 0.5 >= full[0] - full[2] * 0.5 - 1e-3);
            assert!(x + w * 0.5 <= full[0] + full[2] * 0.5 + 1e-3);
            assert!(y - h * 0.5 >= full[1] - full[3] * 0.5 - 1e-3);
            assert!(y + h * 0.5 <= full[1] + full[3] * 0.5 + 1e-3);
            // The heart and the axis stay in frame.
            assert!((x - AXIS).abs() < w * 0.5, "{width}×{height}");
            assert!((y - HEART).abs() < h * 0.5, "{width}×{height}");
        }
    }
}
