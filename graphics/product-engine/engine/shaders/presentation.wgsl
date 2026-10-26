// The existing presentation pass recolors its cached image. No extra canvas,
// intermediate texture, full-screen pass or per-frame JS work is introduced.
struct Palette {
    material: array<vec4<f32>, 66>,
    mode: vec4<f32>, paper: vec4<f32>, accent: vec4<f32>,
}
@group(0) @binding(0) var<uniform> palette: Palette;
@group(0) @binding(1) var image: texture_2d<f32>;
@group(0) @binding(3) var smooth_sampler: sampler;
struct V { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> }
fn spot(p: vec2<f32>, center: vec2<f32>, radius: vec2<f32>) -> f32 {
    let q = (p - center) / radius;
    return exp(-dot(q, q) * 2.);
}
@fragment fn main(v: V) -> @location(0) vec4<f32> {
    let pixel = textureSample(image, smooth_sampler, vec2(v.uv.x, 1. - v.uv.y));
    // Grounding uses the application's Matrix yellow, not the gold pigment of
    // its immutable source. Other themes continue through the shared palette.
    if (palette.mode.x < .5 && palette.mode.y > 3.5) {
        let energy = clamp(dot(pixel.rgb, vec3(.2126, .7152, .0722)), 0., pixel.a);
        return vec4(vec3(245. / 255., 221. / 255., 7. / 255.) * energy, pixel.a);
    }
    if (palette.mode.x < .5) { return pixel; }
    // Sand portraits are an authored RGBA asset, not a duotone of the original.
    if (palette.mode.x < 1.5 && palette.mode.y > .5 && palette.mode.y < 1.5) { return pixel; }
    // So are Art's light paintings of the voice and grounding scenes in Дюна.
    if (palette.mode.x > .5 && palette.mode.x < 1.5 && palette.mode.y > 2.5) { return pixel; }
    // The voice scene is a full-color gold painting. Max-channel duotone turned
    // all of it into saturated accent, so keep its shading via luminance,
    // compress the glows and use a muted accent with a soft highlight.
    if (palette.mode.x > 1.5 && palette.mode.y > 2.5) {
        let luma = clamp(dot(pixel.rgb, vec3(.2126, .7152, .0722)), 0., pixel.a);
        let level = luma / max(pixel.a, .0001);
        let ink = pow(level, 1.3) * .74 * pixel.a;
        let muted = mix(palette.accent.rgb, vec3(dot(palette.accent.rgb, vec3(.2126, .7152, .0722))), .4);
        let highlight = select(vec3(214. / 255., 218. / 255., 210. / 255.), vec3(170. / 255., 150. / 255., 214. / 255.), palette.mode.x > 2.5);
        let tint = mix(muted, highlight, smoothstep(.45, .95, level) * .55);
        return vec4(palette.paper.rgb * (pixel.a - ink) + tint * ink, pixel.a);
    }
    // Mirror uses its existing hero/faces masks and localized chest light.
    if (palette.mode.x > 1.5 && palette.mode.y > 1.5) { return pixel; }
    let energy = clamp(max(max(pixel.r, pixel.g), pixel.b), 0., pixel.a);
    var light = palette.accent.rgb;
    if (palette.mode.x > 1.5) {
        if (palette.mode.y > .5) {
            // Preserve portrait shading and keep the secondary light local
            // to the emission and feet in both dark color palettes.
            let size = vec2<f32>(textureDimensions(image));
            let logical = vec2(1487., 1058.);
            let scale = min(size.x / logical.x, size.y / logical.y);
            let p = (vec2(v.uv.x, 1. - v.uv.y) * size - (size - logical * scale) * .5) / scale;
            let luma = clamp(dot(pixel.rgb, vec3(.16, .74, .10)), 0., pixel.a);
            let hero = (1. - smoothstep(102., 135., abs(p.x - 743.))) * smoothstep(242., 262., p.y) * (1. - smoothstep(845., 870., p.y));
            let ink = mix(pow(luma, 1.12) * .60, pow(clamp((luma - .025) / .975, 0., 1.), 1.38), hero);
            var rgb = palette.paper.rgb * (pixel.a - ink) + palette.accent.rgb * ink;
            let outside = 1. - smoothstep(238., 263., p.y) + smoothstep(844., 874., p.y);
            let beam = exp(-pow((p.x - 743.) / 7., 2.)) * outside;
            let halo = exp(-pow((p.x - 743.) / 35., 2.)) * outside;
            let foot = spot(p, vec2(743., 847.), vec2(47., 11.));
            let warm = select(vec3(209. / 255., 189. / 255., 150. / 255.), vec3(152. / 255., 105. / 255., 218. / 255.), palette.mode.x > 2.5);
            let warmth = max(beam * .88, foot * .66);
            let warmInk = pow(luma, 1.18);
            rgb = mix(rgb, palette.paper.rgb * (pixel.a - warmInk) + warm * warmInk, clamp(warmth, 0., 1.));
            rgb = mix(rgb, warm * pixel.a, clamp((halo * .40 + foot * .26) * .4 * smoothstep(.06, .80, luma), 0., 1.));
            return vec4(rgb, pixel.a);
        }
        // Vector strokes stay cool, including the spheres. Warm light is an
        // explicit illustration role, never a global high-luminance recolor.
        let highlight = select(vec3(228. / 255., 231. / 255., 221. / 255.), vec3(152. / 255., 105. / 255., 218. / 255.), palette.mode.x > 2.5);
        light = mix(light, highlight, smoothstep(.32, .95, energy) * .25);
    }
    return vec4(palette.paper.rgb * (pixel.a - energy) + light * energy, pixel.a);
}
