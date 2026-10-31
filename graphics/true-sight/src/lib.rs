//! «Истинное распознавание»: Step 4, the second block's last page, 08/08.
//! «Глаз»: one human eye in macro, the lens at the skin. Warm skin, a cool
//! iris, a single soft light from the upper left; around it only the dark.
//! The page, in order:
//! «И пока ты не ощутил ступни, не услышал голос, не отследил, как мысль
//! делает вывод» — the eye is closed and dreams show through the thin skin
//! of the lid like pictures: a house at night, a road with a walker, two
//! faces and a voice between them, an endless stair. At each «не» the lid
//! starts, a ripple runs through the dream, it melts and the next one forms
//! out of the blur; at the thought making its conclusion the stair runs and
//! the eyeball races.
//! «ты не проснулся» — stillness; the stair slows and dims, the eye stays
//! shut.
//! «Но как только возникло Истинное Видение» — the eye opens and the lens
//! draws back to all of it; the wide pupil narrows in the light.
//! «Истинное Распознавание» — the lens comes to the iris: the world (a
//! horizon, hills, the low sun) appears on the cornea, and then breaks from
//! the pupil outward into a lit grid: it was a projection.
//! «и Различение» — the lens draws back and the grid runs out of the eye
//! over the whole face: skin and lashes are a wireframe too. Only the eye
//! itself stays alive, and checks it all with three small glances.
//! «возникает Ты Абсолютный, Ты Настоящий» — the lens dives into the pupil
//! and through it, until there is no eye left, only its dark; in it a whole
//! person stands, woven of light, lit from the heart. Then the lens comes
//! back out, the eye closes and the first dream comes back.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time: the lens, the lid, the gaze, the pupil, the dreams, the reflection,
//! its grid and the person. The browser adapter only uploads the values and the
//! shaders only paint them.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod generated;

use generated::{LABEL_BAND, LABEL_INK};
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

/// Authored frame, 3 : 2 like the other Step 4 scenes.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// The page in one seamless loop.
pub const LOOP_SECONDS: f32 = 60.0;
/// Reduced motion holds this moment: the lens inside the pupil, the person
/// of light whole in it, «ТЫ АБСОЛЮТНЫЙ, ТЫ НАСТОЯЩИЙ.» written.
pub const STILL: f32 = 52.5;

/// The world is measured in centimetres on the face's frontal plane: x
/// across (the nose to the left), y up. The iris's centre when the eye looks
/// straight ahead, and its radius.
pub const EYE_Y: f32 = 0.1;
pub const IRIS_R: f32 = 0.6;
/// The pupil: wide in the dark of sleep, narrow in the light.
pub const PUPIL_WIDE: f32 = 0.37;
pub const PUPIL_NARROW: f32 = 0.17;
/// The pupil the lens dives into.
pub const PUPIL_DIVE: f32 = 0.4;
/// The person inside the pupil: where their feet stand and how tall they
/// are (cm), so that the lens, once through, frames them over the words.
pub const FIGURE_FEET: f32 = EYE_Y - 0.13;
pub const FIGURE_HEIGHT: f32 = 0.24;

