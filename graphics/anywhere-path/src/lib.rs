//! «Сквозной путь», page 10 of Step 6 «Внутреннее кольцо» («Пробуй в любой
//! среде»). One unbroken journey, drawn as a living engraving: pale hatching
//! on the dark page. He sets out across an open field at night, goes into a
//! house and looks out of the window as the train passes, sits at the table
//! opposite the one who lives there, goes out of the back door to the
//! station and up onto the platform among the crowd, rides the train round
//! (the country streaming past), gets off at the lake and stands at the end
//! of the pier in silence, meets a friend on the shore and walks with her
//! along the street talking, and comes back alone across the field to where
//! he set out. The camera hangs over his shoulder, cuts where the place
//! changes and looks through his eyes at the window, in the car and at the
//! moon.
//!
//! The beats, phrase by phrase:
//! «Пробуй делать эту практику в любой среде: …» the journey through the
//! seven places, his sphere and its two rings with him everywhere.
//! «Позволь телу запомнить …» on the way home the camera comes close; the
//! warm ring climbs him and leaves him lit, and in the light the places show
//! in him as traces (the grass, the window's bars, the table, the crowd's
//! ticks, the train's streaks, the water's ripples, the street's waves); his
//! hatching trembles to the wind, the crowd and the wheels.
//! «Перепроверяй себя …» the camera rises over the whole ring; his route is
//! drawn as one closed line, his sphere grows over the world, the cold ring
//! lays itself round everything and the world melts into code round him.
//! Then the night field comes back and the loop starts again.
//!
//! Every value here is a pure function of loop time; `browser.rs` uploads
//! it and `scene.frag` draws it.
pub mod act;
pub mod body;
pub mod camera;
pub mod math;
pub mod place;
pub mod scenery;
pub mod story;

#[cfg(target_arch = "wasm32")]
mod browser;

use camera::{smoothed, Camera, View};
use math::{mix, smooth, v3, window, V3};
use std::f32::consts::{PI, TAU};
use story::{Figure, Story};
use watcher_scene_palette::Palette;

pub use story::FIGS;

pub const LOOP: f32 = 145.0;

/// The data texture: one row of cones per figure.
pub const FIG_TEXELS: usize = 3 * body::PRIMITIVES;
pub const DATA_W: usize = FIG_TEXELS;

/// The uniform slots `pack` fills (`u_d`).
pub const EYE: usize = 0;
pub const RIGHT: usize = 1;
pub const UP: usize = 2;
pub const FWD: usize = 3;
pub const MOON: usize = 5;
pub const TRAIN: usize = 6;
pub const SPHERE: usize = 7;
pub const RINGS: usize = 8;
pub const RINGFX: usize = 9;
pub const HEROP: usize = 10;
pub const FX: usize = 11;
pub const MEM: usize = 12;
pub const MEM2: usize = 13;
pub const LAMPS: usize = 14;
pub const ROUTE: usize = 16;
pub const ROUTE_N: usize = 64;
pub const SLOTS: usize = ROUTE + ROUTE_N;

/// The warm ring's radius about him (body metres).
pub const WARM_RADIUS: f32 = 0.42;
/// The sphere and the cold ring in the finale: over the whole world.
pub const WORLD_RADIUS: f32 = 26.5;
/// How far the world has melted into code at most.
pub const MELT: f32 = 48.0;

/// One moment of the scene.
#[derive(Clone, Debug)]
pub struct Frame {
    pub t: f32,
    pub view: View,
    pub figures: Vec<Figure>,
    pub train: [f32; 4],
    pub sphere: [f32; 4],
    pub rings: [f32; 4],
    pub ringfx: [f32; 4],
    pub fx: [f32; 4],
    pub mem: [f32; 4],
    pub mem2: [f32; 4],
}

pub struct Scene {
    pub story: Story,
    pub camera: Camera,
    /// His route from setting out to coming home: points at equal shares
    /// of its length (xyz, the share).
    pub route: [[f32; 4]; ROUTE_N],
}

fn swing(t: f32, period: f32) -> f32 {
    0.5 - 0.5 * (TAU * t / period).cos()
}

