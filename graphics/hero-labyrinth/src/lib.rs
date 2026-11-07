//! «Лабиринт»: Step 2 «Главный герой», the closing page 3/3:
//! «Главный Герой не может выйти из своей книги — потому что Он воплощение
//! Намерения Автора, Он — его сон и Он — его Пробуждение. Абсолют — Автор,
//! проживая забвение Себя, вспоминает Истинную Природу Себя через Путь и
//! Жизнь Главного Героя.»
//!
//! A stone labyrinth at night, one path from the entrance to the centre.
//! First we walk it ourselves, at eye height between high curved walls, a
//! lantern's light on the stone, a strip of stars above, a dead end and a
//! narrow turn. Then the eye rises out of the corridor until the whole plan
//! lies below and we are a point of light in it. The light runs the rest of
//! the path, every turn of it, and the groove it leaves glows. At the centre
//! the light rises into a figure of light, the hero. The figure flares, a
//! ring of light runs out from it and the walls break block by block, lift
//! and burn away to dust: only the foundations stay, with the path drawn
//! in light on the ground. The scene goes back into the night and the walk
//! begins again.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time. The browser adapter only uploads the values and the shaders only
//! paint them.
#[cfg(target_arch = "wasm32")]
mod browser;

use std::f32::consts::{FRAC_PI_2, PI, TAU};
use watcher_scene_palette::Palette;

/// The plate of the Step 2 closing art, 288 : 210, at every width.
pub const ASPECT: f32 = 288.0 / 210.0;
pub const LOOP_SECONDS: f32 = 50.0;
/// Reduced motion: the walls fallen, the path alight, the figure standing.
pub const STILL: f32 = 43.0;

// The labyrinth, in units of its outer radius.
pub const RINGS: usize = 6;
/// Radius of the open court in the middle.
pub const COURT: f32 = 0.22;
pub const OUTER: f32 = 1.0;
/// Distance between neighbouring walls.
pub const RING: f32 = (OUTER - COURT) / RINGS as f32;
/// Half the thickness of a wall.
pub const WALL: f32 = 0.012;
pub const HEIGHT: f32 = 0.085;
/// Half the width of a doorway.
pub const GAP: f32 = 0.05;
/// The doorways sit right beside the axis wall, centred this far from it.
pub const DOOR: f32 = WALL + GAP;
/// The path starts this far outside the outer wall.
pub const ENTRANCE: f32 = 0.38;
/// Wall blocks are this long.
pub const BLOCK: f32 = 0.07;
/// Eye height of the walk, about half the wall.
pub const EYE: f32 = 0.042;
/// The figure of light, feet on the court's floor.
pub const FIGURE: f32 = 0.24;

// The timeline.
pub const FADE_IN: f32 = 1.4;
pub const WALK_SPEED: f32 = 0.055;
/// Seconds into the walk when the walker is in the hairpin doorway.
pub const HAIRPIN_AT: f32 = 6.5;
/// The eye leaves the corridor and rises over the plan.
pub const RISE: [f32; 2] = [12.5, 18.5];
/// The light runs the rest of the path.
pub const RUN: [f32; 2] = [16.0, 30.0];
/// The light rises and becomes the figure.
pub const FORM: [f32; 2] = [31.0, 34.0];
/// From the plan down to the court.
pub const DESCEND: [f32; 2] = [29.0, 34.0];
/// The walls break from the court outwards.
pub const BREAK: f32 = 35.0;
pub const WAVE_SPEED: f32 = 0.45;
/// Each block breaks up to this much later than the wave reaches it.
pub const JITTER: f32 = 0.45;
/// A block lifts and burns away in this long.
pub const DISSOLVE: f32 = 1.9;
/// The broken top of a wall rises up to this high while it burns.
pub const LIFT: f32 = 0.3;
/// The camera pulls back while the walls fall.
pub const PULL: [f32; 2] = [34.5, 39.8];
pub const FADE_OUT: [f32; 2] = [46.5, 49.4];

