/** Observe the renderer's completion boundary, not a wall-clock estimate. */
export function observeDecoderCompletion(root: Element, complete: () => void) {
  const decoder = root.querySelector('.mx-decoder');
  if (!decoder) return () => {};
  let done = false;
  const check = () => {
    if (done || decoder.getAttribute('data-motion-state') !== 'settled') return;
    done = true; observer.disconnect(); complete();
  };
  const observer = new MutationObserver(check);
  observer.observe(decoder, { attributes: true, attributeFilter: ['data-motion-state'] });
  check();
  return () => observer.disconnect();
}
