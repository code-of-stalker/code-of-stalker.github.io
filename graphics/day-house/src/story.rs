//! Page 10's loop as numbers: one day of one man through the house.
//!
//! The beats (story seconds; the prototype's beats list follows them):
//! 0–21     the house on the lacquer table at dawn; the camera comes into
//!          his kitchen: the argument (his second ring trembles); she takes
//!          the kettle off the stove, pours his tea, goes back to her pot; he
//!          sips, the ring steadies;
//! 21–46    out by the near side of the table, the lift down, the kerb; the
//!          tram brakes and honks: the sphere flashes;
//! 46–77    he boards; his eyes: the house slides by through the far windows;
//!          the street wide: the tram leaves to the right and comes back in
//!          from the left; he gets off;
//! 77–110   the shop through his eyes; the coin slips (the third ring whips
//!          round), he picks it up, pays, the loaf;
//! 110–150  home with the bread at his side; the child trips with her cup:
//!          the world slows, the third ring, he catches it;
//! 150–192  up the inner stair to his desk: his eyes on the screen, the
//!          phone, the call, his temples and the deadlines, work again, the
//!          screen goes dark, the evening in the window;
//! 192–238  down and out: the evening run along the street, out of the frame
//!          on the right and back in from the left, to the lamp;
//! 238–272  night: the rings come together round him and strike; the camera
//!          draws back; the line of his day runs through the house and each
//!          place lights; the sphere grows over the whole house and meets its
//!          reflection in the lacquer; the walls melt; dawn again.
use crate::cast::{Cast, Held, Keys, HERO};
use crate::house::{cell, lamp_at, TABLE};
use crate::math::{mix, monotone, pulse, smooth, v3, window, window_integral, V3, Y};
use crate::props;
use crate::{Chapter, FINALE, LAMPS, LOOP, PATH_POINTS};
use std::f32::consts::{PI, TAU};

pub use crate::cast::Figure;
use crate::house::Prim;

/// The finale starts when he stops running.
const F: f32 = LOOP - FINALE;

/// The rings strike together here.
pub const CHORD: f32 = F + 9.0;

/// Reduced motion holds this moment: the night house with the line of his
/// day drawn through it, every place of it lit, the rings together round
/// him at the lamp.
pub const STILL: f32 = F + 20.5;

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
/// child's room, the study, the lamp at the end of his run.
fn bead_times(k: &Keys) -> [f32; BEADS] {
    [
        k.sip,
        k.rails,
        k.queue + 4.0,
        k.catch,
        k.desk + 3.0,
        k.run_end + 0.5,
    ]
}

/// The cell each place lights when the line of his day reaches it.
const BEAD_CELLS: [usize; BEADS] = [
    cell::room(1, 3),
    cell::STREET_L,
    cell::room(1, 0),
    cell::room(2, 3),
    cell::room(2, 4),
    cell::STREET_M,
];

/// How much of the line of his day is drawn.
fn drawn(s: f32) -> f32 {
    smooth(F + 11.0, F + 20.0, s) * (1.0 - smooth(F + 27.0, F + 30.0, s))
}

