//! Grounding choreography and registered coverage for the immutable opening art.
//! No wall-clock reads: visibility, pause and economy mode share the render clock.
pub const CYCLE_SECONDS: f64 = 9.6;
pub const CODE_SECONDS: f64 = 48.0;

/// The approved image contains authored, stationary glyph columns. Remove only
/// those narrow bands in the cached GPU input, before adding the live glyph atlas.
/// The original PNG, foreground, architecture outside the bands and floor remain
/// unchanged. This preparation runs once, never in the per-frame render loop.
pub fn prepared_artwork() -> tiny_skia::Pixmap {
    let source = tiny_skia::Pixmap::decode_png(include_bytes!("../assets/grounding-hero.png"))
        .expect("validated grounding hero PNG");
    let mut prepared = source.clone();
    let matte = coverage();
    // Measured column centers and half widths in the 1536 x 1024 source.
    const COLUMNS: [(u32, u32); 28] = [
        (60, 11),
        (84, 5),
        (150, 12),
        (184, 6),
        (225, 12),
        (270, 6),
        (306, 7),
        (346, 5),
        (387, 14),
        (428, 5),
        (467, 9),
        (529, 5),
        (569, 5),
        (614, 5),
        (665, 5),
        (889, 5),
        (950, 5),
        (1002, 9),
        (1050, 6),
        (1083, 9),
        (1118, 6),
        (1164, 5),
        (1211, 5),
        (1262, 12),
        (1316, 6),
        (1369, 12),
        (1429, 7),
        (1476, 10),
    ];
    for (center, half) in COLUMNS {
        let left = center - half - 4;
        let right = center + half + 4;
        for y in 0..570 {
            let fade = 1.0 - smooth(525., 570., y as f64);
            for x in left..=right {
                let solid = f32::from(matte.pixel(x / 2, y / 2).unwrap().green()) / 255.;
                let edge = smooth(0., 4., f64::from((x - left).min(right - x)));
                let amount = edge * fade * (1.0 - solid);
                if amount < 0.001 {
                    continue;
                }
                let mix = (x - left) as f32 / (right - left) as f32;
                let a = source.pixel(left, y).unwrap();
                let b = source.pixel(right, y).unwrap();
                let original = source.pixel(x, y).unwrap();
                let mut channels = [0u8; 3];
                for (out, (before, (lo, hi))) in channels.iter_mut().zip(
                    [original.red(), original.green(), original.blue()]
                        .into_iter()
                        .zip([a.red(), a.green(), a.blue()].into_iter().zip([
                            b.red(),
                            b.green(),
                            b.blue(),
                        ])),
                ) {
                    let background = f32::from(lo) * (1.0 - mix) + f32::from(hi) * mix;
                    *out = (f32::from(before) * (1.0 - amount) + background * amount).round() as u8;
                }
                let offset = ((y * source.width() + x) * 4) as usize;
                prepared.data_mut()[offset..offset + 3].copy_from_slice(&channels);
            }
        }
    }
    prepared
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Frame {
    pub breath: f32,
    pub code_phase: f32,
    pub motion: f32,
    pub flow: [f32; 2],
    pub contact: f32,
    pub waves: [[f32; 2]; 2],
}

fn smooth(a: f64, b: f64, t: f64) -> f32 {
    let x = ((t - a) / (b - a)).clamp(0.0, 1.0);
    (x * x * (3.0 - 2.0 * x)) as f32
}

pub fn frame(active_seconds: f64, reduced: bool) -> Frame {
    if reduced {
        return Frame {
            breath: 0.0,
            code_phase: 0.0,
            motion: 0.0,
            flow: [0.0; 2],
            contact: 0.0,
            waves: [[0.0; 2]; 2],
        };
    }
    let seconds = if active_seconds.is_finite() {
        active_seconds.max(0.0)
    } else {
        0.0
    };
    let t = seconds.rem_euclid(CYCLE_SECONDS);
    Frame {
        breath: smooth(0.0, 2.7, t) * (1.0 - smooth(2.9, 6.8, t)),
        code_phase: (seconds.rem_euclid(CODE_SECONDS) / CODE_SECONDS) as f32,
        motion: 1.0,
        flow: [
            ((t - 1.6) / 3.4).clamp(0.0, 1.0) as f32,
            smooth(1.6, 2.2, t) * (1.0 - smooth(4.9, 5.6, t)),
        ],
        contact: smooth(4.3, 5.4, t) * (1.0 - smooth(6.4, 8.8, t)),
        waves: std::array::from_fn(|i| {
            let phase = (t - 4.7 - i as f64 * 0.85) / 3.9;
            [
                phase.clamp(0.0, 1.0) as f32,
                smooth(0.0, 0.13, phase) * (1.0 - smooth(0.55, 1.0, phase)),
            ]
        }),
    }
}

/// R = person, G = person + chair + their rim light. This is coverage only;
/// source pixels stay untouched. It prevents rain and floor effects crossing
/// the body and follows the same breathing coordinates as the source sample.
pub fn coverage() -> tiny_skia::Pixmap {
    use tiny_skia::{FillRule, Paint, PathBuilder, Pixmap, Stroke, Transform};
    let mut p = PathBuilder::new();
    p.move_to(745., 49.);
    p.cubic_to(706., 52., 698., 76., 703., 110.);
    p.cubic_to(694., 110., 696., 138., 707., 146.);
    p.cubic_to(713., 163., 706., 184., 693., 200.);
    p.cubic_to(667., 209., 625., 210., 598., 228.);
    p.cubic_to(572., 243., 565., 270., 568., 305.);
    p.cubic_to(569., 347., 559., 379., 567., 408.);
    p.cubic_to(574., 440., 602., 456., 630., 468.);
    p.cubic_to(608., 481., 592., 501., 598., 530.);
    p.cubic_to(602., 558., 624., 575., 659., 582.);
    p.cubic_to(688., 588., 700., 578., 710., 569.);
    p.cubic_to(715., 618., 716., 682., 731., 733.);
    p.cubic_to(736., 757., 730., 780., 728., 808.);
    p.cubic_to(722., 828., 716., 848., 723., 864.);
    p.cubic_to(738., 884., 789., 895., 819., 882.);
    p.cubic_to(831., 878., 826., 866., 813., 855.);
    p.cubic_to(798., 843., 779., 826., 780., 804.);
    p.cubic_to(788., 757., 788., 711., 790., 672.);
    p.cubic_to(789., 619., 801., 587., 790., 554.);
    p.cubic_to(807., 546., 835., 545., 858., 552.);
    p.cubic_to(868., 590., 868., 635., 882., 685.);
    p.cubic_to(891., 719., 896., 754., 894., 789.);
    p.cubic_to(890., 810., 889., 831., 898., 844.);
    p.cubic_to(918., 859., 969., 870., 1009., 860.);
    p.cubic_to(1020., 853., 1012., 839., 998., 829.);
    p.cubic_to(972., 811., 943., 798., 942., 773.);
    p.cubic_to(940., 734., 939., 704., 941., 675.);
    p.cubic_to(945., 628., 955., 578., 953., 538.);
    p.cubic_to(951., 516., 946., 506., 941., 500.);
    p.cubic_to(943., 484., 936., 473., 924., 469.);
    p.cubic_to(910., 459., 896., 453., 884., 448.);
    p.cubic_to(858., 429., 856., 408., 844., 380.);
    p.cubic_to(836., 350., 839., 310., 829., 275.);
    p.cubic_to(823., 252., 804., 241., 781., 237.);
    p.cubic_to(774., 225., 777., 211., 784., 205.);
    p.cubic_to(798., 211., 801., 193., 803., 184.);
    p.cubic_to(815., 178., 812., 168., 808., 159.);
    p.cubic_to(823., 146., 822., 121., 814., 95.);
    p.cubic_to(805., 62., 778., 45., 745., 49.);
    p.close();
    let body = p.finish().unwrap();
    let mut c = PathBuilder::new();
    c.move_to(506., 412.);
    c.line_to(541., 402.);
    c.line_to(583., 423.);
    c.line_to(583., 564.);
    c.line_to(895., 565.);
    c.line_to(895., 788.);
    c.line_to(605., 830.);
    c.line_to(506., 791.);
    c.close();
    let chair = c.finish().unwrap();
    let mut person = Pixmap::new(768, 512).unwrap();
    let mut covered = Pixmap::new(768, 512).unwrap();
    let mut paint = Paint::default();
    paint.set_color_rgba8(255, 255, 255, 255);
    let transform = Transform::from_scale(0.5, 0.5);
    person.fill_path(&body, &paint, FillRule::Winding, transform, None);
    covered.fill_path(&body, &paint, FillRule::Winding, transform, None);
    covered.stroke_path(
        &body,
        &paint,
        &Stroke {
            width: 20.,
            ..Default::default()
        },
        transform,
        None,
    );
    covered.fill_path(&chair, &paint, FillRule::Winding, transform, None);
    let mut packed = Pixmap::new(768, 512).unwrap();
    for ((out, body), solid) in packed
        .data_mut()
        .as_chunks_mut::<4>()
        .0
        .iter_mut()
        .zip(person.data().as_chunks::<4>().0)
        .zip(covered.data().as_chunks::<4>().0)
    {
        out.copy_from_slice(&[body[3], solid[3], 0, 255]);
    }
    packed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn live_rain_preparation_preserves_foreground_and_floor() {
        let original =
            tiny_skia::Pixmap::decode_png(include_bytes!("../assets/grounding-hero.png")).unwrap();
        let prepared = prepared_artwork();
        let solid = coverage();
        let mut removed_energy = 0u64;
        for y in 0..original.height() {
            for x in 0..original.width() {
                let a = original.pixel(x, y).unwrap();
                let b = prepared.pixel(x, y).unwrap();
                if y >= 570 || solid.pixel(x / 2, y / 2).unwrap().green() == 255 {
                    assert_eq!(a, b, "immutable foreground or floor at {x},{y}");
                }
                removed_energy += u64::from(a.red().saturating_sub(b.red()));
            }
        }
        assert!(
            removed_energy > 500_000,
            "authored bright code was not removed"
        );
    }

    #[test]
    fn energy_reaches_feet_before_the_floor_answers() {
        let inhale = frame(1.5, false);
        let descending = frame(3.4, false);
        let arrival = frame(5.4, false);
        assert!(inhale.breath > 0.5 && inhale.flow[1] == 0.0);
        assert!(descending.flow[0] > 0.4 && descending.flow[1] > 0.9);
        assert_eq!(descending.waves[0][1], 0.0);
        assert!(arrival.contact > 0.99 && arrival.waves[0][1] > 0.9);
    }

    #[test]
    fn settled_pose_and_loop_seam_do_not_jump() {
        let before = frame(CYCLE_SECONDS - 0.001, false);
        let after = frame(CYCLE_SECONDS + 0.001, false);
        assert!((before.breath - after.breath).abs() < 0.00001);
        assert_eq!(before.contact, after.contact);
        assert_eq!(before.waves[0][1], 0.0);
        assert_eq!(before.waves[1][1], 0.0);
        assert_eq!(frame(3., true), frame(830.4, true));
        assert_eq!(frame(f64::NAN, false), frame(0., false));
    }

    #[test]
    fn pause_suspends_every_layer_without_catch_up() {
        let mut clock = crate::clock::Clock::default();
        clock.step(0., true);
        clock.step(1000., true);
        let paused = frame(clock.elapsed, false);
        clock.step(9000., false);
        clock.step(20000., true);
        assert_eq!(paused, frame(clock.elapsed, false));
        clock.step(20100., true);
        assert_ne!(paused, frame(clock.elapsed, false));
    }

    #[test]
    fn matrix_and_waves_cannot_cross_the_body_or_chair() {
        let matte = coverage();
        for [x, y] in [
            [755, 120],
            [734, 315],
            [655, 428],
            [750, 690],
            [915, 701],
            [765, 858],
            [949, 844],
        ] {
            let pixel = matte.pixel(x / 2, y / 2).unwrap();
            assert_eq!(pixel.red(), 255, "body coverage at {x}, {y}");
            assert_eq!(pixel.green(), 255);
        }
        assert_eq!(matte.pixel(540 / 2, 700 / 2).unwrap().green(), 255);
        assert_eq!(matte.pixel(300 / 2, 300 / 2).unwrap().green(), 0);
        assert_eq!(matte.pixel(1100 / 2, 890 / 2).unwrap().green(), 0);
    }
}
