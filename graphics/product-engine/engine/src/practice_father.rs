//! Practice 3, "Теперь — позволь Отцу заговорить в тебе": not an image of
//! God, but the Absolute speaking to Itself in form, as a Father to the Son
//! in you. A boy stands alone in a street of code, bound by four rings of it.
//! Light kindles in his jugular notch, leaves him and becomes the Father,
//! kneeling before him. From his own notch, with breath, the Father says the
//! four phrases; each comes to the boy whole and sinks into him, and a ring
//! falls away. Then the Father returns into him as light, and the boy stands
//! lit from within while the street hears it.
use crate::{
    family_artwork::Contour,
    practice_stage::*,
    step_three::Update,
};
use std::{f64::consts::TAU, sync::LazyLock};

pub const PERIOD: f64 = 36.;
/// The reduced-motion still: every phrase heard, the Father still with him.
pub const REST: f64 = 28.7;

/// The approved kneeling Father and standing boy, traced once.
const ART: &str = include_str!("../assets/father-son-vector.svg");
static FIGURES: LazyLock<Vec<(String, Contour)>> = LazyLock::new(|| {
    let doc = roxmltree::Document::parse(ART).expect("approved father and son");
    doc.descendants()
        .filter_map(|n| Some((n.attribute("class")?.to_owned(), Contour::new(n.attribute("d")?))))
        .collect()
});
fn figure(name: &str) -> &'static Contour {
    &FIGURES.iter().find(|(n, _)| n == name).expect("traced figure").1
}
/// Metres per art unit: the boy, crown to sole, is 1.22 m.
const K: f64 = 1.22 / (887. - 266.);
/// The art's ground line, and the art x standing on the world's x = 0.
const GROUND: f64 = 889.;
const MIDST: f64 = 746.;
const FATHER_NOTCH: P = (636., 408.);
const FATHER_HEART: P = (590., 470.);
/// Where the Father's light sits: at his jugular notch, just under the throat,
/// not in the middle of his chest.
const FATHER_GLOW: P = (630., 417.);
const FATHER_MOUTH: P = (680., 351.);
const SON_NOTCH: P = (889., 405.);
const SON_HEART: P = (900., 452.);
const SON_AXIS: f64 = 915.;
/// Rain inside the boy, in art units.
const SON_CODE: &str = "0.0048 0 0 0 0.0026 0 0 0 1";

/// The light leaves the boy, becomes the Father, and returns into him.
const KINDLE: (f64, f64) = (1.2, 2.2);
const BIRTH: (f64, f64) = (2.1, 3.3);
const FORM: (f64, f64) = (3.2, 5.6);
const FIRST: f64 = 6.;
/// Seconds after the last phrase lands before the Father turns to light.
const STILL: f64 = 1.7;
const RETURN: f64 = 3.2;

const PHRASES: [&[&str]; 4] = [
    &["Я ЛЮБЛЮ ТЕБЯ."],
    &["Я НИКОГДА НЕ ПОКИНУ ТЕБЯ."],
    &["ПРОСТИ МЕНЯ."],
    &["ВСЕ, ЧТО У МЕНЯ ЕСТЬ —", "ЭТО ТЫ."],
];
const PHRASE_SIZE: f64 = 8.;
const LEADING: f64 = 1.35;
const APPEAR: f64 = 0.5;
const DESCEND: f64 = 1.5;
const GAP: f64 = 0.9;
/// The rings binding him: height and radius, metres. Each phrase frees one,
/// from his shoulders down.
const RINGS: [(f64, f64); 4] = [(0.95, 0.25), (0.73, 0.23), (0.5, 0.21), (0.26, 0.18)];
const SEGMENTS: usize = 15;
const FALL: f64 = 1.5;

fn camera(t: f64) -> Camera {
    Camera {
        eye: wmix([-0.12, 0.78, -3.6], [0.2, 0.7, -3.], ease(ramp(t, 0., PERIOD - 0.5))),
        focal: 330.,
        center: (160., 92.),
    }
}
fn time(seconds: f64, reduced: bool) -> f64 {
    if reduced || !seconds.is_finite() {
        REST
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    }
}
/// Art units to the world plane the two of them stand on, z = 0.
fn art_world() -> Affine {
    Affine([K, 0., 0., -K, -MIDST * K, GROUND * K])
}
fn world(p: P) -> W {
    let q = art_world().apply(p);
    [q.0, q.1, 0.]
}

