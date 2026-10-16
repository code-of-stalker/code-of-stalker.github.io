struct Params {
    _data: array<vec4<f32>, 128>,
}

struct FragmentOutput {
    @location(0) fragColor: vec4<f32>,
}

@group(0) @binding(0) 
var<uniform> global: Params;
@group(0) @binding(1) 
var texSource: texture_2d<f32>;
@group(0) @binding(2) 
var texBlur: texture_2d<f32>;
@group(0) @binding(3) 
var linearSampler: sampler;
var<private> fragColor: vec4<f32>;
var<private> vUv_1: vec2<f32>;

fn readSource(uv: vec2<f32>) -> vec4<f32> {
    var uv_1: vec2<f32>;

    uv_1 = uv;
    let _e8: vec2<f32> = uv_1;
    let _e11: vec2<f32> = uv_1;
    let _e16: vec4<f32> = textureSampleLevel(texSource, linearSampler, vec2<f32>(_e8.x, (1f - _e11.y)), 0f);
    return _e16;
}

fn readBlur(uv_2: vec2<f32>) -> vec4<f32> {
    var uv_3: vec2<f32>;

    uv_3 = uv_2;
    let _e8: vec2<f32> = uv_3;
    let _e11: vec2<f32> = uv_3;
    let _e16: vec4<f32> = textureSampleLevel(texBlur, linearSampler, vec2<f32>(_e8.x, (1f - _e11.y)), 0f);
    return _e16;
}

fn LinearTransferOETF(value: vec4<f32>) -> vec4<f32> {
    var value_1: vec4<f32>;

    value_1 = value;
    let _e8: vec4<f32> = value_1;
    return _e8;
}

fn sRGBTransferEOTF(value_2: vec4<f32>) -> vec4<f32> {
    var value_3: vec4<f32>;

    value_3 = value_2;
    let _e8: vec4<f32> = value_3;
    let _e18: vec4<f32> = value_3;
    let _e22: vec4<f32> = value_3;
    let _e32: vec3<f32> = mix(pow(((_e8.xyz * 0.9478673f) + vec3(0.0521327f)), vec3(2.4f)), (_e18.xyz * 0.07739938f), select(vec3(0f), vec3(1f), (_e22.xyz <= vec3(0.04045f))));
    let _e33: vec4<f32> = value_3;
    return vec4<f32>(_e32.x, _e32.y, _e32.z, _e33.w);
}

fn sRGBTransferOETF(value_4: vec4<f32>) -> vec4<f32> {
    var value_5: vec4<f32>;

    value_5 = value_4;
    let _e8: vec4<f32> = value_5;
    let _e18: vec4<f32> = value_5;
    let _e22: vec4<f32> = value_5;
    let _e32: vec3<f32> = mix(((pow(_e8.xyz, vec3(0.41666f)) * 1.055f) - vec3(0.055f)), (_e18.xyz * 12.92f), select(vec3(0f), vec3(1f), (_e22.xyz <= vec3(0.0031308f))));
    let _e33: vec4<f32> = value_5;
    return vec4<f32>(_e32.x, _e32.y, _e32.z, _e33.w);
}

fn linearToOutputTexel(color: vec4<f32>) -> vec4<f32> {
    var color_1: vec4<f32>;
    var local: vec4<f32>;

    color_1 = color;
    let _e10: vec4<f32> = global._data[127];
    if (_e10.x > 0.5f) {
        let _e14: vec4<f32> = color_1;
        let _e15: vec4<f32> = sRGBTransferOETF(_e14);
        local = _e15;
    } else {
        let _e16: vec4<f32> = color_1;
        local = _e16;
    }
    let _e18: vec4<f32> = local;
    return _e18;
}

fn sampleInput(uv_4: vec2<f32>) -> vec3<f32> {
    var uv_5: vec2<f32>;
    var scale: vec2<f32> = vec2(1f);
    var sourceAspect: f32;
    var sourceUv: vec2<f32>;
    var texel: vec4<f32>;
    var local_1: vec3<f32>;

    uv_5 = uv_4;
    let _e11: vec4<f32> = global._data[0];
    if (_e11.x < 0.5f) {
        {
            let _e15: vec2<f32> = uv_5;
            let _e21: vec4<f32> = readSource(clamp(_e15, vec2(0f), vec2(1f)));
            return _e21.xyz;
        }
    }
    let _e28: vec4<f32> = global._data[3];
    sourceAspect = max(_e28.x, 0.01f);
    let _e35: vec4<f32> = global._data[2];
    let _e37: f32 = sourceAspect;
    if (_e35.x > _e37) {
        {
            let _e40: f32 = sourceAspect;
            let _e43: vec4<f32> = global._data[2];
            scale.y = (_e40 / _e43.x);
        }
    } else {
        {
            let _e49: vec4<f32> = global._data[2];
            let _e51: f32 = sourceAspect;
            scale.x = (_e49.x / _e51);
        }
    }
    let _e53: vec2<f32> = uv_5;
    let _e57: vec2<f32> = scale;
    sourceUv = (((_e53 - vec2(0.5f)) * _e57) + vec2(0.5f));
    let _e63: vec2<f32> = sourceUv;
    let _e69: vec4<f32> = readSource(clamp(_e63, vec2(0.001f), vec2(0.999f)));
    texel = _e69;
    let _e73: vec4<f32> = global._data[1];
    if (_e73.x > 0.5f) {
        let _e77: vec4<f32> = texel;
        let _e78: vec4<f32> = sRGBTransferEOTF(_e77);
        local_1 = _e78.xyz;
    } else {
        let _e80: vec4<f32> = texel;
        local_1 = _e80.xyz;
    }
    let _e83: vec3<f32> = local_1;
    return _e83;
}

fn main_1() {
    var color_2: vec3<f32>;
    var i: i32 = 1i;
    var offset: vec2<f32>;

    let _e7: vec2<f32> = vUv_1;
    let _e8: vec3<f32> = sampleInput(_e7);
    let _e14: vec4<f32> = global._data[6];
    color_2 = (_e8 * _e14.x);
    loop {
        let _e20: i32 = i;
        if !((_e20 <= 36i)) {
            break;
        }
        {
            let _e27: i32 = i;
            let _e30: vec4<f32> = global._data[5];
            if (_e27 > i32(_e30.x)) {
                break;
            }
            let _e36: vec4<f32> = global._data[4];
            let _e38: i32 = i;
            offset = (_e36.xy * f32(_e38));
            let _e42: vec3<f32> = color_2;
            let _e43: vec2<f32> = vUv_1;
            let _e44: vec2<f32> = offset;
            let _e46: vec3<f32> = sampleInput((_e43 + _e44));
            let _e47: vec2<f32> = vUv_1;
            let _e48: vec2<f32> = offset;
            let _e50: vec3<f32> = sampleInput((_e47 - _e48));
            let _e53: i32 = i;
            let _e57: vec4<f32> = global._data[(6i + i32(_e53))];
            color_2 = (_e42 + ((_e46 + _e50) * _e57.x));
        }
        continuing {
            let _e24: i32 = i;
            i = (_e24 + 1i);
        }
    }
    let _e61: vec3<f32> = color_2;
    fragColor = vec4<f32>(_e61.x, _e61.y, _e61.z, 1f);
    return;
}

@fragment 
fn main(@location(0) vUv: vec2<f32>) -> FragmentOutput {
    vUv_1 = vUv;
    main_1();
    let _e15: vec4<f32> = fragColor;
    return FragmentOutput(_e15);
}
