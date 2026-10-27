//! Soft wheel scrolling for the web app, part of the «Плавность» mode. The
//! feel follows lovarken.com, which uses Lenis defaults: every wheel step
//! moves a target, and the viewport glides toward it with exponential
//! damping. A step answers at once and settles in a long, quiet tail; the
//! motion depends only on elapsed time, never on the display's frame rate.
//!
//! The browser adapter (`src/features/product/motion/softScroll.web.ts`)
//! forwards wheel events and writes the returned offset. Touch, keyboard and
//! reduced motion stay native.
#[cfg(target_arch = "wasm32")]
mod browser;

/// Damping rate per second: Lenis `lerp: 0.1` per 60 Hz frame (`lerp * 60`).
pub const DAMPING: f64 = 6.0;
/// One line of a line-mode wheel (Firefox), counted as Lenis does.
pub const LINE: f64 = 100.0 / 6.0;
/// Closer than this, the glide lands exactly on its target and stops.
pub const SETTLE: f64 = 0.5;
/// A read-back further than this from the last written offset means that
/// something else moved the viewport (keyboard, touch, a programmatic jump,
/// reflow). The glide lets go instead of fighting it.
pub const INTERFERENCE: f64 = 2.0;
/// The longest frame gap integrated as one step, e.g. after a hidden tab.
pub const MAX_STEP: f64 = 0.25;
/// The first frame after a wheel step has no previous frame to measure.
const FIRST_STEP: f64 = 1.0 / 60.0;

/// `WheelEvent.deltaMode`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DeltaMode {
    Pixel,
    Line,
    Page,
}
impl DeltaMode {
    pub fn from_dom(mode: u32) -> Self {
        match mode {
            1 => Self::Line,
            2 => Self::Page,
            _ => Self::Pixel,
        }
    }
}

