//! «Внутрь», page 01 of Step 6 «Внутреннее кольцо». A seated figure drawn
//! in cold height lines sits in the middle of the outer ring: a circle of
//! ticks on the floor with a radar sweep and the world's signals flaring up
//! as it passes. Three waves run from the figure out to the ring («взгляд,
//! слух, восприятие раскрываются как орбита»). Then a horizontal slice comes
//! down through the crown and rests at the chest («ты переходишь внутрь»);
//! the cut face shows warm growth rings, and a warm inner ring comes up on
//! it, murky at first: it sinks, it is measured, it is pushed about, images
//! of the self lift off it. Each «Без…» takes one of these away until the
//! inner ring is as clear as the outer one. Then it opens: ticks and a sweep
//! of its own, turning with the outer sweep, signals of its own; both rings
//! flash once together («здесь и сейчас») and the slice rises out through
//! the crown. Every value here is a pure function of loop time;
//! `browser.rs` only uploads it and one ray-marched pass draws it. Unit: the
//! outer ring is 1.05 across its radius, the seated figure about 1 high.
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerSlice;

pub const LOOP_SECONDS: f32 = 60.0;

/// The lens: a 3:2 frame 34° tall (1 / tan 17°); a canvas of another shape
/// keeps the whole 3:2 frame in view.
pub const FOCAL: f32 = 3.270_852_6;
pub const FRAME_ASPECT: f32 = 1.5;

/// The outer ring on the floor and its ticks (between the two radii).
pub const RING: f32 = 1.05;
pub const TICKS: f32 = 72.0;
pub const TICK_SPAN: [f32; 2] = [1.065, 1.115];
/// The sweep turns this many whole times a loop: once every six seconds.
pub const SWEEP_TURNS: f32 = 10.0;
/// The world's signals: this many each turn, between these radii, lit as
/// the sweep passes and fading over this long.
pub const BLIPS: usize = 7;
pub const BLIP_SPAN: [f32; 2] = [0.62, 0.98];
pub const BLIP_SECONDS: f32 = 2.8;

/// The figure's crown; the slice waits over it, and comes to rest at the
/// chest.
pub const CROWN: f32 = 0.985;
pub const ABOVE: f32 = 1.12;
pub const CHEST: f32 = 0.47;
/// The inner ring on the chest's cut, its ticks once it opens, and the
/// signals on it each turn.
pub const INNER: f32 = 0.08;
pub const INNER_TICKS: f32 = 36.0;
pub const INNER_SIGNALS: usize = 3;
/// The slice's own rim while it moves: its radius.
pub const RIM: f32 = 0.58;
/// The body's height lines and the cut face's growth rings: their spacing.
pub const ISOLINE: f32 = 0.026;
pub const CONTOUR: f32 = 0.016;
/// A sphere round the whole figure: rays that miss it never march.
pub const BOUND: [f32; 4] = [0.0, 0.5, 0.08, 0.68];

/// «взгляд, слух, восприятие раскрываются как орбита»: a wave from the
/// figure out to the ring for each; it runs from this radius, this long.
pub const WAVES: [f32; 3] = [1.2, 2.6, 4.0];
pub const WAVE_FROM: f32 = 0.42;
pub const WAVE_SECONDS: f32 = 1.8;
/// «ты переходишь внутрь»: the slice comes down from over the crown to the
/// chest.
pub const DESCENT: [f32; 2] = [10.0, 15.0];
/// «внутреннее замечается так же ясно, как внешнее»: the inner ring comes up
/// on the cut, murky.
pub const NOTICE: [f32; 2] = [15.5, 18.5];
/// «Без проваливания», «Без анализа», «Без попытки понять или исправить»,
/// «Без ухода в образы себя»: each takes one disturbance away over
/// `LET_GO`: the sinking, the measuring, the pushing about, the images.
pub const WITHOUT: [f32; 4] = [20.0, 22.5, 25.0, 28.0];
pub const LET_GO: f32 = 1.4;
/// How murky the inner ring is with every disturbance on it (0..1 clear).
pub const MURK: f32 = 0.2;
/// While it sinks the growth rings drain inward, this many a second.
pub const FLOW: f32 = 0.9;
/// «Это — Наблюдение внутреннего кольца, которое раскрывается»: the inner
/// ring gets its ticks and its sweep.
pub const OPEN: [f32; 2] = [31.0, 34.0];
/// «живое Ощущение и Осознавание … здесь и сейчас»: signals on the inner
/// ring.
pub const SIGNALS: [f32; 2] = [43.0, 45.0];
/// «здесь и сейчас»: both rings flash once together.
pub const TOGETHER: f32 = 50.0;
/// The slice rises out through the crown; the inner ring goes first.
pub const RISE: [f32; 2] = [54.6, 58.6];
/// Reduced motion: both rings clear, the inner one open.
pub const STILL: f32 = 40.0;

