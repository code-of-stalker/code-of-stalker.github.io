//! The people of the house and their day: the hero (H), his wife (P), his
//! child, the shopkeeper (K) and the lady before him in the queue (L), a
//! youth and the driver on the tram, the old man, the cellist, the
//! gardener, the painter and the mechanic. Each lives by a `Plan` of acts;
//! here their hands, heads and the things they carry are added on top.
//! Times are story times (`story::story_time` slows the cup's fall).
use crate::act::{
    flat, turn_between, Bike, Gait, Local, Plan, Ride, World, BACK_AFTER, BACK_BRAKE, BIKE_HOME,
    BIKE_IN, BIKE_STOP, BIKE_Z, BRAKE, CLIMBING, GRIP, SADDLE, SEAT_AT, STROLL, WALKING,
};
use crate::body::{build, foot_on, Body, Carry, Hair, Pose, HANDS, STAND};
use crate::math::{min_jerk, mix, smooth, smooth_integral, v3, window, V3, Y};
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

/// His rim's warm glow; his echoes in the finale glow at 1.
pub const HERO_ACCENT: f32 = 0.5;

/// One person in a frame: the body, how much of it shows, the accent (0
/// for the others, `HERO_ACCENT` for him, 1 for his echoes in the finale:
/// they glow), the clothes' shade and the size.
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

/// The hand on `side` aims its wrist at `w` (the walk's frame), `a` of the
/// way: what it reached for before keeps its share, so one reach hands
/// over to the next without a jump.
fn aim(pose: &mut Pose, side: usize, w: V3, a: f32) {
    let a = a.clamp(0.0, 1.0);
    if a <= 0.001 {
        return;
    }
    let [x, y, z, old] = pose.hands[side];
    let keep = old * (1.0 - a);
    let amount = keep + a;
    let t = (v3(x, y, z) * keep + w * a) * (1.0 / amount);
    pose.hands[side] = [t.x, t.y, t.z, amount];
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
    aim(pose, side, q - d * (0.055 / len), a);
}

/// The hand on `side` held at `at` from the pelvis (as if it stood at the
/// walk's origin): it goes where the body goes, walking, riding, turning.
fn hold(pose: &mut Pose, side: usize, at: V3, a: f32) {
    let p = pose.pelvis;
    aim(
        pose,
        side,
        v3(p.x + at.x, p.y + at.y - STAND, p.z + at.z),
        a,
    );
}

