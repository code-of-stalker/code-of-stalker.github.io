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
//!
//! Page 07 «Главная проверка» (126.9 s): a tape played twice, the wrong
//! take, its rewind and the right take; the city's clock covers one LOOP.
//! 0–5.5 s     over the shoulder: the phone comes out, the head goes down;
//! 5.5–10.5 s  the first ring goes out, the city's clock slows nearly to a
//!             halt (the rain hangs, the code stops, the cars stand);
//! 10.5–14.5 s before his face: the second ring goes out;
//! 14.5–25.2 s the view narrows to his face, only the third ring spins;
//!             he walks off the kerb on red into the side street;
//! 25.2–26.6 s its car is upon him, the tape stops a hand short of him;
//! 26.6–31.9 s the tape stands, then runs back to 1 s;
//! 31.9–47.5 s the right take: the same walk with the phone, the rings
//!             lit, glances up at the street;
//! 47.5–52.2 s the phone goes away, he stops at the kerb;
//! 52.2–55.4 s «стопы»: light at his soles;
//! 55.4–59.4 s «опора»: rings from his feet; the car turns past him;
//! 59.6–64.5 s «дыхание»: one long breath, a big cloud;
//! 64.5–71 s   «расхлопнутость»: the sphere opens wide;
//! 71–83 s     «пространство»: drawn back and up, he waits for green;
//! 83–120 s    green, he walks on under the crane;
//! 120–126.9 s back down over his shoulder.
//!
//! Page 08 «Используй свой голос» (104 s): down into the tiled underpass
//! under the cross street; each phrase runs along the tiles as a shell
//! and comes back as an echo that fixes one thing. He speaks it into the
//! Diary of our app on his phone.
//! 0–3 s      down the stairs; the phone comes out of his left pocket;
//! 3–10.6 s   in his eyes, the phone: our app, its Diary, the record
//!            button; the recording runs;
//! 10.6–14 s  out of his eyes beside him, the phone at his chest; each
//!            phrase he says into it, held under the mouth, the breath
//!            leaving with each word («Проговори вслух»);
//! 15.5 s     «Я Здесь»: the sphere sharpens;
//! 22 s       «Я Слышу внешнее»: the echo comes back, the first ring lights;
//! 29 s       «Я Ощущаю внутреннее»: the echo goes into him, the second;
//! 36 s       «Я Двигаюсь»: he walks on, the third turns with his pace;
//! 49.6 s     «Я Действую»: up the far stairs, his hand on the rail;
//! 59.4 s     «Я Осознаю три кольца»: three echoes meet him as one chord;
//! 67 s       «Я Есть»: out into the open street, the rain, the crane;
//!            the tiles keep a line of code from each phrase («Голос не
//!            объясняет. Он фиксирует.»);
//! 96–104 s   down behind him to the next stairs.
use crate::body::{build, Body, Carry, Coat, Held, Step, Walk, HANDS, PHONE_SIZE, SWING_SHARE};
use crate::math::{mix, monotone, smooth, smooth_integral, v3, window, window_integral, V3, Y};
use crate::{
    under_along, under_ramp, Chapter, CARS, CAR_LANE, CELL, CHECK_LOOP, CROSS, FLAT, FLIGHT, LOOP,
    PUFFS, REPEAT, RISE, RISERS, STEPS, STEP_MARKS, STEP_WIDTH, STRIDE, TREAD, UNDER_LEN, UNDER_Z,
    VOICE_LOOP, WALK_X,
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
/// A curve that stays at nothing.
const NONE: [(f32, f32); 1] = [(0.0, 0.0)];

/// Page 07 is a tape played twice. The wrong take: he goes into the
/// phone, the rings go out one by one, the city goes still, and he walks
/// on red into the side street's lane, where at `TAKE_END` its car is
/// upon him. The tape stands `FREEZE`, then runs back to `REWIND_TO` by
/// `RIGHT_FROM`, and the right take plays: the same walk and the same
/// car, but he keeps the rings lit over the phone, puts it away before
/// the kerb, comes back into feeling there and crosses on green.
pub const TAKE_END: f32 = 26.6;
pub const FREEZE: f32 = 0.8;
pub const REWIND_TO: f32 = 1.0;
pub const RIGHT_FROM: f32 = 31.9;
/// The right take's script runs this far ahead of his own clock: its
/// `RIGHT_FROM` is the wrong take's `REWIND_TO`.
const RIGHT_SHIFT: f32 = RIGHT_FROM - REWIND_TO;
/// His own clock covers this much in a lap (the right take's end), the
/// city's `LOOP`.
const OWN_LOOP: f32 = CHECK_LOOP - RIGHT_SHIFT;
const CITY_RATE: f32 = LOOP / OWN_LOOP;
/// While he is lost in the phone the city's clock slows to `STILL_RATE`
/// between the middle two of `HUSH`, eased over the spans either side.
const HUSH: [f32; 4] = [5.5, 9.5, 25.2, 26.0];
const STILL_RATE: f32 = 0.05;

/// Where page 07's tape is: which take, and the moment of its script.
/// Page 06 has one take, its script time the loop's.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Reel {
    pub right: bool,
    pub at: f32,
}

impl Reel {
    /// His own clock: both takes start from the same moment of his walk.
    pub fn own(self) -> f32 {
        if self.right {
            self.at - RIGHT_SHIFT
        } else {
            self.at
        }
    }

    /// Page 07's city clock within the lap.
    fn city(self) -> f32 {
        CITY_RATE
            * if self.right {
                self.own()
            } else {
                held(self.at)
            }
    }
}

/// The tape at `t` of the loop: page 07 stands at `TAKE_END`, then runs
/// back to `REWIND_TO`, fast in the middle and slow at either end.
pub fn reel(chapter: Chapter, t: f32) -> Reel {
    let check = chapter == Chapter::Check;
    let right = check && t >= RIGHT_FROM;
    let at = if check && t > TAKE_END && !right {
        TAKE_END - (TAKE_END - REWIND_TO) * smooth(TAKE_END + FREEZE, RIGHT_FROM, t)
    } else {
        t
    };
    Reel { right, at }
}

/// The moment of the take `right` that his own clock's `own` belongs to
/// (before `REWIND_TO` the two takes are one).
fn reel_of(chapter: Chapter, own: f32, right: bool) -> Reel {
    if chapter == Chapter::Check && right && own >= REWIND_TO {
        Reel {
            right: true,
            at: own + RIGHT_SHIFT,
        }
    } else {
        Reel {
            right: false,
            at: own,
        }
    }
}

/// The city's clock at `t` of the loop's: on page 07 it nearly stops
/// while he is lost, runs back with the tape, and covers `LOOP` in each
/// lap, as the street, the rain and the code need.
pub fn world_time(chapter: Chapter, t: f32) -> f32 {
    match chapter {
        Chapter::Fact => t,
        Chapter::Check => {
            let laps = (t / CHECK_LOOP).floor();
            LOOP * laps + reel(chapter, t - laps * CHECK_LOOP).city()
        }
        // Page 08's lap carries him a whole REPEAT, which the street's
        // clock covers in two of its loops.
        Chapter::Voice => t * 2.0 * LOOP / VOICE_LOOP,
    }
}

/// The wrong take's slowed time, before scaling.
fn held(t: f32) -> f32 {
    let [a, b, c, d] = HUSH;
    t - (1.0 - STILL_RATE) * window_integral(t, a, b, c, d)
}

/// His walk on page 07, from `CHECK_FROM` (step 0's spot). In the wrong
/// take he walks on to step `WRONG_LAST`, into the side street's lane,
/// and brings his feet together there; in the right one he stops at
/// step `RIGHT_LAST`, short of the side street, and walks on from the
/// next step a lap on.
const CHECK_FROM: f32 = 26.36;
const WRONG_LAST: i32 = 48;
const RIGHT_LAST: i32 = 38;
/// The passers meet him at these moments of the tape (the umbrella in
/// both takes).
const CHECK_UMBRELLA_MEETS: f32 = 4.0;
const CHECK_PHONE_MEETS: f32 = 98.0;
/// The rings show this much more plainly on page 07, which is about them.
const CHECK_RINGS: f32 = 2.0;
/// How brightly his own screen lights his face.
pub const HIS_SCREEN: f32 = 0.4;

/// Over his right shoulder, down at the phone in his hands.
const SHOULDER: Key = key(
    0.0,
    [-0.6, 1.8, -1.3],
    [0.15, 1.3, 3.0],
    [-0.05, 1.4, 0.35],
    1.75,
    0.006,
    0.0,
);
/// Closer over the shoulder, at the screen.
const AT_SCREEN: Key = key(
    0.0,
    [-0.66, 1.74, -1.12],
    [0.1, 1.32, 2.6],
    [-0.05, 1.42, 0.35],
    1.85,
    0.007,
    0.0,
);

