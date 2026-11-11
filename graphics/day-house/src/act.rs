//! How a figure goes through the house: along rounded paths (a walk, a run,
//! a stair) or on one spot (standing, turning on his feet, sitting down and
//! getting up, riding the lift or the tram). A `Plan` strings these acts
//! one after another; the lift's and the tram's timetables are written by
//! the hero's plan as he rides them.
use crate::body::{build, Body, Pose, Rest, Step, Walk, SWING_SHARE};
use crate::math::{min_jerk, mix, monotone, rotate, smooth, v3, V3, Y};
use std::f32::consts::{FRAC_PI_2, PI, TAU};

/// The ground's height over a floor at (x, z): a kerb, the tram's floor.
pub type Ground = fn(f32, f32) -> f32;

pub fn flat(_: f32, _: f32) -> f32 {
    0.0
}

fn level(_: f32) -> f32 {
    0.0
}

/// The feet stand this far either side of the line they walk.
pub const FOOT_X: f32 = 0.09;

fn foot_x(side: usize) -> f32 {
    if side == 0 {
        FOOT_X
    } else {
        -FOOT_X
    }
}

/// The shortest turn from `from` to `to`, radians.
pub fn turn_between(from: f32, to: f32) -> f32 {
    (to - from + PI).rem_euclid(TAU) - PI
}

fn lerp2(a: [f32; 2], b: [f32; 2], s: f32) -> [f32; 2] {
    [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]
}

fn dist(a: [f32; 2], b: [f32; 2]) -> f32 {
    ((b[0] - a[0]).powi(2) + (b[1] - a[1]).powi(2)).sqrt()
}

/// A way over the floor (x, z) through corners, each rounded.
#[derive(Clone, Debug)]
pub struct Path {
    pts: Vec<[f32; 2]>,
    along: Vec<f32>,
}

impl Path {
    pub fn new(corners: &[[f32; 2]]) -> Path {
        assert!(corners.len() >= 2, "a path needs two ends");
        let mut pts = vec![corners[0]];
        for i in 1..corners.len() - 1 {
            let (a, b, c) = (corners[i - 1], corners[i], corners[i + 1]);
            let (l0, l1) = (dist(a, b), dist(b, c));
            let r = (0.45 * l0.min(l1)).min(0.45);
            let p0 = lerp2(b, a, r / l0.max(1e-6));
            let p2 = lerp2(b, c, r / l1.max(1e-6));
            for k in 0..=8 {
                let s = k as f32 / 8.0;
                pts.push(lerp2(lerp2(p0, b, s), lerp2(b, p2, s), s));
            }
        }
        pts.push(corners[corners.len() - 1]);
        pts.dedup_by(|a, b| dist(*a, *b) < 1e-4);
        let mut along = vec![0.0];
        for w in pts.windows(2) {
            along.push(along[along.len() - 1] + dist(w[0], w[1]));
        }
        Path { pts, along }
    }

    pub fn length(&self) -> f32 {
        self.along[self.along.len() - 1]
    }

    /// The point `s` metres along; straight on past either end.
    pub fn at(&self, s: f32) -> [f32; 2] {
        let n = self.pts.len();
        let i = self.along.partition_point(|&a| a <= s).clamp(1, n - 1);
        let (sa, sb) = (self.along[i - 1], self.along[i]);
        lerp2(self.pts[i - 1], self.pts[i], (s - sa) / (sb - sa))
    }

    /// Which way the path heads `s` metres along (0 toward +z, π/2 +x).
    pub fn heading(&self, s: f32) -> f32 {
        let (a, b) = (self.at(s - 0.06), self.at(s + 0.06));
        (b[0] - a[0]).atan2(b[1] - a[1])
    }

    pub fn end(&self) -> [f32; 2] {
        self.pts[self.pts.len() - 1]
    }
}

