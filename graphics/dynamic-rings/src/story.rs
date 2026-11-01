//! The chapters: what the camera, the figure, its sphere and the rings in
//! it do through each page's loop. Everything is a pure function of loop
//! time.
use crate::body::{build, Body, Walk, TOE_OUT};
use crate::math::{
    hermite, min_jerk, mix, monotone, pulse, rotate, smooth, spline, v3, window, V3, Y,
};
use crate::{
    Frame, Ring, BEAT, CROWN_LAT, CROWN_PERIOD, CROWN_SHARE, CROWN_SWING, CROWN_TILT, GHOSTS,
    GHOST_STEP, LEGS_HEIGHT, LEGS_RADIUS, LEGS_SWING, PRINTS, SPHERE_HEIGHT, SPHERE_RADIUS,
    THIRD_SHARE, TORSO, TORSO_RADIUS,
};
use std::f32::consts::{FRAC_PI_2, TAU};

/// How far the crown ring's lean swings round with each step, radians.
const CROWN_ROCK: f32 = 0.35;
/// The legs ring lifts this much (m) with each swinging knee, and rocks
/// this far each way (radians) side to side.
const LEGS_LIFT: f32 = 0.035;
const LEGS_ROLL: f32 = 0.05;

/// The cover and the pages of Step 7 that have a scene so far.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Chapter {
    /// The step's cover: the figure walks inside its sphere, every ring
    /// held, seen from behind its right shoulder and above.
    Hero,
    /// Page 01: from the eyes the outer ring scans the world and settles
    /// over the crown; over the shoulder the inner ring gathers round the
    /// torso and the two keep different times; from the side they lock, the
    /// third gathers round the legs and the glass fills. Then all is held
    /// while the figure walks, and the camera returns to the eyes.
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
    /// Reduced motion holds one moment with every ring.
    pub fn still(self) -> f32 {
        match self {
            Chapter::Hero => 11.3,
            Chapter::Arrive => 31.6,
        }
    }
}

/// The cover: 6 breaths, 48 steps.
pub const HERO_LOOP: f32 = 26.4;
const HERO_STEPS: i32 = 48;
/// Page 01: 9 breaths, 72 steps.
pub const ARRIVE_LOOP: f32 = 39.6;
const ARRIVE_STEPS: i32 = 72;
/// A step every `CADENCE` s, `STRIDE` m long: eight steps a breath.
pub const CADENCE: f32 = 0.55;
pub const STRIDE: f32 = 0.62;

/// Page 01. The crown ring lights at the top of the glass, scans down past
/// the eyes to the knees, back up, and settles over the crown: its
/// latitude through the scan.
const IGNITE: f32 = 1.2;
const SCAN: [(f32, f32); 5] = [
    (IGNITE, 1.45),
    (3.6, 0.55),
    (6.0, -0.45),
    (8.2, 0.55),
    (10.4, CROWN_LAT),
];
/// The torso ring gathers out of scattered beads.
const INNER: [f32; 2] = [12.0, 14.2];
/// The crown keeps its own time until it eases onto the breath; they lock
/// on a full in-breath.
pub const ARRIVE_LOCK: f32 = 26.4;
const CONVERGE: [f32; 2] = [20.0, ARRIVE_LOCK];
const LOCK_TURNS: f32 = 5.0;
const CROWN_ORIGIN: f32 = CONVERGE[0] - (LOCK_TURNS - 1.25) * CROWN_PERIOD;
/// From the lock's wave the third ring gathers round the legs, threads of
/// light run up through the three, and the sweep fills the glass.
const THIRD: [f32; 2] = [26.7, 27.9];
const THREADS_ON: [f32; 2] = [27.2, 28.8];
const ARRIVE_SWEEP: f32 = 27.6;
const SWEEP_SECONDS: f32 = 3.4;
/// The rings go out one by one, the legs, the crown, the torso, and the
/// glass empties.
const OUT: [[f32; 2]; 3] = [[35.2, 36.4], [35.6, 37.0], [36.0, 37.4]];
/// The lock's wave runs out from the torso this fast, for this long.
const WAVE_SPEED: f32 = 2.4;
const WAVE_SECONDS: f32 = 2.6;
/// The cover's sweeps, every two breaths.
const HERO_SWEEPS: [f32; 3] = [1.0, 9.8, 18.6];

