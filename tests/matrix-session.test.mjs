import assert from 'node:assert/strict';
import test from 'node:test';
import { appendAudioHistory, parseSavedSession, SerializedSessionStorage, SessionPersistenceError, SessionVaultCore } from '../src/matrix/saved-session.ts';

const record = {
  version: 1, id: 'a'.repeat(32), passphrase: 'b'.repeat(64), roomIds: { encrypted: '!probe:example.org' },
  session: { accessToken: 'test-access', refreshToken: 'test-refresh', userId: '@test:example.org',
    deviceId: 'SAME-DEVICE', homeserverUrl: 'https://example.org', slidingSyncVersion: 1 },
};

const audioRoom = { roomId: '!ipad:example.org', peerUserId: '@ipad:example.org' };
const audioCheckpoint = { roomId: audioRoom.roomId, senderUserId: audioRoom.peerUserId, eventId: '$audio',
  deviceId: record.session.deviceId, audioSha256: 'c'.repeat(64), byteLength: 4096, durationMs: 3000, createdAt: 1 };

test('own audio history is compact, bound to this account, and never stores file paths or media keys', async () => {
  const own = { ...audioCheckpoint, senderUserId: record.session.userId, eventId: '$own' };
  const input = { ...record, peerRoom: audioRoom, peerAudioHistory: [audioCheckpoint], ownAudioHistory: [own] };
  let text;
  const storage = new SerializedSessionStorage({ read: async () => text, erase: async () => {}, write: async value => { text = value; } });
  await storage.write({ ...input, ownAudioHistory: [{ ...own, playbackUri: 'secret-local-file', source: 'secret-media-key' }] });
  assert.deepEqual(parseSavedSession(text), input);
  assert.deepEqual(JSON.parse(text).ownAudioHistory.scope, [audioRoom.roomId, record.session.userId, record.session.deviceId]);
  assert.doesNotMatch(text, /secret-local-file|secret-media-key/);
});

test('own history rejects foreign room, account, device, invalid digest, duplicates and direction conflicts', () => {
  const own = { ...audioCheckpoint, senderUserId: record.session.userId, eventId: '$own' };
  const input = { ...record, peerRoom: audioRoom, peerAudioHistory: [audioCheckpoint], ownAudioHistory: [own] };
  for (const patch of [{ senderUserId: audioRoom.peerUserId }, { senderUserId: '@other:example.org' }, { roomId: '!other' },
    { deviceId: 'OTHER' }, { audioSha256: 'invalid' }, { eventId: audioCheckpoint.eventId }]) {
    assert.throws(() => parseSavedSession(JSON.stringify({ ...input, ownAudioHistory: [{ ...own, ...patch }] })));
  }
  for (const entries of [[own, own], Array(6).fill(own)]) assert.throws(() => parseSavedSession(JSON.stringify({ ...input, ownAudioHistory: entries })));
  assert.throws(() => parseSavedSession(JSON.stringify({ ...input, peerAudioHistory: undefined,
    peerAudioCheckpoint: audioCheckpoint, ownAudioHistory: [{ ...own, eventId: audioCheckpoint.eventId }] })));
  assert.throws(() => parseSavedSession(JSON.stringify({ ...input, ownAudioHistory: { version: 1,
    scope: [audioRoom.roomId, audioRoom.peerUserId, record.session.deviceId], entries: [] } })));
});

test('five own records survive restore and token refresh; write failure preserves prior data and peer changes clear both histories', async () => {
  let text = JSON.stringify({ ...record, peerRoom: audioRoom, peerAudioHistory: [audioCheckpoint] }), fail = false;
  const storage = new SerializedSessionStorage({ read: async () => text, erase: async () => {}, write: async value => {
    if (fail) throw new Error('secret-store-error'); text = value;
  } });
  const vault = new SessionVaultCore(record, parseSavedSession(text), storage, async () => {});
  for (let index = 1; index <= 7; index++) vault.saveOwnAudioCheckpoint({ ...audioCheckpoint,
    senderUserId: record.session.userId, eventId: '$own-' + index, createdAt: index });
  await vault.flush();
  const history = parseSavedSession(text).ownAudioHistory;
  assert.deepEqual(history.map(item => item.eventId), ['$own-7', '$own-6', '$own-5', '$own-4', '$own-3']);
  vault.saveSessionInKeychain({ ...record.session, accessToken: 'refreshed' }); await vault.flush();
  assert.deepEqual(parseSavedSession(text).ownAudioHistory, history);
  const before = text; fail = true;
  vault.saveOwnAudioCheckpoint({ ...history[0], eventId: '$failed' });
  await assert.rejects(vault.flush(), SessionPersistenceError); assert.equal(text, before);
  fail = false; vault.savePeerRoom({ ...audioRoom, peerUserId: '@new:example.org' }); await vault.flush();
  assert.equal(parseSavedSession(text).ownAudioHistory, undefined);
  assert.equal(parseSavedSession(text).peerAudioHistory, undefined);
  assert.equal(parseSavedSession(text).session.accessToken, 'refreshed');
});