/// How a figure goes: its step's length (body metres), one step's time and
/// how much of two steps' time a foot spends in the air.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Gait {
    pub stride: f32,
    pub period: f32,
    pub swing: f32,
    pub run: bool,
}

pub const WALKING: Gait = Gait {
    stride: 0.72,
    period: 0.49,
    swing: SWING_SHARE,
    run: false,
};
pub const STROLL: Gait = Gait {
    stride: 0.6,
    period: 0.58,
    swing: SWING_SHARE,
    run: false,
};
pub const RUNNING: Gait = Gait {
    stride: 1.05,
    period: 0.36,
    swing: 1.28,
    run: true,
};
/// A climb: one tread a step.
pub const CLIMBING: Gait = Gait {
    stride: 0.26,
    period: 0.5,
    swing: SWING_SHARE,
    run: false,
};

/// Before its first step a figure shifts its weight this long.
pub const READY: f32 = 0.45;

/// Footsteps landing at `zs` along the walk's line from `begin`, the feet
/// taking turns, the left first; then the other foot closes beside the
/// last. Returns them and when the last lands.
fn footsteps(begin: f32, zs: &[f32], g: Gait) -> (Vec<Step>, f32) {
    let mut steps = Vec::with_capacity(zs.len() + 1);
    let air = g.swing * g.period;
    let mut land = begin + air;
    for (i, &z) in zs.iter().enumerate() {
        let side = i % 2;
        steps.push(Step {
            side,
            lift: land - air,
            land,
            x: foot_x(side),
            z,
        });
        land += g.period;
    }
    let side = zs.len() % 2;
    let z = zs[zs.len() - 1];
    // The closing step is a walking one, whatever the gait.
    let land = land - g.period + 0.62;
    steps.push(Step {
        side,
        lift: land - 0.42,
        land,
        x: foot_x(side),
        z,
    });
    (steps, land)
}

/// A turn on the spot between two times, the body from `from` to `to`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Turn {
    pub t0: f32,
    pub t1: f32,
    pub from: f32,
    pub to: f32,
}

impl Turn {
    fn progress(&self, t: f32) -> f32 {
        ((t - self.t0) / (self.t1 - self.t0)).clamp(0.0, 1.0)
    }
    fn body(&self, t: f32) -> f32 {
        mix(self.from, self.to, min_jerk(self.progress(t)))
    }
    /// How far a foot has turned: the one on the side it turns toward
    /// goes first, the other follows.
    fn foot(&self, side: usize, t: f32) -> f32 {
        let u = self.progress(t);
        let lead = usize::from(self.to < self.from);
        if side == lead {
            min_jerk((u - 0.05) / 0.45)
        } else {
            min_jerk((u - 0.45) / 0.45)
        }
    }
}

/// What carries a figure standing on a spot.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Ride {
    Still,
    Lift,
    Tram,
}

#[derive(Clone, Debug)]
pub enum Place {
    /// Along a path from a floor at `base`, over `ground`; the walk's own
    /// floor (a stair's treads) rises under the feet along `ramp`.
    Way {
        path: Path,
        base: f32,
        ground: Ground,
        ramp: fn(f32) -> f32,
    },
    /// On one spot: its heels' middle on the ground, the way it faces.
    Spot {
        at: V3,
        heading: f32,
        turn: Option<Turn>,
    },
}

/// One act of a figure's day.
#[derive(Clone, Debug)]
pub struct Act {
    pub t0: f32,
    pub t1: f32,
    pub walk: Walk,
    pub place: Place,
    pub ride: Ride,
    /// The figure's size (1 a grown man).
    pub k: f32,
    pub gait: Gait,
    /// When its first foot lifts (ways).
    pub begin: f32,
}

/// A figure's own frame at one moment: where its walk's origin stands in
/// the world, which way it faces, its size and how far along its walk.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Local {
    pub origin: V3,
    pub heading: f32,
    pub k: f32,
    pub z0: f32,
}

