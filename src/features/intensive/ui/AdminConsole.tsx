import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { DiaryDesignPanel } from '../../product/diary/DiaryDesignPanel';
import { useProductLayout } from '../../product/layout';
import { BottomSheet } from '../../product/motion/BottomSheet';
import { PanelArtwork } from '../../product/motion/PanelArtwork';
import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import { useProduct } from '../../product/state/ProductProvider';
import type { ProductColors } from '../../product/theme';
import { ProductButton, ProductText } from '../../product/ui';
import type { DirectoryEntry } from '../backend';
import type { IntensiveSession } from '../session';
import { shortCode } from '../session';
import { Avatar, GlassField, Glyph, ListGroup, ListItem, useContour } from './chrome';
import { formatTime, Note, problemText, Tabs } from './parts';
import { isStaff, PersonCard, placesOf, plain, waitedFor } from './PersonCard';

type Tab = 'walkers' | 'team';
type Filter = 'all' | 'waiting' | 'unguided' | 'blocked';
type Move = { phase: 'pick' } | { phase: 'moving'; done: number; total: number } | { phase: 'done'; text: string; failed: boolean };

const REFRESH_MS = 30_000;
// The prompt plate's contour from the diary, with an opaque fill so the table reads over the backdrop.
const TABLE_CONTOUR = 'M275.947 .125L287.875 12.0527V63.875H12.0527L.125 51.9473V.125Z';

const filters: { id: Filter; label: string; test: (entry: DirectoryEntry) => boolean }[] = [
  { id: 'all', label: 'ВСЕ', test: () => true },
  { id: 'waiting', label: 'ЖДУТ ОТВЕТА', test: entry => !!entry.waitingSince && !entry.blocked },
  { id: 'unguided', label: 'БЕЗ ПРОВОДНИКА', test: entry => !entry.guideId && !entry.blocked },
  { id: 'blocked', label: 'ДОСТУП ЗАКРЫТ', test: entry => entry.blocked },
];

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

