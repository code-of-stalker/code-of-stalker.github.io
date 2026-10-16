import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTitle: 'Matrix · диагностика' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(product)" options={{ headerShown: false, animation: 'none' }} />
      </Stack>
    </>
  );
}
