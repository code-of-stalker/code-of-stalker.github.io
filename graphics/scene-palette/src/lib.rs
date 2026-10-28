//! Application themes for the standalone web scenes. The product engine
//! recolors its own illustrations in `presentation.wgsl`; these scenes paint
//! full-color artwork, so their finished frame passes through the same
//! grounding mapping here. Geometry, clocks and motion never see the palette.
#[cfg(target_arch = "wasm32")]
mod target;
#[cfg(target_arch = "wasm32")]
pub use target::Themed;

pub const VERTEX: &str = include_str!("recolor.vert");
pub const FRAGMENT: &str = include_str!("recolor.frag");

const fn rgb(r: u8, g: u8, b: u8) -> [f32; 3] {
    [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0]
}
const LUMA: [f32; 3] = [0.2126, 0.7152, 0.0722];

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Palette {
    /// The artwork's own colors: previews, video export, tools.
    #[default]
    Original,
    /// Искра: Matrix yellow on black.
    Dark,
    /// Дюна: Art's light paintings, shown as painted.
    Light,
    /// Тишина.
    Neutral,
    /// Астрал.
    Violet,
    /// Матрица: code green on black.
    Matrix,
    /// Мираж: the light paintings remapped to navy, cobalt, lilac and sand.
    Mirage,
    /// Рассвет: the light paintings remapped to plum, wine, copper and peach.
    Dawn,
}

/// Paper, accent and highlight of one theme. `detail` is the light themes'
/// third ink (the highlight is their text ink); dark themes leave it unused.
pub struct Colors {
    pub paper: [f32; 3],
    pub accent: [f32; 3],
    pub highlight: [f32; 3],
    pub detail: [f32; 3],
}

