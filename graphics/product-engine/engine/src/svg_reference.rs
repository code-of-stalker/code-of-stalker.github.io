//! Resolve a local paint-server ID from a CSS url() value. Safari serializes
//! `mask` as a complete shorthand, while Chromium often returns only url().
//! The trailing position/repeat/composite fields are not part of the SVG ID.
pub fn paint_server_id(value: &str) -> Option<&str> {
    let body = value.trim_start().strip_prefix("url(")?.trim_start();
    let address = if let Some(quote) = body.chars().next().filter(|c| *c == '\'' || *c == '"') {
        let (address, rest) = body[1..].split_once(quote)?;
        if !rest.trim_start().starts_with(')') {
            return None;
        }
        address
    } else {
        body.split_once(')')?.0.trim()
    };
    let id = address.rsplit_once('#')?.1;
    (!id.is_empty() && !id.chars().any(char::is_whitespace)).then_some(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safari_mask_shorthand_and_chromium_url_resolve_the_same_mask() {
        for value in [
            "url(#distance-scan-window)",
            "url(\"#distance-scan-window\")",
            "url(\"#distance-scan-window\") 0% 0% / auto repeat border-box border-box add match-source",
            "url('https://app.example/home#distance-scan-window') 0% 0% / auto repeat border-box border-box add luminance",
            "url( https://app.example/home#distance-scan-window )",
            "url(\"https://app.example/art(1).svg#distance-scan-window\")",
        ] {
            assert_eq!(paint_server_id(value), Some("distance-scan-window"), "{value}");
        }
    }

    #[test]
    fn unrelated_colors_and_invalid_references_are_not_masks() {
        for value in [
            "none",
            "#E7E100",
            "url(image.png)",
            "url(#)",
            "url(#mask",
            "url(\"#mask\" broken)",
        ] {
            assert_eq!(paint_server_id(value), None, "{value}");
        }
    }
}
