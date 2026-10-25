//! Voice builds a temporary crossing through the Matrix.
//! Pure choreography and geometry. The shared Laboratory shader supplies rain;
//! the host only supplies active time, visibility and reduced-motion preference.
#[path = "breath_bridge_copy.rs"]
mod copy;
#[path = "breath_bridge_scene.rs"]
mod scene;
use crate::step_three::Update;
use std::{f64::consts::PI, fmt::Write, sync::LazyLock};

pub const PERIOD: f64 = 29.04;
const WALK_AT: f64 = 4.4;
const STEP: f64 = 0.68;
const STEPS: usize = 22;
const GATE_STOP: usize = 17;
const WAIT_AT: f64 = WALK_AT + GATE_STOP as f64 * STEP;
const GATE_WAIT: f64 = 5.;
const RESUME_AT: f64 = WAIT_AT + GATE_WAIT;
const CHAIN_WORD_AT: f64 = WAIT_AT + 0.45;
const BREAK_AT: f64 = CHAIN_WORD_AT + 0.65;
const OPEN_WORD_AT: f64 = WAIT_AT + 3.;
const OPEN_AT: f64 = OPEN_WORD_AT + 0.30;
const WALK_END: f64 = WALK_AT + STEPS as f64 * STEP + GATE_WAIT;
const RESET_AT: f64 = WALK_END + 2.08;

