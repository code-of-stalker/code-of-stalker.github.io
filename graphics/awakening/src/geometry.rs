//! Deformable raster face mask with sparse ambient light and loosening ties.
//! Every point is authored in the portrait's 1536×1024 coordinates. There are
//! deliberately no framed pictures, chairs, rooms, whole bodies or copies.
use crate::mesh::{Color, Dot};
pub use crate::mesh::{Mesh, STRIDE};
use crate::{hash, smooth, Camera, Frame, LOOP_SECONDS, SIZE};
use std::f32::consts::{PI, TAU};

fn room(v: f32) -> Color {
    [v, 0.0, 0.0, 0.0]
}
fn light(v: f32) -> Color {
    [v * 0.3, v, 0.0, 0.0]
}
fn variable_stroke(m: &mut Mesh, p: &[[f32; 2]], half: f32, color: impl Fn(usize) -> Color) {
    let dots: Vec<_> = p
        .iter()
        .enumerate()
        .map(|(i, &at)| Dot {
            at,
            half,
            coc: 0.0,
            color: color(i),
        })
        .collect();
    m.strip(&dots);
}
fn bezier(points: [[f32; 2]; 4], count: usize) -> Vec<[f32; 2]> {
    (0..=count)
        .map(|i| {
            let t = i as f32 / count as f32;
            let u = 1.0 - t;
            std::array::from_fn(|axis| {
                u * u * u * points[0][axis]
                    + 3.0 * u * u * t * points[1][axis]
                    + 3.0 * u * t * t * points[2][axis]
                    + t * t * t * points[3][axis]
            })
        })
        .collect()
}

const TETHER_ANCHORS: [[f32; 2]; 5] = [
    [608., 239.],
    [570., 368.],
    [589., 492.],
    [745., 589.],
    [824., 425.],
];
const MASK_COLUMNS: usize = 40;
const MASK_ROWS: usize = 32;

fn depth(p: [f32; 2]) -> f32 {
    let bulb = |o: [f32; 2], r: [f32; 2]| {
        let d = ((p[0] - o[0]) / r[0]).powi(2) + ((p[1] - o[1]) / r[1]).powi(2);
        (-d * 1.8).exp()
    };
    -14.0
        - 65.0 * bulb([817., 398.], [40., 88.])
        - 21.0 * bulb([650., 435.], [116., 105.])
        - 18.0 * bulb([704., 205.], [127., 105.])
        - 15.0 * bulb([768., 552.], [84., 62.])
}
fn point(f: &Frame, p: [f32; 2]) -> [f32; 2] {
    f.mask_point([p[0], p[1], depth(p)])
}
pub struct Scene {
    particles: Vec<([f32; 2], f32, f32)>,
}
impl Default for Scene {
    fn default() -> Self {
        Self::new()
    }
}
impl Scene {
    pub fn new() -> Self {
        Self {
            particles: (0..48)
                .map(|i| {
                    (
                        [430. + hash(i * 7) * 1000., 80. + hash(i * 7 + 1) * 790.],
                        hash(i * 7 + 2) * TAU,
                        hash(i * 7 + 3),
                    )
                })
                .collect(),
        }
    }
}

pub fn background(m: &mut Mesh, f: &Frame) {
    // Light in open space, drawn behind the portrait. This supports its scale
    // without an illustrative set or another repeated architectural room.
    m.glow([1030., 446.], 340., room(0.012 + 0.012 * f.release));
    let phase = f.time / LOOP_SECONDS * TAU;
    for (i, strength) in [(0, 0.026), (1, 0.013), (2, 0.008)] {
        let offset = i as f32 * 36.;
        let p = bezier(
            [
                [1010. + offset, 95.],
                [1240. + offset + 8. * phase.sin(), 300.],
                [1000. + offset, 630.],
                [1150. + offset, 890.],
            ],
            64,
        );
        variable_stroke(m, &p, 0.9, |j| {
            let t = j as f32 / 64.;
            room(strength * (PI * t).sin().powi(2))
        });
    }
    // Faint interrupted arcs are lens glints, not a closed targeting reticle.
    for (rad, start, end, alpha) in [(390., -0.8, 0.18, 0.017), (418., 0.25, 1.08, 0.013)] {
        let path: Vec<_> = (0..48)
            .map(|i| {
                let t = i as f32 / 47.;
                let a = start + (end - start) * t;
                [810. + rad * a.cos(), 455. + rad * a.sin()]
            })
            .collect();
        variable_stroke(m, &path, 0.65, |i| {
            room(alpha * (PI * i as f32 / 47.).sin())
        });
    }
}

