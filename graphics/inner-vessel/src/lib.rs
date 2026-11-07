//! «Тело как форма», page 03 of Step 6 «Внутреннее кольцо», direction
//! «Наполнение». A person sits upright on a chair, the body a clear glass
//! vessel. «Не думай о теле»: the glass is empty and cold, only a few cold
//! glints of thought drift in the head. «Ощути его»: they sink through the
//! body to the soles and turn warm, and warm light starts to fill the
//! vessel from the feet up, one word at a time: the feet, the legs, the
//! trunk; it breathes (the level rises and falls twice), grows heavy (it
//! settles, the soles and the seat glow where they bear the weight), the
//! chair takes it (the light runs down its legs to the floor), and it fills
//! the whole inner volume up to the crown. «Это — заземление»: the light
//! goes out through the soles and the chair legs into the floor as roots.
//! «Без него … размышление»: the roots fade and the light drains upward,
//! out of the body into the head, turns cold and breaks into the glints of
//! thought again: the loop's start. Every value here is a pure function of
//! loop time; `browser.rs` only uploads it and one ray-marched pass draws
//! it. Unit: the person sits about 1.43 high; the floor is y = 0, the person
//! faces +z.
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

pub mod body;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerVessel;

pub const LOOP_SECONDS: f32 = 50.0;
/// The frame is 3:2; a canvas of another shape keeps the whole 3:2 frame in
/// view.
pub const FRAME_ASPECT: f32 = 1.5;
/// The box the person and the chair lie in; the shader marches only there.
pub const BOUNDS: [[f32; 3]; 2] = [[-0.3, -0.01, -0.21], [0.3, 1.46, 0.7]];
/// Where the soles stand (x, z) and the four chair legs.
pub const FEET: [[f32; 2]; 2] = [[0.126, 0.6], [-0.126, 0.6]];
pub const LEGS: [[f32; 2]; 4] = [
    [0.195, 0.27],
    [-0.195, 0.27],
    [0.195, -0.12],
    [-0.195, -0.12],
];
/// The seat's top, where the chair takes the weight.
pub const SEAT: f32 = 0.481;

/// The level of the light, keyed by the words: empty until the glints reach
/// the soles; «стопы» the feet, «ноги» up to the hips, «корпус» up to the
/// shoulders, held through «дыхание», «вес», «опору», and «внутренний
/// объем тела» up over the crown (the head ends at 1.43).
pub const LEVEL: [(f32, f32); 6] = [
    (7.0, 0.0),
    (9.5, 0.11),
    (12.5, 0.66),
    (15.5, 1.12),
    (27.5, 1.12),
    (32.0, 1.5),
];
/// «дыхание»: from `BREATH` two breaths of `BREATH_SECONDS`, the level
/// rising by `BREATH_RISE` on each.
pub const BREATH: f32 = 15.5;
pub const BREATH_SECONDS: f32 = 2.5;
pub const BREATH_RISE: f32 = 0.035;
/// «вес» and «опору»: when each comes and goes.
pub const HEAVY: [f32; 4] = [20.5, 22.5, 38.0, 41.0];
pub const CONTACT: [f32; 4] = [21.0, 23.0, 40.0, 43.0];
pub const SUPPORT: [f32; 4] = [24.0, 26.5, 40.0, 43.0];
/// «заземление»: the roots grow this far out from the soles and the chair
/// legs, and fade.
pub const ROOT_REACH: f32 = 1.3;
pub const ROOTS: [f32; 4] = [32.5, 37.0, 40.0, 43.0];
/// «Без него»: the light drains up out of the body into the head (the neck
/// is at `NECK`), turns cold and breaks into glints; then everything resets
/// unseen for the loop's start.
pub const NECK: f32 = 1.21;
pub const DRAIN: [f32; 2] = [40.0, 44.0];
pub const COOL: [f32; 2] = [42.5, 45.0];
pub const FILL: [f32; 4] = [6.6, 7.4, 44.5, 46.5];
pub const RESET: [f32; 2] = [47.0, 49.5];
/// The glints of thought in the head: how many, round where, how far they
/// drift; when each starts to sink to the soles and how long it takes.
pub const MOTES: usize = 6;
pub const HEAD: [f32; 3] = [0.0, 1.31, -0.02];
pub const SINK: f32 = 4.5;
pub const SINK_GAP: f32 = 0.16;
pub const SINK_SECONDS: f32 = 2.15;
/// The path a glint takes down the body on its side (x mirrored), after
/// leaving the head: neck, chest, belly, hip, knee, ankle, sole.
pub const PATH: [[f32; 3]; 7] = [
    [0.0, 1.16, -0.04],
    [0.04, 0.96, -0.02],
    [0.06, 0.74, 0.0],
    [0.1, 0.58, 0.12],
    [0.115, 0.5, 0.44],
    [0.12, 0.1, 0.47],
    [0.125, 0.035, 0.58],
];
/// The glints come back in the head as the cold light breaks up.
pub const RETURN: [f32; 2] = [44.5, 46.5];

