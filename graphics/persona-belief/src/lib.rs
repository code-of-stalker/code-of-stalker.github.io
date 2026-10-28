//! «Я это действительно знаю?»: Step 4, the second block's page 03/08.
//! «Оттиск»: no room and no seated person this time, only sand under a low
//! lamp, seen through a macro lens. Then the page, in order:
//! «Даже вера — является программой» — a seal comes down, presses into the
//! sand and lifts: a clean imprint of rings and letterless words.
//! «Человек может верить в Бога, в Аллаха, в Будду, в Кришну, в правильность
//! молитвы или мантры» — the names are only in the caption. For each one
//! the sand heals and another seal, of another shape, comes down on the
//! very same spot with the very same motion. No emblem of any faith is
//! drawn: only the form of a seal and the form of words.
//! «…но никогда не задаваться вопросом» — the lamp climbs high and flat,
//! the relief all but disappears, the lens wanders off over the sand.
//! Then the three questions, and the light and the lens ask each:
//! «А я это чувствую как Истину?» — the lamp drops low and rakes the sand:
//! its own wind ripples come alive and glint, and stop dead at the edge of
//! the imprint, where nothing moves.
//! «Я это действительно Знаю?» — the lens goes down to the grains, to the
//! rim of sand pushed out sideways: it was pressed from above. It looks up
//! and finds the seal still hanging over it, its face the imprint mirrored.
//! «Или мне просто так сказали, и я поверил?» — the seal leaves, the lens
//! rises, and a light runs from the imprint along a chain of the very same
//! imprints into the dark, the lens following it and coming back. No answer
//! is given: the imprint stays, but now it is seen where it is from.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time. The browser adapter only uploads the values and the shaders only
//! paint them.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod generated;

use generated::{LABEL_BAND, LABEL_INK};
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

/// Authored frame, 3 : 2 like the other Step 4 scenes.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// The three paragraphs: a seamless loop.
pub const LOOP_SECONDS: f32 = 64.0;
/// Reduced motion holds this moment: the chain of the same imprint traced
/// into the dark, the lens back on our own, «И Я ПОВЕРИЛ?» lit.
pub const STILL: f32 = 58.6;

/// The seals by kind, as `shape()` in shaders/sand.glsl draws them: their
/// half extents on the ground (x, z), metres of sand.
pub const REACH: [[f32; 2]; 7] = [
    [0.36, 0.36],
    [0.43, 0.30],
    [0.33, 0.33],
    [0.368, 0.368],
    [0.44, 0.27],
    [0.30, 0.39],
    [0.34, 0.34],
];
/// The seal of «Даже вера — является программой».
pub const OPENING: usize = 6;
/// The six beliefs' seals, in the order of the page.
pub const BELIEFS: [usize; 6] = [1, 2, 3, 4, 5, 0];
/// The seal whose imprint stays for the questions: the last belief's.
pub const KEPT: usize = BELIEFS[5];
/// How deep a seal goes into the sand.
pub const DEPTH: f32 = 0.03;

