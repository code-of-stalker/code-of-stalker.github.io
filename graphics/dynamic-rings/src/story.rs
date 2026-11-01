//! The chapters: what the camera, the figure, its sphere and the rings in
//! it do through each page's loop. Everything is a pure function of loop
//! time.
use crate::body::{build, Body, Walk, TOE_OUT};
use crate::math::{hermite, min_jerk, mix, monotone, pulse, smooth, v3, window, V3, Y};
use crate::{
    Frame, Ring, Tentacle, BEAT, CROWN_FLOOR, CROWN_PERIOD, CROWN_SHARE, CROWN_TILT, CROWN_TOP,
    GHOSTS, GHOST_STEP, PRINTS, SCANNER, SCANNER_FLOOR, SPHERE_HEIGHT, SPHERE_RADIUS, SPHERE_SHARE,
    SPIN_PERIOD, SWEEP, TENTACLES, THINGS, WRITHE,
};
use std::f32::consts::{PI, TAU};

/// How far the crown ring's lean swings round with each step, radians.
const CROWN_ROCK: f32 = 0.35;

/// The cover and the pages of Step 7 that have a scene so far.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Chapter {
    /// The step's cover: the figure walks inside its turning sphere, every
    /// ring held in one slow rhythm, seen from behind and above. At first
    /// there is only that; then one thing it passes is scanned, one wire
    /// reaches for it and crumbles on the glass, and more and more of both
    /// come, till it quietens again.
    Hero,
    /// Page 01: from the eyes the outer ring sweeps the glass and scans the
    /// world; over the shoulder the scanner gathers round the figure and
    /// the two keep different times; from the side they lock and the
    /// sphere starts to turn, lighting the glass. Then all is held while
    /// the figure walks, and the camera returns to the eyes.
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
            Chapter::Hero => 40.0,
            Chapter::Arrive => 36.0,
        }
    }
    /// When the glass passes each thing the walk meets (s).
    pub fn things(self) -> &'static [f32] {
        match self {
            Chapter::Hero => &HERO_THINGS,
            Chapter::Arrive => &ARRIVE_THINGS,
        }
    }
    /// When each wire breaks on the glass (s); they take turns, wire `i` is
    /// `i % TENTACLES`.
    pub fn wires(self) -> &'static [f32] {
        match self {
            Chapter::Hero => &HERO_WIRES,
            Chapter::Arrive => &ARRIVE_WIRES,
        }
    }
}

/// The cover: 12 breaths, 96 steps.
pub const HERO_LOOP: f32 = 52.8;
const HERO_STEPS: i32 = 96;
/// On the cover, after a quiet start, one thing, then one wire, then more
/// and more of both, closer together, and a quiet end.
const HERO_THINGS: [f32; 11] = [
    7.0, 18.0, 24.5, 29.0, 32.5, 35.0, 37.0, 38.8, 40.4, 42.0, 43.4,
];
const HERO_WIRES: [f32; 11] = [
    13.0, 21.5, 27.0, 31.0, 34.0, 36.3, 38.2, 39.8, 41.2, 42.6, 44.0,
];
/// On page 01 the same, once the sphere turns.
const ARRIVE_THINGS: [f32; 5] = [28.6, 31.6, 33.8, 35.4, 36.6];
const ARRIVE_WIRES: [f32; 4] = [30.2, 32.8, 34.6, 36.0];
/// Page 01: 10 breaths, 80 steps.
pub const ARRIVE_LOOP: f32 = 44.0;
const ARRIVE_STEPS: i32 = 80;
/// A step every `CADENCE` s, `STRIDE` m long: eight steps a breath.
pub const CADENCE: f32 = 0.55;
pub const STRIDE: f32 = 0.62;

