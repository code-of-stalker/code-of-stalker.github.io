//! «Простая практика»: Step 4, page 04/15. A person sits down into a stable
//! posture, lowers the eyes without closing them, feels the soles, the weight
//! of the legs, the contact with the floor and the support beneath it; then
//! the torso as mass, weight and volume, a form of Presence. Images rise from
//! the head and try to take the attention away; the camera's focus does not
//! follow them, the attention returns to the feet, and the person is here:
//! grounded, included, vigilant.
//!
//! Everything that moves is computed here, as pure functions of the loop
//! time: the camera and its focus, the light, the contact, the cross-sections
//! of the torso, the images and the attention. The browser adapter only
//! uploads the values and the shaders only paint them.
#[cfg(target_arch = "wasm32")]
mod browser;
pub mod geometry;

use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

/// Authored frame, 3 : 2 like the other Step 4 scenes.
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// One practice, from sitting down to being here: a seamless loop.
pub const LOOP_SECONDS: f32 = 44.0;
/// Reduced motion holds this moment: the person is here, everything is sharp.
pub const STILL: f32 = 38.6;

/// Metres per unit of the approved figure (spoken-thought-person.svg): 1.3 m
/// from the soles to the crown, as a seated adult.
pub const UNIT: f32 = 1.3 / 505.0;
/// Size of the figure's SVG in its own units.
pub const FIGURE_SVG: [f32; 2] = [335.0, 530.0];
/// The soles of the figure (and the chair's legs) stand on this SVG row.
pub const FLOOR_SVG: f32 = 518.6;
/// The SVG column placed at the world's x = 0.
pub const ORIGIN_SVG: f32 = 160.0;

/// A point of the figure in world metres (the figure stands in the plane z = 0).
pub const fn on_figure(x: f32, y: f32) -> [f32; 3] {
    [(x - ORIGIN_SVG) * UNIT, (FLOOR_SVG - y) * UNIT, 0.0]
}
/// World rectangle of the figure: left, bottom, right, top.
pub const FIGURE: [f32; 4] = [
    -ORIGIN_SVG * UNIT,
    (FLOOR_SVG - FIGURE_SVG[1]) * UNIT,
    (FIGURE_SVG[0] - ORIGIN_SVG) * UNIT,
    FLOOR_SVG * UNIT,
];
pub const EYE: [f32; 3] = on_figure(117.0, 56.0);
pub const JUGULAR: [f32; 3] = on_figure(101.0, 131.0);
pub const CHEST: [f32; 3] = on_figure(86.0, 185.0);
pub const BELLY: [f32; 3] = on_figure(88.0, 252.0);
pub const HIP: [f32; 3] = on_figure(132.0, 300.0);
pub const KNEE: [f32; 3] = on_figure(256.0, 312.0);
pub const ANKLE: [f32; 3] = on_figure(250.0, 468.0);
pub const HEEL: [f32; 3] = on_figure(234.0, FLOOR_SVG);
pub const BALL: [f32; 3] = on_figure(296.0, FLOOR_SVG);
pub const CHAIR_LEGS: [[f32; 3]; 2] = [on_figure(20.0, FLOOR_SVG), on_figure(176.0, FLOOR_SVG)];
/// Where the lowered eyes rest: the floor a little ahead of the toes.
pub const GAZE_FLOOR: [f32; 3] = [0.64, 0.0, -0.03];
/// Where they looked before: straight ahead into the room.
pub const GAZE_AHEAD: [f32; 3] = [EYE[0] + 2.1, EYE[1] + 0.02, 0.4];

