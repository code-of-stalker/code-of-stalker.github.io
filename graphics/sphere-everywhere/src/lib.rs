//! «Везде», page 07 of Step 5 «Внешнее кольцо», the page «Позволь телу
//! запомнить». Art's long strip of places (a room, a street, a crowd, a
//! field) closed into a ring, and a clear glass ball, the sphere of
//! attention, floating at its centre. The camera looks down over the ring
//! at the ball and the place behind it. At first only the room is lit; the
//! ring turns each next place round to the ball, and there the ball rings:
//! it trembles and a wave of light runs over the place and leaves it lit
//! (the body's response, remembered). With every place lit the camera
//! rises to see them all round the one sphere, a light runs round the
//! ring, and the seam where the strip's ends meet heals. Then the camera
//! comes back down to the room and the other places sink into the dark.
//! Every value here is a pure function of loop time; `browser.rs` only
//! uploads it and the shader traces it.
use std::f32::consts::{PI, TAU};
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::SphereEverywhere;

/// The strip, px: one 6:1 painting, uploaded as two halves.
pub const SIZE: [u32; 2] = [6144, 1024];
pub const HALF: u32 = 3072;
pub const LOOP_SECONDS: f32 = 60.0;

/// The world is in strip px, y down like the painting. The strip is a ring
/// of radius RING round the origin (its length is one turn), its painting
/// facing in, its top at y = 0; the ball floats at the centre.
pub const RING: f32 = SIZE[0] as f32 / TAU;
/// The view is 3:2; a narrower screen crops its sides.
pub const ASPECT: f32 = 1.5;

/// The ball's centre height and radius.
pub const BALL_HIGH: f32 = 220.0;
pub const BALL_RADIUS: f32 = 195.0;
/// Glass: index of refraction and reflectance head on.
pub const IOR: f32 = 1.5;
pub const F0: f32 = 0.04;

/// The places, in the order the ring brings them to the ball: the strip
/// column behind the ball while it rests there.
pub const ROOM: usize = 0;
pub const STREET: usize = 1;
pub const CROWD: usize = 2;
pub const FIELD: usize = 3;
pub const PLACES: usize = 4;
pub const PLACE_AT: [f32; PLACES] = [820.0, 2400.0, 3700.0, 5376.0];
/// Where one place gives way to the next, halfway between them, and over
/// how many px.
pub const BORDERS: [f32; PLACES - 1] = [
    (PLACE_AT[0] + PLACE_AT[1]) / 2.0,
    (PLACE_AT[1] + PLACE_AT[2]) / 2.0,
    (PLACE_AT[2] + PLACE_AT[3]) / 2.0,
];
const BORDER_SOFT: f32 = 250.0;
/// How much of an unlit place shows.
const DIM: f32 = 0.35;
/// The ring turning each next place to the ball, s.
pub const TURNS: [[f32; 2]; PLACES - 1] = [[6.0, 11.0], [14.5, 19.5], [23.0, 28.0]];
/// When the ball rings at each place, s.
pub const RINGS: [f32; PLACES] = [1.5, 11.5, 20.0, 28.5];
/// The wave of light each ring sends over its place: the row it starts
/// from, px/s, s, px.
pub const WAVE_ROW: f32 = 592.0;
pub const WAVE_SPEED: f32 = 700.0;
pub const WAVE_LIFE: f32 = 2.6;
pub const WAVE_WIDTH: f32 = 70.0;
/// «Позволь телу запомнить»: the camera rises over the whole ring and the
/// ball hums; meanwhile the ring turns the long way from the field round
/// to the room again.
pub const RISE: [f32; 2] = [30.0, 37.0];
pub const REMEMBER: [f32; 2] = [30.0, 31.0];
pub const HUSH: [f32; 2] = [38.0, 39.5];
pub const HOME: [f32; 2] = [31.5, 58.0];
/// «Перепроверяй себя»: a light runs round the ring once.
pub const SCAN: [f32; 2] = [39.0, 45.0];
/// «Целостность и Неделимость»: the seam heals with a flash.
pub const HEAL: [f32; 2] = [46.0, 49.0];
/// «Снова в комнате»: the camera comes down, the other places dim, the
/// seam opens again.
pub const DESCEND: [f32; 2] = [51.0, 59.0];
pub const FORGET: [f32; 2] = [53.0, 58.0];
pub const OPEN: [f32; 2] = [56.0, 59.0];
/// Reduced motion: the whole ring round the ball, every place lit.
pub const STILL: f32 = 49.0;

