//! «Тише шума», page 09 of Step 6 «Внутреннее кольцо». Art's painting
//! «Струны» cut into layers: a figure woven of still strings (Art's pick of
//! three abstract heroes, 2026-11-21) stands in a night land made of taut
//! gold strings. Near him they vibrate into a land of noise, and
//! five sharp spikes rise out of it, each with its sign over the tip: a
//! thought cloud full of scribbled words, a chain of bubbles, a heart with a
//! pulse line, a lightning bolt, a whirlpool. Far away the strings lie calm.
//!
//! The layers (assets/): `background` the land of noise with the spikes and
//! signs as Art chose it; `terrain` the same land without them, only behind
//! them; `quiet` the land with every string calm; `figure` him, woven of strings, cut out;
//! `depth` how near every pixel of the noise land (R) and of the quiet land
//! (G) is. The camera drifts and comes close through the depth map, so the
//! land slides under him and the sky stays far.
//!
//! The beats, phrase by phrase:
//! «Тише шума.» The noise rolls in over the quiet strings from the horizon
//! to his feet and the five spikes shoot up as it reaches them.
//! «Не вовлекайся во внутреннее содержание»: words write themselves into the
//! thought cloud; the warm second ring notices it (four warm brackets close
//! on the sign and flash), the sign fades and the spike sinks; where it
//! stood the strings go calm.
//! «Не анализируй историю мысли»: the chain lights bubble by bubble; noticed,
//! it goes out from its small end and sinks.
//! «Не отталкивай эмоцию и не проваливайся в нее»: the heart beats, a warm
//! swell leaves its spike over the land, passes through him and goes on.
//! «Замечай — но не обуславливайся»: the bolt flickers, the whirlpool turns;
//! each is noticed and sinks; he stays as he is.
//! «Второй уровень…»: the camera comes close; the warm ring climbs him and
//! fills him with its light from the shins to the crown.
//! «Когда оба кольца активны…»: the camera cranes; both rings brighten and
//! cold pulses run out over the land.
//! «…тише становится старый ментальный шум…»: from his feet outward every
//! string goes calm.
//! «…яснее звучит потенциальность Присутствия через твою форму»: calm light
//! runs out along the strings, a light rises through him from the soles to
//! the crown and goes on up as a thin tone into the sky.
//!
//! Every value here is a pure function of loop time; `browser.rs` uploads it
//! and `scene.frag` paints it. Positions are the painting's own pixels
//! (1536 × 1024, y down); the ground in metres, him at the origin.
use std::f32::consts::{PI, TAU};
use watcher_scene_palette::Palette;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::InnerQuiet;

/// The painting's canvas, in its own pixels (y down).
pub const SIZE: [f32; 2] = [1536.0, 1024.0];
pub const LOOP_SECONDS: f32 = 70.0;
/// Reduced motion: the noise is up, all five spikes stand with their signs and
/// words are writing themselves into the thought cloud.
pub const STILL: f32 = 6.0;

/// The painting's camera: the horizon row, the column straight ahead, the
/// focal length in px, the eye's height and his distance, metres.
pub const HORIZON: f32 = 405.0;
pub const AXIS: f32 = 770.0;
pub const FOCAL: f32 = 1647.0;
pub const EYE: f32 = 1.425;
pub const DISTANCE: f32 = 5.87;
/// His soles and the top of his head (px), the middle of his head (x).
pub const FEET: f32 = 805.0;
pub const CROWN: f32 = 300.0;
pub const HEAD_X: f32 = 769.5;
/// The depth map stores closeness / this (closeness 1: his distance).
pub const DEPTH_MAX: f32 = 1.75;
/// Closeness of a ground point to him: 1 / (1 + metres / this).
pub const CLOSE_METRES: f32 = 3.0;

/// The share of the painting the page shows: the rest is the camera's margin.
pub const ZOOM: f32 = 0.95;
/// The camera scales about this point (his knees) when it comes close.
pub const PIVOT: [f32; 2] = [770.0, 560.0];
/// How close it comes, and how much nearer things grow more than far ones.
pub const NEAR_ZOOM: f32 = 1.15;
pub const PARALLAX: f32 = 0.04;
/// The sideways drift and the crane, px at his closeness.
pub const DRIFT: f32 = 8.0;
pub const CRANE: f32 = 12.0;