impl Local {
    pub fn world(&self, p: V3) -> V3 {
        self.origin + rotate((p - v3(0.0, 0.0, self.z0)) * self.k, Y, self.heading)
    }
    pub fn local(&self, w: V3) -> V3 {
        rotate(w - self.origin, Y, -self.heading) * (1.0 / self.k) + v3(0.0, 0.0, self.z0)
    }
    pub fn axis(&self, a: V3) -> V3 {
        rotate(a, Y, self.heading)
    }
}

impl Act {
    /// The figure's frame at `t`, carried `offset` by what it rides.
    pub fn local(&self, t: f32, offset: V3) -> Local {
        match &self.place {
            Place::Way {
                path, base, ground, ..
            } => {
                let track = self.walk.track(t);
                let s = track * self.k;
                let o = path.at(s);
                Local {
                    origin: v3(o[0], base + ground(o[0], o[1]), o[1]) + offset,
                    heading: path.heading(s),
                    k: self.k,
                    z0: track,
                }
            }
            Place::Spot { at, heading, turn } => Local {
                origin: *at + offset,
                heading: turn.map_or(*heading, |r| r.body(t)),
                k: self.k,
                z0: 0.0,
            },
        }
    }

    /// The figure's pose in its walk's frame (its gestures are added to it).
    pub fn pose(&self, t: f32, breath: f32) -> Pose {
        let mut pose = self.walk.pose(t, breath);
        if self.gait.run && t > self.begin {
            // Running: leaning in, elbows bent, a bounce on every step.
            let run = pose.amount;
            let phase = (t - self.begin) / self.gait.period;
            pose.lean += 0.14 * run;
            pose.pelvis.y += 0.035 * run * (TAU * phase).sin().abs() - 0.03 * run;
            pose.bend = pose.bend.map(|b| b + 1.15 * run);
            pose.arms = pose.arms.map(|a| a * (1.0 + 0.6 * run));
        }
        pose
    }

    /// The figure's body in the world for `pose` at `t`.
    pub fn body(&self, t: f32, pose: &Pose, offset: V3) -> Body {
        let body = build(pose);
        let local = self.local(t, offset);
        let k = self.k;
        match &self.place {
            Place::Way {
                path,
                base,
                ground,
                ramp,
            } => body.mapped(
                |p| {
                    let rigid = local.world(p);
                    // The feet follow the path's bends; the body above them
                    // turns as one.
                    let w = smooth(0.2, 0.6, p.y - ramp(p.z));
                    if w >= 1.0 {
                        return rigid;
                    }
                    let s = p.z * k;
                    let q = path.at(s);
                    let side = rotate(v3(p.x * k, 0.0, 0.0), Y, path.heading(s));
                    let (x, z) = (q[0] + side.x, q[1] + side.z);
                    let bent = v3(x, base + ground(x, z) + p.y * k, z) + offset;
                    bent.lerp(rigid, w)
                },
                |a| local.axis(a),
                k,
            ),
            Place::Spot { at, turn, .. } => match turn {
                Some(r) if t > r.t0 && t < r.t1 => {
                    let body_angle = r.body(t);
                    let feet = [0, 1].map(|side| mix(r.from, r.to, r.foot(side, t)));
                    let swings = [0, 1].map(|side| (PI * r.foot(side, t)).sin());
                    let at = *at + offset;
                    body.mapped(
                        |p| {
                            let side = usize::from(p.x < 0.0);
                            let w = smooth(0.12, 0.5, p.y);
                            let angle = mix(feet[side], body_angle, w);
                            let lift = 0.035 * swings[side] * (1.0 - smooth(0.04, 0.3, p.y));
                            at + rotate(p * k + Y * lift, Y, angle)
                        },
                        |a| rotate(a, Y, body_angle),
                        k,
                    )
                }
                _ => body.mapped(|p| local.world(p), |a| local.axis(a), k),
            },
        }
    }

