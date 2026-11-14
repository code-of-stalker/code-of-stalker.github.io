//! The figure: footsteps make a walk, the walk a pose, and the pose 23
//! cones (rounded, or flat-ended where cloth ends) that the body shader
//! blends into one surface of light, and for him `OWN` more: his thumbs
//! and his umbrella. Metres; the figure faces +z, its left is +x, up is +y.
use crate::math::{min_jerk, mix, monotone, rotate, smooth, softmin, v3, V3, Y};
use std::f32::consts::{PI, TAU};

pub const PRIMITIVES: usize = 23;
/// How softly each cone melts into the ones before it, metres.
pub const BLEND: [f32; PRIMITIVES] = [
    0.0, 0.09, 0.08, 0.07, // the coat's two skirts, torso, shoulders
    0.04, 0.03, 0.025, // neck, head, collar
    0.05, 0.05, 0.03, 0.03, // thighs, shins
    0.025, 0.025, 0.012, 0.012, // feet, toes
    0.05, 0.05, 0.015, 0.015, 0.012, 0.012, // upper arms, sleeves, hands
    0.01, 0.01, // what it carries
];
/// Cones by what they are, for the shader and the camera.
pub const NECK: usize = 4;
pub const HEAD: usize = 5;
pub const COLLAR: usize = 6;
pub const HANDS: [usize; 2] = [19, 20];
pub const PROPS: [usize; 2] = [21, 22];
/// His own parts after every figure's `PRIMITIVES` (the passers' are not
/// drawn): a thumb on each hand, then his umbrella's handle, its shaft and
/// its canopy. The canopy is no cone: its first end is the canopy's crown
/// and its rim's radius, its second the rim's centre and the cloth's
/// thickness (a thin dome, the shader draws it so).
pub const OWN: usize = 5;
pub const ALL: usize = PRIMITIVES + OWN;
pub const THUMBS: [usize; 2] = [PRIMITIVES, PRIMITIVES + 1];
pub const HANDLE: usize = PRIMITIVES + 2;
pub const SHAFT: usize = PRIMITIVES + 3;
pub const CANOPY: usize = PRIMITIVES + 4;
/// His umbrella: the canopy's radius at the rim, how deep it domes, the
/// cloth's thickness; its crown this high over his own and this far
/// ahead of it and to his left.
pub const CANOPY_R: f32 = 0.5;
pub const CANOPY_DEPTH: f32 = 0.2;
pub const CANOPY_CLOTH: f32 = 0.004;
const CANOPY_UP: f32 = 0.45;
const CANOPY_AHEAD: f32 = 0.12;
const CANOPY_LEFT: f32 = 0.08;
/// A cone's squash keep below zero marks it flat-ended (cut square, its
/// edge rounded this much) instead of capped by spheres.
pub const CUT_ROUND: f32 = 0.008;
/// A phone's thickness, of its width, and half of it, metres.
const PHONE_KEEP: f32 = 0.13;
const PHONE_HALF: f32 = 0.036 * PHONE_KEEP;
/// His own phone on page 08 (a box, not a cone): half its width, half its
/// length and half its thickness; its screen's half width and half length.
pub const PHONE_SIZE: [f32; 3] = [0.036, 0.0765, 0.0045];
pub const PHONE_SCREEN: [f32; 2] = [0.0335, 0.0725];
/// Its corners in its plane, its edges' rounding, its screen's corners (m).
pub const PHONE_ROUND: [f32; 3] = [0.009, 0.003, 0.0065];
/// Where its centre is from the wrist that holds it: to the right as he
/// sees it, and up its length.
const PHONE_WRIST: [f32; 2] = [0.025, 0.085];

/// One cone before it is laid down.
#[derive(Clone, Copy, Debug)]
struct Part {
    a: V3,
    ra: f32,
    b: V3,
    rb: f32,
    squash: Option<(V3, f32)>,
}

impl Part {
    fn plain(a: V3, ra: f32, b: V3, rb: f32) -> Part {
        Part {
            a,
            ra,
            b,
            rb,
            squash: None,
        }
    }
}

/// A hand: from its wrist along `dir` for `length`, flattened along its
/// palm's normal to `keep` of its width.
#[derive(Clone, Copy, Debug)]
struct Grip {
    wrist: V3,
    dir: V3,
    palm: V3,
    length: f32,
    radii: [f32; 2],
    keep: f32,
}

/// How far from the wrist a fist's curled fingers hold a handle.
const FIST_HOLD: f32 = 0.048;

impl Grip {
    /// Open, as the arm carries it.
    fn open(wrist: V3, dir: V3, palm: V3) -> Grip {
        Grip {
            wrist,
            dir,
            palm,
            length: HAND,
            radii: [0.028, 0.02],
            keep: 0.55,
        }
    }

    /// Closed round a handle that runs up to `toward`: shorter and rounder,
    /// across the handle, which passes through its curled fingers.
    fn fist(open: &Grip, toward: V3) -> Grip {
        let mut dir = open.dir;
        let mut up = Y;
        for _ in 0..2 {
            up = (toward - (open.wrist + dir * FIST_HOLD)).normalize();
            dir = (open.dir - up * open.dir.dot(up)).normalize();
        }
        Grip {
            wrist: open.wrist,
            dir,
            palm: up.cross(dir).normalize(),
            length: 0.082,
            radii: [0.03, 0.028],
            keep: 0.86,
        }
    }

    /// Flat, its palm turned to face `facing`.
    fn flat(open: &Grip, facing: V3) -> Grip {
        Grip {
            wrist: open.wrist,
            dir: (open.dir - facing * open.dir.dot(facing)).normalize(),
            palm: facing,
            length: 0.1,
            radii: [0.028, 0.021],
            keep: 0.5,
        }
    }

    /// Where a fist holds its handle.
    fn centre(&self) -> V3 {
        self.wrist + self.dir * FIST_HOLD
    }

    /// Half its thickness across the palm, at its middle.
    fn half_thickness(&self) -> f32 {
        0.25 * (self.radii[0] + self.radii[1]) * self.keep
    }
}

/// What a figure carries in its right hand, if anything.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum Carry {
    #[default]
    Nothing,
    /// An open umbrella over the head.
    Umbrella,
    /// A phone held before the face, and a hood up.
    Phone,
    /// A phone and no hood: out of the pocket this much, 0 … 1 (it grows
    /// from nothing in the hand as the hand brings it up).
    Screen(f32),
}

/// His own phone in the left hand (page 08), each 0 … 1 unless said: how
/// far the hand reaches for the pocket and then holds the phone; how far
/// out of the pocket it is (it grows from nothing in the hand); how far the
/// hand has brought it up from the pocket; where before him it is held (0
/// at the chest, 1 before the eyes, 2 under the mouth); and the thumb over
/// its screen: across (0 left … 1 right), down (0 top … 1 bottom) and how
/// far pressed (0 lifted … 1 on the glass).
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Held {
    pub reach: f32,
    pub out: f32,
    pub raise: f32,
    pub hold: f32,
    pub thumb: [f32; 3],
}

