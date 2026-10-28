#version 300 es
precision highp float;
uniform sampler2D u_shell;
uniform float u_theme_light;
in vec2 v_local;
in vec4 v_color;
in vec3 v_shape;
out vec4 o;
void main() {
  float shell=smoothstep(0.025,0.96,texture(u_shell,v_local).a);
  float edge=1.0-smoothstep(0.62,1.0,abs(v_shape.x));
  float coverage=shell*edge*v_color.g;
  vec2 energy;
  if(v_color.r<0.5) {
    energy=u_theme_light>0.5?vec2(0.66,0.42):vec2(0.005,0.009);
  } else if(v_color.r<1.5) {
    energy=u_theme_light>0.5?vec2(0.96,0.78):vec2(0.002,0.004);
  } else {
    energy=u_theme_light>0.5?vec2(0.04,0.025):vec2(0.20,0.37);
  }
  o=vec4(energy,0.0,1.0)*coverage;
}
