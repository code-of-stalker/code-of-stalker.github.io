//! «Сила Зова»: Step 4, the second block's page 04/08.
//! «Колокол»: no person and no room this time. A huge bell hangs in a dark
//! tower, bound to the walls by hundreds of hair-thin taut threads; the lens
//! stays low, under the bell, and circles it once a loop. Then the page, in
//! order:
//! «Так работает персонажная программа: она управляет бескомпромиссно,
//! жёстко, но незаметно» — the threads hold the bell dead still. They are
//! only seen while a glint slides along one of them; at «но незаметно»
//! almost nothing glints any more.
//! «И пока не возникнет тотальное Разочарование» — every thread shows at
//! once, taut, and snaps. The halves whip back and fall into the dark; the
//! bell, let go, sways and freezes in silence.
//! «…не возникнет чистый Запрос» — dust shaken off the bell settles through
//! the window's light; one tremor runs once round the rim.
//! «…не проявится Намерение» — the lens goes under the mouth: the clapper
//! starts to swing.
//! «…и не раскроет Себя Сила Зова» — the first strike, and its answer:
//! the sound leaves the bell as rings of light, and the light floods the
//! tower from the floor up.
//! «А значит — Пробуждение не начнётся» — the echo fades into the dark and
//! the threads grow back, one by one, from the walls to the bell: the loop
//! closes where it began.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time: the bell, the clapper, the light and every thread, ring and mote of
//! dust. The browser adapter only uploads the values and the shaders only
//! paint them.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod generated;

use generated::{LABEL_BAND, LABEL_INK};
use std::f32::consts::{PI, TAU};
use watcher_scene_palette::Palette;

/// Authored frame, 3 : 2 like the other Step 4 scenes.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// The three paragraphs: a seamless loop.
pub const LOOP_SECONDS: f32 = 64.0;
/// Reduced motion holds this moment: the second strike, the rings under way
/// and the tower lit, «СИЛА ЗОВА.» written.
pub const STILL: f32 = 47.9;

/// The tower: an octagon of stone, its faces this far from the axis (m).
pub const APOTHEM: f32 = 3.4;
/// Its floor and the dark it rises into.
pub const CEILING: f32 = 9.4;
/// The bell hangs from the yoke beam here; everything of the bell below is
/// measured from this pivot, which its sway turns about the x axis.
pub const PIVOT: [f32; 3] = [0.0, 4.25, 0.0];
/// The lip under the pivot and the lip-to-shoulder height.
pub const LIP: f32 = -1.9;
pub const BELL_H: f32 = 1.45;
/// The clapper: its pivot under the bell's, its rod and its ball.
pub const CLAPPER_PIVOT: f32 = -0.5;
pub const CLAPPER_ROD: f32 = 1.32;
pub const BALL: f32 = 0.12;
/// The window high in the tower and where its light reaches the floor.
pub const WINDOW: [f32; 3] = [-2.404, 7.0, 2.404];
pub const SHAFT_TO: [f32; 3] = [1.8, 0.0, 1.6];
/// The light's shaft is this wide (m, gaussian radius).
pub const SHAFT_WIDTH: f32 = 0.3;

/// The captions, in the order of the page.
pub const CARDS: [[f32; 2]; 7] = [
    [1.0, 11.2],
    [11.8, 21.2],
    [21.8, 29.6],
    [30.2, 36.4],
    [37.0, 43.4],
    [44.0, 51.8],
    [52.4, 61.4],
];
/// «НО НЕЗАМЕТНО.» joins its caption; the glints die away.
pub const UNSEEN: f32 = 16.6;
/// «Тотальное Разочарование»: every thread snaps (each within SNAP_SPREAD).
pub const SNAP: f32 = 23.8;
pub const SNAP_SPREAD: f32 = 0.14;
/// A snapped half falls and is gone after this long.
pub const FALL: f32 = 3.2;
/// «Чистый Запрос»: one tremor runs round the rim.
pub const TREMOR: [f32; 2] = [32.0, 34.6];
/// «Намерение»: the clapper starts; its swing's period.
pub const SWING: f32 = 37.6;
pub const PERIOD: f32 = 2.4;
/// «Сила Зова»: the strike and its answer, on the other side.
pub const STRIKES: [f32; 2] = [46.2, 47.4];
/// «СИЛА ЗОВА.» starts to be written just before the first strike.
pub const CALL_WORD: f32 = 45.8;
/// The flood of light climbs the tower in this long.
pub const CLIMB: f32 = 3.4;
/// Every strike sends out this many rings, this far apart (s).
pub const RINGS: usize = 3;
pub const RING_GAP: f32 = 0.22;
pub const RING_LIFE: f32 = 1.8;
/// «Пробуждение не начнётся»: the threads grow back, each in GROW.
pub const REGROW: [f32; 2] = [54.0, 59.0];
pub const GROW: f32 = 1.6;
/// The web.
pub const THREADS: usize = 180;
/// Dust: shaken off the bell at the snap, and always in the window's light.
pub const SHAKEN: usize = 220;
pub const DRIFTING: usize = 90;
pub const DUST_LIFE: f32 = 13.0;

