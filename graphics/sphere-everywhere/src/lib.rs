//! «Везде», page 07 of Step 5 «Внешнее кольцо», the page «Позволь телу
//! запомнить». Art's long strip of places (a room, a street, a crowd, a
//! field) and a clear glass ball, the sphere of attention, that goes along.
//! The camera travels the strip and rests at each place; there the ball
//! rings: it trembles, a wave of light runs over the place (the body's
//! response) and a band of light stays on the glass (the body remembers).
//! In the field all four bands glow together. Then the strip curls into a
//! ring round the ball; the camera rises out of it and sees every place
//! round the one sphere at once. A light runs round the ring, the ring
//! turns the room to the front, and the strip unrolls into the room again.
//! Every value here is a pure function of loop time; `browser.rs` only
//! uploads it and the shader traces it.
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::SphereEverywhere;

/// The strip, px: one 6:1 painting, uploaded as two halves.
pub const SIZE: [u32; 2] = [6144, 1024];
pub const HALF: u32 = 3072;
pub const LOOP_SECONDS: f32 = 60.0;

/// The world is in strip px, y down like the painting. Flat, the strip
/// stands at z = RING facing the camera (−z); curled, it bends toward the
/// camera, and closed it is a ring of radius RING round the origin (its
/// length is one turn), where the ball floats.
pub const RING: f32 = SIZE[0] as f32 / TAU;
/// The camera's distance to the flat strip, and the tan of half the view's
/// height there: a window 960 px high on the 1024 px strip, 30° high.
pub const DISTANCE: f32 = 1878.0;
pub const VIEW_TAN: f32 = 480.0 / DISTANCE;
/// The view is 3:2; a narrower screen crops its sides.
pub const ASPECT: f32 = 1.5;
/// The strip's middle row. The horizon runs at one height all along it.
pub const MIDDLE: f32 = 512.0;

/// The ball's radius, and how far below the view's centre it sits as seen
/// against the flat strip, strip px.
pub const BALL_RADIUS: f32 = 75.0;
pub const BALL_BELOW: f32 = 80.0;
/// Glass: index of refraction and reflectance head on.
pub const IOR: f32 = 1.5;
pub const F0: f32 = 0.04;
/// Each band of memory on the glass is a line of latitude round an axis
/// tilted this far toward the camera, rad.
pub const BAND_LATITUDE: [f32; 4] = [-0.5, -0.17, 0.17, 0.5];
pub const TILT: f32 = 0.38;

/// The places, in the order the camera visits them: the strip column at
/// the view's centre while it rests there.
pub const ROOM: usize = 0;
pub const STREET: usize = 1;
pub const CROWD: usize = 2;
pub const FIELD: usize = 3;
pub const PLACES: usize = 4;
pub const PLACE_AT: [f32; PLACES] = [820.0, 2400.0, 3700.0, 5376.0];
/// Leaving one place and arriving at the next, s.
pub const TRAVEL: [[f32; 2]; PLACES - 1] = [[5.0, 11.0], [16.0, 22.0], [27.0, 33.0]];
/// When the ball rings at each place, s.
pub const RINGS: [f32; PLACES] = [2.0, 12.5, 23.5, 34.5];
/// The wave of light each ring sends over its place: px/s, s, px.
pub const WAVE_SPEED: f32 = 700.0;
pub const WAVE_LIFE: f32 = 2.6;
pub const WAVE_WIDTH: f32 = 70.0;
/// «Позволь телу запомнить»: all the bands glow and the ball hums.
pub const REMEMBER: [f32; 2] = [36.5, 38.0];
pub const HUSH: [f32; 2] = [40.0, 41.5];
/// The strip curls into the ring, the camera lifts out of it, the ring
/// turns the room to the front and a light runs round it once; the camera
/// comes back down and the strip unrolls in the room.
pub const CURL: [f32; 2] = [40.5, 44.5];
pub const LIFT: [f32; 2] = [41.0, 46.5];
pub const TURN: [f32; 2] = [44.5, 52.5];
pub const SCAN: [f32; 2] = [47.0, 51.0];
pub const LAND: [f32; 2] = [50.0, 55.5];
pub const UNCURL: [f32; 2] = [52.5, 56.0];
/// The bands fade as the loop comes back to the room.
pub const FORGET: [f32; 2] = [56.0, 59.5];
/// Reduced motion: the ring round the ball, every band lit.
pub const STILL: f32 = 46.7;

