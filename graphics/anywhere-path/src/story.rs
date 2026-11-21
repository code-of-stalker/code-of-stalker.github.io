//! Who goes where and when. He crosses the field into the house, looks out
//! of the window as the train passes, sits at the table opposite the one
//! who lives there, goes out of the back door to the station, rides the
//! train round to the lake, walks out onto the pier in silence, meets a
//! friend on the shore and walks with her along the street to her door,
//! then comes back alone across the field to where he set out. The one at
//! the table sits the whole loop; the friend shows only by the lake and in
//! the street. Their hands and heads are added on top of their plans.
use crate::act::{turn_between, Gait, Local, Path, Plan, Ride, World, WALKING};
use crate::body::{build, Body, Hair, Pose, STAND, SWING_SHARE};
use crate::math::{mix, smooth, v3, window, V3, Y};
use crate::place::{
    angle_of, car_point, facing, from_frame, ground, hf, hf3, polar, toward, DEG, FRIEND_DOOR,
    HOUSE, LAKE, MOON_AZ, MOON_EL, STATION,
};
use crate::LOOP;
use std::f32::consts::{FRAC_PI_2, PI, TAU};

pub const HERO: usize = 0;
pub const HOST: usize = 1;
pub const FRIEND: usize = 2;
pub const FIGS: usize = 3;

/// Two walking side by side and talking.
const TOGETHER: Gait = Gait {
    stride: 0.64,
    period: 0.54,
    swing: SWING_SHARE,
    run: false,
};

/// The moments the camera, the train and the effects keep time by.
#[derive(Clone, Copy, Debug, Default)]
pub struct Keys {
    pub go: f32,
    pub door: f32,
    pub window: f32,
    /// The train passes his window.
    pub t_w: f32,
    pub leave: f32,
    /// He comes up to the doorway into the table room.
    pub through: f32,
    pub seated: f32,
    pub risen: f32,
    pub back_door: f32,
    pub ramp: f32,
    pub at_stop: f32,
    pub board: f32,
    pub at_seat: f32,
    /// The train in at the station, out of it, in at the lake, out.
    pub arrive: f32,
    pub dep: f32,
    pub lake: f32,
    pub lake_dep: f32,
    pub off: f32,
    pub pier_end: f32,
    pub turn_back: f32,
    pub meet: f32,
    pub together: f32,
    pub parted: f32,
    pub her_in: f32,
    pub home_go: f32,
    /// He is back where he set out: the finale.
    pub f0: f32,
}

/// One person in a frame: the body, how much of it shows (0 hidden), the
/// accent (1 for him: his warm rim) and the size.
#[derive(Clone, Debug, PartialEq)]
pub struct Figure {
    pub body: Body,
    pub seen: f32,
    pub accent: f32,
    pub scale: f32,
}

pub struct Story {
    pub plans: Vec<Plan>,
    pub world: World,
    pub keys: Keys,
}

/// The first time from `from` (in steps of 0.02 s, up to `to`) at which
/// his anchor meets `hit`.
fn first(plan: &Plan, world: &World, from: f32, to: f32, hit: impl Fn(V3) -> bool) -> f32 {
    let mut t = from;
    while t < to {
        if hit(plan.anchor(t, world)) {
            return t;
        }
        t += 0.02;
    }
    to
}

fn r_of(p: V3) -> f32 {
    (p.x * p.x + p.z * p.z).sqrt()
}

pub fn moon_dir() -> V3 {
    let (se, ce) = (MOON_EL * DEG).sin_cos();
    let (sa, ca) = (MOON_AZ * DEG).sin_cos();
    v3(ce * ca, se, ce * sa)
}

/// The steps a walk through `points` from `at` takes at `gait` and size `k`
/// (as `Plan::walk` counts them).
fn steps(at: [f32; 2], points: &[[f32; 2]], k: f32, gait: Gait) -> f32 {
    let mut corners = vec![at];
    corners.extend_from_slice(points);
    (Path::new(&corners).length() / k / gait.stride).ceil()
}

fn way_length(at: [f32; 2], points: &[[f32; 2]], k: f32) -> f32 {
    let mut corners = vec![at];
    corners.extend_from_slice(points);
    Path::new(&corners).length() / k
}

