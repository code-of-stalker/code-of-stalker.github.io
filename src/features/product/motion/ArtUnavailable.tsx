import { useEffect, useLayoutEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { artLabels } from './types';
import type { ArtProps } from './types';
import { useArtLoadingSettled } from '../skeleton/ArtLoading';

/**
 * A failed Rust surface must never silently switch to JavaScript graphics. It keeps its place
 * and stays empty: the art label is a developer name, never shown (Art's phone showed
 * «Стеклянная поверхность» over the admin PIN screen when the GPU had no room for a surface).
 * Art that is also a button (home cards, level frames) keeps an invisible press target, so the
 * app stays usable without graphics.
 */
export function ArtUnavailable(props: ArtProps) {
  useArtLoadingSettled();
  // Pages and panels wait for their art: as when it starts, a surface that cannot start
  // reports a finished reveal and readiness, so nothing stays masked or locked behind it.
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  useEffect(() => { latest.current.onRevealProgress?.(1); latest.current.onReady?.(); }, []);
  return <View testID="rust-art-unavailable" aria-hidden={!props.onPress} pointerEvents={props.onPress ? 'box-none' : 'none'} style={[{ width: props.width ?? '100%', height: props.height }, props.style]}>
    {props.onPress && <Pressable testID="rust-art-unavailable-press" accessibilityRole="button" accessibilityLabel={props.accessibilityLabel ?? artLabels[props.kind]}
      disabled={props.active === false} onPress={props.onPress} style={StyleSheet.absoluteFill} />}
  </View>;
}
