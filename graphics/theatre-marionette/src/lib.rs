//! Deterministic choreography for the theatre illustration.
//!
//! Positions use the authored 1536 × 1024 canvas, before display scaling. Both
//! the textured mesh and its suspension strings consume the same deformation.
//! The platform adapter owns scheduling; this module owns every motion value.

use std::f32::consts::TAU;

pub mod atmosphere;

pub const MOTION_SECONDS: f64 = 12.0;
/// Rain is half speed; two unchanged body cycles make one seamless scene loop.
pub const LOOP_SECONDS: f64 = 24.0;
pub const MAX_STRENGTH: f32 = 1.5;
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
pub const PARTICLE_COUNT: usize = 40;

const LEFT_SHOULDER: [f32; 2] = [711.0, 296.0];
const LEFT_ELBOW: [f32; 2] = [584.0, 302.0];
const LEFT_WRIST: [f32; 2] = [516.0, 212.0];
const RIGHT_SHOULDER: [f32; 2] = [824.0, 300.0];
const RIGHT_ELBOW: [f32; 2] = [924.0, 411.0];
const RIGHT_WRIST: [f32; 2] = [1030.0, 396.0];
const BAR_CENTER: [f32; 2] = [760.0, 55.0];

/// Angles are radians, `sway`/`bar_y` are pixels, `breath` is fractional
/// chest expansion, and `light` is a multiplier around one.
#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub phase: f32,
    pub rain_phase: f32,
    pub strength: f32,
    pub left_arm: f32,
    pub left_forearm: f32,
    pub right_arm: f32,
    pub right_forearm: f32,
    pub sway: f32,
    pub breath: f32,
    pub head: f32,
    pub bar_angle: f32,
    pub bar_y: f32,
    pub light: f32,
}

/// Sample a closed choreography. Integer harmonics preserve position and
/// velocity at the loop seam, without resetting a scene or accumulating drift.
pub fn compose(seconds: f64, strength: f32) -> Frame {
    let seconds = if seconds.is_finite() { seconds } else { 0.0 };
    let strength = if strength.is_finite() {
        strength.clamp(0.0, MAX_STRENGTH)
    } else {
        1.0
    };
    let phase = (seconds.rem_euclid(MOTION_SECONDS) / MOTION_SECONDS) as f32 * TAU;
    Frame {
        phase,
        rain_phase: (seconds.rem_euclid(LOOP_SECONDS) / LOOP_SECONDS) as f32 * TAU,
        strength,
        left_arm: (phase.sin() * 0.027 + (phase * 2.0).sin() * 0.006) * strength,
        left_forearm: (phase + 0.4).sin() * 0.046 * strength,
        right_arm: ((phase + 0.9).sin() * 0.031 + (phase * 2.0 - 0.1).sin() * 0.005) * strength,
        right_forearm: (phase * 2.0 - 0.5).sin() * 0.042 * strength,
        sway: phase.sin() * 4.3 * strength,
        breath: (phase * 2.0 - 0.3).sin() * 0.009 * strength,
        head: (phase - 0.4).sin() * 0.012 * strength,
        bar_angle: (phase + 0.7).sin() * 0.014 * strength,
        bar_y: (phase * 2.0 - 0.2).sin() * 1.5 * strength,
        light: 1.0 + (phase - 0.6).sin() * 0.045 * strength,
    }
}

