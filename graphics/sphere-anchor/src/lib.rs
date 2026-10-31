//! «Якорь», page 02 of Step 5 «Внешнее кольцо». Art's figure of light faces
//! us on a floor grid in the dark. The world drifts until «Остановись»: then
//! everything stops. The lids lower and side vision opens across the floor;
//! light runs down the body into the feet, the points of contact light up and
//! a wave runs out through the floor under the body's weight; the form shows
//! its outline, and an axis drops from the crown through the body into the
//! ground, with the anchor in the body. Every value here is a pure function of
//! loop time; `browser.rs` only uploads it and the shader paints it.
use std::f32::consts::{PI, TAU};
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::SphereAnchor;

/// Art's figure, front view, straight alpha.
pub const SIZE: [u32; 2] = [1024, 1536];
/// The image ends just over the crown; the texture adds empty rows above it
/// so the blurred levels, the halo and the outline, close over the head.
pub const HEADROOM: u32 = 256;
pub const TEXTURE: [u32; 2] = [SIZE[0], SIZE[1] + HEADROOM];
/// The whole chain of mip levels down to one pixel.
pub const LEVELS: i32 = (u32::BITS - TEXTURE[1].leading_zeros()) as i32;
/// Where the figure is in the image: crown and soles (rows), the centre line
/// and the middle of each foot (columns).
pub const CROWN_ROW: f32 = 34.0;
pub const SOLE_ROW: f32 = 1479.0;
pub const CENTRE_COLUMN: f32 = 509.5;
pub const FEET_COLUMNS: [f32; 2] = [453.0, 563.0];
/// World units: the figure stands this tall on the floor at the origin.
pub const HEIGHT: f32 = 1.75;
pub const UNIT: f32 = HEIGHT / (SOLE_ROW - CROWN_ROW);
/// The points of contact: heels behind the figure's plane, the balls of the
/// feet in front of it.
pub const HEEL_Z: f32 = -0.03;
pub const BALL_Z: f32 = 0.08;
/// The floor grid's cell.
pub const CELL: f32 = 0.25;
/// The anchor in the body: low in the belly.
pub const ANCHOR_Y: f32 = 1.0;
/// The floor gives under the body's weight like a stretched cloth, and the
/// body settles with it.
pub const DENT_DEPTH: f32 = 0.1;
pub const DENT_RADIUS: f32 = 0.75;

pub const LOOP_SECONDS: f32 = 48.0;
/// «Остановись»: the world slows to a stop over `STOP_EASE`.
pub const STOP: f32 = 4.0;
pub const STOP_EASE: f32 = 1.2;
/// «опусти веки… боковое зрение»: the lids lower and light runs out to the
/// sides of the floor.
pub const SIDE: f32 = 9.0;
pub const SIDE_REACH: f32 = 4.0;
/// «заземлись»: light runs down the body, faster as it falls.
pub const DESCEND: f32 = 18.0;
pub const DESCEND_SECONDS: f32 = 3.0;
/// «точки соприкосновения»: it reaches the soles.
pub const CONTACT: f32 = DESCEND + DESCEND_SECONDS;
/// The wave out through the floor, units a second.
pub const RING_SPEED: f32 = 0.8;
/// «твоя форма в Пространстве»
pub const FORM: f32 = 27.0;
/// «Якорь Одинности в теле»: the axis drops from above the crown to below
/// the floor, then the anchor lights.
pub const ANCHOR: f32 = 33.0;
pub const AXIS_SECONDS: f32 = 2.5;
pub const AXIS_TOP: f32 = HEIGHT + 0.15;
pub const AXIS_BOTTOM: f32 = -1.0;
/// The lights fade, then the world moves again over `MOVE_EASE`.
pub const RELEASE: f32 = 41.0;
pub const MOVE: f32 = 44.0;
pub const MOVE_EASE: f32 = 2.5;

/// The camera: half the view's height as a tangent, then the standing view
/// (whole figure), the view down to the feet, and the drift while the world
/// moves.
pub const VIEW_TAN: f32 = 0.24;
pub const EYE_DISTANCE: f32 = 4.6;
pub const EYE_HEIGHT: f32 = 1.3;
pub const LOOK_HEIGHT: f32 = 0.86;
pub const DOWN_DISTANCE: f32 = 3.4;
pub const DOWN_HEIGHT: f32 = 0.95;
pub const DOWN_LOOK: f32 = 0.36;
pub const LIDS_DROP: f32 = 0.14;
pub const YAW: f32 = 4.0 * PI / 180.0;
pub const DOLLY: f32 = 0.3;

