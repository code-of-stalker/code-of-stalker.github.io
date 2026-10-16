pub const MIN_DENSITY: f32 = 1.5;
pub const MAX_DENSITY: f32 = 2.5;
pub const GLASS_DENSITY: f32 = 1.;
pub const ARTWORK_NORMAL_MIN: f32 = 2.;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EffectSurface {
    Glass,
    Artwork,
}
#[derive(Clone, Copy, Debug)]
pub struct Quality {
    pub density: f32,
    pub cost: u32,
    pub target_fps: f64,
}
impl Default for Quality {
    fn default() -> Self {
        Self {
            density: MAX_DENSITY,
            cost: 0,
            target_fps: 60.,
        }
    }
}
impl Quality {
    /// Frame pacing does not require reallocating render targets. Glass density
    /// is independent of artwork, so an artwork-only change leaves it intact.
    pub fn needs_rebuild(&self, requested: Self, surface: EffectSurface) -> bool {
        self.cost != requested.cost
            || (surface == EffectSurface::Artwork && self.density != requested.density)
    }
    pub fn set(&mut self, density: f32, cost: u32, fps: f64) {
        self.density = if density.is_finite() {
            density.clamp(MIN_DENSITY, MAX_DENSITY)
        } else {
            MAX_DENSITY
        };
        self.cost = cost.min(3);
        self.target_fps = if fps.is_finite() {
            fps.clamp(60., 120.)
        } else {
            60.
        };
    }
    pub fn size(&self, w: f32, h: f32, surface: EffectSurface) -> [u32; 2] {
        [w, h].map(|v| {
            let v = if v.is_finite() { v.max(1.) } else { 1. };
            if surface == EffectSurface::Glass {
                return (v * GLASS_DENSITY).ceil() as u32;
            }
            let floor = if self.density >= ARTWORK_NORMAL_MIN {
                ARTWORK_NORMAL_MIN
            } else {
                MIN_DENSITY
            };
            (v * self.density)
                .round()
                .max((v * floor).ceil())
                .min((v * MAX_DENSITY).floor()) as u32
        })
    }
    pub fn budgeted(&self, _w: f32, _h: f32, surface: EffectSurface) -> Self {
        let mut result = *self;
        if surface == EffectSurface::Glass {
            result.density = GLASS_DENSITY;
            return result;
        }
        // Size alone never overrides the controller's density. The soft budget
        // is reported in diagnostics; overload is handled by the cadence policy.
        result
    }
    pub fn blur_samples(&self) -> u32 {
        [25, 17, 13, 9][self.cost as usize]
    }
    pub fn refraction_samples(&self) -> u32 {
        if self.cost < 2 {
            3
        } else {
            1
        }
    }
    pub fn particle_fraction(&self) -> f32 {
        [1., 0.85, 0.7, 0.55][self.cost as usize]
    }
    pub fn secondary_glow(&self) -> bool {
        self.cost < 3
    }
    /// Economy saves decorative reading paints, not elapsed scene time or UI
    /// responsiveness. Higher quality keeps the display's normal delivery rate.
    pub fn reading_fps(&self) -> f64 {
        if self.density < ARTWORK_NORMAL_MIN {
            30.
        } else {
            self.target_fps
        }
    }
}

