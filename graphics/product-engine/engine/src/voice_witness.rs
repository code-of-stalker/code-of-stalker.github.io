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
    let speech = ramp(age, 0., 0.35)
        * (1. - ramp(age, 1.65, 2.2))
        * (0.65 + 0.35 * (age * 9.).sin().powi(2));
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
            (u * PI).sin().powi(2) * (u * TAU * 2.1 - s.t * 1.1).sin() * (5. + layer as f64 * 1.8)
                + 24.,
        );
        points.push((
            tangled.0 + (clean.0 - tangled.0) * s.clear,
            tangled.1 + (clean.1 - tangled.1) * s.clear,
        ));
    }
    point_list(&points, false)
}
fn ring(t: f64, front: bool) -> String {
    let mut points = Vec::new();
    for n in 0..=48 {
        let a = (if front { 0. } else { PI }) + n as f64 / 48. * PI;
        points.push((
            61. * a.cos(),
            9. * a.sin() + 4. * a.cos() * (t * 0.35).sin() + 8.,
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
    <linearGradient id="w-pane" x1="0" y1="0" x2="1" y2="1"><stop stop-color="var(--book-paper)" stop-opacity=".35"/><stop offset="1" stop-color="var(--book-cover)"/></linearGradient>
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
    }
    out.push_str(r#"<ellipse cx="98" cy="174" rx="34" ry="8" fill="var(--book-cover)" stroke="var(--book-line)" stroke-width=".5"/><path d="M64 174v4a34 8 0 0 0 68 0v-4" stroke="var(--book-dim)" stroke-width=".4"/>
    <ellipse cx="224" cy="158" rx="54" ry="12" stroke="var(--book-dim)" stroke-width=".4" opacity=".6"/>
    <ellipse class="w-shadow" cx="224" cy="158" rx="42" ry="8" fill="url(#w-floor)"/>
    <path class="w-thread" stroke="var(--book-line)" stroke-width=".7" fill="none"/>
    <g transform="translate(-65 2) scale(.34)">"#);
    out.push_str(&crate::voice_unseal::observer_svg());
    out.push_str("</g>");
    out.push_str(r#"<g class="w-object"><path class="w-orbit-back" stroke="var(--book-dim)" stroke-width=".5"/>
    <g class="w-card"><path d="M-51 -25H43L51 -17V35L43 43H-51Z" fill="var(--book-cover)" stroke="var(--book-line)" stroke-width=".65"/>
    <path d="M51 -17L56 -13V39L48 47H-46L-51 43H43L51 35Z" fill="var(--book-cover)" stroke="var(--book-dim)" stroke-width=".4"/>
    <path d="M-47 -16v-5h12M35 -21h7l5 5M-47 32v7h12" stroke="var(--book-ink)" stroke-width=".65"/>
    <path d="M-44 -11H44" stroke="var(--book-dim)" stroke-width=".35"/></g>"#);
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
    out.push_str(
        r#"<path class="w-orbit-front" stroke="var(--book-light)" stroke-width=".65"/></g>"#,
    );
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
    for (sel, front) in [(".w-orbit-back", false), (".w-orbit-front", true)] {
        put(&mut out, sel, "d", ring(s.t, front));
        put(
            &mut out,
            sel,
            "opacity",
            s.clear * if front { 0.65 } else { 0.4 },
        );
    }
    // The tether disappears before the fully readable word is held outside.
    put(
        &mut out,
        ".w-thread",
        "d",
        format!(
            "M110 46Q150 {:.3} {:.3} {:.3}",
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
        let x = 111. + (c.0 - 111.) * u;
        let y = 46. + (c.1 - 46.) * u - 14. * (u * PI).sin();
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
        for word in ["БОЛЬ", "ВИНА", "МЫСЛЬ", "Я ОСОЗНАЮ"] {
            for c in word.chars().filter(|c| !c.is_whitespace()) {
                assert!(!typography::glyph(c).is_empty(), "{c}");
            }
        }
        roxmltree::Document::parse(&svg()).unwrap();
        assert_eq!(frame(0., true), frame(99., true));
        assert_eq!(frame(0., false), frame(PERIOD, false));
    }
}
