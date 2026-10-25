//! Original approved seated scene and its practice copy share one animation.
pub const PERIOD: f64 = 56.;
pub use crate::spoken_copy::PHRASES;
const STARTS: [f64; 3] = [4., 18.5, 33.];
const PARKING: [(Point, f64, f64); 3] = [
    ((128., 49.), 0.82, -7.),
    ((94., 122.), 0.78, 5.),
    ((157., 88.), 0.80, -5.),
];
fn lines(phrase: usize) -> Vec<&'static str> {
    if phrase == 2 {
        vec!["Мне трудно", "об этом говорить"]
    } else {
        vec![PHRASES[phrase]]
    }
}
const DESCRIPTION: &str = "Три примера произнесённых мыслей: Я боюсь ошибиться; Я не знаю, с чего начать; Мне трудно об этом говорить. Слова отделяются от человека, пространство проясняется.";
include!("spoken_scene.rs");

pub mod practice {
    pub const PERIOD: f64 = 70.5;
    pub const PHRASES: [&str; 4] = [
        "Я РАЗРЕШАЮ СЕБЕ ГОВОРИТЬ ПРАВДУ.",
        "Я ЗВУЧУ.",
        "Я СЛЫШУ СВОЙ ГОЛОС.",
        "Я ЕСТЬ У СЕБЯ.",
    ];
    const STARTS: [f64; 4] = [4., 18.5, 33., 47.5];
    const PARKING: [(Point, f64, f64); 4] = [
        ((128., 49.), 0.82, -7.),
        ((94., 122.), 0.78, 5.),
        ((157., 88.), 0.80, -5.),
        ((150., 149.), 0.80, 5.),
    ];
    const DESCRIPTION: &str =
        "Я разрешаю себе говорить правду. Я звучу. Я слышу свой голос. Я есть у Себя.";
    fn lines(phrase: usize) -> Vec<&'static str> {
        if phrase == 0 {
            vec!["Я РАЗРЕШАЮ СЕБЕ", "ГОВОРИТЬ ПРАВДУ."]
        } else {
            vec![PHRASES[phrase]]
        }
    }
    include!("spoken_scene.rs");
}

#[cfg(test)]
mod tests {
    use super::*;
    fn value(updates: &[Update], sel: &str, attr: &str) -> String {
        updates
            .iter()
            .find(|u| u.selector == sel && u.attribute == attr)
            .unwrap()
            .value
            .clone()
    }
    #[test]
    fn three_distinct_utterances_leave_space_and_end_in_calm() {
        let mut last_clarity = 0.;
        for (p, start) in STARTS.iter().enumerate() {
            let speaking = frame(start + 4., false);
            assert_eq!(value(&speaking, ".spoken-stage", "data-phrase"), PHRASES[p]);
            assert_eq!(value(&speaking, ".spoken-stage", "data-phase"), "speaking");
            assert!(
                value(&speaking, ".spoken-thread", "opacity")
                    .parse::<f64>()
                    .unwrap()
                    > 0.
            );
            let separated = frame(start + 11.7, false);
            assert_eq!(
                value(&separated, &format!(".spoken-phrase-{p}"), "data-detach"),
                "1"
            );
            assert_eq!(value(&separated, ".spoken-thread", "d"), "M55 24");
            assert_eq!(value(&separated, ".spoken-thread-tail", "d"), "M98.9 36");
            let clarity = value(&separated, ".spoken-room", "data-clarity")
                .parse::<f64>()
                .unwrap();
            assert!(clarity > last_clarity);
            last_clarity = clarity;
        }
        for i in 0..=1120 {
            let s = state(i as f64 / 20., false);
            for p in 0..3 {
                assert_eq!(
                    phrase_alpha(s, p) > 0.,
                    age(s, p) >= 0.,
                    "Every already spoken thought stays in the room"
                );
            }
            for u in frame(i as f64 / 20., false) {
                assert!(!u.value.contains("NaN") && !u.value.contains("inf"));
                if u.attribute == "opacity" {
                    assert!((0. ..=1.).contains(&u.value.parse::<f64>().unwrap()));
                }
            }
        }
        for t in [45., 48., 51.9] {
            assert_eq!(phase(state(t, false)), "calm");
        }
        assert_eq!(state(54., false).alpha, 0.);
        assert_eq!(frame(0., false), frame(PERIOD, false));
    }
    #[test]
    fn accessible_still_and_every_word_have_real_font_outlines() {
        let f = frame(0., true);
        assert_eq!(f, frame(999., true));
        assert_eq!(f, frame(f64::NAN, false));
        assert_eq!(value(&f, ".spoken-stage", "data-phase"), "calm");
        assert_eq!(value(&f, ".spoken-stage", "data-phrase"), PHRASES[2]);
        for (p, start) in STARTS.iter().enumerate() {
            let glyphs = letters(p);
            for (i, (c, row, col)) in glyphs.iter().enumerate() {
                assert!(!typography::glyph(*c).is_empty(), "missing glyph {c}");
                assert_ne!(
                    glyph_path(*c, *row, *col, i, p, state(start + 1., false)),
                    glyph_path(*c, *row, *col, i, p, state(start + 10., false))
                );
                assert!(
                    TEXT_X + 26. + *col as f64 * ADVANCE + FONT_SIZE < 308.,
                    "phrase fits the scene"
                );
            }
        }
    }
    #[test]
    fn vector_room_and_every_animation_target_exist() {
        let s = svg();
        let doc = roxmltree::Document::parse(&s).unwrap();
        assert!(
            !s.contains("<image") && s.contains("spoken-room") && s.contains("data-rust-matrix-uv")
        );
        for t in [0., 8., 22., 37., 48., 54.] {
            for u in frame(t, false) {
                assert!(
                    doc.descendants()
                        .any(|n| n.attribute("class") == Some(u.selector.trim_start_matches('.'))),
                    "{}",
                    u.selector
                );
            }
        }
        assert_eq!(value(&frame(4., false), ".spoken-thread", "d"), "M55 24");
        assert!(value(&frame(8., false), ".spoken-thread", "d").contains("98.900 36.000"));
    }

