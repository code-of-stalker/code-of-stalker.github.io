//! Browser adapter boundary: plain numbers in, one offset out per frame.
use crate::{DeltaMode, Glide};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Default)]
pub struct SoftScroll {
    glide: Glide,
}
#[wasm_bindgen]
impl SoftScroll {
    #[wasm_bindgen(constructor)]
    pub fn new() -> SoftScroll {
        SoftScroll::default()
    }
    /// `WheelEvent.deltaY` and `deltaMode`, the viewport height, its current
    /// offset and largest offset. True when the glide took the step.
    pub fn wheel(&mut self, delta: f64, mode: u32, page: f64, current: f64, limit: f64) -> bool {
        self.glide
            .wheel(delta, DeltaMode::from_dom(mode), page, current, limit)
    }
    /// The offset to write at frame time `at`, or NaN once the glide let go.
    pub fn frame(&mut self, at: f64, observed: f64, limit: f64) -> f64 {
        self.glide.frame(at, observed, limit).unwrap_or(f64::NAN)
    }
    pub fn moving(&self) -> bool {
        self.glide.moving()
    }
    pub fn release(&mut self) {
        self.glide.release();
    }
}
