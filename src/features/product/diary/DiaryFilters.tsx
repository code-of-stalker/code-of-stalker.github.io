import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { productLevels } from '../content';
import { ProductButton, ProductText } from '../ui';
import { DiaryGlass } from './DiaryGlass';
import { PanelBorder } from '../PanelBorder';
import { useThemeColors } from '../ProductTheme';
import { DiaryDatePicker } from './DiaryDatePicker';
import { DiaryAsset, DiaryEntryIcon, DiaryIcon } from './DiaryIcons';
import { diaryDay, emptyDiaryFilter, type DiaryFilter } from './feed';

export function DiaryFilters({ value, onApply }: { value: DiaryFilter; onApply(filter: DiaryFilter): void }) {
  const colors = useThemeColors(), [draft, setDraft] = useState(value), [error, setError] = useState('');
  const format = (date: string) => date ? date.split('-').reverse().join('.') : '';
  const [from, setFrom] = useState(value.from), [to, setTo] = useState(value.to);
  const [activeDate, setActiveDate] = useState<'from' | 'to' | null>(null);
  function range(days: number | null) {
    setActiveDate(null); setError('');
    if (days === null) { setFrom(''); setTo(''); return; }
    const now = new Date(), start = new Date(now); start.setDate(now.getDate() - days + 1);
    setFrom(diaryDay(start.getTime())); setTo(diaryDay(now.getTime()));
  }
  function selectDate(date: string) {
    setError('');
    if (activeDate === 'from') { setFrom(date); if (to && to < date) setTo(''); setActiveDate('to'); }
    else { setTo(date); setActiveDate(null); }
  }
  function apply() {
    if (from && to && from > to) { setError('Начало периода должно быть раньше его окончания.'); return; }
    onApply({ ...draft, from, to });
  }
  function choice(label: string, selected: boolean, action: () => void) {
    return <Pressable key={label} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected }} onPress={action} style={[styles.choice, selected && { backgroundColor: colors.subtle }]}><DiaryGlass /><PanelBorder color={selected ? colors.accent : colors.border} /><ProductText style={styles.option}>{label}</ProductText></Pressable>;
  }
  return <View style={styles.root}>
    <View testID="diary-filter-dates-title" style={styles.heading}><DiaryAsset name="calendar" /><ProductText variant="title" style={styles.title}>ДАТЫ</ProductText></View>
    <View style={styles.wrap}>{[[null, 'ВСЕ ДАТЫ'], [1, 'СЕГОДНЯ'], [7, '7 ДНЕЙ'], [30, '30 ДНЕЙ']].map(([days, label]) => <Pressable key={label as string} accessibilityRole="button" onPress={() => range(days as number | null)} style={styles.choice}><DiaryGlass /><PanelBorder /><ProductText style={styles.option}>{label}</ProductText></Pressable>)}</View>
    <View style={styles.range}>{(['from', 'to'] as const).map((key, index) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={index ? 'Дата окончания' : 'Дата начала'} accessibilityState={{ expanded: activeDate === key }} onPress={() => { setActiveDate(activeDate === key ? null : key); setError(''); }} style={[styles.dateField, activeDate === key && { backgroundColor: colors.subtle }]}>
      <DiaryGlass /><PanelBorder color={activeDate === key ? colors.accent : colors.border} />
      <ProductText style={[styles.dateCaption, { color: colors.muted }]}>{index ? 'ПО ДАТУ' : 'С ДАТЫ'}</ProductText>
      <ProductText style={styles.dateValue}>{format(key === 'from' ? from : to) || 'ВЫБРАТЬ'}</ProductText>
    </Pressable>)}</View>
    {activeDate && <DiaryDatePicker key={activeDate} value={activeDate === 'from' ? from : to} from={from} to={to} initialDate={(activeDate === 'from' ? from : to) || from || to} minimum={activeDate === 'to' ? from : ''} onSelect={selectDate} />}
    <View testID="diary-filter-records-title" style={styles.heading}><DiaryEntryIcon kind="observation" /><ProductText variant="title" style={styles.title}>ЗАПИСИ</ProductText></View>
    <View accessibilityRole="radiogroup" accessibilityLabel="Тип записей" style={styles.wrap}>{([
      ['all', 'ВСЕ'], ['observation', 'НАБЛЮДЕНИЯ'], ['dynamics', 'ОТЧЁТЫ О ДИНАМИКЕ'], ['architecture', 'АРХИТЕКТУРА'],
    ] as const).map(([category, label]) => choice(label, draft.category === category, () => setDraft({ ...draft, category, level: 'all', step: 0 })))}</View>
    <View accessibilityRole="radiogroup" accessibilityLabel="Формат записи" style={styles.wrap}>{([['all', 'ТЕКСТ И ГОЛОС'], ['audio', 'ГОЛОС'], ['text', 'ТЕКСТ']] as const).map(([media, label]) => choice(label, draft.media === media, () => setDraft({ ...draft, media })))}</View>
    <View testID="diary-filter-level-title" style={styles.heading}><DiaryEntryIcon kind="architecture" /><ProductText variant="title" style={styles.title}>УРОВЕНЬ АРХИТЕКТУРЫ</ProductText></View>
    <View accessibilityRole="radiogroup" accessibilityLabel="Уровень архитектуры" style={styles.wrap}>
      {choice('ВСЕ УРОВНИ', draft.level === 'all', () => setDraft({ ...draft, level: 'all', step: 0 }))}
      {productLevels.map(level => choice(level.title, draft.level === level.id, () => setDraft({ ...draft, category: 'architecture', media: 'audio', level: level.id, step: 0 })))}
    </View>
    {(draft.level === 'basic' || draft.category === 'architecture' && draft.level === 'all') && <>
      <View style={styles.heading}><DiaryIcon name="stairs" size={16} /><ProductText variant="title" style={styles.title}>ШАГ БАЗОВОГО УРОВНЯ</ProductText></View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Шаг базового уровня" style={styles.wrap}>{[0,1,2,3,4,5,6,7].map(step => choice(step ? String(step) : 'ВСЕ ШАГИ', draft.step === step, () => setDraft({ ...draft, level: step ? 'basic' : draft.level, step })))}</View>
    </>}
    {!!error && <ProductText accessibilityRole="alert" style={styles.option}>{error}</ProductText>}
    <ProductButton label="ПОКАЗАТЬ ЗАПИСИ" onPress={apply} />
    <ProductButton label="СБРОСИТЬ ФИЛЬТРЫ" kind="ghost" onPress={() => onApply({ ...emptyDiaryFilter })} />
  </View>;
}
const styles = StyleSheet.create({ root: { gap: 14 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { fontSize: 14, lineHeight: 20 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 40, minWidth: 36, paddingHorizontal: 9, paddingVertical: 8, justifyContent: 'center' }, option: { fontSize: 8, lineHeight: 13 }, range: { flexDirection: 'row', gap: 8 }, dateField: { flex: 1, minWidth: 0, minHeight: 56, paddingHorizontal: 10, paddingVertical: 8, gap: 4 }, dateCaption: { fontSize: 8, lineHeight: 13 }, dateValue: { fontSize: 10, lineHeight: 16 } });
