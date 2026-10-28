//! Authored fissures in the immutable mask's source coordinates.
//! Branches grow from their actual junctions; the same deformation as the
//! raster carries every lip and recess through the peel. No screen-space lines.
use crate::geometry::{mask_source_projection, Mesh};
use crate::{smooth, Frame, SIZE};

struct Branch {
    points: &'static [[f32; 2]],
    start: f32,
    end: f32,
    width: f32,
}

const BRANCHES: &[Branch] = &[
    Branch {
        points: &[
            [664., 28.],
            [656., 72.],
            [673., 99.],
            [668., 126.],
            [700., 151.],
            [695., 181.],
            [730., 208.],
            [721., 239.],
            [752., 264.],
            [741., 292.],
            [776., 325.],
            [762., 354.],
            [791., 388.],
            [774., 418.],
            [805., 451.],
            [794., 481.],
            [830., 516.],
            [816., 549.],
            [846., 584.],
            [839., 618.],
            [872., 650.],
            [860., 684.],
            [891., 718.],
            [882., 750.],
            [913., 782.],
            [905., 837.],
        ],
        start: 0.0,
        end: 0.86,
        width: 3.6,
    },
    Branch {
        points: &[
            [700., 151.],
            [667., 163.],
            [643., 151.],
            [613., 180.],
            [587., 175.],
            [557., 207.],
            [528., 210.],
            [500., 245.],
            [473., 254.],
            [447., 294.],
            [413., 310.],
        ],
        start: 0.13,
        end: 0.51,
        width: 2.3,
    },
    Branch {
        points: &[
            [752., 264.],
            [779., 251.],
            [801., 266.],
            [834., 255.],
            [861., 275.],
            [886., 270.],
            [915., 295.],
            [944., 302.],
            [966., 332.],
            [1005., 339.],
        ],
        start: 0.26,
        end: 0.59,
        width: 2.5,
    },
    Branch {
        points: &[
            [774., 418.],
            [744., 427.],
            [721., 416.],
            [689., 438.],
            [660., 432.],
            [634., 461.],
            [600., 466.],
            [572., 495.],
            [539., 488.],
            [509., 517.],
            [476., 526.],
            [444., 561.],
            [410., 568.],
        ],
        start: 0.43,
        end: 0.84,
        width: 3.0,
    },
    Branch {
        points: &[
            [805., 451.],
            [834., 442.],
            [858., 457.],
            [888., 448.],
            [910., 468.],
            [940., 461.],
            [962., 486.],
            [1004., 493.],
            [1030., 512.],
        ],
        start: 0.48,
        end: 0.75,
        width: 1.9,
    },
    Branch {
        points: &[
            [846., 584.],
            [814., 597.],
            [788., 584.],
            [760., 610.],
            [728., 610.],
            [706., 641.],
            [672., 649.],
            [645., 679.],
            [612., 679.],
            [584., 711.],
            [547., 721.],
            [514., 754.],
        ],
        start: 0.65,
        end: 1.0,
        width: 2.5,
    },
    Branch {
        points: &[
            [872., 650.],
            [898., 638.],
            [922., 651.],
            [951., 644.],
            [976., 664.],
            [1004., 665.],
        ],
        start: 0.74,
        end: 0.97,
        width: 1.7,
    },
    Branch {
        points: &[[643., 151.], [637., 126.], [613., 109.], [618., 84.]],
        start: 0.29,
        end: 0.49,
        width: 1.0,
    },
    Branch {
        points: &[
            [634., 461.],
            [624., 433.],
            [600., 418.],
            [605., 390.],
            [580., 373.],
        ],
        start: 0.63,
        end: 0.88,
        width: 1.15,
    },
    Branch {
        points: &[[672., 649.], [650., 630.], [623., 632.], [608., 607.]],
        start: 0.88,
        end: 1.0,
        width: 1.0,
    },
];

fn distance(a: [f32; 2], b: [f32; 2]) -> f32 {
    ((b[0] - a[0]).powi(2) + (b[1] - a[1]).powi(2)).sqrt()
}

