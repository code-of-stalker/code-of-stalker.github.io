//! Practice 6, "Говори с собой! Слушай свой голос — не как шум, а как Зов."
//! A corridor of noise: thoughts circle her and her voice comes out torn and
//! drowns. Behind her the Observer rises, large and calm; its attention opens
//! from its jugular notch in spheres, the noise falls away and her voice
//! straightens into one pure tone. The tone travels down the corridor into the
//! distance and comes back as the Call, ring after ring, answered each time by
//! light from inside her jugular notch, and the Observer settles into her:
//! Observation, Sounding and Presence.
use crate::{practice_stage::*, step_three::Update};
use std::{
    f64::consts::TAU,
    sync::LazyLock,
};

pub const PERIOD: f64 = 28.;
/// The reduced-motion still: one with the Observer, its three names lit.
pub const REST: f64 = 24.4;

const HER: W = [-0.85, 0., 0.4];
const HEIGHT: f64 = 1.68;
/// Where the Observer stands once risen: behind her back, on our side of
/// her, to the right; taller than her, never over her head.
const WATCHER: W = [0.8, 0., -0.6];
const WATCHER_HEIGHT: f64 = 2.15;
/// Spheres of the Observer's attention: how many at once, each one's life in
/// seconds and how far it reaches, metres.
const SPHERES: usize = 3;
const SPHERE_LIFE: f64 = 2.7;
const SPHERE_REACH: f64 = 1.6;
/// The corridor: half its width, its walls' height, where it starts and ends.
const HALF: f64 = 2.;
const WALL: f64 = 4.4;
const NEAR: f64 = -1.5;
const FAR: f64 = 16.;
/// Where the tone goes: far down the corridor's axis.
const DISTANCE: W = [0.05, 1.5, 15.5];
const RISE: (f64, f64) = (5.4, 8.6);
const GAZE: (f64, f64) = (8.6, 9.6);
const QUIET: (f64, f64) = (9.6, 12.6);
const SPEAK: f64 = 10.;
const TRAVEL: (f64, f64) = (13., 16.);
/// The Call leaves the distance in four rings, each this long on its way.
const CALLS: [f64; 4] = [16.2, 16.8, 17.4, 18.];
const RETURN: f64 = 2.8;
const MERGE: (f64, f64) = (20.4, 22.8);
/// Torn attempts before the Observer looks: start and reach in metres.
const BURSTS: [(f64, f64); 3] = [(1.4, 0.65), (2.9, 0.85), (4.4, 0.7)];
/// The stretch of voice the gaze holds, where it rests on it, and the length
/// of the tone that travels on, all in metres along the voice.
const NEAR_VOICE: f64 = 1.6;
const GAZE_AT: f64 = 0.9;
const PACKET: f64 = 1.2;
const WAVELENGTH: f64 = 0.3;
const FRAGMENTS: [&str; 8] = ["ОПЯТЬ НЕ ТАК", "ЧТО ОНИ СКАЖУТ", "НАДО БЫЛО", "НЕ УСПЕЮ", "А ЕСЛИ", "ПОЧЕМУ Я", "ПОТОМ", "ХВАТИТ"];
/// Letter size of the circling thoughts, metres.
const FRAGMENT_SIZE: f64 = 0.11;
/// Other voices strung across the corridor: depth and height.
const STATIC: [(f64, f64); 4] = [(4.2, 0.85), (6., 2.65), (8.4, 1.45), (11., 2.15)];
const NAMES: [(&str, f64); 3] = [("НАБЛЮДЕНИЕ", 22.4), ("ЗВУЧАНИЕ", 23.1), ("ПРИСУТСТВИЕ", 23.8)];

