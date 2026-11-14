use crate::{
    clock::Clock,
    motion_kernel::{chain_frame, text_frame},
};
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
        // The chain starts hidden and surfaces once it is seen.
        if model.effect == 5 {
            model.paint();
        }
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
    /// Effect 5, the chain «стопы → опора → …»: each `[data-rust-chain-word]`
    /// surfaces from a blur and a little below; each `[data-rust-chain-arrow]`
    /// draws its `[data-rust-chain-line]` and then its `[data-rust-chain-head]`
    /// (paths measured with `pathLength="1"`). The glow is the bridge's
    /// `--chain-accent`.
    fn paint_chain(&self) {
        let select = |selector: &str| -> Vec<web_sys::Element> {
            self.root
                .query_selector_all(selector)
                .map(|list| {
                    (0..list.length())
                        .filter_map(|i| list.item(i))
                        .filter_map(|node| node.dyn_into::<web_sys::Element>().ok())
                        .collect()
                })
                .unwrap_or_default()
        };
        let words = select("[data-rust-chain-word]");
        let arrows = select("[data-rust-chain-arrow]");
        let links = chain_frame(words.len(), self.clock.elapsed, self.reduced);
        let glow = |strength: f64, px: f64| {
            format!(
                "0 0 {px}px color-mix(in srgb,var(--chain-accent) {:.1}%,transparent)",
                strength * 100.
            )
        };
        for (word, link) in words.iter().zip(&links) {
            if let Some(word) = word.dyn_ref::<HtmlElement>() {
                let style = word.style();
                let rest = 1. - link.word;
                let _ = style.set_property("opacity", &format!("{:.3}", link.word));
                let _ = style.set_property("transform", &format!("translateY({:.2}px)", 7. * rest));
                let _ = style.set_property("filter", &format!("blur({:.2}px)", 5. * rest));
                let _ = style.set_property("text-shadow", &glow(0.85 * link.glow, 12.));
            }
        }
        for (arrow, link) in arrows.iter().zip(&links) {
            if let Some(span) = arrow.dyn_ref::<HtmlElement>() {
                let style = span.style();
                let _ = style.set_property("opacity", &format!("{:.3}", link.line.max(link.head)));
                let _ = style.set_property(
                    "filter",
                    &format!("drop-shadow({})", glow(0.9 * link.glow, 4.)),
                );
            }
            for (part, drawn) in [
                ("[data-rust-chain-line]", link.line),
                ("[data-rust-chain-head]", link.head),
            ] {
                if let Ok(Some(path)) = arrow.query_selector(part) {
                    let _ = path.set_attribute("stroke-dashoffset", &format!("{:.4}", 1. - drawn));
                }
            }
        }
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
        if self.effect == 5 {
            self.paint_chain();
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
