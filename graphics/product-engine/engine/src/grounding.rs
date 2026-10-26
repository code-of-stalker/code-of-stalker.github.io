//! Step four: contact rather than escape. Geometry, timing and authored text are
//! Rust-owned. Eight studies share a quiet architectural room and opaque figures.
use crate::{practice_stage::*, step_three::Update};
use std::{
    f64::consts::{PI, TAU},
    sync::LazyLock,
};

pub const KINDS: [&str; 8] = [
    "grounding-here",
    "grounding-drift",
    "grounding-trace",
    "grounding-contact",
    "grounding-voice",
    "grounding-persona",
    "grounding-signal",
    "grounding-presence",
];
pub const PERIOD: f64 = 24.;
#[derive(Clone, Copy, PartialEq)]
enum Study {
    Here,
    Drift,
    Trace,
    Contact,
    Voice,
    Persona,
    Signal,
    Presence,
}
impl Study {
    fn parse(kind: &str) -> Option<Self> {
        Some(match kind {
            "grounding-here" => Self::Here,
            "grounding-drift" => Self::Drift,
            "grounding-trace" => Self::Trace,
            "grounding-contact" => Self::Contact,
            "grounding-voice" => Self::Voice,
            "grounding-persona" => Self::Persona,
            "grounding-signal" => Self::Signal,
            "grounding-presence" => Self::Presence,
            _ => return None,
        })
    }
}
pub fn contains(kind: &str) -> bool {
    Study::parse(kind).is_some()
}
fn camera() -> Camera {
    Camera {
        eye: [0., 1.5, -5.],
        focal: 260.,
        center: (160., 82.),
    }
}
fn calm(t: f64) -> f64 {
    bell(t, 1.5, 9., 19., 24.)
}
fn breath(t: f64) -> f64 {
    0.5 - 0.5 * (t * TAU / 6.).cos()
}
fn defs() -> String {
    format!(
        r##"{}<linearGradient id="gr-light"><stop stop-color="var(--book-ink)" stop-opacity="0.02"/><stop offset="1" stop-color="var(--book-light)" stop-opacity="0.2"/></linearGradient>
      <linearGradient id="gr-body" x1="0" y1="0" x2="1" y2="0.3"><stop stop-color="var(--book-cover)"/><stop offset="0.68" stop-color="var(--book-paper)"/><stop offset="1" stop-color="var(--book-edge)"/></linearGradient>
      <linearGradient id="gr-rising" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--book-ink)" stop-opacity="0.01"/><stop offset="0.5" stop-color="var(--book-ink)" stop-opacity="0.1"/><stop offset="1" stop-color="var(--book-light)" stop-opacity="0.34"/></linearGradient>"##,
        glow_defs("gr")
    )
}

