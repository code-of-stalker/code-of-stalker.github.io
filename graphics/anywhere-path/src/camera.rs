//! The camera: one long pass over his shoulder, with cuts where the place
//! changes and a few moments through his own eyes. Each shot names when it
//! starts, how the camera hangs (fixed in the world, in the car, behind him,
//! ahead of him looking back, through his eyes, or the crane of the
//! finale), its lens, and how long it eases in from the shot before (0: a
//! cut). He is followed by a smoothed anchor so his steps never shake it.
use crate::act::turn_between;
use crate::math::{min_jerk, mix, rotate, v3, V3, Y};
use crate::place::{car_point, hf3, polar, polar3, DEG};
use crate::story::{Story, HERO};
use crate::LOOP;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Rig {
    Fixed {
        eye: V3,
        at: V3,
    },
    /// In the car's frame: (across from the track, up, along).
    Car {
        eye: [f32; 3],
        at: [f32; 3],
    },
    /// Behind him: `back` metres, `side` to his right, `up`; looking
    /// `ahead` of him at height `look`.
    Follow {
        back: f32,
        side: f32,
        up: f32,
        ahead: f32,
        look: f32,
    },
    /// Ahead of him looking back at him.
    Lead {
        front: f32,
        side: f32,
        up: f32,
        look: f32,
    },
    /// Through his eyes, turned `yaw` to his left and `pitch` up.
    Pov {
        yaw: f32,
        pitch: f32,
    },
    /// The finale: up from his face to over the whole ring.
    Crane,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Shot {
    pub at: f32,
    pub rig: Rig,
    /// Vertical field of view, degrees.
    pub fov: f32,
    pub blend: f32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct View {
    pub eye: V3,
    pub look: V3,
    pub fov: f32,
    /// 1 through his eyes (his own head is not drawn).
    pub pov: f32,
}

impl View {
    /// Forward, right and up.
    pub fn basis(&self) -> (V3, V3, V3) {
        let fwd = (self.look - self.eye).normalize();
        let right = fwd.cross(Y).normalize();
        (fwd, right, right.cross(fwd))
    }

    pub fn lens(&self) -> f32 {
        1.0 / (0.5 * self.fov * DEG).tan()
    }

    /// Where `p` lands on the screen, 1 high (y in −1…1, x as wide as the
    /// screen is), and its depth.
    pub fn project(&self, p: V3) -> (f32, f32, f32) {
        let (f, r, u) = self.basis();
        let d = p - self.eye;
        let z = d.dot(f);
        let k = self.lens() / z.max(1e-3);
        (d.dot(r) * k, d.dot(u) * k, z)
    }
}

/// His anchor and heading, smoothed over about a second and a half.
pub fn smoothed(story: &Story, t: f32) -> (V3, f32) {
    let plan = &story.plans[HERO];
    let centre = plan.frame_at(t, &story.world).heading;
    let (mut sum, mut heading, mut weight) = (V3::default(), 0.0, 0.0);
    for k in -6i32..=6 {
        let s = (t + k as f32 * 0.225).clamp(0.0, LOOP);
        let w = (-((k * k) as f32) / 8.0).exp();
        sum = sum + plan.anchor(s, &story.world) * w;
        let h = plan.frame_at(s, &story.world).heading;
        heading += (centre + turn_between(centre, h)) * w;
        weight += w;
    }
    (sum * (1.0 / weight), heading / weight)
}

fn ahead(h: f32) -> V3 {
    v3(h.sin(), 0.0, h.cos())
}

/// His right, as a walker facing `h` sees it.
fn right(h: f32) -> V3 {
    v3(-h.cos(), 0.0, h.sin())
}

pub struct Camera {
    pub shots: Vec<Shot>,
    f0: f32,
}

const fn fixed(eye: V3, at: V3) -> Rig {
    Rig::Fixed { eye, at }
}

impl Camera {
    pub fn new(story: &Story) -> Camera {
        let k = story.keys;
        let mid =
            |a: [f32; 2], b: [f32; 2], y: f32| v3(0.5 * (a[0] + b[0]), y, 0.5 * (a[1] + b[1]));
        let opening = fixed(polar3(4.6, 236.0, 1.15), polar3(6.5, 25.0, 1.5));
        let car_ots = Rig::Car {
            eye: [-0.3, 1.75, 0.55],
            at: [1.3, 1.45, 0.2],
        };
        let follow = |back, side, up, ahead, look| Rig::Follow {
            back,
            side,
            up,
            ahead,
            look,
        };
        let lead = |front, side, up, look| Rig::Lead {
            front,
            side,
            up,
            look,
        };
        let shot = |at: f32, rig: Rig, fov: f32, blend: f32| Shot {
            at,
            rig,
            fov,
            blend,
        };
        let shots = vec![
            // The open field: him small under the moon, the house ahead.
            shot(0.0, opening, 46.0, 0.0),
            shot(k.go + 2.5, follow(3.2, 0.6, 1.75, 2.0, 1.3), 46.0, 2.5),
            // Close behind him through the front door.
            shot(k.door - 1.6, follow(1.6, 0.15, 1.7, 2.5, 1.45), 50.0, 1.6),
            // The room: through his eyes, the train past the window.
            shot(
                k.window - 0.3,
                Rig::Pov {
                    yaw: 0.0,
                    pitch: -0.05,
                },
                55.0,
                0.8,
            ),
            shot(
                k.leave,
                fixed(hf3(11.6, 1.75, -4.9), hf3(15.4, 1.1, -1.6)),
                50.0,
                0.0,
            ),
            // The table room: he comes through the doorway toward us and
            // goes to his chair.
            shot(
                k.through,
                fixed(hf3(15.95, 1.6, 4.95), hf3(14.1, 1.05, 1.2)),
                48.0,
                0.0,
            ),
            // One on one: over his shoulder, the reverse, the profile.
            shot(
                k.seated - 0.6,
                fixed(hf3(13.15, 1.35, 1.0), hf3(13.5, 1.15, 4.3)),
                44.0,
                0.0,
            ),
            shot(
                k.seated + 2.6,
                fixed(hf3(13.8, 1.35, 5.0), hf3(13.5, 1.1, 1.8)),
                44.0,
                0.0,
            ),
            shot(
                k.seated + 5.0,
                fixed(hf3(15.6, 1.2, 3.0), hf3(13.5, 1.0, 3.0)),
                44.0,
                1.2,
            ),
            // He gets up and goes to the back door.
            shot(
                k.risen - 0.3,
                fixed(hf3(11.7, 1.7, 0.9), hf3(14.9, 1.1, 5.0)),
                46.0,
                0.0,
            ),
            // Out of the back door into the night.
            shot(
                k.back_door - 0.4,
                fixed(hf3(12.6, 1.5, 9.5), hf3(14.95, 1.2, 5.5)),
                46.0,
                0.0,
            ),
            shot(
                k.back_door + 1.0,
                follow(0.8, 3.4, 1.5, 0.6, 1.2),
                46.0,
                2.0,
            ),
            // Up onto the platform among the crowd.
            shot(k.ramp - 1.0, follow(1.7, 0.4, 1.75, 3.0, 1.5), 48.0, 1.5),
            // The car: he comes in at the door.
            shot(
                k.board - 0.4,
                Rig::Car {
                    eye: [0.9, 1.7, -3.0],
                    at: [-1.3, 1.4, 0.0],
                },
                52.0,
                0.0,
            ),
            shot(k.at_seat + 0.1, car_ots, 48.0, 1.0),
            // Motion: the country streams past his eyes, then the train
            // seen from the field.
            shot(
                k.dep + 0.8,
                Rig::Pov {
                    yaw: -0.12,
                    pitch: -0.06,
                },
                55.0,
                1.2,
            ),
            shot(
                k.dep + 5.2,
                Rig::Car {
                    eye: [7.5, 1.9, -5.0],
                    at: [0.75, 1.55, 0.25],
                },
                46.0,
                0.0,
            ),
            shot(k.dep + 8.2, car_ots, 48.0, 0.0),
            // Off at the lake.
            shot(
                k.off - 0.5,
                fixed(polar3(18.2, 226.0, 1.6), polar3(21.8, 232.5, 1.5)),
                46.0,
                0.0,
            ),
            shot(
                k.off + 3.5,
                fixed(polar3(12.5, 222.0, 1.0), polar3(17.5, 232.0, 1.0)),
                46.0,
                0.0,
            ),
            // Silence: out to the pier's end, then the moon through his eyes.
            shot(k.pier_end - 0.5, follow(3.0, 0.5, 1.7, 2.0, 1.4), 46.0, 0.0),
            shot(
                k.pier_end + 0.5,
                follow(1.1, 0.35, 1.68, 3.0, 1.5),
                46.0,
                2.5,
            ),
            shot(
                k.pier_end + 2.6,
                Rig::Pov {
                    yaw: 0.0,
                    pitch: 0.2,
                },
                55.0,
                1.5,
            ),
            // He turns back: seen from the shore.
            shot(
                k.turn_back - 1.7,
                fixed(polar3(19.2, 225.5, 1.6), polar3(16.0, 232.0, 1.2)),
                46.0,
                0.0,
            ),
            // Back along the pier: close behind him, the shore ahead.
            shot(
                k.turn_back + 0.8,
                follow(2.4, 0.3, 1.65, 3.0, 1.4),
                46.0,
                1.5,
            ),
            // From over the water: he comes off the pier, she waits on
            // the shore.
            shot(
                k.turn_back + 3.0,
                fixed(polar3(13.5, 240.0, 1.4), polar3(19.5, 238.5, 1.2)),
                46.0,
                0.0,
            ),
            // Dialogue: the two of them, then walking together.
            shot(
                k.meet - 1.5,
                fixed(
                    polar3(17.4, 241.5, 1.45),
                    mid(polar(19.3, 244.2), polar(20.1, 245.0), 1.35),
                ),
                44.0,
                0.0,
            ),
            shot(k.together + 0.5, lead(3.2, -0.4, 1.6, 1.4), 46.0, 2.5),
            // Home across the field: the camera comes close to him.
            shot(k.home_go, lead(1.6, 0.2, 1.55, 1.35), 40.0, 2.0),
            shot(k.home_go + 6.0, lead(1.8, 0.2, 1.5, 1.3), 38.0, 3.0),
            // The finale: up over the whole ring.
            shot(k.f0 - 0.5, Rig::Crane, 46.0, 2.5),
            shot(LOOP - 5.0, opening, 46.0, 4.5),
        ];
        Camera { shots, f0: k.f0 }
    }

    pub fn view(&self, story: &Story, t: f32) -> View {
        let i = self.shots.partition_point(|s| s.at <= t).max(1) - 1;
        self.shot_view(story, i, t)
    }

    fn shot_view(&self, story: &Story, i: usize, t: f32) -> View {
        let s = self.shots[i];
        let v = self.rig_view(story, s.rig, s.fov, t);
        if i == 0 || s.blend <= 0.0 || t >= s.at + s.blend {
            return v;
        }
        let from = self.shot_view(story, i - 1, t);
        let u = min_jerk((t - s.at) / s.blend);
        View {
            eye: from.eye.lerp(v.eye, u),
            look: from.look.lerp(v.look, u),
            fov: mix(from.fov, v.fov, u),
            pov: mix(from.pov, v.pov, u),
        }
    }

    fn rig_view(&self, story: &Story, rig: Rig, fov: f32, t: f32) -> View {
        let plain = |eye: V3, look: V3| View {
            eye,
            look,
            fov,
            pov: 0.0,
        };
        match rig {
            Rig::Fixed { eye, at } => plain(eye, at),
            Rig::Car { eye, at } => {
                let phi = story.world.train_at(t);
                plain(
                    car_point(phi, eye[0], eye[1], eye[2]),
                    car_point(phi, at[0], at[1], at[2]),
                )
            }
            Rig::Follow {
                back,
                side,
                up,
                ahead: forward,
                look,
            } => {
                let (a, h) = smoothed(story, t);
                let f = ahead(h);
                plain(
                    a - f * back + right(h) * side + Y * up,
                    a + f * forward + Y * look,
                )
            }
            Rig::Lead {
                front,
                side,
                up,
                look,
            } => {
                let (a, h) = smoothed(story, t);
                plain(
                    a + ahead(h) * front + right(h) * side + Y * up,
                    a + Y * look,
                )
            }
            Rig::Pov { yaw, pitch } => {
                let (a, h) = smoothed(story, t);
                let f = ahead(h);
                let eye = a + Y * 1.62 + f * 0.1;
                let d = rotate(f, Y, yaw);
                let d = d * pitch.cos() + Y * pitch.sin();
                View {
                    eye,
                    look: eye + d,
                    fov,
                    pov: 1.0,
                }
            }
            Rig::Crane => {
                let (a, _) = smoothed(story, t);
                let u = min_jerk((t - self.f0 + 0.5) / 7.5);
                let bearing = 93.0 + 1.5 * (t - self.f0);
                let out = polar3(mix(1.2, 16.0, u), bearing, 0.0);
                let head = a + Y * 1.55;
                View {
                    eye: a + out + Y * mix(1.6, 40.0, u),
                    look: head.lerp(v3(0.0, 0.0, 0.0), u),
                    fov: mix(fov, 56.0, u),
                    pov: 0.0,
                }
            }
        }
    }
}
