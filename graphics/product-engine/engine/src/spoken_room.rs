//! Perspective-bound holographic room for the spoken-thought study.
//! Geometry, surface code and reveal remain in the shared Rust renderer.
use crate::step_three::Update;
use std::fmt::Write;

type Point = (f64, f64);
type WorldPoint = [f64; 3];
const FOCAL: f64 = 220.;
const EYE_HEIGHT: f64 = 1.2;
const HORIZON: f64 = 78.;
const CENTER_X: f64 = 178.;
fn project([x, y, z]: WorldPoint) -> Point {
    (
        CENTER_X + FOCAL * x / z,
        HORIZON + FOCAL * (EYE_HEIGHT - y) / z,
    )
}
#[derive(Clone, Copy)]
struct Surface([WorldPoint; 4]);
impl Surface {
    fn at(self, u: f64, v: f64) -> Point {
        let [a, b, c, d] = self.0;
        project(std::array::from_fn(|i| {
            a[i] * (1. - u) * (1. - v) + b[i] * u * (1. - v) + c[i] * u * v + d[i] * (1. - u) * v
        }))
    }
    fn line(self, u: f64, v: f64, uu: f64, vv: f64) -> String {
        let (x, y) = self.at(u, v);
        let (xx, yy) = self.at(uu, vv);
        format!("M{x:.3} {y:.3}L{xx:.3} {yy:.3}")
    }
    fn rect(self, u: f64, v: f64, w: f64, h: f64) -> String {
        let mut d = String::new();
        for (i, (u, v)) in [(u, v), (u + w, v), (u + w, v + h), (u, v + h)]
            .into_iter()
            .enumerate()
        {
            let (x, y) = self.at(u, v);
            let _ = write!(d, "{}{x:.3} {y:.3}", if i == 0 { 'M' } else { 'L' });
        }
        d.push('Z');
        d
    }
}
// Metres, one pinhole camera: 2.7m ceiling, 2.1m doorway and eye level 1.2m.
// Both wall directions and the floor lattice share their vanishing points.
const LEFT: Surface = Surface([
    [-3.5, 2.7, 4.5],
    [0., 2.7, 8.],
    [0., 0., 8.],
    [-3.5, 0., 4.5],
]);
const RIGHT: Surface = Surface([[0., 2.7, 8.], [3., 2.7, 5.], [3., 0., 5.], [0., 0., 8.]]);
const FLOOR: Surface = Surface([
    [0., 0., 8.],
    [-2.75, 0., 5.25],
    [0., 0., 2.5],
    [2.75, 0., 5.25],
]);
// The ceiling uses the same orthogonal axes as the floor, 2.7m above it.
const CEILING: Surface = Surface([
    [0., 2.7, 8.],
    [-2.75, 2.7, 5.25],
    [0., 2.7, 2.5],
    [2.75, 2.7, 5.25],
]);
fn ceiling_outline() -> String {
    let a = LEFT.at(0., 0.);
    let b = LEFT.at(1., 0.);
    let c = RIGHT.at(1., 0.);
    format!(
        "M{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}V7H12Z",
        a.0, a.1, b.0, b.1, c.0, c.1
    )
}
fn floor_outline() -> String {
    let a = LEFT.at(0., 1.);
    let b = LEFT.at(1., 1.);
    let c = RIGHT.at(1., 1.);
    format!(
        "M{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}V187H12Z",
        a.0, a.1, b.0, b.1, c.0, c.1
    )
}
const HAZE_STRIPS: [(Surface, f64, f64); 14] = [
    (LEFT, 0.07, 0.11),
    (LEFT, 0.23, 0.56),
    (LEFT, 0.40, 0.28),
    (LEFT, 0.61, 0.65),
    (LEFT, 0.84, 0.20),
    (RIGHT, 0.10, 0.50),
    (RIGHT, 0.28, 0.08),
    (RIGHT, 0.43, 0.60),
    (RIGHT, 0.55, 0.30),
    (RIGHT, 0.96, 0.02),
    (FLOOR, 0.22, 0.01),
    (FLOOR, 0.46, 0.36),
    (FLOOR, 0.70, 0.18),
    (FLOOR, 0.91, 0.61),
];

