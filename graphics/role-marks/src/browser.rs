//! Browser adapter: the chat mounts one host element per mark; every frame
//! this writes the moving attributes of the visible marks. Only values that
//! changed are written, and a mark at rest is not touched again until its
//! next beat.
use crate::{Mark, Rgb, Role, Write, REST_FROM, STILL_AT, SVG_NS};
use wasm_bindgen::prelude::*;
use web_sys::Element;

struct Mounted {
    id: u32,
    mark: Mark,
    root: Element,
    elements: Vec<Element>,
    /// Last values written, in `Mark::pose` order.
    written: Vec<Write>,
    visible: bool,
    /// Written at rest; nothing changes until the next beat.
    resting: bool,
}

impl Mounted {
    fn write(&mut self, t: f64) {
        let pose = self.mark.pose(t);
        for (i, (node, name, value)) in pose.iter().enumerate() {
            if self.written.get(i).is_some_and(|old| old.2 == *value) {
                continue;
            }
            let _ = self.elements[*node].set_attribute(name, value);
        }
        self.written = pose;
        self.resting = t >= REST_FROM;
    }
}

#[wasm_bindgen]
#[derive(Default)]
pub struct RoleMarks {
    marks: Vec<Mounted>,
    next: u32,
    reduced: bool,
}

#[wasm_bindgen]
impl RoleMarks {
    #[wasm_bindgen(constructor)]
    pub fn new() -> RoleMarks {
        RoleMarks::default()
    }

    /// Draws a mark into `host`, replacing its children, at `size` layout
    /// pixels. `role`: 0 walker, 1 guide, 2 admin, 3 main admin; `ink` is
    /// `#rrggbb`; `at` is `performance.now()`. Returns the mark's id.
    pub fn mount(
        &mut self,
        host: &Element,
        role: u32,
        ink: &str,
        size: f64,
        at: f64,
    ) -> Result<u32, JsError> {
        let role = Role::from_code(role).ok_or_else(|| JsError::new("unknown role"))?;
        let ink = Rgb::parse(ink).ok_or_else(|| JsError::new("ink must be #rrggbb"))?;
        let document = host
            .owner_document()
            .ok_or_else(|| JsError::new("detached host"))?;
        self.next += 1;
        let mark = Mark::new(role, ink, size, self.next);
        let create = |tag: &str| {
            document
                .create_element_ns(Some(SVG_NS), tag)
                .map_err(|_| JsError::new("SVG unavailable"))
        };
        let root = create("svg")?;
        let side = size.to_string();
        for (name, value) in [
            ("viewBox", "0 0 24 24"),
            ("width", side.as_str()),
            ("height", side.as_str()),
            ("aria-hidden", "true"),
            ("focusable", "false"),
            ("overflow", "visible"),
            ("style", "display:block;overflow:visible"),
        ] {
            let _ = root.set_attribute(name, value);
        }
        let mut elements: Vec<Element> = Vec::with_capacity(mark.nodes().len());
        for node in mark.nodes() {
            let element = create(node.tag)?;
            for (name, value) in &node.attrs {
                let _ = element.set_attribute(name, value);
            }
            let parent = node.parent.map_or(&root, |index| &elements[index]);
            let _ = parent.append_child(&element);
            elements.push(element);
        }
        host.replace_children_with_node_1(&root);
        let mut mounted = Mounted {
            id: self.next,
            mark,
            root,
            elements,
            written: Vec::new(),
            visible: false,
            resting: false,
        };
        mounted.write(self.local(role, at));
        self.marks.push(mounted);
        Ok(self.next)
    }

    pub fn unmount(&mut self, id: u32) {
        if let Some(index) = self.marks.iter().position(|m| m.id == id) {
            self.marks.swap_remove(index).root.remove();
        }
    }

    /// Off-screen or unfocused marks are not written.
    pub fn visible(&mut self, id: u32, value: bool) {
        if let Some(mark) = self.marks.iter_mut().find(|m| m.id == id) {
            mark.visible = value;
        }
    }

    /// Reduced motion: every mark holds its still drawing.
    pub fn reduced(&mut self, value: bool) {
        self.reduced = value;
        if value {
            for mark in &mut self.marks {
                mark.write(STILL_AT);
            }
        }
    }

    /// Writes this moment (`performance.now()`) to the visible marks.
    /// Returns whether any mark is still animating.
    pub fn frame(&mut self, at: f64) -> bool {
        if self.reduced {
            return false;
        }
        let mut any = false;
        for i in 0..self.marks.len() {
            let mark = &self.marks[i];
            if !mark.visible {
                continue;
            }
            any = true;
            let t = self.local(mark.mark.role(), at);
            if t >= REST_FROM && mark.resting {
                continue;
            }
            self.marks[i].write(t);
        }
        any
    }

    pub fn count(&self) -> u32 {
        self.marks.len() as u32
    }
}

impl RoleMarks {
    fn local(&self, role: Role, at: f64) -> f64 {
        if self.reduced {
            STILL_AT
        } else {
            role.local(at / 1000.0)
        }
    }
}
