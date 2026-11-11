//! «Дом в разрезе»: Step 7 page 10 «В быту», the last scene. A model of a
//! five-storey house cut open along its front stands on a black lacquer
//! table: a stairwell with a lift, a shop and a workshop below, neighbours
//! in their rooms, a tram stop in the street, a running track on the roof.
//! One man goes through the house and through one day: an argument in the
//! kitchen (his second ring trembles and steadies), a tram that honks at
//! him (the first ring holds), the queue in the shop, his child knocking a
//! cup off the table (the third ring flashes, he catches it), deadlines
//! burning over his desk, a run on the roof at sunset. Then a line of light
//! draws his way through the house with a bead at each of the six places,
//! the three rings strike together and the rooms he passed through flash;
//! the walls melt into one space; the camera sinks to the table and the
//! house and its reflection join into one.
//!
//! The pure core lives here, in `house.rs` (the model) and `story.rs` (the
//! day): every number the shaders read. `browser.rs` only binds them to
//! WebGL2. Metres at human scale; x along the street, up +y, the street
//! toward the eye (+z); the house's open front is at z = 0.
pub mod act;
pub mod body;
pub mod cast;
pub mod house;
pub mod math;
pub mod props;
pub mod story;

#[cfg(target_arch = "wasm32")]
mod browser;

use house::{cell, Prim};
use math::{v3, V3};
pub use story::{Figure, Frame, Story};
use watcher_scene_palette::Palette;

/// What the day grew by once he stopped skipping places (he walks home
/// from the shop, and from his desk up to the roof): every moment of the
/// evening and the finale comes this much later than in the first cut.
pub const DAY_EXTRA: f32 = 39.0;
/// One loop: the whole day, three minutes and a little more.
pub const LOOP: f32 = 271.9;
/// The finale after he stops running.
pub const FINALE: f32 = 34.0;

/// The lens: the whole 3:2 frame stays in view on a canvas of any shape.
pub const FRAME_ASPECT: f32 = 1.5;
/// The world is drawn at most this wide (px) and at this share of the
/// canvas, then blurred by the lens and scaled up.
pub const WORLD_SCALE: f32 = 0.6;
pub const WORLD_WIDTH: f32 = 1200.0;
/// The widest blur of the lens, px of the world's frame, and how densely
/// the lens's spiral gathers (smaller is denser).
pub const BLUR_MAX: f32 = 14.0;
pub const RAD_SCALE: f32 = 1.1;
/// The frame's exposure: how much the finished light is raised.
pub const EXPOSURE: f32 = 1.3;
/// How much of the frame's light blooms round its brightest points.
pub const BLOOM: f32 = 0.11;
/// Light a byte target keeps of each pass when the GPU cannot draw into
/// half floats.
pub const BYTE_KEEP: f32 = 0.5;

/// The scene's data texture: 32-bit float texels, this many to a row.
pub const DATA_W: usize = 512;
/// People at most in one frame, and the cones of one.
pub const FIGS: usize = 12;
pub const FIG_TEXELS: usize = 3 * body::PRIMITIVES;
/// Moving primitives at most (the tram's and the rest's together), and
/// their groups.
pub const MOVERS: usize = 96;
pub const MOVER_GROUPS: usize = 48;
/// A group's primitives at most, and how wide it may grow (metres).
const GROUP_MAX: usize = 8;
const GROUP_SPAN: f32 = 1.8;
/// Primitives this big (half size, metres) or walls and slabs stand alone.
const BIG: f32 = 0.9;
/// The rows the moving part of the texture takes.
pub const DYN_TEXELS: usize = 2 * MOVER_GROUPS + 3 * MOVERS + FIGS * FIG_TEXELS;
pub const DYN_ROWS: usize = DYN_TEXELS.div_ceil(DATA_W);
/// The lamps: one a cell, as `house::lamp_at` hangs them.
pub const LAMPS: usize = cell::COUNT;
/// The points of his way through the house that the line of light draws.
pub const PATH_POINTS: usize = 48;