fn path(out: &mut String, d: &str, ink: &str, width: f64, alpha: f64) {
    let _ = write!(
        out,
        r#"<path d="{d}" fill="none" stroke="var(--book-{ink})" stroke-width="{width}" opacity="{alpha}" stroke-linejoin="round"/>"#
    );
}
fn architecture() -> String {
    let mut out = String::new();
    out.push_str(r#"<g class="spoken-ceiling-plane" clip-path="url(#spoken-ceiling-bounds)">"#);
    let _ = write!(
        out,
        r#"<path d="{}" fill="var(--book-ink)" opacity=".018"/>"#,
        ceiling_outline()
    );
    for i in 0..=12 {
        let u = i as f64 * 0.14;
        let far = (8. - 0.8) / 2.75 - u;
        path(&mut out, &CEILING.line(u, 0., u, far), "line", 0.22, 0.30);
        path(&mut out, &CEILING.line(0., u, far, u), "line", 0.22, 0.30);
    }
    out.push_str("</g>");
    for wall in [LEFT, RIGHT] {
        path(&mut out, &wall.line(0., 0., 1., 0.), "ink", 0.48, 0.64);
        path(&mut out, &wall.line(0., 1., 1., 1.), "ink", 0.48, 0.64);
        path(
            &mut out,
            &wall.line(0., 0.025, 1., 0.025),
            "dim",
            0.25,
            0.40,
        );
        for i in 1..9 {
            path(
                &mut out,
                &wall.line(i as f64 / 9., 0.025, i as f64 / 9., 0.98),
                "dim",
                0.22,
                0.34,
            );
        }
        for i in 1..13 {
            path(
                &mut out,
                &wall.line(0.01, i as f64 / 13., 0.99, i as f64 / 13.),
                "dim",
                0.18,
                if i % 3 == 0 { 0.32 } else { 0.16 },
            );
        }
    }
    path(&mut out, &RIGHT.line(0., 0., 0., 1.), "ink", 0.48, 0.64);
    path(
        &mut out,
        &RIGHT.line(0.018, 0.025, 0.018, 1.),
        "dim",
        0.2,
        0.3,
    );
    out.push_str("<g clip-path=\"url(#spoken-floor-bounds)\">");
    // Orthogonal directions on the physical floor; neither converges at the
    // wall/floor corner. The former fan of lines incorrectly did so.
    for i in 0..=12 {
        let u = i as f64 * 0.14;
        let far = (8. - 0.8) / 2.75 - u;
        path(&mut out, &FLOOR.line(u, 0., u, far), "line", 0.26, 0.40);
        path(&mut out, &FLOOR.line(0., u, far, u), "line", 0.26, 0.40);
    }
    out.push_str("</g>");
    let door = RIGHT.rect(0.635, 1. - 2.1 / 2.7, 0.23, 2.1 / 2.7);
    let _ = write!(out, r##"<path d="{door}" fill="#000" opacity=".92"/>"##);
    path(&mut out, &door, "ink", 0.74, 0.88);
    path(
        &mut out,
        &RIGHT.rect(0.61, 1. - 2.17 / 2.7, 0.28, 2.17 / 2.7),
        "ink",
        0.38,
        0.57,
    );
    // The inset jamb is another parallel world plane, 9cm behind the wall.
    let jamb = Surface([
        [0.09, 2.7, 8.09],
        [3.09, 2.7, 5.09],
        [3.09, 0., 5.09],
        [0.09, 0., 8.09],
    ]);
    path(
        &mut out,
        &jamb.rect(0.65, 1. - 2.04 / 2.7, 0.195, 2.04 / 2.7),
        "line",
        0.34,
        0.58,
    );
    out
}
// Complete the far side of the chair behind the untouched approved drawing.
// Each foot is 20cm farther from the camera on the same ground plane.
fn recede(p: Point, depth: f64, near_z: f64) -> Point {
    let ratio = near_z / (near_z + depth);
    (
        CENTER_X + (p.0 - CENTER_X) * ratio,
        HORIZON + (p.1 - HORIZON) * ratio,
    )
}
pub fn chair_depth_svg() -> String {
    let feet_y = 59. + 519. * 0.23;
    let near_z = FOCAL * EYE_HEIGHT / (feet_y - HORIZON);
    let mut out = String::from(
        r##"<g class="spoken-chair-far" fill="#000" stroke="var(--book-ink)" stroke-width=".36" stroke-linejoin="round" opacity=".78">"##,
    );
    // A complete back panel across the same chair depth as the seat: broad
    // face, upper thickness and a far upright tied into the far seat post.
    // It is painted behind the exact person, preserving natural occlusion.
    let back_top = (38.7, 104.3);
    let back_bottom = (41.5, 138.2);
    let far_top = recede(back_top, 0.20, near_z);
    let far_bottom = recede(back_bottom, 0.20, near_z);
    let top_outer = (35.0, 104.8);
    let far_outer = recede(top_outer, 0.20, near_z);
    let _ = write!(
        out,
        r#"<path class="spoken-chair-back-face" fill="var(--book-cover)" d="M{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}Z"/>"#,
        back_top.0,
        back_top.1,
        far_top.0,
        far_top.1,
        far_bottom.0,
        far_bottom.1,
        back_bottom.0,
        back_bottom.1
    );
    let _ = write!(
        out,
        r#"<path class="spoken-chair-back-top" d="M{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}Z"/>"#,
        top_outer.0,
        top_outer.1,
        far_outer.0,
        far_outer.1,
        far_top.0,
        far_top.1,
        back_top.0,
        back_top.1
    );
    // The near bevel remains visible beside the body even though the broad
    // far edge is naturally behind it. It follows the actual panel plane.
    let bevel_top = recede(back_top, 0.035, near_z);
    let bevel_bottom = recede(back_bottom, 0.035, near_z);
    let _ = write!(
        out,
        r#"<path class="spoken-chair-back-bevel" d="M{:.3} {:.3}L{:.3} {:.3}" fill="none" stroke-width=".24" opacity=".55"/>"#,
        bevel_top.0, bevel_top.1, bevel_bottom.0, bevel_bottom.1
    );
    let far_post = recede((39., 140.5), 0.20, near_z);
    let _ = write!(
        out,
        r#"<path class="spoken-chair-back-post" d="M{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}Z"/>"#,
        far_top.0,
        far_top.1,
        far_post.0 + 0.65,
        far_post.1,
        far_post.0 - 0.65,
        far_post.1,
        far_top.0 - 1.2,
        far_top.1
    );
    for (i, top, foot) in [
        (0, (39., 140.5), (36.8, feet_y)),
        (1, (74.7, 140.0), (75.0, feet_y)),
    ] {
        let t = recede(top, 0.20, near_z);
        let f = recede(foot, 0.20, near_z);
        let _ = write!(
            out,
            r#"<path class="spoken-chair-far-leg-{i}" d="M{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}Z"/>"#,
            t.0 - 0.65,
            t.1,
            f.0 - 0.75,
            f.1,
            f.0 + 0.65,
            f.1,
            t.0 + 0.65,
            t.1
        );
    }
    // The end of the seat has real thickness; its far corner joins the
    // far front leg. The approved body naturally occludes the upper part.
    let front = recede((74.7, 138.6), 0.20, near_z);
    let bottom = recede((74.7, 142.5), 0.20, near_z);
    let _ = write!(
        out,
        r#"<path class="spoken-chair-front-face" d="M74.7 138.6L{:.3} {:.3}L{:.3} {:.3}L74.7 142.5Z"/>"#,
        front.0, front.1, bottom.0, bottom.1
    );
    let l = recede((39., 140.5), 0.20, near_z);
    let r = recede((74.7, 140.), 0.20, near_z);
    let _ = write!(
        out,
        r#"<path class="spoken-chair-depth-rail" d="M39 140.5L{:.3} {:.3}L{:.3} {:.3}L74.7 140" fill="none"/></g>"#,
        l.0, l.1, r.0, r.1
    );
    out
}
fn surface_details() -> String {
    let mut out = String::new();
    for (side, surface) in [LEFT, RIGHT].iter().enumerate() {
        // Translucent surface strips stay flush with each wall rather than
        // hovering in front of the person as unrelated interface panels.
        for (u, w, v, h) in [
            (0.035, 0.065, 0.02, 0.88),
            (0.34, 0.12, 0.08, 0.86),
            (0.76, 0.06, 0.03, 0.9),
        ] {
            if side == 1 && u > 0.55 {
                continue;
            }
            let d = surface.rect(u, v, w, h);
            let _ = write!(
                out,
                r#"<path d="{d}" fill="var(--book-ink)" opacity=".018"/>"#
            );
            path(&mut out, &surface.line(u, v, u, v + h), "ink", 0.18, 0.16);
        }
        for i in 0..22 {
            let u = ((i * 7 + side * 3) % 23) as f64 / 25.;
            let v = ((i * 11 + 4) % 29) as f64 / 32.;
            if side == 1 && u > 0.55 && u < 0.95 {
                continue;
            }
            let d = surface.rect(u, v, 0.025 + (i % 3) as f64 * 0.01, 0.018);
            let _ = write!(
                out,
                r#"<path d="{d}" fill="var(--book-ink)" opacity="{}"/>"#,
                if i % 6 == 0 { 0.12 } else { 0.045 }
            );
            path(
                &mut out,
                &surface.line(u, v + 0.04, (u + 0.06).min(0.99), v + 0.04),
                "line",
                0.2,
                0.30,
            );
        }
        for i in 1..31 {
            let v = i as f64 / 32.;
            path(
                &mut out,
                &surface.line(0.02, v, if side == 1 { 0.54 } else { 0.98 }, v),
                "dim",
                0.10,
                0.16,
            );
        }
    }
    out
}
// Project the existing Laboratory rain texture through each actual world plane.
// Homogeneous UVs preserve perspective inside triangles, not just at corners.
impl Surface {
    fn rain_mapping(self) -> [f64; 9] {
        let [a, b, _, d] = self.0;
        let u = std::array::from_fn::<_, 3, _>(|i| b[i] - a[i]);
        let v = std::array::from_fn::<_, 3, _>(|i| d[i] - a[i]);
        let h = [
            FOCAL * u[0] + CENTER_X * u[2],
            FOCAL * v[0] + CENTER_X * v[2],
            FOCAL * a[0] + CENTER_X * a[2],
            -FOCAL * u[1] + HORIZON * u[2],
            -FOCAL * v[1] + HORIZON * v[2],
            FOCAL * (EYE_HEIGHT - a[1]) + HORIZON * a[2],
            u[2],
            v[2],
            a[2],
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
        co.map(|x| x / det)
    }
    fn rain(self, name: &str, shape: String, clip: &str) -> String {
        let uv = self.rain_mapping().map(|n| format!("{n:.10}")).join(" ");
        format!(r#"<path class="spoken-lab-rain-{name}" data-rust-matrix-uv="{uv}" d="{shape}" fill="none" stroke="none" opacity=".90" {clip}/ >"#).replace("/ >","/>")
    }
}
fn laboratory_rain_surfaces() -> String {
    let mut out = LEFT.rain("left", LEFT.rect(0., 0., 1., 1.), "");
    out.push_str(&RIGHT.rain("right", RIGHT.rect(0., 0., 1., 1.), ""));
    // The room floor is larger than the reference parallelogram. The projective
    // UV map repeats in world space, so both grid directions stay coherent.
    out.push_str(&FLOOR.rain(
        "floor",
        floor_outline(),
        r#"clip-path="url(#spoken-floor-bounds)""#,
    ));
    out.push_str("<g opacity=\".5\">");
    out.push_str(&CEILING.rain(
        "ceiling",
        ceiling_outline(),
        r#"clip-path="url(#spoken-ceiling-bounds)""#,
    ));
    out.push_str("</g>");
    out
}
pub fn svg() -> String {
    let arch = architecture();
    let mut out = String::from(
        r##"<defs>
      <clipPath id="spoken-room-bounds"><rect x="12" y="7" width="296" height="180"/></clipPath>
      <clipPath id="spoken-floor-bounds"><path d="FLOOR_OUTLINE"/></clipPath>
      <clipPath id="spoken-ceiling-bounds"><path d="CEILING_OUTLINE"/></clipPath>
      <radialGradient id="spoken-reveal-falloff"><stop stop-color="#fff"/><stop offset=".70" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <mask id="spoken-room-reveal" x="-431" y="-324" width="1000" height="720" maskUnits="userSpaceOnUse" style="mask-type:alpha"><rect class="spoken-reveal-area" x="62.1" y="78" width=".001" height=".001" fill="url(#spoken-reveal-falloff)"/></mask>
      <filter id="spoken-room-diffuse" x="-12%" y="-16%" width="124%" height="132%"><feGaussianBlur stdDeviation="6.5"/></filter>
      <filter id="spoken-room-light" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation=".65"/></filter>
      <radialGradient id="spoken-atmosphere" cx=".36" cy=".44" r=".72"><stop stop-color="var(--book-ink)" stop-opacity=".18"/><stop offset=".55" stop-color="var(--book-ink)" stop-opacity=".065"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
      <radialGradient id="spoken-floor-light" cx=".6" cy=".3" r=".8"><stop stop-color="var(--book-ink)" stop-opacity=".045"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
    </defs><g class="spoken-room">
    <path d="FLOOR_OUTLINE" fill="url(#spoken-floor-light)"/>
    <g class="spoken-room-distant" opacity=".12">"##,
    );
    // No sharp fallback outline at time zero: the room starts genuinely diffuse.
    out.push_str(
        "</g><g class=\"spoken-room-soft\" filter=\"url(#spoken-room-diffuse)\" opacity=\".40\">",
    );
    out.push_str(&arch);
    out.push_str("</g><g class=\"spoken-haze\"><rect x=\"12\" y=\"7\" width=\"296\" height=\"180\" fill=\"url(#spoken-atmosphere)\"/>");
    for (i, (surface, u, v)) in HAZE_STRIPS.iter().enumerate().take(10) {
        let d = surface.rect(*u, *v, 0.027 + (i % 3) as f64 * 0.018, 0.16);
        let _ = write!(
            out,
            r#"<path d="{d}" fill="var(--book-ink)" opacity=".025"/>"#
        );
        path(
            &mut out,
            &surface.line(*u, *v, *u, v + 0.09),
            "ink",
            0.24,
            0.13,
        );
    }
    out.push_str("</g><g class=\"spoken-clear\" mask=\"url(#spoken-room-reveal)\">");
    out.push_str(&laboratory_rain_surfaces());
    out.push_str("<g filter=\"url(#spoken-room-light)\" opacity=\".40\">");
    out.push_str(&arch);
    out.push_str("</g>");
    out.push_str(&arch);
    out.push_str(&surface_details());
    out.push_str("</g></g>");
    out.replace("FLOOR_OUTLINE", &floor_outline())
        .replace("CEILING_OUTLINE", &ceiling_outline())
}
pub fn frame(_seconds: f64, clarity: f64, alpha: f64, _reduced: bool) -> Vec<Update> {
    let mut out = Vec::with_capacity(20);
    let mut set = |selector: String, attribute, value: f64| {
        out.push(Update {
            selector,
            attribute,
            value: format!("{value:.4}"),
        })
    };
    // Keep a faint room throughout reset; the figure never disappears.
    set(".spoken-room-soft".into(), "opacity", (1. - clarity) * 0.92);
    set(".spoken-room-distant".into(), "opacity", 0.);
    set(".spoken-haze".into(), "opacity", (1. - clarity).powf(1.3));
    set(
        ".spoken-clear".into(),
        "opacity",
        alpha * (0.64 + clarity * 0.36),
    );
    // The shared GPU renderer evaluates rectangular gradient masks analytically.
    // A soft radial fill gives a circular reveal without rerasterising a mask.
    // Three perceptibly different spatial reaches: around the speaker, across
    // the middle of the room, and finally the far doorway/ceiling. The radius
    // rests between utterances instead of exposing the whole room too early.
    let progress = (clarity.clamp(0., 1.) * 3.).min(3.);
    let stage = (progress.floor() as usize).min(2);
    let levels = [0., 98., 205., 440.];
    let radius = levels[stage] + (levels[stage + 1] - levels[stage]) * (progress - stage as f64);
    set(".spoken-reveal-area".into(), "x", 62.1 - radius);
    set(".spoken-reveal-area".into(), "y", 78. - radius * 0.72);
    set(
        ".spoken-reveal-area".into(),
        "width",
        (radius * 2.).max(0.001),
    );
    set(
        ".spoken-reveal-area".into(),
        "height",
        (radius * 1.44).max(0.001),
    );
    out.push(Update {
        selector: ".spoken-room".into(),
        attribute: "data-clarity",
        value: format!("{clarity:.4}"),
    });
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn walls_and_floor_share_one_corner() {
        assert_eq!(LEFT.at(1., 0.), CEILING.at(0., 0.));
        assert_eq!(RIGHT.at(0., 0.), CEILING.at(0., 0.));
        assert!(
            CEILING.at(0., 0.).1 < 59.,
            "ceiling remains above approved head"
        );
        assert_eq!(LEFT.at(1., 1.), RIGHT.at(0., 1.));
        assert_eq!(LEFT.at(1., 1.), FLOOR.at(0., 0.));
        assert!(RIGHT.at(0.59, 1.).1 < RIGHT.at(0.91, 1.).1);
    }
    #[test]
    fn rain_uv_preserves_surface_perspective() {
        for surface in [LEFT, RIGHT, FLOOR, CEILING] {
            let m = surface.rain_mapping();
            for (u, v) in [(0., 0.), (1., 0.), (1., 1.), (0., 1.), (0.31, 0.64)] {
                let (x, y) = surface.at(u, v);
                let q = m[6] * x + m[7] * y + m[8];
                assert!(((m[0] * x + m[1] * y + m[2]) / q - u).abs() < 1e-8);
                assert!(((m[3] * x + m[4] * y + m[5]) / q - v).abs() < 1e-8);
            }
        }
        assert_eq!(svg().matches("data-rust-matrix-uv").count(), 4);
        assert!(!svg().contains("spoken-code-"));
        assert_eq!(frame(0., 1., 1., true), frame(999., 1., 1., true));
    }
}
