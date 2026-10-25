fn main() {
    let mut hash = 14695981039346656037u64;
    let mut feed = |s: &str| {
        for b in s.bytes().chain([0]) { hash = (hash ^ b as u64).wrapping_mul(1099511628211); }
    };
    feed(&watcher_graphics::spoken_thought::svg());
    for i in 0..=560 {
        for u in watcher_graphics::spoken_thought::frame(i as f64 / 10., false) {
            feed(&u.selector); feed(u.attribute); feed(&u.value);
        }
    }
    println!("{hash:016x}");
}
