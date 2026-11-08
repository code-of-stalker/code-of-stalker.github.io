//! Page 06's loop as numbers: where the walker is, how he moves, what the
//! camera does and what each fixed phrase leaves in the street.
//!
//! 0–14 s   from his eyes, hurried: he glances left and right, windows
//!          open like eyes, signs flicker, the crossing light flips
//!          (the evaluation phrases);
//! 14–18 s  the noise settles, the camera leaves his head for his right
//!          shoulder («Важно фиксировать ощущенчески»);
//! 18–24 s  over the shoulder, his outline catches the light, each step
//!          rings in the wet pavement («Тело идет»);
//! 24–29 s  ahead of him, his breath clouds in the lamp light («Дыхание»);
//! 29–35 s  his right hand rises into the rain («Рука поднимается»);
//! 35–41 s  from the carriageway: his voice spreads as shells, the rain
//!          flashes where they pass, the walls ring («Голос звучит»);
//! 41–46 s  down at the puddles: the step lands and splashes («Шаг»);
//! 46–51 s  the walls send the voice back to him («Я слышу себя»);
//! 51–60 s  the crane rises over the street («Я ощущаю движение»);
//! 60–64 s  the camera dives back into his eyes.
//!
//! Two others share the street: someone under an umbrella comes the other
//! way along the shop windows (they pass him at 7 s and 39 s), and someone
//! in a short hooded jacket waits at the kerb over a phone, its screen
//! lighting the face, and looks up as he passes (49.3 s).
use crate::body::{build, Body, Carry, Coat, Step, Walk, HANDS};
use crate::math::{mix, monotone, smooth, v3, window, V3, Y};
use crate::{
    Chapter, CELL, CROSS, LOOP, PUFFS, REPEAT, STEPS, STEP_MARKS, STEP_WIDTH, STRIDE, WALK_X,
};
use std::f32::consts::PI;

/// One breath: in for `INHALE` s, out for the rest of `BREATH`.
pub const BREATH: f32 = 4.0;
pub const INHALE: f32 = 1.6;
/// A breath cloud is seen this long, s.
pub const PUFF_LIFE: f32 = 3.0;
/// The voice: when each shell leaves the mouth, how fast it spreads (m/s)
/// and how long it is seen.
pub const VOICE_AT: [f32; 5] = [35.8, 36.7, 37.6, 38.7, 39.5];
pub const VOICE_SPEED: f32 = 4.5;
pub const VOICE_LIFE: f32 = 3.2;
/// The echo: when each shell starts back from the walls, from how far.
pub const ECHO_AT: [f32; 3] = [46.4, 47.9, 49.4];
pub const ECHO_FROM: f32 = 7.0;

/// The passers-by, in this order.
pub const PASSERS: usize = 2;
pub const UMBRELLA: usize = 0;
pub const PHONE: usize = 1;
/// The umbrella walks the line `UMBRELLA_X`, a head shorter than him and
/// with a quicker step: `UMBRELLA_STEPS` steps cover `REPEAT` in a loop,
/// so it comes round with the street. Its copies pass him at
/// `UMBRELLA_MEETS` and half a loop later.
pub const UMBRELLA_X: f32 = -5.2;
pub const UMBRELLA_SCALE: f32 = 0.93;
pub const UMBRELLA_STEPS: i32 = 128;
pub const UMBRELLA_MEETS: f32 = 7.0;
/// The one with the phone stands at the kerb, `PHONE_X`, where he passes
/// it at `PHONE_MEETS`, turned this far from facing him toward the road.
pub const PHONE_X: f32 = -3.62;
pub const PHONE_MEETS: f32 = 49.3;
const PHONE_TURN: f32 = 0.35;
/// It looks up from the screen as he comes by and follows him a moment
/// (seconds from `PHONE_MEETS`).
const PHONE_UP: [(f32, f32); 4] = [(-1.0, 0.0), (-0.3, 1.0), (0.9, 1.0), (1.8, 0.0)];
const PHONE_FOLLOW: [(f32, f32); 4] = [(-0.6, 0.0), (0.6, 1.0), (1.1, 1.0), (2.0, 0.0)];
/// How brightly the screen lights the face and the hands.
pub const SCREEN_LIGHT: f32 = 0.4;

/// The sphere round him (Step 7's three rings), barely there: its centre
/// over his walk at `SPHERE_Y`, its radius. The first ring runs over its
/// glass from the top to the ground and back, the second round his body
/// from the feet to the head and back, both in `RING_PERIOD` and in turn;
/// the third, a meridian, turns once in `MERIDIAN_PERIOD`. Whatever comes
/// into it shows its code.
pub const SPHERE_R: f32 = 1.45;
pub const SPHERE_Y: f32 = 0.95;
pub const RING_PERIOD: f32 = 8.0;
pub const MERIDIAN_PERIOD: f32 = 16.0;
/// The second ring's height range: the soles to the crown.
const SECOND_RING: [f32; 2] = [0.04, 1.8];
/// How plainly the rings show, from inside the sphere and from well out.
const SPHERE_SEEN: [f32; 2] = [0.35, 1.0];

