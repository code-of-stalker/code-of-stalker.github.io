//! Six small studies of sound: a mechanism, separation, resonance, breath,
//! unfolding and listening. Pure geometry/clock; no platform animation logic.
use std::f64::consts::{PI, TAU};
use std::fmt::Write;

pub const KINDS: [&str; 6] = [
    "thought-loop",
    "spoken-thought",
    "voice-origin",
    "breath-axis",
    "voice-unseal",
    "voice-witness",
];
pub const PERIOD: f64 = 12.;
#[derive(Clone, Copy)]
enum Scene {
    Thought,
    Spoken,
    Origin,
    Axis,
    Unseal,
    Witness,
}
impl Scene {
    fn parse(kind: &str) -> Option<Self> {
        Some(match kind {
            "thought-loop" => Self::Thought,
            "spoken-thought" => Self::Spoken,
            "voice-origin" => Self::Origin,
            "breath-axis" => Self::Axis,
            "voice-unseal" => Self::Unseal,
            "voice-witness" => Self::Witness,
            _ => return None,
        })
    }
}
pub fn contains(kind: &str) -> bool {
    Scene::parse(kind).is_some() || crate::voice_practice::contains(kind)
}
#[derive(Debug, Clone, PartialEq)]
pub struct Update {
    pub selector: String,
    pub attribute: &'static str,
    pub value: String,
}
fn set(
    out: &mut Vec<Update>,
    selector: impl Into<String>,
    attribute: &'static str,
    value: impl ToString,
) {
    out.push(Update {
        selector: selector.into(),
        attribute,
        value: value.to_string(),
    });
}
fn smooth(x: f64) -> f64 {
    let v = x.clamp(0., 1.);
    v * v * (3. - 2. * v)
}
fn envelope(t: f64, start: f64, end: f64) -> f64 {
    smooth((t - start) / 1.25) * (1. - smooth((t - end) / 1.75))
}
fn line(out: &mut String, d: &str, ink: &str, width: f64, opacity: f64, class: &str) {
    let _ = write!(
        out,
        r#"<path class="{class}" d="{d}" fill="none" stroke="var(--book-{ink})" stroke-width="{width}" opacity="{opacity}" stroke-linecap="round" stroke-linejoin="round"/>"#
    );
}
fn poly(points: &[(f64, f64)]) -> String {
    let mut d = String::new();
    for (i, (x, y)) in points.iter().enumerate() {
        let _ = write!(d, "{}{x:.3} {y:.3}", if i == 0 { "M" } else { "L" });
    }
    d.push('Z');
    d
}
fn wave(x: f64, width: f64, y: f64, amplitude: f64, phase: f64, cycles: f64) -> String {
    let mut d = String::new();
    for i in 0..=80 {
        let u = i as f64 / 80.;
        let yy = y + (PI * u).sin().powi(2) * (u * TAU * cycles - phase).sin() * amplitude;
        let _ = write!(
            d,
            "{}{:.3} {yy:.3}",
            if i == 0 { "M" } else { "L" },
            x + width * u
        );
    }
    d
}
fn ground(out: &mut String, cx: f64, rx: f64) {
    let _ = write!(
        out,
        r##"<ellipse cx="{cx}" cy="170" rx="{rx}" ry="10" fill="url(#v-ground)"/>"##
    );
}
fn foot(out: &mut String, x: f64, y: f64, w: f64) {
    let _ = write!(
        out,
        r#"<path d="M{} {y}L{x} {}L{} {y}V{}L{x} {}L{} {}Z" fill="var(--book-cover)" stroke="var(--book-dim)" stroke-width=".4"/>"#,
        x - w,
        y - 5.,
        x + w,
        y + 4.,
        y + 9.,
        x - w,
        y + 4.
    );
    line(
        out,
        &format!(
            "M{} {y}L{x} {}L{} {y}M{x} {}V{}",
            x - w,
            y + 5.,
            x + w,
            y + 5.,
            y + 9.
        ),
        "line",
        0.35,
        0.6,
        "",
    );
}
pub fn svg(kind: &str) -> Option<String> {
    if let Some(svg) = crate::voice_practice::svg(kind) { return Some(svg); }
    if kind == "voice-witness" { return Some(crate::voice_witness::svg()); }
    if kind == "voice-unseal" { return Some(crate::voice_unseal::svg()); }
    if kind == "breath-axis" { return Some(crate::breath_axis::svg()); }
    if kind == "voice-origin" {
        return Some(crate::jugular_notch::svg());
    }
    if kind == "spoken-thought" {
        return Some(crate::spoken_thought::svg());
    }
    if kind == "thought-loop" {
        return Some(crate::thought_terminal::svg().into());
    }
    let scene = Scene::parse(kind)?;
    let mut out = String::from(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 192" fill="none"><defs>
      <linearGradient id="v-metal" x2=".25" y2="1"><stop stop-color="var(--book-edge)"/><stop offset=".48" stop-color="var(--book-cover)"/><stop offset="1" stop-color="var(--book-paper)"/></linearGradient>
      <linearGradient id="v-surface" x2="1" y2=".5"><stop stop-color="var(--book-ink)" stop-opacity=".02"/><stop offset=".5" stop-color="var(--book-light)" stop-opacity=".16"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity=".025"/></linearGradient>
      <radialGradient id="v-ground"><stop stop-color="var(--book-ink)" stop-opacity=".13"/><stop offset=".7" stop-color="var(--book-ink)" stop-opacity=".03"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
      <radialGradient id="v-halo"><stop stop-color="var(--book-light)" stop-opacity=".65"/><stop offset=".2" stop-color="var(--book-ink)" stop-opacity=".15"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
      </defs><g stroke-linejoin="round" stroke-linecap="round">"##,
    );
    ground(&mut out, 160., 126.);
    match scene {
        Scene::Thought => {
            // A precision belt seen in perspective. The moving light follows
            // the actual closed track; the solid engraved metal stays put.
            out.push_str(r##"<path d="M45 103C45 77 96 56 160 56S275 77 275 103V112C275 139 224 159 160 159S45 139 45 112Z" fill="var(--book-cover)" stroke="var(--book-dim)" stroke-width=".5"/>
              <path d="M45 103C45 77 96 56 160 56S275 77 275 103S224 150 160 150S45 129 45 103ZM68 103C68 122 109 137 160 137S252 122 252 103S211 69 160 69S68 84 68 103Z" fill="url(#v-metal)" fill-rule="evenodd" stroke="var(--book-ink)" stroke-width=".55"/>
              <ellipse cx="160" cy="103" rx="107" ry="43" stroke="var(--book-line)" stroke-width=".3"/>
              <ellipse cx="160" cy="103" rx="99" ry="37" stroke="var(--book-dim)" stroke-width=".3"/>
              <path d="M68 103C68 84 109 69 160 69S252 84 252 103V109C246 89 205 76 160 76S75 89 68 109Z" fill="var(--book-paper)" stroke="var(--book-dim)" stroke-width=".3"/>
              <ellipse class="v-track" cx="160" cy="103" rx="107" ry="43" pathLength="100" stroke="var(--book-light)" stroke-width=".8" stroke-dasharray="8 92"/>
              <path d="M113 95L160 78L207 95L160 112Z" fill="url(#v-metal)" stroke="var(--book-line)" stroke-width=".4"/>
              <path d="M113 95V103L160 120L207 103V95M160 112V120" stroke="var(--book-dim)" stroke-width=".4"/>"##);
            for i in 0..48 {
                let a = i as f64 * TAU / 48.;
                line(
                    &mut out,
                    &format!(
                        "M{:.3} {:.3}L{:.3} {:.3}",
                        160. + 102. * a.cos(),
                        103. + 39. * a.sin(),
                        160. + 112. * a.cos(),
                        103. + 46. * a.sin()
                    ),
                    "line",
                    0.4,
                    0.4,
                    &format!("v-tooth-{i}"),
                );
            }
            for i in 0..7 {
                let y = 91. + i as f64 * 2.;
                line(
                    &mut out,
                    &format!("M{} {y}l28 10", 135. + i as f64 * 3.),
                    "ink",
                    0.45,
                    0.4,
                    &format!("v-memory-{i}"),
                );
            }
        }
        Scene::Spoken => {
            foot(&mut out, 77., 158., 36.);
            out.push_str(r##"<path d="M45 54L91 37L112 46V143L66 160L45 151Z" fill="url(#v-metal)" stroke="var(--book-line)" stroke-width=".55"/>
              <path d="M45 54L66 63L112 46M66 63V160" stroke="var(--book-ink)" stroke-width=".45"/>
              <path d="M74 67L104 56V133L74 144Z" fill="var(--book-cover)" stroke="var(--book-dim)" stroke-width=".4"/>
              <path d="M79 74L99 67V124L79 132Z" fill="url(#v-surface)" stroke="var(--book-dim)" stroke-width=".3"/>
              <circle class="v-source" cx="90" cy="99" r="12" fill="url(#v-halo)"/>
              <circle cx="90" cy="99" r="1" fill="var(--book-light)"/>
              <path d="M111 99H281" stroke="var(--book-dim)" stroke-width=".3" stroke-dasharray="1 5"/>"##);
            for i in 0..3 {
                line(
                    &mut out,
                    &wave(115., 168., 99., 19. + i as f64 * 3., i as f64 * 0.3, 3.),
                    if i == 1 { "light" } else { "ink" },
                    if i == 1 { 0.8 } else { 0.3 },
                    0.7,
                    &format!("v-spoken-{i}"),
                );
            }
            for i in 0..5 {
                line(
                    &mut out,
                    &format!("M49 {}l12 5", 74 + i * 12),
                    "line",
                    0.35,
                    0.5,
                    "",
                );
            }
        }
        Scene::Origin => {
            // A cropped collarbone study: the light sits at the suprasternal
            // notch, never at the eye or at an invented point inside the head.
            out.push_str(r##"<path d="M123 22C127 41 127 60 122 76C115 88 88 94 72 105C57 119 54 142 51 173H269C266 142 263 119 248 105C232 94 205 88 198 76C193 60 193 41 197 22" fill="url(#v-metal)" stroke="var(--book-line)" stroke-width=".7"/>
              <path d="M123 22Q160 33 197 22M130 32Q160 39 190 32" stroke="var(--book-dim)" stroke-width=".35"/>
              <path d="M129 43C132 64 139 82 153 99M191 43C188 64 181 82 167 99M91 107C112 99 132 101 153 105Q160 114 167 105C188 101 208 99 229 107" stroke="var(--book-ink)" stroke-width=".65"/>
              <path d="M154 119Q160 126 166 119M160 128V165M75 120Q83 149 80 169M245 120Q237 149 240 169" stroke="var(--book-dim)" stroke-width=".35"/>
              <path class="v-breath-line" d="M160 164C143 145 173 128 160 106" stroke="var(--book-line)" stroke-width=".65" stroke-dasharray="8 65"/>
              <circle class="v-source" cx="160" cy="105" r="23" fill="url(#v-halo)"/>
              <circle cx="160" cy="105" r="1.4" fill="var(--book-light)"/>
              <path d="M156 105H164M160 101V109" stroke="var(--book-light)" stroke-width=".35"/>"##);
            for i in 0..3 {
                let _ = write!(
                    out,
                    r#"<ellipse class="v-resonance-{i}" cx="160" cy="105" rx="25" ry="7" stroke="var(--book-ink)" stroke-width=".4"/>"#
                );
            }
        }
        Scene::Axis => {
            line(
                &mut out,
                "M33 112C70 176 252 176 287 112",
                "dim",
                0.5,
                0.7,
                "",
            );
            line(
                &mut out,
                "M33 112C70 176 252 176 287 112",
                "light",
                0.7,
                0.7,
                "v-return",
            );
            for i in 0..6 {
                let x = 40. + i as f64 * 48.;
                foot(&mut out, x, 143., 17.);
                let _ = write!(
                    out,
                    r##"<g class="v-gate-{i}"><path d="M{} 134V66Q{x} 48 {} 66V134L{} 137V68Q{x} 57 {} 68V137Z" fill="url(#v-metal)" stroke="var(--book-line)" stroke-width=".5"/>
                  <path d="M{} 134V69Q{x} 61 {} 69V134" stroke="var(--book-ink)" stroke-width=".35"/>
                  <circle class="v-node-{i}" cx="{x}" cy="101" r="12" fill="url(#v-halo)"/>
                  <circle cx="{x}" cy="101" r=".8" fill="var(--book-light)"/></g>"##,
                    x - 8.,
                    x + 8.,
                    x + 4.,
                    x - 4.,
                    x - 6.,
                    x + 6.
                );
                for j in 0..=i {
                    line(
                        &mut out,
                        &format!("M{} 153v2", x - 2.5 * i as f64 + j as f64 * 5.),
                        "line",
                        0.4,
                        0.4,
                        "",
                    );
                }
            }
            line(
                &mut out,
                &wave(22., 276., 101., 12., 0., 5.),
                "ink",
                0.8,
                0.8,
                "v-axis",
            );
            line(
                &mut out,
                &wave(22., 276., 101., 14., 0.3, 5.),
                "light",
                0.3,
                0.5,
                "v-axis-fine",
            );
        }
        Scene::Unseal => {
            out.push_str(r##"<path d="M70 140L160 169L250 140L160 113Z" fill="var(--book-cover)" stroke="var(--book-dim)" stroke-width=".4"/>
              <path d="M70 140V145L160 174L250 145V140M160 169V174" stroke="var(--book-dim)" stroke-width=".4"/>
              <path d="M99 140L160 159L221 140L160 122Z" fill="url(#v-surface)" stroke="var(--book-line)" stroke-width=".3"/>
              <ellipse class="v-source" cx="160" cy="132" rx="46" ry="14" fill="url(#v-halo)"/>"##);
            // Individually hinged, thick opaque leaves; each is projected in
            // actual 3D, so the opening never stretches the authored frame.
            for i in 0..6 {
                let _ = write!(
                    out,
                    r##"<g class="v-leaf-{i}"><path class="v-leaf-side" fill="var(--book-edge)" stroke="var(--book-dim)" stroke-width=".4"/><path class="v-leaf-face" fill="url(#v-metal)" stroke="var(--book-ink)" stroke-width=".55"/><path class="v-leaf-engraving" fill="none" stroke="var(--book-line)" stroke-width=".3"/></g>"##
                );
            }
            for i in 0..3 {
                line(
                    &mut out,
                    "M100 70H220",
                    if i == 1 { "light" } else { "ink" },
                    if i == 1 { 0.75 } else { 0.35 },
                    0.,
                    &format!("v-unsealed-{i}"),
                );
            }
        }
        Scene::Witness => {
            foot(&mut out, 75., 153., 30.);
            out.push_str(r##"<path d="M62 148V55L75 49L88 55V148L75 154Z" fill="url(#v-metal)" stroke="var(--book-line)" stroke-width=".55"/>
              <path d="M62 55L75 61L88 55M75 61V154" stroke="var(--book-ink)" stroke-width=".4"/>
              <path d="M67 67V141M83 67V141" stroke="var(--book-dim)" stroke-width=".3"/>
              <circle class="v-source" cx="75" cy="95" r="17" fill="url(#v-halo)"/>
              <circle cx="75" cy="95" r="1.2" fill="var(--book-light)"/>
              <path class="v-tether" d="M89 95H180" stroke="var(--book-line)" stroke-width=".45"/>
              <path d="M94 121Q158 169 250 121" stroke="var(--book-dim)" stroke-width=".35"/>
              <path class="v-listen" d="M94 121Q158 169 250 121" pathLength="100" stroke="var(--book-light)" stroke-width=".65" stroke-dasharray="8 92"/>"##);
            out.push_str(r#"<g class="v-independent">"#);
            for i in 0..5 {
                line(
                    &mut out,
                    &wave(145., 130., 89., 25., i as f64 * 0.18, 2.5),
                    if i == 2 { "light" } else { "ink" },
                    if i == 2 { 0.75 } else { 0.3 },
                    if i == 2 { 0.85 } else { 0.25 },
                    &format!("v-independent-{i}"),
                );
            }
            out.push_str("</g>");
        }
    }
    out.push_str("</g></svg>");
    Some(out)
}

/// The same frame model drives the web GPU and the embedded native renderer.
pub fn frame(kind: &str, seconds: f64, reduced: bool) -> Vec<Update> {
    if crate::voice_practice::contains(kind) { return crate::voice_practice::frame(kind, seconds, reduced); }
    if kind == "voice-witness" { return crate::voice_witness::frame(seconds, reduced); }
    if kind == "voice-unseal" { return crate::voice_unseal::frame(seconds, reduced); }
    if kind == "breath-axis" { return crate::breath_axis::frame(seconds, reduced); }
    if kind == "voice-origin" {
        return crate::jugular_notch::frame(seconds, reduced);
    }
    if kind == "spoken-thought" {
        return crate::spoken_thought::frame(seconds, reduced);
    }
    if kind == "thought-loop" {
        return crate::thought_terminal::frame(seconds, reduced);
    }
    let Some(scene) = Scene::parse(kind) else {
        return Vec::new();
    };
    let t = if reduced || !seconds.is_finite() {
        4.5
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    };
    let phase = t / PERIOD * TAU;
    let breath = 0.5 - 0.5 * phase.cos();
    let mut out = Vec::with_capacity(64);
    set(&mut out, ".v-source", "opacity", 0.55 + 0.4 * breath);
    match scene {
        Scene::Thought => {
            set(
                &mut out,
                ".v-track",
                "stroke-dashoffset",
                -t / PERIOD * 100.,
            );
            for i in 0..48 {
                let a = i as f64 * TAU / 48.;
                let light = (0.5 + 0.5 * (a - phase).cos()).powi(12);
                set(
                    &mut out,
                    format!(".v-tooth-{i}"),
                    "opacity",
                    0.22 + light * 0.7,
                );
            }
            for i in 0..7 {
                set(
                    &mut out,
                    format!(".v-memory-{i}"),
                    "opacity",
                    0.22 + 0.55 * (0.5 + 0.5 * (phase * 2. - i as f64 * 0.5).sin()),
                );
            }
        }
        Scene::Spoken => {
            for i in 0..3 {
                let amp = (0.55 + 0.45 * breath) * (17. + i as f64 * 3.);
                set(
                    &mut out,
                    format!(".v-spoken-{i}"),
                    "d",
                    wave(115., 168., 99., amp, phase * 2. + i as f64 * 0.25, 3.),
                );
                set(
                    &mut out,
                    format!(".v-spoken-{i}"),
                    "opacity",
                    if i == 1 {
                        0.7 + 0.25 * breath
                    } else {
                        0.15 + 0.12 * breath
                    },
                );
            }
        }
        Scene::Origin => {
            set(
                &mut out,
                ".v-breath-line",
                "stroke-dashoffset",
                -t / PERIOD * 73.,
            );
            for i in 0..3 {
                let u = (t / PERIOD + i as f64 / 3.).fract();
                set(&mut out, format!(".v-resonance-{i}"), "rx", 9. + 94. * u);
                set(&mut out, format!(".v-resonance-{i}"), "ry", 2. + 24. * u);
                set(
                    &mut out,
                    format!(".v-resonance-{i}"),
                    "opacity",
                    (PI * u).sin().powi(2) * 0.45,
                );
            }
        }
        Scene::Axis => {
            for i in 0..6 {
                let a = phase - i as f64 * TAU / 6.;
                let pulse = (0.5 + 0.5 * a.cos()).powi(6);
                set(
                    &mut out,
                    format!(".v-node-{i}"),
                    "opacity",
                    0.12 + 0.88 * pulse,
                );
            }
            set(
                &mut out,
                ".v-axis",
                "d",
                wave(22., 276., 101., 8. + 5. * breath, phase * 2., 5.),
            );
            set(
                &mut out,
                ".v-axis-fine",
                "d",
                wave(22., 276., 101., 11. + 5. * breath, phase * 2. + 0.3, 5.),
            );
            set(&mut out, ".v-return", "stroke-dasharray", "7 193");
            set(
                &mut out,
                ".v-return",
                "stroke-dashoffset",
                t / PERIOD * 200.,
            );
        }
        Scene::Unseal => {
            let opened = envelope(t, 0.5, 7.);
            // Perspective projection with all six leaves hinged at their bases.
            // Far leaves are authored first; front leaves naturally occlude.
            for i in 0..6 {
                let x = -43. + i as f64 * 17.2;
                let angle = (i as f64 - 2.5) * 0.11 + opened * (i as f64 - 2.5) * 0.35;
                let project = |u: f64, v: f64, depth: f64| {
                    let xx = x + u * angle.cos() - v * angle.sin();
                    let yy = u * angle.sin() + v * angle.cos();
                    (160. + xx, 132. + yy * 0.24 - depth)
                };
                let face = [
                    project(-7., 0., 0.),
                    project(-7., -18., 63.),
                    project(7., -18., 63.),
                    project(7., 0., 0.),
                ];
                let side = [
                    face[2],
                    project(7., -15., 63.),
                    project(7., 3., 0.),
                    face[3],
                ];
                set(
                    &mut out,
                    format!(".v-leaf-{i} .v-leaf-face"),
                    "d",
                    poly(&face),
                );
                set(
                    &mut out,
                    format!(".v-leaf-{i} .v-leaf-side"),
                    "d",
                    poly(&side),
                );
                let mut engraving = String::new();
                for j in 0..6 {
                    let h = 12. + j as f64 * 8.;
                    let a = project(-4., -18. * h / 63., h);
                    let b = project(4., -18. * h / 63., h);
                    let _ = write!(engraving, "M{:.3} {:.3}L{:.3} {:.3}", a.0, a.1, b.0, b.1);
                }
                set(
                    &mut out,
                    format!(".v-leaf-{i} .v-leaf-engraving"),
                    "d",
                    engraving,
                );
            }
            for i in 0..3 {
                set(
                    &mut out,
                    format!(".v-unsealed-{i}"),
                    "d",
                    wave(
                        78.,
                        164.,
                        53. - opened * 11.,
                        7. + opened * 6. + i as f64 * 2.,
                        phase * 2. + i as f64 * 0.2,
                        3.,
                    ),
                );
                set(
                    &mut out,
                    format!(".v-unsealed-{i}"),
                    "opacity",
                    opened * if i == 1 { 0.9 } else { 0.25 },
                );
            }
        }
        Scene::Witness => {
            let separated = envelope(t, 0.25, 7.5);
            set(
                &mut out,
                ".v-independent",
                "transform",
                format!("translate({:.3} 0)", separated * 19.),
            );
            set(&mut out, ".v-tether", "opacity", 0.6 * (1. - separated));
            set(
                &mut out,
                ".v-listen",
                "stroke-dashoffset",
                t / PERIOD * 100.,
            );
            set(&mut out, ".v-listen", "opacity", separated * 0.7);
            for i in 0..5 {
                set(
                    &mut out,
                    format!(".v-independent-{i}"),
                    "d",
                    wave(
                        145.,
                        130.,
                        89.,
                        19. + i as f64 * 2.,
                        phase * 2. + i as f64 * 0.18,
                        2.5,
                    ),
                );
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn complete_scenes_have_finite_frames_and_continuous_loops() {
        for kind in KINDS {
            let xml = svg(kind).unwrap();
            roxmltree::Document::parse(&xml).unwrap();
            assert_eq!(
                frame(kind, 0., false),
                frame(
                    kind,
                    if kind == "thought-loop" {
                        crate::thought_terminal::PERIOD
                    } else if kind == "spoken-thought" {
                        crate::spoken_thought::PERIOD
                    } else if kind == "breath-axis" {
                        crate::breath_axis::PERIOD
                    } else if kind == "voice-unseal" {
                        crate::voice_unseal::PERIOD
                    } else if kind == "voice-witness" {
                        crate::voice_witness::PERIOD
                    } else if kind == "voice-origin" {
                        crate::jugular_notch::PERIOD
                    } else {
                        PERIOD
                    },
                    false
                ),
                "{kind}"
            );
            assert_eq!(frame(kind, 0., true), frame(kind, 1000., true), "{kind}");
            for sample in 0..=120 {
                for update in frame(kind, sample as f64 / 10., false) {
                    assert!(
                        !update.value.contains("NaN") && !update.value.contains("inf"),
                        "{kind}: {update:?}"
                    );
                    if update.attribute == "opacity" {
                        assert!((0. ..=1.).contains(&update.value.parse::<f64>().unwrap()));
                    }
                }
            }
        }
    }
    #[test]
    fn unsupported_scene_does_not_fall_back_to_an_unrelated_illustration() {
        assert!(svg("missing").is_none());
        assert!(frame("missing", 1., false).is_empty());
    }
}
