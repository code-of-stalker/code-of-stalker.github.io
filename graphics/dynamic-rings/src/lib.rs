//! Step 7 «Наблюдение в Динамике»: the third level. A figure of light walks
//! over the top of a small planet inside a sphere of glass, the dynamic
//! sphere of the body. Inside it the rings of the first two levels move:
//! the outer one, a double ring that sweeps the whole glass from its top
//! to the ground and back, scanning the world; the inner one, a string of
//! beads that runs up and down the figure with the breath and scans it.
//! Their rhythms meet and lock, and the third ring, the sphere's own,
//! starts to turn: a ring upright on the glass whose turning is the
//! sphere, lighting it as it goes. Then everything is held while the
//! figure walks; what comes into the glass is scanned, and the wires that
//! reach for the figure crumble on it. The camera goes from the eyes, to
//! over the right shoulder, to the side from above. Every value is a pure
//! function of the
//! chapter and its loop time (`story.rs`); `browser.rs` only uploads it and
//! the shaders draw it. Metres; the figure faces +z, its left is +x.
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

/// One breath.
pub const BEAT: f32 = 4.4;
/// The scanner runs the body and back, and the crown ring the glass, once
/// in two breaths: slow enough to follow.
pub const SWEEP: f32 = 2.0 * BEAT;

/// The lens: a 3:2 frame 40° tall (1 / tan 20°) at zoom 1; a canvas of
/// another shape keeps the whole 3:2 frame in view.
pub const FOCAL: f32 = 2.747_477_4;
pub const FRAME_ASPECT: f32 = 1.5;
/// A line's Gaussian width in canvas heights; its halo is `HALO_SPREAD`
/// times wider at `HALO` of its peak.
pub const LINE_WIDTH: f32 = 0.0011;
pub const HALO: f32 = 0.1;
pub const HALO_SPREAD: f32 = 3.5;

/// The sphere of the third level: its centre this high over the ground,
/// sunk into it so that its base lies on the ground in a circle. Its shell
/// is a glass this thick that glows by how much of it a ray crosses: faint
/// face on, bright at the rim.
pub const SPHERE_RADIUS: f32 = 1.4;
pub const SPHERE_HEIGHT: f32 = 1.0;
pub const SHELL: f32 = 0.03;
/// Light per metre of glass crossed, its grid's light, how lit it is
/// before the third ring fills it.
pub const SHELL_LIGHT: f32 = 1.5;
pub const SHELL_GRID: f32 = 0.11;
pub const SHELL_LATENT: f32 = 0.35;
/// The air inside the glass glows this much a metre where it is filled.
pub const GLASS_FOG: f32 = 0.05;
/// Each landing sends a band of light up the glass this fast (m/s).
pub const SHELL_WAVE: f32 = 1.5;

/// The planet under the figure; the floor bends over it.
pub const PLANET_RADIUS: f32 = 60.0;
/// Its grid's cell (two strides) and how far the grid reaches, metres.
pub const PLANET_CELL: f32 = 1.24;
pub const PLANET_REACH: f32 = 24.0;

