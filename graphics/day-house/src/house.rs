//! The model: a five-storey house cut open along its front (z = 0), the
//! street in front of it, a yard behind it and a painted backdrop, all on a
//! plinth on a black lacquer table. Metres at human scale: the miniature
//! is in the lens, not in the numbers. x runs left to right along the
//! street, up is +y, the street is toward the eye (+z).
//!
//! Everything is a list of primitives (boxes, cylinders, ellipsoids and a
//! few shapes the shader marches), grouped in cells: one per room, the
//! roof, the lift, the street in three parts, the yard, the plinth and the
//! tram. The shader tests a cell's box first and only then its primitives.
use crate::math::{v3, V3};
use std::f32::consts::{FRAC_PI_2, PI, TAU};

/// One storey, its slab, and the room's height under the next slab.
pub const STOREY: f32 = 3.0;
pub const SLAB: f32 = 0.24;
pub const ROOM_H: f32 = STOREY - SLAB;
pub const FLOORS: usize = 5;
pub const ROOF: f32 = STOREY * FLOORS as f32;
/// The back wall's inner and outer faces, the side walls' inner and outer.
pub const BACK: f32 = -4.6;
pub const BACK_OUT: f32 = -4.9;
pub const SIDE: f32 = 9.6;
pub const SIDE_OUT: f32 = 9.9;
/// The three columns of rooms: the stairwell, room A, room B (x from, to).
pub const COLUMNS: [[f32; 2]; 3] = [[-9.6, -5.6], [-5.6, 1.6], [1.6, 9.6]];
/// A partition's half thickness; its door (z from, to) and the door's height.
pub const WALL: f32 = 0.1;
pub const DOOR: [f32; 2] = [-2.0, -1.0];
pub const DOOR_H: f32 = 2.1;
/// The back windows: half width, sill and lintel over the floor, and the
/// window centres of each column.
pub const WINDOW_HALF: f32 = 0.65;
pub const SILL: f32 = 0.9;
pub const LINTEL: f32 = 2.5;
pub const WINDOWS: [&[f32]; 3] = [&[-7.6], &[-3.8, -0.2], &[3.6, 7.6]];
/// The near sidewalk ends and the far one starts (z); the road's surface
/// (the plinth's top) under the sidewalks' (y = 0); the tram's track.
pub const NEAR_WALK: f32 = 2.2;
pub const FAR_WALK: f32 = 5.75;
pub const ROAD_Y: f32 = -0.1;
pub const TRACK_Z: f32 = 4.3;
pub const GAUGE: f32 = 1.435;
/// The plinth: x from, to; z from, to. Its foot stands on the table.
pub const PLINTH: [f32; 4] = [-16.0, 16.0, -8.2, 8.4];
pub const TABLE: f32 = -1.0;
pub const BACKDROP_Z: f32 = -8.1;
/// The backdrop's half width and top: wider and taller than the plinth, so
/// no shot sees its edges; its painting fades out into the dark before them.
pub const BACKDROP_HALF: f32 = 26.0;
pub const BACKDROP_TOP: f32 = 30.0;
/// The lift's cage in the stairwell (x from, to; z from, to), its height,
/// and the top of its shaft in the machine room on the roof.
pub const CAGE: [f32; 4] = [-9.35, -7.65, -1.95, -0.25];
pub const CAGE_H: f32 = 2.3;
pub const SHAFT_TOP: f32 = ROOF + 2.6;
/// The inner stair of his flat from the living room (storey 3, room B) up
/// to the study (storey 4, room B): open treads along the back wall,
/// rising toward the right. Its x at the foot and at the top, its middle
/// line, its half width, and its steps.
pub const STAIR_X: [f32; 2] = [4.3, 7.9];
pub const STAIR_Z: f32 = -4.08;
pub const STAIR_HALF: f32 = 0.5;
pub const STAIR_STEPS: f32 = 14.0;
/// His desk in the study: its x and z, and his chair's z behind it.
pub const DESK: [f32; 3] = [3.9, -2.4, -3.25];
/// The stair's well in the study's floor: along x from where a head clears
/// the slab to the top step, from the back wall to its front edge.
pub const WELL_X: [f32; 2] = [5.2, 7.9];
pub const WELL_Z: f32 = -3.55;
/// The lift's shaft through the stairwell's floors (x from, to; z from).
pub const SHAFT: [f32; 3] = [-9.45, -7.55, -2.05];
/// The roof's running track: an oval round (x, z) with straights this half
/// long and ends of this radius at the lane's middle.
pub const TRACK: [f32; 4] = [2.1, -2.5, 4.4, 1.4];

/// What a primitive is: the shader intersects the first three exactly and
/// marches the others inside their box.
pub mod kind {
    pub const BOX: u32 = 0;
    pub const CYL: u32 = 1;
    pub const BALL: u32 = 2;
    pub const TORUS: u32 = 3;
    pub const CONE: u32 = 4;
    pub const STAIRS: u32 = 5;
    pub const SHELF: u32 = 6;
    pub const CAGE: u32 = 7;
    pub const LEAVES: u32 = 8;
    pub const WINDOW: u32 = 9;
}

/// What it is made of; the shader shades each its own way.
pub mod mat {
    pub const PLASTER: u32 = 0;
    pub const TILE: u32 = 1;
    pub const BOARDS: u32 = 2;
    pub const WOOD: u32 = 3;
    pub const FABRIC: u32 = 4;
    pub const METAL: u32 = 5;
    pub const BRASS: u32 = 6;
    pub const LAMP: u32 = 7;
    pub const SCREEN: u32 = 8;
    pub const PAPER: u32 = 9;
    pub const CERAMIC: u32 = 10;
    pub const PLANT: u32 = 11;
    pub const BREAD: u32 = 12;
    pub const GOODS: u32 = 13;
    pub const BOOKS: u32 = 14;
    pub const BRICK: u32 = 15;
    pub const PAVING: u32 = 16;
    pub const RAIL: u32 = 17;
    pub const TRAM: u32 = 18;
    pub const PLINTH: u32 = 19;
    pub const BACKDROP: u32 = 20;
    pub const ROOF: u32 = 21;
    pub const GRASS: u32 = 22;
    pub const RUG: u32 = 23;
    pub const CANVAS: u32 = 24;
    pub const FRAME: u32 = 25;
    pub const CLOTH: u32 = 26;
    pub const CALENDAR: u32 = 27;
    pub const SIGN: u32 = 28;
    pub const DARK: u32 = 29;
    pub const GLASS: u32 = 30;
    pub const BARK: u32 = 31;
    pub const TOY: u32 = 32;
    pub const FUR: u32 = 33;
    pub const STONE: u32 = 34;
    pub const FRIDGE: u32 = 35;
    pub const STREETLAMP: u32 = 36;
}

