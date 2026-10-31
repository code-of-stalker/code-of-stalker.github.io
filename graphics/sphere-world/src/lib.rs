//! «Мир вокруг», page 01 of Step 5 «Внешнее кольцо». Art's panorama of a
//! mountain lake stretched around the viewer, seen from the centre of the
//! sphere. The camera turns once around per loop, and each beat wakes one
//! thing where it looks: a gust through the forest, a drop and its ripple on
//! the lake, a bird across the sky, a ring of light around the sphere, the
//! stars in depth. Every value here is a pure function of loop time;
//! `browser.rs` only uploads it and the shader paints it.
use std::f32::consts::{PI, TAU};
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::SphereWorld;

/// The panorama, equirectangular: longitude across, latitude down.
pub const SIZE: [u32; 2] = [3072, 1536];
/// One full turn of the camera and five beats.
pub const LOOP_SECONDS: f32 = 90.0;
pub const BEATS: usize = 5;
pub const BEAT_SECONDS: f32 = 18.0;
/// The loop opens quiet; the first beat starts after this.
pub const FIRST_BEAT: f32 = 2.0;
/// Seconds into a beat when the camera faces its centre.
pub const PEAK: f32 = 5.0;
/// After this, nothing of a beat is left on screen.
pub const BEAT_QUIET: f32 = 13.0;

/// The view: 84° across, whatever the frame's shape.
pub const VIEW_DEGREES: f32 = 84.0;
/// The ripple lands on the panorama's middle, where the lake shines most.
pub const RIPPLE_U: f32 = 0.5;
/// The camera's pitch, degrees, as it faces each beat: down to the lake,
/// level for the bird, up to the stars.
pub const PITCH_DEGREES: [f32; BEATS] = [-7.0, -15.0, -1.0, -6.0, 6.0];

/// Gust: the front enters the left of the view and crosses the forest,
/// u per second; the trees bend up to `SWAY` u at their tops.
pub const GUST_START: f32 = 0.5;
pub const GUST_FROM: f32 = -0.17;
pub const GUST_SPEED: f32 = 0.045;
pub const GUST_TO: f32 = 0.2;
pub const SWAY: f32 = 4.0 / SIZE[0] as f32;
/// The sway rings out over this long after the front passes.
pub const SWAY_SECONDS: f32 = 3.0;

/// Ripple: a drop of light falls into the lake; rings spread from where it
/// lands. Ground units are eye heights above the water.
pub const DROP_START: f32 = 0.35;
pub const RIPPLE_START: f32 = 1.0;
pub const RIPPLE_LATITUDE: f32 = -31.0 * PI / 180.0;
pub const RIPPLE_RINGS: usize = 3;
pub const RIPPLE_GAP: f32 = 0.55;
pub const RIPPLE_SPEED: f32 = 0.2;
pub const RIPPLE_REACH: f32 = 0.6;

/// Bird: it flies the way the camera turns, a little faster, so it crosses
/// the view from left to right, u relative to the view centre.
pub const BIRD_FROM: f32 = -0.14;
pub const BIRD_SPEED: f32 = 0.027;
pub const BIRD_LATITUDE: f32 = 9.0 * PI / 180.0;
pub const BIRD_RISE: f32 = 3.5 * PI / 180.0;

/// Ring: born in the middle of the view just below the horizon, it runs
/// both ways around the sphere and meets itself behind the viewer; light
/// spreads from it up and down the meridians.
pub const RING_START: f32 = 1.0;
pub const RING_LATITUDE: f32 = -3.0 * PI / 180.0;
pub const RING_SPEED: f32 = 0.065;
pub const MERIDIAN_SPEED: f32 = 20.0 * PI / 180.0;
pub const MERIDIAN_REACH: f32 = 45.0 * PI / 180.0;
/// How long the ring and a meridian's dots stay lit after the light reaches them.
pub const RING_GLOW: f32 = 3.5;
pub const MERIDIAN_GLOW: f32 = 2.0;

