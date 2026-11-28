import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useIsFocused } from 'expo-router';
import { useEffectsController } from './EffectsQuality';
import { loadGraphics } from './rustEngine.web';
import { observeMotionVisibility } from './motion-visibility.web';
import { useSystemReducedMotion } from './useSystemReducedMotion.web';

/** Only input and lifecycle cross this adapter. Rust writes every glyph,
 * crossfade, glow and word scale on the shared effects clock. */
export function useRustText(root: RefObject<unknown>, text: string, effect: number, active: boolean, reduced: boolean) {
  const controller = useEffectsController(), focused = useIsFocused(), systemReduced = useSystemReducedMotion();
  const latest = useRef({ active, reduced, focused, systemReduced });
  useLayoutEffect(() => { latest.current = { active, reduced, focused, systemReduced }; });
  useEffect(() => {
    const host = root.current as HTMLElement | null;
    if (!controller || !host) return;
    let live = true, detach = () => {}, unregister = () => {}, visible = true;
    const stopVisibility = observeMotionVisibility(host, value => { visible = value; });
    let motion: ReturnType<Awaited<ReturnType<typeof loadGraphics>>['TextTimeline']['create']> | undefined;
    // A crashed module refuses every call: the text then stays as written, and nothing throws into React.
    const stop = (problem: unknown) => { const node = motion; motion = undefined; detach(); host.dataset.graphicsError = String(problem); console.error('Rust typography stopped:', problem);
      try { node?.dispose(); } catch { /* Already crashed. */ } };
    const call = (work: (node: NonNullable<typeof motion>) => void) => { if (!motion) return; try { work(motion); } catch (problem) { stop(problem); } };
    const resize = new ResizeObserver(() => call(node => node.resize())); resize.observe(host);
    void loadGraphics().then(module => {
      if (!live) return;
      motion = module.TextTimeline.create(host, text, effect);
      void document.fonts.ready.then(() => { if (live) call(node => node.resize()); });
      const token = {};
      unregister = controller.register(token, 'Текст · Rust', message => { if ((message as { type: string }).type === 'watcher-clock-reset') call(node => node.reset_clock()); });
      detach = controller.frameJob(at => call(node => {
        const value = latest.current, running = value.active && value.focused && visible;
        node.active(running, value.reduced || value.systemReduced);
        controller.activity(token, running, running && !value.reduced && !value.systemReduced);
        node.frame(at);
      }));
    }).catch(error => { host.dataset.graphicsError = String(error); console.error('Rust typography:', error); });
    return () => { live = false; detach(); unregister(); stopVisibility(); resize.disconnect(); const node = motion; motion = undefined; try { node?.dispose(); } catch { /* Already crashed. */ } };
  }, [controller, root, text, effect]);
}
