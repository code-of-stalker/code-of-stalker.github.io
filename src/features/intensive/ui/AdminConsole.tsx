import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';

import { DiaryDesignPanel } from '../../product/diary/DiaryDesignPanel';
import { DiaryGlass } from '../../product/diary/DiaryGlass';
import { useProductLayout, useProductSpacing } from '../../product/layout';
import { BottomSheet } from '../../product/motion/BottomSheet';
import { PanelArtwork } from '../../product/motion/PanelArtwork';
import { PanelBorder } from '../../product/PanelBorder';
import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import { useProduct } from '../../product/state/ProductProvider';
import type { ProductColors } from '../../product/theme';
import { ProductButton, ProductText } from '../../product/ui';
import type { DirectoryEntry, Place } from '../backend';
import type { IntensiveSession } from '../session';
import { shortCode } from '../session';
import type { GlyphName } from './chrome';
import { GlassField, Glyph, ListGroup, ListItem, useRoleInks } from './chrome';
import { Chip, formatTime, Note, problemText, Skeleton, Tabs } from './parts';
import { Appear } from '../../product/motion/Appear';
import { isStaff, PersonCard, plain, RoleTags, waitedFor } from './PersonCard';
import { RoleMark } from './RoleMark';

type Tab = 'walkers' | 'team';
type FilterId = 'all' | 'waiting' | 'unguided' | 'blocked' | 'guides' | 'admins';
type Filter = { id: FilterId; label: string; test: (entry: DirectoryEntry) => boolean; alert?: boolean };
type Move = { phase: 'pick' } | { phase: 'moving'; done: number; total: number } | { phase: 'done'; text: string; failed: boolean };
type Tone = 'text' | 'muted' | 'accent' | 'error';
/** React Native Web reports hover to Pressable styles; the native types only know `pressed`. */
type Pointer = PressableStateCallbackType & { hovered?: boolean };

const REFRESH_MS = 30_000;
const QUEUE_SIZE = 5;
// The prompt plate's contour from the diary, with an opaque fill so the panes read over the backdrop.
/**
 * The diary's table contour cuts the top right and bottom left corners. Side by side the two
 * panes read as one frame, so the corners that face each other stay square.
 */
type Cut = 'both' | 'bottomLeft' | 'topRight';
const TABLE_CONTOURS: Record<Cut, string> = {
  both: 'M275.947 .125L287.875 12.0527V63.875H12.0527L.125 51.9473V.125Z',
  bottomLeft: 'M287.875 .125V63.875H12.0527L.125 51.9473V.125Z',
  topRight: 'M275.947 .125L287.875 12.0527V63.875H.125V.125Z',
};

const filterSets: Record<Tab, Filter[]> = {
  walkers: [
    { id: 'all', label: 'ВСЕ', test: () => true },
    { id: 'waiting', label: 'ЖДУТ ОТВЕТА', test: entry => !!entry.waitingSince && !entry.blocked, alert: true },
    { id: 'unguided', label: 'БЕЗ ПРОВОДНИКА', test: entry => !entry.guideId && !entry.blocked, alert: true },
    { id: 'blocked', label: 'ДОСТУП ЗАКРЫТ', test: entry => entry.blocked },
  ],
  team: [
    { id: 'all', label: 'ВСЯ КОМАНДА', test: () => true },
    { id: 'guides', label: 'ПРОВОДНИКИ', test: entry => entry.roles.includes('guide') },
    { id: 'admins', label: 'АДМИНЫ', test: entry => entry.mainAdmin || entry.roles.includes('admin') },
  ],
};

/** Who needs Yana first: the longest wait, then new people without a guide, then recent chats. */
function walkerOrder(a: DirectoryEntry, b: DirectoryEntry) {
  const rank = (entry: DirectoryEntry) => entry.blocked ? 3 : entry.waitingSince ? 0 : !entry.guideId ? 1 : 2;
  const difference = rank(a) - rank(b);
  if (difference) return difference;
  if (rank(a) === 0) return a.waitingSince!.localeCompare(b.waitingSince!);
  if (rank(a) === 1) return a.createdAt.localeCompare(b.createdAt);
  if (rank(a) === 2) return (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '');
  return a.name.localeCompare(b.name, 'ru');
}

