//! «Внутрь», page 01 of Step 6 «Внутреннее кольцо», direction «Эхо». A
//! person sits upright on a chair in a dark room. The room exists only where
//! perception touches it: waves run out from the chest and draw it in cold
//! points (floor, the back wall with its window, the left wall with its door,
//! a table, a floor lamp); the third leaves the orbit, a ring of points round
//! the body at chest height and its trace on the floor, and a sweep goes
//! round it. «ты переходишь внутрь»: one wave runs back in from the walls to
//! the chest, and where it passes, the inside of the body comes up in warm
//! points; three echoes inside raise it until it is as clear as the room. Each
//! «Без…» pulls the warm points once and lets them go: they sink toward the
//! floor, lock into a grid, tremble, step out as a double of the body. Then
//! the inner sweep turns in step with the outer one, sparks of sensation wake
//! under it, and at «здесь и сейчас» one wave goes through the body and the
//! room together. Every value here is a pure function of loop time;
//! `browser.rs` only uploads it and one ray-marched pass draws it. Unit: the
//! person sits about 1.4 high; the floor is y = 0, the person faces +z.
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

pub mod body;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerEcho;

pub const LOOP_SECONDS: f32 = 60.0;
/// The frame is 3:2; a canvas of another shape keeps the whole 3:2 frame in
/// view.
pub const FRAME_ASPECT: f32 = 1.5;

/// Where perception starts: the chest of the seated person. Every wave is a
/// sphere round it.
pub const HEART: [f32; 3] = [0.0, 0.97, -0.035];
/// The orbit: points round the person at chest height, and its trace on the
/// floor, this far out.
pub const ORBIT: f32 = 1.35;
pub const ORBIT_POINTS: f32 = 90.0;
/// The warm inner ring round the heart.
pub const INNER_RING: f32 = 0.1;
pub const INNER_POINTS: f32 = 36.0;
/// How far perception reaches: past the room's far corner; it fades from
/// `FADE_FROM` out to here.
pub const REACH: f32 = 4.4;
pub const FADE_FROM: f32 = 3.0;
/// The room: the back wall's face at z = `BACK`, the left wall's at
/// x = `LEFT`; the window (centre x, y, half width, half height) and the door
/// (centre z, y, half width, half height) in them.
pub const BACK: f32 = -2.4;
pub const LEFT: f32 = -2.6;
pub const WINDOW: [f32; 4] = [-0.85, 1.45, 0.6, 0.55];
pub const DOOR: [f32; 4] = [-1.0, 1.02, 0.45, 1.02];
/// The table (its feet) and the floor lamp (its foot).
pub const TABLE: [f32; 3] = [-1.45, 0.0, -1.45];
pub const LAMP: [f32; 3] = [1.9, 0.0, -0.9];
/// The box round the person and the chair: corners.
pub const PERSON: [[f32; 3]; 2] = [[-0.32, 0.0, -0.21], [0.32, 1.46, 0.7]];
/// Point spacing on the skin, the chair, the things, the walls and floor;
/// inside the body.
pub const SPACING: [f32; 4] = [0.022, 0.022, 0.022, 0.045];
pub const INSIDE: f32 = 0.026;
/// The sweep turns this many whole times a loop: once every six seconds.
pub const SWEEP_TURNS: f32 = 10.0;

