import assert from 'node:assert/strict';
import test from 'node:test';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { registerHooks } from 'node:module';
import { AudioProbeError } from '../src/matrix/audio-probe.ts';

// Model tests only. Fixture encryption is independent Node AES-CTR; real Rust
// decryption and OGG playback are left for the iPad -> Tecno device check.
const mockSdk = `
  export const EncryptionState = { Encrypted: 0 };
  export const VerificationState = { Verified: 1 };
  export const EventItemOrigin = { Sync: 1 };
  export const SyncServiceState = { Error: 3, Offline: 4, Terminated: 2 };
  export const MediaSource = { fromUrl(url) { return { raw: true, url: () => url, uniffiDestroy() {} }; } };
`;
const mockCrypto = `
  import { createHash } from 'node:crypto';
  export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' };
  export async function getRandomBytesAsync(n) { return new Uint8Array(n).fill(11); }
  export async function digest(algorithm, bytes) { return new Uint8Array(createHash('sha256').update(bytes).digest()).buffer; }
`;
const mockFiles = String.raw`
  export const Paths = { cache: { uri: 'file:///cache/expo/' } };
  export class File {
    constructor(...parts) { this.uri = parts.map(p => typeof p === 'string' ? p : p.uri).reduce((a, b) => a ? a.replace(/\/$/, '') + '/' + b : b, ''); }
    get exists() { return globalThis.__incomingAudioFiles.has(this.uri); }
    get size() { const f = globalThis.__incomingAudioFiles.get(this.uri); return f.size ?? f.bytes.length; }
    async bytes() { const f = globalThis.__incomingAudioFiles.get(this.uri); f.onRead?.(); return new Uint8Array(f.bytes); }
    create() { if (this.exists) throw new Error('exists'); globalThis.__incomingAudioFiles.set(this.uri, { bytes: new Uint8Array() }); }
    write(bytes) { globalThis.__incomingAudioFiles.set(this.uri, { bytes: new Uint8Array(bytes) }); }
    delete() { globalThis.__incomingAudioFiles.delete(this.uri); }
  }
  export class Directory extends File { create() {} }
`;
registerHooks({ resolve(specifier, context, nextResolve) {
  const mock = { '@unomed/react-native-matrix-sdk': mockSdk, 'expo-crypto': mockCrypto, 'expo-file-system': mockFiles }[specifier];
  if (mock) return { url: 'data:text/javascript,' + encodeURIComponent(mock), shortCircuit: true };
  if (specifier.startsWith('.') && !/\.(ts|tsx|mjs|cjs|js|json)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
} });
const { incomingAudioBoundary, incomingAudioPage, incomingRemoteAudio, incomingAudioInfo,
  incomingAudioErrorText, isIncomingAudioUri, validateIncomingAudioBytes } = await import('../src/matrix/incoming-audio-probe.ts');
const { NativePeerTest } = await import('../src/matrix/peer-test.native.ts');
const { discardIncomingAudio, retainIncomingAudio } = await import('../src/matrix/incoming-audio-files.native.ts');
const { VoicePlaybackCache } = await import('../src/matrix/voice-playback-cache.ts');
const { missedAudioCandidates } = await import('../src/matrix/missed-audio-probe.ts');
const own = '@tecno:example.org', peer = '@ipad:example.org';
const target = { roomId: '!test:example.org', peerUserId: peer };
const key = Buffer.alloc(32, 37), iv = Buffer.alloc(16, 0);
const digest = (bytes) => createHash('sha256').update(bytes).digest('base64').replace(/=+$/, '');
const safeName = `ipad-voice-${'0b'.repeat(16)}.ogg`;
function ogg() {
  const b = Buffer.alloc(4096, 0); b.write('OggS', 0); b[26] = 1; b[27] = 19;
  b.write('OpusHead', 28); b[36] = 1; b[37] = 1;
  return b;
}
function event(audio, patch = {}) {
  return { isRemote: true, origin: 1, sender: peer, timestamp: 1n,
    eventOrTransactionId: { tag: 'EventId', inner: { eventId: '$new' } },
    content: { tag: 'MsgLike', inner: { content: { kind: { tag: 'Message', inner: { content: {
      isEdited: false, msgType: { tag: 'Audio', inner: { content: audio } },
    } } } } } }, ...patch };
}
const raw = (id = '$new', sender = peer) => ({ event_id: id, sender, type: 'm.room.encrypted' });

test('missed pagination crosses pages and orders only events newer than the saved anchor', async () => {
  const paths = [];
  const result = await missedAudioCandidates('$anchor', peer, async path => {
    paths.push(path);
    return paths.length === 1
      ? { chunk: [raw('$latest'), raw('$own', own)], end: 'opaque/+ token' }
      : { start: 'opaque/+ token', chunk: [raw('$first'), raw('$anchor'), raw('$too-old')] };
  }, new AbortController().signal);
  assert.deepEqual(result, ['$first', '$latest']);
  assert.deepEqual(paths, ['messages?dir=b&limit=20', 'messages?dir=b&limit=20&from=opaque%2F%2B%20token']);
});

test('missing anchor, wrong page cursor, duplicate events and invalid responses cannot replay old audio', async () => {
  for (const pages of [
    [{ chunk: [raw()] }], [{ chunk: [raw()], end: 'next' }, { start: 'wrong', chunk: [raw('$anchor')] }],
    [{ chunk: [raw(), raw(), raw('$anchor')] }], [{ chunk: [{ event_id: 'invalid' }] }],
    [{ chunk: [], end: 1 }], [{ chunk: Array(21).fill(raw()) }],
    [{ chunk: [], end: 'same' }, { start: 'same', chunk: [], end: 'same' }],
  ]) {
    let index = 0;
    await assert.rejects(missedAudioCandidates('$anchor', peer, async () => pages[index++], new AbortController().signal), AudioProbeError);
  }
});

test('missed scanning is bounded to five pages and handles empty pages that have a next cursor', async () => {
  let calls = 0;
  await assert.rejects(missedAudioCandidates('$anchor', peer, async () => {
    const index = calls++;
    return { start: String(index), end: String(index + 1), chunk: [] };
  }, new AbortController().signal), /100 событий/);
  assert.equal(calls, 5);
});

test('cancelled missed scanning never issues the next request', async () => {
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(missedAudioCandidates('$anchor', peer, async () => {
    calls++; controller.abort(); return { chunk: [raw('$anchor')] };
  }, controller.signal), AudioProbeError);
  assert.equal(calls, 1);
  await assert.rejects(missedAudioCandidates('$anchor', peer, async () => { calls++; }, controller.signal), AudioProbeError);
  assert.equal(calls, 1);
});

test('freshness uses a supported end cursor, skips boundary event and other accounts, independent of timestamps', () => {
  const boundary = incomingAudioBoundary({ start: 'unsupported-start', end: 'before-latest', chunk: [raw('$old')] });
  assert.deepEqual(boundary, { cursor: 'before-latest', excludedEventId: '$old' });
  assert.deepEqual(incomingAudioPage({ start: boundary.cursor, end: 'next', chunk: [raw('$old'), raw('$own', own), raw()] },
    boundary.cursor, boundary.excludedEventId, peer), { cursor: 'next', eventIds: ['$new'] });
  assert.deepEqual(incomingAudioPage({ start: 'next', chunk: [] }, 'next', '$old', peer), { cursor: 'next', eventIds: [] });
  for (const data of [null, {}, { chunk: [] }, { chunk: [raw('$old')], start: 'only-start' }]) assert.throws(() => incomingAudioBoundary(data), AudioProbeError);
  assert.throws(() => incomingAudioPage({ start: 'wrong', chunk: [] }, 'next', '$old', peer), AudioProbeError);
});

test('only unedited remote audio from the iPad account and native sync qualifies', () => {
  const valid = event({}); assert.equal(incomingRemoteAudio(valid, peer, 1).eventId, '$new');
  const edited = event({}); edited.content.inner.content.kind.inner.content.isEdited = true;
  for (const candidate of [undefined, edited, event({}, { isRemote: false }), event({}, { sender: own }),
    event({}, { origin: 3 }), event({}, { eventOrTransactionId: { tag: 'TransactionId' } }),
    event({}, { content: { tag: 'Redacted' } })]) assert.equal(incomingRemoteAudio(candidate, peer, 1), undefined);
});

test('bounds metadata before download, accepts Element OGG and ordinary M4A, checks container signature', () => {
  const audio = { info: { size: 4096n, duration: 3000, mimetype: 'audio/ogg; codecs=opus' }, voice: {}, audio: { duration: 3000 } };
  assert.equal(incomingAudioInfo(audio).extension, 'ogg');
  assert.equal(incomingAudioInfo({ info: { ...audio.info, mimetype: 'audio/mp4' } }).extension, 'm4a');
  for (const info of [{}, { ...audio.info, size: 3n * 1024n * 1024n }, { ...audio.info, duration: 60_001 },
    { ...audio.info, duration: NaN }, { ...audio.info, mimetype: 'text/html' }]) {
    assert.throws(() => incomingAudioInfo({ info }), AudioProbeError);
  }
  validateIncomingAudioBytes(ogg(), 'ogg');
  const m4a = Buffer.alloc(64); m4a.write('ftyp', 4); validateIncomingAudioBytes(m4a, 'm4a');
  assert.throws(() => validateIncomingAudioBytes(m4a, 'ogg'), AudioProbeError);
  const bad = ogg(); bad.write('notOpus!', 28); assert.throws(() => validateIncomingAudioBytes(bad, 'ogg'), AudioProbeError);
});

test('cleanup is restricted to generated incoming audio paths; errors never expose native descriptors', () => {
  const root = 'file:///cache/expo/', uri = root + 'matrix-incoming-audio/' + safeName;
  assert.equal(isIncomingAudioUri(uri, root), true);
  for (const bad of [root + safeName, uri + '?key=secret', uri + '#x', uri.replace(safeName, '../../saved-session.m4a'),
    uri.replace('matrix-incoming-audio/', 'matrix-incoming-audio/%2e%2e/'), uri.replace('file:///', 'file://remote/')]) {
    assert.equal(isIncomingAudioUri(bad, root), false);
  }
  assert.ok(!incomingAudioErrorText(new Error(key.toString('base64'))).includes(key.toString('base64')));
});

function fixture(options = {}) {
  const abort = new AbortController(), files = new Map(), stages = [], trace = [];
  globalThis.__incomingAudioFiles = files;
  let plaintext = ogg();
  if (options.m4a) { plaintext = Buffer.alloc(4096, 0); plaintext.write('ftyp', 4); }
  if (options.badContainer) plaintext = Buffer.alloc(4096, 12);
  const encoder = createCipheriv('aes-256-ctr', key, iv);
  const ciphertext = Buffer.concat([encoder.update(plaintext), encoder.final()]);
  const descriptor = { file: { url: 'mxc://example.org/incoming', v: 'v2', iv: iv.toString('base64'),
    hashes: { sha256: digest(options.badHash ? Buffer.from('bad') : ciphertext) },
    key: { alg: 'A256CTR', kty: 'oct', ext: true, key_ops: ['encrypt', 'decrypt'], k: key.toString('base64url') } } };
  const inert = { uniffiDestroy() {} };
  const counters = { started: 0, stopped: 0, cancelled: 0, destroyedFiles: 0, downloaded: 0, loadedEvents: 0, forward: 0, boundaries: 0 };
  const source = { ...inert, url: () => descriptor.file.url,
    toJson: () => JSON.stringify(options.plainSource ? { url: descriptor.file.url } : descriptor) };
  const audio = { filename: '../../untrusted-from-ipad.ogg', source, ...(options.m4a ? {} : { voice: {} }),
    info: { size: options.oversize ? 9_000_000n : 4096n, duration: 3000, mimetype: options.m4a ? 'audio/mp4' : 'audio/ogg' } };
  let listener;
  const emit = () => listener.onUpdate([{ tag: 'Set', inner: { value: { asEvent: () => event(audio) } } }]);
  const timeline = { ...inert, async fetchMembers() {}, async addListener(next) {
    listener = next;
    next.onUpdate([{ tag: 'Append', inner: { values: [
      { asEvent: () => event(audio, { eventOrTransactionId: { tag: 'EventId', inner: { eventId: '$old' } } }) },
      { asEvent: () => event(audio, { sender: own }) }, { asEvent: () => event(audio, { origin: 3 }) },
      { asEvent: () => event(audio, { isRemote: false }) },
    ] } }]);
    if (options.earlyNative) emit();
    return { ...inert, cancel() { counters.cancelled++; if (options.listenerCancelError) throw new Error(JSON.stringify(descriptor)); } };
  } };
  const room = { ...inert, async latestEncryptionState() { return 0; }, async timeline() { return timeline; },
    async clearEventCacheStorage() { trace.push('clear-events'); if (options.cancelClear) abort.abort(); },
    async loadOrFetchEvent(id) {
      trace.push('fetch-saved'); counters.loadedEvents++;
      options.onLoadedEvent?.(id, options);
      if (!options.missed && !options.automatic) { assert.equal(id, '$new'); assert.ok(trace.includes('clear-events')); }
      if (options.missingKeys) throw new Error(JSON.stringify(descriptor));
      if (options.cancelEvent) abort.abort();
      return { ...inert, eventId: () => options.otherEvent ? '$other' : id,
        senderId: () => options.otherSender ? (options.ownHistory ? peer : own) : (options.ownHistory ? own : peer),
        content: () => {
          if (options.pendingOnce && counters.loadedEvents === 1) throw new Error('secret-key-material');
          if (options.pendingContent) return { tag: 'MessageLike', inner: { content: { tag: 'RoomEncrypted' } } };
          return options.redacted ? { tag: 'Redacted' } : { tag: 'MessageLike', inner: { content: { tag: 'RoomMessage',
          inner: { messageType: { tag: options.textEvent || options.textIds?.includes(id) ? 'Text' : 'Audio', inner: { content: audio } } } } } };
        },
      };
    },
  };
  const sync = { ...inert, state() { return { ...inert, cancel() {} }; }, async start() { counters.started++; },
    async stop() { counters.stopped++; if (options.cancelDuringStop) abort.abort(); if (options.stopFailure) throw new Error('secret native cleanup'); },
    roomListService() { return { ...inert, async subscribeToRooms() {} }; } };
  const client = { userId: () => own, getRoom: () => options.missingRoom ? undefined : room, session: () => ({ deviceId: options.otherDevice ? 'OTHER' : 'TECNO', homeserverUrl: 'https://example.org', accessToken: 'test-token' }),
    syncService() { trace.push('sync'); return { ...inert, withRoomListTimelineLimit() { return this; }, async finish() { return sync; } }; },
    async awaitRoomRemoteEcho() { return room; },
    encryption() { return { ...inert, async waitForE2eeInitializationTasks() {}, verificationState: () => options.untrustedDevice ? 0 : 1,
      async userIdentity(id) { return { ...inert, isVerified: () => options.untrustedUser !== id, hasVerificationViolation: () => options.changedUser === id }; } }; },
    async getMediaFile(media, name, mime, useCache, tempDir, opts) {
      counters.downloaded++; trace.push(media.raw ? 'cipher' : 'decrypt');
      assert.equal(name, options.m4a ? safeName.replace('.ogg', '.m4a') : safeName); assert.equal(useCache, false); assert.equal(tempDir, '/cache/expo/');
      assert.equal(opts.signal.aborted, false);
      if (options.nativeError) throw new Error(JSON.stringify(descriptor));
      const decoder = createDecipheriv('aes-256-ctr', key, iv);
      const bytes = media.raw ? ciphertext : Buffer.concat([decoder.update(ciphertext), decoder.final()]);
      const path = `/cache/expo/download-${counters.downloaded}.ogg`, uri = 'file://' + path;
      files.set(uri, { bytes, size: options.actualOversize ? 9_000_000 : undefined,
        onRead() { if (options.cancelDuringRead) abort.abort(); } });
      if (options.cancelDuringDownload) abort.abort();
      return { path: () => path, uniffiDestroy() { counters.destroyedFiles++; files.delete(uri); } };
    },
  };
  let ready;
  const waiting = new Promise(resolve => { ready = resolve; });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer test-token');
    let value;
    if (url.endsWith('/joined_members')) value = { joined: { [own]: {}, [peer]: {}, ...(options.thirdUser ? { '@other:example.org': {} } : {}) } };
    else if (url.endsWith('/state/m.room.encryption/')) value = { algorithm: options.plainRoom ? 'plain' : 'm.megolm.v1.aes-sha2' };
    else if (options.automatic && url.includes('messages?dir=b&limit=1')) {
      counters.boundaries++;
      value = { start: 'unused', end: 'before-baseline', chunk: [raw(options.baselineEvent ?? '$baseline')] };
    }
    else if ((options.missed || options.automatic) && url.includes('messages?dir=b')) {
      const page = options.history ?? [raw('$new'), raw('$old')];
      value = { chunk: page };
      if (options.cancelScan) abort.abort();
    }
    else if (url.includes('messages?dir=b')) value = { start: 'unused', end: 'before-old', chunk: [raw('$old')] };
    else if (url.includes('messages?dir=f')) {
      trace.push('forward-page');
      if (options.stalledForward) {
        const mode = options.stalledForward;
        const held = new Promise(resolve => { options.releaseForward = resolve; });
        if (mode === 'request') { ready(); return held; }
        return { ok: true, status: 200, json() { ready(); return held; } };
      }
      if (options.automatic) {
        const cursor = new URL(url).searchParams.get('from');
        counters.forward++;
        value = typeof options.forwardPages === 'function'
          ? options.forwardPages(cursor, counters.forward, init.signal)
          : options.forwardPages?.[counters.forward - 1] ?? { start: cursor, chunk: [] };
        options.onForward?.(counters.forward, abort);
        return { ok: true, json: async () => value };
      }
      assert.ok(url.endsWith('from=before-old'));
      if (options.holdPoll) {
        ready();
        return new Promise((_, reject) => {
          const cancel = () => reject(new Error('Aborted'));
          init.signal.addEventListener('abort', cancel, { once: true });
          if (init.signal.aborted) cancel();
        });
      }
      value = { start: 'before-old', end: 'next', chunk: [raw('$old'), raw('$own', own), raw()] };
      if (!options.earlyNative) setTimeout(emit, 5);
    } else {
      trace.push('raw-event');
      if (!options.missed && !options.automatic) assert.ok(url.endsWith('event/%24new'), 'cached/boundary audio must not be selected');
      value = { ...raw(decodeURIComponent(url.split('/').at(-1))), room_id: target.roomId,
        sender: options.wrongSender ? (options.ownHistory ? peer : own) : (options.ownHistory ? own : peer),
        type: options.plainEvent ? 'm.room.message' : 'm.room.encrypted',
        content: { algorithm: 'm.megolm.v1.aes-sha2', ciphertext: 'opaque', session_id: 'test' } };
    }
    return { ok: true, json: async () => value };
  };
  let savedCheckpoint;
  const savedIds = [];
  const vault = { savePeerAudioCheckpoint(value) { savedCheckpoint = value; savedIds.push(value.eventId); }, async flush() {
    if (options.saveFailure) throw new Error('secret storage failure');
    if (options.cancelSave) abort.abort();
  } };
  const probe = new NativePeerTest(client, true, vault, options.noRoom ? null : target);
  const checkpoint = { roomId: target.roomId, senderUserId: peer, deviceId: 'TECNO', eventId: '$new',
    audioSha256: createHash('sha256').update(plaintext).digest('hex'), byteLength: plaintext.length, durationMs: 3000, createdAt: 1 };
  const readSaved = (patch = {}) => new NativePeerTest(client, true, vault, target, null, { ...checkpoint, ...patch })
    .readAudioAfterRestart(abort.signal, text => stages.push(text));
  const missedProbe = new NativePeerTest(client, true, vault, options.noRoom ? null : target, null,
    options.noAnchor ? null : { ...checkpoint, eventId: '$old' });
  const runMissed = () => missedProbe.receiveMissedAudio(abort.signal, text => {
    stages.push(text); if (options.cancelKeys && text.includes('Ждём ключи')) abort.abort();
  });
  const automaticReceived = [];
  const runAutomatic = (controller = abort) => missedProbe.watchAudio(controller.signal, text => stages.push(text), () => {
    automaticReceived.push(missedProbe.audioRestartProbe.eventId);
    options.onAutomaticReceived?.(automaticReceived, controller);
  });
  const run = () => probe.receiveAudio(abort.signal, text => { stages.push(text); });
  const newest = { ...checkpoint, eventId: '$newest', createdAt: 2 };
  const playbackCache = options.playbackCache ?? { async get() { return null; }, async save() {} };
  const historyProbe = new NativePeerTest(client, true, vault, target, null, newest,
    [newest, { ...checkpoint, ...options.historyPatch }], [], playbackCache);
  const readHistory = (id = '$new') => historyProbe.readAudio(id, abort.signal, text => stages.push(text));
  const readOwn = (patch = {}, id = '$new') => new NativePeerTest(client, true, vault, target, null, null, [],
    [{ ...checkpoint, senderUserId: own, ...patch }], playbackCache).readAudio(id, abort.signal, text => stages.push(text));
  const readCachedOwn = (patch = {}, id = '$new') => new NativePeerTest(client, true, vault, target, null, null, [],
    [{ ...checkpoint, senderUserId: own, ...patch }], playbackCache).readCachedAudio(id, abort.signal, text => stages.push(text));
  return { run, runMissed, runAutomatic, automaticReceived, savedIds, missedProbe, readSaved, readHistory, readOwn, readCachedOwn, historyProbe, checkpoint, probe, saved: () => savedCheckpoint, abort, waiting, files, stages, trace, counters, plaintext,
    restore() { globalThis.fetch = originalFetch; delete globalThis.__incomingAudioFiles; } };
}

