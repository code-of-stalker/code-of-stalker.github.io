pub struct Motion {
    pub x: f32,
    pub y: f32,
    pub pressure: f32,
    pub reveal: f32,
    pub pulse: f32,
    pub pulse_x: f32,
    pub pulse_y: f32,
    target_x: f32,
    target_y: f32,
    pressed: bool,
    scan_elapsed: f32,
    pulse_elapsed: f32,
}
impl Default for Motion {
    fn default() -> Self {
        Self {
            x: 0.5,
            y: 0.5,
            pressure: 0.,
            reveal: 1.,
            pulse: 1.,
            pulse_x: 0.5,
            pulse_y: 0.5,
            target_x: 0.5,
            target_y: 0.5,
            pressed: false,
            scan_elapsed: 0.,
            pulse_elapsed: 0.,
        }
    }
}
impl Motion {
    /// Contact is transient. Keep scan/reveal progress when a surface is hidden.
    pub fn cancel_contact(&mut self) {
        self.pressed = false;
        self.pressure = 0.;
        self.pulse = 1.;
        self.x = self.target_x;
        self.y = self.target_y;
    }
    pub fn pointer(&mut self, x: f32, y: f32, down: bool) {
        self.target_x = x.clamp(0., 1.);
        self.target_y = y.clamp(0., 1.);
        if down && !self.pressed {
            if self.pressure < 0.01 {
                self.x = self.target_x;
                self.y = self.target_y;
            }
            self.pulse_x = self.target_x;
            self.pulse_y = self.target_y;
            self.pulse_elapsed = 0.;
            self.pulse = 0.;
        }
        self.pressed = down;
    }
    pub fn replay(&mut self) {
        self.scan_elapsed = 0.;
        self.reveal = 0.;
    }
    pub fn step(
        &mut self,
        seconds: f32,
        lag: f32,
        scan_duration: f32,
        pulse_duration: f32,
        reduced: bool,
    ) {
        let dt = if seconds.is_finite() {
            seconds.max(0.)
        } else {
            0.
        };
        let approach = |current: f32, target: f32, time: f32| {
            current + (target - current) * (1. - (-dt / time.max(0.001)).exp())
        };
        self.x = approach(self.x, self.target_x, lag);
        self.y = approach(self.y, self.target_y, lag);
        self.pressure = approach(
            self.pressure,
            if self.pressed { 1. } else { 0. },
            if self.pressed { 0.055 } else { 0.19 },
        );
        if self.pressure < 0.0001 {
            self.pressure = 0.;
        }
        if self.reveal < 1. {
            self.scan_elapsed += dt;
            self.reveal = (self.scan_elapsed / scan_duration.max(0.001)).clamp(0., 1.);
        }
        if self.pulse < 1. {
            self.pulse_elapsed += dt;
            self.pulse = (self.pulse_elapsed / pulse_duration.max(0.01)).clamp(0., 1.);
        }
        if reduced {
            self.pressure = 0.;
            self.reveal = 1.;
            self.pulse = 1.;
        }
    }
    pub fn moving(&self) -> bool {
        self.reveal < 1.
            || self.pulse < 1.
            || self.pressed
            || self.pressure > 0.
            || (self.x - self.target_x).abs() > 0.0001
            || (self.y - self.target_y).abs() > 0.0001
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn hidden_contact_does_not_replay_or_restart_reveal() {
        let mut m = Motion::default();
        m.replay();
        m.pointer(0.2, 0.8, true);
        m.step(0.2, 2., 2., 2.5, false);
        let reveal = m.reveal;
        m.cancel_contact();
        assert!(!m.pressed);
        assert_eq!(m.pressure, 0.);
        assert_eq!(m.pulse, 1.);
        assert_eq!(m.reveal, reveal);
        m.step(0.01, 2., 2., 2.5, false);
        assert_eq!(m.pressure, 0.);
        assert_eq!(m.pulse, 1.);
        assert!(m.reveal > reveal);
    }
    #[test]
    fn touch_releases_and_reveal_completes() {
        let mut m = Motion::default();
        m.replay();
        m.pointer(0.2, 0.8, true);
        m.step(0.5, 2., 2., 2.5, false);
        assert!(m.pressure > 0.9);
        assert_eq!(m.reveal, 0.25);
        m.pointer(0.2, 0.8, false);
        for _ in 0..80 {
            m.step(0.05, 2., 2., 2.5, false);
        }
        assert_eq!(m.pressure, 0.);
        assert_eq!(m.reveal, 1.);
        assert_eq!(m.pulse, 1.);
    }
    #[test]
    fn reduced_motion_finishes_without_hiding_glass() {
        let mut m = Motion::default();
        m.replay();
        m.pointer(0.8, 0.2, true);
        m.step(0.1, 2., 2., 2.5, true);
        assert_eq!(m.pressure, 0.);
        assert_eq!(m.reveal, 1.);
        assert_eq!(m.pulse, 1.);
    }
}
