import { View } from 'react-native';
import type { ArtProps } from './types';
import { useArtLoadingSettled } from '../skeleton/ArtLoading';

/**
 * A failed Rust surface must never silently switch to JavaScript graphics. It keeps its place
 * and stays empty: the art label is a developer name, never shown (Art's phone showed
 * «Стеклянная поверхность» over the admin PIN screen when the GPU had no room for a surface).
 */
export function ArtUnavailable(props: ArtProps) {
  useArtLoadingSettled();
  return <View testID="rust-art-unavailable" aria-hidden pointerEvents="none" style={[{ width: props.width ?? '100%', height: props.height }, props.style]} />;
}