/// The rings inside the sphere: 0 the crown (level 1, the world outside),
/// 1 the body's scanner (level 2, the breath inside), 2 the sphere's own
/// (level 3: it starts to turn once the first two lock).
pub const RINGS: usize = 3;
/// The crown ring runs on a sphere this share of the glass: two lines this
/// far apart, a band of beads between them.
pub const CROWN_SHARE: f32 = 0.955;
pub const CROWN_GAP: f32 = 0.026;
/// It sweeps from this latitude at the top of its sphere down to this
/// high (m) over the ground, and back; it tilts this far (radians) except
/// near the ground.
pub const CROWN_TOP: f32 = 1.42;
pub const CROWN_FLOOR: f32 = 0.06;
pub const CROWN_TILT: f32 = 0.12;
/// Before it joins the scanner the crown ring keeps its own, slower time.
pub const CROWN_PERIOD: f32 = 13.8;
/// The body's scanner runs from the feet to the top of the head and back
/// once a sweep, hugging the figure: its radius by height (m) over the
/// ground.
pub const SCANNER: [(f32, f32); 7] = [
    (0.0, 0.36),
    (0.45, 0.31),
    (0.9, 0.37),
    (1.22, 0.43),
    (1.38, 0.41),
    (1.5, 0.24),
    (1.72, 0.16),
];
pub const SCANNER_FLOOR: f32 = 0.05;
/// It lights the skin in its plane: a line this thick (m), this bright, and
/// what it has just passed for this far behind it; skin it has not passed
/// for a while keeps this share of its light.
pub const SLICE: f32 = 0.03;
pub const SLICE_LIGHT: f32 = 5.0;
pub const SLICE_GLOW: f32 = 0.55;
pub const UNSCANNED: f32 = 0.45;
/// The sphere's ring, upright on a sphere this share of the glass; it
/// trails this many fading copies this far apart (radians) at full speed.
pub const SPHERE_SHARE: f32 = 0.985;
pub const SPIN_TRAIL: u32 = 12;
pub const SPIN_STEP: f32 = 0.05;
/// A turn of the sphere every four breaths.
pub const SPIN_PERIOD: f32 = 4.0 * BEAT;
pub const RING_SEGMENTS: u32 = 192;
/// Beads on each of the crown and the scanner.
pub const BEADS: u32 = 120;
/// The crown ring's last positions trail behind it.
pub const GHOSTS: usize = 6;
pub const GHOST_STEP: f32 = 0.06;
pub const GHOST_SEGMENTS: u32 = 128;
/// After the lock, spokes of beads run out from the scanner to the crown.
pub const SPOKES: u32 = 28;
pub const SPOKE_BEADS: u32 = 12;
/// The crown ring's plane lights the world it passes, this wide (m).
pub const SCAN_WIDTH: f32 = 0.16;
/// Things the walk passes, some on the ground, some in the air, scanned
/// while they are inside the glass: so many a loop's walk, each edge in
/// this many pieces, and a ring of so many running up and down each.
pub const THINGS: u32 = 16;
pub const THING_PIECES: u32 = 6;
pub const THING_RING: u32 = 32;
/// Wires that reach out of the ground for the figure and crumble on the
/// glass: three strands of so many pieces each, and the dust each leaves.
pub const TENTACLES: usize = 6;
pub const TENTACLE_STRANDS: u32 = 3;
pub const TENTACLE_SEGMENTS: u32 = 56;
pub const DEBRIS: u32 = 64;
/// It breaks from the tip back to the root over this long (s); its dust
/// dims by e this often (s).
pub const TENTACLE_BREAK: f32 = 1.3;
pub const DEBRIS_FADE: f32 = 0.6;
/// How fast it writhes (radians a second) and how far, of its length.
pub const WRITHE: f32 = 2.4;
pub const WRITHE_REACH: f32 = 0.09;
/// Spires stand along the horizon, their stays running to the ground.
pub const SPIRES: u32 = 22;
pub const SPIRE_PIECES: u32 = 40;

/// The ground: a print for each of the newest landings, fading, and a
/// ripple from each heel strike; a lattice of dots lit round the figure.
pub const PRINTS: usize = 8;
pub const PRINT_SEGMENTS: u32 = 40;
pub const PRINT_FADE: f32 = 2.8;
pub const RIPPLE_SECONDS: f32 = 1.6;
pub const RIPPLE_REACH: f32 = 1.3;
pub const RIPPLE_SEGMENTS: u32 = 80;
pub const FLOOR_CELL: f32 = 0.155;
pub const FLOOR_GRID: u32 = 84;
pub const FLOOR_POOL: f32 = 3.6;
/// The world: motes in the air round the figure, far stars, some joined
/// into figures, and columns of data standing over the horizon.
pub const MOTES: u32 = 700;
pub const MOTE_SPAN: [f32; 2] = [4.0, 3.4];
pub const STARS: u32 = 900;
pub const CONSTELLATIONS: u32 = 9;
pub const CONSTELLATION_STARS: u32 = 6;
pub const COLUMNS: u32 = 120;
pub const COLUMN_DOTS: u32 = 34;
pub const COLUMN_GAP: f32 = 0.34;
/// The figure: points of light on its skin, each this wide (Gaussian, of
/// the canvas height).
pub const BODY_POINTS: u32 = 26000;
pub const BODY_SIZE: f32 = 0.0006;
/// A body point's own size, metres: closer points grow, as on a real skin.
pub const BODY_DOT: f32 = 0.003;