    /// When the figure has come `s` metres along its way.
    pub fn time_at(&self, s: f32) -> f32 {
        let (mut a, mut b) = (self.t0, self.t1);
        for _ in 0..40 {
            let m = 0.5 * (a + b);
            if self.walk.track(m) * self.k < s {
                a = m;
            } else {
                b = m;
            }
        }
        0.5 * (a + b)
    }

    pub fn is_way(&self) -> bool {
        matches!(self.place, Place::Way { .. })
    }
}

/// The lift's moves and the tram's timetable.
#[derive(Clone, Debug, Default)]
pub struct World {
    /// The cage's floor before any move, and each move: from, to (times),
    /// from, to (floor heights).
    pub lift_start: f32,
    pub lift: Vec<[f32; 4]>,
    pub tram: Tram,
}

/// The tram's day: it comes out of the left tunnel to the first stop,
/// leaves through the right one, comes round out of the left again at
/// `back` to the second stop, and leaves to the right. Times of story.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Tram {
    pub enter: f32,
    pub stop1: f32,
    pub go1: f32,
    pub back: f32,
    pub stop2: f32,
    pub go2: f32,
}

/// From the first stop it is back in from the left this long after leaving,
/// and brakes into the second stop over `BACK_BRAKE` s from `BACK_FROM` away.
pub const BACK_AFTER: f32 = 9.5;
pub const BACK_BRAKE: f32 = 4.5;
const BACK_FROM: f32 = 12.0;

/// The tram's two stops: its middle's x.
pub const STOP1: f32 = -11.4;
pub const STOP2: f32 = -5.7;
/// It brakes into the first stop over this long, from this far.
pub const BRAKE: f32 = 6.0;
const BRAKE_FROM: f32 = 10.6;
/// It leaves the second stop gathering this much way in `LEAVE` s.
const LEAVE: f32 = 5.0;
const LEAVE_TO: f32 = 27.7;
/// Gone past this far from the middle.
pub const TRAM_GONE: f32 = 23.0;

impl World {
    pub fn lift_y(&self, t: f32) -> f32 {
        let mut y = self.lift_start;
        for m in &self.lift {
            if t < m[0] {
                break;
            }
            y = mix(m[2], m[3], min_jerk((t - m[0]) / (m[1] - m[0])));
        }
        y
    }

    /// The lift's speed now, metres a second (for its hum and its light).
    pub fn lift_moving(&self, t: f32) -> f32 {
        ((self.lift_y(t + 0.05) - self.lift_y(t - 0.05)) / 0.1).abs()
    }

    /// The tram's middle along the street.
    pub fn tram_c(&self, t: f32) -> f32 {
        let r = &self.tram;
        if r.enter == 0.0 && r.stop1 == 0.0 {
            return -40.0;
        }
        if t < r.enter {
            // Coming at the speed it brakes from.
            let v = 2.0 * BRAKE_FROM / BRAKE;
            return STOP1 - BRAKE_FROM + v * (t - r.enter);
        }
        if t < r.stop1 {
            let s = (t - r.enter) / (r.stop1 - r.enter);
            return STOP1 - BRAKE_FROM * (1.0 - s) * (1.0 - s);
        }
        if t < r.go1 {
            return STOP1;
        }
        if r.back <= r.go1 {
            // No round: straight on to the second stop.
            if t < r.stop2 {
                return mix(STOP1, STOP2, min_jerk((t - r.go1) / (r.stop2 - r.go1)));
            }
        } else {
            let v = 2.0 * BACK_FROM / (r.stop2 - r.back);
            if t < r.back - 1.0 {
                // Off to the right, gathering way, out through the tunnel.
                let u = t - r.go1;
                return if u < 5.0 {
                    STOP1 + 0.6 * u * u
                } else {
                    STOP1 + 15.0 + 6.0 * (u - 5.0)
                };
            }
            if t < r.back {
                // Round the block, out of the left tunnel.
                return STOP2 - BACK_FROM + v * (t - r.back);
            }
            if t < r.stop2 {
                let s = (t - r.back) / (r.stop2 - r.back);
                return STOP2 - BACK_FROM * (1.0 - s) * (1.0 - s);
            }
        }
        if t < r.go2 {
            return STOP2;
        }
        let s = (t - r.go2) / LEAVE;
        STOP2 + LEAVE_TO * s * s
    }

