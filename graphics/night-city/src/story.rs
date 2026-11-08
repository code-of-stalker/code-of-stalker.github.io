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
//! Page 07 «Главная проверка» (96 s of his time over the city's 64):
//! 0–7 s     over the shoulder: the phone comes out, the head goes down;
//! 7–13 s    the outer world goes quiet: the first ring goes out and the
//!           city's clock slows nearly to a halt (the rain hangs, the code
//!           stops, the cars stand);
//! 13–19 s   before his face: the second ring goes out;
//! 19–31 s   the view narrows to a tunnel at his face, only the third ring
//!           spins, hard; he walks onto the crossing on red;
//! 30–32 s   a car out of the side street floods him with its headlights
//!           and brakes; he stops and looks up;
//! 38–42 s   «стопы»: light at his soles;
//! 43–47 s   «опора»: the pavement lights in rings from his feet;
//! 48–53 s   «дыхание»: one long breath, a big cloud;
//! 53–60 s   «расхлопнутость»: the sphere opens wide, the rings light
//!           again, the city's clock runs again;
//! 58–90 s   «пространство»: the crane over the quarter, he walks on and
//!           the car turns behind him into the traffic;
//! 90–96 s   back down over his shoulder.
use crate::body::{build, Body, Carry, Coat, Step, Walk, HANDS, SWING_SHARE};
use crate::math::{mix, monotone, smooth, smooth_integral, v3, window, window_integral, V3, Y};
use crate::{
    Chapter, CARS, CAR_LANE, CELL, CHECK_LOOP, CROSS, LOOP, PUFFS, REPEAT, STEPS, STEP_MARKS,
    STEP_WIDTH, STRIDE, WALK_X,
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

/// Page 07: the city's clock runs at `STILL_RATE` between the middle two
/// of `STILL` (eased over the spans either side) and fast enough the rest
/// of the time to make up `LOOP` in `CHECK_LOOP`.
const STILL: [f32; 4] = [8.0, 13.0, 53.0, 60.0];
const STILL_RATE: f32 = 0.05;
/// His walk on page 07: from `CHECK_FROM` he steps on to step
/// `CHECK_LAST`, on the crossing, brings his feet together and stands;
/// the walk takes up again from step `CHECK_ON` of the next lap.
const CHECK_FROM: f32 = 19.56;
const CHECK_LAST: i32 = 58;
const CHECK_ON: i32 = -61;
/// The passers meet him at these moments of his time.
const CHECK_UMBRELLA_MEETS: f32 = 4.0;
const CHECK_PHONE_MEETS: f32 = 72.0;
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

const CHECK_SHOTS: [Key; 22] = [
    SHOULDER,
    key(
        6.0,
        [-0.66, 1.74, -1.12],
        [0.1, 1.32, 2.6],
        [-0.05, 1.42, 0.35],
        1.85,
        0.007,
        0.0,
    ),
    // Ahead of him by the shop windows, looking back: the street goes
    // quiet round him.
    key(
        8.8,
        [-1.1, 1.5, 1.6],
        [0.6, 1.2, -0.6],
        [0.0, 1.35, 0.1],
        1.6,
        0.006,
        0.0,
    ),
    key(
        13.0,
        [-1.2, 1.45, 1.8],
        [0.65, 1.2, -0.5],
        [0.0, 1.35, 0.1],
        1.6,
        0.006,
        0.0,
    ),
    // Before his face, over the phone, closing in.
    key(
        16.2,
        [0.05, 1.5, 1.1],
        [0.0, 1.52, 0.1],
        [0.0, 1.56, 0.12],
        2.2,
        0.008,
        0.0,
    ),
    key(
        20.6,
        [0.08, 1.52, 0.97],
        [0.0, 1.52, 0.1],
        [0.0, 1.56, 0.12],
        2.35,
        0.009,
        0.0,
    ),
    key(
        23.4,
        [0.1, 1.55, 0.86],
        [0.0, 1.54, 0.1],
        [0.0, 1.57, 0.12],
        2.6,
        0.01,
        0.0,
    ),
    key(
        29.4,
        [0.14, 1.57, 0.8],
        [0.0, 1.54, 0.1],
        [0.0, 1.57, 0.12],
        2.7,
        0.01,
        0.0,
    ),
    // From the carriageway side: the headlights behind him.
    key(
        31.2,
        [1.5, 1.5, 0.3],
        [-1.0, 1.35, 0.05],
        [0.0, 1.5, 0.05],
        2.0,
        0.008,
        0.0,
    ),
    key(
        37.4,
        [1.35, 1.48, 0.28],
        [-1.0, 1.36, 0.05],
        [0.0, 1.5, 0.05],
        2.15,
        0.008,
        0.0,
    ),
    // Down at his feet: «стопы».
    key(
        39.6,
        [0.9, 0.28, 0.95],
        [0.0, 0.1, 0.0],
        [0.0, 0.08, 0.05],
        2.2,
        0.012,
        0.0,
    ),
    key(
        42.6,
        [0.8, 0.26, 0.85],
        [0.0, 0.1, 0.0],
        [0.0, 0.08, 0.05],
        2.3,
        0.012,
        0.0,
    ),
    // Over the pavement round him: «опора».
    key(
        44.8,
        [1.6, 1.5, 2.3],
        [-0.2, 0.0, -0.3],
        [0.0, 0.3, 0.0],
        1.75,
        0.007,
        0.0,
    ),
    key(
        47.6,
        [1.75, 1.7, 2.5],
        [-0.2, 0.0, -0.3],
        [0.0, 0.3, 0.0],
        1.7,
        0.007,
        0.0,
    ),
    // His profile: «дыхание».
    key(
        49.2,
        [1.2, 1.62, 0.65],
        [-1.0, 1.58, 0.25],
        [0.0, 1.62, 0.2],
        2.3,
        0.009,
        0.0,
    ),
    key(
        52.6,
        [1.15, 1.62, 0.72],
        [-1.0, 1.58, 0.3],
        [0.0, 1.62, 0.2],
        2.3,
        0.009,
        0.0,
    ),
    // Drawn back and up as the sphere opens: «расхлопнутость».
    key(
        58.6,
        [5.0, 5.0, -7.0],
        [-0.3, 0.8, 1.0],
        [0.0, 1.0, 0.0],
        1.6,
        0.005,
        0.0,
    ),
    // The crane over the quarter: «пространство».
    key(
        64.0,
        [3.0, 11.0, -8.0],
        [0.5, 0.6, 5.0],
        [0.0, 0.8, 0.0],
        1.7,
        0.005,
        0.0,
    ),
    key(
        80.0,
        [4.5, 22.0, -13.0],
        [1.0, 0.0, 9.0],
        [0.0, 0.8, 0.0],
        1.65,
        0.004,
        0.0,
    ),
    key(
        90.0,
        [-0.9, 3.2, -3.5],
        [0.2, 1.2, 4.0],
        [0.0, 1.3, 0.2],
        1.7,
        0.005,
        0.0,
    ),
    at(94.0, SHOULDER),
    at(CHECK_LOOP, SHOULDER),
];
const CHECK_TURN: [(f32, f32); 14] = [
    (0.0, 0.0),
    (29.7, 0.0),
    (30.7, -0.7),
    (37.2, -0.65),
    (38.8, -0.1),
    (47.6, -0.05),
    (48.8, 0.0),
    (64.5, 0.0),
    (66.8, 0.35),
    (69.0, 0.35),
    (71.6, -0.3),
    (74.0, -0.3),
    (76.6, 0.0),
    (CHECK_LOOP, 0.0),
];
const CHECK_NOD: [(f32, f32); 16] = [
    (0.0, 0.05),
    (1.6, 0.05),
    (3.4, 0.42),
    (29.8, 0.42),
    (30.7, -0.08),
    (37.4, -0.05),
    (39.0, 0.4),
    (43.0, 0.4),
    (44.6, 0.25),
    (47.6, 0.25),
    (48.8, 0.0),
    (54.0, 0.0),
    (57.0, -0.12),
    (62.0, -0.12),
    (64.0, 0.0),
    (CHECK_LOOP, 0.05),
];
/// Red for him from before he reaches the crossing until he is back.
const CHECK_RED: [(f32, f32); 1] = [(19.8, 60.2)];
const CHECK_PRINTS: [(f32, f32); 8] = [
    (0.0, 0.35),
    (12.0, 0.35),
    (15.0, 0.0),
    (58.0, 0.0),
    (62.0, 1.0),
    (84.0, 1.0),
    (90.0, 0.35),
    (CHECK_LOOP, 0.35),
];
const CHECK_RIM: [(f32, f32); 10] = [
    (0.0, 1.0),
    (14.0, 1.0),
    (19.0, 0.4),
    (31.6, 0.4),
    (38.0, 0.8),
    (53.0, 1.0),
    (58.0, 1.6),
    (66.0, 1.6),
    (72.0, 1.0),
    (CHECK_LOOP, 1.0),
];
/// His phone: out of the pocket, 0 … 1 in his hand before him.
const CHECK_PHONE: [(f32, f32); 4] = [(1.5, 0.0), (3.5, 1.0), (33.5, 1.0), (35.5, 0.0)];
/// How thick his breath clouds are: thin while he is lost, one long
/// breath at «дыхание».
const CHECK_BREATH: [(f32, f32); 8] = [
    (0.0, 0.35),
    (9.0, 0.35),
    (16.0, 0.12),
    (46.0, 0.12),
    (48.8, 1.8),
    (52.6, 1.8),
    (55.5, 0.35),
    (CHECK_LOOP, 0.35),
];
/// The sphere's radius: wide open at «расхлопнутость».
const CHECK_SPHERE: [(f32, f32); 6] = [
    (0.0, SPHERE_R),
    (53.6, SPHERE_R),
    (59.6, 8.0),
    (74.0, 8.0),
    (84.0, SPHERE_R),
    (CHECK_LOOP, SPHERE_R),
];
/// «Опора»: its rings spread from his feet (0 … 1), then fade (1 … 2).
const SUPPORT: [(f32, f32); 6] = [
    (0.0, 0.0),
    (42.8, 0.0),
    (46.8, 1.0),
    (55.0, 1.0),
    (61.0, 2.0),
    (CHECK_LOOP, 2.0),
];

/// The side street's car on page 07: up the cross street's near lane
/// (z = `CAR_SIDE_Z`) toward the main street at `CAR_RUSH` m/s, braking
/// evenly over `CAR_BRAKE` to stand with its middle at x = `CAR_STOP`,
/// its nose short of the crossing. When he has walked on it creeps out
/// at `CAR_CRAWL` m/s, turns right on a `CAR_TURN` m arc from x =
/// `CAR_TURN_X` into lane 0, and from the middle of the turn takes
/// `CAR_PULL` s to reach the traffic's pace. `CAR_SEEN`: it comes out of
/// the dark and goes back into it.
pub const CAR_SIDE_Z: f32 = 7.25 * CELL;
pub const CAR_STOP: f32 = -8.35;
const CAR_RUSH: f32 = 12.0;
const CAR_BRAKE: [f32; 2] = [30.2, 31.6];
const CAR_SEEN: [f32; 4] = [26.0, 27.2, 84.0, 88.0];
/// Once he has stopped the driver dips the headlights to `CAR_DIP` of
/// their light until the car moves off.
const CAR_DIPPED: [f32; 4] = [33.5, 36.5, 63.5, 66.0];
const CAR_DIP: f32 = 0.35;
const CAR_TURN: f32 = 3.5;
const CAR_TURN_X: f32 = -5.1;
const CAR_CRAWL: f32 = 6.0;
const CAR_START: f32 = 1.2;
const CAR_PULL: f32 = 2.2;
/// When it may set off, and how long the search for the gap in the
/// traffic looks ahead.
const CAR_GO: [f32; 2] = [65.5, 70.0];
const CAR_AHEAD: f32 = 23.0;
/// A car's half length and half width (the shaders draw it so).
pub const CAR_HALF: [f32; 2] = [2.45, 0.92];

/// One page's loop: its camera and the curves its walker and street
/// follow.
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

/// The city's clock at `t` of his: on page 07 it nearly stops while he is
/// lost in the phone and makes up for it when he comes back, `LOOP` of it
/// in each of his loops, as the street, the rain and the code need.
pub fn world_time(chapter: Chapter, t: f32) -> f32 {
    match chapter {
        Chapter::Fact => t,
        Chapter::Check => {
            let laps = (t / CHECK_LOOP).floor();
            let s = t - laps * CHECK_LOOP;
            LOOP * (laps + held(s) / held(CHECK_LOOP))
        }
    }
}

/// Page 07's slowed time from the start of the loop, before scaling.
fn held(t: f32) -> f32 {
    let [a, b, c, d] = STILL;
    t - (1.0 - STILL_RATE) * window_integral(t, a, b, c, d)
}

/// Page 07's walk (see `CHECK_FROM`).
fn check_walk() -> Walk {
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
    let mut steps: Vec<Step> = (-8..=CHECK_LAST)
        .map(|k| step(k, k as f32 * period, along(k)))
        .collect();
    // The feet together on the crossing.
    let last = CHECK_LAST + 1;
    steps.push(step(last, last as f32 * period, along(CHECK_LAST)));
    steps
        .extend((CHECK_ON..=8).map(|k| step(k, k as f32 * period + CHECK_LOOP, along(k) + REPEAT)));
    let start = [[STEP_WIDTH, along(-10)], [-STEP_WIDTH, along(-9)]];
    Walk::new(start, steps, 7.0)
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

/// The side street's car at `t` if it sets off at `go` and joins the
/// traffic at `fast` m/s: its middle x, z and heading.
fn car_at(t: f32, go: f32, fast: f32) -> [f32; 3] {
    let [a, b] = CAR_BRAKE;
    let brake = b - a;
    if t < go {
        // Up the side street at speed, then braking evenly to a stand.
        let left = if t < a {
            0.5 * CAR_RUSH * brake + CAR_RUSH * (a - t)
        } else {
            let s = (b - t).max(0.0);
            0.5 * CAR_RUSH / brake * s * s
        };
        return [CAR_STOP - left, CAR_SIDE_Z, 0.5 * PI];
    }
    let straight = CAR_TURN_X - CAR_STOP;
    let arc = 0.5 * PI * CAR_TURN;
    // Off at a crawl, then up to speed from the middle of the turn.
    let moving = 0.5 * CAR_CRAWL * CAR_START;
    let pull = go + CAR_START + (straight + 0.5 * arc - moving) / CAR_CRAWL;
    let d = CAR_CRAWL * smooth_integral(go, go + CAR_START, t)
        + (fast - CAR_CRAWL) * smooth_integral(pull, pull + CAR_PULL, t);
    if d < straight {
        [CAR_STOP + d, CAR_SIDE_Z, 0.5 * PI]
    } else if d < straight + arc {
        let a = (d - straight) / CAR_TURN;
        [
            CAR_TURN_X + CAR_TURN * a.sin(),
            CAR_SIDE_Z + CAR_TURN * (1.0 - a.cos()),
            0.5 * PI - a,
        ]
    } else {
        [-CAR_LANE, CAR_SIDE_Z + CAR_TURN + d - straight - arc, 0.0]
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
}

pub struct Story {
    pub chapter: Chapter,
    pub loop_seconds: f32,
    script: Script,
    walk: Walk,
    puddle: [f32; 3],
    umbrella: Walk,
    /// Where the umbrella's line of copies starts along the street.
    umbrella_from: f32,
    phone: Walk,
    phone_at: V3,
    /// When (the city's time) the one with the phone looks up at him.
    phone_meets: f32,
    /// Page 07: when the side street's car sets off, and how fast it then
    /// joins the traffic.
    car_go: f32,
    car_fast: f32,
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
        let (script, walk, umbrella_meets, phone_meets) = match chapter {
            Chapter::Fact => (FACT, steady, UMBRELLA_MEETS, PHONE_MEETS),
            Chapter::Check => (CHECK, check_walk(), CHECK_UMBRELLA_MEETS, CHECK_PHONE_MEETS),
        };
        let period = LOOP / UMBRELLA_STEPS as f32;
        let stride = REPEAT / UMBRELLA_STEPS as f32 / UMBRELLA_SCALE;
        let umbrella = Walk::steady(period, stride, 0.075, -8, UMBRELLA_STEPS + 8, 6.0);
        let umbrella_from = walk.track(umbrella_meets)
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
        let phone_at = v3(PHONE_X, 0.0, walk.track(phone_meets) + 0.15);
        let mut story = Story {
            chapter,
            loop_seconds: chapter.loop_seconds(),
            script,
            walk,
            puddle: [splash.x + WALK_X, splash.z + 0.1, 0.62],
            umbrella,
            umbrella_from,
            phone,
            phone_at,
            phone_meets: world_time(chapter, phone_meets),
            car_go: 0.0,
            car_fast: CARS[0][1] * REPEAT / held(CHECK_LOOP),
        };
        if chapter == Chapter::Check {
            story.car_go = story.find_gap();
        }
        story
    }

    /// When the side street's car sets off: the moment in `CAR_GO` that
    /// keeps it widest of him, the passers and lane 0's cars.
    fn find_gap(&self) -> f32 {
        let dt = 0.1;
        let from = CAR_GO[0];
        let samples = ((CAR_GO[1] + CAR_AHEAD - from) / dt) as usize;
        // Who else is on the street at each moment, whenever the car goes.
        let others: Vec<(f32, Vec<Rect>)> = (0..=samples)
            .map(|i| {
                let t = from + i as f32 * dt;
                let world = world_time(self.chapter, t);
                let mut near = vec![Rect::of(&self.body(t))];
                near.extend(self.passers(world).iter().map(Rect::of));
                (t, near)
            })
            .collect();
        let mut best = (f32::MIN, from);
        let mut go = from;
        while go <= CAR_GO[1] {
            let mut worst = f32::MAX;
            for (t, near) in others
                .iter()
                .filter(|(t, _)| *t >= go && *t <= go + CAR_AHEAD)
            {
                let car = car_rect(car_at(*t, go, self.car_fast));
                let lane = lane_car(world_time(self.chapter, *t), car.c[1]);
                for r in near.iter().chain(std::iter::once(&lane)) {
                    worst = worst.min(apart(car, *r));
                }
            }
            if worst > best.0 {
                best = (worst, go);
            }
            go += 0.05;
        }
        best.1
    }

    /// The side street's car at `t` (page 07; nowhere on page 06).
    pub fn cross_car(&self, t: f32) -> [f32; 4] {
        if self.chapter != Chapter::Check {
            return [0.0; 4];
        }
        let [a, b, c, d] = CAR_SEEN;
        let [e, f, g, h] = CAR_DIPPED;
        let [x, z, yaw] = car_at(t, self.car_go, self.car_fast);
        let lights = 1.0 - (1.0 - CAR_DIP) * window(t, e, f, g, h);
        [x, z, yaw, window(t, a, b, c, d) * lights]
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
        let up = monotone(&PHONE_UP, t - self.phone_meets);
        pose.nod = mix(0.42, 0.06, up);
        pose.turn = 0.6 * monotone(&PHONE_FOLLOW, t - self.phone_meets);
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

    /// How thick his breath clouds are at `t`.
    fn breath_depth(&self, t: f32) -> f32 {
        match self.chapter {
            Chapter::Fact => 0.35 + 0.65 * window(t, 23.6, 24.8, 28.8, 29.8),
            Chapter::Check => monotone(&CHECK_BREATH, t),
        }
    }

    /// The figure at `t`, standing on the pavement.
    pub fn body(&self, t: f32) -> Body {
        let s = &self.script;
        let mut pose = self.walk.pose(t, Self::breath(t));
        pose.turn = monotone(s.turn, t);
        pose.nod = monotone(s.nod, t);
        let reach = monotone(s.reach, t);
        if reach > 0.0 {
            // Palm up in front of the chest, a little to the right.
            let probe = build(&pose);
            let c = probe.chest_axes;
            let target = probe.chest + c.forward * 0.42 - c.left * 0.12 + Y * 0.1;
            pose.hands[1] = [target.x, target.y, target.z, reach];
            pose.wrists[1] = -0.25 * reach;
        }
        let out = monotone(s.phone, t);
        if out > 0.0 {
            // The phone before the chest, the face bowed over it.
            pose.carry = Carry::Screen(out);
            let probe = build(&pose);
            let c = probe.chest_axes;
            let hold = probe.chest + c.forward * 0.3 - c.left * 0.05 + Y * 0.16;
            pose.hands[1] = [hold.x, hold.y, hold.z, out];
            pose.wrists[1] = -0.15 * out;
        }
        build(&pose).moved(|_| v3(WALK_X, 0.0, 0.0))
    }

    pub fn compose(&self, t: f32) -> Frame {
        let t = t.rem_euclid(self.loop_seconds);
        let check = self.chapter == Chapter::Check;
        let script = self.script;
        let time = world_time(self.chapter, t);
        let body = self.body(t);
        let passers = self.passers(time);
        let track = self.walk.track(t);
        let base = v3(WALK_X, 0.0, track);
        let curve = |pick: fn(&Key) -> f32| -> f32 {
            let keys: Vec<(f32, f32)> = script.shots.iter().map(|k| (k.at, pick(k))).collect();
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
                let at = breath_at(k);
                let from = self.body(at);
                // Out of the mouth ahead at walking pace and a little more,
                // slowed by the air: he walks on through it.
                let tau = 0.6;
                let speed = STRIDE / (LOOP / STEPS as f32) * self.walk.amount(at)
                    + 0.6 * self.breath_depth(at).max(1.0);
                let c = from.mouth
                    + from.face.forward * (0.08 + speed * tau * (1.0 - (-age / tau).exp()))
                    + Y * (0.05 * age - 0.04);
                *p = [c.x, c.y, c.z, age];
            }
        }
        let breath = self.breath_depth(t);

        // The voice and its echo are page 06's.
        let mut voice = [-1.0, -1.0, 0.0, 0.0];
        let mut voice_from = [eye, eye];
        let mut n = 0;
        for &at in VOICE_AT.iter().rev() {
            let age = t - at;
            if !check && n < 2 && (0.0..VOICE_LIFE).contains(&age) {
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
            if !check && n < 2 && (0.0..life).contains(&age) {
                echo[2 * n] = ECHO_FROM - VOICE_SPEED * age;
                echo[2 * n + 1] = smooth(0.0, 0.4, age) * (0.4 + 0.6 * age / life);
                n += 1;
            }
        }
        let walls = if check {
            0.0
        } else {
            window(t, 35.6, 36.2, 50.8, 51.6)
        };

        let lap = self.loop_seconds;
        let signal = script
            .stop
            .iter()
            .map(|&(a, b)| {
                window(t, a, a + 0.15, b, b + 0.15).max(window(t + lap, a, a + 0.15, b, b + 0.15))
            })
            .fold(0.0, f32::max);

        let mut steps = [[0.0, 0.0, 99.0, 0.0]; STEP_MARKS];
        for (slot, s) in steps.iter_mut().zip(self.walk.landings(t)) {
            *slot = [s.x + WALK_X, s.z, t - s.land, s.side as f32];
        }

        let reach = monotone(script.reach, t);
        let palm = {
            let [ax, ay, az, _] = body.cones[3 * HANDS[1]];
            let [bx, by, bz, _] = body.cones[3 * HANDS[1] + 1];
            v3(ax + bx, ay + by, az + bz) * 0.5
        };
        let mid = eye.lerp(eye + forward * focus, 0.5);
        let rain_centre = v3(mid.x, mid.y.max(6.0), mid.z);

        let (radius, spin) = if check {
            // The third ring spins up eleven whole turns while he is lost.
            (
                monotone(&CHECK_SPHERE, t),
                window_integral(t, 19.5, 22.0, 30.5, 33.0),
            )
        } else {
            (SPHERE_R, 0.0)
        };
        let (sphere, mut rings) = sphere(t, base, eye, radius, spin);
        let (beats, ring_light) = if check {
            rings[3] *= CHECK_RINGS;
            (
                [
                    0.85 * window(t, 18.5, 23.0, 30.6, 31.6),
                    window(t, 7.5, 12.5, 53.5, 58.5),
                    window(t, 38.2, 39.8, 55.0, 61.0),
                    monotone(&SUPPORT, t),
                ],
                [
                    1.0 - window(t, 7.5, 11.0, 54.0, 55.5),
                    1.0 - window(t, 14.5, 18.0, 56.0, 57.5),
                    1.0 + 0.8 * window(t, 20.0, 22.0, 30.5, 33.0),
                    HIS_SCREEN * monotone(script.phone, t),
                ],
            )
        } else {
            ([0.0; 4], [1.0, 1.0, 1.0, 0.0])
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
            rim: monotone(script.rim, t),
            breath,
            puffs,
            voice_from,
            voice,
            walls,
            echo,
            track,
            agitation: monotone(script.agitation, t),
            signal,
            prints: monotone(script.prints, t),
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
    let first = SPHERE_Y + radius * mix(0.35, ground - 0.02, swing).cos();
    // The second: up while the first goes down.
    let second = mix(SECOND_RING[0], SECOND_RING[1], 1.0 - swing);
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
    use crate::REPEAT;

    const CHAPTERS: [Chapter; 2] = [Chapter::Fact, Chapter::Check];

    #[test]
    fn the_rings_come_round_with_the_loop() {
        for chapter in CHAPTERS {
            let s = Story::new(chapter);
            let l = s.loop_seconds;
            for r in [l / RING_PERIOD, l / MERIDIAN_PERIOD] {
                assert!((r - r.round()).abs() < 1e-4, "{r}");
            }
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
                for p in [f.body.head, v3(f.body.head.x, 0.0, f.body.head.z)] {
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
            assert!((b.time - LOOP - a.time).abs() < 0.01, "{chapter:?}");
            for i in 0..4 {
                // The support's rings: 0 before they spread, 2 once faded.
                let wrap = if i == 3 { 2.0 } else { f32::MAX };
                let d = (b.check[i] - a.check[i]).rem_euclid(wrap);
                assert!(d.min(wrap - d) < 0.01, "{chapter:?} {i}");
                assert!((b.ring_light[i] - a.ring_light[i]).abs() < 0.01);
            }
            assert!(a.cross_car[3] == 0.0 && b.cross_car[3] < 1e-3);
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
                // At most the crane's dive, under 20 m/s.
                assert!(jump < 0.2, "{chapter:?} {} {jump}", f.time);
                // His head never fills the lens: close to the camera it is
                // hidden or well off the view's axis.
                let to_head = f.body.head - f.eye;
                let close = to_head.length() < 0.5;
                assert!(
                    f.head_hidden > 0.5 || !close || f.forward.dot(to_head.normalize()) < 0.6,
                    "{chapter:?} {} the head before the lens",
                    i as f32 * 0.01
                );
                assert!(f.forward.dot(previous.forward) > 0.995, "{chapter:?} {i}");
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
                assert!(f.eye.y > 0.12, "{chapter:?} {i} {}", f.eye.y);
                assert!(f.eye.x.abs() < 5.6, "{chapter:?} {i}");
                assert!(f.focus > 0.25);
            }
        }
    }

    #[test]
    fn his_head_is_hidden_only_from_his_own_eyes() {
        let story = Story::new(Chapter::Fact);
        assert_eq!(story.compose(6.0).head_hidden, 1.0);
        assert_eq!(story.compose(21.0).head_hidden, 0.0);
        assert_eq!(story.compose(55.0).head_hidden, 0.0);
        let check = Story::new(Chapter::Check);
        for i in 0..96 {
            assert_eq!(check.compose(i as f32).head_hidden, 0.0, "{i}");
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
                assert!(
                    f.body.low.x > -crate::FACADE && f.body.high.x < -crate::ROAD,
                    "{chapter:?} {i}"
                );
                assert!(f.body.low.y > -0.01);
            }
        }
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
                for p in &f.passers {
                    assert!(
                        p.low.x > -crate::FACADE && p.high.x < -crate::ROAD,
                        "{chapter:?} {t}"
                    );
                    assert!(p.low.y > -0.01, "{t}");
                    // Never through him: their boxes part across the street
                    // wherever they share his stretch of it.
                    if ahead(p.pelvis.z, f.body.pelvis.z).abs() < 1.0 {
                        let apart = (p.low.x - f.body.high.x).max(f.body.low.x - p.high.x);
                        assert!(apart > 0.0, "{chapter:?} {t} {apart}");
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
                vec![CHECK_UMBRELLA_MEETS],
                CHECK_PHONE_MEETS,
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
            let k = (z / crate::LAMP_GAP - 0.5).round();
            assert!(
                (z - (k + 0.5) * crate::LAMP_GAP).abs() > 1.2,
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
    fn the_city_clock_slows_and_makes_up_the_loop() {
        let w = |t: f32| world_time(Chapter::Check, t);
        assert!(w(0.0).abs() < 1e-5);
        assert!((w(CHECK_LOOP - 1e-4) - LOOP).abs() < 0.01);
        assert!((w(CHECK_LOOP + 1.0) - LOOP - w(1.0)).abs() < 0.01);
        let mut last = w(0.0);
        for i in 1..960 {
            let t = i as f32 * 0.1;
            let now = w(t);
            assert!(now > last, "{t}");
            let rate = (now - last) / 0.1;
            if (14.0..52.0).contains(&t) {
                assert!(rate < 0.1, "{t} {rate}");
            }
            if !(6.0..62.0).contains(&t) {
                assert!(rate > 1.0, "{t} {rate}");
            }
            last = now;
        }
        assert_eq!(world_time(Chapter::Fact, 17.0), 17.0);
    }

    #[test]
    fn he_stops_on_the_crossing_and_walks_on() {
        let story = Story::new(Chapter::Check);
        for t in [35.0, 45.0, 60.0] {
            assert!(story.walk().amount(t) < 1e-3, "{t}");
            let z = story.walk().track(t);
            assert!(crossing(cell(z)), "{t} {z}");
        }
        assert!(story.walk().amount(20.0) > 0.99 && story.walk().amount(70.0) > 0.99);
        // He comes up to the crossing on red, and it turns back after.
        assert!(story.compose(27.0).signal > 0.99);
        assert!(story.compose(70.0).signal < 0.01);
        // The phone is out while he is lost, gone when he comes back.
        let lost = story.compose(20.0);
        assert!(lost.body.screen[1].length() > 0.9 && lost.ring_light[3] > 0.3);
        assert!(story.compose(40.0).body.screen[1].length() < 1e-3);
    }

    #[test]
    fn the_rings_go_out_and_come_back() {
        let story = Story::new(Chapter::Check);
        let calm = story.compose(4.0).ring_light;
        assert!(calm[0] > 0.99 && calm[1] > 0.99 && (calm[2] - 1.0).abs() < 0.01);
        // The first goes out before the second.
        let half = story.compose(16.0).ring_light;
        assert!(half[0] < 0.01 && half[1] > 0.2, "{half:?}");
        let lost = story.compose(26.0).ring_light;
        assert!(
            lost[0] < 0.01 && lost[1] < 0.01 && lost[2] > 1.7,
            "{lost:?}"
        );
        let back = story.compose(62.0);
        assert!(back.ring_light[0] > 0.99 && back.ring_light[1] > 0.99);
        assert!(back.sphere[3] > 7.0);
        assert!(back.check[1] < 0.01);
        // The third spins hard while he is lost: a turn in about a second.
        let a = story.compose(26.0).rings[2];
        let b = story.compose(26.25).rings[2];
        let turn = (b - a).rem_euclid(2.0 * PI);
        assert!(turn > 1.2, "{turn}");
    }

    #[test]
    fn the_car_stops_short_of_him_and_never_touches_him() {
        let story = Story::new(Chapter::Check);
        let stood = story.compose(40.0);
        let [x, z, yaw, on] = stood.cross_car;
        assert!(
            (on - CAR_DIP).abs() < 1e-3
                && (x - CAR_STOP).abs() < 1e-3
                && (yaw - 0.5 * PI).abs() < 1e-4
        );
        // Full beam when it stops, dipped while it waits, full as it goes.
        assert!(story.compose(32.0).cross_car[3] > 0.99);
        assert!(story.car_go > CAR_DIPPED[3] - 0.5);
        // Its nose short of the zebra (|x| 3.55 … 5.65), in front of him.
        assert!(x + CAR_HALF[0] < -5.7);
        assert!((z - stood.body.pelvis.z).abs() < CAR_HALF[1]);
        // Its lights flood him only once it is close.
        assert!(story.compose(29.0).cross_car[0] < CAR_STOP - 10.0);
        let mut nearest = f32::MAX;
        for i in 0..1920 {
            let t = i as f32 * 0.05;
            let f = story.compose(t);
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
        assert!(nearest > 0.9, "{nearest}");
        assert!(nearest < 1.8, "{nearest}");
    }

    #[test]
    fn the_car_turns_into_the_traffic() {
        let story = Story::new(Chapter::Check);
        assert!((CAR_GO[0]..=CAR_GO[1]).contains(&story.car_go));
        let [x, _, yaw, on] = story.compose(80.0).cross_car;
        assert!((x + CAR_LANE).abs() < 1e-4 && yaw.abs() < 1e-4 && on > 0.99);
        // It drives off at the traffic's pace.
        let a = story.compose(80.0).cross_car[1];
        let b = story.compose(81.0).cross_car[1];
        let pace = CARS[0][1] * REPEAT / LOOP
            * (world_time(Chapter::Check, 81.0) - world_time(Chapter::Check, 80.0));
        assert!((b - a - pace).abs() < 0.05, "{} {pace}", b - a);
        // Its heading turns smoothly, never back.
        let mut last = 0.5 * PI;
        for i in 0..400 {
            let yaw = story.cross_car(story.car_go + i as f32 * 0.02)[2];
            assert!(yaw <= last + 1e-5 && last - yaw < 0.08, "{i}");
            last = yaw;
        }
    }
}
