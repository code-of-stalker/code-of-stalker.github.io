import { useLayoutEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';
import { PanelArtwork } from './PanelArtwork';

// Authored 0.25 px strip; Rust fits only its horizontal span to each measured line.
const underline = { uri: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="2" viewBox="0 0 100 2"><path d="M0 .875H100V1.125H0Z" fill="#F5DD07"/></svg>') };
type Line = { x: number; y: number; width: number };

export function UnderlinedText({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const colors = useThemeColors(), root = useRef<View>(null), [lines, setLines] = useState<Line[]>([]);
  const update = (next: Line[]) => setLines(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !root.current) return;
    const node = root.current as unknown as HTMLElement, text = node.firstElementChild;
    if (!text) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const box = node.getBoundingClientRect(), range = document.createRange();
      range.selectNodeContents(text);
      const scale = node.offsetWidth ? box.width / node.offsetWidth : 1;
      if (!(scale > 0)) return;
      update([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => ({
        x: (rect.left - box.left) / scale, y: (rect.bottom - box.top) / scale - 1, width: rect.width / scale,
      })));
    };
    const observer = new ResizeObserver(measure); observer.observe(node); observer.observe(text);
    measure(); void document.fonts.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); };
  }, [children]);
  const color = StyleSheet.flatten(style)?.color ?? colors.text;
  return <View ref={root} testID="custom-underlined-text" style={styles.root}>
    <ProductText style={style} onTextLayout={event => {
      if (Platform.OS !== 'web') update(event.nativeEvent.lines.map(line => ({ x: line.x, y: line.y + line.height - line.descender + 1, width: line.width })));
    }}>{children}</ProductText>
    {lines.map((line, index) => <View key={index} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: line.x, top: line.y, width: line.width, height: 2 }}>
      <PanelArtwork source={underline} color={String(color)} />
    </View>)}
  </View>;
}
const styles = StyleSheet.create({ root: { alignSelf: 'center', maxWidth: '100%', paddingBottom: 2 } });