/// The hand on `side` at a fixed point of the walk's frame (a seated
/// figure's knee, the hands on his knees after the run).
fn hold_at(pose: &mut Pose, side: usize, at: V3, a: f32) {
    aim(pose, side, at, a);
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

/// A grown-up down on the haunches, `c` of the way.
fn crouch(pose: &mut Pose, c: f32) {
    if c <= 0.0 {
        return;
    }
    pose.pelvis.y = mix(pose.pelvis.y, 0.42, c);
    pose.pelvis.z -= 0.2 * c;
    pose.lean += 0.95 * c;
}

/// A child's squat: low on bent knees with the back upright.
fn squat(pose: &mut Pose, c: f32) {
    if c <= 0.0 {
        return;
    }
    pose.pelvis.y = mix(pose.pelvis.y, 0.36, c);
    pose.pelvis.z -= 0.1 * c;
    pose.lean += 0.3 * c;
}

fn lerp3(a: V3, b: V3, s: f32) -> V3 {
    a.lerp(b, s.clamp(0.0, 1.0))
}

/// From `a` to `b`, `w` of the way, on a curve whose middle is `over`.
fn arc(a: V3, b: V3, over: V3, w: f32) -> V3 {
    let w = w.clamp(0.0, 1.0);
    let c = over * 2.0 - (a + b) * 0.5;
    a * ((1.0 - w) * (1.0 - w)) + c * (2.0 * w * (1.0 - w)) + b * (w * w)
}

/// The angle `w` of the way from `a` to `b`, the short way round.
fn mix_angle(a: f32, b: f32, w: f32) -> f32 {
    a + turn_between(a, b) * w
}

/// The key moments of the day, story time.
#[derive(Clone, Copy, Debug, Default)]
pub struct Keys {
    /// She lifts the kettle off the stove; pours; sets it back.
    pub kettle: f32,
    pub pour: f32,
    pub sip: f32,
    pub rise: f32,
    pub p_set: f32,
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
    pub down: f32,
    /// His bicycle: he takes it from the lamp's post, pushes off, is out of the
    /// frame on the right and back in from the left (the cut), stops by
    /// the lamp; he stands by it, the night begins.
    pub take: f32,
    pub go: f32,
    pub gone: f32,
    pub stop: f32,
    /// At the wall by his door after the tram, and after the ride.
    pub wall: f32,
    pub wall2: f32,
    pub rest: f32,
    pub p_sit: f32,
}

/// Where the things people handle are this moment.
#[derive(Clone, Copy, Debug)]
pub struct Held {
    /// The kettle's middle, how far it tips forward and which way its
    /// spout points.
    pub kettle: V3,
    pub kettle_tilt: f32,
    pub kettle_yaw: f32,
    /// Her spoon in the pot: its bowl and its end.
    pub spoon: [V3; 2],
    pub cup: V3,
    /// How far his cup tips toward his mouth, and which way.
    pub cup_tilt: f32,
    pub cup_yaw: f32,
    pub kid_cup: V3,
    pub kid_cup_spin: f32,
    /// His bread in its paper bag (the bag's bottom, its yaw), and the
    /// lady's.
    pub bag: V3,
    pub bag_yaw: f32,
    pub bag2: V3,
    pub bag2_yaw: f32,
    pub coin: V3,
    pub phone: V3,
    /// His phone stood up at his ear: how far, and the way its face looks.
    pub phone_tilt: f32,
    pub phone_yaw: f32,
    /// His laptop's lid: 0 open toward him … 1 shut.
    pub lid: f32,
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

/// Out of the world.
const HIDDEN: V3 = v3(0.0, -60.0, 0.0);
// The kitchen: where she stands at the stove, her pot and kettle on it,
// his cup, where he sets the bread down, where she sits.
const STOVE: V3 = v3(-5.0, 9.0, -3.8);
pub const POT: V3 = v3(-5.14, 10.03, -4.3);
const KETTLE_HOME: V3 = v3(-4.74, 10.04, -4.3);
/// The kettle's handle over its middle; its spout's tip from its middle
/// (up, forward).
pub const KETTLE_GRIP: f32 = 0.13;
pub const SPOUT: [f32; 2] = [0.08, 0.17];
const CUP: V3 = v3(-1.47, 9.76, -3.15);
const CUP_HALF: f32 = 0.045;
const BAG_SET: V3 = v3(-1.85, 9.76, -2.72);
const HER_SEAT: [f32; 2] = [-2.53, -3.0];
const HER_HEAD: V3 = v3(-2.85, 10.25, -3.0);
// The shop: over the counter, the coins, the till, the shelf of bread.
const HANDOVER: V3 = v3(-4.2, 1.38, -2.35);
/// A carried bag hangs this far under the hand's grip.
pub const BAG_DROP: f32 = 0.25;
/// Where a hand carries a bag (from the pelvis, see `hold`).
const CARRY: V3 = v3(-0.24, 0.72, 0.04);
const COUNTER_COIN: V3 = v3(-4.3, 1.055, -2.42);
const TILL: V3 = v3(-4.38, 1.27, -2.85);
const LOAF_SHELF: V3 = v3(-5.12, 1.32, -2.45);
// The living room: the child's cup on the low table, his hand catching it.
const KID_CUP: V3 = v3(7.45, 9.425, -1.46);
const KID_HALF: f32 = 0.04;
const CATCH: V3 = v3(4.85, 9.75, -1.45);
const DESK_PHONE: V3 = v3(4.36, 12.785, -2.64);
const CRANK: V3 = v3(4.35, 0.66, -2.0);
/// The tram's straps: the handles' height, their line across, and where
/// they hang along the car from its middle.
pub const STRAP_Y: f32 = 1.93;
pub const STRAP_Z: f32 = 4.45;
pub const STRAPS: [f32; 4] = [-3.0, -1.3, 0.5, 2.1];
/// How long he is out of the frame on his ride (the evening goes on
/// meanwhile) before he is back in from the left.
pub const BIKE_AWAY: f32 = 9.0;
/// The wall by his door (between the lobby's door and the shop) where he
/// stands with his back to it, facing the street: after the tram, and
/// after the ride for the night.
pub const DOOR_WALL: [f32; 2] = [-5.89, 0.3];
/// How long he stays there after the tram (and before the night).
pub const WALL_SPAN: f32 = 16.0;
pub const WALL2_SPAN: f32 = 14.5;
/// The bicycle's day starts over this long before the loop's end (it
/// stands just where it stood in the morning).
const BIKE_HOME_BEFORE: f32 = 3.0;
/// A foot's ball this high over the ground it stands on.
const BALL_Y: f32 = 0.03;

impl Cast {
    pub fn new() -> Cast {
        let mut world = World {
            lift_start: 9.0,
            ..World::default()
        };
        let mut k = Keys::default();

        // P at the stove, stirring. The argument; she turns back to her
        // pot, then takes the kettle along the counter to his cup, pours
        // and goes straight back to the stove.
        let mut p = Plan::new(0.0, STOVE, PI, false, 0.95, 4.6);
        p.quick = 0.8;
        p.wait_until(2.5).turn_to(1.37).wait_until(6.6).turn_to(PI);
        p.wait_until(8.8).mark("kettle").wait(1.0);
        p.walk(&[[-1.29, -3.72]], flat, WALKING);
        p.turn_to(0.0).mark("pour").wait(2.0);
        p.walk(&[[STOVE.x, STOVE.z]], flat, WALKING);
        p.turn_to(PI).mark("p_set");
        k.kettle = p.when("kettle");
        k.pour = p.when("pour");
        k.p_set = p.when("p_set");
        k.sip = k.pour + 2.6;
        k.rise = k.sip + 2.6;
        // Later (he is out) she sits down at the table.
        p.wait_until(k.p_set + 14.0);
        p.walk(
            &[[-3.6, -3.68], [-2.55, -3.62], [HER_SEAT[0], HER_SEAT[1]]],
            flat,
            WALKING,
        );
        p.turn_to(FRAC_PI_2).wait(0.3).sit(1.4).mark("p_sit");
        k.p_sit = p.when("p_sit");
        p.wait_until(LOOP + 10.0);

        // H: the kitchen (out by the near side of the table), the lift,
        // the street and the tram.
        let mut h = Plan::new(0.0, v3(-1.15, 9.0, -3.0), -FRAC_PI_2, true, 1.0, 4.2);
        h.wait_until(k.rise).rise(1.4);
        h.walk(
            &[
                [-0.95, -2.25],
                [-3.0, -1.95],
                [-4.6, -1.7],
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
        h.walk(&[[-7.0, -1.0], [-6.8, 0.3], [-6.6, 2.0]], street, WALKING);
        h.mark("kerb").wait(1.0);
        k.kerb = h.when("kerb");
        h.walk(&[[-6.6, 6.3], [-7.3, 6.75], [-9.0, 6.75]], street, WALKING);
        // He is on the rails 2.3 m along: the tram brakes, honks, stops
        // past him.
        k.rails = h.last_way().time_at(2.3);
        k.honk = k.rails - 0.2;
        world.tram.enter = k.rails - 1.34;
        world.tram.stop1 = world.tram.enter + BRAKE;
        h.turn_to(PI);
        let stop1 = world.tram.stop1;
        h.wait_until(h.t.max(stop1 + 1.0));
        // In by the front door; a hand up to a strap, facing the windows.
        h.walk(&[[-9.0, 5.0], [-9.45, 4.78]], boarding, WALKING);
        h.turn_to(PI).mark("board");
        k.board = h.when("board");
        // It pulls away to the right, out through the tunnel, and comes
        // back in from the left to the second stop.
        world.tram.go1 = k.board + 0.5;
        world.tram.back = world.tram.go1 + BACK_AFTER;
        world.tram.stop2 = world.tram.back + BACK_BRAKE;
        let stop2 = world.tram.stop2;
        // It waits at the second stop until he is off (set below).
        world.tram.go2 = stop2 + 100.0;
        h.ride_until(Ride::Tram, stop2 + 1.0, &world);
        let door = h.at.x + 0.45;
        h.walk(&[[door, 5.2], [door, 6.6]], boarding, WALKING);
        h.mark("alight");
        k.alight = h.when("alight");
        world.tram.go2 = h.t + 0.3;
        h.turn_to(PI).wait_until(world.tram.go2 + 2.2);

        // Across to the wall by his door: his back to it, he rests, speaks
        // into his phone and listens to it at his ear.
        h.walk(
            &[[-4.6, 5.4], [-5.7, 1.3], [DOOR_WALL[0], DOOR_WALL[1]]],
            street,
            WALKING,
        );
        h.turn_to(0.0).mark("wall");
        k.wall = h.when("wall");
        h.wait(WALL_SPAN);

        // The shop.
        h.walk(
            &[[-4.0, 0.75], [-1.2, 0.6], [-1.4, -1.2], [-2.65, -2.3]],
            street,
            WALKING,
        );
        h.turn_to(-FRAC_PI_2).mark("queue");
        k.queue = h.when("queue");
        let q = k.queue;
        h.wait_until(at_shop(q, 5.8));
        h.walk(&[[-3.75, -2.3]], flat, STROLL);
        h.turn_to(-FRAC_PI_2);
        h.wait_until(at_shop(q, 15.4));
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
        h.turn_to(PI).mark("bread").wait(2.2);
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

        // Up the stair to his desk: work, a call, work again, the screen
        // goes dark.
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
        h.wait_until(k.desk + DESK_SPAN).rise(1.2);

        // Out through the bedroom to the stairwell. On the landing he
        // calls the cage up from his floor below and rides it down.
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
        world.lift.push([k.call + 0.3, k.call + 2.3, 9.0, 12.0]);
        h.walk(&[[-6.6, -1.3], [-7.15, -1.1]], flat, WALKING);
        h.wait_until(h.t.max(k.call + 2.5));
        h.walk(&[[-8.25, -1.25]], flat, WALKING);
        h.turn_to(FRAC_PI_2);
        let go = h.t + 0.3;
        h.wait_until(go);
        world.lift.push([go, go + 5.0, 12.0, 0.0]);
        h.ride_until(Ride::Lift, go + 5.0, &world).wait(0.4);
        h.mark("down");
        k.down = h.when("down");

        // The evening ride: out to his bicycle leaning on the lamp's post,
        // off along the street and out of the frame on the right; the
        // camera cuts; back in from the left, he brakes by the same lamp,
        // steps off, leans it on the post again and stands.
        h.walk(
            &[[-7.0, -1.0], [-6.8, 0.3], [BIKE_HOME + 0.05, BIKE_Z - 0.36]],
            street,
            WALKING,
        );
        h.turn_to(FRAC_PI_2).wait(1.2).mark("take");
        k.take = h.when("take");
        h.wait(3.0);
        k.go = h.t;
        k.gone = k.go + Bike::out_after();
        k.stop = k.gone + BIKE_AWAY + Bike::stop_after();
        world.bike = Bike {
            take: k.take,
            go: k.go,
            gone: k.gone,
            stop: k.stop,
            home: LOOP - BIKE_HOME_BEFORE,
        };
        h.ride_until(Ride::Bike, k.gone, &world);
        h.cut(v3(BIKE_IN + 0.05, 0.0, BIKE_Z - 0.36), FRAC_PI_2);
        h.ride_until(Ride::Bike, k.stop, &world);
        h.wait(3.4);
        // Back to the wall by his door: he leans on it, speaks his day
        // aloud and listens; then the night.
        h.walk(
            &[[-3.0, 0.8], [-5.3, 0.75], [DOOR_WALL[0], DOOR_WALL[1]]],
            street,
            WALKING,
        );
        h.turn_to(0.0).mark("wall2");
        k.wall2 = h.when("wall2");
        h.wait(WALL2_SPAN).mark("rest");
        k.rest = h.when("rest");
        h.wait_until(LOOP + 10.0);

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
        kp.wait_until(at_shop(q, 10.6))
            .turn_by(PI)
            .wait(0.7)
            .turn_by(-PI)
            .wait_until(LOOP + 10.0);

        // L: along the sidewalk from the left, buys, steps aside, leaves
        // the way she came.
        let mut l = Plan::new(0.0, v3(-16.5, 0.0, 1.0), FRAC_PI_2, false, 0.92, 4.9);
        l.wait_until(q - 27.0);
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
        l.turn_to(-FRAC_PI_2);
        let paid = l.t.max(at_shop(q, 0.8));
        l.wait_until(paid);
        l.walk(&[[-3.6, -1.6], [-3.4, -1.0]], flat, STROLL);
        l.turn_to(0.0).wait_until(at_shop(q, 30.0));
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

        // On the tram: a youth with his phone, holding a strap; the driver.
        let c0 = world.tram_c(0.0);
        let mut y = Plan::new(
            0.0,
            v3(c0 + STRAPS[1], 0.22, STRAP_Z + 0.27),
            FRAC_PI_2,
            false,
            0.97,
            3.9,
        );
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
            kettle: KETTLE_HOME,
            kettle_tilt: 0.0,
            kettle_yaw: PI,
            spoon: [POT; 2],
            cup: CUP,
            cup_tilt: 0.0,
            cup_yaw: 0.0,
            kid_cup: KID_CUP,
            kid_cup_spin: 0.0,
            bag: HIDDEN,
            bag_yaw: 0.0,
            bag2: HIDDEN,
            bag2_yaw: 0.0,
            coin: HIDDEN,
            phone: DESK_PHONE,
            phone_tilt: 0.0,
            phone_yaw: 0.0,
            lid: 0.0,
            chair: v3(-0.75 + 0.3 * smooth(k.rise, k.rise + 1.0, s), 9.0, -3.0),
            can: HIDDEN,
            can_tilt: 0.0,
            brush: [HIDDEN; 2],
            bow: [HIDDEN; 2],
            wrench: [HIDDEN; 2],
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
            // Past the street's ends (the tunnels, the plinth's edge)
            // nobody shows.
            let seen = 1.0 - smooth(15.2, 15.8, body.pelvis.x.abs());
            figures.push(Figure {
                body,
                seen,
                accent: if i == HERO { HERO_ACCENT } else { 0.0 },
                clothes: CLOTHES[i],
                scale: plan.k,
                hair: f32::from(HAIR[i].0.code() * 8 + HAIR[i].1),
            });
        }
        Moment { figures, held }
    }

    /// How much she is stirring her pot.
    fn stir(&self, s: f32) -> f32 {
        let ps = self.keys.p_set;
        window(s, -2.0, -1.0, 2.2, 2.6)
            + window(s, 7.5, 7.9, 8.5, 8.8)
            + window(s, ps + 1.1, ps + 1.5, ps + 13.0, ps + 13.5)
    }

    /// The kettle over his cup: its middle and how far it tips, the spout's
    /// tip held over the cup as it pours.
    fn kettle_pour(&self, s: f32) -> (V3, f32) {
        let pr = self.keys.pour;
        let tilt = 0.9 * window(s, pr + 0.2, pr + 0.7, pr + 1.3, pr + 1.8);
        // She faces +z across the table.
        let f = v3(0.0, 0.0, 1.0);
        let (st, ct) = tilt.sin_cos();
        let up = Y * ct + f * st;
        let fw = f * ct - Y * st;
        let tip = CUP + v3(0.0, 0.12 + 0.1 * (1.0 - tilt / 0.9), 0.0);
        (tip - up * SPOUT[0] - fw * SPOUT[1], tilt)
    }

    /// He and his bicycle: a glance at the sky, his hands to its grip and
    /// saddle, it comes upright off the post; a foot over the low frame
    /// onto the pedal, astride, the push off and up onto the saddle; the
    /// ride, his feet round with the pedals; he slides forward off the
    /// saddle as it brakes, a foot down, steps off it, leans it on the
    /// lamp's post and lets go.
    fn on_bike(&self, s: f32, pose: &mut Pose, local: &Local) {
        let b = &self.world.bike;
        let (t, g, st) = (b.take, b.go, b.stop);
        if g == 0.0 || s < t - 1.5 || s > st + 3.6 {
            return;
        }
        let at = |f: f32, u: f32, r: f32| b.at(s, f, u, r);
        let here = |w: V3| local.local(w);
        pose.nod -= 0.3 * window(s, t - 1.2, t - 0.8, t - 0.4, t);
        look(
            pose,
            local,
            at(0.25, 0.6, 0.0),
            window(s, t - 0.3, t + 0.2, t + 2.0, t + 2.6),
        );
        // Astride from off the stand until he steps off; on the saddle
        // from the push off until it brakes.
        let astride = min_jerk((s - t - 1.6) / 0.8) * (1.0 - min_jerk((s - st - 0.5) / 0.9));
        let seated = min_jerk((s - g) / 0.7) * (1.0 - min_jerk((s - st + 1.0) / 0.8));
        let p = here(at(
            mix(0.0, SEAT_AT[0], seated),
            mix(0.9, SEAT_AT[1], seated),
            0.0,
        ));
        pose.pelvis = lerp3(pose.pelvis, p, astride);
        pose.yaw *= 1.0 - astride;
        pose.lean += 0.15 * window(s, t, t + 0.5, t + 1.6, t + 2.4)
            + astride * mix(0.15, 0.5, seated)
            + 0.12 * window(s, st + 0.5, st + 1.4, st + 2.8, st + 3.3);
        pose.roll += astride * b.roll(s);
        // Riding, he looks down the street ahead.
        look(pose, local, at(7.0, 0.8, 0.0), 0.8 * seated);
        look(
            pose,
            local,
            at(SADDLE[0], SADDLE[1], 0.3),
            window(s, st + 1.8, st + 2.2, st + 3.0, st + 3.5),
        );

        // His feet. The right one over the frame onto its pedal and back.
        let stand = pose.feet;
        let pedal = |side: usize| here(b.pedal(s, side) + Y * 0.035);
        let over = here(at(0.12, 0.62, 0.0));
        let on = min_jerk((s - t - 1.4) / 0.8) * (1.0 - min_jerk((s - st - 0.7) / 0.8));
        if on > 0.0 {
            let ball = arc(stand[1].ball, pedal(1), over, on);
            pose.feet[1] = foot_on(ball, 0.0, -0.12 * on);
        }
        // The left one: astride on the ground, up onto its pedal as he
        // pushes off, down again as he stops, back beside him.
        if s > t + 2.4 && s < st + 0.7 {
            let ground = |x: f32| here(v3(x - 0.02, BALL_Y, BIKE_Z - 0.25));
            let lift = |a: V3, c: V3, w: f32| arc(a, c, (a + c) * 0.5 + Y * 0.1, w);
            let (ball, share) = if s < g {
                let w = min_jerk((s - t - 2.4) / 0.4);
                (lift(stand[0].ball, ground(BIKE_HOME), w), 0.0)
            } else if s < st - 1.5 {
                let w = min_jerk((s - g - 0.3) / 0.6);
                (lift(ground(BIKE_HOME), pedal(0), w), w)
            } else if s < st + 0.2 {
                let w = min_jerk((s - st + 1.0) / 0.8);
                (lift(pedal(0), ground(BIKE_STOP), w), 1.0 - w)
            } else {
                let w = min_jerk((s - st - 0.3) / 0.4);
                (lift(ground(BIKE_STOP), stand[0].ball, w), 0.0)
            };
            pose.feet[0] = foot_on(ball, 0.0, -0.12 * share);
        }

        // His hands: the left on its grip throughout; the right on the
        // saddle, on its grip while he rides, on the saddle again.
        let grip = |r: f32| at(GRIP[0], GRIP[1], r * GRIP[2]);
        let saddle = at(SADDLE[0] + 0.1, SADDLE[1] + 0.02, 0.0);
        let held = window(s, t, t + 0.5, st + 2.8, st + 3.3);
        reach(pose, local, 0, grip(-1.0), held);
        let riding = smooth(t + 1.8, t + 2.4, s) - smooth(st + 0.5, st + 1.4, s);
        reach(pose, local, 1, lerp3(saddle, grip(1.0), riding), held);
    }

    /// By his door, his back to the wall: he rests and speaks his day,
    /// then listens to it. After the tram into his phone held before him,
    /// then with it at his ear; after the ride aloud, then the night.
    fn at_wall(&self, s: f32, pose: &mut Pose, local: &Local) {
        let k = &self.keys;
        let (w, w2) = (k.wall, k.wall2);
        if w == 0.0 || s < w - 1.0 {
            return;
        }
        // Hips and shoulders back on the wall, his heels out from it.
        let leaning = window(
            s,
            w + 0.2,
            w + 1.2,
            w + WALL_SPAN - 1.4,
            w + WALL_SPAN - 0.4,
        ) + smooth(w2 + 0.2, w2 + 1.2, s);
        pose.pelvis.z -= 0.07 * leaning;
        pose.lean -= 0.14 * leaning;
        // A breath with his head back on the wall before he speaks.
        pose.nod -= 0.14
            * (window(s, w + 0.6, w + 1.4, w + 1.8, w + 2.4)
                + window(s, w2 + 1.0, w2 + 2.2, w2 + 3.0, w2 + 3.6));

        // After the tram: the phone out of his pocket, held before his
        // face as he records (he looks at it), then at his right ear.
        let before = window(s, w + 1.4, w + 2.2, w + 7.9, w + 8.5);
        let at_eyes = v3(-0.07, 1.27, 0.3);
        hold(pose, 1, at_eyes, before);
        look(
            pose,
            local,
            local.world(pose.pelvis + at_eyes - Y * STAND),
            0.9 * window(s, w + 1.6, w + 2.3, w + 7.8, w + 8.4),
        );
        let at_ear = window(s, w + 7.9, w + 8.6, w + 13.4, w + 14.0);
        if at_ear > 0.0 {
            let b = build(pose);
            let ear = local.world(b.head - b.face.left * 0.13 + b.face.forward * 0.01);
            reach(pose, local, 1, ear, at_ear);
        }
        // Listening, his eyes down and still.
        pose.nod += 0.2 * window(s, w + 8.8, w + 9.4, w + 13.0, w + 13.6);
        pose.turn -= 0.12 * window(s, w + 8.8, w + 9.4, w + 13.0, w + 13.6);

        // After the ride: aloud, his right hand a little with the words;
        // then he listens, his head down.
        let talk = window(s, w2 + 3.4, w2 + 3.8, w2 + 7.8, w2 + 8.3);
        pose.arms[1] += 0.22 * talk * (0.5 + 0.5 * (TAU * s / 1.4).sin());
        pose.bend[1] += 0.55 * talk;
        pose.nod += 0.16 * window(s, w2 + 8.8, w2 + 9.4, w2 + 12.8, w2 + 13.4);
    }

    /// His voice this moment, for the shaders: the mouth it leaves and how
    /// much he speaks; the way it goes and how far; where it comes back to
    /// and how much he listens; the smallest and the widest ring there.
    pub fn voice(&self, s: f32, h: &Body, phone: V3) -> [[f32; 4]; 4] {
        let k = &self.keys;
        let (w, w2, d) = (k.wall, k.wall2, k.desk);
        let into_phone = window(s, w + 2.6, w + 3.0, w + 7.2, w + 7.7);
        let aloud = window(s, w2 + 3.4, w2 + 3.8, w2 + 7.8, w2 + 8.3)
            + window(
                s,
                d + DESK_SPEAK[0],
                d + DESK_SPEAK[0] + 0.4,
                d + DESK_SPEAK[1] - 0.5,
                d + DESK_SPEAK[1],
            );
        let (way, far) = if into_phone > 0.0 {
            let to = phone - h.mouth;
            (to.normalize(), to.length() + 0.03)
        } else {
            (h.face.forward, 0.9)
        };
        let at_phone = window(s, w + 8.9, w + 9.3, w + 13.0, w + 13.5);
        let inward = window(s, w2 + 8.8, w2 + 9.2, w2 + 12.8, w2 + 13.3)
            + window(
                s,
                d + DESK_LISTEN[0],
                d + DESK_LISTEN[0] + 0.4,
                d + DESK_LISTEN[1] - 0.5,
                d + DESK_LISTEN[1],
            );
        let (to, rings) = if at_phone > 0.0 {
            (phone, [0.035, 0.4])
        } else {
            (h.head, [0.17, 0.75])
        };
        let m = h.mouth;
        [
            [m.x, m.y, m.z, into_phone + aloud],
            [way.x, way.y, way.z, far],
            [to.x, to.y, to.z, at_phone + inward],
            [rings[0], rings[1], 0.0, 0.0],
        ]
    }

    fn gestures(&self, i: usize, s: f32, pose: &mut Pose, local: &Local) {
        let k = &self.keys;
        let q = k.queue;
        let w = &self.world;
        match i {
            HERO => {
                // The argument: he answers with his hands, then looks away.
                let argue = window(s, 3.0, 3.4, 6.2, 6.8);
                pose.arms[0] += 0.5 * argue * (0.6 + 0.4 * (TAU * s / 1.1).sin());
                pose.arms[1] += 0.45 * argue * (0.6 + 0.4 * (TAU * s / 1.3 + 1.0).sin());
                pose.bend = pose.bend.map(|b| b + 0.6 * argue);
                pose.turn += -0.35 * window(s, 6.6, 7.2, k.pour - 1.2, k.pour - 0.6);
                look(
                    pose,
                    local,
                    STOVE + v3(0.0, 1.5, 0.0),
                    window(s, 2.4, 2.9, 6.2, 6.6),
                );
                // He watches her pour.
                look(
                    pose,
                    local,
                    CUP + v3(0.0, 0.1, 0.0),
                    window(s, k.pour - 0.6, k.pour - 0.1, k.pour + 1.8, k.pour + 2.3),
                );
                // The tea: up to his lips and back. The hand holds the cup
                // just under his mouth (where his head truly is), its rim at
                // his lips.
                let sip = k.sip;
                let head = build(pose);
                let lips = local.world(head.mouth + head.face.forward * 0.06 - Y * 0.035);
                let up = smooth(sip + 0.8, sip + 1.3, s) - smooth(sip + 1.6, sip + 2.1, s);
                reach(
                    pose,
                    local,
                    1,
                    lerp3(CUP + v3(0.0, CUP_HALF, 0.0), lips, up),
                    window(s, sip, sip + 0.7, sip + 2.2, sip + 2.8),
                );
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
                look(
                    pose,
                    local,
                    v3(w.tram_c(s) + 4.6, 1.6, 4.3),
                    window(s, k.honk, k.honk + 0.25, k.honk + 1.2, k.honk + 1.8),
                );
                // On the tram, a hand up on a strap.
                reach(
                    pose,
                    local,
                    1,
                    v3(w.tram_c(s) + STRAPS[3], STRAP_Y, STRAP_Z),
                    window(
                        s,
                        k.board - 0.3,
                        k.board + 0.3,
                        w.tram.stop2 + 0.4,
                        w.tram.stop2 + 0.9,
                    ),
                );
                // The coin: out of his pocket, it slips, he picks it up,
                // lays it on the counter.
                let coin_out = window(
                    s,
                    at_shop(q, 1.0),
                    at_shop(q, 1.6),
                    at_shop(q, 2.9),
                    at_shop(q, 3.0),
                );
                hold(pose, 1, v3(-0.12, 1.05, 0.3), coin_out);
                look(
                    pose,
                    local,
                    local.world(pose.pelvis + v3(-0.12, 0.08, 0.3)),
                    coin_out,
                );
                let fallen = coin_floor();
                look(
                    pose,
                    local,
                    fallen,
                    window(
                        s,
                        at_shop(q, 2.95),
                        at_shop(q, 3.2),
                        at_shop(q, 5.2),
                        at_shop(q, 5.6),
                    ),
                );
                crouch(
                    pose,
                    window(
                        s,
                        at_shop(q, 3.3),
                        at_shop(q, 4.1),
                        at_shop(q, 4.7),
                        at_shop(q, 5.5),
                    ),
                );
                reach(
                    pose,
                    local,
                    1,
                    fallen,
                    window(
                        s,
                        at_shop(q, 3.9),
                        at_shop(q, 4.3),
                        at_shop(q, 4.6),
                        at_shop(q, 5.0),
                    ),
                );
                hold(
                    pose,
                    1,
                    v3(-0.15, 1.0, 0.25),
                    window(
                        s,
                        at_shop(q, 4.8),
                        at_shop(q, 5.3),
                        at_shop(q, 5.9),
                        at_shop(q, 6.2),
                    ),
                );
                let give = window(
                    s,
                    at_shop(q, 8.4),
                    at_shop(q, 8.9),
                    at_shop(q, 9.2),
                    at_shop(q, 9.6),
                );
                pose.lean += 0.3 * give;
                reach(pose, local, 1, COUNTER_COIN, give);
                look(
                    pose,
                    local,
                    v3(-4.75, 1.6, -2.45),
                    window(
                        s,
                        at_shop(q, 8.6),
                        at_shop(q, 9.0),
                        at_shop(q, 15.0),
                        at_shop(q, 15.4),
                    ),
                );
                // The bread in its bag: from K's hand, carried at his side,
                // set on the kitchen table.
                let take = keeper_hands_bag(q);
                reach(
                    pose,
                    local,
                    1,
                    HANDOVER,
                    window(s, take - 0.5, take, take + 0.2, take + 0.7),
                );
                let b = k.bread;
                hold(
                    pose,
                    1,
                    CARRY,
                    window(s, take + 0.2, take + 0.7, b + 0.1, b + 0.6),
                );
                pose.lean += 0.2 * window(s, b + 0.1, b + 0.6, b + 1.0, b + 1.5);
                reach(
                    pose,
                    local,
                    1,
                    BAG_SET + v3(0.0, BAG_DROP, 0.0),
                    window(s, b + 0.1, b + 0.6, b + 1.0, b + 1.5),
                );
                look(
                    pose,
                    local,
                    BAG_SET,
                    window(s, b, b + 0.4, b + 1.0, b + 1.4),
                );
                look(
                    pose,
                    local,
                    HER_HEAD,
                    window(s, b + 1.3, b + 1.7, b + 2.4, b + 3.0),
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
                    cup_flight(k, s) + v3(0.0, KID_HALF, 0.0),
                    window(s, k.trip + 0.05, c - 0.1, c + 0.1, c + 0.2),
                );
                let back = v3(4.95, 9.7, -1.58);
                reach(
                    pose,
                    local,
                    1,
                    lerp3(CATCH, back, smooth(c + 0.3, c + 1.6, s)) + v3(0.0, KID_HALF, 0.0),
                    window(s, c, c + 0.1, c + 2.0, c + 2.4),
                );
                look(
                    pose,
                    local,
                    v3(5.3, 9.6, -1.5),
                    window(s, c + 0.3, c + 0.8, c + 2.2, c + 2.8),
                );
                // The desk: typing, the phone buzzes, the call, his
                // temples, typing again, the screen goes dark.
                let d = k.desk;
                let typing = window(s, d + 0.4, d + 0.9, d + 4.6, d + 5.0)
                    + window(s, d + 14.3, d + 14.8, d + 18.2, d + 18.7);
                let tap = |x: f32, ph: f32| {
                    v3(x, 12.8 + 0.02 * (TAU * s / 0.23 + ph).sin().max(0.0), -2.68)
                };
                reach(pose, local, 0, tap(4.02, 0.0), typing);
                reach(pose, local, 1, tap(3.78, 1.7), typing);
                look(
                    pose,
                    local,
                    v3(3.9, 12.95, -2.45),
                    window(s, d + 0.1, d + 0.5, d + 4.9, d + 5.2)
                        + window(s, d + 14.0, d + 14.4, d + 18.8, d + 19.3),
                );
                look(
                    pose,
                    local,
                    DESK_PHONE,
                    window(s, d + 5.0, d + 5.3, d + 6.0, d + 6.4),
                );
                let call = window(s, d + 5.6, d + 6.1, d + 10.6, d + 11.2);
                let ear = local.world(pose.pelvis + v3(0.12, 0.7, 0.05));
                reach(
                    pose,
                    local,
                    0,
                    lerp3(
                        DESK_PHONE + v3(0.0, 0.01, 0.0),
                        ear,
                        smooth(d + 6.2, d + 6.7, s) - smooth(d + 10.2, d + 10.7, s),
                    ),
                    call,
                );
                // On the call his other hand talks, then rubs his brow.
                let talk = window(s, d + 7.0, d + 7.4, d + 9.6, d + 10.0);
                pose.arms[1] += 0.35 * talk * (0.5 + 0.5 * (TAU * s / 1.2).sin());
                pose.bend[1] += 0.9 * talk;
                pose.nod += 0.15 * window(s, d + 6.5, d + 7.0, d + 10.0, d + 10.6);
                let temples = window(s, d + 11.6, d + 12.1, d + 13.5, d + 14.0);
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
                // Done: both hands on the lid's edge, he shuts it; he sits
                // back, looks out at the evening, speaks his day aloud and
                // listens to it.
                let lid = smooth(d + DESK_LID[0], d + DESK_LID[1], s);
                let shut = window(s, d + 18.8, d + 19.3, d + 20.6, d + 21.1);
                let edge = lid_edge(lid);
                reach(pose, local, 0, edge + v3(0.11, 0.0, 0.0), shut);
                reach(pose, local, 1, edge - v3(0.11, 0.0, 0.0), shut);
                look(pose, local, edge - v3(0.0, 0.05, 0.0), shut);
                let back = window(s, d + 20.6, d + 21.6, d + 32.0, d + 32.8);
                pose.lean -= 0.2 * back;
                pose.pelvis.z -= 0.05 * back;
                look(
                    pose,
                    local,
                    v3(3.6, 13.5, 6.0),
                    window(s, d + 21.0, d + 21.8, d + 27.0, d + 27.6),
                );
                let talk = window(
                    s,
                    d + DESK_SPEAK[0],
                    d + DESK_SPEAK[0] + 0.4,
                    d + DESK_SPEAK[1] - 0.5,
                    d + DESK_SPEAK[1],
                );
                pose.arms[1] += 0.25 * talk * (0.5 + 0.5 * (TAU * s / 1.5).sin());
                pose.bend[1] += 0.6 * talk;
                // Listening, his head down a little, his eyes on the shut lid.
                let inward = window(
                    s,
                    d + DESK_LISTEN[0],
                    d + DESK_LISTEN[0] + 0.6,
                    d + DESK_LISTEN[1] - 0.4,
                    d + DESK_LISTEN[1] + 0.4,
                );
                pose.nod += 0.22 * inward;
                pose.turn -= 0.1 * inward;
                self.on_bike(s, pose, local);
                self.at_wall(s, pose, local);
                // By his door, the night: he looks up at the sky.
                pose.nod -= 0.25 * smooth(k.rest + 4.0, k.rest + 6.0, s);
            }
            PARTNER => {
                // Stirring her pot.
                let stir = self.stir(s);
                let a = TAU * s / 1.3;
                reach(
                    pose,
                    local,
                    0,
                    POT + v3(0.05 * a.cos(), 0.2, 0.05 * a.sin()),
                    stir,
                );
                look(pose, local, POT, 0.8 * stir);
                // The argument: she turns to him, her hand talks.
                let argue = window(s, 2.8, 3.2, 6.0, 6.5);
                pose.arms[1] += 0.55 * argue * (0.5 + 0.5 * (TAU * s / 0.9).sin());
                pose.bend[1] += 0.7 * argue;
                look(
                    pose,
                    local,
                    v3(-0.8, 10.25, -3.0),
                    window(s, 2.4, 2.9, 6.3, 6.8),
                );
                // The kettle: off the stove, along the counter at her
                // side, poured over his cup, back and set down.
                let (kt, pr, ps) = (k.kettle, k.pour, k.p_set);
                let lift = 0.1 * smooth(kt + 0.6, kt + 1.0, s);
                reach(
                    pose,
                    local,
                    1,
                    KETTLE_HOME + v3(0.0, KETTLE_GRIP + lift, 0.0),
                    window(s, kt, kt + 0.45, kt + 1.0, kt + 1.4),
                );
                let carry = window(s, kt + 1.0, kt + 1.4, pr - 0.6, pr - 0.1)
                    + window(s, pr + 1.9, pr + 2.4, ps - 0.3, ps + 0.1);
                hold(pose, 1, v3(-0.2, 0.8, 0.14), carry);
                let (c, tilt) = self.kettle_pour(s);
                let up = Y * tilt.cos() + v3(0.0, 0.0, tilt.sin());
                reach(
                    pose,
                    local,
                    1,
                    c + up * KETTLE_GRIP,
                    window(s, pr - 0.6, pr - 0.1, pr + 1.9, pr + 2.4),
                );
                let down = 0.1 * (1.0 - smooth(ps + 0.1, ps + 0.5, s));
                reach(
                    pose,
                    local,
                    1,
                    KETTLE_HOME + v3(0.0, KETTLE_GRIP + down, 0.0),
                    window(s, ps - 0.3, ps + 0.1, ps + 0.7, ps + 1.1),
                );
                pose.lean += 0.15 * window(s, pr - 0.2, pr + 0.3, pr + 1.4, pr + 1.9);
                look(
                    pose,
                    local,
                    CUP,
                    window(s, pr - 0.5, pr, pr + 1.5, pr + 2.0),
                );
                look(
                    pose,
                    local,
                    KETTLE_HOME,
                    window(s, kt - 0.3, kt, kt + 0.8, kt + 1.2)
                        + window(s, ps - 0.4, ps, ps + 0.6, ps + 1.0),
                );
                // She looks up at him when he brings the bread.
                look(
                    pose,
                    local,
                    v3(-1.8, 10.6, -2.15),
                    window(s, k.bread - 0.4, k.bread, k.bread + 2.6, k.bread + 3.2),
                );
            }
            CHILD => {
                pose.head = 1.4;
                let c0 = k.c0;
                // Playing at the low table, then up with the cup.
                let play = 1.0 - window(s, c0 - 0.3, c0 + 0.5, k.catch + 3.6, k.catch + 7.0);
                squat(pose, play);
                let blocks = v3(
                    7.5 + 0.04 * (TAU * s / 2.3).sin(),
                    9.5 + 0.04 * (TAU * s / 1.7).sin().max(0.0),
                    -1.66,
                );
                reach(pose, local, 0, blocks, 0.85 * play);
                look(pose, local, blocks, 0.7 * play);
                reach(
                    pose,
                    local,
                    1,
                    KID_CUP + v3(0.0, KID_HALF, 0.0),
                    window(s, c0 - 0.3, c0 + 0.1, c0 + 0.3, c0 + 0.6),
                );
                // Running with it held up before her.
                hold(
                    pose,
                    1,
                    v3(-0.16, 1.1, 0.3),
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
                    v3(4.95, 9.7 + KID_HALF, -1.58),
                    window(s, cc + 1.7, cc + 2.0, cc + 2.2, cc + 2.6),
                );
                hold(
                    pose,
                    1,
                    v3(-0.15, 1.0, 0.3),
                    window(s, cc + 2.2, cc + 2.6, cc + 5.0, cc + 5.6),
                );
                reach(
                    pose,
                    local,
                    1,
                    KID_CUP + v3(0.0, KID_HALF, 0.0),
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
                // L's coin to the till; her bag off the shelf, over the
                // counter to her.
                let till = window(s, q - 4.6, q - 4.2, q - 3.9, q - 3.5);
                reach(pose, local, 0, TILL, till);
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
                    HANDOVER,
                    window(s, q - 1.5, q - 0.9, q - 0.3, at_shop(q, 0.2)),
                );
                // His coin, his bag.
                let coin = window(
                    s,
                    at_shop(q, 9.5),
                    at_shop(q, 9.8),
                    at_shop(q, 10.1),
                    at_shop(q, 10.4),
                );
                pose.lean += 0.25 * coin + 0.25 * till;
                reach(
                    pose,
                    local,
                    0,
                    lerp3(
                        COUNTER_COIN,
                        TILL,
                        smooth(at_shop(q, 9.8), at_shop(q, 10.2), s),
                    ),
                    coin,
                );
                reach(
                    pose,
                    local,
                    1,
                    LOAF_SHELF,
                    window(
                        s,
                        at_shop(q, 12.0),
                        at_shop(q, 12.3),
                        at_shop(q, 12.6),
                        at_shop(q, 12.9),
                    ),
                );
                let hand = keeper_hands_bag(q);
                reach(
                    pose,
                    local,
                    1,
                    HANDOVER,
                    window(s, hand - 1.0, hand - 0.4, hand + 0.2, hand + 0.6),
                );
                let customer = if s < at_shop(q, 2.0) {
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
                    HANDOVER,
                    window(s, q - 0.8, q - 0.4, q - 0.2, at_shop(q, 0.3)),
                );
                hold(
                    pose,
                    1,
                    CARRY,
                    window(s, q - 0.2, at_shop(q, 0.3), LOOP + 5.0, LOOP + 6.0),
                );
                // Aside, she watches him chase his coin.
                look(
                    pose,
                    local,
                    coin_floor(),
                    window(
                        s,
                        at_shop(q, 3.0),
                        at_shop(q, 3.4),
                        at_shop(q, 5.4),
                        at_shop(q, 6.0),
                    ),
                );
            }
            YOUTH => {
                // A strap in one hand, his phone in the other; the horn
                // lifts his eyes from it.
                reach(
                    pose,
                    local,
                    0,
                    v3(w.tram_c(s) + STRAPS[1], STRAP_Y, STRAP_Z),
                    1.0,
                );
                pose.carry = Carry::Screen(1.0);
                let thumb = 0.015 * (TAU * s / 1.7).sin().max(0.0);
                hold(pose, 1, v3(-0.08, 1.12 + thumb, 0.3), 1.0);
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
                let c = w.tram_c(s);
                reach(pose, local, 0, v3(c + 4.2, 1.16, 4.15), 1.0);
                reach(pose, local, 1, v3(c + 4.2, 1.16, 4.45), 1.0);
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
                let t = k.trip;
                let start = window(s, t + 0.1, t + 0.35, t + 1.6, t + 3.2);
                let doze = window(s, t - 42.0, t - 38.0, t + 12.0, t + 16.0) * (1.0 - start);
                pose.nod = 0.45 * doze + 0.04 * (TAU * s / 5.4).sin() * doze;
                pose.lean += 0.08 * doze;
                hold_at(pose, 0, v3(0.16, 0.62, 0.32), 1.0 - doze * 0.3);
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
                hold(pose, 1, CARRY, 1.0 - water);
                reach(pose, local, 1, local.world(v3(-0.25, 1.02, 0.42)), water);
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

    fn place_held(&self, s: f32, bodies: &[Body], held: &mut Held) {
        let k = &self.keys;
        let q = k.queue;
        let h = &bodies[HERO];
        let yaw_of = |b: &Body| b.pelvic.forward.x.atan2(b.pelvic.forward.z);

        // The kettle rides in her hand from the stove and back to it; over
        // his cup its spout's tip holds over the cup.
        let pb = &bodies[PARTNER];
        let (kt, pr, ps) = (k.kettle, k.pour, k.p_set);
        let held_on = smooth(kt + 0.4, kt + 0.55, s) * (1.0 - smooth(ps + 0.55, ps + 0.7, s));
        if held_on > 0.0 {
            let (pc, tilt) = self.kettle_pour(s);
            let over = window(s, pr - 0.3, pr + 0.1, pr + 1.9, pr + 2.3);
            let yaw = mix_angle(yaw_of(pb), 0.0, over);
            let f = v3(yaw.sin(), 0.0, yaw.cos());
            let up = Y * tilt.cos() + f * tilt.sin();
            let in_hand = grip(pb, 1) - up * KETTLE_GRIP;
            held.kettle = KETTLE_HOME.lerp(in_hand.lerp(pc, over), held_on);
            held.kettle_tilt = tilt;
            held.kettle_yaw = mix_angle(PI, yaw, held_on);
        }
        // Her spoon: resting in the pot, or turning in her hand.
        let stir = self.stir(s);
        let a = TAU * s / 1.3;
        let rest = [POT + v3(0.03, 0.0, 0.02), POT + v3(0.1, 0.17, 0.06)];
        let dip = POT + v3(0.05 * a.cos(), -0.01, 0.05 * a.sin());
        held.spoon = [
            rest[0].lerp(dip, stir.min(1.0)),
            rest[1].lerp(grip(pb, 0), stir.min(1.0)),
        ];

        // His cup, up to his lips and back.
        let sip = k.sip;
        let on = smooth(sip + 0.6, sip + 0.75, s) * (1.0 - smooth(sip + 2.0, sip + 2.1, s));
        if on > 0.0 {
            held.cup = CUP.lerp(grip(h, 1) - v3(0.0, CUP_HALF, 0.0), on);
            // At his lips it tips toward him.
            let up = smooth(sip + 0.8, sip + 1.3, s) - smooth(sip + 1.6, sip + 2.1, s);
            let to = h.mouth - held.cup;
            held.cup_yaw = to.x.atan2(to.z);
            held.cup_tilt = 0.5 * up;
        }

        // The child's cup: in her hand, flying, caught, back.
        let kid = &bodies[CHILD];
        let cc = k.catch;
        let in_hand = |b: &Body| grip(b, 1) - v3(0.0, KID_HALF, 0.0);
        if s > k.c0 + 0.1 && s < k.trip {
            held.kid_cup = in_hand(kid);
        } else if s >= k.trip && s < cc {
            held.kid_cup = cup_flight(k, s);
            held.kid_cup_spin = 7.0 * (s - k.trip);
        } else if s >= cc && s < cc + 2.1 {
            held.kid_cup = in_hand(h);
            held.kid_cup_spin = 7.0 * 0.55;
        } else if s >= cc + 2.1 && s < cc + 5.9 {
            held.kid_cup = in_hand(kid);
        }

        // The coin.
        let fallen = coin_floor();
        if s > at_shop(q, 1.3) && s < at_shop(q, 2.9) {
            held.coin = grip(h, 1);
        } else if s >= at_shop(q, 2.9) && s < at_shop(q, 4.45) {
            let u = s - (at_shop(q, 2.9));
            let from = v3(-2.77, 1.0, -2.3);
            let drop = (from.y - 0.012).max(0.0);
            let t_fall = (2.0 * drop / 9.8).sqrt();
            if u < t_fall {
                held.coin = from.lerp(fallen, u / t_fall);
                held.coin.y = from.y - 4.9 * u * u;
            } else {
                // A bounce and a short roll.
                let b = u - t_fall;
                let hop = (0.06 - 4.9 * (b - 0.11) * (b - 0.11)).max(0.0) * smooth(0.0, 0.02, b);
                held.coin = v3(fallen.x, 0.012 + hop, fallen.z);
            }
        } else if s >= at_shop(q, 4.45) && s < at_shop(q, 9.1) {
            held.coin = grip(h, 1);
        } else if s >= at_shop(q, 9.1) && s < at_shop(q, 9.9) {
            held.coin = COUNTER_COIN;
        } else if s >= at_shop(q, 9.9) && s < at_shop(q, 10.3) {
            held.coin = grip(&bodies[KEEPER], 0);
        }

        // The bags of bread: off the shelf in K's hand, over the counter,
        // carried by their buyers; his onto the kitchen table.
        let kp = &bodies[KEEPER];
        let hang = |b: &Body| grip(b, 1) - v3(0.0, BAG_DROP, 0.0);
        let take = keeper_hands_bag(q);
        if s > at_shop(q, 12.3) && s < take + 0.1 {
            held.bag = hang(kp);
            held.bag_yaw = yaw_of(kp);
        } else if s >= take + 0.1 && s < k.bread + 1.1 {
            held.bag = hang(h);
            held.bag_yaw = yaw_of(h);
        } else if s >= k.bread + 1.1 {
            held.bag = BAG_SET;
            held.bag_yaw = PI;
        }
        let lb = &bodies[LADY];
        if s > q - 2.2 && s < q - 0.3 {
            held.bag2 = hang(kp);
            held.bag2_yaw = yaw_of(kp);
        } else if s >= q - 0.3 && lb.pelvis.x.abs() < 15.6 {
            held.bag2 = hang(lb);
            held.bag2_yaw = yaw_of(lb);
        }

        // By the wall after the tram: out of his pocket, before his face as
        // he records, then at his ear.
        let w = k.wall;
        if s > w + 1.45 && s < w + 14.0 {
            held.phone = grip(h, 1) - v3(0.0, 0.005, 0.0);
            let to = h.head - held.phone;
            held.phone_yaw = to.x.atan2(to.z);
            let ear = smooth(w + 8.0, w + 8.6, s) * (1.0 - smooth(w + 13.4, w + 13.9, s));
            held.phone_tilt = mix(1.0, FRAC_PI_2, ear);
        } else {
            // On the desk: it buzzes, then at his ear.
            let d = k.desk;
            let buzz = window(s, d + 4.9, d + 5.0, d + 5.9, d + 6.0);
            held.phone = DESK_PHONE
                + v3(
                    0.004 * (TAU * s * 23.0).sin(),
                    0.0,
                    0.003 * (TAU * s * 31.0).sin(),
                ) * buzz;
        }
        let d = k.desk;
        // He shuts the lid at the day's end; it stands open again once the
        // house has gone, before the morning.
        held.lid = window(
            s,
            d + DESK_LID[0],
            d + DESK_LID[1],
            k.rest + 48.0,
            k.rest + 48.5,
        );
        let call = smooth(d + 6.05, d + 6.2, s) * (1.0 - smooth(d + 10.75, d + 10.9, s));
        if call > 0.0 {
            held.phone = held.phone.lerp(grip(h, 0) - v3(0.0, 0.01, 0.0), call);
            // At his ear it stands up, its face to his cheek.
            let ear = smooth(d + 6.2, d + 6.7, s) - smooth(d + 10.2, d + 10.7, s);
            let to = h.head - held.phone;
            held.phone_yaw = to.x.atan2(to.z);
            held.phone_tilt = FRAC_PI_2 * ear;
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

/// How long he sits at his desk, from sitting down to getting up: work,
/// the call, work, the lid closed; he speaks his day aloud, then listens.
pub const DESK_SPAN: f32 = 33.0;
/// When he speaks and when he listens there, from sitting down.
pub const DESK_SPEAK: [f32; 2] = [21.6, 26.8];
pub const DESK_LISTEN: [f32; 2] = [27.2, 31.6];
/// The lid going down under his hands, from sitting down.
pub const DESK_LID: [f32; 2] = [19.4, 20.6];
/// The laptop lid's hinge at the base's far edge, and the lid's length.
pub const LID_HINGE: V3 = v3(3.95, 12.792, -2.488);
pub const LID_LONG: f32 = 0.26;
/// The lid's pitch (+ leans it away from him) at `lid`: open, shut.
pub fn lid_pitch(lid: f32) -> f32 {
    mix(0.25, -FRAC_PI_2, lid)
}
/// The middle of the lid's far edge, where his fingers take it.
pub fn lid_edge(lid: f32) -> V3 {
    let (s, c) = lid_pitch(lid).sin_cos();
    LID_HINGE + v3(0.0, c, s) * LID_LONG + v3(0.0, -s, c) * 0.012
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

/// The shop's beats, `x` s after he stands in the queue as first timed,
/// given more time round his coin: it lies in his hand longer, falls as it
/// falls, and he looks, crouches, picks it up and stands slower; all after
/// that comes `COIN_MORE` s later.
pub fn at_shop(q: f32, x: f32) -> f32 {
    const MAP: [(f32, f32); 4] = [(1.0, 1.0), (2.9, 4.0), (3.6, 4.7), (6.2, 6.2 + COIN_MORE)];
    if x <= MAP[0].0 {
        return q + x;
    }
    for w in MAP.windows(2) {
        let ((a, a2), (b, b2)) = (w[0], w[1]);
        if x <= b {
            return q + a2 + (x - a) * (b2 - a2) / (b - a);
        }
    }
    q + x + COIN_MORE
}

/// How much later all after his coin comes than first timed.
pub const COIN_MORE: f32 = 2.8;

/// K holds his bag out to him over the counter here.
fn keeper_hands_bag(q: f32) -> f32 {
    at_shop(q, 14.5)
}

/// Where his coin lies after it rolled.
fn coin_floor() -> V3 {
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
    use crate::FINALE;

    #[test]
    fn the_day_fits_the_loop() {
        let cast = Cast::new();
        let k = cast.keys;
        println!("{k:#?}");
        println!("tram {:#?}", cast.world.tram);
        assert!(
            (k.rest + FINALE - LOOP).abs() < 0.6,
            "rest {} + {FINALE} vs {LOOP}",
            k.rest
        );
        // The bicycle is back on its stand only once the finale is far.
        assert!(cast.world.bike.home > k.rest + 20.0);
        assert!(k.c0 > k.bread, "{} {}", k.c0, k.bread);
        assert!(cast.world.tram.stop1 > k.rails);
        // She is back at the stove before he walks past it.
        assert!(k.p_set < k.rise + 3.0, "{} {}", k.p_set, k.rise);
        assert!(k.p_sit < k.home, "{} {}", k.p_sit, k.home);
    }

    #[test]
    fn everyone_stays_finite() {
        let cast = Cast::new();
        for i in 0..600 {
            let s = i as f32 * 0.45 - 5.0;
            let m = cast.moment(s, 0.5);
            for (n, f) in m.figures.iter().enumerate() {
                for c in f.body.cones.iter() {
                    assert!(c.iter().all(|v| v.is_finite()), "{n} at {s}");
                }
            }
        }
    }

    #[test]
    fn the_spout_pours_into_the_cup() {
        let cast = Cast::new();
        let s = cast.keys.pour + 1.0;
        let m = cast.moment(s, 0.5);
        let h = &m.held;
        assert!(h.kettle_tilt > 0.85, "{}", h.kettle_tilt);
        let f = v3(h.kettle_yaw.sin(), 0.0, h.kettle_yaw.cos());
        let (st, ct) = h.kettle_tilt.sin_cos();
        let up = Y * ct + f * st;
        let fw = f * ct - Y * st;
        let tip = h.kettle + up * SPOUT[0] + fw * SPOUT[1];
        let d = tip - CUP;
        assert!(d.x.abs() < 0.02 && d.z.abs() < 0.02, "{d:?}");
        // Her hand holds the handle.
        let g = grip(&m.figures[PARTNER].body, 1);
        assert!((g - (h.kettle + up * KETTLE_GRIP)).length() < 0.06, "{g:?}");
    }

    #[test]
    fn the_bread_stays_at_his_side() {
        let cast = Cast::new();
        let k = cast.keys;
        // Walking home and riding the lift, the bag hangs by his hip.
        for i in 0..40 {
            let s = k.shop_out + (k.bread - k.shop_out) * i as f32 / 40.0;
            let m = cast.moment(s, 0.5);
            let b = &m.figures[HERO].body;
            let d = m.held.bag + v3(0.0, BAG_DROP, 0.0) - b.pelvis;
            assert!(
                d.length() < 0.5 && d.y < 0.0,
                "at {s}: {d:?} from the pelvis"
            );
        }
    }
}
