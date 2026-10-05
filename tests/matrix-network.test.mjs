import assert from 'node:assert/strict';
import test from 'node:test';

import { changedTimelineItems, matchingRemoteEvent } from '../src/matrix/remote-echo.ts';
import { networkErrorText, validateServerUrl } from '../src/matrix/network-types.ts';
import { assertMegolmRoomState, inspectEncryptedEvent } from '../src/matrix/encrypted-proof.ts';
import { waitForEncryptionState } from '../src/matrix/encryption-readiness.ts';

const body = 'Matrix SDK test · unique';
const sender = '@test:example.org';
function message(overrides = {}) {
  return {
    isRemote: true,
    sender,
    eventOrTransactionId: { tag: 'EventId', inner: { eventId: '$received' } },
    content: {
      tag: 'MsgLike',
      inner: { content: { kind: { tag: 'Message', inner: { content: { body, msgType: { tag: 'Text' } } } } } },
    },
    ...overrides,
  };
}

test('accepts the same text from the logged-in sender only after a remote echo', () => {
  assert.equal(matchingRemoteEvent(message(), body, sender), '$received');
  // A local echo can already have a server ID after the HTTP send response.
  // It still does not prove receipt via sync.
  assert.equal(matchingRemoteEvent(message({ isRemote: false }), body, sender), undefined);
  assert.equal(matchingRemoteEvent(message({ sender: '@other:example.org' }), body, sender), undefined);
  assert.equal(matchingRemoteEvent(message(), 'previous probe', sender), undefined);
  assert.equal(matchingRemoteEvent(message({ eventOrTransactionId: { tag: 'TransactionId' } }), body, sender), undefined);
  assert.equal(matchingRemoteEvent(undefined, body, sender), undefined);
});

test('rejects state, redacted, and non-text events', () => {
  assert.equal(matchingRemoteEvent(message({ content: { tag: 'State' } }), body, sender), undefined);
  const redacted = message();
  redacted.content.inner.content.kind = { tag: 'Redacted' };
  assert.equal(matchingRemoteEvent(redacted, body, sender), undefined);
  const notice = message();
  notice.content.inner.content.kind.inner.content.msgType = { tag: 'Notice' };
  assert.equal(matchingRemoteEvent(notice, body, sender), undefined);
});

test('strict sync probe rejects cached, paginated and unknown-origin remote items', () => {
  // Generated EventItemOrigin values in 0.10.2: Local=0, Sync=1, Pagination=2, Cache=3.
  assert.equal(matchingRemoteEvent(message({ origin: 1 }), body, sender, 1), '$received');
  for (const origin of [0, 2, 3, undefined]) {
    assert.equal(matchingRemoteEvent(message({ origin }), body, sender, 1), undefined);
  }
});

test('detects remote replacement and initial/reset snapshots, ignores removals', () => {
  const local = { asEvent: () => message({ isRemote: false }) };
  const remote = { asEvent: () => message() };
  const diffs = [
    { tag: 'PushBack', inner: { value: local } },
    { tag: 'Set', inner: { index: 0, value: remote } },
    { tag: 'Reset', inner: { values: [remote] } },
    { tag: 'Remove', inner: { index: 0 } },
    { tag: 'Clear' },
  ];
  assert.deepEqual(changedTimelineItems(diffs), [local, remote, remote]);
  const ids = changedTimelineItems(diffs).map((item) => matchingRemoteEvent(item.asEvent(), body, sender));
  assert.deepEqual(ids, [undefined, '$received', '$received']);
  assert.deepEqual(changedTimelineItems([{ tag: 'Append', inner: { values: [remote] } }]), [remote]);
});

test('rejects server URLs that can leak credentials or disable HTTPS', () => {
  assert.equal(validateServerUrl(' https://matrix-client.matrix.org/ '), 'https://matrix-client.matrix.org');
  for (const url of ['http://example.org', 'https://user:secret@example.org', 'https://example.org/?token=secret', 'https://example.org/#secret']) {
    assert.throws(() => validateServerUrl(url));
  }
});