test('restored own M4A history fetches the exact encrypted event without sync or sending; original bytes are playable', async () => {
  const f = fixture({ ownHistory: true, m4a: true });
  try {
    const result = await f.readOwn();
    assert.equal(result.peerUserId, peer); assert.equal(result.eventId, '$new');
    assert.deepEqual(Buffer.from(f.files.get(result.playbackUri).bytes), f.plaintext);
    assert.equal(f.counters.started, 0); assert.equal(f.counters.downloaded, 2); assert.equal(f.counters.destroyedFiles, 2);
    assert.equal(f.stages.some(stage => stage.includes('твою отправленную')), true);
    assert.deepEqual(f.savedIds, []);
  } finally { f.restore(); }
});

// Use the real encrypted cache core around NativePeerTest. Node GCM is an
// independent model of the native storage ports, not Expo AES on a phone.
function playbackCacheFixture() {
  const secrets = Array(10).fill(null), encrypted = new Map(); let serial = 100;
  const ports = {
    async readSecret(slot) { return secrets[slot]; },
    async writeSecret(slot, text) { secrets[slot] = text; },
    async eraseSecret(slot) { secrets[slot] = null; },
    async randomId() { return (++serial).toString(16).padStart(32, '0'); },
    async newKey() { return randomBytes(32).toString('hex'); },
    async readPlayback(uri) { return { bytes: globalThis.__incomingAudioFiles.get(uri).bytes, extension: uri.endsWith('.ogg') ? 'ogg' : 'm4a' }; },
    async digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); },
    async encrypt(bytes, key, aad) {
      const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), nonce);
      cipher.setAAD(Buffer.from(aad));
      return new Uint8Array(Buffer.concat([nonce, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]));
    },
    async decrypt(bytes, key, aad) {
      const sealed = Buffer.from(bytes), decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), sealed.subarray(0, 12));
      decipher.setAAD(Buffer.from(aad)); decipher.setAuthTag(sealed.subarray(-16));
      return new Uint8Array(Buffer.concat([decipher.update(sealed.subarray(12, -16)), decipher.final()]));
    },
    async writeCipher(id, bytes) { encrypted.set(id, bytes); },
    async readCipher(id, size) { const bytes = encrypted.get(id); if (!bytes || bytes.length !== size) throw Error('missing'); return bytes; },
    async cleanCiphers(keep) { for (const id of encrypted.keys()) if (!keep.includes(id)) encrypted.delete(id); },
    async writePreview(bytes, extension) { return retainIncomingAudio(bytes, `ipad-voice-${(++serial).toString(16).padStart(32, '0')}.${extension}`, extension); },
    discardPreview: discardIncomingAudio,
  };
  return { cache: new VoicePlaybackCache(ports), ports, secrets, encrypted };
}