impl Scene {
    pub fn new() -> Scene {
        let story = Story::new();
        let camera = Camera::new(&story);
        let route = route(&story);
        Scene {
            story,
            camera,
            route,
        }
    }

    /// The reduced-motion frame: at the table, one on one, his sphere and
    /// its rings round him.
    pub fn still(&self) -> f32 {
        self.story.keys.seated + 3.0
    }

    pub fn frame(&self, t: f32) -> Frame {
        let t = t.rem_euclid(LOOP);
        let k = &self.story.keys;
        let view = self.camera.view(&self.story, t);
        let figures = self.story.figures(t);
        let hero = &figures[story::HERO].body;
        let (low, head) = (hero.low.y, hero.head.y + 0.12);

        // His sphere: round his body, over the whole world in the finale.
        let fin = smooth(k.f0 + 6.0, k.f0 + 10.0, t) - smooth(LOOP - 4.5, LOOP - 0.6, t);
        let centre = v3(hero.pelvis.x, 0.5 * (low + head) + 0.05, hero.pelvis.z);
        let r = (0.55 * (head - low) + 0.12).max(0.8);
        let radius = mix(r, WORLD_RADIUS, fin);
        let centre = v3(
            mix(centre.x, 0.0, fin),
            mix(centre.y, 0.0, fin),
            mix(centre.z, 0.0, fin),
        );

        // The cold ring rides the sphere crown to soles and back; in the
        // finale it settles round its equator, round everything.
        let s_c = swing(t, LOOP / 16.0);
        let eq = smooth(k.f0 + 8.0, k.f0 + 11.0, t) - smooth(LOOP - 4.5, LOOP - 0.6, t);
        let cold_y = mix(centre.y + 0.92 * radius * (PI * s_c).cos(), centre.y, eq);

        // The warm ring scans his body; while the body remembers it climbs
        // him and leaves him lit.
        let s_w = swing(t, LOOP / 22.0);
        let scan_y = mix(low + 0.1, head + 0.05, s_w);
        let fill = smooth(k.home_go + 1.0, k.f0 - 1.0, t);
        let fill_y = mix(low, head + 0.08, fill);
        let follow = window(t, k.home_go + 0.5, k.home_go + 1.2, k.f0 - 1.0, k.f0);
        let warm_y = mix(scan_y, fill_y, follow);
        let mem = window(t, k.home_go + 0.5, k.home_go + 1.5, k.f0 + 2.0, k.f0 + 4.0);

        // The train: where, its doors, its lit windows, its speed.
        let phi = self.story.world.train_at(t);
        let speed = (self.story.world.train_at(t + 0.05) - self.story.world.train_at(t - 0.05)) / 0.1;
        let doors = window(t, k.arrive + 0.3, k.arrive + 1.0, k.dep - 0.6, k.dep)
            + window(t, k.lake + 0.3, k.lake + 1.0, k.lake_dep - 0.6, k.lake_dep);

        let back = smooth(LOOP - 4.5, LOOP - 0.5, t);
        let fog = mix(40.0, 400.0, smooth(k.f0 + 1.5, k.f0 + 6.0, t) - back);
        let drawn = smooth(k.f0 + 2.0, k.f0 + 7.0, t) - smooth(LOOP - 4.5, LOOP - 1.0, t);
        let route_light = window(t, k.f0 + 2.0, k.f0 + 4.0, LOOP - 4.0, LOOP - 1.0);
        let melt = MELT * (smooth(k.f0 + 10.0, k.f0 + 14.0, t) - smooth(LOOP - 4.5, LOOP - 1.5, t));

        // The wheels' clack, the wind and the crowd on him while he remembers.
        let clack = (t * 155.0 / LOOP).fract();
        let wind = (t * 23.0 / LOOP).fract();
        let crowd = window(t, k.ramp, k.ramp + 1.0, k.board, k.board + 1.0);
        Frame {
            t,
            view,
            figures,
            train: [phi, doors.min(1.0), 1.0, speed],
            sphere: [centre.x, centre.y, centre.z, radius],
            rings: [cold_y, warm_y, WARM_RADIUS, 1.0],
            ringfx: [1.0, 1.0, 1.0, fin],
            fx: [fog, drawn.max(0.0), route_light, melt.max(0.0)],
            mem: [fill_y, mem, low, head],
            mem2: [clack, wind, follow, crowd],
        }
    }

