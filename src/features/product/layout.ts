import { useWindowDimensions } from 'react-native';

/** The phone column every screen was designed in. Panels sized against the
 * phone artwork (hints, sheets, dialogs) keep this width on larger screens. */
export const productMaxWidth = 480;

export type ProductLayoutKind = 'phone' | 'tablet' | 'desktop';
export type ProductLayout = {
  kind: ProductLayoutKind;
  /** Reading, list and form screens: one centered column. */
  column: number;
  /** Screens that place panels side by side (home). */
  wide: number;
  /** Side-by-side panels fit: a landscape tablet or a desktop window. */
  columns: 1 | 2;
};

// Tablets start at the smallest iPad mini / Android tablet width; desktops at
// the narrowest landscape tablet and laptop window. The column grows only at
// these steps, so the phone layout under 600px stays exactly as approved.
export function productLayout(width: number, height: number): ProductLayout {
  const kind: ProductLayoutKind = width >= 1024 ? 'desktop' : width >= 600 ? 'tablet' : 'phone';
  const column = kind === 'phone' ? productMaxWidth : 720;
  const columns = kind !== 'phone' && width >= 900 && width > height * 1.15 ? 2 : 1;
  return { kind, column, wide: columns === 2 ? 1200 : column, columns };
}

export function useProductLayout() {
  const { width, height } = useWindowDimensions();
  return productLayout(width, height);
}

/** Reading heroes keep their phone proportions until they would take more than
 * 40% of the window, which only happens in wide windows (tablets in landscape,
 * desktops); there the illustration is fitted into a shorter band. */
export function readingHeroHeight(natural: number, viewportHeight: number) {
  return Math.max(1, Math.min(natural, viewportHeight * .4));
}

// Grow outer spacing on the 4px grid without stretching the mobile layout on desktop.
// 320 / 360 / 400 / 440 / 480px -> 16 / 20 / 24 / 28 / 32px.
export function productSpacing(width: number) {
  const extra = Math.min(4, Math.max(0, Math.floor((width - 320) / 40))) * 4;
  return { gutter: 16 + extra, inset: width >= 500 ? 16 : 12, extra };
}

export function useProductSpacing() {
  const { width } = useWindowDimensions();
  // Insets follow the device width, even when the content is capped at its column.
  return productSpacing(width);
}
