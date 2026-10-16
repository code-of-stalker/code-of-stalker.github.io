import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../ProductTheme';
import { ProductText } from '../ui';
import { DiaryIcon } from './DiaryIcons';
import { diaryDay } from './feed';

const months = ['ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ', 'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'];
const weekdays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

/** Local calendar dates stay local; UTC conversion can shift a selected day. */
export function DiaryDatePicker({ value, from, to, initialDate, minimum = '', onSelect }: {
  value: string; from: string; to: string; initialDate: string; minimum?: string; onSelect(day: string): void;
}) {
  const colors = useThemeColors();
  const [today] = useState(() => diaryDay(Date.now()));
  const [month, setMonth] = useState(() => {
    const date = initialDate ? new Date(`${initialDate}T12:00:00`) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
  });
  const year = month.getFullYear(), index = month.getMonth();
  const offset = (month.getDay() + 6) % 7, count = new Date(year, index + 1, 0, 12).getDate();
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => i - offset + 1);
  const shift = (amount: number) => setMonth(new Date(year, index + amount, 1, 12));
  return <View testID="diary-date-picker" style={styles.root}>
    <View style={styles.monthRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Предыдущий месяц" onPress={() => shift(-1)} style={styles.monthButton}><View style={styles.back}><DiaryIcon name="send" size={18} /></View></Pressable>
      <ProductText accessibilityLiveRegion="polite" style={styles.month}>{months[index]} {year}</ProductText>
      <Pressable accessibilityRole="button" accessibilityLabel="Следующий месяц" onPress={() => shift(1)} style={styles.monthButton}><DiaryIcon name="send" size={18} /></Pressable>
    </View>
    <View style={styles.week}>{weekdays.map(day => <ProductText key={day} style={[styles.weekday, { color: colors.muted }]}>{day}</ProductText>)}</View>
    {Array.from({ length: cells.length / 7 }, (_, row) => <View key={row} style={styles.week}>
      {cells.slice(row * 7, row * 7 + 7).map(day => {
        if (day < 1 || day > count) return <View key={day} style={styles.day} />;
        const date = diaryDay(new Date(year, index, day, 12).getTime()), selected = date === value, disabled = !!minimum && date < minimum;
        const inRange = !!from && !!to && date >= from && date <= to;
        return <Pressable key={day} accessibilityRole="button" accessibilityLabel={date.split('-').reverse().join('.')} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => onSelect(date)} style={[styles.day, (selected || inRange) && { backgroundColor: selected ? colors.accent : colors.subtle }, disabled && styles.disabled]}>
          <ProductText style={[styles.dayNumber, { color: selected ? colors.onAccent : colors.text }]}>{day}</ProductText>
          {date === today && <View style={[styles.today, { backgroundColor: selected ? colors.onAccent : colors.accent }]} />}
        </Pressable>;
      })}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  root: { gap: 4 }, monthRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, month: { flex: 1, textAlign: 'center', fontSize: 10, lineHeight: 20 },
  monthButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, back: { transform: [{ rotate: '180deg' }] },
  week: { flexDirection: 'row' }, weekday: { flex: 1, textAlign: 'center', fontSize: 8, lineHeight: 20 },
  day: { flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, dayNumber: { fontSize: 10, lineHeight: 20 },
  disabled: { opacity: .3 }, today: { position: 'absolute', bottom: 4, width: 3, height: 3, borderRadius: 2 },
});
