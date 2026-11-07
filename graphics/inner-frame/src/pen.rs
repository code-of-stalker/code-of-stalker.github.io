//! The drawing as a flat list the GPU reads straight: every stroke is one
//! straight 3D segment with its ink, every callout one anchored word. The
//! scene (`lib.rs`) fills a `Pen` for a moment of the loop; `browser.rs`
//! uploads its two arrays as they are.

/// Floats per stroke: a and its distance along the path, b and its
/// distance, the ink (width, light, dash period, dash duty), the tone
/// (cold, pale, warm, hidden) and the halo.
pub const LINE_FLOATS: usize = 20;
/// Floats per callout: where it is pinned and its row, then its light, how
/// much of it is typed and which way it runs.
pub const LABEL_FLOATS: usize = 8;
/// The most strokes one moment may hold (the GPU buffer is sized for it).
pub const MAX_LINES: usize = 4096;

/// How a stroke is drawn. Width is in pixels of a 720-high frame; light is
/// the line's brightness (1 a plain line); a dash period of 0 draws it
/// solid; tone mixes the theme's cold, pale and warm; `hidden` 1 draws the
/// stroke dashed and fainter where it lies behind the truss (a drawing's
/// hidden line); `glow` adds a soft halo.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Ink {
    pub width: f32,
    pub light: f32,
    pub dash: f32,
    pub duty: f32,
    pub tone: [f32; 3],
    pub hidden: f32,
    pub glow: f32,
}

pub const COLD: [f32; 3] = [1.0, 0.0, 0.0];
pub const PALE: [f32; 3] = [0.0, 1.0, 0.0];
pub const WARM: [f32; 3] = [0.0, 0.0, 1.0];

impl Ink {
    pub const fn new(width: f32, light: f32, tone: [f32; 3]) -> Self {
        Self {
            width,
            light,
            dash: 0.0,
            duty: 0.5,
            tone,
            hidden: 0.0,
            glow: 0.0,
        }
    }
    pub fn lit(self, k: f32) -> Self {
        Self {
            light: self.light * k.max(0.0),
            ..self
        }
    }
    pub const fn dashed(self, period: f32, duty: f32) -> Self {
        Self {
            dash: period,
            duty,
            ..self
        }
    }
    pub const fn behind(self) -> Self {
        Self {
            hidden: 1.0,
            ..self
        }
    }
    pub const fn glowing(self, glow: f32) -> Self {
        Self { glow, ..self }
    }
    pub const fn wide(self, width: f32) -> Self {
        Self { width, ..self }
    }
}

