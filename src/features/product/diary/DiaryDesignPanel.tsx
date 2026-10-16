import { useMemo, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';
import { PanelArtwork } from '../motion/PanelArtwork';
import { PanelBorder } from '../PanelBorder';
import { diaryDesignAsset } from './design-assets';
import { DiaryGlass } from './DiaryGlass';
import { PanelScan } from '../motion/PanelScan';
import { useProduct } from '../state/ProductProvider';
import { DiaryIcon } from './DiaryIcons';

export function DiaryDesignPanel({ title, height, children, onClose, closeDisabled = false, testID = 'diary-design-panel', contentStyle, footer }: PropsWithChildren<{
  title: string; height?: number; onClose?(): void; closeDisabled?: boolean; testID?: string; contentStyle?: StyleProp<ViewStyle>; footer?: ReactNode;
}>) {
  const colors = useThemeColors();
  const { settings } = useProduct();
  const metrics = useRef({ offset: 0, height: 0, content: 0 });
  const [edges, setEdges] = useState({ top: false, bottom: false });
  function updateEdges() {
    const { offset, height: viewport, content } = metrics.current;
    const top = viewport > 0 && offset > 1, bottom = viewport > 0 && content - viewport - offset > 1;
    setEdges(previous => previous.top === top && previous.bottom === bottom ? previous : { top, bottom });
  }
  const mask = `linear-gradient(to bottom, ${edges.top ? 'transparent, #000 16px' : '#000 0px'}, ${edges.bottom ? '#000 calc(100% - 16px), transparent' : '#000 100%'})`;
  const fade = useMemo(() => ({ uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="16"><defs><linearGradient id="fade" x2="0" y2="1"><stop stop-color="${colors.background}"/><stop offset="1" stop-color="${colors.background}" stop-opacity="0"/></linearGradient></defs><rect width="1" height="16" fill="url(#fade)"/></svg>`)}` }), [colors.background]);
  const frames = useMemo(() => ({ header: diaryDesignAsset('header', colors), body: diaryDesignAsset('body', colors) }), [colors]);
  return <PanelScan testID={testID} style={[styles.panel, height !== undefined && { height }]} reducedMotion={settings.reducedMotion}>
    <View testID="diary-sheet-header" style={[styles.header, onClose && styles.headerWithClose, { backgroundColor: colors.background }]}>
      <DiaryGlass /><PanelArtwork source={frames.header} />
      <ProductText variant="label" style={[styles.title, onClose && { flex: 1 }]}>{title}</ProductText>
      {onClose && <Pressable accessibilityRole="button" accessibilityLabel="Закрыть окно" disabled={closeDisabled} onPress={onClose} style={styles.close}><DiaryIcon name="close" size={16} /></Pressable>}
    </View>
    <View testID="diary-sheet-body" style={[styles.body, height === undefined ? styles.intrinsic : styles.fixed, { backgroundColor: colors.background }]}>
      <DiaryGlass /><PanelArtwork source={frames.body} />
      <View style={[styles.scrollWindow, height === undefined ? styles.intrinsic : styles.fixed]}>
        <ScrollView testID="diary-sheet-scroll" style={[styles.scroll, height === undefined ? styles.intrinsic : styles.fixed,
          Platform.OS === 'web' && { maskImage: mask, WebkitMaskImage: mask } as ViewStyle]}
          onLayout={event => { metrics.current.height = event.nativeEvent.layout.height; updateEdges(); }}
          onContentSizeChange={(_, size) => { metrics.current.content = size; updateEdges(); }}
          onScroll={event => { metrics.current.offset = event.nativeEvent.contentOffset.y; updateEdges(); }} scrollEventThrottle={16}
          contentContainerStyle={[styles.content, height === undefined && { flexGrow: 0, justifyContent: 'flex-start' }, contentStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        {Platform.OS !== 'web' && edges.top && <Image pointerEvents="none" source={fade} contentFit="fill" style={styles.topFade} />}
        {Platform.OS !== 'web' && edges.bottom && <Image pointerEvents="none" source={fade} contentFit="fill" style={[styles.topFade, { top: undefined, bottom: 0, transform: [{ rotate: '180deg' }] }]} />}
      </View>
      {footer && <View style={styles.footer}>{footer}</View>}
    </View>
  </PanelScan>;
}
export function DiaryDesignAction({ label, onPress, ghost = false, disabled = false, compact = false }: { label: string; onPress(): void; ghost?: boolean; disabled?: boolean; compact?: boolean }) {
  const colors = useThemeColors();
  const symbols = useMemo(() => [diaryDesignAsset('button-symbol-01', colors), diaryDesignAsset('button-symbol-02', colors)], [colors]);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.action, compact && { minHeight: 24, height: 24, paddingVertical: 2 }, disabled && { opacity: .4 }]}>
    {!ghost && <PanelBorder color={colors.accent} />}
    {!ghost && !compact && <Image pointerEvents="none" source={symbols[0]} style={styles.symbol} contentFit="contain" />}
    <ProductText variant="title" maxFontSize={compact ? 10 : 16} color={ghost ? colors.muted : colors.accent} style={[styles.actionText, compact && { fontSize: 10, lineHeight: 14 }]}>{label}</ProductText>
    {!ghost && !compact && <Image pointerEvents="none" source={symbols[1]} style={[styles.symbol, { transform: [{ rotate: '180deg' }, { scaleY: -1 }] }]} contentFit="contain" />}
  </Pressable>;
}
const styles = StyleSheet.create({
  panel: { width: '100%', maxWidth: 480, alignSelf: 'center', maxHeight: '100%', flexShrink: 1, gap: 10 },
  header: { minHeight: 27, paddingVertical: 8, paddingHorizontal: 16, justifyContent: 'center', flexShrink: 0 },
  headerWithClose: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingRight: 8, gap: 8 },
  close: { width: 32, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 10, lineHeight: 14, letterSpacing: 2.2, flexShrink: 1 }, body: { minHeight: 0 }, scroll: { minHeight: 0 },
  intrinsic: { flexShrink: 1 }, fixed: { flex: 1 },
  scrollWindow: { minHeight: 0, marginVertical: 8, overflow: 'hidden' },
  topFade: { position: 'absolute', top: 0, left: 0, width: '100%', height: 16 },
  footer: { flexShrink: 0, padding: 16, paddingTop: 12 },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, gap: 20 },
  action: { minHeight: 42, paddingHorizontal: 5, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, lineHeight: 19.6, fontWeight: '500', textAlign: 'center', flexShrink: 1 }, symbol: { width: 32, height: 32, flexShrink: 0 },
});