/// The noise rolls in from the horizon to his feet over these seconds (its
/// front in closeness goes from below the sky's 0 to past his 1), and at the
/// end the calm goes out from his feet to the horizon.
pub const OPEN: [f32; 2] = [0.2, 3.6];
pub const END: [f32; 2] = [57.0, 63.0];
/// A spike shoots up this long after the noise reaches its foot, and takes
/// this long; it sinks in this long.
pub const RISE_DELAY: f32 = 0.2;
pub const RISE_SECONDS: f32 = 1.2;
pub const SINK_SECONDS: f32 = 1.6;
/// The warm brackets close on a sign over this long before it is noticed.
pub const BRACKET_SECONDS: f32 = 0.9;
/// Where a spike sank the strings go calm: an oval round its foot, this many
/// times its half width across and this share of the land from the horizon
/// to its foot high, growing over this long, starting this long after the sink.
pub const PATCH_REACH: f32 = 1.5;
pub const PATCH_DEPTH: f32 = 0.9;
pub const PATCH_SECONDS: f32 = 2.5;
pub const PATCH_DELAY: f32 = 0.6;

/// The beats of the signs. Words write into the cloud.
pub const WORDS: [f32; 2] = [4.5, 9.3];
/// The chain lights bubble by bubble, then goes out from its small end.
pub const CHAIN_LIGHT: [f32; 2] = [12.5, 15.5];
pub const CHAIN_OUT: [f32; 2] = [17.6, 18.6];
/// The heart beats (lub-dub every `HEARTBEAT_SECONDS`).
pub const HEARTBEAT: [f32; 2] = [20.5, 26.0];
pub const HEARTBEAT_SECONDS: f32 = 1.1;
/// The warm swell leaves the heart's foot, metres per second, and fades.
pub const SWELL: [f32; 2] = [21.0, 26.8];
pub const SWELL_SPEED: f32 = 4.2;
/// The bolt flickers; the whirlpool turns.
pub const FLICKER: [f32; 2] = [29.3, 31.8];
pub const SWIRL: [f32; 2] = [31.0, 34.6];
/// «Второй уровень»: close; the warm ring fills him (fades over FILL_OUT).
pub const CLOSE: [f32; 4] = [37.5, 42.0, 46.0, 51.0];
pub const FILL: [f32; 2] = [40.0, 45.0];
pub const FILL_OUT: [f32; 2] = [46.0, 49.0];
/// «Когда оба кольца активны»: rings bright, cold pulses out over the land.
pub const BRIGHT: [f32; 4] = [46.5, 48.0, 52.0, 53.5];
pub const PULSES: [f32; 4] = [46.0, 47.0, 52.5, 54.0];
/// The crane, its up and down.
pub const CRANE_SPAN: [f32; 2] = [46.0, 55.0];
/// The close: calm light along the strings, a light up through him, the tone.
pub const CALM: [f32; 4] = [63.0, 64.5, 68.5, 69.8];
pub const RISE_THROUGH: [f32; 2] = [63.5, 66.0];
pub const TONE: [f32; 4] = [65.0, 66.0, 68.5, 69.5];

/// The first ring (cold) slides over a sphere round him: its centre height
/// and radius, metres, and one sweep down and up in `COLD_SECONDS`.
pub const SPHERE: [f32; 2] = [0.95, 1.2];
pub const COLD_SECONDS: f32 = 14.0;
/// The second ring (warm) climbs his body and back: lowest and highest
/// height, its radius, metres, `WARM_SECONDS` a climb and a return.
pub const WARM_SPAN: [f32; 2] = [0.35, 1.8];
pub const WARM_RADIUS: f32 = 0.32;
pub const WARM_SECONDS: f32 = 10.0;
/// The runners' turns a loop: the cold one way, the warm the other.
pub const COLD_TURNS: f32 = 7.0;
pub const WARM_TURNS: f32 = -10.0;
/// The rings' light at rest and at «оба кольца активны».
pub const RING_LIGHT: [f32; 2] = [0.55, 1.1];

/// Whole cycles a loop: the falling code in the sky, the motes' climbs, the
/// shimmer flowing toward the camera over the noise.
pub const RAIN_CYCLES: f32 = 35.0;
pub const MOTE_LAPS: f32 = 5.0;
pub const MOTES: usize = 18;
pub const SHIMMER_CYCLES: f32 = 14.0;

/// One spike as Art painted it, px: its apex, the row of its foot, its half
/// width at the foot; its sign's centre and radius; how near the tip is
/// (closeness, from the depth map); when it is noticed and starts to sink.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Spike {
    pub apex: [f32; 2],
    pub foot: f32,
    pub half: f32,
    pub sign: [f32; 3],
    pub tip: f32,
    pub notice: f32,
    pub sink: f32,
}

