#version 300 es
precision highp float;
uniform sampler2D u_hand;
uniform sampler2D u_world;
uniform vec2 u_resolution;
uniform vec2 u_contact;
uniform vec3 u_source;
uniform vec4 u_clock;
uniform vec4 u_detail;
uniform vec4 u_story;
uniform vec4 u_drop;
uniform vec3 u_paper;
uniform vec3 u_ink;
uniform vec3 u_highlight;
uniform float u_light;
in vec2 v_uv;
out vec4 o;
const vec2 SIZE=vec2(1536.0,1024.0);
const float TAU=6.28318530718;
vec2 source(vec2 p) {
  float s=sin(u_clock.w),c=cos(u_clock.w);
  vec2 q=p-u_contact+vec2(0.0,u_clock.z);
  return u_source.xy+vec2(q.x*c+q.y*s,-q.x*s+q.y*c)/u_source.z;
}
vec4 hand(vec2 p) {
  vec2 uv=source(p)/SIZE;
  if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return vec4(0.0);
  vec4 texel=texture(u_hand,uv);
  // The authored sleeve exits its canvas before the scene's right edge.
  // Fade only that clipped source edge; the fingertip placement is unchanged.
  texel.a*=smoothstep(0.0,0.065,uv.y)*(1.0-smoothstep(0.89,1.0,uv.x));
  return texel;
}
vec3 material(float value) {
  if(u_light>0.5) {
    // The dedicated cream/sepia illustration has conventional light values:
    // pale planes stay paper-like; its dark drawn contours receive theme ink.
    float ink=pow(clamp(1.0-value,0.0,1.0),0.9);
    vec3 middle=mix(u_paper,u_highlight,smoothstep(0.0,0.8,ink)*0.45);
    return mix(middle,u_ink,pow(ink,1.4)*0.9);
  }
  return mix(u_paper*0.63,u_ink*0.84+u_highlight*0.16,pow(value,0.83));
}
float sourceTone(vec4 texel) {
  return u_light>0.5?dot(texel.rgb,vec3(0.2126,0.7152,0.0722)):texel.r;
}
float sourceEnergy(vec4 texel) {
  return u_light>0.5?1.0-sourceTone(texel):texel.r;
}
// Dispersive packets travel across the water once after contact. Their curved
// fronts are perturbed by current, and each has its own width and attenuation.
vec4 ripple(vec2 q,float edgeWidth) {
  q.y*=3.4;
  float r=length(q),theta=atan(q.y,q.x);
  float warped=r+smoothstep(25.0,160.0,r)*(7.0*sin(theta*3.0+u_clock.x)+2.0*sin(theta*7.0-u_clock.x*2.0));
  float height=0.0,slope=0.0,lip=0.0,shadow=0.0;
  for(int i=0;i<4;i++) {
    float age=u_detail.x-float(i)*0.42;
    float alive=smoothstep(0.0,0.45,age)*(1.0-smoothstep(11.0,15.5,age));
    float d=warped-max(0.0,u_story.y-float(i)*88.0);
    alive*=smoothstep(float(i)*88.0,float(i)*88.0+30.0,u_story.y);
    float envelope=exp(-d*d/(1600.0+float(i)*360.0));
    float fade=alive*envelope/(1.0+r*0.0045)*(1.0-float(i)*0.14);
    height+=sin(d*0.07)*fade;
    slope+=cos(d*0.07)*fade;
    float broken=0.24+0.76*smoothstep(-0.58,0.62,
      sin(theta*3.0+float(i)*1.9+u_clock.x)*0.6+sin(theta*7.0-float(i)*0.7)*0.4);
    float trace=alive*exp(-r*0.00115)*(1.0-float(i)*0.12)*broken;
    float brightEdge=(d+2.8)/edgeWidth;
    float darkEdge=(d-3.2)/(edgeWidth*1.4);
    lip+=exp(-brightEdge*brightEdge)*trace;
    shadow+=exp(-darkEdge*darkEdge)*trace;
  }
  float after=u_drop.z;
  float secondary=smoothstep(0.0,0.13,after)*(1.0-smoothstep(4.0,7.5,after));
  for(int i=0;i<3;i++) {
    float d=warped-after*130.0+float(i)*32.0;
    float alive=secondary*smoothstep(float(i)*0.24,float(i)*0.24+0.15,after);
    float e=exp(-d*d/360.0)*alive/(1.0+r*0.003);
    height+=sin(d*0.1)*e*0.5;
    slope+=cos(d*0.1)*e*0.5;
    lip+=exp(-d*d/(edgeWidth*edgeWidth))*alive*0.65/(1.0+r*0.002);
  }
  return vec4(height,slope,lip,shadow);
}
void main() {
  vec2 p=v_uv*SIZE,q=p-u_contact;
  float phase=u_clock.x;
  float aa=max(0.8,SIZE.x/max(u_resolution.x,1.0));
  vec4 wave=ripple(q,max(2.2,aa*1.1));
  float flow=sin(q.x*0.012+sin(q.y*0.017+phase)*1.1-phase*2.0);
  float fine=sin(q.y*0.092+sin(q.x*0.018+phase)*1.3+phase*3.0);
  float cross=sin(q.y*0.035-q.x*0.021-phase);
  float poolRadius=length((p-vec2(768.0,670.0))/vec2(755.0,283.0));
  float pool=1.0-smoothstep(0.91,1.035,poolRadius);
  float water=smoothstep(-235.0,-100.0,q.y)*pool;
  float distanceFade=exp(-abs(q.y)*0.0018);
  float etched=pow(max(0.0,fine),14.0/(1.0+aa*.2))*(0.3+0.7*pow(max(0.0,flow),2.0));
  float currents=(0.027+etched*0.061+max(0.0,cross)*0.018)*water*distanceFade;
  float directional=0.45+0.55*pow(max(0.0,dot(normalize(vec2(q.x,q.y*3.4)+vec2(.01)),normalize(vec2(-0.65,0.25)))),2.0);
  float ridges=max(0.0,wave.y)*directional*0.20*water;
  vec3 color=mix(u_paper,u_ink,clamp(currents+ridges,0.0,0.45));
  float poolRim=exp(-pow(abs(poolRadius-0.965)*115.0,2.0));
  float rimSegments=pow(max(0.0,sin(p.x*.006+phase)*cos(p.y*.013)),2.0);
  color=mix(color,u_ink,poolRim*rimSegments*0.10);
  // Architecture exists inside the reflecting plane. The travelling contact
  // front acts locally, leaving distant towers intact until the wave arrives.
  float worldRadius=length(vec2(q.x,q.y*3.4));
  float awakened=smoothstep(worldRadius-65.0,worldRadius+65.0,u_story.y)*smoothstep(0.0,25.0,u_story.y);
  float frontDistance=worldRadius-u_story.y;
  float tearing=exp(-frontDistance*frontDistance/14000.0)*smoothstep(0.0,50.0,u_story.y);
  vec2 worldUV=(p-vec2(70.0,355.0))/vec2(1396.0,560.0);
  float ribbonRow=floor(p.y/9.0);
  float wetRefraction=sin(p.y*.067-phase*2.0+sin(p.x*.004))*3.6+sin(p.y*.113+phase)*1.3;
  worldUV.x+=(flow*2.0+wetRefraction+wave.x*6.0+tearing*(sin(ribbonRow*2.31)*36.0+sin(phase*2.0+p.y*.03)*23.0))/1396.0;
  worldUV.y+=(fine*0.9+tearing*sin(p.x*.017+phase)*5.0)/560.0;
  // A literal upside-down reflection, never a miniature standing on the pool.
  vec2 reflectedWorldUV=vec2(worldUV.x,1.0-worldUV.y);
  vec4 city=texture(u_world,clamp(reflectedWorldUV,vec2(0.0),vec2(1.0)));
  float sourceBounds=step(0.0,worldUV.x)*step(worldUV.x,1.0)*step(0.0,worldUV.y)*step(worldUV.y,1.0);
  float cityAlpha=city.a*sourceBounds*u_story.x*pool*(1.0-awakened)*(0.87-tearing*0.30);
  color=mix(color,material(sourceTone(city)),cityAlpha);
  float thread=1.0-smoothstep(0.065,0.24,abs(sin(p.y*.21+flow*1.7)));
  float strands=thread*tearing*pool*city.a*smoothstep(0.18,0.7,sourceEnergy(city))*u_story.x;
  color=mix(color,u_ink*.78+u_highlight*.22,strands*.50);
  // Sparse wet bands cross the architecture from the opening shot. Their
  // narrow highlight and offset dark side expose the moving mirror surface.
  float wetPhase=p.y*.055+sin(p.x*.009+phase)*.45-phase;
  float wetBand=1.0-smoothstep(.035,.08+aa*.02,abs(sin(wetPhase)));
  float wetShade=1.0-smoothstep(.035,.09+aa*.02,abs(sin(wetPhase-.16)));
  float wetSegments=.25+.75*pow(max(0.0,sin(p.x*.008+phase+p.y*.003)),2.0);
  float wetCoverage=pool*city.a*u_story.x*(1.0-awakened)*wetSegments;
  color=mix(color,u_paper,wetShade*wetCoverage*.22);
  color=mix(color,u_ink*.85+u_highlight*.15,wetBand*wetCoverage*.17);
  // A compressed mirror image, refracted by broad current and the same packets.
  float depth=max(q.y,0.0);
  vec2 reflected=vec2(p.x+(flow*1.6+wave.x*7.0)*smoothstep(0.0,55.0,depth),u_contact.y-depth/0.56);
  reflected.y+=sin(q.y*0.125+phase*2.0)*1.2+wave.y*1.7;
  vec4 reflection=hand(reflected);
  float reflectionAlpha=reflection.a*0.42*exp(-depth/170.0)*smoothstep(0.0,4.0,q.y);
  reflectionAlpha*=(0.75+0.25*sin(q.y*0.07+flow*0.7+phase))*(0.25+0.75*awakened);
  color=mix(color,material(sourceTone(reflection)),reflectionAlpha);
  // Narrow lips and shaded opposite faces make individual travelling waves
  // readable at mobile scale. They remain arcs, rather than luminous discs.
  color=mix(color,u_light>0.5?u_ink:u_paper*0.58,
    clamp(wave.w*water*(u_light>0.5?0.14:0.32),0.0,0.42));
  color=mix(color,u_ink*0.8+u_highlight*0.2,
    clamp(wave.z*water*directional*(u_light>0.5?0.36:0.60),0.0,0.66));
  float filamentPhase=q.y*0.031+2.2*sin(q.x*0.006-phase)+0.5*sin(q.x*0.019+phase*2.0);
  float filament=1.0-smoothstep(0.014,0.05+aa*0.015,abs(sin(filamentPhase)));
  float filamentBreak=0.15+0.85*pow(max(0.0,sin(q.x*0.006+phase+q.y*0.01)),2.0);
  float foreground=smoothstep(40.0,110.0,q.y)*(1.0-smoothstep(260.0,420.0,q.y));
  color=mix(color,u_ink,filament*filamentBreak*foreground*water*0.145);
  // Small lens of displaced water, not a bright aura around the finger.
  float rimDistance=length(vec2(q.x,q.y*3.8))-10.0;
  float meniscus=exp(-rimDistance*rimDistance/9.0)*u_clock.y;
  color=mix(color,u_ink,meniscus*0.16);
  vec4 figure=hand(p);
  color=mix(color,material(sourceTone(figure)),figure.a);
  // A clinging drop elongates, detaches and falls. Its impact launches the
  // secondary packet above; no timer-driven decorative particles are used.
  // Keep the detached drop readable on a phone without magnifying the hand.
  vec2 droplet=(p-vec2(u_drop.x,u_story.z))/vec2(max(8.0,aa*2.0),max(u_drop.y,aa*2.8));
  float dropDistance=length(droplet);
  float dropBody=(1.0-smoothstep(0.78,1.08,dropDistance))*u_story.w;
  float dropRim=exp(-pow(abs(dropDistance-0.82)*4.5,2.0))*u_story.w;
  color=mix(color,u_paper*.7,dropBody*.75);
  color=mix(color,u_ink*.7+u_highlight*.3,dropRim*.75);
  float glint=exp(-dot(droplet-vec2(-.3,-.35),droplet-vec2(-.3,-.35))*28.0)*u_story.w;
  color=mix(color,u_highlight,glint*.8);
  float edge=smoothstep(0.0,0.105,v_uv.x)*smoothstep(0.0,0.105,1.0-v_uv.x);
  edge*=smoothstep(0.0,0.10,v_uv.y)*smoothstep(0.0,0.13,1.0-v_uv.y);
  color=mix(u_paper,color,mix(1.0,edge,u_detail.w));
  o=vec4(color,1.0);
}
