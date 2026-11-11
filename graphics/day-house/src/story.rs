//! Page 10's loop as numbers: one day of one man through the house.
//!
//! 0–3 s     the house on the lacquer table at dawn; the camera comes in to
//!           his kitchen;
//! 3–15 s    the argument at the table: his second ring (breath, heart)
//!           trembles; she pours him tea, a hand on his shoulder; it steadies;
//! 15–30 s   along the corridor to the lift and down;
//! 30–45 s   the street: the kerb, he crosses, the tram brakes and honks,
//!           his first ring (the world) flashes and holds; the ride;
//! 45–75 s   the shop: the queue, the coin slips, he picks it up, pays,
//!           the loaf;
//! 75–95 s   home with the bread; the child runs to him with her cup and
//!           trips; the third ring (the act) flashes, the world slows, he
//!           catches it;
//! 95–120 s  up the inner stair to his desk: deadlines, the phone, his
//!           temples;
//! 120–158 s the roof at sunset: a run round the track, then the sun;
//! 158–170 s night: a line of light draws his day through the house, a bead
//!           at each of the six places; the three rings strike together;
//! 170–180 s the walls melt into one space, the table's lacquer takes the
//!           house; dawn again.
use crate::cast::{Cast, Held, Keys, HERO};
use crate::house::{cell, lamp_at};
use crate::math::{monotone, pulse, smooth, v3, window, window_integral, V3, Y};
use crate::props;
use crate::{Chapter, LAMPS, LOOP, PATH_POINTS};
use std::f32::consts::{PI, TAU};

pub use crate::cast::Figure;
use crate::house::Prim;

/// Reduced motion holds this moment: the line of his day drawn, the three
/// rings striking together.
pub const STILL: f32 = 169.6;

/// One breath: in for `INHALE` s, out for the rest of `BREATH`.
pub const BREATH: f32 = 4.0;
pub const INHALE: f32 = 1.6;
pub const HEART: f32 = 60.0 / 66.0;

/// The route's beads (the six places) at the end of `route`.
pub const BEADS: usize = 6;
pub const ROUTE: usize = PATH_POINTS - BEADS;

/// The three rings strike together here.
pub const CHORD: f32 = 168.6;

/// The slow fall of the cup: story time runs `1 - SLOW` as fast for
/// `SLOW_SPAN` round the catch, a little faster elsewhere to keep the loop.
const SLOW: f32 = 0.72;

/// A camera key: when (story time), the eye, where it looks, what is sharp
/// (all world or, with `rel` 1, from the point under him), the lens and the
/// aperture.
#[derive(Clone, Copy, Debug)]
struct Key {
    at: f32,
    eye: V3,
    look: V3,
    lens: f32,
    aperture: f32,
    rel: f32,
}

