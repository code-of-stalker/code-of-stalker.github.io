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

fn sdRoundedBox(p: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
    var p_1: vec2<f32>;
    var b_1: vec2<f32>;
    var r_1: f32;
    var q: vec2<f32>;

    p_1 = p;
    b_1 = b;
    r_1 = r;
    let _e13: vec2<f32> = p_1;
    let _e15: vec2<f32> = b_1;
    let _e17: f32 = r_1;
    q = ((abs(_e13) - _e15) + vec2(_e17));
    let _e21: vec2<f32> = q;
    let _e23: vec2<f32> = q;
    let _e28: vec2<f32> = q;
    let _e34: f32 = r_1;
    return ((min(max(_e21.x, _e23.y), 0f) + length(max(_e28, vec2(0f)))) - _e34);
}

fn sdEllipse(p_2: vec2<f32>, ab: vec2<f32>) -> f32 {
    var p_3: vec2<f32>;
    var ab_1: vec2<f32>;
    var k0_: f32;
    var k1_: f32;

    p_3 = p_2;
    ab_1 = ab;
    let _e11: vec2<f32> = p_3;
    p_3 = abs(_e11);
    let _e13: vec2<f32> = ab_1;
    ab_1 = max(_e13, vec2(0.001f));
    let _e17: vec2<f32> = p_3;
    let _e18: vec2<f32> = ab_1;
    k0_ = length((_e17 / _e18));
    let _e22: vec2<f32> = p_3;
    let _e23: vec2<f32> = ab_1;
    let _e24: vec2<f32> = ab_1;
    k1_ = length((_e22 / (_e23 * _e24)));
    let _e29: f32 = k1_;
    if (_e29 < 0.00001f) {
        let _e32: vec2<f32> = ab_1;
        let _e34: vec2<f32> = ab_1;
        return -(min(_e32.x, _e34.y));
    }
    let _e38: f32 = k0_;
    let _e39: f32 = k0_;
    let _e43: f32 = k1_;
    return ((_e38 * (_e39 - 1f)) / max(_e43, 0.001f));
}

fn sdDiamond(p_4: vec2<f32>, r_2: f32) -> f32 {
    var p_5: vec2<f32>;
    var r_3: f32;

    p_5 = p_4;
    r_3 = r_2;
    let _e11: vec2<f32> = p_5;
    p_5 = abs(_e11);
    let _e13: vec2<f32> = p_5;
    let _e15: vec2<f32> = p_5;
    let _e18: f32 = r_3;
    return (((_e13.x + _e15.y) - _e18) * 0.70710677f);
}

fn sdEquilateralTriangle(p_6: vec2<f32>, r_4: f32) -> f32 {
    var p_7: vec2<f32>;
    var r_5: f32;
    var k: f32 = 1.7320508f;

    p_7 = p_6;
    r_5 = r_4;
    let _e14: vec2<f32> = p_7;
    let _e17: f32 = r_5;
    p_7.x = (abs(_e14.x) - _e17);
    let _e20: vec2<f32> = p_7;
    let _e22: f32 = r_5;
    let _e23: f32 = k;
    p_7.y = (_e20.y + (_e22 / _e23));
    let _e26: vec2<f32> = p_7;
    let _e28: f32 = k;
    let _e29: vec2<f32> = p_7;
    if ((_e26.x + (_e28 * _e29.y)) > 0f) {
        {
            let _e35: vec2<f32> = p_7;
            let _e37: f32 = k;
            let _e38: vec2<f32> = p_7;
            let _e42: f32 = k;
            let _e44: vec2<f32> = p_7;
            let _e47: vec2<f32> = p_7;
            p_7 = (vec2<f32>((_e35.x - (_e37 * _e38.y)), ((-(_e42) * _e44.x) - _e47.y)) / vec2(2f));
        }
    }
    let _e55: vec2<f32> = p_7;
    let _e57: vec2<f32> = p_7;
    let _e61: f32 = r_5;
    p_7.x = (_e55.x - clamp(_e57.x, (-2f * _e61), 0f));
    let _e66: vec2<f32> = p_7;
    let _e69: vec2<f32> = p_7;
    return (-(length(_e66)) * sign(_e69.y));
}

fn sdHexagon(p_8: vec2<f32>, r_6: f32) -> f32 {
    var p_9: vec2<f32>;
    var r_7: f32;
    var k_1: vec3<f32> = vec3<f32>(-0.8660254f, 0.5f, 0.5773503f);

    p_9 = p_8;
    r_7 = r_6;
    let _e17: vec2<f32> = p_9;
    p_9 = abs(_e17);
    let _e19: vec2<f32> = p_9;
    let _e21: vec3<f32> = k_1;
    let _e23: vec2<f32> = p_9;
    let _e28: vec3<f32> = k_1;
    p_9 = (_e19 - ((2f * min(dot(_e21.xy, _e23), 0f)) * _e28.xy));
    let _e32: vec2<f32> = p_9;
    let _e33: vec2<f32> = p_9;
    let _e35: vec3<f32> = k_1;
    let _e38: f32 = r_7;
    let _e40: vec3<f32> = k_1;
    let _e42: f32 = r_7;
    let _e45: f32 = r_7;
    p_9 = (_e32 - vec2<f32>(clamp(_e33.x, (-(_e35.z) * _e38), (_e40.z * _e42)), _e45));
    let _e48: vec2<f32> = p_9;
    let _e50: vec2<f32> = p_9;
    return (length(_e48) * sign(_e50.y));
}

fn stableAngularWarp(p_10: vec2<f32>, seed: f32) -> f32 {
    var p_11: vec2<f32>;
    var seed_1: f32;
    var angle: f32;

    p_11 = p_10;
    seed_1 = seed;
    let _e11: vec2<f32> = p_11;
    let _e13: vec2<f32> = p_11;
    angle = atan2(_e11.y, _e13.x);
    let _e17: f32 = angle;
    let _e20: f32 = seed_1;
    let _e25: f32 = angle;
    let _e28: f32 = seed_1;
    let _e36: f32 = angle;
    let _e39: f32 = seed_1;
    return (((sin(((_e17 * 3f) + _e20)) * 0.52f) + (sin(((_e25 * 5f) - (_e28 * 1.7f))) * 0.28f)) + (sin(((_e36 * 9f) + (_e39 * 0.6f))) * 0.16f));
}

fn directionalFlowPotential(p_12: vec2<f32>, direction: vec2<f32>, time: f32, scale: f32) -> f32 {
    var p_13: vec2<f32>;
    var direction_1: vec2<f32>;
    var time_1: f32;
    var scale_1: f32;
    var dir: vec2<f32>;
    var primary: f32;
    var secondary: f32;

    p_13 = p_12;
    direction_1 = direction;
    time_1 = time;
    scale_1 = scale;
    let _e15: vec2<f32> = direction_1;
    dir = normalize(_e15);
    let _e18: vec2<f32> = p_13;
    let _e19: vec2<f32> = dir;
    let _e21: f32 = scale_1;
    let _e25: f32 = time_1;
    primary = sin((((dot(_e18, _e19) * _e21) * 6.2831855f) + _e25));
    let _e29: vec2<f32> = p_13;
    let _e30: vec2<f32> = dir;
    let _e33: vec2<f32> = dir;
    let _e37: f32 = scale_1;
    let _e41: f32 = time_1;
    secondary = sin((((dot(_e29, vec2<f32>(-(_e30.y), _e33.x)) * _e37) * 4.712389f) - (_e41 * 0.73f)));
    let _e47: f32 = primary;
    let _e48: f32 = secondary;
    return (_e47 + (_e48 * 0.28f));
}

