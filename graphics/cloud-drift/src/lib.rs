//! Independent art review. All choreography, deformation and rendering live in Rust.
//! The application and its approved scenes are deliberately not coupled to this study.
use std::f32::consts::TAU;

pub const LOOP_SECONDS: f64 = 16.0;

#[derive(Clone, Debug)]
pub struct Frame {
    pub camera: [f32; 4],
    pub hero: [f32; 4],
    pub cloth: [f32; 4],
    pub cloud: [f32; 4],
    pub wind: [f32; 4],
    pub scan: [f32; 4],
    pub objects: [[f32; 4]; 4],
    pub phase: f32,
}

pub fn compose(seconds: f64, strength: f32) -> Frame {
    let seconds = if seconds.is_finite() { seconds } else { 0.0 };
    let a = if strength.is_finite() {
        strength.clamp(0.0, 1.5)
    } else {
        1.0
    };
    let p = (seconds.rem_euclid(LOOP_SECONDS) / LOOP_SECONDS) as f32 * TAU;
    let gust =
        ((0.5 + 0.5 * (p - 1.3).cos()).powi(18) + (0.5 + 0.5 * (p - 4.9).cos()).powi(24)) * a;
    let scan_progress = ((seconds.rem_euclid(LOOP_SECONDS) as f32 - 6.0) / 4.6).clamp(0.0, 1.0);
    let fade = |x: f32| {
        let x = x.clamp(0.0, 1.0);
        x * x * (3.0 - 2.0 * x)
    };
    let scan_envelope = fade(scan_progress / 0.1) * fade((1.0 - scan_progress) / 0.1) * a.min(1.0);
    let objects = std::array::from_fn(|i| {
        let delay = i as f32 * 1.47;
        [
            (p + delay).sin() * 7.0 * a,
            (p + delay).cos() * 9.0 * a,
            (p + delay).sin() * 0.018 * a,
            1.0 + (p * 2.0 + delay).sin() * 0.11 * a,
        ]
    });
    Frame {
        camera: [
            p.sin() * 5.0 * a,
            (p.cos() - 1.0) * 3.0 * a,
            0.98 + (1.0 - p.cos()) * 0.006 * a,
            p,
        ],
        hero: [
            p.sin() * 11.0 * a,
            (p.cos() - 1.0) * 9.0 * a,
            p.sin() * 0.016 * a,
            (p - 0.5).sin() * 0.023 * a,
        ],
        cloth: [
            (p * 2.0).sin() * a,
            (p * 2.0 - 0.75).sin() * a,
            (p - 1.2).sin() * a,
            a,
        ],
        cloud: [
            p.sin() * 11.0 * a,
            (p.cos() - 1.0) * 6.0 * a,
            (p * 2.0 + 0.7).sin() * 3.5 * a,
            a,
        ],
        wind: [
            gust,
            (p * 6.0).sin() * gust,
            (p * 9.0 - 0.7).sin() * gust,
            p,
        ],
        scan: [
            -180.0 + scan_progress * 2200.0,
            scan_envelope,
            scan_progress,
            0.0,
        ],
        objects,
        phase: p,
    }
}

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::CloudDrift;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn loop_is_continuous_in_value_and_velocity() {
        let first = compose(0.0, 1.0);
        let last = compose(LOOP_SECONDS, 1.0);
        assert_eq!(first.camera, last.camera);
        assert_eq!(first.hero, last.hero);
        assert_eq!(first.objects, last.objects);
        assert_eq!(first.wind, last.wind);
        assert_eq!(first.scan, last.scan);
        let before = compose(LOOP_SECONDS - 0.001, 1.0);
        let after = compose(0.001, 1.0);
        for i in 0..3 {
            assert!(
                (first.hero[i] - before.hero[i] - (after.hero[i] - first.hero[i])).abs() < 0.0001
            );
        }
    }
    #[test]
    fn invalid_input_never_reaches_the_gpu() {
        let f = compose(f64::NAN, f32::INFINITY);
        assert!(f.camera.iter().chain(f.hero.iter()).all(|n| n.is_finite()));
        assert_eq!(compose(-16.0, 1.0).hero, compose(0.0, 1.0).hero);
    }
    #[test]
    fn quiet_setting_stops_every_object_and_preserves_readable_scale() {
        let f = compose(5.0, 0.0);
        assert_eq!(f.hero, [0.0; 4]);
        for object in f.objects {
            assert_eq!(object, [0.0, 0.0, 0.0, 1.0]);
        }
        assert_eq!(f.camera[2], 0.98);
        assert_eq!(f.wind[0], 0.0);
        assert_eq!(f.scan[1], 0.0);
    }
    #[test]
    fn scanner_is_an_occasional_reveal_and_wind_has_separate_gusts() {
        assert_eq!(compose(4.0, 1.0).scan[1], 0.0);
        assert!(compose(8.0, 1.0).scan[1] > 0.95);
        assert_eq!(compose(12.0, 1.0).scan[1], 0.0);
        assert!(compose(3.3, 1.0).wind[0] > 0.9);
        assert!(compose(12.5, 1.0).wind[0] > 0.9);
        assert!(compose(8.0, 1.0).wind[0] < 0.05);
    }
}