/// Cross-sections of the torso measured on the figure's body mask:
/// SVG row, back x, front x (`tools/prepare-assets.mjs` draws the mask).
pub const TORSO: [[f32; 3]; 13] = [
    [135.0, 37.3, 106.0],
    [150.0, 31.3, 119.5],
    [165.0, 28.5, 128.0],
    [180.0, 29.0, 132.0],
    [195.0, 34.0, 131.0],
    [210.0, 36.5, 132.7],
    [225.0, 40.3, 132.7],
    [240.0, 44.3, 134.0],
    [255.0, 48.0, 134.5],
    [270.0, 49.3, 134.0],
    [285.0, 48.3, 133.0],
    [300.0, 44.3, 131.0],
    [315.0, 41.8, 128.0],
];
/// Back and front of the torso (SVG x) at an SVG row, inside the measured span.
pub fn torso_at(row: f32) -> Option<[f32; 2]> {
    let first = TORSO[0][0];
    let last = TORSO[TORSO.len() - 1][0];
    if !(first..=last).contains(&row) {
        return None;
    }
    let i = (((row - first) / 15.0) as usize).min(TORSO.len() - 2);
    let (a, b) = (TORSO[i], TORSO[i + 1]);
    let t = (row - a[0]) / (b[0] - a[0]);
    Some([a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
}
/// The torso's depth (front to back of the body, seen from above) relative
/// to its width in profile.
pub const TORSO_DEPTH: f32 = 0.78;

/// Edges of the inner light along the body (0 soles, 1 crown): in the
/// torso, in the head, and over the whole person.
pub const TORSO_FLOW: [f32; 2] = [0.48, 0.8];
pub const HEAD_FLOW: [f32; 2] = [0.83, 1.1];
pub const WHOLE_FLOW: [f32; 2] = [-0.12, 1.12];

pub fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
pub fn bell(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}
pub fn hash(n: u32) -> f32 {
    let mut x = n.wrapping_mul(0x9E37_79B9) ^ 0x85EB_CA6B;
    x ^= x >> 15;
    x = x.wrapping_mul(0x2C1B_3C6D);
    x ^= x >> 12;
    x = x.wrapping_mul(0x297A_2D39);
    x ^= x >> 15;
    (x & 0x00FF_FFFF) as f32 / 16_777_216.0
}
pub fn lerp3(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    std::array::from_fn(|i| a[i] + (b[i] - a[i]) * t)
}

/// A pinhole camera looking along +z with a real lens: `focus` is the
/// sharp distance and `aperture` the lens diameter in metres.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Camera {
    pub eye: [f32; 3],
    /// Focal length in authored px.
    pub focal: f32,
    /// Where the line of sight meets the frame (lens shift), authored px.
    pub center: [f32; 2],
    pub focus: f32,
    pub aperture: f32,
}
/// A projected point: authored px, px per metre at its depth, and the depth.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Projected {
    pub at: [f32; 2],
    pub scale: f32,
    pub depth: f32,
}
impl Camera {
    pub const NEAR: f32 = 0.08;
    pub fn project(&self, p: [f32; 3]) -> Option<Projected> {
        let depth = p[2] - self.eye[2];
        if depth < Self::NEAR {
            return None;
        }
        let scale = self.focal / depth;
        Some(Projected {
            at: [
                self.center[0] + (p[0] - self.eye[0]) * scale,
                self.center[1] - (p[1] - self.eye[1]) * scale,
            ],
            scale,
            depth,
        })
    }
    /// Radius of the circle of confusion (authored px) at a depth: thin lens.
    pub fn coc(&self, depth: f32) -> f32 {
        let depth = depth.max(Self::NEAR);
        0.5 * self.aperture * self.focal * (depth - self.focus).abs() / (depth * self.focus)
    }
    /// Distance from the lens to the figure's plane.
    pub fn subject(&self) -> f32 {
        -self.eye[2]
    }
}