/// One camera, real world planes: joints of walls, floor and window coincide.
fn room(c: &mut Canvas, t: f64, clarity: f64, window: bool) {
    let cam = camera();
    let back = [[-5., 4., 5.], [5., 4., 5.], [5., 0., 5.], [-5., 0., 5.]];
    let floor = [[-5., 0., 5.], [5., 0., 5.], [5., 0., -1.], [-5., 0., -1.]];
    c.fixed(|| cam.poly(&back), &fill(COVER), 1.);
    c.fixed_rain(
        || cam.poly(&back),
        &cam.uv(back, [1.5, 1.2]),
        0.065 + 0.035 * (1. - clarity),
    );
    c.fixed(|| cam.poly(&floor), &fill(COVER), 1.);
    c.fixed_rain(|| cam.poly(&floor), &cam.uv(floor, [2.3, 1.7]), 0.05);
    for x in -10..=10 {
        let p = x as f64 * 0.5;
        c.fixed(
            || cam.line(&[[p, 0., 5.], [p, 0., -1.]]),
            &stroke(LINE, 0.24),
            0.15 + 0.2 * clarity,
        );
    }
    for i in 0..15 {
        let z = 5. - i as f64 * 0.42;
        c.fixed(
            || cam.line(&[[-5., 0., z], [5., 0., z]]),
            &stroke(LINE, 0.24),
            0.12 + 0.15 * clarity,
        );
    }
    for (x, z) in [(-3.9, 3.5), (-2.7, 4.3), (3.85, 3.5), (4.6, 1.5)] {
        let face = [
            [x, 3.8, z],
            [x + 0.16, 3.8, z],
            [x + 0.16, 0., z],
            [x, 0., z],
        ];
        let side = [
            [x + 0.16, 3.8, z],
            [x + 0.16, 3.8, z + 0.32],
            [x + 0.16, 0., z + 0.32],
            [x + 0.16, 0., z],
        ];
        c.fixed(
            || cam.poly(&side),
            &format!("{} {}", fill(COVER), stroke(LINE, 0.23)),
            0.7,
        );
        c.fixed(
            || cam.poly(&face),
            &format!("{} {}", fill(COVER), stroke(LINE, 0.3)),
            0.65,
        );
        c.fixed_rain(|| cam.poly(&face), &cam.uv(face, [0.055, 0.9]), 0.15);
    }
    if !window {
        return;
    }
    let win = [
        [0.85, 3.55, 4.95],
        [3.8, 3.55, 4.95],
        [3.8, 0.65, 4.95],
        [0.85, 0.65, 4.95],
    ];
    c.fixed(
        || cam.poly(&win),
        &format!("{} {}", fill("var(--book-paper)"), stroke(LINE, 0.55)),
        1.,
    );
    // Inset jamb, double frame and central mullion are tied to the same plane.
    for d in [0., 0.09, 0.19] {
        c.fixed(
            || {
                cam.poly(&[
                    [0.85 + d, 3.55 - d, 4.95],
                    [3.8 - d, 3.55 - d, 4.95],
                    [3.8 - d, 0.65 + d, 4.95],
                    [0.85 + d, 0.65 + d, 4.95],
                ])
            },
            &stroke(INK, if d == 0. { 0.5 } else { 0.24 }),
            0.3 + 0.35 * clarity,
        );
    }
    c.fixed(
        || cam.line(&[[2.3, 3.42, 4.9], [2.3, 0.79, 4.9]]),
        &stroke(LINE, 0.8),
        0.8,
    );
    for (i, (x, h)) in [(1.12, 1.7), (1.55, 2.1), (2.6, 2.45), (3.15, 1.6)]
        .iter()
        .enumerate()
    {
        let q = [
            [*x, *h, 5.01],
            [*x + 0.33, *h, 5.01],
            [*x + 0.33, 0.85, 5.01],
            [*x, 0.85, 5.01],
        ];
        c.fixed(
            || cam.poly(&q),
            &format!("{} {}", fill(COVER), stroke(LINE, 0.22)),
            0.5,
        );
        for row in 0..5 {
            let y = 1.05 + row as f64 * 0.2;
            c.fixed(
                || cam.line(&[[*x + 0.08, y, 5.], [*x + 0.23, y, 5.]]),
                &stroke(INK, 0.8),
                0.08 + 0.14 * breath(t + i as f64),
            );
        }
    }
    // Window light falls diagonally onto the floor, behind the opaque person.
    for i in 0..3 {
        let x = 0.98 + i as f64 * 0.76;
        let cone = [
            cam.project([x, 3.3, 4.9]),
            cam.project([x + 0.42, 3.3, 4.9]),
            (94. + i as f64 * 23., 179.),
            (59. + i as f64 * 23., 179.),
        ];
        c.fixed(
            || poly(&cone),
            r#"fill="url(#gr-light)""#,
            0.35 + 0.4 * clarity,
        );
    }
    c.path(
        &motes(&cam, t, 12, 71, (-2.4, 3.5), (1., 4.8), 3.2, 0.008),
        &fill(LIGHT),
        0.2 + 0.15 * clarity,
    );
}

