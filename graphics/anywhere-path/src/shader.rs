//! The scene's shader source: common.glsl and scene.frag after the crate's
//! constants as `#define`s, so Rust and the shader read one source. Native
//! too, so a test and `examples/shader.rs` can check what the browser links.
use crate::body::{
    BLEND, CAP, COLLAR, CUT_ROUND, FACE, FEET, HANDS, HEAD, LEGS, PRIMITIVES, SCARF, SCARF_LINKS,
    TOES,
};
use crate::place::{
    CAFE, CAR, CAR_FLOOR, DEG, FRIEND_DOOR, HOUSE, PLATFORM, POND, STATION, TRACK, WATER_Y,
};
use crate::scenery::{
    car_spacing, crowd_world, lamps, mat, trees_world, BAND, CROWD_HEAD, CROWD_R, CROWD_SHOULDER,
    DOOR_SLIDE, LEAF_L, LEAF_R, RIDGE_X, RIDGE_Y, ROOF_SLOPE, WALL_H, WIRE_Y,
};
use crate::{Scene, DATA_W, FIGS, LOOP, MELT, ROUTE_N, SLOTS};

pub const SCREEN: &str = include_str!("shaders/screen.vert");
const COMMON: &str = include_str!("shaders/common.glsl");
const SCENE: &str = include_str!("shaders/scene.frag");
/// The places' groups and the three cars.
pub const GROUPS: usize = 4 + crate::scenery::MAST_SECTORS + 3;

