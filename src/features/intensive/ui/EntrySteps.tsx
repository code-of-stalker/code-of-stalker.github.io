import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PanelBorder } from '../../product/PanelBorder';
import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import type { ProductColors } from '../../product/theme';
import { fonts } from '../../product/theme';
import { ProductButton, ProductText } from '../../product/ui';
import type { TotpEnrollment } from '../backend';
import type { DemoPersona } from '../demoBackend';
import { Avatar, GlassField, Hero, ListGroup, ListItem, Plate } from './chrome';
import { Note, useFormal } from './parts';

export function Welcome({ personas, onCreate, onRestore, onPersona, busy }: {
  personas: DemoPersona[] | null; onCreate: () => void; onRestore: () => void; onPersona: (persona: DemoPersona) => void; busy: boolean;
}) {
  const styles = useThemeStyles(createStyles);
  return <View style={styles.stack}>
    <Hero glyph="chat" title="ПЕРЕПИСКА С ПРОВОДНИКОМ" lines={['В Интенсиве у каждого идущего есть свой проводник. Здесь вы на связи.']} />
    <ListGroup>
      <ListItem glyph="people" title="Свой проводник" detail="Ты, твой проводник и его админ" />
      <ListItem glyph="lock" title="Шифрование на устройстве" detail="Сервер хранит только шифр. Прочесть могут лишь участники" />
      <ListItem glyph="words" title="Без почты и пароля" detail="Ключ от аккаунта: 12 слов, как у криптокошелька" last />
    </ListGroup>
    <View style={styles.actions}>
      <ProductButton label="СОЗДАТЬ АККАУНТ" onPress={onCreate} disabled={busy} />
      <ProductButton label="У МЕНЯ ЕСТЬ 12 СЛОВ" kind="outline" onPress={onRestore} disabled={busy} />
    </View>
    {personas ? <ListGroup caption="ДЕМО-СЕРВЕР · ТОЛЬКО ПРИ РАЗРАБОТКЕ" footer="Работает в памяти браузера. Войти как:">
      {personas.map((persona, index) => <ListItem key={persona.name} avatar={<Avatar name={persona.name} size={40} />} title={persona.name} detail={persona.label}
        onPress={busy ? undefined : () => onPersona(persona)} last={index === personas.length - 1} />)}
    </ListGroup> : null}
  </View>;
}