for (const [label, m4a, ownHistory] of [['own M4A', true, true], ['iPad OGG', false, false]]) {
  test(`${label}: first server read caches verified bytes; restored cache opens with network and SDK fetch unavailable`, async () => {
    const cached = playbackCacheFixture(), first = fixture({ m4a, ownHistory, playbackCache: cached.cache });
    try {
      const result = await (ownHistory ? first.readOwn() : first.readHistory());
      assert.equal(result.playbackSource, 'server'); assert.equal(result.offlineCopy, 'saved');
      assert.equal(first.counters.downloaded, 2); assert.equal(cached.encrypted.size, 1);
      discardIncomingAudio(result.playbackUri);
    } finally { first.restore(); }
    const restored = fixture({ m4a, ownHistory, playbackCache: new VoicePlaybackCache(cached.ports), missingRoom: true, nativeError: true });
    const fetchBefore = globalThis.fetch;
    globalThis.fetch = async () => { throw Error('offline'); };
    try {
      const result = await (ownHistory ? restored.readCachedOwn() : restored.historyProbe.readCachedAudio('$new', restored.abort.signal, () => {}));
      assert.equal(result.playbackSource, 'tecno'); assert.equal(result.offlineCopy, 'saved');
      assert.deepEqual(Buffer.from(restored.files.get(result.playbackUri).bytes), restored.plaintext);
      assert.equal(restored.counters.loadedEvents, 0); assert.equal(restored.counters.downloaded, 0);
      assert.equal(restored.counters.started, 0); assert.deepEqual(restored.savedIds, []);
      discardIncomingAudio(result.playbackUri);
    } finally { globalThis.fetch = fetchBefore; restored.restore(); }
  });
}

