export const motionSettledEvent = 'watcher-motion-settled';

/** A canvas can be observed while its entering parent is below the viewport.
 * Refresh the browser's intersection once the parent settles; no layout read,
 * polling, or animation clock reset is needed. Offscreen nodes still pause. */
export function observeMotionVisibility(element: Element, changed: (visible: boolean) => void) {
  const observer = new IntersectionObserver(entries => {
    const latest = entries.at(-1);
    if (latest) changed(latest.isIntersecting);
  }, { threshold: .01 });
  const document = element.ownerDocument;
  const settled = (event: Event) => {
    const parent = event.target;
    if (parent instanceof Element && parent.contains(element)) {
      observer.unobserve(element);
      observer.observe(element);
    }
  };
  observer.observe(element);
  document.addEventListener(motionSettledEvent, settled);
  return () => { document.removeEventListener(motionSettledEvent, settled); observer.disconnect(); };
}
