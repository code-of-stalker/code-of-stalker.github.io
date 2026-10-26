//! Practice 7, "Помни! Голос — как нить Ариадны, выводящий из лабиринта
//! ментальной тюрьмы на Свет Истинной Природы Себя". A maze seen from above:
//! its walls are lines of thought typing themselves and wiping out, and a dark
//! swarm creeps along its corridors. She speaks; her voice becomes a thread of
//! light that lays the way to the gate, and the swarm breaks on it. She
//! follows the thread, the walls along her way crumble, the gate opens and,
//! as the camera rises, the maze melts into the Light.
use crate::{practice_stage::*, step_three::Update};
use std::{
    f64::consts::{PI, TAU},
    sync::LazyLock,
};

pub const PERIOD: f64 = 30.;
/// The reduced-motion still: through the gate, the maze melted, the words lit.
pub const REST: f64 = 25.;

type Cell = (usize, usize);
/// Square cells in columns across and rows into the distance, metres.
const CELL: f64 = 1.5;
const COLS: usize = 6;
const ROWS: usize = 5;
const LEFT: f64 = -4.5;
const TALL: f64 = 1.9;
const THICK: f64 = 0.14;
const HEIGHT: f64 = 1.68;
/// The column whose back wall is the gate, and the back wall's depth.
const GATE: usize = 4;
const BACK: f64 = 7.5;
/// The gate: its pillars, their half width and height, the lintel's top, and
/// the leaves' hinges, width and height.
const PILLARS: [f64; 2] = [1.5, 3.];
const PILLAR: f64 = 0.11;
const PILLAR_TALL: f64 = 2.25;
const LINTEL: f64 = 2.45;
const HINGES: [f64; 2] = [1.61, 2.89];
const LEAF: f64 = 0.64;
const LEAF_TALL: f64 = 2.1;
/// High above and in front of the maze; nothing moves it but the lens.
const CAM: Camera = Camera {
    eye: [0.3, 7.5, -8.],
    focal: 270.,
    center: (160., -72.),
};
/// The passages: a spanning tree, so there is one way between any two cells.
const OPEN: [(Cell, Cell); 29] = [
    // The way out.
    ((1, 0), (1, 1)),
    ((1, 1), (2, 1)),
    ((2, 1), (3, 1)),
    ((3, 1), (3, 2)),
    ((3, 2), (3, 3)),
    ((3, 3), (4, 3)),
    ((4, 3), (4, 4)),
    // Dead ends on the left.
    ((1, 0), (0, 0)),
    ((0, 0), (0, 1)),
    ((0, 1), (0, 2)),
    ((0, 2), (1, 2)),
    ((1, 2), (1, 3)),
    ((1, 3), (0, 3)),
    ((0, 3), (0, 4)),
    ((0, 4), (1, 4)),
    ((1, 4), (2, 4)),
    ((2, 4), (2, 3)),
    ((2, 3), (2, 2)),
    ((2, 4), (3, 4)),
    // And on the right.
    ((2, 1), (2, 0)),
    ((2, 0), (3, 0)),
    ((3, 0), (4, 0)),
    ((4, 0), (5, 0)),
    ((5, 0), (5, 1)),
    ((5, 1), (4, 1)),
    ((4, 1), (4, 2)),
    ((4, 2), (5, 2)),
    ((5, 2), (5, 3)),
    ((5, 3), (5, 4)),
];
/// Her way along the corridors' middles, (x, z), out through the gate; each
/// turn is rounded off over this many metres.
const WAY: [P; 6] = [(-2.25, 0.75), (-2.25, 2.25), (0.75, 2.25), (0.75, 5.25), (2.25, 5.25), (2.25, 8.7)];
const FILLET: f64 = 0.5;
/// Thoughts on the walls that face the eye, by each wall's middle.
const THOUGHTS: [(P, &str); 14] = [
    ((-2.25, 3.), "НЕ МОГУ"),
    ((-0.75, 3.), "ДОЛЖНА"),
    ((0.75, 1.5), "А ВДРУГ"),
    ((2.25, 1.5), "ПОЗДНО"),
    ((3.75, 3.), "ВИНА"),
    ((-3.75, 4.5), "КТО Я"),
    ((2.25, 4.5), "СТРАХ"),
    ((-2.25, 6.), "ОПЯТЬ"),
    ((0.75, 6.), "НАДО"),
    ((-3.75, 7.5), "НЕЛЬЗЯ"),
    ((-2.25, 7.5), "ЧТО ЕСЛИ"),
    ((-0.75, 7.5), "НИКОГДА"),
    ((0.75, 7.5), "ТЕРПИ"),
    ((3.75, 7.5), "ВСЕГДА"),
];
const SPEAK: f64 = 5.;
const LAY: (f64, f64) = (5.2, 9.4);
const WALK: (f64, f64) = (9.8, 18.6);
const SWING: (f64, f64) = (17., 19.);
const RISE: (f64, f64) = (19.6, 23.);
/// Her walk speeds up over this long and slows down over that.
const START: f64 = 0.9;
const STOP: f64 = 1.4;
/// The thread runs at hand height.
const THREAD_Y: f64 = 1.;
/// The swarm: the dead ends it creeps through, specks in a stream and their spacing.
const RIGHT_SWARM: [Cell; 11] = [(5, 4), (5, 3), (5, 2), (4, 2), (4, 1), (5, 1), (5, 0), (4, 0), (3, 0), (2, 0), (2, 1)];
const LEFT_SWARM: [Cell; 11] = [(3, 4), (2, 4), (1, 4), (0, 4), (0, 3), (1, 3), (1, 2), (0, 2), (0, 1), (0, 0), (1, 0)];
const SPECKS: usize = 18;
const GAP: f64 = 0.085;
const NAMES: [(&str, f64); 4] = [("АБСОЛЮТНЫЙ", 22.4), ("ЦЕЛЫЙ", 22.9), ("СОВЕРШЕННЫЙ", 23.4), ("ОДИН", 23.9)];

fn time(seconds: f64, reduced: bool) -> f64 {
    if reduced || !seconds.is_finite() {
        REST
    } else {
        seconds.max(0.).rem_euclid(PERIOD)
    }
}
fn apart(a: P, b: P) -> f64 {
    (a.0 - b.0).hypot(a.1 - b.1)
}
fn centre(cell: Cell) -> P {
    (LEFT + CELL * (cell.0 as f64 + 0.5), CELL * (cell.1 as f64 + 0.5))
}
fn open(a: Cell, b: Cell) -> bool {
    OPEN.iter().any(|&(p, q)| (p, q) == (a, b) || (q, p) == (a, b))
}
/// The row of cells at a depth; the last is beyond the back wall.
fn row_of(z: f64) -> usize {
    ((z / CELL).floor().max(0.) as usize).min(ROWS)
}
/// How far `p` lies from the segment a–b.
fn off_line(p: P, a: P, b: P) -> f64 {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let l = dx * dx + dy * dy;
    let u = if l > 0. { (((p.0 - a.0) * dx + (p.1 - a.1) * dy) / l).clamp(0., 1.) } else { 0. };
    (p.0 - a.0 - u * dx).hypot(p.1 - a.1 - u * dy)
}

