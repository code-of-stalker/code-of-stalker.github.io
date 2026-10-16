//! DOM is only the browser's text/layout presentation. Rust owns every intermediate
//! transition value, easing, delay, retarget and marquee position on the shared clock.
use crate::{clock::Clock, inertial_progress::ProgressSpring, timeline::Transition};
use wasm_bindgen::prelude::*;
use web_sys::HtmlElement;
#[wasm_bindgen]
pub struct ElementTimeline {
    root: HtmlElement,
    clock: Clock,
    channels: [Transition; 6],
    scale_spring: Option<ProgressSpring>,
    height: Option<Transition>,
    scan: Option<Transition>,
    active: bool,
    dirty: bool,
    loop_width: f64,
    speed: f64,
    offset: f64,
    last_offset: f64,
}
#[wasm_bindgen]
impl ElementTimeline {
    pub fn create(root: HtmlElement) -> Self {
        Self {
            root,
            clock: Clock::default(),
            channels: [
                Transition::new(1.),
                Transition::new(0.),
                Transition::new(0.),
                Transition::new(1.),
                Transition::new(0.),
                Transition::new(100.),
            ],
            active: true,
            scale_spring: None,
            height: None,
            scan: None,
            dirty: true,
            loop_width: 0.,
            speed: 0.,
            offset: 0.,
            last_offset: 0.,
        }
    }
    pub fn initial(&mut self, values: Vec<f64>) {
        for (c, v) in self.channels.iter_mut().zip(values) {
            *c = Transition::new(v as f32);
        }
        self.dirty = true;
        self.paint();
    }
    pub fn target(&mut self, values: Vec<f64>, duration: f64, delay: f64, curve: Vec<f64>) {
        let curve = if curve.len() == 4 {
            [
                curve[0] as f32,
                curve[1] as f32,
                curve[2] as f32,
                curve[3] as f32,
            ]
        } else {
            [0.22, 0.8, 0.2, 1.]
        };
        if !self.moving() {
            self.clock.suspend();
        }
        for (c, v) in self.channels.iter_mut().zip(values) {
            if v.is_nan() {
                *c = Transition::new(c.value(self.clock.elapsed));
            } else if v.is_finite() {
                c.to(
                    v as f32,
                    self.clock.elapsed,
                    duration.max(0.) / 1000.,
                    delay.max(0.) / 1000.,
                    curve,
                );
            }
        }
        self.dirty = true;
    }
    pub fn active(&mut self, value: bool) {
        if self.active != value {
            self.clock.suspend();
        }
        self.active = value;
    }
    pub fn initial_height(&mut self, value: f64) {
        if value.is_finite() {
            self.height = Some(Transition::new(value.max(0.) as f32));
            self.dirty = true;
            self.paint();
        }
    }
    pub fn target_height(&mut self, value: f64, duration: f64) {
        self.target_height_curve(value, duration, Vec::new());
    }
    pub fn target_height_curve(&mut self, value: f64, duration: f64, curve: Vec<f64>) {
        if !value.is_finite() {
            return;
        }
        if !self.moving() {
            self.clock.suspend();
        }
        let height = self.height.get_or_insert_with(|| Transition::new(0.));
        height.to(
            value.max(0.) as f32,
            self.clock.elapsed,
            duration.max(0.) / 1000.,
            0.,
            if curve.len() == 4 {
                [
                    curve[0] as f32,
                    curve[1] as f32,
                    curve[2] as f32,
                    curve[3] as f32,
                ]
            } else {
                [0.22, 0.8, 0.2, 1.]
            },
        );
        self.dirty = true;
    }
    /// Original Laboratory scanner on a text/layout surface, with no GPU pass.
    pub fn scan_reveal(&mut self, duration: f64, delay: f64) {
        let mut scan = Transition::new(0.);
        scan.to(
            1.,
            self.clock.elapsed,
            duration.max(0.) / 1000.,
            delay.max(0.) / 1000.,
            [0., 0., 1., 1.],
        );
        self.scan = Some(scan);
        self.dirty = true;
        self.paint();
    }
    /// Gesture input only changes the target. The shared Rust clock retains
    /// position/velocity between touch events and owns every displayed frame.
    pub fn spring_scale(&mut self, value: f64, snap: bool) {
        if !value.is_finite() {
            return;
        }
        if !self.moving() {
            self.clock.suspend();
        }
        let spring = self.scale_spring.get_or_insert_with(|| {
            ProgressSpring::new(self.channels[3].value(self.clock.elapsed) as f64)
        });
        spring.target(value, snap);
        self.dirty = true;
    }
    pub fn loop_width(&self) -> f64 {
        self.loop_width
    }
    pub fn r#loop(&mut self, width: f64, speed: f64) {
        // Keep the current physical position when layout or target cadence changes.
        if self.loop_width > 0. && width > 0. {
            self.offset = self.last_offset + self.clock.elapsed * speed;
        }
        self.loop_width = width.max(0.);
        self.speed = speed.max(0.);
        self.dirty = true;
    }
    pub fn reset_clock(&mut self) {
        self.clock.suspend();
    }
    pub fn moving(&self) -> bool {
        self.loop_width > 0. && self.speed > 0.
            || self.channels.iter().any(|c| c.moving(self.clock.elapsed))
            || self.scale_spring.is_some_and(|spring| spring.moving())
            || self
                .height
                .is_some_and(|height| height.moving(self.clock.elapsed))
            || self
                .scan
                .is_some_and(|scan| scan.moving(self.clock.elapsed))
    }
    pub fn frame(&mut self, at: f64) -> bool {
        if !self.active {
            self.clock.suspend();
            return false;
        }
        if !self.dirty && !self.moving() {
            self.clock.suspend();
            return false;
        }
        let dt = self.clock.step(at, true);
        if let Some(spring) = &mut self.scale_spring {
            spring.step(dt);
        }
        self.paint();
        self.dirty = false;
        true
    }
    pub fn dispose(&mut self) {
        self.active = false;
    }
    fn paint(&mut self) {
        let mut value = self.channels.map(|c| c.value(self.clock.elapsed));
        if let Some(spring) = self.scale_spring {
            value[3] = spring.position as f32;
        }
        let mut x = value[1] as f64;
        if self.loop_width > 0. {
            self.last_offset =
                -((self.clock.elapsed * self.speed - self.offset).rem_euclid(self.loop_width));
            x += self.last_offset;
        }
        let style = self.root.style();
        if let Some(height) = self.height {
            let _ =
                style.set_property("height", &format!("{}px", height.value(self.clock.elapsed)));
        }
        if let Some(scan) = self.scan {
            crate::panel_reveal::panel_reveal(&self.root, scan.value(self.clock.elapsed), false);
        }
        let _ = style.set_property("opacity", &value[0].to_string());
        let scale = if self.root.has_attribute("data-rust-scale-x") {
            "scaleX"
        } else {
            "scale"
        };
        let _ = style.set_property(
            "transform",
            &format!(
                "translate3d({x}px,{}px,0) {scale}({}) rotate({}deg)",
                value[2], value[3], value[4]
            ),
        );
    }
}
