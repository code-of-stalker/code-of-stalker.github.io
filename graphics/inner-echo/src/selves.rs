//! «Без ухода в образы себя»: the images of himself the person's head
//! projects in front of him (Art: different images of himself, not a
//! mirrored copy sitting there). Four poses, each a figure of its own: arms
//! up in triumph, striding off somewhere, hands on the hips, curled up on the
//! floor hugging the knees. Each is a distance field built from a skeleton,
//! baked once into a lattice of cells like the person's inside, and set in
//! the air in an arc in front of him, smaller than he is, facing him. The
//! shader reads the lattices (one 3D texture, the four stacked in z) and the
//! placements (`#define`s from here).
use crate::body::{capsule, ellipsoid, round_cone, smin, sub, V};
use crate::EYES;

/// One cell of an image's lattice, in its own units (a standing person is
/// about 1.8 high).
pub const SELF_CELL: f32 = 0.034;
/// Each image's lattice: its first cell and how many cells each way; the
/// four are stacked in z in one texture.
pub const SELF_FROM: [i32; 3] = [-17, -1, -12];
pub const SELF_CELLS: [usize; 3] = [34, 61, 26];
pub const SELVES: usize = 4;
/// A cell holds a point when its centre is this far inside; the depth that
/// reads as full.
pub const SELF_GAP: f32 = 0.004;
pub const SELF_DEPTH: f32 = 0.06;

/// Where each image hangs in the room: the point under its feet (x, height,
/// z) and its size against its own units. Each turns to face the person.
pub const PLACES: [[f32; 4]; SELVES] = [
    [-0.8, 0.62, 1.02, 0.5],
    [-0.27, 0.74, 1.3, 0.48],
    [0.28, 0.66, 1.3, 0.58],
    [0.8, 0.98, 1.02, 0.62],
];

/// A figure's joints, standing on y = 0 and facing +z; each pair is
/// (+x side, -x side).
pub struct Pose {
    pub head: V,
    pub neck: V,
    pub chest: V,
    pub pelvis: V,
    pub shoulder: [V; 2],
    pub elbow: [V; 2],
    pub hand: [V; 2],
    pub hip: [V; 2],
    pub knee: [V; 2],
    pub ankle: [V; 2],
    pub toe: [V; 2],
}

/// Triumph (arms up, one knee up), striding off, standing proud with the
/// feet wide, curled up small.
pub const POSES: [Pose; SELVES] = [
    Pose {
        head: [0.0, 1.65, 0.0],
        neck: [0.0, 1.5, 0.0],
        chest: [0.0, 1.28, 0.0],
        pelvis: [0.0, 0.97, 0.0],
        shoulder: [[0.19, 1.45, 0.0], [-0.19, 1.45, 0.0]],
        elbow: [[0.33, 1.7, 0.02], [-0.33, 1.7, 0.02]],
        hand: [[0.45, 1.93, 0.04], [-0.45, 1.93, 0.04]],
        hip: [[0.1, 0.93, 0.0], [-0.1, 0.93, 0.0]],
        knee: [[0.12, 0.66, 0.34], [-0.11, 0.51, 0.02]],
        ankle: [[0.12, 0.25, 0.3], [-0.12, 0.08, 0.0]],
        toe: [[0.13, 0.2, 0.43], [-0.13, 0.03, 0.15]],
    },
    Pose {
        head: [0.0, 1.63, 0.1],
        neck: [0.0, 1.49, 0.07],
        chest: [0.0, 1.27, 0.04],
        pelvis: [0.0, 0.95, 0.0],
        shoulder: [[0.19, 1.44, 0.04], [-0.19, 1.44, 0.04]],
        elbow: [[0.21, 1.19, -0.1], [-0.21, 1.2, 0.14]],
        hand: [[0.22, 0.95, -0.2], [-0.19, 1.02, 0.33]],
        hip: [[0.1, 0.91, 0.0], [-0.1, 0.91, 0.0]],
        knee: [[0.1, 0.5, 0.17], [-0.1, 0.5, -0.1]],
        ankle: [[0.11, 0.09, 0.27], [-0.11, 0.14, -0.3]],
        toe: [[0.12, 0.06, 0.4], [-0.11, 0.02, -0.2]],
    },
    Pose {
        head: [0.0, 1.66, -0.01],
        neck: [0.0, 1.51, 0.0],
        chest: [0.0, 1.29, 0.02],
        pelvis: [0.0, 0.97, 0.0],
        shoulder: [[0.2, 1.46, 0.0], [-0.2, 1.46, 0.0]],
        elbow: [[0.37, 1.22, -0.05], [-0.37, 1.22, -0.05]],
        hand: [[0.19, 1.0, 0.03], [-0.19, 1.0, 0.03]],
        hip: [[0.1, 0.93, 0.0], [-0.1, 0.93, 0.0]],
        knee: [[0.19, 0.52, 0.01], [-0.19, 0.52, 0.01]],
        ankle: [[0.29, 0.09, 0.0], [-0.29, 0.09, 0.0]],
        toe: [[0.33, 0.03, 0.13], [-0.33, 0.03, 0.13]],
    },
    Pose {
        head: [0.0, 0.62, 0.19],
        neck: [0.0, 0.56, 0.05],
        chest: [0.0, 0.41, -0.02],
        pelvis: [0.0, 0.15, -0.12],
        shoulder: [[0.18, 0.53, 0.0], [-0.18, 0.53, 0.0]],
        elbow: [[0.24, 0.34, 0.15], [-0.24, 0.34, 0.15]],
        hand: [[0.06, 0.3, 0.34], [-0.06, 0.3, 0.34]],
        hip: [[0.1, 0.12, -0.1], [-0.1, 0.12, -0.1]],
        knee: [[0.1, 0.47, 0.19], [-0.1, 0.47, 0.19]],
        ankle: [[0.11, 0.08, 0.28], [-0.11, 0.08, 0.28]],
        toe: [[0.12, 0.03, 0.41], [-0.12, 0.03, 0.41]],
    },
];