/// Page 01's camera: from the eyes it rises out of the head to over the
/// right shoulder, swings round to the side, and comes back the same way.
const RISE: [f32; 2] = [10.4, 13.6];
const SWING: [f32; 2] = [21.2, 26.4];
/// In a swing the gaze moves over this share of it, the eye over the rest
/// from this share on.
const GAZE_LEAD: f32 = 0.6;
const SWING_LAG: f32 = 0.12;
const BACK: [f32; 2] = [33.6, 37.8];
const DIVE: [f32; 2] = [37.0, 39.6];
/// The way out of the head and back in passes over it.
const OVER_HEAD: V3 = v3(-0.15, 2.45, 0.05);
/// From the eyes the gaze follows the scanning ring: (time, slope down).
const GAZE: [(f32, f32); 8] = [
    (0.0, -0.3),
    (1.4, -0.12),
    (2.8, -0.04),
    (4.2, -0.2),
    (5.8, -0.4),
    (7.6, -0.26),
    (9.4, -0.1),
    (12.0, -0.2),
];
/// The thighs among the body's cones (body.rs build): their far ends are
/// the knees.
const THIGHS: [usize; 2] = [5, 6];

pub struct Story {
    pub chapter: Chapter,
    pub loop_seconds: f32,
    /// How far the figure walks a loop; the floor and the motes repeat
    /// every `distance` so the loop closes.
    pub distance: f32,
    pub mote_box: f32,
    walk: Walk,
}

/// A camera: where it is, what it looks at, its zoom, focus and aperture.
#[derive(Clone, Copy)]
struct Shot {
    eye: V3,
    target: V3,
    lens: f32,
    focus: f32,
    aperture: f32,
}

impl Shot {
    fn blend(self, o: Shot, s: f32, eye: V3) -> Shot {
        self.aim(o, s, s, eye)
    }
    /// Toward `o` by `s`, its target by `aim`.
    fn aim(self, o: Shot, s: f32, aim: f32, eye: V3) -> Shot {
        Shot {
            eye,
            target: self.target.lerp(o.target, aim),
            lens: mix(self.lens, o.lens, s),
            focus: mix(self.focus, o.focus, s),
            aperture: mix(self.aperture, o.aperture, s),
        }
    }
    /// Toward `o` along a curve through `over`, `p` of the way in time.
    fn rise(self, o: Shot, p: f32, over: V3) -> Shot {
        if p <= 0.0 {
            return self;
        }
        if p >= 1.0 {
            return o;
        }
        let s = min_jerk(p);
        let r = 1.0 - s;
        let eye = self.eye * (r * r) + over * (2.0 * s * r) + o.eye * (s * s);
        self.blend(o, s, eye)
    }
    /// Toward `o` round the upright axis through `around`, `p` of the way
    /// in time. Going out, the gaze turns onto `o`'s first, then the eye
    /// turns, then it backs away; coming in is the same move run backwards.
    fn swing(self, o: Shot, p: f32, around: V3) -> Shot {
        if p <= 0.0 {
            return self;
        }
        if p >= 1.0 {
            return o;
        }
        let (a, b) = (self.eye - around, o.eye - around);
        if a.x.hypot(a.z) > b.x.hypot(b.z) {
            return o.swing(self, 1.0 - p, around);
        }
        let (ra, rb) = (a.x.hypot(a.z), b.x.hypot(b.z));
        let (za, zb) = (a.x.atan2(a.z), b.x.atan2(b.z));
        let turn = (zb - za + TAU * 1.5).rem_euclid(TAU) - TAU * 0.5;
        let aim = min_jerk(p / GAZE_LEAD);
        let s = min_jerk((p - SWING_LAG) / (1.0 - SWING_LAG));
        let (azimuth, radius) = (za + turn * s, mix(ra, rb, s * s.sqrt()));
        let eye = around
            + v3(
                radius * azimuth.sin(),
                mix(a.y, b.y, s),
                radius * azimuth.cos(),
            );
        self.aim(o, s, aim, eye)
    }
}

