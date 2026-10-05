import assert from 'node:assert/strict';
import test from 'node:test';
import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { AudioProbeError, audioProbeErrorText, equalBytes, inspectEncryptedAudioSource, makeTestAudio, matchingRemoteAudio } from '../src/matrix/audio-probe.ts';

// These are adapter tests, not evidence of native encryption on a phone. Node
// encrypts fixtures independently; the actual Rust SDK is tested by the screen.
const mockSdk = `
  export const EncryptionState = { Encrypted: 0 };
  export const VerificationState = { Verified: 1 };
  export const EventItemOrigin = { Sync: 1 };
  export const SyncServiceState = { Error: 3, Offline: 4, Terminated: 2 };
  export const UploadSource = { Data: class { tag = 'Data'; constructor(inner) { this.inner = inner; } } };
  export const MediaSource = { fromUrl(url) { return { kind: 'plain', url: () => url, uniffiDestroy() {} }; } };
`;
const mockCrypto = `
  import { createHash } from 'node:crypto';
  export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' };
  export async function getRandomBytesAsync(n) { return new Uint8Array(n).fill(10); }
  export async function digest(algorithm, bytes) {
    if (algorithm !== 'SHA-256') throw new Error('unexpected hash algorithm');
    return new Uint8Array(createHash('sha256').update(bytes).digest()).buffer;
  }
`;
const mockFiles = String.raw`
  export const Paths = { cache: { uri: 'file:///cache/expo/' } };
  export class File {
    constructor(...parts) { this.uri = parts.map(p => typeof p === 'string' ? p : p.uri).reduce((a, b) => a ? a.replace(/\/$/, '') + '/' + b : b, ''); }
    get exists() { return globalThis.__matrixAudioFiles.has(this.uri); }
    get size() { const f = globalThis.__matrixAudioFiles.get(this.uri); return f.size ?? f.bytes.length; }
    async bytes() { const f = globalThis.__matrixAudioFiles.get(this.uri); f.onRead?.(); return new Uint8Array(f.bytes); }
    create() { if (this.exists) throw new Error('already exists'); globalThis.__matrixAudioFiles.set(this.uri, { bytes: new Uint8Array() }); }
    write(bytes) { globalThis.__matrixAudioFiles.set(this.uri, { bytes: new Uint8Array(bytes) }); }
    delete() { globalThis.__matrixAudioFiles.delete(this.uri); }
  }
  export class Directory extends File { create() {} }
`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mock = { '@unomed/react-native-matrix-sdk': mockSdk, 'expo-crypto': mockCrypto, 'expo-file-system': mockFiles }[specifier];
    if (mock) return { url: 'data:text/javascript,' + encodeURIComponent(mock), shortCircuit: true };
    if (specifier.startsWith('.') && !/\.(ts|tsx|mjs|cjs|js|json)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  },
});
const { NativePeerTest } = await import('../src/matrix/peer-test.native.ts');
const { SessionVaultCore, SerializedSessionStorage, parseSavedSession } = await import('../src/matrix/saved-session.ts');
const { VoiceDraftController } = await import('../src/matrix/voice-draft-controller.ts');
const { VoiceConnectionError } = await import('../src/matrix/voice-send-connection.ts');
const own = '@tecno:example.org', peer = '@ipad:example.org';
const target = { roomId: '!test:example.org', peerUserId: peer };
const nonce = '0a'.repeat(16), filename = `matrix-audio-${nonce}.wav`;
const key = Buffer.alloc(32, 73), iv = Buffer.alloc(16, 0);
const digest = (bytes) => createHash('sha256').update(bytes).digest('base64').replace(/=+$/, '');
function descriptor(ciphertext = Buffer.alloc(32, 7)) {
  return { file: { url: 'mxc://example.org/audio', v: 'v2', iv: iv.toString('base64'),
    hashes: { sha256: digest(ciphertext) }, key: { alg: 'A256CTR', kty: 'oct', ext: true,
      key_ops: ['encrypt', 'decrypt'], k: key.toString('base64url') } } };
}
function event(audio, patch = {}) {
  return { isRemote: true, origin: 1, sender: own, eventOrTransactionId: { tag: 'EventId', inner: { eventId: '$audio' } },
    content: { tag: 'MsgLike', inner: { content: { kind: { tag: 'Message', inner: { content: { msgType: { tag: 'Audio', inner: { content: audio } } } } } } } }, ...patch };
}

