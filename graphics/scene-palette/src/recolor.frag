#version 300 es
precision highp float;
// The finished full-color frame of a scene.
uniform sampler2D u_image;
// x: mapping (0 Matrix yellow, 1 sand sepia, 2 cool luminance ink),
// y: 1 when the edges melt into the page.
uniform vec4 u_mode;
uniform vec3 u_paper;
uniform vec3 u_accent;
uniform vec3 u_highlight;
uniform vec3 u_backdrop;
// Left, right, top, bottom, as fractions of the canvas.
uniform vec4 u_edges;
out vec4 out_color;
const vec3 LUMA = vec3(.2126, .7152, .0722);
// Искра, Тишина and Астрал mirror the grounding role of
// graphics/product-engine/engine/shaders/presentation.wgsl.
vec3 recolor(vec3 c) {
    if (u_mode.x < .5) return u_accent * clamp(dot(c, LUMA), 0., 1.);
    if (u_mode.x < 1.5) {
        // Sand: a sepia print in the theme's brown ink, with the light warming
        // toward the accent. The max-channel duotone flooded it with orange.
        float level = clamp(dot(c, LUMA), 0., 1.);
        vec3 print = mix(u_paper, u_highlight, pow(1. - level, 1.8) * .42);
        return mix(print, mix(u_paper, u_accent, .5), smoothstep(.55, 1., level) * .35);
    }
    float level = clamp(dot(c, LUMA), 0., 1.);
    float ink = pow(level, 1.3) * .74;
    vec3 muted = mix(u_accent, vec3(dot(u_accent, LUMA)), .4);
    vec3 tint = mix(muted, u_highlight, smoothstep(.45, .95, level) * .55);
    return u_paper * (1. - ink) + tint * ink;
}
void main() {
    ivec2 texel = ivec2(gl_FragCoord.xy);
    vec2 s = gl_FragCoord.xy / vec2(textureSize(u_image, 0));
    s.y = 1. - s.y;
    vec4 fade = smoothstep(vec4(0.), max(u_edges, vec4(1e-4)), vec4(s.x, 1. - s.x, s.y, 1. - s.y));
    float keep = mix(1., fade.x * fade.y * fade.z * fade.w, u_mode.y);
    out_color = vec4(mix(u_backdrop, recolor(texelFetch(u_image, texel, 0).rgb), keep), 1.);
}
