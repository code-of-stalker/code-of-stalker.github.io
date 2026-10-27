import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { productLayout, useProductLayout, useProductSpacing } from '../layout';
import { SkeletonBlock } from './Skeleton';

export type SkeletonScreen = 'home' | 'levels' | 'practice' | 'diary' | 'settings';

/** The screen a path opens; the app shell's own entry follows the saved start. */
export function skeletonScreen(path: string, start: SkeletonScreen): SkeletonScreen {
  if (path.startsWith('/levels')) return 'levels';
  if (path.startsWith('/practice') || path.startsWith('/observation')) return 'practice';
  if (path.startsWith('/diary')) return 'diary';
  if (path.startsWith('/settings')) return 'settings';
  if (path.startsWith('/home')) return 'home';
  return start;
}

/** A bar standing in for one line of type: `size` is the font size, so the
 * bar takes the height of the capitals in the middle of the line box. */
function Line({ width, size, line = size * 1.4, style }: { width: DimensionValue; size: number; line?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: line, justifyContent: 'center', alignSelf: 'stretch' }, style]}><SkeletonBlock style={{ width, height: Math.round(size * .72) }} /></View>;
}
const Icon = () => { const size = useProductLayout().icon; return <SkeletonBlock corners="icon" style={{ width: size.width, height: size.height }} />; };
const Mark = ({ size = 14 }: { size?: number }) => <SkeletonBlock style={{ width: size, height: size }} />;
const Rule = () => <SkeletonBlock style={{ height: 1, width: '100%' }} />;

function TitledHeader({ right = true, subtitle = false }: { right?: boolean; subtitle?: boolean }) {
  const icon = useProductLayout().icon;
  return <View style={styles.titled}>
    <Icon />
    <View style={styles.titleCopy}>
      <Line width="74%" size={24} line={30} style={styles.centered} />
      {subtitle ? <Line width="58%" size={8} line={14} style={styles.centered} /> : <Line width="62%" size={24} line={30} style={styles.centered} />}
    </View>
    {right ? <Icon /> : <View style={{ width: icon.width }} />}
  </View>;
}

function Home({ gutter, inset, wide, large, columns, air }: Layout) {
  const title = large ? 36 : wide ? 32 : 24, cardTitle = large ? 28 : wide ? 24 : 20;
  return <View style={[styles.fill, { padding: gutter }]}>
    <View style={styles.homeHeader}>
      <View style={styles.fill}>
        <Line width="74%" size={title} line={title * 1.42} />
        <Line width="64%" size={wide ? 12 : 8} line={wide ? 14 : 10} style={{ marginTop: 8 }} />
      </View>
      <Icon />
    </View>
    <View style={[styles.fill, { gap: gutter, marginTop: gutter * air }, columns === 2 && styles.cardRow]}>
      {[0, 1].map(card => <View key={card} style={styles.fill}>
        <SkeletonBlock corners="card" style={StyleSheet.absoluteFill} />
        <Line width={38} size={wide ? 12 : 8} style={{ position: 'absolute', top: inset, left: inset }} />
        <View style={{ position: 'absolute', left: inset, right: inset + (large ? 40 : 28), bottom: inset, gap: 4 }}>
          {columns === 2 ? <Line width={card ? '62%' : '86%'} size={cardTitle} /> : <>
            <Line width="68%" size={cardTitle} />
            <Line width={card ? '46%' : '62%'} size={cardTitle} />
          </>}
          <Line width="40%" size={wide ? 12 : 8} line={14} />
        </View>
        <SkeletonBlock style={{ position: 'absolute', right: 16, bottom: 16, width: large ? 18 : 12, height: large ? 18 : 12 }} />
      </View>)}
    </View>
    <Line width="100%" size={wide ? 12 : 8} line={24} style={{ marginTop: (gutter + 8) * air }} />
  </View>;
}

function Levels({ gutter, inset, width, column, air }: Layout) {
  // The levels screen always opens one level, the first unless another was chosen.
  const content = Math.min(width, column) - gutter * 2, art = Math.max(150, content * 150 / 288);
  const body = Math.max(202, art + (width >= 375 ? 94 : 52));
  return <View style={styles.fill}>
    <View style={{ paddingTop: 16, paddingHorizontal: gutter }}><TitledHeader /></View>
    <View style={{ paddingHorizontal: gutter }}>
      <Line width="46%" size={16} line={18} style={{ marginTop: 24 * air, marginBottom: 16 * air }} />
      <View style={{ gap: 24 * air }}>
        {[0, 1, 2].map(level => <View key={level}>
          <SkeletonBlock corners="panel" style={StyleSheet.absoluteFill} />
          <View style={[styles.row, { height: level ? 62 : width >= 375 ? 58 : 52, paddingHorizontal: inset, gap: 13 }]}>
            <Line width={26} size={13} />
            <Line width={(['42%', '46%', '58%'] as const)[level]} size={20} style={styles.fill} />
            <SkeletonBlock style={{ width: 11, height: 2 }} />
          </View>
          {level ? null : <View style={{ height: body, paddingHorizontal: inset, paddingBottom: inset, justifyContent: 'flex-end', gap: 8 }}>
            <SkeletonBlock style={{ alignSelf: 'center', width: '58%', flex: 1, marginBottom: 12 }} />
            <Line width="92%" size={10} line={14} />
            <Line width="34%" size={10} line={14} />
            <SkeletonBlock style={{ height: 42 }} />
          </View>}
        </View>)}
      </View>
    </View>
  </View>;
}

