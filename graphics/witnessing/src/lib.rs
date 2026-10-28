//! «Живое Осознавание»: one touch changes a living surface.
//! Deterministic motion and source alignment; the browser only supplies time.
#[cfg(target_arch = "wasm32")]
mod browser;
use std::f32::consts::TAU;
use watcher_scene_palette::Palette;

pub const SIZE: [f32; 2] = [1536., 1024.];
pub const LOOP_SECONDS: f32 = 32.;
pub const STILL: f32 = 17.;
pub const CONTACT: [f32; 2] = [790., 570.];
pub const SOURCE_TIP: [f32; 2] = [570., 920.];
pub const HAND_SCALE: f32 = 0.78;
pub const REFLECTION_SCALE: f32 = 0.56;

pub fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0., 1.);
    t * t * (3. - 2. * t)
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Phase {
    InReflection,
    Approach,
    Unravel,
    Presence,
    Release,
    Settle,
    Return,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    pub phase: f32,
    pub stage: Phase,
    pub press: f32,
    pub lift: f32,
    pub angle: f32,
    pub ripple_age: f32,
    pub breath: f32,
    pub world_presence: f32,
    pub front_radius: f32,
    pub drop_y: f32,
    pub drop_alpha: f32,
    pub drop_x: f32,
    pub drop_stretch: f32,
    pub secondary_age: f32,
    pub reset: f32,
}
impl Frame {
    /// The immutable image's fingertip is the rotation pivot and contact point.
    pub fn hand_point(self, p: [f32; 2]) -> [f32; 2] {
        let (s, c) = self.angle.sin_cos();
        let q = [
            (p[0] - SOURCE_TIP[0]) * HAND_SCALE,
            (p[1] - SOURCE_TIP[1]) * HAND_SCALE,
        ];
        [
            CONTACT[0] + q[0] * c - q[1] * s,
            CONTACT[1] - self.lift + q[0] * s + q[1] * c,
        ]
    }
    pub fn hand_source(self, p: [f32; 2]) -> [f32; 2] {
        let (s, c) = self.angle.sin_cos();
        let q = [p[0] - CONTACT[0], p[1] - CONTACT[1] + self.lift];
        [
            SOURCE_TIP[0] + (q[0] * c + q[1] * s) / HAND_SCALE,
            SOURCE_TIP[1] + (-q[0] * s + q[1] * c) / HAND_SCALE,
        ]
    }
    pub fn reflected_point(self, source: [f32; 2]) -> [f32; 2] {
        let p = self.hand_point(source);
        [p[0], CONTACT[1] + (CONTACT[1] - p[1]) * REFLECTION_SCALE]
    }
    /// The clearing wave acts locally: distant buildings survive until reached.
    pub fn world_visibility_at(self, point: [f32; 2]) -> f32 {
        let radius =
            ((point[0] - CONTACT[0]).powi(2) + ((point[1] - CONTACT[1]) * 3.4).powi(2)).sqrt();
        let cleared = smooth(radius - 65., radius + 65., self.front_radius)
            * smooth(0., 25., self.front_radius);
        self.world_presence * (1. - cleared)
    }
}

