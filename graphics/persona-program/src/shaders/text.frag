#version 300 es
precision highp float;
// Words: white glyphs on black in the atlas, carried by the vertex color
// into the channel and strength Rust chose. A word out of focus is read
// from a softer level of the atlas (shape.x: the bias Rust gives it).
uniform sampler2D u_atlas;
in vec2 v_local;
in vec4 v_color;
in vec3 v_shape;
out vec4 o;
void main() {
  o = v_color * texture(u_atlas, v_local, v_shape.x).r;
}