/// A walk over the floor, (x, z) every five centimetres with the distance
/// walked to each point.
struct Way(Vec<(P, f64)>);
impl Way {
    /// Through the corners, each turn rounded off over `round` metres.
    fn new(corners: &[P], round: f64) -> Self {
        let mut points = vec![corners[0]];
        for w in corners.windows(3) {
            let (a, p, b) = (w[0], w[1], w[2]);
            let toward = |q: P| lerp(p, q, round / apart(p, q));
            let (from, to) = (toward(a), toward(b));
            for k in 0..=12 {
                let u = k as f64 / 12.;
                points.push(lerp(lerp(from, p, u), lerp(p, to, u), u));
            }
        }
        points.push(corners[corners.len() - 1]);
        let mut out = vec![(points[0], 0.)];
        let mut walked = 0.;
        for w in points.windows(2) {
            let l = apart(w[0], w[1]);
            let n = (l / 0.05).ceil().max(1.) as usize;
            for k in 1..=n {
                out.push((lerp(w[0], w[1], k as f64 / n as f64), walked + l * k as f64 / n as f64));
            }
            walked += l;
        }
        Self(out)
    }
    fn len(&self) -> f64 {
        self.0[self.0.len() - 1].1
    }
    fn at(&self, s: f64) -> P {
        let v = &self.0;
        let i = v.partition_point(|&(_, l)| l < s).clamp(1, v.len() - 1);
        let ((a, la), (b, lb)) = (v[i - 1], v[i]);
        lerp(a, b, ((s - la) / (lb - la).max(1e-9)).clamp(0., 1.))
    }
    /// The unit direction of travel.
    fn heading(&self, s: f64) -> P {
        let (a, b) = (self.at(s - 0.05), self.at(s + 0.05));
        let l = apart(a, b).max(1e-9);
        ((b.0 - a.0) / l, (b.1 - a.1) / l)
    }
    /// The distance along it closest to `p`, and how close that is.
    fn nearest(&self, p: P) -> (f64, f64) {
        self.0
            .iter()
            .map(|&(q, s)| (s, apart(p, q)))
            .min_by(|a, b| a.1.total_cmp(&b.1))
            .unwrap()
    }
    /// Where it first reaches depth `z`; the way only ever goes deeper.
    fn reach(&self, z: f64) -> f64 {
        let v = &self.0;
        let i = v.partition_point(|&(p, _)| p.1 < z).clamp(1, v.len() - 1);
        let ((a, la), (b, lb)) = (v[i - 1], v[i]);
        mix(la, lb, ((z - a.1) / (b.1 - a.1).max(1e-9)).clamp(0., 1.))
    }
}
static ROUTE: LazyLock<Way> = LazyLock::new(|| Way::new(&WAY, FILLET));
static SWARM_WAYS: LazyLock<[Way; 2]> =
    LazyLock::new(|| [RIGHT_SWARM, LEFT_SWARM].map(|cells| Way::new(&cells.map(centre), 0.4)));

fn gate_at() -> f64 {
    ROUTE.reach(BACK)
}
/// She stops a step past the gate.
fn go() -> f64 {
    gate_at() + 0.35
}
/// How far along the way the thread reaches: to the gate as she speaks, and
/// on into the light as the gate opens.
fn thread_head(t: f64) -> f64 {
    mix(gate_at() * ramp(t, LAY.0, LAY.1), ROUTE.len(), ramp(t, 17., 19.5))
}
/// Her walk along the way: speeding up, steady, slowing to a stop.
fn walked(t: f64) -> f64 {
    let span = WALK.1 - WALK.0;
    let v = go() / (span - (START + STOP) / 2.);
    let u = (t - WALK.0).clamp(0., span);
    if u < START {
        v * u * u / (2. * START)
    } else if u < span - STOP {
        v * (u - START / 2.)
    } else {
        let r = span - u;
        go() - v * r * r / (2. * STOP)
    }
}
/// Her speed as a share of her stride.
fn pace(t: f64) -> f64 {
    let span = WALK.1 - WALK.0;
    let u = t - WALK.0;
    if !(0. ..span).contains(&u) {
        0.
    } else {
        (u / START).min(1.).min((span - u) / STOP)
    }
}
/// When her walk reaches `s`.
fn arrive(s: f64) -> f64 {
    if s <= 0. {
        return WALK.0;
    }
    let (mut a, mut b) = WALK;
    for _ in 0..48 {
        let m = (a + b) / 2.;
        if walked(m) < s {
            a = m;
        } else {
            b = m;
        }
    }
    b
}
/// Her soles on the way, bobbing as she walks, and her art in world metres.
fn her(t: f64) -> (W, Affine) {
    let s = walked(t);
    let (x, z) = ROUTE.at(s);
    let feet = [x, 0.012 * (PI * s / 0.65).sin().abs() * pace(t), z];
    (feet, heroine_world(feet, HEIGHT, 1.))
}
/// Shallow and quick at first; once she speaks, slow and deep.
fn breath(t: f64) -> f64 {
    let shallow = 0.3 - 0.3 * (TAU * t / 2.1).cos();
    let deep = 0.5 - 0.5 * (TAU * (t - SPEAK) / 4.4).cos();
    mix(shallow, deep, ramp(t, SPEAK - 0.6, SPEAK + 0.8))
}
fn throat(t: f64) -> W {
    let (feet, world) = her(t);
    let (x, y) = heroine_mark(world, HEROINE_THROAT, breath(t));
    [x, y, feet[2]]
}
/// A point of the thread `s` metres along the way: it rises out of her
/// throat over the first metre, then runs at hand height, rippling near its
/// head while it travels.
fn thread_at(s: f64, t: f64, throat: W) -> W {
    let (tail, head) = (walked(t), thread_head(t));
    let rise = ease((s - tail) / 0.9);
    let (x, z) = ROUTE.at(s);
    let moving = bell(t, LAY.0, LAY.0 + 0.3, LAY.1, LAY.1 + 0.5) + bell(t, 17., 17.3, 19.5, 20.);
    let ripple = 0.025 * rise * moving * (1. - ramp(head - s, 0.3, 2.)) * (TAU * s / 0.7 - 7. * t).sin();
    [x + (1. - rise) * (throat[0] - x), mix(throat[1], THREAD_Y, rise) + ripple, z]
}
/// The thread split by rows of the maze, so each piece is drawn between the
/// walls behind it and the walls before it. Straight runs keep only their ends.
fn thread_rows(t: f64, throat: W) -> [String; ROWS + 1] {
    let mut rows: [Vec<P>; ROWS + 1] = Default::default();
    let (tail, head) = (walked(t), thread_head(t));
    if head - tail > 0.02 {
        let n = ((head - tail) / 0.1).ceil() as usize;
        let points: Vec<(P, usize)> = (0..=n)
            .map(|i| {
                let p = thread_at(mix(tail, head, i as f64 / n as f64), t, throat);
                (CAM.project(p), row_of(p[2]))
            })
            .collect();
        let mut kept = vec![points[0]];
        for i in 1..n {
            let (p, row) = points[i];
            let edge = row != points[i - 1].1 || row != points[i + 1].1;
            if edge || off_line(p, kept[kept.len() - 1].0, points[i + 1].0) > 0.1 {
                kept.push(points[i]);
            }
        }
        kept.push(points[n]);
        for (i, &(p, row)) in kept.iter().enumerate() {
            rows[row].push(p);
            if let Some(&(q, next)) = kept.get(i + 1) {
                if next != row {
                    rows[row].push(q);
                }
            }
        }
    }
    rows.map(|r| if r.len() > 1 { line(&r) } else { String::new() })
}

