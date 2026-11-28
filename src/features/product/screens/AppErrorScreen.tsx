import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';

/**
 * The root layout's error boundary. Without it one uncaught render or effect error removes the
 * whole page and leaves a blank screen with no way on. It stands outside every provider, so it
 * uses no theme, font or graphics: a plain dark page, what happened, and a way to start again.
 */
export function AppErrorScreen({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { console.error('App stopped:', error); }, [error]);
  const web = Platform.OS === 'web';
  // On the web a reload also brings back graphics that crashed; native re-renders the routes.
  const again = () => { if (web) globalThis.location?.reload(); else void retry(); };
  const detail = String(error?.message || error || '').slice(0, 240);
  return <View testID="app-error" style={styles.page}>
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.title}>Что-то пошло не так</Text>
      <Text style={styles.body}>Страница остановилась из-за ошибки. Сохранённые ответы остались на этом устройстве.</Text>
      <Pressable testID="app-error-retry" accessibilityRole="button" onPress={again} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.label}>{web ? 'ОБНОВИТЬ СТРАНИЦУ' : 'ПОПРОБОВАТЬ СНОВА'}</Text>
      </Pressable>
      {!!detail && <Text selectable style={styles.detail}>{detail}</Text>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: '100%', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 },
  panel: { width: '100%', maxWidth: 420, gap: 16 },
  title: { color: '#f2f2f2', fontSize: 22, lineHeight: 28, fontWeight: '600' },
  body: { color: '#c8c8c8', fontSize: 16, lineHeight: 23 },
  button: { minHeight: 48, borderWidth: 1, borderColor: '#9a9a9a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
  pressed: { backgroundColor: '#1a1a1a' },
  label: { color: '#f2f2f2', fontSize: 14, letterSpacing: 1.5, fontWeight: '600' },
  detail: { color: '#6f6f6f', fontSize: 12, lineHeight: 17 },
});
