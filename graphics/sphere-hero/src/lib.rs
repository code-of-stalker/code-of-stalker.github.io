//! «Скан в глубине», the hero of Step 5 «Внешнее кольцо». Art's painting in
//! four layers (the world, the reflection, the figure, the branch and bird)
//! seen by a camera that drifts a couple of degrees, so each layer moves by
//! its own depth. Every ten seconds a wave of light leaves the feet and
//! passes through the volume: the floor, the forest, the tree, the bird, the
//! orbits of the sphere. Every value here is a pure function of loop time;
//! `browser.rs` only uploads it and the shader paints it.
use std::f32::consts::{PI, TAU};
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::SphereHero;

/// The painting's canvas, in its own pixels (y down).
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
/// Three waves and one full camera drift.
pub const LOOP_SECONDS: f32 = 30.0;
pub const WAVE_SECONDS: f32 = 10.0;
/// The scene opens quiet; the first wave leaves the feet after this.
pub const FIRST_WAVE: f32 = 2.0;
/// Reduced motion: the ring has just left the feet and circles the figure
/// on the floor.
pub const STILL: f32 = FIRST_WAVE + 1.35;

/// Where the soles touch the floor.
pub const FEET: [f32; 2] = [772.0, 872.0];
/// The floor's vanishing row and focal length × eye height: a pixel at row
/// y below the horizon lies on the floor at depth `FLOOR_K / (y - HORIZON)`.
pub const HORIZON: f32 = 640.0;
pub const FLOOR_K: f32 = 1400.0;
/// The far rim of the floor; above it the wave climbs the forest.
pub const RIM: f32 = 700.0;
/// The base of the branch, its pivot when it sways.
pub const PIVOT: [f32; 2] = [140.0, 424.0];
/// The centre of the bird's call arcs.
pub const BIRD: [f32; 2] = [1028.0, 244.0];
/// The river's bend: centre and radii.
pub const RIVER: [f32; 4] = [1120.0, 525.0, 120.0, 50.0];
/// The sphere's outline: centre and radii.
pub const SPHERE: [f32; 4] = [762.0, 500.0, 640.0, 500.0];

/// Seconds after the wave leaves the feet: the floor ring starts, and its
/// speed over the floor in floor units (eye heights) per second.
pub const FLOOR_START: f32 = 0.3;
pub const FLOOR_SPEED: f32 = 8.2;
/// How fast the front climbs the forest and mountains, px per second.
pub const CLIMB_SPEED: f32 = 250.0;
/// The light runs up the branch from its base to its tip.
pub const TREE_START: f32 = 3.3;
pub const TREE_SPAN: f32 = 1.1;
pub const TREE_LENGTH: f32 = 700.0;
/// The bird answers with its call.
pub const BIRD_CALL: f32 = 4.1;
/// The light runs up the sphere's shell from the floor to its crown.
pub const SHELL_START: f32 = 4.4;
pub const SHELL_SPAN: f32 = 2.0;
/// The light rises through the body from the soles to the crown.
pub const BODY_START: f32 = 0.05;
pub const BODY_SPAN: f32 = 0.9;
/// After this, nothing of a wave is left on screen.
pub const WAVE_QUIET: f32 = 8.8;

/// The geometry and timing above as the shader's `u_geo` array.
pub const GEOMETRY: [f32; 28] = [
    FEET[0],
    FEET[1],
    HORIZON,
    FLOOR_K,
    RIM,
    FLOOR_START,
    FLOOR_SPEED,
    CLIMB_SPEED,
    PIVOT[0],
    PIVOT[1],
    TREE_START,
    TREE_SPAN / TREE_LENGTH,
    BIRD[0],
    BIRD[1],
    BIRD_CALL,
    0.0,
    RIVER[0],
    RIVER[1],
    RIVER[2],
    RIVER[3],
    SPHERE[0],
    SPHERE[1],
    SPHERE[2],
    SPHERE[3],
    SHELL_START,
    SHELL_SPAN,
    BODY_START,
    BODY_SPAN,
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    /// Seconds since the current wave left the feet.
    pub wave: f32,
    /// The camera's offset from rest, -1..1 on each axis.
    pub drift: [f32; 2],
    /// The branch's angle about its base, radians.
    pub sway: f32,
    /// How much the leaves flutter, 0..1.
    pub flutter: f32,
    /// The bird's lift, art px.
    pub bob: f32,
    /// The loop's phase, 0..TAU, for the ambient cycles.
    pub phase: f32,
}

/// Seconds since the wave that is on screen at `t` left the feet.
pub fn wave_time(t: f32) -> f32 {
    (t - FIRST_WAVE).rem_euclid(WAVE_SECONDS)
}

