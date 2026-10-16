import { useMemo } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';
import { usePanelSize } from '../motion/usePanelSize';
import { PanelArtwork } from '../motion/PanelArtwork';
import { DiaryTextEditor } from './DiaryTextEditor';
import { DiaryDesignAction } from './DiaryDesignPanel';
import { diaryDesignAsset } from './design-assets';
import { DIARY_TEXT_LIMIT } from '../state/model';
import type { DiaryTextEditorProps } from './DiaryTextEditor.types';
import { PanelScan } from '../motion/PanelScan';
import { useProduct } from '../state/ProductProvider';

export function DiaryEditorPanel({ height, session, onDone, ...editor }: DiaryTextEditorProps & { height: number; session: number; onDone(): void }) {
  const colors = useThemeColors(), { ref: headerRef, size: headerSize, onLayout: headerLayout } = usePanelSize({ width: 288, height: 27 });
  const { settings } = useProduct();
  // A straight rule uses the measured width; it has no closed contour to fit.
  const divider = useMemo(() => ({ uri: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${headerSize.width}" height="1" viewBox="0 0 ${headerSize.width} 1"><path d="M0 .5H${headerSize.width}" fill="none" stroke="${colors.accent}" stroke-width=".25"/></svg>`) }), [colors.accent, headerSize.width]);
  const frames = useMemo(() => ({ header: diaryDesignAsset('editor-header', colors, true), body: diaryDesignAsset('body', colors, true) }), [colors]);
  return <PanelScan testID="diary-editor-panel" style={[styles.root, { height }]} reducedMotion={settings.reducedMotion}>
    <View pointerEvents="none" style={[styles.frame, { top: 0, height: headerSize.height + 69 }]}><PanelArtwork source={frames.header} /></View>
    <View pointerEvents="none" style={[styles.frame, { top: headerSize.height + 79, bottom: 0 }]}><PanelArtwork source={frames.body} /></View>
    <View ref={headerRef} onLayout={headerLayout} style={[styles.titleRow, { backgroundColor: colors.background }]}>
      <ProductText variant="label" style={styles.title}>ТЕКСТ</ProductText>
      <View testID="diary-editor-divider" pointerEvents="none" style={styles.divider}><Image source={divider} contentFit="contain" style={StyleSheet.absoluteFill} /></View>
    </View>
    <DiaryTextEditor key={session} {...editor} />
    <View style={[styles.footer, { backgroundColor: colors.background }]}>
      <ProductText maxFontSize={10} style={styles.count}>{editor.text.length} / {DIARY_TEXT_LIMIT}</ProductText>
      <View style={styles.done}><DiaryDesignAction compact label="ГОТОВО" onPress={onDone} /></View>
    </View>
  </PanelScan>;
}
const styles = StyleSheet.create({
  root: { width: '100%', maxWidth: 480, alignSelf: 'center', maxHeight: '100%', minHeight: 0 },
  frame: { position: 'absolute', left: 0, right: 0, zIndex: 2 },
  titleRow: { minHeight: 27, paddingHorizontal: 12, paddingVertical: 8 },
  divider: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 },
  title: { fontSize: 10, lineHeight: 11, letterSpacing: 2.2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, paddingTop: 6, gap: 8 },
  count: { fontSize: 10, lineHeight: 14, letterSpacing: 4.4 }, done: { width: 99 },
});
