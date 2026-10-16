#[derive(Clone, Copy, Default, Debug)]
pub struct Rect {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
}
/// Shelf packing; density is fixed before packing and never lowered to fit.
pub fn pack(sizes: &[[u32; 2]], limit: u32) -> Result<(Vec<Rect>, [u32; 2]), String> {
    if sizes.is_empty() {
        return Ok((Vec::new(), [1, 1]));
    }
    let max = sizes.iter().map(|s| s[0]).max().unwrap();
    if max > limit {
        return Err("Effect width exceeds GPU texture limit".into());
    }
    let area: u64 = sizes.iter().map(|s| s[0] as u64 * s[1] as u64).sum();
    let target = (area as f64).sqrt().ceil() as u32;
    let width = max.max(target).min(limit);
    let (mut x, mut y, mut row, mut used) = (0, 0, 0, 0);
    let mut result = Vec::new();
    for &[w, h] in sizes {
        if h > limit {
            return Err("Effect height exceeds GPU texture limit".into());
        }
        if x + w > width {
            x = 0;
            y += row;
            row = 0;
        }
        if y + h > limit {
            return Err("Active effects exceed the atlas limit at the permitted density".into());
        }
        result.push(Rect { x, y, w, h });
        x += w;
        row = row.max(h);
        used = used.max(x);
    }
    Ok((result, [used, y + row]))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn no_overlap_or_implicit_downscale() {
        let sizes = [[600, 800], [600, 800], [88, 88], [120, 90]];
        let (r, s) = pack(&sizes, 2048).unwrap();
        for (i, a) in r.iter().enumerate() {
            assert_eq!([a.w, a.h], sizes[i]);
            assert!(a.x + a.w <= s[0] && a.y + a.h <= s[1]);
            for b in &r[i + 1..] {
                assert!(
                    a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
                );
            }
        }
    }
    #[test]
    fn memory_pressure_is_visible() {
        assert!(pack(&[[2000, 2000], [2000, 2000]], 2048).is_err());
    }
}
