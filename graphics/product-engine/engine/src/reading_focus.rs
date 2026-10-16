//! Reading playback policy. Platforms provide measured bounds, never decisions
//! or pause timers. Scene clocks retain their phase when this policy pauses them.
use crate::clock::Clock;

#[derive(Default)]
struct Scene {
    top: f64,
    height: f64,
    playing: bool,
    enter: Option<f64>,
    leave: Option<f64>,
}
pub struct ReadingFocus {
    scenes: Vec<Scene>,
    viewport: [f64; 2],
    economy: bool,
    enabled: bool,
    dirty: bool,
    clock: Clock,
}
impl ReadingFocus {
    pub fn new(count: usize) -> Self {
        Self {
            scenes: (0..count).map(|_| Scene::default()).collect(),
            viewport: [0.; 2],
            economy: false,
            enabled: false,
            dirty: true,
            clock: Clock::default(),
        }
    }
    pub fn configure(&mut self, economy: bool, enabled: bool) {
        self.economy = economy;
        self.enabled = enabled;
        self.dirty = true;
    }
    pub fn geometry(&mut self, bounds: &[f64], offset: f64, height: f64) {
        if bounds.len() != self.scenes.len() * 2
            || !bounds
                .iter()
                .chain([&offset, &height])
                .all(|v| v.is_finite())
        {
            return;
        }
        for (scene, pair) in self.scenes.iter_mut().zip(bounds.as_chunks::<2>().0) {
            scene.top = pair[0];
            scene.height = pair[1].max(0.);
        }
        self.viewport = [offset, height.max(0.)];
        self.dirty = true;
    }
    pub fn suspend(&mut self) {
        self.clock.suspend();
    }
    pub fn moving(&self) -> bool {
        self.dirty
            || self
                .scenes
                .iter()
                .any(|s| s.enter.is_some() || s.leave.is_some())
    }
    pub fn frame(&mut self, at: f64) -> Option<Vec<bool>> {
        if !self.moving() {
            self.clock.suspend();
            return None;
        }
        self.clock.step(at, true);
        let now = self.clock.elapsed;
        let [top, height] = self.viewport;
        let overlap = |s: &Scene| (s.top + s.height).min(top + height) - s.top.max(top);
        let mut changed = self.dirty;
        for scene in &mut self.scenes {
            // Edge scenes cannot always reach the viewport centre. A small
            // visible part is enough, in every quality and before expansion.
            let wanted = self.enabled
                && scene.height > 0.
                && height > 0.
                && overlap(scene) >= 8f64.min(scene.height * 0.2).min(height * 0.2);
            let before = scene.playing;
            if wanted {
                scene.leave = None;
                if !scene.playing {
                    let start = *scene.enter.get_or_insert(now);
                    if now - start >= 0.12 {
                        scene.playing = true;
                        scene.enter = None;
                    }
                }
            } else {
                scene.enter = None;
                if scene.playing && self.economy && self.enabled {
                    let stop = *scene.leave.get_or_insert(now + 0.34);
                    if now >= stop {
                        scene.playing = false;
                        scene.leave = None;
                    }
                } else {
                    scene.playing = false;
                    scene.leave = None;
                }
            }
            changed |= before != scene.playing;
        }
        self.dirty = false;
        changed.then(|| self.scenes.iter().map(|s| s.playing).collect())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_visible_scenes_play_in_economy_and_offscreen_scenes_pause() {
        let mut f = ReadingFocus::new(3);
        f.configure(true, true);
        f.geometry(&[0., 100., 140., 100., 280., 100.], 0., 250.);
        assert_eq!(f.frame(0.).unwrap(), [false, false, false]);
        assert_eq!(f.frame(130.).unwrap(), [true, true, false]);
        f.geometry(&[0., 100., 140., 100., 280., 100.], 200., 250.);
        assert_eq!(f.frame(140.).unwrap(), [true, true, false]);
        assert_eq!(f.frame(270.).unwrap(), [true, true, true]);
        assert_eq!(f.frame(500.).unwrap(), [false, true, true]);
        assert!(!f.moving());
        f.configure(true, false);
        assert_eq!(f.frame(510.).unwrap(), [false, false, false]);
    }
    #[test]
    fn normal_quality_keeps_visible_scenes_and_background_time_cannot_finish_coast() {
        let mut f = ReadingFocus::new(2);
        f.configure(false, true);
        f.geometry(&[0., 100., 120., 100.], 0., 240.);
        f.frame(0.);
        assert_eq!(f.frame(130.).unwrap(), [true, true]);
        f.configure(true, true);
        f.geometry(&[0., 100., 120., 100.], 110., 240.);
        f.frame(140.);
        f.suspend();
        f.frame(90000.);
        assert!(f.scenes.iter().all(|s| s.playing));
        assert_eq!(f.frame(90400.).unwrap().iter().filter(|v| **v).count(), 1);
    }
    #[test]
    fn first_and_last_scenes_play_at_viewport_edges_in_all_qualities() {
        for economy in [false, true] {
            let mut f = ReadingFocus::new(3);
            f.configure(economy, true);
            f.geometry(&[0., 100., 140., 100., 280., 100.], 90., 200.);
            f.frame(0.);
            assert_eq!(f.frame(130.).unwrap(), [true, true, true]);
            f.configure(economy, false);
            assert_eq!(f.frame(140.).unwrap(), [false, false, false]);
        }
    }
    #[test]
    fn quick_scroll_past_never_starts_the_scene() {
        let mut f = ReadingFocus::new(1);
        f.configure(true, true);
        f.geometry(&[0., 100.], 0., 200.);
        f.frame(0.);
        f.geometry(&[0., 100.], 250., 200.);
        f.frame(50.);
        assert!(!f.moving());
        assert!(!f.scenes[0].playing);
    }
}
