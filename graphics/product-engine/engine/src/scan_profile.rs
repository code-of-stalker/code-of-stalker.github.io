//! Laboratory scan geometry shared by the content mask and its independent light.
use crate::timeline::smooth;

pub struct ScanProfile {
    pub progress: f32,
    pub front: f32,
    pub light_opacity: f32,
}
impl ScanProfile {
    pub const SOFTNESS: f32 = 0.2;
    pub fn new(progress: f32, reduced: bool) -> Self {
        let p = if reduced {
            1.
        } else if progress.is_finite() {
            progress.clamp(0., 1.)
        } else {
            0.
        };
        Self {
            progress: p,
            front: -2. * Self::SOFTNESS + (1. + 4. * Self::SOFTNESS) * p,
            light_opacity: smooth(0., 0.08, p) * (1. - smooth(0.92, 1., p)) * 0.8,
        }
    }
    pub fn mask(&self) -> String {
        if self.progress >= 1. {
            return "none".into();
        }
        if self.progress <= 0. {
            return "linear-gradient(transparent,transparent)".into();
        }
        let stops = (0..9)
            .map(|i| {
                let c = self.front - Self::SOFTNESS + Self::SOFTNESS * i as f32 / 8.;
                let alpha = 1. - smooth(self.front - Self::SOFTNESS, self.front, c);
                format!("rgba(0,0,0,{alpha:.6}) {:.5}%", c * 100.)
            })
            .collect::<Vec<_>>();
        format!("linear-gradient(to bottom,{})", stops.join(","))
    }
    pub fn light(&self) -> String {
        if self.light_opacity <= 0. {
            return "none".into();
        }
        let front = self.front * 100.;
        let core = self.light_opacity;
        let halo = core * 0.2;
        format!("linear-gradient(to bottom,transparent calc({front:.5}% - 12px),rgba(var(--panel-scan-rgb),{halo:.5}) calc({front:.5}% - 4px),rgba(var(--panel-scan-rgb),{core:.5}) calc({front:.5}% - 1.25px),rgba(var(--panel-scan-rgb),{core:.5}) calc({front:.5}% + 1.25px),rgba(var(--panel-scan-rgb),{halo:.5}) calc({front:.5}% + 4px),transparent calc({front:.5}% + 12px))")
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scan_light_and_content_share_the_front_but_not_the_mask() {
        let scan = ScanProfile::new(0.5, false);
        assert!((scan.front - 0.5).abs() < 1e-6);
        assert_eq!(scan.light_opacity, 0.8);
        assert!(scan.light().contains("50.00000%"));
        // The leading edge is transparent in the content mask, so a light
        // placed in that same masked layer would disappear.
        assert_eq!(
            1. - smooth(scan.front - ScanProfile::SOFTNESS, scan.front, scan.front),
            0.
        );
    }
    #[test]
    fn finishing_reduced_motion_and_invalid_input_clear_the_light() {
        for (p, reduced) in [(0., false), (1., false), (0.5, true), (f32::NAN, false)] {
            assert_eq!(ScanProfile::new(p, reduced).light(), "none");
        }
        assert_eq!(ScanProfile::new(0.5, true).mask(), "none");
    }
}
