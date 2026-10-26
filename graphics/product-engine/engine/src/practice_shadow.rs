//! Practice 5, "Голос — это не звук. Это Дыхание Осознавания." She stands on
//! a stage in a follow-spot before a hall, and the spot throws her shadow onto
//! the back wall: huge, bound by ropes of thought that the hall's murmurs keep
//! feeding. She turns from the hall to the shadow; her breath becomes a voice,
//! one long tone whose waves reach it, and it fills with light. The ropes
//! tremble with the tone and fall, the hall and the
//! spot go out, and her light self steps out of the wall to face her:
//! Spectator, Witness, Liberator, and at last Author.
use crate::{practice_stage::*, step_three::Update};
use std::{
    f64::consts::{PI, TAU},
    sync::LazyLock,
};

pub const PERIOD: f64 = 28.;
/// The reduced-motion still: she and her light self face each other.
pub const REST: f64 = 23.5;

const HER: W = [0.05, 0., 0.];
const HEIGHT: f64 = 1.68;
/// The back wall; the follow-spot close below the stage lip, and where it
/// aims. So near and so low, it throws her three times her size: the shadow
/// rises from the floor at her knees and reaches the top of the opening.
const WALL: f64 = 3.2;
const LAMP: W = [1.1, 0.85, -1.5];
const AIM: W = [0.05, 1.14, 0.];
/// Half-axes of the spot's ellipse on the wall.
const SPILL: (f64, f64) = (1.7, 2.2);
/// Where her light self comes to stand.
const MIRROR: W = [-0.9, 0., 0.5];
const LIP: f64 = -1.35;
/// The curtain line, half its opening and the valance's lower edge.
const ARCH: f64 = -1.2;
const OPENING: f64 = 2.25;
const VALANCE: f64 = 2.8;
/// The hall, nearest row last: depth, head height and extent.
const ROWS: [(f64, f64, f64, f64); 2] = [(-2.6, 0.1, -2.75, 2.9), (-3.4, 0.45, -2.35, 2.5)];
const TURN: (f64, f64) = (6.1, 7.9);
const TOUCH: f64 = 10.6;
const BREAK: f64 = 13.4;
/// Her voice: one long tone, wave after wave crossing to the shadow every
/// PULSE seconds; the first reaches it at TOUCH.
const TONE: (f64, f64) = (9.5, 13.1);
const PULSE: f64 = 0.18;
const CROSS: f64 = TOUCH - TONE.0;
/// Waves of the tone alive at once, at most.
const SLOTS: usize = 8;
const STEP: (f64, f64) = (18.6, 21.8);
/// Ropes of thought binding the shadow, in its art units: ends and sag. They
/// stay above her knees, where the shadow leaves the floor.
const ROPES: [(P, P, f64, &str); 6] = [
    ((170., 250.), (850., 160.), 30., "ЧТО ОБО МНЕ ПОДУМАЮТ"),
    ((190., 380.), (830., 450.), 24., "НЕ ОШИБИСЬ"),
    ((150., 520.), (860., 470.), 30., "НА МЕНЯ СМОТРЯТ"),
    ((180., 620.), (840., 700.), 26., "Я ДОЛЖНА БЫТЬ ЛУЧШЕ"),
    ((210., 760.), (810., 720.), 22., "БУДЬ ХОРОШЕЙ"),
    ((230., 840.), (790., 880.), 18., "ИМ НЕ ПОНРАВИТСЯ"),
];
const ROPE_SIZE: f64 = 4.5;
/// Strings rising from the shadow's head and shoulders, working it from above.
const STRINGS: [P; 3] = [(498., 40.), (372., 262.), (652., 258.)];
/// Letters the hall whispers onto the ropes: rope, letter, leaving time.
const MURMURS: [(usize, &str, f64); 10] = [
    (0, "Ч", 1.6),
    (2, "С", 2.1),
    (1, "Н", 2.6),
    (4, "Б", 3.),
    (3, "Л", 3.5),
    (5, "П", 3.9),
    (0, "М", 4.4),
    (2, "Я", 4.8),
    (3, "Д", 5.3),
    (1, "О", 5.8),
];
const FLIGHT: f64 = 1.7;
/// Names on the wall: text, from, to, size.
const WORDS: [(&str, f64, f64, f64); 4] = [
    ("ЗРИТЕЛЬ", 7.4, 11., 8.),
    ("СВИДЕТЕЛЬ", 11., 13.8, 8.),
    ("ОСВОБОЖДАЮЩИЙ", 13.8, 17.6, 7.),
    ("АВТОР", 21.8, 26.2, 12.),
];