impl Palette {
    /// The codes of the app's `graphicsPalette`: 0 dark, 1 light, 2 neutral,
    /// 3 violet, 4 matrix, 5 mirage, 6 dawn. Any other code keeps the
    /// original colors.
    pub fn from_code(code: u32) -> Self {
        match code {
            0 => Self::Dark,
            1 => Self::Light,
            2 => Self::Neutral,
            3 => Self::Violet,
            4 => Self::Matrix,
            5 => Self::Mirage,
            6 => Self::Dawn,
            _ => Self::Original,
        }
    }
    /// Light themes (Дюна, Мираж, Рассвет) draw the scenes from Art's light
    /// paintings (`assets-light`); dark themes recolor only the dark originals.
    pub fn is_light(self) -> bool {
        matches!(self, Self::Light | Self::Mirage | Self::Dawn)
    }
    /// The mapping selector of `recolor.frag`.
    pub fn mode(self) -> f32 {
        match self {
            Self::Original | Self::Dark | Self::Light | Self::Matrix => 0.0,
            Self::Mirage | Self::Dawn => 3.0,
            Self::Neutral | Self::Violet => 2.0,
        }
    }
    /// The same values as `src/features/product/theme.ts` and the product
    /// engine's `palette.rs`. None draws the source as painted: the
    /// originals, or Дюна's light paintings.
    pub fn colors(self) -> Option<Colors> {
        let (paper, accent, highlight, detail) = match self {
            Self::Original | Self::Light => return None,
            Self::Dark => (rgb(0, 0, 0), rgb(245, 221, 7), rgb(245, 221, 7), [0.0; 3]),
            Self::Neutral => (
                rgb(13, 21, 32),
                rgb(134, 201, 199),
                rgb(214, 218, 210),
                [0.0; 3],
            ),
            Self::Violet => (
                rgb(13, 20, 38),
                rgb(98, 150, 245),
                rgb(170, 150, 214),
                [0.0; 3],
            ),
            Self::Matrix => (rgb(0, 0, 0), rgb(0, 255, 65), rgb(0, 255, 65), [0.0; 3]),
            Self::Mirage => (
                rgb(241, 223, 184),
                rgb(46, 91, 213),
                rgb(38, 59, 107),
                rgb(155, 111, 171),
            ),
            Self::Dawn => (
                rgb(243, 216, 199),
                rgb(156, 56, 87),
                rgb(96, 51, 70),
                rgb(183, 122, 67),
            ),
        };
        Some(Colors {
            paper,
            accent,
            highlight,
            detail,
        })
    }
    /// The shader's mapping of one opaque pixel, for tests and tools.
    pub fn recolor(self, color: [f32; 3]) -> [f32; 3] {
        let Some(Colors {
            paper,
            accent,
            highlight,
            detail,
        }) = self.colors()
        else {
            return color;
        };
        let dot = |c: [f32; 3]| (0..3).map(|i| c[i] * LUMA[i]).sum::<f32>();
        let mix = |a: [f32; 3], b: [f32; 3], t: f32| -> [f32; 3] {
            std::array::from_fn(|i| a[i] + (b[i] - a[i]) * t)
        };
        match self {
            Self::Dark | Self::Matrix => accent.map(|value| value * dot(color).clamp(0.0, 1.0)),
            Self::Mirage | Self::Dawn => {
                // A gradient map of the light painting: shadows in the text
                // ink, the middle in the accent, the glow in the detail color.
                // Дюна's page, the painting's paper, and anything lighter
                // become this page.
                let level = dot(color).clamp(0.0, 1.0);
                let soft = mix(detail, paper, 0.35);
                if level < 0.4 {
                    mix(highlight, accent, level / 0.4)
                } else if level < 0.72 {
                    mix(accent, soft, (level - 0.4) / 0.32)
                } else {
                    mix(soft, paper, ((level - 0.72) / 0.155).min(1.0))
                }
            }
            _ => {
                let level = dot(color).clamp(0.0, 1.0);
                let ink = level.powf(1.3) * 0.74;
                let muted = mix(accent, [dot(accent); 3], 0.4);
                let t = ((level - 0.45) / 0.5).clamp(0.0, 1.0);
                let tint = mix(muted, highlight, t * t * (3.0 - 2.0 * t) * 0.55);
                mix(paper, tint, ink)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const THEMES: [Palette; 7] = [
        Palette::Dark,
        Palette::Light,
        Palette::Neutral,
        Palette::Violet,
        Palette::Matrix,
        Palette::Mirage,
        Palette::Dawn,
    ];

    #[test]
    fn codes_follow_the_app_and_unknown_codes_keep_the_artwork() {
        assert_eq!(THEMES, [0, 1, 2, 3, 4, 5, 6].map(Palette::from_code));
        assert_eq!(Palette::from_code(255), Palette::Original);
        let gold = [0.93, 0.68, 0.12];
        assert_eq!(Palette::Original.recolor(gold), gold);
    }

    #[test]
    fn black_is_the_page_of_every_dark_theme() {
        for palette in THEMES.into_iter().filter(|p| !p.is_light()) {
            let paper = palette.colors().unwrap().paper;
            assert_eq!(palette.recolor([0.0; 3]), paper, "{palette:?}");
        }
    }

    #[test]
    fn matrix_uses_the_application_yellow_for_gold() {
        let [r, g, b] = Palette::Dark.recolor([1.0, 0.78, 0.07]);
        assert!(r > g && g > b * 20.0);
        assert!((g / r - 221.0 / 245.0).abs() < 1e-5);
    }

    #[test]
    fn dune_shows_the_light_paintings_as_painted() {
        assert!(Palette::Light.is_light());
        let amber = [0.98, 0.72, 0.31];
        assert_eq!(Palette::Light.recolor(amber), amber);
    }

    #[test]
    fn light_and_dark_theme_kinds() {
        let light: Vec<_> = THEMES.iter().filter(|p| p.is_light()).copied().collect();
        assert_eq!(light, [Palette::Light, Palette::Mirage, Palette::Dawn]);
    }

    #[test]
    fn mirage_and_dawn_map_the_light_painting_from_ink_to_page() {
        for palette in [Palette::Mirage, Palette::Dawn] {
            let colors = palette.colors().unwrap();
            assert_eq!(palette.recolor([0.0; 3]), colors.highlight);
            let page = palette.recolor([1.0; 3]);
            assert!((0..3).all(|i| (page[i] - colors.paper[i]).abs() < 1e-5));
            // Дюна's page is the paper of the light paintings.
            let dune = palette.recolor(rgb(250, 225, 143));
            assert!((0..3).all(|i| (dune[i] - colors.paper[i]).abs() < 1e-5));
            let luma = |[r, g, b]: [f32; 3]| r * LUMA[0] + g * LUMA[1] + b * LUMA[2];
            let mut previous = -1.0;
            for step in 4..=10 {
                let level = step as f32 / 10.0;
                let value = luma(palette.recolor([level; 3]));
                assert!(value >= previous, "{palette:?} at {level}");
                previous = value;
            }
        }
    }

    #[test]
    fn matrix_paints_gold_in_code_green() {
        let [r, g, b] = Palette::Matrix.recolor([1.0, 0.78, 0.07]);
        assert!(r == 0.0 && g > b * 3.0);
    }

    #[test]
    fn dark_themes_stay_cool_and_brighten_monotonically() {
        for palette in [Palette::Neutral, Palette::Violet] {
            let mut previous = 0.0;
            for step in 0..=10 {
                let level = step as f32 / 10.0;
                let [r, g, b] = palette.recolor([1.0, 0.8, 0.1].map(|c| c * level));
                let luma = r * LUMA[0] + g * LUMA[1] + b * LUMA[2];
                assert!(luma >= previous, "{palette:?} at {level}");
                assert!(b > r, "{palette:?} keeps gold out of the cool theme");
                previous = luma;
            }
        }
    }
}
