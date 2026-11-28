import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// Any uncaught error shows a message and a way to start again, never a blank page.
export { AppErrorScreen as ErrorBoundary } from '../features/product/screens/AppErrorScreen';

// The navigator lays every screen on its theme's background before the screen draws. The default is
// light grey (#f2f2f2), which flashed before the dark product screens; only that colour changes here.
// The diagnostics paint their own light pages and keep the default header.
const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#000' } };

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTitle: 'Matrix · диагностика' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(product)" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        <Stack.Screen name="_sitemap" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
