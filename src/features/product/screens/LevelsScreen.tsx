import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { RustIcon } from '../motion/RustIcon';
import { AppState, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MatrixBackdrop } from '../motion/MatrixBackdrop';
import { PanelScan } from '../motion/PanelScan';
import { Accordion } from '../motion/Accordion';
import { HeightMotion } from '../motion/HeightMotion';
import { LevelFrame } from '../motion/LevelFrame';
import { PanelArtwork } from '../motion/PanelArtwork';
import { useBackSwipe } from '../navigation/BackSwipeProvider';
import { levelActionArtwork } from '../levelArtwork';

import { productLevels } from '../content';
import { typeset } from '../typeset';
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
  /** The plate opened when both do not fit the screen height. */
  selectedLevel: LevelId | null;
  /** The level the person is on now, marked «ВЫ ЗДЕСЬ»; null before any level is chosen. */
  currentLevel?: LevelId | null;
  onStart: (level: LevelId) => void;
  onBack: () => void;
  onDiary: () => void;
  reducedMotion?: boolean;
  effectsActive?: boolean;
};

export function LevelsScreen({ selectedLevel, currentLevel = null, onStart, onBack, onDiary, reducedMotion = false, effectsActive = true }: LevelsScreenProps) {
  const styles = useThemeStyles(createStyles);
  const colors = useThemeColors();
  const actions = useMemo(() => Object.fromEntries(productLevels.map(level => [level.id, levelActionArtwork(level.id, colors.accent)])) as Record<LevelId, {uri:string}>, [colors.accent]);
  const { width, height } = useWindowDimensions(), safe = useSafeAreaInsets();
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
  // Art 2026-11-11: when the screen is tall enough, both plates stand open at once.
  // Fixed header (16 + 46), «ВЫБЕРИ УРОВЕНЬ» (24 + 18 + 16), the open plates, the gap, bottom 16.
  const openHeader = width >= 375 ? 58 : 52, spread = Math.max(1, air);
  const allOpenHeight = 62 + 58 * spread + productLevels.length * (openHeader + bodyHeight) + 24 * spread * (productLevels.length - 1) + 16;
  const allFit = allOpenHeight <= height - safe.top - safe.bottom;
  const [open, setOpen] = useState<readonly LevelId[]>(() => allFit ? productLevels.map(level => level.id) : selectedLevel ? [selectedLevel] : []);
  // Each plate folds on its own while all fit; on a short screen one plate is open at a time.
  const toggle = (id: LevelId) => setOpen(current => current.includes(id) ? current.filter(item => item !== id) : allFit ? [...current, id] : [id]);
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
            const expanded = open.includes(level.id), here = level.id === currentLevel;
            return (
              <PanelScan key={level.id} delay={index*100} reducedMotion={reducedMotion} style={styles.level}>
                <LevelFrame level={level.id} expanded={expanded} width={contentWidth} />
                <HeightMotion height={expanded?(width>=375?58:52):62} reducedMotion={reducedMotion}><Pressable
                  accessibilityRole="button"
                  accessibilityLabel={(here ? 'вы здесь, ' : '') + level.title.replace('\n', ' ')}
                  accessibilityState={{ expanded }}
                  aria-expanded={expanded}
                  onPress={() => toggle(level.id)}
                  style={[styles.levelHeader, { paddingHorizontal: inset, flex:1 }]}
                >
                  <ProductText variant="label" numberOfLines={1} maxFontSize={13} style={styles.number}>{level.number}</ProductText>
                  <ProductText variant="title" numberOfLines={1} style={styles.levelTitle}>{level.title}</ProductText>
                  {here && <View testID="level-here" pointerEvents="none" style={styles.here}><View style={styles.hereMark} /><ProductText numberOfLines={1} style={styles.hereLabel}>ВЫ ЗДЕСЬ</ProductText></View>}
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
                      <ProductText variant="body" style={styles.description}>{typeset(level.description)}</ProductText>
                      <Pressable accessibilityRole="button" accessibilityLabel={level.action} onPress={() => onStart(level.id)} style={styles.action}>
                        <PanelArtwork source={actions[level.id]} flipY={level.id === 'guidance'} />
                        <ProductText variant="title" style={styles.actionLabel}>{level.action}</ProductText>
                        <View pointerEvents="none" style={styles.arrow}><RustIcon name="level-arrow" width={32} height={32} round={false} color={colors.onAccent} autoplay
                          fallback={<Image pointerEvents="none" source={arrow} tintColor={colors.onAccent} style={styles.arrowImage} contentFit="contain" />} /></View>
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
  // Art 2026-11-11: a laconic «you are here» on the current level: a small diamond and a caption.
  here: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  hereMark: { width: 5, height: 5, backgroundColor: colors.accent, transform: [{ rotate: '45deg' }] },
  hereLabel: { color: colors.accent, fontSize: 8, lineHeight: 10, letterSpacing: 1.2 },
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
  arrowImage: { width: 32, height: 32 },
});