export function PhraseView({ words, keyLine, title, intro, doneLabel, onDone }: {
  words: string[]; keyLine: string; title: string; intro: string[]; doneLabel: string; onDone: () => void;
}) {
  const styles = useThemeStyles(createStyles);
  return <View style={styles.stack}>
    <Hero glyph="words" title={title} lines={intro} tight />
    <View style={styles.words}>
      {words.map((word, i) => <View key={i} style={styles.word}>
        <PanelBorder />
        <ProductText numberOfLines={1} maxFontSize={10} style={styles.wordIndex}>{String(i + 1).padStart(2, '0')}</ProductText>
        <ProductText variant="title" selectable numberOfLines={1} style={styles.wordText}>{word}</ProductText>
      </View>)}
    </View>
    <Plate label="ТО ЖЕ САМОЕ ОДНОЙ СТРОКОЙ" title={keyLine} selectable titleStyle={styles.keyLine} />
    <Plate glyph="alert" title="Никому не показывай">Ни Яна, ни проводник, ни разработчик никогда их не спросят. Если потеряешь слова и забудешь PIN, аккаунт не вернуть.</Plate>
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
    <Hero glyph="check" title="ПРОВЕРИМ ЗАПИСЬ" lines={['Введи слова под этими номерами.']} tight />
    {positions.map((position, i) => <GlassField key={position} label={`СЛОВО № ${position + 1}`} value={typed[i]} autoCapitalize="none" autoFocus={i === 0}
      onChangeText={text => setTyped(current => current.map((value, j) => j === i ? text : value))}
      returnKeyType={i === positions.length - 1 ? 'done' : 'next'}
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
    <Hero glyph="person" title="КАК ТЕБЯ НАЗЫВАТЬ" lines={['Имя увидят только участники твоей переписки и главный админ. Можно не настоящее.']} tight />
    <GlassField label="ИМЯ" value={name} maxLength={40} autoFocus placeholder="Например, Алекс" onChangeText={setName} onSubmitEditing={() => valid && onSubmit(name)} />
    {error ? <Note tone="error">{error}</Note> : null}
    <ProductButton label={busy ? 'СОХРАНЯЮ…' : 'ДАЛЬШЕ'} onPress={() => onSubmit(name)} disabled={busy || !valid} />
  </View>;
}

/** `notice` replaces the line about the PIN where this sign-in stays on the page only. */
export function RestoreStep({ busy, error, onSubmit, notice }: { busy: boolean; error: string; onSubmit: (text: string) => void; notice?: string }) {
  const styles = useThemeStyles(createStyles);
  const formal = useFormal();
  const [text, setText] = useState('');
  return <View style={styles.stack}>
    <Hero glyph="key" title="ВХОД ПО 12 СЛОВАМ" lines={[notice ?? (formal ? 'Введите 12 слов через пробел или строку из 32 знаков. Слова останутся только на этом устройстве, под PIN.'
      : 'Введи 12 слов через пробел или строку из 32 знаков. Слова останутся только на этом устройстве, под PIN.')]} tight />
    <GlassField label="12 СЛОВ ИЛИ СТРОКА" value={text} multiline autoFocus autoCapitalize="none" autoComplete="off" onChangeText={setText} />
    {error ? <Note tone="error">{error}</Note> : null}
    <ProductButton label={busy ? 'ИЩУ АККАУНТ…' : 'ВОЙТИ'} onPress={() => onSubmit(text)} disabled={busy || !text.trim()} />
  </View>;
}

function CodeField({ busy, error, label, onSubmit }: { busy: boolean; error: string; label: string; onSubmit: (code: string) => void }) {
  const styles = useThemeStyles(createStyles);
  const [code, setCode] = useState('');
  const valid = /^\d{6}$/.test(code);
  return <View style={styles.stack}>
    <GlassField label="КОД ИЗ 6 ЦИФР" value={code} maxLength={6} keyboardType="number-pad" inputMode="numeric" autoComplete="one-time-code" autoFocus
      placeholder="000000" style={styles.code} accessibilityLabel="Код из 6 цифр"
      onChangeText={text => setCode(text.replace(/\D/g, ''))} onSubmitEditing={() => valid && onSubmit(code)} />
    {error ? <Note tone="error">{error}</Note> : null}
    <ProductButton label={busy ? 'ПРОВЕРЯЮ…' : label} onPress={() => onSubmit(code)} disabled={busy || !valid} />
  </View>;
}

function StepNumber({ value }: { value: number }) {
  return <Avatar name={String(value)} size={32} accent />;
}

export function TotpEnroll({ enrollment, required, busy, error, onVerify, onSkip }: {
  enrollment: TotpEnrollment | null; required: boolean; busy: boolean; error: string; onVerify: (code: string) => void; onSkip?: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const formal = useFormal();
  return <View style={styles.stack}>
    <Hero glyph="shield" title="КОДЫ ИЗ ПРИЛОЖЕНИЯ" tight lines={[required
      ? formal ? 'У вас есть права главного админа, поэтому вход защищён вторым ключом: кодом с телефона.'
        : 'У тебя есть права проводника или админа, поэтому вход защищён вторым ключом: кодом с телефона.'
      : 'Второй ключ: при входе, кроме PIN, нужен будет код с телефона.']} />
    <ListGroup>
      <ListItem avatar={<StepNumber value={1} />} title={formal ? 'Поставьте приложение' : 'Поставь приложение'} detail="Google Authenticator, Aegis или 2FAS" />
      <ListItem avatar={<StepNumber value={2} />} title={formal ? 'Добавьте ключ' : 'Добавь ключ'}
        detail={formal ? 'Наведите камеру на квадрат или введите ключ вручную' : 'Наведи камеру на квадрат или введи ключ вручную'} />
      <ListItem avatar={<StepNumber value={3} />} title={formal ? 'Введите 6 цифр' : 'Введи 6 цифр'} detail="Их покажет приложение" last />
    </ListGroup>
    {enrollment ? <>
      <View style={styles.qrWrap}>
        <View style={styles.qrPlate}><Image source={{ uri: enrollment.qr }} style={styles.qr} contentFit="contain" accessibilityLabel="QR-код для приложения" /></View>
      </View>
      <View style={styles.secretBlock}>
        <ProductText maxFontSize={10} style={[styles.caption, { color: colors.muted }]}>КЛЮЧ ДЛЯ РУЧНОГО ВВОДА</ProductText>
        <ProductText selectable style={styles.secret}>{enrollment.secret.replace(/(.{4})/g, '$1 ').trim()}</ProductText>
      </View>
      <CodeField busy={busy} error={error} label="ВКЛЮЧИТЬ" onSubmit={onVerify} />
    </> : error ? <Note tone="error">{error}</Note> : <Note center>Готовлю ключ…</Note>}
    {onSkip ? <ProductButton label="НЕ СЕЙЧАС" kind="ghost" onPress={onSkip} disabled={busy} /> : null}
  </View>;
}

export function TotpVerify({ busy, error, onVerify }: { busy: boolean; error: string; onVerify: (code: string) => void }) {
  const styles = useThemeStyles(createStyles);
  const formal = useFormal();
  return <View style={styles.stack}>
    <Hero glyph="shield" title="КОД ИЗ ПРИЛОЖЕНИЯ" lines={[formal ? 'Откройте приложение с кодами и введите 6 цифр для «Code Of Stalker».'
      : 'Открой приложение с кодами и введи 6 цифр для «Code Of Stalker».']} tight />
    <CodeField busy={busy} error={error} label="ВОЙТИ" onSubmit={onVerify} />
  </View>;
}

export function Waiting({ name, code, busy, onRefresh }: { name: string; code: string; busy: boolean; onRefresh: () => void }) {
  const styles = useThemeStyles(createStyles);
  return <View style={styles.stack}>
    <Hero glyph="clock" title={`${name}, ПРОВОДНИК СКОРО БУДЕТ`} lines={['Яна назначит тебе проводника. Когда это случится, здесь откроется ваша переписка.']} />
    <Plate glyph="person" label="ТВОЙ КОД" title={code} selectable titleStyle={styles.ownCode}>Назови его Яне, чтобы она нашла тебя быстрее.</Plate>
    <ProductButton label={busy ? 'ПРОВЕРЯЮ…' : 'ПРОВЕРИТЬ СНОВА'} kind="outline" onPress={onRefresh} disabled={busy} />
  </View>;
}

export function Unavailable({ title, lines, onBack }: { title: string; lines: string[]; onBack: () => void }) {
  const styles = useThemeStyles(createStyles);
  return <View style={styles.stack}>
    <Hero glyph="alert" title={title} lines={lines} />
    <ProductButton label="ВЕРНУТЬСЯ К УРОВНЯМ" onPress={onBack} />
  </View>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  stack: { gap: 20 },
  actions: { gap: 12 },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Two columns: the longest words (8 letters) fit a phone cell without wrapping.
  word: { flexGrow: 1, flexBasis: '40%', minWidth: 140, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  wordIndex: { minWidth: 22, fontSize: 8, lineHeight: 12, color: colors.faint },
  wordText: { fontSize: 16, lineHeight: 22, fontWeight: '500', color: colors.text },
  keyLine: { fontFamily: fonts.body, fontWeight: '400', fontSize: 12, lineHeight: 20, letterSpacing: .5 },
  caption: { fontSize: 8, lineHeight: 12, letterSpacing: 1.6, textAlign: 'center' },
  qrWrap: { alignItems: 'center' },
  // A QR code needs dark marks on a light field to scan in every theme.
  qrPlate: { backgroundColor: '#FFFFFF', padding: 12 },
  qr: { width: 184, height: 184 },
  secretBlock: { gap: 8 },
  secret: { textAlign: 'center', fontSize: 12, lineHeight: 20, letterSpacing: 1, color: colors.text },
  code: { textAlign: 'center', fontSize: 24, lineHeight: 30, letterSpacing: 8 },
  ownCode: { fontSize: 24, lineHeight: 30, letterSpacing: 2 },
});
