import { useMemo } from 'react';
import { useThemeColors } from '../ProductTheme';
import { PanelArtwork } from './PanelArtwork';

/** A CSS-pixel contour without another glass pass or an opaque fill. */
export function GlassOutline({ width, height, path }: { width: number; height: number; path: string }) {
  const colors = useThemeColors();
  const source = useMemo(() => ({ uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${path}" fill="none" stroke="${colors.accent}" stroke-width=".25" vector-effect="non-scaling-stroke"/></svg>`)}` }), [width, height, path, colors.accent]);
  return <PanelArtwork source={source} style={{ zIndex: 5 }} />;
}