/// Flags in a primitive's tag (its whole part; the fraction is a tone).
pub mod flag {
    /// A wall or a partition: it melts in the finale.
    pub const WALL: u32 = 1;
    /// A floor slab: it melts into a plane of light.
    pub const SLAB: u32 = 2;
    /// Too thin to shade anything under it (rugs, papers, paint).
    pub const FLAT: u32 = 4;
    /// Glossy: lamps and the sky show in it.
    pub const GLOSS: u32 = 8;
    /// Street furniture the eye passes through when it is this near: a
    /// pole across the lens would only be a blurred bar over the frame.
    pub const NEAR: u32 = 16;
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Prim {
    pub kind: u32,
    pub mat: u32,
    /// Centre and half size in its own frame.
    pub c: V3,
    pub h: V3,
    /// Turned about the upright, then tipped about its own x.
    pub yaw: f32,
    pub pitch: f32,
    /// What its kind needs (a torus's tube, a cone's top, steps, shelf items).
    pub a: f32,
    pub b: f32,
    pub flags: u32,
    /// 0 … 1: which shade of its material.
    pub tone: f32,
}

impl Prim {
    pub fn new(kind: u32, mat: u32, c: V3, h: V3) -> Prim {
        Prim {
            kind,
            mat,
            c,
            h,
            yaw: 0.0,
            pitch: 0.0,
            a: 0.0,
            b: 0.0,
            flags: 0,
            tone: 0.5,
        }
    }
    pub fn yaw(mut self, yaw: f32) -> Prim {
        self.yaw = yaw;
        self
    }
    pub fn pitch(mut self, pitch: f32) -> Prim {
        self.pitch = pitch;
        self
    }
    pub fn ab(mut self, a: f32, b: f32) -> Prim {
        self.a = a;
        self.b = b;
        self
    }
    pub fn flags(mut self, flags: u32) -> Prim {
        self.flags |= flags;
        self
    }
    pub fn tone(mut self, tone: f32) -> Prim {
        self.tone = tone.clamp(0.0, 0.99);
        self
    }
    /// Its own frame's axes in the world: x, y, z.
    pub fn axes(&self) -> [V3; 3] {
        let (sy, cy) = self.yaw.sin_cos();
        let (sp, cp) = self.pitch.sin_cos();
        let world = |v: V3| {
            let a = v3(v.x, cp * v.y - sp * v.z, sp * v.y + cp * v.z);
            v3(cy * a.x + sy * a.z, a.y, -sy * a.x + cy * a.z)
        };
        [
            world(v3(1.0, 0.0, 0.0)),
            world(v3(0.0, 1.0, 0.0)),
            world(v3(0.0, 0.0, 1.0)),
        ]
    }
    /// The box round it in the world.
    pub fn bounds(&self) -> (V3, V3) {
        let [x, y, z] = self.axes();
        let e = v3(
            (x.x * self.h.x).abs() + (y.x * self.h.y).abs() + (z.x * self.h.z).abs(),
            (x.y * self.h.x).abs() + (y.y * self.h.y).abs() + (z.y * self.h.z).abs(),
            (x.z * self.h.x).abs() + (y.z * self.h.y).abs() + (z.z * self.h.z).abs(),
        );
        (self.c - e, self.c + e)
    }
    /// Three texels: centre and kind with material; half size and yaw;
    /// pitch, its two numbers, flags with tone.
    pub fn texels(&self) -> [[f32; 4]; 3] {
        [
            [
                self.c.x,
                self.c.y,
                self.c.z,
                (self.kind + 64 * self.mat) as f32,
            ],
            [self.h.x, self.h.y, self.h.z, self.yaw],
            [self.pitch, self.a, self.b, self.flags as f32 + self.tone],
        ]
    }
}

/// A box from its two corners.
pub fn slab(mat: u32, lo: V3, hi: V3) -> Prim {
    Prim::new(kind::BOX, mat, (lo + hi) * 0.5, (hi - lo) * 0.5)
}
pub fn cube(mat: u32, c: V3, h: V3) -> Prim {
    Prim::new(kind::BOX, mat, c, h)
}
/// An upright cylinder: centre, radius, half height.
pub fn cyl(mat: u32, c: V3, r: f32, half: f32) -> Prim {
    Prim::new(kind::CYL, mat, c, v3(r, half, r))
}
pub fn ball(mat: u32, c: V3, r: V3) -> Prim {
    Prim::new(kind::BALL, mat, c, r)
}
/// A cylinder lying along x (or turned by yaw): a rod, a roll, a log.
pub fn rod(mat: u32, c: V3, r: f32, half: f32) -> Prim {
    Prim::new(kind::CYL, mat, c, v3(r, half, r)).pitch(FRAC_PI_2)
}
/// A lampshade or a pot: an upright cone, bottom radius `r`, top `r·top`.
pub fn cone(mat: u32, c: V3, r: f32, half: f32, top: f32) -> Prim {
    Prim::new(kind::CONE, mat, c, v3(r.max(r * top), half, r.max(r * top))).ab(top, 0.0)
}

/// The cells, in the order the shader reads them.
pub mod cell {
    /// Rooms: column + 3·storey.
    pub const ROOMS: usize = 15;
    pub const ROOF: usize = 15;
    pub const LIFT: usize = 16;
    pub const STREET_L: usize = 17;
    pub const STREET_M: usize = 18;
    pub const STREET_R: usize = 19;
    pub const YARD: usize = 20;
    pub const PLINTH: usize = 21;
    pub const TRAM: usize = 22;
    /// Whatever else moves: the lift's cage, the cup, the coin, the bread,
    /// the papers, the cat, the pigeons.
    pub const MOVE: usize = 23;
    pub const COUNT: usize = 24;
    /// The cells whose primitives the story moves every frame.
    pub const DYNAMIC: [usize; 2] = [TRAM, MOVE];
    /// The room in column `col` (0 stairwell, 1 A, 2 B) of storey `k`.
    pub const fn room(col: usize, k: usize) -> usize {
        col + 3 * k
    }
}

/// Where each cell's lamp hangs: one light a room, and the street's lamps,
/// the roof's string of bulbs, the tram's own light.
pub fn lamp_at(c: usize) -> V3 {
    if c < cell::ROOMS {
        let (col, k) = (c % 3, c / 3);
        let y = STOREY * k as f32;
        return match (col, k) {
            (1, 0) => v3(-2.0, y + 2.3, -2.4),
            (2, 0) => v3(5.6, y + 2.0, -3.6),
            (1, 1) => v3(-1.2, y + 1.5, -2.95),
            (2, 1) => v3(3.3, y + 1.6, -4.1),
            (1, 3) => v3(-1.8, y + 2.0, -3.0),
            (2, 3) => v3(9.15, y + 1.5, -3.25),
            (1, 4) => v3(-0.65, y + 0.75, -4.2),
            (2, 4) => v3(DESK[0] - 0.6, y + 1.12, DESK[1] + 0.05),
            (0, _) => v3(-6.6, y + 2.4, -1.2),
            _ => {
                let [a, b] = COLUMNS[col];
                v3(0.5 * (a + b), y + 2.25, -2.4)
            }
        };
    }
    match c {
        cell::ROOF => v3(2.1, ROOF + 2.3, -2.45),
        cell::STREET_L => v3(-11.5, 3.0, 1.4),
        cell::STREET_M => v3(-0.5, 3.0, 1.4),
        cell::STREET_R => v3(11.5, 3.0, 1.4),
        _ => v3(0.0, -50.0, 0.0),
    }
}

/// The scene's static cells: everything that never moves.
pub fn build() -> Vec<Vec<Prim>> {
    let mut cells = vec![Vec::new(); cell::COUNT];
    for k in 0..FLOORS {
        for col in 0..3 {
            shell(&mut cells[cell::room(col, k)], col, k);
        }
    }
    stairwell(&mut cells);
    shop(&mut cells[cell::room(1, 0)]);
    workshop(&mut cells[cell::room(2, 0)]);
    old_man(&mut cells[cell::room(1, 1)]);
    cellist(&mut cells[cell::room(2, 1)]);
    garden(&mut cells[cell::room(1, 2)]);
    painter(&mut cells[cell::room(2, 2)]);
    kitchen(&mut cells[cell::room(1, 3)]);
    living(&mut cells[cell::room(2, 3)]);
    bedroom(&mut cells[cell::room(1, 4)]);
    study(&mut cells[cell::room(2, 4)]);
    roof(&mut cells[cell::ROOF]);
    lift_shaft(&mut cells[cell::LIFT]);
    street(&mut cells);
    yard(&mut cells[cell::YARD]);
    cells[cell::PLINTH].push(
        slab(
            mat::PLINTH,
            v3(PLINTH[0], TABLE, PLINTH[2]),
            v3(PLINTH[1], ROAD_Y, PLINTH[3]),
        )
        .flags(flag::SLAB),
    );
    cells
        .into_iter()
        .map(|c| c.into_iter().flat_map(lower).collect())
        .collect()
}

/// The shapes the shader does not draw itself (each would cost Chrome on
/// Windows seconds to compile): a flight of stairs becomes its steps, a
/// crown of leaves a cluster of balls.
pub fn lower(p: Prim) -> Vec<Prim> {
    match p.kind {
        kind::STAIRS => steps(&p),
        kind::LEAVES => crown(&p),
        _ => vec![p],
    }
}

/// A point of `p`'s own frame in the world.
fn place(p: &Prim, local: V3) -> V3 {
    let [x, y, z] = p.axes();
    p.c + x * local.x + y * local.y + z * local.z
}

/// `a` steps rising toward the flight's own +x: open treads (a board each,
/// `b` = 1) or solid.
fn steps(p: &Prim) -> Vec<Prim> {
    let k = (p.a.round() as usize).max(1);
    let open = p.b > 0.5;
    let h = p.h;
    let w = 2.0 * h.x / k as f32;
    let rise = 2.0 * h.y / k as f32;
    (0..k)
        .map(|i| {
            let top = -h.y + rise * (i + 1) as f32;
            let bottom = if open { top - 0.05 } else { -h.y };
            let lo = v3(-h.x + w * i as f32, bottom, -h.z);
            let hi = v3(lo.x + w + if open { 0.03 } else { 0.0 }, top, h.z);
            Prim {
                kind: kind::BOX,
                c: place(p, (lo + hi) * 0.5),
                h: (hi - lo) * 0.5,
                a: 0.0,
                b: 0.0,
                ..*p
            }
        })
        .collect()
}

/// A crown of leaves in its box: a core and clumps round it, placed
/// by its seed `b`, lumpier with a larger `a`.
fn crown(p: &Prim) -> Vec<Prim> {
    let h = p.h;
    let seed = p.b;
    let hash = |j: f32| {
        ((seed * 12.989 + j * 78.233).sin() * 43_758.547)
            .fract()
            .abs()
    };
    let ball = |c: V3, r: V3, tone: f32| Prim {
        kind: kind::BALL,
        c: place(p, c),
        h: r,
        a: 0.0,
        b: 0.0,
        tone: tone.clamp(0.0, 0.99),
        ..*p
    };
    let core = 0.74 - 0.2 * p.a;
    let mut out = vec![ball(v3(0.0, -0.05 * h.y, 0.0), h * core, p.tone)];
    // A pot plant's crown is small: four clumps read as leaves there.
    let clumps = if h.x.max(h.y).max(h.z) < 0.45 { 4 } else { 7 };
    for j in 0..clumps {
        let jf = j as f32;
        let turn = seed * 1.7 + jf * TAU / clumps as f32;
        let up = if j % 2 == 0 { 0.45 } else { -0.2 } + 0.2 * hash(jf);
        let r = 0.36 + 0.12 * hash(jf + 9.0);
        let reach = 1.0 - r;
        let u = v3(up.cos() * turn.cos(), up.sin(), up.cos() * turn.sin());
        let c = v3(h.x * u.x * reach, h.y * u.y * reach, h.z * u.z * reach);
        out.push(ball(c, h * r, p.tone + 0.16 * (hash(jf + 3.0) - 0.5)));
    }
    out
}

/// A room's floor slab, back wall with its windows, the partition on its
/// left (with a door from storey 1 up) and the outer wall of an end column.
fn shell(out: &mut Vec<Prim>, col: usize, k: usize) {
    let y = STOREY * k as f32;
    let [x0, x1] = COLUMNS[col];
    let left = if col == 0 { -SIDE_OUT } else { x0 + WALL };
    let right = if col == 2 { SIDE_OUT } else { x1 - WALL };
    let floor = if (col == 1 && (k == 0 || k == 3)) || (col == 0 && k == 0) {
        mat::TILE
    } else {
        mat::BOARDS
    };
    let tone = (col * 5 + k) as f32 * 0.137 % 1.0;
    // The slab under the room, with the inner stair's well in his study
    // and the lift's shaft through the stairwell's upper floors.
    let sx0 = if col == 0 { -SIDE_OUT } else { x0 - WALL };
    let sx1 = if col == 2 { SIDE_OUT } else { x1 + WALL };
    let piece = |lo: V3, hi: V3| slab(floor, lo, hi).flags(flag::SLAB).tone(tone);
    if col == 2 && k == 4 {
        let [a, b] = WELL_X;
        out.push(piece(v3(sx0, y - SLAB, BACK_OUT), v3(a, y, 0.0)));
        out.push(piece(v3(a, y - SLAB, WELL_Z), v3(b, y, 0.0)));
        out.push(piece(v3(a, y - SLAB, BACK_OUT), v3(b, y, BACK)));
        out.push(piece(v3(b, y - SLAB, BACK_OUT), v3(sx1, y, 0.0)));
    } else if col == 0 && k > 0 {
        let [a, b, z] = SHAFT;
        out.push(piece(v3(sx0, y - SLAB, BACK_OUT), v3(a, y, 0.0)));
        out.push(piece(v3(a, y - SLAB, BACK_OUT), v3(b, y, z)));
        out.push(piece(v3(b, y - SLAB, BACK_OUT), v3(sx1, y, 0.0)));
    } else {
        out.push(
            slab(floor, v3(sx0, y - SLAB, BACK_OUT), v3(sx1, y, 0.0))
                .flags(flag::SLAB)
                .tone(tone),
        );
    }
    // The back wall: under the sills, over the lintels, the piers between.
    let wall = |lo: V3, hi: V3| slab(mat::PLASTER, lo, hi).flags(flag::WALL).tone(tone);
    let windows: &[f32] = if col == 1 && k == 0 {
        &[]
    } else {
        WINDOWS[col]
    };
    if windows.is_empty() {
        out.push(wall(v3(left, y, BACK_OUT), v3(right, y + ROOM_H, BACK)));
    } else {
        out.push(wall(v3(left, y, BACK_OUT), v3(right, y + SILL, BACK)));
        out.push(wall(
            v3(left, y + LINTEL, BACK_OUT),
            v3(right, y + ROOM_H, BACK),
        ));
        let mut from = left;
        for &w in windows {
            out.push(wall(
                v3(from, y + SILL, BACK_OUT),
                v3(w - WINDOW_HALF, y + LINTEL, BACK),
            ));
            out.push(
                Prim::new(
                    kind::WINDOW,
                    mat::FRAME,
                    v3(w, y + 0.5 * (SILL + LINTEL), 0.5 * (BACK + BACK_OUT)),
                    v3(WINDOW_HALF, 0.5 * (LINTEL - SILL), 0.5 * (BACK - BACK_OUT)),
                )
                .flags(flag::WALL),
            );
            // The sill inside.
            out.push(
                slab(
                    mat::FRAME,
                    v3(w - WINDOW_HALF - 0.05, y + SILL - 0.04, BACK - 0.0),
                    v3(w + WINDOW_HALF + 0.05, y + SILL, BACK + 0.12),
                )
                .flags(flag::WALL),
            );
            from = w + WINDOW_HALF;
        }
        out.push(wall(
            v3(from, y + SILL, BACK_OUT),
            v3(right, y + LINTEL, BACK),
        ));
    }
    // The partition on the left of rooms A and B.
    if col > 0 {
        let (a, b) = (x0 - WALL, x0 + WALL);
        let door = k > 0 || col == 0;
        if door {
            out.push(wall(v3(a, y, BACK), v3(b, y + ROOM_H, DOOR[0])));
            out.push(wall(v3(a, y, DOOR[1]), v3(b, y + ROOM_H, 0.0)));
            out.push(wall(v3(a, y + DOOR_H, DOOR[0]), v3(b, y + ROOM_H, DOOR[1])));
        } else {
            out.push(wall(v3(a, y, BACK), v3(b, y + ROOM_H, 0.0)));
        }
    }
    if col == 0 {
        out.push(wall(v3(-SIDE_OUT, y, BACK_OUT), v3(-SIDE, y + ROOM_H, 0.0)));
    }
    if col == 2 {
        out.push(wall(v3(SIDE, y, BACK_OUT), v3(SIDE_OUT, y + ROOM_H, 0.0)));
    }
    // A pendant lamp in the rooms that have no lamp of their own.
    let own = matches!(
        (col, k),
        (1, 1) | (2, 1) | (2, 3) | (1, 4) | (2, 4) | (2, 0)
    );
    if !own {
        let l = lamp_at(cell::room(col, k));
        out.push(cyl(
            mat::DARK,
            v3(l.x, 0.5 * (l.y + 0.2 + y + ROOM_H), l.z),
            0.006,
            0.5 * (y + ROOM_H - l.y - 0.2),
        ));
        out.push(cone(mat::LAMP, l + v3(0.0, 0.12, 0.0), 0.22, 0.1, 0.35).flags(flag::GLOSS));
    }
}

/// The stairs behind the lift on every storey, the lobby's mailboxes and
/// the ground floor's glass front with its frames, the shop's awning.
fn stairwell(cells: &mut [Vec<Prim>]) {
    for k in 0..FLOORS {
        let y = STOREY * k as f32;
        let out = &mut cells[cell::room(0, k)];
        let half = 0.5 * STOREY;
        // Up toward the left, then back toward the right over the landing.
        out.push(
            Prim::new(
                kind::STAIRS,
                mat::STONE,
                v3(-7.3, y + 0.5 * half, -2.9),
                v3(1.45, 0.5 * half, 0.52),
            )
            .yaw(PI)
            .ab(9.0, 0.0),
        );
        out.push(slab(
            mat::STONE,
            v3(-SIDE, y + half - 0.16, BACK),
            v3(-8.75, y + half, -2.35),
        ));
        out.push(
            Prim::new(
                kind::STAIRS,
                mat::STONE,
                v3(-7.3, y + 1.5 * half, -4.05),
                v3(1.45, 0.5 * half, 0.52),
            )
            .ab(9.0, 0.0),
        );
        // Handrails along the flights.
        let rise = (half / 2.9_f32).atan();
        out.push(rail(v3(-7.3, y + 0.5 * half + 0.95, -2.4), 1.55, rise));
        out.push(rail(v3(-7.3, y + 1.5 * half + 0.95, -3.5), 1.55, -rise));
        // The landing's railing toward the lift.
        out.push(slab(mat::METAL, v3(-6.0, y, -2.36), v3(-5.75, y + 0.95, -2.3)).tone(0.2));
    }
    let lobby = &mut cells[cell::room(0, 0)];
    // Mailboxes on the partition, facing the lobby.
    lobby.push(
        Prim::new(
            kind::SHELF,
            mat::BRASS,
            v3(-5.82, 1.35, -0.55),
            v3(0.38, 0.32, 0.1),
        )
        .yaw(-FRAC_PI_2)
        .ab(0.19, 3.0)
        .tone(0.6),
    );
    lobby.push(
        slab(mat::RUG, v3(-7.3, 0.0, -0.9), v3(-6.3, 0.012, -0.1))
            .flags(flag::FLAT)
            .tone(0.15),
    );
    // The ground floor's front: frames round its glass, a band over them.
    for col in 0..3 {
        let out = &mut cells[cell::room(col, 0)];
        let [x0, x1] = COLUMNS[col];
        let (a, b) = (
            if col == 0 { -SIDE_OUT } else { x0 },
            if col == 2 { SIDE_OUT } else { x1 },
        );
        out.push(
            slab(mat::FRAME, v3(a, 2.35, -0.14), v3(b, ROOM_H, 0.0))
                .flags(flag::WALL)
                .tone(0.2),
        );
        let posts: &[f32] = match col {
            0 => &[-9.75, -7.42, -6.18],
            1 => &[-5.6, -3.3, -1.82, -0.58, 1.6],
            _ => &[1.6, 2.9, 7.1, 9.75],
        };
        for &p in posts {
            out.push(
                slab(
                    mat::FRAME,
                    v3(p - 0.06, 0.0, -0.14),
                    v3(p + 0.06, 2.35, 0.0),
                )
                .flags(flag::WALL | flag::NEAR)
                .tone(0.2),
            );
        }
        // Kick plates under the glass, none at the doors.
        let plates: &[[f32; 2]] = match col {
            0 => &[[-9.75, -7.42]],
            1 => &[[-5.6, -1.82], [-0.58, 1.6]],
            _ => &[[1.6, 2.9], [7.1, 9.75]],
        };
        for &[p, q] in plates {
            out.push(
                slab(mat::FRAME, v3(p, 0.0, -0.12), v3(q, 0.32, -0.02))
                    .flags(flag::WALL)
                    .tone(0.2),
            );
        }
    }
    let shop = &mut cells[cell::room(1, 0)];
    shop.push(slab(mat::SIGN, v3(-4.6, 2.4, 0.0), v3(-0.9, 2.7, 0.04)));
    // The awning over the shop's window, striped.
    shop.push(
        Prim::new(
            kind::BOX,
            mat::FABRIC,
            v3(-2.0, 2.66, 0.52),
            v3(3.5, 0.015, 0.56),
        )
        .pitch(0.38)
        .tone(0.45),
    );
    let gate = &mut cells[cell::room(2, 0)];
    gate.push(
        rod(mat::METAL, v3(5.0, 2.55, -0.25), 0.16, 2.1)
            .yaw(FRAC_PI_2)
            .tone(0.4),
    );
}

/// A handrail centred at `c`, `half` long along x, rising `slope` to the left.
fn rail(c: V3, half: f32, slope: f32) -> Prim {
    // Tipped about z: built along x by turning a box laid along z.
    Prim::new(
        kind::BOX,
        mat::WOOD,
        c,
        v3(0.025, 0.025, half / slope.cos()),
    )
    .yaw(FRAC_PI_2)
    .pitch(slope)
    .tone(0.3)
}

/// Four legs under a top: its centre and half size (x, z), its height.
fn legs(out: &mut Vec<Prim>, mat: u32, c: V3, hx: f32, hz: f32, h: f32, r: f32) {
    for (sx, sz) in [(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)] {
        out.push(
            cube(
                mat,
                v3(c.x + sx * (hx - r), c.y + 0.5 * h, c.z + sz * (hz - r)),
                v3(r, 0.5 * h, r),
            )
            .tone(0.35),
        );
    }
}

/// A table: top at height `h` over the floor `c.y`.
fn table(out: &mut Vec<Prim>, c: V3, hx: f32, hz: f32, h: f32, tone: f32) {
    out.push(cube(mat::WOOD, v3(c.x, c.y + h - 0.025, c.z), v3(hx, 0.025, hz)).tone(tone));
    legs(out, mat::WOOD, c, hx - 0.03, hz - 0.03, h - 0.05, 0.025);
}

/// A chair facing `yaw` (0 toward the street), seat centre over `c`.
pub fn chair(out: &mut Vec<Prim>, c: V3, yaw: f32, tone: f32) {
    let f = v3(yaw.sin(), 0.0, yaw.cos());
    out.push(
        cube(mat::WOOD, c + v3(0.0, 0.44, 0.0), v3(0.22, 0.025, 0.22))
            .yaw(yaw)
            .tone(tone),
    );
    out.push(
        cube(
            mat::WOOD,
            c + v3(0.0, 0.7, 0.0) - f * 0.2,
            v3(0.21, 0.22, 0.02),
        )
        .yaw(yaw)
        .tone(tone),
    );
    for (sx, sz) in [(-1.0f32, -1.0f32), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)] {
        let l = v3(f.z, 0.0, -f.x) * (0.18 * sx) + f * (0.18 * sz);
        out.push(
            cube(
                mat::WOOD,
                c + l + v3(0.0, 0.21, 0.0),
                v3(0.018, 0.21, 0.018),
            )
            .yaw(yaw)
            .tone(tone),
        );
    }
}

