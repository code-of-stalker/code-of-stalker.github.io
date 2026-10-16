//! Original Laboratory equations, not a looping screenshot or sampled sprite.
pub mod settings {
    include!("../assets/settings.rs");
}
use settings::{architecture as a, diary as d};
fn clamp(v: f64) -> f64 {
    v.clamp(0., 1.)
}
fn smooth(a: f64, b: f64, v: f64) -> f64 {
    let t = clamp((v - a) / (b - a));
    t * t * (3. - 2. * t)
}
pub struct Cells {
    pub cells: Vec<[f64; 3]>,
    pub person: [f64; 2],
    pub frame: [f64; 2],
    pub light: [f64; 2],
    pub scan: [f64; 2],
    pub ripple: [f64; 3],
}
pub fn cells(seconds: f64, age: f64) -> Cells {
    let phase = if a::TRIGGER == "tap" {
        if age.is_finite() {
            clamp(age / a::TOUCH_DURATION)
        } else {
            0.
        }
    } else {
        seconds.rem_euclid(a::CYCLE) / a::CYCLE
    };
    let base = smooth(0.16, 0.44, phase) * (1. - smooth(0.76, 0.98, phase));
    let p = clamp(age / a::TOUCH_DURATION);
    let touch = if a::TOUCH_ENABLED && age.is_finite() && p < 1. {
        (std::f64::consts::PI * p).sin().powf(1.4) * a::TOUCH_STRENGTH
    } else {
        0.
    };
    let motion = if a::MOTION == "breathe" {
        0.5 - 0.5 * (phase * std::f64::consts::TAU).cos()
    } else {
        base
    };
    let q = clamp(
        motion
            + if a::TRIGGER == "loop" && a::TOUCH == "open" {
                touch * 0.5
            } else {
                0.
            },
    );
    let cy = (a::ROWS - 1.) / 2.;
    let cx = (a::COLUMNS - 1.) / 2.;
    let mut cells = Vec::new();
    for row in 0..a::ROWS as u32 {
        for col in 0..a::COLUMNS as u32 {
            if col as f64 == cx && row as f64 == cy {
                continue;
            }
            let dx = col as f64 - cx;
            let dy = row as f64 - cy;
            let arrival = dx.hypot(dy) * 0.065;
            let wave = if a::MOTION == "wave" {
                smooth(0.16 + arrival, 0.35 + arrival, phase)
                    * (1. - smooth(0.63 + arrival, 0.85 + arrival, phase))
            } else {
                0.
            };
            let shift = if a::MOTION == "wave" { wave } else { q };
            cells.push([
                144. + dx * 45f64.min(236. / (a::COLUMNS - 1.)) + dx * shift * a::SPREAD,
                76. + dy * 37f64.min(106. / (a::ROWS - 1.)) + dy * shift * a::SPREAD,
                (a::NEIGHBOR_OPACITY * (1. - 0.28 * q) + wave * 0.35).min(1.),
            ]);
        }
    }
    let y = 66. - 30. * q;
    let scale = a::START_SCALE + (a::FIGURE_SCALE - a::START_SCALE) * q;
    let light_y = y + (45. + a::LIGHT_OFFSET) * scale;
    let scan = clamp((phase - 0.34) / 0.34);
    Cells {
        cells,
        person: [y, scale],
        frame: [
            0.53 * a::CELL_SIZE + (1. - 0.53 * a::CELL_SIZE) * q + q * a::FRAME_SPREAD,
            (0.7 - 0.4 * q) * if a::FADE_FIGURE_FRAME { 1. - q } else { 1. },
        ],
        light: [
            light_y,
            ((0.1 + 0.9 * q)
                * (1. - a::LIGHT_PULSE * 0.5
                    + a::LIGHT_PULSE * 0.5 * (seconds * std::f64::consts::TAU / 2.8).cos())
                + touch * 0.2)
                .min(1.),
        ],
        scan: [
            -5. + scan * 102.,
            if a::SCAN_ENABLED && scan > 0. && scan < 1. {
                (scan * std::f64::consts::PI).sin() * a::SCAN_STRENGTH
            } else {
                0.
            },
        ],
        ripple: [
            8. + p * 108.,
            light_y,
            if a::TOUCH == "pulse" {
                ((1. - p) * touch * 0.5).max(0.)
            } else {
                0.
            },
        ],
    }
}
pub struct Diary {
    pub layers: Vec<f64>,
    pub signal: Vec<[f64; 2]>,
    pub scan: [f64; 2],
    pub halo: f64,
    pub glow: f64,
    pub trace: f64,
    pub indicator: f64,
    pub ripple: [f64; 3],
    pub touch: f64,
}
pub fn diary(seconds: f64, age: f64) -> Diary {
    let t = seconds * d::TEMPO;
    // The untouched timeline uses an infinite sentinel. It is not an active
    // contact and must never write infinite ellipse/scan geometry to the DOM.
    let contact = age.is_finite() && age >= 0.;
    let p = if contact { age / d::TOUCH_DURATION } else { 1. };
    let touch = if (0.0..1.).contains(&p) {
        (std::f64::consts::PI * p).sin().powf(1.4) * d::TOUCH_STRENGTH
    } else {
        0.
    };
    let phase = t.rem_euclid(d::SCAN_INTERVAL) / d::SCAN_INTERVAL;
    let layers = (0..d::LAYERS as u32)
        .map(|layer| {
            let layer = layer as f64;
            let shift = match d::MOTION {
                "cascade" => {
                    (t * std::f64::consts::TAU / 6. - layer * d::STAGGER * 1.5).sin()
                        * d::FLOAT_AMOUNT
                }
                "breathe" => {
                    (t * std::f64::consts::TAU / 8.).sin() * d::FLOAT_AMOUNT * layer
                        / (d::LAYERS - 1.).max(1.)
                }
                _ => (t * std::f64::consts::TAU / 9.).sin() * d::FLOAT_AMOUNT,
            };
            layer * d::LAYER_GAP + shift
                - if d::TOUCH == "lift" {
                    touch * (d::LAYERS - layer) * 4.
                } else {
                    0.
                }
        })
        .collect();
    let signal = (0..d::SIGNAL_COUNT as u32)
        .map(|i| {
            let i = i as f64;
            let envelope = 0.18
                + 0.82
                    * (std::f64::consts::PI * i / (d::SIGNAL_COUNT - 1.))
                        .sin()
                        .powf(1.4);
            let variation = 0.7
                + 0.16 * (t * d::SIGNAL_SPEED * 1.7 + i * 1.3).sin()
                + 0.14 * (t * d::SIGNAL_SPEED * 2.9 - i * 0.8).sin();
            [
                1.5 + 9. * envelope * variation * d::SIGNAL_AMOUNT,
                0.28 + 0.72 * envelope * variation,
            ]
        })
        .collect();
    let save = d::TOUCH == "save" && contact && age < d::TOUCH_DURATION;
    let progress = p.min(1.);
    Diary {
        layers,
        signal,
        scan: [
            if save {
                46. + (progress * 50. - 24.) * d::TILT - d::SCAN_WIDTH / 2.
            } else {
                46. + (phase * 49. - 23.) * d::TILT - d::SCAN_WIDTH / 2.
            },
            if save {
                touch * d::SCAN_STRENGTH
            } else if d::SCAN_ENABLED && phase > 0.15 && phase < 0.8 {
                (std::f64::consts::PI * (phase - 0.15) / 0.65).sin() * d::SCAN_STRENGTH
            } else {
                0.
            },
        ],
        halo: d::HALO * (1. + (t * std::f64::consts::TAU / 7.).sin() * d::HALO_PULSE * 0.5)
            + touch * if d::TOUCH == "pulse" { 0.16 } else { 0.05 },
        glow: d::GLOW + touch * 0.65,
        trace: -t * 370. / 15.,
        indicator: 0.35 + touch * 0.65 + 0.2 * (seconds * 1.5).sin().powi(2),
        ripple: [
            64. + progress * 46.,
            24. + progress * 18.,
            if d::TOUCH == "pulse" {
                ((1. - progress) * d::TOUCH_STRENGTH * 0.6).max(0.)
            } else {
                0.
            },
        ],
        touch,
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn continuous_diary_has_no_sample_loop_seam() {
        let a = diary(34.999, f64::INFINITY);
        let b = diary(35.001, f64::INFINITY);
        assert!((a.layers[2] - b.layers[2]).abs() < 0.1);
        assert!(a.ripple.iter().all(|v| v.is_finite()));
    }
    #[test]
    fn original_cells_touch_and_grid() {
        let a = cells(0., f64::INFINITY);
        assert_eq!(a.cells.len(), 14);
        assert_eq!(a.person, [66., 0.22]);
        let t = cells(0., 1.1);
        assert!(t.ripple[2] > 0.);
        assert!(t.light[1] > a.light[1]);
    }
    #[test]
    fn untouched_diary_never_emits_invalid_geometry_or_a_touch() {
        for age in [f64::INFINITY, f64::NEG_INFINITY, f64::NAN, -1.] {
            let frame = diary(7., age);
            assert!(frame
                .ripple
                .iter()
                .chain(frame.scan.iter())
                .all(|v| v.is_finite()));
            assert_eq!(frame.touch, 0.);
            assert_eq!(frame.ripple[2], 0.);
        }
    }
}