/// How lit and how far along the rest is, 0..1.
struct Cues {
    inner: [f32; 2],
    form: [f32; 2],
    flash: [f32; 2],
    /// The sweep's progress: unlit at the base before 0, at the top after 1.
    sweep: f32,
    filled: f32,
    fill: f32,
    threads: f32,
    /// The lock's wave: its origin, radius (< 0 none), light.
    wave: (V3, f32, f32),
}

/// 0 out … 1 in; a full in-breath on each beat.
fn breath(t: f32) -> f32 {
    0.5 + 0.5 * (TAU * t / BEAT).cos()
}

/// How far through `[a, b]` `t` is, 0..1.
fn stage(t: f32, [a, b]: [f32; 2]) -> f32 {
    ((t - a) / (b - a)).clamp(0.0, 1.0)
}

/// The crown ring's breath in turns: its own time first, then eased onto
/// the breath so that a full in-breath falls on the lock.
pub fn crown_phase(t: f32) -> f32 {
    let [a, b] = CONVERGE;
    let free = |t: f32| (t - CROWN_ORIGIN) / CROWN_PERIOD;
    if t < a {
        free(t)
    } else if t < b {
        hermite(a, free(a), 1.0 / CROWN_PERIOD, b, LOCK_TURNS, 1.0 / BEAT, t)
    } else {
        LOCK_TURNS + (t - b) / BEAT
    }
}

fn crown_rate(t: f32) -> f32 {
    let h = 1e-3;
    ((crown_phase(t + h) - crown_phase(t - h)) / (2.0 * h)).max(1e-3)
}

/// Page 01's crown ring: its latitude, light, flash and how much it scans.
fn arrive_crown(t: f32) -> (f32, f32, f32, f32) {
    let swing = CROWN_SWING * window(t, SCAN[4].0, SCAN[4].0 + 2.0, OUT[1][0], OUT[1][1]);
    let home = smooth(OUT[1][1], ARRIVE_LOOP - 0.4, t);
    let latitude = if t < SCAN[4].0 {
        monotone(&SCAN, t)
    } else {
        let held = CROWN_LAT + swing * (TAU * crown_phase(t)).cos();
        mix(held, SCAN[0].1, home)
    };
    let light = window(t, IGNITE - 0.4, IGNITE + 0.3, OUT[1][0], OUT[1][1]);
    // It flashes as it lights, on each of its own in-breaths, and on the
    // lock with the torso.
    let own = crown_phase(t).fract() / crown_rate(t);
    let flash = (1.4 * pulse(t - IGNITE))
        .max(0.45 * pulse(own) * smooth(SCAN[4].0, SCAN[4].0 + 2.0, t))
        .max(1.2 * pulse(t - ARRIVE_LOCK));
    let scan = window(t, IGNITE, IGNITE + 0.6, 9.6, 10.8);
    (latitude, light, flash, scan)
}

/// The torso ring: at the navel on the out-breath, the chest on the
/// in-breath, on the spine and leaning with it.
fn torso(body: &Body, breath: f32) -> (V3, V3, f32) {
    let (low, high) = (body.pelvis, body.chest);
    let along = (mix(TORSO[0], TORSO[1], breath) - low.y) / (high.y - low.y);
    let center = low + (high - low) * along;
    let normal = (Y + (body.chest_axes.up - Y) * 2.0).normalize();
    let radius = mix(TORSO_RADIUS[0], TORSO_RADIUS[1], breath);
    (center, normal, radius)
}

/// The legs ring rides the knees, lifting with each swinging leg, and
/// rocks with the stride: back while the left knee is ahead, down toward
/// the standing leg. `gait` turns once a stride (the left foot lands at 0).
fn legs(body: &Body, gait: f32, amount: f32) -> (V3, V3) {
    let knee = |i: usize| body.cones[3 * i + 1][1];
    let (l, r) = (knee(THIGHS[0]), knee(THIGHS[1]));
    let lift = LEGS_LIFT * amount * (0.5 - 0.5 * (2.0 * gait).cos());
    let center = v3(
        body.pelvis.x,
        0.5 * (l + r) + LEGS_HEIGHT + lift,
        body.pelvis.z,
    );
    let pitch = LEGS_SWING * amount * gait.cos();
    let roll = LEGS_ROLL * amount * gait.sin();
    let rocked = rotate(Y, body.pelvic.left, pitch);
    let normal = rotate(rocked, body.pelvic.forward, roll).normalize();
    (center, normal)
}

