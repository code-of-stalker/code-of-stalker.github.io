import fs from 'node:fs/promises';

// The Intensive chat's Supabase project lives in one place, the app's config
// file. The web shell's security policy and the keep-awake job read it here, so
// filling in the URL and the publishable key there is the whole switch-on.
const configFile = new URL('../src/features/intensive/config.ts', import.meta.url);

/** Reads `intensiveServer` from config.ts; empty strings while the server does not exist. */
export async function readIntensiveServer(source) {
  source ??= await fs.readFile(configFile, 'utf8');
  const literal = source.match(/export const intensiveServer = \{\s*url: '([^']*)',\s*publishableKey: '([^']*)'\s*\};/);
  if (!literal) throw new Error('intensiveServer not found in src/features/intensive/config.ts');
  const [, url, publishableKey] = literal;
  if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw new Error(`Unexpected Intensive server URL: ${url}`);
  // Only the public key belongs in this repository; a secret key here would be a leak.
  if (publishableKey && !isPublicKey(publishableKey)) throw new Error('The Intensive key must be the publishable key (sb_publishable_…)');
  return { url, publishableKey };
}

/** A new-style publishable key, or a legacy JWT key whose role is `anon` (never `service_role`). */
function isPublicKey(key) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role === 'anon'; }
  catch { return false; }
}

/** Origins the page must reach for the chat: REST/auth over HTTPS and realtime over WSS. */
export async function intensiveConnectOrigins(source) {
  const { url } = await readIntensiveServer(source);
  return url ? [url, url.replace(/^https:/, 'wss:')] : [];
}