fn camera(t: f64) -> Camera {
    Camera {
        eye: wmix([0.25, 1.4, -5.6], [0.05, 1.32, -4.9], ramp(t, 0., 27.5)),
        focal: 300.,
        center: (160., 100.),
    }
}
fn time(seconds: f64, reduced: bool) -> f64 {
    if reduced || !seconds.is_finite() {
        REST
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    }
}
/// The settled breath: the Observer's from the start, hers once it looks.
fn calm(t: f64) -> f64 {
    0.5 - 0.5 * (TAU * (t - QUIET.0) / 4.4).cos()
}
fn breath(t: f64) -> f64 {
    let shallow = 0.3 - 0.3 * (TAU * t / 2.2).cos();
    mix(shallow, calm(t), ramp(t, 8.8, 10.4))
}
fn quiet(t: f64) -> f64 {
    ramp(t, QUIET.0, QUIET.1)
}
fn speaking(t: f64) -> f64 {
    let torn = BURSTS
        .iter()
        .map(|&(at, _)| bell(t, at - 0.1, at + 0.15, at + 0.5, at + 0.9))
        .fold(0., f64::max);
    torn.max(bell(t, SPEAK - 0.2, SPEAK + 0.2, 12.4, 13.2))
}
/// The noise's own clock: it spins on until the Observer looks, then slows
/// almost to rest. The integral of the easing keeps the motion smooth.
fn whirl(t: f64) -> f64 {
    let (a, b) = QUIET;
    let u = ((t - a) / (b - a)).clamp(0., 1.);
    let settled = (b - a) * (u.powi(6) - 3. * u.powi(5) + 2.5 * u.powi(4)) + (t - b).max(0.);
    t - 0.85 * settled
}
/// The Observer rises out of her to stand large behind her, and at the end
/// settles back into her: soles and height.
fn watcher(t: f64) -> (W, f64) {
    let u = ramp(t, RISE.0, RISE.1) * (1. - ramp(t, MERGE.0, MERGE.1));
    (wmix(HER, WATCHER, u), mix(HEIGHT, WATCHER_HEIGHT, u))
}

/// Her jugular notch in the world, where her voice comes from.
fn notch() -> W {
    let q = heroine_world(HER, HEIGHT, 1.).apply(HEROINE_NOTCH);
    [q.0, q.1, HER[2]]
}
/// The voice's way through the world, with the distance walked to each point:
/// out from her jugular notch and away into the depth, passing left of the
/// Observer, to the corridor's far end.
static VOICE: LazyLock<Vec<(W, f64)>> = LazyLock::new(|| {
    let from = notch();
    let (mut last, mut walked) = (from, 0.);
    (0..=400)
        .map(|i| {
            let p = cubic(from, add(from, [0.35, 0.25, 1.2]), [-0.55, 1.75, 6.5], DISTANCE, i as f64 / 400.);
            walked += dot(sub(p, last), sub(p, last)).sqrt();
            last = p;
            (p, walked)
        })
        .collect()
});
fn voice_length() -> f64 {
    VOICE.last().unwrap().1
}
fn voice_at(s: f64) -> W {
    let v = &*VOICE;
    let i = v.partition_point(|&(_, l)| l < s).clamp(1, v.len() - 1);
    let ((a, la), (b, lb)) = (v[i - 1], v[i]);
    wmix(a, b, ((s - la) / (lb - la).max(1e-9)).clamp(0., 1.))
}
/// The spoken voice under the gaze, then the tone travelling away: tail and
/// head in metres along the voice.
fn spoken(t: f64) -> (f64, f64) {
    let head = if t < TRAVEL.0 {
        NEAR_VOICE * ramp(t, SPEAK, SPEAK + 1.2)
    } else {
        mix(NEAR_VOICE, voice_length(), ramp(t, TRAVEL.0, TRAVEL.1))
    };
    let span = mix(NEAR_VOICE, PACKET, ramp(t, TRAVEL.0, TRAVEL.0 + 0.9));
    ((head - span).max(0.), head)
}
/// How pure the voice is at a point: it straightens first where the gaze
/// rests and the calm spreads along it from there.
fn clarity(t: f64, s: f64) -> f64 {
    ramp(t - 0.9 * (s - GAZE_AT).abs().min(1.), 10.5, 12.1)
}
/// The voice between two distances: torn and broken by noise where it is not
/// yet clear, one pure travelling tone where it is.
#[allow(clippy::too_many_arguments)]
fn wave(cam: &Camera, t: f64, tail: f64, head: f64, clear: impl Fn(f64) -> f64, drown: f64, seed: usize) -> String {
    if head - tail < 0.02 {
        return String::new();
    }
    const N: usize = 72;
    let frame = (t * 12.).floor() as usize;
    let mut points: Vec<Option<P>> = Vec::with_capacity(N + 1);
    for i in 0..=N {
        let s = mix(tail, head, i as f64 / N as f64);
        let c = clear(s);
        let n = seed * 997 + i;
        if hash(n * 7 + frame * 131) < (1. - c) * (0.1 + 0.6 * drown) {
            points.push(None);
            continue;
        }
        let edge = ((s - tail) / 0.18).min((head - s) / 0.18).clamp(0., 1.);
        let tone = (TAU * s / WAVELENGTH - 10. * t).sin();
        let torn = 0.55 * (37. * s + 13. * t).sin() + 0.4 * (71. * s - 21. * t + 1.3).sin() + 0.3 * (113. * s + 29. * t).sin() + 0.9 * (hash(n * 31 + frame * 17) - 0.5);
        let p = voice_at(s);
        points.push(Some(cam.project([p[0], p[1] + 0.07 * edge.sqrt() * mix(torn, tone, c), p[2]])));
    }
    let mut d = String::new();
    for run in points.split(Option::is_none).filter(|r| r.len() > 1) {
        d.push_str(&line(&run.iter().flatten().copied().collect::<Vec<_>>()));
    }
    d
}
/// The way the tone has gone, left behind it as a faint line.
fn trail(cam: &Camera, to: f64) -> String {
    if to < 0.05 {
        return String::new();
    }
    cam.line(&(0..=64).map(|i| voice_at(to * i as f64 / 64.)).collect::<Vec<_>>())
}
/// Sphere `k` of the Observer's attention, opening from its jugular notch:
/// how far it has grown, 0 to 1, while the Observer is looking.
fn sphere(t: f64, k: usize) -> Option<f64> {
    let f = ((t - GAZE.0) / SPHERE_LIFE - k as f64 / SPHERES as f64).rem_euclid(1.);
    let born = t - f * SPHERE_LIFE;
    (born >= GAZE.0 && born <= MERGE.0).then_some(f)
}

