//! A spoken thought becomes an observable object. Deterministic Rust geometry,
//! shared by native/web; the observer remains grounded throughout the loop.
use crate::step_three::Update;
use std::{
    f64::consts::{PI, TAU},
    fmt::Write,
};
pub const PERIOD: f64 = 24.;
mod typography {
    include!(concat!(env!("OUT_DIR"), "/spoken_glyphs.rs"));
}
type P = (f64, f64);
#[derive(Clone, Copy)]
struct State {
    t: f64,
    age: f64,
    phrase: usize,
    speech: f64,
    separate: f64,
    clear: f64,
    alpha: f64,
}
fn smooth(x: f64) -> f64 {
    let x = x.clamp(0., 1.);
    (x * x * x * (x * (x * 6. - 15.) + 10.)).clamp(0., 1.)
}
fn ramp(t: f64, a: f64, b: f64) -> f64 {
    smooth((t - a) / (b - a))
}
fn state(seconds: f64, reduced: bool) -> State {
    let t = if reduced || !seconds.is_finite() {
        18.4
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    };
    let phrase = if t < 7. {
        0
    } else if t < 13. {
        1
    } else {
        2
    };
    let age = t - (1. + phrase as f64 * 6.);
    let speech = ramp(age, 0., 0.35) * (1. - ramp(age, 1.65, 2.2));
    let fade = if phrase == 2 {
        1. - ramp(t, 21.5, 23.6)
    } else {
        1. - ramp(age, 4.9, 5.8)
    };
    State {
        t,
        age,
        phrase,
        speech,
        separate: ramp(age, 0.65, 2.65),
        clear: ramp(age, 1.7, 3.7),
        alpha: ramp(age, 0., 0.4) * fade,
    }
}
// Three completed utterances resolve the figure from the head to the soles.
fn assembly(t: f64) -> f64 {
    (0..3)
        .map(|i| ramp(t, 1.9 + i as f64 * 6., 4.9 + i as f64 * 6.))
        .sum::<f64>()
        / 3.
}
fn reveal_bounds(t: f64) -> (f64, f64) {
    let resolved = assembly(t);
    let top = 45. + 133. * resolved;
    (top, top + 96.)
}
fn point_list(points: &[P], close: bool) -> String {
    let mut d = String::new();
    for (i, p) in points.iter().enumerate() {
        let _ = write!(d, "{}{:.3} {:.3}", if i == 0 { 'M' } else { 'L' }, p.0, p.1);
    }
    if close {
        d.push('Z');
    }
    d
}
fn text_path(text: &str, y: f64, size: f64) -> String {
    let mut d = String::new();
    let advance = size * 0.715;
    let start = -(text.chars().count() as f64 * advance) / 2.;
    for (col, c) in text.chars().enumerate() {
        for &(command, p) in typography::glyph(c) {
            let (letter, count) = match command {
                1 => ('M', 1),
                2 => ('L', 1),
                3 => ('Q', 2),
                4 => ('C', 3),
                _ => ('Z', 0),
            };
            d.push(letter);
            for i in 0..count {
                let _ = write!(
                    d,
                    "{:.3} {:.3} ",
                    start + col as f64 * advance + p[i * 2] * size,
                    y - p[i * 2 + 1] * size
                );
            }
        }
    }
    d
}
fn center(s: State) -> P {
    (
        119. + 102. * s.separate,
        55. + 22. * s.separate - (s.separate * PI).sin() * 12.,
    )
}
// One thread evolves from a tangled loop to a legible, quiet waveform.
fn filament(s: State, layer: usize) -> String {
    let mut points = Vec::new();
    for n in 0..=96 {
        let u = n as f64 / 96.;
        let a = u * TAU * 2.6 + s.t * 0.55 + layer as f64 * 0.11;
        let tangled = (
            (a * 1.7).sin() * 18. + a.cos() * 8.,
            a.sin() * 20. + (a * 2.3).cos() * 7.,
        );
        let clean = (
            -43. + 86. * u,
            (u * PI).sin().powi(2) * (u * TAU * 2.1 - s.t * 1.1).sin() * (3.2 + layer as f64 * 0.9)
                + 25.,
        );
        points.push((
            tangled.0 + (clean.0 - tangled.0) * s.clear,
            tangled.1 + (clean.1 - tangled.1) * s.clear,
        ));
    }
    point_list(&points, false)
}
fn put(
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
pub fn svg() -> String {
    let mut out = String::from(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 192" fill="none"><defs>
    <radialGradient id="w-floor"><stop stop-color="var(--book-line)" stop-opacity=".16"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity="0"/></radialGradient>
    <linearGradient id="w-pane" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="var(--book-line)" stop-opacity=".09"/><stop offset=".48" stop-color="var(--book-line)" stop-opacity=".015"/><stop offset="1" stop-color="var(--book-line)" stop-opacity=".055"/></linearGradient>
    <linearGradient id="w-body-material" x1="0" y1="0" x2="1" y2=".15"><stop stop-color="var(--book-line)" stop-opacity=".28"/><stop offset=".35" stop-color="var(--book-line)" stop-opacity=".065"/><stop offset=".7" stop-color="var(--book-line)" stop-opacity=".1"/><stop offset="1" stop-color="var(--book-line)" stop-opacity=".35"/></linearGradient>
    <linearGradient id="w-reveal-gradient" class="w-reveal-gradient" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="45" y2="141">
      <stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".2" stop-color="#fff" stop-opacity=".92"/><stop offset=".5" stop-color="#fff" stop-opacity=".5"/><stop offset=".8" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="w-reveal-mask" x="0" y="0" width="320" height="192" maskUnits="userSpaceOnUse" style="mask-type:alpha"><rect width="320" height="192" fill="url(#w-reveal-gradient)"/></mask>
    </defs>
    <path d="M20 13H300V142H20Z" data-rust-matrix-uv=".00357 0 -.0714 0 .00775 -.1008 0 0 1" fill="none" stroke="none" opacity=".065"/>
    <path d="M8 190L160 129L312 190" stroke="var(--book-dim)" stroke-width=".45" opacity=".35"/>
    <ellipse cx="162" cy="174" rx="144" ry="19" fill="url(#w-floor)"/>
    "##,
    );
    // Perspective vanishing lines and staggered suspended data fins.
    for i in 0..9 {
        let x = 12. + i as f64 * 37.;
        let _ = write!(
            out,
            r#"<path d="M160 129L{x} 192" stroke="var(--book-dim)" stroke-width=".3" opacity=".25"/>"#
        );
    }
    for y in [140., 151., 167., 188.] {
        let spread = (y - 129.) * 2.8;
        let _ = write!(
            out,
            r#"<path d="M{} {y}H{}" stroke="var(--book-dim)" stroke-width=".3" opacity=".3"/>"#,
            160. - spread,
            160. + spread
        );
    }
    for (x, y, w, h) in [
        (28., 43., 16., 86.),
        (52., 58., 10., 59.),
        (282., 32., 15., 95.),
        (264., 54., 8., 63.),
    ] {
        let _ = write!(
            out,
            r#"<path d="M{x} {y}l{w} -4v{h}l-{w} 4Z" fill="var(--book-cover)" stroke="var(--book-dim)" stroke-width=".45" opacity=".8"/><path d="M{} {}v{}" stroke="var(--book-line)" stroke-width=".4" opacity=".3"/>"#,
            x + 3.,
            y + 5.,
            h - 14.
        );
        let _ = write!(
            out,
            r#"<path d="M{} {}h{}v{}l-{} 2Z" fill="var(--book-cover)" stroke="var(--book-dim)" stroke-width=".3" opacity=".6"/>
        <path d="M{} {}h{}v{}h-{}Z" data-rust-matrix-uv=".035 0 0 0 .015 0 0 0 1" stroke="none" fill="none" opacity=".1"/>"#,
            x + w,
            y - 4.,
            3.,
            h,
            3.,
            x + 4.,
            y + 3.,
            w - 7.,
            h - 8.,
            w - 7.
        );
        for row in 0..6 {
            let yy = y + 9. + row as f64 * (h - 19.) / 6.;
            let _ = write!(
                out,
                r#"<path d="M{} {yy}h{}m-{} 3h3" stroke="var(--book-line)" stroke-width=".28" opacity=".3"/>"#,
                x + 4.,
                w - 6.,
                w - 6.
            );
        }
    }
    // Recessed floor circuits and terminals add depth without crossing the person.
    out.push_str(r#"<path d="M18 177L60 155H76M132 172L158 154H185L205 138H252M238 184L217 171H175M52 185H71L79 181" stroke="var(--book-line)" stroke-width=".45" opacity=".32"/>
    <path d="M153 142l6 -3 6 3-6 3ZM188 161l5 -2 5 2-5 2ZM46 173l4 -2 4 2-4 2Z" stroke="var(--book-dim)" stroke-width=".35" opacity=".5"/>
    <path d="M62 42V31H80M124 31H137V47M62 144v8h10M129 152h8v-8" stroke="var(--book-dim)" stroke-width=".4" opacity=".25"/>"#);
    out.push_str(r#"<ellipse cx="98" cy="174" rx="34" ry="8" fill="var(--book-cover)" stroke="var(--book-line)" stroke-width=".5"/><path d="M64 174v4a34 8 0 0 0 68 0v-4" stroke="var(--book-dim)" stroke-width=".4"/>
    <ellipse cx="224" cy="158" rx="54" ry="12" stroke="var(--book-dim)" stroke-width=".4" opacity=".6"/>
    <ellipse class="w-shadow" cx="224" cy="158" rx="42" ry="8" fill="url(#w-floor)"/>
    <path class="w-thread" stroke="var(--book-line)" stroke-width=".7" fill="none"/>
    <g class="w-presence"><g class="w-body-fill" mask="url(#w-reveal-mask)"><g transform="translate(-65 2) scale(.34)">"#);
    out.push_str(&crate::voice_unseal::observer_svg(true));
    out.push_str(r#"</g></g><g class="w-body-contour" transform="translate(-65 2) scale(.34)">"#);
    out.push_str(&crate::voice_unseal::observer_svg(false));
    out.push_str("</g></g>");
    for i in 0..3 {
        let x = 86. + i as f64 * 9.;
        let _ = write!(
            out,
            r#"<path d="M{x} 180h6" stroke="var(--book-dim)" stroke-width=".9" opacity=".35"/><path class="w-assembly-{i}" d="M{x} 180h6" stroke="var(--book-ink)" stroke-width=".9" opacity="0"/>"#
        );
    }
    out.push_str(r#"<g class="w-object">
    <g class="w-card">
    <path d="M-49 -33H44L58 -19V42L49 51H-49" stroke="var(--book-dim)" stroke-width=".3" opacity=".45"/>
    <path d="M54 -17L58 -13V43L50 51H-48L-54 47H46L54 39Z" fill="var(--book-cover)" stroke="var(--book-dim)" stroke-width=".4"/>
    <path d="M-54 -29H42L54 -17V39L46 47H-54Z" fill="var(--book-cover)" stroke="var(--book-line)" stroke-width=".55"/>
    <path d="M-54 -29H42L54 -17V39L46 47H-54Z" fill="url(#w-pane)"/>
    <path d="M-50 -14V-25H40L50 -15V36L43 43H-50V-8" stroke="var(--book-dim)" stroke-width=".3" opacity=".7"/>
    <path d="M-54 -14V-29H-35M32 -29H42L54 -17M54 33V39L46 47H32" stroke="var(--book-ink)" stroke-width=".75" opacity=".8"/>
    <path d="M-45 -13H45M-45 35H45" stroke="var(--book-line)" stroke-width=".3" opacity=".4"/>
    <path d="M-43 -20H-28M28 -20H40M-44 -5v15m0 4v4M44 -5v15m0 4v4" stroke="var(--book-line)" stroke-width=".45" opacity=".5"/>
    <path d="M-43 25H43" stroke="var(--book-dim)" stroke-width=".25" opacity=".45"/>
    <path d="M-43 40h3m3 0h3M34 40h9" stroke="var(--book-line)" stroke-width=".65" opacity=".6"/>"#);
    let _ = write!(
        out,
        r#"<path class="w-program-title" d="{}" fill="var(--book-ink)" opacity=".85"/></g>"#,
        text_path("ПРОГРАММА", -17., 5.8)
    );
    for i in 0..9 {
        let x = -16. + i as f64 * 4.;
        let _ = write!(
            out,
            r#"<path class="w-meter-{i}" d="M{x} 42v-3" stroke="var(--book-line)" stroke-width=".8" opacity="0"/>"#
        );
    }
    for i in 0..3 {
        let _ = write!(
            out,
            r#"<path class="w-filament-{i}" stroke="var(--book-ink)" stroke-width="{}" fill="none"/>"#,
            if i == 1 { 0.8 } else { 0.35 }
        );
    }
    for (i, word) in ["БОЛЬ", "ВИНА", "МЫСЛЬ"].iter().enumerate() {
        let _ = write!(
            out,
            r#"<path class="w-word-{i}" d="{}" fill="var(--book-ink)"/>"#,
            text_path(word, 9., 12.5)
        );
    }
    out.push_str("</g>");
    for (i, word) in ["Я СЛЫШУ", "Я ВИЖУ", "Я ОСОЗНАЮ"].iter().enumerate() {
        let _ = write!(
            out,
            r#"<path class="w-caption-{i}" d="{}" transform="translate(224 143)" fill="var(--book-ink)"/>"#,
            text_path(word, 0., 6.5)
        );
    }
    for i in 0..12 {
        let _ = write!(
            out,
            r#"<path class="w-fragment-{i}" d="M-1 -1H1V1H-1Z" fill="var(--book-line)"/>"#
        );
    }
    out.push_str("</svg>");
    crate::scene_edges::wrap(&out, 12., 10.)
}
pub fn frame(seconds: f64, reduced: bool) -> Vec<Update> {
    let s = state(seconds, reduced);
    let mut out = crate::voice_unseal::observer_frame(s.t, s.speech);
    let (top, bottom) = reveal_bounds(s.t);
    put(&mut out, ".w-reveal-gradient", "y1", top);
    put(&mut out, ".w-reveal-gradient", "y2", bottom);
    put(&mut out, ".w-presence", "opacity", 1.);
    for i in 0..3 {
        put(
            &mut out,
            format!(".w-assembly-{i}"),
            "opacity",
            ramp(s.t, 1.9 + i as f64 * 6., 4.9 + i as f64 * 6.),
        );
    }
    put(
        &mut out,
        ".w-object",
        "data-cycle-time",
        format!("{:.4}", s.t),
    );
    let c = center(s);
    let bob = (s.t * 0.8).sin() * 1.2 * s.separate;
    put(
        &mut out,
        ".w-object",
        "transform",
        format!(
            "translate({:.4} {:.4}) scale({:.4})",
            c.0,
            c.1 + bob,
            0.45 + 0.55 * s.separate
        ),
    );
    put(&mut out, ".w-object", "opacity", s.alpha);
    put(&mut out, ".w-card", "opacity", s.clear * 0.9);
    for i in 0..3 {
        put(&mut out, format!(".w-filament-{i}"), "d", filament(s, i));
        put(
            &mut out,
            format!(".w-filament-{i}"),
            "opacity",
            if i == 1 { 0.85 } else { 0.23 },
        );
        put(
            &mut out,
            format!(".w-word-{i}"),
            "opacity",
            if i == s.phrase { s.clear } else { 0. },
        );
        put(
            &mut out,
            format!(".w-caption-{i}"),
            "opacity",
            if i == s.phrase {
                s.alpha * ramp(s.age, 3., 4.) * 0.85
            } else {
                0.
            },
        );
    }
    for i in 0..9 {
        let h = 1. + 2. * (s.t * 1.1 + i as f64 * 0.7).sin().powi(2);
        put(
            &mut out,
            format!(".w-meter-{i}"),
            "d",
            format!("M{} 42v-{h:.3}", -16. + i as f64 * 4.),
        );
        put(&mut out, format!(".w-meter-{i}"), "opacity", s.clear * 0.55);
    }
    // The tether disappears before the fully readable word is held outside.
    let mouth = crate::voice_unseal::observer_mouth(s.t);
    let mouth = (mouth.0 * 0.34 - 65., mouth.1 * 0.34 + 2.);
    put(
        &mut out,
        ".w-thread",
        "d",
        format!(
            "M{:.3} {:.3}Q150 {:.3} {:.3} {:.3}",
            mouth.0,
            mouth.1,
            42. + (s.t * 2.).sin() * 8.,
            c.0,
            c.1
        ),
    );
    put(
        &mut out,
        ".w-thread",
        "opacity",
        s.alpha * (1. - ramp(s.age, 1.8, 2.7)) * 0.45,
    );
    for i in 0..12 {
        let u = (s.t * 0.45 + i as f64 / 12.).fract();
        let x = mouth.0 + (c.0 - mouth.0) * u;
        let y = mouth.1 + (c.1 - mouth.1) * u - 14. * (u * PI).sin();
        put(
            &mut out,
            format!(".w-fragment-{i}"),
            "transform",
            format!("translate({x:.3} {y:.3}) rotate({:.3})", u * 90.),
        );
        put(
            &mut out,
            format!(".w-fragment-{i}"),
            "opacity",
            s.speech * (u * PI).sin() * 0.65,
        );
    }
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn utterances_resolve_the_body_once_from_head_to_feet() {
        let (head, fade_end) = reveal_bounds(0.5);
        assert!(head > 43. && fade_end < 173.);
        for (time, expected) in [(0.5, 0.), (5., 1. / 3.), (11., 2. / 3.), (18.4, 1.)] {
            assert!((assembly(time) - expected).abs() < 0.0001);
        }
        let mut previous = 0.;
        for sample in 0..230 {
            let progress = assembly(sample as f64 / 10.);
            assert!(progress >= previous);
            previous = progress;
        }
        assert!(reveal_bounds(18.4).0 > 174., "soles must be fully opaque");
        let markup = svg();
        assert!(!markup.contains("w-orbit"));
        let doc = roxmltree::Document::parse(&markup).unwrap();
        let mask = doc
            .descendants()
            .find(|n| n.attribute("id") == Some("w-reveal-mask"))
            .unwrap();
        assert_eq!(mask.attribute("style"), Some("mask-type:alpha"));
        assert_eq!(mask.children().filter(|n| n.is_element()).count(), 1);
        let contour = doc
            .descendants()
            .find(|n| n.attribute("class") == Some("w-body-contour"))
            .unwrap();
        assert!(!contour
            .ancestors()
            .any(|n| n.attribute("mask") == Some("url(#w-reveal-mask)")));
        let fill = doc
            .descendants()
            .find(|n| n.attribute("class") == Some("w-body-fill"))
            .unwrap();
        assert_eq!(fill.attribute("mask"), Some("url(#w-reveal-mask)"));
        assert_eq!(
            fill.descendants()
                .filter(|n| n
                    .attribute("class")
                    .is_some_and(|c| c.starts_with("w-fill-")))
                .count(),
            1
        );
        for t in [0., 5., 11., 18.4] {
            let (a, b) = reveal_bounds(t);
            assert!(
                b - a >= 90.,
                "the fill must have a broad feather, never a cut edge"
            );
            let updates = frame(t, false);
            let opacity = |selector: &str| {
                updates
                    .iter()
                    .find(|u| u.selector == selector && u.attribute == "opacity")
                    .unwrap()
                    .value
                    .parse::<f64>()
                    .unwrap()
            };
            assert_eq!(opacity(".w-presence"), 1.);
            assert!((opacity(".w-person-5") - 0.28).abs() < 0.0001);
        }
        let title = doc
            .descendants()
            .find(|n| n.attribute("class") == Some("w-program-title"))
            .unwrap();
        assert_eq!(title.attribute("transform"), None);
    }
    #[test]
    fn detached_thought_is_outside_and_tether_releases_before_hold() {
        for t in [5., 11., 18.] {
            let s = state(t, false);
            assert!(center(s).0 > 210.);
            assert!(s.clear > 0.95);
            assert_eq!(ramp(s.age, 1.8, 2.7), 1.);
            assert_eq!(s.speech, 0.);
        }
    }
    #[test]
    fn glyphs_are_real_and_static_mode_is_stable() {
        for word in ["БОЛЬ", "ВИНА", "МЫСЛЬ", "Я ОСОЗНАЮ", "ПРОГРАММА"]
        {
            for c in word.chars().filter(|c| !c.is_whitespace()) {
                assert!(!typography::glyph(c).is_empty(), "{c}");
            }
        }
        roxmltree::Document::parse(&svg()).unwrap();
        assert_eq!(frame(0., true), frame(99., true));
        assert_eq!(frame(0., false), frame(PERIOD, false));
    }
}
