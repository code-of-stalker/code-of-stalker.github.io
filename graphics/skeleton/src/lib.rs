//! Skeleton: the loading state of every product surface. While the app, the
//! graphics engine or a scene is still on its way, its place is held by quiet
//! shapes of the content to come, and one scanning light passes over all of
//! them at once, the way attention moves across a page before it settles.
//!
//! Everything that moves is computed here, as pure functions of time: when a
//! skeleton appears (never for a load that finishes at once), the scan, and
//! the hand-over to the content. The browser adapter only writes the values
//! to the hosts' styles; the page gives the shapes and the theme's colors.
//! The module is tiny on purpose: it has to run before the graphics engine.
#[cfg(target_arch = "wasm32")]
mod browser;

/// A load that finishes sooner never shows a skeleton, so nothing flashes.
pub const APPEAR_DELAY_MS: f64 = 120.0;
/// The skeleton fades in over this time once the delay has passed.
pub const APPEAR_MS: f64 = 240.0;
/// When the content is ready the skeleton dissolves into it.
pub const SETTLE_MS: f64 = 320.0;
/// One pass of the scanning light across the viewport...
pub const SWEEP_MS: f64 = 1600.0;
/// ...and the calm before the next one.
pub const REST_MS: f64 = 700.0;
pub const PERIOD_MS: f64 = SWEEP_MS + REST_MS;

/// The band waits beyond the left edge before a pass...
pub const PARKED_LEFT: f64 = 1.0;
/// ...and beyond the right edge after it, and whenever motion is reduced.
pub const PARKED_RIGHT: f64 = 0.0;

fn smooth(t: f64) -> f64 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn sine_in_out(t: f64) -> f64 {
    let t = t.clamp(0.0, 1.0);
    (1.0 - (std::f64::consts::PI * t).cos()) / 2.0
}

/// Where the band of light stands, as the CSS `background-position-x`
/// fraction of a gradient three viewports wide: `PARKED_LEFT` is just beyond
/// the left edge, `PARKED_RIGHT` just beyond the right one. `elapsed` counts
/// from the first pass; before it the band waits on the left.
pub fn sweep(elapsed: f64, reduced: bool) -> f64 {
    if reduced {
        return PARKED_RIGHT;
    }
    if elapsed < 0.0 {
        return PARKED_LEFT;
    }
    let phase = elapsed.rem_euclid(PERIOD_MS);
    if phase >= SWEEP_MS {
        return PARKED_RIGHT;
    }
    PARKED_LEFT - sine_in_out(phase / SWEEP_MS) * (PARKED_LEFT - PARKED_RIGHT)
}

/// A value in 0..=1 written as a CSS number with `places` decimals. Done by
/// hand: the float formatter would triple the size of the module.
pub fn fraction(value: f64, places: u32) -> String {
    let scale = 10_u32.pow(places);
    let units = (value.clamp(0.0, 1.0) * f64::from(scale)).round() as u32;
    let mut text = String::with_capacity(places as usize + 2);
    text.push(if units >= scale { '1' } else { '0' });
    text.push('.');
    let (mut rest, mut digit) = (units % scale, scale / 10);
    while digit > 0 {
        text.push(char::from(b'0' + (rest / digit) as u8));
        rest %= digit;
        digit /= 10;
    }
    text
}

/// What one skeleton shows at a moment.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// Opacity of the whole skeleton, 0..1.
    pub presence: f64,
    /// Position of the shared band of light, see [`sweep`].
    pub sweep: f64,
}

#[derive(Clone, Copy, Debug)]
struct Host {
    id: u32,
    since: f64,
    /// When the content became ready and how present the skeleton was then.
    settled: Option<(f64, f64)>,
}

impl Host {
    fn arrival(&self, at: f64, reduced: bool) -> f64 {
        let shown = at - self.since - APPEAR_DELAY_MS;
        if shown < 0.0 {
            0.0
        } else if reduced {
            1.0
        } else {
            smooth(shown / APPEAR_MS)
        }
    }

