//! Perspective scenery behind the voice-release figure; uses the shared rain.
use std::fmt::Write;
type V = [f64; 3];
fn p(v: V) -> (f64, f64) {
    (
        480. + 400. * v[0] / (v[2] + 3.),
        260. + 400. * v[1] / (v[2] + 3.),
    )
}
fn path(points: &[V], close: bool) -> String {
    let mut d = String::new();
    for (i, &v) in points.iter().enumerate() {
        let (x, y) = p(v);
        let _ = write!(d, "{}{x:.3} {y:.3}", if i == 0 { 'M' } else { 'L' });
    }
    if close {
        d.push('Z');
    }
    d
}
fn rain_uv(a: V, b: V, d: V) -> String {
    let u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    let v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let h = [
        400. * u[0] + 480. * u[2],
        400. * v[0] + 480. * v[2],
        400. * a[0] + 480. * (a[2] + 3.),
        400. * u[1] + 260. * u[2],
        400. * v[1] + 260. * v[2],
        400. * a[1] + 260. * (a[2] + 3.),
        u[2],
        v[2],
        a[2] + 3.,
    ];
    let [a, b, c, d, e, f, g, h, i] = h;
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
    co.map(|v| format!("{:.10}", v / det)).join(" ")
}
fn line(out: &mut String, points: &[V], alpha: f64, width: f64) {
    let d = path(points, false);
    let _ = write!(
        out,
        r#"<path d="{d}" fill="none" stroke="var(--book-ink)" stroke-opacity="{alpha}" stroke-width="{width}"/>"#
    );
}
fn face(out: &mut String, points: &[V], material: &str, alpha: f64) {
    let d = path(points, true);
    let _ = write!(
        out,
        r#"<path d="{d}" fill="var(--book-cover)"/><path d="{d}" fill="url(#{material})" stroke="var(--book-ink)" stroke-opacity="{alpha}" stroke-width="0.7"/>"#
    );
}
fn rain(out: &mut String, corners: [V; 4], alpha: f64) {
    let d = path(&corners, true);
    let uv = rain_uv(corners[0], corners[1], corners[3]);
    let _ = write!(
        out,
        r#"<path d="{d}" data-rust-matrix-uv="{uv}" fill="none" stroke="none" opacity="{alpha}"/>"#
    );
}
// Solid architecture: lit top, dark front and independently shaded inner side.
// The foreground masses occlude the smaller structures behind them.
fn tower(out: &mut String, x0: f64, x1: f64, z: f64, top: f64, depth: f64, energy: f64) {
    let inner = if x0 < 0. { x1 } else { x0 };
    let inward = if x0 < 0. { -0.055 } else { 0.055 };
    let roof = [
        [x0, top, z],
        [x1, top, z],
        [x1, top, z + depth],
        [x0, top, z + depth],
    ];
    let side = [
        [inner, top, z],
        [inner, top, z + depth],
        [inner, 5., z + depth],
        [inner, 5., z],
    ];
    let front = [[x0, top, z], [x1, top, z], [x1, 5., z], [x0, 5., z]];
    // A broad shallow plinth makes each mass sit on the ground.
    face(
        out,
        &[
            [x0 - 0.18, 4.78, z - 0.15],
            [x1 + 0.18, 4.78, z - 0.15],
            [x1 + 0.18, 4.78, z + depth + 0.15],
            [x0 - 0.18, 4.78, z + depth + 0.15],
        ],
        "unseal-metal-top",
        energy * 0.32,
    );
    // Camera is at world y=0, looking along +z. Tops above the camera
    // face away: drawing their grid makes the opaque tower look transparent.
    if top > 0. {
        face(out, &roof, "unseal-metal-top", energy * 0.65);
        for f in [0.3, 0.7] {
            let x = x0 + (x1 - x0) * f;
            line(
                out,
                &[[x, top, z + 0.06], [x, top, z + depth - 0.08]],
                energy * 0.22,
                0.6,
            );
        }
    }
    face(out, &side, "unseal-metal-side", energy * 0.48);
    face(out, &front, "unseal-metal-front", energy * 0.55);
    rain(
        out,
        [
            [x0 + 0.12, top + 0.34, z],
            [x1 - 0.12, top + 0.34, z],
            [x1 - 0.12, 4.35, z],
            [x0 + 0.12, 4.35, z],
        ],
        energy * 0.62,
    );
    rain(
        out,
        [
            [inner + inward, top + 0.32, z + 0.18],
            [inner + inward, top + 0.32, z + depth - 0.16],
            [inner + inward, 4.3, z + depth - 0.16],
            [inner + inward, 4.3, z + 0.18],
        ],
        energy * 0.4,
    );
    // Luminous seams have a dark recess and a sharp core, not an outline glow.
    let seam = [[inner, top + 0.22, z + 0.10], [inner, 4.7, z + 0.10]];
    line(out, &seam, energy * 0.08, 7.);
    line(out, &seam, energy * 0.75, 1.25);
    line(
        out,
        &[[x0, top + 0.18, z], [x1, top + 0.18, z]],
        energy * 0.68,
        1.05,
    );
    line(
        out,
        &[[inner, top, z], [inner, top, z + depth]],
        energy * 0.72,
        1.,
    );
    // Circuit routing across the front face, deliberately sparse around the rain.
    for j in 0..3 {
        let y = top + 0.65 + j as f64 * 0.23;
        line(
            out,
            &[
                [x0 + 0.12, y, z],
                [x0 + 0.36, y, z],
                [x0 + 0.44, y + 0.10, z],
                [x1 - 0.13, y + 0.10, z],
            ],
            energy * 0.27,
            0.65,
        );
    }
    for j in 0..5 {
        let x = x0 + 0.17 + j as f64 * (x1 - x0 - 0.34) / 5.;
        line(
            out,
            &[[x, 4.55, z], [x + 0.045, 4.55, z]],
            energy * 0.65,
            1.5,
        );
    }
    line(out, &[[x0, 4.75, z], [x1, 4.75, z]], energy * 0.38, 0.9);
    // Long contact shadows follow the perspective of the floor.
    let shadow = path(
        &[
            [inner, 5., z],
            [inner, 5., z + depth],
            [inner * 0.7, 5., z + depth + 1.9],
            [inner * 0.76, 5., z + 0.8],
        ],
        true,
    );
    let _ = write!(
        out,
        r#"<path d="{shadow}" fill="var(--book-cover)" opacity="0.45"/>"#
    );
}
pub(super) fn svg() -> String {
    let mut out = String::from(
        r##"<defs>
    <linearGradient id="unseal-metal-front" x1="0" y1="0" x2="1" y2="0.3"><stop stop-color="var(--book-ink)" stop-opacity="0.035"/><stop offset="0.72" stop-color="var(--book-ink)" stop-opacity="0.065"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0.13"/></linearGradient>
    <linearGradient id="unseal-metal-side" x1="0" y1="0" x2="1" y2="1"><stop stop-color="var(--book-ink)" stop-opacity="0.12"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0.018"/></linearGradient>
    <linearGradient id="unseal-metal-top" x1="0" y1="0" x2="1" y2="1"><stop stop-color="var(--book-ink)" stop-opacity="0.20"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0.055"/></linearGradient>
    <radialGradient id="unseal-space-haze"><stop stop-color="var(--book-ink)" stop-opacity="0.075"/><stop offset="0.5" stop-color="var(--book-ink)" stop-opacity="0.025"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
    <linearGradient id="unseal-light-shaft" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--book-ink)" stop-opacity="0"/><stop offset="0.45" stop-color="var(--book-ink)" stop-opacity="0.045"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></linearGradient>
    <radialGradient id="unseal-ground-light"><stop stop-color="var(--book-ink)" stop-opacity="0.11"/><stop offset="0.55" stop-color="var(--book-ink)" stop-opacity="0.03"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
    </defs><g class="unseal-space"><path d="M150 80H810V520H150Z" fill="url(#unseal-space-haze)"/>
    <path d="M170 45L260 45 465 545 205 545Z M702 45L736 45 630 540 530 540Z" fill="url(#unseal-light-shaft)"/>
    <path d="M75 330H885V575H75Z" fill="url(#unseal-ground-light)"/>"##,
    );
    // Large floor plates with alternating material faces. Grid fades into depth.
    for zi in 0..8 {
        let z = 2. + zi as f64 * 2.7;
        for xi in -4..4 {
            let x = xi as f64 * 2.2;
            let d = path(
                &[
                    [x + 0.035, 5., z + 0.035],
                    [x + 2.165, 5., z + 0.035],
                    [x + 2.165, 5., z + 2.665],
                    [x + 0.035, 5., z + 2.665],
                ],
                true,
            );
            let a = if (xi + zi) % 2 == 0 { 0.022 } else { 0.009 };
            let _ = write!(
                out,
                r#"<path d="{d}" fill="var(--book-ink)" fill-opacity="{a}" stroke="var(--book-ink)" stroke-opacity="0.11" stroke-width="0.55"/>"#
            );
        }
    }
    // Floor inlays terminate at different depths; the middle remains quiet.
    for (x, z1, z2) in [
        (-3.5, 3., 7.5),
        (3.7, 4., 11.),
        (-2.5, 9., 16.),
        (2.8, 14., 23.),
    ] {
        line(&mut out, &[[x, 5., z1], [x, 5., z2]], 0.33, 1.1);
        line(&mut out, &[[x, 5., z1], [x, 5., z2]], 0.045, 5.);
    }
    out.push_str(r#"<g class="unseal-space-far">"#);
    tower(&mut out, -6.5, -4.6, 17., -4.5, 3., 0.38);
    tower(&mut out, 4.4, 6.3, 14.5, -3.7, 3., 0.43);
    out.push_str(r#"</g><g class="unseal-space-mid">"#);
    tower(&mut out, -4.8, -3.25, 8.0, -2.1, 2.8, 0.62);
    tower(&mut out, 3.8, 5.8, 9.5, -4.2, 3.2, 0.67);
    out.push_str(r#"</g><g class="unseal-space-near">"#);
    tower(&mut out, -6.5, -4.55, 3.4, -2.8, 3.2, 0.88);
    tower(&mut out, 4.55, 6.8, 4.1, -3.5, 3.5, 0.82);
    out.push_str("</g></g>");
    out
}
pub(super) fn frame(t: f64) -> Vec<crate::step_three::Update> {
    // Very small, periodic differential movement preserves the floor contact.
    let drift = (t * std::f64::consts::TAU / super::PERIOD).sin();
    [("far", 0.25), ("mid", 0.8), ("near", 1.8)]
        .into_iter()
        .map(|(name, amount)| crate::step_three::Update {
            selector: format!(".unseal-space-{name}"),
            attribute: "transform",
            value: format!("translate({:0.4} 0)", drift * amount),
        })
        .collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn hidden_roof_does_not_project_edges_through_solid_faces() {
        let mut above = String::new();
        let mut below = String::new();
        tower(&mut above, -6., -4., 4., -3., 3., 0.8);
        tower(&mut below, -6., -4., 4., 1., 3., 0.8);
        // One visible plinth top remains; the tower roof only appears below eye level.
        assert_eq!(above.matches("fill=\"url(#unseal-metal-top)\"").count(), 1);
        assert_eq!(below.matches("fill=\"url(#unseal-metal-top)\"").count(), 2);
    }
    #[test]
    fn volumes_have_independent_projected_faces() {
        let s = svg();
        assert_eq!(s.matches("data-rust-matrix-uv").count(), 12);
        assert!(!s.contains("NaN"));
        assert!(!s.contains("inf"));
        assert!(p([5., 5., 3.]).0 > p([5., 5., 14.]).0);
        assert!(p([5., 5., 3.]).1 > p([5., 5., 14.]).1);
        let start = frame(0.);
        let end = frame(super::super::PERIOD);
        for (a, b) in start.iter().zip(end) {
            assert_eq!(a.selector, b.selector);
            assert_eq!(a.attribute, b.attribute);
        }
    }
}