/// Signed distance to image `i`'s skin, in its own units.
pub fn field(i: usize, p: V) -> f32 {
    let pose = &POSES[i];
    let mut d = round_cone(p, pose.pelvis, pose.chest, 0.125, 0.135);
    d = smin(d, capsule(p, pose.hip[0], pose.hip[1], 0.085), 0.06);
    d = smin(
        d,
        capsule(p, pose.shoulder[0], pose.shoulder[1], 0.062),
        0.07,
    );
    d = smin(d, round_cone(p, pose.chest, pose.neck, 0.11, 0.048), 0.05);
    d = smin(d, ellipsoid(sub(p, pose.head), [0.092, 0.116, 0.104]), 0.04);
    for s in 0..2 {
        let mut arm = round_cone(p, pose.shoulder[s], pose.elbow[s], 0.05, 0.04);
        arm = smin(
            arm,
            round_cone(p, pose.elbow[s], pose.hand[s], 0.04, 0.034),
            0.03,
        );
        let mut leg = round_cone(p, pose.hip[s], pose.knee[s], 0.085, 0.058);
        leg = smin(
            leg,
            round_cone(p, pose.knee[s], pose.ankle[s], 0.056, 0.04),
            0.04,
        );
        leg = smin(
            leg,
            round_cone(p, pose.ankle[s], pose.toe[s], 0.042, 0.03),
            0.03,
        );
        d = smin(d, leg, 0.05);
        d = smin(d, arm, 0.03);
    }
    d
}

/// How image `i` turns round the vertical to face the person (radians): its
/// own +z points at the eyes, seen from above.
pub fn yaw(i: usize) -> f32 {
    let [x, _, z, _] = PLACES[i];
    (EYES[0] - x).atan2(EYES[2] - z)
}

/// A point of image `i` (its own units) in the room. The shader turns rays
/// the other way.
pub fn to_world(i: usize, q: V) -> V {
    let [x, y, z, size] = PLACES[i];
    let (s, c) = yaw(i).sin_cos();
    [
        x + size * (c * q[0] + s * q[2]),
        y + size * q[1],
        z + size * (-s * q[0] + c * q[2]),
    ]
}

/// The points the head's light lands on in image `i` (its own units): the
/// head, both hands, both ankles.
pub fn beam_targets(i: usize) -> [V; 5] {
    let pose = &POSES[i];
    [
        pose.head,
        pose.hand[0],
        pose.hand[1],
        pose.ankle[0],
        pose.ankle[1],
    ]
}

/// The centre of cell `(x, y, z)` of an image's lattice, in its own units.
pub fn cell_centre(x: usize, y: usize, z: usize) -> V {
    let c = [x, y, z];
    std::array::from_fn(|k| ((SELF_FROM[k] + c[k] as i32) as f32 + 0.5) * SELF_CELL)
}

