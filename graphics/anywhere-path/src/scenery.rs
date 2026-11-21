//! The still places as boxes for the shader: the house with its rooms, the
//! station's platform, canopy and house, the lake's halt and pier, the
//! street's houses and lamps, and one car of the train (three of them run,
//! each in its own frame). Each box stands in its own frame (`beta`, degrees
//! round the ring: x out from the field, z along the ring) so arcs are made
//! of short straight boxes. `browser.rs` writes them into the data texture
//! once; the groups' bounds let the shader skip a place the ray misses.
use crate::place::{
    at_frame, CAR, CAR_FLOOR, CAFE, FACADE, FRIEND_DOOR, HOUSE, LAKE, PIER, PLATFORM, STATION,
    TRACK,
};

/// What a surface is, for its light and its lines (`scene.frag` reads the
/// same numbers).
pub mod mat {
    pub const GROUND: u32 = 0;
    pub const FLOOR: u32 = 1;
    pub const WALL: u32 = 2;
    pub const ROOF: u32 = 3;
    pub const WOOD: u32 = 4;
    pub const STONE: u32 = 5;
    pub const CAR: u32 = 6;
    pub const FACADE: u32 = 7;
    pub const WATER: u32 = 8;
    pub const SKY: u32 = 9;
    pub const FIG: u32 = 10;
    pub const CROWD: u32 = 11;
    pub const POLE: u32 = 12;
    pub const LAMP: u32 = 13;
    pub const TREE: u32 = 14;
    pub const HILL: u32 = 15;
    pub const DARK: u32 = 16;
}

/// A car's door leaves slide open by this much with the doors.
pub const DOOR_SLIDE: f32 = 0.62;
/// Flags: the left and the right leaf of a car's door.
pub const LEAF_L: u32 = 1;
pub const LEAF_R: u32 = 2;

/// The house's wall height and its roof (`scene.frag` builds the roof).
pub const WALL_H: f32 = 2.75;
pub const RIDGE_X: f32 = 14.0;
pub const RIDGE_Y: f32 = 4.45;
pub const ROOF_SLOPE: f32 = 0.545;

/// The car's window band, up from the rail.
pub const BAND: [f32; 2] = [1.2, 2.3];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Bx {
    pub lo: [f32; 3],
    pub hi: [f32; 3],
    pub mat: u32,
    pub flags: u32,
    /// Its frame round the ring, degrees (0 for a car's own boxes).
    pub beta: f32,
}

fn bx(beta: f32, lo: [f32; 3], hi: [f32; 3], mat: u32) -> Bx {
    Bx {
        lo,
        hi,
        mat,
        flags: 0,
        beta,
    }
}

/// A sector of a ring from `a` to `b` degrees, `r0`–`r1` out, as boxes of
/// at most `step` degrees.
fn arc(a: f32, b: f32, r0: f32, r1: f32, y: [f32; 2], step: f32, mat: u32) -> Vec<Bx> {
    let n = ((b - a) / step).ceil().max(1.0) as usize;
    let w = (b - a) / n as f32;
    (0..n)
        .map(|i| {
            let mid = a + w * (i as f32 + 0.5);
            let half = r1 * (0.5 * w * crate::place::DEG).tan() + 0.02;
            bx(mid, [r0, y[0], -half], [r1, y[1], half], mat)
        })
        .collect()
}

/// A wall along z at x0–x1 from z0 to z1 with openings (z from, z to,
/// sill, lintel) cut out of it.
fn wall_z(
    beta: f32,
    x: [f32; 2],
    z: [f32; 2],
    openings: &[[f32; 4]],
    top: f32,
    mat: u32,
) -> Vec<Bx> {
    let mut out = Vec::new();
    let mut at = z[0];
    for o in openings {
        if o[0] > at {
            out.push(bx(beta, [x[0], 0.0, at], [x[1], top, o[0]], mat));
        }
        if o[2] > 0.0 {
            out.push(bx(beta, [x[0], 0.0, o[0]], [x[1], o[2], o[1]], mat));
        }
        if o[3] < top {
            out.push(bx(beta, [x[0], o[3], o[0]], [x[1], top, o[1]], mat));
        }
        at = o[1];
    }
    if z[1] > at {
        out.push(bx(beta, [x[0], 0.0, at], [x[1], top, z[1]], mat));
    }
    out
}

