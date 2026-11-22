import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DiaryDesignPanel } from '../../product/diary/DiaryDesignPanel';
import { canCopy } from '../../product/messages/menu';
import { BottomSheet } from '../../product/motion/BottomSheet';
import { useThemeStyles } from '../../product/ProductTheme';
import { useProduct } from '../../product/state/ProductProvider';
import type { ProductColors } from '../../product/theme';
import { ProductButton, ProductText } from '../../product/ui';
import type { Invite } from '../backend';
import type { IntensiveSession } from '../session';
import { GlassField, ListGroup, ListItem, Plate } from './chrome';
import { Note, problemText } from './parts';

const DEFAULT_USES = 3, DEFAULT_DAYS = 30;
const LIMITS = { uses: 100, days: 365 };

type Sheet =
  | { kind: 'create'; uses: string; days: string }
  | { kind: 'code'; invite: Invite; made: boolean }
  | { kind: 'revoke'; invite: Invite };

/** XXXX-XXXX-XXXX, as the person types it. */
export const showCode = (code: string) => code.match(/.{1,4}/g)?.join('-') ?? code;

function day(iso: string) {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('ru-RU', sameYear ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function stateOf(invite: Invite, now: number) {
  if (invite.revokedAt) return { open: false, line: `ОТОЗВАН ${day(invite.revokedAt)} · ВОШЛИ ${invite.used} ИЗ ${invite.maxUses}` };
  if (Date.parse(invite.expiresAt) <= now) return { open: false, line: `ИСТЁК ${day(invite.expiresAt)} · ВОШЛИ ${invite.used} ИЗ ${invite.maxUses}` };
  if (invite.used >= invite.maxUses) return { open: false, line: `ИСПОЛЬЗОВАН · ВОШЛИ ${invite.used} ИЗ ${invite.maxUses}` };
  return { open: true, line: `ОСТАЛОСЬ ${invite.maxUses - invite.used} ИЗ ${invite.maxUses} · ДО ${day(invite.expiresAt)}` };
}

const whole = (text: string, max: number) => /^\d{1,3}$/.test(text) && +text >= 1 && +text <= max;

/**
 * The main admin's invite codes: a new person needs one to create an account; signing in
 * by the 12 words needs none. Codes are made, listed and revoked only on the server.
 */
export function InviteCodes({ session }: { session: IntensiveSession }) {
  const styles = useThemeStyles(createStyles);
  const { settings } = useProduct();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [sheetError, setSheetError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    session.invites().then(
      list => { if (alive) { setInvites(list); setLoadedAt(Date.now()); setError(''); } },
      problem => { if (alive) setError(problemText(problem, 'Не удалось загрузить коды приглашения.', true)); });
    return () => { alive = false; };
  }, [session, version]);

  const open = (next: Sheet | null) => { setSheet(next); setSheetError(''); setCopied(false); };
  const act = async (work: () => Promise<void>, fallback: string) => {
    setBusy(true); setSheetError('');
    try { await work(); } catch (problem) { setSheetError(problemText(problem, fallback, true)); } finally { setBusy(false); }
  };

  const create = (uses: string, days: string) => act(async () => {
    const shown = await session.createInvite(+uses, +days);
    const list = await session.invites();
    setInvites(list); setLoadedAt(Date.now());
    const made = list.find(item => item.code === shown.replaceAll('-', ''));
    if (made) open({ kind: 'code', invite: made, made: true }); else open(null);
  }, 'Не удалось создать код. Попробуйте ещё раз.');
  const revoke = (invite: Invite) => act(async () => {
    await session.revokeInvite(invite.id);
    open(null); setVersion(current => current + 1);
  }, 'Не удалось отозвать код. Попробуйте ещё раз.');
  const copy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => setCopied(true), () => setSheetError('Не удалось скопировать. Выделите код и скопируйте вручную.'));
  };

  const rows = (invites ?? []).map(invite => ({ invite, ...stateOf(invite, loadedAt) }));
  const active = rows.filter(row => row.open), closed = rows.filter(row => !row.open);

  // ------------------------------------------------------------- sheet

  let title = '', body = null, footer = null;
  if (sheet?.kind === 'create') {
    const valid = whole(sheet.uses, LIMITS.uses) && whole(sheet.days, LIMITS.days);
    title = 'НОВЫЙ КОД';
    body = <View style={styles.sheetBody}>
      <GlassField label="СКОЛЬКО ЧЕЛОВЕК ВОЙДЁТ ПО НЕМУ" value={sheet.uses} maxLength={3} keyboardType="number-pad" inputMode="numeric"
        accessibilityLabel="Сколько человек войдёт по коду" onChangeText={text => setSheet({ ...sheet, uses: text.replace(/\D/g, '') })} />
      <GlassField label="СКОЛЬКО ДНЕЙ ДЕЙСТВУЕТ" value={sheet.days} maxLength={3} keyboardType="number-pad" inputMode="numeric"
        accessibilityLabel="Сколько дней действует код" onChangeText={text => setSheet({ ...sheet, days: text.replace(/\D/g, '') })}
        onSubmitEditing={() => { if (valid && !busy) void create(sheet.uses, sheet.days); }} />
      {!valid ? <Note tone="error">{`Людей: от 1 до ${LIMITS.uses}. Дней: от 1 до ${LIMITS.days}.`}</Note> : null}
      {sheetError ? <Note tone="error">{sheetError}</Note> : null}
    </View>;
    footer = <View style={styles.actions}>
      <ProductButton label={busy ? 'СОЗДАЮ…' : 'СОЗДАТЬ'} onPress={() => { void create(sheet.uses, sheet.days); }} disabled={busy || !valid} />
      <ProductButton label="ОТМЕНА" kind="outline" onPress={() => open(null)} disabled={busy} />
    </View>;
  } else if (sheet?.kind === 'code') {
    const state = stateOf(sheet.invite, loadedAt);
    title = sheet.made ? 'КОД СОЗДАН' : 'КОД ПРИГЛАШЕНИЯ';
    body = <View style={styles.sheetBody}>
      <Plate glyph="key" label={state.line} title={showCode(sheet.invite.code)} selectable titleStyle={styles.bigCode} />
      <ProductText style={styles.copy}>{state.open
        ? 'Передайте код человеку. Он введёт его, когда будет создавать аккаунт в Интенсиве. Вход по 12 словам кода не требует.'
        : 'Этот код больше не открывает вход. Те, кто уже вошёл по нему, остаются в Интенсиве.'}</ProductText>
      {copied ? <Note tone="text">Код скопирован.</Note> : null}
      {sheetError ? <Note tone="error">{sheetError}</Note> : null}
    </View>;
    footer = <View style={styles.actions}>
      {state.open && canCopy() ? <ProductButton label="СКОПИРОВАТЬ" onPress={() => copy(showCode(sheet.invite.code))} /> : null}
      {state.open ? <ProductButton label="ОТОЗВАТЬ КОД" kind="outline" onPress={() => open({ kind: 'revoke', invite: sheet.invite })} /> : null}
      <ProductButton label="ГОТОВО" kind={state.open ? 'ghost' : 'primary'} onPress={() => open(null)} />
    </View>;
  } else if (sheet?.kind === 'revoke') {
    title = 'ОТОЗВАТЬ КОД?';
    body = <View style={styles.sheetBody}>
      <ProductText style={styles.copy}>{`Код ${showCode(sheet.invite.code)} перестанет открывать вход. Те, кто уже вошёл по нему, останутся в Интенсиве.`}</ProductText>
      {sheetError ? <Note tone="error">{sheetError}</Note> : null}
    </View>;
    footer = <View style={styles.actions}>
      <ProductButton label={busy ? 'ОТЗЫВАЮ…' : 'ОТОЗВАТЬ КОД'} onPress={() => { void revoke(sheet.invite); }} disabled={busy} />
      <ProductButton label="НАЗАД" kind="outline" onPress={() => open({ kind: 'code', invite: sheet.invite, made: false })} disabled={busy} />
    </View>;
  }

  // ------------------------------------------------------------- list

  const item = ({ invite, line }: (typeof rows)[number], last: boolean) => <ListItem key={invite.id} title={showCode(invite.code)} detail={line}
    accessibilityLabel={`Код ${showCode(invite.code)}. ${line}`} onPress={() => open({ kind: 'code', invite, made: false })} last={last} />;

  return <View style={styles.stack}>
    <ListGroup card caption={invites ? `КОДЫ ПРИГЛАШЕНИЯ · ${active.length}` : 'КОДЫ ПРИГЛАШЕНИЯ'}
      footer="Новый человек вводит код, когда создаёт аккаунт. Вход по 12 словам кода не требует.">
      <ListItem glyph="key" tone="accent" title="Создать код" detail={`${DEFAULT_USES} ЧЕЛОВЕКА · ${DEFAULT_DAYS} ДНЕЙ`}
        onPress={() => open({ kind: 'create', uses: String(DEFAULT_USES), days: String(DEFAULT_DAYS) })} last={!!invites && !active.length && !closed.length} />
      {invites ? <>
        {active.map((row, index) => item(row, index === active.length - 1 && !closed.length))}
        {closed.length ? <ListItem title={showClosed ? 'Скрыть недействующие' : `Недействующие: ${closed.length}`} chevron={false}
          onPress={() => setShowClosed(current => !current)} last={!showClosed} /> : null}
        {showClosed ? closed.map((row, index) => item(row, index === closed.length - 1)) : null}
      </> : error ? null : <ListItem title="Загружаю коды…" last />}
    </ListGroup>
    {error ? <Note tone="error">{error}</Note> : null}
    <BottomSheet open={sheet !== null} onClose={() => { if (!busy) open(null); }} reducedMotion={settings.reducedMotion}>
      <DiaryDesignPanel title={title} onClose={() => open(null)} closeDisabled={busy} footer={footer}>{body}</DiaryDesignPanel>
    </BottomSheet>
  </View>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  stack: { gap: 12 },
  sheetBody: { gap: 16 },
  actions: { gap: 12 },
  copy: { fontSize: 12, lineHeight: 20, color: colors.text },
  bigCode: { fontSize: 22, lineHeight: 30, letterSpacing: 2 },
});
