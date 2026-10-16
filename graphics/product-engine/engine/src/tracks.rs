//! Typed, continuous authored curves and morphs. Build-time samples are knots,
//! never runtime frames. A 90/120 Hz presentation evaluates between the knots.
use crate::scene_model::ease;
#[derive(Clone, Debug)]
pub struct Value {
    pub numbers: Vec<f32>,
    pub literals: Vec<String>,
}
impl Value {
    pub fn parse(text: &str) -> Self {
        let bytes = text.as_bytes();
        let mut cursor = 0;
        let mut begin = 0;
        let mut numbers = Vec::new();
        let mut literals = Vec::new();
        while cursor < bytes.len() {
            let c = bytes[cursor];
            if c.is_ascii_digit()
                || c == b'.'
                || (c == b'-' || c == b'+')
                    && cursor + 1 < bytes.len()
                    && (bytes[cursor + 1].is_ascii_digit() || bytes[cursor + 1] == b'.')
            {
                let start = cursor;
                cursor += 1;
                while cursor < bytes.len()
                    && (bytes[cursor].is_ascii_digit() || bytes[cursor] == b'.')
                {
                    cursor += 1;
                }
                if cursor < bytes.len()
                    && (bytes[cursor] == b'e' || bytes[cursor] == b'E')
                    && cursor + 1 < bytes.len()
                    && (bytes[cursor + 1].is_ascii_digit()
                        || bytes[cursor + 1] == b'-'
                        || bytes[cursor + 1] == b'+')
                {
                    cursor += 1;
                    if bytes[cursor] == b'-' || bytes[cursor] == b'+' {
                        cursor += 1;
                    }
                    while cursor < bytes.len() && bytes[cursor].is_ascii_digit() {
                        cursor += 1;
                    }
                }
                if let Ok(value) = text[start..cursor].parse::<f32>() {
                    literals.push(text[begin..start].into());
                    numbers.push(value);
                    begin = cursor;
                }
            } else {
                cursor += 1;
            }
        }
        literals.push(text[begin..].into());
        Self { numbers, literals }
    }
    pub fn string(&self) -> String {
        self.blend(self, 0.)
    }
    pub fn blend(&self, next: &Self, t: f32) -> String {
        if self.literals != next.literals || self.numbers.len() != next.numbers.len() {
            return if t < 0.5 { self } else { next }.string_direct();
        }
        let mut out = String::new();
        for (i, a) in self.numbers.iter().enumerate() {
            out.push_str(&self.literals[i]);
            let value = a + (next.numbers[i] - a) * t;
            // SVG arc flags are exactly `0`/`1`, not floating point tokens.
            // Retaining integer syntax also keeps authored path commands valid.
            if value.fract().abs() < 0.000001 {
                out.push_str(&format!("{value:.0}"));
            } else {
                out.push_str(&format!("{value:.5}"));
            }
        }
        out.push_str(self.literals.last().unwrap());
        out
    }
    fn string_direct(&self) -> String {
        let mut out = String::new();
        for (i, n) in self.numbers.iter().enumerate() {
            out.push_str(&self.literals[i]);
            out.push_str(&n.to_string());
        }
        out.push_str(self.literals.last().unwrap());
        out
    }
}
#[derive(Clone, Debug)]
pub struct Knot {
    pub at: f64,
    pub value: Value,
}
#[derive(Clone, Debug)]
pub struct Track {
    pub node: usize,
    pub name: String,
    pub duration: f64,
    pub curve: Option<[f32; 4]>,
    pub knots: Vec<Knot>,
}
impl Track {
    pub fn sample(&self, seconds: f64, reduced: bool) -> String {
        let time = if reduced {
            self.duration * 0.62
        } else if self.duration > 0. {
            seconds.rem_euclid(self.duration)
        } else {
            seconds
        };
        let i = self.knots.partition_point(|k| k.at < time);
        if i == 0 {
            return self.knots[0].value.string();
        }
        if i >= self.knots.len() {
            return self.knots.last().unwrap().value.string();
        }
        let a = &self.knots[i - 1];
        let b = &self.knots[i];
        let mut p = ((time - a.at) / (b.at - a.at).max(1e-9)).clamp(0., 1.) as f32;
        if let Some(curve) = self.curve {
            p = ease(p, curve);
        }
        a.value.blend(&b.value, p)
    }
}
pub fn parse(source: &str) -> Result<Vec<Track>, String> {
    let doc = roxmltree::Document::parse(source).map_err(|e| e.to_string())?;
    let root = doc.root_element();
    let duration = root
        .attribute("duration")
        .unwrap_or("0")
        .parse()
        .map_err(|_| "Invalid timeline duration")?;
    root.children()
        .filter(|n| n.has_tag_name("field"))
        .map(|n| {
            let node = n
                .attribute("node")
                .ok_or("Missing timeline node")?
                .parse()
                .map_err(|_| "Invalid timeline node")?;
            let name = n
                .attribute("name")
                .ok_or("Missing timeline property")?
                .to_string();
            let duration = n.attribute("duration").map_or(Ok(duration), |v| {
                v.parse::<f64>().map_err(|_| "Invalid curve duration")
            })?;
            let curve = if let Some(value) = n.attribute("curve") {
                let numbers: Vec<f32> = value
                    .split_whitespace()
                    .map(str::parse)
                    .collect::<Result<_, _>>()
                    .map_err(|_| "Invalid easing")?;
                Some(
                    numbers
                        .try_into()
                        .map_err(|_| "Easing needs four controls")?,
                )
            } else {
                None
            };
            let knots = n
                .children()
                .filter(|v| v.has_tag_name("v"))
                .map(|v| {
                    Ok(Knot {
                        at: v
                            .attribute("t")
                            .ok_or("Missing knot time")?
                            .parse()
                            .map_err(|_| "Invalid knot time")?,
                        value: Value::parse(v.attribute("value").ok_or("Missing knot value")?),
                    })
                })
                .collect::<Result<Vec<_>, String>>()?;
            if knots.is_empty() {
                return Err("Empty authored curve".into());
            }
            Ok(Track {
                node,
                name,
                duration,
                curve,
                knots,
            })
        })
        .collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn vector_morph_is_continuous_at_90_and_120_hz() {
        let a = Value::parse("M0 2C3 4 5 6 7 8");
        let b = Value::parse("M10 12C13 14 15 16 17 18");
        assert_eq!(
            Value::parse(&a.blend(&b, 0.5)).numbers,
            vec![5., 7., 8., 9., 10., 11., 12., 13.]
        );
    }
    #[test]
    fn original_arc_morph_knots_keep_valid_svg_flags() {
        for source in [
            include_str!("../assets/insight.tracks.xml"),
            include_str!("../assets/distance.tracks.xml"),
        ] {
            for track in parse(source).unwrap().into_iter().filter(|t| t.name == "d") {
                for pair in track.knots.windows(2).step_by(15) {
                    let d = pair[0].value.blend(&pair[1].value, 0.5);
                    crate::vector_geometry::path(&d)
                        .unwrap_or_else(|e| panic!("node {}: {e}: {d}", track.node));
                }
            }
        }
    }
    #[test]
    fn compiled_original_tracks_are_valid() {
        for source in [
            include_str!("../assets/parallel.tracks.xml"),
            include_str!("../assets/guidance.tracks.xml"),
            include_str!("../assets/intensive.tracks.xml"),
            include_str!("../assets/distance.tracks.xml"),
            include_str!("../assets/cells.tracks.xml"),
            include_str!("../assets/diary.tracks.xml"),
            include_str!("../assets/basic.tracks.xml"),
            include_str!("../assets/attention.tracks.xml"),
            include_str!("../assets/comparison.tracks.xml"),
            include_str!("../assets/crowd.tracks.xml"),
            include_str!("../assets/insight.tracks.xml"),
        ] {
            let curves = parse(source).unwrap();
            assert!(!curves.is_empty());
            for curve in curves {
                for i in 0..90 {
                    assert!(!curve.sample(i as f64 / 90., false).contains("NaN"));
                }
            }
        }
    }
    #[test]
    fn lower_projector_ray_follows_the_left_fingertip_through_retreat_and_return() {
        let svg = roxmltree::Document::parse(include_str!("../assets/distance.svg")).unwrap();
        let node_id = |name: &str| {
            svg.descendants()
                .filter(|n| n.attribute(name).is_some())
                .last()
                .unwrap()
                .attribute("data-rust-node")
                .unwrap()
                .parse::<usize>()
                .unwrap()
        };
        let tracks = parse(include_str!("../assets/distance.tracks.xml")).unwrap();
        let ray = tracks
            .iter()
            .find(|t| t.node == node_id("data-distance-ray") && t.name == "d")
            .unwrap();
        let person = tracks
            .iter()
            .find(|t| t.node == node_id("data-distance-person") && t.name == "transform")
            .unwrap();
        for time in [0., 1.5, 3.3, 4.5, 7.6, 9.2] {
            let tip = Value::parse(&ray.sample(time, false)).numbers;
            let shift = Value::parse(&person.sample(time, false)).numbers[4];
            assert!((tip[2] - shift - (-18. + 61.75 * 2.05)).abs() < 0.001);
            assert!((tip[3] - (-8. + 138.57 * 2.05)).abs() < 0.001);
        }
    }
    #[test]
    fn units_and_negative_exponents_survive() {
        let value = Value::parse("translate(-1.3e-4px, 20%)");
        assert_eq!(value.numbers, vec![-0.00013, 20.]);
        assert_eq!(value.literals, vec!["translate(", "px, ", "%)"]);
    }
}
