//! Page 10's loop as numbers: one day of one man through the house.
//!
//! The beats (story seconds; the prototype's beats list follows them):
//! 0–21     the house on the lacquer table at dawn; the camera comes into
//!          his kitchen: the argument (his second ring trembles); she pours
//!          his tea; he sips, the ring steadies; he pushes his chair back
//!          and steps clear of the table;
//! 21–46    the lift down, the kerb; the tram brakes and honks: the sphere
//!          flashes;
//! 46–83    he boards; his eyes: the house slides by; the tram leaves to the
//!          right, and while it has him the day runs fast (the sun swings
//!          past noon, shadows sweep the street, clouds race, the rooms'
//!          lights come and go: a couple of hours); it comes back from the
//!          left; he gets off;
//! 83–110   to the house: he leans his back on the wall by the door, rests,
//!          speaks into his phone held before him, then listens with it at
//!          his ear (circles from his lips to the phone, from it to his ear);
//! 110–143  the shop: the queue through his eyes (eased in and out); the
//!          coin slips and falls slowly (the third ring whips round), he
//!          picks it up, pays, the loaf;
//! 143–184  home with the bread; the child trips with her cup: the world
//!          slows, he catches it;
//! 184–247  up the inner stair to his desk (the camera on him): his eyes on
//!          the screen, the call, the deadlines, work again; he shuts the
//!          laptop, sits back, speaks his day aloud, listens; evening;
//! 247–306  down and out: he takes his bicycle from the lamp's post, rides
//!          out on the right; while he is away the evening runs fast; back
//!          in from the left, he leans it on the post again;
//! 306–321  back to the wall by his door: he leans on it, speaks, listens;
//! 321–345  night: the house goes to sleep window by window; the rings come
//!          back to him one by one;
//! 345–349  they meet at his heart and strike together;
//! 349–362  the line of his day runs through the dark house, each place
//!          lights and he is there again as he was;
//! 362–372  the sphere takes in the whole house, the walls melt, the
//!          lacquer turns to water;
//! 372–378  a drop of light falls from the globe's crown and meets its
//!          reflection rising out of the water: the rings strike, the axis
//!          lights from the water up to the crown and down through the
//!          reflection, a ring runs out over the water;
//! 378–394  the camera goes under: the world shines down through the
//!          surface, the globe's reflection hangs below, shafts of light,
//!          motes; it sinks deep and looks up;
//! 394–402  dawn: it rises out of the water, the house comes back.
use crate::cast::{
    at_shop, Cast, Held, Keys, BIKE_AWAY, DESK_LISTEN, DESK_SPAN, DESK_SPEAK, DOOR_WALL, HERO,
    WALL_SPAN,
};
use crate::house::{cell, lamp_at, TABLE};
use crate::math::{mix, monotone, pulse, smooth, v3, window, window_integral, V3, Y};
use crate::props;
use crate::{Chapter, FINALE, LAMPS, LOOP, PATH_POINTS};
use std::f32::consts::{PI, TAU};

pub use crate::cast::Figure;
use crate::house::Prim;

/// The finale starts when he stands still by the lamp.
const F: f32 = LOOP - FINALE;

/// The neighbours' windows go dark one after another from here, this far
/// apart; his family's last.
const SLEEP: f32 = F + 2.0;
const SLEEP_GAP: f32 = 0.7;
const SLEEP_ORDER: [usize; 11] = [
    cell::room(1, 0),
    cell::room(2, 0),
    cell::room(1, 1),
    cell::room(2, 2),
    cell::room(2, 1),
    cell::room(1, 2),
    cell::room(1, 4),
    cell::ROOF,
    cell::room(2, 3),
    cell::room(1, 3),
    cell::room(2, 4),
];

/// The rings fade from him, then come back one by one, the first here,
/// `RING_GAP` apart; then they come together at his heart.
const RINGS_IN: f32 = F + 12.0;
const RING_GAP: f32 = 3.0;
const SYNC: f32 = F + 20.5;

/// The rings strike together here.
pub const CHORD: f32 = F + 24.5;

/// The line of his day is drawn through the dark house from here, over
/// `LINE_SPAN`; an echo of him lights at each place as it gets there.
const LINE: f32 = F + 28.0;
const LINE_SPAN: f32 = 12.0;

/// The sphere grows over the whole house from here.
const GROW: f32 = F + 41.5;

/// The lacquer turns to water as the walls melt.
const LIQUID: f32 = F + 44.0;

/// A drop of light falls from the globe's crown down its axis and meets
/// its reflection rising out of the water `DROP_FALL` later; a ring runs
/// out over the water from there at `DROP_SPEED` (shaders get both).
pub const DROP: f32 = F + 51.5;
pub const DROP_FALL: f32 = 2.4;
pub const DROP_SPEED: f32 = 8.0;

/// The house comes back from here, at dawn, after the water.
const DAWN: f32 = LOOP - 8.0;

/// Reduced motion holds this moment: the night house with the line of his
/// day drawn through it, every place of it lit and him at each, the rings
/// together round him at the lamp.
pub const STILL: f32 = F + 39.5;

/// One breath: in for `INHALE` s, out for the rest of `BREATH`.
pub const BREATH: f32 = 4.0;
pub const INHALE: f32 = 1.6;
pub const HEART: f32 = 60.0 / 66.0;

/// The route's beads (the six places) at the end of `route`.
pub const BEADS: usize = 6;
pub const ROUTE: usize = PATH_POINTS - BEADS;

/// The sphere round him (Step 7's three rings, as on pages 06–08): its
/// centre `SPHERE_Y` over the floor under him, its radius. The first ring
/// runs over its glass from the top to the floor and back, the second
/// round his body from the soles to the crown and back, both in
/// `RING_PERIOD` and in turn; the third, a meridian, turns once in
/// `MERIDIAN_PERIOD`.
pub const SPHERE_R: f32 = 1.45;
pub const SPHERE_Y: f32 = 0.95;
pub const RING_PERIOD: f32 = 8.0;
pub const MERIDIAN_PERIOD: f32 = 16.0;
pub const SECOND_RING_R: f32 = 0.42;
const SECOND_RING: [f32; 2] = [0.04, 1.8];
/// How plainly the rings show, from inside the sphere and from well out.
const SPHERE_SEEN: [f32; 2] = [0.35, 1.0];
/// In the finale the sphere grows into a globe over the whole house: its
/// centre on the table, its radius.
const GLOBE: V3 = v3(0.0, TABLE, -0.5);
const GLOBE_R: f32 = 20.0;

/// The slow fall of the cup: story time runs `1 - SLOW` as fast for
/// `SLOW_SPAN` round the catch, a little faster elsewhere to keep the loop.
const SLOW: f32 = 0.72;

/// His own eyes: how far in front of his head's middle, and the lens.
const POV_AHEAD: f32 = 0.14;
const POV_LENS: f32 = 1.6;

/// A camera key: when (story time), the eye, where it looks, the lens and
/// the aperture; `rel` 1 keys the eye and the look from the point under
/// him; `pov` 1 puts the eye in his head (the look stays the key's).
#[derive(Clone, Copy, Debug)]
struct Key {
    at: f32,
    eye: V3,
    look: V3,
    lens: f32,
    aperture: f32,
    rel: f32,
    pov: f32,
}

fn key(at: f32, eye: V3, look: V3, lens: f32, aperture: f32, rel: f32) -> Key {
    Key {
        at,
        eye,
        look,
        lens,
        aperture,
        rel,
        pov: 0.0,
    }
}

