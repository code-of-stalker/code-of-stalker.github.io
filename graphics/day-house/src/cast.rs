//! The people of the house and their day: the hero (H), his wife (P), his
//! child, the shopkeeper (K) and the lady before him in the queue (L), a
//! youth and the driver on the tram, the old man, the cellist, the
//! gardener, the painter and the mechanic. Each lives by a `Plan` of acts;
//! here their hands, heads and the things they carry are added on top.
//! Times are story times (`story::story_time` slows the cup's fall).
use crate::act::{flat, Gait, Local, Plan, Ride, World, CLIMBING, RUNNING, STROLL, WALKING};
use crate::body::{build, Body, Carry, Hair, Pose, HANDS};
use crate::math::{mix, smooth, smooth_integral, v3, window, V3};
use crate::LOOP;
use std::f32::consts::{FRAC_PI_2, PI, TAU};

pub const HERO: usize = 0;
pub const PARTNER: usize = 1;
pub const CHILD: usize = 2;
pub const KEEPER: usize = 3;
pub const LADY: usize = 4;
pub const YOUTH: usize = 5;
pub const DRIVER: usize = 6;
pub const OLD: usize = 7;
pub const CELLIST: usize = 8;
pub const GARDENER: usize = 9;
pub const PAINTER: usize = 10;
pub const MECHANIC: usize = 11;
pub const PEOPLE: usize = 12;

/// One person in a frame: the body, how much of it shows, the hero's
/// accent, the clothes' shade and the size.
#[derive(Clone, Debug, PartialEq)]
pub struct Figure {
    pub body: Body,
    pub seen: f32,
    pub accent: f32,
    pub clothes: f32,
    pub scale: f32,
    /// The hair's cut and shade for the shader: cut × 8 + shade (0 black …
    /// 7 grey).
    pub hair: f32,
}

// ---- the ground under the feet ----

/// The street: the road lies `ROAD_Y` under the sidewalks.
pub fn street(_: f32, z: f32) -> f32 {
    crate::house::ROAD_Y * (smooth(2.12, 2.28, z) - smooth(5.67, 5.83, z))
}
/// Stepping up into the tram from the far sidewalk.
pub fn boarding(_: f32, z: f32) -> f32 {
    mix(0.22, 0.0, smooth(5.55, 5.75, z))
}
const TREAD: f32 = 3.6 / 14.0;
/// The living room's stair along its walk from x = 4.0: the treads.
fn stair_floor(z: f32) -> f32 {
    let x = 4.0 + z;
    if x < 4.3 {
        0.0
    } else if x >= 7.9 {
        3.0
    } else {
        (((x - 4.3) / TREAD).floor() + 1.0) * 3.0 / 14.0
    }
}
/// The line his pelvis rides up the stair.
fn stair_ramp(z: f32) -> f32 {
    let u = (4.0 + z - 4.25) / 3.7;
    3.0 * (smooth_integral(-0.08, 0.08, u) - smooth_integral(0.92, 1.08, u))
}

/// A child's dash.
const DASH: Gait = Gait {
    stride: 1.0,
    period: 0.3,
    swing: 1.28,
    run: true,
};

// ---- gestures ----

/// Where the hand's grip is: between the ends of its cone.
pub fn grip(body: &Body, side: usize) -> V3 {
    let c = &body.cones;
    let i = 3 * HANDS[side];
    v3(
        0.5 * (c[i][0] + c[i + 1][0]),
        0.5 * (c[i][1] + c[i + 1][1]),
        0.5 * (c[i][2] + c[i + 1][2]),
    )
}

/// The hand on `side` reaches for the world point `target`, `a` of the way.
fn reach(pose: &mut Pose, local: &Local, side: usize, target: V3, a: f32) {
    if a <= 0.001 {
        return;
    }
    let q = local.local(target);
    let body = build(pose);
    let s = body.cones[3 * (19 + side)];
    let shoulder = v3(s[0], s[1], s[2]);
    let d = q - shoulder;
    let len = d.length().max(1e-4);
    // The wrist stops short of the target so the hand's middle is there.
    let w = q - d * (0.055 / len);
    let old = pose.hands[side][3];
    let amount = old + (1.0 - old) * a.clamp(0.0, 1.0);
    pose.hands[side] = [w.x, w.y, w.z, amount];
}

/// The hand on `side` at a point of the walk's own frame.
fn hold(pose: &mut Pose, side: usize, at: V3, a: f32) {
    if a <= 0.001 {
        return;
    }
    let old = pose.hands[side][3];
    pose.hands[side] = [at.x, at.y, at.z, old + (1.0 - old) * a.clamp(0.0, 1.0)];
}

/// The head turns to look at the world point `target`, `a` of the way.
fn look(pose: &mut Pose, local: &Local, target: V3, a: f32) {
    if a <= 0.001 {
        return;
    }
    let q = local.local(target);
    let head = pose.pelvis + v3(0.0, 0.72, 0.0);
    let d = q - head;
    let turn = d.x.atan2(d.z).clamp(-1.3, 1.3);
    let horiz = (d.x * d.x + d.z * d.z).sqrt();
    let nod = 0.8 * (-d.y).atan2(horiz).clamp(-0.5, 0.7);
    pose.turn = mix(pose.turn, turn, a);
    pose.nod = mix(pose.nod, nod, a);
}

/// Down on the haunches, `c` of the way.
fn crouch(pose: &mut Pose, c: f32) {
    if c <= 0.0 {
        return;
    }
    pose.pelvis.y = mix(pose.pelvis.y, 0.42, c);
    pose.pelvis.z -= 0.2 * c;
    pose.lean += 0.95 * c;
}

fn lerp3(a: V3, b: V3, s: f32) -> V3 {
    a.lerp(b, s.clamp(0.0, 1.0))
}

/// The key moments of the day, story time.
#[derive(Clone, Copy, Debug, Default)]
pub struct Keys {
    pub p_rise: f32,
    pub pour: f32,
    pub sip: f32,
    pub rise: f32,
    pub press: f32,
    pub lift0: f32,
    pub kerb: f32,
    pub rails: f32,
    pub honk: f32,
    pub board: f32,
    pub alight: f32,
    pub queue: f32,
    pub shop_out: f32,
    pub home: f32,
    pub bread: f32,
    pub arrive: f32,
    pub c0: f32,
    pub trip: f32,
    pub catch: f32,
    pub stairs: f32,
    pub desk: f32,
    pub call: f32,
    pub roof: f32,
    pub run: f32,
    pub run_end: f32,
    pub p_back: f32,
}