pub fn portrait_quad(m: &mut Mesh, f: &Frame) {
    let points =
        [[0., 0.], [SIZE[0], 0.], [SIZE[0], SIZE[1]], [0., SIZE[1]]].map(|p| f.portrait_point(p));
    m.quad(
        points,
        [[0., 0.], [1., 0.], [1., 1.], [0., 1.]],
        [[0., 0., 0., -4.]; 4],
        [[0.; 3]; 4],
    );
}

/// The entire RGBA asset owns the silhouette, eye detail and material. A regular
/// grid gives the peeling wave enough resolution without tracing the bitmap or
/// introducing a second set of anatomical lines. UVs remain in source space.
pub fn mask_source_point(p: [f32; 2]) -> [f32; 2] {
    [p[0] * 0.82 + 23.0, p[1] * 0.76 + 43.0]
}

/// Projects coordinates authored directly on the immutable 1536×1024 mask
/// asset, sharing both its alignment and the raster mesh's deformation.
pub fn mask_source_projection(f: &Frame, p: [f32; 2]) -> [f32; 2] {
    point(f, mask_source_point(p))
}

pub fn mask_texture(m: &mut Mesh, f: &Frame) {
    if f.mask_opacity < 0.001 {
        return;
    }
    for row in 0..MASK_ROWS {
        let y0 = row as f32 / MASK_ROWS as f32;
        let y1 = (row + 1) as f32 / MASK_ROWS as f32;
        for column in 0..MASK_COLUMNS {
            let x0 = column as f32 / MASK_COLUMNS as f32;
            let x1 = (column + 1) as f32 / MASK_COLUMNS as f32;
            let uv = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
            let positions = uv.map(|p| mask_source_projection(f, [p[0] * SIZE[0], p[1] * SIZE[1]]));
            m.quad(positions, uv, [[0., 0., 0., -4.]; 4], [[0.; 3]; 4]);
        }
    }
}

/// Retained adapter entry point; the raster material is the only mask surface.
pub fn mask(_: &mut Mesh, _: &Frame) {}

pub fn threads(m: &mut Mesh, f: &Frame) {
    if f.tether < 0.001 {
        return;
    }
    for (i, anchor) in TETHER_ANCHORS.iter().enumerate() {
        let start = f.portrait_point(*anchor);
        let end = point(f, *anchor);
        let slack = (1.0 - f.tether) * 44. + f.release * 27.;
        let control = [
            [start[0], start[1]],
            [start[0] + (end[0] - start[0]) * 0.25, start[1] + slack],
            [end[0] - (end[0] - start[0]) * 0.2, end[1] + slack],
            end,
        ];
        let path = bezier(control, 40);
        variable_stroke(m, &path, 0.45, |n| {
            let x = n as f32 / 40.;
            let separation = smooth(i as f32 * 0.06, 0.3 + i as f32 * 0.06, f.tether);
            let release_tail = smooth(0.0, 0.12, f.tether - x * 0.7);
            light(
                0.10 * f.tether
                    * separation
                    * release_tail
                    * (0.75 + 0.25 * (x * TAU - f.time).cos()),
            )
        });
    }
}

pub fn dust(m: &mut Mesh, s: &Scene, f: &Frame, front: bool) {
    let phase = f.time / LOOP_SECONDS * TAU;
    for (i, &(p, seed, scale)) in s.particles.iter().enumerate() {
        if (i % 5 == 0) != front {
            continue;
        }
        let q = [
            p[0] + 6. * (phase + seed).sin(),
            p[1] + 8. * (phase * 2. + seed).cos(),
        ];
        let fade = 0.015 + 0.055 * scale * (0.3 + 0.7 * f.release);
        m.disc(
            q,
            0.45 + scale * 0.8,
            if front { 1.7 } else { 0.2 },
            room(fade),
        );
    }
    // A few small fragments release from the departing shell; no generic storm.
    if front {
        for i in 0..18 {
            let born = 10. + hash(i * 13) * 9.;
            let age = f.time - born;
            if !(0.0..7.0).contains(&age) {
                continue;
            }
            let index = (hash(i * 13 + 1) * TETHER_ANCHORS.len() as f32) as usize;
            let mut p = point(f, TETHER_ANCHORS[index]);
            p[0] += age * (4. + hash(i * 13 + 2) * 5.);
            p[1] += age * age * 0.8;
            let opacity = smooth(0., 0.7, age) * (1. - smooth(3.5, 7., age)) * 0.12;
            m.disc(p, 0.8, 0.4, light(opacity));
        }
    }
}

