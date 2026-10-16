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
@group(0) @binding(4) 
var texContour: texture_2d<f32>;
var<private> fragColor: vec4<f32>;
var<private> vUv_1: vec2<f32>;

fn readSource(uv: vec2<f32>) -> vec4<f32> {
    var uv_1: vec2<f32>;

    uv_1 = uv;
    let _e9: vec2<f32> = uv_1;
    let _e12: vec2<f32> = uv_1;
    let _e17: vec4<f32> = textureSampleLevel(texSource, linearSampler, vec2<f32>(_e9.x, (1f - _e12.y)), 0f);
    return _e17;
}

fn readBlur(uv_2: vec2<f32>) -> vec4<f32> {
    var uv_3: vec2<f32>;

    uv_3 = uv_2;
    let _e9: vec2<f32> = uv_3;
    let _e12: vec2<f32> = uv_3;
    let _e17: vec4<f32> = textureSampleLevel(texBlur, linearSampler, vec2<f32>(_e9.x, (1f - _e12.y)), 0f);
    return _e17;
}

fn readContour(uv_4: vec2<f32>) -> vec4<f32> {
    var uv_5: vec2<f32>;

    uv_5 = uv_4;
    let _e9: vec2<f32> = uv_5;
    let _e11: vec4<f32> = textureSampleLevel(texContour, linearSampler, _e9, 0f);
    return _e11;
}

fn LinearTransferOETF(value: vec4<f32>) -> vec4<f32> {
    var value_1: vec4<f32>;

    value_1 = value;
    let _e9: vec4<f32> = value_1;
    return _e9;
}

fn sRGBTransferEOTF(value_2: vec4<f32>) -> vec4<f32> {
    var value_3: vec4<f32>;

    value_3 = value_2;
    let _e9: vec4<f32> = value_3;
    let _e19: vec4<f32> = value_3;
    let _e23: vec4<f32> = value_3;
    let _e33: vec3<f32> = mix(pow(((_e9.xyz * 0.9478673f) + vec3(0.0521327f)), vec3(2.4f)), (_e19.xyz * 0.07739938f), select(vec3(0f), vec3(1f), (_e23.xyz <= vec3(0.04045f))));
    let _e34: vec4<f32> = value_3;
    return vec4<f32>(_e33.x, _e33.y, _e33.z, _e34.w);
}

fn sRGBTransferOETF(value_4: vec4<f32>) -> vec4<f32> {
    var value_5: vec4<f32>;

    value_5 = value_4;
    let _e9: vec4<f32> = value_5;
    let _e19: vec4<f32> = value_5;
    let _e23: vec4<f32> = value_5;
    let _e33: vec3<f32> = mix(((pow(_e9.xyz, vec3(0.41666f)) * 1.055f) - vec3(0.055f)), (_e19.xyz * 12.92f), select(vec3(0f), vec3(1f), (_e23.xyz <= vec3(0.0031308f))));
    let _e34: vec4<f32> = value_5;
    return vec4<f32>(_e33.x, _e33.y, _e33.z, _e34.w);
}

fn linearToOutputTexel(c: vec4<f32>) -> vec4<f32> {
    var c_1: vec4<f32>;
    var local: vec4<f32>;

    c_1 = c;
    let _e11: vec4<f32> = global._data[127];
    if (_e11.x > 0.5f) {
        let _e15: vec4<f32> = c_1;
        let _e16: vec4<f32> = sRGBTransferOETF(_e15);
        local = _e16;
    } else {
        let _e17: vec4<f32> = c_1;
        local = _e17;
    }
    let _e19: vec4<f32> = local;
    return _e19;
}

fn sampleInput(uv_6: vec2<f32>) -> vec3<f32> {
    var uv_7: vec2<f32>;
    var scale: vec2<f32> = vec2(1f);
    var sourceAspect: f32;
    var sourceUv: vec2<f32>;
    var texel: vec4<f32>;
    var local_1: vec3<f32>;

    uv_7 = uv_6;
    let _e12: vec4<f32> = global._data[0];
    if (_e12.x < 0.5f) {
        {
            let _e16: vec2<f32> = uv_7;
            let _e22: vec4<f32> = readSource(clamp(_e16, vec2(0f), vec2(1f)));
            return _e22.xyz;
        }
    }
    let _e29: vec4<f32> = global._data[3];
    sourceAspect = max(_e29.x, 0.01f);
    let _e36: vec4<f32> = global._data[2];
    let _e38: f32 = sourceAspect;
    if (_e36.x > _e38) {
        {
            let _e41: f32 = sourceAspect;
            let _e44: vec4<f32> = global._data[2];
            scale.y = (_e41 / _e44.x);
        }
    } else {
        {
            let _e50: vec4<f32> = global._data[2];
            let _e52: f32 = sourceAspect;
            scale.x = (_e50.x / _e52);
        }
    }
    let _e54: vec2<f32> = uv_7;
    let _e58: vec2<f32> = scale;
    sourceUv = (((_e54 - vec2(0.5f)) * _e58) + vec2(0.5f));
    let _e64: vec2<f32> = sourceUv;
    let _e70: vec4<f32> = readSource(clamp(_e64, vec2(0.001f), vec2(0.999f)));
    texel = _e70;
    let _e74: vec4<f32> = global._data[1];
    if (_e74.x > 0.5f) {
        let _e78: vec4<f32> = texel;
        let _e79: vec4<f32> = sRGBTransferEOTF(_e78);
        local_1 = _e79.xyz;
    } else {
        let _e81: vec4<f32> = texel;
        local_1 = _e81.xyz;
    }
    let _e84: vec3<f32> = local_1;
    return _e84;
}

fn main_1() {
    var color: vec3<f32>;
    var i: i32 = 1i;
    var offset: vec2<f32>;

    let _e8: vec2<f32> = vUv_1;
    let _e9: vec3<f32> = sampleInput(_e8);
    let _e15: vec4<f32> = global._data[6];
    color = (_e9 * _e15.x);
    loop {
        let _e21: i32 = i;
        if !((_e21 <= 36i)) {
            break;
        }
        {
            let _e28: i32 = i;
            let _e31: vec4<f32> = global._data[5];
            if (_e28 > i32(_e31.x)) {
                break;
            }
            let _e37: vec4<f32> = global._data[4];
            let _e39: i32 = i;
            offset = (_e37.xy * f32(_e39));
            let _e43: vec3<f32> = color;
            let _e44: vec2<f32> = vUv_1;
            let _e45: vec2<f32> = offset;
            let _e47: vec3<f32> = sampleInput((_e44 + _e45));
            let _e48: vec2<f32> = vUv_1;
            let _e49: vec2<f32> = offset;
            let _e51: vec3<f32> = sampleInput((_e48 - _e49));
            let _e54: i32 = i;
            let _e58: vec4<f32> = global._data[(6i + i32(_e54))];
            color = (_e43 + ((_e47 + _e51) * _e58.x));
        }
        continuing {
            let _e25: i32 = i;
            i = (_e25 + 1i);
        }
    }
    let _e62: vec3<f32> = color;
    fragColor = vec4<f32>(_e62.x, _e62.y, _e62.z, 1f);
    return;
}

@fragment 
fn main(@location(0) vUv: vec2<f32>) -> FragmentOutput {
    vUv_1 = vUv;
    main_1();
    let _e17: vec4<f32> = fragColor;
    return FragmentOutput(_e17);
}