/// Stars: brightening rises through the sky from just above the mountains,
/// then one star falls.
pub const STAR_START: f32 = 1.0;
pub const STAR_FROM: f32 = 6.0 * PI / 180.0;
pub const STAR_RISE: f32 = 9.0 * PI / 180.0;
pub const SHOOT_START: f32 = 6.2;

/// The light themes print the dark panorama as an engraving: its brightest
/// tones (the 99.7th percentile of luma) are full ink, black is the page.
pub const ENGRAVE_WHITE: f32 = 0.7277;
pub const ENGRAVE_GAMMA: f32 = 0.75;

/// Reduced motion: the drop has just landed and rings cross the lake.
pub const STILL: f32 = FIRST_BEAT + BEAT_SECONDS + RIPPLE_START + 1.6;

/// The view centre at the loop's start: the ripple's peak faces `RIPPLE_U`.
const CAMERA_FROM: f32 = RIPPLE_U - (FIRST_BEAT + BEAT_SECONDS + PEAK) / LOOP_SECONDS;
/// Where the ring is born: the view centre when it starts.
pub const RING_FROM: f32 = -(PEAK - RING_START) / LOOP_SECONDS;

/// The geometry and timing above as the shader's `u_geo` array.
pub const GEOMETRY: [f32; 24] = [
    GUST_START,
    GUST_FROM,
    GUST_SPEED,
    SWAY,
    RIPPLE_LATITUDE,
    RIPPLE_START,
    RIPPLE_GAP,
    RIPPLE_SPEED,
    RIPPLE_REACH,
    DROP_START,
    RING_LATITUDE,
    RING_START,
    RING_SPEED,
    MERIDIAN_SPEED,
    MERIDIAN_REACH,
    RING_FROM,
    STAR_START,
    STAR_FROM,
    STAR_RISE,
    SHOOT_START,
    ENGRAVE_WHITE,
    ENGRAVE_GAMMA,
    RING_GLOW,
    MERIDIAN_GLOW,
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    /// The view centre, panorama u (0..1).
    pub camera: f32,
    /// Radians, up is positive.
    pub pitch: f32,
    /// The beat on screen (0 gust … 4 stars) and seconds since it started.
    pub beat: usize,
    pub since: f32,
    /// The u the beat is centred on: the view centre at its peak.
    pub centre: f32,
    /// The bird: u, latitude, wing lift (-1 down … 1 up), presence 0..1.
    pub bird: [f32; 4],
    /// The loop's phase, 0..TAU, for the ambient twinkle.
    pub phase: f32,
}

fn wrap01(u: f32) -> f32 {
    u.rem_euclid(1.0)
}

/// A difference of u folded into -0.5..0.5.
pub fn wrap_half(u: f32) -> f32 {
    (u + 0.5).rem_euclid(1.0) - 0.5
}

pub fn camera(t: f32) -> f32 {
    wrap01(CAMERA_FROM + t / LOOP_SECONDS)
}

/// The view centre at the `beat`'s peak.
pub fn centre(beat: usize) -> f32 {
    camera(FIRST_BEAT + beat as f32 * BEAT_SECONDS + PEAK)
}

/// Half the view across, in u.
pub fn half_view() -> f32 {
    VIEW_DEGREES / 720.0
}

/// The pitch eases from one beat's key to the next with zero speed at each
/// key, so the camera never jolts.
pub fn pitch(t: f32) -> f32 {
    let from = (t - FIRST_BEAT - PEAK).rem_euclid(LOOP_SECONDS);
    let k = ((from / BEAT_SECONDS) as usize).min(BEATS - 1);
    let s = (from - k as f32 * BEAT_SECONDS) / BEAT_SECONDS;
    let w = 0.5 - 0.5 * (PI * s).cos();
    let a = PITCH_DEGREES[k];
    let b = PITCH_DEGREES[(k + 1) % BEATS];
    (a + (b - a) * w) * PI / 180.0
}