/// One framing of the film.
#[derive(Clone, Copy, Debug, PartialEq)]
struct Shot {
    eye: [f32; 3],
    focal: f32,
    horizon: f32,
    aperture: f32,
}
const fn shot(eye: [f32; 3], focal: f32, horizon: f32, aperture: f32) -> Shot {
    Shot {
        eye,
        focal,
        horizon,
        aperture,
    }
}
/// The whole room and the seated person.
const WIDE: Shot = shot([0.08, 0.8, -3.9], 1450.0, 470.0, 0.03);
/// The camera's moves: each one starts, eases and arrives (start, end, shot).
const MOVES: [(f32, f32, Shot); 8] = [
    // «Опусти глаза вниз»: the face.
    (3.9, 6.1, shot([0.1, 1.1, -1.55], 1600.0, 470.0, 0.032)),
    // Down along the lowered gaze to the feet: «поставь ноги на пол».
    (8.3, 10.8, shot([0.3, 0.24, -1.25], 1650.0, 400.0, 0.04)),
    // Lower and closer: the contact, the support beneath.
    (14.0, 16.6, shot([0.26, 0.14, -1.02], 1650.0, 360.0, 0.046)),
    // Up to the torso, a little from above: mass, weight, volume.
    (17.6, 19.8, shot([-0.07, 1.3, -1.55], 1600.0, 40.0, 0.035)),
    // The head, where the images start.
    (27.2, 29.2, shot([0.0, 1.45, -1.9], 1500.0, 443.0, 0.03)),
    // Following the attention back down, pulling away.
    (32.6, 35.6, shot([0.08, 0.95, -2.8], 1450.0, 480.0, 0.02)),
    // Here: the whole room, everything sharp.
    (35.6, 38.2, shot([0.1, 0.8, -3.4], 1450.0, 470.0, 0.006)),
    (41.0, LOOP_SECONDS, WIDE),
];
fn blend(a: Shot, b: Shot, t: f32) -> Shot {
    Shot {
        eye: lerp3(a.eye, b.eye, t),
        focal: a.focal + (b.focal - a.focal) * t,
        horizon: a.horizon + (b.horizon - a.horizon) * t,
        aperture: a.aperture + (b.aperture - a.aperture) * t,
    }
}

/// The camera at a loop time. Moves ease in and out; a slow breathing drift
/// (periodic in the loop) keeps the frame alive between them. The focus
/// follows the person, except at the start and the end of the loop (the room
/// comes out of blur and returns to it) and when the images rise: it slips
/// after them for a moment, then is pulled back to the body.
pub fn camera(time: f32) -> Camera {
    let mut s = WIDE;
    for (start, end, next) in MOVES {
        if time >= end {
            s = next;
        } else if time > start {
            let p = smooth(start, end, time);
            s = blend(s, next, p);
            break;
        } else {
            break;
        }
    }
    let w = time / LOOP_SECONDS * TAU;
    let drift = [
        0.012 * (2.0 * w).sin() + 0.006 * (5.0 * w).sin(),
        0.008 * (3.0 * w).sin(),
        0.02 * (2.0 * w).cos() - 0.02,
    ];
    let eye = [
        s.eye[0] + drift[0],
        s.eye[1] + drift[1],
        s.eye[2] + drift[2],
    ];
    let subject = -eye[2];
    let blur = 1.4 * (1.0 - smooth(0.3, 2.9, time)) + 1.4 * smooth(41.3, LOOP_SECONDS, time);
    let tempted = 0.55 * bell(time, 29.8, 31.4, 31.8, 32.9);
    Camera {
        eye,
        focal: s.focal,
        center: [SIZE[0] * 0.5, s.horizon],
        focus: subject * (1.0 + blur) + tempted,
        aperture: s.aperture * (1.0 + 0.6 * blur.min(1.0)),
    }
}

/// A ring of contact spreading over the floor from where the body rests.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Ring {
    pub origin: [f32; 3],
    pub radius: f32,
    pub strength: f32,
}
/// How fast contact rings spread (m/s) and how long they live (s).
pub const RING_SPEED: f32 = 0.5;
pub const RING_LIFE: f32 = 3.4;
/// Pulses of contact: start time, strength, whether the chair joins.
const PULSES: [(f32, f32, bool); 9] = [
    (3.55, 0.55, true),
    (11.6, 0.9, false),
    (13.2, 0.8, false),
    (14.8, 0.75, false),
    (16.4, 0.7, false),
    (35.3, 1.0, false),
    (37.3, 0.55, false),
    (39.3, 0.4, false),
    (41.3, 0.28, false),
];

