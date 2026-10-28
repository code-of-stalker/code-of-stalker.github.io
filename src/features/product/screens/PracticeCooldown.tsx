import { BlurTargetView, BlurView } from 'expo-blur';
import { useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import material from '../../../../assets/product/motion/laboratory-glass.json';
import { stepDescriptions } from '../content';
import { ObservationActionButton, ObservationIcon } from '../ObservationControls';
import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { isLightTheme, neutralColors, violetColors } from '../theme';
import { ProductIconButton, ProductText } from '../ui';
import { useStepPanelSpacing } from '../layout';
import { Art } from '../motion/Art';
import { useEffectQualityLevel } from '../motion/EffectsQuality';
import { Reveal } from '../motion/Reveal';
import { ScrollGate } from '../motion/ScrollGate';
import { StepPanel } from '../motion/StepPanel';

function openingTime(deadline: number, now: number) {
  const date = new Date(deadline), today = new Date(now), tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sameDay = (other: Date) => date.getFullYear() === other.getFullYear() && date.getMonth() === other.getMonth() && date.getDate() === other.getDate();
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = sameDay(today) ? 'СЕГОДНЯ' : sameDay(tomorrow) ? 'ЗАВТРА' : `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
  return `${day} В ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A single live illustration and the unavailable copy sit behind the blur.
 * Navigation, timer and diary action belong to the sharp foreground. */
export function PracticeCooldown({ title, time, deadline, now, heroHeight, heroWidth, gutter, inset, expanded, menu, menuContentHeight, reducedMotion, active,
  onBack, onClose, onSelect, onDiary, onRetreat, onReady, onProgress }: {
  title: string; time: string; deadline: number; now: number; heroHeight: number; heroWidth?: number; gutter: number; inset: number;
  expanded: boolean; menu?: ReactNode; menuContentHeight?: number; reducedMotion: boolean; active: boolean;
  onBack(): void; onClose(): void; onSelect(): void; onDiary(): void;
  onRetreat(): void; onReady(ready: boolean): void; onProgress(value: number): void;
}) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  const blurTarget = useRef<View | null>(null);
  const quality = useEffectQualityLevel();
  const { gap: panelGap } = useStepPanelSpacing();
  const [availableHeight, setAvailableHeight] = useState(0), [navigationHeight, setNavigationHeight] = useState(60);
  const [contentHeight, setContentHeight] = useState(300), [panelHeaderHeight, setPanelHeaderHeight] = useState(36), [footerHeight, setFooterHeight] = useState(66);
  const compact = availableHeight > 0 && availableHeight < 600;
  const panelNeeded = panelHeaderHeight + panelGap + contentHeight + inset * 2 + 16 + 24 + footerHeight;
  // Keep the illustration's full size behind the foreground; move only the panel.
  const foregroundHeroHeight = availableHeight ? Math.min(heroHeight, Math.max(navigationHeight + 12, availableHeight - gutter - panelNeeded)) : heroHeight;
  // Composite the fades after blur, so neither blur nor saturation recolors the edge.
  const heroFade = useMemo(() => ({ uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><defs><linearGradient id="v" x2="0" y2="1"><stop stop-color="${colors.background}"/><stop offset=".12" stop-color="${colors.background}" stop-opacity="0"/><stop offset=".72" stop-color="${colors.background}" stop-opacity="0"/><stop offset="1" stop-color="${colors.background}"/></linearGradient><linearGradient id="h"><stop stop-color="${colors.background}"/><stop offset=".08" stop-color="${colors.background}" stop-opacity="0"/><stop offset=".92" stop-color="${colors.background}" stop-opacity="0"/><stop offset="1" stop-color="${colors.background}"/></linearGradient></defs><rect width="1000" height="1000" fill="url(#v)"/><rect width="1000" height="1000" fill="url(#h)"/></svg>`)}` }), [colors.background]);
  return <View testID="practice-cooldown" onLayout={event => setAvailableHeight(event.nativeEvent.layout.height)} style={styles.root}>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {/* Filter the known background directly on web: WebKit can omit the
          composited Rust canvas from a sibling backdrop-filter's snapshot. */}
      <BlurTargetView testID="cooldown-blurred-content" ref={blurTarget} style={[StyleSheet.absoluteFill, { overflow: 'hidden' },
        Platform.OS === 'web' && { filter: `saturate(${colors === neutralColors || colors === violetColors ? 100 : 180}%) blur(${material.backgroundBlur}px)` } as ViewStyle]}>
        <Art kind="gallery" width={heroWidth} height={heroHeight} style={{ alignSelf: 'center' }} active={active && !expanded} reducedMotion={reducedMotion} />
        <View style={[styles.unavailableCopy, { padding: inset, marginTop: gutter }]}>
          <ProductText style={styles.previewText}>{stepDescriptions[2]}</ProductText>
        </View>
      </BlurTargetView>
      {Platform.OS === 'web' ? <View testID="cooldown-backdrop-blur" style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.background}3b` }]} /> :
      <BlurView testID="cooldown-backdrop-blur" blurTarget={blurTarget} intensity={material.backgroundBlur * 5}
        tint={isLightTheme(colors) ? 'light' : 'dark'}
        blurMethod={quality === 'economy' ? 'dimezisBlurViewSdk31Plus' : 'dimezisBlurView'}
        style={StyleSheet.absoluteFill} />}
      <Image testID="cooldown-hero-fade" pointerEvents="none" source={heroFade} contentFit="fill" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: heroHeight }} />
    </View>
    <View style={{ height: foregroundHeroHeight, zIndex: 1 }}>
      <View onLayout={event => setNavigationHeight(event.nativeEvent.layout.height)}>
      <Reveal reducedMotion={reducedMotion} style={styles.header}>
        <ProductIconButton icon="back" onPress={onBack} />
        <ProductText variant="title" style={styles.heading}>{'АРХИТЕКТУРА\nНАБЛЮДЕНИЯ'}</ProductText>
        <ProductIconButton icon="close" onPress={onClose} />
      </Reveal>
      </View>
    </View>
    <Reveal delay={100} reducedMotion={reducedMotion} style={[styles.observationTime, { height: gutter }]}>
      <ObservationIcon name="lock" size={12} muted />
      <ProductText variant="label" style={styles.observationLabel}>ВРЕМЯ ДЛЯ НАБЛЮДЕНИЯ</ProductText>
    </Reveal>
    <Reveal delay={160} reducedMotion={reducedMotion} style={styles.panelSpace}>
      <StepPanel title={title} background="clear" reducedMotion={reducedMotion} expanded={expanded}
        onSelect={onSelect} blurTarget={blurTarget} contentInset={inset} menu={menu} menuContentHeight={menuContentHeight} onHeaderHeight={setPanelHeaderHeight}>
        <ScrollGate enabled={active && !expanded} allowAdvance={false} onReady={onReady} onProgress={onProgress} onAdvance={() => {}} onRetreat={onRetreat} fadeTop={24} fadeBottom={24}
          contentStyle={{ padding: inset, paddingTop: inset + 16 }}>
          <View onLayout={event => setContentHeight(event.nativeEvent.layout.height)}>
          <ProductText variant="title" style={[styles.timeTitle, compact && { marginBottom: 8 }]}>ДАЙ СЕБЕ ВРЕМЯ</ProductText>
          <ProductText style={[styles.copy, compact && { marginBottom: 12 }]}>{'МЕЖДУ ШАГАМИ — 24 ЧАСА\nПОБУДЬ С ПРОШЛЫМ НАБЛЮДЕНИЕМ'}</ProductText>
          <ProductText variant="label" style={styles.countdownLabel}>СЛЕДУЮЩИЙ ШАГ ЧЕРЕЗ</ProductText>
          <ProductText testID="cooldown-countdown" variant="title" style={styles.countdown}>{time}</ProductText>
          <ProductText testID="cooldown-opening-time" variant="label" style={styles.openingTime}>{openingTime(deadline, now)}</ProductText>
          </View>
        </ScrollGate>
        <View onLayout={event => setFooterHeight(event.nativeEvent.layout.height)} style={[styles.panelFooter, { padding: inset }]}>
          <ObservationActionButton label="ЗАПИСАТЬ НАБЛЮДЕНИЕ" icon="note" onPress={onDiary} />
        </View>
      </StepPanel>
    </Reveal>
  </View>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heading: { flex: 1, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  unavailableCopy: { opacity: .12 }, previewText: { fontSize: 12, lineHeight: 17, textTransform: 'uppercase' },
  observationTime: { position: 'relative', zIndex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  observationLabel: { fontSize: 8, lineHeight: 12, letterSpacing: 3.5, color: colors.muted },
  panelSpace: { position: 'relative', zIndex: 1, flex: 1, minHeight: 0 },
  timeTitle: { fontSize: 20, lineHeight: 28, marginBottom: 16 },
  copy: { fontSize: 10, lineHeight: 17, letterSpacing: 1, marginBottom: 24, color: colors.muted },
  countdownLabel: { fontSize: 8, lineHeight: 12, letterSpacing: 3.5, color: colors.muted },
  countdown: { fontSize: 40, lineHeight: 52 },
  openingTime: { fontSize: 8, lineHeight: 12, letterSpacing: 3.5, color: colors.muted },
  panelFooter: { flexShrink: 0 },
});