/// The bird `s` seconds into its beat, the view centre at `view`.
pub fn bird(view: f32, s: f32) -> [f32; 4] {
    let across = BIRD_FROM + BIRD_SPEED * s;
    let flight = (across - BIRD_FROM) / (2.0 * -BIRD_FROM);
    let latitude = BIRD_LATITUDE + BIRD_RISE * (PI * flight.clamp(0.0, 1.0)).sin();
    // Flaps, then glides with the wings a little raised.
    let effort = 0.15 + 0.85 * (0.5 + 0.5 * (TAU * s / 3.2).cos());
    let lift = 0.2 + (TAU * 2.4 * s).sin() * effort - 0.2 * effort;
    let presence = smooth(0.0, 0.4, s) * (1.0 - smooth(10.2, 10.8, s));
    [wrap01(view + across), latitude, lift, presence]
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let into = (time - FIRST_BEAT).rem_euclid(LOOP_SECONDS);
    let beat = ((into / BEAT_SECONDS) as usize).min(BEATS - 1);
    let since = into - beat as f32 * BEAT_SECONDS;
    let view = camera(time);
    Frame {
        time,
        camera: view,
        pitch: pitch(time),
        beat,
        since,
        centre: centre(beat),
        bird: if beat == 2 {
            bird(view, since)
        } else {
            [0.0; 4]
        },
        phase: time / LOOP_SECONDS * TAU,
    }
}

/// When the gust's front reaches `rel` u from the beat's centre.
pub fn gust_arrival(rel: f32) -> f32 {
    GUST_START + (rel - GUST_FROM) / GUST_SPEED
}

/// Where a ripple ring is, eye heights from the drop, `s` seconds into its
/// beat; `None` before it starts.
pub fn ripple_radius(ring: usize, s: f32) -> Option<f32> {
    let since = s - RIPPLE_START - ring as f32 * RIPPLE_GAP;
    (since > 0.0).then_some(since * RIPPLE_SPEED)
}

/// When the ring's light reaches `rel` u from the beat's centre.
pub fn ring_arrival(rel: f32) -> f32 {
    RING_START + wrap_half(rel - RING_FROM).abs() / RING_SPEED
}

/// When the stars at `latitude` brighten.
pub fn star_arrival(latitude: f32) -> f32 {
    STAR_START + (latitude - STAR_FROM).max(0.0) / STAR_RISE
}

/// A point on the water, `rho` eye heights from the drop in direction
/// `angle`, as (u from the beat's centre, latitude).
pub fn on_water(rho: f32, angle: f32) -> [f32; 2] {
    let reach = 1.0 / (-RIPPLE_LATITUDE).tan();
    let x = rho * angle.sin();
    let z = reach + rho * angle.cos();
    [x.atan2(z) / TAU, -(1.0 / (x * x + z * z).sqrt()).atan()]
}

/// How one theme prints the scene: dark themes keep the panorama's own
/// green, which the theme's recolor maps; light themes engrave it on the page
/// in two muted inks, the brightest tones deepest.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub light: bool,
    /// The light the beats add, in the panorama's own green.
    pub glow: [f32; 3],
    pub deep: [f32; 3],
    pub mid: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}
const GREEN: [f32; 3] = [0.56, 1.0, 0.62];
/// Where the middle ink sits on the way from full ink to the page.
const MID_AT: f32 = 0.45;
const LUMA: [f32; 3] = [0.2126, 0.7152, 0.0722];

/// The app theme by its `graphicsPalette` code (0 Искра … 6 Рассвет).
/// The light inks are the Step 5 hero's: one print across the step.
pub fn look(code: u32) -> Look {
    let print = |deep, mid| Look {
        light: true,
        glow: GREEN,
        deep,
        mid,
    };
    match Palette::from_code(code) {
        // Дюна: soft sepia, never orange.
        Palette::Light => print(rgb(110, 52, 18), rgb(162, 98, 52)),
        // Мираж: navy text ink, then cobalt dulled toward lilac.
        Palette::Mirage => print(rgb(38, 59, 107), rgb(93, 97, 162)),
        // Рассвет: plum text ink, then wine dulled toward copper.
        Palette::Dawn => print(rgb(96, 51, 70), rgb(140, 84, 79)),
        _ => Look {
            light: false,
            glow: GREEN,
            deep: [0.0; 3],
            mid: [0.0; 3],
        },
    }
}