/// Paint deadlines only: clocks keep measuring real active time independently.
#[derive(Default)]
pub struct PaintCadence {
    next: Option<f64>,
    fps: f64,
}
impl PaintCadence {
    pub fn due(&mut self, now: f64, fps: f64, forced: bool) -> bool {
        let interval = 1000. / fps;
        if forced || self.next.is_none() || self.fps != fps {
            self.fps = fps;
            self.next = Some(now + interval);
            return true;
        }
        let next = self.next.unwrap();
        if now + 0.25 < next {
            return false;
        }
        self.next = Some(next + (((now - next).max(0.) / interval).floor() + 1.) * interval);
        true
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn economy_halves_reading_paints_without_changing_active_time() {
        for display_fps in [60., 90., 120.] {
            let mut cadence = PaintCadence::default();
            let mut clock = crate::clock::Clock::default();
            let mut paints = 0;
            let mut painted_time = 0.;
            for i in 0..=display_fps as usize * 2 {
                let at = i as f64 * 1000. / display_fps;
                clock.step(at, true);
                if cadence.due(at, 30., false) {
                    paints += 1;
                    painted_time = clock.elapsed;
                }
            }
            assert_eq!(paints, 61);
            assert!((painted_time - 2.).abs() < 1e-9);
        }
    }
    #[test]
    fn quality_changes_and_dirty_frames_do_not_wait_for_old_deadlines() {
        let mut cadence = PaintCadence::default();
        assert!(cadence.due(0., 30., false));
        assert!(!cadence.due(10., 30., false));
        assert!(cadence.due(11., 30., true));
        assert!(cadence.due(12., 60., false));
        let mut q = Quality::default();
        q.set(1.5, 0, 120.);
        assert_eq!(q.reading_fps(), 30.);
        q.set(2., 0, 120.);
        assert_eq!(q.reading_fps(), 120.);
    }
    #[test]
    fn density_and_frame_pacing_do_not_rebuild_unaffected_glass() {
        let previous = Quality::default();
        let mut next = previous;
        next.set(2., 0, 120.);
        assert!(!previous.needs_rebuild(next, EffectSurface::Glass));
        assert!(previous.needs_rebuild(next, EffectSurface::Artwork));
        next.set(2.5, 0, 120.);
        assert!(!previous.needs_rebuild(next, EffectSurface::Artwork));
        next.set(2.5, 1, 120.);
        assert!(previous.needs_rebuild(next, EffectSurface::Glass));
        assert!(previous.needs_rebuild(next, EffectSurface::Artwork));
    }
    #[test]
    fn real_buffers_never_violate_density_limits() {
        for request in [0., 1., 1.5, 1.75, 2., 2.5, 3., f32::NAN] {
            let mut q = Quality::default();
            q.set(request, 0, 90.);
            for [w, h] in [[44., 42.], [335.3, 306.9], [480., 900.], [2400., 3000.]] {
                let [x, y] =
                    q.budgeted(w, h, EffectSurface::Artwork)
                        .size(w, h, EffectSurface::Artwork);
                for (pixels, css) in [(x, w), (y, h)] {
                    let actual = pixels as f32 / css;
                    assert!(actual >= 1.5 && actual <= 2.5, "{actual}");
                }
            }
        }
    }
    #[test]
    fn glass_resolution_is_independent_of_artwork_quality_and_cost() {
        for density in [1.5, 2., 2.5] {
            for cost in 0..=3 {
                let mut q = Quality::default();
                q.set(density, cost, 90.);
                for [w, h] in [[44., 42.], [335.3, 306.9], [800., 1600.]] {
                    let glass = q.budgeted(w, h, EffectSurface::Glass);
                    assert_eq!(glass.density, 1.);
                    assert_eq!(
                        glass.size(w, h, EffectSurface::Glass),
                        [w.ceil() as u32, h.ceil() as u32]
                    );
                    assert_eq!(glass.cost, cost);
                    assert_eq!(q.density, density);
                }
            }
        }
    }
    #[test]
    fn size_budget_cannot_override_the_controller_density() {
        for density in [2., 2.5] {
            let mut q = Quality::default();
            q.set(density, 3, 90.);
            let artwork = q.budgeted(800., 1600., EffectSurface::Artwork);
            assert_eq!(artwork.density, density);
            assert_eq!(
                artwork.size(800., 1600., EffectSurface::Artwork),
                [(800. * density) as u32, (1600. * density) as u32]
            );
        }
        let mut q = Quality::default();
        q.set(1.5, 3, 90.);
        assert_eq!(
            q.budgeted(800., 1600., EffectSurface::Artwork).size(
                800.,
                1600.,
                EffectSurface::Artwork
            ),
            [1200, 2400]
        );
    }
    #[test]
    fn secondary_cost_cannot_lower_main_density() {
        let mut q = Quality::default();
        q.set(1.5, 3, 90.);
        assert_eq!(q.density, 1.5);
        assert_eq!(q.blur_samples(), 9);
        assert_eq!(q.refraction_samples(), 1);
        assert!(!q.secondary_glow());
    }
}