    fn presence(&self, at: f64, reduced: bool) -> f64 {
        match self.settled {
            None => self.arrival(at, reduced),
            Some(_) if reduced => 0.0,
            Some((from, held)) => held * (1.0 - smooth((at - from) / SETTLE_MS)),
        }
    }

    fn changing(&self, at: f64, reduced: bool) -> bool {
        if reduced {
            return self.settled.is_none() && at - self.since < APPEAR_DELAY_MS;
        }
        match self.settled {
            None => at - self.since < APPEAR_DELAY_MS + APPEAR_MS,
            Some((from, held)) => held > 0.0 && at - from < SETTLE_MS,
        }
    }
}

/// Every skeleton on the page. They share one scan, so shapes that appear
/// at different moments still read as a single surface being looked over.
#[derive(Debug, Default)]
pub struct Field {
    hosts: Vec<Host>,
    next: u32,
    /// Start of the first pass; reset when the last skeleton leaves.
    origin: Option<f64>,
    reduced: bool,
}

impl Field {
    pub fn new() -> Self {
        Self::default()
    }

    /// A surface starts loading at `at`; returns its skeleton's id.
    pub fn attach(&mut self, at: f64) -> u32 {
        if self.hosts.is_empty() {
            // The first pass enters as the skeleton fades in.
            self.origin = Some(at + APPEAR_DELAY_MS);
        }
        self.next = self.next.wrapping_add(1);
        let id = self.next;
        self.hosts.push(Host {
            id,
            since: at,
            settled: None,
        });
        id
    }

    /// The content is ready: the skeleton dissolves from where it stands.
    pub fn settle(&mut self, id: u32, at: f64) {
        let reduced = self.reduced;
        if let Some(host) = self.hosts.iter_mut().find(|host| host.id == id) {
            if host.settled.is_none() {
                host.settled = Some((at, host.arrival(at, reduced)));
            }
        }
    }

    /// The surface is gone (or never needed a skeleton any more).
    pub fn detach(&mut self, id: u32) {
        self.hosts.retain(|host| host.id != id);
        if self.hosts.is_empty() {
            self.origin = None;
        }
    }

    pub fn set_reduced(&mut self, value: bool) {
        self.reduced = value;
    }

    pub fn look(&self, id: u32, at: f64) -> Option<Look> {
        let host = self.hosts.iter().find(|host| host.id == id)?;
        let elapsed = self.origin.map_or(-1.0, |origin| at - origin);
        Some(Look {
            presence: host.presence(at, self.reduced),
            sweep: sweep(elapsed, self.reduced),
        })
    }

    /// The skeleton has fully handed over to its content.
    pub fn gone(&self, id: u32, at: f64) -> bool {
        self.hosts
            .iter()
            .find(|host| host.id == id)
            .is_none_or(|host| host.settled.is_some() && host.presence(at, self.reduced) <= 0.0)
    }

    /// Whether the next frame can differ from this one.
    pub fn moving(&self, at: f64) -> bool {
        self.hosts.iter().any(|host| {
            host.changing(at, self.reduced)
                || (!self.reduced && host.settled.is_none() && host.presence(at, false) > 0.0)
        })
    }