test('cache write failure keeps verified server playback and reports that offline copy was not saved', async () => {
  const f = fixture({ ownHistory: true, m4a: true, playbackCache: { async get() { return null; }, async save() { throw Error('secret native key'); } } });
  try {
    const result = await f.readOwn();
    assert.equal(result.offlineCopy, 'unavailable'); assert.equal(result.playbackSource, 'server');
    assert.deepEqual(Buffer.from(f.files.get(result.playbackUri).bytes), f.plaintext);
    assert.ok(!JSON.stringify(result).includes('secret native key'));
  } finally { f.restore(); }
});

test('failed native sender verification cannot place a server audio into the offline cache', async () => {
  const cached = playbackCacheFixture(), f = fixture({ ownHistory: true, m4a: true, otherSender: true, playbackCache: cached.cache });
  try { await assert.rejects(f.readOwn(), AudioProbeError); assert.equal(cached.encrypted.size, 0); assert.ok(cached.secrets.every(value => value === null)); }
  finally { f.restore(); }
});

test('cancel during offline persistence discards the verified player file without repeating upload', async () => {
  let f;
  f = fixture({ ownHistory: true, m4a: true, playbackCache: { async get() { return null; }, async save() { f.abort.abort(); } } });
  try {
    await assert.rejects(f.readOwn(), /отменено/);
    assert.equal(f.files.size, 0); assert.equal(f.counters.started, 0); assert.deepEqual(f.savedIds, []);
  } finally { f.restore(); }
});

