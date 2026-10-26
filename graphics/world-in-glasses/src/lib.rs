//! "The world in her glasses": a 14-second loop for Step 4, page 01/15.
//!
//! She stands in the ruins, chewing gum; the camera moves in, the dream world
//! lives in her lenses, a bubble grows and pops, and the lenses crack to show
//! the ruins, then heal while the camera pulls back. Positions use the authored
//! 1536 × 1024 canvas of Art's frames. This module owns every motion value;
//! the browser adapter only uploads immutable layers and draws.
#![forbid(unsafe_code)]

pub mod geometry;
pub mod glass;
pub mod lens;
pub mod scene;

#[cfg(target_arch = "wasm32")]
mod browser;

use std::f32::consts::{PI, TAU};

pub const LOOP_SECONDS: f64 = 14.0;
const LOOP: f32 = LOOP_SECONDS as f32;
/// The bubble pops and the lenses crack at the same instant.
pub const POP: f32 = 9.2;
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// Pursed lips in frame D, where the bubble grows from.
pub const LIPS: [f32; 2] = [794.0, 226.0];
/// Mouth drawings are 210 × 160 patches placed here over the figure.
pub const MOUTH: [f32; 2] = [680.0, 180.0];
pub const MOUTH_SIZE: [f32; 2] = [210.0, 160.0];
pub const MOUTH_COLUMNS: usize = 7;
pub const MOUTH_ROWS: usize = 4;
pub const WORLD_SIZE: [f32; 2] = [1774.0, 887.0];
/// Full chews per loop: a whole number keeps the seam invisible.
const CHEWS: f32 = 18.0;
pub const CHEW_FRAMES: usize = 18;
const PURSE_FIRST: usize = 18;
const POPPED: usize = 23;

pub fn clamp01(v: f32) -> f32 {
    v.clamp(0.0, 1.0)
}
pub fn lerp(a: f32, b: f32, k: f32) -> f32 {
    a + (b - a) * k
}
pub fn smoothstep(a: f32, b: f32, x: f32) -> f32 {
    let k = clamp01((x - a) / (b - a));
    k * k * (3.0 - 2.0 * k)
}
pub fn ease_in_out(k: f32) -> f32 {
    if k < 0.5 {
        4.0 * k * k * k
    } else {
        1.0 - (-2.0 * k + 2.0).powi(3) / 2.0
    }
}
pub fn ease_out(k: f32) -> f32 {
    1.0 - (1.0 - k).powi(3)
}
pub fn fract(x: f32) -> f32 {
    x - x.floor()
}
/// The prototype's sine hash, evaluated in double precision like JavaScript.
pub fn hash(n: f64) -> f32 {
    let v = ((n * 127.1 + 311.7).sin() * 43758.5453) as f32;
    fract(v)
}
fn noise(x: f32) -> f32 {
    let i = x.floor();
    let f = x - i;
    let u = f * f * (3.0 - 2.0 * f);
    lerp(hash(i as f64), hash(i as f64 + 1.0), u) * 2.0 - 1.0
}

/// Seconds inside the loop; non-finite input starts the loop.
pub fn loop_time(seconds: f64) -> f32 {
    if seconds.is_finite() {
        seconds.rem_euclid(LOOP_SECONDS) as f32
    } else {
        0.0
    }
}

/// Two depths: the figure (`zoom`, `center`) and the deeper ruins behind her.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Camera {
    pub zoom: f32,
    pub center: [f32; 2],
    pub back_zoom: f32,
    pub back_center: [f32; 2],
}