/// A potted plant: pot at `c` (on its floor), leaves `size` across.
fn plant(out: &mut Vec<Prim>, c: V3, size: f32, tone: f32) {
    let pot = 0.35 * size;
    out.push(
        cone(
            mat::CERAMIC,
            c + v3(0.0, 0.5 * pot, 0.0),
            0.3 * size,
            0.5 * pot,
            1.25,
        )
        .tone(0.2 + 0.6 * tone),
    );
    out.push(
        Prim::new(
            kind::LEAVES,
            mat::PLANT,
            c + v3(0.0, pot + 0.42 * size, 0.0),
            v3(0.5 * size, 0.5 * size, 0.5 * size),
        )
        .ab(0.25, tone * 7.0)
        .tone(tone),
    );
}

/// A sofa or an armchair facing `yaw`: seat centre `c` on its floor,
/// half width `hw`.
fn sofa(out: &mut Vec<Prim>, c: V3, hw: f32, yaw: f32, tone: f32) {
    let f = v3(yaw.sin(), 0.0, yaw.cos());
    let l = v3(f.z, 0.0, -f.x);
    out.push(
        cube(mat::FABRIC, c + v3(0.0, 0.25, 0.0), v3(hw, 0.2, 0.42))
            .yaw(yaw)
            .tone(tone),
    );
    out.push(
        cube(
            mat::FABRIC,
            c + v3(0.0, 0.62, 0.0) - f * 0.33,
            v3(hw, 0.36, 0.12),
        )
        .yaw(yaw)
        .tone(tone),
    );
    for s in [-1.0f32, 1.0] {
        out.push(
            cube(
                mat::FABRIC,
                c + v3(0.0, 0.4, 0.0) + l * (s * (hw - 0.08)),
                v3(0.09, 0.3, 0.42),
            )
            .yaw(yaw)
            .tone(tone),
        );
    }
    out.push(
        cube(
            mat::FABRIC,
            c + v3(0.0, 0.47, 0.04),
            v3(hw - 0.17, 0.05, 0.36),
        )
        .yaw(yaw)
        .tone((tone + 0.08).min(0.99)),
    );
}

