//! Authored task scenes and their continuous, visibility-owned clocks.
//! Geometry and motion stay in Rust for both web and the native document.
use std::fmt::Write;

pub const KINDS: [&str; 5] = [
    "hero-discernment",
    "life-book",
    "body-breath",
    "body-senses",
    "author-intention",
];
#[derive(Debug, Clone, Copy)]
enum Scene {
    Discernment,
    Book,
    Breath,
    One,
    Author,
}
impl Scene {
    fn parse(kind: &str) -> Option<Self> {
        Some(match kind {
            "hero-discernment" => Self::Discernment,
            "life-book" => Self::Book,
            "body-breath" => Self::Breath,
            "body-senses" => Self::One,
            "author-intention" => Self::Author,
            _ => return None,
        })
    }
}
pub fn contains(kind: &str) -> bool {
    Scene::parse(kind).is_some()
}

fn person(x: f64, y: f64, scale: f64) -> String {
    format!(r##"<g transform="translate({x} {y}) scale({scale})"><use href="#task-person"/></g>"##)
}
fn standing(x: f64, floor: f64, scale: f64) -> String {
    // Authored outline: max y = 1482.88155, then scale .054 + translate 2.9.
    person(x, floor - 82.975604 * scale, scale)
}
fn book() -> &'static str {
    include_str!("../assets/task-open-book.svg")
}
fn city(out: &mut String) {
    out.push_str(include_str!("../assets/task-city.svg"));
}
fn forest(out: &mut String) {
    out.push_str(include_str!("../assets/task-forest.svg"));
}
pub fn svg(kind: &str) -> Option<String> {
    let scene = Scene::parse(kind)?;
    // Trim unused scene margins so the illustration fills the text column.
    let view_box = match scene {
        Scene::Discernment => "24 16 240 164",
        Scene::Book => "8 0 272 210",
        _ => "0 0 288 210",
    };
    let mut out = format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" fill="none"><defs>"##
    );
    out.push_str(include_str!("../assets/task-person.svg"));
    out.push_str(r##"<g id="task-person"><g transform="translate(-27.65 2.9) scale(0.054)"><use href="#task-person-shape" fill="var(--book-cover)" stroke="var(--book-ink)" stroke-width="7.5" stroke-linejoin="round"/><use href="#task-person-lines" fill="var(--book-ink)"/></g></g>
      <radialGradient id="task-light"><stop stop-color="var(--book-light)" stop-opacity="0.7"/><stop offset="0.25" stop-color="var(--book-ink)" stop-opacity="0.22"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
      <radialGradient id="task-ground"><stop stop-color="var(--book-ink)" stop-opacity="0.17"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
      <clipPath id="task-stage"><path d="M19 15H269V143H19Z"/></clipPath>
      </defs>"##);
    match scene {
        Scene::Discernment => {
            out.push_str(r##"<path d="M35 26H118V179H35Z M170 26H253V179H170Z" fill="var(--book-cover)" stroke="var(--book-dim)" stroke-width="0.4"/>
              <path d="M39 30H114V175H39Z M174 30H249V175H174Z" stroke="var(--book-line)" stroke-width="0.25"/>
              <path d="M35 43V26H52M101 26H118V43M170 162V179H187M236 179H253V162" stroke="var(--book-ink)" stroke-width="0.55"/>
              <path d="M42 169H111M177 169H246" stroke="var(--book-dim)" stroke-width="0.4"/>
              <ellipse cx="77" cy="168" rx="21" ry="3" fill="url(#task-ground)"/><ellipse cx="211" cy="168" rx="21" ry="3" fill="url(#task-ground)"/>"##);
            out.push_str(&standing(77., 168., 1.6));
            out.push_str(&standing(211., 168., 1.6));
            out.push_str(r##"<defs><clipPath id="task-head-clip"><rect x="66" y="42" width="22" height="21" rx="8"/></clipPath>
              <linearGradient id="task-scan-fill" x2="0" y2="1"><stop stop-color="var(--book-ink)" stop-opacity="0"/><stop offset="1" stop-color="var(--book-bright)" stop-opacity="0.28"/></linearGradient></defs>
              <g clip-path="url(#task-head-clip)"><g class="task-head-scan"><path d="M61-11H93V0H61Z" fill="url(#task-scan-fill)"/><path d="M61 0H93" stroke="var(--book-bright)" stroke-width="0.65"/></g></g>
              <g class="task-scan-ring"><ellipse cx="77" rx="10" ry="2.3" stroke="var(--book-line)" stroke-width="0.4"/><path d="M67 0Q77 4.6 87 0" stroke="var(--book-bright)" stroke-width="0.65"/></g>
              <path d="M87 52Q144 30 201 52" stroke="var(--book-dim)" stroke-width="0.35" stroke-dasharray="1 4"/>
              <path class="task-flow" d="M87 52Q144 30 201 52" stroke="var(--book-line)" stroke-width="0.6" stroke-dasharray="4 122"/>"##);
        }
        Scene::Book => {
            out.push_str(include_str!("../assets/task-book-people.svg"));
            out.push_str(r##"<g clip-path="url(#task-stage)">"##);
            city(&mut out);
            forest(&mut out);
            out.push_str(include_str!("../assets/task-train.svg"));
            out.push_str(r##"</g>"##);
            out.push_str(book());
            out.push_str(r##"<path class="task-leaf" d="M144 163Q181 118 233 124L239 149Q187 145 144 185Z" fill="var(--book-paper)" stroke="var(--book-bright)" stroke-width="0.55"/>
              <path d="M35 189Q87 177 144 196Q204 177 258 189" stroke="var(--book-dim)" stroke-width="0.4"/>"##);
        }
        Scene::Breath => out.push_str(include_str!("../assets/task-body-presence.svg")),
        Scene::One => out.push_str(include_str!("../assets/task-one-source.svg")),
        Scene::Author => {
            out.push_str(r##"<defs><clipPath id="task-author-stage"><path d="M16 12H272V154H16Z"/></clipPath></defs><g clip-path="url(#task-author-stage)"><g class="task-author-camera">"##);
            out.push_str(include_str!("../assets/task-author-world.svg"));
            out.push_str(r##"<path class="task-written-path" d="M45 142" stroke="var(--book-bright)" stroke-width="0.7" stroke-linecap="round"/></g></g>"##);
            out.push_str(book());
            out.push_str(include_str!("../assets/task-writing-hand.svg"));
        }
    }
    out.push_str("</svg>");
    Some(out)
}

#[derive(Debug, Clone, PartialEq)]
pub struct Update {
    pub selector: String,
    pub attribute: &'static str,
    pub value: String,
}
fn set(
    out: &mut Vec<Update>,
    selector: impl Into<String>,
    attribute: &'static str,
    value: impl ToString,
) {
    out.push(Update {
        selector: selector.into(),
        attribute,
        value: value.to_string(),
    });
}
fn smooth(t: f64) -> f64 {
    let x = t.clamp(0., 1.);
    x * x * (3. - 2. * x)
}
fn cubic(p: [f64; 4], t: f64) -> f64 {
    let u = 1. - t;
    u * u * u * p[0] + 3. * u * u * t * p[1] + 3. * u * t * t * p[2] + t * t * t * p[3]
}
/// Pure animation core. DOM/GPU adapters apply these attributes without a JS timeline.
pub fn frame(kind: &str, seconds: f64, reduced: bool) -> Vec<Update> {
    let Some(scene) = Scene::parse(kind) else {
        return Vec::new();
    };
    let t = if reduced || !seconds.is_finite() {
        0.
    } else {
        seconds.max(0.)
    };
    let breath = if reduced {
        0.5
    } else {
        0.5 - 0.5 * (t * std::f64::consts::TAU / 6.).cos()
    };
    let mut out = Vec::with_capacity(20);
    set(&mut out, ".task-flow", "stroke-dashoffset", -t * 13.);
    match scene {
        Scene::Discernment => {
            let y = if reduced {
                52.
            } else {
                43. + (0.5 - (t * std::f64::consts::TAU / 5.).cos() * 0.5) * 19.
            };
            set(
                &mut out,
                ".task-head-scan",
                "transform",
                format!("translate(0 {y:.3})"),
            );
            set(
                &mut out,
                ".task-scan-ring",
                "transform",
                format!("translate(0 {y:.3})"),
            );
        }
        Scene::Book => {
            let cycle = t.rem_euclid(27.) / 9.;
            for (i, name) in ["city", "forest", "train"].iter().enumerate() {
                let local = (cycle - i as f64).rem_euclid(3.);
                let weight = if reduced {
                    if i == 0 {
                        1.
                    } else {
                        0.
                    }
                } else if local < 0.85 {
                    1.
                } else if local < 1. {
                    1. - smooth((local - 0.85) / 0.15)
                } else if local > 2.85 {
                    smooth((local - 2.85) / 0.15)
                } else {
                    0.
                };
                set(&mut out, format!(".task-{name}"), "opacity", weight);
                let pan = if reduced {
                    0.
                } else {
                    (if local > 2.85 { local - 3. } else { local }) * 1.5
                };
                set(
                    &mut out,
                    format!(".task-{name}"),
                    "transform",
                    format!("translate({pan:.3} 0)"),
                );
            }
            set(
                &mut out,
                ".task-train-landscape",
                "transform",
                format!(
                    "translate({:.3} 0)",
                    if reduced {
                        0.
                    } else {
                        // One continuous landscape crosses the window through the train scene.
                        // Reset only when the train is hidden by the next chapter.
                        -t.rem_euclid(27.) * 3.2
                    }
                ),
            );
            let gesture = if reduced { 0. } else { (t * 1.3).sin() };
            set(
                &mut out,
                ".task-city-gesture",
                "transform",
                format!("rotate({:.3} 143 81)", gesture * 6.),
            );
            set(
                &mut out,
                ".task-city-far-leg",
                "transform",
                format!("rotate({:.3} 132 113)", gesture * 0.5),
            );
            set(
                &mut out,
                ".task-city-near-leg",
                "transform",
                format!("rotate({:.3} 139 113)", -gesture * 0.5),
            );
            set(
                &mut out,
                ".task-forest-reach",
                "transform",
                format!("rotate({:.3} 143 100)", (1. + gesture) * -2.),
            );
            let turn = if reduced {
                0.
            } else {
                smooth((t.rem_euclid(9.) - 7.7) / 1.3)
            };
            set(
                &mut out,
                ".task-leaf",
                "transform",
                format!(
                    "translate(144 0) scale({:0.4} 1) translate(-144 0)",
                    (turn * std::f64::consts::PI).cos()
                ),
            );
            set(
                &mut out,
                ".task-leaf",
                "opacity",
                if reduced {
                    0.
                } else {
                    (std::f64::consts::PI * turn).sin() * 0.9
                },
            );
        }
        Scene::Breath => {
            set(
                &mut out,
                ".task-breath-contour",
                "transform",
                format!(
                    "translate(144 114) scale({:.4} {:.4})",
                    0.96 + breath * 0.16,
                    0.98 + breath * 0.08
                ),
            );
            set(
                &mut out,
                ".task-breath-contour",
                "opacity",
                0.2 + breath * 0.65,
            );
            set(&mut out, ".task-air", "opacity", 0.3 + breath * 0.5);
        }
        Scene::One => {
            let phase = if reduced {
                0.45
            } else {
                t.rem_euclid(12.) / 12.
            };
            let x = 169. - phase * 24. + (phase * std::f64::consts::TAU * 2.).sin() * 8.;
            let y = 37. + smooth(phase) * 106.;
            set(
                &mut out,
                ".task-falling-leaf",
                "transform",
                format!(
                    "translate({x:.3} {y:.3}) rotate({:.3})",
                    (phase * 360.).sin() * 40.
                ),
            );
            set(
                &mut out,
                ".task-falling-leaf",
                "opacity",
                if reduced {
                    0.8
                } else {
                    smooth(phase * 10.) * (1. - smooth((phase - 0.9) * 10.))
                },
            );
            set(
                &mut out,
                ".task-reflection",
                "transform",
                format!(
                    "translate({:.3} 249) scale(1 -0.8)",
                    if reduced { 0. } else { (t * 0.9).sin() * 1.2 }
                ),
            );
            for i in 0..3 {
                let wave = if reduced {
                    0.22 + i as f64 * 0.26
                } else {
                    (t / 6. + i as f64 / 3.).fract()
                };
                set(&mut out, format!(".task-water-{i}"), "rx", 10. + wave * 90.);
                set(&mut out, format!(".task-water-{i}"), "ry", 1. + wave * 12.);
                set(
                    &mut out,
                    format!(".task-water-{i}"),
                    "cy",
                    141. + wave * 21.,
                );
                set(
                    &mut out,
                    format!(".task-water-{i}"),
                    "opacity",
                    (1. - wave) * 0.6,
                );
            }
        }
        Scene::Author => {
            let cycle = t.rem_euclid(34.);
            let progress = if reduced {
                1.
            } else if cycle < 8. {
                0.25 * smooth(cycle / 6.)
            } else if cycle < 17. {
                0.25 + 0.35 * smooth((cycle - 8.) / 6.)
            } else {
                0.6 + 0.4 * smooth((cycle - 17.) / 8.)
            };
            let fade = if reduced {
                1.
            } else {
                1. - smooth((cycle - 31.) / 3.)
            };
            let (x, y) = written_point(progress);
            let pan = (x - 144.).clamp(0., 576.);
            set(
                &mut out,
                ".task-author-camera",
                "transform",
                format!("translate({:.3} 0)", -pan),
            );
            let mut path = String::from("M45 142");
            for i in 1..=144 {
                let u = (i as f64 / 144.).min(progress);
                let (px, py) = written_point(u);
                let _ = write!(path, "L{px:.3} {py:.3}");
                if u >= progress {
                    break;
                }
            }
            set(&mut out, ".task-written-path", "d", path);
            set(&mut out, ".task-written-path", "opacity", fade);
            set(&mut out, ".task-written-world", "opacity", fade);
            for (name, begin, span) in [
                ("castle", 0., 0.16),
                ("bridge", 0.28, 0.2),
                ("mirror", 0.66, 0.24),
            ] {
                set(
                    &mut out,
                    format!(".task-author-{name}"),
                    "opacity",
                    smooth((progress - begin) / span),
                );
            }
            set(
                &mut out,
                ".task-writing-hand",
                "transform",
                format!("translate({:0.3} {y:0.3}) scale(0.7)", x - pan),
            );
            set(
                &mut out,
                ".task-writing-hand",
                "opacity",
                if reduced {
                    0.
                } else {
                    (1. - smooth((cycle - 24.) / 2.)) * smooth(cycle / 0.6) * fade
                },
            );
        }
    }
    out
}

fn written_point(progress: f64) -> (f64, f64) {
    if progress < 0.25 {
        let u = progress / 0.25;
        (
            cubic([45., 70., 96., 134.], u),
            cubic([142., 150., 150., 135.], u),
        )
    } else if progress < 0.6 {
        let u = (progress - 0.25) / 0.35;
        (
            cubic([134., 224., 331., 432.], u),
            cubic([135., 148., 149., 138.], u),
        )
    } else {
        let u = (progress - 0.6) / 0.4;
        (
            cubic([432., 526., 634., 720.], u),
            cubic([138., 148., 149., 142.], u),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scenes_parse_and_all_animation_targets_exist() {
        for kind in KINDS {
            let svg = svg(kind).unwrap();
            let doc = roxmltree::Document::parse(&svg).unwrap();
            let expected_box = match kind {
                "hero-discernment" => "24 16 240 164",
                "life-book" => "8 0 272 210",
                _ => "0 0 288 210",
            };
            assert_eq!(doc.root_element().attribute("viewBox"), Some(expected_box));
            assert!(!svg.contains("<script") && !svg.contains("<animate"));
            for update in frame(kind, 7.2, false) {
                let class = update.selector.trim_start_matches('.');
                // A shared flow target may be absent in a scene without particles.
                if class == "task-flow" {
                    continue;
                }
                assert!(
                    doc.descendants().any(|n| n
                        .attribute("class")
                        .is_some_and(|c| c.split_whitespace().any(|c| c == class))),
                    "{kind}: {class}"
                );
            }
        }
        assert!(svg("unknown").is_none());
    }
    #[test]
    fn continuous_frames_are_finite_and_reduced_motion_is_static() {
        for kind in KINDS {
            for i in 0..1200 {
                for u in frame(kind, i as f64 * 0.041, false) {
                    assert!(!u.value.contains("NaN") && !u.value.contains("inf"));
                }
            }
            assert_eq!(frame(kind, 0., true), frame(kind, 913., true));
            assert_eq!(frame(kind, f64::NAN, false), frame(kind, 0., false));
        }
    }
    #[test]
    fn distinct_narratives_do_not_reuse_a_floating_person() {
        for kind in ["body-breath", "body-senses", "author-intention"] {
            let svg = svg(kind).unwrap();
            assert!(!svg.contains("href=\"#task-person\""));
        }
        let first = svg("hero-discernment").unwrap();
        assert!(first.contains("task-head-scan"));
        assert!(!first.contains("task-forehead"));
        assert!(!first.contains("M134 151"));
        let book = svg("life-book").unwrap();
        assert!(!book.contains("href=\"#task-person\""));
        for name in ["task-city", "task-forest", "task-train"] {
            assert!(book.contains(name));
        }
        assert_ne!(frame("life-book", 2., false), frame("life-book", 9., false));
    }

    #[test]
    fn author_camera_visits_each_story_stop_and_path_stays_connected() {
        let camera = |t| {
            frame("author-intention", t, false)
                .into_iter()
                .find(|u| u.selector == ".task-author-camera")
                .unwrap()
                .value
        };
        assert_eq!(camera(6.), "translate(-0.000 0)");
        assert_eq!(camera(14.), "translate(-288.000 0)");
        assert_eq!(camera(26.), "translate(-576.000 0)");
        assert_eq!(camera(30.), camera(26.));
        for join in [0.25, 0.6] {
            let a = written_point(join - 1e-7);
            let b = written_point(join + 1e-7);
            assert!((a.0 - b.0).abs() < 0.001 && (a.1 - b.1).abs() < 0.001);
        }
        let reduced = frame("author-intention", 0., true);
        assert!(reduced
            .iter()
            .any(|u| u.selector == ".task-author-mirror" && u.value == "1"));
        assert!(reduced
            .iter()
            .any(|u| u.selector == ".task-writing-hand" && u.value == "0"));
    }
}
