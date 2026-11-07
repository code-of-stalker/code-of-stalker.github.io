import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';

import { DiaryDesignPanel } from '../../product/diary/DiaryDesignPanel';
import { DiaryGlass } from '../../product/diary/DiaryGlass';
import { diaryArtwork } from '../../product/diary/diaryArtwork';
import { iconSource } from '../../product/icon-source';
import { useProductLayout } from '../../product/layout';
import { BottomSheet } from '../../product/motion/BottomSheet';
import { fitPanelPath } from '../../product/motion/glassShape';
import { PanelArtwork } from '../../product/motion/PanelArtwork';
import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import { useProduct } from '../../product/state/ProductProvider';
import type { ProductColors } from '../../product/theme';
import { fonts } from '../../product/theme';
import { ProductButton, ProductText } from '../../product/ui';

/** Stroke glyphs on a 24 grid, drawn like the diary icons. */
export const glyphs = {
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5ZM12 15v2',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 7.5V12l3 2M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z',
  alert: 'M12 7.5v5.5m0 3v.5M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z',
  down: 'M6 9.5l6 6 6-6',
  right: 'M9.5 6l6 6-6 6',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15.5 4.3a3.5 3.5 0 0 1 0 6.4M17.5 14.4c2 .9 3.5 3 3.5 5.6',
  key: 'M8 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7ZM11.5 12H21M18 12v3M21 12v2',
  device: 'M8 3h8v18H8ZM11 18h2',
  words: 'M4 5h16M4 10h16M4 15h10M4 20h7',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z',
  exit: 'M14 4h6v16h-6M10 8l-4 4 4 4M6 12h10',
  // Sign out: the arrow leaves through the door on the left, away from the back arrow.
  logout: 'M10 4H4v16h6M14 8l4 4-4 4M18 12H8',
  person: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8',
  chat: 'M4 5h16v11H9l-5 4Z',
  erase: 'M9 5h11v14H9l-6-7ZM12.5 9.5l5 5M17.5 9.5l-5 5',
  copy: 'M9 9h11v11H9ZM15 9V4H4v11h5',
  edit: 'M4 20h4L19 9l-4-4L4 16ZM13 7l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  refresh: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4',
};
export type GlyphName = keyof typeof glyphs;

export function Glyph({ name, size = 20, color }: { name: GlyphName; size?: number; color?: string }) {
  const colors = useThemeColors(), ink = color ?? colors.accent;
  const source = useMemo(() => iconSource(glyphs[name], ink, size), [ink, name, size]);
  return <Image pointerEvents="none" source={source} style={{ width: size, height: size, flexShrink: 0 }} contentFit="contain" />;
}

const svgSource = (svg: string) => ({ uri: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) });
const ICON_CONTOUR = 'M33.4473 .125L43.875 10.5527V41.875H10.5527L.125 31.4473V.125Z';
/** A bubble's place in a run of messages from one writer. */
export type BubbleSpot = 'alone' | 'head' | 'middle' | 'tail';
// Own bubbles keep the lower right corner whole, the others the lower left: the corner that points
// to the writer. Inside a run only the outer corners are cut (the top one on the first bubble, the
// bottom one on the last), so the bubbles read as one block.
const OWN_CONTOURS: Record<BubbleSpot, string> = {
  alone: 'M111.875 .125L119.875 8.125V39.875H8.125L.125 31.875V.125Z',
  head: 'M111.875 .125L119.875 8.125V39.875H.125V.125Z',
  middle: 'M.125 .125H119.875V39.875H.125Z',
  tail: 'M.125 .125H119.875V39.875H8.125L.125 31.875Z',
};
const OTHER_CONTOURS: Record<BubbleSpot, string> = {
  alone: 'M8.125 .125H119.875V31.875L111.875 39.875H.125V8.125Z',
  head: 'M8.125 .125H119.875V39.875H.125V8.125Z',
  middle: 'M.125 .125H119.875V39.875H.125Z',
  tail: 'M.125 .125H119.875V31.875L111.875 39.875H.125Z',
};
const spots: BubbleSpot[] = ['alone', 'head', 'middle', 'tail'];
export const bubbleSpot = (first: boolean, last: boolean): BubbleSpot => first ? last ? 'alone' : 'head' : last ? 'tail' : 'middle';