/// The same along x at z0–z1.
fn wall_x(
    beta: f32,
    x: [f32; 2],
    z: [f32; 2],
    openings: &[[f32; 4]],
    top: f32,
    mat: u32,
) -> Vec<Bx> {
    wall_z(beta, z, x, openings, top, mat)
        .into_iter()
        .map(|b| Bx {
            lo: [b.lo[2], b.lo[1], b.lo[0]],
            hi: [b.hi[2], b.hi[1], b.hi[0]],
            ..b
        })
        .collect()
}

/// A window's cross of bars at x0–x1 across the opening z0–z1, y0–y1.
fn bars(beta: f32, x: [f32; 2], z: [f32; 2], y: [f32; 2]) -> Vec<Bx> {
    let (zm, ym) = (0.5 * (z[0] + z[1]), 0.5 * (y[0] + y[1]));
    vec![
        bx(beta, [x[0], y[0], zm - 0.025], [x[1], y[1], zm + 0.025], mat::WOOD),
        bx(beta, [x[0], ym - 0.025, z[0]], [x[1], ym + 0.025, z[1]], mat::WOOD),
    ]
}

/// The house (its frame: x 11 at the front door to 17 at the back wall, z
/// along the ring): two rooms, the table between him and the one who lives
/// here, the lamp over it, the windows with their bars, the doors.
pub fn house() -> Vec<Bx> {
    let b = HOUSE;
    let h = WALL_H;
    let mut out = Vec::new();
    // The front wall: the door, the table room's window.
    out.extend(wall_z(
        b,
        [11.0, 11.16],
        [-5.5, 6.0],
        &[[-3.5, -2.5, 0.0, 2.15], [1.6, 3.0, 0.9, 2.1]],
        h,
        mat::WALL,
    ));
    out.extend(bars(b, [11.04, 11.12], [1.6, 3.0], [0.9, 2.1]));
    // The back wall: the window he looks out of, the table room's window.
    out.extend(wall_z(
        b,
        [16.84, 17.0],
        [-5.5, 6.0],
        &[[-4.3, -2.7, 0.9, 2.1], [2.4, 3.6, 0.9, 2.1]],
        h,
        mat::WALL,
    ));
    out.extend(bars(b, [16.88, 16.96], [-4.3, -2.7], [0.9, 2.1]));
    out.extend(bars(b, [16.88, 16.96], [2.4, 3.6], [0.9, 2.1]));
    // The sill he leans on.
    out.push(bx(b, [16.6, 0.86, -4.4], [16.86, 0.92, -2.6], mat::WOOD));
    // The ends: the back door in the far one.
    out.push(bx(b, [11.0, 0.0, -5.5], [17.0, h, -5.34], mat::WALL));
    out.extend(wall_x(
        b,
        [11.0, 17.0],
        [5.84, 6.0],
        &[[14.5, 15.5, 0.0, 2.15]],
        h,
        mat::WALL,
    ));
    // The wall between the rooms and its doorway.
    out.extend(wall_x(
        b,
        [11.16, 16.84],
        [0.22, 0.38],
        &[[13.9, 14.9, 0.0, 2.1]],
        h,
        mat::WALL,
    ));
    // The ceiling.
    out.push(bx(b, [11.0, h, -5.5], [17.0, h + 0.06, 6.0], mat::WALL));
    // The table and its legs.
    out.push(bx(b, [12.9, 0.71, 2.6], [14.1, 0.76, 3.4], mat::WOOD));
    for (x, z) in [(12.95, 2.65), (14.0, 2.65), (12.95, 3.3), (14.0, 3.3)] {
        out.push(bx(b, [x, 0.0, z], [x + 0.05, 0.71, z + 0.05], mat::WOOD));
    }
    // His chair (he faces +z) and the host's.
    out.push(bx(b, [13.28, 0.42, 1.95], [13.72, 0.46, 2.39], mat::WOOD));
    out.push(bx(b, [13.28, 0.46, 1.95], [13.72, 0.95, 1.99], mat::WOOD));
    out.push(bx(b, [13.28, 0.42, 3.61], [13.72, 0.46, 4.05], mat::WOOD));
    out.push(bx(b, [13.28, 0.46, 4.01], [13.72, 0.95, 4.05], mat::WOOD));
    for (x, z) in [(13.3, 1.97), (13.66, 1.97), (13.3, 3.99), (13.66, 3.99)] {
        out.push(bx(b, [x, 0.0, z], [x + 0.04, 0.42, z + 0.04], mat::WOOD));
    }
    // The lamp over the table and its cord.
    out.push(bx(b, [13.36, 2.02, 2.86], [13.64, 2.16, 3.14], mat::LAMP));
    out.push(bx(b, [13.49, 2.16, 2.99], [13.51, h, 3.01], mat::DARK));
    // A cupboard in the table room.
    out.push(bx(b, [16.4, 0.0, 4.3], [16.84, 1.9, 5.7], mat::WOOD));
    // The lamp by the front door.
    out.push(bx(b, [10.86, 2.22, -3.9], [11.0, 2.36, -3.76], mat::LAMP));
    // The chimney.
    out.push(bx(b, [14.55, 3.2, -1.05], [15.1, 5.0, -0.5], mat::WALL));
    out
}