/// Lifted out, the camera is this far above and behind where it stood,
/// high enough to see the ball over the ring's near side, sees this much
/// wider, and looks this far below the ball's centre.
const RISE: f32 = 1600.0;
const BACK: f32 = 2000.0;
const RING_TAN: f32 = 0.32;
const LOOK_BELOW: f32 = 240.0;
/// In the ring the ball swells to hold every place round it and rises to
/// this height, where it sees the ring's far side, not the night below.
const GROW: f32 = 2.6;
const BALL_HIGH: f32 = 220.0;
/// Walking: the view bobs this much, whole steps a loop, at this speed.
const BOB: f32 = 6.0;
const STEPS: f32 = 110.0;
const WALK: f32 = 500.0;
/// Resting, the view leans in this much.
const SETTLE: f32 = 0.04;
/// The ball lags the camera's acceleration (s²), floats and breathes,
/// whole cycles a loop.
const LAG: f32 = 0.1;
const FLOAT: f32 = 4.0;
const FLOAT_TIMES: f32 = 4.0;
const BREATH: f32 = 0.015;
const BREATH_TIMES: f32 = 10.0;
/// The light that runs round the ring, px wide; a band flashes as it
/// passes the band's place, within this many px.
const SCAN_WIDTH: f32 = 260.0;
const SCAN_REACH: f32 = 500.0;
/// The strip seen from behind: how much of its painting shows, how much of
/// what lies beyond it shows through.
const BACK_LIGHT: f32 = 0.3;
const BACK_SEE: f32 = 0.7;
/// In the ring the ball shines: how much it brightens the places round it,
/// and how much light it holds itself.
const SHINE_ON_RING: f32 = 1.2;
const SHINE_IN_BALL: f32 = 0.3;
/// The strip's edges melt over this many px; closed, its two ends darken
/// toward the seam over this many.
const EDGE: f32 = 20.0;
const SEAM: f32 = 220.0;
/// How the dark scene engraves on a light page: the level that prints the
/// deepest ink, and the curve to it.
pub const ENGRAVE_WHITE: f32 = 0.6307;
pub const ENGRAVE_GAMMA: f32 = 0.75;

/// The shader's `u_geo`.
pub const GEOMETRY: [f32; 32] = [
    RING,
    SIZE[0] as f32,
    SIZE[1] as f32,
    HALF as f32,
    PLACE_AT[0],
    PLACE_AT[1],
    PLACE_AT[2],
    PLACE_AT[3],
    MIDDLE + BALL_BELOW,
    WAVE_SPEED,
    WAVE_LIFE,
    WAVE_WIDTH,
    IOR,
    F0,
    ENGRAVE_WHITE,
    ENGRAVE_GAMMA,
    BAND_LATITUDE[0],
    BAND_LATITUDE[1],
    BAND_LATITUDE[2],
    BAND_LATITUDE[3],
    TILT,
    SCAN_WIDTH,
    BACK_LIGHT,
    BACK_SEE,
    EDGE,
    SEAM,
    ASPECT,
    0.0,
    SHINE_ON_RING,
    SHINE_IN_BALL,
    0.0,
    0.0,
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    /// The strip column the camera faces, 0..SIZE[0].
    pub along: f32,
    /// 0 flat … 1 a closed ring.
    pub curl: f32,
    /// The camera, and the tan of half its view's height.
    pub eye: [f32; 4],
    /// Where it looks.
    pub target: [f32; 3],
    /// The ball's centre and radius.
    pub ball: [f32; 4],
    /// Seconds since each place's ring, negative before it.
    pub rang: [f32; PLACES],
    /// The light of each band on the glass.
    pub bands: [f32; PLACES],
    /// The ball's hum 0..1.
    pub hum: f32,
    /// The running light's strip column and its strength 0..1.
    pub scan: [f32; 2],
    /// How much the ball shines in the ring, 0..1.
    pub shine: f32,
    /// The loop's phase, 0..TAU.
    pub phase: f32,
}

