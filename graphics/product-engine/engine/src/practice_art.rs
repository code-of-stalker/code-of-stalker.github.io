//! Practice companions 4–6: approved figures moved vertex by vertex, a quiet
//! corridor and glyph words in the application font. Reduced motion is a still.
use crate::{family_artwork::Contour, step_three::Update};
use std::{
    f64::consts::{PI, TAU},
    fmt::Write,
    sync::LazyLock,
};
type P = (f64, f64);
pub const PERIOD: f64 = 20.;
const UNSEAL: &str = include_str!("../assets/unseal-reference.svg");
const SHOULDERS: [P; 2] = [(1230., 294.), (1305., 297.)];
const UNSEAL_THROAT: P = (1268., 262.);
const UNSEAL_HEART: P = (1270., 335.);
const HEROINE_THROAT: P = (528., 236.);

pub fn contains(kind: &str) -> bool {
    matches!(
        kind,
        "practice-trinity" | "practice-awareness" | "practice-listening"
    )
}
fn ease(v: f64) -> f64 {
    let v = v.clamp(0., 1.);
    v * v * v * (v * (v * 6. - 15.) + 10.)
}
fn ramp(t: f64, a: f64, b: f64) -> f64 {
    ease((t - a) / (b - a))
}
fn time(seconds: f64, reduced: bool) -> f64 {
    if reduced || !seconds.is_finite() {
        14.
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    }
}
/// Four calm breaths per loop, so the cycle closes without a seam.
fn breath(t: f64, reduced: bool) -> f64 {
    if reduced {
        0.5
    } else {
        0.5 - 0.5 * (t * TAU / 5.).cos()
    }
}
fn ellipse(c: P, rx: f64, ry: f64) -> String {
    let mut d = String::new();
    for i in 0..48 {
        let a = i as f64 / 48. * TAU;
        let _ = write!(
            d,
            "{}{:.3} {:.3}",
            if i == 0 { 'M' } else { 'L' },
            c.0 + rx * a.cos(),
            c.1 + ry * a.sin()
        );
    }
    d.push('Z');
    d
}
fn rotate(p: P, at: P, a: f64) -> P {
    let (s, c) = a.sin_cos();
    (
        at.0 + (p.0 - at.0) * c - (p.1 - at.1) * s,
        at.1 + (p.0 - at.0) * s + (p.1 - at.1) * c,
    )
}

/// The approved standing contour, in file painter order: cover, then ink.
static FIGURE: LazyLock<Vec<(String, Contour)>> = LazyLock::new(|| {
    let doc = roxmltree::Document::parse(UNSEAL).expect("approved unseal contour");
    doc.descendants()
        .filter(|n| n.has_tag_name("path"))
        .map(|n| (n.attribute("id").unwrap().to_owned(), Contour::new(n.attribute("d").unwrap())))
        .collect()
});
#[derive(Clone, Copy)]
struct Placement {
    origin: P,
    scale: f64,
}
impl Placement {
    fn at(&self, p: P) -> P {
        (self.origin.0 + p.0 * self.scale, self.origin.1 + p.1 * self.scale)
    }
}
/// Chest rise and an open, receiving gesture. Legs and soles never move.
fn unseal_point(p: P, id: &str, breath: f64, open: f64) -> P {
    if id.contains("leg") {
        return p;
    }
    // Zero below 470 keeps the pelvis seam with the static legs closed.
    let chest = (1. - ((p.1 - 340.) / 130.).abs()).clamp(0., 1.);
    let mut q = (p.0 + (p.0 - 1270.) * chest * breath * 0.025, p.1 - chest * breath * 4.5);
    let head = 1. - ease((p.1 - 250.) / 60.);
    q.1 -= head * breath * 3.;
    if id.starts_with("near-arm") {
        q = rotate(q, (SHOULDERS[0].0, SHOULDERS[0].1 - breath * 3.), open * 0.13);
    } else if id.starts_with("far-arm") {
        q = rotate(q, (SHOULDERS[1].0, SHOULDERS[1].1 - breath * 3.), -open * 0.13);
    }
    q
}
fn figure_svg(out: &mut String, prefix: &str, at: Placement) {
    for (i, (id, c)) in FIGURE.iter().enumerate() {
        let ink = id.ends_with("ink");
        let _ = write!(
            out,
            r#"<path class="{prefix}-fig-{i}" d="{}" fill="{}" fill-rule="evenodd"{}/>"#,
            c.map(|p| at.at(unseal_point(p, id, 0.5, 0.))),
            if ink { "var(--book-ink)" } else { "var(--book-cover)" },
            if ink {
                r#" stroke="var(--book-ink)" stroke-width=".18" stroke-linejoin="round""#
            } else {
                ""
            }
        );
    }
}
fn figure_frame(out: &mut Vec<Update>, prefix: &str, at: Placement, breath: f64, open: f64) {
    for (i, (id, c)) in FIGURE.iter().enumerate() {
        out.push(Update {
            selector: format!(".{prefix}-fig-{i}"),
            attribute: "d",
            value: c.map(|p| at.at(unseal_point(p, id, breath, open))),
        });
    }
}
fn heroine_pose(t: f64, breath: f64) -> crate::breath_heroine::Pose {
    crate::breath_heroine::Pose {
        breath: breath * 0.6 - 0.3,
        time: t,
        ..Default::default()
    }
}
fn heroine_throat(t: f64, breath: f64, at: Placement) -> P {
    at.at(crate::breath_heroine::Rig::new(heroine_pose(t, breath)).point(HEROINE_THROAT, 2))
}

