//! Interface motion (Art 2026-11-11): short, soft changes with no springs for their own
//! sake. Pure arithmetic, so the browser adapters (`element_motion`, `voice_wave`) stay thin.
use std::f64::consts::TAU;

/// Opacity factor of a waiting element: starts fully visible, sinks to `low` and back.
pub fn breath_level(elapsed: f64, period: f64, low: f32) -> f32 {
    if period <= 0. {
        return 1.;
    }
    let low = low.clamp(0., 1.);
    let wave = 0.5 + 0.5 * (TAU * elapsed / period).cos();
    low + (1. - low) * wave as f32
}

/// Playhead of a voice message. The player reports its position a few times a second;
/// Rust runs the playhead on its own clock between reports and glides into corrections
/// and seeks instead of jumping.
#[derive(Clone, Copy, Debug)]
pub struct WaveModel {
    shown: f64,
    reported: f64,
    reported_at: f64,
    duration: f64,
    playing: bool,
    energy: f32,
    reduced: bool,
}

/// How quickly a correction or a seek closes (1/s): about 250 ms to settle.
const CATCH_UP: f64 = 12.;
/// How quickly the bars around the playhead rise when playback starts (1/s).
const WAKE: f64 = 9.;
/// Largest lift of the bar under the playhead.
const LIFT: f32 = 0.22;

impl WaveModel {
    pub fn new(position_ms: f64, duration_ms: f64) -> Self {
        let duration = duration_ms.max(1.);
        let at = position_ms.clamp(0., duration);
        Self {
            shown: at,
            reported: at,
            reported_at: 0.,
            duration,
            playing: false,
            energy: 0.,
            reduced: false,
        }
    }
    pub fn reduced(&mut self, value: bool) {
        self.reduced = value;
    }
    pub fn sync(&mut self, position_ms: f64, duration_ms: f64, playing: bool, now: f64) {
        self.duration = duration_ms.max(1.);
        self.reported = position_ms.clamp(0., self.duration);
        self.reported_at = now;
        self.playing = playing;
    }
    fn expected(&self, now: f64) -> f64 {
        let run = if self.playing {
            (now - self.reported_at).max(0.) * 1000.
        } else {
            0.
        };
        (self.reported + run).min(self.duration)
    }
    /// Advance by `dt` seconds, ending at scene time `now`.
    pub fn step(&mut self, now: f64, dt: f64) {
        let goal = self.expected(now);
        let awake = if self.playing { 1. } else { 0. };
        if self.reduced {
            self.shown = goal;
            self.energy = 0.;
            return;
        }
        if self.playing {
            self.shown += dt * 1000.;
        }
        self.shown += (goal - self.shown) * (1. - (-dt * CATCH_UP).exp());
        self.shown = self.shown.clamp(0., self.duration);
        self.energy += (awake - self.energy) * (1. - (-dt * WAKE).exp()) as f32;
        if (awake - self.energy).abs() < 0.002 {
            self.energy = awake;
        }
    }
    pub fn progress(&self) -> f32 {
        (self.shown / self.duration).clamp(0., 1.) as f32
    }
    /// Vertical scale of bar `index` of `count`: bars near the playhead breathe up a little
    /// while the voice plays and settle back when it stops.
    pub fn bar_scale(&self, index: usize, count: usize, now: f64) -> f32 {
        if self.energy <= 0. || count == 0 {
            return 1.;
        }
        let distance = index as f32 + 0.5 - self.progress() * count as f32;
        let near = (-(distance / 1.6).powi(2)).exp();
        let pulse = 0.75 + 0.25 * (now * TAU * 1.6 + index as f64 * 0.9).sin() as f32;
        1. + LIFT * self.energy * near * pulse
    }
    pub fn moving(&self, now: f64) -> bool {
        self.playing || self.energy > 0. || (self.expected(now) - self.shown).abs() > 0.5
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn breath_starts_visible_and_stays_in_range() {
        assert_eq!(breath_level(0., 1.4, 0.35), 1.);
        for i in 0..200 {
            let level = breath_level(i as f64 * 0.013, 1.4, 0.35);
            assert!((0.35..=1.).contains(&level));
        }
        assert!((breath_level(0.7, 1.4, 0.35) - 0.35).abs() < 1e-5);
        assert_eq!(breath_level(3., 0., 0.2), 1.);
    }

    #[test]
    fn playhead_runs_between_reports_without_lag() {
        let mut wave = WaveModel::new(0., 10_000.);
        wave.sync(0., 10_000., true, 0.);
        let mut now = 0.;
        for _ in 0..60 {
            now += 1. / 60.;
            wave.step(now, 1. / 60.);
        }
        assert!((wave.shown - 1000.).abs() < 5., "shown {}", wave.shown);
    }

    #[test]
    fn a_seek_glides_and_settles() {
        let mut wave = WaveModel::new(0., 10_000.);
        wave.sync(5000., 10_000., false, 0.);
        wave.step(1. / 60., 1. / 60.);
        assert!(wave.shown > 0. && wave.shown < 2500.);
        let mut now = 1. / 60.;
        for _ in 0..30 {
            now += 1. / 60.;
            wave.step(now, 1. / 60.);
        }
        assert!((wave.shown - 5000.).abs() < 120.);
        for _ in 0..60 {
            now += 1. / 60.;
            wave.step(now, 1. / 60.);
        }
        assert!(!wave.moving(now));
    }

    #[test]
    fn bars_lift_only_near_the_playhead_while_playing() {
        let mut wave = WaveModel::new(5000., 10_000.);
        assert_eq!(wave.bar_scale(16, 32, 0.), 1.);
        wave.sync(5000., 10_000., true, 0.);
        let mut now = 0.;
        for _ in 0..30 {
            now += 1. / 60.;
            wave.step(now, 1. / 60.);
        }
        let near = wave.bar_scale(16, 32, now);
        assert!(near > 1.05 && near <= 1. + LIFT, "near {near}");
        assert!(wave.bar_scale(2, 32, now) < 1.001);
        wave.sync(wave.shown, 10_000., false, now);
        for _ in 0..90 {
            now += 1. / 60.;
            wave.step(now, 1. / 60.);
        }
        assert_eq!(wave.bar_scale(16, 32, now), 1.);
    }

    #[test]
    fn reduced_motion_jumps_and_never_lifts() {
        let mut wave = WaveModel::new(0., 10_000.);
        wave.reduced(true);
        wave.sync(4000., 10_000., true, 0.);
        wave.step(0.016, 0.016);
        assert!((wave.shown - 4016.).abs() < 1.);
        assert_eq!(wave.bar_scale(12, 32, 0.016), 1.);
    }
}