test('test audio is a small valid PCM WAV with two separated tones and no recording', () => {
  const audio = makeTestAudio(nonce), b = Buffer.from(audio.bytes);
  assert.equal(audio.filename, filename); assert.equal(audio.durationMs, 1000);
  assert.equal(b.length, 32044); assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WAVE'); assert.equal(b.readUInt32LE(4), b.length - 8);
  assert.equal(b.readUInt16LE(20), 1); assert.equal(b.readUInt16LE(22), 1);
  assert.equal(b.readUInt32LE(24), 16000); assert.equal(b.readUInt16LE(34), 16);
  assert.equal(b.readUInt32LE(40), b.length - 44);
  for (const offset of [0, 7500, 15000]) assert.equal(b.readInt16LE(44 + 2 * offset), 0);
  assert.ok(b.readInt16LE(44 + 2 * 3501) !== 0); assert.ok(b.readInt16LE(44 + 2 * 11001) !== 0);
  for (const bad of ['', '1', 'g'.repeat(32), '../filename']) assert.throws(() => makeTestAudio(bad), AudioProbeError);
});

test('accepts Matrix v2, projects only public URL and checksum, handles unpadded base64', () => {
  const input = descriptor(); input.file.iv = input.file.iv.replace(/=+$/, '');
  const proof = inspectEncryptedAudioSource(JSON.stringify(input));
  assert.deepEqual(Object.keys(proof).sort(), ['ciphertextSha256', 'url']);
  assert.equal(proof.ciphertextSha256.length, 32); assert.equal(proof.url, input.file.url);
  assert.equal(JSON.stringify(proof).includes(input.file.key.k), false);
});

test('rejects plaintext, malformed, ambiguous and unsupported encrypted descriptors without leaking key material', () => {
  const mutations = [() => null, () => ({ url: 'mxc://example.org/audio' }),
    (x) => ({ ...x, url: x.file.url }), (x) => { x.file.v = 'v1'; return x; },
    (x) => { x.file.key.k = 'too-short'; return x; }, (x) => { x.file.iv = 'bad-iv'; return x; },
    (x) => { x.file.hashes.sha256 = 'x'.repeat(43); return x; }, // invalid trailing bits
    (x) => { x.file.key.key_ops = ['encrypt']; return x; }, (x) => { x.file.key.alg = 'none'; return x; },
    (x) => { x.file.url = 'https://example.org/untrusted'; return x; }];
  for (const mutate of mutations) assert.throws(() => inspectEncryptedAudioSource(JSON.stringify(mutate(descriptor()))), AudioProbeError);
  assert.throws(() => inspectEncryptedAudioSource('{private key not JSON'), AudioProbeError);
  assert.ok(!audioProbeErrorText(new Error(key.toString('base64url'))).includes(key.toString('base64url')));
  assert.equal(equalBytes(new Uint8Array([1]), new Uint8Array([1, 0])), false);
});

test('remote audio match excludes local sends, cache, wrong sender, stale filename and wrong message type', () => {
  const audio = { filename };
  assert.equal(matchingRemoteAudio(event(audio), filename, own, 1).eventId, '$audio');
  for (const item of [undefined, event(audio, { isRemote: false }), event(audio, { origin: 3 }),
    event(audio, { sender: peer }), event({ filename: 'old.wav' }),
    event(audio, { eventOrTransactionId: { tag: 'TransactionId' } }), event(audio, { content: { tag: 'Redacted' } })]) {
    assert.equal(matchingRemoteAudio(item, filename, own, 1), undefined);
  }
});