/// How long `Plan::turn_by` takes to turn `d`.
fn turn_span(d: f32, quick: f32) -> f32 {
    if d.abs() < 0.05 {
        0.0
    } else {
        (0.5 + 0.5 * d.abs() / FRAC_PI_2) * quick
    }
}

impl Story {
    pub fn new() -> Story {
        let mut world = World::default();
        let mut keys = Keys::default();

        // ---- him ----
        let start = [0.0, 0.0];
        let door_out = hf(10.3, -3.0);
        let door_in = hf(11.7, -3.0);
        let window_spot = hf(16.35, -3.5);
        let h0 = toward(start, door_out);
        let mut h = Plan::new(0.0, v3(0.0, 0.0, 0.0), h0, false, 1.0, LOOP / 35.0);
        h.wait(1.2).mark("go");
        h.walk(&[door_out, door_in, window_spot], ground, WALKING);
        h.turn_to(facing(HOUSE)).mark("window");
        keys.go = h.when("go");
        keys.window = h.when("window");
        keys.t_w = keys.window + 1.3;
        h.wait(2.4).mark("leave");
        keys.leave = h.when("leave");
        // Round the room's corner, through the partition's doorway, to his
        // chair; he sits opposite the one who lives here.
        h.walk(
            &[
                hf(15.0, -1.6),
                hf(14.5, -0.3),
                hf(14.3, 0.9),
                hf(14.1, 2.45),
                hf(13.5, 2.45),
            ],
            ground,
            WALKING,
        );
        h.turn_to(facing(HOUSE + 90.0));
        h.sit(1.3).mark("seated").wait(5.5).rise(1.1).mark("risen");
        keys.seated = h.when("seated");
        keys.risen = h.when("risen");
        // Out of the back door and along the road to the station.
        let road_from = h.t;
        h.walk(
            &[
                hf(14.9, 2.2),
                hf(14.95, 5.4),
                hf(15.0, 6.7),
                polar(18.6, 56.5),
                polar(19.3, 72.0),
                polar(20.6, STATION - 26.5),
                polar(21.1, STATION - 24.5),
                polar(21.2, STATION - 19.0),
                polar(21.3, STATION - 9.0),
                polar(21.6, STATION),
            ],
            ground,
            WALKING,
        )
        .mark("at_stop");
        keys.at_stop = h.when("at_stop");
        // Into the car by its middle door, to the far door's window.
        h.walk(
            &[polar(23.0, STATION), polar(24.25, STATION + 0.6)],
            ground,
            WALKING,
        );
        h.turn_to(facing(STATION + 0.6)).mark("at_seat");
        keys.at_seat = h.when("at_seat");
        keys.arrive = keys.t_w + 9.0;
        keys.dep = keys.at_seat + 0.6;
        keys.lake = keys.dep + 12.0;
        keys.lake_dep = keys.lake + 6.4;
        world.train = [
            (0.0, -70.0),
            (4.0, -70.0),
            (keys.t_w - 1.2, 9.0),
            (keys.t_w, 21.5),
            (keys.t_w + 1.2, 34.0),
            (keys.arrive, STATION),
            (keys.dep, STATION),
            (keys.lake, LAKE),
            (keys.lake_dep, LAKE),
            (keys.lake_dep + 10.0, 290.0),
            (LOOP, 290.0),
        ]
        .iter()
        .map(|&(t, d)| (t, d * DEG))
        .collect();
        h.ride_until(Ride::Train, keys.lake + 0.9, &world)
            .mark("off");
        keys.off = h.when("off");
        // Out onto the halt, down to the shore, out along the pier.
        h.turn_to(facing(LAKE + 180.0));
        h.walk(&[polar(23.0, LAKE), polar(15.4, LAKE)], ground, WALKING)
            .mark("pier_end");
        keys.pier_end = h.when("pier_end");
        // He stands a long while: the moon through his eyes.
        h.wait(8.5).turn_by(PI).mark("turn_back");
        keys.turn_back = h.when("turn_back");
        // Back to the shore, where she waits.
        let meet = polar(19.3, 244.2);
        let her = polar(20.1, 245.0);
        h.walk(
            &[polar(19.6, LAKE), polar(19.35, 238.0), meet],
            ground,
            WALKING,
        )
        .mark("meet");
        keys.meet = h.when("meet");
        h.turn_to(toward(meet, her)).wait(1.0);
        let hero_way = [
            polar(19.1, 248.0),
            polar(18.9, 254.0),
            polar(18.6, 262.0),
            polar(18.5, 268.0),
            polar(18.4, 273.0),
        ];
        let her_way = [
            polar(19.8, 248.5),
            polar(19.6, 254.0),
            polar(19.3, 262.0),
            polar(19.2, 268.0),
            polar(19.1, 273.4),
        ];
        h.turn_to(toward(meet, hero_way[0]));
        let go = h.t + 0.2;
        h.wait_until(go).mark("together");
        keys.together = go;
        let n = steps(meet, &hero_way, h.k, TOGETHER);
        h.walk(&hero_way, ground, TOGETHER).mark("parted");
        keys.parted = h.when("parted");
        // He watches her to her door, waves and goes home across the field.
        h.wait(1.8).mark("home_go");
        keys.home_go = h.when("home_go");
        h.walk(&[start], ground, WALKING).mark("f0");
        keys.f0 = h.when("f0");
        h.turn_to(h0);
        h.wait_until(LOOP);

        // ---- the friend: waits by the lake, walks with him, goes in ----
        let mut f = Plan::new(
            0.0,
            v3(her[0], 0.0, her[1]),
            toward(her, meet),
            false,
            0.94,
            LOOP / 38.0,
        );
        let out = toward(her, her_way[0]);
        let span = turn_span(turn_between(f.heading, out), f.quick);
        f.wait_until(go - span).turn_to(out).wait_until(go);
        // Her steps as many as his, so the two arrive together.
        let gait = Gait {
            stride: way_length(her, &her_way, f.k) / (n - 0.01),
            ..TOGETHER
        };
        f.walk(&her_way, ground, gait).mark("parted");
        f.wait(0.4)
            .walk(&[polar(20.35, FRIEND_DOOR)], ground, WALKING)
            .mark("in");
        keys.her_in = f.when("in");
        f.wait_until(LOOP);

        // ---- the one at the table ----
        let mut host = Plan::new(
            0.0,
            hf3(13.5, 0.0, 3.55),
            facing(HOUSE - 90.0),
            true,
            0.97,
            LOOP / 32.0,
        );
        host.wait_until(LOOP);

        // Crossings the camera cuts on.
        keys.door = first(&h, &world, keys.go, keys.window, |p| {
            from_frame(HOUSE, p.x, p.z)[0] >= 11.0
        });
        keys.through = first(&h, &world, keys.leave, keys.seated, |p| {
            from_frame(HOUSE, p.x, p.z)[1] >= -0.5
        });
        keys.back_door = first(&h, &world, road_from, keys.at_stop, |p| {
            from_frame(HOUSE, p.x, p.z)[1] >= 6.0
        });
        keys.ramp = first(&h, &world, road_from, keys.at_stop, |p| {
            angle_of(p.x, p.z) >= STATION - 26.0
        });
        keys.board = first(&h, &world, keys.at_stop, keys.at_seat, |p| r_of(p) >= 22.2);

        Story {
            plans: vec![h, host, f],
            world,
            keys,
        }
    }