fn key(at: f32, eye: V3, look: V3, lens: f32, aperture: f32, rel: f32) -> Key {
    Key {
        at,
        eye,
        look,
        lens,
        aperture,
        rel,
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
    /// The point under him and how much of the rings shows.
    pub hero: V3,
    pub rings_seen: f32,
    /// Each ring: its radius, its height over his feet, its light, its
    /// tremble; then: its flash, its turn, its pace, 0.
    pub ring1: [f32; 4],
    pub ring1b: [f32; 4],
    pub ring2: [f32; 4],
    pub ring2b: [f32; 4],
    pub ring3: [f32; 4],
    pub ring3b: [f32; 4],
    /// Which ring was touched last and how long ago; the one before.
    pub ring_events: [f32; 4],
    /// The three striking together: the flash, how long since, 0, 0.
    pub chord: [f32; 4],
    /// The line of his day: how much is drawn, its light, the beads, 0.
    pub path: [f32; 4],
    /// How far the walls have melted, the reflection, 0, 0.
    pub melt: [f32; 4],
    /// Deadlines over his desk: how many, how hot, 0, 0; where.
    pub sparks: [f32; 4],
    pub spark_to: [f32; 4],
    /// His screen's glow, the desk lamp, 0, 0.
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

/// The six places of his day: the kitchen, the street, the shop, the
/// living room, the study, the roof.
fn bead_times(k: &Keys) -> [f32; BEADS] {
    [
        k.sip,
        k.rails,
        k.queue + 4.0,
        k.catch,
        k.desk + 3.0,
        k.run_end + 1.0,
    ]
}

impl Story {
    pub fn new(_chapter: Chapter) -> Story {
        let cast = Cast::new();
        let k = cast.keys;
        let slow_from = (k.catch + SLOW) / (1.0 + 2.0 * SLOW / LOOP) - 1.2;
        let shots = shots(&k);
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
        let world = &self.cast.world;
        // His breath quickens in the argument, at the desk, in the run.
        let hurried = window(s, 3.0, 4.0, k.sip, k.rise)
            + window(s, k.desk + 2.0, k.desk + 3.0, k.desk + 6.5, k.desk + 8.0);
        let b = breath(s * (1.0 + 0.6 * hurried));
        let moment = self.cast.moment(s, b);
        let held: Held = moment.held;
        let mut figures = moment.figures;
        let fade = (1.0 - smooth(170.0, 173.0, s)) + smooth(176.5, 179.5, s);
        for (i, f) in figures.iter_mut().enumerate() {
            if i != HERO {
                f.seen *= fade.min(1.0);
            }
        }

        // The camera.
        let hero = self.cast.plans[HERO].anchor(s, world);
        let curve = |pick: fn(&Key) -> f32| -> f32 {
            let keys: Vec<(f32, f32)> = self.shots.iter().map(|k| (k.at, pick(k))).collect();
            monotone(&keys, s)
        };
        let rel = curve(|k| k.rel);
        let eye = v3(curve(|k| k.eye.x), curve(|k| k.eye.y), curve(|k| k.eye.z)) + hero * rel;
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

        // The day: dawn, noon, the golden hour, sunset, night, dawn.
        let u = if s < 158.0 {
            (s / 158.0).clamp(0.0, 1.0)
        } else {
            1.0 - smooth(162.0, 176.0, s)
        };
        let az = 1.15 - 2.4 * u;
        let el = 0.05 + 0.85 * (PI * u).sin();
        let sun = v3(az.sin() * el.cos(), el.sin(), az.cos() * el.cos());
        let sun_amount =
            smooth(-2.0, 8.0, s) * (1.0 - smooth(150.0, 159.0, s)) + 0.25 * smooth(174.0, 180.0, s);
        let sky = (0.25 + 0.75 * smooth(0.0, 12.0, s)) * (1.0 - 0.85 * smooth(150.0, 162.0, s))
            + 0.2 * smooth(172.0, 180.0, s);
        let golden = window(s, 120.0, 140.0, 156.0, 162.0);
        let night = window(s, 152.0, 162.0, 174.0, 180.0);
        let gloss = window(s, 168.0, 172.0, 177.0, 180.0);
        let day = [sky, golden, night, gloss];
        let lamps = lamps(s, &k);

        // The rings round him.
        let hb = heartbeat(s, HEART * (1.0 - 0.25 * hurried));
        let tremble2 = window(s, 3.0, 3.8, k.pour + 0.5, k.sip + 2.0)
            + 0.7 * window(s, k.desk + 2.0, k.desk + 3.0, k.desk + 5.5, k.desk + 7.0);
        let honk = pulse(s - k.honk);
        let coin = pulse(s - (k.queue + 2.9));
        let catch = pulse(s - (k.catch - 0.55));
        let chord = pulse(s - CHORD) + 0.4 * pulse(s - CHORD - 0.9);
        let run = window(s, k.run, k.run + 1.0, k.run_end, k.run_end + 1.0);
        let lit = 0.35 + 0.25 * run + 0.4 * window(s, 158.0, 160.0, 172.0, 175.0);
        let ring1 = [1.5, 0.05, lit, 0.0];
        let ring1b = [
            honk.max(coin * 0.6) + chord,
            (TAU * s / 40.0).rem_euclid(TAU),
            1.0,
            0.0,
        ];
        let ring2 = [0.42 + 0.04 * b, 1.25 + 0.12 * b, lit, tremble2];
        let ring2b = [hb * 0.5 + chord, b, 1.0 + hurried, 0.0];
        let ring3 = [0.75, 0.02, lit, 0.0];
        let track = self.cast.plans[HERO].act_at(s).walk.track(s);
        let ring3b = [catch + chord, (-track / 0.75).rem_euclid(TAU), 1.0, 0.0];
        let events = [
            (k.honk, 1.0),
            (k.queue + 2.9, 1.0),
            (k.sip, 2.0),
            (k.catch - 0.55, 3.0),
            (k.desk + 6.0, 2.0),
        ];
        let mut touched = events.iter().filter(|e| e.0 <= s);
        let newest = touched
            .next_back()
            .map_or((0.0, 99.0), |e| (e.1, (s - e.0).min(99.0)));
        let before = touched
            .next_back()
            .map_or((0.0, 99.0), |e| (e.1, (s - e.0).min(99.0)));
        let ring_events = [newest.0, newest.1, before.0, before.1];
        let rings_seen = 1.0 - 0.5 * window(s, 0.0, 0.1, 2.0, 3.0);

        // The line of his day.
        let drawn = smooth(158.5, 167.5, s) * (1.0 - smooth(176.0, 179.0, s));
        let path = [drawn, 0.6 + 0.6 * chord, smooth(159.0, 168.0, s), 0.0];
        let melt = [window(s, 170.0, 172.5, 175.5, 178.5), gloss, 0.0, 0.0];

        let desk_on = window(s, k.desk - 2.0, k.desk, k.desk + 8.5, k.desk + 10.5);
        let sparks = [
            desk_on * window(s, k.desk + 1.0, k.desk + 2.0, k.desk + 6.0, k.desk + 7.5),
            0.0,
            0.0,
            0.0,
        ];
        let spark_to = [5.3, 13.55, -4.55, 0.0];
        let desk = [desk_on, desk_on, 0.0, 0.0];
        let c = world.tram_c(s);
        let doors = world.tram_doors(s);
        let tram = [c, doors, 1.0, 0.0];
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
        let honk_at = v3(c + 4.7, 1.4, 4.3);
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
            window(
                s,
                k.queue + 2.9,
                k.queue + 3.0,
                k.queue + 4.3,
                k.queue + 4.8,
            ),
        ];

        let movers = [props::tram(c, doors), props::movers(s, world, &held)];
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
            rings_seen,
            ring1,
            ring1b,
            ring2,
            ring2b,
            ring3,
            ring3b,
            ring_events,
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

/// Each cell's lamp, 0 … 1.
fn lamps(s: f32, k: &Keys) -> [f32; LAMPS] {
    let mut l = [0.0; LAMPS];
    let evening = smooth(145.0, 155.0, s) * (1.0 - smooth(174.0, 179.0, s));
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
    l[cell::room(2, 4)] =
        window(s, k.desk - 3.0, k.desk - 1.0, k.desk + 9.0, k.desk + 12.0).max(evening);
    l[cell::ROOF] = smooth(150.0, 156.0, s) * (1.0 - smooth(174.0, 179.0, s));
    let street = dawn.max(smooth(150.0, 154.0, s) * (1.0 - smooth(176.0, 179.5, s)));
    for c in [cell::STREET_L, cell::STREET_M, cell::STREET_R] {
        l[c] = street;
    }
    l[cell::TRAM] = 1.0;
    l
}

/// The camera through the day.
fn shots(k: &Keys) -> Vec<Key> {
    let wide = |at: f32| key(at, v3(0.0, 7.4, 31.0), v3(0.0, 6.4, 0.0), 2.0, 0.0, 0.0);
    let kitchen_eye = v3(-0.9, 10.8, 6.5);
    let kitchen_look = v3(-1.85, 10.0, -3.0);
    let follow = |at: f32, eye: V3, look: V3, lens: f32| key(at, eye, look, lens, 0.004, 1.0);
    let mut v = vec![
        wide(0.0),
        key(2.5, v3(-0.5, 9.5, 19.0), v3(-1.5, 9.3, -2.5), 2.0, 0.0, 0.0),
        key(5.0, kitchen_eye, kitchen_look, 2.1, 0.003, 0.0),
        key(
            k.pour - 1.0,
            v3(-1.1, 10.6, 5.0),
            kitchen_look,
            2.3,
            0.004,
            0.0,
        ),
        key(
            k.rise,
            v3(-0.8, 10.5, 4.6),
            v3(-1.6, 10.1, -3.0),
            2.3,
            0.004,
            0.0,
        ),
        // Out to the lift and down with it.
        follow(k.rise + 1.6, v3(1.6, 2.0, 7.0), v3(-0.6, 1.0, -1.0), 2.1),
        follow(k.press, v3(2.4, 1.8, 7.5), v3(-0.3, 1.1, -0.5), 2.1),
        follow(k.lift0 + 4.0, v3(2.6, 1.6, 8.0), v3(0.0, 1.1, 0.0), 2.1),
        // The street: the kerb, then wide for the tram.
        follow(k.kerb, v3(1.5, 2.0, 8.5), v3(0.0, 1.0, 0.0), 2.0),
        key(
            k.honk - 3.0,
            v3(-5.0, 2.8, 17.5),
            v3(-8.2, 1.2, 4.6),
            1.9,
            0.002,
            0.0,
        ),
        key(
            k.honk + 2.0,
            v3(-6.0, 2.5, 15.0),
            v3(-9.5, 1.2, 4.6),
            2.0,
            0.003,
            0.0,
        ),
        // Aboard: the camera rides along.
        follow(k.board, v3(0.8, 1.8, 7.5), v3(0.0, 1.2, -0.3), 2.0),
        follow(k.alight + 1.5, v3(1.5, 2.0, 8.0), v3(0.0, 1.0, -1.0), 2.0),
        // The shop.
        key(
            k.queue - 1.0,
            v3(0.2, 1.7, -0.6),
            v3(-3.5, 1.1, -2.4),
            2.1,
            0.004,
            0.0,
        ),
        // The coin slips: from his side, the floor in front of his feet.
        key(
            k.queue + 2.4,
            v3(-2.15, 1.3, -0.7),
            v3(-2.95, 0.62, -2.2),
            2.0,
            0.005,
            0.0,
        ),
        key(
            k.queue + 5.6,
            v3(-2.15, 1.25, -0.75),
            v3(-2.9, 0.75, -2.25),
            2.0,
            0.005,
            0.0,
        ),
        key(
            k.queue + 8.0,
            v3(0.2, 1.7, -0.7),
            v3(-3.9, 1.1, -2.4),
            2.1,
            0.004,
            0.0,
        ),
        follow(
            k.shop_out - 0.05,
            v3(1.5, 2.0, 8.0),
            v3(0.0, 1.0, -0.5),
            2.0,
        ),
        // Home: a cut to the landing on his floor.
        follow(k.home + 0.05, v3(2.4, 1.8, 7.5), v3(0.5, 1.0, -0.5), 2.1),
        key(
            k.bread,
            v3(-0.8, 10.6, 5.4),
            v3(-1.8, 9.9, -2.5),
            2.2,
            0.004,
            0.0,
        ),
        follow(k.bread + 3.0, v3(1.0, 1.8, 7.0), v3(0.5, 1.0, -0.5), 2.1),
        // The cup.
        key(
            k.trip - 1.6,
            v3(5.6, 10.2, 3.6),
            v3(5.0, 9.6, -1.5),
            2.3,
            0.006,
            0.0,
        ),
        key(
            k.catch,
            v3(5.4, 10.0, 2.8),
            v3(4.95, 9.7, -1.5),
            2.5,
            0.008,
            0.0,
        ),
        key(
            k.catch + 2.6,
            v3(5.5, 10.2, 3.4),
            v3(5.0, 9.7, -1.5),
            2.3,
            0.006,
            0.0,
        ),
        // Up the stair to the desk.
        follow(k.stairs, v3(0.4, 1.8, 7.8), v3(0.3, 1.2, -0.5), 2.0),
        key(
            k.desk - 0.5,
            v3(4.0, 13.5, 3.0),
            v3(4.1, 12.9, -3.0),
            2.3,
            0.005,
            0.0,
        ),
        key(
            k.desk + 7.5,
            v3(4.4, 13.3, 2.4),
            v3(4.3, 12.95, -3.2),
            2.4,
            0.006,
            0.0,
        ),
        // The roof.
        follow(k.roof, v3(2.0, 3.0, 9.0), v3(0.0, 1.0, -0.5), 2.0),
        follow(k.run + 2.0, v3(0.5, 4.0, 12.0), v3(0.0, 1.0, -1.0), 1.9),
        key(
            k.run_end,
            v3(3.0, 18.5, 11.0),
            v3(2.4, 15.9, -2.0),
            1.9,
            0.004,
            0.0,
        ),
        key(
            (k.run_end + 2.5).min(158.5),
            v3(2.6, 17.4, 7.5),
            v3(2.3, 16.3, -2.4),
            2.2,
            0.004,
            0.0,
        ),
        // Night: the house whole, the line of his day; the rings strike.
        wide(160.0),
        key(167.0, v3(0.0, 7.3, 29.5), v3(0.0, 6.5, 0.0), 2.0, 0.0, 0.0),
        key(
            CHORD + 1.0,
            v3(0.0, 7.1, 27.5),
            v3(0.0, 6.6, 0.0),
            2.0,
            0.0,
            0.0,
        ),
        // The walls melt; the camera sinks to the table's lacquer.
        key(175.0, v3(0.0, 0.4, 26.0), v3(0.0, 5.6, 0.0), 1.9, 0.0, 0.0),
        wide(180.0),
    ];
    // Monotone keys need rising times.
    v.sort_by(|a, b| a.at.total_cmp(&b.at));
    v.dedup_by(|b, a| b.at - a.at < 0.02);
    v
}

/// His way through the house as a line: sampled along his plan, joined
/// through the lift and the stairwell where the camera cut away; the six
/// beads at its end.
fn route(cast: &Cast) -> [[f32; 4]; PATH_POINTS] {
    let k = cast.keys;
    let plan = &cast.plans[HERO];
    let world = &cast.world;
    let mut pts: Vec<V3> = Vec::new();
    let lift = |y: f32| v3(-8.25, y, -1.25);
    let mut t = k.rise;
    while t < k.run_end {
        let p = plan.anchor(t, world);
        if t > k.shop_out && t < k.home + 0.2 {
            t = k.home + 0.2;
            // Back to the stairwell and up in the lift.
            pts.extend([
                v3(-6.6, 0.0, 2.0),
                v3(-7.0, 0.0, -1.0),
                lift(0.0),
                lift(9.0),
            ]);
            continue;
        }
        if t > k.desk + 8.0 && t < k.roof + 0.4 {
            t = k.roof + 0.4;
            pts.extend([
                v3(1.6, 12.0, -1.5),
                v3(-5.6, 12.0, -1.5),
                v3(-7.0, 12.0, -1.5),
                v3(-7.0, 15.0, -1.5),
            ]);
            continue;
        }
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
        let p = plan.anchor(bt, world);
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
        let k = story.keys();
        println!("{k:#?}");
        for w in story.shots.windows(2) {
            assert!(w[1].at > w[0].at);
        }
    }

    #[test]
    fn the_frame_is_finite_all_day() {
        let story = Story::new(Chapter::Everyday);
        for i in 0..720 {
            let f = story.compose(i as f32 * 0.25);
            for v in [f.eye, f.forward, f.right, f.up, f.hero] {
                assert!(v.x.is_finite() && v.y.is_finite() && v.z.is_finite(), "{i}");
            }
            assert!(f.lens > 1.0, "{}", f.lens);
        }
    }

    #[test]
    fn the_route_runs_through_the_house() {
        let story = Story::new(Chapter::Everyday);
        let r = story.route;
        for p in r.iter() {
            assert!(p.iter().all(|v| v.is_finite()));
            assert!(p[1] > -0.5 && p[1] < 16.0, "{p:?}");
        }
    }
}