/// A camera key, relative to the walker's track point (x toward the
/// carriageway, z ahead): where the eye is, where it looks, what it keeps
/// sharp, the lens, the aperture and how much it is his own eyes.
struct Key {
    at: f32,
    eye: [f32; 3],
    look: [f32; 3],
    focus: [f32; 3],
    lens: f32,
    aperture: f32,
    own: f32,
}

const fn key(
    at: f32,
    eye: [f32; 3],
    look: [f32; 3],
    focus: [f32; 3],
    lens: f32,
    aperture: f32,
    own: f32,
) -> Key {
    Key {
        at,
        eye,
        look,
        focus,
        lens,
        aperture,
        own,
    }
}

const FIRST_PERSON: Key = key(
    0.0,
    [0.0, 1.62, 0.05],
    [0.0, 1.5, 6.0],
    [0.0, 1.4, 6.0],
    1.55,
    0.0035,
    1.0,
);

const fn at(t: f32, k: Key) -> Key {
    Key { at: t, ..k }
}

const SHOTS: [Key; 22] = [
    FIRST_PERSON,
    at(13.6, FIRST_PERSON),
    // Out of his eyes sideways, toward the shop windows (the lamp poles
    // stand on the other side): the head stays out of the frame, to the
    // left, until the camera has drawn back behind his right shoulder.
    key(
        14.8,
        [-0.42, 1.64, 0.2],
        [0.15, 1.45, 6.0],
        [0.0, 1.4, 6.0],
        1.6,
        0.004,
        0.0,
    ),
    // Over the right shoulder.
    key(
        16.8,
        [-0.55, 1.78, -1.25],
        [0.25, 1.35, 5.0],
        [0.0, 1.3, 0.1],
        1.75,
        0.006,
        0.0,
    ),
    key(
        23.0,
        [-0.75, 1.55, -1.55],
        [0.3, 1.3, 5.0],
        [0.0, 1.2, 0.1],
        1.8,
        0.007,
        0.0,
    ),
    // Round behind him to his left, clear of the head.
    key(
        24.2,
        [1.45, 1.65, 0.1],
        [-0.1, 1.5, 0.6],
        [0.0, 1.55, 0.2],
        2.1,
        0.008,
        0.0,
    ),
    // His profile from the carriageway side against the lit shop window:
    // the breath goes out white over the glass.
    key(
        25.4,
        [1.25, 1.6, 0.55],
        [-0.5, 1.55, 0.3],
        [0.0, 1.6, 0.15],
        2.4,
        0.008,
        0.0,
    ),
    key(
        28.4,
        [1.15, 1.56, 0.62],
        [-0.5, 1.52, 0.32],
        [0.0, 1.58, 0.15],
        2.4,
        0.008,
        0.0,
    ),
    // Close on the right hand.
    key(
        30.4,
        [1.0, 1.32, 0.95],
        [-0.45, 1.45, 0.35],
        [-0.12, 1.45, 0.45],
        2.7,
        0.012,
        0.0,
    ),
    key(
        34.2,
        [0.92, 1.36, 1.0],
        [-0.45, 1.47, 0.35],
        [-0.12, 1.47, 0.45],
        2.7,
        0.012,
        0.0,
    ),
    // From the carriageway, wide: the voice reaches the walls.
    key(
        36.6,
        [3.3, 2.5, -0.2],
        [-0.8, 1.5, 1.0],
        [0.0, 1.3, 0.0],
        1.6,
        0.006,
        0.0,
    ),
    key(
        40.2,
        [3.4, 2.7, 0.6],
        [-0.8, 1.4, 1.4],
        [0.0, 1.3, 0.0],
        1.6,
        0.006,
        0.0,
    ),
    // Down at the puddles behind him, against the street's lights: the
    // foot comes down into the water.
    key(
        42.4,
        [0.55, 0.2, -1.5],
        [0.0, 0.14, 1.2],
        [0.0, 0.1, 0.5],
        2.0,
        0.01,
        0.0,
    ),
    key(
        45.4,
        [0.5, 0.22, -1.4],
        [0.0, 0.16, 1.2],
        [0.0, 0.1, 0.5],
        2.0,
        0.01,
        0.0,
    ),
    // Behind him at head height: the echo comes back.
    key(
        47.4,
        [-0.7, 2.2, -2.8],
        [0.1, 1.45, 1.0],
        [0.0, 1.5, 0.0],
        1.75,
        0.007,
        0.0,
    ),
    key(
        50.6,
        [-0.6, 2.3, -2.9],
        [0.1, 1.45, 1.0],
        [0.0, 1.5, 0.0],
        1.75,
        0.007,
        0.0,
    ),
    // The crane over the street, a model of it.
    key(
        55.5,
        [3.0, 11.0, -8.0],
        [0.5, 0.6, 5.0],
        [0.0, 0.8, 0.0],
        1.7,
        0.005,
        0.0,
    ),
    key(
        59.6,
        [4.5, 22.0, -13.0],
        [1.0, 0.0, 9.0],
        [0.0, 0.8, 0.0],
        1.65,
        0.004,
        0.0,
    ),
    // The dive back into his eyes, down past his right shoulder and in
    // from the side, the way it came out.
    key(
        62.4,
        [-0.6, 1.85, -0.45],
        [0.15, 1.45, 6.0],
        [0.0, 1.4, 6.0],
        1.6,
        0.004,
        0.0,
    ),
    key(
        63.1,
        [-0.42, 1.64, 0.2],
        [-0.15, 1.45, 6.0],
        [0.0, 1.4, 6.0],
        1.6,
        0.004,
        0.0,
    ),
    at(63.7, FIRST_PERSON),
    at(LOOP, FIRST_PERSON),
];

