//! Icon scenes, direction «Характер» (Art 2026-11-11, Telegram as the model):
//! every pressable glyph plays its own short scene on a tap. The arrow steps back,
//! the cross turns, the settings knobs swap, the bin lifts its lid, play flows
//! into pause. This module is the pure timeline: geometry and per-part poses for a
//! time in seconds. `icon_dom.rs` writes the poses onto the browser's SVG nodes.

/// How a part is inked.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    /// A stroke at the approved icon line width.
    Line,
    /// A solid dot that only shows during its scene (filter drop, stairs hopper).
    Spark,
    /// A solid shape that is part of the still glyph (calendar days, radio dot, thumb).
    Solid,
    /// A 0.25 layout-pixel outline (control frames).
    Hair,
    /// The page color under a control, at 70 %.
    Ground,
}
/// One stroke of a glyph.
#[derive(Clone, Copy, Debug)]
pub struct Part {
    pub d: &'static str,
    pub kind: Kind,
}
const fn line(d: &'static str) -> Part {
    Part {
        d,
        kind: Kind::Line,
    }
}
const fn dot(d: &'static str) -> Part {
    Part {
        d,
        kind: Kind::Spark,
    }
}
const fn solid(d: &'static str) -> Part {
    Part {
        d,
        kind: Kind::Solid,
    }
}
const fn hair(d: &'static str) -> Part {
    Part {
        d,
        kind: Kind::Hair,
    }
}
const fn ground(d: &'static str) -> Part {
    Part {
        d,
        kind: Kind::Ground,
    }
}

/// What the bridge's on/off state (`filled`) does to the glyph.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum State {
    /// Strokes fill in (bookmark).
    Fill,
    /// Solid parts spring out of the origin (radio dot).
    Select,
    /// Solid parts slide right by this many view units, stretching on the way (toggle thumb).
    Slide(f32),
}

