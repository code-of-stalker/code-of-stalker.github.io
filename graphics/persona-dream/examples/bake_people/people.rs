//! The four people of the scene: the one who stands in the middle (his
//! head is Art's approved drawing, put on in tools/prepare-assets.mjs) and
//! three others deep in the room, each made anew and each unlike the rest.
use crate::body::Flesh;
use crate::body::{person, skeleton, Build, Face, Hair, Pose, Skeleton, Wear, LEFT, RIGHT};
use crate::model::{v3, DRESS, SHIRT, SHOE, TROUSERS, V3};

/// The hip joints' height that leaves the knees this little bent.
fn stand(b: &Build, hip_x: f32, ankle: V3, slack: f32) -> f32 {
    let l = (b.thigh() + b.shin()) * (1.0 - slack);
    let dx = hip_x - ankle.x;
    ankle.y + (l * l - dx * dx - ankle.z * ankle.z).max(0.0).sqrt()
}

/// The skeleton once, to place the hands against the chest it gives.
fn posed(pose: &Pose, b: &Build, hands: impl Fn(&Skeleton, &mut Pose)) -> Skeleton {
    let first = skeleton(pose, b);
    let mut p = *pose;
    hands(&first, &mut p);
    skeleton(&p, b)
}

fn relaxed(height: f32) -> Pose {
    Pose {
        pelvis: v3(0.0, 0.86 * height / 1.66, 0.0),
        pelvis_turn: [0.0; 3],
        chest_turn: [0.0; 3],
        head_turn: [0.0; 3],
        ankle: [v3(0.1, 0.072, 0.0), v3(-0.1, 0.072, 0.0)],
        toe_out: [0.2, 0.2],
        heel_up: [0.0, 0.0],
        wrist: [v3(0.2, 0.82, 0.03), v3(-0.2, 0.82, 0.03)],
        elbow: [v3(0.3, 0.0, -1.0), v3(-0.3, 0.0, -1.0)],
        fingers: [v3(0.0, -1.0, 0.1), v3(0.0, -1.0, 0.1)],
        back: [v3(1.0, 0.0, -0.2), v3(-1.0, 0.0, -0.2)],
        curl: [0.4, 0.4],
        knee: [v3(0.0, 0.0, 0.0); 2],
        neck_lean: 0.22,
    }
}

/// The one in the middle: 1.66 m, standing easy on both feet, the left a
/// little ahead and the weight a little more on the right; the arms hang
/// loose, the hands half open. Seen from his right, turned a little to us.
pub fn main_person() -> (Flesh, Skeleton) {
    let b = Build {
        tone: 0.85,
        hand: 0.93,
        foot: 0.93,
        neck: 0.95,
        ..Build::AVERAGE
    };
    let mut p = relaxed(1.66);
    p.ankle = [v3(0.105, 0.072, 0.07), v3(-0.095, 0.072, -0.035)];
    p.toe_out = [0.24, 0.2];
    p.pelvis = v3(0.004, 0.0, 0.0);
    p.pelvis.y = stand(&b, -0.085, p.ankle[RIGHT] - p.pelvis, 0.006).min(stand(
        &b,
        0.085,
        p.ankle[LEFT] - p.pelvis,
        0.012,
    ));
    p.pelvis_turn = [0.0, 0.06, -0.03];
    p.chest_turn = [0.0, -0.05, 0.025];
    // The head looks straight along +x once the body is turned (MAIN_YAW).
    p.head_turn = [std::f32::consts::FRAC_PI_2 - MAIN_YAW, 0.0, 0.0];
    p.wrist = [v3(0.212, 0.812, 0.05), v3(-0.214, 0.815, 0.085)];
    p.fingers = [v3(0.02, -1.0, 0.16), v3(-0.02, -1.0, 0.14)];
    p.back = [v3(1.0, 0.0, -0.55), v3(-1.0, 0.0, -0.55)];
    p.curl = [0.52, 0.48];
    // Upright under the drawn head.
    p.neck_lean = 0.04;
    let sk = skeleton(&p, &b);
    let face = Face {
        s: 1.0,
        jaw: 1.0,
        nose: 1.0,
        brow: 1.0,
        lips: 1.0,
        hair: Hair::Short,
        beard: false,
    };
    (person(&sk, &b, &Wear::NOTHING, &face), sk)
}

