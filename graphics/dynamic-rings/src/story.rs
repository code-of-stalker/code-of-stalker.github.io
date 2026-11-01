//! The chapters: what the camera, the figure and the three rings do through
//! each page's loop. Everything is a pure function of loop time.
use crate::body::{build, Step, Walk};
use crate::math::{hermite, pulse, smooth, spline, v3, window, Y};
use crate::{
    Frame, Ring, BEAT, GHOSTS, GHOST_STEP, ORBIT_HEIGHT, ORBIT_RADIUS, ORBIT_START, PRINTS,
    RIPPLE_ACTION, RIPPLE_ORBIT, SPHERE_RADIUS, WAIST_RADIUS, WAIST_TILT,
};
use std::f32::consts::TAU;

/// The cover and the pages of Step 7 that have a scene so far.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Chapter {
    /// The step's cover: a figure walks, all three rings held at once.
    Hero,
    /// Page 01: the outer ring, then the inner one, their rhythms meet and
    /// lock, and the third appears and holds as the figure starts to walk.
    Arrive,
}

impl Chapter {
    pub fn from_code(code: u32) -> Chapter {
        match code {
            1 => Chapter::Arrive,
            _ => Chapter::Hero,
        }
    }
    pub fn loop_seconds(self) -> f32 {
        match self {
            Chapter::Hero => HERO_LOOP,
            Chapter::Arrive => ARRIVE_LOOP,
        }
    }
    /// Reduced motion holds one moment with all three rings.
    pub fn still(self) -> f32 {
        match self {
            Chapter::Hero => 11.3,
            Chapter::Arrive => 28.9,
        }
    }
}

/// The cover: 6 breaths, 48 steps.
pub const HERO_LOOP: f32 = 26.4;
const HERO_STEPS: i32 = 48;
/// A step every `CADENCE` s, `STRIDE` m long: eight steps a breath.
pub const CADENCE: f32 = 0.55;
pub const STRIDE: f32 = 0.62;

/// Page 01, 8 breaths.
pub const ARRIVE_LOOP: f32 = 35.2;
/// The runner draws the outer ring, its ticks grow.
const DRAW: f32 = 1.2;
const TICKS: [f32; 2] = [4.0, 5.6];
/// The inner light ignites in the chest and opens into its sphere.
const CORE: [f32; 2] = [6.6, 7.6];
const OPEN: [f32; 2] = [7.4, 9.4];
/// The runner's lap eases onto the breath; they lock on a beat.
const CONVERGE: [f32; 2] = [12.0, 17.6];
/// The third ring waits as a string of beads at the waist...
const POTENTIAL: f32 = 18.0;
/// ...and joins into a line when the first step lands.
const FIRST_LIFT: f32 = 24.3;
const FIRST_LAND: f32 = 24.75;
const WALK_STEPS: usize = 12;
/// The rings go out one by one for the loop to begin again: the third,
/// the outer, the inner.
const OUT: [[f32; 2]; 3] = [[32.6, 33.6], [33.0, 34.4], [33.6, 35.0]];
/// The lock's wave runs out from the chest this fast, for this long.
const WAVE_SPEED: f32 = 2.4;
const WAVE_SECONDS: f32 = 2.6;

/// Camera keys: (loop time, value) for azimuth (degrees round from the
/// figure's front toward its left), elevation (degrees), distance (m) and
/// the height it looks at (m).
const ARRIVE_AZIMUTH: [(f32, f32); 11] = [
    (0.0, 30.0),
    (4.0, 32.0),
    (6.0, 32.0),
    (8.6, 34.0),
    (11.0, 38.0),
    (14.5, 44.0),
    (18.5, 48.0),
    (22.5, 50.0),
    (27.0, 56.0),
    (31.0, 54.0),
    (33.5, 40.0),
];
const ARRIVE_ELEVATION: [(f32, f32); 11] = [
    (0.0, 5.0),
    (4.0, 13.0),
    (6.0, 11.0),
    (8.6, 6.0),
    (11.0, 8.0),
    (14.5, 16.0),
    (18.5, 10.0),
    (22.5, 8.0),
    (27.0, 9.0),
    (31.0, 10.0),
    (33.5, 8.0),
];
const ARRIVE_DISTANCE: [(f32, f32); 11] = [
    (0.0, 4.1),
    (4.0, 4.3),
    (6.0, 3.6),
    (8.6, 2.5),
    (11.0, 3.5),
    (14.5, 4.4),
    (18.5, 4.0),
    (22.5, 4.2),
    (27.0, 4.6),
    (31.0, 4.5),
    (33.5, 4.3),
];
const ARRIVE_HEIGHT: [(f32, f32); 9] = [
    (0.0, 1.0),
    (4.0, 1.05),
    (6.0, 1.12),
    (8.6, 1.25),
    (11.0, 1.08),
    (14.5, 1.1),
    (18.5, 0.95),
    (22.5, 0.95),
    (27.0, 1.0),
];