/// All four lattices, one byte a cell, x fastest, then y, then z, image
/// after image along z (the order of `texImage3D`): 0 outside, 1..=255
/// inside by depth.
pub fn occupancy() -> Vec<u8> {
    let [w, h, d] = SELF_CELLS;
    let mut cells = Vec::with_capacity(w * h * d * SELVES);
    for i in 0..SELVES {
        for z in 0..d {
            for y in 0..h {
                for x in 0..w {
                    let depth = -field(i, cell_centre(x, y, z));
                    cells.push(if depth > SELF_GAP {
                        1 + ((depth / SELF_DEPTH).clamp(0.0, 1.0) * 254.0).round() as u8
                    } else {
                        0
                    });
                }
            }
        }
    }
    cells
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::body;

    fn lattice(i: usize) -> Vec<bool> {
        let n = SELF_CELLS.iter().product::<usize>();
        occupancy()[i * n..(i + 1) * n]
            .iter()
            .map(|&v| v > 0)
            .collect()
    }

    #[test]
    fn each_image_is_a_whole_figure_inside_its_lattice() {
        let [w, h, d] = SELF_CELLS;
        assert_eq!(occupancy().len(), w * h * d * SELVES);
        for (i, pose) in POSES.iter().enumerate() {
            let cells = lattice(i);
            let count = cells.iter().filter(|&&v| v).count();
            assert!((500..4000).contains(&count), "{i}: {count}");
            for z in 0..d {
                for y in 0..h {
                    for x in 0..w {
                        let border =
                            x == 0 || y == 0 || z == 0 || x == w - 1 || y == h - 1 || z == d - 1;
                        assert!(!(border && cells[x + w * (y + h * z)]), "{i}: {x} {y} {z}");
                    }
                }
            }
            // Every joint is inside its figure: no limb is lost.
            let mut joints = vec![pose.head, pose.neck, pose.chest, pose.pelvis];
            for s in 0..2 {
                joints.extend([
                    pose.shoulder[s],
                    pose.elbow[s],
                    pose.hand[s],
                    pose.hip[s],
                    pose.knee[s],
                    pose.ankle[s],
                    pose.toe[s],
                ]);
            }
            for p in joints {
                // A hair off the joint: an ellipsoid's field has no value at
                // its very centre.
                let p = p.map(|v| v + 1e-3);
                assert!(field(i, p) < -0.02, "{i}: {p:?} at {}", field(i, p));
            }
        }
    }

    #[test]
    fn the_images_differ_from_each_other() {
        // Art: «разные образы самого себя». No two share most of their cells.
        for a in 0..SELVES {
            for b in a + 1..SELVES {
                let (x, y) = (lattice(a), lattice(b));
                let both = x.iter().zip(&y).filter(|(p, q)| **p && **q).count();
                let either = x.iter().zip(&y).filter(|(p, q)| **p || **q).count();
                let share = both as f32 / either as f32;
                assert!(share < 0.55, "{a} {b}: {share}");
            }
        }
    }

    #[test]
    fn the_images_hang_in_front_of_the_person_apart_and_facing_him() {
        let mut boxes = Vec::new();
        for (i, pose) in POSES.iter().enumerate() {
            let cells = lattice(i);
            let [w, h, _] = SELF_CELLS;
            let (mut lo, mut hi) = ([9f32; 3], [-9f32; 3]);
            for (k, _) in cells.iter().enumerate().filter(|(_, &v)| v) {
                let p = to_world(i, cell_centre(k % w, (k / w) % h, k / (w * h)));
                for j in 0..3 {
                    lo[j] = lo[j].min(p[j]);
                    hi[j] = hi[j].max(p[j]);
                }
                // In front of the person's knees and feet, off the floor,
                // and clear of his skin.
                assert!(p[2] > 0.72, "{i}: {p:?}");
                assert!(p[1] > 0.5, "{i}: {p:?}");
                assert!(body::figure(p) > 0.1, "{i}: {p:?}");
            }
            // Smaller than he is.
            assert!(hi[1] - lo[1] < 1.1, "{i}");
            boxes.push((lo, hi));
            // Its face looks at him: the nose is nearer his eyes than the
            // back of its head.
            let head = pose.head;
            let gap = |dz: f32| {
                let p = to_world(i, [head[0], head[1], head[2] + dz]);
                (0..3).map(|k| (p[k] - EYES[k]).powi(2)).sum::<f32>()
            };
            assert!(gap(0.1) < gap(-0.1), "{i}");
        }
        // No two overlap: they stand side by side in the arc.
        for a in 0..SELVES {
            for b in a + 1..SELVES {
                let ((la, ha), (lb, hb)) = (boxes[a], boxes[b]);
                let apart = (0..3).any(|k| la[k] > hb[k] + 0.03 || lb[k] > ha[k] + 0.03);
                assert!(apart, "{a} {b}");
            }
        }
    }
}
