import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';

import { Reveal } from '../motion/Reveal';
import { HomeCard, HomeCardCopy } from '../motion/HomeCard';
import { Marquee } from '../motion/Marquee';
import { MatrixBackdrop } from '../motion/MatrixBackdrop';
import { useProductSpacing } from '../layout';
import { ProductIconButton, ProductScreen, ProductText } from '../ui';

export type HomeScreenProps = {
  started: boolean;
  levelLabel: string;
  step: number;
  stepLabel: string;
  reducedMotion?: boolean;
  onArchitecture: () => void;
  onDiary: () => void;
  onSettings: () => void;
};

const arrow = require('../../../../assets/product/home-arrow.svg');

export function HomeScreen({
  started,
  levelLabel,
  step,
  stepLabel,
  reducedMotion,
  onArchitecture,
  onDiary,
  onSettings,
}: HomeScreenProps) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  const { gutter, inset } = useProductSpacing();
  return (
    <ProductScreen scroll={false} background={<MatrixBackdrop active={focused && foreground} reducedMotion={!!reducedMotion} />}>
      <Reveal reducedMotion={reducedMotion} style={styles.header}>
        <View style={styles.brand}>
          <ProductText variant="title" style={styles.brandTitle}>КОД СТАЛКЕРА</ProductText>
          <ProductText variant="label" style={styles.brandSubtitle}>ПРОСТРАНСТВО СЕБЯ</ProductText>
        </View>
        <ProductIconButton icon="settings" onPress={onSettings} />
      </Reveal>

      <View style={[styles.cards, { gap: gutter, marginTop: gutter }]}>
        <Reveal delay={100} reducedMotion={reducedMotion} style={styles.cardSlot}>
          <View style={styles.cardSlot}><HomeCard artwork={{ kind: started ? step === 2 ? 'book' : 'cells' : 'distance', reducedMotion, onPress: onArchitecture,
            accessibilityLabel: started ? `Архитектура наблюдения. ${levelLabel}, ${stepLabel}. Продолжить` : 'Архитектура наблюдения. Выбрать уровень' }}>
            <View pointerEvents="none" style={[styles.numberPosition, { top: inset, left: inset }]}><ProductText variant="label" style={styles.number}>01 /</ProductText></View>
            <HomeCardCopy inset={inset} gradient="architecture">
              <ProductText variant="title" style={styles.cardTitle}>{'АРХИТЕКТУРА\nНАБЛЮДЕНИЯ'}</ProductText>
              <ProductText variant="label" style={styles.cardCaption}>
                {started ? `${levelLabel} · ${stepLabel}` : 'ВЫСТАВЬ ДИСТАНЦИЮ'}
              </ProductText>
            </HomeCardCopy>
            <View pointerEvents="none" style={styles.arrow}><Image source={arrow} tintColor={colors.iconTint} style={styles.arrowImage} contentFit="contain" /></View>
          </HomeCard></View>
        </Reveal>

        <Reveal delay={220} reducedMotion={reducedMotion} style={styles.cardSlot}>
          <HomeCard artwork={{ kind: 'diary', reducedMotion, onPress: onDiary, accessibilityLabel: 'Дневник сталкера' }}>
            <View pointerEvents="none" style={[styles.numberPosition, { top: inset, left: inset }]}><ProductText variant="label" style={styles.number}>02 /</ProductText></View>
            <HomeCardCopy inset={inset} gradient="diary">
              <ProductText variant="title" style={styles.cardTitle}>{'ДНЕВНИК\nСТАЛКЕРА'}</ProductText>
              <ProductText variant="label" style={styles.cardCaption}>СОХРАНИ НАБЛЮДЕНИЯ</ProductText>
            </HomeCardCopy>
            <View pointerEvents="none" style={styles.arrow}><Image source={arrow} tintColor={colors.iconTint} style={styles.arrowImage} contentFit="contain" /></View>
          </HomeCard>
        </Reveal>
      </View>

      <View style={[styles.mottoContainer, { marginTop: gutter + 8, marginHorizontal: -gutter }]}>
        <Marquee text="НЕТ ПРАВИЛЬНЫХ ОТВЕТОВ, ЕСТЬ ТОЛЬКО ТВОЁ НАБЛЮДЕНИЕ" active={focused && foreground}
          reducedMotion={!!reducedMotion} style={{ marginTop: 0, marginBottom: 0 }} textStyle={styles.motto} />
      </View>
    </ProductScreen>
  );
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 52 },
  brand: { flex: 1, paddingRight: 6 },
  brandTitle: { fontSize: 24, lineHeight: 34, letterSpacing: 2.4 },
  brandSubtitle: { marginTop: 8, fontSize: 8, lineHeight: 10, letterSpacing: 4.96, color: colors.muted },
  cards: { flex: 1, minHeight: 320 },
  cardSlot: { flex: 1, minHeight: 0 },
  numberPosition: { position: 'absolute', top: 12, left: 12, zIndex: 2 },
  number: { fontSize: 8, letterSpacing: 3.52, color: colors.faint },
  cardTitle: { fontSize: 20, lineHeight: 28, letterSpacing: 2.4 },
  cardCaption: { fontSize: 8, lineHeight: 10, color: colors.muted },
  arrow: { position: 'absolute', bottom: 16, right: 16, width: 16, height: 16, zIndex: 2 },
  arrowImage: { width: 16, height: 16 },
  mottoContainer: { marginTop: 24, minHeight: 24, justifyContent: 'center' },
  motto: { color: colors.muted, fontSize: 8, lineHeight: 16, letterSpacing: 2.1, textAlign: 'center' },
});
