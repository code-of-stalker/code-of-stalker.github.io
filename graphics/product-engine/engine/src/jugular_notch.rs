//! The approved anatomy resolves outward from the jugular notch.
//!
//! The finished contours are included unchanged. A separate, static vector
//! underdrawing gives the initial broken contours a restrained displacement.
//! Only analytic gradient radii and scalar animation properties change per
//! frame: none of the 1,416 approved cubic segments is reconstructed.
use crate::step_three::Update;
use std::f64::consts::{PI, TAU};

pub const PERIOD: f64 = 20.;
const REST_TIME: f64 = 13.;
const FULL_RADIUS: f64 = 232.;
const ARTWORK: &str = include_str!("../assets/jugular-notch.svg");
const UNDERDRAWING: &str = include_str!("../assets/jugular-underdrawing.svg");

// Each mask is one fixed rectangle with a gradient fill, so vector_gpu uses
// its analytic mask path. The two radial masks belong to sibling layers;
// with scene_edges' two masks, any drawing primitive has depth three.
const REVEAL_DEFS: &str = r##"<defs>
  <radialGradient id="jugular-resolved-gradient" class="v-clear-radius" gradientUnits="userSpaceOnUse" cx="160" cy="97.245" r="232">
    <stop offset="0" stop-color="#fff" stop-opacity="1"/>
    <stop offset=".84" stop-color="#fff" stop-opacity="1"/>
    <stop offset=".92" stop-color="#fff" stop-opacity=".5"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="jugular-underdrawing-gradient" class="v-ghost-radius" gradientUnits="userSpaceOnUse" cx="160" cy="97.245" r="232">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".84" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".92" stop-color="#fff" stop-opacity=".5"/>
    <stop offset="1" stop-color="#fff" stop-opacity="1"/>
  </radialGradient>
  <radialGradient id="jugular-wave-gradient" class="v-wave-radius" gradientUnits="userSpaceOnUse" cx="160" cy="97.245" r="232">
    <stop offset="0" stop-color="var(--book-ink)" stop-opacity="0"/>
    <stop offset=".90" stop-color="var(--book-ink)" stop-opacity="0"/>
    <stop offset=".935" stop-color="var(--book-ink)" stop-opacity=".16"/>
    <stop offset=".96" stop-color="var(--book-ink)" stop-opacity=".8"/>
    <stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/>
  </radialGradient>
  <mask id="jugular-resolved-mask" x="0" y="0" width="320" height="192" maskUnits="userSpaceOnUse" style="mask-type:alpha">
    <rect width="320" height="192" fill="url(#jugular-resolved-gradient)"/>
  </mask>
  <mask id="jugular-underdrawing-mask" x="0" y="0" width="320" height="192" maskUnits="userSpaceOnUse" style="mask-type:alpha">
    <rect width="320" height="192" fill="url(#jugular-underdrawing-gradient)"/>
  </mask>
</defs>"##;

fn set(out: &mut Vec<Update>, selector: impl Into<String>, attribute: &'static str, value: f64) {
    out.push(Update {
        selector: selector.into(),
        attribute,
        value: value.to_string(),
    });
}

fn smooth(start: f64, end: f64, time: f64) -> f64 {
    let u = ((time - start) / (end - start)).clamp(0., 1.);
    u * u * (3. - 2. * u)
}