/// The camera: its height over the floor (degrees), distance and the height
/// it looks at, keyed through the loop. Three quarters from the front for
/// the body, close over the cut for the inner ring, high over both rings
/// once it opens, then down again.
pub const ELEVATION: [(f32, f32); 12] = [
    (0.0, 42.0),
    (7.0, 45.0),
    (10.5, 49.0),
    (15.0, 60.0),
    (21.0, 64.0),
    (29.0, 67.0),
    (35.0, 75.0),
    (41.0, 77.0),
    (47.0, 67.0),
    (52.0, 65.0),
    (55.0, 60.0),
    (58.0, 46.0),
];
/// Close while the inner ring clears, far while it opens against the outer
/// ring (P3), close again for its own signals (P4), wide enough at «здесь и
/// сейчас» to keep both rings.
pub const DISTANCE: [(f32, f32); 11] = [
    (0.0, 2.9),
    (8.0, 2.85),
    (11.0, 2.55),
    (15.5, 1.75),
    (21.0, 1.55),
    (29.0, 1.6),
    (36.0, 2.6),
    (41.0, 2.8),
    (47.0, 1.95),
    (52.0, 2.1),
    (56.0, 2.8),
];
pub const TARGET: [(f32, f32); 9] = [
    (0.0, 0.36),
    (9.0, 0.4),
    (15.5, 0.47),
    (30.0, 0.47),
    (37.0, 0.32),
    (41.0, 0.28),
    (47.0, 0.42),
    (52.0, 0.4),
    (57.0, 0.36),
];
/// A slow sway round the figure, back where it began each loop.
pub const SWAY: f32 = 20.0 * std::f32::consts::PI / 180.0;

