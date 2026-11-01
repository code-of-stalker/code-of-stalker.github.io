//! The figure: footsteps make a walk, the walk a pose, and the pose 19
//! rounded cones that the body shader blends into one surface of light.
//! Metres; the figure faces +z, its left is +x, up is +y.
use crate::math::{min_jerk, mix, monotone, rotate, smooth, softmin, v3, V3, Y};
use std::f32::consts::{PI, TAU};

pub const PRIMITIVES: usize = 19;
/// How softly each cone melts into the ones before it, metres.
pub const BLEND: [f32; PRIMITIVES] = [
    0.0, 0.07, 0.06, 0.04, 0.03, // pelvis, torso, shoulders, neck, head
    0.05, 0.05, 0.03, 0.03, // thighs, shins
    0.025, 0.025, 0.012, 0.012, // feet, toes
    0.03, 0.03, 0.012, 0.012, 0.012, 0.012, // upper arms, forearms, hands
];

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

/// The foot standing at (`x`, `z`), `since` seconds after it landed and
/// `until` seconds before it lifts: rocking flat off its heel, then up onto
/// its ball.
fn standing(x: f32, z: f32, yaw: f32, since: f32, until: f32) -> Foot {
    let flat = v3(yaw.sin(), 0.0, yaw.cos());
    let ground = v3(x, 0.0, z);
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
}

impl Walk {
    /// `steps` in time order, left foot 0, right foot 1; the first lifts the
    /// foot that does not carry the weight, the last brings a foot to rest.
    pub fn new(start: [[f32; 2]; 2], steps: Vec<Step>, sway: f32) -> Walk {
        let mut feet = [Vec::new(), Vec::new()];
        for s in &steps {
            feet[s.side].push(*s);
        }
        let first = steps[0];
        let last = steps[steps.len() - 1];
        let mean = |w: [[f32; 2]; 2], i: usize| 0.5 * (w[0][i] + w[1][i]);
        let mut place = start;
        let mut pelvis_z = vec![(first.lift - 0.15, mean(start, 1) + AHEAD)];
        let mut pelvis_x = vec![
            (first.lift - 0.6, mean(start, 0)),
            (first.lift - 0.02, SHIFT * start[1 - first.side][0]),
        ];
        for (i, s) in steps.iter().enumerate() {
            place[s.side] = [s.x, s.z];
            if i + 1 == steps.len() {
                pelvis_z.push((s.land + 0.3, mean(place, 1) + AHEAD));
                pelvis_x.push((s.land + 0.45, mean(place, 0)));
            } else {
                pelvis_z.push((s.land, mean(place, 1) + AHEAD));
                pelvis_x.push((s.land + 0.25, SWAY * s.x));
            }
        }
        let before_last = steps[steps.len().saturating_sub(2)];
        Walk {
            amount: vec![
                (first.lift - 0.5, 0.0),
                (first.land, 1.0),
                (before_last.land, 1.0),
                (last.land + 0.3, 0.0),
            ],
            steps,
            feet,
            start,
            pelvis_z,
            pelvis_x,
            sway,
        }
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
        monotone(&self.pelvis_z, t)
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
        if begun == 0 {
            let [x, z] = place(0);
            return standing(x, z, yaw, f32::INFINITY, next_lift(0));
        }
        let p = plants[begun - 1];
        if t >= p.land {
            return standing(p.x, p.z, yaw, t - p.land, next_lift(begun));
        }
        let s = ((t - p.lift) / (p.land - p.lift)).clamp(0.0, 1.0);
        let [x, z] = place(begun - 1);
        let from = standing(x, z, yaw, f32::INFINITY, 0.0);
        let to = standing(p.x, p.z, yaw, 0.0, f32::INFINITY);
        let rise = (PI * s).sin();
        let heel = from.heel.lerp(to.heel, min_jerk(s)) + Y * (CLEARANCE * rise);
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
        let mut y = mix(STAND, WALK, amount) - BOB * amount * (0.5 + 0.5 * (TAU * phase).cos());
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
        Pose {
            pelvis: v3(x, y, z),
            yaw,
            roll: -DIP * (feet[0].swing - feet[1].swing),
            lean: LEAN * amount,
            feet,
            arms: [-0.5 * ARM_SWING * apart, 0.5 * ARM_SWING * apart],
            amount,
            breath,
        }
    }
}

