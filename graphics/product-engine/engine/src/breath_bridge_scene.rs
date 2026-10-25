//! One camera for the floor, slabs, pit and portal. Opaque curved silhouettes
//! are drawn after the world; the original rain texture is behind every body.
use super::*;
type World = [f64; 3];
const UNIT: f64 = 48.;
const GATE_X: f64 = 6.8;
// One section for the aperture, its wall, reveals and ceiling. The wall is
// supported by the 2.7-wide bank; its inner edge is also the door-leaf track.
const GATE_W: f64 = 1.62;
const GATE_H: f64 = 3.99;
const GATE_CUT: f64 = 0.22;
const ROOM_W: f64 = 2.65;
const ROOM_H: f64 = 4.65;
const WALL_DEPTH: f64 = 0.20;
const DEPTH_X: f64 = 18.;
const DEPTH_Y: f64 = 7.8;
fn project([x, y, z]: World) -> Point {
    // Side elevation: travel is horizontal and figures retain their size.
    // A shallow cabinet depth reveals the slabs' tops and the gate's thickness.
    (415. + UNIT * x + DEPTH_X * z, 408. - UNIT * y + DEPTH_Y * z)
}
fn unproject_at_z(p: Point, z: f64) -> World {
    [
        (p.0 - 415. - DEPTH_X * z) / UNIT,
        (408. + DEPTH_Y * z - p.1) / UNIT,
        z,
    ]
}
fn world(points: &[World]) -> String {
    poly(&points.iter().copied().map(project).collect::<Vec<_>>())
}
fn world_line(points: &[World]) -> String {
    line(&points.iter().copied().map(project).collect::<Vec<_>>())
}
fn emit(out: &mut String, p: Path) {
    p.xml(out, "");
}
fn segment(out: &mut String, a: World, b: World, ink: &'static str, width: f64, alpha: f64) {
    emit(out, Path::line(world_line(&[a, b]), ink, width, alpha));
}
fn rain_map(surface: [World; 4], density: [f64; 2]) -> String {
    // Inverse of the same world projection as all solid geometry. Laboratory
    // rain follows each wall/floor; it is never a separate screen-space layer.
    let [a, b, _, d] = surface;
    let u = std::array::from_fn::<_, 3, _>(|i| b[i] - a[i]);
    let v = std::array::from_fn::<_, 3, _>(|i| d[i] - a[i]);
    let hom = |p: World, w: f64| {
        [
            415. * w + UNIT * p[0] + DEPTH_X * p[2],
            408. * w - UNIT * p[1] + DEPTH_Y * p[2],
            w,
        ]
    };
    let u = hom(u, 0.);
    let v = hom(v, 0.);
    let a = hom(a, 1.);
    let [a, b, c, d, e, f, g, h, i] = [u[0], v[0], a[0], u[1], v[1], a[1], u[2], v[2], a[2]];
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
    co.iter()
        .enumerate()
        .map(|(i, n)| {
            format!(
                "{:.12}",
                n / det
                    * if i < 3 {
                        density[0]
                    } else if i < 6 {
                        density[1]
                    } else {
                        1.
                    }
            )
        })
        .collect::<Vec<_>>()
        .join(" ")
}
fn rain_path(surface: [World; 4], alpha: f64, density: [f64; 2]) -> Path {
    let mut p = Path::line(world(&surface), "none", 0., alpha);
    p.matrix_uv = Some(rain_map(surface, density));
    p
}
fn rain(out: &mut String, name: &str, surface: [World; 4], alpha: f64) {
    let density = if name == "depth" {
        [2.25, 2.25]
    } else if name == "pit" {
        [1.5, 1.5]
    } else {
        [1., 1.]
    };
    rain_path(surface, alpha, density).xml(out, &format!("bridge-laboratory-rain-{name}"));
}
fn surface(out: &mut String, name: &str, quad: [World; 4], density: [f64; 2], alpha: f64) {
    emit(out, Path::solid(world(&quad), COVER, LINE, 0.85));
    rain_path(quad, alpha, density).xml(out, &format!("bridge-surface-{name}"));
}

fn portal(u: f64, y: f64, depth: f64) -> Point {
    // Gate normal is -X, facing the approaching walker. Its tunnel continues
    // along +X, exactly the bridge's centreline, rather than facing the camera.
    project([GATE_X + depth, y, u])
}
fn gate_line(points: &[(f64, f64)], depth: f64) -> String {
    line(
        &points
            .iter()
            .map(|&(u, y)| portal(u, y, depth))
            .collect::<Vec<_>>(),
    )
}

fn gate_pier(out: &mut String, side: f64) {
    let inner = side * GATE_W;
    let outer = side * ROOM_W;
    let spring = GATE_H - GATE_CUT;
    let name = if side < 0. {
        "entrance-far"
    } else {
        "entrance-near"
    };
    // The pier is part of the entrance wall, not a second freestanding frame.
    surface(
        out,
        name,
        [
            [GATE_X, spring, inner],
            [GATE_X, spring, outer],
            [GATE_X, 0., outer],
            [GATE_X, 0., inner],
        ],
        [0.12, 0.96],
        0.46,
    );
    surface(
        out,
        if side < 0. {
            "reveal-far"
        } else {
            "reveal-near"
        },
        [
            [GATE_X, spring, inner],
            [GATE_X + WALL_DEPTH, spring, inner],
            [GATE_X + WALL_DEPTH, 0., inner],
            [GATE_X, 0., inner],
        ],
        [0.05, 0.96],
        0.32,
    );
    // One recessed panel and one light rail per pier. Their ends join the
    // lintel and floor, with no independent roofs, feet or projecting shelves.
    emit(
        out,
        Path::line(
            gate_line(
                &[
                    (side * (ROOM_W - 0.16), 0.18),
                    (side * (ROOM_W - 0.16), spring - 0.12),
                    (side * (GATE_W + 0.21), spring - 0.12),
                    (side * (GATE_W + 0.21), 0.18),
                    (side * (ROOM_W - 0.16), 0.18),
                ],
                -0.006,
            ),
            LINE,
            0.7,
            0.64,
        ),
    );
    emit(
        out,
        Path::line(
            gate_line(&[(inner, 0.), (inner, spring)], 0.),
            INK,
            1.25,
            0.92,
        ),
    );
    for row in 0..8 {
        let y = 0.32 + row as f64 * 0.43;
        emit(
            out,
            Path::line(
                gate_line(
                    &[
                        (side * (GATE_W + 0.12), y),
                        (side * (GATE_W + 0.12), y + 0.16),
                    ],
                    -0.008,
                ),
                if row == 0 || row == 7 { LIGHT } else { INK },
                1.2,
                0.60,
            ),
        );
    }
}

