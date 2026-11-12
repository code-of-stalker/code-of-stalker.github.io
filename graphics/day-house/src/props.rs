//! The things that move: the tram (its own cell) and everything else that
//! changes place in a frame (the lift's cage, his chairs, the kettle and
//! her spoon, the cups, the bags of bread, the coin, the phone, the
//! neighbours' tools).
use crate::act::{World, BB_Y, CRANK_LEN, GRIP, PEDAL_OUT, SADDLE, TRAM_GONE, WHEEL_R};
use crate::cast::{
    lid_pitch, Held, KETTLE_GRIP, LID_HINGE, LID_LONG, SPOUT, STRAPS, STRAP_Y, STRAP_Z,
};
use crate::house::{
    ball, chair, cube, cyl, flag, kind, mat, slab, tube, Prim, CAGE, CAGE_H, TRACK_Z,
};
use crate::math::{v3, V3};
use std::f32::consts::{FRAC_PI_2, PI};

/// The tunnels' mouths: past this the tram is inside, out of sight.
const TUNNEL: f32 = 15.95;

/// `p` cut off at the tunnels: an upright box is trimmed, anything else
/// goes whole once its middle is inside.
fn clip(p: Prim) -> Option<Prim> {
    if p.kind == kind::BOX && p.yaw == 0.0 && p.pitch == 0.0 {
        let lo = (p.c.x - p.h.x).max(-TUNNEL);
        let hi = (p.c.x + p.h.x).min(TUNNEL);
        if hi <= lo {
            return None;
        }
        let mut q = p;
        q.c.x = 0.5 * (lo + hi);
        q.h.x = 0.5 * (hi - lo);
        return Some(q);
    }
    (p.c.x.abs() < TUNNEL).then_some(p)
}

/// The tram at its place `c` along the street, its doors `doors` open.
pub fn tram(c: f32, doors: f32) -> Vec<Prim> {
    let mut out = Vec::new();
    if c.abs() > TRAM_GONE {
        return out;
    }
    let z = TRACK_Z;
    let near = z + 1.08;
    let far = z - 1.08;
    let floor = 0.22;
    let paint = |c: V3, h: V3| cube(mat::TRAM, c, h).tone(0.55);
    out.push(cube(mat::DARK, v3(c, 0.16, z), v3(4.6, 0.06, 1.1)));
    for dx in [-2.8f32, 2.8] {
        out.push(cube(mat::DARK, v3(c + dx, 0.06, z), v3(0.75, 0.06, 0.7)));
    }
    out.push(cube(mat::TRAM, v3(c, 2.62, z), v3(4.7, 0.08, 1.16)).tone(0.85));
    // The far side: a wall to the waist, the windows' pillars, the band.
    out.push(paint(v3(c, 0.64, far), v3(4.6, 0.42, 0.03)));
    out.push(paint(v3(c, 2.42, far), v3(4.6, 0.12, 0.03)));
    for dx in [-4.5f32, -1.5, 1.5, 4.5] {
        out.push(paint(v3(c + dx, 1.68, far), v3(0.05, 0.64, 0.03)));
    }
    // The near side, open above the waist so the riders show; the doors
    // at c ± 2.4 slide apart.
    for (a, b) in [(-4.6f32, -3.0f32), (-1.8, 1.8), (3.0, 4.6)] {
        out.push(paint(
            v3(c + 0.5 * (a + b), 0.64, near),
            v3(0.5 * (b - a), 0.42, 0.03),
        ));
    }
    out.push(paint(v3(c, 2.42, near), v3(4.6, 0.12, 0.03)));
    for dx in [-4.5f32, -3.0, -1.8, 1.8, 3.0, 4.5] {
        out.push(paint(v3(c + dx, 1.68, near), v3(0.04, 0.64, 0.03)));
    }
    let slide = 0.55 * doors;
    for door in [-2.4f32, 2.4] {
        for s in [-1.0f32, 1.0] {
            out.push(
                cube(
                    mat::TRAM,
                    v3(c + door + s * (0.3 + slide), 0.64, near + 0.04),
                    v3(0.29, 0.42, 0.02),
                )
                .tone(0.3),
            );
        }
    }
    // Its ends, the headlights ahead, the driver's seat and desk.
    for s in [-1.0f32, 1.0] {
        out.push(paint(v3(c + s * 4.65, 1.42, z), v3(0.06, 1.2, 1.12)));
    }
    for dz in [-0.7f32, 0.7] {
        out.push(
            ball(mat::LAMP, v3(c + 4.72, 0.78, z + dz), v3(0.06, 0.08, 0.08)).flags(flag::GLOSS),
        );
    }
    out.push(
        cube(
            mat::FABRIC,
            v3(c + 3.28, floor + 0.46, z),
            v3(0.2, 0.04, 0.2),
        )
        .tone(0.2),
    );
    out.push(
        cube(
            mat::METAL,
            v3(c + 4.3, floor + 0.85, z),
            v3(0.14, 0.06, 0.4),
        )
        .tone(0.2),
    );
    // A bench along the far side.
    out.push(
        cube(
            mat::FABRIC,
            v3(c - 0.4, floor + 0.44, far + 0.3),
            v3(1.2, 0.04, 0.22),
        )
        .tone(0.35),
    );
    // The pantograph up to the wire.
    let base = v3(c - 0.3, 2.7, z);
    let knee = v3(c + 0.35, 3.9, z);
    out.push(tube(mat::METAL, base, knee, 0.02).tone(0.2));
    out.push(tube(mat::METAL, knee, v3(c - 0.1, 5.16, z), 0.02).tone(0.2));
    out.push(cube(mat::METAL, v3(c - 0.1, 5.17, z), v3(0.03, 0.012, 0.45)).tone(0.2));
    // The rail under the roof and the straps hanging from it.
    out.push(cube(mat::METAL, v3(c - 0.4, 2.5, STRAP_Z), v3(3.6, 0.012, 0.012)).tone(0.6));
    for dx in STRAPS {
        let x = c + dx;
        let r = 0.06;
        out.push(
            cube(
                mat::FABRIC,
                v3(x, 0.5 * (2.5 + STRAP_Y + r), STRAP_Z),
                v3(0.015, 0.5 * (2.5 - STRAP_Y - r), 0.004),
            )
            .tone(0.15),
        );
        out.push(
            Prim::new(
                kind::TORUS,
                mat::DARK,
                v3(x, STRAP_Y, STRAP_Z),
                v3(r, r, 0.012),
            )
            .ab(0.009, 0.0)
            .tone(0.6),
        );
    }
    out.into_iter().filter_map(clip).collect()
}

