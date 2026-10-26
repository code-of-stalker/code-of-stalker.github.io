//! Precomputed, seeded scene elements. The seeds and the order of random draws
//! match the approved canvas prototype, so the same flakes, stones and dust
//! appear in the same places.
use crate::{lerp, SIZE};
use std::f64::consts::TAU;

/// mulberry32, bit-exact with the prototype's `rng(seed)`.
#[derive(Clone, Debug)]
pub struct Rng(u32);
impl Rng {
    pub fn new(seed: u32) -> Self {
        Self(seed)
    }
    pub fn float(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6D2B_79F5);
        let s = self.0;
        let mut t = (s ^ (s >> 15)).wrapping_mul(1 | s);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        f64::from(t ^ (t >> 14)) / 4_294_967_296.0
    }
    fn range(&mut self, a: f64, b: f64) -> f64 {
        a + (b - a) * self.float()
    }
}

/// A column of falling code over the ruins.
#[derive(Clone, Debug)]
pub struct RainColumn {
    pub x: f32,
    /// Pixels per second; whole laps of 520 px per loop keep the seam invisible.
    pub speed: f32,
    pub offset: f32,
    pub length: usize,
    pub seed: f32,
    pub alpha: f32,
}

/// A piece of the wall that glows, peels off, falls, and whose hole heals.
#[derive(Clone, Debug)]
pub struct Flake {
    pub at: [f32; 2],
    pub size: f32,
    pub outline: Vec<[f32; 2]>,
    pub cycles: f32,
    pub phase: f32,
    pub spin: f32,
    pub drift: f32,
}

/// A falling stone; `depth` > 1 passes in front of her.
#[derive(Clone, Debug)]
pub struct Stone {
    pub x: f32,
    pub y0: f32,
    pub cycles: f32,
    pub phase: f32,
    pub depth: f32,
    pub outline: Vec<[f32; 2]>,
    pub spin: f32,
    pub vx: f32,
    pub gravity: f32,
}

#[derive(Clone, Debug)]
pub struct Dust {
    pub at: [f32; 2],
    pub depth: f32,
    pub size: f32,
    pub speed: f32,
    pub phase: f32,
    pub rising: bool,
}

#[derive(Clone, Debug)]
pub struct Leaf {
    pub at: [f32; 2],
    pub phase: f32,
    pub cycles: f32,
    pub sway: f32,
}

#[derive(Clone, Debug)]
pub struct Mote {
    pub lens: usize,
    pub x: f32,
    pub phase: f32,
    pub cycles: f32,
    pub size: f32,
}

/// A torn strip of the bubble film.
#[derive(Clone, Debug)]
pub struct GumPiece {
    pub angle: f32,
    pub span: f32,
    pub outer: [f32; 9],
    pub inner: [f32; 9],
    pub fly: f32,
    pub spin: f32,
    pub width: f32,
}

const SPOTS: [[f32; 3]; 15] = [
    [60., 167., 26.],
    [40., 467., 30.],
    [133., 327., 20.],
    [27., 267., 18.],
    [107., 640., 24.],
    [320., 173., 16.],
    [173., 80., 20.],
    [1440., 87., 30.],
    [1287., 187., 22.],
    [1467., 327., 22.],
    [1500., 560., 26.],
    [1413., 440., 20.],
    [1307., 253., 18.],
    [1253., 53., 18.],
    [1333., 640., 22.],
];
pub const RAIN_LAP: f32 = 520.0;

pub fn rain() -> Vec<RainColumn> {
    let mut r = Rng::new(7);
    (0..34)
        .map(|i| {
            let x = if i % 2 == 0 {
                r.range(335.0, 585.0)
            } else {
                r.range(915.0, 1150.0)
            };
            let speed = r.range(60.0, 160.0);
            let laps = (speed * crate::LOOP_SECONDS / f64::from(RAIN_LAP))
                .round()
                .max(1.0);
            RainColumn {
                x: x as f32,
                speed: (laps * f64::from(RAIN_LAP) / crate::LOOP_SECONDS) as f32,
                offset: (r.float() * 800.0) as f32,
                length: 8 + (r.float() * 10.0) as usize,
                seed: (r.float() * 1000.0) as f32,
                alpha: r.range(0.15, 0.45) as f32,
            }
        })
        .collect()
}

