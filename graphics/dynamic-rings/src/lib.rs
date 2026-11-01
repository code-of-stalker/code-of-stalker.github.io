//! Step 7 «Наблюдение в Динамике»: the third level. A figure of light
//! stands inside the outer ring of Step 5 (a ticked orbit at the height of
//! its chest, a runner on it looking out at the world) with the inner
//! sphere of Step 6 in its chest, and gains a third ring at its waist that
//! moves with the body. The rings fall into one rhythm, lock, and are held
//! while the figure walks. Every value is a pure function of the chapter
//! and its loop time (`story.rs`); `browser.rs` only uploads it and the
//! shaders draw it. Metres; the figure faces +z, its left is +x.
use watcher_scene_palette::Palette;

pub mod body;
pub mod math;
pub mod story;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::DynamicRings;

use body::{Body, PRIMITIVES};
use math::V3;
pub use story::{Chapter, Story};

/// One breath: the inner sphere's beat, which the other two rings join.
pub const BEAT: f32 = 4.4;
/// After the inner flash the waist ring answers this much later, then the
/// outer ring as its runner passes the front: one ripple from the inside
/// out.
pub const RIPPLE_ACTION: f32 = 0.12;
pub const RIPPLE_ORBIT: f32 = 0.25;

/// The lens: a 3:2 frame 40° tall (1 / tan 20°); a canvas of another shape
/// keeps the whole 3:2 frame in view.
pub const FOCAL: f32 = 2.747_477_4;
pub const FRAME_ASPECT: f32 = 1.5;
/// Lens blur, canvas heights per unit of |depth − focus| / depth.
pub const APERTURE: f32 = 0.011;
/// A line's Gaussian width in canvas heights; its halo is `HALO_SPREAD`
/// times wider at `HALO` of its peak.
pub const LINE_WIDTH: f32 = 0.0011;
pub const HALO: f32 = 0.1;
pub const HALO_SPREAD: f32 = 3.5;

/// Ring 1, the outer orbit: level with the chest around the figure, a dial
/// of ticks outward from it (short, and long every sixth; of its radius),
/// a runner and its gaze out into the world (from and to, of its radius).
pub const ORBIT_RADIUS: f32 = 1.3;
pub const ORBIT_HEIGHT: f32 = 1.25;
pub const RING_SEGMENTS: u32 = 256;
pub const TICKS: u32 = 72;
pub const TICK: [f32; 2] = [0.035, 0.075];
pub const GAZE: [f32; 2] = [1.08, 2.1];
pub const GAZE_SEGMENTS: u32 = 12;
/// The runner passes the front of the ring here, 0 toward the figure's
/// front turning to its left; it runs toward smaller angles.
pub const ORBIT_START: f32 = 45.0 * std::f32::consts::PI / 180.0;
/// Its trail along the ring, radians to fade by 1/e.
pub const RUNNER_TAIL: f32 = 0.9;

/// Ring 2, the inner sphere in the chest: latitudes that slide open from
/// its equator, meridians that rise through its poles.
pub const SPHERE_RADIUS: f32 = 0.1;
pub const SPHERE_LATITUDES: [f32; 5] = [0.0, 35.0, -35.0, 65.0, -65.0];
pub const SPHERE_MERIDIANS: u32 = 3;
pub const SPHERE_SEGMENTS: u32 = 64;

/// Ring 3, action: round the hips, tilting with them as they move. Before
/// it holds it is a string of beads; its last positions trail behind it.
pub const WAIST_RADIUS: f32 = 0.5;
/// How much more than the pelvis it tilts.
pub const WAIST_TILT: f32 = 2.6;
pub const ACTION_SEGMENTS: u32 = 160;
pub const BEADS: u32 = 24;
pub const GHOSTS: usize = 8;
pub const GHOST_STEP: f32 = 0.095;
pub const GHOST_SEGMENTS: u32 = 96;

