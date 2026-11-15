// The plate that names what happens, drawn over everything inside its own
// little square of the canvas: a nearly opaque dark plate with cut corners
// and a fine border, the words from the atlas in the theme's pale, and a
// leader from the named point, ending in a dot. Rust lays it out in canvas
// pixels (y up). Output is premultiplied.
uniform vec4 u_plate; // left, bottom, right, top
uniform vec4 u_text;  // text left, top of its capitals, canvas px per atlas px, letters shown
uniform vec4 u_lead;  // from (x, y), to (x, y)
uniform vec4 u_lab;   // alpha, row, capital height in px
uniform sampler2D u_atlas;
out vec4 o;

void main() {
  vec2 p = gl_FragCoord.xy;
  float cap = u_lab.z;
  float row = u_lab.y;
  vec2 c = (u_plate.xy + u_plate.zw) * 0.5;
  vec2 q = abs(p - c) - (u_plate.zw - u_plate.xy) * 0.5;
  float d = max(max(q.x, q.y), (q.x + q.y + 0.45 * cap) * 0.70710678);
  float fill = clamp(0.5 - d, 0.0, 1.0);
  float border = clamp(1.0 - abs(d + 0.5), 0.0, 1.0);
  // the words: atlas px from canvas px
  float k = u_text.z;
  vec2 a = vec2(TEXT_X + (p.x - u_text.x) / k, row * ROW + CAPS.x + (u_text.y - p.y) / k);
  float shown = floor(u_text.w + 1e-3);
  float lod = max(log2(1.0 / k) - 0.5, 0.0);
  float ink = textureLod(u_atlas, a / ATLAS, lod).r;
  ink *= step(TEXT_X - 6.0, a.x) * step(a.x, TEXT_X + shown * ADVANCE - SPACING * 0.5);
  ink *= step(row * ROW + LABEL_BAND.x - 3.0, a.y) * step(a.y, row * ROW + LABEL_BAND.y + 3.0);
  // the leader and its dot, outside the plate
  float h;
  float dl = segd(p, u_lead.xy, u_lead.zw, h);
  float lead = clamp(1.0 - dl, 0.0, 1.0) * step(0.0, d) * 0.8;
  float spot = clamp(2.7 - length(p - u_lead.xy), 0.0, 1.0);
  vec3 col = u_backdrop * 0.55 * 0.88 * fill
           + mix(u_pale, u_cold, 0.3) * 0.55 * border
           + u_pale * ink * fill
           + u_pale * max(lead, spot);
  o = vec4(col, 0.88 * fill) * u_lab.x;
}
