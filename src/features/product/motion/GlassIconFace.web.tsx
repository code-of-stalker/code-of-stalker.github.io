import { StyleSheet, View } from 'react-native';
import { RustGlass } from './RustGlass.web';
const shape = { width: 44, height: 42, path: 'M33.4473 .125L43.875 10.5527V41.875H10.5527L.125 31.4473V.125Z', background: 'clear' as const };
export function GlassIconFace() {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}><RustGlass kind="glass" width={44} height={42} glass={shape} scanOnMount={false} /></View>;
}