pub fn add(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
pub fn sub(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
pub fn scale(a: [f32; 3], k: f32) -> [f32; 3] {
    [a[0] * k, a[1] * k, a[2] * k]
}
pub fn lerp(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    add(a, scale(sub(b, a), t))
}
pub fn dot(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
pub fn length(a: [f32; 3]) -> f32 {
    dot(a, a).sqrt()
}
pub fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
pub fn normalize(a: [f32; 3]) -> [f32; 3] {
    scale(a, 1.0 / length(a).max(1e-6))
}

#[derive(Clone, Debug, Default)]
pub struct Pen {
    pub lines: Vec<f32>,
    pub labels: Vec<f32>,
}

impl Pen {
    pub fn clear(&mut self) {
        self.lines.clear();
        self.labels.clear();
    }
    pub fn line_count(&self) -> usize {
        self.lines.len() / LINE_FLOATS
    }
    pub fn label_count(&self) -> usize {
        self.labels.len() / LABEL_FLOATS
    }
    /// One stroke from `a` to `b`, `s0`..`s1` along its path (for dashes).
    /// Strokes too faint to see, and any past `MAX_LINES`, are left out.
    pub fn stroke(&mut self, a: [f32; 3], b: [f32; 3], s: [f32; 2], ink: Ink) {
        if ink.light < 2e-3 || self.line_count() >= MAX_LINES {
            return;
        }
        self.lines.extend_from_slice(&[
            a[0],
            a[1],
            a[2],
            s[0],
            b[0],
            b[1],
            b[2],
            s[1],
            ink.width,
            ink.light,
            ink.dash,
            ink.duty,
            ink.tone[0],
            ink.tone[1],
            ink.tone[2],
            ink.hidden,
            ink.glow,
            0.0,
            0.0,
            0.0,
        ]);
    }
    pub fn line(&mut self, a: [f32; 3], b: [f32; 3], ink: Ink) {
        self.stroke(a, b, [0.0, length(sub(b, a))], ink);
    }
    /// The part `from`..`to` (0..1) of the line from `a` to `b`: a line
    /// being drawn, or being erased behind its pen.
    pub fn part(&mut self, a: [f32; 3], b: [f32; 3], from: f32, to: f32, ink: Ink) {
        let (from, to) = (from.clamp(0.0, 1.0), to.clamp(0.0, 1.0));
        if to <= from {
            return;
        }
        let l = length(sub(b, a));
        self.stroke(lerp(a, b, from), lerp(a, b, to), [l * from, l * to], ink);
    }
    /// A glowing point, `width` pixels across.
    pub fn dot(&mut self, p: [f32; 3], width: f32, light: f32, tone: [f32; 3]) {
        self.stroke(p, p, [0.0, 0.0], Ink::new(width, light, tone));
    }
    /// The part `from`..`to` (0..1 of its parameter) of the curve `f`, cut
    /// into `n` straight pieces; distance along it counts from its start, so
    /// dashes stay put while it is drawn.
    pub fn curve(&mut self, n: usize, from: f32, to: f32, ink: Ink, f: impl Fn(f32) -> [f32; 3]) {
        self.curve_lit(n, from, to, ink, f, |_| 1.0);
    }
    /// `curve` whose light changes along it: each piece takes the ink's
    /// light times `lit` at its middle.
    pub fn curve_lit(
        &mut self,
        n: usize,
        from: f32,
        to: f32,
        ink: Ink,
        f: impl Fn(f32) -> [f32; 3],
        lit: impl Fn(f32) -> f32,
    ) {
        let (from, to) = (from.clamp(0.0, 1.0), to.clamp(0.0, 1.0));
        if to <= from || ink.light < 2e-3 || n == 0 {
            return;
        }
        let mut s = 0.0;
        let mut p = f(0.0);
        for i in 0..n {
            let (u0, u1) = (i as f32 / n as f32, (i + 1) as f32 / n as f32);
            let q = f(u1);
            let l = length(sub(q, p));
            if u1 > from && u0 < to {
                let (a, b) = ((from.max(u0) - u0) * n as f32, (to.min(u1) - u0) * n as f32);
                let ink = ink.lit(lit(u0 + 0.5 * (a + b) / n as f32));
                self.stroke(lerp(p, q, a), lerp(p, q, b), [s + l * a, s + l * b], ink);
            }
            if u1 >= to {
                break;
            }
            s += l;
            p = q;
        }
    }
    /// A callout: the word in row `row` of the atlas, pinned at `at` (the
    /// leader's end), typed up to `reveal` (0..1); `align` 0 runs it right
    /// from the pin, 1 ends it at the pin.
    pub fn label(&mut self, at: [f32; 3], row: usize, light: f32, reveal: f32, align: f32) {
        if light < 2e-3 || reveal <= 0.0 {
            return;
        }
        self.labels.extend_from_slice(&[
            at[0],
            at[1],
            at[2],
            row as f32,
            light,
            reveal.min(1.0),
            align,
            0.0,
        ]);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_curve_drawn_in_parts_keeps_its_dashes() {
        let circle = |u: f32| {
            let (s, c) = (u * std::f32::consts::TAU).sin_cos();
            [c, 0.0, s]
        };
        let ink = Ink::new(1.0, 1.0, COLD).dashed(0.1, 0.5);
        let mut whole = Pen::default();
        whole.curve(32, 0.0, 1.0, ink, circle);
        let mut half = Pen::default();
        half.curve(32, 0.5, 1.0, ink, circle);
        assert_eq!(whole.line_count(), 32);
        assert_eq!(half.line_count(), 16);
        // The second half starts where the whole one had got to.
        let at = 16 * LINE_FLOATS;
        assert_eq!(
            &half.lines[..LINE_FLOATS],
            &whole.lines[at..at + LINE_FLOATS]
        );
        let mut cut = Pen::default();
        cut.curve(32, 0.0, 0.26, ink, circle);
        assert_eq!(cut.line_count(), 9);
    }

    #[test]
    fn faint_strokes_are_left_out() {
        let mut pen = Pen::default();
        pen.line([0.0; 3], [1.0, 0.0, 0.0], Ink::new(1.0, 0.0, PALE));
        pen.part(
            [0.0; 3],
            [1.0, 0.0, 0.0],
            0.6,
            0.4,
            Ink::new(1.0, 1.0, PALE),
        );
        pen.label([0.0; 3], 0, 1.0, 0.0, 0.0);
        assert_eq!((pen.line_count(), pen.label_count()), (0, 0));
    }
}