pub fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
/// Quintic ease: still at both ends.
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
fn distance2(a: [f32; 2], b: [f32; 2]) -> f32 {
    ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2)).sqrt()
}

/// The centre line of corridor `j`, 0 the outermost.
pub fn corridor(j: usize) -> f32 {
    OUTER - (j as f32 + 0.5) * RING
}
/// The x of the doorway at the end of corridor `j`: the path turns inwards
/// beside the axis wall, on its left after an even corridor (walked
/// anticlockwise), on its right after an odd one (walked clockwise).
fn side(j: usize) -> f32 {
    if j.is_multiple_of(2) {
        -1.0
    } else {
        1.0
    }
}
/// Where corridor `j`'s centre line crosses the doorway lines x = ±DOOR.
fn foot(j: usize) -> f32 {
    -(corridor(j).powi(2) - DOOR * DOOR).sqrt()
}

/// One stretch of the path on the ground plane (x, z).
#[derive(Clone, Copy, Debug)]
pub enum Piece {
    Line { a: [f32; 2], b: [f32; 2] },
    Arc { r: f32, from: f32, to: f32 },
}
impl Piece {
    pub fn length(&self) -> f32 {
        match *self {
            Piece::Line { a, b } => distance2(a, b),
            Piece::Arc { r, from, to } => r * (to - from).abs(),
        }
    }
    /// The point `u` along the piece, 0 ≤ u ≤ length.
    fn at(&self, u: f32) -> [f32; 2] {
        match *self {
            Piece::Line { a, b } => {
                let k = (u / self.length().max(1e-6)).clamp(0.0, 1.0);
                [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]
            }
            Piece::Arc { r, from, to } => {
                let a = from + (to - from).signum() * u.clamp(0.0, self.length()) / r;
                [r * a.cos(), r * a.sin()]
            }
        }
    }
}

pub const PIECES: usize = 2 * RINGS + 2;
/// The last doorway runs this far into the court before the path turns to
/// its centre.
pub const LANDING: f32 = COURT - 0.07;
/// The entrance, then each corridor and the doorway out of it; the last
/// doorway leads into the court, and a last stretch to its centre.
pub fn pieces() -> [Piece; PIECES] {
    let mut out = [Piece::Line {
        a: [0.0; 2],
        b: [0.0; 2],
    }; PIECES];
    out[0] = Piece::Line {
        a: [DOOR, -(OUTER + ENTRANCE)],
        b: [DOOR, foot(0)],
    };
    for j in 0..RINGS {
        let r = corridor(j);
        let phi = (DOOR / r).asin();
        let (from, to) = if j.is_multiple_of(2) {
            (-FRAC_PI_2 + phi, 1.5 * PI - phi)
        } else {
            (1.5 * PI - phi, -FRAC_PI_2 + phi)
        };
        out[1 + 2 * j] = Piece::Arc { r, from, to };
        let x = side(j) * DOOR;
        out[2 + 2 * j] = Piece::Line {
            a: [x, foot(j)],
            b: [x, if j + 1 < RINGS { foot(j + 1) } else { -LANDING }],
        };
    }
    out[PIECES - 1] = Piece::Line {
        a: [side(RINGS - 1) * DOOR, -LANDING],
        b: [0.0, 0.0],
    };
    out
}
/// The length of the path before each piece, and all of it last: the
/// shader's `u_pieces`.
pub fn starts() -> [f32; PIECES + 1] {
    let mut out = [0.0; PIECES + 1];
    for (i, piece) in pieces().iter().enumerate() {
        out[i + 1] = out[i] + piece.length();
    }
    out
}
pub fn path_length() -> f32 {
    pieces().iter().map(Piece::length).sum()
}
/// The point `s` along the path.
pub fn point(s: f32) -> [f32; 2] {
    let mut s = s.max(0.0);
    let p = pieces();
    for piece in &p[..PIECES - 1] {
        let l = piece.length();
        if s <= l {
            return piece.at(s);
        }
        s -= l;
    }
    p[PIECES - 1].at(s)
}
/// Where the path turns into the doorway out of corridor 0.
pub fn hairpin() -> f32 {
    let p = pieces();
    p[0].length() + p[1].length()
}

