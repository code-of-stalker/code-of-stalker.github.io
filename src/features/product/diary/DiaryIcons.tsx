import { Image } from 'expo-image';
import { useMemo } from 'react';
import { useThemeColors } from '../ProductTheme';
import { ObservationIcon } from '../ObservationControls';
import { diaryArtwork } from './diaryArtwork';
import { architecturePath, iconSource, notebookPath } from '../icon-source';

const assets = {
  calendar: require('../../../../assets/product/diary/calendar.svg'),
  sparkle: require('../../../../assets/product/diary/sparkle.svg'),
  info: require('../../../../assets/product/diary/info.svg'),
  collection: require('../../../../assets/product/diary/collection.svg'),
  chevron: require('../../../../assets/product/diary/chevron.svg'),
};
const sizes = { calendar: [24,24], sparkle: [32,32], info: [20,20], collection: [44,42], chevron: [7,7] } as const;
export function DiaryAsset({ name, dim = false, transparentBackground = false }: { name: keyof typeof assets; dim?: boolean; transparentBackground?: boolean }) {
  const colors = useThemeColors(), [width, height] = sizes[name];
  const themed = name === 'collection' || name === 'calendar';
  const source = useMemo(() => name === 'info' ? { uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="${colors.accent}" stroke-width=".75"/><circle cx="10" cy="6.25" r=".8" fill="${colors.accent}"/><path d="M8.75 9H10v5.5m-1.25 0h2.5" fill="none" stroke="${colors.accent}" stroke-width=".75" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}` } : themed ? diaryArtwork(name as 'collection' | 'calendar', colors, transparentBackground) : assets[name], [themed, name, colors, transparentBackground]);
  return <Image pointerEvents="none" testID={`diary-icon-${name}`} source={source} tintColor={themed || name === 'info' ? undefined : dim ? colors.faint : colors.accent} contentFit="contain" style={{ width, height, flexShrink: 0, opacity: themed && dim ? .5 : 1 }} />;
}
const paths = {
  filter: 'M3 4h18l-7 8v7l-4 2v-9Z',
  bookmark: 'M6 3h12v18l-6-4-6 4Z',
  pause: 'M8 5v14M16 5v14',
  stop: 'M6 6h12v12H6Z',
  plus: 'M4 12h16M12 4v16',
  send: 'M4 12h16m-6-6 6 6-6 6',
  rewind: 'M11 5 3 12l8 7ZM21 5l-8 7 8 7Z',
  fastForward: 'M3 5l8 7-8 7ZM13 5l8 7-8 7Z',
  sound: 'M3 9h4l5-5v16l-5-5H3ZM16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14',
  expand: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  stairs: 'M3 20v-6h6V9h6V4h6v16ZM9 14v6m6-11v11',
};
export type DiaryIconName = keyof typeof paths | 'lips' | 'play' | 'trash' | 'close';
export function DiaryIcon({ name, filled = false, size = 20 }: { name: DiaryIconName; filled?: boolean; size?: number }) {
  const colors = useThemeColors();
  const path = paths[name as keyof typeof paths];
  const source = useMemo(() => iconSource(path ?? '', colors.accent, size, '0 0 24 24', filled), [colors.accent, filled, path, size]);
  return path ? <Image pointerEvents="none" source={source} style={{ width: size, height: size }} contentFit="contain" /> : <ObservationIcon name={name as 'lips' | 'play' | 'trash' | 'close'} size={size} />;
}
export function DiaryEntryIcon({ kind }: { kind: 'architecture' | 'dynamics' | 'observation' }) {
  const colors = useThemeColors();
  const source = useMemo(() => iconSource(kind === 'architecture' ? architecturePath : kind === 'dynamics' ? paths.stairs : notebookPath, colors.accent, 16), [kind, colors.accent]);
  return <Image pointerEvents="none" testID={`diary-kind-icon-${kind}`} source={source} contentFit="contain" style={{ width: 16, height: 16, flexShrink: 0 }} />;
}