/// The head's glances (radians, left positive) and nods (down positive).
const TURN: [(f32, f32); 17] = [
    (0.0, -0.25),
    (1.4, 0.55),
    (2.6, 0.5),
    (4.0, -0.6),
    (5.2, -0.65),
    (6.6, 0.15),
    (7.6, 0.45),
    (8.8, -0.35),
    (10.4, -0.5),
    (11.8, 0.2),
    (13.2, 0.0),
    (29.6, 0.0),
    (31.0, -0.15),
    (33.6, -0.15),
    (35.2, 0.0),
    (62.8, -0.1),
    (LOOP, -0.25),
];
const NOD: [(f32, f32); 20] = [
    (0.0, -0.05),
    (1.4, -0.22),
    (2.6, -0.1),
    (4.0, 0.05),
    (5.2, -0.18),
    (6.6, 0.0),
    (8.8, -0.2),
    (10.4, 0.0),
    (13.2, 0.0),
    (29.6, 0.0),
    (31.0, 0.35),
    (33.6, 0.35),
    (35.2, 0.0),
    (41.6, 0.0),
    (42.6, 0.15),
    (45.0, 0.15),
    (46.0, 0.0),
    (62.8, 0.0),
    (63.6, -0.05),
    (LOOP, -0.05),
];
/// The city's unrest under the evaluation phrases.
const AGITATION: [(f32, f32); 6] = [
    (0.0, 0.85),
    (1.2, 1.0),
    (13.2, 1.0),
    (17.0, 0.0),
    (61.0, 0.0),
    (LOOP, 0.85),
];
/// The crossing light shows stop (warm) in these spans, go otherwise.
const STOP: [(f32, f32); 4] = [(-1.4, 2.4), (4.4, 6.6), (8.8, 11.0), (62.6, 66.4)];
/// How brightly his steps ring in the wet pavement.
const PRINTS: [(f32, f32); 5] = [
    (0.0, 0.35),
    (17.5, 0.35),
    (19.5, 1.0),
    (60.0, 1.0),
    (LOOP, 0.35),
];
/// His outline's light.
const RIM: [(f32, f32); 6] = [
    (0.0, 1.0),
    (18.0, 1.0),
    (19.5, 1.8),
    (23.5, 1.8),
    (25.5, 1.1),
    (LOOP, 1.0),
];
/// The right hand rising into the rain.
const REACH: [(f32, f32); 4] = [(29.3, 0.0), (31.0, 1.0), (33.6, 1.0), (35.2, 0.0)];

