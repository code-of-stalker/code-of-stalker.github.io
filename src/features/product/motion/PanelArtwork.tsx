import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { fitPanelSvg, panelSvg, type PanelSource } from './panelArtworkGeometry';

/** Native adapter redraws at measured size rather than distorting an authored frame. */
export function PanelArtwork({ source, color, style, flipY=false }: { source: PanelSource; color?: string; style?: StyleProp<ViewStyle>; flipY?:boolean }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const {uri}=source;
  const fitted = useMemo(() => size.width > 0 && size.height > 0 ? { uri: `data:image/svg+xml;utf8,${encodeURIComponent(fitPanelSvg(panelSvg({uri}), size.width, size.height))}` } : undefined, [uri, size.width, size.height]);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, style, flipY&&{transform:[{scaleY:-1}]}]} onLayout={event => {
    const { width, height } = event.nativeEvent.layout;
    setSize(old => old.width === width && old.height === height ? old : { width, height });
  }}>{fitted && <Image source={fitted} tintColor={color} style={StyleSheet.absoluteFill} contentFit="contain" />}</View>;
}
