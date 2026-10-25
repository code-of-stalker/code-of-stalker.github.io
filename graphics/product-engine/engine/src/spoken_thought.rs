//! Spoken thoughts: authored vectors and a pure clock, shared by web/native.
//! Approved seated figure with a perspective room revealed by speaking.
use crate::step_three::Update;
use std::f64::consts::TAU;
use std::fmt::Write;
use std::sync::LazyLock;

pub const PERIOD: f64 = 56.;
pub use crate::spoken_copy::PHRASES;
const STARTS: [f64; 3] = [4., 18.5, 33.];
const LETTER_START: f64 = 0.72;
const LETTER_SPAN: f64 = 1.35;
const LETTER_UNFOLD: f64 = 0.52;
const SNAP_AT: f64 = 5.2;
const FLIGHT_START: f64 = 5.4;
const FLIGHT_DURATION: f64 = 4.6;
const HEAD_SCALE: f64 = 0.6764705882;
const HEAD_OFFSET: Point = (15.411764706, 53.588235294);
// Three nearby resting places: up, down, and across the room. No phrase
// occupies the next utterance's baseline or crosses the seated silhouette.
const PARKING: [(Point, f64, f64); 3] = [
    ((128., 49.), 0.82, -7.),
    ((94., 122.), 0.78, 5.),
    ((157., 88.), 0.80, -5.),
];
type Point = (f64, f64);
#[derive(Debug, Clone, Copy)]
struct State {
    t: f64,
    alpha: f64,
    calm: f64,
    phrase: Option<usize>,
}
fn smooth(x: f64) -> f64 {
    let x = x.clamp(0., 1.);
    x * x * (3. - 2. * x)
}
fn state(seconds: f64, reduced: bool) -> State {
    let raw = if reduced || !seconds.is_finite() {
        48.
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    };
    let alpha = if raw < 54.5 {
        1. - smooth((raw - 52.) / 1.5)
    } else {
        smooth((raw - 54.5) / 1.5)
    };
    // Reset behind the existing soft fade; never snap visible words or thoughts.
    let t = if raw >= 53.5 { 0. } else { raw };
    let calm = STARTS
        .iter()
        .map(|start| smooth((t - start - 3.6) / 7.4))
        .sum::<f64>()
        / 3.;
    State {
        t,
        alpha,
        calm,
        phrase: STARTS.iter().rposition(|start| t >= *start),
    }
}
fn age(s: State, phrase: usize) -> f64 {
    s.t - STARTS[phrase]
}
fn detach(s: State, phrase: usize) -> f64 {
    smooth((age(s, phrase) - SNAP_AT) / 1.55)
}
fn distance(s: State, phrase: usize) -> f64 {
    smooth((age(s, phrase) - FLIGHT_START) / FLIGHT_DURATION)
}
fn phrase_pose(s: State, phrase: usize) -> (Point, f64) {
    let depth = distance(s, phrase);
    let (target, final_scale, arc) = PARKING[phrase];
    (
        (
            TEXT_X + (target.0 - TEXT_X) * depth,
            BASELINE + (target.1 - BASELINE) * depth + arc * (std::f64::consts::PI * depth).sin(),
        ),
        1. + (final_scale - 1.) * depth,
    )
}
fn phrase_transform(s: State, phrase: usize, _reduced: bool) -> (String, f64) {
    // Reduced motion uses the same settled arrangement, keeping all thoughts.
    let (position, scale) = phrase_pose(s, phrase);
    (
        format!(
            "translate({:.4} {:.4}) scale({scale:.5}) translate({:.4} {:.4})",
            position.0, position.1, -TEXT_X, -BASELINE
        ),
        scale,
    )
}
fn phrase_alpha(s: State, phrase: usize) -> f64 {
    if age(s, phrase) < 0. {
        return 0.;
    }
    // Detached phrases remain present until the shared scene reset.
    1. - 0.15 * distance(s, phrase)
}
fn phase(s: State) -> &'static str {
    match s.phrase {
        None => "restless",
        Some(p) if age(s, p) < SNAP_AT => "speaking",
        Some(p) if age(s, p) < FLIGHT_START + FLIGHT_DURATION => "separating",
        Some(2) => "calm",
        _ => "between-thoughts",
    }
}

