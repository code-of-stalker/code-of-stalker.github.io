//! Platform-neutral motion and animated typography. Adapters supply events and
//! apply returned values; they contain no easing, interpolation or scene clock.
use crate::{clock::Clock, inertial_progress::ProgressSpring};
use std::collections::BTreeMap;
#[derive(Clone)]
struct Channel {
    value: f64,
    from: f64,
    target: f64,
    start: f64,
    duration: f64,
    delay: f64,
    easing: Vec<f64>,
    moving: bool,
    dirty: bool,
    spring: Option<ProgressSpring>,
    mapping: Option<(u32, Vec<f64>, Vec<f64>, bool)>,
}
#[derive(Default)]
pub struct Kernel {
    clock: Clock,
    channels: BTreeMap<u32, Channel>,
    active: bool,
}
fn easing(t: f64, curve: &[f64]) -> f64 {
    if t <= 0. || t >= 1. {
        return t;
    }
    let mode = curve.first().copied().unwrap_or(0.) as u32;
    if mode == 4 && curve.len() >= 6 {
        return crate::scene_model::ease(
            t as f32,
            [
                curve[2] as f32,
                curve[3] as f32,
                curve[4] as f32,
                curve[5] as f32,
            ],
        ) as f64;
    }
    let base = |p: f64| match mode {
        1 => p * p,
        2 => p * p * p,
        3 => 1. - (p * std::f64::consts::FRAC_PI_2).cos(),
        _ => p,
    };
    match curve.get(1).copied().unwrap_or(0.) as u32 {
        1 => 1. - base(1. - t),
        2 => {
            if t < 0.5 {
                base(t * 2.) * 0.5
            } else {
                1. - base((1. - t) * 2.) * 0.5
            }
        }
        _ => base(t),
    }
}
impl Kernel {
    pub fn create() -> Self {
        Self {
            active: true,
            ..Self::default()
        }
    }
    pub fn active(&mut self, active: bool) {
        self.active = active;
        if !active {
            self.clock.suspend();
        }
    }
    pub fn insert(&mut self, id: u32, value: f64) {
        if !value.is_finite() {
            return;
        }
        self.channels.insert(
            id,
            Channel {
                value,
                from: value,
                target: value,
                start: 0.,
                duration: 0.,
                delay: 0.,
                easing: vec![],
                moving: false,
                dirty: true,
                spring: None,
                mapping: None,
            },
        );
    }
    pub fn remove(&mut self, id: u32) {
        self.channels.remove(&id);
    }
    pub fn moving(&self) -> bool {
        self.channels.values().any(|c| c.moving || c.dirty)
    }
    pub fn set(&mut self, id: u32, value: f64) {
        if !value.is_finite() {
            return;
        }
        if let Some(c) = self.channels.get_mut(&id) {
            c.value = value;
            c.from = value;
            c.target = value;
            c.moving = false;
            c.dirty = true;
            c.spring = None;
        }
    }
    pub fn stop(&mut self, id: u32) {
        if let Some(c) = self.channels.get_mut(&id) {
            c.moving = false;
            c.spring = None;
        }
    }
    pub fn target(
        &mut self,
        id: u32,
        to: f64,
        duration: f64,
        delay: f64,
        curve: Vec<f64>,
        spring: bool,
    ) {
        if !to.is_finite() {
            return;
        }
        if let Some(c) = self.channels.get_mut(&id) {
            c.from = c.value;
            c.target = to;
            c.start = self.clock.elapsed;
            c.duration = duration.max(0.) / 1000.;
            c.delay = delay.max(0.) / 1000.;
            c.easing = curve;
            c.moving = true;
            c.dirty = true;
            c.spring = if spring {
                let mut s = ProgressSpring::new(c.value);
                s.target(to, false);
                Some(s)
            } else {
                None
            };
        }
    }
    pub fn map(&mut self, id: u32, parent: u32, input: Vec<f64>, output: Vec<f64>, clamp: bool) {
        if input.len() < 2 || input.len() != output.len() || input.windows(2).any(|p| p[0] >= p[1])
        {
            return;
        }
        self.insert(id, 0.);
        self.channels.get_mut(&id).unwrap().mapping = Some((parent, input, output, clamp));
    }
    /// Triples: channel id, value, completion. No platform objects in the core.
    pub fn frame(&mut self, at: f64) -> Vec<f64> {
        if !self.active {
            self.clock.suspend();
            return vec![];
        }
        let dt = self.clock.step(at, true);
        let now = self.clock.elapsed;
        let mut updates = Vec::new();
        for (id, c) in &mut self.channels {
            if c.mapping.is_some() {
                continue;
            }
            let moving = c.moving;
            if moving {
                if let Some(s) = &mut c.spring {
                    s.step(dt);
                    c.value = s.position;
                    c.moving = s.moving();
                } else {
                    let p = if c.duration == 0. {
                        1.
                    } else {
                        ((now - c.start - c.delay) / c.duration).clamp(0., 1.)
                    };
                    c.value = c.from + (c.target - c.from) * easing(p, &c.easing);
                    c.moving = p < 1.;
                }
            }
            if moving || c.dirty {
                updates.extend([
                    *id as f64,
                    c.value,
                    if moving && !c.moving { 1. } else { 0. },
                ]);
                c.dirty = false;
            }
        }
        // IDs are allocated in dependency order; chained mappings therefore
        // observe the current frame, with no one-frame lag or JS arithmetic.
        let ids = self.channels.keys().copied().collect::<Vec<_>>();
        for id in ids {
            let Some((parent, input, output, clamp)) = self.channels[&id].mapping.clone() else {
                continue;
            };
            let Some(parent) = self.channels.get(&parent) else {
                continue;
            };
            let mut x = parent.value;
            if clamp {
                x = x.clamp(input[0], *input.last().unwrap());
            }
            let i = input
                .partition_point(|v| *v < x)
                .max(1)
                .min(input.len() - 1);
            let p = (x - input[i - 1]) / (input[i] - input[i - 1]);
            let value = output[i - 1] + (output[i] - output[i - 1]) * p;
            let c = self.channels.get_mut(&id).unwrap();
            if value != c.value || c.dirty {
                c.value = value;
                c.dirty = false;
                updates.extend([id as f64, value, 0.]);
            }
        }
        if !self.moving() {
            self.clock.suspend();
        }
        updates
    }
}
pub struct TextFrame {
    pub text: String,
    pub opacity: f64,
    pub scale: f64,
}
pub fn text_frame(text: &str, effect: u32, seconds: f64, reduced: bool) -> TextFrame {
    let mut result = TextFrame {
        text: text.to_uppercase(),
        opacity: 0.,
        scale: 1.,
    };
    if reduced {
        return result;
    }
    if effect == 1 {
        let t = (seconds - 2.4).rem_euclid(9.65);
        if seconds < 2.4 || t >= 2.85 {
            return result;
        }
        let frame = (t / 0.57).floor() as usize;
        let phase = t % 0.57;
        result.opacity = if phase < 0.18 {
            (1. - (phase / 0.18 * std::f64::consts::PI).cos()) * 0.5
        } else if phase < 0.24 {
            1.
        } else if phase < 0.5 {
            (1. + ((phase - 0.24) / 0.26 * std::f64::consts::PI).cos()) * 0.5
        } else {
            0.
        };
        let mut letters = result.text.chars().collect::<Vec<_>>();
        let positions = letters
            .iter()
            .enumerate()
            .filter_map(|(i, ch)| {
                if ('А'..='Я').contains(ch) || *ch == 'Ё' {
                    Some(i)
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();
        let symbols = ['+', '/', '=', '#', '0', ':', '%', '1', '<', '>'];
        for region in 0..3 {
            let start = region * positions.len() / 3;
            let end = (region + 1) * positions.len() / 3;
            let length = end - start;
            for j in 0..length.min(2) {
                let at = positions[start + (frame * (region + 2) + region + j) % length];
                letters[at] = symbols[(frame * 3 + region * 2 + j) % symbols.len()];
            }
        }
        result.text = letters.into_iter().collect();
    } else if effect == 2 {
        // One symmetric breath with a quiet rest, no abrupt reversal at its
        // peak. Ten percent is the approved maximum, not a permanent zoom.
        let t = seconds.rem_euclid(6.8);
        if t < 5.6 {
            result.scale = 1. + 0.1 * (t / 5.6 * std::f64::consts::PI).sin().powi(4);
        }
    } else if effect == 3 {
        result.opacity = 0.12 + 0.58 * (seconds * std::f64::consts::PI / 5.6).sin().powi(2);
    } else if effect == 4 {
        // The author's name is written once, left to right, by a soft hand;
        // then a faint warm glow settles in and breathes slowly. `scale`
        // carries how much of the name is written, `opacity` the glow.
        let smooth = |x: f64| x * x * (3. - 2. * x);
        result.scale = smooth(((seconds - 0.4) / 2.4).clamp(0., 1.));
        let settled = smooth(((seconds - 2.2) / 1.2).clamp(0., 1.));
        let breath = 0.5 + 0.5 * (std::f64::consts::TAU * (seconds - 3.4) / 6.4).cos();
        result.opacity = settled * (0.18 + 0.3 * breath);
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_mapping_and_transition_share_one_frame() {
        let mut k = Kernel::create();
        k.insert(1, 0.);
        k.map(2, 1, vec![0., 1.], vec![12., 20.], true);
        k.target(1, 1., 1000., 0., vec![0., 0.], false);
        k.frame(0.);
        let v = k.frame(500.);
        assert_eq!(v[..3], [1., 0.5, 0.]);
        assert_eq!(v[3..], [2., 16., 0.]);
        k.active(false);
        k.frame(90000.);
        k.active(true);
        k.frame(99000.);
        assert_eq!(k.channels[&1].value, 0.5);
        assert!(k.frame(99500.).contains(&20.));
    }
    #[test]
    fn typography_preserves_readability_and_ten_percent_breath() {
        let text = "Они кажутся абсолютно реальными, пока ты спишь.";
        for i in 0..200 {
            let f = text_frame(text, 1, i as f64 / 10., false);
            assert_eq!(f.text.chars().count(), text.chars().count());
            assert!((0.0..=1.).contains(&f.opacity));
            let b = text_frame("Одному", 2, i as f64 / 10., false);
            assert!((1.0..=1.10000001).contains(&b.scale));
        }
        assert_eq!(text_frame("Одному", 2, 2.8, false).scale, 1.1);
        assert_eq!(text_frame(text, 1, 3., true).opacity, 0.);
    }
    #[test]
    fn conclusion_and_breath_repeat_with_rest_and_reduce_to_still() {
        for t in [0., 0.8, 2.8, 4.6, 5.9] {
            assert!(
                (text_frame("Одному", 2, t, false).scale
                    - text_frame("Одному", 2, t + 6.8, false).scale)
                    .abs()
                    < 1e-12
            );
            assert!(
                (text_frame("Но они не ты.", 3, t, false).opacity
                    - text_frame("Но они не ты.", 3, t + 5.6, false).opacity)
                    .abs()
                    < 1e-12
            );
        }
        assert_eq!(text_frame("Одному", 2, 6., false).scale, 1.);
        assert_eq!(text_frame("Одному", 2, 2.8, true).scale, 1.);
        assert!(text_frame("Но они не ты.", 3, 2.8, false).opacity > 0.69);
    }
    #[test]
    fn the_signature_is_written_once_then_glows_softly() {
        let name = "#Яна Корнилова";
        let start = text_frame(name, 4, 0., false);
        assert!(start.scale == 0. && start.opacity == 0., "unwritten and dark until seen");
        let mut written = 0.;
        for i in 0..400 {
            let f = text_frame(name, 4, i as f64 / 20., false);
            assert!(f.scale >= written, "the hand never goes back");
            written = f.scale;
            assert!((0.0..=0.4800001).contains(&f.opacity), "a faint glow, never a flare");
        }
        assert_eq!(text_frame(name, 4, 2.8, false).scale, 1.);
        for t in [4., 7.3, 11.] {
            let (a, b) = (text_frame(name, 4, t, false), text_frame(name, 4, t + 6.4, false));
            assert!((a.opacity - b.opacity).abs() < 1e-12 && a.scale == 1.);
        }
        let still = text_frame(name, 4, 0., true);
        assert!(still.scale == 1. && still.opacity == 0., "reduced motion shows the whole name");
    }
}