pub struct Story {
    pub chapter: Chapter,
    pub loop_seconds: f32,
    /// How far the figure walks a loop; the floor and the motes repeat
    /// every `distance` so the loop closes.
    pub distance: f32,
    pub mote_box: f32,
    walk: Walk,
}

impl Story {
    pub fn new(chapter: Chapter) -> Story {
        let loop_seconds = chapter.loop_seconds();
        match chapter {
            Chapter::Hero => {
                let distance = HERO_STEPS as f32 * STRIDE;
                Story {
                    chapter,
                    loop_seconds,
                    distance,
                    mote_box: distance / 3.0,
                    walk: Walk::steady(CADENCE, STRIDE, 0.06, -12, HERO_STEPS + 16, BEAT),
                }
            }
            Chapter::Arrive => {
                let (walk, distance) = arrive_walk();
                Story {
                    chapter,
                    loop_seconds,
                    distance,
                    mote_box: distance,
                    walk,
                }
            }
        }
    }

    pub fn walk(&self) -> &Walk {
        &self.walk
    }

    pub fn compose(&self, t: f32) -> Frame {
        let time = if t.is_finite() {
            t.rem_euclid(self.loop_seconds)
        } else {
            0.0
        };
        match self.chapter {
            Chapter::Hero => self.hero(time),
            Chapter::Arrive => self.arrive(time),
        }
    }

    fn hero(&self, t: f32) -> Frame {
        let turn = TAU * t / self.loop_seconds;
        let camera = Camera {
            azimuth: 58.0 + 16.0 * turn.sin(),
            elevation: 10.0 + 3.0 * (turn + 1.2).sin(),
            distance: 4.7,
            height: 1.0,
        };
        let beat = t / BEAT;
        let since = t.rem_euclid(BEAT);
        let held = Levels {
            orbit: 1.0,
            ticks: 1.0,
            drawn: 1.0,
            runner: 1.0,
            gaze: 0.6,
            sphere: 1.0,
            open: 1.0,
            core: 1.0,
            action: 1.0,
            solid: 1.0,
        };
        let flashes = [
            pulse(since - RIPPLE_ORBIT),
            pulse(since),
            pulse(since - RIPPLE_ACTION),
        ];
        self.frame(t, camera, held, beat - RIPPLE_ORBIT / BEAT, flashes, None)
    }

    fn arrive(&self, t: f32) -> Frame {
        let key = |keys: &[(f32, f32)]| spline(keys, t, self.loop_seconds);
        let camera = Camera {
            azimuth: key(&ARRIVE_AZIMUTH),
            elevation: key(&ARRIVE_ELEVATION),
            distance: key(&ARRIVE_DISTANCE),
            height: key(&ARRIVE_HEIGHT),
        };
        let lap = arrive_lap();
        let runner = arrive_runner(t, lap);
        let rate = arrive_rate(t, lap);
        let since_beat = t.rem_euclid(BEAT);
        let lock = CONVERGE[1];
        let levels = Levels {
            orbit: window(t, DRAW - 0.4, DRAW + 0.2, OUT[1][0], OUT[1][1]),
            ticks: window(t, TICKS[0], TICKS[1], OUT[1][0], OUT[1][1]),
            drawn: ((t - DRAW) / lap).clamp(0.0, 1.0),
            runner: window(t, DRAW - 0.2, DRAW + 0.4, OUT[1][0], OUT[1][1] - 0.4),
            gaze: 0.6
                * window(
                    t,
                    TICKS[1],
                    TICKS[1] + 1.5,
                    OUT[1][0] - 0.4,
                    OUT[1][0] + 0.6,
                ),
            sphere: window(t, OPEN[0], OPEN[0] + 1.0, OUT[2][0], OUT[2][1]),
            open: smooth(OPEN[0], OPEN[1], t),
            core: window(t, CORE[0], CORE[1], OUT[2][0], OUT[2][1]),
            action: window(t, POTENTIAL, POTENTIAL + 2.5, OUT[0][0], OUT[0][1]),
            solid: smooth(FIRST_LAND - 0.05, FIRST_LAND + 0.5, t),
        };
        // Before the lock each ring keeps its own time; after it they flash
        // together, rippling from the inner one out.
        let since_front = runner.rem_euclid(1.0) / rate;
        let locked = pulse(t - lock);
        let flashes = [
            pulse(since_front).max(locked),
            (pulse(since_beat) * smooth(CORE[0], CORE[1], t)).max(locked),
            (pulse(since_beat - RIPPLE_ACTION) * smooth(POTENTIAL + 1.0, POTENTIAL + 3.0, t))
                .max(1.4 * pulse(t - FIRST_LAND)),
        ];
        let age = t - lock;
        let wave = (0.0..WAVE_SECONDS).contains(&age).then(|| {
            let fade = 1.0 - age / WAVE_SECONDS;
            (WAVE_SPEED * age, fade * fade * smooth(0.0, 0.1, age))
        });
        self.frame(t, camera, levels, runner, flashes, wave)
    }

