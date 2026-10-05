import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.(ts|tsx|mjs|cjs|js|json)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
} });
const { assertDiaryOwnerOnly, selectDiaryRecord } = await import('../src/matrix/diary-access.ts');
const { parseSavedSession, SerializedSessionStorage, SessionVaultCore } = await import('../src/matrix/saved-session.ts');

const own = '@tecno:example.org';
const ipad = '@ipad:example.org';
const diaryRoom = '!private:example.org';
const peerRoom = '!peer:example.org';
const session = {
  version: 1, id: 'a'.repeat(32), passphrase: 'b'.repeat(64),
  session: { accessToken: 'test-token', userId: own, deviceId: 'TECNO', homeserverUrl: 'https://example.org', slidingSyncVersion: 1 },
  roomIds: {}, peerRoom: { roomId: peerRoom, peerUserId: ipad },
};
const member = (userId, membership = 'join') => ({ type: 'm.room.member', state_key: userId, content: { membership } });
const checkpoint = (eventId, overrides = {}) => ({ roomId: diaryRoom, eventId, deviceId: 'TECNO', senderUserId: own,
  audioSha256: 'c'.repeat(64), byteLength: 640, durationMs: 1200, createdAt: 1791115200000, ...overrides });

test('private diary permits only the owner and rejects other members or invites', () => {
  assert.doesNotThrow(() => assertDiaryOwnerOnly({ chunk: [member(own)] }, own));
  for (const bad of [null, {}, { chunk: [] }, { chunk: [member(ipad)] },
    { chunk: [member(own), member(ipad)] }, { chunk: [member(own), member(ipad, 'invite')] },
    { chunk: [member(own), member(ipad, 'leave')] }, { chunk: [member(own, 'invite')] }]) {
    assert.throws(() => assertDiaryOwnerOnly(bad, own));
  }
});

test('selective transfer accepts only a saved owner record from the private room', () => {
  const first = checkpoint('$first'), second = checkpoint('$second');
  const selected = selectDiaryRecord([first, second], diaryRoom, own, '$second');
  assert.equal(selected.eventId, '$second');
  assert.notEqual(selected, second);
  for (const [history, id] of [[[], '$second'], [[checkpoint('$second', { senderUserId: ipad })], '$second'],
    [[checkpoint('$second', { roomId: peerRoom })], '$second'], [[first], '$second']]) {
    assert.throws(() => selectDiaryRecord(history, diaryRoom, own, id));
  }
});

test('two private records survive the serialized protected session and a third is blocked', async () => {
  let saved = JSON.stringify(session);
  const storage = new SerializedSessionStorage({
    async read() { return saved; },
    async write(value) { saved = value; },
    async erase() { saved = null; },
  });
  const vault = new SessionVaultCore(session, structuredClone(session), storage, async () => {});
  vault.saveDiaryRoom(diaryRoom);
  vault.saveDiaryAudioCheckpoint(checkpoint('$first'));
  vault.saveDiaryAudioCheckpoint(checkpoint('$second'));
  await vault.flush();
  const loaded = parseSavedSession(saved);
  assert.equal(loaded.diaryRoomId, diaryRoom);
  assert.deepEqual(loaded.diaryAudioHistory.map(item => item.eventId), ['$second', '$first']);
  assert.equal(loaded.peerRoom.roomId, peerRoom);
  assert.ok(!saved.includes('plaintext diary content'));
  assert.throws(() => vault.saveDiaryAudioCheckpoint(checkpoint('$third')));
  assert.throws(() => vault.saveDiaryAudioCheckpoint(checkpoint('$bad-room', { roomId: peerRoom })));
  vault.saveOwnAudioCheckpoint(checkpoint('$shared', { roomId: peerRoom }));
  await vault.flush();
  vault.saveDiaryShare('$second', '$shared');
  await vault.flush();
  assert.deepEqual(parseSavedSession(saved).diaryShare, { sourceEventId: '$second', peerEventId: '$shared' });
  assert.throws(() => vault.saveDiaryShare('$first', '$other'));
  vault.saveSessionInKeychain(session.session);
  await vault.flush();
  assert.deepEqual(parseSavedSession(saved).diaryAudioHistory.map(item => item.eventId), ['$second', '$first']);
  assert.equal(parseSavedSession(saved).diaryShare.sourceEventId, '$second');
});

test('wrong account, room, device and malformed persisted metadata fail closed', () => {
  const good = { ...session, diaryRoomId: diaryRoom, diaryAudioHistory: [checkpoint('$first')] };
  assert.equal(parseSavedSession(JSON.stringify(good)).diaryAudioHistory.length, 1);
  for (const change of [
    { diaryRoomId: peerRoom },
    { diaryAudioHistory: [checkpoint('$first', { senderUserId: ipad })] },
    { diaryAudioHistory: [checkpoint('$first', { deviceId: 'OTHER' })] },
    { diaryAudioHistory: [checkpoint('$first', { roomId: peerRoom })] },
    { diaryAudioHistory: [checkpoint('$first'), checkpoint('$first')] },
    { diaryAudioHistory: [checkpoint('$first'), checkpoint('$second'), checkpoint('$third')] },
    { diaryShare: { sourceEventId: '$unknown', peerEventId: '$shared' } },
  ]) {
    assert.throws(() => parseSavedSession(JSON.stringify({ ...good, ...change })));
  }
});