/// The old composite has an optional cone; a close-up uses only the portrait's
/// authored light and its own narrow glints, so no room-shaped beam is emitted.
pub fn cone(_: &Camera) -> [f32; 8] {
    [0.0; 8]
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_frames_have_finite_and_bounded_geometry() {
        let s = Scene::new();
        let mut m = Mesh::new(20000);
        for t in [0., 3., 7., 11., 16., 21., 27., 31., 35.99] {
            let f = crate::compose(t);
            m.clear();
            background(&mut m, &f);
            portrait_quad(&mut m, &f);
            mask_texture(&mut m, &f);
            mask(&mut m, &f);
            threads(&mut m, &f);
            dust(&mut m, &s, &f, true);
            dust(&mut m, &s, &f, false);
            assert!(m.data.iter().all(|v| v.is_finite()), "time {t}");
            assert!(m.vertices() < 18000, "{} vertices at {t}", m.vertices());
        }
    }
    #[test]
    fn raster_grid_preserves_source_uvs_and_initial_portrait_alignment() {
        let f = crate::compose(0.);
        let mut m = Mesh::default();
        mask_texture(&mut m, &f);
        assert_eq!(m.vertices() as usize, MASK_COLUMNS * MASK_ROWS * 6);
        let mut uv_min = [1.0_f32; 2];
        let mut uv_max = [0.0_f32; 2];
        for vertex in m.data.as_chunks::<STRIDE>().0 {
            let expected = f.portrait_point(mask_source_point([
                vertex[2] * SIZE[0],
                vertex[3] * SIZE[1],
            ]));
            for axis in 0..2 {
                assert!((vertex[axis] - expected[axis]).abs() < 0.001);
                uv_min[axis] = uv_min[axis].min(vertex[axis + 2]);
                uv_max[axis] = uv_max[axis].max(vertex[axis + 2]);
            }
        }
        assert_eq!(uv_min, [0., 0.]);
        assert_eq!(uv_max, [1., 1.]);
    }
    #[test]
    fn raster_mesh_never_folds_or_leaves_bounded_projection() {
        let mut m = Mesh::default();
        for variant in [crate::Variant::Peel, crate::Variant::CrackThenPeel] {
            for i in 0..360 {
                let f = crate::compose_variant(i as f32 * 0.1, variant);
                m.clear();
                mask_texture(&mut m, &f);
                for triangle in m.data.as_chunks::<{ 3 * STRIDE }>().0 {
                    let a = &triangle[..STRIDE];
                    let b = &triangle[STRIDE..2 * STRIDE];
                    let c = &triangle[2 * STRIDE..];
                    let signed_area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
                    assert!(signed_area > 0.0, "fold at {} seconds", f.time);
                    for v in [a, b, c] {
                        assert!((-SIZE[0]..SIZE[0] * 2.).contains(&v[0]));
                        assert!((-SIZE[1]..SIZE[1] * 2.).contains(&v[1]));
                    }
                }
            }
        }
    }
    #[test]
    fn source_projection_matches_every_raster_vertex_in_both_variants() {
        let mut m = Mesh::default();
        for variant in [crate::Variant::Peel, crate::Variant::CrackThenPeel] {
            for t in [0., 5., 8.5, 10., 12., 17., 21., 27., 34.] {
                let f = crate::compose_variant(t, variant);
                m.clear();
                mask_texture(&mut m, &f);
                for v in m.data.as_chunks::<STRIDE>().0 {
                    let projected = mask_source_projection(&f, [v[2] * SIZE[0], v[3] * SIZE[1]]);
                    assert_eq!([v[0], v[1]], projected);
                }
            }
        }
    }
    #[test]
    fn quiet_frame_has_no_tethers_and_a_visible_separated_shell() {
        let f = crate::compose(crate::STILL);
        assert_eq!(f.tether, 0.);
        assert!(f.mask_opacity > 0.6);
        assert_eq!(f.mask_release, 1.);
    }
}