impl Story {
    pub fn new(_chapter: Chapter) -> Story {
        let cast = Cast::new();
        let k = cast.keys;
        let slow_from = (k.catch + SLOW) / (1.0 + 2.0 * SLOW / LOOP) - 1.2;
        let shots = shots(&k, &cast);
        let route = route(&cast);
        Story {
            cast,
            shots,
            route,
            slow_from,
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
            + window(s, k.run, k.run + 2.0, F + 2.0, F + 6.0);
        let b = breath(s * (1.0 + 0.6 * hurried.min(1.0)));
        let moment = self.cast.moment(s, b);
        let held: Held = moment.held;
        let mut figures = moment.figures;
        // In the finale the others go and only his way is left; they are
        // back at dawn. He himself is gone over the night's end and in his
        // kitchen again as the day starts.
        let others = (1.0 - smooth(F + 12.0, F + 15.0, s)) + smooth(F + 30.0, F + 33.0, s);
        let his = smooth(0.0, 1.5, s) * (1.0 - smooth(F + 29.0, F + 32.0, s));
        for (i, f) in figures.iter_mut().enumerate() {
            f.seen *= if i == HERO { his } else { others.min(1.0) };
        }

        // The camera.
        let hero = self.cast.plans[HERO].anchor(s, world);
        let curve = |pick: fn(&Key) -> f32| -> f32 {
            let keys: Vec<(f32, f32)> = self.shots.iter().map(|k| (k.at, pick(k))).collect();
            monotone(&keys, s)
        };
        let rel = curve(|k| k.rel);
        let pov = curve(|k| k.pov).clamp(0.0, 1.0);
        let body = &figures[HERO].body;
        let own = body.head + body.face.forward * POV_AHEAD + body.face.up * 0.03;
        let keyed = v3(curve(|k| k.eye.x), curve(|k| k.eye.y), curve(|k| k.eye.z)) + hero * rel;
        let eye = keyed.lerp(own, pov);
        let look = v3(
            curve(|k| k.look.x),
            curve(|k| k.look.y),
            curve(|k| k.look.z),
        ) + hero * rel;
        let lens = curve(|k| k.lens);
        let aperture = curve(|k| k.aperture).max(0.0);
        let forward = (look - eye).normalize();
        let right = forward.cross(Y).normalize();
        let up = right.cross(forward);
        let focus = (look - eye).length().max(0.3);

        // The day: dawn, noon, the golden hour, sunset, night, dawn. The
        // evening sun sets low in front, a little left, down the street he
        // runs along.
        let u = if s < F {
            (s / F).clamp(0.0, 1.0)
        } else {
            1.0 - smooth(F + 4.0, F + 30.0, s)
        };
        let az = 1.15 - 1.6 * u;
        let el = 0.05 + 0.85 * (PI * u).sin();
        let sun = v3(az.sin() * el.cos(), el.sin(), az.cos() * el.cos());
        // Every light comes back to its dawn value at the loop's end.
        let sun_amount = smooth(-2.0, 8.0, s) * (1.0 - smooth(F - 8.0, F + 1.0, s))
            + smooth(-2.0, 8.0, s - LOOP);
        let sky = (0.25 + 0.75 * smooth(0.0, 12.0, s)) * (1.0 - 0.85 * smooth(F - 8.0, F + 4.0, s))
            + 0.1 * smooth(F + 27.0, F + 34.0, s);
        let morning = 0.55 * (1.0 - smooth(6.0, 22.0, s) + smooth(F + 29.0, F + 34.0, s));
        let golden = window(s, F - 40.0, F - 22.0, F - 2.0, F + 4.0).max(morning);
        let night = window(s, F - 5.0, F + 4.0, F + 26.0, F + 32.0);
        let gloss = window(s, F + 12.0, F + 16.0, F + 28.0, F + 33.0);
        let day = [sky, golden, night, gloss];
        let path_drawn = drawn(s);
        let lamps = lamps(s, &k, &self.route, path_drawn);

        // The sphere and its rings.
        let feet = hero;
        let grow = smooth(F + 21.0, F + 26.0, s);
        let his_c = feet + Y * SPHERE_Y;
        let c = his_c.lerp(GLOBE, grow);
        let r = mix(SPHERE_R, GLOBE_R, grow);
        let floor = mix(feet.y, TABLE, grow);
        let mut rings = rings_at(s, c, r, floor, feet.y, eye);
        // The step's ring whips round when something falls.
        let coin_at = q + 2.9;
        let fall_at = k.catch - 0.55;
        rings[2] = (rings[2]
            + TAU * (smooth(coin_at, coin_at + 1.0, s) + smooth(fall_at, fall_at + 1.0, s)))
        .rem_euclid(TAU);
        // At night they come together round him: the first and the second
        // at his heart, the meridian square to the eye, a circle round him.
        let sync = smooth(F + 5.0, F + 8.0, s) * (1.0 - smooth(F + 19.0, F + 21.0, s));
        let heart = feet.y + 1.3;
        rings[0] = mix(rings[0], heart, sync);
        rings[1] = mix(rings[1], heart, sync);
        let to = c - eye;
        rings[2] = turn_toward(rings[2], to.z.atan2(to.x), sync);
        rings[3] *= his.max(grow) * (1.0 - smooth(F + 30.5, F + 33.5, s));
        // His own eyes see the glass and his own ring least.
        let ring_vis = [
            1.0 - 0.5 * pov,
            (1.0 - 0.8 * pov) * (1.0 - grow),
            1.0 - 0.5 * pov,
            (1.0 - 0.6 * pov) * (1.0 + 2.0 * grow),
        ];
        let chord = pulse(s - CHORD) + 0.4 * pulse(s - CHORD - 0.9);
        let hb = heartbeat(s, HEART * (1.0 - 0.25 * hurried.min(1.0)));
        // The world touches the sphere (the horn); the argument and the
        // call shake his body's ring; what falls flashes the step's.
        let tremble = window(s, 1.0, 2.0, k.pour + 0.5, k.sip + 2.0)
            + 0.8 * window(s, d + 5.5, d + 6.5, d + 13.5, d + 14.5);
        let ring_fx = [
            pulse(s - k.honk) + chord,
            tremble + 0.25 * hb * hurried.min(1.0) + chord,
            pulse(s - coin_at).max(pulse(s - fall_at)) + chord,
            floor,
        ];

        // The line of his day.
        let path = [
            path_drawn,
            0.6 + 0.6 * chord,
            smooth(F + 11.5, F + 20.5, s) * (1.0 - smooth(F + 27.0, F + 30.0, s)),
            0.0,
        ];
        let melt = [
            window(s, F + 22.0, F + 26.0, F + 28.0, F + 31.5),
            gloss,
            0.0,
            0.0,
        ];

        // The desk: the screen, the lamp, what he has typed, the call's news.
        let desk_on = window(s, d - 2.0, d, d + 19.5, d + 21.0);
        let typed = 0.5 * smooth(d + 0.9, d + 4.6, s) + 0.5 * smooth(d + 14.8, d + 18.2, s);
        let news = window(s, d + 6.0, d + 7.0, d + 14.0, d + 16.0);
        let desk = [desk_on, desk_on, typed, news];
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
        let motion = [s, slow, ly, world.lift_moving(s)];
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
            window(s, coin_at, coin_at + 0.1, q + 4.3, q + 4.8),
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
            route: self.route,
            movers,
            figures,
        }
    }
}