fn architecture(out: &mut String) {
    let rear = GATE_X + WALL_DEPTH;
    let spring = GATE_H - GATE_CUT;
    let roof_top = ROOM_H + 0.14;
    // One chamber: background interior, facade and roof share their corners.
    // The opaque near wall is in the foreground, physically hiding entry.
    surface(
        out,
        "room-back",
        [
            [rear, ROOM_H, -ROOM_W],
            [14., ROOM_H, -ROOM_W],
            [14., 0., -ROOM_W],
            [rear, 0., -ROOM_W],
        ],
        [0.9, 1.1],
        0.43,
    );
    for x in [rear + 0.18, 9.4, 11.8] {
        segment(
            out,
            [x, 0.2, -ROOM_W],
            [x, ROOM_H - 0.2, -ROOM_W],
            LINE,
            0.65,
            0.48,
        );
    }
    for y in [0.2, 1.45, 3.05, ROOM_H - 0.2] {
        segment(
            out,
            [rear + 0.18, y, -ROOM_W],
            [14., y, -ROOM_W],
            LINE,
            0.65,
            0.42,
        );
    }
    // Long recessed bands establish depth without repeating gate silhouettes.
    for y in [0.42, ROOM_H - 0.40] {
        segment(
            out,
            [rear + 0.32, y, -ROOM_W + 0.01],
            [14., y, -ROOM_W + 0.01],
            INK,
            0.85,
            0.52,
        );
    }
    let center = portal(0., 1.8, 0.8);
    let mut glow = Path::solid(
        ellipse(center.0, center.1, 58., 96.),
        "url(#bridge-light)",
        "none",
        0.,
    );
    glow.alpha = 0.5;
    emit(out, glow);

    surface(
        out,
        "ceiling",
        [
            [GATE_X, roof_top, -ROOM_W],
            [GATE_X, roof_top, ROOM_W],
            [14., roof_top, ROOM_W],
            [14., roof_top, -ROOM_W],
        ],
        [0.34, 0.95],
        0.44,
    );
    surface(
        out,
        "ceiling-edge",
        [
            [GATE_X, roof_top, ROOM_W],
            [14., roof_top, ROOM_W],
            [14., ROOM_H, ROOM_W],
            [GATE_X, ROOM_H, ROOM_W],
        ],
        [0.9, 0.05],
        0.28,
    );
    for z in [-ROOM_W + 0.16, 0., ROOM_W - 0.16] {
        segment(
            out,
            [GATE_X, roof_top + 0.002, z],
            [14., roof_top + 0.002, z],
            LINE,
            0.65,
            0.54,
        );
    }
    for x in [rear, 9.4, 11.8] {
        segment(
            out,
            [x, roof_top + 0.002, -ROOM_W],
            [x, roof_top + 0.002, ROOM_W],
            LINE,
            0.65,
            0.50,
        );
    }

    gate_pier(out, -1.);
    // The opening is cut out of this header. There is no opaque rectangle
    // through the chamfers and no smaller roof left inside the opening.
    let header = [
        (-ROOM_W, spring),
        (-ROOM_W, roof_top),
        (ROOM_W, roof_top),
        (ROOM_W, spring),
        (GATE_W, spring),
        (GATE_W - GATE_CUT, GATE_H),
        (-GATE_W + GATE_CUT, GATE_H),
        (-GATE_W, spring),
    ];
    let d = poly(&header.map(|(z, y)| portal(z, y, 0.)));
    emit(out, Path::solid(d.clone(), COVER, LINE, 0.85));
    let mut code = rain_path(
        [
            [GATE_X, roof_top, -ROOM_W],
            [GATE_X, roof_top, ROOM_W],
            [GATE_X, spring, ROOM_W],
            [GATE_X, spring, -ROOM_W],
        ],
        0.40,
        [0.58, 0.28],
    );
    code.d = d;
    code.xml(out, "bridge-surface-entrance-lintel");
    let top = [
        (-GATE_W, spring),
        (-GATE_W + GATE_CUT, GATE_H),
        (GATE_W - GATE_CUT, GATE_H),
        (GATE_W, spring),
    ];
    // A shallow machined reveal follows the same three aperture edges.
    for edge in top.windows(2) {
        let [(a, ay), (b, by)] = [edge[0], edge[1]];
        surface(
            out,
            "reveal-top",
            [
                [GATE_X, ay, a],
                [GATE_X, by, b],
                [rear, by, b],
                [rear, ay, a],
            ],
            [0.2, 0.06],
            0.22,
        );
    }
    emit(out, Path::line(gate_line(&top, 0.), INK, 1.25, 0.92));
    emit(
        out,
        Path::line(gate_line(&top, WALL_DEPTH), LINE, 0.65, 0.72),
    );
    emit(
        out,
        Path::line(
            gate_line(
                &[
                    (-ROOM_W + 0.16, spring + 0.18),
                    (-ROOM_W + 0.16, roof_top - 0.16),
                    (ROOM_W - 0.16, roof_top - 0.16),
                    (ROOM_W - 0.16, spring + 0.18),
                ],
                -0.006,
            ),
            LINE,
            0.65,
            0.64,
        ),
    );
    // Quiet central hardware on the lintel; both sides retain the same scale.
    for n in -3..=3 {
        let z = n as f64 * 0.22;
        emit(
            out,
            Path::line(
                gate_line(&[(z, GATE_H + 0.29), (z + 0.07, GATE_H + 0.29)], -0.008),
                INK,
                1.2,
                0.62,
            ),
        );
    }
    // The sill is flush with the route, not a second platform under the gate.
    segment(
        out,
        [GATE_X, 0.012, -GATE_W],
        [GATE_X, 0.012, GATE_W],
        INK,
        1.1,
        0.82,
    );
    segment(
        out,
        [rear, 0.012, -GATE_W],
        [rear, 0.012, GATE_W],
        LINE,
        0.65,
        0.55,
    );
}