pub fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
/// Quintic ease: still at both ends, for the lens.
fn ease(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
}
pub fn bell(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}
fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}
pub fn lerp3(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    [
        lerp(a[0], b[0], t),
        lerp(a[1], b[1], t),
        lerp(a[2], b[2], t),
    ]
}
fn add(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
fn sub(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn scale(a: [f32; 3], k: f32) -> [f32; 3] {
    a.map(|v| v * k)
}
fn dot(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
fn length(a: [f32; 3]) -> f32 {
    dot(a, a).sqrt()
}
fn normalize(a: [f32; 3]) -> [f32; 3] {
    scale(a, 1.0 / length(a).max(1e-6))
}
/// A stable random number in 0..1 for (thing, what).
pub fn hash(i: u32, k: u32) -> f32 {
    let mut x = i.wrapping_mul(0x9E37_79B1) ^ k.wrapping_mul(0x85EB_CA77) ^ 0x2545_F491;
    x ^= x >> 15;
    x = x.wrapping_mul(0x2C1B_3C6D);
    x ^= x >> 12;
    x = x.wrapping_mul(0x297A_2D39);
    x ^= x >> 15;
    (x >> 8) as f32 / 16_777_216.0
}

/// The bell's outer radius at `h` (0 at the lip, 1 at the shoulder): the
/// sound bow flares out, the waist narrows. Mirrored in shaders/scene.frag.
pub fn radius(h: f32) -> f32 {
    let k = 1.0 - h.clamp(0.0, 1.0);
    0.56 + 0.1 * k + 0.3 * k * k * k + 0.06 * k.powi(12)
}
/// The metal's thickness: heavy at the sound bow.
pub fn thick(h: f32) -> f32 {
    0.045 + 0.07 * (1.0 - smooth(0.03, 0.25, h))
}
/// Turn about the x axis (the yoke's): the bell's sway and the clapper's.
pub fn rot_x(p: [f32; 3], angle: f32) -> [f32; 3] {
    let (s, c) = angle.sin_cos();
    [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]
}
/// A point given in the bell's frame, in the tower.
pub fn on_bell(local: [f32; 3], sway: f32) -> [f32; 3] {
    add(PIVOT, rot_x(local, sway))
}
/// The clapper's ball in the bell's frame.
pub fn ball(angle: f32) -> [f32; 3] {
    add(
        [0.0, CLAPPER_PIVOT, 0.0],
        rot_x([0.0, -CLAPPER_ROD, 0.0], angle),
    )
}
/// The clapper's swing where its ball meets the sound bow from inside.
pub fn contact() -> f32 {
    let gap = |a: f32| {
        let p = ball(a);
        let h = (p[1] - LIP) / BELL_H;
        radius(h) - thick(h) - (p[2].abs() + BALL)
    };
    let (mut lo, mut hi) = (0.0_f32, 1.2_f32);
    for _ in 0..40 {
        let mid = 0.5 * (lo + hi);
        if gap(mid) > 0.0 {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    lo
}

/// The lens: where it is, what it looks at, how long it is (the screen's
/// half height is 0.5 at `zoom` = 1 unit away), where it is sharp and how
/// quickly it blurs (authored px of blur circle per unit of defocus).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Camera {
    pub eye: [f32; 3],
    pub target: [f32; 3],
    pub zoom: f32,
    pub focus: f32,
    pub aperture: f32,
}
impl Camera {
    pub fn basis(&self) -> [[f32; 3]; 3] {
        let fw = normalize(sub(self.target, self.eye));
        let rt = normalize(cross(fw, [0.0, 1.0, 0.0]));
        let up = cross(rt, fw);
        [fw, rt, up]
    }
    /// Distance along the view.
    pub fn depth(&self, p: [f32; 3]) -> f32 {
        dot(sub(p, self.eye), self.basis()[0])
    }
    /// A point on the authored 1536 × 1024 frame, as the shader sees it.
    pub fn project(&self, p: [f32; 3]) -> Option<[f32; 2]> {
        let v = View::new(self).local(p);
        (v[2] >= 0.01).then(|| View::new(self).screen(v))
    }
    /// The blur circle's radius (authored px) of a point at this depth.
    pub fn coc(&self, depth: f32) -> f32 {
        (self.aperture * (depth - self.focus) / depth.max(0.01))
            .abs()
            .min(22.0)
    }
}

/// One held shot, around the bell's axis: the lens's distance from the axis
/// and height, the height it looks at, its length, the point it keeps sharp
/// (distance from the axis on the lens's side, height) and its aperture.
#[derive(Clone, Copy, Debug)]
struct Shot {
    r: f32,
    y: f32,
    look: f32,
    zoom: f32,
    sharp: [f32; 2],
    aperture: f32,
}
/// «Так работает персонажная программа»: low, the whole web.
const WEB: Shot = Shot {
    r: 2.75,
    y: 0.75,
    look: 3.05,
    zoom: 0.98,
    sharp: [0.75, 3.0],
    aperture: 5.0,
};
/// «…управляет бескомпромиссно, жёстко»: up close where the threads bite.
const GRIP: Shot = Shot {
    r: 2.0,
    y: 1.9,
    look: 2.6,
    zoom: 1.3,
    sharp: [0.7, 3.1],
    aperture: 5.0,
};
/// «Тотальное Разочарование»: wide and low for the snap.
const LOOSE: Shot = Shot {
    r: 2.9,
    y: 0.55,
    look: 3.2,
    zoom: 0.92,
    sharp: [0.9, 2.8],
    aperture: 4.0,
};
/// «Чистый Запрос»: the rim and the dust.
const RIM: Shot = Shot {
    r: 2.3,
    y: 1.2,
    look: 2.7,
    zoom: 1.2,
    sharp: [1.0, 2.4],
    aperture: 7.0,
};
/// «Намерение»: under the mouth, looking up at the clapper.
const MOUTH: Shot = Shot {
    r: 0.85,
    y: 0.55,
    look: 3.5,
    zoom: 1.05,
    sharp: [0.0, 2.7],
    aperture: 6.0,
};
/// «Сила Зова»: pulled back, the whole tower for the light.
const CALL: Shot = Shot {
    r: 3.0,
    y: 0.4,
    look: 3.5,
    zoom: 0.85,
    sharp: [0.9, 2.6],
    aperture: 3.0,
};
/// «Пробуждение не начнётся»: back towards where it began.
const ECHO: Shot = Shot {
    r: 2.6,
    y: 0.9,
    look: 3.1,
    zoom: 1.0,
    sharp: [0.75, 3.0],
    aperture: 5.0,
};
/// Held shots: (arrive, leave, shot); the lens eases from one to the next.
const SHOTS: [(f32, f32, Shot); 7] = [
    (0.0, 10.6, WEB),
    (12.6, 20.6, GRIP),
    (22.6, 28.6, LOOSE),
    (30.4, 35.4, RIM),
    (37.6, 43.2, MOUTH),
    (45.6, 50.6, CALL),
    (53.0, 61.0, ECHO),
];
/// Where on its circle the lens starts; it goes round once a loop.
const ORBIT: f32 = 0.35;

/// Where a keyframed value stands at `t`: held inside a key, eased between
/// keys, the last easing into the first across the loop's seam.
fn keyed<T: Copy, const N: usize>(
    keys: &[(f32, f32, T); N],
    t: f32,
    blend: impl Fn(T, T, f32) -> T,
) -> T {
    for i in 0..N {
        let (arrive, leave, value) = keys[i];
        if t >= arrive && t <= leave {
            return value;
        }
        let (next_arrive, _, next) = keys[(i + 1) % N];
        let next_arrive = if i + 1 == N {
            next_arrive + LOOP_SECONDS
        } else {
            next_arrive
        };
        if t > leave && t < next_arrive {
            return blend(value, next, ease((t - leave) / (next_arrive - leave)));
        }
    }
    keys[0].2
}

pub fn camera(t: f32) -> Camera {
    let s = keyed(&SHOTS, t, |a, b, k| Shot {
        r: lerp(a.r, b.r, k),
        y: lerp(a.y, b.y, k),
        look: lerp(a.look, b.look, k),
        zoom: lerp(a.zoom, b.zoom, k),
        sharp: [
            lerp(a.sharp[0], b.sharp[0], k),
            lerp(a.sharp[1], b.sharp[1], k),
        ],
        aperture: lerp(a.aperture, b.aperture, k),
    });
    let w = TAU * t / LOOP_SECONDS;
    let (sin, cos) = (ORBIT + w).sin_cos();
    // A hand-held breath, periodic with the loop.
    let eye = [
        s.r * cos + 0.01 * (3.0 * w).sin(),
        s.y + 0.008 * (5.0 * w + 1.0).sin(),
        s.r * sin + 0.01 * (2.0 * w + 2.0).sin(),
    ];
    let mut c = Camera {
        eye,
        target: [0.0, s.look, 0.0],
        zoom: s.zoom,
        focus: 1.0,
        aperture: s.aperture,
    };
    c.focus = c
        .depth([s.sharp[0] * cos, s.sharp[1], s.sharp[0] * sin])
        .max(0.05);
    c
}

/// The bell let go: it sways and freezes.
pub fn sway(t: f32) -> f32 {
    if t < SNAP {
        return 0.0;
    }
    let u = t - SNAP;
    0.065 * (-u / 1.4).exp() * (TAU * u / 2.3).sin() * (1.0 - smooth(28.4, 29.6, t))
}
/// The clapper: still until the Intention, then a swing that grows until it
/// meets the bell, twice, and dies away before the seam.
pub fn clapper(t: f32) -> f32 {
    if t < SWING {
        return 0.0;
    }
    let hit = contact();
    let over = 1.06 * hit;
    let amp = if t < STRIKES[0] {
        over * smooth(SWING, STRIKES[0], t).powi(2)
    } else if t < STRIKES[1] {
        over
    } else {
        over * (-(t - STRIKES[1]) / 2.5).exp() * (1.0 - smooth(53.0, 58.0, t))
    };
    let phase = TAU * (t - STRIKES[0]) / PERIOD + PI / 2.0;
    (amp * phase.sin()).clamp(-hit, hit)
}
/// The latest strike: how long ago, on which side (z) of the bell.
pub fn strike(t: f32) -> Option<(f32, f32)> {
    STRIKES
        .iter()
        .enumerate()
        .rev()
        .find(|(_, s)| t >= **s)
        .map(|(i, s)| (t - s, if i == 0 { -1.0 } else { 1.0 }))
}

/// One thread of the web: where it bites the bell (height 0..1, azimuth),
/// where it is tied to the tower, and its own timing.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Thread {
    pub id: u32,
    pub h: f32,
    pub azimuth: f32,
    pub wall: [f32; 3],
    pub snap: f32,
    /// Where along it (0 at the wall, 1 at the bell) it breaks.
    pub cut: f32,
    /// How many glints run along it per loop.
    pub cycles: f32,
    pub phase: f32,
    pub regrow: f32,
}
/// Where a ray from inside leaves the tower (floor, faces or the dark above).
fn tower_exit(o: [f32; 3], d: [f32; 3]) -> [f32; 3] {
    let mut far = f32::MAX;
    for k in 0..8 {
        let (s, c) = (k as f32 * PI / 4.0).sin_cos();
        let n = [c, 0.0, s];
        let dn = dot(d, n);
        if dn > 1e-4 {
            far = far.min((APOTHEM - dot(o, n)) / dn);
        }
    }
    if d[1] < -1e-4 {
        far = far.min((0.0 - o[1]) / d[1]);
    }
    if d[1] > 1e-4 {
        far = far.min((CEILING - o[1]) / d[1]);
    }
    add(o, scale(d, far))
}
pub fn thread(i: usize) -> Thread {
    let id = i as u32;
    let r = |k| hash(id, k);
    // Bites spread round the bell, more on the waist and the shoulder.
    let h = 0.1 + 0.85 * r(1).powf(0.7);
    let azimuth = (i as f32 + 0.5 * r(2)) / THREADS as f32 * TAU * 7.0;
    let anchor = on_bell(bite(h, azimuth), 0.0);
    let heading = azimuth + (r(3) - 0.5) * 1.3;
    let rise = -0.7 + 1.6 * r(4);
    let d = [
        heading.cos() * rise.cos(),
        rise.sin(),
        heading.sin() * rise.cos(),
    ];
    Thread {
        id,
        h,
        azimuth,
        wall: tower_exit(anchor, d),
        snap: SNAP + SNAP_SPREAD * r(5),
        cut: 0.35 + 0.3 * r(6),
        cycles: 4.0 + (r(7) * 7.0).floor(),
        phase: r(8),
        regrow: REGROW[0] + (REGROW[1] - REGROW[0]) * r(9),
    }
}
/// The point of the bell's outer face a thread bites, in the bell's frame.
pub fn bite(h: f32, azimuth: f32) -> [f32; 3] {
    let r = radius(h);
    [r * azimuth.cos(), LIP + h * BELL_H, r * azimuth.sin()]
}

/// How many glints run (1) or how few (0.2, «но незаметно»).
fn activity(t: f32) -> f32 {
    1.0 - 0.8 * bell(t, UNSEEN, UNSEEN + 1.2, SNAP - 1.6, SNAP - 0.6)
}
/// A taut thread's own faint line, and every thread at once just before
/// the snap.
fn tension(t: f32) -> f32 {
    0.06 * (1.0 - bell(t, UNSEEN, UNSEEN + 1.2, SNAP - 1.6, SNAP - 0.6))
        + 0.75 * bell(t, SNAP - 0.5, SNAP - 0.02, 40.0, 41.0)
}

/// What a thread is doing now.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Strand {
    /// Tied at both ends; a glint at `glint` (0 wall … 1 bell) this strong.
    Taut {
        glint: f32,
        strength: f32,
    },
    /// Snapped this long ago.
    Fallen(f32),
    Gone,
    /// Growing back from the wall: this much of it.
    Growing(f32),
}
pub fn strand(th: &Thread, t: f32) -> Strand {
    let done = th.regrow + GROW;
    if t >= th.snap && t < th.snap + FALL {
        return Strand::Fallen(t - th.snap);
    }
    if t >= th.snap + FALL && t < th.regrow {
        return Strand::Gone;
    }
    if t >= th.regrow && t < done {
        return Strand::Growing(ease((t - th.regrow) / GROW));
    }
    let period = LOOP_SECONDS / th.cycles;
    let u = t / period + th.phase;
    let cycle = (u.floor() as i32).rem_euclid(th.cycles as i32) as u32;
    let on = hash(th.id, 100 + cycle) < 0.4;
    let fresh = if t >= done {
        smooth(done, done + 1.0, t)
    } else {
        1.0
    };
    Strand::Taut {
        glint: u.fract() * 1.8 - 0.4,
        strength: if on { activity(t) * fresh } else { 0.0 },
    }
}
/// A snapped half: tied at `anchor`, broken at `cut`. It whips back, then
/// hangs and falls, sagging.
pub fn fallen(anchor: [f32; 3], cut: [f32; 3], age: f32) -> [[f32; 3]; 7] {
    let reach = length(sub(cut, anchor));
    let recoil = 0.5 * (1.0 - (-age / 0.05).exp());
    let whipped = lerp3(cut, anchor, recoil);
    let hang = reach * 0.5;
    let rest = add(anchor, [0.0, -hang, 0.0]);
    let drop = smooth(0.05, 1.2, age);
    let mut end = lerp3(whipped, rest, drop);
    end[1] = end[1].max(0.02);
    let sag = 0.3 * hang * (PI * drop).sin();
    let mid = add(lerp3(anchor, end, 0.5), [0.0, -sag, 0.0]);
    let wave = 0.06 * reach * (-age / 0.4).exp();
    let side = normalize(cross(sub(end, anchor), [0.0, 1.0, 0.0]));
    std::array::from_fn(|i| {
        let u = i as f32 / 6.0;
        let mut p = add(
            add(
                scale(anchor, (1.0 - u) * (1.0 - u)),
                scale(mid, 2.0 * u * (1.0 - u)),
            ),
            scale(end, u * u),
        );
        p = add(
            p,
            scale(side, wave * (PI * u).sin() * (age * 40.0 + 6.0 * u).sin()),
        );
        p[1] = p[1].max(0.02);
        p
    })
}
/// How a snapped half glows: the flash of the snap, then out.
pub fn afterglow(age: f32) -> f32 {
    (0.8 * (-age / 0.35).exp() + 0.08) * (1.0 - smooth(0.8, FALL, age))
}

/// The rings of sound out now: (radius, height, light).
pub fn rings(t: f32) -> Vec<[f32; 3]> {
    let lip = PIVOT[1] + LIP;
    let mut out = Vec::new();
    for (n, s) in STRIKES.iter().enumerate() {
        for j in 0..RINGS {
            let age = t - s - RING_GAP * j as f32;
            if !(0.0..RING_LIFE).contains(&age) {
                continue;
            }
            let reach = (1.0 - (-age / 0.5).exp()) / (1.0 - (-RING_LIFE / 0.5).exp());
            let radius = 1.08 + (APOTHEM - 0.12 - 1.08) * reach;
            let light = smooth(0.0, 0.06, age)
                * (1.0 - smooth(0.9, RING_LIFE, age))
                * (1.0 - 0.28 * j as f32)
                * if n == 0 { 1.0 } else { 0.8 };
            out.push([radius, lip + [0.0, -0.2, 0.22][j], light]);
        }
    }
    out
}
/// Light pages: a quiet light from the bell's mouth that keeps the stone
/// and bronze as clearly drawn as the flood draws them (the dark of a dark
/// page would be just the page here). The flood takes over from it.
pub fn glow(flood: f32) -> f32 {
    let lit = (flood / 0.85).clamp(0.0, 1.0);
    0.45 * (1.0 - lit * lit * (3.0 - 2.0 * lit))
}
/// The light that floods the tower: the height it has climbed to, its
/// strength.
pub fn flood(t: f32) -> [f32; 2] {
    if t < STRIKES[0] {
        return [0.0, 0.0];
    }
    let front = (CEILING + 0.6) * ease((t - STRIKES[0]) / CLIMB);
    let answer = if t > STRIKES[1] {
        0.25 * (-(t - STRIKES[1]) / 0.6).exp()
    } else {
        0.0
    };
    [
        front,
        (0.85 + answer) * bell(t, STRIKES[0], STRIKES[0] + 0.35, 50.8, 57.0),
    ]
}
/// The window's light: steady, a little stronger while the dust settles.
pub fn shaft(t: f32) -> f32 {
    1.0 + 0.35 * bell(t, 29.8, 31.0, 35.6, 37.0)
}
/// How much of the window's light reaches a point.
pub fn shaft_light(p: [f32; 3]) -> f32 {
    let axis = sub(SHAFT_TO, WINDOW);
    let u = (dot(sub(p, WINDOW), axis) / dot(axis, axis)).clamp(0.0, 1.0);
    let d = length(sub(p, add(WINDOW, scale(axis, u))));
    (-(d * d) / (SHAFT_WIDTH * SHAFT_WIDTH)).exp()
}

/// One caption line: its row in the atlas, whether it is the bright one,
/// its light and how much of it is written (0..1 from the left).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Line {
    pub row: usize,
    pub key: bool,
    pub alpha: f32,
    pub wipe: f32,
}
pub const LEAD_CAP: f32 = 19.0;
pub const KEY_CAP: f32 = 28.0;
/// The bottom of the last line of every caption (authored px).
pub const WORDS_BOTTOM: f32 = 930.0;
/// The quiet rows; the others are bright.
const LEADS: [usize; 7] = [0, 2, 5, 7, 9, 11, 13];
/// The lines of the caption at `t`, top to bottom.
pub fn words(t: f32) -> Vec<Line> {
    let Some(card) = CARDS.iter().position(|[a, b]| t >= *a && t < *b) else {
        return Vec::new();
    };
    let [a, b] = CARDS[card];
    let line = |row, key, from: f32| Line {
        row,
        key,
        alpha: bell(t, from, from + 0.5, b - 0.6, b),
        wipe: smooth(from, from + 0.7, t),
    };
    let lead = LEADS[card];
    let mut lines = vec![line(lead, false, a)];
    match card {
        1 => {
            lines.push(line(3, true, a + 0.6));
            lines.push(line(4, true, UNSEEN));
        }
        5 => lines.push(line(12, true, CALL_WORD)),
        _ => lines.push(line(lead + 1, true, a + 0.6)),
    }
    lines.retain(|l| l.alpha > 0.0);
    lines
}
/// Where a caption line sits: left edge, cap top, cap height (authored px).
/// Lines are centred; their slots stay put while lines come and go.
pub fn line_place(row: usize) -> [f32; 3] {
    let key = !LEADS.contains(&row);
    // Slot from the bottom: the last line of each caption sits lowest.
    let below = match row {
        2 => 2.0 * KEY_CAP + 30.0,
        3 => KEY_CAP + 14.0,
        _ if !key => KEY_CAP + 16.0,
        _ => 0.0,
    };
    let cap = if key { KEY_CAP } else { LEAD_CAP };
    let top = WORDS_BOTTOM - below - cap;
    let width = (LABEL_INK[row][1] - LABEL_INK[row][0]) * cap / 44.0;
    [SIZE[0] * 0.5 - width * 0.5, top, cap]
}
/// The atlas band of a row stands this far above the capitals' top
/// (atlas px; capitals start 42 px into a row).
pub fn band_above() -> f32 {
    42.0 - LABEL_BAND[0]
}

/// Everything the browser needs for one frame.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// The bell's sway and the clapper's swing (radians about x).
    pub sway: f32,
    pub clapper: f32,
    /// The tremor round the rim: its azimuth and strength.
    pub tremor: [f32; 2],
    /// The latest strike: how long ago (s), its side (z), its flash.
    pub strike: [f32; 3],
    /// The flood's front height and strength, the window's light.
    pub flood: [f32; 2],
    pub shaft: f32,
    /// How much of the words' strip is shown.
    pub shown: f32,
}
pub fn compose(t: f32) -> Frame {
    let t = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let strike = strike(t).map_or([99.0, 0.0, 0.0], |(age, side)| {
        [
            age,
            side,
            (-age / 0.25).exp() * (1.0 - smooth(52.0, 56.0, t)),
        ]
    });
    let tremor = smooth(TREMOR[0], TREMOR[1], t);
    Frame {
        time: t,
        camera: camera(t),
        sway: sway(t),
        clapper: clapper(t),
        tremor: [
            -0.6 + TAU * 1.25 * tremor,
            bell(t, TREMOR[0], TREMOR[0] + 0.3, TREMOR[1] - 0.5, TREMOR[1]),
        ],
        strike,
        flood: flood(t),
        shaft: shaft(t),
        shown: words(t).iter().fold(0.0_f32, |m, l| m.max(l.alpha)),
    }
}