/// The body faces +x, a little towards us: this turn about the vertical.
pub const MAIN_YAW: f32 = 1.2;

/// The others: who 0, 1, 2 of the scene, each in its own cell; their
/// heights in metres.
pub const HEIGHTS: [f32; 3] = [1.84, 1.63, 1.7];

/// Who 0: a tall lean man with a short beard, his shirt sleeves rolled,
/// the arms folded on his chest, feet planted wide. He turns towards the
/// middle of the room (to our right).
pub fn tall_man() -> (Flesh, f32) {
    let s = HEIGHTS[0] / 1.66;
    let b = Build {
        s,
        wide: 0.94,
        limbs: 0.95,
        shoulders: 1.06,
        legs: 1.02,
        tone: 0.6,
        hand: 1.02,
        foot: 1.0,
        neck: 1.0,
        ..Build::AVERAGE
    };
    let mut p = relaxed(HEIGHTS[0]);
    p.ankle = [
        v3(0.16 * s, 0.072 * s, 0.01),
        v3(-0.15 * s, 0.072 * s, -0.01),
    ];
    p.toe_out = [0.28, 0.24];
    p.pelvis.y = stand(&b, 0.085 * s, p.ankle[LEFT], 0.004);
    p.pelvis_turn = [0.0, 0.03, 0.0];
    p.chest_turn = [0.04, -0.04, 0.0];
    p.head_turn = [0.2, 0.06, 0.07];
    let sk = posed(&p, &b, |sk, p| {
        let c = sk.chest;
        // The left forearm over the right, the hands on the upper arms.
        p.wrist = [
            c.at(-0.12 * s, -0.095 * s, 0.165 * s),
            c.at(0.125 * s, -0.07 * s, 0.135 * s),
        ];
        p.elbow = [v3(0.5, -1.0, -0.1), v3(-0.5, -1.0, -0.1)];
        p.fingers = [c.dir(-0.55, 0.15, -0.8), c.dir(0.5, 0.25, -0.8)];
        p.back = [c.dir(-0.1, 0.25, 1.0), c.dir(0.25, 0.4, 1.0)];
        p.curl = [0.55, 0.5];
    });
    let wear = Wear {
        top: SHIRT,
        sleeves: 1.45,
        cuff: true,
        bottom: TROUSERS,
        legs: 2.0,
        skirt: None,
        hem: 0.1 * s,
        shoes: Some(SHOE),
        ease: 0.012,
    };
    let face = Face {
        s: s.powf(0.4),
        jaw: 1.1,
        nose: 1.15,
        brow: 1.1,
        lips: 0.9,
        hair: Hair::Short,
        beard: true,
    };
    (person(&sk, &b, &wear, &face), 0.38)
}

