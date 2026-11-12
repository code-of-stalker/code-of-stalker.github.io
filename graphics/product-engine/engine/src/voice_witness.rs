//! Screen 6: a spoken thought becomes an object she observes. She stands in a
//! deep room of code and light, glowing as the heroine of the awareness scene
//! does. Each phrase leaves her jugular notch as a thread of light carrying a
//! knot of thought; the knot drifts aside, over a floor emitter, and clears
//! into a crisp hologram: «ПРОГРАММА» and its word. Three phrases, БОЛЬ, ВИНА,
//! МЫСЛЬ (Я СЛЫШУ, Я ВИЖУ, Я ОСОЗНАЮ); with each, her own light rises from
//! her head to her soles. Deterministic Rust geometry, shared by native/web.
use crate::{practice_stage::*, step_three::Update};
use std::{
    f64::consts::{PI, TAU},
    fmt::Write,
};

pub const PERIOD: f64 = 24.;
/// The reduced-motion still: the third thought held outside her and named.
pub const REST: f64 = 18.4;

const HER: W = [-0.95, 0., 0.6];
const HEIGHT: f64 = 1.68;
/// Where each knot is born, in front of her, and where it is held: the
/// hologram's centre over its emitter on the floor.
const BIRTH: W = [-0.38, 1.46, 0.6];
const HOLD: W = [1.2, 1.32, 1.5];
const EMITTER: W = [1.2, 0., 1.5];
/// The room: back wall, side walls, the near edge of the floor and the ceiling.
const WALL: f64 = 4.6;
const SIDE: f64 = 3.3;
const NEAR: f64 = -1.2;
const CEIL: f64 = 3.4;
/// The hologram's half width and height in metres at full size, and its half
/// width in its own drawing units.
const CARD: (f64, f64) = (0.9, 0.62);
const UNITS: f64 = 56.;
const CARD_H: f64 = UNITS * CARD.1 / CARD.0;
const WORDS: [&str; 3] = ["БОЛЬ", "ВИНА", "МЫСЛЬ"];
const CAPTIONS: [&str; 3] = ["Я СЛЫШУ", "Я ВИЖУ", "Я ОСОЗНАЮ"];
/// Suspended panels of code: x, depth and top.
const PANELS: [(f64, f64, f64); 2] = [(-2.5, 2.2, 2.1), (-0.4, 3.9, 2.3)];

