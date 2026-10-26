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
    /// Дюна: a sepia print in brown ink on sand.
    Light,
    /// Тишина.
    Neutral,
    /// Астрал.
    Violet,
    /// Матрица: code green on black.
    Matrix,
}

/// Paper, accent and highlight of one theme.
pub struct Colors {
    pub paper: [f32; 3],
    pub accent: [f32; 3],
    pub highlight: [f32; 3],
}

impl Palette {
    /// The codes of the app's `graphicsPalette`: 0 dark, 1 light, 2 neutral,
    /// 3 violet, 4 matrix. Any other code keeps the original colors.
    pub fn from_code(code: u32) -> Self {
        match code {
            0 => Self::Dark,
            1 => Self::Light,
            2 => Self::Neutral,
            3 => Self::Violet,
            4 => Self::Matrix,
            _ => Self::Original,
        }
    }
    /// The mapping selector of `recolor.frag`.
    pub fn mode(self) -> f32 {
        match self {
            Self::Original | Self::Dark | Self::Matrix => 0.0,
            Self::Light => 1.0,
            Self::Neutral | Self::Violet => 2.0,
        }
    }
    /// The same values as `src/features/product/theme.ts` and the product
    /// engine's `palette.rs`. Дюна's highlight is its brown text ink.
    pub fn colors(self) -> Option<Colors> {
        let (paper, accent, highlight) = match self {
            Self::Original => return None,
            Self::Dark => (rgb(0, 0, 0), rgb(245, 221, 7), rgb(245, 221, 7)),
            Self::Light => (rgb(250, 225, 143), rgb(255, 102, 0), rgb(190, 76, 0)),
            Self::Neutral => (rgb(13, 21, 32), rgb(134, 201, 199), rgb(214, 218, 210)),
            Self::Violet => (rgb(13, 20, 38), rgb(98, 150, 245), rgb(170, 150, 214)),
            Self::Matrix => (rgb(0, 0, 0), rgb(0, 255, 65), rgb(0, 255, 65)),
        };
        Some(Colors {
            paper,
            accent,
            highlight,
        })
    }
    /// The shader's mapping of one opaque pixel, for tests and tools.
    pub fn recolor(self, color: [f32; 3]) -> [f32; 3] {
        let Some(Colors {
            paper,
            accent,
            highlight,
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
            Self::Light => {
                let level = dot(color).clamp(0.0, 1.0);
                let print = mix(paper, highlight, (1.0 - level).powf(1.8) * 0.42);
                let t = ((level - 0.55) / 0.45).clamp(0.0, 1.0);
                mix(
                    print,
                    mix(paper, accent, 0.5),
                    t * t * (3.0 - 2.0 * t) * 0.35,
                )
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
    const THEMES: [Palette; 5] = [
        Palette::Dark,
        Palette::Light,
        Palette::Neutral,
        Palette::Violet,
        Palette::Matrix,
    ];

    #[test]
    fn codes_follow_the_app_and_unknown_codes_keep_the_artwork() {
        assert_eq!(THEMES, [0, 1, 2, 3, 4].map(Palette::from_code));
        assert_eq!(Palette::from_code(255), Palette::Original);
        let gold = [0.93, 0.68, 0.12];
        assert_eq!(Palette::Original.recolor(gold), gold);
    }

    #[test]
    fn black_is_the_page_of_every_dark_theme() {
        for palette in [Palette::Dark, Palette::Neutral, Palette::Violet, Palette::Matrix] {
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
    fn matrix_paints_gold_in_code_green() {
        let [r, g, b] = Palette::Matrix.recolor([1.0, 0.78, 0.07]);
        assert!(r == 0.0 && g > b * 3.0);
    }

    #[test]
    fn sand_keeps_the_picture_light_and_never_floods_it_with_orange() {
        let luma = |[r, g, b]: [f32; 3]| r * LUMA[0] + g * LUMA[1] + b * LUMA[2];
        let paper = Palette::Light.colors().unwrap().paper;
        let black = Palette::Light.recolor([0.0; 3]);
        let white = Palette::Light.recolor([1.0; 3]);
        // Shadows are a brown tint of the page, not a dark block.
        assert!(luma(black) > 0.55 && luma(black) < luma(paper));
        // Light warms toward the accent at most halfway.
        assert!(white[1] > 0.6 && white[2] > 0.25, "{white:?}");
        assert!(luma(white) > luma(black));
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
