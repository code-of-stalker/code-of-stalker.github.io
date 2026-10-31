//! «Сущностные ощущения»: Step 4, the second block's page 07/08.
//! «Пламя»: one candle flame in the dark, very close. No room; the candle
//! itself is a person, a standing wax figure with the wick in its crown.
//! The lens comes slowly closer until the frame holds only the flame. Then
//! the page, in order:
//! «Сущностные ощущения — это не про эмоции» — a draught: the flame
//! thrashes, leans and gutters, then settles.
//! «Это про Живое Узнавание Сути в себе… через ощущения, через тело» — the
//! lens starts to come in; the wax under the flame glows from inside and
//! that glow breathes slowly.
//! «Я — Здесь» — the flame straightens and stands still.
//! «Я — Не мысль» — curls of smoke leave its tip and thin out; the flame
//! stays.
//! «Я — Не персонаж» — the figure melts: head, arms and legs run into one
//! plain column of wax, lower now; the flame burns on it as before.
//! «Я — Присутствие» — the lens is at the flame: even light, nothing else.
//! «Ощущение Себя — без обозначения Я» — the candle, the wick, the table
//! and the wax go into the dark; the light remains, softer, with nothing
//! under it, and drifts back up. Then the lens draws back, the whole figure
//! returns out of the dark and the loop closes where it began.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time: the lens, the flame's lean, flicker, height and light, the wax's
//! glow, the figure's melt and every curl of smoke. The browser adapter only
//! uploads the values and the shaders only paint them.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod generated;

use generated::{LABEL_BAND, LABEL_INK};
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

/// Authored frame, 3 : 2 like the other Step 4 scenes.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// The page in one seamless loop.
pub const LOOP_SECONDS: f32 = 56.0;
/// Reduced motion holds this moment: the lens at the flame, even light,
/// «Я — ПРИСУТСТВИЕ.» written.
pub const STILL: f32 = 41.5;

/// The world is measured in centimetres on the table's front edge plane:
/// x across, y up, the candle's axis at x = 0 and the table at y = 0.
/// The candle, a standing wax figure: its half-width at the shoulders, the
/// dish it stands in, and its crown, where the wick is.
pub const CANDLE_R: f32 = 2.2;
pub const DISH_TOP: f32 = 0.3;
pub const CANDLE_TOP: f32 = 11.0;
/// How far the crown sinks once the figure has melted to a plain column.
pub const SINK: f32 = 1.4;
/// Round things are seen a little from above: an ellipse's height over its
/// width.
pub const TILT: f32 = 0.28;
/// The wick's height over the wax, and the flame on it: its root over the
/// wax, its height and its widest half-width.
pub const WICK: f32 = 0.95;
pub const ROOT_OVER: f32 = 0.45;
pub const FLAME_H: f32 = 4.2;
pub const FLAME_W: f32 = 0.62;

/// The captions, in the order of the page.
pub const CARDS: [[f32; 2]; 7] = [
    [0.8, 8.4],
    [9.0, 16.6],
    [17.0, 22.8],
    [23.2, 29.6],
    [30.0, 37.6],
    [38.0, 45.2],
    [45.8, 52.4],
];
/// «Я —» stays written from «Здесь» to «Присутствие».
const I_AM: [f32; 2] = [17.0, 45.2];
/// The draught of «не про эмоции».
const DRAUGHT: [f32; 4] = [0.8, 2.2, 5.6, 8.4];
/// The breathing glow of «через тело», and its period.
const BREATH: [f32; 4] = [9.5, 11.0, 15.8, 17.2];
const BREATH_PERIOD: f32 = 4.6;
/// The figure melts over these seconds; it grows whole again, and the
/// light drifts back up, while the dark holds everything, over `UNMELT`.
pub const MELT: [f32; 2] = [30.6, 37.2];
pub const UNMELT: [f32; 2] = [51.4, 53.0];
/// The matter (candle, dish, table) leaves and comes back.
const GONE: [f32; 4] = [46.6, 50.4, 53.0, 55.6];
/// The flame softens into light with nothing under it.
const PURE: [f32; 4] = [46.4, 50.0, 52.0, 55.0];
/// The curls of smoke of «не мысль»: when each leaves the tip and its own
/// phase. Each is a streak of smoke released for `RELEASE` seconds.
pub const WISPS: [[f32; 2]; 5] = [
    [23.5, 0.0],
    [24.6, 1.7],
    [25.9, 3.1],
    [27.0, 4.4],
    [28.2, 5.6],
];
pub const RELEASE: f32 = 1.1;
/// A curl is gone this long after it left.
pub const SMOKE_LIFE: f32 = 3.6;
/// Points along one curl.
pub const WISP_POINTS: usize = 28;
/// Whole numbers of cycles per loop for the flame's living flicker: the
/// shader waves the flame with these, so the loop has no seam.
pub const FLICKER_CYCLES: [f32; 4] = [23.0, 37.0, 53.0, 71.0];

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
fn window(t: f32, w: [f32; 4]) -> f32 {
    bell(t, w[0], w[1], w[2], w[3])
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

/// The lens: what it looks at and half the frame's height (cm). The frame
/// is 3 : 2, so it is half as wide again.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Camera {
    pub center: [f32; 2],
    pub half: f32,
}
impl Camera {
    /// Authored px per cm.
    pub fn scale(&self) -> f32 {
        SIZE[1] * 0.5 / self.half
    }
    /// A point of the world in authored px (y down).
    pub fn project(&self, p: [f32; 2]) -> [f32; 2] {
        let k = self.scale();
        [
            SIZE[0] * 0.5 + (p[0] - self.center[0]) * k,
            SIZE[1] * 0.5 - (p[1] - self.center[1]) * k,
        ]
    }
}

