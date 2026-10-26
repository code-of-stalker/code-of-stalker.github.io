import { lightColors, neutralColors, violetColors } from '../theme';
import type { ProductColors } from '../theme';
// The graphics adapter subscribes once per shared session, never once per frame.
export type GraphicsPalette = 0 | 1 | 2 | 3;
let palette: GraphicsPalette = 0;
const listeners = new Set<(value: GraphicsPalette) => void>();
export const graphicsPalette = {
  get: () => palette,
  set(value: GraphicsPalette) { if (value === palette) return; palette = value; listeners.forEach(listener => listener(palette)); },
  subscribe(listener: (value: GraphicsPalette) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
/** The code ProductTheme publishes, for a component that already has its palette. */
export const paletteCode = (colors: ProductColors): GraphicsPalette =>
  colors === lightColors ? 1 : colors === neutralColors ? 2 : colors === violetColors ? 3 : 0;
