//! Analytic alpha feathers shared by the two revised inline vector scenes.
//! Two gradient masks preserve both themes without painting a background color.
use std::fmt::Write;

pub fn wrap(svg: &str, horizontal: f64, vertical: f64) -> String {
    let Some(start) = svg.find('>') else {
        return svg.into();
    };
    let Some(end) = svg.rfind("</svg>") else {
        return svg.into();
    };
    let mut defs = String::from("<defs>");
    for (axis, length, feather) in [("x", 320., horizontal), ("y", 192., vertical)] {
        let fraction = (feather / length).clamp(0.001, 0.45);
        let direction = if axis == "x" {
            "x1=\"0\" y1=\"0\" x2=\"1\" y2=\"0\""
        } else {
            "x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\""
        };
        let _ = write!(
            defs,
            "<linearGradient id=\"scene-edge-{axis}\" {direction}>"
        );
        for (offset, alpha) in [
            (0., 0.),
            (fraction * 0.25, 0.15625),
            (fraction * 0.5, 0.5),
            (fraction * 0.75, 0.84375),
            (fraction, 1.),
            (1. - fraction, 1.),
            (1. - fraction * 0.75, 0.84375),
            (1. - fraction * 0.5, 0.5),
            (1. - fraction * 0.25, 0.15625),
            (1., 0.),
        ] {
            let _ = write!(
                defs,
                "<stop offset=\"{offset:.6}\" stop-color=\"#fff\" stop-opacity=\"{alpha}\"/>"
            );
        }
        let _ = write!(defs,"</linearGradient><mask id=\"scene-fade-{axis}\" x=\"0\" y=\"0\" width=\"320\" height=\"192\" maskUnits=\"userSpaceOnUse\" style=\"mask-type:alpha\"><rect width=\"320\" height=\"192\" fill=\"url(#scene-edge-{axis})\"/></mask>");
    }
    defs.push_str("</defs><g class=\"scene-soft-edges-x\" mask=\"url(#scene-fade-x)\"><g class=\"scene-soft-edges-y\" mask=\"url(#scene-fade-y)\">");
    format!(
        "{}{}{}{}",
        &svg[..=start],
        defs,
        &svg[start + 1..end],
        "</g></g></svg>"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fades_are_alpha_only_and_keep_inner_vectors() {
        let original =
            r#"<svg viewBox="0 0 320 192"><path id="approved" d="M20 20L300 170"/></svg>"#;
        let wrapped = wrap(original, 22., 18.);
        let doc = roxmltree::Document::parse(&wrapped).unwrap();
        assert_eq!(
            doc.descendants().filter(|n| n.has_tag_name("mask")).count(),
            2
        );
        assert!(wrapped.contains(r#"<path id="approved" d="M20 20L300 170"/>"#));
        for mask in doc.descendants().filter(|n| n.has_tag_name("mask")) {
            assert_eq!(mask.attribute("style"), Some("mask-type:alpha"));
            assert_eq!(mask.children().filter(|n| n.is_element()).count(), 1);
        }
        for gradient in doc
            .descendants()
            .filter(|n| n.has_tag_name("linearGradient"))
        {
            let stops: Vec<_> = gradient.children().filter(|n| n.is_element()).collect();
            assert_eq!(stops.first().unwrap().attribute("stop-opacity"), Some("0"));
            assert_eq!(stops.last().unwrap().attribute("stop-opacity"), Some("0"));
        }
    }
}
