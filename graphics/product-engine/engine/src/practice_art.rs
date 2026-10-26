//! Practice films 4–7: each a short story in the volumetric matrix space, told
//! in its own module. Reduced motion shows each film's still.
use crate::step_three::Update;

pub fn contains(kind: &str) -> bool {
    matches!(
        kind,
        "practice-trinity" | "practice-awareness" | "practice-listening" | "practice-thread"
    )
}
pub fn svg(kind: &str) -> Option<String> {
    Some(match kind {
        "practice-trinity" => crate::practice_trinity::svg(),
        "practice-awareness" => crate::practice_shadow::svg(),
        "practice-listening" => crate::practice_call::svg(),
        "practice-thread" => crate::practice_thread::svg(),
        _ => return None,
    })
}
/// Each film keeps its own length and closes its loop through darkness.
pub fn period(kind: &str) -> f64 {
    match kind {
        "practice-trinity" => crate::practice_trinity::PERIOD,
        "practice-awareness" => crate::practice_shadow::PERIOD,
        "practice-listening" => crate::practice_call::PERIOD,
        "practice-thread" => crate::practice_thread::PERIOD,
        _ => 0.,
    }
}
pub fn frame(kind: &str, seconds: f64, reduced: bool) -> Vec<Update> {
    match kind {
        "practice-trinity" => crate::practice_trinity::frame(seconds, reduced),
        "practice-awareness" => crate::practice_shadow::frame(seconds, reduced),
        "practice-listening" => crate::practice_call::frame(seconds, reduced),
        "practice-thread" => crate::practice_thread::frame(seconds, reduced),
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fmt::Write;
    const KINDS: [&str; 4] = ["practice-trinity", "practice-awareness", "practice-listening", "practice-thread"];
    /// Writes every film as frame updates for the scratch preview page:
    /// `PRACTICE_PREVIEW=<dir> cargo test dump_previews -- --ignored`.
    #[test]
    #[ignore]
    fn dump_previews() {
        let dir = std::env::var("PRACTICE_PREVIEW").expect("PRACTICE_PREVIEW");
        let quote = |s: &str| format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n"));
        let step = 0.1;
        let only = std::env::var("PRACTICE_KIND").ok();
        let mut js = String::from("window.SCENES={");
        for kind in KINDS.into_iter().filter(|k| only.as_deref().map_or(true, |o| o == *k)) {
            let period = period(kind);
            let mut sizes = Vec::new();
            let frames: Vec<String> = (0..(period / step).round() as usize)
                .map(|i| {
                    let updates = frame(kind, i as f64 * step, false);
                    sizes.push(updates.iter().map(|u| u.value.len()).sum::<usize>() as f64 / 1024.);
                    let updates: Vec<String> = updates
                        .iter()
                        .map(|u| format!("[{},{},{}]", quote(&u.selector), quote(u.attribute), quote(&u.value)))
                        .collect();
                    format!("[{}]", updates.join(","))
                })
                .collect();
            let worst = sizes.iter().cloned().fold(0., f64::max);
            let at = sizes.iter().position(|&s| s == worst).unwrap() as f64 * step;
            println!("{kind}: {:.1} KB/frame mean, {worst:.1} max at {at:.1}s", sizes.iter().sum::<f64>() / sizes.len() as f64);
            let _ = write!(
                js,
                "{}:{{svg:{},period:{period},step:{step},frames:[{}]}},",
                quote(kind),
                quote(&svg(kind).unwrap()),
                frames.join(",")
            );
        }
        js.push_str("};");
        std::fs::write(format!("{dir}/scenes.js"), js).unwrap();
    }
    #[test]
    fn scenes_parse_loop_and_target_existing_elements() {
        for kind in KINDS {
            let source = svg(kind).unwrap();
            let doc = roxmltree::Document::parse(&source).unwrap();
            assert_eq!(frame(kind, 0., true), frame(kind, 87., true));
            assert_eq!(frame(kind, 0., true), frame(kind, f64::NAN, false));
            assert_eq!(frame(kind, 0., false), frame(kind, period(kind), false));
            for i in 0..(period(kind) * 10.) as usize {
                for u in frame(kind, i as f64 * 0.1, false) {
                    let class = u.selector.trim_start_matches('.');
                    assert!(
                        doc.descendants().any(|n| n.attribute("class") == Some(class)),
                        "{kind} {class}"
                    );
                    assert!(!u.value.contains("NaN") && !u.value.contains("inf"), "{kind} {class}");
                }
            }
        }
    }
}