/// Where the things people handle are this moment.
#[derive(Clone, Copy, Debug)]
pub struct Held {
    pub teapot: V3,
    pub teapot_tilt: f32,
    pub cup: V3,
    pub kid_cup: V3,
    pub kid_cup_spin: f32,
    pub loaf: V3,
    pub coin: V3,
    pub phone: V3,
    pub chair: V3,
    pub can: V3,
    pub can_tilt: f32,
    pub brush: [V3; 2],
    pub bow: [V3; 2],
    pub wrench: [V3; 2],
}

pub struct Moment {
    pub figures: Vec<Figure>,
    pub held: Held,
}

pub struct Cast {
    pub world: World,
    pub plans: Vec<Plan>,
    pub keys: Keys,
}

// The kitchen table and what stands on it.
const TEAPOT: V3 = v3(-2.2, 9.86, -3.25);
const TEAPOT_SET: V3 = v3(-1.35, 9.86, -2.72);
const POUR_AT: V3 = v3(-1.22, 10.02, -2.92);
const CUP: V3 = v3(-1.25, 9.8, -3.12);
const BREAD_AT: V3 = v3(-1.8, 9.84, -2.7);
const KID_CUP: V3 = v3(7.45, 9.47, -1.62);
const CATCH: V3 = v3(4.85, 9.75, -1.45);
const COUNTER_COIN: V3 = v3(-4.3, 1.055, -2.42);
const TILL: V3 = v3(-4.38, 1.27, -2.85);
const LOAF_SHELF: V3 = v3(-5.12, 1.32, -2.45);
const DESK_PHONE: V3 = v3(4.55, 12.785, -2.3);
const CRANK: V3 = v3(4.35, 0.66, -2.0);

