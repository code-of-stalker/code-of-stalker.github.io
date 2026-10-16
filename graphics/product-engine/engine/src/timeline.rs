use crate::scene_model::ease;
#[derive(Clone, Copy, Debug)]
pub struct Transition {
    pub from: f32,
    pub target: f32,
    pub started: f64,
    pub duration: f64,
    pub delay: f64,
    pub curve: [f32; 4],
}
impl Transition {
    pub fn new(value: f32) -> Self {
        Self {
            from: value,
            target: value,
            started: 0.,
            duration: 0.,
            delay: 0.,
            curve: [0.22, 0.8, 0.2, 1.],
        }
    }
    pub fn value(&self, time: f64) -> f32 {
        if self.duration <= 0. {
            return self.target;
        }
        let p = ((time - self.started - self.delay) / self.duration).clamp(0., 1.) as f32;
        // Keep layout endpoints exact: the numerical Bezier solver has a tiny
        // residual at zero, amplified by pixel-sized height transitions.
        if p <= 0. {
            return self.from;
        }
        if p >= 1. {
            return self.target;
        }
        self.from + (self.target - self.from) * ease(p, self.curve)
    }
    pub fn to(&mut self, target: f32, time: f64, duration: f64, delay: f64, curve: [f32; 4]) {
        if target == self.target {
            return;
        }
        self.from = self.value(time);
        self.target = target;
        self.started = time;
        self.duration = duration;
        self.delay = delay;
        self.curve = curve;
    }
    pub fn moving(&self, time: f64) -> bool {
        self.from != self.target && time < self.started + self.delay + self.duration
    }
}
pub fn smooth(a: f32, b: f32, time: f32) -> f32 {
    let t = ((time - a) / (b - a)).clamp(0., 1.);
    t * t * (3. - 2. * t)
}
pub fn envelope(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1. - smooth(c, d, t))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn dissolve_is_continuous_when_retargeted() {
        let mut t = Transition::new(0.);
        t.to(1., 0., 1.8, 0., [0.25, 0.46, 0.45, 0.94]);
        let visible = t.value(0.8);
        t.to(0., 0.8, 0.2, 0., [0.215, 0.61, 0.355, 1.]);
        assert!((t.value(0.8) - visible).abs() < 1e-5);
        assert_eq!(t.value(1.1), 0.);
    }
    #[test]
    fn resize_and_quality_do_not_exist_in_timeline_state() {
        let mut t = Transition::new(0.);
        t.to(1., 0., 1.8, 0., [0.25, 0.46, 0.45, 0.94]);
        assert!(t.value(0.9) > 0.);
        assert!((t.value(1.8) - 1.).abs() < 1e-5);
    }
    #[test]
    fn accordion_height_reverses_without_a_jump() {
        let mut height = Transition::new(0.);
        height.to(240., 0., 0.46, 0., [0.22, 0.8, 0.2, 1.]);
        let midway = height.value(0.12);
        assert!(midway > 0. && midway < 240.);
        height.to(0., 0.12, 0.46, 0., [0.22, 0.8, 0.2, 1.]);
        assert!((height.value(0.12) - midway).abs() < 1e-5);
        assert_eq!(height.value(0.7), 0.);
    }
}
