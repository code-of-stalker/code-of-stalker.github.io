#version 300 es
precision highp float;
// Immutable engraved portrait, lit and articulated by Rust's choreography.
uniform sampler2D u_figure;
uniform sampler2D u_shell;
uniform vec4 u_motion; // breathing, blink, gaze, release
uniform float u_time;
uniform float u_theme_light;
uniform float u_mask;
in vec2 v_local;
out vec4 o;
float oval(vec2 p, vec2 center, vec2 size) {vec2 q=(p-center)/size;return exp(-dot(q,q)*2.0);}
void main() {
  vec2 p=v_local*vec2(1536,1024);
  if(u_mask>0.0) {
    // A separate opaque illustrated shell. Its alpha replaces the portrait
    // underneath instead of adding a transparent copy of the face to it.
    vec4 shell=texture(u_shell,v_local);
    float alpha=smoothstep(0.025,0.96,shell.a)*u_mask;
    float shade=shell.r;
    float grazing=oval(p,vec2(740.0-90.0*u_motion.w,400),vec2(170,330));
    if(u_theme_light>0.5) {
      float ink=(0.22+0.65*(1.0-shade))*(1.0-0.08*grazing*u_motion.w);
      o=vec4(ink*0.74,ink*0.43,0.0,1.0)*alpha;
    } else {
      float lit=shade*(0.67+0.17*grazing+0.10*u_motion.w);
      o=vec4(lit*0.42,lit*0.64,0.0,1.0)*alpha;
    }
    return;
  }
  vec2 q=p;
  float throat=oval(p,vec2(540,810),vec2(260,170));
  q.y+=throat*(u_motion.x-0.5)*2.2;
  float eye=oval(p,vec2(670,310),vec2(43,17));
  float eye2=oval(p,vec2(825,340),vec2(24,15));
  q.y+=(eye+eye2)*u_motion.y*6.0;
  q.x+=(eye+eye2)*u_motion.z*1.4;
  float hair=oval(p,vec2(430,160),vec2(330,130));
  q.x+=hair*sin(u_time*6.28318530718/36.0)*1.6;
  vec2 uv=q/vec2(1536,1024);
  vec4 portrait=texture(u_figure,uv);
  float shade=portrait.r;
  float cover=portrait.a;
  float cheek=oval(p,vec2(670.0+u_motion.w*110.0,410),vec2(190,340));
  float lit=shade*(0.67+0.22*u_motion.w+0.13*cheek);
  float gaze=oval(p,vec2(669.0+u_motion.z,303),vec2(3.1,2.2));
  lit+=gaze*0.07*(1.0-u_motion.y);
  float edge=smoothstep(0.,65.,p.y)*smoothstep(0.,85.,1024.-p.y);
  if(u_theme_light>0.5) {
    // Engraving on paper: preserve bright face planes, deepen the hatching.
    float ink=cover*(0.17+0.58*(1.0-shade));
    ink*=1.0-0.15*cheek*u_motion.w;
    o=vec4(ink*0.67,ink*0.46,0.0,cover)*edge;
  } else {
    o=vec4(lit*cover*0.26,lit*cover*0.74,0.0,cover)*edge;
  }
}
