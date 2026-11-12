import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { ProductText } from '../ui';
import { DiaryDesignAction, DiaryDesignPanel } from './DiaryDesignPanel';

/** The daily dynamics report: one wording for the diary and the Intensive chat with the guide. */
export const diaryReport = {
  kind: 'ОТЧЁТ О ДИНАМИКЕ',
  draft: 'ОТЧЁТ О ДИНАМИКЕ · ЧТО ИЗМЕНИЛОСЬ ЗА ДЕНЬ?',
  promptLabel: 'Добавить отчёт о динамике',
  promptTitle: 'Что ощутили сегодня?',
  promptHint: 'ДОБАВИТЬ ОТЧЁТ ДИНАМИКИ',
  moreHint: 'ДОПОЛНИТЬ ОТЧЁТ О ДИНАМИКЕ',
  guide: 'ЗАМЕТЬ КАК МЕНЯЮТСЯ ТВОИ ОЩУЩЕНИЯ. КАЖДЫЙ ДЕНЬ СТАРАЙСЯ ОТМЕЧАТЬ ДИНАМИКУ НАБЛЮДЕНИЯ.\n\n-КАКИЕ ПАТТЕРНЫ ПОВТОРЯЮТСЯ?\n-КАК ПРОВОЦИРУЕТ ЛИЧНОСТЬ?\n-ГДЕ ПРОИСХОДИТ ЗАЛИПАНИЕ В ПЕРСОНАЖ?',
  write: 'ЗАПИСАТЬ ОТЧЁТ',
  view: 'ПОСМОТРЕТЬ ОТЧЁТЫ',
} as const;

/** The sheet the report plate opens: what to notice, then write a report or read the earlier ones. */
export function DiaryReportGuide({ onWrite, onView }: { onWrite(): void; onView(): void }) {
  const { width, height } = useWindowDimensions();
  return <DiaryDesignPanel title={diaryReport.kind} height={Math.min(height * .78, width >= 375 ? 416 : 317)}>
    <ProductText style={styles.copy}>{diaryReport.guide}</ProductText>
    <View style={styles.actions}>
      <DiaryDesignAction label={diaryReport.write} onPress={onWrite} />
      <DiaryDesignAction ghost label={diaryReport.view} onPress={onView} />
    </View>
  </DiaryDesignPanel>;
}

const styles = StyleSheet.create({
  copy: { fontSize: 12, lineHeight: 16.8, textTransform: 'uppercase' },
  actions: { gap: 12 },
});
