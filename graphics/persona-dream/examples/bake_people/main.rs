//! Bakes the people of «Персонаж» into line drawings:
//! `cargo run --release --example bake_people -- <out dir> [main|others]`.
//! The main figure lands in the figure's SVG frame (src/lib.rs: 4 pixels a
//! unit, the soles on row 660, column 95 at x = 0) as figure-body.png (red
//! cover, green ink); the three others in three 280 × 760 cells (400
//! pixels a metre, the soles on the bottom row) as others.png. The
//! *-shade.png pictures light the form, only to judge it by eye.
#![allow(clippy::too_many_arguments)]
mod body;
mod model;
mod people;
mod png;
mod render;

use model::{v3, Prim};
use render::{Canvas, Style};
use std::path::{Path, PathBuf};

/// Metres per unit of the figure (src/lib.rs UNIT).
const UNIT: f32 = 1.3 / 505.0;
const FIGURE: [usize; 2] = [240, 672];
const FLOOR: f32 = 660.0;
const ORIGIN: f32 = 95.0;
/// Where the drawing's neck is cut for the approved head: its row, and the
/// back and front of the drawn neck there (SVG x).
const NECK_ROW: f32 = 112.0;
const NECK: [f32; 2] = [55.0, 102.0];
/// Pixels per unit, and how much finer the trace is.
const PX: usize = 4;
const FINE: usize = 2;

const CELL: [usize; 2] = [280, 760];
const CELL_M: [f32; 2] = [0.7, 1.9];

struct Baked {
    cover: Vec<f32>,
    ink: Vec<f32>,
    shade: Vec<f32>,
    w: usize,
    h: usize,
}

fn bake(prims: &[Prim], c: &Canvas, s: &Style) -> Baked {
    let hits = render::trace(prims, c);
    let d = render::ink(&hits, prims, c, s);
    let shade = render::shade(&hits, &d.ink);
    let k = FINE;
    Baked {
        cover: render::shrink(&d.cover, c.w, c.h, k),
        ink: render::shrink(&d.ink, c.w, c.h, k),
        shade: render::shrink(&shade, c.w, c.h, k),
        w: c.w / k,
        h: c.h / k,
    }
}

fn grey(path: &Path, w: usize, h: usize, v: &[f32]) {
    let px: Vec<u8> = v.iter().map(|x| png::byte(*x)).collect();
    png::write(path, w, h, 1, &px);
}

fn main_figure(out: &Path) {
    let (fl, sk) = people::main_person();
    // Turned to face +x, then moved so the neck meets the drawn one.
    let y = NECK_ROW;
    let ym = (FLOOR - y) * UNIT;
    let [a, b] = sk.neck;
    let t = (ym - a.y) / (b.y - a.y);
    let axis = a.lerp(b, t).yaw(people::MAIN_YAW);
    let want = (0.5 * (NECK[0] + NECK[1]) - ORIGIN) * UNIT;
    let to = v3(want - axis.x, 0.0, 0.0);
    let mut placed = people::place(&fl, people::MAIN_YAW, to);
    // The head is the approved drawing's (tools/prepare-assets.mjs), and so
    // is the sternomastoid's line down the neck.
    let drop: Vec<u16> = std::env::var("DROP")
        .unwrap_or_default()
        .split(',')
        .filter_map(|x| x.parse().ok())
        .collect();
    placed.prims.retain(|p| {
        !(body::g::HEAD..body::g::CLOTH).contains(&p.group)
            && !(body::g::THROAT..body::g::THROAT + 2).contains(&p.group)
            && !drop.contains(&p.group)
    });
    let k = (PX * FINE) as f32;
    let c = Canvas {
        w: FIGURE[0] * PX * FINE,
        h: FIGURE[1] * PX * FINE,
        x0: -ORIGIN * UNIT,
        y0: FLOOR * UNIT,
        ppm: k / UNIT,
    };
    let style = Style {
        outline: 10.0,
        contour: 6.0,
        crease: 5.0,
        seam: 4.0,
        jump: 0.012,
        fill: (0.0012, 0.005),
        swell: 0.8,
        crease_of: body::crease_of,
    };
    let baked = bake(&placed.prims, &c, &style);
    report(&baked);
    let mut rgb = Vec::with_capacity(baked.w * baked.h * 3);
    for (c, i) in baked.cover.iter().zip(&baked.ink) {
        rgb.extend_from_slice(&[png::byte(*c), png::byte(*i), png::byte(*c)]);
    }
    png::write(&out.join("figure-body.png"), baked.w, baked.h, 3, &rgb);
    grey(
        &out.join("figure-shade.png"),
        baked.w,
        baked.h,
        &baked.shade,
    );
    println!("main: {} primitives", placed.prims.len());
}