/// The branch's answer to one wave, `s` seconds after the light reaches it:
/// a push that rings out long before the next wave.
fn kick(s: f32) -> f32 {
    if s <= 0.0 {
        return 0.0;
    }
    0.024 * (1.0 - (-s / 0.12).exp()) * (-s / 1.15).exp() * (TAU * s / 1.4).sin()
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let phase = time / LOOP_SECONDS * TAU;
    let wave = wave_time(time);
    // The current wave and the one before it, so the sway never jumps when
    // the next wave starts.
    let since = wave - TREE_START;
    let push = kick(since) + kick(since + WAVE_SECONDS);
    let breeze = 0.006 * (phase * 3.0).sin() + 0.004 * (phase * 5.0 + 1.0).sin();
    let stir = |s: f32| if s > 0.0 { (-s / 1.4).exp() } else { 0.0 };
    Frame {
        time,
        wave,
        drift: [phase.sin(), 0.45 * (2.0 * phase + 0.9).sin()],
        sway: breeze + push,
        flutter: 0.3 + 0.7 * (stir(since) + stir(since + WAVE_SECONDS)).min(1.0),
        bob: 2.5 * (phase * 6.0).sin(),
        phase,
    }
}

/// Where a floor pixel lies on the floor: across and away from the eye,
/// in eye heights.
fn ground(x: f32, y: f32) -> [f32; 2] {
    let z = FLOOR_K / (y - HORIZON).max(1.0);
    [(x - SIZE[0] * 0.5) * z / FLOOR_K, z]
}

/// When the wave reaches a pixel of the world layer: across the floor from
/// the feet, then up the forest above the rim. The shader's `world_arrival`.
pub fn world_arrival(x: f32, y: f32) -> f32 {
    let [gx, gz] = ground(x, y.max(RIM));
    let [fx, fz] = ground(FEET[0], FEET[1]);
    let across = ((gx - fx).powi(2) + (gz - fz).powi(2)).sqrt();
    FLOOR_START + across / FLOOR_SPEED + (RIM - y).max(0.0) / CLIMB_SPEED
}

/// When the light reaches a pixel of the branch: from its base to its tip.
pub fn tree_arrival(x: f32, y: f32) -> f32 {
    let r = ((x - PIVOT[0]).powi(2) + (y - PIVOT[1]).powi(2)).sqrt();
    TREE_START + r * TREE_SPAN / TREE_LENGTH
}

/// When the light passes a point of the sphere's shell: up both sides from
/// the floor to the crown.
pub fn shell_arrival(x: f32, y: f32) -> f32 {
    let dx = (x - SPHERE[0]) / SPHERE[2];
    let dy = (y - SPHERE[1]) / SPHERE[3];
    SHELL_START + dx.abs().atan2(dy) / PI * SHELL_SPAN
}

/// When the light passes a row of the body.
pub fn body_arrival(y: f32) -> f32 {
    BODY_START + (FEET[1] - y) / 700.0 * BODY_SPAN
}

/// How one theme lights the wave.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// Drawn from Art's light paintings: the wave inks the page instead of
    /// lighting it.
    pub light: bool,
    /// Dark themes: the light the wave adds, in the painting's own green
    /// (the theme's recolor maps it). Light themes: the ink it multiplies in.
    pub glow: [f32; 3],
}

const GREEN: [f32; 3] = [0.56, 1.0, 0.62];
/// Дюна's soft sepia: the light paintings' own shadow ink, never orange.
const SEPIA: [f32; 3] = [0.74, 0.46, 0.27];

