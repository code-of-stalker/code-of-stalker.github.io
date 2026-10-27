import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { ProductProvider, useProduct } from '../../features/product/state/ProductProvider';
import { ProductButton, ProductScreen, ProductText } from '../../features/product/ui';
import { ProductThemeProvider, useThemeColors } from '../../features/product/ProductTheme';
import { isLightTheme } from '../../features/product/theme';
import { EffectsQualityProvider } from '../../features/product/motion/EffectsQuality';
import { SoftScroll } from '../../features/product/motion/SoftScroll';
import { useProductFonts } from '../../features/product/useProductFonts';
import { BackSwipeProvider } from '../../features/product/navigation/BackSwipeProvider';
import { DeviceOptimizationGate, type DeviceOptimizationMode } from '../../features/product/optimization/DeviceOptimizationGate';
import { StartupSkeleton } from '../../features/product/skeleton/StartupSkeleton';
import { useGraphicsEngineLoading } from '../../features/product/skeleton/useGraphicsEngineLoading';
import { useWebUpdateReady } from '../../features/product/updates/webUpdateSafety';

function ProductStack() {
  const colors = useThemeColors();
  const { ready, error, retryLoad, sessionRevision } = useProduct();
  const [loaded, fontError] = useProductFonts();
  const [gate, setGate] = useState<DeviceOptimizationMode>('loading');
  const engineLoading = useGraphicsEngineLoading();
  useWebUpdateReady(ready && (loaded || !!fontError));
  if (error && !ready) return <ProductScreen>
    <ProductText variant="title">НЕ УДАЛОСЬ ОТКРЫТЬ ДНЕВНИК</ProductText>
    <ProductText style={{ marginVertical: 24 }}>{error}</ProductText>
    <ProductButton label="ПОВТОРИТЬ" onPress={() => { void retryLoad(); }} />
  </ProductScreen>;
  const booting = !ready || (!loaded && !fontError);
  // The device setup screen has its own content; every other screen waits
  // for the graphics engine behind the skeleton.
  const holding = booting || gate === 'loading' || gate === 'ready' && engineLoading;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    {/* Mounted beneath the skeleton so the engine and screen can start, but
        unseen until the skeleton hands over to the screen's own reveal. */}
    {!booting && <View style={[{ flex: 1 }, holding && { opacity: 0 }]}><StatusBar style={isLightTheme(colors) ? 'dark' : 'light'} /><DeviceOptimizationGate key={sessionRevision} onMode={setGate}><Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.background } }} /></DeviceOptimizationGate></View>}
    <StartupSkeleton key={sessionRevision} ready={!holding} />
  </View>;
}
function ThemedProduct() {
  const { settings } = useProduct();
  return <ProductThemeProvider theme={settings.theme}><EffectsQualityProvider><SoftScroll enabled={settings.smoothness ?? true} /><BackSwipeProvider><ProductStack /></BackSwipeProvider></EffectsQualityProvider></ProductThemeProvider>;
}
export default function ProductLayout() {
  return <ProductProvider><ThemedProduct /></ProductProvider>;
}