/// The station: the platform and its ramp, the canopy on its posts with a
/// lamp at each, the station's own house, benches.
pub fn station() -> Vec<Bx> {
    let s = STATION;
    let mut out = arc(s - 20.0, s + 22.0, 19.95, 22.15, [0.0, PLATFORM], 6.0, mat::STONE);
    // The ramp up from the field, in five steps.
    for i in 0..5 {
        let a = s - 25.0 + i as f32;
        let y = PLATFORM * (i as f32 + 0.5) / 5.0;
        out.push(bx(a + 0.5, [20.5, 0.0, -0.2], [21.7, y, 0.2], mat::STONE));
    }
    for d in station_posts() {
        out.push(bx(s + d, [20.39, PLATFORM, -0.06], [20.51, 3.4, 0.06], mat::POLE));
        out.push(bx(s + d, [20.9, 3.05, -0.1], [21.1, 3.18, 0.1], mat::LAMP));
        out.push(bx(s + d, [20.45, 3.22, -0.03], [21.05, 3.27, 0.03], mat::POLE));
    }
    out.extend(arc(s - 17.0, s + 21.0, 20.15, 22.05, [3.35, 3.45], 6.0, mat::ROOF));
    // The station's house with its lit windows.
    out.push(bx(s + 9.0, [17.3, 0.0, -1.6], [19.6, 3.4, 1.6], mat::FACADE));
    out.push(bx(s + 9.0, [17.1, 3.4, -1.8], [19.8, 3.6, 1.8], mat::ROOF));
    for d in [-10.0, 6.0, 14.0] {
        out.push(bx(s + d, [20.2, PLATFORM, -0.7], [20.55, 0.72, 0.7], mat::WOOD));
    }
    out
}

/// The canopy's posts and lamps, degrees from the station.
pub fn station_posts() -> [f32; 5] {
    [-14.0, -6.0, 2.0, 10.0, 18.0]
}

/// The lake's halt, its ramp down to the shore, the pier and its ramp, a
/// boat at rest.
pub fn lake() -> Vec<Bx> {
    let l = LAKE;
    let mut out = arc(l - 10.0, l + 10.0, 20.4, 22.15, [0.0, PLATFORM], 4.0, mat::STONE);
    for i in 0..4 {
        let x = 19.6 + 0.2 * i as f32;
        let y = PLATFORM * (i as f32 + 0.5) / 4.0;
        out.push(bx(l, [x, 0.0, -0.7], [x + 0.2, y, 0.7], mat::STONE));
    }
    for i in 0..4 {
        let x = 18.6 + 0.25 * i as f32;
        let y = PIER * (4.0 - i as f32 - 0.5) / 4.0;
        out.push(bx(l, [x, 0.0, -0.8], [x + 0.25, y, 0.8], mat::WOOD));
    }
    out.push(bx(l, [14.4, 0.17, -0.8], [18.6, PIER, 0.8], mat::WOOD));
    for x in [14.5, 15.9, 17.3] {
        for z in [-0.74, 0.66] {
            out.push(bx(l, [x, -0.6, z], [x + 0.08, 0.17, z + 0.08], mat::WOOD));
        }
    }
    for z in [-0.7, 0.58] {
        out.push(bx(l, [14.45, PIER, z], [14.57, 0.55, z + 0.12], mat::WOOD));
    }
    // The halt's shelter and its lamp.
    out.push(bx(l + 6.0, [20.55, PLATFORM, -1.2], [20.65, 2.8, 1.2], mat::WALL));
    out.push(bx(l + 6.0, [20.5, 2.8, -1.35], [21.9, 2.9, 1.35], mat::ROOF));
    out.push(bx(l + 6.0, [21.1, 2.55, -0.08], [21.3, 2.68, 0.08], mat::LAMP));
    // A boat on the water.
    out.push(bx(l + 14.0, [12.3, -0.05, -1.4], [13.1, 0.22, 1.4], mat::WOOD));
    out
}

