//! Large immutable inputs (raster paintings, long motion tracks, reading curves)
//! are published beside the engine instead of inside it, so the engine itself
//! arrives in seconds and each scene waits only for its own inputs. Rust names
//! the files a scene needs and verifies every byte it receives; the page only
//! fetches them (`graphics/pkg/assets`). Native tests and tools read the same
//! files from `assets/`, the native runtime bundles them.

pub struct External {
    /// Path in `assets/`, as listed in `assets/external.txt`.
    pub name: &'static str,
    /// Content-addressed published file name.
    pub file: &'static str,
    pub bytes: usize,
    pub hash: u64,
}
include!(concat!(env!("OUT_DIR"), "/external_assets.rs"));

/// 64-bit FNV-1a, the same function build.rs used to name the files.
pub fn fnv(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf2_9ce4_8422_2325, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x0100_0000_01b3)
    })
}

fn entry(name: &str) -> &'static External {
    EXTERNAL
        .iter()
        .find(|asset| asset.name == name)
        .unwrap_or_else(|| panic!("{name} is not listed in assets/external.txt"))
}

thread_local! {
    static PROVIDED: std::cell::RefCell<std::collections::BTreeMap<&'static str, &'static [u8]>> =
        Default::default();
}

/// The exact bytes of a listed input, once it has arrived.
pub fn bytes(name: &str) -> Result<&'static [u8], String> {
    let asset = entry(name);
    if let Some(bytes) = PROVIDED.with(|provided| provided.borrow().get(asset.name).copied()) {
        return Ok(bytes);
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("assets")
            .join(asset.name);
        let bytes = std::fs::read(&path).map_err(|e| format!("{}: {e}", path.display()))?;
        accept(asset, bytes.into_boxed_slice())
    }
    #[cfg(target_arch = "wasm32")]
    Err(format!("Graphics input {} has not arrived", asset.file))
}

fn accept(asset: &'static External, bytes: Box<[u8]>) -> Result<&'static [u8], String> {
    if bytes.len() != asset.bytes || fnv(&bytes) != asset.hash {
        return Err(format!("{} does not belong to this engine", asset.file));
    }
    Ok(PROVIDED.with(|provided| {
        *provided
            .borrow_mut()
            .entry(asset.name)
            .or_insert_with(|| Box::leak(bytes))
    }))
}

/// Published files a scene of `kind` reads in `palette`. Scenes that use none
/// return an empty list; the page provides these before creating the scene.
pub fn scene_inputs(kind: &str, palette: crate::palette::Palette) -> Vec<&'static str> {
    let mut names: Vec<&str> = raster_inputs(kind, palette.is_light()).to_vec();
    names.extend(crate::tracks::external(kind));
    names.extend(crate::reading_curves::external(kind).into_iter().flatten());
    names.into_iter().map(|name| entry(name).file).collect()
}

/// Paintings of the raster scenes: Art's light (sand) versions in light themes.
pub fn raster_inputs(kind: &str, light: bool) -> &'static [&'static str] {
    match (kind, light) {
        ("gallery", false) => &["gallery-atlas.png"],
        ("gallery", true) => &["gallery-sand-atlas.png"],
        ("mirror", _) => &["mirror-atlas.png"],
        ("voice-presence", false) => &[
            "voice-presence.png",
            "voice-presence-environment.png",
            "voice-presence-person.png",
        ],
        ("voice-presence", true) => &[
            "voice-presence-sand.png",
            "voice-presence-sand-environment.png",
            "voice-presence-sand-person.png",
        ],
        ("grounding-hero", false) => &["grounding-hero.png"],
        ("grounding-hero", true) => &["grounding-hero-sand.png"],
        _ => &[],
    }
}

#[cfg(target_arch = "wasm32")]
mod web {
    use wasm_bindgen::prelude::*;
    /// Hands the engine one published input fetched by the page.
    #[wasm_bindgen]
    pub fn provide_asset(file: &str, bytes: Box<[u8]>) -> Result<(), JsValue> {
        let asset = super::EXTERNAL
            .iter()
            .find(|asset| asset.file == file)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown graphics input {file}")))?;
        super::accept(asset, bytes)
            .map(|_| ())
            .map_err(|e| JsValue::from_str(&e))
    }
    /// Published files a scene of `kind` reads in the palette with `code`.
    #[wasm_bindgen]
    pub fn scene_assets(kind: &str, code: u32) -> Vec<String> {
        super::scene_inputs(kind, crate::palette::Palette::from_code(code))
            .into_iter()
            .map(String::from)
            .collect()
    }
}

#[cfg(not(target_arch = "wasm32"))]
/// Copies every listed input to `folder` under its published name and removes
/// files of earlier engines, so the folder always matches this build.
pub fn publish(folder: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(folder)?;
    for entry in std::fs::read_dir(folder)? {
        let entry = entry?;
        let name = entry.file_name();
        if !EXTERNAL.iter().any(|asset| name == asset.file) {
            std::fs::remove_file(entry.path())?;
        }
    }
    for asset in EXTERNAL {
        let bytes = bytes(asset.name).map_err(std::io::Error::other)?;
        let target = folder.join(asset.file);
        if std::fs::read(&target).ok().as_deref() != Some(bytes) {
            std::fs::write(target, bytes)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_scene_input_is_listed_and_published_with_this_build() {
        let published = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../public/graphics/pkg/assets");
        for asset in EXTERNAL {
            let bytes = bytes(asset.name).unwrap();
            assert_eq!(
                std::fs::read(published.join(asset.file)).ok().as_deref(),
                Some(bytes),
                "{} is not published; run the publish_assets example",
                asset.file
            );
        }
        let files = std::fs::read_dir(&published).unwrap().count();
        assert_eq!(files, EXTERNAL.len(), "stale files in {}", published.display());
        for kind in ["gallery", "mirror", "voice-presence", "grounding-hero", "insight", "book", "dreamer"] {
            for code in 0..7 {
                assert!(!scene_inputs(kind, crate::palette::Palette::from_code(code)).is_empty());
            }
        }
    }
    #[test]
    fn foreign_bytes_are_rejected() {
        let asset = entry("mirror-atlas.png");
        assert!(accept(asset, vec![0; asset.bytes].into_boxed_slice()).is_err());
    }
}
