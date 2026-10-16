/** Meaningful visibility of an inline scene, independent of its renderer. */
export function bookProjectionVisible(bounds: { top: number; height: number } | null, viewport: { offset: number; height: number }) {
  if (!bounds || bounds.height <= 0 || viewport.height <= 0) return false;
  const overlap = Math.min(bounds.top + bounds.height, viewport.offset + viewport.height) - Math.max(bounds.top, viewport.offset);
  return overlap >= Math.min(bounds.height * .55, viewport.height * .65);
}