/// Where the camera stands along the strip before wrapping, its speed and
/// acceleration from walking (the ring's turn moves no camera).
pub fn walk(t: f32) -> [f32; 3] {
    let mut at = [PLACE_AT[0], 0.0, 0.0];
    for (i, [a, b]) in TRAVEL.iter().enumerate() {
        let d = PLACE_AT[i + 1] - PLACE_AT[i];
        at[0] += d * ease(*a, *b, t);
        at[1] += d * ease_speed(*a, *b, t);
        at[2] += d * ease_accel(*a, *b, t);
    }
    at[0] += turn_length() * ease(TURN[0], TURN[1], t);
    at
}

/// From the field round to the room again.
fn turn_length() -> f32 {
    PLACE_AT[ROOM] + SIZE[0] as f32 - PLACE_AT[FIELD]
}

pub fn curl(t: f32) -> f32 {
    ease(CURL[0], CURL[1], t) - ease(UNCURL[0], UNCURL[1], t)
}

/// How far the camera has lifted out of the ring, 0..1.
pub fn lift(t: f32) -> f32 {
    ease(LIFT[0], LIFT[1], t) - ease(LAND[0], LAND[1], t)
}

/// How much the camera is under way, 0 resting … 1 walking.
fn moving(t: f32) -> f32 {
    TRAVEL
        .iter()
        .map(|[a, b]| smooth(a - 1.0, a + 0.5, t) * (1.0 - smooth(b - 0.5, b + 1.2, t)))
        .fold(0.0, f32::max)
}

/// The running light: its strip column and strength.
pub fn scan(t: f32, along: f32) -> [f32; 2] {
    let x = ((t - SCAN[0]) / (SCAN[1] - SCAN[0])).clamp(0.0, 1.0);
    let strength = smooth(0.0, 0.08, x) * (1.0 - smooth(0.92, 1.0, x));
    let column = (along + SIZE[0] as f32 * ease(0.0, 1.0, x)).rem_euclid(SIZE[0] as f32);
    [column, strength]
}

/// The band each place leaves on the glass.
pub fn band(place: usize, t: f32, scan: [f32; 2]) -> f32 {
    let ring = RINGS[place];
    let appear = smooth(ring + 0.1, ring + 0.6, t);
    let flash = 0.6 * smooth(ring + 0.1, ring + 0.5, t) * (-(t - ring - 0.5).max(0.0) / 0.7).exp();
    let remember = smooth(REMEMBER[0], REMEMBER[1], t);
    let gap = wrapped(scan[0] - PLACE_AT[place]);
    let passed = 0.5 * scan[1] * (-(gap / SCAN_REACH).powi(2)).exp();
    let forget = 1.0 - smooth(FORGET[0], FORGET[1], t);
    (appear * (0.5 + 0.4 * remember) + flash + passed) * forget
}

pub fn hum(t: f32) -> f32 {
    smooth(REMEMBER[0], REMEMBER[0] + 1.0, t) * (1.0 - smooth(HUSH[0], HUSH[1], t))
}

/// The shortest way between two strip columns on the closed ring.
fn wrapped(d: f32) -> f32 {
    let size = SIZE[0] as f32;
    (d + size / 2.0).rem_euclid(size) - size / 2.0
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let phase = time / LOOP_SECONDS * TAU;
    let [walked, speed, accel] = walk(time);
    let along = walked.rem_euclid(SIZE[0] as f32);
    let curl = curl(time);
    let lift = lift(time);
    // Walking bobs the view; resting, it leans in a little.
    let step = (speed.abs() / WALK).min(1.0);
    let up = MIDDLE + BOB * step * (STEPS * phase).sin();
    let tan = VIEW_TAN * (1.0 - SETTLE * (1.0 - moving(time)));
    // The ball goes along a little behind the camera, at the ring's centre.
    let swell = smooth(0.2, 1.0, lift);
    let below = up + BALL_BELOW * (DISTANCE - RING) / DISTANCE;
    let ball = [
        -LAG * accel,
        mix(below, BALL_HIGH, swell) + FLOAT * (FLOAT_TIMES * phase).sin(),
        0.0,
        BALL_RADIUS * (1.0 + BREATH * (BREATH_TIMES * phase).sin()) * mix(1.0, GROW, swell),
    ];
    // Lifting, it rises above the strip's top before it backs out over it,
    // and keeps the ball in view: what it looks at comes to the ball's
    // depth first, while that hardly turns the view.
    let rise = smooth(0.0, 0.7, lift);
    let back = smooth(0.3, 1.0, lift);
    let turn = smooth(0.0, 1.0, lift);
    let eye = [
        0.0,
        up - RISE * rise,
        RING - DISTANCE - BACK * back,
        mix(tan, RING_TAN, turn),
    ];
    let target = [
        0.0,
        mix(up, ball[1] + LOOK_BELOW, turn),
        mix(RING, 0.0, smooth(0.0, 0.35, lift)),
    ];
    let scan = scan(time, along);
    Frame {
        time,
        along,
        curl,
        eye,
        target,
        ball,
        rang: RINGS.map(|ring| time - ring),
        bands: [ROOM, STREET, CROWD, FIELD].map(|place| band(place, time, scan)),
        hum: hum(time),
        scan,
        shine: smooth(0.3, 1.0, lift),
        phase,
    }
}