/// One pixel of the dark scene engraved on `page`, as the shader's
/// `engrave` does it.
pub fn engrave(look: &Look, page: [f32; 3], dark: [f32; 3]) -> [f32; 3] {
    let level: f32 = (0..3).map(|i| dark[i] * LUMA[i]).sum();
    let g = (level / ENGRAVE_WHITE).clamp(0.0, 1.0).powf(ENGRAVE_GAMMA);
    let t = 1.0 - g;
    [0, 1, 2].map(|i| {
        let ink = if t < MID_AT {
            mix(look.deep[i], look.mid[i], t / MID_AT)
        } else {
            mix(look.mid[i], page[i], (t - MID_AT) / (1.0 - MID_AT))
        };
        ink.min(page[i])
    })
}

fn mix(a: f32, b: f32, t: f32) -> f32 {
    a * (1.0 - t) + b * t
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    #[test]
    fn the_loop_closes_without_a_jump() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        let before = compose(LOOP_SECONDS - 0.001);
        let after = compose(0.001);
        assert!(close(wrap_half(before.camera - after.camera), 0.0, 1e-4));
        assert!(close(before.pitch, after.pitch, 1e-4));
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
    }

    #[test]
    fn the_camera_turns_once_smoothly() {
        let mut turned = 0.0;
        let mut last = compose(0.0);
        for i in 1..=9000 {
            let f = compose(i as f32 * 0.01);
            let step = wrap_half(f.camera - last.camera);
            assert!(step > 0.0 && step < 2e-4, "{i} {step}");
            // Never faster than 1.5° a second.
            assert!((f.pitch - last.pitch).abs() < 2.7e-4, "{i}");
            assert!(f.pitch.abs() <= 15.0 * PI / 180.0 + 1e-5);
            turned += step;
            last = f;
        }
        assert!(close(turned, 1.0, 1e-3), "{turned}");
    }

    #[test]
    fn the_camera_faces_each_beat_at_its_peak() {
        for (beat, degrees) in PITCH_DEGREES.iter().enumerate() {
            let t = FIRST_BEAT + beat as f32 * BEAT_SECONDS + PEAK;
            let f = compose(t);
            assert_eq!(f.beat, beat);
            assert!(close(wrap_half(f.camera - f.centre), 0.0, 1e-5));
            assert!(close(f.pitch, degrees * PI / 180.0, 1e-5));
        }
        assert!(close(centre(1), RIPPLE_U, 1e-5));
    }

    #[test]
    fn every_beat_is_gone_before_the_next() {
        // The highest sky in view: the steepest pitch up and half the view's
        // height on a 3:2 frame.
        let top = 6.0 * PI / 180.0 + ((VIEW_DEGREES * PI / 360.0).tan() / 1.5).atan();
        let lasts = [
            gust_arrival(GUST_TO) + SWAY_SECONDS,
            RIPPLE_START + (RIPPLE_RINGS - 1) as f32 * RIPPLE_GAP + RIPPLE_REACH / RIPPLE_SPEED,
            10.8,
            ring_arrival(RING_FROM + 0.5) + RING_GLOW,
            ring_arrival(RING_FROM + 0.5) + MERIDIAN_REACH / MERIDIAN_SPEED + MERIDIAN_GLOW,
            star_arrival(top) + 2.5,
            SHOOT_START + 0.8,
        ];
        for last in lasts {
            assert!(last <= BEAT_QUIET, "{last}");
        }
        const { assert!(BEAT_QUIET < BEAT_SECONDS) };
        const { assert!(BEATS as f32 * BEAT_SECONDS == LOOP_SECONDS) };
    }

    #[test]
    fn the_gust_crosses_the_whole_view() {
        let view = |s: f32| wrap_half(camera(FIRST_BEAT + s) - centre(0));
        // It enters at the left edge and leaves past the right one.
        assert!(GUST_FROM <= view(GUST_START) - half_view() + 0.01);
        let out = gust_arrival(GUST_TO);
        assert!(GUST_TO >= view(out) + half_view());
    }

    #[test]
    fn the_ripple_stays_on_the_lake() {
        for i in 0..64 {
            let angle = i as f32 / 64.0 * TAU;
            let [u, latitude] = on_water(RIPPLE_REACH, angle);
            // Between the far shore (-23°) and the near rocks, around the
            // bright reflection in the middle of the panorama.
            assert!(latitude < -23.0 * PI / 180.0, "{angle} {latitude}");
            assert!(latitude > -50.0 * PI / 180.0, "{angle} {latitude}");
            assert!(u.abs() < 0.07, "{angle} {u}");
        }
        let [u, latitude] = on_water(0.0, 0.0);
        assert!(close(u, 0.0, 1e-6) && close(latitude, RIPPLE_LATITUDE, 1e-5));
    }

    #[test]
    fn the_bird_crosses_the_view_left_to_right() {
        let start = FIRST_BEAT + 2.0 * BEAT_SECONDS;
        let rel = |s: f32| {
            let f = compose(start + s);
            assert_eq!(f.beat, 2);
            wrap_half(f.bird[0] - f.camera)
        };
        assert!(rel(0.0) < -half_view());
        assert!(rel(10.8) > half_view());
        assert!(rel(5.0) > rel(4.0));
        for i in 0..=108 {
            let f = compose(start + i as f32 * 0.1);
            assert!((-1.0..=1.0).contains(&f.bird[2]), "{}", f.bird[2]);
            assert!((0.0..=1.0).contains(&f.bird[3]));
        }
        assert_eq!(compose(start + 11.0).bird[3], 0.0);
        assert_eq!(compose(start - 1.0).bird, [0.0; 4]);
    }

    #[test]
    fn the_still_shows_rings_on_the_water() {
        let f = compose(STILL);
        assert_eq!(f.beat, 1);
        let radii: Vec<f32> = (0..RIPPLE_RINGS)
            .filter_map(|k| ripple_radius(k, f.since))
            .collect();
        assert!(radii.len() >= 2, "{radii:?}");
        assert!(radii.iter().all(|r| *r < RIPPLE_REACH));
        // The drop's centre is in the view.
        assert!(wrap_half(f.camera - f.centre).abs() < half_view() * 0.5);
    }

    #[test]
    fn the_ring_meets_itself_behind_the_viewer() {
        assert!(close(ring_arrival(RING_FROM), RING_START, 1e-6));
        let behind = ring_arrival(RING_FROM + 0.5);
        for i in 1..50 {
            let rel = RING_FROM + i as f32 / 100.0;
            assert!(ring_arrival(rel) > RING_START && ring_arrival(rel) <= behind + 1e-4);
            assert!(close(
                ring_arrival(rel),
                ring_arrival(2.0 * RING_FROM - rel),
                1e-3
            ));
        }
    }

    #[test]
    fn every_theme_has_a_look() {
        for code in 0..7 {
            let l = look(code);
            assert_eq!(l.light, Palette::from_code(code).is_light());
            assert!(l.glow.iter().all(|c| (0.0..=1.0).contains(c)));
        }
        assert!(!look(255).light);
    }

    #[test]
    fn the_engraving_keeps_the_page_and_never_outshines_it() {
        let pages = [
            (1, [250, 225, 143]),
            (5, [241, 223, 184]),
            (6, [243, 216, 199]),
        ];
        for (code, page) in pages {
            let page = page.map(|c| c as f32 / 255.0);
            let l = look(code);
            // The night is the page itself.
            assert_eq!(engrave(&l, page, [0.0; 3]), page);
            let mut last = f32::MAX;
            for step in 0..=20 {
                let v = step as f32 / 20.0;
                let ink = engrave(&l, page, [v * 0.4, v, v * 0.5]);
                assert!((0..3).all(|i| ink[i] <= page[i]), "{code} {v}");
                // Brighter in the night is deeper ink on the page.
                let level: f32 = (0..3).map(|i| ink[i] * LUMA[i]).sum();
                assert!(level <= last + 1e-5, "{code} {v}");
                last = level;
            }
            // The brightest tones are the deep ink, not black.
            assert_eq!(engrave(&l, page, [1.0; 3]), l.deep);
        }
    }
}
