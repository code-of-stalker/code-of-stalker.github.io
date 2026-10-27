/** Soft wheel scrolling («Плавность»): the Rust glide in
 * graphics/soft-scroll owns the motion. This adapter only routes wheel events
 * to the right scroll container and writes the offsets Rust returns. Touch,
 * keyboard and reduced motion keep the browser's own scrolling. */
type Glide = { wheel(delta: number, mode: number, page: number, current: number, limit: number): boolean;
  frame(at: number, observed: number, limit: number): number; moving(): boolean; release(): void; free(): void };
type Module = { default(options: { module_or_path: string }): Promise<unknown>; SoftScroll: new () => Glide };

let runtime: Promise<Module> | undefined, module: Module | undefined, enabled = false, frame = 0;
const glides = new WeakMap<HTMLElement, Glide>(), gliding = new Set<HTMLElement>();
function load() {
  return runtime ??= (async () => {
    const value = await (Function('url', 'return import(url)') as (url: string) => Promise<Module>)('/graphics/soft-scroll/pkg/watcher_soft_scroll.js');
    await value.default({ module_or_path: '/graphics/soft-scroll/pkg/watcher_soft_scroll_bg.wasm' });
    return module = value;
  })().catch(problem => { runtime = undefined; console.warn('Rust soft scroll:', problem); throw problem; });
}
const limit = (el: HTMLElement) => Math.max(0, el.scrollHeight - el.clientHeight);

function tick(at: number) {
  frame = 0;
  for (const el of gliding) {
    const glide = glides.get(el);
    if (!glide || !el.isConnected) { glide?.release(); gliding.delete(el); continue; }
    const next = glide.frame(at, el.scrollTop, limit(el));
    if (Number.isNaN(next)) { gliding.delete(el); continue; }
    el.scrollTop = next;
    if (!glide.moving()) gliding.delete(el);
  }
  if (gliding.size) frame = requestAnimationFrame(tick);
}

/** Glides `el` by one wheel step. False leaves the step to the browser: the
 * mode is off, Rust is still loading, or the container is idle at its edge. */
export function softScrollBy(el: HTMLElement, delta: number, mode = 0) {
  if (!enabled) return false;
  if (!module) { void load().catch(() => {}); return false; }
  let glide = glides.get(el);
  if (!glide) { glide = new module.SoftScroll(); glides.set(el, glide); }
  if (!glide.wheel(delta, mode, el.clientHeight, el.scrollTop, limit(el))) return false;
  gliding.add(el);
  if (!frame) frame = requestAnimationFrame(tick);
  return true;
}
/** A programmatic jump wins over a glide in progress. */
export function releaseSoftScroll(el?: HTMLElement | null) {
  for (const node of [...gliding]) if (!el || node === el) { glides.get(node)?.release(); gliding.delete(node); }
}

// The nearest container that can move in the wheel's direction. Fields that
// edit text keep native scrolling; `data-soft-scroll="off"` opts a subtree out.
function scroller(target: EventTarget | null, delta: number) {
  for (let node = target instanceof Element ? target : null; node; node = node.parentElement) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.isContentEditable || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement || node.dataset.softScroll === 'off') return null;
    if (node.scrollHeight - node.clientHeight < 1) continue;
    const style = getComputedStyle(node), root = node === document.scrollingElement;
    if (root ? style.overflowY === 'hidden' || style.overflowY === 'clip' : style.overflowY !== 'auto' && style.overflowY !== 'scroll') continue;
    if (gliding.has(node) || (delta > 0 ? limit(node) - node.scrollTop > .5 : node.scrollTop > .5)) return node;
    // Chaining stops where the page contains overscroll, as native scrolling does.
    if (style.overscrollBehaviorY !== 'auto') return null;
  }
  return null;
}
// On window, this runs after element, React and document handlers, so
// readers, scroll gates and gutters that consumed the step keep it.
function wheel(event: WheelEvent) {
  if (!enabled || event.defaultPrevented || event.ctrlKey || event.shiftKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  const el = scroller(event.target, event.deltaY);
  if (el && softScrollBy(el, event.deltaY, event.deltaMode)) event.preventDefault();
}
// A finger, a key or the middle-button autoscroll takes over at once.
const takeOver = (event: Event) => { if (event.type !== 'mousedown' || (event as MouseEvent).button === 1) releaseSoftScroll(); };

export function setSoftScroll(value: boolean) {
  if (value === enabled || typeof document === 'undefined') return;
  enabled = value;
  const events = ['touchstart', 'keydown', 'mousedown'] as const;
  if (value) {
    void load().catch(() => {});
    window.addEventListener('wheel', wheel, { passive: false });
    for (const name of events) document.addEventListener(name, takeOver, { capture: true, passive: true });
  } else {
    window.removeEventListener('wheel', wheel);
    for (const name of events) document.removeEventListener(name, takeOver, { capture: true });
    releaseSoftScroll(); cancelAnimationFrame(frame); frame = 0;
  }
}