function fixture(options = {}) {
  const trace = [], files = new Map(), stages = [], abort = new AbortController();
  const filename = options.voice ? `matrix-voice-${nonce}.m4a` : `matrix-audio-${nonce}.wav`;
  const recordingUri = 'file:///cache/expo/recording.m4a';
  const voiceBytes = Buffer.alloc(4096, 7); voiceBytes.write('ftyp', 4);
  if (options.voice) files.set(recordingUri, { bytes: voiceBytes, size: options.oversizeVoice ? 2 ** 30 : undefined });
  globalThis.__matrixAudioFiles = files;
  const counters = { sent: 0, stopped: 0, mediaDestroyed: 0, uploadCancelled: 0, listenerCancelled: 0, queueCancelled: 0 };
  const inert = { uniffiDestroy() {} };
  const cancelHandle = (name) => ({ ...inert, cancel() { counters[name]++; } });
  let timelineListener, queueListener, ciphertext, original, sourceDescriptor;
  const source = { ...inert, url: () => 'mxc://example.org/audio',
    toJson: () => JSON.stringify(options.plainSource ? { url: source.url() } : sourceDescriptor) };
  const timeline = { ...inert,
    async fetchMembers() { trace.push('members'); },
    async addListener(listener) { timelineListener = listener; return cancelHandle('listenerCancelled'); },
    sendAudio(params, info, voiceMessage = false) {
      if (!voiceMessage) trace.push('audio-message');
      assert.ok(trace.includes('members')); assert.ok(trace.includes('trust:' + own)); assert.ok(trace.includes('trust:' + peer));
      if (options.voice) assert.ok(trace.includes('upload-guard'));
      assert.equal(params.source.tag, 'Data'); assert.equal(params.source.inner.filename, filename);
      counters.sent++; original = Buffer.from(params.source.inner.bytes);
      assert.equal(info.mimetype, options.voice ? 'audio/mp4' : 'audio/wav'); assert.equal(info.duration, options.voice ? 2200 : 1000); assert.equal(info.size, BigInt(original.length));
      const cipher = createCipheriv('aes-256-ctr', key, iv);
      ciphertext = Buffer.concat([cipher.update(original), cipher.final()]);
      if (options.plainCipher) ciphertext = original;
      sourceDescriptor = descriptor(ciphertext);
      if (options.badHash) sourceDescriptor.file.hashes.sha256 = digest(Buffer.from('wrong'));
      const audio = { filename, source, info: options.badInfo ? { ...info, size: 1n } : info,
        ...(voiceMessage || options.unexpectedVoice ? { voice: {}, audio: { duration: info.duration, waveform: [10, 300] } } : {}) };
      // Local/cache echoes arrive first, including an exact filename match.
      timelineListener.onUpdate([{ tag: 'Append', inner: { values: [
        { asEvent: () => event(audio, { isRemote: false }) }, { asEvent: () => event(audio, { origin: 3 }) },
        { asEvent: () => event(audio, { sender: peer }) },
      ] } }]);
      if (options.queueError) queueListener.onError(target.roomId, new Error(JSON.stringify(sourceDescriptor)));
      else if (!options.noEcho) queueMicrotask(() => timelineListener.onUpdate([{ tag: 'PushBack', inner: { value: { asEvent: () => event(audio) } } }]));
      return { ...inert, async join() { trace.push('join'); if (options.joinError) throw new Error(JSON.stringify(sourceDescriptor)); },
        cancel() { counters.uploadCancelled++; if (options.cancelThrows) throw new Error('native cancel failed'); } };
    },
    sendVoiceMessage(params, info, waveform) {
      trace.push('voice-message'); assert.deepEqual(waveform, [0.1, 0.3]);
      return this.sendAudio(params, info, true);
    },
  };
  const room = { ...inert, async latestEncryptionState() { return 0; }, async timeline() { return timeline; } };
  const sync = { ...inert, state() { return { ...inert, cancel() {} }; }, async start() {},
    async stop() { counters.stopped++; if (options.cancelDuringSyncStop) abort.abort(); }, roomListService() { return { ...inert, async subscribeToRooms() {} }; } };
  const client = {
    userId: () => own, session: () => ({ homeserverUrl: 'https://example.org', accessToken: 'test-token', deviceId: 'TECNO' }),
    syncService() { return { ...inert, withRoomListTimelineLimit() { return this; }, async finish() { return sync; } }; },
    async awaitRoomRemoteEcho() { trace.push('room-ready'); if (options.roomGate) await options.roomGate.promise; return room; },
    encryption() { return { ...inert, async waitForE2eeInitializationTasks() {},
      async userIdentity(userId) { trace.push('trust:' + userId); return { ...inert,
        isVerified: () => options.untrustedUser !== userId, hasVerificationViolation: () => options.changedUser === userId }; },
      verificationState: () => options.untrustedDevice ? 0 : 1 }; },
    subscribeToSendQueueStatus(listener) { queueListener = listener; return cancelHandle('queueCancelled'); },
    async getMediaFile(media, safeName, mime, useCache, tempDir) {
      assert.equal(useCache, false); assert.equal(tempDir, '/cache/expo/');
      assert.equal(safeName, filename, 'Rust must receive a filename with extension to use the writable cache directory');
      assert.equal(media.url(), source.url());
      if (options.downloadError) throw new Error(JSON.stringify(sourceDescriptor));
      const plain = media.kind === 'plain'; trace.push(plain ? 'download-cipher' : 'download-decrypt');
      let bytes;
      if (plain) bytes = ciphertext;
      else { const decoder = createDecipheriv('aes-256-ctr', key, iv); bytes = Buffer.concat([decoder.update(ciphertext), decoder.final()]); }
      if (!plain && options.badPlaintext) bytes[100] ^= 1;
      const path = '/cache/expo/file-' + trace.length + '.wav', uri = 'file://' + path;
      files.set(uri, { bytes, size: options.badSize ? 9000000000 : undefined, onRead() { if (options.cancelDuringRead) abort.abort(); } });
      return { path: () => path, uniffiDestroy() { files.delete(uri); counters.mediaDestroyed++; } };
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer test-token');
    let value;
    if (url.endsWith('/joined_members')) value = { joined: { [own]: {}, [peer]: {}, ...(options.thirdUser ? { '@third:example.org': {} } : {}) } };
    else if (url.endsWith('/state/m.room.encryption/')) value = { algorithm: options.plainRoom ? 'plain' : 'm.megolm.v1.aes-sha2' };
    else { trace.push('server-event'); value = { event_id: options.wrongEvent ? '$other' : '$audio', sender: own, room_id: target.roomId,
      type: options.plainEvent ? 'm.room.message' : 'm.room.encrypted', content: { algorithm: 'm.megolm.v1.aes-sha2', ciphertext: 'opaque', session_id: 'test' } }; }
    return { ok: true, json: async () => value };
  };
  const record = { version: 1, id: 'a'.repeat(32), passphrase: 'b'.repeat(64), roomIds: {}, peerRoom: target,
    session: { accessToken: 'test-token', userId: own, deviceId: 'TECNO', homeserverUrl: 'https://example.org', slidingSyncVersion: 1 } };
  let saved = JSON.stringify(record);
  const storage = new SerializedSessionStorage({ read: async () => saved, erase: async () => {}, write: async text => {
    trace.push('save-history');
    if (options.historySaveFailure) throw new Error('secret storage error');
    saved = text;
    if (options.cancelHistorySave) abort.abort();
  } });
  const vault = new SessionVaultCore(record, record, storage, async () => {});
  const probe = new NativePeerTest(client, true, vault, options.noRoom ? null : target);
  const run = () => probe.sendAudio(abort.signal, (text) => {
    stages.push(text);
    if (options.abortStage && text.startsWith(options.abortStage)) abort.abort();
  }, options.voice ? { uri: recordingUri, durationMs: 2200, waveform: [0.1, 0.3] } : undefined,
  options.voice && options.beforeUpload !== false ? async signal => {
    trace.push('upload-guard'); await options.beforeUpload?.(signal, trace);
  } : undefined);
  return { run, probe, vault, saved: () => parseSavedSession(saved), abort, counters, stages, trace, files, voiceBytes, recordingUri,
    restore() { globalThis.fetch = originalFetch; delete globalThis.__matrixAudioFiles; } };
}

const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(ok => { resolve = ok; }); return { promise, resolve }; }
function draftController() {
  const record = { id: 'ab'.repeat(16), createdAt: 1, state: 'draft',
    draft: { uri: 'file:///cache/expo/recording.m4a', durationMs: 2200, waveform: [0.1, 0.3] } };
  const scope = { userId: own, deviceId: 'TECNO', serverUrl: 'https://example.org', ...target };
  const trace = [], states = [];
  const store = { async restore() { return { ...record }; }, async markSending(_, id) {
    assert.equal(id, record.id); assert.equal(record.state, 'draft'); trace.push('marker'); record.state = 'sending'; return { ...record };
  } };
  const make = () => new VoiceDraftController(store, scope, { changed: s => states.push(s), restored: () => true, discard() {} });
  return { controller: make(), record, trace, states, make };
}

