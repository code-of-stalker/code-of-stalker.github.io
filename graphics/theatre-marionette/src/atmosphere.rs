//! Time-owned environment: depth, lighting, code rain and suspended foreground.
//! Shaders only shade these samples; no second clock or choreography lives there.
use crate::{smoothstep, Frame, SIZE};
use std::f32::consts::TAU;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Atmosphere {
    pub camera: [f32; 3],
    /// source x, floor target x, cone width, radiance (normalised canvas units).
    pub beams: [[f32; 4]; 3],
    /// Noise-field translation in artwork pixels, density, floor-light strength.
    pub haze: [f32; 4],
    pub strength: f32,
}

pub fn sample(frame: &Frame) -> Atmosphere {
    let p = frame.phase;
    let a = frame.strength;
    Atmosphere {
        camera: [
            p.sin() * 11.0 * a,
            (p * 2.0).sin() * 2.7 * a,
            1.0 + (0.025 + p.sin() * 0.004) * a,
        ],
        beams: [
            [
                0.53,
                0.49 + (p - 0.6).sin() * 0.085 * a,
                0.21,
                (0.22 + (p + 0.2).sin() * 0.032) * a,
            ],
            [
                0.84,
                0.42 + (p + 0.7).sin() * 0.12 * a,
                0.065,
                (0.19 + (p - 0.7).sin() * 0.04) * a,
            ],
            [
                0.18,
                0.62 + (p - 0.8).sin() * 0.10 * a,
                0.085,
                (0.15 + (p + 1.3).sin() * 0.025) * a,
            ],
        ],
        haze: [
            p.sin() * 94.0 * a,
            (p * 2.0 + 0.4).sin() * 21.0 * a,
            (0.11 + (p - 0.5).sin() * 0.025) * a,
            (0.032 + (p + 0.8).sin() * 0.009) * a,
        ],
        strength: a,
    }
}

