import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import { ProductText } from '../../product/ui';
import { phraseKey, phraseWords } from '../phrase';
import type { IntensiveSession } from '../session';
import { shortCode } from '../session';
import { ConfirmSheet, ListGroup, ListItem, ProfileHead } from './chrome';
import { PhraseView } from './EntrySteps';
import { Note, placeLabels } from './parts';

/** The account as Telegram settings: a profile head, then grouped rows. */
export function AccountView({ session, busy, error, onEnableTotp, onChangePin, onForget }: {
  session: IntensiveSession; busy: boolean; error: string;
  onEnableTotp: () => void; onChangePin: () => void; onForget: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const [words, setWords] = useState(false);
  const [forget, setForget] = useState(false);
  const status = session.status!;
  if (words) {
    const secret = session.secret();
    return <PhraseView words={phraseWords(secret)} keyLine={phraseKey(secret)} title="ТВОИ 12 СЛОВ" doneLabel="СКРЫТЬ"
      intro={['Покажи их себе, только если рядом никого нет и экран не записывается.']} onDone={() => setWords(false)} />;
  }
  const places = [status.mainAdmin ? placeLabels.main : null, ...status.roles.map(role => placeLabels[role])].filter((place): place is string => !!place);
  const staff = places.length > 0;
  return <View style={styles.stack}>
    <ProfileHead name={status.name ?? ''} accent={staff} lines={[`КОД ${shortCode(status.id)}`, places.length ? places.join(' · ') : placeLabels.walker]} />
    <ListGroup caption="КЛЮЧ ОТ АККАУНТА" footer="По 12 словам аккаунт открывается на любом устройстве. Храни их на бумаге, не в заметках и не в облаке.">
      <ListItem glyph="words" title="Показать 12 слов" onPress={busy ? undefined : () => setWords(true)} last />
    </ListGroup>
    <ListGroup caption="ВХОД" footer={status.hasTotp
      ? 'При входе на новом устройстве нужен будет код с телефона.'
      : 'Необязательный второй ключ: даже со словами в аккаунт не войти без кода с твоего телефона.'}>
      <ListItem glyph="shield" title="Коды из приложения" onPress={status.hasTotp || busy ? undefined : onEnableTotp}
        right={<ProductText maxFontSize={10} style={[styles.value, { color: status.hasTotp ? colors.accent : colors.muted }]}>{status.hasTotp ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛ'}</ProductText>}
        chevron={!status.hasTotp} last />
    </ListGroup>
    <ListGroup caption="ЭТО УСТРОЙСТВО" footer="Здесь слова хранятся под PIN. После 5 неверных PIN аккаунт удаляется с устройства и возвращается только по 12 словам.">
      <ListItem glyph="lock" title="Сменить PIN" onPress={busy || !session.sealed ? undefined : onChangePin} />
      <ListItem glyph="exit" title="Убрать с этого устройства" tone="error" chevron={false} onPress={busy ? undefined : () => setForget(true)} last />
    </ListGroup>
    {error ? <Note tone="error">{error}</Note> : null}
    <ConfirmSheet open={forget} title="УБРАТЬ АККАУНТ?" confirmLabel="УБРАТЬ" busy={busy}
      text="Аккаунт исчезнет с этого устройства. Вернуть его можно будет только по 12 словам."
      onConfirm={() => { setForget(false); onForget(); }} onClose={() => setForget(false)} />
  </View>;
}

const createStyles = () => StyleSheet.create({
  stack: { gap: 24 },
  value: { fontSize: 8, lineHeight: 12, letterSpacing: .8 },
});