impl Cast {
    pub fn new() -> Cast {
        let mut world = World {
            lift_start: 9.0,
            ..World::default()
        };
        let mut k = Keys::default();

        // P, first: the argument, then she makes peace with the teapot.
        let mut p = Plan::new(0.0, v3(-2.53, 9.0, -3.0), FRAC_PI_2, true, 0.95, 4.6);
        p.quick = 0.8;
        p.wait_until(6.0).mark("p_rise").rise(1.0).wait(0.5);
        p.walk(
            &[[-2.6, -2.3], [-1.6, -2.25], [-0.95, -2.45]],
            flat,
            WALKING,
        );
        p.turn_to(-2.82).mark("pour");
        k.p_rise = p.when("p_rise");
        k.pour = p.when("pour");
        k.sip = k.pour + 2.4;
        k.rise = k.sip + 2.6;

        // H: the kitchen, the lift, the street and the tram.
        let mut h = Plan::new(0.0, v3(-1.15, 9.0, -3.0), -FRAC_PI_2, true, 1.0, 4.2);
        h.wait_until(k.rise).rise(1.4);
        h.walk(
            &[
                [-0.85, -3.7],
                [-3.4, -3.7],
                [-4.6, -2.6],
                [-5.3, -1.5],
                [-6.4, -1.4],
                [-7.1, -1.1],
                [-8.25, -1.25],
            ],
            flat,
            WALKING,
        );
        h.turn_to(FRAC_PI_2).mark("press").wait(0.7);
        k.press = h.when("press");
        k.lift0 = k.press + 0.9;
        world.lift.push([k.lift0, k.lift0 + 4.0, 9.0, 0.0]);
        h.wait_until(k.lift0);
        h.ride_until(Ride::Lift, k.lift0 + 4.0, &world).wait(0.7);
        h.walk(
            &[[-7.0, -1.0], [-6.8, 0.3], [-6.6, 2.0]],
            crate::cast::street,
            WALKING,
        );
        h.mark("kerb").wait(1.0);
        k.kerb = h.when("kerb");
        h.walk(&[[-6.6, 6.3], [-7.3, 6.75], [-9.0, 6.75]], street, WALKING);
        // He is on the rails 2.3 m along: the tram brakes, honks, stops
        // past him.
        k.rails = h.last_way().time_at(2.3);
        k.honk = k.rails - 0.2;
        world.tram.enter = k.rails - 1.34;
        world.tram.stop1 = world.tram.enter + crate::act::BRAKE;
        h.turn_to(PI);
        let stop1 = world.tram.stop1;
        h.wait_until(h.t.max(stop1 + 1.0));
        h.walk(&[[-9.0, 4.9]], boarding, WALKING);
        h.turn_to(0.0).mark("board");
        k.board = h.when("board");
        world.tram.go1 = h.t + 0.3;
        world.tram.stop2 = world.tram.go1 + 4.5;
        let stop2 = world.tram.stop2;
        // It waits at the second stop until he is off (set below).
        world.tram.go2 = stop2 + 100.0;
        h.ride_until(Ride::Tram, stop2 + 1.0, &world);
        h.walk(&[[h.at.x, 6.6]], boarding, WALKING);
        h.mark("alight");
        k.alight = h.when("alight");
        world.tram.go2 = h.t + 0.3;
        h.turn_to(PI).wait_until(world.tram.go2 + 2.2);

        // The shop.
        h.walk(
            &[[-1.2, 5.4], [-1.2, 0.3], [-1.4, -1.2], [-2.65, -2.3]],
            street,
            WALKING,
        );
        h.turn_to(-FRAC_PI_2).mark("queue");
        k.queue = h.when("queue");
        let q = k.queue;
        h.wait_until(q + 5.8);
        h.walk(&[[-3.75, -2.3]], flat, STROLL);
        h.turn_to(-FRAC_PI_2);
        h.wait_until(q + 15.4);
        h.walk(&[[-2.0, -1.2], [-1.4, -0.4]], street, WALKING);
        h.mark("shop_out");
        k.shop_out = h.when("shop_out");

        // Home: along the sidewalk to his door, into the lobby, the lift
        // (still on the ground floor since the morning) up to his floor.
        h.walk(
            &[
                [-1.3, 0.8],
                [-6.0, 0.9],
                [-6.8, 0.3],
                [-7.0, -1.0],
                [-8.25, -1.25],
            ],
            street,
            WALKING,
        );
        h.turn_to(FRAC_PI_2).mark("home").wait(0.7);
        k.home = h.when("home");
        world.lift.push([k.home + 0.9, k.home + 4.9, 0.0, 9.0]);
        h.wait_until(k.home + 0.9);
        h.ride_until(Ride::Lift, k.home + 4.9, &world).wait(0.6);
        h.walk(
            &[[-7.1, -1.1], [-6.4, -1.4], [-5.0, -1.55], [-1.8, -2.15]],
            flat,
            WALKING,
        );
        h.turn_to(PI).mark("bread").wait(1.8);
        k.bread = h.when("bread");
        h.walk(
            &[[0.6, -1.6], [1.6, -1.5], [2.6, -1.5], [4.5, -1.7]],
            flat,
            WALKING,
        );
        h.mark("arrive");
        k.arrive = h.when("arrive");
        k.trip = k.arrive + 1.7;
        k.catch = k.trip + 0.55;
        h.wait_until(k.catch + 2.6);

        // Up the stair to his desk.
        h.walk(&[[3.9, -3.3], [4.0, -4.08]], flat, WALKING);
        h.mark("stairs");
        k.stairs = h.when("stairs");
        let zs: Vec<f32> = (1..=14)
            .map(|i| 0.3 + (i as f32 - 0.5) * TREAD)
            .chain([4.3])
            .collect();
        h.climb([8.3, -4.08], &zs, stair_floor, stair_ramp, 3.0, CLIMBING);
        h.walk(&[[8.3, -3.0], [3.9, -3.0]], flat, WALKING);
        h.turn_to(0.0).sit(1.4).mark("desk");
        k.desk = h.when("desk");
        h.wait_until(k.desk + 7.0).rise(1.2);

        // Out through the bedroom to the stairwell. On the landing he
        // presses the call (the cage waits on his floor below), walks to the
        // gate as it comes up, steps in and rides to the roof.
        h.walk(
            &[
                [2.8, -3.0],
                [2.3, -1.6],
                [1.6, -1.5],
                [1.3, -2.1],
                [-4.6, -2.1],
                [-5.6, -1.5],
            ],
            flat,
            WALKING,
        );
        h.mark("call");
        k.call = h.when("call");
        world.lift.push([k.call + 0.3, k.call + 2.1, 9.0, 12.0]);
        h.walk(&[[-6.6, -1.3], [-7.15, -1.1]], flat, WALKING);
        h.wait_until(h.t.max(k.call + 2.3));
        h.walk(&[[-8.25, -1.25]], flat, WALKING);
        h.turn_to(FRAC_PI_2);
        let up = h.t + 0.2;
        h.wait_until(up);
        world.lift.push([up, up + 2.2, 12.0, 15.0]);
        h.ride_until(Ride::Lift, up + 2.2, &world).wait(0.3);

        // The roof: a run round the track at sunset.
        h.walk(&[[-7.0, -1.2], [-6.3, -1.2]], flat, WALKING);
        h.mark("roof");
        k.roof = h.when("roof");
        // Someone below calls the empty cage back down.
        world.lift.push([k.roof + 6.0, k.roof + 10.0, 15.0, 9.0]);
        let mut lap = vec![[-2.3, -1.25], [6.5, -1.25]];
        for i in 1..=7 {
            let a = PI * i as f32 / 8.0;
            lap.push([6.5 + 1.25 * a.sin(), -2.5 + 1.25 * a.cos()]);
        }
        lap.extend([[6.5, -3.75], [2.1, -3.75]]);
        h.mark("run");
        k.run = h.when("run");
        h.walk(&lap, flat, RUNNING);
        h.mark("run_end");
        k.run_end = h.when("run_end");
        h.turn_to(0.3).wait_until(LOOP + 10.0);

        // P again: she takes the teapot back and sits down.
        p.wait_until(k.rise + 1.8).mark("p_back");
        k.p_back = p.when("p_back");
        p.wait(1.0);
        p.walk(&[[-1.6, -2.25], [-2.6, -2.3], [-2.53, -3.0]], flat, WALKING);
        p.turn_to(FRAC_PI_2)
            .wait(0.9)
            .sit(1.4)
            .wait_until(LOOP + 10.0);

        // The child: plays at the low table, runs to him with the cup and
        // trips; takes it back and goes back to play.
        let build_child = |c0: f32| {
            let mut c = Plan::new(0.0, v3(7.15, 9.0, -1.5), FRAC_PI_2, false, 0.6, 2.6);
            c.quick = 0.6;
            c.wait_until(c0).mark("c0").wait(0.9);
            c.turn_to(-FRAC_PI_2);
            c.walk(&[[5.3, -1.5]], flat, DASH);
            c
        };
        let probe = build_child(50.0);
        let trip0 = probe.last_way().walk.steps().last().map_or(0.0, |s| s.land) - 0.62 + 0.3;
        k.c0 = 50.0 + (k.trip - trip0);
        let mut c = build_child(k.c0);
        c.wait_until(k.catch + 2.4);
        c.walk(&[[7.15, -1.5]], flat, WALKING);
        c.turn_to(FRAC_PI_2).wait_until(LOOP + 10.0);

        // K behind the counter: L's purchase, then his.
        let mut kp = Plan::new(0.0, v3(-4.82, 0.0, -2.45), FRAC_PI_2, false, 1.0, 4.4);
        kp.wait_until(q - 3.0).turn_by(PI).wait(0.6).turn_by(-PI);
        kp.wait_until(q + 10.6)
            .turn_by(PI)
            .wait(0.7)
            .turn_by(-PI)
            .wait_until(LOOP + 10.0);

        // L: in from the sidewalk, buys, steps aside, leaves for the tram.
        let mut l = Plan::new(0.0, v3(-3.6, 0.0, 1.0), PI, false, 0.92, 4.9);
        l.wait_until(q - 13.0);
        l.walk(
            &[
                [-1.9, 1.0],
                [-1.2, 0.4],
                [-1.2, -0.5],
                [-2.2, -1.9],
                [-3.75, -2.3],
            ],
            street,
            STROLL,
        );
        l.turn_to(-FRAC_PI_2).wait_until(q + 0.8);
        l.walk(&[[-3.6, -1.6], [-3.4, -1.0]], flat, STROLL);
        l.turn_to(0.0).wait_until(q + 30.0);
        l.walk(
            &[
                [-2.2, -0.9],
                [-1.2, -0.4],
                [-1.2, 0.9],
                [-8.0, 1.0],
                [-16.5, 1.0],
            ],
            street,
            STROLL,
        );
        l.wait_until(LOOP + 10.0);

        // On the tram: a youth with his phone, the driver.
        let c0 = world.tram_c(0.0);
        let mut y = Plan::new(0.0, v3(c0 - 1.5, 0.22, 4.3), 0.0, false, 0.97, 3.9);
        y.ride_until(Ride::Tram, LOOP + 10.0, &world);
        let mut d = Plan::new(0.0, v3(c0 + 3.7, 0.22, 4.3), FRAC_PI_2, true, 1.0, 4.8);
        d.ride_until(Ride::Tram, LOOP + 10.0, &world);

        // The neighbours at home.
        let mut o = Plan::new(0.0, v3(-2.2, 3.0, -2.03), 0.0, true, 0.98, 5.4);
        o.wait_until(LOOP + 10.0);
        let mut v = Plan::new(0.0, v3(5.2, 3.0, -2.33), 0.0, true, 0.9, 4.4);
        v.wait_until(LOOP + 10.0);
        let mut g = Plan::new(0.0, v3(-4.1, 6.0, -1.25), -FRAC_PI_2, false, 0.95, 4.7);
        g.wait_until(60.0)
            .walk(&[[-3.4, -0.6], [-1.4, -0.6]], flat, STROLL);
        g.turn_to(FRAC_PI_2).wait_until(100.0);
        g.walk(&[[0.1, -1.9]], flat, STROLL);
        g.turn_to(1.21).wait_until(135.0);
        g.walk(&[[-1.4, -0.6], [-3.4, -0.6], [-4.1, -1.25]], flat, STROLL);
        g.turn_to(-FRAC_PI_2).wait_until(LOOP + 10.0);
        let mut a = Plan::new(0.0, v3(6.0, 6.0, -2.1), -1.85, false, 1.0, 4.3);
        a.wait_until(70.0).walk(&[[6.6, -1.3]], flat, STROLL);
        a.turn_to(-2.3).wait_until(80.0);
        a.walk(&[[6.0, -2.1]], flat, STROLL);
        a.turn_to(-1.85).wait_until(LOOP + 10.0);
        let mut m = Plan::new(0.0, v3(4.3, 0.0, -1.45), PI, false, 1.02, 4.5);
        m.wait_until(LOOP + 10.0);

        let plans = vec![h, p, c, kp, l, y, d, o, v, g, a, m];
        Cast {
            world,
            plans,
            keys: k,
        }
    }