fn camera(t: f64) -> Camera {
    Camera {
        eye: wmix([0.1, 1.25, -6.6], [-0.05, 1.18, -5.7], ramp(t, 0., 27.5)),
        focal: 300.,
        center: (160., 96.),
    }
}
fn time(seconds: f64, reduced: bool) -> f64 {
    if reduced || !seconds.is_finite() {
        REST
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    }
}
/// How much larger the shadow is than she is: the wall's distance from the
/// lamp over hers.
fn throw() -> f64 {
    (WALL - LAMP[2]) / (HER[2] - LAMP[2])
}
fn spill() -> W {
    let s = throw();
    [LAMP[0] + s * (AIM[0] - LAMP[0]), LAMP[1] + s * (AIM[1] - LAMP[1]), WALL]
}
/// How far she has turned from the hall to the shadow.
fn turn(t: f64) -> f64 {
    ramp(t, TURN.0, TURN.1)
}
/// Which way she mostly faces.
fn facing(t: f64) -> f64 {
    if turn(t) < 0.5 { 1. } else { -1. }
}
/// Calm breaths; one long inhale, then the exhale that becomes the voice.
fn breath(t: f64) -> f64 {
    if t < 8. {
        0.5 - 0.5 * (TAU * t / 4.).cos()
    } else if t < 9.4 {
        ramp(t, 8., 9.3)
    } else if t < BREAK {
        1. - ramp(t, 9.4, BREAK - 0.1)
    } else {
        0.5 - 0.5 * (TAU * (t - BREAK) / 4.4).cos()
    }
}
fn speaking(t: f64) -> f64 {
    bell(t, 9.3, 9.6, TONE.1, TONE.1 + 0.5)
}
/// When wave `n` of the tone leaves her.
fn wave_at(n: usize) -> f64 {
    TONE.0 + n as f64 * PULSE
}
fn waves() -> usize {
    ((TONE.1 - TONE.0) / PULSE).floor() as usize + 1
}
/// The latest wave in slot `j` that reached `delay` seconds into its way at
/// most `life` seconds ago: which wave, and how long ago.
fn slot(t: f64, delay: f64, life: f64, j: usize) -> Option<(usize, f64)> {
    let local = (t - delay - TONE.0) / PULSE;
    if local < 0. {
        return None;
    }
    let latest = ((local + 1e-9).floor() as usize).min(waves() - 1);
    let n = latest.checked_sub((latest + SLOTS - j % SLOTS) % SLOTS)?;
    let age = t - delay - wave_at(n);
    (age < life).then_some((n, age))
}
/// One wavefront: an arc across the way at `at`, bowed forward along `angle`.
fn front(at: P, angle: f64, half: f64) -> String {
    let (sin, cos) = angle.sin_cos();
    let points: Vec<P> = (0..=10)
        .map(|i| {
            let u = i as f64 / 5. - 1.;
            let ahead = 0.45 * half * (1. - u * u);
            (at.0 - sin * u * half + cos * ahead, at.1 + cos * u * half + sin * ahead)
        })
        .collect();
    line(&points)
}
/// The follow-spot: it catches, flickers out after the hall is gone.
fn spot(t: f64) -> f64 {
    let on = ramp(t, 0.4, 1.4) * (1. - 0.7 * bell(t, 0.7, 0.75, 0.8, 0.9));
    let dips: f64 = [16.1, 16.45, 16.8]
        .iter()
        .map(|&a| 1. - 0.75 * bell(t, a, a + 0.04, a + 0.1, a + 0.16))
        .product();
    on * dips * (1. - ramp(t, 16.95, 17.35))
}
/// Light passing through the shadow from where the voice touched it.
fn through(t: f64) -> f64 {
    ramp(t, 11.2, 15.)
}

fn her(cam: &Camera, t: f64) -> Affine {
    heroine_world(HER, HEIGHT, facing(t)).then(cam.plane(HER[2]))
}
/// On planes parallel to the wall the spot's light is one scaling about the
/// lamp, so her shadow is her own figure under one more map.
fn cast(facing: f64) -> Affine {
    let s = throw();
    heroine_world(HER, HEIGHT, facing).then(Affine::about((LAMP[0], LAMP[1]), s, s))
}
fn shadow(cam: &Camera, facing: f64) -> Affine {
    cast(facing).then(cam.plane(WALL))
}
/// Her light self steps down out of the lit shadow: it stands at the wall as
/// tall as the shadow reaches, its head where the shadow's head is, then comes
/// to her size as it crosses to her and turns round to face her. Soles,
/// height and how far it has turned.
fn light_self(t: f64) -> (W, f64, f64) {
    let u = ramp(t, STEP.0, STEP.1);
    let s = throw();
    let feet = [mix(LAMP[0] + s * (HER[0] - LAMP[0]), MIRROR[0], u), 0., mix(WALL, MIRROR[2], u)];
    let tall = LAMP[1] + s * (HEIGHT - LAMP[1]);
    (feet, mix(tall, HEIGHT, u), ((u - 0.2) / 0.6).clamp(0., 1.))
}
fn world(map: Affine, p: P, z: f64, breath: f64) -> W {
    let q = heroine_mark(map, p, breath);
    [q.0, q.1, z]
}
/// A point drawn on the wall through the reference camera, in the world.
fn on_wall(p: P) -> W {
    let w = camera(0.).plane(WALL).inverse().apply(p);
    [w.0, w.1, WALL]
}

/// A rope of thought on the wall, drawn through the reference camera: its
/// words ride the middle, the bare rope runs out at both ends.
struct Rope {
    points: Vec<P>,
    text: &'static str,
    start: f64,
    total: f64,
    centre: P,
    ignites: f64,
    falls: f64,
}
impl Rope {
    fn ends(&self) -> String {
        let width = text_width(self.text, ROPE_SIZE);
        let mut d = part(&self.points, 0., (self.start - 1.) / self.total);
        d.push_str(&part(&self.points, (self.start + width + 1.) / self.total, 1.));
        d
    }
    fn words(&self) -> String {
        text_along(self.text, &self.points, self.start, ROPE_SIZE)
    }
}
static ROPE_SET: LazyLock<Vec<Rope>> = LazyLock::new(|| {
    let cam = camera(0.);
    let map = shadow(&cam, 1.);
    let heart = heroine_mark(shadow(&cam, -1.), HEROINE_HEART, 0.);
    ROPES
        .iter()
        .map(|&(a, b, sag, text)| {
            let points: Vec<P> = (0..=24)
                .map(|i| {
                    let u = i as f64 / 24.;
                    let p = lerp(a, b, u);
                    map.apply((p.0, p.1 + sag * (PI * u).sin()))
                })
                .collect();
            let total = length(&points);
            let centre = along(&points, total / 2.).0;
            let reach = (centre.0 - heart.0).hypot(centre.1 - heart.1);
            Rope {
                start: (total - text_width(text, ROPE_SIZE)) / 2.,
                total,
                centre,
                ignites: 11.2 + reach / 50.,
                falls: BREAK + reach / 80.,
                text,
                points,
            }
        })
        .collect()
});
/// How strongly the hall's murmurs hold a rope.
fn fed(i: usize, t: f64) -> f64 {
    let pulses: f64 = MURMURS
        .iter()
        .filter(|m| m.0 == i)
        .map(|m| {
            let at = m.2 + FLIGHT;
            0.6 * bell(t, at - 0.05, at + 0.1, at + 0.4, at + 1.3)
        })
        .sum();
    (0.3 * ramp(t, 1.5, 7.) + pulses).min(1.)
}

