import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { waitForProductFonts } from './product-font-ready';

const sources = {
  Tektur: require('../../../assets/product/fonts/Tektur-Variable.ttf'),
  DisketMono: require('../../../assets/product/fonts/Disket-Mono-Regular.ttf'),
  DisketMonoBold: require('../../../assets/product/fonts/Disket-Mono-Bold.ttf'),
};
// Explicit outlines also work in WebKit builds without variable-weight support.
// These are instances of the same bundled font, not synthesized bold text.
const webSources = {
  ...sources,
  TekturMedium: require('../../../assets/product/fonts/Tektur-Medium.ttf'),
  TekturSemiBold: require('../../../assets/product/fonts/Tektur-SemiBold.ttf'),
};

export function useProductFonts(): [boolean, Error | null] {
  const [registered, registrationError] = useFonts(Platform.OS === 'web' ? webSources : sources);
  const [verified, setVerified] = useState(Platform.OS !== 'web');
  const [loadingError, setLoadingError] = useState<Error | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !registered) return;
    let disposed = false;
    document.documentElement.dataset.productFonts = 'loading';
    waitForProductFonts(document.fonts).then(() => {
      if (!disposed) { document.documentElement.dataset.productFonts = 'ready'; setVerified(true); }
    }).catch(error => {
      if (!disposed) {
        document.documentElement.dataset.productFonts = 'failed';
        setLoadingError(error instanceof Error ? error : new Error(String(error)));
      }
    });
    return () => { disposed = true; delete document.documentElement.dataset.productFonts; };
  }, [registered]);
  return [registered && verified, registrationError ?? loadingError];
}
