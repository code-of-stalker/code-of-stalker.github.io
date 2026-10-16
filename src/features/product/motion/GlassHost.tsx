import { useEffect, useMemo, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
import { Art } from './Art';
import type { ArtController } from './types';
import type { GlassShape } from './glassShape';
import { NativePanelReveal, usePanelReveal } from './PanelReveal';
import { useEffectQualityLevel } from './EffectsQuality';
import { GlassOutline } from './GlassOutline';
import { ScanLight } from './ScanLight';
import { usePanelSize } from './usePanelSize';
import { useSharedPanelScan } from './PanelScanContext';

/** Observe contact without taking the responder away from scrolling or buttons. */
export function GlassHost({ children, style, contour, background = 'clear', reducedMotion = false, accessibilityLabel, scanOnMount = true, touchEnabled = true, decorationOpacity = 1 }: PropsWithChildren<{
  style?: StyleProp<ViewStyle>; contour(width: number, height: number): string;
  background?: GlassShape['background']; reducedMotion?: boolean; accessibilityLabel?: string; scanOnMount?: boolean; touchEnabled?: boolean; decorationOpacity?: number;
}>) {
  const quality = useEffectQualityLevel();
  const sharedScan = useSharedPanelScan();
  scanOnMount = scanOnMount && !sharedScan;
  const touchAllowed = touchEnabled && quality !== 'economy';
  const { ref: host, report, progress, initialStyle } = usePanelReveal(scanOnMount, reducedMotion);
  const controller = useRef<ArtController | null>(null);
  const contactEnabled = useRef(touchAllowed);
  const {size,onLayout}=usePanelSize({width:1,height:1},host);
  const shape = useMemo(() => ({ ...size, path: contour(size.width, size.height), background }), [size, contour, background]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = host.current as unknown as HTMLElement;
    if (!element) return;
    element.setAttribute('data-glass-touch', String(touchAllowed));
    if (!touchAllowed) return;
    let pressed = false;
    function point(event: PointerEvent, action: 'glass-press' | 'glass-move') {
      const bounds = element.getBoundingClientRect();
      controller.current?.interact({ type: 'watcher-art-interaction', action,
        x: Math.max(0, Math.min(1, (event.clientX-bounds.left)/bounds.width)), y: Math.max(0, Math.min(1, (event.clientY-bounds.top)/bounds.height)) });
    }
    function down(event: PointerEvent) {
      const button = (event.target as Element | null)?.closest('button,[role="button"]');
      if (!event.isPrimary || event.button !== 0 || (button && element.contains(button))) return;
      pressed = true; point(event, 'glass-press');
    }
    function move(event: PointerEvent) { if (pressed && event.isPrimary) point(event, 'glass-move'); }
    function release() { if (pressed) controller.current?.interact({ type: 'watcher-art-interaction', action: 'glass-release' }); pressed = false; }
    element.addEventListener('pointerdown', down, true); element.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release); window.addEventListener('blur', release);
    return () => {
      release(); element.removeEventListener('pointerdown', down, true); element.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); window.removeEventListener('blur', release);
    };
  }, [host, touchAllowed]);
  useEffect(() => {
    contactEnabled.current = touchAllowed;
    if (!touchAllowed) controller.current?.interact({ type: 'watcher-art-interaction', action: 'glass-release' });
  }, [touchAllowed]);
  function nativePoint(event: GestureResponderEvent, action: 'glass-press' | 'glass-move' | 'glass-release') {
    if (Platform.OS === 'web' || !touchAllowed) return;
    const { pageX, pageY } = event.nativeEvent;
    host.current?.measureInWindow((x, y, width, height) => {
      if (!contactEnabled.current) return;
      controller.current?.interact({ type: 'watcher-art-interaction', action,
        x: Math.max(0, Math.min(1, (pageX-x)/Math.max(1,width))), y: Math.max(0, Math.min(1, (pageY-y)/Math.max(1,height))) });
    });
  }
  const surface = Platform.OS === 'web' ? { clipPath: `path('${shape.path}')` } as ViewStyle : undefined;
  const layout=StyleSheet.flatten(style)??{};
  const contentKeys=['padding','paddingTop','paddingBottom','paddingLeft','paddingRight','paddingHorizontal','paddingVertical','backgroundColor','flexDirection','justifyContent','alignItems','gap','rowGap','columnGap'] as const;
  const contentStyle=Object.fromEntries(contentKeys.filter(key=>layout[key]!==undefined).map(key=>[key,layout[key]])) as ViewStyle;
  return <View style={[style,{position:layout.position??'relative',padding:0,paddingHorizontal:0,paddingVertical:0,paddingTop:0,paddingBottom:0,paddingLeft:0,paddingRight:0,backgroundColor:'transparent',gap:0,rowGap:0,columnGap:0,flexDirection:'column',alignItems:'stretch',justifyContent:'flex-start'}]}>
  {/* Keep a bounded viewport inside sized panels, while intrinsic panels can still grow to their content. */}
  <View ref={host} accessibilityLabel={accessibilityLabel} style={[{flexGrow:1,flexShrink:1,minHeight:0,minWidth:0,alignSelf:'stretch'},contentStyle,initialStyle]} onLayout={onLayout} onTouchStart={event => nativePoint(event, 'glass-press')} onTouchMove={event => nativePoint(event, 'glass-move')}
    onTouchEnd={event => nativePoint(event, 'glass-release')} onTouchCancel={event => nativePoint(event, 'glass-release')}>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: decorationOpacity }]}>
      <Art kind="glass" height={size.height} width={size.width} glass={shape} controllerRef={controller} reducedMotion={reducedMotion} scanOnMount={scanOnMount} onRevealProgress={report} style={surface} />
    </View>
    {children}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: decorationOpacity }]}><GlassOutline {...shape} /></View>
    {!sharedScan && <NativePanelReveal progress={progress} height={size.height} />}
  </View>{!sharedScan && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: decorationOpacity }]}><ScanLight path={shape.path}/></View>}</View>;
}
