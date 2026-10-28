//! «Пробуждение»: a living close-up, a detached face of borrowed definitions.
//! The clock and all transforms are deterministic; platform code supplies time.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod fracture;
pub mod geometry;
pub mod mesh;
mod optics;
pub use optics::{frame_rect, look, Camera, Look, Projected};
use std::f32::consts::TAU;

pub const SIZE: [f32; 2] = [1536.0, 1024.0];
pub const LOOP_SECONDS: f32 = 36.0;
pub const STILL: f32 = 21.0;
/// Full-frame image plane, matching the pinhole camera below.
pub const FIGURE: [f32; 4] = [-2.0, -4.0 / 3.0, 2.0, 4.0 / 3.0];
pub const FACE_ORIGIN: [f32; 2] = [695.0, 390.0];

pub fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
pub fn bell(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}
pub fn lerp3(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    std::array::from_fn(|i| a[i] + (b[i] - a[i]) * t)
}
pub fn hash(n: u32) -> f32 {
    let mut x = n.wrapping_mul(0x9E37_79B9) ^ 0x85EB_CA6B;
    x ^= x >> 15;
    x = x.wrapping_mul(0x2C1B_3C6D);
    x ^= x >> 12;
    x = x.wrapping_mul(0x297A_2D39);
    x ^= x >> 15;
    (x & 0x00FF_FFFF) as f32 / 16_777_216.0
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Variant {
    Peel,
    CrackThenPeel,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Phase {
    Covered,
    Parting,
    Present,
    Returning,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub variant: Variant,
    /// Source motion clock for the shared deformation; scene time stays global.
    pub peel_time: f32,
    pub fracture_progress: f32,
    pub phase: Phase,
    pub camera: Camera,
    pub release: f32,
    pub mask_release: f32,
    pub mask_opacity: f32,
    pub mask_origin: [f32; 2],
    pub mask_turn: f32,
    pub tether: f32,
    pub breath: f32,
    pub blink: f32,
    pub pupil: f32,
    pub portrait_scale: f32,
    pub portrait_offset: [f32; 2],
    pub light: f32,
    pub contour: f32,
    pub presence: f32,
    pub weight: f32,
    pub soles: f32,
    pub flow: [f32; 3],
}
impl Frame {
    /// The background image and every authored feature share this one placement.
    pub fn portrait_point(&self, p: [f32; 2]) -> [f32; 2] {
        [
            FACE_ORIGIN[0]
                + (p[0] - FACE_ORIGIN[0]) * self.portrait_scale
                + self.portrait_offset[0],
            FACE_ORIGIN[1]
                + (p[1] - FACE_ORIGIN[1]) * self.portrait_scale
                + self.portrait_offset[1],
        ]
    }
    /// A raster surface peels from forehead to chin before drifting as a whole.
    /// Source coordinates remain unchanged; only this mesh is deformed.
    pub fn mask_point(&self, p: [f32; 3]) -> [f32; 2] {
        let reset = 1.0 - smooth(29.5, 32.5, self.time);
        let height = ((p[1] - 120.0) / 590.0).clamp(0.0, 1.0);
        let peel = smooth(4.5 + 4.6 * height, 9.2 + 4.6 * height, self.peel_time) * reset;
        let drift = smooth(11.5, 20.0, self.peel_time) * reset;
        let opening = peel * (1.0 - drift);
        let curl = (std::f32::consts::PI * peel).sin() * (1.0 - drift);
        let (s, c) = (self.mask_turn + 0.11 * opening).sin_cos();
        let local = [p[0] - FACE_ORIGIN[0], p[1] - FACE_ORIGIN[1], p[2]];
        let x = local[0] * c + local[2] * s;
        let z = local[2] * c - local[0] * s;
        let perspective = 1400.0 / (1400.0 + z * (drift + 0.5 * opening));
        let roll = -0.045 * drift - 0.02 * opening;
        let (sr, cr) = roll.sin_cos();
        self.portrait_point([
            self.mask_origin[0]
                + (x * cr - local[1] * sr) * perspective
                + 84.0 * opening
                + 18.0 * curl,
            self.mask_origin[1] + (x * sr + local[1] * cr) * perspective
                - 36.0 * opening
                - 18.0 * curl,
        ])
    }
}

pub fn compose(seconds: f32) -> Frame {
    compose_variant(seconds, Variant::Peel)
}

pub fn compose_variant(seconds: f32, variant: Variant) -> Frame {
    let t = if seconds.is_finite() {
        seconds.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    // The second film holds the same fitted surface through fracture growth,
    // then plays the approved deformation over its own 10–21 second interval.
    let peel_time = match variant {
        Variant::Peel => t,
        Variant::CrackThenPeel => 4.5 + (t - 10.0).max(0.0) * (15.5 / 11.0),
    };
    let parting = smooth(4.5, 18.5, peel_time);
    let reset = 1.0 - smooth(29.5, 32.5, t);
    let release = parting * reset;
    let drift = smooth(11.5, 20.0, peel_time) * reset;
    let fracture_progress = match variant {
        Variant::Peel => 0.0,
        Variant::CrackThenPeel => smooth(2.5, 8.5, t) * reset,
    };
    // Opaque throughout the reveal. Reset is entirely invisible, then the
    // fitted mask returns softly while its geometry is already at rest.
    let mask_opacity = 1.0 - smooth(25.0, 29.0, t) + smooth(33.0, 36.0, t);
    let (parting_start, parting_end) = match variant {
        Variant::Peel => (4.5, 20.0),
        Variant::CrackThenPeel => (10.0, 21.0),
    };
    let phase = if t < parting_start {
        Phase::Covered
    } else if t < parting_end {
        Phase::Parting
    } else if t < 29.5 {
        Phase::Present
    } else {
        Phase::Returning
    };
    let breath = 0.5 - 0.5 * (t / 6.0 * TAU).cos();
    let blink = [6.9, 18.8, 27.6]
        .iter()
        .map(|&at| bell(t, at, at + 0.065, at + 0.11, at + 0.24))
        .fold(0.0, f32::max);
    let pupil = bell(t, 7.0, 10.0, 16.0, 20.0) * 0.4 - bell(t, 22.0, 24.0, 28.0, 30.5) * 0.2;
    let camera = Camera {
        eye: [0.0, 0.0, -4.0],
        focal: 1536.0,
        center: [768.0, 512.0],
        focus: 4.0,
        aperture: 0.005,
    };
    Frame {
        time: t,
        variant,
        peel_time,
        fracture_progress,
        phase,
        camera,
        release,
        mask_release: release,
        mask_opacity,
        mask_origin: [
            FACE_ORIGIN[0] + 520.0 * drift,
            FACE_ORIGIN[1] - 26.0 * drift,
        ],
        mask_turn: 0.38 * drift,
        tether: bell(peel_time, 4.8, 7.0, 13.5, 17.0),
        breath,
        blink,
        pupil,
        portrait_scale: 1.0 + 0.012 * (0.5 - 0.5 * (t / LOOP_SECONDS * TAU).cos()),
        portrait_offset: [
            -10.0 * (t / LOOP_SECONDS * TAU).sin(),
            2.5 * (t / 6.0 * TAU).sin(),
        ],
        light: 0.76 + 0.24 * release,
        contour: 0.7 + 0.3 * release,
        presence: 0.15 + 0.55 * release,
        weight: 0.0,
        soles: 0.0,
        flow: [-0.15, 1.15, 0.0],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn loop_and_bad_clocks_are_safe() {
        for variant in [Variant::Peel, Variant::CrackThenPeel] {
            assert_eq!(
                compose_variant(0.0, variant),
                compose_variant(LOOP_SECONDS, variant)
            );
            assert_eq!(
                compose_variant(0.0, variant),
                compose_variant(f32::NAN, variant)
            );
            assert_eq!(
                compose_variant(0.0, variant),
                compose_variant(f32::INFINITY, variant)
            );
            for t in [0.0, 7.0, 14.0, 24.0] {
                assert_eq!(
                    compose_variant(t, variant),
                    compose_variant(t + 72.0, variant)
                );
            }
        }
        for t in [0.0, 4.5, 8.5, 12.0, 20.0, 27.0, 32.0, 35.5] {
            assert_eq!(compose(t), compose_variant(t, Variant::Peel));
            assert_eq!(compose(t).fracture_progress, 0.0);
        }
    }
    #[test]
    fn fractures_finish_before_the_mask_moves() {
        let sample = |t| compose_variant(t, Variant::CrackThenPeel);
        assert_eq!(sample(2.5).fracture_progress, 0.0);
        assert!((0.0..1.0).contains(&sample(5.5).fracture_progress));
        assert_eq!(sample(8.5).fracture_progress, 1.0);
        for t in [0.0, 2.5, 5.5, 8.5, 9.5, 10.0] {
            let f = sample(t);
            assert_eq!(f.mask_opacity, 1.0);
            for p in [
                [560.0, 125.0, -30.0],
                [858.0, 408.0, -80.0],
                [792.0, 680.0, -18.0],
            ] {
                assert_eq!(f.mask_point(p), f.portrait_point([p[0], p[1]]));
            }
        }
        assert!(
            sample(11.0).mask_point([660.0, 125.0, -30.0])[0]
                > sample(11.0).portrait_point([660.0, 125.0])[0]
        );
        for t in [10.0, 14.0, 18.0, STILL, 25.0, 29.0] {
            assert_eq!(sample(t).fracture_progress, 1.0);
        }
        let still = sample(STILL);
        assert_eq!(still.phase, Phase::Present);
        assert_eq!(still.mask_release, 1.0);
        assert_eq!(still.tether, 0.0);
        assert!(
            still.mask_point([858.0, 408.0, -80.0])[0] - still.portrait_point([858.0, 408.0])[0]
                > 450.0
        );
        for t in [29.5, 30.0, 31.0, 32.0, 32.5] {
            assert_eq!(sample(t).mask_opacity, 0.0);
        }
        for t in [33.0, 34.0, 35.0, 35.99] {
            let f = sample(t);
            assert_eq!(f.fracture_progress, 0.0);
            assert_eq!(
                f.mask_point([858.0, 408.0, -80.0]),
                f.portrait_point([858.0, 408.0])
            );
        }
    }
    #[test]
    fn shell_initially_fits_then_separates_from_the_face() {
        let fitted = compose(0.0);
        let free = compose(STILL);
        for p in [
            [660.0, 125.0, -30.0],
            [858.0, 408.0, -88.0],
            [792.0, 680.0, -18.0],
        ] {
            let a = fitted.mask_point(p);
            let b = fitted.portrait_point([p[0], p[1]]);
            assert!((a[0] - b[0]).abs() < 0.001 && (a[1] - b[1]).abs() < 0.001);
            assert!(free.mask_point(p)[0] - free.portrait_point([p[0], p[1]])[0] > 210.0);
        }
        assert_eq!(free.tether, 0.0);
        assert!(free.presence > fitted.presence);
        // The return takes place only after the departed shell has dissolved.
        assert!(compose(31.0).mask_opacity < 0.001);
    }
    #[test]
    fn opaque_mask_peels_from_the_forehead_before_the_chin() {
        let f = compose(7.5);
        let forehead = [660.0, 125.0, -30.0];
        let chin = [792.0, 680.0, -18.0];
        let top = f.mask_point(forehead);
        let bottom = f.mask_point(chin);
        let top_source = f.portrait_point([forehead[0], forehead[1]]);
        let bottom_source = f.portrait_point([chin[0], chin[1]]);
        assert!(top[0] - top_source[0] > 35.0);
        assert!(top[1] - top_source[1] < -20.0);
        assert!((bottom[0] - bottom_source[0]).abs() < 0.001);
        assert!((bottom[1] - bottom_source[1]).abs() < 0.001);
        for t in [0.0, 4.5, 7.5, 12.0, 18.0, STILL, 25.0] {
            assert_eq!(compose(t).mask_opacity, 1.0);
        }
    }
    #[test]
    fn reset_is_invisible_and_reappearance_is_already_fitted() {
        for i in 0..=30 {
            assert_eq!(compose(29.5 + i as f32 * 0.1).mask_opacity, 0.0);
        }
        for t in [33.0, 34.0, 35.0, 35.99] {
            let f = compose(t);
            for p in [
                [560.0, 235.0, -15.0],
                [858.0, 408.0, -80.0],
                [792.0, 680.0, -18.0],
            ] {
                assert_eq!(f.mask_point(p), f.portrait_point([p[0], p[1]]));
            }
        }
    }
    #[test]
    fn motion_has_no_visible_jumps_including_the_loop_seam() {
        for variant in [Variant::Peel, Variant::CrackThenPeel] {
            let mut last = compose_variant(35.99, variant);
            for i in 0..3600 {
                let f = compose_variant(i as f32 * 0.01, variant);
                for p in [
                    [660.0, 125.0, -30.0],
                    [858.0, 408.0, -88.0],
                    [792.0, 680.0, -18.0],
                ] {
                    let a = f.mask_point(p);
                    let b = last.mask_point(p);
                    assert!(a.iter().chain(b.iter()).all(|v| v.is_finite()));
                    // The short, invisible return may move faster than the reveal.
                    let maximum = if f.mask_opacity == 0.0 && last.mask_opacity == 0.0 {
                        3.5
                    } else {
                        1.5
                    };
                    assert!(
                        (a[0] - b[0]).abs() < maximum && (a[1] - b[1]).abs() < maximum,
                        "position jump at {} seconds: {a:?} vs {b:?}",
                        f.time
                    );
                }
                for v in [
                    f.mask_opacity,
                    f.mask_release,
                    f.tether,
                    f.blink,
                    f.fracture_progress,
                ] {
                    assert!((0.0..=1.0).contains(&v));
                }
                assert!((f.mask_opacity - last.mask_opacity).abs() < 0.008);
                assert!((f.fracture_progress - last.fracture_progress).abs() < 0.008);
                last = f;
            }
        }
    }
    #[test]
    fn all_palettes_keep_their_background_and_ink() {
        for code in 0..=6 {
            let l = look(code);
            for c in [l.paper, l.room, l.person, l.body, l.lamp] {
                assert!(c.iter().all(|v| v.is_finite() && (0.0..=1.0).contains(v)));
            }
            assert!(
                l.paper
                    .iter()
                    .zip(l.person)
                    .map(|(a, b)| (a - b).abs())
                    .sum::<f32>()
                    > 0.5
            );
        }
    }
}