pub struct Story {
    cast: Cast,
    shots: Vec<Key>,
    route: [[f32; 4]; PATH_POINTS],
    slow_from: f32,
    /// From his tram's going out of sight to its coming back: the day runs
    /// fast in between.
    away: (f32, f32),
    /// From his riding out of the frame on the right to his coming back
    /// in from the left: the sun goes down in between.
    dusk: (f32, f32),
    /// He at each of the first five places of his day, as he was there.
    echoes: Vec<Figure>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub story: f32,
    pub eye: V3,
    pub right: V3,
    pub up: V3,
    pub forward: V3,
    pub lens: f32,
    pub focus: f32,
    pub aperture: f32,
    /// Toward the sun, and how much of it there is.
    pub sun: V3,
    pub sun_amount: f32,
    /// The sky's light, the sunset's warmth, the night, the table's gloss.
    pub day: [f32; 4],
    pub lamps: [f32; LAMPS],
    /// The point under him.
    pub hero: V3,
    /// The sphere: its centre and radius.
    pub sphere: [f32; 4],
    /// The first ring's height, the second's, the meridian's turn, how
    /// plainly they show.
    pub rings: [f32; 4],
    /// How much of each ring shows (first, second, third) and the glass.
    pub ring_vis: [f32; 4],
    /// Each ring's flash (the world, his body, the step) and the floor the
    /// sphere stands on.
    pub ring_fx: [f32; 4],
    /// His head and how much the eye is his own.
    pub pov: [f32; 4],
    /// The three striking together: the flash, how long since, 0, 0.
    pub chord: [f32; 4],
    /// The line of his day: how much is drawn, its light, the beads, 0.
    pub path: [f32; 4],
    /// How far the walls have melted, the reflection, 0, 0.
    pub melt: [f32; 4],
    /// Deadlines over his desk: how many, 0, 0, 0; where.
    pub sparks: [f32; 4],
    pub spark_to: [f32; 4],
    /// His screen's glow, the desk lamp, how much he has typed, the bad
    /// news.
    pub desk: [f32; 4],
    /// The tram: its middle, its doors, its lights, 0.
    pub tram: [f32; 4],
    /// Story time, how slow it runs, the lift's floor, its speed.
    pub motion: [f32; 4],
    /// The child's cup and how slow the world is round it.
    pub cup: [f32; 4],
    /// The tea's steam: where, how much.
    pub steam: [f32; 4],
    /// The tram's honk: where, how loud.
    pub honk: [f32; 4],
    /// His coin: where, its glint.
    pub coin: [f32; 4],
    /// The lift's cage: its floor, its speed, 0, 0.
    pub lift: [f32; 4],
    /// His voice: the mouth and how much he speaks, its way and reach,
    /// where it comes back and how much he listens, those rings' sizes.
    pub voice: [[f32; 4]; 4],
    /// The water: the eye under it (0 or 1), how liquid the lacquer, how
    /// deep the eye, since the drop met its reflection.
    pub water: [f32; 4],
    pub route: [[f32; 4]; PATH_POINTS],
    /// The tram's primitives and everything else that moves.
    pub movers: [Vec<Prim>; 2],
    pub figures: Vec<Figure>,
}

