//! Shattered lens glass: a few long radial cracks, short concentric breaks
//! near the impact and a crushed spot. Each shard refracts the dream a little
//! differently, and some shards turn to show the ruins instead.
use crate::scene::Rng;
use crate::{smoothstep, POP};
use std::f64::consts::TAU;

pub const RAYS: usize = 8;
pub const BANDS: usize = 4;
pub const CELLS: usize = RAYS * BANDS;
const REACH: f64 = 95.0;

/// One shard between two radial cracks and two radii.
#[derive(Clone, Debug)]
pub struct Cell {
    pub outline: Vec<[f32; 2]>,
    pub offset: [f32; 2],
    pub tone: f32,
    /// Seconds after the pop when the shard starts turning to the ruins.
    pub flip: Option<f32>,
}

#[derive(Clone, Debug)]
pub struct Ring {
    pub points: [[f32; 2]; 3],
    pub band: usize,
}

#[derive(Clone, Debug)]
pub struct Glass {
    pub impact: [f32; 2],
    /// Points along each crack with their distance from the impact.
    pub rays: Vec<Vec<[f32; 3]>>,
    pub rings: Vec<Ring>,
    pub cells: Vec<Cell>,
    pub crush: Vec<[f32; 2]>,
}

fn at(ray: &[[f64; 3]], radius: f64) -> [f64; 2] {
    for pair in ray.windows(2) {
        let (a, b) = (pair[0], pair[1]);
        if b[2] >= radius {
            let f = (radius - a[2]) / (b[2] - a[2]);
            return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        }
    }
    let last = ray[ray.len() - 1];
    [last[0], last[1]]
}

/// Port of the prototype's `makeGlass(seed, ix, iy)`, draw for draw.
pub fn shatter(seed: u32, impact: [f32; 2]) -> Glass {
    let mut r = Rng::new(seed);
    let (ix, iy) = (f64::from(impact[0]), f64::from(impact[1]));
    let base = r.float() * TAU;
    let mut rays: Vec<Vec<[f64; 3]>> = Vec::with_capacity(RAYS);
    for k in 0..RAYS {
        let mut a = base + k as f64 / RAYS as f64 * TAU + (r.float() - 0.5) * 0.5;
        let (mut x, mut y, mut d) = (ix, iy, 0.0);
        let mut points = vec![[x, y, 0.0]];
        let bend = (r.float() - 0.5) * 0.03;
        while d < REACH {
            let step = 2.5 + 2.5 * r.float();
            a += bend + (r.float() - 0.5) * 0.12;
            x += a.cos() * step;
            y += a.sin() * step;
            d += step;
            points.push([x, y, d]);
        }
        rays.push(points);
    }
    let radii = [
        0.0,
        4.0 + 2.0 * r.float(),
        13.0 + 5.0 * r.float(),
        26.0 + 8.0 * r.float(),
        REACH,
    ];
    let mut rings = Vec::new();
    for (band, &radius) in radii.iter().enumerate().take(BANDS).skip(1) {
        for k in 0..RAYS {
            if r.float() < if band == 1 { 0.1 } else { 0.45 } {
                continue;
            }
            let ring_radius = radius * (0.85 + 0.3 * r.float());
            let a = at(&rays[k], ring_radius);
            let b = at(
                &rays[(k + 1) % RAYS],
                ring_radius * (0.85 + 0.3 * r.float()),
            );
            let mid = [
                (a[0] + b[0]) / 2.0 + (r.float() - 0.5) * 2.0,
                (a[1] + b[1]) / 2.0 + (r.float() - 0.5) * 2.0,
            ];
            rings.push(Ring {
                points: [a, mid, b].map(|p| [p[0] as f32, p[1] as f32]),
                band,
            });
        }
    }
    let mut cells = Vec::with_capacity(CELLS);
    for j in 0..BANDS {
        for k in 0..RAYS {
            let (ra, rb) = (&rays[k], &rays[(k + 1) % RAYS]);
            let inside = |ray: &[[f64; 3]]| {
                ray.iter()
                    .filter(|p| p[2] > radii[j] && p[2] < radii[j + 1])
                    .map(|p| [p[0], p[1]])
                    .collect::<Vec<_>>()
            };
            let mut outline = vec![at(ra, radii[j])];
            outline.extend(inside(ra));
            outline.push(at(ra, radii[j + 1]));
            outline.push(at(rb, radii[j + 1]));
            outline.extend(inside(rb).into_iter().rev());
            outline.push(at(rb, radii[j]));
            let angle = r.float() * TAU;
            let magnitude = (0.35 + 0.95 * r.float()) * (j + 1) as f64 / 3.0;
            let tone = (r.float() - 0.5) * 0.16;
            let flip = if r.float() < 0.65 {
                Some((0.15 + 1.25 * r.float()) as f32)
            } else {
                None
            };
            cells.push(Cell {
                outline: outline
                    .into_iter()
                    .map(|p| [p[0] as f32, p[1] as f32])
                    .collect(),
                offset: [
                    (angle.cos() * magnitude) as f32,
                    (angle.sin() * magnitude) as f32,
                ],
                tone: tone as f32,
                flip,
            });
        }
    }
    let crush = (0..14)
        .map(|_| {
            let a = r.float() * TAU;
            let l = 1.5 + 3.0 * r.float();
            [(a.cos() * l) as f32, (a.sin() * l) as f32]
        })
        .collect();
    Glass {
        impact,
        rays: rays
            .into_iter()
            .map(|ray| {
                ray.into_iter()
                    .map(|p| [p[0] as f32, p[1] as f32, p[2] as f32])
                    .collect()
            })
            .collect(),
        rings,
        cells,
        crush,
    }
}

