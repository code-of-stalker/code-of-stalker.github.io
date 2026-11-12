import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { CSSProperties } from 'react';

// Rust motion wrappers render a plain <div>, so React Native shorthands that the DOM does
// not know (paddingHorizontal, marginVertical…) must be spelled out as CSS sides.
const sides = { Horizontal: ['Left', 'Right'], Vertical: ['Top', 'Bottom'] } as const;

export function webStyle(style: StyleProp<ViewStyle>): CSSProperties {
  const flat: Record<string, unknown> = { ...StyleSheet.flatten(style) };
  for (const box of ['padding', 'margin'] as const) for (const [axis, [a, b]] of Object.entries(sides)) {
    const key = box + axis;
    if (flat[key] === undefined) continue;
    flat[box + a] ??= flat[key]; flat[box + b] ??= flat[key];
    delete flat[key];
  }
  return flat as CSSProperties;
}