    /// Everyone at story time `s` (−10 … LOOP + 10).
    pub fn moment(&self, s: f32, hero_breath: f32) -> Moment {
        let k = &self.keys;
        let mut figures = Vec::with_capacity(PEOPLE);
        let mut held = Held {
            teapot: TEAPOT,
            teapot_tilt: 0.0,
            cup: CUP,
            kid_cup: KID_CUP,
            kid_cup_spin: 0.0,
            loaf: LOAF_SHELF,
            coin: v3(0.0, -60.0, 0.0),
            phone: DESK_PHONE,
            chair: v3(-0.75 + 0.3 * smooth(k.rise, k.rise + 1.0, s), 9.0, -3.0),
            can: v3(0.0, -60.0, 0.0),
            can_tilt: 0.0,
            brush: [v3(0.0, -60.0, 0.0); 2],
            bow: [v3(0.0, -60.0, 0.0); 2],
            wrench: [v3(0.0, -60.0, 0.0); 2],
        };
        let mut bodies: Vec<Body> = Vec::with_capacity(PEOPLE);
        for (i, plan) in self.plans.iter().enumerate() {
            let act = plan.act_at(s);
            let carried = self.world.carried(act.ride, act.t0, s);
            let local = act.local(s, carried);
            let breath = if i == HERO {
                hero_breath
            } else {
                0.5 + 0.5 * (TAU * s / (3.6 + 0.37 * i as f32) + i as f32).sin()
            };
            let mut pose = act.pose(s, breath);
            pose.hair = HAIR[i].0;
            self.gestures(i, s, &mut pose, &local);
            let body = act.body(s, &pose, carried);
            bodies.push(body);
        }
        self.place_held(s, &bodies, &mut held);
        for (i, body) in bodies.into_iter().enumerate() {
            let plan = &self.plans[i];
            let mut seen = 1.0;
            if matches!(i, YOUTH | DRIVER | LADY) {
                seen *= 1.0 - smooth(14.8, 15.4, body.pelvis.x.abs());
            }
            figures.push(Figure {
                body,
                seen,
                accent: if i == HERO { 1.0 } else { 0.0 },
                clothes: CLOTHES[i],
                scale: plan.k,
                hair: f32::from(HAIR[i].0.code() * 8 + HAIR[i].1),
            });
        }
        Moment { figures, held }
    }

