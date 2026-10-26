//! Practice 4, "Слышание и чувствование". The Son stands sealed in a jar of
//! code; the Father stands to his side and well behind him, never above.
//! Three breaths climb the glass from inside while three of the Father's
//! phrases fly straight to it from outside; the third of each meets at one
//! point and the program breaks. Its pieces gather into the Spirit: the
//! breath between them, a straight line of light carrying the exchange both
//! ways.
use crate::{practice_stage::*, step_three::Update};
use std::{
    f64::consts::{FRAC_PI_2, PI, TAU},
    sync::LazyLock,
};

pub const PERIOD: f64 = 26.;
/// The reduced-motion still: the breath flowing between them, both as one.
pub const REST: f64 = 19.;

const SON: W = [0.7, 0., 0.];
const SON_HEIGHT: f64 = 1.75;
/// Farther back, so tall enough that their heads stay level on screen.
const FATHER: W = [-0.95, 0., 2.3];
const FATHER_HEIGHT: f64 = 1.92;
/// The jar: a glass cylinder with a hemispherical dome around the Son.
const JAR_R: f64 = 0.5;
const JAR_WALL: f64 = 1.95;
/// "ПРОГРАММА" runs three times around the glass at chest height.
const BAND: f64 = 1.05;
const BAND_TEXT: &str = "ПРОГРАММА ";
const BAND_LETTERS: usize = 30;
/// Centre of the floor rings: between the two figures.
const MIDDLE: W = [-0.12, 0., 1.15];
/// The shaft: a cylinder of code walls around the stage, open toward the eye.
const SHAFT: (f64, f64) = (1.5, 6.);
const SHAFT_ARC: f64 = 1.4;
const SHAFT_TOP: f64 = 9.;
const FACETS: usize = 16;
const BREATHS: [f64; 3] = [2.2, 5.2, 8.2];
const REACH: [f64; 3] = [0.45, 0.8, 1.];
/// One phrase at a time on the one straight way: each is gone into the glass
/// before the next leaves him.
const PHRASES: [(&str, f64); 3] = [("Я ЛЮБЛЮ ТЕБЯ", 5.3), ("ПРОСТИ МЕНЯ", 7.1), ("ЭТО ТЫ", 8.9)];
const PHRASE_TIME: f64 = 1.6;
const PHRASE_SIZE: f64 = 6.5;
const IMPACT_AT: f64 = 10.5;
const BREAK_AT: f64 = 12.2;
/// World azimuth and dome latitude where the last breath and word meet:
/// on the Father's side of the dome, still turned to the eye.
const IMPACT: (f64, f64) = (-0.91, 0.6);

