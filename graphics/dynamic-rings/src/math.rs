//! Small vectors and timing curves for the scene's pure core.
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

pub const Y: V3 = v3(0.0, 1.0, 0.0);

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
    pub fn length(self) -> f32 {
        self.dot(self).sqrt()
    }
    pub fn normalize(self) -> V3 {
        self * (1.0 / self.length())
    }
    pub fn lerp(self, o: V3, t: f32) -> V3 {
        self + (o - self) * t
    }
    pub fn arr(self) -> [f32; 3] {
        [self.x, self.y, self.z]
    }
    pub fn min(self, o: V3) -> V3 {
        v3(self.x.min(o.x), self.y.min(o.y), self.z.min(o.z))
    }
    pub fn max(self, o: V3) -> V3 {
        v3(self.x.max(o.x), self.y.max(o.y), self.z.max(o.z))
    }
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

/// `v` turned by `angle` about the unit `axis`, right-handed.
pub fn rotate(v: V3, axis: V3, angle: f32) -> V3 {
    let (s, c) = angle.sin_cos();
    v * c + axis.cross(v) * s + axis * (axis.dot(v) * (1.0 - c))
}

pub fn mix(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

pub fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
pub fn window(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

/// A reach with no jerk at either end: the swing of a foot.
pub fn min_jerk(s: f32) -> f32 {
    let s = s.clamp(0.0, 1.0);
    s * s * s * (10.0 + s * (6.0 * s - 15.0))
}

/// The lower of `a` and `b`, rounded over `k`; never above either.
pub fn softmin(a: f32, b: f32, k: f32) -> f32 {
    let h = (k - (a - b).abs()).max(0.0) / k;
    a.min(b) - h * h * k * 0.25
}

/// A flash: up in a few hundredths of a second, gone in about a second.
pub fn pulse(since: f32) -> f32 {
    if since < 0.0 {
        0.0
    } else {
        (1.0 - (-since / 0.03).exp()) * (-since / 0.45).exp()
    }
}

/// A smooth closed curve through `keys` (time, value) around a loop of
/// `period` seconds: Catmull–Rom tangents, cubic Hermite pieces.
pub fn spline(keys: &[(f32, f32)], t: f32, period: f32) -> f32 {
    let n = keys.len() as isize;
    let mut t = t.rem_euclid(period);
    let i = keys
        .iter()
        .rposition(|k| k.0 <= t)
        .map_or(n - 1, |i| i as isize);
    let key = |j: isize| {
        let (at, value) = keys[j.rem_euclid(n) as usize];
        (at + period * j.div_euclid(n) as f32, value)
    };
    let [(t0, v0), (t1, v1), (t2, v2), (t3, v3)] = [i - 1, i, i + 1, i + 2].map(key);
    if t < t1 {
        t += period;
    }
    let (m1, m2) = ((v2 - v0) / (t2 - t0), (v3 - v1) / (t3 - t1));
    hermite(t1, v1, m1, t2, v2, m2, t)
}

/// The cubic from (`t1`, `v1`) leaving at slope `m1` to (`t2`, `v2`)
/// arriving at slope `m2`.
pub fn hermite(t1: f32, v1: f32, m1: f32, t2: f32, v2: f32, m2: f32, t: f32) -> f32 {
    let h = t2 - t1;
    let s = (t - t1) / h;
    let (s2, s3) = (s * s, s * s * s);
    (2.0 * s3 - 3.0 * s2 + 1.0) * v1
        + (s3 - 2.0 * s2 + s) * h * m1
        + (3.0 * s2 - 2.0 * s3) * v2
        + (s3 - s2) * h * m2
}

/// A curve through `keys` (time, value, times increasing) that never
/// overshoots: it rests at either end and stays flat where the values
/// turn (harmonic-mean tangents).
pub fn monotone(keys: &[(f32, f32)], t: f32) -> f32 {
    let n = keys.len();
    if n == 1 || t <= keys[0].0 {
        return keys[0].1;
    }
    if t >= keys[n - 1].0 {
        return keys[n - 1].1;
    }
    let i = keys.partition_point(|k| k.0 <= t) - 1;
    let slope = |j: usize| (keys[j + 1].1 - keys[j].1) / (keys[j + 1].0 - keys[j].0);
    let tangent = |j: usize| {
        if j == 0 || j == n - 1 {
            return 0.0;
        }
        let (a, b) = (slope(j - 1), slope(j));
        if a * b <= 0.0 {
            0.0
        } else {
            2.0 * a * b / (a + b)
        }
    };
    let (t1, v1) = keys[i];
    let (t2, v2) = keys[i + 1];
    hermite(t1, v1, tangent(i), t2, v2, tangent(i + 1), t)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_turn_keeps_length_and_handedness() {
        let x = v3(1.0, 0.0, 0.0);
        let z = v3(0.0, 0.0, 1.0);
        // About the figure's left (+x), up tips forward (+z).
        let tipped = rotate(Y, x, 0.3);
        assert!((tipped.length() - 1.0).abs() < 1e-6);
        assert!(tipped.z > 0.29);
        // About up, forward turns toward the figure's left.
        assert!(rotate(z, Y, 0.3).x > 0.29);
    }

    #[test]
    fn the_monotone_curve_never_overshoots() {
        let keys = [(0.0, 0.0), (1.0, 1.0), (1.5, 1.1), (3.0, 3.0), (4.0, 3.0)];
        let mut previous = monotone(&keys, 0.0);
        for i in 1..=400 {
            let v = monotone(&keys, i as f32 / 100.0);
            assert!(v >= previous - 1e-6, "{i}");
            assert!((-1e-5..=3.0 + 1e-5).contains(&v), "{v}");
            previous = v;
        }
        for &(at, value) in &keys {
            assert!((monotone(&keys, at) - value).abs() < 1e-5);
        }
    }

    #[test]
    fn the_soft_minimum_stays_below_both() {
        for i in 0..50 {
            let a = i as f32 / 25.0;
            assert!(softmin(a, 1.0, 0.3) <= a.min(1.0));
        }
        assert_eq!(softmin(0.0, 2.0, 0.3), 0.0);
    }
}