fn float(x: f32) -> String {
    // Debug always writes a decimal point or an exponent: a GLSL float.
    format!("{x:?}")
}
fn vec(values: &[f32]) -> String {
    let parts: Vec<String> = values.iter().map(|v| float(*v)).collect();
    format!("vec{}({})", values.len(), parts.join(", "))
}
fn list(rows: &[[f32; 4]]) -> String {
    rows.iter().map(|r| vec(r)).collect::<Vec<_>>().join(", ")
}
/// The crate's constants as the shader's `#define`s.
fn defines() -> String {
    let scene = Scene::new();
    let k = scene.story.keys;
    let int = |n: usize| n.to_string();
    let lamp_rows: Vec<[f32; 4]> = lamps()
        .iter()
        .map(|l| {
            let w = l.radius + 100.0 * l.side as f32 + if l.halo { 0.0 } else { 1000.0 };
            [l.at[0], l.at[1], l.at[2], w]
        })
        .collect();
    let crowd = crowd_world();
    let trees = trees_world();
    let blend: Vec<String> = BLEND.iter().map(|b| float(*b)).collect();
    let mut lines: Vec<(String, String)> = vec![
        ("SLOTS".into(), int(SLOTS)),
        ("DATA_W".into(), int(DATA_W)),
        ("FIGS".into(), int(FIGS)),
        ("CONES".into(), int(PRIMITIVES)),
        ("GROUPS".into(), int(GROUPS)),
        ("ROUTE_N".into(), int(ROUTE_N)),
        ("BLEND_LIST".into(), blend.join(", ")),
        ("CUT_ROUND".into(), float(CUT_ROUND)),
        ("HEAD".into(), int(HEAD)),
        ("FACE".into(), int(FACE)),
        ("CAP".into(), int(CAP)),
        ("COLLAR".into(), int(COLLAR)),
        ("LEG_FIRST".into(), int(LEGS[0])),
        ("LEG_LAST".into(), int(LEGS[1])),
        ("FOOT_L".into(), int(FEET[0])),
        ("FOOT_R".into(), int(FEET[1])),
        ("TOE_L".into(), int(TOES[0])),
        ("TOE_R".into(), int(TOES[1])),
        ("HAND_L".into(), int(HANDS[0])),
        ("HAND_R".into(), int(HANDS[1])),
        ("SCARF".into(), int(SCARF)),
        ("SCARF_LINKS".into(), int(SCARF_LINKS)),
        ("DEG".into(), float(DEG)),
        ("HOUSE".into(), float(HOUSE)),
        ("STATION".into(), float(STATION)),
        ("CAFE".into(), float(CAFE)),
        ("FRIEND_DOOR".into(), float(FRIEND_DOOR)),
        ("TRACK".into(), float(TRACK)),
        ("CAR".into(), vec(&CAR)),
        ("CAR_FLOOR".into(), float(CAR_FLOOR)),
        ("CAR_SPACING".into(), float(car_spacing())),
        ("BAND".into(), vec(&BAND)),
        ("PLATFORM".into(), float(PLATFORM)),
        ("POND".into(), vec(&POND)),
        ("WATER_Y".into(), float(WATER_Y)),
        ("WALL_H".into(), float(WALL_H)),
        ("RIDGE_X".into(), float(RIDGE_X)),
        ("RIDGE_Y".into(), float(RIDGE_Y)),
        ("ROOF_SLOPE".into(), float(ROOF_SLOPE)),
        ("DOOR_SLIDE".into(), float(DOOR_SLIDE)),
        ("LEAF_L".into(), LEAF_L.to_string()),
        ("LEAF_R".into(), LEAF_R.to_string()),
        ("WIRE_Y".into(), float(WIRE_Y)),
        ("CROWD_R".into(), float(CROWD_R)),
        ("CROWD_SHOULDER".into(), float(CROWD_SHOULDER)),
        ("CROWD_HEAD".into(), float(CROWD_HEAD)),
        ("CROWD_N".into(), int(crowd.len())),
        ("CROWD_LIST".into(), list(&crowd)),
        ("TREE_N".into(), int(trees.len())),
        ("TREE_LIST".into(), list(&trees)),
        ("LAMP_N".into(), int(lamp_rows.len())),
        ("LAMP_LIST".into(), list(&lamp_rows)),
        (
            "CROWD_GONE".into(),
            vec(&[k.dep + 0.5, k.dep + 1.5, LOOP - 6.0, LOOP - 5.0]),
        ),
        ("MELT".into(), float(MELT)),
    ];
    for (name, code) in [
        ("M_GROUND", mat::GROUND),
        ("M_FLOOR", mat::FLOOR),
        ("M_WALL", mat::WALL),
        ("M_ROOF", mat::ROOF),
        ("M_WOOD", mat::WOOD),
        ("M_STONE", mat::STONE),
        ("M_CAR", mat::CAR),
        ("M_FACADE", mat::FACADE),
        ("M_WATER", mat::WATER),
        ("M_SKY", mat::SKY),
        ("M_FIG", mat::FIG),
        ("M_CROWD", mat::CROWD),
        ("M_POLE", mat::POLE),
        ("M_LAMP", mat::LAMP),
        ("M_TREE", mat::TREE),
        ("M_HILL", mat::HILL),
        ("M_DARK", mat::DARK),
        ("M_GLASS", mat::GLASS),
    ] {
        lines.push((name.into(), code.to_string()));
    }
    lines
        .iter()
        .map(|(name, value)| format!("#define {name} {value}\n"))
        .collect()
}
pub fn source() -> String {
    format!("#version 300 es\n{}{COMMON}\n{SCENE}", defines())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_name_the_shader_reads_is_defined() {
        let s = source();
        for name in [
            "SLOTS",
            "CONES",
            "GROUPS",
            "BLEND_LIST",
            "CROWD_LIST",
            "TREE_LIST",
            "LAMP_LIST",
            "CROWD_GONE",
            "M_DARK",
            "M_GLASS",
            "CAR_SPACING",
            "LEG_LAST",
            "SCARF_LINKS",
        ] {
            assert!(s.contains(&format!("#define {name} ")), "{name}");
        }
        assert!(s.starts_with("#version 300 es\n"));
        // Each lamp's code: the reach, the side, the halo.
        for l in lamps() {
            assert!(l.radius < 100.0 && l.side <= 2);
        }
    }
}
