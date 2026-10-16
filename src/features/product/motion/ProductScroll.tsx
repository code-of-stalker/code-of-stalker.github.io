import { Animated } from './RustAnimated';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ScrollViewProps } from 'react-native';
import { useThemeColors } from '../ProductTheme';
import { Image } from 'expo-image';

export function ProductScroll({ fadeTop = false, style, ...props }: ScrollViewProps & { fadeTop?: boolean }) {
  const colors = useThemeColors(), [offset] = useState(() => new Animated.Value(0));
  const source = useMemo(() => ({ uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="28"><defs><linearGradient id="fade" x2="0" y2="1"><stop stop-color="${colors.background}"/><stop offset="1" stop-color="${colors.background}" stop-opacity="0"/></linearGradient></defs><rect width="480" height="28" fill="url(#fade)"/></svg>`)}` }), [colors.background]);
  return <View style={style}>
    <Animated.ScrollView {...props} style={{ flex: 1 }} scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: offset } } }], { useNativeDriver: true, listener: props.onScroll })} />
    {fadeTop && <Animated.View pointerEvents="none" style={[styles.fade, { opacity: offset.interpolate({ inputRange: [0, 28], outputRange: [0, 1], extrapolate: 'clamp' }) }]}><Image source={source} contentFit="fill" style={StyleSheet.absoluteFill} /></Animated.View>}
  </View>;
}
const styles = StyleSheet.create({ fade: { position: 'absolute', top: 0, left: 0, right: 0, height: 28 } });