test('history keeps five most recently received events, deduplicates and rejects changed content for the same event', () => {
  let history = [];
  for (let index = 1; index <= 7; index++) history = appendAudioHistory(history, { ...audioCheckpoint, eventId: '$audio-' + index, createdAt: index });
  assert.deepEqual(history.map(item => item.eventId), ['$audio-7', '$audio-6', '$audio-5', '$audio-4', '$audio-3']);
  const duplicate = appendAudioHistory(history, { ...history[2], createdAt: 100 });
  assert.deepEqual(duplicate, history);
  duplicate[0].eventId = '$mutated'; assert.equal(history[0].eventId, '$audio-7');
  assert.throws(() => appendAudioHistory(history, { ...history[2], audioSha256: 'd'.repeat(64) }), SessionPersistenceError);
});

test('history uses a compact bound representation, strips attachment secrets, and restores the same ordered records', async () => {
  let text;
  const history = [{ ...audioCheckpoint, eventId: '$second', createdAt: 2 }, audioCheckpoint];
  const input = { ...record, peerRoom: audioRoom, peerAudioCheckpoint: history[0], peerAudioHistory: history };
  const storage = new SerializedSessionStorage({ read: async () => text, erase: async () => {}, write: async value => { text = value; } });
  await storage.write({ ...input, peerAudioHistory: history.map(item => ({ ...item, source: 'secret-descriptor', playbackUri: 'plaintext-path' })) });
  assert.deepEqual(parseSavedSession(text), input);
  assert.equal(JSON.parse(text).peerAudioHistory.entries.length, 2);
  assert.deepEqual(JSON.parse(text).peerAudioHistory.scope, [audioRoom.roomId, audioRoom.peerUserId, record.session.deviceId]);
  assert.doesNotMatch(text, /secret-descriptor|plaintext-path/);
  assert.ok(text.length < JSON.stringify(input).length);
});

test('malformed, oversized, repeated or wrongly bound history cannot enter the stored session', () => {
  const input = { ...record, peerRoom: audioRoom, peerAudioHistory: [audioCheckpoint] };
  for (const history of [[audioCheckpoint, audioCheckpoint], Array(6).fill(audioCheckpoint),
    [{ ...audioCheckpoint, senderUserId: record.session.userId }], [{ ...audioCheckpoint, roomId: '!other' }],
    [{ ...audioCheckpoint, deviceId: 'OTHER' }], [{ ...audioCheckpoint, audioSha256: 'invalid' }],
    { version: 1, scope: [audioRoom.roomId, audioRoom.peerUserId, 'OTHER'], entries: [] },
    { version: 1, scope: [audioRoom.roomId, audioRoom.peerUserId, record.session.deviceId], entries: [['$bad']] }]) {
    assert.throws(() => parseSavedSession(JSON.stringify({ ...input, peerAudioHistory: history })));
  }
});

test('legacy single record becomes history; token refresh and failed writes preserve it; changing peer clears it', async () => {
  let text = JSON.stringify({ ...record, peerRoom: audioRoom, peerAudioCheckpoint: audioCheckpoint }), fail = false;
  const storage = new SerializedSessionStorage({ read: async () => text, erase: async () => {},
    write: async value => { if (fail) throw new Error('secret'); text = value; } });
  const vault = new SessionVaultCore(record, parseSavedSession(text), storage, async () => {});
  const next = { ...audioCheckpoint, eventId: '$next', createdAt: 2 };
  vault.savePeerAudioCheckpoint(next); await vault.flush();
  assert.deepEqual(parseSavedSession(text).peerAudioHistory, [next, audioCheckpoint]);
  vault.saveSessionInKeychain({ ...record.session, accessToken: 'refreshed' }); await vault.flush();
  assert.deepEqual(parseSavedSession(text).peerAudioHistory, [next, audioCheckpoint]);
  const before = text; fail = true;
  vault.savePeerAudioCheckpoint({ ...next, eventId: '$failed' });
  await assert.rejects(vault.flush(), SessionPersistenceError);
  assert.equal(text, before);
  fail = false;
  vault.savePeerRoom({ ...audioRoom, peerUserId: '@other:example.org' }); await vault.flush();
  const restored = parseSavedSession(text);
  assert.equal(restored.peerAudioHistory, undefined);
  assert.equal(restored.peerAudioCheckpoint, undefined);
  assert.equal(restored.session.accessToken, 'refreshed'); assert.equal(restored.passphrase, record.passphrase);
});