impl Story {
    pub fn new(chapter: Chapter) -> Story {
        let loop_seconds = chapter.loop_seconds();
        let steps = match chapter {
            Chapter::Hero => HERO_STEPS,
            Chapter::Arrive => ARRIVE_STEPS,
        };
        let distance = steps as f32 * STRIDE;
        Story {
            chapter,
            loop_seconds,
            distance,
            mote_box: distance / (distance / 10.0).round(),
            walk: Walk::steady(CADENCE, STRIDE, 0.06, -12, steps + 16, BEAT),
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

    /// Whole cycles a loop, about one in `about` seconds, as an angle.
    fn cycle(&self, t: f32, about: f32) -> f32 {
        let turns = (self.loop_seconds / about).round().max(1.0);
        TAU * turns * t / self.loop_seconds
    }

    /// The ground under the figure's walk, and the sphere's centre over it.
    fn ground(&self, t: f32) -> V3 {
        v3(0.0, 0.0, self.walk.track(t))
    }
    fn sphere(&self, t: f32) -> V3 {
        self.ground(t) + Y * SPHERE_HEIGHT
    }

    /// A slow drift, as from a hand.
    fn drift(&self, t: f32) -> V3 {
        v3(
            0.025 * self.cycle(t, 11.0).sin(),
            0.018 * (self.cycle(t, 7.0) + 1.0).sin(),
            0.015 * (self.cycle(t, 13.0) + 2.0).sin(),
        )
    }

    /// The crown ring at `t`, not wrapped: the ghosts look back past 0.
    fn crown(&self, t: f32) -> Ring {
        let at = t.rem_euclid(self.loop_seconds);
        let (latitude, light, flash, scan) = match self.chapter {
            Chapter::Hero => (
                CROWN_LAT + CROWN_SWING * (2.0 * breath(t) - 1.0),
                1.0,
                0.45 * pulse(at.rem_euclid(BEAT)),
                0.0,
            ),
            Chapter::Arrive => arrive_crown(at),
        };
        // Its axis leans and goes round, rocking to and fro with each step;
        // the lean itself keeps its size, so only the breath moves it up.
        let gait = TAU * t / (2.0 * CADENCE);
        let round = self.cycle(t, 8.8) + CROWN_ROCK * gait.sin();
        let normal = (Y + v3(round.sin(), 0.0, round.cos()) * CROWN_TILT).normalize();
        let rho = CROWN_SHARE * SPHERE_RADIUS;
        Ring {
            center: self.sphere(t) + normal * (rho * latitude.sin()),
            normal,
            radius: rho * latitude.cos(),
            light,
            flash,
            flow: self.cycle(t, 13.0),
            form: 1.0,
            scan,
        }
    }

    /// The third ring rising up the glass from where it meets the ground to
    /// its top.
    fn sweep(&self, t: f32, progress: f32) -> Ring {
        let rho = THIRD_SHARE * SPHERE_RADIUS;
        let base = (-(SPHERE_HEIGHT - 0.04) / rho).asin();
        let p = progress.clamp(0.0, 1.0);
        let latitude = mix(base, FRAC_PI_2, smooth(0.0, 1.0, p));
        let light = if (0.0..1.0).contains(&progress) {
            smooth(0.02, 0.2, p) * (1.0 - smooth(0.72, 1.0, p))
        } else {
            0.0
        };
        Ring {
            center: self.sphere(t) + Y * (rho * latitude.sin()),
            normal: Y,
            radius: rho * latitude.cos(),
            light,
            flash: 0.0,
            flow: 0.0,
            form: 1.0,
            scan: 0.0,
        }
    }

    /// Where the glass is filled up to while the sweep rises.
    fn sweep_fill(&self, t: f32, progress: f32) -> f32 {
        let p = progress.clamp(0.0, 1.0);
        self.sweep(t, p).center.y + 0.2 * p
    }

    fn hero(&self, t: f32) -> Frame {
        let turn = TAU * t / self.loop_seconds;
        let ground = self.ground(t);
        let azimuth = (-150.0 + 12.0 * turn.sin()).to_radians();
        let eye = ground
            + v3(
                4.5 * azimuth.sin(),
                2.5 + 0.15 * (turn + 1.0).sin(),
                4.5 * azimuth.cos(),
            )
            + self.drift(t);
        let shot = Shot {
            eye,
            target: ground + v3(0.0, 1.1, 0.5),
            lens: 1.0,
            focus: (eye - self.sphere(t)).length(),
            aperture: 0.007,
        };
        // The newest sweep's progress; after it the ring waits, unlit, at
        // the top.
        let sweep = HERO_SWEEPS
            .iter()
            .map(|s| (t - s).rem_euclid(self.loop_seconds) / SWEEP_SECONDS)
            .fold(f32::INFINITY, f32::min);
        let landed = self.since_landing(t);
        let cues = Cues {
            inner: [1.0; 2],
            form: [1.0; 2],
            flash: [0.5 * pulse(t.rem_euclid(BEAT)), 0.8 * pulse(landed)],
            sweep,
            filled: 1.0,
            fill: 9.0,
            threads: 1.0,
            wave: (Y, -1.0, 0.0),
        };
        self.frame(t, shot, cues)
    }

    fn arrive(&self, t: f32) -> Frame {
        let body = build(&self.walk.pose(t, breath(t)));
        let ground = self.ground(t);
        let over = ground + OVER_HEAD;
        let shot = self
            .eyes(t, &body)
            .rise(self.shoulder(t), stage(t, RISE), over)
            .swing(self.side(t), stage(t, SWING), ground)
            .swing(self.shoulder(t), stage(t, BACK), ground)
            .rise(self.eyes(t, &body), stage(t, DIVE), over);
        let inner = window(t, INNER[0] - 0.4, INNER[0] + 0.6, OUT[2][0], OUT[2][1]);
        let third = window(t, THIRD[0] - 0.3, THIRD[0] + 0.5, OUT[0][0], OUT[0][1]);
        let form = [
            window(t, INNER[0], INNER[1], OUT[2][1], OUT[2][1] + 1.0),
            window(t, THIRD[0], THIRD[1], OUT[0][1], OUT[0][1] + 1.0),
        ];
        let locked = pulse(t - ARRIVE_LOCK);
        let landed = self.since_landing(t);
        let progress = (t - ARRIVE_SWEEP) / SWEEP_SECONDS;
        // Unlit, it goes back down for the next loop.
        let sweep = if t < OUT[0][1] { progress } else { -1.0 };
        let fill = if progress < 1.0 {
            self.sweep_fill(t, progress)
        } else {
            SPHERE_HEIGHT + SPHERE_RADIUS + 0.2
        };
        let age = t - ARRIVE_LOCK;
        let wave = if (0.0..WAVE_SECONDS).contains(&age) {
            let at = build(&self.walk.pose(ARRIVE_LOCK, breath(ARRIVE_LOCK)));
            let fade = 1.0 - age / WAVE_SECONDS;
            (
                torso(&at, breath(ARRIVE_LOCK)).0,
                WAVE_SPEED * age,
                fade * fade * smooth(0.0, 0.1, age),
            )
        } else {
            (Y, -1.0, 0.0)
        };
        let cues = Cues {
            inner: [inner, third],
            form,
            flash: [
                (0.5 * pulse(t.rem_euclid(BEAT)) * form[0]).max(1.2 * locked),
                (0.8 * pulse(landed)).max(1.4 * pulse(t - THIRD[0])),
            ],
            sweep,
            filled: window(t, ARRIVE_SWEEP - 0.6, ARRIVE_SWEEP + 0.2, 35.6, 37.4),
            fill,
            threads: window(t, THREADS_ON[0], THREADS_ON[1], 35.0, 36.4),
            wave,
        };
        self.frame(t, shot, cues)
    }

    /// From the eyes, the gaze following the scan.
    fn eyes(&self, t: f32, body: &Body) -> Shot {
        let eye = body.head + v3(0.0, -0.03, 0.1) + self.drift(t) * 0.3;
        let slope = spline(&GAZE, t, self.loop_seconds);
        let look = v3(0.03 * self.cycle(t, 9.9).sin(), slope, 1.0).normalize();
        Shot {
            eye,
            target: eye + look * 6.0,
            lens: 0.62,
            focus: 2.6,
            aperture: 0.0018,
        }
    }

    /// Behind the right shoulder and above it, looking ahead past the head.
    fn shoulder(&self, t: f32) -> Shot {
        let ground = self.ground(t);
        let eye = ground + v3(-0.55, 2.35, -1.8) + self.drift(t);
        Shot {
            eye,
            target: ground + v3(0.12, 0.85, 2.2),
            lens: 0.8,
            focus: (eye - ground - v3(0.0, 1.45, 0.0)).length(),
            aperture: 0.007,
        }
    }

    /// From the figure's right side and above, coming slowly closer.
    fn side(&self, t: f32) -> Shot {
        let ground = self.ground(t);
        let closer = mix(1.03, 0.97, smooth(SWING[1], BACK[0], t));
        let eye = ground + v3(-5.4 * closer, 3.3, 0.6) + self.drift(t);
        Shot {
            eye,
            target: ground + v3(0.0, 1.0, 0.45),
            lens: 1.0,
            focus: (eye - self.sphere(t)).length(),
            aperture: 0.007,
        }
    }

    fn since_landing(&self, t: f32) -> f32 {
        self.walk.landings(t).next().map_or(99.0, |s| t - s.land)
    }

    /// The frame from the chapter's camera and cues; the figure, its rings
    /// and its traces come from the walk.
    fn frame(&self, t: f32, shot: Shot, cues: Cues) -> Frame {
        let breath = breath(t);
        let walk = &self.walk;
        let amount = walk.amount(t);
        let pose = walk.pose(t, breath);
        let body = build(&pose);
        let track = walk.track(t);
        let forward = (shot.target - shot.eye).normalize();
        let right = forward.cross(Y).normalize();
        let up = right.cross(forward);
        let (torso_center, torso_normal, torso_radius) = torso(&body, breath);
        let gait = TAU * t / (2.0 * CADENCE);
        let (legs_center, legs_normal) = legs(&body, gait, amount);
        let rings = [
            self.crown(t),
            Ring {
                center: torso_center,
                normal: torso_normal,
                radius: torso_radius,
                light: cues.inner[0],
                flash: cues.flash[0],
                flow: self.cycle(t, 8.8),
                form: cues.form[0],
                scan: 0.0,
            },
            Ring {
                center: legs_center,
                normal: legs_normal,
                radius: LEGS_RADIUS,
                light: cues.inner[1],
                flash: cues.flash[1],
                flow: -self.cycle(t, 6.6),
                form: cues.form[1],
                scan: 0.0,
            },
            self.sweep(t, cues.sweep),
        ];
        let ghosts = std::array::from_fn(|k| {
            let r = self.crown(t - (k + 1) as f32 * GHOST_STEP);
            let fade = 1.0 - (k + 1) as f32 / (GHOSTS + 1) as f32;
            (r.center, r.normal, r.radius, r.light * fade * fade)
        });
        let mut prints = [[0.0, 0.0, 0.0, 99.0]; PRINTS];
        for (slot, s) in prints.iter_mut().zip(walk.landings(t)) {
            let yaw = if s.side == 0 { TOE_OUT } else { -TOE_OUT };
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
        let (origin, lock_radius, lock_light) = cues.wave;
        Frame {
            time: t,
            eye: shot.eye,
            right,
            up,
            forward,
            focus: shot.focus,
            lens: shot.lens,
            aperture: shot.aperture,
            breath,
            body,
            body_light: 1.0,
            sphere: self.sphere(t),
            latent: 1.0,
            filled: cues.filled,
            fill: cues.fill,
            rings,
            ghosts,
            threads: cues.threads,
            prints,
            feet,
            floor: 1.0,
            world: 1.0,
            lock: [origin.x, origin.y, origin.z, lock_light],
            lock_radius,
            distance: self.distance,
            mote_box: self.mote_box,
            track,
            amount,
        }
    }
}
