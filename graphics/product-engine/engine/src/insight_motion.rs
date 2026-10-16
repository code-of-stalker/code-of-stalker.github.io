//! Exact continuous sphere equations from Laboratory matrixMotion.ts. Rotation
//! and reveal have independent clocks; no recorded-frame loop can reset a ring.
use std::f64::consts::{PI, TAU};
fn smooth(a: f64, b: f64, t: f64) -> f64 {
    let p = ((t - a) / (b - a)).clamp(0., 1.);
    p * p * (3. - 2. * p)
}
pub fn arc(cx: f64, cy: f64, r: f64, from: f64, to: f64) -> String {
    format!(
        "M{} {}A{r} {r} 0 {} {} {} {}",
        cx + from.cos() * r,
        cy + from.sin() * r,
        usize::from((to - from).abs() > PI),
        usize::from(to >= from),
        cx + to.cos() * r,
        cy + to.sin() * r
    )
}
pub struct Ring {
    pub path: String,
    pub light: [f64; 4],
    pub opacity: [f64; 5],
}
pub struct Frame {
    pub rings: [Ring; 2],
    pub rim: [f64; 4],
    pub fill: [f64; 2],
    pub orbit: String,
    pub orbit_light: [f64; 4],
    pub reveal: f64,
    pub ornament: f64,
    pub connection: f64,
    pub contour: f64,
    pub filled: f64,
    pub fusion: f64,
    pub pixels: [[f64; 64]; 2],
    pub emission: f64,
}
pub fn frame(seconds: f64, reduced: bool) -> Frame {
    let t = if reduced { 5. } else { seconds };
    let angle = t / 32. * TAU + 0.32;
    let pitch = 0.27f64;
    let cp = pitch.cos();
    let sp = pitch.sin();
    let height = 0.76 * (angle * 2.).sin();
    let radius = (1. - height * height).sqrt();
    let yaw = angle + 0.52;
    let cx = 200.;
    let cy = 47.;
    let r = 28.;
    let rings = std::array::from_fn(|index| {
        let project = |theta: f64| {
            let u = theta.cos();
            let v = theta.sin();
            let [x, y, z] = if index == 0 {
                [v * yaw.sin(), u, v * yaw.cos()]
            } else {
                [u * radius, height, v * radius]
            };
            [
                cx + x * r * 0.97,
                cy + (y * cp - z * sp) * r * 0.97,
                y * sp + z * cp,
            ]
        };
        let mut path = String::new();
        for i in 0..128 {
            let p = project(i as f64 * TAU / 128.);
            path.push_str(&format!(
                "{}{:0.3} {:0.3}",
                if i == 0 { "M" } else { "L" },
                p[0],
                p[1]
            ));
        }
        path.push('Z');
        let du = if index == 0 { sp } else { 0. };
        let dv = if index == 0 {
            yaw.cos() * cp
        } else {
            radius * cp
        };
        let near = dv.atan2(du);
        let a = project(near);
        let b = project(near + PI);
        let span = (a[0] - b[0]).hypot(a[1] - b[1]);
        let half = (span / 2.).max(r * 0.12);
        let [ux, uy] = if span > 0.00001 {
            [(a[0] - b[0]) / span, (a[1] - b[1]) / span]
        } else {
            [0., 1.]
        };
        let mx = (a[0] + b[0]) / 2.;
        let my = (a[1] + b[1]) / 2.;
        let contrast = smooth(0., 1., span / (r * 0.35)) * smooth(0., 1., du.hypot(dv) / 0.4);
        Ring {
            path,
            light: [
                mx - ux * half,
                my - uy * half,
                mx + ux * half,
                my + uy * half,
            ],
            opacity: [0.23, 0.31, 0.53, 0.82, 1.].map(|v| 0.65 + (v - 0.65) * contrast),
        }
    });
    let direction = angle * 2. - PI * 0.65;
    let dx = direction.cos() * r;
    let dy = direction.sin() * r;
    let start = direction - 0.74;
    let end = direction + 0.12;
    let phase = t.rem_euclid(12.8);
    let reveal = if reduced {
        1.
    } else {
        1. - smooth(10.3, 12.6, phase)
    };
    let pixels = std::array::from_fn(|side| {
        std::array::from_fn(|i| {
            let row = i / 8;
            let column = i % 8;
            let depth = if side == 0 { 7 - column } else { column };
            let stagger = ((row + depth) % 2) as f64 * 0.035;
            let start = 2.65 + depth as f64 * 0.12 + (row as f64 - 3.5).abs() * 0.075 + stagger;
            if reduced {
                1.
            } else {
                smooth(start, start + 0.3, phase)
            }
        })
    });
    let charge = if !reduced && phase < 2. {
        (PI * phase / 2.).sin()
    } else {
        0.
    };
    Frame {
        rings,
        rim: [cx - dx, cy - dy, cx + dx, cy + dy],
        fill: [50. + direction.cos() * 24., 50. + direction.sin() * 24.],
        orbit: arc(cx, cy, r, start, end),
        orbit_light: [
            cx + start.cos() * r,
            cy + start.sin() * r,
            cx + end.cos() * r,
            cy + end.sin() * r,
        ],
        reveal,
        ornament: if reduced { 1. } else { smooth(2.4, 3.9, phase) },
        connection: if reduced {
            1.
        } else {
            smooth(0.3, 1.15, phase)
        },
        contour: if reduced {
            1.
        } else {
            smooth(1.05, 2.7, phase)
        },
        filled: if reduced {
            1.
        } else {
            smooth(2.65, 4.3, phase)
        },
        fusion: if reduced {
            1.
        } else {
            smooth(4.05, 4.85, phase)
        },
        pixels,
        emission: 1.05 * (1. + 0.12 * charge),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn independent_rotation_has_no_capture_boundary() {
        let a = frame(13.2 - 1. / 9000., false);
        let b = frame(13.2 + 1. / 9000., false);
        for (a, b) in a.rim.into_iter().zip(b.rim) {
            assert!((a - b).abs() < 0.01);
        }
        crate::vector_geometry::path(&b.orbit).unwrap();
    }
    #[test]
    fn pixel_reveal_and_reduced_motion_match_source() {
        let a = frame(0., false);
        assert!(a.pixels.iter().flatten().all(|v| *v == 0.));
        let b = frame(5., false);
        assert!(b.pixels.iter().flatten().all(|v| *v == 1.));
        let c = frame(800., true);
        assert_eq!(c.reveal, 1.);
        assert_eq!(c.contour, 1.);
    }
}
