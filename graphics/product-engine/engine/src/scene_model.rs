//! Timing is independent of delivered FPS. Values mirror the original SVG keyframes.
#[derive(Debug, Clone, Copy)]
pub struct ObserverPose {
    pub scale: f32,
    pub x: f32,
    pub y: f32,
    pub observer_x: f32,
    pub other_x: f32,
    pub span: f32,
    pub ray: f32,
    pub emission: f32,
    pub edge: f32,
}

fn bezier(t: f32, a: f32, b: f32) -> f32 {
    3. * (1. - t).powi(2) * t * a + 3. * (1. - t) * t * t * b + t * t * t
}
pub fn ease(x: f32, control: [f32; 4]) -> f32 {
    let mut lo = 0.;
    let mut hi = 1.;
    for _ in 0..18 {
        let mid = (lo + hi) * 0.5;
        if bezier(mid, control[0], control[2]) < x {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    bezier((lo + hi) * 0.5, control[1], control[3])
}
fn key(p: f32, frames: &[(f32, f32)], curve: [f32; 4]) -> f32 {
    for pair in frames.windows(2) {
        let (a, b) = (pair[0], pair[1]);
        if p <= b.0 {
            let t = ((p - a.0) / (b.0 - a.0)).clamp(0., 1.);
            return a.1 + (b.1 - a.1) * ease(t, curve);
        }
    }
    frames.last().unwrap().1
}
pub fn observer_pose(seconds: f64, reduced: bool) -> ObserverPose {
    let p = (seconds.rem_euclid(11.2) / 11.2) as f32;
    let motion = [0.42, 0., 0.28, 1.];
    let opacity = [0.42, 0., 0.58, 1.];
    let wide = if reduced {
        1.
    } else {
        key(
            p,
            &[
                (0., 0.),
                (0.20, 0.),
                (0.56, 1.),
                (0.82, 1.),
                (0.98, 0.),
                (1., 0.),
            ],
            motion,
        )
    };
    ObserverPose {
        scale: 3.2 + (1.18 - 3.2) * wide,
        x: -352. + 323.2 * wide,
        y: -6.4 + 18.4 * wide,
        observer_x: 38. * (1. - wide),
        other_x: -41. * (1. - wide),
        span: 0.373015873 + (1. - 0.373015873) * wide,
        ray: if reduced {
            0.
        } else {
            key(
                p,
                &[
                    (0., 0.),
                    (0.10, 0.),
                    (0.16, 0.85),
                    (0.48, 0.85),
                    (0.66, 0.),
                    (1., 0.),
                ],
                opacity,
            )
        },
        emission: if reduced {
            1.
        } else {
            key(
                p,
                &[
                    (0., 0.),
                    (0.44, 0.),
                    (0.64, 1.),
                    (0.72, 0.86),
                    (0.80, 1.),
                    (0.92, 0.),
                    (1., 0.),
                ],
                opacity,
            )
        },
        edge: if reduced {
            0.
        } else {
            key(
                p,
                &[
                    (0., 1.),
                    (0.56, 1.),
                    (0.60, 0.),
                    (0.82, 0.),
                    (0.835, 1.),
                    (1., 1.),
                ],
                motion,
            )
        },
    }
}
#[cfg(test)]
pub fn rain_noise(seed: u32, index: u32) -> f64 {
    let mut value = (seed ^ index).wrapping_mul(0x45d9f3b);
    value = (value ^ (value >> 16)).wrapping_mul(0x45d9f3b);
    (value ^ (value >> 16)) as f64 / 4294967296.
}
#[derive(Default)]
pub struct SceneClock {
    previous: Option<f64>,
    pub elapsed: f64,
    fixed: Option<f64>,
}
impl SceneClock {
    pub fn advance(&mut self, now: f64, reduced: bool) -> f64 {
        if let Some(fixed) = self.fixed {
            self.elapsed = fixed;
            self.previous = None;
            return fixed;
        }
        if !reduced {
            if let Some(last) = self.previous {
                self.elapsed += (now - last).max(0.);
            }
        }
        self.previous = Some(now);
        self.elapsed
    }
    pub fn suspend(&mut self) {
        self.previous = None;
    }
    pub fn restart(&mut self) {
        self.previous = None;
        self.elapsed = 0.;
    }
    pub fn seek(&mut self, seconds: Option<f64>) {
        self.fixed = seconds.map(|t| t * 1000.);
        self.elapsed = self.fixed.unwrap_or(0.);
        self.previous = None;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn poses_match_source_holds_and_loop() {
        let a = observer_pose(0., false);
        let b = observer_pose(7.5, false);
        let c = observer_pose(11.2, false);
        assert!((a.scale - 3.2).abs() < 1e-5);
        assert!((b.scale - 1.18).abs() < 1e-5);
        assert!((a.x - c.x).abs() < 1e-5);
        assert!((b.observer_x).abs() < 1e-5);
        assert!(observer_pose(3.5, false).ray > 0.8);
        assert_eq!(observer_pose(0., true).emission, 1.);
    }
    #[test]
    fn clock_has_no_slow_frame_cap_or_background_jump() {
        let mut c = SceneClock::default();
        assert_eq!(c.advance(900., false), 0.);
        assert_eq!(c.advance(1200., false), 300.);
        c.suspend();
        assert_eq!(c.advance(90000., false), 300.);
        c.restart();
        assert_eq!(c.advance(100000., false), 0.);
    }
    #[test]
    fn noise_uses_wrapping_integer_operations() {
        assert_eq!(rain_noise(0, 0), 0.);
        assert_eq!(rain_noise(73, 73), 0.);
        // Expected values from the original JavaScript Math.imul implementation.
        assert_eq!(rain_noise(73, 4), 0.7203197281342);
        assert_eq!(rain_noise(73, 123456), 0.4430887405760586);
        assert_eq!(rain_noise(73, u32::MAX), 0.34759410191327333);
    }
    #[test]
    fn fixed_pose_excludes_elapsed_wall_time_and_resumes_at_zero() {
        let mut c = SceneClock::default();
        c.advance(50., false);
        c.seek(Some(5.6));
        assert_eq!(c.advance(12000., false), 5600.);
        c.suspend();
        assert_eq!(c.advance(90000., true), 5600.);
        c.seek(None);
        assert_eq!(c.advance(95000., false), 0.);
        assert_eq!(c.advance(95016., false), 16.);
    }
}
