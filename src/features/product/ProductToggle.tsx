import { Image } from 'expo-image';
import { useMemo } from 'react';
import { useThemeColors } from './ProductTheme';
import { RustIcon } from './motion/RustIcon';

/** Shared Settings toggle, with the compact 27 x 15 Diary size from Figma. */
export function ProductToggle({ enabled, compact = false }: { enabled: boolean; compact?: boolean }) {
  const colors = useThemeColors();
  const width = compact ? 27 : 36, height = compact ? 15 : 20;
  const source = useMemo(() => {
    const scale = width / 36, x = (enabled ? 19 : 5) * scale, y = 4 * scale, side = 12 * scale;
    const ink = enabled ? colors.accent : colors.muted;
    // The outline stays 0.25 layout pixels at either size; only the thumb scales.
    return { uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" fill="${colors.background}" fill-opacity=".7" stroke="${ink}" stroke-width=".25"/><path d="M${x} ${y}H${x + side}V${y + side}H${x + side / 2}L${x} ${y + side / 2}Z" fill="${ink}"/></svg>`)}` };
  }, [colors, enabled, width, height]);
  const still = <Image pointerEvents="none" testID="product-toggle" source={source} style={{ width, height, flexShrink: 0 }} contentFit="contain" />;
  // Rust slides the thumb across and springs it on each change.
  return <RustIcon name="toggle" width={width} height={height} color={enabled ? colors.accent : colors.muted} filled={enabled} ground={colors.background} fallback={still} />;
}
