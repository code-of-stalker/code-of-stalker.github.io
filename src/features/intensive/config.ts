import type { BackendFactory } from './backend';
import { supabaseBackend } from './supabaseBackend';

/**
 * The Supabase project of the Intensive chat. The publishable key is public by
 * design (the database rules decide what it may do); the secret / service_role
 * key must never appear in this repository. While empty, the site keeps the
 * «готовится» notice and development builds use the in-memory demo server.
 * scripts/intensive-server.mjs reads this line for the site's security policy
 * and the daily keep-awake job, and refuses anything but a public key.
 */
export const intensiveServer = { url: '', publishableKey: '' };

export const intensiveConfigured = () => !!(intensiveServer.url && intensiveServer.publishableKey);
/** The level opens its own screen once the server exists, and always in development. */
export const intensiveAvailable = () => intensiveConfigured() || __DEV__;

let factory: BackendFactory | null | undefined;

export function intensiveFactory(): BackendFactory | null {
  if (factory !== undefined) return factory;
  if (intensiveConfigured()) factory = supabaseBackend(intensiveServer);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  else if (__DEV__) factory = (require('./demoBackend') as typeof import('./demoBackend')).demoBackend;
  else factory = null;
  return factory;
}