const CHECK_SHOTS: [Key; 31] = [
    // The wrong take.
    SHOULDER,
    at(1.0, SHOULDER),
    at(4.5, AT_SCREEN),
    // Ahead of him by the shop windows, looking back: the street goes
    // still round him.
    key(
        6.8,
        [-1.1, 1.5, 1.6],
        [0.6, 1.2, -0.6],
        [0.0, 1.35, 0.1],
        1.6,
        0.006,
        0.0,
    ),
    key(
        10.0,
        [-1.2, 1.45, 1.8],
        [0.65, 1.2, -0.5],
        [0.0, 1.35, 0.1],
        1.6,
        0.006,
        0.0,
    ),
    // Before his face, over the phone, closing in.
    key(
        12.8,
        [0.05, 1.5, 1.1],
        [0.0, 1.52, 0.1],
        [0.0, 1.56, 0.12],
        2.2,
        0.008,
        0.0,
    ),
    key(
        16.5,
        [0.08, 1.52, 0.97],
        [0.0, 1.52, 0.1],
        [0.0, 1.56, 0.12],
        2.35,
        0.009,
        0.0,
    ),
    key(
        19.5,
        [0.1, 1.55, 0.86],
        [0.0, 1.54, 0.1],
        [0.0, 1.57, 0.12],
        2.6,
        0.01,
        0.0,
    ),
    key(
        23.6,
        [0.14, 1.57, 0.8],
        [0.0, 1.54, 0.1],
        [0.0, 1.57, 0.12],
        2.7,
        0.01,
        0.0,
    ),
    // From the road past the corner: him on the right, the car rushing in
    // from the left and stopping a hand from him.
    key(
        25.6,
        [1.2, 1.35, 2.6],
        [-1.6, 1.0, -0.3],
        [-0.4, 1.1, 0.0],
        2.0,
        0.008,
        0.0,
    ),
    key(
        TAKE_END,
        [1.1, 1.32, 2.45],
        [-1.6, 1.0, -0.3],
        [-0.4, 1.1, 0.0],
        2.1,
        0.008,
        0.0,
    ),
    // The right take, from the same shoulder.
    at(RIGHT_FROM, SHOULDER),
    at(35.4, AT_SCREEN),
    // Ahead by the shop windows: he looks up from the phone, round him.
    key(
        39.0,
        [-1.1, 1.6, 2.3],
        [0.5, 1.15, -0.5],
        [0.0, 1.3, 0.1],
        1.5,
        0.006,
        0.0,
    ),
    key(
        43.5,
        [-1.2, 1.55, 2.5],
        [0.55, 1.15, -0.45],
        [0.0, 1.3, 0.1],
        1.5,
        0.006,
        0.0,
    ),
    // From the carriageway side as he puts the phone away.
    key(
        46.5,
        [1.9, 1.45, 0.7],
        [-1.0, 1.2, 0.0],
        [0.0, 1.35, 0.05],
        1.8,
        0.007,
        0.0,
    ),
    key(
        49.0,
        [1.8, 1.5, 0.3],
        [-1.0, 1.25, 0.05],
        [0.0, 1.35, 0.05],
        1.9,
        0.007,
        0.0,
    ),
    // Behind him as he comes to the kerb.
    key(
        51.0,
        [-0.75, 1.8, -1.5],
        [0.3, 1.2, 5.0],
        [0.0, 1.3, 2.0],
        1.7,
        0.006,
        0.0,
    ),
    // Down at his feet: «стопы».
    key(
        53.0,
        [-0.85, 0.32, -1.0],
        [0.05, 0.12, 0.3],
        [0.0, 0.1, 0.0],
        2.1,
        0.012,
        0.0,
    ),
    key(
        55.4,
        [-0.8, 0.3, -0.95],
        [0.05, 0.12, 0.3],
        [0.0, 0.1, 0.0],
        2.1,
        0.012,
        0.0,
    ),
    // Behind and over him: «опора», and the car goes by before him.
    key(
        57.0,
        [-0.9, 2.3, -2.6],
        [0.35, 0.4, 3.5],
        [0.0, 0.4, 1.5],
        1.6,
        0.006,
        0.0,
    ),
    key(
        59.4,
        [-0.95, 2.45, -2.75],
        [0.35, 0.35, 3.5],
        [0.0, 0.4, 1.5],
        1.6,
        0.006,
        0.0,
    ),
    // Round behind him to his left, wide of his head.
    key(
        60.2,
        [1.6, 2.1, -1.2],
        [-0.4, 1.1, 1.0],
        [0.0, 1.3, 0.5],
        1.9,
        0.007,
        0.0,
    ),
    // Before him, a little to his left: «дыхание», the cloud between.
    key(
        61.0,
        [1.0, 1.62, 1.3],
        [-0.7, 1.52, 0.15],
        [0.0, 1.62, 0.3],
        2.2,
        0.009,
        0.0,
    ),
    key(
        64.2,
        [0.95, 1.62, 1.35],
        [-0.7, 1.52, 0.2],
        [0.0, 1.62, 0.3],
        2.2,
        0.009,
        0.0,
    ),
    // Drawn back and up as the sphere opens: «расхлопнутость».
    key(
        70.5,
        [5.0, 5.0, -7.0],
        [-0.3, 0.8, 1.0],
        [0.0, 1.0, 0.0],
        1.6,
        0.005,
        0.0,
    ),
    // The crane over the quarter: «пространство»; green, he walks on.
    key(
        77.0,
        [3.0, 11.0, -8.0],
        [0.5, 0.6, 5.0],
        [0.0, 0.8, 0.0],
        1.7,
        0.005,
        0.0,
    ),
    key(
        95.0,
        [4.5, 22.0, -13.0],
        [1.0, 0.0, 9.0],
        [0.0, 0.8, 0.0],
        1.65,
        0.004,
        0.0,
    ),
    key(
        112.0,
        [-0.9, 3.2, -3.5],
        [0.2, 1.2, 4.0],
        [0.0, 1.3, 0.2],
        1.7,
        0.005,
        0.0,
    ),
    at(120.0, SHOULDER),
    at(CHECK_LOOP, SHOULDER),
];
/// Page 07's curves run on the script's time: the wrong take's up to
/// `TAKE_END`, the right take's from `RIGHT_FROM` (nothing reads between).
/// The head: in the wrong take up to the car at the last moment; in the
/// right one a glance at the street over the phone, and at the kerb right
/// to the car coming and left after it as it turns.
const CHECK_TURN: [(f32, f32); 16] = [
    (0.0, 0.0),
    (25.4, 0.0),
    (26.2, -0.6),
    (TAKE_END, -0.6),
    (RIGHT_FROM, 0.0),
    (41.0, 0.0),
    (41.8, 0.3),
    (43.0, 0.3),
    (43.8, 0.0),
    (56.0, 0.0),
    (56.8, -0.45),
    (57.6, -0.45),
    (58.9, 0.3),
    (59.7, 0.3),
    (60.5, 0.0),
    (CHECK_LOOP, 0.0),
];
/// In the wrong take bowed to the screen until the car; in the right one
/// up from it now and then, down to his feet at «стопы», a little up at
/// «расхлопнутость».
const CHECK_NOD: [(f32, f32); 30] = [
    (0.0, 0.05),
    (1.6, 0.05),
    (3.4, 0.42),
    (25.4, 0.42),
    (26.2, -0.08),
    (TAKE_END, -0.08),
    (RIGHT_FROM, 0.05),
    (32.5, 0.05),
    (34.3, 0.42),
    (37.4, 0.42),
    (38.2, 0.1),
    (39.2, 0.1),
    (40.0, 0.42),
    (41.0, 0.42),
    (41.8, 0.1),
    (43.0, 0.1),
    (43.8, 0.42),
    (47.4, 0.42),
    (49.2, 0.05),
    (52.2, 0.05),
    (53.0, 0.38),
    (55.0, 0.38),
    (55.8, 0.05),
    (64.5, 0.0),
    (66.0, -0.12),
    (71.0, -0.12),
    (72.5, 0.0),
    (118.0, 0.0),
    (120.0, 0.05),
    (CHECK_LOOP, 0.05),
];
/// Red for him as he nears the side street, in both takes, and in the
/// right one until he walks on.
const CHECK_RED: [(f32, f32); 2] = [(17.0, 30.0), (47.9, 83.0)];
const CHECK_PRINTS: [(f32, f32); 10] = [
    (0.0, 0.35),
    (8.0, 0.35),
    (11.0, 0.0),
    (TAKE_END, 0.0),
    (RIGHT_FROM, 0.35),
    (83.7, 0.35),
    (85.7, 1.0),
    (108.0, 1.0),
    (116.0, 0.35),
    (CHECK_LOOP, 0.35),
];
const CHECK_RIM: [(f32, f32); 10] = [
    (0.0, 1.0),
    (10.0, 1.0),
    (15.0, 0.4),
    (TAKE_END, 0.4),
    (RIGHT_FROM, 1.0),
    (64.5, 1.0),
    (70.0, 1.6),
    (84.0, 1.6),
    (92.0, 1.0),
    (CHECK_LOOP, 1.0),
];
/// His phone: out of the pocket, 0 … 1 in his hand before him; in the
/// right take back in the pocket before the kerb.
const CHECK_PHONE: [(f32, f32); 9] = [
    (1.5, 0.0),
    (3.5, 1.0),
    (TAKE_END, 1.0),
    (RIGHT_FROM, 0.0),
    (32.4, 0.0),
    (34.4, 1.0),
    (47.5, 1.0),
    (49.5, 0.0),
    (CHECK_LOOP, 0.0),
];
/// How thick his breath clouds are: thin while he is lost, one long
/// breath at «дыхание».
const CHECK_BREATH: [(f32, f32); 10] = [
    (0.0, 0.35),
    (5.5, 0.35),
    (12.0, 0.12),
    (TAKE_END, 0.12),
    (RIGHT_FROM, 0.35),
    (59.6, 0.35),
    (60.6, 1.8),
    (64.4, 1.8),
    (66.5, 0.35),
    (CHECK_LOOP, 0.35),
];
/// The sphere's radius: wide open at «расхлопнутость».
const CHECK_SPHERE: [(f32, f32); 6] = [
    (0.0, SPHERE_R),
    (64.8, SPHERE_R),
    (71.0, 8.0),
    (92.0, 8.0),
    (104.0, SPHERE_R),
    (CHECK_LOOP, SPHERE_R),
];
/// «Опора»: its rings spread from his feet (0 … 1), then fade (1 … 2).
const SUPPORT: [(f32, f32); 6] = [
    (0.0, 0.0),
    (55.4, 0.0),
    (59.4, 1.0),
    (66.0, 1.0),
    (72.0, 2.0),
    (CHECK_LOOP, 2.0),
];

/// The side street's car runs up its near lane (z = `CAR_SIDE_Z`) toward
/// the main street at `CAR_RUSH` m/s. In the wrong take its driver sees
/// him at `CAR_SEES` and brakes at `CAR_BRAKES` m/s², too late: the tape
/// stops with its middle at x = `CAR_FROZEN`, its nose a hand from him.
/// `CAR_SEEN`: its lights come out of the dark.
pub const CAR_SIDE_Z: f32 = 7.25 * CELL;
const CAR_RUSH: f32 = 12.0;
const CAR_SEES: f32 = 25.7;
const CAR_BRAKES: f32 = 8.0;
const CAR_FROZEN: f32 = -7.4;
const CAR_SEES_X: f32 = {
    let u = TAKE_END - CAR_SEES;
    CAR_FROZEN - CAR_RUSH * u + 0.5 * CAR_BRAKES * u * u
};
const CAR_SEEN: [f32; 2] = [21.0, 22.2];
/// In the right take it is the same car and he is not on the road: it
/// slows at `CAR_SLOWS` m/s² to `CAR_CRAWL` for the turn into lane 0 (a
/// `CAR_TURN` m arc from x = `CAR_TURN_X`), which it reaches at the
/// moment in `CAR_TURNS` that keeps it clear of the traffic (58.0 is the
/// wrong take's car to the moment), and from the middle of the turn
/// takes `CAR_PULL` s to reach the traffic's pace.
const CAR_SLOWS: f32 = 4.0;
const CAR_CRAWL: f32 = 4.5;
const CAR_TURN: f32 = 3.5;
const CAR_TURN_X: f32 = -CAR_LANE - CAR_TURN;
const CAR_PULL: f32 = 2.2;
const CAR_TURNS: [f32; 2] = [57.0, 59.0];
/// A car's half length and half width (the shaders draw it so).
pub const CAR_HALF: [f32; 2] = [2.45, 0.92];

/// One page's loop: its camera and the curves its walker and street
/// follow, on the script's time.
#[derive(Clone, Copy)]
struct Script {
    shots: &'static [Key],
    turn: &'static [(f32, f32)],
    nod: &'static [(f32, f32)],
    agitation: &'static [(f32, f32)],
    stop: &'static [(f32, f32)],
    prints: &'static [(f32, f32)],
    rim: &'static [(f32, f32)],
    reach: &'static [(f32, f32)],
    phone: &'static [(f32, f32)],
}

const FACT: Script = Script {
    shots: &SHOTS,
    turn: &TURN,
    nod: &NOD,
    agitation: &AGITATION,
    stop: &STOP,
    prints: &PRINTS,
    rim: &RIM,
    reach: &REACH,
    phone: &NONE,
};

const CHECK: Script = Script {
    shots: &CHECK_SHOTS,
    turn: &CHECK_TURN,
    nod: &CHECK_NOD,
    agitation: &NONE,
    stop: &CHECK_RED,
    prints: &CHECK_PRINTS,
    rim: &CHECK_RIM,
    reach: &NONE,
    phone: &CHECK_PHONE,
};

/// Page 07's two walks (see `CHECK_FROM`): the wrong take's, the right's.
fn check_walks() -> [Walk; 2] {
    let period = LOOP / STEPS as f32;
    let step = |k: i32, land: f32, z: f32| {
        let side = k.rem_euclid(2) as usize;
        Step {
            side,
            lift: land - SWING_SHARE * period,
            land,
            x: if side == 0 { STEP_WIDTH } else { -STEP_WIDTH },
            z,
        }
    };
    let along = |k: i32| CHECK_FROM + k as f32 * STRIDE;
    // A take's steps up to `last`, `shift` on along the tape, then the
    // feet together.
    let take = |last: i32, shift: f32| -> Vec<Step> {
        let mut steps: Vec<Step> = (-8..=last)
            .map(|k| step(k, k as f32 * period + shift, along(k)))
            .collect();
        steps.push(step(
            last + 1,
            (last + 1) as f32 * period + shift,
            along(last),
        ));
        steps
    };
    let mut right = take(RIGHT_LAST, RIGHT_SHIFT);
    right.extend(
        (RIGHT_LAST + 1 - STEPS..=8)
            .map(|k| step(k, k as f32 * period + CHECK_LOOP, along(k) + REPEAT)),
    );
    let start = [[STEP_WIDTH, along(-10)], [-STEP_WIDTH, along(-9)]];
    [
        Walk::new(start, take(WRONG_LAST, 0.0), 7.0),
        Walk::new(start, right, 7.0),
    ]
}

