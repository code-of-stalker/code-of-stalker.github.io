// The standing person: Art's approved figure (spoken-thought-person.svg)
// above the waist, unchanged, and below it a hanging forearm and hand, the
// hips and the legs, drawn here in the trace's own line. SVG units of that
// file; the soles stand on FLOOR. Loaded as a plain script by
// prepare-assets.mjs (and by a preview page), it sets `globalThis.standing`.
globalThis.standing = (() => {
  // The seated drawing is kept above CUT; its chair's backrest (x < 33
  // below y 186) goes.
  const CUT = 236;
  const FLOOR = 660;
  const VIEW = [200, 672];
  const keep = g => {
    g.beginPath();
    g.rect(0, 0, VIEW[0], 186);
    g.rect(33, 186, VIEW[0] - 33, CUT - 186);
    g.clip();
  };
  // The body's outline below the cut: the back from the waist down to the
  // heel, the sole, then the front from the toes up to the waist. The first
  // points continue the seated drawing's lines where they are cut.
  const back = [
    [43.8, 232], [45.2, 238], [48.6, 252], [49.2, 266], [46.4, 284], [40.6, 304], [37.8, 322],
    [38.8, 340], [43.6, 354], [48.6, 366], [51.4, 390], [54.6, 420], [58.6, 452], [62.6, 478],
    [63.4, 492], [58.6, 508], [54.4, 530], [54.6, 556], [58.4, 584], [63.8, 608], [68.2, 628],
    [67.4, 640], [63.2, 648], [62.4, 655], [66, FLOOR],
  ];
  const sole = [[66, FLOOR], [150, FLOOR]];
  const front = [
    [150, FLOOR], [156.4, 659], [157.2, 655.5], [151, 652.5], [138, 649.4], [122, 644.6], [108, 638],
    [99.6, 631], [97.4, 624], [99.4, 604], [102.6, 578], [105.4, 550], [107.8, 524], [112.6, 509],
    [116.8, 497], [117, 485], [114.6, 474], [117.6, 452], [122.6, 420], [126.2, 388], [127.2, 360],
    [126.4, 336], [127, 312], [129.6, 290], [131.6, 268], [132.6, 250], [132.6, 238], [132.5, 232],
  ];
  // The near arm hangs: the upper arm's two edges run on to the elbow, the
  // forearm down to the wrist, the hand (its back to us, the thumb forward)
  // to the middle of the thigh.
  const arm = [
    // back edge: triceps, elbow, forearm, wrist, little finger side
    [[57.8, 232], [60.6, 240], [65.2, 254], [69.4, 268], [72.2, 282], [73.4, 296], [75.6, 318],
      [79.8, 342], [84.4, 362], [83.4, 380], [83.8, 398], [87.4, 414], [92.8, 427], [99.4, 432.6],
      [104.2, 428.5], [106.4, 418], [106.6, 405]],
    // front edge: biceps, the elbow's fold, the forearm's swell, the wrist,
    // the thumb
    [[96.85, 232], [97.4, 240], [97.8, 252], [96.6, 266], [95.6, 280], [98.6, 296], [102.4, 316],
      [104.4, 338], [104.2, 356], [106.2, 368], [110.4, 382], [112.6, 394], [111.2, 401.5],
      [107.4, 401], [104.8, 392]],
  ];
  // Thinner lines inside, fading at both ends: the abdomen's line running
  // out, the groin, the fold under the buttock, the thigh's muscles, the
  // kneecap and the hollow of the knee, the calf, the ankle bone, the
  // fingers.
  const inner = [
    [[127.5, 232], [127, 240], [126.4, 252], [125.2, 262]],
    [[106, 296], [114, 306], [121.4, 318]],
    [[45.4, 358], [54, 362], [63.4, 361]],
    [[92.6, 370], [94.2, 404], [95.4, 440], [97.4, 470]],
    [[112.4, 470], [118.2, 484], [116.6, 498], [111.4, 506]],
    [[63, 487], [70.8, 494]],
    [[60.6, 512], [69.4, 534], [72.6, 560], [71, 586]],
    [[80.2, 621], [84.4, 626.6], [83, 633.4]],
    [[91.6, 409], [94.4, 424]],
    [[98.2, 407], [100.6, 426]],
    [[103.6, 379], [107.6, 393]],
  ];
  // A Catmull-Rom curve through the points, sampled every `step` units.
  const sample = (pts, step = 0.5) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t
          + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  };
  // `on`: carry on the current subpath instead of starting a new one.
  const path = (g, pts, on = false) => {
    const s = sample(pts);
    if (on) g.lineTo(s[0][0], s[0][1]); else g.moveTo(s[0][0], s[0][1]);
    for (const p of s.slice(1)) g.lineTo(p[0], p[1]);
  };
  // A brush line: `width` in the middle, tapering to `ends` × width.
  const brush = (g, pts, width, ends) => {
    const s = sample(pts, 0.25);
    s.forEach((p, i) => {
      const t = i / (s.length - 1);
      const w = width * (ends + (1 - ends) * Math.sqrt(Math.sin(Math.PI * t)));
      g.beginPath(); g.arc(p[0], p[1], w / 2, 0, 2 * Math.PI); g.fill();
    });
  };
  const OUTLINE = 2.7;
  // The opaque cover of the new part, its outline included.
  const cover = g => {
    g.beginPath();
    path(g, back);
    path(g, sole, true);
    path(g, front, true);
    g.closePath();
    g.fill();
    g.lineWidth = OUTLINE; g.lineJoin = 'round'; g.stroke();
  };
  // The ink of the new part.
  const ink = g => {
    g.lineWidth = OUTLINE; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const line of [back, sole, front, ...arm]) { g.beginPath(); path(g, line); g.stroke(); }
    for (const line of inner) brush(g, line, 2.1, 0.25);
  };
  return { CUT, FLOOR, VIEW, keep, cover, ink };
})();
