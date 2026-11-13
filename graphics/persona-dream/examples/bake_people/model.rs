//! The body as a field of distances: rounded cones and ellipsoids melted
//! into one surface. Metres; y is up.
use std::ops::{Add, Mul, Neg, Sub};

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct V3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

pub const fn v3(x: f32, y: f32, z: f32) -> V3 {
    V3 { x, y, z }
}

impl Add for V3 {
    type Output = V3;
    fn add(self, o: V3) -> V3 {
        v3(self.x + o.x, self.y + o.y, self.z + o.z)
    }
}
impl Sub for V3 {
    type Output = V3;
    fn sub(self, o: V3) -> V3 {
        v3(self.x - o.x, self.y - o.y, self.z - o.z)
    }
}
impl Mul<f32> for V3 {
    type Output = V3;
    fn mul(self, k: f32) -> V3 {
        v3(self.x * k, self.y * k, self.z * k)
    }
}
impl Neg for V3 {
    type Output = V3;
    fn neg(self) -> V3 {
        v3(-self.x, -self.y, -self.z)
    }
}

impl V3 {
    pub fn dot(self, o: V3) -> f32 {
        self.x * o.x + self.y * o.y + self.z * o.z
    }
    pub fn cross(self, o: V3) -> V3 {
        v3(
            self.y * o.z - self.z * o.y,
            self.z * o.x - self.x * o.z,
            self.x * o.y - self.y * o.x,
        )
    }
    pub fn len(self) -> f32 {
        self.dot(self).sqrt()
    }
    pub fn norm(self) -> V3 {
        let l = self.len();
        if l > 0.0 {
            self * (1.0 / l)
        } else {
            self
        }
    }
    pub fn lerp(self, o: V3, t: f32) -> V3 {
        self + (o - self) * t
    }
    /// Turned about the vertical: positive turns +z towards +x.
    pub fn yaw(self, a: f32) -> V3 {
        let (s, c) = a.sin_cos();
        v3(self.x * c + self.z * s, self.y, -self.x * s + self.z * c)
    }
    /// Turned about x: positive tips +y towards +z.
    pub fn pitch(self, a: f32) -> V3 {
        let (s, c) = a.sin_cos();
        v3(self.x, self.y * c - self.z * s, self.y * s + self.z * c)
    }
    /// Turned about z: positive tips +y towards -x.
    pub fn roll(self, a: f32) -> V3 {
        let (s, c) = a.sin_cos();
        v3(self.x * c - self.y * s, self.x * s + self.y * c, self.z)
    }
}

/// A point and three orthonormal axes: x to the body's left, y up, z forward.
#[derive(Clone, Copy, Debug)]
pub struct Frame {
    pub o: V3,
    pub x: V3,
    pub y: V3,
    pub z: V3,
}

