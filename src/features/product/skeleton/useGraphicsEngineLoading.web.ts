import { useEffect, useSyncExternalStore } from 'react';
import { graphicsEngine, loadGraphics } from '../motion/rustEngine.web';

const loading = () => graphicsEngine.state() === 'idle' || graphicsEngine.state() === 'loading';
/** Every screen's reveals, panel contours and type wait for the shared Rust
 * engine. Asking here starts its download as early as the app shell mounts.
 * A failed engine is not "loading": the screens show their own fallbacks. */
export function useGraphicsEngineLoading() {
  useEffect(() => { loadGraphics().catch(() => {}); }, []);
  return useSyncExternalStore(graphicsEngine.subscribe, loading, () => true);
}
