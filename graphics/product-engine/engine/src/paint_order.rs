//! Local painter ranks reorder siblings while retaining the outer scene stack.
//! Ancestor IDs and default ranks come from the retained SVG traversal.
use std::cmp::Ordering;

pub fn compare_paths(a: &[usize], b: &[usize], ranks: &[usize]) -> Ordering {
    a.iter()
        .map(|id| ranks[*id])
        .cmp(b.iter().map(|id| ranks[*id]))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn leaves_cross_the_cover_without_crossing_the_projection_or_backdrop() {
        // root -> backdrop, book -> cover/leaves, projection
        let cover = vec![0, 2, 3, 4];
        let leaf = vec![0, 2, 5, 6];
        let backdrop = vec![0, 1];
        let projection = vec![0, 7];
        let mut ranks = (0..8).collect::<Vec<_>>();
        let sorted = |ranks: &[usize]| {
            let mut paths = vec![
                leaf.clone(),
                projection.clone(),
                cover.clone(),
                backdrop.clone(),
            ];
            paths.sort_by(|a, b| compare_paths(a, b, ranks));
            paths
        };
        // Closed: cover lies above the leaf.
        ranks[3] = 1;
        ranks[5] = 0;
        assert_eq!(
            sorted(&ranks),
            [
                backdrop.clone(),
                leaf.clone(),
                cover.clone(),
                projection.clone()
            ]
        );
        // Open: the page lies above the cover. Outer scene order stays intact.
        ranks[3] = 0;
        ranks[5] = 1;
        assert_eq!(sorted(&ranks), [backdrop, cover, leaf, projection]);
    }
    #[test]
    fn unchanged_ranks_retain_source_order_including_detail_paths() {
        let ranks = (0..10).collect::<Vec<_>>();
        let a = [0, 2, 3, 4];
        let b = [0, 2, 3, 5];
        assert_eq!(compare_paths(&a, &b, &ranks), Ordering::Less);
        assert_eq!(compare_paths(&a, &a, &ranks), Ordering::Equal);
    }
}