/** Authored frames for this section; PanelArtwork moves their anchors to the layout size. */
export function useIntensiveFrames() {
  const colors = useThemeColors();
  return useMemo(() => {
    const tag = colors.accent.replace('#', '');
    const own = (contour: string) => svgSource(`<svg width="120" height="40" viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="${contour}" fill="${colors.background}" fill-opacity="0.88"/>
<path d="${contour}" fill="url(#intensive-own-${tag})" fill-opacity="0.24" stroke="${colors.accent}" stroke-width="0.25"/>
<defs><linearGradient id="intensive-own-${tag}" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${colors.accent}"/><stop offset="1" stop-color="${colors.muted}"/></linearGradient></defs></svg>`);
    const other = (contour: string) => svgSource(`<svg width="120" height="40" viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="${contour}" fill="${colors.surface}" fill-opacity="0.92" stroke="${colors.muted}" stroke-opacity="0.55" stroke-width="0.25"/></svg>`);
    return {
      own: Object.fromEntries(spots.map(spot => [spot, own(OWN_CONTOURS[spot])])) as Record<BubbleSpot, { uri: string }>,
      other: Object.fromEntries(spots.map(spot => [spot, other(OTHER_CONTOURS[spot])])) as Record<BubbleSpot, { uri: string }>,
      icon: svgSource(`<svg width="44" height="42" viewBox="0 0 44 42" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="${ICON_CONTOUR}" stroke="${colors.accent}" stroke-width="0.25"/></svg>`),
      input: diaryArtwork('input', colors, true),
      prompt: diaryArtwork('prompt', colors),
    };
  }, [colors]);
}

/** The diary's icon contour with the person's initial; roles with a light hand get the accent outline. */
export function Avatar({ name, size = 44, accent = false }: { name: string; size?: number; accent?: boolean }) {
  const colors = useThemeColors();
  const height = Math.round(size * 42 / 44);
  const source = useMemo(() => svgSource(`<svg width="${size}" height="${height}" viewBox="0 0 ${size} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="${fitPanelPath(ICON_CONTOUR, 44, 42, size, height)}" fill="${colors.surface}" stroke="${accent ? colors.accent : colors.muted}" stroke-opacity="${accent ? 1 : .6}" stroke-width="${size >= 40 ? .5 : .75}"/></svg>`),
  [accent, colors.accent, colors.muted, colors.surface, height, size]);
  const letter = (name.trim()[0] ?? '·').toUpperCase();
  return <View accessible={false} style={{ width: size, height, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <Image pointerEvents="none" source={source} style={StyleSheet.absoluteFill} contentFit="contain" />
    <ProductText variant="title" color={accent ? colors.accent : colors.text} maxFontSize={Math.round(size * .42)}
      style={{ fontSize: Math.round(size * .4), lineHeight: Math.round(size * .5), fontWeight: '500' }}>{letter}</ProductText>
  </View>;
}

/** A square glass button like the diary's header button. */
export function GlassIconButton({ label, glyph, onPress, children, size }: {
  label: string; glyph?: GlyphName; onPress: () => void; children?: ReactNode; size?: { width: number; height: number };
}) {
  const { icon } = useProductLayout();
  const frames = useIntensiveFrames();
  const width = size?.width ?? icon.width, height = size?.height ?? icon.buttonHeight;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
    style={({ pressed }) => [{ width, height, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: .7 }]}>
    <DiaryGlass shape="icon" style={{ top: 1, bottom: 1 }} />
    <PanelArtwork source={frames.icon} style={{ top: 1, bottom: 1 }} />
    {glyph ? <Glyph name={glyph} size={Math.round(width * .45)} /> : children}
  </Pressable>;
}

/** A day or notice line between hairlines, as in the diary feed. */
export function DayRow({ label, accent = false }: { label: string; accent?: boolean }) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  const line = [styles.dayLine, accent && { backgroundColor: colors.accent }];
  return <View style={styles.dayRow} accessibilityRole="header">
    <View style={line} />
    <ProductText maxFontSize={10} style={[styles.day, accent && { color: colors.accent }]}>{label}</ProductText>
    <View style={line} />
  </View>;
}

/** The diary's text field: glass under the authored input frame. */
export function GlassField({ label, style, wrapStyle, right, ...props }: TextInputProps & { label?: string; wrapStyle?: StyleProp<ViewStyle>; right?: ReactNode }) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  const frames = useIntensiveFrames();
  return <View style={styles.fieldWrap}>
    {label ? <ProductText variant="label" maxFontSize={12} style={styles.fieldLabel}>{label}</ProductText> : null}
    <View style={[styles.field, wrapStyle]}>
      <DiaryGlass shape="input" /><PanelArtwork source={frames.input} />
      <TextInput placeholderTextColor={colors.faint} selectionColor={colors.accent} autoCorrect={false} spellCheck={false} {...props}
        style={[styles.input, props.multiline && styles.multiline, right ? { paddingRight: 46 } : null, style]} />
      {right ? <View style={styles.fieldRight}>{right}</View> : null}
    </View>
  </View>;
}

