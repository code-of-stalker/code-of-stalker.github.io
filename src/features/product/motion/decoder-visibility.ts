/** Visibility is independent of scroll intent: tall screens can show it immediately. */
export function decoderIsVisible(bounds: { top: number; height: number } | null,
  viewport: { offset: number; height: number }, layoutReady: boolean) {
  if (!layoutReady || !bounds || bounds.height <= 0 || viewport.height <= 0) return false;
  const visibleHeight = Math.min(bounds.top + bounds.height, viewport.offset + viewport.height)
    - Math.max(bounds.top, viewport.offset);
  return visibleHeight >= bounds.height * .35;
}
