import type { PropsWithChildren } from 'react';
import { RustMotion, shown } from './RustMotion.web';
export function ScreenTransition({ children, reducedMotion = false }: PropsWithChildren<{ reducedMotion?: boolean }>) {
  return <RustMotion initial={[1, reducedMotion ? 0 : 24, 0, 1, 0, 100]} target={shown} duration={reducedMotion ? 0 : 800}
    curve={[.215, .61, .355, 1]} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</RustMotion>;
}
