use crate::{clock::Clock, motion_kernel::text_frame};
use wasm_bindgen::prelude::*;
use web_sys::HtmlElement;
#[wasm_bindgen]
pub struct TextTimeline {
    root: HtmlElement,
    text: String,
    effect: u32,
    clock: Clock,
    active: bool,
    reduced: bool,
}
#[wasm_bindgen]
impl TextTimeline {
    pub fn create(root: HtmlElement, text: String, effect: u32) -> Self {
        let model = Self {
            root,
            text,
            effect,
            clock: Clock::default(),
            active: false,
            reduced: false,
        };
        model.resize();
        model
    }
    pub fn resize(&self) {
        if let (Ok(Some(base)), Ok(Some(veil))) = (
            self.root
                .query_selector("[data-testid='dream-reality-text']"),
            self.root.query_selector("[data-rust-text-veil]"),
        ) {
            if let (Some(window), Some(veil)) = (
                web_sys::window(),
                wasm_bindgen::JsCast::dyn_ref::<HtmlElement>(&veil),
            ) {
                if let Ok(Some(css)) = window.get_computed_style(&base) {
                    for name in [
                        "font-family",
                        "font-size",
                        "font-weight",
                        "line-height",
                        "letter-spacing",
                        "text-transform",
                        "color",
                    ] {
                        if let Ok(value) = css.get_property_value(name) {
                            let _ = veil.style().set_property(name, &value);
                        }
                    }
                }
            }
        }
    }
    pub fn active(&mut self, active: bool, reduced: bool) {
        self.active = active;
        self.reduced = reduced;
        if !active {
            self.clock.suspend();
        }
        self.paint();
    }
    pub fn frame(&mut self, at: f64) -> bool {
        if !self.active || self.reduced {
            self.clock.suspend();
            return false;
        }
        self.clock.step(at, true);
        self.paint();
        true
    }
    pub fn reset_clock(&mut self) {
        self.clock.suspend();
    }
    pub fn dispose(&mut self) {
        self.active = false;
    }
    fn paint(&self) {
        let frame = text_frame(&self.text, self.effect, self.clock.elapsed, self.reduced);
        if self.effect == 1 {
            if let Ok(Some(node)) = self.root.query_selector("[data-rust-text-veil]") {
                node.set_text_content(Some(&frame.text));
                if let Some(node) = wasm_bindgen::JsCast::dyn_ref::<HtmlElement>(&node) {
                    let _ = node
                        .style()
                        .set_property("opacity", &frame.opacity.to_string());
                }
            }
        }
        if self.effect == 2 {
            if let Ok(Some(node)) = self.root.query_selector("[data-rust-one]") {
                if let Some(node) = node.dyn_ref::<HtmlElement>() {
                    let _ = node
                        .style()
                        .set_property("transform", &format!("scale({})", frame.scale));
                }
            }
        }
        if self.effect == 3 {
            if let Ok(Some(node)) = self
                .root
                .query_selector("[data-testid='step-one-emphasis']")
            {
                if let Some(node) = node.dyn_ref::<HtmlElement>() {
                    let _ = node.style().set_property(
                        "text-shadow",
                        &format!(
                            "0 0 10px color-mix(in srgb,var(--conclusion-accent) {}%,transparent)",
                            frame.opacity * 100.
                        ),
                    );
                }
            }
        }
        if self.effect == 4 {
            if let Ok(Some(node)) = self.root.query_selector("[data-rust-signature]") {
                if let Some(node) = node.dyn_ref::<HtmlElement>() {
                    let style = node.style();
                    let _ = style.set_property("--signature-written", &frame.scale.to_string());
                    let _ = style.set_property(
                        "text-shadow",
                        &format!(
                            "0 0 9px color-mix(in srgb,var(--signature-warm) {}%,transparent)",
                            frame.opacity * 100.
                        ),
                    );
                }
            }
        }
        let _ = self
            .root
            .set_attribute("data-rust-text-time", &self.clock.elapsed.to_string());
        let _ = self.root.set_attribute(
            "data-rust-text-running",
            &(self.active && !self.reduced).to_string(),
        );
    }
}
