//! People from primitives, built the way an anatomy drawing is: a skeleton
//! posed joint by joint (each limb reaches with two bones), then the rib
//! cage, the pelvis and the muscles of the limbs over it, hands with
//! jointed fingers and a thumb, feet with an arch and toes, a head with a
//! brow, a nose, lips and ears, and cloth as a looser skin cut at its hems.
//! Metres; the body faces +z, its left is +x, up is +y.
use crate::model::{v3, Frame, Mat, Prim, Shape, HAIR, SKIN, V3};
use crate::render::Crease;

/// Groups of primitives; a limb's groups differ by side (+ the side's
/// index), fingers and toes by their number too. Creases are inked only
/// between different groups, as `crease_of` says.
pub mod g {
    pub const TRUNK: u16 = 1;
    pub const NECK: u16 = 2;
    pub const PEC: u16 = 4;
    pub const GLUTE: u16 = 6;
    pub const THROAT: u16 = 8;
    pub const DELTOID: u16 = 12;
    pub const UPPER_ARM: u16 = 14;
    pub const FOREARM: u16 = 16;
    pub const HAND: u16 = 18;
    /// + 2 × finger (0 index … 3 little) + side.
    pub const FINGER: u16 = 20;
    pub const THUMB: u16 = 28;
    pub const THIGH: u16 = 30;
    pub const KNEE: u16 = 32;
    pub const SHIN: u16 = 34;
    pub const CALF: u16 = 36;
    pub const FOOT: u16 = 38;
    /// + 2 × toe (0 big … 4 little) + side.
    pub const TOE: u16 = 40;
    pub const HEAD: u16 = 60;
    pub const NOSE: u16 = 61;
    pub const EAR: u16 = 64;
    pub const HAIR: u16 = 66;
    pub const CLOTH: u16 = 70;
    pub const SLEEVE: u16 = 72;
    pub const LEG: u16 = 74;
    pub const SHOE: u16 = 76;
    pub const SKIRT: u16 = 78;
}

/// What a group belongs to, for its creases.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Part {
    Trunk,
    Pec,
    Glute,
    Throat,
    Deltoid,
    Arm,
    Finger,
    Thumb,
    Leg,
    Toe,
    Head,
    Nose,
    Lid,
    Ear,
    Hair,
    Cloth,
    Sleeve,
    Trouser,
    Shoe,
    Skirt,
}

/// The part of a group and which one of its kind it is (side, finger).
fn part(gr: u16) -> (Part, u16) {
    use Part::*;
    let at = |base: u16, p: Part| (p, gr - base);
    match gr {
        0..=3 => (Trunk, 0),
        4..=5 => at(g::PEC, Pec),
        6..=7 => at(g::GLUTE, Glute),
        8..=9 => at(g::THROAT, Throat),
        12..=13 => at(g::DELTOID, Deltoid),
        // The upper arm, the forearm and the hand are one.
        14..=19 => (Arm, (gr - g::UPPER_ARM) % 2),
        20..=27 => at(g::FINGER, Finger),
        28..=29 => at(g::THUMB, Thumb),
        // The thigh, the knee, the shin, the calf and the foot are one.
        30..=39 => (Leg, (gr - g::THIGH) % 2),
        40..=59 => at(g::TOE, Toe),
        60 => (Head, 0),
        61 => (Nose, 0),
        62..=63 => (Lid, 0),
        64..=65 => at(g::EAR, Ear),
        66..=69 => (Hair, 0),
        70..=71 => (Cloth, 0),
        72..=73 => at(g::SLEEVE, Sleeve),
        74..=75 => at(g::LEG, Trouser),
        76..=77 => at(g::SHOE, Shoe),
        _ => (Skirt, 0),
    }
}

/// Which melts are drawn: under a muscle (the lower edge of the chest,
/// the fold under the buttock, the thumb's root…), never along a limb's own
/// joints, always between fingers, toes, legs and arms that touch.
pub fn crease_of(a: u16, b: u16) -> Crease {
    use Part::*;
    let ((pa, sa), (pb, sb)) = (part(a), part(b));
    if pa == pb {
        return match pa {
            _ if sa == sb => Crease::None,
            Finger | Leg | Arm | Sleeve | Trouser | Ear => Crease::Always,
            Toe => Crease::None,
            _ => Crease::Shadow,
        };
    }
    let pair = |x: Part, y: Part| (pa == x && pb == y) || (pa == y && pb == x);
    if [Hair, Shoe].contains(&pa)
        || [Hair, Shoe].contains(&pb)
        || pair(Finger, Arm)
        || pair(Toe, Leg)
        || pair(Trunk, Leg)
        || pair(Cloth, Trouser)
        || pair(Cloth, Skirt)
        || pair(Deltoid, Arm)
        || pair(Pec, Trunk)
    {
        return Crease::None;
    }
    if pair(Finger, Thumb)
        || pair(Head, Lid)
        || pair(Head, Ear)
        || pair(Arm, Leg)
        || pair(Arm, Head)
    {
        return Crease::Always;
    }
    Crease::Shadow
}

pub const LEFT: usize = 0;
pub const RIGHT: usize = 1;

/// +1 for the body's left, -1 for its right.
pub fn sign(i: usize) -> f32 {
    if i == LEFT {
        1.0
    } else {
        -1.0
    }
}

fn side(base: u16, i: usize) -> u16 {
    base + i as u16
}

#[derive(Default)]
pub struct Flesh {
    pub prims: Vec<Prim>,
}

