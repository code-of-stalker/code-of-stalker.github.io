import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import { ProductButton } from '../../product/ui';
import type { DirectoryEntry } from '../backend';
import type { IntensiveSession } from '../session';
import { shortCode } from '../session';
import { Avatar, GlassField, Glyph, ListGroup, ListItem } from './chrome';
import { formatTime, Note, problemText, Tabs } from './parts';
import { isStaff, PersonCard, placesOf, plain, waitedFor } from './PersonCard';

type Group = 'waiting' | 'walkers' | 'team';
const SEARCH_FROM = 6;

/** One quiet line per person; the code leads only while they wait, since a walker reads it out to find themselves. */
function describe(entry: DirectoryEntry, byId: Map<string, DirectoryEntry>) {
  const parts = entry.blocked ? ['ДОСТУП ЗАКРЫТ'] : [];
  if (!isStaff(entry) && !entry.guideId) return [...parts, `КОД ${shortCode(entry.userId)} · ЖДЁТ С ${formatTime(entry.createdAt)}`].join(' · ');
  if (entry.waitingSince && !entry.blocked) parts.push(`ЖДЁТ ОТВЕТА ${waitedFor(entry.waitingSince)}`);
  parts.push(...placesOf(entry));
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
  const [error, setError] = useState('');

  const [version, setVersion] = useState(0);
  const load = () => setVersion(current => current + 1);
  useEffect(() => {
    let alive = true;
    session.directory().then(
      list => { if (alive) { setDirectory(list); setError(''); } },
      problem => { if (alive) setError(problemText(problem, 'Не удалось загрузить список людей.', true)); });
    return () => { alive = false; };
  }, [session, version]);

  if (!directory) return <View style={styles.stack}>{error ? <Note tone="error">{error}</Note> : <Note center>Загружаю людей…</Note>}</View>;
  const byId = new Map(directory.map(entry => [entry.userId, entry]));
  const person = selected ? byId.get(selected) : undefined;
  if (person) return <PersonCard session={session} person={person} directory={directory} onChanged={load} onOpenChat={onOpenChat} onBack={() => setSelected(null)} />;

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
      footer={!needle && group === 'waiting' && list.length ? 'Новые аккаунты. Откройте человека и назначьте ему проводника.' : undefined}>
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
});
