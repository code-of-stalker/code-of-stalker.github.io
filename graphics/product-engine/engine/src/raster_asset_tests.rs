mod mirror {
    #![allow(dead_code)]
    include!("../assets/mirror-atlas.rs");
}
mod gallery {
    #![allow(dead_code)]
    include!("../assets/gallery-atlas.rs");
}
mod sand {
    #![allow(dead_code)]
    include!("../assets/gallery-sand-atlas.rs");
}

#[test]
fn sand_reuses_the_approved_motion_geometry_and_atlas_layout() {
    assert_eq!(sand::SIZE, gallery::SIZE);
    assert_eq!(sand::CARDS, gallery::CARDS);
    for (sand, original) in [
        (sand::BASE, gallery::BASE),
        (sand::CARD0, gallery::CARD0),
        (sand::CARD5, gallery::CARD5),
        (sand::EMISSION, gallery::EMISSION),
        (sand::SPHERE_LARGE, gallery::SPHERE_LARGE),
        (sand::FLOOR_MASK, gallery::FLOOR_MASK),
    ] {
        assert_eq!(sand, original);
    }
}

#[test]
fn sand_keeps_transparent_edges_and_full_color_portraits() {
    let atlas =
        tiny_skia::Pixmap::decode_png(include_bytes!("../assets/gallery-sand-atlas.png")).unwrap();
    let base = sand::BASE;
    assert_eq!(
        atlas.pixel(base[0] as u32, base[1] as u32).unwrap().alpha(),
        0
    );
    let card = sand::CARD0;
    let mut light = 0;
    let mut dark = 0;
    for y in card[1] as u32..(card[1] + card[3]) as u32 {
        for x in card[0] as u32..(card[0] + card[2]) as u32 {
            let p = atlas.pixel(x, y).unwrap();
            if p.alpha() > 240 && p.green() > 180 && p.blue() > 130 {
                light += 1;
            }
            if p.alpha() > 240 && p.red() > 30 && p.red() < 130 && p.green() < 65 {
                dark += 1;
            }
        }
    }
    assert!(
        light > 100 && dark > 100,
        "Portraits must retain light and shaded color, not orange duotone"
    );
}

fn mask_pixel(x: u32, y: u32) -> [u8; 4] {
    let atlas =
        tiny_skia::Pixmap::decode_png(include_bytes!("../assets/mirror-atlas.png")).unwrap();
    let p = atlas
        .pixel(mirror::MASK[0] as u32 + x, mirror::MASK[1] as u32 + y)
        .unwrap();
    [p.red(), p.green(), p.blue(), p.alpha()]
}

#[test]
fn wall_cannot_reintroduce_rain_or_attenuation_over_foreground() {
    // The lower wall border crosses the silhouette at these points.
    for [x, y] in [[180, 288], [220, 290], [275, 292]] {
        let pixel = mask_pixel(x, y);
        assert!(pixel[0] > 240, "foreground mask must cover the hero");
        assert_eq!(pixel[2], 0, "background code must remain behind the hero");
    }
}

#[test]
fn code_mask_excludes_wall_but_keeps_background_rain() {
    assert_eq!(mask_pixel(450, 300)[2], 0);
    assert!(mask_pixel(360, 260)[2] > 200);
}
