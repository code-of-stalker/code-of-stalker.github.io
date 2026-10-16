/// Active scene time. Resize/quality changes never alter this clock.
#[derive(Default, Debug)]
pub struct Clock {
    previous: Option<f64>,
    pub elapsed: f64,
}
impl Clock {
    pub fn step(&mut self, now: f64, active: bool) -> f64 {
        if !active {
            self.previous = None;
            return 0.;
        }
        let dt = self
            .previous
            .map_or(0., |last| (now - last).max(0.) / 1000.);
        self.previous = Some(now);
        self.elapsed += dt;
        dt
    }
    pub fn suspend(&mut self) {
        self.previous = None;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pause_resume_preserves_phase_and_excludes_hidden_wall_time() {
        let mut c = Clock::default();
        c.step(10., true);
        c.step(110., true);
        assert!((c.elapsed - 0.1).abs() < 1e-10);
        c.step(111., false);
        c.step(90000., true);
        assert!((c.elapsed - 0.1).abs() < 1e-10);
        c.step(90100., true);
        assert!((c.elapsed - 0.2).abs() < 1e-10);
    }
    #[test]
    fn slow_delivery_does_not_slow_down_motion() {
        let mut c = Clock::default();
        c.step(0., true);
        c.step(2000., true);
        assert_eq!(c.elapsed, 2.);
    }
}
