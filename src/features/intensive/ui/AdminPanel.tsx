import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProductToggle } from '../../product/ProductToggle';
import { useThemeStyles } from '../../product/ProductTheme';
import { ProductButton } from '../../product/ui';
import type { DirectoryEntry, StaffRole } from '../backend';
import type { IntensiveSession } from '../session';
import { shortCode } from '../session';
import { Divider, formatTime, Heading, Note, problemText, Row, Tabs } from './parts';

type Group = 'waiting' | 'walkers' | 'team';
const isStaff = (entry: DirectoryEntry) => entry.mainAdmin || entry.roles.length > 0;
const roleNames: Record<StaffRole, string> = { guide: 'ПРОВОДНИК', admin: 'АДМИН ПРОВОДНИКА' };

function describe(entry: DirectoryEntry, byId: Map<string, DirectoryEntry>) {
  const parts = [shortCode(entry.userId)];
  if (entry.mainAdmin) parts.push('ГЛАВНЫЙ АДМИН');
  parts.push(...entry.roles.map(role => roleNames[role]));
  if (entry.guideId) parts.push(`ПРОВОДНИК: ${byId.get(entry.guideId)?.name ?? '—'}`);
  if (entry.roles.includes('guide') && entry.adminId) parts.push(`АДМИН: ${byId.get(entry.adminId)?.name ?? '—'}`);
  if (!isStaff(entry) && !entry.guideId) parts.push(`С ${formatTime(entry.createdAt)}`);
  return parts.join(' · ');
}

export function AdminPanel({ session, onOpenChat }: { session: IntensiveSession; onOpenChat: (chatId: string) => void }) {
  const styles = useThemeStyles(createStyles);
  const [directory, setDirectory] = useState<DirectoryEntry[] | null>(null);
  const [group, setGroup] = useState<Group>('waiting');
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

  if (!directory) return <View style={styles.stack}>{error ? <Note tone="error">{error}</Note> : <Note>Загружаю людей…</Note>}</View>;
  const byId = new Map(directory.map(entry => [entry.userId, entry]));
  const person = selected ? byId.get(selected) : undefined;

  if (person) {
    const guides = directory.filter(entry => entry.roles.includes('guide') && entry.userId !== person.userId);
    const admins = directory.filter(entry => entry.roles.includes('admin') && entry.userId !== person.userId);
    const isGuide = person.roles.includes('guide');
    const toggle = (role: StaffRole) => {
      if (person.roles.includes(role) && confirm !== role) { setConfirm(role); return; }
      void act(() => session.setRole(person.userId, role, !person.roles.includes(role)));
    };
    return <View style={styles.stack}>
      <ProductButton label="← КО ВСЕМ" kind="ghost" onPress={() => { setSelected(null); setConfirm(null); }} style={styles.backLink} />
      <Heading>{person.name}</Heading>
      <Note>{describe(person, byId)}</Note>
      {person.chatId ? <ProductButton label="ОТКРЫТЬ ПЕРЕПИСКУ" kind="outline" onPress={() => onOpenChat(person.chatId!)} disabled={busy} /> : null}
      <Divider />
      <Heading>ПРОВОДНИК</Heading>
      {guides.length ? null : <Note>Проводников пока нет. Дай кому-нибудь права проводника ниже.</Note>}
      {guides.map(guide => <Row key={guide.userId} title={guide.name} detail={guide.mainAdmin ? 'ГЛАВНЫЙ АДМИН' : undefined} selected={person.guideId === guide.userId}
        onPress={busy || person.guideId === guide.userId ? undefined : () => { void act(() => session.assignGuide(person.userId, guide.userId)); }} />)}
      {person.guideId ? <ProductButton label="СНЯТЬ ПРОВОДНИКА" kind="ghost" disabled={busy} onPress={() => { void act(() => session.assignGuide(person.userId, null)); }} /> : null}
      <Note>Переписка остаётся у идущего: новый проводник увидит всю историю, прежний теряет доступ.</Note>
      <Divider />
      <Heading>ПРАВА</Heading>
      {(['guide', 'admin'] as StaffRole[]).map(role => <View key={role} style={styles.stack}>
        <Row title={roleNames[role]} detail={role === 'guide' ? 'Ведёт идущих и переписывается с ними.' : 'Видит переписки идущих своих проводников.'}
          onPress={busy ? undefined : () => toggle(role)} right={<ProductToggle enabled={person.roles.includes(role)} />} />
        {confirm === role ? <View style={styles.confirm}>
          <Note tone="text">{role === 'guide' ? 'Снять права проводника? Его идущие останутся без проводника.' : 'Снять права админа? Его проводники останутся без админа.'}</Note>
          <View style={styles.confirmButtons}>
            <ProductButton label="СНЯТЬ" onPress={() => toggle(role)} disabled={busy} style={styles.flex} />
            <ProductButton label="ОТМЕНА" kind="outline" onPress={() => setConfirm(null)} disabled={busy} style={styles.flex} />
          </View>
        </View> : null}
      </View>)}
      {isGuide ? <>
        <Divider />
        <Heading>АДМИН ЭТОГО ПРОВОДНИКА</Heading>
        {admins.length ? null : <Note>Админов пока нет. Дай кому-нибудь права админа проводника.</Note>}
        {admins.map(admin => <Row key={admin.userId} title={admin.name} selected={person.adminId === admin.userId}
          onPress={busy || person.adminId === admin.userId ? undefined : () => { void act(() => session.assignAdmin(person.userId, admin.userId, directory)); }} />)}
        {person.adminId ? <ProductButton label="СНЯТЬ АДМИНА" kind="ghost" disabled={busy} onPress={() => { void act(() => session.assignAdmin(person.userId, null, directory)); }} /> : null}
      </> : null}
      {person.mainAdmin ? <Note>Главного админа назначает владелец сервера, не из приложения.</Note> : null}
      {error ? <Note tone="error">{error}</Note> : null}
    </View>;
  }

  const groups: Record<Group, DirectoryEntry[]> = {
    waiting: directory.filter(entry => !isStaff(entry) && !entry.guideId),
    walkers: directory.filter(entry => !isStaff(entry) && entry.guideId),
    team: directory.filter(isStaff),
  };
  return <View style={styles.stack}>
    <Tabs fit value={group} onChange={setGroup} options={[
      { id: 'waiting', label: `ЖДУТ ${groups.waiting.length}` },
      { id: 'walkers', label: `ИДУЩИЕ ${groups.walkers.length}` },
      { id: 'team', label: `КОМАНДА ${groups.team.length}` },
    ]} />
    {group === 'waiting' && groups.waiting.length ? <Note>Новые аккаунты. Открой человека и назначь ему проводника.</Note> : null}
    {groups[group].length ? groups[group].map(entry => <Row key={entry.userId} title={entry.name} detail={describe(entry, byId)} onPress={() => setSelected(entry.userId)} />)
      : <Note>Здесь пока никого.</Note>}
    <ProductButton label="ОБНОВИТЬ" kind="ghost" onPress={load} />
    {error ? <Note tone="error">{error}</Note> : null}
  </View>;
}

const createStyles = () => StyleSheet.create({
  stack: { gap: 12 },
  backLink: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  confirm: { gap: 8 },
  confirmButtons: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
