//! Pure comparison core: retain GPU contents and upload only the changed span.
//! Shrinking a draw never requires erasing the unused tail of a GPU buffer.
pub fn changed_span<T: PartialEq>(previous: &[T], current: &[T]) -> Option<std::ops::Range<usize>> {
    let start = current
        .iter()
        .zip(previous)
        .take_while(|(a, b)| a == b)
        .count();
    if start == current.len() {
        return None;
    }
    let end = if previous.len() == current.len() {
        current.len()
            - current[start..]
                .iter()
                .rev()
                .zip(previous[start..].iter().rev())
                .take_while(|(a, b)| a == b)
                .count()
    } else {
        current.len()
    };
    Some(start..end)
}
/// Moving a soft glow by one pixel must not recreate four GPU textures. Grow
/// pooled tiles in small blocks and reclaim them when density/viewport changes.
pub fn filter_extent(required: [u32; 2], previous: [u32; 2], reset: bool, limit: u32) -> [u32; 2] {
    std::array::from_fn(|i| {
        let rounded = required[i].div_ceil(32).saturating_mul(32).min(limit);
        if reset {
            rounded
        } else {
            rounded.max(previous[i])
        }
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unchanged_and_unused_tails_need_no_transfer() {
        assert_eq!(changed_span(&[1, 2, 3], &[1, 2, 3]), None);
        assert_eq!(changed_span(&[1, 2, 3], &[1, 2]), None);
        assert_eq!(changed_span(&[1, 2], &[]), None);
    }
    #[test]
    fn appended_and_changed_values_have_exact_offsets() {
        assert_eq!(changed_span(&[], &[1, 2]), Some(0..2));
        assert_eq!(changed_span(&[1, 2], &[1, 2, 3]), Some(2..3));
        assert_eq!(changed_span(&[1, 2, 3, 4], &[1, 7, 8, 4]), Some(1..3));
        assert_eq!(changed_span(&[1, 2, 3, 4], &[1, 7]), Some(1..2));
    }
    #[test]
    fn moving_filter_tiles_reuse_capacity_and_quality_changes_reclaim_it() {
        assert_eq!(filter_extent([65, 45], [96, 64], false, 4096), [96, 64]);
        assert_eq!(filter_extent([66, 44], [96, 64], false, 4096), [96, 64]);
        assert_eq!(filter_extent([40, 32], [96, 64], true, 4096), [64, 32]);
        assert_eq!(filter_extent([4090, 10], [1, 1], false, 4096), [4096, 32]);
    }
}