/// The walls seen from above: signed distance to the stone (negative in it),
/// the same function as `wall2` in the scene shader.
pub fn wall(p: [f32; 2]) -> f32 {
    let r = (p[0] * p[0] + p[1] * p[1]).sqrt();
    let k = ((r - COURT) / RING).round().clamp(0.0, RINGS as f32);
    let mut d = (r - (COURT + k * RING)).abs() - WALL;
    // Every second wall has its doorway on the other side of the axis.
    let door = if (k as usize).is_multiple_of(2) {
        DOOR
    } else {
        -DOOR
    };
    if p[1] < 0.0 {
        d = d.max(GAP - (p[0] - door).abs());
    }
    let axis = distance2(p, [0.0, p[1].clamp(-OUTER, -COURT)]) - WALL;
    d.min(axis)
}

/// The lens: where it is, what it looks at and how long it is (the screen's
/// half height is 0.5 at `zoom` = 1 unit away).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Camera {
    pub eye: [f32; 3],
    pub target: [f32; 3],
    pub zoom: f32,
}
impl Camera {
    pub fn basis(&self) -> [[f32; 3]; 3] {
        let fw = normalize(sub(self.target, self.eye));
        let rt = normalize(cross(fw, [0.0, 1.0, 0.0]));
        let up = cross(rt, fw);
        [fw, rt, up]
    }
    /// A point on the screen, x in ±ASPECT / 2 and y in ±1 / 2, y up.
    pub fn project(&self, p: [f32; 3]) -> Option<[f32; 2]> {
        let [fw, rt, up] = self.basis();
        let v = sub(p, self.eye);
        let z = dot(v, fw);
        if z < 0.01 {
            return None;
        }
        Some([dot(v, rt) * self.zoom / z, dot(v, up) * self.zoom / z])
    }
}

/// How far along the path the walker (and the lit groove) is.
pub fn walker(t: f32) -> f32 {
    let start = hairpin() + 0.5 * RING - WALK_SPEED * HAIRPIN_AT;
    let walked = start + WALK_SPEED * t.min(RUN[0]);
    if t <= RUN[0] {
        return walked;
    }
    let span = RUN[1] - RUN[0];
    let rest = path_length() - walked - WALK_SPEED * span;
    (walked + WALK_SPEED * (t - RUN[0]).min(span) + rest * smooth(RUN[0], RUN[1], t))
        .min(path_length())
}

/// Where the eye is along the path: with the walker, then, as it rises,
/// slowing to a stop while the light walks on.
fn gaze(t: f32) -> (f32, f32) {
    if t <= RISE[0] {
        return (walker(t), 1.0);
    }
    let span = RISE[1] - RISE[0];
    let k = ((t - RISE[0]) / span).min(1.0);
    (
        walker(RISE[0]) + WALK_SPEED * span * (k - 0.5 * k * k),
        1.0 - k,
    )
}

/// The walk at eye height: the eye on the path, its corners eased, looking
/// a little ahead along it; a slight step in the gait.
fn walking(t: f32) -> Camera {
    let (s, gait) = gaze(t);
    let eye = [-0.035, 0.0, 0.035]
        .iter()
        .map(|d| point(s + d))
        .fold([0.0; 2], |a, p| [a[0] + p[0] / 3.0, a[1] + p[1] / 3.0]);
    let ahead = [0.04, 0.075, 0.11, 0.15]
        .iter()
        .map(|d| point(s + d))
        .fold([0.0; 2], |a, p| [a[0] + p[0] / 4.0, a[1] + p[1] / 4.0]);
    let step = (TAU * 1.7 * t).sin() * gait;
    Camera {
        eye: [eye[0], EYE + 0.0009 * step, eye[1]],
        target: [ahead[0], EYE * 0.93 + 0.0005 * step, ahead[1]],
        zoom: 0.72,
    }
}