/// A wavefront of the Call `f` of the way home: it fills the corridor wall to
/// wall as it comes, and only at the last closes onto her jugular notch.
/// Centre and half-axes.
fn call_front(f: f64, home: W) -> (W, f64, f64) {
    let z = mix(DISTANCE[2], home[2], f);
    let pull = ramp(f, 0.45, 1.);
    (wmix([0., 1.8, z], [home[0], home[1], z], pull), mix(1.85, 0.05, pull), mix(1.7, 0.05, pull))
}
fn call_ring(cam: &Camera, f: f64, home: W) -> String {
    let (c, rx, ry) = call_front(f, home);
    cam.poly(
        &(0..40)
            .map(|i| {
                let a = i as f64 / 40. * TAU;
                [c[0] + rx * a.cos(), c[1] + ry * a.sin(), c[2]]
            })
            .collect::<Vec<_>>(),
    )
}

/// A thought circling her on its own tilted orbit: place, opacity, and how
/// far it is behind her (1) rather than before her (0).
fn fragment(i: usize, t: f64) -> (W, f64, f64) {
    let speed = (0.6 + 0.45 * hash(i + 3)) * if i % 2 == 0 { 1. } else { -1. };
    let a = hash(i + 5) * TAU + speed * whirl(t);
    let falls = QUIET.0 + 0.2 + 0.32 * i as f64;
    let f = ramp(t, falls, falls + 1.4);
    let r = 0.6 + 0.3 * hash(i + 1) + 0.35 * f;
    let y = 0.7 + 1.3 * i as f64 / 7. + 0.1 * (a + i as f64).sin() - 0.45 * f;
    let p = [HER[0] + 0.03 + r * a.cos(), y, HER[2] + 0.8 * r * a.sin()];
    (p, 1. - f, ramp(a.sin(), -0.12, 0.12))
}
fn billboard(cam: &Camera, p: W, size: f64) -> String {
    let at = cam.project(p);
    format!("translate({:.2} {:.2}) scale({:.4})", at.0, at.1, size * cam.scale(p[2]) / 10.)
}