/// A picture on a wall facing `normal` (toward the room).
fn picture(out: &mut Vec<Prim>, c: V3, w: f32, h: f32, yaw: f32, tone: f32) {
    out.push(cube(mat::CANVAS, c, v3(w, h, 0.015)).yaw(yaw).tone(tone));
}

fn floor_lamp(out: &mut Vec<Prim>, at: V3, height: f32) {
    out.push(cyl(mat::METAL, at + v3(0.0, 0.015, 0.0), 0.16, 0.015).tone(0.2));
    out.push(
        cyl(
            mat::METAL,
            at + v3(0.0, 0.5 * height, 0.0),
            0.015,
            0.5 * height,
        )
        .tone(0.2),
    );
    out.push(
        cone(
            mat::LAMP,
            at + v3(0.0, height + 0.08, 0.0),
            0.24,
            0.14,
            0.55,
        )
        .flags(flag::GLOSS),
    );
}

/// The shop on the ground floor of room A: the counter with its till and
/// scales, bread behind it, goods along the back wall, the drinks' fridge,
/// a stand of loaves in the window.
fn shop(out: &mut Vec<Prim>) {
    out.push(cube(mat::WOOD, v3(-4.3, 0.5, -2.15), v3(0.3, 0.5, 1.2)).tone(0.25));
    out.push(
        cube(mat::STONE, v3(-4.3, 1.02, -2.15), v3(0.36, 0.025, 1.26))
            .tone(0.7)
            .flags(flag::GLOSS),
    );
    out.push(cube(mat::METAL, v3(-4.38, 1.15, -2.85), v3(0.16, 0.1, 0.18)).tone(0.25));
    out.push(cube(mat::SCREEN, v3(-4.2, 1.3, -2.85), v3(0.012, 0.06, 0.1)).tone(0.4));
    out.push(
        cube(mat::METAL, v3(-4.25, 1.08, -1.3), v3(0.16, 0.03, 0.16))
            .tone(0.8)
            .flags(flag::GLOSS),
    );
    out.push(
        Prim::new(
            kind::SHELF,
            mat::BREAD,
            v3(-5.3, 1.25, -2.4),
            v3(1.15, 0.9, 0.18),
        )
        .yaw(FRAC_PI_2)
        .ab(0.32, 4.0),
    );
    out.push(
        Prim::new(
            kind::SHELF,
            mat::GOODS,
            v3(-1.75, 1.05, -4.38),
            v3(1.45, 1.05, 0.2),
        )
        .ab(0.13, 5.0)
        .tone(0.3),
    );
    out.push(
        Prim::new(
            kind::SHELF,
            mat::GOODS,
            v3(0.55, 1.05, -4.38),
            v3(0.85, 1.05, 0.2),
        )
        .ab(0.11, 5.0)
        .tone(0.7),
    );
    out.push(cube(mat::FRAME, v3(1.15, 1.0, -2.95), v3(0.32, 1.0, 0.55)).tone(0.85));
    out.push(cube(
        mat::FRIDGE,
        v3(0.82, 1.05, -2.95),
        v3(0.012, 0.86, 0.48),
    ));
    // Fruit in a basket by the door, loaves in the window.
    out.push(cyl(mat::WOOD, v3(0.4, 0.3, -1.2), 0.32, 0.3).tone(0.55));
    for (i, (dx, dz)) in [(-0.12, -0.05), (0.1, 0.06), (0.0, 0.14), (0.14, -0.1)]
        .iter()
        .enumerate()
    {
        out.push(
            ball(
                mat::TOY,
                v3(0.4 + dx, 0.66, -1.2 + dz),
                v3(0.075, 0.07, 0.075),
            )
            .tone(0.1 + 0.2 * i as f32),
        );
    }
    out.push(cube(mat::WOOD, v3(-3.6, 0.42, -0.42), v3(1.2, 0.42, 0.24)).tone(0.4));
    for i in 0..4 {
        out.push(
            ball(
                mat::BREAD,
                v3(-4.4 + 0.52 * i as f32, 0.94, -0.42),
                v3(0.2, 0.09, 0.11),
            )
            .tone(0.3 + 0.15 * i as f32),
        );
    }
    out.push(
        slab(mat::RUG, v3(-1.6, 0.0, -0.7), v3(-0.75, 0.012, -0.15))
            .flags(flag::FLAT)
            .tone(0.4),
    );
}

/// The bicycle workshop on the ground floor of room B.
fn workshop(out: &mut Vec<Prim>) {
    out.push(cube(mat::WOOD, v3(5.6, 0.45, -4.22), v3(1.7, 0.45, 0.36)).tone(0.2));
    out.push(cube(mat::WOOD, v3(5.6, 1.55, -4.57), v3(1.5, 0.55, 0.025)).tone(0.6));
    for i in 0..7 {
        let x = 4.4 + 0.38 * i as f32;
        let h = 0.12 + 0.05 * ((i * 7) % 4) as f32;
        out.push(
            cube(mat::METAL, v3(x, 1.75 - h, -4.53), v3(0.025, h, 0.02))
                .tone(0.3 + 0.08 * i as f32),
        );
    }
    // A bicycle on its stand, its wheels off the floor.
    bike(out, v3(4.4, 0.32, -2.0), 0.0, 0.3);
    out.push(cube(mat::METAL, v3(4.4, 0.55, -2.25), v3(0.02, 0.55, 0.02)).tone(0.2));
    out.push(cube(mat::METAL, v3(4.4, 0.02, -2.25), v3(0.3, 0.02, 0.3)).tone(0.2));
    // Another leaning on the wall, tyres on hooks, oil cans.
    bike(out, v3(8.0, 0.0, -3.9), 0.0, 0.6);
    for i in 0..3 {
        out.push(
            Prim::new(
                kind::TORUS,
                mat::DARK,
                v3(2.4 + 0.75 * i as f32, 1.9, -4.5),
                v3(0.34, 0.34, 0.03),
            )
            .ab(0.03, 0.0),
        );
    }
    for i in 0..3 {
        out.push(
            cyl(
                mat::METAL,
                v3(6.9 + 0.18 * i as f32, 0.98, -4.2),
                0.06,
                0.09,
            )
            .tone(0.2 + 0.3 * i as f32),
        );
    }
    out.push(cyl(mat::WOOD, v3(6.1, 0.3, -2.8), 0.2, 0.3).tone(0.3));
    // The mechanic's low stool by the bicycle.
    out.push(cyl(mat::WOOD, v3(4.85, 0.23, -2.72), 0.17, 0.23).tone(0.45));
    out.push(
        slab(mat::DARK, v3(3.3, 0.0, -3.2), v3(6.4, 0.008, -1.0))
            .flags(flag::FLAT)
            .tone(0.6),
    );
}

/// A bicycle along x at `at` (under its rear wheel's hub, raised `lift`).
pub fn bike(out: &mut Vec<Prim>, at: V3, lift: f32, tone: f32) {
    let r = 0.34;
    let y = at.y + lift + r;
    let (rear, front) = (v3(at.x - 0.52, y, at.z), v3(at.x + 0.52, y, at.z));
    for w in [rear, front] {
        out.push(Prim::new(kind::TORUS, mat::DARK, w, v3(r, r, 0.025)).ab(0.022, 0.0));
    }
    let seat = v3(at.x - 0.22, y + 0.45, at.z);
    let bar = v3(at.x + 0.42, y + 0.55, at.z);
    let crank = v3(at.x - 0.05, y, at.z);
    for (a, b) in [
        (rear, seat),
        (seat, crank),
        (crank, rear),
        (seat, bar - v3(0.08, 0.1, 0.0)),
        (crank, bar - v3(0.08, 0.1, 0.0)),
        (bar, front),
    ] {
        out.push(tube(mat::METAL, a, b, 0.016).tone(tone));
    }
    out.push(cube(
        mat::DARK,
        seat + v3(0.0, 0.05, 0.0),
        v3(0.11, 0.025, 0.04),
    ));
    out.push(cube(mat::METAL, bar + v3(0.0, 0.03, 0.0), v3(0.02, 0.02, 0.24)).tone(0.2));
}

