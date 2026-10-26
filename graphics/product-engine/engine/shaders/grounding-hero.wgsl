// Immutable authored pixels, uniform fitting and restrained light in the Rust
// render clock. No pose deformation; both feet keep their contact with the floor.
struct Params {
    time: vec4<f32>, size: vec4<f32>, viewport: vec4<f32>, spare_a: vec4<f32>,
    spare_b: vec4<f32>, spare_c: vec4<f32>, spare_d: vec4<f32>, unused: vec4<f32>
}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var artwork: texture_2d<f32>;
@group(0) @binding(3) var smooth_sampler: sampler;
struct Vertex { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> }

@vertex fn grounding_vs(@builtin(vertex_index) i: u32) -> Vertex {
    let points = array<vec2<f32>, 3>(vec2(-1., -1.), vec2(3., -1.), vec2(-1., 3.));
    var v: Vertex;
    v.position = vec4(points[i], 0., 1.);
    v.uv = vec2(points[i].x * .5 + .5, .5 - points[i].y * .5);
    return v;
}

@fragment fn grounding_fs(v: Vertex) -> @location(0) vec4<f32> {
    let output = max(params.viewport.xy, vec2(1.));
    let source = max(params.size.xy, vec2(1.));
    let fitted = source * min(output.x / source.x, output.y / source.y);
    let p = (v.uv * output - (output - fitted) * .5) / fitted;
    if (any(p < vec2(0.)) || any(p > vec2(1.))) { return vec4(0.); }
    let original = textureSampleLevel(artwork, smooth_sampler, p, 0.).rgb;
    let chest = (p - vec2(.485, .32)) / vec2(.12, .20);
    let soles = (p - vec2(.56, .83)) / vec2(.18, .10);
    let local_light = max(exp(-dot(chest, chest) * 2.), exp(-dot(soles, soles) * 2.));
    let breath = sin(params.time.x * .85) * .035;
    let rgb = original * (1. + breath * local_light);
    // The scene stays registered when panel dimensions change. A soft authored
    // edge also avoids a vertical rectangle when used in a wider card.
    let horizontal = smoothstep(0., .055, p.x) * (1. - smoothstep(.945, 1., p.x));
    return vec4(rgb * horizontal, 1.);
}