impl Frame {
    /// Rolled, then pitched (forward bend), then yawed (turn).
    pub fn new(o: V3, yaw: f32, pitch: f32, roll: f32) -> Frame {
        let t = |v: V3| v.roll(roll).pitch(pitch).yaw(yaw);
        Frame {
            o,
            x: t(v3(1.0, 0.0, 0.0)),
            y: t(v3(0.0, 1.0, 0.0)),
            z: t(v3(0.0, 0.0, 1.0)),
        }
    }
    /// A frame whose y runs along `along` and whose z is as near `front`
    /// as that allows.
    pub fn along(o: V3, along: V3, front: V3) -> Frame {
        let y = along.norm();
        let z = (front - y * front.dot(y)).norm();
        Frame {
            o,
            x: y.cross(z),
            y,
            z,
        }
    }
    /// The same axes pitched about x by `a` (positive tips y towards z),
    /// put at `o`.
    pub fn tilted(&self, o: V3, a: f32) -> Frame {
        let (s, c) = a.sin_cos();
        Frame {
            o,
            x: self.x,
            y: self.y * c + self.z * s,
            z: self.z * c - self.y * s,
        }
    }
    pub fn at(&self, x: f32, y: f32, z: f32) -> V3 {
        self.o + self.dir(x, y, z)
    }
    pub fn dir(&self, x: f32, y: f32, z: f32) -> V3 {
        self.x * x + self.y * y + self.z * z
    }
    fn local(&self, p: V3) -> V3 {
        let d = p - self.o;
        v3(d.dot(self.x), d.dot(self.y), d.dot(self.z))
    }
    fn map(&self, f: impl Fn(V3) -> V3) -> Frame {
        Frame {
            o: f(self.o),
            x: f(self.o + self.x) - f(self.o),
            y: f(self.o + self.y) - f(self.o),
            z: f(self.o + self.z) - f(self.o),
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub enum Shape {
    /// A cone between two balls of radius `ra` at `a` and `rb` at `b`.
    Cone {
        a: V3,
        b: V3,
        ra: f32,
        rb: f32,
    },
    Ellipsoid {
        f: Frame,
        r: V3,
    },
    /// An elliptic frustum standing on the origin of `f` along its y, `h`
    /// high, with radii (x, z) `low` at the bottom and `high` at the top: a
    /// skirt, a fall of hair.
    Frustum {
        f: Frame,
        h: f32,
        low: (f32, f32),
        high: (f32, f32),
    },
}

/// What the surface is: skin, hair, cloth… Lines run where it changes.
pub type Mat = u8;
pub const SKIN: Mat = 0;
pub const HAIR: Mat = 1;
pub const SHIRT: Mat = 4;
pub const TROUSERS: Mat = 5;
pub const SHOE: Mat = 6;
pub const DRESS: Mat = 7;

#[derive(Clone, Copy, Debug)]
pub struct Prim {
    pub shape: Shape,
    /// How softly it melts into the primitives before it (m).
    pub k: f32,
    /// Creases are inked only between different groups.
    pub group: u16,
    pub mat: Mat,
    /// Beyond this plane (a point and a normal) the surface is `split.2`.
    pub split: Option<(V3, V3, Mat)>,
    /// Cut flat by these planes (a point and a normal): nothing beyond them.
    pub clip: [Option<(V3, V3)>; 2],
}

impl Prim {
    pub fn new(shape: Shape, k: f32, group: u16, mat: Mat) -> Prim {
        Prim {
            shape,
            k,
            group,
            mat,
            split: None,
            clip: [None, None],
        }
    }
    pub fn dist(&self, p: V3) -> f32 {
        let d = match self.shape {
            Shape::Cone { a, b, ra, rb } => round_cone(p, a, b, ra, rb),
            Shape::Ellipsoid { f, r } => {
                let q = f.local(p);
                let k0 = v3(q.x / r.x, q.y / r.y, q.z / r.z).len();
                let k1 = v3(q.x / (r.x * r.x), q.y / (r.y * r.y), q.z / (r.z * r.z)).len();
                if k1 > 0.0 {
                    k0 * (k0 - 1.0) / k1
                } else {
                    -r.x.min(r.y).min(r.z)
                }
            }
            Shape::Frustum { f, h, low, high } => {
                let q = f.local(p);
                let t = (q.y / h).clamp(0.0, 1.0);
                let rx = low.0 + (high.0 - low.0) * t;
                let rz = low.1 + (high.1 - low.1) * t;
                let e = ((q.x / rx).powi(2) + (q.z / rz).powi(2)).sqrt();
                // Scaled by the smaller radius it never overshoots.
                let side = (e - 1.0) * rx.min(rz);
                side.max(-q.y).max(q.y - h)
            }
        };
        self.clip
            .iter()
            .flatten()
            .fold(d, |d, (o, n)| d.max((p - *o).dot(*n)))
    }
    pub fn mat_at(&self, p: V3) -> Mat {
        match self.split {
            Some((o, n, m)) if (p - o).dot(n) > 0.0 => m,
            _ => self.mat,
        }
    }
    /// The box it can reach, with its melt.
    pub fn bounds(&self) -> (V3, V3) {
        let (lo, hi) = match self.shape {
            Shape::Cone { a, b, ra, rb } => (
                v3(
                    (a.x - ra).min(b.x - rb),
                    (a.y - ra).min(b.y - rb),
                    (a.z - ra).min(b.z - rb),
                ),
                v3(
                    (a.x + ra).max(b.x + rb),
                    (a.y + ra).max(b.y + rb),
                    (a.z + ra).max(b.z + rb),
                ),
            ),
            Shape::Ellipsoid { f, r } => {
                let m = r.x.max(r.y).max(r.z);
                (f.o - v3(m, m, m), f.o + v3(m, m, m))
            }
            Shape::Frustum { f, h, low, high } => {
                let c = f.o + f.y * (0.5 * h);
                let m = 0.5 * h + low.0.max(low.1).max(high.0).max(high.1);
                (c - v3(m, m, m), c + v3(m, m, m))
            }
        };
        let k = v3(self.k, self.k, self.k);
        (lo - k, hi + k)
    }
    /// The same primitive moved by `f` (a rigid motion).
    pub fn moved(&self, f: impl Fn(V3) -> V3 + Copy) -> Prim {
        let dirf = |n: V3| f(n) - f(v3(0.0, 0.0, 0.0));
        let shape = match self.shape {
            Shape::Cone { a, b, ra, rb } => Shape::Cone {
                a: f(a),
                b: f(b),
                ra,
                rb,
            },
            Shape::Ellipsoid { f: fr, r } => Shape::Ellipsoid { f: fr.map(f), r },
            Shape::Frustum {
                f: fr,
                h,
                low,
                high,
            } => Shape::Frustum {
                f: fr.map(f),
                h,
                low,
                high,
            },
        };
        Prim {
            shape,
            split: self.split.map(|(o, n, m)| (f(o), dirf(n), m)),
            clip: self.clip.map(|c| c.map(|(o, n)| (f(o), dirf(n)))),
            ..*self
        }
    }
}

/// Inigo Quilez's exact rounded cone.
fn round_cone(p: V3, a: V3, b: V3, r1: f32, r2: f32) -> f32 {
    let ba = b - a;
    let l2 = ba.dot(ba);
    let rr = r1 - r2;
    let a2 = l2 - rr * rr;
    let il2 = 1.0 / l2;
    let pa = p - a;
    let y = pa.dot(ba);
    let z = y - l2;
    let x = pa * l2 - ba * y;
    let x2 = x.dot(x);
    let y2 = y * y * l2;
    let z2 = z * z * l2;
    let k = rr.signum() * rr * rr * x2;
    if z.signum() * a2 * z2 > k {
        return (x2 + z2).sqrt() * il2 - r2;
    }
    if y.signum() * a2 * y2 < k {
        return (x2 + y2).sqrt() * il2 - r1;
    }
    ((x2 * a2 * il2).sqrt() + y * rr) * il2 - r1
}

/// Quadratic smooth minimum.
pub fn smin(a: f32, b: f32, k: f32) -> f32 {
    if k <= 0.0 {
        return a.min(b);
    }
    let h = (k - (a - b).abs()).max(0.0) / k;
    a.min(b) - h * h * k * 0.25
}

/// The melted surface at `p` from the primitives `ids` (in order): its
/// distance, the nearest single primitive and that primitive's distance.
pub fn field(prims: &[Prim], ids: &[u16], p: V3) -> (f32, usize, f32) {
    let mut d = f32::INFINITY;
    let mut near = 0;
    let mut dn = f32::INFINITY;
    for &i in ids {
        let pr = &prims[i as usize];
        let di = pr.dist(p);
        if di < dn {
            dn = di;
            near = i as usize;
        }
        d = if d.is_infinite() {
            di
        } else {
            smin(d, di, pr.k)
        };
    }
    // The soles stand flat on the floor.
    (d.max(-p.y), near, dn)
}
