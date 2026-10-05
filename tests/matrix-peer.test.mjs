import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { validatePeerUserId, peerChallenge, assertTwoJoinedUsers } from '../src/matrix/peer-probe.ts';
import { parseSavedSession, SerializedSessionStorage, SessionVaultCore } from '../src/matrix/saved-session.ts';

// Substitute native bindings, server and randomness; hash actual fixture text.
// Exercise the application's asynchronous flow, persistence and cleanup.
const mockSdk = `
  export const EncryptionState = { Encrypted: 0 };
  export const EventItemOrigin = { Sync: 1 };
  export const SyncServiceState = { Error: 3, Offline: 4, Terminated: 2 };
  export const RoomVisibility = { Private: class { tag = 'Private'; } };
  export const RoomPreset = { PrivateChat: 1 };
`;
const mockCrypto = `
  import { createHash } from 'node:crypto';
  export async function getRandomBytesAsync(n) { return new Uint8Array(n).fill(10); }
  export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' };
  export async function digestStringAsync(algorithm, text) {
    if (algorithm !== 'SHA-256') throw new Error('unexpected hash algorithm');
    return createHash('sha256').update(text).digest('hex');
  }
`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@unomed/react-native-matrix-sdk') return { url: 'data:text/javascript,' + encodeURIComponent(mockSdk), shortCircuit: true };
    if (specifier === 'expo-crypto') return { url: 'data:text/javascript,' + encodeURIComponent(mockCrypto), shortCircuit: true };
    if (specifier.startsWith('.') && !/\.(ts|tsx|mjs|cjs|js|json)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  },
});
const { NativePeerTest } = await import('../src/matrix/peer-test.native.ts');
const { readSavedEncryptedEvent } = await import('../src/matrix/read-checkpoint.native.ts');
const own = '@first:example.org';
const peer = '@second:example.org';
const target = { roomId: '!Nhcu5BS-UMnFX7hBVfVSoXiD7OgH6iRT-xyIuqDnpYQ', peerUserId: peer };
const fixtureReply = peerChallenge('0a'.repeat(16)).replyBody;
const replyCheckpoint = {
  roomId: target.roomId, eventId: '$reply', senderUserId: peer, deviceId: 'TECNO',
  bodySha256: createHash('sha256').update(fixtureReply).digest('hex'), createdAt: 1791115200000,
};
const record = {
  version: 1, id: 'a'.repeat(32), passphrase: 'b'.repeat(64), roomIds: { encrypted: '!previous:example.org' },
  session: { accessToken: 'test-access', userId: own, deviceId: 'TECNO', homeserverUrl: 'https://example.org', slidingSyncVersion: 1 },
  encryptedCheckpoint: { roomId: '!previous:example.org', eventId: '$old', deviceId: 'TECNO', bodySha256: 'c'.repeat(64), createdAt: 1791115200000 },
};

test('requires a distinct full Matrix account ID and rejects malformed input', () => {
  assert.equal(validatePeerUserId(` ${peer} `, own), peer);
  for (const value of [own, 'second', '#second:example.org', '@second', '@:example.org', '@x:bad domain', '@x:\0bad']) {
    assert.throws(() => validatePeerUserId(value, own));
  }
});

test('challenge requires 128 bits of generated hex and supplies an exact separate reply', () => {
  const a = peerChallenge('a'.repeat(32));
  const b = peerChallenge('b'.repeat(32));
  assert.notEqual(a.replyBody, b.replyBody);
  assert.equal(a.requestBody.split('\n').at(-1), a.replyBody);
  for (const nonce of ['', 'previous', 'g'.repeat(32), 'a'.repeat(31)]) assert.throws(() => peerChallenge(nonce));
});

test('requires both accounts to have joined and excludes additional participants', () => {
  assertTwoJoinedUsers({ joined: { [own]: {}, [peer]: {} } }, own, peer);
  for (const value of [null, {}, { joined: [] }, { joined: { [own]: {} } },
    { joined: { [peer]: {} } }, { joined: { [own]: {}, [peer]: {}, '@third:example.org': {} } }]) {
    assert.throws(() => assertTwoJoinedUsers(value, own, peer));
  }
});