/// The street's houses: (from, to degrees, height).
pub fn street_houses() -> [(f32, f32, f32); 7] {
    [
        (244.0, 252.0, 5.2),
        (252.0, 258.5, 7.0),
        (258.5, 266.0, 4.2),
        (266.0, 270.5, 6.2),
        (270.5, 278.0, 5.6),
        (278.0, 284.0, 7.4),
        (284.0, 290.0, 4.8),
    ]
}

/// The street's lamps, degrees.
pub fn street_lamps() -> [f32; 5] {
    [248.0, 256.0, 268.0, 280.0, 288.0]
}

/// The street: the houses with their lit windows, the café's awning, the
/// lamps on their posts.
pub fn street() -> Vec<Bx> {
    let mut out = Vec::new();
    for (a, b, h) in street_houses() {
        let mid = 0.5 * (a + b);
        let half = FACADE * (0.5 * (b - a) * crate::place::DEG).tan();
        out.push(bx(mid, [FACADE, 0.0, -half], [22.0, h, half], mat::FACADE));
        out.push(bx(mid, [FACADE - 0.12, h, -half - 0.05], [22.0, h + 0.16, half + 0.05], mat::ROOF));
    }
    out.push(bx(CAFE, [19.4, 2.45, -1.3], [FACADE, 2.55, 1.3], mat::ROOF));
    for a in street_lamps() {
        out.push(bx(a, [19.95, 0.0, -0.05], [20.05, 3.7, 0.05], mat::POLE));
        out.push(bx(a, [19.6, 3.66, -0.03], [20.0, 3.72, 0.03], mat::POLE));
        out.push(bx(a, [19.6, 3.5, -0.1], [19.8, 3.66, 0.1], mat::LAMP));
    }
    // Her door's porch roof.
    out.push(bx(FRIEND_DOOR, [19.5, 2.35, -0.8], [FACADE, 2.45, 0.8], mat::ROOF));
    out
}