/// One scroll container's glide, in CSS pixels of scroll offset.
#[derive(Clone, Debug, Default)]
pub struct Glide {
    position: f64,
    target: f64,
    written: f64,
    last: Option<f64>,
    moving: bool,
}
impl Glide {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn moving(&self) -> bool {
        self.moving
    }
    pub fn position(&self) -> f64 {
        self.position
    }
    pub fn target(&self) -> f64 {
        self.target
    }
    /// Let the viewport go; the next wheel step starts from where it is then.
    pub fn release(&mut self) {
        self.moving = false;
        self.last = None;
    }
    /// A wheel step in DOM units. `current` is the viewport's scroll offset,
    /// `limit` its largest offset and `page` its height. Returns whether the
    /// glide took the step; the adapter then cancels the native scroll.
    pub fn wheel(
        &mut self,
        delta: f64,
        mode: DeltaMode,
        page: f64,
        current: f64,
        limit: f64,
    ) -> bool {
        if !delta.is_finite() || !current.is_finite() || !limit.is_finite() || delta == 0. {
            return false;
        }
        let limit = limit.max(0.);
        let delta = match mode {
            DeltaMode::Pixel => delta,
            DeltaMode::Line => delta * LINE,
            DeltaMode::Page => delta * if page.is_finite() { page.max(0.) } else { 0. },
        };
        if !self.moving {
            self.position = current.clamp(0., limit);
            self.target = self.position;
            self.written = current;
            self.last = None;
        } else if (self.target - self.position) * delta < 0. {
            // A reversal answers at once: the new direction starts from the
            // view, not from the far end of the previous flick.
            self.target = self.position;
        }
        let target = (self.target + delta).clamp(0., limit);
        if !self.moving && (target - self.position).abs() < SETTLE {
            // Already at the edge: nothing to glide, the native scroll and
            // the page's edge gestures keep the event.
            return false;
        }
        self.target = target;
        self.moving = true;
        true
    }
    /// Advances to `at` (milliseconds, the frame clock) and returns the offset
    /// to write, or `None` once the glide has let go: it settled on an earlier
    /// frame, or `observed` shows that something else moved the viewport.
    pub fn frame(&mut self, at: f64, observed: f64, limit: f64) -> Option<f64> {
        if !self.moving {
            return None;
        }
        if observed.is_finite() && (observed - self.written).abs() > INTERFERENCE {
            self.release();
            return None;
        }
        if limit.is_finite() {
            self.target = self.target.clamp(0., limit.max(0.));
        }
        let dt = match self.last {
            Some(last) if at.is_finite() => ((at - last) / 1000.).clamp(0., MAX_STEP),
            _ => FIRST_STEP,
        };
        if at.is_finite() {
            self.last = Some(at);
        }
        self.position = self.target + (self.position - self.target) * (-DAMPING * dt).exp();
        if (self.target - self.position).abs() < SETTLE {
            self.position = self.target;
            self.release();
        }
        self.written = self.position;
        Some(self.position)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(glide: &mut Glide, fps: f64, seconds: f64, limit: f64) -> Vec<f64> {
        let mut out = vec![];
        let mut at = 1000.;
        let mut observed = glide.position();
        let frames = (seconds * fps).round() as usize;
        for _ in 0..frames {
            at += 1000. / fps;
            match glide.frame(at, observed, limit) {
                Some(value) => {
                    observed = value;
                    out.push(value);
                }
                None => break,
            }
        }
        out
    }

    #[test]
    fn a_notch_answers_at_once_and_settles_softly_on_its_target() {
        let mut g = Glide::new();
        assert!(g.wheel(100., DeltaMode::Pixel, 800., 0., 2000.));
        let path = run(&mut g, 60., 3., 2000.);
        // Visible on the very first frame, half way in about 0.12 s.
        assert!(path[0] > 5.);
        assert!(path[6] > 40. && path[6] < 75., "{}", path[6]);
        // Monotonic, never past the target, then exactly on it.
        assert!(path.windows(2).all(|p| p[1] >= p[0]));
        assert!(path.iter().all(|&p| p <= 100.));
        assert_eq!(*path.last().unwrap(), 100.);
        assert!(!g.moving());
        // A long tail: still moving after half a second, done within ~1.2 s.
        assert!(path.len() > 30 && path.len() < 75, "{}", path.len());
    }

    #[test]
    fn frame_rate_does_not_change_the_motion() {
        let mut reference = Glide::new();
        reference.wheel(300., DeltaMode::Pixel, 800., 0., 2000.);
        reference.frame(0., 0., 2000.);
        reference.frame(250., f64::NAN, 2000.);
        for fps in [30_f64, 60., 90., 120., 144.] {
            let mut g = Glide::new();
            g.wheel(300., DeltaMode::Pixel, 800., 0., 2000.);
            g.frame(0., 0., 2000.);
            let mut at: f64 = 0.;
            while at < 250. - 1e-9 {
                at = (at + 1000. / fps).min(250.);
                g.frame(at, f64::NAN, 2000.);
            }
            assert!((g.position() - reference.position()).abs() < 1e-9, "{fps}");
        }
    }

    #[test]
    fn notches_accumulate_and_edges_hold() {
        let mut g = Glide::new();
        for _ in 0..5 {
            assert!(g.wheel(100., DeltaMode::Pixel, 800., 0., 350.));
        }
        assert_eq!(g.target(), 350.);
        let path = run(&mut g, 60., 3., 350.);
        assert_eq!(*path.last().unwrap(), 350.);
        // Idle at the end: the step stays native, so edge gestures still see it.
        assert!(!g.wheel(100., DeltaMode::Pixel, 800., 350., 350.));
        assert!(!g.moving());
        assert!(g.wheel(-100., DeltaMode::Pixel, 800., 350., 350.));
        assert_eq!(g.target(), 250.);
    }

    #[test]
    fn idle_at_top_leaves_an_upward_step_native() {
        let mut g = Glide::new();
        assert!(!g.wheel(-100., DeltaMode::Pixel, 800., 0., 900.));
        assert!(!g.moving());
    }

    #[test]
    fn a_reversal_turns_from_the_view_not_from_the_far_target() {
        let mut g = Glide::new();
        g.wheel(600., DeltaMode::Pixel, 800., 0., 2000.);
        g.frame(0., 0., 2000.);
        let observed = g.frame(50., g.position(), 2000.).unwrap();
        assert!(observed < 600.);
        assert!(g.wheel(-100., DeltaMode::Pixel, 800., observed, 2000.));
        assert!((g.target() - (observed - 100.)).abs() < 1e-9);
        let next = g.frame(66., observed, 2000.).unwrap();
        assert!(next < observed);
    }

    #[test]
    fn someone_else_moving_the_view_ends_the_glide() {
        let mut g = Glide::new();
        g.wheel(400., DeltaMode::Pixel, 800., 100., 2000.);
        let first = g.frame(0., 100., 2000.).unwrap();
        // Rounded read-backs are not interference.
        let second = g.frame(16., first.round(), 2000.).unwrap();
        assert!(second > first);
        // A keyboard jump or a programmatic reset is.
        assert_eq!(g.frame(32., 0., 2000.), None);
        assert!(!g.moving());
        // The next notch starts where the view is now.
        assert!(g.wheel(100., DeltaMode::Pixel, 800., 0., 2000.));
        assert_eq!(g.target(), 100.);
    }

    #[test]
    fn line_and_page_wheels_use_dom_units() {
        let mut g = Glide::new();
        g.wheel(3., DeltaMode::from_dom(1), 800., 0., 5000.);
        assert!((g.target() - 50.).abs() < 1e-9);
        let mut g = Glide::new();
        g.wheel(1., DeltaMode::from_dom(2), 800., 0., 5000.);
        assert_eq!(g.target(), 800.);
        assert_eq!(DeltaMode::from_dom(0), DeltaMode::Pixel);
    }

    #[test]
    fn shrinking_content_pulls_the_target_in() {
        let mut g = Glide::new();
        g.wheel(900., DeltaMode::Pixel, 800., 0., 1000.);
        g.frame(0., 0., 1000.);
        let path = run(&mut g, 60., 3., 300.);
        assert_eq!(*path.last().unwrap(), 300.);
    }

    #[test]
    fn invalid_input_changes_nothing() {
        let mut g = Glide::new();
        assert!(!g.wheel(f64::NAN, DeltaMode::Pixel, 800., 0., 1000.));
        assert!(!g.wheel(100., DeltaMode::Pixel, 800., f64::INFINITY, 1000.));
        assert!(!g.wheel(0., DeltaMode::Pixel, 800., 0., 1000.));
        assert!(!g.moving());
        assert_eq!(g.frame(16., 0., 1000.), None);
        g.wheel(100., DeltaMode::Pixel, 800., 0., 1000.);
        assert!(g.frame(f64::NAN, 0., f64::NAN).is_some());
        assert!(g.position().is_finite());
    }
}
