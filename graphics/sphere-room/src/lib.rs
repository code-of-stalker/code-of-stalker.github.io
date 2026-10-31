//! «Скан комнаты», page 03 of Step 5 «Внешнее кольцо». Art's night room
//! becomes a cloud of points in 3D: each point sits where the depth map puts
//! that piece of the painting. A plane of light slides through the room and
//! wakes it; then, for each line of the page's list, it slides again in its
//! own direction and one layer of the room comes alive: sound, movement,
//! temperature, light and shadow, smells and pressure, the finest vibrations.
//! The head drifts a little and leans toward each layer. Every value here is
//! a pure function of loop time; `browser.rs` only uploads it and the
//! shaders paint it.
use std::f32::consts::{PI, TAU};
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::SphereRoom;

/// Art's painting and its depth map, in pixels.
pub const SIZE: [u32; 2] = [1536, 1024];
/// The painting's camera: a level pinhole one metre over the floor.
pub const FOCAL: f32 = 963.0;
pub const HORIZON: f32 = 448.0;
pub const CENTRE: f32 = 768.0;
/// Depth map: 16-bit disparity (1 / metres) over this range, in red and green.
pub const DISPARITY_MAX: f32 = 0.625;
/// The world outside the window, as far as the depth map goes.
pub const FAR: f32 = 14.0;
/// The window glass: the scanner meets the world outside here.
pub const GLASS: f32 = 3.45;
/// The room's box, metres: x left to right, y floor to ceiling, z near to the wall.
pub const ROOM_MIN: [f32; 3] = [-2.8, -1.0, 1.6];
pub const ROOM_MAX: [f32; 3] = [2.8, 1.7, 3.7];
/// The room breathes about this point under «давление».
pub const ROOM_CENTRE: [f32; 3] = [0.0, -0.2, 2.9];

/// One point for every `STRIDE` × `STRIDE` pixels of the painting.
pub const STRIDE: u32 = 4;
pub const COLUMNS: u32 = SIZE[0] / STRIDE;
pub const ROWS: u32 = SIZE[1] / STRIDE;
pub const POINTS: u32 = COLUMNS * ROWS;
/// A point's soft dot: its Gaussian width in point spacings, the sprite
/// drawn wide enough to hold it, and the gain that keeps the painting's
/// average brightness.
pub const DOT_SIGMA: f32 = 0.26;
pub const DOT_SPRITE: f32 = DOT_SIGMA * 5.66;
pub const DOT_GAIN: f32 = 1.0 / (TAU * DOT_SIGMA * DOT_SIGMA);
/// How bright the room is before the first sweep wakes it.
pub const DIM: f32 = 0.3;

pub const LOOP_SECONDS: f32 = 60.0;
/// The six lines of the list, 8 s each, after the opening phrase.
pub const BEATS: [f32; 6] = [7.0, 15.0, 23.0, 31.0, 39.0, 47.0];
/// The room settles and dims, so the next loop can wake it again.
pub const SETTLE: [f32; 2] = [55.5, 59.5];
/// Light left on a point after the plane passes: decay time, seconds.
pub const AFTERGLOW: f32 = 2.2;
/// The plane's band of light, metres.
pub const BAND: f32 = 0.07;
/// Sound fronts: metres a second, and how long one lives.
pub const SOUND_SPEED: f32 = 1.0;
pub const SOUND_LIFE: f32 = 4.5;

/// The camera never sees past the painting: a small zoom, a short drift and
/// a lean of a few degrees.
pub const ZOOM: f32 = 1.08;
pub const LEAN: f32 = 0.13;
pub const PUSH: f32 = 0.12;
/// Reduced motion: the light-and-shadow line, its plane halfway along the
/// moonbeam, motes in the beam.
pub const STILL: f32 = 33.6;

/// The light themes engrave the scene: brightness up to this level
/// becomes ink, along this curve.
pub const ENGRAVE_WHITE: f32 = 0.9;
pub const ENGRAVE_GAMMA: f32 = 0.75;

/// A plane of light sliding through the room: along `axis` from `from` to
/// `to` metres; or, `sphere`, a shell growing around `axis` as a centre.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Sweep {
    pub start: f32,
    pub seconds: f32,
    pub axis: [f32; 3],
    pub sphere: bool,
    pub from: f32,
    pub to: f32,
}

const fn plane(start: f32, axis: [f32; 3], from: f32, to: f32) -> Sweep {
    Sweep {
        start,
        seconds: 3.5,
        axis,
        sphere: false,
        from,
        to,
    }
}