test('real attachment adapter waits for the durable boundary guard after members and trust, before enqueueing', async () => {
  const pending = deferred();
  const f = fixture({ voice: true, beforeUpload: async (_, trace) => { trace.push('marker-start'); await pending.promise; trace.push('marker-committed'); } });
  try {
    const work = f.run();
    for (let i = 0; i < 100 && !f.trace.includes('marker-start'); i++) await tick();
    assert.ok(f.trace.includes('marker-start')); assert.equal(f.counters.sent, 0);
    assert.ok(f.trace.indexOf('members') < f.trace.indexOf('marker-start'));
    assert.ok(f.trace.indexOf('trust:' + peer) < f.trace.indexOf('marker-start'));
    pending.resolve(); await work; assert.equal(f.counters.sent, 1);
    assert.ok(f.trace.indexOf('marker-committed') < f.trace.indexOf('audio-message'));
  } finally { pending.resolve(); f.restore(); }
});

test('Reload during actual room preparation prevents a stale upload guard and leaves the draft retryable', async () => {
  const local = draftController(), roomGate = deferred(); await local.controller.restore(); await local.controller.beforeSend(async () => {});
  const f = fixture({ voice: true, roomGate, beforeUpload: signal => local.controller.beforeUpload(signal, async () => {}) });
  try {
    const work = f.run(), rejected = assert.rejects(work);
    for (let i = 0; i < 100 && !f.trace.includes('room-ready'); i++) await tick();
    assert.ok(f.trace.includes('room-ready')); assert.deepEqual(local.trace, []); assert.equal(f.counters.sent, 0);
    // Even if old native room setup returns after the screen is disposed, the
    // closed controller refuses the upload. No upload marker was committed.
    await local.controller.dispose(); roomGate.resolve(); await rejected;
    assert.deepEqual(local.trace, []); assert.equal(f.counters.sent, 0); assert.equal(local.record.state, 'draft');
    const reopened = local.make(); await reopened.restore(); assert.equal(local.states.at(-1).saved.state, 'draft');
  } finally { roomGate.resolve(); f.restore(); }
});

