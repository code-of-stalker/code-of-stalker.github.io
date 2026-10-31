//! Quiet visual companions to self-paced practice. Geometry and time remain
//! independent of input adapters; reduced motion presents a resolved still.
use crate::step_three::Update;
pub fn contains(kind: &str) -> bool {
    matches!(kind, "home-shade" | "practice-room") || crate::practice_art::contains(kind)
}
pub fn svg(kind: &str) -> Option<String> {
    if kind == "practice-room" {
        return Some(crate::practice_dialogue::svg());
    }
    if crate::practice_art::contains(kind) {
        return crate::practice_art::svg(kind);
    }
    if kind == "home-shade" {
        return Some(r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" preserveAspectRatio="none"><defs><linearGradient id="home-copy-y" x2="0" y2="1"><stop stop-color="var(--book-cover)" stop-opacity="0"/><stop offset=".32" stop-color="var(--book-cover)" stop-opacity=".5"/><stop offset=".78" stop-color="var(--book-cover)" stop-opacity=".96"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity=".98"/></linearGradient></defs><rect width="320" height="160" fill="url(#home-copy-y)"/></svg>"##.into());
    }
    None
}
pub fn frame(kind: &str, seconds: f64, reduced: bool) -> Vec<Update> {
    if kind == "practice-room" {
        return crate::practice_dialogue::frame(seconds, reduced);
    }
    if crate::practice_art::contains(kind) {
        return crate::practice_art::frame(kind, seconds, reduced);
    }
    // The home shade is a still.
    Vec::new()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scenes_parse_and_reduced_motion_is_stable() {
        let source = svg("home-shade").unwrap();
        roxmltree::Document::parse(&source).unwrap();
        assert!(frame("home-shade", 3., false).is_empty() && frame("home-shade", 3., true).is_empty());
        for kind in ["practice-trinity", "practice-awareness", "practice-listening", "practice-thread"] {
            assert!(contains(kind) && svg(kind).is_some() && !frame(kind, 3., false).is_empty());
        }
    }
}