/// The uniform slots the shaders read (common.glsl names them).
pub const SLOT_VIEW: usize = 4;
pub const SLOT_LAMPS: usize = 7;
pub const SLOT_PATH: usize = SLOT_LAMPS + LAMPS.div_ceil(4) + 21;
pub const SLOTS: usize = SLOT_PATH + PATH_POINTS;
// Every uniform of the world's programs fits the 224 vectors WebGL2
// promises a fragment shader, with room for ANGLE's own.
const _: () = assert!(SLOTS + 2 * cell::COUNT + 4 * FIGS + 8 <= 224);

/// Which page's loop plays: only page 10.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Chapter {
    /// Page 10 «В быту».
    Everyday,
}

impl Chapter {
    pub fn from_code(_code: u32) -> Chapter {
        Chapter::Everyday
    }
    pub fn loop_seconds(self) -> f32 {
        LOOP
    }
    /// Reduced motion holds this moment: the night house, the line of his
    /// day drawn through it, the three rings striking together round him on
    /// the roof and the rooms he went through lit.
    pub fn still(self) -> f32 {
        story::STILL
    }
}

/// The theme: how its light colours read the frame. The scene keeps its
/// cold light in the frame's luminance (the theme's one-colour recolor)
/// and its warm light apart, added back over it in `warm`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub warm: [f32; 3],
    /// The theme inks its light softly (Тишина, Астрал), as scene-palette's
    /// recolor does.
    pub soft: bool,
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

/// The app theme by its `graphicsPalette` code; the site shows only the
/// dark ones (0, 2, 3, 4), and a retired light code reads as Матрица.
pub fn look(code: u32) -> Look {
    let palette = Palette::from_code(code);
    let soft = palette.mode() == 2.0;
    let warm = match palette {
        // Lamplight: an ember on Искра, pale gold on Тишина, a rose glow
        // on Астрал, amber against Матрица's green.
        Palette::Dark => rgb(255, 136, 56),
        Palette::Neutral => rgb(244, 198, 140),
        Palette::Violet => rgb(246, 170, 146),
        _ => rgb(255, 192, 86),
    };
    Look { warm, soft }
}

/// The palette code the recolor runs with: retired light themes fall back
/// to Матрица.
pub fn recolor_code(code: u32) -> u32 {
    if Palette::from_code(code).is_light() {
        4
    } else {
        code
    }
}

/// One frame's numbers for the shaders, slot by slot (common.glsl).
pub fn pack(f: &Frame) -> [[f32; 4]; SLOTS] {
    let mut s = [[0.0; 4]; SLOTS];
    let v = |p: V3, w: f32| [p.x, p.y, p.z, w];
    s[0] = v(f.eye, f.focus);
    s[1] = v(f.right, f.time);
    s[2] = v(f.up, f.aperture);
    s[3] = v(f.forward, f.lens);
    // s[SLOT_VIEW] is the canvas's and the theme's: browser.rs fills it.
    s[5] = v(f.sun, f.sun_amount);
    s[6] = f.day;
    for (i, l) in f.lamps.iter().enumerate() {
        s[SLOT_LAMPS + i / 4][i % 4] = *l;
    }
    let mut k = SLOT_LAMPS + LAMPS.div_ceil(4);
    for slot in [
        v(f.hero, f.rings_seen),
        f.ring1,
        f.ring1b,
        f.ring2,
        f.ring2b,
        f.ring3,
        f.ring3b,
        f.ring_events,
        f.chord,
        f.path,
        f.melt,
        f.sparks,
        f.spark_to,
        f.desk,
        f.tram,
        f.motion,
        f.cup,
        f.steam,
        f.honk,
        f.coin,
        f.lift,
    ] {
        s[k] = slot;
        k += 1;
    }
    debug_assert_eq!(k, SLOT_PATH);
    for (i, p) in f.route.iter().enumerate() {
        s[SLOT_PATH + i] = *p;
    }
    s
}

