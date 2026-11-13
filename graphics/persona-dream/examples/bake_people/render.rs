//! Traces the body straight along -z (an orthographic eye far out on +z)
//! and inks it like the approved drawings: the outline, the contours where
//! one part passes in front of another, the creases where parts melt
//! together (fading at both ends) and the edges of hair, eyes and cloth.
use crate::model::{field, v3, Mat, Prim, V3};

/// The picture: its size in pixels, the world point of its top-left corner
/// and pixels per metre.
#[derive(Clone, Copy, Debug)]
pub struct Canvas {
    pub w: usize,
    pub h: usize,
    pub x0: f32,
    pub y0: f32,
    pub ppm: f32,
}

impl Canvas {
    fn world(&self, i: usize, j: usize) -> (f32, f32) {
        (
            self.x0 + (i as f32 + 0.5) / self.ppm,
            self.y0 - (j as f32 + 0.5) / self.ppm,
        )
    }
}

#[derive(Clone, Copy, Debug, Default)]
pub struct Hit {
    pub hit: bool,
    /// Towards the eye is +z.
    pub z: f32,
    pub near: u16,
    /// How deep the melt fills a crease here (m).
    pub fill: f32,
    pub mat: Mat,
    pub n: V3,
}

const TILE: usize = 16;

pub fn trace(prims: &[Prim], c: &Canvas) -> Vec<Hit> {
    let bounds: Vec<(V3, V3)> = prims.iter().map(Prim::bounds).collect();
    let tw = c.w.div_ceil(TILE);
    let th = c.h.div_ceil(TILE);
    let mut tiles: Vec<Vec<u16>> = Vec::with_capacity(tw * th);
    for ty in 0..th {
        for tx in 0..tw {
            let xa = c.x0 + (tx * TILE) as f32 / c.ppm;
            let xb = c.x0 + ((tx + 1) * TILE) as f32 / c.ppm;
            let yb = c.y0 - (ty * TILE) as f32 / c.ppm;
            let ya = c.y0 - ((ty + 1) * TILE) as f32 / c.ppm;
            tiles.push(
                bounds
                    .iter()
                    .enumerate()
                    .filter(|(_, (lo, hi))| lo.x <= xb && hi.x >= xa && lo.y <= yb && hi.y >= ya)
                    .map(|(i, _)| i as u16)
                    .collect(),
            );
        }
    }
    let mut out = vec![Hit::default(); c.w * c.h];
    let threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let rows = c.h.div_ceil(threads * 4).max(1);
    let (tiles, bounds) = (&tiles, &bounds);
    std::thread::scope(|s| {
        for (k, chunk) in out.chunks_mut(rows * c.w).enumerate() {
            s.spawn(move || {
                for (n, px) in chunk.iter_mut().enumerate() {
                    let j = k * rows + n / c.w;
                    let i = n % c.w;
                    let ids = &tiles[(j / TILE) * tw + i / TILE];
                    if !ids.is_empty() {
                        *px = march(prims, ids, bounds, c, i, j);
                    }
                }
            });
        }
    });
    out
}

fn march(prims: &[Prim], ids: &[u16], bounds: &[(V3, V3)], c: &Canvas, i: usize, j: usize) -> Hit {
    let (x, y) = c.world(i, j);
    let mut top = f32::NEG_INFINITY;
    let mut bottom = f32::INFINITY;
    for &id in ids {
        let (lo, hi) = bounds[id as usize];
        if x >= lo.x && x <= hi.x && y >= lo.y && y <= hi.y {
            top = top.max(hi.z);
            bottom = bottom.min(lo.z);
        }
    }
    if top < bottom {
        return Hit::default();
    }
    let eps = 0.2 / c.ppm;
    let mut z = top;
    for _ in 0..600 {
        let p = v3(x, y, z);
        let (d, near, dn) = field(prims, ids, p);
        if d < eps {
            let h = 0.5 / c.ppm;
            let g = |q: V3| field(prims, ids, q).0;
            let n = v3(
                g(p + v3(h, 0.0, 0.0)) - g(p - v3(h, 0.0, 0.0)),
                g(p + v3(0.0, h, 0.0)) - g(p - v3(0.0, h, 0.0)),
                g(p + v3(0.0, 0.0, h)) - g(p - v3(0.0, 0.0, h)),
            )
            .norm();
            return Hit {
                hit: true,
                z,
                near: near as u16,
                fill: dn - d,
                mat: prims[near].mat_at(p),
                n,
            };
        }
        z -= (d * 0.8).max(eps * 0.5);
        if z < bottom {
            break;
        }
    }
    Hit::default()
}

/// Whether two groups that melt together crease: never, only on the side
/// turned from the light (under a muscle, not over it), or always.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Crease {
    None,
    Shadow,
    Always,
}

/// Line widths (radii in pixels of the traced picture) and when lines appear.
#[derive(Clone, Copy, Debug)]
pub struct Style {
    pub outline: f32,
    pub contour: f32,
    pub crease: f32,
    pub seam: f32,
    /// A step in depth this large (m) is one part in front of another.
    pub jump: f32,
    /// A crease starts to show at this melt depth and is full at the next (m).
    pub fill: (f32, f32),
    /// How the outline swells on the shadow side: 0 even, 1 from 0.5× to 1.5×.
    pub swell: f32,
    pub crease_of: fn(u16, u16) -> Crease,
}