/// Page 01. The crown ring lights at the top of the glass and sweeps it
/// to the ground and back in its own time.
const IGNITE: f32 = 1.2;
/// The scanner gathers out of scattered beads.
const INNER: [f32; 2] = [12.0, 14.2];
/// The crown keeps its own time until it eases onto the scanner's; they
/// lock at the top of a sweep.
pub const ARRIVE_LOCK: f32 = 26.4;
const CONVERGE: [f32; 2] = [18.0, ARRIVE_LOCK];
const LOCK_TURNS: f32 = 2.0;
/// From the lock's wave the sphere's ring lights and turns, from rest to
/// rest, speeding up and slowing down over `SPIN_RAMP` s; spokes run out
/// from the scanner to the crown, and the things and the wires come.
const SPIN: [f32; 2] = [26.7, 40.8];
const SPIN_RAMP: f32 = 2.0;
const SPOKES_ON: [f32; 2] = [27.2, 28.8];
const WORLD_ON: [f32; 4] = [27.0, 29.0, 38.8, 40.0];
/// The rings go out one by one, the sphere's, the crown, the scanner, and
/// the glass empties.
const OUT: [[f32; 2]; 3] = [[39.6, 40.8], [40.0, 41.4], [40.4, 41.8]];
/// The lock's wave runs out from the scanner this fast, for this long.
const WAVE_SPEED: f32 = 2.4;
const WAVE_SECONDS: f32 = 2.6;

/// Page 01's camera: from the eyes it rises out of the head to over the
/// right shoulder, swings round to the side, and comes back the same way.
const RISE: [f32; 2] = [10.4, 13.6];
const SWING: [f32; 2] = [21.2, 26.4];
/// In a swing the gaze moves over this share of it, the eye over the rest
/// from this share on.
const GAZE_LEAD: f32 = 0.6;
const SWING_LAG: f32 = 0.12;
const BACK: [f32; 2] = [38.0, 42.2];
const DIVE: [f32; 2] = [41.4, 44.0];
/// The way out of the head and back in passes over it.
const OVER_HEAD: V3 = v3(-0.15, 2.45, 0.05);
/// From the eyes the gaze follows the crown ring up and down: this much
/// slope a metre it is above the eyes, within these.
const GAZE_FOLLOW: f32 = 0.3;
const GAZE_SLOPE: [f32; 2] = [-0.32, 0.16];

/// A wire reaches for the glass this long (s) before it breaks, and is
/// gone this long after.
const WIRE_REACH: f32 = 3.2;
const WIRE_AFTER: f32 = 3.4;
/// Their roots stand either side of the walk, this far aside and on ahead
/// of the line across the cover camera's view through where the glass is
/// when they break (m): they come in out of the dark and meet its rim.
const TENTACLE_ASIDE: [f32; 2] = [1.7, 3.4];
const TENTACLE_AHEAD: [f32; 2] = [-0.5, 2.5];
/// The cover's camera stands this way round from the glass (radians).
const COVER_AZIMUTH: f32 = -150.0 * PI / 180.0;

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
    inner: f32,
    form: f32,
    flash: f32,
    /// The sphere's ring: how lit, how far turned (radians), how fast (of
    /// full speed), its flash.
    spin: [f32; 4],
    filled: f32,
    fill: f32,
    spokes: f32,
    /// The things the walk passes and the wires.
    world: f32,
    /// The lock's wave: its origin, radius (< 0 none), light.
    wave: (V3, f32, f32),
}

/// 0 out … 1 in; a full in-breath on each beat.
fn breath(t: f32) -> f32 {
    0.5 + 0.5 * (TAU * t / BEAT).cos()
}

/// The scanner's height, 0 the feet … 1 the head; the top on each sweep.
fn sweep(t: f32) -> f32 {
    0.5 + 0.5 * (TAU * t / SWEEP).cos()
}

/// How far through `[a, b]` `t` is, 0..1.
fn stage(t: f32, [a, b]: [f32; 2]) -> f32 {
    ((t - a) / (b - a)).clamp(0.0, 1.0)
}

/// A small hash: 0..1 for each number (common.glsl rand).
fn rand(x: u32) -> f32 {
    let mut x = x;
    x ^= x >> 16;
    x = x.wrapping_mul(0x7feb_352d);
    x ^= x >> 15;
    x = x.wrapping_mul(0x846c_a68b);
    x ^= x >> 16;
    (x >> 8) as f32 / 16_777_215.0
}

