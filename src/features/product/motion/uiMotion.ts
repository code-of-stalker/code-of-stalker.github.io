import { useOptionalProduct } from '../state/ProductProvider';

/** One motion language for interface changes (Art 2026-11-11): short, soft,
 * no springs for their own sake. Rust plays every frame; these are the targets. */
export const uiDuration = 220;
/** Height changes (a plate folding, an entry leaving) take a little longer. */
export const uiFoldDuration = 280;
/** Screens arrive a touch slower than controls. */
export const uiScreenDuration = 260;
/** Soft ease-out: quick start, long gentle landing, no overshoot. */
export const uiCurve = [.25, .8, .25, 1] as const;
/** Distance a new piece of content travels as it fades in, in px. */
export const uiShift = 8;

/** The app's own «reduce motion» setting; the system setting is applied inside RustMotion. */
export function useUiReduced() {
  return !!useOptionalProduct()?.settings.reducedMotion;
}