test('voice adapter without the upload guard fails closed before the native attachment call', async () => {
  const f = fixture({ voice: true, beforeUpload: false });
  try { await assert.rejects(f.run(), /Reload/); assert.equal(f.counters.sent, 0); }
  finally { f.restore(); }
});

test('fresh connection failure at the actual attachment boundary keeps a retryable draft without enqueueing', async () => {
  const local = draftController(); await local.controller.restore(); await local.controller.beforeSend(async () => {});
  const f = fixture({ voice: true, beforeUpload: signal => local.controller.beforeUpload(signal, async () => {
    throw new VoiceConnectionError('Нет связи. Черновик сохранён на Tecno.');
  }) });
  try {
    await assert.rejects(f.run(), /Черновик сохранён/); assert.equal(f.counters.sent, 0);
    assert.deepEqual(local.trace, []); assert.equal(local.record.state, 'draft');
  } finally { f.restore(); }
});

test('cancellation while the real upload guard is pending prevents a late marker and native audio send', async () => {
  const local = draftController(), connection = deferred(); await local.controller.restore(); await local.controller.beforeSend(async () => {});
  const f = fixture({ voice: true, beforeUpload: signal => local.controller.beforeUpload(signal, () => connection.promise) });
  try {
    const work = f.run(), rejected = assert.rejects(work);
    for (let i = 0; i < 100 && !f.trace.includes('upload-guard'); i++) await tick();
    assert.ok(f.trace.includes('upload-guard')); f.abort.abort(); connection.resolve(); await rejected;
    assert.equal(f.counters.sent, 0); assert.deepEqual(local.trace, []); assert.equal(local.record.state, 'draft');
  } finally { connection.resolve(); f.restore(); }
});