/// The side balconies/curtains sit closer than the rear stage. A smooth field
/// moves their texture coordinates by a few pixels, with the contact floor pinned.
/// Overscan is bounded and all UVs stay in the original image, including corners.
pub fn background_uv(point: [f32; 2], scene: &Atmosphere) -> [f32; 2] {
    let [x, y] = point;
    let side = ((x - 768.0) / 768.0).abs().powi(2);
    let floor = smoothstep(660.0, 1024.0, y);
    let depth = 0.22 + side * (1.0 - floor) * 0.78 + floor * 0.5;
    let contact = (-((x - 768.0) / 235.0).powi(2) - ((y - 953.0) / 100.0).powi(2)).exp();
    let zoom = 1.0 + (scene.camera[2] - 1.0) * (1.0 - contact);
    [
        (768.0 + (x - 768.0) / zoom - scene.camera[0] * depth * (1.0 - contact)) / SIZE[0],
        (512.0 + (y - 512.0) / zoom - scene.camera[1] * depth * (1.0 - contact)) / SIZE[1],
    ]
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Plane {
    Far,
    Middle,
    Near,
}
impl Plane {
    pub fn columns(self) -> usize {
        match self {
            Self::Far => 20,
            Self::Middle => 12,
            Self::Near => 6,
        }
    }
    pub fn length(self) -> usize {
        match self {
            Self::Far => 16,
            Self::Middle => 14,
            Self::Near => 10,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Glyph {
    pub position: [f32; 2],
    pub size: [f32; 2],
    pub strokes: u16,
    pub alpha: f32,
    pub softness: f32,
}

// Declarative vector stroke selection: digital numerals and angular code marks.
// Stroke geometry is fixed, independent of frame rate and display resolution.
const GLYPHS: [u16; 20] = [
    0x007d, 0x0060, 0x0057, 0x0067, 0x006a, 0x002f, 0x003f, 0x0061, 0x007f, 0x006f, 0x1083, 0x0281,
    0x0421, 0x0c02, 0x1082, 0x0901, 0x1202, 0x0481, 0x0883, 0x00b5,
];

/// Every stream travels outside the frame before wrapping. The complete trail
/// is invisible at its wrap. Rain takes 24 seconds; the other motion stays at 12.
pub fn glyph(plane: Plane, column: usize, row: usize, frame: &Frame, scene: &Atmosphere) -> Glyph {
    let column = column % plane.columns();
    let row = row % plane.length();
    let seed = column * 37
        + match plane {
            Plane::Far => 7,
            Plane::Middle => 29,
            Plane::Near => 53,
        };
    let (width, height, gap, cycles, opacity, depth, softness) = match plane {
        Plane::Far => (6.5, 13.0, 19.0, 1.0, 0.30, 0.23, 0.018),
        Plane::Middle => (10.5, 20.0, 28.0, 1.0, 0.52, 0.6, 0.014),
        Plane::Near => (17.0, 32.0, 44.0, 2.0, 0.36, 1.5, 0.075),
    };
    let offset = ((seed * 113) % 997) as f32 / 997.0;
    let travel = SIZE[1] + plane.length() as f32 * gap + 220.0;
    let head = -110.0 + (frame.rain_phase / TAU * cycles + offset).fract() * travel;
    let y = head - row as f32 * gap;
    let x = match plane {
        Plane::Far => 290.0 + column as f32 * 50.0 + ((seed * 31) % 29) as f32,
        Plane::Middle => 235.0 + column as f32 * 94.0 + ((seed * 17) % 37) as f32,
        Plane::Near => [102.0, 233.0, 373.0, 1160.0, 1324.0, 1451.0][column],
    } + scene.camera[0] * depth;
    let edge = smoothstep(-25.0, 40.0, y) * (1.0 - smoothstep(805.0, 958.0, y));
    let trail = (1.0 - row as f32 / plane.length() as f32).powf(1.35);
    let headlight = if row == 0 { 1.65 } else { 1.0 };
    let shimmer = 0.85 + 0.15 * (frame.phase * 2.0 + seed as f32).sin();
    Glyph {
        position: [x, y],
        size: [width, height],
        strokes: GLYPHS[(seed + row * 7) % GLYPHS.len()],
        alpha: (opacity * trail * headlight * edge * shimmer * frame.strength).min(0.9),
        softness,
    }
}

/// Larger, softly defocused dust passes only around the edges of the subject.
pub fn near_particle(index: usize, frame: &Frame) -> [f32; 4] {
    let i = index % 18;
    let p = frame.phase;
    let seed = i as f32 * 2.399_963;
    let x = if i.is_multiple_of(2) {
        105.0 + (i * 41 % 330) as f32
    } else {
        1120.0 + (i * 47 % 300) as f32
    };
    [
        x + (p + seed).sin() * 33.0 * frame.strength,
        200.0 + (i * 137 % 720) as f32 + (p + seed).cos() * 48.0 * frame.strength,
        24.0 + (i % 4) as f32 * 12.0,
        (0.5 + 0.5 * (p * 2.0 + seed).sin()).powi(3) * 0.17 * frame.strength,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{compose, LOOP_SECONDS};

    #[test]
    fn atmosphere_and_all_layers_close_exactly() {
        let a = compose(0.0, 1.0);
        let b = compose(LOOP_SECONDS, 1.0);
        assert_eq!(sample(&a), sample(&b));
        for plane in [Plane::Far, Plane::Middle, Plane::Near] {
            for col in 0..plane.columns() {
                for row in 0..plane.length() {
                    assert_eq!(
                        glyph(plane, col, row, &a, &sample(&a)),
                        glyph(plane, col, row, &b, &sample(&b))
                    );
                }
            }
        }
        for i in 0..18 {
            assert_eq!(near_particle(i, &a), near_particle(i, &b));
        }
    }

    #[test]
    fn parallax_never_samples_outside_the_painting_or_moves_contact_point() {
        for tick in 0..240 {
            let scene = sample(&compose(tick as f64 * 0.05, 1.5));
            for x in 0..=32 {
                for y in 0..=20 {
                    let uv = background_uv([x as f32 * 48.0, y as f32 * 51.2], &scene);
                    assert!(uv.iter().all(|v| v.is_finite() && (0.0..=1.0).contains(v)));
                }
            }
            assert_eq!(background_uv([768.0, 953.0], &scene), [0.5, 953.0 / 1024.0]);
        }
    }

    #[test]
    fn no_visible_jump_when_rain_wraps() {
        for plane in [Plane::Far, Plane::Middle, Plane::Near] {
            for col in 0..plane.columns() {
                for row in 0..plane.length() {
                    let mut previous = glyph(
                        plane,
                        col,
                        row,
                        &compose(0.0, 1.0),
                        &sample(&compose(0.0, 1.0)),
                    );
                    for tick in 1..=(LOOP_SECONDS * 60.0) as usize {
                        let f = compose(tick as f64 / 60.0, 1.0);
                        let next = glyph(plane, col, row, &f, &sample(&f));
                        assert!(next.alpha.is_finite() && (0.0..=1.0).contains(&next.alpha));
                        if (next.position[1] - previous.position[1]).abs() > 100.0 {
                            assert_eq!(previous.alpha, 0.0);
                            assert_eq!(next.alpha, 0.0);
                        }
                        previous = next;
                    }
                }
            }
        }
    }

    #[test]
    fn zero_strength_has_no_camera_or_light_motion() {
        let f = compose(4.0, 0.0);
        let a = sample(&f);
        assert_eq!(
            background_uv([300.0, 500.0], &a),
            [300.0 / 1536.0, 500.0 / 1024.0]
        );
        assert!(a.beams.iter().all(|b| b[3] == 0.0));
        assert_eq!(a.haze[2], 0.0);
        assert_eq!(glyph(Plane::Near, 0, 0, &f, &a).alpha, 0.0);
        assert_eq!(near_particle(0, &f)[3], 0.0);
    }

    #[test]
    fn rain_is_half_speed_without_slowing_the_performer_or_lights() {
        let at = 2.0;
        let a = compose(at, 1.5);
        let b = compose(at + 0.01, 1.5);
        for plane in [Plane::Far, Plane::Middle, Plane::Near] {
            let current = glyph(plane, 0, 0, &a, &sample(&a));
            let next = glyph(plane, 0, 0, &b, &sample(&b));
            let (gap, cycles) = match plane {
                Plane::Far => (19.0, 1.0),
                Plane::Middle => (28.0, 1.0),
                Plane::Near => (44.0, 2.0),
            };
            let old_speed = (SIZE[1] + plane.length() as f32 * gap + 220.0) * cycles
                / crate::MOTION_SECONDS as f32;
            assert!(
                ((next.position[1] - current.position[1]) / 0.01 - old_speed * 0.5).abs() < 0.03
            );
        }
        let repeated = compose(at + crate::MOTION_SECONDS, 1.5);
        assert_eq!(sample(&a), sample(&repeated));
        assert_eq!(crate::strings(&a), crate::strings(&repeated));
        assert_ne!(a.rain_phase, repeated.rain_phase);
    }
}
