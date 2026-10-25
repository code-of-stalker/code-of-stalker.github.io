//! Standalone menu studies. Rust owns lettering, contours and hit rectangles.
use std::{fmt::Write, fs, path::PathBuf};
mod font {
    include!(concat!(env!("OUT_DIR"), "/spoken_glyphs.rs"));
}
const NAMES: [&str; 7] = [
    "ОЩУТИ СЕБЯ",
    "ГЛАВНЫЙ ГЕРОЙ",
    "ГОЛОС КАК МОСТ",
    "ЗАЗЕМЛЕНИЕ",
    "ВНЕШНЕЕ КОЛЬЦО",
    "ВНУТРЕННЕЕ КОЛЬЦО",
    "ДИНАМИЧЕСКАЯ СФЕРА",
];
const THEORY: [&str; 6] = [
    "МЫСЛИ И НАБЛЮДЕНИЕ",
    "КОГДА ПОЯВЛЯЕТСЯ ГОЛОС",
    "МОСТ К ПРИСУТСТВИЮ",
    "ДЫХАНИЕ. ГОЛОС. СУТЬ.",
    "ГОЛОС ОСВОБОЖДАЕТ",
    "ПРОГОВОРЕННОЕ — НЕ СКРЫТОЕ",
];
const PRACTICE: [&str; 7] = [
    "ОСТАНЬСЯ В ТИШИНЕ",
    "Я СЛЫШУ СВОЙ ГОЛОС",
    "ОТЕЦ И СЫН",
    "СЛЫШАНИЕ И ЧУВСТВОВАНИЕ",
    "ДЫХАНИЕ ОСОЗНАВАНИЯ",
    "ГОВОРИ С СОБОЙ",
    "НИТЬ АРИАДНЫ",
];
fn text(out: &mut String, s: &str, x: f64, y: f64, size: f64, alpha: f64) {
    let mut d = String::new();
    for (col, c) in s.chars().enumerate() {
        for &(cmd, p) in font::glyph(c) {
            let (letter, n) = match cmd {
                1 => ('M', 1),
                2 => ('L', 1),
                3 => ('Q', 2),
                4 => ('C', 3),
                _ => ('Z', 0),
            };
            d.push(letter);
            for i in 0..n {
                let _ = write!(
                    d,
                    "{:0.2} {:0.2} ",
                    x + col as f64 * size * 0.78 + p[i * 2] * size,
                    y - p[i * 2 + 1] * size
                );
            }
        }
    }
    let _ = write!(out, r##"<path d="{d}" fill="#eee800" opacity="{alpha}"/>"##);
}
fn hit(hits: &mut Vec<String>, label: &str, x: f64, y: f64, w: f64, h: f64, action: &str) {
    hits.push(format!(
        r##"{{"label":"{label}","x":{x},"y":{y},"w":{w},"h":{h},"action":"{action}"}}"##
    ));
}
fn sections(step: usize) -> Vec<(&'static str, Vec<&'static str>)> {
    match step {
        1 => vec![
            ("МАТЕРИАЛ", vec!["ЛОВУШКА ПОДОБИЯ", "НО ОНИ НЕ ТЫ"]),
            ("ПРАКТИКА", vec!["НАБЛЮДАЙ", "ОЩУТИ СЕБЯ", "ВОПРОСЫ К СЕБЕ"]),
        ],
        2 => vec![
            (
                "МАТЕРИАЛ",
                vec![
                    "ОТРАЖЕНИЯ",
                    "ГЛАВНЫЙ ГЕРОЙ",
                    "КНИГА ЖИЗНИ",
                    "СОН КАК МЕТАФОРА",
                ],
            ),
            (
                "ПРАКТИКА",
                vec![
                    "ЗАМЕТЬ СЕГОДНЯ",
                    "ЖИЗНЬ КАК КНИГА",
                    "ВОПРОСЫ К СЕБЕ",
                    "ПРИСМОТРИСЬ К ТЕЛУ",
                ],
            ),
        ],
        _ => vec![
            ("МАТЕРИАЛ", THEORY.to_vec()),
            ("ПРАКТИКА", PRACTICE.to_vec()),
        ],
    }
}
fn section_list(body: &mut String, hits: &mut Vec<String>, step: usize, y: &mut f64) {
    for (g, (name, rows)) in sections(step).iter().enumerate() {
        *y += 14.;
        text(body, name, 22., *y, 9., 0.4);
        *y += 29.;
        for (i, row) in rows.iter().enumerate() {
            text(body, &format!("{:02}", i + 1), 22., *y, 9., 0.34);
            text(body, row, 48., *y, 11.5, 0.85);
            hit(
                hits,
                row,
                12.,
                *y - 22.,
                336.,
                34.,
                &format!("section:{g}:{i}"),
            );
            *y += 34.;
        }
        *y += 7.;
    }
}
fn render(
    variant: usize,
    step: usize,
    group: usize,
    _selected: usize,
) -> (String, Vec<String>, f64) {
    let mut body = String::new();
    let mut hits = Vec::new();
    let mut y = 80.;
    if variant == 3 && group > 0 {
        text(&mut body, "НАЗАД К ШАГАМ", 22., y, 10.5, 0.6);
        hit(&mut hits, "Назад к шагам", 12., y - 22., 336., 38., "back");
        y += 32.;
        text(&mut body, "ОТКРЫТЬ ШАГ С НАЧАЛА", 22., y, 11.5, 1.);
        hit(
            &mut hits,
            &format!("Открыть шаг {step}"),
            12.,
            y - 22.,
            336.,
            38.,
            &format!("enter:{step}"),
        );
        y += 22.;
        section_list(&mut body, &mut hits, step, &mut y);
    } else {
        for i in 1..=7 {
            if i == step {
                let _ = write!(
                    body,
                    r##"<path d="M1 {}H359V{}H1Z" fill="#eee800" opacity=".06"/>"##,
                    y - 25.,
                    y + 18.
                );
            }
            text(
                &mut body,
                &format!("ШАГ {i}. {}", NAMES[i - 1]),
                17.,
                y,
                12.4,
                if i == step {
                    1.
                } else if i > 3 {
                    0.35
                } else {
                    0.72
                },
            );
            if i <= 3 {
                hit(
                    &mut hits,
                    &format!("Открыть шаг {i}"),
                    8.,
                    y - 26.,
                    296.,
                    44.,
                    &format!("enter:{i}"),
                );
                hit(
                    &mut hits,
                    &format!("Разделы шага {i}"),
                    309.,
                    y - 26.,
                    50.,
                    44.,
                    &format!("sections:{i}"),
                );
                let _ = write!(
                    body,
                    r##"<path d="M307 {}v25M330 {}l5 5-5 5" fill="none" stroke="#ddd500" stroke-width=".7" opacity=".7"/>"##,
                    y - 17.,
                    y - 10.
                );
            } else {
                let _ = write!(
                    body,
                    r##"<path d="M333 {}v-3a3 3 0 0 1 6 0v3m-8 0h10v8h-10Z" fill="none" stroke="#8b8517" stroke-width=".65"/>"##,
                    y - 3.
                );
            }
            y += 47.;
            if i == step && variant == 1 && group > 0 {
                section_list(&mut body, &mut hits, step, &mut y);
            }
        }
        y += 12.;
        text(
            &mut body,
            "НАЗВАНИЕ — ШАГ / СТРЕЛКА — РАЗДЕЛЫ",
            17.,
            y,
            8.,
            0.4,
        );
        y += 12.;
    }
    let height = y + 12.;
    let path=watcher_graphics::panel_geometry::fit_path("M.25 .25H359.75V59.5L331 25.25H284L272 37.25H236L224 25.25H.25ZM.25 33.75H224L236 45.75H272L284 33.75H331L359.75 65.75V519.75H.25Z",[360.,520.],[360.,height]).unwrap();
    let mut out = format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="360" height="{height}" viewBox="0 0 360 {height}"><path d="{path}" fill="#030400" stroke="#aaa315" stroke-width=".35"/>{body}"##
    );
    text(
        &mut out,
        &format!("ШАГ {step}. {}", NAMES[step - 1]),
        17.,
        18.,
        12.5,
        1.,
    );
    out.push_str(
        r##"<path d="M337 16l3-3 3 3" stroke="#c3bb00" fill="none" stroke-width=".8"/></svg>"##,
    );
    (out, hits, height)
}
fn destination(step: usize, title: &str) -> String {
    let mut out = String::from(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="360" height="260" viewBox="0 0 360 260"><path d="M.25 .25H339L359.75 21V239L339 259.75H.25Z" fill="#030400" stroke="#aaa315" stroke-width=".35"/>"##,
    );
    text(&mut out, &format!("ШАГ {step}"), 24., 42., 11., 0.5);
    text(&mut out, NAMES[step - 1], 24., 76., 14., 1.);
    text(&mut out, title, 24., 116., 11.5, 0.75);
    text(&mut out, "ПЕРЕХОД В ОДНО НАЖАТИЕ", 24., 164., 9., 0.4);
    text(&mut out, "ВЕРНУТЬСЯ К ВЫБОРУ", 24., 226., 11., 0.9);
    out.push_str("</svg>");
    out
}
fn animated_menu() -> String {
    let mut out = String::from(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="360" height="445" viewBox="0 0 360 445" aria-label="Выбор шага и разделов"><path id="menu-frame" fill="#030400" stroke="#aaa315" stroke-width=".35"/>"##,
    );
    text(&mut out, "ШАГ 3. ГОЛОС КАК МОСТ", 17., 18., 12.5, 1.);
    for i in 1..=7 {
        write!(out, r#"<g id="row-{i}">"#).unwrap();
        if i == 3 {
            out.push_str(
                r##"<path id="active-row" d="M1 -25H359V18H1Z" fill="#eee800" opacity=".06"/>"##,
            );
        }
        text(
            &mut out,
            &format!("ШАГ {i}. {}", NAMES[i - 1]),
            17.,
            0.,
            12.4,
            if i == 3 {
                1.
            } else if i > 3 {
                0.35
            } else {
                0.72
            },
        );
        if i <= 3 {
            write!(out,r##"<g id="controls-{i}" fill="none" stroke="#c8c22c" stroke-width=".8"><path d="M307 -19V10" opacity=".35"/><rect id="icon-bg-{i}" x="312" y="-22" width="44" height="34" rx="4" fill="#eee800" stroke="none"/><path d="M318 -11h2m3 0h11m-16 6h2m3 0h11m-16 6h2m3 0h11"/></g><rect id="enter-{i}" data-action="enter:{i}" role="button" tabindex="0" aria-label="Открыть шаг {i}" x="8" y="-26" width="296" height="44" fill="transparent"/><rect class="right-hit-{i}" data-action="sections:{i}" role="button" tabindex="0" aria-label="Разделы шага {i}" aria-expanded="false" x="309" y="-26" width="50" height="44" fill="transparent"/>"##).unwrap();
        } else {
            out.push_str(r##"<path d="M333 -3v-3a3 3 0 0 1 6 0v3m-8 0h10v8h-10Z" fill="none" stroke="#8b8517" stroke-width=".65"/>"##);
        }
        out.push_str("</g>");
        if i <= 3 {
            write!(out,r#"<g id="sections-{i}"><defs><clipPath id="mask-{i}"><rect id="clip-{i}" x="1" y="0" width="358" height="0"/></clipPath></defs><g clip-path="url(#mask-{i})"><g id="list-{i}" visibility="hidden">"#).unwrap();
            let mut hits = Vec::new();
            let mut y = 0.;
            section_list(&mut out, &mut hits, i, &mut y);
            // Same Rust hit contract as the static studies; adapters only dispatch actions.
            let mut y = 0.;
            for (g, (_, rows)) in sections(i).iter().enumerate() {
                y += 43.;
                for (n, row) in rows.iter().enumerate() {
                    write!(out,r#"<rect data-step="{i}" data-action="section:{g}:{n}" role="button" tabindex="-1" aria-label="{row}" x="12" y="{}" width="336" height="34" fill="transparent"/>"#,y-22.).unwrap();
                    y += 34.;
                }
                y += 7.;
            }
            out.push_str("</g></g></g>");
        }
    }
    out.push_str(r#"<g id="menu-foot">"#);
    text(
        &mut out,
        "НАЗВАНИЕ — ШАГ / СПИСОК — РАЗДЕЛЫ",
        17.,
        0.,
        8.,
        0.4,
    );
    out.push_str("</g></svg>");
    out
}
fn main() {
    let dir = PathBuf::from(std::env::args().nth(1).expect("output directory"));
    fs::create_dir_all(dir.join("assets")).unwrap();
    fs::write(dir.join("animated-menu.svg"), animated_menu()).unwrap();
    let mut states = Vec::new();
    for variant in [1, 3] {
        for step in 1..=3 {
            for group in 0..=2 {
                for selected in 0..=7 {
                    let key = format!("{variant}-{step}-{group}-{selected}");
                    let (svg, hits, height) = render(variant, step, group, selected);
                    fs::write(dir.join(format!("assets/{key}.svg")), svg).unwrap();
                    states.push(format!(
                        r##""{key}":{{"height":{height},"hits":[{}]}}"##,
                        hits.join(",")
                    ));
                }
            }
        }
    }
    for step in 1..=3 {
        fs::write(
            dir.join(format!("assets/dest-{step}.svg")),
            destination(step, "НАЧАЛО ШАГА"),
        )
        .unwrap();
        for (g, (_, rows)) in sections(step).iter().enumerate() {
            for (i, row) in rows.iter().enumerate() {
                fs::write(
                    dir.join(format!("assets/dest-{step}-{g}-{i}.svg")),
                    destination(step, row),
                )
                .unwrap();
            }
        }
    }
    fs::write(dir.join("states.json"), format!("{{{}}}", states.join(","))).unwrap();
}