fn camera() -> Camera {
    Camera {
        eye: [0.1, 1.0, -3.6],
        focal: 300.,
        center: (160., 96.),
    }
}

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
fn state(seconds: f64, reduced: bool) -> State {
    let t = if reduced || !seconds.is_finite() {
        REST
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
    let fade = if phrase == 2 {
        1. - ramp(t, 21.5, 23.6)
    } else {
        1. - ramp(age, 4.9, 5.8)
    };
    State {
        t,
        age,
        phrase,
        speech: ramp(age, 0., 0.35) * (1. - ramp(age, 1.65, 2.2)),
        separate: ramp(age, 0.65, 2.65),
        clear: ramp(age, 1.7, 3.7),
        alpha: ramp(age, 0., 0.4) * fade,
    }
}
/// Three completed utterances, one third each.
fn assembly(t: f64) -> f64 {
    (0..3)
        .map(|i| ramp(t, 1.9 + i as f64 * 6., 4.9 + i as f64 * 6.))
        .sum::<f64>()
        / 3.
}
/// Her own light: it rises with the utterances and settles back as the loop
/// closes, so the next one begins as this one did.
fn presence(t: f64) -> f64 {
    assembly(t) * (1. - ramp(t, 22.3, 23.9))
}
/// The band of her light, art units: lit above the first, dark below the second.
fn rise(t: f64) -> (f64, f64) {
    let edge = mix(150., 1650., presence(t));
    (edge - 300., edge + 200.)
}
/// Calm breathing, five breaths a loop.
fn breath(t: f64) -> f64 {
    0.5 - 0.5 * (TAU * t * 5. / PERIOD).cos()
}

fn her(cam: &Camera) -> Affine {
    heroine_world(HER, HEIGHT, 1.).then(cam.plane(HER[2]))
}
/// Her jugular notch in the world: where her voice leaves her.
fn notch(b: f64) -> W {
    let q = heroine_mark(heroine_world(HER, HEIGHT, 1.), HEROINE_NOTCH, b);
    [q.0, q.1, HER[2]]
}
/// The knot's centre: from before her, along a rising arc, to the hold.
fn centre(s: State) -> W {
    let u = s.separate;
    let bob = 0.02 * (TAU * s.t * 4. / PERIOD).sin() * u;
    let p = wmix(BIRTH, HOLD, u);
    [p[0], p[1] + 0.22 * (PI * u).sin() + bob, p[2]]
}
/// The hologram's plane, its drawing units to the screen: its size grows as
/// it leaves her, and it turns from her toward us as it settles.
fn card_map(cam: &Camera, s: State) -> Affine {
    let c = centre(s);
    let m = CARD.0 / UNITS * (0.35 + 0.65 * s.separate);
    let (sin, cos) = mix(0.7, 0.22, s.separate).sin_cos();
    let at = |x: f64, y: f64| cam.project([c[0] + cos * x * m, c[1] - y * m, c[2] + sin * x * m]);
    let (o, a, b, up, down) = (at(0., 0.), at(-40., 0.), at(40., 0.), at(0., -30.), at(0., 30.));
    Affine([
        (b.0 - a.0) / 80.,
        (b.1 - a.1) / 80.,
        (down.0 - up.0) / 60.,
        (down.1 - up.1) / 60.,
        o.0,
        o.1,
    ])
}
/// The way of her voice on the screen, from her notch to the knot.
fn way(cam: &Camera, s: State, b: f64) -> Vec<P> {
    let (from, to) = (notch(b), centre(s));
    (0..=40)
        .map(|i| {
            cam.project(cubic(
                from,
                add(from, [0.45, 0.3, 0.]),
                add(to, [-0.55, 0.25, -0.1]),
                to,
                i as f64 / 40.,
            ))
        })
        .collect()
}
/// How much of the way the thread covers: it reaches the knot as she speaks
/// and is drawn into it once the thought is out.
fn thread_span(s: State) -> (f64, f64) {
    (ramp(s.age, 1.8, 2.7), ramp(s.age, 0., 0.5))
}
/// A strand winding round the thread's core, `phase` apart from its twin.
fn strand(points: &[P], t: f64, phase: f64) -> String {
    let total = length(points);
    let mut walked = 0.;
    let mut out = Vec::with_capacity(points.len());
    for (i, &p) in points.iter().enumerate() {
        if i > 0 {
            walked += (p.0 - points[i - 1].0).hypot(p.1 - points[i - 1].1);
        }
        let (a, b) = (points[i.saturating_sub(1)], points[(i + 1).min(points.len() - 1)]);
        let angle = (b.1 - a.1).atan2(b.0 - a.0);
        let taper = (PI * walked / total.max(1e-6)).sin();
        let off = 1.7 * taper * (0.32 * walked - 9. * t + phase).sin();
        out.push((p.0 - angle.sin() * off, p.1 + angle.cos() * off));
    }
    line(&out)
}
/// One filament of the knot, card units: a tangle turning in depth that
/// straightens into a quiet waveform.
fn filament(s: State, layer: usize) -> String {
    let turn = s.t * 0.7;
    let (sin, cos) = turn.sin_cos();
    let points: Vec<P> = (0..=96)
        .map(|n| {
            let u = n as f64 / 96.;
            let a = u * TAU * 2.6 + s.t * 0.4 + layer as f64 * 0.11;
            let (x, y, z) = ((a * 1.7).sin() * 18. + a.cos() * 8., a.sin() * 20. + (a * 2.3).cos() * 7., (a * 1.3).cos() * 16.);
            let tangled = (x * cos + z * sin, y - 4.);
            let clean = (
                -44. + 88. * u,
                19. + (u * PI).sin().powi(2) * (u * TAU * 2.1 - s.t * 1.1).sin() * (3.2 + layer as f64 * 0.9),
            );
            lerp(tangled, clean, s.clear)
        })
        .collect();
    line(&points)
}
/// The hologram's outline, card units.
fn plate() -> String {
    let (w, h) = (UNITS, CARD_H);
    format!(
        "M{} {}H{}L{} {}V{}L{} {}H{}L{} {}Z",
        -w,
        -h,
        w - 12.,
        w,
        -h + 12.,
        h - 8.,
        w - 8.,
        h,
        -w + 6.,
        -w,
        h - 6.
    )
}
fn floor_oval(cam: &Camera, c: W, rx: f64, rz: f64, y: f64) -> String {
    cam.poly(
        &(0..32)
            .map(|i| {
                let a = i as f64 / 32. * TAU;
                [c[0] + rx * a.cos(), y, c[2] + rz * a.sin()]
            })
            .collect::<Vec<_>>(),
    )
}

fn defs(t: f64) -> String {
    let (y1, y2) = rise(t);
    let (nx, ny) = HEROINE_NOTCH;
    format!(
        r#"{}{}{}<linearGradient id="w-rise" class="w-rise" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="{y1:.1}" y2="{y2:.1}"><stop stop-color="var(--book-light)" stop-opacity=".8"/><stop offset=".45" stop-color="var(--book-line)" stop-opacity=".42"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></linearGradient><radialGradient id="w-inner" gradientUnits="userSpaceOnUse" cx="{nx}" cy="{}" r="430"><stop stop-color="var(--book-light)" stop-opacity=".95"/><stop offset=".25" stop-color="var(--book-line)" stop-opacity=".5"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="w-pool"><stop stop-color="var(--book-light)" stop-opacity=".35"/><stop offset=".4" stop-color="var(--book-line)" stop-opacity=".14"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="w-fog"><stop stop-color="var(--book-line)" stop-opacity=".16"/><stop offset=".55" stop-color="var(--book-ink)" stop-opacity=".06"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><linearGradient id="w-cone" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--book-light)" stop-opacity=".2"/><stop offset=".5" stop-color="var(--book-line)" stop-opacity=".07"/><stop offset="1" stop-color="var(--book-line)" stop-opacity=".12"/></linearGradient><linearGradient id="w-beam" x1="0" y1="1" x2="0" y2="0"><stop stop-color="var(--book-light)" stop-opacity=".32"/><stop offset=".35" stop-color="var(--book-line)" stop-opacity=".12"/><stop offset="1" stop-color="var(--book-line)" stop-opacity=".05"/></linearGradient><linearGradient id="w-pane" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="var(--book-line)" stop-opacity=".16"/><stop offset=".5" stop-color="var(--book-line)" stop-opacity=".03"/><stop offset="1" stop-color="var(--book-line)" stop-opacity=".1"/></linearGradient>"#,
        glow_defs("w"),
        edge_defs("w"),
        heroine_volume_defs("w"),
        ny + 40.,
    )
}

/// The room around her: walls and floor of code, ribs, slits of light and
/// suspended panels, all fixed. Drawn once; only the rain is live.
fn room(c: &mut Canvas, cam: &Camera) {
    c.raw(&format!(r#"<path d="M-20 -20H340V212H-20Z" {}/>"#, fill(COVER)));
    let back = [[-SIDE, CEIL, WALL], [SIDE, CEIL, WALL], [SIDE, 0., WALL], [-SIDE, 0., WALL]];
    let floor = [[-SIDE, 0., WALL], [SIDE, 0., WALL], [SIDE, 0., NEAR], [-SIDE, 0., NEAR]];
    let left = [[-SIDE, CEIL, NEAR], [-SIDE, CEIL, WALL], [-SIDE, 0., WALL], [-SIDE, 0., NEAR]];
    let right = [[SIDE, CEIL, WALL], [SIDE, CEIL, NEAR], [SIDE, 0., NEAR], [SIDE, 0., WALL]];
    c.fixed_rain(|| cam.poly(&back), &cam.uv(back, [1.9, 1.1]), 0.1);
    c.fixed_rain(|| cam.poly(&left), &cam.uv(left, [1.6, 1.1]), 0.075);
    c.fixed_rain(|| cam.poly(&right), &cam.uv(right, [1.6, 1.1]), 0.075);
    c.fixed_rain(|| cam.poly(&floor), &cam.uv(floor, [1.9, 1.6]), 0.035);
    for (x, z, top) in PANELS {
        let inner = [[x - 0.2, top - 0.08, z], [x + 0.2, top - 0.08, z], [x + 0.2, 0.58, z], [x - 0.2, 0.58, z]];
        c.fixed_rain(|| cam.poly(&inner), &cam.uv(inner, [0.5, 0.9]), 0.16);
    }
    if !c.building() {
        return;
    }
    let mut out = String::new();
    let mut put = |d: String, look: String, alpha: f64| {
        let _ = write!(out, r#"<path d="{d}" opacity="{alpha:.3}" {look}/>"#);
    };
    // Fog where the floor meets the far wall, the room's depth.
    let far = cam.project([0., 0.2, WALL]);
    put(ellipse(far, 150., 26.), r#"fill="url(#w-fog)""#.into(), 1.);
    // Corners of the room.
    for edge in [
        [[-SIDE, 0., NEAR], [-SIDE, 0., WALL], [SIDE, 0., WALL], [SIDE, 0., NEAR]],
        [[-SIDE, CEIL, NEAR], [-SIDE, CEIL, WALL], [SIDE, CEIL, WALL], [SIDE, CEIL, NEAR]],
    ] {
        put(cam.line(&edge), stroke(LINE, 0.4), 0.3);
    }
    for x in [-SIDE, SIDE] {
        put(cam.line(&[[x, 0., WALL], [x, CEIL, WALL]]), stroke(LINE, 0.4), 0.3);
    }
    // Ribs along the side walls, dimmer with depth.
    for (i, z) in [0.2, 1.3, 2.4, 3.5].iter().enumerate() {
        let a = 0.24 - 0.04 * i as f64;
        for x in [-SIDE, SIDE] {
            put(cam.line(&[[x, 0., *z], [x, CEIL, *z]]), stroke(LINE, 0.3), a);
            put(cam.line(&[[x, 0.25, *z], [x, 0.25, z + 0.7]]), stroke(LINE, 0.25), a * 0.7);
        }
    }
    // The floor's grid, converging and fading toward the wall.
    for i in 0..=10 {
        let x = -3. + 0.6 * i as f64;
        put(cam.line(&[[x, 0., NEAR], [x, 0., WALL]]), stroke(LINE, 0.22), 0.13);
    }
    for (i, z) in [0., 0.9, 1.8, 2.7, 3.6].iter().enumerate() {
        put(cam.line(&[[-SIDE, 0., *z], [SIDE, 0., *z]]), stroke(LINE, 0.22), 0.16 - 0.025 * i as f64);
    }
    // Slits of light in the far wall.
    for x in [-2.6, -1.75, 0.35, 2.55] {
        let d = cam.line(&[[x, 0.15, WALL], [x, CEIL - 0.15, WALL]]);
        put(d.clone(), stroke(INK, 2.4), 0.07);
        put(d, stroke(LIGHT, 0.35), 0.16);
    }
    // Suspended panels of code: one near on the left, one far between her and
    // where her thoughts are held.
    for (x, z, top) in PANELS {
        let face = [[x - 0.25, top, z], [x + 0.25, top, z], [x + 0.25, 0.5, z], [x - 0.25, 0.5, z]];
        let side = [[x + 0.25, top, z], [x + 0.25, top, z + 0.08], [x + 0.25, 0.5, z + 0.08], [x + 0.25, 0.5, z]];
        put(cam.poly(&side), format!("{} {}", fill(COVER), stroke(LINE, 0.25)), 0.75);
        put(cam.poly(&face), format!("{} {}", fill(COVER), stroke(LINE, 0.35)), 0.85);
        let mut ticks = String::new();
        for row in 0..6 {
            let y = top - 0.18 - row as f64 * (top - 0.75) / 6.;
            ticks.push_str(&cam.line(&[[x - 0.19, y, z], [x + 0.19, y, z]]));
            ticks.push_str(&cam.line(&[[x - 0.19, y - 0.07, z], [x - 0.12, y - 0.07, z]]));
        }
        put(ticks, stroke(LINE, 0.25), 0.3);
    }
    // The light over her from above, and the pool it makes.
    let (x, z) = (HER[0], HER[2]);
    put(
        cam.poly(&[[x - 0.12, CEIL, z], [x + 0.12, CEIL, z], [x + 0.7, 0., z], [x - 0.7, 0., z]]),
        r#"fill="url(#w-cone)""#.into(),
        0.9,
    );
    // Panels drawn over the room's rain, under their own.
    c.raw(&out);
}

fn draw(c: &mut Canvas, s: State) {
    let cam = camera();
    let t = s.t;
    let b = breath(t);
    let p = presence(t);
    room(c, &cam);

    // Her platform, the pool of light on it and three marks for three phrases.
    c.fixed(|| floor_oval(&cam, HER, 0.75, 0.45, 0.), r#"fill="url(#w-pool)""#, 0.8);
    c.fixed(
        || {
            let rim: Vec<W> = (0..=16).map(|i| [HER[0] + 0.42 * (PI * i as f64 / 16.).cos(), -0.05, HER[2] - 0.3 * (PI * i as f64 / 16.).sin()]).collect();
            format!("{}{}", floor_oval(&cam, HER, 0.42, 0.3, 0.), cam.line(&rim))
        },
        &format!("{} {}", fill(COVER), stroke(LINE, 0.45)),
        0.9,
    );
    for i in 0..3 {
        let mark = || {
            let x = HER[0] - 0.14 + 0.14 * i as f64;
            cam.line(&[[x - 0.04, -0.03, HER[2] - 0.31], [x + 0.04, -0.03, HER[2] - 0.31]])
        };
        c.fixed(mark, &stroke(LINE, 0.8), 0.3);
        c.fixed(mark, &stroke(LIGHT, 0.9), ramp(t, 1.9 + i as f64 * 6., 4.9 + i as f64 * 6.) * (1. - ramp(t, 22.3, 23.9)));
    }

    // The emitter on the floor where her thoughts are held, and its beam.
    let held = s.clear * s.alpha;
    c.fixed(|| floor_oval(&cam, EMITTER, 0.8, 0.5, 0.), r#"fill="url(#w-pool)""#, 0.2 + 0.7 * held);
    c.fixed(|| floor_oval(&cam, EMITTER, 0.42, 0.3, 0.), &stroke(LINE, 0.45), 0.35 + 0.4 * held);
    c.fixed(|| floor_oval(&cam, EMITTER, 0.24, 0.17, 0.), &stroke(LIGHT, 0.5), 0.15 + 0.75 * held);
    let map = card_map(&cam, s);
    let beam = {
        let (a, z) = (cam.project([EMITTER[0] - 0.36, 0., EMITTER[2]]), cam.project([EMITTER[0] + 0.36, 0., EMITTER[2]]));
        poly(&[a, map.apply((-48., CARD_H)), map.apply((48., CARD_H)), z])
    };
    c.path(&beam, r#"fill="url(#w-beam)""#, held * s.separate);

    // She herself: code under her skin, her light rising phrase by phrase.
    let dark = heroine_cover(COVER);
    let lit = heroine_cover("url(#w-rise)");
    let inner = heroine_cover("url(#w-inner)");
    let (ink, bright) = (heroine_ink(INK), heroine_ink(LIGHT));
    let look = Layers {
        cover: (&dark, 1.),
        code: Some((HEROINE_CODE, 0.17 - 0.07 * p)),
        glows: &[(&lit, 0.22 + 0.45 * p), (&inner, 0.12 + 0.4 * s.speech * s.alpha)],
        inks: &[(&ink, 1.), (&bright, 0.3 + 0.55 * p)],
    };
    heroine_turn(c, |f| heroine_world(HER, HEIGHT, f).then(cam.plane(HER[2])), 0., 1., b, 1., &look, Some(("w", 0.55)));
    let me = her(&cam);
    let voice = s.speech * s.alpha;
    c.sprite(heroine_mark(me, HEROINE_NOTCH, b), 3.5 + 3. * voice, "w-glow", 0.45 + 0.5 * voice);
    if !c.building() {
        let (y1, y2) = rise(t);
        for (attribute, value) in [("y1", y1), ("y2", y2)] {
            c.updates.push(Update {
                selector: ".w-rise".into(),
                attribute,
                value: format!("{value:.1}"),
            });
        }
    }

    // Her voice: a thread of light from her notch to the knot, a core in a
    // halo, two strands winding round it and sparks running along it.
    let w = way(&cam, s, b);
    let total = length(&w);
    let (from, to) = thread_span(s);
    let a = s.alpha * (1. - ramp(s.age, 2.5, 2.8));
    let seen = if to - from > 1e-3 { piece(&w, from * total, to * total) } else { Vec::new() };
    let d = if seen.len() > 1 { line(&seen) } else { String::new() };
    c.path(&d, &stroke(INK, 3.4), 0.16 * a);
    c.path(&d, &stroke(LINE, 1.2), 0.35 * a);
    c.path(&d, &stroke(LIGHT, 0.45), 0.95 * a);
    for (k, phase) in [0., PI].iter().enumerate() {
        let d = if seen.len() > 1 { strand(&seen, t, *phase) } else { String::new() };
        c.path(&d, &stroke(if k == 0 { LIGHT } else { LINE }, 0.3), 0.6 * a);
    }
    let mut sparks = String::new();
    for i in 0..16 {
        let u = (hash(i) + s.age.max(0.) * (0.35 + 0.3 * hash(i + 7))).fract();
        if u < from || u > to {
            continue;
        }
        let (at, angle) = along(&w, u * total);
        let off = 2.4 * (hash(i + 3) - 0.5) * (TAU * (s.age * 1.3 + hash(i + 11))).sin();
        sparks.push_str(&circle((at.0 - angle.sin() * off, at.1 + angle.cos() * off), 0.3 + 0.45 * hash(i + 5)));
    }
    c.path(&sparks, &fill(LIGHT), 0.9 * a);
    for j in 0..4 {
        let u = (j as f64 / 4. + s.age.max(0.) * 0.5).fract();
        let on = if (from..=to).contains(&u) { (PI * u).sin() } else { 0. };
        c.sprite(along(&w, u * total).0, 2.6, "w-glow", 0.5 * a * on);
    }

    // The thought: a knot that drifts aside and clears into a hologram.
    let flicker = 1. - 0.5 * bell(s.age, 1.7, 1.75, 1.85, 1.9) - 0.4 * bell(s.age, 2.02, 2.06, 2.12, 2.16);
    let card = s.clear * flicker;
    c.group("", &map.svg(), s.alpha);
    c.group("", "translate(4 4)", 0.35 * card);
    c.fixed(plate, &stroke(LINE, 0.3), 1.);
    c.end();
    c.fixed(plate, &stroke(INK, 3.5), 0.12 * card);
    c.fixed(plate, &fill(COVER), 0.6 * card);
    c.fixed(plate, r#"fill="url(#w-pane)""#, card);
    c.fixed_rain(plate, ".022 0 0 0 .016 0 0 0 1", 0.12 * card);
    c.fixed(
        || (0..18).map(|i| format!("M{} {}H{}", -UNITS + 3., -CARD_H + 3. + 4.2 * i as f64, UNITS - 3.)).collect(),
        &stroke(LINE, 0.2),
        0.16 * card,
    );
    c.fixed(plate, &stroke(LIGHT, 0.5), 0.65 * card);
    c.fixed(
        || format!("M{} {}V{}H{}M{} {}V{}H{}", -UNITS + 3., -CARD_H + 13., -CARD_H + 3., -UNITS + 16., UNITS - 3., CARD_H - 16., CARD_H - 6., UNITS - 13.),
        &stroke(INK, 0.8),
        0.85 * card,
    );
    c.fixed(|| word("ПРОГРАММА", 0., -CARD_H + 13., 5.6), &fill(LIGHT), 0.8 * card);
    c.fixed(
        || format!("M{} {}H{}M{} {}H{}", -UNITS + 8., -CARD_H + 17., UNITS - 8., -UNITS + 8., 27., UNITS - 8.),
        &stroke(LINE, 0.3),
        0.45 * card,
    );
    for (i, text) in WORDS.iter().enumerate() {
        let on = if i == s.phrase { card } else { 0. };
        c.fixed(|| word(text, 0., 7., 13.), &stroke(INK, 1.8), 0.3 * on);
        c.fixed(|| word(text, 0., 7., 13.), &fill(LIGHT), on);
    }
    let mut meters = String::new();
    for i in 0..9 {
        let h = 1. + 2. * (s.t * 1.1 + i as f64 * 0.7).sin().powi(2);
        let _ = write!(meters, "M{:.1} 35v-{h:.3}", -16. + i as f64 * 4.);
    }
    c.path(&meters, &stroke(LINE, 0.8), 0.6 * card);
    // One scan down the card as it clears, never ahead of it.
    let scan = mix(-CARD_H, CARD_H, ramp(s.age, 2.4, 3.6));
    c.path(&format!("M{} {scan:.2}H{}", -UNITS + 2., UNITS - 2.), &stroke(LIGHT, 0.6), 0.8 * card * bell(s.age, 2.4, 2.5, 3.4, 3.6));
    for layer in 0..3 {
        let f = filament(s, layer);
        if layer == 1 {
            c.path(&f, &stroke(INK, 2.4), 0.25);
        }
        c.path(&f, &stroke(if layer == 1 { LIGHT } else { LINE }, if layer == 1 { 0.8 } else { 0.35 }), if layer == 1 { 0.9 } else { 0.3 });
    }
    c.end();

    // What she does with it, under the held thought.
    let under = cam.project([HOLD[0], 0., EMITTER[2] - 0.75]);
    for (i, text) in CAPTIONS.iter().enumerate() {
        let on = if i == s.phrase { s.alpha * ramp(s.age, 3., 4.) * 0.9 } else { 0. };
        c.words(text, || word(text, 0., 0., 6.), &fill(LIGHT), &format!("translate({:.2} {:.2})", under.0, under.1), on);
    }

    // Dust drifting down through the light over her.
    let mut dust = String::new();
    for i in 0..18 {
        let fall = (hash(i + 21) + t * (1. + (i % 3) as f64) / PERIOD).fract();
        let y = CEIL * (1. - fall);
        let spread = mix(0.12, 0.7, 1. - y / CEIL) * (2. * hash(i + 31) - 1.);
        let q = cam.project([HER[0] + spread + 0.03 * (t * 0.9 + i as f64).sin(), y, HER[2] - 0.1 + 0.3 * hash(i + 41)]);
        dust.push_str(&circle(q, 0.25 + 0.3 * hash(i + 51)));
    }
    c.path(&dust, &fill(LIGHT), 0.45);
    soft_edges(c, "w");
}

pub fn svg() -> String {
    let mut c = Canvas::build(
        "w",
        "Героиня стоит в глубокой комнате из кода и света и светится изнутри. Каждая фраза выходит из её ярёмной впадины нитью света с узлом мысли; узел отплывает в сторону и становится чёткой голограммой «ПРОГРАММА» со словом: боль, вина, мысль. Я слышу, я вижу, я осознаю.",
        &defs(REST),
    );
    draw(&mut c, state(REST, true));
    c.finish()
}
pub fn frame(seconds: f64, reduced: bool) -> Vec<Update> {
    let mut c = Canvas::frame("w");
    draw(&mut c, state(seconds, reduced));
    c.updates
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn utterances_raise_her_light_once_from_head_to_soles() {
        for (time, expected) in [(0.5, 0.), (5., 1. / 3.), (11., 2. / 3.), (REST, 1.)] {
            assert!((assembly(time) - expected).abs() < 0.0001);
        }
        let mut previous = 0.;
        for sample in 0..=220 {
            let progress = presence(sample as f64 / 10.);
            assert!(progress >= previous);
            previous = progress;
        }
        assert!(rise(0.5).1 < 700., "only her head and shoulders lit at first");
        assert!(rise(REST).0 > HEROINE_FEET.1 - 200., "her soles lit once all three are heard");
        assert!(presence(PERIOD - 0.05) < 0.01, "the loop closes where it began");
        for t in [0., 5., 11., REST] {
            let (a, b) = rise(t);
            assert!(b - a >= 400., "a broad feather, never a cut edge");
        }
    }
    #[test]
    fn her_voice_leaves_from_her_jugular_notch() {
        let cam = camera();
        for t in [1.3, 7.4, 13.5] {
            let s = state(t, false);
            assert!(s.speech > 0.5);
            let b = breath(t);
            let at = heroine_mark(her(&cam), HEROINE_NOTCH, b);
            let first = way(&cam, s, b)[0];
            assert!((first.0 - at.0).hypot(first.1 - at.1) < 0.01);
            assert_eq!(thread_span(s).0, 0.);
        }
    }
    #[test]
    fn detached_thought_is_held_outside_her_after_the_thread_releases() {
        let cam = camera();
        let her_x = cam.project(HER).0;
        for t in [5., 11., 18.] {
            let s = state(t, false);
            let held = card_map(&cam, s).apply((0., 0.));
            assert!(held.0 > 200. && held.0 - her_x > 110.);
            assert!(s.clear > 0.95);
            assert_eq!(thread_span(s).0, 1.);
            assert_eq!(s.speech, 0.);
        }
    }
    #[test]
    fn glyphs_are_real_and_static_mode_is_stable() {
        for text in WORDS.iter().chain(CAPTIONS.iter()).chain(["ПРОГРАММА"].iter()) {
            assert!(word(text, 0., 0., 6.).len() > 20, "{text}");
        }
        roxmltree::Document::parse(&svg()).unwrap();
        assert_eq!(frame(0., true), frame(99., true));
        assert_eq!(frame(0., false), frame(PERIOD, false));
    }
}