function useTableFrame() {
  const colors = useThemeColors();
  return useMemo(() => {
    const tag = colors.accent.replace('#', '');
    return { uri: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg width="288" height="64" viewBox="0 0 288 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="${TABLE_CONTOUR}" fill="${colors.background}" fill-opacity="0.9"/>
<path d="${TABLE_CONTOUR}" fill="url(#intensive-table-${tag})" fill-opacity="0.08" stroke="${colors.accent}" stroke-width="0.25"/>
<defs><linearGradient id="intensive-table-${tag}" x1="0" y1="32" x2="288" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="${colors.accent}"/><stop offset="1" stop-color="${colors.muted}"/></linearGradient></defs></svg>`) };
  }, [colors]);
}

/** A framed block: the diary contour fitted to its content, corners kept whole. */
function Framed({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const frame = useTableFrame();
  return <View style={[{ position: 'relative' }, style]}>
    <PanelArtwork source={frame} />
    {children}
  </View>;
}

/**
 * The diary's icon contour as a small check box. Fitted to 22 px its fixed corner cuts would
 * swallow the sides, so the whole 44 px icon is scaled down evenly, as a glyph is.
 */
function CheckBox({ checked, label, onPress, mixed = false }: { checked: boolean; label: string; onPress: () => void; mixed?: boolean }) {
  const colors = useThemeColors();
  const source = useContour(44, 42, checked || mixed ? 'pressed' : 'plain');
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: mixed ? 'mixed' : checked }} onPress={onPress} hitSlop={10}
    style={({ pressed }) => [{ width: 22, height: 21, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: .7 }]}>
    <Image pointerEvents="none" source={source} style={StyleSheet.absoluteFill} contentFit="contain" />
    {checked ? <Glyph name="check" size={14} /> : mixed ? <View style={{ width: 8, height: 1, backgroundColor: colors.accent }} /> : null}
  </Pressable>;
}

function Cell({ children, flex, tone = 'text', align = 'left', lines = 1 }: { children: ReactNode; flex: number; tone?: 'text' | 'muted' | 'accent' | 'error'; align?: 'left' | 'right'; lines?: number }) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  const color = tone === 'accent' ? colors.accent : tone === 'error' ? colors.error : tone === 'muted' ? colors.muted : colors.text;
  return <View style={[styles.cell, { flex }]}>
    <ProductText numberOfLines={lines} maxFontSize={13} style={[styles.cellText, { color, textAlign: align }]}>{children}</ProductText>
  </View>;
}

function HeadCell({ children, flex, align = 'left' }: { children: ReactNode; flex: number; align?: 'left' | 'right' }) {
  const styles = useThemeStyles(createStyles);
  return <View style={[styles.cell, { flex }]}><ProductText numberOfLines={1} maxFontSize={10} style={[styles.headText, { textAlign: align }]}>{children}</ProductText></View>;
}

export function AdminConsole({ session, onOpenChat }: { session: IntensiveSession; onOpenChat: (chatId: string) => void }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const { settings } = useProduct();
  const wide = useProductLayout().columns === 2;
  // Below 1200 px the side card narrows and the admin column leaves the table (the card shows it).
  const roomy = useWindowDimensions().width >= 1200;
  const [directory, setDirectory] = useState<DirectoryEntry[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('walkers');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [move, setMove] = useState<Move | null>(null);

  const [version, setVersion] = useState(0);
  const load = () => setVersion(current => current + 1);
  useEffect(() => {
    let alive = true;
    session.directory().then(
      list => { if (alive) { setDirectory(list); setLoadedAt(Date.now()); setError(''); } },
      problem => { if (alive) setError(problemText(problem, 'Не удалось загрузить список людей.')); });
    return () => { alive = false; };
  }, [session, version]);
  // Waiting times and new messages stay current while the page is open.
  useEffect(() => {
    const timer = setInterval(() => setVersion(current => current + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const byId = useMemo(() => new Map((directory ?? []).map(entry => [entry.userId, entry])), [directory]);
  if (!directory) return <View style={styles.stack}>{error ? <Note tone="error">{error}</Note> : <Note center>Загружаю людей…</Note>}</View>;

  const walkers = directory.filter(entry => !isStaff(entry)).sort(walkerOrder);
  const team = directory.filter(isStaff);
  const guides = team.filter(entry => entry.roles.includes('guide') && !entry.blocked);
  const guideLoad = (guideId: string) => {
    const own = walkers.filter(entry => entry.guideId === guideId && !entry.blocked);
    return { walkers: own.length, waiting: own.filter(entry => entry.waitingSince).length };
  };
  const counts = Object.fromEntries(filters.map(item => [item.id, walkers.filter(item.test).length])) as Record<Filter, number>;
  const needle = plain(query.trim());
  const matches = (entry: DirectoryEntry) => !needle || plain(entry.name).includes(needle) || plain(shortCode(entry.userId)).includes(needle);
  const activeFilter = filters.find(item => item.id === filter)!;
  const rows = tab === 'walkers' ? walkers.filter(entry => activeFilter.test(entry) && matches(entry)) : team.filter(matches);
  const person = selected ? byId.get(selected) : undefined;
  const pickedRows = [...picked].map(id => byId.get(id)).filter((entry): entry is DirectoryEntry => !!entry);
  const allPicked = tab === 'walkers' && rows.length > 0 && rows.every(entry => picked.has(entry.userId));
  const somePicked = tab === 'walkers' && rows.some(entry => picked.has(entry.userId));

  const togglePick = (userId: string) => setPicked(current => {
    const next = new Set(current);
    if (!next.delete(userId)) next.add(userId);
    return next;
  });
  const pickAll = () => setPicked(allPicked ? new Set() : new Set(rows.map(entry => entry.userId)));
  const changeView = (nextTab: Tab, nextFilter: Filter = 'all') => {
    if (nextTab !== tab) setSelected(null);
    setTab(nextTab); setFilter(nextFilter); setPicked(new Set());
  };
  const open = (userId: string) => setSelected(current => wide && current === userId ? null : userId);

  async function moveTo(guide: DirectoryEntry) {
    const targets = pickedRows.filter(entry => entry.guideId !== guide.userId);
    const failed: DirectoryEntry[] = [];
    setMove({ phase: 'moving', done: 0, total: targets.length });
    for (const [index, walker] of targets.entries()) {
      try { await session.assignGuide(walker.userId, guide.userId); }
      catch (problem) { failed.push(walker); problemText(problem); }
      setMove({ phase: 'moving', done: index + 1, total: targets.length });
    }
    // Whoever did not move stays picked, so one more press retries just them.
    setPicked(new Set(failed.map(entry => entry.userId)));
    setMove(failed.length
      ? { phase: 'done', failed: true, text: `Не получилось перевести: ${failed.map(entry => entry.name).join(', ')}. Проверь интернет и попробуй ещё раз.` }
      : { phase: 'done', failed: false, text: `Готово. Проводник ${guide.name} ведёт выбранных идущих (${pickedRows.length}) и видит их переписку.` });
    load();
  }

  const card = person ? <PersonCard key={person.userId} session={session} person={person} directory={directory} onChanged={load} onOpenChat={onOpenChat}
    onBack={wide ? undefined : () => setSelected(null)} /> : null;
  if (card && !wide) return card;

  const waitingLongest = walkers.find(entry => entry.waitingSince && !entry.blocked);
  const summary = <View style={styles.stack}>
    <ListGroup caption="СВОДКА">
      <ListItem glyph="clock" title="Ждут ответа" onPress={() => changeView('walkers', 'waiting')}
        detail={waitingLongest ? `ДОЛЬШЕ ВСЕХ: ${waitingLongest.name}, ${waitedFor(waitingLongest.waitingSince!, loadedAt)}` : 'ВСЕМ ОТВЕТИЛИ'}
        right={<ProductText variant="title" style={styles.count} color={counts.waiting ? colors.accent : colors.muted}>{counts.waiting}</ProductText>} />
      <ListItem glyph="person" title="Без проводника" onPress={() => changeView('walkers', 'unguided')} detail="НОВЫЕ АККАУНТЫ И ТЕ, У КОГО СНЯЛИ ПРОВОДНИКА"
        right={<ProductText variant="title" style={styles.count} color={counts.unguided ? colors.accent : colors.muted}>{counts.unguided}</ProductText>} />
      <ListItem glyph="people" title="Команда" onPress={() => changeView('team')}
        detail={`ПРОВОДНИКОВ ${team.filter(entry => entry.roles.includes('guide')).length} · АДМИНОВ ${team.filter(entry => entry.roles.includes('admin')).length}`}
        right={<ProductText variant="title" style={styles.count} color={colors.muted}>{team.length}</ProductText>} />
      <ListItem glyph="lock" title="Доступ закрыт" onPress={() => changeView('walkers', 'blocked')} detail="ПЕРЕПИСКА СОХРАНЕНА, ПИСАТЬ НЕЛЬЗЯ" last
        right={<ProductText variant="title" style={styles.count} color={colors.muted}>{directory.filter(entry => entry.blocked).length}</ProductText>} />
    </ListGroup>
    <Note>Выбери человека в таблице: назначь проводника, дай права или закрой доступ. Отметь несколько идущих, чтобы перевести их к другому проводнику разом.</Note>
  </View>;

  const walkerRow = (entry: DirectoryEntry, index: number) => {
    const guide = entry.guideId ? byId.get(entry.guideId) : undefined;
    const admin = guide?.adminId ? byId.get(guide.adminId) : undefined;
    const on = selected === entry.userId;
    const last = index === rows.length - 1;
    return <View key={entry.userId} style={[styles.row, !last && styles.rowLine, on && { backgroundColor: colors.subtle }]}>
      <View style={styles.checkCell}><CheckBox checked={picked.has(entry.userId)} label={`Выбрать: ${entry.name}`} onPress={() => togglePick(entry.userId)} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Открыть: ${entry.name}`} onPress={() => open(entry.userId)}
        style={({ pressed }) => [styles.rowBody, pressed && { opacity: .7 }]}>
        <View style={[styles.nameCell, { flex: wide ? 2.2 : 1 }]}>
          <Avatar name={entry.name} size={wide ? 32 : 40} />
          <View style={styles.nameCopy}>
            <ProductText variant="title" numberOfLines={1} style={styles.name}>{entry.name}</ProductText>
            <ProductText numberOfLines={1} maxFontSize={11} style={[styles.code, entry.blocked && { color: colors.error }]}>
              {entry.blocked ? wide ? 'ДОСТУП ЗАКРЫТ' : `ДОСТУП ЗАКРЫТ · ${shortCode(entry.userId)}` : wide ? `КОД ${shortCode(entry.userId)}`
                : [guide ? `ПРОВОДНИК: ${guide.name}` : 'БЕЗ ПРОВОДНИКА', entry.lastMessageAt ? formatTime(entry.lastMessageAt) : null].filter(Boolean).join(' · ')}
            </ProductText>
          </View>
        </View>
        {wide ? <>
          <Cell flex={1.3} tone={guide ? 'text' : 'accent'}>{guide?.name ?? 'НЕ НАЗНАЧЕН'}</Cell>
          {roomy ? <Cell flex={1.3} tone="muted">{admin?.name ?? '—'}</Cell> : null}
          {/* A closed account cannot be answered, so its wait is not Yana's to count. */}
          <Cell flex={1.2} tone={entry.waitingSince && !entry.blocked ? 'accent' : 'muted'}>{entry.waitingSince && !entry.blocked ? waitedFor(entry.waitingSince, loadedAt) : '—'}</Cell>
          <Cell flex={1.1} tone="muted" align="right">{entry.lastMessageAt ? formatTime(entry.lastMessageAt) : '—'}</Cell>
        </> : entry.waitingSince && !entry.blocked
          ? <ProductText maxFontSize={11} style={styles.badge}>{waitedFor(entry.waitingSince, loadedAt)}</ProductText> : null}
        <Glyph name="right" size={16} color={colors.faint} />
      </Pressable>
    </View>;
  };

  const teamRow = (entry: DirectoryEntry, index: number) => {
    const isGuide = entry.roles.includes('guide');
    const admin = entry.adminId ? byId.get(entry.adminId) : undefined;
    const own = isGuide ? guideLoad(entry.userId) : null;
    const on = selected === entry.userId;
    const last = index === rows.length - 1;
    const places = placesOf(entry).join(' · ');
    return <Pressable key={entry.userId} accessibilityRole="button" accessibilityLabel={`Открыть: ${entry.name}`} onPress={() => open(entry.userId)}
      style={({ pressed }) => [styles.row, styles.teamRow, !last && styles.rowLine, on && { backgroundColor: colors.subtle }, pressed && { opacity: .7 }]}>
      <View style={[styles.nameCell, { flex: wide ? 2.2 : 1 }]}>
        <Avatar name={entry.name} size={wide ? 32 : 40} accent />
        <View style={styles.nameCopy}>
          <ProductText variant="title" numberOfLines={1} style={styles.name}>{entry.name}</ProductText>
          <ProductText numberOfLines={1} maxFontSize={11} style={[styles.code, entry.blocked && { color: colors.error }]}>
            {entry.blocked ? `ДОСТУП ЗАКРЫТ · ${places}` : wide ? `КОД ${shortCode(entry.userId)}`
              : [places, own ? `ИДУЩИХ ${own.walkers}` : null, own?.waiting ? `ЖДУТ ${own.waiting}` : null].filter(Boolean).join(' · ')}
          </ProductText>
        </View>
      </View>
      {wide ? <>
        <Cell flex={2} tone="muted" lines={2}>{places}</Cell>
        <Cell flex={1.3} tone="muted">{isGuide ? admin?.name ?? '—' : ''}</Cell>
        <Cell flex={.8} align="right">{own ? own.walkers : ''}</Cell>
        <Cell flex={.8} tone={own?.waiting ? 'accent' : 'muted'} align="right">{own ? own.waiting : ''}</Cell>
      </> : null}
      <Glyph name="right" size={16} color={colors.faint} />
    </Pressable>;
  };

  const head = wide ? <View style={[styles.row, styles.head, tab === 'team' && styles.teamRow]}>
    {tab === 'walkers' ? <View style={styles.checkCell}><CheckBox checked={allPicked} mixed={!allPicked && somePicked} label="Выбрать всех в таблице" onPress={pickAll} /></View> : null}
    <View style={styles.rowBody}>
      <HeadCell flex={2.2}>{tab === 'walkers' ? 'ИДУЩИЙ' : 'ЧЕЛОВЕК'}</HeadCell>
      {tab === 'walkers' ? <>
        <HeadCell flex={1.3}>ПРОВОДНИК</HeadCell>
        {roomy ? <HeadCell flex={1.3}>АДМИН</HeadCell> : null}
        <HeadCell flex={1.2}>ЖДЁТ ОТВЕТА</HeadCell>
        <HeadCell flex={1.1} align="right">ПОСЛЕДНЕЕ</HeadCell>
      </> : <>
        <HeadCell flex={2}>ПРАВА</HeadCell>
        <HeadCell flex={1.3}>АДМИН</HeadCell>
        <HeadCell flex={.8} align="right">ИДУЩИХ</HeadCell>
        <HeadCell flex={.8} align="right">ЖДУТ</HeadCell>
      </>}
      <View style={{ width: 16 }} />
    </View>
  </View> : tab === 'walkers' && rows.length ? <View style={[styles.row, styles.head]}>
    <View style={styles.checkCell}><CheckBox checked={allPicked} mixed={!allPicked && somePicked} label="Выбрать всех в таблице" onPress={pickAll} /></View>
    <HeadCell flex={1}>{allPicked ? 'ВЫБРАНЫ ВСЕ' : 'ВЫБРАТЬ ВСЕХ'}</HeadCell>
  </View> : null;

  const table = <Framed style={styles.table}>
    {head}
    {rows.length ? rows.map(tab === 'walkers' ? walkerRow : teamRow)
      : <View style={styles.empty}><Note center>{needle ? 'Никого не нашлось.' : tab === 'team' ? 'В команде пока никого.' : filter === 'waiting' ? 'Все получили ответ.' : 'Здесь пока никого.'}</Note></View>}
  </Framed>;

  const moveSheet = <BottomSheet open={move !== null} onClose={() => { if (move?.phase !== 'moving') setMove(null); }} reducedMotion={settings.reducedMotion}>
    <DiaryDesignPanel title={move?.phase === 'done' ? move.failed ? 'НЕ ВСЕ ПЕРЕВЕДЕНЫ' : 'ПЕРЕВЕДЕНЫ' : move?.phase === 'moving' ? `ПЕРЕВОЖУ: ${move.total}` : `ПЕРЕВЕСТИ: ${pickedRows.length}`} onClose={() => setMove(null)} closeDisabled={move?.phase === 'moving'}
      footer={move?.phase === 'done' ? <ProductButton label="ГОТОВО" onPress={() => setMove(null)} />
        : <ProductButton label="ОТМЕНА" kind="outline" onPress={() => setMove(null)} disabled={move?.phase === 'moving'} />}>
      {move?.phase === 'moving' ? <Note center tone="text">{`Переношу ${move.done} из ${move.total}…`}</Note>
        : move?.phase === 'done' ? <Note tone={move.failed ? 'error' : 'text'}>{move.text}</Note>
          : <ListGroup caption="К КАКОМУ ПРОВОДНИКУ" footer="Переписка остаётся у идущего: новый проводник увидит всю историю, прежний теряет доступ.">
            {guides.length ? guides.map((guide, index) => {
              const own = guideLoad(guide.userId);
              return <ListItem key={guide.userId} avatar={<Avatar name={guide.name} size={36} accent />} title={guide.name}
                detail={`ИДУЩИХ ${own.walkers}${own.waiting ? ` · ЖДУТ ОТВЕТА ${own.waiting}` : ''}`}
                onPress={() => { void moveTo(guide); }} last={index === guides.length - 1} />;
            }) : <ListItem glyph="people" title="Проводников пока нет" detail="Дай права проводника кому-нибудь в команде" last />}
          </ListGroup>}
    </DiaryDesignPanel>
  </BottomSheet>;

  return <View style={styles.stack}>
    <View style={[styles.toolbar, wide && styles.toolbarWide]}>
      <View style={wide ? styles.tabsWide : undefined}>
        <Tabs fit value={tab} onChange={value => changeView(value)} options={[
          { id: 'walkers', label: `ИДУЩИЕ ${walkers.length}` },
          { id: 'team', label: `КОМАНДА ${team.length}` },
        ]} />
      </View>
      <View style={[styles.search, wide && styles.searchWide]}>
        <GlassField value={query} onChangeText={setQuery} placeholder="Имя или код" accessibilityLabel="Поиск по имени или коду"
          autoCapitalize="none" returnKeyType="search" right={<Glyph name="search" size={18} color={colors.muted} />} />
      </View>
    </View>
    {tab === 'walkers' ? <View style={styles.filters} accessibilityRole="tablist">
      {filters.map(item => {
        const on = item.id === filter;
        return <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setFilter(item.id); setPicked(new Set()); }}
          style={({ pressed }) => [styles.filter, on && { borderBottomColor: colors.accent }, pressed && { opacity: .7 }]}>
          <ProductText variant="label" numberOfLines={1} maxFontSize={13} color={on ? colors.text : colors.muted} style={styles.filterText}>
            {`${item.label} ${counts[item.id]}`}
          </ProductText>
        </Pressable>;
      })}
    </View> : null}
    {pickedRows.length ? <Framed style={[styles.bulk, !wide && styles.bulkNarrow]}>
      <ProductText variant="label" maxFontSize={13} style={styles.bulkText}>{`ВЫБРАНО ${pickedRows.length}`}</ProductText>
      <View style={styles.bulkActions}>
        <ProductButton label="ПЕРЕВЕСТИ К ПРОВОДНИКУ" onPress={() => setMove({ phase: 'pick' })} style={styles.bulkButton} />
        <ProductButton label="СНЯТЬ ВЫБОР" kind="ghost" onPress={() => setPicked(new Set())} />
      </View>
    </Framed> : null}
    {wide ? <View style={styles.split}>
      <View style={styles.main}>{table}</View>
      <View style={[styles.side, { width: roomy ? 380 : 320 }]}>{card ?? summary}</View>
    </View> : table}
    <View style={styles.footer}>
      <View style={styles.footerNote}><Note>{`Обновлено в ${formatTime(new Date(loadedAt).toISOString())}. Список обновляется сам каждые 30 секунд.`}</Note></View>
      <ProductButton label="ОБНОВИТЬ" kind="ghost" onPress={load} />
    </View>
    {error ? <Note tone="error">{error}</Note> : null}
    {moveSheet}
  </View>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  stack: { gap: 20 },
  toolbar: { gap: 16 },
  toolbarWide: { flexDirection: 'row', alignItems: 'flex-end', gap: 24 },
  tabsWide: { flexShrink: 0, minWidth: 360 },
  search: {},
  searchWide: { flex: 1, maxWidth: 420, marginLeft: 'auto' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 4 },
  filter: { minHeight: 36, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'transparent' },
  filterText: { fontSize: 11, lineHeight: 16, letterSpacing: .6 },
  bulk: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  bulkText: { color: colors.accent, letterSpacing: 1.2 },
  bulkActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  bulkNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  bulkButton: { paddingHorizontal: 18 },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  main: { flex: 1, minWidth: 0 },
  side: { flexShrink: 0 },
  table: { paddingHorizontal: 4, paddingVertical: 4 },
  head: { minHeight: 40 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 8 },
  teamRow: { gap: 10, paddingLeft: 12 },
  rowLine: { borderBottomWidth: .25, borderBottomColor: colors.border },
  checkCell: { width: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  rowBody: { flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 4 },
  nameCell: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameCopy: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  code: { fontSize: 8, lineHeight: 12, color: colors.muted, letterSpacing: .6 },
  cell: { minWidth: 0, paddingHorizontal: 4 },
  cellText: { fontSize: 10, lineHeight: 15 },
  headText: { fontSize: 8, lineHeight: 12, letterSpacing: 1.4, color: colors.muted },
  badge: { fontSize: 8, lineHeight: 12, color: colors.accent, letterSpacing: .6 },
  count: { fontSize: 14, lineHeight: 20, minWidth: 24, textAlign: 'right' },
  empty: { paddingVertical: 28, paddingHorizontal: 16 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  footerNote: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0 },
});