/// Heads of the hall, seated below the stage lip; the nearer row leaves an
/// aisle where the spot's stand comes down.
static HEADS: LazyLock<Vec<W>> = LazyLock::new(|| {
    let mut out = Vec::new();
    for (r, &(z, y, from, to)) in ROWS.iter().enumerate() {
        let mut x = from + 0.27 * r as f64;
        let mut k = 0;
        while x <= to {
            if r == 0 || (x - 0.81).abs() > 0.33 {
                let n = k + 40 * r;
                out.push([x + (hash(n) - 0.5) * 0.1, y + (hash(n + 7) - 0.5) * 0.06, z]);
            }
            x += 0.56;
            k += 1;
        }
    }
    out
});
fn leaves(i: usize) -> f64 {
    15.6 + 1.8 * hash(i + 11)
}
fn listener(cam: &Camera, h: W) -> String {
    let k = cam.scale(h[2]);
    let mut d = ellipse(cam.project(h), 0.085 * k, 0.105 * k);
    let body: Vec<W> = [(-0.27, -0.75), (-0.25, -0.26), (-0.17, -0.17), (-0.06, -0.12), (0.06, -0.12), (0.17, -0.17), (0.25, -0.26), (0.27, -0.75)]
        .iter()
        .map(|&(x, y)| [h[0] + x, h[1] + y, h[2]])
        .collect();
    d.push_str(&cam.poly(&body));
    d
}
/// Stage light catching the top of a head.
fn rim(cam: &Camera, h: W) -> String {
    let k = cam.scale(h[2]);
    let c = cam.project(h);
    line(
        &(0..=10)
            .map(|i| {
                let a = mix(205., 335., i as f64 / 10.).to_radians();
                (c.0 + 0.085 * k * a.cos(), c.1 + 0.105 * k * a.sin())
            })
            .collect::<Vec<_>>(),
    )
}
/// Listeners coming apart into light, rising.
fn ascent(cam: &Camera, t: f64) -> String {
    let mut d = String::new();
    for (i, h) in HEADS.iter().enumerate() {
        let tau = t - leaves(i);
        if !(0. ..2.8).contains(&tau) {
            continue;
        }
        for j in 0..4 {
            let n = i * 4 + j;
            let u = (tau - 0.3 * hash(n + 3)) / 2.3;
            if !(0. ..1.).contains(&u) {
                continue;
            }
            let p = [
                h[0] + (hash(n) - 0.5) * 0.3 + 0.08 * (u * 5. + n as f64).sin(),
                h[1] - 0.1 + (hash(n + 1) - 0.3) * 0.25 + 1.5 * ease(u),
                h[2] + 0.5 * u,
            ];
            d.push_str(&circle(cam.project(p), (0.014 * (1. - u) * cam.scale(p[2])).max(0.2)));
        }
    }
    d
}

fn seams(cam: &Camera) -> String {
    let mut d = String::new();
    for i in 0..=10 {
        let x = -4.5 + 0.9 * i as f64;
        d.push_str(&cam.line(&[[x, 0., WALL], [x, 5.2, WALL]]));
    }
    for y in [0.95, 4.3] {
        d.push_str(&cam.line(&[[-4.9, y, WALL], [4.9, y, WALL]]));
    }
    d
}
fn strings(cam: &Camera) -> String {
    let map = shadow(cam, 1.);
    let mut d = String::new();
    for (i, &p) in STRINGS.iter().enumerate() {
        let a = map.apply(p);
        d.push_str(&line(&[a, (a.0 + 3. * (i as f64 - 1.), -14.)]));
    }
    d
}
fn floor_oval(cam: &Camera, c: W, rx: f64, rz: f64) -> String {
    cam.poly(
        &(0..32)
            .map(|i| {
                let a = i as f64 / 32. * TAU;
                [c[0] + rx * a.cos(), 0., c[2] + rz * a.sin()]
            })
            .collect::<Vec<_>>(),
    )
}
fn planks(cam: &Camera) -> String {
    let mut d = String::new();
    for i in 0..=20 {
        let x = -4.5 + 0.45 * i as f64;
        d.push_str(&cam.line(&[[x, 0., LIP], [x, 0., WALL]]));
    }
    d
}

