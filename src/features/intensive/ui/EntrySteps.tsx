import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PanelBorder } from '../../product/PanelBorder';
import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import type { ProductColors } from '../../product/theme';
import { Panel, ProductButton, ProductText } from '../../product/ui';
import type { TotpEnrollment } from '../backend';
import type { DemoPersona } from '../demoBackend';
import { Divider, Field, Heading, Note, Row } from './parts';

export function Welcome({ personas, onCreate, onRestore, onPersona, busy }: {
  personas: DemoPersona[] | null; onCreate: () => void; onRestore: () => void; onPersona: (persona: DemoPersona) => void; busy: boolean;
}) {
  const styles = useThemeStyles(createStyles);
  return <View style={styles.stack}>
    <Heading>ПЕРЕПИСКА С ПРОВОДНИКОМ</Heading>
    <Note>В Интенсиве у каждого идущего есть свой проводник. Здесь вы переписываетесь: ты, твой проводник и его админ.</Note>
    <Note>Сообщения шифруются на твоём устройстве. Сервер хранит только шифр, прочитать его могут лишь участники переписки.</Note>
    <Divider />
    <View style={styles.actions}>
      <ProductButton label="СОЗДАТЬ АККАУНТ" onPress={onCreate} disabled={busy} />
      <ProductButton label="У МЕНЯ ЕСТЬ 12 СЛОВ" kind="outline" onPress={onRestore} disabled={busy} />
    </View>
    {personas ? <View style={styles.stack}>
      <Divider />
      <Note>Демо-сервер: работает только при разработке, в памяти браузера. Войти как:</Note>
      {personas.map(persona => <Row key={persona.name} title={persona.name} detail={persona.label} onPress={busy ? undefined : () => onPersona(persona)} />)}
    </View> : null}
  </View>;
}

