//! The seated person's body as a distance field, the same one the shader
//! draws, and its inside baked once into a lattice of cells: which cells hold
//! a warm point and how deep inside they lie. The person sits upright on the
//! chair, feet flat on the floor, hands on the thighs, facing +z.
use crate::INSIDE;

pub(crate) type V = [f32; 3];

/// The lattice: its first cell and how many cells each way. Cell `i` spans
/// `i * INSIDE .. (i + 1) * INSIDE`.
pub const CELL_FROM: [i32; 3] = [-12, 0, -8];
pub const CELLS: [usize; 3] = [24, 56, 36];
/// A cell holds a point when its centre is this far inside the skin; the
/// depth that reads as full.
pub const SKIN_GAP: f32 = 0.012;
pub const DEPTH: f32 = 0.12;

pub(crate) fn sub(a: V, b: V) -> V {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
pub(crate) fn dot(a: V, b: V) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
pub(crate) fn length(a: V) -> f32 {
    dot(a, a).sqrt()
}
pub(crate) fn scale(a: V, s: f32) -> V {
    a.map(|v| v * s)
}
/// GLSL's `sign`: 0 at 0.
fn sign(x: f32) -> f32 {
    if x > 0.0 {
        1.0
    } else if x < 0.0 {
        -1.0
    } else {
        0.0
    }
}

pub(crate) fn ellipsoid(p: V, r: V) -> f32 {
    let k0 = length([p[0] / r[0], p[1] / r[1], p[2] / r[2]]);
    let k1 = length([
        p[0] / (r[0] * r[0]),
        p[1] / (r[1] * r[1]),
        p[2] / (r[2] * r[2]),
    ]);
    k0 * (k0 - 1.0) / k1
}

pub(crate) fn capsule(p: V, a: V, b: V, r: f32) -> f32 {
    let (pa, ba) = (sub(p, a), sub(b, a));
    let h = (dot(pa, ba) / dot(ba, ba)).clamp(0.0, 1.0);
    length(sub(pa, scale(ba, h))) - r
}

/// A cone with round ends, radius `r1` at `a` and `r2` at `b` (exact).
pub(crate) fn round_cone(p: V, a: V, b: V, r1: f32, r2: f32) -> f32 {
    let ba = sub(b, a);
    let l2 = dot(ba, ba);
    let rr = r1 - r2;
    let a2 = l2 - rr * rr;
    let il2 = 1.0 / l2;
    let pa = sub(p, a);
    let y = dot(pa, ba);
    let z = y - l2;
    let xv = sub(scale(pa, l2), scale(ba, y));
    let x2 = dot(xv, xv);
    let y2 = y * y * l2;
    let z2 = z * z * l2;
    let k = sign(rr) * rr * rr * x2;
    if sign(z) * a2 * z2 > k {
        return (x2 + z2).sqrt() * il2 - r2;
    }
    if sign(y) * a2 * y2 < k {
        return (x2 + y2).sqrt() * il2 - r1;
    }
    ((x2 * a2 * il2).sqrt() + y * rr) * il2 - r1
}

pub(crate) fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = (0.5 + 0.5 * (b - a) / k).clamp(0.0, 1.0);
    b + (a - b) * h - k * h * (1.0 - h)
}

