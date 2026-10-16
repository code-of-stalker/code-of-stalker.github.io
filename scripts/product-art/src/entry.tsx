import { createRoot } from 'react-dom/client';
import { createRef, useEffect, useLayoutEffect, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import { ArchitectureCover } from './laboratory/components/architecture/ArchitectureCover';
import { normalizeArchitectureSettings } from './laboratory/components/architecture/architectureSettings';
import { DiaryCover } from './laboratory/components/diary/DiaryCover';
import { normalizeDiarySettings } from './laboratory/components/diary/diarySettings';
import { AttentionAwareness } from './laboratory/components/matrix/AttentionAwareness';
import { ComparisonScan } from './laboratory/components/matrix/ComparisonScan';
import { CrowdAwareness } from './laboratory/components/matrix/CrowdAwareness';
import { VoiceArtwork } from './VoiceArtwork';
import { BasicCover } from './BasicCover';
import { MatrixInsight } from './MatrixInsight';
import { RainArtwork } from './RainArtwork';
import type { VoiceSpectrum } from '../../../src/features/product/audio/spectrum';
import architecturePreset from '../../../assets/product/motion/laboratory-architecture.json';
import diaryPreset from '../../../assets/product/motion/laboratory-diary.json';
import voicePreset from '../../../assets/product/motion/laboratory-voice.json';
import './style.css';
import { GlassLayer } from './GlassLayer';
import type { GlassController } from './GlassLayer';
import type { GlassShape } from '../../../src/features/product/motion/glassShape';
import { glassQuality, postArtMessage } from './qualityRuntime';
import { fitCardArtwork } from './cardViewport';

type Settings = { externalGlass?: boolean; glass?: GlassShape; scanOnMount?: boolean; lockProgress?: number; locked?: boolean; kind: string; active: boolean; decoderVisible: boolean; reducedMotion: boolean; level: number; spectrum?: VoiceSpectrum; mode: 'idle' | 'record' | 'playback'; presentation: 'card' | 'artwork' };
type Interaction = { action: 'hold' | 'release' | 'move' | 'tap' | 'glass-press' | 'glass-move' | 'glass-release'; x?: number; y?: number };
declare global { interface Window { __WATCHER_ART_INITIAL__: Partial<Settings>; __watcherReduced: (value: boolean) => void; WatcherArt: { update: (p: Partial<Settings>) => void; interact: (p: Interaction) => void }; WatcherEffects: { message: (value: { type?: string; level?: unknown }) => void }; ReactNativeWebView?: { postMessage: (s: string) => void }; } }
const root = createRoot(document.getElementById('art')!);
const controller = createRef<{ svg: () => string; hold: () => void; release: () => void; move: (x: number, y: number) => void }>();
const glassController = createRef<GlassController>();
let props: Settings = { kind: 'distance', active: true, decoderVisible: false, reducedMotion: false, level: 0, mode: 'record', presentation: 'artwork', ...window.__WATCHER_ART_INITIAL__ };
const sample = () => props.spectrum ?? { low: props.level, mid: props.level * .78, high: props.level * .46 };
let ready = false;
function ExternalCardArtwork({children}: PropsWithChildren) {
  const element=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const root=element.current;if(!root)return;
    const fit=()=>root.querySelectorAll<SVGSVGElement>('svg.architecture-artwork,svg.diary-artwork').forEach(fitCardArtwork);
    const observer=new ResizeObserver(fit);observer.observe(root);fit();
    return()=>observer.disconnect();
  },[]);
  return <div className="product-glass-source" ref={element}>{children}</div>;
}
function Ready() {
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      ready = true; postArtMessage({ type: 'watcher-art-ready' }); window.ReactNativeWebView?.postMessage('ready');
    }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, []);
  return null;
}
function draw() {
  const { kind, active, reducedMotion } = props;
  document.body.dataset.kind = kind;
  document.body.dataset.paused = String(!active);
  document.body.dataset.reduced = String(reducedMotion);
  document.body.dataset.presentation = props.presentation;
  const a = normalizeArchitectureSettings(architecturePreset.settings);
  a.labels = false; a.frame = false;
  const d = normalizeDiarySettings(diaryPreset.settings);
  d.labels = false; d.frame = false;
  const continuous = ['rain','basic','insight','voice','comparison','attention','crowd'].includes(kind)
    || (kind === 'diary' ? d.playing : a.playing);
  glassQuality.vector(active && !reducedMotion && kind !== 'glass' && continuous);
  const common = { active, presentation: 'artwork' as const, interactive: false, controller };
  let art;
  if (kind === 'rain') art = <RainArtwork active={active} reducedMotion={reducedMotion} />;
  else if (kind === 'glass') art = null;
  else if (kind === 'basic') art = <BasicCover active={active} reducedMotion={reducedMotion}/>;
  else if (kind === 'insight') art = <MatrixInsight active={active && !reducedMotion} decoderVisible={props.decoderVisible}/>;
  else if (kind === 'voice') art = <VoiceArtwork active={active} sample={sample} preset={voicePreset} mode={props.mode} lockProgress={() => props.lockProgress ?? 0} locked={props.locked ?? false}/>;
  else if (kind === 'diary') art = <DiaryCover {...common} settings={d}/>;
  else if (kind === 'comparison') art = <ComparisonScan playing={active && !reducedMotion}/>;
  else if (kind === 'attention') art = <AttentionAwareness playing={active && !reducedMotion}/>;
  else if (kind === 'crowd') art = <CrowdAwareness playing={active && !reducedMotion}/>;
  else {
    a.illustration = kind === 'distance' ? 'distance' : kind === 'intensive' ? 'synchronization' : kind === 'guidance' || kind === 'parallel' ? 'guidance' : 'cell';
    if (kind === 'parallel') a.guidanceVariant = 'parallel';
    art = <ArchitectureCover {...common} settings={a}/>;
  }
  root.render(<><Ready />{props.externalGlass && props.presentation === 'card'
    ? <ExternalCardArtwork>{art}</ExternalCardArtwork>
    : kind === 'glass' || props.presentation === 'card'
    ? <GlassLayer shape={props.glass} active={active} reducedMotion={reducedMotion} controller={glassController} scanOnMount={props.scanOnMount}>{art}</GlassLayer>
    : art}</>);
}
window.WatcherArt = { update(next) {
  const redraw = ['kind', 'active', 'decoderVisible', 'reducedMotion', 'mode', 'presentation', 'locked', 'glass'].some(key => key in next && next[key as keyof Settings] !== props[key as keyof Settings]);
  props = { ...props, ...next, level: typeof next.level === 'number' ? Math.max(0, Math.min(1, next.level)) : props.level };
  window.__watcherReduced(props.reducedMotion);
  if (redraw) draw();
}, interact(value) {
  if (!props.active || props.reducedMotion) return;
  if (value.action === 'glass-press' || value.action === 'glass-move') { glassController.current?.pointer(value.x ?? .5, value.y ?? .5, true, value.action === 'glass-press'); return; }
  if (value.action === 'glass-release') { glassController.current?.release(); return; }
  if (!controller.current) return;
  if (value.action === 'hold') controller.current.hold();
  else if (value.action === 'release') { controller.current.release(); controller.current.move(0, 0); }
  else if (value.action === 'move') controller.current.move(Math.max(-1, Math.min(1, value.x || 0)), Math.max(-1, Math.min(1, value.y || 0)));
  else if (value.action === 'tap') { controller.current.hold(); window.setTimeout(() => controller.current?.release(), 90); }
} };
window.WatcherEffects = { message(value) {
  if (value?.type === 'watcher-quality') glassQuality.update(value.level);
  else if (value?.type === 'watcher-quality-report') glassQuality.report();
  else if (value?.type === 'watcher-art-ready-check' && ready) postArtMessage({ type: 'watcher-art-ready' });
} };
window.addEventListener('message', event => {
  if (event.source !== window.parent) return;
  try {
    const value = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (value?.type === 'watcher-art') window.WatcherArt.update(value.props);
    else if (value?.type === 'watcher-art-interaction') window.WatcherArt.interact(value);
    else window.WatcherEffects.message(value);
  } catch { /* Ignore unrelated frames. */ }
});
draw();
