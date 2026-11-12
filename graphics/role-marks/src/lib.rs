//! Role marks of the Intensive chat: a small animated sign to the right of
//! the author's role in a bubble. Footprints for the walker, a flame of light
//! for the guide, an eye for the admin, a wrench for the main admin (Art's
//! subjects, round 3 of the prototype, 2026-11-11).
//!
//! Every mark is one thin line in the role's ink with faint fills, drawn on a
//! 24 grid like the app's glyphs. Once per 8 s cycle it does its own move,
//! then a pale stroke runs along its contour. Roles start their cycles at
//! different moments, so a chat never pulses all at once.
//!
//! This core is pure: it describes the SVG nodes of a mark and the attributes
//! that move at a given time. `browser.rs` writes them into the page;
//! `examples/stills.rs` prints the resting marks for the native app.
#[cfg(target_arch = "wasm32")]
mod browser;

use std::f64::consts::PI;
use std::fmt;

/// One cycle of every mark, in seconds.
pub const CYCLE: f64 = 8.0;
/// From this local time to the end of its cycle every mark rests.
pub const REST_FROM: f64 = 3.5;
/// The local time used for the still mark (reduced motion, native).
pub const STILL_AT: f64 = 7.0;
/// How far the pale highlight is mixed toward white.
pub const PALE: f64 = 0.72;
/// The app's glyph line in layout pixels (`iconStroke`).
pub const LINE: f64 = 0.75;
/// The drawing grid of a mark.
pub const GRID: f64 = 24.0;
pub const SVG_NS: &str = "http://www.w3.org/2000/svg";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    Walker,
    Guide,
    Admin,
    Main,
}

impl Role {
    pub const ALL: [Role; 4] = [Role::Walker, Role::Guide, Role::Admin, Role::Main];

    /// The bridge's code: 0 walker, 1 guide, 2 admin, 3 main admin.
    pub fn from_code(code: u32) -> Option<Self> {
        match code {
            0 => Some(Self::Walker),
            1 => Some(Self::Guide),
            2 => Some(Self::Admin),
            3 => Some(Self::Main),
            _ => None,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::Walker => "walker",
            Self::Guide => "guide",
            Self::Admin => "admin",
            Self::Main => "main",
        }
    }

    /// Where this role's cycle stands when the shared clock reads zero.
    pub fn phase(self) -> f64 {
        match self {
            Self::Walker => 0.0,
            Self::Guide => 2.1,
            Self::Admin => 4.3,
            Self::Main => 6.0,
        }
    }

    /// Local time in this role's cycle at `seconds` of the shared clock.
    pub fn local(self, seconds: f64) -> f64 {
        let t = (seconds + self.phase()).rem_euclid(CYCLE);
        // rem_euclid can round up to the divisor itself.
        if t >= CYCLE {
            0.0
        } else {
            t
        }
    }
}

/// An sRGB colour as `#rrggbb`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rgb(pub [u8; 3]);

impl Rgb {
    pub const WHITE: Rgb = Rgb([255, 255, 255]);

    pub fn parse(hex: &str) -> Option<Rgb> {
        let digits = hex.strip_prefix('#')?;
        if digits.len() != 6 || !digits.is_ascii() {
            return None;
        }
        let channel = |i: usize| u8::from_str_radix(&digits[i..i + 2], 16).ok();
        Some(Rgb([channel(0)?, channel(2)?, channel(4)?]))
    }

    /// Per channel `round(a + (b - a) * t)`, as the prototype mixes.
    pub fn mix(self, other: Rgb, t: f64) -> Rgb {
        let channel = |i: usize| {
            let a = f64::from(self.0[i]);
            (a + (f64::from(other.0[i]) - a) * t)
                .round()
                .clamp(0.0, 255.0) as u8
        };
        Rgb([channel(0), channel(1), channel(2)])
    }

    pub fn pale(self) -> Rgb {
        self.mix(Rgb::WHITE, PALE)
    }
}

impl fmt::Display for Rgb {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let [r, g, b] = self.0;
        write!(f, "#{r:02x}{g:02x}{b:02x}")
    }
}