pub const SPIKES: [Spike; 5] = [
    // The thought cloud with its scribbled words.
    Spike {
        apex: [262.0, 245.0],
        foot: 600.0,
        half: 200.0,
        sign: [277.0, 160.0, 62.0],
        tip: 0.62,
        notice: 9.6,
        sink: 10.2,
    },
    // The chain of bubbles.
    Spike {
        apex: [487.0, 305.0],
        foot: 470.0,
        half: 62.0,
        sign: [497.0, 275.0, 46.0],
        tip: 0.27,
        notice: 17.4,
        sink: 18.6,
    },
    // The heart with its pulse line.
    Spike {
        apex: [928.0, 208.0],
        foot: 520.0,
        half: 110.0,
        sign: [925.0, 150.0, 54.0],
        tip: 0.34,
        notice: 26.6,
        sink: 27.2,
    },
    // The bolt.
    Spike {
        apex: [1112.0, 300.0],
        foot: 520.0,
        half: 75.0,
        sign: [1112.0, 250.0, 34.0],
        tip: 0.36,
        notice: 31.9,
        sink: 32.3,
    },
    // The whirlpool.
    Spike {
        apex: [1330.0, 255.0],
        foot: 600.0,
        half: 150.0,
        sign: [1327.0, 206.0, 42.0],
        tip: 0.46,
        notice: 34.9,
        sink: 35.3,
    },
];

/// The scribbles inside the thought cloud: centre and radius, px.
pub const WORDS_DISC: [f32; 3] = [278.0, 160.0, 36.0];
/// The chain's bubbles, big to small: centre and half axes, px.
pub const BUBBLES: [[f32; 4]; 3] = [
    [479.0, 261.0, 27.0, 17.0],
    [512.0, 285.0, 14.0, 9.0],
    [530.0, 299.0, 9.0, 6.0],
];

/// A ground point in metres (x across, z away from the eye) for a painting
/// row below the horizon.
pub fn ground(p: [f32; 2]) -> Option<[f32; 2]> {
    let below = p[1] - HORIZON;
    if below.partial_cmp(&0.5) != Some(std::cmp::Ordering::Greater) {
        return None;
    }
    let z = FOCAL * EYE / below;
    Some([(p[0] - AXIS) * z / FOCAL, z])
}

/// How close a ground point is to him: 1 at his feet, toward 0 far away.
pub fn closeness(ground: [f32; 2]) -> f32 {
    1.0 / (1.0 + ground[0].hypot(ground[1] - DISTANCE) / CLOSE_METRES)
}

/// A world point (metres: x across, y up, z away) in the painting: its px
/// and its closeness (1 at his distance).
pub fn project(world: [f32; 3]) -> ([f32; 2], f32) {
    let z = world[2].max(0.1);
    (
        [
            AXIS + FOCAL * world[0] / z,
            HORIZON + FOCAL * (EYE - world[1]) / z,
        ],
        DISTANCE / z,
    )
}

/// Where the camera shows a painting point of closeness `s` (the shader's
/// `view`): it scales about `PIVOT`, nearer things more, and shifts nearer
/// things more.
pub fn view(cam: [f32; 4], p: [f32; 2], s: f32) -> [f32; 2] {
    let k = cam[2] * (1.0 + cam[3] * (s - 1.0));
    [0, 1].map(|i| PIVOT[i] + (p[i] - PIVOT[i]) * k + cam[i] * s)
}

/// The painting point the camera shows at `q` for closeness `s`.
pub fn unview(cam: [f32; 4], q: [f32; 2], s: f32) -> [f32; 2] {
    let k = cam[2] * (1.0 + cam[3] * (s - 1.0));
    [0, 1].map(|i| PIVOT[i] + (q[i] - cam[i] * s - PIVOT[i]) / k)
}

/// The painting window a canvas shows, in painting px: centre x, y, width,
/// height. Any canvas is covered with a crop of the window, never stretched,
/// kept on him.
pub fn window(width: f32, height: f32) -> [f32; 4] {
    let full = [SIZE[0] * ZOOM, SIZE[1] * ZOOM];
    let mid = [AXIS, SIZE[1] * 0.5];
    if !(width > 0.0 && height > 0.0) {
        return [mid[0], mid[1], full[0], full[1]];
    }
    let scale = (width / full[0]).max(height / full[1]);
    let shown = [width / scale, height / scale];
    let rise = ((full[1] - shown[1]) * 0.5).max(0.0);
    // A wide crop keeps him whole: from just over his crown to his soles.
    let body = (CROWN + FEET) * 0.5;
    // max/min, not clamp: clamp's runtime bound check links the panic formatter.
    [
        mid[0],
        body.max(mid[1] - rise).min(mid[1] + rise),
        shown[0],
        shown[1],
    ]
}

