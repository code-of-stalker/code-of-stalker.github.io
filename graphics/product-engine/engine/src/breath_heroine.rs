//! The approved heroine's traced contours, with a small deterministic 2D rig.
//! Opaque leg layers preserve occlusion; no procedural replacement body shapes.
use std::{fmt::Write, sync::LazyLock};
pub type Point = (f64, f64);
pub const ART: &str = include_str!("../assets/breath-heroine.svg");
pub const HIPS: [Point; 2] = [(545., 710.), (463., 714.)];
pub const KNEES: [Point; 2] = [(541., 1018.), (430., 1030.)];
pub const ANKLES: [Point; 2] = [(535., 1330.), (405., 1348.)];
pub const HEELS: [Point; 2] = [(511., 1381.), (393., 1412.)];
pub const TOES: [Point; 2] = [(639., 1401.), (472., 1425.)];
pub const SOLES: [Point; 2] = [(575., 1391.), (432.5, 1418.5)];

#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub enum View {
    #[default]
    Reference,
    Profile,
}

#[derive(Clone, Copy)]
pub struct FootTarget {
    pub ankle: Point,
    /// Rotation and perspective scale of the whole foot, relative to the art.
    pub angle: f64,
    pub scale: f64,
}

#[derive(Clone, Copy)]
pub struct ProjectedSkeleton {
    pub hips: [Point; 2],
    pub knees: [Point; 2],
    pub body_drop: f64,
}

#[derive(Clone, Copy)]
pub struct Pose {
    pub view: View,
    /// None displays the approved reference pose. Contact targets are never
    /// blended with that pose: stance stays locked even during start/stop.
    pub feet: Option<[FootTarget; 2]>,
    /// Physical leg joints projected through the scene camera. The optional
    /// authoring fallback below only serves the isolated reference-pose viewer.
    pub skeleton: Option<ProjectedSkeleton>,
    pub walk: f64,
    pub breath: f64,
    pub time: f64,
}
impl Default for Pose {
    fn default() -> Self {
        Self {
            view: View::Reference,
            feet: None,
            skeleton: None,
            walk: 0.,
            breath: 0.,
            time: 0.,
        }
    }
}
fn mix(a: Point, b: Point, t: f64) -> Point {
    (a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t)
}
fn smooth(t: f64) -> f64 {
    let t = t.clamp(0., 1.);
    t * t * (3. - 2. * t)
}
fn length(a: Point, b: Point) -> f64 {
    (a.0 - b.0).hypot(a.1 - b.1)
}
fn rotate(p: Point, source: Point, target: Point, angle: f64) -> Point {
    let (x, y) = (p.0 - source.0, p.1 - source.1);
    let (s, c) = angle.sin_cos();
    (target.0 + x * c - y * s, target.1 + x * s + y * c)
}
/// Two-bone solve in a plane. `bend` chooses its forward half-plane.
pub fn solve_knee(hip: Point, ankle: Point, a: f64, b: f64, bend: f64) -> Point {
    let d = length(hip, ankle).clamp(1e-8, a + b - 1e-8);
    let direction = ((ankle.0 - hip.0) / d, (ankle.1 - hip.1) / d);
    let along = (a * a - b * b + d * d) / (2. * d);
    let across = (a * a - along * along).max(0.).sqrt() * bend;
    (
        hip.0 + direction.0 * along + direction.1 * across,
        hip.1 + direction.1 * along - direction.0 * across,
    )
}
fn bone(p: Point, a: Point, b: Point, c: Point, d: Point) -> Point {
    let source_length = length(a, b);
    let u = ((b.0 - a.0) / source_length, (b.1 - a.1) / source_length);
    let target_length = length(c, d);
    let v = ((d.0 - c.0) / target_length, (d.1 - c.1) / target_length);
    let along = (p.0 - a.0) * u.0 + (p.1 - a.1) * u.1;
    let across = -(p.0 - a.0) * u.1 + (p.1 - a.1) * u.0;
    let extent = along * target_length / source_length;
    (
        c.0 + v.0 * extent - v.1 * across,
        c.1 + v.1 * extent + v.0 * across,
    )
}