pub(super) fn environment() -> String {
    let mut out = String::new();
    rain(
        &mut out,
        "depth",
        [
            [-14., 8., -7.],
            [18., 8., -7.],
            [18., -8., -7.],
            [-14., -8., -7.],
        ],
        0.48,
    );
    // Distant lattice is deliberately quieter than the traversal and gateway.
    for x in -11..=16 {
        segment(
            &mut out,
            [x as f64, -5., -7.],
            [x as f64, 7., -7.],
            DIM,
            0.65,
            0.40,
        );
    }
    for y in -5..=7 {
        segment(
            &mut out,
            [-11., y as f64, -7.],
            [16., y as f64, -7.],
            DIM,
            0.55,
            0.42,
        );
    }
    // Walls and rain establish depth without a side walkway around the gap.
    rain(
        &mut out,
        "side",
        [
            [13., 7., -7.],
            [13., 7., 6.],
            [13., -6., 6.],
            [13., -6., -7.],
        ],
        0.29,
    );
    for z in -7..=6 {
        segment(
            &mut out,
            [13., -6., z as f64],
            [13., 7., z as f64],
            DIM,
            0.6,
            0.42,
        );
    }
    for y in -5..=7 {
        segment(
            &mut out,
            [13., y as f64, -7.],
            [13., y as f64, 6.],
            DIM,
            0.6,
            0.42,
        );
    }
    rain(
        &mut out,
        "pit",
        [
            [-3.85, 0., -3.3],
            [5.35, 0., -3.3],
            [5.35, -7., -3.3],
            [-3.85, -7., -3.3],
        ],
        0.58,
    );
    for x in -3..=5 {
        segment(
            &mut out,
            [x as f64, 0., -3.3],
            [x as f64, -7., -3.3],
            DIM,
            0.55,
            0.38,
        );
    }
    for y in 1..=5 {
        segment(
            &mut out,
            [-3.85, -(y as f64), -3.3],
            [5.35, -(y as f64), -3.3],
            DIM,
            0.55,
            0.31,
        );
    }
    // The visible inner wall falls below the arrival platform. Its supports
    // shrink into darkness, rather than ending as a flat floating rectangle.
    let inner = [
        [5.30, 0., -2.7],
        [5.30, 0., 2.7],
        [5.30, -6., 2.7],
        [5.30, -6., -2.7],
    ];
    emit(&mut out, Path::solid(world(&inner), COVER, DIM, 0.8));
    rain(&mut out, "inner-wall", inner, 0.32);
    for n in 0..10 {
        let z = -2.7 + n as f64 * 0.60;
        segment(&mut out, [5.30, -0.3, z], [5.30, -6., z], LINE, 0.7, 0.46);
    }
    for y in [-0.3, -1.4, -3.2, -5.] {
        segment(&mut out, [5.30, y, -2.7], [5.30, y, 2.7], LINE, 0.65, 0.40);
    }
    for (name, a, b) in [("near", -12., -3.85), ("far", 5.30, 14.)] {
        let edge = if name == "near" { b } else { a };
        // Both permanent banks are substantial blocks, not paper-thin shelves.
        surface(
            &mut out,
            &format!("{name}-front"),
            [
                [a, -0.30, 2.7],
                [b, -0.30, 2.7],
                [b, -4.8, 2.7],
                [a, -4.8, 2.7],
            ],
            [1.4, 1.0],
            0.62,
        );
        // The starting bank's +X end is back-facing in this projection.
        // Drawing it over the front wall makes the solid bank transparent.
        if name == "far" {
            surface(
                &mut out,
                &format!("{name}-end"),
                [
                    [edge, -0.30, -2.7],
                    [edge, -0.30, 2.7],
                    [edge, -4.8, 2.7],
                    [edge, -4.8, -2.7],
                ],
                [0.65, 1.1],
                0.66,
            );
        }
        for y in [-0.65, -1.7, -3.2] {
            segment(&mut out, [a, y, 2.7], [b, y, 2.7], LINE, 0.65, 0.52);
            if name == "far" {
                segment(&mut out, [edge, y, -2.7], [edge, y, 2.7], LINE, 0.65, 0.52);
            }
        }
        for n in 0..=((b - a) / 1.2) as usize {
            let x = a + n as f64 * 1.2;
            segment(&mut out, [x, -0.3, 2.7], [x, -4.8, 2.7], LINE, 0.65, 0.45);
        }
        surface(
            &mut out,
            &format!("{name}-fascia"),
            [[a, 0., 2.7], [b, 0., 2.7], [b, -0.30, 2.7], [a, -0.30, 2.7]],
            [1.4, 0.08],
            0.26,
        );
        let top = [[a, 0., -2.7], [b, 0., -2.7], [b, 0., 2.7], [a, 0., 2.7]];
        emit(&mut out, Path::solid(world(&top), COVER, LINE, 0.8));
        rain_path([top[0], top[3], top[2], top[1]], 0.78, [0.28, 0.9])
            .xml(&mut out, &format!("bridge-surface-{name}-floor"));
        let edge = if name == "near" { b } else { a };
        if name == "far" {
            emit(
                &mut out,
                Path::solid(
                    world(&[
                        [edge, 0., -2.7],
                        [edge, 0., 2.7],
                        [edge, -0.30, 2.7],
                        [edge, -0.30, -2.7],
                    ]),
                    COVER,
                    INK,
                    1.15,
                ),
            );
        }
        for n in 0..=9 {
            let z = -2.7 + n as f64 * 0.60;
            segment(&mut out, [a, 0.005, z], [b, 0.005, z], LINE, 0.65, 0.72);
        }
        for n in 0..=((b - a) / 0.60) as usize {
            let x = a + n as f64 * 0.60;
            segment(
                &mut out,
                [x, 0.005, -2.7],
                [x, 0.005, 2.7],
                LINE,
                0.65,
                0.72,
            );
        }
        segment(
            &mut out,
            [edge, 0.02, -2.7],
            [edge, 0.02, 2.7],
            INK,
            1.75,
            0.86,
        );
        segment(
            &mut out,
            [
                edge + (if name == "near" { -0.13 } else { 0.13 }),
                0.02,
                -2.7,
            ],
            [
                edge + (if name == "near" { -0.13 } else { 0.13 }),
                0.02,
                2.7,
            ],
            INK,
            0.65,
            0.50,
        );
        for n in 0..9 {
            let z = -2.4 + n as f64 * 0.60;
            let mut p = Path::solid(
                world(&[
                    [edge - 0.08, 0.024, z],
                    [edge + 0.08, 0.024, z],
                    [edge + 0.08, 0.024, z + 0.14],
                    [edge - 0.08, 0.024, z + 0.14],
                ]),
                INK,
                "none",
                0.,
            );
            p.alpha = 0.58;
            emit(&mut out, p);
        }
    }
    architecture(&mut out);
    out
}