/// A thin square tube from `a` to `b` (a frame's member, a leg, a cord).
pub fn tube(mat: u32, a: V3, b: V3, r: f32) -> Prim {
    let d = b - a;
    let len = d.length();
    let flat = (d.x * d.x + d.z * d.z).sqrt();
    // Laid along z, turned toward d, then tipped up.
    let yaw = d.x.atan2(d.z);
    let pitch = -d.y.atan2(flat);
    Prim::new(kind::BOX, mat, (a + b) * 0.5, v3(r, r, 0.5 * len))
        .yaw(yaw)
        .pitch(pitch)
}

/// The old man's room (storey 1, A): his armchair, the radio, a floor
/// lamp, his books, a clock.
fn old_man(out: &mut Vec<Prim>) {
    let y = STOREY;
    sofa(out, v3(-2.2, y, -2.45), 0.48, 0.0, 0.32);
    out.push(cyl(mat::WOOD, v3(-3.05, y + 0.3, -2.45), 0.24, 0.3).tone(0.3));
    out.push(cube(mat::WOOD, v3(-3.05, y + 0.7, -2.5), v3(0.2, 0.1, 0.11)).tone(0.15));
    out.push(
        cube(
            mat::SCREEN,
            v3(-3.05, y + 0.72, -2.385),
            v3(0.12, 0.05, 0.006),
        )
        .tone(0.1),
    );
    floor_lamp(out, v3(-1.2, y, -2.95), 1.4);
    out.push(
        slab(mat::RUG, v3(-3.6, y, -3.4), v3(-0.6, y + 0.012, -0.8))
            .flags(flag::FLAT)
            .tone(0.2),
    );
    out.push(
        Prim::new(
            kind::SHELF,
            mat::BOOKS,
            v3(-2.0, y + 1.05, -4.4),
            v3(0.82, 1.05, 0.18),
        )
        .ab(0.045, 5.0)
        .tone(0.3),
    );
    out.push(
        cyl(mat::FRAME, v3(-4.85, y + 2.0, -4.57), 0.19, 0.02)
            .pitch(FRAC_PI_2)
            .tone(0.9),
    );
    picture(out, v3(-5.46, y + 1.7, -3.0), 0.35, 0.25, FRAC_PI_2, 0.2);
    picture(out, v3(-5.46, y + 1.6, -0.5), 0.25, 0.32, FRAC_PI_2, 0.6);
    plant(out, v3(0.9, y, -4.2), 1.0, 0.3);
    out.push(cube(mat::WOOD, v3(0.9, y + 0.45, -0.6), v3(0.5, 0.45, 0.25)).tone(0.4));
    out.push(
        cube(mat::PAPER, v3(0.8, y + 0.92, -0.6), v3(0.16, 0.02, 0.12))
            .flags(flag::FLAT)
            .tone(0.6),
    );
}

/// The cellist's room (storey 1, B): her chair, the cello, a music stand,
/// an upright piano with its lamp, a sofa.
fn cellist(out: &mut Vec<Prim>) {
    let y = STOREY;
    chair(out, v3(5.2, y, -2.75), 0.0, 0.25);
    // The cello between her knees, leaning back a little.
    out.push(
        ball(mat::WOOD, v3(5.2, y + 0.55, -2.45), v3(0.21, 0.34, 0.1))
            .pitch(-0.25)
            .tone(0.85)
            .flags(flag::GLOSS),
    );
    out.push(
        ball(mat::WOOD, v3(5.2, y + 0.82, -2.52), v3(0.15, 0.2, 0.09))
            .pitch(-0.25)
            .tone(0.85)
            .flags(flag::GLOSS),
    );
    out.push(cube(mat::DARK, v3(5.2, y + 1.15, -2.62), v3(0.02, 0.32, 0.02)).pitch(-0.25));
    out.push(ball(mat::WOOD, v3(5.2, y + 1.47, -2.7), v3(0.03, 0.05, 0.03)).tone(0.85));
    out.push(cube(mat::METAL, v3(5.2, y + 0.1, -2.37), v3(0.006, 0.12, 0.006)).pitch(0.4));
    // The music stand.
    out.push(cyl(mat::METAL, v3(5.2, y + 0.55, -1.25), 0.012, 0.55).tone(0.2));
    out.push(
        cube(mat::PAPER, v3(5.2, y + 1.15, -1.3), v3(0.24, 0.17, 0.008))
            .pitch(0.45)
            .tone(0.8),
    );
    out.push(
        cube(mat::WOOD, v3(3.3, y + 0.65, -4.28), v3(0.75, 0.65, 0.3))
            .tone(0.12)
            .flags(flag::GLOSS),
    );
    out.push(cube(mat::FRAME, v3(3.3, y + 0.74, -3.96), v3(0.68, 0.025, 0.06)).tone(0.95));
    out.push(cyl(mat::BRASS, v3(3.3, y + 1.38, -4.15), 0.07, 0.08));
    out.push(cone(mat::LAMP, v3(3.3, y + 1.6, -4.15), 0.17, 0.11, 0.6).flags(flag::GLOSS));
    sofa(out, v3(8.0, y, -3.1), 0.95, -FRAC_PI_2, 0.62);
    out.push(
        slab(mat::RUG, v3(4.0, y, -3.4), v3(6.6, y + 0.012, -1.0))
            .flags(flag::FLAT)
            .tone(0.75),
    );
    plant(out, v3(2.2, y, -0.6), 1.1, 0.7);
    picture(out, v3(5.6, y + 1.9, -4.58), 0.5, 0.35, 0.0, 0.45);
}

/// The plant room (storey 2, A): plants on benches under the windows,
/// big pots on the floor, plants hung from the ceiling.
fn garden(out: &mut Vec<Prim>) {
    let y = 2.0 * STOREY;
    for (x0, x1) in [(-5.4, -2.3), (-1.4, 1.4)] {
        out.push(
            cube(
                mat::WOOD,
                v3(0.5 * (x0 + x1), y + 0.6, -4.3),
                v3(0.5 * (x1 - x0), 0.03, 0.26),
            )
            .tone(0.5),
        );
        legs(
            out,
            mat::WOOD,
            v3(0.5 * (x0 + x1), y, -4.3),
            0.5 * (x1 - x0),
            0.26,
            0.57,
            0.025,
        );
    }
    let pots = [
        (-5.0, 0.7, 0.1),
        (-4.3, 0.55, 0.4),
        (-3.5, 0.8, 0.7),
        (-2.7, 0.6, 0.2),
        (-1.0, 0.75, 0.55),
        (-0.2, 0.6, 0.9),
        (0.8, 0.7, 0.35),
    ];
    for &(x, s, t) in &pots {
        plant(out, v3(x, y + 0.63, -4.3), s, t);
    }
    for &(x, z, s, t) in &[
        (-4.9, -1.2, 1.7, 0.15),
        (0.5, -1.6, 2.0, 0.6),
        (-0.6, -0.5, 1.2, 0.85),
    ] {
        plant(out, v3(x, y, z), s, t);
    }
    for &(x, z, t) in &[(-3.2, -2.2, 0.3), (-1.4, -3.0, 0.75)] {
        out.push(cube(mat::DARK, v3(x, y + 2.5, z), v3(0.004, 0.26, 0.004)));
        out.push(cone(mat::CERAMIC, v3(x, y + 2.18, z), 0.14, 0.08, 1.2).tone(0.6));
        out.push(
            Prim::new(
                kind::LEAVES,
                mat::PLANT,
                v3(x, y + 1.98, z),
                v3(0.36, 0.42, 0.36),
            )
            .ab(0.35, t * 5.0)
            .tone(t),
        );
    }
    table(out, v3(-2.4, y, -1.4), 0.5, 0.35, 0.72, 0.6);
    out.push(cyl(mat::CERAMIC, v3(-2.3, y + 0.8, -1.4), 0.07, 0.08).tone(0.3));
}

/// The painter's room (storey 2, B): the easel and its canvas, a table of
/// paints, canvases leaning on the wall, a stool.
fn painter(out: &mut Vec<Prim>) {
    let y = 2.0 * STOREY;
    let e = v3(5.3, y, -2.3);
    out.push(
        tube(
            mat::WOOD,
            e + v3(-0.35, 0.0, 0.18),
            e + v3(0.0, 1.9, -0.05),
            0.02,
        )
        .tone(0.6),
    );
    out.push(
        tube(
            mat::WOOD,
            e + v3(0.35, 0.0, 0.18),
            e + v3(0.0, 1.9, -0.05),
            0.02,
        )
        .tone(0.6),
    );
    out.push(
        tube(
            mat::WOOD,
            e + v3(0.0, 0.0, -0.55),
            e + v3(0.0, 1.8, -0.05),
            0.02,
        )
        .tone(0.6),
    );
    out.push(
        cube(mat::CANVAS, e + v3(0.0, 1.25, 0.06), v3(0.48, 0.38, 0.015))
            .pitch(-0.12)
            .tone(0.99),
    );
    out.push(cube(mat::WOOD, e + v3(0.0, 0.84, 0.1), v3(0.4, 0.02, 0.05)).tone(0.6));
    table(out, v3(3.2, y, -3.6), 0.55, 0.35, 0.75, 0.2);
    for i in 0..5 {
        out.push(
            cyl(
                mat::CERAMIC,
                v3(
                    2.85 + 0.17 * i as f32,
                    y + 0.81,
                    -3.65 + 0.06 * (i % 2) as f32,
                ),
                0.045,
                0.06,
            )
            .tone(0.1 + 0.2 * i as f32),
        );
    }
    out.push(
        cube(mat::PAPER, v3(3.4, y + 0.76, -3.4), v3(0.18, 0.006, 0.12))
            .flags(flag::FLAT)
            .tone(0.3),
    );
    for (i, x) in [8.0f32, 8.25, 8.55].iter().enumerate() {
        out.push(
            cube(
                mat::CANVAS,
                v3(*x, y + 0.55 + 0.1 * i as f32, -4.35),
                v3(0.45 - 0.08 * i as f32, 0.55 - 0.05 * i as f32, 0.02),
            )
            .pitch(-0.12)
            .tone(0.2 + 0.3 * i as f32),
        );
    }
    out.push(cyl(mat::WOOD, v3(6.3, y + 0.33, -2.6), 0.18, 0.33).tone(0.45));
    out.push(
        slab(mat::CLOTH, v3(4.4, y, -3.0), v3(6.3, y + 0.01, -1.4))
            .flags(flag::FLAT)
            .tone(0.95),
    );
    plant(out, v3(2.2, y, -0.7), 1.2, 0.5);
}