pub fn svg() -> String {
    const STAGE: &str = "<g class=\"jugular-stage\">";
    const SOURCE: &str = "<g class=\"v-source\"";
    let stage = ARTWORK.find(STAGE).expect("approved jugular stage");
    let source = ARTWORK.find(SOURCE).expect("approved notch source");
    let ghost_start = UNDERDRAWING.find("<g ").expect("derived contour group");
    let ghost_end = UNDERDRAWING.rfind("</svg>").expect("derived asset root");
    // Slice the complete original body verbatim, including anatomy, breath,
    // and resonance. Keep the notch light outside the construction envelope
    // so it remains the visual anchor at both ends of the loop.
    let svg = format!(
        "{}{}{}<g class=\"v-figure\" opacity=\"1\"><g class=\"v-underdrawing\" opacity=\"0\" mask=\"url(#jugular-underdrawing-mask)\">{}</g><g class=\"v-resolved\" mask=\"url(#jugular-resolved-mask)\">{}</g><rect class=\"v-construction-wave\" width=\"320\" height=\"192\" fill=\"url(#jugular-wave-gradient)\" opacity=\"0\"/></g>{}",
        &ARTWORK[..stage],
        REVEAL_DEFS,
        STAGE,
        &UNDERDRAWING[ghost_start..ghost_end],
        &ARTWORK[stage + STAGE.len()..source],
        &ARTWORK[source..],
    );
    crate::scene_edges::wrap(&svg, 22., 18.)
}