/// The spikes' and signs' geometry as the shader's `u_geo`: per spike
/// (apex x, apex y, foot row, half width), (sign x, y, radius, tip
/// closeness), (foot x, z metres, half width metres, foot closeness).
pub fn geometry() -> [f32; 60] {
    let mut g = [0.0; 60];
    for (i, s) in SPIKES.iter().enumerate() {
        let foot = ground([s.apex[0], s.foot]).unwrap_or([0.0, DISTANCE]);
        let rows = [
            [s.apex[0], s.apex[1], s.foot, s.half],
            [s.sign[0], s.sign[1], s.sign[2], s.tip],
            [foot[0], foot[1], s.half * foot[1] / FOCAL, closeness(foot)],
        ];
        for (r, row) in rows.iter().enumerate() {
            g[i * 12 + r * 4..i * 12 + r * 4 + 4].copy_from_slice(row);
        }
    }
    g
}

/// When the noise front reaches a ground point of closeness `c`.
pub fn open_arrival(c: f32) -> f32 {
    OPEN[0] + (OPEN[1] - OPEN[0]) * (c + 0.05) / 1.15
}

/// When a spike starts to rise: just after the noise reaches its foot.
pub fn rise_start(spike: &Spike) -> f32 {
    let foot = ground([spike.apex[0], spike.foot]).unwrap_or([0.0, DISTANCE]);
    open_arrival(closeness(foot)) + RISE_DELAY
}

/// One spike's state in a frame.
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct SpikeFrame {
    /// Its height as a share of the painted one (overshoots as it shoots up).
    pub height: f32,
    /// Its sign's opacity, and the sign's own light (its beat).
    pub sign: f32,
    pub gain: f32,
    /// The calm oval where it sank: 0 none, 1 grown.
    pub patch: f32,
    /// The warm brackets: 0..1 closing, 1 the notice, past 1 fading.
    pub bracket: f32,
    pub bracket_light: f32,
    /// How far its tip sways, px.
    pub sway: f32,
    /// The sign's own beat: the words' progress, the bubbles lit, the
    /// whirlpool's turn.
    pub special: f32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub time: f32,
    /// Shift x, y (px at closeness 1), zoom, parallax.
    pub cam: [f32; 4],
    /// The noise front, the calm front (closeness), their glows.
    pub land: [f32; 4],
    /// Per ring (cold, warm): centre, A | B, runner angle, light. The ring is
    /// centre + A sin θ + B cos θ in the camera's view, its front at θ = 0.
    pub rings: [[f32; 4]; 4],
    /// (fill row, fill), (rise row, rise), (tone, tone phase, pulses, pulse
    /// phase), (calm, calm phase, swell metres, swell), (rain, motes,
    /// shimmer, loop phase).
    pub fx: [[f32; 4]; 4],
    pub spikes: [SpikeFrame; 5],
}

fn ramp(t: f32, a: f32, b: f32) -> f32 {
    let x = ((t - a) / (b - a)).clamp(0.0, 1.0);
    x * x * (3.0 - 2.0 * x)
}
fn span(t: f32, k: [f32; 4]) -> f32 {
    ramp(t, k[0], k[1]) * (1.0 - ramp(t, k[2], k[3]))
}
fn linear(t: f32, a: f32, b: f32) -> f32 {
    ((t - a) / (b - a)).clamp(0.0, 1.0)
}
/// Shoots up past its height and settles.
fn overshoot(x: f32) -> f32 {
    let (c1, c3) = (1.70158, 2.70158);
    let y = x - 1.0;
    1.0 + c3 * y * y * y + c1 * y * y
}
fn hash(n: f32) -> f32 {
    ((n * 12.9898).sin() * 43_758.547).fract().abs()
}

/// The cold ring's height (metres) at `t`: it slides over the sphere.
pub fn cold_height(t: f32) -> f32 {
    SPHERE[0] + SPHERE[1] * (0.17 + 0.75 * (TAU * t / COLD_SECONDS).cos())
}
/// The warm ring's height: up his body and back.
pub fn warm_height(t: f32) -> f32 {
    WARM_SPAN[0] + (WARM_SPAN[1] - WARM_SPAN[0]) * (0.5 - 0.5 * (TAU * t / WARM_SECONDS).cos())
}

/// A level ring round him (height, radius, metres) as the camera shows it.
pub fn ring(cam: [f32; 4], height: f32, radius: f32) -> [[f32; 2]; 3] {
    let at = |x: f32, z: f32| {
        let (p, s) = project([x, height, z]);
        view(cam, p, s)
    };
    let front = at(0.0, DISTANCE - radius);
    let back = at(0.0, DISTANCE + radius);
    let right = at(radius, DISTANCE);
    let left = at(-radius, DISTANCE);
    let centre = [0, 1].map(|i| (front[i] + back[i] + right[i] + left[i]) * 0.25);
    [
        centre,
        [0, 1].map(|i| (right[i] - left[i]) * 0.5),
        [0, 1].map(|i| (front[i] - back[i]) * 0.5),
    ]
}

