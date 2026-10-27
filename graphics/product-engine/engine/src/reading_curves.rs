//! Approved reading artwork, compiled into declarative continuous curves.
//! No authoring JavaScript is executed or embedded by the product runtime.
//! Parsing is separate from sampling; the clock and interpolation are Rust.
use std::fmt::Write;

#[derive(Debug, PartialEq)]
pub enum CurveError {
    Truncated,
    Signature,
    Limit,
    Utf8,
    NonFinite,
    Format,
    Time,
    Trailing,
    Compression,
}
#[derive(Clone)]
struct Knot {
    at: f32,
    format: usize,
    numbers: Vec<f32>,
}
pub struct Field {
    pub node: usize,
    pub name: String,
    formats: Vec<Vec<String>>,
    knots: Vec<Knot>,
}
pub struct Curves {
    pub duration: f64,
    pub fields: Vec<Field>,
}
struct Reader<'a> {
    bytes: &'a [u8],
    at: usize,
}
impl Reader<'_> {
    fn take(&mut self, length: usize) -> Result<&[u8], CurveError> {
        let end = self.at.checked_add(length).ok_or(CurveError::Limit)?;
        let value = self.bytes.get(self.at..end).ok_or(CurveError::Truncated)?;
        self.at = end;
        Ok(value)
    }
    fn count(&mut self) -> Result<usize, CurveError> {
        let value = u32::from_le_bytes(self.take(4)?.try_into().unwrap()) as usize;
        if value > 2_000_000 {
            return Err(CurveError::Limit);
        }
        Ok(value)
    }
    fn number(&mut self) -> Result<f32, CurveError> {
        let value = f32::from_le_bytes(self.take(4)?.try_into().unwrap());
        if value.is_finite() {
            Ok(value)
        } else {
            Err(CurveError::NonFinite)
        }
    }
    fn text(&mut self) -> Result<String, CurveError> {
        let n = self.count()?;
        String::from_utf8(self.take(n)?.to_vec()).map_err(|_| CurveError::Utf8)
    }
}
impl Curves {
    pub fn parse(bytes: &[u8]) -> Result<Self, CurveError> {
        if bytes.first() == Some(&0x78) {
            let unpacked =
                miniz_oxide::inflate::decompress_to_vec_zlib_with_limit(bytes, 16 * 1024 * 1024)
                    .map_err(|_| CurveError::Compression)?;
            if !unpacked.starts_with(b"WRC1") {
                return Err(CurveError::Signature);
            }
            return Self::parse(&unpacked);
        }
        let mut r = Reader { bytes, at: 0 };
        if r.take(4)? != b"WRC1" {
            return Err(CurveError::Signature);
        }
        let duration = r.number()? as f64;
        if duration < 0. {
            return Err(CurveError::Time);
        }
        let n = r.count()?;
        let mut fields = Vec::new();
        for _ in 0..n {
            let node = r.count()?;
            let name = r.text()?;
            let n = r.count()?;
            let mut formats = Vec::new();
            for _ in 0..n {
                let n = r.count()?;
                if n == 0 {
                    return Err(CurveError::Format);
                }
                let mut literals = Vec::new();
                for _ in 0..n {
                    literals.push(r.text()?);
                }
                formats.push(literals);
            }
            let n = r.count()?;
            if n == 0 {
                return Err(CurveError::Format);
            }
            let mut knots = Vec::new();
            let mut previous = -1.;
            for _ in 0..n {
                let at = r.number()?;
                if at < 0. || at < previous {
                    return Err(CurveError::Time);
                }
                previous = at;
                let format = r.count()?;
                let count = formats.get(format).ok_or(CurveError::Format)?.len() - 1;
                let mut numbers = Vec::with_capacity(count);
                for _ in 0..count {
                    numbers.push(r.number()?);
                }
                knots.push(Knot {
                    at,
                    format,
                    numbers,
                });
            }
            fields.push(Field {
                node,
                name,
                formats,
                knots,
            });
        }
        if r.at != bytes.len() {
            return Err(CurveError::Trailing);
        }
        Ok(Self { duration, fields })
    }
    pub fn time(&self, seconds: f64) -> f32 {
        if self.duration > 0. {
            seconds.rem_euclid(self.duration) as f32
        } else {
            0.
        }
    }
}
impl Field {
    pub fn sample(&self, time: f32) -> String {
        let next = self
            .knots
            .partition_point(|v| v.at < time)
            .min(self.knots.len() - 1);
        let before = next.saturating_sub(1);
        let a = &self.knots[before];
        let b = &self.knots[next];
        let p = if b.at > a.at {
            ((time - a.at) / (b.at - a.at)).clamp(0., 1.)
        } else {
            0.
        };
        // Painter ranks are categorical. A fractional rank can put a cover
        // over a leaf before the authored crossing, including during closure.
        let painter_order = self.name == "data-paint-order";
        let interpolate = a.format == b.format && !painter_order;
        let base = if painter_order {
            &self.knots[self
                .knots
                .partition_point(|v| v.at <= time)
                .saturating_sub(1)]
        } else if interpolate || p < 0.5 {
            a
        } else {
            b
        };
        let literals = &self.formats[base.format];
        let mut out = String::new();
        for (i, number) in base.numbers.iter().enumerate() {
            out.push_str(&literals[i]);
            let n = if interpolate {
                a.numbers[i] + (b.numbers[i] - a.numbers[i]) * p
            } else {
                *number
            };
            if n.fract().abs() < 0.000001 {
                let _ = write!(out, "{n:.0}");
            } else {
                let _ = write!(out, "{n:.5}");
            }
        }
        out.push_str(literals.last().unwrap());
        out
    }
}