/// How one theme prints the scene: dark themes keep the painting's own
/// green, which the theme's recolor maps; light themes engrave it on the
/// page in two muted inks, the brightest tones deepest.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub light: bool,
    /// The light the ball and the waves add, in the painting's own green.
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

/// Quintic: still at both ends in speed and acceleration.
fn ease(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * t * (t * (6.0 * t - 15.0) + 10.0)
}
fn ease_speed(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    30.0 * t * t * (t - 1.0) * (t - 1.0) / (b - a)
}
fn ease_accel(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    60.0 * t * (2.0 * t - 1.0) * (t - 1.0) / ((b - a) * (b - a))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }
    fn times() -> impl Iterator<Item = f32> {
        (0..=6000).map(|i| i as f32 * 0.01)
    }

    #[test]
    fn the_loop_closes_without_a_jump() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        let before = compose(LOOP_SECONDS - 0.001);
        let after = compose(0.001);
        assert!(close(before.along, after.along, 1e-2));
        assert!((0..4).all(|i| close(before.eye[i], after.eye[i], 1e-2)));
        assert!((0..4).all(|i| close(before.ball[i], after.ball[i], 0.1)));
        assert!((0..PLACES).all(|i| close(before.bands[i], after.bands[i], 1e-3)));
        assert_eq!(before.curl, 0.0);
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
    }

    #[test]
    fn the_turn_brings_the_room_back_to_the_front() {
        assert!(close(
            walk(LOOP_SECONDS)[0] - SIZE[0] as f32,
            PLACE_AT[ROOM],
            1e-2
        ));
        // Only the closed ring may wrap the strip's ends round.
        let mut last = compose(0.0);
        for t in times() {
            let f = compose(t);
            if (f.along - last.along).abs() > SIZE[0] as f32 / 2.0 {
                assert_eq!(f.curl, 1.0, "{t}");
            }
            if (TURN[0]..=TURN[1]).contains(&t) {
                assert_eq!(f.curl, 1.0, "{t}");
            }
            last = f;
        }
    }

    #[test]
    fn flat_the_view_stays_on_the_strip() {
        for t in times() {
            let f = compose(t);
            if f.curl > 0.0 || lift(t) > 0.0 {
                continue;
            }
            // Looking straight at the strip.
            assert_eq!(f.target[1], f.eye[1]);
            let half_high = f.eye[3] * DISTANCE;
            let half_wide = half_high * ASPECT;
            assert!(
                f.eye[1] - half_high >= 0.0 && f.eye[1] + half_high <= SIZE[1] as f32,
                "{t}"
            );
            assert!(
                f.along - half_wide >= 0.0 && f.along + half_wide <= SIZE[0] as f32,
                "{t}"
            );
        }
    }

    #[test]
    fn the_camera_never_passes_through_the_strip() {
        for t in times() {
            let f = compose(t);
            let [x, y, z, _] = f.eye;
            if y < -EDGE || y > SIZE[1] as f32 + EDGE {
                continue;
            }
            // Within the strip's height the camera stays on its painted
            // side, inside the circle it bends along, well off the surface.
            let k = f.curl / RING;
            let local = [x, z - RING];
            if k == 0.0 {
                assert!(local[1] < -500.0, "{t}");
            } else {
                let off = (local[0].powi(2) + (local[1] + 1.0 / k).powi(2)).sqrt();
                assert!(off < 1.0 / k - 50.0, "{t} {off} {}", 1.0 / k);
            }
        }
    }

    #[test]
    fn each_place_rings_while_the_view_rests_on_it() {
        for (place, ring) in RINGS.iter().enumerate() {
            for i in 0..=26 {
                let t = ring + i as f32 * WAVE_LIFE / 26.0;
                let f = compose(t);
                assert!(close(f.along, PLACE_AT[place], 1e-3), "{place} {t}");
                assert_eq!(f.curl, 0.0);
                assert_eq!(lift(t), 0.0);
                assert!(close(f.ball[0], 0.0, 1e-3));
            }
        }
        // The rings come in the order of the places, each after arriving.
        for (i, [_, arrive]) in TRAVEL.iter().enumerate() {
            assert!(RINGS[i] + WAVE_LIFE <= TRAVEL[i][0]);
            assert!(*arrive < RINGS[i + 1]);
        }
        const { assert!(RINGS[FIELD] + WAVE_LIFE <= CURL[0]) };
    }

    #[test]
    fn the_body_remembers_each_place_then_lets_go() {
        for (place, &ring) in RINGS.iter().enumerate() {
            assert_eq!(compose(ring).bands[place], band(place, ring, [0.0, 0.0]));
            assert!(compose(ring - 0.01).bands[place] < 0.02, "{place}");
            assert!(compose(ring + 1.5).bands[place] >= 0.5, "{place}");
            assert_eq!(compose(0.0).bands[place], 0.0);
            assert_eq!(compose(FORGET[1]).bands[place], 0.0);
        }
        // «Позволь телу запомнить»: every band glows, the ball hums.
        for i in 0..=20 {
            let t = REMEMBER[1] + (HUSH[0] - REMEMBER[1]) * i as f32 / 20.0;
            let f = compose(t);
            assert!(f.bands.iter().all(|b| *b >= 0.85), "{t}");
            assert_eq!(f.hum, 1.0);
        }
        // The light passes every place once round the ring.
        for (place, &at) in PLACE_AT.iter().enumerate() {
            let best = times()
                .map(|t| compose(t).scan)
                .filter(|s| s[1] > 0.5)
                .map(|s| wrapped(s[0] - at).abs())
                .fold(f32::MAX, f32::min);
            assert!(best < 40.0, "{place} {best}");
        }
    }

    #[test]
    fn the_ball_stays_near_the_middle_and_everything_moves_gently() {
        let mut last = compose(0.0);
        let mut walked = walk(0.0)[0];
        for t in times() {
            let f = compose(t);
            assert!(f.ball[0].abs() < 40.0, "{t}");
            // At 100 frames a second.
            let w = walk(t)[0];
            assert!((w - walked).abs() < 9.0, "{t}");
            walked = w;
            assert!(
                (0..3).all(|i| (f.eye[i] - last.eye[i]).abs() < 18.0),
                "{t} {:?} {:?}",
                f.eye,
                last.eye
            );
            assert!(
                (0..3).all(|i| (f.target[i] - last.target[i]).abs() < 24.0),
                "{t}"
            );
            assert!((f.curl - last.curl).abs() < 0.01, "{t}");
            last = f;
        }
    }

    #[test]
    fn the_still_is_the_ring_round_the_ball() {
        let f = compose(STILL);
        assert_eq!(f.curl, 1.0);
        assert_eq!(lift(STILL), 1.0);
        assert!(f.bands.iter().all(|b| *b >= 0.85));
        assert_eq!(f.scan[1], 0.0);
        // The swollen ball stays well inside the ring and is seen over its
        // near side, not through it.
        let [x, y, z, r] = f.ball;
        assert!((x * x + z * z).sqrt() + r < 0.5 * RING);
        assert!(y - r > 0.0 && y + r < SIZE[1] as f32);
        let lead = (-RING - f.eye[2]) / (z - f.eye[2]);
        let over = f.eye[1] + (y + r - f.eye[1]) * lead;
        assert!(over < -60.0, "{over}");
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
            assert_eq!(engrave(&l, page, [0.0; 3]), page);
            let mut last = f32::MAX;
            for step in 0..=20 {
                let v = step as f32 / 20.0;
                let ink = engrave(&l, page, [v * 0.4, v, v * 0.5]);
                assert!((0..3).all(|i| ink[i] <= page[i]), "{code} {v}");
                let level: f32 = (0..3).map(|i| ink[i] * LUMA[i]).sum();
                assert!(level <= last + 1e-5, "{code} {v}");
                last = level;
            }
            assert_eq!(engrave(&l, page, [1.0; 3]), l.deep);
        }
    }
}