/// `value.toFixed(places)` without a minus sign on zero.
pub fn fixed(value: f64, places: usize) -> String {
    let text = format!("{value:.places$}");
    match text.strip_prefix('-') {
        Some(rest) if rest.bytes().all(|b| b == b'0' || b == b'.') => rest.to_owned(),
        _ => text,
    }
}

/// A grid coordinate in at most three decimals, without trailing zeros.
pub fn short(value: f64) -> String {
    let text = fixed(value, 3);
    text.trim_end_matches('0').trim_end_matches('.').to_owned()
}

pub fn ease(x: f64) -> f64 {
    let x = x.clamp(0.0, 1.0);
    x * x * (3.0 - 2.0 * x)
}

/// Eases from 0 at `a` to 1 at `b`.
pub fn ramp(t: f64, a: f64, b: f64) -> f64 {
    ease((t - a) / (b - a))
}

/// Half a sine: 0 outside `a..b`, 1 in the middle.
pub fn bump(t: f64, a: f64, b: f64) -> f64 {
    if t <= a || t >= b {
        0.0
    } else {
        (PI * (t - a) / (b - a)).sin()
    }
}

// ---------- drawing, on the 24 grid ----------

/// A footprint: sole and heel as `cx cy rx ry rotation`.
type Oval = [f64; 5];
const fn foot(cx: f64, cy: f64, rot: f64) -> [Oval; 2] {
    [[cx, cy, 2.6, 4.1, rot], [cx + 0.3, cy + 6.6, 1.9, 1.9, rot]]
}
const FEET: [[Oval; 2]; 2] = [foot(8.0, 11.2, -8.0), foot(16.0, 5.8, 8.0)];
const FLAME: &str = "M12 3C12 3 17.2 8.6 17.2 13.8A5.2 5.2 0 0 1 6.8 13.8C6.8 8.6 12 3 12 3Z";
const CORE: &str = "M12 10C12 10 14.3 12.6 14.3 15A2.3 2.3 0 0 1 9.7 15C9.7 12.6 12 10 12 10Z";
const SPARK: &str = "M12 1.4l1 1-1 1-1-1Z";
const LOWER_LID: &str = "M21.5 12C18.6 17 15.6 18.6 12 18.6S5.4 17 2.5 12";
/// Drawn along +x around the icon centre, then turned 45°: handle bottom-left,
/// open jaw top-right.
const WRENCH: &str =
    "M-9.2 -1.4H1.24A4.2 4.2 0 0 1 9.12 -1.5H4.6V1.5H9.12A4.2 4.2 0 0 1 1.24 1.4H-9.2L-10 .6V-.6Z";
const WRENCH_EDGE: &str = "M-9.2 -1.4H1.24A4.2 4.2 0 0 1 9.12 -1.5";
const CLICK: &str = "M6.9 -3.4l.9.9-.9.9-.9-.9Z";

/// The upper eyelid; `open` 1 is the open eye, about -0.88 lies on the lower lid.
pub fn lid(open: f64) -> String {
    let a = fixed(12.0 - 5.0 * open, 2);
    let b = fixed(12.0 - 6.6 * open, 2);
    format!("M2.5 12C5.4 {a} 8.4 {b} 12 {b}S18.6 {a} 21.5 12")
}

/// The eye between the upper lid and the lower one.
pub fn eye(open: f64) -> String {
    lid(open) + "C18.6 17 15.6 18.6 12 18.6S5.4 17 2.5 12Z"
}