/// A child cannot appear until its parent has physically reached the junction.
/// Resolve from authored distances so editing a crack does not break timing.
fn growth_windows() -> [[f32; 2]; BRANCHES.len()] {
    let mut windows = [[0.0; 2]; BRANCHES.len()];
    for (i, branch) in BRANCHES.iter().enumerate() {
        let mut start = branch.start;
        for (parent_index, parent) in BRANCHES[..i].iter().enumerate() {
            if let Some(junction) = parent.points.iter().position(|p| *p == branch.points[0]) {
                let total: f32 = parent.points.windows(2).map(|p| distance(p[0], p[1])).sum();
                let travelled: f32 = parent.points[..=junction]
                    .windows(2)
                    .map(|p| distance(p[0], p[1]))
                    .sum();
                let fraction = travelled / total;
                let (mut low, mut high) = (0.0, 1.0);
                for _ in 0..14 {
                    let mid = (low + high) * 0.5;
                    if smooth(0.0, 1.0, mid) < fraction {
                        low = mid;
                    } else {
                        high = mid;
                    }
                }
                let [a, b] = windows[parent_index];
                start = start.max(a + (b - a) * high + 0.004);
                break;
            }
        }
        windows[i] = [start, branch.end.max(start + 0.08).min(1.0)];
    }
    windows
}

fn segment(m: &mut Mesh, f: &Frame, a: [f32; 2], b: [f32; 2], style: [f32; 4]) {
    let [width, offset, material, alpha] = style;
    let length = distance(a, b);
    if length < 0.01 {
        return;
    }
    let normal = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
    let p = |at: [f32; 2], side: f32| {
        [
            at[0] + normal[0] * (offset + width * side),
            at[1] + normal[1] * (offset + width * side),
        ]
    };
    let source = [p(a, -1.), p(b, -1.), p(b, 1.), p(a, 1.)];
    let positions = source.map(|p| mask_source_projection(f, p));
    let uv = source.map(|p| [p[0] / SIZE[0], p[1] / SIZE[1]]);
    m.quad(
        positions,
        uv,
        [[material, alpha, 0., 0.]; 4],
        [[-1., 0., 0.], [-1., 0., 0.], [1., 0., 0.], [1., 0., 0.]],
    );
}

pub fn draw(m: &mut Mesh, f: &Frame) {
    if f.fracture_progress <= 0.0 || f.mask_opacity < 0.001 {
        return;
    }
    let windows = growth_windows();
    // Shadow under the fractured material, dark recess, then a single lit lip.
    // Full alpha is clipped to the original raster by the fracture shader.
    for layer in 0..3 {
        for (branch, [start, end]) in BRANCHES.iter().zip(windows) {
            let extent = smooth(start, end, f.fracture_progress);
            if extent <= 0.0 {
                continue;
            }
            let length: f32 = branch.points.windows(2).map(|p| distance(p[0], p[1])).sum();
            let mut remaining = extent * length;
            for p in branch.points.windows(2) {
                if remaining <= 0.0 {
                    break;
                }
                let span = distance(p[0], p[1]);
                let part = (remaining / span).min(1.0);
                let b = [
                    p[0][0] + (p[1][0] - p[0][0]) * part,
                    p[0][1] + (p[1][1] - p[0][1]) * part,
                ];
                let strength = smooth(0.0, 0.025, extent) * f.mask_opacity;
                let (width, offset, alpha) = match layer {
                    0 => (branch.width * 1.9, 0.8, 0.35),
                    1 => (branch.width * 0.52, 0.0, 1.0),
                    _ => (branch.width * 0.23, -branch.width * 0.82, 0.75),
                };
                segment(
                    m,
                    f,
                    p[0],
                    b,
                    [width, offset, layer as f32, strength * alpha],
                );
                remaining -= span;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{compose_variant, Variant};
    #[test]
    fn fissures_wait_for_their_phase_and_stay_on_the_departing_shell() {
        let mut m = Mesh::default();
        draw(&mut m, &compose_variant(0., Variant::CrackThenPeel));
        assert_eq!(m.vertices(), 0);
        draw(&mut m, &compose_variant(21., Variant::Peel));
        assert_eq!(m.vertices(), 0);
        let resting = compose_variant(9., Variant::CrackThenPeel);
        draw(&mut m, &resting);
        assert!(m.vertices() > 1000 && m.vertices() < 3000);
        let detached = compose_variant(21., Variant::CrackThenPeel);
        let before = m.data.clone();
        m.clear();
        draw(&mut m, &detached);
        assert_eq!(before.len(), m.data.len());
        for (a, b) in before
            .as_chunks::<11>()
            .0
            .iter()
            .zip(m.data.as_chunks::<11>().0)
        {
            assert_eq!(&a[2..4], &b[2..4]); // unchanged UV: no slipping over the raster
            assert!(b[0] > a[0] + 300.0);
            assert!(b.iter().all(|v| v.is_finite()));
        }
    }
}