/// Everything else that moves this frame.
pub fn movers(s: f32, world: &World, held: &Held) -> Vec<Prim> {
    let mut out = Vec::new();
    // The lift's cage: its floor and roof, its back and far walls, the
    // front posts; it opens to the stairwell's landing (+x).
    let ly = world.lift_y(s);
    let [x0, x1, z0, z1] = CAGE;
    out.push(slab(mat::METAL, v3(x0, ly - 0.08, z0), v3(x1, ly, z1)).tone(0.25));
    out.push(
        slab(
            mat::METAL,
            v3(x0, ly + CAGE_H, z0),
            v3(x1, ly + CAGE_H + 0.06, z1),
        )
        .tone(0.25),
    );
    out.push(slab(mat::WOOD, v3(x0, ly, z0), v3(x0 + 0.04, ly + CAGE_H, z1)).tone(0.4));
    out.push(slab(mat::WOOD, v3(x0, ly, z0), v3(x1, ly + CAGE_H, z0 + 0.04)).tone(0.4));
    for z in [z0, z1] {
        out.push(
            slab(
                mat::BRASS,
                v3(x1 - 0.04, ly, z - 0.02),
                v3(x1, ly + CAGE_H, z + 0.02),
            )
            .flags(flag::GLOSS),
        );
    }
    out.push(cube(
        mat::LAMP,
        v3(0.5 * (x0 + x1), ly + CAGE_H - 0.04, 0.5 * (z0 + z1)),
        v3(0.18, 0.02, 0.18),
    ));

    // His kitchen chair, pushed back as he stands; his desk chair.
    chair(&mut out, held.chair, -FRAC_PI_2, 0.5);
    chair(&mut out, v3(3.9, 12.0, -3.42), 0.0, 0.15);

    // The kettle (tipped as she pours, its tea running into his cup), her
    // spoon, his cup, the child's cup.
    let frame = Prim::new(kind::BALL, mat::CERAMIC, held.kettle, v3(0.1, 0.075, 0.09))
        .yaw(held.kettle_yaw)
        .pitch(held.kettle_tilt);
    let [ax, ay, az] = frame.axes();
    let at = |x: f32, y: f32, z: f32| held.kettle + ax * x + ay * y + az * z;
    out.push(frame.flags(flag::GLOSS).tone(0.85));
    let tip = at(0.0, SPOUT[0], SPOUT[1]);
    out.push(tube(mat::CERAMIC, at(0.0, 0.0, 0.07), tip, 0.013).tone(0.85));
    out.push(
        cyl(mat::CERAMIC, at(0.0, 0.075, 0.0), 0.035, 0.012)
            .yaw(held.kettle_yaw)
            .pitch(held.kettle_tilt)
            .tone(0.7),
    );
    let bail = [
        at(0.0, 0.065, -0.07),
        at(0.0, KETTLE_GRIP, -0.04),
        at(0.0, KETTLE_GRIP, 0.04),
        at(0.0, 0.065, 0.07),
    ];
    for w in bail.windows(2) {
        out.push(tube(mat::DARK, w[0], w[1], 0.007).tone(0.4));
    }
    if held.kettle_tilt > 0.7 {
        out.push(tube(mat::CERAMIC, tip, held.cup + v3(0.0, 0.07, 0.0), 0.004).tone(0.3));
    }
    let [a, b] = held.spoon;
    out.push(tube(mat::METAL, a, b, 0.006).flags(flag::GLOSS).tone(0.7));
    out.push(
        cyl(mat::CERAMIC, held.cup + v3(0.0, 0.045, 0.0), 0.04, 0.045)
            .yaw(held.cup_yaw)
            .pitch(held.cup_tilt)
            .flags(flag::GLOSS)
            .tone(0.9),
    );
    out.push(
        Prim::new(
            kind::CYL,
            mat::TOY,
            held.kid_cup + v3(0.0, 0.04, 0.0),
            v3(0.036, 0.04, 0.036),
        )
        .pitch(held.kid_cup_spin)
        .tone(0.2),
    );
    // The bags of bread, each with a loaf looking out of it.
    for (bag, yaw) in [(held.bag, held.bag_yaw), (held.bag2, held.bag2_yaw)] {
        if bag.y < -30.0 {
            continue;
        }
        let paper = cube(mat::PAPER, bag + v3(0.0, 0.14, 0.0), v3(0.09, 0.14, 0.06)).yaw(yaw);
        let [side, _, _] = paper.axes();
        out.push(paper.tone(0.75));
        out.push(
            ball(
                mat::BREAD,
                bag + side * 0.04 + v3(0.0, 0.3, 0.0),
                v3(0.045, 0.13, 0.04),
            )
            .yaw(yaw),
        );
    }
    // The coin, his phone.
    if held.coin.y > -30.0 {
        out.push(
            cyl(mat::BRASS, held.coin, 0.022, 0.004)
                .tone(0.9)
                .flags(flag::GLOSS),
        );
    }
    out.push(
        cube(
            mat::SCREEN,
            held.phone + v3(0.0, 0.006, 0.0),
            v3(0.035, 0.005, 0.072),
        )
        .yaw(held.phone_yaw)
        .pitch(held.phone_tilt)
        .tone(0.4),
    );
    // His laptop's lid on its hinge: its face glows toward him (tone above
    // a half tells it from his phone).
    let pitch = lid_pitch(held.lid);
    let (sp, cp) = pitch.sin_cos();
    out.push(
        cube(
            mat::SCREEN,
            LID_HINGE + v3(0.0, cp, sp) * (0.5 * LID_LONG) + v3(0.0, -sp, cp) * 0.006,
            v3(0.2, 0.5 * LID_LONG, 0.006),
        )
        .pitch(pitch)
        .tone(0.6),
    );
    // The gardener's can, the painter's brush, the cellist's bow, the
    // mechanic's wrench.
    let (sc, cc) = held.can_tilt.sin_cos();
    out.push(cyl(mat::METAL, held.can, 0.09, 0.1).tone(0.55));
    out.push(
        tube(
            mat::METAL,
            held.can + v3(0.06, 0.0, 0.05),
            held.can + v3(0.0, 0.1 * cc - 0.14 * sc, 0.2 * cc + 0.05 * sc),
            0.012,
        )
        .tone(0.55),
    );
    let [a, b] = held.brush;
    out.push(tube(mat::WOOD, a, b, 0.008).tone(0.7));
    let [a, b] = held.bow;
    out.push(tube(mat::WOOD, a, b, 0.006).tone(0.15));
    let [a, b] = held.wrench;
    out.push(tube(mat::METAL, a, b, 0.012).tone(0.6));
    bicycle(&mut out, s, world);
    out
}