/// One phrase: when it gathers above them, leaves for the boy and enters him.
struct Phrase {
    lines: &'static [&'static str],
    at: f64,
    leaves: f64,
    lands: f64,
}
/// Long enough to be read, slowly.
fn reading(lines: &[&str]) -> f64 {
    1.5 + 0.055 * lines.iter().map(|l| l.chars().count()).sum::<usize>() as f64
}
fn phrases() -> Vec<Phrase> {
    let mut at = FIRST;
    PHRASES
        .iter()
        .map(|&lines| {
            let leaves = at + APPEAR + reading(lines);
            let lands = leaves + DESCEND;
            let p = Phrase { lines, at, leaves, lands };
            at = lands + GAP;
            p
        })
        .collect()
}
/// When the Father turns to light and when that light is inside the boy.
fn homecoming() -> (f64, f64) {
    let start = phrases().last().unwrap().lands + STILL;
    (start, start + RETURN)
}
/// He speaks while a phrase gathers and is read.
fn speaking(t: f64) -> f64 {
    phrases()
        .iter()
        .map(|p| bell(t, p.at - 0.1, p.at + 0.3, p.leaves - 0.2, p.leaves + 0.3))
        .fold(0., f64::max)
}
/// His open hand stays with each phrase until it reaches the boy.
fn reassuring(t: f64) -> f64 {
    phrases()
        .iter()
        .map(|p| bell(t, p.at - 0.3, p.at + 1.2, p.lands - 0.3, p.lands + 1.2))
        .fold(0., f64::max)
}
/// How much of him has formed out of the light, and how much is still there.
fn presence(t: f64) -> f64 {
    let (home, _) = homecoming();
    ramp(t, FORM.0 + 0.6, FORM.1 - 0.4) * (1. - ramp(t, home + 0.4, home + 2.))
}
/// The light inside the boy: a step for every phrase, the rest when the
/// Father comes home.
fn lit(t: f64) -> f64 {
    let (_, home) = homecoming();
    let steps: f64 = phrases().iter().map(|p| 0.16 * ramp(t, p.lands, p.lands + 0.9)).sum();
    steps + 0.36 * ramp(t, home - 0.3, home + 0.8)
}
fn breath(t: f64) -> f64 {
    (TAU * t / 5.2).sin()
}

/// The Father held as one figure: his chest rises with breath, and while a
/// phrase is on its way he leans a little toward the boy, from the knee.
fn father_pose(gentle: f64, b: f64) -> Affine {
    Affine::about((600., GROUND), 1., 1. + 0.004 * b).then(Affine::turn((560., GROUND), 0.014 * gentle))
}

/// The street: blocks of code on both sides, receding into the light.
struct Block {
    x: f64,
    outer: f64,
    near: f64,
    far: f64,
    height: f64,
    shift: f64,
}
static STREET: LazyLock<Vec<Block>> = LazyLock::new(|| {
    let mut out = Vec::new();
    for (s, side) in [-1., 1.].into_iter().enumerate() {
        let mut z = -2.4 + 0.8 * s as f64;
        let mut k = 40 * s;
        while z < 24. {
            let depth = 2. + 1.8 * hash(k);
            let x = side * (2.2 + 0.4 * hash(k + 1));
            out.push(Block {
                x,
                outer: x + side * 3.,
                near: z,
                far: z + depth,
                height: 3.4 + 6. * hash(k + 2),
                shift: (hash(k + 3) * 9.).floor(),
            });
            z += depth + 0.3 + 0.6 * hash(k + 4);
            k += 5;
        }
    }
    out.sort_by(|a, b| b.near.total_cmp(&a.near));
    out
});
const DEEP: W = [0., 1.6, 24.];