/// A group of primitives near each other: the shader tests its box first.
#[derive(Clone, Debug, PartialEq)]
pub struct Group {
    pub lo: V3,
    pub hi: V3,
    pub prims: Vec<Prim>,
}

fn union(a: (V3, V3), b: (V3, V3)) -> (V3, V3) {
    (a.0.min(b.0), a.1.max(b.1))
}

/// A cell's primitives in groups: walls, slabs and anything big alone,
/// the small ones in the order they were built (a chair's parts, a
/// table's legs) as long as a group stays small.
pub fn group(prims: &[Prim]) -> Vec<Group> {
    let mut groups: Vec<Group> = Vec::new();
    let mut open: Option<usize> = None;
    for p in prims {
        let b = p.bounds();
        let size = (b.1 - b.0) * 0.5;
        let big = size.x.max(size.y).max(size.z) > BIG
            || p.flags & (house::flag::WALL | house::flag::SLAB) != 0;
        if big {
            groups.push(Group {
                lo: b.0,
                hi: b.1,
                prims: vec![*p],
            });
            continue;
        }
        if let Some(i) = open {
            let g = &mut groups[i];
            let (lo, hi) = union((g.lo, g.hi), b);
            let span = hi - lo;
            if g.prims.len() < GROUP_MAX && span.x.max(span.y).max(span.z) <= GROUP_SPAN {
                g.lo = lo;
                g.hi = hi;
                g.prims.push(*p);
                continue;
            }
        }
        groups.push(Group {
            lo: b.0,
            hi: b.1,
            prims: vec![*p],
        });
        open = Some(groups.len() - 1);
    }
    groups
}

/// The scene as the shaders read it: the data texture's still part (the
/// groups and primitives of every cell that never moves) and the cell
/// table, where the moving cells are filled each frame.
pub struct Scene {
    pub texels: Vec<[f32; 4]>,
    pub cells: [[f32; 4]; 2 * cell::COUNT],
    /// The first texel of the moving part, at the start of a row.
    pub dynamic: usize,
}

/// A cell's entry: its box, its first group's texel and how many groups.
fn cell_entry(groups: &[Group], first: usize) -> [[f32; 4]; 2] {
    let mut lo = v3(1e5, 1e5, 1e5);
    let mut hi = v3(-1e5, -1e5, -1e5);
    for g in groups {
        lo = lo.min(g.lo);
        hi = hi.max(g.hi);
    }
    [
        [lo.x, lo.y, lo.z, first as f32],
        [hi.x, hi.y, hi.z, groups.len() as f32],
    ]
}

/// Writes `groups` at `at`: their two texels each, then their primitives'
/// three each. Returns the texel after them.
fn write_groups(texels: &mut [[f32; 4]], at: usize, groups: &[Group]) -> usize {
    let mut prim = at + 2 * groups.len();
    for (i, g) in groups.iter().enumerate() {
        texels[at + 2 * i] = [g.lo.x, g.lo.y, g.lo.z, prim as f32];
        texels[at + 2 * i + 1] = [g.hi.x, g.hi.y, g.hi.z, g.prims.len() as f32];
        for p in &g.prims {
            texels[prim..prim + 3].copy_from_slice(&p.texels());
            prim += 3;
        }
    }
    prim
}

fn texels_of(groups: &[Group]) -> usize {
    groups.iter().map(|g| 2 + 3 * g.prims.len()).sum()
}

impl Scene {
    pub fn new() -> Scene {
        let built = house::build();
        let mut texels = Vec::new();
        let mut cells = [[0.0; 4]; 2 * cell::COUNT];
        for (c, prims) in built.iter().enumerate() {
            if cell::DYNAMIC.contains(&c) {
                continue;
            }
            let groups = group(prims);
            let at = texels.len();
            texels.resize(at + texels_of(&groups), [0.0; 4]);
            write_groups(&mut texels, at, &groups);
            let [a, b] = cell_entry(&groups, at);
            cells[2 * c] = a;
            cells[2 * c + 1] = b;
        }
        let dynamic = texels.len().div_ceil(DATA_W) * DATA_W;
        texels.resize(dynamic, [0.0; 4]);
        Scene {
            texels,
            cells,
            dynamic,
        }
    }