test('offline cache shortcut rejects another device and an unlisted event before storage access', async () => {
  let gets = 0;
  const f = fixture({ ownHistory: true, m4a: true, playbackCache: { async get() { gets++; return null; }, async save() {} } });
  try {
    await assert.rejects(f.readCachedOwn({ deviceId: 'OTHER' }), AudioProbeError);
    await assert.rejects(f.readCachedOwn({}, '$unlisted'), AudioProbeError);
    assert.equal(gets, 0); assert.equal(f.counters.loadedEvents, 0); assert.equal(f.counters.downloaded, 0);
  } finally { f.restore(); }
});

for (const [label, options, patch, id] of [
  ['different native sender', { otherSender: true }, {}], ['different server sender', { wrongSender: true }, {}],
  ['plaintext server event', { plainEvent: true }, {}], ['changed recorded digest', {}, { audioSha256: 'd'.repeat(64) }],
  ['foreign device', {}, { deviceId: 'OTHER' }], ['foreign room', {}, { roomId: '!other' }],
  ['foreign account', {}, { senderUserId: peer }], ['event outside saved history', {}, {}, '$not-listed'],
]) test(`own history rejects ${label} without a retained playback file or automatic send`, async () => {
  const f = fixture({ ownHistory: true, m4a: true, ...options });
  try {
    await assert.rejects(f.readOwn(patch, id), AudioProbeError);
    assert.equal(f.files.size, 0); assert.equal(f.counters.started, 0); assert.deepEqual(f.savedIds, []);
  } finally { f.restore(); }
});

test('automatic reception catches up and receives subsequent pages in one sync, without duplicates or retained plaintext', async () => {
  const f = fixture({ automatic: true, baselineEvent: '$catchup', history: [raw('$catchup'), raw('$text'), raw('$old')], textIds: ['$text'],
    forwardPages: [
      { start: 'before-baseline', end: 'page2', chunk: [raw('$catchup'), raw('$text'), raw('$live'), raw('$own', own)] },
      { start: 'page2', end: 'page3', chunk: [raw('$live'), raw('$next')] },
    ], onAutomaticReceived(ids, abort) { if (ids.length === 3) abort.abort(); } });
  try {
    await assert.rejects(f.runAutomatic(), AudioProbeError);
    assert.deepEqual(f.automaticReceived, ['$catchup', '$live', '$next']);
    assert.deepEqual(f.savedIds, f.automaticReceived);
    assert.deepEqual(f.missedProbe.audioRecords.map(item => item.eventId), ['$next', '$live', '$catchup', '$old']);
    assert.equal(f.counters.started, 1); assert.equal(f.counters.stopped, 1);
    assert.equal(f.counters.downloaded, 6); assert.equal(f.files.size, 0);
    assert.equal(f.trace.includes('clear-events'), false);
  } finally { f.restore(); }
});

