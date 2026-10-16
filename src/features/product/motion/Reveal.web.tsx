import { StyleSheet } from 'react-native';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { RustMotion, shown } from './RustMotion.web';

export function Reveal({ children, delay = 0, reducedMotion = false, style }: PropsWithChildren<{
  delay?: number; reducedMotion?: boolean; style?: StyleProp<ViewStyle>;
}>) {
  return <RustMotion initial={reducedMotion ? shown : [0, 0, 14, 1, 0, 100]} target={shown} duration={reducedMotion ? 0 : 640} delay={reducedMotion ? 0 : delay}
    style={{ display: 'flex', flexDirection: 'column', ...StyleSheet.flatten(style) } as React.CSSProperties}>
    {children}
  </RustMotion>;
}