pub struct Assets {
    pub svg: &'static str,
    pub full: &'static [u8],
    pub soft: &'static [u8],
    pub full_still: &'static [u8],
    pub soft_still: &'static [u8],
}
/// The SVG and still poses stay in the binary; the motion curves are published
/// beside the engine (`assets/external.txt`) and arrive with the scene.
macro_rules! assets {($kind:expr,$($name:literal),*)=>{match $kind{$($name=>Some((
    include_str!(concat!("../assets/reading/",$name,".svg")),
    [concat!("reading/",$name,".full.wrc.z"), concat!("reading/",$name,".soft.wrc.z")],
    include_bytes!(concat!("../assets/reading/",$name,".full.still.wrc.z")).as_slice(),
    include_bytes!(concat!("../assets/reading/",$name,".soft.still.wrc.z")).as_slice())),)*_=>None}}}
#[allow(clippy::type_complexity)]
fn sources(
    kind: &str,
) -> Option<(
    &'static str,
    [&'static str; 2],
    &'static [u8],
    &'static [u8],
)> {
    assets!(
        kind,
        "book",
        "reflections",
        "single-hero",
        "identity-imprints",
        "lived-paths",
        "dream-world",
        "dream-wake",
        "dream-inward",
        "dreamer"
    )
}
/// Published motion curves of a reading scene; None for other kinds.
pub fn external(kind: &str) -> Option<[&'static str; 2]> {
    sources(kind).map(|(_, curves, _, _)| curves)
}
/// None for kinds that are not reading scenes; an error while curves are missing.
pub fn assets(kind: &str) -> Result<Option<Assets>, String> {
    let Some((svg, [full, soft], full_still, soft_still)) = sources(kind) else {
        return Ok(None);
    };
    Ok(Some(Assets {
        svg,
        full: crate::asset_store::bytes(full)?,
        soft: crate::asset_store::bytes(soft)?,
        full_still,
        soft_still,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_approved_scene_is_script_free_finite_and_complete() {
        for kind in [
            "book",
            "reflections",
            "single-hero",
            "identity-imprints",
            "lived-paths",
            "dream-world",
            "dream-wake",
            "dream-inward",
            "dreamer",
        ] {
            let a = assets(kind).unwrap().unwrap();
            assert!(!a.svg.contains("<script"));
            assert!(!a.svg.contains("requestAnimationFrame"));
            let doc = roxmltree::Document::parse(a.svg).unwrap();
            let nodes = doc
                .descendants()
                .filter(|v| v.attribute("data-rust-node").is_some())
                .count();
            for bytes in [a.full, a.soft, a.full_still, a.soft_still] {
                let curves = Curves::parse(bytes).unwrap();
                for field in &curves.fields {
                    assert!(field.node < nodes, "{kind}: missing node");
                    for i in 0..=120 {
                        let s = field.sample(curves.time(i as f64 * curves.duration / 120.));
                        assert!(!s.contains("NaN") && !s.contains("Infinity"));
                    }
                }
                assert!((curves.time(curves.duration + 0.25) - curves.time(0.25)).abs() < 0.0001);
            }
        }
    }
    #[test]
    fn malformed_input_is_rejected_without_panics() {
        let unpacked = miniz_oxide::inflate::decompress_to_vec_zlib_with_limit(
            assets("book").unwrap().unwrap().full,
            16 * 1024 * 1024,
        )
        .unwrap();
        let bytes = unpacked.as_slice();
        for n in [0, 1, 4, 8, 12, 50, bytes.len() - 1] {
            assert!(Curves::parse(&bytes[..n]).is_err());
        }
        let mut damaged = bytes.to_vec();
        damaged[4..8].copy_from_slice(&f32::NAN.to_le_bytes());
        assert!(matches!(
            Curves::parse(&damaged),
            Err(CurveError::NonFinite)
        ));
        damaged = bytes.to_vec();
        damaged.push(0);
        assert!(matches!(Curves::parse(&damaged), Err(CurveError::Trailing)));
    }
    #[test]
    fn topology_changes_are_discrete_and_interpolation_is_continuous() {
        let field = Field {
            node: 0,
            name: "d".into(),
            formats: vec![vec!["M".into(), " ".into(), "Z".into()]],
            knots: vec![
                Knot {
                    at: 0.,
                    format: 0,
                    numbers: vec![0., 10.],
                },
                Knot {
                    at: 1.,
                    format: 0,
                    numbers: vec![10., 20.],
                },
            ],
        };
        assert_eq!(field.sample(0.25), "M2.50000 12.50000Z");
        assert_eq!(field.sample(0.5), "M5 15Z");
    }
    #[test]
    fn painter_order_changes_only_at_the_authored_crossing() {
        let field = Field {
            node: 0,
            name: "data-paint-order".into(),
            formats: vec![vec![String::new(), String::new()]],
            knots: vec![
                Knot {
                    at: 0.,
                    format: 0,
                    numbers: vec![7.],
                },
                Knot {
                    at: 1.,
                    format: 0,
                    numbers: vec![2.],
                },
                Knot {
                    at: 2.,
                    format: 0,
                    numbers: vec![7.],
                },
            ],
        };
        assert_eq!(field.sample(0.99), "7");
        assert_eq!(field.sample(1.), "2");
        assert_eq!(field.sample(1.99), "2");
        assert_eq!(field.sample(2.), "7");
    }
    #[test]
    fn compiled_book_pages_are_above_the_open_cover_in_both_palettes_and_still_pose() {
        let asset = assets("book").unwrap().unwrap();
        let doc = roxmltree::Document::parse(asset.svg).unwrap();
        let node = |surface: &str| {
            doc.descendants()
                .find(|v| v.attribute("data-surface") == Some(surface))
                .unwrap()
        };
        let cover = node("front-cover");
        let page = node("turning-page-3");
        for (motion, still) in [
            (asset.full, asset.full_still),
            (asset.soft, asset.soft_still),
        ] {
            let motion = Curves::parse(motion).unwrap();
            let still = Curves::parse(still).unwrap();
            let rank = |node: roxmltree::Node<'_, '_>, time: f32, reduced: bool| {
                let id = node
                    .attribute("data-rust-node")
                    .unwrap()
                    .parse::<usize>()
                    .unwrap();
                let field = |curves: &Curves, at| {
                    curves
                        .fields
                        .iter()
                        .find(|v| v.node == id && v.name == "data-paint-order")
                        .map(|v| v.sample(at))
                };
                let value = if reduced {
                    field(&still, 0.).or_else(|| field(&motion, 0.))
                } else {
                    field(&motion, time)
                };
                value
                    .unwrap_or_else(|| node.attribute("data-paint-order").unwrap().to_owned())
                    .parse::<usize>()
                    .unwrap()
            };
            assert!(rank(cover, 0., false) > rank(page, 0., false));
            assert!(rank(cover, 5., false) < rank(page, 5., false));
            assert!(rank(cover, 14., false) > rank(page, 14., false));
            assert!(rank(cover, 0., true) < rank(page, 0., true));
        }
    }
}