test('event arriving during catch-up is included by the earlier forward boundary', async () => {
  const f = fixture({ automatic: true, baselineEvent: '$old', history: [raw('$old')],
    forwardPages: [{ start: 'before-baseline', end: 'next', chunk: [raw('$old'), raw('$arrived-during-catchup')] }],
    onAutomaticReceived(ids, abort) { abort.abort(); } });
  try {
    await assert.rejects(f.runAutomatic(), AudioProbeError);
    assert.deepEqual(f.automaticReceived, ['$arrived-during-catchup']);
    assert.equal(f.counters.started, 1); assert.equal(f.files.size, 0);
  } finally { f.restore(); }
});

test('automatic initial reception starts without a saved audio and ignores the baseline event', async () => {
  const f = fixture({ automatic: true, noAnchor: true, baselineEvent: '$old',
    forwardPages: [{ start: 'before-baseline', end: 'next', chunk: [raw('$old'), raw('$new')] }],
    onAutomaticReceived(ids, abort) { abort.abort(); } });
  try {
    await assert.rejects(f.runAutomatic(), AudioProbeError);
    assert.deepEqual(f.automaticReceived, ['$new']); assert.equal(f.saved().eventId, '$new');
    assert.equal(f.files.size, 0);
  } finally { f.restore(); }
});

test('pause before the first voice keeps the live cursor for reception after returning to the screen', async () => {
  const f = fixture({ automatic: true, noAnchor: true, baselineEvent: '$old',
    forwardPages(cursor, number) {
      return number === 1 ? { start: cursor, end: 'after-old', chunk: [raw('$old')] }
        : { start: cursor, end: 'next', chunk: [raw('$sent-while-paused')] };
    }, onForward(number, abort) { if (number === 1) abort.abort(); },
    onAutomaticReceived(ids, abort) { abort.abort(); } });
  try {
    await assert.rejects(f.runAutomatic(), AudioProbeError);
    assert.equal(f.missedProbe.audioRestartProbe, null);
    await assert.rejects(f.runAutomatic(new AbortController()), AudioProbeError);
    assert.deepEqual(f.automaticReceived, ['$sent-while-paused']);
    assert.equal(f.counters.boundaries, 1); assert.equal(f.counters.stopped, 2);
    assert.equal(f.files.size, 0);
  } finally { f.restore(); }
});

test('automatic cancellation after a stored voice resumes from the checkpoint and skips its replay', async () => {
  const f = fixture({ automatic: true, baselineEvent: '$new', history: [raw('$new'), raw('$old')],
    forwardPages: [{ start: 'before-baseline', end: 'next', chunk: [raw('$new'), raw('$next')] }],
    onAutomaticReceived(ids, abort) { abort.abort(); } });
  try {
    await assert.rejects(f.runAutomatic(), AudioProbeError);
    assert.deepEqual(f.automaticReceived, ['$new']);
    await assert.rejects(f.runAutomatic(new AbortController()), AudioProbeError);
    assert.deepEqual(f.automaticReceived, ['$new', '$next']);
    assert.deepEqual(f.savedIds, ['$new', '$next']); assert.equal(f.files.size, 0);
  } finally { f.restore(); }
});

test('automatic reception publishes no entry on failed persistence and preserves the previous anchor', async () => {
  const f = fixture({ automatic: true, saveFailure: true, history: [raw('$new'), raw('$old')] });
  try {
    await assert.rejects(f.runAutomatic(), /Не удалось запомнить/);
    assert.deepEqual(f.automaticReceived, []); assert.equal(f.missedProbe.audioRestartProbe.eventId, '$old');
    assert.deepEqual(f.missedProbe.audioRecords.map(item => item.eventId), ['$old']);
    assert.equal(f.files.size, 0); assert.equal(f.counters.stopped, 1);
  } finally { f.restore(); }
});

test('automatic reception aborts idle waiting without a late download or a saved entry', async () => {
  const f = fixture({ automatic: true, history: [raw('$old')], onForward(number, abort) { abort.abort(); } });
  try {
    await assert.rejects(f.runAutomatic(), AudioProbeError);
    assert.deepEqual(f.automaticReceived, []); assert.equal(f.counters.downloaded, 0);
    assert.equal(f.counters.stopped, 1); assert.equal(f.files.size, 0);
  } finally { f.restore(); }
});

for (const phase of ['request', 'body']) test(`stalled forward ${phase} cannot keep the SDK locked after pausing automatic reception`, async () => {
  const { AutomaticVoiceReceiver } = await import('../src/matrix/automatic-voice-receiver.ts');
  const options = { automatic: true, stalledForward: phase, history: [raw('$old')] };
  const f = fixture(options);
  const receiver = new AutomaticVoiceReceiver({ receive: signal => f.runAutomatic({ signal }),
    starting() {}, failed(error) { assert.fail(String(error)); } });
  try {
    receiver.setEnabled(true);
    await f.waiting;
    await receiver.pause();
    assert.equal(f.counters.started, 1); assert.equal(f.counters.stopped, 1);
    assert.equal(f.counters.downloaded, 0);
    // The next foreground operation uses the same client, after real stop.
    assert.equal(await f.runMissed(), null);
    assert.equal(f.counters.started, 2); assert.equal(f.counters.stopped, 2);
    const downloaded = f.counters.downloaded;
    options.releaseForward(phase === 'request' ? { ok: true, status: 200, json: async () => ({ chunk: [raw('$late')] }) } : { chunk: [raw('$late')] });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.counters.downloaded, downloaded);
    assert.deepEqual(f.automaticReceived, []);
  } finally { await receiver.pause(); f.restore(); }
});

test('automatic receiver surfaces unconfirmed sync cleanup even during cancellation', async () => {
  const f = fixture({ automatic: true, stopFailure: true, history: [raw('$old')], onForward(number, abort) { abort.abort(); } });
  try {
    const { ReceiverCleanupError } = await import('../src/matrix/automatic-voice-receiver.ts');
    await assert.rejects(f.runAutomatic(), ReceiverCleanupError);
    assert.equal(f.counters.stopped, 1); assert.equal(f.files.size, 0);
  } finally { f.restore(); }
});