/// His kitchen (storey 3, A): the table and two chairs, the counter under
/// the window with the stove and the kettle, the fridge by the door, a
/// shelf of jars, the lamp over the table.
fn kitchen(out: &mut Vec<Prim>) {
    let y = 3.0 * STOREY;
    table(out, v3(-1.8, y, -3.0), 0.6, 0.42, 0.76, 0.55);
    // Her chair; his moves with him (story.rs).
    chair(out, v3(-2.95, y, -3.0), FRAC_PI_2, 0.5);
    out.push(cube(mat::WOOD, v3(-3.95, y + 0.45, -4.3), v3(1.55, 0.45, 0.3)).tone(0.75));
    out.push(
        cube(mat::STONE, v3(-3.95, y + 0.92, -4.3), v3(1.57, 0.022, 0.32))
            .tone(0.35)
            .flags(flag::GLOSS),
    );
    out.push(cube(mat::METAL, v3(-5.0, y + 0.945, -4.3), v3(0.34, 0.006, 0.27)).tone(0.15));
    out.push(
        cube(mat::METAL, v3(-3.8, y + 0.9, -4.3), v3(0.3, 0.03, 0.2))
            .tone(0.6)
            .flags(flag::GLOSS),
    );
    out.push(cube(mat::WOOD, v3(-4.95, y + 1.95, -4.42), v3(0.5, 0.35, 0.18)).tone(0.75));
    out.push(
        cube(mat::FRAME, v3(-5.13, y + 0.95, -0.45), v3(0.33, 0.95, 0.32))
            .tone(0.95)
            .flags(flag::GLOSS),
    );
    out.push(cube(mat::WOOD, v3(1.3, y + 1.6, -3.2), v3(0.16, 0.02, 0.8)).tone(0.5));
    for i in 0..5 {
        let z = -3.8 + 0.3 * i as f32;
        out.push(
            cyl(
                mat::CERAMIC,
                v3(1.3, y + 1.7, z),
                0.06,
                0.08 + 0.02 * (i % 3) as f32,
            )
            .tone(0.15 * i as f32 + 0.1),
        );
    }
    plant(out, v3(-0.2, y + SILL, -4.45), 0.45, 0.4);
    out.push(
        slab(mat::RUG, v3(-3.0, y, -3.7), v3(-0.5, y + 0.012, -2.2))
            .flags(flag::FLAT)
            .tone(0.55),
    );
}

/// His living room (storey 3, B): the open stair up to the study along the
/// back wall, the sofa on the right wall, the low table, the rug with the
/// child's toys, books, a floor lamp.
fn living(out: &mut Vec<Prim>) {
    let y = 3.0 * STOREY;
    sofa(out, v3(9.05, y, -1.95), 0.95, -FRAC_PI_2, 0.7);
    out.push(cube(mat::WOOD, v3(7.65, y + 0.4, -1.95), v3(0.32, 0.025, 0.55)).tone(0.3));
    legs(out, mat::WOOD, v3(7.65, y, -1.95), 0.29, 0.52, 0.38, 0.02);
    out.push(
        slab(mat::RUG, v3(3.4, y, -3.35), v3(8.7, y + 0.012, -0.5))
            .flags(flag::FLAT)
            .tone(0.9),
    );
    out.push(
        Prim::new(
            kind::SHELF,
            mat::BOOKS,
            v3(1.88, y + 1.0, -2.9),
            v3(1.1, 1.0, 0.17),
        )
        .yaw(FRAC_PI_2)
        .ab(0.05, 5.0)
        .tone(0.7),
    );
    floor_lamp(out, v3(9.15, y, -3.25), 1.35);
    picture(out, v3(2.3, y + 1.65, -4.58), 0.35, 0.3, 0.0, 0.8);
    plant(out, v3(2.2, y, -0.6), 0.9, 0.2);
    // The child's toys on the rug: blocks, a ball, a little truck.
    let blocks = [
        (5.2f32, -1.3f32, 0.07f32),
        (5.36, -1.22, 0.06),
        (5.27, -1.27, 0.05),
        (6.4, -2.6, 0.08),
    ];
    for (i, &(x, z, s)) in blocks.iter().enumerate() {
        let lift = if i == 2 { 0.13 } else { 0.0 };
        out.push(
            cube(mat::TOY, v3(x, y + s + lift, z), v3(s, s, s))
                .yaw(0.4 * i as f32)
                .tone(0.15 + 0.27 * i as f32),
        );
    }
    out.push(ball(mat::TOY, v3(4.3, y + 0.11, -0.95), v3(0.11, 0.11, 0.11)).tone(0.05));
    out.push(
        cube(mat::TOY, v3(6.9, y + 0.07, -0.9), v3(0.16, 0.06, 0.08))
            .yaw(0.3)
            .tone(0.6),
    );
    // The stair: open treads on a stringer, its rail on the open side.
    let [x0, x1] = STAIR_X;
    let run = x1 - x0;
    out.push(
        Prim::new(
            kind::STAIRS,
            mat::WOOD,
            v3(0.5 * (x0 + x1), y + 0.5 * STOREY, STAIR_Z),
            v3(0.5 * run, 0.5 * STOREY, STAIR_HALF),
        )
        .ab(STAIR_STEPS, 1.0)
        .tone(0.4),
    );
    let slope = (STOREY / run).atan();
    let front = STAIR_Z + STAIR_HALF - 0.03;
    let along = 0.5 * (run * run + STOREY * STOREY).sqrt();
    out.push(
        Prim::new(
            kind::BOX,
            mat::WOOD,
            v3(0.5 * (x0 + x1), y + 0.5 * STOREY - 0.12, front),
            v3(0.025, 0.11, along),
        )
        .yaw(FRAC_PI_2)
        .pitch(-slope)
        .tone(0.25),
    );
    out.push(
        Prim::new(
            kind::BOX,
            mat::WOOD,
            v3(0.5 * (x0 + x1), y + 0.5 * STOREY + 0.92, front + 0.02),
            v3(0.02, 0.02, along),
        )
        .yaw(FRAC_PI_2)
        .pitch(-slope)
        .tone(0.3),
    );
    for i in 0..5 {
        let s = (i as f32 + 0.5) / 5.0;
        let x = x0 + run * s;
        let foot = y + STOREY * s;
        out.push(
            cube(
                mat::METAL,
                v3(x, foot + 0.46, front + 0.02),
                v3(0.008, 0.46, 0.008),
            )
            .tone(0.2),
        );
    }
}

/// The bedroom (storey 4, A): the bed under the windows, the bedside
/// lamps, the wardrobe, the child's bed.
fn bedroom(out: &mut Vec<Prim>) {
    let y = 4.0 * STOREY;
    out.push(cube(mat::WOOD, v3(-2.0, y + 0.2, -3.6), v3(1.0, 0.2, 0.98)).tone(0.4));
    out.push(cube(mat::WOOD, v3(-2.0, y + 0.6, -4.54), v3(1.02, 0.6, 0.05)).tone(0.4));
    out.push(cube(mat::CLOTH, v3(-2.0, y + 0.47, -3.55), v3(0.96, 0.08, 0.94)).tone(0.95));
    out.push(cube(mat::CLOTH, v3(-2.0, y + 0.56, -3.15), v3(0.98, 0.05, 0.6)).tone(0.45));
    for x in [-2.5f32, -1.5] {
        out.push(ball(mat::CLOTH, v3(x, y + 0.62, -4.25), v3(0.33, 0.08, 0.17)).tone(0.98));
    }
    for x in [-3.4f32, -0.6] {
        out.push(cube(mat::WOOD, v3(x, y + 0.27, -4.3), v3(0.22, 0.27, 0.22)).tone(0.4));
    }
    out.push(cyl(mat::BRASS, v3(-0.6, y + 0.6, -4.3), 0.04, 0.06));
    out.push(cone(mat::LAMP, v3(-0.6, y + 0.78, -4.3), 0.13, 0.1, 0.65).flags(flag::GLOSS));
    out.push(cube(mat::WOOD, v3(-5.15, y + 1.1, -3.4), v3(0.32, 1.1, 1.0)).tone(0.6));
    out.push(cube(mat::WOOD, v3(0.55, y + 0.22, -1.2), v3(0.78, 0.22, 0.42)).tone(0.75));
    out.push(cube(mat::CLOTH, v3(0.55, y + 0.47, -1.2), v3(0.74, 0.06, 0.38)).tone(0.2));
    out.push(
        slab(mat::RUG, v3(-3.4, y, -2.6), v3(-0.6, y + 0.012, -1.2))
            .flags(flag::FLAT)
            .tone(0.35),
    );
    picture(out, v3(-5.46, y + 1.5, -0.8), 0.3, 0.4, FRAC_PI_2, 0.9);
}

