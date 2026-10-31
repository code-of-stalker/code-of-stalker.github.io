//! «Ты не точка», page 04 of Step 5 «Внешнее кольцо». A point of light in
//! the dark opens into a ring: the orbit of observing everything outside.
//! A light runs the orbit and wakes the motes of the world it looks out at.
//! The ring unfolds into meridians and parallels, a sphere, and the camera
//! flies once around it while each named direction lights its side: in
//! front, to the side, above, below, behind, all around. Every value here is
//! a pure function of loop time; `browser.rs` only uploads it and the
//! shaders draw it. Unit: the sphere's radius.
use std::f32::consts::{PI, TAU};
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::SphereOrbit;

pub const LOOP_SECONDS: f32 = 54.0;

/// The lens: a 3:2 frame 40° tall (1 / tan 20°); a canvas of another shape
/// keeps the whole 3:2 frame in view.
pub const FOCAL: f32 = 2.747_477_4;
pub const FRAME_ASPECT: f32 = 1.5;
/// Lens blur, canvas heights per unit of |depth − focus| / depth: the
/// sphere sits in focus, near motes melt into soft discs.
pub const APERTURE: f32 = 0.0065;
/// A line's Gaussian width in canvas heights; its halo is `HALO_SPREAD`
/// times wider at `HALO` of its peak.
pub const LINE_WIDTH: f32 = 0.0011;
pub const HALO: f32 = 0.1;
pub const HALO_SPREAD: f32 = 3.5;
/// A wave is a softer, wider band than the lines it crosses.
pub const WAVE_WIDTH: f32 = 2.2;

/// The drawing: the orbit ring, its dial of ticks, six meridian circles
/// (twelve half-meridians), four parallels, the runner's gaze.
pub const RING_SEGMENTS: u32 = 256;
pub const CIRCLE_SEGMENTS: u32 = 128;
pub const MERIDIANS: u32 = 6;
/// Latitudes of the parallels, degrees.
pub const PARALLELS: [f32; 4] = [30.0, -30.0, 60.0, -60.0];
pub const TICKS: u32 = 72;
/// Short and long (every sixth) ticks, outward from the ring.
pub const TICK: [f32; 2] = [0.035, 0.075];
pub const GAZE: f32 = 1.9;
pub const GAZE_SEGMENTS: u32 = 12;
/// The world outside: near motes in a shell around the sphere, far ones
/// barely moving behind them.
pub const MOTES: [u32; 2] = [1100, 1400];
pub const NEAR_SHELL: [f32; 2] = [1.6, 8.0];
pub const FAR_SHELL: [f32; 2] = [16.0, 40.0];
/// The far world stays sharp: the most its motes blur, of the frame height.
pub const FAR_BLUR: f32 = 0.0008;
/// Where the meridians cross the ring and the parallels, and the poles: a
/// glint at each once the sphere has formed.
pub const NODES: u32 = MERIDIANS * 2 * (PARALLELS.len() as u32 + 1) + 2;

/// Peak light of each family before the named directions add theirs.
pub const RING_LIGHT: f32 = 0.95;
pub const TICK_LIGHT: f32 = 0.5;
pub const MERIDIAN_LIGHT: f32 = 0.5;
pub const PARALLEL_LIGHT: f32 = 0.4;
pub const GAZE_LIGHT: f32 = 0.5;
pub const NODE_LIGHT: f32 = 0.7;
pub const NEAR_LIGHT: f32 = 0.8;
pub const FAR_LIGHT: f32 = 0.9;
pub const WAVE_LIGHT: f32 = 1.8;
/// The runner's trail along the ring (radians to fade by 1/e) and how much
/// it adds to the ring and to the motes it looks at.
pub const RUNNER_TAIL: f32 = 0.9;
pub const RUNNER_GLOW: f32 = 1.6;
pub const MOTE_RUNNER: f32 = 1.5;
/// How much a named direction adds to the lines and motes on its side.
pub const CAP_GAIN: f32 = 1.6;
pub const MOTE_SEEN: f32 = 1.5;