/// The light the lines answer to: from the upper left, in front.
const LIGHT: V3 = v3(-0.55, 0.7, 0.45);

/// Coverage of the figure (its outline included) and its ink, 0 … 1.
pub struct Drawing {
    pub cover: Vec<f32>,
    pub ink: Vec<f32>,
}

fn smoothstep(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn stamp(buf: &mut [f32], w: usize, h: usize, at: (usize, usize), r: f32, a: f32) {
    let reach = r.ceil() as isize + 1;
    let (i, j) = (at.0 as isize, at.1 as isize);
    for dj in -reach..=reach {
        let y = j + dj;
        if y < 0 || y >= h as isize {
            continue;
        }
        for di in -reach..=reach {
            let x = i + di;
            if x < 0 || x >= w as isize {
                continue;
            }
            let d = ((di * di + dj * dj) as f32).sqrt();
            let c = (r + 0.5 - d).clamp(0.0, 1.0) * a;
            let px = &mut buf[y as usize * w + x as usize];
            if c > *px {
                *px = c;
            }
        }
    }
}

pub fn ink(hits: &[Hit], prims: &[Prim], c: &Canvas, s: &Style) -> Drawing {
    let (w, h) = (c.w, c.h);
    let mut ink = vec![0f32; w * h];
    let mut rim = vec![0f32; w * h];
    for j in 0..h {
        for i in 0..w {
            let p = hits[j * w + i];
            if !p.hit {
                continue;
            }
            let mut outline = false;
            let mut contour = false;
            let mut seam = false;
            let mut crease = 0f32;
            for (di, dj) in [(1isize, 0isize), (-1, 0), (0, 1), (0, -1)] {
                let (x, y) = (i as isize + di, j as isize + dj);
                if x < 0 || y < 0 || x >= w as isize || y >= h as isize {
                    outline = true;
                    continue;
                }
                let q = hits[y as usize * w + x as usize];
                if !q.hit {
                    outline = true;
                    continue;
                }
                let dz = p.z - q.z;
                if dz > s.jump {
                    contour = true;
                } else if dz.abs() <= s.jump {
                    if q.mat != p.mat {
                        seam = true;
                    }
                    let (gp, gq) = (prims[p.near as usize].group, prims[q.near as usize].group);
                    let kind = if gp == gq {
                        Crease::None
                    } else {
                        (s.crease_of)(gp, gq)
                    };
                    if kind != Crease::None {
                        let mut c = smoothstep(s.fill.0, s.fill.1, p.fill.max(q.fill));
                        if kind == Crease::Shadow {
                            // Under a form, where it turns down and away.
                            c *= smoothstep(0.15, -0.35, p.n.y);
                        }
                        crease = crease.max(c);
                    }
                }
            }
            let shadow = (0.5 - 0.65 * p.n.dot(LIGHT.norm())).clamp(0.0, 1.0);
            let weight = 1.0 + s.swell * (shadow - 0.5);
            if outline {
                stamp(&mut rim, w, h, (i, j), s.outline * weight, 1.0);
            }
            if contour {
                stamp(&mut ink, w, h, (i, j), s.contour * weight, 1.0);
            }
            if seam {
                stamp(&mut ink, w, h, (i, j), s.seam, 1.0);
            }
            if crease > 0.02 {
                stamp(
                    &mut ink,
                    w,
                    h,
                    (i, j),
                    s.crease * (0.3 + 0.7 * crease),
                    crease.sqrt(),
                );
            }
        }
    }
    let cover = hits
        .iter()
        .zip(&rim)
        .map(|(p, r)| if p.hit { 1.0 } else { *r })
        .collect();
    let ink = ink.iter().zip(&rim).map(|(a, b)| a.max(*b)).collect();
    Drawing { cover, ink }
}

/// Averages `k` × `k` blocks.
pub fn shrink(v: &[f32], w: usize, h: usize, k: usize) -> Vec<f32> {
    let (ow, oh) = (w / k, h / k);
    let mut out = vec![0f32; ow * oh];
    for j in 0..oh {
        for i in 0..ow {
            let mut s = 0.0;
            for dj in 0..k {
                for di in 0..k {
                    s += v[(j * k + dj) * w + i * k + di];
                }
            }
            out[j * ow + i] = s / (k * k) as f32;
        }
    }
    out
}

/// A lit grey picture with the ink over it, to judge the form by eye.
pub fn shade(hits: &[Hit], ink: &[f32]) -> Vec<f32> {
    let light = v3(0.5, 0.6, 0.62).norm();
    hits.iter()
        .zip(ink)
        .map(|(p, k)| {
            let base = if p.hit {
                0.2 + 0.6 * p.n.dot(light).max(0.0)
            } else {
                0.05
            };
            base * (1.0 - k) + k
        })
        .collect()
}
