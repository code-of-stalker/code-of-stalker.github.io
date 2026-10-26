//! Palette changes affect presentation only: geometry, clocks and resources are
//! independent of the selected theme. Inputs and outputs use premultiplied alpha.
//!
//! Theme kinds: Light, Mirage and Dawn (Дюна, Мираж, Рассвет) are light
//! themes; their illustrations are recolored programmatically for a light
//! page. Every other palette is a dark theme and is recolored only from the
//! authored dark (Искра) material. See [`Palette::is_light`].
#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub enum Palette {
    #[default]
    Dark,
    Light,
    Neutral,
    Violet,
    /// Матрица: the authored dark material, shown in code green.
    Matrix,
    /// Мираж: a cobalt and navy print on sand with lilac light.
    Mirage,
    /// Рассвет: a wine and plum print on peach with copper light.
    Dawn,
}
pub const OFFSET: usize = 264;
pub const BACKGROUND: [f32; 3] = [250. / 255., 225. / 255., 143. / 255.];
pub const ACCENT: [f32; 3] = [1., 102. / 255., 0.];
pub const NEUTRAL_BACKGROUND: [f32; 3] = [13. / 255., 21. / 255., 32. / 255.];
pub const NEUTRAL_ACCENT: [f32; 3] = [134. / 255., 201. / 255., 199. / 255.];
pub const VIOLET_BACKGROUND: [f32; 3] = [13. / 255., 20. / 255., 38. / 255.];
pub const VIOLET_ACCENT: [f32; 3] = [98. / 255., 150. / 255., 245. / 255.];
pub const MIRAGE_BACKGROUND: [f32; 3] = [241. / 255., 223. / 255., 184. / 255.];
pub const MIRAGE_ACCENT: [f32; 3] = [46. / 255., 91. / 255., 213. / 255.];
pub const DAWN_BACKGROUND: [f32; 3] = [243. / 255., 216. / 255., 199. / 255.];
pub const DAWN_ACCENT: [f32; 3] = [156. / 255., 56. / 255., 87. / 255.];
pub const MATRIX_ACCENT: [f32; 3] = [0., 1., 65. / 255.];
/// Rows of the linear map `presentation.wgsl` applies to the dark material:
/// gold becomes code green and white highlights a pale mint.
pub const MATRIX: [[f32; 3]; 3] = [[0., 0., 0.9], [0.55, 0.5, 0.], [0.25, 0., 0.6]];
impl Palette {
    pub fn from_code(code: u32) -> Self {
        match code {
            1 => Self::Light,
            2 => Self::Neutral,
            3 => Self::Violet,
            4 => Self::Matrix,
            5 => Self::Mirage,
            6 => Self::Dawn,
            _ => Self::Dark,
        }
    }
    /// Дюна, Мираж and Рассвет: illustrations print onto a light page.
    pub fn is_light(self) -> bool {
        matches!(self, Self::Light | Self::Mirage | Self::Dawn)
    }
    pub fn write(self, params: &mut [f32; 512]) {
        params[OFFSET] = match self {
            Self::Dark => 0.,
            Self::Light => 1.,
            Self::Neutral => 2.,
            Self::Violet => 3.,
            Self::Matrix => 4.,
            Self::Mirage => 5.,
            Self::Dawn => 6.,
        };
        params[OFFSET + 1] = 0.; // Authored full-color raster bypass is per scene.
        let (paper, accent) = match self {
            Self::Neutral => (NEUTRAL_BACKGROUND, NEUTRAL_ACCENT),
            Self::Violet => (VIOLET_BACKGROUND, VIOLET_ACCENT),
            Self::Matrix => ([0.; 3], MATRIX_ACCENT),
            Self::Mirage => (MIRAGE_BACKGROUND, MIRAGE_ACCENT),
            Self::Dawn => (DAWN_BACKGROUND, DAWN_ACCENT),
            _ => (BACKGROUND, ACCENT),
        };
        params[OFFSET + 4..OFFSET + 7].copy_from_slice(&paper);
        params[OFFSET + 8..OFFSET + 11].copy_from_slice(&accent);
    }
    #[cfg(test)]
    fn color(self, pixel: [f32; 4]) -> [f32; 4] {
        if self == Self::Dark {
            return pixel;
        }
        if self == Self::Matrix {
            return std::array::from_fn(|i| {
                if i == 3 {
                    pixel[3]
                } else {
                    (0..3)
                        .map(|k| MATRIX[i][k] * pixel[k])
                        .sum::<f32>()
                        .min(pixel[3])
                }
            });
        }
        let energy = pixel[0].max(pixel[1]).max(pixel[2]).clamp(0., pixel[3]);
        if matches!(self, Self::Mirage | Self::Dawn) {
            return print(self, pixel, energy);
        }
        let mut params = [0.; 512];
        self.write(&mut params);
        let paper = &params[OFFSET + 4..OFFSET + 7];
        let accent = &params[OFFSET + 8..OFFSET + 11];
        let t = ((energy - 0.32) / 0.63).clamp(0., 1.);
        let t = if matches!(self, Self::Neutral | Self::Violet) {
            t * t * (3. - 2. * t) * 0.25
        } else {
            0.
        };
        let light = if self == Self::Violet {
            [152. / 255., 105. / 255., 218. / 255.]
        } else {
            [228. / 255., 231. / 255., 221. / 255.]
        };
        std::array::from_fn(|i| {
            if i == 3 {
                pixel[3]
            } else {
                paper[i] * (pixel[3] - energy) + (accent[i] * (1. - t) + light[i] * t) * energy
            }
        })
    }
}
/// `presentation.wgsl`'s print role of the light themes, for tests: dim
/// lines in the text ink, bright ones in the accent and white highlights in
/// the detail color, on the theme's paper.
#[cfg(test)]
fn print(palette: Palette, pixel: [f32; 4], energy: f32) -> [f32; 4] {
    let (paper, accent, ink_color, detail) = if palette == Palette::Dawn {
        (
            DAWN_BACKGROUND,
            DAWN_ACCENT,
            [96. / 255., 51. / 255., 70. / 255.],
            [183. / 255., 122. / 255., 67. / 255.],
        )
    } else {
        (
            MIRAGE_BACKGROUND,
            MIRAGE_ACCENT,
            [38. / 255., 59. / 255., 107. / 255.],
            [155. / 255., 111. / 255., 171. / 255.],
        )
    };
    let smooth = |a: f32, b: f32, x: f32| {
        let t = ((x - a) / (b - a)).clamp(0., 1.);
        t * t * (3. - 2. * t)
    };
    let level = energy / pixel[3].max(0.0001);
    let white = pixel[0].min(pixel[1]).min(pixel[2]).max(0.) / energy.max(0.0001);
    let bright = smooth(0.25, 0.85, level);
    let light = smooth(0.5, 0.95, white) * 0.6;
    let ink = energy * 0.92;
    std::array::from_fn(|i| {
        if i == 3 {
            return pixel[3];
        }
        let tint = ink_color[i] + (accent[i] - ink_color[i]) * bright;
        let tint = tint + (detail[i] - tint) * light;
        paper[i] * (pixel[3] - ink) + tint * ink
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn neutral_bright_vector_is_cool_and_keeps_alpha() {
        let color = Palette::Neutral.color([1., 0.88, 0.03, 1.]);
        assert!(color[1] > color[0] && color[2] > color[0]);
        assert_eq!(color[3], 1.);
    }
    #[test]
    fn dark_is_exact_identity() {
        let pixel = [0.91, 0.44, 0.2, 0.95];
        assert_eq!(Palette::Dark.color(pixel), pixel);
    }
    #[test]
    fn paper_and_light_keep_transparency() {
        assert_eq!(Palette::Light.color([0.; 4]), [0.; 4]);
        assert_eq!(Palette::Light.color([0., 0., 0., 1.])[..3], BACKGROUND);
        assert_eq!(Palette::Light.color([1., 0.88, 0.03, 1.])[..3], ACCENT);
        for alpha in [0., 0.01, 0.25, 0.5, 1.] {
            let pixel = Palette::Light.color([alpha, alpha * 0.8, 0., alpha]);
            assert_eq!(pixel[3], alpha);
            assert!(pixel[..3].iter().all(|v| *v >= 0. && *v <= alpha));
        }
    }
    #[test]
    fn uniforms_leave_material_and_layout_untouched() {
        let mut params = [7.; 512];
        Palette::Light.write(&mut params);
        assert!(params[..OFFSET].iter().all(|v| *v == 7.));
        assert!(params[OFFSET + 11..].iter().all(|v| *v == 7.));
        assert_eq!(params[OFFSET], 1.);
        Palette::Dark.write(&mut params);
        assert_eq!(params[OFFSET], 0.);
    }
    #[test]
    fn neutral_is_typed_and_premultiplied() {
        assert!(Palette::from_code(2) == Palette::Neutral);
        assert!(Palette::from_code(99) == Palette::Dark);
        for alpha in [0., 0.01, 0.25, 0.5, 1.] {
            let color = Palette::Neutral.color([alpha, alpha * 0.8, 0., alpha]);
            assert_eq!(color[3], alpha);
            assert!(color[..3].iter().all(|v| *v >= 0. && *v <= alpha));
        }
        assert_eq!(Palette::Neutral.color([0.; 4]), [0.; 4]);
    }
    #[test]
    fn neutral_clear_material_blends_into_the_product_background() {
        // Changing the paper must not introduce a visible rectangular surface
        // or change the glass alpha from the authored dark material.
        for alpha in [0., 0.01, 0.25, 0.5, 1.] {
            let color = Palette::Neutral.color([0., 0., 0., alpha]);
            for channel in 0..3 {
                let composite = color[channel] + NEUTRAL_BACKGROUND[channel] * (1. - alpha);
                assert!((composite - NEUTRAL_BACKGROUND[channel]).abs() < 0.00001);
            }
            assert_eq!(color[3], Palette::Dark.color([0., 0., 0., alpha])[3]);
        }
    }
    #[test]
    fn matrix_turns_gold_into_code_green_and_keeps_alpha() {
        assert!(Palette::from_code(4) == Palette::Matrix);
        assert_eq!(Palette::Matrix.color([0.; 4]), [0.; 4]);
        let [r, g, b, a] = Palette::Matrix.color([1., 0.87, 0.03, 1.]);
        assert!(g > 0.95 && r < 0.05 && b > 0.2 && b < 0.3);
        assert_eq!(a, 1.);
        let white = Palette::Matrix.color([1., 1., 1., 1.]);
        assert!(white[0] > 0.8 && white[1] == 1. && white[2] > 0.8);
        for alpha in [0., 0.01, 0.25, 0.5, 1.] {
            let pixel = Palette::Matrix.color([alpha, alpha * 0.8, 0., alpha]);
            assert_eq!(pixel[3], alpha);
            assert!(pixel[..3].iter().all(|v| *v >= 0. && *v <= alpha));
            assert!(pixel[1] >= pixel[0] && pixel[1] >= pixel[2]);
        }
    }
    #[test]
    fn mirage_prints_on_sand_and_keeps_alpha() {
        assert!(Palette::from_code(5) == Palette::Mirage);
        assert_eq!(Palette::Mirage.color([0.; 4]), [0.; 4]);
        assert_eq!(
            Palette::Mirage.color([0., 0., 0., 1.])[..3],
            MIRAGE_BACKGROUND
        );
        let gold = Palette::Mirage.color([1., 0.87, 0.03, 1.]);
        assert!(gold[2] > gold[0] && gold[2] > gold[1], "{gold:?}");
        let white = Palette::Mirage.color([1., 1., 1., 1.]);
        assert!(white[0] > gold[0], "highlights lean lilac: {white:?}");
        for alpha in [0., 0.01, 0.25, 0.5, 1.] {
            let pixel = Palette::Mirage.color([alpha, alpha * 0.8, 0., alpha]);
            assert_eq!(pixel[3], alpha);
            assert!(pixel[..3].iter().all(|v| *v >= 0. && *v <= alpha + 1e-6));
        }
    }
    #[test]
    fn light_and_dark_theme_kinds() {
        let light: Vec<_> = (0..7)
            .filter(|c| Palette::from_code(*c).is_light())
            .collect();
        assert_eq!(light, [1, 5, 6]);
    }
    #[test]
    fn dawn_prints_wine_on_peach() {
        assert!(Palette::from_code(6) == Palette::Dawn);
        assert_eq!(Palette::Dawn.color([0., 0., 0., 1.])[..3], DAWN_BACKGROUND);
        let gold = Palette::Dawn.color([1., 0.87, 0.03, 1.]);
        assert!(gold[0] > gold[1] && gold[2] > gold[1], "{gold:?}");
        for alpha in [0., 0.01, 0.25, 0.5, 1.] {
            let pixel = Palette::Dawn.color([alpha, alpha * 0.8, 0., alpha]);
            assert_eq!(pixel[3], alpha);
            assert!(pixel[..3].iter().all(|v| *v >= 0. && *v <= alpha + 1e-6));
        }
    }
    #[test]
    fn violet_material_preserves_alpha_and_clear_edges() {
        assert!(Palette::from_code(3) == Palette::Violet);
        assert_eq!(Palette::Violet.color([0.; 4]), [0.; 4]);
        for alpha in [0., 0.01, 0.25, 0.5, 1.] {
            let clear = Palette::Violet.color([0., 0., 0., alpha]);
            let bright = Palette::Violet.color([alpha, alpha * 0.8, 0., alpha]);
            assert_eq!(bright[3], alpha);
            assert!(bright[..3].iter().all(|v| *v >= 0. && *v <= alpha));
            for channel in 0..3 {
                let composite = clear[channel] + VIOLET_BACKGROUND[channel] * (1. - alpha);
                assert!((composite - VIOLET_BACKGROUND[channel]).abs() < 0.00001);
            }
            assert!(bright[2] >= bright[0] && bright[2] >= bright[1]);
        }
    }
}