fn wall_quad(side: f64) -> [W; 4] {
    let x = side * HALF;
    [[x, WALL, NEAR], [x, WALL, FAR], [x, 0., FAR], [x, 0., NEAR]]
}
/// Ribs every two metres and the wall's top and foot.
fn ribs(cam: &Camera) -> String {
    let mut d = String::new();
    for k in 0..=8 {
        let z = 2. * k as f64;
        d.push_str(&cam.line(&[[-HALF, WALL, z], [-HALF, 0., z], [HALF, 0., z], [HALF, WALL, z]]));
    }
    for side in [-1., 1.] {
        for y in [0., WALL] {
            d.push_str(&cam.line(&[[side * HALF, y, NEAR], [side * HALF, y, FAR]]));
        }
    }
    d
}
fn lanes(cam: &Camera) -> String {
    let mut d = String::new();
    for k in 1..8 {
        let x = -HALF + 0.5 * k as f64;
        d.push_str(&cam.line(&[[x, 0., NEAR], [x, 0., FAR]]));
    }
    d
}
fn static_line(cam: &Camera, t: f64, frame: usize, k: usize, (z, y): (f64, f64), level: f64) -> String {
    cam.line(
        &(0..=40)
            .map(|i| {
                let x = mix(-HALF + 0.05, HALF - 0.05, i as f64 / 40.);
                let n = 0.5 * (9. * x + 7. * t + k as f64).sin() + 0.35 * (23. * x - 11. * t).sin() + 0.6 * (hash(i * 13 + k * 101 + frame * 7) - 0.5);
                [x, y + 0.13 * level * n, z]
            })
            .collect::<Vec<_>>(),
    )
}

fn defs() -> String {
    let (hx, hy) = HEROINE_HEART;
    let (nx, ny) = HEROINE_NOTCH;
    format!(
        r#"{}<radialGradient id="zv-deep"><stop stop-color="var(--book-cover)"/><stop offset=".5" stop-color="var(--book-cover)" stop-opacity=".85"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity="0"/></radialGradient><linearGradient id="zv-top" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--book-cover)"/><stop offset=".5" stop-color="var(--book-cover)" stop-opacity=".7"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity="0"/></linearGradient><radialGradient id="zv-pool"><stop stop-color="var(--book-light)" stop-opacity=".35"/><stop offset=".4" stop-color="var(--book-line)" stop-opacity=".14"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="zv-inner" gradientUnits="userSpaceOnUse" cx="{hx}" cy="{hy}" r="520"><stop stop-color="var(--book-light)" stop-opacity=".95"/><stop offset=".22" stop-color="var(--book-line)" stop-opacity=".55"/><stop offset=".55" stop-color="var(--book-ink)" stop-opacity=".2"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="zv-aura" gradientUnits="userSpaceOnUse" cx="{hx}" cy="{hy}" r="900"><stop stop-color="var(--book-line)" stop-opacity=".75"/><stop offset=".5" stop-color="var(--book-ink)" stop-opacity=".35"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".1"/></radialGradient><filter id="zv-aura-blur" x="-80%" y="-30%" width="260%" height="160%"><feGaussianBlur stdDeviation="4"/></filter><radialGradient id="zv-sphere"><stop offset=".55" stop-color="var(--book-line)" stop-opacity="0"/><stop offset=".86" stop-color="var(--book-line)" stop-opacity=".07"/><stop offset=".97" stop-color="var(--book-light)" stop-opacity=".2"/><stop offset="1" stop-color="var(--book-light)" stop-opacity="0"/></radialGradient><radialGradient id="zv-notch" gradientUnits="userSpaceOnUse" cx="{nx}" cy="{ny}" r="460"><stop stop-color="var(--book-light)" stop-opacity=".95"/><stop offset=".2" stop-color="var(--book-line)" stop-opacity=".55"/><stop offset=".55" stop-color="var(--book-ink)" stop-opacity=".18"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>{}"#,
        glow_defs("zv"),
        edge_defs("zv"),
    )
}