/// The figure's extent in SVG units, its soles and its neck at the cut.
fn report(b: &Baked) {
    let px = PX as f32;
    let row = |v: f32| -> Option<(f32, f32)> {
        let j = (v * px) as usize;
        let r = &b.cover[j * b.w..(j + 1) * b.w];
        let first = r.iter().position(|c| *c > 0.5)?;
        let last = r.iter().rposition(|c| *c > 0.5)?;
        Some((first as f32 / px, (last + 1) as f32 / px))
    };
    let mut lo = f32::INFINITY;
    let mut hi = f32::NEG_INFINITY;
    let mut top = None;
    for j in 0..b.h {
        if let Some((x0, x1)) = row(j as f32 / px) {
            lo = lo.min(x0);
            hi = hi.max(x1);
            top.get_or_insert(j as f32 / px);
        }
    }
    println!("extent x {lo:.1} … {hi:.1}, top row {top:?}");
    for v in [
        NECK_ROW,
        NECK_ROW + 4.0,
        NECK_ROW + 8.0,
        NECK_ROW + 18.0,
        300.0,
        400.0,
        FLOOR - 1.5,
    ] {
        println!("row {v}: {:?}", row(v));
    }
}

fn others(out: &Path) {
    let people = [people::tall_man(), people::woman(), people::heavy_man()];
    let k = FINE as f32;
    let ppm = CELL[0] as f32 / CELL_M[0];
    let style = Style {
        outline: 2.4,
        contour: 1.7,
        crease: 1.4,
        seam: 1.2,
        jump: 0.022,
        fill: (0.0015, 0.007),
        swell: 0.6,
        crease_of: body::crease_of,
    };
    let (aw, ah) = (CELL[0] * 3, CELL[1]);
    let mut rgb = vec![0u8; aw * ah * 3];
    let mut shade = vec![0f32; aw * ah];
    for (who, (fl, yaw)) in people.iter().enumerate() {
        let turned = people::place(fl, *yaw, v3(0.0, 0.0, 0.0));
        // Centred on the feet.
        let ankles: Vec<f32> = turned
            .prims
            .iter()
            .filter(|p| p.group >= body::g::SHOE && p.group < body::g::SHOE + 2)
            .map(|p| p.bounds())
            .map(|(lo, hi)| 0.5 * (lo.x + hi.x))
            .collect();
        let mid = ankles.iter().sum::<f32>() / ankles.len().max(1) as f32;
        let placed = people::place(fl, *yaw, v3(-mid, 0.0, 0.0));
        let c = Canvas {
            w: CELL[0] * FINE,
            h: CELL[1] * FINE,
            x0: -0.5 * CELL_M[0],
            y0: CELL_M[1],
            ppm: ppm * k,
        };
        let baked = bake(&placed.prims, &c, &style);
        for j in 0..ah {
            for i in 0..CELL[0] {
                let src = j * baked.w + i;
                let dst = j * aw + who * CELL[0] + i;
                rgb[dst * 3] = png::byte(baked.cover[src]);
                rgb[dst * 3 + 1] = png::byte(baked.ink[src]);
                shade[dst] = baked.shade[src];
            }
        }
        println!("other {who}: {} primitives", placed.prims.len());
    }
    png::write(&out.join("others.png"), aw, ah, 3, &rgb);
    grey(&out.join("others-shade.png"), aw, ah, &shade);
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let out = PathBuf::from(args.get(1).map_or("target/people", String::as_str));
    std::fs::create_dir_all(&out).unwrap_or_else(|e| panic!("{}: {e}", out.display()));
    let which = args.get(2).map_or("all", String::as_str);
    let start = std::time::Instant::now();
    if which != "others" {
        main_figure(&out);
    }
    if which != "main" {
        others(&out);
    }
    println!("baked in {:.1} s", start.elapsed().as_secs_f32());
}