/// Peak light of each family.
pub const CROWN_LIGHT: f32 = 1.0;
pub const BEAD_LIGHT: f32 = 1.1;
pub const INNER_LINE_LIGHT: f32 = 0.85;
pub const SPIN_LIGHT: f32 = 1.3;
pub const CONTACT_LIGHT: f32 = 0.7;
pub const GHOST_LIGHT: f32 = 0.3;
pub const SPOKE_LIGHT: f32 = 0.6;
pub const SCAN_LIGHT: f32 = 2.2;
pub const THING_LIGHT: f32 = 0.9;
pub const TENTACLE_LIGHT: f32 = 1.4;
pub const DEBRIS_LIGHT: f32 = 1.2;
pub const SPIRE_LIGHT: f32 = 1.4;
pub const PRINT_LIGHT: f32 = 0.5;
pub const RIPPLE_LIGHT: f32 = 0.55;
pub const FLOOR_LIGHT: f32 = 0.45;
pub const PLANET_LIGHT: f32 = 0.09;
pub const ATMOSPHERE_LIGHT: f32 = 0.22;
/// The sky's band of light.
pub const NEBULA_LIGHT: f32 = 0.035;
pub const MOTE_LIGHT: f32 = 0.5;
pub const STAR_LIGHT: f32 = 0.5;
pub const CONSTELLATION_LIGHT: f32 = 0.16;
pub const COLUMN_LIGHT: f32 = 0.7;
pub const BODY_LIGHT: f32 = 1.0;
/// A ring's flash adds this much; the lock's wave this much to what it
/// passes.
pub const FLASH_GAIN: f32 = 1.3;
pub const WAVE_GAIN: f32 = 2.2;

/// The light themes engrave the scene: brightness up to this level
/// becomes ink, along this curve.
pub const ENGRAVE_WHITE: f32 = 0.9;
pub const ENGRAVE_GAMMA: f32 = 0.75;

/// A ring this frame: where, facing which way, how big and lit.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Ring {
    pub center: V3,
    pub normal: V3,
    pub radius: f32,
    pub light: f32,
    pub flash: f32,
    /// How far its beads have run round it, radians; the sphere's ring:
    /// how far it has turned.
    pub flow: f32,
    /// 0 its beads scattered in the air … 1 gathered on the ring; the
    /// sphere's ring: how fast it turns, of full speed.
    pub form: f32,
    /// How much its plane lights the world it passes.
    pub scan: f32,
}

impl Ring {
    /// A point of the ring at angle `s`, from its +z side, or its +x side
    /// when it faces along z (common.glsl onTilted).
    pub fn at(&self, s: f32) -> V3 {
        let side = if self.normal.z.abs() < 0.9 {
            math::v3(0.0, 0.0, 1.0)
        } else {
            math::v3(1.0, 0.0, 0.0)
        };
        let e1 = self.normal.cross(side).normalize();
        let e2 = e1.cross(self.normal);
        self.center + (e1 * s.sin() + e2 * s.cos()) * self.radius
    }
}