/// The moonbeam: from the middle of the window down to the lit patch on the
/// floor toward us, and its unit direction.
pub const BEAM: [[f32; 3]; 2] = [[-1.05, 0.48, GLASS], [-0.6, -1.0, 2.34]];
pub const BEAM_AXIS: [f32; 3] = [0.2364, -0.7773, -0.583];
/// The cup on the table, where the wisp rises.
pub const CUP: [f32; 3] = [0.79, -0.11, 2.93];
/// What moves in the air, points a draw: motes, the draft's streams and the
/// wisp (four dots a particle), the lattice (13 × 7 × 8).
pub const DUST: [u32; 4] = [900, 400 * 4, 150 * 4, 13 * 7 * 8];
/// The moon in the painting, pixels: the trees sway, it stays.
pub const MOON: [f32; 2] = [330.0, 178.0];
pub const SWEEPS: [Sweep; 7] = [
    // «Не анализируй — рассматривай»: from us to the far wall, waking the room.
    Sweep {
        start: 0.8,
        seconds: 4.0,
        axis: [0.0, 0.0, 1.0],
        sphere: false,
        from: 1.0,
        to: 4.0,
    },
    // Sounds: rising from the floor.
    plane(7.4, [0.0, 1.0, 0.0], -1.2, 1.8),
    // Movement: from the window across to the right.
    plane(15.4, [1.0, 0.0, 0.0], -2.9, 2.9),
    // Temperature: from the window wall toward us, with the draft.
    plane(23.4, [0.0, 0.0, -1.0], -3.8, -1.5),
    // Light and shadow: along the moonbeam.
    plane(31.4, BEAM_AXIS, -4.2, 0.55),
    // Smells and pressure: down from the ceiling.
    plane(39.4, [0.0, -1.0, 0.0], -1.8, 1.1),
    // The finest vibrations: a sphere growing from us through the room.
    Sweep {
        start: 47.4,
        seconds: 4.5,
        axis: [0.0, 0.0, 0.0],
        sphere: true,
        from: 1.4,
        to: 5.0,
    },
];

/// Where the head leans for the opening and for each line, and how much
/// closer it looks.
pub const FOCUS: [([f32; 3], f32); 7] = [
    ([0.0, -0.4, 3.0], 0.02),
    // The window: wind, voices, birds.
    ([-1.05, 0.47, 3.4], 0.05),
    // The curtain and the trees.
    ([-1.5, 0.2, 3.4], 0.04),
    // The floor where the draft runs.
    ([-0.3, -0.8, 2.5], 0.04),
    // The moonlit patch on the floor.
    ([-0.47, -0.99, 2.7], 0.06),
    // The cup.
    ([0.78, -0.17, 2.93], 0.08),
    // The whole room again.
    ([0.0, 0.1, 3.0], 0.0),
];
/// When each lean starts: the opening, then the beats.
const LEANS: [f32; 7] = [0.3, 7.0, 15.0, 23.0, 31.0, 39.0, 47.0];

