import type { ConfigContext, ExpoConfig } from 'expo/config';

// Separate Android IDs keep each test's store away from the working Tecno app.
export default ({ config }: ConfigContext): ExpoConfig => {
  const base: ExpoConfig = { ...config, name: config.name ?? 'watcher-matrix-check', slug: config.slug ?? 'watcher-matrix-check' };
  if (process.env.APP_VARIANT === 'recovery') return {
    ...base, name: 'Matrix · восстановление', scheme: 'watcher-matrix-recovery',
    android: { ...base.android, package: 'com.watchermatrixcheck.recovery' },
  };
  if (process.env.APP_VARIANT === 'standalone') return {
    ...base, name: 'Matrix · автономный тест', scheme: 'watcher-matrix-standalone',
    android: { ...base.android, package: 'com.watchermatrixcheck.standalone' },
  };
  if (process.env.APP_VARIANT === 'product') return {
    ...base, name: 'Код сталкера · интерфейс', scheme: 'watcher-product',
    userInterfaceStyle: 'dark',
    android: { ...base.android, package: 'com.watchermatrixcheck.product' },
  };
  return base;
};