/// Floats per overlay vertex: authored px (x, y), view depth, across the
/// line (-1..1), along it, the glint's place and strength, its own light,
/// its kind (0 thread, 1 ring, 2 mote).
pub const OVERLAY_STRIDE: usize = 9;
/// Half widths in view pixels.
const THREAD_HALF: f32 = 1.6;
const RING_HALF: f32 = 3.4;
const MOTE_HALF: f32 = 1.4;
/// Lines nearer the lens than this are cut.
const NEAR: f32 = 0.08;

/// The lens's frame once per frame, for many points.
struct View {
    eye: [f32; 3],
    fw: [f32; 3],
    rt: [f32; 3],
    up: [f32; 3],
    zoom: f32,
}
impl View {
    fn new(c: &Camera) -> Self {
        let [fw, rt, up] = c.basis();
        Self {
            eye: c.eye,
            fw,
            rt,
            up,
            zoom: c.zoom,
        }
    }
    /// Right, up, depth.
    fn local(&self, p: [f32; 3]) -> [f32; 3] {
        let v = sub(p, self.eye);
        [dot(v, self.rt), dot(v, self.up), dot(v, self.fw)]
    }
    fn screen(&self, v: [f32; 3]) -> [f32; 2] {
        let k = self.zoom / v[2];
        [
            SIZE[0] * 0.5 + v[0] * k * SIZE[1],
            SIZE[1] * 0.5 - v[1] * k * SIZE[1],
        ]
    }
}
/// What a line carries besides its place: glint, strength, light, kind.
#[derive(Clone, Copy)]
struct Paint {
    glint: f32,
    strength: f32,
    light: f32,
    kind: f32,
}
#[allow(clippy::too_many_arguments)]
fn segment(
    out: &mut Vec<f32>,
    view: &View,
    a: [f32; 3],
    b: [f32; 3],
    sa: f32,
    sb: f32,
    half: f32,
    paint: Paint,
) {
    let (mut va, mut vb) = (view.local(a), view.local(b));
    let (mut sa, mut sb) = (sa, sb);
    if va[2] < NEAR && vb[2] < NEAR {
        return;
    }
    if va[2] < NEAR {
        let u = (NEAR - va[2]) / (vb[2] - va[2]);
        va = lerp3(va, vb, u);
        sa = lerp(sa, sb, u);
    } else if vb[2] < NEAR {
        let u = (NEAR - vb[2]) / (va[2] - vb[2]);
        vb = lerp3(vb, va, u);
        sb = lerp(sb, sa, u);
    }
    let (pa, pb) = (view.screen(va), view.screen(vb));
    let d = [pb[0] - pa[0], pb[1] - pa[1]];
    let len = (d[0] * d[0] + d[1] * d[1]).sqrt();
    if len < 1e-3 {
        return;
    }
    let n = [-d[1] / len * half, d[0] / len * half];
    let corner = |p: [f32; 2], z: f32, side: f32, s: f32| {
        [
            p[0] + n[0] * side,
            p[1] + n[1] * side,
            z,
            side,
            s,
            paint.glint,
            paint.strength,
            paint.light,
            paint.kind,
        ]
    };
    let q = [
        corner(pa, va[2], -1.0, sa),
        corner(pa, va[2], 1.0, sa),
        corner(pb, vb[2], 1.0, sb),
        corner(pb, vb[2], -1.0, sb),
    ];
    for i in [0, 1, 2, 0, 2, 3] {
        out.extend_from_slice(&q[i]);
    }
}
fn mote(out: &mut Vec<f32>, view: &View, p: [f32; 3], px: f32, light: f32) {
    let v = view.local(p);
    if v[2] < NEAR || light < 0.003 {
        return;
    }
    let c = view.screen(v);
    let half = (0.008 * view.zoom * SIZE[1] / v[2]).max(MOTE_HALF * px);
    // a mote smaller than its quad gives up its light, not its size
    let light = light * (0.008 * view.zoom * SIZE[1] / v[2] / half).clamp(0.35, 1.0);
    let corner = |x: f32, y: f32| {
        [
            c[0] + x * half,
            c[1] + y * half,
            v[2],
            x,
            y,
            0.0,
            0.0,
            light,
            2.0,
        ]
    };
    let q = [
        corner(-1.0, -1.0),
        corner(1.0, -1.0),
        corner(1.0, 1.0),
        corner(-1.0, 1.0),
    ];
    for i in [0, 1, 2, 0, 2, 3] {
        out.extend_from_slice(&q[i]);
    }
}

