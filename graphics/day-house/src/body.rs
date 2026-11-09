//! The figure: footsteps make a walk, the walk a pose, and the pose 32
//! cones (rounded, or flat-ended where cloth ends) that the body shader
//! blends into one surface of light. Metres; the figure faces +z, its left
//! is +x, up is +y. (From «Ночной город»; here the feet land on one line,
//! the rope, toes turned out, the swinging foot bowed round the other.)
//! He wears a close jacket, a knit cap and a long scarf whose tail the wind
//! takes; his face has a chin and a brow, so his profile reads against the
//! dawn.
use crate::math::{min_jerk, mix, monotone, rotate, smooth, softmin, v3, V3, Y};
use std::f32::consts::{PI, TAU};

pub const PRIMITIVES: usize = 32;
/// How softly each cone melts into the ones before it, metres.
pub const BLEND: [f32; PRIMITIVES] = [
    0.0, 0.07, 0.06, 0.06, // hips, belly, chest, shoulders
    0.035, 0.03, 0.02, 0.01, 0.02, // neck, skull, face, cap, the scarf round the neck
    0.05, 0.05, 0.03, 0.03, 0.02, 0.02, // thighs, calves, shins
    0.025, 0.025, 0.012, 0.012, // feet, toes
    0.045, 0.045, 0.015, 0.015, 0.012, 0.012, // upper arms, sleeves, hands
    0.012, 0.008, 0.008, 0.008, 0.008, 0.008, // the scarf's tail
    0.008, // what it carries
];
/// Cones by what they are, for the shader and the camera.
pub const NECK: usize = 4;
pub const HEAD: usize = 5;
pub const FACE: usize = 6;
pub const CAP: usize = 7;
/// The scarf round his neck: the last cone of the head and neck.
pub const COLLAR: usize = 8;
pub const FEET: [usize; 2] = [15, 16];
pub const TOES: [usize; 2] = [17, 18];
pub const HANDS: [usize; 2] = [23, 24];
pub const SCARF: usize = 25;
pub const SCARF_LINKS: usize = 6;
pub const PROP: usize = 31;
/// One link of the scarf's tail, metres.
const SCARF_LINK: f32 = 0.11;
/// A cone's squash keep below zero marks it flat-ended (cut square, its
/// edge rounded this much) instead of capped by spheres.
pub const CUT_ROUND: f32 = 0.008;

/// What a figure carries in its right hand, if anything.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum Carry {
    #[default]
    Nothing,
    /// A phone: out of the pocket this much, 0 … 1 (it grows from nothing
    /// in the hand as the hand brings it up).
    Screen(f32),
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
    /// How far the toes turn out (radians) and how far out the swinging
    /// foot bows round the standing one (metres): on a rope both feet
    /// land on one line.
    toe_out: f32,
    arc: f32,
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
            toe_out: TOE_OUT,
            arc: 0.0,
        }
    }

    /// The same walk on a line: the toes turned out `toe_out`, the
    /// swinging foot bowed `arc` out round the standing one.
    pub fn on_line(mut self, toe_out: f32, arc: f32) -> Walk {
        self.toe_out = toe_out;
        self.arc = arc;
        self
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
        let yaw = if side == 0 {
            self.toe_out
        } else {
            -self.toe_out
        };
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
        let out = v3(if side == 0 { self.arc } else { -self.arc }, 0.0, 0.0);
        let mut heel = from.heel.lerp(to.heel, min_jerk(s)) + Y * (CLEARANCE * rise) + out * rise;
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
            // Nobody in the house wears the long scarf.
            scarf: [0.0, 0.0, 0.0, -1.0],
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
    /// The wind on the scarf's tail: which way it blows (x, z in the walk's
    /// frame), the flutter's phase (cycles) and how hard, 0 it hangs … 1.
    pub scarf: [f32; 4],
}

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
    /// how much of its width it keeps along it; below zero, flat-ended).
    pub cones: [[f32; 4]; PRIMITIVES * 3],
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
    /// The box around every cone.
    pub low: V3,
    pub high: V3,
}

