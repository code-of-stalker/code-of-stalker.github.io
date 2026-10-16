import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ProductButton, ProductIconButton, ProductScreen, ProductText } from '../ui';
import { TaskStepSelector } from '../motion/TaskStepSelector';
import { ScrollGate } from '../motion/ScrollGate';
import { ScrollCue } from '../motion/ScrollCue';
import { useProductSpacing } from '../layout';
import { useBackSwipe } from '../navigation/BackSwipeProvider';
import type { PracticeIntroScreenProps } from './PracticeIntroScreen';

export function StepThreePlaceholder({ onSelectStep, onPreviousStep, onClose, onDiary, availableAt, testUnlockAll, reducedMotion = false }: PracticeIntroScreenProps) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false), [progress, setProgress] = useState(0);
  const { gutter, inset } = useProductSpacing(), { height } = useWindowDimensions();
  const back = () => { if (open) setOpen(false); else onPreviousStep(); };
  useBackSwipe(back);
  return <ProductScreen scroll={false} contentStyle={{ padding: gutter }}>
    <View style={styles.header}><ProductIconButton icon="back" onPress={back} /><ProductText variant="title">АРХИТЕКТУРА</ProductText><ProductIconButton icon="close" onPress={onClose} /></View>
    <ScrollGate fill enabled={!open} allowAdvance={false} guardEntryGesture onAdvance={() => {}} onRetreat={back}
      onReady={setReady} onProgress={setProgress} fadeTop={16} fadeBottom={12} contentStyle={styles.body}>
    <View testID="step-three-placeholder" style={styles.copyGroup}>
      <ProductText variant="label" style={styles.number}>ШАГ 3</ProductText>
      <ProductText variant="title" style={styles.title}>ГОЛОС КАК МОСТ</ProductText>
      <ProductText style={styles.copy}>Этот шаг готовится.{"\n\n"}Пока можно вернуться к наблюдениям и дополнить свой дневник.</ProductText>
      <ProductButton label="ОТКРЫТЬ ДНЕВНИК" kind="outline" onPress={onDiary} />
    </View>
    </ScrollGate>
    <TaskStepSelector step={3} availableAt={availableAt} testUnlockAll={testUnlockAll} open={open} onToggle={() => setOpen(value => !value)} onSelect={value => { setOpen(false); onSelectStep(value); }} reducedMotion={reducedMotion} inset={inset} maxHeight={height - 120}
      trailing={<ScrollCue visible={!open && ready && progress < 0} progress={progress} reducedMotion={reducedMotion} label="ПРОКРУТИ К ШАГУ 2" style={{ left: 0, right: 0, bottom: 5 }} />} />
  </ProductScreen>;
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  body: { flexGrow: 1, justifyContent: 'center', paddingVertical: 28 }, copyGroup: { gap: 24 },
  number: { letterSpacing: 3 }, title: { fontSize: 28, lineHeight: 36 },
  copy: { fontSize: 16, lineHeight: 25, textTransform: 'uppercase' },
});
