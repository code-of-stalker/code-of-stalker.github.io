//! Rust animation model using the original SVG as an authoring description.
//! The product painter consumes its geometry through the shared GPU renderer.
//! Browser SVG painting is reserved for the explicit migration diagnostic.
use crate::{
    clock::Clock,
    decoder::Decoder,
    gesture::Gesture,
    tracks::{self, Track},
    voice::{mesh, orbit, Voice},
};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{Element, HtmlElement};
#[wasm_bindgen]
pub struct SvgTimeline {
    root: Element,
    nodes: Vec<Element>,
    tracks: Vec<Track>,
    reading: Option<ReadingMotion>,
    kind: String,
    active: bool,
    reduced: bool,
    clock: Clock,
    voice: Voice,
    voice_playback: bool,
    voice_locked: bool,
    lock_visible: crate::timeline::Transition,
    decoder: Decoder,
    target: [f32; 2],
    aim: [f32; 2],
    pressed: bool,
    interaction: f64,
    width: f32,
    height: f32,
    card: bool,
    draws: u32,
    gesture: Gesture,
    cache: std::cell::RefCell<std::collections::BTreeMap<String, Vec<Element>>>,
}
struct ReadingMotion {
    full: crate::reading_curves::Curves,
    soft: crate::reading_curves::Curves,
    full_still: crate::reading_curves::Curves,
    soft_still: crate::reading_curves::Curves,
    soft_theme: bool,
}
fn error(value: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&value.to_string())
}
fn attr(node: &Element, name: &str, value: impl ToString) {
    let _ = node.set_attribute(name, &value.to_string());
}
fn style(node: &Element, name: &str, value: impl ToString) {
    if let Some(html) = node.dyn_ref::<HtmlElement>() {
        let _ = html.style().set_property(name, &value.to_string());
    } else {
        let old = node.get_attribute("style").unwrap_or_default();
        let prefix = format!("{name}:");
        let mut styles = old
            .split(';')
            .filter(|p| !p.trim().starts_with(&prefix))
            .map(str::to_string)
            .collect::<Vec<_>>();
        styles.push(format!("{name}:{}", value.to_string()));
        attr(node, "style", styles.join(";"));
    }
}
macro_rules! scene{($kind:expr,$($name:literal),*)=>{match $kind{$($name=>(include_str!(concat!("../assets/",$name,".svg")),include_str!(concat!("../assets/",$name,".tracks.xml"))),)*_=>return Err(error("Unknown Rust vector scene"))}}}
#[wasm_bindgen]
impl SvgTimeline {
    pub(crate) fn model_root(&self) -> Element {
        self.root.clone()
    }
    pub fn create(root: Element, kind: &str, card: bool) -> Result<Self, JsValue> {
        let reading_assets = crate::reading_curves::assets(kind);
        let task_svg = crate::grounding::svg(kind).or_else(|| crate::step_two_tasks::svg(kind)).or_else(|| crate::step_three::svg(kind));
        let (svg, source) = if let Some(svg) = task_svg.as_deref() {
            (svg, "<tracks duration=\"0\"></tracks>")
        } else if let Some(assets) = &reading_assets {
            (assets.svg, "<tracks duration=\"0\"></tracks>")
        } else if kind == "voice" {
            (
                include_str!("../assets/voice.html"),
                "<tracks duration=\"0\"></tracks>",
            )
        } else if kind == "insight" {
            (
                include_str!("../assets/insight.html"),
                include_str!("../assets/insight.tracks.xml"),
            )
        } else {
            scene!(
                kind,
                "distance",
                "cells",
                "diary",
                "basic",
                "guidance",
                "parallel",
                "intensive",
                "attention",
                "comparison",
                "crowd"
            )
        };
        root.set_inner_html(svg);
        attr(&root, "data-rust-scene", kind);
        // Authored dark material is remapped by the shared Rust GPU palette.
        // The native SVG presentation adapter receives its palette through the
        // same Rust API, before its first paint.
        for (key, value) in [
            ("ink", "#E7E100"),
            ("light", "#FFF9D4"),
            ("cover", "#060600"),
            ("paper", "#0F0F00"),
            ("edge", "#1C1B00"),
            ("dim", "#454400"),
            ("line", "#969200"),
            ("bright", "#C4BF00"),
        ] {
            style(&root, &format!("--book-{key}"), value);
        }
        if kind == "voice" {
            if let (Some(svg), Some(lock)) = (
                root.query_selector(".vr-art")?,
                root.query_selector(".vr-lock svg")?,
            ) {
                let group = web_sys::window()
                    .unwrap()
                    .document()
                    .unwrap()
                    .create_element_ns(Some("http://www.w3.org/2000/svg"), "g")?;
                attr(&group, "class", "vr-lock-gpu");
                attr(&group, "fill", "none");
                attr(&group, "stroke", "#E7E100");
                attr(&group, "stroke-width", 1.2);
                attr(&group, "transform", "translate(108 -64)");
                attr(&group, "opacity", 0);
                while let Some(child) = lock.first_child() {
                    group.append_child(&child)?;
                }
                svg.append_child(&group)?;
                if let Some(container) = root.query_selector(".vr-lock")? {
                    style(&container, "display", "none");
                }
            }
        }
        // Every visible interpolation is Rust-owned, including icon reveals.
        let all = root.query_selector_all("*")?;
        for node in (0..all.length())
            .filter_map(|i| all.item(i))
            .map(JsCast::unchecked_into::<Element>)
        {
            style(&node, "animation", "none!important");
            style(&node, "transition", "none!important");
        }
        let list = root.query_selector_all("[data-rust-node]")?;
        let mut nodes = Vec::new();
        for i in 0..list.length() {
            nodes.push(list.item(i).unwrap().unchecked_into());
        }
        let model = Self {
            root,
            nodes,
            tracks: tracks::parse(source).map_err(error)?,
            reading: reading_assets
                .map(|a| -> Result<_, JsValue> {
                    Ok(ReadingMotion {
                        full: crate::reading_curves::Curves::parse(a.full)
                            .map_err(|v| error(format!("Reading curves: {v:?}")))?,
                        soft: crate::reading_curves::Curves::parse(a.soft)
                            .map_err(|v| error(format!("Reading curves: {v:?}")))?,
                        full_still: crate::reading_curves::Curves::parse(a.full_still)
                            .map_err(|v| error(format!("Reading pose: {v:?}")))?,
                        soft_still: crate::reading_curves::Curves::parse(a.soft_still)
                            .map_err(|v| error(format!("Reading pose: {v:?}")))?,
                        soft_theme: false,
                    })
                })
                .transpose()?,
            kind: kind.into(),
            active: false,
            reduced: false,
            clock: Clock::default(),
            voice: Voice::default(),
            voice_playback: false,
            voice_locked: false,
            lock_visible: crate::timeline::Transition::new(0.),
            decoder: Decoder::default(),
            target: [0.; 2],
            aim: [0.; 2],
            pressed: false,
            interaction: f64::INFINITY,
            width: 1.,
            height: 1.,
            card,
            draws: 0,
            gesture: Gesture::default(),
            cache: Default::default(),
        };
        for curve in &model.tracks {
            if curve.node >= model.nodes.len() {
                return Err(error(format!(
                    "{}: curve refers to missing node {}",
                    kind, curve.node
                )));
            }
        }
        for curve in &model.tracks {
            attr(&model.nodes[curve.node], "data-rust-dynamic", "true");
        }
        if let Some(reading) = &model.reading {
            for curves in [
                &reading.full,
                &reading.soft,
                &reading.full_still,
                &reading.soft_still,
            ] {
                for field in &curves.fields {
                    let node = model
                        .nodes
                        .get(field.node)
                        .ok_or_else(|| error("Missing reading node"))?;
                    attr(node, "data-rust-dynamic", "true");
                }
            }
        }
        // Components retain their original contours. Layout is a viewport event.
        if let Some(svg) = model.one("svg") {
            attr(
                &svg,
                "style",
                "width:100%;height:100%;display:block;overflow:visible;animation:none!important",
            );
        }
        if kind == "insight" {
            if let Some(svg) = model.one("svg") {
                style(&svg, "height", "auto");
                style(&svg, "aspect-ratio", "400 / 94");
            }
        }
        if kind == "parallel" {
            if let Some(svg) = model.one("svg") {
                // Retain the original helix coordinates and reserve space for
                // its top light's filter halo inside the GPU viewport.
                attr(&svg, "viewBox", "0 -24 288 180");
            }
        }
        if kind == "voice" {
            if let Some(art) = model.one(".voice-recorder") {
                attr(&art, "data-active", "true");
                style(&art, "width", "100%");
                style(&art, "height", "100%");
            }
            if let Some(button) = model.one(".vr-button") {
                style(&button, "width", "100%");
                style(&button, "height", "100%");
            }
            if let Some(art) = model.one(".vr-art") {
                style(&art, "height", "100%");
            }
        }
        let mut model = model;
        model.paint(0.);
        Ok(model)
    }
    pub fn active(&mut self, value: bool, reduced: bool) {
        if self.active != value || self.reduced != reduced {
            self.clock.suspend();
            if !value {
                self.gesture.cancel();
                self.pressed = false;
                self.interaction = f64::INFINITY;
                self.target = [0.; 2];
                self.aim = [0.; 2];
            }
        }
        self.active = value;
        self.reduced = reduced;
    }
    pub fn reset_clock(&mut self) {
        self.clock.suspend();
    }
    pub fn pointer_down(&mut self, at: f64, width: f64, height: f64, delay: f64) {
        self.gesture.down(at, width, height, delay);
    }
    pub fn pointer_move(&mut self, at: f64, dx: f64, dy: f64) {
        let (begin, point) = self.gesture.drag(at, dx, dy);
        if begin {
            self.interact("hold", 0., 0.);
        }
        self.target = point;
    }
    pub fn pointer_up(&mut self, at: f64, inside: bool) -> bool {
        let tap = self.gesture.up(at, inside);
        self.interact("release", 0., 0.);
        if tap {
            self.interact("tap", 0., 0.);
            self.pressed = false;
        }
        tap
    }
    pub fn resize(&mut self, width: f32, height: f32) {
        self.width = width.max(1.);
        self.height = height.max(1.);
        if self.kind == "voice" {
            let scale = 338. / self.width;
            self.set(
                ".vr-lock-gpu",
                "transform",
                format!("translate({} -64) scale({scale})", 120. - 12. * scale),
            );
        }
        if self.kind == "insight" {
            for (i, line) in self.all(".mx-decoder-line").iter().enumerate() {
                let maximum = if i == 0 { 22. } else { 30. };
                style(line, "font-size", format!("{maximum}px"));
                style(line, "letter-spacing", "2.2px");
                let scale = ((self.width - 1.) / line.scroll_width() as f32).min(1.);
                style(line, "font-size", format!("{}px", maximum * scale));
                style(line, "letter-spacing", format!("{}px", 2.2 * scale));
            }
        }
        if self.card {
            let logical = 288. * self.height / self.width;
            if self.kind == "thought-loop" {
                // Keep the terminal centered above the home card copy. The
                // authored geometry is scaled uniformly, including its depth.
                let scale = ((logical - 48.) / 135.).clamp(0.62, 1.05);
                if let Some(svg) = self.one("svg") {
                    attr(&svg, "viewBox", format!("{} {} {} {}",
                        144. - 144. / scale, 30. - 10. / scale,
                        288. / scale, logical / scale));
                    attr(&svg, "data-home-terminal-composition", "true");
                }
                return;
            }
            if self.kind == "book" {
                // Uniformly fit artwork to the full height, centered in the
                // card. Keep authored mask coordinate systems intact.
                let scale = ((logical - 24.) / 180.).clamp(0.55, 0.95);
                if let Some(svg) = self.one("svg") {
                    attr(
                        &svg,
                        "viewBox",
                        format!(
                            "{} {} {} {}",
                            144. - 144. / scale,
                            (206. - logical / scale) * 0.5,
                            288. / scale,
                            logical / scale
                        ),
                    );
                    attr(&svg, "data-home-book-composition", "true");
                }
                return;
            }
            let base = if self.kind == "diary" {
                130.
            } else if self.kind == "distance" {
                200.
            } else {
                156.
            };
            let y = (base - logical) * 0.5;
            if let Some(svg) = self.one("svg") {
                attr(&svg, "viewBox", format!("0 {y} 288 {logical}"));
            }
            for element in self.all("[data-distance-card-mask],[data-distance-soft-edge],[data-distance-soft-edge] rect"){attr(&element,"x",0);attr(&element,"y",y);attr(&element,"width",288);attr(&element,"height",logical);}
            if let Some(edge) = self.one("[data-distance-card-edge]") {
                attr(&edge, "y1", y + logical - (logical * 0.15).min(24.));
                attr(&edge, "y2", y + logical);
            }
        }
    }
    pub fn interact(&mut self, action: &str, x: f32, y: f32) {
        match action {
            "hold" | "tap" => {
                self.pressed = action == "hold";
                self.interaction = self.clock.elapsed;
            }
            "release" => {
                self.gesture.cancel();
                self.pressed = false;
                self.target = [0.; 2];
            }
            "move" => self.target = [x.clamp(-1., 1.), y.clamp(-1., 1.)],
            _ => {}
        }
    }
    pub fn audio(
        &mut self,
        low: f64,
        mid: f64,
        high: f64,
        contour: Vec<f64>,
        reacting: bool,
        lock_progress: f64,
        locked: bool,
        playback: bool,
    ) {
        self.voice_playback = playback;
        self.voice_locked = locked;
        self.lock_visible.to(
            if reacting && !playback { 1. } else { 0. },
            self.clock.elapsed,
            0.18,
            0.,
            [0., 0., 0.58, 1.],
        );
        self.voice.input = [low, mid, high];
        self.voice.contour = contour;
        self.voice.reacting = reacting;
        self.voice.lock_target = lock_progress.clamp(0., 1.);
        if let Some(root) = self.one(".voice-recorder") {
            attr(
                &root,
                "data-state",
                if reacting { "recording" } else { "idle" },
            );
            attr(&root, "data-locked", locked);
            attr(
                &root,
                "data-source",
                if playback {
                    "playback"
                } else if reacting {
                    "mic"
                } else {
                    "idle"
                },
            );
        }
    }
    pub fn decoder_visible(&mut self, value: bool) {
        self.decoder.visible(value);
    }
    pub fn frame(&mut self, now: f64) -> bool {
        if !self.active {
            self.clock.suspend();
            return false;
        }
        if self.gesture.hold(now) {
            self.interact("hold", 0., 0.);
        }
        let dt = self.clock.step(now, true);
        self.paint(dt);
        self.draws += 1;
        true
    }
    pub fn draws(&self) -> u32 {
        self.draws
    }
    pub fn time(&self) -> f64 {
        self.clock.elapsed
    }
    pub(crate) fn is_reading(&self) -> bool {
        self.reading.is_some()
    }
    pub fn reading_palette(&mut self, code: u32) {
        if let Some(reading) = &mut self.reading {
            reading.soft_theme = code == 2;
        }
        self.paint(0.);
    }
    pub fn dispose(&mut self) {
        self.root.set_inner_html("");
        self.nodes.clear();
        self.active = false;
    }
}
impl SvgTimeline {
    fn one(&self, selector: &str) -> Option<Element> {
        self.all(selector).into_iter().next()
    }
    fn all(&self, selector: &str) -> Vec<Element> {
        if let Some(nodes) = self.cache.borrow().get(selector) {
            return nodes.clone();
        }
        let nodes: Vec<Element> = self
            .root
            .query_selector_all(selector)
            .map(|list| {
                (0..list.length())
                    .filter_map(|i| list.item(i).map(JsCast::unchecked_into))
                    .collect()
            })
            .unwrap_or_default();
        self.cache
            .borrow_mut()
            .insert(selector.into(), nodes.clone());
        nodes
    }
    fn set(&self, selector: &str, name: &str, value: impl ToString) {
        if let Some(el) = self.one(selector) {
            attr(&el, name, value);
        }
    }
    fn paint(&mut self, dt: f64) {
        let seconds = self.clock.elapsed;
        attr(&self.root, "data-rust-time", format!("{seconds:.5}"));
        if crate::grounding::contains(&self.kind) {
            for update in crate::grounding::frame(&self.kind, seconds, self.reduced) {
                for node in self.all(&update.selector) { attr(&node, update.attribute, &update.value); }
            }
            return;
        }
        if crate::step_three::contains(&self.kind) {
            for update in crate::step_three::frame(&self.kind, seconds, self.reduced) {
                for node in self.all(&update.selector) {
                    attr(&node, update.attribute, &update.value);
                }
            }
            return;
        }
        if crate::step_two_tasks::contains(&self.kind) {
            for update in crate::step_two_tasks::frame(&self.kind, seconds, self.reduced) {
                for node in self.all(&update.selector) {
                    attr(&node, update.attribute, &update.value);
                }
            }
            return;
        }
        if let Some(reading) = &self.reading {
            let curves = if reading.soft_theme {
                &reading.soft
            } else {
                &reading.full
            };
            // Reset the animated fields before applying the reduced pose so
            // switching preferences never leaves a half-dissolved body behind.
            let time = curves.time(if self.reduced { 0. } else { seconds });
            for field in &curves.fields {
                attr(&self.nodes[field.node], &field.name, field.sample(time));
            }
            if self.reduced {
                let pose = if reading.soft_theme {
                    &reading.soft_still
                } else {
                    &reading.full_still
                };
                for field in &pose.fields {
                    attr(&self.nodes[field.node], &field.name, field.sample(0.));
                }
            }
            // These quiet secondary clocks do not reset at the chapter seam.
            if self.kind == "dream-inward" {
                for (selector, period, amplitude) in [
                    (".theatre-curtain-left", 8.6, 0.48),
                    (".theatre-curtain-right", 10.4, -0.42),
                ] {
                    let sway = if self.reduced {
                        0.
                    } else {
                        (seconds * std::f64::consts::TAU / period).sin() * amplitude
                    };
                    self.set(
                        selector,
                        "transform",
                        format!("translate(0 12) skewX({sway}) translate(0 -12)"),
                    );
                }
            }
            if self.kind == "identity-imprints" {
                for (i, specimen) in self.all(".print-specimen").iter().enumerate() {
                    let sweep = if self.reduced {
                        0.6
                    } else {
                        (seconds / 7.7 + i as f64 * 0.47).fract()
                    };
                    if let Ok(Some(light)) = specimen.query_selector(".print-light") {
                        attr(
                            &light,
                            "transform",
                            format!("translate({} 0)", sweep * 160.),
                        );
                        attr(
                            &light,
                            "opacity",
                            if self.reduced {
                                0.3
                            } else {
                                (sweep * std::f64::consts::PI).sin()
                                    * if reading.soft_theme { 0.55 } else { 0.85 }
                            },
                        );
                    }
                    if let Ok(glints) = specimen.query_selector_all(".ridge-glints path") {
                        for j in 0..glints.length() {
                            let node = glints.item(j).unwrap().unchecked_into::<Element>();
                            let q = if self.reduced {
                                0.
                            } else {
                                (seconds / 6.4 + i as f64 * 0.39 + j as f64 * 0.19).fract()
                            };
                            attr(&node, "stroke-dashoffset", -q);
                            attr(
                                &node,
                                "opacity",
                                if self.reduced {
                                    0.
                                } else {
                                    (q * std::f64::consts::PI).sin()
                                        * if reading.soft_theme { 0.45 } else { 0.7 }
                                },
                            );
                        }
                    }
                }
            }
            if let Some(svg) = self.one("svg") {
                attr(&svg, "data-time", time);
                attr(&svg, "data-cycle", (seconds / curves.duration).floor());
                attr(&svg, "data-duration", curves.duration);
                attr(&svg, "data-running", self.active && !self.reduced);
                attr(&svg, "data-runtime", "rust");
                attr(&svg, "data-loop", (seconds / curves.duration).floor());
            }
            return;
        }
        for curve in &self.tracks {
            if self.kind == "cells" || self.kind == "diary" || self.kind == "insight" {
                continue;
            }
            let sample_seconds = if self.kind == "distance" && self.interaction.is_finite() {
                seconds - self.interaction
            } else {
                seconds
            };
            let mut value = curve.sample(sample_seconds, self.reduced);
            let is_css = curve.name.starts_with("css:");
            let name = curve.name.trim_start_matches("css:");
            if name == "transform" && value.split_whitespace().count() == 6 && !value.contains('(')
            {
                value = format!("matrix({value})");
            }
            if is_css {
                style(&self.nodes[curve.node], name, value);
            } else {
                attr(&self.nodes[curve.node], name, value);
            }
        }
        let (inertia, power) = if self.kind == "diary" {
            (0.8, 18.)
        } else {
            (0.58, 17.5)
        };
        let factor = if self.reduced {
            1.
        } else {
            1. - (-dt / inertia).exp() as f32
        };
        for i in 0..2 {
            self.aim[i] += (if self.reduced {
                0.
            } else {
                self.target[i] * power * if i == 0 { 1. } else { 0.55 }
            } - self.aim[i])
                * factor;
        }
        let offset = format!("translate({} {})", self.aim[0], self.aim[1]);
        for el in
            self.all("[data-distance-parallax],[data-architecture-parallax],[data-diary-parallax]")
        {
            attr(&el, "transform", &offset);
        }
        if self.kind == "cells" || self.kind == "diary" {
            self.paint_cover();
        }
        if self.kind == "voice" {
            self.voice.step(dt, self.reduced);
            self.paint_voice();
        }
        if self.kind == "insight" {
            self.paint_insight();
            self.decoder.step(dt);
            self.paint_decoder();
        }
    }
    fn paint_cover(&self) {
        use crate::cover_motion::{
            self,
            settings::{architecture as a, diary as d},
        };
        let duration = if self.kind == "diary" {
            d::TOUCH_DURATION
        } else {
            a::TOUCH_DURATION
        };
        let age = if self.reduced {
            f64::INFINITY
        } else {
            let age = self.clock.elapsed - self.interaction;
            if self.pressed {
                age.min(duration / 2.)
            } else {
                age
            }
        };
        if self.kind == "cells" {
            let m = cover_motion::cells(
                if self.reduced {
                    a::CYCLE * 0.55
                } else {
                    self.clock.elapsed
                },
                age,
            );
            for (node, value) in self.all("[data-architecture-cell]").iter().zip(m.cells) {
                attr(
                    node,
                    "transform",
                    format!(
                        "translate({} {}) scale({})",
                        value[0],
                        value[1],
                        a::CELL_SIZE
                    ),
                );
                attr(node, "opacity", value[2]);
            }
            self.set(
                "[data-architecture-person]",
                "transform",
                format!("translate(144 {}) scale({})", m.person[0], m.person[1]),
            );
            self.set(
                "[data-architecture-corners]",
                "transform",
                format!(
                    "translate(144 77) scale({}) translate(-144 -77)",
                    m.frame[0]
                ),
            );
            self.set("[data-architecture-corners]", "opacity", m.frame[1]);
            self.set(
                "[data-architecture-light]",
                "transform",
                format!("translate(144 {}) scale({})", m.light[0], a::LIGHT_SIZE),
            );
            self.set("[data-architecture-light]", "opacity", m.light[1]);
            self.set("[data-architecture-scan]", "y", m.scan[0]);
            self.set("[data-architecture-scan]", "opacity", m.scan[1]);
            for (name, value) in ["r", "cy", "opacity"].into_iter().zip(m.ripple) {
                self.set("[data-architecture-ripple]", name, value);
            }
        } else {
            let m = cover_motion::diary(if self.reduced { 0. } else { self.clock.elapsed }, age);
            for node in self.all("[data-diary-layer]") {
                let i = node
                    .get_attribute("data-diary-layer")
                    .unwrap()
                    .parse::<usize>()
                    .unwrap();
                attr(&node, "transform", format!("translate(0 {})", m.layers[i]));
            }
            for scan in self.all("[data-diary-scan]") {
                attr(&scan, "y", m.scan[0]);
                attr(&scan, "opacity", m.scan[1].min(1.));
            }
            for group in self.all("[data-diary-signal]") {
                let list = group.query_selector_all("line,rect,text").unwrap();
                for i in 0..list.length() {
                    let node: Element = list.item(i).unwrap().unchecked_into();
                    let value = m.signal[i as usize % m.signal.len()];
                    match node.tag_name().as_str() {
                        "line" => {
                            attr(&node, "y1", -value[0]);
                            attr(&node, "y2", value[0]);
                        }
                        "rect" => attr(
                            &node,
                            "fill-opacity",
                            (value[1] * d::SIGNAL_AMOUNT / 2. + m.touch * 0.45).min(1.),
                        ),
                        _ => {
                            let symbol = (((self.clock.elapsed * d::SIGNAL_SPEED * 2.).floor()
                                as u32
                                + i * 7)
                                % 13)
                                < 6;
                            node.set_text_content(Some(if symbol { "1" } else { "0" }));
                            attr(&node, "opacity", (value[1] * d::SIGNAL_AMOUNT).min(1.));
                        }
                    }
                }
            }
            self.set("[data-diary-halo]", "opacity", m.halo.min(1.));
            self.set("[data-diary-glow]", "opacity", m.glow.min(1.));
            self.set("[data-diary-trace]", "stroke-dashoffset", m.trace);
            self.set("[data-diary-indicator]", "opacity", m.indicator);
            for (name, value) in ["rx", "ry", "opacity"].into_iter().zip(m.ripple) {
                self.set("[data-diary-ripple]", name, value);
            }
        }
    }
    fn paint_voice(&self) {
        let v = &self.voice;
        let fill = v.arc_fill();
        let visibility = ((fill - 0.005) / 0.07).clamp(0., 1.);
        let energy = v.levels.iter().copied().fold(0., f64::max);
        let glow = (0.25 + energy * 0.75) * 0.85;
        for arc in self.all(".vr-fill-arc") {
            style(
                &arc,
                "opacity",
                visibility
                    * if arc
                        .get_attribute("class")
                        .unwrap_or_default()
                        .split_whitespace()
                        .any(|v| v == "vr-glow")
                    {
                        glow
                    } else {
                        1.
                    },
            );
        }
        for node in self.all(".vr-glow:not(.vr-fill-arc)") {
            style(&node, "opacity", glow);
        }
        for (selector, visible) in [
            (
                ".vr-mic",
                !self.voice_playback && !(v.reacting && self.voice_locked),
            ),
            (".vr-speaker", self.voice_playback),
            (".vr-stop", v.reacting && self.voice_locked),
            (".vr-side-marks", !v.reacting),
        ] {
            for node in self.all(selector) {
                style(&node, "display", if visible { "inline" } else { "none" });
            }
        }
        self.set(
            ".vr-lock-gpu",
            "opacity",
            if self.reduced {
                self.lock_visible.target
            } else {
                self.lock_visible.value(self.clock.elapsed)
            },
        );
        self.set(
            ".vr-low-motion",
            "transform",
            format!("rotate({} 120 105)", v.phase * 5. - 90.),
        );
        self.set(
            ".vr-mid-motion",
            "transform",
            format!("rotate({} 120 105)", -v.spin),
        );
        for arc in self.all(".vr-fill-arc") {
            attr(
                &arc,
                "stroke-dasharray",
                format!("{} {}", 50. * fill, 50. * (1. - fill)),
            );
        }
        if let Some(root) = self.one(".voice-recorder") {
            style(
                &root,
                "--vr-arc-visibility",
                ((fill - 0.005) / 0.07).clamp(0., 1.),
            );
            style(&root, "--vr-mesh-charge", v.mesh_fill());
            style(
                &root,
                "--vr-energy",
                v.levels.iter().copied().fold(0., f64::max),
            );
        }
        let (front, back) = orbit(v.orbit);
        for path in self.all(".vr-sphere-front") {
            attr(&path, "d", &front);
        }
        self.set(".vr-sphere-back", "d", back);
        let rings = mesh(v.mesh_angle, v.mesh_fill());
        for (selector, front) in [(".vr-mesh-front", true), (".vr-mesh-back", false)] {
            for (i, path) in self.all(selector).iter().enumerate() {
                let ring = &rings[i % rings.len()];
                attr(path, "d", if front { &ring.front } else { &ring.back });
                attr(
                    path,
                    "opacity",
                    ring.opacity * if front { 1. } else { 0.28 },
                );
            }
        }
        for (path, ray) in self.all(".vr-ray").iter().zip(v.rays(self.reduced)) {
            for (key, value) in ["x1", "y1", "x2", "y2"].into_iter().zip(ray.ends) {
                attr(path, key, value);
            }
            attr(path, "stroke-width", ray.width);
            attr(path, "opacity", ray.opacity);
        }
        let core = v.core(self.reduced);
        for (key, value) in ["cx", "cy", "r", "opacity"].into_iter().zip(core) {
            self.set(".vr-core-volume", key, value);
        }
        self.set(".vr-mesh-fill", "opacity", v.mesh_fill());
        self.set(
            ".vr-mesh-emission",
            "opacity",
            v.emission.position.clamp(0., 1.),
        );
        for (path, caustic) in self.all(".vr-caustic").iter().zip(v.caustics(self.reduced)) {
            attr(path, "d", caustic.path);
            attr(path, "opacity", caustic.opacity);
            attr(path, "stroke-dasharray", "100 0");
            attr(path, "stroke-dashoffset", caustic.offset);
        }
        for (i, wave) in self.all(".vr-wave").iter().enumerate() {
            let [radius, opacity] = v.wave_frame(i, self.reduced);
            attr(wave, "r", radius);
            attr(wave, "opacity", opacity);
        }
        let p = v.drawn_lock;
        let lift = (p / 0.6).min(1.) * 10.;
        self.set(".vr-lock-arrow", "opacity", 1. - (p / 0.32).min(1.));
        self.set(
            ".vr-lock-arrow",
            "transform",
            format!("translate(0 {})", 8. - lift),
        );
        self.set(
            ".vr-lock-body",
            "opacity",
            ((p - 0.12) / 0.22).clamp(0., 1.),
        );
        self.set(
            ".vr-lock-body",
            "transform",
            format!("translate(0 {})", 10. - lift),
        );
        let fill = ((p - 0.28) / 0.72).max(0.);
        self.set(".vr-lock-fill", "y", 21. - fill * 11.);
        self.set(".vr-lock-fill", "height", fill * 11.);
    }
    fn paint_insight(&self) {
        let m = crate::insight_motion::frame(self.clock.elapsed, self.reduced);
        let gradients = |node: &Element, values: [f64; 4]| {
            for (key, v) in ["x1", "y1", "x2", "y2"].into_iter().zip(values) {
                attr(node, key, v);
            }
        };
        for (i, group) in self.all("[data-inner-ring]").iter().enumerate() {
            if let Ok(paths) = group.query_selector_all("path") {
                for j in 0..paths.length() {
                    let node: Element = paths.item(j).unwrap().unchecked_into();
                    attr(&node, "d", &m.rings[i].path);
                }
            }
        }
        for (i, gradient) in self.all("[data-ring-light]").iter().enumerate() {
            gradients(gradient, m.rings[i].light);
            if let Ok(stops) = gradient.query_selector_all("stop") {
                for j in 0..stops.length() {
                    let node: Element = stops.item(j).unwrap().unchecked_into();
                    attr(&node, "stop-opacity", m.rings[i].opacity[j as usize]);
                }
            }
        }
        if let Some(node) = self
            .one("[data-shell-light]")
            .and_then(|n| n.get_attribute("stroke"))
            .and_then(|v| {
                v.split('#')
                    .nth(1)
                    .map(|s| s.trim_end_matches(')').to_string())
            })
            .and_then(|id| self.one(&format!("[id='{id}']")))
        {
            gradients(&node, m.rim);
        }
        if let Some(node) = self
            .one("[data-shape='sphere']")
            .and_then(|n| n.get_attribute("fill"))
            .and_then(|v| {
                v.split('#')
                    .nth(1)
                    .map(|s| s.trim_end_matches(')').to_string())
            })
            .and_then(|id| self.one(&format!("[id='{id}']")))
        {
            attr(&node, "cx", format!("{}%", m.fill[0]));
            attr(&node, "cy", format!("{}%", m.fill[1]));
        }
        if let Some(group) = self.one("[data-shell-motion]") {
            if let Ok(paths) = group.query_selector_all("path") {
                for i in 0..paths.length() {
                    let node: Element = paths.item(i).unwrap().unchecked_into();
                    attr(&node, "d", &m.orbit);
                    if let Some(id) = node.get_attribute("stroke").and_then(|v| {
                        v.split('#')
                            .nth(1)
                            .map(|s| s.trim_end_matches(')').to_string())
                    }) {
                        if let Some(gradient) = self.one(&format!("[id='{id}']")) {
                            gradients(&gradient, m.orbit_light);
                        }
                    }
                }
            }
        }
        self.set("[data-revealed-by]", "opacity", m.reveal);
        self.set("[data-ornament]", "opacity", m.ornament * 0.82);
        if let Some(group) = self.one("[data-revealed-by]") {
            if let Some(axis) = group.children().item(0) {
                attr(&axis, "opacity", m.ornament * 0.92);
            }
        }
        let sr = 28. * 0.62;
        let centers = [52., 348.];
        for (i, node) in self.all("[data-connection]").iter().enumerate() {
            let start = if i == 0 { 172. } else { 228. };
            let end = centers[i] + if i == 0 { sr } else { -sr };
            attr(
                node,
                "d",
                if m.connection > 0.001 {
                    format!("M{start} 47H{}", start + (end - start) * m.connection)
                } else {
                    String::new()
                },
            );
            attr(
                node,
                "opacity",
                (0.4 + 0.65 * 0.25) * crate::timeline::smooth(0., 0.04, m.connection as f32),
            );
        }
        for (i, node) in self.all("[data-outline-half]").iter().enumerate() {
            let side = i / 2;
            let start = if side == 0 { 0. } else { std::f64::consts::PI };
            let end = start + if i % 2 == 0 { -1. } else { 1. } * std::f64::consts::PI * m.contour;
            attr(
                node,
                "d",
                if m.contour > 0.001 {
                    crate::insight_motion::arc(centers[side], 47., sr, start, end)
                } else {
                    String::new()
                },
            );
            attr(
                node,
                "opacity",
                crate::timeline::smooth(0., 0.04, m.contour as f32),
            );
        }
        for (side, mask) in self.all("mask[id*='fill-assembly']").iter().enumerate() {
            if let Ok(pixels) = mask.query_selector_all("[data-pixel]") {
                for i in 0..pixels.length() {
                    let node: Element = pixels.item(i).unwrap().unchecked_into();
                    attr(&node, "opacity", m.pixels[side][i as usize]);
                }
            }
            if let Some(solid) = mask.query_selector("[data-pixel-fusion]").ok().flatten() {
                attr(&solid, "opacity", m.fusion);
            }
        }
        for node in self.all("[data-revealed-by] > circle[filter]") {
            attr(&node, "opacity", m.filled * 0.22);
        }
        self.set(
            "[data-emission='rim']",
            "opacity",
            (0.78 * m.emission).min(1.),
        );
        for node in self.all("[data-emission='ring']") {
            attr(&node, "opacity", (0.52 * m.emission).min(0.85));
        }
        self.set(
            "[data-emission='local-aura']",
            "opacity",
            (m.emission * 0.95).min(1.),
        );
        self.set(
            "[data-shell-motion]",
            "opacity",
            (0.65 + m.emission * 0.25).min(1.),
        );
    }
    fn paint_decoder(&self) {
        use crate::timeline::smooth;
        if let Some(text) = self.one(".mx-decoder") {
            let p = self.decoder.progress(self.reduced);
            let state = if !self.decoder.started {
                "waiting"
            } else if p < 1. {
                "revealing"
            } else {
                "settled"
            };
            if text.get_attribute("data-motion-state").as_deref() != Some(state) {
                attr(&text, "data-motion-state", state);
            }
            style(
                &text,
                "visibility",
                if self.decoder.started {
                    "visible"
                } else {
                    "hidden"
                },
            );
            style(
                &text,
                "opacity",
                if self.reduced { 1. } else { smooth(0., 0.2, p) },
            );
            style(
                &text,
                "--iw-light",
                0.6 * (0.35 + smooth(0.36, 0.92, p) * 0.65),
            );
            style(
                &text,
                "--iw-scan",
                format!("{}%", smooth(0.08, 0.95, p) * 100.),
            );
            style(
                &text,
                "--iw-scan-opacity",
                if self.decoder.started && p < 1. {
                    (p * std::f32::consts::PI).sin() * 0.9
                } else {
                    0.
                },
            );
            let glyphs = self.all(".mx-code-glyph");
            let locked = (smooth(0.1, 0.95, p) * glyphs.len() as f32).floor() as usize;
            let phase = (self.decoder.elapsed * 7.).floor() as usize;
            let symbols = ['0', '1', '┐', '└', '─', '·'];
            for (i, glyph) in glyphs.iter().enumerate() {
                let stable = !self.decoder.started || i < locked || p == 1.;
                attr(glyph, "data-locked", stable);
                attr(
                    glyph,
                    "data-active",
                    self.decoder.started && i == locked && p < 1.,
                );
                if let Ok(Some(symbol)) = glyph.query_selector(".mx-code-symbol") {
                    symbol.set_text_content(Some(&if stable {
                        glyph.get_attribute("data-character").unwrap()
                    } else {
                        symbols[(i * 5 + phase + i / 3) % symbols.len()].to_string()
                    }));
                }
            }
        }
    }
}