/// «Ты не точка»: the point alone, breathing, only a few seconds.
/// «Ты — орбита (кольцо)…»: it opens into the ring; a light runs the orbit.
pub const OPEN: [f32; 2] = [3.0, 6.5];
pub const RUN: [f32; 2] = [6.0, 21.0];
/// The runner goes against the camera's turn: one lap in this many seconds,
/// from the near side of the ring.
pub const RUNNER_LAP: f32 = 6.0;
pub const RUNNER_FROM: f32 = 222.0 * PI / 180.0;
/// «Позволь себе чувствовать все»: the ring tilts up into the first
/// meridian, the meridians fan around, the parallels slide off the ring.
pub const TILT: [f32; 2] = [18.0, 20.0];
pub const FAN: [f32; 2] = [19.5, 23.0];
pub const SLIDE: [f32; 2] = [21.0, 24.0];
/// The first meridian stands up facing the camera.
pub const MERIDIAN_FROM: f32 = 161.0 * PI / 180.0;
/// «спереди, сбоку, сверху, снизу, сзади, вокруг»: 4 s each.
pub const DIRECTION_BEATS: [f32; 6] = [24.0, 28.0, 32.0, 36.0, 40.0, 44.0];
/// In front, to the side, above, below, behind.
pub const DIRECTIONS: [[f32; 3]; 5] = [
    [0.0, 0.0, 1.0],
    [-1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [0.0, -1.0, 0.0],
    [0.0, 0.0, -1.0],
];
/// The side the words leave out; it only answers «вокруг».
pub const UNNAMED: [f32; 3] = [1.0, 0.0, 0.0];
/// A named direction sends one wave over the sphere: a circle opening from
/// that side's pole to this far (radians) in this many seconds. «вокруг»
/// sends one from every side at once, each this much of the light.
pub const WAVE_SECONDS: f32 = 4.0;
pub const WAVE_REACH: f32 = 75.0 * PI / 180.0;
pub const WAVE_AROUND: f32 = 0.6;
/// The sphere fades back into the dark and the point returns.
pub const SETTLE: [f32; 2] = [48.5, 53.5];
/// Everything breathes about the centre: whole breaths a loop.
pub const BREATH: f32 = 6.0;
pub const BREATH_DEPTH: f32 = 0.012;
/// Reduced motion: the whole sphere lit, all around.
pub const STILL: f32 = 46.4;

/// The orbit: one turn a loop, slowest while the ring forms, fastest
/// through the directions.
pub const AZIMUTH_START: f32 = 162.0 * PI / 180.0;
pub const AZIMUTH_SWING: f32 = 50.0 * PI / 180.0;
pub const AZIMUTH_PEAK: f32 = 36.0;
/// The camera's height (degrees over the ring's plane) and distance, keyed
/// through the loop: low by the point, over the orbit, high for «сверху»,
/// under for «снизу», back out for «вокруг», then in to the point again.
pub const ELEVATION: [(f32, f32); 11] = [
    (0.0, 6.0),
    (3.0, 8.0),
    (12.0, 24.0),
    (20.0, 20.0),
    (26.4, 12.0),
    (30.4, 14.0),
    (34.4, 34.0),
    (38.4, -24.0),
    (42.4, 8.0),
    (46.4, 18.0),
    (51.0, 10.0),
];
pub const DISTANCE: [(f32, f32); 8] = [
    (0.0, 3.3),
    (2.5, 3.4),
    (8.0, 3.9),
    (18.0, 4.3),
    (25.0, 4.5),
    (40.0, 4.5),
    (46.0, 4.8),
    (49.5, 4.8),
];

/// The light themes engrave the scene: brightness up to this level
/// becomes ink, along this curve.
pub const ENGRAVE_WHITE: f32 = 0.9;
pub const ENGRAVE_GAMMA: f32 = 0.75;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    /// Loop time, for the shaders' own small motions.
    pub time: f32,
    /// The camera: around the centre (radians, unwrapped through the loop),
    /// over the ring's plane, and how far; its place and axes.
    pub azimuth: f32,
    pub elevation: f32,
    pub focus: f32,
    pub eye: [f32; 3],
    pub right: [f32; 3],
    pub up: [f32; 3],
    pub forward: [f32; 3],
    /// Scale of everything about the centre.
    pub breath: f32,
    /// The point's light.
    pub point: f32,
    /// The ring's radius and light, and how far its ticks have grown.
    pub ring: f32,
    pub orbit: f32,
    pub ticks: f32,
    /// The light running the orbit: its angle round the ring and strength.
    pub runner: [f32; 2],
    /// The unfolding: first meridian standing up, the fan, the parallels'
    /// slide, 0..1; and the light of the sphere's lines.
    pub tilt: f32,
    pub fan: f32,
    pub slide: f32,
    pub sphere: f32,
    /// In front, to the side, above, below, behind, all around.
    pub caps: [f32; 6],
    /// Each side's wave (the named five, then the unnamed one): how far it
    /// has opened from that side's pole (radians) and its light, 0..1.
    pub waves: [[f32; 2]; 6],
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
fn window(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

fn mix(a: f32, b: f32, t: f32) -> f32 {
    a * (1.0 - t) + b * t
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

fn normalize(a: [f32; 3]) -> [f32; 3] {
    let n = dot(a, a).sqrt();
    a.map(|v| v / n)
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

/// How strongly direction `i` (0 in front … 4 behind, 5 all around) is
/// named at `t`.
pub fn cap(i: usize, t: f32) -> f32 {
    let b = DIRECTION_BEATS[i];
    if i == 5 {
        window(t, b + 0.3, b + 1.5, b + 4.0, b + 6.0)
    } else {
        window(t, b + 0.3, b + 1.3, b + 3.6, b + 4.6)
    }
}

/// Side `i`'s wave at `t`: its own word's, or «вокруг»'s.
pub fn wave(i: usize, t: f32) -> [f32; 2] {
    let one = |from: f32, light: f32| {
        let p = (t - from) / WAVE_SECONDS;
        (0.0..1.0).contains(&p).then(|| {
            let opened = 1.0 - (1.0 - p) * (1.0 - p);
            [
                mix(0.06, WAVE_REACH, opened),
                light * smooth(0.0, 0.35, p) * (1.0 - p) * (1.0 - p),
            ]
        })
    };
    let own = (i < 5)
        .then(|| one(DIRECTION_BEATS[i] + 0.3, 1.0))
        .flatten();
    own.or_else(|| one(DIRECTION_BEATS[5] + 0.3, WAVE_AROUND))
        .unwrap_or([0.0, 0.0])
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let azimuth = AZIMUTH_START
        + TAU * time / LOOP_SECONDS
        + AZIMUTH_SWING * (TAU * (time - AZIMUTH_PEAK) / LOOP_SECONDS).sin();
    let elevation = spline(&ELEVATION, time).to_radians();
    let focus = spline(&DISTANCE, time);
    let (sa, ca) = azimuth.sin_cos();
    let (se, ce) = elevation.sin_cos();
    let eye = [focus * sa * ce, focus * se, focus * ca * ce];
    let forward = [-sa * ce, -se, -ca * ce];
    let right = normalize(cross(forward, [0.0, 1.0, 0.0]));
    let up = cross(right, forward);
    let caps = [0, 1, 2, 3, 4, 5].map(|i| cap(i, time));
    Frame {
        time,
        azimuth,
        elevation,
        focus,
        eye,
        right,
        up,
        forward,
        breath: 1.0 + BREATH_DEPTH * (TAU * time / BREATH).sin(),
        point: 1.0 - window(time, OPEN[0] + 0.5, OPEN[0] + 3.0, 50.0, SETTLE[1]),
        ring: smooth(OPEN[0], OPEN[1], time),
        orbit: window(time, OPEN[0], OPEN[0] + 1.5, 49.0, 52.5),
        ticks: window(time, OPEN[0] + 2.5, OPEN[0] + 5.5, SETTLE[0], 51.5),
        runner: [
            RUNNER_FROM - TAU * (time - RUN[0]) / RUNNER_LAP,
            window(time, RUN[0], RUN[0] + 1.5, RUN[1] - 2.5, RUN[1]),
        ],
        tilt: smooth(TILT[0], TILT[1], time),
        fan: smooth(FAN[0], FAN[1], time),
        slide: smooth(SLIDE[0], SLIDE[1], time),
        sphere: window(time, TILT[0], TILT[0] + 1.5, SETTLE[0], 52.0),
        caps,
        waves: [0, 1, 2, 3, 4, 5].map(|i| wave(i, time)),
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

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub light: bool,
    /// The lines' light, in the step's matrix green.
    pub glow: [f32; 3],
    pub deep: [f32; 3],
    pub mid: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}
const GREEN: [f32; 3] = [0.56, 1.0, 0.62];
/// Where the middle ink sits on the way from full ink to the page.
pub const MID_AT: f32 = 0.45;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    fn angle(a: [f32; 3], b: [f32; 3]) -> f32 {
        (dot(a, b) / (dot(a, a) * dot(b, b)).sqrt())
            .clamp(-1.0, 1.0)
            .acos()
            .to_degrees()
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
        assert!(close(before.azimuth - TAU, after.azimuth, 1e-3));
        assert!(close(before.focus, after.focus, 1e-3));
        assert!(close(before.breath, after.breath, 1e-4));
        // Only the point is there across the seam: the ring, the sphere,
        // the runner and every direction are dark.
        for f in [before, after] {
            assert!(f.point > 0.999, "{f:?}");
            assert_eq!(f.orbit, 0.0);
            assert_eq!(f.sphere, 0.0);
            assert_eq!(f.runner[1], 0.0);
            assert!(f.caps.iter().all(|&c| c == 0.0), "{f:?}");
        }
    }

    #[test]
    fn the_spline_passes_through_its_keys_and_closes() {
        for keys in [&ELEVATION[..], &DISTANCE[..]] {
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
                assert!((f.eye[i] - previous.eye[i]).abs() < 0.06, "eye at {t}");
            }
            assert!(f.azimuth - previous.azimuth < 0.004, "azimuth at {t}");
            assert!(
                (f.elevation - previous.elevation).abs() < 0.008,
                "elevation at {t}"
            );
            assert!((f.focus - previous.focus).abs() < 0.01, "focus at {t}");
            for (a, b) in [
                (f.point, previous.point),
                (f.orbit, previous.orbit),
                (f.ticks, previous.ticks),
                (f.runner[1], previous.runner[1]),
                (f.sphere, previous.sphere),
                (f.ring, previous.ring),
            ] {
                assert!((a - b).abs() < 0.02, "light at {t}");
            }
            for i in 0..6 {
                assert!(
                    (f.caps[i] - previous.caps[i]).abs() < 0.03,
                    "cap {i} at {t}"
                );
                // A wave's light; its radius jumps only as it starts or ends dark.
                let [radius, light] = f.waves[i];
                let [was, lit] = previous.waves[i];
                assert!((light - lit).abs() < 0.02, "wave {i} light at {t}");
                assert!(
                    (radius - was).abs() < 0.012 || light.min(lit) < 1e-3,
                    "wave {i} radius at {t}"
                );
            }
            previous = f;
            t += step;
        }
    }

    #[test]
    fn the_camera_flies_once_around() {
        let mut previous = compose(0.0).azimuth;
        for i in 1..=(LOOP_SECONDS * 10.0) as u32 {
            let a = compose(i as f32 / 10.0 - 1e-4).azimuth;
            assert!(a > previous, "{i}");
            previous = a;
        }
        assert!(close(previous - compose(0.0).azimuth, TAU, 1e-3));
        // Most of the turn happens through the directions.
        let turned =
            compose(DIRECTION_BEATS[5] + 4.0).azimuth - compose(DIRECTION_BEATS[0]).azimuth;
        assert!(turned > 0.65 * TAU, "{turned}");
    }

    #[test]
    fn the_drawing_stays_inside_the_frame() {
        let mut t = 0.0;
        while t < LOOP_SECONDS {
            let f = compose(t);
            // The ring with its ticks, and the sphere once it unfolds.
            let ring = (1.012 + TICK[1]) * f.ring * f.breath;
            for lat in (-6..=6).map(|k| k as f32 * 15.0_f32.to_radians()) {
                let r = if lat == 0.0 { ring } else { f.breath };
                if f.orbit <= 0.0 || (lat != 0.0 && f.sphere <= 0.0) {
                    continue;
                }
                for lon in (0..24).map(|k| k as f32 * 15.0_f32.to_radians()) {
                    let p = [
                        r * lat.cos() * lon.sin(),
                        r * lat.sin(),
                        r * lat.cos() * lon.cos(),
                    ];
                    let [x, y] = project(&f, p).expect("in front");
                    assert!(x.abs() < 0.86 && y.abs() < 0.8, "{t}: {x} {y}");
                }
            }
            // The point and the ring are never closer than the motes' shell.
            assert!(f.focus > NEAR_SHELL[0] + 1.5);
            t += 0.25;
        }
    }

    #[test]
    fn the_point_opens_into_the_ring_then_the_sphere() {
        let alone = compose(OPEN[0] - 0.5);
        assert_eq!(alone.point, 1.0);
        assert_eq!(alone.orbit, 0.0);
        let ring = compose(RUN[0] + 6.0);
        assert_eq!(ring.point, 0.0);
        assert_eq!((ring.ring, ring.orbit, ring.ticks), (1.0, 1.0, 1.0));
        assert_eq!(ring.runner[1], 1.0);
        assert_eq!(ring.sphere, 0.0);
        let sphere = compose(DIRECTION_BEATS[0] + 1.0);
        assert_eq!(
            (sphere.tilt, sphere.fan, sphere.slide, sphere.sphere),
            (1.0, 1.0, 1.0, 1.0)
        );
        assert_eq!(sphere.runner[1], 0.0);
        let settled = compose(SETTLE[1]);
        assert_eq!(
            (settled.orbit, settled.sphere, settled.ticks),
            (0.0, 0.0, 0.0)
        );
        assert_eq!(settled.point, 1.0);
        // The runner turns against the camera.
        assert!(compose(RUN[0] + 8.0).runner[0] < compose(RUN[0] + 3.0).runner[0]);
        // It starts on the ring's near side.
        let start = compose(RUN[0]);
        let toward = [start.runner[0].sin(), 0.0, start.runner[0].cos()];
        assert!(angle(toward, start.eye) < 30.0);
    }

    #[test]
    fn each_direction_lights_its_side_where_the_camera_sees_it() {
        for i in 0..6 {
            let at = DIRECTION_BEATS[i] + 2.4;
            let f = compose(at);
            assert!(f.caps[i] > 0.99, "{i}");
            for (j, &other) in f.caps.iter().enumerate() {
                if j != i {
                    assert!(other < 0.01, "{i}: {j} at {other}");
                }
            }
            if i < 5 {
                // Seen from the side, not head-on and not hidden behind.
                let a = angle(DIRECTIONS[i], f.eye);
                assert!((40.0..80.0).contains(&a), "{i}: {a}°");
            }
            // Only that side's wave runs; «вокруг» runs them all.
            for (j, [_, light]) in f.waves.iter().enumerate() {
                assert_eq!(*light > 0.0, i == 5 || j == i, "{i}: wave {j}");
            }
        }
        // Each wave has finished before the next one starts, and the last
        // before the sphere settles.
        for i in 0..6 {
            let next = DIRECTION_BEATS.get(i + 1).map_or(SETTLE[0], |b| b + 0.3);
            assert!(compose(next).waves.iter().all(|w| w[1] < 1e-3), "{i}");
        }
    }

    #[test]
    fn the_light_themes_never_light_the_page() {
        let pages = [
            (1, rgb(0xFA, 0xE1, 0x8F)),
            (5, rgb(0xF1, 0xDF, 0xB8)),
            (6, rgb(0xF3, 0xD8, 0xC7)),
        ];
        for (code, page) in pages {
            let look = look(code);
            assert!(look.light);
            for level in 0..=40 {
                let v = level as f32 / 20.0;
                let ink = engrave(&look, page, [v * 0.5, v, v * 0.6]);
                for i in 0..3 {
                    assert!(ink[i] <= page[i] + 1e-6);
                }
            }
            // Black stays the page itself.
            assert_eq!(engrave(&look, page, [0.0; 3]), page);
        }
        for code in [0, 2, 3, 4] {
            assert!(!look(code).light);
        }
    }

    #[test]
    fn the_still_frame_holds_the_whole_sphere() {
        let f = compose(STILL);
        assert!(f.caps[5] > 0.99);
        assert_eq!((f.sphere, f.orbit, f.fan, f.slide), (1.0, 1.0, 1.0, 1.0));
    }
}