test('failure after the real attachment call keeps the persistent marker and blocks duplicate sending', async () => {
  const local = draftController(); await local.controller.restore(); await local.controller.beforeSend(async () => {});
  const f = fixture({ voice: true, noEcho: true, abortStage: 'Ждём аудиосообщение',
    beforeUpload: signal => local.controller.beforeUpload(signal, async () => {}) });
  try {
    await assert.rejects(f.run()); assert.equal(f.counters.sent, 1); assert.deepEqual(local.trace, ['marker']);
    assert.equal(local.record.state, 'sending'); await local.controller.dispose(); const reopened = local.make(); await reopened.restore();
    await assert.rejects(reopened.beforeSend()); assert.equal(f.counters.sent, 1);
  } finally { f.restore(); }
});

test('full adapter flow waits for sync echo, proves server ciphertext, bypasses cache twice and destroys temporary files', async () => {
  const f = fixture();
  try {
    const report = await f.run();
    assert.equal(report.eventId, '$audio'); assert.equal(report.filename, filename); assert.equal(report.byteLength, 32044);
    assert.equal(report.encryption.eventType, 'm.room.encrypted'); assert.equal(report.peerUserId, peer);
    assert.deepEqual(f.trace.filter((x) => x.startsWith('download')), ['download-cipher', 'download-decrypt']);
    assert.ok(f.trace.indexOf('server-event') < f.trace.indexOf('download-cipher'));
    assert.equal(f.counters.sent, 1); assert.equal(f.counters.stopped, 1); assert.equal(f.counters.mediaDestroyed, 2);
    assert.equal(f.counters.uploadCancelled, 0); assert.equal(f.counters.listenerCancelled, 1); assert.equal(f.counters.queueCancelled, 1);
    assert.equal(f.files.size, 0); assert.equal(JSON.stringify([report, f.stages]).includes(key.toString('base64url')), false);
  } finally { f.restore(); }
});

test('confirmed voice enters protected own history after decryption; restoring the same metadata does not send again', async () => {
  const f = fixture({ voice: true });
  try {
    const result = await f.run();
    const [saved] = f.saved().ownAudioHistory;
    assert.equal(saved.eventId, result.eventId); assert.equal(saved.roomId, target.roomId); assert.equal(saved.senderUserId, own);
    assert.equal(saved.audioSha256, createHash('sha256').update(f.voiceBytes).digest('hex'));
    assert.equal(f.trace.indexOf('save-history') > f.trace.indexOf('download-decrypt'), true);
    const restored = new NativePeerTest({ userId: () => own }, true, f.vault, target, null, null, [], f.saved().ownAudioHistory);
    assert.deepEqual(restored.ownAudioRecords, f.probe.ownAudioRecords);
    assert.equal(f.counters.sent, 1); assert.equal(f.probe.audioRecords.length, 0);
  } finally { f.restore(); }
});

test('failure to store a confirmed voice does not keep a playback file or advertise saved history', async () => {
  const f = fixture({ voice: true, historySaveFailure: true });
  try {
    await assert.rejects(f.run(), /не удалось сохранить в истории/);
    assert.equal(f.counters.sent, 1); assert.deepEqual(f.probe.ownAudioRecords, []);
    assert.equal(f.saved().ownAudioHistory, undefined);
    assert.equal([...f.files.keys()].some(uri => uri.includes('matrix-voice-verified')), false);
  } finally { f.restore(); }
});

test('unconfirmed native delivery cannot add a sent record', async () => {
  const f = fixture({ voice: true, joinError: true });
  try {
    await assert.rejects(f.run());
    assert.deepEqual(f.probe.ownAudioRecords, []); assert.equal(f.saved().ownAudioHistory, undefined);
    assert.equal(f.trace.includes('save-history'), false);
  } finally { f.restore(); }
});

test('synthetic diagnostic sound is excluded from voice history', async () => {
  const f = fixture();
  try { await f.run(); assert.equal(f.saved().ownAudioHistory, undefined); assert.equal(f.trace.includes('save-history'), false); }
  finally { f.restore(); }
});

