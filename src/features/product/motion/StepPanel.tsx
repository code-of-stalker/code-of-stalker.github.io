import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { useCallback, useMemo } from 'react';
import type { PropsWithChildren, ReactNode, RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ViewStyle } from 'react-native';
import { ProductText } from '../ui';
import { StepChevron } from './StepChevron';
import { GlassHost } from './GlassHost';
import { stepPanelPaths } from './glassShape';
import type { GlassShape } from './glassShape';
import { PanelArtwork } from './PanelArtwork';
import { usePanelSize } from './usePanelSize';
import { useBackSwipeBlocked } from '../navigation/BackSwipeProvider';
import { PanelBorder } from '../PanelBorder';
import { productSpacing } from '../layout';
import material from '../../../../assets/product/motion/laboratory-glass.json';
import { DiaryGlass } from '../diary/DiaryGlass';
import { TaskStepSelector } from './TaskStepSelector';
import { StepDropdown } from './StepDropdown';
import { readingControlsTop, readingMenuGap, type ReadingCloseButton } from './reading-controls';
import type { productStepNames } from '../content';

const blend = (start: number, end: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

// Figma 1130:42377 outline; keep the notch dimensions while the straight body grows.
// Only the straight body grows when the screen gets taller; the notch stays crisp.
export function StepPanel({ children, title, expanded, onSelect, contentInset = 12, menu, reducedMotion = false, background = 'orbs', scanOnMount = true, onHeaderHeight, menuContentHeight, readingProgress = 0, readingStep, readingSelection, readingCloseButton }: PropsWithChildren<{
  title: string; expanded: boolean; onSelect(): void; blurTarget: RefObject<View | null>; contentInset?: number; menu?: ReactNode; reducedMotion?: boolean; background?: GlassShape['background']; scanOnMount?: boolean; onHeaderHeight?(height: number): void; menuContentHeight?: number; readingProgress?: number; readingStep?: keyof typeof productStepNames;
  readingSelection?: { availableAt: number | null; testUnlockAll?: boolean; onSelectStep(step: number): void };
  readingCloseButton?: ReadingCloseButton;
}>) {
  const colors = useThemeColors();
  // Only the fully opened reader has the floating rectangular menu.
  // Before zoom, options belong inside the original notched panel body.
  const usesSelector = readingStep !== undefined && !!readingSelection && readingProgress >= .88;
  const replacesBody = expanded && !usesSelector;
  useBackSwipeBlocked(expanded && !usesSelector);
  const styles = useThemeStyles(createStyles);
  const {ref,size,onLayout}=usePanelSize({width:288,height:314});
  const {ref:headerRef,size:headerSize,onLayout:onHeaderLayout}=usePanelSize({width:288,height:25});
  const { width: deviceWidth } = useWindowDimensions();
  const progress = readingStep === undefined ? 0 : readingProgress;
  const compactWidth = deviceWidth >= 375 ? 136 : 106;
  const buttonInset = contentInset + (productSpacing(deviceWidth).inset - contentInset) * progress;
  const buttonHeight = headerSize.height + (26 - headerSize.height) * progress;
  const menuOffset = buttonHeight + readingMenuGap;
  const controlsInset = readingCloseButton?.right ?? productSpacing(deviceWidth).gutter * progress;
  const menuCutout = readingCloseButton && {
    left: size.width - controlsInset - readingCloseButton.right - readingCloseButton.width,
    top: readingCloseButton.top - readingControlsTop * progress - menuOffset,
    width: readingCloseButton.width, height: readingCloseButton.height,
  };
  const frameOpacity = 1 - blend(.2, .88, progress);
  const decorationOpacity = usesSelector && expanded ? 0 : frameOpacity;
  const flat = readingStep !== undefined && progress >= .88;
  // The original title keeps its measured contour while dissolving. Its
  // compact button floats above the reader and reserves no full-width strip.
  const headerHeight=headerSize.height + 32 * progress;
  const headerSpace = (headerSize.height + 8) * (1 - progress);
  const contour=useCallback((width:number,height:number)=>flat ? `M0 0H${width}V${height}H0Z` : stepPanelPaths(width,height,headerHeight).path,[flat,headerHeight]);
  const shape = useMemo(() => {
    const w = size.width, h = size.height, r = 1, anchor = w - 136;
    const { top, body } = stepPanelPaths(w, h, headerHeight);
    const light = colors.background === '#FAE18F', border = light ? colors.accent : colors.border, stroke = '.25';
    return {
      headerFrame: { uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${top}" fill="${colors.accent}" fill-opacity=".1" stroke="${border}" stroke-width="${stroke}"/></svg>`)}` },
      frame: { uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${top}" fill="${colors.accent}" fill-opacity="${expanded ? '.1' : '.025'}" stroke="${border}" stroke-width="${stroke}"/><path d="${body}" fill="none" stroke="${border}" stroke-width="${stroke}"/></svg>`)}` },
      glass: Platform.OS === 'web' ? { clipPath: `path('${top} ${body}')` } as ViewStyle : undefined,
      // Body starts at 33px. Clip the scroll contents under the double notch.
      content: Platform.OS === 'web' && !flat ? { clipPath: `polygon(0 1px, ${anchor}px 1px, ${anchor+12*r}px ${13*r}px, ${anchor+48*r}px ${13*r}px, ${anchor+60*r}px 1px, ${w-29*r}px 1px, 100% ${33*r}px, 100% 100%, 0 100%)` } as ViewStyle : undefined,
    };
  }, [size, headerHeight, expanded, colors, flat]);
  const trigger = <Pressable testID="reading-step-trigger" accessibilityRole="button" accessibilityLabel={`Выбрать шаг. ${title}`} accessibilityState={{ expanded }} aria-expanded={expanded} onPress={onSelect} hitSlop={progress > .8 ? { top: 9, bottom: 9 } : undefined}
        style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        {readingStep !== undefined && <View testID="reading-step-glass" pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: blend(.18, .65, progress) }]}>
          {Platform.OS === 'web' ? <View style={[StyleSheet.absoluteFill, {
            backgroundColor: `${colors.background}a6`, backdropFilter: `blur(${material.backgroundBlur}px)`, WebkitBackdropFilter: `blur(${material.backgroundBlur}px)`,
          } as ViewStyle]} /> : <DiaryGlass />}
        </View>}
        <View ref={headerRef} onLayout={event => { onHeaderLayout(event); onHeaderHeight?.(event.nativeEvent.layout.height + 32 * progress); }} pointerEvents="none"
          style={[styles.header, { position: 'absolute', top: 0, left: 0, width: size.width, paddingHorizontal: contentInset, opacity: 1 - blend(.08, .48, progress), transform: [{ translateY: -4 * progress }] }]}>
          <ProductText fitToWidth variant="label" style={styles.title}>{title}</ProductText>
          <View style={{ width: 7, height: 5 }} />
        </View>
        {readingStep !== undefined && <View pointerEvents="none" style={{ position: 'absolute', left: buttonInset, right: buttonInset + 15, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', opacity: blend(.3, .72, progress), transform: [{ translateY: 4 * (1 - progress) }] }}>
          <ProductText variant="label" numberOfLines={1} style={styles.compactLabel}>ШАГ {readingStep}.</ProductText>
        </View>}
        <View pointerEvents="none" style={{ position: 'absolute', right: buttonInset, top: 0, bottom: 0, justifyContent: 'center' }}><StepChevron expanded={expanded} /></View>
        {readingStep !== undefined && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: blend(.18, .65, progress) }]}><PanelBorder /></View>}
      </Pressable>;
  return <GlassHost contour={contour} background={background} reducedMotion={reducedMotion} scanOnMount={scanOnMount} decorationOpacity={decorationOpacity} touchEnabled={progress < .2} style={[styles.panel, replacesBody && !!menuContentHeight && { flex: 0, flexShrink: 1, flexBasis: 'auto', height: headerHeight + 8 + menuContentHeight, maxHeight: '100%' }]}>
    <View ref={ref} pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout} />
    <View pointerEvents="none" style={{ height: headerSpace, flexShrink: 0 }} />
    {usesSelector && expanded && <Pressable accessibilityRole="button" accessibilityLabel="Закрыть выбор шага" onPress={onSelect} style={[StyleSheet.absoluteFill, { zIndex: 1 }]} />}
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 2 }]}>
      {usesSelector && readingStep !== undefined && readingSelection ? <TaskStepSelector step={readingStep} availableAt={readingSelection.availableAt} testUnlockAll={readingSelection.testUnlockAll}
        open={expanded} onToggle={onSelect} onSelect={readingSelection.onSelectStep} reducedMotion={reducedMotion} inset={productSpacing(deviceWidth).inset}
        anchor="top" menuOffset={menuOffset} menuCutout={menuCutout} maxHeight={Math.max(1, size.height - readingControlsTop * progress - menuOffset - 8)} trigger={trigger}
        triggerSize={{ width: size.width + (compactWidth - size.width) * progress, height: buttonHeight }}
        style={{ position: 'absolute', top: readingControlsTop * progress, left: controlsInset, width: size.width - 2 * controlsInset }} />
        : <View pointerEvents="box-none" style={{ position: 'absolute', top: readingControlsTop * progress, left: controlsInset, width: size.width + (compactWidth - size.width) * progress, height: buttonHeight }}>{trigger}</View>}
    </View>
    <View accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'}
      pointerEvents={expanded ? 'none' : 'auto'} style={[styles.body, shape.content, replacesBody && styles.hidden]}>{children}</View>
    {replacesBody && <View testID="notched-step-menu" style={[styles.body, shape.content]}>
      {readingStep !== undefined && readingSelection ? <StepDropdown step={readingStep} availableAt={readingSelection.availableAt} testUnlockAll={readingSelection.testUnlockAll}
        reducedMotion={reducedMotion} inset={contentInset} embedded onClose={onSelect} onSelect={readingSelection.onSelectStep} /> : menu}
    </View>}
    {usesSelector && expanded && <PanelArtwork source={shape.headerFrame} style={{ opacity: frameOpacity }} />}
    <PanelArtwork source={shape.frame} style={{ opacity: decorationOpacity }} />
  </GlassHost>;
}
const createStyles = (colors: ProductColors) => StyleSheet.create({
  panel: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: 'transparent' },
  header: { minHeight: 25, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 5.5, gap: 8 },
  title: { flex: 1, minWidth: 0, fontSize: 10, lineHeight: 12, letterSpacing: 2.2 },
  compactLabel: { fontSize: 8, lineHeight: 12, letterSpacing: 1.76 },
  body: { flex: 1, minHeight: 0 },
  hidden: { display: 'none' },
});