/// Every thread, ring and mote of dust at this frame, as triangles of the
/// overlay pass. `px` is how many authored px one pixel of the view covers.
pub fn overlay(f: &Frame, px: f32, out: &mut Vec<f32>) {
    out.clear();
    let view = View::new(&f.camera);
    let t = f.time;
    let thread_half = THREAD_HALF * px;
    for i in 0..THREADS {
        let th = thread(i);
        let anchor = on_bell(bite(th.h, th.azimuth), f.sway);
        let paint = |glint, strength, light| Paint {
            glint,
            strength,
            light,
            kind: 0.0,
        };
        match strand(&th, t) {
            Strand::Taut { glint, strength } => {
                let p = paint(glint, strength, tension(t));
                for k in 0..6 {
                    let (u0, u1) = (k as f32 / 6.0, (k + 1) as f32 / 6.0);
                    let a = lerp3(th.wall, anchor, u0);
                    let b = lerp3(th.wall, anchor, u1);
                    segment(out, &view, a, b, u0, u1, thread_half, p);
                }
            }
            Strand::Growing(grow) => {
                // the tip carries a glint as it reaches for the bell
                let tip = lerp3(th.wall, anchor, grow);
                let p = paint(grow, 1.0 - smooth(0.85, 1.0, grow), 0.06);
                for k in 0..4 {
                    let (u0, u1) = (k as f32 / 4.0, (k + 1) as f32 / 4.0);
                    let a = lerp3(th.wall, tip, u0);
                    let b = lerp3(th.wall, tip, u1);
                    segment(out, &view, a, b, u0 * grow, u1 * grow, thread_half, p);
                }
            }
            Strand::Fallen(age) => {
                let cut = lerp3(th.wall, on_bell(bite(th.h, th.azimuth), 0.0), th.cut);
                let p = paint(0.0, 0.0, afterglow(age));
                for half in [fallen(th.wall, cut, age), fallen(anchor, cut, age)] {
                    for k in 0..6 {
                        let (u0, u1) = (k as f32 / 6.0, (k + 1) as f32 / 6.0);
                        segment(out, &view, half[k], half[k + 1], u0, u1, thread_half, p);
                    }
                }
            }
            Strand::Gone => {}
        }
    }
    let ring_half = RING_HALF * px;
    for [r, y, light] in rings(t) {
        let n = 96;
        let p = Paint {
            glint: 0.0,
            strength: 0.0,
            light,
            kind: 1.0,
        };
        for k in 0..n {
            let (a0, a1) = (k as f32 / n as f32 * TAU, (k + 1) as f32 / n as f32 * TAU);
            let a = [r * a0.cos(), y, r * a0.sin()];
            let b = [r * a1.cos(), y, r * a1.sin()];
            segment(out, &view, a, b, 0.0, 0.0, ring_half, p);
        }
    }
    for i in 0..SHAKEN {
        let age = t - SNAP;
        if !(0.0..DUST_LIFE).contains(&age) {
            break;
        }
        let id = 1000 + i as u32;
        let r = |k| hash(id, k);
        let from = on_bell(bite(0.1 + 0.9 * r(1), r(2) * TAU), 0.0);
        let out_dir = normalize([from[0], 0.0, from[2]]);
        let fall = 0.06 + 0.14 * r(3);
        let swirl = r(4) * TAU;
        let mut p = add(
            from,
            add(
                scale(out_dir, 0.04 + 0.18 * r(5) * (1.0 - (-age / 0.8).exp())),
                [
                    0.05 * (0.7 * age + swirl).sin(),
                    -fall * age,
                    0.05 * (0.6 * age + swirl).cos(),
                ],
            ),
        );
        p[1] = p[1].max(0.03);
        let life = smooth(0.1, 0.8, age) * (1.0 - smooth(DUST_LIFE - 4.0, DUST_LIFE, age));
        let light = life * (0.3 + 1.6 * f.shaft * shaft_light(p) + 0.6 * f.flood[1]);
        mote(out, &view, p, px, light);
    }
    for i in 0..DRIFTING {
        let id = 5000 + i as u32;
        let r = |k| hash(id, k);
        let laps = 1.0 + (r(1) * 2.0).floor();
        let u = (r(2) + laps * t / LOOP_SECONDS).fract();
        let axis = sub(SHAFT_TO, WINDOW);
        let side = normalize(cross(axis, [0.0, 1.0, 0.0]));
        let lift = normalize(cross(side, axis));
        let (a, d) = (r(3) * TAU, SHAFT_WIDTH * 1.2 * r(4).sqrt());
        let p = add(
            add(WINDOW, scale(axis, 1.0 - u)),
            add(scale(side, d * a.cos()), scale(lift, d * a.sin())),
        );
        let light = 0.5 * f.shaft * shaft_light(p) * bell(u, 0.0, 0.15, 0.8, 1.0);
        mote(out, &view, p, px, light);
    }
}

