#version 300 es
precision highp float;
// White glyphs on black in the atlas, carried by the premultiplied color.
uniform sampler2D u_atlas;
in vec2 v_uv;
in vec4 v_color;
out vec4 o;
void main() {
  o = v_color * texture(u_atlas, v_uv).r;
}