/// The swarm's three streams: from the right dead ends, from the left, and
/// down her own way. Their ways and where each stream's head is.
fn swarm_way(k: usize) -> &'static Way {
    match k {
        0 | 1 => &SWARM_WAYS[k],
        _ => &ROUTE,
    }
}
static LEFT_MARK: LazyLock<f64> = LazyLock::new(|| SWARM_WAYS[1].nearest(centre((0, 1))).0);
fn lead(k: usize, t: f64) -> f64 {
    match k {
        // From the right into the corridor the thread will cross.
        0 => {
            let l = SWARM_WAYS[0].len();
            (l - 0.45 - 0.7 * (6.9 - t)).min(l - 0.25)
        }
        // From the left towards her, a cell away when she speaks.
        1 => (*LEFT_MARK + 0.7 * (t - SPEAK)).min(SWARM_WAYS[1].len() - 0.5),
        // Down her way towards her, from behind the gate.
        _ => gate_at() - 2.3 - 0.5 * t,
    }
}
fn voice_ring(t: f64) -> f64 {
    0.3 + 2.4 * ease((t - SPEAK) / 1.2)
}
/// The moment a stream meets the light: the thread laid across its corridor,
/// the ring of her voice, or the thread's head coming down the way.
fn touches(k: usize, t: f64) -> bool {
    let p = swarm_way(k).at(lead(k, t));
    match k {
        0 => {
            let (s, d) = ROUTE.nearest(p);
            t >= LAY.0 && d < 0.55 && s <= thread_head(t)
        }
        1 => t >= SPEAK && apart(p, WAY[0]) <= voice_ring(t),
        _ => thread_head(t) >= lead(2, t) - 0.25,
    }
}
static BREAK: LazyLock<[f64; 3]> = LazyLock::new(|| {
    std::array::from_fn(|k| {
        (0..1200)
            .map(|n| SPEAK + n as f64 * 0.01)
            .find(|&t| touches(k, t))
            .unwrap_or(17.)
    })
});
/// Where each stream breaks from: the thread across it, her, the thread's head.
static HIT: LazyLock<[P; 3]> = LazyLock::new(|| {
    let right = ROUTE.at(ROUTE.nearest(SWARM_WAYS[0].at(lead(0, BREAK[0]))).0);
    [right, WAY[0], ROUTE.at(thread_head(BREAK[2]))]
});
/// Speck `i` of stream `k` creeping along its way, twitching like an insect:
/// centre and size, metres.
fn creeping(k: usize, i: usize, t: f64) -> Option<(W, f64)> {
    let way = swarm_way(k);
    let twitch = 0.04 * (5.1 * t + 2.3 * i as f64).sin();
    let s = lead(k, t) + if k == 2 { 1. } else { -1. } * GAP * i as f64 + twitch;
    let end = if k == 2 { gate_at() - 0.3 } else { way.len() };
    if !(0. ..=end).contains(&s) {
        return None;
    }
    let (x, z) = way.at(s);
    let (dx, dz) = way.heading(s);
    let h = hash(k * 97 + i);
    let side = 0.34 * (hash(k * 97 + i + 20) - 0.5) + 0.04 * (4.3 * t + 1.7 * i as f64).sin();
    let y = 0.05 + 0.1 * h + 0.03 * (6. * t + i as f64).sin();
    Some(([x - dz * side, y, z + dx * side], 0.03 + 0.03 * h))
}
/// A speck as a dark splinter, turning as it goes.
fn splinter(k: usize, i: usize, t: f64, at: W, r: f64) -> String {
    let (c, r) = (CAM.project(at), r * CAM.scale(at[2]));
    let turn = hash(k * 97 + i + 40) * TAU + 3. * (hash(k * 97 + i + 60) - 0.5) * t;
    poly(&[0., 2.3, 4.].map(|a| (c.0 + r * (turn + a).cos(), c.1 + 0.8 * r * (turn + a).sin())))
}
/// The speck before its stream breaks, then scattering away from the light.
fn speck(k: usize, i: usize, t: f64) -> Option<(W, f64)> {
    let at = BREAK[k];
    if t < at {
        return creeping(k, i, t);
    }
    let tau = t - at;
    if tau > 1.4 {
        return None;
    }
    let (p, r) = creeping(k, i, at)?;
    let from = HIT[k];
    let (ox, oz) = (p[0] - from.0, p[2] - from.1);
    let l = ox.hypot(oz).max(1e-6);
    let (sin, cos) = ((hash(k * 97 + i + 50) - 0.5) * 1.2).sin_cos();
    let far = (0.6 + 0.8 * hash(k * 97 + i + 70)) * (tau - 0.3 * tau * tau);
    Some((
        [p[0] + far * (ox * cos - oz * sin) / l, p[1] + 0.5 * tau, p[2] + far * (ox * sin + oz * cos) / l],
        r * (1. - 0.7 * ramp(tau, 0.2, 1.2)),
    ))
}
/// The light where each stream breaks, and the row it is drawn with.
static FLASH: LazyLock<[(W, usize); 3]> = LazyLock::new(|| {
    std::array::from_fn(|k| {
        let (p, _) = creeping(k, 0, BREAK[k]).unwrap_or(([HIT[k].0, 0., HIT[k].1], 0.));
        ([p[0], 0.35, p[2]], row_of(p[2]).min(ROWS - 1))
    })
});
/// A dark stain on the floor under a stream.
fn smudge(k: usize, t: f64) -> (String, f64) {
    let at = BREAK[k];
    let points: Vec<W> = (0..SPECKS).filter_map(|i| creeping(k, i, t.min(at))).map(|(p, _)| p).collect();
    if points.is_empty() {
        return (String::new(), 0.);
    }
    let n = points.len() as f64;
    let (x, z) = (points.iter().map(|p| p[0]).sum::<f64>() / n, points.iter().map(|p| p[2]).sum::<f64>() / n);
    let rx = (0.4 + 0.035 * n) * CAM.scale(z);
    let d = ellipse(CAM.project([x, 0., z]), rx, rx * CAM.eye[1] / (z - CAM.eye[2]));
    (d, 0.7 * (1. - ramp(t - at, 0., 0.6)))
}