/// One car in its own frame: x is TRACK + across, y up, z along. A hollow
/// shell: the floor, the roof, the walls round the windows, the field-side
/// door's two leaves, the benches, the rails by the doors, the lamp.
pub fn car() -> Vec<Bx> {
    let [w, roof, l] = CAR;
    let x = |a: f32| TRACK + a;
    let t = 0.06;
    let mut out = vec![
        bx(0.0, [x(-w), 0.05, -l + 0.3], [x(w), CAR_FLOOR - 0.08, l - 0.3], mat::DARK),
        bx(0.0, [x(-w), CAR_FLOOR - 0.08, -l], [x(w), CAR_FLOOR, l], mat::CAR),
        bx(0.0, [x(-w), 3.2, -l], [x(w), roof, l], mat::CAR),
        bx(0.0, [x(-w), CAR_FLOOR, -l], [x(w), 3.2, -l + t], mat::CAR),
        bx(0.0, [x(-w), CAR_FLOOR, l - t], [x(w), 3.2, l], mat::CAR),
    ];
    let [b0, b1] = BAND;
    // The pillars between the panes (panes at 0, ±1.6, ±3.2, ±4.8 along).
    let pillars = |door: bool| {
        let mut p = vec![
            [-l, -5.42],
            [-4.18, -3.82],
            [-2.58, -2.22],
            [2.22, 2.58],
            [3.82, 4.18],
            [5.42, l],
        ];
        if door {
            p.extend([[-0.98, -0.65], [0.65, 0.98]]);
        } else {
            p.extend([[-0.98, -0.35], [0.35, 0.98]]);
        }
        p
    };
    // The far side (out to the country): one wall, a pane in its door.
    let (o0, o1) = (x(w - t), x(w));
    out.push(bx(0.0, [o0, CAR_FLOOR, -l], [o1, b0, l], mat::CAR));
    out.push(bx(0.0, [o0, b1, -l], [o1, 3.2, l], mat::CAR));
    for [a, b] in pillars(false) {
        out.push(bx(0.0, [o0, b0, a], [o1, b1, b], mat::CAR));
    }
    // The field side: the door in the middle.
    let (i0, i1) = (x(-w), x(-w + t));
    out.push(bx(0.0, [i0, CAR_FLOOR, -l], [i1, b0, -0.65], mat::CAR));
    out.push(bx(0.0, [i0, CAR_FLOOR, 0.65], [i1, b0, l], mat::CAR));
    out.push(bx(0.0, [i0, b1, -l], [i1, 3.2, l], mat::CAR));
    for [a, b] in pillars(true) {
        out.push(bx(0.0, [i0, b0, a], [i1, b1, b], mat::CAR));
    }
    let leaf = |z: [f32; 2], flags| Bx {
        lo: [x(-w + t), CAR_FLOOR, z[0]],
        hi: [x(-w + t + 0.04), b1, z[1]],
        mat: mat::CAR,
        flags,
        beta: 0.0,
    };
    out.push(leaf([-0.65, 0.0], LEAF_L));
    out.push(leaf([0.0, 0.65], LEAF_R));
    // Benches along both walls, clear of the doors.
    for (a, b) in [(-w + t, -0.82), (0.82, w - t)] {
        for z in [[-4.9, -1.05], [1.05, 4.9]] {
            out.push(bx(0.0, [x(a), CAR_FLOOR, z[0]], [x(b), 0.74, z[1]], mat::WOOD));
            let back = if a < 0.0 { [a, a + 0.08] } else { [b - 0.08, b] };
            out.push(bx(0.0, [x(back[0]), 0.74, z[0]], [x(back[1]), 1.15, z[1]], mat::WOOD));
        }
    }
    // The rails by the doors (his hand on the far one at 1.16, 0.72).
    for a in [-1.16, 1.16] {
        for z in [-0.72, 0.72] {
            out.push(bx(0.0, [x(a) - 0.025, CAR_FLOOR, z - 0.025], [x(a) + 0.025, 3.2, z + 0.025], mat::POLE));
        }
    }
    out.push(bx(0.0, [x(-0.14), 3.12, -l + 0.4], [x(0.14), 3.2, l - 0.4], mat::LAMP));
    out
}

/// The line's masts out on the country side of the track, every this many
/// degrees, with their arms over the track and the wire's height.
pub const MAST_STEP: f32 = 9.0;
pub const MAST_R: f32 = 25.6;
pub const WIRE_Y: f32 = 4.85;

/// The masts from `a` up to `b` degrees (one group a sector, so a ray
/// tests only the masts near it).
pub fn masts(a: f32, b: f32) -> Vec<Bx> {
    let mut out = Vec::new();
    let mut d = (a / MAST_STEP).ceil() * MAST_STEP + 4.5;
    while d < b {
        out.push(bx(d, [MAST_R - 0.08, 0.0, -0.08], [MAST_R + 0.08, 5.3, 0.08], mat::POLE));
        out.push(bx(d, [TRACK - 0.3, WIRE_Y + 0.12, -0.035], [MAST_R, WIRE_Y + 0.2, 0.035], mat::POLE));
        d += MAST_STEP;
    }
    out
}

