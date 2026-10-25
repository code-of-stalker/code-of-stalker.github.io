//! Traced approved artwork and a length-preserving joint rig. No invented body.
use super::{ease, lerp, Shape, State, P};
use std::{fmt::Write, sync::LazyLock};
const ART: &str = include_str!("../assets/unseal-reference.svg");
const SHOULDERS: [P; 2] = [(1230., 294.), (1305., 297.)];
const ELBOWS: [P; 2] = [(1204., 398.), (1331., 405.)];
const WRISTS: [P; 2] = [(1162., 501.), (1375., 504.)];
const HIPS: [P; 2] = [(1255., 515.), (1300., 515.)];
const KNEES: [P; 2] = [(1238., 675.), (1302., 677.)];
const ANKLES: [P; 2] = [(1198., 812.), (1294., 812.)];
const SCALE: f64 = 0.59;
fn length(a: P, b: P) -> f64 {
    (a.0 - b.0).hypot(a.1 - b.1)
}
fn angle(a: P, b: P) -> f64 {
    (b.1 - a.1).atan2(b.0 - a.0)
}
fn rotate(p: P, source: P, target: P, angle: f64) -> P {
    let (sn, cs) = angle.sin_cos();
    let x = p.0 - source.0;
    let y = p.1 - source.1;
    (target.0 + x * cs - y * sn, target.1 + x * sn + y * cs)
}
fn endpoint(a: P, len: f64, angle: f64) -> P {
    (a.0 + len * angle.cos(), a.1 + len * angle.sin())
}
fn bone(p: P, a: P, b: P, c: P, d: P) -> P {
    rotate(p, a, c, angle(c, d) - angle(a, b))
}
struct Outline {
    loops: Vec<Vec<P>>,
}
static OUTLINES: LazyLock<Vec<Outline>> = LazyLock::new(|| {
    let doc = roxmltree::Document::parse(ART).expect("approved unseal contour");
    doc.descendants()
        .filter(|n| n.has_tag_name("path"))
        .map(|n| {
            let mut loops: Vec<Vec<P>> = vec![];
            for command in svgtypes::PathParser::from(n.attribute("d").expect("outline")) {
                match command.expect("valid trace") {
                    svgtypes::PathSegment::MoveTo { abs: true, x, y } => loops.push(vec![(x, y)]),
                    svgtypes::PathSegment::LineTo { abs: true, x, y } => {
                        loops.last_mut().unwrap().push((x, y))
                    }
                    svgtypes::PathSegment::ClosePath { .. } => (),
                    _ => unreachable!("polygon trace"),
                }
            }
            Outline { loops }
        })
        .collect()
});
struct Rig {
    s: State,
    shoulders: [P; 2],
    elbows: [P; 2],
    wrists: [P; 2],
    hips: [P; 2],
    knees: [P; 2],
}
impl Rig {
    fn new(s: State) -> Self {
        let mut rig = Self {
            s,
            shoulders: SHOULDERS,
            elbows: ELBOWS,
            wrists: WRISTS,
            hips: HIPS,
            knees: KNEES,
        };
        let h = 1. - s.release;
        for i in 0..2 {
            rig.shoulders[i] = rig.trunk(SHOULDERS[i]);
            let rest_upper = angle(SHOULDERS[i], ELBOWS[i]);
            let folded_upper = if i == 0 { 1.45 } else { 1.85 };
            let upper = rest_upper + (folded_upper - rest_upper) * h;
            let rest = angle(ELBOWS[i], WRISTS[i]);
            let folded = if i == 0 { -0.98 } else { -0.85 };
            rig.elbows[i] = endpoint(rig.shoulders[i], length(SHOULDERS[i], ELBOWS[i]), upper);
            rig.wrists[i] = endpoint(
                rig.elbows[i],
                length(ELBOWS[i], WRISTS[i]) * (1. - 0.52 * h),
                rest + (folded - rest) * h,
            );
            rig.hips[i] = rig.trunk(HIPS[i]);
            rig.knees[i] = crate::breath_heroine::solve_knee(
                rig.hips[i],
                ANKLES[i],
                length(HIPS[i], KNEES[i]),
                length(KNEES[i], ANKLES[i]),
                1.,
            );
        }
        // Each wrist reaches the OTHER upper arm. A shared front/back ordering
        // keeps the distant hand visible on the near biceps.
        let contact = 1. - ease(s.release / 0.32);
        let far_biceps = lerp(rig.shoulders[1], rig.elbows[1], 0.44);
        let near_biceps = lerp(rig.shoulders[0], rig.elbows[0], 0.48);
        rig.wrists[0] = lerp(
            rig.wrists[0],
            (far_biceps.0 - 16., far_biceps.1 + 22.),
            contact,
        );
        rig.wrists[1] = lerp(
            rig.wrists[1],
            (near_biceps.0 + 33., near_biceps.1 + 20.),
            contact,
        );
        rig
    }
    fn trunk(&self, p: P) -> P {
        // Open the lower jaw with the syllable, leaving the skull and neck fixed.
        let jaw =
            ease((p.1 - 211.) / 12.) * (1. - ease((p.1 - 239.) / 20.)) * ease((p.0 - 1258.) / 30.);
        let articulation = self.s.speech * (2. + 6. * (self.s.t * 10.5).sin().powi(2));
        let p = (p.0 + jaw * articulation * 0.13, p.1 + jaw * articulation);
        let h = 1. - self.s.release;
        let mut q = rotate(
            p,
            (1274., 515.),
            (1274. - 12. * h, 515. + 32. * h),
            0.27 * h,
        );
        if p.1 < 290. {
            let neck = rotate(
                (1266., 262.),
                (1274., 515.),
                (1274. - 12. * h, 515. + 32. * h),
                0.27 * h,
            );
            let tilted = rotate(q, neck, neck, 0.43 * h);
            q = lerp(q, tilted, ease((290. - p.1) / 42.));
        }
        let breath = (self.s.t * 1.45).sin() * 0.75;
        q.0 += (p.0 - 1274.) / 60. * breath * (1. - ((p.1 - 365.) / 120.).abs()).max(0.);
        q
    }
    fn arm(&self, p: P, i: usize) -> P {
        let upper = bone(
            p,
            SHOULDERS[i],
            ELBOWS[i],
            self.shoulders[i],
            self.elbows[i],
        );
        // Forearms turn across the chest in depth. Hands remain rigid beyond the wrist.
        let h = 1. - self.s.release;
        let mut lower = bone(p, ELBOWS[i], WRISTS[i], self.elbows[i], self.wrists[i]);
        let source_len = length(ELBOWS[i], WRISTS[i]);
        let source_axis = (
            (WRISTS[i].0 - ELBOWS[i].0) / source_len,
            (WRISTS[i].1 - ELBOWS[i].1) / source_len,
        );
        let along = ((p.0 - ELBOWS[i].0) * source_axis.0 + (p.1 - ELBOWS[i].1) * source_axis.1)
            / source_len;
        let a = angle(self.elbows[i], self.wrists[i]);
        let shortening =
            (source_len - length(self.elbows[i], self.wrists[i])) * along.clamp(0., 1.);
        lower.0 -= a.cos() * shortening;
        lower.1 -= a.sin() * shortening;
        let bent = rotate(
            lower,
            self.wrists[i],
            self.wrists[i],
            h * (if i == 0 { -1.4 } else { -1.3 }) * ease(self.s.release / 0.32)
                + (1. - ease(self.s.release / 0.32)) * if i == 0 { -0.5 } else { -1.0 },
        );
        lower = lerp(lower, bent, ease((along - 0.88) / 0.24));
        let articulated = lerp(upper, lower, ease((p.1 - ELBOWS[i].1 + 18.) / 36.));
        lerp(self.trunk(p), articulated, ease((p.1 - 278.) / 48.))
    }
    fn leg(&self, p: P, i: usize) -> P {
        let upper = bone(p, HIPS[i], KNEES[i], self.hips[i], self.knees[i]);
        let lower = bone(p, KNEES[i], ANKLES[i], self.knees[i], ANKLES[i]);
        let p2 = lerp(upper, lower, ease((p.1 - KNEES[i].1 + 20.) / 40.));
        let p2 = lerp(self.trunk(p), p2, ease((p.1 - 485.) / 60.));
        // Rigid planted feet preserve the approved footprint throughout the rise.
        lerp(p2, p, ease((p.1 - 785.) / 45.))
    }
    fn point(&self, p: P, part: usize) -> P {
        let mut q = match part {
            0 => self.arm(p, 1),
            1 => self.leg(p, 1),
            2 => self.leg(p, 0),
            3 => self.trunk(p),
            _ => self.arm(p, 0),
        };
        let h = 1. - self.s.release;
        let distortion = h * h * ease((830. - p.1) / 180.);
        q.0 += distortion
            * (1.25 * (p.1 * 0.046 + self.s.t * 1.2).sin() + 0.45 * (p.1 * 0.12 - self.s.t).sin());
        q
    }
    fn display(&self, p: P) -> P {
        (480. + (p.0 - 1274.) * SCALE, 505. + (p.1 - 860.) * SCALE)
    }
}
pub(super) fn body_shapes(s: State) -> Vec<Shape> {
    let rig = Rig::new(s);
    // Separate upper arms and forearms: the far hand crosses IN FRONT of
    // the near upper arm, rather than vanishing under the entire near limb.
    let layers = if s.release < 0.20 {
        // Hug: the distant palm must lie over the near biceps.
        [
            (2, 0),
            (3, 0),
            (4, 0),
            (5, 0),
            (6, 0),
            (7, 0),
            (0, -1),
            (1, -1),
            (8, -1),
            (9, -1),
            (8, 1),
            (9, 1),
            (0, 1),
            (1, 1),
        ]
    } else {
        // Open arms: paint the COMPLETE distant limb first, then the near limb.
        // Never place the distant forearm over the nearer wrist or palm.
        [
            (2, 0),
            (3, 0),
            (4, 0),
            (5, 0),
            (0, -1),
            (1, -1),
            (0, 1),
            (1, 1),
            (6, 0),
            (7, 0),
            (8, -1),
            (9, -1),
            (8, 1),
            (9, 1),
        ]
    };
    layers
        .into_iter()
        .map(|(i, section)| {
            let outline = &OUTLINES[i];
            let cut = if i < 2 { ELBOWS[1].1 } else { ELBOWS[0].1 };
            let mut d = String::new();
            for ring in &outline.loops {
                let clipped = if section == 0 {
                    ring.clone()
                } else {
                    clip_arm(ring, cut, section > 0)
                };
                if clipped.len() < 3 {
                    continue;
                }
                for (j, &p) in clipped.iter().enumerate() {
                    let p = rig.display(rig.point(p, i / 2));
                    let _ = write!(d, "{}{:.3} {:.3}", if j == 0 { 'M' } else { 'L' }, p.0, p.1);
                }
                d.push('Z');
            }
            Shape {
                d,
                fill: true,
                ink_fill: i % 2 == 1,
                alpha: if i % 2 == 0 {
                    1.
                } else {
                    (0.74 + 0.26 * s.release) * if i < 4 { 0.88 } else { 1. }
                },
                stroke: if i % 2 == 1 { 0.5 } else { 0. },
                width: 0.38,
            }
        })
        .collect()
}
fn clip_arm(ring: &[P], y: f64, lower: bool) -> Vec<P> {
    let inside = |p: P| if lower { p.1 >= y } else { p.1 <= y };
    let mut out = Vec::new();
    if ring.is_empty() {
        return out;
    }
    let mut a = *ring.last().unwrap();
    for &b in ring {
        if inside(a) != inside(b) {
            out.push(lerp(a, b, (y - a.1) / (b.1 - a.1)));
        }
        if inside(b) {
            out.push(b);
        }
        a = b;
    }
    out
}
pub(super) fn mouth(s: State) -> P {
    let r = Rig::new(s);
    r.display(r.point((1308., 218.), 3))
}
pub(super) fn eyes(s: State) -> Shape {
    let r = Rig::new(s);
    // A quiet almond-shaped eye in profile, attached to the head rig.
    // No luminous eyeball: the upper lid carries the expression.
    let points = [
        (1290., 197.),
        (1294., 194.8),
        (1299., 196.8),
        (1295., 199.),
        (1290., 197.),
    ];
    let points: Vec<P> = points.iter().map(|&p| r.display(r.point(p, 3))).collect();
    let mut d = super::curve(&points, false);
    let pupil = r.display(r.point((1295.8, 196.5), 3));
    let _ = write!(d, "M{:.3} {:.3}v1.15", pupil.0, pupil.1 - 0.5);
    Shape::line(d, 0.94, 1.2)
}
pub(super) fn chain_nodes(i: usize, s: State) -> Vec<P> {
    let r = Rig::new(s);
    let points = match i {
        // Over the shoulder, across the chest, behind the opposite hip.
        0 => [
            (1236., 278.),
            (1295., 330.),
            (1328., 417.),
            (1288., 497.),
            (1220., 455.),
            (1208., 355.),
        ]
        .map(|p| r.trunk(p))
        .to_vec(),
        // This loop really follows the folded forearms, not the torso's bounding box.
        1 => {
            let ne = r.elbows[0];
            let nw = r.wrists[0];
            let fe = r.elbows[1];
            let fw = r.wrists[1];
            vec![
                (ne.0 - 14., ne.1),
                (nw.0 + 6., nw.1 - 9.),
                (fw.0 + 12., fw.1 - 7.),
                (fe.0 + 14., fe.1),
                (fe.0 + 6., fe.1 + 13.),
                (fw.0 - 8., fw.1 + 10.),
                (nw.0 - 9., nw.1 + 10.),
                (ne.0 - 10., ne.1 + 12.),
            ]
        }
        2 => [
            (1212., 485.),
            (1270., 472.),
            (1334., 500.),
            (1320., 525.),
            (1250., 530.),
            (1210., 507.),
        ]
        .map(|p| r.trunk(p))
        .to_vec(),
        3 => [
            (1218., 570.),
            (1260., 610.),
            (1320., 660.),
            (1332., 624.),
            (1270., 567.),
            (1212., 551.),
        ]
        .iter()
        .map(|&p| r.leg(p, if p.0 < 1268. { 0 } else { 1 }))
        .collect(),
        4 => [
            (1200., 654.),
            (1240., 677.),
            (1258., 714.),
            (1232., 735.),
            (1200., 706.),
            (1192., 674.),
        ]
        .map(|p| r.leg(p, 0))
        .to_vec(),
        _ => vec![
            (1178., 790.),
            (1202., 806.),
            (1284., 780.),
            (1314., 796.),
            (1306., 828.),
            (1283., 830.),
            (1208., 787.),
            (1178., 812.),
        ],
    };
    points.into_iter().map(|p| r.display(p)).collect()
}
pub(super) fn loop_point(points: &[P], u: f64) -> P {
    let x = u.rem_euclid(1.) * points.len() as f64;
    let i = x.floor() as usize;
    let t = x.fract();
    let n = points.len();
    let p0 = points[(i + n - 1) % n];
    let p1 = points[i % n];
    let p2 = points[(i + 1) % n];
    let p3 = points[(i + 2) % n];
    let f = |a: f64, b: f64, c: f64, d: f64| {
        0.5 * ((2. * b)
            + (-a + c) * t
            + (2. * a - 5. * b + 4. * c - d) * t * t
            + (-a + 3. * b - 3. * c + d) * t * t * t)
    };
    (f(p0.0, p1.0, p2.0, p3.0), f(p0.1, p1.1, p2.1, p3.1))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn approved_contour_is_a_real_trace() {
        assert_eq!(OUTLINES.len(), 10);
        assert!(
            OUTLINES
                .iter()
                .map(|o| o.loops.iter().map(Vec::len).sum::<usize>())
                .sum::<usize>()
                > 2500
        );
        assert!(!ART.contains("<image"));
    }
    #[test]
    fn feet_are_fixed_and_bones_keep_length() {
        for step in 0..21 {
            let s = super::super::state(step as f64, false);
            let r = Rig::new(s);
            for i in 0..2 {
                assert!(length(r.leg(ANKLES[i], i), ANKLES[i]) < 0.02);
                assert!(
                    (length(r.shoulders[i], r.elbows[i]) - length(SHOULDERS[i], ELBOWS[i])).abs()
                        < 0.001
                );
                assert!(length(r.elbows[i], r.wrists[i]) > 25.);
                assert!(length(r.elbows[i], r.wrists[i]) <= length(ELBOWS[i], WRISTS[i]) + 0.001);
            }
        }
    }
    #[test]
    fn initial_hands_stay_on_chest_and_elbows_below_them() {
        let r = Rig::new(super::super::state(1.5, false));
        let neck = r.trunk((1266., 262.));
        for i in 0..2 {
            assert!(r.wrists[i].1 > neck.1 + 65.);
            assert!(r.wrists[i].1 < r.elbows[i].1);
            assert!((r.wrists[i].0 - r.trunk((1274., 390.)).0).abs() < 65.);
        }
    }
    #[test]
    fn each_initial_palm_contacts_the_opposite_upper_arm() {
        let r = Rig::new(super::super::state(1.5, false));
        for (i, palm) in [(0, (1156., 533.)), (1, (1392., 536.))] {
            let p = r.arm(palm, i);
            let a = r.shoulders[1 - i];
            let b = r.elbows[1 - i];
            let ab = (b.0 - a.0, b.1 - a.1);
            let u = (((p.0 - a.0) * ab.0 + (p.1 - a.1) * ab.1) / (ab.0 * ab.0 + ab.1 * ab.1))
                .clamp(0., 1.);
            assert!(length(p, lerp(a, b, u)) < 24., "hand {i}: {p:?}");
        }
    }
    #[test]
    fn rest_preserves_reference_silhouette() {
        let s = State {
            t: 0.,
            release: 1.,
            speech: 0.,
            alpha: 1.,
        };
        let r = Rig::new(s);
        for (i, o) in OUTLINES.iter().enumerate() {
            for ring in &o.loops {
                for &p in ring {
                    assert!(length(p, r.point(p, i / 2)) < 0.01, "part {i} {p:?}");
                }
            }
        }
    }
}
