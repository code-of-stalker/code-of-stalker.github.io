import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const project = fileURLToPath(new URL('../../../../', import.meta.url));
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename);
  if (filename.endsWith('.json')) return JSON.parse(readFileSync(filename, 'utf8'));
  const exports = {}; cache.set(filename, exports);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, Math, Number, Uint8Array, JSON,
    require(specifier) { const base = path.resolve(path.dirname(filename), specifier); return load(existsSync(base) ? base : base + '.ts'); },
  }, { filename });
  return exports;
}
const shape = load(path.join(project, 'src/features/product/motion/glassShape.ts'));
const viewport = load(path.join(project, 'scripts/product-art/src/cardViewport.ts'));
const glassRoot = path.join(project, 'scripts/product-art/src/laboratory/liquid-glass');
const { normalizeLiquidGlassSettings } = load(path.join(glassRoot, 'settings.ts'));
const preset = load(path.join(project, 'assets/product/motion/laboratory-glass.json'));

test('reading menu follows the real close contour with a fixed visible gap at fractional sizes', () => {
  const { readingMenuPath, readingMenuClearance } = load(path.join(project, 'src/features/product/motion/reading-menu-geometry.ts'));
  for (const [width, height, overhang] of [[264,300,12],[329,338,12],[384,400,16],[416.5,500.25,16]]) {
    const cutout = { left: width + overhang - 44, top: -37, width: 44, height: 42 };
    const icon = shape.linePolygons(shape.productIconPath(44,42))[0].map(([x,y])=>[x+cutout.left,y+cutout.top]);
    const panel = shape.linePolygons(readingMenuPath(width,height,cutout))[0];
    assert.equal(panel.length,6,'one concave corner, no detached masking patch');
    assert.ok(Math.abs(panel[3][1]-8.125)<1e-6,'lower edge stays 3px below the visible icon outline');
    for(let i=1;i<3;i++) {
      const a=panel[i],b=panel[i+1],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      const visibleGap=shape.contourDistance(...mid,[icon])-.25;
      assert.ok(Math.abs(visibleGap-readingMenuClearance)<1e-6,'both parallel edges retain the same clearance');
    }
    assert.ok(shape.contourDistance(width-2,2,[panel])>0,'button pocket is outside the panel');
    assert.ok(shape.contourDistance(width/2,50,[panel])<0,'ordinary list content stays inside');
    const preview=shape.linePolygons(readingMenuPath(width,height,{...cutout,top:-210}))[0];
    assert.equal(preview.length,4,'no cutout while the close button is above the menu');
  }
});

test('glass stays at one while contours and artwork retain their independent resolution', () => {
  const { glassDensity } = load(path.join(project, 'scripts/product-art/src/glassBudget.ts'));
  assert.equal(preset.pixelRatio, 1);
  for (const [width, height] of [[44,42],[288,202],[335,306],[416,520],[480,680]]) {
    const density = glassDensity(width,height,preset.pixelRatio);
    assert.equal(density,1);
  }
  assert.equal(glassDensity(44,42,1),1);
  assert.equal(glassDensity(44,42,3),1);
});

