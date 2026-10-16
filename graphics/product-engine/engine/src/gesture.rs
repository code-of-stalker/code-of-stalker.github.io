//! Laboratory hold/drag classification; hosts supply pointer events and bounds.
#[derive(Default)]
pub struct Gesture {
    start: Option<f64>,
    delay: f64,
    width: f64,
    height: f64,
    held: bool,
    moved: bool,
}
impl Gesture {
    pub fn down(&mut self, at: f64, width: f64, height: f64, delay: f64) {
        self.start = Some(at);
        self.delay = delay;
        self.width = width.max(1.);
        self.height = height.max(1.);
        self.held = false;
        self.moved = false;
    }
    pub fn hold(&mut self, at: f64) -> bool {
        if !self.held && self.start.is_some_and(|start| at - start >= self.delay) {
            self.held = true;
            return true;
        }
        false
    }
    pub fn drag(&mut self, at: f64, dx: f64, dy: f64) -> (bool, [f32; 2]) {
        if self.start.is_none() {
            return (false, [0.; 2]);
        }
        let begin = !self.held && dx.hypot(dy) > 10.;
        if dx.hypot(dy) > 10. {
            self.moved = true;
            self.held = true;
        }
        let begin = begin || self.hold(at);
        (
            begin,
            if self.held {
                [
                    (dx / (self.width * 0.3)).clamp(-1., 1.) as f32,
                    (dy / (self.height * 0.3)).clamp(-1., 1.) as f32,
                ]
            } else {
                [0.; 2]
            },
        )
    }
    pub fn up(&mut self, at: f64, inside: bool) -> bool {
        let tap = self.start.is_some_and(|start| at - start < self.delay)
            && !self.held
            && !self.moved
            && inside;
        self.cancel();
        tap
    }
    pub fn cancel(&mut self) {
        self.start = None;
        self.held = false;
        self.moved = false;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn original_thresholds() {
        let mut g = Gesture::default();
        g.down(0., 288., 156., 320.);
        assert!(!g.hold(319.));
        assert!(g.up(319., true));
        g.down(0., 288., 156., 320.);
        assert!(g.hold(320.));
        assert!(!g.up(400., true));
        g.down(0., 288., 156., 320.);
        assert!(g.drag(20., 11., 0.).0);
        assert!(!g.up(30., true));
    }
    #[test]
    fn cancelled_pointer_never_opens() {
        let mut g = Gesture::default();
        g.down(0., 288., 156., 320.);
        g.cancel();
        assert!(!g.up(10., true));
    }
}
