import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { productStepNames } from '../content';
import { ProductText } from '../ui';
import { Reveal } from './Reveal';
import { StepChevron } from './StepChevron';
import { GlassHost } from './GlassHost';
import { stepPanelPaths } from './glassShape';
import { PanelArtwork } from './PanelArtwork';
import { usePanelSize } from './usePanelSize';
import { readingMenuPath, type ReadingMenuCutout } from './reading-menu-geometry';
import { useProduct } from '../state/ProductProvider';
import { Animated, Easing } from './RustAnimated';
import { stepSections, type StepDestination } from '../stepSections';
import { beginReadingNavigation, requestReadingDestination } from '../navigation/readingDestination';

const lock = { uri: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="14" viewBox="0 0 12 14" fill="none"><path d="M3 6V4Q3 1 6 1T9 4V6M1.5 6.5H10.5V13H1.5ZM6 9V10.5" stroke="#B69D4B" stroke-width=".75" stroke-linecap="round" stroke-linejoin="round"/></svg>')}` };
const steps = [1, 2, 3, 4, 5, 6, 7] as const;
const sectionsIcon = require('../../../../assets/product/step-sections.svg');

function StepChoice({ value, current, disabled, expanded, inset, reducedMotion, onToggle, onEnter, onSection, busy }: {
  value: typeof steps[number]; current: number; disabled: boolean; expanded: boolean; inset: number; reducedMotion: boolean; busy: boolean;
  onToggle(): void; onEnter(): void; onSection(destination: StepDestination): void;
}) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  const [height, setHeight] = useState(0), [motion] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(motion, { toValue: expanded ? 1 : 0, duration: reducedMotion ? 0 : 480, easing: Easing.inOut(Easing.cubic), useNativeDriver: false });
    animation.start(); return () => animation.stop();
  }, [expanded, reducedMotion, motion]);
  const groups = value <= 3 && !disabled ? stepSections(value as 1 | 2 | 3) : [];
  return <View>
    <View style={[styles.option, value === current && { backgroundColor: colors.subtle }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: value === current, disabled: disabled || busy }} disabled={disabled || busy}
        accessibilityLabel={`Открыть шаг ${value}. ${productStepNames[value]}`} onPress={onEnter}
        style={[styles.stepTitle, { paddingLeft: inset }]}>
        <ProductText testID={`step-option-label-${value}`} fitToWidth variant="label" color={value === current ? colors.text : colors.muted} style={styles.optionText}>{`ШАГ ${value}. ${productStepNames[value]}`}</ProductText>
      </Pressable>
      {disabled ? <View style={[styles.sectionButton, { marginRight: Math.max(0, inset - 8) }]}><Image pointerEvents="none" source={lock} tintColor={colors.iconTint} style={styles.lock} contentFit="contain" /></View>
        : <Pressable accessibilityRole="button" accessibilityLabel={`Разделы шага ${value}`} accessibilityState={{ expanded, disabled: busy }} aria-expanded={expanded} disabled={busy}
          onPress={onToggle} style={[styles.sectionButton, { marginRight: Math.max(0, inset - 8) }, Platform.OS === 'web' && { outlineWidth: 0 }]}>
          <View pointerEvents="none" style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
          <Image pointerEvents="none" source={sectionsIcon} tintColor={expanded ? colors.text : colors.accent} style={{ width: 18, height: 18 }} contentFit="contain" />
        </Pressable>}
    </View>
    {!!groups.length && <Animated.View pointerEvents={expanded ? 'auto' : 'none'} accessibilityElementsHidden={!expanded} aria-hidden={!expanded}
      importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'} style={{ height: motion.interpolate({ inputRange: [0, 1], outputRange: [0, height] }), overflow: 'hidden' }}>
      <Animated.View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: motion,
        transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }], paddingHorizontal: inset + 10, paddingTop: 12, paddingBottom: 20 }}>
        {groups.map(group => <View key={group.title} style={{ marginBottom: 12 }}>
          <ProductText variant="label" color={colors.muted} style={styles.groupTitle}>{group.title}</ProductText>
          {group.items.map((item, index) => <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={item.title} disabled={busy}
            hitSlop={{ top: 4, bottom: 4 }} onPress={() => onSection(item.destination)} style={styles.sectionRow}>
            <ProductText numberOfLines={1} color={colors.muted} style={styles.sectionNumber}>{String(index + 1).padStart(2, '0')}</ProductText>
            <ProductText style={styles.sectionText}>{item.title}</ProductText>
          </Pressable>)}
        </View>)}
      </Animated.View>
    </Animated.View>}
  </View>;
}

