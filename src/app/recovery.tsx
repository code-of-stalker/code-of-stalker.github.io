import { Link, Stack } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import GroupAudioPreview from '../components/voice/GroupAudioPreview';
import type { IncomingVoiceReport } from '../matrix/audio-checkpoint';
import { AudioProbeError } from '../matrix/audio-probe';
import { hasSavedMatrixSession, loginMatrix, restoreMatrixSession, savedMatrixSessionHasDiary } from '../matrix/network';
import { networkErrorText } from '../matrix/network-types';
import type { MatrixTestSession } from '../matrix/network-types';

export default function RecoveryTestScreen() {
  const headerHeight = useHeaderHeight();
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState('https://matrix-client.matrix.org');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [userId, setUserId] = useState('');
  const [stage, setStage] = useState('Проверяем, что это чистая установка');
  const [error, setError] = useState('');
  const [result, setResult] = useState<IncomingVoiceReport | null>(null);
  const [oldInstallation, setOldInstallation] = useState(false);
  const session = useRef<MatrixTestSession | null>(null);
  const operation = useRef<AbortController | null>(null);
  const pending = useRef<Promise<unknown> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        if (await savedMatrixSessionHasDiary()) {
          if (mounted.current) {
            setOldInstallation(true);
            setStage('Это прежняя установка с дневником');
          }
          return;
        }
        if (!await hasSavedMatrixSession()) {
          if (mounted.current) setStage('Новая установка готова к входу');
          return;
        }
        const next = await restoreMatrixSession(controller.signal, true);
        if (!mounted.current || controller.signal.aborted) { next?.dispose(); return; }
        session.current = next;
        if (next) { setUserId(next.userId); setStage('Новый вход восстановлен. Введи сохранённый код'); }
      } catch {
        if (mounted.current) setError('Не удалось открыть сохранённый вход новой установки. Старую установку не удаляй.');
      } finally { if (mounted.current) setChecking(false); }
    })();
    return () => {
      mounted.current = false;
      controller.abort();
      operation.current?.abort();
      const work = pending.current;
      if (work) void work.then(() => undefined, () => undefined).then(() => { session.current?.dispose(); session.current = null; });
      else { session.current?.dispose(); session.current = null; }
    };
  }, []);

  async function enter() {
    if (busy || checking || oldInstallation || !username.trim() || !password) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true); setError(''); setStage('Входим в первый тестовый Matrix-аккаунт с нового устройства');
    const work = loginMatrix(server, username.trim(), password, controller.signal, true);
    pending.current = work;
    try {
      const next = await work;
      if (!mounted.current || controller.signal.aborted) { next.dispose(); return; }
      session.current = next;
      setUserId(next.userId);
      setStage('Вход новой установки сохранён. Теперь введи код восстановления');
    } catch (problem) {
      if (mounted.current) setError(networkErrorText(problem, password));
    } finally {
      if (mounted.current) { setPassword(''); setBusy(false); }
      if (operation.current === controller) operation.current = null;
      if (pending.current === work) pending.current = null;
    }
  }

  async function recover() {
    const current = session.current;
    if (busy || checking || oldInstallation || !current || !code) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true); setError(''); setResult(null);
    const timer = setTimeout(() => controller.abort(), 300_000);
    const work = current.recoverOneDiaryRecord(code, controller.signal,
      value => { if (mounted.current && !controller.signal.aborted) setStage(value); });
    pending.current = work;
    try {
      const opened = await work;
      if (!mounted.current || controller.signal.aborted) {
        if (opened.playbackUri) (await import('../matrix/incoming-audio-files.native')).discardIncomingAudio(opened.playbackUri);
        return;
      }
      setResult(opened); setCode('');
      setStage('Старая запись расшифрована и загружена в чистой установке');
    } catch (problem) {
      if (mounted.current) setError(controller.signal.aborted ? 'Ожидание остановлено. Вход новой установки сохранён; можно повторить чтение.'
        : problem instanceof AudioProbeError ? problem.message : 'Проверка восстановления не завершилась. Старую установку не удаляй.');
    } finally {
      clearTimeout(timer);
      if (mounted.current) setBusy(false);
      if (operation.current === controller) operation.current = null;
      if (pending.current === work) pending.current = null;
    }
  }

  function button(label: string, action: 'enter' | 'recover', disabled = false) {
    return <Pressable accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy || checking }} disabled={disabled || busy || checking}
      onPress={() => { if (action === 'enter') void enter(); else void recover(); }}
      style={({ pressed }) => [styles.button, (pressed || disabled || busy || checking) && styles.muted]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>;
  }

  return <SafeAreaView style={styles.page} edges={['left', 'right', 'bottom']}>
    <Stack.Screen options={{ title: 'Восстановление · тест' }} />
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Чистая проверка дневника</Text>
          <Text style={styles.text}>Этот экран проверяет отдельную установку без локальных данных прежнего Tecno. Он не удаляет прежнее приложение.</Text>
          <Text style={styles.status}>{stage}</Text>
          {checking && <ActivityIndicator color="#2059b0" />}
          {!!error && <Text selectable style={styles.error}>{error}</Text>}
          {busy && <Pressable accessibilityRole="button" onPress={() => operation.current?.abort()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Остановить ожидание</Text>
          </Pressable>}
        </View>
        {oldInstallation ? <View style={styles.card}>
          <Text style={styles.error}>Здесь уже есть прежний дневник. Для проверки восстановления открой второй APK «Matrix · восстановление».</Text>
        </View> : !userId ? <View style={styles.card}>
          <Text style={styles.label}>Matrix-сервер первого аккаунта</Text>
          <TextInput accessibilityLabel="Matrix-сервер" style={styles.input} value={server} onChangeText={setServer}
            autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!busy && !checking} />
          <Text style={styles.label}>Первый Matrix-аккаунт — тот же, что на Tecno</Text>
          <TextInput accessibilityLabel="Имя первого Matrix-аккаунта" style={styles.input} value={username} onChangeText={setUsername}
            autoCapitalize="none" autoCorrect={false} editable={!busy && !checking} />
          <Text style={styles.label}>Пароль аккаунта</Text>
          <TextInput accessibilityLabel="Пароль первого Matrix-аккаунта" style={styles.input} value={password} onChangeText={setPassword}
            autoCapitalize="none" autoCorrect={false} secureTextEntry editable={!busy && !checking} />
          {button('Войти с нового устройства', 'enter', !username.trim() || !password)}
          <Text style={styles.note}>Пароль вводится только на Tecno. Этот вход создаст новое Matrix-устройство; прежний вход останется.</Text>
        </View> : <View style={styles.card}>
          <Text style={styles.success}>Новая установка вошла как {userId}</Text>
          <Text style={styles.label}>Код восстановления, сохранённый вне Tecno</Text>
          <TextInput accessibilityLabel="Код восстановления" style={styles.input} value={code} onChangeText={setCode}
            autoCapitalize="none" autoCorrect={false} secureTextEntry editable={!busy} />
          {button('Восстановить и открыть одну запись', 'recover', !code)}
          <Text style={styles.note}>Код не сохраняется в приложении и не появляется в отчёте. Дефисы при вводе необязательны.</Text>
        </View>}
        {result && <View style={styles.card}>
          <Text style={styles.success}>Старая запись восстановлена</Text>
          <Text style={styles.text}>SDK расшифровал старое событие и аудиофайл в новой установке. Проверь, что слышна знакомая тестовая фраза.</Text>
          <Text selectable style={styles.note}>Комната: {result.roomId}{'\n'}Событие: {result.eventId}{'\n'}Длительность: {Math.round(result.durationMs / 1000)} с · Размер: {result.byteLength} байт{'\n'}SHA-256 аудио: {result.audioSha256}</Text>
          {result.playbackUri && <GroupAudioPreview key={result.playbackUri} uri={result.playbackUri} label="дневника" />}
        </View>}
        <Link href="/network" style={styles.link}>Вернуться к основному экрану</Link>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, page: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 20, gap: 14, width: '100%', maxWidth: 640, alignSelf: 'center' },
  card: { borderRadius: 12, padding: 16, backgroundColor: '#fff', gap: 12 },
  title: { fontSize: 25, fontWeight: '700', color: '#14243b' },
  text: { fontSize: 16, lineHeight: 24, color: '#26364a' },
  status: { fontSize: 17, lineHeight: 24, color: '#2059b0', fontWeight: '600' },
  label: { fontSize: 16, fontWeight: '600', color: '#26364a' },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#77879d', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#fff', color: '#14243b' },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: '#2059b0', justifyContent: 'center', alignItems: 'center', padding: 14 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondaryButton: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: '#2059b0', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#2059b0', fontSize: 16, fontWeight: '600' },
  muted: { opacity: 0.5 }, success: { color: '#14623a', fontSize: 19, fontWeight: '700' },
  error: { color: '#a22525', fontSize: 16, lineHeight: 24 },
  note: { color: '#536178', fontSize: 14, lineHeight: 21 },
  link: { color: '#2059b0', fontSize: 16, lineHeight: 24, textAlign: 'center' },
});
