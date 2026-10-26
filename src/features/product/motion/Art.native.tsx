import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PanResponder, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { WebView } from 'react-native-webview';
import { useIsFocused } from 'expo-router';
import { nativeArtAsset } from './nativeArtAsset';
import { artLabels } from './types';
import type { ArtProps } from './types';
import { artHoldDelay, createArtGesture } from './gesture';
import { useCardPress } from './useCardPress';
import type { ArtInteraction } from './gesture';
import { useArtEffects } from './useArtEffects';
import { useThemeColors } from '../ProductTheme';
import { paletteCode } from './graphicsPalette';

/** Local artwork only. Matrix, credentials, recording and navigation stay native. */
export function Art({ kind, height, width, glass, controllerRef, audioSource, scanOnMount = true, onRevealProgress, onReady, onDecoderComplete, active = true, decoderVisible = false, reducedMotion = false, level = 0, spectrum, mode = 'record', lockProgress = 0, locked = false, presentation = 'artwork', onPress, accessibilityLabel, style }: ArtProps) {
  const focused = useIsFocused();
  const colors = useThemeColors();
  const theme = paletteCode(colors);
  const browser = useRef<WebView>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [failed, setFailed] = useState<string>();
  const [source, setSource] = useState<{ uri: string }>();
  useEffect(() => { let live = true; nativeArtAsset().then(value => { if (live) setSource(value); }).catch(error => { console.error('Native Rust asset:', error); if (live) setFailed(kind); }); return () => { live = false; }; }, [kind]);
  const sendEffect = useCallback((value: object) => browser.current?.injectJavaScript(`window.WatcherEffects?.message(${JSON.stringify(value)});true;`), []);
  const { receive, loaded } = useArtEffects(artLabels[kind], sendEffect, active && foreground && focused && !reducedMotion, kind !== 'glass' && !reducedMotion, onReady, onDecoderComplete);
  const latest = useRef({ kind, presentation, scanOnMount, theme, glass, active: active && foreground && focused, decoderVisible, reducedMotion, level, spectrum, mode, lockProgress, locked });
  const action = useRef(onPress);
  const dimensions = useRef({ width: width ?? 288, height });
  const delay = useRef(artHoldDelay(kind));
  const moveTime = useRef(0);
  const sendInteraction = useCallback((value: ArtInteraction) => {
    if (value.action === 'move') { const now = Date.now(); if (now - moveTime.current < 32) return; moveTime.current = now; }
    browser.current?.injectJavaScript(`window.WatcherArt?.interact(${JSON.stringify(value)});true;`);
  }, []);
  const tap = useCardPress(onPress, presentation === 'card', reducedMotion, focused && foreground && active);
  // The gesture factory stores callbacks; refs are read only when a gesture fires.
  // eslint-disable-next-line react-hooks/refs
  const gesture = useMemo(() => createArtGesture(sendInteraction, tap), [sendInteraction, tap]);
  const canBegin = useCallback(() => !!action.current && latest.current.active, []);
  const glassPoint = useCallback((event: GestureResponderEvent, action: ArtInteraction['action']) => sendInteraction({ type: 'watcher-art-interaction', action,
    x: event.nativeEvent.locationX / dimensions.current.width, y: event.nativeEvent.locationY / dimensions.current.height }), [sendInteraction]);
  const begin = useCallback((event: GestureResponderEvent) => { gesture.begin(dimensions.current.width, dimensions.current.height, delay.current); glassPoint(event, 'glass-press'); }, [gesture, glassPoint]);
  /* eslint-disable react-hooks/refs -- PanResponder registers event callbacks without invoking them during render. */
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: canBegin,
    onPanResponderGrant: begin,
    onPanResponderStart: (_, state) => { if (state.numberActiveTouches > 1) gesture.cancel(); },
    onPanResponderMove: (event, state) => { gesture.move(state.dx, state.dy); glassPoint(event, 'glass-move'); },
    onPanResponderRelease: (event, state) => {
      glassPoint(event, 'glass-release');
      gesture.move(state.dx, state.dy);
      const { locationX, locationY } = event.nativeEvent;
      gesture.end(locationX >= 0 && locationY >= 0 && locationX <= dimensions.current.width && locationY <= dimensions.current.height);
    },
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: () => { sendInteraction({ type: 'watcher-art-interaction', action: 'glass-release' }); gesture.cancel(); },
  }), [gesture, canBegin, begin, glassPoint, sendInteraction]);
  /* eslint-enable react-hooks/refs */
  const send = useCallback(() => browser.current?.injectJavaScript(`window.WatcherArt?.update(${JSON.stringify(latest.current)});true;`), []);
  useEffect(() => { latest.current = { kind, presentation, scanOnMount, theme, glass, active: active && foreground && focused, decoderVisible, reducedMotion, level, spectrum, mode, lockProgress, locked }; send(); }, [kind, presentation, scanOnMount, theme, glass, active, foreground, focused, decoderVisible, reducedMotion, level, spectrum, mode, lockProgress, locked, send]);
  useEffect(() => audioSource?.subscribe(() => { latest.current.spectrum = audioSource.read(); send(); }), [audioSource, send]);
  useEffect(() => { if (!controllerRef) return; controllerRef.current = { interact: sendInteraction }; return () => { controllerRef.current = null; }; }, [controllerRef, sendInteraction]);
  useEffect(() => { action.current = onPress; delay.current = artHoldDelay(kind); }, [onPress, kind]);
  useEffect(() => { const listener = AppState.addEventListener('change', value => setForeground(value === 'active')); return () => listener.remove(); }, []);
  useEffect(() => { if (!active || !foreground || !focused) gesture.cancel(); return () => gesture.cancel(); }, [active, foreground, focused, gesture]);
  return <View style={[{ height, width: width ?? '100%' }, style]} onLayout={event => { dimensions.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height }; }}>
    {failed === kind || !source ? <View style={styles.fallback}><Text style={styles.label}>{artLabels[kind]}</Text></View> :
      <View pointerEvents="none" style={styles.fill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <WebView key={kind} ref={browser} source={source} style={styles.web} containerStyle={styles.web} originWhitelist={['*']}
          javaScriptEnabled domStorageEnabled={false} scrollEnabled={false} bounces={false} overScrollMode="never"
          allowFileAccess allowUniversalAccessFromFileURLs={false} javaScriptCanOpenWindowsAutomatically={false}
          sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} mixedContentMode="never" setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={request => request.url === source.uri || request.url === 'about:blank'}
          onMessage={event => {
            if (event.nativeEvent.data === 'ready') { send(); loaded(); receive({ type: 'watcher-art-ready' }); return; }
            try { const data = JSON.parse(event.nativeEvent.data); if (data.type === 'ready') { send(); loaded(); return; } if (data.type === 'watcher-rust-error') { console.error('Native Rust graphics:', data.message); setFailed(kind); onReady?.(); onRevealProgress?.(1); return; } receive(data); if (data.type === 'watcher-glass-reveal' && Number.isFinite(data.progress)) onRevealProgress?.(data.progress); } catch {}
          }} onLoadEnd={() => { send(); loaded(); }} onError={() => { setFailed(kind); onRevealProgress?.(1); onReady?.(); }} onRenderProcessGone={() => { setFailed(kind); onRevealProgress?.(1); onReady?.(); }}/>
      </View>}
    {onPress && <View {...responder.panHandlers} style={styles.fill} accessible accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? artLabels[kind]}
      accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') gesture.activate(); }} onAccessibilityTap={() => gesture.activate()}/>}
  </View>;
}
const styles = StyleSheet.create({ fill: { ...StyleSheet.absoluteFill }, web: { flex: 1, backgroundColor: 'transparent' }, fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' }, label: { color: '#E7E100', fontSize: 13 } });
