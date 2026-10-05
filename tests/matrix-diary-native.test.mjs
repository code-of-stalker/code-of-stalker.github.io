import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

const sdk = `
  export const EncryptionState = { Encrypted: 0 };
  export const SyncServiceState = { Error: 3, Offline: 4, Terminated: 2 };
  export const RoomVisibility = { Private: class { tag = 'Private'; } };
  export const RoomPreset = { PrivateChat: 1 };
`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@unomed/react-native-matrix-sdk') return { url: 'data:text/javascript,' + encodeURIComponent(sdk), shortCircuit: true };
  if (specifier.startsWith('.') && !/\.(ts|tsx|mjs|cjs|js|json)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
} });
const { NativeDiaryTest } = await import('../src/matrix/diary-test.native.ts');
const own = '@tecno:example.org', roomId = '!private:example.org';

function fixture(members = [{ type: 'm.room.member', state_key: own, content: { membership: 'join' } }], restored = null) {
  const trace = [];
  let created;
  const handle = () => ({ uniffiDestroy() {} });
  const room = { ...handle(), async latestEncryptionState() { trace.push('native-encryption'); return 0; },
    async timeline() { trace.push('timeline'); throw new Error('must not upload'); } };
  const sync = { ...handle(), state() { return { ...handle(), cancel() {} }; },
    async start() { trace.push('sync-start'); }, async stop() { trace.push('sync-stop'); },
    roomListService() { return { ...handle(), async subscribeToRooms(ids) { assert.deepEqual(ids, [roomId]); } }; } };
  const client = {
    userId() { return own; }, session() { return { accessToken: 'secret', homeserverUrl: 'https://example.org' }; },
    syncService() { return { ...handle(), withRoomListTimelineLimit() { return this; }, async finish() { return sync; } }; },
    async createRoom(options) { created = options; trace.push('create'); return roomId; },
    async awaitRoomRemoteEcho(id) { assert.equal(id, roomId); trace.push('room-open'); return room; },
  };
  const vault = { saveDiaryRoom(id) { assert.equal(id, roomId); trace.push('room-save'); }, async flush() { trace.push('flush'); } };
  const peerTest = { room: null };
  const diary = new NativeDiaryTest(client, true, vault, peerTest, restored, []);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer secret');
    if (url.endsWith('/members')) return { ok: true, status: 200, async json() { return { chunk: members }; } };
    if (url.endsWith('/state/m.room.encryption/')) return { ok: true, status: 200, async json() { return { algorithm: 'm.megolm.v1.aes-sha2' }; } };
    throw new Error('unexpected network path');
  };
  return { diary, trace, get created() { return created; }, restoreFetch() { globalThis.fetch = originalFetch; } };
}

test('native SDK creates a private encrypted diary with no invited user', async () => {
  const f = fixture();
  try {
    assert.equal(await f.diary.prepare(new AbortController().signal, () => {}), roomId);
    assert.equal(f.diary.room, roomId);
    assert.equal(f.created.isEncrypted, true);
    assert.equal(f.created.visibility.tag, 'Private');
    assert.deepEqual(f.created.invite, []);
    assert.equal(f.created.isDirect, false);
    assert.ok(f.trace.indexOf('room-save') < f.trace.indexOf('room-open'));
    assert.ok(f.trace.includes('native-encryption'));
    assert.ok(f.trace.includes('sync-stop'));
  } finally { f.restoreFetch(); }
});

test('unexpected invite prevents the private room from becoming usable', async () => {
  const f = fixture([{ type: 'm.room.member', state_key: own, content: { membership: 'join' } },
    { type: 'm.room.member', state_key: '@ipad:example.org', content: { membership: 'invite' } }], roomId);
  try {
    await assert.rejects(f.diary.prepare(new AbortController().signal, () => {}), /посторонний участник/);
    assert.equal(f.created, undefined);
    assert.ok(f.trace.includes('sync-stop'));
    assert.ok(!f.trace.includes('timeline'));
  } finally { f.restoreFetch(); }
});
