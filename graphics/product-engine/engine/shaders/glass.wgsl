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

fn sdRoundedBox(p: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
    var p_1: vec2<f32>;
    var b_1: vec2<f32>;
    var r_1: f32;
    var q: vec2<f32>;

    p_1 = p;
    b_1 = b;
    r_1 = r;
    let _e14: vec2<f32> = p_1;
    let _e16: vec2<f32> = b_1;
    let _e18: f32 = r_1;
    q = ((abs(_e14) - _e16) + vec2(_e18));
    let _e22: vec2<f32> = q;
    let _e24: vec2<f32> = q;
    let _e29: vec2<f32> = q;
    let _e35: f32 = r_1;
    return ((min(max(_e22.x, _e24.y), 0f) + length(max(_e29, vec2(0f)))) - _e35);
}

fn sdEllipse(p_2: vec2<f32>, ab: vec2<f32>) -> f32 {
    var p_3: vec2<f32>;
    var ab_1: vec2<f32>;
    var k0_: f32;
    var k1_: f32;

    p_3 = p_2;
    ab_1 = ab;
    let _e12: vec2<f32> = p_3;
    p_3 = abs(_e12);
    let _e14: vec2<f32> = ab_1;
    ab_1 = max(_e14, vec2(0.001f));
    let _e18: vec2<f32> = p_3;
    let _e19: vec2<f32> = ab_1;
    k0_ = length((_e18 / _e19));
    let _e23: vec2<f32> = p_3;
    let _e24: vec2<f32> = ab_1;
    let _e25: vec2<f32> = ab_1;
    k1_ = length((_e23 / (_e24 * _e25)));
    let _e30: f32 = k1_;
    if (_e30 < 0.00001f) {
        let _e33: vec2<f32> = ab_1;
        let _e35: vec2<f32> = ab_1;
        return -(min(_e33.x, _e35.y));
    }
    let _e39: f32 = k0_;
    let _e40: f32 = k0_;
    let _e44: f32 = k1_;
    return ((_e39 * (_e40 - 1f)) / max(_e44, 0.001f));
}

fn sdDiamond(p_4: vec2<f32>, r_2: f32) -> f32 {
    var p_5: vec2<f32>;
    var r_3: f32;

    p_5 = p_4;
    r_3 = r_2;
    let _e12: vec2<f32> = p_5;
    p_5 = abs(_e12);
    let _e14: vec2<f32> = p_5;
    let _e16: vec2<f32> = p_5;
    let _e19: f32 = r_3;
    return (((_e14.x + _e16.y) - _e19) * 0.70710677f);
}

fn sdEquilateralTriangle(p_6: vec2<f32>, r_4: f32) -> f32 {
    var p_7: vec2<f32>;
    var r_5: f32;
    var k: f32 = 1.7320508f;

    p_7 = p_6;
    r_5 = r_4;
    let _e15: vec2<f32> = p_7;
    let _e18: f32 = r_5;
    p_7.x = (abs(_e15.x) - _e18);
    let _e21: vec2<f32> = p_7;
    let _e23: f32 = r_5;
    let _e24: f32 = k;
    p_7.y = (_e21.y + (_e23 / _e24));
    let _e27: vec2<f32> = p_7;
    let _e29: f32 = k;
    let _e30: vec2<f32> = p_7;
    if ((_e27.x + (_e29 * _e30.y)) > 0f) {
        {
            let _e36: vec2<f32> = p_7;
            let _e38: f32 = k;
            let _e39: vec2<f32> = p_7;
            let _e43: f32 = k;
            let _e45: vec2<f32> = p_7;
            let _e48: vec2<f32> = p_7;
            p_7 = (vec2<f32>((_e36.x - (_e38 * _e39.y)), ((-(_e43) * _e45.x) - _e48.y)) / vec2(2f));
        }
    }
    let _e56: vec2<f32> = p_7;
    let _e58: vec2<f32> = p_7;
    let _e62: f32 = r_5;
    p_7.x = (_e56.x - clamp(_e58.x, (-2f * _e62), 0f));
    let _e67: vec2<f32> = p_7;
    let _e70: vec2<f32> = p_7;
    return (-(length(_e67)) * sign(_e70.y));
}

fn sdHexagon(p_8: vec2<f32>, r_6: f32) -> f32 {
    var p_9: vec2<f32>;
    var r_7: f32;
    var k_1: vec3<f32> = vec3<f32>(-0.8660254f, 0.5f, 0.5773503f);

    p_9 = p_8;
    r_7 = r_6;
    let _e18: vec2<f32> = p_9;
    p_9 = abs(_e18);
    let _e20: vec2<f32> = p_9;
    let _e22: vec3<f32> = k_1;
    let _e24: vec2<f32> = p_9;
    let _e29: vec3<f32> = k_1;
    p_9 = (_e20 - ((2f * min(dot(_e22.xy, _e24), 0f)) * _e29.xy));
    let _e33: vec2<f32> = p_9;
    let _e34: vec2<f32> = p_9;
    let _e36: vec3<f32> = k_1;
    let _e39: f32 = r_7;
    let _e41: vec3<f32> = k_1;
    let _e43: f32 = r_7;
    let _e46: f32 = r_7;
    p_9 = (_e33 - vec2<f32>(clamp(_e34.x, (-(_e36.z) * _e39), (_e41.z * _e43)), _e46));
    let _e49: vec2<f32> = p_9;
    let _e51: vec2<f32> = p_9;
    return (length(_e49) * sign(_e51.y));
}

