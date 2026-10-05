import type { ConfigContext, ExpoConfig } from 'expo/config';

// A second Android application ID keeps the recovery test's store completely
// separate from the working Tecno installation.
export default ({ config }: ConfigContext): ExpoConfig => {
  const base: ExpoConfig = { ...config, name: config.name ?? 'watcher-matrix-check', slug: config.slug ?? 'watcher-matrix-check' };
  if (process.env.APP_VARIANT !== 'recovery') return base;
  return {
    ...base,
    name: 'Matrix · восстановление',
    scheme: 'watcher-matrix-recovery',
    android: { ...base.android, package: 'com.watchermatrixcheck.recovery' },
  };
};