/** One state per walker, the one Yana acts on: a closed account cannot be answered, so its wait does not count. */
function walkerState(entry: DirectoryEntry, now: number): { label: string; tone: Tone; glyph?: GlyphName; notable: boolean } {
  if (entry.blocked) return { label: 'ДОСТУП ЗАКРЫТ', tone: 'error', glyph: 'lock', notable: true };
  if (entry.waitingSince) return { label: `ЖДЁТ ${waitedFor(entry.waitingSince, now)}`, tone: 'accent', glyph: 'clock', notable: true };
  if (!entry.guideId) return { label: 'НУЖЕН ПРОВОДНИК', tone: 'accent', glyph: 'person', notable: true };
  return { label: entry.lastMessageAt ? 'НА СВЯЗИ' : 'НЕТ СООБЩЕНИЙ', tone: 'muted', notable: false };
}

function useTableFrame(cut: Cut) {
  const colors = useThemeColors();
  return useMemo(() => {
    const tag = colors.accent.replace('#', ''), contour = TABLE_CONTOURS[cut];
    return { uri: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg width="288" height="64" viewBox="0 0 288 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="${contour}" fill="${colors.background}" fill-opacity="0.9"/>
<path d="${contour}" fill="url(#intensive-table-${tag})" fill-opacity="0.08" stroke="${colors.accent}" stroke-width="0.25"/>
<defs><linearGradient id="intensive-table-${tag}" x1="0" y1="32" x2="288" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="${colors.accent}"/><stop offset="1" stop-color="${colors.muted}"/></linearGradient></defs></svg>`) };
  }, [colors, cut]);
}

/** A framed pane: the diary contour fitted to its content, corners kept whole. */
function Framed({ children, style, cut = 'both' }: { children: ReactNode; style?: StyleProp<ViewStyle>; cut?: Cut }) {
  const frame = useTableFrame(cut);
  return <View style={[{ position: 'relative' }, style]}>
    <PanelArtwork source={frame} />
    {children}
  </View>;
}

/** A plain square check box, filled with the accent tint when picked. */
function CheckBox({ checked, label, onPress, mixed = false }: { checked: boolean; label: string; onPress: () => void; mixed?: boolean }) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  const on = checked || mixed;
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: mixed ? 'mixed' : checked }} onPress={onPress} hitSlop={10}
    style={(state: Pointer) => [styles.check, on && styles.checkOn, state.hovered && { borderColor: colors.accent }, state.pressed && { opacity: .7 }]}>
    {checked ? <Glyph name="check" size={11} /> : mixed ? <View style={styles.checkMixed} /> : null}
  </Pressable>;
}

/** A filter as the diary's filter choices: the chosen one filled with the accent, its text dark (Art 2026-11-12). */
/** `mark` puts a role's mark right of the text, as the chat does after a role. */
function Cell({ children, flex, tone = 'text', align = 'left', title = false, detail, mark }: {
  children: ReactNode; flex: number; tone?: Tone; align?: 'left' | 'right'; title?: boolean; detail?: string; mark?: { role: Place; ink: string };
}) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  const color = tone === 'accent' ? colors.accent : tone === 'error' ? colors.error : tone === 'muted' ? colors.muted : colors.text;
  const text = <ProductText variant={title ? 'title' : 'body'} numberOfLines={1} maxFontSize={title ? 15 : 12}
    style={[title ? styles.cellTitle : styles.cellText, { color, textAlign: align }, mark && styles.cellShrink]}>{children}</ProductText>;
  return <View style={[styles.cell, { flex }]}>
    {mark ? <View style={styles.cellLine}>{text}<RoleMark role={mark.role} ink={mark.ink} /></View> : text}
    {detail ? <ProductText numberOfLines={1} maxFontSize={11} style={[styles.cellDetail, { textAlign: align }]}>{detail}</ProductText> : null}
  </View>;
}

function StateCell({ label, tone, glyph, flex }: { label: string; tone: Tone; glyph?: GlyphName; flex?: number }) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  const color = tone === 'accent' ? colors.accent : tone === 'error' ? colors.error : tone === 'muted' ? colors.faint : colors.text;
  return <View style={[styles.state, flex !== undefined ? { flex } : styles.stateFit]}>
    {glyph ? <Glyph name={glyph} size={14} color={color} /> : null}
    <ProductText numberOfLines={1} maxFontSize={12} style={[styles.stateText, { color }]}>{label}</ProductText>
  </View>;
}

function HeadCell({ children, flex, align = 'left' }: { children?: ReactNode; flex: number; align?: 'left' | 'right' }) {
  const styles = useThemeStyles(createStyles);
  return <View style={[styles.cell, { flex }]}><ProductText numberOfLines={1} maxFontSize={11} style={[styles.headText, { textAlign: align }]}>{children}</ProductText></View>;
}

/** A table row: a hover tint on the web, the chosen one marked with the accent line on its left. */
function Row({ on, hovered, last, children, style }: { on: boolean; hovered: boolean; last: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  return <View style={[styles.row, !last && styles.rowLine, style]}>
    {on || hovered ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.subtle, opacity: on ? 1 : .55 }]} /> : null}
    {on ? <View pointerEvents="none" style={styles.rowMark} /> : null}
    {children}
  </View>;
}

export function AdminConsole({ session, onOpenChat }: { session: IntensiveSession; onOpenChat: (chatId: string) => void }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const inks = useRoleInks();
  const { gutter } = useProductSpacing();
  const { settings } = useProduct();
  const wide = useProductLayout().columns === 2;
  const roomy = useWindowDimensions().width >= 1200;
  const sideWidth = roomy ? 400 : 340;
  const [directory, setDirectory] = useState<DirectoryEntry[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('walkers');
  const [filter, setFilter] = useState<FilterId>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [move, setMove] = useState<Move | null>(null);

  const [version, setVersion] = useState(0), [loadedVersion, setLoadedVersion] = useState(-1);
  const load = () => setVersion(current => current + 1);
  useEffect(() => {
    let alive = true;
    session.directory().then(
      list => { if (alive) { setDirectory(list); setLoadedAt(Date.now()); setError(''); setLoadedVersion(version); } },
      problem => { if (alive) { setError(problemText(problem, 'Не удалось загрузить список людей.', true)); setLoadedVersion(version); } });
    return () => { alive = false; };
  }, [session, version]);
  // Waiting times and new messages stay current while the page is open.
  useEffect(() => {
    const timer = setInterval(() => setVersion(current => current + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const byId = useMemo(() => new Map((directory ?? []).map(entry => [entry.userId, entry])), [directory]);
  if (!directory) return <View style={styles.stack}>{error ? <Note tone="error">{error}</Note> : <Skeleton rows={6} label="Загружаю людей…" />}</View>;

  const walkers = directory.filter(entry => !isStaff(entry)).sort(walkerOrder);
  const team = directory.filter(isStaff).sort((a, b) => Number(b.mainAdmin) - Number(a.mainAdmin) || a.name.localeCompare(b.name, 'ru'));
  const guides = team.filter(entry => entry.roles.includes('guide') && !entry.blocked);
  const guideLoad = (guideId: string) => {
    const own = walkers.filter(entry => entry.guideId === guideId && !entry.blocked);
    return { walkers: own.length, waiting: own.filter(entry => entry.waitingSince).length };
  };
  const base = tab === 'walkers' ? walkers : team;
  const filters = filterSets[tab];
  const counts = Object.fromEntries(filters.map(item => [item.id, base.filter(item.test).length])) as Record<FilterId, number>;
  const needle = plain(query.trim());
  const matches = (entry: DirectoryEntry) => !needle || plain(entry.name).includes(needle) || plain(shortCode(entry.userId)).includes(needle);
  const activeFilter = filters.find(item => item.id === filter) ?? filters[0];
  const rows = base.filter(entry => activeFilter.test(entry) && matches(entry));
  const person = selected ? byId.get(selected) : undefined;
  const pickedRows = [...picked].map(id => byId.get(id)).filter((entry): entry is DirectoryEntry => !!entry);
  const allPicked = tab === 'walkers' && rows.length > 0 && rows.every(entry => picked.has(entry.userId));
  const somePicked = tab === 'walkers' && rows.some(entry => picked.has(entry.userId));
  const refreshing = loadedVersion < version;

  const togglePick = (userId: string) => setPicked(current => {
    const next = new Set(current);
    if (!next.delete(userId)) next.add(userId);
    return next;
  });
  const pickAll = () => setPicked(allPicked ? new Set() : new Set(rows.map(entry => entry.userId)));
  const changeView = (nextTab: Tab, nextFilter: FilterId = 'all') => {
    setTab(nextTab); setFilter(nextFilter); setPicked(new Set());
  };
  const open = (userId: string) => setSelected(current => wide && current === userId ? null : userId);
  const hover = (userId: string) => ({
    onHoverIn: () => setHovered(userId),
    onHoverOut: () => setHovered(current => current === userId ? null : current),
  });

  async function moveTo(guide: DirectoryEntry) {
    const targets = pickedRows.filter(entry => entry.guideId !== guide.userId);
    const failed: DirectoryEntry[] = [];
    setMove({ phase: 'moving', done: 0, total: targets.length });
    for (const [index, walker] of targets.entries()) {
      try { await session.assignGuide(walker.userId, guide.userId); }
      catch (problem) { failed.push(walker); problemText(problem, undefined, true); }
      setMove({ phase: 'moving', done: index + 1, total: targets.length });
    }
    // Whoever did not move stays picked, so one more press retries just them.
    setPicked(new Set(failed.map(entry => entry.userId)));
    setMove(failed.length
      ? { phase: 'done', failed: true, text: `Не получилось перевести: ${failed.map(entry => entry.name).join(', ')}. Проверьте интернет и попробуйте ещё раз.` }
      : { phase: 'done', failed: false, text: `Готово. Проводник ${guide.name} ведёт выбранных идущих (${pickedRows.length}) и видит их переписку.` });
    load();
  }

  const card = person ? <PersonCard key={person.userId} session={session} person={person} directory={directory} avatars={false} onChanged={load} onOpenChat={onOpenChat}
    onBack={wide ? undefined : () => setSelected(null)} /> : null;
  if (card && !wide) return card;

  // ------------------------------------------------------------- rows

  const walkerRow = (entry: DirectoryEntry, index: number) => {
    const guide = entry.guideId ? byId.get(entry.guideId) : undefined;
    const admin = guide?.adminId ? byId.get(guide.adminId) : undefined;
    const state = walkerState(entry, loadedAt);
    const time = entry.lastMessageAt ? formatTime(entry.lastMessageAt) : '';
    return <Row key={entry.userId} on={selected === entry.userId} hovered={hovered === entry.userId} last={index === rows.length - 1}>
      <View style={styles.checkCell}><CheckBox checked={picked.has(entry.userId)} label={`Выбрать: ${entry.name}`} onPress={() => togglePick(entry.userId)} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Открыть: ${entry.name}`} onPress={() => open(entry.userId)} {...hover(entry.userId)}
        style={({ pressed }) => [styles.rowBody, pressed && { opacity: .7 }]}>
        <View style={[styles.nameCell, { flex: wide ? 1.8 : 1 }]}>
          <View style={styles.nameCopy}>
            <ProductText variant="title" numberOfLines={1} maxFontSize={16} style={styles.name}>{entry.name}</ProductText>
            {wide ? <ProductText numberOfLines={1} maxFontSize={11} style={styles.code}>{`КОД ${shortCode(entry.userId)}`}</ProductText>
              : state.notable ? <StateCell label={state.label} tone={state.tone} glyph={state.glyph} />
                : guide ? <View style={styles.cellLine}>
                  <ProductText numberOfLines={1} maxFontSize={11} style={[styles.code, styles.cellShrink]}>{`ПРОВОДНИК: ${guide.name}`}</ProductText>
                  <RoleMark role="guide" ink={inks.guide} size={12} />
                </View>
                  : <ProductText numberOfLines={1} maxFontSize={11} style={styles.code}>{`КОД ${shortCode(entry.userId)}`}</ProductText>}
          </View>
        </View>
        {wide ? <>
          <Cell flex={1.4} title tone={guide ? 'text' : 'accent'} detail={guide ? `АДМИН: ${admin?.name ?? 'НЕТ'}` : undefined}
            mark={guide ? { role: 'guide', ink: inks.guide } : undefined}>{guide?.name ?? 'Не назначен'}</Cell>
          <StateCell flex={1.7} label={state.label} tone={state.tone} glyph={state.glyph} />
          <Cell flex={1.1} tone="muted" align="right">{time || '—'}</Cell>
        </> : time && !entry.waitingSince ? <ProductText maxFontSize={11} style={styles.time}>{time}</ProductText> : null}
        <Glyph name="right" size={16} color={colors.faint} />
      </Pressable>
    </Row>;
  };

  const teamRow = (entry: DirectoryEntry, index: number) => {
    const isGuide = entry.roles.includes('guide');
    const admin = entry.adminId ? byId.get(entry.adminId) : undefined;
    const own = isGuide ? guideLoad(entry.userId) : null;
    return <Row key={entry.userId} on={selected === entry.userId} hovered={hovered === entry.userId} last={index === rows.length - 1}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Открыть: ${entry.name}`} onPress={() => open(entry.userId)} {...hover(entry.userId)}
        style={({ pressed }) => [styles.rowBody, styles.teamBody, pressed && { opacity: .7 }]}>
        <View style={[styles.nameCell, { flex: wide ? 1.8 : 1 }]}>
          <View style={styles.nameCopy}>
            <ProductText variant="title" numberOfLines={1} maxFontSize={16} style={styles.name}>{entry.name}</ProductText>
            {entry.blocked ? <StateCell label="ДОСТУП ЗАКРЫТ" tone="error" glyph="lock" />
              : wide ? <ProductText numberOfLines={1} maxFontSize={11} style={styles.code}>{`КОД ${shortCode(entry.userId)}`}</ProductText> : <RoleTags entry={entry} />}
          </View>
        </View>
        {wide ? <>
          <View style={[styles.cell, { flex: 2 }]}>
            <RoleTags entry={entry} />
            {isGuide ? <ProductText numberOfLines={1} maxFontSize={11} style={styles.cellDetail}>{`АДМИН: ${admin?.name ?? 'НЕТ'}`}</ProductText> : null}
          </View>
          <Cell flex={.8} title tone={own ? 'text' : 'muted'} align="right">{own ? own.walkers : '—'}</Cell>
          <Cell flex={.9} title tone={own?.waiting ? 'accent' : 'muted'} align="right">{own ? own.waiting : '—'}</Cell>
        </> : own?.waiting ? <StateCell label={`ЖДУТ ${own.waiting}`} tone="accent" glyph="clock" /> : null}
        <Glyph name="right" size={16} color={colors.faint} />
      </Pressable>
    </Row>;
  };

  const head = wide ? <View style={[styles.row, styles.head]}>
    {tab === 'walkers' ? <View style={styles.checkCell}><CheckBox checked={allPicked} mixed={!allPicked && somePicked} label="Выбрать всех в списке" onPress={pickAll} /></View> : null}
    <View style={[styles.headBody, tab === 'team' && styles.teamBody]}>
      <HeadCell flex={1.8}>{tab === 'walkers' ? 'ИДУЩИЙ' : 'ЧЕЛОВЕК'}</HeadCell>
      {tab === 'walkers' ? <>
        <HeadCell flex={1.4}>ПРОВОДНИК</HeadCell>
        <HeadCell flex={1.7}>СОСТОЯНИЕ</HeadCell>
        <HeadCell flex={1.1} align="right">ПОСЛЕДНЕЕ</HeadCell>
      </> : <>
        <HeadCell flex={2}>ПРАВА</HeadCell>
        <HeadCell flex={.8} align="right">ИДУЩИХ</HeadCell>
        <HeadCell flex={.9} align="right">ЖДУТ ОТВЕТА</HeadCell>
      </>}
      <View style={{ width: 16 }} />
    </View>
  </View> : tab === 'walkers' && rows.length ? <View style={[styles.row, styles.head, styles.rowLine]}>
    <View style={styles.checkCell}><CheckBox checked={allPicked} mixed={!allPicked && somePicked} label="Выбрать всех в списке" onPress={pickAll} /></View>
    <HeadCell flex={1}>{allPicked ? 'ВЫБРАНЫ ВСЕ' : 'ВЫБРАТЬ ВСЕХ'}</HeadCell>
  </View> : null;

  const emptyText = needle ? 'Никого не нашлось.' : tab === 'team' ? 'В команде пока никого.' : filter === 'waiting' ? 'Все получили ответ.' : 'Здесь пока никого.';
  const tableRows = rows.length ? rows.map(tab === 'walkers' ? walkerRow : teamRow) : <View style={styles.empty}><Note center>{emptyText}</Note></View>;

  // ------------------------------------------------------------- controls

  const chips = <View accessibilityRole="tablist" style={styles.chips}>
    {filters.map(item => <Chip key={item.id} label={item.label} count={counts[item.id]} on={item.id === activeFilter.id} alert={item.alert}
      onPress={() => { setFilter(item.id); setPicked(new Set()); }} />)}
  </View>;
  const bulk = <View style={[styles.bulk, !wide && styles.bulkNarrow]}>
    <DiaryGlass /><PanelBorder color={colors.accent} />
    <ProductText variant="label" maxFontSize={13} style={styles.bulkText}>{`ВЫБРАНО ${pickedRows.length}`}</ProductText>
    <View style={styles.bulkActions}>
      <ProductButton label="ПЕРЕВЕСТИ К ПРОВОДНИКУ" onPress={() => setMove({ phase: 'pick' })} style={styles.bulkButton} />
      <ProductButton label="СНЯТЬ ВЫБОР" kind="ghost" onPress={() => setPicked(new Set())} />
    </View>
  </View>;
  const refresh = <Pressable accessibilityRole="button" accessibilityLabel="Обновить список" onPress={load} disabled={refreshing} hitSlop={6}
    style={(state: Pointer) => [styles.refresh, state.hovered && { backgroundColor: colors.subtle }, state.pressed && { opacity: .7 }]}>
    <Glyph name="refresh" size={16} color={refreshing ? colors.faint : colors.accent} />
    <ProductText numberOfLines={1} maxFontSize={11} style={styles.refreshText}>
      {refreshing ? 'ОБНОВЛЯЮ…' : `ОБНОВЛЕНО ${formatTime(new Date(loadedAt).toISOString())}`}
    </ProductText>
  </Pressable>;
  const tabs = <Tabs fit value={tab} onChange={value => { changeView(value); setSelected(null); }} options={[
    { id: 'walkers', label: `ИДУЩИЕ ${walkers.length}` },
    { id: 'team', label: `КОМАНДА ${team.length}` },
  ]} />;
  const search = <GlassField value={query} onChangeText={setQuery} placeholder="Имя или код" accessibilityLabel="Поиск по имени или коду"
    autoCapitalize="none" returnKeyType="search" right={<Glyph name="search" size={18} color={colors.muted} />} />;

  const moveSheet = <BottomSheet open={move !== null} onClose={() => { if (move?.phase !== 'moving') setMove(null); }} reducedMotion={settings.reducedMotion}>
    <DiaryDesignPanel title={move?.phase === 'done' ? move.failed ? 'НЕ ВСЕ ПЕРЕВЕДЕНЫ' : 'ПЕРЕВЕДЕНЫ' : move?.phase === 'moving' ? `ПЕРЕВОЖУ: ${move.total}` : `ПЕРЕВЕСТИ: ${pickedRows.length}`} onClose={() => setMove(null)} closeDisabled={move?.phase === 'moving'}
      footer={move?.phase === 'done' ? <ProductButton label="ГОТОВО" onPress={() => setMove(null)} />
        : <ProductButton label="ОТМЕНА" kind="outline" onPress={() => setMove(null)} disabled={move?.phase === 'moving'} />}>
      {move?.phase === 'moving' ? <Note center tone="text">{`Переношу ${move.done} из ${move.total}…`}</Note>
        : move?.phase === 'done' ? <Note tone={move.failed ? 'error' : 'text'}>{move.text}</Note>
          : <ListGroup caption="К КАКОМУ ПРОВОДНИКУ" footer="Переписка остаётся у идущего: новый проводник увидит всю историю, прежний теряет доступ.">
            {guides.length ? guides.map((guide, index) => {
              const own = guideLoad(guide.userId);
              return <ListItem key={guide.userId} title={guide.name}
                detail={`ИДУЩИХ ${own.walkers}${own.waiting ? ` · ЖДУТ ОТВЕТА ${own.waiting}` : ''}`}
                onPress={() => { void moveTo(guide); }} last={index === guides.length - 1} />;
            }) : <ListItem glyph="people" title="Проводников пока нет" detail="Дайте права проводника кому-нибудь из команды" last />}
          </ListGroup>}
    </DiaryDesignPanel>
  </BottomSheet>;

  // ------------------------------------------------------------- phone and narrow windows

  if (!wide) return <View style={styles.stack}>
    {tabs}
    {search}
    {/* The filters run to the screen's edges: the first lines up with the page, the rest slide off the glass (Art 2026-11-12). */}
    {tab === 'walkers' && pickedRows.length ? bulk :
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter }}>{chips}</ScrollView>}
    <Appear key={tab}><Framed style={styles.table}>{head}{tableRows}</Framed></Appear>
    <View style={styles.footer}>{refresh}</View>
    {error ? <Note tone="error">{error}</Note> : null}
    {moveSheet}
  </View>;

  // ------------------------------------------------------------- wide: list and card side by side

  const queue = walkers.filter(entry => entry.waitingSince && !entry.blocked);
  const fresh = walkers.filter(entry => !entry.guideId && !entry.blocked);
  const overview = <View style={styles.stack}>
    <ListGroup card caption={`ЖДУТ ОТВЕТА · ${queue.length}`}>
      {queue.length ? queue.slice(0, QUEUE_SIZE).map((entry, index) => {
        const guide = entry.guideId ? byId.get(entry.guideId) : undefined;
        return <ListItem key={entry.userId} title={entry.name}
          detail={`${waitedFor(entry.waitingSince!, loadedAt)} · ${guide ? `ПРОВОДНИК ${guide.name}` : 'БЕЗ ПРОВОДНИКА'}`}
          right={<Glyph name="clock" size={16} />} onPress={() => setSelected(entry.userId)} last={index === Math.min(queue.length, QUEUE_SIZE) - 1 && queue.length <= QUEUE_SIZE} />;
      }) : <ListItem glyph="check" title="Всем ответили" detail="СООБЩЕНИЙ БЕЗ ОТВЕТА НЕТ" last />}
      {queue.length > QUEUE_SIZE ? <ListItem glyph="clock" tone="accent" title={`Показать всех: ${queue.length}`} onPress={() => changeView('walkers', 'waiting')} last /> : null}
    </ListGroup>
    {fresh.length ? <ListGroup card caption={`НОВЫЕ БЕЗ ПРОВОДНИКА · ${fresh.length}`} footer="Откройте человека и назначьте ему проводника.">
      {fresh.slice(0, QUEUE_SIZE).map((entry, index) => <ListItem key={entry.userId} title={entry.name}
        detail={`КОД ${shortCode(entry.userId)} · С ${formatTime(entry.createdAt)}`} onPress={() => setSelected(entry.userId)}
        last={index === Math.min(fresh.length, QUEUE_SIZE) - 1} />)}
    </ListGroup> : null}
    <ListGroup card caption="ПРОВОДНИКИ">
      {guides.length ? guides.map((guide, index) => {
        const own = guideLoad(guide.userId);
        return <ListItem key={guide.userId} title={guide.name}
          detail={`ИДУЩИХ ${own.walkers}${own.waiting ? ` · ЖДУТ ОТВЕТА ${own.waiting}` : ''}`}
          onPress={() => setSelected(guide.userId)} last={index === guides.length - 1} />;
      }) : <ListItem glyph="people" title="Проводников пока нет" detail="Дайте права проводника кому-нибудь из людей" last />}
    </ListGroup>
    <ProductText maxFontSize={13} style={styles.hint}>Откройте человека в списке, чтобы назначить проводника или изменить права. Отметьте нескольких идущих, чтобы перевести их разом.</ProductText>
  </View>;

  // The search sits over the list it searches (Art 2026-11-12), the filters right under it.
  return <View style={styles.workspace}>
    <View style={styles.toolbar}>
      <View style={styles.tabsWide}>{tabs}</View>
      <View style={styles.refreshWide}>{refresh}</View>
    </View>
    <View style={styles.split}>
      <View style={styles.listColumn}>
        {search}
        {tab === 'walkers' && pickedRows.length ? bulk : chips}
        <Framed cut="bottomLeft" style={styles.pane}>
          {head}
          <ScrollView style={styles.paneScroll} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {tableRows}
          </ScrollView>
        </Framed>
      </View>
      <Framed cut="topRight" style={[styles.pane, styles.side, { width: sideWidth }]}>
        <View style={styles.paneHead}>
          <ProductText variant="label" numberOfLines={1} maxFontSize={12} style={styles.paneCaption}>
            {person ? isStaff(person) ? 'В КОМАНДЕ' : 'ИДУЩИЙ' : 'ОБЗОР'}
          </ProductText>
          {person ? <Pressable accessibilityRole="button" accessibilityLabel="Закрыть карточку" onPress={() => setSelected(null)} hitSlop={8}
            style={(state: Pointer) => [styles.paneClose, state.hovered && { backgroundColor: colors.subtle }, state.pressed && { opacity: .7 }]}>
            <Glyph name="close" size={18} color={colors.muted} />
          </Pressable> : null}
        </View>
        <ScrollView style={styles.paneScroll} contentContainerStyle={styles.sideContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {card ?? overview}
        </ScrollView>
      </Framed>
    </View>
    {error ? <Note tone="error">{error}</Note> : null}
    {moveSheet}
  </View>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  stack: { gap: 20 },
  workspace: { flex: 1, minHeight: 0, gap: 16 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  tabsWide: { flexShrink: 0, minWidth: 320 },
  refreshWide: { marginLeft: 'auto' },
  listColumn: { flex: 1, minWidth: 0, minHeight: 0, gap: 12 },
  // The chips and the bulk bar share one height, so the panes below stay put when people are picked.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 48, alignItems: 'center' },
  bulk: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingLeft: 16, paddingRight: 4, backgroundColor: colors.subtle },
  bulkNarrow: { flexDirection: 'column', alignItems: 'stretch', paddingVertical: 10, paddingRight: 16 },
  bulkText: { color: colors.accent, letterSpacing: 1.2 },
  bulkActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  bulkButton: { paddingHorizontal: 18 },
  refresh: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  refreshText: { fontSize: 9, lineHeight: 13, letterSpacing: .8, color: colors.muted },
  split: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 20 },
  // Rows run from frame to frame: a picked row's tint has no gaps at its sides (Art 2026-11-12).
  pane: { flex: 1, minWidth: 0, minHeight: 0, paddingVertical: 4 },
  // `flex: 0` on the web sets a zero basis that beats the width, so the side pane says it plainly.
  side: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  paneScroll: { flex: 1, minHeight: 0 },
  listContent: { paddingBottom: 12 },
  paneHead: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingLeft: 16, paddingRight: 8,
    borderBottomWidth: .25, borderBottomColor: colors.border },
  paneCaption: { fontSize: 9, lineHeight: 13, letterSpacing: 1.6, color: colors.muted, flexShrink: 1 },
  paneClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sideContent: { padding: 16, paddingBottom: 24 },
  table: { paddingVertical: 4 },
  head: { minHeight: 44, borderBottomWidth: .25, borderBottomColor: colors.border },
  headBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 4, paddingRight: 8 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingLeft: 4 },
  rowLine: { borderBottomWidth: .25, borderBottomColor: colors.border },
  rowMark: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, backgroundColor: colors.accent },
  check: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.muted },
  checkOn: { borderColor: colors.accent, backgroundColor: colors.subtle },
  checkMixed: { width: 7, height: 1.5, backgroundColor: colors.accent },
  checkCell: { width: 40, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  rowBody: { flex: 1, minWidth: 0, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 4, paddingRight: 8 },
  teamBody: { paddingLeft: 12 },
  nameCell: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameCopy: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  code: { fontSize: 9, lineHeight: 13, color: colors.muted, letterSpacing: .6 },
  time: { fontSize: 9, lineHeight: 13, color: colors.muted, letterSpacing: .6 },
  cell: { minWidth: 0, gap: 3 },
  cellLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  cellShrink: { flexShrink: 1 },
  cellTitle: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  cellText: { fontSize: 11, lineHeight: 16, letterSpacing: .4 },
  cellDetail: { fontSize: 9, lineHeight: 13, color: colors.muted, letterSpacing: .6 },
  state: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  stateFit: { flexShrink: 1 },
  stateText: { fontSize: 10, lineHeight: 14, letterSpacing: .6, flexShrink: 1 },
  headText: { fontSize: 9, lineHeight: 13, letterSpacing: 1.4, color: colors.muted },
  empty: { paddingVertical: 32, paddingHorizontal: 16 },
  hint: { fontSize: 10, lineHeight: 16, color: colors.muted, paddingHorizontal: 2 },
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
