//! The seated person and the chair as distance fields, the same ones the
//! shader draws. The person sits upright on the chair, the back straight
//! against the backrest, feet flat on the floor, hands on the thighs, facing
//! +z. The body is a glass vessel: the light that fills it lives inside this
//! field, between the two levels `compose` gives.

pub(crate) type V = [f32; 3];

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

/// A box of half sizes `b` round the origin (exact).
pub(crate) fn cuboid(p: V, b: V) -> f32 {
    let q: V = std::array::from_fn(|i| p[i].abs() - b[i]);
    let outside = length(q.map(|v| v.max(0.0)));
    outside + q[0].max(q[1].max(q[2])).min(0.0)
}

/// Signed distance to the chair: the seat, four legs (the back ones run up
/// as the posts of the backrest), the backrest and a rail. Mirrored in x.
pub fn chair(p: V) -> f32 {
    let q = [p[0].abs(), p[1], p[2]];
    let mut d = cuboid(sub(p, [0.0, 0.457, 0.08]), [0.215, 0.018, 0.215]) - 0.006;
    d = d.min(cuboid(sub(q, [0.195, 0.222, 0.27]), [0.016, 0.222, 0.016]) - 0.003);
    d = d.min(cuboid(sub(q, [0.195, 0.5, -0.12]), [0.016, 0.5, 0.016]) - 0.003);
    d = d.min(cuboid(sub(p, [0.0, 0.83, -0.17]), [0.2, 0.13, 0.011]) - 0.004);
    d.min(cuboid(sub(p, [0.0, 0.58, -0.12]), [0.2, 0.02, 0.012]) - 0.003)
}

/// The person and the chair together.
pub fn solid(p: V) -> f32 {
    figure(p).min(chair(p))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BOUNDS, FEET, LEGS};

    #[test]
    fn the_person_sits_upright_on_the_chair_with_feet_on_the_floor() {
        // The crown of the head, the soles, the hands on the thighs.
        assert!(figure([0.0, 1.43, -0.02]).abs() < 0.01);
        assert!(figure([0.0, 1.47, -0.02]) > 0.03);
        for [x, z] in FEET {
            assert!(figure([x, 0.012, z]) < 0.0, "the foot is on the floor");
            assert!(figure([x, -0.012, z]) > 0.0, "and not under it");
        }
        assert!(figure([0.166, 0.63, 0.33]) < 0.0);
        // Upright: the head over the hips, not leaning forward.
        assert!(figure([0.0, 1.3, -0.02]) < -0.05 && figure([0.0, 1.3, 0.12]) > 0.0);
        // Seated: the hips rest on the seat, the back against the backrest,
        // and the body never goes through the chair.
        assert!(figure([0.0, 0.486, 0.0]) < 0.0 && chair([0.0, 0.476, 0.0]) < 0.0);
        assert!(figure([0.1, 0.484, 0.1]) < 0.0 && chair([0.1, 0.478, 0.1]) < 0.0);
        assert!(figure([0.0, 0.95, -0.15]) < 0.012 && chair([0.0, 0.9, -0.16]) < 0.0);
        let mut deepest = 0f32;
        for i in 0..40 {
            for j in 0..90 {
                for k in 0..40 {
                    let p = [
                        -0.3 + 0.6 * i as f32 / 39.0,
                        1.46 * j as f32 / 89.0,
                        -0.22 + 0.92 * k as f32 / 39.0,
                    ];
                    deepest = deepest.min(figure(p).max(chair(p)));
                }
            }
        }
        assert!(deepest > -0.012, "{deepest}");
        // The chair legs stand on the floor.
        for [x, z] in LEGS {
            assert!(chair([x, 0.002, z]) < 0.0 && chair([x, -0.004, z]) > 0.0);
        }
    }

    #[test]
    fn everything_lies_inside_the_bounds_the_shader_marches() {
        let [lo, hi] = BOUNDS;
        for i in 0..60 {
            for j in 0..60 {
                for k in 0..60 {
                    let p: V = std::array::from_fn(|c| {
                        let s = [i, j, k][c] as f32 / 59.0;
                        lo[c] - 0.15 + (hi[c] - lo[c] + 0.3) * s
                    });
                    let inside = (0..3).all(|c| p[c] > lo[c] && p[c] < hi[c]);
                    if !inside {
                        assert!(solid(p) > 0.002, "{p:?}");
                    }
                }
            }
        }
    }
}
