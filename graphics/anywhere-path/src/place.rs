//! The places round the ring and the ground people stand on. The world is
//! a ring of places about an open field: the house (30°), the station
//! (85°), the country, the lake with its pier and halt (232°) and the
//! street with the café; one train runs round them all on the track. The
//! shader draws the same places from the same numbers (`browser.rs` hands
//! them over as `#define`s).
use crate::math::{v3, V3};
use std::f32::consts::{FRAC_PI_2, PI};

pub const DEG: f32 = PI / 180.0;

/// Where the places stand round the ring, degrees (θ = atan2(z, x)).
pub const HOUSE: f32 = 30.0;
pub const STATION: f32 = 115.0;
pub const LAKE: f32 = 232.0;
pub const CAFE: f32 = 262.0;
pub const FRIEND_DOOR: f32 = 274.0;
/// The track's radius and the car's half sizes: across, its roof, along.
pub const TRACK: f32 = 23.5;
pub const CAR: [f32; 3] = [1.3, 3.45, 5.5];
pub const CAR_FLOOR: f32 = 0.3;
pub const PLATFORM: f32 = 0.3;
pub const PIER: f32 = 0.25;
/// The street's facades face the field this far out.
pub const FACADE: f32 = 20.2;
/// Her door: half its width, its height, and the hall behind it as far as
/// its back wall.
pub const HER_DOOR: [f32; 3] = [0.45, 2.15, 21.9];
/// How far her door swings open, radians.
pub const HER_DOOR_OPEN: f32 = 1.45;
/// The moon: its bearing and height, degrees.
pub const MOON_AZ: f32 = 50.0;
pub const MOON_EL: f32 = 24.0;

/// A point `r` out at `deg` on the floor (x, z).
pub fn polar(r: f32, deg: f32) -> [f32; 2] {
    let (s, c) = (deg * DEG).sin_cos();
    [r * c, r * s]
}

pub fn polar3(r: f32, deg: f32, y: f32) -> V3 {
    let [x, z] = polar(r, deg);
    v3(x, y, z)
}

/// A point of a place's own frame (x out from the field, z along the
/// ring the way the angle grows) at `alpha` degrees.
pub fn at_frame(alpha: f32, x: f32, z: f32) -> [f32; 2] {
    let (s, c) = (alpha * DEG).sin_cos();
    [x * c - z * s, x * s + z * c]
}

/// The world point (x, z) in the frame at `alpha` degrees: `at_frame`'s
/// inverse.
pub fn from_frame(alpha: f32, x: f32, z: f32) -> [f32; 2] {
    let (s, c) = (alpha * DEG).sin_cos();
    [x * c + z * s, -x * s + z * c]
}

/// A point of her door's leaf, `along` metres from its hinge and `y` up,
/// with the door open `a` radians (it swings into the hall): world.
/// (`scene.frag` turns the leaf's box about the same hinge.)
pub fn her_leaf(a: f32, along: f32, y: f32) -> V3 {
    let (hx, hz) = (FACADE + 0.08, -HER_DOOR[0] + 0.01);
    let (s, c) = a.sin_cos();
    let [x, z] = at_frame(FRIEND_DOOR, hx + along * s, hz + along * c);
    v3(x, y, z)
}

/// The house's frame: x 11–17 from the front door to the back wall.
pub fn hf(x: f32, z: f32) -> [f32; 2] {
    at_frame(HOUSE, x, z)
}

pub fn hf3(x: f32, y: f32, z: f32) -> V3 {
    let [wx, wz] = hf(x, z);
    v3(wx, y, wz)
}

/// The heading that looks out toward the bearing `deg` (headings face
/// (sin h, cos h)).
pub fn facing(deg: f32) -> f32 {
    FRAC_PI_2 - deg * DEG
}

/// The heading along the ring the way the angle grows, at `deg`.
pub fn ccw(deg: f32) -> f32 {
    -deg * DEG
}

/// The heading from `a` to `b` on the floor.
pub fn toward(a: [f32; 2], b: [f32; 2]) -> f32 {
    (b[0] - a[0]).atan2(b[1] - a[1])
}

pub fn wrap_deg(d: f32) -> f32 {
    (d + 180.0).rem_euclid(360.0) - 180.0
}

pub fn angle_of(x: f32, z: f32) -> f32 {
    z.atan2(x) / DEG
}

