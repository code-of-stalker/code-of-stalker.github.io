//! «Маяк», the home card of Step 7. Art's painting: a man of green glass
//! on a spiral stair inside a lighthouse, his hand on the brass rail, his
//! face turned up to the lamp at the top of the well; daylight falls in
//! shafts from a window behind him, and a faint glass sphere stands round
//! him. The camera rises and sinks like a crane and leans toward the lamp by
//! a depth map, so the stair comes out of the well. Rust draws the three
//! rings in depth: the first rides the sphere, the second rings his body,
//! the third lies on the tread under his feet.
//!
//! Every 20 seconds a beat, from his feet out to the space round him: a
//! glint runs up the rail to his hand; the third ring flares under his feet;
//! the second ring sinks to his ankles and rises to his crown, showing his
//! inner lines as it passes; a thread of light runs from his eyes to the
//! lamp; the lamp turns its beam to us and its light falls down the well,
//! and where it reaches the sphere the first ring flashes; the second ring
//! comes down to his waist again and brings the lamp's warmth into him.
//! Between beats dust drifts in the shafts, the sky breathes and the lamp's
//! beam sweeps the well. Every value here is a pure function of loop time;
//! `browser.rs` uploads it and the shader paints it.
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::LighthouseHero;

/// The painting's canvas, in its own pixels (y down).
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// Two beats and one full rise and fall of the camera.
pub const LOOP_SECONDS: f32 = 40.0;
pub const BEAT_SECONDS: f32 = 20.0;
/// The scene opens quiet; the first beat starts after this.
pub const FIRST_BEAT: f32 = 2.5;

/// The top of his head, his eye, his hand on the rail, the row his soles
/// stand on and the middle of each foot on it.
pub const CROWN: f32 = 150.0;
pub const EYE: [f32; 2] = [597.0, 172.0];
pub const HAND: [f32; 2] = [790.0, 495.0];
pub const SOLES: f32 = 884.0;
pub const FOOT_LEFT: f32 = 488.0;
pub const FOOT_RIGHT: f32 = 596.0;
/// His axis, for he leans a little: its x at the crown, at the waist and at
/// the soles, and the waist's row.
pub const AXIS: [f32; 4] = [582.0, 566.0, 542.0, 540.0];
/// His nearness in the depth map at the crown and at the soles.
pub const NEAR_SPAN: [f32; 2] = [0.82, 1.17];
/// The painting's eye level and focal length, px: a level ring at row y shows
/// a minor radius of its radius × (y − HORIZON) / FOCAL; above the eye level
/// its upper arc is the front.
pub const HORIZON: f32 = 760.0;
pub const FOCAL: f32 = 1000.0;
/// The glass sphere round him (Art painted its rim): centre and radius.
pub const SPHERE: [f32; 3] = [570.0, 445.0, 405.0];
/// The lighthouse lamp at the top of the well.
pub const LAMP: [f32; 2] = [1275.0, 72.0];
/// The window's opening: left, top, right, bottom.
pub const WINDOW: [f32; 4] = [326.0, 178.0, 404.0, 600.0];
/// Where the thread from his eyes bends on its way to the lamp.
pub const GAZE_BEND: [f32; 2] = [860.0, 40.0];
/// The brass rail's middle line from the camera up to his hand, with its
/// half width: x, y, half width.
pub const RAIL: [[f32; 3]; 10] = [
    [1124.0, 1024.0, 44.0],
    [1102.0, 914.0, 40.0],
    [1086.0, 845.0, 34.0],
    [1063.0, 775.0, 28.0],
    [1032.0, 714.0, 24.0],
    [1002.0, 668.0, 20.0],
    [963.0, 621.0, 17.0],
    [917.0, 575.0, 14.0],
    [855.0, 525.0, 12.0],
    [790.0, 495.0, 10.0],
];

/// The first ring's plane leans this far from level (radians) and turns
/// about the vertical, so it wobbles but never shows edge-on; the second
/// ring's radius round his body, the third's on the tread.
pub const RING1_TILT: f32 = 0.135;
pub const RING2_RADIUS: f32 = 116.0;
pub const RING3_RADIUS: f32 = 128.0;
/// How much nearer than its centre a ring's front is: the second's, and the
/// sphere's at its front.
pub const RING_DEPTH: f32 = 0.2;
pub const SPHERE_DEPTH: f32 = 0.35;