pub const THIGH: f32 = 0.43;
pub const SHIN: f32 = 0.42;
pub const HIP: f32 = 0.09;
pub const SHOULDER: f32 = 0.18;
pub const UPPER_ARM: f32 = 0.29;
pub const FOREARM: f32 = 0.25;
pub const HAND: f32 = 0.11;
/// The arms hang this far open at the shoulder and turn back in at the
/// elbow, radians.
const ABDUCT: f32 = 0.12;
const ADDUCT: f32 = 0.07;
/// The arms swing against the legs: radians per metre between the feet.
const ARM_SWING: f32 = 0.9;
const ARM_LAG: f32 = 0.07;
/// The pelvis: its height standing and walking, how far it dips as a heel
/// lands, how far ahead of the heels it rides and how far over the
/// standing foot it sways.
pub const STAND: f32 = 0.922;
pub const WALK: f32 = 0.905;
const BOB: f32 = 0.012;
const AHEAD: f32 = 0.06;
const SWAY: f32 = 0.42;
const SHIFT: f32 = 0.5;
/// Turning to look aside, the pelvis and the chest take these shares of
/// the head's turn.
const PELVIS_TURN: f32 = 0.35;
const CHEST_TURN: f32 = 0.75;
/// It turns with the legs and rolls down on the swinging side; radians.
const TURN: f32 = 0.075;
const DIP: f32 = 0.05;
const LEAN: f32 = 0.045;

/// Points of the foot in its own frame, (forward, up) from the ground
/// under the heel: the heel's sphere, the ball's sphere, the ankle joint,
/// the end of the toes.
const HEEL: [f32; 2] = [0.0, 0.035];
const BALL: [f32; 2] = [0.13, 0.03];
const ANKLE: [f32; 2] = [0.015, 0.08];
const TOE: [f32; 2] = [0.185, 0.022];
/// The heel strikes toes up and rolls flat; before lifting the heel rises
/// until the foot stands steep on its ball; in between the foot clears the
/// ground by this much.
const STRIKE: f32 = 12.0 * PI / 180.0;
const ROLL: f32 = 0.12;
const LIFT: f32 = 35.0 * PI / 180.0;
const HEEL_OFF: f32 = 0.25;
const CLEARANCE: f32 = 0.07;
/// Toes turn out this much, radians.
pub const TOE_OUT: f32 = 5.0 * PI / 180.0;

/// Seated, the pelvis rides this high and this far behind the heels, the
/// trunk leans this little, and the hands rest on the thighs: the arms
/// forward this much, the elbows bent this much more.
pub const SEAT_PELVIS: f32 = 0.56;
pub const SEAT_BACK: f32 = 0.42;
const SEAT_LEAN: f32 = 0.03;
const SEAT_ARMS: f32 = 0.34;
const SEAT_BEND: f32 = 0.3;
/// Rising, the trunk first leans this far forward over the feet (radians);
/// then the seat is left and the legs straighten as it comes upright.
const SEAT_FLEX: f32 = 0.55;
/// Seated, the walk's track stays this share of the way back to the seat.
const SEAT_FOLLOW: f32 = 0.5;

/// A rise from a seat (`up`) or a sit down onto one between two times; the
/// feet stay where they stand.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rest {
    pub from: f32,
    pub to: f32,
    pub up: bool,
}

/// Rising from a seat, `s` 0 seated … 1 standing: how far the pelvis has
/// gone forward and how far up toward standing, how far the trunk leans
/// over the feet, how much the hands still rest on the thighs. Sitting
/// down is the same run backwards.
fn rising(s: f32) -> (f32, f32, f32, f32) {
    let forward = 0.08 * smooth(0.0, 0.35, s) + 0.92 * min_jerk((s - 0.3) / 0.6);
    let up = min_jerk((s - 0.34) / 0.6);
    let flex = smooth(0.0, 0.38, s) * (1.0 - smooth(0.42, 0.95, s));
    let hands = 1.0 - smooth(0.2, 0.65, s);
    (forward, up, flex, hands)
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Foot {
    pub heel: V3,
    pub ball: V3,
    pub toe: V3,
    pub ankle: V3,
    /// How much of the body this foot carries, 0..1: all of it from the
    /// heel strike, less as the heel rises, coming back late in the swing.
    pub support: f32,
    /// 0 on the ground, 1 mid-swing.
    pub swing: f32,
}

/// The foot from its heel sphere's centre, turned `yaw` and tipped toes-up
/// by `pitch`. Tipped toes-down, the toes stay flat on the ground.
fn foot_at(heel: V3, yaw: f32, pitch: f32) -> Foot {
    let flat = v3(yaw.sin(), 0.0, yaw.cos());
    let (s, c) = pitch.sin_cos();
    let f = flat * c + Y * s;
    let u = Y * c - flat * s;
    let at = |q: [f32; 2]| heel + f * (q[0] - HEEL[0]) + u * (q[1] - HEEL[1]);
    let ball = at(BALL);
    let toe = if pitch >= 0.0 {
        at(TOE)
    } else {
        ball + flat * (TOE[0] - BALL[0]) + Y * (TOE[1] - BALL[1])
    };
    Foot {
        heel,
        ball,
        toe,
        ankle: at(ANKLE),
        support: 1.0,
        swing: 0.0,
    }
}

/// The foot standing at (`x`, `y`, `z`), `since` seconds after it landed
/// and `until` seconds before it lifts: rocking flat off its heel, then up
/// onto its ball.
fn standing(x: f32, y: f32, z: f32, yaw: f32, since: f32, until: f32) -> Foot {
    let flat = v3(yaw.sin(), 0.0, yaw.cos());
    let ground = v3(x, y, z);
    if until < HEEL_OFF {
        let off = smooth(0.0, 1.0, 1.0 - until / HEEL_OFF);
        let pitch = -LIFT * off;
        let (s, c) = pitch.sin_cos();
        let (f, u) = (flat * c + Y * s, Y * c - flat * s);
        let ball = ground + flat * BALL[0] + Y * BALL[1];
        let heel = ball - f * (BALL[0] - HEEL[0]) - u * (BALL[1] - HEEL[1]);
        Foot {
            support: 1.0 - off,
            ..foot_at(heel, yaw, pitch)
        }
    } else {
        let pitch = STRIKE * (1.0 - smooth(0.0, ROLL, since));
        foot_at(ground + flat * HEEL[0] + Y * HEEL[1], yaw, pitch)
    }
}

/// One footstep: the foot lifts, swings and lands at (`x`, `z`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Step {
    pub side: usize,
    pub lift: f32,
    pub land: f32,
    pub x: f32,
    pub z: f32,
}

