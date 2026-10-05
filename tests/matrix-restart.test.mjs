import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { assertCheckpointDigest, checkpointMessageBody } from '../src/matrix/restart-probe.ts';
import { parseSavedSession, SerializedSessionStorage } from '../src/matrix/saved-session.ts';
import { inspectEncryptedEvent } from '../src/matrix/encrypted-proof.ts';

const body = 'Matrix SDK encrypted test · restart fixture';
const sender = '@test:example.org';
const checkpoint = {
  roomId: '!probe:example.org', eventId: '$old', deviceId: 'SAME-DEVICE',
  bodySha256: createHash('sha256').update(body).digest('hex'), createdAt: 1_800_000_000_000,
};
const record = {
  version: 1, id: 'a'.repeat(32), passphrase: 'b'.repeat(64), roomIds: { encrypted: checkpoint.roomId },
  session: { accessToken: 'test-only-token', userId: sender, deviceId: checkpoint.deviceId,
    homeserverUrl: 'https://example.org', slidingSyncVersion: 1 },
  encryptedCheckpoint: checkpoint,
};
function nativeEvent(overrides = {}) {
  return {
    eventId: () => checkpoint.eventId, senderId: () => sender,
    content: () => ({ tag: 'MessageLike', inner: { content: { tag: 'RoomMessage',
      inner: { messageType: { tag: 'Text', inner: { content: { body } } } } } } }),
    ...overrides,
  };
}

test('persists an encrypted checkpoint across storage restart without retaining plaintext', async () => {
  let disk = null;
  const backend = { async read() { return disk; }, async write(text) { disk = text; }, async erase() { disk = null; } };
  const storage = new SerializedSessionStorage(backend);
  await storage.write({ ...record, encryptedCheckpoint: { ...checkpoint, body, password: 'not-retained' } });
  const restored = parseSavedSession(await new SerializedSessionStorage(backend).read());
  assert.deepEqual(restored.encryptedCheckpoint, checkpoint);
  assert.equal(disk.includes(body), false);
  assert.equal(disk.includes('not-retained'), false);
  // A refreshed token does not change the checkpoint or device.
  await storage.write({ ...restored, session: { ...restored.session, accessToken: 'refreshed-test-token' } });
  assert.deepEqual(parseSavedSession(await storage.read()).encryptedCheckpoint, checkpoint);
});

test('rejects checkpoints for another room or device and malformed identities or digests', () => {
  for (const patch of [
    { roomId: '!other:example.org' }, { deviceId: 'OTHER-DEVICE' }, { eventId: 'invalid' },
    { eventId: '$space not valid' }, { bodySha256: body }, { bodySha256: '0'.repeat(63) },
    { createdAt: 0 }, { createdAt: 1.5 },
  ]) {
    assert.throws(() => parseSavedSession(JSON.stringify({ ...record, encryptedCheckpoint: { ...checkpoint, ...patch } })), (error) => {
      assert.equal(error.message.includes(body), false);
      assert.equal(error.message.includes('test-only-token'), false);
      return true;
    });
  }
  const oldRecord = structuredClone(record);
  delete oldRecord.encryptedCheckpoint;
  assert.deepEqual(parseSavedSession(JSON.stringify(oldRecord)), {
    ...oldRecord, session: { ...oldRecord.session, refreshToken: undefined },
  });
});

test('accepts exactly the old decrypted SDK event from the same user and device', () => {
  const nativeBody = checkpointMessageBody(nativeEvent(), checkpoint, sender, checkpoint.deviceId);
  assert.equal(nativeBody, body);
  assertCheckpointDigest(createHash('sha256').update(nativeBody).digest('hex'), checkpoint);
  for (const [event, device] of [
    [nativeEvent({ eventId: () => '$new' }), checkpoint.deviceId],
    [nativeEvent({ senderId: () => '@other:example.org' }), checkpoint.deviceId],
    [nativeEvent(), 'OTHER-DEVICE'],
  ]) assert.throws(() => checkpointMessageBody(event, checkpoint, sender, device));
  assert.throws(() => assertCheckpointDigest(createHash('sha256').update('different message').digest('hex'), checkpoint));
});

test('encrypted, state, redacted and non-text native content cannot masquerade as restored plaintext', () => {
  for (const content of [
    { tag: 'State' },
    { tag: 'MessageLike', inner: { content: { tag: 'RoomEncrypted' } } },
    { tag: 'MessageLike', inner: { content: { tag: 'RoomRedaction' } } },
    { tag: 'MessageLike', inner: { content: { tag: 'RoomMessage', inner: { messageType: { tag: 'Notice' } } } } },
  ]) assert.throws(() => checkpointMessageBody(nativeEvent({ content: () => content }), checkpoint, sender, checkpoint.deviceId));
});

test('checks wire ciphertext before native read and rejects plaintext leaks after the body is known', () => {
  const wire = { event_id: checkpoint.eventId, sender, room_id: checkpoint.roomId, type: 'm.room.encrypted',
    content: { algorithm: 'm.megolm.v1.aes-sha2', session_id: 'test-session', ciphertext: 'opaque-payload' } };
  const identity = { eventId: checkpoint.eventId, sender, roomId: checkpoint.roomId };
  assert.equal(inspectEncryptedEvent(wire, identity).eventType, 'm.room.encrypted');
  assert.equal(inspectEncryptedEvent(wire, { ...identity, body }).eventType, 'm.room.encrypted');
  assert.throws(() => inspectEncryptedEvent({ ...wire, type: 'm.room.message' }, identity));
  assert.throws(() => inspectEncryptedEvent({ ...wire, content: { ...wire.content, body } }, identity));
  const leak = { ...wire, content: { ...wire.content, extra: body } };
  assert.throws(() => inspectEncryptedEvent(leak, { ...identity, body }));
});
