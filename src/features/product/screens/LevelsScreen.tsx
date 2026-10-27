import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { AppState, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { MatrixBackdrop } from '../motion/MatrixBackdrop';
import { PanelScan } from '../motion/PanelScan';
import { Accordion } from '../motion/Accordion';
import { HeightMotion } from '../motion/HeightMotion';
import { LevelFrame } from '../motion/LevelFrame';
import { PanelArtwork } from '../motion/PanelArtwork';
import { useBackSwipe } from '../navigation/BackSwipeProvider';
import { levelActionArtwork } from '../levelArtwork';

import { productLevels } from '../content';
import type { LevelId } from '../content';
import { Art } from '../motion/Art';
import { useProductLayout, useProductSpacing } from '../layout';
import { ProductIconButton, ProductScreen, ProductText } from '../ui';
import type { ArtKind } from '../motion/types';

const arrow = require('../../../../assets/product/levels/arrow.svg');
// The approved double helix is called "parallel" in Laboratory; "guidance"
// is a separate junction illustration and must not replace the spiral here.
const levelScenes: Record<LevelId, ArtKind> = { basic: 'basic', intensive: 'intensive', guidance: 'parallel' };

export type LevelsScreenProps = {
  selectedLevel: LevelId | null;
  onSelect: (level: LevelId | null) => void;
  onStart: (level: LevelId) => void;
  onBack: () => void;
  onDiary: () => void;
  reducedMotion?: boolean;
  effectsActive?: boolean;
};

export function LevelsScreen({ selectedLevel, onSelect, onStart, onBack, onDiary, reducedMotion = false, effectsActive = true }: LevelsScreenProps) {
  const styles = useThemeStyles(createStyles);
  const colors = useThemeColors();
  const actions = useMemo(() => Object.fromEntries(productLevels.map(level => [level.id, levelActionArtwork(level.id, colors.accent)])) as Record<LevelId, {uri:string}>, [colors.accent]);
  const { width } = useWindowDimensions();
  useBackSwipe(onBack);
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  const { inset, gutter } = useProductSpacing(), { column, air } = useProductLayout();
  const contentWidth = Math.min(width, column) - gutter * 2;
  const artHeight = Math.max(150, contentWidth * 150 / 288);
  const bodyHeight = Math.max(202, artHeight + (width >= 375 ? 94 : 52));
  const fade = useMemo(() => ({ uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="288" height="48"><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${colors.background}" stop-opacity="0"/><stop offset=".44" stop-color="${colors.background}"/><stop offset="1" stop-color="${colors.background}"/></linearGradient></defs><rect width="288" height="48" fill="url(#fade)"/></svg>`)}` }), [colors.background]);

  return (
    <>
      <ProductScreen headerFillOnScroll background={<MatrixBackdrop active={focused && foreground && effectsActive} reducedMotion={reducedMotion} />} contentStyle={[styles.screen, { paddingHorizontal: gutter }]} headerStyle={{ paddingTop: 16, paddingHorizontal: gutter }} header={
        <View style={styles.header}>
          <ProductIconButton icon="back" onPress={onBack} />
          <ProductText variant="title" style={styles.heading}>{'АРХИТЕКТУРА\nНАБЛЮДЕНИЯ'}</ProductText>
          <ProductIconButton icon="notes" onPress={onDiary} />
        </View>}>

        <ProductText variant="label" style={[styles.choose, air > 1 && { marginTop: 24 * air, marginBottom: 16 * air }]}>ВЫБЕРИ УРОВЕНЬ</ProductText>
        <View style={[styles.levels, air > 1 && { gap: 24 * air }]}>
          {productLevels.map((level,index) => {
            const expanded = selectedLevel === level.id;
            return (
              <PanelScan key={level.id} delay={index*100} reducedMotion={reducedMotion} style={styles.level}>
                <LevelFrame level={level.id} expanded={expanded} width={contentWidth} />
                <HeightMotion height={expanded?(width>=375?58:52):62} reducedMotion={reducedMotion}><Pressable
                  accessibilityRole="button"
                  accessibilityLabel={level.title.replace('\n', ' ')}
                  accessibilityState={{ expanded }}
                  aria-expanded={expanded}
                  onPress={() => onSelect(expanded ? null : level.id)}
                  style={[styles.levelHeader, { paddingHorizontal: inset, flex:1 }]}
                >
                  <ProductText variant="label" numberOfLines={1} maxFontSize={13} style={styles.number}>{level.number}</ProductText>
                  <ProductText variant="title" numberOfLines={1} style={styles.levelTitle}>{level.title}</ProductText>
                  <View pointerEvents="none" style={styles.expandIcon}>
                    <View style={styles.expandHorizontal} />
                    {!expanded && <View style={styles.expandVertical} />}
                  </View>
                </Pressable></HeightMotion>
                <Accordion expanded={expanded} height={bodyHeight} reducedMotion={reducedMotion} overflowWhenOpen="visible">
                  <View style={[styles.levelBody, { height: bodyHeight, paddingHorizontal: inset, paddingBottom: inset }]}>
                    <View pointerEvents="none" style={[styles.art, { left: 0, right: 0 },level.id==='guidance'&&{top:-12-artHeight*24/156}]}>
                      <Art kind={levelScenes[level.id]} height={level.id==='guidance'?artHeight*180/156:artHeight} width={contentWidth} active={expanded && effectsActive} reducedMotion={reducedMotion} />
                    </View>
                    <View style={styles.levelCopy}>
                      <Image pointerEvents="none" source={fade} style={styles.artFade} contentFit="fill" />
                      <ProductText variant="body" style={styles.description}>{level.description}</ProductText>
                      <Pressable accessibilityRole="button" accessibilityLabel={level.action} onPress={() => onStart(level.id)} style={styles.action}>
                        <PanelArtwork source={actions[level.id]} flipY={level.id === 'guidance'} />
                        <ProductText variant="title" style={styles.actionLabel}>{level.action}</ProductText>
                        <Image pointerEvents="none" source={arrow} tintColor={colors.onAccent} style={styles.arrow} contentFit="contain" />
                      </Pressable>
                    </View>
                  </View>
                </Accordion>
              </PanelScan>
            );
          })}
        </View>
      </ProductScreen>

    </>
  );
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  screen: { padding: 0, paddingBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46 },
  heading: { flex: 1, marginHorizontal: 8, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  choose: { marginTop: 24, marginBottom: 16, color: colors.muted, fontSize: 16, lineHeight: 18, letterSpacing: 0 },
  levels: { gap: 24 },
  level: { padding: 0, backgroundColor: 'transparent' },
  levelHeader: { position: 'relative', zIndex: 4, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 13 },
  number: { width: 26, flexShrink: 0, fontSize: 13, lineHeight: 18, letterSpacing: 2.86, color: colors.muted },
  levelTitle: { flex: 1, fontSize: 20, lineHeight: 28, letterSpacing: 2 },
  expandIcon: { width: 11, height: 11, alignItems: 'center', justifyContent: 'center' },
  expandHorizontal: { width: 11, height: .75, backgroundColor: colors.accent },
  expandVertical: { position: 'absolute', width: .75, height: 11, backgroundColor: colors.accent },
  levelBody: { justifyContent: 'flex-end' },
  art: { position: 'absolute', top: -12 },
  levelCopy: { gap: 8 },
  artFade: { position: 'absolute', left: -12, right: -12, top: -12, height: 48 },
  description: { color: colors.accent, fontSize: 10, lineHeight: 14 },
  action: { height: 42, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: colors.onAccent, fontSize: 16, lineHeight: 23, fontWeight: '500' },
  arrow: { position: 'absolute', width: 32, height: 32, right: 5, top: 5, transform: [{ scaleY: -1 }] },
});
