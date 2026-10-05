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

const { NativeGroupTest } = await import('../src/matrix/group-test.native.ts');
const own = '@tecno:example.org', ipad = '@ipad:example.org', computer = '@computer:example.org';
const roomId = '!group:example.org';
const member = (id, membership) => ({ type: 'm.room.member', state_key: id, content: { membership } });

function fixture(saved = null, members = [member(own, 'join'), member(ipad, 'join'), member(computer, 'join')]) {
  const trace = [];
  let created;
  const handle = () => ({ uniffiDestroy() {} });
  const room = { ...handle(), async latestEncryptionState() { return 0; }, async timeline() { trace.push('timeline'); throw new Error('must not upload'); } };
  const sync = { ...handle(), state() { return { ...handle(), cancel() {} }; }, async start() { trace.push('sync-start'); },
    async stop() { trace.push('sync-stop'); }, roomListService() {
      return { ...handle(), async subscribeToRooms(ids) { assert.deepEqual(ids, [roomId]); } };
    } };
  const client = { userId() { return own; }, session() { return { accessToken: 'secret', homeserverUrl: 'https://example.org' }; },
    syncService() { return { ...handle(), withRoomListTimelineLimit() { return this; }, async finish() { return sync; } }; },
    async createRoom(options) { created = options; trace.push('create'); return roomId; },
    async awaitRoomRemoteEcho(id) { assert.equal(id, roomId); return room; } };
  const vault = { saveGroupRoom(value) { assert.deepEqual(value, { roomId, ipadUserId: ipad, computerUserId: computer }); trace.push('room-save'); },
    async flush() { trace.push('flush'); } };
  const group = new NativeGroupTest(client, true, vault, saved);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer secret');
    if (url.endsWith('/members')) return { ok: true, status: 200, async json() { return { chunk: members }; } };
    if (url.endsWith('/state/m.room.encryption/')) return { ok: true, status: 200, async json() { return { algorithm: 'm.megolm.v1.aes-sha2' }; } };
    throw new Error('unexpected network path');
  };
  return { group, trace, get created() { return created; }, restoreFetch() { globalThis.fetch = originalFetch; } };
}

test('native SDK creates a private encrypted group and saves its exact invitees', async () => {
  const f = fixture();
  try {
    assert.deepEqual(await f.group.prepare(ipad, computer, new AbortController().signal, () => {}),
      { roomId, ipadUserId: ipad, computerUserId: computer });
    assert.equal(f.created.isEncrypted, true);
    assert.equal(f.created.isDirect, false);
    assert.equal(f.created.visibility.tag, 'Private');
    assert.deepEqual(f.created.invite, [ipad, computer]);
    assert.ok(f.trace.indexOf('room-save') < f.trace.indexOf('sync-stop'));
  } finally { f.restoreFetch(); }
});

test('missing invite acceptance blocks group audio before a timeline is opened', async () => {
  const f = fixture({ roomId, ipadUserId: ipad, computerUserId: computer },
    [member(own, 'join'), member(ipad, 'join'), member(computer, 'invite')]);
  try {
    await assert.rejects(f.group.sendAudio(new AbortController().signal, () => {}), /Ожидаем/);
    assert.ok(!f.trace.includes('timeline'));
    assert.ok(f.trace.includes('sync-stop'));
  } finally { f.restoreFetch(); }
});