/// Everything one frame shows.
#[derive(Clone, Copy, Debug)]
pub struct Frame {
    pub time: f32,
    pub eye: V3,
    pub right: V3,
    pub up: V3,
    pub forward: V3,
    pub lens: f32,
    pub focus: f32,
    pub aperture: f32,
    pub body: Body,
    /// The passers-by, as they stand at `time` (the street repeats them
    /// every `REPEAT`).
    pub passers: [Body; PASSERS],
    /// The camera is inside his head: the head is not drawn.
    pub head_hidden: f32,
    pub rim: f32,
    /// How thick the breath clouds are.
    pub breath: f32,
    /// Breath clouds: centre and age (s), age < 0 none.
    pub puffs: [[f32; 4]; PUFFS],
    /// The two newest voice shells: centres, radii (< 0 none), lights.
    pub voice_from: [V3; 2],
    pub voice: [f32; 4],
    /// How brightly the shells ring where they touch the street.
    pub walls: f32,
    /// The echo's two shells about his head: radius, light, radius, light.
    pub echo: [f32; 4],
    pub track: f32,
    pub agitation: f32,
    /// The crossing light: 0 go (cold) … 1 stop (warm).
    pub signal: f32,
    pub prints: f32,
    /// How high the camera has risen, 0 at his height … 1 over the roofs.
    pub crane: f32,
    pub palm: V3,
    pub palm_rain: f32,
    /// Footsteps, newest first: x, z, seconds since landing, side.
    pub steps: [[f32; 4]; STEP_MARKS],
    /// The rain's box follows the camera's view.
    pub rain_centre: V3,
    /// The puddle the step lands in: x, z, radius.
    pub puddle: [f32; 3],
    /// The sphere round him: centre, radius.
    pub sphere: [f32; 4],
    /// Its rings: the first's height, the second's, the third's turn
    /// (radians), how plainly they show.
    pub rings: [f32; 4],
}

pub struct Story {
    pub chapter: Chapter,
    pub loop_seconds: f32,
    walk: Walk,
    puddle: [f32; 3],
    umbrella: Walk,
    /// Where the umbrella's line of copies starts along the street.
    umbrella_from: f32,
    phone: Walk,
    phone_at: V3,
}

/// The step that lands in the puddle, «Шаг происходит».
pub const PUDDLE_STEP: f32 = 43.4;

impl Story {
    pub fn new(chapter: Chapter) -> Story {
        let period = LOOP / STEPS as f32;
        let walk = Walk::steady(period, STRIDE, STEP_WIDTH, -8, STEPS + 8, 7.0);
        let splash = walk
            .landings(PUDDLE_STEP)
            .next()
            .copied()
            .expect("the walk has begun by then");
        let period = LOOP / UMBRELLA_STEPS as f32;
        let stride = REPEAT / UMBRELLA_STEPS as f32 / UMBRELLA_SCALE;
        let umbrella = Walk::steady(period, stride, 0.075, -8, UMBRELLA_STEPS + 8, 6.0);
        let umbrella_from =
            walk.track(UMBRELLA_MEETS) + UMBRELLA_SCALE * umbrella.track(UMBRELLA_MEETS);
        // Standing: two steps long before the loop, then only its sway,
        // which comes round with the loop.
        let step = |side: usize, land: f32, x: f32, z: f32| Step {
            side,
            lift: land - 0.4,
            land,
            x,
            z,
        };
        let phone = Walk::new(
            [[0.12, 0.0], [-0.12, 0.05]],
            vec![step(0, -30.0, 0.12, 0.0), step(1, -29.5, -0.12, 0.05)],
            LOOP / 12.0,
        );
        let phone_at = v3(PHONE_X, 0.0, walk.track(PHONE_MEETS) + 0.15);
        Story {
            chapter,
            loop_seconds: chapter.loop_seconds(),
            walk,
            puddle: [splash.x + WALK_X, splash.z + 0.1, 0.62],
            umbrella,
            umbrella_from,
            phone,
            phone_at,
        }
    }

    /// The one under the umbrella at `t`, the hand holding it at the chest.
    pub fn umbrella(&self, t: f32) -> Body {
        let w = &self.umbrella;
        let mut pose = w.pose(t, Self::breath(t + 1.1));
        pose.carry = Carry::Umbrella;
        pose.coat = Coat {
            length: 0.68,
            bulk: -0.012,
        };
        let probe = build(&pose);
        let c = probe.chest_axes;
        let grip = probe.chest + c.forward * 0.22 - c.left * 0.06 + Y * 0.1;
        pose.hands[1] = [grip.x, grip.y, grip.z, 1.0];
        pose.wrists[1] = 0.35;
        let along = w.track(t);
        let z = self.umbrella_from - UMBRELLA_SCALE * along;
        build(&pose)
            .moved(|_| v3(0.0, 0.0, -along))
            .scaled(UMBRELLA_SCALE)
            .turned(PI, v3(UMBRELLA_X, 0.0, z))
    }