fn flowPotential(p_14: vec2<f32>, time_2: f32) -> f32 {
    var p_15: vec2<f32>;
    var time_3: f32;
    var mode: f32;
    var scale_2: f32;
    var speed: f32;
    var turbulence: f32;
    var layerMix: f32;
    var phase: f32;
    var base: f32 = 0f;
    var local_1: f32;
    var turn: f32;
    var angle_1: f32;
    var radius: f32;
    var local_2: f32;
    var sourceSign: f32;
    var a: f32;
    var b_2: f32;
    var c: f32;
    var layer: f32;
    var organic: f32;

    p_15 = p_14;
    time_3 = time_2;
    let _e13: vec4<f32> = global._data[55];
    mode = floor((_e13.x + 0.5f));
    let _e21: vec4<f32> = global._data[58];
    scale_2 = clamp(_e21.x, 0.25f, 8f);
    let _e29: vec4<f32> = global._data[56];
    speed = clamp(_e29.x, 0f, 4f);
    let _e37: vec4<f32> = global._data[59];
    turbulence = clamp(_e37.x, 0f, 1f);
    let _e45: vec4<f32> = global._data[61];
    layerMix = clamp(_e45.x, 0f, 1f);
    let _e51: f32 = time_3;
    let _e52: f32 = speed;
    phase = (_e51 * _e52);
    let _e55: f32 = mode;
    if (_e55 < 0.5f) {
        {
            return 0f;
        }
    }
    let _e61: f32 = mode;
    if (_e61 < 1.5f) {
        {
            let _e64: vec2<f32> = p_15;
            let _e69: f32 = phase;
            let _e70: f32 = scale_2;
            let _e71: f32 = directionalFlowPotential(_e64, vec2<f32>(-1f, 0f), _e69, _e70);
            base = _e71;
        }
    } else {
        let _e72: f32 = mode;
        if (_e72 < 2.5f) {
            {
                let _e75: vec2<f32> = p_15;
                let _e79: f32 = phase;
                let _e80: f32 = scale_2;
                let _e81: f32 = directionalFlowPotential(_e75, vec2<f32>(1f, 0f), _e79, _e80);
                base = _e81;
            }
        } else {
            let _e82: f32 = mode;
            if (_e82 < 3.5f) {
                {
                    let _e85: vec2<f32> = p_15;
                    let _e89: f32 = phase;
                    let _e90: f32 = scale_2;
                    let _e91: f32 = directionalFlowPotential(_e85, vec2<f32>(0f, 1f), _e89, _e90);
                    base = _e91;
                }
            } else {
                let _e92: f32 = mode;
                if (_e92 < 4.5f) {
                    {
                        let _e95: vec2<f32> = p_15;
                        let _e100: f32 = phase;
                        let _e101: f32 = scale_2;
                        let _e102: f32 = directionalFlowPotential(_e95, vec2<f32>(0f, -1f), _e100, _e101);
                        base = _e102;
                    }
                } else {
                    let _e103: f32 = mode;
                    if (_e103 < 6.5f) {
                        {
                            let _e106: f32 = mode;
                            if (_e106 < 5.5f) {
                                local_1 = 1f;
                            } else {
                                local_1 = -1f;
                            }
                            let _e113: f32 = local_1;
                            turn = _e113;
                            let _e115: vec2<f32> = p_15;
                            let _e117: vec2<f32> = p_15;
                            angle_1 = atan2(_e115.y, _e117.x);
                            let _e121: vec2<f32> = p_15;
                            radius = length(_e121);
                            let _e124: f32 = angle_1;
                            let _e127: f32 = radius;
                            let _e128: f32 = scale_2;
                            let _e133: f32 = phase;
                            let _e134: f32 = turn;
                            base = sin((((_e124 * 3f) + ((_e127 * _e128) * 5f)) + (_e133 * _e134)));
                        }
                    } else {
                        let _e138: f32 = mode;
                        if (_e138 < 8.5f) {
                            {
                                let _e141: f32 = mode;
                                if (_e141 < 7.5f) {
                                    local_2 = -1f;
                                } else {
                                    local_2 = 1f;
                                }
                                let _e148: f32 = local_2;
                                sourceSign = _e148;
                                let _e150: vec2<f32> = p_15;
                                let _e152: f32 = scale_2;
                                let _e156: f32 = phase;
                                let _e157: f32 = sourceSign;
                                base = sin((((length(_e150) * _e152) * 7f) + (_e156 * _e157)));
                            }
                        } else {
                            let _e161: f32 = mode;
                            if (_e161 < 9.5f) {
                                {
                                    let _e164: vec2<f32> = p_15;
                                    let _e166: f32 = scale_2;
                                    let _e170: f32 = phase;
                                    a = sin((((_e164.x * _e166) * 4.1f) + _e170));
                                    let _e174: vec2<f32> = p_15;
                                    let _e176: f32 = scale_2;
                                    let _e180: f32 = phase;
                                    b_2 = sin((((_e174.y * _e176) * 5.3f) - (_e180 * 0.82f)));
                                    let _e186: vec2<f32> = p_15;
                                    let _e188: vec2<f32> = p_15;
                                    let _e191: f32 = scale_2;
                                    let _e195: f32 = phase;
                                    c = sin(((((_e186.x - _e188.y) * _e191) * 3.7f) + (_e195 * 0.41f)));
                                    let _e201: f32 = a;
                                    let _e204: f32 = b_2;
                                    let _e208: f32 = c;
                                    base = (((_e201 * 0.46f) + (_e204 * 0.36f)) + (_e208 * 0.28f));
                                }
                            } else {
                                let _e212: f32 = mode;
                                if (_e212 < 10.5f) {
                                    {
                                        let _e215: vec2<f32> = p_15;
                                        let _e217: vec2<f32> = p_15;
                                        let _e222: f32 = scale_2;
                                        let _e226: f32 = phase;
                                        let _e229: vec2<f32> = p_15;
                                        let _e231: f32 = scale_2;
                                        let _e235: f32 = phase;
                                        base = (sin(((((_e215.x + (_e217.y * 0.36f)) * _e222) * 6f) + _e226)) + (sin((((_e229.y * _e231) * 3.2f) - (_e235 * 0.5f))) * 0.35f));
                                    }
                                } else {
                                    {
                                        let _e243: vec2<f32> = p_15;
                                        let _e245: f32 = scale_2;
                                        let _e250: f32 = phase;
                                        let _e253: vec2<f32> = p_15;
                                        let _e255: f32 = scale_2;
                                        let _e259: f32 = phase;
                                        base = ((sin(((_e243.x * _e245) * 5.2f)) * sin(_e250)) + (sin((((_e253.y * _e255) * 3.6f) + (_e259 * 0.25f))) * 0.25f));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    let _e267: vec2<f32> = p_15;
    let _e273: f32 = scale_2;
    let _e277: f32 = phase;
    let _e282: vec2<f32> = p_15;
    let _e288: f32 = scale_2;
    let _e292: f32 = phase;
    layer = (sin((((dot(_e267, vec2<f32>(0.73f, -0.61f)) * _e273) * 8.4f) - (_e277 * 1.37f))) + (sin((((dot(_e282, vec2<f32>(-0.31f, 0.92f)) * _e288) * 6.2f) + (_e292 * 0.67f))) * 0.42f));
    let _e301: vec2<f32> = p_15;
    let _e302: f32 = phase;
    let _e306: f32 = phase;
    let _e315: f32 = stableAngularWarp((_e301 + (vec2<f32>(sin((_e302 * 0.17f)), cos((_e306 * 0.13f))) * 0.08f)), 3.7f);
    organic = _e315;
    let _e317: f32 = base;
    let _e318: f32 = layer;
    let _e319: f32 = layerMix;
    let _e323: f32 = organic;
    let _e324: f32 = turbulence;
    return (mix(_e317, _e318, (_e319 * 0.72f)) + ((_e323 * _e324) * 0.36f));
}

fn flowGradient(p_16: vec2<f32>, time_4: f32) -> vec2<f32> {
    var p_17: vec2<f32>;
    var time_5: f32;
    var mode_1: f32;
    var eps: vec2<f32> = vec2<f32>(0.0022f, 0f);
    var dX: f32;
    var dY: f32;
    var grad: vec2<f32>;
    var local_3: f32;
    var turn_1: f32;

    p_17 = p_16;
    time_5 = time_4;
    let _e13: vec4<f32> = global._data[55];
    mode_1 = floor((_e13.x + 0.5f));
    let _e21: vec4<f32> = global._data[54];
    let _e25: f32 = mode_1;
    let _e31: vec4<f32> = global._data[57];
    if (((_e21.x < 0.5f) || (_e25 < 0.5f)) || (_e31.x <= 0f)) {
        {
            return vec2(0f);
        }
    }
    let _e42: vec2<f32> = p_17;
    let _e43: vec2<f32> = eps;
    let _e46: f32 = time_5;
    let _e47: f32 = flowPotential((_e42 + _e43.xy), _e46);
    let _e48: vec2<f32> = p_17;
    let _e49: vec2<f32> = eps;
    let _e52: f32 = time_5;
    let _e53: f32 = flowPotential((_e48 - _e49.xy), _e52);
    dX = (_e47 - _e53);
    let _e56: vec2<f32> = p_17;
    let _e57: vec2<f32> = eps;
    let _e60: f32 = time_5;
    let _e61: f32 = flowPotential((_e56 + _e57.yx), _e60);
    let _e62: vec2<f32> = p_17;
    let _e63: vec2<f32> = eps;
    let _e66: f32 = time_5;
    let _e67: f32 = flowPotential((_e62 - _e63.yx), _e66);
    dY = (_e61 - _e67);
    let _e70: f32 = dX;
    let _e71: f32 = dY;
    let _e73: vec2<f32> = eps;
    grad = (vec2<f32>(_e70, _e71) / vec2((_e73.x * 2f)));
    let _e80: f32 = mode_1;
    let _e83: f32 = mode_1;
    if ((_e80 > 4.5f) && (_e83 < 6.5f)) {
        {
            let _e87: f32 = mode_1;
            if (_e87 < 5.5f) {
                local_3 = 1f;
            } else {
                local_3 = -1f;
            }
            let _e94: f32 = local_3;
            turn_1 = _e94;
            let _e96: vec2<f32> = grad;
            let _e99: vec2<f32> = grad;
            let _e102: f32 = turn_1;
            grad = (vec2<f32>(-(_e96.y), _e99.x) * _e102);
        }
    } else {
        let _e104: f32 = mode_1;
        let _e107: f32 = mode_1;
        if ((_e104 > 8.5f) && (_e107 < 9.5f)) {
            {
                let _e111: vec2<f32> = grad;
                let _e114: vec2<f32> = grad;
                grad = vec2<f32>(-(_e111.y), _e114.x);
            }
        }
    }
    let _e117: vec2<f32> = grad;
    return (_e117 * 0.055f);
}

fn applyFlowToNormal(baseNormal: vec2<f32>, p_18: vec2<f32>, opticalMask: f32) -> vec2<f32> {
    var baseNormal_1: vec2<f32>;
    var p_19: vec2<f32>;
    var opticalMask_1: f32;
    var strength: f32;
    var boundaryDamping: f32;
    var mask: f32;
    var dampedMask: f32;
    var flowNormal: vec2<f32>;
    var local_4: vec2<f32>;

    baseNormal_1 = baseNormal;
    p_19 = p_18;
    opticalMask_1 = opticalMask;
    let _e15: vec4<f32> = global._data[57];
    strength = clamp(_e15.x, 0f, 1.5f);
    let _e23: vec4<f32> = global._data[60];
    boundaryDamping = clamp(_e23.x, 0f, 1f);
    let _e29: f32 = opticalMask_1;
    mask = clamp(_e29, 0f, 1f);
    let _e34: f32 = mask;
    let _e38: f32 = mask;
    let _e40: f32 = boundaryDamping;
    dampedMask = (_e34 * mix(1f, smoothstep(0f, 1f, _e38), _e40));
    let _e44: vec2<f32> = baseNormal_1;
    let _e45: vec2<f32> = p_19;
    let _e48: vec4<f32> = global._data[29];
    let _e50: vec2<f32> = flowGradient(_e45, _e48.x);
    let _e51: f32 = strength;
    let _e53: f32 = dampedMask;
    flowNormal = (_e44 + ((_e50 * _e51) * _e53));
    let _e57: vec2<f32> = flowNormal;
    if (length(_e57) > 0.00001f) {
        let _e61: vec2<f32> = flowNormal;
        local_4 = normalize(_e61);
    } else {
        let _e63: vec2<f32> = baseNormal_1;
        local_4 = _e63;
    }
    let _e65: vec2<f32> = local_4;
    return _e65;
}

fn shapeDistance(p_20: vec2<f32>, innerSize: vec2<f32>, radius_1: f32) -> f32 {
    var p_21: vec2<f32>;
    var innerSize_1: vec2<f32>;
    var radius_2: f32;
    var shapeType: f32;
    var warp: f32;
    var baseRadius: f32;
    var warpScale: f32;
    var shapeD: f32;
    var cuts: vec4<f32>;
    var limits: vec4<f32>;
    var capsule: f32;
    var wave: f32;
    var chipped: f32;
    var chip: f32;
    var angle_2: f32;
    var petal: f32;

    p_21 = p_20;
    innerSize_1 = innerSize;
    radius_2 = radius_1;
    let _e15: vec4<f32> = global._data[52];
    shapeType = floor((_e15.x + 0.5f));
    let _e23: vec4<f32> = global._data[53];
    warp = clamp(_e23.x, 0f, 1f);
    let _e30: vec2<f32> = innerSize_1;
    let _e32: vec2<f32> = innerSize_1;
    baseRadius = max(0.001f, min(_e30.x, _e32.y));
    let _e37: f32 = baseRadius;
    let _e40: f32 = warp;
    warpScale = ((_e37 * 0.105f) * _e40);
    let _e43: f32 = shapeType;
    if (_e43 > 11.5f) {
        {
            let _e46: vec2<f32> = p_21;
            let _e47: vec2<f32> = innerSize_1;
            let _e49: f32 = sdRoundedBox(_e46, _e47, 0f);
            shapeD = _e49;
            let _e51: f32 = baseRadius;
            let _e56: vec4<f32> = global._data[12];
            cuts = ((_e51 * 2f) * clamp(_e56.xyzw, vec4(0f), vec4(0.45f)));
            let _e65: vec2<f32> = innerSize_1;
            let _e67: vec2<f32> = innerSize_1;
            let _e71: vec4<f32> = cuts;
            limits = (vec4((_e65.x + _e67.y)) - _e71);
            let _e76: vec4<f32> = global._data[11];
            if (_e76.x > 0.5f) {
                let _e81: f32 = shapeD;
                let _e82: vec2<f32> = p_21;
                let _e85: vec2<f32> = p_21;
                let _e88: vec4<f32> = limits;
                shapeD = max(_e81, (((-(_e82.x) + _e85.y) - _e88.x) * 0.70710677f));
            }
            let _e96: vec4<f32> = global._data[11];
            if (_e96.y > 0.5f) {
                let _e101: f32 = shapeD;
                let _e102: vec2<f32> = p_21;
                let _e104: vec2<f32> = p_21;
                let _e107: vec4<f32> = limits;
                shapeD = max(_e101, (((_e102.x + _e104.y) - _e107.y) * 0.70710677f));
            }
            let _e115: vec4<f32> = global._data[11];
            if (_e115.z > 0.5f) {
                let _e120: f32 = shapeD;
                let _e121: vec2<f32> = p_21;
                let _e123: vec2<f32> = p_21;
                let _e126: vec4<f32> = limits;
                shapeD = max(_e120, (((_e121.x - _e123.y) - _e126.z) * 0.70710677f));
            }
            let _e134: vec4<f32> = global._data[11];
            if (_e134.w > 0.5f) {
                let _e139: f32 = shapeD;
                let _e140: vec2<f32> = p_21;
                let _e143: vec2<f32> = p_21;
                let _e146: vec4<f32> = limits;
                shapeD = max(_e139, (((-(_e140.x) - _e143.y) - _e146.w) * 0.70710677f));
            }
            let _e152: f32 = shapeD;
            return _e152;
        }
    }
    let _e153: f32 = shapeType;
    if (_e153 > 10.5f) {
        {
            let _e156: vec2<f32> = p_21;
            let _e157: f32 = baseRadius;
            let _e160: f32 = sdRoundedBox(_e156, vec2(_e157), 0f);
            return _e160;
        }
    }
    let _e161: f32 = shapeType;
    if (_e161 < 0.5f) {
        {
            let _e164: vec2<f32> = p_21;
            let _e165: vec2<f32> = innerSize_1;
            let _e166: f32 = radius_2;
            let _e167: f32 = sdRoundedBox(_e164, _e165, _e166);
            return _e167;
        }
    }
    let _e168: f32 = shapeType;
    if (_e168 < 1.5f) {
        {
            let _e171: vec2<f32> = p_21;
            let _e173: f32 = baseRadius;
            return (length(_e171) - _e173);
        }
    }
    let _e175: f32 = shapeType;
    if (_e175 < 2.5f) {
        {
            let _e178: vec2<f32> = p_21;
            let _e179: vec2<f32> = innerSize_1;
            let _e180: f32 = sdEllipse(_e178, _e179);
            return _e180;
        }
    }
    let _e181: f32 = shapeType;
    if (_e181 < 3.5f) {
        {
            let _e184: vec2<f32> = p_21;
            let _e185: f32 = baseRadius;
            let _e188: f32 = sdDiamond(_e184, (_e185 * 1.28f));
            return _e188;
        }
    }
    let _e189: f32 = shapeType;
    if (_e189 < 4.5f) {
        {
            let _e192: vec2<f32> = p_21;
            let _e194: f32 = baseRadius;
            let _e199: f32 = baseRadius;
            let _e202: f32 = sdEquilateralTriangle((_e192 + vec2<f32>(0f, (_e194 * 0.12f))), (_e199 * 1.2f));
            return _e202;
        }
    }
    let _e203: f32 = shapeType;
    if (_e203 < 5.5f) {
        {
            let _e206: vec2<f32> = p_21;
            let _e207: f32 = baseRadius;
            let _e210: f32 = sdHexagon(_e206, (_e207 * 1.02f));
            return _e210;
        }
    }
    let _e211: f32 = shapeType;
    if (_e211 < 6.5f) {
        {
            let _e214: vec2<f32> = p_21;
            let _e215: vec2<f32> = innerSize_1;
            let _e220: f32 = sdEllipse(_e214, (_e215 * vec2<f32>(0.92f, 0.96f)));
            let _e221: vec2<f32> = p_21;
            let _e223: f32 = stableAngularWarp(_e221, 0.4f);
            let _e224: f32 = warpScale;
            return (_e220 + (_e223 * _e224));
        }
    }
    let _e227: f32 = shapeType;
    if (_e227 < 7.5f) {
        {
            let _e230: vec2<f32> = p_21;
            let _e231: vec2<f32> = innerSize_1;
            let _e235: vec2<f32> = innerSize_1;
            let _e240: vec2<f32> = innerSize_1;
            let _e244: f32 = sdRoundedBox(_e230, vec2<f32>((_e231.x * 0.88f), (_e235.y * 0.56f)), (_e240.y * 0.46f));
            capsule = _e244;
            let _e246: vec2<f32> = p_21;
            let _e250: vec2<f32> = p_21;
            let _e259: f32 = warpScale;
            wave = ((sin(((_e246.x * 12f) + (sin((_e250.y * 3f)) * 0.8f))) * _e259) * 1.05f);
            let _e264: f32 = capsule;
            let _e265: f32 = wave;
            return (_e264 + _e265);
        }
    }
    let _e267: f32 = shapeType;
    if (_e267 < 8.5f) {
        {
            let _e270: vec2<f32> = p_21;
            let _e271: vec2<f32> = innerSize_1;
            let _e277: f32 = radius_2;
            let _e281: f32 = sdRoundedBox(_e270, (_e271 * vec2<f32>(0.96f, 0.9f)), max(0f, (_e277 * 0.45f)));
            chipped = _e281;
            let _e283: vec2<f32> = p_21;
            let _e285: f32 = stableAngularWarp(_e283, 2.15f);
            let _e286: f32 = warpScale;
            chip = ((_e285 * _e286) * 1.25f);
            let _e291: f32 = chipped;
            let _e292: f32 = chip;
            let _e293: f32 = warpScale;
            let _e300: f32 = warpScale;
            return (_e291 + ((floor((_e292 / max((_e293 * 0.32f), 0.001f))) * _e300) * 0.32f));
        }
    }
    let _e305: f32 = shapeType;
    if (_e305 < 9.5f) {
        {
            let _e308: vec2<f32> = p_21;
            let _e310: vec2<f32> = p_21;
            angle_2 = atan2(_e308.y, _e310.x);
            let _e314: f32 = angle_2;
            let _e318: f32 = warpScale;
            petal = ((cos((_e314 * 2f)) * _e318) * 1.45f);
            let _e323: vec2<f32> = p_21;
            let _e324: vec2<f32> = innerSize_1;
            let _e329: f32 = sdEllipse(_e323, (_e324 * vec2<f32>(0.78f, 1.02f)));
            let _e330: f32 = petal;
            return (_e329 - _e330);
        }
    }
    let _e332: vec2<f32> = p_21;
    let _e333: vec2<f32> = innerSize_1;
    let _e338: f32 = sdEllipse(_e332, (_e333 * vec2<f32>(0.9f, 0.98f)));
    let _e339: vec2<f32> = p_21;
    let _e341: f32 = stableAngularWarp(_e339, 4.2f);
    let _e342: f32 = warpScale;
    return (_e338 + ((_e341 * _e342) * 1.35f));
}

fn coverUv(uv_4: vec2<f32>) -> vec2<f32> {
    var uv_5: vec2<f32>;
    var canvasAspect: f32;
    var sourceAspect: f32;
    var scale_3: vec2<f32> = vec2(1f);

    uv_5 = uv_4;
    let _e11: vec4<f32> = global._data[25];
    let _e16: vec4<f32> = global._data[25];
    canvasAspect = (_e11.x / max(_e16.y, 1f));
    let _e25: vec4<f32> = global._data[28];
    sourceAspect = max(_e25.x, 0.01f);
    let _e33: f32 = canvasAspect;
    let _e34: f32 = sourceAspect;
    if (_e33 > _e34) {
        {
            let _e37: f32 = sourceAspect;
            let _e38: f32 = canvasAspect;
            scale_3.y = (_e37 / _e38);
        }
    } else {
        {
            let _e41: f32 = canvasAspect;
            let _e42: f32 = sourceAspect;
            scale_3.x = (_e41 / _e42);
        }
    }
    let _e44: vec2<f32> = uv_5;
    let _e48: vec2<f32> = scale_3;
    return (((_e44 - vec2(0.5f)) * _e48) + vec2(0.5f));
}

fn sampleSource(uv_6: vec2<f32>) -> vec3<f32> {
    var uv_7: vec2<f32>;
    var texel: vec4<f32>;

    uv_7 = uv_6;
    let _e9: vec2<f32> = uv_7;
    let _e10: vec2<f32> = coverUv(_e9);
    let _e16: vec4<f32> = readSource(clamp(_e10, vec2(0.001f), vec2(0.999f)));
    texel = _e16;
    let _e20: vec4<f32> = global._data[24];
    if (_e20.x > 0.5f) {
        {
            let _e24: vec4<f32> = texel;
            let _e25: vec4<f32> = sRGBTransferEOTF(_e24);
            return _e25.xyz;
        }
    }
    let _e27: vec4<f32> = texel;
    return _e27.xyz;
}

fn sampleGlassSource(uv_8: vec2<f32>, blurAmount: f32) -> vec3<f32> {
    var uv_9: vec2<f32>;
    var blurAmount_1: f32;
    var blurred: vec3<f32>;

    uv_9 = uv_8;
    blurAmount_1 = blurAmount;
    let _e13: vec4<f32> = global._data[0];
    let _e17: f32 = blurAmount_1;
    if ((_e13.x > 0.5f) && (_e17 > 0.001f)) {
        {
            let _e21: vec2<f32> = uv_9;
            let _e27: vec4<f32> = readBlur(clamp(_e21, vec2(0f), vec2(1f)));
            blurred = _e27.xyz;
            let _e30: f32 = blurAmount_1;
            if (_e30 >= 0.999f) {
                let _e33: vec3<f32> = blurred;
                return _e33;
            }
            let _e34: vec2<f32> = uv_9;
            let _e35: vec3<f32> = sampleSource(_e34);
            let _e36: vec3<f32> = blurred;
            let _e37: f32 = blurAmount_1;
            return mix(_e35, _e36, vec3(_e37));
        }
    }
    let _e40: vec2<f32> = uv_9;
    let _e41: vec3<f32> = sampleSource(_e40);
    return _e41;
}

fn sampleDispersedSource(uv_10: vec2<f32>, refractOffset: vec2<f32>, chroma: f32, blurAmount_2: f32) -> vec3<f32> {
    var uv_11: vec2<f32>;
    var refractOffset_1: vec2<f32>;
    var chroma_1: f32;
    var blurAmount_3: f32;
    var centerUv: vec2<f32>;
    var bendPixels: f32;
    var blurSupport: f32;
    var spreadPixels: f32;
    var spreadUv: vec2<f32>;
    var color_2: vec3<f32> = vec3(0f);

    uv_11 = uv_10;
    refractOffset_1 = refractOffset;
    chroma_1 = chroma;
    blurAmount_3 = blurAmount_2;
    let _e15: vec2<f32> = uv_11;
    let _e16: vec2<f32> = refractOffset_1;
    centerUv = (_e15 + _e16);
    let _e19: vec2<f32> = refractOffset_1;
    let _e22: vec4<f32> = global._data[25];
    let _e27: vec4<f32> = global._data[2];
    bendPixels = length(((_e19 * _e22.xy) / vec2(max(_e27.x, 1f))));
    let _e37: vec4<f32> = global._data[1];
    let _e41: f32 = blurAmount_3;
    let _e45: vec4<f32> = global._data[0];
    let _e52: f32 = bendPixels;
    blurSupport = ((((max(_e37.x, 0f) * _e41) * _e45.x) * 0.5f) * smoothstep(0f, 2f, _e52));
    let _e57: f32 = bendPixels;
    let _e60: f32 = blurSupport;
    let _e63: f32 = chroma_1;
    spreadPixels = (min(48f, ((_e57 * 0.85f) + _e60)) * clamp(_e63, 0f, 1f));
    let _e69: f32 = spreadPixels;
    if (_e69 < 0.01f) {
        {
            let _e72: vec2<f32> = centerUv;
            let _e73: f32 = blurAmount_3;
            let _e74: vec3<f32> = sampleGlassSource(_e72, _e73);
            return _e74;
        }
    }
    let _e75: vec2<f32> = refractOffset_1;
    let _e76: f32 = spreadPixels;
    let _e77: f32 = bendPixels;
    spreadUv = (_e75 * (_e76 / max(_e77, 0.00001f)));
    let _e86: vec3<f32> = color_2;
    let _e87: vec2<f32> = centerUv;
    let _e88: vec2<f32> = spreadUv;
    let _e92: f32 = blurAmount_3;
    let _e93: vec3<f32> = sampleGlassSource((_e87 + (_e88 * 1f)), _e92);
    color_2 = (_e86 + (_e93 * vec3<f32>(0.003970617f, 0.028517168f, 0.32453805f)));
    let _e100: vec3<f32> = color_2;
    let _e101: vec2<f32> = centerUv;
    let _e102: vec2<f32> = spreadUv;
    let _e106: f32 = blurAmount_3;
    let _e107: vec3<f32> = sampleGlassSource((_e101 + (_e102 * 0.58079654f)), _e106);
    color_2 = (_e100 + (_e107 * vec3<f32>(0.01985367f, 0.12036229f, 0.39541414f)));
    let _e114: vec3<f32> = color_2;
    let _e115: vec2<f32> = centerUv;
    let _e116: vec2<f32> = spreadUv;
    let _e120: f32 = blurAmount_3;
    let _e121: vec3<f32> = sampleGlassSource((_e115 + (_e116 * 0.25630382f)), _e120);
    color_2 = (_e114 + (_e121 * vec3<f32>(0.06797624f, 0.2678712f, 0.21862131f)));
    let _e128: vec3<f32> = color_2;
    let _e129: vec2<f32> = centerUv;
    let _e130: vec2<f32> = spreadUv;
    let _e134: f32 = blurAmount_3;
    let _e135: vec3<f32> = sampleGlassSource((_e129 + (_e130 * 0f)), _e134);
    color_2 = (_e128 + (_e135 * vec3<f32>(0.1593701f, 0.31434977f, 0.054851253f)));
    let _e142: vec3<f32> = color_2;
    let _e143: vec2<f32> = centerUv;
    let _e144: vec2<f32> = spreadUv;
    let _e149: f32 = blurAmount_3;
    let _e150: vec3<f32> = sampleGlassSource((_e143 + (_e144 * -0.20596357f)), _e149);
    color_2 = (_e142 + (_e150 * vec3<f32>(0.25585273f, 0.19451442f, 0.006245027f)));
    let _e157: vec3<f32> = color_2;
    let _e158: vec2<f32> = centerUv;
    let _e159: vec2<f32> = spreadUv;
    let _e164: f32 = blurAmount_3;
    let _e165: vec3<f32> = sampleGlassSource((_e158 + (_e159 * -0.373956f)), _e164);
    color_2 = (_e157 + (_e165 * vec3<f32>(0.28125915f, 0.063466124f, 0.000322653f)));
    let _e172: vec3<f32> = color_2;
    let _e173: vec2<f32> = centerUv;
    let _e174: vec2<f32> = spreadUv;
    let _e179: f32 = blurAmount_3;
    let _e180: vec3<f32> = sampleGlassSource((_e173 + (_e174 * -0.51276815f)), _e179);
    color_2 = (_e172 + (_e180 * vec3<f32>(0.2117175f, 0.010919021f, 0.000007565f)));
    let _e187: vec3<f32> = color_2;
    return _e187;
}

fn glassLensSlope(p_22: vec2<f32>, halfSize: vec2<f32>) -> vec2<f32> {
    var p_23: vec2<f32>;
    var halfSize_1: vec2<f32>;
    var circular: bool;
    var square: bool;
    var q_1: vec2<f32>;

    p_23 = p_22;
    halfSize_1 = halfSize;
    let _e13: vec4<f32> = global._data[52];
    let _e19: vec4<f32> = global._data[52];
    circular = ((_e13.x > 0.5f) && (_e19.x < 1.5f));
    let _e27: vec4<f32> = global._data[52];
    let _e33: vec4<f32> = global._data[52];
    square = ((_e27.x > 10.5f) && (_e33.x < 11.5f));
    let _e39: bool = circular;
    let _e40: bool = square;
    if (_e39 || _e40) {
        let _e42: vec2<f32> = halfSize_1;
        let _e44: vec2<f32> = halfSize_1;
        halfSize_1 = vec2(min(_e42.x, _e44.y));
    }
    let _e48: vec2<f32> = p_23;
    let _e49: vec2<f32> = halfSize_1;
    q_1 = (_e48 / max(_e49, vec2(0.001f)));
    let _e57: vec4<f32> = global._data[52];
    let _e63: vec4<f32> = global._data[52];
    if ((_e57.x > 0.5f) && (_e63.x < 2.5f)) {
        {
            let _e68: vec2<f32> = q_1;
            let _e71: vec2<f32> = q_1;
            let _e72: vec2<f32> = q_1;
            return (_e68 * (0.6f + (0.85f * dot(_e71, _e72))));
        }
    }
    let _e77: vec2<f32> = q_1;
    let _e80: vec2<f32> = q_1;
    let _e82: vec2<f32> = q_1;
    return (_e77 * (vec2(0.6f) + ((0.85f * _e80) * _e82)));
}

fn applyColorGrade(color_3: vec3<f32>) -> vec3<f32> {
    var color_4: vec3<f32>;
    var luma: f32;
    var temperature: f32;
    var tint: f32;

    color_4 = color_3;
    let _e9: vec3<f32> = color_4;
    color_4 = max(_e9, vec3(0f));
    let _e13: vec3<f32> = color_4;
    let _e16: vec4<f32> = global._data[36];
    color_4 = (_e13 * exp2(clamp(_e16.x, -2f, 2f)));
    let _e24: vec3<f32> = color_4;
    let _e27: vec4<f32> = global._data[37];
    color_4 = (_e24 + vec3(clamp(_e27.x, -0.25f, 0.25f)));
    let _e35: vec3<f32> = color_4;
    let _e41: vec4<f32> = global._data[38];
    color_4 = (((_e35 - vec3(0.5f)) * clamp(_e41.x, 0f, 2f)) + vec3(0.5f));
    let _e50: vec3<f32> = color_4;
    luma = dot(_e50, vec3<f32>(0.2126f, 0.7152f, 0.0722f));
    let _e57: f32 = luma;
    let _e59: vec3<f32> = color_4;
    let _e62: vec4<f32> = global._data[39];
    color_4 = mix(vec3(_e57), _e59, vec3(clamp(_e62.x, 0f, 2f)));
    let _e71: vec4<f32> = global._data[40];
    temperature = clamp(_e71.x, -1f, 1f);
    let _e80: vec4<f32> = global._data[41];
    tint = clamp(_e80.x, -1f, 1f);
    let _e87: vec3<f32> = color_4;
    let _e88: f32 = temperature;
    let _e91: f32 = tint;
    let _e94: f32 = temperature;
    color_4 = (_e87 + vec3<f32>((_e88 * 0.055f), (_e91 * 0.045f), (-(_e94) * 0.055f)));
    let _e100: vec3<f32> = color_4;
    color_4 = max(_e100, vec3(0f));
    let _e104: vec3<f32> = color_4;
    let _e108: vec4<f32> = global._data[42];
    color_4 = pow(_e104, vec3((1f / clamp(_e108.x, 0.4f, 2.4f))));
    let _e116: vec3<f32> = color_4;
    return clamp(_e116, vec3(0f), vec3(1f));
}

fn pixelPulseLight(panelUv: vec2<f32>, panelPixels: vec2<f32>) -> f32 {
    var panelUv_1: vec2<f32>;
    var panelPixels_1: vec2<f32>;
    var progress: f32;
    var cell: f32;
    var point: vec2<f32>;
    var index: vec2<f32>;
    var center: vec2<f32>;
    var origin: vec2<f32>;
    var reach: f32;
    var radius_3: f32;
    var stagger: f32;
    var age: f32;
    var band: f32;
    var envelope: f32;
    var edge: f32;
    var coverage: f32;

    panelUv_1 = panelUv;
    panelPixels_1 = panelPixels;
    let _e13: vec4<f32> = global._data[20];
    progress = _e13.z;
    let _e17: f32 = progress;
    let _e20: f32 = progress;
    if ((_e17 >= 1f) || (_e20 <= 0f)) {
        return 0f;
    }
    let _e27: vec4<f32> = global._data[20];
    cell = _e27.w;
    let _e31: vec2<f32> = panelUv_1;
    let _e34: vec2<f32> = panelUv_1;
    let _e38: vec2<f32> = panelPixels_1;
    point = (vec2<f32>(_e31.x, (1f - _e34.y)) * _e38);
    let _e41: vec2<f32> = point;
    let _e42: f32 = cell;
    index = floor((_e41 / vec2(_e42)));
    let _e47: vec2<f32> = index;
    let _e51: f32 = cell;
    center = ((_e47 + vec2(0.5f)) * _e51);
    let _e56: vec4<f32> = global._data[20];
    origin = _e56.xy;
    let _e60: vec2<f32> = origin;
    let _e61: vec2<f32> = panelPixels_1;
    let _e62: vec2<f32> = origin;
    let _e66: f32 = cell;
    reach = (length(max(_e60, (_e61 - _e62))) + (_e66 * 2f));
    let _e71: f32 = cell;
    let _e75: f32 = reach;
    let _e76: f32 = cell;
    let _e80: f32 = progress;
    radius_3 = mix((-(_e71) * 2f), (_e75 + (_e76 * 2f)), _e80);
    let _e83: vec2<f32> = index;
    let _e87: vec2<f32> = index;
    let _e91: f32 = ((_e83.x * 17f) + (_e87.y * 31f));
    let _e99: f32 = cell;
    stagger = ((((_e91 - (floor((_e91 / 13f)) * 13f)) / 13f) * _e99) * 0.35f);
    let _e104: f32 = radius_3;
    let _e105: vec2<f32> = center;
    let _e106: vec2<f32> = origin;
    let _e110: f32 = stagger;
    age = ((_e104 - length((_e105 - _e106))) - _e110);
    let _e114: f32 = cell;
    let _e118: vec4<f32> = global._data[21];
    band = max(3f, (_e114 * (0.35f + (_e118.x * 1.8f))));
    let _e129: f32 = progress;
    let _e134: f32 = progress;
    envelope = (smoothstep(0f, 0.08f, _e129) * (1f - smoothstep(0.85f, 1f, _e134)));
    let _e139: vec2<f32> = point;
    let _e141: vec2<f32> = center;
    let _e145: vec2<f32> = point;
    let _e147: vec2<f32> = center;
    edge = max(abs((_e139.x - _e141.x)), abs((_e145.y - _e147.y)));
    let _e154: f32 = cell;
    let _e157: f32 = cell;
    let _e160: f32 = edge;
    coverage = (1f - smoothstep((_e154 * 0.42f), (_e157 * 0.5f), _e160));
    let _e166: f32 = age;
    let _e167: f32 = band;
    let _e173: f32 = envelope;
    let _e175: f32 = coverage;
    let _e179: vec4<f32> = global._data[21];
    return (((exp((-0.5f * pow((_e166 / _e167), 2f))) * _e173) * _e175) * _e179.y);
}

fn writeOutputColor(color_5: vec3<f32>, baseColor: vec3<f32>, panelMask: f32, panelUv_2: vec2<f32>, edgeNormal: vec2<f32>, depthPx: f32, regionMask: f32) {
    var color_6: vec3<f32>;
    var baseColor_1: vec3<f32>;
    var panelMask_1: f32;
    var panelUv_3: vec2<f32>;
    var edgeNormal_1: vec2<f32>;
    var depthPx_1: f32;
    var regionMask_1: f32;
    var gold: vec3<f32> = vec3<f32>(1f, 0.78f, 0.035f);
    var facing: f32;
    var highlightSpread: f32;
    var directional: f32;
    var edgeBand: f32;
    var light: f32;
    var shade: f32;
    var edgeBand_1: f32;
    var direction_2: vec2<f32>;
    var facing_1: f32;
    var light_1: f32;
    var shade_1: f32;
    var reveal: f32 = 1f;
    var scanLight: f32 = 0f;
    var coordinate: f32;
    var softness: f32;
    var front: f32;
    var local_5: f32;
    var axisPixels: f32;
    var lineWidth: f32;
    var scanLine: f32;
    var scanEnvelope: f32;
    var materialColor: vec3<f32>;
    var pulseLight: f32;
    var outputColor: vec3<f32>;

    color_6 = color_5;
    baseColor_1 = baseColor;
    panelMask_1 = panelMask;
    panelUv_3 = panelUv_2;
    edgeNormal_1 = edgeNormal;
    depthPx_1 = depthPx;
    regionMask_1 = regionMask;
    let _e28: vec4<f32> = global._data[5];
    if (_e28.x > 0.5f) {
        {
            let _e33: vec2<f32> = edgeNormal_1;
            let _e36: vec4<f32> = global._data[17];
            facing = dot(_e33, normalize((_e36.xy + vec2(0.0001f))));
            let _e48: vec4<f32> = global._data[7];
            highlightSpread = mix(12f, 1.2f, clamp(_e48.x, 0f, 1f));
            let _e55: f32 = facing;
            let _e58: f32 = highlightSpread;
            directional = pow(max(_e55, 0f), _e58);
            let _e61: f32 = depthPx_1;
            let _e65: vec4<f32> = global._data[16];
            let _e77: vec4<f32> = global._data[16];
            let _e83: f32 = depthPx_1;
            edgeBand = (exp((-(_e61) / max(_e65.z, 0.25f))) * (1f - smoothstep(0f, max(3f, (_e77.z * 3f)), _e83)));
            let _e88: f32 = directional;
            let _e89: f32 = edgeBand;
            let _e95: vec4<f32> = global._data[16];
            let _e99: f32 = regionMask_1;
            light = ((((_e88 * _e89) * 0.83f) * _e95.y) * _e99);
            let _e102: f32 = facing;
            let _e108: f32 = edgeBand;
            let _e112: vec4<f32> = global._data[16];
            let _e116: f32 = regionMask_1;
            shade = ((((pow(max(-(_e102), 0f), 2f) * _e108) * _e112.y) * _e116) * 0.12f);
            let _e121: vec3<f32> = color_6;
            let _e123: f32 = shade;
            let _e128: vec4<f32> = global._data[4];
            let _e130: f32 = light;
            color_6 = ((_e121 * (1f - _e123)) + (_e128.xyz * _e130));
        }
    } else {
        let _e135: vec4<f32> = global._data[16];
        if (_e135.x > 0.5f) {
            {
                let _e140: f32 = depthPx_1;
                let _e146: vec4<f32> = global._data[16];
                edgeBand_1 = exp((-(max(_e140, 0f)) / max(_e146.z, 0.25f)));
                let _e156: vec4<f32> = global._data[17];
                direction_2 = normalize((_e156.xy + vec2(0.0001f)));
                let _e163: vec2<f32> = edgeNormal_1;
                let _e164: vec2<f32> = direction_2;
                facing_1 = dot(_e163, _e164);
                let _e167: f32 = facing_1;
                let _e172: f32 = edgeBand_1;
                let _e176: vec4<f32> = global._data[16];
                let _e180: f32 = regionMask_1;
                light_1 = (((pow(max(_e167, 0f), 2.5f) * _e172) * _e176.y) * _e180);
                let _e183: f32 = facing_1;
                let _e189: f32 = edgeBand_1;
                let _e193: vec4<f32> = global._data[16];
                let _e197: f32 = regionMask_1;
                shade_1 = ((((pow(max(-(_e183), 0f), 1.5f) * _e189) * _e193.y) * _e197) * 0.24f);
                let _e202: vec3<f32> = color_6;
                let _e204: f32 = shade_1;
                let _e209: vec4<f32> = global._data[4];
                let _e211: f32 = light_1;
                color_6 = ((_e202 * (1f - _e204)) + (_e209.xyz * _e211));
            }
        }
    }
    let _e220: vec4<f32> = global._data[18];
    if (_e220.x < 1f) {
        {
            let _e226: vec2<f32> = panelUv_3;
            coordinate = (1f - _e226.y);
            let _e232: vec4<f32> = global._data[18];
            let _e239: vec4<f32> = global._data[18];
            if ((_e232.z > 0.5f) && (_e239.z < 1.5f)) {
                let _e245: vec2<f32> = panelUv_3;
                coordinate = _e245.y;
            }
            let _e249: vec4<f32> = global._data[18];
            let _e256: vec4<f32> = global._data[18];
            if ((_e249.z > 1.5f) && (_e256.z < 2.5f)) {
                let _e262: vec2<f32> = panelUv_3;
                coordinate = _e262.x;
            }
            let _e266: vec4<f32> = global._data[18];
            if (_e266.z > 2.5f) {
                let _e272: vec2<f32> = panelUv_3;
                coordinate = (1f - _e272.x);
            }
            let _e277: vec4<f32> = global._data[18];
            softness = max(_e277.y, 0.001f);
            let _e283: f32 = softness;
            let _e288: f32 = softness;
            let _e294: vec4<f32> = global._data[18];
            front = mix((-(_e283) * 2f), (1f + (_e288 * 2f)), _e294.x);
            let _e300: f32 = front;
            let _e301: f32 = softness;
            let _e303: f32 = front;
            let _e304: f32 = coordinate;
            reveal = (1f - smoothstep((_e300 - _e301), _e303, _e304));
            let _e309: vec4<f32> = global._data[18];
            if (_e309.z > 1.5f) {
                let _e316: vec4<f32> = global._data[25];
                let _e321: vec4<f32> = global._data[26];
                local_5 = (_e316.x * _e321.z);
            } else {
                let _e327: vec4<f32> = global._data[25];
                let _e332: vec4<f32> = global._data[26];
                local_5 = (_e327.y * _e332.w);
            }
            let _e337: f32 = local_5;
            axisPixels = _e337;
            let _e342: vec4<f32> = global._data[2];
            let _e345: f32 = axisPixels;
            lineWidth = ((1.25f * _e342.x) / max(_e345, 1f));
            let _e351: f32 = lineWidth;
            let _e354: f32 = lineWidth;
            let _e357: f32 = coordinate;
            let _e358: f32 = front;
            scanLine = (1f - smoothstep((_e351 * 0.35f), (_e354 * 2f), abs((_e357 - _e358))));
            let _e368: vec4<f32> = global._data[18];
            let _e377: vec4<f32> = global._data[18];
            scanEnvelope = (smoothstep(0f, 0.08f, _e368.x) * (1f - smoothstep(0.92f, 1f, _e377.x)));
            let _e384: f32 = scanLine;
            let _e385: f32 = scanEnvelope;
            let _e389: vec4<f32> = global._data[19];
            let _e392: f32 = regionMask_1;
            scanLight = (((_e384 * _e385) * _e389.x) * _e392);
            let _e396: vec4<f32> = global._data[18];
            if (_e396.x <= 0f) {
                reveal = 0f;
            }
        }
    }
    let _e402: vec3<f32> = color_6;
    let _e403: vec3<f32> = applyColorGrade(_e402);
    let _e406: vec4<f32> = global._data[8];
    let _e410: vec4<f32> = global._data[9];
    materialColor = mix(_e403, _e406.xyz, vec3(clamp(_e410.x, 0f, 1f)));
    let _e418: vec2<f32> = panelUv_3;
    let _e421: vec4<f32> = global._data[25];
    let _e425: vec4<f32> = global._data[26];
    let _e431: vec4<f32> = global._data[2];
    let _e437: f32 = pixelPulseLight(_e418, ((_e421.xy * _e425.zw) / vec2(max(_e431.x, 1f))));
    pulseLight = _e437;
    let _e439: vec3<f32> = materialColor;
    let _e442: vec4<f32> = global._data[22];
    let _e444: f32 = pulseLight;
    let _e448: vec4<f32> = global._data[23];
    materialColor = (_e439 + ((_e442.xyz * _e444) * _e448.x));
    let _e452: vec3<f32> = baseColor_1;
    let _e453: vec3<f32> = materialColor;
    let _e454: f32 = panelMask_1;
    let _e455: f32 = reveal;
    let _e459: vec3<f32> = gold;
    let _e460: f32 = scanLight;
    let _e462: f32 = panelMask_1;
    outputColor = (mix(_e452, _e453, vec3((_e454 * _e455))) + ((_e459 * _e460) * _e462));
    let _e466: vec3<f32> = outputColor;
    let _e472: vec4<f32> = linearToOutputTexel(vec4<f32>(_e466.x, _e466.y, _e466.z, 1f));
    fragColor = _e472;
    return;
}

fn smootherstep01_(x: f32) -> f32 {
    var x_1: f32;

    x_1 = x;
    let _e9: f32 = x_1;
    x_1 = clamp(_e9, 0f, 1f);
    let _e13: f32 = x_1;
    let _e14: f32 = x_1;
    let _e16: f32 = x_1;
    let _e18: f32 = x_1;
    let _e19: f32 = x_1;
    return (((_e13 * _e14) * _e16) * ((_e18 * ((_e19 * 6f) - 15f)) + 10f));
}

fn signedOpticalPower(ior: f32) -> f32 {
    var ior_1: f32;

    ior_1 = ior;
    let _e9: f32 = ior_1;
    return (_e9 * 0.18032788f);
}

fn stripMask(distanceToEdge: f32, width: f32, softness_1: f32) -> f32 {
    var distanceToEdge_1: f32;
    var width_1: f32;
    var softness_2: f32;
    var innerStart: f32;

    distanceToEdge_1 = distanceToEdge;
    width_1 = width;
    softness_2 = softness_1;
    let _e14: f32 = width_1;
    let _e15: f32 = softness_2;
    innerStart = max(0f, (_e14 - _e15));
    let _e20: f32 = innerStart;
    let _e21: f32 = width_1;
    let _e22: f32 = distanceToEdge_1;
    return (1f - smoothstep(_e20, _e21, _e22));
}

fn effectRegionMask(uv_12: vec2<f32>) -> f32 {
    var uv_13: vec2<f32>;
    var selected: f32;
    var width_2: f32;
    var softness_3: f32;
    var top: f32;
    var right: f32;
    var bottom: f32;
    var left: f32;

    uv_13 = uv_12;
    let _e11: vec4<f32> = global._data[49];
    let _e16: vec4<f32> = global._data[49];
    let _e22: vec4<f32> = global._data[49];
    let _e27: vec4<f32> = global._data[49];
    selected = max(max(_e11.x, _e16.y), max(_e22.z, _e27.w));
    let _e33: f32 = selected;
    if (_e33 < 0.5f) {
        {
            return 0f;
        }
    }
    let _e39: vec4<f32> = global._data[50];
    width_2 = clamp(_e39.x, 0f, 1f);
    let _e47: vec4<f32> = global._data[51];
    softness_3 = clamp(_e47.x, 0.001f, 0.5f);
    let _e54: vec2<f32> = uv_13;
    let _e57: f32 = width_2;
    let _e58: f32 = softness_3;
    let _e59: f32 = stripMask((1f - _e54.y), _e57, _e58);
    let _e62: vec4<f32> = global._data[49];
    top = (_e59 * _e62.x);
    let _e68: vec2<f32> = uv_13;
    let _e71: f32 = width_2;
    let _e72: f32 = softness_3;
    let _e73: f32 = stripMask((1f - _e68.x), _e71, _e72);
    let _e76: vec4<f32> = global._data[49];
    right = (_e73 * _e76.y);
    let _e81: vec2<f32> = uv_13;
    let _e83: f32 = width_2;
    let _e84: f32 = softness_3;
    let _e85: f32 = stripMask(_e81.y, _e83, _e84);
    let _e88: vec4<f32> = global._data[49];
    bottom = (_e85 * _e88.z);
    let _e93: vec2<f32> = uv_13;
    let _e95: f32 = width_2;
    let _e96: f32 = softness_3;
    let _e97: f32 = stripMask(_e93.x, _e95, _e96);
    let _e100: vec4<f32> = global._data[49];
    left = (_e97 * _e100.w);
    let _e105: f32 = top;
    let _e106: f32 = right;
    let _e108: f32 = bottom;
    let _e109: f32 = left;
    return clamp(max(max(_e105, _e106), max(_e108, _e109)), 0f, 1f);
}

fn main_1() {
    var baseColor_2: vec3<f32>;
    var panelSize: vec2<f32>;
    var panelUv_4: vec2<f32>;
    var panelResolution: vec2<f32>;
    var aspect: f32;
    var aspectCorrection: vec2<f32>;
    var p_24: vec2<f32>;
    var thickness: f32;
    var radius_4: f32;
    var innerSize_2: vec2<f32>;
    var d: f32;
    var chroma_2: f32;
    var lightDirection: vec2<f32> = vec2<f32>(-0.45915133f, -0.888358f);
    var regionMask_2: f32;
    var panelMask_2: f32 = 1f;
    var outerSize: vec2<f32>;
    var panelDistance: f32;
    var depthPx_2: f32;
    var aa: f32;
    var edgeNormal_2: vec2<f32> = vec2(0f);
    var edgeEpsilon: f32;
    var epsEdge: vec2<f32>;
    var edgeGrad: vec2<f32>;
    var blurAmount_4: f32 = 1f;
    var surfaceOffset: vec2<f32> = vec2(0f);
    var facetOffset: vec2<f32> = vec2(0f);
    var width_3: f32;
    var facetCurve: f32;
    var touchPanelUv: vec2<f32>;
    var delta: vec2<f32>;
    var touchRadius: f32;
    var normalizedDistance: f32;
    var dent: f32;
    var boundary: f32;
    var opticalSlope: vec2<f32>;
    var shortSide: f32;
    var boundary_1: f32;
    var flowMask: f32;
    var normal3D: vec3<f32>;
    var ray: vec3<f32>;
    var bendPixels_1: vec2<f32>;
    var bendUv: vec2<f32>;
    var opticalColor: vec3<f32>;
    var glassBaseColor: vec3<f32>;
    var spectralEdge: f32;
    var centerVector: vec2<f32>;
    var normalizedCenter: vec2<f32>;
    var ellipseTravel: f32;
    var rectTravel: f32;
    var edgeBlend: f32;
    var edgeTravel: f32;
    var fieldStart: f32;
    var fieldSoftness: f32;
    var fieldCurve: f32;
    var fadeProgress: f32;
    var longRamp: f32;
    var maskFade: f32;
    var dissolveFade: f32;
    var masterFade: f32;
    var local_6: vec2<f32>;
    var normal: vec2<f32>;
    var opticalNormal: vec2<f32>;
    var fieldStrength: f32;
    var pull: f32;
    var refractOffset_2: vec2<f32>;
    var opticalColor_1: vec3<f32>;
    var edgeMask: f32;
    var rimLight: f32;
    var lowerLip: f32;
    var sweep: f32;
    var highlight: f32;
    var highlightColor: vec3<f32>;
    var absorption: f32;
    var eps_1: vec2<f32> = vec2<f32>(0.0015f, 0f);
    var dX_1: f32;
    var dY_1: f32;
    var grad_1: vec2<f32>;
    var local_7: vec2<f32>;
    var normal_1: vec2<f32>;
    var borderMask: f32;
    var bevel: f32;
    var opticalNormal_1: vec2<f32>;
    var pull_1: f32;
    var refractOffset_3: vec2<f32>;
    var color_7: vec3<f32>;
    var rimLight_1: f32;
    var lowerLip_1: f32;
    var sweep_1: f32;
    var highlight_1: f32;
    var highlightColor_1: vec3<f32>;
    var absorption_1: f32;

    let _e7: vec2<f32> = vUv_1;
    let _e8: vec3<f32> = sampleSource(_e7);
    baseColor_2 = _e8;
    let _e12: vec4<f32> = global._data[3];
    if (_e12.x < 0.5f) {
        {
            let _e16: vec3<f32> = baseColor_2;
            let _e22: vec4<f32> = linearToOutputTexel(vec4<f32>(_e16.x, _e16.y, _e16.z, 1f));
            fragColor = _e22;
            return;
        }
    }
    let _e25: vec4<f32> = global._data[26];
    panelSize = max(_e25.zw, vec2(0.001f));
    let _e32: vec2<f32> = vUv_1;
    let _e35: vec4<f32> = global._data[26];
    let _e39: vec2<f32> = panelSize;
    panelUv_4 = (((_e32 - _e35.xy) / _e39) + vec2(0.5f));
    let _e47: vec4<f32> = global._data[25];
    let _e49: vec2<f32> = panelSize;
    panelResolution = (_e47.xy * _e49);
    let _e52: vec2<f32> = panelResolution;
    let _e54: vec2<f32> = panelResolution;
    aspect = (_e52.x / max(_e54.y, 1f));
    let _e60: f32 = aspect;
    aspectCorrection = vec2<f32>(_e60, 1f);
    let _e64: vec2<f32> = panelUv_4;
    let _e68: vec2<f32> = aspectCorrection;
    p_24 = ((_e64 - vec2(0.5f)) * _e68);
    let _e73: vec4<f32> = global._data[31];
    thickness = clamp(_e73.x, 0.001f, 0.32f);
    let _e81: vec4<f32> = global._data[32];
    radius_4 = clamp(_e81.x, 0f, 0.34f);
    let _e89: f32 = aspect;
    let _e91: f32 = thickness;
    let _e92: f32 = aspect;
    let _e98: f32 = thickness;
    innerSize_2 = vec2<f32>(max(0.001f, ((0.5f * _e89) - (_e91 * _e92))), max(0.001f, (0.5f - _e98)));
    let _e103: vec2<f32> = p_24;
    let _e104: vec2<f32> = innerSize_2;
    let _e105: f32 = radius_4;
    let _e106: f32 = shapeDistance(_e103, _e104, _e105);
    d = _e106;
    let _e110: vec4<f32> = global._data[33];
    chroma_2 = clamp((_e110.x / 0.08f), 0f, 1f);
    let _e128: vec2<f32> = panelUv_4;
    let _e129: f32 = effectRegionMask(_e128);
    regionMask_2 = _e129;
    let _e134: f32 = aspect;
    outerSize = vec2<f32>((0.5f * _e134), 0.5f);
    let _e139: vec2<f32> = p_24;
    let _e140: vec2<f32> = outerSize;
    let _e141: f32 = radius_4;
    let _e142: f32 = shapeDistance(_e139, _e140, _e141);
    panelDistance = _e142;
    let _e145: f32 = panelDistance;
    let _e147: vec2<f32> = panelResolution;
    let _e152: vec4<f32> = global._data[2];
    depthPx_2 = max(0f, ((-(_e145) * _e147.y) / max(_e152.x, 1f)));
    let _e161: vec4<f32> = global._data[27];
    let _e167: vec4<f32> = global._data[52];
    if ((_e161.x > 0.5f) || (_e167.x > 10.5f)) {
        {
            let _e173: vec2<f32> = panelResolution;
            aa = (1.5f / max(_e173.y, 1f));
            let _e180: f32 = aa;
            let _e182: f32 = aa;
            let _e183: f32 = panelDistance;
            panelMask_2 = (1f - smoothstep(-(_e180), _e182, _e183));
            let _e186: f32 = panelMask_2;
            if (_e186 <= 0f) {
                {
                    let _e189: vec3<f32> = baseColor_2;
                    let _e195: vec4<f32> = linearToOutputTexel(vec4<f32>(_e189.x, _e189.y, _e189.z, 1f));
                    fragColor = _e195;
                    return;
                }
            }
        }
    }
    let _e201: vec4<f32> = global._data[10];
    let _e208: vec4<f32> = global._data[16];
    let _e216: vec4<f32> = global._data[5];
    if (((_e201.x > 0.5f) || (_e208.x > 0.5f)) || (_e216.x > 0.5f)) {
        {
            let _e223: vec2<f32> = panelResolution;
            edgeEpsilon = (0.75f / max(_e223.y, 1f));
            let _e229: f32 = edgeEpsilon;
            epsEdge = vec2<f32>(_e229, 0f);
            let _e233: vec2<f32> = p_24;
            let _e234: vec2<f32> = epsEdge;
            let _e237: vec2<f32> = outerSize;
            let _e238: f32 = radius_4;
            let _e239: f32 = shapeDistance((_e233 + _e234.xy), _e237, _e238);
            let _e240: vec2<f32> = p_24;
            let _e241: vec2<f32> = epsEdge;
            let _e244: vec2<f32> = outerSize;
            let _e245: f32 = radius_4;
            let _e246: f32 = shapeDistance((_e240 - _e241.xy), _e244, _e245);
            let _e248: vec2<f32> = p_24;
            let _e249: vec2<f32> = epsEdge;
            let _e252: vec2<f32> = outerSize;
            let _e253: f32 = radius_4;
            let _e254: f32 = shapeDistance((_e248 + _e249.yx), _e252, _e253);
            let _e255: vec2<f32> = p_24;
            let _e256: vec2<f32> = epsEdge;
            let _e259: vec2<f32> = outerSize;
            let _e260: f32 = radius_4;
            let _e261: f32 = shapeDistance((_e255 - _e256.yx), _e259, _e260);
            edgeGrad = vec2<f32>((_e239 - _e246), (_e254 - _e261));
            let _e265: vec2<f32> = edgeGrad;
            if (length(_e265) > 0.00001f) {
                let _e269: vec2<f32> = edgeGrad;
                edgeNormal_2 = normalize(_e269);
            }
        }
    }
    let _e281: vec4<f32> = global._data[10];
    if (_e281.x > 0.5f) {
        {
            let _e288: vec4<f32> = global._data[10];
            width_3 = max(_e288.y, 0.5f);
            let _e294: f32 = width_3;
            let _e297: f32 = width_3;
            let _e300: f32 = depthPx_2;
            blurAmount_4 = smoothstep((_e294 * 0.8f), (_e297 * 1.65f), _e300);
            let _e302: f32 = depthPx_2;
            let _e303: f32 = width_3;
            facetCurve = sin((clamp((_e302 / (_e303 * 1.65f)), 0f, 1f) * 3.1415927f));
            let _e316: vec4<f32> = global._data[5];
            if (_e316.x < 0.5f) {
                {
                    let _e321: vec2<f32> = edgeNormal_2;
                    let _e324: vec4<f32> = global._data[30];
                    let _e326: f32 = signedOpticalPower(_e324.x);
                    let _e330: vec4<f32> = global._data[10];
                    let _e334: f32 = width_3;
                    let _e338: f32 = facetCurve;
                    let _e342: vec4<f32> = global._data[2];
                    let _e347: vec4<f32> = global._data[25];
                    facetOffset = (((((((_e321 * _e326) * _e330.z) * _e334) * 1.5f) * _e338) * _e342.x) / _e347.xy);
                    let _e350: vec2<f32> = surfaceOffset;
                    let _e351: vec2<f32> = facetOffset;
                    surfaceOffset = (_e350 + _e351);
                }
            }
        }
    }
    let _e355: vec4<f32> = global._data[13];
    if (_e355.z > 0.0001f) {
        {
            let _e362: vec4<f32> = global._data[13];
            let _e367: vec4<f32> = global._data[26];
            let _e371: vec2<f32> = panelSize;
            touchPanelUv = (((_e362.xy - _e367.xy) / _e371) + vec2(0.5f));
            let _e377: vec2<f32> = panelUv_4;
            let _e378: vec2<f32> = touchPanelUv;
            let _e380: vec2<f32> = aspectCorrection;
            delta = ((_e377 - _e378) * _e380);
            let _e385: vec4<f32> = global._data[14];
            let _e387: f32 = aspect;
            touchRadius = max((_e385.x * min(_e387, 1f)), 0.001f);
            let _e394: vec2<f32> = delta;
            let _e396: f32 = touchRadius;
            normalizedDistance = (length(_e394) / _e396);
            let _e399: f32 = normalizedDistance;
            let _e401: f32 = normalizedDistance;
            dent = exp(((-(_e399) * _e401) * 3f));
            let _e409: f32 = touchRadius;
            let _e410: vec2<f32> = panelResolution;
            let _e415: vec4<f32> = global._data[2];
            let _e421: f32 = depthPx_2;
            boundary = smoothstep(0f, max(3f, (((_e409 * _e410.y) / _e415.x) * 0.2f)), _e421);
            let _e424: vec2<f32> = surfaceOffset;
            let _e425: vec2<f32> = delta;
            let _e426: f32 = dent;
            let _e430: vec4<f32> = global._data[13];
            let _e436: vec4<f32> = global._data[15];
            let _e441: f32 = boundary;
            let _e443: vec2<f32> = aspectCorrection;
            let _e445: vec2<f32> = panelSize;
            surfaceOffset = (_e424 + (((((((_e425 * _e426) * _e430.z) * _e436.x) * 0.34f) * _e441) / _e443) * _e445));
        }
    }
    let _e450: vec4<f32> = global._data[5];
    if (_e450.x > 0.5f) {
        {
            let _e455: vec2<f32> = p_24;
            let _e456: vec2<f32> = outerSize;
            let _e457: vec2<f32> = glassLensSlope(_e455, _e456);
            opticalSlope = _e457;
            let _e459: vec2<f32> = panelResolution;
            let _e461: vec2<f32> = panelResolution;
            let _e466: vec4<f32> = global._data[2];
            shortSide = (min(_e459.x, _e461.y) / max(_e466.x, 1f));
            let _e474: f32 = shortSide;
            let _e478: f32 = depthPx_2;
            boundary_1 = smoothstep(0f, max(3f, (_e474 * 0.06f)), _e478);
            let _e482: f32 = boundary_1;
            let _e485: vec4<f32> = global._data[60];
            flowMask = mix(1f, _e482, clamp(_e485.x, 0f, 1f));
            let _e492: vec2<f32> = opticalSlope;
            let _e493: vec2<f32> = p_24;
            let _e496: vec4<f32> = global._data[29];
            let _e498: vec2<f32> = flowGradient(_e493, _e496.x);
            let _e501: vec4<f32> = global._data[57];
            let _e509: f32 = flowMask;
            let _e511: f32 = regionMask_2;
            opticalSlope = (_e492 + ((((_e498 * clamp(_e501.x, 0f, 1.5f)) * 0.18f) * _e509) * _e511));
            let _e514: vec2<f32> = opticalSlope;
            normal3D = normalize(vec3<f32>(_e514.x, _e514.y, 1f));
            let _e526: vec3<f32> = normal3D;
            ray = refract(vec3<f32>(0f, 0f, -1f), _e526, 0.6666667f);
            let _e532: vec3<f32> = ray;
            let _e534: vec3<f32> = ray;
            let _e543: vec4<f32> = global._data[6];
            bendPixels_1 = ((_e532.xy / vec2(max(abs(_e534.z), 0.15f))) * _e543.x);
            let _e547: vec2<f32> = bendPixels_1;
            let _e550: vec4<f32> = global._data[2];
            let _e555: vec4<f32> = global._data[25];
            bendUv = ((_e547 * _e550.x) / _e555.xy);
            let _e559: vec2<f32> = vUv_1;
            let _e560: vec2<f32> = surfaceOffset;
            let _e562: vec2<f32> = bendUv;
            let _e565: vec4<f32> = global._data[5];
            let _e568: f32 = blurAmount_4;
            let _e569: vec3<f32> = sampleDispersedSource((_e559 + _e560), _e562, _e565.w, _e568);
            opticalColor = _e569;
            let _e571: vec3<f32> = baseColor_2;
            let _e572: vec3<f32> = opticalColor;
            let _e573: f32 = regionMask_2;
            let _e576: vec3<f32> = baseColor_2;
            let _e577: f32 = panelMask_2;
            let _e578: vec2<f32> = panelUv_4;
            let _e579: vec2<f32> = edgeNormal_2;
            let _e580: f32 = depthPx_2;
            let _e581: f32 = regionMask_2;
            writeOutputColor(mix(_e571, _e572, vec3(_e573)), _e576, _e577, _e578, _e579, _e580, _e581);
            return;
        }
    }
    let _e582: vec3<f32> = baseColor_2;
    let _e583: vec2<f32> = vUv_1;
    let _e584: vec2<f32> = surfaceOffset;
    let _e586: f32 = blurAmount_4;
    let _e587: vec3<f32> = sampleGlassSource((_e583 + _e584), _e586);
    let _e588: f32 = regionMask_2;
    glassBaseColor = mix(_e582, _e587, vec3(_e588));
    let _e595: f32 = thickness;
    let _e596: vec2<f32> = panelResolution;
    let _e601: vec4<f32> = global._data[2];
    let _e605: f32 = depthPx_2;
    spectralEdge = (1f - smoothstep(0f, max(4f, ((_e595 * _e596.y) / _e601.x)), _e605));
    let _e609: f32 = chroma_2;
    let _e610: f32 = spectralEdge;
    chroma_2 = (_e609 * _e610);
    let _e614: vec4<f32> = global._data[43];
    if (_e614.x > 0.5f) {
        {
            let _e618: vec2<f32> = panelUv_4;
            let _e622: vec2<f32> = aspectCorrection;
            centerVector = ((_e618 - vec2(0.5f)) * _e622);
            let _e625: vec2<f32> = centerVector;
            let _e629: f32 = aspect;
            let _e634: vec2<f32> = centerVector;
            normalizedCenter = vec2<f32>((abs(_e625.x) / max((0.5f * _e629), 0.001f)), (abs(_e634.y) / 0.5f));
            let _e641: vec2<f32> = normalizedCenter;
            ellipseTravel = length(_e641);
            let _e644: vec2<f32> = normalizedCenter;
            let _e646: vec2<f32> = normalizedCenter;
            rectTravel = max(_e644.x, _e646.y);
            let _e652: f32 = ellipseTravel;
            edgeBlend = smoothstep(0.72f, 1.18f, _e652);
            let _e655: f32 = ellipseTravel;
            let _e656: f32 = rectTravel;
            let _e657: f32 = edgeBlend;
            edgeTravel = mix(_e655, _e656, (_e657 * 0.16f));
            let _e664: vec4<f32> = global._data[44];
            fieldStart = clamp(_e664.x, 0f, 0.9f);
            let _e672: vec4<f32> = global._data[45];
            fieldSoftness = clamp(_e672.x, 0.04f, 1f);
            let _e680: vec4<f32> = global._data[47];
            fieldCurve = clamp(_e680.x, 0.35f, 6f);
            let _e686: f32 = edgeTravel;
            let _e687: f32 = fieldStart;
            let _e689: f32 = fieldSoftness;
            fadeProgress = clamp(((_e686 - _e687) / max(_e689, 0.001f)), 0f, 1f);
            let _e698: f32 = fieldStart;
            let _e699: f32 = fieldSoftness;
            let _e705: f32 = edgeTravel;
            longRamp = smoothstep(max(0f, (_e698 - (_e699 * 0.45f))), 1.18f, _e705);
            let _e710: f32 = fadeProgress;
            let _e712: f32 = longRamp;
            let _e714: f32 = fieldCurve;
            maskFade = pow((smoothstep(0f, 1f, _e710) * _e712), _e714);
            let _e717: f32 = fadeProgress;
            let _e718: f32 = smootherstep01_(_e717);
            let _e720: f32 = fieldCurve;
            let _e725: f32 = longRamp;
            dissolveFade = (pow(_e718, max(0.6f, (_e720 * 0.82f))) * _e725);
            let _e728: f32 = maskFade;
            let _e729: f32 = dissolveFade;
            let _e733: vec4<f32> = global._data[46];
            let _e737: f32 = regionMask_2;
            masterFade = (mix(_e728, _e729, step(0.5f, _e733.x)) * _e737);
            let _e740: vec2<f32> = centerVector;
            if (length(_e740) > 0.00001f) {
                let _e744: vec2<f32> = centerVector;
                local_6 = normalize(_e744);
            } else {
                local_6 = vec2(0f);
            }
            let _e749: vec2<f32> = local_6;
            normal = _e749;
            let _e751: vec2<f32> = normal;
            let _e752: vec2<f32> = p_24;
            let _e753: f32 = masterFade;
            let _e754: vec2<f32> = applyFlowToNormal(_e751, _e752, _e753);
            opticalNormal = _e754;
            let _e758: vec4<f32> = global._data[48];
            fieldStrength = clamp(_e758.x, 0f, 2.5f);
            let _e766: vec4<f32> = global._data[30];
            let _e768: f32 = signedOpticalPower(_e766.x);
            let _e769: f32 = masterFade;
            let _e771: f32 = fieldStrength;
            let _e774: f32 = thickness;
            pull = (((_e768 * _e769) * _e771) * (0.055f + (_e774 * 0.38f)));
            let _e780: vec2<f32> = opticalNormal;
            let _e781: f32 = pull;
            let _e783: vec2<f32> = aspectCorrection;
            let _e785: vec2<f32> = panelSize;
            refractOffset_2 = (((_e780 * _e781) / _e783) * _e785);
            let _e788: vec2<f32> = vUv_1;
            let _e789: vec2<f32> = surfaceOffset;
            let _e791: vec2<f32> = facetOffset;
            let _e793: vec2<f32> = refractOffset_2;
            let _e794: vec2<f32> = facetOffset;
            let _e796: f32 = chroma_2;
            let _e797: f32 = blurAmount_4;
            let _e798: vec3<f32> = sampleDispersedSource(((_e788 + _e789) - _e791), (_e793 + _e794), _e796, _e797);
            opticalColor_1 = _e798;
            let _e800: f32 = fieldStart;
            let _e801: f32 = fieldSoftness;
            let _e808: f32 = edgeTravel;
            let _e810: f32 = masterFade;
            edgeMask = (smoothstep(max((_e800 + (_e801 * 0.65f)), 0.52f), 1.2f, _e808) * _e810);
            let _e813: vec2<f32> = opticalNormal;
            let _e814: vec2<f32> = lightDirection;
            let _e821: f32 = edgeMask;
            rimLight = (pow(max(dot(_e813, -(_e814)), 0f), 2.8f) * _e821);
            let _e826: vec2<f32> = panelUv_4;
            let _e829: f32 = edgeMask;
            lowerLip = (smoothstep(0.58f, 1f, _e826.y) * _e829);
            let _e834: vec2<f32> = panelUv_4;
            let _e838: vec4<f32> = global._data[29];
            let _e842: vec2<f32> = panelUv_4;
            let _e851: f32 = edgeMask;
            sweep = (smoothstep(0.025f, 0f, abs((_e834.x - fract(((_e838.x * 0.05f) + (_e842.y * 0.26f)))))) * _e851);
            let _e854: f32 = rimLight;
            let _e857: f32 = lowerLip;
            let _e861: f32 = sweep;
            let _e867: vec4<f32> = global._data[35];
            highlight = ((((_e854 * 0.72f) + (_e857 * 0.24f)) + (_e861 * 0.12f)) * _e867.x);
            let _e873: vec4<f32> = global._data[4];
            let _e875: f32 = rimLight;
            let _e876: f32 = lowerLip;
            highlightColor = (_e873.xyz * (_e875 + (_e876 * 0.8f)));
            let _e882: f32 = edgeMask;
            let _e885: vec4<f32> = global._data[34];
            let _e892: f32 = masterFade;
            absorption = ((_e882 * clamp(_e885.x, 0f, 1f)) * (0.28f + (_e892 * 0.42f)));
            let _e898: vec3<f32> = opticalColor_1;
            let _e899: vec3<f32> = opticalColor_1;
            let _e901: f32 = absorption;
            let _e904: f32 = edgeMask;
            opticalColor_1 = mix(_e898, (_e899 * (1f - _e901)), vec3(_e904));
            let _e907: vec3<f32> = opticalColor_1;
            let _e908: vec3<f32> = highlightColor;
            let _e909: f32 = highlight;
            opticalColor_1 = (_e907 + (_e908 * _e909));
            let _e912: vec3<f32> = glassBaseColor;
            let _e913: vec3<f32> = opticalColor_1;
            let _e914: f32 = masterFade;
            let _e917: vec3<f32> = baseColor_2;
            let _e918: f32 = panelMask_2;
            let _e919: vec2<f32> = panelUv_4;
            let _e920: vec2<f32> = edgeNormal_2;
            let _e921: f32 = depthPx_2;
            let _e922: f32 = regionMask_2;
            writeOutputColor(mix(_e912, _e913, vec3(_e914)), _e917, _e918, _e919, _e920, _e921, _e922);
            return;
        }
    }
    let _e923: f32 = d;
    if (_e923 < -0.001f) {
        {
            let _e927: vec3<f32> = glassBaseColor;
            let _e928: vec3<f32> = baseColor_2;
            let _e929: f32 = panelMask_2;
            let _e930: vec2<f32> = panelUv_4;
            let _e931: vec2<f32> = edgeNormal_2;
            let _e932: f32 = depthPx_2;
            let _e933: f32 = regionMask_2;
            writeOutputColor(_e927, _e928, _e929, _e930, _e931, _e932, _e933);
            return;
        }
    }
    let _e938: vec2<f32> = p_24;
    let _e939: vec2<f32> = eps_1;
    let _e942: vec2<f32> = innerSize_2;
    let _e943: f32 = radius_4;
    let _e944: f32 = shapeDistance((_e938 + _e939.xy), _e942, _e943);
    let _e945: vec2<f32> = p_24;
    let _e946: vec2<f32> = eps_1;
    let _e949: vec2<f32> = innerSize_2;
    let _e950: f32 = radius_4;
    let _e951: f32 = shapeDistance((_e945 - _e946.xy), _e949, _e950);
    dX_1 = (_e944 - _e951);
    let _e954: vec2<f32> = p_24;
    let _e955: vec2<f32> = eps_1;
    let _e958: vec2<f32> = innerSize_2;
    let _e959: f32 = radius_4;
    let _e960: f32 = shapeDistance((_e954 + _e955.yx), _e958, _e959);
    let _e961: vec2<f32> = p_24;
    let _e962: vec2<f32> = eps_1;
    let _e965: vec2<f32> = innerSize_2;
    let _e966: f32 = radius_4;
    let _e967: f32 = shapeDistance((_e961 - _e962.yx), _e965, _e966);
    dY_1 = (_e960 - _e967);
    let _e970: f32 = dX_1;
    let _e971: f32 = dY_1;
    grad_1 = vec2<f32>(_e970, _e971);
    let _e974: vec2<f32> = grad_1;
    if (length(_e974) > 0.00001f) {
        let _e978: vec2<f32> = grad_1;
        local_7 = normalize(_e978);
    } else {
        local_7 = vec2(0f);
    }
    let _e983: vec2<f32> = local_7;
    normal_1 = _e983;
    let _e987: f32 = thickness;
    let _e990: f32 = d;
    let _e993: f32 = thickness;
    let _e996: f32 = thickness;
    let _e999: f32 = d;
    borderMask = (smoothstep(-0.001f, (_e987 * 0.15f), _e990) * (1f - smoothstep((_e993 * 0.62f), (_e996 * 1.24f), _e999)));
    let _e1004: f32 = borderMask;
    let _e1005: f32 = regionMask_2;
    borderMask = (_e1004 * _e1005);
    let _e1008: f32 = d;
    let _e1009: f32 = thickness;
    bevel = pow((1f - clamp((_e1008 / max(_e1009, 0.001f)), 0f, 1f)), 0.58f);
    let _e1020: vec2<f32> = normal_1;
    let _e1021: vec2<f32> = p_24;
    let _e1022: f32 = borderMask;
    let _e1023: vec2<f32> = applyFlowToNormal(_e1020, _e1021, _e1022);
    opticalNormal_1 = _e1023;
    let _e1027: vec4<f32> = global._data[30];
    let _e1029: f32 = signedOpticalPower(_e1027.x);
    let _e1030: f32 = borderMask;
    let _e1033: f32 = thickness;
    pull_1 = ((_e1029 * _e1030) * (0.07f + (_e1033 * 0.62f)));
    let _e1039: vec2<f32> = opticalNormal_1;
    let _e1040: f32 = pull_1;
    let _e1042: vec2<f32> = aspectCorrection;
    let _e1044: vec2<f32> = panelSize;
    refractOffset_3 = (((_e1039 * _e1040) / _e1042) * _e1044);
    let _e1047: vec3<f32> = baseColor_2;
    let _e1048: vec2<f32> = vUv_1;
    let _e1049: vec2<f32> = surfaceOffset;
    let _e1051: vec2<f32> = facetOffset;
    let _e1053: vec2<f32> = refractOffset_3;
    let _e1054: vec2<f32> = facetOffset;
    let _e1056: f32 = chroma_2;
    let _e1057: f32 = blurAmount_4;
    let _e1058: vec3<f32> = sampleDispersedSource(((_e1048 + _e1049) - _e1051), (_e1053 + _e1054), _e1056, _e1057);
    let _e1059: f32 = regionMask_2;
    color_7 = mix(_e1047, _e1058, vec3(_e1059));
    let _e1063: vec2<f32> = opticalNormal_1;
    let _e1064: vec2<f32> = lightDirection;
    let _e1071: f32 = borderMask;
    rimLight_1 = (pow(max(dot(_e1063, -(_e1064)), 0f), 2.8f) * _e1071);
    let _e1076: vec2<f32> = panelUv_4;
    let _e1079: f32 = borderMask;
    lowerLip_1 = (smoothstep(0.56f, 1f, _e1076.y) * _e1079);
    let _e1084: vec2<f32> = panelUv_4;
    let _e1088: vec4<f32> = global._data[29];
    let _e1092: vec2<f32> = panelUv_4;
    sweep_1 = smoothstep(0.025f, 0f, abs((_e1084.x - fract(((_e1088.x * 0.055f) + (_e1092.y * 0.28f))))));
    let _e1102: f32 = rimLight_1;
    let _e1105: f32 = lowerLip_1;
    let _e1109: f32 = sweep_1;
    let _e1115: vec4<f32> = global._data[35];
    highlight_1 = ((((_e1102 * 0.82f) + (_e1105 * 0.28f)) + (_e1109 * 0.18f)) * _e1115.x);
    let _e1121: vec4<f32> = global._data[4];
    let _e1123: f32 = rimLight_1;
    let _e1124: f32 = lowerLip_1;
    highlightColor_1 = (_e1121.xyz * (_e1123 + (_e1124 * 0.8f)));
    let _e1130: f32 = borderMask;
    let _e1131: f32 = bevel;
    let _e1135: vec4<f32> = global._data[34];
    absorption_1 = ((_e1130 * _e1131) * clamp(_e1135.x, 0f, 1f));
    let _e1142: vec3<f32> = color_7;
    let _e1143: vec3<f32> = color_7;
    let _e1145: f32 = absorption_1;
    let _e1148: f32 = borderMask;
    color_7 = mix(_e1142, (_e1143 * (1f - _e1145)), vec3(_e1148));
    let _e1151: vec3<f32> = color_7;
    let _e1152: vec3<f32> = highlightColor_1;
    let _e1153: f32 = highlight_1;
    color_7 = (_e1151 + (_e1152 * _e1153));
    let _e1156: vec3<f32> = color_7;
    let _e1157: vec3<f32> = baseColor_2;
    let _e1158: f32 = panelMask_2;
    let _e1159: vec2<f32> = panelUv_4;
    let _e1160: vec2<f32> = edgeNormal_2;
    let _e1161: f32 = depthPx_2;
    let _e1162: f32 = regionMask_2;
    writeOutputColor(_e1156, _e1157, _e1158, _e1159, _e1160, _e1161, _e1162);
    return;
}

@fragment 
fn main(@location(0) vUv: vec2<f32>) -> FragmentOutput {
    vUv_1 = vUv;
    main_1();
    let _e15: vec4<f32> = fragColor;
    return FragmentOutput(_e15);
}
