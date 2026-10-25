//! Small standalone WASM adapter: Rust owns easing, interruption and layout.
//! Build with rustc --crate-type cdylib --target wasm32-unknown-unknown.
use std::{cell::RefCell, fmt::Write};
const HEIGHTS: [f64; 3] = [290., 392., 562.];
#[derive(Clone, Copy, Default)]
struct Tween {
    from: f64,
    to: f64,
    start: f64,
}
impl Tween {
    fn value(self, now: f64) -> f64 {
        let p = ((now - self.start) / 480.).clamp(0., 1.);
        self.from + (self.to - self.from) * (p * p * p * (p * (p * 6. - 15.) + 10.))
    }
}
#[derive(Default)]
struct Motion {
    tracks: [Tween; 3],
    target: i32,
    output: String,
}
thread_local! { static STATE: RefCell<Motion> = RefCell::new(Motion::default()); }
fn frame(state: &mut Motion, now: f64, target: i32, reduced: bool, width: f64) {
    if target != state.target {
        for (i, t) in state.tracks.iter_mut().enumerate() {
            *t = Tween {
                from: t.value(now),
                to: if target == i as i32 + 1 { 1. } else { 0. },
                start: now,
            };
        }
        state.target = target;
    }
    let values = state
        .tracks
        .map(|t| if reduced { t.to } else { t.value(now) });
    let width = width.clamp(280., 600.);
    let mut y = 80.;
    let mut updates = Vec::new();
    let mut set = |s: String, a: &str, v: String| updates.push(format!(r#"["{s}","{a}","{v}"]"#));
    for i in 1..=7 {
        set(
            format!("#row-{i}"),
            "transform",
            format!("translate(0 {y:0.3})"),
        );
        set(
            format!("#controls-{i}"),
            "transform",
            format!("translate({:.3} 0)", width - 360.),
        );
        set(
            format!(".right-hit-{i}"),
            "transform",
            format!("translate({:.3} 0)", width - 360.),
        );
        set(format!("#enter-{i}"), "width", format!("{}", width - 64.));
        y += 47.;
        if i <= 3 {
            let v = values[i - 1];
            set(
                format!("#sections-{i}"),
                "transform",
                format!("translate(0 {y:0.3})"),
            );
            set(
                format!("#clip-{i}"),
                "height",
                format!("{:0.3}", HEIGHTS[i - 1] * v),
            );
            set(
                format!("#list-{i}"),
                "opacity",
                format!("{:0.3}", ((v - 0.08) / 0.92).clamp(0., 1.)),
            );
            set(
                format!("#list-{i}"),
                "transform",
                format!("translate(0 {:0.3})", -8. * (1. - v)),
            );
            set(
                format!("#list-{i}"),
                "visibility",
                if v > 0.001 { "visible" } else { "hidden" }.into(),
            );
            set(
                format!("#icon-bg-{i}"),
                "opacity",
                format!("{:0.3}", 0.025 + 0.065 * v),
            );
            y += HEIGHTS[i - 1] * v;
        }
    }
    y += 12.;
    set(
        "#menu-foot".into(),
        "transform",
        format!("translate(0 {y:0.3})"),
    );
    let height = y + 24.;
    set(
        "#active-row".into(),
        "d",
        format!("M1 -25H{}V18H1Z", width - 1.),
    );
    // Fixed upper notch/corner anchors; only the lower straight edge moves.
    set("#menu-frame".into(), "d", format!("M.25 .25H{r}V59.5L{cut} 25.25H{a}L{b} 37.25H{c}L{d} 25.25H.25ZM.25 33.75H{d}L{c} 45.75H{b}L{a} 33.75H{cut}L{r} 65.75V{bottom}H.25Z",r=width-0.25,cut=width-29.,a=width-76.,b=width-88.,c=width-124.,d=width-136.,bottom=height-0.25));
    let running = !reduced
        && state
            .tracks
            .iter()
            .any(|t| now - t.start < 480. && t.from != t.to);
    state.output.clear();
    write!(
        state.output,
        r#"{{"height":{height:0.3},"width":{width:0.3},"running":{running},"updates":[{}]}}"#,
        updates.join(",")
    )
    .unwrap();
}
#[no_mangle]
pub extern "C" fn menu_frame(now: f64, target: i32, reduced: i32, width: f64) -> *const u8 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        frame(&mut s, now, target.clamp(0, 3), reduced != 0, width);
        s.output.as_ptr()
    })
}
#[no_mangle]
pub extern "C" fn menu_len() -> usize {
    STATE.with(|s| s.borrow().output.len())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reverse_is_continuous() {
        let mut s = Motion::default();
        frame(&mut s, 100., 3, false, 360.);
        let v = s.tracks[2].value(290.);
        frame(&mut s, 290., 0, false, 360.);
        assert_eq!(v, s.tracks[2].value(290.));
        frame(&mut s, 800., 0, false, 360.);
        assert!(s.output.contains("\"height\":445.000"));
    }
    #[test]
    fn reduced_is_immediate() {
        let mut s = Motion::default();
        frame(&mut s, 0., 3, true, 360.);
        assert!(s.output.contains("\"height\":1007.000"));
        assert!(s.output.contains("\"running\":false"));
    }
}

#[allow(dead_code)]
fn main() {}