/// The ground: a print for each of the newest landings, fading, and a
/// ripple from each heel strike; a lattice of dots lit in a pool round the
/// figure.
pub const PRINTS: usize = 8;
pub const PRINT_SEGMENTS: u32 = 40;
pub const PRINT_FADE: f32 = 2.8;
pub const RIPPLE_SECONDS: f32 = 1.3;
pub const RIPPLE_REACH: f32 = 0.55;
pub const RIPPLE_SEGMENTS: u32 = 64;
pub const FLOOR_CELL: f32 = 0.155;
pub const FLOOR_GRID: u32 = 72;
pub const FLOOR_POOL: f32 = 3.2;
/// The world: motes in the air round the figure, far stars.
pub const MOTES: u32 = 900;
pub const MOTE_SPAN: [f32; 2] = [4.0, 3.4];
pub const STARS: u32 = 700;
/// The figure: points of light on its skin, each this wide (Gaussian, of
/// the canvas height).
pub const BODY_POINTS: u32 = 26000;
pub const BODY_SIZE: f32 = 0.0006;
/// A body point's own size, metres: closer points grow, as on a real skin.
pub const BODY_DOT: f32 = 0.003;

/// Peak light of each family.
pub const ORBIT_LIGHT: f32 = 0.9;
pub const TICK_LIGHT: f32 = 0.45;
pub const GAZE_LIGHT: f32 = 0.45;
pub const RUNNER_GLOW: f32 = 1.4;
pub const SPHERE_LIGHT: f32 = 0.6;
pub const ACTION_LIGHT: f32 = 0.95;
pub const GHOST_LIGHT: f32 = 0.32;
pub const PRINT_LIGHT: f32 = 0.5;
pub const RIPPLE_LIGHT: f32 = 0.6;
pub const FLOOR_LIGHT: f32 = 0.45;
pub const FLOOR_RING_LIGHT: f32 = 0.25;
pub const MOTE_LIGHT: f32 = 0.6;
pub const MOTE_GAZE: f32 = 1.6;
pub const STAR_LIGHT: f32 = 0.5;
pub const BODY_LIGHT: f32 = 0.6;
/// A ring's flash adds this much; the lock's wave this much to what it
/// passes.
pub const FLASH_GAIN: f32 = 1.3;
pub const WAVE_GAIN: f32 = 2.2;

/// The light themes engrave the scene: brightness up to this level
/// becomes ink, along this curve.
pub const ENGRAVE_WHITE: f32 = 0.9;
pub const ENGRAVE_GAMMA: f32 = 0.75;

/// A ring this frame: where, facing which way, how big and lit; `extra`
/// holds each ring's own values (story.rs).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Ring {
    pub center: V3,
    pub normal: V3,
    pub radius: f32,
    pub light: f32,
    pub flash: f32,
    pub extra: [f32; 5],
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub eye: V3,
    pub right: V3,
    pub up: V3,
    pub forward: V3,
    pub focus: f32,
    /// 0 out … 1 in.
    pub breath: f32,
    pub body: Body,
    pub body_light: f32,
    pub orbit: Ring,
    pub inner: Ring,
    pub action: Ring,
    /// The waist ring a moment ago: centre, normal, light.
    pub ghosts: [(V3, V3, f32); GHOSTS],
    /// The newest landings: x, z, yaw, seconds since.
    pub prints: [[f32; 4]; PRINTS],
    /// Where each foot meets the ground and how much it presses.
    pub feet: [[f32; 4]; 2],
    pub floor: f32,
    pub motes: f32,
    /// The lock's wave: its origin, light and radius (< 0 none).
    pub lock: [f32; 4],
    pub lock_radius: f32,
    /// The floor and the motes repeat every `distance` and `mote_box`
    /// metres along z, so the loop closes on a figure that has walked on.
    pub distance: f32,
    pub mote_box: f32,
    pub amount: f32,
}

/// The uniform block every scene shader reads, as vec4 slots.
pub const SLOTS: usize = 44;
pub const SLOT_VIEW: usize = 4;
pub const SLOT_GHOST: usize = 17;
pub const SLOT_GHOST_NORMAL: usize = SLOT_GHOST + GHOSTS;
pub const SLOT_PRINT: usize = SLOT_GHOST_NORMAL + GHOSTS;
pub const SLOT_FEET: usize = SLOT_PRINT + PRINTS;
pub const SLOT_META: usize = SLOT_FEET + 2;

