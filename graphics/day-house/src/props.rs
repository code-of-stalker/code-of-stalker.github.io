//! The things that move: the tram (its own cell) and everything else that
//! changes place in a frame (the lift's cage, his chairs, the teapot, the
//! cups, the loaf, the coin, the phone, the neighbours' tools).
use crate::act::{World, TRAM_GONE};
use crate::cast::Held;
use crate::house::{ball, chair, cube, cyl, flag, kind, mat, slab, tube, Prim, CAGE, CAGE_H, TRACK_Z};
use crate::math::{v3, V3};
use std::f32::consts::FRAC_PI_2;

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
        out.push(paint(v3(c + 0.5 * (a + b), 0.64, near), v3(0.5 * (b - a), 0.42, 0.03)));
    }
    out.push(paint(v3(c, 2.42, near), v3(4.6, 0.12, 0.03)));
    for dx in [-4.5f32, -3.0, -1.8, 1.8, 3.0, 4.5] {
        out.push(paint(v3(c + dx, 1.68, near), v3(0.04, 0.64, 0.03)));
    }
    let slide = 0.55 * doors;
    for door in [-2.4f32, 2.4] {
        for s in [-1.0f32, 1.0] {
            out.push(
                cube(mat::TRAM, v3(c + door + s * (0.3 + slide), 0.64, near + 0.04), v3(0.29, 0.42, 0.02)).tone(0.3),
            );
        }
    }
    // Its ends, the headlights ahead, the driver's seat and desk.
    for s in [-1.0f32, 1.0] {
        out.push(paint(v3(c + s * 4.65, 1.42, z), v3(0.06, 1.2, 1.12)));
    }
    for dz in [-0.7f32, 0.7] {
        out.push(ball(mat::LAMP, v3(c + 4.72, 0.78, z + dz), v3(0.06, 0.08, 0.08)).flags(flag::GLOSS));
    }
    out.push(cube(mat::FABRIC, v3(c + 3.28, floor + 0.46, z), v3(0.2, 0.04, 0.2)).tone(0.2));
    out.push(cube(mat::METAL, v3(c + 4.3, floor + 0.85, z), v3(0.14, 0.06, 0.4)).tone(0.2));
    // A bench along the far side.
    out.push(cube(mat::FABRIC, v3(c - 0.4, floor + 0.44, far + 0.3), v3(1.2, 0.04, 0.22)).tone(0.35));
    // The pantograph up to the wire.
    let base = v3(c - 0.3, 2.7, z);
    let knee = v3(c + 0.35, 3.9, z);
    out.push(tube(mat::METAL, base, knee, 0.02).tone(0.2));
    out.push(tube(mat::METAL, knee, v3(c - 0.1, 5.16, z), 0.02).tone(0.2));
    out.push(cube(mat::METAL, v3(c - 0.1, 5.17, z), v3(0.03, 0.012, 0.45)).tone(0.2));
    out
}

/// Everything else that moves this frame.
pub fn movers(s: f32, world: &World, held: &Held) -> Vec<Prim> {
    let mut out = Vec::new();
    // The lift's cage: its floor and roof, its back and far walls, the
    // front posts; it opens to the stairwell's landing (+x).
    let ly = world.lift_y(s);
    let [x0, x1, z0, z1] = CAGE;
    out.push(slab(mat::METAL, v3(x0, ly - 0.08, z0), v3(x1, ly, z1)).tone(0.25));
    out.push(slab(mat::METAL, v3(x0, ly + CAGE_H, z0), v3(x1, ly + CAGE_H + 0.06, z1)).tone(0.25));
    out.push(slab(mat::WOOD, v3(x0, ly, z0), v3(x0 + 0.04, ly + CAGE_H, z1)).tone(0.4));
    out.push(slab(mat::WOOD, v3(x0, ly, z0), v3(x1, ly + CAGE_H, z0 + 0.04)).tone(0.4));
    for z in [z0, z1] {
        out.push(slab(mat::BRASS, v3(x1 - 0.04, ly, z - 0.02), v3(x1, ly + CAGE_H, z + 0.02)).flags(flag::GLOSS));
    }
    out.push(cube(mat::LAMP, v3(0.5 * (x0 + x1), ly + CAGE_H - 0.04, 0.5 * (z0 + z1)), v3(0.18, 0.02, 0.18)));

    // His kitchen chair, pushed back as he stands; his desk chair.
    chair(&mut out, held.chair, -FRAC_PI_2, 0.5);
    chair(&mut out, v3(3.9, 12.0, -3.42), 0.0, 0.15);

    // The teapot (tipped as she pours), his cup, the child's cup.
    let t = held.teapot;
    let (st, ct) = held.teapot_tilt.sin_cos();
    out.push(ball(mat::CERAMIC, t, v3(0.1, 0.075, 0.09)).flags(flag::GLOSS).tone(0.85));
    let spout = v3(0.0, 0.03 * ct + 0.11 * st, 0.11 * ct - 0.03 * st);
    out.push(tube(mat::CERAMIC, t + v3(0.0, 0.01, 0.06), t + spout + v3(0.0, 0.04, 0.0), 0.014).tone(0.85));
    out.push(cyl(mat::CERAMIC, t + v3(0.0, 0.08 * ct, -0.08 * st), 0.035, 0.015).tone(0.85));
    out.push(cyl(mat::CERAMIC, held.cup + v3(0.0, 0.045, 0.0), 0.04, 0.045).flags(flag::GLOSS).tone(0.9));
    out.push(
        Prim::new(kind::CYL, mat::TOY, held.kid_cup + v3(0.0, 0.04, 0.0), v3(0.036, 0.04, 0.036))
            .pitch(held.kid_cup_spin)
            .tone(0.2),
    );
    // The loaf, the coin, his phone.
    out.push(ball(mat::BREAD, held.loaf + v3(0.0, 0.06, 0.0), v3(0.16, 0.065, 0.075)).yaw(0.3));
    out.push(cyl(mat::BRASS, held.coin, 0.022, 0.004).flags(flag::GLOSS));
    out.push(cube(mat::SCREEN, held.phone + v3(0.0, 0.006, 0.0), v3(0.035, 0.005, 0.072)).tone(0.4));
    // The gardener's can, the painter's brush, the cellist's bow, the
    // mechanic's wrench.
    let (sc, cc) = held.can_tilt.sin_cos();
    out.push(cyl(mat::METAL, held.can, 0.09, 0.1).tone(0.55));
    out.push(tube(mat::METAL, held.can + v3(0.06, 0.0, 0.05), held.can + v3(0.0, 0.1 * cc - 0.14 * sc, 0.2 * cc + 0.05 * sc), 0.012).tone(0.55));
    let [a, b] = held.brush;
    out.push(tube(mat::WOOD, a, b, 0.008).tone(0.7));
    let [a, b] = held.bow;
    out.push(tube(mat::WOOD, a, b, 0.006).tone(0.15));
    let [a, b] = held.wrench;
    out.push(tube(mat::METAL, a, b, 0.012).tone(0.6));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_tram_leaves_the_street_empty_when_gone() {
        assert!(tram(30.0, 0.0).is_empty());
        assert!(tram(0.0, 1.0).len() < 40);
    }
}