/// A walk from authored footsteps: where each foot stands first, then its
/// steps, and the pelvis's path keyed from them.
#[derive(Clone, Debug)]
pub struct Walk {
    steps: Vec<Step>,
    feet: [Vec<Step>; 2],
    start: [[f32; 2]; 2],
    pelvis_z: Vec<(f32, f32)>,
    pelvis_x: Vec<(f32, f32)>,
    amount: Vec<(f32, f32)>,
    /// Standing, the body sways once in this many seconds.
    sway: f32,
    /// When it rises from a seat and sits down again, in time order.
    rests: Vec<Rest>,
    /// The ground's height along z where the feet stand (a stair's
    /// treads), and the smooth line the pelvis rides over it.
    floor: fn(f32) -> f32,
    ramp: fn(f32) -> f32,
}

/// Level ground.
fn level(_: f32) -> f32 {
    0.0
}

impl Walk {
    /// `steps` in time order, left foot 0, right foot 1. They come in bouts
    /// with a pause of at least `PAUSE` s between: the first step of each
    /// lifts the foot that does not carry the weight, the last brings a foot
    /// to rest.
    pub fn new(start: [[f32; 2]; 2], steps: Vec<Step>, sway: f32) -> Walk {
        let mut feet = [Vec::new(), Vec::new()];
        for s in &steps {
            feet[s.side].push(*s);
        }
        let mean = |w: [[f32; 2]; 2], i: usize| 0.5 * (w[0][i] + w[1][i]);
        let mut place = start;
        let (mut pelvis_z, mut pelvis_x, mut amount) = (vec![], vec![], vec![]);
        let mut from = 0;
        while from < steps.len() {
            let mut to = from + 1;
            while to < steps.len() && steps[to].lift - steps[to - 1].land < PAUSE {
                to += 1;
            }
            let bout = &steps[from..to];
            let first = bout[0];
            let last = bout[bout.len() - 1];
            // The weight shifts and sways about the middle of the feet.
            let m = mean(place, 0);
            pelvis_z.push((first.lift - 0.15, mean(place, 1) + AHEAD));
            pelvis_x.push((first.lift - 0.6, m));
            pelvis_x.push((
                first.lift - 0.02,
                m + SHIFT * (place[1 - first.side][0] - m),
            ));
            for (i, s) in bout.iter().enumerate() {
                place[s.side] = [s.x, s.z];
                let m = mean(place, 0);
                if i + 1 == bout.len() {
                    pelvis_z.push((s.land + 0.3, mean(place, 1) + AHEAD));
                    pelvis_x.push((s.land + 0.45, m));
                } else {
                    pelvis_z.push((s.land, mean(place, 1) + AHEAD));
                    pelvis_x.push((s.land + 0.25, m + SWAY * (s.x - m)));
                }
            }
            let before_last = bout[bout.len().saturating_sub(2)];
            amount.extend([
                (first.lift - 0.5, 0.0),
                (first.land, 1.0),
                (before_last.land, 1.0),
                (last.land + 0.3, 0.0),
            ]);
            from = to;
        }
        Walk {
            amount,
            steps,
            feet,
            start,
            pelvis_z,
            pelvis_x,
            sway,
            rests: Vec::new(),
            floor: level,
            ramp: level,
        }
    }

    /// The same walk over ground whose height along z is `floor` (where
    /// the feet stand) and `ramp` (the smooth line the pelvis rides).
    pub fn on_ground(mut self, floor: fn(f32) -> f32, ramp: fn(f32) -> f32) -> Walk {
        self.floor = floor;
        self.ramp = ramp;
        self
    }

    /// The same walk, rising from a seat and sitting down at `rests`; seated
    /// before the first if that one rises.
    pub fn with_rests(mut self, rests: Vec<Rest>) -> Walk {
        self.rests = rests;
        self
    }

    /// How far the figure has risen from its seat, 0 seated … 1 standing.
    pub fn risen(&self, t: f32) -> f32 {
        let mut s = match self.rests.first() {
            Some(r) if r.up => 0.0,
            _ => 1.0,
        };
        for r in &self.rests {
            if t < r.from {
                break;
            }
            let p = ((t - r.from) / (r.to - r.from)).clamp(0.0, 1.0);
            s = if r.up { p } else { 1.0 - p };
        }
        s
    }

    /// A step of `stride` every `period` seconds from step `from` to `to`,
    /// the left foot landing on the even ones at z = k·stride.
    pub fn steady(period: f32, stride: f32, width: f32, from: i32, to: i32, sway: f32) -> Walk {
        let steps: Vec<Step> = (from..to)
            .map(|k| {
                let side = k.rem_euclid(2) as usize;
                let land = k as f32 * period;
                Step {
                    side,
                    lift: land - SWING_SHARE * period,
                    land,
                    x: if side == 0 { width } else { -width },
                    z: k as f32 * stride,
                }
            })
            .collect();
        let behind = |side: usize| {
            let s = steps
                .iter()
                .find(|s| s.side == side)
                .expect("both feet step");
            [s.x, s.z - 2.0 * stride]
        };
        Walk::new([behind(0), behind(1)], steps, sway)
    }

    pub fn steps(&self) -> &[Step] {
        &self.steps
    }

    /// The pelvis's path forward without its idle sway: what the camera and
    /// the outer ring follow.
    pub fn track(&self, t: f32) -> f32 {
        let (forward, ..) = rising(self.risen(t));
        monotone(&self.pelvis_z, t) - SEAT_FOLLOW * (SEAT_BACK + AHEAD) * (1.0 - forward)
    }

    /// How much the figure is walking, 0 standing to 1.
    pub fn amount(&self, t: f32) -> f32 {
        monotone(&self.amount, t)
    }

