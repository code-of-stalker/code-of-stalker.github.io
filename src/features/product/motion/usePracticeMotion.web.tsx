import { useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { RustMotion, shown } from './RustMotion.web';

/** React publishes the target/finished event. Rust keeps the intermediate frame
 * and the transition lock on the same paused clock as illustrations. */
export function usePracticeMotion(ready: boolean, reduced: boolean, height: number) {
  const [leaving, setLeaving] = useState(false), [epoch, setEpoch] = useState(0);
  const finish = useRef<(() => void) | null>(null), unlock = useRef<(() => void) | null>(null);
  return {
    scale: reduced || !ready ? 1 : .965,
    clock: epoch > 0 ? <RustMotion key={epoch} initial={[0, 0, 0, 1, 0, 100]} target={shown} duration={reduced ? 0 : 600}
      onComplete={() => { const callback = unlock.current; unlock.current = null; callback?.(); }} aria-hidden style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none', overflow: 'hidden' }} /> : null,
    reset: () => setLeaving(false),
    // Outgoing scale is captured by RustMotion.freezeScale, not a guessed value.
    freeze: (complete: (scale: number) => void) => complete(reduced || !ready ? 1 : .965),
    lock: (complete: () => void) => { unlock.current = complete; setEpoch(value => value + 1); },
    leave: (complete: () => void) => { finish.current = complete; setLeaving(true); },
    frame: (children: ReactNode, style: StyleProp<ViewStyle>, changing: boolean) => <RustMotion initial={shown} target={[leaving ? 0 : 1, 0, 0, reduced || !ready ? 1 : .965, 0, 100]}
      duration={reduced ? 0 : leaving ? 420 : 360} curve={leaving ? [.55, 0, .3, 1] : [.215, .61, .355, 1]} freezeScale={leaving}
      onComplete={() => { if (!leaving) return; const callback = finish.current; finish.current = null; callback?.(); }}
      style={{ ...StyleSheet.flatten(style), display: 'flex', flexDirection: 'column', pointerEvents: changing ? 'none' : 'auto' } as CSSProperties}>{children}</RustMotion>,
    panel: (children: ReactNode, style: StyleProp<ViewStyle>) => <RustMotion initial={shown} target={[1, 0, leaving ? height * .6 : 0, 1, 0, 100]}
      duration={reduced ? 0 : 420} curve={[.55, 0, .3, 1]} style={{ ...StyleSheet.flatten(style), display: 'flex', flexDirection: 'column' } as CSSProperties}>{children}</RustMotion>,
  };
}