#[derive(Clone, Copy)]
struct Leg {
    hip: Point,
    knee: Point,
    ankle: Point,
    foot_angle: f64,
    foot_scale: f64,
}
pub struct Rig {
    pose: Pose,
    legs: [Leg; 2],
    drop: f64,
}
impl Rig {
    pub fn new(pose: Pose) -> Self {
        let mut drop: f64 = 0.;
        if let Some(skeleton) = pose.skeleton {
            drop = skeleton.body_drop;
        } else if let Some(feet) = pose.feet {
            for i in 0..2 {
                let ankle = feet[i].ankle;
                let reach = length(HIPS[i], KNEES[i]) + length(KNEES[i], ANKLES[i]);
                let dx = ankle.0 - HIPS[i].0;
                let needed = ankle.1 - (reach * reach - dx * dx).max(1.).sqrt() - HIPS[i].1 + 6.;
                // Smooth maximum retains enough reach without snapping the
                // pelvis when the supporting leg changes.
                drop = (drop + needed + ((drop - needed).powi(2) + 36.).sqrt()) * 0.5;
            }
        }
        let legs = std::array::from_fn(|i| {
            let hip = pose
                .skeleton
                .map(|s| s.hips[i])
                .unwrap_or((HIPS[i].0, HIPS[i].1 + drop));
            let foot = pose.feet.map(|feet| feet[i]).unwrap_or(FootTarget {
                ankle: ANKLES[i],
                angle: 0.,
                scale: 1.,
            });
            let ankle = foot.ankle;
            let a = length(HIPS[i], KNEES[i]);
            let b = length(KNEES[i], ANKLES[i]);
            let solved = solve_knee(hip, ankle, a, b, 1.);
            let rest = (KNEES[i].0, KNEES[i].1 + drop);
            let knee = pose
                .skeleton
                .map(|s| s.knees[i])
                .unwrap_or(if pose.feet.is_some() { solved } else { rest });
            Leg {
                hip,
                knee,
                ankle,
                foot_angle: foot.angle,
                foot_scale: foot.scale,
            }
        });
        Self { pose, legs, drop }
    }
    fn upper(&self, p: Point) -> Point {
        let chest = (1. - ((p.1 - 350.) / 420.).abs()).clamp(0., 1.);
        let lean = self.pose.walk * 0.012;
        let mut q = (p.0 + (715. - p.1) * lean, p.1 + self.drop);
        q.0 += (p.0 - 480.) * chest * self.pose.breath * 0.013;
        q.1 -= chest * self.pose.breath * 5.;
        // The low arm has a restrained pendulum, while the chest hand stays put.
        let arm = smooth((p.1 - 290.) / 420.) * (1. - smooth((p.0 - 370.) / 40.));
        if p.1 < 840. {
            q.0 += arm * self.pose.walk * (self.pose.time * std::f64::consts::PI / 0.92).sin() * 8.;
        }
        if self.pose.view == View::Profile {
            // The head is already drawn in profile. Turn the shoulders and
            // pelvis beneath it, instead of walking a frontal torso sideways.
            let turn = smooth((p.1 - 185.) / 130.);
            q.0 = mix(q, (510. + (q.0 - 500.) * 0.84, q.1), turn).0;
        }
        q
    }
    pub fn point(&self, p: Point, part: usize) -> Point {
        let upper = self.upper(p);
        if self.pose.feet.is_none() {
            return upper;
        }
        if part == 2 && (p.1 < 660. || (p.0 <= 410.5 && p.1 <= 835.5)) {
            return upper;
        }
        let leg = if part == 0 {
            1
        } else if part == 1
            || self.pose.view == View::Profile
            || p.0 >= 518. - ((p.1 - 730.) / 620.).clamp(0., 1.) * 53.
        {
            0
        } else {
            1
        };
        let l = self.legs[leg];
        // Both feet point forward in the side view. Reusing the near-leg
        // contour avoids a frontal far foot with a different heel/ankle ratio.
        let source = if self.pose.view == View::Profile {
            0
        } else {
            leg
        };
        let hip = if self.pose.view == View::Profile {
            (570., 710.)
        } else {
            HIPS[source]
        };
        let thigh = bone(p, hip, KNEES[source], l.hip, l.knee);
        let shin = bone(p, KNEES[source], ANKLES[source], l.knee, l.ankle);
        let knee_weight = smooth((p.1 - KNEES[source].1 + 55.) / 110.);
        let mut articulated = mix(thigh, shin, knee_weight);
        // The foot is a rigid contact frame. Its own perspective scale stays
        // fixed on the slab while the body's depth changes above it.
        let local = (
            ANKLES[source].0 + (p.0 - ANKLES[source].0) * l.foot_scale,
            ANKLES[source].1 + (p.1 - ANKLES[source].1) * l.foot_scale,
        );
        let foot = rotate(local, ANKLES[source], l.ankle, l.foot_angle);
        articulated = mix(
            articulated,
            foot,
            smooth((p.1 - ANKLES[source].1 + 30.) / 65.),
        );
        mix(upper, articulated, smooth((p.1 - 650.) / 125.))
    }
}