    pub fn foot(&self, side: usize, t: f32) -> Foot {
        let plants = &self.feet[side];
        let yaw = if side == 0 { TOE_OUT } else { -TOE_OUT };
        let begun = plants.partition_point(|p| p.lift <= t);
        let place = |j: usize| {
            if j == 0 {
                self.start[side]
            } else {
                [plants[j - 1].x, plants[j - 1].z]
            }
        };
        let next_lift = |j: usize| plants.get(j).map_or(f32::INFINITY, |p| p.lift - t);
        let floor = self.floor;
        if begun == 0 {
            let [x, z] = place(0);
            return standing(x, floor(z), z, yaw, f32::INFINITY, next_lift(0));
        }
        let p = plants[begun - 1];
        if t >= p.land {
            return standing(p.x, floor(p.z), p.z, yaw, t - p.land, next_lift(begun));
        }
        let s = ((t - p.lift) / (p.land - p.lift)).clamp(0.0, 1.0);
        let [x, z] = place(begun - 1);
        let from = standing(x, floor(z), z, yaw, f32::INFINITY, 0.0);
        let to = standing(p.x, floor(p.z), p.z, yaw, 0.0, f32::INFINITY);
        let rise = (PI * s).sin();
        let mut heel = from.heel.lerp(to.heel, min_jerk(s)) + Y * (CLEARANCE * rise);
        let (below, above) = (floor(z), floor(p.z));
        let climb = above - below;
        if climb.abs() > 1e-4 {
            // On a stair the foot rises early to clear the nosing going up,
            // and keeps clear of it going down before it drops; the heel's
            // own rocking goes as on the flat.
            let share = if climb > 0.0 {
                smooth(0.0, 0.6, s)
            } else {
                smooth(0.35, 1.0, s)
            };
            let rocking = mix(from.heel.y - below, to.heel.y - above, min_jerk(s));
            heel.y = below + climb * share + rocking + (CLEARANCE + 0.3 * climb.abs()) * rise;
        }
        Foot {
            support: smooth(0.6, 1.0, s),
            swing: rise,
            ..foot_at(heel, yaw, mix(-LIFT, STRIKE, smooth(0.0, 0.7, s)))
        }
    }

    /// The landings up to `t`, newest first: where and when each heel struck.
    pub fn landings(&self, t: f32) -> impl Iterator<Item = &Step> {
        let done = self.steps.partition_point(|s| s.land <= t);
        self.steps[..done].iter().rev()
    }

    /// The whole figure at `t`; `breath` 0..1 fills the chest.
    pub fn pose(&self, t: f32, breath: f32) -> Pose {
        let feet = [self.foot(0, t), self.foot(1, t)];
        let amount = self.amount(t);
        let still = 1.0 - amount;
        let sway = TAU * t / self.sway;
        let x = monotone(&self.pelvis_x, t) + still * 0.006 * sway.sin();
        let z = monotone(&self.pelvis_z, t) + still * 0.004 * (2.0 * sway + 1.0).sin();
        // Lowest as a heel lands, highest over the standing foot.
        let done = self.steps.partition_point(|s| s.land <= t);
        let phase = match (done.checked_sub(1), self.steps.get(done)) {
            (Some(a), Some(b)) => {
                let a = self.steps[a].land;
                (t - a) / (b.land - a)
            }
            _ => 0.5,
        };
        let mut y = mix(STAND, WALK, amount) - BOB * amount * (0.5 + 0.5 * (TAU * phase).cos())
            + (self.ramp)(z);
        let yaw = (-TURN * (feet[0].ankle.z - feet[1].ankle.z) / 0.62).clamp(-0.12, 0.12);
        // The legs must reach the feet that carry the body.
        let reach = (THIGH + SHIN) * 0.997;
        for (side, foot) in feet.iter().enumerate() {
            if foot.support <= 0.0 {
                continue;
            }
            let sgn = if side == 0 { 1.0 } else { -1.0 };
            let hip = v3(x + HIP * sgn * yaw.cos(), 0.0, z - HIP * sgn * yaw.sin());
            let (dx, dz) = (hip.x - foot.ankle.x, hip.z - foot.ankle.z);
            let top = foot.ankle.y + (reach * reach - dx * dx - dz * dz).max(0.0).sqrt();
            y = mix(y, softmin(y, top, 0.03), foot.support);
        }
        let lagged = |side: usize| self.foot(side, t - ARM_LAG).ankle.z;
        let apart = lagged(0) - lagged(1);
        let mut arms = [-0.5 * ARM_SWING * apart, 0.5 * ARM_SWING * apart];
        let mut lean = LEAN * amount;
        let mut bend = [0.0; 2];
        // Off the seat: the trunk leans over the feet, the pelvis leaves
        // the seat and rises as the legs straighten.
        let risen = self.risen(t);
        let mut z = z;
        if risen < 1.0 {
            let (forward, up, flex, hands) = rising(risen);
            let seat = 0.5 * (feet[0].heel.z + feet[1].heel.z) - SEAT_BACK;
            z = mix(seat, z, forward);
            y = mix(SEAT_PELVIS, y, up);
            lean = mix(SEAT_LEAN, lean, up) + SEAT_FLEX * flex;
            arms = arms.map(|a| mix(a, SEAT_ARMS, hands));
            bend = [SEAT_BEND * hands; 2];
        }
        Pose {
            pelvis: v3(x, y, z),
            yaw,
            roll: -DIP * (feet[0].swing - feet[1].swing),
            lean,
            feet,
            arms,
            bend,
            amount,
            risen,
            breath,
            turn: 0.0,
            nod: 0.0,
            hands: [[0.0; 4]; 2],
            wrists: [0.0; 2],
            carry: Carry::Nothing,
            umbrella: false,
            phone: None,
            coat: RAINCOAT,
        }
    }
}

/// A foot spends this share of a step's period in the air.
pub const SWING_SHARE: f32 = 0.76;
/// A pause this long (s) between two steps ends a bout of walking.
pub const PAUSE: f32 = 1.5;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Pose {
    pub pelvis: V3,
    pub yaw: f32,
    pub roll: f32,
    pub lean: f32,
    pub feet: [Foot; 2],
    /// Each arm's swing forward, radians, and how much more its elbow bends.
    pub arms: [f32; 2],
    pub bend: [f32; 2],
    pub amount: f32,
    /// 0 seated … 1 standing.
    pub risen: f32,
    pub breath: f32,
    /// How far the upper body turns to the left (radians at the head; the
    /// chest and the pelvis take less of it) and the head nods forward.
    pub turn: f32,
    pub nod: f32,
    /// Each hand reaching for a point: its wrist's target and how much it
    /// reaches (0 the arm hangs as the walk swings it … 1 there), and how
    /// far the hand bends down at the wrist (radians).
    pub hands: [[f32; 4]; 2],
    pub wrists: [f32; 2],
    pub carry: Carry,
    /// His open umbrella in the left hand.
    pub umbrella: bool,
    /// His own phone in the left hand (page 08).
    pub phone: Option<Held>,
    pub coat: Coat,
}

/// What it wears: how far the coat's skirts reach down from the waist
/// (metres) and how much fuller than the walker's raincoat it is.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Coat {
    pub length: f32,
    pub bulk: f32,
}
pub const RAINCOAT: Coat = Coat {
    length: 0.6,
    bulk: 0.0,
};

/// A body part's own left, up and forward.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Axes {
    pub left: V3,
    pub up: V3,
    pub forward: V3,
}

/// Turned `yaw` toward the left, leaning `lean` forward, rolled `roll`
/// with the left side up.
pub fn axes(yaw: f32, lean: f32, roll: f32) -> Axes {
    let forward = v3(yaw.sin(), 0.0, yaw.cos());
    let left = v3(yaw.cos(), 0.0, -yaw.sin());
    let up = rotate(Y, left, lean);
    let forward = rotate(forward, left, lean);
    Axes {
        left: rotate(left, forward, roll),
        up: rotate(up, forward, roll),
        forward,
    }
}