impl Body {
    /// The body with every point taken through `point`, every direction
    /// through `axis` and every radius scaled by `k`; the box follows.
    pub fn mapped(&self, point: impl Fn(V3) -> V3, axis: impl Fn(V3) -> V3, k: f32) -> Body {
        let mut body = *self;
        let (mut low, mut high) = (v3(1e9, 1e9, 1e9), v3(-1e9, -1e9, -1e9));
        for c in 0..PRIMITIVES {
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
        (body.low, body.high) = (low, high);
        body
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
    let mut cones = [[0.0; 4]; PRIMITIVES * 3];
    let (mut low, mut high) = (v3(1e9, 1e9, 1e9), v3(-1e9, -1e9, -1e9));
    let mut n = 0;
    let mut cone = |a: V3, ra: f32, b: V3, rb: f32, squash: Option<(V3, f32)>| {
        let (axis, keep) = squash.unwrap_or((Y, 1.0));
        cones[3 * n] = [a.x, a.y, a.z, ra];
        cones[3 * n + 1] = [b.x, b.y, b.z, rb];
        cones[3 * n + 2] = [axis.x, axis.y, axis.z, keep];
        n += 1;
        let r = ra.max(rb);
        let pad = v3(r, r, r);
        low = low.min(a - pad).min(b - pad);
        high = high.max(a + pad).max(b + pad);
    };
    // Flat-ended, squashed along `axis` to `keep` of its width.
    let cut = |axis: V3, keep: f32| Some((axis, -keep));
    let b = pose.breath;
    let p = pose.pelvis;
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
    // The trunk: hips, belly and the chest that fills with the breath.
    cone(
        hips[0] + pelvic.up * 0.03,
        0.1,
        hips[1] + pelvic.up * 0.03,
        0.1,
        Some((pelvic.forward, 0.78)),
    );
    cone(
        p + pelvic.up * 0.07,
        0.108,
        waist + ch.up * 0.08,
        0.112,
        Some((ch.forward, 0.72)),
    );
    cone(
        waist + ch.up * 0.1,
        0.122 * (1.0 + 0.03 * b),
        chest + ch.up * 0.06,
        0.132 * (1.0 + 0.03 * b),
        Some((ch.forward, 0.64 + 0.04 * b)),
    );
    let shoulder_line = chest + ch.up * (0.13 + 0.005 * b);
    cone(
        shoulder_line + ch.left * (SHOULDER - 0.01),
        0.058,
        shoulder_line - ch.left * (SHOULDER - 0.01),
        0.058,
        None,
    );
    // The head: the skull, the face's ridge from chin to brow (his profile),
    // a knit cap, and the scarf wound round the neck.
    cone(neck, 0.046, head_base, 0.043, None);
    cone(jaw, 0.066, crown, 0.088, Some((hd.left, 0.84)));
    cone(
        jaw + hd.forward * 0.045 - hd.up * 0.012,
        0.03,
        head_base + hd.up * 0.1 + hd.forward * 0.078,
        0.022,
        Some((hd.left, 0.8)),
    );
    cone(
        crown - hd.up * 0.05 - hd.forward * 0.014,
        0.093,
        crown + hd.up * 0.012 - hd.forward * 0.024,
        0.07,
        cut(hd.left, 0.88),
    );
    cone(
        neck - ch.up * 0.045,
        0.074,
        neck + ch.up * 0.035 - ch.forward * 0.012,
        0.066,
        cut(ch.forward, 0.9),
    );
    for (hip, knee) in hips.iter().zip(&knees) {
        cone(*hip, 0.078, *knee, 0.052, None);
    }
    // The calf swells a third of the way down the shin, behind it.
    let calves = [0, 1].map(|i| knees[i].lerp(pose.feet[i].ankle, 0.33) - pelvic.forward * 0.016);
    for (knee, calf) in knees.iter().zip(&calves) {
        cone(*knee, 0.047, *calf, 0.05, None);
    }
    for (calf, foot) in calves.iter().zip(&pose.feet) {
        cone(*calf, 0.048, foot.ankle, 0.03, None);
    }
    for f in &pose.feet {
        cone(f.heel, 0.035, f.ball, 0.03, None);
    }
    for f in &pose.feet {
        cone(f.ball, 0.028, f.toe, 0.022, None);
    }
    let arms = [0, 1].map(|i| {
        let s = sides[i];
        let shoulder = shoulder_line + ch.left * (SHOULDER * s);
        let hang = rotate(-ch.up, ch.forward, ABDUCT * s);
        let upper = rotate(hang, ch.left, -pose.arms[i]);
        let across = upper.cross(ch.forward).normalize();
        let bend = 0.22 + 0.3 * pose.arms[i].max(0.0) / 0.28 + 0.03 * b + pose.bend[i];
        let lower = rotate(rotate(upper, across, bend), ch.forward, -ADDUCT * s);
        let [tx, ty, tz, reach] = pose.hands[i];
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
    for a in &arms {
        cone(a.0, 0.052, a.1, 0.044, None);
    }
    // Sleeves cut square at the cuff, the hand out of it.
    for a in &arms {
        cone(a.1, 0.042, a.2, 0.036, cut(Y, 1.0));
    }
    for a in &arms {
        cone(a.2, 0.026, a.3, 0.019, Some((a.4, 0.55)));
    }
    // The scarf's tail from the back of his neck: it hangs down his back
    // in still air and streams and flutters in the wind, a flat ribbon
    // twisting as it goes.
    let [wx, wz, phase, strength] = pose.scarf;
    if strength < 0.0 {
        // No scarf: its links stand empty inside the pelvis.
        for _ in 0..SCARF_LINKS {
            cone(p, 0.001, p + Y * 0.01, 0.001, None);
        }
    }
    let wind = v3(wx, 0.0, wz);
    let wind = if wind.length() > 1e-4 {
        wind.normalize()
    } else {
        -ch.forward
    };
    let across = wind.cross(Y).normalize();
    let mut at = neck + ch.up * 0.01 - ch.forward * 0.07 + ch.left * 0.03;
    for k in 0..SCARF_LINKS * usize::from(strength >= 0.0) {
        let kf = k as f32;
        let s = strength * (0.4 + 0.12 * kf).min(1.0);
        let wave = TAU * phase - 1.1 * kf;
        let flutter = wave.sin() * (0.08 + 0.07 * kf) * strength;
        let lift = (1.3 * wave + 1.0).sin() * 0.05 * kf * strength;
        let hang = (-Y - ch.forward * 0.3).normalize();
        let d = (hang * (1.0 - s) + wind * s + across * flutter + Y * lift).normalize();
        let next = at + d * SCARF_LINK;
        let flat = rotate(across, d, 0.6 * wave.cos() * strength);
        let r = mix(0.034, 0.025, kf / 5.0);
        cone(at, r, next, 0.95 * r, Some((flat, 0.3)));
        at = next;
    }
    // What the right hand carries.
    let (_, _, wrist, tip, palm) = arms[1];
    let grip = wrist.lerp(tip, 0.5);
    let mut screen = [v3(0.0, 0.0, 0.0); 2];
    if let Carry::Screen(out) = pose.carry {
        let out = smooth(0.0, 1.0, out);
        let eyes = jaw + hd.up * 0.06 + hd.forward * 0.05;
        let at = grip + palm * 0.012;
        let facing = (eyes - at).normalize();
        let long = (Y - facing * Y.dot(facing)).normalize();
        if out > 0.02 {
            cone(
                at - long * (0.07 * out),
                0.036 * out,
                at + long * (0.07 * out),
                0.036 * out,
                cut(facing, 0.13),
            );
            screen = [at + facing * 0.005, facing];
        }
    }
    // The rest stand empty inside the pelvis, out of the box.
    while n < PRIMITIVES {
        cones[3 * n] = [p.x, p.y, p.z, 0.001];
        cones[3 * n + 1] = [p.x, p.y + 0.01, p.z, 0.001];
        cones[3 * n + 2] = [0.0, 1.0, 0.0, 1.0];
        n += 1;
    }
    Body {
        cones,
        pelvis: p,
        pelvic,
        chest,
        chest_axes: ch,
        head: crown,
        mouth: jaw + hd.forward * 0.06 - hd.up * 0.015,
        face: hd,
        screen,
        low,
        high,
    }
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
