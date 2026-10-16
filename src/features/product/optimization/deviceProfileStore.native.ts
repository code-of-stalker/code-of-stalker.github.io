import { deviceOptimizationKey, readDeviceProfile, type DeviceOptimizationProfile } from './deviceOptimization';

export const deviceProfileStore = {
  async clear() { const store = await import('expo-secure-store'); await store.deleteItemAsync(deviceOptimizationKey); },
  async read() { const store = await import('expo-secure-store'); return readDeviceProfile(await store.getItemAsync(deviceOptimizationKey)); },
  async write(profile: DeviceOptimizationProfile) {
    const store = await import('expo-secure-store');
    await store.setItemAsync(deviceOptimizationKey, JSON.stringify(profile), { keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
};
