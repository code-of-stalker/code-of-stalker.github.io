import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ArtProps } from '../motion/types';
import { SkeletonBlock, SkeletonHost } from './Skeleton';

/** Lets a surface that could not load release its skeleton without
 * claiming it is ready (`onReady` keeps its meaning for the callers). */
const ArtSettle = createContext<(() => void) | null>(null);
export function useArtLoadingSettled() {
  const settle = useContext(ArtSettle);
  useEffect(() => { settle?.(); }, [settle]);
}

/** Backdrops, glass surfaces, gradients and the compact voice control are
 * part of the frame around content; only illustrations hold their place. */
export function holdsPlace(props: ArtProps) {
  return props.kind !== 'rain' && props.kind !== 'glass' && props.kind !== 'home-shade' && !props.voiceCompact;
}

/** The live scenes and the cloud film keep a centered 3 : 2 frame. */
const framed = (props: ArtProps) => props.presentation !== 'card' && (!!props.webScene || props.kind === 'grounding-here');

/** An illustration's place, held by a skeleton until its first frame is on
 * screen. The scene keeps its own layout inside the same box. */
export function ArtLoading({ props, children }: { props: ArtProps; children(props: ArtProps): ReactNode }) {
  // A new kind or scene is a new load: its place is held again, while the
  // scene component itself stays mounted and swaps its own content.
  const identity = `${props.kind}:${props.webScene ?? ''}`;
  const [loaded, setLoaded] = useState<string | null>(null);
  const settle = useCallback(() => setLoaded(identity), [identity]);
  const { onReady } = props;
  const scene = children({ ...props, style: undefined, onReady: () => { setLoaded(identity); onReady?.(); } });
  return <View style={[{ width: props.width ?? '100%', height: props.height }, props.style]}>
    <SkeletonHost key={identity} ready={loaded === identity} reducedMotion={props.reducedMotion} testID="art-skeleton">
      {props.presentation === 'card' ? <SkeletonBlock style={StyleSheet.absoluteFill} />
        : framed(props) ? <View style={styles.center}><SkeletonBlock corners="panel" style={[styles.frame, { maxWidth: props.height * 1.5 }]} /></View>
          : <SkeletonBlock corners="panel" style={StyleSheet.absoluteFill} />}
    </SkeletonHost>
    <ArtSettle.Provider value={settle}>{scene}</ArtSettle.Provider>
  </View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '100%', aspectRatio: 3 / 2 },
});
