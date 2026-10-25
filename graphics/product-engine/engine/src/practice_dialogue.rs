//! Self-address in the shared Rust scene engine. Authored opaque silhouettes,
//! restrained breath/voice gestures and deterministic four-phrase timelines.
use crate::step_three::Update;
use std::fmt::Write;

mod typography {
    include!(concat!(env!("OUT_DIR"), "/spoken_glyphs.rs"));
}
pub const PERIOD: f64 = 32.;
pub const ROOM_SPEED: f64 = 1.55;
pub const ROOM_PERIOD: f64 = crate::spoken_thought::practice::PERIOD / ROOM_SPEED;
// The last phrase lands at 57.5 / ROOM_SPEED. One quiet second precedes the reply.
const HEARD_AT: f64 = 57.5 / ROOM_SPEED + 1.1;
fn heard(t: f64) -> f64 {
    smooth((t - HEARD_AT) / 1.35) * (1. - smooth((t - (ROOM_PERIOD - 2.8)) / 1.3))
}
const FATHER: [&[&str]; 4] = [
    &["Я ЛЮБЛЮ ТЕБЯ."],
    &["Я НИКОГДА НЕ ПОКИНУ ТЕБЯ."],
    &["ПРОСТИ МЕНЯ."],
    &["ВСЕ, ЧТО У МЕНЯ ЕСТЬ —", "ЭТО ТЫ."],
];
fn smooth(v: f64) -> f64 {
    let v = v.clamp(0., 1.);
    v * v * (3. - 2. * v)
}
fn time(seconds: f64, reduced: bool) -> f64 {
    if reduced || !seconds.is_finite() {
        25.
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    }
}
fn text_path(text: &str, cx: f64, y: f64, size: f64) -> String {
    let mut d = String::new();
    let advance = size * 0.715;
    let x = cx - text.chars().count() as f64 * advance / 2.;
    for (col, c) in text.chars().enumerate() {
        for &(command, p) in typography::glyph(c) {
            let (letter, count) = match command {
                1 => ('M', 1),
                2 => ('L', 1),
                3 => ('Q', 2),
                4 => ('C', 3),
                _ => ('Z', 0),
            };
            d.push(letter);
            for i in 0..count {
                let _ = write!(
                    d,
                    "{:.3} {:.3} ",
                    x + col as f64 * advance + p[i * 2] * size,
                    y - p[i * 2 + 1] * size
                );
            }
        }
    }
    d
}
fn captions(out: &mut String) {
    for (i, rows) in FATHER.into_iter().enumerate() {
        let _ = write!(
            out,
            r#"<g class="dialogue-words-{i}" opacity="0" aria-label="{}">"#,
            rows.join(" ")
        );
        for (j, row) in rows.iter().enumerate() {
            let d = text_path(row, 160., 19. + j as f64 * 13., 10.);
            let _ = write!(out, r#"<path d="{d}" fill="var(--book-ink)"/>"#);
        }
        out.push_str("</g>");
    }
}
fn room_svg() -> String {
    crate::spoken_thought::practice::svg().replace(
        "<g class=\"spoken-stage\">",
        "<g class=\"dialogue-stage\"></g><g class=\"spoken-stage\">",
    ).replace("</g><g class=\"spoken-content\">", r#"</g><defs><radialGradient id="practice-heard-light"><stop stop-color="var(--book-line)" stop-opacity=".95"/><stop offset=".22" stop-color="var(--book-ink)" stop-opacity=".5"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient></defs><g class="practice-heard" opacity="0" transform="translate(55.8 86)"><circle r="7" fill="url(#practice-heard-light)"/><circle r=".6" fill="var(--book-line)"/></g><g class="spoken-content">"#)
}

fn father_svg() -> String {
    let mut out = String::from(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><g class="dialogue-stage"><desc>Отец на одном колене говорит с младшим собой. Ребёнок слушает.</desc>"#,
    );
    out.push_str(&crate::family_artwork::svg());
    captions(&mut out);
    out.push_str("</g></svg>");
    crate::scene_edges::wrap_sized(&out, 320., 240., 10., 10.)
}
pub fn svg(kind: &str) -> String {
    if kind == "practice-room" {
        room_svg()
    } else {
        father_svg()
    }
}
pub fn frame(kind: &str, seconds: f64, reduced: bool) -> Vec<Update> {
    if kind == "practice-room" {
        let reduced = reduced || !seconds.is_finite();
        let mut out = crate::spoken_thought::practice::frame(seconds * ROOM_SPEED, reduced);
        let t = if reduced || !seconds.is_finite() {
            ROOM_PERIOD - 5.
        } else {
            seconds.max(0.).rem_euclid(ROOM_PERIOD)
        };
        out.push(Update {
            selector: ".practice-heard".into(),
            attribute: "opacity",
            value: if reduced {
                "1".into()
            } else {
                heard(t).to_string()
            },
        });
        out.push(Update {
            selector: ".dialogue-stage".into(),
            attribute: "data-cycle-time",
            value: format!("{t:.3}"),
        });
        return out;
    }
    let reduced = reduced || !seconds.is_finite();
    let t = time(seconds, reduced);
    let mut out = crate::family_artwork::frame(t, reduced);
    out.push(Update {
        selector: ".dialogue-stage".into(),
        attribute: "data-cycle-time",
        value: format!("{t:.3}"),
    });
    for (i, start) in crate::family_artwork::STARTS.iter().enumerate() {
        let age = t - start;
        let alpha = if reduced {
            if i == 3 {
                1.
            } else {
                0.
            }
        } else {
            smooth(age / 0.7) * (1. - smooth((age - 4.3) / 1.3))
        };
        out.push(Update {
            selector: format!(".dialogue-words-{i}"),
            attribute: "opacity",
            value: alpha.to_string(),
        });
        out.push(Update {
            selector: format!(".dialogue-words-{i}"),
            attribute: "transform",
            value: format!("translate(0 {:.3})", (1. - smooth(age / 1.2)) * 2.),
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    fn value(updates: &[Update], selector: &str, attribute: &str) -> String {
        updates
            .iter()
            .find(|u| u.selector == selector && u.attribute == attribute)
            .unwrap()
            .value
            .clone()
    }
    #[test]
    fn practice_uses_original_letter_thread_and_flight_choreography() {
        let original = crate::spoken_thought::svg();
        let original = roxmltree::Document::parse(&original).unwrap();
        let actual = svg("practice-room");
        let actual = roxmltree::Document::parse(&actual).unwrap();
        for node in original
            .descendants()
            .filter(|n| n.attribute("id").is_some())
        {
            let id = node.attribute("id").unwrap();
            let other = actual
                .descendants()
                .find(|n| n.attribute("id") == Some(id))
                .unwrap();
            assert_eq!(node.attribute("d"), other.attribute("d"), "{id}");
        }
        for (i, start) in [4., 18.5, 33., 47.5].iter().enumerate() {
            let original_i = i.min(2);
            for age in [0., 0.8, 2., 4., 5.4, 6.8, 9., 11.7] {
                let a = crate::spoken_thought::frame([4., 18.5, 33.][original_i] + age, false);
                let b = frame("practice-room", (start + age) / ROOM_SPEED, false);
                assert!(
                    (value(&a, ".spoken-thread", "data-progress")
                        .parse::<f64>()
                        .unwrap()
                        - value(&b, ".spoken-thread", "data-progress")
                            .parse::<f64>()
                            .unwrap())
                    .abs()
                        < 1e-12
                );
                assert!(
                    (value(&a, &format!(".spoken-phrase-{original_i}"), "data-distance")
                        .parse::<f64>()
                        .unwrap()
                        - value(&b, &format!(".spoken-phrase-{i}"), "data-distance")
                            .parse::<f64>()
                            .unwrap())
                    .abs()
                        < 1e-12
                );
                assert!(!b.iter().any(|u| u.selector.contains("dialogue-person")
                    || u.selector.contains("dialogue-words")));
            }
            let b = frame("practice-room", (start + 4.) / ROOM_SPEED, false);
            assert_eq!(
                value(&b, ".spoken-stage", "data-phrase"),
                crate::spoken_thought::practice::PHRASES[i]
            );
            assert_ne!(
                value(
                    &frame("practice-room", (start + 1.) / ROOM_SPEED, false),
                    &format!(".spoken-letter-{i}-0"),
                    "d"
                ),
                value(&b, &format!(".spoken-letter-{i}-0"), "d")
            );
        }
        assert_eq!(
            frame("practice-room", 0., false),
            frame("practice-room", ROOM_PERIOD, false)
        );
    }
    #[test]
    fn response_waits_until_all_words_land_and_a_quiet_pause_passes() {
        assert_eq!(heard(57.5 / ROOM_SPEED), 0.);
        assert_eq!(heard(HEARD_AT), 0.);
        assert!(heard(HEARD_AT + 1.4) > 0.99);
        assert_eq!(heard(ROOM_PERIOD - 0.1), 0.);
    }
    #[test]
    fn scene_targets_are_valid_and_reduced_motion_is_still() {
        for kind in ["practice-room", "practice-father"] {
            assert_eq!(frame(kind, 0., true), frame(kind, 100., true));
            assert_eq!(frame(kind, 0., true), frame(kind, f64::NAN, false));
            let source = svg(kind);
            let doc = roxmltree::Document::parse(&source).unwrap();
            for t in [0., 5., 9., 14., 22., 35., 49., 59., 68., 70.5] {
                for u in frame(kind, t, false) {
                    assert!(
                        doc.descendants()
                            .any(|n| n.attribute("class")
                                == Some(u.selector.trim_start_matches('.'))),
                        "{}",
                        u.selector
                    );
                    assert!(!u.value.contains("NaN") && !u.value.contains("inf"));
                }
            }
        }
    }
}