    /// `u_d`: the camera, the moon, the train, the sphere and its rings,
    /// the effects and his route.
    pub fn pack(&self, f: &Frame) -> [[f32; 4]; SLOTS] {
        let mut s = [[0.0; 4]; SLOTS];
        let (fwd, right, up) = f.view.basis();
        let e = f.view.eye;
        s[EYE] = [e.x, e.y, e.z, f.t];
        s[RIGHT] = [right.x, right.y, right.z, LOOP];
        s[UP] = [up.x, up.y, up.z, 0.0];
        s[FWD] = [fwd.x, fwd.y, fwd.z, f.view.lens()];
        let m = story::moon_dir();
        s[MOON] = [m.x, m.y, m.z, 1.0];
        s[TRAIN] = f.train;
        s[SPHERE] = f.sphere;
        s[RINGS] = f.rings;
        s[RINGFX] = f.ringfx;
        let h = f.figures[story::HERO].body.head;
        s[HEROP] = [h.x, h.y, h.z, f.view.pov];
        s[FX] = f.fx;
        s[MEM] = f.mem;
        s[MEM2] = f.mem2;
        s[LAMPS] = [1.0; 4];
        s[ROUTE..ROUTE + ROUTE_N].copy_from_slice(&self.route);
        s
    }

    /// `u_fig`: per figure its box and first texel with its accent, its
    /// box's top, the capsule round it (feet, head) and how much it shows.
    pub fn people(&self, f: &Frame) -> [[f32; 4]; 4 * FIGS] {
        let mut s = [[0.0; 4]; 4 * FIGS];
        for i in 0..FIGS {
            s[4 * i] = [1e5, 1e5, 1e5, 0.0];
            s[4 * i + 1] = [-1e5, -1e5, -1e5, 0.0];
        }
        for (i, fig) in f.figures.iter().take(FIGS).enumerate() {
            if fig.seen <= 0.0 {
                continue;
            }
            let b = &fig.body;
            let base = (i * FIG_TEXELS) as f32;
            s[4 * i] = [b.low.x, b.low.y, b.low.z, base + 0.9 * fig.accent.clamp(0.0, 1.0)];
            s[4 * i + 1] = [b.high.x, b.high.y, b.high.z, 0.0];
            let feet = v3(b.pelvis.x, b.low.y + 0.15, b.pelvis.z);
            let head = v3(b.head.x, b.head.y - 0.12, b.head.z);
            s[4 * i + 2] = [feet.x, feet.y, feet.z, 0.2 * fig.scale];
            s[4 * i + 3] = [head.x, head.y, head.z, fig.seen];
        }
        s
    }

    /// The data texture's rows: each figure's cones.
    pub fn cones(&self, f: &Frame) -> Vec<[f32; 4]> {
        let mut rows = vec![[0.0f32; 4]; FIGS * DATA_W];
        for (i, fig) in f.figures.iter().take(FIGS).enumerate() {
            rows[i * DATA_W..(i + 1) * DATA_W].copy_from_slice(&fig.body.cones);
        }
        rows
    }
}

impl Default for Scene {
    fn default() -> Self {
        Scene::new()
    }
}

/// His route from setting out to coming home at equal shares of its
/// length, a little over the ground.
fn route(story: &Story) -> [[f32; 4]; ROUTE_N] {
    let k = &story.keys;
    const SAMPLES: usize = 1600;
    let points: Vec<V3> = (0..=SAMPLES)
        .map(|i| {
            let t = mix(k.go, k.f0, i as f32 / SAMPLES as f32);
            smoothed(story, t).0
        })
        .collect();
    let mut along = vec![0.0f32];
    for w in points.windows(2) {
        along.push(along[along.len() - 1] + (w[1] - w[0]).length());
    }
    let total = along[SAMPLES];
    let mut out = [[0.0; 4]; ROUTE_N];
    let mut j = 0;
    for (i, slot) in out.iter_mut().enumerate() {
        let share = i as f32 / (ROUTE_N - 1) as f32;
        let s = share * total;
        while j + 1 < SAMPLES && along[j + 1] < s {
            j += 1;
        }
        let u = ((s - along[j]) / (along[j + 1] - along[j]).max(1e-6)).clamp(0.0, 1.0);
        let p = points[j].lerp(points[j + 1], u);
        *slot = [p.x, p.y + 0.05, p.z, share];
    }
    out
}

