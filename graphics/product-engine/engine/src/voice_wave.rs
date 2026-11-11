//! Voice message waveform. React lays out the bars once; Rust owns the played wash
//! (a clip of the accent layer that follows the playhead smoothly) and the soft lift of
//! the bars under the playhead while the voice plays.
use crate::{clock::Clock, ui_motion::WaveModel};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::HtmlElement;

#[wasm_bindgen]
pub struct VoiceWave {
    played: Option<HtmlElement>,
    bars: Vec<(usize, HtmlElement)>,
    count: usize,
    clock: Clock,
    model: WaveModel,
    dirty: bool,
}

#[wasm_bindgen]
impl VoiceWave {
    /// `root` holds `[data-wave-played]` (the accent layer) and bars marked
    /// `data-wave-bar="<index>"` in both layers.
    pub fn create(root: HtmlElement, position_ms: f64, duration_ms: f64) -> Self {
        let played = root
            .query_selector("[data-wave-played]")
            .ok()
            .flatten()
            .and_then(|node| node.dyn_into::<HtmlElement>().ok());
        let mut bars = Vec::new();
        if let Ok(list) = root.query_selector_all("[data-wave-bar]") {
            for i in 0..list.length() {
                let Some(bar) = list
                    .item(i)
                    .and_then(|node| node.dyn_into::<HtmlElement>().ok())
                else {
                    continue;
                };
                let index = bar
                    .get_attribute("data-wave-bar")
                    .and_then(|value| value.parse().ok())
                    .unwrap_or(0);
                bars.push((index, bar));
            }
        }
        let count = bars.iter().map(|(i, _)| i + 1).max().unwrap_or(0);
        Self {
            played,
            bars,
            count,
            clock: Clock::default(),
            model: WaveModel::new(position_ms, duration_ms),
            dirty: true,
        }
    }
    pub fn sync(&mut self, position_ms: f64, duration_ms: f64, playing: bool) {
        self.model
            .sync(position_ms, duration_ms, playing, self.clock.elapsed);
        self.dirty = true;
    }
    pub fn reduced(&mut self, value: bool) {
        self.model.reduced(value);
        self.dirty = true;
    }
    /// Returns whether another frame is needed.
    pub fn frame(&mut self, at: f64) -> bool {
        if !self.dirty && !self.model.moving(self.clock.elapsed) {
            self.clock.suspend();
            return false;
        }
        let dt = self.clock.step(at, true).min(0.1);
        self.model.step(self.clock.elapsed, dt);
        self.paint();
        self.dirty = false;
        self.model.moving(self.clock.elapsed)
    }
    pub fn dispose(&mut self) {
        self.bars.clear();
        self.played = None;
    }
    fn paint(&self) {
        let progress = self.model.progress();
        if let Some(played) = &self.played {
            let _ = played.style().set_property(
                "clip-path",
                &format!("inset(0 {:.3}% 0 0)", (1. - progress) * 100.),
            );
        }
        for (index, bar) in &self.bars {
            let scale = self
                .model
                .bar_scale(*index, self.count, self.clock.elapsed);
            let _ = bar
                .style()
                .set_property("transform", &format!("scaleY({scale:.4})"));
        }
    }
}
