import { lightColors, matrixColors, mirageColors, dawnColors, neutralColors, violetColors } from '../theme';
import type { ProductColors } from '../theme';
// The graphics adapter subscribes once per shared session, never once per frame.
export type GraphicsPalette = 0 | 1 | 2 | 3 | 4 | 5 | 6;
let palette: GraphicsPalette = 0;
const listeners = new Set<(value: GraphicsPalette) => void>();
export const graphicsPalette = {
  get: () => palette,
  set(value: GraphicsPalette) { if (value === palette) return; palette = value; listeners.forEach(listener => listener(palette)); },
  subscribe(listener: (value: GraphicsPalette) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
/** The code ProductTheme publishes, for a component that already has its palette. */
export const paletteCode = (colors: ProductColors): GraphicsPalette =>
  colors === lightColors ? 1 : colors === neutralColors ? 2 : colors === violetColors ? 3 : colors === matrixColors ? 4 : colors === mirageColors ? 5 : colors === dawnColors ? 6 : 0;
/** Light themes (Дюна, Мираж, Рассвет) draw scenes from the light paintings, dark themes from the dark originals. */
export const isLightPalette = (code: GraphicsPalette) => code === 1 || code === 5 || code === 6;
