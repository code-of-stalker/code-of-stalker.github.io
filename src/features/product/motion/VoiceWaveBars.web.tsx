import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { loadGraphics } from './rustEngine.web';
import type { VoiceWave } from './rustEngine.web';
import { useSystemReducedMotion } from './useSystemReducedMotion.web';
import { useUiReduced } from './uiMotion';
import type { VoiceWaveBarsProps } from './VoiceWaveBars';

const layer = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } as const;

/** Bridge only: React lays out the bars once; Rust runs the playhead between the
 * player's reports, washes the played part in and lifts the bars under the playhead. */
export function VoiceWaveBars({ bars, positionMs, durationMs, playing, accent, muted }: VoiceWaveBarsProps) {
  const host = useRef<HTMLDivElement>(null), wave = useRef<VoiceWave | null>(null), raf = useRef(0);
  const systemReduced = useSystemReducedMotion(), appReduced = useUiReduced(), reduced = systemReduced || appReduced;
  const progress = Math.min(1, positionMs / Math.max(1, durationMs));
  const [startClip] = useState(() => `inset(0 ${(1 - progress) * 100}% 0 0)`), [failed, setFailed] = useState(false);
  const latest = useRef({ positionMs, durationMs, playing, reduced });
  useLayoutEffect(() => { latest.current = { positionMs, durationMs, playing, reduced }; });
  const run = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const step = (at: number) => { raf.current = 0; if (wave.current?.frame(at)) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
  }, []);
  useEffect(() => {
    let disposed = false;
    void loadGraphics().then(module => {
      if (disposed || !host.current) return;
      const value = latest.current, node = module.VoiceWave.create(host.current, value.positionMs, value.durationMs);
      node.reduced(value.reduced); node.sync(value.positionMs, value.durationMs, value.playing); wave.current = node; run();
    }).catch(problem => { if (!disposed) { console.error('Rust voice wave:', problem); setFailed(true); } });
    return () => { disposed = true; cancelAnimationFrame(raf.current); raf.current = 0; wave.current?.dispose(); wave.current = null; };
  }, [run]);
  useEffect(() => { if (wave.current) { wave.current.sync(positionMs, durationMs, playing); run(); } }, [positionMs, durationMs, playing, run]);
  useEffect(() => { if (wave.current) { wave.current.reduced(reduced); run(); } }, [reduced, run]);
  const draw = (color: string, opacity: number) => bars.map((level, i) => <div key={i} data-wave-bar={i}
    style={{ width: 1, height: 3 + level * 25, backgroundColor: color, opacity, transformOrigin: 'center', flexShrink: 0 }} />);
  return <div ref={host} style={{ position: 'relative', flex: 1, alignSelf: 'stretch', pointerEvents: 'none' }}>
    <div style={layer}>{draw(muted, .65)}</div>
    <div data-wave-played style={{ ...layer, clipPath: failed ? `inset(0 ${(1 - progress) * 100}% 0 0)` : startClip }}>{draw(accent, 1)}</div>
  </div>;
}
