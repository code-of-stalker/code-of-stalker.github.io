import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from 'expo-router';

import { Reveal } from '../motion/Reveal';
import { HomeCard, HomeCardCopy } from '../motion/HomeCard';
import { Marquee } from '../motion/Marquee';
import { MatrixBackdrop } from '../motion/MatrixBackdrop';
import { useProductLayout, useProductSpacing } from '../layout';
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
  const { gutter, inset } = useProductSpacing(), { kind, columns, wide, air } = useProductLayout();
  // The motto runs from window edge to window edge, past the centered content.
  const { width: windowWidth } = useWindowDimensions(), outside = gutter + Math.max(0, windowWidth - wide) / 2;
  // Tablet and desktop cards are two to three times the phone's; their type grows one step.
  const large = kind !== 'phone';
  // Side by side, each card is wide enough to carry its name on one line.
  const oneLine = columns === 2, titleStyle = [styles.cardTitle, large && styles.cardTitleLarge];
  const arrowImage = <Image source={arrow} tintColor={colors.iconTint} style={large ? styles.arrowLarge : styles.arrowImage} contentFit="contain" />;
  return (
    <ProductScreen scroll={false} layout="wide" background={<MatrixBackdrop active={focused && foreground} reducedMotion={!!reducedMotion} />}>
      <Reveal reducedMotion={reducedMotion} style={styles.header}>
        <View style={styles.brand}>
          <ProductText variant="title" style={[styles.brandTitle, large && styles.brandTitleLarge]}>КОД СТАЛКЕРА</ProductText>
          <ProductText variant="label" style={styles.brandSubtitle}>ПРОСТРАНСТВО СЕБЯ</ProductText>
        </View>
        <ProductIconButton icon="settings" onPress={onSettings} />
      </Reveal>

      {/* Landscape tablets and desktops place the two cards side by side. */}
      <View style={[styles.cards, { gap: gutter, marginTop: gutter * air }, columns === 2 && styles.cardRow]}>
        <Reveal delay={100} reducedMotion={reducedMotion} style={styles.cardSlot}>
          <View style={styles.cardSlot}><HomeCard artwork={{ kind: started ? step >= 4 ? 'grounding-here' : step === 3 ? 'thought-loop' : step === 2 ? 'book' : 'cells' : 'distance',
            webScene: started && step >= 5 ? 'sphere-hero' : started && step >= 4 ? 'simple-practice' : undefined, reducedMotion, onPress: onArchitecture,
            accessibilityLabel: started ? `Архитектура наблюдения. ${levelLabel}, ${stepLabel}. Продолжить` : 'Архитектура наблюдения. Выбрать уровень' }}>
            <View pointerEvents="none" style={[styles.numberPosition, { top: inset, left: inset }]}><ProductText variant="label" style={styles.number}>01 /</ProductText></View>
            <HomeCardCopy inset={inset} gradient="architecture" style={large && styles.copyLarge}>
              <ProductText variant="title" fitToWidth={oneLine} minFontSize={20} style={titleStyle}>{oneLine ? 'АРХИТЕКТУРА НАБЛЮДЕНИЯ' : 'АРХИТЕКТУРА\nНАБЛЮДЕНИЯ'}</ProductText>
              <ProductText variant="label" style={styles.cardCaption}>
                {started ? `${levelLabel} · ${stepLabel}` : 'ВЫСТАВЬ ДИСТАНЦИЮ'}
              </ProductText>
            </HomeCardCopy>
            <View pointerEvents="none" style={[styles.arrow, large && styles.arrowLarge]}>{arrowImage}</View>
          </HomeCard></View>
        </Reveal>

        <Reveal delay={220} reducedMotion={reducedMotion} style={styles.cardSlot}>
          <HomeCard artwork={{ kind: 'diary', reducedMotion, onPress: onDiary, accessibilityLabel: 'Дневник сталкера' }}>
            <View pointerEvents="none" style={[styles.numberPosition, { top: inset, left: inset }]}><ProductText variant="label" style={styles.number}>02 /</ProductText></View>
            <HomeCardCopy inset={inset} gradient="diary" style={large && styles.copyLarge}>
              <ProductText variant="title" fitToWidth={oneLine} minFontSize={20} style={titleStyle}>{oneLine ? 'ДНЕВНИК СТАЛКЕРА' : 'ДНЕВНИК\nСТАЛКЕРА'}</ProductText>
              <ProductText variant="label" style={styles.cardCaption}>СОХРАНИ НАБЛЮДЕНИЯ</ProductText>
            </HomeCardCopy>
            <View pointerEvents="none" style={[styles.arrow, large && styles.arrowLarge]}>{arrowImage}</View>
          </HomeCard>
        </Reveal>
      </View>

      <View style={[styles.mottoContainer, { marginTop: (gutter + 8) * air, marginHorizontal: -outside }]}>
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
  brandTitleLarge: { fontSize: 36, lineHeight: 46, letterSpacing: 3.6 },
  brandSubtitle: { marginTop: 8, fontSize: 8, lineHeight: 10, letterSpacing: 4.96, color: colors.muted },
  cards: { flex: 1, minHeight: 320 },
  cardRow: { flexDirection: 'row' },
  cardSlot: { flex: 1, minHeight: 0, minWidth: 0 },
  numberPosition: { position: 'absolute', top: 12, left: 12, zIndex: 2 },
  number: { fontSize: 8, letterSpacing: 3.52, color: colors.faint },
  cardTitle: { fontSize: 20, lineHeight: 28, letterSpacing: 2.4 },
  cardTitleLarge: { fontSize: 28, lineHeight: 36, letterSpacing: 3 },
  cardCaption: { fontSize: 8, lineHeight: 10, color: colors.muted },
  arrow: { position: 'absolute', bottom: 16, right: 16, width: 16, height: 16, zIndex: 2 },
  arrowImage: { width: 16, height: 16 },
  arrowLarge: { width: 22, height: 22 },
  copyLarge: { right: 40 },
  mottoContainer: { marginTop: 24, minHeight: 24, justifyContent: 'center' },
  motto: { color: colors.muted, fontSize: 8, lineHeight: 16, letterSpacing: 2.1, textAlign: 'center' },
});