/// The camera low over the ring and risen over it: its height (up is
/// negative y), its distance in front of the centre and the tan of half
/// its view's height; and how far below the ball's centre and how far
/// behind it it looks. Each place that rings lifts it a step of the way.
const NEAR: [f32; 3] = [-800.0, -2300.0, 0.29];
const WIDE: [f32; 3] = [-1088.0, -2900.0, 0.32];
const LOOK_NEAR: [f32; 2] = [230.0, 80.0];
const LOOK_WIDE: [f32; 2] = [240.0, 0.0];
const STEP: f32 = 0.2;
/// The camera sways side to side once a loop, px.
const SWAY: f32 = 120.0;
/// The ball floats and breathes, whole cycles a loop.
const FLOAT: f32 = 4.0;
const FLOAT_TIMES: f32 = 4.0;
const BREATH: f32 = 0.015;
const BREATH_TIMES: f32 = 10.0;
/// The light that runs round the ring, px wide.
const SCAN_WIDTH: f32 = 260.0;
/// The strip seen from behind: how much of its painting shows, how much of
/// what lies beyond it shows through.
const BACK_LIGHT: f32 = 0.3;
const BACK_SEE: f32 = 0.7;
/// The ball shines as the places light: how much it brightens the places
/// round it, and how much light it holds itself.
const SHINE_ON_RING: f32 = 1.2;
const SHINE_IN_BALL: f32 = 0.3;
/// The strip's edges melt over this many px; while the seam is open its
/// two ends darken toward it over this many.
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
    WAVE_ROW,
    WAVE_SPEED,
    WAVE_LIFE,
    WAVE_WIDTH,
    IOR,
    F0,
    ENGRAVE_WHITE,
    ENGRAVE_GAMMA,
    BORDERS[0],
    BORDERS[1],
    BORDERS[2],
    BORDER_SOFT,
    DIM,
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
    /// The strip column behind the ball, 0..SIZE[0].
    pub along: f32,
    /// The camera, and the tan of half its view's height.
    pub eye: [f32; 4],
    /// Where it looks.
    pub target: [f32; 3],
    /// The ball's centre and radius.
    pub ball: [f32; 4],
    /// Seconds since each place's ring, negative before it.
    pub rang: [f32; PLACES],
    /// How lit each place is, 0..1; the shader spreads it with the wave.
    pub lit: [f32; PLACES],
    /// The ball's hum 0..1.
    pub hum: f32,
    /// The running light's strip column and its strength 0..1.
    pub scan: [f32; 2],
    /// How much the ball shines, 0..1.
    pub shine: f32,
    /// 1 while the seam is open … 0 healed, and its flash as it heals.
    pub seam: f32,
    pub flash: f32,
    /// The loop's phase, 0..TAU.
    pub phase: f32,
}

/// How far the ring has turned before wrapping: the strip column behind
/// the ball.
pub fn turned(t: f32) -> f32 {
    let mut at = PLACE_AT[ROOM];
    for (i, [a, b]) in TURNS.iter().enumerate() {
        at += (PLACE_AT[i + 1] - PLACE_AT[i]) * ease(*a, *b, t);
    }
    at + home_length() * ease(HOME[0], HOME[1], t)
}

/// From the field round to the room again.
fn home_length() -> f32 {
    PLACE_AT[ROOM] + SIZE[0] as f32 - PLACE_AT[FIELD]
}

/// How far the camera has risen, 0 low over the room … 1 over the ring.
pub fn risen(t: f32) -> f32 {
    let steps: f32 = TURNS.iter().map(|[a, b]| STEP * ease(*a, *b, t)).sum();
    steps + (1.0 - STEP * TURNS.len() as f32) * ease(RISE[0], RISE[1], t)
        - ease(DESCEND[0], DESCEND[1], t)
}

/// The room is always lit; every other place lights as it rings and sinks
/// back into the dark at the end.
pub fn lit(place: usize, t: f32) -> f32 {
    if place == ROOM {
        return 1.0;
    }
    let ring = RINGS[place];
    smooth(ring, ring + 0.4, t) * (1.0 - smooth(FORGET[0], FORGET[1], t))
}

