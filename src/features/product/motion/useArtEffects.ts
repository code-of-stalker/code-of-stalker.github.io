import { useCallback, useEffect, useRef, useState } from 'react';
import { useEffectsController } from './EffectsQuality';
import type { GlassMetrics } from './EffectsController';

/** Quality travels over the bridge; it never participates in srcDoc or scene keys. */
export function useArtEffects(label: string, send: (value: object) => void, active: boolean, decoration: boolean, onReady?: () => void, onDecoderComplete?: () => void) {
  const controller = useEffectsController();
  const [id] = useState(() => ({}));
  const latest = useRef({ active, decoration, onReady, onDecoderComplete });
  const ready = useRef(false), reported = useRef<boolean | null>(null);
  useEffect(() => { latest.current = { active, decoration, onReady, onDecoderComplete }; controller?.activity(id, active, reported.current ?? decoration); }, [controller, id, active, decoration, onReady, onDecoderComplete]);
  useEffect(() => {
    ready.current = false; reported.current = null;
    const unregister = controller?.register(id, label, send);
    controller?.activity(id, latest.current.active, reported.current ?? latest.current.decoration);
    return () => unregister?.();
  }, [controller, id, label, send]);
  const receive = useCallback((data: { type?: string; running?: boolean; metrics?: GlassMetrics }) => {
    if (data?.type === 'watcher-art-ready') {
      controller?.sync(id);
      if (!ready.current) { ready.current = true; latest.current.onReady?.(); }
    } else if (data?.type === 'watcher-decoder-complete') latest.current.onDecoderComplete?.();
    else if (data?.type === 'watcher-art-activity') {
      reported.current = !!data.running;
      controller?.activity(id, latest.current.active, reported.current);
    } else if (data?.type === 'watcher-art-metrics' && data.metrics) controller?.report(id, data.metrics);
  }, [controller, id]);
  const loaded = useCallback(() => { controller?.sync(id); send({ type: 'watcher-art-ready-check' }); }, [controller, id, send]);
  return { receive, loaded };
}