pub(super) fn foreground() -> String {
    let mut out = String::from("<g class=\"bridge-near-casing\">");
    // This solid foreground surface occludes the room and the walking body.
    // It meets the near entrance corner, ceiling edge and floor exactly.
    surface(
        &mut out,
        "room-near",
        [
            [GATE_X, ROOM_H, ROOM_W],
            [14., ROOM_H, ROOM_W],
            [14., 0., ROOM_W],
            [GATE_X, 0., ROOM_W],
        ],
        [0.9, 1.1],
        0.34,
    );
    for x in [9.4, 11.8] {
        segment(
            &mut out,
            [x, 0.18, ROOM_W],
            [x, ROOM_H - 0.18, ROOM_W],
            LINE,
            0.65,
            0.42,
        );
    }
    for y in [0.18, ROOM_H - 0.18] {
        segment(
            &mut out,
            [GATE_X + 0.18, y, ROOM_W],
            [14., y, ROOM_W],
            LINE,
            0.65,
            0.48,
        );
    }
    gate_pier(&mut out, 1.);
    out.push_str("</g>");
    out
}

fn doors(out: &mut Vec<Path>, s: State) {
    for side in [-1., 1.] {
        let inner = 0.025 + (GATE_W - 0.045) * s.opening;
        let bevel = (GATE_W - inner).min(0.16);
        let mid = inner + 0.12_f64.min(bevel) * (1. - s.opening);
        let top = |u: f64| GATE_H - 0.03 - (u - (GATE_W - GATE_CUT)).max(0.);
        let corner = (GATE_W - GATE_CUT).max(inner + bevel);
        let depth = WALL_DEPTH * 0.5;
        let nodes = [
            (GATE_W, 0.13),
            (GATE_W, top(GATE_W)),
            (corner, top(corner)),
            (inner + bevel, top(inner + bevel)),
            (inner, top(inner) - bevel),
            (inner, 2.61),
            (mid, 2.46),
            (mid, 1.48),
            (inner, 1.32),
            (inner, 0.30),
        ];
        let d = poly(&nodes.map(|(u, y)| portal(side * u, y, depth)));
        let mut code = rain_path(
            [
                [GATE_X + depth, GATE_H, -GATE_W],
                [GATE_X + depth, GATE_H, GATE_W],
                [GATE_X + depth, 0.13, GATE_W],
                [GATE_X + depth, 0.13, -GATE_W],
            ],
            0.55,
            [0.36, 1.0],
        );
        code.d = d.clone();
        out.push(Path::solid(d, COVER, INK, 1.5));
        out.push(code);
        let inset = |u: f64, y: f64| {
            let u = inner + (u - 0.025) / (GATE_W - 0.025) * (GATE_W - inner);
            portal(side * u, y.min(top(u) - 0.12), depth - 0.006)
        };
        let d = line(
            &[
                (1.53, 0.25),
                (1.53, 3.84),
                (0.215, 3.84),
                (0.105, 3.71),
                (0.105, 2.68),
                (0.225, 2.51),
                (0.225, 1.42),
                (0.105, 1.25),
                (0.105, 0.35),
            ]
            .map(|(u, y)| inset(u, y)),
        );
        out.push(Path::line(d, LINE, 0.7, 0.85));
        out.push(Path::line(
            line(&[
                portal(side * inner, 0.32, depth - 0.008),
                portal(side * (inner + bevel * 0.25), 1.25, depth - 0.008),
            ]),
            LIGHT,
            1.7,
            0.36 + 0.45 * s.opening,
        ));
    }
    let broken = between(s.t, BREAK_AT, BREAK_AT + 0.6);
    let settle = if s.t > BREAK_AT + 0.1 {
        let elapsed = s.t - BREAK_AT - 0.1;
        (elapsed * 6.).sin() * (-elapsed * 1.5).exp() * 0.12
    } else {
        0.
    };
    for strand in 0..2 {
        for side in [-1., 1.] {
            let anchor_y = if (side < 0.) == (strand == 0) {
                2.85
            } else {
                1.12
            };
            let end_y = mix(1.98, 1.35, broken) + settle;
            let end_u = side * (0.02 + 1.16 * broken);
            let anchor = (side * 1.56, anchor_y);
            let end = (end_u, end_y);
            let mut links = String::new();
            for n in 0..8 {
                let p = (n as f64 + 0.5) / 8.;
                let q = lerp(anchor, end, p);
                let next = lerp(anchor, end, (p + 0.05).min(1.));
                let a = portal(q.0, q.1 - (PI * p).sin() * 0.12, -0.04);
                let b = portal(next.0, next.1 - (PI * (p + 0.05)).sin() * 0.12, -0.04);
                let angle = (b.1 - a.1).atan2(b.0 - a.0);
                let rx = if n % 2 == 0 { 5.2 } else { 4.2 };
                let ry = if n % 2 == 0 { 2.2 } else { 1.15 };
                links.push_str(&poly(
                    &(0..16)
                        .map(|i| {
                            let v = i as f64 * PI / 8.;
                            (
                                a.0 + rx * v.cos() * angle.cos() - ry * v.sin() * angle.sin(),
                                a.1 + rx * v.cos() * angle.sin() + ry * v.sin() * angle.cos(),
                            )
                        })
                        .collect::<Vec<_>>(),
                ));
            }
            out.push(Path::line(links, INK, 1.35, 0.90));
            if strand == 0 {
                let p = portal(end.0, end.1 - 0.16, -0.05);
                let tilt = side * (0.08 + 0.32 * broken + settle);
                let local = |x: f64, y: f64| {
                    (
                        p.0 + x * tilt.cos() - y * tilt.sin(),
                        p.1 + x * tilt.sin() + y * tilt.cos(),
                    )
                };
                out.push(Path::solid(
                    poly(&[
                        local(-7., 0.),
                        local(7., 0.),
                        local(7., 17.),
                        local(-7., 17.),
                    ]),
                    COVER,
                    INK,
                    1.3,
                ));
                out.push(Path::line(
                    line(&[
                        local(-4., 0.),
                        local(-4., -6.),
                        local(0., -8.),
                        local(4., -6.),
                        local(4., 0.),
                    ]),
                    INK,
                    1.3,
                    1.,
                ));
                out.push(Path::line(
                    line(&[local(0., 6.), local(0., 11.)]),
                    LIGHT,
                    1.8,
                    0.78,
                ));
            }
        }
    }
    // A brief finite break, rather than continuous spark confetti.
    let pulse = bell(
        s.t,
        BREAK_AT - 0.01,
        BREAK_AT + 0.07,
        BREAK_AT + 0.25,
        BREAK_AT + 0.8,
    );
    for i in 0..8 {
        let angle = i as f64 * PI / 4.;
        let p = portal(0., 1.98, 0.);
        let r = 10. + between(s.t, BREAK_AT + 0.01, BREAK_AT + 0.85) * 40.;
        out.push(Path::line(
            line(&[
                (p.0 + r * angle.cos(), p.1 + r * angle.sin()),
                (p.0 + (r + 4.) * angle.cos(), p.1 + (r + 4.) * angle.sin()),
            ]),
            INK,
            1.15,
            pulse * 0.8,
        ));
    }
}