/// Wide → push into the face → close-up → pull back → wide.
pub fn camera(t: f32) -> Camera {
    let (fx, fy, zf) = (783.0, 205.0, 2.65);
    let (mut z, mut cx, mut cy) = (1.02, 768.0, 512.0);
    if t < 3.0 {
        z = lerp(1.02, 1.06, t / 3.0);
    } else if t < 6.4 {
        let k = ease_in_out((t - 3.0) / 3.4);
        z = lerp(1.06, zf, k);
        cx = lerp(768.0, fx, k);
        cy = lerp(512.0, fy, k);
    } else if t < 11.3 {
        let k = (t - 6.4) / 4.9;
        z = zf + 0.22 * (k * PI / 2.0).sin();
        cx = fx;
        cy = fy + 6.0 * k;
    } else if t < 13.2 {
        let k = ease_in_out((t - 11.3) / 1.9);
        z = lerp(zf + 0.22, 1.02, k);
        cx = lerp(fx, 768.0, k);
        cy = lerp(fy + 6.0, 512.0, k);
    }
    // A gentle sideways drift in the wide shot.
    let wide = clamp01(1.0 - smoothstep(3.0, 5.5, t) + smoothstep(11.8, 13.2, t));
    cx += 14.0 * (t * TAU / LOOP).sin() * wide;
    // The pop shakes the camera for a moment.
    let since = t - POP;
    let shake = if since > 0.0 && since < 0.7 {
        (-since * 6.0).exp()
    } else {
        0.0
    };
    cx += shake * 7.0 * noise(t * 40.0);
    cy += shake * 7.0 * noise(t * 40.0 + 50.0);
    let hw = SIZE[0] / 2.0 / z;
    let hh = SIZE[1] / 2.0 / z;
    let cx = cx.clamp(hw, SIZE[0] - hw);
    let cy = cy.clamp(hh, SIZE[1] - hh);
    // The ruins sit deeper: they zoom and pan less than the figure.
    let bz = 1.02 + (z - 1.02) * 0.8;
    let bhw = SIZE[0] / 2.0 / bz;
    let bhh = SIZE[1] / 2.0 / bz;
    Camera {
        zoom: z,
        center: [cx, cy],
        back_zoom: bz,
        back_center: [
            (768.0 + (cx - 768.0) * 0.82).clamp(bhw, SIZE[0] - bhw),
            (512.0 + (cy - 512.0) * 0.82).clamp(bhh, SIZE[1] - bhh),
        ],
    }
}

/// Authored → clip space for a layer seen at `zoom` around `center`.
pub fn view(zoom: f32, center: [f32; 2]) -> [f32; 4] {
    let sx = zoom / (SIZE[0] / 2.0);
    let sy = -zoom / (SIZE[1] / 2.0);
    [sx, sy, -center[0] * sx, -center[1] * sy]
}

/// One drawing of the mouth atlas over the figure, with its opacity.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MouthLayer {
    pub patch: usize,
    pub alpha: f32,
}

fn chew_amount(t: f32) -> f32 {
    (1.0 - smoothstep(5.9, 6.05, t)) + smoothstep(11.75, 12.0, t)
}

/// Chewing (18 in-between drawings), lips gathering into an O, the popped
/// film, and the gum pulled back in. Later layers are drawn over earlier ones.
pub fn mouth_layers(t: f32) -> Vec<MouthLayer> {
    let mut layers = Vec::with_capacity(6);
    let amount = chew_amount(t);
    if amount > 0.0 {
        let f = fract(t * CHEWS / LOOP) * CHEW_FRAMES as f32;
        let i0 = (f.floor() as usize) % CHEW_FRAMES;
        layers.push(MouthLayer {
            patch: i0,
            alpha: amount,
        });
        layers.push(MouthLayer {
            patch: (i0 + 1) % CHEW_FRAMES,
            alpha: amount * fract(f),
        });
    }
    if (6.0..POP + 0.1).contains(&t) {
        let f = clamp01((t - 6.0) / 0.45) * 5.0;
        let i = (f.floor() as usize).min(5);
        let k = f - i as f32;
        let key = |n: usize| if n == 0 { 0 } else { PURSE_FIRST + n - 1 };
        let out = 1.0 - smoothstep(POP + 0.05, POP + 0.09, t);
        layers.push(MouthLayer {
            patch: key(i),
            alpha: out,
        });
        if i < 5 {
            layers.push(MouthLayer {
                patch: key(i + 1),
                alpha: k * out,
            });
        }
    }
    let pop = smoothstep(POP, POP + 0.06, t);
    if pop > 0.0 && t < 12.1 {
        let r = clamp01((t - 11.2) / 0.6) * 4.0;
        let i = r.floor() as usize;
        let k = r - i as f32;
        let out = 1.0 - smoothstep(11.8, 12.1, t);
        layers.push(MouthLayer {
            patch: POPPED + i.min(4),
            alpha: pop * out,
        });
        if i < 4 && r > 0.0 {
            layers.push(MouthLayer {
                patch: POPPED + i + 1,
                alpha: k * pop * out,
            });
        }
    }
    layers.retain(|l| l.alpha > 0.002);
    layers
}