pub fn compose(seconds: f32) -> Frame {
    let t = if seconds.is_finite() {
        seconds.rem_euclid(LOOP_SECONDS)
    } else {
        0.
    };
    let phase = t / LOOP_SECONDS * TAU;
    let press = smooth(4., 8., t) * (1. - smooth(20., 24., t));
    let lift = (200. + 4. * phase.sin()) * (1. - press);
    let detach_lift = (200. + 4. * (21.8 / LOOP_SECONDS * TAU).sin()) * smooth(20., 24., 21.8);
    let fall = ((t - 21.8) / 1.2).clamp(0., 1.);
    let drop_y = if t < 21.8 {
        CONTACT[1] - lift + 14.
    } else {
        CONTACT[1] - detach_lift + 14. + (detach_lift - 14.) * fall * fall
    };
    let stage = if t < 4. {
        Phase::InReflection
    } else if t < 8. {
        Phase::Approach
    } else if t < 15. {
        Phase::Unravel
    } else if t < 20. {
        Phase::Presence
    } else if t < 24. {
        Phase::Release
    } else if t < 27. {
        Phase::Settle
    } else {
        Phase::Return
    };
    Frame {
        time: t,
        phase,
        stage,
        press,
        lift,
        angle: -0.085 * phase.sin() * (1. - press) + 0.004 * (phase * 2.).sin() * press,
        ripple_age: (t - 8.).rem_euclid(LOOP_SECONDS),
        breath: 0.5 - 0.5 * (phase * 2.).cos(),
        world_presence: 1. - smooth(23.5, 24.5, t) + smooth(27., 32., t),
        front_radius: smooth(8., 15., t) * 1400. * (1. - smooth(24.5, 26.5, t)),
        drop_y,
        drop_alpha: smooth(20.45, 20.9, t) * (1. - smooth(22.95, 23.1, t)),
        drop_x: CONTACT[0],
        drop_stretch: 8. + 16. * smooth(20.45, 21.8, t) * (1. - smooth(22.2, 23., t)),
        secondary_age: (t - 23.).rem_euclid(LOOP_SECONDS),
        reset: smooth(26.5, 32., t),
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    pub paper: [f32; 3],
    pub ink: [f32; 3],
    pub highlight: [f32; 3],
    pub light: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MaterialSet {
    Dark,
    Light,
}

/// Texture selection follows the same authority as every product illustration.
pub fn material_set(code: u32) -> MaterialSet {
    if Palette::from_code(code).is_light() {
        MaterialSet::Light
    } else {
        MaterialSet::Dark
    }
}
fn rgb(v: u32) -> [f32; 3] {
    [
        ((v >> 16) & 255) as f32 / 255.,
        ((v >> 8) & 255) as f32 / 255.,
        (v & 255) as f32 / 255.,
    ]
}
pub fn look(code: u32) -> Look {
    let palette = Palette::from_code(code);
    if palette == Palette::Light {
        return Look {
            paper: rgb(0xFAE18F),
            ink: rgb(0x8E3A00),
            highlight: rgb(0xC9601E),
            light: palette.is_light(),
        };
    }
    if let Some(c) = palette.colors() {
        Look {
            paper: c.paper,
            ink: c.accent,
            highlight: c.highlight,
            light: palette.is_light(),
        }
    } else {
        Look {
            paper: [0.; 3],
            ink: rgb(0xF5DD07),
            highlight: rgb(0xF5DD07),
            light: palette.is_light(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: [f32; 2], b: [f32; 2]) {
        assert!(
            a.iter().zip(b).all(|(a, b)| (a - b).abs() < 0.001),
            "{a:?} != {b:?}"
        );
    }
    #[test]
    fn contact_and_reflection_share_the_exact_fingertip() {
        for t in [8., 9., STILL, 19., 20.] {
            let f = compose(t);
            assert_eq!(f.press, 1.);
            close(f.hand_point(SOURCE_TIP), CONTACT);
            close(f.reflected_point(SOURCE_TIP), CONTACT);
        }
        assert!(compose(0.).hand_point(SOURCE_TIP)[1] < CONTACT[1]);
        assert!(compose(0.).reflected_point(SOURCE_TIP)[1] > CONTACT[1]);
    }
    #[test]
    fn inverse_projection_is_finite_and_exact_throughout_cycle() {
        for n in 0..320 {
            let f = compose(n as f32 * 0.1);
            for p in [SOURCE_TIP, [0., 0.], [1536., 1024.], [1000., 500.]] {
                let q = f.hand_point(p);
                assert!(q.iter().all(|x| x.is_finite()));
                close(f.hand_source(q), p);
            }
        }
    }
    #[test]
    fn loop_clocks_and_seam_are_safe() {
        assert_eq!(compose(0.), compose(32.));
        assert_eq!(compose(0.), compose(f32::NAN));
        assert_eq!(compose(0.), compose(f32::INFINITY));
        for t in [0., 4., 8., 16., 24.] {
            assert_eq!(compose(t), compose(t + 64.));
        }
        let mut previous = compose(31.99);
        for i in 0..3200 {
            let f = compose(i as f32 * 0.01);
            for p in [SOURCE_TIP, [1000., 400.], [1536., 0.]] {
                let a = f.hand_point(p);
                let b = previous.hand_point(p);
                assert!((a[0] - b[0]).abs() < 1.4 && (a[1] - b[1]).abs() < 1.4);
            }
            assert!((0.0..=1.0).contains(&f.press));
            assert!((0.0..=32.0).contains(&f.ripple_age));
            previous = f;
        }
    }
    #[test]
    fn narrative_is_local_and_resets_only_while_world_is_absent() {
        for (t, stage) in [
            (0., Phase::InReflection),
            (5., Phase::Approach),
            (10., Phase::Unravel),
            (17., Phase::Presence),
            (21., Phase::Release),
            (25., Phase::Settle),
            (29., Phase::Return),
        ] {
            assert_eq!(compose(t).stage, stage);
        }
        assert!(compose(0.).lift >= 190.);
        assert_eq!(compose(8.).lift, 0.);
        let f = compose(10.);
        assert!(f.world_visibility_at(CONTACT) < 0.01);
        assert!(f.world_visibility_at([100., 800.]) > 0.99);
        for p in [[150., 490.], [1380., 860.], CONTACT] {
            assert!(compose(STILL).world_visibility_at(p) < 0.001);
        }
        assert_eq!(compose(25.5).world_presence, 0.);
        assert_eq!(compose(27.).front_radius, 0.);
        assert_eq!(compose(0.).world_visibility_at(CONTACT), 1.);
    }
    #[test]
    fn clinging_drop_falls_continuously_and_hits_before_second_wave() {
        let a = compose(21.799);
        let b = compose(21.801);
        assert!((a.drop_y - b.drop_y).abs() < 0.3);
        assert!(compose(22.5).drop_y > compose(22.).drop_y);
        assert_eq!(compose(23.).drop_y, CONTACT[1]);
        assert_eq!(compose(23.).secondary_age, 0.);
        assert_eq!(compose(24.).drop_alpha, 0.);
        for i in 0..320 {
            let f = compose(i as f32 * 0.1);
            for value in [f.world_presence, f.drop_alpha, f.reset] {
                assert!((0.0..=1.0).contains(&value));
            }
            assert!(f.drop_y.is_finite() && f.front_radius.is_finite());
        }
    }
    #[test]
    fn illustrated_material_sets_keep_all_three_light_themes_separate_from_dark() {
        // Public graphicsPalette codes: Искра, Дюна, Тишина, Астрал,
        // Матрица, Мираж, Рассвет. Theme order is part of the platform contract.
        for code in [1, 5, 6] {
            assert_eq!(material_set(code), MaterialSet::Light);
            assert!(look(code).light);
        }
        for code in [0, 2, 3, 4] {
            assert_eq!(material_set(code), MaterialSet::Dark);
            assert!(!look(code).light);
        }
        // Switching among themes of one class keeps the same GPU source pair.
        assert_eq!(material_set(1), material_set(5));
        assert_eq!(material_set(5), material_set(6));
        assert_eq!(material_set(0), material_set(3));
        assert_ne!(material_set(2), material_set(6));
    }
    #[test]
    fn all_themes_are_bounded_and_light_classification_matches_shared_palette() {
        for code in 0..=6 {
            let l = look(code);
            assert_eq!(l.light, Palette::from_code(code).is_light());
            for color in [l.paper, l.ink, l.highlight] {
                assert!(color.iter().all(|v| (0.0..=1.0).contains(v)));
            }
        }
    }
}
