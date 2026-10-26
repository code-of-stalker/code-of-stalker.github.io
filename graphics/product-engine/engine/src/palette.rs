//! Palette changes affect presentation only: geometry, clocks and resources are
//! independent of the selected theme. Inputs and outputs use premultiplied alpha.
#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub enum Palette {
    #[default]
    Dark,
    Light,
    Neutral,
    Violet,
}
pub const OFFSET: usize = 264;
pub const BACKGROUND: [f32; 3] = [250. / 255., 225. / 255., 143. / 255.];
pub const ACCENT: [f32; 3] = [1., 102. / 255., 0.];
pub const NEUTRAL_BACKGROUND: [f32; 3] = [13. / 255., 21. / 255., 32. / 255.];
pub const NEUTRAL_ACCENT: [f32; 3] = [134. / 255., 201. / 255., 199. / 255.];
pub const VIOLET_BACKGROUND: [f32; 3] = [13. / 255., 20. / 255., 38. / 255.];
pub const VIOLET_ACCENT: [f32; 3] = [98. / 255., 150. / 255., 245. / 255.];
impl Palette {
    pub fn from_code(code: u32) -> Self {
        match code {
            1 => Self::Light,
            2 => Self::Neutral,
            3 => Self::Violet,
            _ => Self::Dark,
        }
    }
    /// Light themes draw Art's light (sand) paintings as painted where he
    /// supplied them; dark themes recolor only the dark originals.
    pub fn is_light(self) -> bool {
        matches!(self, Self::Light)
    }
    pub fn write(self, params: &mut [f32; 512]) {
        params[OFFSET] = match self {
            Self::Dark => 0.,
            Self::Light => 1.,
            Self::Neutral => 2.,
            Self::Violet => 3.,
        };
        params[OFFSET + 1] = 0.; // Authored full-color raster bypass is per scene.
        let (paper, accent) = match self {
            Self::Neutral => (NEUTRAL_BACKGROUND, NEUTRAL_ACCENT),
            Self::Violet => (VIOLET_BACKGROUND, VIOLET_ACCENT),
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
        let energy = pixel[0].max(pixel[1]).max(pixel[2]).clamp(0., pixel[3]);
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