pub fn lenses() -> [Glass; 2] {
    [shatter(41, [712.0, 143.0]), shatter(77, [846.0, 146.0])]
}

/// A glass chip that falls from the lenses after the pop.
#[derive(Clone, Debug)]
pub struct Chip {
    pub at: [f32; 2],
    pub velocity: [f32; 2],
    pub size: f32,
    pub rotation: f32,
    pub spin: f32,
    pub delay: f32,
}

pub fn chips(glass: &[Glass; 2]) -> Vec<Chip> {
    (0..24)
        .map(|i| {
            let mut r = Rng::new(2000 + i as u32);
            let c = glass[i % 2].impact;
            Chip {
                at: [
                    c[0] + ((r.float() - 0.5) * 60.0) as f32,
                    c[1] + 10.0 + (r.float() * 30.0) as f32,
                ],
                velocity: [
                    ((r.float() - 0.5) * 120.0) as f32,
                    (-80.0 + 100.0 * r.float()) as f32,
                ],
                size: (0.8 + 1.8 * r.float()) as f32,
                rotation: (r.float() * 6.0) as f32,
                spin: ((r.float() - 0.5) * 20.0) as f32,
                delay: (r.float() * 0.12) as f32,
            }
        })
        .collect()
}

/// Per-shard uniforms for one moment: refraction offset (authored px),
/// signed tone and how far the shard has turned to the ruins.
pub fn cell_uniforms(glass: &[Glass; 2], t: f32, crack: f32, growth: f32) -> Vec<f32> {
    let since = t - POP;
    let o = crack * growth;
    let mut out = Vec::with_capacity(2 * CELLS * 4);
    for lens in glass {
        for c in &lens.cells {
            let flip = c
                .flip
                .map_or(0.0, |start| smoothstep(start, start + 0.5, since) * crack);
            out.extend_from_slice(&[c.offset[0] * o, c.offset[1] * o, c.tone * o, flip]);
        }
    }
    out
}

/// The visible part of each crack while it runs out from the impact.
pub fn grown(ray: &[[f32; 3]], growth: f32) -> &[[f32; 3]] {
    let n = ((ray.len() as f32 * growth).ceil() as usize).clamp(2, ray.len());
    &ray[..n]
}

pub fn ring_visible(ring: &Ring, growth: f32) -> bool {
    growth > 0.15 + 0.2 * ring.band as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shards_cover_the_reach_and_cracks_leave_the_lens() {
        for g in lenses() {
            assert_eq!(g.rays.len(), RAYS);
            assert_eq!(g.cells.len(), CELLS);
            for ray in &g.rays {
                assert!(ray.last().unwrap()[2] >= REACH as f32);
            }
            for c in &g.cells {
                assert!(c.outline.len() >= 4);
                assert!(c.outline.iter().flatten().all(|v| v.is_finite()));
                assert!(c.offset[0].hypot(c.offset[1]) <= 1.31 * 4.0 / 3.0);
            }
        }
    }

    #[test]
    fn whole_glass_before_the_pop_and_after_healing() {
        let g = lenses();
        for t in [0.0, 5.0, POP - 0.01, 13.7, 13.99] {
            let crack = crate::crack_amount(t);
            let growth = crate::crack_growth(t);
            assert!(cell_uniforms(&g, t, crack, growth)
                .iter()
                .all(|v| v.abs() < 1e-6));
        }
        let broken = cell_uniforms(&g, POP + 1.5, 1.0, 1.0);
        assert!(broken.chunks(4).any(|c| c[3] > 0.99));
    }
}