test('observer optimization retains every source vector and animation while removing two mask passes', () => {
  const { optimizeObserverMarkup } = load(path.join(project, 'scripts/product-art/src/observerMarkup.ts'));
  const source = readFileSync(path.join(project,'scripts/product-art/src/laboratory/assets/attention-awareness.svg'),'utf8');
  const optimized = optimizeObserverMarkup(source);
  const paths = svg => [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match=>match[1]).sort();
  assert.deepEqual(paths(optimized), paths(source));
  assert.equal(paths(optimized).length,10);
  assert.equal((source.match(/<mask\b/g)||[]).length,2);
  assert.equal((optimized.match(/<mask\b/g)||[]).length,0);
  assert.equal((optimized.match(/<filter\b/g)||[]).length,2);
  assert.equal((optimized.match(/<image\b/g)||[]).length,0);
  assert.equal(optimized.match(/<style>[\s\S]*?<\/style>/)[0],source.match(/<style>[\s\S]*?<\/style>/)[0]);
  const ids = new Set([...optimized.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
  for(const match of optimized.matchAll(/url\(#([^)]*)\)/g)) assert.ok(ids.has(match[1]),match[1]);
});

test('decoder stays hidden before visibility, including reduced motion, then reveals once triggered', () => {
  const { decoderFrame } = load(path.join(project, 'scripts/product-art/src/decoderFrame.ts'));
  for(const moving of [true,false]) {
    const frame=decoderFrame(50,Infinity,moving,3.1);
    assert.equal(frame.waiting,true); assert.equal(frame.opacity,0); assert.equal(frame.progress,0);
  }
  assert.equal(decoderFrame(9,10,true,3.1).opacity,0);
  assert.equal(decoderFrame(10,10,true,3.1).opacity,0);
  assert.ok(decoderFrame(10.2,10,true,3.1).opacity>0);
  const completed=decoderFrame(14,10,true,3.1);
  assert.equal(completed.waiting,false); assert.equal(completed.opacity,1); assert.equal(completed.progress,1);
  assert.equal(decoderFrame(10,10,false,3.1).opacity,1);
});

test('decoder waits for stable layout and enough visible copy, without requiring a scroll', () => {
  const { decoderIsVisible } = load(path.join(project,'src/features/product/motion/decoder-visibility.ts'));
  const bounds = {top:474,height:104};
  assert.equal(decoderIsVisible(bounds,{offset:0,height:525},false),false);
  assert.equal(decoderIsVisible(bounds,{offset:0,height:474},false),false);
  assert.equal(decoderIsVisible(bounds,{offset:20,height:474},true),false);
  assert.equal(decoderIsVisible(bounds,{offset:80,height:474},true),true);
  assert.equal(decoderIsVisible(bounds,{offset:580,height:474},true),false);
  assert.equal(decoderIsVisible(bounds,{offset:0,height:1000},true),true);
  assert.equal(decoderIsVisible(bounds,{offset:0,height:1000},false),false);
  assert.equal(decoderIsVisible(null,{offset:80,height:474},true),false);
});

test('every supplied glass setting reaches Laboratory normalization unchanged', () => {
  const material = normalizeLiquidGlassSettings(preset);
  for (const [key, value] of Object.entries(preset)) assert.equal(material[key], value, key);
  assert.equal(material.scanDuration, 1.5); assert.equal(material.pulseDuration, 2.5);
});
test('home glass follows each supplied SVG at the actual viewport breakpoints', () => {
  for (const [width, asset, originalWidth, originalHeight] of [[374, '320-374',289,201],[375,'375-439',344,283],[439,'375-439',344,283],[440,'440-plus',393,326],[500,'440-plus',393,326]]) {
    const svg = readFileSync(path.join(project, `assets/product/home-card-${asset}.svg`), 'utf8');
    const actual = shape.linePolygons(shape.homeGlassShape(width, 320, 430).path);
    const expected = shape.linePolygons(shape.fitPanelPath(svg.match(/<path d="([^"]+)"/)[1], originalWidth, originalHeight, 320, 430));
    assert.equal(actual.length, expected.length);
    for (let i=0;i<actual[0].length;i++) for(let axis=0;axis<2;axis++) assert.ok(Math.abs(actual[0][i][axis]-expected[0][i][axis]) < 1e-8);
  }
});
test('authored corners retain both offsets when panel width and height change independently', () => {
  const sources = [
    ['assets/product/home-card-320-374.svg',289,201],
    ['assets/product/home-card-375-439.svg',344,283],
    ['assets/product/home-card-440-plus.svg',393,326],
    ['assets/product/levels/basic-action.svg',264,42],
    ['assets/product/levels/intensive-action.svg',264,42],
    ['assets/product/review/sources.json',264,42],
  ];
  for (const [filename,w,h] of sources) {
    const data=readFileSync(path.join(project,filename),'utf8'),svg=filename.endsWith('.json')?JSON.parse(data).action:data;
    const source=svg.match(/\bd="([^"]+)"/)[1];
    const original=shape.linePolygons(source)[0];
    for (const [width,height] of [[288,62],[335,440],[416,850],[700,200]]) {
      const fitted=shape.linePolygons(shape.fitPanelPath(source,w,h,width,height))[0];
      for(let i=0;i<original.length;i++) {
        const j=(i+1)%original.length,dx=original[i][0]-original[j][0],dy=original[i][1]-original[j][1];
        if (Math.abs(dx)>.001&&Math.abs(dy)>.001&&Math.abs(dx/dy)>.5&&Math.abs(dx/dy)<2) {
          assert.ok(Math.abs(fitted[i][0]-fitted[j][0]-dx)<1e-7,filename+' horizontal cut');
          assert.ok(Math.abs(fitted[i][1]-fitted[j][1]-dy)<1e-7,filename+' vertical cut');
        }
      }
    }
  }
  assert.throws(()=>shape.fitPanelPath('M0 0H10V10Z',0,10,20,20));
});
test('step header notches translate horizontally without changing their width or depth', () => {
  for (const width of [288,335,416,700]) for (const height of [180,400,850]) {
    const {top,body}=shape.stepPanelPaths(width,height),p=shape.linePolygons(top)[0];
    assert.equal(p[4][0]-p[7][0],60);
    assert.equal(p[5][1]-p[4][1],12);
    assert.equal(p[6][0]-p[5][0],-36);
    assert.equal(p[7][0],width-136);
    assert.equal(Math.max(...shape.linePolygons(body)[0].map(([_,y])=>y)),height-.25);
  }
  const source=shape.stepPanelPaths(288,314).path;
  const fitted=shape.linePolygons(shape.fitPanelPath(source,288,314,416,700));
  assert.deepEqual(fitted,shape.linePolygons(shape.stepPanelPaths(416,700).path));
});
test('glass distance field preserves the notch gap and the body rather than bridging it', () => {
  const polygons = shape.linePolygons(shape.stepPanelPaths(288, 400).path);
  assert.ok(shape.contourDistance(20, 10, polygons) < 0);
  assert.ok(shape.contourDistance(20, 29, polygons) > 0);
  assert.ok(shape.contourDistance(20, 80, polygons) < 0);
  const field = shape.contourPixels({width:288,height:400,path:shape.stepPanelPaths(288,400).path});
  assert.ok(field.width <= 192 && field.height <= 384);
  assert.equal(field.pixels.length, field.width*field.height*4);
});
test('tall and short cards map their soft fade to the actual card bottom', () => {
  for (const [width,height] of [[288,200],[343,309],[320,530],[416,240]]) {
    const view = viewport.cardViewport(width,height);
    assert.ok(Math.abs((view.bottom-view.y)/view.height*height-height) < 1e-8);
    assert.ok(view.fade >= 1 && view.fade < view.height);
    if (height/width !== 200/288) assert.notEqual(view.height,200);
  }
});
test('resize extends the internal clip and soft mask together', () => {
  const clip = new Map(), mask = new Map(), rect = new Map(), gradient = new Map(), attributes = new Map();
  const node = values => ({setAttribute(key,value){values.set(key,value);}});
  const svg = { classList: {contains:()=>false}, closest:()=>({}), getBoundingClientRect:()=>({width:320,height:500}),
    setAttribute(key,value){attributes.set(key,value);}, dataset:{},
    querySelectorAll:()=>[node(clip),node(mask),node(rect)], querySelector:()=>node(gradient),
  };
  viewport.fitCardArtwork(svg);
  const view = viewport.cardViewport(320,500);
  for (const values of [clip,mask,rect]) { assert.equal(Number(values.get('height')),view.height); assert.equal(Number(values.get('y')),view.y); }
  assert.equal(Number(gradient.get('y2')),view.bottom);
  assert.equal(Number(gradient.get('y1')),view.bottom-view.fade);
});
test('touch inertia uses the provided lag and releases pressure without hiding the panel', () => {
  const { GlassMotion } = load(path.join(glassRoot, 'GlassMotion.ts'));
  const motion = new GlassMotion();
  motion.setPointer(.4,.6,true);
  motion.setPointer(.9,.2,true);
  motion.step(.05,preset);
  assert.ok(motion.pressure > 0 && motion.pointerX < .9);
  motion.releasePointer();
  for(let i=0;i<80;i++) motion.step(.05,preset);
  assert.equal(motion.pressure,0);
  assert.equal(motion.scanProgress,1);
});
test('the faster reveal completes and the contact pulse never hides existing content', () => {
  const { GlassMotion } = load(path.join(glassRoot, 'GlassMotion.ts'));
  const { getLayoutScanStyle } = load(path.join(glassRoot, 'scanReveal.ts'));
  const { PanelPulseReveal, makePixelRevealState, getPixelRevealCell } = load(path.join(glassRoot, 'pixelReveal.ts'));
  const motion = new GlassMotion();
  motion.replayReveal(preset.scanEnabled);
  assert.equal(getLayoutScanStyle(motion.scanProgress,preset).revealing,true);
  motion.step(.75,preset);
  assert.equal(motion.scanProgress,.5);
  motion.step(.75,preset);
  assert.equal(getLayoutScanStyle(motion.scanProgress,preset).mask,'none');
  const pulse = new PanelPulseReveal();
  pulse.trigger(.2,.8,false);
  pulse.step(1.25,preset.pulseDuration,preset.pulseRevealEnabled,false);
  assert.equal(pulse.progress,.5);
  const state = makePixelRevealState(pulse.x,pulse.y,pulse.progress,335,512,preset.pulseCellSize,preset.pulseSoftness);
  for (let row=0;row<22;row++) for(let column=0;column<14;column++) assert.equal(getPixelRevealCell(state,column,row).visibility,1);
  pulse.step(1.25,preset.pulseDuration,preset.pulseRevealEnabled,false);
  assert.equal(pulse.progress,1);
  pulse.trigger(.2,.8,true);
  assert.equal(pulse.progress,1);
});