/** Replace the panel's body; the compact selector also uses a framed menu. */
export function StepDropdown({ step, availableAt, testUnlockAll = false, reducedMotion, onClose, onSelect, inset = 12, embedded = false, headerless = false, frameSize, onNaturalHeight, cutout }: {
  step: keyof typeof productStepNames; availableAt: number | null; testUnlockAll?: boolean; reducedMotion: boolean; inset?: number; embedded?: boolean; headerless?: boolean;
  onClose(): void; onSelect(step: number): void; frameSize?: { width: number; height: number }; onNaturalHeight?(height: number): void;
  cutout?: ReadingMenuCutout;
}) {
  const colors = useThemeColors();
  const { progress, updateProgress } = useProduct();
  const [expandedStep, setExpandedStep] = useState<number | null>(null), [navigating, setNavigating] = useState(false);
  async function navigate(destination: StepDestination) {
    if (navigating) return;
    beginReadingNavigation();
    setNavigating(true);
    try {
      await updateProgress({ step: destination.step, practiceStage: destination.stage, questionIndex: 0,
        ...(destination.step === 3 ? { stepThreeReading: { chapter: destination.chapter, page: destination.page, offset: 0, paged: destination.section } } : {}) });
      requestReadingDestination(destination); onSelect(destination.step);
    } catch { setNavigating(false); }
  }
  const styles = useThemeStyles(createStyles);
  const {ref,size:measuredSize,onLayout}=usePanelSize({width:288,height:314});
  const {ref:headerRef,size:headerSize,onLayout:onHeaderLayout}=usePanelSize({width:288,height:25});
  const headerHeight=headerSize.height;
  const [contentHeight, setContentHeight] = useState(0);
  const topInset = headerless ? 8 : headerHeight + 33, bottomInset = headerless ? 8 : inset;
  useEffect(() => {
    if (contentHeight > 0) onNaturalHeight?.(embedded ? contentHeight : topInset + contentHeight + bottomInset);
  }, [contentHeight, topInset, bottomInset, embedded, onNaturalHeight]);
  const contour=useCallback((width:number,height:number)=>headerless ? readingMenuPath(width,height,cutout) : stepPanelPaths(width,height,headerHeight).path,[headerHeight,headerless,cutout]);
  const size = frameSize ?? measuredSize;
  // Preserve Figma's top notch and draw one bottom edge at the actual height.
  // A rotated fixed-size body left a second edge below shorter menus.
  const geometry = useMemo(() => {
    const w = size.width, h = size.height, paths = stepPanelPaths(w, h, headerHeight);
    const path = headerless ? readingMenuPath(w,h,cutout) : paths.path;
    const light = colors.background === '#FAE18F', border = light ? colors.accent : colors.border, stroke = '.25';
    const svg = (content: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${content}</svg>`)}`;
    return {
      path,
      backing: { uri: svg(`<path d="${path}" fill="${colors.background}"/>`) },
      frame: { uri: svg(headerless ? `<path d="${path}" fill="none" stroke="${border}" stroke-width="${stroke}"/>` : `<path d="${paths.top}" fill="${colors.accent}" fill-opacity=".1" stroke="${border}" stroke-width="${stroke}"/><path d="${paths.body}" fill="none" stroke="${border}" stroke-width="${stroke}"/>`) },
    };
  }, [size.width, size.height, headerHeight, headerless, cutout, colors]);
  const options = <ScrollView accessibilityLabel="Доступные и закрытые шаги" onContentSizeChange={(_, height) => setContentHeight(previous => previous === height ? previous : height)} style={embedded ? styles.embeddedList : [styles.list, { top: topInset, bottom: bottomInset }]}
    contentContainerStyle={[styles.options, embedded && { paddingTop: 18, paddingBottom: inset }]} showsVerticalScrollIndicator={false}>
    {steps.map(value => {
      const disabled = value > 3 || value === 3 && !progress.secondStepCompletedAt && !testUnlockAll || value === 2 && availableAt === null && !testUnlockAll;
      return <StepChoice key={value} value={value} current={step} disabled={disabled} expanded={expandedStep === value} inset={inset} reducedMotion={reducedMotion} busy={navigating}
        onToggle={() => setExpandedStep(previous => previous === value ? null : value)} onSection={destination => { void navigate(destination); }}
        onEnter={() => { if (value <= 3) void navigate({ step: value as 1 | 2 | 3, stage: 0, chapter: 0, page: 0, section: false }); }} />;
    })}
  </ScrollView>;
  const content = <View style={embedded ? styles.embedded : styles.overlay}>
    {embedded ? options : <>
      {/* Occlude only the menu's silhouette. Text above it stays mounted and visible. */}
      {Platform.OS === 'web'
        ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, clipPath: `path('${geometry.path}')` } as ViewStyle]} />
        : <PanelArtwork source={geometry.backing} />}
      <GlassHost style={[styles.fill, headerless && Platform.OS === 'web' && { clipPath: `path('${geometry.path}')` } as ViewStyle]} contour={contour} reducedMotion={reducedMotion} scanOnMount={false}>
      {!frameSize && <View ref={ref} pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout} />}
      <PanelArtwork source={geometry.frame} />
      {!headerless && <Pressable ref={headerRef} onLayout={onHeaderLayout} accessibilityRole="button" accessibilityLabel="Свернуть выбор шага" accessibilityState={{ expanded: true }} aria-expanded
        onPress={onClose} style={[styles.trigger, { paddingHorizontal: inset }]}>
        <ProductText fitToWidth variant="label" style={styles.title}>{`ШАГ ${step}. ${productStepNames[step]}`}</ProductText>
        <StepChevron expanded />
      </Pressable>}
      {options}
    </GlassHost></>}
  </View>;
  return embedded ? <Reveal reducedMotion={reducedMotion} style={styles.embedded}>{content}</Reveal> : content;
}
const createStyles = (colors: ProductColors) => StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 20 }, fill: { flex: 1 },
  embedded: { flex: 1, minHeight: 0 }, embeddedList: { flex: 1 },
  trigger: { minHeight: 25, flexShrink: 0, paddingVertical: 5.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, gap: 8 },
  title: { fontSize: 10, lineHeight: 14, letterSpacing: 2.2, flex: 1, minWidth: 0 },
  list: { position: 'absolute', left: 0, right: 0, top: 58, bottom: 14 },
  // Row padding contributes 16px between adjacent labels; the 4px gap caps
  // their visible separation at 20px, independently of screen height.
  options: { gap: 4 },
  option: { minHeight: 44, flexDirection: 'row', alignItems: 'stretch' },
  stepTitle: { flex: 1, minWidth: 0, paddingVertical: 12, paddingRight: 8, justifyContent: 'center' },
  sectionButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  sectionDivider: { position: 'absolute', left: 0, top: 13, bottom: 13, width: .25 },
  groupTitle: { fontSize: 8, lineHeight: 14, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8 },
  // No minimum height: a one-line title would get more air than a wrapped
  // one. Every title sits 20px from the next; hitSlop keeps the touch target.
  // The number rides the first line, not the middle of a wrapped title.
  sectionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 },
  sectionNumber: { fontSize: 8, lineHeight: 13, width: 24, flexShrink: 0, marginTop: 1.5 },
  sectionText: { fontSize: 10, lineHeight: 16, flex: 1, textTransform: 'uppercase', letterSpacing: .7 },
  optionText: { fontSize: 10, lineHeight: 14, letterSpacing: 2.2, flex: 1, minWidth: 0 },
  lock: { width: 12, height: 14, flexShrink: 0 },
});