/// «взгляд, слух, восприятие раскрываются как орбита»: three waves out from
/// the chest, each this long from `WAVE_FROM` to `REACH`; each leaves the
/// room this much brighter. The third leaves the orbit.
pub const WAVES: [f32; 3] = [0.4, 2.2, 4.0];
pub const WAVE_SECONDS: f32 = 2.8;
pub const WAVE_FROM: f32 = 0.15;
pub const LEVELS: [f32; 3] = [0.45, 0.3, 0.25];
/// «и ты ощущаешь Пространство вокруг тела без вовлечения»: the sweep comes
/// on.
pub const SCAN: [f32; 2] = [5.6, 7.4];
/// «ты переходишь внутрь»: one wave back in from `REACH` to the chest; the
/// inside of the body comes up where it has passed, this bright.
pub const INWARD: [f32; 2] = [10.0, 14.2];
pub const INNER_BASE: f32 = 0.4;
/// «внутреннее замечается так же ясно, как внешнее»: three echoes out from
/// the chest to the feet, like the three waves in the room; each leaves the
/// inside this much brighter, the third leaves the inner ring.
pub const ECHOES: [f32; 3] = [15.0, 16.4, 17.8];
pub const ECHO_SECONDS: f32 = 1.4;
pub const ECHO_REACH: f32 = 1.2;
pub const ECHO_LEVELS: [f32; 3] = [0.25, 0.2, 0.15];
/// «Без проваливания», «Без анализа», «Без попытки понять или исправить»,
/// «Без ухода в образы себя»: each pulls the warm points once (they sink
/// toward the floor, lock into a grid, tremble, step out as a double), holds,
/// and lets them go back to a calm cloud before the next.
pub const WITHOUT: [f32; 4] = [20.0, 22.6, 25.2, 27.8];
pub const PULL: [f32; 4] = [0.9, 0.7, 0.7, 1.2];
pub const HOLD: f32 = 0.35;
pub const RELEASE: [f32; 4] = [1.2, 1.1, 1.1, 1.5];
/// Sinking squashes the warm points toward the floor by this much.
pub const SINK: f32 = 0.45;
/// The double stands here, off the body; this share of the warm points
/// goes to it.
pub const DOUBLE: [f32; 3] = [-0.62, 0.0, 0.42];
pub const MOVERS: f32 = 0.8;
/// «Это — Наблюдение внутреннего кольца, которое раскрывается на фоне
/// внешнего кольца и его сканирования»: the inner sweep comes on, in step with
/// the outer one.
pub const INNER_SCAN: [f32; 2] = [31.0, 33.0];
/// «точности, бдительности и честности … живое Ощущение»: sparks of
/// sensation the inner sweep wakes.
pub const SPARKS: [f32; 2] = [43.0, 44.5];
/// Where they wake, spread round the heart so the sweep finds them one by
/// one: a shoulder, a hand, a knee, the other forearm, the other shoulder,
/// the back.
pub const SPARK_POINTS: [[f32; 3]; 6] = [
    [0.2, 1.06, -0.05],
    [0.166, 0.625, 0.335],
    [-0.112, 0.53, 0.43],
    [-0.196, 0.722, 0.15],
    [-0.2, 1.06, -0.05],
    [0.0, 0.82, -0.1],
];
/// «здесь и сейчас»: one wave from the chest through the body and the room
/// together, this long.
pub const TOGETHER: f32 = 50.0;
pub const TOGETHER_SECONDS: f32 = 2.8;
/// The inside goes dark, then the room, back to the person alone.
pub const INNER_OUT: [f32; 2] = [54.6, 58.2];
pub const ROOM_OUT: [f32; 2] = [55.2, 59.4];
/// Reduced motion: the room and the inside both clear, both sweeps on.
pub const STILL: f32 = 39.0;

/// The skin's own cold light: the perceiver is there from the first frame;
/// it steps back while the inside is lit.
pub const SKIN: f32 = 1.0;
pub const SKIN_INSIDE: f32 = 0.35;

/// The camera, keyed through the loop: round the person (degrees from +z
/// toward +x), over the floor (degrees), how far, the point it looks at, and
/// the height of the frame (degrees). Wide for the room, close for the
/// inside, high over both rings, close again, back.
pub const CAMERA: [(f32, [f32; 7]); 12] = [
    (0.0, [34.0, 18.0, 4.9, -0.3, 0.8, -0.6, 52.0]),
    (7.5, [26.0, 19.0, 4.75, -0.3, 0.8, -0.55, 52.0]),
    (12.0, [34.0, 15.0, 3.6, -0.15, 0.7, -0.25, 48.0]),
    (15.5, [42.0, 12.0, 2.9, -0.06, 0.64, 0.0, 46.0]),
    (21.0, [47.0, 12.0, 2.8, -0.06, 0.64, 0.02, 46.0]),
    (26.0, [40.0, 13.0, 2.9, -0.22, 0.64, 0.05, 46.0]),
    (30.0, [34.0, 16.0, 3.0, -0.28, 0.64, 0.05, 46.0]),
    (35.5, [30.0, 40.0, 3.8, -0.05, 0.6, -0.25, 52.0]),
    (41.0, [20.0, 44.0, 4.0, -0.05, 0.55, -0.25, 52.0]),
    (46.5, [50.0, 15.0, 2.8, -0.04, 0.64, 0.0, 46.0]),
    (51.0, [40.0, 22.0, 3.6, -0.12, 0.68, -0.2, 50.0]),
    (55.5, [34.0, 20.0, 4.5, -0.25, 0.8, -0.5, 52.0]),
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    /// Loop time, for the shader's own small motions.
    pub time: f32,
    /// The camera: its place and axes, and the tangent of half the frame's
    /// height.
    pub eye: [f32; 3],
    pub right: [f32; 3],
    pub up: [f32; 3],
    pub forward: [f32; 3],
    pub lens: f32,
    /// The sweep's angle round the person (radians, from +x toward +z), the
    /// same for both rings.
    pub sweep: f32,
    /// The three waves out: radius and front light each (0 before it
    /// starts, `REACH` once it has passed everything).
    pub waves: [[f32; 2]; 3],
    /// The wave back in: radius and light. The inside is touched farther
    /// than this from the heart.
    pub inward: [f32; 2],
    /// The three echoes inside: radius and front light.
    pub echoes: [[f32; 2]; 3],
    /// «здесь и сейчас»: the wave through both, radius and light.
    pub together: [f32; 2],
    /// The room's light (0..1), the orbit's, the skin's, the outer sweep's.
    pub room: f32,
    pub orbit: f32,
    pub skin: f32,
    pub scan: f32,
    /// The inside: its light, the inner ring's, the inner sweep's, the
    /// sparks'.
    pub inner: f32,
    pub ring: f32,
    pub inner_scan: f32,
    pub sparks: f32,
    /// The four pulls (0..1 each): sinking, the grid, trembling, the double.
    pub sink: f32,
    pub grid: f32,
    pub tremble: f32,
    pub double: f32,
}

fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// On from `a` to `b`, off from `c` to `d`.
fn window(t: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    smooth(a, b, t) * (1.0 - smooth(c, d, t))
}

fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn dot(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/// A smooth closed curve through `n` keys (time, value) around the loop:
/// Catmull–Rom tangents, cubic Hermite pieces.
fn spline_by(n: usize, key: impl Fn(usize) -> (f32, f32), t: f32) -> f32 {
    let count = n as isize;
    let mut t = t.rem_euclid(LOOP_SECONDS);
    let i = (0..n)
        .rev()
        .find(|&j| key(j).0 <= t)
        .map_or(count - 1, |j| j as isize);
    let at = |j: isize| {
        let (time, value) = key(j.rem_euclid(count) as usize);
        (time + LOOP_SECONDS * j.div_euclid(count) as f32, value)
    };
    let [(t0, v0), (t1, v1), (t2, v2), (t3, v3)] = [i - 1, i, i + 1, i + 2].map(at);
    if t < t1 {
        t += LOOP_SECONDS;
    }
    let (m1, m2) = ((v2 - v0) / (t2 - t0), (v3 - v1) / (t3 - t1));
    let h = t2 - t1;
    let s = (t - t1) / h;
    let (s2, s3) = (s * s, s * s * s);
    (2.0 * s3 - 3.0 * s2 + 1.0) * v1
        + (s3 - 2.0 * s2 + s) * h * m1
        + (3.0 * s2 - 2.0 * s3) * v2
        + (s3 - s2) * h * m2
}

/// Camera channel `c` (see `CAMERA`) at `t`.
pub fn camera(c: usize, t: f32) -> f32 {
    spline_by(CAMERA.len(), |i| (CAMERA[i].0, CAMERA[i].1[c]), t)
}

/// A wave that starts at `start` and runs from `from` to `to` in `seconds`,
/// fast at first and easing out: its radius and its front's light. Before it
/// starts its radius is 0; after, `to`.
fn spread(start: f32, seconds: f32, from: f32, to: f32, t: f32) -> [f32; 2] {
    let age = t - start;
    if age < 0.0 {
        return [0.0, 0.0];
    }
    let x = (age / seconds).min(1.0);
    [
        from + (to - from) * (1.0 - (1.0 - x).powf(1.6)),
        smooth(0.0, 0.45, age) * (1.0 - smooth(seconds * 0.6, seconds, age)),
    ]
}

/// When a wave from `start` reaches `radius`.
fn crossing(start: f32, seconds: f32, from: f32, to: f32, radius: f32) -> f32 {
    let x = 1.0 - (1.0 - (radius - from) / (to - from)).powf(1.0 / 1.6);
    start + x * seconds
}

/// Outward wave `i` at `t`.
pub fn wave(i: usize, t: f32) -> [f32; 2] {
    spread(WAVES[i], WAVE_SECONDS, WAVE_FROM, REACH, t)
}

/// Echo `i` inside the body at `t`.
pub fn echo(i: usize, t: f32) -> [f32; 2] {
    spread(ECHOES[i], ECHO_SECONDS, 0.0, ECHO_REACH, t)
}

/// The wave back in: from `REACH` to the heart, quick through the room, slow
/// through the body so it fills from the feet and hands in.
pub fn inward(t: f32) -> [f32; 2] {
    let x = ((t - INWARD[0]) / (INWARD[1] - INWARD[0])).clamp(0.0, 1.0);
    [
        REACH * (1.0 - x) * (1.0 - x),
        smooth(INWARD[0], INWARD[0] + 0.5, t) * (1.0 - smooth(INWARD[1] - 0.5, INWARD[1] + 0.3, t)),
    ]
}

/// How hard pull `i` holds the warm points at `t`.
pub fn pull(i: usize, t: f32) -> f32 {
    let at = WITHOUT[i] + PULL[i] + HOLD;
    smooth(WITHOUT[i], WITHOUT[i] + PULL[i], t) * (1.0 - smooth(at, at + RELEASE[i], t))
}

/// When the orbit and the inner ring light: as the third wave out, and the
/// third echo, reach them.
pub fn orbit_lit() -> f32 {
    crossing(WAVES[2], WAVE_SECONDS, WAVE_FROM, REACH, ORBIT)
}
pub fn ring_lit() -> f32 {
    crossing(ECHOES[2], ECHO_SECONDS, 0.0, ECHO_REACH, INNER_RING)
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let [azimuth, elevation, distance, tx, ty, tz, height] =
        std::array::from_fn(|c| camera(c, time));
    let (sa, ca) = azimuth.to_radians().sin_cos();
    let (se, ce) = elevation.to_radians().sin_cos();
    let out = [sa * ce, se, ca * ce];
    let eye = [
        tx + distance * out[0],
        ty + distance * out[1],
        tz + distance * out[2],
    ];
    let forward = out.map(|v| -v);
    // Level with the floor however high the camera climbs.
    let right = [ca, 0.0, -sa];
    let up = cross(right, forward);

    let together = spread(TOGETHER, TOGETHER_SECONDS, 0.0, REACH, time);
    // Both rings flash once as the «здесь и сейчас» wave passes them.
    let flash = |radius: f32| {
        let at = crossing(TOGETHER, TOGETHER_SECONDS, 0.0, REACH, radius);
        smooth(at - 0.25, at + 0.15, time) * (-(time - at - 0.15).max(0.0) / 0.7).exp()
    };
    let orbit_at = orbit_lit();
    let ring_at = ring_lit();
    let room_out = 1.0 - smooth(ROOM_OUT[0], ROOM_OUT[1], time);
    let inner_out = 1.0 - smooth(INNER_OUT[0], INNER_OUT[1], time);

    Frame {
        time,
        eye,
        right,
        up,
        forward,
        lens: (height.to_radians() * 0.5).tan(),
        sweep: TAU * SWEEP_TURNS * time / LOOP_SECONDS,
        waves: std::array::from_fn(|i| wave(i, time)),
        inward: inward(time),
        echoes: std::array::from_fn(|i| echo(i, time)),
        together,
        room: smooth(0.0, 1.2, time) * room_out,
        orbit: smooth(orbit_at, orbit_at + 0.6, time) * room_out + 0.8 * flash(ORBIT),
        skin: SKIN
            - (SKIN - SKIN_INSIDE)
                * window(
                    time,
                    INWARD[1] - 2.0,
                    ECHOES[2] + 1.0,
                    INNER_OUT[0],
                    INNER_OUT[1],
                ),
        scan: window(time, SCAN[0], SCAN[1], ROOM_OUT[0], ROOM_OUT[1] - 1.0),
        inner: window(time, INWARD[0], INWARD[0] + 0.5, INNER_OUT[0], INNER_OUT[1]),
        ring: smooth(ring_at, ring_at + 0.5, time) * inner_out + 0.8 * flash(INNER_RING),
        inner_scan: window(
            time,
            INNER_SCAN[0],
            INNER_SCAN[1],
            INNER_OUT[0] - 0.6,
            INNER_OUT[1] - 1.0,
        ),
        sparks: window(
            time,
            SPARKS[0],
            SPARKS[1],
            INNER_OUT[0] - 0.5,
            INNER_OUT[0] + 0.8,
        ),
        sink: pull(0, time),
        grid: pull(1, time),
        tremble: pull(2, time),
        double: pull(3, time),
    }
}

/// Where a world point lands in the 3:2 frame, -1..1 both ways; None behind
/// the camera.
pub fn project(f: &Frame, point: [f32; 3]) -> Option<[f32; 2]> {
    let v = [0, 1, 2].map(|i| point[i] - f.eye[i]);
    let z = dot(v, f.forward);
    (z > 0.0).then(|| {
        [
            dot(v, f.right) / (z * f.lens * FRAME_ASPECT),
            dot(v, f.up) / (z * f.lens),
        ]
    })
}

/// The scene's three lights in a theme's colors: the cold room and skin, the
/// warm inside, and the pale of sparks and wave fronts. The page itself comes
/// from the app (`backdrop`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub cold: [f32; 3],
    pub warm: [f32; 3],
    pub pale: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

/// The app theme by its `graphicsPalette` code (0 Искра, 2 Тишина, 3 Астрал,
/// 4 Матрица). The cold light is the theme's accent; the warm one is a
/// second tone that stays apart from it. The site shows only the dark
/// themes; the retired light codes fall back to Тишина.
pub fn look(code: u32) -> Look {
    match Palette::from_code(code) {
        // Искра: the yellow of the theme, an ember inside.
        Palette::Dark => Look {
            cold: rgb(245, 221, 7),
            warm: rgb(255, 122, 40),
            pale: rgb(255, 244, 170),
        },
        // Астрал: the blue of the theme, a rose-peach inside.
        Palette::Violet => Look {
            cold: rgb(98, 150, 245),
            warm: rgb(240, 158, 128),
            pale: rgb(200, 212, 248),
        },
        // Матрица: code green, amber inside.
        Palette::Matrix => Look {
            cold: rgb(0, 255, 65),
            warm: rgb(255, 184, 64),
            pale: rgb(190, 255, 205),
        },
        // Тишина: sea glass, warm sand inside.
        _ => Look {
            cold: rgb(134, 201, 199),
            warm: rgb(242, 179, 117),
            pale: rgb(214, 218, 210),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    fn every(step: f32, mut check: impl FnMut(f32)) {
        let mut t = 0.0;
        while t < LOOP_SECONDS {
            check(t);
            t += step;
        }
    }

    fn distance(a: [f32; 3], b: [f32; 3]) -> f32 {
        (0..3).map(|i| (a[i] - b[i]).powi(2)).sum::<f32>().sqrt()
    }

    #[test]
    fn the_loop_closes_without_a_jump() {
        assert_eq!(compose(0.0), compose(LOOP_SECONDS));
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
        let before = compose(LOOP_SECONDS - 0.001);
        let after = compose(0.001);
        for i in 0..3 {
            assert!(close(before.eye[i], after.eye[i], 1e-3), "{i}");
            assert!(close(before.forward[i], after.forward[i], 1e-3), "{i}");
        }
        assert!(close(before.lens, after.lens, 1e-4));
        let turn = before.sweep - after.sweep;
        assert!(close(turn.cos(), 1.0, 1e-4) && close(turn.sin(), 0.0, 5e-3));
        // Across the seam only the person is there: no room, no inside, no
        // fronts, the skin at rest.
        for f in [before, after] {
            assert!(f.room < 1e-3 && f.inner < 1e-3, "{f:?}");
            assert!(f.orbit < 1e-3 && f.ring < 1e-3 && f.scan < 1e-3, "{f:?}");
            assert!(f.waves.iter().all(|w| w[1] == 0.0));
            assert!(f.echoes.iter().all(|w| w[1] == 0.0));
            assert!(f.inward[1] == 0.0 && f.together[1] == 0.0);
            assert!(close(f.skin, SKIN, 1e-4));
        }
    }

    #[test]
    fn the_sweep_turns_whole_times_a_loop_once_every_six_seconds() {
        assert_eq!(SWEEP_TURNS.fract(), 0.0);
        assert!(close(LOOP_SECONDS / SWEEP_TURNS, 6.0, 1e-6));
        assert!(close(compose(6.0).sweep - compose(0.0).sweep, TAU, 1e-4));
    }

    #[test]
    fn the_first_wave_comes_at_once_and_each_reaches_the_far_corner() {
        // Art: a loop must not open with a long empty beat.
        const _: () = assert!(WAVES[0] <= 0.5);
        assert!(compose(WAVES[0] + 0.5).waves[0][1] > 0.9);
        let corner = distance(HEART, [LEFT, HEART[1], BACK]);
        assert!(FADE_FROM < corner && corner < REACH - 0.5, "{corner}");
        for i in 0..3 {
            assert!(close(wave(i, WAVES[i] + 0.001)[0], WAVE_FROM, 0.02), "{i}");
            assert!(close(wave(i, WAVES[i] + WAVE_SECONDS)[0], REACH, 1e-4));
            // Each wave is out before the next one starts, so they read one
            // by one: взгляд, слух, восприятие.
            if i < 2 {
                assert!(wave(i, WAVES[i + 1])[0] > ORBIT + 1.0);
            }
        }
        // The room is fully lit once all three have passed.
        assert!(close(LEVELS.iter().sum::<f32>(), 1.0, 1e-6));
    }

    #[test]
    fn the_orbit_comes_with_the_third_wave_and_the_sweep_after_it() {
        let at = orbit_lit();
        assert!(close(wave(2, at)[0], ORBIT, 1e-3));
        assert!(compose(at - 0.05).orbit < 1e-3);
        assert!(compose(at + 0.7).orbit > 0.99);
        assert!(SCAN[0] > at);
        assert!(compose(SCAN[1]).scan > 0.99);
    }

    #[test]
    fn the_spline_passes_through_its_keys_and_closes() {
        for c in 0..7 {
            for &(at, values) in &CAMERA {
                assert!(close(camera(c, at), values[c], 1e-4), "{c} at {at}");
            }
            assert!(close(camera(c, LOOP_SECONDS - 1e-3), camera(c, 0.0), 1e-2));
        }
    }

    #[test]
    fn the_motion_is_smooth() {
        let step = 1.0 / 60.0;
        let mut previous = compose(0.0);
        let mut t = step;
        while t < LOOP_SECONDS {
            let f = compose(t);
            for i in 0..3 {
                assert!((f.eye[i] - previous.eye[i]).abs() < 0.04, "eye at {t}");
                assert!(
                    (f.forward[i] - previous.forward[i]).abs() < 0.01,
                    "forward at {t}"
                );
            }
            assert!((f.lens - previous.lens).abs() < 0.003, "lens at {t}");
            let lights = |f: &Frame| {
                [
                    f.room,
                    f.orbit,
                    f.skin,
                    f.scan,
                    f.inner,
                    f.ring,
                    f.inner_scan,
                    f.sparks,
                    f.sink,
                    f.grid,
                    f.tremble,
                    f.double,
                    f.inward[1],
                    f.together[1],
                ]
            };
            for (a, b) in lights(&f).into_iter().zip(lights(&previous)) {
                assert!((a - b).abs() < 0.06, "light at {t}: {a} {b}");
            }
            for i in 0..3 {
                assert!((f.waves[i][1] - previous.waves[i][1]).abs() < 0.06);
                assert!((f.echoes[i][1] - previous.echoes[i][1]).abs() < 0.08);
            }
            previous = f;
            t += step;
        }
    }

    #[test]
    fn the_wave_back_in_passes_the_room_then_fills_the_body_from_its_ends() {
        assert!(close(inward(INWARD[0])[0], REACH, 1e-6));
        assert!(close(inward(INWARD[1])[0], 0.0, 1e-6));
        let mut previous = REACH;
        every(0.02, |t| {
            if (INWARD[0]..=INWARD[1]).contains(&t) {
                let r = inward(t)[0];
                assert!(r <= previous + 1e-6, "{t}");
                previous = r;
            }
        });
        // It reaches the feet halfway: half its time is inside the body.
        let feet = distance(HEART, [0.126, 0.03, 0.62]);
        assert!(feet < ECHO_REACH);
        let half = INWARD[0] + 0.5 * (INWARD[1] - INWARD[0]);
        assert!(inward(half - 0.3)[0] > feet && inward(half + 0.3)[0] < feet);
        // The echoes start once the inside is fully touched.
        const { assert!(ECHOES[0] >= INWARD[1] + 0.5) };
    }

    #[test]
    fn three_echoes_make_the_inside_as_clear_as_the_room() {
        assert!(close(
            INNER_BASE + ECHO_LEVELS.iter().sum::<f32>(),
            1.0,
            1e-6
        ));
        for i in 0..3 {
            assert!(close(
                echo(i, ECHOES[i] + ECHO_SECONDS)[0],
                ECHO_REACH,
                1e-5
            ));
            if i < 2 {
                assert!(ECHOES[i] + ECHO_SECONDS <= ECHOES[i + 1] + 0.05);
            }
        }
        let at = ring_lit();
        assert!(at > ECHOES[2] && at < ECHOES[2] + 0.2);
        assert!(compose(at - 0.02).ring < 1e-3 && compose(at + 0.6).ring > 0.99);
        const { assert!(ECHOES[2] + ECHO_SECONDS < WITHOUT[0]) };
    }

    #[test]
    fn each_without_pulls_once_and_lets_go_before_the_next() {
        let at = |t: f32| {
            let f = compose(t);
            [f.sink, f.grid, f.tremble, f.double]
        };
        assert!(at(WITHOUT[0] - 0.01).iter().all(|&d| d == 0.0));
        for i in 0..4 {
            let held = at(WITHOUT[i] + PULL[i] + 0.5 * HOLD);
            for (j, d) in held.iter().enumerate() {
                assert_eq!(*d > 0.99, i == j, "{i}: {j} at {d}");
                if i != j {
                    assert_eq!(*d, 0.0, "{i}: {j}");
                }
            }
            let done = WITHOUT[i] + PULL[i] + HOLD + RELEASE[i];
            let next = WITHOUT.get(i + 1).copied().unwrap_or(INNER_SCAN[0]);
            assert!(done <= next, "{i}: {done} > {next}");
            assert!(at(done + 0.01).iter().all(|&d| d == 0.0));
        }
        // Before the pulls the inside is fully lit; the ring is on.
        let f = compose(WITHOUT[0]);
        assert!(f.inner > 0.99 && f.ring > 0.99);
    }

    #[test]
    fn both_sweeps_turn_together_and_the_wave_goes_through_both_rings() {
        let f = compose(STILL);
        assert!(f.scan > 0.99 && f.inner_scan > 0.99);
        assert!(f.inner > 0.99 && f.room > 0.99 && f.orbit > 0.99 && f.ring > 0.99);
        assert_eq!([f.sink, f.grid, f.tremble, f.double], [0.0; 4]);
        // One wave from the chest passes the inner ring, then the orbit.
        let inner = crossing(TOGETHER, TOGETHER_SECONDS, 0.0, REACH, INNER_RING);
        let outer = crossing(TOGETHER, TOGETHER_SECONDS, 0.0, REACH, ORBIT);
        assert!(inner < outer && outer - TOGETHER < 0.7);
        assert!(compose(outer + 0.1).orbit > 1.6);
        assert!(compose(inner + 0.1).ring > 1.6);
        // Both sweeps are on at «здесь и сейчас»; the inside goes dark only
        // after it.
        assert!(compose(TOGETHER + 1.0).inner_scan > 0.99);
        const { assert!(INNER_OUT[0] > TOGETHER + TOGETHER_SECONDS) };
        const { assert!(ROOM_OUT[0] > INNER_OUT[0]) };
    }

    #[test]
    fn the_camera_stays_in_the_room_and_off_the_person() {
        every(0.05, |t| {
            let f = compose(t);
            let [x, y, z] = f.eye;
            assert!(
                x > LEFT + 0.6 && z > BACK + 0.6 && y > 0.6,
                "{t}: {:?}",
                f.eye
            );
            // Off the person and the chair (their box, with room).
            let [lo, hi] = PERSON;
            let gap: [f32; 3] =
                std::array::from_fn(|i| (lo[i] - f.eye[i]).max(f.eye[i] - hi[i]).max(0.0));
            assert!(gap.iter().map(|g| g * g).sum::<f32>().sqrt() > 0.8, "{t}");
            // Level-ish: never under the floor's horizon, never straight down.
            let elevation = (-f.forward[1]).asin().to_degrees();
            assert!(elevation > 5.0 && elevation < 60.0, "{t}: {elevation}");
        });
    }

    #[test]
    #[ignore]
    fn print_framing() {
        let person = [
            [0.0, 1.43, -0.02],
            [0.13, 0.03, 0.66],
            [-0.13, 0.03, 0.66],
            [0.22, 0.81, 0.0],
            [-0.22, 0.81, 0.0],
            [0.0, 0.55, 0.47],
            [0.0, 0.0, -0.15],
        ];
        let mut t = 0.0;
        while t < LOOP_SECONDS {
            let f = compose(t);
            let (mut x0, mut x1, mut y0, mut y1) = (9f32, -9f32, 9f32, -9f32);
            for p in person {
                let [x, y] = project(&f, p).unwrap();
                x0 = x0.min(x);
                x1 = x1.max(x);
                y0 = y0.min(y);
                y1 = y1.max(y);
            }
            println!("{t:5.1} x {x0:6.2}..{x1:6.2} y {y0:6.2}..{y1:6.2}");
            t += 0.5;
        }
    }

    #[test]
    fn the_person_and_the_double_stay_in_frame() {
        let person = [
            [0.0, 1.43, -0.02],
            [0.13, 0.03, 0.66],
            [-0.13, 0.03, 0.66],
            [0.22, 0.81, 0.0],
            [-0.22, 0.81, 0.0],
            [0.0, 0.55, 0.47],
            [0.0, 0.0, -0.15],
        ];
        every(0.1, |t| {
            let f = compose(t);
            for p in person {
                let [x, y] = project(&f, p).expect("in front");
                assert!(x.abs() < 0.85 && y.abs() < 0.85, "{t}: {p:?} at {x} {y}");
            }
        });
        let held = WITHOUT[3] + PULL[3] + 0.5 * HOLD;
        let f = compose(held);
        for p in person {
            let q = [p[0] + DOUBLE[0], p[1] + DOUBLE[1], p[2] + DOUBLE[2]];
            let [x, y] = project(&f, q).expect("in front");
            assert!(x.abs() < 0.9 && y.abs() < 0.9, "double {q:?} at {x} {y}");
        }
    }

    #[test]
    fn the_inner_ring_shows_against_the_orbit_from_above() {
        // P3: high enough that the orbit opens into an ellipse round the
        // person, the whole of it in frame.
        for t in [37.0, 39.0, 41.0] {
            let f = compose(t);
            let elevation = (-f.forward[1]).asin().to_degrees();
            assert!(elevation > 35.0, "{t}: {elevation}");
            let seen = (0..90)
                .filter(|k| {
                    let a = *k as f32 / 90.0 * TAU;
                    project(&f, [ORBIT * a.cos(), HEART[1], ORBIT * a.sin()])
                        .is_some_and(|[x, y]| x.abs() < 0.95 && y.abs() < 0.95)
                })
                .count();
            assert_eq!(seen, 90, "{t}");
        }
        // Close up the inner ring is at least a thirtieth of the frame wide.
        for t in [WITHOUT[0], WITHOUT[1], 47.0] {
            let f = compose(t);
            let [a, _] = project(&f, [HEART[0] - INNER_RING, HEART[1], HEART[2]]).unwrap();
            let [b, _] = project(&f, [HEART[0] + INNER_RING, HEART[1], HEART[2]]).unwrap();
            assert!((b - a).abs() > 0.066, "{t}: {}", (b - a).abs());
        }
    }

    #[test]
    fn the_sparks_sit_inside_the_body_and_the_sweep_finds_them_one_by_one() {
        let angle = |p: [f32; 3]| (p[2] - HEART[2]).atan2(p[0] - HEART[0]);
        for (i, &p) in SPARK_POINTS.iter().enumerate() {
            assert!(body::figure(p) < -0.005, "{i}: {}", body::figure(p));
            for &q in &SPARK_POINTS[i + 1..] {
                let apart = (angle(p) - angle(q)).rem_euclid(TAU);
                let apart = apart.min(TAU - apart).to_degrees();
                assert!(apart > 20.0, "{i}: {apart}");
            }
        }
        // They wake after the inner sweep has come on, and go before the
        // «здесь и сейчас» wave.
        const { assert!(SPARKS[0] > INNER_SCAN[1] && SPARKS[1] < TOGETHER) };
    }

    #[test]
    fn every_dark_theme_keeps_its_accent_cold_and_a_warm_apart_from_it() {
        for code in [0, 2, 3, 4] {
            let look = look(code);
            let accent = Palette::from_code(code).colors().unwrap().accent;
            assert_eq!(look.cold, accent, "{code}");
            let apart = (0..3)
                .map(|i| (look.warm[i] - look.cold[i]).powi(2))
                .sum::<f32>();
            assert!(look.warm[0] > look.warm[2] + 0.3, "{code}");
            assert!(apart.sqrt() > 0.3, "{code}: {}", apart.sqrt());
        }
        assert_eq!(look(1), look(2));
        assert_eq!(look(99), look(2));
    }
}
