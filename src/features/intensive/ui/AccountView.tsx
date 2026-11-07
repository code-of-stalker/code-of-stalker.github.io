import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import { Panel, ProductButton, ProductText } from '../../product/ui';
import { phraseKey, phraseWords } from '../phrase';
import type { IntensiveSession } from '../session';
import { shortCode } from '../session';
import { PhraseView } from './EntrySteps';
import { Divider, Heading, Note, placeLabels } from './parts';

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
  const places = [status.mainAdmin ? placeLabels.main : null, ...status.roles.map(role => placeLabels[role])].filter(Boolean);
  return <View style={styles.stack}>
    <Panel style={styles.panel}>
      <ProductText variant="title" style={styles.name}>{status.name}</ProductText>
      <ProductText variant="label" style={{ color: colors.muted }}>{`КОД ${shortCode(status.id)}${places.length ? ' · ' + places.join(' · ') : ''}`}</ProductText>
    </Panel>
    <Heading>12 СЛОВ</Heading>
    <Note>По ним аккаунт открывается на любом устройстве. Храни их на бумаге, не в заметках и не в облаке.</Note>
    <ProductButton label="ПОКАЗАТЬ 12 СЛОВ" kind="outline" onPress={() => setWords(true)} disabled={busy} />
    <Divider />
    <Heading>КОДЫ ИЗ ПРИЛОЖЕНИЯ</Heading>
    {status.hasTotp
      ? <Note>{'Включены. При входе на новом устройстве нужен будет код.'}</Note>
      : <>
        <Note>Необязательный второй ключ: даже со словами в аккаунт не войти без кода с твоего телефона.</Note>
        <ProductButton label="ВКЛЮЧИТЬ" kind="outline" onPress={onEnableTotp} disabled={busy} />
      </>}
    <Divider />
    <Heading>ЭТО УСТРОЙСТВО</Heading>
    <Note>Здесь слова хранятся под PIN. После 5 неверных PIN аккаунт удаляется с устройства и возвращается только по 12 словам.</Note>
    <ProductButton label="СМЕНИТЬ PIN" kind="outline" onPress={onChangePin} disabled={busy || !session.sealed} />
    {forget ? <View style={styles.stack}>
      <Note tone="text">Убрать аккаунт с этого устройства? Вернуть его можно будет только по 12 словам.</Note>
      <View style={styles.row}>
        <ProductButton label="УБРАТЬ" onPress={onForget} disabled={busy} style={styles.flex} />
        <ProductButton label="ОТМЕНА" kind="outline" onPress={() => setForget(false)} disabled={busy} style={styles.flex} />
      </View>
    </View> : <ProductButton label="УБРАТЬ С ЭТОГО УСТРОЙСТВА" kind="ghost" onPress={() => setForget(true)} disabled={busy} />}
    {error ? <Note tone="error">{error}</Note> : null}
  </View>;
}

const createStyles = () => StyleSheet.create({
  stack: { gap: 12 },
  panel: { gap: 6 },
  name: { fontSize: 20, lineHeight: 26 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