    /// The frame from the chapter's camera and levels; the figure, its rings
    /// and its traces come from the walk.
    fn frame(
        &self,
        t: f32,
        camera: Camera,
        levels: Levels,
        runner: f32,
        flashes: [f32; 3],
        wave: Option<(f32, f32)>,
    ) -> Frame {
        let breath = 0.5 + 0.5 * (TAU * t / BEAT).cos();
        let walk = &self.walk;
        let amount = walk.amount(t);
        let pose = walk.pose(t, breath);
        let body = build(&pose);
        let track = walk.track(t);
        let target = v3(0.0, camera.height, track + 0.3 * amount);
        let (sa, ca) = camera.azimuth.to_radians().sin_cos();
        let (se, ce) = camera.elevation.to_radians().sin_cos();
        let eye = target + v3(sa * ce, se, ca * ce) * camera.distance;
        let forward = (target - eye).normalize();
        let right = forward.cross(Y).normalize();
        let up = right.cross(forward);
        let waist = |b: &crate::body::Body| {
            let tilt = Y + (b.pelvic.up - Y) * WAIST_TILT - b.pelvic.forward * (0.1 * amount);
            (b.pelvis + b.pelvic.up * 0.11, tilt.normalize())
        };
        let (action_center, action_normal) = waist(&body);
        let trail = levels.action * levels.solid * amount;
        let ghosts = std::array::from_fn(|k| {
            let at = t - (k + 1) as f32 * GHOST_STEP;
            let (c, n) = waist(&build(&walk.pose(at, breath)));
            let fade = 1.0 - (k + 1) as f32 / (GHOSTS + 1) as f32;
            (c, n, trail * fade * fade.sqrt())
        });
        let mut prints = [[0.0, 0.0, 0.0, 99.0]; PRINTS];
        for (slot, s) in prints.iter_mut().zip(walk.landings(t)) {
            let yaw = if s.side == 0 {
                crate::body::TOE_OUT
            } else {
                -crate::body::TOE_OUT
            };
            *slot = [s.x, s.z, yaw, t - s.land];
        }
        let feet = [0, 1].map(|side| {
            let f = pose.feet[side];
            let landed = walk
                .landings(t)
                .find(|s| s.side == side)
                .map_or(99.0, |s| t - s.land);
            let at = (f.heel + f.ball) * 0.5;
            let light = f.support * (0.35 + 0.65 * pulse(landed));
            [at.x, 0.012, at.z, light]
        });
        let orbit_center = v3(0.0, ORBIT_HEIGHT, track);
        let chest = body.chest + body.chest_axes.forward * 0.025 + body.chest_axes.up * 0.03;
        let (lock_radius, lock_light) = wave.unwrap_or((-1.0, 0.0));
        Frame {
            time: t,
            eye,
            right,
            up,
            forward,
            focus: camera.distance,
            breath,
            body,
            body_light: 1.0,
            orbit: Ring {
                center: orbit_center,
                normal: Y,
                radius: ORBIT_RADIUS * (1.0 + 0.008 * (breath - 0.5)),
                light: levels.orbit,
                flash: flashes[0] * levels.orbit,
                // Ticks, the part drawn, the runner's angle, its light, its
                // gaze's light.
                extra: [
                    levels.ticks,
                    levels.drawn,
                    ORBIT_START - TAU * runner,
                    levels.runner,
                    levels.gaze * levels.runner,
                ],
            },
            inner: Ring {
                center: chest,
                normal: Y,
                radius: SPHERE_RADIUS * (1.0 + 0.05 * (breath - 0.5)),
                light: levels.sphere,
                flash: flashes[1] * levels.core,
                // How far it has opened, the core's light, its slow turn.
                extra: [
                    levels.open,
                    levels.core,
                    TAU * t / self.loop_seconds,
                    0.0,
                    0.0,
                ],
            },
            action: Ring {
                center: action_center,
                normal: action_normal,
                radius: WAIST_RADIUS,
                light: levels.action,
                flash: flashes[2] * levels.action,
                // Joined into a line, its trail, the beads' slow turn.
                extra: [
                    levels.solid,
                    trail,
                    -2.0 * TAU * t / self.loop_seconds,
                    0.0,
                    0.0,
                ],
            },
            ghosts,
            prints,
            feet,
            floor: 1.0,
            motes: 1.0,
            lock: [chest.x, chest.y, chest.z, lock_light],
            lock_radius,
            distance: self.distance,
            mote_box: self.mote_box,
            amount,
        }
    }
}