/// A wire reaching for the figure: the four points of its curve (root on
/// the ground, tip on the glass), how far it has grown, seconds since it
/// broke on the glass (< 0 not yet), its light, how it writhes now and
/// when it broke, and where on the glass it broke (a unit direction from
/// the sphere's centre).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Tentacle {
    pub points: [V3; 4],
    pub reach: f32,
    pub broken: f32,
    pub light: f32,
    pub writhe: f32,
    pub writhe_at_break: f32,
    pub contact: V3,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub eye: V3,
    pub right: V3,
    pub up: V3,
    pub forward: V3,
    /// Focus distance, zoom (1 is the 40° lens), aperture (canvas heights
    /// of blur per unit of |depth − focus| / depth).
    pub focus: f32,
    pub lens: f32,
    pub aperture: f32,
    /// 0 out … 1 in.
    pub breath: f32,
    pub body: Body,
    pub body_light: f32,
    pub sphere: V3,
    /// The glass before it fills, once filled, and how far round (radians)
    /// the sphere's ring has lit it since it started to turn: all of it
    /// from π, since the ring lights both its sides.
    pub latent: f32,
    pub filled: f32,
    pub fill: f32,
    pub rings: [Ring; RINGS],
    /// The crown ring a moment ago: centre, normal, radius, light.
    pub ghosts: [(V3, V3, f32, f32); GHOSTS],
    pub spokes: f32,
    /// The things the walk passes and the wires: how lit.
    pub things: f32,
    /// Each thing: where along the walk it stands (z), 1 if it is in this
    /// chapter, 0 if not.
    pub things_at: [[f32; 2]; THINGS as usize],
    pub tentacles: [Tentacle; TENTACLES],
    /// The newest landings: x, z, yaw, seconds since.
    pub prints: [[f32; 4]; PRINTS],
    /// Where each foot meets the ground and how much it presses.
    pub feet: [[f32; 4]; 2],
    pub floor: f32,
    pub world: f32,
    /// The lock's wave: its origin, light and radius (< 0 none).
    pub lock: [f32; 4],
    pub lock_radius: f32,
    /// The floor and the motes repeat every `distance` and `mote_box`
    /// metres along z, so the loop closes on a figure that has walked on;
    /// `track` is where the walk is, under the planet's top.
    pub distance: f32,
    pub mote_box: f32,
    pub track: f32,
    pub amount: f32,
}

/// The uniform block every scene shader reads, as vec4 slots.
pub const SLOT_VIEW: usize = 4;
pub const SLOT_RING: usize = 7;
pub const SLOT_WORLD: usize = SLOT_RING + 3 * RINGS;
pub const SLOT_GHOST: usize = SLOT_WORLD + 3;
pub const SLOT_PRINT: usize = SLOT_GHOST + 2 * GHOSTS;
pub const SLOT_FEET: usize = SLOT_PRINT + PRINTS;
pub const SLOT_TENTACLE: usize = SLOT_FEET + 2;
pub const SLOT_META: usize = SLOT_TENTACLE + 5 * TENTACLES;
pub const SLOT_THING: usize = SLOT_META + 1;
pub const SLOTS: usize = SLOT_THING + THINGS as usize / 2;

