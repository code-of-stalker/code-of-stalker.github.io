//! Small offline native kernel. Shared source, not a second motion model.
#[path = "../../engine/src/clock.rs"]
mod clock;
#[path = "../../engine/src/inertial_progress.rs"]
mod inertial_progress;
#[path = "../../engine/src/motion_kernel.rs"]
mod motion_kernel;
#[path = "../../engine/src/reading_focus.rs"]
mod reading_focus;
#[path = "../../engine/src/reading_layout.rs"]
mod reading_layout;
#[path = "../../engine/src/scene_model.rs"]
mod scene_model;
use wasm_bindgen::prelude::*;
#[wasm_bindgen]
pub struct NativeKernel {
    core: motion_kernel::Kernel,
    texts: std::collections::BTreeMap<u32, NativeText>,
    readings: std::collections::BTreeMap<u32, reading_layout::Reading>,
    focuses: std::collections::BTreeMap<u32, reading_focus::ReadingFocus>,
    active: bool,
}
struct NativeText {
    text: String,
    effect: u32,
    active: bool,
    reduced: bool,
    clock: clock::Clock,
}
#[wasm_bindgen]
impl NativeKernel {
    pub fn create() -> Self {
        Self {
            core: motion_kernel::Kernel::create(),
            texts: Default::default(),
            readings: Default::default(),
            focuses: Default::default(),
            active: true,
        }
    }
    pub fn active(&mut self, value: bool) {
        self.active = value;
        self.core.active(value);
        if !value {
            for t in self.texts.values_mut() {
                t.clock.suspend();
            }
            for r in self.readings.values_mut() {
                r.suspend();
            }
            for focus in self.focuses.values_mut() {
                focus.suspend();
            }
        }
    }
    pub fn insert(&mut self, id: u32, value: f64) {
        self.core.insert(id, value);
    }
    pub fn remove(&mut self, id: u32) {
        self.core.remove(id);
        self.texts.remove(&id);
        self.readings.remove(&id);
        self.focuses.remove(&id);
    }
    pub fn set(&mut self, id: u32, value: f64) {
        self.core.set(id, value);
    }
    pub fn stop(&mut self, id: u32) {
        self.core.stop(id);
    }
    pub fn target(
        &mut self,
        id: u32,
        to: f64,
        duration: f64,
        delay: f64,
        curve: Vec<f64>,
        spring: bool,
    ) {
        self.core.target(id, to, duration, delay, curve, spring);
    }
    pub fn mapping(
        &mut self,
        id: u32,
        parent: u32,
        input: Vec<f64>,
        output: Vec<f64>,
        clamp: bool,
    ) {
        self.core.map(id, parent, input, output, clamp);
    }
    pub fn frame(&mut self, at: f64) -> Vec<f64> {
        self.core.frame(at)
    }
    pub fn moving(&self) -> bool {
        self.core.moving()
            || self.texts.values().any(|t| t.active && !t.reduced)
            || self.readings.values().any(|r| r.moving())
            || self.focuses.values().any(|f| f.moving())
    }
    pub fn register_reading(&mut self, id: u32, values: Vec<f64>) {
        if values.len() >= 10 && values.iter().all(|v| v.is_finite()) {
            if let Some(reading) = self.readings.get_mut(&id) {
                reading.configure(values);
            } else {
                self.readings
                    .insert(id, reading_layout::Reading::new(values));
            }
        }
    }
    pub fn register_reading_focus(&mut self, id: u32, count: u32) {
        if count <= 64 {
            self.focuses
                .insert(id, reading_focus::ReadingFocus::new(count as usize));
        }
    }
    pub fn configure_reading_focus(&mut self, id: u32, economy: bool, enabled: bool) {
        if let Some(f) = self.focuses.get_mut(&id) {
            f.configure(economy, enabled);
        }
    }
    pub fn reading_focus_geometry(&mut self, id: u32, bounds: Vec<f64>, offset: f64, height: f64) {
        if let Some(f) = self.focuses.get_mut(&id) {
            f.geometry(&bounds, offset, height);
        }
    }
    pub fn frame_reading_focus(&mut self, at: f64) -> String {
        if !self.active {
            return "[]".into();
        }
        let rows = self
            .focuses
            .iter_mut()
            .filter_map(|(id, f)| {
                f.frame(at).map(|v| {
                    format!(
                        "[{id},[{}]]",
                        v.iter()
                            .map(|v| if *v { "1" } else { "0" })
                            .collect::<Vec<_>>()
                            .join(",")
                    )
                })
            })
            .collect::<Vec<_>>();
        format!("[{}]", rows.join(","))
    }
    pub fn observe_reading(&mut self, id: u32, offset: f64, at: f64) {
        if let Some(r) = self.readings.get_mut(&id) {
            r.observe(offset, at);
        }
    }
    pub fn drag_reading(&mut self, id: u32, delta: f64, at: f64) {
        if let Some(r) = self.readings.get_mut(&id) {
            r.drag(delta, at);
        }
    }
    pub fn frame_reading(&mut self, at: f64) -> Vec<f64> {
        let mut out = vec![];
        if !self.active {
            return out;
        }
        for (id, r) in &mut self.readings {
            if let Some(v) = r.frame(at) {
                out.push(*id as f64);
                out.extend(v);
            }
        }
        out
    }
    pub fn register_text(&mut self, id: u32, text: String, effect: u32) {
        self.texts.insert(
            id,
            NativeText {
                text,
                effect,
                active: false,
                reduced: true,
                clock: Default::default(),
            },
        );
    }
    pub fn text_active(&mut self, id: u32, active: bool, reduced: bool) {
        if let Some(t) = self.texts.get_mut(&id) {
            t.active = active;
            t.reduced = reduced;
            if !active || reduced {
                t.clock.suspend();
            }
        }
    }
    pub fn frame_text(&mut self, at: f64) -> String {
        let mut out = String::from("[");
        let mut comma = false;
        for (id, t) in &mut self.texts {
            if !t.active || !self.active {
                t.clock.suspend();
                continue;
            }
            t.clock.step(at, !t.reduced);
            let f = motion_kernel::text_frame(&t.text, t.effect, t.clock.elapsed, t.reduced);
            if comma {
                out.push(',');
            }
            comma = true;
            out.push_str(&format!(
                "[{id},{},{},{}]",
                json_text(&f.text),
                f.opacity,
                f.scale
            ));
        }
        out.push(']');
        out
    }
}
#[wasm_bindgen]
pub fn inflate_runtime(bytes: &[u8]) -> Result<Vec<u8>, JsValue> {
    miniz_oxide::inflate::decompress_to_vec_zlib_with_limit(bytes, 128 * 1024 * 1024)
        .map_err(|_| JsValue::from_str("Invalid bundled Rust runtime"))
}
#[wasm_bindgen]
pub fn typography(text: &str, effect: u32, seconds: f64, reduced: bool) -> String {
    let frame = motion_kernel::text_frame(text, effect, seconds, reduced);
    format!(
        "{{\"text\":{},\"opacity\":{},\"scale\":{}}}",
        json_text(&frame.text),
        frame.opacity,
        frame.scale
    )
}
fn json_text(text: &str) -> String {
    let mut out = String::from("\"");
    for ch in text.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}