    #[test]
    fn approved_geometry_is_exact_and_never_animated_as_paths() {
        let source =
            roxmltree::Document::parse(include_str!("../assets/spoken-thought-person.svg"))
                .unwrap();
        let scene = svg();
        let rendered = roxmltree::Document::parse(&scene).unwrap();
        let paths: Vec<_> = source
            .descendants()
            .filter(|n| n.has_tag_name("path"))
            .collect();
        assert_eq!(paths.len(), 9);
        for p in paths {
            let id = p.attribute("id").unwrap();
            let actual = rendered
                .descendants()
                .find(|n| n.attribute("id") == Some(id))
                .unwrap();
            assert_eq!(p.attribute("d"), actual.attribute("d"), "approved {id}");
        }
        for t in [0., 8., 14., 22., 30., 37., 48., 54., 55.] {
            for update in frame(t, false) {
                assert!(!update.selector.contains("person") && !update.selector.contains("chest"));
                assert!(!(update.selector == ".spoken-calm" && update.attribute == "d"));
            }
        }
        assert!(!frame(27.5, false)
            .iter()
            .any(|u| u.selector == ".spoken-stage" && u.attribute == "opacity"));
    }

    #[test]
    fn thread_grows_then_breaks_and_words_stay_nearby() {
        let start = thread_path(0., 0.);
        let partial = thread_path(0., 0.4);
        let end = thread_path(0., 1.);
        assert_eq!(start.1, (55., 24.));
        assert!(partial.1 .0 > 55. && partial.1 .0 < 69.);
        assert_eq!(end.1, (98.9, 36.));
        assert_ne!(partial.0, end.0);
        for (p, start) in STARTS.iter().enumerate() {
            let near = state(start + 4., false);
            let far = state(start + 10., false);
            assert_eq!(phrase_transform(near, p, false).1, 1.);
            assert!((phrase_transform(far, p, false).1 - PARKING[p].1).abs() < 1e-8);
            assert!(
                phrase_alpha(far, p) > 0.8,
                "Words remain visible after receding"
            );
            assert_eq!(
                phrase_transform(far, p, true).1,
                phrase_transform(far, p, false).1,
                "Accessible still preserves the full settled arrangement"
            );
            let middle = state(start + 7., false);
            assert!(
                phrase_transform(middle, p, false).1 > PARKING[p].1
                    && phrase_transform(middle, p, false).1 < 1.
            );
            let before = frame(start + SNAP_AT - 0.01, false);
            let broken = frame(start + SNAP_AT + 0.4, false);
            assert_eq!(value(&before, ".spoken-thread-tail", "d"), "M98.9 36");
            assert_eq!(
                value(&broken, ".spoken-stage", "data-thread-state"),
                "breaking"
            );
            assert_eq!(
                value(&before, ".spoken-thread", "opacity"),
                value(&broken, ".spoken-thread", "opacity")
            );
            assert!(
                value(&broken, ".spoken-thread", "data-gap")
                    .parse::<f64>()
                    .unwrap()
                    > 8.
            );
            assert!(value(&broken, ".spoken-thread-tail", "d").contains('C'));
        }
        for t in [15.5, 17., 18.] {
            assert!((state(t, false).calm - 1. / 3.).abs() < 1e-8);
        }
        for t in [30., 31., 32.] {
            assert!((state(t, false).calm - 2. / 3.).abs() < 1e-8);
        }
        assert_eq!(state(48., false).calm, 1.);
    }

    #[test]
    fn phrases_finish_early_and_accumulate_without_colliding() {
        for (p, start) in STARTS.iter().enumerate() {
            let full = frame(start + 2.7, false);
            let settled = frame(start + 11.7, false);
            for i in 0..letters(p).len() {
                assert_eq!(
                    value(&full, &format!(".spoken-letter-{p}-{i}"), "opacity"),
                    "1"
                );
                assert_eq!(
                    value(&full, &format!(".spoken-letter-{p}-{i}"), "d"),
                    value(&settled, &format!(".spoken-letter-{p}-{i}"), "d")
                );
            }
        }
        let settled = state(48., false);
        let boxes: Vec<_> = (0..3)
            .map(|p| {
                assert!(phrase_alpha(settled, p) >= 0.85);
                let (anchor, scale) = phrase_pose(settled, p);
                assert!(scale >= 0.78);
                let rows = lines(p);
                let width =
                    rows.iter().map(|s| s.chars().count()).max().unwrap() as f64 * ADVANCE * scale;
                (
                    anchor.0,
                    anchor.1 - FONT_SIZE * scale,
                    anchor.0 + width,
                    anchor.1 + (rows.len() - 1) as f64 * 14. * scale,
                )
            })
            .collect();
        for (i, a) in boxes.iter().enumerate() {
            assert!(a.0 >= 82. && a.2 < 300. && a.1 > 20. && a.3 < 165.);
            for b in boxes.iter().skip(i + 1) {
                assert!(
                    a.2 < b.0 || b.2 < a.0 || a.3 + 5. < b.1 || b.3 + 5. < a.1,
                    "Settled phrases overlap"
                );
            }
        }
    }
}