fn slab_points(x: f64, half: f64, z: f64, y: f64) -> [World; 8] {
    let c = 0.10;
    [
        [x - half + c, y, -z],
        [x + half - c, y, -z],
        [x + half, y, -z + c],
        [x + half, y, z - c],
        [x + half - c, y, z],
        [x - half + c, y, z],
        [x - half, y, z - c],
        [x - half, y, -z + c],
    ]
}
fn slabs(out: &mut Vec<Path>, s: State) {
    // Far to near is the painter order for the inclined crossing.
    for i in (0..TILES.len()).rev() {
        let x = TILES[i];
        let slab = tile(i, s);
        let solid = slab.build * (1. - slab.dissolve);
        let y = -0.08 * (1. - slab.build) - 0.12 * slab.dissolve;
        let top = slab_points(x, TILE_HALF, 0.70, y);
        let bottom = slab_points(x, TILE_HALF, 0.70, y - 0.12);
        let mut sides = String::new();
        for (a, b) in [(2, 3), (3, 4), (4, 5), (5, 6), (6, 7)] {
            sides.push_str(&world(&[top[a], top[b], bottom[b], bottom[a]]));
        }
        let mut p = Path::solid(sides, COVER, INK, 1.15);
        p.alpha = solid;
        out.push(p);
        let mut p = Path::solid(world(&top), COVER, INK, 1.4);
        p.alpha = solid;
        out.push(p);
        let mut code = rain_path(
            [
                [x - TILE_HALF, y, -0.70],
                [x - TILE_HALF, y, 0.70],
                [x + TILE_HALF, y, 0.70],
                [x + TILE_HALF, y, -0.70],
            ],
            solid * 0.70,
            [0.09, 0.24],
        );
        code.d = world(&top);
        out.push(code);
        out.push(rain_path(
            [
                [x - TILE_HALF, y, 0.70],
                [x + TILE_HALF, y, 0.70],
                [x + TILE_HALF, y - 0.12, 0.70],
                [x - TILE_HALF, y - 0.12, 0.70],
            ],
            solid * 0.55,
            [0.50, 0.08],
        ));
        out.push(Path::line(
            world(&slab_points(x, 0.78, 0.59, y + 0.002)),
            LINE,
            0.65,
            solid * 0.74,
        ));
        let mut mesh = String::new();
        for n in 1..6 {
            let xx = x - 0.78 + n as f64 * 0.26;
            mesh.push_str(&world_line(&[
                [xx, y + 0.003, -0.59],
                [xx, y + 0.003, 0.59],
            ]));
        }
        for n in 1..4 {
            let z = -0.59 + n as f64 * 0.295;
            mesh.push_str(&world_line(&[
                [x - 0.78, y + 0.003, z],
                [x + 0.78, y + 0.003, z],
            ]));
        }
        out.push(Path::line(mesh, LINE, 0.55, solid * 0.47));
        let mut caps = String::new();
        for (xx, z) in [
            (x - 0.82, -0.60),
            (x + 0.82, -0.60),
            (x - 0.82, 0.60),
            (x + 0.82, 0.60),
        ] {
            caps.push_str(&world(&[
                [xx - 0.065, y + 0.008, z - 0.065],
                [xx + 0.065, y + 0.008, z - 0.065],
                [xx + 0.065, y + 0.008, z + 0.065],
                [xx - 0.065, y + 0.008, z + 0.065],
            ]));
        }
        let mut p = Path::solid(caps, INK, LIGHT, 0.5);
        p.alpha = solid * 0.92;
        out.push(p);
        let guide = bell(
            s.t,
            slab.at - 0.15,
            slab.at + 0.38,
            slab.at + 0.66,
            slab.at + 1.35,
        );
        out.push(Path::line(
            world(&slab_points(x, TILE_HALF, 0.70, 0.02)),
            INK,
            0.8,
            guide * 0.30,
        ));
        // Cells reconstruct the same slab on arrival and peel off behind it.
        // Fixed topology and seeded coordinates make seeking/reduced motion exact.
        let mut cells = String::new();
        let mut cell_edges = String::new();
        for n in 0..18 {
            let col = n % 6;
            let row = n / 6;
            let seed = ((n * 17 + i * 11) % 19) as f64 / 19.;
            let build = ease5((s.t - slab.at - seed * 0.14) / 0.92);
            let fall = between(slab.dissolve, seed * 0.24, 0.85 + seed * 0.15);
            let xx = x - 0.72 + col as f64 * 0.288 - 0.22 * fall;
            let z = -0.45 + row as f64 * 0.45 + (seed - 0.5) * fall * 0.45;
            let yy = -0.28 * (1. - build) - 0.42 * fall * fall;
            let size = 0.105 * (1. - fall * 0.65);
            let corners = [
                [xx - size, yy, z - size],
                [xx + size, yy, z - size],
                [xx + size, yy, z + size],
                [xx - size, yy, z + size],
            ];
            cells.push_str(&world(&corners));
            for edge in [1, 2, 3] {
                cell_edges.push_str(&world_line(&[
                    corners[edge],
                    [corners[edge][0], yy - 0.09, corners[edge][2]],
                ]));
            }
        }
        let pieces = (bell(
            s.t,
            slab.at - 0.12,
            slab.at + 0.32,
            slab.at + 0.64,
            slab.at + 1.25,
        ) * 0.45
            + 0.40 * (slab.dissolve * PI).sin().powi(2))
        .clamp(0., 1.);
        let mut p = Path::solid(cells, COVER, INK, 0.8);
        p.alpha = pieces;
        out.push(p);
        out.push(Path::line(cell_edges, LINE, 0.65, pieces));
    }
}