    fn gestures(&self, i: usize, s: f32, pose: &mut Pose, local: &Local) {
        let k = &self.keys;
        let q = k.queue;
        match i {
            HERO => {
                // The argument: he answers with his hands, then looks away.
                let argue = window(s, 3.0, 3.4, 6.2, 6.8);
                pose.arms[0] += 0.5 * argue * (0.6 + 0.4 * (TAU * s / 1.1).sin());
                pose.arms[1] += 0.45 * argue * (0.6 + 0.4 * (TAU * s / 1.3 + 1.0).sin());
                pose.bend = pose.bend.map(|b| b + 0.6 * argue);
                pose.turn += -0.35 * window(s, 6.6, 7.2, k.pour - 0.6, k.pour);
                let p_head = v3(-2.95, 10.2, -3.0);
                look(pose, local, p_head, window(s, 2.6, 3.0, 6.2, 6.6));
                look(
                    pose,
                    local,
                    v3(-1.0, 10.3, -2.45),
                    window(s, k.pour - 0.4, k.pour, k.pour + 1.6, k.pour + 2.0),
                );
                // The tea: up to his lips and back.
                let sip = window(s, k.sip, k.sip + 0.7, k.sip + 1.6, k.sip + 2.2);
                let lips = local.world(pose.pelvis + v3(-0.05, 0.62, 0.22));
                let cup = lerp3(
                    CUP,
                    lips,
                    smooth(k.sip + 0.4, k.sip + 0.9, s) - smooth(k.sip + 1.4, k.sip + 1.9, s),
                );
                reach(pose, local, 1, cup, sip);
                // The lift's button.
                reach(
                    pose,
                    local,
                    0,
                    v3(-7.9, 10.2, -1.72),
                    window(
                        s,
                        k.press - 0.3,
                        k.press + 0.2,
                        k.press + 0.6,
                        k.press + 0.9,
                    ),
                );
                // At the kerb: left, right, left.
                let kerb = window(s, k.kerb, k.kerb + 0.3, k.kerb + 1.4, k.kerb + 1.8);
                pose.turn += kerb * 0.9 * (TAU * (s - k.kerb) / 1.5).sin();
                // The honk: he turns his head to it.
                let tram = v3(self.world.tram_c(s) + 4.6, 1.6, 4.3);
                look(
                    pose,
                    local,
                    tram,
                    window(s, k.honk, k.honk + 0.25, k.honk + 1.2, k.honk + 1.8),
                );
                // On the tram, a hand on the rail.
                let ride = window(
                    s,
                    k.board - 0.2,
                    k.board + 0.4,
                    self.world.tram.stop2 + 0.3,
                    self.world.tram.stop2 + 0.8,
                );
                hold(pose, 1, v3(-0.2, 1.83, -0.12), ride);
                // The coin: out of his pocket, it slips, he picks it up,
                // lays it on the counter.
                let coin_out = window(s, q + 1.0, q + 1.6, q + 2.9, q + 3.0);
                hold(pose, 1, v3(-0.12, 1.05, 0.3), coin_out);
                look(pose, local, local.world(v3(-0.12, 1.0, 0.3)), coin_out);
                let fallen = coin_floor(k);
                look(
                    pose,
                    local,
                    fallen,
                    window(s, q + 2.95, q + 3.2, q + 5.2, q + 5.6),
                );
                crouch(pose, window(s, q + 3.3, q + 4.1, q + 4.7, q + 5.5));
                reach(
                    pose,
                    local,
                    1,
                    fallen,
                    window(s, q + 3.9, q + 4.3, q + 4.6, q + 5.0),
                );
                hold(
                    pose,
                    1,
                    v3(-0.15, 1.0, 0.25),
                    window(s, q + 4.8, q + 5.3, q + 5.9, q + 6.2),
                );
                let give = window(s, q + 8.4, q + 8.9, q + 9.2, q + 9.6);
                pose.lean += 0.3 * give;
                reach(pose, local, 1, COUNTER_COIN, give);
                look(
                    pose,
                    local,
                    v3(-4.75, 1.6, -2.45),
                    window(s, q + 8.6, q + 9.0, q + 15.0, q + 15.4),
                );
                // The loaf: from K's hand, under his arm, onto the table.
                let take = keeper_hands_loaf(q);
                reach(
                    pose,
                    local,
                    1,
                    v3(-4.15, 1.15, -2.35),
                    window(s, take - 0.4, take, take + 0.3, take + 0.7),
                );
                let carry = window(s, take + 0.3, take + 0.8, k.bread + 0.2, k.bread + 0.6);
                hold(pose, 1, v3(-0.24, 0.92, 0.1), carry);
                reach(
                    pose,
                    local,
                    1,
                    BREAD_AT,
                    window(
                        s,
                        k.bread + 0.1,
                        k.bread + 0.6,
                        k.bread + 0.9,
                        k.bread + 1.3,
                    ),
                );
                look(
                    pose,
                    local,
                    v3(-2.95, 10.2, -3.0),
                    window(
                        s,
                        k.bread + 1.2,
                        k.bread + 1.6,
                        k.bread + 2.0,
                        k.bread + 2.6,
                    ),
                );
                // The cup: he sees it fall, crouches and catches it.
                let c = k.catch;
                look(
                    pose,
                    local,
                    v3(5.6, 9.9, -1.5),
                    window(s, k.trip - 0.6, k.trip - 0.2, c - 0.3, c),
                );
                crouch(
                    pose,
                    0.55 * window(s, k.trip + 0.05, c - 0.05, c + 0.6, c + 1.4),
                );
                reach(
                    pose,
                    local,
                    1,
                    cup_flight(k, s),
                    window(s, k.trip + 0.05, c - 0.1, c + 0.1, c + 0.2),
                );
                let back = v3(4.95, 9.7, -1.58);
                reach(
                    pose,
                    local,
                    1,
                    lerp3(CATCH, back, smooth(c + 0.3, c + 1.6, s)),
                    window(s, c, c + 0.1, c + 2.0, c + 2.4),
                );
                look(
                    pose,
                    local,
                    v3(5.3, 9.6, -1.5),
                    window(s, c + 0.3, c + 0.8, c + 2.2, c + 2.8),
                );
                // The desk: typing, the phone, his temples, the calendar.
                let d = k.desk;
                let typing = window(s, d + 0.2, d + 0.8, d + 2.4, d + 2.8)
                    + window(s, d + 4.6, d + 5.0, d + 7.0, d + 7.6);
                let tap = |x: f32, ph: f32| {
                    v3(x, 12.8 + 0.02 * (TAU * s / 0.23 + ph).sin().max(0.0), -2.68)
                };
                reach(pose, local, 0, tap(4.02, 0.0), typing);
                reach(pose, local, 1, tap(3.78, 1.7), typing);
                let phone = window(s, d + 2.5, d + 3.0, d + 4.1, d + 4.5);
                let ear = local.world(pose.pelvis + v3(0.12, 0.7, 0.05));
                reach(
                    pose,
                    local,
                    0,
                    lerp3(
                        DESK_PHONE,
                        ear,
                        smooth(d + 2.7, d + 3.1, s) - smooth(d + 3.8, d + 4.2, s),
                    ),
                    phone,
                );
                let temples = window(s, d + 5.2, d + 5.6, d + 6.4, d + 6.9);
                reach(
                    pose,
                    local,
                    0,
                    local.world(pose.pelvis + v3(0.11, 0.78, 0.12)),
                    temples,
                );
                reach(
                    pose,
                    local,
                    1,
                    local.world(pose.pelvis + v3(-0.11, 0.78, 0.12)),
                    temples,
                );
                pose.nod += 0.3 * temples;
                look(
                    pose,
                    local,
                    v3(5.3, 13.55, -4.58),
                    window(s, d + 1.2, d + 1.6, d + 2.0, d + 2.4),
                );
                look(
                    pose,
                    local,
                    v3(4.0, 12.95, -2.45),
                    window(s, d + 0.1, d + 0.5, d + 7.4, d + 7.8) * 0.7,
                );
                // After the run: hands on knees, then up to the sunset.
                let e = k.run_end;
                let blown = window(s, e + 0.5, e + 1.0, e + 3.2, e + 4.0);
                crouch(pose, 0.28 * blown);
                let knee = |x: f32| v3(x, 0.52, 0.28);
                hold(pose, 0, knee(0.11), blown);
                hold(pose, 1, knee(-0.11), blown);
                pose.nod -= 0.25 * smooth(e + 4.0, e + 6.0, s);
            }
            PARTNER => {
                let argue = window(s, 2.8, 3.2, 6.0, 6.5);
                pose.arms[1] += 0.55 * argue * (0.5 + 0.5 * (TAU * s / 0.9).sin());
                pose.bend[1] += 0.7 * argue;
                look(
                    pose,
                    local,
                    v3(-0.75, 10.15, -3.0),
                    window(s, 2.6, 3.0, 6.3, 6.8),
                );
                // The teapot: from the table, over his cup, set down.
                let lift = window(
                    s,
                    k.p_rise + 0.6,
                    k.p_rise + 1.0,
                    k.pour + 1.3,
                    k.pour + 1.7,
                );
                let tp = self.teapot_path(s);
                reach(pose, local, 0, tp + v3(0.0, 0.1, 0.0), lift);
                pose.lean +=
                    0.25 * window(s, k.pour - 0.2, k.pour + 0.2, k.pour + 1.1, k.pour + 1.5);
                look(
                    pose,
                    local,
                    CUP,
                    window(s, k.pour - 0.4, k.pour, k.pour + 1.2, k.pour + 1.6),
                );
                // Her hand on his shoulder while he drinks.
                let shoulder = v3(-0.73, 10.2, -2.82);
                reach(
                    pose,
                    local,
                    1,
                    shoulder,
                    window(s, k.pour + 1.6, k.pour + 2.1, k.rise - 0.4, k.rise + 0.1),
                );
                look(
                    pose,
                    local,
                    v3(-0.73, 10.3, -3.0),
                    window(s, k.pour + 1.6, k.pour + 2.0, k.rise, k.rise + 0.8),
                );
                // The teapot back.
                let back = window(
                    s,
                    k.p_back + 0.2,
                    k.p_back + 0.6,
                    k.p_back + 5.6,
                    k.p_back + 6.1,
                );
                reach(
                    pose,
                    local,
                    0,
                    self.teapot_path(s) + v3(0.0, 0.1, 0.0),
                    back,
                );
                // She looks up at him when he brings the bread.
                look(
                    pose,
                    local,
                    v3(-1.8, 10.6, -2.15),
                    window(s, k.bread - 0.4, k.bread, k.bread + 2.2, k.bread + 2.8),
                );
            }
            CHILD => {
                let c0 = k.c0;
                // Playing on the floor, then up with the cup.
                let play = 1.0 - window(s, c0 - 0.2, c0 + 0.6, k.catch + 3.6, k.catch + 7.0);
                crouch(pose, 0.85 * play);
                let blocks = local.world(v3(0.05 + 0.04 * (TAU * s / 2.3).sin(), 0.3, 0.35));
                reach(pose, local, 0, blocks, play * 0.8);
                reach(
                    pose,
                    local,
                    1,
                    KID_CUP,
                    window(s, c0 - 0.3, c0 + 0.1, c0 + 0.3, c0 + 0.6),
                );
                // Running with it held up.
                hold(
                    pose,
                    1,
                    v3(-0.16, 1.02, 0.32),
                    window(s, c0 + 0.4, c0 + 0.8, k.trip - 0.05, k.trip + 0.05),
                );
                // The trip.
                let trip = window(s, k.trip - 0.1, k.trip + 0.05, k.trip + 0.5, k.trip + 1.2);
                pose.lean += 0.7 * trip;
                pose.arms = pose.arms.map(|a| a + 0.9 * trip);
                pose.pelvis.y -= 0.12 * trip;
                // Takes the cup back, carries it home and sets it down.
                let cc = k.catch;
                reach(
                    pose,
                    local,
                    1,
                    v3(4.95, 9.7, -1.58),
                    window(s, cc + 1.7, cc + 2.0, cc + 2.2, cc + 2.6),
                );
                hold(
                    pose,
                    1,
                    v3(-0.15, 0.95, 0.3),
                    window(s, cc + 2.2, cc + 2.6, cc + 5.0, cc + 5.6),
                );
                reach(
                    pose,
                    local,
                    1,
                    KID_CUP,
                    window(s, cc + 5.0, cc + 5.6, cc + 6.0, cc + 6.4),
                );
                look(
                    pose,
                    local,
                    v3(4.6, 10.4, -1.7),
                    window(s, k.arrive - 0.5, k.arrive, cc + 2.6, cc + 3.2),
                );
            }
            KEEPER => {
                // L's coin to the till, the loaf from the shelf to her.
                reach(
                    pose,
                    local,
                    0,
                    TILL,
                    window(s, q - 4.6, q - 4.2, q - 3.9, q - 3.5),
                );
                reach(
                    pose,
                    local,
                    1,
                    LOAF_SHELF,
                    window(s, q - 2.5, q - 2.2, q - 2.0, q - 1.7),
                );
                reach(
                    pose,
                    local,
                    1,
                    v3(-4.15, 1.15, -2.3),
                    window(s, q - 1.1, q - 0.7, q - 0.2, q + 0.2),
                );
                // His coin, his loaf.
                let coin = window(s, q + 9.5, q + 9.8, q + 10.1, q + 10.4);
                pose.lean += 0.25 * coin + 0.25 * window(s, q - 4.6, q - 4.2, q - 3.9, q - 3.5);
                reach(
                    pose,
                    local,
                    0,
                    lerp3(COUNTER_COIN, TILL, smooth(q + 9.8, q + 10.2, s)),
                    coin,
                );
                reach(
                    pose,
                    local,
                    1,
                    LOAF_SHELF,
                    window(s, q + 12.0, q + 12.3, q + 12.6, q + 12.9),
                );
                let hand = keeper_hands_loaf(q);
                reach(
                    pose,
                    local,
                    1,
                    v3(-4.25, 1.17, -2.35),
                    window(s, hand - 0.9, hand - 0.4, hand + 0.1, hand + 0.5),
                );
                let customer = if s < q + 2.0 {
                    v3(-3.75, 1.6, -2.3)
                } else {
                    v3(-3.75, 1.7, -2.3)
                };
                look(pose, local, customer, 0.6);
            }
            LADY => {
                let pay = window(s, q - 5.4, q - 5.0, q - 4.8, q - 4.4);
                pose.lean += 0.3 * pay;
                reach(pose, local, 1, COUNTER_COIN, pay);
                reach(
                    pose,
                    local,
                    1,
                    v3(-4.15, 1.15, -2.3),
                    window(s, q - 0.9, q - 0.5, q - 0.2, q + 0.2),
                );
                hold(
                    pose,
                    1,
                    v3(-0.22, 0.95, 0.12),
                    window(s, q + 0.1, q + 0.5, LOOP + 5.0, LOOP + 6.0),
                );
                // Aside, she watches him chase his coin.
                look(
                    pose,
                    local,
                    coin_floor(k),
                    window(s, q + 3.0, q + 3.4, q + 5.4, q + 6.0),
                );
            }
            YOUTH => {
                // His thumb on the screen; the horn lifts his eyes from it.
                pose.carry = Carry::Screen(1.0);
                let thumb = 0.015 * (TAU * s / 1.7).sin().max(0.0);
                hold(pose, 1, v3(-0.08, 1.12 + thumb, 0.3), 1.0);
                hold(pose, 0, v3(0.2, 1.72, 0.05), 1.0);
                pose.nod = 0.45;
                pose.turn = -0.2;
                look(
                    pose,
                    local,
                    v3(-4.0, 1.4, 6.4),
                    window(s, k.honk - 0.1, k.honk + 0.4, k.honk + 1.8, k.honk + 2.6),
                );
            }
            DRIVER => {
                hold(pose, 0, v3(0.18, 0.95, 0.42), 1.0);
                hold(pose, 1, v3(-0.18, 0.95, 0.42), 1.0);
                look(
                    pose,
                    local,
                    v3(-4.0, 1.4, 6.4),
                    window(s, k.honk - 1.0, k.honk - 0.4, k.honk + 1.0, k.honk + 2.0),
                );
            }
            OLD => {
                pose.turn = -0.3;
                // He dozes off; the child's fall wakes him for a moment.
                let start = window(s, k.trip + 0.1, k.trip + 0.35, k.trip + 1.6, k.trip + 3.2);
                let doze = window(s, 88.0, 92.0, 138.0, 142.0) * (1.0 - start);
                pose.nod = 0.45 * doze + 0.04 * (TAU * s / 5.4).sin() * doze;
                pose.lean += 0.08 * doze;
                hold(pose, 0, v3(0.16, 0.62, 0.32), 1.0 - doze * 0.3);
            }
            CELLIST => {
                let u = 0.28 + 0.2 * (TAU * s / 4.0).sin();
                let (frog, _) = bow_at(u);
                reach(pose, local, 1, frog, 1.0);
                reach(pose, local, 0, v3(5.27, 4.12, -2.6), 1.0);
                // Swaying with the bow.
                pose.lean += 0.15 + 0.04 * (TAU * s / 4.0).sin();
                pose.turn = 0.15 + 0.06 * (TAU * s / 8.0).sin();
                pose.nod = 0.2 + 0.05 * (TAU * s / 4.0 + 1.0).sin();
            }
            GARDENER => {
                let water =
                    window(s, 63.5, 64.5, 72.0, 73.0) + window(s, 103.0, 104.0, 112.0, 113.0);
                reach(pose, local, 1, local.world(v3(-0.25, 1.02, 0.42)), water);
                hold(pose, 1, v3(-0.24, 0.72, 0.05), 1.0 - water);
                pose.nod += 0.3 * water;
            }
            PAINTER => {
                let at = v3(
                    5.62 + 0.12 * (TAU * s / 2.7).sin(),
                    7.25 + 0.2 * (TAU * s / 1.9).sin(),
                    -2.12,
                );
                let paint = 1.0 - window(s, 69.5, 70.0, 80.0, 81.5);
                reach(pose, local, 1, at, paint);
                hold(pose, 0, v3(0.22, 1.0, 0.18), 1.0);
                look(pose, local, v3(5.3, 7.25, -2.24), 1.0);
                // A step back from the canvas, the head on one side.
                pose.lean -= 0.12 * (1.0 - paint);
                pose.turn += 0.15 * (1.0 - paint);
            }
            MECHANIC => {
                crouch(pose, 0.45);
                let a = TAU * s / 1.4;
                let crank = CRANK + v3(0.1 * a.cos(), 0.1 * a.sin(), 0.06);
                reach(pose, local, 1, crank, 1.0);
                reach(pose, local, 0, v3(4.1, 0.95, -1.95), 1.0);
                look(pose, local, CRANK, 1.0);
            }
            _ => {}
        }
    }