    /// The texture's rows: the still ones and the moving ones.
    pub fn rows(&self) -> usize {
        self.dynamic / DATA_W + DYN_ROWS
    }

    /// The first texel of figure `i`'s cones.
    pub fn figure_texel(&self, i: usize) -> usize {
        self.dynamic + 2 * MOVER_GROUPS + 3 * MOVERS + i * FIG_TEXELS
    }

    /// This frame's moving rows (the moving cells' groups and primitives,
    /// the people's cones) and the cell table with the moving cells in it.
    pub fn moving(&self, f: &Frame) -> (Vec<[f32; 4]>, [[f32; 4]; 2 * cell::COUNT]) {
        let mut rows = vec![[0.0f32; 4]; DYN_ROWS * DATA_W];
        let mut cells = self.cells;
        let base = self.dynamic;
        // The moving cells' groups first, then their primitives.
        let mut all: Vec<(usize, Vec<Group>)> = Vec::new();
        for (k, &c) in cell::DYNAMIC.iter().enumerate() {
            all.push((c, group(&f.movers[k])));
        }
        let mut g_at = 0;
        let mut p_at = 2 * MOVER_GROUPS;
        for (c, groups) in &all {
            let room_g = MOVER_GROUPS - g_at;
            let room_p = MOVERS - (p_at - 2 * MOVER_GROUPS) / 3;
            let mut keep = Vec::new();
            let (mut ng, mut np) = (0, 0);
            for g in groups {
                if ng + 1 > room_g || np + g.prims.len() > room_p {
                    break;
                }
                ng += 1;
                np += g.prims.len();
                keep.push(g.clone());
            }
            for (i, g) in keep.iter().enumerate() {
                let gi = g_at + i;
                rows[2 * gi] = [g.lo.x, g.lo.y, g.lo.z, (base + p_at) as f32];
                rows[2 * gi + 1] = [g.hi.x, g.hi.y, g.hi.z, g.prims.len() as f32];
                for p in &g.prims {
                    rows[p_at..p_at + 3].copy_from_slice(&p.texels());
                    p_at += 3;
                }
            }
            let [a, b] = cell_entry(&keep, base + 2 * g_at);
            cells[2 * c] = a;
            cells[2 * c + 1] = b;
            g_at += keep.len();
        }
        for (i, fig) in f.figures.iter().take(FIGS).enumerate() {
            let at = self.figure_texel(i) - base;
            for (j, cone) in fig.body.cones.iter().enumerate() {
                rows[at + j] = *cone;
            }
        }
        (rows, cells)
    }

    /// The people for `u_fig`, four slots each: their box and first texel
    /// with their accent; their box's top and their clothes; the capsule
    /// round them for shadows (feet, head) and how much they are there.
    pub fn people(&self, f: &Frame) -> [[f32; 4]; 4 * FIGS] {
        let mut s = [[0.0; 4]; 4 * FIGS];
        for i in 0..FIGS {
            s[4 * i] = [1e5, 1e5, 1e5, 0.0];
            s[4 * i + 1] = [-1e5, -1e5, -1e5, 0.0];
        }
        for (i, fig) in f.figures.iter().take(FIGS).enumerate() {
            if fig.seen <= 0.0 {
                continue;
            }
            let b = &fig.body;
            let base = self.figure_texel(i) as f32;
            s[4 * i] = [
                b.low.x,
                b.low.y,
                b.low.z,
                base + 0.9 * fig.accent.clamp(0.0, 1.0),
            ];
            // The hair's code in the whole part, the clothes' shade in the
            // fraction.
            s[4 * i + 1] = [
                b.high.x,
                b.high.y,
                b.high.z,
                fig.hair + 0.9 * fig.clothes.clamp(0.0, 1.0),
            ];
            let feet = v3(b.pelvis.x, b.low.y + 0.15, b.pelvis.z);
            let head = v3(b.head.x, b.head.y - 0.12, b.head.z);
            s[4 * i + 2] = [feet.x, feet.y, feet.z, 0.2 * fig.scale];
            s[4 * i + 3] = [head.x, head.y, head.z, fig.seen];
        }
        s
    }
}