#[derive(Clone)]
struct Outline {
    loops: Vec<Vec<Point>>,
}
static OUTLINES: LazyLock<Vec<Outline>> = LazyLock::new(|| {
    let doc = roxmltree::Document::parse(ART).expect("approved heroine asset");
    doc.descendants()
        .filter(|n| n.has_tag_name("path"))
        .map(|node| {
            let mut loops = Vec::<Vec<Point>>::new();
            for part in svgtypes::PathParser::from(node.attribute("d").unwrap()) {
                match part.expect("traced contour") {
                    svgtypes::PathSegment::MoveTo { abs: true, x, y } => loops.push(vec![(x, y)]),
                    svgtypes::PathSegment::LineTo { abs: true, x, y } => {
                        loops.last_mut().unwrap().push((x, y))
                    }
                    svgtypes::PathSegment::ClosePath { .. } => {}
                    _ => unreachable!("trace contains only absolute polygon contours"),
                }
            }
            Outline { loops }
        })
        .collect()
});

/// Painter order is far leg, near leg, then the upper body. Each has cover/ink.
pub fn paths(pose: Pose, origin: Point, scale: f64) -> Vec<String> {
    let rig = Rig::new(pose);
    OUTLINES
        .iter()
        .enumerate()
        .map(|(i, outline)| {
            let outline = if pose.view == View::Profile && i < 2 {
                &OUTLINES[i + 2]
            } else {
                outline
            };
            let mut d = String::new();
            for ring in &outline.loops {
                for (j, &p) in ring.iter().enumerate() {
                    let p = rig.point(p, i / 2);
                    let _ = write!(
                        d,
                        "{}{:.3} {:.3}",
                        if j == 0 { 'M' } else { 'L' },
                        origin.0 + p.0 * scale,
                        origin.1 + p.1 * scale
                    );
                }
                d.push('Z');
            }
            d
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn approved_rest_pose_is_preserved_and_feet_reach_their_targets() {
        let rest = Rig::new(Pose::default());
        for (i, p) in ANKLES.iter().enumerate() {
            assert_eq!(rest.point(*p, 1 - i), *p);
        }
        for phase in 0..30 {
            let x = phase as f64 / 29. * 240. - 120.;
            let targets = [(535. + x, 1330. - 40.), (405. - x, 1348.)];
            let rig = Rig::new(Pose {
                feet: Some(targets.map(|ankle| FootTarget {
                    ankle,
                    angle: 0.,
                    scale: 1.,
                })),
                walk: 1.,
                ..Pose::default()
            });
            for i in 0..2 {
                let p = rig.point(ANKLES[i], 1 - i);
                assert!(length(p, targets[i]) < 0.001, "foot {i}: {p:?}");
            }
            for i in 0..2 {
                assert!(
                    (length(rig.legs[i].hip, rig.legs[i].knee) - length(HIPS[i], KNEES[i])).abs()
                        < 0.01
                );
            }
        }
    }
    #[test]
    fn traced_geometry_has_stable_layers_and_no_raster() {
        assert_eq!(OUTLINES.len(), 6);
        assert!(!ART.contains("<image"));
        let paths = paths(Pose::default(), (0., 0.), 1.);
        for p in paths {
            assert!(!p.is_empty());
            assert!(svgtypes::PathParser::from(p.as_str()).all(|s| s.is_ok()));
        }
    }
}