/// Sound fronts under «все звуки»: where and when each starts.
pub const SOUNDS: [([f32; 3], f32); 3] = [
    // Wind and birds through the window.
    ([-1.05, 0.4, GLASS], 8.6),
    // A hum of some device along the right wall.
    ([1.9, 0.3, 3.5], 10.4),
    // Voices outside.
    ([-0.8, 0.2, GLASS], 12.2),
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    /// Loop time, for the shaders' own small motions.
    pub time: f32,
    /// Camera position, metres from the painting's eye.
    pub eye: [f32; 3],
    /// Turn right and look up, radians.
    pub yaw: f32,
    pub pitch: f32,
    pub zoom: f32,
    /// The opening plane's place along z: points nearer are awake.
    pub reveal: f32,
    /// 1 while the room is awake, easing to 0 as the loop closes.
    pub awake: f32,
    /// The sweep under way (or the last one) and the one before, whose
    /// light may still linger; seconds since each started.
    pub sweeps: [Sweep; 2],
    pub since: [f32; 2],
    /// Each list line's layer, 0..1: sounds, movement, temperature, light,
    /// smells and pressure, the finest vibrations.
    pub layers: [f32; 6],
    /// Sound fronts: age in seconds and strength.
    pub sounds: [[f32; 2]; 3],
    /// The room's scale about `ROOM_CENTRE` under «давление».
    pub breath: f32,
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
fn window(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

fn mix(a: f32, b: f32, t: f32) -> f32 {
    a * (1.0 - t) + b * t
}

/// How strongly a sweep lights its band `local` seconds after it starts:
/// it fades in and out at its ends. The shader takes the same curve for
/// the light each point keeps.
pub fn sweep_strength(sweep: &Sweep, local: f32) -> f32 {
    window(local, 0.0, 0.5, sweep.seconds - 0.5, sweep.seconds)
}

/// The sweep `back` places before the one that lights the room at `t`
/// (0: that one), and seconds since it started.
pub fn sweep_at(t: f32, back: usize) -> (Sweep, f32) {
    let n = SWEEPS.len();
    let latest = SWEEPS.iter().rposition(|s| s.start <= t).unwrap_or(n - 1) + n;
    let i = latest - back;
    let s = SWEEPS[i % n];
    let wrap = if t < SWEEPS[0].start { 1 } else { 0 } + usize::from(i < n);
    (s, t - s.start + LOOP_SECONDS * wrap as f32)
}

/// Layer `i`'s strength: on through its 8 s, overlapping the next a little.
pub fn layer(i: usize, t: f32) -> f32 {
    let b = BEATS[i];
    window(t, b + 0.6, b + 2.6, b + 7.4, b + 9.4)
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    // A slow drift of the head, whole cycles a loop.
    let phase = TAU * time / LOOP_SECONDS;
    let mut eye = [
        0.04 * phase.sin(),
        0.015 * (2.0 * phase + 0.6).sin(),
        0.03 * (phase + 1.3).sin(),
    ];
    let mut yaw = 0.006 * (phase + 2.0).sin();
    let mut pitch = 0.004 * (2.0 * phase + 1.0).sin();
    let mut zoom = ZOOM;
    for (start, (focus, closer)) in LEANS.iter().zip(FOCUS) {
        let w = window(time, start + 0.3, start + 3.0, start + 6.5, start + 9.0);
        let [x, y, z] = focus;
        let length = (x * x + y * y + z * z).sqrt();
        for i in 0..3 {
            eye[i] += w * PUSH * focus[i] / length;
        }
        yaw += w * LEAN * x.atan2(z);
        pitch += w * LEAN * y.atan2(x.hypot(z));
        zoom += w * closer;
    }
    let opening = SWEEPS[0];
    let reveal = mix(
        opening.from,
        opening.to,
        ((time - opening.start) / opening.seconds).clamp(0.0, 1.0),
    );
    let awake = 1.0 - smooth(SETTLE[0], SETTLE[1], time);
    let [(now, now_since), (before, before_since)] = [0, 1].map(|back| sweep_at(time, back));
    let layers = [0, 1, 2, 3, 4, 5].map(|i| layer(i, time));
    let sounds = SOUNDS.map(|(_, at)| {
        let age = time - at;
        let strength = if age > 0.0 {
            smooth(0.0, 0.4, age) * (1.0 - smooth(SOUND_LIFE - 2.0, SOUND_LIFE, age))
        } else {
            0.0
        };
        [age, strength]
    });
    // Two slow breaths of the whole room under «давление».
    let breath = 1.0 + 0.018 * layers[4] * (TAU * (time - BEATS[4] - 0.6) / 4.0).sin();
    Frame {
        time,
        eye,
        yaw,
        pitch,
        zoom,
        reveal,
        awake,
        sweeps: [now, before],
        since: [now_since, before_since],
        layers,
        sounds,
        breath,
    }
}

/// Metres to a point from its depth map bytes, as the shaders read them.
pub fn depth(red: u8, green: u8) -> f32 {
    let q = f32::from(u16::from(red) << 8 | u16::from(green)) / 65535.0;
    1.0 / (q * DISPARITY_MAX).max(1.0 / FAR)
}

/// The painting pixel (column, row) and depth of a world point, as the
/// painting's own camera sees it.
pub fn painting(point: [f32; 3]) -> [f32; 2] {
    let [x, y, z] = point;
    [CENTRE + FOCAL * x / z, HORIZON - FOCAL * y / z]
}

/// Where a world point lands on the screen, -1..1 both ways, as the
/// shaders project it.
pub fn project(f: &Frame, point: [f32; 3]) -> [f32; 2] {
    let q = [0, 1, 2].map(|i| point[i] - f.eye[i]);
    let (sy, cy) = f.yaw.sin_cos();
    let (sp, cp) = f.pitch.sin_cos();
    let x = cy * q[0] - sy * q[2];
    let z1 = sy * q[0] + cy * q[2];
    let y = cp * q[1] - sp * z1;
    let z = sp * q[1] + cp * z1;
    let [column, row] = painting([x, y, z]);
    [
        (column / SIZE[0] as f32 * 2.0 - 1.0) * f.zoom,
        (1.0 - row / SIZE[1] as f32 * 2.0) * f.zoom,
    ]
}

/// The world direction through a point of the view (-1..1 both ways), as
/// the scanner's sheet casts it.
pub fn view_ray(f: &Frame, ndc: [f32; 2]) -> [f32; 3] {
    let column = CENTRE + ndc[0] / f.zoom * SIZE[0] as f32 * 0.5;
    let row = SIZE[1] as f32 * 0.5 - ndc[1] / f.zoom * SIZE[1] as f32 * 0.5;
    let (x, y, z) = ((column - CENTRE) / FOCAL, (HORIZON - row) / FOCAL, 1.0);
    let (sy, cy) = f.yaw.sin_cos();
    let (sp, cp) = f.pitch.sin_cos();
    // Undo the pitch, then the yaw.
    let y1 = cp * y + sp * z;
    let z1 = -sp * y + cp * z;
    [cy * x + sy * z1, y1, -sy * x + cy * z1]
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub light: bool,
    /// The scanner's light, in the painting's own green.
    pub glow: [f32; 3],
    pub deep: [f32; 3],
    pub mid: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}
const GREEN: [f32; 3] = [0.56, 1.0, 0.62];
/// Where the middle ink sits on the way from full ink to the page.
pub const MID_AT: f32 = 0.45;
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

/// The furthest the head turns or tilts.
pub const MAX_TURN: f32 = 3.5 * PI / 180.0;

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    fn corners() -> impl Iterator<Item = [f32; 3]> {
        (0..8).map(|i| {
            [0, 1, 2].map(|k| {
                if i >> k & 1 == 0 {
                    ROOM_MIN[k]
                } else {
                    ROOM_MAX[k]
                }
            })
        })
    }

    #[test]
    fn the_loop_closes_without_a_jump() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
        let before = compose(LOOP_SECONDS - 0.001);
        let after = compose(0.001);
        for i in 0..3 {
            assert!(close(before.eye[i], after.eye[i], 1e-4), "{i}");
        }
        assert!(close(before.yaw, after.yaw, 1e-4));
        assert!(close(before.pitch, after.pitch, 1e-4));
        assert!(close(before.zoom, after.zoom, 1e-4));
        assert!(close(before.breath, after.breath, 1e-6));
        // Every layer and sound is off across the seam.
        for f in [before, after] {
            assert!(f.layers.iter().all(|&l| l == 0.0), "{f:?}");
            assert!(f.sounds.iter().all(|s| s[1] == 0.0), "{f:?}");
        }
    }

    #[test]
    fn the_room_sleeps_across_the_seam_and_the_opening_wakes_it() {
        // At the seam every point is dim: the plane has not reached the
        // nearest point yet, and the closing room is asleep.
        let start = compose(0.0);
        assert!(start.reveal + 0.2 < ROOM_MIN[2]);
        assert!(compose(LOOP_SECONDS - 0.4).awake < 1e-4);
        // After the opening the plane is past the glass, everything awake.
        let woken = compose(SWEEPS[0].start + SWEEPS[0].seconds + 0.1);
        assert!(woken.reveal - 0.2 > GLASS);
        assert_eq!(woken.awake, 1.0);
        assert_eq!(compose(SETTLE[0]).awake, 1.0);
    }

    #[test]
    fn the_motion_is_smooth() {
        let step = 1.0 / 60.0;
        let mut previous = compose(0.0);
        let mut t = step;
        while t <= LOOP_SECONDS {
            let f = compose(t);
            for i in 0..3 {
                assert!((f.eye[i] - previous.eye[i]).abs() < 0.002, "eye at {t}");
            }
            assert!((f.yaw - previous.yaw).abs() < 0.0006, "yaw at {t}");
            assert!((f.pitch - previous.pitch).abs() < 0.0006, "pitch at {t}");
            assert!((f.zoom - previous.zoom).abs() < 0.001, "zoom at {t}");
            assert!((f.awake - previous.awake).abs() < 0.01, "awake at {t}");
            for i in 0..6 {
                assert!(
                    (f.layers[i] - previous.layers[i]).abs() < 0.015,
                    "layer {i} at {t}"
                );
            }
            previous = f;
            t += step;
        }
    }

    #[test]
    fn the_head_stays_inside_the_painting() {
        let mut t = 0.0;
        while t < LOOP_SECONDS {
            let f = compose(t);
            assert!(f.yaw.abs() <= MAX_TURN, "yaw {} at {t}", f.yaw);
            assert!(f.pitch.abs() <= MAX_TURN, "pitch {} at {t}", f.pitch);
            assert!(
                f.zoom >= ZOOM - 0.01 && f.zoom <= ZOOM + 0.09,
                "zoom at {t}"
            );
            assert!(f.eye.iter().all(|v| v.abs() < 0.2), "eye at {t}");
            // Each corner of the view lands on the painting's floor or far
            // wall, within the soft edge that melts into the page.
            for corner in [[-1.0, -1.0], [-1.0, 1.0], [1.0, -1.0], [1.0, 1.0]] {
                let [x, y, z] = view_ray(&f, corner);
                let to_wall = (3.48 - f.eye[2]) / z;
                let to_floor = if y < 0.0 {
                    (-1.0 - f.eye[1]) / y
                } else {
                    f32::MAX
                };
                let k = to_wall.min(to_floor);
                let hit = [f.eye[0] + x * k, f.eye[1] + y * k, f.eye[2] + z * k];
                let [column, row] = painting(hit);
                assert!(
                    (-25.0..=1561.0).contains(&column),
                    "{corner:?} at {t}: {column}"
                );
                assert!((-25.0..=1049.0).contains(&row), "{corner:?} at {t}: {row}");
            }
            t += 0.25;
        }
    }

    #[test]
    fn the_home_view_is_the_painting() {
        let mut f = compose(0.0);
        f.eye = [0.0; 3];
        f.yaw = 0.0;
        f.pitch = 0.0;
        f.zoom = 1.0;
        // A point at the painting's pixel projects back to that pixel.
        let z = 2.5;
        let column = 1200.0;
        let row = 700.0;
        let point = [
            (column - CENTRE) / FOCAL * z,
            (HORIZON - row) / FOCAL * z,
            z,
        ];
        let [x, y] = project(&f, point);
        assert!(close(x, column / 1536.0 * 2.0 - 1.0, 1e-5));
        assert!(close(y, 1.0 - row / 1024.0 * 2.0, 1e-5));
    }

    #[test]
    fn every_sweep_crosses_the_whole_room() {
        for s in SWEEPS {
            let reach = corners().map(|c| {
                if s.sphere {
                    (0..3)
                        .map(|i| (c[i] - s.axis[i]).powi(2))
                        .sum::<f32>()
                        .sqrt()
                } else {
                    (0..3).map(|i| c[i] * s.axis[i]).sum::<f32>()
                }
            });
            let (low, high) = reach.fold((f32::MAX, f32::MIN), |(l, h), v| (l.min(v), h.max(v)));
            if s.sphere {
                // The shell starts in front of the nearest floor.
                assert!(s.from < ROOM_MIN[2], "{s:?}");
            } else {
                assert!(s.from <= low, "{s:?} starts inside the room at {low}");
            }
            assert!(s.to >= high - 0.05, "{s:?} ends inside the room at {high}");
            let n: f32 = s.axis.iter().map(|v| v * v).sum();
            assert!(s.sphere || close(n, 1.0, 1e-3), "{s:?}");
        }
        // The shaders keep two sweeps: the light of the one before those
        // is gone by the time it is dropped.
        for t in (0..600).map(|i| i as f32 / 10.0) {
            let (older, since) = sweep_at(t, 2);
            assert!(
                since - older.seconds > 4.5 * AFTERGLOW,
                "{t}: {older:?} {since}"
            );
            let (now, since) = sweep_at(t, 0);
            assert!((0.0..LOOP_SECONDS).contains(&since), "{t}");
            assert!(now.start <= t || t < SWEEPS[0].start);
        }
        assert_eq!(sweep_at(0.0, 0).0, SWEEPS[6]);
        assert_eq!(sweep_at(0.0, 1).0, SWEEPS[5]);
        assert!(close(
            sweep_at(0.0, 1).1,
            LOOP_SECONDS - SWEEPS[5].start,
            1e-4
        ));
        assert_eq!(sweep_at(2.0, 1).0, SWEEPS[6]);
        assert!(close(
            sweep_at(2.0, 1).1,
            2.0 + LOOP_SECONDS - SWEEPS[6].start,
            1e-4
        ));
    }

    #[test]
    fn each_line_has_its_own_layer() {
        for (i, beat) in BEATS.iter().enumerate() {
            let middle = compose(beat + 4.5);
            assert!(middle.layers[i] > 0.99, "{i}");
            // Its sweep is under way at the start of its line.
            let (sweep, since) = sweep_at(beat + 1.0, 0);
            assert_eq!(sweep, SWEEPS[i + 1]);
            assert!(sweep_strength(&sweep, since) > 0.9);
            for (j, &other) in middle.layers.iter().enumerate() {
                if j != i {
                    assert!(other < 0.01, "{i}: layer {j} at {other}");
                }
            }
        }
        // Sound fronts belong to the sounds line.
        for (_, at) in SOUNDS {
            assert!(at > BEATS[0] && at + SOUND_LIFE < BEATS[1] + 2.0);
        }
        assert!((compose(BEATS[4] + 3.6).breath - 1.0).abs() > 0.01);
        assert_eq!(compose(BEATS[2]).breath, 1.0);
    }

    #[test]
    fn the_depth_map_reads_back_in_metres() {
        assert!(close(depth(0, 0), FAR, 1e-4));
        // 3.48 m, the far wall, as depth_map.py packs it.
        let q = (1.0 / 3.48 / DISPARITY_MAX * 65535.0).round() as u16;
        assert!(close(depth((q >> 8) as u8, (q & 255) as u8), 3.48, 1e-3));
        assert!(close(depth(255, 255), 1.0 / DISPARITY_MAX, 1e-5));
        // The floor under the painting's lowest row is about 1.7 m away.
        let [_, row] = painting([0.0, -1.0, 963.0 / (1024.0 - HORIZON)]);
        assert!(close(row, 1024.0, 1e-3));
    }

    #[test]
    fn the_light_themes_never_light_the_page() {
        let pages = [
            (1, rgb(0xFA, 0xE1, 0x8F)),
            (5, rgb(0xF1, 0xDF, 0xB8)),
            (6, rgb(0xF3, 0xD8, 0xC7)),
        ];
        for (code, page) in pages {
            let look = look(code);
            assert!(look.light);
            for level in 0..=40 {
                let v = level as f32 / 20.0;
                let ink = engrave(&look, page, [v * 0.5, v, v * 0.6]);
                for i in 0..3 {
                    assert!(ink[i] <= page[i] + 1e-6);
                }
            }
            // Black stays the page itself.
            assert_eq!(engrave(&look, page, [0.0; 3]), page);
        }
        for code in [0, 2, 3, 4] {
            assert!(!look(code).light);
        }
    }

    #[test]
    fn the_dots_keep_the_paintings_brightness() {
        // Dots one spacing apart, each jittered in its cell, sum on average
        // to the painting's brightness; narrow enough to read as dots, so
        // the sum ripples about that average.
        let field = |dx: f32, dy: f32| {
            let mut sum = 0.0;
            for i in -6..=6 {
                for j in -6..=6 {
                    let (x, y) = (i as f32 + dx, j as f32 + dy);
                    sum += DOT_GAIN * (-(x * x + y * y) / (2.0 * DOT_SIGMA * DOT_SIGMA)).exp();
                }
            }
            sum
        };
        let n = 20;
        let mut mean = 0.0;
        for a in 0..n {
            for b in 0..n {
                let v = field(a as f32 / n as f32, b as f32 / n as f32);
                assert!((0.15..3.0).contains(&v), "{v}");
                mean += v / (n * n) as f32;
            }
        }
        assert!(close(mean, 1.0, 0.01), "{mean}");
        assert_eq!(POINTS, 384 * 256);
    }

    #[test]
    fn the_beam_axis_runs_down_the_beam() {
        let v = [0, 1, 2].map(|i| BEAM[1][i] - BEAM[0][i]);
        let n = v.iter().map(|x| x * x).sum::<f32>().sqrt();
        for i in 0..3 {
            assert!(close(v[i] / n, BEAM_AXIS[i], 1e-3), "{i}");
        }
        // The beam lands on the lit patch of the painted floor.
        let [column, row] = painting(BEAM[1]);
        assert!((330.0..700.0).contains(&column) && (700.0..1020.0).contains(&row));
    }

    #[test]
    fn the_still_frame_holds_the_light_line() {
        let f = compose(STILL);
        assert!(f.layers[3] > 0.99);
        assert_eq!(f.sweeps[0], SWEEPS[4]);
        assert!(sweep_strength(&f.sweeps[0], f.since[0]) > 0.99);
        assert_eq!(f.awake, 1.0);
    }
}