/// Colors of one theme.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// The tower's dark (dark pages); the page itself on light pages, where
    /// the browser passes the page's own color instead.
    pub paper: [f32; 3],
    /// The light of the strike and the bronze's warmth (dark pages).
    pub key: [f32; 3],
    /// The window's cold light, the threads' sheen.
    pub fill: [f32; 3],
    /// Light pages: the light is inked in the lamp's color, and only its
    /// strongest deepens to `ink`; the dark stays the page.
    pub lamp: [f32; 3],
    pub ink: [f32; 3],
    /// The bright and the quiet caption lines.
    pub word: [f32; 3],
    pub lead: [f32; 3],
    pub light: bool,
}
const fn rgb(v: u32) -> [f32; 3] {
    [
        ((v >> 16) & 255) as f32 / 255.0,
        ((v >> 8) & 255) as f32 / 255.0,
        (v & 255) as f32 / 255.0,
    ]
}
/// The app theme by its `graphicsPalette` code. Light themes (Дюна, Мираж,
/// Рассвет) lay ink on a pale page; dark themes light a dark tower.
pub fn look(code: u32) -> Look {
    let palette = Palette::from_code(code);
    let dark = |paper: [f32; 3], accent: [f32; 3], highlight: [f32; 3]| Look {
        paper,
        key: lerp3(highlight, [1.0; 3], 0.1),
        fill: accent,
        lamp: [0.0; 3],
        ink: [0.0; 3],
        word: lerp3(highlight, [1.0; 3], 0.15),
        lead: lerp3(highlight, paper, 0.25),
        light: false,
    };
    match palette {
        // Дюна: a soft sepia print on sand, never an orange flood.
        Palette::Light => Look {
            paper: rgb(0xFAE18F),
            key: rgb(0xE8912E),
            fill: rgb(0xC9601E),
            lamp: rgb(0xE8912E),
            ink: rgb(0xBE4C00),
            word: rgb(0x8E3A00),
            lead: rgb(0xC9601E),
            light: true,
        },
        Palette::Original => dark(rgb(0x000000), rgb(0xF5DD07), rgb(0xF5DD07)),
        _ => match palette.colors() {
            Some(c) if palette.is_light() => Look {
                paper: c.paper,
                key: c.detail,
                fill: c.accent,
                // Мираж's lamp is its cobalt, Рассвет's its copper.
                lamp: if palette == Palette::Mirage {
                    c.accent
                } else {
                    c.detail
                },
                ink: c.highlight,
                word: c.highlight,
                lead: c.accent,
                light: true,
            },
            Some(c) => dark(c.paper, c.accent, c.highlight),
            None => dark(rgb(0x000000), rgb(0xF5DD07), rgb(0xF5DD07)),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }
    fn times(step: f32) -> impl Iterator<Item = f32> {
        (0..(LOOP_SECONDS / step) as usize).map(move |i| i as f32 * step)
    }
    fn inside(c: &Camera, p: [f32; 3], margin: f32) -> bool {
        c.project(p).is_some_and(|q| {
            q[0] > margin && q[0] < SIZE[0] - margin && q[1] > margin && q[1] < SIZE[1] - margin
        })
    }
    fn taut(th: &Thread, t: f32) -> bool {
        matches!(strand(th, t), Strand::Taut { .. })
    }

    #[test]
    fn the_loop_has_no_seam() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        let (x, y) = (compose(LOOP_SECONDS - 0.004), compose(0.004));
        for e in 0..3 {
            assert!(close(x.camera.eye[e], y.camera.eye[e], 0.003));
        }
        assert!(close(x.camera.focus, y.camera.focus, 0.02));
        // The bell bound and still at the seam, nothing ringing, no words.
        for f in [&x, &y] {
            assert!(f.sway == 0.0 && f.clapper == 0.0 && f.strike[2] < 0.001);
            assert!(f.flood[1] < 0.001 && f.tremor[1] == 0.0 && f.shown < 0.01);
            assert!(rings(f.time).is_empty());
        }
        for i in 0..THREADS {
            let th = thread(i);
            assert!(taut(&th, x.time) && taut(&th, y.time), "thread {i}");
            let (
                Strand::Taut {
                    glint: g0,
                    strength: k0,
                },
                Strand::Taut {
                    glint: g1,
                    strength: k1,
                },
            ) = (strand(&th, LOOP_SECONDS - 0.004), strand(&th, 0.004))
            else {
                unreachable!()
            };
            // a glint crossing the seam carries on where it was
            if k0 > 0.0 || k1 > 0.0 {
                assert!(close(g0, g1, 0.01) && close(k0, k1, 0.01), "thread {i}");
            }
        }
    }

    #[test]
    fn the_camera_never_jumps() {
        let mut previous = camera(0.0);
        for t in times(0.01).skip(1) {
            let c = camera(t);
            for e in 0..3 {
                assert!(close(c.eye[e], previous.eye[e], 0.02), "eye at {t}");
                assert!(
                    close(c.target[e], previous.target[e], 0.03),
                    "target at {t}"
                );
            }
            assert!(close(c.zoom, previous.zoom, 0.01));
            assert!(
                close(1.0 / c.focus, 1.0 / previous.focus, 0.025),
                "focus at {t}"
            );
            assert!(close(c.aperture, previous.aperture, 0.05));
            previous = c;
        }
    }

    #[test]
    fn the_lens_stays_inside_the_tower_and_under_the_bell() {
        for t in times(0.05) {
            let c = camera(t);
            let r = (c.eye[0] * c.eye[0] + c.eye[2] * c.eye[2]).sqrt();
            assert!(r < APOTHEM - 0.3 && c.eye[1] > 0.3, "{t}");
            assert!(c.eye[1] < PIVOT[1] + LIP - 0.4, "{t}");
        }
    }

    #[test]
    fn values_stay_finite_and_bounded() {
        let hit = contact();
        assert!(hit > 0.3 && hit < 0.8, "{hit}");
        for t in times(0.01) {
            let f = compose(t);
            assert!(f.sway.abs() < 0.08 && f.clapper.abs() <= hit + 1e-6);
            assert!((0.0..=1.0).contains(&f.tremor[1]) && (0.0..=1.0).contains(&f.strike[2]));
            assert!(f.flood[0] >= 0.0 && (0.0..=1.2).contains(&f.flood[1]));
            assert!(f.camera.focus > 0.0 && f.camera.eye.iter().all(|v| v.is_finite()));
            for l in words(t) {
                assert!((0.0..=1.0).contains(&l.alpha) && (0.0..=1.0).contains(&l.wipe));
            }
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
    }

    #[test]
    fn the_threads_hold_the_bell_to_the_tower() {
        for i in 0..THREADS {
            let th = thread(i);
            let w = th.wall;
            let r = (w[0] * w[0] + w[2] * w[2]).sqrt();
            // tied to a face, the floor or the dark above, never to the air
            let on_face = (0..8).any(|k| {
                let (s, c) = (k as f32 * PI / 4.0).sin_cos();
                close(w[0] * c + w[2] * s, APOTHEM, 1e-3)
            });
            assert!(on_face || w[1] < 1e-3 || close(w[1], CEILING, 1e-3), "{i}");
            assert!(r <= APOTHEM / (PI / 8.0).cos() + 1e-3);
            let b = on_bell(bite(th.h, th.azimuth), 0.0);
            assert!(length(sub(w, b)) > 0.8, "thread {i} too short");
        }
    }

    #[test]
    fn the_page_is_told_in_order() {
        let all =
            |t: f32, ok: &dyn Fn(Strand) -> bool| (0..THREADS).all(|i| ok(strand(&thread(i), t)));
        // «Так работает персонажная программа…»: bound, dead still, glints
        // running along the threads.
        for t in [2.0, 8.0, 14.0, 20.0] {
            let f = compose(t);
            assert!(f.sway == 0.0 && f.clapper == 0.0);
            assert!(all(t, &|s| matches!(s, Strand::Taut { .. })));
        }
        let glints = |t: f32| {
            (0..THREADS)
                .filter(|&i| {
                    matches!(strand(&thread(i), t), Strand::Taut { glint, strength } if strength > 0.5 && (0.0..1.0).contains(&glint))
                })
                .count()
        };
        assert!(glints(6.0) > 20, "{}", glints(6.0));
        // «…но незаметно»: almost nothing glints.
        assert!(glints(19.5) == 0 && tension(19.5) < 0.01);
        assert!(words(UNSEEN + 1.0)
            .iter()
            .any(|l| l.row == 4 && l.alpha > 0.99));
        // «Тотальное Разочарование»: written, then every thread snaps at once
        // and the bell is let go; it has frozen before the next words.
        let written = CARDS[2][0] + 0.6 + 0.7;
        assert!(written < SNAP && words(SNAP).iter().any(|l| l.row == 6 && l.alpha > 0.99));
        assert!(all(SNAP - 0.1, &|s| matches!(s, Strand::Taut { .. })));
        assert!(all(SNAP + SNAP_SPREAD + 0.01, &|s| matches!(
            s,
            Strand::Fallen(_)
        )));
        assert!(tension(SNAP - 0.05) > 0.6);
        assert!((SNAP..SNAP + 2.0).any_sway());
        assert!(sway(CARDS[3][0]) == 0.0);
        // «Чистый Запрос»: nothing left of the web; the tremor.
        assert!(all(CARDS[3][0], &|s| s == Strand::Gone));
        let f = compose((TREMOR[0] + TREMOR[1]) / 2.0);
        assert!(f.tremor[1] > 0.99 && (CARDS[3][0]..CARDS[3][1]).contains(&f.time));
        // «Намерение»: the clapper swings but does not yet strike.
        let hit = contact();
        let peak = (0..600)
            .map(|i| clapper(CARDS[4][0] + i as f32 * 0.01).abs())
            .fold(0.0, f32::max);
        assert!(peak > 0.15 && peak < hit - 0.02, "{peak}");
        // «Сила Зова»: written as the clapper meets the bell, twice; the rings
        // go out and the light climbs the tower.
        for s in STRIKES {
            assert!(close(clapper(s).abs(), hit, 1e-4), "strike at {s}");
            assert!(s > CALL_WORD + 0.3 && s < CARDS[5][1]);
        }
        let touching: Vec<f32> = times(0.01)
            .filter(|&t| clapper(t).abs() > hit - 1e-4)
            .collect();
        assert!(touching
            .iter()
            .all(|t| STRIKES.iter().any(|s| (t - s).abs() < 0.25)));
        assert!(!rings(STRIKES[0] + 0.5).is_empty());
        assert!(flood(STRIKES[0] + CLIMB)[0] > CEILING);
        // «Пробуждение не начнётся»: the echo out, the web grown back.
        assert!(rings(CARDS[6][0]).is_empty() && compose(58.0).flood[1] < 0.01);
        assert!(all(56.0, &|s| matches!(
            s,
            Strand::Growing(_) | Strand::Gone | Strand::Taut { .. }
        )));
        assert!(all(REGROW[1] + GROW + 0.01, &|s| matches!(
            s,
            Strand::Taut { .. }
        )));
        assert!(compose(58.0).clapper == 0.0);
    }

    trait AnySway {
        fn any_sway(self) -> bool;
    }
    impl AnySway for std::ops::Range<f32> {
        fn any_sway(self) -> bool {
            (0..100).any(|i| sway(lerp(self.start, self.end, i as f32 / 100.0)).abs() > 0.03)
        }
    }

    #[test]
    fn the_bell_is_framed_and_never_under_the_words() {
        for t in times(0.05) {
            let f = compose(t);
            let c = &f.camera;
            let under = (37.0..44.6).contains(&t);
            if under {
                // looking up into the mouth: the clapper's ball is in sight
                let b = on_bell(ball(f.clapper), f.sway);
                assert!(inside(c, b, 60.0), "ball out at {t}");
                continue;
            }
            let lip = on_bell([0.0, LIP, 0.0], f.sway);
            assert!(inside(c, lip, 60.0), "bell out at {t}");
            if f.shown > 0.05 {
                let top = words(t)
                    .iter()
                    .map(|l| line_place(l.row)[1])
                    .fold(f32::MAX, f32::min);
                let at = c.project(lip).unwrap();
                assert!(
                    at[1] < top - 60.0,
                    "bell under the words at {t}: {} vs {top}",
                    at[1]
                );
            }
        }
    }

    #[test]
    fn the_overlay_is_whole_triangles_of_finite_numbers() {
        let mut out = Vec::new();
        let mut most = 0;
        for t in times(0.1) {
            overlay(&compose(t), 1.4, &mut out);
            assert_eq!(out.len() % (OVERLAY_STRIDE * 3), 0);
            assert!(out.iter().all(|v| v.is_finite()), "{t}");
            most = most.max(out.len());
        }
        assert!(most / OVERLAY_STRIDE < 40_000, "{}", most / OVERLAY_STRIDE);
    }

    #[test]
    fn every_caption_fits() {
        for (row, [ink0, ink1]) in LABEL_INK.iter().enumerate() {
            let [x, top, cap] = line_place(row);
            let width = (ink1 - ink0) * cap / 44.0;
            assert!(x > SIZE[0] * 0.1 && x + width < SIZE[0] * 0.9, "row {row}");
            assert!(top > SIZE[1] * 0.6 && top + cap <= WORDS_BOTTOM + 0.1);
            assert!(cap >= 15.0);
        }
        for t in times(0.1) {
            let mut slots: Vec<[f32; 2]> = words(t)
                .iter()
                .filter(|l| l.alpha > 0.02)
                .map(|l| {
                    let [_, top, cap] = line_place(l.row);
                    [top, top + cap]
                })
                .collect();
            slots.sort_by(|a, b| a[0].total_cmp(&b[0]));
            for w in slots.windows(2) {
                assert!(w[0][1] + 8.0 < w[1][0], "{t}: {w:?}");
            }
        }
    }

    #[test]
    fn light_pages_glow_until_the_flood() {
        assert_eq!(glow(0.0), 0.45);
        assert_eq!(glow(compose(48.5).flood[1]), 0.0);
        for t in times(0.05) {
            let f = compose(t).flood[1];
            assert!((0.0..=0.45).contains(&glow(f)), "{t}");
            // never more light than the flood itself gives
            assert!(glow(f) + f <= 1.2, "{t}");
        }
    }

    #[test]
    fn every_theme_has_a_look() {
        let luma = |c: [f32; 3]| 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        for code in 0..8 {
            let l = look(code);
            assert_eq!(l.light, matches!(code, 1 | 5 | 6));
            if l.light {
                for c in [l.lamp, l.ink, l.word, l.lead] {
                    assert!(luma(c) < luma(l.paper) - 0.2, "{code}");
                }
            } else {
                assert!(luma(l.word) > luma(l.paper) + 0.4);
            }
        }
    }
}