function Diary({ gutter, inset }: Layout) {
  return <View style={[styles.fill, { padding: gutter }]}>
    <TitledHeader />
    <View style={[styles.row, { marginTop: 22, gap: 8 }]}>
      <Mark /><Line width="26%" size={16} style={styles.fill} />
      <SkeletonBlock corners="panel" style={{ width: '36%', height: 26 }} /><Mark />
    </View>
    <Rule />
    <View style={[styles.row, { height: 40, gap: 8 }]}><Mark /><Line width="42%" size={10} style={styles.fill} /><Mark size={10} /></View>
    <View style={{ gap: 12 }}>
      {[64, 104, 104].map((height, index) => <View key={index} style={{ height, padding: inset, gap: 8 }}>
        <SkeletonBlock corners="panel" style={StyleSheet.absoluteFill} />
        <Line width={index ? '30%' : '48%'} size={index ? 8 : 12} />
        <Line width={index ? '88%' : '56%'} size={10} />
        {index ? <Line width="64%" size={10} /> : null}
      </View>)}
    </View>
    <View style={styles.fill} />
    <View style={[styles.row, { gap: 12 }]}>
      <SkeletonBlock corners="panel" style={[styles.fill, { height: 48 }]} />
      <SkeletonBlock corners="icon" style={{ width: 48, height: 48 }} />
    </View>
    <Line width="44%" size={10} line={24} style={{ alignSelf: 'center', marginTop: 4 }} />
  </View>;
}

function Settings({ gutter }: Layout) {
  const option = (width: DimensionValue, key: number) => <View key={key} style={[styles.row, { height: 44, gap: 12 }]}><Mark /><Line width={width} size={14} style={styles.fill} /></View>;
  return <View style={styles.fill}>
    <View style={{ paddingTop: 16, paddingHorizontal: gutter, paddingBottom: 12 }}><TitledHeader right={false} subtitle /></View>
    <View style={{ paddingHorizontal: gutter, gap: 8 }}>
      <Rule />
      <View style={[styles.row, { height: 36, gap: 8 }]}><Mark /><Line width="18%" size={14} style={styles.fill} /></View>
      {(['30%', '26%', '24%', '30%', '34%', '28%', '32%'] as const).map(option)}
      <Rule />
      <View style={[styles.row, { height: 36, gap: 8 }]}><Mark /><Line width="62%" size={14} style={styles.fill} /></View>
      {(['32%', '78%', '30%'] as const).map(option)}
    </View>
  </View>;
}

function Practice({ gutter, inset, height }: Layout) {
  const paragraph = (widths: DimensionValue[], key: number) => <View key={key} style={{ gap: 2 }}>{widths.map((width, index) => <Line key={index} width={width} size={16} line={23} />)}</View>;
  return <View style={[styles.fill, { padding: gutter }]}>
    <View style={{ height: Math.round(height * .3), marginBottom: 6 }}>
      <SkeletonBlock style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, right: 0 }}><Icon /></View>
    </View>
    <View style={[styles.row, { height: 31, paddingHorizontal: inset }]}>
      <SkeletonBlock style={StyleSheet.absoluteFill} />
      <Line width="62%" size={16} style={styles.fill} />
    </View>
    <View style={[styles.fill, { marginTop: 9, padding: inset, paddingTop: inset + 18, gap: 14 }]}>
      <SkeletonBlock corners="panel" style={StyleSheet.absoluteFill} />
      {paragraph(['88%', '94%', '90%', '38%'], 0)}
      {paragraph(['92%', '52%'], 1)}
      <SkeletonBlock style={{ alignSelf: 'center', width: '64%', flexGrow: 1, maxHeight: 130, marginVertical: 16 }} />
      {paragraph(['96%', '72%', '40%'], 2)}
    </View>
  </View>;
}

type Layout = { gutter: number; inset: number; wide: boolean; large: boolean; width: number; height: number; column: number; columns: 1 | 2; air: number };
const screens: Record<SkeletonScreen, (layout: Layout) => ReactNode> = { home: Home, levels: Levels, practice: Practice, diary: Diary, settings: Settings };

/** The place of a whole screen while the app and its graphics engine load:
 * the same safe area, width and spacing as ProductScreen, in still shapes. */
export function ScreenSkeleton({ screen }: { screen: SkeletonScreen }) {
  const { width, height } = useWindowDimensions(), { gutter, inset } = useProductSpacing();
  const sizes = productLayout(width, height), maxWidth = screen === 'home' ? sizes.wide : sizes.column;
  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.fill}>
    <View style={[styles.column, { maxWidth }]}>{screens[screen]({ gutter, inset, wide: width >= 375, large: sizes.kind !== 'phone', width, height, column: sizes.column, columns: sizes.columns, air: sizes.air })}</View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  column: { flex: 1, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  cardRow: { flexDirection: 'row' },
  homeHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 52 },
  titled: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, gap: 8 },
  titleCopy: { flex: 1 },
  centered: { alignItems: 'center' },
});