    /// How far the tram's doors are open, 0..1.
    pub fn tram_doors(&self, t: f32) -> f32 {
        let r = &self.tram;
        let open =
            |a: f32, b: f32| smooth(a + 0.2, a + 0.9, t) * (1.0 - smooth(b - 0.9, b - 0.2, t));
        open(r.stop1, r.go1).max(open(r.stop2, r.go2))
    }

    /// Where a rider has been carried since `t0`.
    pub fn carried(&self, ride: Ride, t0: f32, t: f32) -> V3 {
        match ride {
            Ride::Still => v3(0.0, 0.0, 0.0),
            Ride::Lift => v3(0.0, self.lift_y(t) - self.lift_y(t0), 0.0),
            Ride::Tram => v3(self.tram_c(t) - self.tram_c(t0), 0.0, 0.0),
        }
    }
}

/// A figure's day as acts one after another.
#[derive(Clone, Debug)]
pub struct Plan {
    pub acts: Vec<Act>,
    pub marks: Vec<(&'static str, f32)>,
    pub t: f32,
    /// Its heels' middle, on the floor `base` (plus the ground there).
    pub at: V3,
    pub base: f32,
    pub ground: Ground,
    pub heading: f32,
    pub seated: bool,
    pub k: f32,
    pub sway: f32,
    pub ride: Ride,
    /// How long its turns take against a grown man's (a child's are quick).
    pub quick: f32,
}

impl Plan {
    pub fn new(t: f32, at: V3, heading: f32, seated: bool, k: f32, sway: f32) -> Plan {
        Plan {
            acts: Vec::new(),
            marks: Vec::new(),
            t,
            at,
            base: at.y,
            ground: flat,
            heading,
            seated,
            k,
            sway,
            ride: Ride::Still,
            quick: 1.0,
        }
    }

    pub fn mark(&mut self, name: &'static str) -> &mut Self {
        self.marks.push((name, self.t));
        self
    }

    pub fn when(&self, name: &str) -> f32 {
        self.marks
            .iter()
            .find(|m| m.0 == name)
            .unwrap_or_else(|| panic!("no mark {name}"))
            .1
    }

    fn still_walk(&self, rests: Vec<Rest>) -> Walk {
        // One step far beyond the loop: the walk only stands (or sits).
        let never = Step {
            side: 0,
            lift: 1e4,
            land: 1e4 + 0.4,
            x: FOOT_X,
            z: 0.0,
        };
        let rests = if rests.is_empty() && self.seated {
            vec![Rest {
                from: 1e4,
                to: 1e4 + 1.0,
                up: true,
            }]
        } else {
            rests
        };
        Walk::new([[FOOT_X, 0.0], [-FOOT_X, 0.0]], vec![never], self.sway).with_rests(rests)
    }

    fn spot(&mut self, d: f32, turn: Option<Turn>, rests: Vec<Rest>) {
        let walk = self.still_walk(rests);
        self.acts.push(Act {
            t0: self.t,
            t1: self.t + d,
            walk,
            place: Place::Spot {
                at: self.at,
                heading: self.heading,
                turn,
            },
            ride: self.ride,
            k: self.k,
            gait: WALKING,
            begin: self.t,
        });
        self.t += d;
    }

    /// Stands (or sits) where it is for `d` s.
    pub fn wait(&mut self, d: f32) -> &mut Self {
        if d > 1e-3 {
            self.spot(d, None, Vec::new());
        }
        self
    }