test('M4A recording uses ordinary audio for Element X and retains verified downloaded plaintext', async () => {
  const f = fixture({ voice: true });
  try {
    const report = await f.run();
    // Element X iOS routes the voice marker to an OGG-only loader. AAC/M4A
    // must use ordinary m.audio; changing only the MIME label is not a codec conversion.
    assert.equal(f.trace.filter(x => x === 'voice-message').length, 0);
    assert.equal(f.trace.filter(x => x === 'audio-message').length, 1);
    assert.ok(report.playbackUri.includes('/matrix-voice-verified/'));
    assert.notEqual(report.playbackUri, f.recordingUri);
    assert.deepEqual(Buffer.from(f.files.get(report.playbackUri).bytes), f.voiceBytes);
    assert.equal(f.counters.mediaDestroyed, 2); assert.equal(f.files.size, 2);
    const { discardVoiceFile } = await import('../src/matrix/voice-files.native.ts');
    discardVoiceFile(report.playbackUri);
    assert.equal(f.files.size, 1, 'original draft belongs to the recorder UI');
  } finally { f.restore(); }
});

for (const [label, options] of [
  ['unexpected voice marker on M4A', { unexpectedVoice: true }], ['oversized recording', { oversizeVoice: true }],
  ['wrong downloaded plaintext', { badPlaintext: true }], ['cancel after file verification during sync cleanup', { cancelDuringSyncStop: true }],
]) {
  test(`voice rejects ${label} and does not keep a playback copy`, async () => {
    const f = fixture({ voice: true, ...options });
    try {
      await assert.rejects(f.run(), AudioProbeError);
      assert.deepEqual([...f.files.keys()], [f.recordingUri]);
      if (options.oversizeVoice) assert.equal(f.counters.sent, 0);
    } finally { f.restore(); }
  });
}

for (const [label, options, sends] of [
  ['missing room', { noRoom: true }, 0], ['third participant', { thirdUser: true }, 0],
  ['unencrypted room', { plainRoom: true }, 0], ['untrusted own account', { untrustedUser: own }, 0],
  ['untrusted iPad account', { untrustedUser: peer }, 0], ['changed iPad identity', { changedUser: peer }, 0],
  ['untrusted Tecno device', { untrustedDevice: true }, 0], ['plaintext media source', { plainSource: true }, 1],
  ['wrong audio metadata', { badInfo: true }, 1], ['plaintext outer event', { plainEvent: true }, 1],
  ['different event', { wrongEvent: true }, 1], ['ciphertext checksum mismatch', { badHash: true }, 1],
  ['plaintext pretending to be ciphertext', { plainCipher: true }, 1], ['different decrypted bytes', { badPlaintext: true }, 1],
  ['wrong file size', { badSize: true }, 1], ['upload failure', { joinError: true }, 1],
  ['download failure containing key', { downloadError: true }, 1], ['send queue error', { queueError: true }, 1],
]) {
  test(`fails closed: ${label}`, async () => {
    const f = fixture(options);
    try {
      await assert.rejects(f.run(), (error) => {
        assert.ok(error instanceof AudioProbeError); assert.ok(!error.message.includes(key.toString('base64url'))); return true;
      });
      assert.equal(f.counters.sent, sends); assert.equal(f.files.size, 0);
      if (!options.noRoom) assert.equal(f.counters.stopped, 1);
      if (sends) { assert.equal(f.counters.listenerCancelled, 1); assert.equal(f.counters.queueCancelled, 1); }
    } finally { f.restore(); }
  });
}

for (const [label, options, sends] of [
  ['before enqueueing', { abortStage: 'SDK шифрует и загружает' }, 0],
  ['only local/cached echoes', { noEcho: true, abortStage: 'Ждём аудиосообщение' }, 1],
  ['during native file read', { cancelDuringRead: true }, 1],
  ['native cancel throws', { noEcho: true, cancelThrows: true, abortStage: 'Ждём аудиосообщение' }, 1],
]) {
  test(`cancellation cannot report success: ${label}`, async () => {
    const f = fixture(options);
    try {
      await assert.rejects(f.run(), AudioProbeError);
      assert.equal(f.abort.signal.aborted, true); assert.equal(f.counters.sent, sends);
      assert.equal(f.counters.stopped, 1); assert.equal(f.counters.listenerCancelled, 1); assert.equal(f.files.size, 0);
    } finally { f.restore(); }
  });
}