fn spike_frame(i: usize, s: &Spike, t: f32) -> SpikeFrame {
    let rise = rise_start(s);
    let height = if t < rise {
        0.0
    } else if t < rise + RISE_SECONDS {
        overshoot((t - rise) / RISE_SECONDS)
    } else if t < s.sink {
        1.0
    } else {
        1.0 - ramp(t, s.sink, s.sink + SINK_SECONDS)
    };
    let up = rise + RISE_SECONDS;
    let sign = ramp(t, up, up + 0.6) * (1.0 - ramp(t, s.notice + 0.15, s.sink));
    let fade = 1.0 - ramp(t, s.notice, s.sink);
    let (gain, special) = match i {
        0 => (
            ramp(t, WORDS[0], WORDS[0] + 0.5) * fade,
            linear(t, WORDS[0], WORDS[1]),
        ),
        1 => (
            ramp(t, CHAIN_LIGHT[0], CHAIN_LIGHT[0] + 0.3)
                * (1.0 - ramp(t, CHAIN_OUT[0], CHAIN_OUT[1])),
            3.0 * linear(t, CHAIN_LIGHT[0], CHAIN_LIGHT[1])
                + 3.0 * linear(t, CHAIN_OUT[0], CHAIN_OUT[1]),
        ),
        2 => {
            let at = (t - HEARTBEAT[0]).max(0.0) % HEARTBEAT_SECONDS;
            let pulse = |c: f32| (-((at - c) / 0.07).powi(2)).exp();
            let beat = pulse(0.0) + 0.6 * pulse(0.28) + pulse(HEARTBEAT_SECONDS);
            let on =
                ramp(t, HEARTBEAT[0] - 0.2, HEARTBEAT[0]) * (1.0 - ramp(t, HEARTBEAT[1], s.sink));
            (on * beat, 0.0)
        }
        3 => {
            let flick = if hash((t * 12.0).floor()) > 0.45 {
                1.0
            } else {
                0.15
            };
            (
                span(
                    t,
                    [FLICKER[0], FLICKER[0] + 0.2, FLICKER[1] - 0.2, FLICKER[1]],
                ) * flick,
                0.0,
            )
        }
        _ => (
            ramp(t, SWIRL[0], SWIRL[0] + 0.6) * (1.0 - ramp(t, SWIRL[1] - 0.2, s.sink)),
            0.55 * (t - SWIRL[0]).max(0.0).powi(2),
        ),
    };
    let grow = ramp(
        t,
        s.sink + PATCH_DELAY,
        s.sink + PATCH_DELAY + PATCH_SECONDS,
    );
    let bracket = ((t - (s.notice - BRACKET_SECONDS)) / BRACKET_SECONDS).clamp(0.0, 2.0);
    let bracket_light = if t < s.notice - BRACKET_SECONDS {
        0.0
    } else {
        ramp(bracket, 0.0, 0.25) * (1.0 - ramp(bracket, 1.15, 1.8))
    };
    let sway = 3.0 * (TAU * t / (3.1 + 0.7 * i as f32) + 1.3 * i as f32).sin();
    SpikeFrame {
        height,
        sign,
        gain,
        patch: grow,
        bracket,
        bracket_light,
        sway,
        special,
    }
}

