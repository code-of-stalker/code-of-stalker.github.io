//! Icon scenes, direction «Характер» (Art 2026-11-11, Telegram as the model):
//! every pressable glyph plays its own short scene on a tap. The arrow steps back,
//! the cross turns, the settings knobs swap, the bin lifts its lid, play flows
//! into pause. This module is the pure timeline: geometry and per-part poses for a
//! time in seconds. `icon_dom.rs` writes the poses onto the browser's SVG nodes.

/// One stroke of a glyph. `fill` parts are solid dots (filter drop, stairs hopper).
#[derive(Clone, Copy, Debug)]
pub struct Part {
    pub d: &'static str,
    pub fill: bool,
}
const fn line(d: &'static str) -> Part {
    Part { d, fill: false }
}
const fn dot(d: &'static str) -> Part {
    Part { d, fill: true }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Scene {
    Back,
    Turn,
    Settings,
    Notes,
    Trash,
    Playback,
    Send,
    Nudge,
    Plus,
    Filter,
    Bookmark,
    Sound,
    Expand,
    Stairs,
    Pop,
    Rewind,
    Forward,
    Squash,
    Nod,
    Lock,
}

#[derive(Clone, Copy, Debug)]
pub struct Glyph {
    pub view: [f32; 4],
    pub parts: &'static [Part],
    pub scene: Scene,
    /// Scene origin (turns, squashes) in view units.
    pub origin: [f32; 2],
}

pub const PLAY: [[f32; 2]; 4] = [[7., 4.], [20., 12.], [20., 12.], [7., 20.]];
pub const PLAY_TAIL: [[f32; 2]; 4] = [[20., 12.]; 4];
pub const PAUSE: [[f32; 2]; 4] = [[8., 5.], [8., 5.], [8., 19.], [8., 19.]];
pub const PAUSE_TAIL: [[f32; 2]; 4] = [[16., 5.], [16., 5.], [16., 19.], [16., 19.]];
const SQUARE: [f32; 4] = [0., 0., 24., 24.];
const BUTTON: [f32; 4] = [0., 0., 44., 42.];

/// App glyph names (the bridge's `name`) to their geometry and scene. The paths are
/// the approved ones from `ui.tsx`, `DiaryIcons.tsx`, `ObservationControls.tsx` and
/// `assets/product/*-glyph.svg`, split into the strokes a scene moves.
pub fn glyph(name: &str) -> Option<Glyph> {
    // Inline consts keep each glyph table in static memory.
    macro_rules! g {
        ($view:expr, $parts:expr, $scene:expr, $origin:expr $(,)?) => {
            Some(
                const {
                    Glyph {
                        view: $view,
                        parts: $parts,
                        scene: $scene,
                        origin: $origin,
                    }
                },
            )
        };
    }
    match name {
        "back-button" => g!(BUTTON, &[line("M30 21L14 21"), line("M17.2 18L14 21L17.2 24")], Scene::Back, [14., 21.]),
        "close-button" => g!(BUTTON, &[line("M14 13L30 29"), line("M14 29L30 13")], Scene::Turn, [22., 21.]),
        "close" => g!(SQUARE, &[line("M6 6l12 12"), line("M18 6 6 18")], Scene::Turn, [12., 12.]),
        "settings" => g!(
            SQUARE,
            &[line("M14 17H5"), line("M19 7H10"), line("M14 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0"), line("M4 7a3 3 0 1 0 6 0a3 3 0 1 0-6 0")],
            Scene::Settings,
            [12., 12.],
        ),
        "notes" => g!(
            SQUARE,
            &[
                line("M7 3H17a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"),
                line("M8 3v18"),
                line("M3 7h4M3 11h4M3 15h4M3 19h4"),
                line("M11 8h5"),
                line("M11 12h5"),
                line("M11 16h3"),
            ],
            Scene::Notes,
            [12., 12.],
        ),
        "trash" => g!(SQUARE, &[line("M3 6h18M9 6V3h6v3"), line("M6 6l1 15h10l1-15"), line("M10 10v7m4-7v7")], Scene::Trash, [3., 6.]),
        // Play and pause are one glyph: the bridge morphs between them.
        "play" | "pause" => g!(SQUARE, &[line(""), line("")], Scene::Playback, [12., 12.]),
        "send" => g!(SQUARE, &[line("M4 12h16m-6-6 6 6-6 6")], Scene::Send, [12., 12.]),
        "arrow" => g!(SQUARE, &[line("M3 12h18m-7-7 7 7-7 7")], Scene::Nudge, [12., 12.]),
        "plus" => g!(SQUARE, &[line("M4 12h16M12 4v16")], Scene::Plus, [12., 12.]),
        "filter" => g!(SQUARE, &[line("M3 4h18l-7 8v7l-4 2v-9Z"), dot("M11.1 22.6a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0-1.8 0")], Scene::Filter, [12., 12.]),
        "bookmark" => g!(SQUARE, &[line("M6 3h12v18l-6-4-6 4Z")], Scene::Bookmark, [12., 12.]),
        "sound" => g!(SQUARE, &[line("M3 9h4l5-5v16l-5-5H3Z"), line("M16 8c2 2 2 6 0 8"), line("M19 5c4 4 4 10 0 14")], Scene::Sound, [7.5, 12.]),
        "expand" => g!(SQUARE, &[line("M4 9V4h5"), line("M15 4h5v5"), line("M20 15v5h-5"), line("M9 20H4v-5")], Scene::Expand, [12., 12.]),
        "stairs" => g!(SQUARE, &[line("M3 20v-6h6V9h6V4h6v16ZM9 14v6m6-11v11"), dot("M4.9 12.4a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0")], Scene::Stairs, [12., 12.]),
        "stop" => g!(SQUARE, &[line("M6 6h12v12H6Z")], Scene::Pop, [12., 12.]),
        "rewind" => g!(SQUARE, &[line("M11 5 3 12l8 7Z"), line("M21 5l-8 7 8 7Z")], Scene::Rewind, [12., 12.]),
        "fastForward" => g!(SQUARE, &[line("M3 5l8 7-8 7Z"), line("M13 5l8 7-8 7Z")], Scene::Forward, [12., 12.]),
        "lips" => g!(
            [104., 91., 32., 32.],
            &[line("M105 105c5-2 9-9 15-5 6-4 10 3 15 5-4 5-8 10-15 10s-11-5-15-10ZM105 105c6 2 10-2 15 0 5-2 9 2 15 0M110 105c3 2 7 3 10 3s7-1 10-3")],
            Scene::Squash,
            [120., 107.],
        ),
        "waveform" => g!(SQUARE, &[line("M3 10v4m3-7v10m3-13v16m3-11v6m3-12v18m3-14v10m3-7v4")], Scene::Squash, [12., 12.]),
        "chevron" => g!(SQUARE, &[line("m5 9 7 7 7-7")], Scene::Nod, [12., 12.]),
        "lock" => g!(SQUARE, &[line("M7 10V7a5 5 0 0 1 10 0v3"), line("M4 10h16v11H4zM12 14v3")], Scene::Lock, [12., 12.]),
        _ => None,
    }
}

/// A damped spring from 0 to 1 (unit mass), the feel of Telegram's icon settle.
#[derive(Clone, Copy, Debug)]
pub struct Spring {
    pub stiffness: f32,
    pub damping: f32,
}
pub const SOFT: Spring = Spring {
    stiffness: 300.,
    damping: 16.,
};
pub const WOBBLY: Spring = Spring {
    stiffness: 260.,
    damping: 9.,
};
pub const SWAP: Spring = Spring {
    stiffness: 280.,
    damping: 17.,
};
pub const MORPH: Spring = Spring {
    stiffness: 420.,
    damping: 22.,
};
impl Spring {
    pub fn at(self, t: f32) -> f32 {
        if t <= 0. {
            return 0.;
        }
        let w = self.stiffness.sqrt();
        let zeta = self.damping / (2. * w);
        if zeta >= 1. {
            return 1. - (1. + w * t) * (-w * t).exp();
        }
        let wd = w * (1. - zeta * zeta).sqrt();
        1. - (-zeta * w * t).exp() * ((wd * t).cos() + zeta * w / wd * (wd * t).sin())
    }
    /// Time after which the spring stays within 0.2 % of rest.
    pub fn settle(self) -> f32 {
        let w = self.stiffness.sqrt();
        let decay = (self.damping / 2.).min(w);
        (500f32).ln() / decay
    }
}

fn clamp01(v: f32) -> f32 {
    v.clamp(0., 1.)
}
fn ease_out(v: f32) -> f32 {
    1. - (1. - clamp01(v)).powi(3)
}
fn ease_in(v: f32) -> f32 {
    clamp01(v).powi(3)
}
/// A press: eases out to 1 over `lead`, then springs back to 0 (overshooting past it).
fn tap(t: f32, lead: f32, spring: Spring) -> f32 {
    if t < lead {
        ease_out(t / lead)
    } else {
        1. - spring.at(t - lead)
    }
}
/// Starts at 1 and springs to rest at 0.
fn settle(t: f32, spring: Spring) -> f32 {
    1. - spring.at(t)
}

#[derive(Clone, Debug, PartialEq)]
pub struct Pose {
    pub tx: f32,
    pub ty: f32,
    pub rotate: f32,
    pub sx: f32,
    pub sy: f32,
    pub origin: [f32; 2],
    pub opacity: f32,
    /// Drawn share of the stroke, for parts that write themselves in.
    pub drawn: Option<(f32, f32)>,
    /// Replacement outline for morphing parts.
    pub d: Option<String>,
}
impl Pose {
    pub fn rest(origin: [f32; 2]) -> Self {
        Self {
            tx: 0.,
            ty: 0.,
            rotate: 0.,
            sx: 1.,
            sy: 1.,
            origin,
            opacity: 1.,
            drawn: None,
            d: None,
        }
    }
    pub fn transform(&self) -> String {
        let [ox, oy] = self.origin;
        format!(
            "translate({:.3} {:.3}) translate({ox} {oy}) rotate({:.3}) scale({:.4} {:.4}) translate({} {})",
            self.tx, self.ty, self.rotate, self.sx, self.sy, -ox, -oy
        )
    }
}

pub fn polygon(points: &[[f32; 2]; 4]) -> String {
    let [a, b, c, d] = points;
    format!(
        "M{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}Z",
        a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]
    )
}
fn mix(a: &[[f32; 2]; 4], b: &[[f32; 2]; 4], k: f32) -> [[f32; 2]; 4] {
    let mut out = *a;
    for (o, (p, q)) in out.iter_mut().zip(a.iter().zip(b)) {
        *o = [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
    }
    out
}
/// Play (0) to pause (1) outline, both strokes.
pub fn playback(k: f32) -> [String; 2] {
    [
        polygon(&mix(&PLAY, &PAUSE, k)),
        polygon(&mix(&PLAY_TAIL, &PAUSE_TAIL, k)),
    ]
}

/// How long a tap scene runs, in seconds.
pub fn duration(scene: Scene) -> f32 {
    match scene {
        Scene::Settings => 0.45 + SWAP.settle(),
        Scene::Trash => 0.95,
        Scene::Sound => 1.6,
        Scene::Stairs => 1.2,
        Scene::Send => 0.18 + SOFT.settle(),
        Scene::Back
        | Scene::Filter
        | Scene::Expand
        | Scene::Bookmark
        | Scene::Nudge
        | Scene::Nod
        | Scene::Lock => 0.16 + WOBBLY.settle(),
        Scene::Rewind | Scene::Forward => 0.2 + WOBBLY.settle(),
        Scene::Squash => 0.12 + WOBBLY.settle(),
        Scene::Notes => (0.72f32).max(WOBBLY.settle()),
        Scene::Turn | Scene::Pop => WOBBLY.settle(),
        Scene::Playback | Scene::Plus => SOFT.settle(),
    }
}

/// The pose of part `index` of `glyph`, `t` seconds into its tap scene.
pub fn pose(glyph: &Glyph, index: usize, t: f32) -> Pose {
    let mut p = Pose::rest(glyph.origin);
    let u = glyph.view[2] / 24.;
    match glyph.scene {
        Scene::Back => {
            let k = tap(t, 0.16, WOBBLY);
            p.tx = -3. * u * k;
            if index == 1 {
                p.sx = 1. + 0.15 * k;
                p.sy = p.sx;
            }
        }
        Scene::Turn => {
            let k = settle(t, WOBBLY);
            p.rotate = -90. * k;
            p.sx = 1. - 0.45 * k;
            p.sy = p.sx;
        }
        Scene::Plus => {
            let k = settle(t, SOFT);
            p.rotate = -180. * k;
            p.sx = 1. - 0.4 * k;
            p.sy = p.sx;
        }
        Scene::Settings => {
            let k = SWAP.at(t) - SWAP.at(t - 0.45);
            match index {
                0 => p.d = Some(format!("M{:.3} 17H{:.3}", 14. - 4. * k, 5. + 14. * k)),
                1 => p.d = Some(format!("M{:.3} 7H{:.3}", 19. - 14. * k, 10. + 4. * k)),
                2 => p.tx = -10. * k,
                _ => p.tx = 10. * k,
            }
        }
        Scene::Notes => {
            if index >= 3 {
                let start = 0.12 + (index - 3) as f32 * 0.15;
                let length = if index == 5 { 3. } else { 5. };
                p.drawn = Some((ease_out((t - start) / 0.22), length));
            }
            let k = settle(t, WOBBLY);
            p.rotate = -8. * k;
            p.sx = 1. - 0.1 * k;
            p.sy = p.sx;
            p.origin = [12., 12.];
        }
        Scene::Trash => {
            let open = if t < 0.2 {
                ease_out(t / 0.2)
            } else if t < 0.36 {
                1.
            } else {
                1. - ease_in((t - 0.36) / 0.14)
            };
            let after = t - 0.5;
            match index {
                0 => {
                    p.ty = -2.5 * open;
                    p.rotate = -24. * open;
                    if after > 0. && after < 0.22 {
                        p.ty -= (std::f32::consts::PI * after / 0.22).sin();
                    }
                }
                _ => {
                    p.origin = [12., 21.];
                    if after > 0. {
                        p.rotate = -5. * (-after * 8.).exp() * (after * 30.).sin();
                    }
                }
            }
        }
        Scene::Playback => {
            let k = settle(t, SOFT);
            p.sx = 1. - 0.15 * k;
            p.sy = p.sx;
        }
        Scene::Send => {
            if t < 0.18 {
                p.tx = 14. * ease_in(t / 0.18);
                p.opacity = 1. - t / 0.18;
            } else {
                p.tx = -14. * settle(t - 0.18, SOFT);
                p.opacity = clamp01((t - 0.18) / 0.15);
            }
        }
        Scene::Nudge => p.tx = 4. * tap(t, 0.14, WOBBLY),
        Scene::Nod => p.ty = 3. * tap(t, 0.14, WOBBLY),
        Scene::Filter => {
            if index == 0 {
                let k = tap(t, 0.15, WOBBLY);
                p.sy = 1. - 0.2 * k;
                p.sx = 1. + 0.06 * k;
            } else {
                let d = (t - 0.15) / 0.52;
                p.opacity = if d <= 0. || d >= 1. {
                    0.
                } else if d < 0.3 {
                    d / 0.3
                } else {
                    1. - (d - 0.3) / 0.7
                };
                p.ty = -2. + 5. * ease_in(d);
            }
        }
        Scene::Bookmark => p.ty = -3. * tap(t, 0.13, WOBBLY),
        Scene::Sound => {
            if index == 0 {
                let k = settle(t, WOBBLY);
                p.sx = 1. - 0.15 * k;
                p.sy = p.sx;
            } else {
                let local = t - (index - 1) as f32 * 0.13;
                let k = if local < 0. {
                    0.
                } else if local < 1.4 {
                    ease_out((local % 0.7) / 0.35)
                } else {
                    1.
                };
                p.opacity = k;
                p.tx = -3. * (1. - k);
            }
        }
        Scene::Expand => {
            let k = 1.6 * tap(t, 0.15, WOBBLY);
            let [dx, dy] = [[1., 1.], [-1., 1.], [-1., -1.], [1., -1.]][index.min(3)];
            p.tx = dx * k;
            p.ty = dy * k;
        }
        Scene::Stairs => {
            if index == 1 {
                let keys: [(f32, f32, f32); 6] = [
                    (0., 0., 0.),
                    (0.08, 0., 0.),
                    (0.22, 3., -6.),
                    (0.34, 6., -5.),
                    (0.5, 9., -11.),
                    (0.62, 12., -10.),
                ];
                let s = t / 1.2;
                let mut at = (12., -10.);
                for w in keys.windows(2) {
                    if s >= w[0].0 && s < w[1].0 {
                        let k = (s - w[0].0) / (w[1].0 - w[0].0);
                        let k = if w[1].2 < w[0].2 {
                            ease_out(k)
                        } else {
                            ease_in(k)
                        };
                        at = (
                            w[0].1 + (w[1].1 - w[0].1) * k,
                            w[0].2 + (w[1].2 - w[0].2) * k,
                        );
                    }
                }
                if s < keys[0].0 {
                    at = (0., 0.);
                }
                p.tx = at.0;
                p.ty = at.1;
                p.opacity = if s < 0.08 {
                    s / 0.08
                } else if s < 0.85 {
                    1.
                } else {
                    clamp01((1. - s) / 0.15)
                };
            }
        }
        Scene::Pop => {
            let k = settle(t, WOBBLY);
            p.sx = 1. - 0.4 * k;
            p.sy = p.sx;
        }
        Scene::Rewind | Scene::Forward => {
            let lag = if (glyph.scene == Scene::Rewind) == (index == 1) {
                0.06
            } else {
                0.
            };
            let dir = if glyph.scene == Scene::Rewind {
                -1.
            } else {
                1.
            };
            p.tx = dir * 3. * tap((t - lag).max(0.), 0.14, WOBBLY);
        }
        Scene::Squash => {
            let k = tap(t, 0.12, WOBBLY);
            p.sy = 1. - 0.32 * k;
            p.sx = 1. + 0.06 * k;
        }
        Scene::Lock => {
            if index == 0 {
                p.ty = -2. * tap(t, 0.15, WOBBLY);
            }
        }
    }
    p
}

/// The pose when no scene runs: the approved still glyph.
pub fn still(glyph: &Glyph, index: usize) -> Pose {
    let mut p = Pose::rest(glyph.origin);
    let part = glyph.parts[index];
    if part.fill {
        p.opacity = 0.;
    }
    // Morphing parts return to their exact approved outline.
    if !part.d.is_empty() {
        p.d = Some(part.d.to_string());
    }
    p
}

#[cfg(test)]
mod tests {
    use super::*;
    const NAMES: [&str; 23] = [
        "back-button",
        "close-button",
        "close",
        "settings",
        "notes",
        "trash",
        "play",
        "pause",
        "send",
        "arrow",
        "plus",
        "filter",
        "bookmark",
        "sound",
        "expand",
        "stairs",
        "stop",
        "rewind",
        "fastForward",
        "lips",
        "waveform",
        "chevron",
        "lock",
    ];
    fn near(a: &Pose, b: &Pose) -> bool {
        (a.tx - b.tx).abs() < 0.05
            && (a.ty - b.ty).abs() < 0.05
            && (a.rotate - b.rotate).abs() < 0.2
            && (a.sx - b.sx).abs() < 0.01
            && (a.sy - b.sy).abs() < 0.01
            && (a.opacity - b.opacity).abs() < 0.02
    }
    #[test]
    fn every_app_glyph_has_a_scene() {
        for name in NAMES {
            assert!(glyph(name).is_some(), "{name}");
        }
        assert!(glyph("unknown").is_none());
    }
    #[test]
    fn scenes_start_and_end_on_the_still_glyph() {
        for name in NAMES {
            let g = glyph(name).unwrap();
            let end = duration(g.scene);
            for i in 0..g.parts.len() {
                let rest = still(&g, i);
                let done = pose(&g, i, end);
                let done_rest = if g.parts[i].fill {
                    Pose {
                        opacity: 0.,
                        ..done.clone()
                    }
                } else {
                    done.clone()
                };
                assert!(
                    near(&done_rest, &rest) || g.parts[i].fill,
                    "{name} part {i} ends at {done:?}"
                );
                if let Some((drawn, _)) = done.drawn {
                    assert!(
                        (drawn - 1.).abs() < 1e-3,
                        "{name} part {i} is not fully written"
                    );
                }
            }
        }
    }
    #[test]
    fn scenes_actually_move() {
        for name in NAMES {
            let g = glyph(name).unwrap();
            let moved = (0..g.parts.len()).any(|i| {
                (1..40).any(|f| {
                    !near(&pose(&g, i, f as f32 * 0.02), &Pose::rest(g.origin))
                        || pose(&g, i, f as f32 * 0.02).d.is_some()
                })
            });
            assert!(moved, "{name} has no visible motion");
        }
    }
    #[test]
    fn springs_overshoot_and_settle() {
        assert!(
            (0..200).any(|f| WOBBLY.at(f as f32 * 0.005) > 1.05),
            "a Telegram settle overshoots"
        );
        assert!((WOBBLY.at(WOBBLY.settle()) - 1.).abs() < 0.003);
        assert!((SOFT.at(SOFT.settle()) - 1.).abs() < 0.003);
        assert_eq!(SOFT.at(0.), 0.);
    }
    #[test]
    fn settings_swap_returns_to_the_approved_lines() {
        let g = glyph("settings").unwrap();
        let end = duration(g.scene);
        assert_eq!(still(&g, 0).d.unwrap(), "M14 17H5");
        assert_eq!(still(&g, 1).d.unwrap(), "M19 7H10");
        let near_end = pose(&g, 0, end).d.unwrap();
        assert!(
            near_end.starts_with("M14.0") || near_end.starts_with("M13.9"),
            "{near_end}"
        );
        let middle = pose(&g, 2, 0.4);
        assert!(middle.tx < -9., "knob slides across: {}", middle.tx);
    }
    #[test]
    fn playback_morph_ends_on_play_and_pause() {
        assert_eq!(playback(0.)[0], polygon(&PLAY));
        assert_eq!(playback(1.)[1], polygon(&PAUSE_TAIL));
    }
}