/// Art px a pixel moves per unit of nearness off his (1) at full drift: the
/// far well (0) goes one way, the rail and the column in front (2) the other.
pub const SWING: f32 = 15.0;
/// The lean toward the lamp at its deepest, as a scale per unit nearness,
/// and the nearness above which it grows no more.
pub const DOLLY: f32 = 0.008;
pub const DOLLY_NEAR: f32 = 1.3;
/// The share of the painting the page hero shows: the rest is the drift's margin.
pub const ZOOM: f32 = 0.955;

/// The lamp turns once in this many seconds; it faces us at `LAMP_AT`.
pub const BEAM_SECONDS: f32 = 10.0;
/// Each loop the rings' beads go round this many times, the first ring's
/// plane turns this many times, and he breathes this often.
pub const RING_TURNS: f32 = 2.0;
pub const PRECESSION: f32 = 1.0;
pub const BREATHS: f32 = 5.0;

/// Seconds after a beat starts. The glint runs up the rail and reaches his
/// hand; the third ring flares under his feet.
pub const TOUCH: f32 = 1.3;
pub const FLOOR_AT: f32 = TOUCH + 0.2;
/// The third ring's ripple over the tread: px per second and how far.
pub const RIPPLE_SPEED: f32 = 230.0;
pub const RIPPLE_REACH: f32 = 330.0;
/// The second ring rests at his waist; it sinks to his ankles, rises to just
/// over his crown (the scan), waits there, and comes down to rest.
pub const REST: f32 = AXIS[3];
pub const ANKLE: f32 = 856.0;
pub const TOP: f32 = 138.0;
pub const SINK: [f32; 2] = [TOUCH, 1.0];
pub const RISE: [f32; 2] = [SINK[0] + SINK[1], 2.9];
pub const DESCEND: [f32; 2] = [7.7, 4.2];
/// Below his waist the warmth goes on down to his soles, px per second.
pub const WARM_SPEED: f32 = 190.0;
/// The thread from his eyes to the lamp: start and length.
pub const GAZE: [f32; 2] = [RISE[0] + RISE[1] - 0.1, 0.95];
/// The lamp faces us and flares; its light falls down the well, px per second.
pub const LAMP_AT: f32 = GAZE[0] + GAZE[1];
pub const FALL_SPEED: f32 = 520.0;
/// The falling light reaches the sphere: two runners leave the first ring's
/// top and meet at its bottom in this many seconds.
pub const RING1_AT: f32 = fall_arrival_at(sphere_reach());
pub const RUNNERS: f32 = 1.7;
/// How long a lit place keeps its afterglow, seconds.
pub const AFTERGLOW: f32 = 3.0;
/// After this, nothing of a beat is left on screen.
pub const BEAT_QUIET: f32 = 18.0;
/// Reduced motion: the thread has reached the lamp, the lamp faces us, the
/// second ring stands over his head and his inner lines keep the scan.
pub const STILL: f32 = FIRST_BEAT + LAMP_AT + 0.25;

/// The geometry and timing above as the shader's `u_geo` array.
pub const GEOMETRY: [f32; 64] = [
    // u_geo[0..4]: the man.
    CROWN,
    EYE[0],
    EYE[1],
    SOLES,
    HAND[0],
    HAND[1],
    FOOT_LEFT,
    FOOT_RIGHT,
    AXIS[0],
    AXIS[1],
    AXIS[2],
    AXIS[3],
    NEAR_SPAN[0],
    NEAR_SPAN[1],
    HORIZON,
    FOCAL,
    // u_geo[4..8]: the places.
    SPHERE[0],
    SPHERE[1],
    SPHERE[2],
    RING1_TILT,
    LAMP[0],
    LAMP[1],
    GAZE_BEND[0],
    GAZE_BEND[1],
    WINDOW[0],
    WINDOW[1],
    WINDOW[2],
    WINDOW[3],
    RING2_RADIUS,
    RING3_RADIUS,
    RING_DEPTH,
    SPHERE_DEPTH,
    // u_geo[8..12]: the camera and the beat.
    SWING,
    DOLLY,
    DOLLY_NEAR,
    TOUCH,
    FLOOR_AT,
    RIPPLE_SPEED,
    RIPPLE_REACH,
    REST,
    ANKLE,
    TOP,
    RISE[0],
    RISE[1],
    DESCEND[0],
    DESCEND[1],
    WARM_SPEED,
    GAZE[0],
    // u_geo[12..16]: the lamp and the first ring.
    GAZE[1],
    LAMP_AT,
    FALL_SPEED,
    RING1_AT,
    RUNNERS,
    BEAM_SECONDS,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
];