pub fn compose(t: f32) -> Frame {
    let time = if t.is_finite() {
        t.rem_euclid(LOOP_SECONDS)
    } else {
        0.0
    };
    let phase = time / LOOP_SECONDS;
    let zoom =
        1.0 + (NEAR_ZOOM - 1.0) * (ramp(time, CLOSE[0], CLOSE[1]) - ramp(time, CLOSE[2], CLOSE[3]));
    let crane = if (CRANE_SPAN[0]..CRANE_SPAN[1]).contains(&time) {
        (PI * (time - CRANE_SPAN[0]) / (CRANE_SPAN[1] - CRANE_SPAN[0]))
            .sin()
            .powi(2)
    } else {
        0.0
    };
    let cam = [
        DRIFT * (TAU * phase).sin(),
        CRANE * crane,
        zoom,
        PARALLAX * (zoom - 1.0) / (NEAR_ZOOM - 1.0),
    ];
    let open = linear(time, OPEN[0], OPEN[1]);
    let end = linear(time, END[0], END[1]);
    let land = [
        -0.05 + 1.15 * open,
        1.1 - 1.15 * end,
        (PI * open).sin(),
        (PI * end).sin(),
    ];
    let light = RING_LIGHT[0] + (RING_LIGHT[1] - RING_LIGHT[0]) * span(time, BRIGHT);
    let cold = cold_height(time);
    let cold_radius = (SPHERE[1].powi(2) - (cold - SPHERE[0]).powi(2))
        .max(0.0)
        .sqrt();
    let warm = warm_height(time);
    let [c0, a0, b0] = ring(cam, cold, cold_radius);
    let [c1, a1, b1] = ring(cam, warm, WARM_RADIUS);
    let rings = [
        [c0[0], c0[1], a0[0], a0[1]],
        [
            b0[0],
            b0[1],
            (TAU * COLD_TURNS * phase).rem_euclid(TAU),
            light,
        ],
        [c1[0], c1[1], a1[0], a1[1]],
        [
            b1[0],
            b1[1],
            (TAU * WARM_TURNS * phase).rem_euclid(TAU),
            light,
        ],
    ];
    // The fill follows the warm ring up him, then holds at his crown.
    let fill_row = if time < FILL[1] {
        project([0.0, warm, DISTANCE]).0[1]
    } else {
        CROWN - 30.0
    };
    let fill = ramp(time, FILL[0], FILL[0] + 1.0) * (1.0 - ramp(time, FILL_OUT[0], FILL_OUT[1]));
    let through = linear(time, RISE_THROUGH[0], RISE_THROUGH[1]);
    let rise = ramp(time, RISE_THROUGH[0], RISE_THROUGH[0] + 0.5)
        * (1.0 - ramp(time, RISE_THROUGH[1], RISE_THROUGH[1] + 1.5));
    let fx = [
        [fill_row, fill, FEET + (CROWN - 30.0 - FEET) * through, rise],
        [
            span(time, TONE),
            (time * 0.8).fract(),
            span(time, PULSES),
            (time * 0.5).fract(),
        ],
        [
            span(time, CALM),
            (time * 0.25).fract(),
            (time - SWELL[0]).max(0.0) * SWELL_SPEED,
            ramp(time, SWELL[0], SWELL[0] + 0.5) * (1.0 - ramp(time, SWELL[1] - 1.3, SWELL[1])),
        ],
        [
            (phase * RAIN_CYCLES).fract(),
            (phase * MOTE_LAPS).fract(),
            (phase * SHIMMER_CYCLES).fract(),
            phase,
        ],
    ];
    let spikes = std::array::from_fn(|i| spike_frame(i, &SPIKES[i], time));
    Frame {
        time,
        cam,
        land,
        rings,
        fx,
        spikes,
    }
}

/// The spikes' frame values as the shader's `u_spike`.
pub fn spike_uniforms(f: &Frame) -> [f32; 40] {
    let mut u = [0.0; 40];
    for (i, s) in f.spikes.iter().enumerate() {
        u[i * 8..i * 8 + 8].copy_from_slice(&[
            s.height,
            s.sign,
            s.gain,
            s.patch,
            s.bracket,
            s.bracket_light,
            s.sway,
            s.special,
        ]);
    }
    u
}

/// How one theme maps the painting and lights it.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Look {
    /// The recolor of the painting (scene-palette `recolor.frag`): 0 the
    /// accent by luminance (Искра, Матрица), 2 an ink on the paper (Тишина, Астрал).
    pub mode: f32,
    pub paper: [f32; 3],
    pub accent: [f32; 3],
    pub highlight: [f32; 3],
    /// The first ring, the noise's front, the pulses.
    pub cold: [f32; 3],
    /// The second ring, its brackets, the swell, the light through him.
    pub warm: [f32; 3],
    /// White-hot cores.
    pub pale: [f32; 3],
}

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}

