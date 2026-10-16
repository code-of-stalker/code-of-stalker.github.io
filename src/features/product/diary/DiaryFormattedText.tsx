import { ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';
import { fonts } from '../theme';
import type { DiaryText } from '../state/model';
import { diaryTextColors } from './text-colors';

export function DiaryFormattedText({ entry }: { entry: DiaryText }) {
  const colors = diaryTextColors(useThemeColors());
  return <ProductText selectable style={{ fontSize: 12, lineHeight: 20, marginTop: 3 }}>
    {entry.format?.length ? entry.format.map((run, index) => <ProductText key={index} maxFontSize={run.style.size} style={{ fontSize: run.style.size ?? 12, lineHeight: Math.ceil((run.style.size ?? 12) * 1.6), color: colors[run.style.color ?? 'text'],
      fontFamily: run.style.bold ? fonts.bodyBold : fonts.body, fontStyle: run.style.italic ? 'italic' : 'normal', textDecorationLine: run.style.underline ? 'underline' : 'none' }}>{run.text}</ProductText>) : entry.text}
  </ProductText>;
}
