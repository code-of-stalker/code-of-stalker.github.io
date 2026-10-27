//! Active-time choreography for the approved Step 3 illustration.
//! Immutable artwork stays separate from timing and the GPU adapter.
pub const STORY_SECONDS: f64 = 14.0;
pub const LOOP_SECONDS: f64 = STORY_SECONDS * 3.0;
pub const ARTWORK_SIZE: [f32; 2] = [1536.0, 1024.0];

/// Exact user-edited RGBA source. Decoding only premultiplies RGB for the GPU;
/// alpha is copied unchanged, including new coverage outside the old footprint.
pub fn user_portrait() -> Result<tiny_skia::Pixmap, String> {
    portrait("voice-presence-person.png")
}
/// The same portrait in Art's light palette for Дюна (`prepare-sand-rasters.py`
/// maps its colors through the dark and light paintings); the alpha is identical.
pub fn user_portrait_sand() -> Result<tiny_skia::Pixmap, String> {
    portrait("voice-presence-sand-person.png")
}
fn portrait(name: &str) -> Result<tiny_skia::Pixmap, String> {
    let portrait = tiny_skia::Pixmap::decode_png(crate::asset_store::bytes(name)?)
        .map_err(|e| format!("{name}: {e}"))?;
    assert_eq!([portrait.width(), portrait.height()], [1536, 1024]);
    Ok(portrait)
}
/// Export compatibility: coverage now comes directly from the supplied PNG.
pub fn portrait_matte() -> Result<tiny_skia::Pixmap, String> {
    user_portrait()
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Frame {
    pub seconds: f32,
    pub code_seconds: f32,
    pub breath: f32,
    pub voice: f32,
    pub motion: f32,
    pub restore: f32,
    pub waves: [[f32; 2]; 3],
}

fn smooth(start: f32, end: f32, value: f32) -> f32 {
    let t = ((value - start) / (end - start)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Each source fragment is also its destination on restoration. No accumulated
/// positions, random per-frame noise, or hidden-time catch-up.
#[derive(Debug, Clone, Copy)]
pub struct Fragment {
    pub source: [f32; 4],
    pub center: [f32; 2],
    pub rotation: f32,
    pub scale: f32,
    pub opacity: f32,
}

pub fn fragments(frame: Frame, economy: bool) -> Vec<Fragment> {
    if frame.motion == 0.0 {
        return Vec::new();
    }
    let mut result = Vec::with_capacity(320);
    for row in 0..14 {
        for column in 0..32 {
            // Keep the person, original voice ribbon and engraved floor intact.
            if (12..20).contains(&column)
                || ((16..28).contains(&column) && row < 5)
                || (4..8).contains(&row)
                || (economy && (row + column) % 2 == 0)
            {
                continue;
            }
            let x = column as f32 * 48.0;
            let y = row as f32 * 52.0;
            let center = [x + 24.0, y + 26.0];
            let distance = ((center[0] / 1536.0 - 0.5).powi(2)
                + (center[1] / 1024.0 - 0.30).powi(2) * 0.3)
                .sqrt();
            let departure = 1.55 + distance * 3.2;
            let amount = smooth(departure, departure + 1.7, frame.seconds) * (1.0 - frame.restore);
            let opacity = (amount * std::f32::consts::PI).sin().powi(2) * 0.82;
            if opacity < 0.001 {
                continue;
            }
            let seed = ((column * 37 + row * 73) % 101) as f32 / 100.0;
            let outward = (center[0] - 768.0).signum();
            result.push(Fragment {
                source: [x, y, 48.0, 52.0],
                center: [
                    center[0] + outward * (65.0 + seed * 175.0) * amount,
                    center[1] - (25.0 + seed * 115.0) * amount,
                ],
                rotation: outward * (seed - 0.3) * 0.42 * amount,
                scale: 1.0 + 0.35 * amount,
                opacity,
            });
        }
    }
    result
}

pub fn frame(active_seconds: f64, reduced: bool) -> Frame {
    if reduced {
        return Frame {
            seconds: 0.0,
            code_seconds: 0.0,
            breath: 0.0,
            voice: 0.0,
            motion: 0.0,
            restore: 0.0,
            waves: [[0.0; 2]; 3],
        };
    }
    let seconds = if active_seconds.is_finite() {
        active_seconds.max(0.0).rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let code_seconds = seconds as f32;
    // Enter with the complete scene, inhale/release into the quiet environment,
    // then restore the scene before the next seamless 14-second story.
    let seconds = seconds.rem_euclid(STORY_SECONDS) as f32;
    Frame {
        seconds,
        code_seconds,
        breath: smooth(0.0, 1.6, seconds) * (1.0 - smooth(1.6, 4.8, seconds)),
        voice: smooth(1.1, 1.85, seconds) * (1.0 - smooth(4.0, 5.8, seconds)),
        motion: 1.0,
        restore: smooth(8.5, 12.6, seconds),
        waves: std::array::from_fn(|i| {
            let progress = (seconds - 1.55 - i as f32 * 0.66) / 3.1;
            [
                0.025 + 0.66 * progress.clamp(0.0, 1.0),
                smooth(0.0, 0.12, progress) * (1.0 - smooth(0.66, 1.0, progress)),
            ]
        }),
    }
}

/// Previous source footprint, used ONLY to remove the old embedded portrait
/// from the background plate. Never applied to the user-supplied portrait.
/// Registered silhouette of the original artwork, rasterized once by Rust.
/// Unlike the former overlapping ellipses, this keeps the neck, hands, arm
/// opening and leg gap connected without retaining rectangular code scraps.
pub fn original_portrait_coverage() -> tiny_skia::Pixmap {
    use tiny_skia::{FillRule, Paint, PathBuilder, Pixmap, Stroke, Transform};
    let mut p = PathBuilder::new();
    p.move_to(754., 131.);
    p.cubic_to(730., 129., 709., 148., 706., 174.);
    p.cubic_to(699., 201., 711., 224., 729., 239.);
    p.cubic_to(737., 248., 734., 263., 723., 272.);
    p.cubic_to(712., 277., 687., 278., 679., 298.);
    p.cubic_to(671., 315., 670., 347., 663., 377.);
    p.cubic_to(657., 399., 659., 420., 670., 430.);
    p.cubic_to(680., 440., 691., 429., 703., 415.);
    // Registered to the intact source rim: the former contour narrowed both
    // calves by 15-20 source pixels and filled the crotch with background.
    p.cubic_to(714., 432., 715., 453., 704., 473.);
    p.cubic_to(696., 493., 685., 512., 684., 538.);
    p.cubic_to(684., 580., 701., 633., 713., 672.);
    p.cubic_to(716., 691., 714., 710., 710., 730.);
    p.cubic_to(706., 751., 711., 775., 720., 797.);
    p.cubic_to(728., 817., 733., 838., 731., 859.);
    p.cubic_to(731., 872., 725., 881., 721., 887.);
    p.cubic_to(716., 895., 744., 896., 758., 892.);
    p.cubic_to(762., 886., 760., 879., 756., 867.);
    p.cubic_to(751., 848., 751., 825., 754., 803.);
    p.cubic_to(756., 784., 761., 766., 759., 746.);
    p.cubic_to(757., 727., 753., 716., 756., 701.);
    p.cubic_to(763., 672., 764., 640., 760., 613.);
    p.cubic_to(760., 590., 763., 568., 761., 550.);
    p.line_to(766., 550.);
    p.cubic_to(765., 571., 766., 597., 764., 620.);
    p.cubic_to(766., 650., 769., 675., 767., 695.);
    p.cubic_to(766., 714., 774., 730., 772., 748.);
    p.cubic_to(767., 772., 765., 794., 768., 818.);
    p.cubic_to(770., 840., 764., 863., 766., 882.);
    p.cubic_to(766., 891., 774., 895., 788., 894.);
    p.cubic_to(799., 895., 805., 893., 806., 889.);
    p.cubic_to(806., 884., 797., 878., 792., 870.);
    // Outside of the right foot, ankle and calf, traced upward.
    p.cubic_to(791., 868., 788., 860., 790., 852.);
    p.cubic_to(789., 832., 798., 809., 805., 786.);
    p.cubic_to(813., 766., 815., 745., 811., 726.);
    p.cubic_to(807., 708., 807., 690., 810., 674.);
    p.cubic_to(815., 650., 832., 608., 835., 571.);
    p.cubic_to(839., 537., 826., 502., 820., 477.);
    p.cubic_to(811., 453., 814., 424., 815., 407.);
    p.cubic_to(821., 430., 824., 455., 833., 479.);
    p.cubic_to(841., 500., 854., 523., 859., 537.);
    p.cubic_to(862., 549., 853., 559., 853., 571.);
    p.cubic_to(854., 577., 861., 567., 864., 562.);
    p.cubic_to(865., 573., 854., 588., 861., 593.);
    p.cubic_to(870., 596., 883., 575., 886., 554.);
    p.cubic_to(884., 541., 878., 535., 879., 521.);
    p.cubic_to(880., 503., 874., 481., 868., 461.);
    p.cubic_to(858., 435., 853., 410., 851., 383.);
    p.cubic_to(849., 351., 850., 319., 843., 301.);
    p.cubic_to(837., 284., 825., 279., 807., 275.);
    p.cubic_to(786., 270., 776., 256., 778., 228.);
    p.cubic_to(778., 219., 792., 219., 797., 210.);
    p.line_to(796., 201.);
    p.line_to(802., 195.);
    p.line_to(797., 187.);
    p.line_to(800., 182.);
    p.cubic_to(793., 176., 791., 171., 791., 162.);
    p.cubic_to(788., 144., 773., 132., 754., 131.);
    p.close();
    let path = p.finish().expect("authored closed portrait contour");
    let mut matte = Pixmap::new(1536, 1024).expect("fixed portrait dimensions");
    let mut paint = Paint::default();
    // Nested soft strokes protect the original glow without a broad dark halo.
    for (width, alpha) in [(5., 0.04), (3., 0.16), (1.5, 0.45)] {
        paint.set_color_rgba8(255, 255, 255, (alpha * 255.) as u8);
        matte.stroke_path(
            &path,
            &paint,
            &Stroke {
                width,
                ..Stroke::default()
            },
            Transform::identity(),
            None,
        );
    }
    paint.set_color_rgba8(255, 255, 255, 255);
    matte.fill_path(
        &path,
        &paint,
        FillRule::Winding,
        Transform::identity(),
        None,
    );
    matte
}

/// Independent channels packed into one immutable GPU texture: generated
/// environment RGB and registered portrait coverage A. This is deliberately
/// raw channel data, not a premultiplied color image.
pub fn environment_layers() -> Result<Vec<u8>, String> {
    pack_environment("voice-presence-environment.png")
}
/// Дюна's quiet frame, drawn from Art's light painting. Unlike the generated
/// dark plate it is registered in the artwork's own coordinates.
pub fn environment_layers_sand() -> Result<Vec<u8>, String> {
    pack_environment("voice-presence-sand-environment.png")
}
fn pack_environment(name: &str) -> Result<Vec<u8>, String> {
    let background = tiny_skia::Pixmap::decode_png(crate::asset_store::bytes(name)?)
        .map_err(|e| format!("{name}: {e}"))?;
    assert_eq!([background.width(), background.height()], [1536, 1024]);
    let matte = original_portrait_coverage();
    let mut pixels = background.data().to_vec();
    for (pixel, coverage) in pixels
        .as_chunks_mut::<4>()
        .0
        .iter_mut()
        .zip(matte.data().as_chunks::<4>().0.iter())
    {
        pixel[3] = coverage[3];
    }
    Ok(pixels)
}

#[cfg(test)]
mod tests {
    #[test]
    fn sand_layers_keep_the_portrait_coverage_and_light_air() {
        let dark = super::user_portrait().unwrap();
        let sand = super::user_portrait_sand().unwrap();
        assert!(dark
            .pixels()
            .iter()
            .zip(sand.pixels())
            .all(|(a, b)| a.alpha() == b.alpha()));
        let layers = super::environment_layers_sand().unwrap();
        assert_eq!(layers.len(), 1536 * 1024 * 4);
        // Where the figure stood, the quiet frame is pale air: no dark moat.
        for (x, y) in [(768, 300), (740, 500), (790, 600)] {
            let at = (y * 1536 + x) * 4;
            let [r, g, b] = [layers[at], layers[at + 1], layers[at + 2]];
            assert!(r > 230 && g > 200 && b > 110, "{x},{y}: {r} {g} {b}");
        }
    }

    #[test]
    fn user_portrait_retains_every_supplied_alpha_value_without_legacy_clipping() {
        let portrait = super::user_portrait().unwrap();
        let source =
            tiny_skia::Pixmap::decode_png(include_bytes!("../assets/voice-presence-person.png"))
                .unwrap();
        assert_eq!(portrait.data(), source.data());
        let old = super::original_portrait_coverage();
        let added = portrait
            .pixels()
            .iter()
            .zip(old.pixels())
            .filter(|(new, old)| new.alpha() > old.alpha())
            .count();
        assert!(
            added > 2000,
            "User restored coverage must survive the old footprint"
        );
        assert_eq!(portrait.pixel(0, 0).unwrap().alpha(), 0);
        for (x, y) in [(725, 760), (790, 760), (740, 885), (787, 885)] {
            assert!(
                portrait.pixel(x, y).unwrap().alpha() > 200,
                "calf/foot {x},{y}"
            );
        }
    }

    use super::*;

    #[test]
    fn loop_has_no_value_or_velocity_jump() {
        let before = frame(LOOP_SECONDS - 0.001, false);
        let seam = frame(LOOP_SECONDS, false);
        let after = frame(LOOP_SECONDS + 0.001, false);
        assert_eq!(seam, frame(0.0, false));
        for (a, b, c) in [
            (before.breath, seam.breath, after.breath),
            (before.voice, seam.voice, after.voice),
        ] {
            assert!((c - a).abs() < 0.002);
            assert!(((c - b) - (b - a)).abs() < 0.00001);
        }
    }

    #[test]
    fn reduced_motion_is_the_unmodified_artwork_at_any_time() {
        assert_eq!(frame(0.0, true), frame(93125.4, true));
        assert_eq!(frame(3.0, true).motion, 0.0);
    }

    #[test]
    fn pause_does_not_advance_or_catch_up() {
        let mut clock = crate::clock::Clock::default();
        clock.step(100.0, true);
        clock.step(1200.0, true);
        let paused = frame(clock.elapsed, false);
        clock.step(9000.0, false);
        clock.step(16000.0, true);
        assert_eq!(paused, frame(clock.elapsed, false));
        clock.step(16100.0, true);
        assert_ne!(paused, frame(clock.elapsed, false));
    }

    #[test]
    fn invalid_and_long_running_delivery_remains_bounded() {
        for seconds in [f64::NAN, f64::INFINITY, -4.0, 1e12] {
            let f = frame(seconds, false);
            assert!((0.0..LOOP_SECONDS as f32).contains(&f.seconds));
            assert!((0.0..LOOP_SECONDS as f32).contains(&f.code_seconds));
            assert!((0.0..=1.0).contains(&f.breath));
            assert!((0.0..=1.0).contains(&f.voice));
        }
    }

    #[test]
    fn release_restoration_and_still_modes_have_distinct_contracts() {
        assert!(fragments(frame(0.0, false), false).is_empty());
        assert!(!fragments(frame(3.5, false), false).is_empty());
        assert!(fragments(frame(6.0, false), false).is_empty());
        assert!(!fragments(frame(10.7, false), false).is_empty());
        assert!(fragments(frame(13.7, false), false).is_empty());
        assert!(fragments(frame(3.7, true), false).is_empty());
        for f in fragments(frame(3.7, false), false) {
            let original_x = f.source[0] + f.source[2] * 0.5;
            assert!((f.center[0] - 768.0).abs() >= (original_x - 768.0).abs());
            assert!(f.source[1] + f.source[3] <= 728.0);
        }
    }

    #[test]
    fn code_continues_slowly_across_the_three_story_cycles() {
        assert_eq!(
            frame(0.0, false).seconds,
            frame(STORY_SECONDS, false).seconds
        );
        assert_eq!(frame(STORY_SECONDS, false).code_seconds, 14.);
        assert_eq!(frame(LOOP_SECONDS, false), frame(0.0, false));
    }

    #[test]
    fn starts_with_the_complete_scene_and_keeps_environment_separate_from_coverage() {
        let first = frame(0.0, false);
        assert_eq!(
            (first.seconds, first.breath, first.voice, first.restore),
            (0., 0., 0., 0.)
        );
        let layers = environment_layers().unwrap();
        let foot = (885 * 1536 + 768) * 4;
        let floor = (970 * 1536 + 768) * 4;
        assert!(layers[foot + 3] > 240);
        assert_eq!(layers[floor + 3], 0);
        assert!(
            layers[floor] > 15,
            "floor must remain present outside the portrait"
        );
    }

    #[test]
    fn each_story_starts_complete_before_breathing_and_clearing() {
        for cycle in 0..3 {
            let start = frame(cycle as f64 * STORY_SECONDS, false);
            assert_eq!(start.seconds, 0.0);
            assert_eq!(start.restore, 0.0);
            assert!(fragments(start, false).is_empty());
            let inhale = frame(cycle as f64 * STORY_SECONDS + 1.6, false);
            assert_eq!(inhale.breath, 1.0);
            assert!(inhale.voice > 0.5);
            assert_eq!(
                frame(cycle as f64 * STORY_SECONDS + 7.0, false).restore,
                0.0
            );
            assert_eq!(
                frame(cycle as f64 * STORY_SECONDS + 13.0, false).restore,
                1.0
            );
        }
    }

    #[test]
    fn repaired_matte_keeps_both_source_calves_and_rejects_adjacent_background() {
        let matte = original_portrait_coverage();
        // Visible source rims were outside the old narrow calf approximation.
        for (x, y) in [
            (716, 745),
            (805, 750),
            (720, 780),
            (797, 780),
            (740, 886),
            (788, 887),
        ] {
            assert!(
                matte.pixel(x, y).unwrap().alpha() > 240,
                "missing source pixel {x},{y}"
            );
        }
        for (x, y) in [(700, 750), (825, 750), (843, 510), (712, 900), (815, 900)] {
            assert_eq!(
                matte.pixel(x, y).unwrap().alpha(),
                0,
                "background retained at {x},{y}"
            );
        }
    }
    #[test]
    fn matte_preserves_neck_and_hands_but_excludes_floor_and_arm_gap() {
        let matte = original_portrait_coverage();
        for (x, y) in [(754, 190), (755, 253), (765, 355), (872, 553), (741, 882)] {
            assert!(matte.pixel(x, y).unwrap().alpha() > 240);
        }
        for (x, y) in [(250, 790), (843, 510), (1000, 530), (650, 950)] {
            assert_eq!(matte.pixel(x, y).unwrap().alpha(), 0);
        }
    }
}