/// The running light: its strip column and strength.
pub fn scan(t: f32, along: f32) -> [f32; 2] {
    let x = ((t - SCAN[0]) / (SCAN[1] - SCAN[0])).clamp(0.0, 1.0);
    let strength = smooth(0.0, 0.08, x) * (1.0 - smooth(0.92, 1.0, x));
    let column = (along + SIZE[0] as f32 * ease(0.0, 1.0, x)).rem_euclid(SIZE[0] as f32);
    [column, strength]
}

pub fn hum(t: f32) -> f32 {
    smooth(REMEMBER[0], REMEMBER[1], t) * (1.0 - smooth(HUSH[0], HUSH[1], t))
}

pub fn seam(t: f32) -> f32 {
    1.0 - ease(HEAL[0], HEAL[1], t) + ease(OPEN[0], OPEN[1], t)
}

fn flash(t: f32) -> f32 {
    let x = ((t - HEAL[0]) / (HEAL[1] - HEAL[0])).clamp(0.0, 1.0);
    (PI * x).sin().max(0.0)
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let phase = time / LOOP_SECONDS * TAU;
    let along = turned(time).rem_euclid(SIZE[0] as f32);
    let w = risen(time);
    let ball = [
        0.0,
        BALL_HIGH + FLOAT * (FLOAT_TIMES * phase).sin(),
        0.0,
        BALL_RADIUS * (1.0 + BREATH * (BREATH_TIMES * phase).sin()),
    ];
    let eye = [
        SWAY * phase.sin(),
        mix(NEAR[0], WIDE[0], w),
        mix(NEAR[1], WIDE[1], w),
        mix(NEAR[2], WIDE[2], w),
    ];
    let target = [
        0.0,
        BALL_HIGH + mix(LOOK_NEAR[0], LOOK_WIDE[0], w),
        mix(LOOK_NEAR[1], LOOK_WIDE[1], w),
    ];
    let lit = [ROOM, STREET, CROWD, FIELD].map(|place| lit(place, time));
    Frame {
        time,
        along,
        eye,
        target,
        ball,
        rang: RINGS.map(|ring| time - ring),
        lit,
        hum: hum(time),
        scan: scan(time, along),
        shine: lit.iter().sum::<f32>() / PLACES as f32,
        seam: seam(time),
        flash: flash(time),
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

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }
    fn times() -> impl Iterator<Item = f32> {
        (0..=6000).map(|i| i as f32 * 0.01)
    }
    /// The shortest way between two strip columns round the ring.
    fn wrapped(d: f32) -> f32 {
        let size = SIZE[0] as f32;
        (d + size / 2.0).rem_euclid(size) - size / 2.0
    }

    #[test]
    fn the_loop_closes_without_a_jump() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        let before = compose(LOOP_SECONDS - 0.001);
        let after = compose(0.001);
        assert!(close(wrapped(before.along - after.along), 0.0, 1e-2));
        assert!((0..4).all(|i| close(before.eye[i], after.eye[i], 0.1)));
        assert!((0..3).all(|i| close(before.target[i], after.target[i], 1e-2)));
        assert!((0..4).all(|i| close(before.ball[i], after.ball[i], 0.1)));
        assert!((0..PLACES).all(|i| close(before.lit[i], after.lit[i], 1e-3)));
        assert!(close(before.seam, after.seam, 1e-3));
        assert!(close(before.shine, after.shine, 1e-3));
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
    }

    #[test]
    fn the_ring_turns_each_place_to_the_ball_and_the_room_back() {
        assert!(close(
            turned(LOOP_SECONDS) - SIZE[0] as f32,
            PLACE_AT[ROOM],
            1e-2
        ));
        for (place, ring) in RINGS.iter().enumerate() {
            // The ring rests while its place rings and the wave runs out.
            for i in 0..=26 {
                let t = ring + i as f32 * WAVE_LIFE / 26.0;
                assert!(
                    close(compose(t).along, PLACE_AT[place], 1e-3),
                    "{place} {t}"
                );
            }
        }
        // The rings come in the order of the places, each after arriving.
        for (i, [_, arrive]) in TURNS.iter().enumerate() {
            assert!(RINGS[i] + WAVE_LIFE <= TURNS[i][0]);
            assert!(*arrive < RINGS[i + 1]);
        }
        const { assert!(RINGS[FIELD] + WAVE_LIFE <= HOME[0]) };
    }

    #[test]
    fn the_camera_stays_above_and_outside_the_ring() {
        for t in times() {
            let f = compose(t);
            let [x, y, z, _] = f.eye;
            assert!(y < -EDGE, "{t}");
            assert!((x * x + z * z).sqrt() > RING + 500.0, "{t}");
        }
    }

    #[test]
    fn the_ball_is_seen_over_the_near_side_not_through_it() {
        for t in times() {
            let f = compose(t);
            let [_, y, z, r] = f.ball;
            let [_, ey, ez, _] = f.eye;
            // The sight line to the ball's lowest point crosses the near
            // side above its top edge.
            let lead = (-RING - ez) / (z - ez);
            let over = ey + (y + r - ey) * lead;
            assert!(over < -60.0, "{t} {over}");
            assert!(y - r > 0.0 && y + r < SIZE[1] as f32);
            assert!(r < 0.5 * RING);
        }
    }

    #[test]
    fn each_place_lights_as_it_rings_and_dims_at_the_end() {
        for t in times() {
            assert_eq!(compose(t).lit[ROOM], 1.0);
        }
        for (place, &ring) in RINGS.iter().enumerate().skip(1) {
            assert_eq!(compose(0.0).lit[place], 0.0);
            assert_eq!(compose(ring).lit[place], 0.0, "{place}");
            assert_eq!(compose(ring + 0.4).lit[place], 1.0, "{place}");
            assert_eq!(compose(FORGET[0]).lit[place], 1.0, "{place}");
            assert_eq!(compose(FORGET[1]).lit[place], 0.0, "{place}");
        }
        // «Позволь телу запомнить»: every place lit, the camera over the
        // whole ring, the ball shining and humming.
        for i in 0..=20 {
            let t = RISE[1] + (HUSH[0] - RISE[1]) * i as f32 / 20.0;
            let f = compose(t);
            assert!(f.lit.iter().all(|l| *l == 1.0), "{t}");
            assert_eq!(risen(t), 1.0);
            assert_eq!(f.shine, 1.0);
            assert_eq!(f.hum, 1.0);
        }
        // The ball fills with light place by place.
        let mut last = 0.0;
        for t in times().filter(|t| *t < FORGET[0]) {
            let s = compose(t).shine;
            assert!(s >= last, "{t}");
            last = s;
        }
    }

    #[test]
    fn the_light_runs_round_once_and_the_seam_heals() {
        for (place, &at) in PLACE_AT.iter().enumerate() {
            let best = times()
                .map(|t| compose(t).scan)
                .filter(|s| s[1] > 0.5)
                .map(|s| wrapped(s[0] - at).abs())
                .fold(f32::MAX, f32::min);
            assert!(best < 40.0, "{place} {best}");
        }
        assert_eq!(compose(0.0).seam, 1.0);
        assert_eq!(compose(HEAL[1]).seam, 0.0);
        assert_eq!(compose(OPEN[0]).seam, 0.0);
        assert!(compose((HEAL[0] + HEAL[1]) / 2.0).flash > 0.99);
        assert!(times()
            .filter(|t| !(HEAL[0]..=HEAL[1]).contains(t))
            .all(|t| compose(t).flash == 0.0));
    }

    #[test]
    fn everything_moves_gently() {
        let mut last = compose(0.0);
        for t in times() {
            let f = compose(t);
            // At 100 frames a second.
            assert!(wrapped(f.along - last.along).abs() < 7.0, "{t}");
            assert!(
                (0..3).all(|i| (f.eye[i] - last.eye[i]).abs() < 3.0),
                "{t} {:?} {:?}",
                f.eye,
                last.eye
            );
            assert!(
                (0..3).all(|i| (f.target[i] - last.target[i]).abs() < 3.0),
                "{t}"
            );
            assert!((f.seam - last.seam).abs() < 0.01, "{t}");
            last = f;
        }
    }

    #[test]
    fn the_still_is_the_whole_ring_round_the_ball() {
        let f = compose(STILL);
        assert_eq!(risen(STILL), 1.0);
        assert!(f.lit.iter().all(|l| *l == 1.0));
        assert_eq!(f.seam, 0.0);
        assert_eq!(f.scan[1], 0.0);
        assert!(f.flash < 1e-3);
        assert_eq!(f.hum, 0.0);
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
