import type { PropsWithChildren } from 'react';
export type RecordingGestureProps = PropsWithChildren<{
  height: number; disabled: boolean; label: string;
  onBegin(y: number, scale: number): void; onMove(y: number): void;
  onBeginPoint?(x: number, y: number): void; onMovePoint?(x: number, y: number): void;
  onEnd(): void; onCancel(): void; onActivate(): void;
}>;