/// Signed distance to the skin: hips, waist, chest, shoulders, neck, head;
/// thighs along the seat, shins down, feet flat; arms down, forearms
/// forward, hands on the thighs. Mirrored in x.
pub fn figure(p: V) -> f32 {
    let q = [p[0].abs(), p[1], p[2]];
    let at = |c: V| sub(p, c);
    let mut d = ellipsoid(at([0.0, 0.6, -0.035]), [0.165, 0.12, 0.128]);
    d = smin(
        d,
        ellipsoid(at([0.0, 0.79, -0.045]), [0.142, 0.15, 0.094]),
        0.07,
    );
    d = smin(
        d,
        ellipsoid(at([0.0, 0.975, -0.04]), [0.172, 0.165, 0.118]),
        0.07,
    );
    d = smin(
        d,
        capsule(p, [-0.165, 1.09, -0.055], [0.165, 1.09, -0.055], 0.056),
        0.07,
    );
    d = smin(
        d,
        capsule(p, [0.0, 1.1, -0.045], [0.0, 1.21, -0.035], 0.046),
        0.04,
    );
    d = smin(
        d,
        ellipsoid(at([0.0, 1.31, -0.02]), [0.091, 0.117, 0.104]),
        0.045,
    );
    let mut leg = round_cone(q, [0.1, 0.565, -0.01], [0.112, 0.535, 0.43], 0.085, 0.057);
    leg = smin(
        leg,
        round_cone(q, [0.114, 0.51, 0.445], [0.116, 0.095, 0.47], 0.053, 0.036),
        0.045,
    );
    leg = smin(
        leg,
        round_cone(q, [0.116, 0.06, 0.455], [0.126, 0.036, 0.615], 0.04, 0.03),
        0.03,
    );
    let mut arm = round_cone(q, [0.198, 1.065, -0.055], [0.222, 0.81, 0.0], 0.049, 0.04);
    arm = smin(
        arm,
        round_cone(q, [0.222, 0.81, 0.0], [0.172, 0.64, 0.29], 0.039, 0.031),
        0.03,
    );
    arm = smin(
        arm,
        ellipsoid(sub(q, [0.166, 0.622, 0.335]), [0.042, 0.022, 0.062]),
        0.02,
    );
    d = smin(d, leg, 0.05);
    smin(d, arm, 0.028)
}

/// The centre of lattice cell `(x, y, z)` (counted from `CELL_FROM`).
pub fn cell_centre(x: usize, y: usize, z: usize) -> V {
    let c = [x, y, z];
    std::array::from_fn(|i| ((CELL_FROM[i] + c[i] as i32) as f32 + 0.5) * INSIDE)
}

/// One byte a cell, x fastest, then y, then z (the order of `texImage3D`):
/// 0 outside, 1..=255 inside by depth.
pub fn occupancy() -> Vec<u8> {
    let [w, h, d] = CELLS;
    let mut cells = Vec::with_capacity(w * h * d);
    for z in 0..d {
        for y in 0..h {
            for x in 0..w {
                let depth = -figure(cell_centre(x, y, z));
                cells.push(if depth > SKIN_GAP {
                    1 + ((depth / DEPTH).clamp(0.0, 1.0) * 254.0).round() as u8
                } else {
                    0
                });
            }
        }
    }
    cells
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::HEART;

    #[test]
    fn the_person_sits_upright_with_feet_on_the_floor() {
        assert!(figure(HEART) < -0.1, "the heart is deep inside");
        // The crown of the head, the soles, the hands on the thighs.
        assert!(figure([0.0, 1.43, -0.02]).abs() < 0.01);
        assert!(figure([0.0, 1.47, -0.02]) > 0.03);
        for x in [-0.126, 0.126] {
            assert!(figure([x, 0.012, 0.6]) < 0.0, "the foot is on the floor");
            assert!(figure([x, -0.012, 0.6]) > 0.0, "and not under it");
        }
        assert!(figure([0.166, 0.63, 0.33]) < 0.0);
        // Upright: the head sits over the hips, not leaning forward.
        assert!(figure([0.0, 1.3, -0.02]) < -0.05 && figure([0.0, 1.3, 0.12]) > 0.0);
    }

    #[test]
    fn the_lattice_holds_the_whole_inside_and_nothing_at_its_border() {
        let cells = occupancy();
        let [w, h, d] = CELLS;
        assert_eq!(cells.len(), w * h * d);
        let inside = cells.iter().filter(|&&v| v > 0).count();
        assert!((1500..6000).contains(&inside), "{inside}");
        for z in 0..d {
            for y in 0..h {
                for x in 0..w {
                    let border =
                        x == 0 || y == 0 || z == 0 || x == w - 1 || y == h - 1 || z == d - 1;
                    if border {
                        assert_eq!(cells[x + w * (y + h * z)], 0, "{x} {y} {z}");
                    }
                }
            }
        }
        // The heart's cell is inside and deep.
        let at: [usize; 3] =
            std::array::from_fn(|i| ((HEART[i] / INSIDE).floor() as i32 - CELL_FROM[i]) as usize);
        assert!(cells[at[0] + w * (at[1] + h * at[2])] > 200);
    }
}
