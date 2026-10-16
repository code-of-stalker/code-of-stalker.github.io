//! Share identical local contours across sharp/glow copies within one frame.
//! No quantization, frame skipping or retained history of animated paths.
use crate::vector_geometry::{self, Mesh};
use std::{collections::HashMap, rc::Rc};

#[derive(Clone, Copy)]
pub struct MeshSpec<'a> {
    pub stroke: Option<f32>,
    pub even: bool,
    pub round: bool,
    pub dash: &'a [f32],
    pub offset: f32,
    pub length: f32,
}
#[derive(Hash, PartialEq, Eq)]
struct Key {
    source: String,
    stroke: Option<u32>,
    even: bool,
    round: bool,
    dash: Vec<u32>,
    offset: u32,
    length: u32,
}
#[derive(Default)]
pub struct FrameMeshCache {
    meshes: HashMap<Key, Rc<Mesh>>,
    pub builds: u32,
}
impl FrameMeshCache {
    pub fn clear(&mut self) {
        self.meshes.clear();
        self.builds = 0;
    }
    pub fn mesh(&mut self, source: &str, spec: MeshSpec<'_>) -> Result<Rc<Mesh>, String> {
        let key = Key {
            source: source.into(),
            stroke: spec.stroke.map(f32::to_bits),
            even: spec.even,
            round: spec.round,
            dash: spec.dash.iter().map(|v| v.to_bits()).collect(),
            offset: spec.offset.to_bits(),
            length: spec.length.to_bits(),
        };
        if let Some(mesh) = self.meshes.get(&key) {
            return Ok(mesh.clone());
        }
        let mesh = Rc::new(if let Some(width) = spec.stroke {
            vector_geometry::dashed_mesh(
                source,
                width,
                spec.round,
                spec.dash,
                spec.offset,
                spec.length,
            )?
        } else {
            vector_geometry::mesh(source, None, spec.even, spec.round)?
        });
        self.meshes.insert(key, mesh.clone());
        self.builds += 1;
        Ok(mesh)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn spec() -> MeshSpec<'static> {
        MeshSpec {
            stroke: Some(0.65),
            even: false,
            round: true,
            dash: &[],
            offset: 0.,
            length: 0.,
        }
    }
    #[test]
    fn glow_and_sharp_copies_share_exact_geometry() {
        let mut cache = FrameMeshCache::default();
        let path = "M0 0L20 4L30 18";
        let first = cache.mesh(path, spec()).unwrap();
        let second = cache.mesh(path, spec()).unwrap();
        let original = vector_geometry::dashed_mesh(path, 0.65, true, &[], 0., 0.).unwrap();
        assert!(Rc::ptr_eq(&first, &second));
        assert_eq!(first.vertices, original.vertices);
        assert_eq!(first.indices, original.indices);
        assert_eq!(cache.builds, 1);
    }
    #[test]
    fn style_changes_and_new_frames_cannot_reuse_stale_contours() {
        let mut cache = FrameMeshCache::default();
        let path = "M0 0L20 4L30 18";
        let a = cache.mesh(path, spec()).unwrap();
        for different in [
            MeshSpec {
                stroke: Some(1.2),
                ..spec()
            },
            MeshSpec {
                dash: &[2., 3.],
                ..spec()
            },
            MeshSpec {
                round: false,
                ..spec()
            },
            MeshSpec {
                stroke: None,
                ..spec()
            },
        ] {
            assert!(!Rc::ptr_eq(&a, &cache.mesh(path, different).unwrap()));
        }
        cache.clear();
        assert_eq!(cache.builds, 0);
        assert_eq!(cache.meshes.len(), 0);
        let next = cache.mesh("M0 0L20 6L30 18", spec()).unwrap();
        assert_ne!(a.vertices, next.vertices);
        assert_eq!(cache.meshes.len(), 1);
    }
}
