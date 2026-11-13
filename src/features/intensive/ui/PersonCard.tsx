import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProductToggle } from '../../product/ProductToggle';
import { useThemeStyles } from '../../product/ProductTheme';
import { ProductButton } from '../../product/ui';
import type { DirectoryEntry, Place, StaffRole } from '../backend';
import type { IntensiveSession } from '../session';
import { shortCode } from '../session';
import { Avatar, ConfirmSheet, Glyph, ListGroup, ListItem, ProfileHead, RoleTag, useRoleInks } from './chrome';
import { formatTime, Note, placeLabels, problemText } from './parts';
import { RoleMark } from './RoleMark';

export const isStaff = (entry: DirectoryEntry) => entry.mainAdmin || entry.roles.length > 0;
export const roleNames: Record<StaffRole, string> = { guide: 'ПРОВОДНИК', admin: 'АДМИН ПРОВОДНИКА' };
const roleTitles: Record<StaffRole, string> = { guide: 'Проводник', admin: 'Админ проводника' };
export const plain = (text: string) => text.toLocaleLowerCase('ru').replace(/[\s-]/g, '');

export function placesOf(entry: DirectoryEntry) {
  return [entry.mainAdmin ? 'ГЛАВНЫЙ АДМИН' : null, ...entry.roles.map(role => roleNames[role])].filter((place): place is string => !!place);
}
export const rolesOf = (entry: DirectoryEntry): Place[] => [...(entry.mainAdmin ? ['main' as const] : []), ...entry.roles];

/** A person's roles as the chat shows them: each label in its role's ink with the role's mark. */
export function RoleTags({ entry, center = false }: { entry: DirectoryEntry; center?: boolean }) {
  const styles = useThemeStyles(createStyles);
  return <View style={[styles.roles, center && styles.rolesCenter]}>
    {rolesOf(entry).map(role => <RoleTag key={role} role={role} label={placeLabels[role]} />)}
  </View>;
}

/** How long the walker has waited for an answer, in the section's capitals. */
export function waitedFor(iso: string, now = Date.now()) {
  const minutes = Math.max(1, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} МИН`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} Ч ${minutes % 60} МИН`;
  return `${Math.floor(hours / 24)} ДН ${hours % 24} Ч`;
}

/** Matches the server: only the main admin's own account is out of reach. */
export const canBlock = (entry: DirectoryEntry) => !entry.mainAdmin;

type Confirm = StaffRole | 'block' | null;

