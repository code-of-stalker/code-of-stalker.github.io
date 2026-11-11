import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import { useProductLayout } from '../../product/layout';
import type { ProductColors } from '../../product/theme';
import { ProductIconButton, ProductText } from '../../product/ui';
import { BackendError } from '../backend';
import type { Place } from '../backend';
import { Glyph, Hero, useContour } from './chrome';
import { SlideMark } from '../../product/motion/SlideMark';
import { Breathe } from '../../product/motion/Breathe';

export const placeLabels: Record<Place, string> = {
  walker: 'ИДУЩИЙ', guide: 'ПРОВОДНИК', admin: 'АДМИН ПРОВОДНИКА', main: 'ГЛАВНЫЙ АДМИН',
};

const FormalContext = createContext(false);
/** The admin page speaks to the main admin with «Вы»; the rest of the Intensive keeps «ты». */
export const FormalTone = FormalContext.Provider;
export const useFormal = () => useContext(FormalContext);

/** A plain Russian sentence for any failure; details stay in the console. */
export function problemText(problem: unknown, fallback?: string, formal = false) {
  const offline = formal ? 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.' : 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.';
  if (problem instanceof BackendError) {
    if (problem.code === 'network') return offline;
    if (problem.code === 'rate-limit') return formal ? 'Слишком много попыток. Подождите несколько минут.' : 'Слишком много попыток. Подожди несколько минут.';
    if (problem.code === 'denied') return formal ? 'Нет доступа. Возможно, права изменились: войдите заново.' : 'Нет доступа. Возможно, права изменились: войди заново.';
  }
  if (problem instanceof Error && /Failed to fetch|NetworkError|Load failed/i.test(problem.message)) return offline;
  console.warn('[intensive]', problem);
  return fallback ?? (formal ? 'Что-то пошло не так. Попробуйте ещё раз.' : 'Что-то пошло не так. Попробуй ещё раз.');
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

export function Note({ children, tone = 'muted', style, center = false }: { children: ReactNode; tone?: 'muted' | 'error' | 'text'; style?: StyleProp<ViewStyle>; center?: boolean }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return <View style={style}><ProductText accessibilityRole={tone === 'error' ? 'alert' : undefined}
    style={[styles.note, center && styles.center, { color: tone === 'error' ? colors.error : tone === 'text' ? colors.text : colors.muted }]}>{children}</ProductText></View>;
}

/** A loading line: it appears after a short wait and breathes softly until the content comes. */
export function Loading({ children, center = false, style }: { children: ReactNode; center?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Breathe style={style}><Note center={center}>{children}</Note></Breathe>;
}

/** `fit` sizes each tab to its label, so longer labels with counts still fit on a phone. */
export function Tabs<T extends string>({ value, options, onChange, fit = false }: { value: T; options: { id: T; label: string }[]; onChange: (id: T) => void; fit?: boolean }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const [spots, setSpots] = useState<Partial<Record<string, { x: number; width: number }>>>({});
  const spot = spots[value];
  // One underline slides and stretches to the chosen tab (Rust, SlideMark).
  return <View accessibilityRole="tablist" style={styles.tabs}>
    {options.map(option => {
      const on = option.id === value;
      return <Pressable key={option.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(option.id)}
        onLayout={event => { const { x, width } = event.nativeEvent.layout; setSpots(old => old[option.id]?.x === x && old[option.id]?.width === width ? old : { ...old, [option.id]: { x, width } }); }}
        style={[styles.tab, fit && styles.fitTab, on && !spot && { borderBottomColor: colors.accent }]}>
        <ProductText variant="label" numberOfLines={1} style={[{ color: on ? colors.text : colors.muted, textAlign: 'center' }, fit && styles.fitLabel]}>{option.label}</ProductText>
      </Pressable>;
    })}
    {spot ? <SlideMark x={spot.x} width={spot.width} color={colors.accent} /> : null}
  </View>;
}

const KEY = { width: 80, height: 60 };

function PinKey({ label, digit, onPress, disabled }: { label: string; digit: string; onPress: () => void; disabled: boolean }) {
  const styles = useThemeStyles(createStyles);
  const plain = useContour(KEY.width, KEY.height, 'plain'), pressed = useContour(KEY.width, KEY.height, 'pressed');
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={styles.key}>
    {({ pressed: down }) => <>
      <Image pointerEvents="none" source={down ? pressed : plain} style={StyleSheet.absoluteFill} contentFit="contain" />
      <ProductText variant="title" style={styles.keyText}>{digit}</ProductText>
    </>}
  </Pressable>;
}

/** Six marks and a keypad, as on a phone lock screen; digits typed on a keyboard work too. */
export function PinPad({ title, detail, busy = false, error, onComplete }: {
  title: string; detail?: string; busy?: boolean; error?: string; onComplete: (pin: string) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const [digits, setDigits] = useState('');
  // Keys arrive faster than renders: the typed digits and the latest props live in refs.
  const typed = useRef('');
  const latest = useRef({ busy, onComplete });
  useLayoutEffect(() => { latest.current = { busy, onComplete }; });
  const press = useCallback((key: string) => {
    if (latest.current.busy) return;
    const current = typed.current;
    const next = key === 'back' ? current.slice(0, -1) : current.length < 6 ? current + key : current;
    typed.current = next.length === 6 ? '' : next;
    setDigits(typed.current);
    if (next.length === 6) latest.current.onComplete(next);
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('back');
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [press]);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];
  return <View style={styles.pin}>
    <Hero glyph="lock" title={title} lines={detail ? [detail] : []} tight />
    <View accessibilityLabel={`Введено цифр: ${digits.length} из 6`} style={styles.dots}>
      {Array.from({ length: 6 }, (_, i) => <View key={i} style={[styles.dot, { borderColor: error ? colors.error : colors.accent }, (i < digits.length || busy) && { backgroundColor: colors.accent }]} />)}
    </View>
    <View style={styles.errorSlot}>{error ? <Note center tone="error">{error}</Note> : busy ? <Note center>Проверяю…</Note> : null}</View>
    <View style={styles.keypad}>
      {keys.map((key, i) => key === '' ? <View key={i} style={styles.key} />
        : key === 'back' ? <Pressable key={i} accessibilityRole="button" accessibilityLabel="Стереть" onPress={() => press('back')} disabled={busy}
          style={({ pressed }) => [styles.key, pressed && { opacity: .6 }]}>
          <Glyph name="erase" size={28} color={colors.muted} />
        </Pressable>
          : <PinKey key={i} label={key} digit={key} onPress={() => press(key)} disabled={busy} />)}
    </View>
  </View>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  heading: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3 },
  title: { fontSize: 20, lineHeight: 28 },
  subtitle: { fontSize: 8, lineHeight: 12, letterSpacing: 4.96, color: colors.muted },
  note: { lineHeight: 18 },
  center: { textAlign: 'center' },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { flex: 1, minHeight: 40, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'transparent', paddingHorizontal: 4 },
  fitTab: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  fitLabel: { fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
  pin: { alignItems: 'center', gap: 14, paddingTop: 4 },
  dots: { flexDirection: 'row', gap: 18, marginTop: 10 },
  dot: { width: 11, height: 11, borderWidth: .75, transform: [{ rotate: '45deg' }] },
  errorSlot: { minHeight: 40, justifyContent: 'center', maxWidth: 320 },
  keypad: { width: KEY.width * 3 + 28, flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  key: { width: KEY.width, height: KEY.height, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 24, lineHeight: 30, fontWeight: '500' },
});