/// The light themes print the dark scene as an engraving: the figure's
/// brightest dots are full ink, black is the page.
pub const ENGRAVE_WHITE: f32 = 0.9;
pub const ENGRAVE_GAMMA: f32 = 0.75;

/// Reduced motion: the whole practice at once, still: the outline, the axis,
/// the anchor and the points of contact.
pub const STILL: f32 = ANCHOR + AXIS_SECONDS + 1.5;

/// The geometry above as the shader's `u_geo` array.
pub const GEOMETRY: [f32; 16] = [
    UNIT,
    CENTRE_COLUMN,
    SOLE_ROW,
    HEIGHT,
    (FEET_COLUMNS[0] - CENTRE_COLUMN) * UNIT,
    (FEET_COLUMNS[1] - CENTRE_COLUMN) * UNIT,
    HEEL_Z,
    BALL_Z,
    CELL,
    ANCHOR_Y,
    ENGRAVE_WHITE,
    ENGRAVE_GAMMA,
    AXIS_TOP,
    DENT_DEPTH,
    DENT_RADIUS,
    AXIS_BOTTOM,
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub eye: [f32; 3],
    pub target: [f32; 3],
    /// How far the lids have lowered, 0..1.
    pub lids: f32,
    /// The world's motion: one whole cycle a loop, 0 all the time it stands
    /// still; and its speed, 0..1.
    pub drift: f32,
    pub speed: f32,
    /// The flash as everything stops.
    pub pulse: f32,
    /// Side vision: how far the light has run out across the floor, strength.
    pub side: [f32; 2],
    /// The light down the body: its height and strength; then the glow it
    /// leaves in the body.
    pub band: [f32; 2],
    pub body: f32,
    pub contact: f32,
    /// The wave out through the floor: radius and strength.
    pub ring: [f32; 2],
    /// The floor gives under the body's weight.
    pub dent: f32,
    pub aura: f32,
    /// The axis: how low it has reached, strength.
    pub axis: [f32; 2],
    pub anchor: f32,
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
fn window(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

fn mix(a: f32, b: f32, t: f32) -> f32 {
    a * (1.0 - t) + b * t
}

/// How fast the world moves: full, easing to a stop, still, easing back.
pub fn speed(t: f32) -> f32 {
    if t < STOP {
        1.0
    } else if t < STOP + STOP_EASE {
        0.5 + 0.5 * (PI * (t - STOP) / STOP_EASE).cos()
    } else if t < MOVE {
        0.0
    } else if t < MOVE + MOVE_EASE {
        0.5 - 0.5 * (PI * (t - MOVE) / MOVE_EASE).cos()
    } else {
        1.0
    }
}

/// The world's motion so far: the integral of `speed`.
pub fn life(t: f32) -> f32 {
    if t < STOP {
        t
    } else if t < STOP + STOP_EASE {
        let x = (t - STOP) / STOP_EASE;
        STOP + STOP_EASE * (0.5 * x + (PI * x).sin() / TAU)
    } else if t < MOVE {
        STOP + 0.5 * STOP_EASE
    } else if t < MOVE + MOVE_EASE {
        let x = (t - MOVE) / MOVE_EASE;
        STOP + 0.5 * STOP_EASE + MOVE_EASE * (0.5 * x - (PI * x).sin() / TAU)
    } else {
        STOP + 0.5 * STOP_EASE + 0.5 * MOVE_EASE + (t - MOVE - MOVE_EASE)
    }
}

/// All the motion in a loop.
pub fn lifetime() -> f32 {
    life(LOOP_SECONDS)
}

/// The world's drift: 0 while it stands still, one whole cycle from the
/// loop's start to its end, so every motion driven by whole cycles of it
/// closes the loop.
pub fn drift(t: f32) -> f32 {
    (life(t) - life(STOP + STOP_EASE)) / lifetime()
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let t = time;
    let phase = drift(t);
    let yaw = YAW * (TAU * phase).sin();
    let dolly = DOLLY * 0.5 * (1.0 - (TAU * phase).cos());
    // The camera follows the light down to the feet and rises for the form.
    let down = window(t, DESCEND - 0.5, CONTACT + 0.3, FORM - 2.0, FORM + 1.0);
    let lids = window(t, SIDE, SIDE + 1.5, SIDE + 6.5, SIDE + 8.0);
    let distance = mix(EYE_DISTANCE, DOWN_DISTANCE, down) + dolly;
    let look = mix(LOOK_HEIGHT, DOWN_LOOK, down) - LIDS_DROP * lids;

    let run = ((t - SIDE - 0.6) / 3.4).clamp(0.0, 1.0);
    let fall = ((t - DESCEND) / DESCEND_SECONDS).clamp(0.0, 1.0);
    let wave = (t - CONTACT).max(0.0);
    let drop = ((t - ANCHOR) / AXIS_SECONDS).clamp(0.0, 1.0);
    let crest = |at: f32, width: f32| (-((t - at) / width).powi(2)).exp();
    let lit = AXIS_SECONDS + ANCHOR;
    Frame {
        time,
        eye: [
            distance * yaw.sin(),
            mix(EYE_HEIGHT, DOWN_HEIGHT, down),
            distance * yaw.cos(),
        ],
        target: [0.0, look, 0.0],
        lids,
        drift: phase,
        speed: speed(t),
        pulse: crest(STOP + 0.9, 0.4),
        side: [
            SIDE_REACH * (1.0 - (1.0 - run).powi(3)),
            window(t, SIDE + 0.5, SIDE + 0.9, SIDE + 5.5, SIDE + 7.5),
        ],
        band: [
            HEIGHT * (1.0 - fall.powf(1.6)),
            window(t, DESCEND, DESCEND + 0.3, CONTACT, CONTACT + 0.8),
        ],
        body: window(t, DESCEND, DESCEND + 0.3, FORM - 1.0, FORM + 1.0),
        contact: window(t, CONTACT, CONTACT + 0.25, RELEASE, RELEASE + 2.0),
        ring: [
            RING_SPEED * wave,
            window(t, CONTACT, CONTACT + 0.1, CONTACT + 2.5, CONTACT + 5.0),
        ],
        dent: window(t, CONTACT, CONTACT + 1.5, RELEASE, MOVE),
        aura: window(t, FORM, FORM + 1.5, RELEASE, RELEASE + 2.0)
            * (0.6 + 0.4 * crest(FORM + 1.2, 0.6)),
        axis: [
            mix(AXIS_TOP, AXIS_BOTTOM, 1.0 - (1.0 - drop).powi(2)),
            window(t, ANCHOR, ANCHOR + 0.3, RELEASE, RELEASE + 2.0),
        ],
        anchor: window(t, lit, lit + 0.8, RELEASE, RELEASE + 2.0)
            * (1.0 + 0.6 * crest(lit + 0.6, 0.4)),
    }
}

/// Where `point` lands in the view, -1..1 up and across a frame of `aspect`.
pub fn project(f: &Frame, point: [f32; 3], aspect: f32) -> [f32; 2] {
    let sub = |a: [f32; 3], b: [f32; 3]| [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    let dot = |a: [f32; 3], b: [f32; 3]| a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    let norm = |a: [f32; 3]| {
        let l = dot(a, a).sqrt();
        [a[0] / l, a[1] / l, a[2] / l]
    };
    let forward = norm(sub(f.target, f.eye));
    // cross(forward, up), then cross(right, forward): as the shader builds it.
    let right = norm([-forward[2], 0.0, forward[0]]);
    let up = [
        right[1] * forward[2] - right[2] * forward[1],
        right[2] * forward[0] - right[0] * forward[2],
        right[0] * forward[1] - right[1] * forward[0],
    ];
    let v = sub(point, f.eye);
    let depth = dot(v, forward);
    [
        dot(v, right) / (depth * VIEW_TAN * aspect),
        dot(v, up) / (depth * VIEW_TAN),
    ]
}

/// How one theme prints the scene: dark themes keep the figure's own green,
/// which the theme's recolor maps; light themes engrave the dark scene on the
/// page in two muted inks, the brightest light deepest.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub light: bool,
    /// The light the beats add, in the figure's own green.
    pub glow: [f32; 3],
    pub deep: [f32; 3],
    pub mid: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}
const GREEN: [f32; 3] = [0.56, 1.0, 0.62];
/// Where the middle ink sits on the way from full ink to the page.
const MID_AT: f32 = 0.45;
const LUMA: [f32; 3] = [0.2126, 0.7152, 0.0722];

/// The app theme by its `graphicsPalette` code (0 Искра … 6 Рассвет).
/// The light inks are the Step 5 hero's: one print across the step.
pub fn look(code: u32) -> Look {
    let print = |deep, mid| Look {
        light: true,
        glow: GREEN,
        deep,
        mid,
    };
    match Palette::from_code(code) {
        // Дюна: soft sepia, never orange.
        Palette::Light => print(rgb(110, 52, 18), rgb(162, 98, 52)),
        // Мираж: navy text ink, then cobalt dulled toward lilac.
        Palette::Mirage => print(rgb(38, 59, 107), rgb(93, 97, 162)),
        // Рассвет: plum text ink, then wine dulled toward copper.
        Palette::Dawn => print(rgb(96, 51, 70), rgb(140, 84, 79)),
        _ => Look {
            light: false,
            glow: GREEN,
            deep: [0.0; 3],
            mid: [0.0; 3],
        },
    }
}

/// One pixel of the dark scene engraved on `page`, as the shader's
/// `engrave` does it.
pub fn engrave(look: &Look, page: [f32; 3], dark: [f32; 3]) -> [f32; 3] {
    let level: f32 = (0..3).map(|i| dark[i] * LUMA[i]).sum();
    let g = (level / ENGRAVE_WHITE).clamp(0.0, 1.0).powf(ENGRAVE_GAMMA);
    let t = 1.0 - g;
    [0, 1, 2].map(|i| {
        let ink = if t < MID_AT {
            mix(look.deep[i], look.mid[i], t / MID_AT)
        } else {
            mix(look.mid[i], page[i], (t - MID_AT) / (1.0 - MID_AT))
        };
        ink.min(page[i])
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    #[test]
    fn the_loop_closes_without_a_jump() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
        let before = compose(LOOP_SECONDS - 0.001);
        let after = compose(0.001);
        for i in 0..3 {
            assert!(close(before.eye[i], after.eye[i], 1e-3), "{i}");
            assert!(close(before.target[i], after.target[i], 1e-3), "{i}");
        }
        // The drift runs exactly one whole cycle a loop.
        assert!(close(drift(LOOP_SECONDS) - drift(0.0), 1.0, 1e-6));
        assert!(close(before.speed, after.speed, 1e-3));
    }

    #[test]
    fn the_motion_eases_and_never_jumps() {
        let mut last = compose(0.0);
        for i in 1..=4800 {
            let f = compose(i as f32 * 0.01);
            assert!((f.speed - last.speed).abs() < 0.02, "{i}");
            assert!((0.0..=1.0).contains(&f.speed));
            for k in 0..3 {
                // Never faster than 0.8 units a second.
                assert!((f.eye[k] - last.eye[k]).abs() < 0.008, "{i} {k}");
                assert!((f.target[k] - last.target[k]).abs() < 0.008, "{i} {k}");
            }
            last = f;
        }
        let total: f32 = (0..48000).map(|i| speed(i as f32 * 0.001) * 0.001).sum();
        assert!(close(total, lifetime(), 1e-2), "{total}");
    }

    #[test]
    fn everything_stands_still_from_the_stop_until_the_move() {
        for i in 0..=380 {
            let t = STOP + STOP_EASE + i as f32 * 0.1;
            if t > MOVE {
                break;
            }
            let f = compose(t);
            assert_eq!(f.speed, 0.0, "{t}");
            assert!(close(f.drift, 0.0, 1e-6), "{t}");
            // The camera faces the figure square on.
            assert!(close(f.eye[0], 0.0, 1e-6), "{t}");
        }
        assert!(compose(1.0).speed == 1.0 && compose(47.0).speed == 1.0);
    }

    #[test]
    fn the_light_reaches_the_soles_at_contact() {
        let f = compose(DESCEND + 0.01);
        assert!(close(f.band[0], HEIGHT, 1e-3));
        assert!(close(compose(CONTACT).band[0], 0.0, 1e-6));
        let mut last = HEIGHT;
        for i in 1..=30 {
            let y = compose(DESCEND + i as f32 * 0.1).band[0];
            assert!(y <= last + 1e-6, "{i}");
            last = y;
        }
        assert_eq!(compose(CONTACT - 0.01).contact, 0.0);
        assert!(compose(CONTACT + 0.5).contact > 0.99);
        assert_eq!(compose(CONTACT - 0.01).dent, 0.0);
    }

    #[test]
    fn every_light_is_gone_before_the_world_moves() {
        for t in [MOVE, 0.0, STOP] {
            let f = compose(t);
            let lights = [
                f.lids, f.side[1], f.band[1], f.body, f.contact, f.ring[1], f.dent, f.aura,
                f.axis[1], f.anchor,
            ];
            assert!(
                lights.iter().all(|v| close(*v, 0.0, 1e-6)),
                "{t} {lights:?}"
            );
        }
        // Each beat is done before the next.
        assert_eq!(compose(DESCEND).side[1], 0.0);
        assert_eq!(compose(DESCEND).lids, 0.0);
        assert_eq!(compose(FORM).ring[1], 0.0);
        assert!(compose(ANCHOR).aura > 0.5);
    }

    #[test]
    fn the_side_light_runs_past_the_edges_of_the_view() {
        let f = compose(SIDE + 4.5);
        assert!(close(f.side[0], SIDE_REACH, 1e-6));
        // The floor just behind the figure, at the edge of a 3:2 view.
        let edge = project(&f, [SIDE_REACH, 0.0, -0.5], 1.5);
        assert!(edge[0] > 1.0, "{edge:?}");
        assert!(compose(SIDE + 0.5).side[0] == 0.0);
    }

    #[test]
    fn the_camera_keeps_what_matters_in_view() {
        // Standing: the crown and the soles, also while the world drifts.
        for t in [0.0, 2.0, 6.0, 30.0, 36.0, 45.5, 47.0] {
            let f = compose(t);
            for y in [HEIGHT, 0.0] {
                let [x, v] = project(&f, [0.0, y, 0.0], 1.5);
                assert!(v.abs() < 0.88 && x.abs() < 0.3, "{t} {y} {v}");
            }
        }
        // The lids lowered: the gaze drops, the soles stay well in view.
        let f = compose(SIDE + 4.0);
        assert!(f.lids > 0.99);
        assert!(project(&f, [0.0, 0.0, 0.0], 1.5)[1] > -0.8);
        // Down at the feet: the soles, the points of contact and the knees.
        let f = compose(CONTACT + 1.0);
        for point in [[0.0, 0.0, BALL_Z], [0.0, 0.0, HEEL_Z], [0.0, 0.5, 0.0]] {
            let [_, v] = project(&f, point, 1.5);
            assert!(v.abs() < 0.8, "{point:?} {v}");
        }
        // The axis reaches below the bottom of the view.
        let f = compose(ANCHOR + AXIS_SECONDS);
        assert!(project(&f, [0.0, AXIS_BOTTOM, 0.0], 1.5)[1] < -1.0);
        assert!(project(&f, [0.0, AXIS_TOP, 0.0], 1.5)[1] < 1.0);
    }

    #[test]
    fn the_still_holds_the_whole_practice() {
        let f = compose(STILL);
        assert!(f.contact > 0.99 && f.aura > 0.5 && f.axis[1] > 0.99 && f.anchor > 0.99);
        assert!(close(f.axis[0], AXIS_BOTTOM, 1e-6));
        assert_eq!(f.speed, 0.0);
    }

    #[test]
    fn the_figure_stands_on_the_floor() {
        // The soles are the floor, the feet either side of the centre line.
        assert!(close((SOLE_ROW - CROWN_ROW) * UNIT, HEIGHT, 1e-5));
        const { assert!(GEOMETRY[4] < 0.0 && GEOMETRY[5] > 0.0) };
        const { assert!(ANCHOR_Y > 0.4 * HEIGHT && ANCHOR_Y < 0.6 * HEIGHT) };
    }

    #[test]
    fn the_texture_holds_every_level() {
        assert_eq!(TEXTURE, [1024, 1792]);
        assert_eq!(LEVELS, 11);
        assert_eq!(TEXTURE[1] >> (LEVELS - 1), 1);
    }

    #[test]
    fn every_theme_has_a_look() {
        for code in 0..7 {
            let l = look(code);
            assert_eq!(l.light, Palette::from_code(code).is_light());
            assert!(l.glow.iter().all(|c| (0.0..=1.0).contains(c)));
        }
        assert!(!look(255).light);
    }

    #[test]
    fn the_engraving_keeps_the_page_and_never_outshines_it() {
        let pages = [
            (1, [250, 225, 143]),
            (5, [241, 223, 184]),
            (6, [243, 216, 199]),
        ];
        for (code, page) in pages {
            let page = page.map(|c| c as f32 / 255.0);
            let l = look(code);
            assert_eq!(engrave(&l, page, [0.0; 3]), page);
            let mut last = f32::MAX;
            for step in 0..=20 {
                let v = step as f32 / 20.0;
                let ink = engrave(&l, page, [v * 0.4, v, v * 0.5]);
                assert!((0..3).all(|i| ink[i] <= page[i]), "{code} {v}");
                let level: f32 = (0..3).map(|i| ink[i] * LUMA[i]).sum();
                assert!(level <= last + 1e-5, "{code} {v}");
                last = level;
            }
            assert_eq!(engrave(&l, page, [1.0; 3]), l.deep);
        }
    }
}
