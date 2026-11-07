//! The chapters: what the camera, the figure, its sphere and the rings in
//! it do through each page's loop. Everything is a pure function of loop
//! time.
use crate::body::{build, Axes, Body, Pose, Rest, Step, Walk, PRIMITIVES, SEAT_BACK, TOE_OUT};
use crate::math::{hermite, min_jerk, mix, monotone, pulse, smooth, v3, window, V3, Y};
use crate::{
    Frame, Ring, Tentacle, BEAT, CASTERS, CROWN_FLOOR, CROWN_PERIOD, CROWN_SHARE, CROWN_TILT,
    CROWN_TOP, DESK_AHEAD, EVENTS, GHOSTS, GHOST_STEP, GLYPHS, LAPTOP_TOP, LID_HEIGHT, LID_HINGE,
    LID_OPEN, PLANET_RADIUS, PRINTS, SCANNER, SCANNER_FLOOR, SEATS, SPHERE_HEIGHT, SPHERE_RADIUS,
    SPHERE_SHARE, SPIN_PERIOD, SWEEP, TENTACLES, THINGS, VOICES, WRITHE,
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
    /// Page 02: inside its sphere, every ring held softly, the figure types
    /// at a desk of light; it closes the lid, the desk goes, it rises and
    /// the rings answer one after another. It walks to meet someone coming
    /// the other way outside the glass; they stop and talk, their words
    /// rings of light between them, and part. It walks on, a seat builds
    /// where it stops, it sits, a desk comes, it opens the lid and types
    /// again. Nothing of the sphere is lost through any of it.
    Life,
    /// Page 03: night. The figure stands in its sphere, its outer ring
    /// sweeping the glass; out of the dark a passer-by comes with a lantern,
    /// walks once round the glass and goes on. The figure's shadows run long
    /// over the planet and swing round it, the glass marks the light and the
    /// shade, each step rings out on the ground. Seen from overhead, the
    /// camera slowly going round.
    Night,
    /// Page 04: the figure walks in its sphere, seen from afar; only the
    /// crown and the scanner are lit. Four times something flares in it, a
    /// thought at the head, a feeling at the chest, an urge in the hand, a
    /// touch at the knee, each smaller than the last: it branches out warm
    /// and the crown dims as it draws the figure in (for the thought it
    /// stops). The scanner reaches it, the branches fold into one bead, the
    /// crown burns again and the bead rides the scanner on.
    Inner,
}