const LEG_Z: f64 = 0.07;
fn character_scale(_: State) -> f64 {
    UNIT
}
pub(super) fn heroine_pose(s: State) -> (crate::breath_heroine::Pose, Point, f64) {
    use crate::breath_heroine::{
        solve_knee, FootTarget, ProjectedSkeleton, View, ANKLES, HEELS, SOLES, TOES,
    };
    let base = project([s.x, 0., 0.]);
    let scale = UNIT * 3.3 / 1400.;
    let origin = (base.0 - 510. * scale, base.1 - 1417. * scale);
    let feet = std::array::from_fn(|i| {
        let f = s.feet[i];
        let z = if i == 0 { LEG_Z } else { -LEG_Z };
        let p = project([f.x, f.lift, z]);
        // Both legs use the same profile foot and contact geometry.
        let rest_angle = -(TOES[0].1 - HEELS[0].1).atan2(TOES[0].0 - HEELS[0].0);
        let angle = rest_angle + f.roll;
        let pivot = lerp(HEELS[0], TOES[0], f.toe_pivot);
        let rotate =
            |v: Point, a: f64| (v.0 * a.cos() - v.1 * a.sin(), v.0 * a.sin() + v.1 * a.cos());
        let planted = rotate((pivot.0 - SOLES[0].0, pivot.1 - SOLES[0].1), rest_angle);
        let ankle = rotate((ANKLES[0].0 - pivot.0, ANKLES[0].1 - pivot.1), angle);
        FootTarget {
            ankle: (
                (p.0 - origin.0) / scale + planted.0 + ankle.0,
                (p.1 - origin.1) / scale + planted.1 + ankle.1,
            ),
            angle,
            scale: 1.,
        }
    });
    let local = |p: Point| ((p.0 - origin.0) / scale, (p.1 - origin.1) / scale);
    let screen = |p: Point| (origin.0 + p.0 * scale, origin.1 + p.1 * scale);
    let hips: [World; 2] =
        std::array::from_fn(|i| [s.x, 1.74 + s.bob, if i == 0 { LEG_Z } else { -LEG_Z }]);
    let ankles: [World; 2] =
        std::array::from_fn(|i| unproject_at_z(screen(feet[i].ankle), hips[i][2]));
    let upper: f64 = 0.80;
    let lower: f64 = 0.82;
    let reach = upper + lower;
    // A common compliant pelvis gives both knees the same soft support.
    // Small positive bend reserve prevents either knee snapping fully straight.
    let needed: [f64; 2] = std::array::from_fn(|i| {
        let dx = ankles[i][0] - hips[i][0];
        hips[i][1] - ankles[i][1] - (reach * reach - dx * dx).max(0.01).sqrt() + 0.024
    });
    let shared =
        (needed[0] + needed[1] + ((needed[0] - needed[1]).powi(2) + 0.000016).sqrt()) * 0.5;
    let drop = (shared + (shared * shared + 0.000016).sqrt()) * 0.5;
    let hips = hips.map(|[x, y, z]| [x, y - drop, z]);
    let knees = std::array::from_fn(|i| {
        let p = solve_knee(
            (hips[i][0], hips[i][1]),
            (ankles[i][0], ankles[i][1]),
            upper,
            lower,
            -1.,
        );
        local(project([p.0, p.1, hips[i][2]]))
    });
    let body_drop = local(project([s.x, hips[0][1], 0.])).1 - 710.;
    (
        crate::breath_heroine::Pose {
            view: View::Profile,
            feet: Some(feet),
            skeleton: Some(ProjectedSkeleton {
                hips: hips.map(|p| local(project(p))),
                knees,
                body_drop,
            }),
            walk: walking(s.t),
            breath: s.breath,
            time: (walk_time(s.t) - WALK_AT) * 0.92 / STEP,
        },
        origin,
        scale,
    )
}

