import { useMemo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { PanelArtwork } from '../motion/PanelArtwork';
import { ProductText } from '../ui';
import { DiaryGlass } from './DiaryGlass';
import { DiaryAsset, DiaryIcon } from './DiaryIcons';
import { diaryArtwork } from './diaryArtwork';

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
// folded it shrinks to one thin line, so it stops taking the screen.
export function DiaryReportPrompt({ title, hint, foldedLabel, accessibilityLabel, collapsed, onCollapsedChange, onPress, disabled, style, testID = 'diary-report-prompt' }: DiaryReportPromptProps) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  const frame = useMemo(() => diaryArtwork('prompt', colors), [colors]);
  const fold = <Pressable testID={`${testID}-fold`} accessibilityRole="button" accessibilityLabel={collapsed ? 'Развернуть плашку отчёта' : 'Свернуть плашку отчёта'} accessibilityState={{ expanded: !collapsed }}
    hitSlop={6} onPress={() => onCollapsedChange(!collapsed)} style={styles.fold}>
    <View style={!collapsed && styles.chevronUp}><DiaryAsset name="chevron" /></View>
  </Pressable>;
  if (collapsed) return <View testID={testID} style={[styles.folded, style]}>
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={disabled} onPress={onPress} style={styles.foldedOpen}>
      <DiaryIcon name="plus" size={14} /><ProductText style={styles.foldedLabel}>{foldedLabel}</ProductText>
    </Pressable>
    {fold}
    <View style={styles.foldedLine} />
  </View>;
  return <View testID={testID} style={[styles.prompt, style]}>
    <DiaryGlass shape="panel" /><PanelArtwork source={frame} />
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={disabled} onPress={onPress} style={styles.open}>
      <DiaryAsset name="sparkle" />
      <View style={styles.copy}><ProductText variant="title" style={styles.title}>{title}</ProductText><ProductText style={styles.hint}>{hint}</ProductText></View>
      <DiaryIcon name="plus" />
    </Pressable>
    {fold}
  </View>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  prompt: { minHeight: 64, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  open: { flex: 1, minWidth: 0, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12, paddingVertical: 10 },
  copy: { flex: 1, minWidth: 0, gap: 6 },
  title: { fontSize: 12, lineHeight: 16 },
  hint: { color: colors.muted, fontSize: 8, lineHeight: 12 },
  fold: { width: 36, alignSelf: 'stretch', minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  chevronUp: { transform: [{ rotate: '180deg' }] },
  folded: { minHeight: 36, flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  foldedOpen: { flex: 1, minWidth: 0, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 },
  foldedLabel: { fontSize: 8, lineHeight: 12, color: colors.muted, flexShrink: 1 },
  foldedLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: .25, backgroundColor: colors.border },
});
