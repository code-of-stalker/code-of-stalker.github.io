//! Local editor preview uses the same scene assembly and frame calculation as the app.
use std::fmt::Write;
use watcher_graphics::step_two_tasks;

fn quoted(value: &str) -> String {
    let mut out = String::from("\"");
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            ch if ch.is_control() => {
                let _ = write!(out, "\\u{:04x}", ch as u32);
            }
            ch => out.push(ch),
        }
    }
    out.push('"');
    out
}

fn main() {
    let kind = std::env::args().nth(1).expect("scene kind required");
    let svg = step_two_tasks::svg(&kind).expect("unknown scene kind");
    let duration = match kind.as_str() {
        "author-intention" => 34,
        "life-book" => 27,
        "body-senses" => 12,
        _ => 8,
    };
    let fps = 20;
    let mut output = format!("{{\"svg\":{},\"fps\":{fps},\"frames\":[", quoted(&svg));
    for frame in 0..duration * fps {
        if frame > 0 {
            output.push(',');
        }
        output.push('[');
        for (index, update) in step_two_tasks::frame(&kind, frame as f64 / fps as f64, false)
            .iter()
            .enumerate()
        {
            if index > 0 {
                output.push(',');
            }
            let _ = write!(
                output,
                "{{\"selector\":{},\"attribute\":{},\"value\":{}}}",
                quoted(&update.selector),
                quoted(update.attribute),
                quoted(&update.value)
            );
        }
        output.push(']');
    }
    output.push_str("]}");
    println!("{output}");
}