test('error output redacts secrets and gives an honest cancellation result', () => {
  const text = networkErrorText(new Error('failure password="testsecret" access_token=abc refresh_token=xyz'), 'testsecret');
  for (const secret of ['testsecret', 'abc', 'xyz']) assert.ok(!text.includes(secret));
  assert.match(networkErrorText(new Error('AbortError')), /могло уже попасть на сервер/);
  assert.match(networkErrorText(new Error('M_FORBIDDEN')), /отклонил вход/);
  assert.match(networkErrorText(new Error('M_LIMIT_EXCEEDED')), /подождать/);
});

const expected = { eventId: '$received', sender, roomId: '!probe:example.org', body };
function encryptedEvent() {
  return {
    event_id: expected.eventId, sender, room_id: expected.roomId, type: 'm.room.encrypted',
    content: { algorithm: 'm.megolm.v1.aes-sha2', ciphertext: 'opaque-base64-payload', session_id: 'test-session' },
  };
}

test('accepts the exact encrypted server event and returns no raw payload or keys', () => {
  assert.deepEqual(inspectEncryptedEvent(encryptedEvent(), expected), {
    eventType: 'm.room.encrypted', algorithm: 'm.megolm.v1.aes-sha2', ciphertextLength: 21,
  });
  const eventWithoutRoomId = encryptedEvent();
  delete eventWithoutRoomId.room_id;
  assert.equal(inspectEncryptedEvent(eventWithoutRoomId, expected).eventType, 'm.room.encrypted');
});

test('never counts plaintext or an unrelated server event as encrypted success', () => {
  const cases = [
    { ...encryptedEvent(), type: 'm.room.message', content: { body, msgtype: 'm.text' } },
    { ...encryptedEvent(), event_id: '$different' },
    { ...encryptedEvent(), sender: '@someone:example.org' },
    { ...encryptedEvent(), room_id: '!different:example.org' },
  ];
  for (const event of cases) assert.throws(() => inspectEncryptedEvent(event, expected));
});

test('rejects incomplete ciphertext, unexpected algorithms, and plaintext mixed into encrypted content', () => {
  for (const change of [
    { ciphertext: '' }, { session_id: '' }, { algorithm: 'unknown' },
    { body }, { msgtype: 'm.text' }, { unexpected: body },
  ]) {
    const event = encryptedEvent();
    Object.assign(event.content, change);
    assert.throws(() => inspectEncryptedEvent(event, expected));
  }
  for (const malformed of [null, [], 'not an event', { ...encryptedEvent(), content: null }]) {
    assert.throws(() => inspectEncryptedEvent(malformed, expected));
  }
});

test('requires the actual Megolm room setting from the server', () => {
  assert.doesNotThrow(() => assertMegolmRoomState({ algorithm: 'm.megolm.v1.aes-sha2' }));
  for (const value of [null, {}, { algorithm: 'unknown' }]) assert.throws(() => assertMegolmRoomState(value));
});

test('waits for sync to replace a partial room state before allowing encrypted send', async () => {
  const states = [2, 1, 0]; // Unknown, NotEncrypted placeholder, Encrypted.
  let reads = 0;
  await waitForEncryptionState(async () => { reads++; return states.shift(); }, 0, new AbortController().signal, { intervalMs: 1 });
  assert.equal(reads, 3);
});

test('Unknown never counts as proof of an unencrypted room', async () => {
  const states = [2, 1];
  let reads = 0;
  await waitForEncryptionState(async () => { reads++; return states.shift(); }, 1, new AbortController().signal, { intervalMs: 1 });
  assert.equal(reads, 2);
});

test('times out rather than sending when the native room never becomes encrypted', async () => {
  await assert.rejects(
    waitForEncryptionState(async () => 1, 0, new AbortController().signal, { timeoutMs: 10, intervalMs: 1 }),
    /Сообщение не отправлено/,
  );
});

test('cancellation also cancels a native read still in progress', async () => {
  const parent = new AbortController();
  let nativeWasCancelled = false;
  const pending = waitForEncryptionState((signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { nativeWasCancelled = true; reject(new Error('Aborted')); }, { once: true });
    parent.abort();
  }), 0, parent.signal);
  await assert.rejects(pending, /Aborted/);
  assert.equal(nativeWasCancelled, true);
});

test('preserves a native state read error rather than replacing it with false', async () => {
  await assert.rejects(waitForEncryptionState(async () => { throw new Error('native network error'); }, 0, new AbortController().signal), /native network error/);
});