export function PhraseView({ words, keyLine, title, intro, doneLabel, onDone }: {
  words: string[]; keyLine: string; title: string; intro: string[]; doneLabel: string; onDone: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return <View style={styles.stack}>
    <Heading>{title}</Heading>
    {intro.map(line => <Note key={line}>{line}</Note>)}
    <View style={styles.words}>
      {words.map((word, i) => <View key={i} style={styles.word}>
        <PanelBorder />
        <ProductText variant="label" numberOfLines={1} style={styles.wordIndex}>{String(i + 1).padStart(2, '0')}</ProductText>
        <ProductText selectable numberOfLines={1} style={styles.wordText}>{word}</ProductText>
      </View>)}
    </View>
    <Panel style={styles.keyPanel}>
      <ProductText variant="label" style={{ color: colors.muted }}>ТО ЖЕ САМОЕ ОДНОЙ СТРОКОЙ</ProductText>
      <ProductText selectable style={styles.keyLine}>{keyLine}</ProductText>
    </Panel>
    <Note tone="text">Никому не показывай эти слова. Ни Яна, ни проводник, ни разработчик никогда их не спросят. Если потеряешь слова и забудешь PIN, аккаунт не вернуть.</Note>
    <ProductButton label={doneLabel} onPress={onDone} />
  </View>;
}

export function ConfirmWords({ words, positions, busy, error, onConfirmed, onBack }: {
  words: string[]; positions: number[]; busy: boolean; error: string; onConfirmed: () => void; onBack: () => void;
}) {
  const styles = useThemeStyles(createStyles);
  const [typed, setTyped] = useState<string[]>(positions.map(() => ''));
  const [mismatch, setMismatch] = useState(false);
  const check = () => {
    const ok = positions.every((position, i) => typed[i].trim().toLowerCase() === words[position]);
    setMismatch(!ok);
    if (ok) onConfirmed();
  };
  return <View style={styles.stack}>
    <Heading>ПРОВЕРИМ ЗАПИСЬ</Heading>
    <Note>Введи слова под этими номерами.</Note>
    {positions.map((position, i) => <Field key={position} label={`СЛОВО № ${position + 1}`} value={typed[i]} autoCapitalize="none"
      onChangeText={text => setTyped(current => current.map((value, j) => j === i ? text : value))}
      onSubmitEditing={i === positions.length - 1 ? check : undefined} />)}
    {mismatch ? <Note tone="error">Слова не совпали. Проверь запись.</Note> : null}
    {error ? <Note tone="error">{error}</Note> : null}
    <View style={styles.actions}>
      <ProductButton label={busy ? 'СОЗДАЮ АККАУНТ…' : 'ПРОВЕРИТЬ'} onPress={check} disabled={busy || typed.some(value => !value.trim())} />
      <ProductButton label="ПОКАЗАТЬ СЛОВА ЕЩЁ РАЗ" kind="ghost" onPress={onBack} disabled={busy} />
    </View>
  </View>;
}

export function NameStep({ busy, error, onSubmit }: { busy: boolean; error: string; onSubmit: (name: string) => void }) {
  const styles = useThemeStyles(createStyles);
  const [name, setName] = useState('');
  const valid = name.trim().length >= 1 && name.trim().length <= 40;
  return <View style={styles.stack}>
    <Heading>КАК ТЕБЯ НАЗЫВАТЬ</Heading>
    <Note>Имя увидят только участники твоей переписки и главный админ. Можно не настоящее.</Note>
    <Field label="ИМЯ" value={name} maxLength={40} autoFocus onChangeText={setName} onSubmitEditing={() => valid && onSubmit(name)} />
    {error ? <Note tone="error">{error}</Note> : null}
    <ProductButton label={busy ? 'СОХРАНЯЮ…' : 'ДАЛЬШЕ'} onPress={() => onSubmit(name)} disabled={busy || !valid} />
  </View>;
}

export function RestoreStep({ busy, error, onSubmit }: { busy: boolean; error: string; onSubmit: (text: string) => void }) {
  const styles = useThemeStyles(createStyles);
  const [text, setText] = useState('');
  return <View style={styles.stack}>
    <Heading>ВХОД ПО 12 СЛОВАМ</Heading>
    <Note>Введи 12 слов через пробел или строку из 32 знаков. Слова останутся только на этом устройстве, под PIN.</Note>
    <Field label="12 СЛОВ ИЛИ СТРОКА" value={text} multiline autoCapitalize="none" autoComplete="off" onChangeText={setText} />
    {error ? <Note tone="error">{error}</Note> : null}
    <ProductButton label={busy ? 'ИЩУ АККАУНТ…' : 'ВОЙТИ'} onPress={() => onSubmit(text)} disabled={busy || !text.trim()} />
  </View>;
}

function CodeField({ busy, error, label, onSubmit }: { busy: boolean; error: string; label: string; onSubmit: (code: string) => void }) {
  const styles = useThemeStyles(createStyles);
  const [code, setCode] = useState('');
  const valid = /^\d{6}$/.test(code);
  return <View style={styles.stack}>
    <Field label="КОД ИЗ 6 ЦИФР" value={code} maxLength={6} keyboardType="number-pad" inputMode="numeric" autoComplete="one-time-code" autoFocus
      onChangeText={text => setCode(text.replace(/\D/g, ''))} onSubmitEditing={() => valid && onSubmit(code)} />
    {error ? <Note tone="error">{error}</Note> : null}
    <ProductButton label={busy ? 'ПРОВЕРЯЮ…' : label} onPress={() => onSubmit(code)} disabled={busy || !valid} />
  </View>;
}

export function TotpEnroll({ enrollment, required, busy, error, onVerify, onSkip }: {
  enrollment: TotpEnrollment | null; required: boolean; busy: boolean; error: string; onVerify: (code: string) => void; onSkip?: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return <View style={styles.stack}>
    <Heading>КОДЫ ИЗ ПРИЛОЖЕНИЯ</Heading>
    <Note>{required
      ? 'У тебя есть права проводника или админа, поэтому вход защищён вторым ключом: кодом из приложения на телефоне.'
      : 'Второй ключ: при входе, кроме PIN, нужен будет код из приложения на телефоне.'}</Note>
    <Note>Поставь Google Authenticator, Aegis или 2FAS, нажми «добавить» и наведи камеру на квадрат. Или введи ключ вручную.</Note>
    {enrollment ? <>
      <View style={styles.qrPlate}><Image source={{ uri: enrollment.qr }} style={styles.qr} contentFit="contain" accessibilityLabel="QR-код для приложения" /></View>
      <ProductText variant="label" style={{ color: colors.muted, textAlign: 'center' }}>КЛЮЧ ДЛЯ РУЧНОГО ВВОДА</ProductText>
      <ProductText selectable style={styles.secret}>{enrollment.secret.replace(/(.{4})/g, '$1 ').trim()}</ProductText>
      <Note>Потом введи 6 цифр, которые покажет приложение.</Note>
      <CodeField busy={busy} error={error} label="ВКЛЮЧИТЬ" onSubmit={onVerify} />
    </> : error ? <Note tone="error">{error}</Note> : <Note>Готовлю ключ…</Note>}
    {onSkip ? <ProductButton label="НЕ СЕЙЧАС" kind="ghost" onPress={onSkip} disabled={busy} /> : null}
  </View>;
}

export function TotpVerify({ busy, error, onVerify }: { busy: boolean; error: string; onVerify: (code: string) => void }) {
  const styles = useThemeStyles(createStyles);
  return <View style={styles.stack}>
    <Heading>КОД ИЗ ПРИЛОЖЕНИЯ</Heading>
    <Note>Открой приложение с кодами и введи 6 цифр для «Code Of Stalker».</Note>
    <CodeField busy={busy} error={error} label="ВОЙТИ" onSubmit={onVerify} />
  </View>;
}

export function Waiting({ name, code, busy, onRefresh }: { name: string; code: string; busy: boolean; onRefresh: () => void }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return <View style={styles.stack}>
    <Heading>{`${name}, ПРОВОДНИК СКОРО БУДЕТ`}</Heading>
    <Note>Яна назначит тебе проводника. Когда это случится, здесь откроется ваша переписка.</Note>
    <Panel style={styles.keyPanel}>
      <ProductText variant="label" style={{ color: colors.muted }}>ТВОЙ КОД</ProductText>
      <ProductText selectable variant="title" style={styles.code}>{code}</ProductText>
      <ProductText variant="label" style={{ color: colors.muted, lineHeight: 15 }}>Назови его Яне, чтобы она нашла тебя быстрее.</ProductText>
    </Panel>
    <ProductButton label={busy ? 'ПРОВЕРЯЮ…' : 'ПРОВЕРИТЬ СНОВА'} kind="outline" onPress={onRefresh} disabled={busy} />
  </View>;
}

export function Unavailable({ title, lines, onBack }: { title: string; lines: string[]; onBack: () => void }) {
  const styles = useThemeStyles(createStyles);
  return <View style={styles.stack}>
    <Heading>{title}</Heading>
    {lines.map(line => <Note key={line}>{line}</Note>)}
    <ProductButton label="ВЕРНУТЬСЯ К УРОВНЯМ" onPress={onBack} />
  </View>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  stack: { gap: 16 },
  actions: { gap: 12 },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Two columns: the longest words (8 letters) fit a phone cell without wrapping.
  word: { flexGrow: 1, flexBasis: '40%', minWidth: 140, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  wordIndex: { minWidth: 24, color: colors.faint },
  wordText: { fontSize: 14, lineHeight: 18, color: colors.text },
  keyPanel: { gap: 8 },
  keyLine: { fontSize: 13, lineHeight: 20, letterSpacing: .5, color: colors.text },
  qrPlate: { alignSelf: 'center', backgroundColor: '#FFFFFF', padding: 12 },
  qr: { width: 184, height: 184 },
  secret: { textAlign: 'center', fontSize: 13, lineHeight: 20, letterSpacing: 1, color: colors.text },
  code: { fontSize: 24, lineHeight: 32, letterSpacing: 2 },
});