/** The diary's prompt plate: a framed hint with a glyph. */
export function Plate({ glyph, label, title, titleStyle, selectable = false, children, style }: {
  glyph?: GlyphName; label?: string; title: string; titleStyle?: StyleProp<TextStyle>; selectable?: boolean; children?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemeStyles(createStyles);
  const frames = useIntensiveFrames();
  return <View style={[styles.plate, style]}>
    <DiaryGlass shape="panel" /><PanelArtwork source={frames.prompt} />
    {glyph ? <Glyph name={glyph} size={28} /> : null}
    <View style={styles.plateCopy}>
      {label ? <ProductText maxFontSize={10} style={styles.caption}>{label}</ProductText> : null}
      <ProductText variant="title" selectable={selectable} style={[styles.plateTitle, titleStyle]}>{title}</ProductText>
      {children ? <ProductText maxFontSize={12} style={styles.plateText}>{children}</ProductText> : null}
    </View>
  </View>;
}

const contourSource = (width: number, height: number, fill: string, fillOpacity: number, stroke: string, strokeOpacity = 1, strokeWidth = .5) => svgSource(
  `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="${fitPanelPath(ICON_CONTOUR, 44, 42, width, height)}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"/></svg>`);

/** The diary's icon contour at a fixed size: corners stay whole, only the straight spans move. */
export function useContour(width: number, height: number, tone: 'plain' | 'pressed' | 'accent') {
  const colors = useThemeColors();
  return useMemo(() => tone === 'pressed' ? contourSource(width, height, colors.accent, .16, colors.accent)
    : tone === 'accent' ? contourSource(width, height, colors.surface, .5, colors.accent)
      : contourSource(width, height, colors.surface, .55, colors.muted, .6),
  [colors.accent, colors.muted, colors.surface, height, tone, width]);
}

/** A large glass icon that opens a screen, as Telegram's onboarding art does. */
export function Emblem({ glyph, size = 72 }: { glyph: GlyphName; size?: number }) {
  const height = Math.round(size * 42 / 44);
  const source = useContour(size, height, 'accent');
  return <View accessible={false} style={{ width: size, height, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <DiaryGlass shape="icon" />
    <Image pointerEvents="none" source={source} style={StyleSheet.absoluteFill} contentFit="contain" />
    <Glyph name={glyph} size={Math.round(size * .42)} />
  </View>;
}

/** Emblem, title and a few centred lines: the top of every entry screen. */
export function Hero({ glyph, title, lines = [], tight = false }: { glyph: GlyphName; title: string; lines?: string[]; tight?: boolean }) {
  const styles = useThemeStyles(createStyles);
  return <View style={[styles.hero, tight && styles.heroTight]}>
    <Emblem glyph={glyph} size={tight ? 60 : 72} />
    <ProductText variant="title" accessibilityRole="header" style={styles.heroTitle}>{title}</ProductText>
    {lines.map(line => <ProductText key={line} maxFontSize={12} style={styles.heroText}>{line}</ProductText>)}
  </View>;
}

/** A profile head as in Telegram settings: a large avatar, the name and quiet lines below. */
export function ProfileHead({ name, lines, accent = false, avatar = true }: { name: string; lines: string[]; accent?: boolean; avatar?: boolean }) {
  const styles = useThemeStyles(createStyles);
  return <View style={styles.profile}>
    {avatar ? <Avatar name={name} size={76} accent={accent} /> : null}
    <ProductText variant="title" selectable numberOfLines={2} style={styles.profileName}>{name}</ProductText>
    {lines.map(line => <ProductText key={line} selectable maxFontSize={12} style={styles.profileLine}>{line}</ProductText>)}
  </View>;
}

/** A question in the diary's bottom sheet, with the risky answer first. */
export function ConfirmSheet({ open, title, text, confirmLabel, busy = false, onConfirm, onClose }: {
  open: boolean; title: string; text: string; confirmLabel: string; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const styles = useThemeStyles(createStyles);
  const { settings } = useProduct();
  return <BottomSheet open={open} onClose={busy ? () => undefined : onClose} reducedMotion={settings.reducedMotion}>
    <DiaryDesignPanel title={title} onClose={onClose} closeDisabled={busy}
      footer={<View style={styles.sheetActions}>
        <ProductButton label={confirmLabel} onPress={onConfirm} disabled={busy} />
        <ProductButton label="ОТМЕНА" kind="outline" onPress={onClose} disabled={busy} />
      </View>}>
      <ProductText style={styles.sheetCopy}>{text}</ProductText>
    </DiaryDesignPanel>
  </BottomSheet>;
}

/** A settings-style list: rows separated by hairlines, a caption above. */
export function ListGroup({ caption, children, footer }: { caption?: string; children: ReactNode; footer?: string }) {
  const styles = useThemeStyles(createStyles);
  return <View style={styles.group}>
    {caption ? <ProductText maxFontSize={10} style={styles.caption}>{caption}</ProductText> : null}
    <View style={styles.groupBody}>{children}</View>
    {footer ? <ProductText maxFontSize={12} style={styles.groupFooter}>{footer}</ProductText> : null}
  </View>;
}

/** `checked` makes the row a switch for screen readers; the caller draws the toggle on the right. */
export function ListItem({ title, detail, glyph, avatar, right, onPress, tone = 'text', selected = false, checked, chevron = !!onPress && checked === undefined, last = false, accessibilityLabel }: {
  title: string; detail?: string; glyph?: GlyphName; avatar?: ReactNode; right?: ReactNode; onPress?: () => void;
  tone?: 'text' | 'accent' | 'error'; selected?: boolean; checked?: boolean; chevron?: boolean; last?: boolean; accessibilityLabel?: string;
}) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  const ink = tone === 'error' ? colors.error : tone === 'accent' ? colors.accent : colors.text;
  const role = checked !== undefined ? 'switch' : onPress ? 'button' : undefined;
  return <Pressable accessibilityRole={role} accessibilityLabel={accessibilityLabel} accessibilityState={role ? { selected, checked, disabled: !onPress } : undefined} disabled={!onPress} onPress={onPress}
    style={({ pressed }) => [styles.item, (pressed || selected) && { backgroundColor: colors.subtle }]}>
    {avatar ?? (glyph ? <View style={styles.itemGlyph}><Glyph name={glyph} size={20} color={tone === 'error' ? colors.error : colors.accent} /></View> : null)}
    <View style={[styles.itemBody, !last && styles.itemLine]}>
      <View style={styles.itemCopy}>
        <ProductText variant="title" numberOfLines={1} color={ink} style={styles.itemTitle}>{title}</ProductText>
        {detail ? <ProductText numberOfLines={2} maxFontSize={12} style={styles.itemDetail}>{detail}</ProductText> : null}
      </View>
      {right}
      {chevron ? <Glyph name="right" size={16} color={colors.faint} /> : null}
    </View>
  </Pressable>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  dayRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 12 },
  day: { fontSize: 8, lineHeight: 12, color: colors.muted, letterSpacing: 1.6 },
  dayLine: { height: .25, flex: 1, backgroundColor: colors.border },
  fieldWrap: { gap: 8 },
  fieldLabel: { color: colors.muted, fontSize: 8, lineHeight: 12, letterSpacing: 1.6 },
  field: { minHeight: 48, justifyContent: 'center', overflow: 'hidden' },
  input: {
    position: 'relative', zIndex: 1, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontFamily: fonts.title, fontSize: 16, lineHeight: 22,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}),
  },
  multiline: { minHeight: 112, textAlignVertical: 'top' },
  // The icon keeps the same inset from the edge as the text on the left.
  fieldRight: { position: 'absolute', right: 14, top: 0, bottom: 0, zIndex: 2, justifyContent: 'center' },
  plate: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  plateCopy: { flex: 1, minWidth: 0, gap: 6 },
  plateTitle: { fontSize: 14, lineHeight: 20 },
  plateText: { color: colors.muted, fontSize: 10, lineHeight: 17 },
  hero: { alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 8 },
  heroTight: { paddingTop: 0, paddingBottom: 0 },
  heroTitle: { fontSize: 20, lineHeight: 26, textAlign: 'center', marginTop: 6 },
  heroText: { fontSize: 10, lineHeight: 17, color: colors.muted, textAlign: 'center', maxWidth: 420 },
  profile: { alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 8 },
  profileName: { fontSize: 20, lineHeight: 26, textAlign: 'center', marginTop: 8 },
  profileLine: { fontSize: 8, lineHeight: 13, color: colors.muted, letterSpacing: .8, textAlign: 'center' },
  sheetActions: { gap: 12 },
  sheetCopy: { fontSize: 12, lineHeight: 20 },
  group: { gap: 8 },
  caption: { fontSize: 8, lineHeight: 12, letterSpacing: 1.6, color: colors.muted, paddingHorizontal: 2 },
  groupBody: { borderTopWidth: .25, borderBottomWidth: .25, borderColor: colors.border },
  groupFooter: { fontSize: 8, lineHeight: 13, color: colors.faint, paddingHorizontal: 2 },
  item: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 4 },
  itemGlyph: { width: 28, alignItems: 'center' },
  itemBody: { flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingRight: 6 },
  itemLine: { borderBottomWidth: .25, borderBottomColor: colors.border },
  itemCopy: { flex: 1, minWidth: 0, gap: 3 },
  itemTitle: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  itemDetail: { fontSize: 8, lineHeight: 13, color: colors.muted },
});