/// Bubble radius in authored pixels: three breaths, each a swell and a settle.
pub fn bubble_radius(t: f32) -> f32 {
    if !(6.6..POP).contains(&t) {
        return 0.0;
    }
    let k = (t - 6.6) / (POP - 6.6);
    let mut r = 0.0;
    for (a, b, radius) in [(0.0, 0.3, 20.0), (0.36, 0.62, 38.0), (0.68, 0.95, 56.0)] {
        if k >= a {
            r = lerp(r, radius, ease_out(clamp01((k - a) / (b - a))));
        }
    }
    r * (1.0 + 0.025 * (t * 13.0).sin())
}
pub fn bubble_center(radius: f32) -> [f32; 2] {
    [LIPS[0] + radius * 0.12, LIPS[1] + radius * 0.22]
}

/// 1 while the lenses are broken, healing between 12.6 and 13.6 s.
pub fn crack_amount(t: f32) -> f32 {
    if t < POP {
        0.0
    } else if t < 12.6 {
        1.0
    } else {
        1.0 - smoothstep(12.6, 13.6, t)
    }
}
/// How far the fresh cracks have run from the impact.
pub fn crack_growth(t: f32) -> f32 {
    ease_out(clamp01((t - POP) / 0.14))
}

/// The part of the panorama shown across both lenses: it breathes and drifts.
/// Returns the source rectangle in world-image pixels.
pub fn world_view(t: f32) -> [f32; 4] {
    let [w, h] = WORLD_SIZE;
    let b = 1.04 + 0.02 * (t * 2.0 * TAU / LOOP).sin();
    let pan = 12.0 * (t * TAU / LOOP).sin();
    let (sw, sh) = (w / b, h / b);
    [(w - sw) / 2.0 + pan, (h - sh) / 2.0, sw, sh]
}
/// A panorama point (world-image pixels) in authored space.
pub fn world_point(view: [f32; 4], point: [f32; 2]) -> [f32; 2] {
    let r = lens::WORLD_RECT;
    [
        r[0] + (point[0] - view[0]) / view[2] * r[2],
        r[1] + (point[1] - view[1]) / view[3] * r[3],
    ]
}

/// Every scalar of one moment. Geometry is generated from it in `geometry`.
#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub camera: Camera,
    /// The dream is alive (sun, couple, leaves) until the glass breaks.
    pub life: f32,
    /// Opacity of Art's soft blurred copy around the lenses.
    pub glow: f32,
    pub crack: f32,
    pub growth: f32,
    pub bubble: f32,
    /// Seconds since the pop, negative before it.
    pub since_pop: f32,
    pub world: [f32; 4],
    pub bloom: f32,
    pub flash: f32,
    /// x of the light sweep across the glasses and its strength.
    pub glint: [f32; 2],
    /// x of the healing light and its strength.
    pub heal: [f32; 2],
}