    /// The one with the phone at `t`: the head bowed to the screen held
    /// before the face, up and round to him as he passes.
    pub fn phone(&self, t: f32) -> Body {
        let mut pose = self.phone.pose(t, Self::breath(t + 2.3));
        pose.carry = Carry::Phone;
        pose.coat = Coat {
            length: 0.26,
            bulk: 0.028,
        };
        let up = monotone(&PHONE_UP, t - PHONE_MEETS);
        pose.nod = mix(0.42, 0.06, up);
        pose.turn = 0.6 * monotone(&PHONE_FOLLOW, t - PHONE_MEETS);
        let probe = build(&pose);
        let c = probe.chest_axes;
        let hold = probe.chest + c.forward * 0.3 - c.left * 0.05 + Y * mix(0.16, 0.08, up);
        pose.hands[1] = [hold.x, hold.y, hold.z, 1.0];
        pose.wrists[1] = -0.15;
        build(&pose).turned(PI - PHONE_TURN, self.phone_at)
    }

    pub fn passers(&self, t: f32) -> [Body; PASSERS] {
        let mut all = [self.umbrella(t), self.phone(t)];
        all.swap(0, UMBRELLA);
        all
    }

    pub fn walk(&self) -> &Walk {
        &self.walk
    }

    /// The breath: 0 out … 1 in.
    pub fn breath(t: f32) -> f32 {
        let s = t.rem_euclid(BREATH);
        if s < INHALE {
            smooth(0.0, INHALE, s)
        } else {
            1.0 - smooth(INHALE, BREATH, s)
        }
    }

    /// The figure at `t`, standing on the pavement.
    pub fn body(&self, t: f32) -> Body {
        let mut pose = self.walk.pose(t, Self::breath(t));
        pose.turn = monotone(&TURN, t);
        pose.nod = monotone(&NOD, t);
        let reach = monotone(&REACH, t);
        if reach > 0.0 {
            // Palm up in front of the chest, a little to the right.
            let probe = build(&pose);
            let c = probe.chest_axes;
            let target = probe.chest + c.forward * 0.42 - c.left * 0.12 + Y * 0.1;
            pose.hands[1] = [target.x, target.y, target.z, reach];
            pose.wrists[1] = -0.25 * reach;
        }
        build(&pose).moved(|_| v3(WALK_X, 0.0, 0.0))
    }