// Preserve the already approved seated anatomy, including both hands resting
// on the knees. The outside contour is an opaque cover, never a see-through body.
static SEATED: LazyLock<(String, Vec<String>)> = LazyLock::new(|| {
    let doc = roxmltree::Document::parse(include_str!("../assets/spoken-thought-person.svg"))
        .expect("approved seated figure");
    let main = doc
        .descendants()
        .find(|n| n.attribute("id") == Some("silhouette-hands-and-chair"))
        .unwrap()
        .attribute("d")
        .unwrap();
    let end = main[1..].find('M').map_or(main.len(), |i| i + 1);
    let paths = doc
        .descendants()
        .filter(|n| n.has_tag_name("path") && n.attribute("id") != Some("head-thought-curve"))
        .filter_map(|n| n.attribute("d").map(str::to_owned))
        .collect();
    (main[..end].into(), paths)
});
fn seated(c: &mut Canvas, t: f64, clarity: f64, speaking: f64) {
    // Keep the soles at y=170 for every breath; motion is confined to the torso light.
    c.group("", "translate(72 25) scale(0.28)", 1.);
    c.fixed(|| SEATED.0.clone(), &fill("url(#gr-body)"), 1.);
    c.fixed(
        || SEATED.0.clone(),
        r#"fill="url(#gr-rising)""#,
        0.24 + 0.6 * clarity,
    );
    for d in &SEATED.1 {
        c.fixed(
            || d.clone(),
            r#"fill="var(--book-ink)" fill-rule="evenodd""#,
            0.62 + 0.3 * clarity,
        );
    }
    // A modest jaw opening, without moving the skull or the whole silhouette.
    c.path(
        &ellipse((128., 86.), 4.3, 1. + speaking * 3.8),
        &fill(COVER),
        1.,
    );
    c.path(
        &format!("M124 87Q128 {:0.2} 131 87", 88. + speaking * 4.),
        &stroke(INK, 1.2),
        0.75,
    );
    c.end();
    c.sprite(
        (102., 77.),
        7. + breath(t) * 0.5,
        "gr-haze",
        0.3 + 0.25 * breath(t),
    );
}
fn contact(c: &mut Canvas, t: f64, clarity: f64, large: bool) {
    for (i, (x, y)) in [(143., 170.), (151., 169.)].iter().enumerate() {
        c.fixed(
            || ellipse((*x, *y), 14., 3.1),
            r#"fill="url(#gr-glow)""#,
            0.25 + 0.6 * clarity,
        );
        for r in 0..3 {
            let p = (t / 8. + r as f64 / 3. + i as f64 * 0.08).fract();
            c.path(
                &ellipse(
                    (*x, *y),
                    7. + p * if large { 60. } else { 36. },
                    2. + p * if large { 15. } else { 8. },
                ),
                &stroke(INK, 0.32),
                0.42 * (PI * p).sin().powi(2) * clarity,
            );
        }
    }
    // Downward sensory current lands on the actual feet and stops there.
    let points = [
        (101., 72.),
        (100., 99.),
        (113., 114.),
        (139., 114.),
        (141., 146.),
        (144., 168.),
    ];
    c.fixed(|| line(&points), &stroke(LINE, 0.35), 0.2 * clarity);
    let p = (t / 8.).fract();
    c.path(
        &part(&points, p * 0.86, (p * 0.86 + 0.14).min(1.)),
        &stroke(LIGHT, 0.65),
        0.65 * (PI * p).sin().max(0.) * clarity,
    );
}
fn drifting(c: &mut Canvas, t: f64, clarity: f64) {
    let labels = ["НУЖНО", "ПОТОМ", "Я ДОЛЖЕН", "А ЕСЛИ"];
    for (i, label) in labels.iter().enumerate() {
        let phase = t * TAU / 24. + i as f64 * 1.5;
        let x = 156. + 55. * phase.cos();
        let y = 46. + 18. * phase.sin();
        c.group(
            "",
            &format!("translate({:0.3} {:0.3})", x, y),
            0.18 + 0.58 * (1. - clarity),
        );
        c.fixed(
            || "M-26 -9H19L26 -2V9H-26Z".into(),
            &format!("{} {}", fill(COVER), stroke(LINE, 0.3)),
            1.,
        );
        c.words(
            label,
            || word(label, 0., 2.5, 7.),
            &fill(INK),
            "translate(0 0)",
            0.85,
        );
        c.end();
    }
}
fn voice(c: &mut Canvas, t: f64) {
    let cadence = bell(t.rem_euclid(8.), 1., 1.8, 4., 5.);
    for i in 0..4 {
        let p = (t / 2.8 + i as f64 / 4.).fract();
        let x = 111. + p * 39.;
        let a = 2. + p * 7.;
        c.path(
            &format!(
                "M{x:0.3} {:0.3}Q{:0.3} 49.1 {x:0.3} {:0.3}",
                49.1 - a,
                x + 2. + p * 4.,
                49.1 + a
            ),
            &stroke(INK, 0.45),
            0.7 * (PI * p).sin().powi(2) * cadence,
        );
    }
    // A little listening surface displays a smooth imprint of the voice.
    c.fixed(
        || "M186 104H272L279 111V149H186Z".into(),
        &format!("{} {}", fill(COVER), stroke(LINE, 0.4)),
        0.9,
    );
    c.words(
        "СЛЫШУ",
        || word("СЛЫШУ", 230., 115., 7.5),
        &fill(LINE),
        "translate(0 0)",
        0.8,
    );
    let mut pts = Vec::new();
    for i in 0..=64 {
        let p = i as f64 / 64.;
        pts.push((
            193. + p * 79.,
            132. + (PI * p).sin().powi(2) * (p * TAU * 2. - t * 1.8).sin() * (1. + cadence * 6.),
        ));
    }
    c.path(&line(&pts), &stroke(INK, 0.6), 0.85);
}