/// One press: down from out of the shot, into the sand, held, up again.
pub const DESCEND: f32 = 0.7;
pub const SINK: f32 = 0.25;
pub const HOLD: f32 = 0.2;
pub const RISE: f32 = 0.8;
/// While the next seal comes down, the imprint before heals (seconds after
/// that seal starts).
pub const HEAL: [f32; 2] = [0.0, 0.55];
/// The seal's face is out of every shot from this height up; the shader
/// does not draw it there.
pub const ALOFT: f32 = 1.6;
pub const SHOWN_BELOW: f32 = 1.5;
/// When each seal starts down, and which seal it is.
pub const PRESSES: [(f32, usize); 7] = [
    (1.8, OPENING),
    (9.8, BELIEFS[0]),
    (13.2, BELIEFS[1]),
    (16.6, BELIEFS[2]),
    (20.0, BELIEFS[3]),
    (23.4, BELIEFS[4]),
    (26.8, BELIEFS[5]),
];
/// «Действительно Знаю?»: the seal comes back and hangs over its imprint.
pub const RETURN: [f32; 2] = [46.2, 48.8];
pub const HOVER: f32 = 0.4;
/// …and leaves for good.
pub const LEAVE: [f32; 2] = [51.2, 53.4];
/// The chain of the same imprint: direction on the ground, step, sway.
pub const CHAIN: [f32; 4] = [-0.62, 0.785, 1.55, 0.35];
pub const COPIES: usize = 6;
/// The light that follows the chain, from our imprint past the last copy.
pub const RUN: [f32; 2] = [52.6, 59.4];
pub const RUN_FROM: f32 = 0.3;
pub const RUN_TO: f32 = 7.4;
/// The runner's height over the sand.
pub const RUNNER_Y: f32 = 0.3;
/// Everything heals back to bare sand before the loop starts again.
pub const FADE: [f32; 2] = [60.8, 63.2];
/// The captions, in the order of the page.
pub const CARDS: [[f32; 2]; 6] = [
    [1.0, 9.0],
    [9.4, 30.8],
    [31.4, 37.2],
    [37.8, 44.4],
    [45.0, 51.0],
    [51.6, 61.4],
];
/// «И Я ПОВЕРИЛ?» joins its caption.
pub const BELIEVED: f32 = 56.6;
/// The sand is most alive while it is felt.
pub const FEEL: [f32; 4] = [37.8, 39.0, 43.6, 44.6];

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
fn sub(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
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
fn normalize(a: [f32; 3]) -> [f32; 3] {
    let l = dot(a, a).sqrt().max(1e-6);
    a.map(|v| v / l)
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
        let [fw, rt, up] = self.basis();
        let v = sub(p, self.eye);
        let z = dot(v, fw);
        if z < 0.01 {
            return None;
        }
        let x = dot(v, rt) * self.zoom / z;
        let y = dot(v, up) * self.zoom / z;
        Some([SIZE[0] * 0.5 + x * SIZE[1], SIZE[1] * 0.5 - y * SIZE[1]])
    }
    /// The blur circle's radius (authored px) of a point at this depth.
    pub fn coc(&self, depth: f32) -> f32 {
        (self.aperture * (depth - self.focus) / depth.max(0.01))
            .abs()
            .min(22.0)
    }
}

