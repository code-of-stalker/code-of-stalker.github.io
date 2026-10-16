import { Animated } from './RustAnimated';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { getLayoutScanStyle } from '../../../../scripts/product-art/src/laboratory/liquid-glass/scanReveal';
import material from '../../../../assets/product/motion/laboratory-glass.json';
import { useThemeColors } from '../ProductTheme';

/** Reveal the complete panel, including its frame and copy, without React updates per frame. */
export function usePanelReveal(enabled: boolean, reducedMotion: boolean) {
  const ref = useRef<View>(null);
  const [progress] = useState(() => new Animated.Value(enabled && !reducedMotion ? 0 : 1));
  const report = useCallback((value: number) => {
    const amount = !enabled || reducedMotion ? 1 : Math.max(0, Math.min(1, value));
    if (Platform.OS === 'web') {
      const element = ref.current as unknown as HTMLElement | null;
      if (element) {
        const mask = getLayoutScanStyle(amount, material).mask;
        element.style.maskImage = mask; element.style.webkitMaskImage = mask;
        element.dataset.panelReveal = String(amount);
      }
    } else progress.setValue(amount);
  }, [enabled, reducedMotion, progress]);
  const mask = getLayoutScanStyle(enabled && !reducedMotion ? 0 : 1, material).mask;
  return { ref, report, progress, initialStyle: Platform.OS === 'web' ? { maskImage: mask, WebkitMaskImage: mask } as ViewStyle : undefined };
}

const feather = { uri: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="40"><defs><linearGradient id="f" x2="0" y2="1"><stop stop-color="black" stop-opacity="0"/><stop offset="1" stop-color="black"/></linearGradient></defs><rect width="1" height="40" fill="url(#f)"/></svg>')}` };
export function NativePanelReveal({ progress, height }: { progress: Animated.Value; height: number }) {
  const colors = useThemeColors();
  const edge = useMemo(() => colors.background === '#000000' ? feather : { uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="40"><defs><linearGradient id="f" x2="0" y2="1"><stop stop-color="${colors.background}" stop-opacity="0"/><stop offset="1" stop-color="${colors.background}"/></linearGradient></defs><rect width="1" height="40" fill="url(#f)"/></svg>`)}` }, [colors]);
  const light=useMemo(()=>({uri:`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="24"><defs><linearGradient id="l" x2="0" y2="1"><stop stop-color="${colors.accent}" stop-opacity="0"/><stop offset=".33" stop-color="${colors.accent}" stop-opacity=".2"/><stop offset=".45" stop-color="${colors.accent}"/><stop offset=".55" stop-color="${colors.accent}"/><stop offset=".67" stop-color="${colors.accent}" stop-opacity=".2"/><stop offset="1" stop-color="${colors.accent}" stop-opacity="0"/></linearGradient></defs><rect width="1" height="24" fill="url(#l)"/></svg>`)}`}),[colors.accent]);
  if (Platform.OS === 'web') return null;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 100, overflow: 'hidden' }]}><Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height*1.8+80,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-height*.6, height*1.2] }) }] }}>
    <Image source={edge} style={{ height: height*.2, width: '100%' }} contentFit="fill" />
    <View style={{ flex: 1, backgroundColor: colors.background }} />
  </Animated.View><Animated.View style={{position:'absolute',top:0,left:0,right:0,height:24,
    opacity:progress.interpolate({inputRange:[0,.08,.92,1],outputRange:[0,.8,.8,0]}),
    transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[-height*.4-12,height*1.4-12]})}]}}><Image source={light} style={{width:'100%',height:24}} contentFit="fill"/></Animated.View></View>;
}
