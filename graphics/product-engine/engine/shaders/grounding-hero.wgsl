// Rust supplies the breath -> descending light -> foot contact -> floor waves.
// Registered coverage keeps all environment effects behind the opaque figure.
struct Params {
    motion: vec4<f32>, size: vec4<f32>, viewport: vec4<f32>, flow: vec4<f32>,
    waves: vec4<f32>, spare_a: vec4<f32>, spare_b: vec4<f32>, unused: vec4<f32>
}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var artwork: texture_2d<f32>;
@group(0) @binding(2) var glyphs: texture_2d<f32>;
@group(0) @binding(3) var smooth_sampler: sampler;
@group(0) @binding(4) var coverage: texture_2d<f32>;
struct Vertex { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> }

@vertex fn grounding_vs(@builtin(vertex_index) i: u32) -> Vertex {
    let points = array<vec2<f32>, 3>(vec2(-1., -1.), vec2(3., -1.), vec2(-1., 3.));
    var v: Vertex;
    v.position = vec4(points[i], 0., 1.);
    v.uv = vec2(points[i].x * .5 + .5, .5 - points[i].y * .5);
    return v;
}

fn hash(n: f32) -> f32 { return fract(sin(n * 127.1 + 37.7) * 43758.5453); }
fn spot(p: vec2<f32>, center: vec2<f32>, radius: vec2<f32>) -> f32 {
    let q = (p - center) / radius;
    return exp(-dot(q, q) * 2.);
}
fn body_sample(p: vec2<f32>) -> vec2<f32> {
    // Rooted at the hips: knees, shins, soles and chair seat never translate.
    let upper = 1. - smoothstep(.39, .57, p.y);
    let envelope = smoothstep(.325, .38, p.x) * (1. - smoothstep(.59, .655, p.x));
    let amount = params.motion.x * upper * envelope;
    return p + vec2(-(p.x - .485) * .019, .007) * amount;
}
fn matrix_rain(p: vec2<f32>, near: bool) -> vec3<f32> {
    let spacing = select(32., 52., near);
    let cell_height = select(22., 30., near);
    let column = floor(p.x * 1536. / spacing);
    let seed = hash(column + select(101., 5., near));
    if (seed > select(.42, .76, near)) { return vec3(0.); }
    let cycles = select(1., 2., near);
    let travel = params.motion.y * cycles * 32. * cell_height;
    let y = (p.y * 1024. - travel - seed * 32. * cell_height) / cell_height;
    let row = floor(y);
    let local = vec2(fract(p.x * 1536. / spacing) - .5 - (seed - .5) * .25, fract(y) - .5);
    let glyph_uv = local / vec2(select(.48, .32, near), .78) + .5;
    if (any(glyph_uv < vec2(0.)) || any(glyph_uv > vec2(1.))) { return vec3(0.); }
    // The 32-cell stream is periodic: the code phase wraps without a visible cut.
    let stable_row = row - floor(row / 32.) * 32.;
    let index = floor(hash(column * 19. + stable_row * 7. + select(20., 100., near)) * 35.);
    let tile = vec2(index - floor(index / 16.) * 16., floor(index / 16.));
    let sample = textureSampleLevel(glyphs, smooth_sampler, (tile * 48. + 4. + glyph_uv * 40.) / vec2(768., 144.), 0.).rg;
    let tail = pow(.5 + .5 * cos(stable_row * 6.2831853 / 32.), 2.);
    let alpha = (sample.r + sample.g * .25) * (.07 + tail * select(.15, .40, near));
    return mix(vec3(.70, .47, .06), vec3(1., .87, .49), tail) * alpha;
}
fn floor_wave(p: vec2<f32>, phase: vec2<f32>, detail: f32) -> vec3<f32> {
    let q = (p - vec2(.555, .835)) / vec2(1., .245);
    let distance = length(q);
    let radius = .035 + .63 * phase.x;
    let line = exp(-pow((distance - radius) / .0045, 2.));
    let soft = exp(-pow((distance - radius) / .026, 2.));
    let rim = (line * (.17 + .38 * detail) + soft * .07) * phase.y;
    return vec3(1., .78, .28) * rim;
}

@fragment fn grounding_fs(v: Vertex) -> @location(0) vec4<f32> {
    let output = max(params.viewport.xy, vec2(1.));
    let source = max(params.size.xy, vec2(1.));
    let fitted = source * min(output.x / source.x, output.y / source.y);
    let p = (v.uv * output - (output - fitted) * .5) / fitted;
    if (any(p < vec2(0.)) || any(p > vec2(1.))) { return vec4(0.); }
    let uv = body_sample(p);
    var rgb = textureSampleLevel(artwork, smooth_sampler, uv, 0.).rgb;
    if (params.motion.z > .5) {
        let matte = textureSampleLevel(coverage, smooth_sampler, uv, 0.).rg;
        let environment = 1. - matte.g;
        let background = (1. - smoothstep(.46, .62, p.y)) * environment;
        // The cached source has no stationary glyphs: every visible code stream
        // comes from the moving project atlas, including the far depth layer.
        var rain = matrix_rain(p, true);
        if (params.size.z < 2.5) { rain += matrix_rain(p, false); }
        rgb += rain * 1.4 * background * smoothstep(0., .035, p.y);

        let flow_y = mix(.16, .84, params.flow.x);
        let light_band = exp(-pow((uv.y - flow_y) / .065, 2.)) * params.flow.y * matte.r;
        let chest = spot(uv, vec2(.485, .31), vec2(.105, .145));
        rgb *= 1. + light_band * .70 + chest * params.motion.x * .16;
        rgb += vec3(1., .77, .30) * (light_band * .065 + chest * params.motion.x * .025);

        let contacts = spot(p, vec2(.501, .856), vec2(.056, .025))
            + spot(p, vec2(.615, .827), vec2(.062, .026));
        rgb += vec3(1., .83, .44) * contacts * params.motion.w * .20;
        let detail = smoothstep(.025, .32, dot(rgb, vec3(.2126, .7152, .0722)));
        let floor_only = environment * smoothstep(.56, .65, p.y);
        rgb += (floor_wave(p, params.waves.xy, detail)
             + floor_wave(p, params.waves.zw, detail)) * floor_only;
    }
    let horizontal = smoothstep(0., .055, p.x) * (1. - smoothstep(.945, 1., p.x));
    return vec4(clamp(rgb, vec3(0.), vec3(1.)) * horizontal, 1.);
}
