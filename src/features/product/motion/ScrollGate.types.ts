import type { PropsWithChildren, RefObject } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
export type ScrollGateController = { scrollTo(offset: number): void; setScrollLocked(locked: boolean): void };
export type ReadingGesture = { locked: boolean; /** Fully collapsed, settled shell can hand reverse input to navigation. */ atRest?: boolean; onDrag(delta: number): void };
export type ScrollGateProps = PropsWithChildren<{
  enabled: boolean; onReady(ready: boolean): void; onProgress(value: number): void; onAdvance(): void;
  onRetreat?: () => void; fill?: boolean; allowAdvance?: boolean;
  fadeTop?: number; fadeBottom?: number;
  resetKey?: string | number;
  // Restore the entry edge on mount; subsequent resetKey changes start at the top.
  startAtEnd?: boolean;
  initialOffset?: number;
  /** A replaced web reader consumes the outgoing wheel/touch tail until a fresh gesture. */
  guardEntryGesture?: boolean;
  controllerRef?: RefObject<ScrollGateController | null>;
  /** Expansion consumes input without moving the article's scroll container. */
  readingGesture?: ReadingGesture;
  onViewportChange?: (viewport: { offset: number; height: number }) => void;
  style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>;
}>;