/// Page 08: when each phrase leaves his mouth (see the top of the file),
/// when each one's echo starts back onto his head, from how far.
const VOICE_PHRASES: [f32; 7] = [15.5, 22.0, 29.0, 36.0, 49.6, 59.4, 67.0];
const VOICE_ECHOES: [f32; 5] = [17.5, 24.0, 31.0, 38.0, 51.6];
const VOICE_ECHO_FROM: f32 = 9.0;
/// «Я Осознаю три кольца»: three echoes start back at once from these
/// radii and meet at him together `CHORD_LIFE` later.
const CHORD_AT: f32 = 60.6;
const CHORD_FROM: [f32; 3] = [9.0, 7.6, 6.2];
const CHORD_LIFE: f32 = 2.0;
/// When each ring lights, and when all three dim again for the next lap.
const VOICE_RINGS: [[f32; 2]; 3] = [[25.0, 27.0], [32.0, 34.0], [37.0, 40.0]];
const VOICE_DIM: [f32; 2] = [96.0, 102.0];
/// How faint the rings are before their phrase.
const RING_DARK: f32 = 0.12;
/// The third ring turns this many times over a lap's `REPEAT`: with his
/// pace, standing still when he stands.
const VOICE_TURNS: f32 = 30.0;
/// The underpass's rails: one along each wall of each flight, `RAIL_IN`
/// off the wall, `RAIL_H` over the treads' line.
pub const RAIL_IN: f32 = 0.1;
pub const RAIL_H: f32 = 0.92;
/// How far toward the right wall (−x) he walks along the floor, so the
/// right hand finds the rail on the climb.
const VOICE_DRIFT: f32 = -0.6;
const VOICE_UMBRELLA_MEETS: f32 = 84.0;
const VOICE_PHONE_MEETS: f32 = 95.0;
/// When each word of each phrase leaves his mouth, s after the phrase,
/// and how long a word sounds.
const VOICE_WORDS: [&[f32]; 7] = [
    &[0.0, 0.3],
    &[0.0, 0.3, 0.8],
    &[0.0, 0.3, 0.95],
    &[0.0, 0.3],
    &[0.0, 0.3],
    &[0.0, 0.3, 0.95, 1.25],
    &[0.0, 0.3],
];
const WORD_LONG: f32 = 0.55;
/// His phone on page 08: how far the left hand reaches (for the pocket,
/// then holding the phone), the phone out of the pocket, brought up.
const PHONE_REACH: [(f32, f32); 4] = [(0.3, 0.0), (1.0, 1.0), (71.4, 1.0), (72.4, 0.0)];
const PHONE_OUT: [(f32, f32); 4] = [(1.3, 0.0), (1.9, 1.0), (70.4, 1.0), (71.0, 0.0)];
const PHONE_RAISE: [(f32, f32); 4] = [(1.1, 0.0), (2.4, 1.0), (70.0, 1.0), (71.2, 0.0)];
/// Before his eyes until he leaves them, then at the chest.
const PHONE_READ: [f32; 2] = [10.6, 12.4];
/// His eyes look this far above the phone's middle (up its length).
const PHONE_LOOK_ABOVE: f32 = 0.01;
/// The screen wakes, and goes dark as the phone goes away.
const PHONE_LIGHT: [f32; 4] = [1.9, 2.3, 70.5, 70.9];
/// Its screens, the atlas's cells (0 the phone's own home screen with our
/// icon, 1 the app's home, 2 the Diary, 3 recording): each change runs
/// from to.
const PHONE_SCREENS: [[f32; 2]; 3] = [[4.2, 4.8], [6.5, 7.05], [9.25, 9.6]];
/// The recording's clock starts.
const PHONE_RECORDS: f32 = 9.4;
/// His thumb over the screen: across, down, pressed. It taps our icon,
/// the Diary's card and the record button.
const THUMB_REST: [f32; 3] = [0.08, 0.62, 0.0];
const THUMB: [(f32, [f32; 3]); 16] = [
    (3.3, THUMB_REST),
    (3.85, [0.374, 0.581, 0.0]),
    (3.95, [0.374, 0.581, 1.0]),
    (4.1, [0.374, 0.581, 1.0]),
    (4.25, [0.374, 0.581, 0.0]),
    (5.6, [0.42, 0.66, 0.0]),
    (6.15, [0.5, 0.725, 0.0]),
    (6.25, [0.5, 0.725, 1.0]),
    (6.4, [0.5, 0.725, 1.0]),
    (6.55, [0.5, 0.725, 0.0]),
    (8.4, [0.75, 0.86, 0.0]),
    (8.95, [0.887, 0.937, 0.0]),
    (9.05, [0.887, 0.937, 1.0]),
    (9.2, [0.887, 0.937, 1.0]),
    (9.35, [0.887, 0.937, 0.0]),
    (10.1, THUMB_REST),
];

/// How far a shell of the voice reaches before it fades.
pub const VOICE_REACH: f32 = 0.12 + VOICE_SPEED * VOICE_LIFE;

/// Page 08: where each phrase left his mouth. Each leaves a line of code in
/// the tiles as far as its shell reached.
pub fn voice_lines() -> [V3; 7] {
    let story = Story::new(Chapter::Voice);
    VOICE_PHRASES.map(|at| story.body(at).mouth)
}

/// How far toward the rail his walk has drifted at `t` of the lap.
fn voice_drift(t: f32) -> f32 {
    VOICE_DRIFT * (smooth(41.0, 48.0, t) - smooth(66.2, 70.0, t))
}

/// The rail's height over z: the line through the treads' middles raised
/// by `RAIL_H`, level beyond the flights' ends.
pub fn rail_height(z: f32) -> f32 {
    let u = under_along(z);
    let u = u.min(UNDER_LEN - u).clamp(0.0, FLIGHT);
    RAIL_H - RISE / TREAD * (u + 0.5 * TREAD)
}

/// Where the feet stand along z: the treads and the floor.
fn voice_floor(z: f32) -> f32 {
    crate::under_floor(WALK_X, z)
}

/// Page 08's walk: down the treads one at a time, two steps onto the floor,
/// feet together; standing through three phrases; along the floor drifting
/// toward the rail and up the far flight, feet together at the top;
/// standing, then out along the street to the next stairs, a lap on.
fn voice_walk() -> Walk {
    // (landing, z, the step's own period) for one lap.
    let mut lap: Vec<(f32, f32, f32)> = Vec::new();
    let flights = RISERS - 1;
    for k in 0..flights {
        lap.push((0.7 * (k + 1) as f32, UNDER_Z + TREAD * k as f32 + 0.09, 0.7));
    }
    lap.extend([(12.6, 7.75, 0.7), (13.3, 8.42, 0.7), (14.0, 8.42, 0.7)]);
    for i in 1..=25 {
        lap.push((36.5 + (i - 1) as f32 * 0.54, 8.42 + 0.666 * i as f32, 0.54));
    }
    let up = UNDER_Z + FLIGHT + FLAT;
    for j in 0..flights {
        lap.push((
            49.46 + 0.6 * (j + 1) as f32,
            up + TREAD * j as f32 + 0.09,
            0.6,
        ));
    }
    let top = 31.55;
    lap.extend([(60.26, 31.0, 0.6), (60.86, top, 0.6), (61.46, top, 0.6)]);
    // Out to where the next lap's first tread follows (its z 1.63 + REPEAT
    // at its time 0).
    let out = 79;
    let period = (VOICE_LOOP - 66.5) / (out - 1) as f32;
    let stride = (1.63 + REPEAT - top) / out as f32;
    for j in 1..=out {
        lap.push((
            66.5 + (j - 1) as f32 * period,
            top + stride * j as f32,
            period,
        ));
    }
    assert_eq!(lap.len() % 2, 0, "the same foot leads each lap");
    let n = lap.len() as i32;
    let steps: Vec<Step> = (-1..=1)
        .flat_map(|l: i32| {
            lap.iter().enumerate().map(move |(i, &(land, z, period))| {
                let side = i % 2;
                let width = if side == 0 { STEP_WIDTH } else { -STEP_WIDTH };
                let shift = l as f32;
                Step {
                    side,
                    lift: land - SWING_SHARE * period + shift * VOICE_LOOP,
                    land: land + shift * VOICE_LOOP,
                    x: width + voice_drift(land),
                    z: z + shift * REPEAT,
                }
            })
        })
        .collect();
    debug_assert_eq!(steps.len() as i32, 3 * n);
    // The feet stand where the lap before the first one left them.
    let before = 1.63 - REPEAT;
    let start = [[STEP_WIDTH, before - stride], [-STEP_WIDTH, before]];
    Walk::new(start, steps, 7.0).on_ground(voice_floor, under_ramp)
}

/// Page 08's camera, relative to his track point and to the underpass's
/// floor line under each point (see `compose`).
const VOICE_OPENING: Key = key(
    0.0,
    [0.0, 1.55, -2.4],
    [0.0, 0.9, 4.0],
    [0.0, 1.0, 0.1],
    1.6,
    0.006,
    0.0,
);
/// In his eyes on page 08: the lens that fills the view with his phone.
const PHONE_LENS: f32 = 3.4;
/// Where the phone is as he holds it up to his eyes.
const AT_PHONE: [f32; 3] = [0.02, 1.38, 0.37];
/// His eyes as he looks at the phone: where the ways into them and out
/// of them end.
const AT_EYES: [f32; 3] = [0.0, 1.65, 0.15];
const VOICE_SHOTS: [Key; 34] = [
    // Behind him and above, down the stairs into the tubes' light.
    VOICE_OPENING,
    // Up over his right shoulder as the phone comes out of the pocket.
    key(
        1.4,
        [-0.25, 2.05, -0.35],
        AT_PHONE,
        AT_PHONE,
        1.9,
        0.005,
        0.0,
    ),
    // High over his head, then on before it over the phone rising in his
    // hand as the screen wakes: his crown sinks out of the view below,
    // never before the lens, and his forearm stays short under the phone.
    key(1.8, [-0.05, 2.25, 0.1], AT_PHONE, AT_PHONE, 2.2, 0.003, 0.0),
    key(2.2, [0.0, 1.95, 0.3], AT_PHONE, AT_PHONE, 2.6, 0.004, 0.0),
    // In his eyes: the phone, our app, the Diary, the record button.
    key(3.0, AT_EYES, AT_PHONE, AT_PHONE, PHONE_LENS, 0.004, 1.0),
    key(10.6, AT_EYES, AT_PHONE, AT_PHONE, PHONE_LENS, 0.004, 1.0),
    // Out of his eyes sideways at their height, past his left cheek, then
    // round to his profile over the phone, and down as he reaches the
    // floor. Never over his head: under the underpass's lamps its crown
    // shines.
    key(11.4, [0.25, 1.66, 0.2], AT_PHONE, AT_PHONE, 2.7, 0.004, 0.0),
    key(
        12.2,
        [0.7, 1.6, 0.35],
        [0.0, 1.42, 0.25],
        [0.0, 1.42, 0.25],
        2.2,
        0.005,
        0.0,
    ),
    key(
        12.7,
        [1.0, 1.65, 0.65],
        [0.0, 1.25, 0.15],
        [0.0, 1.25, 0.15],
        2.0,
        0.005,
        0.0,
    ),
    // Beside him and below as he stops on the floor: up at the phone at
    // his chest and his face over it.
    key(
        13.5,
        [0.8, 0.7, 0.6],
        [0.0, 1.2, 0.0],
        [0.0, 1.3, 0.0],
        1.65,
        0.007,
        0.0,
    ),
    // «Я Здесь»: low before him, up at him; the sphere sharpens.
    key(
        15.0,
        [0.0, 0.35, 3.2],
        [0.0, 1.15, 0.0],
        [0.0, 1.2, 0.0],
        1.7,
        0.007,
        0.0,
    ),
    key(
        20.3,
        [0.0, 0.4, 2.6],
        [0.0, 1.15, 0.0],
        [0.0, 1.2, 0.0],
        1.7,
        0.007,
        0.0,
    ),
    // «Я Слышу внешнее»: round his left to behind him, down the tunnel to
    // its far exit, where the city's sound comes in.
    key(
        22.0,
        [0.9, 0.6, 0.3],
        [0.0, 1.1, 2.0],
        [0.0, 1.2, 0.0],
        1.65,
        0.007,
        0.0,
    ),
    key(
        23.8,
        [0.0, 0.45, -3.0],
        [0.0, 1.3, 8.0],
        [0.0, 1.2, 0.0],
        1.6,
        0.006,
        0.0,
    ),
    key(
        27.4,
        [0.05, 0.5, -2.9],
        [0.0, 1.3, 8.0],
        [0.0, 1.2, 0.0],
        1.6,
        0.006,
        0.0,
    ),
    // «Я Ощущаю внутреннее»: close at his chest, the echo goes into him.
    key(
        29.0,
        [0.95, 1.0, 0.0],
        [0.0, 1.3, 0.3],
        [0.0, 1.3, 0.0],
        1.9,
        0.008,
        0.0,
    ),
    key(
        30.2,
        [0.7, 1.35, 1.5],
        [-0.05, 1.35, 0.0],
        [0.0, 1.35, 0.0],
        2.2,
        0.009,
        0.0,
    ),
    key(
        34.5,
        [0.6, 1.4, 1.2],
        [-0.05, 1.35, 0.0],
        [0.0, 1.35, 0.0],
        2.2,
        0.009,
        0.0,
    ),
    // «Я Двигаюсь»: low before him as he walks; the third ring turns.
    key(
        36.4,
        [0.0, 0.5, 3.0],
        [-0.2, 1.0, 0.0],
        [-0.1, 1.0, 0.0],
        1.7,
        0.007,
        0.0,
    ),
    key(
        43.6,
        [0.0, 0.5, 3.0],
        [-0.2, 1.0, 0.0],
        [-0.3, 1.0, 0.0],
        1.7,
        0.007,
        0.0,
    ),
    // Beside his steps as he drifts to the rail's side.
    key(
        45.4,
        [0.9, 0.55, 0.3],
        [-0.4, 0.8, 0.4],
        [-0.5, 0.8, 0.0],
        1.8,
        0.007,
        0.0,
    ),
    key(
        48.4,
        [0.95, 0.9, 0.0],
        [-0.45, 0.9, 0.4],
        [-0.6, 0.9, 0.0],
        1.8,
        0.007,
        0.0,
    ),
    // «Я Действую»: behind him up the flight, his hand on the rail.
    key(
        50.6,
        [0.15, 1.0, -2.3],
        [-0.4, 1.8, 4.0],
        [-0.6, 1.2, 0.3],
        1.75,
        0.007,
        0.0,
    ),
    // Past him, then back down at him climbing.
    key(
        54.6,
        [0.5, 0.7, 2.2],
        [-0.6, 1.1, 0.0],
        [-0.6, 1.1, 0.0],
        1.9,
        0.008,
        0.0,
    ),
    key(
        58.4,
        [0.5, 0.75, 2.2],
        [-0.6, 1.1, 0.0],
        [-0.6, 1.1, 0.0],
        1.9,
        0.008,
        0.0,
    ),
    // «Я Осознаю три кольца»: before him at the top; the echoes meet.
    key(
        61.0,
        [0.3, 0.9, 2.6],
        [-0.5, 1.25, 0.0],
        [-0.5, 1.2, 0.0],
        1.9,
        0.008,
        0.0,
    ),
    key(
        65.5,
        [0.3, 0.95, 2.5],
        [-0.5, 1.25, 0.0],
        [-0.5, 1.2, 0.0],
        1.9,
        0.008,
        0.0,
    ),
    // «Я Есть»: up behind him into the open street and the rain.
    key(
        68.4,
        [1.2, 2.2, -2.5],
        [-0.3, 1.3, 3.0],
        [0.0, 1.1, 0.0],
        1.7,
        0.006,
        0.0,
    ),
    // The crane: the wide city.
    key(
        74.0,
        [2.5, 5.0, -6.0],
        [-0.5, 1.0, 6.0],
        [0.0, 1.0, 0.0],
        1.7,
        0.005,
        0.0,
    ),
    key(
        82.0,
        [4.0, 11.0, -9.0],
        [-0.5, 0.0, 10.0],
        [0.0, 0.9, 0.0],
        1.65,
        0.004,
        0.0,
    ),
    key(
        90.0,
        [3.0, 12.0, -4.0],
        [-0.5, 0.0, 14.0],
        [0.0, 0.9, 0.0],
        1.65,
        0.004,
        0.0,
    ),
    // Down behind him to the next stairs.
    key(
        100.6,
        [0.4, 2.2, -3.2],
        [0.0, 1.2, 4.0],
        [0.0, 1.0, 0.0],
        1.6,
        0.005,
        0.0,
    ),
    at(103.0, VOICE_OPENING),
    at(VOICE_LOOP, VOICE_OPENING),
];