pub fn frame(seconds: f64, reduced: bool) -> Vec<Update> {
    // Suspension stays with the shared scene clock. A nonfinite clock and
    // reduced motion both choose the same fully assembled, quiet frame.
    let t = if reduced || !seconds.is_finite() {
        REST_TIME
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    };
    let construction = smooth(2.4, 10.2, t);
    let radius = 0.001 + (FULL_RADIUS - 0.001) * construction;
    let presence = smooth(0.25, 1.6, t) * (1. - smooth(16.6, 19.4, t));
    let ghost = 0.42 * (1. - smooth(9.2, 10.2, t));
    let wave = 0.32 * smooth(2.4, 3.2, t) * (1. - smooth(9.4, 10.2, t));
    let phase = (t / 10.).fract();
    let breath = 0.5 - 0.5 * (phase * TAU).cos();
    let mut out = Vec::with_capacity(17);
    for selector in [".v-clear-radius", ".v-ghost-radius", ".v-wave-radius"] {
        set(&mut out, selector, "r", radius);
    }
    set(&mut out, ".v-figure", "opacity", presence);
    set(&mut out, ".v-underdrawing", "opacity", ghost);
    set(&mut out, ".v-construction-wave", "opacity", wave);
    set(&mut out, ".v-source", "opacity", 0.55 + 0.4 * breath);
    // The authored dash lengths total 100. This offset advances the breath
    // up the original chest-to-notch path and wraps by one whole pattern.
    set(
        &mut out,
        ".v-breath-line",
        "stroke-dashoffset",
        -100. * phase,
    );
    for index in 0..3 {
        let u = (phase + index as f64 / 3.).fract();
        let rx = 8. + 58. * u;
        let selector = format!(".v-resonance-{index}");
        set(&mut out, &selector, "rx", rx);
        set(&mut out, &selector, "ry", rx * 0.21);
        set(&mut out, selector, "opacity", 0.5 * (PI * u).sin().powi(2));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn value(updates: &[Update], selector: &str, attribute: &str) -> f64 {
        updates
            .iter()
            .find(|u| u.selector == selector && u.attribute == attribute)
            .expect("authored animation property")
            .value
            .parse()
            .unwrap()
    }

    #[test]
    fn looping_suspension_and_reduced_motion_are_deterministic() {
        assert_eq!(frame(0., false), frame(PERIOD, false));
        assert_eq!(frame(3., false), frame(PERIOD + 3., false));
        assert_eq!(frame(-50., false), frame(0., false));
        for t in [0., 20., 10000., f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            assert_eq!(frame(t, true), frame(REST_TIME, false));
        }
        for t in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            assert_eq!(frame(t, false), frame(REST_TIME, false));
        }
        let rest = frame(REST_TIME, true);
        assert_eq!(value(&rest, ".v-figure", "opacity"), 1.);
        assert_eq!(value(&rest, ".v-underdrawing", "opacity"), 0.);
        assert_eq!(value(&rest, ".v-construction-wave", "opacity"), 0.);
        assert_eq!(value(&rest, ".v-clear-radius", "r"), FULL_RADIUS);
    }

    #[test]
    fn wave_leaves_complete_anatomy_then_holds_and_fades_before_reset() {
        let mut previous = 0.;
        for sample in 0..=1200 {
            let t = sample as f64 / 60.;
            let updates = frame(t, false);
            let radius = value(&updates, ".v-clear-radius", "r");
            if t < PERIOD {
                assert!(radius >= previous);
                previous = radius;
            }
            for update in updates {
                let number: f64 = update.value.parse().unwrap();
                assert!(number.is_finite());
                if update.attribute == "opacity" {
                    assert!((0. ..=1.).contains(&number));
                }
            }
        }
        // Even the farthest viewbox corner is inside the fully opaque region.
        assert!(FULL_RADIUS * 0.84 > 160_f64.hypot(97.245));
        for t in [10.2, 13., 16.6] {
            let hold = frame(t, false);
            assert_eq!(value(&hold, ".v-clear-radius", "r"), FULL_RADIUS);
            assert_eq!(value(&hold, ".v-figure", "opacity"), 1.);
            assert_eq!(value(&hold, ".v-underdrawing", "opacity"), 0.);
        }
        for t in [19.4, 19.999, 20., 20.2] {
            assert_eq!(value(&frame(t, false), ".v-figure", "opacity"), 0.);
        }
    }

    #[test]
    fn approved_paths_stay_exact_and_masks_remain_analytic_with_depth_three() {
        let scene = svg();
        let original = roxmltree::Document::parse(ARTWORK).unwrap();
        let wrapped = roxmltree::Document::parse(&scene).unwrap();
        let original_path = original
            .descendants()
            .find(|n| n.attribute("class") == Some("jugular-anatomy"))
            .unwrap();
        let final_path = wrapped
            .descendants()
            .find(|n| n.attribute("class") == Some("jugular-anatomy"))
            .unwrap();
        assert_eq!(original_path.attribute("d"), final_path.attribute("d"));
        assert_eq!(
            original_path.attribute("fill-rule"),
            final_path.attribute("fill-rule")
        );
        assert!(!scene.contains("<image"));
        assert!(!scene.contains("<filter"));
        assert_eq!(scene.matches("<svg ").count(), 1);
        let masks: Vec<_> = wrapped
            .descendants()
            .filter(|n| n.has_tag_name("mask"))
            .collect();
        assert_eq!(masks.len(), 4);
        for mask in masks {
            assert_eq!(mask.attribute("style"), Some("mask-type:alpha"));
            let children: Vec<_> = mask.children().filter(|n| n.is_element()).collect();
            assert_eq!(children.len(), 1);
            assert!(children[0].has_tag_name("rect"));
            assert!(children[0].attribute("rx").is_none());
        }
        let depth = wrapped
            .descendants()
            .filter(|n| n.is_element())
            .map(|n| {
                n.ancestors()
                    .filter(|a| a.attribute("mask").is_some())
                    .count()
            })
            .max()
            .unwrap();
        assert_eq!(depth, 3);
        for update in frame(4.5, false) {
            assert_ne!(update.attribute, "d");
            let class = &update.selector[1..];
            assert!(wrapped
                .descendants()
                .any(|n| n.attribute("class") == Some(class)));
        }
    }

    #[test]
    fn resonance_resets_invisibly_and_breath_travels_toward_the_notch() {
        for index in 0..3 {
            let selector = format!(".v-resonance-{index}");
            let boundary = 10. * (1. - index as f64 / 3.);
            let before = frame(boundary - 0.00001, false);
            let after = frame(boundary + 0.00001, false);
            assert!(value(&before, &selector, "opacity") < 1e-9);
            assert!(value(&after, &selector, "opacity") < 1e-9);
            assert!(value(&before, &selector, "rx") > 65.9);
            assert!(value(&after, &selector, "rx") < 8.1);
        }
        assert!(
            value(&frame(5., false), ".v-breath-line", "stroke-dashoffset")
                < value(&frame(4., false), ".v-breath-line", "stroke-dashoffset")
        );
    }
}