function fixture(options = {}) {
  const initial = { ...record, ...(options.noRoom ? {} : { peerRoom: target }) };
  let saved = JSON.stringify(initial);
  const counters = { sent: 0, created: 0, stop: 0, cancelled: 0, fetchedMembers: 0, deleted: 0,
    syncStarts: 0, roomGets: 0, cacheClears: 0, nativeLoads: 0, eventDestroyed: 0 };
  const trace = [];
  const storage = new SerializedSessionStorage({
    async read() { return saved; },
    async write(text) { if (options.writeError) throw new Error('test-access private write failure'); saved = text; },
    async erase() { saved = null; },
  });
  const vault = new SessionVaultCore(initial, structuredClone(initial), storage, async () => { counters.deleted++; });
  let listener;
  const cancelHandle = () => ({ cancel() { counters.cancelled++; }, uniffiDestroy() {} });
  const item = (body, sender, eventId, origin = 1) => ({ asEvent: () => ({
    isRemote: true, origin, sender, eventOrTransactionId: { tag: 'EventId', inner: { eventId } },
    content: { tag: 'MsgLike', inner: { content: { kind: { tag: 'Message', inner: { content: { body, msgType: { tag: 'Text' } } } } } } },
  }) });
  const timeline = {
    async fetchMembers() { counters.fetchedMembers++; },
    async addListener(next) { listener = next; return cancelHandle(); }, uniffiDestroy() {},
  };
  const room = {
    async latestEncryptionState() { return 0; },
    async timeline() { trace.push('timeline'); return timeline; }, uniffiDestroy() {},
    async clearEventCacheStorage() {
      trace.push('clear-events'); counters.cacheClears++;
      options.afterClear?.();
    },
    async loadOrFetchEvent(id) {
      assert.equal(trace.at(-1), 'clear-events', 'must clear cached plaintext before fetching');
      trace.push('fetch-decrypt'); counters.nativeLoads++;
      return {
        eventId: () => options.readEventId ?? id,
        senderId: () => options.readSender ?? peer,
        content: () => options.missingKeys ? { tag: 'MessageLike', inner: { content: { tag: 'RoomEncrypted' } } }
          : { tag: 'MessageLike', inner: { content: { tag: 'RoomMessage', inner: {
            messageType: { tag: 'Text', inner: { content: { body: options.readBody ?? fixtureReply } } },
          } } } },
        uniffiDestroy() { counters.eventDestroyed++; },
      };
    },
    async sendRaw(type, content) {
      assert.equal(type, 'm.room.message');
      counters.sent++;
      if (options.sendError) throw new Error('native send failed');
      const request = JSON.parse(content).body;
      const response = request.split('\n').at(-1);
      listener.onUpdate([{ tag: 'Append', inner: { values: [item(request, own, '$sent')] } }]);
      const candidate = options.wrongSender ? own : peer;
      const replyText = options.staleReply ? peerChallenge('b'.repeat(32)).replyBody : response;
      if (!options.noReply) listener.onUpdate([{ tag: 'Append', inner: { values: [item(replyText, candidate, '$reply', options.cachedReply ? 3 : 1)] } }]);
    },
  };
  const sync = {
    state() { return cancelHandle(); }, async start() { counters.syncStarts++; },
    async stop() { counters.stop++; if (options.stopError) throw new Error('native stop failed'); },
    roomListService() { return { async subscribeToRooms(ids) { assert.deepEqual(ids, [target.roomId]); }, uniffiDestroy() {} }; },
    uniffiDestroy() {},
  };
  const builder = { withRoomListTimelineLimit() { return this; }, async finish() { return sync; }, uniffiDestroy() {} };
  const client = {
    userId() { return own; }, session() { return { ...record.session, deviceId: options.deviceId ?? 'TECNO' }; },
    syncService() { return builder; },
    getRoom(id) {
      counters.roomGets++;
      assert.ok([target.roomId, record.roomIds.encrypted].includes(id));
      return options.missingRoom ? undefined : room;
    },
    async awaitRoomRemoteEcho(id) { assert.equal(id, target.roomId); return room; },
    async createRoom(request) {
      counters.created++;
      assert.equal(request.isEncrypted, true);
      assert.deepEqual(request.invite, [peer]);
      return target.roomId;
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer test-access');
    let value;
    if (url.endsWith('/joined_members')) value = { joined: options.missingPeer ? { [own]: {} } : { [own]: {}, [peer]: {} } };
    else if (url.endsWith('/state/m.room.encryption/')) value = { algorithm: options.plainRoom ? 'plaintext' : 'm.megolm.v1.aes-sha2' };
    else {
      const eventId = decodeURIComponent(url.split('/').at(-1));
      const roomId = decodeURIComponent(new URL(url).pathname.split('/').at(-3));
      value = { event_id: options.wireEventId ?? eventId,
        sender: options.wireSender ?? (['$sent', '$old'].includes(eventId) ? own : peer), room_id: roomId,
        type: eventId === '$reply' && options.plainReply ? 'm.room.message' : 'm.room.encrypted',
        content: { algorithm: 'm.megolm.v1.aes-sha2', ciphertext: 'opaque-payload', session_id: 'test-session',
          ...(options.wireLeak ? { extra: fixtureReply } : {}) } };
    }
    return { ok: true, json: async () => value };
  };
  return { probe: new NativePeerTest(client, true, vault, options.noRoom ? null : target), client, vault, storage, counters, trace,
    restoreFetch() { globalThis.fetch = originalFetch; } };
}

test('creates one encrypted invitation, preserves old checkpoint and reuses saved room on retry/restore', async () => {
  const f = fixture({ noRoom: true });
  try {
    assert.deepEqual(await f.probe.prepare(peer, new AbortController().signal, () => {}), target);
    await f.probe.prepare(peer, new AbortController().signal, () => {});
    assert.equal(f.counters.created, 1);
    f.vault.saveSessionInKeychain({ ...record.session, accessToken: 'refreshed-test' });
    await f.vault.flush();
    const saved = parseSavedSession(await f.storage.read());
    assert.deepEqual(saved.peerRoom, target);
    assert.deepEqual(saved.encryptedCheckpoint, record.encryptedCheckpoint);
    assert.equal(saved.passphrase, record.passphrase);
    const restored = new NativePeerTest(f.client, true, f.vault, saved.peerRoom);
    await restored.prepare(peer, new AbortController().signal, () => {});
    assert.equal(f.counters.created, 1);
    assert.equal(f.counters.deleted, 0);
  } finally { f.restoreFetch(); }
});

test('confirms native live-sync decrypted reply and both encrypted server events', async () => {
  const f = fixture();
  try {
    const report = await f.probe.exchange(new AbortController().signal, () => {});
    assert.equal(report.sentEventId, '$sent'); assert.equal(report.replyEventId, '$reply');
    assert.equal(report.peerUserId, peer);
    assert.equal(report.outgoingEncryption.eventType, 'm.room.encrypted');
    assert.equal(report.incomingEncryption.eventType, 'm.room.encrypted');
    assert.equal(f.counters.sent, 1); assert.equal(f.counters.fetchedMembers, 1);
    assert.equal(f.counters.stop, 1); assert.equal(f.counters.cancelled, 2); assert.equal(f.counters.deleted, 0);
  } finally { f.restoreFetch(); }
});

for (const scenario of [
  { name: 'does not send before the other account joins', options: { missingPeer: true }, pattern: /ещё не вошёл/, sends: 0 },
  { name: 'does not send in a plaintext room', options: { plainRoom: true }, pattern: /настройку шифрования/, sends: 0 },
  { name: 'does not report encryption success for a plaintext reply on the server', options: { plainReply: true }, pattern: /не зашифровано/, sends: 1 },
  { name: 'preserves send failure even when stopping sync also fails', options: { sendError: true, stopError: true }, pattern: /native send failed/, sends: 1 },
]) test(scenario.name, async () => {
  const f = fixture(scenario.options);
  try {
    await assert.rejects(f.probe.exchange(new AbortController().signal, () => {}), scenario.pattern);
    assert.equal(f.counters.sent, scenario.sends); assert.equal(f.counters.stop, 1); assert.equal(f.counters.deleted, 0);
  } finally { f.restoreFetch(); }
});

for (const options of [{ wrongSender: true }, { cachedReply: true }, { staleReply: true }, { noReply: true }]) {
  test(`ignores unrelated replies and cancellation sends no automatic retry: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15);
    try {
      await assert.rejects(f.probe.exchange(controller.signal, () => {}), /Aborted/);
      assert.equal(f.counters.sent, 1); assert.equal(f.counters.stop, 1); assert.equal(f.counters.deleted, 0);
    } finally { clearTimeout(timer); f.restoreFetch(); }
  });
}

test('rejects invalid saved peer room metadata without retaining extra fields', () => {
  const parsed = parseSavedSession(JSON.stringify({ ...record, peerRoom: { ...target, password: 'do-not-save' } }));
  assert.deepEqual(parsed.peerRoom, target);
  assert.equal(JSON.stringify(parsed).includes('do-not-save'), false);
  for (const peerRoom of [{ ...target, peerUserId: own }, { ...target, peerUserId: 'nickname' },
    { ...target, roomId: record.roomIds.encrypted }, { ...target, roomId: '../outside' }]) {
    assert.throws(() => parseSavedSession(JSON.stringify({ ...record, peerRoom })));
  }
});

function restoredPeer(f, saved) {
  const vault = new SessionVaultCore(saved, saved, f.storage, async () => { f.counters.deleted++; });
  return { probe: new NativePeerTest(f.client, true, vault, saved.peerRoom, saved.peerReplyCheckpoint), vault };
}

async function seedSavedReply(f) {
  f.vault.savePeerReplyCheckpoint(replyCheckpoint);
  await f.vault.flush();
  return restoredPeer(f, parseSavedSession(await f.storage.read()));
}

test('live exchange saves only reply identity and digest, and gates reading until client restoration', async () => {
  const f = fixture();
  try {
    const report = await f.probe.exchange(new AbortController().signal, () => {});
    const serialized = await f.storage.read();
    const saved = parseSavedSession(serialized);
    assert.deepEqual(saved.peerReplyCheckpoint, { ...replyCheckpoint, createdAt: saved.peerReplyCheckpoint.createdAt });
    assert.equal(saved.peerReplyCheckpoint.eventId, report.replyEventId);
    assert.equal(saved.peerReplyCheckpoint.bodySha256, createHash('sha256').update(report.replyBody).digest('hex'));
    assert.equal(serialized.includes(report.replyBody), false);
    assert.deepEqual(saved.encryptedCheckpoint, record.encryptedCheckpoint);
    assert.equal(f.probe.restartProbe.requiresRestart, true);
    await assert.rejects(f.probe.readReplyAfterRestart(new AbortController().signal, () => {}), /Полностью остановите/);
    assert.equal(f.counters.roomGets, 0);
    f.vault.saveSessionInKeychain({ ...record.session, accessToken: 'refreshed-test' });
    await f.vault.flush();
    assert.deepEqual(parseSavedSession(await f.storage.read()).peerReplyCheckpoint, saved.peerReplyCheckpoint);
  } finally { f.restoreFetch(); }
});

test('restored client fetches and decrypts the former peer reply after clearing only event cache, without sync or resend', async () => {
  const f = fixture();
  try {
    await f.probe.exchange(new AbortController().signal, () => {});
    const saved = parseSavedSession(await f.storage.read());
    f.vault.stop();
    const restored = restoredPeer(f, saved);
    assert.equal(restored.probe.restartProbe.requiresRestart, false);
    const countersBefore = { ...f.counters };
    f.trace.length = 0;
    const report = await restored.probe.readReplyAfterRestart(new AbortController().signal, () => {});
    assert.equal(report.body, fixtureReply);
    assert.equal(report.senderUserId, peer);
    assert.equal(report.eventId, saved.peerReplyCheckpoint.eventId);
    assert.equal(report.deviceId, saved.session.deviceId);
    assert.equal(report.encryption.eventType, 'm.room.encrypted');
    assert.deepEqual(f.trace, ['timeline', 'clear-events', 'fetch-decrypt']);
    assert.equal(f.counters.nativeLoads, 1); assert.equal(f.counters.eventDestroyed, 1);
    for (const key of ['sent', 'created', 'syncStarts', 'deleted']) assert.equal(f.counters[key], countersBefore[key]);
    assert.deepEqual(parseSavedSession(await f.storage.read()), saved);
  } finally { f.restoreFetch(); }
});

test('shared reader still confirms the own encrypted checkpoint without starting sync', async () => {
  const ownBody = 'old self-test plaintext';
  const f = fixture({ readSender: own, readBody: ownBody });
  const checkpoint = { ...record.encryptedCheckpoint, bodySha256: createHash('sha256').update(ownBody).digest('hex') };
  try {
    const report = await readSavedEncryptedEvent(f.client, checkpoint, own, new AbortController().signal, () => {}, () => f.vault.flush());
    assert.equal(report.body, ownBody); assert.equal(report.eventId, '$old');
    assert.deepEqual(f.trace, ['timeline', 'clear-events', 'fetch-decrypt']);
    assert.equal(f.counters.sent, 0); assert.equal(f.counters.syncStarts, 0); assert.equal(f.counters.deleted, 0);
  } finally { f.restoreFetch(); }
});

test('missing checkpoint or changed peer metadata cannot trigger native history reading', async () => {
  const f = fixture();
  try {
    await assert.rejects(f.probe.readReplyAfterRestart(new AbortController().signal, () => {}), /повторите обмен/);
    for (const [room, checkpoint] of [
      [null, replyCheckpoint],
      [{ ...target, peerUserId: '@third:example.org' }, replyCheckpoint],
      [target, { ...replyCheckpoint, senderUserId: own }],
      [target, { ...replyCheckpoint, roomId: '!other' }],
    ]) {
      const probe = new NativePeerTest(f.client, true, f.vault, room, checkpoint);
      await assert.rejects(probe.readReplyAfterRestart(new AbortController().signal, () => {}), /изменились/);
    }
    assert.equal(f.counters.roomGets, 0); assert.equal(f.counters.deleted, 0);
  } finally { f.restoreFetch(); }
});

for (const scenario of [
  { name: 'changed receiving device', options: { deviceId: 'OTHER' }, pattern: /Устройство Matrix изменилось/, loads: 0 },
  { name: 'missing saved room', options: { missingRoom: true }, pattern: /не нашёл/, loads: 0 },
  { name: 'wrong sender on server', options: { wireSender: own }, pattern: /не соответствует/, loads: 0 },
  { name: 'wrong event on server', options: { wireEventId: '$new' }, pattern: /не соответствует/, loads: 0 },
  { name: 'plaintext server event', options: { plainReply: true }, pattern: /не зашифровано/, loads: 0 },
  { name: 'missing native decryption keys', options: { missingKeys: true }, pattern: /не расшифровал/, loads: 1 },
  { name: 'native event from another account', options: { readSender: own }, pattern: /отличается/, loads: 1 },
  { name: 'different native event', options: { readEventId: '$new' }, pattern: /отличается/, loads: 1 },
  { name: 'altered decrypted text', options: { readBody: 'different plaintext' }, pattern: /контрольной суммы/, loads: 1 },
  { name: 'plaintext leak in server ciphertext metadata', options: { wireLeak: true }, pattern: /открытый текст/, loads: 1 },
]) test(`restored peer reply fails safely for ${scenario.name}`, async () => {
  const f = fixture(scenario.options);
  try {
    const restored = await seedSavedReply(f);
    const savedBefore = await f.storage.read();
    await assert.rejects(restored.probe.readReplyAfterRestart(new AbortController().signal, () => {}), scenario.pattern);
    assert.equal(f.counters.nativeLoads, scenario.loads);
    assert.equal(f.counters.eventDestroyed, scenario.loads);
    assert.equal(f.counters.sent, 0); assert.equal(f.counters.created, 0);
    assert.equal(f.counters.syncStarts, 0); assert.equal(f.counters.deleted, 0);
    assert.equal(await f.storage.read(), savedBefore);
  } finally { f.restoreFetch(); }
});

test('cancellation before reading or after cache clearing preserves saved session and keys', async () => {
  for (const cancelAfterClear of [false, true]) {
    const controller = new AbortController();
    const f = fixture(cancelAfterClear ? { afterClear: () => controller.abort() } : {});
    try {
      const restored = await seedSavedReply(f);
      const savedBefore = await f.storage.read();
      if (!cancelAfterClear) controller.abort();
      await assert.rejects(restored.probe.readReplyAfterRestart(controller.signal, () => {}), /Aborted/);
      assert.equal(f.counters.nativeLoads, 0); assert.equal(f.counters.deleted, 0);
      assert.equal(f.counters.syncStarts, 0); assert.equal(f.counters.sent, 0);
      assert.equal(f.counters.cacheClears, cancelAfterClear ? 1 : 0);
      assert.equal(await f.storage.read(), savedBefore);
    } finally { f.restoreFetch(); }
  }
});

test('failed secure reply checkpoint save cannot produce success or expose secret values', async () => {
  const f = fixture({ writeError: true });
  try {
    await assert.rejects(f.probe.exchange(new AbortController().signal, () => {}), (error) => {
      assert.match(error.message, /Не удалось сохранить/);
      assert.equal(error.message.includes('test-access'), false);
      return true;
    });
    assert.equal(f.probe.restartProbe, null);
    assert.equal(parseSavedSession(await f.storage.read()).peerReplyCheckpoint, undefined);
    assert.equal(f.counters.stop, 1); assert.equal(f.counters.deleted, 0);
  } finally { f.restoreFetch(); }
});

test('peer checkpoint parser binds room, sender and receiving device and projects only known fields', () => {
  const saved = { ...record, peerRoom: target, peerReplyCheckpoint: replyCheckpoint };
  const parsed = parseSavedSession(JSON.stringify({ ...saved,
    peerReplyCheckpoint: { ...replyCheckpoint, body: fixtureReply, password: 'not-retained' },
  }));
  assert.deepEqual(parsed.peerReplyCheckpoint, replyCheckpoint);
  assert.equal(JSON.stringify(parsed).includes(fixtureReply), false);
  assert.equal(JSON.stringify(parsed).includes('not-retained'), false);
  for (const patch of [
    { roomId: record.roomIds.encrypted }, { senderUserId: own }, { senderUserId: '@third:example.org' },
    { deviceId: 'OTHER' }, { eventId: 'not-event' }, { bodySha256: 'invalid' }, { createdAt: 0 },
  ]) assert.throws(() => parseSavedSession(JSON.stringify({ ...saved, peerReplyCheckpoint: { ...replyCheckpoint, ...patch } })));
  assert.throws(() => parseSavedSession(JSON.stringify({ ...record, peerReplyCheckpoint: replyCheckpoint })));
});

test('changing peer room discards only old peer checkpoint metadata and retains login, own checkpoint and crypto identity', async () => {
  const f = fixture();
  try {
    await seedSavedReply(f);
    f.vault.savePeerRoom(target);
    await f.vault.flush();
    assert.deepEqual(parseSavedSession(await f.storage.read()).peerReplyCheckpoint, replyCheckpoint);
    const next = { roomId: '!another-peer-room', peerUserId: '@third:example.org' };
    f.vault.savePeerRoom(next);
    await f.vault.flush();
    const saved = parseSavedSession(await f.storage.read());
    assert.equal(saved.peerReplyCheckpoint, undefined); assert.deepEqual(saved.peerRoom, next);
    assert.deepEqual(saved.session, { ...record.session, refreshToken: undefined });
    assert.deepEqual(saved.encryptedCheckpoint, record.encryptedCheckpoint);
    assert.equal(saved.passphrase, record.passphrase); assert.equal(saved.id, record.id);
    assert.equal(f.counters.deleted, 0);
  } finally { f.restoreFetch(); }
});