const VOICE_TURN: [(f32, f32); 16] = [
    (0.0, 0.0),
    (23.5, 0.0),
    (24.3, 0.25),
    (25.3, -0.25),
    (26.2, 0.0),
    (49.2, 0.0),
    (50.2, -0.15),
    (60.0, -0.15),
    (61.0, 0.0),
    (70.5, 0.0),
    (72.0, 0.35),
    (80.0, -0.3),
    (88.0, 0.2),
    (94.0, 0.0),
    (100.0, 0.0),
    (VOICE_LOOP, 0.0),
];
const VOICE_NOD: [(f32, f32); 15] = [
    (0.0, 0.25),
    (12.0, 0.25),
    (13.6, -0.05),
    (28.6, -0.05),
    (29.6, 0.15),
    (34.6, 0.15),
    (35.6, 0.05),
    (49.0, 0.05),
    (50.0, -0.12),
    (60.0, -0.12),
    (61.0, -0.05),
    (100.5, -0.05),
    (102.0, 0.25),
    (103.0, 0.25),
    (VOICE_LOOP, 0.25),
];
/// Stop underground; green by the time he reaches the next cross street.
const VOICE_RED: [(f32, f32); 1] = [(24.0, 70.0)];
const VOICE_PRINTS: [(f32, f32); 7] = [
    (0.0, 0.8),
    (14.0, 0.8),
    (36.0, 1.0),
    (66.0, 1.0),
    (70.0, 0.5),
    (100.0, 0.5),
    (VOICE_LOOP, 0.8),
];
const VOICE_RIM: [(f32, f32); 1] = [(0.0, 1.2)];

const VOICE: Script = Script {
    shots: &VOICE_SHOTS,
    turn: &VOICE_TURN,
    nod: &VOICE_NOD,
    agitation: &NONE,
    stop: &VOICE_RED,
    prints: &VOICE_PRINTS,
    rim: &VOICE_RIM,
    reach: &NONE,
    phone: &NONE,
};

/// How far under the street the camera follows him at the script's `at`:
/// 1 while he is below, 0 out in the street.
fn voice_sink(at: f32) -> f32 {
    1.0 - smooth(60.0, 64.0, at) + smooth(96.0, 102.0, at)
}

/// The shell of the newest phrase alive at `at` (when it left, its age).
fn voice_phrase(at: f32) -> Option<(f32, f32)> {
    VOICE_PHRASES
        .iter()
        .rev()
        .map(|&from| (from, at - from))
        .find(|&(_, age)| (0.0..VOICE_LIFE).contains(&age))
}

/// The echo coming back onto him at `at`: its radius, how bright.
fn voice_echo(at: f32) -> Option<(f32, f32)> {
    let life = VOICE_ECHO_FROM / VOICE_SPEED;
    VOICE_ECHOES
        .iter()
        .rev()
        .map(|&from| at - from)
        .find(|age| (0.0..life).contains(age))
        .map(|age| {
            (
                VOICE_ECHO_FROM - VOICE_SPEED * age,
                smooth(0.0, 0.4, age) * (0.4 + 0.6 * age / life),
            )
        })
}

/// The chord at `at`: the three echoes' radii and how bright they are.
fn voice_chord(at: f32) -> Option<([f32; 3], f32)> {
    let age = at - CHORD_AT;
    (0.0..CHORD_LIFE).contains(&age).then(|| {
        let k = age / CHORD_LIFE;
        (
            CHORD_FROM.map(|r| r * (1.0 - k)),
            smooth(0.0, 0.4, age) * (0.4 + 0.6 * k),
        )
    })
}

/// How much each ring is lit at `at`: faint before its phrase.
fn voice_rings(at: f32) -> [f32; 4] {
    let dim = smooth(VOICE_DIM[0], VOICE_DIM[1], at);
    let lit = |[a, b]: [f32; 2]| RING_DARK + (1.0 - RING_DARK) * (smooth(a, b, at) - dim).max(0.0);
    [
        lit(VOICE_RINGS[0]),
        lit(VOICE_RINGS[1]),
        lit(VOICE_RINGS[2]),
        0.0,
    ]
}

/// Each phrase's start and the end of its last word.
fn voice_spoken() -> impl Iterator<Item = (f32, f32)> {
    VOICE_PHRASES
        .iter()
        .zip(VOICE_WORDS)
        .map(|(&from, words)| (from, from + words[words.len() - 1] + WORD_LONG))
}

/// Every word's start through the lap.
fn voice_word_starts() -> impl Iterator<Item = f32> {
    VOICE_PHRASES
        .iter()
        .zip(VOICE_WORDS)
        .flat_map(|(&from, words)| words.iter().map(move |w| from + w))
}

/// How loud his voice is at `at`: each word's swell.
fn voice_level(at: f32) -> f32 {
    voice_word_starts()
        .map(|w| window(at, w, w + 0.06, w + 0.18, w + WORD_LONG))
        .fold(0.0, f32::max)
}

/// The thumb at `at`: eased from key to key.
fn voice_thumb(at: f32) -> [f32; 3] {
    let n = THUMB.len();
    if at <= THUMB[0].0 || at >= THUMB[n - 1].0 {
        return THUMB_REST;
    }
    let i = THUMB.partition_point(|k| k.0 <= at) - 1;
    let ((a, from), (b, to)) = (THUMB[i], THUMB[i + 1]);
    let k = smooth(a, b, at);
    [0, 1, 2].map(|j| mix(from[j], to[j], k))
}

/// His phone in the left hand at `at` of page 08: out before his eyes,
/// then at his chest, up under the mouth for each phrase.
fn voice_held(at: f32) -> Held {
    let mut hold = 1.0 - smooth(PHONE_READ[0], PHONE_READ[1], at);
    for (from, end) in voice_spoken() {
        hold = hold.max(2.0 * window(at, from - 0.8, from - 0.1, end + 0.3, end + 1.1));
    }
    Held {
        reach: monotone(&PHONE_REACH, at),
        out: monotone(&PHONE_OUT, at),
        raise: monotone(&PHONE_RAISE, at),
        hold,
        thumb: voice_thumb(at),
    }
}

/// His phone for the shaders (lib.rs `SLOT_PHONE`): its centre and size,
/// its right and half width, its up and half length; the screens it goes
/// between, how far, its light; the thumb (across, down, pressed) and how
/// much the finish redraws the screen sharp; the recording's clock and
/// the voice's level.
fn voice_phone(body: &Body, at: f32, crisp: f32) -> [[f32; 4]; 6] {
    if body.phone_size <= 0.0 {
        return [[0.0; 4]; 6];
    }
    let [c, x, up] = body.phone;
    let k = body.phone_size;
    let [l0, l1, l2, l3] = PHONE_LIGHT;
    let light = window(at, l0, l1, l2, l3);
    let mut screens = [0.0, 0.0, 0.0];
    for (i, &[a, b]) in PHONE_SCREENS.iter().enumerate() {
        let (from, to) = (i as f32, (i + 1) as f32);
        if at >= b {
            screens = [to, to, 0.0];
        } else if at > a {
            screens = [from, to, smooth(a, b, at)];
        }
    }
    let [u, v, press] = voice_thumb(at);
    let clock = if at >= PHONE_RECORDS {
        at - PHONE_RECORDS
    } else {
        -1.0
    };
    [
        [c.x, c.y, c.z, k],
        [x.x, x.y, x.z, PHONE_SIZE[0] * k],
        [up.x, up.y, up.z, PHONE_SIZE[1] * k],
        [screens[0], screens[1], screens[2], light],
        [u, v, press, crisp],
        [clock, voice_level(at), 0.0, 0.0],
    ]
}

/// A rectangle on the street: its middle (x, z), its heading (radians
/// from +z toward +x), its half length along the heading and half width.
#[derive(Clone, Copy, Debug)]
pub struct Rect {
    pub c: [f32; 2],
    pub yaw: f32,
    pub half: [f32; 2],
}

impl Rect {
    /// The ground plan of a body's box.
    pub fn of(b: &Body) -> Rect {
        Rect {
            c: [0.5 * (b.low.x + b.high.x), 0.5 * (b.low.z + b.high.z)],
            yaw: 0.0,
            half: [0.5 * (b.high.z - b.low.z), 0.5 * (b.high.x - b.low.x)],
        }
    }

    fn axes(self) -> [[f32; 2]; 2] {
        let (s, c) = self.yaw.sin_cos();
        [[s, c], [c, -s]]
    }

    /// How far it reaches along the unit direction `n` from its middle.
    fn reach(self, n: [f32; 2]) -> f32 {
        let [h, w] = self.axes();
        self.half[0] * (h[0] * n[0] + h[1] * n[1]).abs()
            + self.half[1] * (w[0] * n[0] + w[1] * n[1]).abs()
    }
}

/// How far apart two rectangles stand along the axis that parts them
/// best; below zero they overlap.
pub fn apart(a: Rect, b: Rect) -> f32 {
    let d = [b.c[0] - a.c[0], b.c[1] - a.c[1]];
    a.axes()
        .into_iter()
        .chain(b.axes())
        .map(|n| (d[0] * n[0] + d[1] * n[1]).abs() - a.reach(n) - b.reach(n))
        .fold(f32::MIN, f32::max)
}

/// The wrong take's car: its middle's x at `s`.
fn car_rushes(s: f32) -> f32 {
    let u = (s - CAR_SEES).min(CAR_RUSH / CAR_BRAKES);
    if u < 0.0 {
        CAR_SEES_X + CAR_RUSH * u
    } else {
        CAR_SEES_X + CAR_RUSH * u - 0.5 * CAR_BRAKES * u * u
    }
}

/// How far the right take's car has come past the start of its turn at
/// `s` (below zero, short of it), if it reaches the turn at `turn` and
/// joins the traffic at `fast` m/s.
fn car_run(s: f32, turn: f32, fast: f32) -> f32 {
    let slow = (CAR_RUSH - CAR_CRAWL) / CAR_SLOWS;
    let left = turn - s;
    if left > slow {
        -(0.5 * (CAR_RUSH + CAR_CRAWL) * slow + CAR_RUSH * (left - slow))
    } else if left > 0.0 {
        -(CAR_CRAWL * left + 0.5 * CAR_SLOWS * left * left)
    } else {
        // Up to speed from the middle of the turn.
        let pull = turn + 0.25 * PI * CAR_TURN / CAR_CRAWL;
        CAR_CRAWL * (s - turn) + (fast - CAR_CRAWL) * smooth_integral(pull, pull + CAR_PULL, s)
    }
}