/// The heart: a thump and a softer one after, 0 … 1.
pub fn heartbeat(t: f32, period: f32) -> f32 {
    let s = t.rem_euclid(period);
    let thump = |d: f32| {
        if d < 0.0 {
            0.0
        } else {
            (d / 0.035).min(1.0) * (-d / 0.11).exp()
        }
    };
    (thump(s) + 0.6 * thump(s - 0.28)).min(1.0)
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

/// The rings of a sphere centred `c`, `r` wide, standing on `floor`, round
/// a man whose feet are at `feet`, seen from `eye`: the first ring's height,
/// the second's, the meridian's turn, how plainly they show.
pub fn rings_at(t: f32, c: V3, r: f32, floor: f32, feet: f32, eye: V3) -> [f32; 4] {
    // The first ring: from near the top (polar angle 0.35) down to where
    // the glass meets the floor, and back.
    let ground = (-(c.y - floor) / r).clamp(-1.0, 1.0).acos();
    let swing = 0.5 - 0.5 * (TAU * t / RING_PERIOD).cos();
    let first = c.y + r * mix(0.35, ground - 0.02, swing).cos();
    // The second: up while the first goes down.
    let second = feet + mix(SECOND_RING[0], SECOND_RING[1], 1.0 - swing);
    let third = (TAU * t / MERIDIAN_PERIOD).rem_euclid(TAU);
    let away = (eye - c).length();
    let seen = mix(
        SPHERE_SEEN[0],
        SPHERE_SEEN[1],
        smooth(r + 0.1, r + 0.7, away),
    );
    [first, second, third, seen]
}

/// `a` turned toward `b` by `k` the short way round.
fn turn_toward(a: f32, b: f32, k: f32) -> f32 {
    let d = (b - a + PI).rem_euclid(TAU) - PI;
    (a + k * d).rem_euclid(TAU)
}

/// The six places of his day: the kitchen, the street, the shop, the
/// child's room, the study, the wall by his door at the end of it.
fn bead_times(k: &Keys) -> [f32; BEADS] {
    [
        k.sip,
        k.rails,
        k.queue + 4.0,
        k.catch,
        k.desk + 3.0,
        k.rest + 0.5,
    ]
}

/// The cell each place lights when the line of his day reaches it.
const BEAD_CELLS: [usize; BEADS] = [
    cell::room(1, 3),
    cell::STREET_L,
    cell::room(1, 0),
    cell::room(2, 3),
    cell::room(2, 4),
    cell::STREET_L,
];

/// How much more of the day's clock (in story seconds) runs by while the
/// tram has him away (an hour or two in all), and while his ride has him
/// out of the frame (the sun goes down meanwhile).
const AWAY_DAY: f32 = 35.0;
const AWAY_EVE: f32 = 30.0;

/// One slow cloud passing over the sun in a stretch of fast time `a … b`:
/// 0 clear … 1 at its thickest, once, in the middle.
fn passing(s: f32, a: f32, b: f32) -> f32 {
    if s <= a || s >= b {
        return 0.0;
    }
    let x = (s - a) / (b - a);
    (PI * x).sin().powi(2)
}

/// The hour on the street's clock (0 … 24 and on): half past seven as he
/// sips his tea, the minute hand going round in a story minute and a half
/// an hour, two hours more while the tram has him away, an hour and a
/// half while his ride does; over the night (the house gone) it comes
/// round to the morning's hour again.
const CLOCK_START: f32 = 7.0;
const CLOCK_RATE: f32 = 0.03;
const CLOCK_TRAM: f32 = 2.0;
const CLOCK_RIDE: f32 = 1.5;
/// How much faster the clouds go while the day runs fast.
const SKY_TRAM: f32 = 50.0;
const SKY_RIDE: f32 = 40.0;

/// How present he is, 0 … 1. The day wears the sphere down: it narrows
/// and pales. Speaking his day aloud and hearing it back fills it out
/// again, a breath more than full, then it settles.
fn presence(s: f32, k: &Keys) -> f32 {
    let (w, d, w2) = (k.wall, k.desk, k.wall2);
    // (worn from, speaks, listens, done, how low it got)
    let spans = [
        (k.rise, w + 2.6, w + 8.9, w + 13.5, 0.5),
        (
            w + 13.5,
            d + DESK_SPEAK[0],
            d + DESK_LISTEN[0],
            d + DESK_LISTEN[1],
            0.42,
        ),
        (d + DESK_LISTEN[1], w2 + 3.4, w2 + 8.8, w2 + 13.3, 0.5),
    ];
    let mut p = 1.0;
    for (from, speak, listen, done, low) in spans {
        if s < from {
            break;
        }
        p = if s < speak {
            mix(1.0, low, smooth(from, speak, s))
        } else {
            let back = 0.55 * smooth(speak, listen - 0.4, s) + 0.45 * smooth(listen, done, s);
            mix(low, 1.0, back) + 0.12 * window(s, done - 1.5, done + 0.5, done + 1.0, done + 5.0)
        };
    }
    p
}

/// How the presence shows: the sphere's size, how plainly it and its rings
/// show.
pub fn presence_size(p: f32) -> f32 {
    0.7 + 0.3 * p
}
pub fn presence_seen(p: f32) -> f32 {
    0.2 + 0.8 * p
}

/// How much of the line of his day is drawn.
fn drawn(s: f32) -> f32 {
    smooth(LINE, LINE + LINE_SPAN, s) * (1.0 - smooth(DAWN, DAWN + 3.0, s))
}

impl Story {
    pub fn new(_chapter: Chapter) -> Story {
        let cast = Cast::new();
        let k = cast.keys;
        let slow_from = (k.catch + SLOW) / (1.0 + 2.0 * SLOW / LOOP) - 1.2;
        let shots = shots(&k, &cast);
        let route = route(&cast);
        let echoes = bead_times(&k)
            .iter()
            .take(BEADS - 1)
            .map(|&t| cast.moment(t, 0.5).figures[HERO].clone())
            .collect();
        let away = (cast.world.tram.go1 + 6.5, cast.world.tram.back - 1.0);
        let dusk = (k.gone + 0.5, k.gone + BIKE_AWAY - 0.5);
        Story {
            cast,
            shots,
            route,
            slow_from,
            away,
            dusk,
            echoes,
        }
    }

    pub fn loop_seconds(&self) -> f32 {
        LOOP
    }

    pub fn keys(&self) -> Keys {
        self.cast.keys
    }

    /// Story time at loop time `t`: the world slows round the catch.
    pub fn story_time(&self, t: f32) -> f32 {
        let a = self.slow_from;
        t * (1.0 + 2.0 * SLOW / LOOP) - SLOW * window_integral(t, a, a + 0.4, a + 2.0, a + 2.4)
    }

    /// Where the camera holds him: his anchor averaged over a moment
    /// either side, so the camera eases in and out where he starts and
    /// stops (and over his steps) rather than jerking with them.
    fn steady(&self, s: f32) -> V3 {
        const N: i32 = 4;
        const SPAN: f32 = 0.75;
        let plan = &self.cast.plans[HERO];
        let world = &self.cast.world;
        let mut sum = v3(0.0, 0.0, 0.0);
        let mut weights = 0.0;
        let here = plan.anchor(s, world);
        for i in -N..=N {
            let w = (N + 1 - i.abs()) as f32;
            let dt = SPAN * i as f32 / N as f32;
            let p = plan.anchor(s + dt, world);
            // Across a cut (he is elsewhere at once) only this side counts.
            let p = if (p - here).length() > 1.0 + 7.0 * dt.abs() {
                here
            } else {
                p
            };
            sum = sum + p * w;
            weights += w;
        }
        sum * (1.0 / weights)
    }

    fn slowness(&self, t: f32) -> f32 {
        let a = self.slow_from;
        window(t, a, a + 0.4, a + 2.0, a + 2.4)
    }

    pub fn compose(&self, t: f32) -> Frame {
        let t = t.rem_euclid(LOOP);
        let s = self.story_time(t);
        let k = self.cast.keys;
        let d = k.desk;
        let q = k.queue;
        let world = &self.cast.world;
        // His breath quickens in the argument, on the call and in the run.
        let hurried = window(s, 1.0, 2.0, k.sip, k.rise)
            + window(s, d + 5.5, d + 6.5, d + 13.5, d + 15.0)
            + window(s, k.go, k.go + 2.0, k.wall2 + 3.0, k.wall2 + 6.0);
        let b = breath(s * (1.0 + 0.6 * hurried.min(1.0)));
        let moment = self.cast.moment(s, b);
        let held: Held = moment.held;
        let mut figures = moment.figures;
        // In the finale the others go and only his way is left; they are
        // back at dawn. He himself is gone over the night's end and in his
        // kitchen again as the day starts.
        // He goes into the code with the house as its level passes down
        // him (the shader takes him away above it).
        let others =
            (1.0 - smooth(CHORD + 0.5, CHORD + 3.0, s)) + smooth(DAWN + 3.0, DAWN + 6.0, s);
        let his = smooth(0.0, 1.5, s) * (1.0 - smooth(GROW + 8.0, GROW + 8.8, s));
        for (i, f) in figures.iter_mut().enumerate() {
            f.seen *= if i == HERO { his } else { others.min(1.0) };
        }

        // The camera.
        let hero = self.cast.plans[HERO].anchor(s, world);
        let held_on = self.steady(s);
        let curve = |pick: fn(&Key) -> f32| -> f32 {
            let keys: Vec<(f32, f32)> = self.shots.iter().map(|k| (k.at, pick(k))).collect();
            monotone(&keys, s)
        };
        let rel = curve(|k| k.rel);
        let pov = curve(|k| k.pov).clamp(0.0, 1.0);
        let body = &figures[HERO].body;
        let own = body.head + body.face.forward * POV_AHEAD + body.face.up * 0.03;
        let keyed = v3(curve(|k| k.eye.x), curve(|k| k.eye.y), curve(|k| k.eye.z)) + held_on * rel;
        let eye = keyed.lerp(own, pov);
        let look = v3(
            curve(|k| k.look.x),
            curve(|k| k.look.y),
            curve(|k| k.look.z),
        ) + held_on * rel;
        let lens = curve(|k| k.lens);
        let aperture = curve(|k| k.aperture).max(0.0);
        let forward = (look - eye).normalize();
        let right = forward.cross(Y).normalize();
        let up = right.cross(forward);
        let focus = (look - eye).length().max(0.3);

        // The day: dawn, noon, the golden hour, sunset, night, dawn. The
        // evening sun sets low in front, a little left, down the street he
        // rides along. While the tram has him away the day runs fast: the
        // sun swings from morning to past noon, the shadows sweep the
        // street, clouds race over, the rooms' lights come and go.
        let (away, home) = self.away;
        let (b0, b1) = self.dusk;
        let dusk = smooth(b0, b1, s);
        let noon = smooth(away, home, s);
        let u = if s < F {
            ((s + AWAY_DAY * noon + AWAY_EVE * dusk) / (F + AWAY_DAY + AWAY_EVE)).clamp(0.0, 1.0)
        } else {
            1.0 - smooth(F + 4.0, DAWN + 4.0, s)
        };
        let az = 1.15 - 1.6 * u;
        let el = 0.05 + 0.85 * (PI * u).sin();
        let sun = v3(az.sin() * el.cos(), el.sin(), az.cos() * el.cos());
        // One slow cloud over the sun in each stretch of fast time, not a
        // flicker of days.
        let clouds = 0.55 * (passing(s, away, home) + passing(s, b0, b1));
        // Every light comes back to its dawn value at the loop's end.
        // The sun goes down while his ride has him away; the last of the
        // light goes as he stands by his door.
        let sun_amount = (smooth(-2.0, 8.0, s)
            * (1.0 - 0.8 * dusk - 0.2 * smooth(F - 8.0, F + 1.0, s))
            + smooth(-2.0, 8.0, s - LOOP))
            * (1.0 - 0.6 * clouds);
        let sky = ((0.25 + 0.75 * smooth(0.0, 12.0, s))
            * (1.0 - 0.45 * dusk - 0.4 * smooth(F - 8.0, F + 4.0, s))
            + 0.1 * smooth(DAWN + 1.0, DAWN + 8.0, s))
            * (1.0 - 0.2 * clouds);
        let morning = 0.55 * (1.0 - smooth(6.0, 22.0, s) + smooth(DAWN + 3.0, DAWN + 8.0, s));
        let golden = window(s, k.take - 25.0, k.take - 8.0, b0 + 2.0, b1).max(morning);
        let night =
            (0.4 * dusk + 0.6 * smooth(F - 5.0, F + 4.0, s)) * (1.0 - smooth(DAWN, DAWN + 6.0, s));
        let gloss = window(s, LINE, LINE + 4.0, DAWN + 2.0, DAWN + 7.0);
        let day = [sky, golden, night, gloss];
        let path_drawn = drawn(s);
        let lamps = lamps(s, &k, &self.route, path_drawn, dusk);
        // The line reaches each place of his day and he is there again, as
        // he was, in the places the others have left; the echoes go as the
        // sphere takes in the whole house.
        for (b, echo) in self.echoes.iter().enumerate() {
            let at = self.route[ROUTE + b][3];
            let seen =
                smooth(at - 0.01, at + 0.05, path_drawn) * (1.0 - smooth(GROW, GROW + 3.0, s));
            if seen > 0.0 && others <= 0.0 {
                let slot = &mut figures[HERO + 1 + b];
                *slot = echo.clone();
                slot.seen = 0.85 * seen;
                slot.accent = 1.0;
            }
        }

        // The sphere and its rings, round his body (not where his feet are
        // planned: seated, his body sits back from them). Worn down over
        // the day, filled out again when he speaks his day and hears it.
        let feet = hero;
        let grow = smooth(GROW, GROW + 6.0, s);
        let present = presence(s, &k);
        let shown = presence_seen(present);
        let pelvis = figures[HERO].body.pelvis;
        let his_c = v3(pelvis.x, feet.y + SPHERE_Y, pelvis.z);
        let c = his_c.lerp(GLOBE, grow);
        let r = mix(SPHERE_R * presence_size(present), GLOBE_R, grow);
        let floor = mix(feet.y, TABLE, grow);
        let mut rings = rings_at(s, c, r, floor, feet.y, eye);
        // The step's ring whips round when something falls.
        let coin_at = at_shop(q, 2.9);
        let fall_at = k.catch - 0.55;
        rings[2] = (rings[2]
            + TAU * (smooth(coin_at, coin_at + 1.0, s) + smooth(fall_at, fall_at + 1.0, s)))
        .rem_euclid(TAU);
        // At night they come together round him: the first and the second
        // at his heart, the meridian square to the eye, a circle round him.
        let sync = smooth(SYNC, SYNC + 3.0, s) * (1.0 - smooth(GROW, GROW + 2.5, s));
        let heart = feet.y + 1.3;
        rings[0] = mix(rings[0], heart, sync);
        rings[1] = mix(rings[1], heart, sync);
        let to = c - eye;
        rings[2] = turn_toward(rings[2], to.z.atan2(to.x), sync);
        rings[3] *= his.max(grow) * (1.0 - smooth(DAWN + 3.5, DAWN + 6.5, s));
        // At night they leave him, then come back one by one.
        let back = |i: usize| {
            let at = RINGS_IN + RING_GAP * i as f32;
            1.0 - 0.85 * window(s, F + 8.5, F + 10.0, at, at + 1.5)
        };
        let arrive = |i: usize| 0.7 * pulse(s - RINGS_IN - RING_GAP * i as f32 - 0.75);
        // His own eyes see the glass and his own ring least. Over the
        // globe only the first ring is left: the meridian would stand in it
        // as a second dome.
        let ring_vis = [
            (1.0 - 0.5 * pov) * back(0) * shown,
            (1.0 - 0.8 * pov) * (1.0 - grow) * back(1) * shown,
            (1.0 - 0.5 * pov) * back(2) * shown * (1.0 - grow),
            (1.0 - 0.6 * pov) * (1.0 + 2.0 * grow) * shown,
        ];
        // As he speaks and listens the rings glow up, with his breath.
        let (w, w2) = (k.wall, k.wall2);
        let filling = (window(s, w + 2.6, w + 3.4, w + 13.5, w + 15.5)
            + window(
                s,
                d + DESK_SPEAK[0],
                d + DESK_SPEAK[0] + 0.8,
                d + DESK_LISTEN[1],
                d + DESK_LISTEN[1] + 2.0,
            )
            + window(s, w2 + 3.4, w2 + 4.2, w2 + 13.3, w2 + 15.3))
            * (0.25 + 0.15 * b);
        let chord = pulse(s - CHORD) + 0.4 * pulse(s - CHORD - 0.9);
        // The three strike once more as the drop meets its reflection.
        let met = pulse(s - DROP - DROP_FALL);
        let hb = heartbeat(s, HEART * (1.0 - 0.25 * hurried.min(1.0)));
        // The world touches the sphere (the horn); the argument and the
        // call shake his body's ring; what falls flashes the step's.
        let tremble = window(s, 1.0, 2.0, k.pour + 0.5, k.sip + 2.0)
            + 0.8 * window(s, d + 5.5, d + 6.5, d + 13.5, d + 14.5);
        let ring_fx = [
            pulse(s - k.honk) + chord + arrive(0) + met + filling,
            tremble + 0.25 * hb * hurried.min(1.0) + chord + arrive(1) + met + filling,
            (pulse(s - coin_at).max(pulse(s - fall_at)) + chord + arrive(2) + met + filling)
                * (1.0 - grow),
            floor,
        ];

        // The line of his day.
        let path = [
            path_drawn,
            0.6 + 0.6 * chord,
            smooth(LINE + 0.5, LINE + LINE_SPAN + 0.5, s) * (1.0 - smooth(DAWN, DAWN + 3.0, s)),
            0.0,
        ];
        // The finale's level sweeps the whole house into its code, top to
        // bottom (and builds it back at dawn); inside his sphere through the
        // day things show their code as plainly as the sphere shows.
        let melt = [
            window(s, GROW + 1.5, GROW + 9.5, DAWN + 1.0, DAWN + 5.0),
            gloss,
            0.8 * shown * (1.0 - 0.7 * pov) * (1.0 - grow),
            0.0,
        ];

        // The desk: the screen, the lamp, what he has typed, the call's news.
        let desk_on = window(s, d - 2.0, d, d + 19.5, d + 21.0);
        let lamp = window(s, d - 2.0, d, d + 32.0, d + 33.5);
        let typed = 0.5 * smooth(d + 0.9, d + 4.6, s) + 0.5 * smooth(d + 14.8, d + 18.2, s);
        let news = window(s, d + 6.0, d + 7.0, d + 14.0, d + 16.0);
        let desk = [desk_on * (1.0 - held.lid), lamp, typed, news];
        let sparks = [
            desk_on * window(s, d + 9.5, d + 11.0, d + 14.0, d + 15.5),
            0.0,
            0.0,
            0.0,
        ];
        let spark_to = [5.3, 13.55, -4.55, 0.0];
        let tc = world.tram_c(s);
        let doors = world.tram_doors(s);
        let tram = [tc, doors, 1.0, 0.0];
        let ly = world.lift_y(s);
        let lift = [ly, world.lift_moving(s), 0.0, 0.0];
        let slow = self.slowness(t);
        // The sky's own time (its clouds hurry while the day runs fast and
        // drift back over the night) and the street clock's hour.
        let night_back = smooth(GROW + 8.0, DAWN, s);
        let sky_time = s + SKY_TRAM * noon + SKY_RIDE * dusk
            - (SKY_TRAM + SKY_RIDE) * smooth(F + 4.0, DAWN, s);
        let hours = mix(
            CLOCK_START + CLOCK_RATE * s + CLOCK_TRAM * noon + CLOCK_RIDE * dusk,
            CLOCK_START + 24.0,
            night_back,
        );
        let motion = [s, slow, sky_time, hours];
        let cup = [held.kid_cup.x, held.kid_cup.y, held.kid_cup.z, slow];
        let steam_at = held.cup + v3(0.0, 0.12, 0.0);
        let steam = [
            steam_at.x,
            steam_at.y,
            steam_at.z,
            window(s, k.pour + 0.3, k.pour + 1.0, k.rise + 2.0, k.rise + 6.0),
        ];
        let honk_at = v3(tc + 4.7, 1.4, 4.3);
        let honk = [
            honk_at.x,
            honk_at.y,
            honk_at.z,
            window(s, k.honk - 0.05, k.honk, k.honk + 0.7, k.honk + 1.6),
        ];
        let coin = [
            held.coin.x,
            held.coin.y,
            held.coin.z,
            window(s, coin_at, coin_at + 0.1, at_shop(q, 4.3), at_shop(q, 4.8)),
        ];

        let voice = self.cast.voice(s, &figures[HERO].body, held.phone);
        // The water: the eye under it, how liquid the lacquer, how deep
        // the eye, since the drop met its reflection.
        let water = [
            if eye.y < TABLE { 1.0 } else { 0.0 },
            smooth(LIQUID, LIQUID + 4.0, s) * (1.0 - smooth(DAWN + 1.0, DAWN + 5.0, s)),
            (TABLE - eye.y).max(0.0),
            (s - DROP - DROP_FALL).clamp(-99.0, 99.0),
        ];
        let movers = [props::tram(tc, doors), props::movers(s, world, &held)];
        let head = figures[HERO].body.head;
        Frame {
            time: t,
            story: s,
            eye,
            right,
            up,
            forward,
            lens,
            focus,
            aperture,
            sun,
            sun_amount,
            day,
            lamps,
            hero,
            sphere: [c.x, c.y, c.z, r],
            rings,
            ring_vis,
            ring_fx,
            pov: [head.x, head.y, head.z, pov],
            chord: [chord, (s - CHORD).clamp(-99.0, 99.0), 0.0, 0.0],
            path,
            melt,
            sparks,
            spark_to,
            desk,
            tram,
            motion,
            cup,
            steam,
            honk,
            coin,
            lift,
            voice,
            water,
            route: self.route,
            movers,
            figures,
        }
    }
}

/// Each cell's lamp, 0 … 1: the day's, and the places of his day lit one
/// by one as the line reaches them.
fn lamps(s: f32, k: &Keys, route: &[[f32; 4]; PATH_POINTS], drawn: f32, dusk: f32) -> [f32; LAMPS] {
    let mut l = [0.0; LAMPS];
    let end = 1.0 - smooth(DAWN + 1.0, DAWN + 6.0, s);
    let evening = dusk * end;
    // Dawn at the start, and again at the end coming round to it.
    let dawn = (1.0 - smooth(4.0, 9.0, s)).max(smooth(LOOP - 5.0, LOOP - 0.5, s));
    for floor in 0..crate::house::FLOORS {
        l[cell::room(0, floor)] = 0.55;
    }
    l[cell::room(1, 0)] = 1.0;
    l[cell::room(2, 0)] = 0.9;
    l[cell::room(1, 1)] = 0.8;
    l[cell::room(2, 1)] = 0.6;
    l[cell::room(1, 2)] = 0.3 + 0.5 * evening;
    l[cell::room(2, 2)] = 0.7;
    l[cell::room(1, 3)] = (dawn + window(s, 0.0, 0.1, 25.0, 30.0))
        .min(1.0)
        .max(evening);
    l[cell::room(2, 3)] = (0.6 * dawn).max(evening);
    l[cell::room(1, 4)] = 0.4 * evening;
    let d = k.desk;
    l[cell::room(2, 4)] = window(s, d - 3.0, d - 1.0, d + 32.5, d + 35.0).max(evening);
    l[cell::ROOF] = 0.6 * evening;
    let street = dawn.max(smooth(0.3, 0.6, dusk) * end);
    for c in [cell::STREET_L, cell::STREET_M, cell::STREET_R] {
        l[c] = street;
    }
    l[cell::TRAM] = 1.0;
    // The house goes to sleep round him; the stair's lights dim last.
    for (i, &c) in SLEEP_ORDER.iter().enumerate() {
        let at = SLEEP + SLEEP_GAP * i as f32;
        l[c] *= 1.0 - 0.85 * smooth(at, at + 0.8, s) * end;
    }
    let stair = 1.0 - 0.55 * smooth(F + 9.5, F + 11.0, s) * end;
    for floor in 0..crate::house::FLOORS {
        l[cell::room(0, floor)] *= stair;
    }
    for (b, &c) in BEAD_CELLS.iter().enumerate() {
        let f = route[ROUTE + b][3];
        let lit = smooth(f - 0.01, f + 0.04, drawn) * end;
        l[c] = (l[c] + lit).min(1.4);
    }
    l
}

/// The camera through the day.
fn shots(k: &Keys, cast: &Cast) -> Vec<Key> {
    let world = &cast.world;
    let wide = |at: f32| key(at, v3(0.0, 7.4, 31.0), v3(0.0, 6.4, 0.0), 2.0, 0.0, 0.0);
    let fixed = |at: f32, eye: V3, look: V3, lens: f32, aperture: f32| {
        key(at, eye, look, lens, aperture, 0.0)
    };
    let follow = |at: f32, eye: V3, look: V3, lens: f32| key(at, eye, look, lens, 0.004, 1.0);
    // His eyes: the look keyed in the world, the eye's key near his head
    // (it only matters while the camera moves in).
    let eyes = |at: f32, near: V3, look: V3| Key {
        pov: 1.0,
        ..key(at, near, look, POV_LENS, 0.003, 0.0)
    };
    // His eyes keyed from the point under him, as he rides.
    let eyes_riding = |at: f32, look: V3| Key {
        pov: 1.0,
        ..key(at, v3(0.0, 1.62, 0.0), look, POV_LENS, 0.002, 1.0)
    };
    let (q, d, f) = (k.queue, k.desk, F);
    let (w, w2) = (k.wall, k.wall2);
    // The wall by his door, under where he stands.
    let a = v3(DOOR_WALL[0], 0.0, DOOR_WALL[1]);
    let coin_at = at_shop(q, 2.9);
    let go1 = world.tram.go1;
    let ride_in = k.gone + BIKE_AWAY;
    let stop2 = world.tram.stop2;
    let mut v = vec![
        wide(0.0),
        // Into his kitchen: she at the stove, he at the table.
        fixed(2.5, v3(-1.2, 10.4, 16.0), v3(-2.6, 9.9, -2.8), 2.0, 0.0),
        fixed(5.0, v3(-2.2, 10.7, 5.2), v3(-2.9, 9.95, -3.2), 2.1, 0.003),
        fixed(
            k.kettle - 0.5,
            v3(-2.6, 10.6, 4.4),
            v3(-3.0, 9.95, -3.3),
            2.1,
            0.003,
        ),
        // She brings the kettle along the counter.
        fixed(
            k.pour - 2.6,
            v3(-1.7, 10.5, 3.0),
            v3(-1.9, 9.95, -3.4),
            2.2,
            0.004,
        ),
        // The tea: close, over his shoulder, her face behind the stream.
        fixed(
            k.pour - 0.5,
            v3(-0.45, 10.3, -1.0),
            v3(-1.35, 9.85, -3.35),
            2.5,
            0.007,
        ),
        fixed(
            k.pour + 1.6,
            v3(-0.55, 10.28, -1.1),
            v3(-1.35, 9.85, -3.35),
            2.5,
            0.007,
        ),
        // His face as he drinks; the ring steadies.
        fixed(
            k.sip,
            v3(-2.6, 10.25, -1.25),
            v3(-1.2, 10.15, -3.0),
            2.4,
            0.006,
        ),
        fixed(
            k.rise - 0.3,
            v3(-2.75, 10.3, -1.05),
            v3(-1.2, 10.2, -3.0),
            2.4,
            0.006,
        ),
        // Out by the near side of the table to the lift, and down.
        follow(k.rise + 1.4, v3(1.8, 1.9, 6.0), v3(-0.6, 1.0, -0.8), 2.1),
        follow(k.press, v3(1.6, 1.7, 6.2), v3(-0.3, 1.1, -0.5), 2.1),
        follow(k.lift0 + 4.0, v3(0.7, 1.4, 5.4), v3(0.0, 1.1, 0.0), 2.1),
        // The street: the kerb, then wide for the tram.
        follow(k.kerb, v3(1.5, 2.0, 8.5), v3(0.0, 1.0, 0.0), 2.0),
        fixed(
            k.honk - 3.0,
            v3(-5.0, 2.8, 17.5),
            v3(-8.2, 1.2, 4.6),
            1.9,
            0.002,
        ),
        fixed(
            k.honk + 2.0,
            v3(-6.0, 2.5, 15.0),
            v3(-9.5, 1.2, 4.6),
            2.0,
            0.003,
        ),
        // He boards.
        fixed(
            k.board - 2.5,
            v3(-7.0, 2.0, 11.0),
            v3(-9.4, 1.3, 4.8),
            2.1,
            0.003,
        ),
        fixed(
            k.board - 0.2,
            v3(-7.6, 1.95, 9.5),
            v3(-9.45, 1.5, 4.7),
            2.2,
            0.003,
        ),
        // His eyes: the house through the far windows, sliding by.
        eyes_riding(k.board + 0.7, v3(0.0, 1.45, -4.0)),
        eyes_riding(go1 + 1.9, v3(-0.6, 1.4, -4.0)),
        // Out of his eyes beside his left ear (never through his head):
        // over his shoulder the house still slides by; back out through the
        // tram's open side into the street, where the camera stays and lets
        // the tram go off to the right, then draws back to the street whole
        // as it comes back in from the left to the second stop.
        key(
            go1 + 3.1,
            v3(-0.38, 1.7, 0.3),
            v3(-0.2, 1.4, -4.0),
            1.75,
            0.002,
            1.0,
        ),
        key(
            go1 + 4.3,
            v3(-0.7, 1.85, 2.2),
            v3(0.0, 1.35, -2.5),
            1.85,
            0.002,
            1.0,
        ),
        fixed(
            go1 + 5.6,
            v3(6.0, 1.75, 9.6),
            v3(13.0, 1.5, 4.6),
            1.95,
            0.002,
        ),
        // The day runs on while he is away: the house whole, its shadows
        // sweeping, its windows coming and going.
        fixed(go1 + 8.5, v3(0.0, 4.2, 27.0), v3(0.0, 3.6, 2.0), 1.9, 0.0),
        fixed(
            world.tram.back,
            v3(0.0, 3.0, 24.0),
            v3(0.0, 2.2, 2.0),
            1.9,
            0.0,
        ),
        fixed(
            stop2 + 0.5,
            v3(-1.0, 2.8, 21.0),
            v3(-3.0, 1.8, 2.5),
            1.95,
            0.001,
        ),
        fixed(
            k.alight - 1.0,
            v3(-2.0, 2.2, 13.0),
            v3(-3.6, 1.3, 5.0),
            2.1,
            0.003,
        ),
        follow(k.alight + 2.5, v3(1.5, 2.0, 8.0), v3(0.0, 1.0, -1.0), 2.0),
        // Across to the wall by his door. His back to it, a breath; the
        // phone before his face as he speaks his day into it; round to
        // his other side as he listens to it at his ear.
        follow(w - 2.5, v3(1.6, 1.8, 6.4), v3(-0.2, 1.0, -0.4), 2.0),
        fixed(
            w + 0.6,
            a + v3(1.95, 1.45, 4.0),
            a + v3(0.04, 1.05, 0.0),
            2.0,
            0.003,
        ),
        fixed(
            w + 2.6,
            a + v3(0.9, 1.55, 1.8),
            a + v3(-0.06, 1.32, 0.05),
            2.2,
            0.005,
        ),
        fixed(
            w + 7.2,
            a + v3(0.65, 1.6, 1.55),
            a + v3(-0.06, 1.38, 0.05),
            2.3,
            0.005,
        ),
        fixed(
            w + 9.4,
            a + v3(-0.85, 1.55, 1.65),
            a + v3(-0.06, 1.45, 0.0),
            2.3,
            0.005,
        ),
        fixed(
            w + 13.4,
            a + v3(-0.7, 1.5, 1.4),
            a + v3(-0.06, 1.45, 0.0),
            2.4,
            0.005,
        ),
        follow(w + WALL_SPAN, v3(1.4, 1.8, 6.0), v3(0.0, 1.0, -0.5), 2.0),
        // The shop: in at the door, then his eyes in the queue. In and out
        // of his eyes past his left ear, in front of it, never through his
        // head, and taking its time: no cuts here.
        follow(q - 4.5, v3(1.6, 1.9, 6.5), v3(-0.3, 1.0, -1.0), 2.0),
        fixed(
            q - 2.2,
            v3(0.2, 1.75, -0.6),
            v3(-3.5, 1.15, -2.4),
            2.1,
            0.004,
        ),
        fixed(
            q - 0.8,
            v3(-1.95, 1.8, -1.8),
            v3(-4.6, 1.3, -2.45),
            2.0,
            0.004,
        ),
        eyes(q + 1.0, v3(-2.85, 1.68, -2.0), v3(-4.6, 1.35, -2.45)),
        eyes(q + 2.6, v3(-2.85, 1.68, -2.0), v3(-4.3, 1.15, -2.5)),
        // Out by his ear as the coin slips: it falls in front of him.
        fixed(
            coin_at,
            v3(-2.55, 1.68, -1.85),
            v3(-3.3, 0.55, -2.3),
            1.9,
            0.005,
        ),
        // Back to his side, the floor at his feet: he looks, bends for it.
        fixed(
            q + 5.9,
            v3(-2.15, 1.3, -0.7),
            v3(-2.95, 0.62, -2.2),
            2.0,
            0.005,
        ),
        // He rises with it: the camera draws back to hold all of him.
        fixed(
            q + 8.4,
            v3(-1.4, 1.6, 0.6),
            v3(-2.9, 1.05, -2.3),
            2.0,
            0.005,
        ),
        // Behind his left shoulder as he reaches the counter, then his
        // eyes: his hand with the coin, her hands, the loaf from the shelf.
        fixed(
            q + 10.2,
            v3(-3.0, 1.8, -1.75),
            v3(-4.8, 1.1, -2.45),
            2.0,
            0.004,
        ),
        eyes(q + 11.7, v3(-3.95, 1.68, -2.0), v3(-4.7, 1.0, -2.45)),
        eyes(q + 14.2, v3(-3.95, 1.68, -2.0), v3(-5.1, 1.28, -2.6)),
        eyes(q + 16.3, v3(-3.95, 1.68, -2.0), v3(-4.5, 0.98, -2.4)),
        // Out by his ear before he turns to go, then back to the door.
        fixed(
            q + 17.8,
            v3(-3.6, 1.7, -1.85),
            v3(-4.6, 1.05, -2.4),
            1.95,
            0.004,
        ),
        fixed(
            q + 19.6,
            v3(0.4, 1.7, -0.2),
            v3(-3.0, 1.1, -2.0),
            2.0,
            0.004,
        ),
        follow(
            k.shop_out - 0.05,
            v3(1.5, 2.0, 8.0),
            v3(0.0, 1.0, -0.5),
            2.0,
        ),
        // Home: along the sidewalk to his door, then up in the lift.
        follow(k.home - 2.0, v3(2.0, 1.9, 7.8), v3(-0.3, 1.0, -0.5), 2.1),
        follow(k.home + 0.9, v3(2.4, 1.8, 7.5), v3(-0.3, 1.1, -0.5), 2.1),
        follow(k.home + 5.6, v3(2.6, 1.6, 8.0), v3(0.0, 1.1, 0.0), 2.1),
        fixed(
            k.bread,
            v3(-0.8, 10.6, 5.4),
            v3(-1.8, 9.9, -2.5),
            2.2,
            0.004,
        ),
        follow(k.bread + 3.0, v3(1.0, 1.8, 7.0), v3(0.5, 1.0, -0.5), 2.1),
        // The cup.
        fixed(
            k.trip - 1.6,
            v3(5.6, 10.2, 3.6),
            v3(5.0, 9.6, -1.5),
            2.3,
            0.006,
        ),
        fixed(k.catch, v3(5.4, 10.0, 2.8), v3(4.95, 9.7, -1.5), 2.5, 0.008),
        fixed(
            k.catch + 2.6,
            v3(5.5, 10.2, 3.4),
            v3(5.0, 9.7, -1.5),
            2.3,
            0.006,
        ),
        // Up the stair to the desk.
        follow(k.stairs, v3(0.4, 1.8, 7.8), v3(0.3, 1.2, -0.5), 2.0),
        follow(k.stairs + 10.0, v3(-0.6, 1.4, 6.5), v3(0.4, 1.3, -0.5), 2.0),
        fixed(d - 2.0, v3(6.4, 13.7, 3.4), v3(4.2, 12.9, -2.8), 2.0, 0.004),
        fixed(
            d + 0.3,
            v3(5.4, 13.5, 1.2),
            v3(4.0, 12.95, -2.7),
            2.2,
            0.005,
        ),
        // His eyes: the screen, his hands on the keys; the phone buzzes.
        eyes(d + 1.1, v3(3.9, 13.25, -2.86), v3(3.95, 12.86, -2.45)),
        eyes(d + 4.7, v3(3.9, 13.25, -2.86), v3(3.98, 12.9, -2.45)),
        eyes(d + 5.4, v3(3.9, 13.25, -2.86), v3(4.5, 12.8, -2.32)),
        // Cut: he answers; the camera closes in through the call.
        fixed(
            d + 5.48,
            v3(5.6, 13.15, -0.7),
            v3(4.0, 12.95, -2.95),
            2.3,
            0.006,
        ),
        fixed(
            d + 10.6,
            v3(5.0, 13.1, -1.3),
            v3(3.95, 13.0, -3.0),
            2.5,
            0.007,
        ),
        // From over the other side: his hands at his temples, the
        // deadlines burning.
        fixed(
            d + 11.4,
            v3(2.5, 13.9, -0.6),
            v3(3.9, 12.95, -3.0),
            2.3,
            0.006,
        ),
        fixed(
            d + 13.8,
            v3(2.8, 13.7, -1.0),
            v3(3.9, 12.95, -3.0),
            2.4,
            0.006,
        ),
        // His eyes again: back to work.
        eyes(d + 14.6, v3(3.9, 13.25, -2.86), v3(3.95, 12.86, -2.45)),
        eyes(d + 18.4, v3(3.9, 13.25, -2.86), v3(3.92, 12.9, -2.45)),
        // His hands come up to the lid's edge.
        eyes(d + 18.95, v3(3.9, 13.25, -2.86), v3(3.93, 12.92, -2.47)),
        // Cut: from his left, low: the lid goes down, the light with it.
        fixed(
            d + 19.03,
            v3(5.0, 13.05, -2.35),
            v3(3.95, 12.92, -2.72),
            2.2,
            0.004,
        ),
        fixed(
            d + 21.0,
            v3(4.9, 13.08, -2.2),
            v3(3.93, 12.98, -2.8),
            2.25,
            0.004,
        ),
        // Round to his face over the shut laptop as he sits back; he
        // speaks his day aloud to the evening in the window.
        fixed(
            d + 22.6,
            v3(4.5, 13.28, -1.5),
            v3(3.9, 13.18, -3.05),
            2.3,
            0.005,
        ),
        fixed(
            d + 26.8,
            v3(4.15, 13.28, -1.6),
            v3(3.9, 13.18, -3.05),
            2.45,
            0.005,
        ),
        // From his left, a little above: he listens.
        fixed(
            d + 28.0,
            v3(5.0, 13.42, -2.0),
            v3(3.92, 13.16, -3.05),
            2.4,
            0.005,
        ),
        fixed(
            d + 31.32,
            v3(4.95, 13.44, -2.1),
            v3(3.92, 13.14, -3.05),
            2.5,
            0.005,
        ),
        // Cut: from the street side, the window lit, the evening.
        fixed(
            d + 31.4,
            v3(3.4, 13.1, 5.2),
            v3(3.7, 12.95, -2.6),
            2.2,
            0.003,
        ),
        fixed(
            d + DESK_SPAN + 0.6,
            v3(3.0, 13.2, 6.0),
            v3(3.6, 12.9, -2.5),
            2.1,
            0.003,
        ),
        // Out through the bedroom to the lift, and down.
        follow(
            d + DESK_SPAN + 2.6,
            v3(0.8, 1.5, 5.8),
            v3(0.2, 1.1, -0.5),
            2.0,
        ),
        follow(k.call + 2.0, v3(2.0, 1.6, 6.2), v3(-0.3, 1.1, -0.5), 2.0),
        follow(k.down - 1.0, v3(1.4, 1.6, 6.0), v3(0.0, 1.1, 0.0), 2.0),
        // The evening ride. Close by him as he takes his bicycle off its
        // stand and gets astride; low alongside as he pushes off and
        // gathers way; the camera lets him go, out on the right.
        follow(k.take - 1.5, v3(1.5, 1.5, 4.8), v3(0.2, 1.0, 0.3), 2.0),
        follow(k.take + 0.8, v3(1.0, 1.3, 3.7), v3(0.1, 0.85, 0.35), 2.1),
        follow(k.go - 0.2, v3(1.3, 1.15, 3.5), v3(0.3, 0.85, 0.36), 2.1),
        follow(k.go + 1.5, v3(1.6, 0.95, 3.3), v3(0.7, 0.85, 0.36), 2.0),
        follow(k.go + 3.4, v3(0.6, 0.85, 3.1), v3(1.0, 0.85, 0.36), 2.0),
        fixed(
            k.go + 4.8,
            v3(7.6, 0.95, 4.9),
            v3(9.0, 0.9, 1.4),
            2.0,
            0.003,
        ),
        fixed(
            k.gone - 0.03,
            v3(7.9, 1.0, 4.9),
            v3(9.6, 0.9, 1.4),
            2.0,
            0.003,
        ),
        // He is away a while: the camera rises over the street and the
        // house as the sun goes down, the shadows run long, the lamps and
        // the windows come on.
        fixed(
            k.gone + 4.0,
            v3(2.5, 3.0, 19.0),
            v3(0.5, 3.4, 0.0),
            1.9,
            0.0,
        ),
        fixed(
            ride_in - 1.03,
            v3(1.2, 3.1, 18.5),
            v3(-0.5, 3.3, 0.0),
            1.9,
            0.0,
        ),
        // No cut: he rides in from the left, and the camera comes down off
        // the street to meet him and takes him along as he brakes by the
        // lamp.
        fixed(
            ride_in + 1.4,
            v3(-1.5, 2.4, 13.5),
            v3(-6.0, 1.2, 1.4),
            1.95,
            0.002,
        ),
        follow(ride_in + 4.0, v3(2.4, 1.3, 4.6), v3(0.3, 0.9, 0.36), 2.0),
        follow(k.stop - 0.3, v3(1.9, 1.15, 3.8), v3(0.1, 0.9, 0.36), 2.0),
        // He steps off and leans it on the lamp's post; a few steps on.
        follow(k.stop + 2.0, v3(1.6, 1.25, 3.7), v3(-0.1, 0.95, 0.5), 2.1),
        follow(k.stop + 3.4, v3(1.9, 1.35, 4.0), v3(0.3, 1.05, 0.3), 2.1),
        // Back to the wall by his door; he leans on it in the dusk, a
        // breath, speaks his day aloud, then listens to it.
        follow(w2 - 2.0, v3(1.7, 1.5, 4.6), v3(-0.3, 1.0, 0.0), 2.0),
        fixed(
            w2 + 0.8,
            a + v3(2.2, 1.35, 3.6),
            a + v3(0.04, 1.1, 0.0),
            2.0,
            0.003,
        ),
        fixed(
            w2 + 3.4,
            a + v3(1.2, 1.5, 2.0),
            a + v3(-0.01, 1.4, 0.05),
            2.2,
            0.005,
        ),
        fixed(
            w2 + 8.4,
            a + v3(0.3, 1.48, 2.05),
            a + v3(-0.01, 1.4, 0.0),
            2.3,
            0.005,
        ),
        fixed(
            w2 + 12.8,
            a + v3(-0.6, 1.45, 2.1),
            a + v3(-0.01, 1.35, 0.0),
            2.3,
            0.005,
        ),
        // Night by his door. The camera stands back and looks up: the house
        // goes to sleep round him, window by window.
        fixed(
            f + 1.5,
            a + v3(2.1, 1.5, 3.95),
            a + v3(0.0, 1.15, 0.0),
            2.0,
            0.004,
        ),
        fixed(f + 4.0, v3(-3.2, 1.9, 9.3), v3(-3.6, 4.2, 0.0), 2.0, 0.002),
        fixed(f + 9.0, v3(-2.0, 2.6, 14.0), v3(-2.4, 6.0, 0.0), 2.0, 0.002),
        // Back down to him: the rings come back to him one by one, the
        // camera going round him a little for each.
        fixed(
            f + 12.5,
            a + v3(1.9, 1.6, 3.95),
            a + v3(0.0, 1.2, 0.0),
            2.0,
            0.004,
        ),
        fixed(
            f + 15.5,
            a + v3(1.2, 2.0, 3.65),
            a + v3(0.0, 1.25, 0.0),
            2.1,
            0.004,
        ),
        fixed(
            f + 18.5,
            a + v3(1.8, 1.05, 3.05),
            a + v3(0.0, 1.3, 0.0),
            2.2,
            0.004,
        ),
        // Together at his heart; they strike.
        fixed(
            f + 22.5,
            a + v3(1.5, 1.45, 3.35),
            a + v3(0.0, 1.25, 0.0),
            2.2,
            0.004,
        ),
        fixed(
            f + 25.5,
            a + v3(1.45, 1.45, 3.25),
            a + v3(0.0, 1.25, 0.0),
            2.2,
            0.004,
        ),
        // The camera draws back: the dark house whole; the line of his day
        // runs through it, and he is at each place of it again.
        fixed(
            f + 28.0,
            a + v3(1.7, 2.6, 7.05),
            a + v3(0.0, 1.6, 0.0),
            2.1,
            0.002,
        ),
        fixed(f + 32.5, v3(1.6, 6.0, 22.0), v3(0.4, 5.6, 0.0), 2.0, 0.0),
        fixed(f + 37.5, v3(0.6, 7.2, 27.0), v3(0.0, 6.3, 0.0), 2.0, 0.0),
        fixed(f + 42.0, v3(0.0, 7.8, 31.0), v3(0.0, 6.6, 0.0), 2.0, 0.0),
        // The sphere grows over the house; the lacquer turns to water; the
        // camera sinks to it, where the globe meets its reflection. The drop
        // falls and meets its own; its ring runs out under the camera.
        fixed(f + 47.5, v3(0.0, 3.0, 38.0), v3(0.0, 2.0, 0.0), 1.8, 0.0),
        fixed(f + 50.5, v3(0.0, -0.7, 40.0), v3(0.0, -0.9, 0.0), 1.6, 0.0),
        fixed(f + 54.0, v3(0.0, -0.72, 38.6), v3(0.0, -0.9, 0.0), 1.6, 0.0),
        fixed(
            f + 57.0,
            v3(0.0, -0.86, 33.0),
            v3(0.0, -0.95, 0.0),
            1.7,
            0.0,
        ),
        // Through the surface, into the reflection: the globe hangs below
        // it, the world above shines through it, light comes down in
        // shafts.
        fixed(
            f + 59.0,
            v3(0.3, -1.35, 29.5),
            v3(0.0, -1.2, 0.0),
            1.75,
            0.0,
        ),
        fixed(f + 62.5, v3(1.6, -2.6, 26.0), v3(0.0, -1.3, 0.0), 1.8, 0.0),
        fixed(f + 66.5, v3(4.0, -4.3, 21.0), v3(0.0, -0.7, 0.0), 1.9, 0.0),
        // Into the globe, deep under the line of his day, looking up.
        fixed(f + 70.5, v3(3.0, -5.6, 13.5), v3(0.0, 0.2, -2.0), 1.8, 0.0),
        // Up and out at dawn as the house comes back round the camera.
        fixed(
            DAWN - 1.5,
            v3(1.4, -2.0, 22.0),
            v3(0.0, 1.0, -1.0),
            1.85,
            0.0,
        ),
        fixed(DAWN + 0.5, v3(0.6, 0.5, 29.5), v3(0.0, 2.8, 0.0), 1.9, 0.0),
        fixed(DAWN + 4.0, v3(0.2, 4.0, 31.0), v3(0.0, 5.4, 0.0), 2.0, 0.0),
        wide(LOOP),
    ];
    // Monotone keys need rising times.
    v.sort_by(|a, b| a.at.total_cmp(&b.at));
    v.dedup_by(|b, a| b.at - a.at < 0.02);
    v
}

/// His way through the house as a line: sampled along his plan (he walks
/// and rides every metre of it, kept to the street's ends); the six beads
/// at its end.
fn route(cast: &Cast) -> [[f32; 4]; PATH_POINTS] {
    let k = cast.keys;
    let plan = &cast.plans[HERO];
    let world = &cast.world;
    let keep = |p: V3| v3(p.x.clamp(-15.6, 15.6), p.y, p.z);
    let mut pts: Vec<V3> = Vec::new();
    let mut t = k.rise;
    while t < k.rest {
        let p = keep(plan.anchor(t, world));
        if pts.last().is_none_or(|q| (*q - p).length() > 0.05) {
            pts.push(p);
        }
        t += 0.2;
    }
    // Arc length, then evenly spaced points.
    let mut along = vec![0.0f32];
    for w in pts.windows(2) {
        along.push(along[along.len() - 1] + (w[1] - w[0]).length());
    }
    let total = along[along.len() - 1].max(1e-3);
    let at = |d: f32| -> V3 {
        let i = along.partition_point(|&a| a <= d).clamp(1, pts.len() - 1);
        let (a, b) = (along[i - 1], along[i]);
        pts[i - 1].lerp(pts[i], ((d - a) / (b - a).max(1e-6)).clamp(0.0, 1.0))
    };
    let mut out = [[0.0; 4]; PATH_POINTS];
    for (i, o) in out.iter_mut().take(ROUTE).enumerate() {
        let f = i as f32 / (ROUTE - 1) as f32;
        let p = at(f * total) + v3(0.0, 0.08, 0.0);
        *o = [p.x, p.y, p.z, f];
    }
    // The beads: where he was at each place, and how far along the line.
    for (j, &bt) in bead_times(&k).iter().enumerate() {
        let p = keep(plan.anchor(bt, world));
        let mut best = (f32::MAX, 0.0);
        for (i, q) in pts.iter().enumerate() {
            let d = (*q - p).length();
            if d < best.0 {
                best = (d, along[i] / total);
            }
        }
        out[ROUTE + j] = [p.x, p.y + 0.08, p.z, best.1];
    }
    out
}

/// Where each lamp hangs (the shaders' table).
pub fn lamp_positions() -> [V3; LAMPS] {
    std::array::from_fn(lamp_at)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn story_time_keeps_the_loop() {
        let story = Story::new(Chapter::Everyday);
        assert!(story.story_time(0.0).abs() < 1e-4);
        assert!((story.story_time(LOOP) - LOOP).abs() < 1e-3);
        for w in story.shots.windows(2) {
            assert!(w[1].at > w[0].at);
        }
    }

    #[test]
    fn the_frame_is_finite_all_day() {
        let story = Story::new(Chapter::Everyday);
        let n = (LOOP / 0.25) as usize;
        for i in 0..n {
            let f = story.compose(i as f32 * 0.25);
            for v in [f.eye, f.forward, f.right, f.up, f.hero] {
                assert!(v.x.is_finite() && v.y.is_finite() && v.z.is_finite(), "{i}");
            }
            assert!(f.lens > 1.0, "{}", f.lens);
            assert!(f.sphere.iter().chain(&f.rings).all(|v| v.is_finite()));
        }
    }

    #[test]
    fn the_loop_comes_round_to_its_start() {
        let story = Story::new(Chapter::Everyday);
        let (a, b) = (story.compose(0.0), story.compose(LOOP - 1e-3));
        assert!((a.eye - b.eye).length() < 0.05, "{:?} {:?}", a.eye, b.eye);
        assert!((a.sun_amount - b.sun_amount).abs() < 0.01);
        for i in 0..4 {
            assert!((a.day[i] - b.day[i]).abs() < 0.02, "{i}");
        }
        assert!(a.rings[3] < 0.01 && b.rings[3] < 0.01);
    }

    #[test]
    fn his_eyes_are_his_in_the_tram_the_shop_and_at_the_desk() {
        let story = Story::new(Chapter::Everyday);
        let k = story.keys();
        for s in [k.board + 1.5, k.queue + 1.0, k.queue + 13.0, k.desk + 3.0] {
            // Loop time and story time differ by well under a second here.
            let f = story.compose(s);
            assert!(f.pov[3] > 0.95, "{s}: {}", f.pov[3]);
            let head = v3(f.pov[0], f.pov[1], f.pov[2]);
            assert!((f.eye - head).length() < 0.25, "{s}");
        }
        assert!(story.compose(k.queue + 6.0).pov[3] < 0.05);
    }

    #[test]
    fn the_route_runs_through_the_house() {
        let story = Story::new(Chapter::Everyday);
        let r = story.route;
        for p in r.iter() {
            assert!(p.iter().all(|v| v.is_finite()));
            assert!(p[1] > -0.5 && p[1] < 16.0, "{p:?}");
            assert!(p[0].abs() < 15.7, "{p:?}");
        }
    }
}