/// Line width: a Gaussian this wide in canvas heights, and its halo,
/// `HALO_SPREAD` times wider at `HALO` of its peak.
pub const LINE_WIDTH: f32 = 0.0011;
pub const HALO: f32 = 0.1;
pub const HALO_SPREAD: f32 = 4.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    /// Loop time, for the shader's own small motions.
    pub time: f32,
    /// The camera: round the figure, over the floor (radians), how far from
    /// the point it looks at; its place and axes.
    pub azimuth: f32,
    pub elevation: f32,
    pub distance: f32,
    pub eye: [f32; 3],
    pub right: [f32; 3],
    pub up: [f32; 3],
    pub forward: [f32; 3],
    /// The sweep's angle on the floor (radians, round the y axis from +x
    /// toward +z), the same for both rings.
    pub sweep: f32,
    /// The outer ring's light (1 at rest, more as a wave arrives or both
    /// rings flash).
    pub outer: f32,
    /// The orbit waves: each one's radius and light.
    pub waves: [[f32; 2]; 3],
    /// The slice's height (over the crown: nothing is cut) and its rim's
    /// light while it moves.
    pub slice: f32,
    pub rim: f32,
    /// The inner ring: its light, how clear it is (0..1), how far it has
    /// opened (ticks and sweep), its signals' light.
    pub inner: f32,
    pub clarity: f32,
    pub open: f32,
    pub signals: f32,
    /// The disturbances on it: sinking, measuring, pushing about, images of
    /// the self (0..1 each).
    pub sink: f32,
    pub analysis: f32,
    pub fixing: f32,
    pub images: f32,
    /// How far the growth rings have drained inward (in rings).
    pub flow: f32,
    /// Both rings flashing together (0..1).
    pub together: f32,
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
fn window(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

/// The integral of `smooth(a, b, x)` from far before `a` to `t`.
fn ramp_integral(a: f32, b: f32, t: f32) -> f32 {
    let u = ((t - a) / (b - a)).clamp(0.0, 1.0);
    (b - a) * (u * u * u - 0.5 * u * u * u * u) + (t - b).max(0.0)
}

fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn dot(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/// A smooth closed curve through `keys` (time, value) around the loop:
/// Catmull–Rom tangents, cubic Hermite pieces.
pub fn spline(keys: &[(f32, f32)], t: f32) -> f32 {
    let n = keys.len() as isize;
    let mut t = t.rem_euclid(LOOP_SECONDS);
    let i = keys
        .iter()
        .rposition(|k| k.0 <= t)
        .map_or(n - 1, |i| i as isize);
    let key = |j: isize| {
        let (at, value) = keys[j.rem_euclid(n) as usize];
        (at + LOOP_SECONDS * j.div_euclid(n) as f32, value)
    };
    let [(t0, v0), (t1, v1), (t2, v2), (t3, v3)] = [i - 1, i, i + 1, i + 2].map(key);
    if t < t1 {
        t += LOOP_SECONDS;
    }
    let (m1, m2) = ((v2 - v0) / (t2 - t0), (v3 - v1) / (t3 - t1));
    let h = t2 - t1;
    let s = (t - t1) / h;
    let (s2, s3) = (s * s, s * s * s);
    (2.0 * s3 - 3.0 * s2 + 1.0) * v1
        + (s3 - 2.0 * s2 + s) * h * m1
        + (3.0 * s2 - 2.0 * s3) * v2
        + (s3 - s2) * h * m2
}

/// Orbit wave `i` at `t`: its radius and light; it eases out as it reaches
/// the ring and melts into it.
pub fn wave(i: usize, t: f32) -> [f32; 2] {
    let age = t - WAVES[i];
    if !(0.0..WAVE_SECONDS + 0.8).contains(&age) {
        return [0.0, 0.0];
    }
    let x = (age / WAVE_SECONDS).min(1.0);
    let reach = 1.0 - (1.0 - x).powi(3);
    [
        WAVE_FROM + (RING - WAVE_FROM) * reach,
        smooth(0.0, 0.5, age) * (1.0 - smooth(WAVE_SECONDS - 0.2, WAVE_SECONDS + 0.6, age)),
    ]
}

/// How much of disturbance `i` is on the inner ring.
pub fn disturbance(i: usize, t: f32) -> f32 {
    smooth(NOTICE[0], NOTICE[1], t) * (1.0 - smooth(WITHOUT[i], WITHOUT[i] + LET_GO, t))
}

/// Where the slice is: over the crown, down to the chest, back out.
pub fn slice(t: f32) -> f32 {
    ABOVE + (CHEST - ABOVE) * (smooth(DESCENT[0], DESCENT[1], t) - smooth(RISE[0], RISE[1], t))
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let azimuth = SWAY * (TAU * time / LOOP_SECONDS).sin();
    let elevation = spline(&ELEVATION, time).to_radians();
    let distance = spline(&DISTANCE, time);
    let target = spline(&TARGET, time);
    let (sa, ca) = azimuth.sin_cos();
    let (se, ce) = elevation.sin_cos();
    let eye = [
        distance * sa * ce,
        target + distance * se,
        distance * ca * ce,
    ];
    let forward = [-sa * ce, -se, -ca * ce];
    // Level with the floor however high the camera climbs.
    let right = [ca, 0.0, -sa];
    let up = cross(right, forward);

    let waves: [[f32; 2]; 3] = std::array::from_fn(|i| wave(i, time));
    // A wave arriving brightens the ring a little; both rings flash at
    // «здесь и сейчас».
    let arrival =
        |at: f32| smooth(at - 0.35, at + 0.15, time) * (-(time - at - 0.15).max(0.0) / 0.6).exp();
    let together = arrival(TOGETHER);
    let outer = 1.0
        + 0.45
            * WAVES
                .iter()
                .map(|&w| arrival(w + WAVE_SECONDS))
                .sum::<f32>()
        + 0.7 * together;

    let sink = disturbance(0, time);
    let analysis = disturbance(1, time);
    let fixing = disturbance(2, time);
    let images = disturbance(3, time);
    let cleared = WITHOUT
        .iter()
        .map(|&w| smooth(w, w + LET_GO, time))
        .sum::<f32>()
        / 4.0;
    let flow = FLOW
        * (ramp_integral(NOTICE[0], NOTICE[1], time)
            - ramp_integral(WITHOUT[0], WITHOUT[0] + LET_GO, time));

    let moving = window(
        time,
        DESCENT[0] - 0.8,
        DESCENT[0] + 0.3,
        DESCENT[1] - 0.6,
        DESCENT[1] + 0.9,
    ) + window(
        time,
        RISE[0] - 0.2,
        RISE[0] + 0.6,
        RISE[1] - 0.9,
        RISE[1] + 0.3,
    );

    Frame {
        time,
        azimuth,
        elevation,
        distance,
        eye,
        right,
        up,
        forward,
        sweep: TAU * SWEEP_TURNS * time / LOOP_SECONDS,
        outer,
        waves,
        slice: slice(time),
        rim: moving,
        inner: window(time, NOTICE[0], NOTICE[1], RISE[0] - 1.0, RISE[0] + 0.2),
        clarity: MURK + (1.0 - MURK) * cleared,
        open: window(time, OPEN[0], OPEN[1], RISE[0] - 1.2, RISE[0]),
        signals: window(time, SIGNALS[0], SIGNALS[1], RISE[0] - 1.6, RISE[0] - 0.4),
        sink,
        analysis,
        fixing,
        images,
        flow,
        together,
    }
}

/// Where a world point lands in a 3:2 frame, -1..1 both ways; None behind
/// the camera.
pub fn project(f: &Frame, point: [f32; 3]) -> Option<[f32; 2]> {
    let v = [0, 1, 2].map(|i| point[i] - f.eye[i]);
    let z = dot(v, f.forward);
    (z > 0.0).then(|| {
        [
            dot(v, f.right) / z * FOCAL / FRAME_ASPECT,
            dot(v, f.up) / z * FOCAL,
        ]
    })
}

/// The scene's three lights in a theme's colors: the cold outer world and
/// the body's lines, the warm inner ring, and the pale of outlines and
/// sparks. The page itself comes from the app (`backdrop`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub cold: [f32; 3],
    pub warm: [f32; 3],
    pub pale: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

/// The app theme by its `graphicsPalette` code (0 Искра, 2 Тишина, 3 Астрал,
/// 4 Матрица). The cold light is the theme's accent; the warm one is a
/// second tone that stays apart from it. The site shows only the dark
/// themes; the retired light codes fall back to Тишина.
pub fn look(code: u32) -> Look {
    match Palette::from_code(code) {
        // Искра: the yellow of the theme, an ember inside.
        Palette::Dark => Look {
            cold: rgb(245, 221, 7),
            warm: rgb(255, 122, 40),
            pale: rgb(255, 244, 170),
        },
        // Астрал: the blue of the theme, a rose-peach inside.
        Palette::Violet => Look {
            cold: rgb(98, 150, 245),
            warm: rgb(240, 158, 128),
            pale: rgb(200, 212, 248),
        },
        // Матрица: code green, amber inside.
        Palette::Matrix => Look {
            cold: rgb(0, 255, 65),
            warm: rgb(255, 184, 64),
            pale: rgb(190, 255, 205),
        },
        // Тишина: sea glass, warm sand inside.
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

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    fn every(step: f32, mut check: impl FnMut(f32)) {
        let mut t = 0.0;
        while t < LOOP_SECONDS {
            check(t);
            t += step;
        }
    }

    #[test]
    fn the_loop_closes_without_a_jump() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
        let before = compose(LOOP_SECONDS - 0.001);
        let after = compose(0.001);
        for i in 0..3 {
            assert!(close(before.eye[i], after.eye[i], 1e-3), "{i}");
            assert!(close(before.forward[i], after.forward[i], 1e-3), "{i}");
        }
        let turn = before.sweep - after.sweep;
        assert!(close(turn.cos(), 1.0, 1e-4) && close(turn.sin(), 0.0, 5e-3));
        // Nothing cut, no inner ring, a quiet outer ring across the seam.
        for f in [before, after] {
            assert!(f.slice > CROWN, "{f:?}");
            assert_eq!([f.inner, f.open, f.signals, f.rim], [0.0; 4], "{f:?}");
            assert!(f.waves.iter().all(|w| w[1] == 0.0));
            assert!(close(f.outer, 1.0, 1e-3));
        }
    }

    #[test]
    fn the_sweep_turns_whole_times_a_loop_once_every_six_seconds() {
        assert_eq!(SWEEP_TURNS.fract(), 0.0);
        assert!(close(LOOP_SECONDS / SWEEP_TURNS, 6.0, 1e-6));
        assert!(close(compose(6.0).sweep - compose(0.0).sweep, TAU, 1e-4));
    }

    #[test]
    fn the_first_wave_comes_at_once() {
        // Art: a loop must not open with a long empty beat.
        const _: () = assert!(WAVES[0] <= 1.5);
        assert!(compose(WAVES[0] + 0.5).waves[0][1] > 0.9);
        // Each wave runs out from the figure and reaches the ring.
        for (i, &at) in WAVES.iter().enumerate() {
            let start = wave(i, at + 0.01)[0];
            let end = wave(i, at + WAVE_SECONDS)[0];
            assert!(
                close(start, WAVE_FROM, 0.02) && close(end, RING, 1e-4),
                "{i}"
            );
        }
    }

    #[test]
    fn the_spline_passes_through_its_keys_and_closes() {
        for keys in [&ELEVATION[..], &DISTANCE[..], &TARGET[..]] {
            for &(at, value) in keys {
                assert!(close(spline(keys, at), value, 1e-4), "{at}");
            }
            assert!(close(
                spline(keys, LOOP_SECONDS - 1e-3),
                spline(keys, 0.0),
                1e-3
            ));
        }
    }

    #[test]
    fn the_motion_is_smooth() {
        let step = 1.0 / 60.0;
        let mut previous = compose(0.0);
        let mut t = step;
        while t < LOOP_SECONDS {
            let f = compose(t);
            for i in 0..3 {
                assert!((f.eye[i] - previous.eye[i]).abs() < 0.04, "eye at {t}");
                assert!(
                    (f.forward[i] - previous.forward[i]).abs() < 0.01,
                    "forward at {t}"
                );
            }
            assert!((f.slice - previous.slice).abs() < 0.01, "slice at {t}");
            assert!((f.flow - previous.flow).abs() < 0.02, "flow at {t}");
            let lights = |f: &Frame| {
                [
                    f.outer, f.rim, f.inner, f.clarity, f.open, f.signals, f.sink, f.analysis,
                    f.fixing, f.images, f.together,
                ]
            };
            for (a, b) in lights(&f).into_iter().zip(lights(&previous)) {
                // The clarity jumps back to murky only while the ring is
                // dark, across the seam.
                if f.inner > 0.0 || previous.inner > 0.0 || a == f.outer {
                    assert!((a - b).abs() < 0.06, "light at {t}: {a} {b}");
                }
            }
            for i in 0..3 {
                assert!(
                    (f.waves[i][1] - previous.waves[i][1]).abs() < 0.06,
                    "wave {i} at {t}"
                );
            }
            previous = f;
            t += step;
        }
    }

    #[test]
    fn the_slice_comes_down_softly_and_rests_at_the_chest() {
        assert!(compose(DESCENT[0] - 0.01).slice > CROWN);
        // No overshoot: it never goes below the chest.
        every(0.01, |t| assert!(compose(t).slice >= CHEST - 1e-5, "{t}"));
        every(0.25, |t| {
            if (DESCENT[1]..RISE[0]).contains(&t) {
                assert!(close(compose(t).slice, CHEST, 1e-5), "{t}");
            }
        });
        assert!(compose(RISE[1] + 0.01).slice > CROWN);
    }

    #[test]
    fn each_without_takes_one_disturbance_away_in_turn() {
        let at = |t: f32| {
            let f = compose(t);
            [f.sink, f.analysis, f.fixing, f.images]
        };
        // All of them are on the ring once it is noticed.
        assert!(at(WITHOUT[0] - 0.1).iter().all(|&d| d > 0.99));
        for i in 0..4 {
            let gone = at(WITHOUT[i] + LET_GO + 0.01);
            for (j, d) in gone.iter().enumerate() {
                assert_eq!(*d < 0.01, j <= i, "{i}: {j} at {d}");
            }
            // Each «Без» reads on its own: the next one only after this one
            // is gone.
            if i < 3 {
                assert!(WITHOUT[i] + LET_GO <= WITHOUT[i + 1] + 0.3);
            }
        }
        // The ring grows clearer step by step, and is as clear as the outer
        // ring before it opens.
        let mut previous = compose(NOTICE[1]).clarity;
        assert!(close(previous, MURK, 1e-6));
        every(0.05, |t| {
            if (NOTICE[1]..OPEN[0]).contains(&t) {
                let c = compose(t).clarity;
                assert!(c >= previous - 1e-6, "{t}");
                previous = c;
            }
        });
        assert!(close(compose(OPEN[0]).clarity, 1.0, 1e-6));
    }

    #[test]
    fn the_sinking_drains_and_then_stands_still() {
        let a = compose(NOTICE[1] + 0.5).flow;
        let b = compose(NOTICE[1] + 1.5).flow;
        assert!(close(b - a, FLOW, 1e-3), "{a} {b}");
        let rest = compose(WITHOUT[0] + LET_GO).flow;
        assert!(close(compose(RISE[0]).flow, rest, 1e-5));
    }

    #[test]
    fn the_inner_ring_opens_flashes_with_the_outer_and_goes_before_the_slice_lifts() {
        let f = compose(STILL);
        assert!(f.inner > 0.99 && f.open > 0.99 && close(f.clarity, 1.0, 1e-6));
        assert!(close(f.slice, CHEST, 1e-6));
        let flash = compose(TOGETHER + 0.15);
        assert!(flash.together > 0.9 && flash.outer > 1.5);
        assert!(compose(TOGETHER - 1.0).together < 0.01);
        assert!(compose(TOGETHER + 4.0).together < 0.02);
        // The ring is dark before the cut has risen past the chest.
        every(0.02, |t| {
            let f = compose(t);
            if f.slice > CHEST + 0.03 && t > OPEN[0] {
                assert!(f.inner < 0.05, "{t}: {f:?}");
            }
        });
    }

    #[test]
    fn the_camera_keeps_above_the_floor_and_every_ray_meets_it() {
        every(0.05, |t| {
            let f = compose(t);
            let degrees = f.elevation.to_degrees();
            // The frame's top ray (17° over the axis) still points down.
            assert!(degrees > 17.0 + 15.0 && degrees < 85.0, "{t}: {degrees}");
            assert!(f.eye[1] > ABOVE + 0.3, "{t}");
        });
    }

    #[test]
    fn the_figure_stays_in_frame_and_the_outer_ring_never_leaves_it() {
        let figure = [
            [0.0, CROWN, 0.0],
            [0.46, 0.07, 0.17],
            [-0.46, 0.07, 0.17],
            [0.0, 0.05, 0.32],
            [0.0, 0.1, -0.15],
            [0.3, 0.6, 0.0],
            [-0.3, 0.6, 0.0],
        ];
        every(0.1, |t| {
            let f = compose(t);
            for p in figure {
                let [x, y] = project(&f, p).expect("in front");
                assert!(x.abs() < 0.9 && y.abs() < 0.9, "{t}: {p:?} at {x} {y}");
            }
            let seen = (0..72)
                .filter(|k| {
                    let a = *k as f32 / 72.0 * TAU;
                    project(&f, [RING * a.cos(), 0.0, RING * a.sin()])
                        .is_some_and(|[x, y]| x.abs() < 1.0 && y.abs() < 1.0)
                })
                .count();
            assert!(seen >= 18, "{t}: {seen} of 72 ring points in view");
        });
    }

    #[test]
    fn the_inner_ring_reads_on_the_cut_when_the_camera_is_close() {
        // At the «Без…» beats the ring is at least a tenth of the frame wide.
        for &at in &WITHOUT {
            let f = compose(at);
            let [a, _] = project(&f, [-INNER, CHEST, 0.0]).unwrap();
            let [b, _] = project(&f, [INNER, CHEST, 0.0]).unwrap();
            assert!((b - a).abs() > 0.2, "{at}: {}", (b - a).abs());
        }
    }

    #[test]
    fn every_dark_theme_keeps_its_accent_cold_and_a_warm_apart_from_it() {
        for code in [0, 2, 3, 4] {
            let look = look(code);
            let accent = Palette::from_code(code).colors().unwrap().accent;
            assert_eq!(look.cold, accent, "{code}");
            // The warm light is warm, and far from the cold one.
            let apart = (0..3)
                .map(|i| (look.warm[i] - look.cold[i]).powi(2))
                .sum::<f32>();
            assert!(look.warm[0] > look.warm[2] + 0.3, "{code}");
            assert!(apart.sqrt() > 0.3, "{code}: {}", apart.sqrt());
        }
        assert_eq!(look(1), look(2));
        assert_eq!(look(99), look(2));
    }
}
