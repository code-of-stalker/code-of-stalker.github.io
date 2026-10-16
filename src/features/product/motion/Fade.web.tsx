import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { RustMotion } from './RustMotion.web';

export function Fade({ children, opacity, duration = 280, reducedMotion = false, style }: PropsWithChildren<{
  opacity: number; duration?: number; reducedMotion?: boolean; style?: StyleProp<ViewStyle>;
}>) {
  return <RustMotion initial={[opacity,0,0,1,0,100]} target={[opacity,0,0,1,0,100]} duration={reducedMotion?0:duration}
    style={{display:'flex',flexDirection:'column',...StyleSheet.flatten(style)} as React.CSSProperties}>{children}</RustMotion>;
}