/// The right take's car `d` past the start of its turn: its middle x, z
/// and heading.
fn car_path(d: f32) -> [f32; 3] {
    let arc = 0.5 * PI * CAR_TURN;
    if d < 0.0 {
        [CAR_TURN_X + d, CAR_SIDE_Z, 0.5 * PI]
    } else if d < arc {
        let a = d / CAR_TURN;
        [
            CAR_TURN_X + CAR_TURN * a.sin(),
            CAR_SIDE_Z + CAR_TURN * (1.0 - a.cos()),
            0.5 * PI - a,
        ]
    } else {
        [-CAR_LANE, CAR_SIDE_Z + CAR_TURN + d - arc, 0.0]
    }
}

/// The car's ground plan.
fn car_rect([x, z, yaw]: [f32; 3]) -> Rect {
    Rect {
        c: [x, z],
        yaw,
        half: CAR_HALF,
    }
}

/// Lane 0's car nearest `z` at the city's time `world`, as the shaders
/// place them.
fn lane_car(world: f32, z: f32) -> Rect {
    let gap = REPEAT / CARS[0][0];
    let base = CARS[0][1] * REPEAT / LOOP * world;
    let id = ((z - base) / gap).round();
    Rect {
        c: [-CAR_LANE, base + gap * id],
        yaw: 0.0,
        half: CAR_HALF,
    }
}

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
    /// Page 07's beats: how far the view has narrowed to a tunnel at his
    /// face, how quiet the outer world is, the light at his soles, and the
    /// support's rings from his feet (0 … 1 spreading, 1 … 2 fading).
    pub check: [f32; 4],
    /// The side street's car: its middle x, z, heading (radians from +z
    /// toward +x) and how much it is there.
    pub cross_car: [f32; 4],
    /// How much each ring shows (the third above 1 spins hard), and how
    /// brightly his own phone lights his face.
    pub ring_light: [f32; 4],
    /// Page 07's tape: the loop's clock, how much the picture is a tape's
    /// (0.35 standing, 1 rewinding), and the flash as it stops.
    pub tape: [f32; 3],
    /// Page 08: his own phone and its screen (`voice_phone`).
    pub phone: [[f32; 4]; 6],
}

pub struct Story {
    pub chapter: Chapter,
    pub loop_seconds: f32,
    script: Script,
    /// His walk in the wrong take (page 06's only one) and in the right.
    walks: [Walk; 2],
    puddle: [f32; 3],
    umbrella: Walk,
    /// Where the umbrella's line of copies starts along the street.
    umbrella_from: f32,
    phone: Walk,
    phone_at: V3,
    /// When (the city's time) the one with the phone looks up at him.
    phone_meets: f32,
    /// Page 07's right take: when the side street's car reaches its turn,
    /// and how fast it then joins the traffic.
    car_turn: f32,
    car_fast: f32,
    /// Which pavement the passers keep to: 1 his, −1 the far one (page
    /// 08, where he comes up out of the underpass onto his own).
    side: f32,
}

/// The step that lands in the puddle, «Шаг происходит».
pub const PUDDLE_STEP: f32 = 43.4;

impl Story {
    pub fn new(chapter: Chapter) -> Story {
        let period = LOOP / STEPS as f32;
        let steady = Walk::steady(period, STRIDE, STEP_WIDTH, -8, STEPS + 8, 7.0);
        // The puddle lies where page 06's step lands; page 07's walk goes
        // through it too.
        let splash = steady
            .landings(PUDDLE_STEP)
            .next()
            .copied()
            .expect("the walk has begun by then");
        let (script, walks, umbrella_meets, phone_meets) = match chapter {
            Chapter::Fact => (FACT, [steady.clone(), steady], UMBRELLA_MEETS, PHONE_MEETS),
            Chapter::Check => (
                CHECK,
                check_walks(),
                CHECK_UMBRELLA_MEETS,
                CHECK_PHONE_MEETS,
            ),
            Chapter::Voice => {
                let walk = voice_walk();
                (
                    VOICE,
                    [walk.clone(), walk],
                    VOICE_UMBRELLA_MEETS,
                    VOICE_PHONE_MEETS,
                )
            }
        };
        let track = |t: f32| {
            let r = reel(chapter, t);
            walks[usize::from(r.right)].track(r.at)
        };
        let period = LOOP / UMBRELLA_STEPS as f32;
        let stride = REPEAT / UMBRELLA_STEPS as f32 / UMBRELLA_SCALE;
        // The street's clock runs two loops in page 08's lap.
        let laps = if chapter == Chapter::Voice { 2 } else { 1 };
        let umbrella = Walk::steady(period, stride, 0.075, -8, laps * UMBRELLA_STEPS + 8, 6.0);
        let side = if chapter == Chapter::Voice { -1.0 } else { 1.0 };
        let umbrella_from = track(umbrella_meets)
            + UMBRELLA_SCALE * umbrella.track(world_time(chapter, umbrella_meets));
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
        let phone_at = v3(side * PHONE_X, 0.0, track(phone_meets) + 0.15);
        let mut story = Story {
            chapter,
            loop_seconds: chapter.loop_seconds(),
            script,
            walks,
            puddle: [splash.x + WALK_X, splash.z + 0.1, 0.62],
            umbrella,
            umbrella_from,
            phone,
            phone_at,
            phone_meets: world_time(chapter, phone_meets),
            car_turn: 0.0,
            car_fast: CARS[0][1] * REPEAT / LOOP * CITY_RATE,
            side,
        };
        if chapter == Chapter::Check {
            story.car_turn = story.find_turn();
        }
        story
    }

    /// When the right take's car reaches its turn: the moment in
    /// `CAR_TURNS` that keeps it widest of him, the passers and lane 0's
    /// cars.
    fn find_turn(&self) -> f32 {
        let dt = 0.1;
        let [from, to] = CAR_TURNS;
        let (before, after) = (2.5, 12.0);
        let samples = ((to - from + before + after) / dt) as usize;
        // Who else is on the street at each moment, whenever the car comes.
        let others: Vec<(f32, f32, Vec<Rect>)> = (0..=samples)
            .map(|i| {
                let t = from - before + i as f32 * dt;
                let world = world_time(self.chapter, t);
                let mut near = vec![Rect::of(&self.body(t))];
                near.extend(self.passers(world).iter().map(Rect::of));
                (t, world, near)
            })
            .collect();
        let mut best = (f32::MIN, from);
        let mut turn = from;
        while turn <= to + 1e-4 {
            let mut worst = f32::MAX;
            for (t, world, near) in others
                .iter()
                .filter(|(t, _, _)| *t >= turn - before && *t <= turn + after)
            {
                let car = car_rect(car_path(car_run(*t, turn, self.car_fast)));
                let lane = lane_car(*world, car.c[1]);
                for r in near.iter().chain(std::iter::once(&lane)) {
                    worst = worst.min(apart(car, *r));
                }
            }
            if worst > best.0 {
                best = (worst, turn);
            }
            turn += 0.05;
        }
        best.1
    }