/// The crown ring's sweeps in turns: its own time from when it lights,
/// then eased onto the scanner's so that both are at the top on the lock.
pub fn crown_phase(t: f32) -> f32 {
    let [a, b] = CONVERGE;
    let free = |t: f32| (t - IGNITE) / CROWN_PERIOD;
    if t < a {
        free(t)
    } else if t < b {
        hermite(
            a,
            free(a),
            1.0 / CROWN_PERIOD,
            b,
            LOCK_TURNS,
            1.0 / SWEEP,
            t,
        )
    } else {
        LOCK_TURNS + (t - b) / SWEEP
    }
}

fn crown_rate(t: f32) -> f32 {
    let h = 1e-3;
    ((crown_phase(t + h) - crown_phase(t - h)) / (2.0 * h)).max(1e-3)
}

/// Page 01's crown ring: how high it is (0 at the ground … 1 at the top),
/// its light, flash and how much it scans.
fn arrive_crown(t: f32) -> (f32, f32, f32, f32) {
    let high = if t < IGNITE {
        1.0
    } else {
        0.5 + 0.5 * (TAU * crown_phase(t)).cos()
    };
    let light = window(t, IGNITE - 0.4, IGNITE + 0.3, OUT[1][0], OUT[1][1]);
    // It flashes as it lights, at the top of each of its sweeps, and on
    // the lock with the scanner.
    let own = crown_phase(t).rem_euclid(1.0) / crown_rate(t);
    let flash = (1.4 * pulse(t - IGNITE))
        .max(0.45 * pulse(own) * smooth(IGNITE + 2.0, IGNITE + 4.0, t))
        .max(1.2 * pulse(t - ARRIVE_LOCK));
    (high, light, flash, light)
}

/// The crown ring's height over the sphere's centre, `high` 0 at the
/// ground … 1 at the top.
fn crown_height(high: f32) -> f32 {
    let rho = CROWN_SHARE * SPHERE_RADIUS;
    mix(CROWN_FLOOR - SPHERE_HEIGHT, rho * CROWN_TOP.sin(), high)
}

/// How far the sphere's ring has turned on page 01 (radians) and how fast,
/// of full speed: from rest to rest, whole turns.
fn arrive_spin(t: f32) -> (f32, f32) {
    let [a, b] = SPIN;
    let r = SPIN_RAMP;
    // The run of a smoothstep's rise: ∫ 3x² − 2x³ = x³ − x⁴ / 2.
    let ramp = |x: f32| {
        let x = x.clamp(0.0, 1.0);
        r * x * x * x * (1.0 - 0.5 * x)
    };
    let total = b - a - r;
    let run = if t < a + r {
        ramp((t - a) / r)
    } else if t < b - r {
        0.5 * r + (t - a - r)
    } else {
        total - ramp((b - t) / r)
    };
    let turns = (total / SPIN_PERIOD).round().max(1.0);
    (TAU * turns * run / total, window(t, a, a + r, b - r, b))
}