// Walking time stops on the arrival bank while two independent utterances
// release the chains and then open the gate. No leg or root slides in the hold.
fn walk_time(t: f64) -> f64 {
    t - (t - WAIT_AT).clamp(0., GATE_WAIT)
}
fn step_at(index: usize) -> f64 {
    WALK_AT + index as f64 * STEP + if index >= GATE_STOP { GATE_WAIT } else { 0. }
}
fn phrase_at(index: usize) -> f64 {
    match index {
        5 => CHAIN_WORD_AT,
        6 => OPEN_WORD_AT,
        _ => 3.35 + index as f64 * 3. * STEP,
    }
}
fn phrase_alpha(index: usize, t: f64) -> f64 {
    let at = phrase_at(index);
    let hold = if index == 5 { 1.6 } else { 1.0 };
    bell(t, at - 0.2, at + 0.12, at + hold, at + hold + 0.55)
}
fn walking(t: f64) -> f64 {
    bell(t, WALK_AT - 0.35, WALK_AT + STEP, WAIT_AT - STEP, WAIT_AT)
        + bell(
            t,
            RESUME_AT,
            RESUME_AT + STEP * 0.4,
            WALK_END - STEP,
            WALK_END,
        )
}
const REST: f64 = 10.8;
const TILES: [f64; 5] = [-3.2, -1.3, 0.6, 2.5, 4.4];
const TILE_HALF: f64 = 0.9;
type Point = (f64, f64);
const INK: &str = "var(--book-ink)";
const LIGHT: &str = "var(--book-light)";
const LINE: &str = "var(--book-line)";
const DIM: &str = "var(--book-dim)";
const COVER: &str = "var(--book-cover)";
fn smooth(x: f64) -> f64 {
    let v = x.clamp(0., 1.);
    v * v * (3. - 2. * v)
}
fn between(t: f64, a: f64, b: f64) -> f64 {
    smooth((t - a) / (b - a))
}
fn mix(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}
fn lerp(a: Point, b: Point, t: f64) -> Point {
    (mix(a.0, b.0, t), mix(a.1, b.1, t))
}
fn bell(t: f64, a: f64, b: f64, c: f64, d: f64) -> f64 {
    between(t, a, b) * (1. - between(t, c, d))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Phase {
    Observe,
    Inhale,
    Unlock,
    Open,
    Speak,
    Cross,
    Arrive,
    Reset,
}
impl Phase {
    fn name(self) -> &'static str {
        match self {
            Self::Observe => "observe",
            Self::Inhale => "inhale",
            Self::Unlock => "unlock",
            Self::Open => "open",
            Self::Speak => "speak",
            Self::Cross => "cross",
            Self::Arrive => "arrive",
            Self::Reset => "reset",
        }
    }
}
#[derive(Clone, Copy, Debug)]
struct Foot {
    x: f64,
    lift: f64,
    roll: f64,
    toe_pivot: f64,
}
#[derive(Clone, Copy, Debug)]
struct State {
    t: f64,
    phase: Phase,
    feet: [Foot; 2],
    x: f64,
    bob: f64,
    breath: f64,
    opening: f64,
    reset: f64,
}
fn landing(step: usize) -> f64 {
    // Three contacts per slab, then a supported walk through the doorway
    // and fully behind the opaque near wall. No opacity fade hides the person.
    match step {
        17 => 6.93,
        18.. => 7.28 + (step - 18) as f64 * (1.9 / 3.),
        _ => -3.833333333333333 + step as f64 * (1.9 / 3.),
    }
}
fn ease5(p: f64) -> f64 {
    let p = p.clamp(0., 1.);
    p * p * p * (10. + p * (-15. + 6. * p))
}
fn initial_feet() -> [Foot; 2] {
    [-4.45, -4.68].map(|x| Foot {
        x,
        lift: 0.,
        roll: 0.,
        toe_pivot: 0.5,
    })
}
fn root_key(index: usize) -> f64 {
    let mut feet = initial_feet();
    for j in 0..index {
        feet[j % 2].x = landing(j);
    }
    (feet[0].x + feet[1].x) * 0.5
}
fn root_tangent(index: usize) -> f64 {
    if index == 0 || index == GATE_STOP || index == STEPS {
        return 0.;
    }
    let before = root_key(index) - root_key(index - 1);
    let after = root_key(index + 1) - root_key(index);
    // Monotone Hermite velocity: no stop/start on every footfall or overshoot
    // during the two shorter arrival steps.
    2. * before * after / (before + after)
}
fn root_position(t: f64) -> f64 {
    let p = ((walk_time(t) - WALK_AT) / STEP).clamp(0., STEPS as f64);
    let j = (p.floor() as usize).min(STEPS - 1);
    let q = p - j as f64;
    let q2 = q * q;
    let q3 = q2 * q;
    (2. * q3 - 3. * q2 + 1.) * root_key(j)
        + (q3 - 2. * q2 + q) * root_tangent(j)
        + (-2. * q3 + 3. * q2) * root_key(j + 1)
        + (q3 - q2) * root_tangent(j + 1)
}
fn state(seconds: f64, reduced: bool) -> State {
    let t = if reduced || !seconds.is_finite() {
        REST
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    };
    let mut feet = initial_feet();
    for j in 0..STEPS {
        let at = step_at(j);
        if t < at {
            break;
        }
        let which = j % 2;
        let p = ((t - at) / STEP).clamp(0., 1.);
        let q = ((p - 0.13) / 0.72).clamp(0., 1.);
        let stride = landing(j) - feet[which].x;
        let clearance = (stride.abs() * 0.10).clamp(0.035, 0.12);
        feet[which].x = mix(feet[which].x, landing(j), ease5(q));
        feet[which].lift = clearance * (PI * q).sin().powi(2);
        feet[which].roll = if p < 0.13 {
            mix(
                if j == 0 || j == GATE_STOP { 0. } else { 0.30 },
                0.34,
                ease5(p / 0.13),
            )
        } else if p < 0.85 {
            mix(0.34, -0.11, ease5(q))
        } else {
            -0.11 * (1. - ease5((p - 0.85) / 0.15))
        };
        feet[which].toe_pivot = 1. - ease5(q);
        // The support heel begins to rise as the body passes it. Its toe stays
        // fixed; waiting until the next swing would force an artificial squat.
        if j + 1 < STEPS && j + 1 != GATE_STOP {
            feet[1 - which].roll = 0.30 * ease5((p - 0.48) / 0.52);
            feet[1 - which].toe_pivot = 1.;
        }
        if t < at + STEP {
            break;
        }
    }
    let gait = walking(t);
    let bob = gait * 0.025 * (PI * (walk_time(t) - WALK_AT) / STEP).sin().powi(2);
    let phase = match t {
        t if t < 0.7 => Phase::Observe,
        t if t < 2.65 => Phase::Inhale,
        t if t < WALK_AT => Phase::Speak,
        t if t < WAIT_AT => Phase::Cross,
        t if t < OPEN_WORD_AT => Phase::Unlock,
        t if t < RESUME_AT => Phase::Open,
        t if t < WALK_END => Phase::Cross,
        t if t < RESET_AT => Phase::Arrive,
        _ => Phase::Reset,
    };
    State {
        t,
        phase,
        feet,
        x: root_position(t),
        bob,
        breath: bell(t, 0.7, 2.55, 2.65, 3.9) + 0.12 * (t * 1.5).sin(),
        opening: between(t, OPEN_AT, RESUME_AT - 0.2),
        reset: 1. - between(t, RESET_AT, PERIOD - 0.7),
    }
}
#[derive(Clone, Copy, Debug)]
struct Tile {
    build: f64,
    dissolve: f64,
    at: f64,
}
fn tile(index: usize, s: State) -> Tile {
    // A complete solid top exists before the first contacting foot. Dissolution
    // waits until BOTH feet have left the slab, including the trailing toe.
    let at = phrase_at(index);
    let build = ease5((s.t - at) / 1.0);
    let behind = s
        .feet
        .iter()
        .all(|foot| foot.x > TILES[index] + TILE_HALF + 0.25);
    let release = WALK_AT + (index as f64 * 3. + 5.) * STEP + 0.18;
    let dissolve = if behind {
        ease5((s.t - release) / 2.0)
    } else {
        0.
    };
    Tile {
        build,
        dissolve,
        at,
    }
}

