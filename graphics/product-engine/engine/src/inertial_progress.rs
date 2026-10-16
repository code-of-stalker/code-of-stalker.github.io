//! Continuous presentation of gesture progress; never decides navigation.
//! Exact critically damped motion keeps velocity on retarget and is independent
//! of frame cadence, including a delayed frame. No overshooting track bounds.
#[derive(Clone, Copy, Debug)]
pub struct ProgressSpring {
    pub position: f64,
    pub velocity: f64,
    target: f64,
}
impl ProgressSpring {
    pub fn new(value: f64) -> Self {
        let value = value.clamp(0., 1.);
        Self {
            position: value,
            velocity: 0.,
            target: value,
        }
    }
    pub fn target(&mut self, value: f64, snap: bool) {
        if !value.is_finite() {
            return;
        }
        self.target = value.clamp(0., 1.);
        if snap {
            self.position = self.target;
            self.velocity = 0.;
        }
    }
    pub fn moving(&self) -> bool {
        self.position != self.target || self.velocity != 0.
    }
    pub fn step(&mut self, dt: f64) {
        if !dt.is_finite() || dt <= 0. || !self.moving() {
            return;
        }
        // Same stiffness=144, damping=24, mass=1 as the native cue.
        let omega = 12.;
        let offset = self.position - self.target;
        let impulse = (self.velocity + omega * offset) * dt;
        let decay = (-omega * dt).exp();
        self.position = self.target + (offset + impulse) * decay;
        self.velocity = (self.velocity - omega * impulse) * decay;
        if self.position < 0. || self.position > 1. {
            self.position = self.position.clamp(0., 1.);
            self.velocity = 0.;
        }
        if (self.position - self.target).abs() < 0.0001 && self.velocity.abs() < 0.001 {
            self.position = self.target;
            self.velocity = 0.;
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn retarget_keeps_position_and_velocity_then_continues_after_release() {
        let mut p = ProgressSpring::new(0.03);
        p.target(0.4, false);
        p.step(0.1);
        let before = p;
        p.target(0.7, false);
        assert_eq!(p.position, before.position);
        assert_eq!(p.velocity, before.velocity);
        p.step(0.1);
        assert!(p.position > before.position && p.position < 0.7);
        for _ in 0..120 {
            p.step(1. / 60.);
        }
        assert_eq!(p.position, 0.7);
        assert!(!p.moving());
    }
    #[test]
    fn frame_rates_and_delayed_delivery_keep_the_same_motion() {
        let mut reference = ProgressSpring::new(0.03);
        reference.target(0.8, false);
        reference.step(0.35);
        for fps in [30_f64, 60., 90., 120.] {
            let mut p = ProgressSpring::new(0.03);
            p.target(0.8, false);
            let mut elapsed: f64 = 0.;
            while elapsed < 0.35 {
                let dt = (1. / fps).min(0.35 - elapsed);
                p.step(dt);
                elapsed += dt;
            }
            assert!((p.position - reference.position).abs() < 1e-10);
            assert!((p.velocity - reference.velocity).abs() < 1e-10);
        }
    }
    #[test]
    fn reversal_stays_bounded_and_reduced_motion_snaps_and_stops() {
        let mut p = ProgressSpring::new(0.03);
        p.target(1., false);
        p.step(0.05);
        p.target(0.03, false);
        for _ in 0..180 {
            p.step(1. / 60.);
            assert!((0. ..=1.).contains(&p.position));
        }
        assert_eq!(p.position, 0.03);
        p.target(0.8, true);
        assert_eq!(p.position, 0.8);
        assert_eq!(p.velocity, 0.);
        assert!(!p.moving());
    }
}
