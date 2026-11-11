//! Browser adapter for `icon_motion`: Rust builds the glyph's SVG strokes and writes
//! every intermediate pose. The bridge only forwards taps, glyph changes and frames.
use crate::icon_motion::{self, Glyph, Scene, Spring, MORPH};
use wasm_bindgen::prelude::*;
use web_sys::Element;

const SVG: &str = "http://www.w3.org/2000/svg";

/// A value that eases toward a target, started on the next frame.
#[derive(Clone, Copy)]
struct Tween {
    from: f32,
    to: f32,
    start: Option<f64>,
    pending: bool,
}
impl Tween {
    fn rest(value: f32) -> Self {
        Self {
            from: value,
            to: value,
            start: None,
            pending: false,
        }
    }
    fn retarget(&mut self, to: f32, now: Option<f64>, snap: bool) {
        let current = now.map_or(self.to, |at| self.value(at));
        *self = if snap {
            Self::rest(to)
        } else {
            Self {
                from: current,
                to,
                start: None,
                pending: true,
            }
        };
    }
    fn begin(&mut self, at: f64) {
        if self.pending {
            self.start = Some(at);
            self.pending = false;
        }
    }
    fn progress(&self, at: f64, seconds: f32) -> f32 {
        self.start.map_or(if self.pending { 0. } else { 1. }, |s| {
            ((at - s) as f32 / 1000. / seconds).clamp(0., 1.)
        })
    }
    fn value(&self, at: f64) -> f32 {
        self.from + (self.to - self.from) * self.progress(at, 0.26)
    }
    fn spring(&self, at: f64, spring: Spring) -> f32 {
        let t = self.start.map_or(if self.pending { 0. } else { 10. }, |s| {
            (at - s) as f32 / 1000.
        });
        self.from + (self.to - self.from) * spring.at(t)
    }
    fn moving(&self, at: f64, seconds: f32) -> bool {
        self.pending
            || self
                .start
                .is_some_and(|s| ((at - s) as f32) < seconds * 1000.)
    }
}

#[wasm_bindgen]
pub struct IconMotion {
    root: Element,
    glyph: Glyph,
    nodes: Vec<Element>,
    round: bool,
    stroke: f32,
    tap: Option<f64>,
    tap_pending: bool,
    morph: Tween,
    fill: Tween,
    reduced: bool,
    last: f64,
}

fn attr(node: &Element, key: &str, value: impl ToString) {
    let _ = node.set_attribute(key, &value.to_string());
}

