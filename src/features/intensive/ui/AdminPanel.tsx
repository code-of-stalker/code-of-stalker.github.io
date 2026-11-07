import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProductToggle } from '../../product/ProductToggle';
import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import { ProductButton } from '../../product/ui';
import type { DirectoryEntry, StaffRole } from '../backend';
import type { IntensiveSession } from '../session';
import { shortCode } from '../session';
import { Avatar, ConfirmSheet, GlassField, Glyph, ListGroup, ListItem, ProfileHead } from './chrome';
import { formatTime, Note, problemText, Tabs } from './parts';

type Group = 'waiting' | 'walkers' | 'team';
const isStaff = (entry: DirectoryEntry) => entry.mainAdmin || entry.roles.length > 0;
const roleNames: Record<StaffRole, string> = { guide: 'ПРОВОДНИК', admin: 'АДМИН ПРОВОДНИКА' };
const roleTitles: Record<StaffRole, string> = { guide: 'Проводник', admin: 'Админ проводника' };
const roleHints: Record<StaffRole, string> = { guide: 'Ведёт идущих и переписывается с ними', admin: 'Видит переписки идущих своих проводников' };
const SEARCH_FROM = 6;
const plain = (text: string) => text.toLocaleLowerCase('ru').replace(/[\s-]/g, '');

function placesOf(entry: DirectoryEntry) {
  return [entry.mainAdmin ? 'ГЛАВНЫЙ АДМИН' : null, ...entry.roles.map(role => roleNames[role])].filter((place): place is string => !!place);
}

/** One quiet line per person; the code leads only while they wait, since a walker reads it out to find themselves. */
function describe(entry: DirectoryEntry, byId: Map<string, DirectoryEntry>) {
  if (!isStaff(entry) && !entry.guideId) return `КОД ${shortCode(entry.userId)} · ЖДЁТ С ${formatTime(entry.createdAt)}`;
  const parts = placesOf(entry);
  if (entry.guideId) parts.push(`ПРОВОДНИК: ${byId.get(entry.guideId)?.name ?? '—'}`);
  if (entry.roles.includes('guide') && entry.adminId) parts.push(`АДМИН: ${byId.get(entry.adminId)?.name ?? '—'}`);
  return parts.join(' · ');
}

