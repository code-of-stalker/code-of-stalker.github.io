import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useEffectsController } from './EffectsQuality';
import { loadGraphics } from './rustEngine.web';
import type { SvgTimeline } from './rustEngine.web';
import { ArtUnavailable } from './ArtUnavailable';
import { RustGlass } from './RustGlass.web';
import { artLabels } from './types';
import type { ArtProps, ArtController } from './types';
import { artHoldDelay } from './gesture';
import { fonts } from '../theme';
import { observeMotionVisibility } from './motion-visibility.web';
import { useThemeColors } from '../ProductTheme';
import { syncDecoderTheme } from './decoderTheme.web';
import { syncInlineVoiceTheme } from './inlineVoiceTheme';
import { syncLegacyIllustrationTheme } from './legacyTheme';
import { useCardPress } from './useCardPress';
import { observeDecoderCompletion } from './decoder-completion.web';

/** Migration adapter: Rust calculates vectors' motion; the browser paints the
 * exact approved SVG contours. It is labelled separately from the wgpu renderer. */
export function RustSvg(props: ArtProps) {
  const colors = useThemeColors(), palette = useRef(colors);
  const controller = useEffectsController(), focused = useIsFocused(), root = useRef<HTMLDivElement>(null);
  const press = useCardPress(props.onPress, props.presentation === 'card', !!props.reducedMotion, focused && props.active !== false);
  useLayoutEffect(() => { palette.current = colors; syncDecoderTheme(root.current?.shadowRoot, colors); syncInlineVoiceTheme(root.current?.shadowRoot, props.voiceCompact, colors); syncLegacyIllustrationTheme(root.current?.shadowRoot, colors); }, [colors, props.voiceCompact]);
  const latest = useRef(props), visible = useRef(true), motion = useRef<SvgTimeline | null>(null), glass = useRef<ArtController | null>(null);
  const focus = useRef(focused);
  useLayoutEffect(() => { latest.current = props; focus.current = focused; });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!controller || !root.current || failed) return;
    const host = root.current, shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' }), body = document.createElement('body'), element = document.createElement('div');
    body.dataset.kind = props.kind; body.style.cssText = 'margin:0;width:100%;height:100%;background:transparent;'; element.id = 'art';
    element.style.cssText = 'width:100%;height:100%;position:relative;overflow:visible'; body.append(element); shadow.replaceChildren(body);
    syncDecoderTheme(shadow, palette.current);
    syncInlineVoiceTheme(shadow, latest.current.voiceCompact, palette.current);
    syncLegacyIllustrationTheme(shadow, palette.current);
    let disposed = false, detach = () => {}, unregister = () => {}, stopDecoder = () => {};
    const stopVisibility = observeMotionVisibility(host, value => { visible.current = value; });
    const resize = new ResizeObserver(() => { const rect = host.getBoundingClientRect(); motion.current?.resize(rect.width, rect.height); }); resize.observe(host);
    void loadGraphics().then(module => {
      if (disposed) return;
      const node = module.SvgTimeline.create(element, latest.current.kind, latest.current.presentation === 'card'); motion.current = node;
      const current = latest.current, spectrum = current.audioSource?.read() ?? current.spectrum, level = current.audioSource ? 0 : current.level ?? 0;
      node.audio(spectrum?.low ?? level, spectrum?.mid ?? level, spectrum?.high ?? level, Float64Array.from(spectrum?.contour ?? []), current.mode === 'record' || current.mode === 'playback', current.lockProgress ?? 0, current.locked ?? false,current.mode==='playback');
      node.decoder_visible(current.decoderVisible ?? false);
      if (current.kind === 'insight') stopDecoder = observeDecoderCompletion(element, () => latest.current.onDecoderComplete?.());
      if (current.kind === 'insight') { const decoder = element.querySelector<HTMLElement>('.mx-decoder'); if (decoder) decoder.style.fontFamily = fonts.bodyBold; }
      void document.fonts.ready.then(() => { if (!disposed) { const bounds = host.getBoundingClientRect(); node.resize(bounds.width, bounds.height); } });
      const rect = host.getBoundingClientRect(); node.resize(rect.width, rect.height);
      const token = {}, intervals: number[] = []; let last: number | undefined, posted = 0, wasActive = false, ready = false;
      unregister = controller.register(token, `${artLabels[latest.current.kind]} · Rust motion`, message => {
        if ((message as { type: string }).type === 'watcher-clock-reset') { node.reset_clock(); last = undefined; intervals.length = 0; }
      });
      detach = controller.frameJob(at => {
        const props = latest.current, active = (props.active ?? true) && visible.current && focus.current;
        node.active(active, props.reducedMotion ?? false); controller.activity(token, active, active && !props.reducedMotion);
        if (active !== wasActive) { last = undefined; intervals.length = 0; wasActive = active; }
        if (!node.frame(at)) return;
        if (!ready) { ready = true; props.onReady?.(); }
        if (last !== undefined) { intervals.push(at - last); if (intervals.length > 180) intervals.shift(); } last = at;
        if (at - posted > 500) { const sorted = [...intervals].sort((a, b) => a - b), samples = sorted.length;
          controller.reportCadence(token, 'Rust timeline · browser SVG paint (migration)', samples > 6 ? { fps: 1000 * samples / intervals.reduce((a, b) => a + b, 0), p95: sorted[Math.ceil(samples * .95) - 1], samples } : undefined); posted = at;
        }
      });
      if (latest.current.controllerRef) latest.current.controllerRef.current = { interact: value => node.interact(value.action, value.x ?? 0, value.y ?? 0) };
    }).catch(problem => { if (!disposed) { host.dataset.graphicsError = String(problem); setFailed(true); } });
    return () => { disposed = true; stopDecoder(); stopVisibility(); resize.disconnect(); detach(); unregister(); motion.current?.dispose(); motion.current = null; if (latest.current.controllerRef) latest.current.controllerRef.current = null; };
  }, [controller, props.kind, failed]);
  const sendAudio = useCallback(() => {
    const current = latest.current, spectrum = current.audioSource?.read() ?? current.spectrum, level = current.audioSource ? 0 : current.level ?? 0;
    motion.current?.audio(spectrum?.low ?? level, spectrum?.mid ?? level, spectrum?.high ?? level, Float64Array.from(spectrum?.contour ?? []), current.mode === 'record' || current.mode === 'playback', current.lockProgress ?? 0, current.locked ?? false,current.mode==='playback');
  }, []);
  useEffect(() => { sendAudio(); }, [props.audioSource, props.spectrum, props.level, props.mode, props.lockProgress, props.locked, sendAudio]);
  useEffect(() => props.audioSource?.subscribe(sendAudio), [props.audioSource, sendAudio]);
  useEffect(() => { motion.current?.decoder_visible(props.decoderVisible ?? false); }, [props.decoderVisible]);
  const origin = useRef({ x: 0, y: 0 });
  const contact = (element: HTMLElement, x: number, y: number, pressed: boolean) => { const bounds = element.getBoundingClientRect(); glass.current?.interact({ type: 'watcher-art-interaction', action: pressed ? 'glass-move' : 'glass-release', x: (x - bounds.left) / bounds.width, y: (y - bounds.top) / bounds.height }); };
  if (failed || !controller) return <ArtUnavailable {...props} />;
  return <View style={[{ width: props.width ?? '100%', height: props.height }, props.style]}>
    {props.presentation === 'card' && <View pointerEvents="none" style={StyleSheet.absoluteFill}><RustGlass {...props} kind="glass" controllerRef={glass} onPress={undefined} /></View>}
    <div ref={root} data-graphics="rust-motion-svg" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} />
    {props.onPress && <button type="button" aria-label={props.accessibilityLabel ?? artLabels[props.kind]} disabled={props.active === false || !focused}
      style={{ position: 'absolute', inset: 0, background: 'transparent', border: 0, cursor: 'pointer', touchAction: 'pan-y' }}
      onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; origin.current = { x: event.clientX, y: event.clientY }; const bounds = event.currentTarget.getBoundingClientRect();
        motion.current?.pointer_down(performance.now(), bounds.width, bounds.height, artHoldDelay(props.kind)); event.currentTarget.setPointerCapture(event.pointerId); contact(event.currentTarget, event.clientX, event.clientY, true); }}
      onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; motion.current?.pointer_move(performance.now(), event.clientX - origin.current.x, event.clientY - origin.current.y); contact(event.currentTarget, event.clientX, event.clientY, true); }}
      onPointerUp={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const bounds = event.currentTarget.getBoundingClientRect(); const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
        if (motion.current?.pointer_up(performance.now(), inside)) press(); contact(event.currentTarget, event.clientX, event.clientY, false); event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => motion.current?.interact('release', 0, 0)} onLostPointerCapture={() => motion.current?.interact('release', 0, 0)}
      onClick={event => { if (event.detail === 0) { motion.current?.interact('tap', 0, 0); press(); } }} />}
  </View>;
}