fn trace(c: &mut Canvas, t: f64) {
    room(c, t, 0.6, false);
    // The completed conclusion opens into its sources; light retraces the
    // journey, rather than spinning an unrelated decorative orbit.
    let nodes = [
        ((57., 58.), "ОЩУЩЕНИЕ"),
        ((194., 43.), "ОБРАЗ"),
        ((263., 98.), "МЫСЛЬ"),
        ((151., 143.), "ВЫВОД"),
    ];
    let phase = t / 24.;
    for i in 0..4 {
        let a = nodes[i].0;
        let b = nodes[(i + 1) % 4].0;
        let pts = [
            (a.0, a.1 + 10.),
            ((a.0 + b.0) * 0.5, a.1 + 20.),
            (b.0, b.1 - 10.),
        ];
        c.fixed(|| line(&pts), &stroke(LINE, 0.35), 0.45);
        let p = (phase * 2. + i as f64 / 4.).fract();
        c.path(
            &part(&pts, p * 0.8, (p * 0.8 + 0.2).min(1.)),
            &stroke(LIGHT, 0.7),
            0.8 * (PI * p).sin().powi(2),
        );
    }
    for (i, (at, label)) in nodes.iter().enumerate() {
        let lit = (TAU * (phase - i as f64 / 4.)).cos().max(0.).powi(4);
        c.group("", &format!("translate({} {})", at.0, at.1), 1.);
        c.fixed(
            || "M-31 -13H24L31 -6V13H-24L-31 6Z".into(),
            &format!("{} {}", fill(COVER), stroke(INK, 0.45)),
            1.,
        );
        c.fixed(
            || "M-28 -10H22M28 -5V10H-23".into(),
            &stroke(LINE, 0.22),
            0.6,
        );
        c.fixed(|| "M-25 9H-17".into(), &stroke(LIGHT, 1.), 0.25 + 0.7 * lit);
        c.words(
            label,
            || word(label, 0., 2.5, 8.5),
            &fill(INK),
            "translate(0 0)",
            0.62 + 0.38 * lit,
        );
        c.end();
    }
    c.words(
        "ИЗ КАКОЙ ТОЧКИ?",
        || word("ИЗ КАКОЙ ТОЧКИ?", 156., 94., 7.),
        &fill(LINE),
        "translate(0 0)",
        0.65,
    );
}
fn standing(c: &mut Canvas, t: f64, amount: f64) {
    let cam = camera();
    let place = heroine_world([-0.8, 0., 0.], 2.62, 1.).then(cam.plane(0.));
    let cover = heroine_cover("url(#gr-body)");
    let ink = heroine_ink(INK);
    let light = heroine_cover("url(#gr-rising)");
    heroine(
        c,
        place,
        breath(t),
        1.,
        &Layers {
            cover: (&cover, 1.),
            code: None,
            glows: &[(&light, 0.2 + 0.8 * amount)],
            inks: &[(&ink, 0.72 + 0.28 * amount)],
        },
    );
    c.fixed(
        || ellipse((118., 160.), 38., 8.),
        r#"fill="url(#gr-haze)""#,
        0.3 + 0.65 * amount,
    );
}
fn persona(c: &mut Canvas, t: f64, amount: f64) {
    room(c, t, amount, false);
    let panels = [
        (210., 45., "ПАМЯТЬ"),
        (229., 79., "Я ДОЛЖЕН"),
        (218., 114., "СТРАХ"),
        (209., 147., "ОБРАЗ СЕБЯ"),
    ];
    // Cables are painted first, then opaque body and cards. Nothing shines through.
    for (i, (x, y, _)) in panels.iter().enumerate() {
        let release = bell(t, 2. + i as f64 * 2., 5. + i as f64 * 2., 19., 24.);
        c.path(
            &format!(
                "M120 {}C160 {} 170 {} {} {}",
                55. + i as f64 * 25.,
                40. + i as f64 * 28.,
                y - 10.,
                x - 35.,
                y
            ),
            &stroke(LINE, 0.34),
            0.6 * (1. - release),
        );
    }
    standing(c, t, amount);
    for (i, (x, y, label)) in panels.iter().enumerate() {
        let r = bell(t, 2. + i as f64 * 2., 5. + i as f64 * 2., 19., 24.);
        c.group(
            "",
            &format!("translate({:0.3} {:0.3})", x + 24. * r, y - 6. * r),
            0.9 - 0.65 * r,
        );
        c.fixed(
            || "M-34 -11H27L34 -4V11H-34Z".into(),
            &format!("{} {}", fill(COVER), stroke(INK, 0.35)),
            1.,
        );
        c.words(
            label,
            || word(label, 0., 2.5, 8.),
            &fill(INK),
            "translate(0 0)",
            0.8,
        );
        c.end();
    }
}
fn signal(c: &mut Canvas, t: f64) {
    room(c, t, 0.55, false);
    // Nested architectural slits: a path already present in the body becomes
    // visible through the mechanism. No chains, portals or duplicated heroes.
    for i in (0..7).rev() {
        let x = 77. + i as f64 * 23.;
        let h = 52. - i as f64 * 3.;
        let r = bell(t, 1. + i as f64, 5. + i as f64, 19., 24.);
        let gap = 2. + r * 15.;
        for sign in [-1., 1.] {
            c.path(
                &poly(&[
                    (x - 7., 92. + sign * gap),
                    (x + 8., 88. + sign * gap),
                    (x + 8., 88. + sign * h),
                    (x - 7., 92. + sign * h),
                ]),
                &format!("{} {}", fill(COVER), stroke(LINE, 0.5)),
                0.7,
            );
        }
        c.path(
            &format!("M{} {:0.2}L{} {:0.2}", x - 7., 92. - gap, x + 8., 88. - gap),
            &stroke(INK, 0.7),
            0.2 + 0.6 * r,
        );
    }
    let pts = [
        (38., 94.),
        (73., 93.),
        (119., 92.),
        (161., 90.),
        (205., 89.),
        (263., 88.),
    ];
    c.fixed(|| line(&pts), &stroke(INK, 0.45), 0.5 * calm(t));
    let p = (t / 12.).fract();
    c.path(
        &part(&pts, p * 0.8, (p * 0.8 + 0.2).min(1.)),
        &stroke(LIGHT, 0.9),
        (PI * p).sin().powi(2),
    );
    c.sprite((263., 88.), 18., "gr-glow", 0.25 + 0.6 * calm(t));
    c.words(
        "ЗОВ",
        || word("ЗОВ", 263., 125., 8.5),
        &fill(INK),
        "translate(0 0)",
        0.65,
    );
}
fn presence(c: &mut Canvas, t: f64, amount: f64) {
    room(c, t, amount, false);
    // A level plane, not a containing sphere. Small light patches spread from
    // the standing person's real support into the surrounding world.
    let cam = camera();
    for i in 0..5 {
        let p = (t / 12. + i as f64 / 5.).fract();
        c.path(
            &floor_ring(&cam, [-0.8, 0., 0.], 0.14 + p * 2.8),
            &stroke(LINE, 0.35),
            0.45 * (PI * p).sin().powi(2),
        );
    }
    standing(c, t, amount);
    for (i, label) in ["ЗДЕСЬ", "ТЕЛО", "ПРИСУТСТВИЕ"].iter().enumerate() {
        let a = 0.35 + 0.5 * bell(t, i as f64 * 4., 4. + i as f64 * 4., 19., 24.);
        c.words(
            label,
            || word(label, 220., 56. + i as f64 * 31., 8.),
            &fill(INK),
            "translate(0 0)",
            a,
        );
    }
}
fn draw(c: &mut Canvas, study: Study, t: f64, reduced: bool) {
    let clarity = if reduced { 0.85 } else { calm(t) };
    match study {
        Study::Trace => trace(c, t),
        Study::Persona => persona(c, t, clarity),
        Study::Signal => signal(c, t),
        Study::Presence => presence(c, t, clarity),
        _ => {
            room(c, t, clarity, true);
            if study == Study::Drift {
                drifting(c, t, clarity);
            }
            // Soles and ground are rendered before the fully opaque foreground figure.
            contact(c, t, clarity, study == Study::Contact);
            let speech = if study == Study::Voice && !reduced {
                bell(t.rem_euclid(8.), 1., 1.8, 4., 5.) * (0.5 + 0.5 * (t * 7.).sin())
            } else {
                0.
            };
            seated(c, t, clarity, speech);
            if study == Study::Voice {
                voice(c, t);
            }
        }
    }
}
pub fn svg(kind: &str) -> Option<String> {
    let study = Study::parse(kind)?;
    let mut c=Canvas::build("ground", "Практика заземления и прямого узнавания: ощущение тела, контакт с землёй и ясное наблюдение.",&defs());
    draw(&mut c, study, 12., true);
    Some(c.finish())
}
pub fn frame(kind: &str, seconds: f64, reduced: bool) -> Vec<Update> {
    let Some(study) = Study::parse(kind) else {
        return vec![];
    };
    let reduced = reduced || !seconds.is_finite();
    let t = if reduced {
        12.
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    };
    let mut c = Canvas::frame("ground");
    draw(&mut c, study, t, reduced);
    c.updates
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scenes_have_stable_topology_finite_motion_and_quiet_stills() {
        for kind in KINDS {
            let svg = svg(kind).unwrap();
            let doc = roxmltree::Document::parse(&svg).unwrap();
            assert_eq!(frame(kind, 0., true), frame(kind, 100., true));
            assert_eq!(frame(kind, 0., true), frame(kind, f64::NAN, false));
            assert_eq!(frame(kind, 0., false), frame(kind, PERIOD, false));
            assert!(svg.contains("data-rust-matrix-uv") && !svg.contains("<image"));
            for i in 0..=48 {
                for u in frame(kind, i as f64 * 0.5, false) {
                    assert!(
                        doc.descendants()
                            .any(|n| n.attribute("class")
                                == Some(u.selector.trim_start_matches('.'))),
                        "{kind}: {}",
                        u.selector
                    );
                    assert!(!u.value.contains("NaN") && !u.value.contains("inf"));
                    if u.attribute == "opacity" {
                        assert!((0. ..=1.).contains(&u.value.parse::<f64>().unwrap()));
                    }
                }
            }
        }
    }
    #[test]
    fn foot_contacts_and_window_use_the_same_floor() {
        // The approved contour is uniformly fitted, never narrowed or stretched.
        let sole: f64 = 25. + 519. * 0.28;
        assert!((sole - 170.).abs() < 0.5);
        let cam = camera();
        for x in [-1., 0., 1.] {
            assert!((cam.project([x, 0., 0.]).1 - 160.).abs() < 0.01);
        }
        assert!(!contains("grounding-unknown"));
    }
}