    /// The teapot in her hand: up off the table, over his cup, set down by
    /// it; later back to its place.
    fn teapot_path(&self, s: f32) -> V3 {
        let k = &self.keys;
        let up = TEAPOT + v3(0.0, 0.12, 0.0);
        if s < k.p_back {
            let a = smooth(k.p_rise + 0.9, k.p_rise + 1.3, s);
            let walk = smooth(k.p_rise + 1.5, k.pour - 0.3, s);
            let over = smooth(k.pour - 0.3, k.pour + 0.2, s);
            let set = smooth(k.pour + 1.1, k.pour + 1.6, s);
            let p = lerp3(TEAPOT, up, a);
            let carried = lerp3(p, v3(-1.5, 10.05, -2.6), walk);
            let poured = lerp3(carried, POUR_AT, over);
            lerp3(poured, TEAPOT_SET, set)
        } else {
            let take = smooth(k.p_back + 0.4, k.p_back + 0.8, s);
            let walk = smooth(k.p_back + 1.0, k.p_back + 4.6, s);
            let set = smooth(k.p_back + 5.2, k.p_back + 5.8, s);
            let p = lerp3(TEAPOT_SET, TEAPOT_SET + v3(0.0, 0.12, 0.0), take);
            let carried = lerp3(p, up, walk);
            lerp3(carried, TEAPOT, set)
        }
    }

