//! Scroll is input; once a threshold is crossed, Rust owns the complete morph.
//! Layout anchors use actual pixels. No SVG corner or stroke is scaled.
pub struct Reading {
    pub values: Vec<f64>,
    offset: f64,
    previous: f64,
    open: bool,
    transition: Option<(f64, f64, f64)>,
    settle: f64,
    dirty: bool,
    clock: crate::clock::Clock,
}
// Clock is deliberately not cloned by callers.
impl Reading {
    pub fn new(values: Vec<f64>) -> Self {
        Self {
            values,
            offset: 0.,
            previous: 0.,
            open: false,
            transition: None,
            settle: 0.,
            dirty: true,
            clock: Default::default(),
        }
    }
    fn distance(&self) -> f64 {
        self.values[0] + self.values[3] + self.values[0].min(8.)
    }
    pub fn moving(&self) -> bool {
        self.transition.is_some() || self.dirty
    }
    pub fn configure(&mut self, values: Vec<f64>) {
        let before = self.distance().max(1.);
        let fraction = self.offset / before;
        let was_continued = self.values[6] > 0.;
        self.values = values;
        let distance = self.distance();
        if self.open || was_continued || self.values[6] > 0. {
            self.open = true;
            self.offset = distance;
            self.previous = distance;
        } else {
            self.offset = fraction * distance;
            self.previous = self.previous / before * distance;
        }
        if let Some((_, target, _)) = self.transition {
            self.transition = Some((
                self.offset,
                if target > 0. { distance } else { 0. },
                self.clock.elapsed,
            ));
        }
        self.dirty = true;
    }
    pub fn suspend(&mut self) {
        self.clock.suspend();
    }
    /// Gesture travel is separate from the article's native scroll position.
    pub fn drag(&mut self, delta: f64, at: f64) {
        if !delta.is_finite()
            || self.transition.is_some()
            || at < self.settle
            || self.values[6] > 0.
        {
            return;
        }
        let distance = self.distance();
        let next = (self.previous + delta).clamp(0., distance);
        let threshold = 48_f64.min(distance * 0.14);
        self.clock.step(at, true);
        self.previous = next;
        if !self.open && next >= threshold {
            self.transition = Some((0., distance, self.clock.elapsed));
        } else if self.open && next <= distance - threshold {
            self.transition = Some((distance, 0., self.clock.elapsed));
        }
        self.dirty = true;
    }
    pub fn observe(&mut self, offset: f64, at: f64) {
        if !offset.is_finite()
            || self.transition.is_some()
            || at < self.settle
            || self.values[6] > 0.
        {
            return;
        }
        self.clock.step(at, true);
        let distance = self.distance();
        let delta = offset - self.previous;
        self.previous = offset;
        self.offset = offset.clamp(0., distance);
        self.dirty = true;
        if offset >= distance {
            self.open = true;
            return;
        }
        if offset <= 0. {
            self.open = false;
            return;
        }
        let threshold = 48_f64.min(distance * 0.14);
        if !self.open && delta > 0. && offset >= threshold {
            self.transition = Some((offset, distance, self.clock.elapsed));
        }
        if self.open && delta < 0. && offset <= distance - threshold {
            self.transition = Some((offset, 0., self.clock.elapsed));
        }
    }
    pub fn frame(&mut self, at: f64) -> Option<Vec<f64>> {
        self.clock.step(at, true);
        if !self.moving() {
            self.clock.suspend();
            return None;
        }
        let write = self.transition.is_some();
        if let Some((from, target, start)) = self.transition {
            let t = if self.values[5] > 0. {
                1.
            } else {
                ((self.clock.elapsed - start) / 0.62).clamp(0., 1.)
            };
            self.offset = from + (target - from) * (1. - (1. - t).powi(3));
            if t >= 1. {
                self.offset = target;
                self.previous = target;
                self.open = target > 0.;
                self.transition = None;
                self.settle = at + 100.;
            }
        }
        self.dirty = false;
        Some(self.layout(write))
    }
    pub fn layout(&self, write: bool) -> Vec<f64> {
        let [gutter, bottom_inset, inset, _, viewport, reduced, continued, controls_top, button_height, icon_height] =
            self.values[..10]
        else {
            return vec![];
        };
        let distance = self.distance().max(1.);
        let travel = if continued > 0. || self.open && self.transition.is_none() {
            distance
        } else if self.transition.is_none() {
            0.
        } else {
            self.offset.clamp(0., distance)
        };
        let progress = travel / distance;
        let eased = progress * progress * (3. - 2. * progress);
        let side = gutter * (1. - eased);
        let bottom = bottom_inset * (1. - eased);
        let content = inset + gutter - side;
        let panel_top = distance - travel;
        let button_top = gutter + (controls_top - gutter) * eased;
        let page_top = if self.values.get(10).copied().unwrap_or(0.) > 0. {
            (controls_top + button_height + 16.) * eased
        } else {
            0.
        };
        vec![
            eased,
            distance,
            travel,
            side,
            bottom,
            content,
            if reduced > 0. { 1. } else { 1. - eased },
            -travel * if reduced > 0. { 1. } else { 0.72 },
            panel_top,
            gutter - side,
            button_top + (button_height - icon_height) / 2. - panel_top,
            button_top,
            page_top
                + if continued > 0. {
                    0.
                } else {
                    (inset + 16.) * (1. - eased)
                },
            inset + bottom_inset - bottom,
            (viewport - bottom - 33. * (1. - eased)).max(1.),
            self.offset,
            if self.transition.is_some() { 1. } else { 0. },
            if write { 1. } else { 0. },
        ]
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn setup() -> Reading {
        Reading::new(vec![20., 18., 16., 270., 668., 0., 0., 24., 44., 42.])
    }
    #[test]
    fn threshold_finishes_without_scroll_and_reverses() {
        let mut r = setup();
        r.frame(0.);
        r.observe(48., 1.);
        assert!(r.moving());
        let a = r.frame(16.).unwrap();
        assert_eq!(a[16], 1.);
        let end = r.frame(1000.).unwrap();
        assert_eq!(end[0], 1.);
        assert_eq!(end[3], 0.);
        assert_eq!(end[11], 24.);
        assert_eq!(end[10], 25.);
        r.frame(1200.);
        r.observe(240., 1201.);
        let back = r.frame(1216.).unwrap();
        assert_eq!(back[16], 1.);
        let end = r.frame(2000.).unwrap();
        assert_eq!(end[0], 0.);
        assert_eq!(end[3], 20.);
    }
    #[test]
    fn preview_content_stays_pinned_until_zoom_starts() {
        let mut r = setup();
        let initial = r.layout(false);
        r.observe(20., 1.);
        let approach = r.frame(16.).unwrap();
        assert_eq!(approach[0], 0.);
        assert_eq!(approach[8], initial[8]);
        assert_eq!(approach[12], initial[12]);
        r.observe(0., 20.);
        assert_eq!(r.layout(false)[12], initial[12]);
        r.observe(48., 30.);
        assert_eq!(r.frame(1000.).unwrap()[0], 1.);
    }
    #[test]
    fn gesture_expands_without_ever_scrolling_the_article_and_consumes_large_input() {
        let mut r = setup();
        r.frame(0.);
        r.drag(12., 10.);
        let before = r.frame(20.).unwrap();
        assert_eq!(before[0], 0.);
        assert_eq!(before[12], 32.);
        r.drag(2000., 30.);
        let start = r.frame(30.).unwrap();
        assert_eq!(start[0], 0.);
        r.drag(2000., 200.);
        let end = r.frame(1000.).unwrap();
        assert_eq!(end[0], 1.);
        assert_eq!(end[12], 0.);
        assert_eq!(end[14], 668.);
        r.drag(-2000., 1200.);
        assert_eq!(r.frame(1200.).unwrap()[0], 1.);
        assert_eq!(r.frame(2200.).unwrap()[0], 0.);
    }
    #[test]
    fn continued_article_has_no_runway_and_controls_keep_equal_insets() {
        let mut r = setup();
        r.values[6] = 1.;
        let v = r.layout(false);
        assert_eq!(v[12], 0.);
        assert_eq!(v[9], 20.);
        assert_eq!(v[11], 24.);
        assert_eq!(v[8], 0.);
    }
    #[test]
    fn paged_reading_keeps_preview_pinned_and_moves_text_below_the_shared_controls() {
        let mut r = setup();
        r.values.push(1.);
        let preview = r.layout(false);
        r.frame(0.);
        r.drag(12., 10.);
        assert_eq!(r.frame(20.).unwrap()[12], preview[12]);
        r.drag(80., 30.);
        let middle = r.frame(200.).unwrap();
        assert!(middle[12] > preview[12] && middle[12] < 84.);
        assert_eq!(r.frame(1000.).unwrap()[12], 84.);
        let mut values = r.values.clone();
        values[6] = 1.;
        r.configure(values);
        assert_eq!(r.layout(false)[12], 84.);
    }
}