/// Who 1: a slight woman in a dress to the knee, her hair in a bun. Her
/// weight on the right leg, the left knee loose and its foot turned out;
/// the left hand on her hip, the elbow out, the right arm hanging. She
/// turns to our left, towards the middle of the room.
pub fn woman() -> (Flesh, f32) {
    let s = HEIGHTS[1] / 1.66;
    let b = Build {
        s,
        wide: 0.86,
        limbs: 0.84,
        hips: 1.14,
        shoulders: 0.9,
        legs: 1.02,
        bust: 0.03,
        tone: 0.2,
        hand: 0.9,
        foot: 0.88,
        neck: 0.84,
        ..Build::AVERAGE
    };
    let mut p = relaxed(HEIGHTS[1]);
    p.ankle = [
        v3(0.13 * s, 0.07 * s, 0.09 * s),
        v3(-0.05 * s, 0.07 * s, 0.0),
    ];
    p.toe_out = [0.45, 0.2];
    p.heel_up = [0.1, 0.0];
    p.pelvis = v3(-0.035 * s, 0.0, 0.0);
    p.pelvis.y = stand(&b, -0.085 * s * 1.14 - 0.035 * s, p.ankle[RIGHT], 0.003);
    p.pelvis_turn = [0.0, 0.06, -0.07];
    p.chest_turn = [-0.05, -0.04, 0.05];
    p.head_turn = [-0.25, 0.04, 0.08];
    let sk = posed(&p, &b, |sk, p| {
        let pl = sk.pelvis;
        // The palm on the waist above the hip bone, the fingers forward.
        p.wrist[LEFT] = pl.at(0.15 * s, 0.11 * s, -0.025 * s);
        p.elbow[LEFT] = v3(1.0, 0.0, -0.35);
        p.fingers[LEFT] = pl.dir(-0.15, -0.45, 0.88);
        p.back[LEFT] = pl.dir(1.0, 0.0, 0.0);
        p.curl[LEFT] = 0.3;
        p.wrist[RIGHT] = v3(pl.o.x - 0.215 * s, 0.79 * s, 0.045 * s);
        p.fingers[RIGHT] = v3(-0.05, -1.0, 0.12);
        p.back[RIGHT] = v3(-1.0, 0.0, -0.3);
        p.curl[RIGHT] = 0.35;
    });
    let wear = Wear {
        top: DRESS,
        sleeves: 0.42,
        cuff: false,
        bottom: DRESS,
        legs: 0.0,
        skirt: Some((0.46 * s, 0.2 * s, 0.16 * s)),
        hem: 0.0,
        shoes: Some(SHOE),
        ease: 0.008,
    };
    let face = Face {
        s: s.powf(0.6) * 0.96,
        jaw: 0.75,
        nose: 0.8,
        brow: 0.4,
        lips: 1.2,
        hair: Hair::Bun,
        beard: false,
    };
    (person(&sk, &b, &wear, &face), -0.45)
}

/// Who 2: a heavy, broad man in a sweater, balding; chest out, his hands
/// clasped behind his back. Seen three-quarters, facing our left.
pub fn heavy_man() -> (Flesh, f32) {
    let s = HEIGHTS[2] / 1.66;
    let b = Build {
        s,
        wide: 1.24,
        limbs: 1.2,
        shoulders: 1.06,
        legs: 0.94,
        belly: 0.065,
        tone: 0.3,
        hand: 1.06,
        foot: 1.02,
        neck: 1.25,
        ..Build::AVERAGE
    };
    let mut p = relaxed(HEIGHTS[2]);
    p.ankle = [v3(0.12 * s, 0.072 * s, 0.0), v3(-0.12 * s, 0.072 * s, 0.0)];
    p.toe_out = [0.32, 0.3];
    p.pelvis.y = stand(&b, 0.085 * s, p.ankle[LEFT], 0.006);
    p.pelvis_turn = [0.0, 0.0, 0.0];
    p.chest_turn = [0.0, -0.09, 0.0];
    p.head_turn = [-0.12, -0.08, 0.0];
    let sk = posed(&p, &b, |sk, p| {
        let pl = sk.pelvis;
        // One hand holds the other's wrist behind the back.
        p.wrist = [
            pl.at(0.04 * s, 0.03 * s, -0.2 * s),
            pl.at(-0.03 * s, 0.01 * s, -0.215 * s),
        ];
        p.elbow = [v3(0.7, -0.4, -0.6), v3(-0.7, -0.4, -0.6)];
        p.fingers = [pl.dir(-0.6, -0.8, -0.1), pl.dir(0.7, -0.6, -0.1)];
        p.back = [pl.dir(0.2, 0.0, -1.0), pl.dir(-0.2, 0.0, -1.0)];
        p.curl = [0.55, 0.5];
    });
    let wear = Wear {
        top: SHIRT,
        sleeves: 2.0,
        cuff: false,
        bottom: TROUSERS,
        legs: 2.0,
        skirt: None,
        hem: 0.12 * s,
        shoes: Some(SHOE),
        ease: 0.018,
    };
    let face = Face {
        s: s.powf(0.5) * 1.03,
        jaw: 1.25,
        nose: 1.15,
        brow: 1.0,
        lips: 1.0,
        hair: Hair::Fringe,
        beard: false,
    };
    (person(&sk, &b, &wear, &face), -1.0)
}

/// Turned about the vertical by `yaw`, then moved by `to`.
pub fn place(fl: &Flesh, yaw: f32, to: V3) -> Flesh {
    fl.moved(move |p| p.yaw(yaw) + to)
}