/// The valance: swags along its lower edge, top out of sight.
fn valance_edge(lift: f64) -> Vec<W> {
    (0..=96)
        .map(|i| {
            let x = mix(-4.9, 4.9, i as f64 / 96.);
            let f = ((x + 4.9) / 1.225).fract();
            [x, VALANCE + lift - 0.2 * (1. - lift / 0.5) * (PI * f).sin(), ARCH]
        })
        .collect()
}
fn valance(cam: &Camera) -> String {
    let mut edge = valance_edge(0.);
    edge.push([4.9, 4.8, ARCH]);
    edge.push([-4.9, 4.8, ARCH]);
    cam.poly(&edge)
}
fn valance_folds(cam: &Camera) -> String {
    let mut d = String::new();
    for lift in [0.08, 0.17, 0.27] {
        d.push_str(&cam.line(&valance_edge(lift)));
    }
    let edge = valance_edge(0.);
    for w in edge.iter().step_by(2) {
        d.push_str(&cam.line(&[*w, [w[0], w[1] - 0.06, ARCH]]));
    }
    d
}
/// A side curtain's inner edge, flaring a little toward the floor.
fn inner_edge(side: f64, y: f64) -> f64 {
    side * (OPENING + 0.18 * (1. - y / VALANCE).powi(3))
}
fn curtain(cam: &Camera, side: f64) -> String {
    let mut points: Vec<W> = vec![[4.9 * side, 0., ARCH]];
    points.extend((0..=12).map(|i| {
        let y = VALANCE * i as f64 / 12.;
        [inner_edge(side, y), y, ARCH]
    }));
    points.push([4.9 * side, VALANCE, ARCH]);
    cam.poly(&points)
}
fn curtain_folds(cam: &Camera, offset: f64) -> String {
    let mut d = String::new();
    for side in [-1., 1.] {
        for k in 0..8 {
            let x0 = OPENING + 0.18 + 0.3 * k as f64 + offset;
            d.push_str(&cam.line(
                &(0..=12)
                    .map(|i| {
                        let y = VALANCE * i as f64 / 12.;
                        [side * (x0 + 0.03 * (y * 2.1 + x0 * 5.).sin()), y, ARCH]
                    })
                    .collect::<Vec<_>>(),
            ));
        }
    }
    d
}
fn curtain_edges(cam: &Camera) -> String {
    let mut d = String::new();
    for side in [-1., 1.] {
        d.push_str(&cam.line(
            &(0..=12)
                .map(|i| {
                    let y = VALANCE * i as f64 / 12.;
                    [inner_edge(side, y), y, ARCH]
                })
                .collect::<Vec<_>>(),
        ));
    }
    d.push_str(&cam.line(&valance_edge(0.)));
    d
}

fn lamp_axis() -> W {
    unit(sub(AIM, LAMP))
}
/// The follow-spot from behind: a barrel on a stand, its lens facing the stage.
fn lamp_body(cam: &Camera) -> (String, f64) {
    let back = sub(LAMP, scaled(lamp_axis(), 0.42));
    let r = 0.12 * cam.scale(LAMP[2]);
    (line(&[cam.project(back), cam.project(LAMP)]), r)
}
fn lamp_stand(cam: &Camera) -> String {
    let back = sub(LAMP, scaled(lamp_axis(), 0.2));
    let mut d = cam.line(&[[back[0], back[1] - 0.1, back[2]], [back[0], -1.4, back[2]]]);
    d.push_str(&cam.line(&[[back[0] - 0.16, back[1] - 0.1, back[2]], [back[0] + 0.16, back[1] - 0.1, back[2]]]));
    d
}
/// The spot's cone in the haze, from the lens to an ellipse at depth `z`.
fn cone(cam: &Camera, centre: W, rx: f64, ry: f64) -> String {
    let mut points = vec![cam.project(LAMP)];
    points.extend((0..20).map(|i| {
        let a = i as f64 / 20. * TAU;
        cam.project([centre[0] + rx * a.cos(), centre[1] + ry * a.sin(), centre[2]])
    }));
    poly(&hull(points))
}
/// Dust turning in the beam.
fn dust(cam: &Camera, t: f64) -> String {
    let c = spill();
    let mut d = String::new();
    for i in 0..22 {
        let u = (hash(i) + t * 0.025 * (1. + hash(i + 3))).fract();
        let a = hash(i + 5) * TAU;
        let r = hash(i + 9).sqrt() * 0.85;
        let target = [c[0] + r * SPILL.0 * a.cos(), c[1] + r * SPILL.1 * a.sin(), WALL];
        let p = add(wmix(LAMP, target, mix(0.12, 0.9, u)), [0., 0.04 * (t * 0.7 + i as f64).sin(), 0.]);
        let size = 0.009 * (PI * u).sin() * cam.scale(p[2]);
        d.push_str(&circle(cam.project(p), size.max(0.15)));
    }
    d
}

fn defs() -> String {
    let (hx, hy) = HEROINE_HEART;
    let burn = |id: &str, r: f64| {
        format!(
            r#"<radialGradient id="sh-{id}" gradientUnits="userSpaceOnUse" cx="{hx}" cy="{hy}" r="{r}"><stop stop-color="var(--book-light)" stop-opacity=".9"/><stop offset=".35" stop-color="var(--book-line)" stop-opacity=".45"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>"#
        )
    };
    format!(
        r#"{}{}<radialGradient id="sh-spill"><stop stop-color="var(--book-line)" stop-opacity=".3"/><stop offset=".5" stop-color="var(--book-ink)" stop-opacity=".12"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="sh-pool"><stop stop-color="var(--book-light)" stop-opacity=".35"/><stop offset=".4" stop-color="var(--book-line)" stop-opacity=".14"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><linearGradient id="sh-beam" x1="1" y1="1" x2="0" y2=".15"><stop stop-color="var(--book-light)" stop-opacity=".22"/><stop offset=".45" stop-color="var(--book-line)" stop-opacity=".07"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".02"/></linearGradient><radialGradient id="sh-inner" gradientUnits="userSpaceOnUse" cx="{hx}" cy="{hy}" r="520"><stop stop-color="var(--book-light)" stop-opacity=".95"/><stop offset=".22" stop-color="var(--book-line)" stop-opacity=".55"/><stop offset=".55" stop-color="var(--book-ink)" stop-opacity=".2"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>{}{}{}"#,
        glow_defs("sh"),
        edge_defs("sh"),
        burn("burn1", 260.),
        burn("burn2", 560.),
        burn("burn3", 1100.),
    )
}