/// The crowd on the station's platform: (degrees from the station, out,
/// size, phase). They keep clear of his way up the ramp and along to the
/// car's door, of the canopy's posts and of the benches.
pub const CROWD: [[f32; 4]; 16] = [
    [-19.0, 22.0, 0.95, 0.65],
    [-16.5, 20.25, 1.0, 0.1],
    [-12.0, 22.0, 0.95, 0.7],
    [-8.0, 20.25, 1.05, 0.3],
    [-4.0, 22.0, 0.97, 0.9],
    [-2.0, 20.3, 0.92, 0.5],
    [3.5, 21.9, 1.0, 0.2],
    [4.5, 20.9, 1.02, 0.6],
    [8.0, 21.6, 0.96, 0.4],
    [8.3, 20.45, 1.0, 0.8],
    [11.5, 21.3, 1.04, 0.15],
    [12.5, 22.0, 0.93, 0.55],
    [15.5, 20.8, 1.0, 0.35],
    [16.5, 21.8, 0.98, 0.75],
    [19.5, 21.2, 1.03, 0.25],
    [20.5, 20.4, 0.97, 0.85],
];
/// A person of the crowd: radius, shoulders' and head's height at size 1.
pub const CROWD_R: f32 = 0.19;
pub const CROWD_SHOULDER: f32 = 1.42;
pub const CROWD_HEAD: f32 = 1.62;

/// The field's trees: (out, degrees, height, the crown's radius).
pub const TREES: [[f32; 4]; 10] = [
    [9.0, 120.0, 4.2, 1.3],
    [12.5, 150.0, 5.0, 1.6],
    [7.0, 175.0, 3.6, 1.1],
    [15.0, 188.0, 4.8, 1.5],
    [18.0, 200.0, 5.0, 1.6],
    [10.0, 320.0, 4.4, 1.4],
    [13.0, 345.0, 5.2, 1.7],
    [8.0, 70.0, 3.8, 1.2],
    [15.0, 300.0, 4.6, 1.4],
    [16.5, 130.0, 5.4, 1.8],
];

/// How far apart the cars' middles run, radians.
pub fn car_spacing() -> f32 {
    (2.0 * CAR[2] + 0.7) / TRACK
}

/// A group of boxes and its bounds (world, or the car's frame).
#[derive(Clone, Debug)]
pub struct Group {
    pub first: usize,
    pub count: usize,
    pub lo: [f32; 3],
    pub hi: [f32; 3],
}

/// Everything for the data texture: the boxes' texels and the groups.
pub struct Scenery {
    pub texels: Vec<[f32; 4]>,
    /// The house, the station, the lake, the street, then the masts by
    /// sectors (world bounds).
    pub places: Vec<Group>,
    /// The car's boxes (bounds in its frame).
    pub car: Group,
}

/// The masts' sectors, degrees.
pub const MAST_SECTORS: usize = 8;

/// Where a box's corners land in the frame `beta` is measured from.
fn bounds(boxes: &[Bx], world: bool) -> ([f32; 3], [f32; 3]) {
    let mut lo = [f32::MAX; 3];
    let mut hi = [f32::MIN; 3];
    for b in boxes {
        for i in 0..8 {
            let x = if i & 1 == 0 { b.lo[0] } else { b.hi[0] };
            let y = if i & 2 == 0 { b.lo[1] } else { b.hi[1] };
            let z = if i & 4 == 0 { b.lo[2] } else { b.hi[2] };
            let [wx, wz] = if world { at_frame(b.beta, x, z) } else { [x, z] };
            for (k, v) in [wx, y, wz].into_iter().enumerate() {
                lo[k] = lo[k].min(v);
                hi[k] = hi[k].max(v);
            }
        }
    }
    (lo, hi)
}