for (const change of ['identity', 'members']) test(`continuous reception rechecks ${change} before every audio download`, async () => {
  const f = fixture({ automatic: true, baselineEvent: '$old', history: [raw('$old')],
    forwardPages: [{ start: 'before-baseline', end: 'next', chunk: [raw('$first'), raw('$second')] }],
    onLoadedEvent(id, options) {
      if (id === '$second') {
        if (change === 'identity') options.changedUser = peer;
        else options.thirdUser = true;
      }
    } });
  try {
    await assert.rejects(f.runAutomatic(), AudioProbeError);
    assert.deepEqual(f.automaticReceived, ['$first']);
    assert.equal(f.counters.downloaded, 2); assert.equal(f.saved().eventId, '$first');
    assert.equal(f.counters.stopped, 1); assert.equal(f.files.size, 0);
  } finally { f.restore(); }
});

for (const earlyNative of [true, false]) test(`receives fresh OGG via native SDK (${earlyNative ? 'native first' : 'server first'}), proves ciphertext and retains playable copy`, async () => {
  const f = fixture({ earlyNative });
  try {
    const result = await f.run();
    assert.equal(f.saved().audioSha256, result.audioSha256);
    assert.equal(f.probe.audioRestartProbe.requiresRestart, true);
    assert.equal(result.eventId, '$new'); assert.equal(result.peerUserId, peer);
    assert.equal(result.filename, safeName); assert.equal(result.encryption.eventType, 'm.room.encrypted');
    assert.deepEqual(Buffer.from(f.files.get(result.playbackUri).bytes), f.plaintext);
    assert.deepEqual(f.trace.filter(x => x === 'cipher' || x === 'decrypt'), ['cipher', 'decrypt']);
    assert.equal(f.counters.destroyedFiles, 2); assert.equal(f.counters.cancelled, 1); assert.equal(f.counters.stopped, 1);
    assert.equal(f.files.size, 1); assert.ok(!JSON.stringify([result, f.stages]).includes(key.toString('base64url')));
    discardIncomingAudio(result.playbackUri); assert.equal(f.files.size, 0);
  } finally { f.restore(); }
});

test('selects an older history record with native decryption and checksum, without sync or moving the missed-message anchor', async () => {
  const f = fixture();
  try {
    const records = f.historyProbe.audioRecords;
    const result = await f.readHistory(); assert.equal(result.eventId, '$new');
    assert.deepEqual(Buffer.from(f.files.get(result.playbackUri).bytes), f.plaintext);
    assert.deepEqual(f.historyProbe.audioRecords, records);
    assert.equal(f.historyProbe.audioRestartProbe.eventId, '$newest');
    assert.equal(f.saved(), undefined); assert.ok(!f.trace.includes('sync'));
    discardIncomingAudio(result.playbackUri);
    records[0].eventId = '$mutated'; assert.equal(f.historyProbe.audioRecords[0].eventId, '$newest');
  } finally { f.restore(); }
});

test('history rejects an unlisted event before native access, and a tampered digest never reaches playback', async () => {
  const f = fixture({ historyPatch: { audioSha256: 'f'.repeat(64) } });
  try {
    await assert.rejects(f.readHistory('$unlisted'), /больше нет/);
    assert.equal(f.counters.loadedEvents, 0); assert.equal(f.counters.downloaded, 0);
    await assert.rejects(f.readHistory(), /контрольной суммой/);
    assert.equal(f.files.size, 0); assert.equal(f.historyProbe.audioRestartProbe.eventId, '$newest');
  } finally { f.restore(); }
});

test('a received record can be opened in the same client, but failed storage publishes no history entry', async () => {
  const f = fixture({ earlyNative: true });
  try {
    const received = await f.run(); discardIncomingAudio(received.playbackUri);
    assert.equal(f.probe.audioRecords.length, 1);
    const syncs = f.trace.filter(item => item === 'sync').length;
    const reopened = await f.probe.readAudio('$new', f.abort.signal, () => {});
    assert.equal(reopened.eventId, '$new'); discardIncomingAudio(reopened.playbackUri);
    assert.equal(f.trace.filter(item => item === 'sync').length, syncs);
  } finally { f.restore(); }
  const failed = fixture({ earlyNative: true, saveFailure: true });
  try {
    await assert.rejects(failed.run(), AudioProbeError);
    assert.deepEqual(failed.probe.audioRecords, []);
  } finally { failed.restore(); }
});

for (const [label, options, downloads] of [
  ['unprepared room', { noRoom: true }, 0], ['third member', { thirdUser: true }, 0],
  ['plaintext room', { plainRoom: true }, 0], ['untrusted Tecno', { untrustedDevice: true }, 0],
  ['untrusted iPad', { untrustedUser: peer }, 0], ['changed iPad identity', { changedUser: peer }, 0],
  ['oversized metadata', { oversize: true }, 0], ['plaintext event', { plainEvent: true }, 0],
  ['wrong event sender', { wrongSender: true }, 0], ['plaintext attachment', { plainSource: true }, 0],
  ['bad ciphertext checksum', { badHash: true }, 1], ['actual file too large', { actualOversize: true }, 1],
  ['bad container', { badContainer: true }, 2], ['native error with secret', { nativeError: true }, 1],
  ['abort during download', { cancelDuringDownload: true }, 1], ['abort while reading', { cancelDuringRead: true }, 1],
  ['abort during sync cleanup', { cancelDuringStop: true }, 2],
  ['listener cleanup failure', { listenerCancelError: true }, 2],
]) test(`rejects ${label} and cleans up without exposing media keys`, async () => {
  const f = fixture({ earlyNative: true, ...options });
  try {
    await assert.rejects(f.run(), error => error instanceof AudioProbeError && !error.message.includes(key.toString('base64url')));
    assert.equal(f.counters.downloaded, downloads); assert.equal(f.files.size, 0);
    if (!options.noRoom) assert.equal(f.counters.stopped, 1);
  } finally { f.restore(); }
});

test('cancel while waiting aborts the pending request, listener and sync without a late result', async () => {
  const f = fixture({ holdPoll: true });
  try {
    const work = f.run(); await f.waiting; f.abort.abort();
    await assert.rejects(work, AudioProbeError);
    assert.equal(f.counters.downloaded, 0); assert.equal(f.counters.cancelled, 1); assert.equal(f.counters.stopped, 1);
    assert.equal(f.files.size, 0);
  } finally { f.restore(); }
});


