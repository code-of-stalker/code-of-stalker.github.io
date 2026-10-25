//! Quiet visual companions to self-paced practice. Geometry and time remain
//! independent of input adapters; reduced motion presents a resolved still.
use crate::step_three::Update;
use std::{f64::consts::TAU, fmt::Write};
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
pub fn contains(kind: &str) -> bool {
    matches!(
        kind,
        "practice-listening"
            | "practice-trinity"
            | "practice-thread"
            | "home-shade"
            | "practice-room"
            | "practice-father"
    )
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
fn thread(progress: f64) -> (String, P) {
    let length: f64 = ROUTE
        .windows(2)
        .map(|p| (p[1].0 - p[0].0).hypot(p[1].1 - p[0].1))
        .sum();
    let mut remaining = length * progress.clamp(0., 1.);
    let mut points = vec![project(ROUTE[0])];
    for segment in ROUTE.windows(2) {
        let a = segment[0];
        let b = segment[1];
        let span = (b.0 - a.0).hypot(b.1 - a.1);
        let u = (remaining / span).clamp(0., 1.);
        points.push(project((a.0 + (b.0 - a.0) * u, a.1 + (b.1 - a.1) * u)));
        remaining -= span;
        if remaining <= 0. {
            break;
        }
    }
    (poly(&points), *points.last().unwrap())
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
    if !contains(kind) {
        return None;
    }
    if kind == "home-shade" {
        return Some(r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" preserveAspectRatio="none"><defs><linearGradient id="home-copy-y" x2="0" y2="1"><stop stop-color="var(--book-cover)" stop-opacity="0"/><stop offset=".32" stop-color="var(--book-cover)" stop-opacity=".5"/><stop offset=".78" stop-color="var(--book-cover)" stop-opacity=".96"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity=".98"/></linearGradient><linearGradient id="home-copy-x"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".07" stop-color="#fff"/><stop offset=".83" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="home-copy-mask" style="mask-type:alpha"><rect width="320" height="160" fill="url(#home-copy-x)"/></mask></defs><rect width="320" height="160" fill="url(#home-copy-y)" mask="url(#home-copy-mask)"/></svg>"##.into());
    }
    let mut out = String::from(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 192" fill="none"><defs><radialGradient id="p-halo"><stop stop-color="var(--book-line)" stop-opacity=".22"/><stop offset="1" stop-color="var(--book-line)" stop-opacity="0"/></radialGradient></defs><g stroke-linecap="round" stroke-linejoin="round"><path d="M24 22H296V151H24Z" data-rust-matrix-uv=".00368 0 -.088 0 .00775 -.171 0 0 1" fill="none" stroke="none" opacity=".035"/><ellipse cx="160" cy="162" rx="117" ry="14" fill="url(#p-halo)"/>"#,
    );
    if kind == "practice-thread" {
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
            r#"<path d="M{} {}v-34h14v34m-17 0v-37h20v37" stroke="var(--book-line)" stroke-width=".6"/><ellipse cx="{x}" cy="{}" rx="23" ry="28" fill="url(#p-halo)"/><path class="p-thread" stroke="var(--book-ink)" stroke-width="1.05"/><circle class="p-tip" r="1.3" fill="var(--book-ink)"/>"#,
            x - 7.,
            y,
            y - 16.
        );
    } else {
        out.push_str(r#"<path d="M28 160L160 130L292 160M48 173L160 139L272 173M94 180L160 147L226 180" stroke="var(--book-dim)" stroke-width=".35" opacity=".4"/><path d="M31 123V44l24 -9v78M289 123V44l-24 -9v78" stroke="var(--book-line)" stroke-width=".5" opacity=".25"/>"#);
        for side in [38., 276.] {
            for row in 0..7 {
                let y = 49. + row as f64 * 8.;
                let _ = write!(
                    out,
                    r#"<path d="M{side} {y}h6m-6 2h3" stroke="var(--book-dim)" stroke-width=".4" opacity=".5"/>"#
                );
            }
        }
        if kind == "practice-listening" {
            out.push_str(r#"<g class="p-breath"><ellipse cx="160" cy="89" rx="35" ry="49" stroke="var(--book-line)" stroke-width=".5" opacity=".55"/><ellipse cx="160" cy="89" rx="27" ry="49" stroke="var(--book-dim)" stroke-width=".4"/><ellipse cx="160" cy="89" rx="35" ry="12" stroke="var(--book-line)" stroke-width=".4" opacity=".35"/><ellipse cx="160" cy="89" rx="33" ry="38" fill="url(#p-halo)"/></g><path d="M160 51V70M160 108V127M156 47h8M156 131h8" stroke="var(--book-line)" stroke-width=".5" opacity=".5"/><circle cx="160" cy="89" r="2" fill="var(--book-ink)" opacity=".7"/>"#);
            for i in 0..5 {
                let _ = write!(
                    out,
                    r#"<path class="p-wave-{i}" stroke="var(--book-line)" stroke-width="{}" opacity="{}"/>"#,
                    if i == 2 { 0.7 } else { 0.35 },
                    if i == 2 { 0.75 } else { 0.23 }
                );
            }
        } else {
            out.push_str(r#"<path d="M160 33C130 43 88 103 97 135C127 153 193 153 223 135C232 103 190 43 160 33Z" stroke="var(--book-dim)" stroke-width=".4" opacity=".5"/><path d="M160 33Q160 82 160 96M97 135Q126 114 160 96M223 135Q194 114 160 96" stroke="var(--book-line)" stroke-width=".6" opacity=".6"/>"#);
            for (i, (x, y)) in [(160., 33.), (97., 135.), (223., 135.)]
                .into_iter()
                .enumerate()
            {
                let _ = write!(
                    out,
                    r#"<circle cx="{x}" cy="{y}" r="9" fill="var(--book-cover)" stroke="var(--book-line)" stroke-width=".65"/><circle cx="{x}" cy="{y}" r="5" stroke="var(--book-dim)" stroke-width=".4"/><circle class="p-focus-{i}" cx="{x}" cy="{y}" r="21" fill="url(#p-halo)"/>"#
                );
            }
            out.push_str(r#"<g class="p-breath"><circle cx="160" cy="96" r="25" fill="url(#p-halo)"/><path d="M160 83L173 96L160 109L147 96Z" stroke="var(--book-ink)" stroke-width=".65"/><circle cx="160" cy="96" r="4" fill="var(--book-line)" opacity=".6"/></g>"#);
        }
    }
    out.push_str("</g></svg>");
    Some(crate::scene_edges::wrap(&out, 12., 10.))
}
pub fn frame(kind: &str, seconds: f64, reduced: bool) -> Vec<Update> {
    if matches!(kind, "practice-room" | "practice-father") {
        return crate::practice_dialogue::frame(kind, seconds, reduced);
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
        set(".p-thread".into(), "d", d);
        set(
            ".p-thread".into(),
            "opacity",
            (1. - smooth((t - 14.) / 2.)).to_string(),
        );
        set(
            ".p-tip".into(),
            "transform",
            format!("translate({} {})", p.0, p.1),
        );
        set(
            ".p-tip".into(),
            "opacity",
            if reduced {
                "0".into()
            } else {
                (0.75 * (1. - smooth((t - 12.) / 2.))).to_string()
            },
        );
    } else if kind != "home-shade" {
        let breath = if reduced {
            0.5
        } else {
            0.5 - 0.5 * (t * TAU / 8.).cos()
        };
        let cy = if kind == "practice-listening" {
            89.
        } else {
            96.
        };
        let scale = 0.98 + 0.04 * breath;
        set(
            ".p-breath".into(),
            "transform",
            format!("translate(160 {cy}) scale({scale}) translate(-160 {})", -cy),
        );
        if kind == "practice-listening" {
            for i in 0..5 {
                let points: Vec<_> = (0..81)
                    .map(|n| {
                        let u = n as f64 / 80.;
                        let x = 43. + 234. * u;
                        let envelope = (u * std::f64::consts::PI).sin().powi(2);
                        (
                            x,
                            89. + ((u * TAU * 2.4 - t * 0.8) + (i as f64 - 2.) * 0.22).sin()
                                * envelope
                                * (5. + 12. * breath),
                        )
                    })
                    .collect();
                set(format!(".p-wave-{i}"), "d", poly(&points));
            }
        } else {
            for i in 0..3 {
                set(
                    format!(".p-focus-{i}"),
                    "opacity",
                    (0.45 + 0.4 * breath).to_string(),
                );
            }
        }
    }
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scenes_parse_and_reduced_motion_is_stable() {
        for kind in [
            "home-shade",
            "practice-listening",
            "practice-trinity",
            "practice-thread",
        ] {
            let source = svg(kind).unwrap();
            roxmltree::Document::parse(&source).unwrap();
            assert_eq!(frame(kind, 0., true), frame(kind, 87., true));
            assert_eq!(frame(kind, 0., false), frame(kind, 16., false));
            for t in [0., 3., 8., 11.5, 15.9, f64::NAN] {
                for u in frame(kind, t, false) {
                    assert!(!u.value.contains("NaN"));
                    assert!(!u.value.contains("inf"));
                }
            }
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
}