fn heroine_point(s: State, p: Point) -> Point {
    let (pose, origin, scale) = heroine_pose(s);
    let p = crate::breath_heroine::Rig::new(pose).point(p, 2);
    (origin.0 + p.0 * scale, origin.1 + p.1 * scale)
}
fn shoulder(s: State) -> Point {
    heroine_point(s, (480., 280.))
}
pub(super) fn mouth(s: State) -> Point {
    heroine_point(s, (554., 169.))
}
fn person(out: &mut Vec<Path>, s: State) {
    let k = character_scale(s);
    let base = project([s.x, 0., 0.]);
    let mut shadow = Path::solid(
        ellipse(base.0, base.1 + 1., 0.5 * k, 0.08 * k),
        "url(#bridge-light)",
        "none",
        0.,
    );
    shadow.alpha = 0.64;
    out.push(shadow);
    let (pose, origin, scale) = heroine_pose(s);
    for (i, d) in crate::breath_heroine::paths(pose, origin, scale)
        .into_iter()
        .enumerate()
    {
        let cover = if i % 2 == 0 { Some(d.clone()) } else { None };
        // Every cover is opaque, including the rear leg. Only its ink is muted.
        let ink = if i == 1 { LINE } else { INK };
        out.push(Path::solid(
            d,
            if i % 2 == 0 { COVER } else { ink },
            if i % 2 == 0 { "none" } else { ink },
            0.45,
        ));
        if let Some(d) = cover {
            let mut code = rain_path(
                [
                    [s.x - 0.6, 3.5, 0.],
                    [s.x + 0.6, 3.5, 0.],
                    [s.x + 0.6, 0., 0.],
                    [s.x - 0.6, 0., 0.],
                ],
                0.26,
                [0.23, 1.0],
            );
            code.d = d;
            out.push(code);
        }
    }
    let core = shoulder(s);
    let mut breath = Path::solid(
        ellipse(core.0, core.1, k * 0.21, k * 0.21),
        "url(#bridge-breath)",
        "none",
        0.,
    );
    breath.alpha = 0.15 + s.breath.max(0.) * 0.75;
    out.push(breath);
    marker(out, core, 1.2, LIGHT, 0.72);
    let speaking = (0..7).map(|i| phrase_alpha(i, s.t)).fold(0., f64::max);
    let m = mouth(s);
    let mut lip = Path::solid(
        ellipse(m.0, m.1 + 0.6, 1.2, 0.35 + speaking * 0.9),
        COVER,
        "none",
        0.,
    );
    lip.alpha = speaking;
    out.push(lip);
}
fn cubic(p: [Point; 4], t: f64) -> Point {
    let a = lerp(p[0], p[1], t);
    let b = lerp(p[1], p[2], t);
    let c = lerp(p[2], p[3], t);
    lerp(lerp(a, b, t), lerp(b, c, t), t)
}
fn voice(out: &mut Vec<Path>, s: State) {
    let m = mouth(s);
    for (i, &tile_x) in TILES.iter().enumerate() {
        let at = tile(i, s).at;
        let alpha = bell(s.t, at - 0.20, at + 0.05, at + 0.6, at + 1.28);
        let end = project([tile_x, 0.05, 0.]);
        let curve = [
            (m.0 + 8., m.1),
            (m.0 + 62., m.1 + 8.),
            (end.0 - 42., end.1 - 28.),
            end,
        ];
        let progress = between(s.t, at - 0.15, at + 0.58);
        let points = (0..25)
            .map(|j| cubic(curve, progress * j as f64 / 24.))
            .collect::<Vec<_>>();
        out.push(Path::line(line(&points), INK, 0.8, alpha * 0.46));
        let mut dots = String::new();
        for j in 0..10 {
            let p = (progress - j as f64 * 0.054).clamp(0., 1.);
            let q = cubic(curve, p);
            dots.push_str(&ellipse(
                q.0,
                q.1,
                if j == 0 { 1.7 } else { 0.7 },
                if j == 0 { 1.7 } else { 0.7 },
            ));
        }
        let mut p = Path::solid(dots, INK, "none", 0.);
        p.alpha = alpha * 0.86;
        out.push(p);
    }
    // Final utterances visibly reach the chains, then the door seam.
    for i in 5..7 {
        let at = phrase_at(i);
        let end = portal(0., if i == 5 { 1.98 } else { 2.65 }, -0.05);
        let curve = [m, (m.0 + 24., m.1), (end.0 - 24., end.1), end];
        let progress = between(s.t, at, at + if i == 5 { 0.65 } else { 0.30 });
        let points = (0..25)
            .map(|j| cubic(curve, progress * j as f64 / 24.))
            .collect::<Vec<_>>();
        out.push(Path::line(
            line(&points),
            INK,
            0.8,
            phrase_alpha(i, s.t) * 0.55,
        ));
    }
    let inhale = bell(s.t, 0.7, 1.1, 2.35, 2.85);
    let sh = shoulder(s);
    let k = character_scale(s);
    for side in [-1., 1.] {
        let p = between(s.t, 0.8, 2.55);
        let r = (0.7 - 0.55 * p) * k;
        out.push(Path::line(
            format!(
                "M{:.3} {:.3}Q{:.3} {:.3} {:.3} {:.3}",
                sh.0 + side * r,
                sh.1 - 0.3 * k,
                sh.0 + side * r * 1.2,
                sh.1 + 0.1 * k,
                sh.0 + side * r * 0.35,
                sh.1 + 0.25 * k
            ),
            INK,
            0.8,
            inhale * 0.48,
        ));
    }
}
pub(super) fn dynamic(s: State) -> Vec<Path> {
    let mut out = Vec::with_capacity(150);
    doors(&mut out, s);
    slabs(&mut out, s);
    // Filament and tile assembly are behind the opaque body and its near arm.
    voice(&mut out, s);
    person(&mut out, s);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn surface_rain_tracks_the_object_plane_and_all_solid_scene_parts() {
        let planes = [
            [
                [-4., 0., -2.7],
                [-4., 0., 2.7],
                [-10., 0., 2.7],
                [-10., 0., -2.7],
            ],
            [
                [GATE_X, ROOM_H + 0.14, -ROOM_W],
                [GATE_X, ROOM_H + 0.14, ROOM_W],
                [GATE_X, GATE_H - GATE_CUT, ROOM_W],
                [GATE_X, GATE_H - GATE_CUT, -ROOM_W],
            ],
            [
                [GATE_X, ROOM_H + 0.14, -ROOM_W],
                [GATE_X, ROOM_H + 0.14, ROOM_W],
                [14., ROOM_H + 0.14, ROOM_W],
                [14., ROOM_H + 0.14, -ROOM_W],
            ],
        ];
        for plane in planes {
            let m = rain_map(plane, [0.5, 1.2])
                .split_whitespace()
                .map(|n| n.parse::<f64>().unwrap())
                .collect::<Vec<_>>();
            for (point, expected) in
                plane
                    .into_iter()
                    .zip([(0., 0.), (0.5, 0.), (0.5, 1.2), (0., 1.2)])
            {
                let (x, y) = project(point);
                let w = m[6] * x + m[7] * y + m[8];
                assert!(((m[0] * x + m[1] * y + m[2]) / w - expected.0).abs() < 1e-7);
                assert!(((m[3] * x + m[4] * y + m[5]) / w - expected.1).abs() < 1e-7);
            }
        }
        let xml = environment() + &foreground();
        for name in [
            "near-front",
            "near-fascia",
            "far-fascia",
            "far-end",
            "near-floor",
            "far-floor",
            "entrance-far",
            "entrance-near",
            "entrance-lintel",
            "reveal-far",
            "reveal-near",
            "reveal-top",
            "ceiling",
            "room-back",
            "room-near",
        ] {
            assert!(
                xml.contains(&format!("bridge-surface-{name}")),
                "missing surface {name}"
            );
        }
        let a = dynamic(state(7., false));
        let b = dynamic(state(8., false));
        assert_eq!(a.iter().filter(|p| p.matrix_uv.is_some()).count(), 15);
        assert!(a
            .iter()
            .zip(b)
            .any(|(p, q)| p.matrix_uv.is_some() && p.matrix_uv != q.matrix_uv));
    }

    #[test]
    fn profile_route_crosses_the_gate_instead_of_following_its_face() {
        let start = project([-4.5, 0., 0.]);
        let threshold = portal(0., 0., 0.);
        let exit = portal(0., 0., 1.55);
        assert_eq!(start.1, threshold.1);
        assert_eq!(threshold.1, exit.1);
        assert!(start.0 < threshold.0 && threshold.0 < exit.0);
        // Every point on the entrance is in the same plane X=GATE_X.
        for u in [-1.6, 0., 1.6] {
            for y in [0.07, 2., 3.99] {
                let p = unproject_at_z(portal(u, y, 0.), u);
                assert!((p[0] - GATE_X).abs() < 1e-9);
                assert!((p[1] - y).abs() < 1e-9);
            }
        }
        let finish = state(WALK_END, false);
        assert!(finish.x > GATE_X);
        assert!(finish.feet.iter().all(|f| f.x > GATE_X));
        let xml = environment();
        assert!(!xml.contains("bridge-laboratory-rain-gallery"));
        assert!(foreground().contains("bridge-near-casing"));
    }

    #[test]
    fn final_walk_is_fully_behind_the_opaque_near_wall() {
        let s = state(WALK_END, false);
        let wall_left = project([GATE_X, 0., ROOM_W]).0;
        // Conservative whole-body envelope includes the trailing foot, hand,
        // head and shadow, not merely the root centre behind the jamb.
        let left = project([s.feet[0].x.min(s.feet[1].x) - 0.5, 0., -0.12]).0;
        let right = project([s.x + 0.7, 0., 0.12]).0;
        assert!(left > wall_left + 8., "trailing contour remains visible");
        assert!(right < project([14., 0., ROOM_W]).0);
        assert!(s.reset > 0.99, "wall must hide the heroine before reset");
        let xml = svg();
        assert!(xml.find("bridge-near-casing").unwrap() > xml.find("bridge-story").unwrap());
        assert!(foreground().contains("bridge-surface-room-near"));
    }

    fn rendered_foot(s: State, index: usize, source: Point) -> Point {
        let (pose, origin, scale) = heroine_pose(s);
        let p = crate::breath_heroine::Rig::new(pose).point(source, 1 - index);
        (origin.0 + p.0 * scale, origin.1 + p.1 * scale)
    }

    #[test]
    fn projected_leg_lengths_are_constant_in_world_space() {
        for n in 0..(RESET_AT * 100.) as usize {
            let (pose, origin, scale) = heroine_pose(state(n as f64 / 100., false));
            let skeleton = pose.skeleton.unwrap();
            for (i, foot) in pose.feet.unwrap().iter().enumerate() {
                let restore = |p: Point| {
                    unproject_at_z(
                        (origin.0 + p.0 * scale, origin.1 + p.1 * scale),
                        if i == 0 { LEG_Z } else { -LEG_Z },
                    )
                };
                let [hip, knee, ankle] =
                    [skeleton.hips[i], skeleton.knees[i], foot.ankle].map(restore);
                let thigh = (hip[0] - knee[0]).hypot(hip[1] - knee[1]);
                let shin = (ankle[0] - knee[0]).hypot(ankle[1] - knee[1]);
                assert!(
                    (thigh - 0.80).abs() < 1e-6,
                    "thigh stretches at {}",
                    n as f64 / 100.
                );
                assert!(
                    (shin - 0.82).abs() < 1e-6,
                    "shin stretches at {}",
                    n as f64 / 100.
                );
            }
        }
    }

    #[test]
    fn both_knees_share_the_same_soft_stance_and_swing() {
        let joints = |t: f64, leg: usize| {
            let (pose, origin, scale) = heroine_pose(state(t, false));
            let skeleton = pose.skeleton.unwrap();
            [
                skeleton.hips[leg],
                skeleton.knees[leg],
                pose.feet.unwrap()[leg].ankle,
            ]
            .map(|p| {
                unproject_at_z(
                    (origin.0 + p.0 * scale, origin.1 + p.1 * scale),
                    if leg == 0 { LEG_Z } else { -LEG_Z },
                )
            })
        };
        let mut min_bend: f64 = 180.;
        let mut max_bend: f64 = 0.;
        for n in 0..136 {
            let t = WALK_AT + 4. * STEP + n as f64 * 0.01;
            let a = joints(t, 0);
            let b = joints(t + STEP, 1);
            for i in 0..3 {
                // Same joint trajectory one step later, translated along X.
                assert!(
                    (b[i][0] - a[i][0] - 1.9 / 3.).abs() < 0.0002,
                    "joint {i} t={t} a={a:?} b={b:?}"
                );
                assert!(
                    (b[i][1] - a[i][1]).abs() < 0.0002,
                    "joint {i} t={t} a={a:?} b={b:?}"
                );
            }
            let u = (a[0][0] - a[1][0], a[0][1] - a[1][1]);
            let v = (a[2][0] - a[1][0], a[2][1] - a[1][1]);
            let bend = 180.
                - ((u.0 * v.0 + u.1 * v.1) / (0.80 * 0.82))
                    .clamp(-1., 1.)
                    .acos()
                    .to_degrees();
            min_bend = min_bend.min(bend);
            max_bend = max_bend.max(bend);
        }
        assert!(
            min_bend > 15.,
            "a supporting knee locks straight: {min_bend}"
        );
        assert!(
            max_bend > 40.,
            "the swinging knee needs to flex: {max_bend}"
        );
    }

    #[test]
    fn actual_rendered_contact_is_stationary_through_start_walk_and_arrival() {
        use crate::breath_heroine::{HEELS, SOLES, TOES};
        let dt = 1. / 240.;
        let mut contacts = 0;
        for n in 1..(RESET_AT / dt) as usize {
            let a = state(n as f64 * dt, false);
            let b = state((n + 1) as f64 * dt, false);
            for i in 0..2 {
                let f = a.feet[i];
                let g = b.feet[i];
                if f.lift > 1e-10 || g.lift > 1e-10 || (f.x - g.x).abs() > 1e-10 {
                    continue;
                }
                let source = if f.roll == 0. && g.roll == 0. {
                    SOLES[0]
                } else if f.toe_pivot == 1. && g.toe_pivot == 1. {
                    TOES[0]
                } else if f.toe_pivot == 0. && g.toe_pivot == 0. {
                    HEELS[0]
                } else {
                    continue;
                };
                let p = rendered_foot(a, i, source);
                let q = rendered_foot(b, i, source);
                assert!(
                    (p.0 - q.0).hypot(p.1 - q.1) < 1e-7,
                    "foot {i} slips at {}: {p:?} -> {q:?}",
                    a.t
                );
                contacts += 1;
            }
        }
        assert!(
            contacts > 5000,
            "must check stance, heel strike, toe off and arrival"
        );
    }
}