/// The rail as the shader's `u_rail` array: x, y, half width per point.
pub fn rail() -> [f32; 30] {
    let mut out = [0.0; 30];
    for (i, p) in RAIL.iter().enumerate() {
        out[i * 3..i * 3 + 3].copy_from_slice(p);
    }
    out
}

/// The painting window a canvas shows, in painting px: centre x, y, width,
/// height. The 3:2 page hero shows the whole window; a home card of another
/// shape covers itself with a crop of it, kept between him and the lamp.
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
    // A tall card keeps him; a wide one keeps the lamp at its top.
    let x = (AXIS[1] + LAMP[0]) * 0.5 - 120.0;
    let y = mid[1] - rise.min(100.0);
    // max/min, not clamp: clamp's runtime bound check links the panic formatter.
    [
        x.max(mid[0] - room).min(mid[0] + room),
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
    /// How far the camera leans toward the lamp, 0..1.
    pub dolly: f32,
    /// The beads' turn on the rings, radians.
    pub spin: f32,
    /// His breath, 0..1.
    pub breath: f32,
    /// The lamp's turn, radians: 0 faces us.
    pub beam: f32,
    /// The first ring's plane, its turn about the vertical, radians.
    pub precession: f32,
    /// The row the second ring stands at.
    pub ring2: f32,
    /// The loop's phase, 0..TAU, for the ambient cycles.
    pub phase: f32,
}

/// Seconds since the beat that is on screen at `t` started.
pub fn beat_time(t: f32) -> f32 {
    (t - FIRST_BEAT).rem_euclid(BEAT_SECONDS)
}

fn smooth(s: f32) -> f32 {
    let s = s.clamp(0.0, 1.0);
    s * s * (3.0 - 2.0 * s)
}

/// The inverse of `smooth` on 0..1.
fn unsmooth(v: f32) -> f32 {
    let v = v.clamp(0.0, 1.0);
    0.5 - ((1.0 - 2.0 * v).asin() / 3.0).sin()
}

/// The row the second ring stands at, `beat` seconds into a beat.
pub fn ring2_row(beat: f32) -> f32 {
    let ease = |from: f32, to: f32, span: [f32; 2]| {
        from + (to - from) * smooth((beat - span[0]) / span[1])
    };
    if beat < RISE[0] {
        ease(REST, ANKLE, SINK)
    } else if beat < DESCEND[0] {
        ease(ANKLE, TOP, RISE)
    } else {
        ease(TOP, REST, DESCEND)
    }
}

/// When the rising second ring passes row `y` of his body (the scan); his
/// feet below the ankles light when it gets there.
pub fn rise_arrival(y: f32) -> f32 {
    RISE[0] + RISE[1] * unsmooth((ANKLE - y) / (ANKLE - TOP))
}

/// When the lamp's warmth reaches row `y` of his body: with the second ring
/// down to his waist, then on down to his soles.
pub fn warm_arrival(y: f32) -> f32 {
    if y <= REST {
        DESCEND[0] + DESCEND[1] * unsmooth((y - TOP) / (REST - TOP))
    } else {
        DESCEND[0] + DESCEND[1] + (y - REST) / WARM_SPEED
    }
}

/// When the lamp's falling light reaches a point at `distance` px from it.
pub const fn fall_arrival_at(distance: f32) -> f32 {
    LAMP_AT + distance / FALL_SPEED
}

/// How far the falling light goes before it reaches the sphere.
pub const fn sphere_reach() -> f32 {
    // const: no sqrt; the lamp is 797.6 px from the sphere's centre.
    797.6 - SPHERE[2]
}

/// When the third ring's ripple passes a point of its plane `rho` px from his feet.
pub fn ripple_arrival(rho: f32) -> f32 {
    FLOOR_AT + rho / RIPPLE_SPEED
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
        // The crane: once up and down a loop, a small sway across it.
        drift: [0.35 * (2.0 * phase + 1.1).sin(), phase.sin()],
        // Deepest while the lamp's light falls to him.
        dolly: 0.5 + 0.5 * (TAU * (beat - LAMP_AT - 1.4) / BEAT_SECONDS).cos(),
        spin: (phase * RING_TURNS).rem_euclid(TAU),
        breath: 0.5 - 0.5 * (phase * BREATHS).cos(),
        beam: (TAU * (beat - LAMP_AT) / BEAM_SECONDS).rem_euclid(TAU),
        precession: (phase * PRECESSION).rem_euclid(TAU),
        ring2: ring2_row(beat),
        phase,
    }
}