    pub fn compose(&self, t: f32) -> Frame {
        let t = t.rem_euclid(self.loop_seconds);
        let body = self.body(t);
        let passers = self.passers(t);
        let track = self.walk.track(t);
        let base = v3(WALK_X, 0.0, track);
        let curve = |pick: fn(&Key) -> f32| -> f32 {
            let keys: Vec<(f32, f32)> = SHOTS.iter().map(|k| (k.at, pick(k))).collect();
            monotone(&keys, t)
        };
        let keyed =
            |pick: [fn(&Key) -> f32; 3]| base + v3(curve(pick[0]), curve(pick[1]), curve(pick[2]));
        let eye_k = keyed([|k| k.eye[0], |k| k.eye[1], |k| k.eye[2]]);
        let look_k = keyed([|k| k.look[0], |k| k.look[1], |k| k.look[2]]);
        let focus_k = keyed([|k| k.focus[0], |k| k.focus[1], |k| k.focus[2]]);
        let own = curve(|k| k.own).clamp(0.0, 1.0);
        let lens = curve(|k| k.lens);
        let aperture = curve(|k| k.aperture);
        // His own eyes: just in front of the head, along the face.
        let face = body.face;
        let eye_own = body.mouth + face.up * 0.085 + face.forward * 0.01;
        let eye = eye_k.lerp(eye_own, own);
        let dir_k = (look_k - eye_k).normalize();
        let forward = dir_k.lerp(face.forward, own).normalize();
        let right = forward.cross(Y).normalize();
        let up = right.cross(forward);
        let focus_far = (focus_k - eye).length().max(0.3);
        let focus = mix(focus_far, 6.0, own);
        let head_centre = body.head - face.up * 0.08;
        let head_hidden = f32::from((eye - head_centre).length() < 0.3);

        let breath_at = |k: i32| INHALE + BREATH * k as f32;
        let newest = ((t - INHALE) / BREATH).floor() as i32;
        let mut puffs = [[0.0, 0.0, 0.0, -1.0]; PUFFS];
        for (i, p) in puffs.iter_mut().enumerate() {
            let k = newest - i as i32;
            let age = t - breath_at(k);
            if (0.0..PUFF_LIFE).contains(&age) {
                let from = self.body(breath_at(k));
                // Out of the mouth ahead at walking pace and a little more,
                // slowed by the air: he walks on through it.
                let tau = 0.6;
                let speed = STRIDE / (LOOP / STEPS as f32) + 0.6;
                let c = from.mouth
                    + from.face.forward * (0.08 + speed * tau * (1.0 - (-age / tau).exp()))
                    + Y * (0.05 * age - 0.04);
                *p = [c.x, c.y, c.z, age];
            }
        }
        let breath = 0.35 + 0.65 * window(t, 23.6, 24.8, 28.8, 29.8);

        let mut voice = [-1.0, -1.0, 0.0, 0.0];
        let mut voice_from = [eye, eye];
        let mut n = 0;
        for &at in VOICE_AT.iter().rev() {
            let age = t - at;
            if n < 2 && (0.0..VOICE_LIFE).contains(&age) {
                // The two newest shells, newest first.
                voice[n] = 0.12 + VOICE_SPEED * age;
                voice[2 + n] = smooth(0.0, 0.15, age) * (1.0 - age / VOICE_LIFE).powf(1.5);
                voice_from[n] = self.body(at).mouth;
                n += 1;
            }
        }
        let mut echo = [-1.0, 0.0, -1.0, 0.0];
        let mut n = 0;
        for &at in ECHO_AT.iter().rev() {
            let age = t - at;
            let life = ECHO_FROM / VOICE_SPEED;
            if n < 2 && (0.0..life).contains(&age) {
                echo[2 * n] = ECHO_FROM - VOICE_SPEED * age;
                echo[2 * n + 1] = smooth(0.0, 0.4, age) * (0.4 + 0.6 * age / life);
                n += 1;
            }
        }
        let walls = window(t, 35.6, 36.2, 50.8, 51.6);

        let signal = STOP
            .iter()
            .map(|&(a, b)| {
                window(t, a, a + 0.15, b, b + 0.15).max(window(t + LOOP, a, a + 0.15, b, b + 0.15))
            })
            .fold(0.0, f32::max);

        let mut steps = [[0.0, 0.0, 99.0, 0.0]; STEP_MARKS];
        for (slot, s) in steps.iter_mut().zip(self.walk.landings(t)) {
            *slot = [s.x + WALK_X, s.z, t - s.land, s.side as f32];
        }

        let reach = monotone(&REACH, t);
        let palm = {
            let [ax, ay, az, _] = body.cones[3 * HANDS[1]];
            let [bx, by, bz, _] = body.cones[3 * HANDS[1] + 1];
            v3(ax + bx, ay + by, az + bz) * 0.5
        };
        let mid = eye.lerp(eye + forward * focus, 0.5);
        let rain_centre = v3(mid.x, mid.y.max(6.0), mid.z);

        let (sphere, rings) = sphere(t, base, eye);

        Frame {
            time: t,
            eye,
            right,
            up,
            forward,
            lens,
            focus,
            aperture,
            body,
            passers,
            head_hidden,
            rim: monotone(&RIM, t),
            breath,
            puffs,
            voice_from,
            voice,
            walls,
            echo,
            track,
            agitation: monotone(&AGITATION, t),
            signal,
            prints: monotone(&PRINTS, t),
            crane: smooth(3.0, 14.0, eye.y),
            palm,
            palm_rain: reach,
            steps,
            rain_centre,
            puddle: self.puddle,
            sphere,
            rings,
        }
    }
}

/// The sphere and its rings at `t`, round the walk's point `base`, seen
/// from `eye`: the rings show least from inside and from near the glass.
pub fn sphere(t: f32, base: V3, eye: V3) -> ([f32; 4], [f32; 4]) {
    let c = base + Y * SPHERE_Y;
    // The first ring: from near the top (polar angle 0.35) down to where
    // the glass meets the pavement, and back.
    let ground = (-SPHERE_Y / SPHERE_R).acos();
    let swing = 0.5 - 0.5 * (2.0 * PI * t / RING_PERIOD).cos();
    let first = SPHERE_Y + SPHERE_R * mix(0.35, ground - 0.02, swing).cos();
    // The second: up while the first goes down.
    let second = mix(SECOND_RING[0], SECOND_RING[1], 1.0 - swing);
    let third = (2.0 * PI * t / MERIDIAN_PERIOD).rem_euclid(2.0 * PI);
    let away = (eye - c).length();
    let seen = mix(
        SPHERE_SEEN[0],
        SPHERE_SEEN[1],
        smooth(SPHERE_R + 0.1, SPHERE_R + 0.7, away),
    );
    ([c.x, c.y, c.z, SPHERE_R], [first, second, third, seen])
}

/// Which lot (cell) of the street a point along it stands in. The shaders
/// count the same way.
pub fn cell(z: f32) -> i32 {
    ((z + 0.5 * CELL) / CELL).floor() as i32
}

