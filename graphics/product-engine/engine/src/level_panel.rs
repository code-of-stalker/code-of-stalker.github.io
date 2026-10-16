//! Thin DOM adapter for the testable, height-independent corner geometry.
use crate::level_contour::{LevelContour, LevelGeometry};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::HtmlElement;

#[wasm_bindgen]
pub fn panel_geometry(
    path: &str,
    from_width: f64,
    from_height: f64,
    width: f64,
    height: f64,
) -> Result<String, JsValue> {
    crate::panel_geometry::fit_path(path, [from_width, from_height], [width, height])
        .map_err(|error| JsValue::from_str(&error))
}

#[wasm_bindgen]
pub fn level_panel_geometry(
    root: &HtmlElement,
    width: f64,
    height: f64,
    level: &str,
) -> Result<(), JsValue> {
    let level = LevelContour::try_from(level).map_err(JsValue::from_str)?;
    let Some(geometry) = LevelGeometry::new(level, width, height) else {
        return Ok(());
    };
    let path = geometry.path();
    if let Some(card) = root.parent_element() {
        let outlines = card.query_selector_all("[data-level-contour]")?;
        for index in 0..outlines.length() {
            if let Some(outline) = outlines
                .item(index)
                .and_then(|node| node.dyn_into::<web_sys::Element>().ok())
            {
                outline.set_attribute("d", &path)?;
            }
        }
        if let Some(light) = card
            .parent_element()
            .and_then(|parent| {
                parent
                    .query_selector(":scope > [data-panel-scan-light]")
                    .ok()
                    .flatten()
            })
            .and_then(|element| element.dyn_into::<HtmlElement>().ok())
        {
            light
                .style()
                .set_property("clip-path", &format!("path('{path}')"))?;
        }
    }
    Ok(())
}