    fn place_held(&self, s: f32, bodies: &[Body], held: &mut Held) {
        let k = &self.keys;
        let q = k.queue;
        let h = &bodies[HERO];
        // The teapot rides in her hand while she holds it.
        held.teapot = self.teapot_path(s);
        held.teapot_tilt = 0.9 * window(s, k.pour, k.pour + 0.3, k.pour + 0.8, k.pour + 1.1);
        // His cup.
        let sip = window(s, k.sip + 0.35, k.sip + 0.5, k.sip + 1.9, k.sip + 2.05);
        if sip > 0.0 {
            held.cup = grip(h, 1) - v3(0.0, 0.05, 0.0);
        }
        // The child's cup: in her hand, flying, caught, back.
        let kid = &bodies[CHILD];
        let cc = k.catch;
        if s > k.c0 + 0.1 && s < k.trip {
            held.kid_cup = grip(kid, 1) + v3(0.0, 0.03, 0.0);
        } else if s >= k.trip && s < cc {
            held.kid_cup = cup_flight(k, s);
            held.kid_cup_spin = 7.0 * (s - k.trip);
        } else if s >= cc && s < cc + 2.1 {
            held.kid_cup = grip(h, 1) + v3(0.0, 0.03, 0.0);
            held.kid_cup_spin = 7.0 * 0.55;
        } else if s >= cc + 2.1 && s < cc + 5.9 {
            held.kid_cup = grip(kid, 1) + v3(0.0, 0.03, 0.0);
        }
        // The coin.
        let fallen = coin_floor(k);
        if s > q + 1.3 && s < q + 2.9 {
            held.coin = grip(h, 1);
        } else if s >= q + 2.9 && s < q + 4.45 {
            let u = s - (q + 2.9);
            let from = v3(-2.77, 1.0, -2.3);
            let drop = (from.y - 0.012).max(0.0);
            let t_fall = (2.0 * drop / 9.8).sqrt();
            if u < t_fall {
                held.coin = from.lerp(fallen, u / t_fall) + v3(0.0, 0.0, 0.0);
                held.coin.y = from.y - 4.9 * u * u;
            } else {
                // A bounce and a short roll.
                let b = u - t_fall;
                let hop = (0.06 - 4.9 * (b - 0.11) * (b - 0.11)).max(0.0) * smooth(0.0, 0.02, b);
                held.coin = v3(fallen.x, 0.012 + hop, fallen.z);
            }
        } else if s >= q + 4.45 && s < q + 9.1 {
            held.coin = grip(h, 1);
        } else if s >= q + 9.1 && s < q + 9.9 {
            held.coin = COUNTER_COIN;
        } else if s >= q + 9.9 && s < q + 10.3 {
            held.coin = grip(&bodies[KEEPER], 0);
        }
        // The loaf.
        let take = keeper_hands_loaf(q);
        let kp = &bodies[KEEPER];
        if s > q + 12.4 && s < take + 0.3 {
            held.loaf = grip(kp, 1) + v3(0.0, 0.04, 0.0);
        } else if s >= take + 0.3 && s < k.bread + 0.8 {
            held.loaf = grip(h, 1) + v3(0.0, 0.04, 0.0);
        } else if s >= k.bread + 0.8 {
            held.loaf = BREAD_AT;
        }
        // The phone at his ear.
        let d = k.desk;
        if s > d + 2.85 && s < d + 4.25 {
            held.phone = grip(h, 0);
        }
        // The gardener's can, the painter's brush, the cellist's bow, the
        // mechanic's wrench.
        let g = &bodies[GARDENER];
        held.can = grip(g, 1) - v3(0.0, 0.12, 0.0);
        held.can_tilt =
            0.7 * (window(s, 63.5, 64.5, 72.0, 73.0) + window(s, 103.0, 104.0, 112.0, 113.0));
        let a = &bodies[PAINTER];
        let b = grip(a, 1);
        held.brush = [b, b + (b - a.chest).normalize() * 0.22];
        let u = 0.28 + 0.2 * (TAU * s / 4.0).sin();
        let (_, tip) = bow_at(u);
        let v = &bodies[CELLIST];
        held.bow = [grip(v, 1), tip];
        let m = &bodies[MECHANIC];
        let w = grip(m, 0);
        held.wrench = [w, w + v3(-0.12, -0.08, -0.05)];
    }
}