impl Flesh {
    pub fn push(&mut self, shape: Shape, k: f32, group: u16, mat: Mat) -> &mut Prim {
        self.prims.push(Prim::new(shape, k, group, mat));
        self.prims.last_mut().expect("just pushed")
    }
    pub fn cone(
        &mut self,
        a: V3,
        b: V3,
        ra: f32,
        rb: f32,
        k: f32,
        group: u16,
        mat: Mat,
    ) -> &mut Prim {
        self.push(Shape::Cone { a, b, ra, rb }, k, group, mat)
    }
    pub fn ell(&mut self, f: Frame, r: V3, k: f32, group: u16, mat: Mat) -> &mut Prim {
        self.push(Shape::Ellipsoid { f, r }, k, group, mat)
    }
    /// An ellipsoid at `at` with the axes of `f`.
    pub fn ell_on(&mut self, f: &Frame, at: V3, r: V3, k: f32, group: u16, mat: Mat) -> &mut Prim {
        self.ell(Frame { o: at, ..*f }, r, k, group, mat)
    }
    pub fn ball(&mut self, c: V3, r: f32, k: f32, group: u16, mat: Mat) -> &mut Prim {
        self.ell(Frame::new(c, 0.0, 0.0, 0.0), v3(r, r, r), k, group, mat)
    }
    pub fn moved(&self, f: impl Fn(V3) -> V3 + Copy) -> Flesh {
        Flesh {
            prims: self.prims.iter().map(|p| p.moved(f)).collect(),
        }
    }
}

/// A frame on the bone from `a` to `b`: y along it, z as near `front` as
/// that allows, x towards `out`.
pub fn bone(a: V3, b: V3, front: V3, out: V3) -> Frame {
    let mut f = Frame::along(a, b - a, front);
    if f.x.dot(out) < 0.0 {
        f.x = -f.x;
    }
    f
}

/// Two bones from `root` reaching for `target`, the middle joint bending
/// towards `pole`: the middle joint and where the end lands (short of the
/// target when it is out of reach).
pub fn reach(root: V3, target: V3, l1: f32, l2: f32, pole: V3) -> (V3, V3) {
    let d = target - root;
    let dist = d.len().clamp(1e-3, (l1 + l2) * 0.9999);
    let dir = d.norm();
    let cos = ((l1 * l1 + dist * dist - l2 * l2) / (2.0 * l1 * dist)).clamp(-1.0, 1.0);
    let sin = (1.0 - cos * cos).sqrt();
    let across = (pole - dir * pole.dot(dir)).norm();
    (
        root + dir * (l1 * cos) + across * (l1 * sin),
        root + dir * dist,
    )
}

/// How a body is made, against an average 1.66 m adult.
#[derive(Clone, Copy, Debug)]
pub struct Build {
    /// Lengths.
    pub s: f32,
    /// Breadths of the trunk (1 average, more for a heavy build).
    pub wide: f32,
    /// Thickness of the limbs.
    pub limbs: f32,
    /// The pelvis's breadth: 1 a man's, about 1.12 a woman's.
    pub hips: f32,
    pub shoulders: f32,
    /// The legs' length.
    pub legs: f32,
    /// A belly in front (m): 0 flat.
    pub belly: f32,
    /// Breasts (m of projection): 0 none.
    pub bust: f32,
    /// How much the muscles show, 0 … 1.
    pub tone: f32,
    pub hand: f32,
    pub foot: f32,
    pub neck: f32,
}

impl Build {
    pub const AVERAGE: Build = Build {
        s: 1.0,
        wide: 1.0,
        limbs: 1.0,
        hips: 1.0,
        shoulders: 1.0,
        legs: 1.0,
        belly: 0.0,
        bust: 0.0,
        tone: 1.0,
        hand: 1.0,
        foot: 1.0,
        neck: 1.0,
    };
    pub fn upper_arm(&self) -> f32 {
        0.29 * self.s
    }
    pub fn forearm(&self) -> f32 {
        0.245 * self.s
    }
    pub fn thigh(&self) -> f32 {
        0.405 * self.s * self.legs
    }
    pub fn shin(&self) -> f32 {
        0.39 * self.s * self.legs
    }
}

/// What the body wears.
#[derive(Clone, Copy, Debug)]
pub struct Wear {
    /// Over the chest and the belly: SKIN for nothing.
    pub top: Mat,
    /// The sleeves reach from the shoulder: 0 none, 1 the elbow, 2 the wrist.
    pub sleeves: f32,
    /// A rolled cuff at the sleeve's end.
    pub cuff: bool,
    /// Over the hips: SKIN for nothing.
    pub bottom: Mat,
    /// Trouser legs reach from the hip: 0 none, 1 the knee, 2 the ankle.
    pub legs: f32,
    /// A skirt from the hips to a hem this high (m), flared to these radii.
    pub skirt: Option<(f32, f32, f32)>,
    /// The top ends this far below the waist (m).
    pub hem: f32,
    pub shoes: Option<Mat>,
    /// How far cloth stands off the skin (m).
    pub ease: f32,
}