/// The knee between `hip` and `ankle`, bent toward `pole`.
fn knee(hip: V3, ankle: V3, pole: V3) -> V3 {
    let d = ankle - hip;
    let len = d
        .length()
        .clamp(THIGH - SHIN + 0.02, (THIGH + SHIN) * 0.9995);
    let dir = d.normalize();
    let a = (len * len + THIGH * THIGH - SHIN * SHIN) / (2.0 * len);
    let h = (THIGH * THIGH - a * a).max(0.0).sqrt();
    let side = (pole - dir * pole.dot(dir)).normalize();
    hip + dir * a + side * h
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Body {
    /// Per cone: (end A, its radius), (end B, its radius), (squash axis,
    /// how much of its width it keeps along it; below zero, flat-ended);
    /// every figure's `PRIMITIVES`, then his `OWN`.
    pub cones: [[f32; 4]; ALL * 3],
    /// Whether any of the `OWN` parts is there.
    pub own: bool,
    pub pelvis: V3,
    pub pelvic: Axes,
    pub chest: V3,
    pub chest_axes: Axes,
    pub head: V3,
    /// Where its voice leaves the head, and which way the head faces.
    pub mouth: V3,
    pub face: Axes,
    /// A phone's screen: its centre and the way it faces (zero: none).
    pub screen: [V3; 2],
    /// His own phone (page 08): its centre, its right as he sees it and its
    /// length's way up, and how far it has grown (0: none).
    pub phone: [V3; 3],
    pub phone_size: f32,
    /// The box around every cone and his phone.
    pub low: V3,
    pub high: V3,
}

impl Body {
    /// The body with every point taken through `point`, every direction
    /// through `axis` and every radius scaled by `k`; the box follows.
    fn mapped(&self, point: impl Fn(V3) -> V3, axis: impl Fn(V3) -> V3, k: f32) -> Body {
        let mut body = *self;
        let (mut low, mut high) = (v3(1e9, 1e9, 1e9), v3(-1e9, -1e9, -1e9));
        for c in 0..ALL {
            let mut r = 0.0f32;
            for j in 0..2 {
                let [x, y, z, w] = body.cones[3 * c + j];
                let p = point(v3(x, y, z));
                body.cones[3 * c + j] = [p.x, p.y, p.z, w * k];
                r = r.max(w * k);
            }
            let [x, y, z, keep] = body.cones[3 * c + 2];
            let s = axis(v3(x, y, z));
            body.cones[3 * c + 2] = [s.x, s.y, s.z, keep];
            if r <= 0.002 * k {
                // An empty slot inside the pelvis: not in the box.
                continue;
            }
            let pad = v3(r, r, r);
            for j in 0..2 {
                let [x, y, z, _] = body.cones[3 * c + j];
                low = low.min(v3(x, y, z) - pad);
                high = high.max(v3(x, y, z) + pad);
            }
        }
        let turn = |a: Axes| Axes {
            left: axis(a.left),
            up: axis(a.up),
            forward: axis(a.forward),
        };
        body.pelvis = point(body.pelvis);
        body.pelvic = turn(body.pelvic);
        body.chest = point(body.chest);
        body.chest_axes = turn(body.chest_axes);
        body.head = point(body.head);
        body.mouth = point(body.mouth);
        body.face = turn(body.face);
        body.screen = [point(body.screen[0]), axis(body.screen[1])];
        let [c, x, up] = body.phone;
        body.phone = [point(c), axis(x), axis(up)];
        body.phone_size *= k;
        for corner in body.phone_corners() {
            low = low.min(corner);
            high = high.max(corner);
        }
        (body.low, body.high) = (low, high);
        body
    }

    /// His phone's eight corners (none when it has not grown).
    fn phone_corners(&self) -> Vec<V3> {
        if self.phone_size <= 0.0 {
            return Vec::new();
        }
        let [c, x, up] = self.phone;
        let facing = x.cross(up);
        let [w, l, t] = PHONE_SIZE.map(|h| h * self.phone_size);
        let mut corners = Vec::with_capacity(8);
        for i in 0..8 {
            let s = |bit: usize| if i >> bit & 1 == 0 { -1.0 } else { 1.0 };
            corners.push(c + x * (w * s(0)) + up * (l * s(1)) + facing * (t * s(2)));
        }
        corners
    }

    /// The body with each of its points moved by `by` of where it is: the
    /// cones' ends, its centres and its box; the axes stay.
    pub fn moved(&self, by: impl Fn(V3) -> V3) -> Body {
        self.mapped(|p| p + by(p), |a| a, 1.0)
    }

    /// The body turned `angle` about the upright through the origin (to the
    /// left, as `axes` turns), then set down at `at`.
    pub fn turned(&self, angle: f32, at: V3) -> Body {
        self.mapped(|p| rotate(p, Y, angle) + at, |a| rotate(a, Y, angle), 1.0)
    }

    /// The body grown by `k` about the origin: a walk built `1/k` as long
    /// keeps its feet where they land.
    pub fn scaled(&self, k: f32) -> Body {
        self.mapped(|p| p * k, |a| a, k)
    }
}

pub fn build(pose: &Pose) -> Body {
    let mut cones = [[0.0; 4]; ALL * 3];
    let (mut low, mut high) = (v3(1e9, 1e9, 1e9), v3(-1e9, -1e9, -1e9));
    let mut n = 0;
    // Lays the next cone and says how many there are; a radius of zero
    // parks an empty slot, tiny and out of the box.
    let mut cone = |a: V3, ra: f32, b: V3, rb: f32, squash: Option<(V3, f32)>| {
        let (axis, keep) = squash.unwrap_or((Y, 1.0));
        let empty = ra <= 0.0;
        let (ra, rb) = if empty { (0.001, 0.001) } else { (ra, rb) };
        cones[3 * n] = [a.x, a.y, a.z, ra];
        cones[3 * n + 1] = [b.x, b.y, b.z, rb];
        cones[3 * n + 2] = [axis.x, axis.y, axis.z, keep];
        n += 1;
        if !empty {
            let r = ra.max(rb);
            let pad = v3(r, r, r);
            low = low.min(a - pad).min(b - pad);
            high = high.max(a + pad).max(b + pad);
        }
        n
    };
    // Flat-ended, squashed along `axis` to `keep` of its width.
    let cut = |axis: V3, keep: f32| Some((axis, -keep));
    let b = pose.breath;
    let p = pose.pelvis;
    let bulk = pose.coat.bulk;
    let pelvic = axes(pose.yaw + PELVIS_TURN * pose.turn, pose.lean, pose.roll);
    let waist = p + pelvic.up * 0.15;
    let ch = axes(
        -0.55 * pose.yaw + CHEST_TURN * pose.turn,
        pose.lean + 0.02 * pose.amount - 0.012 * b,
        -0.5 * pose.roll,
    );
    let chest = waist + ch.up * 0.2;
    let neck = chest + ch.up * 0.16;
    let head_base = neck + (ch.up + Y * 2.0).normalize() * 0.1;
    let hd = axes(0.2 * pose.yaw + pose.turn, pose.nod, 0.0);
    let jaw = head_base + hd.up * 0.025 + hd.forward * 0.025;
    let crown = head_base + hd.up * 0.105 - hd.forward * 0.005;
    let sides = [1.0f32, -1.0];
    let hips = sides.map(|s| p + pelvic.left * (HIP * s));
    let knees = [0, 1].map(|i| {
        knee(
            hips[i],
            pose.feet[i].ankle,
            pelvic.forward + pelvic.left * (0.12 * sides[i]),
        )
    });
    // The coat's skirts: a flared tube over each thigh from the waist,
    // following it a little and cut square at the hem; the two melt into
    // one coat that opens as he strides.
    for i in 0..2 {
        let top = p + pelvic.left * (0.06 * sides[i]) + pelvic.up * 0.12;
        let thigh = (knees[i] - hips[i]).normalize();
        let way = (thigh * 0.65 - Y * 0.35).normalize();
        let flare = 0.04 * (pose.coat.length / RAINCOAT.length).min(1.2);
        cone(
            top,
            0.115 + bulk,
            top + way * pose.coat.length,
            0.115 + flare + bulk,
            cut(pelvic.left, 0.85),
        );
    }
    cone(
        waist,
        0.125 + bulk,
        chest + ch.up * 0.05,
        0.14 * (1.0 + 0.025 * b) + bulk,
        Some((ch.forward, 0.66)),
    );
    let shoulder_line = chest + ch.up * (0.13 + 0.005 * b);
    cone(
        shoulder_line + ch.left * (SHOULDER - 0.01),
        0.064 + 0.6 * bulk,
        shoulder_line - ch.left * (SHOULDER - 0.01),
        0.064 + 0.6 * bulk,
        None,
    );
    cone(neck, 0.05, head_base, 0.047, None);
    cone(jaw, 0.068, crown, 0.09, Some((hd.left, 0.84)));
    // The raised collar, higher at the back.
    cone(
        neck - ch.up * 0.05,
        0.08 + 0.5 * bulk,
        neck + ch.up * 0.045 - ch.forward * 0.02,
        0.072 + 0.5 * bulk,
        cut(ch.left, 1.0),
    );
    for (hip, knee) in hips.iter().zip(&knees) {
        cone(*hip, 0.08, *knee, 0.05, None);
    }
    for (knee, foot) in knees.iter().zip(&pose.feet) {
        cone(*knee, 0.048, foot.ankle, 0.032, None);
    }
    for f in &pose.feet {
        cone(f.heel, 0.035, f.ball, 0.03, None);
    }
    for f in &pose.feet {
        cone(f.ball, 0.028, f.toe, 0.022, None);
    }
    let eyes = jaw + hd.up * 0.06 + hd.forward * 0.05;
    let mouth = jaw + hd.forward * 0.06 - hd.up * 0.015;
    // His own phone (page 08): the left wrist goes into the pocket, then
    // where the phone in its palm is held before him.
    let mut targets = pose.hands;
    if let Some(held) = pose.phone {
        let pocket = p + pelvic.left * 0.17 + pelvic.forward * 0.06 - Y * 0.05;
        let chest_at = chest + ch.forward * 0.27 + ch.left * 0.05 - Y * 0.08;
        let read = eyes + ch.forward * 0.25 - Y * 0.19;
        let under_mouth = mouth + ch.forward * 0.13 - Y * 0.09;
        let before = if held.hold <= 1.0 {
            chest_at.lerp(read, held.hold)
        } else {
            read.lerp(under_mouth, held.hold - 1.0)
        };
        let facing = (eyes - before).normalize();
        let up = (Y - facing * Y.dot(facing)).normalize();
        let wrist =
            before - up * PHONE_WRIST[1] - up.cross(facing) * PHONE_WRIST[0] - facing * 0.012;
        let at = pocket.lerp(wrist, held.raise);
        targets[0] = [at.x, at.y, at.z, held.reach];
    }
    let arms = [0, 1].map(|i| {
        let s = sides[i];
        let shoulder = shoulder_line + ch.left * (SHOULDER * s);
        let hang = rotate(-ch.up, ch.forward, ABDUCT * s);
        let upper = rotate(hang, ch.left, -pose.arms[i]);
        let across = upper.cross(ch.forward).normalize();
        let bend = 0.22 + 0.3 * pose.arms[i].max(0.0) / 0.28 + 0.03 * b + pose.bend[i];
        let lower = rotate(rotate(upper, across, bend), ch.forward, -ADDUCT * s);
        let [tx, ty, tz, reach] = targets[i];
        let (upper, lower, across) = if reach > 0.0 {
            // The wrist reaches for its target, the elbow out and down.
            let d = v3(tx, ty, tz) - shoulder;
            let dir = d.normalize();
            let len = d.length().clamp(0.1, (UPPER_ARM + FOREARM) * 0.998);
            let a = (len * len + UPPER_ARM * UPPER_ARM - FOREARM * FOREARM) / (2.0 * len);
            let h = (UPPER_ARM * UPPER_ARM - a * a).max(0.0).sqrt();
            let pole = ch.left * (0.7 * s) - ch.up - ch.forward * 0.3;
            let out = (pole - dir * pole.dot(dir)).normalize();
            let elbow = dir * a + out * h;
            let up = (upper * (1.0 - reach) + elbow.normalize() * reach).normalize();
            let wrist = dir * len - elbow;
            let low = (lower * (1.0 - reach) + wrist.normalize() * reach).normalize();
            (up, low, up.cross(ch.forward).normalize())
        } else {
            (upper, lower, across)
        };
        let elbow = shoulder + upper * UPPER_ARM;
        let wrist = elbow + lower * FOREARM;
        let hand = rotate(lower, across, 0.1 - pose.wrists[i]);
        let palm = (ch.left - hand * ch.left.dot(hand)).normalize();
        (shoulder, elbow, wrist, wrist + hand * HAND, palm)
    });
    let sleeve = 0.6 * bulk;
    for a in &arms {
        cone(a.0, 0.056 + sleeve, a.1, 0.047 + sleeve, None);
    }
    // Sleeves cut square at the cuff, the hand out of it.
    for a in &arms {
        cone(a.1, 0.044 + sleeve, a.2, 0.041 + sleeve, cut(Y, 1.0));
    }
    // What each hand holds shapes it: open, a fist round a handle, or flat
    // under a phone it holds up to the eyes.
    let mut hands = arms.map(|a| Grip::open(a.2, (a.3 - a.2).normalize(), a.4));
    // The right hand's umbrella (a passer's) or phone.
    let mut props: Vec<Part> = Vec::new();
    let mut screen = [v3(0.0, 0.0, 0.0); 2];
    let mut own: [Option<Part>; OWN] = [None; OWN];
    match pose.carry {
        Carry::Nothing => {}
        Carry::Umbrella => {
            let top = crown + Y * 0.33 + ch.forward * 0.05 - ch.left * 0.04;
            let g = Grip::fist(&hands[1], top);
            let stick = (top - g.centre()).normalize();
            props.push(Part::plain(g.centre() - stick * 0.1, 0.009, top, 0.007));
            props.push(Part {
                a: top - stick * 0.2,
                ra: 0.5,
                b: top + stick * 0.02,
                rb: 0.025,
                squash: cut(Y, 1.0),
            });
            hands[1] = g;
        }
        Carry::Phone | Carry::Screen(_) => {
            let out = match pose.carry {
                Carry::Screen(out) => smooth(0.0, 1.0, out),
                _ => 1.0,
            };
            // The palm turns to face the eyes and the phone lies on it, its
            // back on the palm, the thumb over its edge.
            let open = hands[1];
            let facing = (eyes - open.wrist - open.dir * 0.06).normalize();
            let g = Grip::flat(&open, facing);
            let thumb = g.dir.cross(facing).normalize();
            let upright = (Y - facing * Y.dot(facing)).normalize();
            let long = (upright * 0.6 + g.dir * 0.4).normalize();
            let half = PHONE_HALF * out;
            let at = g.wrist + g.dir * 0.062 + facing * (g.half_thickness() + half + 0.0015)
                - thumb * 0.014;
            if out > 0.02 {
                props.push(Part {
                    a: at - long * (0.07 * out),
                    ra: 0.036 * out,
                    b: at + long * (0.07 * out),
                    rb: 0.036 * out,
                    squash: cut(facing, PHONE_KEEP),
                });
                screen = [at + facing * (half + 0.0005), facing];
            }
            own[0] = Some(Part::plain(
                g.wrist + g.dir * 0.03 + thumb * 0.034 + facing * 0.004,
                0.0115,
                at + thumb * (0.036 * out - 0.017) + long * 0.012 + facing * (half + 0.0085),
                0.0088,
            ));
            hands[1] = g;
        }
    }
    if pose.carry == Carry::Phone {
        // The hood up round the head, the face out of its front.
        let mid = jaw.lerp(crown, 0.5) + hd.up * 0.025;
        props.push(Part {
            a: mid - hd.forward * 0.075,
            ra: 0.13,
            b: mid + hd.forward * 0.04,
            rb: 0.125,
            squash: cut(hd.left, 0.84),
        });
    }
    // His umbrella in the left hand: the fist round its handle, the shaft
    // up through the canopy over his head.
    if pose.umbrella {
        let crown_at = crown + Y * CANOPY_UP + ch.forward * CANOPY_AHEAD + ch.left * CANOPY_LEFT;
        let g = Grip::fist(&hands[0], crown_at);
        let centre = g.centre();
        let shaft = (crown_at - centre).normalize();
        let mut side = shaft.cross(g.dir).normalize();
        if side.dot(ch.left) > 0.0 {
            side = -side;
        }
        own[1] = Some(Part::plain(
            g.wrist + g.dir * 0.02 + shaft * 0.02 + side * 0.02,
            0.0118,
            g.wrist + g.dir * 0.055 + shaft * 0.024 + side * 0.026,
            0.0088,
        ));
        own[2] = Some(Part::plain(
            centre - shaft * 0.08,
            0.0158,
            centre + shaft * 0.06,
            0.0142,
        ));
        own[3] = Some(Part::plain(
            centre + shaft * 0.06,
            0.0056,
            crown_at + shaft * 0.05,
            0.0042,
        ));
        own[4] = Some(Part {
            a: crown_at,
            ra: CANOPY_R,
            b: crown_at - shaft * CANOPY_DEPTH,
            rb: CANOPY_CLOTH,
            squash: Some((shaft, 1.0)),
        });
        hands[0] = g;
    }
    // His own phone on the left palm, its screen to his eyes: the thumb
    // over the glass, two fingers round its right edge.
    let mut phone = [v3(0.0, 0.0, 0.0); 3];
    let mut phone_size = 0.0;
    if let Some(held) = pose.phone.filter(|h| h.out > 0.0) {
        let k = held.out;
        let wrist = hands[0].wrist;
        let mut facing = (eyes - wrist).normalize();
        let mut up = Y;
        for _ in 0..2 {
            up = (Y - facing * Y.dot(facing)).normalize();
            facing = (eyes - (wrist + up * PHONE_WRIST[1])).normalize();
        }
        let x = up.cross(facing);
        let [hw, _, ht] = PHONE_SIZE.map(|h| h * k);
        let g = Grip {
            wrist,
            dir: (x * 0.055 + up * 0.08).normalize(),
            palm: facing,
            length: 0.1,
            radii: [0.028, 0.021],
            keep: 0.5,
        };
        let centre = wrist
            + x * PHONE_WRIST[0]
            + up * PHONE_WRIST[1]
            + facing * (g.half_thickness() + ht + 0.0012);
        let w = smooth(0.0, 0.4, k);
        let open = hands[0];
        hands[0] = Grip {
            wrist,
            dir: open.dir.lerp(g.dir, w).normalize(),
            palm: open.palm.lerp(g.palm, w).normalize(),
            length: mix(open.length, g.length, w),
            radii: [
                mix(open.radii[0], g.radii[0], w),
                mix(open.radii[1], g.radii[1], w),
            ],
            keep: mix(open.keep, g.keep, w),
        };
        let [u, v, press] = held.thumb;
        let base = centre - x * (hw + 0.006) - up * 0.05 - facing * 0.002;
        let tip = centre
            + x * ((u - 0.5) * 2.0 * PHONE_SCREEN[0] * k)
            + up * ((0.5 - v) * 2.0 * PHONE_SCREEN[1] * k)
            + facing * (ht + 0.0082 + 0.012 * (1.0 - press));
        let knuckle = base.lerp(tip, 0.55) + facing * (0.01 + 0.005 * (1.0 - press));
        own[0] = Some(Part::plain(knuckle, 0.009, tip, 0.0078));
        own[1] = Some(Part::plain(base, 0.011, knuckle, 0.0093));
        for (i, along) in [0.0f32, -0.024].into_iter().enumerate() {
            own[2 + i] = Some(Part::plain(
                centre + x * (hw - 0.01) + up * along - facing * (ht + 0.006),
                0.0095,
                centre + x * (hw + 0.0035) + up * (along + 0.004) - facing * (ht * 0.2),
                0.008,
            ));
        }
        phone = [centre, x, up];
        phone_size = k;
    }
    let mut laid = 0;
    for g in &hands {
        laid = cone(
            g.wrist,
            g.radii[0],
            g.wrist + g.dir * g.length,
            g.radii[1],
            Some((g.palm, g.keep)),
        );
    }
    for part in &props {
        laid = cone(part.a, part.ra, part.b, part.rb, part.squash);
    }
    // The rest stand empty inside the pelvis, out of the box.
    let parked = Part::plain(p, 0.0, p + Y * 0.01, 0.0);
    while laid < PRIMITIVES {
        laid = cone(parked.a, 0.0, parked.b, 0.0, None);
    }
    for part in own.iter().map(|part| part.unwrap_or(parked)) {
        cone(part.a, part.ra, part.b, part.rb, part.squash);
    }
    let mut body = Body {
        cones,
        own: own.iter().any(Option::is_some),
        pelvis: p,
        pelvic,
        chest,
        chest_axes: ch,
        head: crown,
        mouth,
        face: hd,
        screen,
        phone,
        phone_size,
        low,
        high,
    };
    for corner in body.phone_corners() {
        body.low = body.low.min(corner);
        body.high = body.high.max(corner);
    }
    body
}

#[cfg(test)]
mod tests {
    use super::*;

    fn walk() -> Walk {
        Walk::steady(0.55, 0.62, 0.06, -12, 64, 4.4)
    }

    fn lowest(f: &Foot) -> f32 {
        (f.heel.y - 0.035).min(f.ball.y - 0.03).min(f.toe.y - 0.022)
    }

    #[test]
    fn the_feet_never_sink_and_clear_the_ground_in_the_air() {
        let w = walk();
        for i in 0..2000 {
            let t = i as f32 * 0.005;
            for side in 0..2 {
                let f = w.foot(side, t);
                assert!(lowest(&f) > -1e-3, "{side} at {t}: {}", lowest(&f));
                if f.swing > 0.5 {
                    assert!(lowest(&f) > 0.02, "{side} drags at {t}");
                }
            }
        }
    }

    #[test]
    fn the_feet_move_smoothly() {
        let w = walk();
        let mut previous = [w.foot(0, 0.0), w.foot(1, 0.0)];
        for i in 1..1200 {
            let t = i as f32 / 120.0;
            for (side, last) in previous.iter_mut().enumerate() {
                let f = w.foot(side, t);
                for (a, b) in [(f.heel, last.heel), (f.toe, last.toe)] {
                    assert!((a - b).length() < 0.06, "{side} at {t}");
                }
                *last = f;
            }
        }
    }

    #[test]
    fn the_legs_reach_the_standing_feet() {
        let w = walk();
        for i in 0..800 {
            let t = i as f32 * 0.01;
            let pose = w.pose(t, 0.5);
            let body = build(&pose);
            let hips = [1.0f32, -1.0].map(|s| pose.pelvis + body.pelvic.left * (HIP * s));
            for (side, (f, hip)) in pose.feet.iter().zip(&hips).enumerate() {
                let gap = (f.ankle - *hip).length() - (THIGH + SHIN);
                if f.support > 0.99 {
                    assert!(gap < 0.004, "{side} at {t}: {gap}");
                }
            }
            assert!((0.85..0.93).contains(&pose.pelvis.y), "{t}");
        }
    }

    #[test]
    fn the_figure_stands_its_height() {
        let w = Walk::new(
            [[0.085, 0.0], [-0.085, 0.0]],
            vec![Step {
                side: 0,
                lift: 10.0,
                land: 10.45,
                x: 0.085,
                z: 0.0,
            }],
            7.0,
        );
        let body = build(&w.pose(1.0, 0.5));
        assert!((1.68..1.76).contains(&body.high.y), "{}", body.high.y);
        assert!(body.low.y > -0.01 && body.low.y < 0.01, "{}", body.low.y);
        // Shoulders a little narrower than a quarter of the height.
        let width = body.high.x - body.low.x;
        assert!((0.42..0.6).contains(&width), "{width}");
    }

    /// Seated, it rises over 2..5.8 s, sits again over 8..12.2 s and takes
    /// one step afterwards.
    fn seated() -> Walk {
        let step = Step {
            side: 0,
            lift: 20.0,
            land: 20.45,
            x: 0.11,
            z: 0.0,
        };
        let rest = |from, to, up| Rest { from, to, up };
        Walk::new([[0.11, 0.0], [-0.11, 0.0]], vec![step], 7.0)
            .with_rests(vec![rest(2.0, 5.8, true), rest(8.0, 12.2, false)])
    }

    #[test]
    fn it_sits_rises_and_sits_down_again() {
        let w = seated();
        let mut previous = w.pose(0.0, 0.5);
        let mut lean = 0.0f32;
        for i in 1..1500 {
            let t = i as f32 * 0.01;
            let pose = w.pose(t, 0.5);
            let body = build(&pose);
            // The feet stay planted and the legs reach them, seated or not.
            for f in &pose.feet {
                assert!(lowest(f) > -1e-3 && lowest(f) < 0.01, "{t}");
            }
            let hips = [1.0f32, -1.0].map(|s| pose.pelvis + body.pelvic.left * (HIP * s));
            for (f, hip) in pose.feet.iter().zip(&hips) {
                assert!((f.ankle - *hip).length() < THIGH + SHIN, "{t}");
            }
            let moved = (pose.pelvis - previous.pelvis).length();
            assert!(moved < 0.01, "{t}: {moved}");
            lean = lean.max(pose.lean);
            previous = pose;
        }
        // It rises leaning forward over its feet.
        assert!(lean > 0.45, "{lean}");
        for t in [1.0, 13.0] {
            let pose = w.pose(t, 0.5);
            let body = build(&pose);
            assert_eq!(w.risen(t), 0.0, "{t}");
            assert!((pose.pelvis.y - SEAT_PELVIS).abs() < 1e-4, "{t}");
            assert!((pose.pelvis.z + SEAT_BACK).abs() < 1e-3, "{t}");
            assert!((1.2..1.4).contains(&body.high.y), "{t}: {}", body.high.y);
        }
        let standing = build(&w.pose(7.0, 0.5));
        assert_eq!(w.risen(7.0), 1.0);
        assert!(standing.high.y > 1.68, "{}", standing.high.y);
    }

    #[test]
    fn the_steady_walk_repeats_one_stride_later() {
        let w = walk();
        let (a, b) = (w.pose(2.0, 0.5), w.pose(2.0 + 1.1, 0.5));
        assert!((b.pelvis.z - a.pelvis.z - 1.24).abs() < 1e-3);
        assert!((b.pelvis.y - a.pelvis.y).abs() < 1e-4);
        assert!((b.feet[0].toe.y - a.feet[0].toe.y).abs() < 1e-4);
    }
}
