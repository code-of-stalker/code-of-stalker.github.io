import { useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkMatrixSdk } from '../matrix/diagnostics';
import type { MatrixDiagnosticResult } from '../matrix/types';

export default function DiagnosticsScreen() {
  const scrollView = useRef<ScrollView>(null);
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MatrixDiagnosticResult | null>(null);

  async function runCheck() {
    if (running.current) return;
    running.current = true;
    scrollView.current?.scrollTo({ y: 0, animated: true });
    setBusy(true);
    setResult(null);
    try {
      // Give the screen time to paint before loading the generated FFI bindings.
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      setResult(await checkMatrixSdk());
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.page} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Проверка SDK', headerTitle: 'Проверка SDK' }} />
      <ScrollView ref={scrollView} contentContainerStyle={styles.content}>
        <View accessibilityLiveRegion="polite" style={styles.result}>
          {!result && !busy && <Text style={styles.text}>Проверка ещё не выполнялась.</Text>}
          {busy && <ActivityIndicator accessibilityLabel="Выполняется проверка SDK" color="#2059b0" />}
          {result?.ok && (
            <>
              <Text style={styles.success}>Нативные вызовы выполнены</Text>
              <Text selectable style={styles.text}>Rust SDK SHA: {result.sdkGitSha}</Text>
              <Text selectable style={styles.text}>{result.validAlias} → {String(result.validAliasResult)}</Text>
              <Text selectable style={styles.text}>{result.invalidAlias} → {String(result.invalidAliasResult)}</Text>
              <Text style={styles.text}>Время: {result.elapsedMs} мс (включая загрузку модуля).</Text>
              <Text style={styles.text}>Локальные вызовы SDK проверены. К остальным проверкам можно вернуться стрелкой вверху.</Text>
            </>
          )}
          {result && !result.ok && (
            <>
              <Text style={styles.error}>Проверка не пройдена</Text>
              <Text style={styles.text}>Этап: {result.stage}</Text>
              <Text style={styles.text}>{result.message}</Text>
              <Text selectable style={styles.details}>{result.details}</Text>
            </>
          )}
        </View>
        <Text style={styles.title}>Проверка нативного SDK</Text>
        <Text style={styles.text}>Expo 57 · Matrix SDK 0.10.2 · {Platform.OS}</Text>
        <Text style={styles.text}>
          Кнопка вызывает Rust SDK через TurboModule / JSI: читает SHA SDK и проверяет два тестовых псевдонима комнаты.
          Аккаунт и подключение к Matrix-серверу не нужны.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={runCheck}
          style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonMuted]}
        >
          <Text style={styles.buttonText}>{busy ? 'Проверяем…' : 'Проверить SDK'}</Text>
        </Pressable>
        <Text style={styles.note}>
          Используйте установленный development APK. Если приложение закрылось без текста ошибки, нужны Android-логи: нативный сбой может обойти обработчик JavaScript.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 20, gap: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  title: { fontSize: 25, fontWeight: '700', color: '#14243b' },
  text: { fontSize: 16, lineHeight: 24, color: '#26364a' },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: '#2059b0', justifyContent: 'center', alignItems: 'center', padding: 14 },
  buttonMuted: { opacity: 0.65 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  result: { borderRadius: 12, padding: 16, backgroundColor: '#fff', gap: 12 },
  success: { color: '#14623a', fontSize: 19, fontWeight: '700' },
  error: { color: '#a22525', fontSize: 19, fontWeight: '700' },
  details: { fontSize: 14, lineHeight: 21, color: '#762222' },
  note: { fontSize: 14, lineHeight: 21, color: '#536178' },
});