/// The captions, in the order of the page.
pub const CARDS: [[f32; 2]; 8] = [
    [0.8, 7.2],
    [7.6, 13.6],
    [14.0, 21.0],
    [21.4, 27.0],
    [27.6, 34.0],
    [34.4, 40.4],
    [40.8, 46.4],
    [46.8, 53.6],
];
/// The bright row of every card.
const KEYS: [usize; 8] = [1, 2, 3, 4, 6, 7, 8, 10];
/// A quiet row and the cards it stands over; it stays written in the pauses
/// between them.
const LEADS: [(usize, [usize; 2]); 3] = [(0, [0, 2]), (5, [4, 6]), (9, [7, 7])];
/// The lid starts at these moments, one for each «не».
pub const TWITCHES: [f32; 3] = [3.0, 9.6, 16.2];
/// The eye opens over these seconds and closes again over `CLOSE`.
pub const OPEN: [f32; 2] = [28.0, 30.8];
pub const CLOSE: [f32; 2] = [55.5, 58.5];
/// The dreams under the lid, leaving as the eye opens and back as it shuts.
const DREAMS_GONE: [f32; 4] = [27.6, 29.6, 57.0, 59.6];
/// When each of the four dreams begins: the house comes back with the shut
/// lid and runs over the loop's seam, the others come at the «не».
pub const DREAM_STARTS: [f32; 4] = [57.0, TWITCHES[0], TWITCHES[1], TWITCHES[2]];
/// How long a dream takes to melt into the next.
const CHANGE: f32 = 1.6;
/// The eyeball's run under the lid while «мысль делает вывод».
const RACE: [f32; 4] = [14.2, 15.2, 19.8, 21.0];
/// «Ты не проснулся»: the dreams go quiet.
const HUSH: [f32; 4] = [21.4, 22.6, 26.0, 27.6];
/// The world on the cornea; its breaking into a grid from the pupil out;
/// the grid leaving the eye to run over the face.
const WORLD: [f32; 4] = [34.6, 36.4, 40.0, 41.0];
const GRID: [f32; 4] = [37.2, 39.6, 41.6, 44.0];
const HOLO: [f32; 4] = [41.0, 43.8, 49.0, 51.0];
/// The dive: the pupil opens, light gathers into the person, who then
/// stands whole in the pupil's dark.
const DILATE: [f32; 4] = [47.0, 50.0, 56.0, 59.0];
const WEAVE: [f32; 4] = [48.4, 49.8, 50.8, 52.2];
const FIGURE: [f32; 4] = [49.2, 51.6, 56.4, 58.0];
/// «Ты Настоящий»: the light warms.
const WARM: [f32; 4] = [47.0, 50.0, 53.6, 57.0];
/// Whole numbers of cycles per loop for every wave the shader turns with
/// the loop's angle (the dreams), so the loop has no seam.
pub const DREAM_CYCLES: [f32; 4] = [5.0, 7.0, 11.0, 29.0];