/// The app theme by its `graphicsPalette` code: 0 Искра, 2 Тишина, 3 Астрал,
/// 4 Матрица. The site has only these dark themes; any other code shows Тишина.
pub fn look(code: u32) -> Look {
    let (palette, warm, pale) = match Palette::from_code(code) {
        Palette::Dark => (Palette::Dark, rgb(255, 122, 40), rgb(255, 244, 170)),
        Palette::Violet => (Palette::Violet, rgb(240, 158, 128), rgb(200, 212, 248)),
        Palette::Matrix => (Palette::Matrix, rgb(255, 184, 64), rgb(190, 255, 205)),
        _ => (Palette::Neutral, rgb(242, 179, 117), rgb(214, 218, 210)),
    };
    let colors = palette.colors().expect("a dark theme has its colors");
    Look {
        mode: palette.mode(),
        paper: colors.paper,
        accent: colors.accent,
        highlight: colors.highlight,
        cold: colors.accent,
        warm,
        pale,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    /// The land's noise share at a ground closeness, as the shader mixes it.
    fn noise_share(f: &Frame, c: f32) -> f32 {
        let s = |x: f32| ramp(x, -0.04, 0.04);
        s(f.land[0] - c) * (1.0 - s(c - f.land[1]))
    }

    #[test]
    fn the_loop_closes_on_the_quiet_land() {
        let (a, b) = (compose(LOOP_SECONDS - 0.001), compose(0.001));
        for c in [0.0, 0.1, 0.5, 1.0] {
            assert_eq!(noise_share(&a, c), 0.0);
            assert_eq!(noise_share(&b, c), 0.0);
        }
        for i in 0..4 {
            assert!(close(a.cam[i], b.cam[i], 0.01), "{i}");
        }
        for (r, (ra, rb)) in a.rings.iter().zip(b.rings.iter()).enumerate() {
            for k in 0..4 {
                if r % 2 == 1 && k == 2 {
                    // The runner's angle wraps.
                    assert!(
                        close(ra[k].sin(), rb[k].sin(), 0.01)
                            && close(ra[k].cos(), rb[k].cos(), 0.01)
                    );
                } else {
                    assert!(close(ra[k], rb[k], 0.05), "{ra:?} {rb:?}");
                }
            }
        }
        for f in [a, b] {
            // Fill, rise; tone, pulses; calm, swell: all out.
            for (row, k) in [(0, 1), (0, 3), (1, 0), (1, 2), (2, 0), (2, 3)] {
                assert!(f.fx[row][k] < 1e-3, "{row} {k} {}", f.time);
            }
            for s in f.spikes {
                assert_eq!(
                    (s.height, s.sign, s.gain, s.bracket_light),
                    (0.0, 0.0, 0.0, 0.0)
                );
            }
            // The calm ovals' warm rims are gone.
            for s in f.spikes {
                assert!(s.patch < 1e-3 || s.patch > 1.0 - 1e-3);
            }
        }
        for cycles in [
            RAIN_CYCLES,
            MOTE_LAPS,
            SHIMMER_CYCLES,
            COLD_TURNS,
            WARM_TURNS,
            LOOP_SECONDS / COLD_SECONDS,
            LOOP_SECONDS / WARM_SECONDS,
        ] {
            assert_eq!(cycles.fract(), 0.0);
        }
    }

    #[test]
    fn each_spike_rises_after_the_noise_reaches_it_and_sinks_once_noticed() {
        let g = geometry();
        let mut last = 0.0;
        for (i, s) in SPIKES.iter().enumerate() {
            let rise = rise_start(s);
            // Its foot is noise before it starts to rise.
            assert!(noise_share(&compose(rise), g[i * 12 + 11]) > 0.99, "{i}");
            assert!(rise + RISE_SECONDS + 0.6 < STILL);
            assert!(s.notice > last && s.sink > s.notice, "{i}");
            last = s.sink;
            let f = compose(STILL);
            assert_eq!(f.spikes[i].height, 1.0);
            assert_eq!(f.spikes[i].sign, 1.0);
            // The sign is gone when it starts to sink; the spike is down after.
            assert_eq!(compose(s.sink).spikes[i].sign, 0.0);
            assert_eq!(compose(s.sink + SINK_SECONDS + 0.01).spikes[i].height, 0.0);
            // The brackets close before the notice and are gone soon after.
            let before = compose(s.notice - 0.3).spikes[i];
            assert!(before.bracket > 0.5 && before.bracket < 1.0 && before.bracket_light > 0.9);
            assert_eq!(compose(s.notice + 1.0).spikes[i].bracket_light, 0.0);
        }
        // All of them are down well before the calm spreads.
        assert!(last + SINK_SECONDS + PATCH_DELAY + PATCH_SECONDS < END[0]);
    }

    #[test]
    fn the_swell_passes_through_him_while_the_heart_beats() {
        let g = geometry();
        let far = g[2 * 12 + 8].hypot(g[2 * 12 + 9] - DISTANCE);
        let at = SWELL[0] + far / SWELL_SPEED;
        assert!(at > HEARTBEAT[0] && at < HEARTBEAT[1], "{at}");
        assert!(compose(at).fx[2][3] > 0.99);
    }

    #[test]
    fn the_warm_ring_fills_him_from_the_shins_to_the_crown() {
        let start = compose(FILL[0] + 0.01).fx[0][0];
        let top = compose(FILL[1] - 0.01).fx[0][0];
        assert!(start > 650.0 && start < FEET, "{start}");
        assert!(top < CROWN + 10.0, "{top}");
        assert!(compose(FILL_OUT[1]).fx[0][1] < 1e-3);
    }

    #[test]
    fn the_rings_stay_round_him() {
        for i in 0..=700 {
            let f = compose(i as f32 * 0.1);
            for r in [0, 2] {
                let (c, a, b) = (f.rings[r], f.rings[r], f.rings[r + 1]);
                assert!((c[0] - AXIS).abs() < 40.0, "{c:?}");
                assert!(c[1] > CROWN - 160.0 && c[1] < FEET + 60.0, "{c:?}");
                assert!(a[2] > 20.0 && a[3].abs() < 1.0, "{a:?}");
                assert!(b[0].abs() < 5.0 && b[3] >= RING_LIGHT[0] - 1e-6);
            }
        }
        // Seen from above the front is lower in the frame than the back.
        let [_, _, b] = ring([0.0, 0.0, 1.0, 0.0], 0.5, 0.5);
        assert!(b[1] > 0.0);
    }

    #[test]
    fn values_stay_finite() {
        for i in 0..=7000 {
            let f = compose(i as f32 * 0.01);
            let spikes = spike_uniforms(&f);
            let all = f
                .cam
                .iter()
                .chain(f.land.iter())
                .chain(f.rings.iter().flatten())
                .chain(f.fx.iter().flatten())
                .chain(spikes.iter());
            for v in all {
                assert!(v.is_finite());
            }
            assert!(f.cam[2] >= 1.0 && f.cam[2] <= NEAR_ZOOM + 1e-6);
            for s in f.spikes {
                assert!(s.height >= 0.0 && s.height < 1.15);
                assert!((0.0..=1.0).contains(&s.sign));
            }
        }
        assert_eq!(compose(f32::NAN), compose(0.0));
        assert_eq!(compose(-LOOP_SECONDS), compose(0.0));
    }

    #[test]
    fn the_camera_never_shows_an_edge() {
        let w = window(1536.0, 1024.0);
        for i in 0..=1400 {
            let f = compose(i as f32 * 0.05);
            for corner in [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] {
                let q = [w[0] + corner[0] * w[2], w[1] + corner[1] * w[3]];
                for s in [0.0, 0.069, 0.5, 1.0, DEPTH_MAX] {
                    let p = unview(f.cam, q, s);
                    assert!(p[0] >= 0.0 && p[0] <= SIZE[0], "{} {p:?}", f.time);
                    assert!(p[1] >= 0.0 && p[1] <= SIZE[1], "{} {p:?}", f.time);
                }
            }
        }
        // view and unview undo each other.
        let cam = compose(44.0).cam;
        let p = unview(cam, view(cam, [300.0, 700.0], 1.3), 1.3);
        assert!(close(p[0], 300.0, 1e-3) && close(p[1], 700.0, 1e-3));
    }

    #[test]
    fn a_canvas_of_any_shape_is_covered_without_stretching() {
        let full = window(1536.0, 1024.0);
        assert!(close(full[2], SIZE[0] * ZOOM, 1e-3) && close(full[3], SIZE[1] * ZOOM, 1e-3));
        for (width, height) in [
            (300.0, 400.0),
            (640.0, 330.0),
            (1200.0, 800.0),
            (900.0, 300.0),
        ] {
            let [x, y, w, h] = window(width, height);
            assert!(close(w / h, width / height, 1e-4), "{width}×{height}");
            assert!(w <= full[2] + 1e-3 && h <= full[3] + 1e-3);
            assert!(y - h * 0.5 >= full[1] - full[3] * 0.5 - 1e-3);
            assert!(y + h * 0.5 <= full[1] + full[3] * 0.5 + 1e-3);
            assert!((x - AXIS).abs() < 1e-3);
        }
    }

    #[test]
    fn the_ground_model_matches_the_painting() {
        let feet = ground([AXIS, FEET]).unwrap();
        assert!(close(feet[1], DISTANCE, 0.01) && close(closeness(feet), 1.0, 0.01));
        assert!(ground([AXIS, HORIZON - 10.0]).is_none());
        let (p, s) = project([0.0, 1.8, DISTANCE]);
        assert!(close(p[1], CROWN, 2.0) && close(s, 1.0, 1e-6));
        let g = geometry();
        // The heart's foot, metres.
        assert!(close(g[2 * 12 + 8], 1.96, 0.02) && close(g[2 * 12 + 9], 20.4, 0.05));
    }

    #[test]
    fn every_dark_theme_keeps_its_accent_cold_and_a_warm_apart_from_it() {
        for code in [0, 2, 3, 4] {
            let l = look(code);
            let palette = Palette::from_code(code);
            assert_eq!(l.cold, palette.colors().unwrap().accent);
            assert_eq!(l.mode, palette.mode());
            let apart: f32 = (0..3).map(|i| (l.warm[i] - l.cold[i]).powi(2)).sum();
            assert!(apart.sqrt() > 0.3, "{code}");
        }
        for code in [1, 5, 6, 255] {
            assert_eq!(look(code), look(2));
        }
    }
}