/// A foot spends this share of a step's period in the air.
const SWING_SHARE: f32 = 0.76;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Pose {
    pub pelvis: V3,
    pub yaw: f32,
    pub roll: f32,
    pub lean: f32,
    pub feet: [Foot; 2],
    /// Each arm's swing forward, radians.
    pub arms: [f32; 2],
    pub amount: f32,
    pub breath: f32,
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
    /// how much of its width it keeps along it).
    pub cones: [[f32; 4]; PRIMITIVES * 3],
    pub pelvis: V3,
    pub pelvic: Axes,
    pub chest: V3,
    pub chest_axes: Axes,
    pub head: V3,
    /// The box around every cone.
    pub low: V3,
    pub high: V3,
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
    let b = pose.breath;
    let p = pose.pelvis;
    let pelvic = axes(pose.yaw, pose.lean, pose.roll);
    let waist = p + pelvic.up * 0.15;
    let ch = axes(
        -0.55 * pose.yaw,
        pose.lean + 0.02 * pose.amount - 0.012 * b,
        -0.5 * pose.roll,
    );
    let chest = waist + ch.up * 0.2;
    let neck = chest + ch.up * 0.16;
    let head_base = neck + (ch.up + Y * 2.0).normalize() * 0.1;
    let hd = axes(0.2 * pose.yaw, 0.0, 0.0);
    let jaw = head_base + Y * 0.025 + hd.forward * 0.025;
    let crown = head_base + Y * 0.105 - hd.forward * 0.005;
    cone(
        p - pelvic.up * 0.02,
        0.13,
        waist,
        0.12,
        Some((pelvic.forward, 0.72)),
    );
    cone(
        waist,
        0.125,
        chest + ch.up * 0.05,
        0.14 * (1.0 + 0.025 * b),
        Some((ch.forward, 0.66)),
    );
    let shoulder_line = chest + ch.up * (0.13 + 0.005 * b);
    cone(
        shoulder_line + ch.left * SHOULDER,
        0.05,
        shoulder_line - ch.left * SHOULDER,
        0.05,
        None,
    );
    cone(neck, 0.05, head_base, 0.047, None);
    cone(jaw, 0.068, crown, 0.09, Some((hd.left, 0.84)));
    let sides = [1.0f32, -1.0];
    let hips = sides.map(|s| p + pelvic.left * (HIP * s));
    let knees = [0, 1].map(|i| {
        knee(
            hips[i],
            pose.feet[i].ankle,
            pelvic.forward + pelvic.left * (0.12 * sides[i]),
        )
    });
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
    let arms = [0, 1].map(|i| {
        let s = sides[i];
        let shoulder = shoulder_line + ch.left * (SHOULDER * s);
        let hang = rotate(-ch.up, ch.forward, ABDUCT * s);
        let upper = rotate(hang, ch.left, -pose.arms[i]);
        let elbow = shoulder + upper * UPPER_ARM;
        let across = upper.cross(ch.forward).normalize();
        let bend = 0.22 + 0.3 * pose.arms[i].max(0.0) / 0.28 + 0.03 * b;
        let lower = rotate(rotate(upper, across, bend), ch.forward, -ADDUCT * s);
        let wrist = elbow + lower * FOREARM;
        let hand = rotate(lower, across, 0.1);
        let palm = (ch.left - hand * ch.left.dot(hand)).normalize();
        (shoulder, elbow, wrist, wrist + hand * HAND, palm)
    });
    for a in &arms {
        cone(a.0, 0.047, a.1, 0.037, None);
    }
    for a in &arms {
        cone(a.1, 0.036, a.2, 0.026, None);
    }
    for a in &arms {
        cone(a.2, 0.028, a.3, 0.02, Some((a.4, 0.55)));
    }
    Body {
        cones,
        pelvis: p,
        pelvic,
        chest,
        chest_axes: ch,
        head: crown,
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

    #[test]
    fn the_steady_walk_repeats_one_stride_later() {
        let w = walk();
        let (a, b) = (w.pose(2.0, 0.5), w.pose(2.0 + 1.1, 0.5));
        assert!((b.pelvis.z - a.pelvis.z - 1.24).abs() < 1e-3);
        assert!((b.pelvis.y - a.pelvis.y).abs() < 1e-4);
        assert!((b.feet[0].toe.y - a.feet[0].toe.y).abs() < 1e-4);
    }
}