/// The frame as the shaders' slots (common.glsl names them); the view slot
/// is the canvas's, filled by the browser.
pub fn pack(f: &Frame, story: &Story) -> [[f32; 4]; SLOTS] {
    let mut d = [[0.0; 4]; SLOTS];
    let with = |v: V3, w: f32| [v.x, v.y, v.z, w];
    d[0] = with(f.eye, f.focus);
    d[1] = with(f.right, f.time);
    d[2] = with(f.up, f.breath);
    d[3] = with(f.forward, f.amount);
    let o = &f.orbit;
    d[5] = with(o.center, o.radius);
    d[6] = [o.light, o.extra[0], o.extra[1], o.flash];
    d[7] = [o.extra[2], o.extra[3], o.extra[4], 0.0];
    let s = &f.inner;
    d[8] = with(s.center, s.radius);
    d[9] = [s.light, s.extra[0], s.flash, s.extra[1]];
    d[10] = [s.extra[2], f.time.rem_euclid(BEAT), 0.0, 0.0];
    let a = &f.action;
    d[11] = with(a.center, a.radius);
    d[12] = with(a.normal, a.light);
    d[13] = [a.flash, a.extra[0], a.extra[1], a.extra[2]];
    d[14] = [f.distance, f.mote_box, f.floor, f.motes];
    d[15] = f.lock;
    d[16] = [f.lock_radius, f.body_light, 0.0, 0.0];
    for (k, (c, n, w)) in f.ghosts.iter().enumerate() {
        d[SLOT_GHOST + k] = with(*c, *w);
        d[SLOT_GHOST_NORMAL + k] = with(*n, 0.0);
    }
    for (k, p) in f.prints.iter().enumerate() {
        d[SLOT_PRINT + k] = *p;
    }
    d[SLOT_FEET] = f.feet[0];
    d[SLOT_FEET + 1] = f.feet[1];
    d[SLOT_META] = [story.loop_seconds, 0.0, 0.0, 0.0];
    d
}

/// Each cone's share of the figure's points, by its skin's area standing:
/// the running total after each cone.
pub fn cone_points() -> [u32; PRIMITIVES] {
    let walk = body::Walk::new(
        [[0.085, 0.0], [-0.085, 0.0]],
        vec![body::Step {
            side: 0,
            lift: 10.0,
            land: 10.5,
            x: 0.085,
            z: 0.0,
        }],
        7.0,
    );
    let rest = body::build(&walk.pose(0.0, 0.5));
    let area: Vec<f32> = (0..PRIMITIVES)
        .map(|i| {
            let [ax, ay, az, ra] = rest.cones[3 * i];
            let [bx, by, bz, rb] = rest.cones[3 * i + 1];
            let keep = rest.cones[3 * i + 2][3];
            let len = math::v3(bx - ax, by - ay, bz - az).length();
            let tau = std::f32::consts::TAU;
            (0.5 * tau * (ra + rb) * len + tau * (ra * ra + rb * rb)) * (0.5 + 0.5 * keep)
        })
        .collect();
    let total: f32 = area.iter().sum();
    let mut running = 0.0;
    let mut ends = [0; PRIMITIVES];
    for (i, a) in area.iter().enumerate() {
        running += a;
        ends[i] = ((running / total) * BODY_POINTS as f32).round() as u32;
    }
    ends[PRIMITIVES - 1] = BODY_POINTS;
    ends
}

/// Where a world point lands in a 3:2 frame, -1..1 both ways; None behind
/// the camera.
pub fn project(f: &Frame, point: V3) -> Option<[f32; 2]> {
    let v = point - f.eye;
    let z = v.dot(f.forward);
    (z > 0.0).then(|| {
        [
            v.dot(f.right) / z * FOCAL / FRAME_ASPECT,
            v.dot(f.up) / z * FOCAL,
        ]
    })
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub light: bool,
    /// The scene's light, in the course's matrix green.
    pub glow: [f32; 3],
    pub deep: [f32; 3],
    pub mid: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}
const GREEN: [f32; 3] = [0.56, 1.0, 0.62];
/// Where the middle ink sits on the way from full ink to the page.
pub const MID_AT: f32 = 0.45;
const LUMA: [f32; 3] = [0.2126, 0.7152, 0.0722];

