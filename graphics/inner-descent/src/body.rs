//! Small vector math for the choreography (lib.rs) and the frame of his
//! body. He stands facing +z in his own frame, feet at y = 0; in the scene
//! he is turned by a yaw about the vertical and tipped by a pitch about his
//! waist (`WAIST` high), the same two turns the world shaders undo
//! (`loc` in `figure.glsl`).

pub(crate) type V = [f32; 3];

pub(crate) fn add(a: V, b: V) -> V {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
pub(crate) fn sub(a: V, b: V) -> V {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
pub(crate) fn dot(a: V, b: V) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
pub(crate) fn cross(a: V, b: V) -> V {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
pub(crate) fn length(a: V) -> f32 {
    dot(a, a).sqrt()
}
pub(crate) fn scale(a: V, s: f32) -> V {
    a.map(|v| v * s)
}
pub(crate) fn norm(a: V) -> V {
    let l = length(a);
    if l > 1e-12 {
        scale(a, 1.0 / l)
    } else {
        [0.0, 1.0, 0.0]
    }
}
pub(crate) fn mix(a: V, b: V, t: f32) -> V {
    add(a, scale(sub(b, a), t))
}

/// The height of the pivot he is tipped about.
pub const WAIST: f32 = 1.1;

/// How he hangs: turned by `yaw` about the vertical, tipped by `pitch`
/// about his waist (a positive pitch leans his head back).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Pose {
    pub yaw: f32,
    pub pitch: f32,
}

impl Pose {
    /// A point of his own frame in the scene.
    pub fn to_world(&self, l: V) -> V {
        let (sp, cp) = self.pitch.sin_cos();
        let (y0, z0) = (l[1] - WAIST, l[2]);
        let y = cp * y0 + sp * z0 + WAIST;
        let z = -sp * y0 + cp * z0;
        let (s, c) = self.yaw.sin_cos();
        [c * l[0] + s * z, y, -s * l[0] + c * z]
    }
    /// A direction of his own frame in the scene.
    pub fn way(&self, l: V) -> V {
        sub(self.to_world(l), self.to_world([0.0; 3]))
    }
    /// A point of the scene in his own frame.
    pub fn to_local(&self, p: V) -> V {
        let (s, c) = self.yaw.sin_cos();
        let (x, y, z) = (c * p[0] - s * p[2], p[1] - WAIST, s * p[0] + c * p[2]);
        let (sp, cp) = self.pitch.sin_cos();
        [x, cp * y - sp * z + WAIST, sp * y + cp * z]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn his_frame_turns_and_tips_and_comes_back() {
        let pose = Pose {
            yaw: 0.9,
            pitch: 0.2,
        };
        for p in [[0.3, 1.7, -0.2], [0.0, 0.0, 0.0], [-0.4, 1.1, 0.5]] {
            let back = pose.to_local(pose.to_world(p));
            assert!(length(sub(back, p)) < 1e-5, "{p:?} {back:?}");
        }
        // The waist stays put; he faces +z turned by the yaw.
        assert!(length(sub(pose.to_world([0.0, WAIST, 0.0]), [0.0, WAIST, 0.0])) < 1e-6);
        let ahead = Pose {
            yaw: 0.9,
            pitch: 0.0,
        }
        .way([0.0, 0.0, 1.0]);
        assert!((ahead[0] - 0.9f32.sin()).abs() < 1e-6 && (ahead[2] - 0.9f32.cos()).abs() < 1e-6);
        // A positive pitch leans his head back, away from the way he faces.
        let head = pose.to_world([0.0, 1.7, 0.0]);
        let level = Pose {
            yaw: 0.9,
            pitch: 0.0,
        }
        .to_world([0.0, 1.7, 0.0]);
        assert!(dot(sub(head, level), ahead) < -0.05);
    }
}