impl Default for Scene {
    fn default() -> Self {
        Scene::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_still_frame_is_in_the_loop() {
        let chapter = Chapter::from_code(0);
        assert!(chapter.still() > 0.0 && chapter.still() < chapter.loop_seconds());
    }

    #[test]
    fn every_dark_theme_has_its_warm_light() {
        for code in [0, 2, 3, 4] {
            let l = look(code);
            assert!(l.warm.iter().any(|&c| c > 0.5), "{code}");
            assert_eq!(recolor_code(code), code);
        }
        assert!(look(2).soft && look(3).soft && !look(4).soft && !look(0).soft);
        for code in [1, 5, 6] {
            assert_eq!(recolor_code(code), 4);
        }
    }

    #[test]
    fn every_primitive_sits_inside_its_group_and_its_cell() {
        let scene = Scene::new();
        for c in 0..cell::COUNT {
            if cell::DYNAMIC.contains(&c) {
                continue;
            }
            let [a, b] = [scene.cells[2 * c], scene.cells[2 * c + 1]];
            let (g0, gn) = (a[3] as usize, b[3] as usize);
            assert!(gn > 0, "cell {c} is empty");
            for g in 0..gn {
                let [lo, hi] = [scene.texels[g0 + 2 * g], scene.texels[g0 + 2 * g + 1]];
                for k in 0..3 {
                    assert!(lo[k] >= a[k] - 1e-4 && hi[k] <= b[k] + 1e-4);
                }
                let (p0, pn) = (lo[3] as usize, hi[3] as usize);
                assert!(pn > 0 && pn <= GROUP_MAX);
                for i in 0..pn {
                    let t = &scene.texels[p0 + 3 * i..p0 + 3 * i + 3];
                    let kind = t[0][3] as u32 % 64;
                    assert!(kind <= house::kind::WINDOW, "{c} {g} {i}");
                    // The shader draws no stairs or leaves of its own.
                    assert!(kind != house::kind::STAIRS && kind != house::kind::LEAVES);
                }
            }
        }
        assert_eq!(scene.dynamic % DATA_W, 0);
        assert!(scene.rows() <= 16, "{}", scene.rows());
    }

    #[test]
    fn the_moving_cells_and_the_people_fit() {
        let scene = Scene::new();
        let story = Story::new(Chapter::Everyday);
        for i in 0..360 {
            let f = story.compose(i as f32 * 0.5);
            assert!(f.figures.len() <= FIGS, "{}", f.figures.len());
            let n: usize = f.movers.iter().map(|m| m.len()).sum();
            assert!(n <= MOVERS, "{n} at {}", i as f32 * 0.5);
            let groups: usize = f.movers.iter().map(|m| group(m).len()).sum();
            assert!(groups <= MOVER_GROUPS, "{groups} at {}", i as f32 * 0.5);
            let (rows, cells) = scene.moving(&f);
            assert_eq!(rows.len(), DYN_ROWS * DATA_W);
            for &c in &cell::DYNAMIC {
                assert!(cells[2 * c + 1][3] >= 0.0);
            }
        }
    }

    #[test]
    fn the_frame_packs() {
        let f = Story::new(Chapter::Everyday).compose(30.0);
        let s = pack(&f);
        assert!(s.iter().flatten().all(|v| v.is_finite()));
    }
}