/// One held shot: the lens and the point it keeps sharp.
#[derive(Clone, Copy, Debug)]
struct Shot {
    eye: [f32; 3],
    target: [f32; 3],
    zoom: f32,
    sharp: [f32; 3],
    aperture: f32,
}
const GLIDE: Shot = Shot {
    eye: [0.7, 0.34, -1.1],
    target: [-0.05, 0.0, 0.2],
    zoom: 2.0,
    sharp: [0.0, 0.0, 0.0],
    aperture: 11.0,
};
const PRESS: Shot = Shot {
    eye: [0.14, 0.56, -1.6],
    target: [0.0, 0.1, 0.05],
    zoom: 2.0,
    sharp: [0.0, 0.0, 0.0],
    aperture: 9.0,
};
const REPEAT: Shot = Shot {
    eye: [0.12, 0.64, -1.75],
    target: [0.0, 0.06, 0.05],
    zoom: 2.0,
    sharp: [0.0, 0.0, 0.0],
    aperture: 8.0,
};
const AWAY: Shot = Shot {
    eye: [-0.2, 0.7, -1.5],
    target: [-0.9, 0.0, 0.9],
    zoom: 1.9,
    sharp: [-1.3, 0.0, 1.6],
    aperture: 10.0,
};
const FELT: Shot = Shot {
    eye: [-0.35, 0.32, -0.95],
    target: [0.05, 0.0, 0.05],
    zoom: 2.1,
    sharp: [-0.3, 0.0, -0.1],
    aperture: 12.0,
};
const KNOWN: Shot = Shot {
    eye: [0.5, 0.075, -0.52],
    target: [0.22, 0.02, -0.12],
    zoom: 1.8,
    sharp: [0.3, 0.0, -0.2],
    aperture: 14.0,
};
const ABOVE: Shot = Shot {
    eye: [0.7, 0.2, -1.0],
    target: [0.0, 0.12, 0.0],
    zoom: 1.45,
    sharp: [0.0, HOVER, 0.0],
    aperture: 12.0,
};
const TOLD: Shot = Shot {
    eye: [2.17, 0.69, -0.98],
    target: [-0.15, 0.0, 0.54],
    zoom: 1.48,
    sharp: [0.0, 0.0, 0.0],
    aperture: 9.0,
};
/// Held shots: (arrive, leave, shot); the lens eases from one to the next.
const SHOTS: [(f32, f32, Shot); 8] = [
    (0.0, 0.6, GLIDE),
    (2.4, 6.4, PRESS),
    (8.8, 29.6, REPEAT),
    (32.2, 36.4, AWAY),
    (38.6, 43.8, FELT),
    (45.4, 47.3, KNOWN),
    (49.3, 51.0, ABOVE),
    (54.0, 61.0, TOLD),
];
/// The lamp: (arrive, leave, [position, power]).
const LAMPS: [(f32, f32, [f32; 4]); 5] = [
    (0.0, 30.4, [-2.6, 0.95, 1.2, 3.4]),
    (32.6, 36.4, [-0.6, 2.4, 0.6, 2.8]),
    (38.4, 44.0, [-2.6, 0.5, 1.4, 3.8]),
    (45.4, 51.0, [-2.0, 1.3, 0.4, 3.6]),
    (52.6, 60.6, [1.0, 0.7, 2.4, 3.2]),
];

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

/// A copy of the imprint along the chain, at any (fractional) place.
pub fn copy_at(i: f32) -> [f32; 2] {
    let [dx, dz, step, sway] = CHAIN;
    [
        dx * i * step + dz * sway * (i * 1.9).sin(),
        dz * i * step - dx * sway * (i * 1.9).sin(),
    ]
}
/// How far along the chain the runner light is.
pub fn run(t: f32) -> f32 {
    lerp(RUN_FROM, RUN_TO, ease((t - RUN[0]) / (RUN[1] - RUN[0])))
}

pub fn camera(t: f32) -> Camera {
    let s = keyed(&SHOTS, t, |a, b, k| Shot {
        eye: lerp3(a.eye, b.eye, k),
        target: lerp3(a.target, b.target, k),
        zoom: lerp(a.zoom, b.zoom, k),
        sharp: lerp3(a.sharp, b.sharp, k),
        aperture: lerp(a.aperture, b.aperture, k),
    });
    // A hand-held breath, periodic with the loop.
    let w = TAU * t / LOOP_SECONDS;
    let reach = 1.0 - 0.8 * bell(t, 44.8, 45.6, 50.8, 51.6);
    let eye = [
        s.eye[0] + 0.012 * reach * (3.0 * w).sin(),
        s.eye[1] + 0.006 * reach * (5.0 * w + 1.0).sin(),
        s.eye[2] + 0.01 * reach * (2.0 * w + 2.0).sin(),
    ];
    // «…и я поверил?»: the lens follows the runner along the chain and
    // comes back to our own imprint.
    let u = run(t);
    let [x, z] = copy_at(u);
    let sharp = lerp3(s.sharp, [x, 0.0, z], bell(t, 53.4, 54.4, 57.2, 58.2));
    let mut c = Camera {
        eye,
        target: s.target,
        zoom: s.zoom,
        focus: 1.0,
        aperture: s.aperture,
    };
    c.focus = c.depth(sharp).max(0.05);
    c
}

