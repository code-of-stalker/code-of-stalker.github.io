//! Quiet architectural motion and four restraints released by completed phrases.
use crate::{
    family_artwork::{smooth, STARTS},
    step_three::Update,
};
use std::fmt::Write;

const LEVELS: [f64; 4] = [350., 480., 620., 752.];
pub fn release(t: f64, index: usize, reduced: bool) -> f64 {
    if reduced {
        return 1.;
    }
    smooth((t - STARTS[index] - 3.8) / 2.25) * (1. - smooth((t - 29.2) / 2.8))
}
pub fn svg() -> String {
    let mut out =
        String::from(r#"<g fill="none" stroke="var(--book-ink)" stroke-linecap="round">"#);
    // Pulses travel on perspective rays of the existing corridor, behind people.
    for i in 0..6 {
        let _ = write!(
            out,
            r#"<path class="family-floor-{i}" stroke-width="2.1" opacity="0" d="M768 570L230 960M768 570L1310 960"/>"#
        );
    }
    for (i, (x, top, bottom)) in [
        (150., 110., 820.),
        (310., 180., 735.),
        (420., 245., 685.),
        (1110., 245., 685.),
        (1230., 180., 735.),
        (1400., 110., 820.),
    ]
    .iter()
    .enumerate()
    {
        let _ = write!(
            out,
            r#"<path class="family-scan-{i}" d="M{x} {top}V{bottom}" stroke-width="2.1" opacity=".35"/>"#
        );
    }
    out.push_str("</g>");
    for (i, y) in LEVELS.iter().enumerate() {
        for (side, x, end) in [(0, 796., 909.), (1, 1030., 918.)] {
            let _ = write!(
                out,
                r##"<g class="family-block-{i}-{side}" opacity=".27"><path d="M{x} {}L{end} {y}V{}L{x} {}Z" fill="#000" fill-opacity=".65" stroke="var(--book-ink)" stroke-width="1.25"/><path d="M{x} {}L{end} {}M{x} {}V{}" fill="none" stroke="var(--book-ink)" stroke-width=".65"/><path d="M{end} {}V{}" stroke="var(--book-line)" stroke-width="2"/></g>"##,
                y - 16.,
                y + 25.,
                y + 9.,
                y - 11.,
                y + 5.,
                y - 16.,
                y + 9.,
                y + 5.,
                y + 20.
            );
        }
        let _ = write!(
            out,
            r#"<g class="family-release-{i}" opacity="0" fill="none" stroke="var(--book-line)" stroke-width="1.4"><path d="M796 {y}h-12m-9 0h-4M1030 {y}h12m9 0h4"/></g>"#
        );
    }
    out
}
pub fn frame(t: f64, reduced: bool) -> Vec<Update> {
    let t = if reduced { 0. } else { t };
    let mut out = Vec::new();
    let mut set = |selector: String, attribute, value: String| {
        out.push(Update {
            selector,
            attribute,
            value,
        })
    };
    let turn = if reduced {
        0.
    } else {
        t / 32. * std::f64::consts::TAU
    };
    for i in 0..6 {
        // Travel light rather than moving architectural masses.
        let p = if reduced {
            0.5
        } else {
            (t / 16. + i as f64 / 6.).fract()
        };
        let z = 0.08 + p * p * 0.92;
        let y = 570. + 390. * z;
        let x = 768. - 540. * z;
        let xx = 768. + 540. * z;
        set(
            format!(".family-floor-{i}"),
            "d",
            format!(
                "M{x:.2} {y:.2}H{:.2}M{:.2} {y:.2}H{xx:.2}",
                x + 90. * z,
                xx - 90. * z
            ),
        );
        set(
            format!(".family-floor-{i}"),
            "opacity",
            if reduced {
                "0".into()
            } else {
                (0.42 * (std::f64::consts::PI * p).sin().powi(2)).to_string()
            },
        );
        let (sx, top, bottom) = [
            (150., 110., 820.),
            (310., 180., 735.),
            (420., 245., 685.),
            (1110., 245., 685.),
            (1230., 180., 735.),
            (1400., 110., 820.),
        ][i];
        let phase = (t / 16. + i as f64 / 6.).fract();
        let sy = top + (bottom - top - 70.) * phase;
        set(
            format!(".family-scan-{i}"),
            "d",
            format!("M{sx} {sy:.3}v70"),
        );
        set(
            format!(".family-scan-{i}"),
            "opacity",
            if reduced {
                ".1".into()
            } else {
                (0.25 + 0.2 * (turn + i as f64).sin().powi(2)).to_string()
            },
        );
    }
    for (i, y) in LEVELS.iter().enumerate() {
        let r = release(t, i, reduced);
        let pulse = (std::f64::consts::PI * r).sin().max(0.);
        for side in 0..2 {
            let direction = if side == 0 { -1. } else { 1. };
            set(
                format!(".family-block-{i}-{side}"),
                "transform",
                format!(
                    "translate({:.3} {:.3}) rotate({:.3} 913 {y})",
                    direction * 96. * r,
                    -24. * r,
                    direction * 9. * r
                ),
            );
            set(
                format!(".family-block-{i}-{side}"),
                "opacity",
                ((0.24 + pulse * 0.5) * (1. - smooth(r))).to_string(),
            );
        }
        set(
            format!(".family-release-{i}"),
            "opacity",
            (pulse * 0.65).to_string(),
        );
        set(
            format!(".family-release-{i}"),
            "transform",
            format!(
                "translate(913 {y}) scale({:.4} 1) translate(-913 {})",
                1. + r * 0.5,
                -y
            ),
        );
    }
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restraints_release_in_order_after_speech() {
        for (i, start) in STARTS.iter().enumerate() {
            assert_eq!(release(start + 3.5, i, false), 0.);
            assert_eq!(release(start + 6.1, i, false), 1.);
            for next in i + 1..4 {
                assert_eq!(release(start + 6.1, next, false), 0.);
            }
        }
        assert_eq!(release(31.999, 0, false).round(), 0.);
        for i in 0..4 {
            assert_eq!(release(0., i, true), 1.);
        }
    }
}
