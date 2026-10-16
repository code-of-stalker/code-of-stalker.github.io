import { deviceOptimizationKey, readDeviceProfile, type DeviceOptimizationProfile } from './deviceOptimization';

// Device preferences stay outside diary backups and account data.
export const deviceProfileStore = {
  async read() { try { return readDeviceProfile(localStorage.getItem(deviceOptimizationKey)); } catch { return null; } },
  async write(profile: DeviceOptimizationProfile) { localStorage.setItem(deviceOptimizationKey, JSON.stringify(profile)); },
  async clear() { localStorage.removeItem(deviceOptimizationKey); },
};