/// Play and pause outlines of one player glyph, each two four-point strokes.
#[derive(Clone, Copy, Debug)]
pub struct Morph {
    pub play: [[f32; 2]; 4],
    pub play_tail: [[f32; 2]; 4],
    pub pause: [[f32; 2]; 4],
    pub pause_tail: [[f32; 2]; 4],
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Scene {
    Back,
    Turn,
    Settings,
    Notes,
    Trash,
    Playback,
    Send,
    Nudge,
    Plus,
    Filter,
    Bookmark,
    Sound,
    Expand,
    Stairs,
    Pop,
    Rewind,
    Forward,
    Squash,
    Nod,
    Lock,
    /// Calendar: the rings hop, the days blink one after another.
    Calendar,
    /// Info: the dot jumps off the stem and lands on it.
    Info,
    /// A chevron flips over and back (sort order).
    Flip,
    /// Corners close in on the eye, it blinks and looks around.
    Watch,
    /// The moon rocks, its star spins in.
    Moon,
    /// The door swings open on its hinge and shuts.
    Door,
    /// List rows slide out one after another.
    Rows,
    /// The lock rattles: it stays shut.
    Rattle,
    /// The arrow darts up and to the right.
    Dart,
    /// The toggle thumb squashes under the finger.
    Toggle,
}

#[derive(Clone, Copy, Debug)]
pub struct Glyph {
    pub view: [f32; 4],
    pub parts: &'static [Part],
    pub scene: Scene,
    /// Scene origin (turns, squashes) in view units.
    pub origin: [f32; 2],
    pub state: State,
    pub morph: Option<&'static Morph>,
}
impl Glyph {
    const fn new(view: [f32; 4], parts: &'static [Part], scene: Scene, origin: [f32; 2]) -> Self {
        Self {
            view,
            parts,
            scene,
            origin,
            state: State::Fill,
            morph: None,
        }
    }
    const fn state(mut self, state: State) -> Self {
        self.state = state;
        self
    }
    const fn morph(mut self, morph: &'static Morph) -> Self {
        self.morph = Some(morph);
        self
    }
}

pub const PLAYER: Morph = Morph {
    play: [[7., 4.], [20., 12.], [20., 12.], [7., 20.]],
    play_tail: [[20., 12.]; 4],
    pause: [[8., 5.], [8., 5.], [8., 19.], [8., 19.]],
    pause_tail: [[16., 5.], [16., 5.], [16., 19.], [16., 19.]],
};
/// The recording review: its approved triangle and its two 14-px bars 5 px apart.
pub const REVIEW: Morph = Morph {
    play: [[12., 9.0718], [24., 16.], [24., 16.], [12., 22.9282]],
    play_tail: [[24., 16.]; 4],
    pause: [[13.125, 9.], [13.125, 9.], [13.125, 23.], [13.125, 23.]],
    pause_tail: [[18.875, 9.], [18.875, 9.], [18.875, 23.], [18.875, 23.]],
};
const SQUARE: [f32; 4] = [0., 0., 24., 24.];
const BUTTON: [f32; 4] = [0., 0., 44., 42.];
/// Calendar day centers (view units), in reading order.
const DAYS: [[f32; 2]; 6] = [
    [8.80426, 13.5998],
    [12.004, 13.5998],
    [15.2037, 13.5998],
    [8.80426, 16.7998],
    [12.004, 16.7998],
    [15.2037, 16.7998],
];

/// App glyph names (the bridge's `name`) to their geometry and scene. The paths are
/// the approved ones from `ui.tsx`, `DiaryIcons.tsx`, `ObservationControls.tsx` and
/// `assets/product/*-glyph.svg`, split into the strokes a scene moves.
pub fn glyph(name: &str) -> Option<Glyph> {
    // Inline consts keep each glyph table in static memory.
    macro_rules! g {
        ($view:expr, $parts:expr, $scene:expr, $origin:expr $(, $method:ident($arg:expr))* $(,)?) => {
            Some(const {
                const PARTS: &[Part] = $parts;
                Glyph::new($view, PARTS, $scene, $origin)$(.$method($arg))*
            })
        };
    }
    match name {
        "back-button" => g!(BUTTON, &[line("M30 21L14 21"), line("M17.2 18L14 21L17.2 24")], Scene::Back, [14., 21.]),
        "close-button" => g!(BUTTON, &[line("M14 13L30 29"), line("M14 29L30 13")], Scene::Turn, [22., 21.]),
        "close" => g!(SQUARE, &[line("M6 6l12 12"), line("M18 6 6 18")], Scene::Turn, [12., 12.]),
        "settings" => g!(
            SQUARE,
            &[line("M14 17H5"), line("M19 7H10"), line("M14 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0"), line("M4 7a3 3 0 1 0 6 0a3 3 0 1 0-6 0")],
            Scene::Settings,
            [12., 12.],
        ),
        "notes" => g!(
            SQUARE,
            &[
                line("M7 3H17a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"),
                line("M8 3v18"),
                line("M3 7h4M3 11h4M3 15h4M3 19h4"),
                line("M11 8h5"),
                line("M11 12h5"),
                line("M11 16h3"),
            ],
            Scene::Notes,
            [12., 12.],
        ),
        "trash" => g!(SQUARE, &[line("M3 6h18M9 6V3h6v3"), line("M6 6l1 15h10l1-15"), line("M10 10v7m4-7v7")], Scene::Trash, [3., 6.]),
        // Play and pause are one glyph: the bridge morphs between them.
        "play" | "pause" => g!(SQUARE, &[line(""), line("")], Scene::Playback, [12., 12.], morph(&PLAYER)),
        "review-play" | "review-pause" => g!([0., 0., 32., 32.], &[line(""), line("")], Scene::Playback, [16., 16.], morph(&REVIEW)),
        "speaker" => g!(
            [100.857, 82.143, 45.714, 45.714],
            &[line("M108 100h6l8-6v22l-8-6h-6Z"), line("M127 99a9 9 0 0 1 0 12"), line("M130 95a15 15 0 0 1 0 20")],
            Scene::Sound,
            [115., 105.],
        ),
        "calendar" => g!(
            SQUARE,
            &[
                line("M8.80026 3.99982V7.19982M15.1997 3.99982V7.19982"),
                line("M4.80058 10.3998H19.1994M6.40045 5.59982H17.5996C18.4831 5.59982 19.1994 6.31617 19.1994 7.19982V18.3998C19.1994 19.2835 18.4831 19.9998 17.5996 19.9998H6.40045C5.51686 19.9998 4.80058 19.2835 4.80058 18.3998V7.19982C4.80058 6.31617 5.51686 5.59982 6.40045 5.59982Z"),
                solid("M8.42926 13.5998a.375 .375 0 1 0 .75 0a.375 .375 0 1 0-.75 0"),
                solid("M11.629 13.5998a.375 .375 0 1 0 .75 0a.375 .375 0 1 0-.75 0"),
                solid("M14.8287 13.5998a.375 .375 0 1 0 .75 0a.375 .375 0 1 0-.75 0"),
                solid("M8.42926 16.7998a.375 .375 0 1 0 .75 0a.375 .375 0 1 0-.75 0"),
                solid("M11.629 16.7998a.375 .375 0 1 0 .75 0a.375 .375 0 1 0-.75 0"),
                solid("M14.8287 16.7998a.375 .375 0 1 0 .75 0a.375 .375 0 1 0-.75 0"),
            ],
            Scene::Calendar,
            [12., 20.],
        ),
        "info" => g!(
            [0., 0., 20., 20.],
            &[line("M2 10a8 8 0 1 0 16 0a8 8 0 1 0-16 0"), solid("M9.2 6.25a.8 .8 0 1 0 1.6 0a.8 .8 0 1 0-1.6 0"), line("M8.75 9H10v5.5m-1.25 0h2.5")],
            Scene::Info,
            [10., 10.],
        ),
        "sort-chevron" => g!([0., 0., 7., 7.], &[line("M0.25 2L3.40789 5L6.25 2")], Scene::Flip, [3.25, 3.5]),
        "sparkle" => g!(
            [0., 0., 32., 32.],
            &[line("M15.1479 2.9699C14.9085 3.16871 14.7462 3.44499 14.6891 3.75087L13.2876 11.1621C13.1881 11.689 12.932 12.1737 12.5529 12.5529C12.1737 12.932 11.689 13.1881 11.1621 13.2876L3.75087 14.6891C3.44499 14.7462 3.16871 14.9085 2.9699 15.1479C2.77109 15.3873 2.66226 15.6887 2.66226 15.9999C2.66226 16.311 2.77109 16.6124 2.9699 16.8518C3.16871 17.0912 3.44499 17.2535 3.75087 17.3106L11.1621 18.7121C11.689 18.8116 12.1737 19.0677 12.5529 19.4468C12.932 19.826 13.1881 20.3107 13.2876 20.8376L14.6891 28.2488C14.7462 28.5547 14.9085 28.831 15.1479 29.0298C15.3873 29.2286 15.6887 29.3375 15.9999 29.3375C16.311 29.3375 16.6124 29.2286 16.8518 29.0298C17.0912 28.831 17.2535 28.5547 17.3106 28.2488L18.7121 20.8376C18.8116 20.3107 19.0677 19.826 19.4468 19.4468C19.826 19.0677 20.3107 18.8116 20.8376 18.7121L28.2488 17.3106C28.5547 17.2535 28.831 17.0912 29.0298 16.8518C29.2286 16.6124 29.3375 16.311 29.3375 15.9999C29.3375 15.6887 29.2286 15.3873 29.0298 15.1479C28.831 14.9085 28.5547 14.7462 28.2488 14.6891L20.8376 13.2876C20.3107 13.1881 19.826 12.932 19.4468 12.5529C19.0677 12.1737 18.8116 11.689 18.7121 11.1621L17.3106 3.75087C17.2535 3.44499 17.0912 3.16871 16.8518 2.9699C16.6124 2.77109 16.311 2.66226 15.9999 2.66226C15.6887 2.66226 15.3873 2.77109 15.1479 2.9699Z")],
            Scene::Turn,
            [16., 16.],
        ),
        // Corners 0–3 (top left, top right, bottom left, bottom right), eye, pupil, frame.
        "collection" => g!(
            BUTTON,
            &[
                line("M18.2353 13H15.8824C15.3831 13 14.9043 13.1983 14.5513 13.5513C14.1983 13.9043 14 14.3831 14 14.8824V17.2353"),
                line("M25.7647 13H28.1176C28.6169 13 29.0957 13.1983 29.4487 13.5513C29.8017 13.9043 30 14.3831 30 14.8824V17.2353"),
                line("M14 24.7647V27.1176C14 27.6169 14.1983 28.0957 14.5513 28.4487C14.9043 28.8017 15.3831 29 15.8824 29H18.2353"),
                line("M30 24.7647V27.1176C30 27.6169 29.8017 28.0957 29.4487 28.4487C29.0957 28.8017 28.6169 29 28.1176 29H25.7647"),
                line("M14.9409 21C14.9409 21 17.5762 17.2353 21.9998 17.2353C26.4233 17.2353 29.0586 21 29.0586 21C29.0586 21 26.4233 24.7647 21.9998 24.7647C17.5762 24.7647 14.9409 21 14.9409 21Z"),
                line("M24.0702 20.9999C24.0702 22.1435 23.1431 23.0705 21.9996 23.0705C20.856 23.0705 19.929 22.1435 19.929 20.9999C19.929 19.8564 20.856 18.9293 21.9996 18.9293C23.1431 18.9293 24.0702 19.8564 24.0702 20.9999Z"),
                hair("M33.4473 0.125L43.875 10.5527V41.875H10.5527L0.125 31.4473V0.125H33.4473Z"),
            ],
            Scene::Watch,
            [22., 21.],
        ),
        "architecture" => g!(
            SQUARE,
            &[
                line("M7.5 2H4.5A2.5 2.5 0 0 0 2 4.5v3"),
                line("M16.5 2h3A2.5 2.5 0 0 1 22 4.5v3"),
                line("M2 16.5v3A2.5 2.5 0 0 0 4.5 22h3"),
                line("M22 16.5v3a2.5 2.5 0 0 1-2.5 2.5h-3"),
                line("M3.5 12s3.2-4.5 8.5-4.5 8.5 4.5 8.5 4.5-3.2 4.5-8.5 4.5S3.5 12 3.5 12Z"),
                line("M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"),
            ],
            Scene::Watch,
            [12., 12.],
        ),
        "theme" => g!(
            [0., 0., 15., 15.],
            &[
                line("M11.2503 3.12508H13.7505M12.5004 1.875V4.37516"),
                line("M13.1161 7.80437C13.0575 8.88953 12.6858 9.93449 12.046 10.8129C11.4062 11.6914 10.5257 12.3657 9.51084 12.7544C8.49598 13.1431 7.39026 13.2295 6.32735 13.0032C5.26443 12.7768 4.28983 12.2475 3.52134 11.4791C2.75286 10.7107 2.2234 9.73613 1.99697 8.67324C1.77053 7.61036 1.85682 6.50463 2.2454 5.48974C2.63397 4.47484 3.3082 3.59423 4.18658 2.95434C5.06497 2.31445 6.10989 1.94269 7.19505 1.884C7.44819 1.87025 7.5807 2.17152 7.44631 2.38591C6.99684 3.10505 6.80438 3.9553 6.90034 4.7979C6.9963 5.64051 7.37501 6.42571 7.97468 7.02537C8.57434 7.62503 9.35955 8.00375 10.2022 8.09971C11.0448 8.19567 11.895 8.0032 12.6142 7.55373C12.8292 7.41935 13.1298 7.55123 13.1161 7.80437Z"),
            ],
            Scene::Moon,
            [7.5, 7.5],
        ),
        "startup" => g!(
            [0., 0., 15., 15.],
            &[
                line("M6.87495 12.5007H1.2495M11.8754 12.5008L13.7505 12.5007"),
                line("M11.8754 12.5008L7.65126 13.5564C7.55914 13.5794 7.463 13.5811 7.37012 13.5614C7.27725 13.5416 7.1901 13.501 7.11527 13.4426C7.04044 13.3841 6.97991 13.3094 6.93827 13.2241C6.89663 13.1388 6.87498 13.0451 6.87495 12.9502V2.85184C6.87507 2.66194 6.91846 2.47395 7.00182 2.30333C7.08517 2.13271 7.20631 1.98333 7.35603 1.86651C7.50574 1.7497 7.68011 1.66852 7.86589 1.62916C8.05166 1.58979 8.24397 1.59326 8.4282 1.63931L10.9284 2.26432C11.1988 2.33192 11.4389 2.48797 11.6105 2.70766C11.7821 2.92736 11.8753 3.1981 11.8754 3.47685V12.5008Z"),
                line("M6.87495 2.50046H4.9998C4.66825 2.50046 4.35029 2.63215 4.11585 2.86658C3.88141 3.101 3.7497 3.41895 3.7497 3.75048V12.5007"),
                line("M8.7501 7.50055H8.75635"),
            ],
            Scene::Door,
            [6.875, 7.5],
        ),
        "radio" => g!(
            [0., 0., 14., 16.],
            &[line("M.6 8a6.4 6.4 0 1 0 12.8 0a6.4 6.4 0 1 0-12.8 0"), solid("M4 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0")],
            Scene::Pop,
            [7., 8.],
            state(State::Select),
        ),
        "toggle" => g!(
            [0., 0., 36., 20.],
            &[ground("M.5 .5H35.5V19.5H.5Z"), hair("M.5 .5H35.5V19.5H.5Z"), solid("M5 4H17V16H11L5 10Z")],
            Scene::Toggle,
            [11., 10.],
            state(State::Slide(14.)),
        ),
        "sections" => g!([0., 0., 18., 18.], &[line("M2 4H3M6 4H16"), line("M2 9H3M6 9H16"), line("M2 14H3M6 14H16")], Scene::Rows, [9., 9.]),
        "step-lock" => g!([0., 0., 12., 14.], &[line("M3 6V4Q3 1 6 1T9 4V6"), line("M1.5 6.5H10.5V13H1.5ZM6 9V10.5")], Scene::Rattle, [6., 10.]),
        "home-arrow" => g!([0., 0., 16., 16.], &[line("M12 12V4H4M12 4L4 12")], Scene::Dart, [8., 8.]),
        "level-arrow" => g!([0., 0., 32., 32.], &[line("M16 21.6569L21.6569 16L16 10.3431M21.6569 16H10.3431")], Scene::Nudge, [16., 16.]),
        "send" => g!(SQUARE, &[line("M4 12h16m-6-6 6 6-6 6")], Scene::Send, [12., 12.]),
        "arrow" => g!(SQUARE, &[line("M3 12h18m-7-7 7 7-7 7")], Scene::Nudge, [12., 12.]),
        "plus" => g!(SQUARE, &[line("M4 12h16M12 4v16")], Scene::Plus, [12., 12.]),
        "filter" => g!(SQUARE, &[line("M3 4h18l-7 8v7l-4 2v-9Z"), dot("M11.1 22.6a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0-1.8 0")], Scene::Filter, [12., 12.]),
        "bookmark" => g!(SQUARE, &[line("M6 3h12v18l-6-4-6 4Z")], Scene::Bookmark, [12., 12.]),
        "sound" => g!(SQUARE, &[line("M3 9h4l5-5v16l-5-5H3Z"), line("M16 8c2 2 2 6 0 8"), line("M19 5c4 4 4 10 0 14")], Scene::Sound, [7.5, 12.]),
        "expand" => g!(SQUARE, &[line("M4 9V4h5"), line("M15 4h5v5"), line("M20 15v5h-5"), line("M9 20H4v-5")], Scene::Expand, [12., 12.]),
        "stairs" => g!(SQUARE, &[line("M3 20v-6h6V9h6V4h6v16ZM9 14v6m6-11v11"), dot("M4.9 12.4a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0")], Scene::Stairs, [12., 12.]),
        "stop" => g!(SQUARE, &[line("M6 6h12v12H6Z")], Scene::Pop, [12., 12.]),
        "rewind" => g!(SQUARE, &[line("M11 5 3 12l8 7Z"), line("M21 5l-8 7 8 7Z")], Scene::Rewind, [12., 12.]),
        "fastForward" => g!(SQUARE, &[line("M3 5l8 7-8 7Z"), line("M13 5l8 7-8 7Z")], Scene::Forward, [12., 12.]),
        "lips" => g!(
            [104., 91., 32., 32.],
            &[line("M105 105c5-2 9-9 15-5 6-4 10 3 15 5-4 5-8 10-15 10s-11-5-15-10ZM105 105c6 2 10-2 15 0 5-2 9 2 15 0M110 105c3 2 7 3 10 3s7-1 10-3")],
            Scene::Squash,
            [120., 107.],
        ),
        "waveform" => g!(SQUARE, &[line("M3 10v4m3-7v10m3-13v16m3-11v6m3-12v18m3-14v10m3-7v4")], Scene::Squash, [12., 12.]),
        "chevron" => g!(SQUARE, &[line("m5 9 7 7 7-7")], Scene::Nod, [12., 12.]),
        "lock" => g!(SQUARE, &[line("M7 10V7a5 5 0 0 1 10 0v3"), line("M4 10h16v11H4zM12 14v3")], Scene::Lock, [12., 12.]),
        _ => None,
    }
}

/// A damped spring from 0 to 1 (unit mass), the feel of Telegram's icon settle.
#[derive(Clone, Copy, Debug)]
pub struct Spring {
    pub stiffness: f32,
    pub damping: f32,
}
pub const SOFT: Spring = Spring {
    stiffness: 300.,
    damping: 16.,
};
pub const WOBBLY: Spring = Spring {
    stiffness: 260.,
    damping: 9.,
};
pub const SWAP: Spring = Spring {
    stiffness: 280.,
    damping: 17.,
};
pub const MORPH: Spring = Spring {
    stiffness: 420.,
    damping: 22.,
};
impl Spring {
    pub fn at(self, t: f32) -> f32 {
        if t <= 0. {
            return 0.;
        }
        let w = self.stiffness.sqrt();
        let zeta = self.damping / (2. * w);
        if zeta >= 1. {
            return 1. - (1. + w * t) * (-w * t).exp();
        }
        let wd = w * (1. - zeta * zeta).sqrt();
        1. - (-zeta * w * t).exp() * ((wd * t).cos() + zeta * w / wd * (wd * t).sin())
    }
    /// Time after which the spring stays within 0.2 % of rest.
    pub fn settle(self) -> f32 {
        let w = self.stiffness.sqrt();
        let decay = (self.damping / 2.).min(w);
        (500f32).ln() / decay
    }
}

fn clamp01(v: f32) -> f32 {
    v.clamp(0., 1.)
}
fn ease_out(v: f32) -> f32 {
    1. - (1. - clamp01(v)).powi(3)
}
fn ease_in(v: f32) -> f32 {
    clamp01(v).powi(3)
}
/// A press: eases out to 1 over `lead`, then springs back to 0 (overshooting past it).
fn tap(t: f32, lead: f32, spring: Spring) -> f32 {
    if t < lead {
        ease_out(t / lead)
    } else {
        1. - spring.at(t - lead)
    }
}
/// Starts at 1 and springs to rest at 0.
fn settle(t: f32, spring: Spring) -> f32 {
    1. - spring.at(t)
}

#[derive(Clone, Debug, PartialEq)]
pub struct Pose {
    pub tx: f32,
    pub ty: f32,
    pub rotate: f32,
    pub sx: f32,
    pub sy: f32,
    pub origin: [f32; 2],
    pub opacity: f32,
    /// Drawn share of the stroke, for parts that write themselves in.
    pub drawn: Option<(f32, f32)>,
    /// Replacement outline for morphing parts.
    pub d: Option<String>,
}
impl Pose {
    pub fn rest(origin: [f32; 2]) -> Self {
        Self {
            tx: 0.,
            ty: 0.,
            rotate: 0.,
            sx: 1.,
            sy: 1.,
            origin,
            opacity: 1.,
            drawn: None,
            d: None,
        }
    }
    pub fn transform(&self) -> String {
        let [ox, oy] = self.origin;
        format!(
            "translate({:.3} {:.3}) translate({ox} {oy}) rotate({:.3}) scale({:.4} {:.4}) translate({} {})",
            self.tx, self.ty, self.rotate, self.sx, self.sy, -ox, -oy
        )
    }
}

pub fn polygon(points: &[[f32; 2]; 4]) -> String {
    let [a, b, c, d] = points;
    format!(
        "M{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}L{:.3} {:.3}Z",
        a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]
    )
}
fn mix(a: &[[f32; 2]; 4], b: &[[f32; 2]; 4], k: f32) -> [[f32; 2]; 4] {
    let mut out = *a;
    for (o, (p, q)) in out.iter_mut().zip(a.iter().zip(b)) {
        *o = [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
    }
    out
}
/// Play (0) to pause (1) outline, both strokes.
pub fn playback(morph: &Morph, k: f32) -> [String; 2] {
    [
        polygon(&mix(&morph.play, &morph.pause, k)),
        polygon(&mix(&morph.play_tail, &morph.pause_tail, k)),
    ]
}
/// A one-off swing out and back (0 outside `start..start + length`).
fn bump(t: f32, start: f32, length: f32) -> f32 {
    let s = (t - start) / length;
    if (0. ..1.).contains(&s) {
        (std::f32::consts::PI * s).sin()
    } else {
        0.
    }
}

/// How long a tap scene runs, in seconds.
pub fn duration(scene: Scene) -> f32 {
    match scene {
        Scene::Settings => 0.45 + SWAP.settle(),
        Scene::Trash => 0.95,
        Scene::Sound => 1.6,
        Scene::Stairs => 1.2,
        Scene::Send => 0.18 + SOFT.settle(),
        Scene::Back
        | Scene::Filter
        | Scene::Expand
        | Scene::Bookmark
        | Scene::Nudge
        | Scene::Nod
        | Scene::Lock
        | Scene::Dart
        | Scene::Toggle => 0.16 + WOBBLY.settle(),
        Scene::Calendar => 0.43 + WOBBLY.settle(),
        Scene::Info => 0.18 + WOBBLY.settle(),
        Scene::Flip => 0.2 + SOFT.settle(),
        Scene::Watch => (0.9f32).max(0.14 + WOBBLY.settle()),
        Scene::Moon => 0.18 + WOBBLY.settle(),
        Scene::Door => 0.2 + WOBBLY.settle(),
        Scene::Rows => 0.24 + WOBBLY.settle(),
        Scene::Rattle => 0.9,
        Scene::Rewind | Scene::Forward => 0.2 + WOBBLY.settle(),
        Scene::Squash => 0.12 + WOBBLY.settle(),
        Scene::Notes => (0.72f32).max(WOBBLY.settle()),
        Scene::Turn | Scene::Pop => WOBBLY.settle(),
        Scene::Playback | Scene::Plus => SOFT.settle(),
    }
}

/// The pose of part `index` of `glyph`, `t` seconds into its tap scene.
pub fn pose(glyph: &Glyph, index: usize, t: f32) -> Pose {
    let mut p = Pose::rest(glyph.origin);
    let u = glyph.view[2] / 24.;
    match glyph.scene {
        Scene::Back => {
            let k = tap(t, 0.16, WOBBLY);
            p.tx = -3. * u * k;
            if index == 1 {
                p.sx = 1. + 0.15 * k;
                p.sy = p.sx;
            }
        }
        Scene::Turn => {
            let k = settle(t, WOBBLY);
            p.rotate = -90. * k;
            p.sx = 1. - 0.45 * k;
            p.sy = p.sx;
        }
        Scene::Plus => {
            let k = settle(t, SOFT);
            p.rotate = -180. * k;
            p.sx = 1. - 0.4 * k;
            p.sy = p.sx;
        }
        Scene::Settings => {
            let k = SWAP.at(t) - SWAP.at(t - 0.45);
            match index {
                0 => p.d = Some(format!("M{:.3} 17H{:.3}", 14. - 4. * k, 5. + 14. * k)),
                1 => p.d = Some(format!("M{:.3} 7H{:.3}", 19. - 14. * k, 10. + 4. * k)),
                2 => p.tx = -10. * k,
                _ => p.tx = 10. * k,
            }
        }
        Scene::Notes => {
            if index >= 3 {
                let start = 0.12 + (index - 3) as f32 * 0.15;
                let length = if index == 5 { 3. } else { 5. };
                p.drawn = Some((ease_out((t - start) / 0.22), length));
            }
            let k = settle(t, WOBBLY);
            p.rotate = -8. * k;
            p.sx = 1. - 0.1 * k;
            p.sy = p.sx;
            p.origin = [12., 12.];
        }
        Scene::Trash => {
            let open = if t < 0.2 {
                ease_out(t / 0.2)
            } else if t < 0.36 {
                1.
            } else {
                1. - ease_in((t - 0.36) / 0.14)
            };
            let after = t - 0.5;
            match index {
                0 => {
                    p.ty = -2.5 * open;
                    p.rotate = -24. * open;
                    if after > 0. && after < 0.22 {
                        p.ty -= (std::f32::consts::PI * after / 0.22).sin();
                    }
                }
                _ => {
                    p.origin = [12., 21.];
                    if after > 0. {
                        p.rotate = -5. * (-after * 8.).exp() * (after * 30.).sin();
                    }
                }
            }
        }
        Scene::Playback => {
            let k = settle(t, SOFT);
            p.sx = 1. - 0.15 * k;
            p.sy = p.sx;
        }
        Scene::Send => {
            if t < 0.18 {
                p.tx = 14. * ease_in(t / 0.18);
                p.opacity = 1. - t / 0.18;
            } else {
                p.tx = -14. * settle(t - 0.18, SOFT);
                p.opacity = clamp01((t - 0.18) / 0.15);
            }
        }
        Scene::Nudge => p.tx = 4. * tap(t, 0.14, WOBBLY),
        Scene::Nod => p.ty = 3. * tap(t, 0.14, WOBBLY),
        Scene::Filter => {
            if index == 0 {
                let k = tap(t, 0.15, WOBBLY);
                p.sy = 1. - 0.2 * k;
                p.sx = 1. + 0.06 * k;
            } else {
                let d = (t - 0.15) / 0.52;
                p.opacity = if d <= 0. || d >= 1. {
                    0.
                } else if d < 0.3 {
                    d / 0.3
                } else {
                    1. - (d - 0.3) / 0.7
                };
                p.ty = -2. + 5. * ease_in(d);
            }
        }
        Scene::Bookmark => p.ty = -3. * tap(t, 0.13, WOBBLY),
        Scene::Sound => {
            if index == 0 {
                let k = settle(t, WOBBLY);
                p.sx = 1. - 0.15 * k;
                p.sy = p.sx;
            } else {
                let local = t - (index - 1) as f32 * 0.13;
                let k = if local < 0. {
                    0.
                } else if local < 1.4 {
                    ease_out((local % 0.7) / 0.35)
                } else {
                    1.
                };
                p.opacity = k;
                p.tx = -3. * (1. - k);
            }
        }
        Scene::Expand => {
            let k = 1.6 * tap(t, 0.15, WOBBLY);
            let [dx, dy] = [[1., 1.], [-1., 1.], [-1., -1.], [1., -1.]][index.min(3)];
            p.tx = dx * k;
            p.ty = dy * k;
        }
        Scene::Stairs => {
            if index == 1 {
                let keys: [(f32, f32, f32); 6] = [
                    (0., 0., 0.),
                    (0.08, 0., 0.),
                    (0.22, 3., -6.),
                    (0.34, 6., -5.),
                    (0.5, 9., -11.),
                    (0.62, 12., -10.),
                ];
                let s = t / 1.2;
                let mut at = (12., -10.);
                for w in keys.windows(2) {
                    if s >= w[0].0 && s < w[1].0 {
                        let k = (s - w[0].0) / (w[1].0 - w[0].0);
                        let k = if w[1].2 < w[0].2 {
                            ease_out(k)
                        } else {
                            ease_in(k)
                        };
                        at = (
                            w[0].1 + (w[1].1 - w[0].1) * k,
                            w[0].2 + (w[1].2 - w[0].2) * k,
                        );
                    }
                }
                if s < keys[0].0 {
                    at = (0., 0.);
                }
                p.tx = at.0;
                p.ty = at.1;
                p.opacity = if s < 0.08 {
                    s / 0.08
                } else if s < 0.85 {
                    1.
                } else {
                    clamp01((1. - s) / 0.15)
                };
            }
        }
        Scene::Pop => {
            let k = settle(t, WOBBLY);
            p.sx = 1. - 0.4 * k;
            p.sy = p.sx;
        }
        Scene::Rewind | Scene::Forward => {
            let lag = if (glyph.scene == Scene::Rewind) == (index == 1) {
                0.06
            } else {
                0.
            };
            let dir = if glyph.scene == Scene::Rewind {
                -1.
            } else {
                1.
            };
            p.tx = dir * 3. * tap((t - lag).max(0.), 0.14, WOBBLY);
        }
        Scene::Squash => {
            let k = tap(t, 0.12, WOBBLY);
            p.sy = 1. - 0.32 * k;
            p.sx = 1. + 0.06 * k;
        }
        Scene::Lock => {
            if index == 0 {
                p.ty = -2. * tap(t, 0.15, WOBBLY);
            }
        }
        Scene::Calendar => match index {
            0 => p.ty = -1.6 * tap(t, 0.12, WOBBLY),
            1 => {
                let k = tap(t, 0.12, WOBBLY);
                p.sy = 1. - 0.08 * k;
                p.sx = 1. + 0.03 * k;
            }
            _ => {
                let day = index - 2;
                let local = t - 0.1 - day as f32 * 0.05;
                p.origin = DAYS[day.min(5)];
                p.sx = 1. + 1.4 * tap(local.max(0.), 0.08, WOBBLY);
                p.sy = p.sx;
                // The days ride on the page as it squashes.
                p.ty = -0.08 * tap(t, 0.12, WOBBLY) * (DAYS[day.min(5)][1] - 20.);
            }
        },
        Scene::Info => match index {
            0 => {
                p.sx = 1. + 0.06 * tap(t, 0.18, WOBBLY);
                p.sy = p.sx;
            }
            1 => p.ty = -3.5 * tap(t, 0.18, WOBBLY),
            _ => {
                p.origin = [10., 14.5];
                let land = t - 0.3;
                if land > 0. {
                    p.sy = 1. - 0.18 * (-land * 9.).exp() * (land * 24.).sin();
                }
            }
        },
        Scene::Flip => {
            let k = tap(t, 0.2, SOFT);
            p.sy = (std::f32::consts::PI * k).cos();
        }
        Scene::Watch => {
            let reach = if glyph.view[2] > 30. { 1.1 } else { 1.5 };
            let blink = 1. - 0.9 * bump(t, 0.12, 0.2);
            match index {
                0..=3 => {
                    let k = reach * tap(t, 0.14, WOBBLY);
                    let [dx, dy] = [[1., 1.], [-1., 1.], [1., -1.], [-1., -1.]][index];
                    p.tx = dx * k;
                    p.ty = dy * k;
                }
                4 => p.sy = blink,
                5 => {
                    p.sy = blink;
                    let look = ((t - 0.35) / 0.5).clamp(0., 1.);
                    p.tx = reach
                        * (2. * std::f32::consts::PI * look).sin()
                        * (1. - look)
                        * glyph.view[2]
                        / 24.;
                }
                _ => {}
            }
        }
        Scene::Moon => {
            if index == 0 {
                let k = settle((t - 0.06).max(0.), WOBBLY);
                p.origin = [12.5, 3.125];
                p.rotate = -90. * k;
                p.sx = 1. - 0.7 * k;
                p.sy = p.sx;
            } else {
                p.rotate = -22. * tap(t, 0.18, WOBBLY);
            }
        }
        Scene::Door => {
            let k = tap(t, 0.2, WOBBLY);
            match index {
                1 => p.sx = 1. - 0.6 * k,
                3 => p.tx = -(8.75 - 6.875) * 0.6 * k,
                _ => {}
            }
        }
        Scene::Rows => p.tx = 2.5 * tap((t - index as f32 * 0.06).max(0.), 0.12, WOBBLY),
        Scene::Rattle => {
            p.rotate = 12. * (-t * 7.).exp() * (t * 38.).sin();
            if index == 0 {
                p.ty = -0.8 * bump(t, 0., 0.22);
            }
        }
        Scene::Dart => {
            let k = 2. * glyph.view[2] / 16. * tap(t, 0.14, WOBBLY);
            p.tx = k;
            p.ty = -k;
        }
        Scene::Toggle => {
            if index == 2 {
                let k = tap(t, 0.1, WOBBLY);
                p.sy = 1. - 0.22 * k;
                p.sx = 1. + 0.08 * k;
            }
        }
    }
    p
}

/// Width of the toggle's thumb in its view units.
const THUMB: f32 = 12.;

/// The on/off state's share of a part's pose, `s` from 0 (off) to 1 (on), springy.
pub fn apply_state(glyph: &Glyph, index: usize, s: f32, pose: &mut Pose) {
    if glyph.parts[index].kind != Kind::Solid {
        return;
    }
    match glyph.state {
        State::Fill => {}
        State::Select => {
            pose.sx *= s.max(0.);
            pose.sy *= s.max(0.);
            pose.opacity = if s > 0.02 { pose.opacity } else { 0. };
        }
        State::Slide(dx) => {
            // The thumb never leaves the track: the spring's overshoot squashes
            // it against the end wall instead, the wall side staying put.
            let travel = s.clamp(0., 1.);
            let over = s - travel;
            let squash = 1. - (2.2 * over.abs()).min(0.45);
            let width = THUMB * pose.sx;
            pose.tx += dx * travel + over.signum() * width * (1. - squash) / 2.;
            pose.sx *= (1. + 0.35 * (std::f32::consts::PI * travel).sin()) * squash;
            pose.sy *= 1. + 0.5 * (1. - squash);
        }
    }
}

/// The pose when no scene runs: the approved still glyph.
pub fn still(glyph: &Glyph, index: usize) -> Pose {
    let mut p = Pose::rest(glyph.origin);
    let part = glyph.parts[index];
    if part.kind == Kind::Spark {
        p.opacity = 0.;
    }
    // Morphing parts return to their exact approved outline.
    if !part.d.is_empty() {
        p.d = Some(part.d.to_string());
    }
    p
}

#[cfg(test)]
mod tests {
    use super::*;
    const NAMES: [&str; 40] = [
        "back-button",
        "close-button",
        "close",
        "settings",
        "notes",
        "trash",
        "play",
        "pause",
        "send",
        "arrow",
        "plus",
        "filter",
        "bookmark",
        "sound",
        "expand",
        "stairs",
        "stop",
        "rewind",
        "fastForward",
        "lips",
        "waveform",
        "chevron",
        "lock",
        "review-play",
        "review-pause",
        "speaker",
        "calendar",
        "info",
        "sort-chevron",
        "sparkle",
        "collection",
        "architecture",
        "theme",
        "startup",
        "radio",
        "toggle",
        "sections",
        "step-lock",
        "home-arrow",
        "level-arrow",
    ];
    fn near(a: &Pose, b: &Pose) -> bool {
        (a.tx - b.tx).abs() < 0.05
            && (a.ty - b.ty).abs() < 0.05
            && (a.rotate - b.rotate).abs() < 0.2
            && (a.sx - b.sx).abs() < 0.01
            && (a.sy - b.sy).abs() < 0.01
            && (a.opacity - b.opacity).abs() < 0.02
    }
    #[test]
    fn every_app_glyph_has_a_scene() {
        for name in NAMES {
            assert!(glyph(name).is_some(), "{name}");
        }
        assert!(glyph("unknown").is_none());
    }
    #[test]
    fn scenes_start_and_end_on_the_still_glyph() {
        for name in NAMES {
            let g = glyph(name).unwrap();
            let end = duration(g.scene);
            for i in 0..g.parts.len() {
                let rest = still(&g, i);
                let done = pose(&g, i, end);
                let spark = g.parts[i].kind == Kind::Spark;
                let done_rest = if spark {
                    Pose {
                        opacity: 0.,
                        ..done.clone()
                    }
                } else {
                    done.clone()
                };
                assert!(
                    near(&done_rest, &rest) || spark,
                    "{name} part {i} ends at {done:?}"
                );
                if let Some((drawn, _)) = done.drawn {
                    assert!(
                        (drawn - 1.).abs() < 1e-3,
                        "{name} part {i} is not fully written"
                    );
                }
            }
        }
    }
    #[test]
    fn scenes_actually_move() {
        for name in NAMES {
            let g = glyph(name).unwrap();
            let moved = (0..g.parts.len()).any(|i| {
                (1..40).any(|f| {
                    !near(&pose(&g, i, f as f32 * 0.02), &Pose::rest(g.origin))
                        || pose(&g, i, f as f32 * 0.02).d.is_some()
                })
            });
            assert!(moved, "{name} has no visible motion");
        }
    }
    #[test]
    fn springs_overshoot_and_settle() {
        assert!(
            (0..200).any(|f| WOBBLY.at(f as f32 * 0.005) > 1.05),
            "a Telegram settle overshoots"
        );
        assert!((WOBBLY.at(WOBBLY.settle()) - 1.).abs() < 0.003);
        assert!((SOFT.at(SOFT.settle()) - 1.).abs() < 0.003);
        assert_eq!(SOFT.at(0.), 0.);
    }
    #[test]
    fn settings_swap_returns_to_the_approved_lines() {
        let g = glyph("settings").unwrap();
        let end = duration(g.scene);
        assert_eq!(still(&g, 0).d.unwrap(), "M14 17H5");
        assert_eq!(still(&g, 1).d.unwrap(), "M19 7H10");
        let near_end = pose(&g, 0, end).d.unwrap();
        assert!(
            near_end.starts_with("M14.0") || near_end.starts_with("M13.9"),
            "{near_end}"
        );
        let middle = pose(&g, 2, 0.4);
        assert!(middle.tx < -9., "knob slides across: {}", middle.tx);
    }
    #[test]
    fn playback_morph_ends_on_play_and_pause() {
        assert_eq!(playback(&PLAYER, 0.)[0], polygon(&PLAYER.play));
        assert_eq!(playback(&PLAYER, 1.)[1], polygon(&PLAYER.pause_tail));
        assert_eq!(playback(&REVIEW, 1.)[0], polygon(&REVIEW.pause));
    }
    #[test]
    fn states_spring_the_solid_parts() {
        let radio = glyph("radio").unwrap();
        let mut off = still(&radio, 1);
        apply_state(&radio, 1, 0., &mut off);
        assert_eq!(off.opacity, 0.);
        let mut on = still(&radio, 1);
        apply_state(&radio, 1, 1., &mut on);
        assert!(near(&on, &Pose::rest(radio.origin)));
        let toggle = glyph("toggle").unwrap();
        let mut thumb = still(&toggle, 2);
        apply_state(&toggle, 2, 1., &mut thumb);
        assert!((thumb.tx - 14.).abs() < 1e-4 && (thumb.sx - 1.).abs() < 1e-4);
        let mut frame = still(&toggle, 1);
        apply_state(&toggle, 1, 1., &mut frame);
        assert_eq!(frame.tx, 0.);
    }

    #[test]
    fn the_thumb_stays_inside_the_track() {
        // The authored thumb spans x 5..17 off and 19..31 on; the track's inner wall ends at 35.
        let toggle = glyph("toggle").unwrap();
        for step in -40..=140 {
            let mut thumb = still(&toggle, 2);
            apply_state(&toggle, 2, step as f32 / 100., &mut thumb);
            let centre = 11. + thumb.tx;
            let half = 6. * thumb.sx;
            assert!(
                centre - half >= 4.99 && centre + half <= 31.01,
                "s {step}: {centre} ± {half}"
            );
        }
    }
}