/// One SVG element of a mark.
#[derive(Clone, Debug, PartialEq)]
pub struct Node {
    pub tag: &'static str,
    /// Index of the parent node; `None` is the mark's `<svg>`.
    pub parent: Option<usize>,
    pub attrs: Vec<(&'static str, String)>,
}

/// One moving attribute: node index, name, value.
pub type Write = (usize, &'static str, String);

#[derive(Clone, Debug, PartialEq)]
enum Moving {
    Walker {
        feet: [(usize, [usize; 2]); 2],
    },
    Guide {
        halo: usize,
        flame: usize,
        core: usize,
        spark: usize,
    },
    Admin {
        clip: usize,
        white: usize,
        iris: usize,
        glint: usize,
        upper: usize,
        run: usize,
    },
    Main {
        turn: usize,
        edge: usize,
        click: usize,
        run: usize,
    },
}

/// A pale stroke that runs once along a contour.
const RUN_DASH: f64 = 3.0;
const EYE_RUN: f64 = 22.0;
const WRENCH_RUN: f64 = 21.0;

struct Builder {
    nodes: Vec<Node>,
    /// Stroke width on the grid for a line of weight 1.
    stroke: f64,
    ink: String,
}

impl Builder {
    fn add(
        &mut self,
        tag: &'static str,
        parent: Option<usize>,
        attrs: Vec<(&'static str, String)>,
    ) -> usize {
        self.nodes.push(Node { tag, parent, attrs });
        self.nodes.len() - 1
    }

    /// A line in the app's glyph manner: round caps and joins, no fill.
    fn line(
        &mut self,
        tag: &'static str,
        parent: Option<usize>,
        weight: f64,
        attrs: Vec<(&'static str, String)>,
    ) -> usize {
        let mut all = vec![
            ("fill", "none".to_owned()),
            ("stroke-linecap", "round".to_owned()),
            ("stroke-linejoin", "round".to_owned()),
            ("stroke-width", fixed(self.stroke * weight, 3)),
        ];
        all.extend(attrs);
        self.add(tag, parent, all)
    }

    fn path(&mut self, parent: Option<usize>, d: &str, fill: &str, fill_opacity: f64) -> usize {
        self.add(
            "path",
            parent,
            vec![
                ("d", d.to_owned()),
                ("fill", fill.to_owned()),
                ("fill-opacity", fill_opacity.to_string()),
            ],
        )
    }

    fn outline(&mut self, parent: Option<usize>, d: &str, weight: f64) -> usize {
        let ink = self.ink.clone();
        self.line(
            "path",
            parent,
            weight,
            vec![("d", d.to_owned()), ("stroke", ink)],
        )
    }

    fn runner(&mut self, parent: Option<usize>, d: &str, pale: &str, length: f64) -> usize {
        self.line(
            "path",
            parent,
            1.1,
            vec![
                ("d", d.to_owned()),
                ("stroke", pale.to_owned()),
                ("stroke-dasharray", format!("{RUN_DASH} {}", length + 6.0)),
                ("stroke-dashoffset", RUN_DASH.to_string()),
                ("opacity", "0".to_owned()),
            ],
        )
    }
}

fn oval(o: Oval) -> Vec<(&'static str, String)> {
    let [cx, cy, rx, ry, rot] = o.map(short);
    vec![
        ("transform", format!("rotate({rot} {cx} {cy})")),
        ("cx", cx),
        ("cy", cy),
        ("rx", rx),
        ("ry", ry),
    ]
}

/// A role mark at one size and ink: its nodes and how they move.
#[derive(Clone, Debug, PartialEq)]
pub struct Mark {
    role: Role,
    ink: Rgb,
    pale: Rgb,
    nodes: Vec<Node>,
    moving: Moving,
}

impl Mark {
    /// `size` is the mark's box in layout pixels (lines stay `LINE` thick);
    /// `uid` keeps the clip and gradient ids unique in one document.
    pub fn new(role: Role, ink: Rgb, size: f64, uid: u32) -> Mark {
        let pale = ink.pale();
        let (ink_hex, pale_hex) = (ink.to_string(), pale.to_string());
        let mut b = Builder {
            nodes: Vec::new(),
            stroke: LINE * GRID / size.max(1.0),
            ink: ink_hex.clone(),
        };
        let moving = match role {
            Role::Walker => {
                // Two footprints: both fade, then are set down one after the other.
                let feet = FEET.map(|shape| {
                    let g = b.add("g", None, Vec::new());
                    let fills = shape.map(|o| {
                        let mut attrs = oval(o);
                        attrs.push(("fill", ink_hex.clone()));
                        attrs.push(("fill-opacity", "0.28".to_owned()));
                        b.add("ellipse", Some(g), attrs)
                    });
                    for o in shape {
                        let mut attrs = oval(o);
                        attrs.push(("stroke", ink_hex.clone()));
                        b.line("ellipse", Some(g), 1.0, attrs);
                    }
                    (g, fills)
                });
                Moving::Walker { feet }
            }
            Role::Guide => {
                // A small flame of light: it flickers and flares, a spark leaves the tip.
                let id = format!("rm{uid}h");
                let defs = b.add("defs", None, Vec::new());
                let glow = b.add("radialGradient", Some(defs), vec![("id", id.clone())]);
                for (offset, opacity) in [("0", "0.2"), ("1", "0")] {
                    b.add(
                        "stop",
                        Some(glow),
                        vec![
                            ("offset", offset.to_owned()),
                            ("stop-color", ink_hex.clone()),
                            ("stop-opacity", opacity.to_owned()),
                        ],
                    );
                }
                let halo = b.add(
                    "circle",
                    None,
                    vec![
                        ("cx", "12".to_owned()),
                        ("cy", "13.5".to_owned()),
                        ("r", "9".to_owned()),
                        ("fill", format!("url(#{id})")),
                    ],
                );
                let flame = b.add("g", None, Vec::new());
                b.path(Some(flame), FLAME, &ink_hex, 0.08);
                b.outline(Some(flame), FLAME, 1.0);
                let core = b.path(Some(flame), CORE, &ink_hex, 0.22);
                b.outline(Some(flame), CORE, 0.8);
                let spark = b.add(
                    "path",
                    None,
                    vec![
                        ("d", SPARK.to_owned()),
                        ("fill", pale_hex.clone()),
                        ("opacity", "0".to_owned()),
                    ],
                );
                Moving::Guide {
                    halo,
                    flame,
                    core,
                    spark,
                }
            }
            Role::Admin => {
                // An eye: it blinks, glances left and right, then light runs along the upper lid.
                let id = format!("rm{uid}c");
                let defs = b.add("defs", None, Vec::new());
                let clip_path = b.add("clipPath", Some(defs), vec![("id", id.clone())]);
                let clip = b.add("path", Some(clip_path), vec![("d", eye(1.0))]);
                let white = b.path(None, &eye(1.0), &ink_hex, 0.08);
                let clipped = b.add("g", None, vec![("clip-path", format!("url(#{id})"))]);
                let iris = b.add("g", Some(clipped), Vec::new());
                let circle = |r: &str| {
                    vec![
                        ("cx", "12".to_owned()),
                        ("cy", "12".to_owned()),
                        ("r", r.to_owned()),
                    ]
                };
                let mut attrs = circle("3.7");
                attrs.extend([
                    ("fill", ink_hex.clone()),
                    ("fill-opacity", "0.14".to_owned()),
                ]);
                b.add("circle", Some(iris), attrs);
                let mut attrs = circle("3.7");
                attrs.push(("stroke", ink_hex.clone()));
                b.line("circle", Some(iris), 1.0, attrs);
                let mut attrs = circle("1.4");
                attrs.push(("fill", ink_hex.clone()));
                b.add("circle", Some(iris), attrs);
                let glint = b.add(
                    "circle",
                    Some(iris),
                    vec![
                        ("cx", "13.4".to_owned()),
                        ("cy", "10.6".to_owned()),
                        ("r", "0.7".to_owned()),
                        ("fill", pale_hex.clone()),
                        ("opacity", "0".to_owned()),
                    ],
                );
                let upper = b.outline(None, &lid(1.0), 1.0);
                b.outline(None, LOWER_LID, 1.0);
                let run = b.runner(None, &lid(1.0), &pale_hex, EYE_RUN);
                Moving::Admin {
                    clip,
                    white,
                    iris,
                    glint,
                    upper,
                    run,
                }
            }
            Role::Main => {
                // A wrench turns twice, as if tightening a nut; then light runs along the handle.
                let turn = b.add("g", None, Vec::new());
                let body = b.add(
                    "g",
                    Some(turn),
                    vec![("transform", "translate(12 12) rotate(-45)".to_owned())],
                );
                b.path(Some(body), WRENCH, &ink_hex, 0.08);
                let edge = b.outline(Some(body), WRENCH, 1.0);
                let click = b.add(
                    "path",
                    Some(body),
                    vec![
                        ("d", CLICK.to_owned()),
                        ("fill", pale_hex.clone()),
                        ("opacity", "0".to_owned()),
                    ],
                );
                let run = b.runner(Some(body), WRENCH_EDGE, &pale_hex, WRENCH_RUN);
                Moving::Main {
                    turn,
                    edge,
                    click,
                    run,
                }
            }
        };
        Mark {
            role,
            ink,
            pale,
            nodes: b.nodes,
            moving,
        }
    }

    pub fn role(&self) -> Role {
        self.role
    }

    pub fn nodes(&self) -> &[Node] {
        &self.nodes
    }

    /// The attributes that move, at local time `t` of the role's cycle. The
    /// same nodes and names come in the same order at every `t`.
    pub fn pose(&self, t: f64) -> Vec<Write> {
        let mut out = Vec::with_capacity(12);
        let tint = |k: f64| self.ink.mix(self.pale, k).to_string();
        match &self.moving {
            Moving::Walker { feet } => {
                for (i, (g, fills)) in feet.iter().enumerate() {
                    let start = 0.5 + i as f64 * 0.55;
                    let shown = if t < 0.45 {
                        1.0 - 0.8 * ramp(t, 0.0, 0.45)
                    } else {
                        0.2 + 0.8 * ramp(t, start, start + 0.35)
                    };
                    let lift =
                        (1.0 - ramp(t, start, start + 0.35)) * if t > 0.45 { 1.2 } else { 0.0 };
                    let land = bump(t, start + 0.2, start + 1.0);
                    out.push((*g, "opacity", fixed(shown, 3)));
                    out.push((*g, "transform", format!("translate(0 {})", fixed(-lift, 3))));
                    for fill in fills {
                        out.push((*fill, "fill", tint(land)));
                        out.push((*fill, "fill-opacity", fixed(0.28 + 0.5 * land, 3)));
                    }
                }
            }
            Moving::Guide {
                halo,
                flame,
                core,
                spark,
            } => {
                let u = t - 0.5;
                let sway = if u > 0.0 && u < 3.0 {
                    6.0 * (-1.6 * u).exp() * (2.0 * PI * 1.3 * u).sin()
                } else {
                    0.0
                };
                let flare = bump(t, 0.5, 1.7);
                out.push((
                    *flame,
                    "transform",
                    format!(
                        "translate(12 19) rotate({}) scale(1 {}) translate(-12 -19)",
                        fixed(sway, 2),
                        fixed(1.0 + 0.1 * flare, 3)
                    ),
                ));
                let lit = bump(t, 0.6, 2.1);
                out.push((*core, "fill", tint(lit)));
                out.push((*core, "fill-opacity", fixed(0.22 + 0.7 * lit, 3)));
                out.push((*halo, "opacity", fixed(0.35 + 0.65 * bump(t, 0.5, 2.3), 3)));
                out.push((*spark, "opacity", fixed(bump(t, 1.1, 2.1), 3)));
                // The spark rises while it shows, then waits hidden at the tip.
                let rise = if t < 2.1 { ramp(t, 1.1, 2.1) } else { 0.0 };
                out.push((
                    *spark,
                    "transform",
                    format!("translate(0 {})", fixed(1.6 - 3.4 * rise, 2)),
                ));
            }
            Moving::Admin {
                clip,
                white,
                iris,
                glint,
                upper,
                run,
            } => {
                // The upper lid comes down onto the lower one and lifts again.
                let open = 1.0 - 1.88 * bump(t, 0.3, 0.7);
                let shape = eye(open);
                out.push((*upper, "d", lid(open)));
                out.push((*clip, "d", shape.clone()));
                out.push((*white, "d", shape));
                let x = -2.2 * bump(t, 0.9, 1.55) + 2.2 * bump(t, 1.5, 2.2);
                out.push((*iris, "transform", format!("translate({} 0)", fixed(x, 3))));
                out.push((*glint, "opacity", fixed(bump(t, 2.2, 3.2), 3)));
                runner(&mut out, *run, t - 2.3, EYE_RUN);
            }
            Moving::Main {
                turn,
                edge,
                click,
                run,
            } => {
                let twist = |a: f64| ramp(t, a, a + 0.45) * (1.0 - ramp(t, a + 0.5, a + 0.62));
                let angle = 13.0 * (twist(0.4) + twist(1.2));
                out.push((
                    *turn,
                    "transform",
                    format!("rotate({} 16.88 7.12)", fixed(angle, 2)),
                ));
                let k = bump(t, 0.8, 1.15).max(bump(t, 1.6, 1.95));
                out.push((*click, "opacity", fixed(k, 3)));
                out.push((*edge, "stroke", tint(k * 0.5)));
                runner(&mut out, *run, (t - 2.1) / 0.9, WRENCH_RUN);
            }
        }
        out
    }

    /// The mark at rest as standalone SVG markup (`width`/`height` = `size`).
    pub fn still_svg(&self, size: f64) -> String {
        let mut nodes = self.nodes.clone();
        for (index, name, value) in self.pose(STILL_AT) {
            let attrs = &mut nodes[index].attrs;
            match attrs.iter_mut().find(|(n, _)| *n == name) {
                Some(slot) => slot.1 = value,
                None => attrs.push((name, value)),
            }
        }
        let mut out = format!(
            "<svg xmlns=\"{SVG_NS}\" width=\"{size}\" height=\"{size}\" viewBox=\"0 0 {GRID} {GRID}\">"
        );
        write_children(&nodes, None, &mut out);
        out.push_str("</svg>");
        out
    }
}

/// The size of the marks in the chat, in layout pixels.
pub const CHAT_SIZE: f64 = 16.0;
/// The ink the native stills are drawn in; the app swaps it for the role's.
pub const STILL_INK: Rgb = Rgb([1, 2, 3]);
/// Where `examples/stills.rs` writes the native stills, from the repo root.
pub const NATIVE_MODULE: &str = "src/features/intensive/ui/roleMarks.generated.ts";

/// The TypeScript module with the resting marks for the native app, where
/// the live adapter does not run.
pub fn native_module() -> String {
    let mut out = String::from(
        "// Generated by graphics/role-marks (cargo run --example stills). Do not edit.\n",
    );
    out.push_str(&format!("export const roleMarkSize = {CHAT_SIZE};\n"));
    out.push_str(&format!("export const roleMarkInk = '{STILL_INK}';\n"));
    out.push_str("export const roleMarkStills = {\n");
    for role in Role::ALL {
        let svg = Mark::new(role, STILL_INK, CHAT_SIZE, 0).still_svg(CHAT_SIZE);
        out.push_str(&format!(
            "  {}: '{}',\n",
            role.name(),
            svg.replace('\'', "\\'")
        ));
    }
    out.push_str("} as const;\n");
    out
}

/// The pale stroke at `r` (0..1 along its contour); hidden outside.
fn runner(out: &mut Vec<Write>, node: usize, r: f64, length: f64) {
    if r <= 0.0 || r >= 1.0 {
        out.push((node, "opacity", "0".to_owned()));
        out.push((node, "stroke-dashoffset", RUN_DASH.to_string()));
    } else {
        out.push((node, "opacity", fixed(((PI * r).sin() * 1.6).min(1.0), 3)));
        out.push((
            node,
            "stroke-dashoffset",
            fixed(RUN_DASH - (length + RUN_DASH) * r, 2),
        ));
    }
}

fn write_children(nodes: &[Node], parent: Option<usize>, out: &mut String) {
    for (index, node) in nodes.iter().enumerate().filter(|(_, n)| n.parent == parent) {
        out.push('<');
        out.push_str(node.tag);
        for (name, value) in &node.attrs {
            out.push(' ');
            out.push_str(name);
            out.push_str("=\"");
            for c in value.chars() {
                match c {
                    '&' => out.push_str("&amp;"),
                    '<' => out.push_str("&lt;"),
                    '"' => out.push_str("&quot;"),
                    c => out.push(c),
                }
            }
            out.push('"');
        }
        out.push('>');
        write_children(nodes, Some(index), out);
        out.push_str("</");
        out.push_str(node.tag);
        out.push('>');
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const INK: Rgb = Rgb([0xd9, 0xbe, 0x86]);

    fn value(writes: &[Write], node: usize, name: &str) -> String {
        writes
            .iter()
            .find(|(n, a, _)| *n == node && *a == name)
            .map(|(_, _, v)| v.clone())
            .unwrap_or_else(|| panic!("no {name} on node {node}"))
    }

    #[test]
    fn colours_mix_like_the_prototype() {
        assert_eq!(Rgb::parse("#D9BE86"), Some(INK));
        assert_eq!(Rgb::parse("D9BE86"), None);
        assert_eq!(Rgb::parse("#D9BE8"), None);
        assert_eq!(INK.to_string(), "#d9be86");
        // mix('#D9BE86', '#ffffff', .72) in the prototype.
        assert_eq!(INK.pale().to_string(), "#f4eddd");
        assert_eq!(INK.mix(INK.pale(), 0.0), INK);
    }

    #[test]
    fn numbers_print_like_to_fixed() {
        assert_eq!(fixed(1.23456, 3), "1.235");
        assert_eq!(fixed(-0.0, 3), "0.000");
        assert_eq!(fixed(-0.0001, 3), "0.000");
        assert_eq!(fixed(-1.2, 2), "-1.20");
        assert_eq!(short(11.2 + 6.6), "17.8");
        assert_eq!(short(8.0), "8");
        assert_eq!(short(-8.0), "-8");
    }

    #[test]
    fn roles_keep_their_codes_and_phases() {
        for (code, role) in Role::ALL.iter().enumerate() {
            assert_eq!(Role::from_code(code as u32), Some(*role));
        }
        assert_eq!(Role::from_code(4), None);
        assert_eq!(Role::Guide.local(0.0), 2.1);
        assert!((Role::Main.local(3.0) - 1.0).abs() < 1e-9);
        assert!((Role::Walker.local(-1.0) - 7.0).abs() < 1e-9);
        for role in Role::ALL {
            let t = role.local(1e9 + 0.123);
            assert!((0.0..CYCLE).contains(&t));
        }
    }

    #[test]
    fn every_pose_writes_the_same_attributes() {
        for role in Role::ALL {
            let mark = Mark::new(role, INK, 16.0, 1);
            let names = |t: f64| {
                mark.pose(t)
                    .into_iter()
                    .map(|(n, a, _)| (n, a))
                    .collect::<Vec<_>>()
            };
            let rest = names(STILL_AT);
            assert!(!rest.is_empty());
            for step in 0..800 {
                assert_eq!(names(step as f64 * 0.01), rest, "{}", role.name());
            }
        }
    }

    #[test]
    fn marks_rest_after_their_move_and_wrap_smoothly() {
        for role in Role::ALL {
            let mark = Mark::new(role, INK, 16.0, 1);
            let rest = mark.pose(STILL_AT);
            let mut t = REST_FROM;
            while t < CYCLE {
                assert_eq!(mark.pose(t), rest, "{} at {t}", role.name());
                t += 0.05;
            }
            // The end of one cycle meets the start of the next.
            assert_eq!(mark.pose(CYCLE - 1e-6), mark.pose(0.0), "{}", role.name());
        }
    }

    #[test]
    fn marks_move_inside_their_beat() {
        for role in Role::ALL {
            let mark = Mark::new(role, INK, 16.0, 1);
            let rest = mark.pose(STILL_AT);
            assert!(
                (0..35).any(|i| mark.pose(i as f64 * 0.1) != rest),
                "{} never moves",
                role.name()
            );
        }
    }

    #[test]
    fn the_eye_closes_onto_the_lower_lid() {
        let mark = Mark::new(Role::Admin, INK, 16.0, 1);
        let Moving::Admin { upper, run, .. } = mark.moving else {
            unreachable!()
        };
        assert_eq!(value(&mark.pose(STILL_AT), upper, "d"), lid(1.0));
        // Fully closed at the middle of the blink: the lid lies on the lower lid.
        assert_eq!(
            value(&mark.pose(0.5), upper, "d"),
            "M2.5 12C5.4 16.40 8.4 17.81 12 17.81S18.6 16.40 21.5 12"
        );
        // The runner shows only in its window.
        assert_eq!(value(&mark.pose(2.0), run, "opacity"), "0");
        assert_eq!(value(&mark.pose(2.8), run, "opacity"), "1.000");
    }

    #[test]
    fn the_wrench_rests_straight_and_turns_twice() {
        let mark = Mark::new(Role::Main, INK, 16.0, 1);
        let Moving::Main { turn, .. } = mark.moving else {
            unreachable!()
        };
        assert_eq!(
            value(&mark.pose(STILL_AT), turn, "transform"),
            "rotate(0.00 16.88 7.12)"
        );
        assert_eq!(
            value(&mark.pose(0.88), turn, "transform"),
            "rotate(13.00 16.88 7.12)"
        );
        assert_eq!(
            value(&mark.pose(1.68), turn, "transform"),
            "rotate(13.00 16.88 7.12)"
        );
    }

    #[test]
    fn lines_stay_one_glyph_line_thick() {
        let mark = Mark::new(Role::Walker, INK, 16.0, 1);
        let widths: Vec<_> = mark
            .nodes()
            .iter()
            .filter_map(|n| n.attrs.iter().find(|(a, _)| *a == "stroke-width"))
            .map(|(_, v)| v.as_str())
            .collect();
        assert_eq!(widths, ["1.125"; 4]);
    }

    #[test]
    fn ids_are_unique_per_mark() {
        let a = Mark::new(Role::Admin, INK, 16.0, 7).still_svg(16.0);
        assert!(a.contains("id=\"rm7c\"") && a.contains("url(#rm7c)"));
        let g = Mark::new(Role::Guide, INK, 16.0, 8).still_svg(16.0);
        assert!(g.contains("id=\"rm8h\"") && g.contains("url(#rm8h)"));
    }

    #[test]
    fn the_native_stills_are_current() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../",
            "src/features/intensive/ui/roleMarks.generated.ts"
        );
        let committed = std::fs::read_to_string(path)
            .unwrap_or_default()
            .replace("\r\n", "\n");
        assert!(
            committed == native_module(),
            "{NATIVE_MODULE} is stale: run cargo run --example stills"
        );
    }

    #[test]
    fn the_still_mark_uses_only_the_ink() {
        // The native app swaps one ink for the theme's: nothing else may be coloured.
        let sentinel = STILL_INK;
        for role in Role::ALL {
            let svg = Mark::new(role, sentinel, 16.0, 0).still_svg(16.0);
            let pale = sentinel.pale().to_string();
            for (i, _) in svg.match_indices('#') {
                let colour = &svg[i..(i + 7).min(svg.len())];
                if colour.starts_with("#rm") {
                    continue;
                }
                if colour == pale {
                    // Pale only on parts that are hidden at rest.
                    let start = svg[..i].rfind('<').unwrap();
                    let tag = &svg[start..i + svg[i..].find('>').unwrap()];
                    let opacity = tag
                        .split(" opacity=\"")
                        .nth(1)
                        .and_then(|v| v.split('"').next());
                    assert_eq!(
                        opacity.map(|v| v.parse::<f64>().unwrap()),
                        Some(0.0),
                        "{}: {tag}",
                        role.name()
                    );
                    continue;
                }
                assert_eq!(colour, "#010203", "{}", role.name());
            }
        }
    }
}