/// The body's scanner at `high` (0 the feet … 1 the top of the head):
/// level, round the body's axis at that height, hugging the figure.
fn scanner(body: &Body, high: f32) -> (V3, f32) {
    let y = mix(SCANNER_FLOOR, body.high.y - 0.03, high);
    let (p, c, h) = (body.pelvis, body.chest, body.head);
    let along = |a: V3, b: V3| a.lerp(b, ((y - a.y) / (b.y - a.y)).clamp(0.0, 1.0));
    let axis = if y <= c.y { along(p, c) } else { along(c, h) };
    (v3(axis.x, y, axis.z), monotone(&SCANNER, y))
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
        let (high, light, flash, scan) = match self.chapter {
            Chapter::Hero => (sweep(t), 1.0, 0.45 * pulse(at.rem_euclid(SWEEP)), 1.0),
            Chapter::Arrive => arrive_crown(at),
        };
        let h = crown_height(high);
        // Its axis leans and goes round, rocking to and fro with each step;
        // near the ground it lies level.
        let gait = TAU * t / (2.0 * CADENCE);
        let round = self.cycle(t, 17.6) + CROWN_ROCK * gait.sin();
        let lean = CROWN_TILT * smooth(CROWN_FLOOR - SPHERE_HEIGHT, -0.3, h);
        let normal = (Y + v3(round.sin(), 0.0, round.cos()) * lean).normalize();
        let rho = CROWN_SHARE * SPHERE_RADIUS;
        Ring {
            center: self.sphere(t) + normal * h,
            normal,
            radius: (rho * rho - h * h).max(0.0).sqrt(),
            light,
            flash,
            flow: self.cycle(t, 26.0),
            form: 1.0,
            scan,
        }
    }

    /// The sphere's own ring: upright on the glass, turned `turned` about
    /// the upright axis.
    fn sphere_ring(&self, t: f32, [light, turned, speed, flash]: [f32; 4]) -> Ring {
        Ring {
            center: self.sphere(t),
            normal: v3(turned.cos(), 0.0, -turned.sin()),
            radius: SPHERE_SHARE * SPHERE_RADIUS,
            light,
            flash,
            flow: turned,
            form: speed,
            scan: 0.0,
        }
    }

    /// Wire `k`: on each of its turns in the chapter's list it grows out
    /// of the ground and reaches for the glass, writhing, its tip following
    /// the walking figure; it breaks on the glass and crumbles from the tip
    /// back to the root. Between turns it is dark.
    fn tentacle(&self, k: usize, t: f32, light: f32) -> Tentacle {
        let l = self.loop_seconds;
        let lasts = WIRE_REACH + WIRE_AFTER;
        // Its turn now, or else its next one.
        let (mut now, mut next) = (None, None::<(usize, f32)>);
        let turns = self.chapter.wires().iter().enumerate();
        for (i, &b) in turns.skip(k).step_by(TENTACLES) {
            for start in [-l, 0.0, l].map(|m| b - WIRE_REACH + m) {
                if (start..=start + lasts).contains(&t) {
                    now = Some((i, start));
                } else if start > t && next.is_none_or(|(_, s)| start < s) {
                    next = Some((i, start));
                }
            }
        }
        let (i, start) = now.or(next).unwrap_or((TENTACLES + k, t + 1.0));
        let since = t - start;
        let r = |j: u32| rand(i as u32 * 131 + j * 7 + 5);
        let reach_for = WIRE_REACH;
        let breaks = start + reach_for;
        let side = if i.is_multiple_of(2) { 1.0 } else { -1.0 };
        let (aside, ahead) = (
            side * mix(TENTACLE_ASIDE[0], TENTACLE_ASIDE[1], r(1)),
            mix(TENTACLE_AHEAD[0], TENTACLE_AHEAD[1], r(0)),
        );
        let out = v3(aside, 0.0, ahead - aside * COVER_AZIMUTH.tan());
        let root = self.ground(breaks) + out;
        // It meets the glass on the side facing its root, high or low.
        let azimuth = out.x.atan2(out.z) + 0.5 * (r(4) - 0.5);
        let elevation = mix(0.08, 0.8, r(2));
        let toward = v3(
            azimuth.sin() * elevation.cos(),
            elevation.sin(),
            azimuth.cos() * elevation.cos(),
        );
        // Till it breaks its tip follows the glass; then it all stays.
        let at = since.min(reach_for);
        let tip = self.sphere(t - since + at) + toward * (SPHERE_RADIUS + 0.015);
        let span = tip - root;
        let rise = root + Y * mix(0.5, 1.8, r(3)) + v3(span.x, 0.0, span.z) * 0.25;
        let near = tip + toward * (0.3 * span.length());
        let writhe = |t: f32| self.cycle(t, TAU / WRITHE) + 1.7 * k as f32;
        let broken = since - reach_for;
        let s = (since / reach_for).clamp(0.0, 1.0);
        Tentacle {
            points: [root, rise, near, tip],
            reach: s * s * (2.0 - s),
            broken: if broken >= 0.0 { broken } else { -1.0 },
            light: light * smooth(0.0, 0.5, since) * (1.0 - smooth(lasts - 0.5, lasts, since)),
            writhe: if broken >= 0.0 {
                writhe(breaks) + 0.25 * WRITHE * (1.0 - (-broken / 0.25).exp())
            } else {
                writhe(t)
            },
            writhe_at_break: writhe(breaks),
            contact: toward,
        }
    }

    fn hero(&self, t: f32) -> Frame {
        let turn = TAU * t / self.loop_seconds;
        let ground = self.ground(t);
        let azimuth = COVER_AZIMUTH + (12.0 * turn.sin()).to_radians();
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
        let beat = t.rem_euclid(SWEEP);
        let cues = Cues {
            inner: 1.0,
            form: 1.0,
            flash: 0.5 * pulse(beat),
            spin: [
                1.0,
                self.cycle(t, SPIN_PERIOD),
                1.0,
                0.4 * pulse(t.rem_euclid(SPIN_PERIOD)),
            ],
            filled: 1.0,
            fill: TAU,
            spokes: 1.0,
            world: 1.0,
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
        let form = window(t, INNER[0], INNER[1], OUT[2][1], OUT[2][1] + 1.0);
        let locked = pulse(t - ARRIVE_LOCK);
        let (turned, speed) = arrive_spin(t);
        let age = t - ARRIVE_LOCK;
        let wave = if (0.0..WAVE_SECONDS).contains(&age) {
            let at = build(&self.walk.pose(ARRIVE_LOCK, breath(ARRIVE_LOCK)));
            let fade = 1.0 - age / WAVE_SECONDS;
            (
                scanner(&at, sweep(ARRIVE_LOCK)).0,
                WAVE_SPEED * age,
                fade * fade * smooth(0.0, 0.1, age),
            )
        } else {
            (Y, -1.0, 0.0)
        };
        let [on, full, off, out] = WORLD_ON;
        let cues = Cues {
            inner,
            form,
            flash: (0.5 * pulse(t.rem_euclid(SWEEP)) * form).max(1.2 * locked),
            spin: [
                window(t, SPIN[0] - 0.3, SPIN[0] + 0.5, OUT[0][0], OUT[0][1]),
                turned,
                speed,
                1.4 * pulse(t - SPIN[0]),
            ],
            filled: window(t, SPIN[0] - 0.1, SPIN[0] + 0.7, OUT[1][0], OUT[2][1]),
            fill: turned,
            spokes: window(t, SPOKES_ON[0], SPOKES_ON[1], 39.4, 40.8),
            world: window(t, on, full, off, out),
            wave,
        };
        self.frame(t, shot, cues)
    }

    /// From the eyes, the gaze following the crown ring up and down.
    fn eyes(&self, t: f32, body: &Body) -> Shot {
        let eye = body.head + v3(0.0, -0.03, 0.1) + self.drift(t) * 0.3;
        let [low, high] = GAZE_SLOPE;
        let slope = (GAZE_FOLLOW * (self.crown(t).center.y - eye.y)).clamp(low, high);
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
        let (scan_center, scan_radius) = scanner(&body, sweep(t));
        let rings = [
            self.crown(t),
            Ring {
                center: scan_center,
                normal: Y,
                radius: scan_radius,
                light: cues.inner,
                flash: cues.flash,
                flow: self.cycle(t, 17.6),
                form: cues.form,
                scan: 0.0,
            },
            self.sphere_ring(t, cues.spin),
        ];
        let ghosts = std::array::from_fn(|k| {
            let r = self.crown(t - (k + 1) as f32 * GHOST_STEP);
            let fade = 1.0 - (k + 1) as f32 / (GHOSTS + 1) as f32;
            (r.center, r.normal, r.radius, r.light * fade * fade)
        });
        let tentacles = std::array::from_fn(|k| self.tentacle(k, t, cues.world));
        let mut things_at = [[0.0; 2]; THINGS as usize];
        for (slot, &at) in things_at.iter_mut().zip(self.chapter.things()) {
            *slot = [self.ground(at).z, 1.0];
        }
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
            fill: cues.fill.min(PI + 0.5),
            rings,
            ghosts,
            spokes: cues.spokes,
            things: cues.world,
            things_at,
            tentacles,
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