/// One meaningful still frame for reduced motion: the whole body full and
/// warm, the roots in the floor, seen from above.
pub const STILL: f32 = 38.0;

/// The camera, keyed through the loop: round the person (degrees from +z
/// toward +x), over the floor (degrees), how far, the point it looks at, and
/// the height of the frame (degrees). Close on the head while the body is
/// empty, back for the whole figure as it fills, in on the trunk for the
/// breath, low round the side for the weight and the chair, round the front
/// as it fills to the crown, high over it for the roots, close on the head
/// again as the light drains into it.
pub const CAMERA: [(f32, [f32; 7]); 13] = [
    (0.0, [-35.0, 4.0, 1.9, 0.0, 1.08, 0.1, 36.0]),
    (4.0, [-38.0, 5.0, 1.95, 0.0, 1.04, 0.12, 37.0]),
    (7.0, [-48.0, 9.0, 2.9, 0.0, 0.71, 0.22, 42.0]),
    (12.5, [-40.0, 8.0, 2.9, 0.0, 0.72, 0.16, 42.0]),
    (15.5, [-30.0, 6.0, 2.3, 0.0, 0.86, 0.06, 40.0]),
    (20.5, [-24.0, 9.0, 2.9, 0.0, 0.71, 0.12, 42.0]),
    (24.0, [-56.0, 12.0, 2.95, 0.0, 0.68, 0.12, 42.0]),
    (27.5, [-62.0, 10.0, 2.95, 0.0, 0.71, 0.15, 42.0]),
    (32.0, [-22.0, 12.0, 3.0, 0.0, 0.7, 0.18, 42.0]),
    (35.0, [-32.0, 24.0, 3.4, 0.0, 0.6, 0.22, 42.0]),
    (39.0, [-46.0, 26.0, 3.4, 0.0, 0.6, 0.22, 42.0]),
    (43.0, [-28.0, 8.0, 2.2, 0.0, 1.0, 0.1, 38.0]),
    (46.5, [-34.0, 4.0, 1.9, 0.0, 1.08, 0.1, 36.0]),
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    /// Loop time, for the shader's own small motions.
    pub time: f32,
    /// The camera: its place and axes, and the tangent of half the frame's
    /// height.
    pub eye: [f32; 3],
    pub right: [f32; 3],
    pub up: [f32; 3],
    pub forward: [f32; 3],
    pub lens: f32,
    /// The light inside: its top level (breath included), its bottom level
    /// (0 but while it drains up), how strong it is, how cold (0 warm, 1 the
    /// cold of thought).
    pub level: f32,
    pub low: f32,
    pub fill: f32,
    pub cool: f32,
    /// «вес»: how much it has settled; where the soles and the seat bear it;
    /// «опору»: how far the light has run down the chair to the floor (0..1);
    /// how bright the top of the light is (it brightens with each breath).
    pub heavy: f32,
    pub contact: f32,
    pub support: f32,
    pub line: f32,
    /// «заземление»: how far the roots reach, and their light.
    pub reach: f32,
    pub roots: f32,
    /// The glints of thought: where each is and its light; how warm it is.
    pub motes: [[f32; 4]; MOTES],
    pub warmth: [f32; MOTES],
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
fn window(t: f32, [a, b, c, d]: [f32; 4]) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn dot(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

fn distance(a: [f32; 3], b: [f32; 3]) -> f32 {
    (0..3).map(|i| (a[i] - b[i]).powi(2)).sum::<f32>().sqrt()
}

/// A smooth closed curve through `n` keys (time, value) around the loop:
/// Catmull–Rom tangents, cubic Hermite pieces.
fn spline_by(n: usize, key: impl Fn(usize) -> (f32, f32), t: f32) -> f32 {
    let count = n as isize;
    let mut t = t.rem_euclid(LOOP_SECONDS);
    let i = (0..n)
        .rev()
        .find(|&j| key(j).0 <= t)
        .map_or(count - 1, |j| j as isize);
    let at = |j: isize| {
        let (time, value) = key(j.rem_euclid(count) as usize);
        (time + LOOP_SECONDS * j.div_euclid(count) as f32, value)
    };
    let [(t0, v0), (t1, v1), (t2, v2), (t3, v3)] = [i - 1, i, i + 1, i + 2].map(at);
    if t < t1 {
        t += LOOP_SECONDS;
    }
    let (m1, m2) = ((v2 - v0) / (t2 - t0), (v3 - v1) / (t3 - t1));
    let h = t2 - t1;
    let s = (t - t1) / h;
    let (s2, s3) = (s * s, s * s * s);
    (2.0 * s3 - 3.0 * s2 + 1.0) * v1
        + (s3 - 2.0 * s2 + s) * h * m1
        + (3.0 * s2 - 2.0 * s3) * v2
        + (s3 - s2) * h * m2
}

/// Camera channel `c` (see `CAMERA`) at `t`.
pub fn camera(c: usize, t: f32) -> f32 {
    spline_by(CAMERA.len(), |i| (CAMERA[i].0, CAMERA[i].1[c]), t)
}

/// The top of the light at `t` before the breath: eased from key to key, so
/// it only ever rises while the words name the body, then drops back to 0
/// unseen once the light has gone.
pub fn level(t: f32) -> f32 {
    let mut value = 0.0;
    for pair in LEVEL.windows(2) {
        let [(t0, v0), (t1, v1)] = [pair[0], pair[1]];
        if t >= t0 {
            value = v0 + (v1 - v0) * smooth(t0, t1, t);
        }
    }
    value * (1.0 - smooth(RESET[0], RESET[1], t))
}

/// How far the breath lifts the level: two smooth rises and falls.
pub fn breath(t: f32) -> f32 {
    let s = (t - BREATH) / BREATH_SECONDS;
    if !(0.0..2.0).contains(&s) {
        return 0.0;
    }
    BREATH_RISE * 0.5 * (1.0 - (TAU * s).cos())
}

/// The bottom of the light: it drains up to the neck, then drops back.
pub fn low(t: f32) -> f32 {
    NECK * smooth(DRAIN[0], DRAIN[1], t) * (1.0 - smooth(RESET[0], RESET[1], t))
}

/// Glint `k` drifting in the head.
pub fn in_head(k: usize, t: f32) -> [f32; 3] {
    let kf = k as f32;
    let at = kf / MOTES as f32 * TAU;
    let a = TAU * (2 + k % 3) as f32 * t / LOOP_SECONDS + kf * 1.7;
    let b = TAU * (3 + k % 2) as f32 * t / LOOP_SECONDS + kf * 2.3;
    [
        HEAD[0] + 0.032 * at.cos() + 0.022 * a.sin(),
        HEAD[1] + 0.018 * (2.0 * at).sin() + 0.026 * b.sin(),
        HEAD[2] + 0.028 * at.sin() + 0.018 * a.cos(),
    ]
}

/// Glint `k` sinking: from the head down its side of the body to the sole,
/// at `s` (0..1) of the way.
pub fn sinking(k: usize, t: f32, s: f32) -> [f32; 3] {
    let side = if k.is_multiple_of(2) { 1.0 } else { -1.0 };
    let mut points = [[0.0; 3]; PATH.len() + 1];
    points[0] = in_head(k, t);
    for (i, p) in PATH.iter().enumerate() {
        points[i + 1] = [p[0] * side, p[1], p[2]];
    }
    // Even speed along the way: each piece by its length.
    let n = points.len() - 1;
    let lengths: [f32; PATH.len()] = std::array::from_fn(|i| distance(points[i], points[i + 1]));
    let mut left = s.clamp(0.0, 1.0) * lengths.iter().sum::<f32>();
    let mut i = 0;
    while i < n - 1 && left > lengths[i] {
        left -= lengths[i];
        i += 1;
    }
    let u = (left / lengths[i]).clamp(0.0, 1.0);
    let p = |j: isize| points[j.clamp(0, n as isize) as usize];
    let [p0, p1, p2, p3] = [i as isize - 1, i as isize, i as isize + 1, i as isize + 2].map(p);
    // Catmull–Rom through the path's points.
    let (u2, u3) = (u * u, u * u * u);
    std::array::from_fn(|c| {
        0.5 * (2.0 * p1[c]
            + (p2[c] - p0[c]) * u
            + (2.0 * p0[c] - 5.0 * p1[c] + 4.0 * p2[c] - p3[c]) * u2
            + (3.0 * p1[c] - p0[c] - 3.0 * p2[c] + p3[c]) * u3)
    })
}

/// Glint `k` at `t`: where it is, its light, its warmth.
pub fn mote(k: usize, t: f32) -> ([f32; 3], f32, f32) {
    let start = SINK + SINK_GAP * k as f32;
    let s = smooth(start, start + SINK_SECONDS, t);
    let arrive = start + SINK_SECONDS;
    let place = if s > 0.0 && t < RETURN[0] {
        sinking(k, t, s)
    } else {
        in_head(k, t)
    };
    let back = smooth(RETURN[0] + 0.25 * k as f32, RETURN[1], t);
    let light = if t < RETURN[0] {
        1.0 - smooth(arrive - 0.1, arrive + 0.5, t)
    } else {
        back
    };
    let warmth = if t < RETURN[0] {
        smooth(start + 0.3, start + 1.8, t)
    } else {
        0.0
    };
    (place, light, warmth)
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let [azimuth, elevation, distance, tx, ty, tz, height] =
        std::array::from_fn(|c| camera(c, time));
    let (sa, ca) = azimuth.to_radians().sin_cos();
    let (se, ce) = elevation.to_radians().sin_cos();
    let out = [sa * ce, se, ca * ce];
    let eye = [
        tx + distance * out[0],
        ty + distance * out[1],
        tz + distance * out[2],
    ];
    let forward = out.map(|v| -v);
    // Level with the floor however high the camera climbs.
    let right = [ca, 0.0, -sa];
    let up = cross(right, forward);

    let breathing = breath(time);
    let motes = std::array::from_fn(|k| {
        let (p, light, _) = mote(k, time);
        [p[0], p[1], p[2], light]
    });
    Frame {
        time,
        eye,
        right,
        up,
        forward,
        lens: (height.to_radians() * 0.5).tan(),
        level: level(time) + breathing,
        low: low(time),
        fill: window(time, FILL),
        cool: smooth(COOL[0], COOL[1], time) * (1.0 - smooth(RESET[0], RESET[1], time)),
        heavy: window(time, HEAVY),
        contact: window(time, CONTACT),
        support: window(time, SUPPORT),
        line: 1.0 + 1.4 * breathing / BREATH_RISE,
        reach: ROOT_REACH
            * smooth(ROOTS[0], ROOTS[1], time)
            * (1.0 - smooth(RESET[0], RESET[1], time)),
        roots: window(time, ROOTS),
        motes,
        warmth: std::array::from_fn(|k| mote(k, time).2),
    }
}

/// Where a world point lands in the 3:2 frame, -1..1 both ways; None behind
/// the camera.
pub fn project(f: &Frame, point: [f32; 3]) -> Option<[f32; 2]> {
    let v = [0, 1, 2].map(|i| point[i] - f.eye[i]);
    let z = dot(v, f.forward);
    (z > 0.0).then(|| {
        [
            dot(v, f.right) / (z * f.lens * FRAME_ASPECT),
            dot(v, f.up) / (z * f.lens),
        ]
    })
}

/// The scene's three lights in a theme's colors: the cold glass and
/// thought, the warm light that fills the body, and the pale of highlights.
/// The page itself comes from the app (`backdrop`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub cold: [f32; 3],
    pub warm: [f32; 3],
    pub pale: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

/// The app theme by its `graphicsPalette` code (0 Искра, 2 Тишина, 3 Астрал,
/// 4 Матрица). The cold light is the theme's accent; the warm one is a
/// second tone that stays apart from it. The site shows only the dark
/// themes; the retired light codes fall back to Тишина.
pub fn look(code: u32) -> Look {
    match Palette::from_code(code) {
        // Искра: the yellow of the theme, an ember inside.
        Palette::Dark => Look {
            cold: rgb(245, 221, 7),
            warm: rgb(255, 122, 40),
            pale: rgb(255, 244, 170),
        },
        // Астрал: the blue of the theme, a rose-peach inside.
        Palette::Violet => Look {
            cold: rgb(98, 150, 245),
            warm: rgb(240, 158, 128),
            pale: rgb(200, 212, 248),
        },
        // Матрица: code green, amber inside.
        Palette::Matrix => Look {
            cold: rgb(0, 255, 65),
            warm: rgb(255, 184, 64),
            pale: rgb(190, 255, 205),
        },
        // Тишина: sea glass, warm sand inside.
        _ => Look {
            cold: rgb(134, 201, 199),
            warm: rgb(242, 179, 117),
            pale: rgb(214, 218, 210),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::body::{chair, figure};

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    fn every(step: f32, mut check: impl FnMut(f32)) {
        let mut t = 0.0;
        while t < LOOP_SECONDS {
            check(t);
            t += step;
        }
    }

    /// The crown, both soles, both hands, the knees, the chair's back top.
    const BODY: [[f32; 3]; 8] = [
        [0.0, 1.43, -0.02],
        [0.126, 0.02, 0.64],
        [-0.126, 0.02, 0.64],
        [0.17, 0.63, 0.36],
        [-0.17, 0.63, 0.36],
        [0.115, 0.55, 0.5],
        [-0.115, 0.55, 0.5],
        [0.0, 0.96, -0.17],
    ];

    #[test]
    fn the_loop_closes_without_a_jump() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
        let before = compose(LOOP_SECONDS - 0.001);
        let after = compose(0.001);
        for i in 0..3 {
            assert!(close(before.eye[i], after.eye[i], 1e-3), "{i}");
            assert!(close(before.forward[i], after.forward[i], 1e-3), "{i}");
        }
        assert!(close(before.lens, after.lens, 1e-4));
        for k in 0..MOTES {
            for c in 0..4 {
                assert!(
                    close(before.motes[k][c], after.motes[k][c], 1e-3),
                    "{k} {c}"
                );
            }
            assert!(close(before.warmth[k], after.warmth[k], 1e-3));
        }
        // Across the seam the vessel is empty and cold: no light, no roots,
        // only the glints in the head.
        for f in [before, after] {
            assert!(f.fill == 0.0 && f.level == 0.0 && f.low == 0.0, "{f:?}");
            assert!(f.cool == 0.0 && f.reach == 0.0 && f.roots == 0.0, "{f:?}");
            assert!(f.heavy == 0.0 && f.contact == 0.0 && f.support == 0.0);
            assert!(f.motes.iter().all(|m| m[3] == 1.0));
            assert!(f.warmth.iter().all(|&w| w == 0.0));
        }
    }

    #[test]
    fn the_light_rises_from_the_feet_to_the_crown_word_by_word() {
        // Never falls while it fills (the breath is apart).
        let mut last = 0.0;
        every(0.01, |t| {
            if t < RESET[0] {
                let now = level(t);
                assert!(now >= last - 1e-6, "{t}: {now} < {last}");
                last = now;
            }
        });
        // Nothing is lit before the glints reach the soles.
        assert!(level(LEVEL[0].0) == 0.0);
        let arrive = SINK + SINK_GAP * (MOTES - 1) as f32 + SINK_SECONDS;
        assert!(arrive < LEVEL[0].0 + 0.5 && arrive > LEVEL[0].0);
        // «стопы»: the feet and no higher than the ankles.
        let feet = level(LEVEL[1].0);
        assert!(figure([0.126, feet - 0.05, 0.55]) < 0.0 && feet < 0.15);
        // «ноги»: the thighs on the seat are under it, the belly is not.
        let legs = level(LEVEL[2].0);
        assert!(legs > 0.6 && legs < 0.72);
        // «корпус»: up to the shoulders, the head still empty.
        let trunk = level(LEVEL[3].0);
        assert!(trunk > 1.05 && trunk < 1.15 && figure([0.0, trunk + 0.1, -0.03]) < 0.0);
        // «внутренний объем тела»: over the crown.
        assert!(level(LEVEL[5].0) > 1.43 + 0.05);
        // «дыхание»: two breaths, then still.
        let mut peaks = 0;
        let mut was = 0.0;
        let mut rising = false;
        every(0.01, |t| {
            let b = breath(t);
            if b < was && rising {
                peaks += 1;
            }
            rising = b > was;
            was = b;
        });
        assert_eq!(peaks, 2);
        // Through the drain the bottom rises to the neck and the light turns
        // cold in the head before it breaks up.
        assert!(close(low(DRAIN[1]), NECK, 1e-4) && low(DRAIN[0]) == 0.0);
        assert!(compose(FILL[2]).cool > 0.7 && compose(FILL[2]).fill > 0.99);
        // Everything is back at zero only while nothing shows.
        every(0.01, |t| {
            if (RESET[0]..RESET[1]).contains(&t) {
                assert!(compose(t).fill == 0.0, "{t}");
            }
        });
    }

    #[test]
    fn the_glints_drift_in_the_head_and_sink_inside_the_body() {
        every(0.01, |t| {
            for k in 0..MOTES {
                let (p, light, warmth) = mote(k, t);
                assert!((0.0..=1.0).contains(&light) && (0.0..=1.0).contains(&warmth));
                if light > 0.01 {
                    assert!(figure(p) < -0.01, "{k} at {t}: {p:?} {}", figure(p));
                }
            }
        });
        // In the head at the start, at the soles on arrival.
        for k in 0..MOTES {
            let (p, _, _) = mote(k, 0.0);
            assert!(distance(p, HEAD) < 0.07);
            let start = SINK + SINK_GAP * k as f32;
            let (q, light, warmth) = mote(k, start + SINK_SECONDS);
            assert!(q[1] < 0.05 && light > 0.8 && warmth > 0.99, "{k}: {q:?}");
        }
    }

    #[test]
    fn the_camera_stays_outside_the_body_and_keeps_the_person_in_frame() {
        every(0.02, |t| {
            let f = compose(t);
            assert!(f.eye[1] > 0.12, "{t}: {:?}", f.eye);
            assert!(figure(f.eye) > 0.6 && chair(f.eye) > 0.6, "{t}");
            // The head is always in the frame, clear of its soft edges.
            for p in [BODY[0], HEAD] {
                let s = project(&f, p).unwrap();
                assert!(
                    s[0].abs() < 0.85 && s[1] < 0.8 && s[1] > -0.75,
                    "{t}: {s:?}"
                );
            }
            // While the light fills the body and goes into the floor, all of
            // the person is in it (but for the trunk and the breath, closer).
            if (7.5..12.5).contains(&t) || (21.5..40.3).contains(&t) {
                for p in BODY {
                    let s = project(&f, p).unwrap();
                    assert!(s[0].abs() < 0.85 && s[1].abs() < 0.8, "{t}: {p:?} {s:?}");
                }
            }
        });
    }

    #[test]
    fn the_motion_is_smooth() {
        let step = 1.0 / 60.0;
        every(step, |t| {
            let (a, b) = (compose(t), compose(t + step));
            assert!(distance(a.eye, b.eye) < 0.03, "{t}");
            assert!(distance(a.forward, b.forward) < 0.02, "{t}");
            // The levels go back to 0 quicker, but only while nothing shows.
            if a.fill > 0.0 {
                assert!((a.level - b.level).abs() < 0.012, "{t}");
                assert!((a.low - b.low).abs() < 0.012, "{t}");
            }
            for k in 0..MOTES {
                let (p, q) = (a.motes[k], b.motes[k]);
                if p[3] > 0.01 {
                    assert!(
                        distance([p[0], p[1], p[2]], [q[0], q[1], q[2]]) < 0.03,
                        "{t}"
                    );
                }
            }
        });
    }

    #[test]
    fn the_still_frame_holds_the_full_body_and_its_roots() {
        let f = compose(STILL);
        assert!(f.level > 1.45 && f.low == 0.0 && f.fill == 1.0 && f.cool == 0.0);
        assert!(f.reach > 0.8 * ROOT_REACH && f.roots == 1.0);
        assert!(f.motes.iter().all(|m| m[3] == 0.0));
    }

    #[test]
    fn every_dark_theme_has_its_own_cold_and_warm() {
        let codes = [0, 2, 3, 4];
        for (i, &a) in codes.iter().enumerate() {
            let l = look(a);
            assert!(distance(l.cold, l.warm) > 0.3, "{a}");
            for &b in &codes[i + 1..] {
                assert_ne!(look(a), look(b));
            }
        }
        for retired in [1, 5, 6] {
            assert_eq!(look(retired), look(2));
        }
    }
}