/// The study (storey 4, B): the desk facing the street with his chair
/// behind it, its lamp, the laptop, the calendar on the wall, books, the
/// stair's well with its rail, open at the top step.
fn study(out: &mut Vec<Prim>) {
    let y = 4.0 * STOREY;
    let d = v3(DESK[0], y, DESK[1]);
    out.push(
        cube(mat::WOOD, d + v3(0.0, 0.745, 0.0), v3(0.85, 0.025, 0.42))
            .tone(0.2)
            .flags(flag::GLOSS),
    );
    out.push(cube(mat::WOOD, d + v3(-0.6, 0.36, 0.0), v3(0.22, 0.36, 0.4)).tone(0.2));
    out.push(cube(mat::WOOD, d + v3(0.75, 0.36, 0.0), v3(0.04, 0.36, 0.38)).tone(0.2));
    out.push(cube(mat::WOOD, d + v3(0.0, 0.5, 0.38), v3(0.82, 0.22, 0.015)).tone(0.2));
    // The lamp on the desk.
    out.push(cyl(mat::METAL, d + v3(-0.75, 0.785, -0.15), 0.08, 0.015).tone(0.2));
    out.push(
        tube(
            mat::METAL,
            d + v3(-0.75, 0.79, -0.15),
            d + v3(-0.65, 1.2, 0.05),
            0.01,
        )
        .tone(0.2),
    );
    out.push(
        cone(mat::LAMP, d + v3(-0.6, 1.2, 0.05), 0.11, 0.07, 0.4)
            .pitch(0.5)
            .flags(flag::GLOSS),
    );
    // The laptop, open toward him.
    out.push(cube(mat::METAL, d + v3(0.05, 0.78, -0.2), v3(0.2, 0.008, 0.14)).tone(0.55));
    out.push(
        cube(mat::SCREEN, d + v3(0.05, 0.92, -0.05), v3(0.2, 0.13, 0.006))
            .pitch(0.25)
            .tone(0.6),
    );
    out.push(cube(
        mat::CALENDAR,
        v3(5.3, y + 1.55, -4.58),
        v3(0.4, 0.46, 0.012),
    ));
    out.push(
        Prim::new(
            kind::SHELF,
            mat::BOOKS,
            v3(1.88, y + 1.0, -2.9),
            v3(1.0, 1.0, 0.17),
        )
        .yaw(FRAC_PI_2)
        .ab(0.045, 5.0)
        .tone(0.15),
    );
    // The rail round the stair's well, open at its top step.
    let [a, b] = WELL_X;
    out.push(
        cube(
            mat::METAL,
            v3(0.5 * (a + b), y + 0.92, WELL_Z),
            v3(0.5 * (b - a), 0.02, 0.02),
        )
        .tone(0.2),
    );
    for x in [a, 0.5 * (a + b), b] {
        out.push(cube(mat::METAL, v3(x, y + 0.46, WELL_Z), v3(0.015, 0.46, 0.015)).tone(0.2));
    }
    out.push(
        cube(
            mat::METAL,
            v3(a, y + 0.92, 0.5 * (WELL_Z + BACK)),
            v3(0.02, 0.02, 0.5 * (WELL_Z - BACK)),
        )
        .tone(0.2),
    );
    plant(out, v3(9.0, y, -0.6), 1.0, 0.65);
    out.push(
        slab(mat::RUG, v3(2.6, y, -3.4), v3(5.1, y + 0.012, -1.2))
            .flags(flag::FLAT)
            .tone(0.05),
    );
}

/// The roof: its slab and parapets, the lift's machine room over the
/// stairwell, the water tank, washing on a line, a bench, planters.
fn roof(out: &mut Vec<Prim>) {
    let y = ROOF;
    out.push(
        slab(
            mat::ROOF,
            v3(-SIDE_OUT, y - SLAB, BACK_OUT),
            v3(SIDE_OUT, y, 0.0),
        )
        .flags(flag::SLAB),
    );
    let wall = |lo: V3, hi: V3| slab(mat::PLASTER, lo, hi).flags(flag::WALL).tone(0.5);
    out.push(wall(v3(-5.6, y, -0.16), v3(SIDE_OUT, y + 0.55, 0.0)));
    out.push(wall(
        v3(-SIDE_OUT, y, BACK_OUT),
        v3(SIDE_OUT, y + 0.55, BACK),
    ));
    out.push(wall(v3(SIDE, y, BACK), v3(SIDE_OUT, y + 0.55, 0.0)));
    // The machine room, open at the cut like every room.
    out.push(wall(v3(-SIDE_OUT, y, BACK_OUT), v3(-SIDE, SHAFT_TOP, 0.0)));
    out.push(wall(v3(-SIDE, y, BACK_OUT), v3(-5.6, SHAFT_TOP, BACK)));
    out.push(wall(v3(-5.8, y, BACK), v3(-5.6, SHAFT_TOP, DOOR[0])));
    out.push(wall(
        v3(-5.8, y + DOOR_H, DOOR[0]),
        v3(-5.6, SHAFT_TOP, 0.0),
    ));
    out.push(wall(v3(-5.8, y, DOOR[1] + 0.6), v3(-5.6, y + DOOR_H, 0.0)));
    out.push(
        slab(
            mat::ROOF,
            v3(-SIDE_OUT, SHAFT_TOP, BACK_OUT),
            v3(-5.5, SHAFT_TOP + 0.22, 0.05),
        )
        .flags(flag::SLAB),
    );
    out.push(
        Prim::new(
            kind::TORUS,
            mat::METAL,
            v3(-8.5, SHAFT_TOP + 0.6, -2.4),
            v3(0.38, 0.38, 0.06),
        )
        .ab(0.06, 0.0)
        .tone(0.3),
    );
    out.push(
        cube(
            mat::METAL,
            v3(-8.5, SHAFT_TOP + 0.4, -2.4),
            v3(0.25, 0.18, 0.2),
        )
        .tone(0.2),
    );
    out.push(
        cube(
            mat::METAL,
            v3(-6.6, SHAFT_TOP + 1.3, -3.6),
            v3(0.02, 1.1, 0.02),
        )
        .tone(0.3),
    );
    out.push(
        cube(
            mat::METAL,
            v3(-6.6, SHAFT_TOP + 1.9, -3.6),
            v3(0.4, 0.015, 0.015),
        )
        .tone(0.3),
    );
    // The water tank on its legs in the far corner.
    let t = v3(8.8, y, -4.0);
    out.push(cyl(mat::WOOD, t + v3(0.0, 1.55, 0.0), 0.5, 0.55).tone(0.25));
    out.push(cone(mat::METAL, t + v3(0.0, 2.25, 0.0), 0.56, 0.15, 0.1).tone(0.3));
    for (sx, sz) in [(-1.0f32, -1.0f32), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)] {
        out.push(
            cube(
                mat::METAL,
                t + v3(sx * 0.36, 0.5, sz * 0.32),
                v3(0.03, 0.5, 0.03),
            )
            .tone(0.2),
        );
    }
    // The washing line behind the track, its posts.
    for x in [-4.8f32, 0.6] {
        out.push(cyl(mat::METAL, v3(x, y + 0.9, -4.35), 0.025, 0.9).tone(0.3));
    }
    out.push(cube(
        mat::DARK,
        v3(-2.1, y + 1.75, -4.35),
        v3(2.7, 0.004, 0.004),
    ));
    out.push(cube(mat::WOOD, v3(-3.0, y + 0.42, -0.55), v3(0.7, 0.04, 0.2)).tone(0.4));
    legs(out, mat::METAL, v3(-3.0, y, -0.55), 0.66, 0.18, 0.4, 0.02);
    // The running track: a stadium of rubber round a painted infield,
    // a white line between its two lanes.
    let [tx, tz, half, r] = TRACK;
    let stadium = |out: &mut Vec<Prim>, m: u32, rr: f32, h: f32, tone: f32| {
        out.push(
            cube(m, v3(tx, y + 0.5 * h, tz), v3(half, 0.5 * h, rr))
                .flags(flag::FLAT)
                .tone(tone),
        );
        for x in [tx - half, tx + half] {
            out.push(
                cyl(m, v3(x, y + 0.5 * h, tz), rr, 0.5 * h)
                    .flags(flag::FLAT)
                    .tone(tone),
            );
        }
    };
    stadium(out, mat::RUG, r + 0.32, 0.01, 0.62);
    stadium(out, mat::PAPER, r + 0.02, 0.013, 0.97);
    stadium(out, mat::RUG, r - 0.01, 0.016, 0.62);
    stadium(out, mat::ROOF, r - 0.3, 0.019, 0.35);
    for x in [6.4f32, 8.6] {
        out.push(cube(mat::WOOD, v3(x, y + 0.2, -0.45), v3(0.6, 0.2, 0.22)).tone(0.5));
        out.push(
            Prim::new(
                kind::LEAVES,
                mat::PLANT,
                v3(x, y + 0.55, -0.45),
                v3(0.6, 0.25, 0.22),
            )
            .ab(0.3, x)
            .tone(0.2 + 0.05 * x),
        );
    }
}

/// The lift's shaft: its four posts from the lobby up into the machine
/// room, the guide rails, the cable.
fn lift_shaft(out: &mut Vec<Prim>) {
    let [x0, x1, z0, z1] = CAGE;
    for (x, z) in [
        (x0 - 0.06, z0 - 0.06),
        (x1 + 0.06, z0 - 0.06),
        (x0 - 0.06, z1 + 0.06),
        (x1 + 0.06, z1 + 0.06),
    ] {
        out.push(
            slab(
                mat::METAL,
                v3(x - 0.035, 0.0, z - 0.035),
                v3(x + 0.035, SHAFT_TOP, z + 0.035),
            )
            .tone(0.15),
        );
    }
}