/// A wall of the maze: a box between two cells or at the maze's edge.
struct Wall {
    x: (f64, f64),
    z: (f64, f64),
    /// Runs across the view, along x, rather than into it.
    across: bool,
    /// Drawn with the row of cells before it.
    band: usize,
    mid: P,
    thought: Option<&'static str>,
    /// Where her way passes closest, when the wall lines it.
    beside: Option<f64>,
    /// When it goes: crumbling before her, or melting into the Light.
    fall: f64,
    seed: usize,
}
impl Wall {
    fn corners(&self) -> Vec<P> {
        let mut out = Vec::with_capacity(8);
        for x in [self.x.0, self.x.1] {
            for y in [0., TALL] {
                for z in [self.z.0, self.z.1] {
                    out.push(CAM.project([x, y, z]));
                }
            }
        }
        out
    }
    /// The face turned to the eye, top left, top right, foot right and foot
    /// left as seen, and its outward normal.
    fn face(&self) -> ([W; 4], W) {
        let ((x0, x1), (z0, z1)) = (self.x, self.z);
        if self.across {
            ([[x0, TALL, z0], [x1, TALL, z0], [x1, 0., z0], [x0, 0., z0]], [0., 0., -1.])
        } else if self.mid.0 < CAM.eye[0] {
            ([[x1, TALL, z0], [x1, TALL, z1], [x1, 0., z1], [x1, 0., z0]], [1., 0., 0.])
        } else {
            ([[x0, TALL, z1], [x0, TALL, z0], [x0, 0., z0], [x0, 0., z1]], [-1., 0., 0.])
        }
    }
    fn cap(&self) -> [W; 4] {
        let ((x0, x1), (z0, z1)) = (self.x, self.z);
        [[x0, TALL, z0], [x1, TALL, z0], [x1, TALL, z1], [x0, TALL, z1]]
    }
    /// A point of the face, `a` of the way along it and `b` down from its top.
    fn on_face(&self, a: f64, b: f64) -> W {
        let (f, _) = self.face();
        wmix(wmix(f[0], f[1], a), wmix(f[3], f[2], a), b)
    }
    /// Its opacity and the flash of light as it goes.
    fn shown(&self, t: f64) -> (f64, f64) {
        let f = self.fall;
        if self.beside.is_some() {
            (1. - ramp(t, f, f + 0.35), 0.8 * bell(t, f - 0.4, f - 0.1, f + 0.05, f + 0.3))
        } else {
            (1. - 0.78 * ramp(t, f, f + 1.2), 0.9 * bell(t, f - 0.2, f + 0.3, f + 0.6, f + 1.2))
        }
    }
    /// Letter `i` of its thought, lying on the face.
    fn letter(&self, text: &str, i: usize) -> String {
        let (face, normal) = self.face();
        let along = unit(sub(face[1], face[0]));
        let length = dot(sub(face[1], face[0]), along);
        let n = text.chars().count() as f64;
        let size = (1.4 / (n * ADVANCE)).min(0.36);
        let left = (length - n * ADVANCE * size) / 2.;
        let foot = add(face[3], scaled(normal, 0.005));
        let mut d = String::new();
        glyph(&mut d, text.chars().nth(i).unwrap(), |gx, gy| {
            CAM.project(add(add(foot, scaled(along, left + (i as f64 * ADVANCE + gx) * size)), [0., 0.75 + gy * size, 0.]))
        });
        d
    }
    /// What is left of it: dark shards falling before her, or light rising
    /// off it as the maze melts.
    fn debris(&self, t: f64) -> (String, f64) {
        let u = t - self.fall;
        let (face, normal) = self.face();
        let along = unit(sub(face[1], face[0]));
        let mut d = String::new();
        if self.beside.is_some() {
            if !(0. ..1.8).contains(&u) {
                return (d, 0.);
            }
            let (across, down) = (6, 4);
            for i in 0..across {
                for j in 0..down {
                    let k = self.seed * 37 + i * down + j;
                    let (a0, b0) = (i as f64 / across as f64, j as f64 / down as f64);
                    let (da, db) = (1. / across as f64, 1. / down as f64);
                    let centre = self.on_face(a0 + da / 2., b0 + db / 2.);
                    let lift = 0.5 * hash(k + 2);
                    // Top slabs go first; each tumbles and comes to rest on the floor.
                    let landed = (lift + (lift * lift + 11. * centre[1]).sqrt()) / 5.5;
                    let tau = (u - 0.22 * (b0 + db / 2.)).clamp(0., landed);
                    let fly = add(add(scaled(normal, 0.35 + 0.6 * hash(k)), scaled(along, 0.8 * (hash(k + 1) - 0.5))), [0., lift, 0.]);
                    let mut at = add(centre, scaled(fly, tau));
                    at[1] -= 2.75 * tau * tau;
                    let tilt = hash(k + 3) * PI;
                    let axis = add(scaled(along, tilt.cos()), [0., tilt.sin(), 0.]);
                    let turn = (2.4 + 3. * hash(k + 4)) * tau;
                    let size = 1. - 0.5 * ramp(u, 0.25, 1.3);
                    let mut points: Vec<W> = [(0., 0.), (1., 0.), (1., 1.), (0., 1.)]
                        .iter()
                        .map(|&(a, b)| {
                            let r = sub(self.on_face(a0 + a * da, b0 + b * db), centre);
                            add(at, scaled(spin(r, axis, turn), size))
                        })
                        .collect();
                    let low = points.iter().map(|p| p[1]).fold(f64::INFINITY, f64::min);
                    if low < 0. {
                        points.iter_mut().for_each(|p| p[1] -= low);
                    }
                    d.push_str(&CAM.poly(&points));
                }
            }
            (d, ramp(u, 0., 0.1) * (1. - ramp(u, 0.9, 1.7)))
        } else {
            if !(0. ..2.4).contains(&u) {
                return (d, 0.);
            }
            for i in 0..3 {
                for j in 0..2 {
                    let k = self.seed * 41 + i * 2 + j;
                    let tau = u - 0.4 * hash(k);
                    if tau <= 0. {
                        continue;
                    }
                    let base = self.on_face((i as f64 + 0.5) / 3., 0.12 + 0.22 * j as f64);
                    let sway = 0.08 * (3. * tau + hash(k + 2) * TAU).sin();
                    let at = add(add(base, scaled(normal, 0.25 * tau)), add(scaled(along, sway), [0., (0.5 + 0.4 * hash(k + 1)) * tau, 0.]));
                    // A spark drawn out upwards as it rises.
                    let r = 0.06 * (1. - ramp(tau, 0.3, 1.8));
                    let points: Vec<W> = [(0., 2.2), (0.6, 0.), (0., -1.), (-0.6, 0.)]
                        .iter()
                        .map(|&(a, b)| add(at, add(scaled(along, r * a), [0., r * b, 0.])))
                        .collect();
                    d.push_str(&CAM.poly(&points));
                }
            }
            (d, bell(u, 0., 0.25, 1.2, 2.2))
        }
    }
}
/// Every wall in painter order: the farthest band first; in a band the wall
/// across the way, then the walls into the view from the outside in.
static WALLS: LazyLock<Vec<Wall>> = LazyLock::new(|| {
    let h = THICK / 2.;
    let x_at = |i: usize| LEFT + CELL * i as f64;
    let z_at = |j: usize| CELL * j as f64;
    let mut boxes = Vec::new();
    for j in 1..=ROWS {
        for i in 0..COLS {
            let closed = if j == ROWS { i != GATE } else { !open((i, j - 1), (i, j)) };
            if closed {
                boxes.push(((x_at(i) - h, x_at(i + 1) + h), (z_at(j) - h, z_at(j) + h), true, j - 1));
            }
        }
    }
    for j in 0..ROWS {
        for i in 0..=COLS {
            if i == 0 || i == COLS || !open((i - 1, j), (i, j)) {
                boxes.push(((x_at(i) - h, x_at(i) + h), (z_at(j) - h, z_at(j + 1) + h), false, j));
            }
        }
    }
    let mut walls: Vec<Wall> = boxes
        .into_iter()
        .enumerate()
        .map(|(seed, (x, z, across, band))| {
            let mid = ((x.0 + x.1) / 2., (z.0 + z.1) / 2.);
            let thought = THOUGHTS.iter().find(|(at, _)| apart(*at, mid) < 0.01).map(|&(_, text)| text);
            let (near, off) = ROUTE.nearest(mid);
            let beside = (off < 1.).then_some(near);
            let fall = match beside {
                // It flashes and crumbles while she is still a few steps away.
                Some(near) => arrive(near - 1.3) - 0.4,
                // The maze melts outward from the gate.
                None => RISE.0 + 2.2 * apart(mid, (2.25, BACK)) / 9.5,
            };
            Wall { x, z, across, band, mid, thought, beside, fall, seed }
        })
        .collect();
    let outside = |w: &Wall| (w.mid.0 - CAM.eye[0]).abs();
    walls.sort_by(|a, b| {
        b.band
            .cmp(&a.band)
            .then(b.across.cmp(&a.across))
            .then(outside(b).total_cmp(&outside(a)))
    });
    walls
});
/// Lines of thought type themselves out letter by letter, hold and wipe out.
fn typed(seed: usize, i: usize, t: f64) -> f64 {
    let u = (t + 4.6 * hash(seed + 7)).rem_euclid(4.6);
    let (on, off) = (0.3 + 0.11 * i as f64, 3.2 + 0.07 * i as f64);
    ramp(u, on, on + 0.05) * (1. - ramp(u, off, off + 0.3))
}
fn wall(c: &mut Canvas, w: &Wall, t: f64, calm: f64, touch: f64) {
    let (alpha, glow) = w.shown(t);
    let (face, _) = w.face();
    c.group("", "", alpha);
    let uv = if c.building() {
        c.raw(&format!(r#"<path d="{}" fill="{COVER}" fill-opacity=".86"/>"#, poly(&hull(w.corners()))));
        let along = unit(sub(face[1], face[0]));
        let length = dot(sub(face[1], face[0]), along);
        CAM.uv_shift(face, [length / 6., TALL / 5.], [dot(face[0], along) / 6., 0.])
    } else {
        String::new()
    };
    c.fixed_rain(|| CAM.poly(&face), &uv, 0.13 + 0.07 * (1. - calm) + 0.25 * glow + 0.3 * touch);
    c.raw(&format!(
        r#"<path d="{}" fill="{LINE}" fill-opacity=".18" stroke="{LINE}" stroke-width=".35" stroke-opacity=".55"/><path d="{}" stroke="{LINE}" stroke-width=".3" stroke-opacity=".4"/>"#,
        CAM.poly(&w.cap()),
        CAM.poly(&face)
    ));
    if let Some(text) = w.thought {
        for (i, letter) in text.chars().enumerate() {
            if letter != ' ' {
                c.fixed(|| w.letter(text, i), &fill(INK), typed(w.seed, i, t) * (1. - 0.6 * calm));
            }
        }
    }
    c.fixed(|| CAM.poly(&face) + &CAM.poly(&w.cap()), &stroke(LIGHT, 0.55), glow);
    c.end();
}

/// The gate's pillars and lintel as fixed markup, and their fronts for light.
fn gate_frame() -> (String, String) {
    let (mut markup, mut fronts) = (String::new(), String::new());
    let (z0, z1) = (BACK - PILLAR, BACK + PILLAR);
    let blocks = [
        ((PILLARS[0] - PILLAR, PILLARS[0] + PILLAR), (0., PILLAR_TALL)),
        ((PILLARS[1] - PILLAR, PILLARS[1] + PILLAR), (0., PILLAR_TALL)),
        ((PILLARS[0] - PILLAR, PILLARS[1] + PILLAR), (PILLAR_TALL, LINTEL)),
    ];
    for ((x0, x1), (y0, y1)) in blocks {
        let mut corners = Vec::new();
        for x in [x0, x1] {
            for y in [y0, y1] {
                for z in [z0, z1] {
                    corners.push(CAM.project([x, y, z]));
                }
            }
        }
        let front = CAM.poly(&[[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]]);
        let top = CAM.poly(&[[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]);
        markup.push_str(&format!(
            r#"<path d="{}" fill="{COVER}" fill-opacity=".95"/><path d="{front}{top}" stroke="{LINE}" stroke-width=".35" stroke-opacity=".6"/>"#,
            poly(&hull(corners))
        ));
        fronts.push_str(&front);
    }
    (markup, fronts)
}
/// The leaves swing ajar when the thread reaches them, and open into the
/// distance as she comes.
fn leaf_angle(t: f64) -> f64 {
    (6. * ramp(t, LAY.1, 10.2) + 94. * ramp(t, SWING.0, SWING.1)).to_radians()
}
fn leaves(t: f64) -> (String, String) {
    let a = leaf_angle(t);
    let (mut cover, mut lines) = (String::new(), String::new());
    for (hinge, side) in [(HINGES[0], 1.), (HINGES[1], -1.)] {
        let at = |f: f64, y: f64| [hinge + side * LEAF * f * a.cos(), y, BACK + LEAF * f * a.sin()];
        let leaf = CAM.poly(&[at(0., LEAF_TALL), at(1., LEAF_TALL), at(1., 0.), at(0., 0.)]);
        cover.push_str(&leaf);
        lines.push_str(&leaf);
        for (top, foot) in [(1.92, 1.16), (0.98, 0.18)] {
            lines.push_str(&CAM.poly(&[at(0.18, top), at(0.82, top), at(0.82, foot), at(0.18, foot)]));
        }
    }
    (cover, lines)
}

fn floor_grid() -> String {
    let mut d = String::new();
    for k in 0..=24 {
        let x = -9. + 0.75 * k as f64;
        d.push_str(&CAM.line(&[[x, 0., -1.5], [x, 0., 11.]]));
    }
    for k in 0..=16 {
        let z = -1.5 + 0.75 * k as f64;
        d.push_str(&CAM.line(&[[-9., 0., z], [9., 0., z]]));
    }
    d
}
fn route_line() -> String {
    let n = (ROUTE.len() / 0.2).ceil() as usize;
    CAM.line(
        &(0..=n)
            .map(|i| {
                let (x, z) = ROUTE.at(ROUTE.len() * i as f64 / n as f64);
                [x, 0., z]
            })
            .collect::<Vec<_>>(),
    )
}

/// Close on her at first, back to the whole maze as the thread is laid, after
/// her as she walks, to the gate as it opens, and up into the Light.
fn lens(t: f64, her: P) -> Affine {
    let centre = (160., 96.);
    let gate = CAM.project([2.25, 1.1, BACK]);
    let mut s = mix(1.75, 1.5, ramp(t, 0., 4.8));
    s = mix(s, 1., ramp(t, 5., 9.));
    s = mix(s, 1.15, ramp(t, 9., 11.));
    s = mix(s, 1.3, ramp(t, 17.5, 19.5));
    s = mix(s, 0.7, ramp(t, 19.5, 24.5));
    let mut f = lerp(her, centre, ramp(t, 5., 9.));
    f = lerp(f, lerp(her, centre, 0.5), ramp(t, 9., 11.));
    f = lerp(f, gate, ramp(t, 17.5, 19.5));
    f = lerp(f, (gate.0, gate.1 - 45.), ramp(t, 19.5, 24.5));
    Affine([s, 0., 0., s, 160. - s * f.0, 96. - s * f.1])
}

fn defs() -> String {
    let (hx, hy) = HEROINE_HEART;
    format!(
        r#"{}<radialGradient id="nt-smudge"><stop stop-color="var(--book-cover)" stop-opacity=".9"/><stop offset=".55" stop-color="var(--book-cover)" stop-opacity=".55"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity="0"/></radialGradient><radialGradient id="nt-bloom"><stop stop-color="var(--book-light)" stop-opacity=".95"/><stop offset=".22" stop-color="var(--book-light)" stop-opacity=".6"/><stop offset=".55" stop-color="var(--book-line)" stop-opacity=".25"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="nt-pool"><stop stop-color="var(--book-light)" stop-opacity=".35"/><stop offset=".4" stop-color="var(--book-line)" stop-opacity=".14"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="nt-inner" gradientUnits="userSpaceOnUse" cx="{hx}" cy="{hy}" r="520"><stop stop-color="var(--book-light)" stop-opacity=".95"/><stop offset=".22" stop-color="var(--book-line)" stop-opacity=".55"/><stop offset=".55" stop-color="var(--book-ink)" stop-opacity=".2"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient><radialGradient id="nt-vignette" r=".75"><stop offset=".6" stop-color="var(--book-cover)" stop-opacity="0"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity=".85"/></radialGradient><linearGradient id="nt-top" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--book-cover)"/><stop offset=".85" stop-color="var(--book-cover)"/><stop offset="1" stop-color="var(--book-cover)" stop-opacity="0"/></linearGradient>"#,
        glow_defs("nt"),
    )
}

fn draw(c: &mut Canvas, t: f64, reduced: bool) {
    let master = if reduced { 1. } else { ramp(t, 0., 1.2) * (1. - ramp(t, 28.2, 29.8)) };
    let calm = ramp(t, LAY.1, LAY.1 + 1.2);
    let end = ramp(t, RISE.0, RISE.1);
    let open = ramp(t, SWING.0, SWING.1);
    let b = breath(t);
    let (feet, world) = her(t);
    let place = world.then(CAM.plane(feet[2]));
    let chest = heroine_mark(place, HEROINE_HEART, b);
    let voice = throat(t);
    let (tail, head) = (walked(t), thread_head(t));
    let thread = thread_rows(t, voice);
    let shine = ramp(t, LAY.0, LAY.0 + 0.3) * (1. - 0.5 * end);
    let laying = bell(t, LAY.0, LAY.0 + 0.1, LAY.1, LAY.1 + 0.4);
    c.group("", "", master);
    c.fixed(|| "M-20 -20H340V212H-20Z".into(), &fill(COVER), 1.);
    c.group("", &lens(t, chest).svg(), 1.);

    // The floor: code, a faint grid, the dark beyond, and once laid, the way.
    let floor = [[-9., 0., 11.], [9., 0., 11.], [9., 0., -1.5], [-9., 0., -1.5]];
    let uv = if c.building() { CAM.uv(floor, [3., 2.5]) } else { String::new() };
    c.fixed_rain(|| CAM.poly(&floor), &uv, 0.07 + 0.03 * (1. - calm));
    c.fixed(floor_grid, &stroke(LINE, 0.25), 0.07);
    c.fixed(|| "M-400 -300H720V52H-400Z".into(), r#"fill="url(#nt-top)""#, 1.);
    let way = ramp(t, LAY.1, LAY.1 + 1.) * (1. - 0.6 * end);
    c.fixed(route_line, &stroke(LINE, 2.5), 0.08 * way);
    c.fixed(route_line, &stroke(LIGHT, 0.5), 0.28 * way);
    // What lies on the floor shows only past the walls before it.
    for k in 0..3 {
        let (d, a) = smudge(k, t);
        c.path(&d, r#"fill="url(#nt-smudge)""#, a);
    }
    let start = [WAY[0].0, 0., WAY[0].1];
    for j in 0..2 {
        let u = (t - SPEAK - 0.35 * j as f64) / 1.4;
        let on = (0. ..1.).contains(&u);
        let d = if on { floor_ring(&CAM, start, 0.3 + 2.6 * ease(u)) } else { String::new() };
        c.path(&d, &stroke(LIGHT, 0.6), if on { 0.7 * bell(u, 0., 0.08, 0.5, 1.) } else { 0. });
    }
    c.path(&floor_ring(&CAM, [feet[0], 0., feet[2]], 0.45), r#"fill="url(#nt-pool)""#, 0.45 + 0.35 * calm);
    let ajar = (1.28 * (1. - leaf_angle(t).cos())).min(1.28) / 2. + 0.02;
    let (reach, spread) = (1.2 + 2.2 * open, 0.15 + 0.6 * open);
    let spill = [
        [2.25 - ajar, 0., BACK - 0.05],
        [2.25 + ajar, 0., BACK - 0.05],
        [2.25 + ajar + spread, 0., BACK - reach],
        [2.25 - ajar - spread, 0., BACK - reach],
    ];
    c.path(&CAM.poly(&spill), &format!(r#"fill="{LINE}" filter="url(#nt-blur)""#), (0.25 * ramp(t, LAY.1, 10.) + 0.45 * open) * (1. - 0.5 * end));

    // Beyond the gate: its light, the thread going out, the leaves.
    let beyond = [2.25, 1., 8.6];
    c.sprite(CAM.project(beyond), (1.3 + 1.6 * open) * CAM.scale(beyond[2]), "nt-glow", 0.25 + 0.35 * ramp(t, LAY.1, 10.) + 0.4 * open);
    c.path(&thread[ROWS], &stroke(INK, 2.2), 0.3 * shine);
    c.path(&thread[ROWS], &stroke(LIGHT, 0.6), 0.95 * shine);
    let (cover, lines) = leaves(t);
    c.path(&cover, &fill(COVER), 1.);
    c.path(&lines, &stroke(LINE, 0.4), 0.7);
    let crack = (0.25 + 0.65 * ramp(t, LAY.1, 10.)) * (1. - ramp(t, SWING.0, SWING.0 + 0.6));
    c.fixed(|| CAM.line(&[[2.25, 0.05, BACK], [2.25, LEAF_TALL - 0.05, BACK]]), &stroke(LIGHT, 0.8), crack);

    // The maze, band by band from the back, each row's moving things between
    // the walls behind them and the walls before them.
    let mut specks: [[String; ROWS]; 3] = Default::default();
    for (k, rows) in specks.iter_mut().enumerate() {
        for i in 0..SPECKS {
            if let Some((p, r)) = speck(k, i, t) {
                rows[row_of(p[2]).min(ROWS - 1)].push_str(&splinter(k, i, t, p, r));
            }
        }
    }
    let swarm: [f64; 3] = std::array::from_fn(|k| 1. - ramp(t - BREAK[k], 0.3, 1.35));
    let look = format!(r#"fill="{COVER}" stroke="{LINE}" stroke-width=".35" stroke-opacity=".75""#);
    for r in (0..ROWS).rev() {
        for w in WALLS.iter().filter(|w| w.band == r && w.across) {
            let touch = w.beside.map_or(0., |near| (1. - (head - near).abs() / 0.8).max(0.)) * laying;
            wall(c, w, t, calm, touch);
        }
        if r == ROWS - 1 {
            c.raw(&gate_frame().0);
            c.fixed(|| gate_frame().1, &stroke(LIGHT, 0.5), 0.3 * calm + 0.5 * open);
        }
        for w in WALLS.iter().filter(|w| w.band == r && !w.across) {
            let touch = w.beside.map_or(0., |near| (1. - (head - near).abs() / 0.8).max(0.)) * laying;
            wall(c, w, t, calm, touch);
        }
        for k in 0..3 {
            c.path(&specks[k][r], &look, swarm[k]);
        }
        for (k, &(at, row)) in FLASH.iter().enumerate() {
            if row == r {
                let u = t - BREAK[k];
                c.sprite(CAM.project(at), 0.5 * CAM.scale(at[2]), "nt-glow", 0.9 * bell(u, 0., 0.06, 0.12, 0.7));
            }
        }
        c.path(&thread[r], &stroke(INK, 2.2), 0.3 * shine);
        c.path(&thread[r], &stroke(LIGHT, 0.6), 0.95 * shine);
        for w in WALLS.iter().filter(|w| w.band == r) {
            let (d, a) = w.debris(t);
            if w.beside.is_some() {
                c.path(&d, &format!(r#"fill="{COVER}" stroke="{LINE}" stroke-width=".35""#), a);
            } else {
                c.path(&d, &format!(r#"fill="{LIGHT}" fill-opacity=".7""#), a);
            }
        }
    }

    // The Light through the open gate floods the maze; she stands in it.
    let bloom = [2.25, 1.2, 8.2];
    c.sprite(CAM.project(bloom), mix(18., 240., ramp(t, RISE.0, RISE.1 + 1.)), "nt-bloom", 0.6 * open + 0.4 * end);
    c.path(&motes(&CAM, t, 22, 900, (0.5, 4.), (6., 10.), 3.2, 0.03), &fill(LIGHT), 0.6 * end);
    let dark = heroine_cover(COVER);
    let inner = heroine_cover("url(#nt-inner)");
    let (ink, lit) = (heroine_ink(INK), heroine_ink(LIGHT));
    let mine = Layers {
        cover: (&dark, 1.),
        code: Some((HEROINE_CODE, 0.14 * (1. - 0.6 * end))),
        glows: &[(&inner, 0.15 * calm + 0.5 * end)],
        inks: &[(&ink, 1.), (&lit, 0.2 * calm + 0.6 * end)],
    };
    heroine(c, place, b, 1., &mine);
    let speaking = bell(t, SPEAK - 0.2, SPEAK + 0.2, SPEAK + 1., SPEAK + 1.8);
    c.sprite(heroine_mark(place, HEROINE_THROAT, b), 3. + 2. * speaking, "nt-glow", 0.6 * speaking + 0.25 * calm * (1. - end));
    let moving = bell(t, LAY.0, LAY.0 + 0.3, LAY.1, LAY.1 + 0.5) + bell(t, 17., 17.3, 19.5, 20.);
    c.sprite(CAM.project(thread_at(head, t, voice)), 2.8 + 1.5 * moving, "nt-glow", shine * (1. - 0.6 * end));
    // Her voice runs along the thread ahead of her, pulse after pulse.
    let k = ((t - LAY.1) / 1.7).rem_euclid(1.);
    let bead = thread_at(mix(tail, head, k), t, voice);
    c.sprite(CAM.project(bead), 2.2, "nt-glow", 0.8 * bell(k, 0., 0.08, 0.75, 1.) * ramp(t, LAY.1, LAY.1 + 0.4) * (1. - end));
    c.end();

    // The Light, named.
    c.fixed(|| "M-20 -20H340V212H-20Z".into(), r#"fill="url(#nt-vignette)""#, 1. - 0.5 * end);
    let named = bell(t, 21.6, 22.6, 27.8, 28.6);
    c.fixed(|| ellipse((160., 42.), 125., 30.), r#"fill="url(#nt-smudge)""#, 0.55 * named);
    let place_light = format!("translate(160 {:.2}) scale(1.25)", 30. + 2. * (1. - named));
    c.words("СВЕТ", || word("СВЕТ", 0., 3.6, 10.), &fill(LIGHT), &place_light, named);
    let widths: Vec<f64> = NAMES.iter().map(|(text, _)| text_width(text, 5.2)).collect();
    let mut x = 160. - (widths.iter().sum::<f64>() + 7. * (NAMES.len() - 1) as f64) / 2.;
    for (&(text, from), width) in NAMES.iter().zip(widths) {
        let a = bell(t, from, from + 0.8, 27.8, 28.6);
        let at = format!("translate({:.2} {:.2}) scale(.52)", x + width / 2., 48. + 1.5 * (1. - a));
        c.words(text, || word(text, 0., 3.6, 10.), &fill(LINE), &at, a);
        x += width + 7.;
    }
    c.end();
}

pub fn svg() -> String {
    let mut c = Canvas::build(
        "nt",
        "Объёмный лабиринт сверху: стены из бегущих строк мыслей, по коридорам ползёт тёмный рой. Героиня заговаривает, и голос становится нитью света, которая прокладывает путь к воротам; рой рассыпается о нить. Она идёт за нитью, стены на её пути осыпаются, ворота открываются, камера поднимается, и лабиринт тает в Свете: абсолютный, целый, совершенный, один.",
        &defs(),
    );
    draw(&mut c, REST, false);
    c.finish()
}
pub fn frame(seconds: f64, reduced: bool) -> Vec<Update> {
    let reduced = reduced || !seconds.is_finite();
    let mut c = Canvas::frame("nt");
    draw(&mut c, time(seconds, reduced), reduced);
    c.updates
}

#[cfg(test)]
mod tests {
    use super::*;
    /// The cells a way passes through, in order.
    fn cells_along(way: &Way) -> Vec<Cell> {
        let mut cells: Vec<Cell> = Vec::new();
        let mut s = 0.;
        while s <= way.len() {
            let (x, z) = way.at(s);
            let cell = (((x - LEFT) / CELL).floor() as usize, (z / CELL).floor() as usize);
            if cells.last() != Some(&cell) {
                cells.push(cell);
            }
            s += 0.05;
        }
        cells
    }
    #[test]
    fn the_way_out_runs_through_open_passages() {
        // One way between any two cells: 29 passages joining all 30.
        assert!(OPEN.iter().all(|&(a, b)| a.0.abs_diff(b.0) + a.1.abs_diff(b.1) == 1));
        let mut reached = vec![(0, 0)];
        let mut i = 0;
        while i < reached.len() {
            let here = reached[i];
            for &(a, b) in &OPEN {
                for (p, q) in [(a, b), (b, a)] {
                    if p == here && !reached.contains(&q) {
                        reached.push(q);
                    }
                }
            }
            i += 1;
        }
        assert_eq!(reached.len(), COLS * ROWS);
        let cells = cells_along(&ROUTE);
        assert_eq!(cells[0], (1, 0));
        for w in cells.windows(2) {
            if w[1].1 == ROWS {
                assert_eq!(w, [(GATE, ROWS - 1), (GATE, ROWS)]);
            } else {
                assert!(open(w[0], w[1]), "{w:?}");
            }
        }
        assert_eq!(cells[cells.len() - 1], (GATE, ROWS));
        // She steps through the gate and stops in the light.
        assert!((walked(WALK.1) - go()).abs() < 1e-9 && ROUTE.at(go()).1 > BACK);
        assert!((0..400).all(|i| walked(i as f64 * 0.075) <= walked((i + 1) as f64 * 0.075)));
    }
    #[test]
    fn the_swarm_creeps_through_open_passages() {
        for way in SWARM_WAYS.iter() {
            for w in cells_along(way).windows(2) {
                assert!(open(w[0], w[1]), "{w:?}");
            }
        }
    }
    #[test]
    fn walls_along_her_way_fall_before_she_reaches_them() {
        assert_eq!(WALLS.len(), 35);
        assert_eq!(WALLS.iter().filter(|w| w.thought.is_some()).count(), THOUGHTS.len());
        let lining: Vec<&Wall> = WALLS.iter().filter(|w| w.beside.is_some()).collect();
        assert_eq!(lining.len(), 14);
        for w in lining {
            let near = w.beside.unwrap();
            assert!(w.shown(arrive(near).max(WALK.0)).0 < 0.05, "{:?}", w.mid);
            // Not before the thread has shown the way.
            assert!(w.fall >= LAY.1 - 1e-9, "{:?}", w.mid);
        }
    }
    #[test]
    fn the_swarm_breaks_before_it_touches_her_or_the_thread() {
        for k in 0..3 {
            assert!(BREAK[k] < LAY.1, "{k} breaks at {}", BREAK[k]);
            let mut t = 0.;
            while t < BREAK[k] {
                let (feet, _) = her(t);
                let voice = throat(t);
                let (tail, head) = (walked(t), thread_head(t));
                for i in 0..SPECKS {
                    let Some((p, _)) = speck(k, i, t) else { continue };
                    assert!(apart((p[0], p[2]), (feet[0], feet[2])) > 0.5, "{k} {i} {t}");
                    let mut s = tail;
                    while s < head {
                        let q = thread_at(s, t, voice);
                        assert!(dot(sub(p, q), sub(p, q)).sqrt() > 0.5, "{k} {i} {t}");
                        s += 0.1;
                    }
                }
                t += 0.05;
            }
        }
    }
    #[test]
    fn the_gate_is_open_to_the_light() {
        for w in WALLS.iter() {
            let across_it = w.z.0 <= BACK && w.z.1 >= BACK && w.x.0 < HINGES[1] && w.x.1 > HINGES[0];
            assert!(!across_it, "{:?}", w.mid);
        }
        assert!(leaf_angle(SWING.1).to_degrees() > 99.);
    }
    #[test]
    fn the_loop_fades_through_darkness() {
        let master = |s: f64| {
            frame(s, false)
                .into_iter()
                .find(|u| u.selector == ".nt-0" && u.attribute == "opacity")
                .unwrap()
                .value
                .parse::<f64>()
                .unwrap()
        };
        assert!(master(PERIOD - 0.02) < 0.05 && master(0.) < 0.05);
        assert!(master(REST) > 0.99);
    }
}