#[derive(Clone, Copy, Debug)]
struct Shot {
    eye: [f32; 3],
    target: [f32; 3],
    zoom: f32,
}
const TOP: Shot = Shot {
    eye: [0.0, 2.9, -0.62],
    target: [0.0, 0.0, 0.05],
    zoom: 1.18,
};
const LOW: Shot = Shot {
    eye: [0.06, 0.34, -1.0],
    target: [0.0, 0.125, 0.0],
    zoom: 1.25,
};
const WIDE: Shot = Shot {
    eye: [0.0, 1.3, -2.3],
    target: [0.0, 0.02, -0.04],
    zoom: 1.22,
};
const NEAR: Shot = Shot {
    eye: [0.0, 0.46, -1.02],
    target: [0.0, 0.085, -0.03],
    zoom: 1.22,
};
/// The slow turn of every shot after the walk, about the centre.
fn yaw(t: f32) -> f32 {
    0.4 * (t - RISE[0]).max(0.0) / (LOOP_SECONDS - RISE[0])
}
fn turned(s: Shot, t: f32) -> Camera {
    let (sin, cos) = yaw(t).sin_cos();
    let spin = |p: [f32; 3]| [p[0] * cos - p[2] * sin, p[1], p[0] * sin + p[2] * cos];
    Camera {
        eye: spin(s.eye),
        target: spin(s.target),
        zoom: s.zoom,
    }
}
fn shot(a: Shot, b: Shot, k: f32) -> Shot {
    Shot {
        eye: lerp3(a.eye, b.eye, k),
        target: lerp3(a.target, b.target, k),
        zoom: lerp(a.zoom, b.zoom, k),
    }
}

pub fn camera(t: f32) -> Camera {
    if t < RISE[0] {
        return walking(t);
    }
    if t < RISE[1] {
        // Up out of the corridor first, then over the plan, so the eye
        // never passes through a wall.
        let k = (t - RISE[0]) / (RISE[1] - RISE[0]);
        let (from, to) = (walking(t), turned(TOP, t));
        let up = 1.0 - (1.0 - ease(k)).powi(2);
        let over = ease(k).powi(2);
        return Camera {
            eye: [
                lerp(from.eye[0], to.eye[0], over),
                lerp(from.eye[1], to.eye[1], up),
                lerp(from.eye[2], to.eye[2], over),
            ],
            target: lerp3(from.target, to.target, ease(k)),
            zoom: lerp(from.zoom, to.zoom, ease(k)),
        };
    }
    let s = if t < DESCEND[0] {
        TOP
    } else if t < PULL[0] {
        shot(TOP, LOW, ease((t - DESCEND[0]) / (DESCEND[1] - DESCEND[0])))
    } else if t < PULL[1] {
        shot(LOW, WIDE, ease((t - PULL[0]) / (PULL[1] - PULL[0])))
    } else if t < STILL + 0.5 {
        // In to the figure, settled by the still frame.
        shot(WIDE, NEAR, ease((t - PULL[1]) / (STILL + 0.5 - PULL[1])))
    } else {
        NEAR
    };
    turned(s, t)
}

/// Everything the shaders need for one moment.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// The walker's light: position and power.
    pub walker: [f32; 4],
    /// How far the groove is lit, where the night's haze begins, how much of
    /// a walk (1) or of a view from above (0) this is.
    pub trail: [f32; 3],
    /// The figure of light: how formed, how bright, its flare.
    pub figure: [f32; 3],
    /// Seconds since the walls began to break (negative before).
    pub wave: f32,
    /// The burning dust in the air and the dawn after.
    pub dust: f32,
    pub dawn: f32,
    /// How much of the scene shows through the night at the loop's seam.
    pub shown: f32,
}