    pub fn wait_until(&mut self, t: f32) -> &mut Self {
        let d = t - self.t;
        assert!(d > -0.05, "already at {} past {t}", self.t);
        self.wait(d)
    }

    pub fn rise(&mut self, d: f32) -> &mut Self {
        assert!(self.seated);
        let rest = Rest {
            from: self.t,
            to: self.t + d,
            up: true,
        };
        self.spot(d, None, vec![rest]);
        self.seated = false;
        self
    }

    pub fn sit(&mut self, d: f32) -> &mut Self {
        assert!(!self.seated);
        let rest = Rest {
            from: self.t,
            to: self.t + d,
            up: false,
        };
        self.spot(d, None, vec![rest]);
        self.seated = true;
        self
    }

    /// Turns on its feet to face `heading`, the shorter way.
    pub fn turn_to(&mut self, heading: f32) -> &mut Self {
        let d = turn_between(self.heading, heading);
        self.turn_by(d)
    }

    /// Turns `d` radians (to its left if positive), however far.
    pub fn turn_by(&mut self, d: f32) -> &mut Self {
        if d.abs() < 0.05 {
            self.heading += d;
            return self;
        }
        let span = (0.5 + 0.5 * d.abs() / FRAC_PI_2) * self.quick;
        let turn = Turn {
            t0: self.t,
            t1: self.t + span,
            from: self.heading,
            to: self.heading + d,
        };
        self.spot(span, Some(turn), Vec::new());
        self.heading += d;
        self
    }

    /// Walks (or runs) through `points` over `ground`, first turning to the
    /// way out if it faces elsewhere.
    pub fn walk(&mut self, points: &[[f32; 2]], ground: Ground, gait: Gait) -> &mut Self {
        let mut corners = vec![[self.at.x, self.at.z]];
        corners.extend_from_slice(points);
        let path = Path::new(&corners);
        self.turn_to(path.heading(0.0));
        let lw = path.length() / self.k;
        let n = (lw / gait.stride).ceil().max(1.0) as usize;
        let zs: Vec<f32> = (1..=n).map(|i| lw * i as f32 / n as f32).collect();
        self.way(path, &zs, ground, level, level, gait, 0.0)
    }

    /// Climbs a straight stair from here to `to` (x, z): the floor along
    /// the walk's line is `floor`, the line its body rides `ramp`, and the
    /// stair rises `rise` in all; it treads on `zs`.
    #[allow(clippy::too_many_arguments)]
    pub fn climb(
        &mut self,
        to: [f32; 2],
        zs: &[f32],
        floor: fn(f32) -> f32,
        ramp: fn(f32) -> f32,
        rise: f32,
        gait: Gait,
    ) -> &mut Self {
        let path = Path::new(&[[self.at.x, self.at.z], to]);
        self.turn_to(path.heading(0.0));
        self.way(path, zs, flat, floor, ramp, gait, rise)
    }

    #[allow(clippy::too_many_arguments)]
    fn way(
        &mut self,
        path: Path,
        zs: &[f32],
        ground: Ground,
        floor: fn(f32) -> f32,
        ramp: fn(f32) -> f32,
        gait: Gait,
        rise: f32,
    ) -> &mut Self {
        let begin = self.t + READY;
        let (steps, last) = footsteps(begin, zs, gait);
        let walk =
            Walk::new([[FOOT_X, 0.0], [-FOOT_X, 0.0]], steps, self.sway).on_ground(floor, ramp);
        let t1 = last + 0.45;
        let end = path.end();
        let heading = path.heading(path.length());
        self.acts.push(Act {
            t0: self.t,
            t1,
            walk,
            place: Place::Way {
                path,
                base: self.base,
                ground,
                ramp,
            },
            ride: Ride::Still,
            k: self.k,
            gait,
            begin,
        });
        self.t = t1;
        self.heading = heading;
        self.base += rise;
        self.ground = ground;
        self.at = v3(end[0], self.base + ground(end[0], end[1]), end[1]);
        self
    }

