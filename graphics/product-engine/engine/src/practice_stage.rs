//! Shared stage of the practice films 4–7: one pinhole camera per scene, the
//! Laboratory rain projected through world planes, the approved figures, and an
//! immediate-mode canvas. A scene is one drawing function: run once it writes
//! the SVG, run per frame it writes only the changing attributes of the same
//! elements, so painter order and topology can never drift apart.
use crate::{family_artwork::Contour, step_three::Update};
use std::{f64::consts::TAU, fmt::Write, sync::LazyLock};

pub(crate) type P = (f64, f64);
pub(crate) type W = [f64; 3];

pub(crate) fn ease(v: f64) -> f64 {
    let v = v.clamp(0., 1.);
    v * v * v * (v * (v * 6. - 15.) + 10.)
}
pub(crate) fn ramp(t: f64, a: f64, b: f64) -> f64 {
    ease((t - a) / (b - a))
}
/// Rises over a..b, holds, and falls over c..d.
pub(crate) fn bell(t: f64, a: f64, b: f64, c: f64, d: f64) -> f64 {
    ramp(t, a, b) * (1. - ramp(t, c, d))
}
pub(crate) fn mix(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}
pub(crate) fn lerp(a: P, b: P, t: f64) -> P {
    (mix(a.0, b.0, t), mix(a.1, b.1, t))
}
pub(crate) fn wmix(a: W, b: W, t: f64) -> W {
    std::array::from_fn(|i| mix(a[i], b[i], t))
}
/// Deterministic scatter in [0, 1): the films never use runtime randomness.
pub(crate) fn hash(i: usize) -> f64 {
    let x = (i as f64 * 12.9898 + 78.233).sin() * 43_758.545_3;
    x - x.floor()
}
pub(crate) fn add(a: W, b: W) -> W {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
pub(crate) fn sub(a: W, b: W) -> W {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
/// Cubic Bézier through world space.
pub(crate) fn cubic(a: W, b: W, c: W, d: W, t: f64) -> W {
    let u = 1. - t;
    std::array::from_fn(|i| {
        u * u * u * a[i] + 3. * u * u * t * b[i] + 3. * u * t * t * c[i] + t * t * t * d[i]
    })
}
pub(crate) fn scaled(a: W, k: f64) -> W {
    [a[0] * k, a[1] * k, a[2] * k]
}
pub(crate) fn dot(a: W, b: W) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
pub(crate) fn cross(a: W, b: W) -> W {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
pub(crate) fn unit(a: W) -> W {
    scaled(a, 1. / dot(a, a).sqrt().max(1e-9))
}
/// Rodrigues rotation of `v` about the unit `axis`.
pub(crate) fn spin(v: W, axis: W, angle: f64) -> W {
    let (s, c) = angle.sin_cos();
    add(
        add(scaled(v, c), scaled(cross(axis, v), s)),
        scaled(axis, dot(axis, v) * (1. - c)),
    )
}
pub(crate) fn rotate(p: P, at: P, a: f64) -> P {
    let (s, c) = a.sin_cos();
    (
        at.0 + (p.0 - at.0) * c - (p.1 - at.1) * s,
        at.1 + (p.0 - at.0) * s + (p.1 - at.1) * c,
    )
}

/// A pinhole looking along +z through a shifted lens: verticals stay vertical,
/// so the approved 2D figures stand upright at any depth.
#[derive(Clone, Copy)]
pub(crate) struct Camera {
    pub eye: W,
    pub focal: f64,
    pub center: P,
}
impl Camera {
    pub fn project(&self, p: W) -> P {
        let z = (p[2] - self.eye[2]).max(1e-3);
        (
            self.center.0 + self.focal * (p[0] - self.eye[0]) / z,
            self.center.1 + self.focal * (self.eye[1] - p[1]) / z,
        )
    }
    /// Screen units per metre at a depth.
    pub fn scale(&self, z: f64) -> f64 {
        self.focal / (z - self.eye[2]).max(1e-3)
    }
    /// World x, y on the plane at depth `z`, to the screen.
    pub fn plane(&self, z: f64) -> Affine {
        let k = self.scale(z);
        Affine([k, 0., 0., -k, self.center.0 - k * self.eye[0], self.center.1 + k * self.eye[1]])
    }
    /// Carries art projected through `reference` on the plane at depth `z` to
    /// this camera: whatever lies on such a plane is drawn once.
    pub fn carry(&self, reference: &Camera, z: f64) -> Affine {
        reference.plane(z).inverse().then(self.plane(z))
    }
    pub fn poly(&self, points: &[W]) -> String {
        poly(&points.iter().map(|&p| self.project(p)).collect::<Vec<_>>())
    }
    pub fn line(&self, points: &[W]) -> String {
        line(&points.iter().map(|&p| self.project(p)).collect::<Vec<_>>())
    }
    /// Rain coordinates for a world quad [a, b, c, d]: u runs a→b, v runs a→d.
    /// Inverse of the same homography that places every solid in the scene.
    pub fn uv(&self, quad: [W; 4], density: [f64; 2]) -> String {
        self.uv_shift(quad, density, [0., 0.])
    }
    /// As `uv`, with the code slid by whole cells so neighbouring panels differ.
    pub fn uv_shift(&self, quad: [W; 4], density: [f64; 2], shift: [f64; 2]) -> String {
        let [a, b, _, d] = quad;
        let column = |v: W, w: f64| {
            let q = [
                v[0] - self.eye[0] * w,
                v[1] - self.eye[1] * w,
                v[2] - self.eye[2] * w,
            ];
            [
                self.focal * q[0] + self.center.0 * q[2],
                -self.focal * q[1] + self.center.1 * q[2],
                q[2],
            ]
        };
        let u = column(std::array::from_fn(|i| b[i] - a[i]), 0.);
        let v = column(std::array::from_fn(|i| d[i] - a[i]), 0.);
        let o = column(a, 1.);
        let [a, b, c, d, e, f, g, h, i] = [u[0], v[0], o[0], u[1], v[1], o[1], u[2], v[2], o[2]];
        let co = [
            e * i - f * h,
            c * h - b * i,
            b * f - c * e,
            f * g - d * i,
            a * i - c * g,
            c * d - a * f,
            d * h - e * g,
            b * g - a * h,
            a * e - b * d,
        ];
        let det = a * co[0] + b * co[3] + c * co[6];
        let cell = |k: usize| co[k] / det * [density[0], density[1], 1.][k / 3];
        // Adding a multiple of the homogeneous row shifts u (or v) by a constant.
        (0..9)
            .map(|k| {
                let row = k / 3;
                let n = cell(k) + if row < 2 { shift[row] * cell(6 + k % 3) } else { 0. };
                format!("{n:.10}")
            })
            .collect::<Vec<_>>()
            .join(" ")
    }
}

pub(crate) fn poly(points: &[P]) -> String {
    let mut d = line(points);
    d.push('Z');
    d
}
pub(crate) fn line(points: &[P]) -> String {
    let mut d = String::with_capacity(points.len() * 16);
    for (i, (x, y)) in points.iter().enumerate() {
        let _ = write!(d, "{}{x:.2} {y:.2}", if i == 0 { 'M' } else { 'L' });
    }
    d
}
pub(crate) fn circle(c: P, r: f64) -> String {
    ellipse(c, r, r)
}
pub(crate) fn ellipse(c: P, rx: f64, ry: f64) -> String {
    let (rx, ry) = (rx.max(0.01), ry.max(0.01));
    format!(
        "M{:.2} {:.2}a{rx:.2} {ry:.2} 0 1 0 {:.2} 0a{rx:.2} {ry:.2} 0 1 0 {:.2} 0Z",
        c.0 - rx,
        c.1,
        rx * 2.,
        -rx * 2.
    )
}
/// Arc of a circle as a polyline, angles in radians.
pub(crate) fn arc(c: P, r: f64, from: f64, to: f64) -> String {
    let n = 18;
    line(
        &(0..=n)
            .map(|i| {
                let a = mix(from, to, i as f64 / n as f64);
                (c.0 + r * a.cos(), c.1 + r * a.sin())
            })
            .collect::<Vec<_>>(),
    )
}
pub(crate) fn length(points: &[P]) -> f64 {
    points
        .windows(2)
        .map(|w| (w[1].0 - w[0].0).hypot(w[1].1 - w[0].1))
        .sum()
}
/// Point and direction at a distance along a polyline.
pub(crate) fn along(points: &[P], s: f64) -> (P, f64) {
    let mut walked = 0.;
    for w in points.windows(2) {
        let l = (w[1].0 - w[0].0).hypot(w[1].1 - w[0].1);
        if s <= walked + l || std::ptr::eq(w, points.windows(2).last().unwrap()) {
            let u = if l > 0. { ((s - walked) / l).clamp(0., 1.) } else { 0. };
            return (lerp(w[0], w[1], u), (w[1].1 - w[0].1).atan2(w[1].0 - w[0].0));
        }
        walked += l;
    }
    (points[0], 0.)
}
/// The piece of a polyline between two distances.
pub(crate) fn piece(points: &[P], from: f64, to: f64) -> Vec<P> {
    let total = length(points);
    let (from, to) = (from.clamp(0., total), to.clamp(0., total));
    if to <= from {
        return vec![along(points, from).0];
    }
    let mut out = vec![along(points, from).0];
    let mut walked = 0.;
    for w in points.windows(2) {
        walked += (w[1].0 - w[0].0).hypot(w[1].1 - w[0].1);
        if walked > from && walked < to {
            out.push(w[1]);
        }
    }
    out.push(along(points, to).0);
    out
}
/// A piece of a polyline by fractions of its length.
pub(crate) fn part(points: &[P], from: f64, to: f64) -> String {
    let total = length(points);
    if to - from < 1e-4 {
        return String::new();
    }
    line(&piece(points, from * total, to * total))
}
/// Convex hull by monotone chain: a cone of light from a point to an ellipse.
pub(crate) fn hull(mut points: Vec<P>) -> Vec<P> {
    points.sort_by(|a, b| a.0.total_cmp(&b.0).then(a.1.total_cmp(&b.1)));
    let turn = |o: P, a: P, b: P| (a.0 - o.0) * (b.1 - o.1) - (a.1 - o.1) * (b.0 - o.0);
    let chain = |points: &mut dyn Iterator<Item = P>| {
        let mut out: Vec<P> = Vec::new();
        for p in points {
            while out.len() >= 2 && turn(out[out.len() - 2], out[out.len() - 1], p) <= 0. {
                out.pop();
            }
            out.push(p);
        }
        out.pop();
        out
    };
    let mut lower = chain(&mut points.iter().copied());
    lower.extend(chain(&mut points.iter().rev().copied()));
    lower
}
/// Douglas–Peucker on a closed ring: traced stair steps become straight runs.
fn simplify(ring: &[P], tolerance: f64) -> Vec<P> {
    fn off(p: P, a: P, b: P) -> f64 {
        let (dx, dy) = (b.0 - a.0, b.1 - a.1);
        let l = dx * dx + dy * dy;
        let u = if l > 0. { (((p.0 - a.0) * dx + (p.1 - a.1) * dy) / l).clamp(0., 1.) } else { 0. };
        (p.0 - a.0 - u * dx).hypot(p.1 - a.1 - u * dy)
    }
    fn run(points: &[P], tolerance: f64, out: &mut Vec<P>) {
        let (a, b) = (points[0], points[points.len() - 1]);
        let (mut worst, mut at) = (0., 0);
        for (i, &p) in points.iter().enumerate().take(points.len() - 1).skip(1) {
            let d = off(p, a, b);
            if d > worst {
                (worst, at) = (d, i);
            }
        }
        if worst > tolerance {
            run(&points[..=at], tolerance, out);
            out.pop();
            run(&points[at..], tolerance, out);
        } else {
            out.push(a);
            out.push(b);
        }
    }
    if ring.len() < 4 {
        return ring.to_vec();
    }
    let reach = |i: usize| (ring[i].0 - ring[0].0).hypot(ring[i].1 - ring[0].1);
    let far = (1..ring.len()).max_by(|&a, &b| reach(a).total_cmp(&reach(b))).unwrap();
    let mut out = Vec::new();
    run(&ring[..=far], tolerance, &mut out);
    out.pop();
    let mut back = ring[far..].to_vec();
    back.push(ring[0]);
    run(&back, tolerance, &mut out);
    out.pop();
    out
}

mod typography {
    include!(concat!(env!("OUT_DIR"), "/spoken_glyphs.rs"));
}
pub(crate) const ADVANCE: f64 = 0.715;
/// One letter of the application font; `place` maps font units (y up) anywhere,
/// including onto curved world surfaces through the camera.
pub(crate) fn glyph(d: &mut String, c: char, place: impl Fn(f64, f64) -> P) {
    for &(command, p) in typography::glyph(c) {
        let (letter, count) = match command {
            1 => ('M', 1),
            2 => ('L', 1),
            3 => ('Q', 2),
            4 => ('C', 3),
            _ => ('Z', 0),
        };
        d.push(letter);
        for i in 0..count {
            let q = place(p[i * 2], p[i * 2 + 1]);
            let _ = write!(d, "{:.2} {:.2} ", q.0, q.1);
        }
    }
}
/// Glyphs of the application font, centred on `cx`, baseline `y`.
pub(crate) fn word(text: &str, cx: f64, y: f64, size: f64) -> String {
    crate::practice_dialogue::text_path(text, cx, y, size)
}
pub(crate) fn text_width(text: &str, size: f64) -> f64 {
    text.chars().count() as f64 * size * ADVANCE
}
/// Glyphs riding a polyline from distance `start`, centred on the line.
/// Letters beyond either end are left out rather than folded back.
pub(crate) fn text_along(text: &str, points: &[P], start: f64, size: f64) -> String {
    let mut d = String::new();
    let total = length(points);
    let advance = size * ADVANCE;
    for (i, c) in text.chars().enumerate() {
        let s = start + (i as f64 + 0.5) * advance;
        if s < 0. || s > total {
            continue;
        }
        let (at, angle) = along(points, s);
        let (sin, cos) = angle.sin_cos();
        glyph(&mut d, c, |x, y| {
            let (lx, ly) = (x * size - advance / 2., -y * size + size * 0.36);
            (at.0 + lx * cos - ly * sin, at.1 + lx * sin + ly * cos)
        });
    }
    d
}

/// Immediate-mode writer. While building it writes markup; on frames it
/// records only the changing attributes of the same numbered elements.
pub(crate) struct Canvas {
    prefix: &'static str,
    svg: Option<String>,
    pub updates: Vec<Update>,
    next: usize,
}
impl Canvas {
    pub fn build(prefix: &'static str, desc: &str, defs: &str) -> Self {
        Self {
            prefix,
            svg: Some(format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 192" fill="none"><desc>{desc}</desc><defs>{defs}</defs><g stroke-linecap="round" stroke-linejoin="round">"#
            )),
            updates: Vec::new(),
            next: 0,
        }
    }
    pub fn frame(prefix: &'static str) -> Self {
        Self {
            prefix,
            svg: None,
            updates: Vec::with_capacity(400),
            next: 0,
        }
    }
    pub fn building(&self) -> bool {
        self.svg.is_some()
    }
    /// Fixed markup; skipped on frames.
    pub fn raw(&mut self, xml: &str) {
        if let Some(s) = &mut self.svg {
            s.push_str(xml);
        }
    }
    fn class(&mut self) -> String {
        self.next += 1;
        format!("{}-{}", self.prefix, self.next - 1)
    }
    fn set(&mut self, class: &str, attribute: &'static str, value: String) {
        self.updates.push(Update {
            selector: format!(".{class}"),
            attribute,
            value,
        });
    }
    /// A path whose geometry and opacity change. `look` is its fixed paint.
    /// Hidden paths carry no geometry, keeping frames small.
    pub fn path(&mut self, d: &str, look: &str, alpha: f64) {
        let class = self.class();
        let alpha = alpha.clamp(0., 1.);
        let d = if d.is_empty() || alpha < 0.0005 { "M0 0" } else { d };
        if let Some(s) = &mut self.svg {
            let _ = write!(s, r#"<path class="{class}" d="{d}" opacity="{alpha:.4}" {look}/>"#);
        } else {
            self.set(&class, "d", d.into());
            self.set(&class, "opacity", format!("{alpha:.4}"));
        }
    }
    /// A path whose geometry is fixed; only its opacity changes.
    pub fn fixed(&mut self, d: impl FnOnce() -> String, look: &str, alpha: f64) {
        let class = self.class();
        let alpha = alpha.clamp(0., 1.);
        if let Some(s) = &mut self.svg {
            let _ = write!(s, r#"<path class="{class}" d="{}" opacity="{alpha:.4}" {look}/>"#, d());
        } else {
            self.set(&class, "opacity", format!("{alpha:.4}"));
        }
    }
    /// Laboratory rain clipped to `d`, mapped through a world plane.
    pub fn rain(&mut self, d: &str, uv: &str, alpha: f64) {
        let class = self.class();
        let alpha = alpha.clamp(0., 1.);
        let d = if d.is_empty() || alpha < 0.0005 { "M0 0" } else { d };
        if let Some(s) = &mut self.svg {
            let _ = write!(
                s,
                r#"<path class="{class}" d="{d}" data-rust-matrix-uv="{uv}" fill="none" stroke="none" opacity="{alpha:.4}"/>"#
            );
        } else {
            self.set(&class, "d", d.into());
            self.set(&class, "data-rust-matrix-uv", uv.into());
            self.set(&class, "opacity", format!("{alpha:.4}"));
        }
    }
    /// Rain on fixed geometry through a fixed plane; only its opacity changes.
    pub fn fixed_rain(&mut self, d: impl FnOnce() -> String, uv: &str, alpha: f64) {
        let class = self.class();
        let alpha = alpha.clamp(0., 1.);
        if let Some(s) = &mut self.svg {
            let _ = write!(
                s,
                r#"<path class="{class}" d="{}" data-rust-matrix-uv="{uv}" fill="none" stroke="none" opacity="{alpha:.4}"/>"#,
                d()
            );
        } else {
            self.set(&class, "opacity", format!("{alpha:.4}"));
        }
    }
    /// Opens a group whose transform (when given) and opacity change; close with `end`.
    pub fn group(&mut self, look: &str, transform: &str, alpha: f64) {
        let class = self.class();
        let alpha = alpha.clamp(0., 1.);
        if let Some(s) = &mut self.svg {
            let place = if transform.is_empty() { String::new() } else { format!(r#" transform="{transform}""#) };
            let _ = write!(s, r#"<g class="{class}"{place} opacity="{alpha:.4}" {look}>"#);
        } else {
            if !transform.is_empty() {
                self.set(&class, "transform", transform.into());
            }
            self.set(&class, "opacity", format!("{alpha:.4}"));
        }
    }
    /// A soft round light; `gradient` names a radial gradient in defs.
    pub fn sprite(&mut self, at: P, r: f64, gradient: &str, alpha: f64) {
        self.path(&circle(at, r), &format!(r#"fill="url(#{gradient})""#), alpha);
    }
    pub fn end(&mut self) {
        self.raw("</g>");
    }
    /// Words that move as one piece: fixed glyphs, changing place and alpha.
    pub fn words(&mut self, label: &str, d: impl FnOnce() -> String, look: &str, transform: &str, alpha: f64) {
        let class = self.class();
        let alpha = alpha.clamp(0., 1.);
        if let Some(s) = &mut self.svg {
            let _ = write!(
                s,
                r#"<g class="{class}" aria-label="{label}" transform="{transform}" opacity="{alpha:.4}"><path d="{}" {look}/></g>"#,
                d()
            );
        } else {
            self.set(&class, "transform", transform.into());
            self.set(&class, "opacity", format!("{alpha:.4}"));
        }
    }
    pub fn finish(self) -> String {
        let mut out = self.svg.unwrap_or_default();
        out.push_str("</g></svg>");
        crate::scene_edges::wrap(&out, 14., 10.)
    }
}

/// Paint shortcuts for `look`.
pub(crate) const INK: &str = "var(--book-ink)";
pub(crate) const LINE: &str = "var(--book-line)";
pub(crate) const LIGHT: &str = "var(--book-light)";
pub(crate) const COVER: &str = "var(--book-cover)";
pub(crate) fn stroke(color: &str, width: f64) -> String {
    format!(r#"stroke="{color}" stroke-width="{width}""#)
}
pub(crate) fn fill(color: &str) -> String {
    format!(r#"fill="{color}""#)
}
/// Soft light: a centre that burns to `--book-light`, then ink, then nothing.
pub(crate) fn glow_defs(id: &str) -> String {
    format!(
        r#"<radialGradient id="{id}-glow"><stop stop-color="var(--book-light)" stop-opacity=".95"/><stop offset=".18" stop-color="var(--book-line)" stop-opacity=".55"/><stop offset=".5" stop-color="var(--book-ink)" stop-opacity=".16"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="{id}-haze"><stop stop-color="var(--book-ink)" stop-opacity=".2"/><stop offset=".6" stop-color="var(--book-ink)" stop-opacity=".06"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><filter id="{id}-blur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter><filter id="{id}-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".9"/></filter><filter id="{id}-far" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>"#
    )
}

/// The approved standing contour, in file painter order: cover, then ink.
const UNSEAL: &str = include_str!("../assets/unseal-reference.svg");
pub(crate) const UNSEAL_THROAT: P = (1268., 262.);
pub(crate) const UNSEAL_HEART: P = (1270., 335.);
const UNSEAL_SHOULDERS: [P; 2] = [(1230., 294.), (1305., 297.)];
/// Centre of the soles and the top of the head in the art.
const UNSEAL_FEET: P = (1268., 872.);
const UNSEAL_TOP: f64 = 150.;
pub(crate) static FIGURE: LazyLock<Vec<(String, Contour)>> = LazyLock::new(|| {
    let doc = roxmltree::Document::parse(UNSEAL).expect("approved unseal contour");
    doc.descendants()
        .filter(|n| n.has_tag_name("path"))
        .map(|n| {
            (
                n.attribute("id").unwrap().to_owned(),
                Contour::new(n.attribute("d").unwrap()),
            )
        })
        .collect()
});
#[derive(Clone, Copy)]
pub(crate) struct Placement {
    pub origin: P,
    pub scale: f64,
}
impl Placement {
    /// The figure standing on a world point, `height` metres tall.
    pub fn standing(camera: &Camera, feet: W, height: f64) -> Self {
        let base = camera.project(feet);
        let scale = camera.scale(feet[2]) * height / (UNSEAL_FEET.1 - UNSEAL_TOP);
        Self {
            origin: (base.0 - UNSEAL_FEET.0 * scale, base.1 - UNSEAL_FEET.1 * scale),
            scale,
        }
    }
    pub fn at(&self, p: P) -> P {
        (self.origin.0 + p.0 * self.scale, self.origin.1 + p.1 * self.scale)
    }
    /// The transform carrying art drawn at `reference` to this placement, so a
    /// cached (blurred) copy follows the camera without being redrawn.
    pub fn from(&self, reference: Placement) -> String {
        let k = self.scale / reference.scale;
        format!(
            "matrix({k:.5} 0 0 {k:.5} {:.3} {:.3})",
            self.origin.0 - k * reference.origin.0,
            self.origin.1 - k * reference.origin.1
        )
    }
}
/// A plane affine map in SVG order: x' = a x + c y + e, y' = b x + d y + f.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct Affine(pub [f64; 6]);
impl Affine {
    pub const ID: Affine = Affine([1., 0., 0., 1., 0., 0.]);
    /// Scaling that keeps `at` in place.
    pub fn about(at: P, sx: f64, sy: f64) -> Self {
        Self([sx, 0., 0., sy, at.0 * (1. - sx), at.1 * (1. - sy)])
    }
    /// Turning around `at`, the same sense as `rotate`.
    pub fn turn(at: P, angle: f64) -> Self {
        let (s, c) = angle.sin_cos();
        Self([c, s, -s, c, at.0 - c * at.0 + s * at.1, at.1 - s * at.0 - c * at.1])
    }
    pub fn apply(&self, p: P) -> P {
        let [a, b, c, d, e, f] = self.0;
        (a * p.0 + c * p.1 + e, b * p.0 + d * p.1 + f)
    }
    pub fn inverse(&self) -> Self {
        let [a, b, c, d, e, f] = self.0;
        let det = a * d - b * c;
        let (ia, ib, ic, id) = (d / det, -b / det, -c / det, a / det);
        Self([ia, ib, ic, id, -(ia * e + ic * f), -(ib * e + id * f)])
    }
    /// This map, then `next`.
    pub fn then(&self, next: Affine) -> Self {
        let [a, b, c, d, e, f] = self.0;
        let [na, nb, nc, nd, ne, nf] = next.0;
        Self([
            na * a + nc * b,
            nb * a + nd * b,
            na * c + nc * d,
            nb * c + nd * d,
            na * e + nc * f + ne,
            nb * e + nd * f + nf,
        ])
    }
    pub fn svg(&self) -> String {
        let [a, b, c, d, e, f] = self.0;
        format!("matrix({a:.5} {b:.5} {c:.5} {d:.5} {e:.3} {f:.3})")
    }
}
/// Chest rise and an open, receiving gesture as one rigid map per part, in
/// art units. Legs and soles never move; the trunk grows from the pelvis seam.
pub(crate) fn unseal_pose(part: &str, breath: f64, open: f64) -> Affine {
    if part.contains("leg") {
        return Affine::ID;
    }
    let chest = Affine::about((1270., 470.), 1. + 0.012 * breath, 1. + 0.021 * breath);
    let (shoulder, angle) = if part.starts_with("near-arm") {
        (UNSEAL_SHOULDERS[0], open * 0.13)
    } else if part.starts_with("far-arm") {
        (UNSEAL_SHOULDERS[1], -open * 0.13)
    } else {
        return chest;
    };
    chest.then(Affine::turn(chest.apply(shoulder), angle))
}
/// One path holding every cover at rest: the silhouette for shadows and auras.
pub(crate) fn unseal_silhouette(at: Placement) -> String {
    FIGURE
        .iter()
        .filter(|(id, _)| id.ends_with("cover"))
        .map(|(_, c)| c.map(|p| at.at(p)))
        .collect()
}
/// Where a point of the breathing trunk is now.
pub(crate) fn unseal_mark(at: Placement, p: P, breath: f64, open: f64) -> P {
    at.at(unseal_pose("trunk", breath, open).apply(p))
}
/// An art point of a figure standing on `feet`, in world metres.
pub(crate) fn unseal_world(feet: W, height: f64, p: P) -> W {
    let k = height / (UNSEAL_FEET.1 - UNSEAL_TOP);
    [feet[0] + (p.0 - UNSEAL_FEET.0) * k, (UNSEAL_FEET.1 - p.1) * k, feet[2]]
}

/// Paint of a figure drawn by `still_unseal`.
pub(crate) struct Look<'a> {
    pub cover: &'a str,
    pub ink: &'a str,
    /// Rain coordinates and opacity of the code it carries.
    pub code: Option<(&'a str, f64)>,
    /// Light over each cover, under its ink.
    pub glow: Option<(&'a str, f64)>,
}
/// The figure at a fixed reference place; carry it with a group transform
/// (`Placement::from`). Contours never change: each moving part is posed by
/// its own group transform, which the renderer applies without retessellating.
pub(crate) fn still_unseal(c: &mut Canvas, at: Placement, breath: f64, open: f64, look: &Look) {
    let s = at.scale;
    let place = Affine([s, 0., 0., s, at.origin.0, at.origin.1]);
    let art = Affine([1. / s, 0., 0., 1. / s, -at.origin.0 / s, -at.origin.1 / s]);
    // Painter order pairs each part's cover with its ink.
    for (id, contour) in FIGURE.iter() {
        let part = id.trim_end_matches("-cover").trim_end_matches("-ink");
        let moving = !part.contains("leg");
        let d = || contour.map(|p| at.at(p));
        if id.ends_with("ink") {
            c.fixed(d, look.ink, 1.);
            if moving {
                c.end();
            }
            continue;
        }
        if moving {
            c.group("", &art.then(unseal_pose(part, breath, open)).then(place).svg(), 1.);
        }
        c.fixed(d, look.cover, 1.);
        if let Some((uv, alpha)) = look.code {
            c.fixed_rain(d, uv, alpha);
        }
        if let Some((paint, alpha)) = look.glow {
            c.fixed(d, paint, alpha);
        }
    }
}

/// The approved heroine of the breath scenes, her stair-stepped trace
/// straightened: far leg, near leg and upper body, each cover then ink.
pub(crate) static HEROINE: LazyLock<Vec<(String, String)>> = LazyLock::new(|| {
    let doc = roxmltree::Document::parse(crate::breath_heroine::ART).expect("approved heroine");
    doc.descendants()
        .filter(|n| n.has_tag_name("path"))
        .map(|n| {
            let mut rings: Vec<Vec<P>> = Vec::new();
            for segment in svgtypes::PathParser::from(n.attribute("d").unwrap()) {
                match segment.expect("traced contour") {
                    svgtypes::PathSegment::MoveTo { x, y, .. } => rings.push(vec![(x, y)]),
                    svgtypes::PathSegment::LineTo { x, y, .. } => rings.last_mut().unwrap().push((x, y)),
                    _ => {}
                }
            }
            let mut d = String::new();
            for ring in rings {
                for (i, (x, y)) in simplify(&ring, 1.2).into_iter().enumerate() {
                    let _ = write!(d, "{}{x} {y}", if i == 0 { 'M' } else { 'L' });
                }
                d.push('Z');
            }
            (n.attribute("id").unwrap().to_owned(), d)
        })
        .collect()
});
/// Her soles' centre, the top of her head, throat and the hand on her heart.
pub(crate) const HEROINE_FEET: P = (503.75, 1404.75);
pub(crate) const HEROINE_TOP: f64 = 29.;
pub(crate) const HEROINE_THROAT: P = (528., 236.);
pub(crate) const HEROINE_HEART: P = (515., 340.);
/// Art units to world x, y: soles on `feet`, `height` tall, facing right at 1
/// and turned round at −1; between, she is turning.
pub(crate) fn heroine_world(feet: W, height: f64, facing: f64) -> Affine {
    let m = height / (HEROINE_FEET.1 - HEROINE_TOP);
    Affine([facing * m, 0., 0., -m, feet[0] - facing * m * HEROINE_FEET.0, feet[1] + m * HEROINE_FEET.1])
}
/// A flat figure turning round over `u` from 0 to 1, as two drawings: the one
/// facing `from` narrows and hands over to the one facing the other way, so
/// she never thins to an edge. Pairs of facing and opacity.
pub(crate) fn turning(u: f64, from: f64) -> [(f64, f64); 2] {
    let narrow = 1. - 0.5 * (std::f64::consts::PI * u.clamp(0., 1.)).sin();
    let over = ramp(u, 0.35, 0.65);
    [(from * narrow, 1. - over), (-from * narrow, over)]
}
/// The upper body rising on a breath, about the hips.
fn heroine_breath(breath: f64) -> Affine {
    Affine::about((480., 715.), 1. + 0.01 * breath, 1. + 0.02 * breath)
}
/// Paint of the heroine, each layer with its own opacity; art units throughout.
pub(crate) struct Layers<'a> {
    pub cover: (&'a str, f64),
    /// Rain coordinates in art units, and opacity.
    pub code: Option<(&'a str, f64)>,
    /// Light over each cover, under its ink.
    pub glows: &'a [(&'a str, f64)],
    pub inks: &'a [(&'a str, f64)],
}
/// The heroine in art units under `place`, which the camera changes per frame.
pub(crate) fn heroine(c: &mut Canvas, place: Affine, breath: f64, alpha: f64, look: &Layers) {
    c.group("", &place.svg(), alpha);
    for (id, d) in HEROINE.iter() {
        let upper = id.starts_with("upper");
        if id.ends_with("ink") {
            for &(paint, alpha) in look.inks {
                c.fixed(|| d.clone(), paint, alpha);
            }
            if upper {
                c.end();
            }
            continue;
        }
        if upper {
            c.group("", &heroine_breath(breath).svg(), 1.);
        }
        c.fixed(|| d.clone(), look.cover.0, look.cover.1);
        if let Some((uv, alpha)) = look.code {
            c.fixed_rain(|| d.clone(), uv, alpha);
        }
        for &(paint, alpha) in look.glows {
            c.fixed(|| d.clone(), paint, alpha);
        }
    }
    c.end();
}
/// Where an art point of the breathing heroine is, through `place`.
pub(crate) fn heroine_mark(place: Affine, p: P, breath: f64) -> P {
    place.apply(heroine_breath(breath).apply(p))
}
/// Rain on her body in art units, as fine as on the other figures.
pub(crate) const HEROINE_CODE: &str = "0.000407 0 0 0 0.000488 0 0 0 1";
/// Paint for her covers and inks.
pub(crate) fn heroine_cover(paint: &str) -> String {
    format!(r#"fill="{paint}" fill-rule="evenodd""#)
}
pub(crate) fn heroine_ink(color: &str) -> String {
    format!(r#"fill="{color}" fill-rule="evenodd" stroke="{color}" stroke-width="3""#)
}

/// A level ring on the floor.
pub(crate) fn floor_ring(cam: &Camera, centre: W, r: f64) -> String {
    cam.poly(
        &(0..48)
            .map(|i| {
                let a = i as f64 / 48. * TAU;
                [centre[0] + r * a.cos(), 0., centre[2] + r * a.sin()]
            })
            .collect::<Vec<_>>(),
    )
}
/// Dust rising slowly through a box of the world and dimming at its ends.
#[allow(clippy::too_many_arguments)]
pub(crate) fn motes(cam: &Camera, t: f64, count: usize, seed: usize, x: (f64, f64), z: (f64, f64), height: f64, size: f64) -> String {
    let mut d = String::new();
    for i in 0..count {
        let k = seed + i * 3;
        let y = (hash(k + 2) * height + t * (0.1 + 0.08 * hash(k + 5))).rem_euclid(height);
        let p = [mix(x.0, x.1, hash(k)), y, mix(z.0, z.1, hash(k + 1))];
        let r = size * (y / height * std::f64::consts::PI).sin().sqrt();
        d.push_str(&circle(cam.project(p), (r * cam.scale(p[2])).max(0.2)));
    }
    d
}

/// A ring of short ticks, the scenes' marker for a held point of attention.
pub(crate) fn ticks(at: P, r: f64, n: usize, turn: f64) -> String {
    let mut d = String::new();
    for i in 0..n {
        let a = turn + i as f64 / n as f64 * TAU;
        let (r0, r1) = if i % (n / 4).max(1) == 0 { (r, r * 1.45) } else { (r * 1.08, r * 1.28) };
        let _ = write!(
            d,
            "M{:.2} {:.2}L{:.2} {:.2}",
            at.0 + r0 * a.cos(),
            at.1 + r0 * a.sin(),
            at.0 + r1 * a.cos(),
            at.1 + r1 * a.sin()
        );
    }
    d
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rain_coordinates_invert_the_camera() {
        let camera = Camera {
            eye: [0.3, 1.4, -6.],
            focal: 280.,
            center: (160., 90.),
        };
        let quad = [[-2., 3., 4.], [2., 3., 3.], [2., 0., 3.], [-2., 0., 4.]];
        let m: Vec<f64> = camera
            .uv(quad, [1., 1.])
            .split(' ')
            .map(|n| n.parse().unwrap())
            .collect();
        for (u, v) in [(0., 0.), (1., 0.), (0., 1.), (0.3, 0.7)] {
            let w = std::array::from_fn(|i| {
                quad[0][i] + (quad[1][i] - quad[0][i]) * u + (quad[3][i] - quad[0][i]) * v
            });
            let (x, y) = camera.project(w);
            let q = m[6] * x + m[7] * y + m[8];
            assert!(((m[0] * x + m[1] * y + m[2]) / q - u).abs() < 1e-6);
            assert!(((m[3] * x + m[4] * y + m[5]) / q - v).abs() < 1e-6);
        }
    }
    #[test]
    fn placement_stands_the_soles_on_the_floor() {
        let camera = Camera {
            eye: [0., 1.35, -6.5],
            focal: 300.,
            center: (160., 92.),
        };
        let at = Placement::standing(&camera, [-0.5, 0., 0.], 1.75);
        let feet = at.at(UNSEAL_FEET);
        let floor = camera.project([-0.5, 0., 0.]);
        assert!((feet.0 - floor.0).abs() < 1e-9 && (feet.1 - floor.1).abs() < 1e-9);
        assert!((at.at((0., UNSEAL_TOP)).1 - camera.project([0., 1.75, 0.]).1).abs() < 1e-9);
    }
    #[test]
    fn posed_parts_stay_joined() {
        let near = |p: P| (p.0 - 1270., p.1 - 470.);
        for (breath, open) in [(0., 0.), (1., 0.), (0.4, 0.85), (1., 1.)] {
            let trunk = unseal_pose("trunk", breath, open);
            // The pelvis seam with the still legs barely moves.
            for x in [1230., 1270., 1310.] {
                let (dx, dy) = near(trunk.apply((x, 470.)));
                assert!((dx - (x - 1270.)).abs() < 0.6 && dy.abs() < 1e-9);
            }
            // Arms turn about shoulders that ride the chest.
            for (part, shoulder) in [("near-arm", UNSEAL_SHOULDERS[0]), ("far-arm", UNSEAL_SHOULDERS[1])] {
                let (a, b) = (unseal_pose(part, breath, open).apply(shoulder), trunk.apply(shoulder));
                assert!((a.0 - b.0).abs() < 1e-9 && (a.1 - b.1).abs() < 1e-9);
            }
            assert_eq!(unseal_pose("far-leg", breath, open), Affine::ID);
        }
        let turn = Affine::turn((3., 4.), 0.7);
        let p = turn.then(Affine::about((1., 2.), 2., 0.5)).apply((5., -1.));
        let q = rotate((5., -1.), (3., 4.), 0.7);
        assert!((p.0 - (1. + 2. * (q.0 - 1.))).abs() < 1e-9 && (p.1 - (2. + 0.5 * (q.1 - 2.))).abs() < 1e-9);
    }
    #[test]
    fn text_follows_its_line() {
        let d = text_along("СВЕТ", &[(0., 0.), (40., 0.)], 2., 6.);
        assert!(d.starts_with('M') && !d.contains("NaN"));
        assert_eq!(text_along("СВЕТ", &[(0., 0.), (4., 0.)], 10., 6.), "");
        let (p, a) = along(&[(0., 0.), (10., 0.), (10., 10.)], 15.);
        assert!((p.0 - 10.).abs() < 1e-9 && (p.1 - 5.).abs() < 1e-9);
        assert!((a - std::f64::consts::FRAC_PI_2).abs() < 1e-9);
    }
}
