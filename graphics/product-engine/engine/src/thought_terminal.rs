//! Fictional thought-terminal story. Vector geometry and pure 40-second clock.
//! Platform adapters only apply these attributes; hidden scenes suspend upstream.
//! ACCEPT/DECLINE and the unresponsive-program dialog are decorative story content,
//! never real controls, runtime failures, or application error state.
use crate::step_three::Update;
use std::f64::consts::TAU;
pub const PERIOD: f64 = 40.;
const DRIFT_PERIOD: f64 = 20.; // Preserve the approved first two phases exactly.
const EAT: &str = "НУЖНО ПОЕСТЬ";
const BILL: &str = "НУЖНО ОПЛАТИТЬ СЧЕТА";
const AVOID1: &str = "ЧЁРТ, НЕ ХОЧУ";
const AVOID2: &str = "ОБ ЭТОМ ДУМАТЬ";
const THIRD: [&str; 3] = ["ЧЁРТ, КАК ВСЁ ДОСТАЛО.", "У МЕНЯ НЕТ НИКАКОГО", "ВЫБОРА"];
#[derive(Debug, Clone, Copy, PartialEq)]
enum Phase {
    Input,
    Run,
    Second,
    Hesitate,
    Avoid,
    Delete,
    ThirdInput,
    Choose,
    Decline,
    Processing,
    Dialog,
    Rest,
}
#[derive(Debug, Clone, PartialEq)]
struct State {
    phase: Phase,
    eat: usize,
    bill: usize,
    avoid1: usize,
    avoid2: usize,
    run: f64,
    delete: f64,
    alpha: f64,
    cursor: bool,
    third: [usize; 3],
    third_alpha: f64,
    choices: f64,
    selected: f64,
    press: f64,
    pointer: f64,
    pointer_progress: f64,
    dialog: f64,
    processing: f64,
}
fn smooth(x: f64) -> f64 {
    let x = x.clamp(0., 1.);
    x * x * (3. - 2. * x)
}
fn count(text: &str, p: f64) -> usize {
    (text.chars().count() as f64 * p.clamp(0., 1.)).floor() as usize
}
fn state(t: f64) -> State {
    let mut s = State {
        phase: Phase::Rest,
        eat: 0,
        bill: 0,
        avoid1: 0,
        avoid2: 0,
        run: 0.,
        delete: 0.,
        alpha: 1.,
        cursor: false,
        third: [0; 3],
        third_alpha: 0.,
        choices: 0.,
        selected: 0.,
        press: 0.,
        pointer: 0.,
        pointer_progress: 0.,
        dialog: 0.,
        processing: 0.,
    };
    if t < 4. {
        s.phase = Phase::Input;
        s.eat = count(EAT, (t - 1.) / 2.3);
        s.cursor = true;
    } else if t < 7.2 {
        s.phase = Phase::Run;
        s.eat = count(EAT, 1.);
        s.run = smooth((t - 4.) / 0.4);
        s.alpha = 1. - smooth((t - 6.5) / 0.7);
    } else if t < 11. {
        s.phase = Phase::Second;
        s.bill = count(BILL, (t - 7.8) / 2.8);
        s.cursor = true;
    } else if t < 16.2 {
        s.phase = if t < 12. {
            Phase::Hesitate
        } else {
            Phase::Avoid
        };
        s.bill = count(BILL, 1.);
        s.avoid1 = count(AVOID1, (t - 12.) / 1.25);
        s.avoid2 = count(AVOID2, (t - 13.25) / 1.25);
        s.cursor = t < 12.;
        if t > 15.1 {
            s.delete = smooth((t - 15.1) / 0.4);
        }
    } else if t < 18.5 {
        s.phase = Phase::Delete;
        let p = 1. - smooth((t - 16.2) / 1.65);
        s.bill = count(BILL, p * 3.);
        s.avoid1 = count(AVOID1, p * 3. - 1.);
        s.avoid2 = count(AVOID2, p * 3. - 2.);
        s.delete = 1. - smooth((t - 17.9) / 0.6);
    } else if (20. ..39.).contains(&t) {
        s.phase = if t < 26.5 {
            Phase::ThirdInput
        } else if t < 29.5 {
            Phase::Choose
        } else if t < 30. {
            Phase::Decline
        } else if t < 31.45 {
            Phase::Processing
        } else {
            Phase::Dialog
        };
        s.third = [
            count(THIRD[0], (t - 20.5) / 2.2),
            count(THIRD[1], (t - 22.9) / 2.),
            count(THIRD[2], (t - 25.1) / 0.7),
        ];
        s.third_alpha = 1. - smooth((t - 37.5) / 1.1);
        s.choices = smooth((t - 26.5) / 0.5);
        s.pointer_progress = smooth((t - 28.2) / 1.1);
        s.pointer = smooth((t - 28.) / 0.3) * (1. - smooth((t - 30.) / 0.4));
        s.selected = smooth((t - 29.) / 0.3);
        s.press = smooth((t - 29.5) / 0.13) * (1. - smooth((t - 29.7) / 0.2));
        // Purely fictional processing beat: no I/O, network request, or UI blocking.
        s.processing = smooth((t - 30.) / 0.15) * (1. - smooth((t - 31.25) / 0.15));
        s.dialog = smooth((t - 31.45) / 0.5);
    }
    s
}
pub fn svg() -> &'static str {
    include_str!("../assets/thought-terminal.svg")
}
pub fn frame(seconds: f64, reduced: bool) -> Vec<Update> {
    let t = if reduced || !seconds.is_finite() {
        5.5
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    };
    let s = state(t);
    let mut out = Vec::with_capacity(36);
    let mut set = |selector: &str, attribute: &'static str, value: String| {
        out.push(Update {
            selector: selector.into(),
            attribute,
            value,
        })
    };
    set(
        ".terminal-stage",
        "transform",
        format!(
            "translate(0 {:.3})",
            if reduced {
                0.
            } else {
                (TAU * t / DRIFT_PERIOD).sin() * 0.55
            }
        ),
    );
    for (name, n, advance) in [
        ("eat", s.eat, 5.916),
        ("bill", s.bill, 5.916),
        ("avoid1", s.avoid1, 5.018),
        ("avoid2", s.avoid2, 5.018),
    ] {
        set(
            &format!(".terminal-{name}-reveal"),
            "width",
            format!("{:.3}", n as f64 * advance),
        );
    }
    set(".terminal-eat", "opacity", s.alpha.to_string());
    set(".terminal-run", "opacity", (s.run * s.alpha).to_string());
    set(".terminal-delete", "opacity", s.delete.to_string());
    let cursor = 44. + (s.eat + s.bill) as f64 * 5.916;
    set(".terminal-cursor", "d", format!("M{cursor:.3} 85h4"));
    set(
        ".terminal-cursor",
        "opacity",
        if s.cursor && (t * 2.2).fract() < 0.58 {
            "0.7"
        } else {
            "0"
        }
        .into(),
    );
    let run = (4.5..6.5).contains(&t) && !reduced;
    let p = ((t - 4.5) / 2.).clamp(0., 1.);
    set(
        ".terminal-sheen",
        "transform",
        format!("translate({:.3} 0)", 35. + p * 220.),
    );
    set(
        ".terminal-sheen",
        "opacity",
        if run { "1" } else { "0" }.into(),
    );
    set(
        ".terminal-response",
        "d",
        format!("M43 145H{:.3}", 43. + p * 199.),
    );
    set(
        ".terminal-response",
        "opacity",
        if run {
            ((1. - smooth((p - 0.7) / 0.3)) * 0.65).to_string()
        } else {
            "0".into()
        },
    );
    set(".terminal-hesitation", "d", format!("M44 87H{cursor:.3}"));
    set(
        ".terminal-hesitation",
        "opacity",
        if s.phase == Phase::Hesitate {
            (0.25 + 0.3 * ((t - 11.) * std::f64::consts::PI).sin()).to_string()
        } else {
            "0".into()
        },
    );
    for (index, n) in s.third.iter().enumerate() {
        set(
            &format!(".terminal-third{}-reveal", index + 1),
            "width",
            format!("{:.3}", *n as f64 * 5.916),
        );
    }
    set(".terminal-third", "opacity", s.third_alpha.to_string());
    set(".terminal-choices", "opacity", s.choices.to_string());
    set(
        ".terminal-choice-content",
        "opacity",
        (1. - s.dialog * 0.82).to_string(),
    );
    set(
        ".terminal-decline-highlight",
        "opacity",
        (s.selected * 0.14 + s.press * 0.16).to_string(),
    );
    set(
        ".terminal-decline-button",
        "transform",
        format!("translate(0 {:.3})", s.press * 0.75),
    );
    set(".terminal-pointer", "opacity", s.pointer.to_string());
    set(
        ".terminal-pointer",
        "transform",
        format!(
            "translate({:.3} {:.3}) scale({:.3})",
            243. - s.pointer_progress * 16.,
            104. + s.pointer_progress * 25.,
            1. - s.press * 0.13
        ),
    );
    let click = ((t - 29.55) / 0.6).clamp(0., 1.);
    set(
        ".terminal-click-ring",
        "r",
        format!("{:.3}", 1. + smooth(click) * 8.),
    );
    set(
        ".terminal-click-ring",
        "opacity",
        if (29.55..30.15).contains(&t) {
            ((1. - click) * 0.65).to_string()
        } else {
            "0".into()
        },
    );
    set(".terminal-processing", "opacity", s.processing.to_string());
    for i in 0..3 {
        let glow = 0.22 + 0.3 * (1. + (TAU * (t - 30.) / 0.8 - i as f64 * 0.9).sin());
        set(
            &format!(".terminal-processing-dot{i}"),
            "opacity",
            glow.to_string(),
        );
    }
    set(".terminal-dialog", "opacity", s.dialog.to_string());
    set(
        ".terminal-dialog",
        "transform",
        format!("translate(0 {:.3})", (1. - s.dialog) * 2.),
    );
    let line = if t < 22.9 {
        0
    } else if t < 25.1 {
        1
    } else {
        2
    };
    set(
        ".terminal-third-cursor",
        "d",
        format!(
            "M{:.3} {}h4",
            44. + s.third[line] as f64 * 5.916,
            83 + line * 13
        ),
    );
    set(
        ".terminal-third-cursor",
        "opacity",
        if s.phase == Phase::ThirdInput && (t * 2.2).fract() < 0.58 {
            "0.7"
        } else {
            "0"
        }
        .into(),
    );
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn approved_story_is_readable_before_actions_and_erases_in_reverse_order() {
        assert_eq!(state(3.8).eat, EAT.chars().count());
        assert_eq!(state(5.).phase, Phase::Run);
        assert_eq!(state(11.5).bill, BILL.chars().count());
        assert_eq!(state(11.5).phase, Phase::Hesitate);
        assert_eq!(state(15.).avoid2, AVOID2.chars().count());
        assert_eq!(state(15.).delete, 0.);
        assert!(state(17.).bill > 0);
        assert_eq!(state(17.8).avoid1, 0);
        assert_eq!(state(18.4).bill, 0);
        assert_eq!(state(19.).phase, Phase::Rest);
    }
    #[test]
    fn loop_reduced_and_invalid_times_are_stable() {
        assert_eq!(frame(0., false), frame(PERIOD, false));
        assert_eq!(frame(-1., false), frame(0., false));
        assert_eq!(frame(0., true), frame(99999., true));
        assert_eq!(frame(f64::NAN, false), frame(5.5, false));
        for i in 0..2400 {
            for u in frame(i as f64 / 60., false) {
                assert!(!u.value.contains("NaN"));
                if u.attribute == "opacity" {
                    assert!((0. ..=1.).contains(&u.value.parse::<f64>().unwrap()));
                }
            }
        }
    }
    #[test]
    fn third_thought_has_readable_dwell_before_decline_and_dialog() {
        assert_eq!(state(19.9).phase, Phase::Rest);
        assert_eq!(state(20.5).third, [0; 3]);
        assert_eq!(state(26.).third, THIRD.map(|s| s.chars().count()));
        assert_eq!(state(26.).choices, 0.);
        assert_eq!(state(27.5).choices, 1.);
        assert_eq!(state(27.5).pointer, 0.);
        assert_eq!(state(29.4).selected, 1.);
        assert_eq!(state(29.4).press, 0.);
        assert_eq!(state(29.65).phase, Phase::Decline);
        assert_eq!(state(29.65).press, 1.);
        assert_eq!(state(29.9).processing, 0.);
        assert_eq!(state(30.7).phase, Phase::Processing);
        assert_eq!(state(30.7).processing, 1.);
        assert_eq!(state(30.7).press, 0.);
        for t in [30., 30.7, 31.4] {
            assert_eq!(state(t).dialog, 0.);
        }
        assert_eq!(state(31.45).processing, 0.);
        for t in [32., 34., 37.5] {
            assert_eq!(state(t).dialog, 1.);
            assert_eq!(state(t).third_alpha, 1.);
            assert_eq!(state(t).pointer, 0.);
        }
        assert!(state(38.).third_alpha > 0. && state(38.).third_alpha < 1.);
        assert_eq!(state(38.9).third_alpha, 0.);
        assert_eq!(state(39.5).phase, Phase::Rest);
    }
    #[test]
    fn art_is_vector_and_uses_existing_palette() {
        let document = roxmltree::Document::parse(svg()).unwrap();
        assert!(!svg().contains("<image"));
        assert!(!svg().contains("#F5DD07"));
        for u in frame(15.5, false) {
            let class = u.selector.trim_start_matches('.');
            assert!(
                document
                    .descendants()
                    .any(|n| n.attribute("class") == Some(class)),
                "{}",
                u.selector
            );
        }
    }
}