/// Whether the bearing `th` lies from `a` round to `b`, degrees.
pub fn within(th: f32, a: f32, b: f32) -> bool {
    (th - a).rem_euclid(360.0) <= (b - a).rem_euclid(360.0)
}

/// The ground's height under a walker: the station's platform and the car
/// beside it, the ramp up to it, the lake's halt and its ramp down to the
/// shore, the pier's ramp and its deck. (`scene.frag` builds them alike.)
pub fn ground(x: f32, z: f32) -> f32 {
    let r = (x * x + z * z).sqrt();
    let th = angle_of(x, z);
    if within(th, STATION - 20.0, STATION + 22.0) && (19.95..=24.9).contains(&r) {
        return PLATFORM;
    }
    if within(th, STATION - 25.0, STATION - 20.0) && (r - 21.1).abs() <= 0.6 {
        return PLATFORM * wrap_deg(th - (STATION - 25.0)) / 5.0;
    }
    if within(th, LAKE - 10.0, LAKE + 10.0) && (20.4..=24.9).contains(&r) {
        return PLATFORM;
    }
    let side = r * wrap_deg(th - LAKE) * DEG;
    if side.abs() <= 0.7 && (19.6..20.4).contains(&r) {
        return PLATFORM * (r - 19.6) / 0.8;
    }
    if side.abs() <= 0.8 && (18.6..19.6).contains(&r) {
        return PIER * (19.6 - r);
    }
    if side.abs() <= 0.8 && (14.4..18.6).contains(&r) {
        return PIER;
    }
    0.0
}

/// The lake: a round pond in the field below the halt, its shore wavering a
/// little (`scene.frag` draws the same shore). Its water lies `WATER_Y` down.
pub const POND: [f32; 3] = [11.5, 234.0, 7.4];
pub const WATER_Y: f32 = -0.12;

/// How far inside the shore a point is (metres, below zero on dry land).
pub fn in_pond(x: f32, z: f32) -> f32 {
    let [cx, cz] = polar(POND[0], POND[1]);
    let (dx, dz) = (x - cx, z - cz);
    let a = dz.atan2(dx);
    let edge = POND[2] + 0.45 * (3.0 * a + 0.7).sin() + 0.25 * (5.0 * a + 2.1).sin();
    edge - (dx * dx + dz * dz).sqrt()
}

/// The car's frame with its middle at `phi` radians round the ring: a
/// point (across from the track, up, along) in the world.
pub fn car_point(phi: f32, across: f32, up: f32, along: f32) -> V3 {
    let (s, c) = phi.sin_cos();
    let r = TRACK + across;
    v3(r * c - along * s, up, r * s + along * c)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_frames_agree() {
        let p = hf(1.0, 0.0);
        assert!((angle_of(p[0], p[1]) - HOUSE).abs() < 1e-3);
        let h = facing(HOUSE);
        assert!((h.sin() - p[0]).abs() < 1e-4 && (h.cos() - p[1]).abs() < 1e-4);
        let a = car_point(LAKE * DEG, 0.0, 0.0, 0.0);
        assert!((angle_of(a.x, a.z) - wrap_deg(LAKE)).abs() < 1e-3);
        assert!(within(5.0, 350.0, 10.0) && !within(20.0, 350.0, 10.0));
    }

    #[test]
    fn the_ground_rises_onto_the_platform_and_the_pier() {
        let p = polar(21.1, STATION);
        assert_eq!(ground(p[0], p[1]), PLATFORM);
        let q = polar(16.0, LAKE);
        assert_eq!(ground(q[0], q[1]), PIER);
        let shore = polar(19.6, LAKE);
        assert!(ground(shore[0], shore[1]).abs() < 1e-3);
        let field = polar(5.0, 200.0);
        assert_eq!(ground(field[0], field[1]), 0.0);
    }

    #[test]
    fn the_pier_reaches_out_over_the_pond_from_dry_shore() {
        let end = polar(14.6, LAKE);
        assert!(in_pond(end[0], end[1]) > 2.0);
        let root = polar(19.6, LAKE);
        assert!(in_pond(root[0], root[1]) < 0.0);
        let boat = polar(12.7, LAKE + 14.0);
        assert!(in_pond(boat[0], boat[1]) > 1.0);
    }
}