impl Default for Cast {
    fn default() -> Self {
        Cast::new()
    }
}

/// Each person's hair: its cut and its shade, 0 black … 7 grey.
const HAIR: [(Hair, u8); PEOPLE] = [
    (Hair::Short, 1),
    (Hair::Long, 2),
    (Hair::Short, 4),
    (Hair::Short, 5),
    (Hair::Bun, 6),
    (Hair::Short, 0),
    (Hair::Cap, 1),
    (Hair::Bald, 7),
    (Hair::Long, 0),
    (Hair::Cap, 3),
    (Hair::Bun, 2),
    (Hair::Cap, 1),
];

const CLOTHES: [f32; PEOPLE] = [
    0.32, 0.72, 0.9, 0.55, 0.62, 0.18, 0.4, 0.5, 0.15, 0.68, 0.85, 0.28,
];

/// K holds the loaf out to him here.
fn keeper_hands_loaf(q: f32) -> f32 {
    q + 14.5
}

/// Where his coin lies after it rolled.
fn coin_floor(_k: &Keys) -> V3 {
    v3(-3.02, 0.012, -2.18)
}

/// The cellist's bow `u` of the way: its frog (in her hand) and its tip.
fn bow_at(u: f32) -> (V3, V3) {
    let contact = v3(5.2, 3.62, -2.33);
    let dir = v3(1.0, -0.15, 0.1).normalize();
    (contact - dir * u, contact + dir * (0.72 - u))
}

/// The child's cup between the trip and the catch: thrown from her hand,
/// it falls into his.
fn cup_flight(k: &Keys, s: f32) -> V3 {
    let p0 = v3(5.45, 9.68, -1.48);
    let d = k.catch - k.trip;
    let u = (s - k.trip).clamp(0.0, d);
    // Up and over: g pulls it into his hand at `CATCH` after `d`.
    let g = 9.8;
    let v0 = (CATCH - p0) * (1.0 / d) + v3(0.0, 0.5 * g * d, 0.0);
    p0 + v0 * u + v3(0.0, -0.5 * g * u * u, 0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_day_fits_the_loop() {
        let cast = Cast::new();
        let k = cast.keys;
        println!("{k:#?}");
        assert!(k.run_end < 158.0 + crate::DAY_EXTRA, "{}", k.run_end);
        assert!(k.c0 > k.bread, "{} {}", k.c0, k.bread);
        assert!(cast.world.tram.stop1 > k.rails);
    }

    #[test]
    fn everyone_stays_finite() {
        let cast = Cast::new();
        for i in 0..400 {
            let s = i as f32 * 0.45 - 5.0;
            let m = cast.moment(s, 0.5);
            for (n, f) in m.figures.iter().enumerate() {
                for c in f.body.cones.iter() {
                    assert!(c.iter().all(|v| v.is_finite()), "{n} at {s}");
                }
            }
        }
    }
}