/// A ring binding him, as its back or front half: short arcs of code turning
/// about him, scattering outward when its phrase arrives.
fn ring(cam: &Camera, t: f64, k: usize, front: bool) -> String {
    let (y, r) = RINGS[k];
    let lands = phrases()[k].lands;
    let f = ramp(t, lands, lands + FALL);
    if f >= 1. {
        return String::new();
    }
    let centre = world((SON_AXIS, GROUND))[0];
    let spin = if k % 2 == 0 { 0.35 } else { -0.28 } * t + k as f64;
    let mut d = String::new();
    for s in 0..SEGMENTS {
        let h = |i: usize| hash(100 * k + 7 * s + i);
        let a0 = spin + s as f64 / SEGMENTS as f64 * TAU;
        let span = (0.35 + 0.35 * h(0)) * TAU / SEGMENTS as f64;
        if ((a0 + span / 2.).sin() < 0.) != front {
            continue;
        }
        let out = r * (1. + 1.8 * f * (0.5 + h(1)));
        let lift = y + 0.004 * (9. * t + s as f64).sin() + (h(2) - 0.5) * 0.3 * f - 0.35 * f * f;
        let points: Vec<W> = (0..=4)
            .map(|i| {
                let a = a0 + span * i as f64 / 4.;
                [centre + out * a.cos(), lift, out * a.sin()]
            })
            .collect();
        d.push_str(&cam.line(&points));
    }
    d
}
fn ring_alpha(t: f64, k: usize) -> f64 {
    let p = &phrases()[k];
    let tense = bell(t, p.leaves, p.lands - 0.4, p.lands, p.lands + 0.2);
    (0.45 + 0.45 * tense) * (1. - ramp(t, p.lands, p.lands + FALL))
}

/// A gentle arc of light between two screen points, bowed upward.
fn stream(a: P, b: P, lift: f64) -> Vec<P> {
    let up = |p: P, k: f64| (p.0, p.1 - lift * k);
    (0..=28)
        .map(|i| {
            let u = i as f64 / 28.;
            let (p, q, r, s) = (a, up(lerp(a, b, 0.3), 1.), up(lerp(a, b, 0.7), 1.), b);
            let v = 1. - u;
            (
                v * v * v * p.0 + 3. * v * v * u * q.0 + 3. * v * u * u * r.0 + u * u * u * s.0,
                v * v * v * p.1 + 3. * v * v * u * q.1 + 3. * v * u * u * r.1 + u * u * u * s.1,
            )
        })
        .collect()
}
/// Light travelling along `way` from `from` for `lasting` seconds.
fn travel(c: &mut Canvas, way: &[P], t: f64, from: f64, lasting: f64) {
    let u = ramp(t, from, from + lasting);
    let on = bell(t, from, from + 0.15, from + lasting - 0.1, from + lasting + 0.3);
    let total = length(way);
    let (head, tail) = (ease(u), ease((u - 0.35).max(0.)));
    let trail = part(way, tail, head);
    c.path(&trail, &stroke(INK, 2.4), 0.3 * on);
    c.path(&trail, &stroke(LIGHT, 0.7), 0.85 * on);
    c.sprite(along(way, head * total).0, 2.6, "pf-glow", on);
}

fn defs() -> String {
    format!(
        r#"{}{}<radialGradient id="pf-deep"><stop stop-color="var(--book-line)" stop-opacity=".5"/><stop offset=".3" stop-color="var(--book-ink)" stop-opacity=".18"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="pf-pool"><stop stop-color="var(--book-light)" stop-opacity=".4"/><stop offset=".35" stop-color="var(--book-line)" stop-opacity=".16"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="pf-shade"><stop stop-color="var(--book-cover)" stop-opacity=".95"/><stop offset=".6" stop-color="var(--book-cover)" stop-opacity=".55"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity="0"/></radialGradient><linearGradient id="pf-top" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--book-cover)" stop-opacity=".95"/><stop offset=".35" stop-color="var(--book-cover)" stop-opacity=".6"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity="0"/></linearGradient><radialGradient id="pf-radiance"><stop stop-color="var(--book-light)" stop-opacity=".5"/><stop offset=".22" stop-color="var(--book-line)" stop-opacity=".26"/><stop offset=".55" stop-color="var(--book-ink)" stop-opacity=".09"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="pf-aura"><stop stop-color="var(--book-line)" stop-opacity=".8"/><stop offset=".55" stop-color="var(--book-ink)" stop-opacity=".4"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".12"/></radialGradient><radialGradient id="pf-father" gradientUnits="userSpaceOnUse" cx="{fx}" cy="{fy}" r="420"><stop stop-color="var(--book-dim)"/><stop offset=".65" stop-color="var(--book-cover)"/></radialGradient><radialGradient id="pf-father-light" gradientUnits="userSpaceOnUse" cx="{fx}" cy="{fy}" r="430"><stop stop-color="var(--book-light)" stop-opacity=".9"/><stop offset=".3" stop-color="var(--book-line)" stop-opacity=".5"/><stop offset=".75" stop-color="var(--book-ink)" stop-opacity=".16"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".05"/></radialGradient><radialGradient id="pf-son-light" gradientUnits="userSpaceOnUse" cx="{sx}" cy="{sy}" r="380"><stop stop-color="var(--book-light)" stop-opacity=".95"/><stop offset=".22" stop-color="var(--book-line)" stop-opacity=".55"/><stop offset=".6" stop-color="var(--book-ink)" stop-opacity=".2"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".04"/></radialGradient><filter id="pf-aura-blur" x="-60%" y="-30%" width="220%" height="160%"><feGaussianBlur stdDeviation="4.5"/></filter>"#,
        glow_defs("pf"),
        edge_defs("pf"),
        fx = FATHER_GLOW.0,
        fy = FATHER_GLOW.1,
        sx = SON_HEART.0,
        sy = SON_HEART.1,
    )
}