    pub fn ids(&self) -> impl Iterator<Item = u32> + '_ {
        self.hosts.iter().map(|host| host.id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_quick_load_never_shows_a_skeleton() {
        let mut field = Field::new();
        let id = field.attach(1000.0);
        assert_eq!(
            field
                .look(id, 1000.0 + APPEAR_DELAY_MS - 1.0)
                .unwrap()
                .presence,
            0.0
        );
        field.settle(id, 1000.0 + APPEAR_DELAY_MS - 1.0);
        assert!(field.gone(id, 1000.0 + APPEAR_DELAY_MS));
        assert_eq!(field.look(id, 2000.0).unwrap().presence, 0.0);
    }

    #[test]
    fn a_slow_load_fades_in_and_hands_over_from_where_it_stands() {
        let mut field = Field::new();
        let id = field.attach(0.0);
        let half = field
            .look(id, APPEAR_DELAY_MS + APPEAR_MS / 2.0)
            .unwrap()
            .presence;
        assert!((half - 0.5).abs() < 1e-9);
        assert_eq!(field.look(id, 2000.0).unwrap().presence, 1.0);
        field.settle(id, APPEAR_DELAY_MS + APPEAR_MS / 2.0 + 10.0);
        let held = field
            .look(id, APPEAR_DELAY_MS + APPEAR_MS / 2.0 + 10.0)
            .unwrap()
            .presence;
        assert!(
            held > 0.5 && held < 0.6,
            "settling keeps the current presence: {held}"
        );
        let after = APPEAR_DELAY_MS + APPEAR_MS / 2.0 + 10.0 + SETTLE_MS;
        assert!(!field.gone(id, after - 1.0));
        assert!(field.gone(id, after));
    }

    #[test]
    fn every_skeleton_shares_one_scan() {
        let mut field = Field::new();
        let first = field.attach(0.0);
        let second = field.attach(900.0);
        let at = APPEAR_DELAY_MS + SWEEP_MS * 0.4;
        assert_eq!(
            field.look(first, at).unwrap().sweep,
            field.look(second, at).unwrap().sweep
        );
    }

    #[test]
    fn the_band_enters_from_the_left_crosses_and_rests_beyond_the_right_edge() {
        assert_eq!(sweep(-5.0, false), PARKED_LEFT);
        assert_eq!(sweep(0.0, false), PARKED_LEFT);
        let mut previous = PARKED_LEFT;
        for step in 1..=16 {
            let value = sweep(SWEEP_MS * f64::from(step) / 16.0 - 0.001, false);
            assert!(value <= previous, "the band only moves to the right");
            previous = value;
        }
        assert_eq!(sweep(SWEEP_MS + 1.0, false), PARKED_RIGHT);
        assert_eq!(sweep(PERIOD_MS + 1e-6, false), sweep(1e-6, false));
    }

    #[test]
    fn reduced_motion_is_a_still_skeleton() {
        let mut field = Field::new();
        field.set_reduced(true);
        let id = field.attach(0.0);
        assert_eq!(field.look(id, APPEAR_DELAY_MS - 1.0).unwrap().presence, 0.0);
        let look = field.look(id, APPEAR_DELAY_MS).unwrap();
        assert_eq!(
            look,
            Look {
                presence: 1.0,
                sweep: PARKED_RIGHT
            }
        );
        assert!(!field.moving(APPEAR_DELAY_MS + 1.0));
        field.settle(id, 5000.0);
        assert!(field.gone(id, 5000.0));
    }

    #[test]
    fn frames_stop_once_every_skeleton_has_handed_over() {
        let mut field = Field::new();
        let id = field.attach(0.0);
        assert!(field.moving(10.0));
        assert!(field.moving(5000.0), "a waiting skeleton keeps scanning");
        field.settle(id, 5000.0);
        assert!(field.moving(5000.0 + SETTLE_MS / 2.0));
        assert!(!field.moving(5000.0 + SETTLE_MS));
        field.detach(id);
        assert!(field.ids().next().is_none());
        assert!(field.gone(id, 6000.0), "a detached skeleton is gone");
    }

    #[test]
    fn css_numbers_are_written_without_the_float_formatter() {
        assert_eq!(fraction(0.0, 3), "0.000");
        assert_eq!(fraction(1.0, 3), "1.000");
        assert_eq!(fraction(0.12345, 4), "0.1235");
        assert_eq!(fraction(0.05, 3), "0.050");
        assert_eq!(fraction(-2.0, 3), "0.000");
        assert_eq!(fraction(0.99996, 4), "1.0000");
    }

    #[test]
    fn the_scan_restarts_for_the_next_loading_surface() {
        let mut field = Field::new();
        let first = field.attach(0.0);
        field.detach(first);
        let next = field.attach(10_000.0);
        assert_eq!(field.look(next, 10_000.0).unwrap().sweep, PARKED_LEFT);
    }
}
