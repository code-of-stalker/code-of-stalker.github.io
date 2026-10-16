//! Same nine-stop Laboratory smoothstep mask as the glass shader, calculated in
//! Rust and applied to the complete panel (including text and vector border).
use crate::scan_profile::ScanProfile;
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::HtmlElement;
#[wasm_bindgen]
pub fn panel_reveal(root: &HtmlElement, progress: f32, reduced: bool) {
    let scan = ScanProfile::new(progress, reduced);
    let mask = scan.mask();
    let style = root.style();
    let _ = style.set_property("mask-image", &mask);
    let _ = style.set_property("-webkit-mask-image", &mask);
    let _ = root.set_attribute("data-panel-reveal", &scan.progress.to_string());
    // The leading edge has zero content-mask alpha. Paint the light in an
    // unmasked sibling, clipped only to the panel's cut-corner contour.
    if let Some(light) = root
        .parent_element()
        .and_then(|p| {
            p.query_selector(":scope > [data-panel-scan-light]")
                .ok()
                .flatten()
        })
        .and_then(|e| e.dyn_into::<HtmlElement>().ok())
    {
        let _ = light
            .style()
            .set_property("background-image", &scan.light());
        let _ = light.set_attribute("data-scan-progress", &scan.progress.to_string());
    }
}
