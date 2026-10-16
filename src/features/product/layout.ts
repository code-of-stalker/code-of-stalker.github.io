import { useWindowDimensions } from 'react-native';

export const productMaxWidth = 480;

// Grow outer spacing on the 4px grid without stretching the mobile layout on desktop.
// 320 / 360 / 400 / 440 / 480px -> 16 / 20 / 24 / 28 / 32px.
export function productSpacing(width: number) {
  const extra = Math.min(4, Math.max(0, Math.floor((width - 320) / 40))) * 4;
  return { gutter: 16 + extra, inset: width >= 500 ? 16 : 12, extra };
}

export function useProductSpacing() {
  const { width } = useWindowDimensions();
  // Insets follow the device width, even when the content is capped at 480px.
  return productSpacing(width);
}