/// Whether a cell is a cross street.
pub fn crossing(cell: i32) -> bool {
    cell.rem_euclid(5) == CROSS
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::REPEAT;

    #[test]
    fn the_rings_come_round_with_the_loop() {
        let rounds = [LOOP / RING_PERIOD, LOOP / MERIDIAN_PERIOD];
        for r in rounds {
            assert!((r - r.round()).abs() < 1e-4, "{r}");
        }
        let s = Story::new(Chapter::Fact);
        let (a, b) = (s.compose(0.0), s.compose(LOOP - 1e-3));
        for i in 0..3 {
            assert!((a.rings[i] - b.rings[i]).abs() < 0.01 || i == 2, "{i}");
        }
        // The first ring reaches the pavement and the top's neighbourhood,
        // the second his soles and his crown.
        let mut low: f32 = 9.0;
        let mut high: f32 = -9.0;
        for k in 0..160 {
            let f = s.compose(k as f32 * 0.05);
            low = low.min(f.rings[0]);
            high = high.max(f.rings[0]);
            assert!(f.rings[1] >= SECOND_RING[0] - 1e-4 && f.rings[1] <= SECOND_RING[1] + 1e-4);
            assert!(f.rings[3] >= SPHERE_SEEN[0] && f.rings[3] <= SPHERE_SEEN[1]);
        }
        assert!(low > 0.0 && low < 0.06, "{low}");
        assert!(high > SPHERE_Y + 0.9 * SPHERE_R, "{high}");
    }

    #[test]
    fn the_sphere_holds_him() {
        let s = Story::new(Chapter::Fact);
        for k in 0..64 {
            let f = s.compose(k as f32);
            let c = v3(f.sphere[0], f.sphere[1], f.sphere[2]);
            for p in [f.body.head, v3(f.body.head.x, 0.0, f.body.head.z)] {
                assert!((p - c).length() < SPHERE_R - 0.15, "{k}");
            }
        }
    }

    #[test]
    fn the_loop_closes() {
        let story = Story::new(Chapter::Fact);
        let (a, b) = (story.compose(0.0), story.compose(LOOP - 1e-3));
        assert!(
            (b.eye.z - a.eye.z - REPEAT).abs() < 0.05,
            "{} {}",
            a.eye.z,
            b.eye.z
        );
        assert!((b.eye.y - a.eye.y).abs() < 0.01);
        assert!((b.eye.x - a.eye.x).abs() < 0.01);
        assert!(b.forward.lerp(a.forward, 1.0).dot(a.forward) > 0.999);
        assert!((b.agitation - a.agitation).abs() < 0.01);
        assert!((b.signal - a.signal).abs() < 0.01);
    }

    #[test]
    fn the_camera_moves_smoothly() {
        let story = Story::new(Chapter::Fact);
        let mut previous = story.compose(0.0);
        // The seam (64 s back to 0) has its own test: the city moves on by REPEAT.
        for i in 1..6400 {
            let f = story.compose(i as f32 * 0.01);
            let jump = (f.eye - previous.eye).length();
            // At most the crane's dive, under 20 m/s.
            assert!(jump < 0.2, "{} {jump}", f.time);
            // His head never fills the lens: close to the camera it is
            // hidden or well off the view's axis.
            let to_head = f.body.head - f.eye;
            let close = to_head.length() < 0.5;
            assert!(
                f.head_hidden > 0.5 || !close || f.forward.dot(to_head.normalize()) < 0.6,
                "{} the head before the lens",
                f.time
            );
            assert!(f.forward.dot(previous.forward) > 0.995, "{}", f.time);
            previous = f;
        }
    }

    #[test]
    fn the_camera_never_goes_under_the_street() {
        let story = Story::new(Chapter::Fact);
        for i in 0..640 {
            let f = story.compose(i as f32 * 0.1);
            assert!(f.eye.y > 0.12, "{} {}", f.time, f.eye.y);
            assert!(f.eye.x.abs() < 5.6, "{}", f.time);
            assert!(f.focus > 0.25);
        }
    }

    #[test]
    fn his_head_is_hidden_only_from_his_own_eyes() {
        let story = Story::new(Chapter::Fact);
        assert_eq!(story.compose(6.0).head_hidden, 1.0);
        assert_eq!(story.compose(21.0).head_hidden, 0.0);
        assert_eq!(story.compose(55.0).head_hidden, 0.0);
    }

    #[test]
    fn the_voice_goes_out_and_comes_back() {
        let story = Story::new(Chapter::Fact);
        let f = story.compose(37.0);
        assert!(f.voice[0] > 0.0 && f.voice[2] > 0.0);
        assert!(story.compose(30.0).voice[0] < 0.0);
        let e = story.compose(47.0);
        assert!(e.echo[0] > 0.0 && e.echo[0] < ECHO_FROM);
        assert!(story.compose(40.0).echo[0] < 0.0);
    }

    #[test]
    fn the_hand_rises_into_the_rain() {
        let story = Story::new(Chapter::Fact);
        let low = story.compose(27.0);
        let high = story.compose(32.0);
        assert!(
            high.palm.y > low.palm.y + 0.25,
            "{} {}",
            low.palm.y,
            high.palm.y
        );
        assert!(high.palm_rain > 0.99);
    }

    #[test]
    fn the_walker_stays_on_the_pavement() {
        let story = Story::new(Chapter::Fact);
        for i in 0..64 {
            let f = story.compose(i as f32);
            assert!(f.body.low.x > -crate::FACADE && f.body.high.x < -crate::ROAD);
            assert!(f.body.low.y > -0.01);
        }
    }

    /// How far ahead of him (along the street, either way) `z` is, folded
    /// into one `REPEAT` as the street repeats its passers.
    fn ahead(z: f32, of: f32) -> f32 {
        (z - of + 0.5 * REPEAT).rem_euclid(REPEAT) - 0.5 * REPEAT
    }

    #[test]
    fn the_passers_come_round_with_the_loop() {
        let story = Story::new(Chapter::Fact);
        let a = story.passers(0.0);
        let b = story.passers(LOOP - 1e-3);
        for (a, b) in a.iter().zip(&b) {
            let dz = ahead(b.pelvis.z, a.pelvis.z);
            assert!(dz.abs() < 0.01, "{dz}");
            assert!((b.pelvis.x - a.pelvis.x).abs() < 0.01);
            assert!((b.head.y - a.head.y).abs() < 0.01);
            for c in 0..crate::body::PRIMITIVES {
                let (p, q) = (a.cones[3 * c], b.cones[3 * c]);
                assert!((p[1] - q[1]).abs() < 0.02, "cone {c}");
                assert!((p[3] - q[3]).abs() < 1e-4, "cone {c}");
            }
        }
    }

    #[test]
    fn the_passers_keep_to_the_pavement_and_clear_of_him() {
        let story = Story::new(Chapter::Fact);
        for i in 0..640 {
            let t = i as f32 * 0.1;
            let f = story.compose(t);
            for p in &f.passers {
                assert!(p.low.x > -crate::FACADE && p.high.x < -crate::ROAD, "{t}");
                assert!(p.low.y > -0.01, "{t}");
                // Never through him: their boxes part across the street
                // wherever they share his stretch of it.
                if ahead(p.pelvis.z, f.body.pelvis.z).abs() < 1.0 {
                    let apart = (p.low.x - f.body.high.x).max(f.body.low.x - p.high.x);
                    assert!(apart > 0.0, "{t} {apart}");
                }
            }
        }
    }

    #[test]
    fn the_passers_meet_him_when_the_story_says() {
        let story = Story::new(Chapter::Fact);
        for t in [UMBRELLA_MEETS, UMBRELLA_MEETS + 0.5 * LOOP] {
            let f = story.compose(t);
            let dz = ahead(f.passers[0].pelvis.z, f.body.pelvis.z);
            assert!(dz.abs() < 0.3, "{t} {dz}");
        }
        let f = story.compose(PHONE_MEETS);
        let dz = ahead(f.passers[1].pelvis.z, f.body.pelvis.z);
        assert!(dz.abs() < 0.4, "{dz}");
        // It looks down at the screen, then up at him.
        let down = story.phone(40.0);
        let up = story.phone(PHONE_MEETS + 0.3);
        assert!(up.face.forward.y > down.face.forward.y + 0.2);
        assert!(down.screen[1].length() > 0.9);
    }

    #[test]
    fn the_phone_stands_clear_of_the_lamp_posts() {
        let story = Story::new(Chapter::Fact);
        let z = story.phone(0.0).pelvis.z;
        // The walker's side has its posts halfway between the far side's.
        let k = (z / crate::LAMP_GAP - 0.5).round();
        assert!((z - (k + 0.5) * crate::LAMP_GAP).abs() > 1.2, "{z}");
    }

    #[test]
    fn the_cells_count_cross_streets_every_fifth() {
        assert_eq!(cell(0.0), 0);
        assert_eq!(cell(CELL * 0.49), 0);
        assert_eq!(cell(CELL * 0.51), 1);
        assert_eq!(cell(-CELL * 0.51), -1);
        assert!(crossing(2) && crossing(7) && crossing(-3) && !crossing(0));
    }

    #[test]
    fn the_step_lands_in_the_puddle_on_the_crossing() {
        let story = Story::new(Chapter::Fact);
        let f = story.compose(PUDDLE_STEP);
        let [x, z, r] = f.puddle;
        assert!(crossing(cell(z)), "{z}");
        let s = f.steps[0];
        assert!(((s[0] - x).powi(2) + (s[1] - z).powi(2)).sqrt() < r * 0.5);
        assert!(s[2] < 0.5);
    }
}