    pub fn breath(&self, i: usize, t: f32) -> f32 {
        let period = [LOOP / 34.0, LOOP / 37.0, LOOP / 31.0][i];
        0.5 + 0.5 * (TAU * t / period + i as f32).sin()
    }

    /// How much of the friend shows: she comes while he stands on the
    /// pier (the camera on the lake) and goes in at her door.
    pub fn seen(&self, i: usize, t: f32) -> f32 {
        let k = &self.keys;
        match i {
            FRIEND => {
                smooth(k.pier_end + 2.4, k.pier_end + 3.2, t)
                    * (1.0 - smooth(k.her_in - 0.5, k.her_in + 0.3, t))
            }
            _ => 1.0,
        }
    }

    pub fn figures(&self, t: f32) -> Vec<Figure> {
        let hero = self.body(HERO, t, V3::default());
        let head = hero.head;
        let mut out = vec![Figure {
            body: hero,
            seen: 1.0,
            accent: 1.0,
            scale: self.plans[HERO].k,
        }];
        for i in [HOST, FRIEND] {
            out.push(Figure {
                body: self.body(i, t, head),
                seen: self.seen(i, t),
                accent: 0.0,
                scale: self.plans[i].k,
            });
        }
        out
    }

    fn body(&self, i: usize, t: f32, hero_head: V3) -> Body {
        let plan = &self.plans[i];
        let act = plan.act_at(t);
        let carried = self.world.carried(act.ride, act.t0, t);
        let local = act.frame(t, carried);
        let mut pose = act.pose(t, self.breath(i, t));
        // Each their own: the one at the table bald, she with her hair
        // down to her shoulders and a long coat.
        match i {
            HOST => pose.hair = Hair::Bald,
            FRIEND => {
                pose.hair = Hair::Long;
                pose.coat = 0.1;
            }
            _ => {}
        }
        self.gestures(i, t, &mut pose, &local, hero_head);
        act.body_at(t, &pose, carried)
    }