/// Each cell's lamp, 0 … 1: the day's, and the places of his day lit one
/// by one as the line reaches them.
fn lamps(s: f32, k: &Keys, route: &[[f32; 4]; PATH_POINTS], drawn: f32) -> [f32; LAMPS] {
    let mut l = [0.0; LAMPS];
    let end = 1.0 - smooth(F + 28.0, F + 33.0, s);
    let evening = smooth(F - 30.0, F - 20.0, s) * end;
    let dawn = 1.0 - smooth(4.0, 9.0, s);
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
    l[cell::room(2, 4)] = window(s, d - 3.0, d - 1.0, d + 21.0, d + 24.0).max(evening);
    l[cell::ROOF] = 0.6 * evening;
    let street = dawn.max(smooth(F - 12.0, F - 6.0, s) * end);
    for c in [cell::STREET_L, cell::STREET_M, cell::STREET_R] {
        l[c] = street;
    }
    l[cell::TRAM] = 1.0;
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
    let go1 = world.tram.go1;
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
        eyes_riding(go1 + 2.5, v3(-0.8, 1.4, -4.0)),
        eyes_riding(go1 + 5.4, v3(0.6, 1.6, -4.0)),
        // Cut: the street wide; the tram goes off to the right and comes
        // back in from the left to the second stop.
        fixed(go1 + 5.47, v3(0.0, 3.0, 24.0), v3(0.0, 2.2, 2.0), 1.9, 0.0),
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
        // The shop: in at the door, then his eyes in the queue.
        follow(q - 4.5, v3(1.6, 1.9, 6.5), v3(-0.3, 1.0, -1.0), 2.0),
        fixed(q - 2.0, v3(0.2, 1.7, -0.6), v3(-3.5, 1.1, -2.4), 2.1, 0.004),
        eyes(q - 0.3, v3(-2.6, 1.65, -2.3), v3(-4.6, 1.35, -2.45)),
        eyes(q + 2.3, v3(-2.6, 1.65, -2.3), v3(-4.3, 1.15, -2.5)),
        // Cut: the coin slips; from his side, the floor at his feet.
        fixed(
            q + 2.38,
            v3(-2.15, 1.3, -0.7),
            v3(-2.95, 0.62, -2.2),
            2.0,
            0.005,
        ),
        // He rises with it: the camera draws back to hold all of him.
        fixed(
            q + 5.6,
            v3(-1.4, 1.6, 0.6),
            v3(-2.9, 1.05, -2.3),
            2.0,
            0.005,
        ),
        fixed(q + 7.6, v3(0.2, 1.7, -0.7), v3(-3.9, 1.1, -2.4), 2.1, 0.004),
        // His eyes at the counter: his hand with the coin, her hands, the
        // loaf from the shelf.
        eyes(q + 8.5, v3(-3.7, 1.65, -2.3), v3(-4.7, 1.0, -2.45)),
        eyes(q + 11.4, v3(-3.7, 1.65, -2.3), v3(-5.1, 1.28, -2.6)),
        eyes(q + 14.5, v3(-3.7, 1.65, -2.3), v3(-4.5, 0.98, -2.4)),
        // Cut: out with the bread.
        fixed(
            q + 14.58,
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
        // Cut: from the street side, the screen goes dark; the evening.
        fixed(
            d + 18.48,
            v3(3.9, 13.0, 4.5),
            v3(3.9, 12.9, -2.5),
            2.2,
            0.003,
        ),
        fixed(
            d + 21.5,
            v3(3.0, 13.2, 6.0),
            v3(3.6, 12.9, -2.5),
            2.1,
            0.003,
        ),
        // Out through the bedroom to the lift, and down.
        follow(d + 23.5, v3(0.8, 1.5, 5.8), v3(0.2, 1.1, -0.5), 2.0),
        follow(k.call + 2.0, v3(2.0, 1.6, 6.2), v3(-0.3, 1.1, -0.5), 2.0),
        follow(k.down - 1.0, v3(1.4, 1.6, 6.0), v3(0.0, 1.1, 0.0), 2.0),
        // The evening run: low alongside him; the camera runs ahead and
        // stops, he runs past and out on the right.
        follow(k.run - 0.8, v3(1.6, 1.4, 5.5), v3(0.6, 1.1, 0.0), 2.0),
        follow(k.run + 2.5, v3(0.2, 0.75, 4.2), v3(1.2, 1.15, 0.0), 2.0),
        fixed(
            k.run + 5.0,
            v3(5.0, 1.2, 6.4),
            v3(5.5, 1.1, 0.9),
            2.0,
            0.003,
        ),
        fixed(
            k.gone - 0.03,
            v3(5.2, 1.2, 6.4),
            v3(5.7, 1.1, 0.9),
            2.0,
            0.003,
        ),
        // Cut: in from the left.
        fixed(
            k.again + 0.03,
            v3(-11.5, 1.2, 6.4),
            v3(-11.0, 1.1, 0.9),
            2.0,
            0.003,
        ),
        fixed(
            k.again + 2.6,
            v3(-11.0, 1.25, 6.2),
            v3(-10.0, 1.1, 0.9),
            2.0,
            0.003,
        ),
        follow(k.again + 5.0, v3(1.4, 1.3, 5.0), v3(0.6, 1.1, 0.0), 2.0),
        follow(k.run_end - 1.0, v3(1.9, 1.3, 4.8), v3(0.2, 1.1, 0.0), 2.0),
        // Night at the lamp: the rings come together round him and strike.
        fixed(f + 1.5, v3(2.4, 1.5, 4.9), v3(0.3, 1.15, 0.9), 2.0, 0.004),
        fixed(f + 5.0, v3(2.0, 1.5, 4.4), v3(0.3, 1.2, 0.9), 2.1, 0.004),
        fixed(f + 8.6, v3(1.8, 1.45, 4.1), v3(0.3, 1.25, 0.9), 2.2, 0.004),
        // The camera draws back: the house whole, the line of his day.
        fixed(f + 10.5, v3(2.0, 2.6, 8.0), v3(0.3, 1.6, 0.9), 2.1, 0.002),
        fixed(f + 16.0, v3(0.6, 7.2, 27.0), v3(0.0, 6.3, 0.0), 2.0, 0.0),
        fixed(f + 21.0, v3(0.0, 7.8, 31.0), v3(0.0, 6.6, 0.0), 2.0, 0.0),
        // The sphere grows over the house; the camera sinks to the lacquer,
        // where the globe meets its reflection.
        fixed(f + 25.0, v3(0.0, 3.0, 38.0), v3(0.0, 2.0, 0.0), 1.8, 0.0),
        fixed(f + 28.0, v3(0.0, -0.7, 40.0), v3(0.0, -0.9, 0.0), 1.6, 0.0),
        fixed(
            f + 30.5,
            v3(0.0, -0.65, 39.0),
            v3(0.0, -0.85, 0.0),
            1.6,
            0.0,
        ),
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
    while t < k.run_end {
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
        for s in [k.board + 3.0, k.queue + 1.0, k.queue + 10.0, k.desk + 3.0] {
            // Loop time and story time differ by well under a second here.
            let f = story.compose(s);
            assert!(f.pov[3] > 0.95, "{s}: {}", f.pov[3]);
            let head = v3(f.pov[0], f.pov[1], f.pov[2]);
            assert!((f.eye - head).length() < 0.25, "{s}");
        }
        assert!(story.compose(k.queue + 3.5).pov[3] < 0.05);
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
