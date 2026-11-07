// A free Supabase project falls asleep after a week without requests. One call
// a day to the harmless `ping()` function keeps the Intensive chat awake. It
// uses only the public key from config.ts; no secret is needed or stored.
import { readIntensiveServer } from './intensive-server.mjs';

const { url, publishableKey } = await readIntensiveServer();
if (!url || !publishableKey) {
  console.log('Intensive server is not configured yet; nothing to ping.');
  process.exit(0);
}

const response = await fetch(`${url}/rest/v1/rpc/ping`, {
  method: 'POST',
  headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
  body: '{}',
  signal: AbortSignal.timeout(30_000),
});
const body = await response.text();
if (!response.ok) {
  console.error(`Ping failed: HTTP ${response.status} ${body.slice(0, 200)}`);
  process.exit(1);
}
console.log(`Intensive server is awake: ${body.trim()}`);