/// The colours of one theme.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// The page: the engraving's paper.
    pub paper: [f32; 3],
    /// The engraving's lines.
    pub ink: [f32; 3],
    /// The sphere and the first ring.
    pub cold: [f32; 3],
    /// The second ring, the lit windows, the light in him.
    pub warm: [f32; 3],
    /// White-hot cores.
    pub pale: [f32; 3],
    /// The code the world melts into.
    pub code: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

/// The app theme by its `graphicsPalette` code: 0 Искра, 2 Тишина, 3 Астрал,
/// 4 Матрица. The site has only these dark themes; any other code shows Тишина.
pub fn look(code: u32) -> Look {
    let (palette, warm, pale) = match Palette::from_code(code) {
        Palette::Dark => (Palette::Dark, rgb(255, 122, 40), rgb(255, 244, 170)),
        Palette::Violet => (Palette::Violet, rgb(240, 158, 128), rgb(200, 212, 248)),
        Palette::Matrix => (Palette::Matrix, rgb(255, 184, 64), rgb(190, 255, 205)),
        _ => (Palette::Neutral, rgb(242, 179, 117), rgb(214, 218, 210)),
    };
    let colors = palette.colors().expect("a dark theme has its colors");
    let ink = match palette {
        Palette::Dark | Palette::Matrix => colors.accent,
        _ => colors.highlight,
    };
    Look {
        paper: colors.paper,
        ink,
        cold: colors.accent,
        warm,
        pale,
        code: colors.accent,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::place::{angle_of, ground};

    fn near(a: V3, b: V3, d: f32) -> bool {
        (a - b).length() <= d
    }

    #[test]
    fn the_loop_closes_where_he_set_out() {
        let scene = Scene::new();
        let (a, b) = (scene.frame(LOOP - 0.001), scene.frame(0.0));
        assert!(near(a.view.eye, b.view.eye, 0.05), "{:?} {:?}", a.view, b.view);
        assert!(near(a.view.look, b.view.look, 0.05));
        for (fa, fb) in a.figures.iter().zip(b.figures.iter()) {
            if fa.seen <= 0.0 && fb.seen <= 0.0 {
                continue;
            }
            assert!(near(fa.body.head, fb.body.head, 0.03), "{:?} {:?}", fa.body.head, fb.body.head);
        }
        for i in 0..4 {
            assert!((a.sphere[i] - b.sphere[i]).abs() < 0.05);
            assert!((a.rings[i] - b.rings[i]).abs() < 0.05, "{:?} {:?}", a.rings, b.rings);
        }
        let ta = a.train[0].rem_euclid(TAU);
        let tb = b.train[0].rem_euclid(TAU);
        assert!((ta - tb).abs() < 1e-3);
    }

    #[test]
    fn the_story_keeps_its_order_and_leaves_time_for_the_finale() {
        let scene = Scene::new();
        let k = scene.story.keys;
        let order = [
            ("go", k.go),
            ("door", k.door),
            ("window", k.window),
            ("leave", k.leave),
            ("seated", k.seated),
            ("risen", k.risen),
            ("back_door", k.back_door),
            ("ramp", k.ramp),
            ("at_stop", k.at_stop),
            ("arrive", k.arrive),
            ("board", k.board),
            ("at_seat", k.at_seat),
            ("dep", k.dep),
            ("lake", k.lake),
            ("off", k.off),
            ("pier_end", k.pier_end),
            ("turn_back", k.turn_back),
            ("meet", k.meet),
            ("together", k.together),
            ("parted", k.parted),
            ("her_in", k.her_in),
            ("home_go", k.home_go),
            ("f0", k.f0),
        ];
        for (name, at) in order {
            println!("{name:>10} {at:7.2}");
        }
        for w in order.windows(2) {
            if w[1].0 == "her_in" || w[0].0 == "her_in" || w[1].0 == "arrive" || w[0].0 == "arrive"
            {
                continue;
            }
            assert!(w[0].1 < w[1].1, "{} {} then {} {}", w[0].0, w[0].1, w[1].0, w[1].1);
        }
        // The train is in before he reaches the platform's edge.
        assert!(k.arrive + 1.0 < k.board, "{} {}", k.arrive, k.board);
        assert!(LOOP - k.f0 >= 20.0, "the finale is {} s", LOOP - k.f0);
        assert!(k.her_in < k.f0);
    }

    #[test]
    fn the_feet_stay_on_the_ground() {
        let scene = Scene::new();
        let k = scene.story.keys;
        let mut t = 0.0;
        while t < LOOP {
            let f = scene.frame(t);
            for (i, fig) in f.figures.iter().enumerate() {
                if fig.seen <= 0.0 {
                    continue;
                }
                let b = &fig.body;
                let on_train = t > k.at_seat - 0.2 && t < k.off && i == story::HERO;
                let under = if on_train {
                    place::CAR_FLOOR
                } else {
                    body::FEET
                        .iter()
                        .map(|&c| {
                            let [x, _, z, _] = b.cones[3 * c];
                            ground(x, z)
                        })
                        .fold(ground(b.pelvis.x, b.pelvis.z), f32::min)
                };
                assert!(
                    b.low.y > under - 0.08 && b.low.y < under + 0.25,
                    "{i} at {t}: low {} over {under} at {:.1}°",
                    b.low.y,
                    angle_of(b.pelvis.x, b.pelvis.z)
                );
            }
            t += 0.25;
        }
    }

    #[test]
    fn he_is_in_the_picture_while_the_camera_is_not_his_eyes() {
        let scene = Scene::new();
        let mut t = 0.0;
        let mut out = Vec::new();
        while t < LOOP {
            let f = scene.frame(t);
            if f.view.pov < 0.5 {
                let b = &f.figures[0].body;
                let seen = |p: V3| {
                    let (x, y, z) = f.view.project(p);
                    z > 0.3 && x.abs() < 1.5 && y.abs() < 1.0
                };
                if !seen(b.chest) && !seen(b.head) {
                    let (x, y, z) = f.view.project(b.chest);
                    out.push(format!("{t:6.2}: ({x:5.2}, {y:5.2}) z {z:5.1}"));
                }
            }
            t += 0.25;
        }
        for line in &out {
            println!("{line}");
        }
        assert!(out.len() < 40, "{} moments out of the frame", out.len());
    }

    #[test]
    fn the_route_runs_from_the_field_round_the_ring_and_home() {
        let scene = Scene::new();
        let first = scene.route[0];
        let last = scene.route[ROUTE_N - 1];
        assert!(first[0].hypot(first[2]) < 0.5 && last[0].hypot(last[2]) < 0.5);
        let far = scene
            .route
            .iter()
            .map(|p| p[0].hypot(p[2]))
            .fold(0.0, f32::max);
        assert!(far > 22.0, "{far}");
    }

    #[test]
    fn every_dark_theme_has_its_colours() {
        for code in [0, 2, 3, 4] {
            let l = look(code);
            let luma = |c: [f32; 3]| 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
            assert!(luma(l.paper) < 0.1, "{code}");
            assert!(luma(l.ink) > luma(l.paper) + 0.3, "{code}");
            assert!(luma(l.warm) > 0.4, "{code}");
        }
        assert_eq!(look(9), look(2));
    }

    #[test]
    fn the_packed_slots_carry_the_camera_and_the_route() {
        let scene = Scene::new();
        let f = scene.frame(scene.still());
        let s = scene.pack(&f);
        assert_eq!(s[RIGHT][3], LOOP);
        assert!(s[FWD][3] > 1.0);
        assert_eq!(s[ROUTE + ROUTE_N - 1][3], 1.0);
        let p = scene.people(&f);
        assert!(p[3][3] > 0.99 && p[7][3] > 0.99);
        assert_eq!(scene.cones(&f).len(), FIGS * DATA_W);
    }
}