fn draw(c: &mut Canvas, t: f64, reduced: bool) {
    let cam = camera(t);
    let art = art_world().then(cam.plane(0.));
    let spoken = phrases();
    let (home, homed) = homecoming();
    let master = if reduced { 1. } else { ramp(t, 0., 1.2) * (1. - ramp(t, PERIOD - 1.8, PERIOD - 0.3)) };
    let here = presence(t);
    let speak = speaking(t);
    let gentle = reassuring(t);
    let inner = lit(t);
    let heard = ramp(t, homed - 0.2, homed + 1.6);
    let b = breath(t);
    c.group("", "", master);
    c.fixed(|| "M-20 -20H340V212H-20Z".into(), &fill(COVER), 1.);

    // The street of code, far blocks first, sinking into a light at its end.
    let deep = cam.project(DEEP);
    let k = cam.scale(DEEP[2]);
    c.path(&ellipse(deep, 6. * k, 2.6 * k), r#"fill="url(#pf-deep)""#, 0.25 + 0.1 * here + 0.15 * heard);
    for block in STREET.iter() {
        let side = [[block.x, block.height, block.near], [block.x, block.height, block.far], [block.x, 0., block.far], [block.x, 0., block.near]];
        let front = [[block.outer, block.height, block.near], [block.x, block.height, block.near], [block.x, 0., block.near], [block.outer, 0., block.near]];
        c.path(&cam.poly(&front), &fill(COVER), 1.);
        c.rain(&cam.poly(&side), &cam.uv_shift(side, [2.6, 3.6], [block.shift / 3., 0.]), 0.26 + 0.08 * here + 0.14 * heard);
        let mut edge = cam.line(&[side[3], side[0], side[1], side[2]]);
        edge.push_str(&cam.line(&[front[0], front[1]]));
        c.path(&edge, &stroke(LINE, 0.3), 0.3 + 0.12 * heard);
    }
    c.fixed(|| "M-20 -20H340V70H-20Z".into(), r#"fill="url(#pf-top)""#, 1.);

    // The road: faint code under lanes and crossings, lit around them.
    let road = [[-2.2, 0., 24.], [2.2, 0., 24.], [2.2, 0., -3.], [-2.2, 0., -3.]];
    c.path(&cam.poly(&road), &fill(COVER), 1.);
    c.rain(&cam.poly(&road), &cam.uv(road, [1.4, 2.6]), 0.07 + 0.05 * heard);
    let mut lanes = String::new();
    for x in [-2.2, -1., 1., 2.2] {
        lanes.push_str(&cam.line(&[[x, 0., -3.], [x, 0., 24.]]));
    }
    for i in 0..12 {
        let z = -2. + 2. * i as f64;
        lanes.push_str(&cam.line(&[[-2.2, 0., z], [2.2, 0., z]]));
    }
    c.path(&lanes, &stroke(LINE, 0.28), 0.1 + 0.06 * heard);
    let son_feet = world((SON_AXIS, GROUND));
    let father_feet = world((560., GROUND));
    // The street hears each phrase arrive: a ring runs out along the road.
    for (j, p) in spoken.iter().enumerate() {
        let f = ramp(t, p.lands, p.lands + 2.6);
        let on = if f > 0. && f < 1. { 0.45 * (1. - f) } else { 0. };
        c.path(&floor_ring(&cam, son_feet, 0.3 + (2.6 + 0.3 * j as f64) * ease(f)), &stroke(LINE, 0.45), on);
    }
    for j in 0..2 {
        let f = ramp(t, homed + 0.6 * j as f64, homed + 0.6 * j as f64 + 3.4);
        let on = if f > 0. && f < 1. { 0.55 * (1. - f) } else { 0. };
        c.path(&floor_ring(&cam, son_feet, 0.3 + 5. * ease(f)), &stroke(LIGHT, 0.5), on);
    }
    c.path(&floor_ring(&cam, father_feet, 0.75), r#"fill="url(#pf-pool)""#, 0.6 * here);
    c.path(&floor_ring(&cam, son_feet, 0.32), r#"fill="url(#pf-shade)""#, 0.85);
    c.path(&floor_ring(&cam, son_feet, 0.5 + 0.2 * heard), r#"fill="url(#pf-pool)""#, 0.7 * heard);
    c.path(&motes(&cam, t, 34, 0, (-2., 2.), (-1., 9.), 5., 0.016), &fill(INK), 0.45);

    // The rings behind him.
    for k in 0..RINGS.len() {
        let d = ring(&cam, t, k, false);
        c.path(&d, &stroke(INK, 2.2), 0.3 * ring_alpha(t, k));
        c.path(&d, &stroke(LIGHT, 0.5), ring_alpha(t, k));
    }

    let body = art.apply((SON_AXIS, 590.));
    c.path(&ellipse(body, 0.45 * cam.scale(0.), 0.85 * cam.scale(0.)), r#"fill="url(#pf-radiance)""#, 0.6 * heard * (0.85 + 0.15 * b));

    // The boy: code under his skin, lit from within a step for every phrase.
    let rise = Affine::about((SON_AXIS, GROUND), 1., 1. + 0.005 * b);
    let boy = rise.then(art);
    let son_solid = figure("son-solid");
    let son_ink = figure("son-ink");
    c.group(r#"filter="url(#pf-aura-blur)""#, "", 0.75 * heard * (0.8 + 0.2 * b));
    c.group("", &Affine::about(SON_HEART, 1.08, 1.04).then(boy).svg(), 1.);
    c.fixed(|| son_solid.map(|p| p), r#"fill="url(#pf-aura)" fill-rule="evenodd""#, 1.);
    c.end();
    c.end();
    c.group("", &boy.svg(), 1.);
    c.fixed(|| son_solid.map(|p| p), &format!(r#"fill="{COVER}" fill-rule="evenodd""#), 1.);
    c.fixed_rain(|| son_solid.map(|p| p), SON_CODE, 0.4 * (1. - 0.8 * inner));
    c.fixed(|| son_solid.map(|p| p), r#"fill="url(#pf-son-light)" fill-rule="evenodd""#, inner * (0.75 + 0.15 * b));
    let edge = |paint: &str| format!(r#"fill="{paint}" fill-rule="evenodd" stroke="{paint}" stroke-width="1.4" stroke-linejoin="round""#);
    c.fixed(|| son_ink.map(|p| p), &edge(INK), 1. - 0.7 * heard);
    c.fixed(|| son_ink.map(|p| p), &edge(LIGHT), 0.85 * heard);
    c.end();
    let son_notch = boy.apply(SON_NOTCH);
    let son_heart = boy.apply(SON_HEART);
    let kindle = bell(t, KINDLE.0, KINDLE.1, BIRTH.0 + 0.2, BIRTH.0 + 0.9);

    // The rings in front of him.
    for k in 0..RINGS.len() {
        let d = ring(&cam, t, k, true);
        c.path(&d, &stroke(INK, 2.2), 0.3 * ring_alpha(t, k));
        c.path(&d, &stroke(LIGHT, 0.55), ring_alpha(t, k));
    }

    // The Father, formed out of that light: aura first, then body, then line.
    // He shines brighter while he speaks, and at the end turns wholly to light.
    let held = father_pose(gentle, b).then(art);
    let father_solid = figure("father-solid");
    let father_ink = figure("father-ink");
    let formed = ramp(t, FORM.0, FORM.0 + 1.2) * (1. - ramp(t, home + 1.2, home + 2.6));
    let radiant = ramp(t, home, home + 0.8);
    let heart = held.apply(FATHER_GLOW);
    c.sprite(heart, 34. + 10. * speak + 18. * radiant, "pf-radiance", formed * (0.7 + 0.3 * speak));
    c.group(r#"filter="url(#pf-aura-blur)""#, "", formed * (0.55 + 0.25 * speak + 0.2 * radiant));
    c.group("", &Affine::about(FATHER_HEART, 1.07, 1.04).then(held).svg(), 1.);
    c.fixed(|| father_solid.map(|p| p), r#"fill="url(#pf-aura)" fill-rule="evenodd""#, 1.);
    c.end();
    c.end();
    c.group("", &held.svg(), 1.);
    c.fixed(|| father_solid.map(|p| p), r#"fill="url(#pf-father)" fill-rule="evenodd""#, here);
    c.fixed(|| father_solid.map(|p| p), r#"fill="url(#pf-father-light)" fill-rule="evenodd""#, ramp(t, FORM.0 + 0.3, FORM.1 - 0.6) * (0.4 + 0.3 * speak + 0.3 * radiant) * (1. - ramp(t, home + 1.4, home + 2.6)));
    c.fixed(|| father_ink.map(|p| p), &edge(LINE), 0.85 * ramp(t, FORM.0 + 1.2, FORM.1) * (1. - ramp(t, home + 0.2, home + 1.6)));
    c.end();
    let notch = held.apply(FATHER_NOTCH);
    let lips = held.apply(FATHER_MOUTH);
    c.sprite(notch, 4. + 2. * speak, "pf-glow", here * (0.25 + 0.6 * speak * (0.7 + 0.3 * (TAU * 1.6 * t).sin())));
    c.sprite(heart, 4. + 1.5 * b, "pf-glow", formed * (0.3 + 0.3 * speak + 0.5 * radiant));

    // His voice, from the notch through the lips, rings out toward the boy.
    for j in 0..3 {
        let mut d = String::new();
        let mut alpha = 0.;
        for p in &spoken {
            let local = t - p.at - 0.45 * j as f64;
            let n = (local / 1.35).floor();
            if local >= 0. && n * 1.35 + 0.45 * j as f64 + 1.2 < p.leaves - p.at {
                let f = (local - n * 1.35) / 1.2;
                if f < 1. {
                    d = arc(lips, 2.5 + 13. * f, -0.8, 0.8);
                    alpha = 0.45 * (1. - f) * here;
                }
            }
        }
        c.path(&d, &stroke(LINE, 0.45), alpha);
    }

    // The light leaving the boy to become the Father, and coming home.
    c.sprite(son_notch, 3. + 5. * kindle, "pf-glow", kindle);
    travel(c, &stream(son_notch, heart, 16.), t, BIRTH.0, BIRTH.1 - BIRTH.0);
    c.sprite(heart, 8. + 26. * ramp(t, BIRTH.1 - 0.2, FORM.0 + 0.8), "pf-glow", bell(t, BIRTH.1 - 0.2, BIRTH.1 + 0.2, FORM.0 + 0.6, FORM.1));
    travel(c, &stream(heart, son_notch, 20.), t, home + 1., homed - home - 1.);
    let arrival = bell(t, homed - 0.3, homed, homed + 0.3, homed + 1.8);
    c.sprite(son_notch, 4. + 22. * ramp(t, homed - 0.3, homed + 1.), "pf-glow", arrival);

    // The phrases: each gathers whole above them as he says it, then sinks
    // into the boy's notch and flares there, a little light left inside him.
    let above = (lerp(lips, son_notch, 0.45).0, cam.project(world((MIDST, 236.))).1 - 9.);
    for p in &spoken {
        let f = ease(ramp(t, p.leaves, p.lands));
        let centre = lerp(above, son_notch, f);
        let size = PHRASE_SIZE * (1. - 0.82 * f);
        let alpha = ramp(t, p.at, p.at + APPEAR) * (1. - ramp(f, 0.65, 1.));
        let settle = 3. * (1. - ease(ramp(t, p.at, p.at + APPEAR)));
        let n = p.lines.len() as f64;
        for (i, &text) in p.lines.iter().enumerate() {
            let y = centre.1 + settle - (n - 1. - i as f64) * LEADING * size;
            let place = format!("translate({:.2} {y:.2}) scale({:.4})", centre.0, size / 10.);
            c.words("", || word(text, 0., 3.6, 10.), &format!(r#"fill="{LIGHT}" filter="url(#pf-blur)""#), &place, 0.55 * alpha);
            c.words(text, || word(text, 0., 3.6, 10.), &fill(LINE), &place, alpha);
        }
        let flare = bell(t, p.lands - 0.15, p.lands + 0.05, p.lands + 0.25, p.lands + 1.2);
        c.sprite(son_notch, 3. + 9. * ramp(t, p.lands - 0.15, p.lands + 0.8), "pf-glow", flare);
    }
    c.sprite(son_heart, 3. + 3. * inner + 1.5 * b, "pf-glow", 0.15 + 0.75 * inner);
    c.sprite(son_heart, 30. + 34. * heard, "pf-radiance", 0.9 * heard);

    c.path(&motes(&cam, t, 10, 500, (-1.6, 1.6), (-2.4, -0.8), 3., 0.012), &fill(LINE), 0.3 + 0.3 * heard);
    soft_edges(c, "pf");
    c.end();
}

pub fn svg() -> String {
    let mut c = Canvas::build(
        "pf",
        "Мальчик один на улице из кода, его стягивают четыре кольца. В его яремной впадине загорается свет, выходит из него и становится Отцом, который опускается перед ним на колено. Из яремной впадины, дыханием, Отец говорит четыре фразы: «Я люблю тебя», «Я никогда не покину тебя», «Прости меня», «Все, что у Меня есть — это Ты». Каждая целиком приходит к мальчику и входит в него, и одно кольцо спадает. Потом Отец светом возвращается в него, и мальчик стоит, светясь изнутри.",
        &defs(),
    );
    draw(&mut c, REST, false);
    c.finish()
}
pub fn frame(seconds: f64, reduced: bool) -> Vec<Update> {
    let reduced = reduced || !seconds.is_finite();
    let mut c = Canvas::frame("pf");
    draw(&mut c, time(seconds, reduced), reduced);
    c.updates
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn phrases_come_one_at_a_time_and_the_father_comes_home_before_the_loop() {
        let spoken = phrases();
        assert!(spoken[0].at > FORM.1 - 0.3, "he has formed before he speaks");
        for pair in spoken.windows(2) {
            assert!(pair[0].lands < pair[1].at, "one phrase at a time");
        }
        for p in &spoken {
            assert!(p.leaves - p.at > 2., "every phrase is read whole");
        }
        let (home, homed) = homecoming();
        assert!(home > spoken[3].lands && homed + 2. < PERIOD - 1.8);
        assert!(REST > spoken[3].lands + FALL && REST <= home);
    }
    #[test]
    fn the_father_is_born_of_the_boys_light_and_returns_into_it() {
        assert_eq!(presence(KINDLE.0), 0.);
        assert!(presence(REST) > 0.99);
        assert_eq!(presence(PERIOD - 1.), 0.);
        assert!(lit(phrases()[0].at) < 1e-9);
        assert!((lit(PERIOD - 2.) - 1.).abs() < 1e-9, "the boy ends wholly lit");
        let w = |p: P| world(p);
        assert!(w(FATHER_NOTCH)[0] < w(SON_NOTCH)[0], "the Father kneels on the left");
        assert!((w((SON_AXIS, 266.))[1] - 1.22).abs() < 0.01);
    }
    #[test]
    fn each_phrase_frees_one_ring() {
        let spoken = phrases();
        for (k, p) in spoken.iter().enumerate() {
            let cam = camera(p.lands);
            assert!(!ring(&cam, p.lands - 0.01, k, true).is_empty() || !ring(&cam, p.lands - 0.01, k, false).is_empty());
            assert!(ring(&cam, p.lands + FALL, k, true).is_empty() && ring(&cam, p.lands + FALL, k, false).is_empty());
            assert_eq!(ring_alpha(p.lands + FALL, k), 0.);
            if k + 1 < RINGS.len() {
                assert!(ring_alpha(p.lands + FALL, k + 1) > 0.4, "the next one still binds him");
            }
        }
    }
}