    /// The side street's car at `t` of the loop (page 07; nowhere on page
    /// 06): its middle x, z, heading and how much it is there.
    pub fn cross_car(&self, t: f32) -> [f32; 4] {
        match self.chapter {
            Chapter::Fact => return [0.0; 4],
            // Page 08 has no such car; the slot says how many lines of
            // code the phrases have left in the tiles and how bright they
            // are, and −1 marks the page.
            Chapter::Voice => {
                let at = t.rem_euclid(self.loop_seconds);
                let lines = VOICE_PHRASES.iter().filter(|&&p| p <= at).count();
                return [lines as f32, 1.0 - smooth(92.0, 100.0, at), 0.0, -1.0];
            }
            Chapter::Check => {}
        }
        let r = reel(self.chapter, t);
        let s = r.at;
        if r.right {
            let turn = self.car_turn;
            let [x, z, yaw] = car_path(car_run(s, turn, self.car_fast));
            [
                x,
                z,
                yaw,
                window(s, turn - 7.0, turn - 5.8, turn + 9.0, turn + 12.0),
            ]
        } else {
            let [a, b] = CAR_SEEN;
            [car_rushes(s), CAR_SIDE_Z, 0.5 * PI, smooth(a, b, s)]
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
            .turned(PI, v3(self.side * UMBRELLA_X, 0.0, z))
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
        let up = monotone(&PHONE_UP, t - self.phone_meets);
        pose.nod = mix(0.42, 0.06, up);
        pose.turn = 0.6 * monotone(&PHONE_FOLLOW, t - self.phone_meets);
        let probe = build(&pose);
        let c = probe.chest_axes;
        let hold = probe.chest + c.forward * 0.3 - c.left * 0.05 + Y * mix(0.16, 0.08, up);
        pose.hands[1] = [hold.x, hold.y, hold.z, 1.0];
        pose.wrists[1] = -0.15;
        build(&pose).turned(PI - self.side * PHONE_TURN, self.phone_at)
    }

    pub fn passers(&self, t: f32) -> [Body; PASSERS] {
        let mut all = [self.umbrella(t), self.phone(t)];
        all.swap(0, UMBRELLA);
        all
    }

    /// His walk (page 07: the wrong take's).
    pub fn walk(&self) -> &Walk {
        &self.walks[0]
    }

    fn walk_of(&self, r: Reel) -> &Walk {
        &self.walks[usize::from(r.right)]
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

    /// How thick his breath clouds are at the script's `at`.
    fn breath_depth(&self, at: f32) -> f32 {
        match self.chapter {
            Chapter::Fact => 0.35 + 0.65 * window(at, 23.6, 24.8, 28.8, 29.8),
            Chapter::Check => monotone(&CHECK_BREATH, at),
            // Thicker as he speaks.
            Chapter::Voice => {
                0.3 + 0.5
                    * voice_spoken()
                        .map(|(from, end)| window(at, from - 0.1, from + 0.1, end, end + 1.5))
                        .fold(0.0, f32::max)
            }
        }
    }

    /// The figure at `t` of the loop, standing on the pavement.
    pub fn body(&self, t: f32) -> Body {
        self.figure(reel(self.chapter, t))
    }

    /// The figure at the tape's `r`.
    fn figure(&self, r: Reel) -> Body {
        let s = &self.script;
        let at = r.at;
        let mut pose = self.walk_of(r).pose(at, Self::breath(r.own()));
        pose.turn = monotone(s.turn, at);
        pose.nod = monotone(s.nod, at);
        let reach = monotone(s.reach, at);
        if reach > 0.0 {
            // Palm up in front of the chest, a little to the right.
            let probe = build(&pose);
            let c = probe.chest_axes;
            let target = probe.chest + c.forward * 0.42 - c.left * 0.12 + Y * 0.1;
            pose.hands[1] = [target.x, target.y, target.z, reach];
            pose.wrists[1] = -0.25 * reach;
        }
        let out = monotone(s.phone, at);
        if out > 0.0 {
            // The phone before the chest, the face bowed over it.
            pose.carry = Carry::Screen(out);
            let probe = build(&pose);
            let c = probe.chest_axes;
            let hold = probe.chest + c.forward * 0.3 - c.left * 0.05 + Y * 0.16;
            pose.hands[1] = [hold.x, hold.y, hold.z, out];
            pose.wrists[1] = -0.15 * out;
        }
        if self.chapter == Chapter::Check {
            // His umbrella at last, in the left hand, the fist before the
            // chest and a little to the left.
            pose.umbrella = true;
            let probe = build(&pose);
            let c = probe.chest_axes;
            let hold = probe.chest + c.forward * 0.26 + c.left * 0.14 - Y * 0.08;
            pose.hands[0] = [hold.x, hold.y, hold.z, 1.0];
        }
        if self.chapter == Chapter::Voice {
            pose.phone = Some(voice_held(at));
            // «Я Действую»: up the far flight, the right hand on the rail
            // a little ahead of the chest.
            let grip = window(at, 49.6, 50.4, 60.0, 60.8);
            if grip > 0.0 {
                let probe = build(&pose);
                let z = probe.chest.z + 0.18;
                let x = crate::UNDER_X[0] + RAIL_IN - WALK_X;
                pose.hands[1] = [x, rail_height(z) + 0.035, z, grip];
                pose.wrists[1] = 0.2 * grip;
            }
        }
        build(&pose).moved(|_| v3(WALK_X, 0.0, 0.0))
    }

    pub fn compose(&self, t: f32) -> Frame {
        let t = t.rem_euclid(self.loop_seconds);
        let check = self.chapter == Chapter::Check;
        let script = self.script;
        let r = reel(self.chapter, t);
        let (at, own) = (r.at, r.own());
        let time = world_time(self.chapter, t);
        let body = self.figure(r);
        let passers = self.passers(time);
        let walk = self.walk_of(r);
        let track = walk.track(at);
        let base = v3(WALK_X, 0.0, track);
        let curve = |pick: fn(&Key) -> f32| -> f32 {
            let keys: Vec<(f32, f32)> = script.shots.iter().map(|k| (k.at, pick(k))).collect();
            monotone(&keys, at)
        };
        // Page 08: under the street the keys ride the underpass's floor
        // line under each point.
        let voice_page = self.chapter == Chapter::Voice;
        let sink = if voice_page { voice_sink(at) } else { 0.0 };
        let keyed = |pick: [fn(&Key) -> f32; 3]| {
            let p = base + v3(curve(pick[0]), curve(pick[1]), curve(pick[2]));
            if voice_page {
                p + Y * (under_ramp(p.z) * sink)
            } else {
                p
            }
        };
        let eye_k = keyed([|k| k.eye[0], |k| k.eye[1], |k| k.eye[2]]);
        let look_k = keyed([|k| k.look[0], |k| k.look[1], |k| k.look[2]]);
        let focus_k = keyed([|k| k.focus[0], |k| k.focus[1], |k| k.focus[2]]);
        let own_eyes = curve(|k| k.own).clamp(0.0, 1.0);
        let lens = curve(|k| k.lens);
        let aperture = curve(|k| k.aperture);
        // His own eyes: just in front of the head, along the face.
        let face = body.face;
        let eye_own = body.mouth + face.up * 0.085 + face.forward * 0.01;
        let eye = eye_k.lerp(eye_own, own_eyes);
        let dir_k = (look_k - eye_k).normalize();
        // With his phone out (page 08) his eyes are on it, a little below
        // the middle of the view.
        let (look_own, focus_own) = if body.phone_size > 0.0 {
            let at_phone = body.phone[0] + body.phone[2] * PHONE_LOOK_ABOVE;
            (
                (at_phone - eye_own).normalize(),
                (body.phone[0] - eye_own).length(),
            )
        } else {
            (face.forward, 6.0)
        };
        let forward = dir_k.lerp(look_own, own_eyes).normalize();
        let right = forward.cross(Y).normalize();
        let up = right.cross(forward);
        let focus_far = (focus_k - eye).length().max(0.3);
        let focus = mix(focus_far, focus_own, own_eyes);
        let head_centre = body.head - face.up * 0.08;
        let head_hidden = f32::from((eye - head_centre).length() < 0.3);

        // The breath clouds go by his own clock, so the tape takes them
        // back into his mouth as it rewinds.
        let breath_at = |k: i32| INHALE + BREATH * k as f32;
        let newest = ((own - INHALE) / BREATH).floor() as i32;
        let mut births: Vec<f32> = (0..PUFFS as i32 + 1)
            .map(|i| breath_at(newest - i))
            .collect();
        if voice_page {
            // Page 08: as he speaks each word leaves with its own breath,
            // and no other.
            births.retain(|&b| {
                !voice_spoken().any(|(from, end)| (from - 1.0..end + 1.2).contains(&b))
            });
            births.extend(voice_word_starts().filter(|&w| w <= own));
            births.sort_by(|a, b| b.total_cmp(a));
        }
        let mut puffs = [[0.0, 0.0, 0.0, -1.0]; PUFFS];
        for (p, &born) in puffs.iter_mut().zip(&births) {
            let age = own - born;
            if (0.0..PUFF_LIFE).contains(&age) {
                let then = reel_of(self.chapter, born, r.right);
                let from = self.figure(then);
                // Out of the mouth ahead at walking pace and a little more,
                // slowed by the air: he walks on through it.
                let tau = 0.6;
                let speed = STRIDE / (LOOP / STEPS as f32) * self.walk_of(then).amount(then.at)
                    + 0.6 * self.breath_depth(then.at).max(1.0);
                let c = from.mouth
                    + from.face.forward * (0.08 + speed * tau * (1.0 - (-age / tau).exp()))
                    + Y * (0.05 * age - 0.04);
                *p = [c.x, c.y, c.z, age];
            }
        }
        let breath = self.breath_depth(at);

        // The voice and its echo: page 06's, and page 08's phrases.
        let fact = self.chapter == Chapter::Fact;
        let mut voice = [-1.0, -1.0, 0.0, 0.0];
        let mut voice_from = [eye, eye];
        let mut n = 0;
        for &from in VOICE_AT.iter().rev() {
            let age = at - from;
            if fact && n < 2 && (0.0..VOICE_LIFE).contains(&age) {
                // The two newest shells, newest first.
                voice[n] = 0.12 + VOICE_SPEED * age;
                voice[2 + n] = smooth(0.0, 0.15, age) * (1.0 - age / VOICE_LIFE).powf(1.5);
                voice_from[n] = self.body(from).mouth;
                n += 1;
            }
        }
        let mut echo = [-1.0, 0.0, -1.0, 0.0];
        let mut n = 0;
        for &from in ECHO_AT.iter().rev() {
            let age = at - from;
            let life = ECHO_FROM / VOICE_SPEED;
            if fact && n < 2 && (0.0..life).contains(&age) {
                echo[2 * n] = ECHO_FROM - VOICE_SPEED * age;
                echo[2 * n + 1] = smooth(0.0, 0.4, age) * (0.4 + 0.6 * age / life);
                n += 1;
            }
        }
        if voice_page {
            if let Some((from, age)) = voice_phrase(at) {
                voice[0] = 0.12 + VOICE_SPEED * age;
                voice[2] = smooth(0.0, 0.15, age) * (1.0 - age / VOICE_LIFE).powf(1.5);
                voice_from[0] = self.body(from).mouth;
            }
            if let Some((radius, light)) = voice_echo(at) {
                echo[0] = radius;
                echo[1] = light;
            }
            // The chord: three echoes at once, the third in the voice's
            // second shell, round his head.
            if let Some(([a, b, c], light)) = voice_chord(at) {
                echo = [a, light, b, light];
                voice[1] = c;
                voice[3] = light;
                voice_from[1] = body.head;
            }
        }
        let walls = match self.chapter {
            Chapter::Fact => window(at, 35.6, 36.2, 50.8, 51.6),
            Chapter::Check => 0.0,
            // The tiles ring with the voice while he is under the street.
            Chapter::Voice => window(at, 14.5, 15.3, 72.0, 76.0),
        };

        let lap = self.loop_seconds;
        let signal = script
            .stop
            .iter()
            .map(|&(a, b)| {
                window(at, a, a + 0.15, b, b + 0.15).max(window(at + lap, a, a + 0.15, b, b + 0.15))
            })
            .fold(0.0, f32::max);

        let mut steps = [[0.0, 0.0, 99.0, 0.0]; STEP_MARKS];
        for (slot, s) in steps.iter_mut().zip(walk.landings(at)) {
            *slot = [s.x + WALK_X, s.z, at - s.land, s.side as f32];
        }

        let reach = monotone(script.reach, at);
        let palm = {
            let [ax, ay, az, _] = body.cones[3 * HANDS[1]];
            let [bx, by, bz, _] = body.cones[3 * HANDS[1] + 1];
            v3(ax + bx, ay + by, az + bz) * 0.5
        };
        let mid = eye.lerp(eye + forward * focus, 0.5);
        // Page 08: low enough that the drops fall into the underpass's
        // openings.
        let rain_floor = if voice_page { 4.6 } else { 6.0 };
        let rain_centre = v3(mid.x, mid.y.max(rain_floor), mid.z);

        let (radius, spin) = match (check, r.right) {
            (false, _) => (SPHERE_R, 0.0),
            // The third ring spins up ten whole turns while he is lost.
            (true, false) => (monotone(&CHECK_SPHERE, at), smooth_integral(15.0, 17.5, at)),
            (true, true) => (monotone(&CHECK_SPHERE, at), 0.0),
        };
        let held = if voice_page {
            v3(WALK_X + voice_drift(at), under_ramp(track), track)
        } else {
            base
        };
        let (sphere, mut rings) = sphere(own, held, eye, radius, spin);
        if voice_page {
            // The third ring turns with his pace; the sphere sharpens at
            // «Я Здесь» and flares as the chord meets him.
            rings[2] = (2.0 * PI * VOICE_TURNS * track / REPEAT).rem_euclid(2.0 * PI);
            let sharp = smooth(18.5, 20.5, at) - smooth(VOICE_DIM[0], VOICE_DIM[1], at);
            let flare = window(at, 62.2, 62.6, 62.8, 64.0);
            rings[3] *= mix(0.5, 1.0, sharp) * (1.0 + 1.2 * flare);
        }
        let screen = HIS_SCREEN * monotone(script.phone, at);
        let (beats, ring_light) = match (check, r.right) {
            (false, _) if voice_page => ([0.0; 4], voice_rings(at)),
            (false, _) => ([0.0; 4], [1.0, 1.0, 1.0, 0.0]),
            (true, false) => {
                // Lost: the view narrows to his face, the city goes still,
                // the first ring goes out, then the second.
                let [a, b, c, d] = HUSH;
                (
                    [
                        0.85 * window(at, 14.5, 18.5, 24.4, 25.2),
                        window(at, a, b, c, d),
                        0.0,
                        0.0,
                    ],
                    [
                        1.0 - smooth(5.5, 8.5, at),
                        1.0 - smooth(10.5, 13.5, at),
                        1.0 + 0.8 * smooth(15.0, 17.5, at),
                        screen,
                    ],
                )
            }
            // All three rings lit; at the kerb the light at his soles and
            // the support's circles.
            (true, true) => (
                [
                    0.0,
                    0.0,
                    window(at, 52.2, 53.5, 64.0, 70.0),
                    monotone(&SUPPORT, at),
                ],
                [1.0, 1.0, 1.0, screen],
            ),
        };
        if check {
            rings[3] *= CHECK_RINGS;
        }
        let tape = if check {
            let (stop, back) = (TAKE_END, TAKE_END + FREEZE);
            let (off, gone) = (RIGHT_FROM - 0.3, RIGHT_FROM + 0.2);
            [
                t,
                0.35 * window(t, stop - 0.03, stop, off, gone)
                    + 0.65 * window(t, back - 0.1, back + 0.25, off, gone),
                window(t, stop - 0.08, stop, stop, stop + 0.6),
            ]
        } else {
            [t, 0.0, 0.0]
        };

        Frame {
            time,
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
            rim: monotone(script.rim, at),
            breath,
            puffs,
            voice_from,
            voice,
            walls,
            echo,
            track,
            agitation: monotone(script.agitation, at),
            signal,
            prints: monotone(script.prints, at),
            crane: smooth(3.0, 14.0, eye.y),
            palm,
            palm_rain: reach,
            steps,
            rain_centre,
            puddle: self.puddle,
            sphere,
            rings,
            check: beats,
            cross_car: self.cross_car(t),
            ring_light,
            tape,
            phone: voice_phone(&body, at, own_eyes),
        }
    }
}

/// The sphere of `radius` and its rings at `t`, round the walk's point
/// `base`, seen from `eye`: the rings show least from inside and from near
/// the glass. The third ring has made `spin` turns more than its pace.
pub fn sphere(t: f32, base: V3, eye: V3, radius: f32, spin: f32) -> ([f32; 4], [f32; 4]) {
    let c = base + Y * SPHERE_Y;
    // The first ring: from near the top (polar angle 0.35) down to where
    // the glass meets the pavement, and back.
    let ground = (-SPHERE_Y / radius).acos();
    let swing = 0.5 - 0.5 * (2.0 * PI * t / RING_PERIOD).cos();
    let first = base.y + SPHERE_Y + radius * mix(0.35, ground - 0.02, swing).cos();
    // The second: up while the first goes down.
    let second = base.y + mix(SECOND_RING[0], SECOND_RING[1], 1.0 - swing);
    let third = (2.0 * PI * (t / MERIDIAN_PERIOD + spin)).rem_euclid(2.0 * PI);
    let away = (eye - c).length();
    let seen = mix(
        SPHERE_SEEN[0],
        SPHERE_SEEN[1],
        smooth(radius + 0.1, radius + 0.7, away),
    );
    ([c.x, c.y, c.z, radius], [first, second, third, seen])
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
    use crate::body::{CANOPY, PRIMITIVES, PROPS};
    use crate::REPEAT;

    const CHAPTERS: [Chapter; 3] = [Chapter::Fact, Chapter::Check, Chapter::Voice];

    #[test]
    fn the_rings_come_round_with_the_loop() {
        for chapter in CHAPTERS {
            let s = Story::new(chapter);
            let l = s.loop_seconds;
            // The rings go by his own clock, which covers this in a lap.
            let own = match chapter {
                Chapter::Fact => LOOP,
                Chapter::Check => OWN_LOOP,
                Chapter::Voice => VOICE_LOOP,
            };
            assert!((own / RING_PERIOD - (own / RING_PERIOD).round()).abs() < 1e-4);
            // Page 08's third ring turns with his pace instead.
            let meridian = own / MERIDIAN_PERIOD;
            assert!(chapter == Chapter::Voice || (meridian - meridian.round()).abs() < 1e-4);
            let (a, b) = (s.compose(0.0), s.compose(l - 1e-3));
            for i in [0, 1, 3] {
                assert!((a.rings[i] - b.rings[i]).abs() < 0.01, "{chapter:?} {i}");
            }
            let turn = (a.rings[2] - b.rings[2]).rem_euclid(2.0 * PI);
            assert!(turn.min(2.0 * PI - turn) < 0.01, "{chapter:?}");
        }
        // The first ring reaches the pavement and the top's neighbourhood,
        // the second his soles and his crown.
        let s = Story::new(Chapter::Fact);
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
        for chapter in CHAPTERS {
            let s = Story::new(chapter);
            for k in 0..s.loop_seconds as i32 {
                let f = s.compose(k as f32);
                let c = v3(f.sphere[0], f.sphere[1], f.sphere[2]);
                let ground = f.sphere[1] - SPHERE_Y;
                for p in [f.body.head, v3(f.body.head.x, ground, f.body.head.z)] {
                    assert!((p - c).length() < f.sphere[3] - 0.15, "{chapter:?} {k}");
                }
            }
        }
    }

    #[test]
    fn the_loop_closes() {
        for chapter in CHAPTERS {
            let story = Story::new(chapter);
            let (a, b) = (story.compose(0.0), story.compose(story.loop_seconds - 1e-3));
            assert!(
                (b.eye.z - a.eye.z - REPEAT).abs() < 0.05,
                "{chapter:?} {} {}",
                a.eye.z,
                b.eye.z
            );
            assert!((b.eye.y - a.eye.y).abs() < 0.01);
            assert!((b.eye.x - a.eye.x).abs() < 0.01);
            assert!(b.forward.dot(a.forward) > 0.999);
            assert!((b.agitation - a.agitation).abs() < 0.01);
            assert!((b.signal - a.signal).abs() < 0.01);
            // Page 08's lap runs the street's clock twice round.
            let laps = if chapter == Chapter::Voice { 2.0 } else { 1.0 };
            assert!((b.time - laps * LOOP - a.time).abs() < 0.01, "{chapter:?}");
            for i in 0..4 {
                // The support's rings: 0 before they spread, 2 once faded.
                let wrap = if i == 3 { 2.0 } else { f32::MAX };
                let d = (b.check[i] - a.check[i]).rem_euclid(wrap);
                assert!(d.min(wrap - d) < 0.01, "{chapter:?} {i}");
                assert!((b.ring_light[i] - a.ring_light[i]).abs() < 0.01);
            }
            if chapter == Chapter::Voice {
                // The tiles' code: none yet at the start, all faded at the end.
                assert!(a.cross_car[3] == -1.0 && b.cross_car[3] == -1.0);
                assert!(a.cross_car[0] == 0.0 && b.cross_car[1] < 1e-3);
            } else {
                assert!(a.cross_car[3] == 0.0 && b.cross_car[3] < 1e-3);
            }
            assert!(a.tape[1] == 0.0 && b.tape[1] == 0.0);
            assert!(a.tape[2] == 0.0 && b.tape[2] == 0.0);
        }
    }

    #[test]
    fn the_camera_moves_smoothly() {
        for chapter in CHAPTERS {
            let story = Story::new(chapter);
            let mut previous = story.compose(0.0);
            // The seam (the loop's end back to 0) has its own test: the
            // city moves on by REPEAT.
            for i in 1..(story.loop_seconds * 100.0) as i32 {
                let f = story.compose(i as f32 * 0.01);
                let jump = (f.eye - previous.eye).length();
                // At most the crane's dive, under 20 m/s; the rewind runs
                // the tape back at up to 8.5 times.
                let t = i as f32 * 0.01;
                let rewind = chapter == Chapter::Check && t > TAKE_END + FREEZE && t < RIGHT_FROM;
                let (most, least) = if rewind { (0.4, 0.97) } else { (0.2, 0.995) };
                assert!(jump < most, "{chapter:?} {t} {jump}");
                // His head never fills the lens: close to the camera it is
                // hidden or kept out of the middle half of the view (its
                // edge may pass at the frame's edge).
                let to_head = f.body.head - f.eye;
                let d = to_head.length();
                if f.head_hidden < 0.5 && d < 0.5 {
                    let off = f.forward.dot(to_head * (1.0 / d)).clamp(-1.0, 1.0).acos();
                    let size = (0.14 / d).min(1.0).asin();
                    let half_view = (1.0 / f.lens).atan();
                    assert!(
                        off - size > 0.5 * half_view,
                        "{chapter:?} {t} the head before the lens"
                    );
                }
                assert!(f.forward.dot(previous.forward) > least, "{chapter:?} {t}");
                previous = f;
            }
        }
    }

    #[test]
    fn the_camera_never_goes_under_the_street() {
        for chapter in CHAPTERS {
            let story = Story::new(chapter);
            for i in 0..(story.loop_seconds * 10.0) as i32 {
                let f = story.compose(i as f32 * 0.1);
                let e = f.eye;
                assert!(e.x.abs() < 5.6, "{chapter:?} {i}");
                assert!(f.focus > 0.25);
                if chapter != Chapter::Voice {
                    assert!(e.y > 0.12, "{chapter:?} {i} {}", e.y);
                    continue;
                }
                // Page 08: over the treads and the floor, between the walls
                // when below the street, under the slab where it is roofed.
                let floor = crate::under_floor(e.x, e.z);
                assert!(e.y > floor + 0.12, "{i} {e:?}");
                let [w0, w1] = crate::UNDER_X;
                let between = e.x > w0 + 0.1 && e.x < w1 - 0.1;
                if e.y < 0.0 {
                    assert!(between, "{i} {e:?}");
                }
                let u = under_along(e.z);
                if between && (0.0..UNDER_LEN).contains(&u) && !crate::under_open(e.z) {
                    assert!(e.y < -crate::SLAB - 0.1, "{i} {e:?}");
                }
            }
        }
    }

    #[test]
    fn his_head_is_hidden_only_from_his_own_eyes() {
        let story = Story::new(Chapter::Fact);
        assert_eq!(story.compose(6.0).head_hidden, 1.0);
        assert_eq!(story.compose(21.0).head_hidden, 0.0);
        assert_eq!(story.compose(55.0).head_hidden, 0.0);
        for chapter in [Chapter::Check, Chapter::Voice] {
            let story = Story::new(chapter);
            for i in 0..story.loop_seconds as i32 {
                // Page 08: in his eyes on the phone from 3 s to past 11 s.
                let own = chapter == Chapter::Voice && (3..=11).contains(&i);
                assert_eq!(
                    story.compose(i as f32).head_hidden,
                    f32::from(own),
                    "{chapter:?} {i}"
                );
            }
        }
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
        // Page 07 has neither.
        let check = Story::new(Chapter::Check);
        for t in [37.0, 47.0] {
            let f = check.compose(t);
            assert!(f.voice[0] < 0.0 && f.echo[0] < 0.0 && f.walls == 0.0);
        }
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
        for chapter in CHAPTERS {
            let story = Story::new(chapter);
            for i in 0..story.loop_seconds as i32 {
                let f = story.compose(i as f32);
                let b = &f.body;
                assert!(
                    b.low.x > -crate::FACADE && b.high.x < -crate::ROAD,
                    "{chapter:?} {i}"
                );
                if chapter != Chapter::Voice {
                    assert!(b.low.y > -0.01);
                    continue;
                }
                // Page 08: down in the underpass, between its walls.
                assert!(b.low.y > -crate::UNDER_DEPTH - 0.01, "{i}");
                if b.low.y < -0.05 {
                    let [w0, w1] = crate::UNDER_X;
                    assert!(b.low.x > w0 && b.high.x < w1, "{i} {:?}", (b.low, b.high));
                }
            }
        }
    }

    /// The box round a body's cones `which`.
    fn extent(b: &Body, which: std::ops::Range<usize>) -> (V3, V3) {
        let (mut low, mut high) = (v3(1e9, 1e9, 1e9), v3(-1e9, -1e9, -1e9));
        for c in which {
            for j in 0..2 {
                let [x, y, z, r] = b.cones[3 * c + j];
                low = low.min(v3(x - r, y - r, z - r));
                high = high.max(v3(x + r, y + r, z + r));
            }
        }
        (low, high)
    }

    /// How far ahead of him (along the street, either way) `z` is, folded
    /// into one `REPEAT` as the street repeats its passers.
    fn ahead(z: f32, of: f32) -> f32 {
        (z - of + 0.5 * REPEAT).rem_euclid(REPEAT) - 0.5 * REPEAT
    }

    #[test]
    fn the_passers_come_round_with_the_loop() {
        for chapter in CHAPTERS {
            let story = Story::new(chapter);
            // They live on the city's clock.
            let a = story.passers(0.0);
            let b = story.passers(LOOP - 1e-3);
            for (a, b) in a.iter().zip(&b) {
                let dz = ahead(b.pelvis.z, a.pelvis.z);
                assert!(dz.abs() < 0.01, "{chapter:?} {dz}");
                assert!((b.pelvis.x - a.pelvis.x).abs() < 0.01);
                assert!((b.head.y - a.head.y).abs() < 0.01);
                for c in 0..crate::body::PRIMITIVES {
                    let (p, q) = (a.cones[3 * c], b.cones[3 * c]);
                    assert!((p[1] - q[1]).abs() < 0.02, "cone {c}");
                    assert!((p[3] - q[3]).abs() < 1e-4, "cone {c}");
                }
            }
        }
    }

    #[test]
    fn the_passers_keep_to_the_pavement_and_clear_of_him() {
        for chapter in CHAPTERS {
            let story = Story::new(chapter);
            for i in 0..(story.loop_seconds * 10.0) as i32 {
                let t = i as f32 * 0.1;
                let f = story.compose(t);
                for (who, p) in f.passers.iter().enumerate() {
                    // Page 08's keep to the far pavement.
                    let (low, high) = if chapter == Chapter::Voice {
                        (-p.high.x, -p.low.x)
                    } else {
                        (p.low.x, p.high.x)
                    };
                    assert!(
                        low > -crate::FACADE && high < -crate::ROAD,
                        "{chapter:?} {t}"
                    );
                    assert!(p.low.y > -0.01, "{t}");
                    // Never through him: their bodies' boxes part across the
                    // street wherever they share his stretch of it.
                    if ahead(p.pelvis.z, f.body.pelvis.z).abs() < 1.0 {
                        let (low, high) = extent(&f.body, 0..PRIMITIVES);
                        let apart = (p.low.x - high.x).max(low.x - p.high.x);
                        assert!(apart > 0.0, "{chapter:?} {t} {apart}");
                    }
                    // His umbrella (page 07) rides over their heads and
                    // clears the other umbrella.
                    let [x, y, z, r] = f.body.cones[3 * CANOPY + 1];
                    let radius = f.body.cones[3 * CANOPY][3];
                    if radius > 0.01 && ahead(p.pelvis.z, z).abs() < 2.0 {
                        let (_, head) = extent(p, 0..PROPS[0]);
                        assert!(head.y < y - 0.05, "{chapter:?} {t} {}", head.y - y);
                        if who == UMBRELLA {
                            let [px, py, pz, pr] = p.cones[3 * PROPS[1]];
                            let gap = (px - x).hypot(ahead(pz, z)) - radius - pr;
                            assert!(gap > 0.03 || (py - y).abs() > 0.15, "{chapter:?} {t} {gap}");
                        }
                        assert!(r < 0.01);
                    }
                }
            }
        }
    }

    #[test]
    fn the_passers_meet_him_when_the_story_says() {
        let meets = [
            (
                Chapter::Fact,
                vec![UMBRELLA_MEETS, UMBRELLA_MEETS + 0.5 * LOOP],
                PHONE_MEETS,
            ),
            (
                Chapter::Check,
                vec![CHECK_UMBRELLA_MEETS, CHECK_UMBRELLA_MEETS + RIGHT_SHIFT],
                CHECK_PHONE_MEETS,
            ),
            (
                Chapter::Voice,
                vec![VOICE_UMBRELLA_MEETS],
                VOICE_PHONE_MEETS,
            ),
        ];
        for (chapter, umbrella, phone) in meets {
            let story = Story::new(chapter);
            for t in umbrella {
                let f = story.compose(t);
                let dz = ahead(f.passers[0].pelvis.z, f.body.pelvis.z);
                assert!(dz.abs() < 0.3, "{chapter:?} {t} {dz}");
            }
            let f = story.compose(phone);
            let dz = ahead(f.passers[1].pelvis.z, f.body.pelvis.z);
            assert!(dz.abs() < 0.4, "{chapter:?} {dz}");
            // It looks down at the screen, then up at him.
            let down = story.phone(story.phone_meets - 9.3);
            let up = story.phone(story.phone_meets + 0.3);
            assert!(up.face.forward.y > down.face.forward.y + 0.2, "{chapter:?}");
            assert!(down.screen[1].length() > 0.9);
        }
    }

    #[test]
    fn the_phone_stands_clear_of_the_lamp_posts() {
        for chapter in CHAPTERS {
            let story = Story::new(chapter);
            let z = story.phone(0.0).pelvis.z;
            // The walker's side has its posts halfway between the far side's.
            let half = if chapter == Chapter::Voice { 0.0 } else { 0.5 };
            let k = (z / crate::LAMP_GAP - half).round();
            assert!(
                (z - (k + half) * crate::LAMP_GAP).abs() > 1.2,
                "{chapter:?} {z}"
            );
            assert!(!crossing(cell(z)), "{chapter:?} {z}");
        }
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
        // On page 07 he walks through it without seeing it.
        let check = Story::new(Chapter::Check);
        let wet = check
            .walk()
            .steps()
            .iter()
            .any(|s| ((s.x + WALK_X - x).powi(2) + (s.z - z).powi(2)).sqrt() < r * 0.6);
        assert!(wet);
    }

    #[test]
    fn the_tape_stops_and_runs_back() {
        let story = Story::new(Chapter::Check);
        // It stands at the take's end.
        for t in [TAKE_END + 0.01, TAKE_END + 0.5 * FREEZE, TAKE_END + FREEZE] {
            let r = reel(Chapter::Check, t);
            assert_eq!(
                r,
                Reel {
                    right: false,
                    at: TAKE_END
                },
                "{t}"
            );
        }
        // The right take starts on the picture the rewind ends on.
        let back = story.compose(RIGHT_FROM - 1e-4);
        for f in [story.compose(REWIND_TO), back] {
            let g = story.compose(RIGHT_FROM);
            assert!((f.eye - g.eye).length() < 0.01, "{:?} {:?}", f.eye, g.eye);
            assert!(f.forward.dot(g.forward) > 0.9999);
            assert!((f.body.head - g.body.head).length() < 0.01);
            assert!((f.time - g.time).abs() < 0.01);
            for i in 0..4 {
                assert!((f.rings[i] - g.rings[i]).abs() < 0.01, "ring {i}");
                assert!((f.check[i] - g.check[i]).abs() < 1e-3, "check {i}");
                assert!(
                    (f.ring_light[i] - g.ring_light[i]).abs() < 1e-3,
                    "light {i}"
                );
            }
            assert!(f.cross_car[3] < 1e-3 && g.cross_car[3] < 1e-3);
        }
        // The city's clock runs on, stands with the tape and runs back with
        // it; it hardly moves while he is lost.
        let w = |t: f32| world_time(Chapter::Check, t);
        assert!(w(0.0).abs() < 1e-5);
        assert!((w(CHECK_LOOP - 1e-4) - LOOP).abs() < 0.01);
        assert!((w(CHECK_LOOP + 1.0) - LOOP - w(1.0)).abs() < 0.01);
        let mut last = w(0.0);
        for i in 1..(CHECK_LOOP * 10.0) as i32 {
            let t = i as f32 * 0.1;
            let now = w(t);
            let rate = (now - last) / 0.1;
            if t < TAKE_END - 0.05 || t > RIGHT_FROM + 0.15 {
                assert!(rate > 0.0, "{t} {rate}");
            } else if t > TAKE_END + 0.15 && t < TAKE_END + FREEZE - 0.05 {
                assert!(rate.abs() < 1e-4, "{t} {rate}");
            } else if t > TAKE_END + FREEZE + 0.15 && t < RIGHT_FROM - 0.05 {
                assert!(rate < 0.0, "{t} {rate}");
            }
            if (10.0..25.0).contains(&t) {
                assert!(rate < 0.1, "{t} {rate}");
            }
            last = now;
        }
        assert_eq!(world_time(Chapter::Fact, 17.0), 17.0);
        // The picture turns to tape as it stops, more as it runs back, and
        // flashes at the stop.
        let tape = |t: f32| story.compose(t).tape;
        assert!(tape(TAKE_END - 0.5)[1] < 1e-3);
        assert!((tape(TAKE_END + 0.4)[1] - 0.35).abs() < 0.01);
        assert!(tape(29.5)[1] > 0.99);
        assert!(tape(RIGHT_FROM + 0.5)[1] < 1e-3);
        assert!(tape(TAKE_END)[2] > 0.99);
        assert!(tape(TAKE_END - 0.1)[2] < 0.01 && tape(TAKE_END + 0.7)[2] < 0.01);
    }

    #[test]
    fn the_wrong_take_ends_a_hand_from_the_car() {
        let story = Story::new(Chapter::Check);
        let f = story.compose(TAKE_END);
        let [x, z, yaw, on] = f.cross_car;
        assert!(on > 0.99 && (yaw - 0.5 * PI).abs() < 1e-4);
        let gap = apart(car_rect([x, z, yaw]), Rect::of(&f.body));
        assert!(gap > 0.1 && gap < 0.5, "{gap}");
        // He stands in its lane, off the kerb on red.
        assert_eq!(cell(f.body.pelvis.z), 7);
        assert!(
            (f.body.pelvis.z - CAR_SIDE_Z).abs() < CAR_HALF[1],
            "{}",
            f.body.pelvis.z
        );
        assert!(story.compose(25.0).signal > 0.99);
        // Lost: the first two rings out, only the third, over the phone.
        let lost = story.compose(20.0);
        let l = lost.ring_light;
        assert!(l[0] < 0.01 && l[1] < 0.01 && l[2] > 1.7, "{l:?}");
        assert!(lost.body.screen[1].length() > 0.9 && l[3] > 0.3);
        // The first goes out before the second.
        let half = story.compose(9.5).ring_light;
        assert!(half[0] < 0.01 && half[1] > 0.5, "{half:?}");
        // The third spins hard: a turn in about a second.
        let a = story.compose(20.0).rings[2];
        let b = story.compose(20.25).rings[2];
        let turn = (b - a).rem_euclid(2.0 * PI);
        assert!(turn > 1.2, "{turn}");
        // At the last moment he looks round at it.
        assert!(f.body.face.forward.x < -0.3, "{:?}", f.body.face.forward);
        // Its lights come out of the dark only far up the side street.
        assert!(story.compose(CAR_SEEN[0]).cross_car[3] < 1e-3);
        assert!(story.compose(CAR_SEEN[1]).cross_car[0] < -50.0);
    }

    #[test]
    fn the_right_take_keeps_the_rings_and_waits_for_green() {
        let story = Story::new(Chapter::Check);
        let mut nearest = f32::MAX;
        for i in 0..((CHECK_LOOP - RIGHT_FROM) * 20.0) as i32 {
            let t = RIGHT_FROM + i as f32 * 0.05;
            let f = story.compose(t);
            let l = f.ring_light;
            assert!(
                l[0] > 0.99 && l[1] > 0.99 && (l[2] - 1.0).abs() < 1e-3,
                "{t}"
            );
            assert!(f.check[0] < 1e-3 && f.check[1] < 1e-3, "{t}");
            let [x, z, yaw, on] = f.cross_car;
            if on <= 0.0 {
                continue;
            }
            let car = car_rect([x, z, yaw]);
            nearest = nearest.min(apart(car, Rect::of(&f.body)));
            for p in &f.passers {
                assert!(apart(car, Rect::of(p)) > 0.1, "{t} passer");
            }
            assert!(apart(car, lane_car(f.time, z)) > 2.0, "{t} lane");
        }
        assert!(nearest > 3.0, "{nearest}");
        // The phone out over the walk, away before the kerb.
        let out = story.compose(40.0);
        assert!(out.body.screen[1].length() > 0.9 && out.ring_light[3] > 0.3);
        assert!(story.compose(50.0).body.screen[1].length() < 1e-3);
        // He stands at the kerb through the five, on red, and walks on
        // green.
        let right = &story.walks[1];
        for t in [53.0, 60.0, 80.0] {
            assert!(right.amount(t) < 1e-3, "{t}");
            let f = story.compose(t);
            assert!(f.body.high.z < 53.04, "{t} {}", f.body.high.z);
            assert!(f.signal > 0.99, "{t}");
        }
        assert!(story.compose(90.0).signal < 0.01 && right.amount(90.0) > 0.99);
        // The car turns into the traffic and drives off at its pace.
        let turn = story.car_turn;
        assert!((CAR_TURNS[0]..=CAR_TURNS[1]).contains(&turn), "{turn}");
        let [x, _, yaw, on] = story.cross_car(turn + 4.0);
        assert!((x + CAR_LANE).abs() < 1e-4 && yaw.abs() < 1e-4 && on > 0.99);
        let a = story.cross_car(turn + 6.0)[1];
        let b = story.cross_car(turn + 7.0)[1];
        let pace = CARS[0][1] * REPEAT / LOOP
            * (world_time(Chapter::Check, turn + 7.0) - world_time(Chapter::Check, turn + 6.0));
        assert!((b - a - pace).abs() < 0.05, "{} {pace}", b - a);
        // Its heading turns smoothly, never back.
        let mut last = 0.5 * PI;
        for i in 0..400 {
            let yaw = story.cross_car(turn - 1.0 + i as f32 * 0.02)[2];
            assert!(yaw <= last + 1e-5 && last - yaw < 0.08, "{i}");
            last = yaw;
        }
    }

    #[test]
    fn each_phrase_goes_out_and_its_echo_fixes_a_ring() {
        let story = Story::new(Chapter::Voice);
        // Silent on the stairs, then a shell for each phrase.
        assert!(story.compose(14.0).voice[0] < 0.0);
        for &p in &VOICE_PHRASES {
            let f = story.compose(p + 0.5);
            assert!(f.voice[0] > 0.0 && f.voice[2] > 0.0, "{p}");
        }
        // Each echo comes back onto his head.
        for &e in &VOICE_ECHOES {
            let f = story.compose(e + 1.0);
            assert!(f.echo[0] > 0.0 && f.echo[0] < VOICE_ECHO_FROM, "{e}");
            assert!(story.compose(e + 2.1).echo[0] < 0.0, "{e}");
        }
        // The chord: three at once, all at him together.
        let f = story.compose(CHORD_AT + 1.0);
        assert!(f.echo[0] > f.echo[2] && f.echo[2] > f.voice[1] && f.voice[1] > 0.0);
        let g = story.compose(CHORD_AT + CHORD_LIFE - 0.02);
        assert!(g.echo[0] < 0.2 && g.echo[2] < 0.2 && g.voice[1] < 0.2);
        // The rings light one by one and stay lit up to the street.
        let l = |t: f32| story.compose(t).ring_light;
        assert!(l(20.0).iter().take(3).all(|&x| x < 0.2), "{:?}", l(20.0));
        assert!(l(28.0)[0] > 0.95 && l(28.0)[1] < 0.2);
        assert!(l(35.0)[1] > 0.95 && l(35.0)[2] < 0.2);
        assert!(l(41.0)[2] > 0.95);
        assert!(l(80.0).iter().take(3).all(|&x| x > 0.95));
        assert!(l(103.0).iter().take(3).all(|&x| x < 0.2));
        // Each phrase leaves a line of code in the tiles.
        assert_eq!(story.compose(14.0).cross_car[0], 0.0);
        assert_eq!(story.compose(40.0).cross_car[0], 4.0);
        assert_eq!(story.compose(80.0).cross_car[0], 7.0);
    }

    #[test]
    fn the_third_ring_turns_with_his_pace() {
        let story = Story::new(Chapter::Voice);
        let turn = |a: f32, b: f32| {
            let d = (story.compose(b).rings[2] - story.compose(a).rings[2]).rem_euclid(2.0 * PI);
            d.min(2.0 * PI - d)
        };
        // Standing, it stands; walking, it turns.
        assert!(turn(25.0, 26.0) < 1e-3);
        assert!(turn(40.0, 40.5) > 0.3);
    }

    #[test]
    fn his_feet_keep_to_the_treads_and_his_hand_to_the_rail() {
        let story = Story::new(Chapter::Voice);
        let walk = story.walk();
        let mut on_stairs = 0;
        for s in walk.steps() {
            let u = under_along(s.z);
            let from = if (0.0..FLIGHT).contains(&u) {
                0.0
            } else if (FLIGHT + FLAT..UNDER_LEN).contains(&u) {
                FLIGHT + FLAT
            } else {
                continue;
            };
            let into = (u - from).rem_euclid(TREAD);
            assert!(into > 0.05 && into < 0.15, "{} {into}", s.z);
            on_stairs += 1;
        }
        assert_eq!(on_stairs, 3 * 2 * (RISERS - 1));
        // Under the street at the bottom, out at the top.
        let deep = story.compose(25.0).body;
        assert!(deep.low.y < -crate::UNDER_DEPTH + 0.05, "{:?}", deep.low);
        let out = story.compose(64.0).body;
        assert!(out.low.y > -0.01 && out.low.y < 0.05, "{:?}", out.low);
        // The right hand on the rail all up the flight.
        for t in [51.0, 54.0, 57.0, 59.5] {
            let palm = story.compose(t).palm;
            let rail = crate::UNDER_X[0] + RAIL_IN;
            assert!((palm.x - rail).abs() < 0.12, "{t} {palm:?}");
            assert!((palm.y - rail_height(palm.z)).abs() < 0.15, "{t} {palm:?}");
        }
    }
}