/// The street: sidewalks, rails, the trolley wire and its poles, lamps,
/// the stop with its shelter, a tree, the tunnel portals at both ends.
fn street(cells: &mut [Vec<Prim>]) {
    let parts = [
        (cell::STREET_L, -16.0, -5.6),
        (cell::STREET_M, -5.6, 5.6),
        (cell::STREET_R, 5.6, 16.0),
    ];
    for &(c, x0, x1) in &parts {
        let out = &mut cells[c];
        out.push(
            slab(mat::PAVING, v3(x0, ROAD_Y, 0.0), v3(x1, 0.0, NEAR_WALK))
                .flags(flag::SLAB)
                .tone(0.4),
        );
        out.push(
            slab(
                mat::PAVING,
                v3(x0, ROAD_Y, FAR_WALK),
                v3(x1, 0.0, PLINTH[3]),
            )
            .flags(flag::SLAB)
            .tone(0.4),
        );
        for z in [TRACK_Z - 0.5 * GAUGE, TRACK_Z + 0.5 * GAUGE] {
            out.push(
                slab(
                    mat::RAIL,
                    v3(x0, ROAD_Y, z - 0.035),
                    v3(x1, ROAD_Y + 0.035, z + 0.035),
                )
                .flags(flag::FLAT),
            );
        }
        out.push(
            slab(
                mat::DARK,
                v3(x0, 5.18, TRACK_Z - 0.008),
                v3(x1, 5.196, TRACK_Z + 0.008),
            )
            .flags(flag::WALL),
        );
    }
    // Poles holding the wire, on the far sidewalk.
    for x in [-13.4f32, -4.4, 4.6, 13.4] {
        let c = street_cell(x);
        let out = &mut cells[c];
        out.push(
            cyl(mat::METAL, v3(x, 2.75, 6.95), 0.07, 2.75)
                .flags(flag::WALL | flag::NEAR)
                .tone(0.25),
        );
        out.push(
            cube(mat::METAL, v3(x, 5.3, 5.6), v3(0.03, 0.03, 1.38))
                .flags(flag::WALL | flag::NEAR)
                .tone(0.25),
        );
    }
    // Lamps on the near sidewalk.
    for x in [-11.5f32, -0.5, 11.5] {
        let c = street_cell(x);
        let out = &mut cells[c];
        out.push(
            cyl(mat::METAL, v3(x, 1.55, 1.75), 0.05, 1.55)
                .flags(flag::NEAR)
                .tone(0.15),
        );
        out.push(
            tube(mat::METAL, v3(x, 3.0, 1.75), v3(x, 3.15, 1.4), 0.025)
                .flags(flag::NEAR)
                .tone(0.15),
        );
        out.push(
            ball(mat::STREETLAMP, v3(x, 3.05, 1.4), v3(0.16, 0.1, 0.16))
                .flags(flag::GLOSS | flag::NEAR),
        );
    }
    // The stop: its shelter on the far sidewalk, the sign; the second
    // stop's sign by the shop's crossing.
    {
        let out = &mut cells[cell::STREET_L];
        let s = v3(-12.6, 0.0, 7.7);
        out.push(
            cube(mat::METAL, s + v3(0.0, 2.45, 0.0), v3(1.55, 0.04, 0.62))
                .pitch(-0.06)
                .tone(0.3),
        );
        out.push(cube(
            mat::GLASS,
            s + v3(0.0, 1.25, 0.58),
            v3(1.45, 1.05, 0.02),
        ));
        for dx in [-1.45f32, 1.45] {
            out.push(cube(mat::METAL, s + v3(dx, 1.22, 0.58), v3(0.03, 1.22, 0.03)).tone(0.3));
        }
        out.push(cube(mat::WOOD, s + v3(0.0, 0.45, 0.32), v3(1.0, 0.035, 0.18)).tone(0.4));
        legs(
            out,
            mat::METAL,
            s + v3(0.0, 0.0, 0.32),
            0.95,
            0.15,
            0.42,
            0.02,
        );
        out.push(cyl(mat::METAL, v3(-10.7, 1.2, 6.75), 0.03, 1.2).tone(0.3));
        out.push(cyl(mat::SIGN, v3(-10.7, 2.5, 6.75), 0.22, 0.012).pitch(FRAC_PI_2));
        out.push(cyl(mat::PLASTER, v3(-14.6, 0.45, 7.5), 0.22, 0.45).tone(0.3));
    }
    {
        let out = &mut cells[cell::STREET_M];
        out.push(cyl(mat::METAL, v3(-3.3, 1.2, 6.75), 0.03, 1.2).tone(0.3));
        out.push(cyl(mat::SIGN, v3(-3.3, 2.5, 6.75), 0.22, 0.012).pitch(FRAC_PI_2));
        out.push(cube(mat::WOOD, v3(3.0, 0.45, 7.6), v3(0.9, 0.035, 0.2)).tone(0.4));
        legs(out, mat::METAL, v3(3.0, 0.0, 7.6), 0.85, 0.17, 0.42, 0.02);
        out.push(cyl(mat::METAL, v3(7.6, 0.45, 1.7), 0.2, 0.45).tone(0.2));
    }
    {
        let out = &mut cells[cell::STREET_R];
        out.push(cyl(mat::BARK, v3(12.8, 1.4, 7.5), 0.13, 1.4));
        out.push(
            Prim::new(
                kind::LEAVES,
                mat::PLANT,
                v3(12.8, 3.6, 7.5),
                v3(1.5, 1.4, 1.2),
            )
            .ab(0.4, 3.0)
            .tone(0.3),
        );
        out.push(slab(mat::DARK, v3(12.2, 0.0, 6.9), v3(13.4, 0.01, 8.1)).flags(flag::FLAT));
        out.push(cyl(mat::DARK, v3(10.4, 0.35, 1.4), 0.12, 0.35).tone(0.2));
    }
    // The tunnel portals the tram comes from and goes into.
    for (c, x) in [(cell::STREET_L, -15.6f32), (cell::STREET_R, 15.6)] {
        let out = &mut cells[c];
        let (a, b) = (x - 0.4, x + 0.4);
        out.push(slab(
            mat::BRICK,
            v3(a, ROAD_Y, NEAR_WALK - 0.2),
            v3(b, 4.4, NEAR_WALK + 0.4),
        ));
        out.push(slab(
            mat::BRICK,
            v3(a, ROAD_Y, FAR_WALK - 0.4),
            v3(b, 4.4, FAR_WALK + 0.2),
        ));
        out.push(slab(
            mat::BRICK,
            v3(a, 3.75, NEAR_WALK + 0.4),
            v3(b, 4.4, FAR_WALK - 0.4),
        ));
        let back = if x < 0.0 { a - 0.05 } else { b + 0.05 };
        out.push(slab(
            mat::DARK,
            v3(back - 0.05, ROAD_Y, NEAR_WALK),
            v3(back + 0.05, 3.8, FAR_WALK),
        ));
    }
}

/// The street cell of the part at x.
pub fn street_cell(x: f32) -> usize {
    if x < -5.6 {
        cell::STREET_L
    } else if x < 5.6 {
        cell::STREET_M
    } else {
        cell::STREET_R
    }
}

/// The yard behind the house: grass, two trees, a fence; the painted
/// backdrop at the plinth's back edge.
fn yard(out: &mut Vec<Prim>) {
    out.push(
        slab(
            mat::GRASS,
            v3(PLINTH[0], ROAD_Y, PLINTH[2]),
            v3(PLINTH[1], 0.0, BACK_OUT),
        )
        .flags(flag::SLAB),
    );
    for &(x, z, h, s, t) in &[
        (-5.5f32, -6.6f32, 7.5f32, 2.3f32, 0.2f32),
        (6.0, -6.9, 9.0, 2.7, 0.55),
        (13.0, -6.5, 5.5, 1.8, 0.8),
    ] {
        out.push(cyl(mat::BARK, v3(x, 0.5 * h * 0.6, z), 0.18, 0.5 * h * 0.6));
        out.push(
            Prim::new(
                kind::LEAVES,
                mat::PLANT,
                v3(x, h * 0.62 + s * 0.5, z),
                v3(s, s * 1.1, s * 0.8),
            )
            .ab(0.45, t * 9.0)
            .tone(t),
        );
    }
    for i in 0..16 {
        let x = PLINTH[0] + 1.0 + 2.0 * i as f32;
        out.push(cube(mat::WOOD, v3(x, 0.55, -7.9), v3(0.04, 0.55, 0.03)).tone(0.6));
    }
    out.push(cube(mat::WOOD, v3(0.0, 0.85, -7.9), v3(16.0, 0.035, 0.02)).tone(0.6));
    out.push(slab(
        mat::BACKDROP,
        v3(-BACKDROP_HALF, TABLE, BACKDROP_Z - 0.1),
        v3(BACKDROP_HALF, BACKDROP_TOP, BACKDROP_Z),
    ));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_turned_box_stays_inside_its_bounds() {
        let p = cube(mat::WOOD, v3(1.0, 2.0, 3.0), v3(0.5, 0.2, 0.1))
            .yaw(0.7)
            .pitch(0.3);
        let (lo, hi) = p.bounds();
        let [x, y, z] = p.axes();
        for sx in [-1.0, 1.0] {
            for sy in [-1.0, 1.0] {
                for sz in [-1.0, 1.0] {
                    let q = p.c + x * (sx * p.h.x) + y * (sy * p.h.y) + z * (sz * p.h.z);
                    assert!(q.x >= lo.x - 1e-5 && q.x <= hi.x + 1e-5);
                    assert!(q.y >= lo.y - 1e-5 && q.y <= hi.y + 1e-5);
                    assert!(q.z >= lo.z - 1e-5 && q.z <= hi.z + 1e-5);
                }
            }
        }
    }

    #[test]
    fn a_tube_joins_its_ends() {
        let (a, b) = (v3(0.3, 1.0, -2.0), v3(1.1, 1.7, -1.4));
        let t = tube(mat::METAL, a, b, 0.01);
        let [_, _, z] = t.axes();
        let end = t.c + z * t.h.z;
        assert!(
            (end - b).length() < 1e-4 || (t.c - z * t.h.z - b).length() < 1e-4,
            "{end:?}"
        );
    }

    #[test]
    fn every_room_stays_in_its_column() {
        let cells = build();
        for k in 0..FLOORS {
            for col in 0..3 {
                let [x0, x1] = COLUMNS[col];
                for p in &cells[cell::room(col, k)] {
                    let (lo, hi) = p.bounds();
                    assert!(
                        lo.x >= x0.min(-SIDE_OUT) - 0.2
                            && hi.x <= x1.max(if col == 2 { SIDE_OUT } else { x1 }) + 0.2,
                        "{col} {k} {p:?}"
                    );
                    let y = STOREY * k as f32;
                    // The stairwell's upper rail climbs past its landing.
                    let top = if col == 0 { 1.2 } else { 0.01 };
                    assert!(
                        lo.y >= y - SLAB - 0.01 && hi.y <= y + STOREY + top || (col == 2 && k == 3),
                        "{col} {k} {p:?}"
                    );
                }
            }
        }
    }

    #[test]
    fn the_scene_fits_its_texture() {
        let cells = build();
        let n: usize = cells.iter().map(|c| c.len()).sum();
        // Stairs come as their steps and crowns as their clumps.
        assert!(n < 1000, "{n}");
        let most = cells.iter().map(|c| c.len()).max().unwrap_or(0);
        assert!(most < 120, "{most}");
    }
}