/** Everything the main admin can change about one person; reused by the app tab and the admin page. */
export function PersonCard({ session, person, directory, avatars = true, onChanged, onOpenChat, onBack }: {
  session: IntensiveSession; person: DirectoryEntry; directory: DirectoryEntry[]; avatars?: boolean;
  onChanged: () => void; onOpenChat: (chatId: string) => void; onBack?: () => void;
}) {
  const styles = useThemeStyles(createStyles);
  const inks = useRoleInks();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<Confirm>(null);
  const act = async (work: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await work(); onChanged(); }
    catch (problem) { setError(problemText(problem, 'Не получилось. Попробуйте ещё раз.', true)); }
    finally { setBusy(false); setConfirm(null); }
  };

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
    avatar={avatars ? <Avatar name={entry.name} size={36} accent /> : undefined} title={entry.name} badge={entry.mainAdmin ? <RoleTag role="main" label={placeLabels.main} /> : undefined}
    selected={chosen} chevron={false} right={chosen ? <Glyph name="check" size={18} /> : undefined}
    onPress={busy || chosen ? undefined : onPick} last={last} />;
  const lines = [
    `КОД ${shortCode(person.userId)}`,
    places.length ? null : person.guideId ? 'ИДУЩИЙ' : `ИДУЩИЙ · ЖДЁТ ПРОВОДНИКА С ${formatTime(person.createdAt)}`,
    person.blocked ? 'ДОСТУП ЗАКРЫТ' : null,
    person.waitingSince && !person.blocked ? `ЖДЁТ ОТВЕТА ${waitedFor(person.waitingSince)}` : null,
  ].filter((line): line is string => !!line);
  const confirmCopy = confirm === 'block'
    ? { title: 'ЗАКРЫТЬ ДОСТУП?', label: 'ЗАКРЫТЬ ДОСТУП', text: 'Человек не увидит переписку и не сможет писать. История сохранится, доступ можно открыть снова.' }
    : confirm === 'admin' ? { title: 'СНЯТЬ ПРАВА АДМИНА?', label: 'СНЯТЬ', text: 'Проводники этого админа останутся без админа.' }
      : { title: 'СНЯТЬ ПРАВА ПРОВОДНИКА?', label: 'СНЯТЬ', text: 'Идущие этого проводника останутся без проводника.' };

  return <View style={styles.stack}>
    {onBack ? <ProductButton label="← КО ВСЕМ" kind="ghost" onPress={() => { setConfirm(null); onBack(); }} style={styles.backLink} /> : null}
    <ProfileHead name={person.name} accent={isStaff(person)} avatar={avatars} lines={lines} extra={places.length ? <RoleTags entry={person} center /> : undefined} />
    {person.chatId ? <ListGroup card>
      <ListItem glyph="chat" title="Открыть переписку" tone="accent" onPress={busy ? undefined : () => onOpenChat(person.chatId!)} last />
    </ListGroup> : null}
    {guided ? <ListGroup card caption="ПРОВОДНИК" footer="Переписка остаётся у идущего: новый проводник увидит всю историю, прежний теряет доступ.">
      {guides.length ? guides.map((guide, index) => pick(guide, person.guideId === guide.userId, index === guides.length - 1 && !person.guideId,
        () => { void act(() => session.assignGuide(person.userId, guide.userId)); }))
        : <ListItem glyph="people" title={isGuide ? 'Других проводников нет' : 'Проводников пока нет'} hint="Дайте права проводника кому-нибудь из людей" last={!person.guideId} />}
      {person.guideId ? <ListItem glyph="exit" tone="error" title="Снять проводника" chevron={false} last
        onPress={busy ? undefined : () => { void act(() => session.assignGuide(person.userId, null)); }} /> : null}
    </ListGroup> : null}
    <ListGroup card divided caption="ПРАВА" footer={person.mainAdmin ? 'Главного админа назначает владелец сервера, не из приложения.' : undefined}>
      {(['guide', 'admin'] as StaffRole[]).map((role, index) => {
        const on = person.roles.includes(role);
        return <ListItem key={role} avatar={<View style={styles.mark}><RoleMark role={role} ink={inks[role]} size={20} /></View>} title={roleTitles[role]} checked={on}
          accessibilityLabel={`${roleTitles[role]}: ${on ? 'включено' : 'выключено'}`} onPress={busy ? undefined : () => toggle(role)}
          right={<ProductToggle enabled={on} />} last={index === 1} />;
      })}
    </ListGroup>
    {isGuide ? <ListGroup card caption="АДМИН ЭТОГО ПРОВОДНИКА">
      {admins.length ? admins.map((admin, index) => pick(admin, person.adminId === admin.userId, index === admins.length - 1 && !person.adminId,
        () => { void act(() => session.assignAdmin(person.userId, admin.userId, directory)); }))
        : <ListItem glyph="shield" title="Админов пока нет" hint="Дайте права админа проводника кому-нибудь из людей" last={!person.adminId} />}
      {person.adminId ? <ListItem glyph="exit" tone="error" title="Снять админа" chevron={false} last
        onPress={busy ? undefined : () => { void act(() => session.assignAdmin(person.userId, null, directory)); }} /> : null}
    </ListGroup> : null}
    {/* One action needs no section of its own (Art 2026-11-12). */}
    {canBlock(person) ? <ListGroup card>
      {person.blocked
        ? <ListItem glyph="key" tone="accent" title="Открыть доступ" hint="Человек снова увидит свою переписку" chevron={false} last
          onPress={busy ? undefined : () => { void act(() => session.setBlocked(person.userId, false)); }} />
        : <ListItem glyph="lock" tone="error" title="Закрыть доступ" hint="Переписка сохранится, писать будет нельзя" chevron={false} last
          onPress={busy ? undefined : () => setConfirm('block')} />}
    </ListGroup> : null}
    {error ? <Note tone="error">{error}</Note> : null}
    <ConfirmSheet open={confirm !== null} busy={busy} confirmLabel={confirmCopy.label} title={confirmCopy.title} text={confirmCopy.text}
      onConfirm={() => {
        if (confirm === 'block') void act(() => session.setBlocked(person.userId, true));
        else if (confirm) void act(() => session.setRole(person.userId, confirm, false));
      }} onClose={() => setConfirm(null)} />
  </View>;
}

const createStyles = () => StyleSheet.create({
  stack: { gap: 20 },
  backLink: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 4, minWidth: 0 },
  rolesCenter: { justifyContent: 'center' },
  mark: { width: 28, alignItems: 'center' },
});