fn stableAngularWarp(p_10: vec2<f32>, seed: f32) -> f32 {
    var p_11: vec2<f32>;
    var seed_1: f32;
    var angle: f32;

    p_11 = p_10;
    seed_1 = seed;
    let _e12: vec2<f32> = p_11;
    let _e14: vec2<f32> = p_11;
    angle = atan2(_e12.y, _e14.x);
    let _e18: f32 = angle;
    let _e21: f32 = seed_1;
    let _e26: f32 = angle;
    let _e29: f32 = seed_1;
    let _e37: f32 = angle;
    let _e40: f32 = seed_1;
    return (((sin(((_e18 * 3f) + _e21)) * 0.52f) + (sin(((_e26 * 5f) - (_e29 * 1.7f))) * 0.28f)) + (sin(((_e37 * 9f) + (_e40 * 0.6f))) * 0.16f));
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
    let _e16: vec2<f32> = direction_1;
    dir = normalize(_e16);
    let _e19: vec2<f32> = p_13;
    let _e20: vec2<f32> = dir;
    let _e22: f32 = scale_1;
    let _e26: f32 = time_1;
    primary = sin((((dot(_e19, _e20) * _e22) * 6.2831855f) + _e26));
    let _e30: vec2<f32> = p_13;
    let _e31: vec2<f32> = dir;
    let _e34: vec2<f32> = dir;
    let _e38: f32 = scale_1;
    let _e42: f32 = time_1;
    secondary = sin((((dot(_e30, vec2<f32>(-(_e31.y), _e34.x)) * _e38) * 4.712389f) - (_e42 * 0.73f)));
    let _e48: f32 = primary;
    let _e49: f32 = secondary;
    return (_e48 + (_e49 * 0.28f));
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
    var c_2: f32;
    var layer: f32;
    var organic: f32;

    p_15 = p_14;
    time_3 = time_2;
    let _e14: vec4<f32> = global._data[59];
    mode = floor((_e14.x + 0.5f));
    let _e22: vec4<f32> = global._data[62];
    scale_2 = clamp(_e22.x, 0.25f, 8f);
    let _e30: vec4<f32> = global._data[60];
    speed = clamp(_e30.x, 0f, 4f);
    let _e38: vec4<f32> = global._data[63];
    turbulence = clamp(_e38.x, 0f, 1f);
    let _e46: vec4<f32> = global._data[65];
    layerMix = clamp(_e46.x, 0f, 1f);
    let _e52: f32 = time_3;
    let _e53: f32 = speed;
    phase = (_e52 * _e53);
    let _e56: f32 = mode;
    if (_e56 < 0.5f) {
        {
            return 0f;
        }
    }
    let _e62: f32 = mode;
    if (_e62 < 1.5f) {
        {
            let _e65: vec2<f32> = p_15;
            let _e70: f32 = phase;
            let _e71: f32 = scale_2;
            let _e72: f32 = directionalFlowPotential(_e65, vec2<f32>(-1f, 0f), _e70, _e71);
            base = _e72;
        }
    } else {
        let _e73: f32 = mode;
        if (_e73 < 2.5f) {
            {
                let _e76: vec2<f32> = p_15;
                let _e80: f32 = phase;
                let _e81: f32 = scale_2;
                let _e82: f32 = directionalFlowPotential(_e76, vec2<f32>(1f, 0f), _e80, _e81);
                base = _e82;
            }
        } else {
            let _e83: f32 = mode;
            if (_e83 < 3.5f) {
                {
                    let _e86: vec2<f32> = p_15;
                    let _e90: f32 = phase;
                    let _e91: f32 = scale_2;
                    let _e92: f32 = directionalFlowPotential(_e86, vec2<f32>(0f, 1f), _e90, _e91);
                    base = _e92;
                }
            } else {
                let _e93: f32 = mode;
                if (_e93 < 4.5f) {
                    {
                        let _e96: vec2<f32> = p_15;
                        let _e101: f32 = phase;
                        let _e102: f32 = scale_2;
                        let _e103: f32 = directionalFlowPotential(_e96, vec2<f32>(0f, -1f), _e101, _e102);
                        base = _e103;
                    }
                } else {
                    let _e104: f32 = mode;
                    if (_e104 < 6.5f) {
                        {
                            let _e107: f32 = mode;
                            if (_e107 < 5.5f) {
                                local_1 = 1f;
                            } else {
                                local_1 = -1f;
                            }
                            let _e114: f32 = local_1;
                            turn = _e114;
                            let _e116: vec2<f32> = p_15;
                            let _e118: vec2<f32> = p_15;
                            angle_1 = atan2(_e116.y, _e118.x);
                            let _e122: vec2<f32> = p_15;
                            radius = length(_e122);
                            let _e125: f32 = angle_1;
                            let _e128: f32 = radius;
                            let _e129: f32 = scale_2;
                            let _e134: f32 = phase;
                            let _e135: f32 = turn;
                            base = sin((((_e125 * 3f) + ((_e128 * _e129) * 5f)) + (_e134 * _e135)));
                        }
                    } else {
                        let _e139: f32 = mode;
                        if (_e139 < 8.5f) {
                            {
                                let _e142: f32 = mode;
                                if (_e142 < 7.5f) {
                                    local_2 = -1f;
                                } else {
                                    local_2 = 1f;
                                }
                                let _e149: f32 = local_2;
                                sourceSign = _e149;
                                let _e151: vec2<f32> = p_15;
                                let _e153: f32 = scale_2;
                                let _e157: f32 = phase;
                                let _e158: f32 = sourceSign;
                                base = sin((((length(_e151) * _e153) * 7f) + (_e157 * _e158)));
                            }
                        } else {
                            let _e162: f32 = mode;
                            if (_e162 < 9.5f) {
                                {
                                    let _e165: vec2<f32> = p_15;
                                    let _e167: f32 = scale_2;
                                    let _e171: f32 = phase;
                                    a = sin((((_e165.x * _e167) * 4.1f) + _e171));
                                    let _e175: vec2<f32> = p_15;
                                    let _e177: f32 = scale_2;
                                    let _e181: f32 = phase;
                                    b_2 = sin((((_e175.y * _e177) * 5.3f) - (_e181 * 0.82f)));
                                    let _e187: vec2<f32> = p_15;
                                    let _e189: vec2<f32> = p_15;
                                    let _e192: f32 = scale_2;
                                    let _e196: f32 = phase;
                                    c_2 = sin(((((_e187.x - _e189.y) * _e192) * 3.7f) + (_e196 * 0.41f)));
                                    let _e202: f32 = a;
                                    let _e205: f32 = b_2;
                                    let _e209: f32 = c_2;
                                    base = (((_e202 * 0.46f) + (_e205 * 0.36f)) + (_e209 * 0.28f));
                                }
                            } else {
                                let _e213: f32 = mode;
                                if (_e213 < 10.5f) {
                                    {
                                        let _e216: vec2<f32> = p_15;
                                        let _e218: vec2<f32> = p_15;
                                        let _e223: f32 = scale_2;
                                        let _e227: f32 = phase;
                                        let _e230: vec2<f32> = p_15;
                                        let _e232: f32 = scale_2;
                                        let _e236: f32 = phase;
                                        base = (sin(((((_e216.x + (_e218.y * 0.36f)) * _e223) * 6f) + _e227)) + (sin((((_e230.y * _e232) * 3.2f) - (_e236 * 0.5f))) * 0.35f));
                                    }
                                } else {
                                    {
                                        let _e244: vec2<f32> = p_15;
                                        let _e246: f32 = scale_2;
                                        let _e251: f32 = phase;
                                        let _e254: vec2<f32> = p_15;
                                        let _e256: f32 = scale_2;
                                        let _e260: f32 = phase;
                                        base = ((sin(((_e244.x * _e246) * 5.2f)) * sin(_e251)) + (sin((((_e254.y * _e256) * 3.6f) + (_e260 * 0.25f))) * 0.25f));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    let _e268: vec2<f32> = p_15;
    let _e274: f32 = scale_2;
    let _e278: f32 = phase;
    let _e283: vec2<f32> = p_15;
    let _e289: f32 = scale_2;
    let _e293: f32 = phase;
    layer = (sin((((dot(_e268, vec2<f32>(0.73f, -0.61f)) * _e274) * 8.4f) - (_e278 * 1.37f))) + (sin((((dot(_e283, vec2<f32>(-0.31f, 0.92f)) * _e289) * 6.2f) + (_e293 * 0.67f))) * 0.42f));
    let _e302: vec2<f32> = p_15;
    let _e303: f32 = phase;
    let _e307: f32 = phase;
    let _e316: f32 = stableAngularWarp((_e302 + (vec2<f32>(sin((_e303 * 0.17f)), cos((_e307 * 0.13f))) * 0.08f)), 3.7f);
    organic = _e316;
    let _e318: f32 = base;
    let _e319: f32 = layer;
    let _e320: f32 = layerMix;
    let _e324: f32 = organic;
    let _e325: f32 = turbulence;
    return (mix(_e318, _e319, (_e320 * 0.72f)) + ((_e324 * _e325) * 0.36f));
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
    let _e14: vec4<f32> = global._data[59];
    mode_1 = floor((_e14.x + 0.5f));
    let _e22: vec4<f32> = global._data[58];
    let _e26: f32 = mode_1;
    let _e32: vec4<f32> = global._data[61];
    if (((_e22.x < 0.5f) || (_e26 < 0.5f)) || (_e32.x <= 0f)) {
        {
            return vec2(0f);
        }
    }
    let _e43: vec2<f32> = p_17;
    let _e44: vec2<f32> = eps;
    let _e47: f32 = time_5;
    let _e48: f32 = flowPotential((_e43 + _e44.xy), _e47);
    let _e49: vec2<f32> = p_17;
    let _e50: vec2<f32> = eps;
    let _e53: f32 = time_5;
    let _e54: f32 = flowPotential((_e49 - _e50.xy), _e53);
    dX = (_e48 - _e54);
    let _e57: vec2<f32> = p_17;
    let _e58: vec2<f32> = eps;
    let _e61: f32 = time_5;
    let _e62: f32 = flowPotential((_e57 + _e58.yx), _e61);
    let _e63: vec2<f32> = p_17;
    let _e64: vec2<f32> = eps;
    let _e67: f32 = time_5;
    let _e68: f32 = flowPotential((_e63 - _e64.yx), _e67);
    dY = (_e62 - _e68);
    let _e71: f32 = dX;
    let _e72: f32 = dY;
    let _e74: vec2<f32> = eps;
    grad = (vec2<f32>(_e71, _e72) / vec2((_e74.x * 2f)));
    let _e81: f32 = mode_1;
    let _e84: f32 = mode_1;
    if ((_e81 > 4.5f) && (_e84 < 6.5f)) {
        {
            let _e88: f32 = mode_1;
            if (_e88 < 5.5f) {
                local_3 = 1f;
            } else {
                local_3 = -1f;
            }
            let _e95: f32 = local_3;
            turn_1 = _e95;
            let _e97: vec2<f32> = grad;
            let _e100: vec2<f32> = grad;
            let _e103: f32 = turn_1;
            grad = (vec2<f32>(-(_e97.y), _e100.x) * _e103);
        }
    } else {
        let _e105: f32 = mode_1;
        let _e108: f32 = mode_1;
        if ((_e105 > 8.5f) && (_e108 < 9.5f)) {
            {
                let _e112: vec2<f32> = grad;
                let _e115: vec2<f32> = grad;
                grad = vec2<f32>(-(_e112.y), _e115.x);
            }
        }
    }
    let _e118: vec2<f32> = grad;
    return (_e118 * 0.055f);
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
    let _e16: vec4<f32> = global._data[61];
    strength = clamp(_e16.x, 0f, 1.5f);
    let _e24: vec4<f32> = global._data[64];
    boundaryDamping = clamp(_e24.x, 0f, 1f);
    let _e30: f32 = opticalMask_1;
    mask = clamp(_e30, 0f, 1f);
    let _e35: f32 = mask;
    let _e39: f32 = mask;
    let _e41: f32 = boundaryDamping;
    dampedMask = (_e35 * mix(1f, smoothstep(0f, 1f, _e39), _e41));
    let _e45: vec2<f32> = baseNormal_1;
    let _e46: vec2<f32> = p_19;
    let _e49: vec4<f32> = global._data[33];
    let _e51: vec2<f32> = flowGradient(_e46, _e49.x);
    let _e52: f32 = strength;
    let _e54: f32 = dampedMask;
    flowNormal = (_e45 + ((_e51 * _e52) * _e54));
    let _e58: vec2<f32> = flowNormal;
    if (length(_e58) > 0.00001f) {
        let _e62: vec2<f32> = flowNormal;
        local_4 = normalize(_e62);
    } else {
        let _e64: vec2<f32> = baseNormal_1;
        local_4 = _e64;
    }
    let _e66: vec2<f32> = local_4;
    return _e66;
}

fn shapeDistance(p_20: vec2<f32>, innerSize: vec2<f32>, radius_1: f32) -> f32 {
    var p_21: vec2<f32>;
    var innerSize_1: vec2<f32>;
    var radius_2: f32;
    var uv_6: vec2<f32>;
    var encodedContour: vec2<f32>;
    var distance_: f32;
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
    let _e16: vec4<f32> = global._data[0];
    if (_e16.x > 0.5f) {
        {
            let _e20: vec2<f32> = p_21;
            let _e24: vec4<f32> = global._data[1];
            let _e30: vec2<f32> = p_21;
            uv_6 = vec2<f32>(((_e20.x / _e24.x) + 0.5f), (0.5f - _e30.y));
            let _e35: vec2<f32> = uv_6;
            let _e36: vec4<f32> = readContour(_e35);
            encodedContour = _e36.xy;
            let _e39: vec2<f32> = encodedContour;
            distance_ = (((dot(_e39, vec2<f32>(65280f, 255f)) / 65535f) * 2f) - 1f);
            let _e51: f32 = distance_;
            let _e54: vec2<f32> = innerSize_1;
            return (_e51 + max(0f, (0.5f - _e54.y)));
        }
    }
    let _e61: vec4<f32> = global._data[56];
    shapeType = floor((_e61.x + 0.5f));
    let _e69: vec4<f32> = global._data[57];
    warp = clamp(_e69.x, 0f, 1f);
    let _e76: vec2<f32> = innerSize_1;
    let _e78: vec2<f32> = innerSize_1;
    baseRadius = max(0.001f, min(_e76.x, _e78.y));
    let _e83: f32 = baseRadius;
    let _e86: f32 = warp;
    warpScale = ((_e83 * 0.105f) * _e86);
    let _e89: f32 = shapeType;
    if (_e89 > 11.5f) {
        {
            let _e92: vec2<f32> = p_21;
            let _e93: vec2<f32> = innerSize_1;
            let _e95: f32 = sdRoundedBox(_e92, _e93, 0f);
            shapeD = _e95;
            let _e97: f32 = baseRadius;
            let _e102: vec4<f32> = global._data[15];
            cuts = ((_e97 * 2f) * clamp(_e102.xyzw, vec4(0f), vec4(0.45f)));
            let _e111: vec2<f32> = innerSize_1;
            let _e113: vec2<f32> = innerSize_1;
            let _e117: vec4<f32> = cuts;
            limits = (vec4((_e111.x + _e113.y)) - _e117);
            let _e122: vec4<f32> = global._data[14];
            if (_e122.x > 0.5f) {
                let _e127: f32 = shapeD;
                let _e128: vec2<f32> = p_21;
                let _e131: vec2<f32> = p_21;
                let _e134: vec4<f32> = limits;
                shapeD = max(_e127, (((-(_e128.x) + _e131.y) - _e134.x) * 0.70710677f));
            }
            let _e142: vec4<f32> = global._data[14];
            if (_e142.y > 0.5f) {
                let _e147: f32 = shapeD;
                let _e148: vec2<f32> = p_21;
                let _e150: vec2<f32> = p_21;
                let _e153: vec4<f32> = limits;
                shapeD = max(_e147, (((_e148.x + _e150.y) - _e153.y) * 0.70710677f));
            }
            let _e161: vec4<f32> = global._data[14];
            if (_e161.z > 0.5f) {
                let _e166: f32 = shapeD;
                let _e167: vec2<f32> = p_21;
                let _e169: vec2<f32> = p_21;
                let _e172: vec4<f32> = limits;
                shapeD = max(_e166, (((_e167.x - _e169.y) - _e172.z) * 0.70710677f));
            }
            let _e180: vec4<f32> = global._data[14];
            if (_e180.w > 0.5f) {
                let _e185: f32 = shapeD;
                let _e186: vec2<f32> = p_21;
                let _e189: vec2<f32> = p_21;
                let _e192: vec4<f32> = limits;
                shapeD = max(_e185, (((-(_e186.x) - _e189.y) - _e192.w) * 0.70710677f));
            }
            let _e198: f32 = shapeD;
            return _e198;
        }
    }
    let _e199: f32 = shapeType;
    if (_e199 > 10.5f) {
        {
            let _e202: vec2<f32> = p_21;
            let _e203: f32 = baseRadius;
            let _e206: f32 = sdRoundedBox(_e202, vec2(_e203), 0f);
            return _e206;
        }
    }
    let _e207: f32 = shapeType;
    if (_e207 < 0.5f) {
        {
            let _e210: vec2<f32> = p_21;
            let _e211: vec2<f32> = innerSize_1;
            let _e212: f32 = radius_2;
            let _e213: f32 = sdRoundedBox(_e210, _e211, _e212);
            return _e213;
        }
    }
    let _e214: f32 = shapeType;
    if (_e214 < 1.5f) {
        {
            let _e217: vec2<f32> = p_21;
            let _e219: f32 = baseRadius;
            return (length(_e217) - _e219);
        }
    }
    let _e221: f32 = shapeType;
    if (_e221 < 2.5f) {
        {
            let _e224: vec2<f32> = p_21;
            let _e225: vec2<f32> = innerSize_1;
            let _e226: f32 = sdEllipse(_e224, _e225);
            return _e226;
        }
    }
    let _e227: f32 = shapeType;
    if (_e227 < 3.5f) {
        {
            let _e230: vec2<f32> = p_21;
            let _e231: f32 = baseRadius;
            let _e234: f32 = sdDiamond(_e230, (_e231 * 1.28f));
            return _e234;
        }
    }
    let _e235: f32 = shapeType;
    if (_e235 < 4.5f) {
        {
            let _e238: vec2<f32> = p_21;
            let _e240: f32 = baseRadius;
            let _e245: f32 = baseRadius;
            let _e248: f32 = sdEquilateralTriangle((_e238 + vec2<f32>(0f, (_e240 * 0.12f))), (_e245 * 1.2f));
            return _e248;
        }
    }
    let _e249: f32 = shapeType;
    if (_e249 < 5.5f) {
        {
            let _e252: vec2<f32> = p_21;
            let _e253: f32 = baseRadius;
            let _e256: f32 = sdHexagon(_e252, (_e253 * 1.02f));
            return _e256;
        }
    }
    let _e257: f32 = shapeType;
    if (_e257 < 6.5f) {
        {
            let _e260: vec2<f32> = p_21;
            let _e261: vec2<f32> = innerSize_1;
            let _e266: f32 = sdEllipse(_e260, (_e261 * vec2<f32>(0.92f, 0.96f)));
            let _e267: vec2<f32> = p_21;
            let _e269: f32 = stableAngularWarp(_e267, 0.4f);
            let _e270: f32 = warpScale;
            return (_e266 + (_e269 * _e270));
        }
    }
    let _e273: f32 = shapeType;
    if (_e273 < 7.5f) {
        {
            let _e276: vec2<f32> = p_21;
            let _e277: vec2<f32> = innerSize_1;
            let _e281: vec2<f32> = innerSize_1;
            let _e286: vec2<f32> = innerSize_1;
            let _e290: f32 = sdRoundedBox(_e276, vec2<f32>((_e277.x * 0.88f), (_e281.y * 0.56f)), (_e286.y * 0.46f));
            capsule = _e290;
            let _e292: vec2<f32> = p_21;
            let _e296: vec2<f32> = p_21;
            let _e305: f32 = warpScale;
            wave = ((sin(((_e292.x * 12f) + (sin((_e296.y * 3f)) * 0.8f))) * _e305) * 1.05f);
            let _e310: f32 = capsule;
            let _e311: f32 = wave;
            return (_e310 + _e311);
        }
    }
    let _e313: f32 = shapeType;
    if (_e313 < 8.5f) {
        {
            let _e316: vec2<f32> = p_21;
            let _e317: vec2<f32> = innerSize_1;
            let _e323: f32 = radius_2;
            let _e327: f32 = sdRoundedBox(_e316, (_e317 * vec2<f32>(0.96f, 0.9f)), max(0f, (_e323 * 0.45f)));
            chipped = _e327;
            let _e329: vec2<f32> = p_21;
            let _e331: f32 = stableAngularWarp(_e329, 2.15f);
            let _e332: f32 = warpScale;
            chip = ((_e331 * _e332) * 1.25f);
            let _e337: f32 = chipped;
            let _e338: f32 = chip;
            let _e339: f32 = warpScale;
            let _e346: f32 = warpScale;
            return (_e337 + ((floor((_e338 / max((_e339 * 0.32f), 0.001f))) * _e346) * 0.32f));
        }
    }
    let _e351: f32 = shapeType;
    if (_e351 < 9.5f) {
        {
            let _e354: vec2<f32> = p_21;
            let _e356: vec2<f32> = p_21;
            angle_2 = atan2(_e354.y, _e356.x);
            let _e360: f32 = angle_2;
            let _e364: f32 = warpScale;
            petal = ((cos((_e360 * 2f)) * _e364) * 1.45f);
            let _e369: vec2<f32> = p_21;
            let _e370: vec2<f32> = innerSize_1;
            let _e375: f32 = sdEllipse(_e369, (_e370 * vec2<f32>(0.78f, 1.02f)));
            let _e376: f32 = petal;
            return (_e375 - _e376);
        }
    }
    let _e378: vec2<f32> = p_21;
    let _e379: vec2<f32> = innerSize_1;
    let _e384: f32 = sdEllipse(_e378, (_e379 * vec2<f32>(0.9f, 0.98f)));
    let _e385: vec2<f32> = p_21;
    let _e387: f32 = stableAngularWarp(_e385, 4.2f);
    let _e388: f32 = warpScale;
    return (_e384 + ((_e387 * _e388) * 1.35f));
}

fn coverUv(uv_7: vec2<f32>) -> vec2<f32> {
    var uv_8: vec2<f32>;
    var canvasAspect: f32;
    var sourceAspect: f32;
    var scale_3: vec2<f32> = vec2(1f);

    uv_8 = uv_7;
    let _e12: vec4<f32> = global._data[29];
    let _e17: vec4<f32> = global._data[29];
    canvasAspect = (_e12.x / max(_e17.y, 1f));
    let _e26: vec4<f32> = global._data[32];
    sourceAspect = max(_e26.x, 0.01f);
    let _e34: f32 = canvasAspect;
    let _e35: f32 = sourceAspect;
    if (_e34 > _e35) {
        {
            let _e38: f32 = sourceAspect;
            let _e39: f32 = canvasAspect;
            scale_3.y = (_e38 / _e39);
        }
    } else {
        {
            let _e42: f32 = canvasAspect;
            let _e43: f32 = sourceAspect;
            scale_3.x = (_e42 / _e43);
        }
    }
    let _e45: vec2<f32> = uv_8;
    let _e49: vec2<f32> = scale_3;
    return (((_e45 - vec2(0.5f)) * _e49) + vec2(0.5f));
}

fn sampleSource(uv_9: vec2<f32>) -> vec3<f32> {
    var uv_10: vec2<f32>;
    var texel: vec4<f32>;

    uv_10 = uv_9;
    let _e10: vec2<f32> = uv_10;
    let _e11: vec2<f32> = coverUv(_e10);
    let _e17: vec4<f32> = readSource(clamp(_e11, vec2(0.001f), vec2(0.999f)));
    texel = _e17;
    let _e21: vec4<f32> = global._data[28];
    if (_e21.x > 0.5f) {
        {
            let _e25: vec4<f32> = texel;
            let _e26: vec4<f32> = sRGBTransferEOTF(_e25);
            return _e26.xyz;
        }
    }
    let _e28: vec4<f32> = texel;
    return _e28.xyz;
}

fn sampleGlassSource(uv_11: vec2<f32>, blurAmount: f32) -> vec3<f32> {
    var uv_12: vec2<f32>;
    var blurAmount_1: f32;
    var blurred: vec3<f32>;

    uv_12 = uv_11;
    blurAmount_1 = blurAmount;
    let _e14: vec4<f32> = global._data[3];
    let _e18: f32 = blurAmount_1;
    if ((_e14.x > 0.5f) && (_e18 > 0.001f)) {
        {
            let _e22: vec2<f32> = uv_12;
            let _e28: vec4<f32> = readBlur(clamp(_e22, vec2(0f), vec2(1f)));
            blurred = _e28.xyz;
            let _e31: f32 = blurAmount_1;
            if (_e31 >= 0.999f) {
                let _e34: vec3<f32> = blurred;
                return _e34;
            }
            let _e35: vec2<f32> = uv_12;
            let _e36: vec3<f32> = sampleSource(_e35);
            let _e37: vec3<f32> = blurred;
            let _e38: f32 = blurAmount_1;
            return mix(_e36, _e37, vec3(_e38));
        }
    }
    let _e41: vec2<f32> = uv_12;
    let _e42: vec3<f32> = sampleSource(_e41);
    return _e42;
}

fn sampleDispersedSource(uv_13: vec2<f32>, refractOffset: vec2<f32>, chroma: f32, blurAmount_2: f32) -> vec3<f32> {
    var uv_14: vec2<f32>;
    var refractOffset_1: vec2<f32>;
    var chroma_1: f32;
    var blurAmount_3: f32;
    var centerUv: vec2<f32>;
    var bendPixels: f32;
    var blurSupport: f32;
    var spreadPixels: f32;
    var spreadUv: vec2<f32>;
    var color: vec3<f32> = vec3(0f);

    uv_14 = uv_13;
    refractOffset_1 = refractOffset;
    chroma_1 = chroma;
    blurAmount_3 = blurAmount_2;
    let _e16: vec2<f32> = uv_14;
    let _e17: vec2<f32> = refractOffset_1;
    centerUv = (_e16 + _e17);
    let _e20: vec2<f32> = refractOffset_1;
    let _e23: vec4<f32> = global._data[29];
    let _e28: vec4<f32> = global._data[5];
    bendPixels = length(((_e20 * _e23.xy) / vec2(max(_e28.x, 0.01f))));
    let _e38: vec4<f32> = global._data[4];
    let _e42: f32 = blurAmount_3;
    let _e46: vec4<f32> = global._data[3];
    let _e53: f32 = bendPixels;
    blurSupport = ((((max(_e38.x, 0f) * _e42) * _e46.x) * 0.5f) * smoothstep(0f, 2f, _e53));
    let _e58: f32 = bendPixels;
    let _e61: f32 = blurSupport;
    let _e64: f32 = chroma_1;
    spreadPixels = (min(48f, ((_e58 * 0.85f) + _e61)) * clamp(_e64, 0f, 1f));
    let _e70: f32 = spreadPixels;
    if (_e70 < 0.01f) {
        {
            let _e73: vec2<f32> = centerUv;
            let _e74: f32 = blurAmount_3;
            let _e75: vec3<f32> = sampleGlassSource(_e73, _e74);
            return _e75;
        }
    }
    let _e76: vec2<f32> = refractOffset_1;
    let _e77: f32 = spreadPixels;
    let _e78: f32 = bendPixels;
    spreadUv = (_e76 * (_e77 / max(_e78, 0.00001f)));
    let _e87: vec3<f32> = color;
    let _e88: vec2<f32> = centerUv;
    let _e89: vec2<f32> = spreadUv;
    let _e93: f32 = blurAmount_3;
    let _e94: vec3<f32> = sampleGlassSource((_e88 + (_e89 * 1f)), _e93);
    color = (_e87 + (_e94 * vec3<f32>(0.003970617f, 0.028517168f, 0.32453805f)));
    let _e101: vec3<f32> = color;
    let _e102: vec2<f32> = centerUv;
    let _e103: vec2<f32> = spreadUv;
    let _e107: f32 = blurAmount_3;
    let _e108: vec3<f32> = sampleGlassSource((_e102 + (_e103 * 0.58079654f)), _e107);
    color = (_e101 + (_e108 * vec3<f32>(0.01985367f, 0.12036229f, 0.39541414f)));
    let _e115: vec3<f32> = color;
    let _e116: vec2<f32> = centerUv;
    let _e117: vec2<f32> = spreadUv;
    let _e121: f32 = blurAmount_3;
    let _e122: vec3<f32> = sampleGlassSource((_e116 + (_e117 * 0.25630382f)), _e121);
    color = (_e115 + (_e122 * vec3<f32>(0.06797624f, 0.2678712f, 0.21862131f)));
    let _e129: vec3<f32> = color;
    let _e130: vec2<f32> = centerUv;
    let _e131: vec2<f32> = spreadUv;
    let _e135: f32 = blurAmount_3;
    let _e136: vec3<f32> = sampleGlassSource((_e130 + (_e131 * 0f)), _e135);
    color = (_e129 + (_e136 * vec3<f32>(0.1593701f, 0.31434977f, 0.054851253f)));
    let _e143: vec3<f32> = color;
    let _e144: vec2<f32> = centerUv;
    let _e145: vec2<f32> = spreadUv;
    let _e150: f32 = blurAmount_3;
    let _e151: vec3<f32> = sampleGlassSource((_e144 + (_e145 * -0.20596357f)), _e150);
    color = (_e143 + (_e151 * vec3<f32>(0.25585273f, 0.19451442f, 0.006245027f)));
    let _e158: vec3<f32> = color;
    let _e159: vec2<f32> = centerUv;
    let _e160: vec2<f32> = spreadUv;
    let _e165: f32 = blurAmount_3;
    let _e166: vec3<f32> = sampleGlassSource((_e159 + (_e160 * -0.373956f)), _e165);
    color = (_e158 + (_e166 * vec3<f32>(0.28125915f, 0.063466124f, 0.000322653f)));
    let _e173: vec3<f32> = color;
    let _e174: vec2<f32> = centerUv;
    let _e175: vec2<f32> = spreadUv;
    let _e180: f32 = blurAmount_3;
    let _e181: vec3<f32> = sampleGlassSource((_e174 + (_e175 * -0.51276815f)), _e180);
    color = (_e173 + (_e181 * vec3<f32>(0.2117175f, 0.010919021f, 0.000007565f)));
    let _e188: vec3<f32> = color;
    return _e188;
}

fn glassLensSlope(p_22: vec2<f32>, halfSize: vec2<f32>) -> vec2<f32> {
    var p_23: vec2<f32>;
    var halfSize_1: vec2<f32>;
    var circular: bool;
    var square: bool;
    var q_1: vec2<f32>;

    p_23 = p_22;
    halfSize_1 = halfSize;
    let _e14: vec4<f32> = global._data[56];
    let _e20: vec4<f32> = global._data[56];
    circular = ((_e14.x > 0.5f) && (_e20.x < 1.5f));
    let _e28: vec4<f32> = global._data[56];
    let _e34: vec4<f32> = global._data[56];
    square = ((_e28.x > 10.5f) && (_e34.x < 11.5f));
    let _e40: bool = circular;
    let _e41: bool = square;
    if (_e40 || _e41) {
        let _e43: vec2<f32> = halfSize_1;
        let _e45: vec2<f32> = halfSize_1;
        halfSize_1 = vec2(min(_e43.x, _e45.y));
    }
    let _e49: vec2<f32> = p_23;
    let _e50: vec2<f32> = halfSize_1;
    q_1 = (_e49 / max(_e50, vec2(0.001f)));
    let _e58: vec4<f32> = global._data[56];
    let _e64: vec4<f32> = global._data[56];
    if ((_e58.x > 0.5f) && (_e64.x < 2.5f)) {
        {
            let _e69: vec2<f32> = q_1;
            let _e72: vec2<f32> = q_1;
            let _e73: vec2<f32> = q_1;
            return (_e69 * (0.6f + (0.85f * dot(_e72, _e73))));
        }
    }
    let _e78: vec2<f32> = q_1;
    let _e81: vec2<f32> = q_1;
    let _e83: vec2<f32> = q_1;
    return (_e78 * (vec2(0.6f) + ((0.85f * _e81) * _e83)));
}

fn applyColorGrade(color_1: vec3<f32>) -> vec3<f32> {
    var color_2: vec3<f32>;
    var luma: f32;
    var temperature: f32;
    var tint: f32;

    color_2 = color_1;
    let _e10: vec3<f32> = color_2;
    color_2 = max(_e10, vec3(0f));
    let _e14: vec3<f32> = color_2;
    let _e17: vec4<f32> = global._data[40];
    color_2 = (_e14 * exp2(clamp(_e17.x, -2f, 2f)));
    let _e25: vec3<f32> = color_2;
    let _e28: vec4<f32> = global._data[41];
    color_2 = (_e25 + vec3(clamp(_e28.x, -0.25f, 0.25f)));
    let _e36: vec3<f32> = color_2;
    let _e42: vec4<f32> = global._data[42];
    color_2 = (((_e36 - vec3(0.5f)) * clamp(_e42.x, 0f, 2f)) + vec3(0.5f));
    let _e51: vec3<f32> = color_2;
    luma = dot(_e51, vec3<f32>(0.2126f, 0.7152f, 0.0722f));
    let _e58: f32 = luma;
    let _e60: vec3<f32> = color_2;
    let _e63: vec4<f32> = global._data[43];
    color_2 = mix(vec3(_e58), _e60, vec3(clamp(_e63.x, 0f, 2f)));
    let _e72: vec4<f32> = global._data[44];
    temperature = clamp(_e72.x, -1f, 1f);
    let _e81: vec4<f32> = global._data[45];
    tint = clamp(_e81.x, -1f, 1f);
    let _e88: vec3<f32> = color_2;
    let _e89: f32 = temperature;
    let _e92: f32 = tint;
    let _e95: f32 = temperature;
    color_2 = (_e88 + vec3<f32>((_e89 * 0.055f), (_e92 * 0.045f), (-(_e95) * 0.055f)));
    let _e101: vec3<f32> = color_2;
    color_2 = max(_e101, vec3(0f));
    let _e105: vec3<f32> = color_2;
    let _e109: vec4<f32> = global._data[46];
    color_2 = pow(_e105, vec3((1f / clamp(_e109.x, 0.4f, 2.4f))));
    let _e117: vec3<f32> = color_2;
    return clamp(_e117, vec3(0f), vec3(1f));
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
    let _e14: vec4<f32> = global._data[24];
    progress = _e14.z;
    let _e18: f32 = progress;
    let _e21: f32 = progress;
    if ((_e18 >= 1f) || (_e21 <= 0f)) {
        return 0f;
    }
    let _e28: vec4<f32> = global._data[24];
    cell = _e28.w;
    let _e32: vec2<f32> = panelUv_1;
    let _e35: vec2<f32> = panelUv_1;
    let _e39: vec2<f32> = panelPixels_1;
    point = (vec2<f32>(_e32.x, (1f - _e35.y)) * _e39);
    let _e42: vec2<f32> = point;
    let _e43: f32 = cell;
    index = floor((_e42 / vec2(_e43)));
    let _e48: vec2<f32> = index;
    let _e52: f32 = cell;
    center = ((_e48 + vec2(0.5f)) * _e52);
    let _e57: vec4<f32> = global._data[24];
    origin = _e57.xy;
    let _e61: vec2<f32> = origin;
    let _e62: vec2<f32> = panelPixels_1;
    let _e63: vec2<f32> = origin;
    let _e67: f32 = cell;
    reach = (length(max(_e61, (_e62 - _e63))) + (_e67 * 2f));
    let _e72: f32 = cell;
    let _e76: f32 = reach;
    let _e77: f32 = cell;
    let _e81: f32 = progress;
    radius_3 = mix((-(_e72) * 2f), (_e76 + (_e77 * 2f)), _e81);
    let _e84: vec2<f32> = index;
    let _e88: vec2<f32> = index;
    let _e92: f32 = ((_e84.x * 17f) + (_e88.y * 31f));
    let _e100: f32 = cell;
    stagger = ((((_e92 - (floor((_e92 / 13f)) * 13f)) / 13f) * _e100) * 0.35f);
    let _e105: f32 = radius_3;
    let _e106: vec2<f32> = center;
    let _e107: vec2<f32> = origin;
    let _e111: f32 = stagger;
    age = ((_e105 - length((_e106 - _e107))) - _e111);
    let _e115: f32 = cell;
    let _e119: vec4<f32> = global._data[25];
    band = max(3f, (_e115 * (0.35f + (_e119.x * 1.8f))));
    let _e130: f32 = progress;
    let _e135: f32 = progress;
    envelope = (smoothstep(0f, 0.08f, _e130) * (1f - smoothstep(0.85f, 1f, _e135)));
    let _e140: vec2<f32> = point;
    let _e142: vec2<f32> = center;
    let _e146: vec2<f32> = point;
    let _e148: vec2<f32> = center;
    edge = max(abs((_e140.x - _e142.x)), abs((_e146.y - _e148.y)));
    let _e155: f32 = cell;
    let _e158: f32 = cell;
    let _e161: f32 = edge;
    coverage = (1f - smoothstep((_e155 * 0.42f), (_e158 * 0.5f), _e161));
    let _e167: f32 = age;
    let _e168: f32 = band;
    let _e174: f32 = envelope;
    let _e176: f32 = coverage;
    let _e180: vec4<f32> = global._data[25];
    return (((exp((-0.5f * pow((_e167 / _e168), 2f))) * _e174) * _e176) * _e180.y);
}

fn writeOutputColor(color_3: vec3<f32>, baseColor: vec3<f32>, panelMask: f32, panelUv_2: vec2<f32>, edgeNormal: vec2<f32>, depthPx: f32, regionMask: f32) {
    var color_4: vec3<f32>;
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
    var local_6: f32;
    var alpha: f32;

    color_4 = color_3;
    baseColor_1 = baseColor;
    panelMask_1 = panelMask;
    panelUv_3 = panelUv_2;
    edgeNormal_1 = edgeNormal;
    depthPx_1 = depthPx;
    regionMask_1 = regionMask;
    let _e29: vec4<f32> = global._data[8];
    if (_e29.x > 0.5f) {
        {
            let _e34: vec2<f32> = edgeNormal_1;
            let _e37: vec4<f32> = global._data[20];
            facing = dot(_e34, normalize((_e37.xy + vec2(0.0001f))));
            let _e49: vec4<f32> = global._data[10];
            highlightSpread = mix(12f, 1.2f, clamp(_e49.x, 0f, 1f));
            let _e56: f32 = facing;
            let _e59: f32 = highlightSpread;
            directional = pow(max(_e56, 0f), _e59);
            let _e62: f32 = depthPx_1;
            let _e66: vec4<f32> = global._data[19];
            let _e78: vec4<f32> = global._data[19];
            let _e84: f32 = depthPx_1;
            edgeBand = (exp((-(_e62) / max(_e66.z, 0.25f))) * (1f - smoothstep(0f, max(3f, (_e78.z * 3f)), _e84)));
            let _e89: f32 = directional;
            let _e90: f32 = edgeBand;
            let _e96: vec4<f32> = global._data[19];
            let _e100: f32 = regionMask_1;
            light = ((((_e89 * _e90) * 0.83f) * _e96.y) * _e100);
            let _e103: f32 = facing;
            let _e109: f32 = edgeBand;
            let _e113: vec4<f32> = global._data[19];
            let _e117: f32 = regionMask_1;
            shade = ((((pow(max(-(_e103), 0f), 2f) * _e109) * _e113.y) * _e117) * 0.12f);
            let _e122: vec3<f32> = color_4;
            let _e124: f32 = shade;
            let _e129: vec4<f32> = global._data[7];
            let _e131: f32 = light;
            color_4 = ((_e122 * (1f - _e124)) + (_e129.xyz * _e131));
        }
    } else {
        let _e136: vec4<f32> = global._data[19];
        if (_e136.x > 0.5f) {
            {
                let _e141: f32 = depthPx_1;
                let _e147: vec4<f32> = global._data[19];
                edgeBand_1 = exp((-(max(_e141, 0f)) / max(_e147.z, 0.25f)));
                let _e157: vec4<f32> = global._data[20];
                direction_2 = normalize((_e157.xy + vec2(0.0001f)));
                let _e164: vec2<f32> = edgeNormal_1;
                let _e165: vec2<f32> = direction_2;
                facing_1 = dot(_e164, _e165);
                let _e168: f32 = facing_1;
                let _e173: f32 = edgeBand_1;
                let _e177: vec4<f32> = global._data[19];
                let _e181: f32 = regionMask_1;
                light_1 = (((pow(max(_e168, 0f), 2.5f) * _e173) * _e177.y) * _e181);
                let _e184: f32 = facing_1;
                let _e190: f32 = edgeBand_1;
                let _e194: vec4<f32> = global._data[19];
                let _e198: f32 = regionMask_1;
                shade_1 = ((((pow(max(-(_e184), 0f), 1.5f) * _e190) * _e194.y) * _e198) * 0.24f);
                let _e203: vec3<f32> = color_4;
                let _e205: f32 = shade_1;
                let _e210: vec4<f32> = global._data[7];
                let _e212: f32 = light_1;
                color_4 = ((_e203 * (1f - _e205)) + (_e210.xyz * _e212));
            }
        }
    }
    let _e221: vec4<f32> = global._data[21];
    if (_e221.x < 1f) {
        {
            let _e227: vec2<f32> = panelUv_3;
            coordinate = (1f - _e227.y);
            let _e233: vec4<f32> = global._data[21];
            let _e240: vec4<f32> = global._data[21];
            if ((_e233.z > 0.5f) && (_e240.z < 1.5f)) {
                let _e246: vec2<f32> = panelUv_3;
                coordinate = _e246.y;
            }
            let _e250: vec4<f32> = global._data[21];
            let _e257: vec4<f32> = global._data[21];
            if ((_e250.z > 1.5f) && (_e257.z < 2.5f)) {
                let _e263: vec2<f32> = panelUv_3;
                coordinate = _e263.x;
            }
            let _e267: vec4<f32> = global._data[21];
            if (_e267.z > 2.5f) {
                let _e273: vec2<f32> = panelUv_3;
                coordinate = (1f - _e273.x);
            }
            let _e278: vec4<f32> = global._data[21];
            softness = max(_e278.y, 0.001f);
            let _e284: f32 = softness;
            let _e289: f32 = softness;
            let _e295: vec4<f32> = global._data[21];
            front = mix((-(_e284) * 2f), (1f + (_e289 * 2f)), _e295.x);
            let _e301: f32 = front;
            let _e302: f32 = softness;
            let _e304: f32 = front;
            let _e305: f32 = coordinate;
            reveal = (1f - smoothstep((_e301 - _e302), _e304, _e305));
            let _e310: vec4<f32> = global._data[21];
            if (_e310.z > 1.5f) {
                let _e317: vec4<f32> = global._data[29];
                let _e322: vec4<f32> = global._data[30];
                local_5 = (_e317.x * _e322.z);
            } else {
                let _e328: vec4<f32> = global._data[29];
                let _e333: vec4<f32> = global._data[30];
                local_5 = (_e328.y * _e333.w);
            }
            let _e338: f32 = local_5;
            axisPixels = _e338;
            let _e343: vec4<f32> = global._data[5];
            let _e346: f32 = axisPixels;
            lineWidth = ((1.25f * _e343.x) / max(_e346, 1f));
            let _e352: f32 = lineWidth;
            let _e355: f32 = lineWidth;
            let _e358: f32 = coordinate;
            let _e359: f32 = front;
            scanLine = (1f - smoothstep((_e352 * 0.35f), (_e355 * 2f), abs((_e358 - _e359))));
            let _e369: vec4<f32> = global._data[21];
            let _e378: vec4<f32> = global._data[21];
            scanEnvelope = (smoothstep(0f, 0.08f, _e369.x) * (1f - smoothstep(0.92f, 1f, _e378.x)));
            let _e385: f32 = scanLine;
            let _e386: f32 = scanEnvelope;
            let _e390: vec4<f32> = global._data[22];
            let _e393: f32 = regionMask_1;
            scanLight = (((_e385 * _e386) * _e390.x) * _e393);
            let _e397: vec4<f32> = global._data[21];
            if (_e397.x <= 0f) {
                reveal = 0f;
            }
        }
    }
    let _e403: vec3<f32> = color_4;
    let _e404: vec3<f32> = applyColorGrade(_e403);
    let _e407: vec4<f32> = global._data[11];
    let _e411: vec4<f32> = global._data[12];
    materialColor = mix(_e404, _e407.xyz, vec3(clamp(_e411.x, 0f, 1f)));
    let _e419: vec2<f32> = panelUv_3;
    let _e422: vec4<f32> = global._data[29];
    let _e426: vec4<f32> = global._data[30];
    let _e432: vec4<f32> = global._data[5];
    let _e438: f32 = pixelPulseLight(_e419, ((_e422.xy * _e426.zw) / vec2(max(_e432.x, 0.01f))));
    pulseLight = _e438;
    let _e440: vec3<f32> = materialColor;
    let _e443: vec4<f32> = global._data[26];
    let _e445: f32 = pulseLight;
    let _e449: vec4<f32> = global._data[27];
    materialColor = (_e440 + ((_e443.xyz * _e445) * _e449.x));
    let _e455: vec4<f32> = global._data[23];
    if (_e455.x > 0.5f) {
        reveal = 1f;
    }
    let _e460: vec3<f32> = baseColor_1;
    let _e461: vec3<f32> = materialColor;
    let _e462: f32 = panelMask_1;
    let _e463: f32 = reveal;
    let _e467: vec3<f32> = gold;
    let _e468: f32 = scanLight;
    let _e470: f32 = panelMask_1;
    outputColor = (mix(_e460, _e461, vec3((_e462 * _e463))) + ((_e467 * _e468) * _e470));
    let _e476: vec4<f32> = global._data[2];
    if (_e476.x > 0.5f) {
        let _e482: vec4<f32> = global._data[12];
        let _e484: vec2<f32> = vUv_1;
        let _e485: vec4<f32> = readSource(_e484);
        let _e488: f32 = scanLight;
        let _e490: f32 = pulseLight;
        let _e493: vec4<f32> = global._data[27];
        let _e500: f32 = panelMask_1;
        let _e502: f32 = reveal;
        local_6 = ((clamp(((max(_e482.x, _e485.w) + _e488) + (_e490 * _e493.x)), 0f, 1f) * _e500) * _e502);
    } else {
        local_6 = 1f;
    }
    let _e506: f32 = local_6;
    alpha = _e506;
    let _e508: vec3<f32> = outputColor;
    let _e509: f32 = alpha;
    let _e514: vec4<f32> = linearToOutputTexel(vec4<f32>(_e508.x, _e508.y, _e508.z, _e509));
    fragColor = _e514;
    return;
}

fn smootherstep01_(x: f32) -> f32 {
    var x_1: f32;

    x_1 = x;
    let _e10: f32 = x_1;
    x_1 = clamp(_e10, 0f, 1f);
    let _e14: f32 = x_1;
    let _e15: f32 = x_1;
    let _e17: f32 = x_1;
    let _e19: f32 = x_1;
    let _e20: f32 = x_1;
    return (((_e14 * _e15) * _e17) * ((_e19 * ((_e20 * 6f) - 15f)) + 10f));
}

fn signedOpticalPower(ior: f32) -> f32 {
    var ior_1: f32;

    ior_1 = ior;
    let _e10: f32 = ior_1;
    return (_e10 * 0.18032788f);
}

fn stripMask(distanceToEdge: f32, width: f32, softness_1: f32) -> f32 {
    var distanceToEdge_1: f32;
    var width_1: f32;
    var softness_2: f32;
    var innerStart: f32;

    distanceToEdge_1 = distanceToEdge;
    width_1 = width;
    softness_2 = softness_1;
    let _e15: f32 = width_1;
    let _e16: f32 = softness_2;
    innerStart = max(0f, (_e15 - _e16));
    let _e21: f32 = innerStart;
    let _e22: f32 = width_1;
    let _e23: f32 = distanceToEdge_1;
    return (1f - smoothstep(_e21, _e22, _e23));
}

fn effectRegionMask(uv_15: vec2<f32>) -> f32 {
    var uv_16: vec2<f32>;
    var selected: f32;
    var width_2: f32;
    var softness_3: f32;
    var top: f32;
    var right: f32;
    var bottom: f32;
    var left: f32;

    uv_16 = uv_15;
    let _e12: vec4<f32> = global._data[53];
    let _e17: vec4<f32> = global._data[53];
    let _e23: vec4<f32> = global._data[53];
    let _e28: vec4<f32> = global._data[53];
    selected = max(max(_e12.x, _e17.y), max(_e23.z, _e28.w));
    let _e34: f32 = selected;
    if (_e34 < 0.5f) {
        {
            return 0f;
        }
    }
    let _e40: vec4<f32> = global._data[54];
    width_2 = clamp(_e40.x, 0f, 1f);
    let _e48: vec4<f32> = global._data[55];
    softness_3 = clamp(_e48.x, 0.001f, 0.5f);
    let _e55: vec2<f32> = uv_16;
    let _e58: f32 = width_2;
    let _e59: f32 = softness_3;
    let _e60: f32 = stripMask((1f - _e55.y), _e58, _e59);
    let _e63: vec4<f32> = global._data[53];
    top = (_e60 * _e63.x);
    let _e69: vec2<f32> = uv_16;
    let _e72: f32 = width_2;
    let _e73: f32 = softness_3;
    let _e74: f32 = stripMask((1f - _e69.x), _e72, _e73);
    let _e77: vec4<f32> = global._data[53];
    right = (_e74 * _e77.y);
    let _e82: vec2<f32> = uv_16;
    let _e84: f32 = width_2;
    let _e85: f32 = softness_3;
    let _e86: f32 = stripMask(_e82.y, _e84, _e85);
    let _e89: vec4<f32> = global._data[53];
    bottom = (_e86 * _e89.z);
    let _e94: vec2<f32> = uv_16;
    let _e96: f32 = width_2;
    let _e97: f32 = softness_3;
    let _e98: f32 = stripMask(_e94.x, _e96, _e97);
    let _e101: vec4<f32> = global._data[53];
    left = (_e98 * _e101.w);
    let _e106: f32 = top;
    let _e107: f32 = right;
    let _e109: f32 = bottom;
    let _e110: f32 = left;
    return clamp(max(max(_e106, _e107), max(_e109, _e110)), 0f, 1f);
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
    var local_7: f32;
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
    var local_8: vec2<f32>;
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
    var local_9: vec2<f32>;
    var normal_1: vec2<f32>;
    var borderMask: f32;
    var bevel: f32;
    var opticalNormal_1: vec2<f32>;
    var pull_1: f32;
    var refractOffset_3: vec2<f32>;
    var color_5: vec3<f32>;
    var rimLight_1: f32;
    var lowerLip_1: f32;
    var sweep_1: f32;
    var highlight_1: f32;
    var highlightColor_1: vec3<f32>;
    var absorption_1: f32;

    let _e8: vec2<f32> = vUv_1;
    let _e9: vec3<f32> = sampleSource(_e8);
    baseColor_2 = _e9;
    let _e13: vec4<f32> = global._data[6];
    if (_e13.x < 0.5f) {
        {
            let _e17: vec3<f32> = baseColor_2;
            let _e23: vec4<f32> = linearToOutputTexel(vec4<f32>(_e17.x, _e17.y, _e17.z, 1f));
            fragColor = _e23;
            return;
        }
    }
    let _e26: vec4<f32> = global._data[30];
    panelSize = max(_e26.zw, vec2(0.001f));
    let _e33: vec2<f32> = vUv_1;
    let _e36: vec4<f32> = global._data[30];
    let _e40: vec2<f32> = panelSize;
    panelUv_4 = (((_e33 - _e36.xy) / _e40) + vec2(0.5f));
    let _e48: vec4<f32> = global._data[29];
    let _e50: vec2<f32> = panelSize;
    panelResolution = (_e48.xy * _e50);
    let _e53: vec2<f32> = panelResolution;
    let _e55: vec2<f32> = panelResolution;
    aspect = (_e53.x / max(_e55.y, 1f));
    let _e61: f32 = aspect;
    aspectCorrection = vec2<f32>(_e61, 1f);
    let _e65: vec2<f32> = panelUv_4;
    let _e69: vec2<f32> = aspectCorrection;
    p_24 = ((_e65 - vec2(0.5f)) * _e69);
    let _e74: vec4<f32> = global._data[35];
    thickness = clamp(_e74.x, 0.001f, 0.32f);
    let _e82: vec4<f32> = global._data[36];
    radius_4 = clamp(_e82.x, 0f, 0.34f);
    let _e90: f32 = aspect;
    let _e92: f32 = thickness;
    let _e93: f32 = aspect;
    let _e99: f32 = thickness;
    innerSize_2 = vec2<f32>(max(0.001f, ((0.5f * _e90) - (_e92 * _e93))), max(0.001f, (0.5f - _e99)));
    let _e104: vec2<f32> = p_24;
    let _e105: vec2<f32> = innerSize_2;
    let _e106: f32 = radius_4;
    let _e107: f32 = shapeDistance(_e104, _e105, _e106);
    d = _e107;
    let _e111: vec4<f32> = global._data[37];
    chroma_2 = clamp((_e111.x / 0.08f), 0f, 1f);
    let _e129: vec2<f32> = panelUv_4;
    let _e130: f32 = effectRegionMask(_e129);
    regionMask_2 = _e130;
    let _e135: f32 = aspect;
    outerSize = vec2<f32>((0.5f * _e135), 0.5f);
    let _e140: vec2<f32> = p_24;
    let _e141: vec2<f32> = outerSize;
    let _e142: f32 = radius_4;
    let _e143: f32 = shapeDistance(_e140, _e141, _e142);
    panelDistance = _e143;
    let _e146: f32 = panelDistance;
    let _e148: vec2<f32> = panelResolution;
    let _e153: vec4<f32> = global._data[5];
    depthPx_2 = max(0f, ((-(_e146) * _e148.y) / max(_e153.x, 0.01f)));
    let _e162: vec4<f32> = global._data[31];
    let _e168: vec4<f32> = global._data[56];
    if ((_e162.x > 0.5f) || (_e168.x > 10.5f)) {
        {
            let _e174: vec2<f32> = panelResolution;
            aa = (1.5f / max(_e174.y, 1f));
            let _e181: f32 = aa;
            let _e183: f32 = aa;
            let _e184: f32 = panelDistance;
            panelMask_2 = (1f - smoothstep(-(_e181), _e183, _e184));
            let _e187: f32 = panelMask_2;
            if (_e187 <= 0f) {
                {
                    let _e190: vec3<f32> = baseColor_2;
                    let _e193: vec4<f32> = global._data[2];
                    if (_e193.x > 0.5f) {
                        local_7 = 0f;
                    } else {
                        local_7 = 1f;
                    }
                    let _e200: f32 = local_7;
                    let _e205: vec4<f32> = linearToOutputTexel(vec4<f32>(_e190.x, _e190.y, _e190.z, _e200));
                    fragColor = _e205;
                    return;
                }
            }
        }
    }
    let _e211: vec4<f32> = global._data[13];
    let _e218: vec4<f32> = global._data[19];
    let _e226: vec4<f32> = global._data[8];
    if (((_e211.x > 0.5f) || (_e218.x > 0.5f)) || (_e226.x > 0.5f)) {
        {
            let _e233: vec2<f32> = panelResolution;
            edgeEpsilon = (0.75f / max(_e233.y, 1f));
            let _e239: f32 = edgeEpsilon;
            epsEdge = vec2<f32>(_e239, 0f);
            let _e243: vec2<f32> = p_24;
            let _e244: vec2<f32> = epsEdge;
            let _e247: vec2<f32> = outerSize;
            let _e248: f32 = radius_4;
            let _e249: f32 = shapeDistance((_e243 + _e244.xy), _e247, _e248);
            let _e250: vec2<f32> = p_24;
            let _e251: vec2<f32> = epsEdge;
            let _e254: vec2<f32> = outerSize;
            let _e255: f32 = radius_4;
            let _e256: f32 = shapeDistance((_e250 - _e251.xy), _e254, _e255);
            let _e258: vec2<f32> = p_24;
            let _e259: vec2<f32> = epsEdge;
            let _e262: vec2<f32> = outerSize;
            let _e263: f32 = radius_4;
            let _e264: f32 = shapeDistance((_e258 + _e259.yx), _e262, _e263);
            let _e265: vec2<f32> = p_24;
            let _e266: vec2<f32> = epsEdge;
            let _e269: vec2<f32> = outerSize;
            let _e270: f32 = radius_4;
            let _e271: f32 = shapeDistance((_e265 - _e266.yx), _e269, _e270);
            edgeGrad = vec2<f32>((_e249 - _e256), (_e264 - _e271));
            let _e275: vec2<f32> = edgeGrad;
            if (length(_e275) > 0.00001f) {
                let _e279: vec2<f32> = edgeGrad;
                edgeNormal_2 = normalize(_e279);
            }
        }
    }
    let _e291: vec4<f32> = global._data[13];
    if (_e291.x > 0.5f) {
        {
            let _e298: vec4<f32> = global._data[13];
            width_3 = max(_e298.y, 0.5f);
            let _e304: f32 = width_3;
            let _e307: f32 = width_3;
            let _e310: f32 = depthPx_2;
            blurAmount_4 = smoothstep((_e304 * 0.8f), (_e307 * 1.65f), _e310);
            let _e312: f32 = depthPx_2;
            let _e313: f32 = width_3;
            facetCurve = sin((clamp((_e312 / (_e313 * 1.65f)), 0f, 1f) * 3.1415927f));
            let _e326: vec4<f32> = global._data[8];
            if (_e326.x < 0.5f) {
                {
                    let _e331: vec2<f32> = edgeNormal_2;
                    let _e334: vec4<f32> = global._data[34];
                    let _e336: f32 = signedOpticalPower(_e334.x);
                    let _e340: vec4<f32> = global._data[13];
                    let _e344: f32 = width_3;
                    let _e348: f32 = facetCurve;
                    let _e352: vec4<f32> = global._data[5];
                    let _e357: vec4<f32> = global._data[29];
                    facetOffset = (((((((_e331 * _e336) * _e340.z) * _e344) * 1.5f) * _e348) * _e352.x) / _e357.xy);
                    let _e360: vec2<f32> = surfaceOffset;
                    let _e361: vec2<f32> = facetOffset;
                    surfaceOffset = (_e360 + _e361);
                }
            }
        }
    }
    let _e365: vec4<f32> = global._data[16];
    if (_e365.z > 0.0001f) {
        {
            let _e372: vec4<f32> = global._data[16];
            let _e377: vec4<f32> = global._data[30];
            let _e381: vec2<f32> = panelSize;
            touchPanelUv = (((_e372.xy - _e377.xy) / _e381) + vec2(0.5f));
            let _e387: vec2<f32> = panelUv_4;
            let _e388: vec2<f32> = touchPanelUv;
            let _e390: vec2<f32> = aspectCorrection;
            delta = ((_e387 - _e388) * _e390);
            let _e395: vec4<f32> = global._data[17];
            let _e397: f32 = aspect;
            touchRadius = max((_e395.x * min(_e397, 1f)), 0.001f);
            let _e404: vec2<f32> = delta;
            let _e406: f32 = touchRadius;
            normalizedDistance = (length(_e404) / _e406);
            let _e409: f32 = normalizedDistance;
            let _e411: f32 = normalizedDistance;
            dent = exp(((-(_e409) * _e411) * 3f));
            let _e419: f32 = touchRadius;
            let _e420: vec2<f32> = panelResolution;
            let _e425: vec4<f32> = global._data[5];
            let _e431: f32 = depthPx_2;
            boundary = smoothstep(0f, max(3f, (((_e419 * _e420.y) / _e425.x) * 0.2f)), _e431);
            let _e434: vec2<f32> = surfaceOffset;
            let _e435: vec2<f32> = delta;
            let _e436: f32 = dent;
            let _e440: vec4<f32> = global._data[16];
            let _e446: vec4<f32> = global._data[18];
            let _e451: f32 = boundary;
            let _e453: vec2<f32> = aspectCorrection;
            let _e455: vec2<f32> = panelSize;
            surfaceOffset = (_e434 + (((((((_e435 * _e436) * _e440.z) * _e446.x) * 0.34f) * _e451) / _e453) * _e455));
        }
    }
    let _e460: vec4<f32> = global._data[8];
    if (_e460.x > 0.5f) {
        {
            let _e465: vec2<f32> = p_24;
            let _e466: vec2<f32> = outerSize;
            let _e467: vec2<f32> = glassLensSlope(_e465, _e466);
            opticalSlope = _e467;
            let _e469: vec2<f32> = panelResolution;
            let _e471: vec2<f32> = panelResolution;
            let _e476: vec4<f32> = global._data[5];
            shortSide = (min(_e469.x, _e471.y) / max(_e476.x, 1f));
            let _e484: f32 = shortSide;
            let _e488: f32 = depthPx_2;
            boundary_1 = smoothstep(0f, max(3f, (_e484 * 0.06f)), _e488);
            let _e492: f32 = boundary_1;
            let _e495: vec4<f32> = global._data[64];
            flowMask = mix(1f, _e492, clamp(_e495.x, 0f, 1f));
            let _e502: vec2<f32> = opticalSlope;
            let _e503: vec2<f32> = p_24;
            let _e506: vec4<f32> = global._data[33];
            let _e508: vec2<f32> = flowGradient(_e503, _e506.x);
            let _e511: vec4<f32> = global._data[61];
            let _e519: f32 = flowMask;
            let _e521: f32 = regionMask_2;
            opticalSlope = (_e502 + ((((_e508 * clamp(_e511.x, 0f, 1.5f)) * 0.18f) * _e519) * _e521));
            let _e524: vec2<f32> = opticalSlope;
            normal3D = normalize(vec3<f32>(_e524.x, _e524.y, 1f));
            let _e536: vec3<f32> = normal3D;
            ray = refract(vec3<f32>(0f, 0f, -1f), _e536, 0.6666667f);
            let _e542: vec3<f32> = ray;
            let _e544: vec3<f32> = ray;
            let _e553: vec4<f32> = global._data[9];
            bendPixels_1 = ((_e542.xy / vec2(max(abs(_e544.z), 0.15f))) * _e553.x);
            let _e557: vec2<f32> = bendPixels_1;
            let _e560: vec4<f32> = global._data[5];
            let _e565: vec4<f32> = global._data[29];
            bendUv = ((_e557 * _e560.x) / _e565.xy);
            let _e569: vec2<f32> = vUv_1;
            let _e570: vec2<f32> = surfaceOffset;
            let _e572: vec2<f32> = bendUv;
            let _e575: vec4<f32> = global._data[8];
            let _e578: f32 = blurAmount_4;
            let _e579: vec3<f32> = sampleDispersedSource((_e569 + _e570), _e572, _e575.w, _e578);
            opticalColor = _e579;
            let _e581: vec3<f32> = baseColor_2;
            let _e582: vec3<f32> = opticalColor;
            let _e583: f32 = regionMask_2;
            let _e586: vec3<f32> = baseColor_2;
            let _e587: f32 = panelMask_2;
            let _e588: vec2<f32> = panelUv_4;
            let _e589: vec2<f32> = edgeNormal_2;
            let _e590: f32 = depthPx_2;
            let _e591: f32 = regionMask_2;
            writeOutputColor(mix(_e581, _e582, vec3(_e583)), _e586, _e587, _e588, _e589, _e590, _e591);
            return;
        }
    }
    let _e592: vec3<f32> = baseColor_2;
    let _e593: vec2<f32> = vUv_1;
    let _e594: vec2<f32> = surfaceOffset;
    let _e596: f32 = blurAmount_4;
    let _e597: vec3<f32> = sampleGlassSource((_e593 + _e594), _e596);
    let _e598: f32 = regionMask_2;
    glassBaseColor = mix(_e592, _e597, vec3(_e598));
    let _e605: f32 = thickness;
    let _e606: vec2<f32> = panelResolution;
    let _e611: vec4<f32> = global._data[5];
    let _e615: f32 = depthPx_2;
    spectralEdge = (1f - smoothstep(0f, max(4f, ((_e605 * _e606.y) / _e611.x)), _e615));
    let _e619: f32 = chroma_2;
    let _e620: f32 = spectralEdge;
    chroma_2 = (_e619 * _e620);
    let _e624: vec4<f32> = global._data[47];
    if (_e624.x > 0.5f) {
        {
            let _e628: vec2<f32> = panelUv_4;
            let _e632: vec2<f32> = aspectCorrection;
            centerVector = ((_e628 - vec2(0.5f)) * _e632);
            let _e635: vec2<f32> = centerVector;
            let _e639: f32 = aspect;
            let _e644: vec2<f32> = centerVector;
            normalizedCenter = vec2<f32>((abs(_e635.x) / max((0.5f * _e639), 0.001f)), (abs(_e644.y) / 0.5f));
            let _e651: vec2<f32> = normalizedCenter;
            ellipseTravel = length(_e651);
            let _e654: vec2<f32> = normalizedCenter;
            let _e656: vec2<f32> = normalizedCenter;
            rectTravel = max(_e654.x, _e656.y);
            let _e662: f32 = ellipseTravel;
            edgeBlend = smoothstep(0.72f, 1.18f, _e662);
            let _e665: f32 = ellipseTravel;
            let _e666: f32 = rectTravel;
            let _e667: f32 = edgeBlend;
            edgeTravel = mix(_e665, _e666, (_e667 * 0.16f));
            let _e674: vec4<f32> = global._data[48];
            fieldStart = clamp(_e674.x, 0f, 0.9f);
            let _e682: vec4<f32> = global._data[49];
            fieldSoftness = clamp(_e682.x, 0.04f, 1f);
            let _e690: vec4<f32> = global._data[51];
            fieldCurve = clamp(_e690.x, 0.35f, 6f);
            let _e696: f32 = edgeTravel;
            let _e697: f32 = fieldStart;
            let _e699: f32 = fieldSoftness;
            fadeProgress = clamp(((_e696 - _e697) / max(_e699, 0.001f)), 0f, 1f);
            let _e708: f32 = fieldStart;
            let _e709: f32 = fieldSoftness;
            let _e715: f32 = edgeTravel;
            longRamp = smoothstep(max(0f, (_e708 - (_e709 * 0.45f))), 1.18f, _e715);
            let _e720: f32 = fadeProgress;
            let _e722: f32 = longRamp;
            let _e724: f32 = fieldCurve;
            maskFade = pow((smoothstep(0f, 1f, _e720) * _e722), _e724);
            let _e727: f32 = fadeProgress;
            let _e728: f32 = smootherstep01_(_e727);
            let _e730: f32 = fieldCurve;
            let _e735: f32 = longRamp;
            dissolveFade = (pow(_e728, max(0.6f, (_e730 * 0.82f))) * _e735);
            let _e738: f32 = maskFade;
            let _e739: f32 = dissolveFade;
            let _e743: vec4<f32> = global._data[50];
            let _e747: f32 = regionMask_2;
            masterFade = (mix(_e738, _e739, step(0.5f, _e743.x)) * _e747);
            let _e750: vec2<f32> = centerVector;
            if (length(_e750) > 0.00001f) {
                let _e754: vec2<f32> = centerVector;
                local_8 = normalize(_e754);
            } else {
                local_8 = vec2(0f);
            }
            let _e759: vec2<f32> = local_8;
            normal = _e759;
            let _e761: vec2<f32> = normal;
            let _e762: vec2<f32> = p_24;
            let _e763: f32 = masterFade;
            let _e764: vec2<f32> = applyFlowToNormal(_e761, _e762, _e763);
            opticalNormal = _e764;
            let _e768: vec4<f32> = global._data[52];
            fieldStrength = clamp(_e768.x, 0f, 2.5f);
            let _e776: vec4<f32> = global._data[34];
            let _e778: f32 = signedOpticalPower(_e776.x);
            let _e779: f32 = masterFade;
            let _e781: f32 = fieldStrength;
            let _e784: f32 = thickness;
            pull = (((_e778 * _e779) * _e781) * (0.055f + (_e784 * 0.38f)));
            let _e790: vec2<f32> = opticalNormal;
            let _e791: f32 = pull;
            let _e793: vec2<f32> = aspectCorrection;
            let _e795: vec2<f32> = panelSize;
            refractOffset_2 = (((_e790 * _e791) / _e793) * _e795);
            let _e798: vec2<f32> = vUv_1;
            let _e799: vec2<f32> = surfaceOffset;
            let _e801: vec2<f32> = facetOffset;
            let _e803: vec2<f32> = refractOffset_2;
            let _e804: vec2<f32> = facetOffset;
            let _e806: f32 = chroma_2;
            let _e807: f32 = blurAmount_4;
            let _e808: vec3<f32> = sampleDispersedSource(((_e798 + _e799) - _e801), (_e803 + _e804), _e806, _e807);
            opticalColor_1 = _e808;
            let _e810: f32 = fieldStart;
            let _e811: f32 = fieldSoftness;
            let _e818: f32 = edgeTravel;
            let _e820: f32 = masterFade;
            edgeMask = (smoothstep(max((_e810 + (_e811 * 0.65f)), 0.52f), 1.2f, _e818) * _e820);
            let _e823: vec2<f32> = opticalNormal;
            let _e824: vec2<f32> = lightDirection;
            let _e831: f32 = edgeMask;
            rimLight = (pow(max(dot(_e823, -(_e824)), 0f), 2.8f) * _e831);
            let _e836: vec2<f32> = panelUv_4;
            let _e839: f32 = edgeMask;
            lowerLip = (smoothstep(0.58f, 1f, _e836.y) * _e839);
            let _e844: vec2<f32> = panelUv_4;
            let _e848: vec4<f32> = global._data[33];
            let _e852: vec2<f32> = panelUv_4;
            let _e861: f32 = edgeMask;
            sweep = (smoothstep(0.025f, 0f, abs((_e844.x - fract(((_e848.x * 0.05f) + (_e852.y * 0.26f)))))) * _e861);
            let _e864: f32 = rimLight;
            let _e867: f32 = lowerLip;
            let _e871: f32 = sweep;
            let _e877: vec4<f32> = global._data[39];
            highlight = ((((_e864 * 0.72f) + (_e867 * 0.24f)) + (_e871 * 0.12f)) * _e877.x);
            let _e883: vec4<f32> = global._data[7];
            let _e885: f32 = rimLight;
            let _e886: f32 = lowerLip;
            highlightColor = (_e883.xyz * (_e885 + (_e886 * 0.8f)));
            let _e892: f32 = edgeMask;
            let _e895: vec4<f32> = global._data[38];
            let _e902: f32 = masterFade;
            absorption = ((_e892 * clamp(_e895.x, 0f, 1f)) * (0.28f + (_e902 * 0.42f)));
            let _e908: vec3<f32> = opticalColor_1;
            let _e909: vec3<f32> = opticalColor_1;
            let _e911: f32 = absorption;
            let _e914: f32 = edgeMask;
            opticalColor_1 = mix(_e908, (_e909 * (1f - _e911)), vec3(_e914));
            let _e917: vec3<f32> = opticalColor_1;
            let _e918: vec3<f32> = highlightColor;
            let _e919: f32 = highlight;
            opticalColor_1 = (_e917 + (_e918 * _e919));
            let _e922: vec3<f32> = glassBaseColor;
            let _e923: vec3<f32> = opticalColor_1;
            let _e924: f32 = masterFade;
            let _e927: vec3<f32> = baseColor_2;
            let _e928: f32 = panelMask_2;
            let _e929: vec2<f32> = panelUv_4;
            let _e930: vec2<f32> = edgeNormal_2;
            let _e931: f32 = depthPx_2;
            let _e932: f32 = regionMask_2;
            writeOutputColor(mix(_e922, _e923, vec3(_e924)), _e927, _e928, _e929, _e930, _e931, _e932);
            return;
        }
    }
    let _e933: f32 = d;
    if (_e933 < -0.001f) {
        {
            let _e937: vec3<f32> = glassBaseColor;
            let _e938: vec3<f32> = baseColor_2;
            let _e939: f32 = panelMask_2;
            let _e940: vec2<f32> = panelUv_4;
            let _e941: vec2<f32> = edgeNormal_2;
            let _e942: f32 = depthPx_2;
            let _e943: f32 = regionMask_2;
            writeOutputColor(_e937, _e938, _e939, _e940, _e941, _e942, _e943);
            return;
        }
    }
    let _e948: vec2<f32> = p_24;
    let _e949: vec2<f32> = eps_1;
    let _e952: vec2<f32> = innerSize_2;
    let _e953: f32 = radius_4;
    let _e954: f32 = shapeDistance((_e948 + _e949.xy), _e952, _e953);
    let _e955: vec2<f32> = p_24;
    let _e956: vec2<f32> = eps_1;
    let _e959: vec2<f32> = innerSize_2;
    let _e960: f32 = radius_4;
    let _e961: f32 = shapeDistance((_e955 - _e956.xy), _e959, _e960);
    dX_1 = (_e954 - _e961);
    let _e964: vec2<f32> = p_24;
    let _e965: vec2<f32> = eps_1;
    let _e968: vec2<f32> = innerSize_2;
    let _e969: f32 = radius_4;
    let _e970: f32 = shapeDistance((_e964 + _e965.yx), _e968, _e969);
    let _e971: vec2<f32> = p_24;
    let _e972: vec2<f32> = eps_1;
    let _e975: vec2<f32> = innerSize_2;
    let _e976: f32 = radius_4;
    let _e977: f32 = shapeDistance((_e971 - _e972.yx), _e975, _e976);
    dY_1 = (_e970 - _e977);
    let _e980: f32 = dX_1;
    let _e981: f32 = dY_1;
    grad_1 = vec2<f32>(_e980, _e981);
    let _e984: vec2<f32> = grad_1;
    if (length(_e984) > 0.00001f) {
        let _e988: vec2<f32> = grad_1;
        local_9 = normalize(_e988);
    } else {
        local_9 = vec2(0f);
    }
    let _e993: vec2<f32> = local_9;
    normal_1 = _e993;
    let _e997: f32 = thickness;
    let _e1000: f32 = d;
    let _e1003: f32 = thickness;
    let _e1006: f32 = thickness;
    let _e1009: f32 = d;
    borderMask = (smoothstep(-0.001f, (_e997 * 0.15f), _e1000) * (1f - smoothstep((_e1003 * 0.62f), (_e1006 * 1.24f), _e1009)));
    let _e1014: f32 = borderMask;
    let _e1015: f32 = regionMask_2;
    borderMask = (_e1014 * _e1015);
    let _e1018: f32 = d;
    let _e1019: f32 = thickness;
    bevel = pow((1f - clamp((_e1018 / max(_e1019, 0.001f)), 0f, 1f)), 0.58f);
    let _e1030: vec2<f32> = normal_1;
    let _e1031: vec2<f32> = p_24;
    let _e1032: f32 = borderMask;
    let _e1033: vec2<f32> = applyFlowToNormal(_e1030, _e1031, _e1032);
    opticalNormal_1 = _e1033;
    let _e1037: vec4<f32> = global._data[34];
    let _e1039: f32 = signedOpticalPower(_e1037.x);
    let _e1040: f32 = borderMask;
    let _e1043: f32 = thickness;
    pull_1 = ((_e1039 * _e1040) * (0.07f + (_e1043 * 0.62f)));
    let _e1049: vec2<f32> = opticalNormal_1;
    let _e1050: f32 = pull_1;
    let _e1052: vec2<f32> = aspectCorrection;
    let _e1054: vec2<f32> = panelSize;
    refractOffset_3 = (((_e1049 * _e1050) / _e1052) * _e1054);
    let _e1057: vec3<f32> = baseColor_2;
    let _e1058: vec2<f32> = vUv_1;
    let _e1059: vec2<f32> = surfaceOffset;
    let _e1061: vec2<f32> = facetOffset;
    let _e1063: vec2<f32> = refractOffset_3;
    let _e1064: vec2<f32> = facetOffset;
    let _e1066: f32 = chroma_2;
    let _e1067: f32 = blurAmount_4;
    let _e1068: vec3<f32> = sampleDispersedSource(((_e1058 + _e1059) - _e1061), (_e1063 + _e1064), _e1066, _e1067);
    let _e1069: f32 = regionMask_2;
    color_5 = mix(_e1057, _e1068, vec3(_e1069));
    let _e1073: vec2<f32> = opticalNormal_1;
    let _e1074: vec2<f32> = lightDirection;
    let _e1081: f32 = borderMask;
    rimLight_1 = (pow(max(dot(_e1073, -(_e1074)), 0f), 2.8f) * _e1081);
    let _e1086: vec2<f32> = panelUv_4;
    let _e1089: f32 = borderMask;
    lowerLip_1 = (smoothstep(0.56f, 1f, _e1086.y) * _e1089);
    let _e1094: vec2<f32> = panelUv_4;
    let _e1098: vec4<f32> = global._data[33];
    let _e1102: vec2<f32> = panelUv_4;
    sweep_1 = smoothstep(0.025f, 0f, abs((_e1094.x - fract(((_e1098.x * 0.055f) + (_e1102.y * 0.28f))))));
    let _e1112: f32 = rimLight_1;
    let _e1115: f32 = lowerLip_1;
    let _e1119: f32 = sweep_1;
    let _e1125: vec4<f32> = global._data[39];
    highlight_1 = ((((_e1112 * 0.82f) + (_e1115 * 0.28f)) + (_e1119 * 0.18f)) * _e1125.x);
    let _e1131: vec4<f32> = global._data[7];
    let _e1133: f32 = rimLight_1;
    let _e1134: f32 = lowerLip_1;
    highlightColor_1 = (_e1131.xyz * (_e1133 + (_e1134 * 0.8f)));
    let _e1140: f32 = borderMask;
    let _e1141: f32 = bevel;
    let _e1145: vec4<f32> = global._data[38];
    absorption_1 = ((_e1140 * _e1141) * clamp(_e1145.x, 0f, 1f));
    let _e1152: vec3<f32> = color_5;
    let _e1153: vec3<f32> = color_5;
    let _e1155: f32 = absorption_1;
    let _e1158: f32 = borderMask;
    color_5 = mix(_e1152, (_e1153 * (1f - _e1155)), vec3(_e1158));
    let _e1161: vec3<f32> = color_5;
    let _e1162: vec3<f32> = highlightColor_1;
    let _e1163: f32 = highlight_1;
    color_5 = (_e1161 + (_e1162 * _e1163));
    let _e1166: vec3<f32> = color_5;
    let _e1167: vec3<f32> = baseColor_2;
    let _e1168: f32 = panelMask_2;
    let _e1169: vec2<f32> = panelUv_4;
    let _e1170: vec2<f32> = edgeNormal_2;
    let _e1171: f32 = depthPx_2;
    let _e1172: f32 = regionMask_2;
    writeOutputColor(_e1166, _e1167, _e1168, _e1169, _e1170, _e1171, _e1172);
    return;
}

@fragment 
fn main(@location(0) vUv: vec2<f32>) -> FragmentOutput {
    vUv_1 = vUv;
    main_1();
    let _e17: vec4<f32> = fragColor;
    return FragmentOutput(_e17);
}