const WIDE: Camera = Camera {
    center: [0.0, 6.0],
    half: 11.0,
};
/// Nearer, the flame and the top of the candle.
const NEARER: Camera = Camera {
    center: [0.0, 10.4],
    half: 7.2,
};
/// Room above the tip for the smoke.
const ABOVE: Camera = Camera {
    center: [0.2, 13.6],
    half: 6.4,
};
/// Back to the whole figure as it melts, the table above the words.
const FIGURE: Camera = Camera {
    center: [0.0, 6.1],
    half: 11.2,
};
/// At the flame on the melted wax; the wax's top just clears the words.
const FLAME: Camera = Camera {
    center: [0.0, 12.95 - SINK],
    half: 3.45,
};
const CLOSEST: Camera = Camera {
    center: [0.0, 13.3 - SINK],
    half: 2.9,
};
/// The lens's keys: it holds between equal neighbours and eases between
/// the others.
const SHOTS: [(f32, Camera); 13] = [
    (0.0, WIDE),
    (9.0, WIDE),
    (21.0, NEARER),
    (22.0, NEARER),
    (26.0, ABOVE),
    (27.5, ABOVE),
    (30.6, FIGURE),
    (37.4, FIGURE),
    (41.4, FLAME),
    (46.0, FLAME),
    (50.5, CLOSEST),
    (51.5, CLOSEST),
    (LOOP_SECONDS, WIDE),
];
/// The lens. Once it is at the flame it rises with the light as the light
/// drifts back up over the returning figure, then lets go as it draws back.
pub fn camera(t: f32) -> Camera {
    let mut c = shot(t);
    let (hold, back) = (SHOTS[8].0, SHOTS[11].0);
    let follow = if t < hold {
        0.0
    } else {
        1.0 - ease((t - back) / (LOOP_SECONDS - back))
    };
    c.center[1] += follow * (crown(t) - (CANDLE_TOP - SINK));
    c
}
fn shot(t: f32) -> Camera {
    let i = SHOTS
        .windows(2)
        .position(|w| t >= w[0].0 && t < w[1].0)
        .unwrap_or(SHOTS.len() - 2);
    let ((t0, a), (t1, b)) = (SHOTS[i], SHOTS[i + 1]);
    let k = ease((t - t0) / (t1 - t0));
    // The frame's size changes evenly in log, like a steady dolly.
    let half = (lerp(a.half.ln(), b.half.ln(), k)).exp();
    if (a.half - b.half).abs() < 1e-3 {
        return Camera {
            center: [
                lerp(a.center[0], b.center[0], k),
                lerp(a.center[1], b.center[1], k),
            ],
            half,
        };
    }
    // A zoom about the one point that stands still on screen between the
    // two shots: every point moves steadily from its place in the first to
    // its place in the second, so nothing in both leaves the frame between.
    let still = |e: usize| (b.center[e] * a.half - a.center[e] * b.half) / (a.half - b.half);
    let at = |e: usize| still(e) + (a.center[e] - still(e)) * half / a.half;
    Camera {
        center: [at(0), at(1)],
        half,
    }
}

