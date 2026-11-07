import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';

import { PanelBorder } from '../../product/PanelBorder';
import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import { useProductLayout } from '../../product/layout';
import type { ProductColors } from '../../product/theme';
import { fonts } from '../../product/theme';
import { ProductIconButton, ProductText } from '../../product/ui';
import { BackendError } from '../backend';
import type { Place } from '../backend';

export const placeLabels: Record<Place, string> = {
  walker: 'ИДУЩИЙ', guide: 'ПРОВОДНИК', admin: 'АДМИН ПРОВОДНИКА', main: 'ГЛАВНЫЙ АДМИН',
};

/** A plain Russian sentence for any failure; details stay in the console. */
export function problemText(problem: unknown, fallback = 'Что-то пошло не так. Попробуй ещё раз.') {
  if (problem instanceof BackendError) {
    if (problem.code === 'network') return 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.';
    if (problem.code === 'rate-limit') return 'Слишком много попыток. Подожди несколько минут.';
    if (problem.code === 'denied') return 'Нет доступа. Возможно, права изменились: войди заново.';
  }
  if (problem instanceof Error && /Failed to fetch|NetworkError|Load failed/i.test(problem.message)) return 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.';
  console.warn('[intensive]', problem);
  return fallback;
}

export function formatTime(iso: string) {
  const date = new Date(iso), now = new Date();
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return time;
  return `${date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} ${time}`;
}

export function Header({ subtitle, onBack, action }: { subtitle: string; onBack: () => void; action?: ReactNode }) {
  const styles = useThemeStyles(createStyles);
  const { icon } = useProductLayout();
  return <View style={styles.header}>
    <ProductIconButton icon="back" onPress={onBack} />
    <View style={styles.heading}>
      <ProductText variant="title" numberOfLines={1} style={styles.title}>ИНТЕНСИВ</ProductText>
      <ProductText variant="label" numberOfLines={1} style={styles.subtitle}>{subtitle}</ProductText>
    </View>
    {action ?? <View style={{ width: icon.width, height: icon.buttonHeight }} />}
  </View>;
}

export function Divider() {
  return <View style={useThemeStyles(createStyles).divider} />;
}

export function Heading({ children }: { children: ReactNode }) {
  return <ProductText variant="title" style={useThemeStyles(createStyles).heading2}>{children}</ProductText>;
}

export function Note({ children, tone = 'muted', style, center = false }: { children: ReactNode; tone?: 'muted' | 'error' | 'text'; style?: StyleProp<ViewStyle>; center?: boolean }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return <View style={style}><ProductText accessibilityRole={tone === 'error' ? 'alert' : undefined}
    style={[styles.note, center && styles.center, { color: tone === 'error' ? colors.error : tone === 'text' ? colors.text : colors.muted }]}>{children}</ProductText></View>;
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return <View style={styles.fieldWrap}>
    {label ? <ProductText variant="label" style={styles.fieldLabel}>{label}</ProductText> : null}
    <View style={styles.field}>
      <PanelBorder />
      <TextInput placeholderTextColor={colors.faint} autoCorrect={false} spellCheck={false} {...props}
        style={[styles.input, props.multiline && styles.multiline, style]} />
    </View>
  </View>;
}

/** A plain row button with a hairline frame, used for lists. */
export function Row({ title, detail, onPress, selected = false, right }: {
  title: string; detail?: string; onPress?: () => void; selected?: boolean; right?: ReactNode;
}) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} disabled={!onPress}
    style={[styles.row, selected && { backgroundColor: colors.subtle }]}>
    <PanelBorder color={selected ? colors.accent : undefined} />
    <View style={styles.rowCopy}>
      <ProductText numberOfLines={1} style={styles.rowTitle}>{title}</ProductText>
      {detail ? <ProductText variant="label" numberOfLines={2} style={styles.rowDetail}>{detail}</ProductText> : null}
    </View>
    {right}
  </Pressable>;
}

/** `fit` sizes each tab to its label, so longer labels with counts still fit on a phone. */
export function Tabs<T extends string>({ value, options, onChange, fit = false }: { value: T; options: { id: T; label: string }[]; onChange: (id: T) => void; fit?: boolean }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return <View accessibilityRole="tablist" style={styles.tabs}>
    {options.map(option => {
      const on = option.id === value;
      return <Pressable key={option.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(option.id)}
        style={[styles.tab, fit && styles.fitTab, on && { borderBottomColor: colors.accent }]}>
        <ProductText variant="label" numberOfLines={1} style={[{ color: on ? colors.text : colors.muted, textAlign: 'center' }, fit && styles.fitLabel]}>{option.label}</ProductText>
      </Pressable>;
    })}
  </View>;
}

/** Six dots and a keypad; digits typed on a keyboard work too. */
export function PinPad({ title, detail, busy = false, error, onComplete }: {
  title: string; detail?: string; busy?: boolean; error?: string; onComplete: (pin: string) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const [digits, setDigits] = useState('');
  const press = (key: string) => {
    if (busy) return;
    if (key === 'back') { setDigits(digits.slice(0, -1)); return; }
    if (digits.length >= 6) return;
    const next = digits + key;
    setDigits(next.length === 6 ? '' : next);
    if (next.length === 6) onComplete(next);
  };
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('back');
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];
  return <View style={styles.pin}>
    <Heading>{title}</Heading>
    {detail ? <Note center>{detail}</Note> : null}
    <View accessibilityLabel={`Введено цифр: ${digits.length} из 6`} style={styles.dots}>
      {Array.from({ length: 6 }, (_, i) => <View key={i} style={[styles.dot, { borderColor: colors.accent }, (i < digits.length || busy) && { backgroundColor: colors.accent }]} />)}
    </View>
    <View style={styles.errorSlot}>{error ? <Note center tone="error">{error}</Note> : busy ? <Note center>Проверяю…</Note> : null}</View>
    <View style={styles.keypad}>
      {keys.map((key, i) => key === '' ? <View key={i} style={styles.key} /> :
        <Pressable key={i} accessibilityRole="button" accessibilityLabel={key === 'back' ? 'Стереть' : key} onPress={() => press(key)} disabled={busy}
          style={({ pressed }) => [styles.key, pressed && { backgroundColor: colors.subtle }]}>
          <PanelBorder />
          <ProductText variant="title" style={styles.keyText}>{key === 'back' ? '⌫' : key}</ProductText>
        </Pressable>)}
    </View>
  </View>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  heading: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3 },
  title: { fontSize: 20, lineHeight: 28 },
  subtitle: { fontSize: 8, lineHeight: 12, letterSpacing: 4.96, color: colors.muted },
  divider: { height: 0.75, backgroundColor: colors.accent, opacity: 0.2 },
  heading2: { fontSize: 14, lineHeight: 20 },
  note: { lineHeight: 18 },
  center: { textAlign: 'center' },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: colors.muted },
  field: { minHeight: 44, justifyContent: 'center' },
  input: {
    minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}),
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontSize: 14, lineHeight: 18 },
  rowDetail: { color: colors.muted, lineHeight: 14 },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { flex: 1, minHeight: 40, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'transparent', paddingHorizontal: 4 },
  fitTab: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  fitLabel: { fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
  pin: { alignItems: 'center', gap: 12, paddingTop: 8 },
  dots: { flexDirection: 'row', gap: 14, marginTop: 8 },
  dot: { width: 12, height: 12, borderWidth: 1, transform: [{ rotate: '45deg' }] },
  errorSlot: { minHeight: 40, justifyContent: 'center' },
  keypad: { width: 252, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  key: { width: 76, height: 56, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 20, lineHeight: 26 },
});
