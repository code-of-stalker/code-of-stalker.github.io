import { createContext, useContext, useLayoutEffect } from 'react';
import type { PropsWithChildren } from 'react';
import { colors, lightColors, matrixColors, mirageColors, dawnColors, neutralColors, violetColors } from './theme';
import type { ProductColors } from './theme';
import type { ProductSettings } from './state/model';
import { graphicsPalette } from './motion/graphicsPalette';

const ThemeContext = createContext<ProductColors>(colors);
export function ProductThemeProvider({ theme, children }: PropsWithChildren<{ theme: ProductSettings['theme'] }>) {
  const palette = theme === 'light' ? lightColors : theme === 'neutral' ? neutralColors : theme === 'violet' ? violetColors : theme === 'matrix' ? matrixColors : theme === 'mirage' ? mirageColors : theme === 'dawn' ? dawnColors : colors;
  useLayoutEffect(() => { graphicsPalette.set(theme === 'light' ? 1 : theme === 'neutral' ? 2 : theme === 'violet' ? 3 : theme === 'matrix' ? 4 : theme === 'mirage' ? 5 : theme === 'dawn' ? 6 : 0); }, [theme]);
  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>;
}
export function useThemeColors() { return useContext(ThemeContext); }
// Each stylesheet is computed once per palette. Theme changes keep components,
// scroll positions, Rust clocks and GPU resources alive.
const sheets = new WeakMap<object, WeakMap<ProductColors, object>>();
export function useThemeStyles<T extends object>(create: (palette: ProductColors) => T): T {
  const palette = useThemeColors();
  let themes = sheets.get(create);
  if (!themes) { themes = new WeakMap(); sheets.set(create, themes); }
  let styles = themes.get(palette) as T | undefined;
  if (!styles) { styles = create(palette); themes.set(palette, styles); }
  return styles;
}