/// The frame as the shaders' slots (common.glsl names them); the view slot
/// is the canvas's, filled by the browser.
pub fn pack(f: &Frame, story: &Story) -> [[f32; 4]; SLOTS] {
    let mut d = [[0.0; 4]; SLOTS];
    let with = |v: V3, w: f32| [v.x, v.y, v.z, w];
    d[0] = with(f.eye, f.focus);
    d[1] = with(f.right, f.time);
    d[2] = with(f.up, f.breath);
    d[3] = with(f.forward, f.amount);
    d[5] = with(f.sphere, SPHERE_RADIUS);
    d[6] = [f.latent, f.filled, f.fill, f.track];
    for (k, r) in f.rings.iter().enumerate() {
        let s = SLOT_RING + 3 * k;
        d[s] = with(r.center, r.radius);
        d[s + 1] = with(r.normal, r.light);
        d[s + 2] = [r.flash, r.flow, r.form, r.scan];
    }
    d[SLOT_WORLD] = [f.distance, f.mote_box, f.floor, f.world];
    d[SLOT_WORLD + 1] = f.lock;
    d[SLOT_WORLD + 2] = [
        f.lock_radius,
        f.body_light,
        f.spokes,
        f.time.rem_euclid(SWEEP),
    ];
    for (k, (c, n, r, w)) in f.ghosts.iter().enumerate() {
        d[SLOT_GHOST + 2 * k] = with(*c, *r);
        d[SLOT_GHOST + 2 * k + 1] = with(*n, *w);
    }
    for (k, p) in f.prints.iter().enumerate() {
        d[SLOT_PRINT + k] = *p;
    }
    d[SLOT_FEET] = f.feet[0];
    d[SLOT_FEET + 1] = f.feet[1];
    for (k, w) in f.tentacles.iter().enumerate() {
        let s = SLOT_TENTACLE + 5 * k;
        let [a, b, c, e] = w.points;
        d[s] = with(a, w.reach);
        d[s + 1] = with(b, w.broken);
        d[s + 2] = with(c, w.light);
        d[s + 3] = with(e, w.writhe);
        d[s + 4] = with(w.contact, w.writhe_at_break);
    }
    d[SLOT_META] = [story.loop_seconds, f.lens, f.aperture, f.things];
    for (k, two) in f.things_at.chunks(2).enumerate() {
        d[SLOT_THING + k] = [two[0][0], two[0][1], two[1][0], two[1][1]];
    }
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
            v.dot(f.right) / z * FOCAL * f.lens / FRAME_ASPECT,
            v.dot(f.up) / z * FOCAL * f.lens,
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
    use crate::story::{crown_phase, ARRIVE_LOCK, ARRIVE_LOOP, HERO_LOOP};

    fn chapters() -> [Story; 2] {
        [Story::new(Chapter::Hero), Story::new(Chapter::Arrive)]
    }

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    /// The frame seen from the figure: everything a loop's walk apart
    /// should look the same.
    fn relative(f: &Frame) -> Vec<f32> {
        let o = f.sphere;
        let mut v = vec![];
        for p in [f.eye, f.body.head] {
            v.extend((p - o).arr());
        }
        for r in &f.rings {
            v.extend((r.center - o).arr());
            v.extend(r.normal.arr());
            v.extend([r.radius, r.light, r.form]);
        }
        v.extend(f.forward.arr());
        v.extend([
            f.latent, f.filled, f.spokes, f.things, f.breath, f.focus, f.lens,
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
                assert!(close(*x, y, 5e-3), "{:?}: {x} {y}", story.chapter);
            }
            for (x, y) in a.things_at.iter().zip(b.things_at) {
                assert_eq!(*x, y);
            }
            // The floor, the planet's grid and the motes repeat over the walk.
            for cell in [FLOOR_CELL, PLANET_CELL, story.mote_box] {
                let cells = story.distance / cell;
                assert!(close(cells, cells.round(), 1e-3), "{cells}");
            }
            let walked = story.compose(l - 1e-4).track - story.compose(0.0).track;
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
                assert!(moved < 0.06, "{:?} eye at {t}: {moved}", story.chapter);
                let turned = (f.forward - previous.forward).length();
                assert!(turned < 0.025, "{:?} view at {t}: {turned}", story.chapter);
                assert!((f.lens - previous.lens).abs() < 0.01);
                // An unlit ring may wait anywhere.
                let lit = f.rings.iter().zip(&previous.rings);
                for (a, b) in lit.filter(|(a, b)| a.light.max(b.light) > 0.0) {
                    let jumped = (a.center - b.center).length() + (a.radius - b.radius).abs();
                    assert!(jumped < 0.06, "{:?} ring at {t}: {jumped}", story.chapter);
                    assert!((a.normal - b.normal).length() < 0.03, "{t}");
                    for (x, y) in [(a.light, b.light), (a.form, b.form), (a.scan, b.scan)] {
                        assert!((x - y).abs() < 0.05, "{:?} light at {t}", story.chapter);
                    }
                }
                for (a, b) in [
                    (f.latent, previous.latent),
                    (f.filled, previous.filled),
                    (f.spokes, previous.spokes),
                    (f.things, previous.things),
                ] {
                    assert!((a - b).abs() < 0.05, "{:?} glass at {t}", story.chapter);
                }
                previous = f;
                t += step;
            }
        }
    }

    #[test]
    fn the_rings_move_inside_the_sphere() {
        for story in chapters() {
            let mut t = 0.0;
            while t < story.loop_seconds {
                let f = story.compose(t);
                for (k, r) in f.rings.iter().enumerate() {
                    for i in 0..24 {
                        let p = r.at(i as f32 / 24.0 * std::f32::consts::TAU);
                        let out = (p - f.sphere).length();
                        assert!(out <= SPHERE_RADIUS + 1e-3, "{t} ring {k}: {out}");
                        // The sphere's own ring runs on through the ground.
                        assert!(k == 2 || p.y > 0.0, "{t} ring {k} under the ground");
                    }
                }
                t += 0.1;
            }
        }
        // They travel: over the cover the crown ring sweeps the glass from
        // its top to the ground, the scanner the figure from its feet to the
        // top of its head, and the crown ring tilts round.
        let story = Story::new(Chapter::Hero);
        let frames: Vec<Frame> = (0..(HERO_LOOP * 10.0) as i32)
            .map(|i| story.compose(i as f32 / 10.0))
            .collect();
        let span = |k: usize| {
            let heights = frames.iter().map(|f| f.rings[k].center.y);
            heights.fold((9.0f32, -9.0f32), |(a, b), y| (a.min(y), b.max(y)))
        };
        let (lo, hi) = span(0);
        assert!(lo < 0.1 && hi > SPHERE_HEIGHT + 1.2, "the crown: {lo} {hi}");
        let (lo, hi) = span(1);
        let head = frames.iter().map(|f| f.body.high.y).fold(9.0f32, f32::min);
        assert!(lo < 0.1 && hi > head - 0.1, "the scanner: {lo} {hi}");
        for f in &frames {
            // It hugs the figure: round the body's axis, close to its skin.
            let r = &f.rings[1];
            let off = v3(r.center.x - f.body.head.x, 0.0, r.center.z - f.body.head.z);
            assert!(off.length() < 0.25 && r.radius < 0.45, "{}", f.time);
        }
        // The sphere's ring turns about the upright axis, whole turns a loop.
        let turned: f32 = frames
            .windows(2)
            .map(|w| {
                let (a, b) = (w[0].rings[2].normal, w[1].rings[2].normal);
                a.cross(b).y.asin()
            })
            .sum();
        assert!(turned.abs() > 2.0 * std::f32::consts::TAU, "{turned}");
        let tilts = frames.iter().map(|f| f.rings[0].normal.x);
        let (lo, hi) = tilts.fold((9.0f32, -9.0f32), |(a, b), x| (a.min(x), b.max(x)));
        assert!(lo < -0.05 && hi > 0.05, "{lo} {hi}");
    }

    #[test]
    fn the_camera_goes_from_the_eyes_to_the_shoulder_to_the_side() {
        let story = Story::new(Chapter::Arrive);
        for i in 0..100 {
            let f = story.compose(0.5 + i as f32 * 0.09);
            // From the eyes: inside the head, looking ahead.
            assert!((f.eye - f.body.head).length() < 0.16, "{}", f.time);
            assert!(f.forward.z > 0.9);
        }
        for i in 0..80 {
            let f = story.compose(14.5 + i as f32 * 0.09);
            let rel = f.eye - f.body.head;
            // Behind the right shoulder, a little above it.
            assert!(
                rel.z < -0.6 && rel.x < -0.25 && rel.y > 0.3,
                "{}: {rel:?}",
                f.time
            );
            assert!(f.forward.z > 0.8);
        }
        for i in 0..90 {
            let f = story.compose(26.5 + i as f32 * 0.09);
            let rel = f.eye - f.sphere;
            // From the side, above.
            assert!(
                rel.x < -3.5 && rel.y > 1.8 && rel.z.abs() < 2.0,
                "{}: {rel:?}",
                f.time
            );
        }
    }

    #[test]
    fn the_figure_and_its_sphere_stay_in_the_frame() {
        for story in chapters() {
            let mut t = 0.0;
            while t < story.loop_seconds {
                let f = story.compose(t);
                // Once the camera stands well outside the glass; on the way out
                // a crane may crop the feet.
                let seen_from_outside = (f.eye - f.sphere).length() > SPHERE_RADIUS * 2.5;
                if seen_from_outside {
                    let (lo, hi) = (f.body.low, f.body.high);
                    for corner in 0..8 {
                        let pick = |bit: u32, a: f32, b: f32| if corner & bit == 0 { a } else { b };
                        let p = v3(
                            pick(1, lo.x, hi.x),
                            pick(2, lo.y, hi.y),
                            pick(4, lo.z, hi.z),
                        );
                        let [x, y] = project(&f, p).expect("in front");
                        assert!(x.abs() < 0.8 && y.abs() < 0.9, "{t}: {x} {y}");
                    }
                    let top = f.sphere + math::Y * SPHERE_RADIUS;
                    let [_, y] = project(&f, top).expect("in front");
                    assert!(y < 0.95, "{t}: the sphere's top {y}");
                }
                t += 0.2;
            }
        }
    }

    #[test]
    fn on_page_one_the_rings_meet_lock_and_hold() {
        let story = Story::new(Chapter::Arrive);
        // From the eyes the crown ring passes through eye level, lit.
        let crossings = (0..1000)
            .map(|i| story.compose(i as f32 / 100.0))
            .filter(|f| {
                let r = &f.rings[0];
                r.light > 0.9 && ((f.eye - r.center).dot(r.normal)).abs() < 0.01
            })
            .count();
        assert!(crossings > 0);
        // The crown keeps its own time, then joins the scanner at the top
        // of a sweep.
        assert!(close(
            ARRIVE_LOCK / SWEEP,
            (ARRIVE_LOCK / SWEEP).round(),
            1e-5
        ));
        let mut previous = crown_phase(0.0);
        for i in 1..=3960 {
            let p = crown_phase(i as f32 / 100.0);
            assert!(p > previous, "{i}");
            previous = p;
        }
        let at_lock = crown_phase(ARRIVE_LOCK);
        assert!(close(at_lock, at_lock.round(), 1e-4), "{at_lock}");
        let rate = (crown_phase(ARRIVE_LOCK + 0.5) - crown_phase(ARRIVE_LOCK)) / 0.5;
        assert!(close(rate, 1.0 / SWEEP, 1e-3));
        let early = (crown_phase(16.0) - crown_phase(15.0)) * SWEEP;
        assert!(!close(early, 1.0, 0.1), "{early}");
        let flash = story.compose(ARRIVE_LOCK + 0.1);
        assert!(flash.rings[0].flash > 0.5 && flash.rings[1].flash > 0.5);
        assert!(flash.lock[3] > 0.5 && flash.lock_radius > 0.0);
        // Before the lock the glass waits; walking after it, all is held.
        let before = story.compose(20.0);
        assert!(before.filled < 1e-3 && before.spokes < 1e-3 && before.things < 1e-3);
        assert!(before.rings[2].light < 1e-3);
        assert!(before.rings[1].light > 0.99 && before.rings[0].light > 0.99);
        let held = story.compose(35.0);
        assert!(held.amount > 0.99);
        for r in &held.rings {
            assert!(r.light > 0.99 && r.form > 0.99);
        }
        // By then the sphere's ring has turned past half a turn: it has lit
        // all the glass.
        assert!(held.filled > 0.99 && held.fill >= std::f32::consts::PI);
        assert!(held.spokes > 0.99 && held.things > 0.99);
        // The loop ends with the rings out, back in the eyes.
        let end = story.compose(ARRIVE_LOOP - 0.05);
        for r in &end.rings {
            assert!(r.light < 1e-3, "{}", r.light);
        }
        assert!(end.filled < 1e-3 && end.spokes < 1e-3 && end.things < 1e-3);
    }

    #[test]
    fn the_cover_holds_every_ring_in_one_rhythm() {
        let story = Story::new(Chapter::Hero);
        assert!(close(HERO_LOOP / SWEEP, (HERO_LOOP / SWEEP).round(), 1e-5));
        for i in 0..(HERO_LOOP * 10.0) as i32 {
            let f = story.compose(i as f32 / 10.0);
            assert!(f.amount > 0.99);
            for r in &f.rings {
                assert_eq!((r.light, r.form), (1.0, 1.0));
            }
            assert_eq!((f.filled, f.spokes, f.things), (1.0, 1.0, 1.0));
        }
        // The crown and the scanner rise together.
        let rise = |t: f32| {
            let (a, b) = (story.compose(t), story.compose(t + 0.2));
            (
                b.rings[0].center.y - a.rings[0].center.y,
                b.rings[1].center.y - a.rings[1].center.y,
            )
        };
        for t in [1.0, 2.0, 3.0, 5.4, 6.4, 7.4] {
            let (crown, torso) = rise(t);
            assert!(crown * torso > 0.0, "{t}: {crown} {torso}");
        }
    }

    #[test]
    fn the_still_frames_hold_every_ring() {
        for story in chapters() {
            let f = story.compose(story.chapter.still());
            for r in &f.rings {
                assert!(r.light > 0.99, "{:?}", story.chapter);
            }
            assert!(f.filled > 0.99 && f.amount > 0.99, "{:?}", story.chapter);
        }
    }

    #[test]
    fn the_wires_reach_for_the_glass_and_break_on_it() {
        for story in chapters() {
            let mut breaks = 0;
            let mut was = [false; TENTACLES];
            let mut lit = [false; TENTACLES];
            let mut t = 0.0;
            while t < story.loop_seconds {
                let f = story.compose(t);
                for (k, w) in f.tentacles.iter().enumerate() {
                    let [root, .., tip] = w.points;
                    assert!(root.y.abs() < 1e-6, "rooted in the ground");
                    assert!((0.0..=1.0).contains(&w.reach) && (0.0..=1.0).contains(&w.light));
                    assert!((w.contact.length() - 1.0).abs() < 1e-4 && w.contact.y > 0.0);
                    let broken = w.broken >= 0.0;
                    if !broken {
                        // Its tip is on the glass the figure carries.
                        let off = (tip - f.sphere).length() - SPHERE_RADIUS;
                        assert!(off.abs() < 0.03, "{t} wire {k}: {off}");
                    }
                    if broken && !was[k] {
                        breaks += 1;
                        assert!(w.reach > 0.99, "{t} wire {k} broke short");
                    }
                    if w.light > 0.0 {
                        lit[k] = true;
                    }
                    was[k] = broken;
                    // Its root keeps clear of the cameras' side and of the glass.
                    let off = root - f.sphere;
                    assert!(off.x.hypot(off.z) > 1.5, "{t} wire {k}");
                }
                t += 1.0 / 30.0;
            }
            // Each wire in the chapter's list breaks once, and only those.
            let wires = story.chapter.wires().len();
            assert_eq!(breaks, wires, "{:?}", story.chapter);
            let used = lit.iter().filter(|l| **l).count();
            assert_eq!(used, wires.min(TENTACLES), "{:?}", story.chapter);
        }
    }

    #[test]
    fn the_world_comes_in_one_thing_at_a_time() {
        for story in chapters() {
            let (things, wires) = (story.chapter.things(), story.chapter.wires());
            assert!(things.len() <= THINGS as usize);
            // First a thing is scanned, then a wire breaks, and then more and
            // more of both, closer and closer together.
            assert!(things[0] < wires[0] && wires[0] < things[1]);
            for list in [things, wires] {
                let gaps: Vec<f32> = list.windows(2).map(|w| w[1] - w[0]).collect();
                assert!(gaps.iter().all(|g| *g > 0.0));
                assert!(gaps.last() < gaps.first(), "{:?}", story.chapter);
            }
            let f = story.compose(things[0]);
            let lit = f.things_at.iter().filter(|t| t[1] > 0.0).count();
            assert_eq!(lit, things.len());
            // The thing's place is where the glass is as it passes.
            assert!(close(f.things_at[0][0], f.sphere.z, 1e-3));
        }
        // The cover starts and ends quiet: nothing but the rings.
        let story = Story::new(Chapter::Hero);
        for t in [0.0, 4.0, HERO_LOOP - 4.0] {
            let f = story.compose(t);
            assert!(f.tentacles.iter().all(|w| w.light == 0.0), "{t}");
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
