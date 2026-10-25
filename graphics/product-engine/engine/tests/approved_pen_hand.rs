use watcher_graphics::{step_two_tasks, vector_geometry};

#[test]
fn approved_contours_are_real_tessellatable_vectors() {
    let svg = step_two_tasks::svg("author-intention").unwrap();
    let doc = roxmltree::Document::parse(&svg).unwrap();
    let hand = doc
        .descendants()
        .find(|n| n.attribute("class") == Some("task-writing-hand"))
        .unwrap();
    assert!(!hand.descendants().any(|n| n.has_tag_name("image")));
    let mut vertices = 0;
    for node in hand.descendants().filter(|n| n.has_tag_name("path")) {
        let mesh = vector_geometry::mesh(
            node.attribute("d").unwrap(),
            None,
            node.attribute("fill-rule") == Some("evenodd"),
            true,
        )
        .unwrap();
        assert!(!mesh.vertices.is_empty());
        vertices += mesh.vertices.len();
    }
    // Keep the mobile geometry budget bounded; transforms reuse these meshes.
    assert!(vertices < 30_000, "pen hand has {vertices} vertices");
    println!("approved pen hand vertices: {vertices}");
}

#[test]
fn nib_stays_on_the_written_line_through_both_camera_pans() {
    for i in 1..520 {
        let frame = step_two_tasks::frame("author-intention", i as f64 / 20., false);
        let value = |selector, attribute| {
            frame
                .iter()
                .find(|u| u.selector == selector && u.attribute == attribute)
                .unwrap()
                .value
                .as_str()
        };
        let camera = vector_geometry::Matrix::parse(value(".task-author-camera", "transform"));
        let hand = vector_geometry::Matrix::parse(value(".task-writing-hand", "transform"));
        let path = value(".task-written-path", "d");
        let last = path.rsplit('L').next().unwrap();
        let point: Vec<f32> = last
            .split_whitespace()
            .map(|s| s.parse().unwrap())
            .collect();
        let end = camera.point([point[0], point[1]]);
        let nib = hand.point([0., 0.]);
        assert!((nib[0] - end[0]).abs() < 0.003);
        assert!((nib[1] - end[1]).abs() < 0.003);
    }
}

#[test]
fn reduced_motion_is_static_and_final_mirror_hides_the_hand() {
    assert_eq!(
        step_two_tasks::frame("author-intention", 0., true),
        step_two_tasks::frame("author-intention", 1000., true)
    );
    for (seconds, reduced) in [(0., true), (26., false), (30., false)] {
        let frame = step_two_tasks::frame("author-intention", seconds, reduced);
        let opacity = frame
            .iter()
            .find(|u| u.selector == ".task-writing-hand" && u.attribute == "opacity")
            .unwrap()
            .value
            .parse::<f64>()
            .unwrap();
        assert_eq!(opacity, 0.);
    }
}