fn draw(c: &mut Canvas, t: f64, reduced: bool) {
    let cam = camera(t);
    let cam0 = camera(0.);
    let k = facing(t);
    let b = breath(t);
    let lamp = spot(t);
    let light = through(t);
    let seen = lamp.max(light);
    let hall = 1. - ramp(t, 16.6, 18.4);
    let end = ramp(t, 21.5, 23.5);
    let master = if reduced { 1. } else { ramp(t, 0., 1.2) * (1. - ramp(t, 25.8, 27.6)) };
    c.group("", "", master);
    c.fixed(|| "M-20 -20H340V212H-20Z".into(), &fill(COVER), 1.);

    // The back wall: code behind plaster seams, lit by the spot around her shadow.
    let wall = cam.carry(&cam0, WALL).svg();
    let k0 = cam0.scale(WALL);
    let quad = [[-4.9, 5.2, WALL], [4.9, 5.2, WALL], [4.9, 0., WALL], [-4.9, 0., WALL]];
    let core = heroine_mark(shadow(&cam0, -1.), HEROINE_HEART, 0.);
    c.group("", &wall, 1.);
    c.fixed_rain(|| cam0.poly(&quad), &cam0.uv(quad, [1.6, 1.05]), 0.1 + 0.08 * light + 0.06 * end);
    c.fixed(|| seams(&cam0), &stroke(LINE, 0.25), 0.1 * (1. - 0.5 * ramp(t, 17., 19.)));
    let pool = cam0.project(spill());
    c.fixed(|| ellipse(pool, SPILL.0 * k0, SPILL.1 * k0), r#"fill="url(#sh-spill)""#, 0.95 * lamp);
    c.fixed(|| ellipse(core, 1.5 * k0, 1.8 * k0), r#"fill="url(#sh-haze)""#, light * (1. - 0.7 * ramp(t, STEP.0, STEP.1)));
    c.end();

    // Her shadow: the same figure thrown by the spot, until it is light. Its
    // parts overlap, so the covers stay opaque and the light never doubles.
    let dark = heroine_cover(COVER);
    let burns = ["burn1", "burn2", "burn3"].map(|id| heroine_cover(&format!("url(#sh-{id})")));
    let inner_fill = heroine_cover("url(#sh-inner)");
    let (ink, lit) = (heroine_ink(INK), heroine_ink(LIGHT));
    let leave = 1. - ramp(t, STEP.0 + 0.1, STEP.0 + 1.2);
    let shade = Layers {
        cover: (&dark, 0.94),
        code: None,
        glows: &[(&burns[0], ramp(t, 10.7, 11.5)), (&burns[1], ramp(t, 11.5, 13.)), (&burns[2], ramp(t, 12.8, 15.2))],
        inks: &[(&ink, 0.3 * (1. - ramp(t, 15., 19.))), (&lit, 0.9 * ramp(t, 14.5, 18.5))],
    };
    heroine_turn(c, |f| shadow(&cam, f), turn(t), 1., b, seen * leave, &shade);

    // What binds it, on the wall over it: strings from above and ropes of
    // thought fed by the hall; the light cuts them and they fall.
    c.group("", &wall, 1.);
    let cut = ramp(t, BREAK - 0.5, BREAK - 0.3);
    c.fixed(|| strings(&cam0), &stroke(INK, 0.35), seen * 0.5 * (1. - cut));
    c.fixed(|| strings(&cam0), &stroke(LIGHT, 0.4), bell(t, BREAK - 0.9, BREAK - 0.6, BREAK - 0.45, BREAK - 0.1));
    for (i, r) in ROPE_SET.iter().enumerate() {
        let hold = fed(i, t);
        let ignite = ramp(t, r.ignites, r.ignites + 0.5);
        let fall = (t - r.falls).max(0.);
        let snap = ramp(t, r.falls, r.falls + 0.2);
        let side = if i % 2 == 0 { 1. } else { -1. };
        c.fixed(|| r.ends(), &stroke(LINE, 0.3), seen * (0.3 + 0.3 * hold) * (1. - snap));
        c.fixed(|| r.ends(), &stroke(LIGHT, 0.45), ignite * (1. - snap));
        let hum = bell(t, TOUCH, TOUCH + 0.4, r.falls - 0.1, r.falls) * (1.2 + 1.2 * ramp(t, TOUCH, BREAK));
        let shake = hum * (38. * t + 1.7 * i as f64).sin();
        let drop = Affine::turn(r.centre, side * 0.35 * fall)
            .then(Affine([1., 0., 0., 1., side * 4. * fall, 26. * fall * fall + shake]))
            .svg();
        let gone = 1. - ramp(fall, 0.4, 1.8);
        c.words(r.text, || r.words(), &fill(LINE), &drop, seen * (0.4 + 0.5 * hold) * gone);
        c.words(r.text, || r.words(), &fill(LIGHT), &drop, ignite * gone);
    }
    // Where the voice lands: a ring on the wall for every wave of the tone.
    let heart = heroine_mark(shadow(&cam0, k), HEROINE_HEART, b);
    for j in 0..SLOTS {
        let (d, a) = match slot(t, CROSS, 1.4, j) {
            Some((_, age)) => {
                let f = age / 1.4;
                (circle(heart, 2. + 28. * f), 0.6 * (1. - f))
            }
            None => (String::new(), 0.),
        };
        c.path(&d, &stroke(LINE, 0.45), a);
    }
    let flash = ramp(t, TOUCH - 0.05, TOUCH + 0.6);
    c.sprite(heart, 3. + 24. * flash, "sh-glow", bell(t, TOUCH - 0.1, TOUCH + 0.05, TOUCH + 0.3, TOUCH + 1.3));
    // Names on the wall, one after another; the last above the two of her.
    let names = cam0.project([2.15, 2.9, WALL]);
    let author = cam0.project([-0.45, 3.2, WALL]);
    for &(text, from, to, size) in &WORDS {
        let a = bell(t, from, from + 0.8, to - 0.6, to);
        let at = if text == "АВТОР" { author } else { names };
        let place = format!("translate({:.2} {:.2})", at.0, at.1 + 2. * (1. - a));
        c.words(text, || word(text, 0., 0., size), &fill(LINE), &place, a);
    }
    c.end();

    // The stage floor: planks over faint code, the spot's pool and the strip
    // of shadow running from her soles to the wall.
    let floor = [[-4.9, 0., WALL], [4.9, 0., WALL], [4.9, 0., LIP], [-4.9, 0., LIP]];
    let boards = cam.poly(&floor);
    c.path(&boards, &fill(COVER), 1.);
    c.rain(&boards, &cam.uv(floor, [2.3, 1.2]), 0.06 + 0.1 * ramp(t, 16., 19.));
    c.path(&planks(&cam), &stroke(LINE, 0.25), 0.1 * hall + 0.05 * lamp);
    c.path(&cam.line(&[[-4.9, 0., WALL], [4.9, 0., WALL]]), &stroke(LINE, 0.4), 0.25);
    c.path(&floor_oval(&cam, [HER[0], 0., 0.15], 0.8, 1.1), r#"fill="url(#sh-pool)""#, 0.9 * lamp + 0.45 * end);
    let s = throw();
    let strip = |x: f64| [LAMP[0] + s * (x - LAMP[0]), 0., WALL];
    let (x0, x1) = (HER[0] - 0.11, HER[0] + 0.11);
    c.path(&cam.poly(&[[x0, 0., 0.02], [x1, 0., 0.02], strip(x1), strip(x0)]), &fill(COVER), 0.85 * lamp);
    c.path(&cam.poly(&[[-4.9, 0., LIP], [4.9, 0., LIP], [4.9, -1.3, LIP], [-4.9, -1.3, LIP]]), &fill(COVER), 1.);
    c.path(&cam.line(&[[-4.9, 0., LIP], [4.9, 0., LIP]]), &stroke(LINE, 0.6), 0.35 * hall);
    c.path(&floor_oval(&cam, MIRROR, 0.6, 0.6), r#"fill="url(#sh-pool)""#, 0.5 * ramp(t, STEP.1 - 0.6, STEP.1 + 0.8));
    let f = (t - STEP.1 + 0.3) / 1.5;
    let landing = (0. ..1.).contains(&f);
    let r = 0.15 + 1.1 * f;
    c.path(&if landing { floor_oval(&cam, MIRROR, r, 0.8 * r) } else { String::new() }, &stroke(LINE, 0.5), if landing { 0.6 * (1. - f) } else { 0. });

    // Her light self, stepping down out of the wall.
    let (feet, height, its_turn) = light_self(t);
    let u = ramp(t, STEP.0, STEP.1);
    let other = Layers {
        cover: (&dark, 0.94),
        code: None,
        glows: &[(&inner_fill, u * (0.55 + 0.35 * b)), (&burns[1], 1. - 0.55 * u), (&burns[2], 1. - u)],
        inks: &[(&lit, 0.95)],
    };
    let appear = ramp(t, STEP.0, STEP.0 + 1.);
    heroine_turn(c, |f| heroine_world(feet, height, f).then(cam.plane(feet[2])), its_turn, -1., b, appear, &other);

    // She herself: code under her skin until her own light rises.
    let me = her(&cam, t);
    let speak = speaking(t);
    let inner = 0.2 * speak + end * (0.5 + 0.3 * b);
    let mine_look = Layers {
        cover: (&dark, 1.),
        code: Some((HEROINE_CODE, 0.14 * (1. - 0.6 * end))),
        glows: &[(&inner_fill, inner)],
        inks: &[(&ink, 1.), (&lit, 0.6 * end)],
    };
    heroine_turn(c, |f| heroine_world(HER, HEIGHT, f).then(cam.plane(HER[2])), turn(t), 1., b, 1., &mine_look);
    c.sprite(heroine_mark(me, HEROINE_NOTCH, b), 4. + 2. * b, "sh-glow", 0.6 * speak);
    c.sprite(heroine_mark(me, HEROINE_HEART, b), 3. + 2. * b, "sh-glow", 0.15 * b * (1. - end) + end * (0.6 + 0.3 * b));

    // The voice: not a line of light but a tone. Wave after wave leaves her
    // jugular notch and widens as it crosses to the shadow, fuller the longer
    // she sounds.
    let mine = heroine_world(HER, HEIGHT, k);
    let from = world(mine, HEROINE_NOTCH, HER[2], b);
    let to = world(cast(k), HEROINE_HEART, WALL, b);
    let way: Vec<P> = (0..=40)
        .map(|i| cam.project(cubic(from, add(from, [-0.35, 0.45, 0.5]), add(to, [0.5, 0.7, -0.9]), to, i as f64 / 40.)))
        .collect();
    let total = length(&way);
    for j in 0..SLOTS {
        let (d, a) = match slot(t, 0., CROSS, j) {
            Some((n, age)) => {
                let u = age / CROSS;
                let (at, angle) = along(&way, u * total);
                let full = 1. + 0.6 * ramp(wave_at(n), TOUCH, BREAK - 0.5);
                (front(at, angle, (2. + 15. * u) * full), bell(u, 0., 0.06, 0.8, 1.))
            }
            None => (String::new(), 0.),
        };
        c.path(&d, &stroke(INK, 2.), 0.3 * a);
        c.path(&d, &stroke(LIGHT, 0.65), a);
    }

    // Heart to heart, once she stands before herself: one breath between them.
    let mine_heart = world(mine, HEROINE_HEART, HER[2], b);
    let its_heart = world(heroine_world(feet, height, if its_turn < 0.5 { -1. } else { 1. }), HEROINE_HEART, feet[2], b);
    let link = ramp(t, 22., 23.);
    let reach = wmix(mine_heart, its_heart, link);
    let bond = if link > 0. { cam.line(&[mine_heart, reach]) } else { String::new() };
    c.path(&bond, &stroke(INK, 2.2), 0.25);
    c.path(&bond, &stroke(LINE, 0.5), 0.85);
    let (p, q) = (cam.project(mine_heart), cam.project(its_heart));
    let mut marks = ticks(p, 2.6 + 0.6 * b, 12, t * 0.5);
    marks.push_str(&ticks(q, 2.6 + 0.6 * b, 12, -t * 0.5));
    c.path(&marks, &stroke(LINE, 0.4), 0.6 * ramp(t, 22.6, 23.4));
    let pulse = 0.5 - 0.5 * (TAU * (t - 11.) / 4.4).cos();
    let mut beads = circle(lerp(p, q, pulse), 0.9);
    beads.push_str(&circle(lerp(q, p, pulse), 0.9));
    c.path(&beads, &fill(LIGHT), ramp(t, 23., 23.6));

    // The proscenium: valance and side curtains, dissolving into code.
    let arch = cam.carry(&cam0, ARCH).svg();
    c.group("", &arch, hall);
    let drapes = || {
        let mut d = curtain(&cam0, -1.);
        d.push_str(&curtain(&cam0, 1.));
        d.push_str(&valance(&cam0));
        d
    };
    c.fixed(drapes, &fill(COVER), 1.);
    let cloth = [[-4.9, 4.8, ARCH], [4.9, 4.8, ARCH], [4.9, 0., ARCH], [-4.9, 0., ARCH]];
    c.fixed_rain(drapes, &cam0.uv(cloth, [1.7, 1.08]), 0.07 + 0.35 * bell(t, 15.8, 16.8, 17.4, 18.4));
    c.fixed(|| curtain_folds(&cam0, 0.), &stroke(INK, 1.4), 0.35);
    c.fixed(|| curtain_folds(&cam0, 0.07), &stroke(LINE, 0.25), 0.14);
    c.fixed(|| valance_folds(&cam0), &stroke(LINE, 0.25), 0.2);
    c.fixed(|| curtain_edges(&cam0), &stroke(LINE, 0.5), 0.15 + 0.3 * lamp);
    c.end();

    // The spot itself, low in the aisle, and its beam through the haze.
    c.path(&cone(&cam, spill(), SPILL.0, SPILL.1), r#"fill="url(#sh-beam)""#, 0.9 * lamp);
    c.path(&cone(&cam, AIM, 0.42, 1.), r#"fill="url(#sh-beam)""#, 0.6 * lamp);
    c.path(&dust(&cam, t), &fill(LINE), 0.6 * lamp);
    c.group("", &cam.carry(&cam0, LAMP[2]).svg(), hall);
    c.fixed(|| lamp_stand(&cam0), &stroke(INK, 0.8), 0.6);
    let (barrel, r) = lamp_body(&cam0);
    c.fixed(|| barrel.clone(), &stroke(LINE, 2. * r + 0.8), 0.4);
    c.fixed(|| barrel.clone(), &stroke(COVER, 2. * r), 1.);
    let lens = cam0.project(LAMP);
    c.fixed(|| circle(lens, r), &stroke(LIGHT, 0.5), lamp);
    c.end();
    c.sprite(cam.project(LAMP), 7., "sh-glow", 0.9 * lamp);

    // The hall: listeners in silhouette, rimmed by the stage, until they
    // come apart into light and rise.
    for &(z, ..) in &ROWS {
        c.group("", &cam.carry(&cam0, z).svg(), 1.);
        for (i, &h) in HEADS.iter().enumerate().filter(|(_, h)| h[2] == z) {
            let gone = 1. - ramp(t, leaves(i), leaves(i) + 1.1);
            c.fixed(|| listener(&cam0, h), &fill(COVER), gone);
            c.fixed(|| rim(&cam0, h), &stroke(LINE, 0.45), gone * (0.12 + 0.5 * lamp));
        }
        c.end();
    }
    c.path(&ascent(&cam, t), &fill(LINE), 0.8);

    // Murmurs: letters flying from the hall onto the ropes.
    for (j, &(rope, letter, at)) in MURMURS.iter().enumerate() {
        let u = (t - at) / FLIGHT;
        let (place, alpha) = if (0. ..1.).contains(&u) {
            let h = HEADS[(j * 7 + 3) % HEADS.len()];
            let start = add(h, [0., 0.16, 0.]);
            let goal = on_wall(ROPE_SET[rope].centre);
            let p = cubic(start, add(start, [0., 0.9, 0.6]), add(goal, [0.3, 0.8, -1.2]), goal, ease(u));
            let at = cam.project(p);
            let size = 0.075 * cam.scale(p[2]) / 10.;
            (format!("translate({:.2} {:.2}) scale({size:.4})", at.0, at.1), 0.9 * ramp(u, 0., 0.15) * (1. - ramp(u, 0.85, 1.)))
        } else {
            ("translate(0 0)".into(), 0.)
        };
        c.words(letter, || word(letter, 0., 3.6, 10.), &fill(LINE), &place, alpha);
    }

    c.path(&motes(&cam, t, 10, 500, (-2.6, 2.4), (-1., 1.5), 3.5, 0.012), &fill(LINE), 0.3);
    soft_edges(c, "sh");
    c.end();
}

pub fn svg() -> String {
    let mut c = Canvas::build(
        "sh",
        "Героиня стоит на сцене в луче прожектора перед залом, за ней на стене огромная тень, опутанная строками мыслей. Она отворачивается от зала к тени, её голос — долгий звук — волна за волной доходит до тени, и тень наполняется светом. Нити дрожат от звука и рвутся, зрители рассыпаются светом, прожектор гаснет, и из стены выходит её светлое отражение: Зритель, Свидетель, Освобождающий, Автор.",
        &defs(),
    );
    draw(&mut c, REST, false);
    c.finish()
}
pub fn frame(seconds: f64, reduced: bool) -> Vec<Update> {
    let reduced = reduced || !seconds.is_finite();
    let mut c = Canvas::frame("sh");
    draw(&mut c, time(seconds, reduced), reduced);
    c.updates
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn the_shadow_is_her_figure_thrown_by_the_spot() {
        let cam = camera(5.);
        for k in [1., -1.] {
            for p in [HEROINE_THROAT, HEROINE_HEART, (420., 900.), (600., 120.)] {
                let q = heroine_world(HER, HEIGHT, k).apply(p);
                let body = [q.0, q.1, HER[2]];
                let lambda = (WALL - LAMP[2]) / (body[2] - LAMP[2]);
                let hit = add(LAMP, scaled(sub(body, LAMP), lambda));
                let (a, b) = (cam.project(hit), shadow(&cam, k).apply(p));
                assert!((a.0 - b.0).hypot(a.1 - b.1) < 1e-6, "{p:?} {k}");
            }
        }
    }
    #[test]
    fn she_turns_from_the_hall_to_face_her_shadow() {
        assert!(facing(TURN.0) > 0.99 && facing(TURN.1) < -0.99);
        let cam = camera(TOUCH);
        let me = her(&cam, TOUCH);
        let (throat, heart) = (heroine_mark(me, HEROINE_THROAT, 0.), heroine_mark(me, HEROINE_HEART, 0.));
        let shade = heroine_mark(shadow(&cam, facing(TOUCH)), HEROINE_HEART, 0.);
        assert!(throat.0 < heart.0 + 1. && shade.0 < throat.0, "she faces the shadow");
    }
    #[test]
    fn the_light_self_steps_out_from_under_the_shadows_head() {
        let (feet, height, turned) = light_self(STEP.0);
        assert_eq!(turned, 0.);
        let top = (HEROINE_FEET.0, HEROINE_TOP);
        let (a, b) = (cast(facing(STEP.0)).apply(top), heroine_world(feet, height, -1.).apply(top));
        assert!((a.0 - b.0).hypot(a.1 - b.1) < 1e-9 && feet[1] == 0., "{a:?} {b:?}");
        let (feet, height, turned) = light_self(STEP.1);
        let off = feet.iter().zip(MIRROR).map(|(a, b)| (a - b).abs()).fold(0., f64::max);
        assert!(off < 1e-9 && (height - HEIGHT).abs() < 1e-9, "{feet:?} {height}");
        assert_eq!(turned, 1., "it ends facing her");
    }
    #[test]
    fn her_voice_reaches_the_shadow_in_waves_not_a_line() {
        assert_eq!(slot(TONE.0 - 0.01, 0., CROSS, 0), None);
        assert_eq!(slot(TONE.0, 0., CROSS, 0), Some((0, 0.)));
        assert!((wave_at(0) + CROSS - TOUCH).abs() < 1e-9, "the first wave touches it");
        assert!(wave_at(waves() - 1) <= TONE.1 && wave_at(waves()) > TONE.1);
        for k in 0..400 {
            let t = TONE.0 + k as f64 * 0.013;
            let alive: Vec<usize> = (0..SLOTS).filter_map(|j| slot(t, 0., CROSS, j).map(|w| w.0)).collect();
            let expected = (0..waves()).filter(|&n| (0. ..CROSS).contains(&(t - wave_at(n)))).count();
            assert_eq!(alive.len(), expected, "{t}: every wave on its way is drawn");
        }
        assert!(speaking(BREAK - 0.5) > 0.99, "she still sounds as the ropes give");
    }
    #[test]
    fn every_rope_carries_its_whole_thought() {
        for r in ROPE_SET.iter() {
            assert!(r.start > 2., "{}", r.text);
            assert!(r.ignites > TOUCH && r.falls >= BREAK && r.falls < 15., "{}", r.text);
        }
    }
    #[test]
    fn the_loop_fades_through_darkness() {
        let master = |s: f64| {
            frame(s, false)
                .into_iter()
                .find(|u| u.selector == ".sh-0" && u.attribute == "opacity")
                .unwrap()
                .value
                .parse::<f64>()
                .unwrap()
        };
        assert!(master(PERIOD - 0.02) < 0.05 && master(0.) < 0.05);
        assert!(master(REST) > 0.99);
    }
}
