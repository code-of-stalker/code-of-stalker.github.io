//! Quiet visual companions to self-paced practice. Geometry and time remain
//! independent of input adapters; reduced motion presents a resolved still.
use crate::step_three::Update;
use std::fmt::Write;
type P = (f64, f64);
const ROUTE: [P; 10] = [
    (-84., 84.),
    (-84., 20.),
    (-36., 20.),
    (-36., 60.),
    (20., 60.),
    (20., -20.),
    (-16., -20.),
    (-16., -68.),
    (68., -68.),
    (68., -110.),
];
/// Thoughts of the mental prison, dissolved when the thread passes them.
const THOUGHTS: [(&str, f64); 3] = [("МЫСЛЬ", 0.2), ("ВИНА", 0.47), ("БОЛЬ", 0.74)];
pub fn contains(kind: &str) -> bool {
    matches!(
        kind,
        "practice-thread" | "home-shade" | "practice-room" | "practice-father"
    ) || crate::practice_art::contains(kind)
}
fn clock(seconds: f64, reduced: bool) -> f64 {
    if reduced || !seconds.is_finite() {
        11.5
    } else {
        seconds.max(0.).rem_euclid(16.)
    }
}
fn smooth(x: f64) -> f64 {
    let x = x.clamp(0., 1.);
    x * x * (3. - 2. * x)
}
fn project((x, y): P) -> P {
    (160. + (x - y) * 0.68, 97. + (x + y) * 0.32)
}
fn poly(points: &[P]) -> String {
    let mut d = String::new();
    for (i, p) in points.iter().enumerate() {
        let _ = write!(d, "{}{:.3} {:.3}", if i == 0 { 'M' } else { 'L' }, p.0, p.1);
    }
    d
}
/// The part of the route between two fractions of its length.
fn span(from: f64, to: f64) -> (String, P) {
    let length: f64 = ROUTE
        .windows(2)
        .map(|p| (p[1].0 - p[0].0).hypot(p[1].1 - p[0].1))
        .sum();
    let (from, to) = (length * from.clamp(0., 1.), length * to.clamp(0., 1.));
    let mut walked = 0.;
    let mut points = Vec::new();
    for segment in ROUTE.windows(2) {
        let (a, b) = (segment[0], segment[1]);
        let span = (b.0 - a.0).hypot(b.1 - a.1);
        let at = |d: f64| {
            let u = ((d - walked) / span).clamp(0., 1.);
            project((a.0 + (b.0 - a.0) * u, a.1 + (b.1 - a.1) * u))
        };
        if points.is_empty() && from <= walked + span {
            points.push(at(from));
        }
        if !points.is_empty() {
            points.push(at(to));
        }
        walked += span;
        if to <= walked {
            break;
        }
    }
    (poly(&points), *points.last().unwrap())
}
fn thread(progress: f64) -> (String, P) {
    span(0., progress)
}
fn wall(out: &mut String, a: P, b: P) {
    let (a, b) = (project(a), project(b));
    let d = poly(&[a, b, (b.0, b.1 - 9.), (a.0, a.1 - 9.), a]);
    let _ = write!(
        out,
        r#"<path d="{d}" fill="var(--book-cover)" stroke="var(--book-line)" stroke-width=".45" opacity=".8"/><path d="M{} {}L{} {}" stroke="var(--book-ink)" stroke-width=".6" opacity=".6"/>"#,
        a.0,
        a.1 - 9.,
        b.0,
        b.1 - 9.
    );
}
pub fn svg(kind: &str) -> Option<String> {
    if matches!(kind, "practice-room" | "practice-father") {
        return Some(crate::practice_dialogue::svg(kind));
    }
    if crate::practice_art::contains(kind) {
        return crate::practice_art::svg(kind);
    }
    if !contains(kind) {
        return None;
    }
    if kind == "home-shade" {
        return Some(r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" preserveAspectRatio="none"><defs><linearGradient id="home-copy-y" x2="0" y2="1"><stop stop-color="var(--book-cover)" stop-opacity="0"/><stop offset=".32" stop-color="var(--book-cover)" stop-opacity=".5"/><stop offset=".78" stop-color="var(--book-cover)" stop-opacity=".96"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity=".98"/></linearGradient><linearGradient id="home-copy-x"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".07" stop-color="#fff"/><stop offset=".83" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="home-copy-mask" style="mask-type:alpha"><rect width="320" height="160" fill="url(#home-copy-x)"/></mask></defs><rect width="320" height="160" fill="url(#home-copy-y)" mask="url(#home-copy-mask)"/></svg>"##.into());
    }
    let mut out = String::from(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 192" fill="none"><desc>Голос как нить Ариадны выводит из лабиринта мыслей к Свету.</desc><defs><radialGradient id="p-halo"><stop stop-color="var(--book-line)" stop-opacity=".22"/><stop offset="1" stop-color="var(--book-line)" stop-opacity="0"/></radialGradient><radialGradient id="p-light"><stop stop-color="var(--book-line)" stop-opacity=".85"/><stop offset=".3" stop-color="var(--book-ink)" stop-opacity=".35"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient></defs><g stroke-linecap="round" stroke-linejoin="round"><path d="M24 22H296V151H24Z" data-rust-matrix-uv=".00368 0 -.088 0 .00775 -.171 0 0 1" fill="none" stroke="none" opacity=".06"/><ellipse cx="160" cy="162" rx="117" ry="14" fill="url(#p-halo)"/>"#,
    );
    let floor = poly(&[
        project((-103., -103.)),
        project((103., -103.)),
        project((103., 103.)),
        project((-103., 103.)),
        project((-103., -103.)),
    ]);
    let _ = write!(
        out,
        r#"<path d="{floor}" fill="var(--book-cover)" stroke="var(--book-dim)" stroke-width=".4"/>"#
    );
    for i in -5..=5 {
        let a = i as f64 * 20.;
        for pair in [[(a, -100.), (a, 100.)], [(-100., a), (100., a)]] {
            let d = poly(&pair.map(project));
            let _ = write!(
                out,
                r#"<path d="{d}" stroke="var(--book-dim)" stroke-width=".25" opacity=".35"/>"#
            );
        }
    }
    for i in 0..3 {
        let _ = write!(
            out,
            r#"<path class="p-scan-{i}" d="M0 0" stroke="var(--book-ink)" stroke-width=".5" opacity="0"/>"#
        );
    }
    for (a, b) in [
        ((-100., -100.), (60., -100.)),
        ((76., -100.), (100., -100.)),
        ((100., -100.), (100., 100.)),
        ((-100., -100.), (-100., 100.)),
        ((-100., 100.), (100., 100.)),
        ((-90., 0.), (-4., 0.)),
        ((-64., 40.), (-64., 84.)),
        ((-64., 84.), (0., 84.)),
        ((44., -48.), (44., 80.)),
        ((-64., -44.), (-24., -44.)),
        ((-8., -44.), (44., -44.)),
        ((-44., -80.), (40., -80.)),
        ((76., -48.), (76., 60.)),
    ] {
        wall(&mut out, a, b);
    }
    let (x, y) = project((68., -100.));
    let _ = write!(
        out,
        r#"<g class="p-exit" opacity=".35"><ellipse cx="{x}" cy="{}" rx="30" ry="34" fill="url(#p-light)"/></g><g class="p-rays" opacity="0" stroke="var(--book-line)" stroke-width=".5">"#,
        y - 18.
    );
    for i in 0..7 {
        let a = -std::f64::consts::PI * (0.2 + 0.1 * i as f64);
        let (r0, r1) = (21., if i % 2 == 0 { 40. } else { 31. });
        let _ = write!(
            out,
            r#"<path d="M{:.3} {:.3}L{:.3} {:.3}"/>"#,
            x + r0 * a.cos(),
            y - 18. + r0 * a.sin(),
            x + r1 * a.cos(),
            y - 18. + r1 * a.sin()
        );
    }
    let _ = write!(
        out,
        r#"</g><path d="M{} {}v-34h14v34m-17 0v-37h20v37" stroke="var(--book-line)" stroke-width=".6"/><path class="p-thread" stroke="var(--book-ink)" stroke-width="1.05"/><path class="p-pulse" d="M0 0" stroke="var(--book-line)" stroke-width="1.8" opacity="0"/><g class="p-tip-glow" opacity="0"><circle r="6" fill="url(#p-light)"/></g><circle class="p-tip" r="1.3" fill="var(--book-ink)"/>"#,
        x - 7.,
        y
    );
    for (i, (text, at)) in THOUGHTS.iter().enumerate() {
        let p = thread(*at).1;
        let _ = write!(
            out,
            r#"<g class="p-thought-{i}" aria-label="{text}"><path d="{}" fill="var(--book-ink)"/></g>"#,
            crate::practice_dialogue::text_path(text, p.0, p.1 - 13., 5.)
        );
    }
    let _ = write!(
        out,
        r#"<g class="p-word" opacity="0" aria-label="СВЕТ"><path d="{}" fill="var(--book-ink)"/></g>"#,
        crate::practice_dialogue::text_path("СВЕТ", x, y - 62., 6.5)
    );
    out.push_str("</g></svg>");
    Some(crate::scene_edges::wrap(&out, 12., 10.))
}
pub fn frame(kind: &str, seconds: f64, reduced: bool) -> Vec<Update> {
    if matches!(kind, "practice-room" | "practice-father") {
        return crate::practice_dialogue::frame(kind, seconds, reduced);
    }
    if crate::practice_art::contains(kind) {
        return crate::practice_art::frame(kind, seconds, reduced);
    }
    let t = clock(seconds, reduced);
    let mut out = Vec::new();
    let mut set = |selector: String, attribute, value: String| {
        out.push(Update {
            selector,
            attribute,
            value,
        })
    };
    if kind == "practice-thread" {
        let progress = if reduced { 1. } else { smooth(t / 11.) };
        let (d, p) = thread(progress);
        let fade = 1. - smooth((t - 14.) / 2.);
        set(".p-thread".into(), "d", d);
        set(".p-thread".into(), "opacity", fade.to_string());
        set(
            ".p-tip".into(),
            "transform",
            format!("translate({} {})", p.0, p.1),
        );
        let tip = if reduced {
            0.
        } else {
            1. - smooth((t - 12.) / 2.)
        };
        set(".p-tip".into(), "opacity", (0.75 * tip).to_string());
        set(
            ".p-tip-glow".into(),
            "transform",
            format!("translate({} {})", p.0, p.1),
        );
        set(".p-tip-glow".into(), "opacity", format!("{:.4}", 0.8 * tip));
        set(".p-pulse".into(), "d", span(progress - 0.07, progress).0);
        set(
            ".p-pulse".into(),
            "opacity",
            format!("{:.4}", 0.5 * tip * smooth(progress / 0.05)),
        );
        let light = if reduced {
            1.
        } else {
            smooth((progress - 0.82) / 0.18) * (1. - smooth((t - 14.5) / 1.5))
        };
        set(".p-exit".into(), "opacity", format!("{:.4}", 0.35 + 0.65 * light));
        set(".p-rays".into(), "opacity", format!("{:.4}", 0.6 * light));
        set(".p-word".into(), "opacity", format!("{:.4}", light));
        for (i, (_, at)) in THOUGHTS.iter().enumerate() {
            let passed = smooth((progress - at + 0.02) / 0.1);
            let back = if reduced { 0. } else { smooth((t - 14.5) / 1.5) };
            let alpha = 0.55 * (1. - passed).max(back);
            set(format!(".p-thought-{i}"), "opacity", format!("{alpha:.4}"));
            set(
                format!(".p-thought-{i}"),
                "transform",
                format!("translate(0 {:.3})", -6. * passed * (1. - back)),
            );
        }
        // The prison walls are scanned while the thread searches its way.
        for i in 0..3 {
            let u = if reduced {
                0.5
            } else {
                (t / 4. + i as f64 / 3.).fract()
            };
            let a = project((-100. + 200. * u, -100.));
            let b = project((-100. + 200. * u, 100.));
            set(
                format!(".p-scan-{i}"),
                "d",
                format!("M{:.3} {:.3}L{:.3} {:.3}", a.0, a.1, b.0, b.1),
            );
            set(
                format!(".p-scan-{i}"),
                "opacity",
                if reduced {
                    "0".into()
                } else {
                    format!(
                        "{:.4}",
                        0.28 * (std::f64::consts::PI * u).sin() * (1. - light)
                    )
                },
            );
        }
    }
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scenes_parse_and_reduced_motion_is_stable() {
        for kind in ["home-shade", "practice-thread"] {
            let source = svg(kind).unwrap();
            let doc = roxmltree::Document::parse(&source).unwrap();
            assert_eq!(frame(kind, 0., true), frame(kind, 87., true));
            assert_eq!(frame(kind, 0., false), frame(kind, 16., false));
            for t in [0., 3., 8., 11.5, 15.9, f64::NAN] {
                for u in frame(kind, t, false) {
                    assert!(!u.value.contains("NaN"));
                    assert!(!u.value.contains("inf"));
                    let class = u.selector.trim_start_matches('.');
                    assert!(doc.descendants().any(|n| n.attribute("class") == Some(class)));
                }
            }
        }
        for kind in ["practice-listening", "practice-trinity", "practice-awareness"] {
            assert!(contains(kind) && svg(kind).is_some() && !frame(kind, 3., false).is_empty());
        }
    }
    #[test]
    fn thread_reaches_the_exit_without_teleporting() {
        assert_eq!(thread(0.).1, project(ROUTE[0]));
        assert_eq!(thread(1.).1, project(ROUTE[9]));
        let mut previous = thread(0.).1;
        for i in 1..1001 {
            let p = thread(i as f64 / 1000.).1;
            assert!((p.0 - previous.0).hypot(p.1 - previous.1) < 1.);
            previous = p;
        }
    }
    #[test]
    fn pulse_is_a_piece_of_the_drawn_thread() {
        let (d, end) = span(0.4, 0.5);
        assert_eq!(end, thread(0.5).1);
        assert!(d.starts_with('M') && !d.contains("NaN"));
        assert_eq!(span(0., 0.).1, project(ROUTE[0]));
    }
}
