import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// A panel starts fully masked and waits for the glass surface's scan to reveal it. When the GPU
// surface or the whole engine cannot start, the content must still be shown, as on native
// (Art.native.tsx reports a finished reveal on error). Only React and the adapters are fake.
function load(file, modules) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, console: { error() {} }, Float64Array, Event, ResizeObserver: class { observe() {} disconnect() {} }, setTimeout, clearTimeout, queueMicrotask,
    require: name => { if (name in modules) return modules[name]; throw new Error(`unexpected import ${name}`); } });
  return exports;
}
function hooks() {
  const slots = [], pending = []; let cursor = 0;
  const react = {
    useRef(value) { const id = cursor++; return slots[id] ??= { current: value }; },
    useState(value) { const id = cursor++; if (!(id in slots)) slots[id] = typeof value === 'function' ? value() : value; return [slots[id], next => { slots[id] = next; }]; },
    useCallback(fn) { return fn; },
    useEffect(fn) { pending.push(fn); },
  };
  return { react, begin() { cursor = 0; }, effects() { pending.splice(0).forEach(fn => fn()); } };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const element = () => ({ dataset: {}, style: {}, dispatchEvent() {}, hasAttribute: () => false });

test('a glass surface that cannot start reports a finished reveal and readiness', async () => {
  const h = hooks(), reveal = [], ready = [];
  const { RustGlass } = load('./RustGlass.web.tsx', {
    react: h.react, 'expo-router': { useIsFocused: () => true }, 'react-native': { View: 'View' },
    './EffectsQuality': { useEffectsController: () => ({}) },
    './rustEngine.web': { rustSession: () => Promise.reject(new Error('no WebGL or WebGPU')), sceneAssets: async () => null },
    './ArtUnavailable': { ArtUnavailable: () => null },
    './motion-visibility.web': { observeMotionVisibility: () => () => {} },
    'react/jsx-runtime': { jsx: (_tag, props) => { if (props.ref && !props.ref.current) props.ref.current = element(); return props; } },
  });
  h.begin(); RustGlass({ kind: 'glass', height: 100, width: 200, onRevealProgress: value => reveal.push(value), onReady: () => ready.push(true) });
  h.effects(); await settle();
  assert.deepEqual(reveal, [1]);
  assert.equal(ready.length, 1);
});

test('a panel shows its content when the graphics engine cannot load', async () => {
  const h = hooks();
  const { usePanelReveal } = load('./PanelReveal.web.tsx', {
    react: h.react, 'react-native': { Animated: { Value: class { constructor(value) { this.value = value; } } }, View: 'View' },
    './rustEngine.web': { loadGraphics: () => Promise.reject(new Error('engine failed')) },
  });
  h.begin(); const panel = usePanelReveal(true, false);
  assert.equal(panel.initialStyle.maskImage, 'linear-gradient(transparent,transparent)');
  panel.ref.current = element();
  h.effects(); await settle();
  assert.equal(panel.ref.current.style.maskImage, 'none');
  assert.equal(panel.ref.current.style.webkitMaskImage, 'none');
});

test('a scanned transition shows its content when the graphics engine cannot load', async () => {
  const h = hooks(); let rendered;
  const { RustMotion } = load('./RustMotion.web.tsx', {
    react: { ...h.react, useMemo: fn => fn(), useLayoutEffect: h.react.useEffect },
    'react/jsx-runtime': { jsx: (_tag, props) => { if (props.ref && !props.ref.current) props.ref.current = element(); rendered = props; return props; } },
    'expo-router': { useIsFocused: () => true },
    './EffectsQuality': { useEffectsController: () => ({ register: () => () => {}, frameJob: () => () => {}, activity() {} }) },
    './useSystemReducedMotion.web': { useSystemReducedMotion: () => false },
    './motion-visibility.web': { motionSettledEvent: 'watcher-motion-settled' },
    './rustEngine.web': { loadGraphics: () => Promise.reject(new Error('engine failed')) },
  });
  h.begin(); RustMotion({ target: [1, 0, 0, 1, 0, 100], curve: [.22, .8, .2, 1], scanDuration: 600 });
  assert.equal(rendered.style.maskImage, 'linear-gradient(transparent,transparent)');
  h.effects(); await settle();
  assert.equal(rendered.ref.current.style.maskImage, 'none');
  assert.equal(rendered.ref.current.style.webkitMaskImage, 'none');
});