impl Chapter {
    pub fn from_code(code: u32) -> Chapter {
        match code {
            1 => Chapter::Arrive,
            2 => Chapter::Life,
            3 => Chapter::Night,
            4 => Chapter::Inner,
            _ => Chapter::Hero,
        }
    }
    pub fn loop_seconds(self) -> f32 {
        match self {
            Chapter::Hero => HERO_LOOP,
            Chapter::Arrive => ARRIVE_LOOP,
            Chapter::Life => LIFE_LOOP,
            Chapter::Night => NIGHT_LOOP,
            Chapter::Inner => INNER_LOOP,
        }
    }
    /// Reduced motion holds one moment with every ring.
    pub fn still(self) -> f32 {
        match self {
            Chapter::Hero => 40.0,
            Chapter::Arrive => 36.0,
            Chapter::Life => 22.0,
            Chapter::Night => 22.0,
            Chapter::Inner => 48.5,
        }
    }
    /// When the glass passes each thing the walk meets (s).
    pub fn things(self) -> &'static [f32] {
        match self {
            Chapter::Hero => &HERO_THINGS,
            Chapter::Arrive => &ARRIVE_THINGS,
            Chapter::Life | Chapter::Night | Chapter::Inner => &[],
        }
    }
    /// When each wire breaks on the glass (s); they take turns, wire `i` is
    /// `i % TENTACLES`.
    pub fn wires(self) -> &'static [f32] {
        match self {
            Chapter::Hero => &HERO_WIRES,
            Chapter::Arrive => &ARRIVE_WIRES,
            Chapter::Life | Chapter::Night | Chapter::Inner => &[],
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
/// From the eyes the head looks round before it rises out: each turn
/// (start, end, to this yaw in radians, left is +x) eases from rest to rest.
const LOOK_ROUND: [[f32; 3]; 3] = [[1.2, 3.6, 0.75], [4.4, 7.4, -0.75], [8.0, 10.2, 0.0]];

/// Page 02: 14 breaths. At a desk of light it types; it closes the lid and
/// the desk goes; it rises over `LIFE_UP` and the rings answer as it
/// stands, at `LIFE_GATHER`. It walks to meet someone coming the other way,
/// they talk and part, and it walks on to the next seat and sits down over
/// `LIFE_DOWN`; a desk comes, it opens the lid and types again.
pub const LIFE_LOOP: f32 = 61.6;
pub const LIFE_UP: [f32; 2] = [6.0, 9.8];
const LIFE_GATHER: f32 = 9.8;
pub const LIFE_DOWN: [f32; 2] = [45.4, 49.6];
/// Its bouts of walking: the first heel strike and how many strides (even),
/// from half a stride on; two short steps bring the feet together after each.
const LIFE_BOUTS: [(f32, usize); 2] = [(11.2, 10), (29.8, 24)];
/// The seat left behind melts over `LIFE_LEAVE`; the next builds over
/// `LIFE_BUILD`, once the feet are clear of it.
const LIFE_LEAVE: [f32; 2] = [12.5, 18.5];
const LIFE_BUILD: [f32; 2] = [43.5, 45.2];
/// Seated and stopped, the feet stand this far either side; walking, the
/// steps land this far either side.
const LIFE_STANCE: f32 = 0.11;
const LIFE_WIDTH: f32 = 0.06;
/// The seat stands this much further back than the pelvis on it.
const SEAT_SET: f32 = 0.02;
/// On page 02 the rings and the glass are held softer, so that what the
/// figure does comes first: the crown, the scanner, the sphere's ring; the
/// glass before and after it fills.
pub const LIFE_RINGS: [f32; 3] = [0.62, 0.72, 0.56];
pub const LIFE_GLASS: [f32; 2] = [0.5, 0.42];

/// The desks: the first goes, the next comes. At the first it types till
/// the first of `LID_CLOSES`; its right hand goes to the lid, closes it, and
/// both hands come back to rest. At the next its right hand goes to the
/// lid, opens it, both go to the keys, and from the last of `LID_OPENS` it
/// types on where it left off.
const DESK_GONE: [f32; 2] = [5.4, 6.6];
const DESK_COMES: [f32; 2] = [49.6, 50.8];
const LID_CLOSES: [f32; 4] = [4.2, 4.6, 5.3, 5.8];
const LID_OPENS: [f32; 4] = [50.8, 51.2, 52.1, 52.6];
/// The page holds this many glyphs as the loop starts; a page of them is
/// typed a loop.
const TEXT_START: f32 = 20.0;
/// Typing, its head bows and its trunk leans this much more (radians), and
/// its hands bend this far down at the wrist.
const TYPING_NOD: f32 = 0.25;
const TYPING_LEAN: f32 = 0.1;
const TYPING_WRIST: f32 = 0.55;

/// The one it meets walks the other way along a line this far to the
/// figure's left (+x), from this far on (z), in two bouts: up to where they
/// meet, just outside the glass, and on after the talk. It is seen only
/// between the first two and the last two of `OTHER_SHOWN`.
const OTHER_ASIDE: f32 = 1.75;
const OTHER_FROM: f32 = 21.24;
const OTHER_BOUTS: [(f32, usize); 2] = [(4.2, 22), (29.6, 24)];
const OTHER_SHOWN: [f32; 4] = [1.0, 4.0, 38.0, 42.0];
/// They turn their heads to each other this far (radians; the chests and
/// the pelvises take less), the figure and then the other over each's times.
const TALK_TURN: f32 = 0.9;
const FACING: [[f32; 4]; 2] = [[17.0, 18.2, 28.6, 29.6], [16.6, 17.8, 28.6, 29.4]];
/// Who speaks (0 the figure, 1 the other) from when to when; they nod to
/// part.
pub const TALK: [(usize, f32, f32); 4] = [
    (1, 18.3, 20.7),
    (0, 21.1, 23.6),
    (1, 24.0, 25.8),
    (0, 26.2, 27.8),
];
const FAREWELL: f32 = 28.0;
/// A voice: a ring about every `VOICE_EVERY` s from the speaker's mouth
/// toward the listener's, this fast, this long, growing between these radii.
const VOICE_EVERY: f32 = 0.3;
const VOICE_SPEED: f32 = 1.6;
pub const VOICE_LIFE: f32 = 1.1;
const VOICE_RADIUS: [f32; 2] = [0.08, 0.42];

/// Page 02's camera: round the figure this way (degrees from straight
/// ahead, + to its left), this far, its eye this high, looking at this
/// point over the ground under it (x, y, z), with this lens. It starts at
/// `LIFE_VIEW`, close over the left shoulder onto the screen, the glass
/// about the frame, and eases to each key over its times: back to the side
/// as it rises, behind it to see who comes, across the two as they meet,
/// round past the other's shoulder to its face as it speaks, back to the
/// other's as that answers, before it to lead the walk, down to the side as
/// it sits, and in over the shoulder again.
const LIFE_VIEW: [f32; 7] = [118.0, 2.5, 1.55, 0.0, 0.88, 0.3, 1.0];
const LIFE_KEYS: [([f32; 2], [f32; 7]); 9] = [
    ([5.4, 9.2], [96.0, 3.9, 1.15, 0.0, 0.95, 0.05, 0.72]),
    ([9.8, 15.6], [142.0, 5.0, 1.6, 0.7, 1.0, 1.5, 0.86]),
    ([15.6, 19.0], [140.0, 4.7, 1.5, 0.7, 1.05, 0.6, 0.88]),
    ([20.2, 23.4], [100.0, 4.0, 1.45, 0.5, 1.1, 0.6, 0.86]),
    ([23.6, 26.4], [152.0, 4.4, 1.5, 0.8, 1.05, 0.7, 0.9]),
    ([28.6, 39.0], [12.0, 4.6, 2.0, 0.0, 0.95, -0.1, 0.92]),
    ([39.6, 46.0], [70.0, 3.8, 1.1, 0.0, 0.85, 0.1, 0.72]),
    ([48.0, 52.0], [120.0, 3.2, 1.15, 0.0, 0.87, 0.2, 0.74]),
    ([51.5, 56.0], LIFE_VIEW),
];

/// Page 03: 10 breaths. The figure stands; the passer-by walks the whole
/// loop, a step every `NIGHT_CADENCE` s, `NIGHT_STRIDE` m long.
pub const NIGHT_LOOP: f32 = 44.0;
const NIGHT_CADENCE: f32 = 0.6;
const NIGHT_STRIDE: f32 = 0.6;
const NIGHT_WIDTH: f32 = 0.07;
/// It comes up from behind along a line this far to the figure's right,
/// is abeam it this far along its walk, goes once round it, its left to the
/// glass, and on the way it came.
const NIGHT_LAP: f32 = 2.7;
const NIGHT_MEET: f32 = 13.0;
/// It and its lantern come out of the dark and go back into it over these.
pub const NIGHT_SHOWN: [f32; 4] = [1.0, 5.0, 36.0, 41.0];
/// The lantern hangs this far under the left hand, which holds it out
/// from the hip, and swings this much with the gait.
const LAMP_HANG: f32 = 0.14;
const LAMP_SWING: f32 = 0.03;
/// Round the glass the passer-by looks at it this far (radians); the
/// figure turns its head after the light this far.
const NIGHT_LOOK: f32 = 0.35;
const FIGURE_LOOK: f32 = 0.55;
/// At night only the crown, ring 1, is lit: the scanner and the sphere's
/// ring wait for pages 04 and 05. The glass before and after it fills is
/// this faint, and the floor and the world round it this.
const NIGHT_RINGS: [f32; 3] = [1.0, 0.0, 0.0];
const NIGHT_GLASS: [f32; 2] = [0.3, 0.2];
const NIGHT_FLOOR: f32 = 0.08;
const NIGHT_WORLD: f32 = 0.6;
/// The camera: out beside the glass, a little over the figure's head,
/// looking at the glass's middle and going once round it a loop from this
/// way round (radians), with this lens.
const NIGHT_AZIMUTH: f32 = -1.3;
const NIGHT_RANGE: f32 = 7.0;
const NIGHT_HIGH: f32 = 2.2;
const NIGHT_AIM: f32 = 0.95;
const NIGHT_LENS: f32 = 1.0;
/// The limbs that throw the lantern's shadows, of each body, and how thick
/// each is: pelvis, trunk, head, thighs, shins, upper arms, forearms.
const CASTER_CONES: [(usize, f32); CASTERS / 2] = [
    (0, 0.11),
    (1, 0.12),
    (4, 0.071),
    (5, 0.058),
    (6, 0.058),
    (7, 0.036),
    (8, 0.036),
    (13, 0.038),
    (14, 0.038),
    (15, 0.028),
    (16, 0.028),
];

/// Page 04: 12 breaths, 80 steps walked over 96 steps' time: it stops for
/// the thought, its last step landing on `INNER_HALT`, and walks on
/// `INNER_PAUSE` s later.
pub const INNER_LOOP: f32 = 52.8;
const INNER_STEPS: i32 = 80;
const INNER_HALT: i32 = 18;
const INNER_PAUSE: f32 = 16.0 * CADENCE;
/// What flares in it: when, how big its branches grow (of the thought's),
/// how much of the crown's light it takes, and the scanner's way when it
/// reaches it (true going up).
const INNER_EVENTS: [(f32, f32, f32, bool); EVENTS] = [
    (9.6, 1.0, 0.85, true),
    (22.3, 0.6, 0.45, true),
    (36.6, 0.3, 0.2, false),
    (46.3, 0.0, 0.0, false),
];
/// The scanner's share of the light kept warm on page 04, and when the
/// beads it carries go out before the loop ends.
const INNER_WARMTH: f32 = 0.75;
const INNER_BEADS_OUT: [f32; 2] = [49.0, 52.3];
/// Before the thought the floor and the world dim to this much of their
/// light at its deepest.
const INNER_DIM: f32 = 0.6;
/// The camera: far off, ahead of the figure to its right (degrees,
/// swinging this much), this far, its eye this high, with a long lens
/// that leans in for the thought.
const INNER_AZIMUTH: [f32; 2] = [-25.0, 8.0];
const INNER_RANGE: f32 = 9.75;
const INNER_HIGH: f32 = 1.25;
const INNER_LENS: [f32; 2] = [1.9, 2.3];
const INNER_AIM: [f32; 2] = [1.0, 1.1];
const INNER_CLOSER: [f32; 4] = [9.4, 12.6, 18.4, 21.6];

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
    /// Page 02: the one the figure meets, and when each voice ring leaves a
    /// mouth and whose.
    other: Option<Walk>,
    voices: Vec<(f32, usize)>,
    /// Page 04: when the scanner reaches each thing that flared.
    pub touches: [f32; EVENTS],
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
    /// The glass before it fills.
    latent: f32,
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
/// level, round the body's axis at that height, hugging the figure; seated
/// (`risen` 0) it rings what of the body crosses its level instead.
fn scanner(body: &Body, high: f32, risen: f32) -> (V3, f32) {
    let y = mix(SCANNER_FLOOR, body.high.y - 0.03, high);
    let (p, c, h) = (body.pelvis, body.chest, body.head);
    let along = |a: V3, b: V3| a.lerp(b, ((y - a.y) / (b.y - a.y)).clamp(0.0, 1.0));
    let axis = if y <= c.y { along(p, c) } else { along(c, h) };
    let standing = (v3(axis.x, y, axis.z), monotone(&SCANNER, y));
    if risen >= 1.0 {
        return standing;
    }
    let (centre, radius) = section(body, y).unwrap_or(standing);
    let seated = min_jerk(1.0 - risen);
    (
        standing.0.lerp(centre, seated),
        mix(standing.1, radius, seated),
    )
}

/// A ring round what of the body crosses the level `y`: the middle of the
/// cones there and how far out the farthest reaches, each part coming in
/// softly as the level nears it.
fn section(body: &Body, y: f32) -> Option<(V3, f32)> {
    const SAMPLES: usize = 7;
    const MARGIN: f32 = 0.06;
    let mut parts = [(0.0f32, 0.0f32, 0.0f32, 0.0f32); PRIMITIVES * SAMPLES];
    let (mut n, mut weight, mut x, mut z) = (0, 0.0, 0.0, 0.0);
    for c in 0..PRIMITIVES {
        let [ax, ay, az, ra] = body.cones[3 * c];
        let [bx, by, bz, rb] = body.cones[3 * c + 1];
        for k in 0..SAMPLES {
            let u = k as f32 / (SAMPLES - 1) as f32;
            let r = mix(ra, rb, u);
            let w = 1.0 - smooth(0.6 * r, r + 0.12, (mix(ay, by, u) - y).abs());
            if w > 0.0 {
                let (px, pz) = (mix(ax, bx, u), mix(az, bz, u));
                parts[n] = (px, pz, r, w);
                n += 1;
                weight += w;
                x += w * px;
                z += w * pz;
            }
        }
    }
    if weight <= 0.0 {
        return None;
    }
    let (x, z) = (x / weight, z / weight);
    let reach = parts[..n]
        .iter()
        .map(|&(px, pz, r, w)| w * ((px - x).hypot(pz - z) + r))
        .fold(0.0, f32::max);
    Some((v3(x, y, z), reach + MARGIN))
}

/// Bouts of strides along +z from the feet together at z 0: the first heel
/// strike of each and how many strides (even), from half a stride on; two
/// short steps bring the feet together after each.
fn bouts(list: &[(f32, usize)]) -> Walk {
    let swing = 0.76 * CADENCE;
    let aside = |side: usize, x: f32| if side == 0 { x } else { -x };
    let mut steps = vec![];
    let mut z = 0.0;
    for &(first, strides) in list {
        for j in 0..strides {
            let side = j % 2;
            let land = first + j as f32 * CADENCE;
            steps.push(Step {
                side,
                lift: land - if j == 0 { 0.5 } else { swing },
                land,
                x: aside(side, LIFE_WIDTH),
                z: z + (0.5 + j as f32) * STRIDE,
            });
        }
        z += strides as f32 * STRIDE;
        let mut land = first + (strides - 1) as f32 * CADENCE;
        for (side, after) in [(0, 0.6), (1, 0.65)] {
            land += after;
            steps.push(Step {
                side,
                lift: land - 0.5,
                land,
                x: aside(side, LIFE_STANCE),
                z,
            });
        }
    }
    Walk::new([[LIFE_STANCE, 0.0], [-LIFE_STANCE, 0.0]], steps, BEAT)
}

/// Page 02's walk: from the seat to where it meets the other, then on to
/// the next seat.
fn life_walk() -> Walk {
    let rest = |[from, to]: [f32; 2], up| Rest { from, to, up };
    bouts(&LIFE_BOUTS).with_rests(vec![rest(LIFE_UP, true), rest(LIFE_DOWN, false)])
}

/// When each voice ring leaves a mouth, and whose: about every
/// `VOICE_EVERY` s through each phrase, a word left out now and then.
fn voice_list() -> Vec<(f32, usize)> {
    let mut list = vec![];
    for (k, &(who, from, to)) in TALK.iter().enumerate() {
        let (mut t, mut n) = (from + 0.1, 0u32);
        while t < to - 0.15 {
            let seed = k as u32 * 97 + n * 7 + 3;
            if rand(seed) > 0.18 {
                list.push((t, who));
            }
            t += VOICE_EVERY * mix(0.8, 1.3, rand(seed + 1));
            n += 1;
        }
    }
    list
}

/// How much `p` (0 the figure, 1 the other) is speaking at `t`, 0..1.
fn speaking(p: usize, t: f32) -> f32 {
    TALK.iter()
        .filter(|s| s.0 == p)
        .map(|&(_, from, to)| {
            smooth(from - 0.3, from + 0.3, t) * (1.0 - smooth(to - 0.3, to + 0.3, t))
        })
        .fold(0.0, f32::max)
}

/// How far the lid of the desk in use is open: closing on the first,
/// opening on the next.
fn lid(t: f32) -> f32 {
    let open = if t < 0.5 * LIFE_LOOP {
        1.0 - min_jerk(stage(t, [LID_CLOSES[1], LID_CLOSES[2]]))
    } else {
        min_jerk(stage(t, [LID_OPENS[1], LID_OPENS[2]]))
    };
    open.clamp(0.0, 1.0)
}

/// How busy the hands are on the keys, 0..1.
fn typing(t: f32) -> f32 {
    let (stops, starts) = (LID_CLOSES[0], LID_OPENS[3]);
    if t < 0.5 * LIFE_LOOP {
        1.0 - smooth(stops - 0.3, stops, t)
    } else {
        smooth(starts, starts + 0.3, t)
    }
}

/// How many glyphs have been typed: a page of them a loop, the next desk
/// going on where the first left off.
fn text(t: f32) -> f32 {
    let (stops, starts) = (LID_CLOSES[0], LID_OPENS[3]);
    let rate = GLYPHS as f32 / (stops + LIFE_LOOP - starts);
    let typed = if t < 0.5 * LIFE_LOOP {
        t.min(stops)
    } else {
        stops + (t - starts).max(0.0)
    };
    TEXT_START + rate * typed
}

/// Where each wrist rests over the keys (0 left, 1 right), for the feet at `z`.
fn keys_at(z: f32, side: usize) -> V3 {
    v3(if side == 0 { 0.09 } else { -0.09 }, 0.79, z - 0.06)
}

/// Where the right wrist holds the lid's top edge, open `open`, for the
/// feet at `z`.
fn lid_grip(z: f32, open: f32) -> V3 {
    let angle = open * LID_OPEN;
    let hinge = v3(-0.07, LAPTOP_TOP, z + DESK_AHEAD + LID_HINGE);
    hinge + v3(0.0, angle.sin(), -angle.cos()) * LID_HEIGHT + v3(0.0, 0.03, -0.09)
}

/// A point on the flat ground bent onto the planet over `track`
/// (common.glsl bend).
fn bend(p: V3, track: f32) -> V3 {
    let (dx, dz) = (p.x, p.z - track);
    let r = dx.hypot(dz);
    if r < 1e-4 {
        return p;
    }
    let a = r / PLANET_RADIUS;
    let h = PLANET_RADIUS + p.y;
    v3(
        dx / r * a.sin() * h,
        a.cos() * h - PLANET_RADIUS,
        track + dz / r * a.sin() * h,
    )
}

/// The other's body, built in its own frame, turned round to come the
/// other way along its line and bent onto the planet over `track`.
fn place(local: &Body, track: f32) -> Body {
    carry(
        local,
        track,
        |p| v3(OTHER_ASIDE - p.x, p.y, OTHER_FROM - p.z),
        |_, d| v3(-d.x, d.y, -d.z),
    )
}

/// A body built in its own walk's frame, carried onto the ground by `to`
/// (a point of that frame to the flat ground) and `way` (a direction at a
/// point of that frame to the flat ground's), and bent onto the planet
/// over `track`.
fn carry(local: &Body, track: f32, to: impl Fn(V3) -> V3, way: impl Fn(V3, V3) -> V3) -> Body {
    let on = |p: V3| bend(to(p), track);
    let mut b = *local;
    let (mut low, mut high) = (v3(1e9, 1e9, 1e9), v3(-1e9, -1e9, -1e9));
    for c in 0..PRIMITIVES {
        let [ax, ay, az, ra] = local.cones[3 * c];
        let [bx, by, bz, rb] = local.cones[3 * c + 1];
        let [sx, sy, sz, keep] = local.cones[3 * c + 2];
        let (la, le) = (v3(ax, ay, az), v3(bx, by, bz));
        let (a, e) = (to(la), to(le));
        let m = (a + e) * 0.5;
        let s = way((la + le) * 0.5, v3(sx, sy, sz));
        let squash = (bend(m + s * 0.01, track) - bend(m, track)).normalize();
        let (a, e) = (bend(a, track), bend(e, track));
        b.cones[3 * c] = [a.x, a.y, a.z, ra];
        b.cones[3 * c + 1] = [e.x, e.y, e.z, rb];
        b.cones[3 * c + 2] = [squash.x, squash.y, squash.z, keep];
        let r = ra.max(rb);
        let pad = v3(r, r, r);
        low = low.min(a - pad).min(e - pad);
        high = high.max(a + pad).max(e + pad);
    }
    let turned = |at: V3, x: Axes| Axes {
        left: way(at, x.left),
        up: way(at, x.up),
        forward: way(at, x.forward),
    };
    b.pelvis = on(local.pelvis);
    b.chest = on(local.chest);
    b.head = on(local.head);
    b.mouth = on(local.mouth);
    b.pelvic = turned(local.pelvis, local.pelvic);
    b.chest_axes = turned(local.chest, local.chest_axes);
    b.face = turned(local.head, local.face);
    b.low = low;
    b.high = high;
    b
}

/// Forward and left for a heading `h` (radians, + to the left).
fn heading(h: f32) -> (V3, V3) {
    let (sin, cos) = h.sin_cos();
    (v3(sin, 0.0, cos), v3(cos, 0.0, -sin))
}

/// Page 03's passer-by: where its path is on the flat ground, `s` m on
/// from abeam the figure standing over `track`, and its heading there. Up
/// from behind on the figure's right, once round it, and on ahead.
fn night_path(s: f32, track: f32) -> (V3, f32) {
    let centre = v3(0.0, 0.0, track);
    let lap = TAU * NIGHT_LAP;
    let abeam = centre - heading(0.0).1 * NIGHT_LAP;
    if s < 0.0 {
        (abeam + heading(0.0).0 * s, 0.0)
    } else if s <= lap {
        let h = s / NIGHT_LAP;
        (centre - heading(h).1 * NIGHT_LAP, h)
    } else {
        (abeam + heading(0.0).0 * (s - lap), TAU)
    }
}

/// How much of the way round the glass the passer-by is, 0 off the lap … 1
/// on it, easing in and out.
fn lapping(s: f32) -> f32 {
    let lap = TAU * NIGHT_LAP;
    smooth(-1.5, 1.0, s) * (1.0 - smooth(lap - 1.0, lap + 1.5, s))
}

/// A point of the passer-by's walk frame (z along its walk, x to its left)
/// on the flat ground along its path.
fn night_to(p: V3, track: f32) -> V3 {
    let (at, h) = night_path(p.z - NIGHT_MEET, track);
    at + heading(h).1 * p.x + Y * p.y
}

/// A direction of the passer-by's walk frame at the point `at` of it.
fn night_way(at: V3, d: V3) -> V3 {
    let (forward, left) = heading(night_path(at.z - NIGHT_MEET, 0.0).1);
    left * d.x + Y * d.y + forward * d.z
}

/// How lit the passer-by and its lantern are at `t`.
fn night_light(t: f32) -> f32 {
    let [a, b, c, d] = NIGHT_SHOWN;
    window(t, a, b, c, d)
}

/// The ball round a body, for the lantern's shadows: its middle and reach.
fn bound(body: &Body) -> [f32; 4] {
    let m = (body.low + body.high) * 0.5;
    let r = (body.high - body.low).length() * 0.5;
    [m.x, m.y, m.z, r]
}

/// Page 04's walk: steady, then two short steps bring the feet together
/// after `INNER_HALT`, and a short step sets off again `INNER_PAUSE` s on.
fn inner_walk() -> Walk {
    let swing = 0.76 * CADENCE;
    let aside = |side: usize, x: f32| if side == 0 { x } else { -x };
    let stop = (INNER_HALT as f32 + 0.5) * STRIDE;
    let mut steps = vec![];
    for k in -12..INNER_STEPS + 16 {
        let side = k.rem_euclid(2) as usize;
        let z = k as f32 * STRIDE;
        let land = k as f32 * CADENCE + if k > INNER_HALT { INNER_PAUSE } else { 0.0 };
        let lift = land - if k == INNER_HALT + 1 { 0.5 } else { swing };
        steps.push(Step {
            side,
            lift,
            land,
            x: aside(side, LIFE_WIDTH),
            z,
        });
        if k == INNER_HALT {
            let mut at = land;
            for (side, after) in [(1 - side, 0.6), (side, 0.65)] {
                at += after;
                steps.push(Step {
                    side,
                    lift: at - 0.5,
                    land: at,
                    x: aside(side, LIFE_STANCE),
                    z: stop,
                });
            }
        }
    }
    let behind = |k: i32| {
        [
            aside(k.rem_euclid(2) as usize, LIFE_WIDTH),
            (k - 2) as f32 * STRIDE,
        ]
    };
    Walk::new([behind(-12), behind(-11)], steps, BEAT)
}

/// Where what flares at event `e` grows from on `body`, and which way its
/// branches reach: above the head, before the chest, from the right
/// hand's fingertips, at the left knee (that one only sparks).
fn inner_root(e: usize, body: &Body) -> (V3, V3) {
    let (face, chest) = (body.face, body.chest_axes);
    let cone = |i: usize| {
        let [x, y, z, _] = body.cones[i];
        v3(x, y, z)
    };
    match e {
        0 => (
            body.head + face.forward * 0.06 + face.up * 0.03,
            face.up + face.forward * 0.6,
        ),
        1 => (
            body.chest + chest.forward * 0.05,
            chest.forward + chest.up * 0.3,
        ),
        2 => (cone(3 * 18 + 1), chest.forward * 0.6 - chest.left - Y * 0.3),
        _ => (cone(3 * 7), Y),
    }
}

impl Story {
    pub fn new(chapter: Chapter) -> Story {
        let loop_seconds = chapter.loop_seconds();
        let steady = |steps: i32| {
            let walk = Walk::steady(CADENCE, STRIDE, 0.06, -12, steps + 16, BEAT);
            (steps as f32 * STRIDE, walk)
        };
        let (distance, walk) = match chapter {
            Chapter::Hero => steady(HERO_STEPS),
            Chapter::Arrive => steady(ARRIVE_STEPS),
            Chapter::Life => {
                let strides: usize = LIFE_BOUTS.iter().map(|b| b.1).sum();
                (strides as f32 * STRIDE, life_walk())
            }
            // It stands: its one step never comes.
            Chapter::Night => {
                let stance = [[LIFE_STANCE, 0.0], [-LIFE_STANCE, 0.0]];
                let never = Step {
                    side: 0,
                    lift: 1e4,
                    land: 1e4 + 0.5,
                    x: LIFE_STANCE,
                    z: 0.0,
                };
                (0.0, Walk::new(stance, vec![never], BEAT))
            }
            Chapter::Inner => (INNER_STEPS as f32 * STRIDE, inner_walk()),
        };
        let (other, voices) = match chapter {
            Chapter::Life => (Some(bouts(&OTHER_BOUTS)), voice_list()),
            Chapter::Night => {
                let (c, s) = (NIGHT_CADENCE, NIGHT_STRIDE);
                (
                    Some(Walk::steady(c, s, NIGHT_WIDTH, -20, 100, BEAT)),
                    vec![],
                )
            }
            _ => (None, vec![]),
        };
        let mut story = Story {
            chapter,
            loop_seconds,
            distance,
            mote_box: if distance > 0.0 {
                distance / (distance / 10.0).round()
            } else {
                10.0
            },
            walk,
            other,
            voices,
            touches: [0.0; EVENTS],
        };
        if chapter == Chapter::Inner {
            story.touches = std::array::from_fn(|e| story.touch(e));
        }
        story
    }

    /// When the scanner, going its way, first comes to the height of what
    /// flared at event `e` after it flared.
    fn touch(&self, e: usize) -> f32 {
        let (flare, _, _, rising) = INNER_EVENTS[e];
        let gap = |t: f32| {
            let pose = self.pose(t);
            let body = build(&pose);
            let d = scanner(&body, sweep(t), pose.risen).0.y - inner_root(e, &body).0.y;
            if rising {
                d
            } else {
                -d
            }
        };
        let (mut a, mut t) = (flare, flare + 0.01);
        while t < flare + 2.0 * SWEEP {
            if gap(a) < 0.0 && gap(t) >= 0.0 {
                let mut b = t;
                for _ in 0..30 {
                    let m = 0.5 * (a + b);
                    if gap(m) < 0.0 {
                        a = m;
                    } else {
                        b = m;
                    }
                }
                return b;
            }
            a = t;
            t += 0.01;
        }
        flare + SWEEP
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
            Chapter::Life => self.life(time),
            Chapter::Night => self.night(time),
            Chapter::Inner => self.inner(time),
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
            Chapter::Night => {
                let flash = 0.3 * pulse(at.rem_euclid(SWEEP));
                (sweep(t), NIGHT_RINGS[0], flash, 1.0)
            }
            Chapter::Arrive => arrive_crown(at),
            Chapter::Inner => {
                let flash = 0.3 * pulse(at.rem_euclid(SWEEP));
                (sweep(t), self.inner_crown(at), flash, 1.0)
            }
            Chapter::Life => {
                let answer = pulse(at - LIFE_GATHER - 0.35);
                (
                    sweep(t),
                    LIFE_RINGS[0],
                    (0.45 * pulse(at.rem_euclid(SWEEP))).max(answer),
                    1.0,
                )
            }
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
            latent: 1.0,
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
                scanner(&at, sweep(ARRIVE_LOCK), 1.0).0,
                WAVE_SPEED * age,
                fade * fade * smooth(0.0, 0.1, age),
            )
        } else {
            (Y, -1.0, 0.0)
        };
        let [on, full, off, out] = WORLD_ON;
        let cues = Cues {
            inner,
            latent: 1.0,
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

    fn life(&self, t: f32) -> Frame {
        // As it stands the scanner, the crown and the sphere's ring answer
        // in turn, and a soft wave runs out from the scanner.
        let answer = |k: f32| pulse(t - LIFE_GATHER - 0.35 * k);
        let age = t - LIFE_GATHER;
        let wave = if (0.0..WAVE_SECONDS).contains(&age) {
            let at = self.pose(LIFE_GATHER);
            let fade = 1.0 - age / WAVE_SECONDS;
            (
                scanner(&build(&at), sweep(LIFE_GATHER), at.risen).0,
                WAVE_SPEED * age,
                0.6 * fade * fade * smooth(0.0, 0.1, age),
            )
        } else {
            (Y, -1.0, 0.0)
        };
        let (voices, spoken, heard) = self.voices(t);
        let [_, inner, spin] = LIFE_RINGS;
        let [latent, filled] = LIFE_GLASS;
        let cues = Cues {
            inner,
            latent,
            form: 1.0,
            flash: (0.5 * pulse(t.rem_euclid(SWEEP)))
                .max(answer(0.0))
                .max(spoken),
            spin: [
                spin,
                self.cycle(t, SPIN_PERIOD),
                1.0,
                (0.4 * pulse(t.rem_euclid(SPIN_PERIOD))).max(answer(2.0)),
            ],
            filled,
            fill: TAU,
            spokes: 1.0,
            world: 0.0,
            wave,
        };
        let mut f = self.frame(t, self.life_shot(t), cues);
        // The other's words light the crown as they meet the glass.
        f.rings[0].flash = f.rings[0].flash.max(heard);
        f.other = self.other_body(t);
        let [a, b, c, d] = OTHER_SHOWN;
        f.other_light = window(t, a, b, c, d);
        // A voice goes out as a sphere of sound: what is seen of it is
        // its rim, a circle that faces the eye.
        f.voices = voices.map(|v| {
            let n = (f.eye - v3(v[0], v[1], v[2])).normalize();
            [v[0], v[1], v[2], v[3], n.x, n.y, n.z, v[7]]
        });
        f
    }

    fn night(&self, t: f32) -> Frame {
        let [_, inner, spin] = NIGHT_RINGS;
        let [latent, filled] = NIGHT_GLASS;
        let cues = Cues {
            inner,
            latent,
            form: 1.0,
            flash: 0.35 * pulse(t.rem_euclid(SWEEP)),
            spin: [
                spin,
                self.cycle(t, SPIN_PERIOD),
                1.0,
                0.25 * pulse(t.rem_euclid(SPIN_PERIOD)),
            ],
            filled,
            fill: TAU,
            spokes: 0.0,
            world: 0.0,
            wave: (Y, -1.0, 0.0),
        };
        let mut f = self.frame(t, self.night_shot(t), cues);
        f.floor = NIGHT_FLOOR;
        f.world = NIGHT_WORLD;
        let Some(walk) = &self.other else {
            return f;
        };
        let light = night_light(t);
        let (walker, lamp) = self.walker(walk, t);
        f.other = walker;
        f.other_light = light;
        // A flame's small unrest.
        let flicker =
            1.0 + 0.04 * self.cycle(t, 0.31).sin() + 0.03 * (self.cycle(t, 0.13) + 1.3).sin();
        f.lamp = [lamp.x, lamp.y, lamp.z, light * flicker];
        f.bounds = [bound(&f.body), bound(&f.other)];
        for (k, body) in [&f.body, &f.other].into_iter().enumerate() {
            for (j, &(c, r)) in CASTER_CONES.iter().enumerate() {
                let [ax, ay, az, _] = body.cones[3 * c];
                let [bx, by, bz, _] = body.cones[3 * c + 1];
                let slot = 2 * (k * CASTER_CONES.len() + j);
                f.casters[slot] = [ax, ay, az, r];
                f.casters[slot + 1] = [bx, by, bz, 0.0];
            }
        }
        // Its steps, while it is seen, on the ground along its path.
        let track = self.walk.track(t);
        let [from, .., to] = NIGHT_SHOWN;
        let mut prints = [[0.0, 0.0, 0.0, 99.0]; PRINTS];
        let steps = walk.landings(t).filter(|s| (from..=to).contains(&s.land));
        for (slot, s) in prints.iter_mut().zip(steps) {
            let (_, h) = night_path(s.z - NIGHT_MEET, track);
            let at = night_to(v3(s.x, 0.0, s.z), track);
            let yaw = h + if s.side == 0 { TOE_OUT } else { -TOE_OUT };
            *slot = [at.x, at.z, yaw, t - s.land];
        }
        f.prints = prints;
        f
    }

    /// Page 03's passer-by at `t`, on the planet, and its lantern: it walks
    /// its path holding the lantern out in its left hand, toward the glass,
    /// and looks at the glass as it goes round.
    fn walker(&self, walk: &Walk, t: f32) -> (Body, V3) {
        let track = self.walk.track(t);
        let mut pose = walk.pose(t, breath(t + 1.7));
        pose.turn = NIGHT_LOOK * lapping(walk.track(t) - NIGHT_MEET);
        let p = pose.pelvis;
        pose.hands[0] = [p.x + 0.26, p.y + 0.1, p.z + 0.16, 1.0];
        let local = build(&pose);
        let [x, y, z, _] = local.cones[3 * 15 + 1];
        let swing = LAMP_SWING * self.cycle(t, 2.0 * NIGHT_CADENCE).sin();
        let lamp = bend(night_to(v3(x, y - LAMP_HANG, z + swing), track), track);
        let body = carry(&local, track, |p| night_to(p, track), night_way);
        (body, lamp)
    }

    /// Page 03's camera: beside the glass, going once round it a loop.
    fn night_shot(&self, t: f32) -> Shot {
        let ground = self.ground(t);
        let (sin, cos) = (NIGHT_AZIMUTH + TAU * t / self.loop_seconds).sin_cos();
        let eye = ground + v3(NIGHT_RANGE * sin, NIGHT_HIGH, NIGHT_RANGE * cos) + self.drift(t);
        Shot {
            eye,
            target: ground + v3(0.0, NIGHT_AIM, 0.0),
            lens: NIGHT_LENS,
            focus: (eye - self.sphere(t)).length(),
            aperture: 0.004,
        }
    }

    /// How much what flared at event `e` holds the figure at `t`: from the
    /// flare till a while after the scanner reaches it.
    fn drawn_in(&self, e: usize, t: f32) -> f32 {
        let (flare, touch) = (INNER_EVENTS[e].0, self.touches[e]);
        smooth(flare, flare + 1.2, t) * (1.0 - smooth(touch + 0.4, touch + 1.9, t))
    }

    /// Page 04's crown: what flares takes its light, the more the bigger.
    fn inner_crown(&self, t: f32) -> f32 {
        let taken: f32 = (0..EVENTS)
            .map(|e| INNER_EVENTS[e].2 * self.drawn_in(e, t))
            .sum();
        (1.0 - taken).clamp(0.0, 1.0)
    }

    fn inner(&self, t: f32) -> Frame {
        let touched = self
            .touches
            .iter()
            .map(|&at| pulse(t - at))
            .fold(0.0, f32::max);
        let cues = Cues {
            inner: 1.0,
            latent: 0.3,
            form: 1.0,
            flash: (0.5 * pulse(t.rem_euclid(SWEEP))).max(touched),
            spin: [0.0, self.cycle(t, SPIN_PERIOD), 1.0, 0.0],
            filled: 0.2,
            fill: TAU,
            spokes: 0.0,
            world: 0.0,
            wave: (Y, -1.0, 0.0),
        };
        let mut f = self.frame(t, self.inner_shot(t), cues);
        let dim = 1.0 - INNER_DIM * self.drawn_in(0, t);
        f.floor = dim;
        f.world = dim;
        f.warmth = INNER_WARMTH;
        let body = f.body;
        let flow = |t: f32| self.cycle(t, 17.6);
        let out = 1.0 - smooth(INNER_BEADS_OUT[0], INNER_BEADS_OUT[1], t);
        for (e, &(flare, size, _, _)) in INNER_EVENTS.iter().enumerate() {
            let touch = self.touches[e];
            let (root, toward) = inner_root(e, &body);
            let dir = toward.normalize();
            // It branches out from the flare till near the touch, and
            // folds into its root as the scanner reaches it.
            let grow = min_jerk(stage(t, [flare, flare + (touch - flare).min(4.0) * 0.9]));
            let fold = min_jerk(stage(t, [touch, touch + 1.0]));
            let light = if size > 0.0 {
                smooth(flare, flare + 0.4, t) * (1.0 - smooth(touch + 0.7, touch + 1.0, t))
            } else {
                0.0
            };
            f.branches[3 * e] = [root.x, root.y, root.z, size];
            f.branches[3 * e + 1] = [dir.x, dir.y, dir.z, grow];
            f.branches[3 * e + 2] = [fold, light, flow(t) * 7.0 + 1.7 * e as f32, 0.0];
            // What is left is a bead on its root, a fact noted where it
            // is; one that only sparks shows as a spark till the touch.
            let lit = smooth(touch + 0.6, touch + 1.0, t);
            let spark = if size > 0.0 {
                0.0
            } else {
                0.6 * smooth(flare, flare + 0.3, t)
            };
            f.facts[e] = [root.x, root.y, root.z, lit.max(spark) * out];
        }
        f
    }

    /// Page 04's camera: far off before the figure, a long lens leaning in
    /// for the thought.
    fn inner_shot(&self, t: f32) -> Shot {
        let ground = self.ground(t);
        let [from, swing] = INNER_AZIMUTH;
        let a = (from + swing * self.cycle(t, 26.4).sin()).to_radians();
        let [c0, c1, c2, c3] = INNER_CLOSER;
        let closer = window(t, c0, c1, c2, c3);
        let eye =
            ground + v3(INNER_RANGE * a.sin(), INNER_HIGH, INNER_RANGE * a.cos()) + self.drift(t);
        Shot {
            eye,
            target: ground + Y * mix(INNER_AIM[0], INNER_AIM[1], closer),
            lens: mix(INNER_LENS[0], INNER_LENS[1], closer),
            focus: (eye - self.sphere(t)).length(),
            aperture: 0.003,
        }
    }

    /// The figure at `t`: the walk's pose; on page 02 it also types at the
    /// desks, turns to the one it meets, nods and speaks with a hand; on
    /// page 03 its head goes after the lantern's light.
    fn pose(&self, t: f32) -> Pose {
        let mut pose = self.walk.pose(t, breath(t));
        if self.chapter == Chapter::Life {
            (pose.turn, pose.nod) = self.regard(0, t);
            self.at_desk(t, &mut pose);
            if speaking(0, t) > 0.0 {
                pose.hands[0] = self.gesture(0, t, &build(&pose));
            }
        }
        if let (Chapter::Night, Some(walk)) = (self.chapter, &self.other) {
            let track = self.walk.track(t);
            let (at, _) = night_path(walk.track(t) - NIGHT_MEET, track);
            let toward = at.x.atan2(at.z - track);
            pose.turn = FIGURE_LOOK * toward.sin() * night_light(t);
        }
        pose
    }

    /// At the desks: the hands on the keys, the right one closing the lid
    /// and opening it, the head bowed to the screen.
    fn at_desk(&self, t: f32, pose: &mut Pose) {
        let first = t < 0.5 * self.loop_seconds;
        let z = if first { 0.0 } else { self.distance };
        let [reach, turn, rest, done] = if first { LID_CLOSES } else { LID_OPENS };
        let s = |a: f32, b: f32| min_jerk(stage(t, [a, b]));
        let grip = lid_grip(z, lid(t));
        let busy = typing(t);
        let keys = [0, 1].map(|i| {
            let k = 2.1 * i as f32;
            let jitter = v3(
                0.012 * (self.cycle(t, 0.37) + k).sin(),
                0.008 * (self.cycle(t, 0.23) + k).sin().max(0.0),
                0.01 * (self.cycle(t, 0.29) + k).sin(),
            );
            keys_at(z, i) + jitter * busy
        });
        let (right, right_reach, left_reach) = if first {
            (
                keys[1].lerp(grip, s(reach, turn)),
                1.0 - s(rest, done),
                1.0 - s(reach + 0.1, turn + 0.4),
            )
        } else {
            (
                grip.lerp(keys[1], s(rest, done)),
                s(reach, turn),
                s(rest - 0.3, done),
            )
        };
        let at = |p: V3, w: f32| [p.x, p.y, p.z, w];
        pose.hands = [at(keys[0], left_reach), at(right, right_reach)];
        pose.wrists = [TYPING_WRIST * left_reach, TYPING_WRIST * right_reach];
        let bowed = if first {
            1.0 - s(rest - 0.3, rest + 0.7)
        } else {
            s(reach + 0.2, turn + 0.8)
        };
        pose.nod += bowed * (TYPING_NOD + 0.02 * self.cycle(t, 3.1).sin());
        pose.lean += TYPING_LEAN * bowed;
    }

    /// How far each (0 the figure, 1 the other) has turned its head to the
    /// other, and how far it nods: listening now and then, speaking a
    /// little with its words, and both to part.
    fn regard(&self, p: usize, t: f32) -> (f32, f32) {
        let [a, b, c, d] = FACING[p];
        let turn = TALK_TURN * min_jerk(stage(t, [a, b])) * (1.0 - min_jerk(stage(t, [c, d])));
        let bow =
            |at: f32, depth: f32, long: f32| depth * (PI * stage(t, [at, at + long])).sin().powi(2);
        let mut nod = bow(FAREWELL, 0.2, 0.9) + 0.035 * speaking(p, t) * self.cycle(t, 0.9).sin();
        for &(who, from, to) in &TALK {
            if who != p {
                nod += bow(from + 0.9, 0.12, 0.6) + bow(to - 0.5, 0.1, 0.6);
            }
        }
        (turn, nod)
    }

    /// The speaker's hand nearer the listener (its left): raised before the
    /// chest, beating with the words.
    fn gesture(&self, p: usize, t: f32, body: &Body) -> [f32; 4] {
        let ch = body.chest_axes;
        let beat = 0.02 * self.cycle(t, 0.45).sin() + 0.012 * self.cycle(t, 1.3).sin();
        let at = body.chest + ch.forward * 0.3 - ch.up * (0.12 - beat) + ch.left * 0.14;
        [at.x, at.y, at.z, speaking(p, t)]
    }

    /// The one the figure meets, at `t`: its own walk the other way, its
    /// head turned to the figure in the talk, a hand speaking; on the planet.
    fn other_body(&self, t: f32) -> Body {
        let Some(walk) = &self.other else {
            return build(&self.walk.pose(t, breath(t)));
        };
        let mut pose = walk.pose(t, breath(t + 1.7));
        (pose.turn, pose.nod) = self.regard(1, t);
        if speaking(1, t) > 0.0 {
            pose.hands[0] = self.gesture(1, t, &build(&pose));
        }
        place(&build(&pose), self.walk.track(t))
    }

    /// The voice rings in the air at `t`; how much the figure's own words
    /// light its scanner, and the other's the crown as they meet the glass.
    fn voices(&self, t: f32) -> ([[f32; 8]; VOICES], f32, f32) {
        let mut out = [[0.0; 8]; VOICES];
        let (mut spoken, mut heard) = (0.0f32, 0.0f32);
        let live = self
            .voices
            .iter()
            .filter(|(at, _)| (0.0..VOICE_LIFE).contains(&(t - at)));
        for (slot, &(at, who)) in out.iter_mut().zip(live) {
            let age = t - at;
            let (me, other) = (build(&self.pose(at)), self.other_body(at));
            let (from, to) = if who == 0 {
                (me.mouth, other.mouth)
            } else {
                (other.mouth, me.mouth)
            };
            let way = (to - from).normalize();
            let p = age / VOICE_LIFE;
            let centre = from + way * (VOICE_SPEED * age);
            let radius = mix(
                VOICE_RADIUS[0],
                VOICE_RADIUS[1],
                1.0 - (1.0 - p) * (1.0 - p),
            );
            let light = (1.0 - p) * (1.0 - p) * smooth(0.0, 0.08, age);
            *slot = [
                centre.x, centre.y, centre.z, radius, way.x, way.y, way.z, light,
            ];
            if who == 0 {
                spoken = spoken.max(0.3 * pulse(age));
            } else {
                let to_glass = (from - self.sphere(at)).length() - SPHERE_RADIUS;
                heard = heard.max(0.35 * pulse(age - to_glass.max(0.0) / VOICE_SPEED));
            }
        }
        (out, spoken, heard)
    }

    /// Page 02's camera, eased from key to key round the figure.
    fn life_shot(&self, t: f32) -> Shot {
        let mut v = LIFE_VIEW;
        for (times, key) in LIFE_KEYS {
            let s = min_jerk(stage(t, times));
            for (x, k) in v.iter_mut().zip(key) {
                *x = mix(*x, k, s);
            }
        }
        let [azimuth, range, high, ax, ay, az, lens] = v;
        let ground = self.ground(t);
        let a = azimuth.to_radians();
        let eye = ground + v3(range * a.sin(), high, range * a.cos()) + self.drift(t);
        Shot {
            eye,
            target: ground + v3(ax, ay, az),
            lens,
            focus: (eye - self.sphere(t)).length(),
            aperture: 0.007,
        }
    }

    /// The seats of page 02: the one it rises from melts into the ground
    /// behind it; the next builds where it stops. Other pages have none.
    fn seats(&self, t: f32) -> [[f32; 4]; SEATS] {
        match self.chapter {
            Chapter::Life => {
                let back = -SEAT_BACK - SEAT_SET;
                let [left, gone] = LIFE_LEAVE;
                let [start, built] = LIFE_BUILD;
                [
                    [0.0, back, 1.0, 1.0 - smooth(left, gone, t)],
                    [0.0, self.distance + back, 1.0, smooth(start, built, t)],
                ]
            }
            _ => [[0.0; 4]; SEATS],
        }
    }

    /// The desks of page 02 before the seats: x and z of the middle, how
    /// much is there, the lid, the keys, the glyphs typed.
    fn desks(&self, t: f32) -> [[f32; 6]; SEATS] {
        match self.chapter {
            Chapter::Life => {
                let first = t < 0.5 * self.loop_seconds;
                let (open, busy, typed) = (lid(t), typing(t), text(t));
                let here = |on: bool, v: f32| if on { v } else { 0.0 };
                [
                    [
                        0.0,
                        DESK_AHEAD,
                        1.0 - smooth(DESK_GONE[0], DESK_GONE[1], t),
                        here(first, open),
                        here(first, busy),
                        typed,
                    ],
                    [
                        0.0,
                        self.distance + DESK_AHEAD,
                        smooth(DESK_COMES[0], DESK_COMES[1], t),
                        here(!first, open),
                        here(!first, busy),
                        typed,
                    ],
                ]
            }
            _ => [[0.0; 6]; SEATS],
        }
    }

    /// From the eyes, the gaze following the crown ring up and down while
    /// the head turns left, then right, then ahead again.
    fn eyes(&self, t: f32, body: &Body) -> Shot {
        let yaw = LOOK_ROUND.iter().fold(0.0, |yaw, &[a, b, to]| {
            mix(yaw, to, min_jerk(stage(t, [a, b])))
        });
        let (sin, cos) = yaw.sin_cos();
        // The eyes turn round the neck, so they stay at the front of the head.
        let eye = body.head + v3(0.1 * sin, -0.03, 0.1 * cos) + self.drift(t) * 0.3;
        let [low, high] = GAZE_SLOPE;
        let slope = (GAZE_FOLLOW * (self.crown(t).center.y - eye.y)).clamp(low, high);
        let ahead = 0.03 * self.cycle(t, 9.9).sin();
        let look = v3(sin + ahead * cos, slope, cos).normalize();
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
        let pose = self.pose(t);
        let body = build(&pose);
        let track = walk.track(t);
        let forward = (shot.target - shot.eye).normalize();
        let right = forward.cross(Y).normalize();
        let up = right.cross(forward);
        let (scan_center, scan_radius) = scanner(&body, sweep(t), pose.risen);
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
            latent: cues.latent,
            filled: cues.filled,
            fill: cues.fill.min(PI + 0.5),
            rings,
            ghosts,
            spokes: cues.spokes,
            things: cues.world,
            things_at,
            tentacles,
            seats: self.seats(t),
            desks: self.desks(t),
            other: body,
            other_light: 0.0,
            voices: [[0.0; 8]; VOICES],
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
            lamp: [0.0; 4],
            bounds: [[0.0; 4]; 2],
            casters: [[0.0; 4]; 2 * CASTERS],
            warmth: 0.0,
            branches: [[0.0; 4]; 3 * EVENTS],
            facts: [[0.0; 4]; EVENTS],
        }
    }
}