/// How hard the draught blows.
pub fn draught(t: f32) -> f32 {
    window(t, DRAUGHT)
}
/// How much the flame lives: a little always, wildly in the draught,
/// almost nothing from «Здесь» to the end of «Присутствие».
pub fn flicker(t: f32) -> f32 {
    let still = 0.75 * bell(t, 16.8, 18.5, 50.5, 55.5) + 0.15 * bell(t, 37.5, 39.5, 50.0, 53.0);
    0.22 * (1.0 - still) + 0.95 * draught(t)
}
/// The flame's lean (its tip's offset over its height): gusts, mostly to
/// the right.
pub fn lean(t: f32) -> f32 {
    draught(t) * (0.42 * (1.9 * t + 0.4).sin() + 0.22 * (3.7 * t + 2.1).sin() + 0.25)
}
/// The breathing glow of the wax.
fn breath(t: f32) -> f32 {
    window(t, BREATH)
}
/// The flame's height over its rest height: the draught shortens it in
/// jerks, the breath lifts and lowers it, «Здесь» draws it up.
pub fn height(t: f32) -> f32 {
    let d = draught(t);
    let tall = smooth(17.0, 18.6, t) * (1.0 - smooth(51.0, 55.0, t));
    1.0 + 0.05 * breath(t) * (TAU * (t - BREATH[0]) / BREATH_PERIOD).sin()
        - 0.12 * d * (0.5 + 0.5 * (4.3 * t).sin())
        + 0.06 * tall
}
/// The flame's light: it quivers with the flicker and dips in the draught.
pub fn intensity(t: f32) -> f32 {
    let phase = TAU * t / LOOP_SECONDS;
    let quiver = 0.6 * (41.0 * phase).sin() + 0.4 * (67.0 * phase + 1.0).sin();
    (1.0 + 0.3 * flicker(t) * quiver) * (1.0 - 0.25 * draught(t) * (0.5 + 0.5 * (5.3 * t).sin()))
}
/// The wax's inner glow: it breathes in «через тело».
pub fn glow(t: f32) -> f32 {
    let b = breath(t);
    1.0 + 0.5 * b * (0.5 - 0.5 * (TAU * (t - BREATH[0]) / BREATH_PERIOD).cos())
}
/// How much of the candle, the dish and the table is there.
pub fn matter(t: f32) -> f32 {
    1.0 - window(t, GONE)
}
/// How far the flame has softened into bare light.
pub fn pure(t: f32) -> f32 {
    window(t, PURE)
}
/// How far the figure has melted into a plain column. It grows back while
/// nothing of the matter is seen.
pub fn melt(t: f32) -> f32 {
    ease(smooth(MELT[0], MELT[1], t)) * (1.0 - smooth(UNMELT[0], UNMELT[1], t))
}
/// The wax's top, where the wick stands: the figure's crown, lower as it
/// melts.
pub fn crown(t: f32) -> f32 {
    CANDLE_TOP - SINK * melt(t)
}
/// The flame's root over the wick.
pub fn root(t: f32) -> f32 {
    crown(t) + ROOT_OVER
}

/// The flame's tip at the moment `t` (cm), with its lean.
pub fn tip(t: f32) -> [f32; 2] {
    let h = FLAME_H * height(t);
    [lean(t) * h, root(t) + h]
}