impl Scenery {
    /// The boxes' texels start at texel `start` of the data texture.
    pub fn new(start: usize) -> Scenery {
        let mut texels = Vec::new();
        let add = |boxes: Vec<Bx>, world: bool, texels: &mut Vec<[f32; 4]>| {
            let first = start + texels.len();
            for b in &boxes {
                let (s, c) = (b.beta * crate::place::DEG).sin_cos();
                texels.push([b.lo[0], b.lo[1], b.lo[2], b.mat as f32]);
                texels.push([b.hi[0], b.hi[1], b.hi[2], b.flags as f32]);
                texels.push([c, s, 0.0, 0.0]);
            }
            let (lo, hi) = bounds(&boxes, world);
            Group {
                first,
                count: boxes.len(),
                lo,
                hi,
            }
        };
        let mut places = vec![
            add(house(), true, &mut texels),
            add(station(), true, &mut texels),
            add(lake(), true, &mut texels),
            add(street(), true, &mut texels),
        ];
        let sector = 360.0 / MAST_SECTORS as f32;
        for i in 0..MAST_SECTORS {
            let a = i as f32 * sector;
            places.push(add(masts(a, a + sector), true, &mut texels));
        }
        let car = add(car(), false, &mut texels);
        Scenery {
            texels,
            places,
            car,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::place::{ground, polar};

    #[test]
    fn every_box_has_room_and_a_known_surface() {
        for b in house()
            .iter()
            .chain(station().iter())
            .chain(lake().iter())
            .chain(street().iter())
            .chain(car().iter())
        {
            for k in 0..3 {
                assert!(b.hi[k] > b.lo[k], "{b:?}");
            }
            assert!(b.mat <= mat::DARK);
        }
    }

    #[test]
    fn the_platforms_stand_where_people_walk_on_them() {
        // A point on the platform's ground is inside one of its boxes.
        let inside = |boxes: &[Bx], p: [f32; 2], y: f32| {
            boxes.iter().any(|b| {
                let [x, z] = crate::place::from_frame(b.beta, p[0], p[1]);
                (b.lo[0]..=b.hi[0]).contains(&x)
                    && (b.lo[1]..=b.hi[1] + 1e-3).contains(&y)
                    && (b.lo[2]..=b.hi[2]).contains(&z)
            })
        };
        let st = station();
        for d in [-18.0, -5.0, 0.0, 12.0, 21.0] {
            let p = polar(21.3, STATION + d);
            assert!(inside(&st, p, ground(p[0], p[1])), "{d}");
        }
        let lk = lake();
        let p = polar(16.0, LAKE);
        assert!(inside(&lk, p, ground(p[0], p[1])));
    }

    #[test]
    fn the_groups_hold_all_the_boxes() {
        let s = Scenery::new(288);
        let total: usize = s.places.iter().map(|g| g.count).sum::<usize>() + s.car.count;
        assert_eq!(3 * total, s.texels.len());
        assert_eq!(s.places[0].first, 288);
        assert_eq!(s.places.len(), 4 + MAST_SECTORS);
        let masts: usize = s.places[4..].iter().map(|g| g.count).sum();
        assert_eq!(masts, 2 * (360.0 / MAST_STEP) as usize);
        assert!(s.car.hi[0] < TRACK + 1.4 && s.car.lo[0] > TRACK - 1.4);
    }

    #[test]
    fn the_crowd_and_the_trees_keep_out_of_the_ways() {
        let s = Scenery::new(288);
        let hero = crate::Scene::new();
        let k = hero.story.keys;
        for c in CROWD {
            let p = polar(c[1], STATION + c[0]);
            assert_eq!(ground(p[0], p[1]), PLATFORM, "{c:?}");
            for d in station_posts() {
                let q = polar(20.45, STATION + d);
                assert!((p[0] - q[0]).hypot(p[1] - q[1]) > 0.45, "{c:?} by the post {d}");
            }
        }
        let mut t = k.ramp - 3.0;
        while t < k.board {
            let f = hero.frame(t);
            let b = &f.figures[crate::story::HERO].body;
            for c in CROWD {
                let p = polar(c[1], STATION + c[0]);
                let d = (p[0] - b.pelvis.x).hypot(p[1] - b.pelvis.z);
                assert!(d > 0.5, "{c:?} at {t}: {d}");
            }
            t += 0.1;
        }
        for tr in TREES {
            let p = polar(tr[0], tr[1]);
            assert!(crate::place::in_pond(p[0], p[1]) < -tr[3], "{tr:?}");
            for r in &s.places[..4] {
                let inside = (r.lo[0] - tr[3]..=r.hi[0] + tr[3]).contains(&p[0])
                    && (r.lo[2] - tr[3]..=r.hi[2] + tr[3]).contains(&p[1]);
                assert!(!inside, "{tr:?}");
            }
        }
        let route = hero.route;
        for tr in TREES {
            let p = polar(tr[0], tr[1]);
            let near = route
                .iter()
                .map(|q| (q[0] - p[0]).hypot(q[2] - p[1]))
                .fold(f32::MAX, f32::min);
            assert!(near > tr[3] + 0.6, "{tr:?} {near}");
        }
    }
}