#[derive(Clone, Copy)]
struct Camera {
    azimuth: f32,
    elevation: f32,
    distance: f32,
    height: f32,
}

/// How lit each part of the three rings is, 0..1.
#[derive(Clone, Copy)]
struct Levels {
    orbit: f32,
    ticks: f32,
    drawn: f32,
    runner: f32,
    gaze: f32,
    sphere: f32,
    open: f32,
    core: f32,
    action: f32,
    solid: f32,
}

/// Page 01's walk: standing on both feet, a half step off the left, eleven
/// strides, and the left foot brought alongside the right. The last stands
/// exactly where the first stood, one loop's distance on.
fn arrive_walk() -> (Walk, f32) {
    let (wide, narrow) = (0.085, 0.065);
    let mut steps = Vec::new();
    for i in 0..WALK_STEPS {
        let side = i % 2;
        let land = FIRST_LAND + i as f32 * CADENCE;
        let lift = if i == 0 {
            FIRST_LIFT
        } else {
            land - 0.76 * CADENCE
        };
        let width = if i + 1 == WALK_STEPS { wide } else { narrow };
        steps.push(Step {
            side,
            lift,
            land,
            x: if side == 0 { width } else { -width },
            z: 0.5 * STRIDE + i as f32 * STRIDE,
        });
    }
    let last = steps[WALK_STEPS - 1];
    let side = 1 - last.side;
    steps.push(Step {
        side,
        lift: last.land + 0.13,
        land: last.land + 0.6,
        x: if side == 0 { wide } else { -wide },
        z: last.z,
    });
    (
        Walk::new([[wide, 0.0], [-wide, 0.0]], steps, ARRIVE_LOOP / 5.0),
        last.z,
    )
}

/// The runner's first laps, drawing the ring: long enough that easing onto
/// the breath brings it to the front exactly on the lock's beat, just after
/// the inner flash.
pub fn arrive_lap() -> f32 {
    let span = CONVERGE[1] - CONVERGE[0];
    let target = lock_turns();
    (CONVERGE[0] - DRAW + 0.5 * span) / (target - 0.5 * span / BEAT)
}

/// Where the runner is on the lock's beat, in turns.
fn lock_turns() -> f32 {
    CONVERGE[1] / BEAT - RIPPLE_ORBIT / BEAT + 1.0
}

/// The runner's turns round the outer ring at `t`.
pub fn arrive_runner(t: f32, lap: f32) -> f32 {
    if t < CONVERGE[0] {
        (t - DRAW) / lap
    } else if t < CONVERGE[1] {
        hermite(
            CONVERGE[0],
            (CONVERGE[0] - DRAW) / lap,
            1.0 / lap,
            CONVERGE[1],
            lock_turns(),
            1.0 / BEAT,
            t,
        )
    } else {
        lock_turns() + (t - CONVERGE[1]) / BEAT
    }
}

fn arrive_rate(t: f32, lap: f32) -> f32 {
    let h = 1e-3;
    ((arrive_runner(t + h, lap) - arrive_runner(t - h, lap)) / (2.0 * h)).max(1e-3)
}