    /// Rides `ride` until `until`, then stands where it brought him.
    pub fn ride_until(&mut self, ride: Ride, until: f32, world: &World) -> &mut Self {
        let t0 = self.t;
        self.ride = ride;
        self.wait_until(until);
        self.ride = Ride::Still;
        let by = world.carried(ride, t0, until);
        self.at = self.at + by;
        self.base += by.y;
        self
    }

    /// Is somewhere else at once (the camera has cut away).
    pub fn cut(&mut self, at: V3, heading: f32) -> &mut Self {
        self.at = at;
        self.base = at.y;
        self.ground = flat;
        self.heading = heading;
        self.seated = false;
        self
    }

    /// The act playing at `t`: before the first, the first; after the
    /// last, the last.
    pub fn act_at(&self, t: f32) -> &Act {
        let i = self.acts.partition_point(|a| a.t0 <= t);
        &self.acts[i.saturating_sub(1)]
    }

    /// The last way that was walked.
    pub fn last_way(&self) -> &Act {
        self.acts.iter().rev().find(|a| a.is_way()).expect("a way")
    }

    /// Where the figure is and which way it faces at `t`, without its
    /// body: the camera's and the rings' anchor.
    pub fn frame_at(&self, t: f32, world: &World) -> Local {
        let act = self.act_at(t);
        act.local(t, world.carried(act.ride, act.t0, t))
    }

    /// A smooth anchor over the floor under him (the walk's own track).
    pub fn anchor(&self, t: f32, world: &World) -> V3 {
        self.frame_at(t, world).origin
    }
}

/// A curve keyed in time that rests at its ends.
pub fn keyed(keys: &[(f32, f32)], t: f32) -> f32 {
    monotone(keys, t)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_rounded_path_keeps_its_ends_and_heads_along() {
        let p = Path::new(&[[0.0, 0.0], [0.0, 2.0], [2.0, 2.0]]);
        let e = p.at(p.length());
        assert!((e[0] - 2.0).abs() < 1e-4 && (e[1] - 2.0).abs() < 1e-4);
        assert!(p.heading(0.3).abs() < 1e-3);
        assert!((p.heading(p.length() - 0.2) - FRAC_PI_2).abs() < 1e-3);
        assert!(p.length() < 4.0 && p.length() > 3.6);
    }

    #[test]
    fn a_walk_arrives_where_it_was_going() {
        let mut plan = Plan::new(0.0, v3(0.0, 0.0, 0.0), 0.0, false, 1.0, 4.0);
        plan.walk(&[[0.0, 3.0], [2.0, 3.0]], flat, WALKING);
        let world = World::default();
        let end = plan.anchor(plan.t, &world);
        assert!(
            (end.x - 2.0).abs() < 0.08 && (end.z - 3.0).abs() < 0.08,
            "{end:?}"
        );
        let act = plan.last_way();
        let body = act.body(plan.t, &act.pose(plan.t, 0.0), v3(0.0, 0.0, 0.0));
        assert!((body.pelvis.x - 2.06).abs() < 0.1, "{:?}", body.pelvis);
    }

    #[test]
    fn a_turn_ends_facing_the_new_way() {
        let mut plan = Plan::new(0.0, v3(1.0, 0.0, 1.0), 0.0, false, 1.0, 4.0);
        plan.turn_to(PI);
        let world = World::default();
        let l = plan.frame_at(plan.t + 0.1, &world);
        assert!((l.heading.abs() - PI).abs() < 1e-3);
        let act = plan.act_at(0.5);
        let body = act.body(0.5, &act.pose(0.5, 0.0), v3(0.0, 0.0, 0.0));
        assert!(body.low.y > -0.02, "{:?}", body.low);
    }
}
