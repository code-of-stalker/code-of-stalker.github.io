#version 300 es
precision highp float;
// The card's words: white glyphs on black in the atlas, carried by the
// vertex color into the channel and strength Rust chose.
uniform sampler2D u_atlas;
in vec2 v_local;
in vec4 v_color;
out vec4 o;
void main() {
  o = v_color * texture(u_atlas, v_local).r;
}
