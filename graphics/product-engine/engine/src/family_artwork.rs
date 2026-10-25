//! Approved contours traced once. Runtime changes real vector vertices.
//! No texture deformation, bitmap layers, or CSS animation.
use crate::step_three::Update;
use std::{fmt::Write, sync::LazyLock};
pub const STARTS: [f64; 4] = [1.2, 7.5, 13.8, 20.1];
pub const PERIOD: f64 = 32.;
const ART: &str = include_str!("../assets/father-son-vector.svg");
type P = (f64, f64);
pub(crate) fn smooth(x: f64) -> f64 {
    let x = x.clamp(0., 1.);
    x * x * x * (x * (x * 6. - 15.) + 10.)
}
pub(crate) fn voice(t: f64, starts: &[f64]) -> f64 {
    starts
        .iter()
        .map(|s| {
            let a = t - s;
            smooth(a / 0.5) * (1. - smooth((a - 3.5) / 0.7))
        })
        .fold(0., f64::max)
}
pub(crate) fn mouth(t: f64, starts: &[f64]) -> f64 {
    // Broad, smooth syllables with genuine rests between phrases.
    let turn = t * std::f64::consts::TAU / PERIOD;
    voice(t, starts) * (0.5 - 0.5 * (turn * 42.).cos()).powf(1.2)
}
// An open, reassuring gesture spans the whole phrase rather than punctuating it.
fn reassurance(t: f64) -> f64 {
    STARTS
        .iter()
        .map(|s| {
            let a = t - s;
            smooth(a / 1.7) * (1. - smooth((a - 3.1) / 1.9))
        })
        .fold(0., f64::max)
}
fn rotate(p: P, at: P, a: f64) -> P {
    let (sn, cs) = a.sin_cos();
    (
        at.0 + (p.0 - at.0) * cs - (p.1 - at.1) * sn,
        at.1 + (p.0 - at.0) * sn + (p.1 - at.1) * cs,
    )
}
#[derive(Clone)]
pub(crate) struct Contour(Vec<svgtypes::PathSegment>);
impl Contour {
    pub(crate) fn new(d: &str) -> Self {
        Self(
            svgtypes::PathParser::from(d)
                .map(|c| c.expect("approved contour"))
                .collect(),
        )
    }
    pub(crate) fn map(&self, mut warp: impl FnMut(P) -> P) -> String {
        use svgtypes::PathSegment::*;
        let mut d = String::new();
        for c in &self.0 {
            match *c {
                MoveTo { abs: true, x, y } | LineTo { abs: true, x, y } => {
                    let p = warp((x, y));
                    let _ = write!(
                        d,
                        "{}{:.3} {:.3}",
                        if matches!(c, MoveTo { .. }) { 'M' } else { 'L' },
                        p.0,
                        p.1
                    );
                }
                CurveTo {
                    abs: true,
                    x1,
                    y1,
                    x2,
                    y2,
                    x,
                    y,
                } => {
                    d.push('C');
                    for p in [(x1, y1), (x2, y2), (x, y)] {
                        let p = warp(p);
                        let _ = write!(d, "{:.3} {:.3} ", p.0, p.1);
                    }
                }
                ClosePath { .. } => d.push('Z'),
                _ => unreachable!("approved absolute cubic/polygon contours"),
            }
        }
        d
    }
}
static FIGURES: LazyLock<Vec<(String, Contour)>> = LazyLock::new(|| {
    let doc = roxmltree::Document::parse(ART).unwrap();
    doc.descendants()
        .filter_map(|n| {
            Some((
                n.attribute("class")?.to_owned(),
                Contour::new(n.attribute("d")?),
            ))
        })
        .collect()
});
fn point(p: P, son: bool, t: f64, reduced: bool) -> P {
    if reduced {
        return p;
    }
    let turn = t * std::f64::consts::TAU / PERIOD;
    let gentle = reassurance(t);
    let mut q = p;
    if son {
        let upper = 1. - smooth((p.1 - 450.) / 230.);
        q.1 -= 2.4 * (turn * 5.).sin() * upper;
        let listen = reassurance((t - 1.2).max(0.));
        let head = 1. - smooth((p.1 - 375.) / 35.);
        q = rotate(q, (916., 391.), -0.012 * listen * head);
    } else {
        // Continuous forearm/hand rotation about the elbow; wrist stays attached.
        let arm = smooth((p.0 - 662.) / 70.)
            * (1. - smooth((p.1 - 544.) / 25.))
            * smooth((p.1 - 409.) / 37.);
        q = rotate(q, (655., 530.), 0.045 * gentle * arm);
        q.0 += 3. * gentle * arm;
        let upper = 1. - smooth((p.1 - 525.) / 140.);
        q.1 -= 2.5 * (turn * 5.).sin() * upper;
        q.0 += 1.2 * (turn * 5.).sin() * upper;
        // Only lower lip/jaw articulate. Nose, eye and skull never chatter.
        let jaw = smooth((p.0 - 638.) / 30.)
            * smooth((p.1 - 346.) / 7.)
            * (1. - smooth((p.1 - 374.) / 22.));
        q.1 += 3.8 * mouth(t, &STARTS) * jaw;
        let head = 1. - smooth((p.1 - 375.) / 36.);
        q = rotate(q, (606., 388.), -0.009 * gentle * head);
    }
    q
}
pub fn svg() -> String {
    let doc = roxmltree::Document::parse(ART).unwrap();
    let bg = doc
        .descendants()
        .find(|n| n.attribute("id") == Some("architecture"))
        .unwrap();
    let mut out = String::from(r#"<g transform="translate(0 26.667) scale(0.2083333333)">"#);
    out.push_str(&ART[bg.range()]);
    out.push_str(&crate::family_space::svg());
    out.push_str(r#"<path d="M0 0H530V660H0ZM1010 0H1536V660H1010Z" data-rust-matrix-uv=".00065 0 0 0 0.00097 0 0 0 1" fill="none" stroke="none" opacity=".19"/>"#);
    for (name, c) in FIGURES.iter() {
        let fill = if name.ends_with("solid") {
            "#000"
        } else {
            "var(--book-ink)"
        };
        let edge = if name.ends_with("ink") {
            r#"stroke="var(--book-ink)" stroke-width=".85" stroke-linejoin="round""#
        } else {
            ""
        };
        let _ = write!(
            out,
            r#"<path class="family-{name}" d="{}" fill="{fill}" fill-rule="evenodd" {edge}/>"#,
            c.map(|p| p)
        );
    }
    out.push_str(r#"<defs><radialGradient id="family-presence"><stop stop-color="var(--book-line)" stop-opacity=".8"/><stop offset=".22" stop-color="var(--book-ink)" stop-opacity=".5"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient></defs><g class="family-throat" transform="translate(603 401)"><circle r="34" fill="url(#family-presence)"/><circle r="3.5" fill="var(--book-line)" opacity=".75"/></g><g class="family-voice" fill="none" stroke="var(--book-ink)" stroke-width="1.3" stroke-linecap="round" opacity="0"><path class="family-voice-path" d="M703 342Q714 352 701 364M718 336Q734 352 716 371"/></g></g>"#);
    out
}
pub fn frame(t: f64, reduced: bool) -> Vec<Update> {
    let mut out = crate::family_space::frame(t, reduced);
    for (name, c) in FIGURES.iter() {
        out.push(Update {
            selector: format!(".family-{name}"),
            attribute: "d",
            value: c.map(|p| point(p, name.starts_with("son"), t, reduced)),
        });
    }
    out.push(Update {
        selector: ".family-voice".into(),
        attribute: "opacity",
        value: if reduced {
            "0".into()
        } else {
            (voice(t, &STARTS) * 0.5).to_string()
        },
    });
    let s = if reduced { 0. } else { mouth(t, &STARTS) * 2.5 };
    out.push(Update {
        selector: ".family-voice-path".into(),
        attribute: "d",
        value: format!(
            "M{} 342Q{} 352 {} 364M{} 336Q{} 352 {} 371",
            703. + s,
            714. + s,
            701. + s,
            718. + s * 1.5,
            734. + s * 1.5,
            716. + s * 1.5
        ),
    });
    let throat = point((603., 401.), false, t, reduced);
    let breath = if reduced {
        0.
    } else {
        (t * std::f64::consts::TAU / PERIOD * 5.).sin()
    };
    out.push(Update {
        selector: ".family-throat".into(),
        attribute: "transform",
        value: format!(
            "translate({:.3} {:.3}) scale({:.4})",
            throat.0,
            throat.1,
            1. + breath * 0.06
        ),
    });
    out.push(Update {
        selector: ".family-throat".into(),
        attribute: "opacity",
        value: (0.83 + breath * 0.06 + if reduced { 0. } else { reassurance(t) * 0.10 })
            .to_string(),
    });
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn vector_only_and_ground_contacts_stay_fixed() {
        assert!(!ART.contains("<image") && !svg().contains("base64"));
        assert_eq!(FIGURES.len(), 4);
        for i in 0..320 {
            let t = i as f64 * 0.1;
            for p in [(380., 850.), (650., 885.)] {
                assert_eq!(point(p, false, t, false), p);
            }
            for p in [(850., 865.), (970., 880.)] {
                assert_eq!(point(p, true, t, false), p);
            }
        }
    }
    #[test]
    fn actual_geometry_moves_continuously() {
        let p = (780., 482.);
        let reach = point(p, false, 3., false).1 - p.1;
        assert!(
            (2. ..8.).contains(&reach),
            "palm settles gently instead of rising to admonish"
        );
        assert_ne!(frame(2., false), frame(2.3, false));
        assert_eq!(frame(0., true), frame(12., true));
        for i in 0..31999 {
            let t = i as f64 * 0.001;
            assert!(
                (point((670., 357.), false, t, false).1
                    - point((670., 357.), false, t + 0.001, false).1)
                    .abs()
                    < 0.1
            );
        }
    }
}
