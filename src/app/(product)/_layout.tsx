import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { ProductProvider, useProduct } from '../../features/product/state/ProductProvider';
import { ProductButton, ProductScreen, ProductText } from '../../features/product/ui';
import { ProductThemeProvider, useThemeColors } from '../../features/product/ProductTheme';
import { EffectsQualityProvider } from '../../features/product/motion/EffectsQuality';
import { useProductFonts } from '../../features/product/useProductFonts';
import { BackSwipeProvider } from '../../features/product/navigation/BackSwipeProvider';
import { DeviceOptimizationGate } from '../../features/product/optimization/DeviceOptimizationGate';
import { useWebUpdateReady } from '../../features/product/updates/webUpdateSafety';

function ProductStack() {
  const colors = useThemeColors();
  const { ready, error, retryLoad, sessionRevision } = useProduct();
  const [loaded, fontError] = useProductFonts();
  useWebUpdateReady(ready && (loaded || !!fontError));
  if (error && !ready) return <ProductScreen>
    <ProductText variant="title">НЕ УДАЛОСЬ ОТКРЫТЬ ДНЕВНИК</ProductText>
    <ProductText style={{ marginVertical: 24 }}>{error}</ProductText>
    <ProductButton label="ПОВТОРИТЬ" onPress={() => { void retryLoad(); }} />
  </ProductScreen>;
  if (!ready || (!loaded && !fontError)) return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
    <ActivityIndicator color={colors.accent} accessibilityLabel="Открываем приложение" />
  </View>;
  return <><StatusBar style={colors.background === '#FAE18F' ? 'dark' : 'light'} /><DeviceOptimizationGate key={sessionRevision}><Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.background } }} /></DeviceOptimizationGate></>;
}
function ThemedProduct() {
  const { settings } = useProduct();
  return <ProductThemeProvider theme={settings.theme}><EffectsQualityProvider><BackSwipeProvider><ProductStack /></BackSwipeProvider></EffectsQualityProvider></ProductThemeProvider>;
}
export default function ProductLayout() {
  return <ProductProvider><ThemedProduct /></ProductProvider>;
}
