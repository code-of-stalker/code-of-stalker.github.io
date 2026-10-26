pub mod atlas;
pub mod clock;
pub mod contour;
pub mod cover_motion;
pub mod decoder;
pub mod gesture;
pub mod inertial_progress;
pub mod insight_motion;
pub mod level_contour;
pub mod mesh_cache;
pub mod motion;
pub mod motion_kernel;
pub mod paint_order;
pub mod palette;
pub mod panel_geometry;
pub mod quality;
#[cfg(test)]
mod raster_asset_tests;
pub mod reading_curves;
pub mod reading_focus;
pub mod reading_layout;
#[cfg(target_arch = "wasm32")]
mod renderer;
pub mod scan_profile;
pub mod scene_model;
pub mod scene_edges;
pub mod step_three;
pub mod grounding;
pub mod grounding_hero;
pub mod breath_axis;
pub mod voice_unseal;
pub mod voice_witness;
pub mod voice_practice;
pub mod practice_art;
mod practice_call;
mod practice_shadow;
mod practice_stage;
mod practice_father;
mod practice_thread;
mod practice_trinity;
pub mod practice_dialogue;
pub mod family_artwork;
pub mod family_space;
pub mod breath_heroine;
mod spoken_copy;
pub mod spoken_thought;
pub mod spoken_room;
pub mod jugular_notch;
pub mod thought_terminal;
pub mod step_two_tasks;
pub mod svg_reference;
pub mod timeline;
pub mod tracks;
pub mod uploads;
pub mod vector_geometry;
pub mod voice;
pub mod voice_presence;
#[cfg(target_arch = "wasm32")]
pub use renderer::*;
#[cfg(target_arch = "wasm32")]
mod svg_motion;
#[cfg(target_arch = "wasm32")]
pub use svg_motion::*;
#[cfg(target_arch = "wasm32")]
mod element_motion;
#[cfg(target_arch = "wasm32")]
mod text_motion;
#[cfg(target_arch = "wasm32")]
pub use element_motion::*;
#[cfg(target_arch = "wasm32")]
pub use text_motion::*;
#[cfg(target_arch = "wasm32")]
mod panel_reveal;
#[cfg(target_arch = "wasm32")]
pub use panel_reveal::*;
#[cfg(target_arch = "wasm32")]
mod level_panel;
#[cfg(target_arch = "wasm32")]
pub use level_panel::*;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn graphics_diagnostics() {
    std::panic::set_hook(Box::new(|problem| {
        web_sys::console::error_1(&format!("Rust graphics panic: {problem}").into());
    }));
}
