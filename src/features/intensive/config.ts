import type { BackendFactory } from './backend';
import { supabaseBackend } from './supabaseBackend';

/**
 * The Supabase project of the Intensive chat. The publishable key is public by
 * design (the database rules decide what it may do); the secret / service_role
 * key must never appear in this repository. While empty, the site keeps the
 * «готовится» notice.
 * scripts/intensive-server.mjs reads this line for the site's security policy
 * and the daily keep-awake job, and refuses anything but a public key.
 */
export const intensiveServer = { url: 'https://tcbqlkjtofanmdffjqyt.supabase.co', publishableKey: 'sb_publishable_iFKiSXLQ3nmWLrLyGQoTFw_Tq38Lxht' };

export const intensiveConfigured = () => !!(intensiveServer.url && intensiveServer.publishableKey);
/** The level opens its own screen once the server exists, and always in development. */
export const intensiveAvailable = () => intensiveConfigured() || __DEV__;

/**
 * Development builds never touch the real accounts: they talk to a local
 * Supabase (`supabase start`) named by EXPO_PUBLIC_INTENSIVE_URL and
 * EXPO_PUBLIC_INTENSIVE_KEY, or else to the in-memory demo server.
 */
const devServer = () => process.env.EXPO_PUBLIC_INTENSIVE_URL
  ? { url: process.env.EXPO_PUBLIC_INTENSIVE_URL, publishableKey: process.env.EXPO_PUBLIC_INTENSIVE_KEY ?? '' }
  : null;

let factory: BackendFactory | null | undefined;

export function intensiveFactory(): BackendFactory | null {
  if (factory !== undefined) return factory;
  if (__DEV__) {
    const local = devServer();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    factory = local ? supabaseBackend(local) : (require('./demoBackend') as typeof import('./demoBackend')).demoBackend;
  } else factory = intensiveConfigured() ? supabaseBackend(intensiveServer) : null;
  return factory;
}