pub fn flakes() -> Vec<Flake> {
    SPOTS
        .iter()
        .enumerate()
        .map(|(i, &[x, y, s])| {
            let mut r = Rng::new(100 + i as u32);
            let n = 10 + (r.float() * 5.0) as usize;
            let squash = r.range(0.55, 1.0);
            let rot = r.float() * 3.0;
            let s = f64::from(s);
            let outline = (0..n)
                .map(|k| {
                    let a = k as f64 / n as f64 * TAU + (r.float() - 0.5) * 0.4;
                    let d = s * if k % 2 == 1 {
                        r.range(0.45, 0.75)
                    } else {
                        r.range(0.75, 1.0)
                    };
                    let (px, py) = (a.cos() * d, a.sin() * d * squash);
                    [
                        (px * rot.cos() - py * rot.sin()) as f32,
                        (px * rot.sin() + py * rot.cos()) as f32,
                    ]
                })
                .collect();
            Flake {
                at: [x, y],
                size: s as f32,
                outline,
                cycles: 1.0 + (r.float() * 2.0).floor() as f32,
                phase: r.float() as f32,
                spin: ((r.float() - 0.5) * 4.0) as f32,
                drift: ((r.float() - 0.5) * 40.0) as f32,
            }
        })
        .collect()
}

pub fn stones() -> Vec<Stone> {
    (0..30)
        .map(|i| {
            let mut r = Rng::new(300 + i);
            let right = r.float() >= 0.5;
            let depth = if r.float() < 0.25 {
                r.range(1.2, 1.6)
            } else {
                r.range(0.55, 1.0)
            };
            let n = 5 + (r.float() * 2.0) as usize;
            let s = lerp(4.0, 18.0, (r.float() * r.float()) as f32) as f64 * depth;
            let outline = (0..n)
                .map(|k| {
                    let a = k as f64 / n as f64 * TAU + r.float() * 0.6;
                    let x = a.cos() * s * r.range(0.6, 1.0);
                    let y = a.sin() * s * r.range(0.6, 1.0);
                    [x as f32, y as f32]
                })
                .collect();
            Stone {
                x: if right {
                    r.range(1000.0, 1530.0)
                } else {
                    r.range(10.0, 540.0)
                } as f32,
                y0: r.range(-60.0, 250.0) as f32,
                cycles: 1.0 + (r.float() * 3.0).floor() as f32,
                phase: r.float() as f32,
                depth: depth as f32,
                outline,
                spin: ((r.float() - 0.5) * 5.0) as f32,
                vx: ((r.float() - 0.5) * 30.0) as f32,
                gravity: r.range(300.0, 520.0) as f32,
            }
        })
        .collect()
}

pub fn dust() -> Vec<Dust> {
    (0..90)
        .map(|i| {
            let mut r = Rng::new(900 + i);
            Dust {
                at: [
                    (r.float() * f64::from(SIZE[0])) as f32,
                    (r.float() * f64::from(SIZE[1])) as f32,
                ],
                depth: r.range(0.6, 1.5) as f32,
                size: r.range(0.6, 2.2) as f32,
                speed: r.range(6.0, 22.0) as f32,
                phase: (r.float() * 10.0) as f32,
                rising: r.float() < 0.45,
            }
        })
        .collect()
}

pub fn leaves() -> Vec<Leaf> {
    (0..18)
        .map(|i| {
            let mut r = Rng::new(1300 + i);
            Leaf {
                at: [r.range(670.0, 745.0) as f32, r.range(108.0, 128.0) as f32],
                phase: r.float() as f32,
                cycles: 2.0 + (r.float() * 3.0).floor() as f32,
                sway: r.range(2.0, 5.0) as f32,
            }
        })
        .collect()
}