/// Where the drifting, leaning camera shows a painting point of nearness
/// `near` (the shader's `view`): the lean pivots on the lamp.
pub fn view(f: &Frame, p: [f32; 2], near: f32) -> [f32; 2] {
    let scale = 1.0 + DOLLY * f.dolly * near.min(DOLLY_NEAR);
    [0, 1].map(|i| LAMP[i] + (p[i] - LAMP[i]) * scale - f.drift[i] * SWING * (near - 1.0))
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
    /// The rings, the scan and the thread of his gaze.
    pub cold: [f32; 3],
    /// The lamp, the daylight in the shafts and the warmth in him.
    pub warm: [f32; 3],
    /// The white-hot cores of the lamp and the runners.
    pub pale: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

/// The app theme by its `graphicsPalette` code: 0 Искра, 2 Тишина, 3 Астрал,
/// 4 Матрица. The site has only these dark themes; any other code shows Тишина.
/// The warm tones are those of the Step 6 hero.
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

/// The rail's length from the camera to his hand, px.
pub fn rail_length() -> f32 {
    RAIL.windows(2)
        .map(|w| (w[1][0] - w[0][0]).hypot(w[1][1] - w[0][1]))
        .sum()
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
            (before.ring2, after.ring2),
            (before.spin.sin(), after.spin.sin()),
            (before.beam.cos(), after.beam.cos()),
            (before.precession.sin(), after.precession.sin()),
        ] {
            assert!(close(a, b, 0.05), "{a} {b}");
        }
        // Whole numbers of turns and breaths, so nothing jumps at the seam.
        for cycles in [
            RING_TURNS,
            PRECESSION,
            BREATHS,
            LOOP_SECONDS / BEAT_SECONDS,
            BEAT_SECONDS / BEAM_SECONDS,
        ] {
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
            assert!(close(before.ring2, after.ring2, 0.01));
            assert!(before.beat > BEAT_SECONDS - 0.01 && after.beat < 0.01);
        }
    }

    #[test]
    fn the_second_ring_never_jumps_and_rests_at_his_waist() {
        let mut last = ring2_row(0.0);
        assert_eq!(last, REST);
        for i in 1..=20_000 {
            let row = ring2_row(i as f32 * 0.001);
            assert!((row - last).abs() < 0.6, "{i} {last} {row}");
            assert!((TOP..=ANKLE).contains(&row));
            last = row;
        }
        assert_eq!(ring2_row(BEAT_QUIET), REST);
        assert_eq!(ring2_row(RISE[0]), ANKLE);
        assert_eq!(ring2_row(RISE[0] + RISE[1]), TOP);
        assert_eq!(ring2_row(DESCEND[0]), TOP);
    }

    #[test]
    fn the_scan_and_the_warmth_follow_the_ring() {
        for y in [TOP, 200.0, 300.0, 450.0, 600.0, 750.0, ANKLE] {
            assert!(close(ring2_row(rise_arrival(y)), y, 0.5), "{y}");
        }
        for y in [TOP, 200.0, 300.0, 450.0, REST] {
            assert!(close(ring2_row(warm_arrival(y)), y, 0.5), "{y}");
        }
        // The warmth goes on down from his waist to his soles without a gap.
        assert!(close(warm_arrival(REST), warm_arrival(REST + 0.01), 1e-3));
        for y in [200.0, 400.0, 600.0, 800.0] {
            assert!(warm_arrival(y + 10.0) > warm_arrival(y));
            assert!(rise_arrival(y + 10.0) < rise_arrival(y));
        }
    }

    #[test]
    fn the_beat_goes_from_his_feet_out_to_the_sphere() {
        let order = [
            TOUCH,
            FLOOR_AT,
            rise_arrival(ANKLE),
            rise_arrival(CROWN),
            GAZE[0],
            LAMP_AT,
            RING1_AT,
            fall_arrival_at((LAMP[0] - AXIS[0]).hypot(LAMP[1] - CROWN)),
            DESCEND[0],
            warm_arrival(REST),
            warm_arrival(SOLES),
        ];
        assert!(order.windows(2).all(|w| w[0] < w[1]), "{order:?}");
        // The ring flashes as the light gets to the sphere.
        let reach = (LAMP[0] - SPHERE[0]).hypot(LAMP[1] - SPHERE[1]) - SPHERE[2];
        assert!(close(RING1_AT, fall_arrival_at(reach), 0.01));
        // The thread meets the lamp as it faces us.
        assert!(compose(FIRST_BEAT + LAMP_AT).beam.cos() > 0.9999);
        // The ripple starts as the ring flares.
        assert_eq!(ripple_arrival(0.0), FLOOR_AT);
    }

    #[test]
    fn a_beat_is_gone_before_the_next_one() {
        let corner = (LAMP[0]).hypot(SIZE[1] - LAMP[1]);
        let latest = [
            warm_arrival(SOLES),
            fall_arrival_at(corner),
            RING1_AT + RUNNERS,
            ripple_arrival(RIPPLE_REACH),
            DESCEND[0] + DESCEND[1],
        ];
        for t in latest {
            assert!(t + AFTERGLOW <= BEAT_QUIET, "{t}");
        }
        const { assert!(BEAT_QUIET < BEAT_SECONDS) };
    }

    #[test]
    fn the_still_shows_the_scanned_man_and_the_lamp_facing_us() {
        let f = compose(STILL);
        assert!(f.beat > rise_arrival(CROWN) && f.beat < DESCEND[0]);
        assert!(close(f.ring2, TOP, 1e-3));
        assert!(f.beam.cos() > 0.9);
        assert!(f.beat > GAZE[0] + GAZE[1]);
    }

    #[test]
    fn values_stay_finite_and_small() {
        for i in 0..=4000 {
            let f = compose(i as f32 * 0.01);
            assert!(f.drift.iter().all(|v| v.is_finite() && v.abs() <= 1.0));
            assert!((0.0..=1.0).contains(&f.dolly));
            assert!((0.0..=1.0).contains(&f.breath));
            for angle in [f.spin, f.beam, f.precession, f.phase] {
                assert!((0.0..TAU).contains(&angle) || close(angle, TAU, 1e-4));
            }
            assert!(f.beat >= 0.0 && f.beat < BEAT_SECONDS);
            assert!(f.ring2.is_finite());
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
        for v in [-1.0, 0.0, 0.3, 1.0, 2.0] {
            assert!(unsmooth(v).is_finite());
            assert!(close(
                smooth(unsmooth(v.clamp(0.0, 1.0))),
                v.clamp(0.0, 1.0),
                1e-4
            ));
        }
    }

    #[test]
    fn he_barely_moves_and_the_drift_never_shows_an_edge() {
        let margin = [SIZE[0] * (1.0 - ZOOM) * 0.5, SIZE[1] * (1.0 - ZOOM) * 0.5];
        for i in 0..=400 {
            let f = compose(i as f32 * 0.1);
            // A point of his nearness on the lamp holds still; he moves a few px.
            let lamp = view(&f, LAMP, 1.0);
            assert!(close(lamp[0], LAMP[0], 1e-3) && close(lamp[1], LAMP[1], 1e-3));
            let waist = view(&f, [AXIS[1], REST], 1.06);
            assert!(close(waist[0], AXIS[1], 8.0) && close(waist[1], REST, 8.0));
            // Each edge of the window shows painting at any nearness the map holds.
            for near in [0.0, 0.5, 1.0, 1.5, 2.0] {
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
    fn the_rail_runs_from_the_camera_up_to_his_hand() {
        assert_eq!(RAIL[0][1], SIZE[1]);
        assert_eq!([RAIL[9][0], RAIL[9][1]], HAND);
        // Up all the way, and thinner as it goes away.
        assert!(RAIL
            .windows(2)
            .all(|w| w[1][1] < w[0][1] && w[1][2] <= w[0][2]));
        assert!((600.0..800.0).contains(&rail_length()), "{}", rail_length());
        assert_eq!(rail()[27..30], RAIL[9]);
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
            (390.0, 330.0),
            (520.0, 400.0),
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
            // His head and his hand stay in frame.
            for p in [EYE, HAND] {
                assert!(
                    (p[0] - x).abs() < w * 0.5 && (p[1] - y).abs() < h * 0.5,
                    "{width}×{height}"
                );
            }
            // A card no taller than wide (and at most twice as wide) keeps the lamp too.
            if width >= height && width <= 2.0 * height {
                assert!((LAMP[0] - x).abs() < w * 0.5 - 30.0, "{width}×{height}");
                assert!((LAMP[1] - y).abs() < h * 0.5, "{width}×{height}");
            }
        }
    }
}
