//! Speech releases one restraint at a time. Pure deterministic choreography.
//! Shared by the web and native vector adapters; feet never leave the floor.
#[path = "unseal_figure.rs"]
mod figure;
#[path = "unseal_space.rs"]
mod space;
use crate::step_three::Update;
use std::{f64::consts::PI, fmt::Write};
pub const PERIOD: f64 = 26.;
const COUNT: usize = 6;
type P = (f64, f64);
fn ease(v: f64) -> f64 {
    let v = v.clamp(0., 1.);
    (v * v * v * (v * (v * 6. - 15.) + 10.)).clamp(0., 1.)
}
fn ramp(t: f64, a: f64, b: f64) -> f64 {
    ease((t - a) / (b - a))
}
fn mix(a: f64, b: f64, u: f64) -> f64 {
    a + (b - a) * u
}
fn lerp(a: P, b: P, u: f64) -> P {
    (mix(a.0, b.0, u), mix(a.1, b.1, u))
}
fn at(i: usize) -> f64 {
    2.0 + i as f64 * 2.65
}
#[derive(Clone, Copy, Debug)]
struct State {
    t: f64,
    release: f64,
    speech: f64,
    alpha: f64,
}
fn state(seconds: f64, reduced: bool) -> State {
    let t = if reduced || !seconds.is_finite() {
        20.5
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    };
    let release = (0..COUNT)
        .map(|i| ramp(t, at(i) + 0.82, at(i) + 2.9))
        .sum::<f64>()
        / COUNT as f64;
    let speech = (0..COUNT)
        .map(|i| {
            let q = t - at(i);
            ramp(q, 0., 0.4) * (1. - ramp(q, 1.05, 1.85))
        })
        .sum::<f64>();
    State {
        t,
        release,
        speech,
        alpha: ramp(t, 0., 0.65) * (1. - ramp(t, 23.3, 25.7)),
    }
}
fn curve(points: &[P], closed: bool) -> String {
    let mut d = format!("M{:.3} {:.3}", points[0].0, points[0].1);
    let n = points.len();
    for i in 0..if closed { n } else { n - 1 } {
        let a = points[if i == 0 {
            if closed {
                n - 1
            } else {
                0
            }
        } else {
            i - 1
        }];
        let b = points[i];
        let c = points[(i + 1) % n];
        let e = points[if i + 2 < n {
            i + 2
        } else if closed {
            (i + 2) % n
        } else {
            n - 1
        }];
        let _ = write!(
            d,
            "C{:.3} {:.3} {:.3} {:.3} {:.3} {:.3}",
            b.0 + (c.0 - a.0) / 6.,
            b.1 + (c.1 - a.1) / 6.,
            c.0 - (e.0 - b.0) / 6.,
            c.1 - (e.1 - b.1) / 6.,
            c.0,
            c.1
        );
    }
    if closed {
        d.push('Z');
    }
    d
}
struct Shape {
    d: String,
    fill: bool,
    ink_fill: bool,
    alpha: f64,
    stroke: f64,
    width: f64,
}
impl Shape {
    fn line(d: String, alpha: f64, width: f64) -> Self {
        Self {
            d,
            fill: false,
            ink_fill: false,
            alpha,
            stroke: 1.,
            width,
        }
    }
}
fn chain(s: State, i: usize, back: bool) -> Shape {
    let q = s.t - at(i);
    let reveal = ramp(q, 0., 0.5) * (1. - ramp(q, 1.1, 2.5));
    let alpha = (0.065 + 0.72 * reveal) * (1. - ramp(q, 1.9, 3.4));
    let count = [48, 46, 38, 42, 32, 42][i];
    let nodes = figure::chain_nodes(i, s);
    let samples: Vec<P> = (0..=192)
        .map(|n| figure::loop_point(&nodes, n as f64 / 192.))
        .collect();
    let mut lengths = vec![0.];
    for pair in samples.windows(2) {
        lengths
            .push(lengths.last().unwrap() + (pair[1].0 - pair[0].0).hypot(pair[1].1 - pair[0].1));
    }
    let total = *lengths.last().unwrap();
    let sample = |u: f64| -> P {
        let distance = u.rem_euclid(1.) * total;
        let k = lengths.partition_point(|&v| v < distance).clamp(1, 192);
        lerp(
            samples[k - 1],
            samples[k],
            (distance - lengths[k - 1]) / (lengths[k] - lengths[k - 1]).max(0.0001),
        )
    };
    let mut d = String::new();
    for j in 0..count {
        let u = j as f64 / count as f64;
        if ((u * 2. * PI).sin() < 0.) != back {
            continue;
        }
        let signed = (u - 0.25 + 0.5).rem_euclid(1.) - 0.5;
        if q > 0.96 && signed.abs() < 0.55 / count as f64 {
            continue;
        }
        let mut center = sample(u);
        let a = sample(u - 0.001);
        let b = sample(u + 0.001);
        let recoil = ramp(q, 0.96, 1.35);
        let fall = ramp(q, 1.15, 3.25);
        let loose = (1. - signed.abs() * 2.).powi(2);
        let sway = (s.t * 1.1 + u * 2. * PI + i as f64).sin() * 0.6 * (1. - fall);
        center.0 += sway + signed.signum() * (recoil * 32. * loose + fall * 24.);
        center.1 += fall * fall * (85. + 45. * loose) - recoil * 12. * loose;
        let angle =
            (b.1 - a.1).atan2(b.0 - a.0) + (recoil * 0.8 + fall * 1.2) * loose * signed.signum();
        let (sn, cs) = angle.sin_cos();
        let span = (total / count as f64 * 0.64).clamp(2.6, 4.6);
        let half = if j % 2 == 0 { 1.7 } else { 0.65 };
        let points: Vec<P> = [
            (-span + 0.8, -half),
            (-span, 0.),
            (-span + 0.8, half),
            (span - 0.8, half),
            (span, 0.),
            (span - 0.8, -half),
        ]
        .iter()
        .map(|&(x, y)| (center.0 + x * cs - y * sn, center.1 + x * sn + y * cs))
        .collect();
        d.push_str(&curve(&points, true));
    }
    Shape::line(d, alpha * if back { 0.55 } else { 1. }, 1.1)
}
// A brief tear accent and two separate broken-link fragments, timed to speech.
fn rupture(s: State, i: usize) -> Shape {
    let q = s.t - at(i) - 0.96;
    let u = ramp(q, 0., 0.7);
    let alpha = ramp(q, 0., 0.045) * (1. - ramp(q, 0.18, 0.8));
    let nodes = figure::chain_nodes(i, s);
    let points: Vec<P> = (0..=192)
        .map(|n| figure::loop_point(&nodes, n as f64 / 192.))
        .collect();
    let total: f64 = points
        .windows(2)
        .map(|p| (p[1].0 - p[0].0).hypot(p[1].1 - p[0].1))
        .sum();
    let mut walked = 0.;
    let mut c = points[0];
    for pair in points.windows(2) {
        let len = (pair[1].0 - pair[0].0).hypot(pair[1].1 - pair[0].1);
        if walked + len >= total * 0.25 {
            c = lerp(pair[0], pair[1], (total * 0.25 - walked) / len.max(0.001));
            break;
        }
        walked += len;
    }
    let mut d = String::new();
    for n in 0..5 {
        let a = -PI * 0.8 + n as f64 * PI * 0.4;
        let r = 3. + u * 20.;
        let l = (1. - u) * 6. + 1.;
        let _ = write!(
            d,
            "M{:.3} {:.3}l{:.3} {:.3}",
            c.0 + a.cos() * r,
            c.1 + a.sin() * r,
            a.cos() * l,
            a.sin() * l
        );
    }
    for side in [-1., 1.] {
        let x = c.0 + side * (4. + u * 27.);
        let y = c.1 - u * 11. + u * u * 28.;
        let _ = write!(d, "M{:.3} {:.3}l{} -3 4 4 -3 3", x, y, side * 5.);
    }
    Shape::line(d, alpha, 1.3)
}
// Speech is authored in scene pixels, so the cues survive a 320px card.
// Each syllable travels away from the lips; pauses remain visually silent.
fn utterance(s: State) -> Vec<Shape> {
    utterance_at(s, figure::mouth(s), 0.70 * (1. - s.release))
}
fn utterance_at(s: State, mouth: P, tilt: f64) -> Vec<Shape> {
    let (sn, cs) = tilt.sin_cos();
    let point = |x: f64, y: f64| (mouth.0 + x * cs - y * sn, mouth.1 + x * sn + y * cs);
    let opening = s.speech * (1.0 + 0.35 * (s.t * 4.).sin());
    let lips = [
        point(-4., 0.),
        point(-2., -0.25),
        point(0.5, 0.),
        point(-1., opening),
        point(-3.5, opening * 0.6),
    ];
    let mut out = vec![Shape {
        d: curve(&lips, true),
        fill: true,
        ink_fill: false,
        alpha: 0.72 + s.speech * 0.28,
        stroke: 1.,
        width: 0.85,
    }];
    for i in 0..3 {
        let travel = (s.t * 0.48 + i as f64 / 3.).fract();
        let distance = 12. + travel * 72.;
        let half = 5. + travel * 19.;
        let a = point(distance, -half);
        let b = point(distance + 6. + travel * 9., 0.);
        let c = point(distance, half);
        let d = format!(
            "M{:.3} {:.3}Q{:.3} {:.3} {:.3} {:.3}",
            a.0, a.1, b.0, b.1, c.0, c.1
        );
        let envelope = ramp(travel, 0., 0.09) * (1. - ramp(travel, 0.55, 1.));
        out.push(Shape::line(d, s.speech * envelope * 0.8, 1.7));
    }
    out
}
fn shapes(s: State) -> Vec<Shape> {
    let mut out = Vec::new();
    for i in 0..COUNT {
        out.push(chain(s, i, true));
    }
    out.extend(figure::body_shapes(s));
    out.extend(figure::hair(s));
    out.push(figure::eyes(s));
    out.extend(utterance(s));
    for i in 0..COUNT {
        out.push(chain(s, i, false));
        out.push(rupture(s, i));
    }
    out
}
// The next scene has its own female observer, from the approved bridge artwork.
const OBSERVER_ORIGIN: P = (330., 77.);
const OBSERVER_SCALE: f64 = 0.30;
fn observer_pose(seconds: f64) -> crate::breath_heroine::Pose {
    crate::breath_heroine::Pose {
        breath: (seconds * 1.25).sin() * 0.3,
        time: seconds,
        ..Default::default()
    }
}
pub(crate) fn observer_mouth(seconds: f64) -> P {
    let p = crate::breath_heroine::Rig::new(observer_pose(seconds)).point((560., 170.), 2);
    (
        OBSERVER_ORIGIN.0 + p.0 * OBSERVER_SCALE,
        OBSERVER_ORIGIN.1 + p.1 * OBSERVER_SCALE,
    )
}
fn observer_shapes(seconds: f64, speech: f64) -> Vec<Shape> {
    let s = State {
        t: seconds,
        release: 1.,
        speech,
        alpha: 1.,
    };
    let mut out: Vec<Shape> =
        crate::breath_heroine::paths(observer_pose(seconds), OBSERVER_ORIGIN, OBSERVER_SCALE)
            .into_iter()
            .enumerate()
            .map(|(i, d)| Shape {
                d,
                fill: true,
                ink_fill: i % 2 == 1,
                alpha: if i == 1 { 0.78 } else { 1. },
                stroke: if i % 2 == 1 { 0.5 } else { 0. },
                width: 0.45,
            })
            .collect();
    out.extend(utterance_at(s, observer_mouth(seconds), 0.));
    out
}
// Body material and the complete contour have independent visibility contracts.
pub(crate) fn observer_svg(material: bool) -> String {
    let mut out = String::new();
    if material {
        let d = observer_shapes(0., 0.)
            .iter()
            .take(6)
            .step_by(2)
            .map(|p| p.d.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        return format!(
            r#"<path class="w-fill-body" d="{d}" fill="var(--book-cover)" fill-rule="nonzero"/><path class="w-material-body" d="{d}" fill="url(#w-body-material)" fill-rule="nonzero"/>"#
        );
    }
    for (i, p) in observer_shapes(0., 0.).iter().enumerate() {
        if i < 6 && i % 2 == 0 {
            continue;
        }
        let fill = if p.ink_fill {
            "var(--book-ink)"
        } else if p.fill {
            "var(--book-cover)"
        } else {
            "none"
        };
        let _ = write!(
            out,
            r#"<path class="w-person-{i}" d="{}" fill="{fill}" fill-rule="evenodd" stroke="var(--book-ink)" stroke-width="{}" stroke-opacity="{}" opacity="{}" stroke-linecap="round" stroke-linejoin="round"/>"#,
            p.d,
            p.width,
            if i < 6 { 0.2 } else { p.stroke },
            if i < 6 { p.alpha * 0.28 } else { p.alpha }
        );
    }
    out
}
pub(crate) fn observer_frame(seconds: f64, speech: f64) -> Vec<Update> {
    let shapes = observer_shapes(seconds, speech);
    let d = shapes
        .iter()
        .take(6)
        .step_by(2)
        .map(|p| p.d.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let mut out = vec![
        Update {
            selector: ".w-fill-body".into(),
            attribute: "d",
            value: d.clone(),
        },
        Update {
            selector: ".w-material-body".into(),
            attribute: "d",
            value: d,
        },
    ];
    out.extend(shapes.into_iter().enumerate().flat_map(|(i, p)| {
        if i < 6 && i % 2 == 0 {
            return vec![];
        }
        let selector = format!(".w-person-{i}");
        vec![
            Update {
                selector: selector.clone(),
                attribute: "d",
                value: p.d,
            },
            Update {
                selector: selector.clone(),
                attribute: "opacity",
                value: format!("{:.5}", if i < 6 { p.alpha * 0.28 } else { p.alpha }),
            },
            Update {
                selector,
                attribute: "stroke-opacity",
                value: format!("{:.5}", if i < 6 { 0.2 } else { p.stroke }),
            },
        ]
    }));
    out
}
pub fn svg() -> String {
    let mut out = String::from(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 192" fill="none"><defs><linearGradient id="unseal-form" x1="0" y1="0" x2="1" y2="0"><stop stop-color="var(--book-cover)"/><stop offset=".52" stop-color="var(--book-cover)"/><stop offset="1" stop-color="var(--book-paper)"/></linearGradient></defs><g transform="scale(.333333333333)"><path d="M130 65H830V490H130Z" data-rust-matrix-uv="0.00143 0 -0.186 0 0.00235 -0.153 0 0 1" fill="none" stroke="none" opacity=".1"/>"#,
    );
    out.push_str(&space::svg());
    out.push_str(r#"<g class="unseal-stage" data-cycle-time="0">"#);
    for (i, p) in shapes(state(0., false)).iter().enumerate() {
        let fill = if p.ink_fill {
            "var(--book-ink)"
        } else if p.fill {
            "var(--book-cover)"
        } else {
            "none"
        };
        let _ = write!(
            out,
            r#"<path class="unseal-path-{i}" d="{}" fill="{fill}" fill-rule="evenodd" stroke="var(--book-ink)" stroke-width="{}" opacity="{}" stroke-opacity="{}" stroke-linejoin="round" stroke-linecap="round"/>"#,
            p.d, p.width, p.alpha, p.stroke
        );
    }
    out.push_str("</g></g></svg>");
    crate::scene_edges::wrap(&out, 18., 13.)
}
pub fn frame(seconds: f64, reduced: bool) -> Vec<Update> {
    let s = state(seconds, reduced);
    let mut out = space::frame(s.t);
    let mut set = |selector: String, attribute, value: String| {
        out.push(Update {
            selector,
            attribute,
            value,
        })
    };
    set(
        ".unseal-stage".into(),
        "data-cycle-time",
        format!("{:.4}", s.t),
    );
    set(".unseal-stage".into(), "opacity", format!("{:.5}", s.alpha));
    for (i, p) in shapes(s).into_iter().enumerate() {
        let selector = format!(".unseal-path-{i}");
        set(selector.clone(), "d", p.d);
        set(selector.clone(), "opacity", format!("{:.5}", p.alpha));
        set(selector, "stroke-opacity", format!("{:.5}", p.stroke));
    }
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn releases_are_sequential_and_speech_precedes_break() {
        for i in 0..COUNT {
            assert!(state(at(i) + 0.4, false).speech > 0.3);
            let before = state(at(i) + 0.85, false);
            assert!(chain(before, i, false).alpha > 0.3);
            for j in i + 1..COUNT {
                assert!(chain(before, j, false).alpha < 0.08);
            }
            assert!(chain(state(at(i) + 3.5, false), i, false).alpha < 0.001);
        }
    }
    #[test]
    fn soles_remain_fixed_and_unfolding_is_monotonic() {
        let mut prior = 0.;
        for n in 0..220 {
            let s = state(n as f64 / 10., false);
            assert!(s.release >= prior);
            prior = s.release;
        }
        assert_eq!(prior, 1.);
    }
    #[test]
    fn finite_contours_static_reduced_and_fixed_topology() {
        roxmltree::Document::parse(&svg()).unwrap();
        assert_eq!(frame(0., true), frame(99., true));
        assert_eq!(frame(0., false), frame(PERIOD, false));
        let count = shapes(state(0., false)).len();
        for i in 0..260 {
            let s = state(i as f64 / 10., false);
            assert_eq!(shapes(s).len(), count);
            for p in shapes(s) {
                assert!(!p.d.contains("NaN"));
                assert!((0. ..=1.).contains(&p.alpha));
            }
        }
    }
}