impl Wear {
    pub const NOTHING: Wear = Wear {
        top: SKIN,
        sleeves: 0.0,
        cuff: false,
        bottom: SKIN,
        legs: 0.0,
        skirt: None,
        hem: 0.0,
        shoes: None,
        ease: 0.0,
    };
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Hair {
    /// Cropped close.
    Short,
    /// Only a fringe round the back of the head.
    Fringe,
    /// Long, gathered in a bun at the back.
    Bun,
}

#[derive(Clone, Copy, Debug)]
pub struct Face {
    pub s: f32,
    /// Breadth of the jaw, 1 average.
    pub jaw: f32,
    /// How far the nose stands out, 1 average.
    pub nose: f32,
    /// The brow ridge: 1 a man's, about 0.5 a woman's.
    pub brow: f32,
    pub lips: f32,
    pub hair: Hair,
    pub beard: bool,
}

/// Where the joints go; the limbs reach for the wrists and ankles.
#[derive(Clone, Copy, Debug)]
pub struct Pose {
    /// Between the hip joints.
    pub pelvis: V3,
    /// Yaw, pitch (forward), roll of the pelvis, the chest and the head.
    pub pelvis_turn: [f32; 3],
    pub chest_turn: [f32; 3],
    pub head_turn: [f32; 3],
    pub ankle: [V3; 2],
    /// The feet turn out this much (radians) from the pelvis's facing.
    pub toe_out: [f32; 2],
    /// The heel lifted this much (radians), the ball on the floor.
    pub heel_up: [f32; 2],
    pub wrist: [V3; 2],
    /// Where the elbows point.
    pub elbow: [V3; 2],
    /// Where the fingers point and where the back of the hand faces.
    pub fingers: [V3; 2],
    pub back: [V3; 2],
    /// 0 open … 1 a fist.
    pub curl: [f32; 2],
    /// Where the knees point, besides the toes.
    pub knee: [V3; 2],
    /// How far the neck leans forward from the chest (radians).
    pub neck_lean: f32,
}

#[derive(Clone, Copy, Debug)]
pub struct Skeleton {
    pub pelvis: Frame,
    pub waist: V3,
    pub chest: Frame,
    pub neck: [V3; 2],
    pub head: Frame,
    pub shoulder: [V3; 2],
    pub elbow: [V3; 2],
    pub wrist: [V3; 2],
    /// At the wrist: x to the thumb, y to the fingers, z the back of the hand.
    pub hand: [Frame; 2],
    pub curl: [f32; 2],
    pub hip: [V3; 2],
    pub knee: [V3; 2],
    pub ankle: [V3; 2],
    /// At the ankle: x outward, y up the leg, z along the foot.
    pub foot: [Frame; 2],
}

pub fn skeleton(p: &Pose, b: &Build) -> Skeleton {
    let s = b.s;
    let t = |r: [f32; 3], o: V3| Frame::new(o, r[0], r[1], r[2]);
    let pelvis = t(p.pelvis_turn, p.pelvis);
    let waist = pelvis.at(0.0, 0.185 * s, -0.012 * s);
    let ct = t(p.chest_turn, waist);
    let chest = Frame {
        o: ct.at(0.0, 0.17 * s, -0.008 * s),
        ..ct
    };
    let base = chest.at(0.0, 0.162 * s, -0.035 * s);
    let head_axes = t(p.head_turn, v3(0.0, 0.0, 0.0));
    // The neck leans forward between the chest and the head.
    let lean = Frame::new(
        v3(0.0, 0.0, 0.0),
        0.5 * (p.chest_turn[0] + p.head_turn[0]),
        0.5 * (p.chest_turn[1] + p.head_turn[1]) + p.neck_lean,
        0.5 * (p.chest_turn[2] + p.head_turn[2]),
    );
    let top = base + lean.y * (0.108 * s);
    let head = Frame {
        o: top + head_axes.dir(0.0, 0.08 * s, 0.022 * s),
        ..head_axes
    };
    let mut sk = Skeleton {
        pelvis,
        waist,
        chest,
        neck: [base, top],
        head,
        shoulder: [V3::default(); 2],
        elbow: [V3::default(); 2],
        wrist: [V3::default(); 2],
        hand: [pelvis; 2],
        curl: p.curl,
        hip: [V3::default(); 2],
        knee: [V3::default(); 2],
        ankle: [V3::default(); 2],
        foot: [pelvis; 2],
    };
    for i in [LEFT, RIGHT] {
        let sg = sign(i);
        sk.shoulder[i] = chest.at(sg * 0.165 * s * b.shoulders, 0.114 * s, -0.016 * s);
        let (el, wr) = reach(
            sk.shoulder[i],
            p.wrist[i],
            b.upper_arm(),
            b.forearm(),
            p.elbow[i],
        );
        sk.elbow[i] = el;
        sk.wrist[i] = wr;
        let y = p.fingers[i].norm();
        let z = (p.back[i] - y * p.back[i].dot(y)).norm();
        sk.hand[i] = Frame {
            o: wr,
            x: y.cross(z) * sg,
            y,
            z,
        };
        sk.hip[i] = pelvis.at(sg * 0.085 * s * b.hips, 0.0, 0.0);
        // The foot: turned out, its heel perhaps lifted about the ball.
        let yaw = p.pelvis_turn[0] + sg * p.toe_out[i];
        let fwd = v3(yaw.sin(), 0.0, yaw.cos());
        let out = v3(yaw.cos(), 0.0, -yaw.sin()) * sg;
        let up = v3(0.0, 1.0, 0.0);
        let lift = p.heel_up[i];
        let (fz, fy) = (
            fwd * lift.cos() - up * lift.sin(),
            up * lift.cos() + fwd * lift.sin(),
        );
        let pole = fwd + out * 0.15 + p.knee[i];
        let (kn, an) = reach(sk.hip[i], p.ankle[i], b.thigh(), b.shin(), pole);
        sk.knee[i] = kn;
        sk.ankle[i] = an;
        sk.foot[i] = Frame {
            o: an,
            x: out,
            y: fy,
            z: fz,
        };
    }
    sk
}

/// The trunk, the neck and the shoulders' muscles.
pub fn trunk(fl: &mut Flesh, sk: &Skeleton, b: &Build, w: &Wear) {
    let s = b.s;
    let wd = b.wide;
    let (p, c) = (sk.pelvis, sk.chest);
    let skin_top = w.top == SKIN;
    let skin_bottom = w.bottom == SKIN;
    let et = if skin_top { 0.0 } else { w.ease };
    let eb = if skin_bottom { 0.0 } else { w.ease };
    let em = et.max(eb);
    let hips = b.hips;
    // Below this plane the bottom's material, above it the top's.
    let hem = sk.waist - p.y * w.hem;
    let lower = |pr: &mut Prim| {
        if w.top != w.bottom {
            pr.split = Some((hem, p.y, w.top));
        }
    };
    let trunk_g = if skin_top && skin_bottom {
        g::TRUNK
    } else {
        g::CLOTH
    };
    // The pelvis and the lower belly.
    lower(fl.ell_on(
        &p,
        p.at(0.0, 0.055 * s, -0.012 * s),
        v3(
            0.135 * s * wd * hips + eb,
            0.105 * s + eb,
            0.098 * s * wd + eb,
        ),
        0.0,
        trunk_g,
        w.bottom,
    ));
    lower(fl.ell_on(
        &p,
        p.at(0.0, 0.115 * s, 0.014 * s + 0.4 * b.belly),
        v3(
            0.118 * s * wd * hips + eb,
            0.085 * s + eb,
            0.062 * s + b.belly + eb,
        ),
        0.05 * s,
        trunk_g,
        w.bottom,
    ));
    for i in [LEFT, RIGHT] {
        let sg = sign(i);
        let gl = Frame::new(
            p.at(sg * 0.066 * s * hips, -0.045 * s, -0.06 * s),
            0.0,
            0.0,
            sg * 0.12,
        );
        let gl = Frame {
            x: p.dir(gl.x.x, gl.x.y, gl.x.z),
            y: p.dir(gl.y.x, gl.y.y, gl.y.z),
            z: p.z,
            o: gl.o,
        };
        lower(fl.ell(
            gl,
            v3(
                0.074 * s * wd * hips + eb,
                0.09 * s + eb,
                0.066 * s * wd + eb,
            ),
            0.05 * s,
            if skin_bottom {
                side(g::GLUTE, i)
            } else {
                trunk_g
            },
            w.bottom,
        ));
    }
    // The waist, between the pelvis and the ribs.
    lower(fl.ell_on(
        &c,
        sk.waist + c.z * (0.006 * s + 0.6 * b.belly),
        v3(
            0.122 * s * wd * (0.5 + 0.5 * hips) + em,
            0.10 * s,
            0.082 * s * wd + b.belly + em,
        ),
        0.06 * s,
        trunk_g,
        w.bottom,
    ));
    if b.belly > 0.0 {
        lower(fl.ell_on(
            &p,
            sk.waist.lerp(p.at(0.0, 0.1 * s, 0.0), 0.45) + p.z * (0.035 * s + 0.5 * b.belly),
            v3(0.128 * s * wd + em, 0.13 * s + em, 0.055 * s + b.belly + em),
            0.06 * s,
            trunk_g,
            w.bottom,
        ));
    }
    // The rib cage and the shoulder girdle over it.
    let top_g = if skin_top { g::TRUNK } else { g::CLOTH };
    // Tilted as the ribs are: the breastbone slopes forward and down.
    lower(fl.ell(
        c.tilted(c.at(0.0, -0.008 * s, 0.0), -0.2),
        v3(0.142 * s * wd + et, 0.165 * s + et, 0.108 * s * wd + et),
        0.06 * s,
        top_g,
        w.top,
    ));
    fl.ell_on(
        &c,
        c.at(0.0, 0.085 * s, -0.014 * s),
        v3(
            0.152 * s * wd * b.shoulders + et,
            0.072 * s + et,
            0.09 * s * wd + et,
        ),
        0.05 * s,
        top_g,
        w.top,
    );
    lower(fl.ell_on(
        &c,
        c.at(0.0, -0.14 * s, 0.06 * s + 0.5 * b.belly),
        v3(
            0.085 * s * wd + et,
            0.10 * s,
            0.034 * s + 0.5 * b.belly + et,
        ),
        0.05 * s,
        top_g,
        w.top,
    ));
    for i in [LEFT, RIGHT] {
        let sg = sign(i);
        // The back's broad muscles.
        lower(fl.ell_on(
            &c,
            c.at(sg * 0.074 * s * wd, 0.03 * s, -0.062 * s),
            v3(0.068 * s * wd + et, 0.125 * s, 0.05 * s + et),
            0.05 * s,
            top_g,
            w.top,
        ));
        // The chest: pectorals, breasts.
        // Each wraps round its side of the ribs, its top leaning back.
        let pf = Frame::new(v3(0.0, 0.0, 0.0), sg * 0.42, -0.22, -sg * 0.28);
        let pf = Frame {
            o: c.at(sg * 0.062 * s * wd, 0.04 * s, 0.074 * s),
            x: c.dir(pf.x.x, pf.x.y, pf.x.z),
            y: c.dir(pf.y.x, pf.y.y, pf.y.z),
            z: c.dir(pf.z.x, pf.z.y, pf.z.z),
        };
        let tone = b.tone.max(0.3);
        fl.ell(
            pf,
            v3(0.074 * s * wd + et, 0.058 * s + et, 0.031 * s * tone + et),
            0.03 * s,
            if skin_top { side(g::PEC, i) } else { top_g },
            w.top,
        );
        if b.bust > 0.0 {
            fl.ell_on(
                &c,
                c.at(sg * 0.072 * s, -0.005 * s, 0.085 * s),
                v3(0.056 * s + et, 0.058 * s + et, b.bust + et),
                0.035 * s,
                top_g,
                w.top,
            );
        }
        // The trapezius from the neck to the shoulder.
        fl.cone(
            c.at(sg * 0.03 * s, 0.168 * s, -0.048 * s),
            c.at(sg * 0.148 * s * b.shoulders, 0.124 * s, -0.03 * s),
            0.038 * s + et,
            0.028 * s + et,
            0.04 * s,
            top_g,
            w.top,
        );
    }
    // The neck: skin.
    let [base, top] = sk.neck;
    let r = 0.057 * s * b.neck;
    fl.cone(base, top, r * 1.06, r * 0.93, 0.035 * s, g::NECK, SKIN);
    if skin_top {
        for i in [LEFT, RIGHT] {
            let sg = sign(i);
            // The sternomastoid, from behind the ear to the breastbone.
            fl.cone(
                sk.head.at(sg * 0.05 * s, -0.07 * s, -0.03 * s),
                c.at(sg * 0.016 * s, 0.152 * s, 0.072 * s),
                0.013 * s,
                0.011 * s,
                0.02 * s,
                side(g::THROAT, i),
                SKIN,
            );
        }
    }
}

/// An arm from the shoulder to the wrist and its hand.
pub fn arm(fl: &mut Flesh, sk: &Skeleton, b: &Build, w: &Wear, i: usize) {
    let s = b.s;
    let l = b.limbs * s;
    let (sh, el, wr) = (sk.shoulder[i], sk.elbow[i], sk.wrist[i]);
    let out = sk.chest.x * sign(i);
    let hand = sk.hand[i];
    let ua = bone(sh, el, sk.chest.z, out);
    let fa = bone(el, wr, hand.x, hand.z);
    let (lu, lf) = ((el - sh).len(), (wr - el).len());
    let skin = w.sleeves <= 0.0 || w.top == SKIN;
    let e = w.ease;
    // The deltoid caps the shoulder.
    fl.ell_on(
        &ua,
        ua.at(0.012 * s, 0.055 * s, 0.0),
        v3(
            0.047 * l + if skin { 0.0 } else { e },
            0.09 * s,
            0.054 * l + if skin { 0.0 } else { e },
        ),
        0.03 * s,
        if skin {
            side(g::DELTOID, i)
        } else {
            side(g::SLEEVE, i)
        },
        if skin { SKIN } else { w.top },
    );
    // Bone and muscle under the skin.
    fl.cone(
        sh,
        el,
        0.04 * l,
        0.031 * l,
        0.03 * s,
        side(g::UPPER_ARM, i),
        SKIN,
    );
    fl.ell_on(
        &ua,
        ua.at(0.0, 0.55 * lu, 0.017 * l),
        v3(0.03 * l, 0.075 * s, 0.03 * l),
        0.02 * s,
        side(g::UPPER_ARM, i),
        SKIN,
    );
    fl.ell_on(
        &ua,
        ua.at(0.004 * l, 0.45 * lu, -0.021 * l),
        v3(0.032 * l, 0.09 * s, 0.031 * l),
        0.02 * s,
        side(g::UPPER_ARM, i),
        SKIN,
    );
    fl.ball(
        el - ua.z * (0.016 * l),
        0.022 * l,
        0.02 * s,
        side(g::FOREARM, i),
        SKIN,
    );
    fl.cone(
        el,
        wr,
        0.032 * l,
        0.021 * l,
        0.02 * s,
        side(g::FOREARM, i),
        SKIN,
    );
    fl.ell_on(
        &fa,
        fa.at(0.0, 0.27 * lf, 0.004 * l),
        v3(0.032 * l, 0.085 * s, 0.039 * l),
        0.025 * s,
        side(g::FOREARM, i),
        SKIN,
    );
    fl.ell_on(
        &hand,
        hand.at(0.0, 0.004 * s, 0.0),
        v3(0.026 * l, 0.014 * s, 0.016 * l),
        0.015 * s,
        side(g::FOREARM, i),
        SKIN,
    );
    if !skin {
        // The sleeve over it.
        let g_sleeve = side(g::SLEEVE, i);
        let reach_up = w.sleeves.min(1.0);
        let end = sh.lerp(el, reach_up);
        let pr = fl.cone(
            sh,
            end + ua.y * 0.01,
            0.05 * l + e,
            0.037 * l + e,
            0.04 * s,
            g_sleeve,
            w.top,
        );
        if w.sleeves < 1.0 {
            pr.clip[0] = Some((end, ua.y));
        }
        if w.sleeves > 1.0 {
            let end = el.lerp(wr, (w.sleeves - 1.0).min(1.0));
            fl.ball(el, 0.037 * l + e, 0.02 * s, g_sleeve, w.top);
            let pr = fl.cone(
                el,
                end + fa.y * 0.01,
                0.037 * l + e,
                0.03 * l + e,
                0.02 * s,
                g_sleeve,
                w.top,
            );
            if w.sleeves < 2.0 {
                pr.clip[0] = Some((end, fa.y));
            }
            if w.cuff && w.sleeves < 2.0 {
                let pr = fl.cone(
                    end - fa.y * 0.045,
                    end,
                    0.036 * l + 1.6 * e,
                    0.034 * l + 1.6 * e,
                    0.006 * s,
                    g_sleeve,
                    w.top,
                );
                pr.clip = [Some((end, fa.y)), Some((end - fa.y * 0.042, -fa.y))];
            }
        }
    }
    hand_flesh(fl, &hand, sk.curl[i], b.hand * s, i);
}

/// A hand on its frame (x to the thumb, y to the fingers, z its back).
pub fn hand_flesh(fl: &mut Flesh, h: &Frame, curl: f32, s: f32, i: usize) {
    let gh = side(g::HAND, i);
    let palm = Frame {
        o: h.at(0.0, 0.048 * s, 0.0),
        ..*h
    };
    fl.ell(
        palm,
        v3(0.039 * s, 0.05 * s, 0.0135 * s),
        0.012 * s,
        gh,
        SKIN,
    );
    fl.ell_on(
        h,
        h.at(0.021 * s, 0.033 * s, -0.007 * s),
        v3(0.017 * s, 0.028 * s, 0.013 * s),
        0.01 * s,
        gh,
        SKIN,
    );
    fl.ell_on(
        h,
        h.at(-0.026 * s, 0.047 * s, -0.003 * s),
        v3(0.012 * s, 0.034 * s, 0.012 * s),
        0.01 * s,
        gh,
        SKIN,
    );
    // Index, middle, ring, little: knuckle (across, along), phalanges, radius.
    const FINGERS: [(f32, f32, [f32; 3], f32); 4] = [
        (0.025, 0.093, [0.043, 0.025, 0.02], 0.0085),
        (0.008, 0.097, [0.047, 0.029, 0.022], 0.0089),
        (-0.009, 0.094, [0.045, 0.028, 0.021], 0.0083),
        (-0.025, 0.085, [0.034, 0.02, 0.018], 0.0073),
    ];
    for (f, (x, y, len, r)) in FINGERS.iter().enumerate() {
        let gf = g::FINGER + 2 * f as u16 + i as u16;
        // Fanned a little, the little finger curled most.
        let spread = (1.5 - f as f32) * 0.035;
        let d0 = (h.y * spread.cos() + h.x * spread.sin()).norm();
        let bend = curl * (1.0 + 0.12 * f as f32);
        let angles = [0.35 * bend, 0.75 * bend, 0.45 * bend];
        let mut at = h.at(x * s, y * s, 0.002 * s);
        let mut sum = 0.0;
        let mut rad = r * s;
        for (k, a) in angles.iter().enumerate() {
            sum += a;
            let d = d0 * sum.cos() - h.z * sum.sin();
            let next = at + d * (len[k] * s);
            let r1 = rad * if k == 2 { 0.86 } else { 0.94 };
            fl.cone(at, next, rad, r1, 0.003 * s, gf, SKIN);
            at = next;
            rad = r1;
        }
    }
    // The thumb, from its root by the wrist, turned towards the palm.
    let gt = side(g::THUMB, i);
    let root = h.at(0.02 * s, 0.018 * s, -0.008 * s);
    let t0 = (h.x * 0.3 + h.y * 0.85 - h.z * 0.45).norm();
    let t1 = (t0 + h.y * (0.25 + 0.3 * curl) - h.z * (0.1 + 0.3 * curl)).norm();
    let t2 = (t1 + h.y * (0.2 + 0.2 * curl) - h.x * (0.12 + 0.3 * curl) - h.z * 0.1).norm();
    let a = root + t0 * (0.042 * s);
    let b = a + t1 * (0.032 * s);
    let c = b + t2 * (0.027 * s);
    fl.cone(root, a, 0.012 * s, 0.0105 * s, 0.008 * s, gt, SKIN);
    // The web between the thumb and the index.
    fl.cone(
        root.lerp(a, 0.3),
        h.at(0.022 * s, 0.075 * s, -0.004 * s),
        0.009 * s,
        0.007 * s,
        0.01 * s,
        gh,
        SKIN,
    );
    fl.cone(a, b, 0.0102 * s, 0.0094 * s, 0.003 * s, gt, SKIN);
    fl.cone(b, c, 0.0093 * s, 0.008 * s, 0.003 * s, gt, SKIN);
}

/// A leg from the hip to the ankle and its foot.
pub fn leg(fl: &mut Flesh, sk: &Skeleton, b: &Build, w: &Wear, i: usize) {
    let s = b.s;
    let l = b.limbs * s;
    let wd = b.wide;
    let (hp, kn, an) = (sk.hip[i], sk.knee[i], sk.ankle[i]);
    let out = sk.pelvis.x * sign(i);
    let foot = sk.foot[i];
    let th = bone(hp, kn, sk.pelvis.z, out);
    let sh = bone(kn, an, foot.z, out);
    let (lt, ls) = ((kn - hp).len(), (an - kn).len());
    let e = w.ease;
    let covered = w.bottom != SKIN && w.legs >= 2.0 && w.shoes.is_some();
    let first = fl.prims.len();
    if !covered {
        let thigh = side(g::THIGH, i);
        fl.cone(hp, kn, 0.075 * l * wd, 0.048 * l, 0.05 * s, thigh, SKIN);
        fl.ell_on(
            &th,
            th.at(0.045 * s * b.hips, 0.06 * lt, 0.0),
            v3(0.04 * s * wd * b.hips, 0.08 * s, 0.055 * s),
            0.05 * s,
            thigh,
            SKIN,
        );
        fl.ell_on(
            &th,
            th.at(-0.035 * s, 0.18 * lt, 0.0),
            v3(0.042 * l * wd, 0.12 * s, 0.052 * l),
            0.05 * s,
            thigh,
            SKIN,
        );
        fl.ell_on(
            &th,
            th.at(0.005 * s, 0.45 * lt, 0.024 * s),
            v3(0.058 * l * wd, 0.19 * s, 0.05 * l),
            0.04 * s,
            thigh,
            SKIN,
        );
        fl.ell_on(
            &th,
            th.at(0.0, 0.5 * lt, -0.03 * s),
            v3(0.05 * l * wd, 0.17 * s, 0.045 * l),
            0.04 * s,
            thigh,
            SKIN,
        );
        fl.ell_on(
            &th,
            th.at(0.0, 0.17 * lt, -0.04 * s),
            v3(0.055 * l * wd, 0.1 * s, 0.05 * l),
            0.05 * s,
            thigh,
            SKIN,
        );
        fl.ell_on(
            &th,
            th.at(-0.026 * s, 0.8 * lt, 0.016 * s),
            v3(0.034 * l, 0.06 * s, 0.032 * l),
            0.03 * s,
            thigh,
            SKIN,
        );
        let knee = side(g::KNEE, i);
        fl.ball(kn, 0.043 * l, 0.03 * s, knee, SKIN);
        fl.ell_on(
            &sh,
            kn + sh.z * (0.034 * l) + sh.y * (0.006 * s),
            v3(0.022 * s, 0.027 * s, 0.012 * s),
            0.015 * s,
            knee,
            SKIN,
        );
        let shin = side(g::SHIN, i);
        fl.cone(kn, an, 0.041 * l, 0.024 * l, 0.03 * s, shin, SKIN);
        fl.ell_on(
            &sh,
            sh.at(0.012 * s, 0.3 * ls, 0.016 * s),
            v3(0.02 * l, 0.1 * s, 0.018 * l),
            0.03 * s,
            shin,
            SKIN,
        );
        let calf = side(g::CALF, i);
        fl.ell_on(
            &sh,
            sh.at(-0.016 * s, 0.27 * ls, -0.036 * s),
            v3(0.035 * l, 0.11 * s, 0.042 * l),
            0.035 * s,
            calf,
            SKIN,
        );
        fl.ell_on(
            &sh,
            sh.at(0.017 * s, 0.23 * ls, -0.032 * s),
            v3(0.031 * l, 0.09 * s, 0.037 * l),
            0.035 * s,
            calf,
            SKIN,
        );
        fl.cone(
            sh.at(0.0, 0.62 * ls, -0.028 * s),
            foot.at(0.0, -0.012 * s, -0.036 * s * b.foot),
            0.021 * l,
            0.011 * s,
            0.02 * s,
            shin,
            SKIN,
        );
    }
    if w.bottom != SKIN && w.legs > 0.0 {
        // The trouser leg, falling straight from the knee.
        let gl = side(g::LEG, i);
        let pr = fl.cone(
            hp,
            kn,
            0.085 * l * wd + e,
            0.058 * l + e,
            0.04 * s,
            gl,
            w.bottom,
        );
        if w.legs < 1.0 {
            pr.clip[0] = Some((hp.lerp(kn, w.legs), th.y));
        }
        if w.legs > 1.0 {
            let floor = v3(an.x, 0.0, an.z);
            let end = if w.legs >= 2.0 {
                floor + v3(0.0, 0.035 * s, 0.0) - foot.z * (0.01 * s)
            } else {
                kn.lerp(an, w.legs - 1.0)
            };
            fl.ball(kn, 0.06 * l + e, 0.03 * s, gl, w.bottom);
            let pr = fl.cone(
                kn,
                end,
                0.058 * l + e,
                0.052 * l + e,
                0.03 * s,
                gl,
                w.bottom,
            );
            let dir = (end - kn).norm();
            pr.clip[0] = Some((end, dir));
        }
    }
    // Under a skirt the leg ends at the hem, never through it.
    if let Some((hem_y, _, _)) = w.skirt {
        for pr in &mut fl.prims[first..] {
            pr.clip[1] = Some((v3(0.0, hem_y - 0.003, 0.0), v3(0.0, 1.0, 0.0)));
        }
    }
    match w.shoes {
        Some(m) => shoe(fl, &foot, b.foot * s, m, i),
        None => foot_flesh(fl, &foot, b.foot * s, i),
    }
}

/// A bare foot on its frame (x outward, y up, z along the foot); the
/// floor flattens its sole.
pub fn foot_flesh(fl: &mut Flesh, f: &Frame, s: f32, i: usize) {
    let gf = side(g::FOOT, i);
    fl.ball(f.o, 0.028 * s, 0.02 * s, gf, SKIN);
    fl.ball(
        f.at(0.028 * s, -0.012 * s, -0.006 * s),
        0.013 * s,
        0.012 * s,
        gf,
        SKIN,
    );
    fl.ball(
        f.at(-0.024 * s, 0.0, 0.002 * s),
        0.014 * s,
        0.012 * s,
        gf,
        SKIN,
    );
    fl.ell_on(
        f,
        f.at(0.0, -0.045 * s, -0.04 * s),
        v3(0.029 * s, 0.035 * s, 0.035 * s),
        0.02 * s,
        gf,
        SKIN,
    );
    fl.ell_on(
        f,
        f.at(0.004 * s, -0.045 * s, 0.05 * s),
        v3(0.036 * s, 0.03 * s, 0.07 * s),
        0.025 * s,
        gf,
        SKIN,
    );
    fl.cone(
        f.at(0.0, -0.008 * s, 0.015 * s),
        f.at(-0.006 * s, -0.052 * s, 0.125 * s),
        0.028 * s,
        0.017 * s,
        0.02 * s,
        gf,
        SKIN,
    );
    // The ball of the foot, slanting back to the little toe.
    let slant = f.z * 0.98 + f.x * 0.2;
    let bf = Frame::along(f.at(-0.003 * s, -0.058 * s, 0.128 * s), f.y, slant);
    fl.ell(bf, v3(0.044 * s, 0.017 * s, 0.026 * s), 0.015 * s, gf, SKIN);
    // The outer edge of the sole lies on the floor from heel to ball.
    fl.ell_on(
        f,
        f.at(0.016 * s, -0.064 * s, 0.045 * s),
        v3(0.022 * s, 0.012 * s, 0.085 * s),
        0.02 * s,
        gf,
        SKIN,
    );
    // Toes: (across, along) of the root, length, radius.
    const TOES: [(f32, f32, f32, f32); 5] = [
        (-0.024, 0.142, 0.04, 0.0135),
        (-0.003, 0.147, 0.03, 0.0088),
        (0.012, 0.14, 0.026, 0.0084),
        (0.025, 0.132, 0.023, 0.008),
        (0.037, 0.121, 0.019, 0.0076),
    ];
    for (t, (x, z, len, r)) in TOES.iter().enumerate() {
        let gt = g::TOE + 2 * t as u16 + i as u16;
        let a = f.at(x * s, -0.058 * s, z * s);
        let dir = (f.z * 0.97 + f.x * (0.03 * t as f32 - 0.04) - f.y * 0.12).norm();
        fl.cone(
            a,
            a + dir * (len * s),
            r * s,
            r * s * 0.78,
            0.009 * s,
            gt,
            SKIN,
        );
    }
}

pub fn shoe(fl: &mut Flesh, f: &Frame, s: f32, m: Mat, i: usize) {
    let gs = side(g::SHOE, i);
    fl.ball(f.o + f.y * (0.005 * s), 0.036 * s, 0.02 * s, gs, m);
    fl.ell_on(
        f,
        f.at(0.0, -0.042 * s, -0.035 * s),
        v3(0.036 * s, 0.04 * s, 0.045 * s),
        0.02 * s,
        gs,
        m,
    );
    fl.ell_on(
        f,
        f.at(-0.004 * s, -0.048 * s, 0.07 * s),
        v3(0.044 * s, 0.034 * s, 0.085 * s),
        0.03 * s,
        gs,
        m,
    );
    fl.ell_on(
        f,
        f.at(-0.008 * s, -0.056 * s, 0.14 * s),
        v3(0.043 * s, 0.027 * s, 0.07 * s),
        0.02 * s,
        gs,
        m,
    );
}

/// The head on its frame (the middle of the skull) and its hair.
pub fn head(fl: &mut Flesh, h: &Frame, f: &Face) {
    let s = f.s;
    let gh = g::HEAD;
    fl.ell_on(
        h,
        h.at(0.0, 0.0, -0.01 * s),
        v3(0.074 * s, 0.088 * s, 0.098 * s),
        0.03 * s,
        gh,
        SKIN,
    );
    fl.ell_on(
        h,
        h.at(0.0, -0.07 * s, 0.035 * s),
        v3(0.062 * s * f.jaw.sqrt(), 0.055 * s, 0.058 * s),
        0.04 * s,
        gh,
        SKIN,
    );
    fl.ell_on(
        h,
        h.at(0.0, -0.098 * s, 0.068 * s),
        v3(0.03 * s, 0.03 * s, 0.026 * s),
        0.02 * s,
        gh,
        SKIN,
    );
    fl.ell_on(
        h,
        h.at(0.0, -0.13 * s, 0.07 * s),
        v3(0.026 * s * f.jaw, 0.02 * s, 0.02 * s),
        0.02 * s,
        gh,
        SKIN,
    );
    fl.ell_on(
        h,
        h.at(0.0, -0.01 * s, 0.083 * s),
        v3(0.056 * s, 0.012 * s, 0.012 * s * f.brow),
        0.02 * s,
        gh,
        SKIN,
    );
    for i in [LEFT, RIGHT] {
        let sg = sign(i);
        fl.ell_on(
            h,
            h.at(sg * 0.048 * s, -0.045 * s, 0.045 * s),
            v3(0.02 * s, 0.016 * s, 0.024 * s),
            0.035 * s,
            gh,
            SKIN,
        );
        // The jaw from below the ear to the chin; seen this small the face
        // keeps only its forms, no eyes or lips drawn on it.
        let jr = 0.011 + 0.006 * f.jaw;
        fl.cone(
            h.at(sg * 0.056 * s * f.jaw, -0.075 * s, -0.016 * s),
            h.at(sg * 0.022 * s * f.jaw, -0.132 * s, 0.062 * s),
            jr * s,
            (jr + 0.002) * s,
            0.035 * s,
            gh,
            SKIN,
        );
        let ear = Frame::new(v3(0.0, 0.0, 0.0), sg * 0.25, -0.2, 0.0);
        let ear = Frame {
            o: h.at(sg * 0.075 * s, -0.045 * s, -0.012 * s),
            x: h.dir(ear.x.x, ear.x.y, ear.x.z),
            y: h.dir(ear.y.x, ear.y.y, ear.y.z),
            z: h.dir(ear.z.x, ear.z.y, ear.z.z),
        };
        fl.ell(
            ear,
            v3(0.011 * s, 0.031 * s, 0.019 * s),
            0.006 * s,
            side(g::EAR, i),
            SKIN,
        );
        fl.ball(
            h.at(sg * 0.013 * s, -0.074 * s, 0.1 * s),
            0.0085 * s,
            0.006 * s,
            g::NOSE,
            SKIN,
        );
    }
    fl.cone(
        h.at(0.0, -0.02 * s, 0.088 * s),
        h.at(0.0, -0.067 * s, (0.088 + 0.03 * f.nose) * s),
        0.008 * s,
        0.011 * s,
        0.012 * s,
        g::NOSE,
        SKIN,
    );
    fl.ell_on(
        h,
        h.at(0.0, -0.102 * s, 0.09 * s),
        v3(0.02 * s, 0.011 * s * f.lips, 0.008 * s),
        0.012 * s,
        gh,
        SKIN,
    );
    // The hair.
    let cap = |fl: &mut Flesh| -> usize {
        fl.ell_on(
            h,
            h.at(0.0, 0.008 * s, -0.012 * s),
            v3(0.081 * s, 0.093 * s, 0.105 * s),
            0.0,
            g::HAIR,
            HAIR,
        );
        fl.prims.len() - 1
    };
    match f.hair {
        Hair::Short => {
            let c = cap(fl);
            fl.prims[c].clip = [
                Some((h.at(0.0, 0.03 * s, 0.06 * s), h.dir(0.0, -0.55, 0.83))),
                Some((h.at(0.0, 0.0, 0.0), h.dir(0.0, -0.85, 0.53))),
            ];
        }
        Hair::Fringe => {
            // A thin band round the back, from ear to ear, its top sloping
            // up towards the crown.
            fl.ell_on(
                h,
                h.at(0.0, 0.002 * s, -0.012 * s),
                v3(0.078 * s, 0.091 * s, 0.102 * s),
                0.0,
                g::HAIR,
                HAIR,
            );
            let c = fl.prims.len() - 1;
            fl.prims[c].clip = [
                Some((h.at(0.0, 0.0, -0.02 * s), h.dir(0.0, 0.8, 0.6))),
                Some((h.at(0.0, 0.0, -0.005 * s), h.dir(0.0, 0.25, 0.97))),
            ];
        }
        Hair::Bun => {
            let c = cap(fl);
            fl.prims[c].clip[0] = Some((h.at(0.0, 0.045 * s, 0.07 * s), h.dir(0.0, -0.5, 0.87)));
            // Gathered at the back of the head.
            fl.ell_on(
                h,
                h.at(0.0, 0.035 * s, -0.115 * s),
                v3(0.036 * s, 0.033 * s, 0.03 * s),
                0.012 * s,
                g::HAIR,
                HAIR,
            );
        }
    }
    if f.beard {
        for i in [LEFT, RIGHT] {
            let sg = sign(i);
            fl.cone(
                h.at(sg * 0.062 * s * f.jaw, -0.06 * s, -0.012 * s),
                h.at(sg * 0.025 * s * f.jaw, -0.135 * s, 0.064 * s),
                0.012 * s,
                0.024 * s,
                0.01 * s,
                g::HAIR,
                HAIR,
            );
        }
        fl.ell_on(
            h,
            h.at(0.0, -0.138 * s, 0.072 * s),
            v3(0.034 * s * f.jaw, 0.026 * s, 0.026 * s),
            0.01 * s,
            g::HAIR,
            HAIR,
        );
        fl.ell_on(
            h,
            h.at(0.0, -0.089 * s, 0.094 * s),
            v3(0.026 * s, 0.0065 * s, 0.009 * s),
            0.004 * s,
            g::HAIR,
            HAIR,
        );
    }
}

/// A whole person.
pub fn person(sk: &Skeleton, b: &Build, w: &Wear, face: &Face) -> Flesh {
    let mut fl = Flesh::default();
    trunk(&mut fl, sk, b, w);
    if let Some((hem_y, rx, rz)) = w.skirt {
        let p = sk.pelvis;
        let top = sk.waist.y;
        let f = Frame {
            o: v3(p.o.x, hem_y, p.o.z - 0.01 * b.s),
            ..Frame::new(v3(0.0, 0.0, 0.0), p.pelvis_yaw(), 0.0, 0.0)
        };
        fl.push(
            Shape::Frustum {
                f,
                h: top - hem_y,
                low: (rx, rz),
                high: (0.125 * b.s * b.hips, 0.095 * b.s),
            },
            0.04 * b.s,
            g::SKIRT,
            w.bottom,
        );
    }
    for i in [LEFT, RIGHT] {
        leg(&mut fl, sk, b, w, i);
    }
    for i in [LEFT, RIGHT] {
        arm(&mut fl, sk, b, w, i);
    }
    head(&mut fl, &sk.head, face);
    fl
}

impl Frame {
    /// The turn of this frame's forward about the vertical.
    pub fn pelvis_yaw(&self) -> f32 {
        self.z.x.atan2(self.z.z)
    }
}