test('audio checkpoint persists only bound identifiers, limits and digest; old sessions still load', () => {
  const input = { ...record, peerRoom: audioRoom, peerAudioCheckpoint: audioCheckpoint };
  assert.deepEqual(parseSavedSession(JSON.stringify({ ...input, peerAudioCheckpoint: {
    ...audioCheckpoint, key: 'never-save', playbackUri: 'never-save', source: 'never-save',
  } })), input);
  assert.deepEqual(parseSavedSession(JSON.stringify(record)), record);
  for (const patch of [{ roomId: '!other' }, { senderUserId: record.session.userId }, { deviceId: 'OTHER' },
    { eventId: '$bad\0' }, { audioSha256: 'bad' }, { byteLength: 9_000_000 }, { durationMs: 60001 }, { createdAt: -1 }]) {
    assert.throws(() => parseSavedSession(JSON.stringify({ ...input, peerAudioCheckpoint: { ...audioCheckpoint, ...patch } })));
  }
});

test('audio checkpoint survives token refresh, failed writes preserve stored credentials, changing peer clears it', async () => {
  let text = JSON.stringify({ ...record, peerRoom: audioRoom }), fail = false;
  const storage = new SerializedSessionStorage({ read: async () => text, erase: async () => {},
    write: async value => { if (fail) throw new Error('do-not-show'); text = value; } });
  const vault = new SessionVaultCore(record, parseSavedSession(text), storage, async () => {});
  fail = true;
  const oldText = text;
  vault.savePeerAudioCheckpoint(audioCheckpoint);
  await assert.rejects(vault.flush(), SessionPersistenceError);
  assert.equal(text, oldText);
  fail = false;
  vault.savePeerAudioCheckpoint(audioCheckpoint); await vault.flush();
  vault.saveSessionInKeychain({ ...record.session, accessToken: 'refreshed-test-token' }); await vault.flush();
  assert.deepEqual(parseSavedSession(text).peerAudioCheckpoint, audioCheckpoint);
  vault.savePeerRoom(audioRoom); await vault.flush();
  assert.deepEqual(parseSavedSession(text).peerAudioCheckpoint, audioCheckpoint);
  vault.savePeerRoom({ ...audioRoom, roomId: '!different:example.org' }); await vault.flush();
  assert.equal(parseSavedSession(text).peerAudioCheckpoint, undefined);
});

test('persists room version 12 IDs without a server domain', async () => {
  const roomId = '!Nhcu5BS-UMnFX7hBVfVSoXiD7OgH6iRT-xyIuqDnpYQ';
  const input = { ...record, roomIds: { encrypted: roomId } };
  let value = null;
  const storage = new SerializedSessionStorage({
    async read() { return value; }, async write(text) { value = text; }, async erase() { value = null; },
  });
  await storage.write(input);
  assert.deepEqual(parseSavedSession(await storage.read()), input);
});

test('retains the same device, tokens, store key and room after restart; never retains passwords', () => {
  const saved = parseSavedSession(JSON.stringify({ ...record, password: 'do-not-save', session: { ...record.session, password: 'do-not-save' } }));
  assert.deepEqual(saved, record);
  assert.equal(JSON.stringify(saved).includes('do-not-save'), false);
});

test('rejects malformed sessions and paths without including credentials in errors', () => {
  for (const patch of [
    { id: '../outside' }, { passphrase: '' }, { version: 2 }, { roomIds: { encrypted: '../../outside' } },
    { roomIds: { encrypted: '!' } }, { roomIds: { encrypted: '!invalid room' } },
    { roomIds: { encrypted: '!invalid\0room' } }, { roomIds: { encrypted: '!' + 'a'.repeat(255) } },
    { session: { ...record.session, homeserverUrl: 'http://example.org' } },
    { session: { ...record.session, homeserverUrl: 'https://user:test-access@example.org' } },
    { session: { ...record.session, deviceId: '' } },
    { session: { ...record.session, slidingSyncVersion: 99 } },
  ]) {
    assert.throws(() => parseSavedSession(JSON.stringify({ ...record, ...patch })), (error) => {
      assert.equal(error.message.includes('test-access'), false);
      assert.equal(error.message.includes('test-refresh'), false);
      assert.equal(error.message.includes('bbbb'), false);
      return true;
    });
  }
  assert.throws(() => parseSavedSession('invalid-test-access'));
});

test('a delayed token save finishes before logout deletion and cannot resurrect login', async () => {
  let value = null;
  let release;
  const delay = new Promise((resolve) => { release = resolve; });
  const storage = new SerializedSessionStorage({
    async read() { return value; },
    async write(text) { await delay; value = text; },
    async erase() { value = null; },
  });
  const write = storage.write(record);
  const erase = storage.erase();
  const read = storage.read();
  release();
  await Promise.all([write, erase]);
  assert.equal(await read, null);
});

