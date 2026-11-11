import type { ReactNode } from 'react';

export type RustIconProps = {
  /** Glyph name known to the Rust icon scenes (`icon_motion.rs`). */
  name: string;
  width: number;
  height: number;
  color: string;
  filled?: boolean;
  round?: boolean;
  /** Line width in layout pixels. */
  stroke?: number;
  /** The still raster glyph, shown on native and until the engine arrives. */
  fallback: ReactNode;
};

/** Native keeps the still glyph; the tap scenes are web (Rust/WASM) only. */
export function RustIcon({ fallback }: RustIconProps) {
  return <>{fallback}</>;
}