fn camera(t: f64) -> Camera {
    Camera {
        eye: wmix([0.12, 1.45, -6.3], [0., 1.3, -5.3], ramp(t, 0., 25.4)),
        focal: 300.,
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
/// The Father's calm rhythm; the Son joins it once the glass is gone.
fn together(t: f64) -> f64 {
    0.5 - 0.5 * (TAU * (t - 12.) / 3.2).cos()
}
fn son_breath(t: f64) -> f64 {
    if t >= 12. {
        return together(t);
    }
    BREATHS
        .iter()
        .map(|&b| ramp(t, b, b + 1.3) * (1. - ramp(t, b + 1.3, b + 3.)))
        .sum()
}
fn presence(t: f64) -> f64 {
    0.3 + 0.25 * ramp(t, 4., 7.) + 0.45 * ramp(t, 9.5, 11.)
}
fn speaking(t: f64) -> f64 {
    PHRASES
        .iter()
        .map(|&(_, s)| bell(t, s - 0.15, s + 0.1, s + 0.8, s + 1.3))
        .fold(0., f64::max)
}
fn unity(t: f64) -> f64 {
    bell(t, 17.5, 19., 22.5, 24.)
}
fn wrap(a: f64) -> f64 {
    (a + PI).rem_euclid(TAU) - PI
}

/// A point of the glass by world azimuth (0 faces −z) and height along the
/// surface; heights past the wall climb the dome.
fn jar_point(theta: f64, s: f64) -> W {
    let (sin, cos) = theta.sin_cos();
    let (rise, ring) = if s <= JAR_WALL {
        (s, JAR_R)
    } else {
        let lat = ((s - JAR_WALL) / JAR_R).min(FRAC_PI_2);
        (JAR_WALL + JAR_R * lat.sin(), JAR_R * lat.cos())
    };
    [SON[0] + ring * sin, rise, SON[2] - ring * cos]
}
fn jar_normal(theta: f64, s: f64) -> W {
    let (sin, cos) = theta.sin_cos();
    let lat = ((s - JAR_WALL) / JAR_R).clamp(0., FRAC_PI_2);
    [lat.cos() * sin, lat.sin(), -lat.cos() * cos]
}
fn facing(cam: &Camera, theta: f64, s: f64) -> bool {
    dot(jar_normal(theta, s), sub(cam.eye, jar_point(theta, s))) > 0.
}
/// The eye's azimuth around the jar, and the half-angle of the visible front.
fn view(cam: &Camera) -> (f64, f64) {
    let (dx, dz) = (cam.eye[0] - SON[0], cam.eye[2] - SON[2]);
    (dx.atan2(-dz), (JAR_R / dx.hypot(dz)).acos())
}
/// Where the dome turns away from the eye: a circle on the sphere whose ends
/// meet the wall's two tangent lines, left to right over the top.
fn dome_rim(cam: &Camera) -> Vec<W> {
    let top = [SON[0], JAR_WALL, SON[2]];
    let e = sub(cam.eye, top);
    let q = dot(e, e);
    let centre = add(top, scaled(e, JAR_R * JAR_R / q));
    let rho = JAR_R * (1. - JAR_R * JAR_R / q).sqrt();
    let u = unit(cross(e, [0., 1., 0.]));
    let v = cross(u, unit(e));
    let m = ((JAR_WALL - centre[1]) / (rho * v[1])).clamp(-1., 1.).asin();
    (0..=24)
        .map(|i| {
            let a = mix(PI - m, m, i as f64 / 24.);
            add(centre, add(scaled(u, rho * a.cos()), scaled(v, rho * a.sin())))
        })
        .collect()
}
fn silhouette(cam: &Camera) -> Vec<P> {
    let (eye, half) = view(cam);
    let mut out = vec![jar_point(eye - half, 0.)];
    out.extend(dome_rim(cam));
    out.push(jar_point(eye + half, 0.));
    out.extend((1..24).map(|i| jar_point(mix(eye + half, eye - half, i as f64 / 24.), 0.)));
    out.into_iter().map(|p| cam.project(p)).collect()
}
/// A level ring of the glass, front or back half.
fn jar_ring(cam: &Camera, s: f64, front: bool) -> String {
    let (eye, half) = view(cam);
    let (a, b) = if front { (eye - half, eye + half) } else { (eye + half, eye + TAU - half) };
    cam.line(&(0..=32).map(|i| jar_point(mix(a, b, i as f64 / 32.), s)).collect::<Vec<_>>())
}
fn streak(cam: &Camera, theta: f64, from: f64, to: f64) -> String {
    cam.line(&(0..=16).map(|i| jar_point(theta, mix(from, to, i as f64 / 16.))).collect::<Vec<_>>())
}
fn impact() -> W {
    jar_point(IMPACT.0, JAR_WALL + IMPACT.1 * JAR_R)
}
fn band(cam: &Camera, t: f64) -> String {
    let (eye, half) = view(cam);
    let step = TAU / BAND_LETTERS as f64;
    let size = step * JAR_R / ADVANCE;
    let turn = -t * 0.16;
    let mut d = String::new();
    for (i, c) in BAND_TEXT.chars().cycle().take(BAND_LETTERS).enumerate() {
        let start = turn + i as f64 * step;
        if c == ' ' || wrap(start + step / 2. - eye).abs() > 0.9 * half {
            continue;
        }
        glyph(&mut d, c, |x, y| {
            cam.project(jar_point(start + x * size / JAR_R, BAND + (y - 0.36) * size))
        });
    }
    d
}

/// Fractures of the glass: branches in surface metres (azimuth × radius,
/// height), each segment with its distance from the impact along the tree.
struct Crack {
    a: P,
    b: P,
    from: f64,
    to: f64,
}
static CRACKS: LazyLock<Vec<Crack>> = LazyLock::new(|| {
    let mut out = Vec::new();
    let origin = (IMPACT.0 * JAR_R, JAR_WALL + IMPACT.1 * JAR_R);
    for k in 0..7 {
        let mut dir = k as f64 / 7. * TAU + hash(k) * 0.6;
        let (mut p, mut walked) = (origin, 0.);
        for j in 0..5 + (hash(k + 20) * 4.) as usize {
            dir += (hash(k * 31 + j) - 0.5) * 0.7;
            let len = 0.07 + hash(k * 17 + j + 5) * 0.1;
            let q = (p.0 + len * dir.cos(), p.1 + len * dir.sin());
            out.push(Crack { a: p, b: q, from: walked, to: walked + len });
            if j == 1 || j == 3 {
                let mut side = dir + if hash(k * 7 + j) > 0.5 { 0.65 } else { -0.65 };
                let (mut r, mut at) = (q, walked + len);
                for m in 0..3 {
                    side += (hash(k * 53 + j * 7 + m) - 0.5) * 0.6;
                    let l = 0.05 + hash(k * 13 + j * 3 + m) * 0.06;
                    let w = (r.0 + l * side.cos(), r.1 + l * side.sin());
                    out.push(Crack { a: r, b: w, from: at, to: at + l });
                    (r, at) = (w, at + l);
                }
            }
            (p, walked) = (q, walked + len);
        }
    }
    out
});
fn cracks(cam: &Camera, reach: f64) -> String {
    let mut d = String::new();
    for c in CRACKS.iter().filter(|c| c.from < reach && c.a.1 > 0. && c.b.1 > 0.) {
        let end = lerp(c.a, c.b, ((reach - c.from) / (c.to - c.from)).min(1.));
        let at = |p: P| (p.0 / JAR_R, p.1);
        let points = [c.a, lerp(c.a, end, 0.5), end].map(at);
        if points.iter().all(|&(theta, s)| facing(cam, theta, s)) {
            d.push_str(&cam.line(&points.map(|(theta, s)| jar_point(theta, s))));
        }
    }
    d
}

/// A piece of the broken front: its centre, outline around it, outward
/// normal, when it lets go, and how it tumbles.
struct Shard {
    centre: W,
    outline: Vec<W>,
    normal: W,
    delay: f64,
    axis: W,
    turn: f64,
}
static SHARDS: LazyLock<Vec<Shard>> = LazyLock::new(|| {
    let (eye, half) = view(&camera(BREAK_AT));
    let (columns, rows) = (6, 6);
    let top = JAR_WALL + JAR_R * 0.95;
    let node = |i: usize, j: usize| {
        let inner = |n: usize, of: usize| n > 0 && n < of;
        let jitter = |k: usize| if inner(i, columns) && inner(j, rows) { (hash(k) - 0.5) * 0.55 } else { 0. };
        (
            eye + mix(-0.97, 0.97, (i as f64 + jitter(i * 13 + j * 7)) / columns as f64) * half,
            top * (j as f64 + jitter(i * 5 + j * 11 + 300)) / rows as f64,
        )
    };
    let hit = impact();
    let mut out = Vec::new();
    for i in 0..columns {
        for j in 0..rows {
            let corners = [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)];
            let mut outline = Vec::new();
            for k in 0..4 {
                let (a, b) = (corners[k], corners[(k + 1) % 4]);
                outline.push(jar_point(a.0, a.1));
                outline.push(jar_point((a.0 + b.0) / 2., (a.1 + b.1) / 2.));
            }
            let mid = corners.iter().fold((0., 0.), |m, c| (m.0 + c.0 / 4., m.1 + c.1 / 4.));
            let centre = jar_point(mid.0, mid.1);
            let away = sub(centre, hit);
            let n = i * rows + j;
            out.push(Shard {
                outline: outline.into_iter().map(|p| sub(p, centre)).collect(),
                normal: jar_normal(mid.0, mid.1),
                delay: BREAK_AT + 0.3 * dot(away, away).sqrt(),
                axis: unit([hash(n) - 0.5, hash(n + 40) - 0.5, hash(n + 80) - 0.5]),
                turn: 2. + hash(n + 120) * 4.,
                centre,
            });
        }
    }
    out
});
impl Shard {
    fn at(&self, t: f64) -> W {
        let tau = (t - self.delay).max(0.);
        let away = unit(sub(self.centre, impact()));
        let velocity = add(add(scaled(self.normal, 0.7), scaled(away, 0.55)), [0., 0.35, 0.]);
        add(add(self.centre, scaled(velocity, tau)), [0., -0.8 * tau * tau, 0.])
    }
}
fn shards(cam: &Camera, t: f64) -> String {
    let mut d = String::new();
    for s in SHARDS.iter() {
        let tau = (t - s.delay).max(0.);
        let k = 1. - ramp(tau, 0.15, 1.2);
        if k < 0.02 {
            continue;
        }
        let at = s.at(t);
        let points: Vec<W> = s
            .outline
            .iter()
            .map(|&o| add(at, scaled(spin(o, s.axis, s.turn * tau), k)))
            .collect();
        d.push_str(&cam.poly(&points));
    }
    d
}
/// The Spirit: the breath between them, from the Father's throat to the Son's.
fn spirit() -> (W, W) {
    (unseal_world(FATHER, FATHER_HEIGHT, UNSEAL_THROAT), unseal_world(SON, SON_HEIGHT, UNSEAL_THROAT))
}
/// The pieces become light and settle along the breath between them: the
/// program becomes breath.
fn rising(cam: &Camera, t: f64) -> String {
    let (father, son) = spirit();
    let mut d = String::new();
    for (i, s) in SHARDS.iter().enumerate() {
        let tau = t - s.delay - 0.9;
        if tau <= 0. {
            continue;
        }
        let m = ease(tau / 2.8);
        let goal = wmix(son, father, 0.08 + 0.84 * hash(i + 7));
        let p = add(wmix(s.at(s.delay + 0.9), goal, m), [0., 0.3 * (m * PI).sin(), 0.]);
        let r = 0.016 * ramp(tau, 0., 0.3) * (1. - ramp(m, 0.8, 1.));
        if r > 1e-4 {
            d.push_str(&circle(cam.project(p), (r * cam.scale(p[2])).max(0.25)));
        }
    }
    d
}

/// A straight flight between two world points, as the eye sees it.
fn straight(cam: &Camera, a: W, b: W) -> Vec<P> {
    let (a, b) = (cam.project(a), cam.project(b));
    (0..=8).map(|i| lerp(a, b, i as f64 / 8.)).collect()
}
fn wall(i: f64, y: f64) -> W {
    let a = mix(-SHAFT_ARC, SHAFT_ARC, i / FACETS as f64);
    [SHAFT.1 * a.sin(), y, SHAFT.0 + SHAFT.1 * a.cos()]
}

/// Where both figures are drawn; the camera carries them with a transform.
fn references() -> (Placement, Placement) {
    let cam = camera(0.);
    (Placement::standing(&cam, FATHER, FATHER_HEIGHT), Placement::standing(&cam, SON, SON_HEIGHT))
}
/// Rain fixed on a figure's own plane, three columns across.
fn body_code(feet: W, height: f64) -> String {
    let (w, h) = (0.6, height + 0.2);
    camera(0.).uv(
        [[feet[0] - w, h, feet[2]], [feet[0] + w, h, feet[2]], [feet[0] + w, 0., feet[2]], [feet[0] - w, 0., feet[2]]],
        [2. * w / 3., h / 2.5],
    )
}

fn defs() -> String {
    let (father, son) = references();
    let heart = father.at(UNSEAL_HEART);
    let r = 0.95 * father.scale * 722. / FATHER_HEIGHT;
    let core = son.at(UNSEAL_HEART);
    let reach = 0.55 * 722. * son.scale;
    format!(
        r#"{}<radialGradient id="tri-spill"><stop stop-color="var(--book-line)" stop-opacity=".24"/><stop offset=".45" stop-color="var(--book-ink)" stop-opacity=".09"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="tri-pool"><stop stop-color="var(--book-light)" stop-opacity=".4"/><stop offset=".35" stop-color="var(--book-line)" stop-opacity=".16"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="tri-shade"><stop stop-color="var(--book-cover)" stop-opacity=".95"/><stop offset=".6" stop-color="var(--book-cover)" stop-opacity=".55"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity="0"/></radialGradient><linearGradient id="tri-top" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--book-cover)" stop-opacity=".92"/><stop offset=".3" stop-color="var(--book-cover)" stop-opacity=".66"/><stop offset=".65" stop-color="var(--book-cover)" stop-opacity=".24"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity="0"/></linearGradient><linearGradient id="tri-bottom" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--book-cover)" stop-opacity="0"/><stop offset=".5" stop-color="var(--book-cover)" stop-opacity=".4"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity=".95"/></linearGradient><radialGradient id="tri-edge" cx=".5" cy=".47" r=".62"><stop offset=".5" stop-color="var(--book-cover)" stop-opacity="0"/><stop offset=".68" stop-color="var(--book-cover)" stop-opacity=".22"/><stop offset=".84" stop-color="var(--book-cover)" stop-opacity=".68"/><stop offset="1" stop-color="var(--book-cover)"/></radialGradient><radialGradient id="tri-father" gradientUnits="userSpaceOnUse" cx="{hx:.2}" cy="{hy:.2}" r="{r:.2}"><stop stop-color="var(--book-dim)"/><stop offset=".6" stop-color="var(--book-cover)"/></radialGradient><radialGradient id="tri-aura" gradientUnits="userSpaceOnUse" cx="{hx:.2}" cy="{hy:.2}" r="{r:.2}"><stop stop-color="var(--book-line)" stop-opacity=".75"/><stop offset=".5" stop-color="var(--book-ink)" stop-opacity=".35"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".1"/></radialGradient><radialGradient id="tri-inner" gradientUnits="userSpaceOnUse" cx="{cx:.2}" cy="{cy:.2}" r="{reach:.2}"><stop stop-color="var(--book-light)" stop-opacity=".95"/><stop offset=".22" stop-color="var(--book-line)" stop-opacity=".55"/><stop offset=".55" stop-color="var(--book-ink)" stop-opacity=".2"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><filter id="tri-aura-blur" x="-80%" y="-30%" width="260%" height="160%"><feGaussianBlur stdDeviation="4.5"/></filter>"#,
        glow_defs("tri"),
        hx = heart.0,
        hy = heart.1,
        cx = core.0,
        cy = core.1,
    )
}

fn draw(c: &mut Canvas, t: f64, reduced: bool) {
    let cam = camera(t);
    let (reference, son_reference) = references();
    let son = Placement::standing(&cam, SON, SON_HEIGHT);
    let here = presence(t);
    let together_now = unity(t);
    let master = if reduced { 1. } else { ramp(t, 0., 1.) * (1. - ramp(t, 23.8, 25.4)) };
    let glass = 1. - ramp(t, BREAK_AT, BREAK_AT + 0.25);
    let light = ramp(t, 12.6, 15.);
    c.group("", "", master);

    // The shaft: code walls curving around the stage, fading up into the dark.
    c.fixed(|| "M-20 -20H340V212H-20Z".into(), &fill(COVER), 1.);
    let width = 2. * SHAFT.1 * (SHAFT_ARC / FACETS as f64).sin();
    for i in 0..FACETS {
        let quad = [wall(i as f64, SHAFT_TOP), wall(i as f64 + 1., SHAFT_TOP), wall(i as f64 + 1., 0.), wall(i as f64, 0.)];
        let mid = mix(-SHAFT_ARC, SHAFT_ARC, (i as f64 + 0.5) / FACETS as f64);
        let uv = cam.uv_shift(quad, [width / 6., SHAFT_TOP / 5.], [i as f64 * width / 6., 0.]);
        c.rain(&cam.poly(&quad), &uv, 0.16 + 0.16 * mid.cos().powi(3) + 0.08 * together_now);
    }
    let behind = wall(FACETS as f64 * (0.5 + 0.03 / SHAFT_ARC / 2.), 1.9);
    let spill = cam.scale(behind[2]);
    c.path(&ellipse(cam.project(behind), 2.4 * spill, 3.4 * spill), r#"fill="url(#tri-spill)""#, 0.55 + 0.35 * here + 0.2 * together_now);
    let mut rings = String::new();
    for y in [0.7, 1.9, 3.3, 5., 6.8] {
        rings.push_str(&cam.line(&(0..=32).map(|i| wall(i as f64 / 2., y)).collect::<Vec<_>>()));
    }
    c.path(&rings, &stroke(LINE, 0.3), 0.12);
    let mut columns = String::new();
    for i in 0..=FACETS {
        columns.push_str(&cam.line(&[wall(i as f64, 0.), wall(i as f64, SHAFT_TOP)]));
    }
    c.path(&columns, &stroke(LINE, 0.25), 0.08);
    c.fixed(|| "M-20 -20H340V100H-20Z".into(), r#"fill="url(#tri-top)""#, 1.);
    c.path(&motes(&cam, t, 36, 0, (-4.5, 4.5), (2.5, 7.), 7., 0.02), &fill(INK), 0.5);

    // Floor: a disc of faint code under rings centred between the figures.
    c.path(&floor_ring(&cam, [0., 0., SHAFT.0], SHAFT.1), &fill(COVER), 1.);
    let floor = [[-6., 0., 7.5], [6., 0., 7.5], [6., 0., -4.5], [-6., 0., -4.5]];
    c.rain(&floor_ring(&cam, [0., 0., SHAFT.0], SHAFT.1), &cam.uv(floor, [4., 4.8]), 0.1);
    let seam: Vec<W> = (0..=32).map(|i| wall(i as f64 / 2., 0.)).collect();
    c.path(&cam.line(&seam), &stroke(INK, 2.6), 0.12);
    c.path(&cam.line(&seam), &stroke(LINE, 0.55), 0.5);
    let mut grid = String::new();
    for r in [1.1, 1.9, 2.8, 3.8, 4.8] {
        grid.push_str(&floor_ring(&cam, MIDDLE, r));
    }
    c.path(&grid, &stroke(LINE, 0.35), 0.13);
    let mut rays = String::new();
    for k in 0..16 {
        let a = k as f64 / 16. * TAU;
        let ray = |r: f64| [MIDDLE[0] + r * a.cos(), 0., MIDDLE[2] + r * a.sin()];
        rays.push_str(&cam.line(&[ray(1.1), ray(4.8)]));
    }
    c.path(&rays, &stroke(LINE, 0.3), 0.07);
    for k in 0..2 {
        let f = ((t - 12.) / 3.2 + k as f64 * 0.5).rem_euclid(1.);
        let on = ramp(t, 13., 14.) * (1. - ramp(t, 22., 23.5));
        c.path(&floor_ring(&cam, MIDDLE, 0.4 + 4.2 * f), &stroke(LINE, 0.45), 0.35 * (1. - f) * on);
    }
    c.path(&floor_ring(&cam, FATHER, 0.95), r#"fill="url(#tri-pool)""#, 0.35 + 0.45 * here);
    c.path(&floor_ring(&cam, SON, 0.45), r#"fill="url(#tri-shade)""#, 0.9);

    // The Father, drawn once at a reference place and carried by the camera.
    let father = Placement::standing(&cam, FATHER, FATHER_HEIGHT);
    let speak = speaking(t);
    let father_breath = together(t);
    let father_open = 0.85 * ramp(t, 17.5, 19.5) * (1. - ramp(t, 23., 24.5));
    c.group("", &father.from(reference), here);
    c.group(r#"filter="url(#tri-aura-blur)""#, "", 0.45 + 0.25 * speak + 0.3 * together_now);
    c.fixed(|| unseal_silhouette(reference), r#"fill="url(#tri-aura)""#, 1.);
    c.end();
    let code = body_code(FATHER, FATHER_HEIGHT);
    still_unseal(
        c,
        reference,
        father_breath,
        father_open,
        &Look {
            cover: r#"fill="url(#tri-father)" fill-rule="evenodd""#,
            ink: &format!(r#"fill="{LINE}" fill-opacity=".85" fill-rule="evenodd" stroke="{LINE}" stroke-opacity=".85" stroke-width=".18""#),
            code: Some((&code, 0.14)),
            glow: None,
        },
    );
    let throat = unseal_mark(reference, UNSEAL_THROAT, father_breath, father_open);
    c.sprite(throat, 5., "tri-glow", 0.6 * speak);
    c.sprite(unseal_mark(reference, UNSEAL_HEART, father_breath, father_open), 4. + 1.5 * father_breath, "tri-glow", 0.25 + 0.3 * speak + 0.35 * light);
    c.end();

    // The unity haze sits between them, behind the Son.
    let son_heart = unseal_world(SON, SON_HEIGHT, UNSEAL_HEART);
    let father_heart = unseal_world(FATHER, FATHER_HEIGHT, UNSEAL_HEART);
    let mid = cam.project(wmix(son_heart, father_heart, 0.45));
    c.sprite(mid, 18. + 34. * together_now, "tri-haze", 0.9 * together_now);

    // Back of the jar, seen through the glass behind the Son.
    let (eye, half) = view(&cam);
    let mut back = jar_ring(&cam, 0.02, false);
    for s in [BAND - 0.11, BAND + 0.11] {
        back.push_str(&jar_ring(&cam, s, false));
    }
    c.path(&back, &stroke(LINE, 0.35), 0.2 * glass);
    c.path(&floor_ring(&cam, SON, 0.6), &format!(r#"fill="{INK}" fill-opacity=".05" {}"#, stroke(LINE, 0.35)), 0.35 * glass);

    // The Son: solid, carrying his code, until the light rises inside him.
    let breath = son_breath(t);
    let open = 0.6 * ramp(t, 18., 20.) * (1. - ramp(t, 23., 24.5));
    let code = body_code(SON, SON_HEIGHT);
    c.group("", &son.from(son_reference), 1.);
    still_unseal(
        c,
        son_reference,
        breath,
        open,
        &Look {
            cover: &format!(r#"fill="{COVER}" fill-rule="evenodd""#),
            ink: &format!(r#"fill="{INK}" fill-rule="evenodd" stroke="{INK}" stroke-width=".18""#),
            code: Some((&code, 0.16 * (1. - 0.7 * light))),
            glow: Some((r#"fill="url(#tri-inner)" fill-rule="evenodd""#, light * (0.55 + 0.3 * breath))),
        },
    );
    c.end();
    let heart = unseal_mark(son, UNSEAL_HEART, breath, open);
    c.sprite(heart, 3. + 2.2 * breath, "tri-glow", 0.22 * breath * (1. - light) + light * (0.7 + 0.3 * breath));

    // Breath climbing the inside of the glass.
    let hit = impact();
    let inside = sub(hit, scaled(jar_normal(IMPACT.0, JAR_WALL + IMPACT.1 * JAR_R), 0.03));
    let start = unseal_world(SON, SON_HEIGHT, UNSEAL_THROAT);
    let climb: Vec<P> = (0..=28)
        .map(|i| cam.project(cubic(start, add(start, [-0.02, 0.42, 0.]), add(inside, [0.14, -0.3, 0.05]), inside, i as f64 / 28.)))
        .collect();
    let (mut head, mut tail, mut glow) = (0., 0., 0.);
    for (k, &b) in BREATHS.iter().enumerate() {
        if t >= b + 1.2 && t < if k == 2 { 12.6 } else { b + 3.6 } {
            head = REACH[k] * ramp(t, b + 1.3, b + 2.3);
            tail = REACH[k] * if k == 2 { ramp(t, 11.6, 12.4) } else { ramp(t, b + 1.8, b + 3.) };
            glow = if k == 2 { 1. - ramp(t, 12.2, 12.6) } else { 1. - ramp(t, b + 2.6, b + 3.) };
        }
    }
    let thread = part(&climb, tail, head);
    c.path(&thread, &stroke(INK, 2.2), 0.3 * glow);
    c.path(&thread, &stroke(LIGHT, 0.7), 0.9 * glow);
    c.sprite(along(&climb, head * length(&climb)).0, 2.2, "tri-glow", glow * (head - tail).min(0.15) / 0.15);

    // The glass: faint code, a hard outline, rim light and the turning label.
    let outline = silhouette(&cam);
    let jar = poly(&outline);
    c.path(&jar, &fill(INK), 0.05 * glass);
    c.rain(&jar, &cam.uv([jar_point(eye - half, 2.45), jar_point(eye + half, 2.45), jar_point(eye + half, 0.), jar_point(eye - half, 0.)], [1. / 3., 2.45 / 2.5]), 0.12 * glass);
    c.path(&jar, &stroke(LINE, 0.45), 0.55 * glass);
    let mut rim = streak(&cam, eye + 0.82 * half, 0.12, JAR_WALL + 0.45);
    rim.push_str(&jar_ring(&cam, 0., true));
    c.path(&rim, &stroke(LINE, 0.7), 0.5 * glass);
    c.path(&streak(&cam, eye - 0.62 * half, 0.3, 1.7), &stroke(LINE, 0.35), 0.25 * glass);
    let mut belt = String::new();
    for s in [BAND - 0.11, BAND + 0.11] {
        belt.push_str(&jar_ring(&cam, s, true));
    }
    c.path(&belt, &stroke(LINE, 0.3), 0.35 * glass);
    c.path(&band(&cam, t), &fill(LINE), 0.55 * glass);
    let reach = 1.7 * ramp(t, IMPACT_AT, 12.);
    let broken = cracks(&cam, reach);
    c.path(&broken, &stroke(LINE, 0.9), 0.3 * glass);
    c.path(&broken, &stroke(LIGHT, 0.35), 0.9 * glass);
    let shatter = ramp(t, BREAK_AT, BREAK_AT + 0.1) * (1. - ramp(t, 14., 14.6));
    c.path(&shards(&cam, t), &format!(r#"fill="{INK}" fill-opacity=".22" {}"#, stroke(LINE, 0.35)), shatter);
    c.path(&rising(&cam, t), &fill(LIGHT), 0.9);

    // The Father's words fly straight to the glass, ringing out from him; he
    // stands on the left, so they read left to right as they travel.
    let (mouth, _) = spirit();
    let flight = straight(&cam, add(mouth, [0.12, 0.06, -0.1]), hit);
    let total = length(&flight);
    for &(text, at) in &PHRASES {
        let u = (t - at) / PHRASE_TIME;
        let width = text_width(text, PHRASE_SIZE);
        let d = if (0. ..1.).contains(&u) { text_along(text, &flight, (total + width) * u - width, PHRASE_SIZE) } else { String::new() };
        c.path(&d, &fill(LINE), 1.);
    }
    let voice = cam.project(mouth);
    for j in 0..3 {
        let mut d = String::new();
        let mut alpha = 0.;
        for &(_, at) in &PHRASES {
            let f = (t - at - 0.3 * j as f64) / 1.1;
            if (0. ..1.).contains(&f) {
                d = arc(voice, 2.5 + 15. * f, (-120_f64).to_radians(), 20_f64.to_radians());
                alpha = 0.55 * (1. - f);
            }
        }
        c.path(&d, &stroke(LINE, 0.45), alpha);
    }
    let spot = cam.project(hit);
    for j in 0..2 {
        let mut d = String::new();
        let mut alpha = 0.;
        for &(text, at) in &PHRASES {
            let arrive = at + PHRASE_TIME * total / (total + text_width(text, PHRASE_SIZE));
            let f = (t - arrive - 0.35 * j as f64) / 0.9;
            if (0. ..1.).contains(&f) {
                d = ellipse(spot, 1.5 + 9. * f, (1.5 + 9. * f) * 0.7);
                alpha = 0.6 * (1. - f) * glass;
            }
        }
        c.path(&d, &stroke(LINE, 0.4), alpha);
    }
    let flash = ramp(t, IMPACT_AT - 0.05, 11.2);
    c.sprite(spot, 3. + 22. * flash, "tri-glow", bell(t, IMPACT_AT - 0.1, IMPACT_AT + 0.05, IMPACT_AT + 0.2, 11.6));

    // The Spirit is the breath between them: one straight line of light from
    // throat to throat, growing from both ends until it meets in the middle.
    let (from, to) = (cam.project(mouth), cam.project(unseal_world(SON, SON_HEIGHT, UNSEAL_THROAT)));
    let middle = lerp(from, to, 0.5);
    let drawn = ramp(t, 14.3, 15.8);
    let fade = 1. - ramp(t, 23., 24.5);
    let mut breath_line = line(&[from, lerp(from, middle, drawn)]);
    breath_line.push_str(&line(&[to, lerp(to, middle, drawn)]));
    c.path(&breath_line, &stroke(INK, 2.4), 0.25 * fade);
    c.path(&breath_line, &stroke(LINE, 0.55), (0.6 + 0.3 * together_now) * fade);
    // The exchange: Father to Son on the first half of each shared breath,
    // Son to Father on the second.
    let flowing = ramp(t, 15.4, 16.4) * fade;
    let half = ((t - 12.) / 3.2).rem_euclid(1.);
    let (a, b, f) = if half < 0.5 { (from, to, 2. * half) } else { (to, from, 2. * half - 1.) };
    let pulse = flowing * (PI * f).sin();
    let (mut trails, mut heads) = (String::new(), String::new());
    if pulse > 0.01 {
        for k in 0..2 {
            let u = ease(((f - 0.18 * k as f64) / 0.82).clamp(0., 1.));
            let head = lerp(a, b, u);
            trails.push_str(&line(&[lerp(a, b, (u - 0.16).max(0.)), head]));
            heads.push_str(&circle(head, 0.9 - 0.3 * k as f64));
        }
    }
    c.path(&trails, &stroke(LINE, 0.6), 0.8 * pulse);
    c.path(&heads, &fill(LIGHT), pulse);
    c.sprite(a, 3. + 1.5 * together_now, "tri-glow", flowing * 0.45 * (1. - ramp(f, 0., 0.4)));
    c.sprite(b, 3. + 2. * together_now, "tri-glow", flowing * 0.75 * ramp(f, 0.6, 1.));
    let points = [cam.project(father_heart), cam.project(son_heart), middle];
    let shown = [ramp(t, 14.6, 15.3), ramp(t, 14.6, 15.3), ramp(t, 15.6, 16.3)];
    let mut marks = String::new();
    for (k, end) in [from, to].into_iter().enumerate() {
        if drawn > 0. {
            marks.push_str(&ticks(end, 2.6 + 0.6 * father_breath, 12, t * 0.5 + k as f64));
        }
    }
    c.path(&marks, &stroke(LINE, 0.4), 0.6 * shown[0] * fade);
    for (k, (label, offset)) in [("ОТЕЦ", (-24., 2.2)), ("СЫН", (24., 2.2)), ("ДУХ", (0., -6.))].into_iter().enumerate() {
        let place = format!("translate({:.2} {:.2})", points[k].0 + offset.0, points[k].1 + offset.1);
        c.words(label, || word(label, 0., 0., 7.5), &fill(LINE), &place, shown[k] * fade);
    }

    c.path(&motes(&cam, t, 10, 500, (-2.6, 2.4), (-3., -1.2), 4., 0.014), &fill(LINE), 0.35);
    // Every edge dissolves softly into the page.
    c.fixed(|| "M-20 166H340V212H-20Z".into(), r#"fill="url(#tri-bottom)""#, 1.);
    c.fixed(|| "M-20 -20H340V212H-20Z".into(), r#"fill="url(#tri-edge)""#, 1.);
    c.end();
}

pub fn svg() -> String {
    let mut c = Canvas::build(
        "tri",
        "Сын стоит в стеклянном сосуде с надписью ПРОГРАММА, Отец сбоку и далеко позади него. Три вдоха Сына и три фразы Отца, летящие по прямой, встречаются на стекле, сосуд раскалывается, и его осколки становятся Духом: дыханием между ними, линией света, по которой обмен идёт в обе стороны.",
        &defs(),
    );
    draw(&mut c, REST, false);
    c.finish()
}
pub fn frame(seconds: f64, reduced: bool) -> Vec<Update> {
    let reduced = reduced || !seconds.is_finite();
    let mut c = Canvas::frame("tri");
    draw(&mut c, time(seconds, reduced), reduced);
    c.updates
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn the_father_stands_beside_and_behind_never_above() {
        for t in [0., 6., 12., 19., 25.] {
            let cam = camera(t);
            let son = Placement::standing(&cam, SON, SON_HEIGHT);
            let father = Placement::standing(&cam, FATHER, FATHER_HEIGHT);
            let (s, f) = (son.at(UNSEAL_HEART), father.at(UNSEAL_HEART));
            assert!(f.0 < s.0 - 40., "beside, with room between them, at {t}");
            assert!(FATHER[2] > SON[2] + 2., "well behind at {t}");
            let (son_top, father_top) = (son.at((1268., 150.)).1, father.at((1268., 150.)).1);
            assert!((father_top - son_top).abs() < 16., "level heads at {t}");
        }
    }
    #[test]
    fn the_spirit_is_the_breath_between_them() {
        let (father, son) = spirit();
        for t in [15., 19., 22.] {
            let cam = camera(t);
            let (f, s) = (cam.project(father), cam.project(son));
            let head = |feet: W, height: f64| cam.project(unseal_world(feet, height, (1268., 150.))).1;
            assert!(f.0 < s.0, "from the Father on the left to the Son at {t}");
            assert!(f.1 > head(FATHER, FATHER_HEIGHT) && s.1 > head(SON, SON_HEIGHT), "no apex above their heads at {t}");
        }
        let cam = camera(IMPACT_AT);
        let flight = straight(&cam, father, impact());
        let (a, b) = (flight[0], flight[flight.len() - 1]);
        for p in &flight {
            let off = ((b.0 - a.0) * (p.1 - a.1) - (b.1 - a.1) * (p.0 - a.0)) / (b.0 - a.0).hypot(b.1 - a.1);
            assert!(off.abs() < 1e-6, "words fly straight");
        }
    }
    #[test]
    fn the_dome_rim_meets_the_wall_tangents() {
        for t in [0., 10.5, 25.] {
            let cam = camera(t);
            let (eye, half) = view(&cam);
            let rim = dome_rim(&cam);
            let (a, b) = (cam.project(rim[0]), cam.project(jar_point(eye - half, JAR_WALL)));
            assert!((a.0 - b.0).hypot(a.1 - b.1) < 0.05, "left {t}");
            let (a, b) = (cam.project(rim[24]), cam.project(jar_point(eye + half, JAR_WALL)));
            assert!((a.0 - b.0).hypot(a.1 - b.1) < 0.05, "right {t}");
        }
    }
    #[test]
    fn the_last_breath_and_word_meet_at_the_impact() {
        let (text, at) = PHRASES[2];
        assert!((at + PHRASE_TIME - IMPACT_AT).abs() < 1e-9, "{text}");
        assert!(PHRASES.windows(2).all(|w| w[1].1 - w[0].1 >= PHRASE_TIME), "one phrase at a time");
        assert!((BREATHS[2] + 1.3 + 1. - IMPACT_AT).abs() < 1e-9);
        assert!(REACH[2] == 1. && REACH[0] < REACH[1] && REACH[1] < 1.);
        let cam = camera(IMPACT_AT);
        assert!(facing(&cam, IMPACT.0, JAR_WALL + IMPACT.1 * JAR_R));
    }
    #[test]
    fn the_loop_fades_through_darkness() {
        let master = |s: f64| {
            frame(s, false)
                .into_iter()
                .find(|u| u.selector == ".tri-0" && u.attribute == "opacity")
                .unwrap()
                .value
                .parse::<f64>()
                .unwrap()
        };
        assert!(master(PERIOD - 0.02) < 0.05 && master(0.) < 0.05);
        assert!(master(REST) > 0.99);
    }
}