/// Corridor of the step-three scenes: walls, floor rays, Matrix code, and
/// light travelling on the floor and walls instead of architecture moving.
const WALLS: [f64; 4] = [22., 48., 70., 88.];
fn corridor(out: &mut String, prefix: &str) {
    out.push_str(r#"<path d="M16 8H304V138H16Z" data-rust-matrix-uv=".003472 0 -.05556 0 .007692 -.06154 0 0 1" fill="none" stroke="none" opacity=".07"/>"#);
    out.push_str(r#"<g fill="none" stroke="var(--book-dim)" stroke-linecap="round"><path d="M104 40H216V128H104ZM0 0L104 40M320 0L216 40M0 192L104 128M320 192L216 128" stroke-width=".4" opacity=".55"/>"#);
    for k in 0..9 {
        let _ = write!(
            out,
            r#"<path d="M{} 128L{} 192" stroke-width=".3" opacity=".35"/>"#,
            104. + 14. * k as f64,
            -40. + 50. * k as f64
        );
    }
    for y in [136., 147., 163., 186.] {
        let x = (192. - y) * 1.625;
        let _ = write!(out, r#"<path d="M{x} {y}H{}" stroke-width=".25" opacity=".3"/>"#, 320. - x);
    }
    for x in WALLS {
        for x in [x, 320. - x] {
            let edge = x.min(320. - x);
            let _ = write!(
                out,
                r#"<path d="M{x} {}V{}" stroke-width=".35" opacity=".45"/>"#,
                40. * edge / 104.,
                192. - 64. * edge / 104.
            );
        }
    }
    out.push_str("</g>");
    let _ = write!(out, r#"<g fill="none" stroke="var(--book-ink)" stroke-linecap="round">"#);
    for i in 0..4 {
        let _ = write!(out, r#"<path class="{prefix}-floor-{i}" d="M0 0" stroke-width=".55" opacity="0"/>"#);
    }
    for i in 0..8 {
        let _ = write!(out, r#"<path class="{prefix}-scan-{i}" d="M0 0" stroke-width=".7" opacity="0"/>"#);
    }
    out.push_str("</g>");
}
fn corridor_frame(out: &mut Vec<Update>, prefix: &str, t: f64, reduced: bool) {
    for i in 0..4 {
        let p = if reduced { 0.5 } else { (t / 10. + i as f64 / 4.).fract() };
        let y = 128. + 64. * p * p;
        let x = (192. - y) * 1.625;
        out.push(Update {
            selector: format!(".{prefix}-floor-{i}"),
            attribute: "d",
            value: format!("M{x:.3} {y:.3}H{:.3}", 320. - x),
        });
        out.push(Update {
            selector: format!(".{prefix}-floor-{i}"),
            attribute: "opacity",
            value: if reduced {
                "0".into()
            } else {
                format!("{:.4}", 0.32 * (PI * p).sin().powi(2))
            },
        });
    }
    for i in 0..8 {
        let x = WALLS[i % 4];
        let x = if i < 4 { x } else { 320. - x };
        let edge = x.min(320. - x);
        let (top, bottom) = (40. * edge / 104., 192. - 64. * edge / 104.);
        let phase = if reduced { 0.5 } else { (t / 10. + i as f64 * 0.37).fract() };
        let y = top + (bottom - top - 16.) * phase;
        out.push(Update {
            selector: format!(".{prefix}-scan-{i}"),
            attribute: "d",
            value: format!("M{x} {y:.3}v16"),
        });
        out.push(Update {
            selector: format!(".{prefix}-scan-{i}"),
            attribute: "opacity",
            value: if reduced {
                ".12".into()
            } else {
                format!("{:.4}", 0.4 * (PI * phase).sin())
            },
        });
    }
}

fn word(out: &mut String, class: &str, text: &str, cx: f64, y: f64, size: f64) {
    let _ = write!(
        out,
        r#"<g class="{class}" opacity="0" aria-label="{text}"><path d="{}" fill="var(--book-ink)"/></g>"#,
        crate::practice_dialogue::text_path(text, cx, y, size)
    );
}
fn word_frame(out: &mut Vec<Update>, class: &str, alpha: f64) {
    out.push(Update {
        selector: format!(".{class}"),
        attribute: "opacity",
        value: format!("{alpha:.4}"),
    });
    out.push(Update {
        selector: format!(".{class}"),
        attribute: "transform",
        value: format!("translate(0 {:.3})", (1. - alpha.min(1.)) * 2.),
    });
}
fn glow_defs(out: &mut String, id: &str) {
    let _ = write!(
        out,
        r#"<defs><radialGradient id="{id}-glow"><stop stop-color="var(--book-line)" stop-opacity=".9"/><stop offset=".25" stop-color="var(--book-ink)" stop-opacity=".45"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="{id}-halo"><stop stop-color="var(--book-line)" stop-opacity=".2"/><stop offset="1" stop-color="var(--book-line)" stop-opacity="0"/></radialGradient></defs>"#
    );
}
fn open(prefix: &str, desc: &str) -> String {
    let mut out = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 192" fill="none"><desc>{desc}</desc>"#
    );
    glow_defs(&mut out, prefix);
    out.push_str(r#"<g stroke-linecap="round" stroke-linejoin="round">"#);
    corridor(&mut out, prefix);
    out
}
fn close(mut out: String) -> String {
    out.push_str("</g></svg>");
    crate::scene_edges::wrap(&out, 16., 12.)
}

// 4. The Father is the Absolute, the Son is the form, and Breath joins them.
const TRINITY: Placement = Placement {
    origin: (5.7, 72.9),
    scale: 0.1208,
};
const FATHER: P = (160., 40.);
const TRINITY_WORDS: [(&str, f64, f64, f64); 3] = [
    ("ОТЕЦ", 214., 43., 1.5),
    ("СЫН", 206., 124., 5.5),
    ("ДУХ", 110., 82., 9.5),
];
fn breath_loop(s: f64, throat: P) -> P {
    let a = s * TAU;
    let mid = (throat.1 + FATHER.1 + 17.) / 2.;
    let half = (throat.1 - FATHER.1 - 17.) / 2.;
    (160. - 10. * a.sin() * (0.6 + 0.4 * a.cos().abs()), mid + half * a.cos())
}
fn trinity_svg() -> String {
    let mut out = open("tri", "Отец — Абсолют, Сын — форма, Дух — дыхание, которое их соединяет.");
    let throat = TRINITY.at(UNSEAL_THROAT);
    let _ = write!(
        out,
        r#"<ellipse class="tri-unity" cx="160" cy="96" rx="58" ry="80" fill="url(#tri-halo)" opacity="0"/><g class="tri-father-glow" opacity=".5"><circle cx="{0}" cy="{1}" r="34" fill="url(#tri-halo)"/></g><circle cx="{0}" cy="{1}" r="17" stroke="var(--book-line)" stroke-width=".6" fill="var(--book-cover)"/><circle cx="{0}" cy="{1}" r="11" stroke="var(--book-dim)" stroke-width=".4"/><circle cx="{0}" cy="{1}" r="2.2" fill="var(--book-ink)"/><g class="tri-ticks" stroke="var(--book-ink)" stroke-width=".45" opacity=".6">"#,
        FATHER.0, FATHER.1
    );
    for i in 0..24 {
        let a = i as f64 / 24. * TAU;
        let (r0, r1) = if i % 6 == 0 { (19.5, 24.) } else { (20.5, 22.5) };
        let _ = write!(
            out,
            r#"<path d="M{:.3} {:.3}L{:.3} {:.3}"/>"#,
            FATHER.0 + r0 * a.cos(),
            FATHER.1 + r0 * a.sin(),
            FATHER.0 + r1 * a.cos(),
            FATHER.1 + r1 * a.sin()
        );
    }
    out.push_str("</g>");
    let mut d = String::new();
    for i in 0..=64 {
        let p = breath_loop(i as f64 / 64., throat);
        let _ = write!(d, "{}{:.3} {:.3}", if i == 0 { 'M' } else { 'L' }, p.0, p.1);
    }
    let _ = write!(
        out,
        r#"<path d="{d}" stroke="var(--book-dim)" stroke-width=".4" opacity=".6"/><path class="tri-loop" d="{d}" stroke="var(--book-line)" stroke-width=".6" opacity="0"/>"#
    );
    out.push_str(r#"<g stroke="var(--book-line)" stroke-width=".6" stroke-dasharray="3 2"><path class="tri-veil-0" d="M104 74H146"/><path class="tri-veil-1" d="M174 74H216"/></g>"#);
    figure_svg(&mut out, "tri", TRINITY);
    let _ = write!(
        out,
        r#"<g class="tri-throat" transform="translate({:.3} {:.3})"><circle r="9" fill="url(#tri-glow)"/><circle r=".8" fill="var(--book-line)"/></g>"#,
        throat.0, throat.1
    );
    for i in 0..8 {
        let _ = write!(out, r#"<circle class="tri-mote-{i}" r="1" fill="var(--book-line)" opacity="0"/>"#);
    }
    for (i, (text, x, y, _)) in TRINITY_WORDS.iter().enumerate() {
        word(&mut out, &format!("tri-word-{i}"), text, *x, *y, 6.5);
    }
    close(out)
}
fn trinity_frame(t: f64, reduced: bool) -> Vec<Update> {
    let b = breath(t, reduced);
    let mut out = Vec::new();
    corridor_frame(&mut out, "tri", t, reduced);
    let unity = ramp(t, 10.5, 13.) * (1. - ramp(t, 17., 19.5));
    let flow = ramp(t, 3., 5.) * (1. - ramp(t, 18., 19.6));
    let release = ramp(t, 4.5, 8.5) * (1. - ramp(t, 17.5, 19.8));
    figure_frame(&mut out, "tri", TRINITY, b, unity);
    let mut set = |selector: &str, attribute, value: String| {
        out.push(Update {
            selector: selector.into(),
            attribute,
            value,
        })
    };
    set(".tri-unity", "opacity", format!("{:.4}", unity * 0.9));
    set(".tri-father-glow", "opacity", format!("{:.4}", 0.4 + 0.25 * b + 0.35 * unity));
    set(
        ".tri-ticks",
        "transform",
        format!("rotate({:.3} {} {})", if reduced { 0. } else { t / PERIOD * 90. }, FATHER.0, FATHER.1),
    );
    set(".tri-loop", "opacity", format!("{:.4}", flow * (0.35 + 0.3 * b)));
    for (i, side) in [-1., 1.].iter().enumerate() {
        let selector = format!(".tri-veil-{i}");
        set(&selector, "transform", format!("translate({:.3} {:.3})", side * 26. * release, -4. * release));
        set(&selector, "opacity", format!("{:.4}", 0.55 * (1. - release)));
    }
    let throat = TRINITY.at(unseal_point(UNSEAL_THROAT, "trunk", b, unity));
    set(
        ".tri-throat",
        "transform",
        format!("translate({:.3} {:.3}) scale({:.4})", throat.0, throat.1, 0.9 + 0.25 * b),
    );
    set(".tri-throat", "opacity", format!("{:.4}", 0.55 + 0.35 * b));
    let rest = TRINITY.at(UNSEAL_THROAT);
    for i in 0..8 {
        let s = if reduced { i as f64 / 8. } else { (t / 5. + i as f64 / 8.).fract() };
        let p = breath_loop(s, rest);
        let selector = format!(".tri-mote-{i}");
        set(&selector, "transform", format!("translate({:.3} {:.3})", p.0, p.1));
        set(&selector, "opacity", format!("{:.4}", flow * (0.35 + 0.55 * (s * PI).sin().powi(2))));
    }
    for (i, (_, _, _, start)) in TRINITY_WORDS.iter().enumerate() {
        word_frame(&mut out, &format!("tri-word-{i}"), ramp(t, *start, start + 1.) * (1. - ramp(t, 17.5, 19.5)));
    }
    out
}

// 5. The voice touches the Shadow and lets light pass through it. No stage,
// no audience: the one who stands here is Spectator, Witness and Author.
const AWARE: Placement = Placement {
    origin: (83.5, 78.),
    scale: 0.06985,
};
/// Projects the figure onto the back wall: larger, leaning, standing on it.
const SHADOW: [f64; 6] = [1.1, 0., -0.12, 1.05, 103.56, -36.9];
const AWARE_WORDS: [(&str, f64); 3] = [("ЗРИТЕЛЬ", 8.5), ("СВИДЕТЕЛЬ", 11.), ("АВТОР", 13.5)];
fn awareness_svg() -> String {
    let mut out = open(
        "aw",
        "Голос касается Тени, и свет осознанности проходит сквозь неё. Сцена и зрители растворяются.",
    );
    out.push_str(r#"<g class="aw-hall" stroke="var(--book-line)" stroke-width=".4"><path d="M196 150L292 150L306 166L182 166Z" fill="var(--book-cover)" opacity=".8"/><path d="M182 166V171H306V166" opacity=".7"/>"#);
    for (row, y) in [(0, 177.)] {
        for k in 0..9 {
            let x = 168. + k as f64 * 15. + row as f64 * 7.;
            let _ = write!(out, r#"<path d="M{x} {y}v-4h6v4M{x} {}h6" opacity=".6"/>"#, y - 2.);
        }
    }
    out.push_str("</g>");
    let solid = crate::breath_heroine::paths(heroine_pose(0., 0.5), AWARE.origin, AWARE.scale)
        .into_iter()
        .step_by(2)
        .collect::<Vec<_>>()
        .join(" ");
    let [a, b, c, d, e, f] = SHADOW;
    let _ = write!(
        out,
        r##"<path d="M112 176L134 178L214 151L196 149Z" fill="#000" opacity=".25"/><g transform="matrix({a} {b} {c} {d} {e} {f})"><path class="aw-shadow" d="{solid}" fill="#000" stroke="var(--book-line)" stroke-width=".3" opacity=".6"/></g><path class="aw-band" d="M0 0" stroke="var(--book-line)" stroke-width=".8" opacity="0"/>"##
    );
    for i in 0..3 {
        let _ = write!(out, r#"<path class="aw-ray-{i}" d="M0 0" stroke="var(--book-ink)" stroke-width="{}" opacity="0"/>"#, if i == 1 { 1. } else { 0.6 });
    }
    for (i, d) in crate::breath_heroine::paths(heroine_pose(0., 0.5), AWARE.origin, AWARE.scale)
        .into_iter()
        .enumerate()
    {
        let ink = i % 2 == 1;
        let _ = write!(
            out,
            r#"<path class="aw-fig-{i}" d="{d}" fill="{}" fill-rule="evenodd"{}/>"#,
            if ink { "var(--book-ink)" } else { "var(--book-cover)" },
            if ink {
                r#" stroke="var(--book-ink)" stroke-width=".25""#
            } else {
                ""
            }
        );
    }
    let throat = heroine_throat(0., 0.5, AWARE);
    let _ = write!(
        out,
        r#"<g class="aw-throat" transform="translate({:.3} {:.3})"><circle r="8" fill="url(#aw-glow)"/><circle r=".7" fill="var(--book-line)"/></g>"#,
        throat.0, throat.1
    );
    for (i, (text, _)) in AWARE_WORDS.iter().enumerate() {
        word(
            &mut out,
            &format!("aw-word-{i}"),
            text,
            62.,
            24. + i as f64 * 13.,
            if i == 2 { 8. } else { 6. },
        );
    }
    close(out)
}
fn awareness_frame(t: f64, reduced: bool) -> Vec<Update> {
    let b = breath(t, reduced);
    let mut out = Vec::new();
    corridor_frame(&mut out, "aw", t, reduced);
    let pose = heroine_pose(t, b);
    let paths = crate::breath_heroine::paths(pose, AWARE.origin, AWARE.scale);
    out.push(Update {
        selector: ".aw-shadow".into(),
        attribute: "d",
        value: paths.iter().step_by(2).cloned().collect::<Vec<_>>().join(" "),
    });
    for (i, d) in paths.into_iter().enumerate() {
        out.push(Update {
            selector: format!(".aw-fig-{i}"),
            attribute: "d",
            value: d,
        });
    }
    let hall = 1. - ramp(t, 2., 6.) + ramp(t, 18., 19.8);
    let voice = ramp(t, 3., 4.) * (1. - ramp(t, 12.5, 14.));
    let through = ramp(t, 5., 11.) * (1. - ramp(t, 17.5, 19.8));
    let mut set = |selector: String, attribute, value: String| {
        out.push(Update {
            selector,
            attribute,
            value,
        })
    };
    set(".aw-hall".into(), "opacity", format!("{:.4}", hall));
    set(".aw-hall".into(), "transform", format!("translate(0 {:.3})", (1. - hall) * 6.));
    set(".aw-shadow".into(), "opacity", format!("{:.4}", 0.6 - 0.42 * through));
    let throat = heroine_throat(t, b, AWARE);
    set(".aw-throat".into(), "transform", format!("translate({:.3} {:.3}) scale({:.4})", throat.0, throat.1, 0.85 + 0.3 * b));
    set(".aw-throat".into(), "opacity", format!("{:.4}", 0.45 + 0.5 * voice.max(through * 0.6)));
    // Rays leave the throat, cross the shadow and continue past it.
    for i in 0..3 {
        let end = (304., 52. + 30. * i as f64);
        let u = if reduced { 0.55 } else { ((t - 3.) / 2.4 + i as f64 / 3.).rem_euclid(1.) };
        let a = (u - 0.18).max(0.);
        let p = |s: f64| (throat.0 + (end.0 - throat.0) * s, throat.1 + (end.1 - throat.1) * s);
        let (p0, p1) = (p(a), p(u));
        set(format!(".aw-ray-{i}"), "d", format!("M{:.3} {:.3}L{:.3} {:.3}", p0.0, p0.1, p1.0, p1.1));
        set(format!(".aw-ray-{i}"), "opacity", format!("{:.4}", voice * 0.7 * (u * PI).sin()));
    }
    let x = 186. + 66. * if reduced { 0.5 } else { ramp(t, 6., 11.) };
    set(".aw-band".into(), "d", format!("M{x:.3} 46V150"));
    set(".aw-band".into(), "opacity", format!("{:.4}", 0.55 * (ramp(t, 5.5, 6.5) * (1. - ramp(t, 10.5, 11.5)))));
    for (i, (_, start)) in AWARE_WORDS.iter().enumerate() {
        word_frame(&mut out, &format!("aw-word-{i}"), ramp(t, *start, start + 1.) * (1. - ramp(t, 17.5, 19.5)) * if i == 2 { 1. } else { 0.75 });
    }
    out
}

// 6. Speak to yourself: the voice leaves as noise and returns as a Call,
// framed by observation rather than performance.
const CALL: Placement = Placement {
    origin: (-5., 67.6),
    scale: 0.1292,
};
fn call_ring(t: f64, i: usize, throat: P, heart: P) -> (String, f64) {
    let out = t - 1.5 - i as f64 * 0.95;
    let back = t - 9.5 - i as f64 * 0.95;
    if (0. ..3.2).contains(&out) {
        let u = out / 3.2;
        let r = 4. + 58. * ease(u);
        (ellipse(throat, r, r * 0.82), 0.5 * (u * PI).sin())
    } else if (0. ..3.2).contains(&back) {
        let u = back / 3.2;
        let r = 62. - 59. * ease(u);
        (ellipse(heart, r, r * 0.82), 0.65 * (u * PI).sin())
    } else {
        (ellipse(heart, 3., 2.5), 0.)
    }
}
fn call_svg() -> String {
    let mut out = open("call", "Голос уходит шумом и возвращается Зовом. Рамка наблюдения держит звучание.");
    for i in 0..6 {
        let _ = write!(out, r#"<path class="call-ring-{i}" d="M0 0" stroke="var(--book-line)" stroke-width=".55" opacity="0"/>"#);
    }
    out.push_str(r#"<g stroke="var(--book-line)" stroke-width=".5" opacity=".7"><path d="M120 92v-8h8M200 92v-8h-8M120 176v8h8M200 176v8h-8"/></g><path class="call-scan" d="M0 0" stroke="var(--book-ink)" stroke-width=".35" opacity="0"/>"#);
    for (x, w) in [(20., 76.), (224., 76.)] {
        let _ = write!(
            out,
            r#"<path d="M{x} 30h{w}v34h-{w}Z" fill="var(--book-cover)" stroke="var(--book-dim)" stroke-width=".4" opacity=".9"/><path d="M{x} 34v-4h4M{} 30h4v4M{x} 60v4h4M{} 64h4v-4" stroke="var(--book-line)" stroke-width=".5"/>"#,
            x + w - 4.,
            x + w - 4.
        );
    }
    out.push_str(r#"<path d="M24 47H92" stroke="var(--book-dim)" stroke-width=".25"/><path class="call-wave" d="M0 0" stroke="var(--book-ink)" stroke-width=".6"/>"#);
    for i in 0..12 {
        let _ = write!(out, r#"<path class="call-bar-{i}" d="M0 0" stroke="var(--book-ink)" stroke-width="2.2" stroke-linecap="butt" opacity=".7"/>"#);
    }
    word(&mut out, "call-noise", "ШУМ", 58., 25., 6.);
    word(&mut out, "call-call", "ЗОВ", 58., 25., 6.);
    word(&mut out, "call-watch", "НАБЛЮДЕНИЕ", 262., 25., 5.);
    figure_svg(&mut out, "call", CALL);
    let (throat, heart) = (CALL.at(UNSEAL_THROAT), CALL.at(UNSEAL_HEART));
    let _ = write!(
        out,
        r#"<g class="call-throat" transform="translate({:.3} {:.3})"><circle r="8" fill="url(#call-glow)"/><circle r=".7" fill="var(--book-line)"/></g><g class="call-heart" opacity="0" transform="translate({:.3} {:.3})"><circle r="14" fill="url(#call-glow)"/><circle r="1" fill="var(--book-line)"/></g>"#,
        throat.0, throat.1, heart.0, heart.1
    );
    close(out)
}
fn call_frame(t: f64, reduced: bool) -> Vec<Update> {
    let b = breath(t, reduced);
    let mut out = Vec::new();
    corridor_frame(&mut out, "call", t, reduced);
    let arrive = ramp(t, 11.5, 14.) * (1. - ramp(t, 17.5, 19.6));
    let clear = ramp(t, 8., 10.) * (1. - ramp(t, 17.5, 19.5));
    let speak = ramp(t, 1.2, 2.) * (1. - ramp(t, 7.5, 9.));
    figure_frame(&mut out, "call", CALL, b, arrive);
    let throat = CALL.at(unseal_point(UNSEAL_THROAT, "trunk", b, arrive));
    let heart = CALL.at(unseal_point(UNSEAL_HEART, "trunk", b, arrive));
    let mut set = |selector: String, attribute, value: String| {
        out.push(Update {
            selector,
            attribute,
            value,
        })
    };
    for i in 0..6 {
        let (d, alpha) = if reduced { (ellipse(heart, 14. + i as f64 * 8., (14. + i as f64 * 8.) * 0.82), 0.3 - i as f64 * 0.04) } else { call_ring(t, i, throat, heart) };
        set(format!(".call-ring-{i}"), "d", d);
        set(format!(".call-ring-{i}"), "opacity", format!("{alpha:.4}"));
    }
    let scan = if reduced { 0.5 } else { (t / 5.).fract() };
    set(".call-scan".into(), "d", format!("M124 {:.3}H196", 86. + 94. * scan));
    set(".call-scan".into(), "opacity", format!("{:.4}", 0.3 * (scan * PI).sin()));
    // Noise and Call share one line: jagged partials resolve into one tone.
    let level = 0.25 + 0.75 * speak.max(arrive);
    let mut wave = String::new();
    for n in 0..=68 {
        let x = 24. + n as f64;
        let phase = x * 0.21 - if reduced { 0. } else { t * TAU / 2.5 };
        let noise = (phase * 3.7).sin() * 0.5 + (phase * 7.3 + 1.3).sin() * 0.35 + (phase * 11.1).sin() * 0.25;
        let tone = phase.sin();
        let env = (n as f64 / 68. * PI).sin();
        let y = 47. + 9. * level * env * (noise * (1. - clear) + tone * clear);
        let _ = write!(wave, "{}{x:.2} {y:.3}", if n == 0 { 'M' } else { 'L' });
    }
    set(".call-wave".into(), "d", wave);
    for i in 0..12 {
        let x = 230. + i as f64 * 5.5;
        let f = i as f64 * 0.9 + if reduced { 0. } else { t * TAU / 2.5 };
        let h = 2. + 22. * level * (0.35 + 0.65 * (0.5 + 0.5 * f.sin()) * (1. - 0.6 * clear * ((i as f64 - 5.5).abs() / 6.)));
        set(format!(".call-bar-{i}"), "d", format!("M{x} 61V{:.3}", 61. - h));
    }
    set(".call-throat".into(), "transform", format!("translate({:.3} {:.3}) scale({:.4})", throat.0, throat.1, 0.85 + 0.3 * b));
    set(".call-throat".into(), "opacity", format!("{:.4}", 0.4 + 0.55 * speak));
    set(".call-heart".into(), "transform", format!("translate({:.3} {:.3}) scale({:.4})", heart.0, heart.1, 0.9 + 0.2 * b));
    set(".call-heart".into(), "opacity", format!("{:.4}", if reduced { 0.8 } else { arrive * 0.9 }));
    word_frame(&mut out, "call-noise", 0.8 * (1. - clear));
    word_frame(&mut out, "call-call", clear);
    word_frame(&mut out, "call-watch", 0.6);
    out
}

pub fn svg(kind: &str) -> Option<String> {
    Some(match kind {
        "practice-trinity" => trinity_svg(),
        "practice-awareness" => awareness_svg(),
        "practice-listening" => call_svg(),
        _ => return None,
    })
}
pub fn frame(kind: &str, seconds: f64, reduced: bool) -> Vec<Update> {
    let reduced = reduced || !seconds.is_finite();
    let t = time(seconds, reduced);
    match kind {
        "practice-trinity" => trinity_frame(t, reduced),
        "practice-awareness" => awareness_frame(t, reduced),
        "practice-listening" => call_frame(t, reduced),
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const KINDS: [&str; 3] = ["practice-trinity", "practice-awareness", "practice-listening"];
    #[test]
    fn scenes_parse_loop_and_target_existing_elements() {
        for kind in KINDS {
            let source = svg(kind).unwrap();
            let doc = roxmltree::Document::parse(&source).unwrap();
            assert_eq!(frame(kind, 0., true), frame(kind, 87., true));
            assert_eq!(frame(kind, 0., true), frame(kind, f64::NAN, false));
            assert_eq!(frame(kind, 0., false), frame(kind, PERIOD, false));
            for i in 0..200 {
                for u in frame(kind, i as f64 * 0.1, false) {
                    let class = u.selector.trim_start_matches('.');
                    assert!(
                        doc.descendants().any(|n| n.attribute("class") == Some(class)),
                        "{kind} {class}"
                    );
                    assert!(!u.value.contains("NaN") && !u.value.contains("inf"), "{kind} {class}");
                }
            }
        }
    }
    #[test]
    fn loops_close_without_a_visible_jump() {
        for kind in KINDS {
            let a = frame(kind, PERIOD - 0.02, false);
            let b = frame(kind, 0., false);
            for (x, y) in a.iter().zip(&b) {
                if x.attribute == "opacity" {
                    let (x, y) = (x.value.parse::<f64>().unwrap(), y.value.parse::<f64>().unwrap());
                    assert!((x - y).abs() < 0.08, "{kind} {x} {y}");
                }
            }
        }
    }
    #[test]
    fn soles_stay_on_the_floor() {
        for (id, c) in FIGURE.iter() {
            if id.contains("leg") {
                let rest = c.map(|p| unseal_point(p, id, 0.5, 0.));
                assert_eq!(rest, c.map(|p| unseal_point(p, id, 1., 1.)), "{id}");
            }
        }
    }
    #[test]
    fn words_arrive_in_order() {
        let at = |t: f64, i: usize| {
            frame("practice-trinity", t, false)
                .into_iter()
                .find(|u| u.selector == format!(".tri-word-{i}") && u.attribute == "opacity")
                .unwrap()
                .value
                .parse::<f64>()
                .unwrap()
        };
        assert!(at(3., 0) > 0.99 && at(3., 1) == 0.);
        assert!(at(7., 1) > 0.99 && at(7., 2) == 0.);
        assert!(at(11., 2) > 0.99);
    }
}