/// The app theme by its `graphicsPalette` code (0 Искра … 6 Рассвет).
/// Light themes draw the light paintings; Мираж and Рассвет then map them
/// to their own inks, so all three ink the same sepia here.
pub fn look(code: u32) -> Look {
    if Palette::from_code(code).is_light() {
        Look {
            light: true,
            glow: SEPIA,
        }
    } else {
        Look {
            light: false,
            glow: GREEN,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    #[test]
    fn the_loop_closes_without_a_jump() {
        let first = compose(0.0);
        let last = compose(LOOP_SECONDS);
        assert_eq!(first, last);
        let before = compose(LOOP_SECONDS - 0.001);
        let after = compose(0.001);
        for (a, b) in [
            (before.drift[0], after.drift[0]),
            (before.drift[1], after.drift[1]),
            (before.sway, after.sway),
            (before.flutter, after.flutter),
            (before.bob, after.bob),
        ] {
            assert!(close(a, b, 0.01), "{a} {b}");
        }
    }

    #[test]
    fn nothing_jumps_when_the_next_wave_starts() {
        for k in 0..3 {
            let start = FIRST_WAVE + k as f32 * WAVE_SECONDS;
            let before = compose(start - 0.001);
            let after = compose(start + 0.001);
            assert!(close(before.sway, after.sway, 0.0005));
            assert!(close(before.flutter, after.flutter, 0.002));
            assert!(before.wave > WAVE_SECONDS - 0.01 && after.wave < 0.01);
        }
    }

    #[test]
    fn a_wave_is_gone_before_the_next_one() {
        let latest = [
            world_arrival(0.0, 0.0),
            world_arrival(SIZE[0], 0.0),
            tree_arrival(SIZE[0], 0.0),
            shell_arrival(SPHERE[0], 0.0),
            BIRD_CALL + 2.0,
        ];
        for t in latest {
            // The afterglow fades over 2.2 s and the river glints for 2.4 s.
            assert!(t + 2.4 <= WAVE_QUIET, "{t}");
        }
        const { assert!(WAVE_QUIET < WAVE_SECONDS) };
    }

    #[test]
    fn the_wave_passes_floor_forest_tree_bird_then_orbits() {
        let floor_at_feet = world_arrival(FEET[0], FEET[1] + 40.0);
        let floor_at_rim = world_arrival(FEET[0], RIM + 1.0);
        let forest = world_arrival(RIVER[0], RIVER[1]);
        let tree_base = tree_arrival(PIVOT[0] + 40.0, PIVOT[1]);
        let tree_tip = tree_arrival(776.0, 10.0);
        let orbit_side = shell_arrival(SPHERE[0] - SPHERE[2], SPHERE[1]);
        let orbit_crown = shell_arrival(SPHERE[0], SPHERE[1] - SPHERE[3]);
        let order = [
            body_arrival(FEET[1]),
            floor_at_feet,
            floor_at_rim,
            forest,
            tree_base,
            BIRD_CALL,
            orbit_side,
            orbit_crown,
        ];
        assert!(order.windows(2).all(|w| w[0] < w[1]), "{order:?}");
        assert!(tree_tip > tree_base && tree_tip < orbit_crown);
    }

    #[test]
    fn the_floor_ring_spreads_outward_from_the_feet() {
        let feet = world_arrival(FEET[0], FEET[1]);
        assert!(close(feet, FLOOR_START, 1e-4));
        for (x, y) in [
            (200.0, 900.0),
            (1400.0, 1000.0),
            (772.0, 760.0),
            (772.0, 1020.0),
        ] {
            assert!(world_arrival(x, y) > feet);
        }
        // Higher on the forest means later.
        assert!(world_arrival(900.0, 500.0) > world_arrival(900.0, 650.0));
    }

    #[test]
    fn the_branch_rings_out_and_rests_between_waves() {
        let calm = compose(FIRST_WAVE + 1.0);
        let pushed = (0..40)
            .map(|i| {
                compose(FIRST_WAVE + TREE_START + i as f32 * 0.05)
                    .sway
                    .abs()
            })
            .fold(0.0, f32::max);
        assert!(pushed > calm.sway.abs() + 0.01);
        assert!(calm.flutter < 0.35);
        assert!(compose(FIRST_WAVE + TREE_START + 0.3).flutter > 0.8);
    }

    #[test]
    fn values_stay_finite_and_small() {
        for i in 0..=3000 {
            let f = compose(i as f32 * 0.01);
            assert!(f.drift.iter().all(|v| v.is_finite() && v.abs() <= 1.0));
            assert!(f.sway.is_finite() && f.sway.abs() < 0.04);
            assert!((0.0..=1.0).contains(&f.flutter));
            assert!(f.wave >= 0.0 && f.wave < WAVE_SECONDS);
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
    }

    #[test]
    fn the_still_shows_the_ring_around_the_figure() {
        let f = compose(STILL);
        let reach = (f.wave - FLOOR_START) * FLOOR_SPEED;
        assert!(reach > 2.0 && reach < 14.0, "{reach}");
    }

    #[test]
    fn every_theme_has_a_look_and_light_themes_ink() {
        for code in 0..7 {
            let l = look(code);
            assert_eq!(l.light, Palette::from_code(code).is_light());
            assert!(l.glow.iter().all(|c| (0.0..=1.0).contains(c)));
            if l.light {
                // An ink never lightens: multiplying by it only darkens.
                assert!(l.glow.iter().all(|c| *c < 1.0));
            }
        }
        assert!(!look(255).light);
    }
}