#[wasm_bindgen]
impl IconMotion {
    /// `stroke` is the approved line width in layout pixels and `width` the glyph's
    /// rendered width, so the still glyph matches the former raster exactly.
    pub fn create(
        root: Element,
        name: &str,
        filled: bool,
        round: bool,
        stroke: f32,
        width: f32,
    ) -> Result<IconMotion, JsValue> {
        let glyph = icon_motion::glyph(name)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown icon {name}")))?;
        let mut icon = IconMotion {
            root,
            glyph,
            nodes: Vec::new(),
            round,
            stroke: stroke * glyph.view[2] / width.max(1.),
            tap: None,
            tap_pending: false,
            morph: Tween::rest(if name == "pause" { 1. } else { 0. }),
            fill: Tween::rest(if filled { 1. } else { 0. }),
            reduced: false,
            last: 0.,
        };
        icon.build()?;
        icon.paint(0.);
        Ok(icon)
    }
    fn build(&mut self) -> Result<(), JsValue> {
        let document = web_sys::window()
            .and_then(|w| w.document())
            .ok_or("no document")?;
        let svg = document.create_element_ns(Some(SVG), "svg")?;
        let [x, y, w, h] = self.glyph.view;
        attr(&svg, "viewBox", format!("{x} {y} {w} {h}"));
        attr(&svg, "width", "100%");
        attr(&svg, "height", "100%");
        attr(&svg, "overflow", "visible");
        attr(&svg, "aria-hidden", "true");
        attr(
            &svg,
            "style",
            "display:block;overflow:visible;pointer-events:none",
        );
        self.nodes.clear();
        for part in self.glyph.parts {
            let node = document.create_element_ns(Some(SVG), "path")?;
            if !part.d.is_empty() {
                attr(&node, "d", part.d);
            }
            if part.fill {
                attr(&node, "fill", "currentColor");
                attr(&node, "stroke", "none");
            } else {
                attr(&node, "fill", "currentColor");
                attr(&node, "fill-opacity", 0);
                attr(&node, "stroke", "currentColor");
                attr(&node, "stroke-width", format!("{:.4}", self.stroke));
                attr(
                    &node,
                    "stroke-linecap",
                    if self.round { "round" } else { "butt" },
                );
                attr(&node, "stroke-linejoin", "round");
            }
            svg.append_child(&node)?;
            self.nodes.push(node);
        }
        self.root.replace_children_with_node_1(&svg);
        Ok(())
    }
    /// Swaps the glyph. Play and pause morph into each other; any other change redraws.
    pub fn set_name(&mut self, name: &str) -> Result<(), JsValue> {
        let next = icon_motion::glyph(name)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown icon {name}")))?;
        if next.scene == Scene::Playback && self.glyph.scene == Scene::Playback {
            let reduced = self.reduced;
            self.morph.retarget(
                if name == "pause" { 1. } else { 0. },
                Some(self.last),
                reduced,
            );
            if !reduced {
                self.play();
            }
            return Ok(());
        }
        self.glyph = next;
        self.tap = None;
        self.build()?;
        self.paint(self.last);
        Ok(())
    }
    pub fn set_filled(&mut self, filled: bool) {
        self.fill
            .retarget(if filled { 1. } else { 0. }, Some(self.last), self.reduced);
        if self.reduced {
            self.paint(self.last);
        }
    }
    /// Plays the glyph's tap scene from its start on the next frame.
    pub fn play(&mut self) {
        if !self.reduced {
            self.tap_pending = true;
        }
    }
    pub fn reduced(&mut self, value: bool) {
        self.reduced = value;
        if value {
            self.tap = None;
            self.tap_pending = false;
            self.morph = Tween::rest(self.morph.to);
            self.fill = Tween::rest(self.fill.to);
            self.paint(self.last);
        }
    }
    /// Advances to `at` (ms). Returns whether another frame is needed.
    pub fn frame(&mut self, at: f64) -> bool {
        self.last = at;
        if self.tap_pending {
            self.tap = Some(at);
            self.tap_pending = false;
        }
        self.morph.begin(at);
        self.fill.begin(at);
        self.paint(at);
        let scene = self
            .tap
            .is_some_and(|s| ((at - s) as f32) < icon_motion::duration(self.glyph.scene) * 1000.);
        if !scene {
            self.tap = None;
        }
        scene || self.morph.moving(at, MORPH.settle()) || self.fill.moving(at, 0.26)
    }
    fn paint(&self, at: f64) {
        let t = self.tap.map(|s| ((at - s) as f32 / 1000.).max(0.));
        let morph = (self.glyph.scene == Scene::Playback)
            .then(|| icon_motion::playback(self.morph.spring(at, MORPH)));
        let fill = self.fill.value(at);
        for (i, node) in self.nodes.iter().enumerate() {
            let pose = match t {
                Some(t) if t < icon_motion::duration(self.glyph.scene) => {
                    icon_motion::pose(&self.glyph, i, t)
                }
                _ => icon_motion::still(&self.glyph, i),
            };
            attr(node, "transform", pose.transform());
            // Play's second stroke is a point until it opens into pause's right bar.
            let opacity = if morph.is_some() && i == 1 {
                (self.morph.spring(at, MORPH) * 4.).clamp(0., 1.)
            } else {
                pose.opacity
            };
            attr(node, "opacity", format!("{opacity:.3}"));
            if let Some(d) = morph.as_ref().map(|m| m[i.min(1)].clone()).or(pose.d) {
                attr(node, "d", d);
            }
            if !self.glyph.parts[i].fill {
                attr(node, "fill-opacity", format!("{fill:.3}"));
            }
            match pose.drawn {
                Some((share, length)) => {
                    attr(node, "stroke-dasharray", format!("{length} {length}"));
                    attr(
                        node,
                        "stroke-dashoffset",
                        format!("{:.3}", length * (1. - share)),
                    );
                }
                None => {
                    let _ = node.remove_attribute("stroke-dasharray");
                    let _ = node.remove_attribute("stroke-dashoffset");
                }
            }
        }
    }
    pub fn dispose(&mut self) {
        self.root.replace_children_with_node_0();
        self.nodes.clear();
    }
}