#[derive(Clone)]
struct Path {
    d: String,
    fill: &'static str,
    stroke: &'static str,
    width: f64,
    alpha: f64,
    stroke_alpha: f64,
    matrix_uv: Option<String>,
}
impl Path {
    fn line(d: impl Into<String>, stroke: &'static str, width: f64, alpha: f64) -> Self {
        Self {
            d: d.into(),
            fill: "none",
            stroke,
            width,
            alpha,
            stroke_alpha: 1.,
            matrix_uv: None,
        }
    }
    fn solid(d: impl Into<String>, fill: &'static str, stroke: &'static str, width: f64) -> Self {
        Self {
            d: d.into(),
            fill,
            stroke,
            width,
            alpha: 1.,
            stroke_alpha: 1.,
            matrix_uv: None,
        }
    }
    fn xml(&self, out: &mut String, class: &str) {
        let uv = self
            .matrix_uv
            .as_ref()
            .map(|m| format!(r#" data-rust-matrix-uv="{m}""#))
            .unwrap_or_default();
        let _ = write!(
            out,
            r#"<path{uv} class="{class}" d="{}" fill="{}" stroke="{}" stroke-width="{}" opacity="{:.5}" stroke-opacity="{}" stroke-linejoin="round" stroke-linecap="round"/>"#,
            self.d, self.fill, self.stroke, self.width, self.alpha, self.stroke_alpha
        );
    }
}
fn poly(points: &[Point]) -> String {
    let mut out = String::new();
    for (i, (x, y)) in points.iter().enumerate() {
        let _ = write!(out, "{}{x:.3} {y:.3}", if i == 0 { 'M' } else { 'L' });
    }
    out.push('Z');
    out
}
fn line(points: &[Point]) -> String {
    let mut d = poly(points);
    d.pop();
    d
}
fn ellipse(x: f64, y: f64, rx: f64, ry: f64) -> String {
    format!(
        "M{:.3} {y:.3}a{rx:.3} {ry:.3} 0 1 0 {:.3} 0a{rx:.3} {ry:.3} 0 1 0 {:.3} 0",
        x - rx,
        rx * 2.,
        -rx * 2.
    )
}
fn marker(out: &mut Vec<Path>, at: Point, r: f64, ink: &'static str, alpha: f64) {
    let mut p = Path::solid(ellipse(at.0, at.1, r, r), ink, "none", 0.);
    p.alpha = alpha;
    out.push(p);
}

static STATIC_SCENE: LazyLock<String> = LazyLock::new(scene::environment);
/// Native authoring diagnostic: sample the exact product gait for contact sheets.
#[cfg(not(target_arch = "wasm32"))]
pub fn heroine_review_pose(seconds: f64) -> (crate::breath_heroine::Pose, Point, f64) {
    scene::heroine_pose(state(seconds, false))
}
mod typography {
    include!(concat!(env!("OUT_DIR"), "/spoken_glyphs.rs"));
}
static WORDS: LazyLock<[String; 7]> = LazyLock::new(|| {
    copy::PHRASES.map(|phrase| {
        let mut d = String::new();
        for (i, ch) in phrase.chars().enumerate() {
            for &(command, points) in typography::glyph(ch) {
                let (op, n) = match command {
                    1 => ('M', 1),
                    2 => ('L', 1),
                    3 => ('Q', 2),
                    4 => ('C', 3),
                    _ => ('Z', 0),
                };
                d.push(op);
                for j in 0..n {
                    let _ = write!(
                        d,
                        "{:.3} {:.3} ",
                        i as f64 * 15.3 + points[j * 2] * 21.4,
                        -points[j * 2 + 1] * 21.4
                    );
                }
            }
        }
        d
    })
});

pub fn svg() -> String {
    let mut out = String::from(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 192" fill="none"><defs>
      <radialGradient id="bridge-light"><stop stop-color="var(--book-ink)" stop-opacity=".22"/><stop offset=".42" stop-color="var(--book-ink)" stop-opacity=".065"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
      <radialGradient id="bridge-breath"><stop stop-color="var(--book-light)" stop-opacity=".8"/><stop offset=".2" stop-color="var(--book-ink)" stop-opacity=".25"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
    </defs><g class="breath-stage" data-phase="observe" data-cycle-time="0" transform="scale(.333333333333)">"##,
    );
    out.push_str(&STATIC_SCENE);
    out.push_str(r#"<g class="bridge-story">"#);
    for (i, path) in scene::dynamic(state(0., false)).iter().enumerate() {
        path.xml(&mut out, &format!("bridge-path-{i}"));
    }
    for (i, d) in WORDS.iter().enumerate() {
        let _ = write!(
            out,
            r#"<path class="bridge-word-{i}" d="{d}" fill="var(--book-ink)" opacity="0"/>"#
        );
    }
    out.push_str("</g>");
    out.push_str(&scene::foreground());
    out.push_str("</g></svg>");
    crate::scene_edges::wrap(&out, 17., 12.)
}
pub fn frame(seconds: f64, reduced: bool) -> Vec<Update> {
    let s = state(seconds, reduced);
    let mut out = Vec::with_capacity(650);
    let mut set = |selector: String, attribute, value: String| {
        out.push(Update {
            selector,
            attribute,
            value,
        })
    };
    set(".breath-stage".into(), "data-phase", s.phase.name().into());
    set(
        ".breath-stage".into(),
        "data-cycle-time",
        format!("{:.4}", s.t),
    );
    // The Matrix stays alive during a quiet reset, rather than disappearing.
    set(
        ".bridge-story".into(),
        "opacity",
        format!("{:.5}", between(s.t, 0., 0.45) * s.reset),
    );
    for (i, p) in scene::dynamic(s).into_iter().enumerate() {
        let selector = format!(".bridge-path-{i}");
        set(selector.clone(), "d", p.d);
        set(
            selector.clone(),
            "opacity",
            format!("{:.5}", p.alpha.clamp(0., 1.)),
        );
        if let Some(uv) = p.matrix_uv {
            set(selector, "data-rust-matrix-uv", uv);
        }
    }
    let mouth = scene::mouth(s);
    for (i, phrase) in copy::PHRASES.iter().enumerate() {
        let alpha = phrase_alpha(i, s.t);
        let width = phrase.chars().count() as f64 * 15.3 * 0.82;
        let near_gate = between(s.x, 0.7, 3.0);
        let x = (mouth.0 + 19. - near_gate * (width + 34.)).clamp(40., 920. - width);
        let selector = format!(".bridge-word-{i}");
        set(selector.clone(), "opacity", format!("{alpha:.5}"));
        set(
            selector,
            "transform",
            format!(
                "translate({:.3} {:.3}) scale(.82)",
                x,
                mouth.1 - 12. - near_gate * 25.
            ),
        );
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn platforms_fade_with_zero_endpoint_speed_and_keep_contact_safe() {
        let at = tile(0, state(0., false)).at;
        let dt = 0.001;
        assert!(tile(0, state(at + dt, false)).build / dt < 0.001);
        assert!((1. - tile(0, state(at + 1. - dt, false)).build) / dt < 0.001);
        let release = WALK_AT + 5. * STEP + 0.18;
        assert!(tile(0, state(release + dt, false)).dissolve / dt < 0.001);
        assert!((1. - tile(0, state(release + 2. - dt, false)).dissolve) / dt < 0.001);
        let halfway = tile(0, state(release + 1., false));
        assert!((halfway.dissolve - 0.5).abs() < 1e-8);
    }
    #[test]
    fn walking_keeps_support_and_continuous_forward_speed() {
        for n in 0..(RESET_AT * 100.) as usize {
            let s = state(n as f64 / 100., false);
            assert!(
                s.feet.iter().any(|f| f.lift < 1e-9),
                "both feet airborne at {}",
                s.t
            );
        }
        let dt = 1e-5;
        for i in 0..=STEPS {
            let t = step_at(i);
            let before = (root_position(t) - root_position(t - dt)) / dt;
            let after = (root_position(t + dt) - root_position(t)) / dt;
            assert!(
                (before - after).abs() < 0.001,
                "velocity discontinuity at step {i}"
            );
            if i > 0 && i < STEPS && i != GATE_STOP {
                assert!(after > 0.1, "body stopped between steps");
            }
        }
        let arrival = state(WALK_END, false);
        for t in [WALK_END + 0.1, WALK_END + 1., RESET_AT - 0.1] {
            let s = state(t, false);
            for i in 0..2 {
                assert_eq!(s.feet[i].x, arrival.feet[i].x);
                assert!(s.feet[i].lift < 1e-9);
            }
        }
    }
    #[test]
    fn crossing_has_support_before_contact_and_until_the_toe_leaves() {
        for n in 0..(PERIOD * 100.) as usize {
            let s = state(n as f64 / 100., false);
            for foot in s.feet {
                if foot.lift > 0.008 || foot.x <= -3.85 || foot.x >= 5.30 - 1e-6 {
                    continue;
                }
                let index = TILES
                    .iter()
                    .position(|&x| (x - foot.x).abs() <= TILE_HALF)
                    .unwrap_or_else(|| {
                        panic!(
                            "grounded foot at {} needs support at t={} (lift={})",
                            foot.x, s.t, foot.lift
                        )
                    });
                let slab = tile(index, s);
                assert!(slab.build > 0.99, "slab {index} not built at {}", s.t);
                assert!(
                    slab.dissolve < 0.01,
                    "support dissolved under a foot at {}",
                    s.t
                );
            }
        }
    }
    #[test]
    fn words_build_the_route_then_unlock_and_open_only_at_the_gate() {
        assert_eq!(state(2., false).phase, Phase::Inhale);
        assert_eq!(state(3.8, false).phase, Phase::Speak);
        assert_eq!(state(5., false).phase, Phase::Cross);
        assert_eq!(tile(0, state(WALK_AT, false)).build, 1.);
        let arrival = state(WAIT_AT, false);
        assert!(arrival.feet.iter().all(|f| f.x >= 5.30 && f.x < 6.8));
        for n in 0..(RESUME_AT * 100.) as usize {
            let t = n as f64 / 100.;
            let s = state(t, false);
            if t < OPEN_AT {
                assert_eq!(s.opening, 0.);
            }
            assert!(
                s.feet.iter().all(|f| f.x < 6.8),
                "entered a closed gate at {t}"
            );
            if t >= WAIT_AT {
                assert!((s.x - arrival.x).abs() < 1e-10);
                for i in 0..2 {
                    assert_eq!(s.feet[i].x, arrival.feet[i].x);
                    assert!(s.feet[i].lift.abs() < 1e-10);
                    assert!(s.feet[i].roll.abs() < 1e-10);
                }
            }
        }
        assert_eq!(state(RESUME_AT, false).opening, 1.);
        assert!(BREAK_AT > WAIT_AT && OPEN_AT > BREAK_AT + 0.6);
        for i in 0..7 {
            assert!(phrase_alpha(i, phrase_at(i) + 0.2) > 0.99);
            if i < 6 {
                assert!(phrase_at(i) + 1.5 < phrase_at(i + 1));
            }
        }
        let final_pose = state(WALK_END, false);
        assert!(final_pose.feet.iter().all(|f| f.x > 6.8));
    }
    #[test]
    fn scene_has_stable_topology_and_resolved_finite_updates() {
        let xml = svg();
        let doc = roxmltree::Document::parse(&xml).unwrap();
        let count = scene::dynamic(state(0., false)).len();
        assert!(xml.contains("data-rust-matrix-uv"));
        assert!(!xml.contains("<image"));
        for n in 0..=(PERIOD * 10.) as usize {
            let s = state(n as f64 / 10., false);
            assert_eq!(scene::dynamic(s).len(), count);
            for u in frame(s.t, false) {
                assert!(!u.value.contains("NaN") && !u.value.contains("inf"));
                assert!(
                    doc.descendants()
                        .any(|n| n.attribute("class") == Some(&u.selector[1..])),
                    "{}",
                    u.selector
                );
                if u.attribute == "opacity" {
                    assert!((0. ..=1.).contains(&u.value.parse::<f64>().unwrap()));
                }
            }
        }
        for phrase in copy::PHRASES {
            for ch in phrase.chars().filter(|c| !c.is_whitespace()) {
                assert!(!typography::glyph(ch).is_empty(), "missing letter {ch}");
            }
        }
    }
    #[test]
    fn reduced_motion_and_loop_are_deterministic() {
        assert_eq!(frame(0., true), frame(1000., true));
        assert_eq!(frame(f64::NAN, false), frame(0., true));
        assert_eq!(frame(f64::INFINITY, false), frame(0., true));
        assert_eq!(frame(0., false), frame(PERIOD, false));
        assert!(state(PERIOD - 0.2, false).reset == 0.);
    }
}