pub fn motes() -> Vec<Mote> {
    (0..26)
        .map(|i| {
            let mut r = Rng::new(1500 + i);
            Mote {
                lens: i as usize % 2,
                x: r.float() as f32,
                phase: r.float() as f32,
                cycles: 2.0 + (r.float() * 3.0).floor() as f32,
                size: r.range(0.35, 0.9) as f32,
            }
        })
        .collect()
}

pub fn gum() -> Vec<GumPiece> {
    (0..11)
        .map(|i| {
            let mut r = Rng::new(2600 + i);
            let angle = f64::from(i) / 11.0 * TAU + (r.float() - 0.5) * 0.4;
            let span = r.range(0.28, 0.5);
            let outer = std::array::from_fn(|_| r.range(0.98, 1.03) as f32);
            let inner = std::array::from_fn(|_| r.range(0.82, 0.93) as f32);
            GumPiece {
                angle: angle as f32,
                span: span as f32,
                outer,
                inner,
                fly: r.range(1.15, 1.45) as f32,
                spin: ((r.float() - 0.5) * 0.6) as f32,
                width: r.range(0.6, 1.1) as f32,
            }
        })
        .collect()
}

/// Everything seeded, built once per renderer.
#[derive(Clone, Debug)]
pub struct Scene {
    pub rain: Vec<RainColumn>,
    pub flakes: Vec<Flake>,
    pub stones: Vec<Stone>,
    pub dust: Vec<Dust>,
    pub leaves: Vec<Leaf>,
    pub motes: Vec<Mote>,
    pub gum: Vec<GumPiece>,
    pub glass: [crate::glass::Glass; 2],
    pub chips: Vec<crate::glass::Chip>,
    pub lenses: crate::lens::Lenses,
    /// Drawn over Art's light paintings: holes, stones and code are inked in
    /// warm browns instead of black and light.
    pub light: bool,
}
impl Scene {
    pub fn new() -> Self {
        let glass = crate::glass::lenses();
        Self {
            rain: rain(),
            flakes: flakes(),
            stones: stones(),
            dust: dust(),
            leaves: leaves(),
            motes: motes(),
            gum: gum(),
            chips: crate::glass::chips(&glass),
            glass,
            lenses: crate::lens::Lenses::new(),
            light: false,
        }
    }
}
impl Default for Scene {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rng_matches_the_prototype() {
        // Values printed by the prototype's JavaScript `rng(seed)`.
        let mut r = Rng::new(7);
        assert_eq!(r.float(), 0.011_704_753_153_026_104);
        assert_eq!(r.float(), 0.061_958_257_574_588_06);
        assert_eq!(r.float(), 0.976_907_632_779_33);
        assert_eq!(Rng::new(0).float(), 0.266_429_208_684_712_65);
        assert_eq!(Rng::new(41).float(), 0.851_014_247_164_130_2);
    }

    #[test]
    fn rain_laps_are_whole_per_loop() {
        for c in rain() {
            let laps = c.speed * crate::LOOP_SECONDS as f32 / RAIN_LAP;
            assert!((laps - laps.round()).abs() < 1e-3);
            assert!(laps >= 1.0);
        }
    }

    #[test]
    fn seeded_elements_have_their_counts() {
        let s = Scene::new();
        assert_eq!(s.rain.len(), 34);
        assert_eq!(s.flakes.len(), 15);
        assert_eq!(s.stones.len(), 30);
        assert_eq!(s.dust.len(), 90);
        assert_eq!(s.leaves.len(), 18);
        assert_eq!(s.motes.len(), 26);
        assert_eq!(s.gum.len(), 11);
        assert_eq!(s.chips.len(), 24);
    }
}
