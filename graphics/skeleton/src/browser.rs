//! Browser adapter: the page attaches a host element per loading surface and
//! reports when its content is ready; every frame this writes the computed
//! presence and scan position to the hosts' styles. The shapes inside a host
//! read `--skeleton-sweep` for their band of light.
use crate::{fraction, Field};
use wasm_bindgen::prelude::*;
use web_sys::HtmlElement;

struct Surface {
    id: u32,
    element: HtmlElement,
    /// Last values written, so an idle skeleton costs no style work.
    written: Option<(String, String)>,
}

#[wasm_bindgen]
pub struct SkeletonField {
    field: Field,
    surfaces: Vec<Surface>,
}

impl Default for SkeletonField {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl SkeletonField {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            field: Field::new(),
            surfaces: Vec::new(),
        }
    }

    pub fn attach(&mut self, element: HtmlElement, at: f64) -> u32 {
        let id = self.field.attach(at);
        self.surfaces.push(Surface {
            id,
            element,
            written: None,
        });
        self.write(at);
        id
    }

    pub fn settle(&mut self, id: u32, at: f64) {
        self.field.settle(id, at);
    }

    pub fn detach(&mut self, id: u32) {
        self.field.detach(id);
        self.surfaces.retain(|surface| surface.id != id);
    }

    pub fn reduced(&mut self, value: bool) {
        self.field.set_reduced(value);
    }

    pub fn gone(&self, id: u32, at: f64) -> bool {
        self.field.gone(id, at)
    }

    /// Writes this moment to every host; returns whether more frames follow.
    pub fn frame(&mut self, at: f64) -> bool {
        self.write(at);
        self.field.moving(at)
    }
}

impl SkeletonField {
    fn write(&mut self, at: f64) {
        for surface in &mut self.surfaces {
            let Some(look) = self.field.look(surface.id, at) else {
                continue;
            };
            let values = (fraction(look.presence, 3), fraction(look.sweep, 4));
            if surface.written.as_ref() == Some(&values) {
                continue;
            }
            let style = surface.element.style();
            // A hidden skeleton is not painted at all.
            let visibility = if look.presence > 0.0 {
                "visible"
            } else {
                "hidden"
            };
            let _ = style.set_property("visibility", visibility);
            let _ = style.set_property("opacity", &values.0);
            let _ = style.set_property("--skeleton-sweep", &values.1);
            surface.written = Some(values);
        }
    }
}
