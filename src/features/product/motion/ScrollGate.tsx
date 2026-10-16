import { Animated } from './RustAnimated';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useThemeColors } from '../ProductTheme';
import { createScrollGate } from './scroll-gate-model';
import type { ScrollGateProps } from './ScrollGate.types';
import { useSwipeNavigationAllowed } from '../navigation/BackSwipeProvider';

export function ScrollGate({ children, enabled, onReady, onProgress, onAdvance, onRetreat, onViewportChange, fill, allowAdvance = true, resetKey, startAtEnd = false, controllerRef, readingGesture, style, contentStyle, fadeTop = 0, fadeBottom = 0 }: ScrollGateProps) {
  const colors = useThemeColors(), [offset] = useState(() => new Animated.Value(0));
  const fade = useMemo(() => {
    const source = (height: number, bottom: boolean) => ({ uri: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="${height}"><defs><linearGradient id="fade" x2="0" y2="1"><stop stop-color="${colors.background}" stop-opacity="${bottom ? 0 : 1}"/><stop offset="1" stop-color="${colors.background}" stop-opacity="${bottom ? 1 : 0}"/></linearGradient></defs><rect width="1" height="${height}" fill="url(#fade)"/></svg>`) });
    return { top: source(fadeTop, false), bottom: source(fadeBottom, true) };
  }, [colors.background, fadeTop, fadeBottom]);
  const scroll = useRef<ScrollView>(null);
  const scrollLocked = useRef(false);
  const readingTouch = useRef(false), readingY = useRef(0);
  const previewResponder = useRef(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const geometry = useRef({ height: 0, content: 0, y: 0 });
  const interacted = useRef(false), origin = useRef(0), intent = useRef(1);
  const entry = useRef({ key: resetKey, end: startAtEnd });
  const swipeAllowed = useSwipeNavigationAllowed();
  const canRetreat = !!onRetreat;
  const callbacks = useRef({ onReady, onProgress, onAdvance, onRetreat, onViewportChange, enabled });
  useEffect(() => { callbacks.current = { onReady, onProgress, onAdvance, onRetreat, onViewportChange, enabled }; }, [onReady, onProgress, onAdvance, onRetreat, onViewportChange, enabled]);
  const gate = useMemo(() => createScrollGate(value => callbacks.current.onProgress(value), () => callbacks.current.onAdvance(), canRetreat ? () => callbacks.current.onRetreat?.() : undefined), [canRetreat]);
  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = {
      scrollTo: y => scroll.current?.scrollTo({ y, animated: false }),
      setScrollLocked: locked => {
        scrollLocked.current = locked; setScrollEnabled(!locked);
        gate.block(); interacted.current = false; callbacks.current.onReady(false);
      },
    };
    return () => { controllerRef.current = null; };
  }, [controllerRef, gate]);
  useEffect(() => {
    if (entry.current.key !== resetKey) entry.current = { key: resetKey, end: false };
    interacted.current = false; intent.current = 1; geometry.current.y = 0;
    gate.reset(); offset.setValue(0); scroll.current?.scrollTo({ y: 0, animated: false }); callbacks.current.onReady(false);
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- The entry edge uses current measured geometry.
  }, [resetKey, gate, offset]);
  useEffect(() => { gate.block(); interacted.current = false; callbacks.current.onReady(false); }, [enabled, allowAdvance, gate]);
  function atEnd() { const g = geometry.current; return allowAdvance && g.height > 0 && g.content - g.height - g.y < 3; }
  function atStart() { return geometry.current.y < 3; }
  function check() {
    const g = geometry.current;
    if (entry.current.end && g.height > 0 && g.content > 0) {
      const y = Math.max(0, g.content - g.height);
      if (Math.abs(y - g.y) > 0.1) { g.y = y; offset.setValue(y); scroll.current?.scrollTo({ y, animated: false }); }
    }
    callbacks.current.onViewportChange?.({ offset: geometry.current.y, height: geometry.current.height });
    callbacks.current.onReady(!readingGesture?.locked && !scrollLocked.current && callbacks.current.enabled && swipeAllowed() && interacted.current && (intent.current > 0 ? atEnd() : !!callbacks.current.onRetreat && atStart()));
  }
  return <View style={[{ flex: 1, minHeight: 0 }, style]}
    onStartShouldSetResponder={() => !!readingGesture?.locked && enabled}
    onResponderGrant={event => { previewResponder.current = true; readingY.current = event.nativeEvent.pageY; }}
    onResponderRelease={() => { previewResponder.current = false; }} onResponderTerminate={() => { previewResponder.current = false; }}
    onResponderMove={event => { const y = event.nativeEvent.pageY; if (enabled) readingGesture?.onDrag(readingY.current - y); readingY.current = y; }}>
    <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={[fill && { flexGrow: 1 }, contentStyle]} showsVerticalScrollIndicator={false}
    bounces={false} overScrollMode="never" scrollEventThrottle={16} scrollEnabled={scrollEnabled && !readingGesture?.locked}
    onLayout={event => { geometry.current.height = event.nativeEvent.layout.height; check(); }}
    onContentSizeChange={(_, height) => { geometry.current.content = height; check(); }}
    onScroll={event => { if (readingGesture?.locked) { scroll.current?.scrollTo({ y: 0, animated: false }); return; } geometry.current.y = event.nativeEvent.contentOffset.y; offset.setValue(Math.max(0, geometry.current.y)); check(); }}
    onTouchStart={event => { readingTouch.current = !!readingGesture?.locked; readingY.current = event.nativeEvent.pageY; entry.current.end = false; origin.current = event.nativeEvent.pageY; if (!readingTouch.current && !scrollLocked.current && enabled && swipeAllowed()) gate.start(origin.current, atEnd(), atStart()); else { gate.block(); interacted.current = false; check(); } }}
    onTouchMove={event => { if (previewResponder.current) return; const y = event.nativeEvent.pageY, movement = readingY.current - y; readingY.current = y; if (readingGesture && (readingTouch.current || geometry.current.y < 1 && movement < 0)) { readingTouch.current = true; if (enabled) readingGesture.onDrag(movement); gate.block(); return; } if (!scrollLocked.current && enabled && swipeAllowed()) { const delta = origin.current - y; if (Math.abs(delta) > 3) { interacted.current = true; intent.current = Math.sign(delta); check(); } gate.move(y, atEnd(), atStart()); } else { gate.block(); interacted.current = false; check(); } }}
    onTouchEnd={() => { if (swipeAllowed()) gate.end(); else gate.block(); }}
    onTouchCancel={() => gate.end(true)}
    accessibilityHint="Дочитайте содержимое и продолжите тянуть вверх, чтобы перейти дальше">
    {children}
    {fadeBottom > 0 && <View pointerEvents="none" style={{ height: fadeBottom, flexShrink: 0 }} />}
    </ScrollView>
    {fadeTop > 0 && <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: fadeTop, opacity: offset.interpolate({ inputRange: [0, fadeTop], outputRange: [0, 1], extrapolate: 'clamp' }) }}><Image source={fade.top} style={StyleSheet.absoluteFill} contentFit="fill" /></Animated.View>}
    {fadeBottom > 0 && <Image pointerEvents="none" source={fade.bottom} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: fadeBottom }} contentFit="fill" />}
  </View>;
}