/// The flight of the attention: it leaves through the eyes, follows the
/// images up, hesitates, comes back and descends through the body to the
/// soles. (time, point)
pub const MOTE_PATH: [(f32, [f32; 3]); 12] = [
    (29.6, EYE),
    (30.4, [EYE[0] + 0.05, EYE[1] + 0.22, 0.25]),
    (31.2, [EYE[0] + 0.24, EYE[1] + 0.44, 0.7]),
    (31.9, [EYE[0] + 0.21, EYE[1] + 0.47, 0.75]),
    (32.6, [EYE[0] + 0.02, EYE[1] + 0.02, 0.0]),
    (33.1, JUGULAR),
    (33.55, CHEST),
    (33.95, BELLY),
    (34.35, HIP),
    (34.75, KNEE),
    (35.1, ANKLE),
    (35.35, [(HEEL[0] + BALL[0]) * 0.5, 0.01, 0.0]),
];
fn along(path: &[(f32, [f32; 3])], t: f32) -> [f32; 3] {
    if t <= path[0].0 {
        return path[0].1;
    }
    for pair in path.windows(2) {
        let ((ta, a), (tb, b)) = (pair[0], pair[1]);
        if t <= tb {
            let u = (t - ta) / (tb - ta);
            // Eased inside each leg, so the light breathes rather than ticks.
            return lerp3(a, b, u * u * (3.0 - 2.0 * u));
        }
    }
    path[path.len() - 1].1
}

/// Where the attention is at a loop time (for its trail).
pub fn compose_mote(seconds: f32) -> [f32; 3] {
    along(&MOTE_PATH, seconds.rem_euclid(LOOP_SECONDS))
}

/// All motion of one instant.
#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// Exposure of the room: low at the loop seam, full while practising.
    pub light: f32,
    /// The scattered copies of the person: 0 collected into one posture.
    pub scatter: f32,
    /// 0 looking ahead, 1 the eyes lowered to the floor.
    pub gaze: f32,
    /// How visible the line of the gaze is.
    pub gaze_light: f32,
    /// The glint of the open eye.
    pub eye: f32,
    /// Feeling of the soles.
    pub soles: f32,
    /// Weight flowing down the legs.
    pub weight: f32,
    pub rings: Vec<Ring>,
    /// Layers of support beneath the floor.
    pub support: f32,
    /// Cross-sections travel down the torso: progress 0..1 and visibility.
    pub scan: f32,
    pub scan_light: f32,
    /// Particles of mass inside the torso and how far they have settled.
    pub mass: f32,
    pub settled: f32,
    /// The even inner light of the body: the form of Presence.
    pub presence: f32,
    /// Where that light is along the body, from the soles (0) to the crown
    /// (1): its lower and upper edge and how fast it is flowing.
    pub flow: [f32; 3],
    /// Strength of the figure's contour.
    pub contour: f32,
    /// Images rising from the head: progress, visibility, and their retreat.
    pub images: f32,
    pub images_light: f32,
    pub retreat: f32,
    /// Threads from the head to the images, and how far they have snapped.
    pub threads: f32,
    pub snap: f32,
    /// The attention: where it is and how bright.
    pub mote: [f32; 3],
    pub mote_light: f32,
    pub breath: f32,
    /// Movement of the air's dust (stillness at the end).
    pub stir: f32,
}

