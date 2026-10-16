//! Approved Laboratory voice dynamics. Input is measured audio, never synthetic
//! volume. Envelope/springs, rotations, rays, caustics and waves share active time.
use std::f64::consts::{PI, TAU};
#[derive(Default, Clone, Copy)]
pub struct Spring {
    pub position: f64,
    pub velocity: f64,
}
fn clamp(v: f64) -> f64 {
    if v.is_finite() {
        v.clamp(0., 1.)
    } else {
        0.
    }
}
fn follow(current: f64, target: f64, dt: f64, attack: f64, release: f64) -> f64 {
    current
        + (target - current) * (1. - (-dt / if target > current { attack } else { release }).exp())
}
impl Spring {
    pub fn step(&mut self, target: f64, elapsed: f64, inertia: f64, damping: f64) -> f64 {
        let steps = (elapsed.max(0.) / 0.0045).ceil().max(1.) as u32;
        let dt = elapsed.max(0.) / steps as f64;
        let omega = 2. / inertia.max(0.05);
        for _ in 0..steps {
            self.velocity += ((target - self.position) * omega * omega
                - 2. * damping * omega * self.velocity)
                * dt;
            self.position += self.velocity * dt;
            if self.position < 0. {
                self.position = 0.;
                self.velocity = self.velocity.max(0.);
            }
            if self.position > 1.4 {
                self.position = 1.4;
                self.velocity = self.velocity.min(0.);
            }
        }
        if target == 0. && self.position < 0.0001 && self.velocity.abs() < 0.0001 {
            self.position = 0.;
            self.velocity = 0.;
        }
        self.position
    }
}
fn fill(level: f64) -> f64 {
    let v = clamp(level);
    if v >= 0.99 {
        1.
    } else {
        v
    }
}
#[derive(Clone, Debug)]
pub struct Ring {
    pub front: String,
    pub back: String,
    pub opacity: f64,
}
fn split(project: impl Fn(f64) -> [f64; 3], segments: usize) -> (String, String) {
    let mut front = String::new();
    let mut back = String::new();
    let mut previous = project(0.);
    let mut last_side = None;
    for i in 1..=segments {
        let next = project(i as f64 * TAU / segments as f64);
        let near = previous[2] + next[2] >= 0.;
        let target = if near { &mut front } else { &mut back };
        if last_side != Some(near) {
            target.push_str(&format!("M{:0.2} {:0.2}", previous[0], previous[1]));
        }
        target.push_str(&format!("L{:0.2} {:0.2}", next[0], next[1]));
        last_side = Some(near);
        previous = next;
    }
    (front, back)
}
pub fn orbit(angle: f64) -> (String, String) {
    let tilt = 0.46 + (angle * 0.67).sin() * 0.18;
    let turn = angle + 0.55;
    let roll = (angle * 0.43).sin() * 0.45;
    split(
        |t| {
            let x = t.cos() * 69.;
            let y = t.sin() * 69.;
            let y1 = y * tilt.cos();
            let z1 = y * tilt.sin();
            let x2 = x * turn.cos() + z1 * turn.sin();
            [
                120. + x2 * roll.cos() - y1 * roll.sin(),
                105. + x2 * roll.sin() + y1 * roll.cos(),
                -x * turn.sin() + z1 * turn.cos(),
            ]
        },
        80,
    )
}
pub fn mesh(angle: f64, amount: f64) -> Vec<Ring> {
    let count = 6;
    let r = 76.;
    let meridians = 4.;
    let y_turn = angle + 0.4;
    let pitch = 0.32 + (angle * 0.23).sin() * 0.18;
    let roll = 0.16f64;
    (0..24)
        .map(|i| {
            let reveal = if i == 0 {
                1.
            } else if i >= count {
                0.
            } else {
                clamp(clamp(amount) * 5. - i as f64 + 1.)
            };
            let opacity = reveal * reveal * (3. - 2. * reveal);
            if opacity == 0. {
                return Ring {
                    front: String::new(),
                    back: String::new(),
                    opacity,
                };
            }
            let longitude = i == 0 || i % 2 == 1;
            let ordinal = if i == 0 {
                0.
            } else if longitude {
                (i + 1) as f64 / 2.
            } else {
                i as f64 / 2.
            };
            let turn = ordinal * PI / meridians;
            let height = if longitude {
                0.
            } else {
                (ordinal / 3. * 1.6 - 0.8) * r
            };
            let cr = (r * r - height * height).sqrt();
            let (front, back) = split(
                |t| {
                    let [x, y, z] = if longitude {
                        [
                            r * t.cos() * turn.cos(),
                            r * t.sin(),
                            r * t.cos() * turn.sin(),
                        ]
                    } else {
                        [cr * t.cos(), height, cr * t.sin()]
                    };
                    let x1 = x * y_turn.cos() + z * y_turn.sin();
                    let z1 = -x * y_turn.sin() + z * y_turn.cos();
                    let y1 = y * pitch.cos() - z1 * pitch.sin();
                    [
                        120. + x1 * roll.cos() - y1 * roll.sin(),
                        105. + x1 * roll.sin() + y1 * roll.cos(),
                        y * pitch.sin() + z1 * pitch.cos(),
                    ]
                },
                64,
            );
            Ring {
                front,
                back,
                opacity,
            }
        })
        .collect()
}
#[derive(Clone, Copy, Debug)]
pub struct Ray {
    pub ends: [f64; 4],
    pub width: f64,
    pub opacity: f64,
}
#[derive(Clone, Debug)]
pub struct Caustic {
    pub path: String,
    pub opacity: f64,
    pub offset: f64,
}
#[derive(Clone, Copy)]
pub struct Wave {
    pub progress: f64,
    pub strength: f64,
}
pub struct Voice {
    pub input: [f64; 3],
    pub contour: Vec<f64>,
    pub reacting: bool,
    pub lock_target: f64,
    pub levels: [f64; 3],
    pub clock: f64,
    pub phase: f64,
    pub spin: f64,
    pub orbit: f64,
    pub mesh_angle: f64,
    pub arc: Spring,
    pub grid: Spring,
    pub light: Spring,
    pub emission: Spring,
    pub drawn_lock: f64,
    contour_levels: [f64; 40],
    pub waves: [Wave; 3],
    last_pulse: f64,
    pulse_index: usize,
    previous_energy: f64,
}
impl Default for Voice {
    fn default() -> Self {
        Self {
            input: [0.; 3],
            contour: Vec::new(),
            reacting: false,
            lock_target: 0.,
            levels: [0.; 3],
            clock: 0.,
            phase: 0.,
            spin: 0.,
            orbit: 0.,
            mesh_angle: 0.,
            arc: Spring::default(),
            grid: Spring::default(),
            light: Spring::default(),
            emission: Spring::default(),
            drawn_lock: 0.,
            contour_levels: [0.; 40],
            waves: [Wave {
                progress: 1.,
                strength: 0.,
            }; 3],
            last_pulse: -10.,
            pulse_index: 0,
            previous_energy: 0.,
        }
    }
}
impl Voice {
    pub fn step(&mut self, dt: f64, reduced: bool) {
        let dt = dt.max(0.);
        let response = dt * 0.2;
        self.clock += response;
        if !reduced {
            self.phase += dt * 0.65;
        }
        let motion: f64 = if reduced { 0.12 } else { 2. };
        let steps = (response / 0.0045).ceil().max(1.) as u32;
        let h = response / steps as f64;
        for _ in 0..steps {
            for i in 0..3 {
                self.levels[i] = follow(self.levels[i], clamp(self.input[i] * 7.), h, 0.045, 0.19);
            }
            let [l, m, hi] = self.levels;
            let drive = clamp(m * 0.75 + l * 0.35 + hi * 0.15);
            self.arc.step(fill(l / 0.7 * motion.max(1.)), h, 0.27, 1.);
            self.grid.step(drive, h, 0.27, 1.);
            self.light
                .step(clamp((l * 0.5 + m * 0.75 + hi * 0.15) * 7.), h, 0.05, 1.6);
        }
        let [l, m, hi] = self.levels;
        let drive = clamp(m * 0.75 + l * 0.35 + hi * 0.15);
        let complete = self.mesh_fill() == 1.;
        self.emission.step(
            if complete { 1. } else { 0. },
            response,
            if complete { 0.2 } else { 0.4 },
            1.,
        );
        if !reduced {
            self.spin += dt * 0.65 * 9. + response * m * 175. * motion;
            self.orbit += dt * 0.65 * 0.24 + response * drive * 2.6 * motion;
            self.mesh_angle += dt * 1.95 * 0.24 + response * drive * 3.6;
        }
        for i in 0..40 {
            let raw = if !self.reacting {
                0.
            } else if self.contour.is_empty() {
                self.input[1]
            } else {
                let n = self.contour.len();
                let b = i % n;
                self.contour[b] * 0.8
                    + (self.contour[(b + 1) % n] + self.contour[(b + n - 1) % n]) * 0.1
            };
            let target = (raw.max(0.) * 7. * 7. * motion * 1.6).atan() * 2. / PI;
            self.contour_levels[i] = follow(self.contour_levels[i], target, response, 0.025, 0.09);
        }
        let energy = l.max(m).max(hi);
        if !reduced
            && self.reacting
            && energy > 0.12
            && self.arc_fill() == 1.
            && self.clock - self.last_pulse > 0.25
            && (energy - self.previous_energy > 0.04 || self.clock - self.last_pulse > 0.68)
        {
            self.waves[self.pulse_index % 3] = Wave {
                progress: 0.,
                strength: energy,
            };
            self.pulse_index += 1;
            self.last_pulse = self.clock;
        }
        for wave in &mut self.waves {
            wave.progress = (wave.progress + response / 1.45).min(1.);
        }
        self.previous_energy = energy;
        self.drawn_lock = if self.lock_target == 1. || reduced {
            self.lock_target
        } else {
            follow(self.drawn_lock, self.lock_target, dt, 0.025, 0.025)
        };
    }
    pub fn arc_fill(&self) -> f64 {
        fill(self.arc.position)
    }
    pub fn mesh_fill(&self) -> f64 {
        fill(self.grid.position)
    }
    pub fn rays(&self, reduced: bool) -> Vec<Ray> {
        (0..40)
            .map(|i| {
                let a = i as f64 * PI / 20.;
                let t = if reduced { 0. } else { self.clock };
                let pattern = 0.5 + 0.3 * (a * 3. + t * 0.8).sin() + 0.2 * (a * 7. - t * 1.1).sin();
                let local =
                    clamp(self.contour_levels[i]).powf(1.4) * (0.12 + 0.88 * pattern.powf(1.3));
                let length = if self.reacting {
                    3. + 37. * local
                } else {
                    3. + 1. + (t * 0.9 + i as f64 * 0.5).sin()
                };
                Ray {
                    ends: [
                        120. + a.cos() * 99.,
                        105. + a.sin() * 99.,
                        120. + a.cos() * (99. + length),
                        105. + a.sin() * (99. + length),
                    ],
                    width: 0.65 + local * 2.8,
                    opacity: if self.reacting {
                        0.3 + local * 0.7
                    } else {
                        0.44
                    },
                }
            })
            .collect()
    }
    pub fn core(&self, reduced: bool) -> [f64; 4] {
        let energy = if self.light.position < 0.001 {
            0.
        } else {
            clamp(self.light.position)
        };
        let phase = if reduced { 0. } else { self.clock * 1.8 };
        let beat = if reduced {
            1.
        } else {
            0.5 + (self.clock * 1.2 * TAU).sin() * 0.5
        };
        [
            120. + (phase * 0.8).sin() * energy * 12.,
            105. + (phase * 0.63).cos() * energy * 9.,
            (45. + energy * 28.) * 0.85,
            clamp(energy * 0.04 * 4.) * beat.max(0.05),
        ]
    }
    pub fn caustics(&self, reduced: bool) -> Vec<Caustic> {
        let intensity = self.core(reduced)[3];
        let phase = if reduced { 0. } else { self.clock * 1.8 };
        (0..3)
            .map(|i| {
                let travel = (phase * 0.26 + i as f64 / 3.).rem_euclid(1.);
                let r = ((18. + travel * 66.) * 0.85).clamp(10., 82.);
                let angle = phase * 0.22;
                let path = if intensity == 0. {
                    String::new()
                } else {
                    (0..73)
                        .map(|p| {
                            let t = p as f64 * PI / 36.;
                            let x = t.cos() * r;
                            let y = t.sin() * r;
                            format!(
                                "{}{:0.2} {:0.2}",
                                if p == 0 { "M" } else { "L" },
                                120. + x * angle.cos() - y * angle.sin(),
                                105. + x * angle.sin() + y * angle.cos()
                            )
                        })
                        .collect::<String>()
                        + "Z"
                };
                Caustic {
                    path,
                    opacity: intensity * (travel * PI).sin() * (1. - travel * 0.65),
                    offset: -phase * (9. + i as f64 * 3.),
                }
            })
            .collect()
    }
    pub fn wave_frame(&self, index: usize, reduced: bool) -> [f64; 2] {
        let w = self.waves[index % 3];
        let p = w.progress;
        [
            84. + p * 30.,
            if reduced {
                0.
            } else {
                ((p / 0.06).min(1.) * PI / 2.).sin() * (1. - p).powf(4.4) * w.strength * 0.25 * 0.65
            },
        ]
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn springs_and_orbits_are_independent_of_delivery_rate() {
        let run = |fps: u32| {
            let mut v = Voice::default();
            v.input = [0.2, 0.09, 0.05];
            v.reacting = true;
            for _ in 0..fps * 4 {
                v.step(1. / fps as f64, false);
            }
            v
        };
        let a = run(60);
        let b = run(90);
        let c = run(120);
        assert!((a.arc.position - b.arc.position).abs() < 0.003);
        assert!((b.arc.position - c.arc.position).abs() < 0.003);
        assert!((a.orbit - c.orbit).abs() < 0.015);
    }
    #[test]
    fn silence_does_not_fabricate_energy_and_pause_is_external() {
        let mut v = Voice::default();
        v.step(1., false);
        assert_eq!(v.arc_fill(), 0.);
        assert_eq!(v.core(false)[3], 0.);
        assert_eq!(v.waves[0].progress, 1.);
        let phase = v.phase;
        assert_eq!(phase, v.phase);
    }
    #[test]
    fn mesh_keeps_original_radii_and_lock_finishes_at_threshold() {
        let mut v = Voice::default();
        v.lock_target = 1.;
        v.step(0.01, false);
        assert_eq!(v.drawn_lock, 1.);
        assert!(!mesh(0.2, 1.)[0].front.is_empty());
        assert_eq!(mesh(0.2, 1.)[6].opacity, 0.);
    }
}