fn smoothstep(start: f32, end: f32, value: f32) -> f32 {
    let t = ((value - start) / (end - start)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn rotate(point: [f32; 2], pivot: [f32; 2], angle: f32) -> [f32; 2] {
    let (s, c) = angle.sin_cos();
    let x = point[0] - pivot[0];
    let y = point[1] - pivot[1];
    [pivot[0] + c * x - s * y, pivot[1] + s * x + c * y]
}

fn finite_point(point: [f32; 2]) -> [f32; 2] {
    point.map(|v| if v.is_finite() { v } else { 0.0 })
}

/// Forward deformation of an authored point, shared by mesh and strings.
/// Soft joint influence fields keep neighbouring mesh vertices connected;
/// the legs retain their length and both grounded boots stay fixed.
pub fn deform(point: [f32; 2], frame: &Frame) -> [f32; 2] {
    let source = finite_point(point);
    if source[1] >= 930.0 || frame.strength == 0.0 {
        return source;
    }
    let [x, y] = source;
    let mut p = source;

    // Forearms move before their upper arms, like a small continuous rig.
    // Weights are evaluated in authored coordinates, not already bent space.
    let left_arm = (1.0 - smoothstep(620.0, 721.0, x)) * (1.0 - smoothstep(359.0, 399.0, y));
    let left_forearm = (1.0 - smoothstep(557.0, 620.0, x)) * (1.0 - smoothstep(322.0, 365.0, y));
    p = rotate(p, LEFT_ELBOW, frame.left_forearm * left_forearm);
    p = rotate(p, LEFT_SHOULDER, frame.left_arm * left_arm);

    let right_arm = smoothstep(819.0, 876.0, x) * (1.0 - smoothstep(466.0, 510.0, y));
    let right_forearm = smoothstep(898.0, 951.0, x) * (1.0 - smoothstep(466.0, 510.0, y));
    p = rotate(p, RIGHT_ELBOW, frame.right_forearm * right_forearm);
    p = rotate(p, RIGHT_SHOULDER, frame.right_arm * right_arm);

    // Only the head turns around the neck; shoulder/collar geometry remains
    // continuous, and the face keeps its original proportions.
    let head = smoothstep(651.0, 698.0, x)
        * (1.0 - smoothstep(836.0, 872.0, x))
        * (1.0 - smoothstep(251.0, 292.0, y));
    p = rotate(p, [762.0, 267.0], frame.head * head);

    let chest_x = (x - 766.0) / 142.0;
    let chest_y = (y - 346.0) / 130.0;
    let chest = (-2.0 * (chest_x * chest_x + chest_y * chest_y)).exp();
    p[0] += (x - 766.0) * frame.breath * chest;
    p[1] -= frame.breath * 100.0 * chest;

    let standing = 1.0 - smoothstep(650.0, 930.0, y);
    p[0] += frame.sway * standing;
    p
}

/// Every point of the control bar follows this single rigid transform.
pub fn control_point(point: [f32; 2], frame: &Frame) -> [f32; 2] {
    let source = finite_point(point);
    if frame.strength == 0.0 {
        return source;
    }
    let mut p = rotate(source, BAR_CENTER, frame.bar_angle);
    p[1] += frame.bar_y;
    p
}

/// Suspension order follows the authored bar. Connections stay attached to
/// the same material points of the heroine, even during resize or seeking.
pub fn strings(frame: &Frame) -> [([f32; 2], [f32; 2]); 6] {
    let connections = [
        ([583.0, 27.0], LEFT_WRIST),
        ([649.0, 44.0], LEFT_SHOULDER),
        ([628.0, 106.0], LEFT_ELBOW),
        ([865.0, 89.0], RIGHT_SHOULDER),
        ([941.0, 82.0], RIGHT_WRIST),
        ([921.0, 8.0], RIGHT_ELBOW),
    ];
    connections.map(|(top, attachment)| (control_point(top, frame), deform(attachment, frame)))
}

/// Quiet suspended dust: [x, y, radius, opacity]. Each mote follows a closed
/// path and fades periodically; no respawn crosses the boundary of the loop.
pub fn particle(index: usize, frame: &Frame) -> [f32; 4] {
    let i = index % PARTICLE_COUNT;
    let seed = i as f32;
    let delay = seed * 2.399_963_1;
    let phase = frame.phase;
    let visibility = (0.5 + 0.5 * (phase * 2.0 + delay).sin()).powi(5);
    [
        205.0 + ((i * 373 + 97) % 1120) as f32 + (phase + delay).sin() * 12.0 * frame.strength,
        122.0 + ((i * 211 + 59) % 780) as f32 + (phase + delay).cos() * 16.0 * frame.strength,
        1.15 + (i % 5) as f32 * 0.38,
        visibility * 0.36 * frame.strength,
    ]
}

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::Marionette;

#[cfg(test)]
mod tests {
    use super::*;

    const PROBES: [[f32; 2]; 7] = [
        LEFT_WRIST,
        LEFT_ELBOW,
        RIGHT_WRIST,
        RIGHT_ELBOW,
        [760.0, 208.0],
        [766.0, 443.0],
        [764.0, 953.0],
    ];

    #[test]
    fn entire_scene_closes_without_a_position_or_velocity_jump() {
        let first = compose(0.0, 1.0);
        let last = compose(LOOP_SECONDS, 1.0);
        assert_eq!(first, last);
        assert_eq!(strings(&first), strings(&last));
        for i in 0..PARTICLE_COUNT {
            assert_eq!(particle(i, &first), particle(i, &last));
        }
        let before = compose(LOOP_SECONDS - 0.01, 1.0);
        let after = compose(0.01, 1.0);
        for point in PROBES {
            let start = deform(point, &first);
            let left = deform(point, &before);
            let right = deform(point, &after);
            for axis in 0..2 {
                assert!((start[axis] - left[axis] - (right[axis] - start[axis])).abs() < 0.001);
            }
        }
        for top in [[583.0, 27.0], [941.0, 82.0]] {
            let start = control_point(top, &first);
            let left = control_point(top, &before);
            let right = control_point(top, &after);
            for axis in 0..2 {
                assert!((start[axis] - left[axis] - (right[axis] - start[axis])).abs() < 0.001);
            }
        }
    }

    #[test]
    fn zero_strength_preserves_art_and_removes_particles() {
        let frame = compose(3.2, 0.0);
        for point in PROBES {
            assert_eq!(deform(point, &frame), point);
            assert_eq!(control_point(point, &frame), point);
        }
        assert_eq!(frame.light, 1.0);
        assert_eq!(particle(0, &frame)[3], 0.0);
    }

    #[test]
    fn feet_stay_grounded_at_every_strength_and_phase() {
        for strength in [0.0, 0.5, 1.0, 1.5] {
            for tick in 0..240 {
                let frame = compose(tick as f64 * 0.05, strength);
                for p in [[730.0, 930.0], [764.0, 953.0], [812.0, 960.0]] {
                    assert_eq!(deform(p, &frame), p);
                }
            }
        }
    }

    #[test]
    fn strings_follow_the_same_deformation_as_the_mesh() {
        let frame = compose(4.4, 1.25);
        let attachments = [
            LEFT_WRIST,
            LEFT_SHOULDER,
            LEFT_ELBOW,
            RIGHT_SHOULDER,
            RIGHT_WRIST,
            RIGHT_ELBOW,
        ];
        for ((top, attached), authored) in strings(&frame).into_iter().zip(attachments) {
            assert_eq!(attached, deform(authored, &frame));
            assert!(top[1] < attached[1]);
        }
    }

    #[test]
    fn inputs_are_sanitized_and_motion_is_bounded() {
        for time in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY, -1e30, 1e30] {
            for strength in [f32::NAN, f32::INFINITY, -4.0, 19.0] {
                let frame = compose(time, strength);
                assert!(frame.phase.is_finite());
                for p in PROBES {
                    let moved = deform(p, &frame);
                    assert!(moved.iter().all(|v| v.is_finite()));
                    assert!((moved[0] - p[0]).abs() < 36.0);
                    assert!((moved[1] - p[1]).abs() < 36.0);
                }
            }
        }
        assert_eq!(compose(-LOOP_SECONDS, 1.0), compose(0.0, 1.0));
    }

    #[test]
    fn breathing_does_not_stretch_legs_or_break_joint_continuity() {
        for tick in 0..120 {
            let frame = compose(tick as f64 * 0.1, 1.5);
            for p in [LEFT_SHOULDER, LEFT_ELBOW, RIGHT_SHOULDER, RIGHT_ELBOW] {
                let a = deform([p[0] - 0.01, p[1]], &frame);
                let b = deform([p[0] + 0.01, p[1]], &frame);
                assert!((a[0] - b[0]).abs() < 0.05);
                assert!((a[1] - b[1]).abs() < 0.05);
            }
            for y in [710.0, 810.0, 900.0] {
                assert!((deform([765.0, y], &frame)[1] - y).abs() < 0.0001);
            }
        }
    }

    #[test]
    fn particles_stay_finite_and_inside_the_authored_canvas() {
        for tick in 0..120 {
            let frame = compose(tick as f64 * 0.1, 1.5);
            for i in 0..PARTICLE_COUNT {
                let p = particle(i, &frame);
                assert!(p.iter().all(|v| v.is_finite()));
                assert!((0.0..SIZE[0]).contains(&p[0]));
                assert!((0.0..SIZE[1]).contains(&p[1]));
                assert!((0.0..=1.0).contains(&p[3]));
            }
        }
    }
}