/// One curl of smoke: its points from the oldest (highest) to the newest
/// (at the tip), each with its width (cm) and light.
#[derive(Clone, Debug, PartialEq)]
pub struct Wisp {
    pub points: Vec<([f32; 2], f32, f32)>,
}
/// The curls in the air at `t`. Each is a streak line: smoke let go from
/// the tip over `RELEASE` seconds; where each puff is now depends on how
/// long ago it left, so the streak curls as it rises.
pub fn smoke(t: f32) -> Vec<Wisp> {
    let mut out = Vec::new();
    for [born, phase] in WISPS {
        if t < born || t > born + RELEASE + SMOKE_LIFE {
            continue;
        }
        let mut points = Vec::with_capacity(WISP_POINTS);
        for j in 0..WISP_POINTS {
            let at = born + RELEASE * j as f32 / (WISP_POINTS - 1) as f32;
            let age = t - at;
            if age < 0.0 {
                break;
            }
            let from = tip(at);
            let swirl = 0.35 * age.powf(1.4) * (2.3 * age + phase + 2.1 * at).sin();
            let p = [
                from[0] + swirl + 0.25 * age,
                from[1] - 0.2 + 1.9 * age + 0.15 * age * age,
            ];
            // Thin at both ends of the streak, gone when old.
            let along = j as f32 / (WISP_POINTS - 1) as f32;
            let ends = smooth(0.0, 0.15, along) * (1.0 - smooth(0.8, 1.0, along) * 0.6);
            let light = 0.5 * smooth(0.0, 0.35, age) * (1.0 - smooth(1.8, SMOKE_LIFE, age)) * ends;
            points.push((p, 0.05 + 0.1 * age, light));
        }
        if points.len() >= 2 {
            out.push(Wisp { points });
        }
    }
    out
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
const LEADS: [usize; 4] = [0, 2, 4, 9];
/// The lines of the caption at `t`, top to bottom.
pub fn words(t: f32) -> Vec<Line> {
    let line = |row, key, [a, b]: [f32; 2]| Line {
        row,
        key,
        alpha: bell(t, a, a + 0.5, b - 0.6, b),
        wipe: smooth(a, a + 0.7, t),
    };
    let card = CARDS.iter().position(|[a, b]| t >= *a && t < *b);
    let mut lines = match card {
        Some(0) => vec![
            line(0, false, CARDS[0]),
            line(1, true, [CARDS[0][0] + 0.6, CARDS[0][1]]),
        ],
        Some(1) => vec![
            line(2, false, CARDS[1]),
            line(3, true, [CARDS[1][0] + 0.6, CARDS[1][1]]),
        ],
        Some(6) => vec![
            line(9, false, CARDS[6]),
            line(10, true, [CARDS[6][0] + 0.6, CARDS[6][1]]),
        ],
        // «Здесь», «Не мысль», «Не персонаж» and «Присутствие» take turns
        // under «Я —».
        Some(c) => vec![
            line(4, false, I_AM),
            line(3 + c, true, [CARDS[c][0] + 0.6, CARDS[c][1]]),
        ],
        // «Я —» stays written in the pauses between them.
        None if (I_AM[0]..I_AM[1]).contains(&t) => vec![line(4, false, I_AM)],
        None => Vec::new(),
    };
    lines.retain(|l| l.alpha > 0.0);
    lines
}
/// Where a caption line sits: left edge, cap top, cap height (authored px).
/// Lines are centred; the quiet one stands over the bright one.
pub fn line_place(row: usize) -> [f32; 3] {
    let key = !LEADS.contains(&row);
    let below = if key { 0.0 } else { KEY_CAP + 16.0 };
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
    /// The flame: its lean, flicker, height and softness into bare light.
    pub flame: [f32; 4],
    /// The flame's light and the wax's inner glow.
    pub light: [f32; 2],
    pub matter: f32,
    pub melt: f32,
    /// The wax's top (cm).
    pub crown: f32,
    /// The loop as an angle: the shader's flicker waves turn with it.
    pub phase: f32,
    /// How much of the words' strip is shown.
    pub shown: f32,
}
pub fn compose(t: f32) -> Frame {
    let t = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    Frame {
        time: t,
        camera: camera(t),
        flame: [lean(t), flicker(t), height(t), pure(t)],
        light: [intensity(t), glow(t)],
        matter: matter(t),
        melt: melt(t),
        crown: crown(t),
        phase: TAU * t / LOOP_SECONDS,
        shown: words(t).iter().fold(0.0_f32, |m, l| m.max(l.alpha)),
    }
}

/// Floats per smoke vertex: authored px (x, y), across the ribbon (-1..1),
/// its light.
pub const SMOKE_STRIDE: usize = 4;
/// The smoke as ribbons of triangles in authored px. A ribbon is never
/// thinner than `least` px, so it stays soft rather than aliased.
pub fn overlay(f: &Frame, least: f32, out: &mut Vec<f32>) {
    out.clear();
    let k = f.camera.scale();
    for wisp in smoke(f.time) {
        let pts: Vec<([f32; 2], f32, f32)> = wisp
            .points
            .iter()
            .map(|&(p, w, a)| (f.camera.project(p), (w * k).max(least), a))
            .collect();
        // Each point's two edges, across the streak's own direction there.
        let edges: Vec<[[f32; 4]; 2]> = (0..pts.len())
            .map(|i| {
                let prev = pts[i.saturating_sub(1)].0;
                let next = pts[(i + 1).min(pts.len() - 1)].0;
                let d = [next[0] - prev[0], next[1] - prev[1]];
                let n = (d[0] * d[0] + d[1] * d[1]).sqrt().max(1e-4);
                let (p, w, a) = pts[i];
                let side = [-d[1] / n * w, d[0] / n * w];
                [-1.0_f32, 1.0].map(|s| [p[0] + side[0] * s, p[1] + side[1] * s, s, a])
            })
            .collect();
        for pair in edges.windows(2) {
            let ([a0, a1], [b0, b1]) = (pair[0], pair[1]);
            for c in [a0, a1, b1, a0, b1, b0] {
                out.extend_from_slice(&c);
            }
        }
    }
}

/// Colors of one theme.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// The dark around the flame (dark pages); on light pages the browser
    /// passes the page's own color instead.
    pub paper: [f32; 3],
    /// The flame's light and the wax's warmth (dark pages).
    pub key: [f32; 3],
    /// The flame's cool root (dark pages).
    pub fill: [f32; 3],
    /// Light pages: the light is inked in the lamp's color, and only its
    /// strongest deepens to `ink`; the dark stays the page.
    pub lamp: [f32; 3],
    pub ink: [f32; 3],
    /// The bright and the quiet caption lines.
    pub word: [f32; 3],
    pub lead: [f32; 3],
    /// Light pages: the least light the figure's body carries, so its
    /// unlit lower half still reads as wax in the lamp's ink, not as the page.
    pub body: f32,
    pub light: bool,
}
/// The light pages' least body light (see `Look::body`).
const BODY: f32 = 0.2;
const fn rgb(v: u32) -> [f32; 3] {
    [
        ((v >> 16) & 255) as f32 / 255.0,
        ((v >> 8) & 255) as f32 / 255.0,
        (v & 255) as f32 / 255.0,
    ]
}
/// The app theme by its `graphicsPalette` code. Light themes (Дюна, Мираж,
/// Рассвет) lay ink on a pale page; dark themes light a dark table.
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
        body: 0.0,
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
            body: BODY,
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
                body: BODY,
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
    fn inside(c: &Camera, p: [f32; 2], margin: f32) -> bool {
        let q = c.project(p);
        q[0] > margin && q[0] < SIZE[0] - margin && q[1] > margin && q[1] < SIZE[1] - margin
    }

    #[test]
    fn the_loop_has_no_seam() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        let (x, y) = (compose(LOOP_SECONDS - 0.004), compose(0.004));
        for e in 0..2 {
            assert!(close(x.camera.center[e], y.camera.center[e], 0.003));
        }
        assert!(close(x.camera.half, y.camera.half, 0.003));
        for e in 0..4 {
            assert!(close(x.flame[e], y.flame[e], 0.003), "flame {e}");
        }
        for f in [&x, &y] {
            assert!(f.matter > 0.999 && f.melt == 0.0 && f.flame[3] < 0.001);
            assert!(f.shown < 0.01 && smoke(f.time).is_empty());
        }
        // The flicker waves turn a whole number of times per loop.
        for n in FLICKER_CYCLES {
            assert_eq!(n.fract(), 0.0);
        }
    }

    #[test]
    fn nothing_jumps_inside_the_loop() {
        let step = 1.0 / 60.0;
        for t in times(step) {
            let (a, b) = (compose(t), compose(t + step));
            assert!((a.camera.half / b.camera.half).ln().abs() < 0.02, "{t}");
            assert!(close(a.flame[0], b.flame[0], 0.05), "lean {t}");
            assert!(close(a.flame[2], b.flame[2], 0.02), "height {t}");
            assert!(close(a.matter, b.matter, 0.02), "matter {t}");
            assert!(close(a.melt, b.melt, 0.02), "melt {t}");
        }
    }

    #[test]
    fn the_beats_follow_the_page() {
        for w in CARDS.windows(2) {
            assert!(w[0][1] < w[1][0]);
        }
        assert!(CARDS[6][1] < LOOP_SECONDS);
        // «Не про эмоции»: the draught blows only under its words.
        assert!(draught(4.0) > 0.9 && draught(CARDS[1][0]) == 0.0);
        // «Здесь»: the flame is quiet from then to the end of «Присутствие».
        for t in [19.0, 30.0, 42.0] {
            assert!(flicker(t) < 0.08, "{t}");
        }
        // «Не мысль»: smoke only then.
        let last = WISPS[4][0] + RELEASE + SMOKE_LIFE;
        for t in times(0.1) {
            let smoky = !smoke(t).is_empty();
            if !(WISPS[0][0] - 0.05..last + 0.05).contains(&t) {
                assert!(!smoky, "{t}");
            } else if (WISPS[0][0] + 0.2..last - 0.2).contains(&t) {
                assert!(smoky, "{t}");
            }
        }
        // «Не персонаж»: the figure melts under its words and stays melted;
        // it grows back only while nothing of it is seen.
        assert_eq!(melt(CARDS[4][0]), 0.0);
        assert!(melt(CARDS[4][1]) > 0.999 && melt(48.0) > 0.999);
        for t in times(0.05) {
            if (UNMELT[0]..UNMELT[1]).contains(&t) {
                assert!(matter(t) < 0.001, "{t}");
            }
        }
        // «Без обозначения Я»: nothing under the light.
        assert!(matter(51.0) < 0.001 && pure(51.0) > 0.999);
    }

    #[test]
    fn the_lens_keeps_what_matters_in_the_frame() {
        for t in times(0.05) {
            let c = camera(t);
            assert!(inside(&c, [0.0, root(t)], 40.0), "flame root {t}");
            assert!(inside(&c, tip(t), 40.0), "flame tip {t}");
            if (MELT[0]..CARDS[4][1]).contains(&t) {
                for p in [[-CANDLE_R - 1.0, DISH_TOP], [CANDLE_R + 1.0, DISH_TOP]] {
                    assert!(inside(&c, p, 40.0), "figure {t}");
                }
            }
        }
        // What a beat is about stays above the words at the foot of the frame.
        let above = |c: &Camera, y: f32| (y - c.center[1]) / c.half > -0.6;
        for t in [4.0, MELT[0], 34.0, MELT[1]] {
            assert!(above(&camera(t), 0.0), "table {t}");
        }
        // It ends at the flame: the flame fills most of the frame's height.
        let c = camera(STILL);
        assert!(FLAME_H * c.scale() > 0.6 * SIZE[1]);
        assert!(above(&c, crown(STILL)));
    }

    #[test]
    fn the_words_come_in_order() {
        assert!(words(0.0).is_empty());
        let rows = |t| words(t).iter().map(|l| l.row).collect::<Vec<_>>();
        assert_eq!(rows(4.0), [0, 1]);
        assert_eq!(rows(12.0), [2, 3]);
        assert_eq!(rows(20.0), [4, 5]);
        assert_eq!(rows(26.0), [4, 6]);
        assert_eq!(rows(34.0), [4, 7]);
        assert_eq!(rows(STILL), [4, 8]);
        assert_eq!(rows(49.0), [9, 10]);
        // «Я —» holds its light between the bright lines.
        for t in [22.9, 29.8, 37.8] {
            assert_eq!(
                words(t),
                [Line {
                    row: 4,
                    key: false,
                    alpha: 1.0,
                    wipe: 1.0
                }]
            );
        }
        for row in 0..LABEL_INK.len() {
            let [left, top, cap] = line_place(row);
            assert!(left > 40.0 && top > 0.0 && top + cap <= WORDS_BOTTOM);
        }
    }

    #[test]
    fn the_smoke_is_whole_ribbons() {
        let f = compose(26.0);
        let mut floats = Vec::new();
        overlay(&f, 1.2, &mut floats);
        assert!(!floats.is_empty());
        assert_eq!(floats.len() % (SMOKE_STRIDE * 3), 0);
        assert!(floats.iter().all(|v| v.is_finite()));
        overlay(&compose(0.0), 1.2, &mut floats);
        assert!(floats.is_empty());
    }

    #[test]
    fn every_theme_has_a_look() {
        for code in 0..7 {
            let l = look(code);
            assert_eq!(l.light, Palette::from_code(code).is_light(), "{code}");
            if l.light {
                assert_ne!(l.lamp, l.ink);
            }
        }
        assert_eq!(look(2).paper, rgb(0x0D1520));
    }
}