fn set(
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
fn stroke_svg(out: &mut String, d: &str, class: &str, ink: &str, width: f64, opacity: f64) {
    let _ = write!(
        out,
        r#"<path class="{class}" d="{d}" fill="none" stroke="var(--book-{ink})" stroke-width="{width}" opacity="{opacity}" stroke-linecap="round" stroke-linejoin="round"/>"#
    );
}
// Outlines come from the exact bundled Disket Mono font at build time.
// The animated points flatten into a continuous thread before becoming letters.
mod typography {
    include!(concat!(env!("OUT_DIR"), "/spoken_glyphs.rs"));
}
const TEXT_X: f64 = 82.;
const BASELINE: f64 = 82.;
const FONT_SIZE: f64 = 10.66;
const ADVANCE: f64 = 7.626;
fn lines(phrase: usize) -> Vec<&'static str> {
    if phrase == 2 {
        vec!["Мне трудно", "об этом говорить"]
    } else {
        vec![PHRASES[phrase]]
    }
}
fn letters(phrase: usize) -> Vec<(char, usize, usize)> {
    lines(phrase)
        .into_iter()
        .enumerate()
        .flat_map(|(row, s)| {
            s.chars()
                .enumerate()
                .filter(|(_, c)| *c != ' ')
                .map(move |(col, c)| (c, row, col))
        })
        .collect()
}
fn letter_delay(index: usize, count: usize) -> f64 {
    index as f64 * LETTER_SPAN / (count.saturating_sub(1).max(1)) as f64
}
static SETTLED_GLYPHS: LazyLock<[Vec<String>; 3]> = LazyLock::new(|| {
    std::array::from_fn(|p| {
        letters(p)
            .into_iter()
            .enumerate()
            .map(|(i, (c, row, col))| {
                glyph_path_unfolding(c, row, col, i, p, state(STARTS[p] + 11.6, false))
            })
            .collect()
    })
});
fn glyph_path(c: char, row: usize, col: usize, index: usize, phrase: usize, s: State) -> String {
    if age(s, phrase) >= LETTER_START + letter_delay(index, letters(phrase).len()) + LETTER_UNFOLD {
        // Accumulated phrases reuse their final geometry instead of formatting
        // every outline point on every frame of the calm hold.
        return SETTLED_GLYPHS[phrase][index].clone();
    }
    glyph_path_unfolding(c, row, col, index, phrase, s)
}
fn glyph_path_unfolding(
    c: char,
    row: usize,
    col: usize,
    index: usize,
    phrase: usize,
    s: State,
) -> String {
    let age = age(s, phrase) - LETTER_START - letter_delay(index, letters(phrase).len());
    let morph = smooth(age / LETTER_UNFOLD);
    let anchor = TEXT_X + col as f64 * ADVANCE;
    let point = |x: f64, y: f64| {
        if morph == 1. {
            return (
                anchor + x * FONT_SIZE,
                BASELINE + row as f64 * 14. - y * FONT_SIZE,
            );
        }
        // A short tilted filament unfolds into the actual font contour, with
        // a restrained elastic settle. The final outline is exactly static.
        let lift = morph + 0.12 * (std::f64::consts::PI * morph).sin() * (1. - morph);
        let turn = -0.38 * (1. - morph);
        let local_x = (x - 0.35) * FONT_SIZE * (0.72 + 0.28 * morph);
        let local_y = -(y - 0.35) * FONT_SIZE * lift;
        let ripple = (morph * TAU + index as f64 * 0.45).sin() * (1. - morph) * 0.7;
        (
            anchor + FONT_SIZE * 0.35 - 1.8 * (1. - morph) + local_x * turn.cos()
                - local_y * turn.sin(),
            BASELINE + row as f64 * 14. - FONT_SIZE * 0.35
                + local_x * turn.sin()
                + local_y * turn.cos()
                + ripple,
        )
    };
    let mut d = String::new();
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
            let (x, y) = point(p[i * 2], p[i * 2 + 1]);
            let _ = write!(d, "{x:.3} {y:.3} ");
        }
    }
    d
}
fn mix(a: Point, b: Point, t: f64) -> Point {
    (a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t)
}
fn partial_cubic(p: [Point; 4], t: f64) -> [Point; 4] {
    let a = mix(p[0], p[1], t);
    let b = mix(p[1], p[2], t);
    let c = mix(p[2], p[3], t);
    let d = mix(a, b, t);
    let e = mix(b, c, t);
    [p[0], a, d, mix(d, e, t)]
}
fn thread_path(clock: f64, progress: f64) -> (String, Point) {
    thread_shape(clock, progress, 0.)
}
fn thread_curves(clock: f64) -> [[Point; 4]; 2] {
    [
        [(55., 24.), (61., 24.), (61., 34.), (69., 36.)],
        [
            (69., 36.),
            (81., 39. + (clock * 1.7).sin() * 0.6),
            (89., 35. + (clock * 1.3).sin() * 0.5),
            (98.9, 36.),
        ],
    ]
}
fn thread_shape(clock: f64, progress: f64, recoil: f64) -> (String, Point) {
    let curves = thread_curves(clock);
    let progress = progress.clamp(0., 1.);
    let mut out = String::from("M55 24");
    let mut tip = curves[0][0];
    for (index, curve) in curves.into_iter().enumerate() {
        let u = if index == 0 {
            (progress / 0.48).min(1.)
        } else {
            ((progress - 0.48) / 0.52).clamp(0., 1.)
        };
        if u == 0. {
            break;
        }
        let [_, a, mut b, mut end] = partial_cubic(curve, u);
        if u < 1. {
            b.1 -= recoil * 0.45;
            end.1 -= recoil;
        }
        let _ = write!(
            out,
            "C{:.3} {:.3} {:.3} {:.3} {:.3} {:.3}",
            a.0, a.1, b.0, b.1, end.0, end.1
        );
        tip = end;
    }
    (out, tip)
}
fn thread_tail(clock: f64, from: f64, recoil: f64) -> (String, Point) {
    if from >= 1. {
        return ("M98.9 36".into(), (98.9, 36.));
    }
    let mut reversed = thread_curves(clock)[1];
    reversed.reverse();
    let mut suffix = partial_cubic(reversed, 1. - from.clamp(0., 1.));
    suffix.reverse();
    let [mut start, mut a, b, end] = suffix;
    start.1 += recoil;
    a.1 += recoil * 0.45;
    (
        format!(
            "M{:.3} {:.3}C{:.3} {:.3} {:.3} {:.3} {:.3} {:.3}",
            start.0, start.1, a.0, a.1, b.0, b.1, end.0, end.1
        ),
        start,
    )
}
fn thoughts(index: usize, t: f64, calm: f64) -> String {
    // Smooth independent loops, kept inside the approved head. Their unequal
    // frequencies avoid a rigid wire grid or identical oscillating scribbles.
    let phase = index as f64 * 2.17;
    let drift = t * (1. - calm) * 0.45;
    let pts: Vec<Point> = (0..34)
        .map(|k| {
            let u = k as f64 / 33. * TAU;
            let radius = 4.8 + 1.4 * (u * 1.9 + phase + drift * 0.3).sin();
            (
                55. + (u * 2.3 + phase + drift).cos() * radius + (u * 0.7 + phase).sin() * 1.8,
                23.5 + (u * 2.7 + phase * 0.4 - drift * 0.6).sin() * radius,
            )
        })
        .collect();
    let mut d = format!("M{:.3} {:.3}", pts[0].0, pts[0].1);
    for i in 0..pts.len() - 1 {
        let p0 = pts[i.saturating_sub(1)];
        let p1 = pts[i];
        let p2 = pts[i + 1];
        let p3 = pts[(i + 2).min(pts.len() - 1)];
        let _ = write!(
            d,
            "C{:.3} {:.3} {:.3} {:.3} {:.3} {:.3}",
            p1.0 + (p2.0 - p0.0) / 6.,
            p1.1 + (p2.1 - p0.1) / 6.,
            p2.0 - (p3.0 - p1.0) / 6.,
            p2.1 - (p3.1 - p1.1) / 6.,
            p2.0,
            p2.1
        );
    }
    d
}
pub fn svg() -> String {
    // The approved file is kept byte-for-byte. Only presentation and a wrapper
    // around its calm thought curve are added; no approved path is rewritten.
    const FIGURE: &str = include_str!("../assets/spoken-thought-person.svg");
    let start = FIGURE.find("<g id=\"reference-ink\"").unwrap();
    let end = FIGURE.rfind("</g>").unwrap() + 4;
    let body = FIGURE[start..end].replace("fill=\"#ffff00\"", "fill=\"var(--book-ink)\"");
    let doc = roxmltree::Document::parse(FIGURE).unwrap();
    let outline = doc
        .descendants()
        .find(|n| n.attribute("id") == Some("silhouette-hands-and-chair"))
        .unwrap()
        .attribute("d")
        .unwrap();
    let outer_end = outline[1..]
        .find('M')
        .map(|i| i + 1)
        .unwrap_or(outline.len());
    let outer = &outline[..outer_end];
    let calm = doc
        .descendants()
        .find(|n| n.attribute("id") == Some("head-thought-curve"))
        .unwrap();
    let original = &FIGURE[calm.range()];
    let body = body.replace(
        original,
        &format!("<g class=\"spoken-calm\">{original}</g>"),
    );
    let mut out = String::from(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 192" fill="none"><desc>Три примера произнесённых мыслей: Я боюсь ошибиться; Я не знаю, с чего начать; Мне трудно об этом говорить. Слова отделяются от человека, пространство проясняется.</desc><defs><clipPath id="spoken-head-clip"><path d="M43 24C41 17 47 12 55 12C63 12 67 16 67 24L66 30H44Z"/></clipPath></defs><g class="spoken-stage">"##,
    );
    out.push_str(&crate::spoken_room::svg());
    out.push_str(&crate::spoken_room::chair_depth_svg());
    let _ = write!(
        out,
        r##"<g class="spoken-approved-person" transform="translate(33 59) scale(.23)"><path class="spoken-person-occlusion" d="{outer}" fill="#000"/>"##
    );
    out.push_str(&body);
    out.push_str(r##"</g><g class="spoken-content"><g class="spoken-head-motion" transform="matrix(.6764705882 0 0 .6764705882 15.411764706 53.588235294)"><g clip-path="url(#spoken-head-clip)">"##);
    for i in 0..4 {
        stroke_svg(
            &mut out,
            &thoughts(i, 0., 0.),
            &format!("spoken-tangle-{i}"),
            "ink",
            0.35,
            0.7,
        );
    }
    out.push_str("</g>");
    stroke_svg(
        &mut out,
        "M55 24C61 24 61 34 69 36C81 39 89 36 98.9 36",
        "spoken-thread",
        "ink",
        0.60,
        0.,
    );
    out.push_str("<g class=\"spoken-thread-tail-anchor\">");
    stroke_svg(&mut out, "M98.9 36", "spoken-thread-tail", "ink", 0.60, 0.);
    out.push_str("</g>");
    out.push_str(r#"<circle class="spoken-thread-tip" cx="55" cy="24" r=".46" fill="var(--book-ink)" opacity="0"/>"#);
    out.push_str("</g>");
    for p in 0..PHRASES.len() {
        let _ = write!(
            out,
            r#"<g class="spoken-phrase-{p}" opacity="0" aria-label="{}">"#,
            PHRASES[p]
        );
        for (i, (c, row, col)) in letters(p).iter().enumerate() {
            let d = glyph_path(*c, *row, *col, i, p, state(STARTS[p] + 11.6, false));
            stroke_svg(
                &mut out,
                &d,
                &format!("spoken-letter-edge-{p}-{i}"),
                "ink",
                0.22,
                0.,
            );
            let _ = write!(
                out,
                r#"<path class="spoken-letter-{p}-{i}" d="{d}" fill="var(--book-ink)" fill-rule="nonzero" opacity="0"/>"#
            );
        }
        out.push_str("</g>");
    }
    out.push_str("</g></g></svg>");
    crate::scene_edges::wrap(&out, 22., 18.)
}
pub fn frame(seconds: f64, reduced: bool) -> Vec<Update> {
    let reduced = reduced || !seconds.is_finite();
    let s = state(seconds, reduced);
    // Each utterance resolves another part of the same space. The early reveal
    // remains local; the final thought completes the room and settles the head.
    let clarity = s.calm;
    let mut out = crate::spoken_room::frame(s.t, clarity * s.alpha, s.alpha, reduced);
    set(&mut out, ".spoken-content", "opacity", s.alpha);
    set(&mut out, ".spoken-stage", "data-phase", phase(s));
    set(
        &mut out,
        ".spoken-stage",
        "data-phrase-index",
        s.phrase.map_or(-1, |p| p as i32),
    );
    set(
        &mut out,
        ".spoken-stage",
        "data-phrase",
        s.phrase.map_or("", |p| PHRASES[p]),
    );
    let clock = if reduced { 0. } else { s.t };
    for i in 0..4 {
        set(
            &mut out,
            format!(".spoken-tangle-{i}"),
            "d",
            thoughts(i, clock, s.calm),
        );
        set(
            &mut out,
            format!(".spoken-tangle-{i}"),
            "opacity",
            (1. - s.calm) * 0.65,
        );
    }
    set(&mut out, ".spoken-calm", "opacity", s.calm);
    let utterance_age = s.phrase.map_or(-1., |p| age(s, p));
    let elapsed_break = (utterance_age - SNAP_AT).max(0.);
    let snapped = utterance_age >= SNAP_AT;
    let progress = if snapped {
        (0.48 + 0.52 * 0.55) * (1. - smooth(elapsed_break / 1.55))
    } else {
        smooth(utterance_age / 0.95)
    };
    let recoil = if snapped {
        3.4 * (std::f64::consts::PI * (elapsed_break / 1.2).clamp(0., 1.)).sin()
    } else {
        0.
    };
    let thread = if utterance_age < 0. { 0. } else { 0.85 };
    // No opacity dissolve: two real path sections separate, recoil and
    // retract into their ends. Their lengths reach zero before the next phrase.
    set(&mut out, ".spoken-thread", "opacity", thread);
    set(&mut out, ".spoken-thread-tail", "opacity", thread);
    let (thread_d, tip) = if recoil == 0. {
        thread_path(clock, progress)
    } else {
        thread_shape(clock, progress, recoil)
    };
    let (tail_d, tail_tip) = if snapped {
        thread_tail(clock, 0.55 + 0.45 * smooth(elapsed_break / 1.1), recoil)
    } else {
        ("M98.9 36".into(), (98.9, 36.))
    };
    set(&mut out, ".spoken-thread", "d", thread_d);
    set(&mut out, ".spoken-thread-tail", "d", tail_d);
    set(&mut out, ".spoken-thread", "data-progress", progress);
    set(
        &mut out,
        ".spoken-thread",
        "data-gap",
        if snapped {
            (tail_tip.0 - tip.0).hypot(tail_tip.1 - tip.1)
        } else {
            0.
        },
    );
    set(
        &mut out,
        ".spoken-stage",
        "data-thread-state",
        if utterance_age < 0. {
            "waiting"
        } else if utterance_age < 0.95 {
            "drawing"
        } else if !snapped {
            "connected"
        } else if elapsed_break < 1.55 {
            "breaking"
        } else {
            "retracted"
        },
    );
    let (position, scale) = s
        .phrase
        .map_or(((TEXT_X, BASELINE), 1.), |p| phrase_pose(s, p));
    let tail_transform = format!(
        "matrix({scale:.5} 0 0 {scale:.5} {:.5} {:.5})",
        ((scale - 1.) * (HEAD_OFFSET.0 - TEXT_X) + position.0 - TEXT_X) / HEAD_SCALE,
        ((scale - 1.) * (HEAD_OFFSET.1 - BASELINE) + position.1 - BASELINE) / HEAD_SCALE
    );
    set(
        &mut out,
        ".spoken-thread-tail-anchor",
        "transform",
        tail_transform,
    );
    set(&mut out, ".spoken-thread-tip", "cx", tip.0);
    set(&mut out, ".spoken-thread-tip", "cy", tip.1);
    set(
        &mut out,
        ".spoken-thread-tip",
        "opacity",
        if snapped {
            0.
        } else {
            thread * 0.55 * (1. - smooth((progress - 0.8) / 0.2))
        },
    );
    for p in 0..PHRASES.len() {
        let alpha = phrase_alpha(s, p);
        set(&mut out, format!(".spoken-phrase-{p}"), "opacity", alpha);
        let (transform, scale) = phrase_transform(s, p, reduced);
        set(
            &mut out,
            format!(".spoken-phrase-{p}"),
            "transform",
            transform,
        );
        set(&mut out, format!(".spoken-phrase-{p}"), "data-scale", scale);
        set(
            &mut out,
            format!(".spoken-phrase-{p}"),
            "data-distance",
            distance(s, p),
        );
        set(
            &mut out,
            format!(".spoken-phrase-{p}"),
            "data-detach",
            detach(s, p),
        );
        if alpha == 0. {
            continue;
        }
        let glyphs = letters(p);
        for (i, (c, row, col)) in glyphs.iter().enumerate() {
            let selector = format!(".spoken-letter-{p}-{i}");
            let edge = format!(".spoken-letter-edge-{p}-{i}");
            let d = glyph_path(*c, *row, *col, i, p, s);
            let unfold = ((age(s, p) - LETTER_START - letter_delay(i, glyphs.len()))
                / LETTER_UNFOLD)
                .clamp(0., 1.);
            set(&mut out, &selector, "d", &d);
            set(&mut out, selector, "opacity", smooth(unfold / 0.60));
            set(&mut out, &edge, "d", if unfold >= 1. { "M0 0" } else { &d });
            set(
                &mut out,
                edge,
                "opacity",
                if unfold >= 1. {
                    0.
                } else {
                    0.8 * (std::f64::consts::PI * unfold).sin().max(0.)
                },
            );
        }
    }
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    fn value(updates: &[Update], sel: &str, attr: &str) -> String {
        updates
            .iter()
            .find(|u| u.selector == sel && u.attribute == attr)
            .unwrap()
            .value
            .clone()
    }
    #[test]
    fn three_distinct_utterances_leave_space_and_end_in_calm() {
        let mut last_clarity = 0.;
        for (p, start) in STARTS.iter().enumerate() {
            let speaking = frame(start + 4., false);
            assert_eq!(value(&speaking, ".spoken-stage", "data-phrase"), PHRASES[p]);
            assert_eq!(value(&speaking, ".spoken-stage", "data-phase"), "speaking");
            assert!(
                value(&speaking, ".spoken-thread", "opacity")
                    .parse::<f64>()
                    .unwrap()
                    > 0.
            );
            let separated = frame(start + 11.7, false);
            assert_eq!(
                value(&separated, &format!(".spoken-phrase-{p}"), "data-detach"),
                "1"
            );
            assert_eq!(value(&separated, ".spoken-thread", "d"), "M55 24");
            assert_eq!(value(&separated, ".spoken-thread-tail", "d"), "M98.9 36");
            let clarity = value(&separated, ".spoken-room", "data-clarity")
                .parse::<f64>()
                .unwrap();
            assert!(clarity > last_clarity);
            last_clarity = clarity;
        }
        for i in 0..=1120 {
            let s = state(i as f64 / 20., false);
            for p in 0..3 {
                assert_eq!(
                    phrase_alpha(s, p) > 0.,
                    age(s, p) >= 0.,
                    "Every already spoken thought stays in the room"
                );
            }
            for u in frame(i as f64 / 20., false) {
                assert!(!u.value.contains("NaN") && !u.value.contains("inf"));
                if u.attribute == "opacity" {
                    assert!((0. ..=1.).contains(&u.value.parse::<f64>().unwrap()));
                }
            }
        }
        for t in [45., 48., 51.9] {
            assert_eq!(phase(state(t, false)), "calm");
        }
        assert_eq!(state(54., false).alpha, 0.);
        assert_eq!(frame(0., false), frame(PERIOD, false));
    }
    #[test]
    fn accessible_still_and_every_word_have_real_font_outlines() {
        let f = frame(0., true);
        assert_eq!(f, frame(999., true));
        assert_eq!(f, frame(f64::NAN, false));
        assert_eq!(value(&f, ".spoken-stage", "data-phase"), "calm");
        assert_eq!(value(&f, ".spoken-stage", "data-phrase"), PHRASES[2]);
        for (p, start) in STARTS.iter().enumerate() {
            let glyphs = letters(p);
            for (i, (c, row, col)) in glyphs.iter().enumerate() {
                assert!(!typography::glyph(*c).is_empty(), "missing glyph {c}");
                assert_ne!(
                    glyph_path(*c, *row, *col, i, p, state(start + 1., false)),
                    glyph_path(*c, *row, *col, i, p, state(start + 10., false))
                );
                assert!(
                    TEXT_X + 26. + *col as f64 * ADVANCE + FONT_SIZE < 308.,
                    "phrase fits the scene"
                );
            }
        }
    }
    #[test]
    fn vector_room_and_every_animation_target_exist() {
        let s = svg();
        let doc = roxmltree::Document::parse(&s).unwrap();
        assert!(
            !s.contains("<image") && s.contains("spoken-room") && s.contains("data-rust-matrix-uv")
        );
        for t in [0., 8., 22., 37., 48., 54.] {
            for u in frame(t, false) {
                assert!(
                    doc.descendants()
                        .any(|n| n.attribute("class") == Some(u.selector.trim_start_matches('.'))),
                    "{}",
                    u.selector
                );
            }
        }
        assert_eq!(value(&frame(4., false), ".spoken-thread", "d"), "M55 24");
        assert!(value(&frame(8., false), ".spoken-thread", "d").contains("98.900 36.000"));
    }

    #[test]
    fn approved_geometry_is_exact_and_never_animated_as_paths() {
        let source =
            roxmltree::Document::parse(include_str!("../assets/spoken-thought-person.svg"))
                .unwrap();
        let scene = svg();
        let rendered = roxmltree::Document::parse(&scene).unwrap();
        let paths: Vec<_> = source
            .descendants()
            .filter(|n| n.has_tag_name("path"))
            .collect();
        assert_eq!(paths.len(), 9);
        for p in paths {
            let id = p.attribute("id").unwrap();
            let actual = rendered
                .descendants()
                .find(|n| n.attribute("id") == Some(id))
                .unwrap();
            assert_eq!(p.attribute("d"), actual.attribute("d"), "approved {id}");
        }
        for t in [0., 8., 14., 22., 30., 37., 48., 54., 55.] {
            for update in frame(t, false) {
                assert!(!update.selector.contains("person") && !update.selector.contains("chest"));
                assert!(!(update.selector == ".spoken-calm" && update.attribute == "d"));
            }
        }
        assert!(!frame(27.5, false)
            .iter()
            .any(|u| u.selector == ".spoken-stage" && u.attribute == "opacity"));
    }

    #[test]
    fn thread_grows_then_breaks_and_words_stay_nearby() {
        let start = thread_path(0., 0.);
        let partial = thread_path(0., 0.4);
        let end = thread_path(0., 1.);
        assert_eq!(start.1, (55., 24.));
        assert!(partial.1 .0 > 55. && partial.1 .0 < 69.);
        assert_eq!(end.1, (98.9, 36.));
        assert_ne!(partial.0, end.0);
        for (p, start) in STARTS.iter().enumerate() {
            let near = state(start + 4., false);
            let far = state(start + 10., false);
            assert_eq!(phrase_transform(near, p, false).1, 1.);
            assert!((phrase_transform(far, p, false).1 - PARKING[p].1).abs() < 1e-8);
            assert!(
                phrase_alpha(far, p) > 0.8,
                "Words remain visible after receding"
            );
            assert_eq!(
                phrase_transform(far, p, true).1,
                phrase_transform(far, p, false).1,
                "Accessible still preserves the full settled arrangement"
            );
            let middle = state(start + 7., false);
            assert!(
                phrase_transform(middle, p, false).1 > PARKING[p].1
                    && phrase_transform(middle, p, false).1 < 1.
            );
            let before = frame(start + SNAP_AT - 0.01, false);
            let broken = frame(start + SNAP_AT + 0.4, false);
            assert_eq!(value(&before, ".spoken-thread-tail", "d"), "M98.9 36");
            assert_eq!(
                value(&broken, ".spoken-stage", "data-thread-state"),
                "breaking"
            );
            assert_eq!(
                value(&before, ".spoken-thread", "opacity"),
                value(&broken, ".spoken-thread", "opacity")
            );
            assert!(
                value(&broken, ".spoken-thread", "data-gap")
                    .parse::<f64>()
                    .unwrap()
                    > 8.
            );
            assert!(value(&broken, ".spoken-thread-tail", "d").contains('C'));
        }
        for t in [15.5, 17., 18.] {
            assert!((state(t, false).calm - 1. / 3.).abs() < 1e-8);
        }
        for t in [30., 31., 32.] {
            assert!((state(t, false).calm - 2. / 3.).abs() < 1e-8);
        }
        assert_eq!(state(48., false).calm, 1.);
    }

    #[test]
    fn phrases_finish_early_and_accumulate_without_colliding() {
        for (p, start) in STARTS.iter().enumerate() {
            let full = frame(start + 2.7, false);
            let settled = frame(start + 11.7, false);
            for i in 0..letters(p).len() {
                assert_eq!(
                    value(&full, &format!(".spoken-letter-{p}-{i}"), "opacity"),
                    "1"
                );
                assert_eq!(
                    value(&full, &format!(".spoken-letter-{p}-{i}"), "d"),
                    value(&settled, &format!(".spoken-letter-{p}-{i}"), "d")
                );
            }
        }
        let settled = state(48., false);
        let boxes: Vec<_> = (0..3)
            .map(|p| {
                assert!(phrase_alpha(settled, p) >= 0.85);
                let (anchor, scale) = phrase_pose(settled, p);
                assert!(scale >= 0.78);
                let rows = lines(p);
                let width =
                    rows.iter().map(|s| s.chars().count()).max().unwrap() as f64 * ADVANCE * scale;
                (
                    anchor.0,
                    anchor.1 - FONT_SIZE * scale,
                    anchor.0 + width,
                    anchor.1 + (rows.len() - 1) as f64 * 14. * scale,
                )
            })
            .collect();
        for (i, a) in boxes.iter().enumerate() {
            assert!(a.0 >= 82. && a.2 < 300. && a.1 > 20. && a.3 < 165.);
            for b in boxes.iter().skip(i + 1) {
                assert!(
                    a.2 < b.0 || b.2 < a.0 || a.3 + 5. < b.1 || b.3 + 5. < a.1,
                    "Settled phrases overlap"
                );
            }
        }
    }
}