fn draw(c: &mut Canvas, t: f64, reduced: bool) {
    let cam = camera(t);
    let b = breath(t);
    let wb = calm(t);
    let noise = 1. - quiet(t);
    let frame = (t * 12.).floor() as usize;
    let master = if reduced { 1. } else { ramp(t, 0., 1.2) * (1. - ramp(t, 26.2, 27.8)) };
    let (feet, height) = watcher(t);
    let present = ramp(t, RISE.0, RISE.0 + 1.) * (1. - ramp(t, MERGE.1 - 0.4, MERGE.1 + 0.2));
    let gazing = ramp(t, GAZE.0, GAZE.1) * (1. - ramp(t, MERGE.0, MERGE.0 + 1.2));
    let arrived = ramp(t, TRAVEL.1 - 0.2, TRAVEL.1 + 0.4);
    let warm = ramp(t, CALLS[0] + RETURN - 0.2, CALLS[3] + RETURN);
    let end = ramp(t, MERGE.1 - 0.6, MERGE.1 + 0.8);
    c.group("", "", master);
    c.fixed(|| "M-20 -20H340V212H-20Z".into(), &fill(COVER), 1.);

    // The corridor: walls and floor of code, flickering with the noise.
    let flicker = 0.6 + 0.4 * hash(frame / 3 + 900);
    for side in [-1., 1.] {
        let quad = wall_quad(side);
        c.rain(&cam.poly(&quad), &cam.uv(quad, [(FAR - NEAR) / 6., WALL / 5.]), 0.1 + 0.12 * noise * flicker + 0.05 * end);
    }
    let floor = [[-HALF, 0., FAR], [HALF, 0., FAR], [HALF, 0., NEAR], [-HALF, 0., NEAR]];
    c.rain(&cam.poly(&floor), &cam.uv(floor, [2. * HALF / 6., (FAR - NEAR) / 5.]), 0.06 + 0.05 * noise);
    c.path(&ribs(&cam), &stroke(LINE, 0.3), 0.16);
    c.path(&lanes(&cam), &stroke(LINE, 0.25), 0.07);
    // Other voices strung across it, until the Observer looks.
    let mut hiss = String::new();
    for (k, &row) in STATIC.iter().enumerate() {
        hiss.push_str(&static_line(&cam, t, frame, k, row, noise));
    }
    c.path(&hiss, &stroke(LINE, 0.35), 0.4 * noise);
    // Far off the corridor sinks into the dark; the tone kindles a light there.
    let deep = cam.project([0., 1.7, FAR]);
    let k = cam.scale(FAR);
    c.path(&ellipse(deep, (HALF + 0.9) * k, 3.1 * k), r#"fill="url(#zv-deep)""#, 1.);
    let star = cam.project(DISTANCE);
    let kindle = bell(t, TRAVEL.1 - 0.1, TRAVEL.1 + 0.2, TRAVEL.1 + 0.4, CALLS[0] + 0.8);
    c.sprite(star, 3. + 10. * kindle + 1.5 * wb, "zv-glow", arrived * (0.55 + 0.45 * kindle) * (1. - 0.35 * end));
    let above = cam.project(add(DISTANCE, [0., 1.2, 0.]));
    let call = bell(t, CALLS[0], CALLS[0] + 0.8, MERGE.0 + 0.2, MERGE.0 + 1.2);
    c.words("ЗОВ", || word("ЗОВ", 0., 3.6, 10.), &fill(LIGHT), &format!("translate({:.2} {:.2}) scale(.85)", above.0, above.1 - 2. * (1. - call)), call);
    c.fixed(|| "M-20 -20H340V64H-20Z".into(), r#"fill="url(#zv-top)""#, 1.);

    // The Observer: risen out of her, large and calm at her back.
    let dark = heroine_cover(COVER);
    let aura = heroine_cover("url(#zv-aura)");
    let inner = heroine_cover("url(#zv-inner)");
    let (ink, lit) = (heroine_ink(INK), heroine_ink(LIGHT));
    let fine = format!("{:.6} 0 0 0 {:.6} 0 0 0 1", 0.000407 * 2., 0.000488 * 2.);
    let halo = Layers { cover: (&aura, 1.), code: None, glows: &[], inks: &[] };

    // Thoughts passing behind her.
    let thoughts: Vec<(W, f64, f64)> = (0..FRAGMENTS.len()).map(|i| fragment(i, t)).collect();
    for (&text, &(p, a, behind)) in FRAGMENTS.iter().zip(&thoughts) {
        c.words(text, || word(text, 0., 3.6, 10.), &fill(LINE), &billboard(&cam, p, FRAGMENT_SIZE), 0.7 * a * behind);
    }

    // She herself: code under her skin until the Call and the Observer settle in her.
    let me = heroine_world(HER, HEIGHT, 1.).then(cam.plane(HER[2]));
    let heart = heroine_mark(me, HEROINE_HEART, b);
    c.path(&floor_ring(&cam, HER, 0.7), r#"fill="url(#zv-pool)""#, 0.25 + 0.55 * end);
    c.group(r#"filter="url(#zv-aura-blur)""#, "", end * (0.3 + 0.2 * b));
    heroine(c, me.then(Affine::about(heart, 1.1, 1.05)), b, 1., &halo);
    c.end();
    // The Call is answered from inside her: light rising in her jugular notch.
    let landing = CALLS
        .iter()
        .map(|&a| {
            let at = a + RETURN;
            bell(t, at - 0.15, at, at + 0.1, at + 0.9)
        })
        .fold(0., f64::max);
    let from_within = heroine_cover("url(#zv-notch)");
    let mine = Layers {
        cover: (&dark, 1.),
        code: Some((HEROINE_CODE, 0.14 * (1. - 0.6 * end))),
        glows: &[(&from_within, 0.35 * warm + 0.4 * landing + end * (0.45 + 0.3 * b))],
        inks: &[(&ink, 1.), (&lit, 0.15 * warm + 0.55 * end)],
    };
    heroine(c, me, b, 1., &mine);
    // The Observer, nearer us than she is, so drawn over her.
    let place = heroine_world(feet, height, 1.).then(cam.plane(feet[2]));
    let its_heart = heroine_mark(place, HEROINE_HEART, wb);
    c.path(&floor_ring(&cam, feet, 0.35 * height), r#"fill="url(#zv-pool)""#, 0.6 * present);
    c.group(r#"filter="url(#zv-aura-blur)""#, "", (0.35 + 0.2 * wb + 0.25 * gazing) * present);
    heroine(c, place.then(Affine::about(its_heart, 1.08, 1.04)), wb, 1., &halo);
    c.end();
    let presence = Layers {
        cover: (&dark, 1.),
        code: Some((&fine, 0.12)),
        glows: &[(&inner, 0.3 + 0.2 * wb + 0.2 * gazing)],
        inks: &[(&lit, 0.85)],
    };
    heroine(c, place, wb, 0.92 * present, &presence);
    // Its attention: not a beam from the eyes but spheres opening from its
    // jugular notch, wide enough to hold her and her voice.
    let source = heroine_mark(place, HEROINE_NOTCH, wb);
    c.sprite(source, 2.5 + gazing + 0.6 * wb, "zv-glow", 0.8 * gazing * present);
    let scale = cam.scale(feet[2]);
    for k in 0..SPHERES {
        let (d, shell, rim) = match sphere(t, k) {
            Some(f) => {
                let r = (0.12 + SPHERE_REACH * f.sqrt()) * scale;
                let a = gazing * present * ramp(f, 0., 0.12) * (1. - ramp(f, 0.5, 1.));
                (circle(source, r), a, 0.35 * a)
            }
            None => (String::new(), 0., 0.),
        };
        c.path(&d, r#"fill="url(#zv-sphere)""#, shell);
        c.path(&d, &stroke(LINE, 0.3), rim);
    }
    // The Observer's light outline coming to rest on hers.
    let settle = ramp(t, MERGE.0 + 1.2, MERGE.1 - 0.2) * (1. - ramp(t, MERGE.1, MERGE.1 + 1.));
    let outline = Layers { cover: (&dark, 0.), code: None, glows: &[], inks: &[(&lit, 0.9)] };
    heroine(c, place, wb, settle, &outline);
    let her_notch = heroine_mark(me, HEROINE_NOTCH, b);
    c.sprite(her_notch, 3.5 + 1.5 * b, "zv-glow", 0.55 * speaking(t));
    c.sprite(her_notch, 3. + 2. * b + 8. * landing, "zv-glow", 0.45 * warm + 0.5 * landing + end * (0.3 + 0.2 * b));
    // Each Call that lands answers back as a ring of light from the notch.
    for &a in &CALLS {
        let f = (t - a - RETURN) / 1.1;
        let on = (0. ..1.).contains(&f);
        c.path(&if on { circle(her_notch, 1.5 + 9. * f.sqrt()) } else { String::new() }, &stroke(LIGHT, 0.4), if on { 0.6 * (1. - f) } else { 0. });
    }

    // Thoughts passing before her.
    for (&text, &(p, a, behind)) in FRAGMENTS.iter().zip(&thoughts) {
        c.words(text, || word(text, 0., 3.6, 10.), &fill(LINE), &billboard(&cam, p, FRAGMENT_SIZE), 0.75 * a * (1. - behind));
    }

    // Her voice: torn attempts swallowed by the noise, then the one the
    // Observer hears, straightening into a tone that travels away.
    for (k, &(at, reach)) in BURSTS.iter().enumerate() {
        let u = t - at;
        let (d, alpha) = if (0. ..1.6).contains(&u) {
            let (tail, head) = (0.6 * reach * ramp(u, 0.5, 1.4), reach * ramp(u, 0., 0.45));
            (wave(&cam, t, tail, head, |_| 0., ramp(u, 0.2, 1.2), k), 0.85 * (1. - ramp(u, 0.7, 1.5)))
        } else {
            (String::new(), 0.)
        };
        c.path(&d, &stroke(LINE, 0.6), alpha);
    }
    let (tail, head) = spoken(t);
    let shown = 1. - ramp(head, voice_length() - 1.2, voice_length() - 0.1);
    c.path(&trail(&cam, tail), &stroke(LINE, 0.4), 0.3 * ramp(t, TRAVEL.0, TRAVEL.0 + 0.6) * (1. - ramp(t, MERGE.0, MERGE.1)));
    let tone = wave(&cam, t, tail, head, |s| clarity(t, s), 0.15 * noise, 7);
    c.path(&tone, &stroke(INK, 2.2), 0.3 * shown);
    c.path(&tone, &stroke(LIGHT, 0.6), 0.95 * shown);
    c.sprite(cam.project(voice_at(head)), 2.4, "zv-glow", ramp(t, TRAVEL.0, TRAVEL.0 + 0.4) * shown);
    let held = cam.project(voice_at(GAZE_AT));
    c.path(&ticks(held, 6. + 0.8 * wb, 16, 0.4 * t), &stroke(LINE, 0.4), 0.6 * ramp(t, GAZE.1, GAZE.1 + 0.6) * (1. - ramp(t, 12.6, 13.4)));

    // The Call coming home, ring after ring, into her jugular notch.
    let (hx, hy) = notch_world(b);
    let home = [hx, hy, HER[2]];
    for &at in &CALLS {
        let f = (t - at) / RETURN;
        let on = (0. ..1.).contains(&f);
        let d = if on { call_ring(&cam, f, home) } else { String::new() };
        let a = if on { bell(f, 0., 0.12, 0.85, 1.) } else { 0. };
        c.path(&d, &stroke(LINE, 2.4), 0.12 * a);
        c.path(&d, &stroke(LIGHT, 0.5), 0.7 * a);
    }

    // Names: the noise, and at the end who she is.
    let shout = cam.project([1.15, 2.85, 3.4]);
    let jitter = (hash(frame + 300) - 0.5, hash(frame + 600) - 0.5);
    let size = 0.32 * cam.scale(3.4) / 10.;
    let place_noise = format!("translate({:.2} {:.2}) scale({size:.4})", shout.0 + 1.4 * jitter.0 * noise, shout.1 + 1.4 * jitter.1 * noise);
    c.words("ШУМ", || word("ШУМ", 0., 3.6, 10.), &fill(LINE), &place_noise, 0.8 * bell(t, 1., 1.8, 9.8, 11.));
    for (k, &(text, from)) in NAMES.iter().enumerate() {
        let a = bell(t, from, from + 0.8, 25.4, 26.2);
        let at = cam.project([1., 2.8 - 0.33 * k as f64, 2.2]);
        let place = format!("translate({:.2} {:.2}) scale(.8)", at.0, at.1 + 2. * (1. - a));
        c.words(text, || word(text, 0., 3.6, 10.), &fill(LINE), &place, a);
    }
    for k in 0..2 {
        let f = ((t - MERGE.1) / 4.4 + k as f64 * 0.5).rem_euclid(1.);
        let on = ramp(t, MERGE.1, MERGE.1 + 1.) * (1. - ramp(t, 25.4, 26.4));
        c.path(&floor_ring(&cam, HER, 0.3 + 2.2 * f), &stroke(LINE, 0.45), 0.35 * (1. - f) * on);
    }

    c.path(&motes(&cam, t, 24, 700, (-1.9, 1.9), (0., 12.), 4., 0.012), &fill(LINE), 0.35);
    soft_edges(c, "zv");
    c.end();
}
/// Her jugular notch in world metres, breathing.
fn notch_world(breath: f64) -> P {
    heroine_mark(heroine_world(HER, HEIGHT, 1.), HEROINE_NOTCH, breath)
}

pub fn svg() -> String {
    let mut c = Canvas::build(
        "zv",
        "Героиня стоит в коридоре шума: вокруг неё кружат обрывки мыслей, её голос рвётся и тонет. Сзади справа поднимается большой спокойный Наблюдатель; его внимание расходится сферами из яремной впадины. Шум стихает, голос выпрямляется в чистый тон и уходит вдаль, а оттуда возвращается Зовом, кольцо за кольцом, и каждый раз отзывается светом изнутри её яремной впадины. Наблюдатель сливается с ней: Наблюдение, Звучание, Присутствие.",
        &defs(),
    );
    draw(&mut c, REST, false);
    c.finish()
}
pub fn frame(seconds: f64, reduced: bool) -> Vec<Update> {
    let reduced = reduced || !seconds.is_finite();
    let mut c = Canvas::frame("zv");
    draw(&mut c, time(seconds, reduced), reduced);
    c.updates
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn the_observer_rises_out_of_her_and_settles_back() {
        for t in [0., RISE.0, MERGE.1, PERIOD - 0.1] {
            assert_eq!(watcher(t), (HER, HEIGHT), "{t}");
        }
        for t in [RISE.1, 14., MERGE.0] {
            let (feet, height) = watcher(t);
            assert!(feet[2] < HER[2] - 0.8 && feet[0] > HER[0] + 1. && height > 1.2 * HEIGHT, "behind her, nearer us, to the right: {t}");
            // Beside her, not over her: its head clears hers on screen.
            let cam = camera(t);
            let head = |feet: W, height: f64| heroine_world(feet, height, 1.).then(cam.plane(feet[2])).apply((468., 115.)).0;
            assert!(head(feet, height) - head(HER, HEIGHT) > 14., "{t}");
        }
        assert!(RISE.1 <= GAZE.0 && GAZE.1 <= QUIET.0);
    }
    #[test]
    fn the_tone_leaves_her_jugular_notch_and_reaches_the_distance() {
        let off = |a: W, b: W| sub(a, b).iter().map(|v| v.abs()).fold(0., f64::max);
        assert!(off(voice_at(0.), notch()) < 1e-9 && off(voice_at(voice_length()), DISTANCE) < 1e-9);
        assert_eq!(spoken(SPEAK - 0.1), (0., 0.));
        let (tail, head) = spoken(TRAVEL.1);
        assert!((head - voice_length()).abs() < 1e-9 && (head - tail - PACKET).abs() < 1e-9);
        // Pure where the gaze rests before it leaves, all of it pure as it goes.
        assert!(clarity(12.2, GAZE_AT) > 0.99 && clarity(TRAVEL.0, NEAR_VOICE) > 0.99 && clarity(10., 0.) < 0.01);
    }
    #[test]
    fn the_observers_attention_opens_in_spheres_while_it_looks() {
        assert!((0..SPHERES).all(|k| sphere(GAZE.0 - 0.1, k).is_none() && sphere(MERGE.0 + SPHERE_LIFE + 0.1, k).is_none()));
        for t in [GAZE.1 + 2., 14., 18.] {
            let open: Vec<f64> = (0..SPHERES).filter_map(|k| sphere(t, k)).collect();
            assert_eq!(open.len(), SPHERES, "{t}");
            assert!(open.iter().all(|f| (0. ..1.).contains(f)));
        }
    }
    #[test]
    fn every_call_lands_in_her_jugular_notch() {
        let heart = [-0.8, 1.2, HER[2]];
        let (c, rx, ry) = call_front(1., heart);
        assert!(sub(c, heart).iter().all(|v| v.abs() < 1e-9) && rx < 0.06 && ry < 0.06);
        let (c, rx, _) = call_front(0., heart);
        assert!(c[2] == DISTANCE[2] && rx > 1.8);
        assert!(CALLS[0] > TRAVEL.1 && CALLS[3] + RETURN < MERGE.1);
    }
    #[test]
    fn thoughts_circle_behind_and_before_her() {
        for i in 0..FRAGMENTS.len() {
            let sides: Vec<f64> = (0..180).map(|k| fragment(i, k as f64 * 0.05).2).collect();
            assert!(sides.iter().any(|&s| s > 0.99) && sides.iter().any(|&s| s < 0.01), "{}", FRAGMENTS[i]);
            assert!(fragment(i, 14.5).1 < 0.01, "{} falls away", FRAGMENTS[i]);
        }
        assert!(whirl(QUIET.1 + 1.) - whirl(QUIET.1) < 0.2);
    }
    #[test]
    fn the_loop_fades_through_darkness() {
        let master = |s: f64| {
            frame(s, false)
                .into_iter()
                .find(|u| u.selector == ".zv-0" && u.attribute == "opacity")
                .unwrap()
                .value
                .parse::<f64>()
                .unwrap()
        };
        assert!(master(PERIOD - 0.02) < 0.05 && master(0.) < 0.05);
        assert!(master(REST) > 0.99);
    }
}