test('failed saves surface an error but do not block subsequent logout or login', async () => {
  let value = JSON.stringify(record);
  let fail = true;
  const storage = new SerializedSessionStorage({
    async read() { return value; },
    async write(text) { if (fail) throw new Error('storage unavailable'); value = text; },
    async erase() { value = null; },
  });
  await assert.rejects(storage.write(record), /storage unavailable/);
  assert.deepEqual(parseSavedSession(await storage.read()), record);
  await storage.erase();
  assert.equal(await storage.read(), null);
  fail = false;
  await storage.write(record);
  assert.deepEqual(parseSavedSession(await storage.read()), record);
});

test('queued writes snapshot metadata and keep the latest refreshed tokens', async () => {
  let value = null;
  const storage = new SerializedSessionStorage({
    async read() { return value; }, async write(text) { value = text; }, async erase() { value = null; },
  });
  const input = structuredClone(record);
  const first = storage.write(input);
  input.session.accessToken = 'refreshed-test-token';
  const second = storage.write(input);
  await Promise.all([first, second]);
  assert.equal(parseSavedSession(await storage.read()).session.accessToken, 'refreshed-test-token');
});

function testVault(write) {
  let value = JSON.stringify(record);
  let deleted = false;
  const storage = new SerializedSessionStorage({
    async read() { return value; },
    async write(text) { await write?.(text); value = text; },
    async erase() { value = null; },
  });
  const vault = new SessionVaultCore(record, structuredClone(record), storage, async () => { deleted = true; });
  return { vault, storage, deleted: () => deleted };
}

test('SDK delegate saves v12 encrypted room and checkpoint through token refresh and restore', async () => {
  const { vault, storage } = testVault();
  const roomId = '!Nhcu5BS-UMnFX7hBVfVSoXiD7OgH6iRT-xyIuqDnpYQ';
  const checkpoint = { roomId, eventId: '$test-event', deviceId: record.session.deviceId,
    bodySha256: 'c'.repeat(64), createdAt: 1791115200000 };
  vault.saveRoomIds({ encrypted: roomId });
  await vault.flush();
  vault.saveEncryptedCheckpoint(checkpoint);
  vault.saveSessionInKeychain({ ...record.session, accessToken: 'refreshed-test-token' });
  await vault.flush();
  const saved = parseSavedSession(await storage.read());
  assert.deepEqual(saved.encryptedCheckpoint, checkpoint);
  assert.equal(saved.roomIds.encrypted, roomId);
  assert.equal(saved.session.accessToken, 'refreshed-test-token');
  assert.equal(saved.passphrase, record.passphrase);
  const restored = new SessionVaultCore(saved, saved, storage, async () => {});
  assert.equal(restored.retrieveSessionFromKeychain(record.session.userId).deviceId, record.session.deviceId);
});

test('invalid checkpoint surfaces a format error after a pending good save without deleting login or keys', async () => {
  let release;
  const delay = new Promise((resolve) => { release = resolve; });
  const { vault, storage, deleted } = testVault(async () => { await delay; });
  vault.saveRoomIds(record.roomIds);
  vault.saveEncryptedCheckpoint({ roomId: record.roomIds.encrypted, eventId: '$test-event',
    deviceId: 'WRONG-DEVICE', bodySha256: 'c'.repeat(64), createdAt: 1791115200000 });
  const result = vault.flush();
  release();
  await assert.rejects(result, (error) => {
    assert.match(error.message, /формат/);
    assert.doesNotMatch(error.message, /свободное место|test-access|test-refresh/);
    return true;
  });
  assert.deepEqual(parseSavedSession(await storage.read()), record);
  assert.equal(deleted(), false);
});

test('native storage error keeps a safe error code and retains prior login for a successful retry', async () => {
  let fail = true;
  const { vault, storage, deleted } = testVault(async () => {
    if (fail) throw new SessionPersistenceError('secure-store', 'ERR_WRITE');
  });
  vault.saveRoomIds(record.roomIds);
  await assert.rejects(vault.flush(), /Защищённое хранилище.*ERR_WRITE/);
  assert.deepEqual(parseSavedSession(await storage.read()), record);
  assert.equal(deleted(), false);
  fail = false;
  vault.saveRoomIds(record.roomIds);
  await vault.flush();
});

test('unexpected storage exceptions and arbitrary codes cannot leak credentials to the screen', async () => {
  const { vault } = testVault(async () => { throw new Error('test-access test-refresh secret-passphrase'); });
  vault.saveRoomIds(record.roomIds);
  await assert.rejects(vault.flush(), (error) => {
    assert.doesNotMatch(error.message, /свободное место|test-access|test-refresh|secret-passphrase/);
    return true;
  });
  assert.doesNotMatch(new SessionPersistenceError('secure-store', 'test-access').message, /test-access/);
});