/// The app theme by its `graphicsPalette` code (0 Искра … 6 Рассвет).
/// The light inks are Step 5's: one print across the three levels.
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
            math::mix(look.deep[i], look.mid[i], t / MID_AT)
        } else {
            math::mix(look.mid[i], page[i], (t - MID_AT) / (1.0 - MID_AT))
        };
        ink.min(page[i])
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::math::v3;
    use crate::story::{arrive_lap, arrive_runner, ARRIVE_LOOP, HERO_LOOP};

    fn chapters() -> [Story; 2] {
        [Story::new(Chapter::Hero), Story::new(Chapter::Arrive)]
    }

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    /// The frame seen from the figure: everything a loop's walk apart
    /// should look the same.
    fn relative(f: &Frame) -> Vec<f32> {
        let o = f.orbit.center;
        let mut v = vec![];
        for p in [f.eye, f.inner.center, f.action.center, f.body.head] {
            v.extend((p - o).arr());
        }
        v.extend(f.forward.arr());
        v.extend([
            f.orbit.light,
            f.orbit.light * f.orbit.extra[1],
            f.inner.light,
            f.action.light,
            f.breath,
            f.focus,
        ]);
        v
    }

    #[test]
    fn each_loop_closes_on_a_figure_that_has_walked_on() {
        for story in chapters() {
            let l = story.loop_seconds;
            assert_eq!(story.compose(0.0), story.compose(l));
            assert_eq!(story.compose(f32::NAN), story.compose(0.0));
            let (a, b) = (story.compose(l - 1e-3), story.compose(1e-3));
            for (x, y) in relative(&a).iter().zip(relative(&b)) {
                assert!(close(*x, y, 4e-3), "{:?}: {x} {y}", story.chapter);
            }
            // The floor and the motes repeat over the walk.
            let cells = story.distance / FLOOR_CELL;
            assert!(close(cells, cells.round(), 1e-3), "{cells}");
            let boxes = story.distance / story.mote_box;
            assert!(close(boxes, boxes.round(), 1e-4), "{boxes}");
            let walked = story.compose(l - 1e-4).orbit.center.z - story.compose(0.0).orbit.center.z;
            assert!(close(walked, story.distance, 2e-3), "{walked}");
        }
    }

    #[test]
    fn the_motion_is_smooth() {
        for story in chapters() {
            let step = 1.0 / 60.0;
            let mut previous = story.compose(0.0);
            let mut t = step;
            while t < story.loop_seconds {
                let f = story.compose(t);
                let moved = (f.eye - previous.eye).length();
                assert!(moved < 0.05, "{:?} eye at {t}: {moved}", story.chapter);
                let turned = (f.forward - previous.forward).length();
                assert!(turned < 0.012, "{:?} view at {t}: {turned}", story.chapter);
                for (a, b) in [
                    (f.orbit.light, previous.orbit.light),
                    (f.orbit.extra[0], previous.orbit.extra[0]),
                    (f.orbit.extra[3], previous.orbit.extra[3]),
                    (f.inner.light, previous.inner.light),
                    (f.inner.extra[0], previous.inner.extra[0]),
                    (f.inner.extra[1], previous.inner.extra[1]),
                    (f.action.light, previous.action.light),
                    (f.action.extra[0], previous.action.extra[0]),
                ] {
                    assert!((a - b).abs() < 0.05, "{:?} light at {t}", story.chapter);
                }
                // The runner never jumps along its ring.
                let ran = (f.orbit.extra[2] - previous.orbit.extra[2]).abs();
                assert!(ran < 0.05, "{:?} runner at {t}: {ran}", story.chapter);
                previous = f;
                t += step;
            }
        }
    }

    #[test]
    fn the_figure_and_its_rings_stay_in_the_frame() {
        for story in chapters() {
            let mut t = 0.0;
            while t < story.loop_seconds {
                let f = story.compose(t);
                // Page 01 moves in close on the chest for the inner light.
                let close_up = story.chapter == Chapter::Arrive && (5.0..11.0).contains(&t);
                let (lo, hi) = (f.body.low, f.body.high);
                for corner in 0..8 {
                    let pick = |bit: u32, a: f32, b: f32| if corner & bit == 0 { a } else { b };
                    let p = v3(
                        pick(1, lo.x, hi.x),
                        pick(2, lo.y, hi.y),
                        pick(4, lo.z, hi.z),
                    );
                    let [x, y] = project(&f, p).expect("in front");
                    if !close_up {
                        assert!(x.abs() < 0.8 && y.abs() < 0.9, "{t}: {x} {y}");
                    }
                }
                for k in 0..24 {
                    let a = k as f32 / 24.0 * std::f32::consts::TAU;
                    let p = f.orbit.center + v3(a.sin(), 0.0, a.cos()) * f.orbit.radius;
                    let [x, y] = project(&f, p).expect("the ring in front");
                    if !close_up && f.orbit.light > 0.0 {
                        assert!(x.abs() < 0.92 && y.abs() < 0.9, "{t}: ring {x} {y}");
                    }
                }
                t += 0.2;
            }
        }
    }

    #[test]
    fn on_page_one_the_rings_meet_lock_and_hold() {
        let lap = arrive_lap();
        let mut previous = arrive_runner(0.0, lap);
        for i in 1..=3520 {
            let r = arrive_runner(i as f32 / 100.0, lap);
            assert!(r > previous, "{i}");
            previous = r;
        }
        // The runner draws faster than the breath, then keeps its time.
        assert!(lap < BEAT - 0.5, "{lap}");
        let story = Story::new(Chapter::Arrive);
        let before = story.compose(10.0);
        assert_eq!(before.action.light, 0.0);
        assert!(before.inner.light > 0.99 && before.orbit.light > 0.99);
        // On the lock's beat the inner ring flashes, the outer runner
        // reaches the front just after it.
        let lock = 17.6;
        assert!(close(lock / BEAT, (lock / BEAT).round(), 1e-6));
        let front = arrive_runner(lock + RIPPLE_ORBIT, lap);
        assert!(close(front, front.round(), 1e-3), "{front}");
        let flash = story.compose(lock + 0.1);
        assert!(flash.inner.flash > 0.5 && flash.orbit.flash > 0.5);
        assert!(flash.lock[3] > 0.5 && flash.lock_radius > 0.0);
        // Walking, all three are held.
        let walking = story.compose(28.0);
        assert!(walking.amount > 0.99);
        for light in [
            walking.orbit.light,
            walking.inner.light,
            walking.action.light,
        ] {
            assert!(light > 0.99, "{light}");
        }
        assert!(walking.action.extra[0] > 0.99);
        // The loop ends dark but for the figure.
        let end = story.compose(ARRIVE_LOOP - 0.05);
        for light in [end.orbit.light, end.inner.light, end.action.light] {
            assert!(light < 1e-3, "{light}");
        }
    }

    #[test]
    fn the_cover_holds_three_rings_in_one_rhythm() {
        let story = Story::new(Chapter::Hero);
        assert!(close(HERO_LOOP / BEAT, (HERO_LOOP / BEAT).round(), 1e-5));
        for i in 0..264 {
            let f = story.compose(i as f32 / 10.0);
            assert!(f.amount > 0.99);
            assert_eq!(
                (f.orbit.light, f.inner.light, f.action.light),
                (1.0, 1.0, 1.0)
            );
        }
        // The flashes ripple out: inner, waist, outer.
        let beat = 2.0 * BEAT;
        let at = |dt: f32| story.compose(beat + dt);
        assert!(at(0.03).inner.flash > at(0.03).action.flash);
        assert!(at(RIPPLE_ACTION + 0.03).action.flash > at(RIPPLE_ACTION + 0.03).orbit.flash);
    }

    #[test]
    fn the_still_frames_hold_all_three_rings() {
        for story in chapters() {
            let f = story.compose(story.chapter.still());
            assert!(f.orbit.light > 0.99 && f.inner.light > 0.99 && f.action.light > 0.99);
            assert!(f.amount > 0.99, "{:?}", story.chapter);
        }
    }

    #[test]
    fn every_cone_gets_points() {
        let ends = cone_points();
        let mut previous = 0;
        for end in ends {
            assert!(end > previous + 100, "{ends:?}");
            previous = end;
        }
        assert_eq!(ends[PRIMITIVES - 1], BODY_POINTS);
    }

    #[test]
    fn the_light_themes_never_light_the_page() {
        let pages = [
            (1, rgb(0xFA, 0xE1, 0x8F)),
            (5, rgb(0xF1, 0xDF, 0xB8)),
            (6, rgb(0xF3, 0xD8, 0xC7)),
        ];
        for (code, page) in pages {
            let look = look(code);
            assert!(look.light);
            for level in 0..=40 {
                let v = level as f32 / 20.0;
                let ink = engrave(&look, page, [v * 0.5, v, v * 0.6]);
                for i in 0..3 {
                    assert!(ink[i] <= page[i] + 1e-6);
                }
            }
            let black = engrave(&look, page, [0.0; 3]);
            assert!((0..3).all(|i| close(black[i], page[i], 1e-6)), "{black:?}");
        }
        for code in [0, 2, 3, 4] {
            assert!(!look(code).light);
        }
    }
}