pub fn compose(t: f32) -> Frame {
    let t = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let s = walker(t);
    let [x, z] = point(s);
    let rise = smooth(30.0, 32.6, t);
    let form = smooth(FORM[0], FORM[1], t);
    let flare = bell(t, BREAK - 0.5, BREAK + 0.2, BREAK + 1.4, BREAK + 4.5);
    let walk = 1.0 - smooth(RISE[0], RISE[0] + 3.0, t);
    let camera = camera(t);
    let reach = dot(
        sub(camera.target, camera.eye),
        sub(camera.target, camera.eye),
    )
    .sqrt();
    Frame {
        time: t,
        camera,
        walker: [
            x,
            0.03 + rise * FIGURE * 0.5,
            z,
            1.0 - 0.9 * smooth(FORM[0] + 0.6, FORM[1], t),
        ],
        trail: [s, lerp(reach - 0.4, 0.3, walk), walk],
        figure: [
            form,
            form * (0.75 + 0.25 * smooth(BREAK, BREAK + 3.0, t)),
            flare,
        ],
        wave: t - BREAK,
        dust: smooth(BREAK + 0.4, BREAK + 3.0, t) * (1.0 - smooth(FADE_OUT[0], FADE_OUT[1], t)),
        dawn: smooth(BREAK + 1.0, BREAK + 9.0, t) * (1.0 - smooth(FADE_OUT[0], FADE_OUT[1], t)),
        shown: smooth(0.0, FADE_IN, t) * (1.0 - smooth(FADE_OUT[0], FADE_OUT[1], t)),
    }
}

