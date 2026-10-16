import { Platform, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import material from '../../../../assets/product/motion/laboratory-glass.json';
import { useThemeColors } from '../ProductTheme';
import { colors as darkColors } from '../theme';
import { useMemo } from 'react';
import { PanelArtwork } from './PanelArtwork';

const path = 'M33.4473 .125L43.875 10.5527V41.875H10.5527L.125 31.4473V.125Z';
const image = (body: string) => ({ uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="42" viewBox="0 0 44 42" preserveAspectRatio="none">${body}</svg>`)}` });
const angle = material.rimAngle * Math.PI / 180;
const x = Math.cos(angle) * 22, y = Math.sin(angle) * 21;
const face = image(`<defs><linearGradient id="facet" gradientUnits="userSpaceOnUse" x1="${22-x}" y1="${21-y}" x2="${22+x}" y2="${21+y}"><stop stop-color="${material.highlightColor}" stop-opacity=".2"/><stop offset=".5" stop-color="${material.highlightColor}" stop-opacity=".02"/><stop offset="1" stop-color="${material.highlightColor}" stop-opacity=".13"/></linearGradient></defs><path d="${path}" fill="${material.fillColor}" fill-opacity="${material.fillOpacity}"/><path d="${path}" fill="none" stroke="url(#facet)" stroke-width="${material.facetWidth}"/>`);

/** Preserve the approved settings face over the home screen's matrix rain. */
export function GlassIconFace() {
  const colors = useThemeColors();
  const themedFace = useMemo(() => colors === darkColors ? face : image(`<defs><linearGradient id="facet" gradientUnits="userSpaceOnUse" x1="${22-x}" y1="${21-y}" x2="${22+x}" y2="${21+y}"><stop stop-color="${colors.accent}" stop-opacity=".2"/><stop offset=".5" stop-color="${colors.accent}" stop-opacity=".02"/><stop offset="1" stop-color="${colors.accent}" stop-opacity=".13"/></linearGradient></defs><path d="${path}" fill="${colors.background}" fill-opacity="${material.fillOpacity}"/><path d="${path}" fill="none" stroke="url(#facet)" stroke-width="${material.facetWidth}"/>`), [colors]);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, Platform.OS === 'web' ? {
    clipPath: 'polygon(76.0166% .2976%, 99.7159% 25.1255%, 99.7159% 99.7024%, 23.9834% 99.7024%, .2841% 74.8745%, .2841% .2976%)',
    backdropFilter: `blur(${material.backgroundBlur}px)`, WebkitBackdropFilter: `blur(${material.backgroundBlur}px)`,
  } as ViewStyle : undefined]}>
    <PanelArtwork source={themedFace} />
  </View>;
}