/// His bicycle at `s`: leaned on the lamp's post, under him in the evening,
/// on the post again at night. Rear to front, so its groups stay
/// small.
fn bicycle(out: &mut Vec<Prim>, s: f32, world: &World) {
    let b = &world.bike;
    let roll = b.roll(s);
    let at = |f: f32, u: f32, r: f32| b.at(s, f, u, r);
    let mut parts = Vec::new();
    let frame = |a: V3, c: V3| tube(mat::TRAM, a, c, 0.017).flags(flag::GLOSS).tone(0.45);
    let steel = |a: V3, c: V3, r: f32| tube(mat::METAL, a, c, r).flags(flag::GLOSS).tone(0.6);
    let rear = [-0.42f32, WHEEL_R];
    let front = [0.64f32, WHEEL_R];
    let bb = [0.0f32, BB_Y];
    let wheel = |parts: &mut Vec<Prim>, axle: [f32; 2], turn: f32| {
        parts.push(
            Prim::new(
                kind::TORUS,
                mat::DARK,
                at(axle[0], axle[1], 0.0),
                v3(WHEEL_R, WHEEL_R, 0.025),
            )
            .ab(0.021, 0.0)
            .pitch(roll),
        );
        for i in 0..3 {
            let a = turn + i as f32 * PI / 3.0;
            let (sa, ca) = a.sin_cos();
            let reach = WHEEL_R - 0.03;
            parts.push(
                tube(
                    mat::METAL,
                    at(axle[0] + reach * sa, axle[1] + reach * ca, 0.0),
                    at(axle[0] - reach * sa, axle[1] - reach * ca, 0.0),
                    0.004,
                )
                .tone(0.5),
            );
        }
    };
    let turn = b.wheel(s);
    // The rear wheel, the carrier over it, the stays, the chain's guard.
    wheel(&mut parts, rear, turn);
    parts.push(
        cube(mat::METAL, at(-0.38, 0.72, 0.0), v3(0.17, 0.008, 0.07))
            .pitch(roll)
            .tone(0.35),
    );
    parts.push(frame(at(-0.15, 0.76, 0.0), at(rear[0], rear[1], 0.0)));
    parts.push(frame(at(bb[0], bb[1], 0.0), at(rear[0], rear[1], 0.0)));
    parts.push(
        cube(mat::DARK, at(-0.19, 0.32, 0.06), v3(0.25, 0.04, 0.006))
            .pitch(roll)
            .tone(0.5),
    );
    // The seat tube, its post, the saddle; the chainring, cranks, pedals.
    parts.push(frame(at(bb[0], bb[1], 0.0), at(-0.16, 0.8, 0.0)));
    parts.push(steel(at(-0.16, 0.8, 0.0), at(-0.19, 0.89, 0.0), 0.011));
    parts.push(
        ball(mat::FABRIC, at(SADDLE[0], 0.92, 0.0), v3(0.12, 0.035, 0.07))
            .pitch(roll)
            .tone(0.12),
    );
    parts.push(
        Prim::new(
            kind::TORUS,
            mat::METAL,
            at(bb[0], bb[1], 0.05),
            v3(0.09, 0.09, 0.01),
        )
        .ab(0.008, 0.0)
        .pitch(roll)
        .flags(flag::GLOSS)
        .tone(0.6),
    );
    let crank = b.crank(s);
    for (side, a, r) in [(0usize, crank + PI, -PEDAL_OUT), (1, crank, PEDAL_OUT)] {
        let end = [CRANK_LEN * a.sin(), BB_Y + CRANK_LEN * a.cos()];
        parts.push(steel(
            at(bb[0], bb[1], 0.6 * r),
            at(end[0], end[1], 0.6 * r),
            0.009,
        ));
        parts.push(
            cube(mat::DARK, b.pedal(s, side), v3(0.045, 0.01, 0.04))
                .pitch(roll)
                .tone(0.3),
        );
    }
    // The top and down tubes, the head tube, the fork, stem and bars.
    parts.push(frame(at(0.5, 0.8, 0.0), at(-0.15, 0.76, 0.0)));
    parts.push(frame(at(0.53, 0.76, 0.0), at(bb[0], bb[1], 0.0)));
    parts.push(frame(at(0.5, 0.92, 0.0), at(0.55, 0.72, 0.0)));
    parts.push(frame(at(0.55, 0.72, 0.0), at(front[0], front[1], 0.0)));
    parts.push(steel(at(0.5, 0.92, 0.0), at(0.49, 1.03, 0.0), 0.012));
    for side in [-1.0f32, 1.0] {
        parts.push(steel(
            at(0.49, 1.04, 0.0),
            at(GRIP[0], GRIP[1], side * GRIP[2]),
            0.011,
        ));
    }
    // The front wheel and its lamp on the head tube.
    wheel(&mut parts, front, turn);
    let lit = b.lit(s) > 0.5;
    parts.push(ball(
        if lit { mat::LAMP } else { mat::METAL },
        at(0.58, 0.86, 0.0),
        v3(0.03, 0.03, 0.03),
    ));
    out.extend(parts.into_iter().filter(|p| p.c.x.abs() <= 15.5));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_tram_leaves_the_street_empty_when_gone() {
        assert!(tram(30.0, 0.0).is_empty());
        assert!(tram(0.0, 1.0).len() < 50);
        // Half into the tunnel, only the half outside shows.
        let half = tram(TUNNEL, 0.0);
        assert!(half.iter().all(|p| p.c.x < TUNNEL + 0.01));
        assert!(half.len() > 5);
    }
}