test('reopens the exact saved audio without sync, clears event cache and compares decrypted bytes', async () => {
  const f = fixture();
  try {
    const result = await f.readSaved();
    assert.equal(result.audioSha256, f.checkpoint.audioSha256);
    assert.equal(result.eventId, f.checkpoint.eventId);
    assert.deepEqual(Buffer.from(f.files.get(result.playbackUri).bytes), f.plaintext);
    assert.deepEqual(f.trace, ['clear-events', 'fetch-saved', 'raw-event', 'cipher', 'decrypt']);
    assert.equal(f.saved(), undefined); // Never replaces the original checkpoint.
    discardIncomingAudio(result.playbackUri);
    assert.equal(f.files.size, 0);
  } finally { f.restore(); }
});

for (const [label, options, patch] of [
  ['different device', { otherDevice: true }], ['missing room', { missingRoom: true }],
  ['different event', { otherEvent: true }], ['different sender', { otherSender: true }],
  ['redaction', { redacted: true }], ['non-audio', { textEvent: true }], ['missing keys', { missingKeys: true }],
  ['changed room', {}, { roomId: '!other' }], ['changed peer', {}, { senderUserId: own }],
  ['changed digest', {}, { audioSha256: 'a'.repeat(64) }], ['changed size', {}, { byteLength: 33 }],
  ['changed duration', {}, { durationMs: 1000 }], ['save failure', { saveFailure: true }],
  ['cancel cache clear', { cancelClear: true }], ['cancel fetch', { cancelEvent: true }],
  ['cancel download', { cancelDuringDownload: true }], ['cancel flush', { cancelSave: true }],
]) test(`saved audio fails safely on ${label}`, async () => {
  const f = fixture(options);
  try {
    await assert.rejects(f.readSaved(patch), error => error instanceof AudioProbeError && !error.message.includes(key.toString('base64url')));
    assert.equal(f.files.size, 0); assert.equal(f.saved(), undefined);
    assert.ok(!f.trace.includes('sync'));
  } finally { f.restore(); }
});

test('does not publish a successful reception when checkpoint storage fails', async () => {
  const f = fixture({ earlyNative: true, saveFailure: true });
  try {
    await assert.rejects(f.run(), /Не удалось запомнить/);
    assert.equal(f.files.size, 0); assert.equal(f.probe.audioRestartProbe, null);
  } finally { f.restore(); }
});

test('requires a previous client before reopening saved audio', async () => {
  const f = fixture({ earlyNative: true });
  try {
    await assert.rejects(f.probe.readAudioAfterRestart(f.abort.signal, () => {}), /Сначала получи/);
    const result = await f.run(); discardIncomingAudio(result.playbackUri);
    await assert.rejects(f.probe.readAudioAfterRestart(f.abort.signal, () => {}), /Полностью останови/);
  } finally { f.restore(); }
});


test('receives a voice sent before startup, persists its checkpoint, and next search does not replay it', async () => {
  const f = fixture({ missed: true });
  try {
    const result = await f.runMissed();
    assert.equal(result.eventId, '$new'); assert.equal(f.saved().eventId, '$new');
    assert.equal(f.files.size, 1); assert.ok(f.trace.includes('sync'));
    assert.ok(!f.trace.includes('clear-events'));
    assert.deepEqual(Buffer.from(f.files.get(result.playbackUri).bytes), f.plaintext);
    discardIncomingAudio(result.playbackUri);
    assert.equal(await f.runMissed(), null);
    assert.equal(f.counters.downloaded, 2); assert.equal(f.files.size, 0);
  } finally { f.restore(); }
});

test('delivers missed voices oldest first, skips text and other accounts, then advances one checkpoint at a time', async () => {
  const f = fixture({ missed: true, history: [raw('$new'), raw('$text'), raw('$own', own), raw('$first'), raw('$old')], textIds: ['$text'] });
  try {
    const first = await f.runMissed(); assert.equal(first.eventId, '$first'); discardIncomingAudio(first.playbackUri);
    const next = await f.runMissed(); assert.equal(next.eventId, '$new'); discardIncomingAudio(next.playbackUri);
    assert.equal(await f.runMissed(), null);
    assert.equal(f.counters.downloaded, 4);
  } finally { f.restore(); }
});

test('waits for delayed native decryption without changing the anchor prematurely', async () => {
  const f = fixture({ missed: true, pendingOnce: true });
  try {
    const result = await f.runMissed(); assert.equal(result.eventId, '$new');
    assert.equal(f.counters.loadedEvents, 2); discardIncomingAudio(result.playbackUri);
    assert.ok(f.stages.some(x => x.includes('Ждём ключи')));
  } finally { f.restore(); }
});

test('no newer audio is a normal empty result and preserves the old anchor', async () => {
  const f = fixture({ missed: true, history: [raw('$text'), raw('$old')], textIds: ['$text'] });
  try {
    assert.equal(await f.runMissed(), null); assert.equal(f.saved(), undefined);
    assert.equal(f.missedProbe.audioRestartProbe.eventId, '$old'); assert.equal(f.counters.downloaded, 0);
  } finally { f.restore(); }
});

for (const [label, options] of [
  ['missing anchor', { noAnchor: true }], ['anchor not found', { history: [raw('$new')] }],
  ['third member', { thirdUser: true }], ['untrusted Tecno', { untrustedDevice: true }],
  ['untrusted peer', { untrustedUser: peer }], ['plain room', { plainRoom: true }],
  ['changed device', { otherDevice: true }], ['wrong native sender', { otherSender: true }],
  ['wrong native event', { otherEvent: true }], ['plain wire event', { plainEvent: true }],
  ['wrong wire sender', { wrongSender: true }], ['bad checksum', { badHash: true }],
  ['cancel scanning', { cancelScan: true }], ['cancel key wait', { pendingContent: true, cancelKeys: true }],
  ['cancel sync cleanup', { cancelDuringStop: true }], ['storage failure', { saveFailure: true }],
]) test(`missed voice rejects ${label}, cleans files and keeps the previous checkpoint`, async () => {
  const f = fixture({ missed: true, ...options });
  try {
    await assert.rejects(f.runMissed(), error => error instanceof AudioProbeError && !error.message.includes(key.toString('base64url')));
    assert.equal(f.files.size, 0);
    assert.equal(f.missedProbe.audioRestartProbe?.eventId, options.noAnchor ? undefined : '$old');
  } finally { f.restore(); }
});