pub fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
/// Quintic ease: still at both ends, for the lens and the lid.
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
/// The loop as an angle.
fn phase(t: f32) -> f32 {
    TAU * t / LOOP_SECONDS
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

/// At the skin of the closed lid, the lash line low in the frame.
const LID: Camera = Camera {
    center: [0.05, 0.12],
    half: 1.2,
};
/// A little nearer and toward the nose while the dreams run.
const LID_NEAR: Camera = Camera {
    center: [-0.05, 0.1],
    half: 1.0,
};
/// The whole eye, a little above the middle so the words stay under it.
const EYE: Camera = Camera {
    center: [0.0, EYE_Y - 0.15],
    half: 1.3,
};
/// The iris and the cornea, the lower lid just over the words.
const IRIS: Camera = Camera {
    center: [0.0, EYE_Y - 0.08],
    half: 0.78,
};
/// Back from the eye, so the grid has the face to run over.
const FACE: Camera = Camera {
    center: [0.0, EYE_Y - 0.25],
    half: 1.7,
};
/// Through the pupil: its dark is all the frame, the eye gone.
const PUPIL: Camera = Camera {
    center: [0.0, EYE_Y - 0.03],
    half: 0.18,
};
/// The lens's keys: it holds between equal neighbours and eases between
/// the others.
const SHOTS: [(f32, Camera); 12] = [
    (0.0, LID),
    (21.0, LID_NEAR),
    (27.8, LID_NEAR),
    (31.6, EYE),
    (34.4, EYE),
    (37.6, IRIS),
    (40.6, IRIS),
    (43.6, FACE),
    (46.8, FACE),
    (51.0, PUPIL),
    (55.0, PUPIL),
    (LOOP_SECONDS, LID),
];
pub fn camera(t: f32) -> Camera {
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

/// One start of the lid: a quick lift that quivers out. `d` is the time
/// since it began.
fn flutter(d: f32) -> f32 {
    if !(0.0..2.0).contains(&d) {
        return 0.0;
    }
    smooth(0.0, 0.09, d)
        * (-d / 0.45).exp()
        * (0.55 + 0.45 * (TAU * 5.0 * d).cos())
        * (1.0 - smooth(1.2, 2.0, d))
}
/// How strongly the lid has just started, over all the «не».
pub fn startle(t: f32) -> f32 {
    TWITCHES.iter().map(|&at| flutter(t - at)).sum()
}
/// How far the eye is open (0 shut, 1 open). The starts lift the lid a
/// hair and never open it.
pub fn openness(t: f32) -> f32 {
    let main = ease(smooth(OPEN[0], OPEN[1], t)) * (1.0 - ease(smooth(CLOSE[0], CLOSE[1], t)));
    main + 0.075 * startle(t) * (1.0 - main)
}
/// The eye's opening without the starts.
fn awake(t: f32) -> f32 {
    ease(smooth(OPEN[0], OPEN[1], t)) * (1.0 - ease(smooth(CLOSE[0], CLOSE[1], t)))
}
/// A sine sharpened toward a step: the eyeball's saccades under the lid.
fn darting(x: f32) -> f32 {
    (3.0 * x.sin()).tanh() / 3.0_f32.tanh()
}
/// How busily the eyeball moves under the lid.
pub fn rem(t: f32) -> f32 {
    (0.35 + 0.5 * startle(t).min(1.0) + 0.65 * window(t, RACE)) * (1.0 - 0.7 * window(t, HUSH))
}
/// Where the eye looks (cm from straight ahead). Shut, it runs under the
/// lid; open, it is still but for the glances of «Различение».
pub fn gaze(t: f32) -> [f32; 2] {
    let a = phase(t);
    let r = rem(t);
    let race = window(t, RACE);
    let under = [
        0.26 * r * darting(23.0 * a) + 0.1 * race * darting(47.0 * a + 1.3),
        0.05 * r * (17.0 * a + 0.6).sin(),
    ];
    let glances =
        0.07 * (smooth(41.6, 41.78, t) - 2.0 * smooth(43.2, 43.38, t) + smooth(44.7, 44.9, t));
    let w = awake(t);
    [lerp(under[0], glances, w), under[1] * (1.0 - w)]
}
/// The pupil's radius (cm): wide as the eye opens, narrowing in the light
/// with a small overshoot and a faint living tremor, opening again for the
/// dive.
pub fn pupil(t: f32) -> f32 {
    let light = ease(smooth(29.6, 32.4, t)) * (1.0 - ease(smooth(47.0, 50.0, t)));
    let overshoot = 0.03 * bell(t, 31.0, 31.8, 32.0, 33.6);
    lerp(PUPIL_WIDE, PUPIL_NARROW, light) + (PUPIL_DIVE - PUPIL_WIDE) * window(t, DILATE)
        - overshoot
        + 0.006 * light * (13.0 * phase(t)).sin()
}
/// How much the dreams shine through the lid.
pub fn dream(t: f32) -> f32 {
    1.0 - window(t, DREAMS_GONE)
}
/// How hard they flicker: harder at each start and in the race, faint in
/// «ты не проснулся».
pub fn stir(t: f32) -> f32 {
    (0.35 + 0.5 * startle(t).min(1.0) + 0.45 * window(t, RACE)) * (1.0 - 0.75 * window(t, HUSH))
}
/// How much of the world shows on the cornea.
pub fn world(t: f32) -> f32 {
    window(t, WORLD)
}
/// How much of the world on the cornea has broken into the grid.
pub fn grid(t: f32) -> f32 {
    window(t, GRID)
}
/// How far the grid has run over the face.
pub fn holo(t: f32) -> f32 {
    window(t, HOLO)
}
/// The person in the pupil.
pub fn figure(t: f32) -> f32 {
    window(t, FIGURE)
}
/// The light gathering into the person.
pub fn weave(t: f32) -> f32 {
    window(t, WEAVE)
}
/// The dreams on the lid: which one shows (0 house, 1 road, 2 faces,
/// 3 stair), how far it has formed out of the one before, and the seconds
/// since each of the two began.
pub fn reel(t: f32) -> [f32; 4] {
    let since = |s: f32| (t - s).rem_euclid(LOOP_SECONDS);
    let i = (0..DREAM_STARTS.len())
        .min_by(|&a, &b| since(DREAM_STARTS[a]).total_cmp(&since(DREAM_STARTS[b])))
        .unwrap_or(0);
    let before = (i + DREAM_STARTS.len() - 1) % DREAM_STARTS.len();
    // The house only fades in behind the closing lid; it replaces nothing.
    let change = if i == 0 {
        1.0
    } else {
        smooth(0.0, CHANGE, since(DREAM_STARTS[i]))
    };
    [
        i as f32,
        change,
        since(DREAM_STARTS[i]),
        since(DREAM_STARTS[before]),
    ]
}
/// The key light: steady, a little warmer for «Ты Настоящий».
pub fn light(t: f32) -> f32 {
    1.0 + 0.14 * window(t, WARM)
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
/// The quiet row over a card, and when it is written.
fn lead(card: usize) -> Option<(usize, [f32; 2])> {
    LEADS
        .iter()
        .find(|(_, [a, b])| (*a..=*b).contains(&card))
        .map(|&(row, [a, b])| (row, [CARDS[a][0], CARDS[b][1]]))
}
/// The lines of the caption at `t`, top to bottom.
pub fn words(t: f32) -> Vec<Line> {
    let line = |row, key, [a, b]: [f32; 2]| Line {
        row,
        key,
        alpha: bell(t, a, a + 0.5, b - 0.6, b),
        wipe: smooth(a, a + 0.7, t),
    };
    let mut lines = Vec::new();
    if let Some(c) = CARDS.iter().position(|[a, b]| t >= *a && t < *b) {
        let lead = lead(c);
        if let Some((row, span)) = lead {
            lines.push(line(row, false, span));
        }
        let delay = if lead.is_some() && CARDS[c][0] == lead.unwrap().1[0] {
            0.6
        } else {
            0.0
        };
        lines.push(line(KEYS[c], true, [CARDS[c][0] + delay, CARDS[c][1]]));
    } else if let Some((row, span)) = LEADS
        .iter()
        .filter_map(|&(_, [a, _])| lead(a))
        .find(|(_, [a, b])| (*a..*b).contains(&t))
    {
        // The quiet line stays written in the pauses between its cards.
        lines.push(line(row, false, span));
    }
    lines.retain(|l| l.alpha > 0.0);
    lines
}
/// Where a caption line sits: left edge, cap top, cap height (authored px).
/// Lines are centred; the quiet one stands over the bright one.
pub fn line_place(row: usize) -> [f32; 3] {
    let key = !LEADS.iter().any(|(r, _)| *r == row);
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
    /// The eye: how far open, where it looks (x, y) and its pupil's radius.
    pub eye: [f32; 4],
    /// The dreams' light and flicker, the world on the cornea and its grid.
    pub state: [f32; 4],
    /// The dreams on the lid (see `reel`).
    pub dreams: [f32; 4],
    /// The grid over the face, the person in the pupil, the light gathering.
    pub holo: [f32; 4],
    /// The key light.
    pub light: f32,
    /// The loop as an angle: the shader's dream waves turn with it.
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
    let g = gaze(t);
    Frame {
        time: t,
        camera: camera(t),
        eye: [openness(t), g[0], g[1], pupil(t)],
        state: [dream(t), stir(t), world(t), grid(t)],
        dreams: reel(t),
        holo: [holo(t), figure(t), weave(t), 0.0],
        light: light(t),
        phase: phase(t),
        shown: words(t).iter().fold(0.0_f32, |m, l| m.max(l.alpha)),
    }
}

/// Colors of one theme.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// The dark around the face (dark pages); on light pages the browser
    /// passes the page's own color instead.
    pub paper: [f32; 3],
    /// The light on the skin and the cornea (dark pages).
    pub key: [f32; 3],
    /// The iris's cool color (dark pages).
    pub fill: [f32; 3],
    /// Light pages: the light is inked in the lamp's color, and only its
    /// strongest deepens to `ink`; the dark stays the page.
    pub lamp: [f32; 3],
    pub ink: [f32; 3],
    /// The bright and the quiet caption lines.
    pub word: [f32; 3],
    pub lead: [f32; 3],
    /// Light pages: the least light the skin carries, so its shadowed side
    /// still reads as skin in the lamp's ink, not as the page.
    pub body: f32,
    /// The skin's warmth over the key light: dark pages warm the skin a
    /// little against the cool iris; light pages ink it in the lamp anyway.
    pub warm: [f32; 3],
    pub light: bool,
}
/// The light pages' least skin light (see `Look::body`).
const BODY: f32 = 0.12;
/// Dark pages' warm skin (see `Look::warm`).
const WARM_SKIN: [f32; 3] = [1.0, 0.85, 0.72];
const fn rgb(v: u32) -> [f32; 3] {
    [
        ((v >> 16) & 255) as f32 / 255.0,
        ((v >> 8) & 255) as f32 / 255.0,
        (v & 255) as f32 / 255.0,
    ]
}
/// The app theme by its `graphicsPalette` code. Light themes (Дюна, Мираж,
/// Рассвет) lay ink on a pale page; dark themes light a face in the dark.
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
        warm: WARM_SKIN,
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
            warm: [1.0; 3],
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
                warm: [1.0; 3],
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
            // The gaze darts under the lid, so it moves fastest of all.
            assert!(close(x.eye[e], y.eye[e], 0.01), "eye {e}");
            assert!(close(x.state[e], y.state[e], 0.003), "state {e}");
            assert!(close(x.holo[e], y.holo[e], 0.003), "holo {e}");
            assert!(close(x.dreams[e], y.dreams[e], 0.01), "dreams {e}");
        }
        for f in [&x, &y] {
            assert!(f.eye[0] < 0.001 && f.state[0] > 0.999 && f.state[2] == 0.0);
            assert!(f.holo == [0.0; 4] && f.dreams[0] == 0.0 && f.dreams[1] == 1.0);
            assert!(f.shown < 0.01);
        }
        for n in DREAM_CYCLES {
            assert_eq!(n.fract(), 0.0);
        }
    }

    #[test]
    fn nothing_jumps_inside_the_loop() {
        let step = 1.0 / 60.0;
        for t in times(step) {
            let (a, b) = (compose(t), compose(t + step));
            assert!((a.camera.half / b.camera.half).ln().abs() < 0.02, "{t}");
            assert!(close(a.eye[0], b.eye[0], 0.03), "lid {t}");
            assert!(close(a.eye[3], b.eye[3], 0.01), "pupil {t}");
            // The dreams' flicker (state 1) may jump with a start of the lid.
            for e in [0, 2, 3] {
                assert!(close(a.state[e], b.state[e], 0.03), "state {e} {t}");
            }
            for e in 0..3 {
                assert!(close(a.holo[e], b.holo[e], 0.03), "holo {e} {t}");
            }
            // A new dream begins only where it starts to form, or unseen.
            if a.dreams[0] != b.dreams[0] {
                assert!(b.dreams[1] < 0.01 || a.state[0] < 0.01, "dream {t}");
            }
        }
    }

    #[test]
    fn the_beats_follow_the_page() {
        for w in CARDS.windows(2) {
            assert!(w[0][1] < w[1][0]);
        }
        assert!(CARDS[7][1] < CLOSE[0]);
        // A new dream for every «не», each formed under its card.
        for (i, at) in TWITCHES.iter().enumerate() {
            assert_eq!(reel(at + 0.5)[0], (i + 1) as f32);
            assert!(reel(at + CHANGE + 0.01)[1] == 1.0 && reel(at + 0.3)[1] < 0.5);
            assert!(at + CHANGE < CARDS[i][1]);
        }
        assert_eq!(reel(1.0)[0], 0.0);
        assert_eq!(reel(25.0)[0], 3.0);
        // The three «не»: the lid starts under each, and never opens.
        for (i, at) in TWITCHES.iter().enumerate() {
            assert!((CARDS[i][0]..CARDS[i][1]).contains(at));
            assert!(startle(at + 0.2) > 0.5, "{at}");
        }
        for t in times(0.02) {
            if t < OPEN[0] || t > CLOSE[1] {
                assert!(openness(t) < 0.1, "{t}");
            }
        }
        // «Ты не проснулся»: shut and quiet.
        for t in [23.0, 25.0] {
            assert!(openness(t) < 0.001 && stir(t) < 0.15 && dream(t) > 0.99);
        }
        // «Истинное Видение»: open, the pupil narrowed.
        assert!(openness(33.0) > 0.999 && pupil(33.5) < PUPIL_NARROW + 0.01);
        assert!(pupil(OPEN[0] + 0.5) > PUPIL_WIDE - 0.01);
        // «Распознавание» brings the world and breaks it into the grid;
        // «Различение» runs the grid over the face; then the dive.
        assert!(world(CARDS[5][0]) < 0.1 && world(36.8) > 0.99 && grid(36.8) == 0.0);
        assert!(grid(40.0) > 0.99 && holo(40.6) == 0.0 && holo(44.5) > 0.99);
        assert!(figure(CARDS[7][0]) == 0.0 && figure(STILL) > 0.99);
        assert!(pupil(STILL) > PUPIL_DIVE - 0.01);
        // The dreams are gone while the eye is open.
        assert!(dream(33.0) == 0.0 && dream(52.0) == 0.0);
    }

    #[test]
    fn the_lens_keeps_the_eye_in_the_frame() {
        for t in times(0.05) {
            let c = camera(t);
            let o = openness(t);
            // The lid's middle stays in the frame, above the words, until
            // the lens goes into the pupil.
            if c.half > 0.45 {
                assert!(inside(&c, [0.0, EYE_Y - 0.15], 40.0), "lid {t}");
                assert!(
                    c.project([0.0, EYE_Y - 0.15])[1] < 830.0,
                    "over the words {t}"
                );
            }
            // Once the eye opens, the whole iris is in the frame, until the
            // dive.
            if o > 0.5 && t < CARDS[7][0] {
                for p in [[0.0, EYE_Y + IRIS_R], [-IRIS_R, EYE_Y], [IRIS_R, EYE_Y]] {
                    assert!(inside(&c, p, 30.0), "iris {t}");
                }
            }
        }
        // «Распознавание»: the iris fills most of the frame's height.
        assert!(2.0 * IRIS_R * camera(40.0).scale() > 0.7 * SIZE[1]);
        // «Различение»: the whole eye and the face around it.
        assert!(inside(&camera(45.0), [-1.5, EYE_Y], 100.0));
        // «Ты Настоящий»: the lens is through the pupil, no eye left in the
        // frame; the person stands over the words.
        let c = camera(STILL);
        let r = pupil(STILL) - 0.03;
        for (sx, sy) in [(-1.0, -1.0), (-1.0, 1.0), (1.0, -1.0), (1.0, 1.0)] {
            let corner = [
                c.center[0] + sx * c.half * SIZE[0] / SIZE[1],
                c.center[1] + sy * c.half - EYE_Y,
            ];
            assert!(corner[0].hypot(corner[1]) < r, "{corner:?}");
        }
        let feet = c.project([0.0, FIGURE_FEET])[1];
        let crown = c.project([0.0, FIGURE_FEET + FIGURE_HEIGHT])[1];
        assert!(feet < 820.0 && crown > 60.0 && feet - crown > 0.6 * SIZE[1]);
    }

    #[test]
    fn the_words_come_in_order() {
        assert!(words(0.0).is_empty());
        let rows = |t| words(t).iter().map(|l| l.row).collect::<Vec<_>>();
        assert_eq!(rows(4.0), [0, 1]);
        assert_eq!(rows(10.0), [0, 2]);
        assert_eq!(rows(17.0), [0, 3]);
        assert_eq!(rows(24.0), [4]);
        assert_eq!(rows(31.0), [5, 6]);
        assert_eq!(rows(37.0), [5, 7]);
        assert_eq!(rows(43.0), [5, 8]);
        assert_eq!(rows(STILL), [9, 10]);
        assert!(words(56.0).is_empty());
        // The quiet lines hold their light between the bright ones.
        for t in [7.4, 13.8, 34.2, 40.6] {
            let w = words(t);
            assert_eq!(w.len(), 1, "{t}");
            assert!(!w[0].key && w[0].alpha == 1.0, "{t}");
        }
        for row in 0..LABEL_INK.len() {
            let [left, top, cap] = line_place(row);
            assert!(left > 40.0 && top > 0.0 && top + cap <= WORDS_BOTTOM);
        }
    }

    #[test]
    fn the_still_is_the_person_in_the_eye() {
        let f = compose(STILL);
        assert!(f.eye[0] > 0.999 && f.holo[1] > 0.999 && f.state[0] == 0.0);
        assert!(f.shown > 0.99);
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