/// Colors of one theme.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// The night and the page.
    pub paper: [f32; 3],
    /// The stone's own color, lit.
    pub stone: [f32; 3],
    /// The cold light of the sky.
    pub moon: [f32; 3],
    /// The walker's and the figure's light.
    pub lamp: [f32; 3],
    /// The brightest core of that light.
    pub core: [f32; 3],
}
/// The app theme by its `graphicsPalette` code; the retired light codes
/// show Тишина.
pub fn look(code: u32) -> Look {
    let palette = match Palette::from_code(code) {
        p @ (Palette::Dark | Palette::Neutral | Palette::Violet | Palette::Matrix) => p,
        _ => Palette::Neutral,
    };
    let c = palette.colors().expect("dark palettes have colors");
    Look {
        paper: c.paper,
        stone: lerp3(lerp3(c.paper, c.highlight, 0.22), [0.5; 3], 0.12),
        moon: lerp3(c.highlight, [1.0; 3], 0.1),
        lamp: c.accent,
        core: lerp3(c.highlight, [1.0; 3], 0.4),
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

    #[test]
    fn the_path_is_one_unbroken_line() {
        let l = path_length();
        assert!(close(starts()[PIECES], l, 1e-4));
        let mut previous = point(0.0);
        let steps = 20_000;
        for i in 1..=steps {
            let p = point(l * i as f32 / steps as f32);
            assert!(
                distance2(p, previous) <= l / steps as f32 + 1e-4,
                "jump at {i}"
            );
            previous = p;
        }
        assert!(distance2(point(l), [0.0, 0.0]) < 1e-5);
        // Each corridor is walked once, from one side of the axis to the other.
        for j in 0..RINGS {
            let s = starts()[1 + 2 * j];
            assert!(close(
                distance2(point(s + 0.01), [0.0, 0.0]),
                corridor(j),
                1e-3
            ));
        }
    }

    #[test]
    fn the_path_never_touches_a_wall() {
        let l = path_length();
        for i in 0..=4000 {
            let s = l * i as f32 / 4000.0;
            assert!(wall(point(s)) > 0.035, "path in a wall at s = {s}");
        }
        // The eye of the walk keeps clear of the stone too.
        for t in times(0.02).take_while(|&t| t < RISE[0]) {
            let e = camera(t).eye;
            assert!(wall([e[0], e[2]]) > 0.03, "eye in a wall at {t}");
            assert!(e[1] < HEIGHT * 0.6);
        }
    }

    #[test]
    fn the_walls_close_every_other_way() {
        // Between neighbouring corridors there is stone everywhere except at
        // the one doorway of the path.
        for k in 0..=RINGS {
            let r = COURT + k as f32 * RING;
            let open: Vec<[f32; 2]> = (0..1440)
                .map(|i| i as f32 / 1440.0 * TAU)
                .map(|a| [r * a.cos(), r * a.sin()])
                .filter(|&p| wall(p) > 0.0)
                .collect();
            // One doorway, 2 GAP wide, by the axis on its own side.
            let door = if k.is_multiple_of(2) { DOOR } else { -DOOR };
            let expected = (((DOOR + GAP) / r).asin() - ((DOOR - GAP) / r).asin()) / TAU * 1440.0;
            assert!(
                close(open.len() as f32, expected, 3.0),
                "wall {k}: {}",
                open.len()
            );
            assert!(open.iter().all(|p| p[1] < 0.0 && (p[0] - door).abs() < GAP));
        }
        // The axis wall closes each corridor.
        for j in 0..RINGS {
            assert!(wall([0.0, -corridor(j)]) < 0.0);
        }
    }

    #[test]
    fn the_loop_has_no_seam() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        // The cut back to the walk is hidden in the night.
        for t in [0.0, 0.004, LOOP_SECONDS - 0.004] {
            assert!(compose(t).shown < 0.01);
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
            previous = c;
        }
    }

    #[test]
    fn values_stay_finite_and_bounded() {
        for t in times(0.01) {
            let f = compose(t);
            assert!(f
                .walker
                .iter()
                .chain(&f.trail)
                .chain(&f.figure)
                .all(|v| v.is_finite()));
            assert!((0.0..=path_length()).contains(&f.trail[0]));
            for v in [
                f.figure[0],
                f.figure[2],
                f.dust,
                f.dawn,
                f.shown,
                f.trail[2],
            ] {
                assert!((0.0..=1.0).contains(&v), "{v} at {t}");
            }
            assert!(f.camera.eye[1] > 0.03);
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
    }

    #[test]
    fn the_page_is_told_in_order() {
        let l = path_length();
        // The walk passes the hairpin doorway.
        assert!(walker(0.0) < hairpin() && walker(RISE[0]) > hairpin() + RING);
        // From above the whole labyrinth is in the frame.
        let top = camera(25.0);
        for a in 0..16 {
            let a = a as f32 / 16.0 * TAU;
            let q = top
                .project([OUTER * a.cos(), 0.0, OUTER * a.sin()])
                .unwrap();
            assert!(q[0].abs() < ASPECT * 0.5 - 0.02 && q[1].abs() < 0.48);
        }
        // The light reaches the centre, then the figure forms, then it breaks the walls.
        assert!(close(walker(RUN[1]), l, 1e-4));
        assert!(compose(FORM[1]).figure[0] > 0.99 && FORM[1] < BREAK);
        // The figure stands whole in the frame from the court to the end.
        for t in [DESCEND[1], BREAK, PULL[1], STILL, FADE_OUT[0]] {
            let c = camera(t);
            for y in [0.0, FIGURE] {
                let q = c.project([0.0, y, 0.0]).unwrap();
                assert!(
                    q[0].abs() < ASPECT * 0.5 - 0.05 && q[1].abs() < 0.45,
                    "figure at {t}"
                );
            }
        }
        // Every block has fallen well before the still (and so the fade).
        let last = (OUTER - COURT) / WAVE_SPEED + JITTER + DISSOLVE;
        assert!(BREAK + last < STILL - 2.0);
        assert!(compose(STILL).dust > 0.9 && compose(STILL).shown > 0.99);
    }

    #[test]
    fn every_dark_theme_has_its_own_light() {
        let codes = [0, 2, 3, 4];
        for (i, &a) in codes.iter().enumerate() {
            for &b in &codes[i + 1..] {
                assert_ne!(look(a).lamp, look(b).lamp);
            }
        }
        assert_eq!(look(1), look(2));
        assert_eq!(look(2).paper, Palette::Neutral.colors().unwrap().paper);
    }
}