pub fn compose(seconds: f64) -> Frame {
    let t = loop_time(seconds);
    let crack = crack_amount(t);
    let since_pop = t - POP;
    let glint = [4.6f32, 8.2]
        .iter()
        .map(|start| (t - start) / 1.1)
        .find(|k| (0.0..=1.0).contains(k))
        .map_or([0.0, 0.0], |k| [lerp(640.0, 920.0, ease_in_out(k)), 0.32]);
    let heal = if t > 12.6 && t < 13.6 {
        [lerp(650.0, 910.0, t - 12.6), 0.35]
    } else {
        [0.0, 0.0]
    };
    Frame {
        time: t,
        camera: camera(t),
        life: 1.0 - crack,
        glow: 1.0 - 0.4 * crack,
        crack,
        growth: crack_growth(t),
        bubble: bubble_radius(t),
        since_pop,
        world: world_view(t),
        bloom: 0.13
            + 0.05 * (t * TAU / LOOP * 3.0).sin()
            + if since_pop > 0.0 {
                0.1 * (-since_pop * 4.0).exp()
            } else {
                0.0
            },
        flash: if since_pop > 0.0 && since_pop < 0.12 {
            0.1 * (1.0 - since_pop / 0.12)
        } else {
            0.0
        },
        glint,
        heal,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loop_seam_is_continuous() {
        let a = compose(0.0);
        let b = compose(LOOP_SECONDS - 1e-4);
        assert!((a.camera.zoom - b.camera.zoom).abs() < 1e-3);
        for i in 0..2 {
            assert!((a.camera.center[i] - b.camera.center[i]).abs() < 0.05);
            assert!((a.camera.back_center[i] - b.camera.back_center[i]).abs() < 0.05);
        }
        for i in 0..4 {
            assert!((a.world[i] - b.world[i]).abs() < 0.05);
        }
        assert_eq!(a.crack, 0.0);
        assert!(b.crack < 1e-3);
        // The chew cycle closes on the same drawing.
        let ma = mouth_layers(0.0);
        let mb = mouth_layers(LOOP - 1e-4);
        assert_eq!(ma[0].patch, 0);
        assert_eq!(mb.last().map(|l| l.patch), Some(0));
    }

    #[test]
    fn inputs_are_sanitized_and_values_bounded() {
        for s in [f64::NAN, f64::INFINITY, -1e30, 1e30, -3.0, 123.456] {
            let f = compose(s);
            assert!((0.0..LOOP).contains(&f.time));
            assert!(f.camera.zoom >= 1.02 && f.camera.zoom <= 2.9);
            assert!(f.bubble >= 0.0 && f.bubble < 60.0);
            for l in mouth_layers(f.time) {
                assert!(l.patch < MOUTH_COLUMNS * MOUTH_ROWS);
                assert!((0.0..=1.0).contains(&l.alpha));
            }
        }
    }

    #[test]
    fn camera_keeps_both_layers_inside_the_artwork() {
        for tick in 0..1400 {
            let c = camera(tick as f32 / 100.0);
            for (z, center) in [(c.zoom, c.center), (c.back_zoom, c.back_center)] {
                assert!(center[0] - SIZE[0] / 2.0 / z >= -1e-3);
                assert!(center[0] + SIZE[0] / 2.0 / z <= SIZE[0] + 1e-3);
                assert!(center[1] - SIZE[1] / 2.0 / z >= -1e-3);
                assert!(center[1] + SIZE[1] / 2.0 / z <= SIZE[1] + 1e-3);
            }
        }
    }

    #[test]
    fn the_bubble_pops_exactly_when_the_glass_cracks() {
        assert!(bubble_radius(POP - 0.05) > 50.0);
        assert_eq!(bubble_radius(POP), 0.0);
        assert_eq!(crack_amount(POP - 0.01), 0.0);
        assert_eq!(crack_amount(POP + 0.01), 1.0);
        // The popped film covers the lips the moment the bubble is gone.
        let popped = mouth_layers(POP + 0.07);
        assert!(popped.iter().any(|l| l.patch == POPPED && l.alpha > 0.99));
        // No smile at the end: after the gum is back the mouth only chews.
        for tick in 1210..1400 {
            for l in mouth_layers(tick as f32 / 100.0) {
                assert!(l.patch < CHEW_FRAMES);
            }
        }
    }

    #[test]
    fn world_view_stays_inside_the_panorama() {
        for tick in 0..1400 {
            let v = world_view(tick as f32 / 100.0);
            assert!(v[0] >= 0.0 && v[0] + v[2] <= WORLD_SIZE[0]);
            assert!(v[1] >= 0.0 && v[1] + v[3] <= WORLD_SIZE[1]);
        }
    }
}
