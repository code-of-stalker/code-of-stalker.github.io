import { useMemo } from 'react';
import { useThemeColors } from './ProductTheme';
import { PanelArtwork } from './motion/PanelArtwork';

/** CSS borders round subpixel widths to device pixels. SVG retains the .25px
 * antialiased contour without a GPU pass or an animation loop. */
export function PanelBorder({ color }: { color?: string }) {
  const colors = useThemeColors();
  const ink = color ?? (colors.background === '#FAE18F' ? colors.accent : colors.border);
  const source = useMemo(() => ({ uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="288" height="200" viewBox="0 0 288 200"><path d="M.125 .125H287.875V199.875H.125Z" fill="none" stroke="${ink}" stroke-width=".25"/></svg>`)}` }), [ink]);
  return <PanelArtwork source={source} style={{ zIndex: 5 }} />;
}
