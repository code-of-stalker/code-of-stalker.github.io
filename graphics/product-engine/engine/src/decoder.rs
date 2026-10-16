use crate::timeline::smooth;
/// Decoder does not exist visually until its own scroll visibility event.
pub struct Decoder {
    pub started: bool,
    pub visible: bool,
    pub elapsed: f64,
}
impl Default for Decoder {
    fn default() -> Self {
        Self {
            started: false,
            visible: false,
            elapsed: 0.,
        }
    }
}
impl Decoder {
    pub fn visible(&mut self, value: bool) {
        self.visible = value;
        if value {
            self.started = true;
        }
    }
    pub fn step(&mut self, dt: f64) {
        if self.started && self.visible {
            self.elapsed += dt.max(0.);
        }
    }
    pub fn progress(&self, reduced: bool) -> f32 {
        if !self.started {
            0.
        } else if reduced {
            1.
        } else {
            (self.elapsed / 3.1).clamp(0., 1.) as f32
        }
    }
    pub fn glyphs(&self, reduced: bool) -> String {
        let p = self.progress(reduced);
        let text = "ОСТАЛЬНЫЕ ПОХОЖИ.\nНО ОНИ НЕ ТЫ.";
        if !self.started {
            return String::new();
        }
        let locked = (smooth(0.1, 0.95, p)
            * text.chars().filter(|c| !c.is_whitespace()).count() as f32)
            .floor() as usize;
        let phase = (self.elapsed * 7.).floor() as usize;
        let symbols = ['0', '1', '┐', '└', '─', '·'];
        let mut i = 0;
        text.chars()
            .map(|ch| {
                if ch.is_whitespace() {
                    ch
                } else {
                    let out = if i < locked || p == 1. {
                        ch
                    } else {
                        symbols[(i * 5 + phase + i / 3) % symbols.len()]
                    };
                    i += 1;
                    out
                }
            })
            .collect()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stays_invisible_until_scrolled_to_and_freezes_outside_view() {
        let mut d = Decoder::default();
        d.step(900.);
        assert_eq!(d.glyphs(false), "");
        d.visible(true);
        d.step(1.);
        let elapsed = d.elapsed;
        d.visible(false);
        d.step(900.);
        assert_eq!(d.elapsed, elapsed);
        d.visible(true);
        d.step(3.);
        assert_eq!(d.glyphs(false), "ОСТАЛЬНЫЕ ПОХОЖИ.\nНО ОНИ НЕ ТЫ.");
    }
}