export function AdminPanel({ session, onOpenChat }: { session: IntensiveSession; onOpenChat: (chatId: string) => void }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const [directory, setDirectory] = useState<DirectoryEntry[] | null>(null);
  const [group, setGroup] = useState<Group>('waiting');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<StaffRole | null>(null);

  const [version, setVersion] = useState(0);
  const load = () => setVersion(current => current + 1);
  useEffect(() => {
    let alive = true;
    session.directory().then(
      list => { if (alive) { setDirectory(list); setError(''); } },
      problem => { if (alive) setError(problemText(problem, 'Не удалось загрузить список людей.')); });
    return () => { alive = false; };
  }, [session, version]);

  const act = async (work: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await work(); load(); }
    catch (problem) { setError(problemText(problem, 'Не получилось. Попробуй ещё раз.')); }
    finally { setBusy(false); setConfirm(null); }
  };

  if (!directory) return <View style={styles.stack}>{error ? <Note tone="error">{error}</Note> : <Note center>Загружаю людей…</Note>}</View>;
  const byId = new Map(directory.map(entry => [entry.userId, entry]));
  const person = selected ? byId.get(selected) : undefined;

  if (person) {
    const guides = directory.filter(entry => entry.roles.includes('guide') && entry.userId !== person.userId);
    const admins = directory.filter(entry => entry.roles.includes('admin') && entry.userId !== person.userId);
    const isGuide = person.roles.includes('guide');
    const places = placesOf(person);
    // Only walkers get a guide; a staff card keeps the group just to take an old guide away.
    const guided = !isStaff(person) || !!person.guideId;
    const toggle = (role: StaffRole) => {
      if (person.roles.includes(role)) { setConfirm(role); return; }
      void act(() => session.setRole(person.userId, role, true));
    };
    const pick = (entry: DirectoryEntry, chosen: boolean, last: boolean, onPick: () => void) => <ListItem key={entry.userId}
      avatar={<Avatar name={entry.name} size={36} accent />} title={entry.name} detail={entry.mainAdmin ? 'ГЛАВНЫЙ АДМИН' : undefined}
      selected={chosen} chevron={false} right={chosen ? <Glyph name="check" size={18} /> : undefined}
      onPress={busy || chosen ? undefined : onPick} last={last} />;
    return <View style={styles.stack}>
      <ProductButton label="← КО ВСЕМ" kind="ghost" onPress={() => { setSelected(null); setConfirm(null); }} style={styles.backLink} />
      <ProfileHead name={person.name} accent={isStaff(person)}
        lines={[`КОД ${shortCode(person.userId)}`, places.length ? places.join(' · ') : person.guideId ? 'ИДУЩИЙ' : `ИДУЩИЙ · ЖДЁТ ПРОВОДНИКА С ${formatTime(person.createdAt)}`]} />
      {person.chatId ? <ListGroup>
        <ListItem glyph="chat" title="Открыть переписку" tone="accent" onPress={busy ? undefined : () => onOpenChat(person.chatId!)} last />
      </ListGroup> : null}
      {guided ? <ListGroup caption="ПРОВОДНИК" footer="Переписка остаётся у идущего: новый проводник увидит всю историю, прежний теряет доступ.">
        {guides.length ? guides.map((guide, index) => pick(guide, person.guideId === guide.userId, index === guides.length - 1 && !person.guideId,
          () => { void act(() => session.assignGuide(person.userId, guide.userId)); }))
          : <ListItem glyph="people" title={isGuide ? 'Других проводников нет' : 'Проводников пока нет'} detail="Дай права проводника кому-нибудь из людей" last={!person.guideId} />}
        {person.guideId ? <ListItem glyph="exit" tone="error" title="Снять проводника" chevron={false} last
          onPress={busy ? undefined : () => { void act(() => session.assignGuide(person.userId, null)); }} /> : null}
      </ListGroup> : null}
      <ListGroup caption="ПРАВА" footer={person.mainAdmin ? 'Главного админа назначает владелец сервера, не из приложения.' : undefined}>
        {(['guide', 'admin'] as StaffRole[]).map((role, index) => {
          const on = person.roles.includes(role);
          return <ListItem key={role} glyph={role === 'guide' ? 'people' : 'shield'} title={roleTitles[role]} detail={roleHints[role]} checked={on}
            accessibilityLabel={`${roleTitles[role]}: ${on ? 'включено' : 'выключено'}`} onPress={busy ? undefined : () => toggle(role)}
            right={<ProductToggle enabled={on} />} last={index === 1} />;
        })}
      </ListGroup>
      {isGuide ? <ListGroup caption="АДМИН ЭТОГО ПРОВОДНИКА">
        {admins.length ? admins.map((admin, index) => pick(admin, person.adminId === admin.userId, index === admins.length - 1 && !person.adminId,
          () => { void act(() => session.assignAdmin(person.userId, admin.userId, directory)); }))
          : <ListItem glyph="shield" title="Админов пока нет" detail="Дай права админа проводника кому-нибудь из людей" last={!person.adminId} />}
        {person.adminId ? <ListItem glyph="exit" tone="error" title="Снять админа" chevron={false} last
          onPress={busy ? undefined : () => { void act(() => session.assignAdmin(person.userId, null, directory)); }} /> : null}
      </ListGroup> : null}
      {error ? <Note tone="error">{error}</Note> : null}
      <ConfirmSheet open={confirm !== null} busy={busy} confirmLabel="СНЯТЬ"
        title={confirm === 'admin' ? 'СНЯТЬ ПРАВА АДМИНА?' : 'СНЯТЬ ПРАВА ПРОВОДНИКА?'}
        text={confirm === 'admin' ? 'Проводники этого админа останутся без админа.' : 'Идущие этого проводника останутся без проводника.'}
        onConfirm={() => { if (confirm) void act(() => session.setRole(person.userId, confirm, false)); }} onClose={() => setConfirm(null)} />
    </View>;
  }

  const groups: Record<Group, DirectoryEntry[]> = {
    waiting: directory.filter(entry => !isStaff(entry) && !entry.guideId),
    walkers: directory.filter(entry => !isStaff(entry) && entry.guideId),
    team: directory.filter(isStaff),
  };
  // A search looks through everyone, as in Telegram contacts: a code from a walker may belong to any tab.
  const needle = plain(query.trim());
  const list = needle ? directory.filter(entry => plain(entry.name).includes(needle) || plain(shortCode(entry.userId)).includes(needle)) : groups[group];
  return <View style={styles.stack}>
    <Tabs fit value={group} onChange={value => { setGroup(value); setQuery(''); }} options={[
      { id: 'waiting', label: `ЖДУТ ${groups.waiting.length}` },
      { id: 'walkers', label: `ИДУЩИЕ ${groups.walkers.length}` },
      { id: 'team', label: `КОМАНДА ${groups.team.length}` },
    ]} />
    {directory.length >= SEARCH_FROM ? <GlassField value={query} onChangeText={setQuery} placeholder="Имя или код" accessibilityLabel="Поиск по имени или коду"
      autoCapitalize="none" returnKeyType="search" right={<Glyph name="search" size={18} color={colors.muted} />} /> : null}
    <ListGroup caption={needle ? 'ПОИСК ПО ВСЕМ' : undefined}
      footer={!needle && group === 'waiting' && list.length ? 'Новые аккаунты. Открой человека и назначь ему проводника.' : undefined}>
      {list.length ? list.map((entry, index) => <ListItem key={entry.userId} avatar={<Avatar name={entry.name} size={44} accent={isStaff(entry)} />}
        title={entry.name} detail={describe(entry, byId)} onPress={() => setSelected(entry.userId)} last={index === list.length - 1} />)
        : <ListItem glyph="people" title={needle ? 'Никого не нашлось' : 'Здесь пока никого'} last />}
    </ListGroup>
    <ProductButton label="ОБНОВИТЬ" kind="ghost" onPress={load} />
    {error ? <Note tone="error">{error}</Note> : null}
  </View>;
}

const createStyles = () => StyleSheet.create({
  stack: { gap: 20 },
  backLink: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
