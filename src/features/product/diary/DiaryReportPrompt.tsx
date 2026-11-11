import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { PanelArtwork } from '../motion/PanelArtwork';
import { Appear } from '../motion/Appear';
import { AutoHeight } from '../motion/AutoHeight';
import { ProductText } from '../ui';
import { DiaryGlass } from './DiaryGlass';
import { DiaryAsset, DiaryIcon } from './DiaryIcons';
import { diaryArtwork } from './diaryArtwork';
import { claimsReportFold, flipsReportFold } from './report-fold-gesture';

export type DiaryReportPromptProps = {
  /** Big line, e.g. «Что ощутили сегодня?». */
  title: string;
  /** Small caps line under the title, e.g. «ДОБАВИТЬ ОТЧЁТ ДИНАМИКИ». */
  hint: string;
  /** The one line shown while folded, e.g. «ОТЧЁТ О ДИНАМИКЕ». */
  foldedLabel: string;
  accessibilityLabel: string;
  /** The owner persists this (diary: `settings.diaryReportCollapsed`). */
  collapsed: boolean;
  onCollapsedChange(next: boolean): void;
  onPress(): void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// The daily report plate. Shared by the diary and the Intensive daily reports:
// folded it shrinks to one thin line, so it stops taking the screen. It folds by a drag
// up and unfolds by a drag down on the strip (Art 2026-11-11: no arrow beside the plus).
export function DiaryReportPrompt({ title, hint, foldedLabel, accessibilityLabel, collapsed, onCollapsedChange, onPress, disabled, style, testID = 'diary-report-prompt' }: DiaryReportPromptProps) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  const frame = useMemo(() => diaryArtwork('prompt', colors), [colors]);
  const latest = useRef({ collapsed, onCollapsedChange });
  useEffect(() => { latest.current = { collapsed, onCollapsedChange }; }, [collapsed, onCollapsedChange]);
  /* eslint-disable react-hooks/refs -- PanResponder registers callbacks; they read the ref only on touch. */
  const drag = useMemo(() => PanResponder.create({
    // Capture so the drag is taken from the inner tap target once it is clearly vertical.
    onMoveShouldSetPanResponderCapture: (_, state) => claimsReportFold(latest.current.collapsed, state.dx, state.dy),
    onPanResponderRelease: (_, state) => {
      const { collapsed: now, onCollapsedChange: change } = latest.current;
      if (flipsReportFold(now, state.dx, state.dy)) change(!now);
    },
    onPanResponderTerminationRequest: () => true,
  }), []);
  /* eslint-enable react-hooks/refs */
  const a11y = {
    accessibilityActions: [{ name: collapsed ? 'expand' : 'collapse', label: collapsed ? 'Развернуть плашку отчёта' : 'Свернуть плашку отчёта' }],
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'expand' || event.nativeEvent.actionName === 'collapse') onCollapsedChange(!collapsed);
    },
  };
  // Folding glides the height (AutoHeight) while the new face fades in from the side it came from.
  return <AutoHeight style={style}><Appear key={collapsed ? 'folded' : 'open'} rise={collapsed ? 6 : -6}>{collapsed
  ? <View testID={testID} {...drag.panHandlers} {...a11y} style={[styles.folded, webNoBrowserPan]}>
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint="Потяни вниз, чтобы развернуть" disabled={disabled} onPress={onPress} style={styles.foldedOpen}>
      <DiaryIcon name="plus" size={14} /><ProductText style={styles.foldedLabel}>{foldedLabel}</ProductText>
    </Pressable>
    <View style={styles.foldedLine} />
  </View>
  : <View testID={testID} {...drag.panHandlers} {...a11y} style={[styles.prompt, webNoBrowserPan]}>
    <DiaryGlass shape="panel" /><PanelArtwork source={frame} />
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint="Потяни вверх, чтобы свернуть" disabled={disabled} onPress={onPress} style={styles.open}>
      <DiaryAsset name="sparkle" />
      <View style={styles.copy}><ProductText variant="title" style={styles.title}>{title}</ProductText><ProductText style={styles.hint}>{hint}</ProductText></View>
      <DiaryIcon name="plus" />
    </Pressable>
  </View>}</Appear></AutoHeight>;
}

// On web the browser must not turn the drag into page panning or pull-to-refresh.
const webNoBrowserPan = Platform.OS === 'web' ? ({ touchAction: 'none' } as unknown as ViewStyle) : null;

const createStyles = (colors: ProductColors) => StyleSheet.create({
  prompt: { minHeight: 64, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  open: { flex: 1, minWidth: 0, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  copy: { flex: 1, minWidth: 0, gap: 6 },
  title: { fontSize: 12, lineHeight: 16 },
  hint: { color: colors.muted, fontSize: 8, lineHeight: 12 },
  folded: { minHeight: 36, flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  foldedOpen: { flex: 1, minWidth: 0, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 },
  foldedLabel: { fontSize: 8, lineHeight: 12, color: colors.muted, flexShrink: 1 },
  foldedLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: .25, backgroundColor: colors.border },
});