/// The whole choreography at `seconds` (wrapped to the loop).
pub fn compose(seconds: f32) -> Frame {
    let t = if seconds.is_finite() {
        seconds.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let fade = 1.0 - smooth(41.3, LOOP_SECONDS, t);
    let mut rings = Vec::with_capacity(PULSES.len() * 4);
    for (start, strength, chair) in PULSES {
        // The ring of the last pulse still spreads across the seam.
        for age in [t - start, t + LOOP_SECONDS - start] {
            if age <= 0.0 || age >= RING_LIFE {
                continue;
            }
            let k = strength * smooth(0.0, 0.18, age) * (1.0 - age / RING_LIFE).powf(1.5);
            let origins: &[[f32; 3]] = if chair {
                &[HEEL, BALL, CHAIR_LEGS[0], CHAIR_LEGS[1]]
            } else {
                &[HEEL, BALL]
            };
            for (i, o) in origins.iter().enumerate() {
                rings.push(Ring {
                    origin: *o,
                    radius: 0.03 + age * RING_SPEED,
                    strength: if i < 2 { k } else { 0.55 * k },
                });
            }
        }
    }
    let escape = bell(t, 29.4, 30.8, 32.2, 33.6);
    // The light gathers in the torso, flows up into the head when the images
    // call, comes back down, and at the end fills the whole person.
    let presence = smooth(23.6, 26.0, t) * (1.0 - 0.12 * escape) * fade;
    let flow = [
        TORSO_FLOW[0] + (HEAD_FLOW[0] - TORSO_FLOW[0]) * smooth(28.0, 29.6, t)
            - (HEAD_FLOW[0] - TORSO_FLOW[0]) * smooth(32.6, 33.9, t)
            - (TORSO_FLOW[0] - WHOLE_FLOW[0]) * smooth(34.6, 37.6, t),
        TORSO_FLOW[1] + (HEAD_FLOW[1] - TORSO_FLOW[1]) * smooth(27.6, 28.8, t)
            - (HEAD_FLOW[1] - TORSO_FLOW[1]) * smooth(33.0, 34.3, t)
            + (WHOLE_FLOW[1] - TORSO_FLOW[1]) * smooth(35.0, 37.2, t),
        bell(t, 27.6, 28.3, 29.0, 29.8)
            + bell(t, 32.6, 33.1, 33.8, 34.4)
            + 0.8 * bell(t, 34.6, 35.4, 36.8, 37.8),
    ];
    let arrival = bell(t, 35.0, 35.5, 36.2, 37.8);
    Frame {
        time: t,
        camera: camera(t),
        light: 0.34 + 0.66 * smooth(0.0, 2.6, t) - 0.66 * smooth(41.3, LOOP_SECONDS, t),
        scatter: bell(t, 0.2, 1.4, 1.8, 4.0),
        gaze: 1.0 - bell(t, 0.3, 1.8, 6.2, 8.4),
        gaze_light: 0.18 + 0.82 * bell(t, 5.8, 6.6, 9.6, 11.6),
        eye: 0.45 + 0.55 * bell(t, 4.4, 5.8, 9.2, 10.6) + 0.4 * bell(t, 36.0, 37.6, 41.0, 43.4),
        soles: (0.4 * bell(t, 3.3, 3.8, 4.4, 5.8)
            + 0.38 * smooth(10.4, 11.6, t)
            + 0.62 * bell(t, 10.4, 11.4, 13.0, 15.6)
            + 0.6 * arrival)
            * fade,
        weight: bell(t, 11.0, 12.2, 15.2, 16.8),
        rings,
        support: bell(t, 14.4, 16.2, 18.2, 19.8) + 0.14 * smooth(16.0, 18.0, t) * fade,
        scan: smooth(19.6, 23.6, t),
        scan_light: bell(t, 19.4, 19.9, 25.8, 27.8),
        mass: bell(t, 20.2, 21.4, 25.0, 27.6),
        settled: smooth(21.2, 25.2, t),
        presence,
        flow,
        contour: 0.45 + 0.27 * smooth(0.4, 2.6, t) + 0.28 * smooth(23.6, 26.0, t)
            - 0.3 * escape
            - 0.55 * smooth(41.3, LOOP_SECONDS, t),
        images: smooth(28.4, 31.6, t),
        images_light: bell(t, 28.2, 29.3, 32.4, 34.4),
        retreat: smooth(31.8, 34.2, t),
        threads: bell(t, 28.8, 29.8, 31.9, 32.05),
        snap: smooth(31.9, 32.8, t),
        mote: along(&MOTE_PATH, t),
        mote_light: bell(t, 29.4, 29.9, 35.2, 35.8),
        breath: 0.5 - 0.5 * (t / 5.5 * TAU).cos(),
        stir: 1.0 - 0.75 * bell(t, 35.5, 37.5, 41.0, 43.6),
    }
}

/// Colors for the composite pass: the page, the ink of the room (red
/// channel), the light of the person (green), the person's body (blue) and
/// the haze of the bloom on light pages.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub paper: [f32; 3],
    pub room: [f32; 3],
    pub person: [f32; 3],
    pub body: [f32; 3],
    pub haze: [f32; 3],
    pub light: bool,
}
const fn rgb(v: u32) -> [f32; 3] {
    [
        ((v >> 16) & 255) as f32 / 255.0,
        ((v >> 8) & 255) as f32 / 255.0,
        (v & 255) as f32 / 255.0,
    ]
}
fn mix(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    lerp3(a, b, t)
}
/// The app theme by its `graphicsPalette` code. Light themes (Дюна, Мираж,
/// Рассвет) lay ink on a pale page; dark themes light a dark room.
pub fn look(code: u32) -> Look {
    let palette = Palette::from_code(code);
    let dark = |paper: [f32; 3], accent: [f32; 3], highlight: [f32; 3]| Look {
        paper,
        room: accent,
        person: mix(highlight, [1.0; 3], 0.25),
        body: mix(paper, [0.0; 3], 0.45),
        haze: accent,
        light: false,
    };
    match palette {
        // Дюна: a soft sepia print, brown ink on sand, never an orange flood.
        Palette::Light => {
            let paper = rgb(0xFAE18F);
            Look {
                paper,
                room: rgb(0xC9601E),
                person: rgb(0x8E3A00),
                body: mix(paper, rgb(0xFFF4D0), 0.35),
                haze: mix(paper, rgb(0xBE4C00), 0.35),
                light: true,
            }
        }
        Palette::Original => dark(rgb(0x000000), rgb(0xF5DD07), rgb(0xF5DD07)),
        _ => match palette.colors() {
            Some(c) if palette.is_light() => Look {
                paper: c.paper,
                room: c.accent,
                person: c.highlight,
                body: mix(c.paper, [1.0; 3], 0.3),
                haze: mix(c.paper, c.detail, 0.5),
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

    #[test]
    fn the_loop_has_no_seam() {
        let (a, b) = (compose(0.0), compose(LOOP_SECONDS));
        assert_eq!(a, b);
        let (x, y) = (compose(LOOP_SECONDS - 0.004), compose(0.004));
        for (p, q) in [
            (x.light, y.light),
            (x.scatter, y.scatter),
            (x.gaze, y.gaze),
            (x.soles, y.soles),
            (x.presence, y.presence),
            (x.contour, y.contour),
            (x.support, y.support),
        ] {
            assert!(close(p, q, 0.01), "{p} vs {q}");
        }
        for e in 0..3 {
            assert!(close(x.camera.eye[e], y.camera.eye[e], 0.003));
        }
        assert!(close(x.camera.focus, y.camera.focus, 0.02));
    }

    #[test]
    fn the_camera_never_jumps() {
        let mut previous = camera(0.0);
        for i in 1..=4400 {
            let c = camera(i as f32 * 0.01);
            for e in 0..3 {
                assert!(close(c.eye[e], previous.eye[e], 0.025), "eye at {i}");
            }
            assert!(close(c.focal, previous.focal, 4.0));
            assert!(close(c.center[1], previous.center[1], 4.0), "shift at {i}");
            assert!(close(c.focus, previous.focus, 0.05), "focus at {i}");
            previous = c;
        }
    }

    #[test]
    fn values_stay_finite_and_bounded() {
        for i in 0..4400 {
            let f = compose(i as f32 * 0.01);
            for v in [
                f.light,
                f.scatter,
                f.gaze,
                f.gaze_light,
                f.weight,
                f.scan,
                f.scan_light,
                f.mass,
                f.settled,
                f.presence,
                f.images,
                f.images_light,
                f.retreat,
                f.threads,
                f.snap,
                f.flow[2],
                f.mote_light,
                f.breath,
                f.stir,
            ] {
                assert!(v.is_finite() && (0.0..=1.0).contains(&v), "{v} at {i}");
            }
            for v in [f.eye, f.soles, f.support, f.contour] {
                assert!(v.is_finite() && (0.0..=1.5).contains(&v));
            }
            for r in &f.rings {
                assert!(r.radius > 0.0 && r.strength.is_finite() && r.strength >= 0.0);
            }
            assert!(f.mote.iter().all(|v| v.is_finite()));
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
    }

    #[test]
    fn the_text_is_told_in_order() {
        // Eyes lowered before the feet are felt, the feet before the torso,
        // the torso before the images, and the attention ends at the soles.
        let lowered = (0..4400)
            .map(|i| i as f32 * 0.01)
            .find(|t| *t > 4.0 && compose(*t).gaze > 0.95)
            .unwrap();
        let soles = (0..4400)
            .map(|i| i as f32 * 0.01)
            .find(|t| compose(*t).soles > 0.6 && *t > 6.0)
            .unwrap();
        let presence = (0..4400)
            .map(|i| i as f32 * 0.01)
            .find(|t| compose(*t).presence > 0.9)
            .unwrap();
        let images = (0..4400)
            .map(|i| i as f32 * 0.01)
            .find(|t| compose(*t).images_light > 0.9)
            .unwrap();
        assert!(lowered < soles && soles < presence && presence < images);
        let end = compose(35.36);
        assert!(end.mote[1] < 0.05 && end.mote[0] > HEEL[0] && end.mote[0] < BALL[0]);
        assert!(compose(STILL).camera.aperture < 0.01);
    }

    #[test]
    fn the_light_flows_into_the_head_back_and_fills_the_person() {
        let lit = |t: f32, s: f32| {
            let f = compose(t);
            f.presence > 0.8 && s > f.flow[0] && s < f.flow[1]
        };
        let (belly, crown_side, sole) = (0.6, 0.9, 0.02);
        assert!(lit(26.5, belly) && !lit(26.5, crown_side) && !lit(26.5, sole));
        assert!(lit(31.0, crown_side) && !lit(31.0, belly));
        assert!(lit(34.4, belly) && !lit(34.4, crown_side));
        assert!(lit(STILL, belly) && lit(STILL, crown_side) && lit(STILL, sole));
        assert!(compose(STILL).flow[0] < 0.0 && compose(STILL).flow[1] > 1.0);
        // It moves without jumps while it is visible.
        let mut previous = compose(23.0);
        for i in 2301..4400 {
            let f = compose(i as f32 * 0.01);
            if f.presence > 0.02 {
                assert!(
                    close(f.flow[0], previous.flow[0], 0.01),
                    "lower edge at {i}"
                );
                assert!(
                    close(f.flow[1], previous.flow[1], 0.01),
                    "upper edge at {i}"
                );
            }
            previous = f;
        }
    }

    #[test]
    fn the_figure_is_framed_in_every_shot() {
        let inside = |c: &Camera, p: [f32; 3]| {
            let q = c.project(p).unwrap();
            q.at[0] > 60.0 && q.at[0] < SIZE[0] - 60.0 && q.at[1] > 40.0 && q.at[1] < SIZE[1] - 60.0
        };
        // The wide shots hold the whole person, the close shots their subject.
        for t in [0.0, 3.0, 38.6, 40.0] {
            let c = camera(t);
            for p in [EYE, HEEL, BALL, CHAIR_LEGS[0], on_figure(150.0, 14.0)] {
                assert!(inside(&c, p), "{t} {p:?}");
            }
        }
        assert!(inside(&camera(7.0), EYE));
        for t in [12.0, 16.0] {
            assert!(inside(&camera(t), HEEL) && inside(&camera(t), BALL), "{t}");
        }
        for row in [140.0, 300.0] {
            assert!(inside(&camera(22.0), on_figure(80.0, row)));
        }
        let c = camera(30.0);
        assert!(inside(&c, EYE));
    }

    #[test]
    fn the_torso_table_is_monotone_in_rows() {
        assert!(torso_at(100.0).is_none() && torso_at(400.0).is_none());
        let mut row = TORSO[0][0];
        while row <= TORSO[TORSO.len() - 1][0] {
            let [back, front] = torso_at(row).unwrap();
            assert!(back < front && front - back > 50.0);
            row += 1.0;
        }
    }

    #[test]
    fn every_theme_has_a_look() {
        for code in 0..8 {
            let l = look(code);
            assert_eq!(l.light, matches!(code, 1 | 5 | 6));
        }
    }
}