    /// Where a figure's head is, near enough to look at: over its frame.
    fn head_near(&self, i: usize, t: f32) -> V3 {
        self.plans[i].frame_at(t, &self.world).origin + Y * (1.6 * self.plans[i].k)
    }

    fn gestures(&self, i: usize, t: f32, pose: &mut Pose, local: &Local, hero_head: V3) {
        let k = &self.keys;
        let phi = self.world.train_at(t);
        match i {
            HERO => {
                // The window: his hands on the sill, he watches the train.
                let at_window = window(t, k.window - 0.5, k.window, k.leave, k.leave + 0.5);
                reach(pose, local, 0, hf3(16.82, 0.92, -3.72), 0.8 * at_window);
                reach(pose, local, 1, hf3(16.82, 0.92, -3.28), 0.8 * at_window);
                look(pose, local, car_point(phi, 0.0, 1.9, 0.0), 0.9 * at_window);

                // The table: hands on it, eyes on the one opposite; he speaks
                // first (his right hand with the words), then listens.
                let s = k.seated;
                let at_table = window(t, s - 0.3, s + 0.5, k.risen - 1.4, k.risen - 0.8);
                let speak = window(t, s + 0.5, s + 0.9, s + 2.5, s + 2.9);
                reach(pose, local, 0, hf3(13.66, 0.79, 2.52), at_table);
                reach(pose, local, 1, hf3(13.34, 0.79, 2.52), at_table);
                let lift = 0.06 * (TAU * t / 1.25).sin();
                reach(
                    pose,
                    local,
                    1,
                    hf3(13.28, 1.0 + lift, 2.42),
                    0.85 * speak * at_table,
                );
                look(pose, local, hf3(13.5, 1.22, 4.2), 0.9 * at_table);
                pose.nod += 0.12 * (window(t, s + 3.3, s + 3.5, s + 3.7, s + 3.9))
                    + 0.1 * window(t, s + 4.4, s + 4.6, s + 4.8, s + 5.0);

                // The train: his right hand on the door's rail, looking out
                // at the country streaming past.
                let ride = window(
                    t,
                    k.at_seat - 0.5,
                    k.at_seat + 0.2,
                    k.off - 0.1,
                    k.off + 0.5,
                );
                reach(pose, local, 1, car_point(phi, 1.16, 1.55, 0.72), ride);
                look(pose, local, car_point(phi, 5.0, 1.5, 2.4), 0.55 * ride);

                // The pier: the moon over the water.
                let silence = window(
                    t,
                    k.pier_end - 0.2,
                    k.pier_end + 1.0,
                    k.turn_back - 1.6,
                    k.turn_back - 0.9,
                );
                look(
                    pose,
                    local,
                    local.world(v3(0.0, 1.6, 0.0)) + moon_dir() * 40.0,
                    silence,
                );

                // With her: he looks at her, more when they stop; speaks.
                let with_her = window(t, k.meet - 0.8, k.meet, k.parted + 1.4, k.parted + 1.8);
                let walking = window(
                    t,
                    k.together + 0.4,
                    k.together + 1.2,
                    k.parted - 0.8,
                    k.parted,
                );
                let talk = window(
                    t,
                    k.together + 1.0,
                    k.together + 1.4,
                    k.together + 3.4,
                    k.together + 3.8,
                );
                let her_head = self.head_near(FRIEND, t) - Y * 0.08;
                look(
                    pose,
                    local,
                    her_head,
                    with_her * (0.9 - 0.55 * walking + 0.35 * talk * walking),
                );
                pose.arms[1] += 0.22 * talk * (0.5 + 0.5 * (TAU * t / 1.3).sin());
                pose.bend[1] += 0.45 * talk;
                // He waves after her.
                let wave = window(
                    t,
                    k.parted + 0.4,
                    k.parted + 0.7,
                    k.parted + 1.4,
                    k.parted + 1.7,
                );
                let sway = 0.08 * (TAU * t / 0.7).sin();
                hold(pose, 1, v3(-0.3 + sway, 1.76, 0.16), wave);

                // Back where he set out, he lifts his head to the sky.
                pose.nod -= 0.22 * window(t, k.f0 + 3.0, k.f0 + 6.0, LOOP - 6.0, LOOP - 1.5);
            }
            HOST => {
                // Hands on the table the whole time; eyes on him while he is
                // with them, otherwise down at the table.
                reach(pose, local, 0, hf3(13.34, 0.79, 3.48), 1.0);
                reach(pose, local, 1, hf3(13.66, 0.79, 3.48), 1.0);
                let s = k.seated;
                let with_him = window(t, s - 1.6, s - 0.6, k.risen + 0.6, k.risen + 1.6);
                let at = if with_him > 0.0 {
                    hero_head
                } else {
                    hf3(13.5, 1.2, 1.9)
                };
                look(pose, local, at, 0.9 * with_him);
                pose.nod += 0.3 * (1.0 - with_him);
                // Listening, nods; then speaks with a hand.
                pose.nod += 0.1 * window(t, s + 1.2, s + 1.4, s + 1.6, s + 1.8)
                    + 0.1 * window(t, s + 2.0, s + 2.2, s + 2.4, s + 2.6);
                let speak = window(t, s + 3.0, s + 3.4, s + 5.0, s + 5.4);
                let lift = 0.05 * (TAU * t / 1.4 + 1.0).sin();
                reach(pose, local, 1, hf3(13.72, 1.0 + lift, 3.58), 0.85 * speak);
            }
            FRIEND => {
                let with_him = window(
                    t,
                    k.meet - 2.2,
                    k.meet - 1.0,
                    k.parted + 0.2,
                    k.parted + 0.6,
                );
                let walking = window(
                    t,
                    k.together + 0.4,
                    k.together + 1.2,
                    k.parted - 0.8,
                    k.parted,
                );
                let talk = window(
                    t,
                    k.together + 4.0,
                    k.together + 4.4,
                    k.together + 6.6,
                    k.together + 7.0,
                );
                look(
                    pose,
                    local,
                    hero_head,
                    with_him * (0.9 - 0.5 * walking + 0.4 * talk * walking),
                );
                pose.arms[0] += 0.22 * talk * (0.5 + 0.5 * (TAU * t / 1.2).sin());
                pose.bend[0] += 0.45 * talk;
                // A wave from her door.
                let wave = window(
                    t,
                    k.parted + 0.1,
                    k.parted + 0.4,
                    k.parted + 1.0,
                    k.parted + 1.3,
                );
                let sway = 0.08 * (TAU * t / 0.65).sin();
                hold(pose, 0, v3(0.3 + sway, 1.72, 0.16), wave);
            }
            _ => {}
        }
    }

    /// His smooth anchor and heading at `t`.
    pub fn hero_at(&self, t: f32) -> (V3, f32) {
        let plan = &self.plans[HERO];
        (
            plan.anchor(t, &self.world),
            plan.frame_at(t, &self.world).heading,
        )
    }
}

impl Default for Story {
    fn default() -> Self {
        Story::new()
    }
}

// ---- gestures (from «День дома») ----

/// The hand on `side` aims its wrist at `w` (the walk's frame), `a` of the
/// way: what it reached for before keeps its share.
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
/// walk's origin).
fn hold(pose: &mut Pose, side: usize, at: V3, a: f32) {
    let p = pose.pelvis;
    aim(
        pose,
        side,
        v3(p.x + at.x, p.y + at.y - STAND, p.z + at.z),
        a,
    );
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