/// The seal: where it hangs (x, z), the height of its face, its kind.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Seal {
    pub at: [f32; 2],
    pub lift: f32,
    pub kind: usize,
}
pub fn seal(t: f32) -> Seal {
    let hidden = Seal {
        at: [0.0, 0.0],
        lift: ALOFT + 0.4,
        kind: KEPT,
    };
    for &(start, kind) in &PRESSES {
        let u = t - start;
        let lift = if !(0.0..DESCEND + SINK + HOLD + RISE).contains(&u) {
            continue;
        } else if u < DESCEND {
            ALOFT * (1.0 - smooth(0.0, DESCEND, u))
        } else if u < DESCEND + SINK {
            -DEPTH * smooth(0.0, SINK, u - DESCEND)
        } else if u < DESCEND + SINK + HOLD {
            -DEPTH
        } else {
            -DEPTH + (ALOFT + DEPTH) * smooth(0.0, RISE, u - DESCEND - SINK - HOLD)
        };
        return Seal {
            at: [0.0, 0.0],
            lift,
            kind,
        };
    }
    if t > RETURN[0] && t < LEAVE[1] {
        let lift = ALOFT - (ALOFT - HOVER) * smooth(RETURN[0], RETURN[1], t)
            + (ALOFT - HOVER + 0.4) * smooth(LEAVE[0], LEAVE[1], t);
        return Seal {
            at: [0.0, 0.0],
            lift,
            kind: KEPT,
        };
    }
    hidden
}
/// The imprint in the sand now: which seal made it and how deep it is.
pub fn print(t: f32) -> (usize, f32) {
    let mut out = (OPENING, 0.0);
    for (n, &(start, kind)) in PRESSES.iter().enumerate() {
        let contact = start + DESCEND;
        if t < contact {
            break;
        }
        let mut depth = smooth(contact, contact + SINK, t);
        if let Some(&(next, _)) = PRESSES.get(n + 1) {
            depth *= 1.0 - smooth(next + HEAL[0], next + HEAL[1], t);
        }
        out = (kind, depth);
    }
    (out.0, out.1 * (1.0 - smooth(FADE[0], FADE[1], t)))
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
/// The lines of the caption at `t`, top to bottom.
pub fn words(t: f32) -> Vec<Line> {
    let Some(card) = CARDS.iter().position(|[a, b]| t >= *a && t < *b) else {
        return Vec::new();
    };
    let [a, b] = CARDS[card];
    let line = |row, key, from: f32, till: f32| Line {
        row,
        key,
        alpha: bell(t, from, from + 0.5, till - 0.6, till),
        wipe: smooth(from, from + 0.7, t),
    };
    let mut lines = match card {
        0 => vec![line(0, false, a, b), line(1, true, a + 0.6, b)],
        1 => {
            let mut v = vec![line(2, false, a, b)];
            // The name of each belief, written as its seal touches the sand.
            for k in 0..6 {
                let contact = PRESSES[k + 1].0 + DESCEND;
                let till = PRESSES
                    .get(k + 2)
                    .map_or(b, |&(next, _)| next + DESCEND - 0.4);
                let l = line(3 + k, true, contact - 0.15, till);
                if l.alpha > 0.0 {
                    v.push(l);
                }
            }
            v
        }
        2 => vec![line(9, false, a, b), line(10, true, a + 0.6, b)],
        3 => vec![line(11, false, a, b), line(12, true, a + 0.6, b)],
        4 => vec![line(13, false, a, b), line(14, true, a + 0.6, b)],
        _ => vec![
            line(15, false, a, b),
            line(16, true, a + 0.6, b),
            line(17, true, BELIEVED, b),
        ],
    };
    lines.retain(|l| l.alpha > 0.0);
    lines
}
/// Where a caption line sits: left edge, cap top, cap height (authored px).
/// Lines are centred; their slots stay put while lines come and go.
pub fn line_place(row: usize) -> [f32; 3] {
    let key = !matches!(row, 0 | 2 | 9 | 11 | 13 | 15);
    // Slot from the bottom: the last line of each caption sits lowest.
    let below = match row {
        0 | 9 | 11 | 13 => KEY_CAP + 16.0,
        2 => KEY_CAP + 16.0,
        15 => 2.0 * KEY_CAP + 30.0,
        16 => KEY_CAP + 14.0,
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
    /// The lamp: position and power.
    pub lamp: [f32; 4],
    /// The light that runs along the chain: position and power.
    pub runner: [f32; 4],
    pub seal: Seal,
    pub print: (usize, f32),
    /// How many copies along the chain are there (fractional) and how deep.
    pub copies: [f32; 2],
    /// The grain's drift (x, z) and how alive the sand is.
    pub life: [f32; 3],
    /// How much of the words' strip is shown.
    pub shown: f32,
}
pub fn compose(t: f32) -> Frame {
    let t = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let lamp = keyed(&LAMPS, t, |a, b, k| {
        [0, 1, 2, 3].map(|e| lerp(a[e], b[e], k))
    });
    let u = run(t);
    let [rx, rz] = copy_at(u);
    let fade = 1.0 - smooth(FADE[0], FADE[1], t);
    let w = TAU * t / LOOP_SECONDS;
    let shown = words(t).iter().fold(0.0_f32, |m, l| m.max(l.alpha));
    Frame {
        time: t,
        camera: camera(t),
        lamp,
        runner: [
            rx,
            RUNNER_Y,
            rz,
            2.6 * bell(t, RUN[0], RUN[0] + 0.8, RUN[1] - 1.2, RUN[1]),
        ],
        seal: seal(t),
        print: print(t),
        copies: [
            (u - 0.5).clamp(0.0, COPIES as f32) * smooth(RUN[0], RUN[0] + 0.2, t),
            fade,
        ],
        life: [
            0.25 * (16.0 * w).cos(),
            0.25 * (16.0 * w).sin(),
            0.25 + 0.75 * bell(t, FEEL[0], FEEL[1], FEEL[2], FEEL[3]),
        ],
        shown,
    }
}
/// Colors of one theme.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// The air and the sand's darkness (dark pages); the page itself on
    /// light pages, where the browser passes the page's own color instead.
    pub paper: [f32; 3],
    /// The lamp's light on the sand (dark pages).
    pub key: [f32; 3],
    /// The cool fill from the other side, the seal's sheen.
    pub fill: [f32; 3],
    /// Shadows and the seal on light pages.
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
/// Рассвет) lay ink on a pale page; dark themes light dark sand.
pub fn look(code: u32) -> Look {
    let palette = Palette::from_code(code);
    let dark = |paper: [f32; 3], accent: [f32; 3], highlight: [f32; 3]| Look {
        paper,
        key: lerp3(highlight, [1.0; 3], 0.1),
        fill: accent,
        ink: [0.0; 3],
        word: lerp3(highlight, [1.0; 3], 0.15),
        lead: lerp3(highlight, paper, 0.25),
        light: false,
    };
    match palette {
        // Дюна: brown ink on sand, never an orange flood.
        Palette::Light => Look {
            paper: rgb(0xFAE18F),
            key: rgb(0xE8912E),
            fill: rgb(0xC9601E),
            ink: rgb(0x8E3A00),
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
    /// Points around a seal's outline on the ground.
    fn rim(kind: usize, at: [f32; 2], y: f32) -> Vec<[f32; 3]> {
        let [rx, rz] = REACH[kind];
        (0..16)
            .map(|i| {
                let a = i as f32 / 16.0 * TAU;
                [at[0] + rx * a.cos(), y, at[1] + rz * a.sin()]
            })
            .collect()
    }

    #[test]
    fn the_loop_has_no_seam() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        let (x, y) = (compose(LOOP_SECONDS - 0.004), compose(0.004));
        for e in 0..3 {
            assert!(close(x.camera.eye[e], y.camera.eye[e], 0.003));
            assert!(close(x.lamp[e], y.lamp[e], 0.01));
        }
        assert!(close(x.camera.focus, y.camera.focus, 0.02));
        // Bare sand at the seam: no imprint, no copies, no seal, no words.
        for f in [&x, &y] {
            assert!(f.print.1 < 0.001 && f.copies[0] * f.copies[1] < 0.001);
            assert!(f.seal.lift >= SHOWN_BELOW && f.shown < 0.01 && f.runner[3] < 0.01);
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
            // focus racks are smooth in diopters, as a lens turns
            assert!(
                close(1.0 / c.focus, 1.0 / previous.focus, 0.025),
                "focus at {t}"
            );
            assert!(close(c.aperture, previous.aperture, 0.05));
            previous = c;
        }
    }

    #[test]
    fn values_stay_finite_and_bounded() {
        for t in times(0.01) {
            let f = compose(t);
            let (kind, depth) = f.print;
            assert!(kind < REACH.len() && (0.0..=1.0).contains(&depth));
            assert!(f.seal.kind < REACH.len() && f.seal.lift >= -DEPTH - 1e-6);
            assert!((0.0..=COPIES as f32).contains(&f.copies[0]));
            assert!((0.0..=1.0).contains(&f.copies[1]) && (0.0..=1.0).contains(&f.life[2]));
            assert!(f.lamp.iter().chain(&f.runner).all(|v| v.is_finite()));
            assert!(f.lamp[1] > 0.3 && f.camera.eye[1] > 0.05 && f.camera.focus > 0.0);
            for l in words(t) {
                assert!((0.0..=1.0).contains(&l.alpha) && (0.0..=1.0).contains(&l.wipe));
            }
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
    }

    #[test]
    fn the_page_is_told_in_order() {
        // «Даже вера — является программой»: a seal presses, its imprint
        // stays while the words are up.
        let (start, kind) = PRESSES[0];
        assert!(start > CARDS[0][0] && start + DESCEND + SINK + HOLD + RISE < CARDS[0][1]);
        assert_eq!(print(CARDS[0][1] - 1.0), (kind, 1.0));
        // The six beliefs: each name is written as its seal touches the sand
        // on the same spot, one name at a time.
        for k in 0..6 {
            let (start, kind) = PRESSES[k + 1];
            assert_eq!(kind, BELIEFS[k]);
            let t = start + DESCEND + SINK + 0.4;
            assert!(t > CARDS[1][0] && t < CARDS[1][1]);
            assert_eq!(print(t), (kind, 1.0), "belief {k}");
            let names: Vec<_> = words(t)
                .into_iter()
                .filter(|l| l.key && l.alpha > 0.5)
                .collect();
            assert_eq!(names.len(), 1);
            assert_eq!(names[0].row, 3 + k);
            // the same motion every time
            let s = seal(start + 0.5);
            assert_eq!(s.at, [0.0, 0.0]);
            assert!(close(s.lift, seal(PRESSES[1].0 + 0.5).lift, 1e-5));
            // the sand has healed before the next seal touches it
            assert!(print(start + DESCEND - 0.01).1 < 0.01);
        }
        // «…никогда не задаваться вопросом»: the lamp high, the lens away.
        let f = compose(34.0);
        assert!(f.lamp[1] > 2.0);
        assert!(f.camera.coc(f.camera.depth([0.0; 3])) > 3.0);
        // «Чувствую как Истину?»: the lamp low, the sand alive, the lens on
        // the imprint's edge.
        let f = compose(41.0);
        assert!(f.lamp[1] < 0.6 && f.life[2] > 0.99 && f.print == (KEPT, 1.0));
        assert!(f.camera.coc(f.camera.depth([-0.3, 0.0, -0.1])) < 0.5);
        // «Действительно Знаю?»: down at the grains, then the seal over it.
        let f = compose(46.5);
        assert!(f.camera.eye[1] < 0.1);
        let f = compose(50.0);
        assert!(close(f.seal.lift, HOVER, 1e-4) && f.seal.kind == f.print.0);
        assert!(inside(&f.camera, [0.0, HOVER, 0.0], 60.0) && inside(&f.camera, [0.0; 3], 60.0));
        assert!(f.camera.coc(f.camera.depth([0.0, HOVER, 0.0])) < 0.5);
        // «Или мне просто так сказали…»: the light runs the chain, the lens
        // follows; then back on our own imprint, the chain into the dark.
        for k in 1..=3 {
            let t = (0..)
                .map(|i| RUN[0] + i as f32 * 0.01)
                .take_while(|t| *t < RUN[1])
                .find(|&t| run(t) >= k as f32)
                .unwrap();
            let f = compose(t + 0.2);
            let [x, z] = copy_at(k as f32);
            assert!(f.copies[0] >= k as f32 - 0.3, "copy {k}");
            assert!(
                f.camera.coc(f.camera.depth([x, 0.0, z])) < 2.0,
                "lens on copy {k}"
            );
        }
        let f = compose(STILL);
        assert!(f.copies[0] > COPIES as f32 - 1e-3 && f.copies[1] > 0.99);
        assert!(f.camera.coc(f.camera.depth([0.0; 3])) < 0.5);
        let [x, z] = copy_at(4.0);
        assert!(f.camera.coc(f.camera.depth([x, 0.0, z])) > 4.0);
        assert!(words(STILL).iter().any(|l| l.row == 17 && l.alpha > 0.99));
        assert!(f.print == (KEPT, 1.0) && f.seal.lift >= SHOWN_BELOW);
    }

    #[test]
    fn the_seal_comes_and_goes_out_of_shot() {
        // Wherever the shader starts or stops drawing it, the seal is above
        // the frame.
        for t in times(0.01) {
            let s = seal(t);
            if (s.lift - SHOWN_BELOW).abs() < 0.08 {
                let c = camera(t);
                for p in rim(s.kind, s.at, s.lift) {
                    assert!(c.project(p).is_none_or(|q| q[1] < -40.0), "{t}");
                }
            }
        }
    }

    #[test]
    fn the_imprint_is_framed_and_never_under_the_words() {
        for t in times(0.05) {
            let f = compose(t);
            let c = &f.camera;
            let (kind, depth) = f.print;
            // the whole imprint in the wider shots; the close ones are
            // down at the grains, and once the lens looks elsewhere
            let wide = !(29.6..=54.0).contains(&t);
            if depth > 0.5 && wide {
                for p in rim(kind, [0.0, 0.0], 0.0) {
                    assert!(inside(c, p, 20.0), "imprint out at {t}");
                }
            }
            // what the words cover
            let felt = t > 38.6 && t < 43.8;
            if f.shown > 0.05 && depth > 0.5 && (wide || felt) {
                let lines = words(t);
                let top = lines
                    .iter()
                    .map(|l| line_place(l.row)[1])
                    .fold(f32::MAX, f32::min);
                let centre = c.project([0.0, 0.0, 0.0]).unwrap();
                assert!(centre[1] < top - 60.0, "imprint under the words at {t}");
            }
        }
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
        // lines of one caption never overlap
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
    fn every_theme_has_a_look() {
        let luma = |c: [f32; 3]| 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        for code in 0..8 {
            let l = look(code);
            assert_eq!(l.light, matches!(code, 1 | 5 | 6));
            if l.light {
                // ink, words and the lamp sit below the page, never above
                for c in [l.ink, l.word, l.lead] {
                    assert!(luma(c) < luma(l.paper) - 0.2, "{code}");
                }
            } else {
                assert!(luma(l.word) > luma(l.paper) + 0.4);
            }
        }
    }
}
