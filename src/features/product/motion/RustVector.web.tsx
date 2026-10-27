import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { rustSession, sceneAssets } from './rustEngine.web';
import type { RustSession } from './rustEngine.web';
import { useEffectsController } from './EffectsQuality';
import { RustGlass } from './RustGlass.web';
import { ArtUnavailable } from './ArtUnavailable';
import { artLabels } from './types';
import type { ArtProps, ArtController } from './types';
import { artHoldDelay } from './gesture';
import { fonts } from '../theme';
import { observeMotionVisibility } from './motion-visibility.web';
import { useThemeColors } from '../ProductTheme';
import { syncDecoderTheme } from './decoderTheme.web';
import { syncInlineVoiceTheme } from './inlineVoiceTheme';
import { useCardPress } from './useCardPress';
import { observeDecoderCompletion } from './decoder-completion.web';

/** React owns the accessible hit target and measured audio events. All geometry,
 * timelines, morphs, contacts and GPU submissions belong to the shared Rust scene. */
export function RustVector(props: ArtProps) {
  const colors = useThemeColors(), palette = useRef(colors);
  const insightTheme = props.kind === 'insight' ? colors.background : undefined;
  const root = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), controller = useEffectsController(), focused = useIsFocused();
  const press = useCardPress(props.onPress, props.presentation === 'card', !!props.reducedMotion, focused && props.active !== false);
  useLayoutEffect(() => { palette.current = colors; syncDecoderTheme(root.current?.shadowRoot, colors); syncInlineVoiceTheme(root.current?.shadowRoot, props.voiceCompact, colors); }, [colors, props.voiceCompact]);
  const latest = useRef(props), active = useRef({ focused, visible: true }), handle = useRef<ReturnType<RustSession['add']> | null>(null);
  const glass = useRef<ArtController | null>(null), origin = useRef({ x: 0, y: 0 }), [failed, setFailed] = useState<string>();
  useLayoutEffect(() => { latest.current = props; active.current.focused = focused; });
  const sendAudio = useCallback(() => { const current = latest.current, spectrum = current.audioSource?.read() ?? current.spectrum, level = current.audioSource ? 0 : current.level ?? 0;
    handle.current?.audio(spectrum?.low ?? level, spectrum?.mid ?? level, spectrum?.high ?? level, Float64Array.from(spectrum?.contour ?? []), current.mode === 'record' || current.mode === 'playback', current.lockProgress ?? 0, current.locked ?? false,current.mode==='playback');
  }, []);
  useEffect(() => {
    if (!root.current || !canvas.current || !controller || failed) return;
    const host = root.current, output = canvas.current, shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const body = document.createElement('body'), element = document.createElement('div'); body.dataset.kind = props.kind;
    body.style.cssText = 'width:100%;height:100%;margin:0;background:transparent'; element.id = 'art'; element.style.cssText = 'width:100%;height:100%;position:relative;overflow:visible'; body.append(element); shadow.replaceChildren(body);
    syncDecoderTheme(shadow, palette.current);
    syncInlineVoiceTheme(shadow, latest.current.voiceCompact, palette.current);
    let disposed = false, stopDecoder = () => {};
    const activity = () => handle.current?.active((latest.current.active ?? true) && active.current.focused && active.current.visible, latest.current.reducedMotion ?? false);
    const resize = () => { const bounds = output.getBoundingClientRect(); if (bounds.width > 0 && bounds.height > 0) handle.current?.resize({ width: bounds.width, height: bounds.height, path: `M0 0H${bounds.width}V${bounds.height}H0Z`, background: 'clear' }); };
    const size = new ResizeObserver(resize); size.observe(output);
    const stopVisibility = observeMotionVisibility(output, visible => { active.current.visible = visible; activity(); });
    void Promise.all([rustSession(controller), sceneAssets(latest.current.kind)]).then(([session]) => {
      if (disposed) return;
      const node = session.add(output, false, undefined, () => latest.current.onReady?.(), false, false, { root: element, kind: latest.current.kind, card: latest.current.presentation === 'card' });
      handle.current = node; resize(); activity(); sendAudio(); node.decoder(latest.current.decoderVisible ?? false);
      if (latest.current.kind === 'insight') stopDecoder = observeDecoderCompletion(element, () => latest.current.onDecoderComplete?.());
      if (latest.current.kind === 'insight') { const decoder = element.querySelector<HTMLElement>('.mx-decoder'); if (decoder) decoder.style.fontFamily = fonts.bodyBold; }
      if (latest.current.controllerRef) latest.current.controllerRef.current = { interact: event => node.interact(event.action, event.x, event.y) };
    }).catch(problem => { if (!disposed) { console.error('Rust vector creation:', latest.current.kind, problem); output.dataset.graphicsError = String(problem); setFailed(String(problem)); } });
    return () => { disposed = true; stopDecoder(); size.disconnect(); stopVisibility(); handle.current?.release(); handle.current = null; if (latest.current.controllerRef) latest.current.controllerRef.current = null; };
  }, [controller, props.kind, failed, sendAudio, insightTheme]);
  useEffect(() => { handle.current?.active((props.active ?? true) && focused && active.current.visible, props.reducedMotion ?? false); }, [props.active, props.reducedMotion, focused]);
  useEffect(() => { sendAudio(); }, [props.audioSource, props.spectrum, props.level, props.mode, props.lockProgress, props.locked, sendAudio]);
  useEffect(() => props.audioSource?.subscribe(sendAudio), [props.audioSource, sendAudio]);
  useEffect(() => { handle.current?.decoder(props.decoderVisible ?? false); }, [props.decoderVisible]);
  const contact = (target: HTMLElement, x: number, y: number, pressed: boolean) => { const rect = target.getBoundingClientRect(); glass.current?.interact({ type: 'watcher-art-interaction', action: pressed ? 'glass-move' : 'glass-release', x: (x - rect.x) / rect.width, y: (y - rect.y) / rect.height }); };
  if (failed || !controller) return <ArtUnavailable {...props} />;
  return <View style={[{ width: props.width ?? '100%', height: props.height }, props.style]}>
    {props.presentation === 'card' && <View pointerEvents="none" style={StyleSheet.absoluteFill}><RustGlass {...props} kind="glass" controllerRef={glass} onPress={undefined} /></View>}
    <div ref={root} data-graphics="rust-vector-model" aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} />
    <canvas ref={canvas} data-graphics="rust-vector-gpu" aria-hidden style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: props.kind === 'insight' ? 'auto' : '100%', aspectRatio: props.kind === 'insight' ? '400 / 94' : undefined, pointerEvents: 'none' }} />
    {props.onPress && <button type="button" aria-label={props.accessibilityLabel ?? artLabels[props.kind]} disabled={props.active === false || !focused} style={{ position: 'absolute', inset: 0, background: 'transparent', border: 0, cursor: 'pointer', touchAction: 'pan-y' }}
      onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; origin.current = { x: event.clientX, y: event.clientY }; const rect = event.currentTarget.getBoundingClientRect(); handle.current?.down(performance.now(), rect.width, rect.height, artHoldDelay(props.kind)); event.currentTarget.setPointerCapture(event.pointerId); contact(event.currentTarget, event.clientX, event.clientY, true); }}
      onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; handle.current?.move(performance.now(), event.clientX - origin.current.x, event.clientY - origin.current.y); contact(event.currentTarget, event.clientX, event.clientY, true); }}
      onPointerUp={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const rect = event.currentTarget.getBoundingClientRect(); const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom; if (handle.current?.up(performance.now(), inside)) press(); contact(event.currentTarget, event.clientX, event.clientY, false); event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={event => { handle.current?.interact('release'); contact(event.currentTarget, event.clientX, event.clientY, false); }} onLostPointerCapture={event => { handle.current?.interact('release'); contact(event.currentTarget, event.clientX, event.clientY, false); }}
      onClick={event => { if (event.detail === 0) { handle.current?.interact('tap'); press(); } }} />}
  </View>;
}
