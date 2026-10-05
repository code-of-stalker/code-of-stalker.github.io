import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
const filesMock = String.raw`
  export const Paths = { document: { uri: 'file:///document/expo/' }, cache: { uri: 'file:///cache/expo/' } };
  export class File {
    constructor(...parts) { this.uri = parts.map(p => typeof p === 'string' ? p : p.uri).reduce((a, b) => a ? a.replace(/\/$/, '') + '/' + b : b, ''); }
    get name() { return this.uri.split('/').at(-1); }
    get exists() { return globalThis.__playbackFiles.has(this.uri); }
    get size() { return globalThis.__playbackFiles.get(this.uri).length; }
    async bytes() { return new Uint8Array(globalThis.__playbackFiles.get(this.uri)); }
    create() { if (this.exists) throw Error('exists'); globalThis.__playbackFiles.set(this.uri, new Uint8Array()); }
    write(bytes) { globalThis.__playbackFiles.set(this.uri, new Uint8Array(bytes)); }
    delete() { globalThis.__playbackFiles.delete(this.uri); }
  }
  export class Directory extends File {
    get exists() { return globalThis.__playbackDirectories.has(this.uri); }
    create() { globalThis.__playbackDirectories.add(this.uri); }
    list() { return [...globalThis.__playbackFiles.keys()].filter(uri => uri.startsWith(this.uri + '/') && !uri.slice(this.uri.length + 1).includes('/')).map(uri => new File(uri)); }
  }
`;
const secureMock = `
  export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 8;
  export async function isAvailableAsync() { return !globalThis.__playbackUnavailable; }
  export async function getItemAsync(name) { return globalThis.__playbackSecrets.get(name) ?? null; }
  export async function setItemAsync(name, text, options) {
    if (options.keychainAccessible !== 8 || !/^matrix\\.voice-playback\\.v1\\.[0-9]$/.test(name)) throw Error('unexpected protected key options');
    if (globalThis.__playbackWriteFailure) throw Error('native secret-key-material');
    globalThis.__playbackSecrets.set(name, text);
  }
  export async function deleteItemAsync(name) { globalThis.__playbackSecrets.delete(name); }
`;
const cryptoMock = `
  import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
  export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' };
  export async function getRandomBytesAsync(count) { return new Uint8Array(randomBytes(count)); }
  export async function digest(algorithm, bytes) {
    if (algorithm !== 'SHA-256') throw Error('unexpected hash');
    return new Uint8Array(createHash('sha256').update(bytes).digest()).buffer;
  }
  function key(bytes) { return { bytes, async encoded(encoding) { return bytes.toString(encoding); } }; }
  export const AESEncryptionKey = {
    async generate() { return key(randomBytes(32)); },
    async import(value, encoding) { const bytes = Buffer.from(value, encoding); if (bytes.length !== 32) throw Error('key size'); return key(bytes); }
  };
  export async function aesEncryptAsync(bytes, key, options) {
    if (options.nonce.length !== 12 || options.tagLength !== 16 || !(options.additionalData instanceof Uint8Array)) throw Error('unexpected GCM parameters');
    const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key.bytes, nonce); cipher.setAAD(Buffer.from(options.additionalData));
    const combined = new Uint8Array(Buffer.concat([nonce, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]));
    return { async combined() { return combined; } };
  }
  export const AESSealedData = { fromCombined(bytes, options) {
    if (options.ivLength !== 12 || options.tagLength !== 16) throw Error('unexpected GCM layout'); return bytes;
  } };
  export async function aesDecryptAsync(bytes, key, options) {
    if (options.output !== 'bytes' || !(options.additionalData instanceof Uint8Array)) throw Error('unexpected output');
    const sealed = Buffer.from(bytes), decipher = createDecipheriv('aes-256-gcm', key.bytes, sealed.subarray(0, 12));
    decipher.setAAD(Buffer.from(options.additionalData)); decipher.setAuthTag(sealed.subarray(-16));
    return new Uint8Array(Buffer.concat([decipher.update(sealed.subarray(12, -16)), decipher.final()]));
  }
`;
registerHooks({ resolve(specifier, context, next) {
  const mock = { 'expo-file-system': filesMock, 'expo-secure-store': secureMock, 'expo-crypto': cryptoMock }[specifier];
  if (mock) return { url: 'data:text/javascript,' + encodeURIComponent(mock), shortCircuit: true };
  if (specifier.startsWith('.') && !/\.(ts|tsx|mjs|js|json)$/.test(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { voicePlaybackStorage, eraseVoicePlaybackCache } = await import('../src/matrix/voice-playback-storage.native.ts');
const { cleanIncomingAudioPreviews, discardIncomingAudio } = await import('../src/matrix/incoming-audio-files.native.ts');
const context = { userId: '@tecno:example.org', peerUserId: '@ipad:example.org', roomId: '!room:example.org',
  deviceId: 'TECNO', serverUrl: 'https://example.org' };
const proof = { eventType: 'm.room.encrypted', algorithm: 'm.megolm.v1.aes-sha2', ciphertextLength: 128 };
const playerFolder = 'file:///cache/expo/matrix-incoming-audio';
const protectedFolder = 'file:///document/expo/matrix-voice-playback';
function fixture() {
  globalThis.__playbackFiles = new Map(); globalThis.__playbackDirectories = new Set([playerFolder]);
  globalThis.__playbackSecrets = new Map(); globalThis.__playbackWriteFailure = false; globalThis.__playbackUnavailable = false;
  const bytes = Buffer.alloc(4096, 17); bytes.write('ftyp', 4);
  const uri = `${playerFolder}/ipad-voice-${'ab'.repeat(16)}.m4a`;
  globalThis.__playbackFiles.set(uri, bytes);
  const checkpoint = { roomId: context.roomId, deviceId: context.deviceId, senderUserId: context.userId, eventId: '$own',
    audioSha256: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length, durationMs: 3000, createdAt: 1 };
  const signal = () => new AbortController().signal;
  return { bytes, uri, checkpoint, signal, files: globalThis.__playbackFiles, secrets: globalThis.__playbackSecrets,
    save: (selected = uri) => voicePlaybackStorage.save(context, checkpoint, proof, selected, ['$own'], signal()),
    get: () => voicePlaybackStorage.get(context, checkpoint, signal()) };
}

test('native adapter uses protected key slots and document ciphertext, then creates an owned temporary player file', async () => {
  const f = fixture(); await f.save();
  assert.equal(f.secrets.size, 1);
  const record = JSON.parse([...f.secrets.values()][0]);
  assert.equal(record.key.length, 64); assert.equal(record.extension, 'm4a');
  const cipherPath = `${protectedFolder}/voice-${record.id}.bin`;
  assert.equal(f.files.get(cipherPath).length, f.bytes.length + 28);
  assert.notDeepEqual(Buffer.from(f.files.get(cipherPath)), f.bytes);
  f.files.delete(f.uri);
  const result = await f.get(); assert.equal(result.playbackSource, 'tecno');
  assert.ok(result.playbackUri.startsWith(playerFolder + '/ipad-voice-'));
  assert.deepEqual(Buffer.from(f.files.get(result.playbackUri)), f.bytes);
  discardIncomingAudio(result.playbackUri); assert.ok(!f.files.has(result.playbackUri));
});

test('native adapter rejects unowned, traversing, absent and oversized player files', async () => {
  for (const uri of ['file:///external/voice.m4a', `${playerFolder}/../voice.m4a`, `${playerFolder}/ordinary.m4a`,
    `${playerFolder}/ipad-voice-${'ff'.repeat(16)}.m4a`]) {
    const f = fixture(); await assert.rejects(f.save(uri)); assert.equal(f.secrets.size, 0);
  }
  const f = fixture(); f.files.set(f.uri, Buffer.alloc(2 * 1024 * 1024 + 1));
  await assert.rejects(f.save()); assert.equal(f.secrets.size, 0);
});

test('cipher cleanup and logout remove only named protected files under the cache directory', async () => {
  const f = fixture(); await f.save();
  const record = JSON.parse([...f.secrets.values()][0]);
  const unrelated = `${protectedFolder}/keep.bin`, elsewhere = 'file:///document/expo/voice-elsewhere.bin';
  f.files.set(unrelated, Buffer.from('keep')); f.files.set(elsewhere, Buffer.from('keep'));
  await eraseVoicePlaybackCache();
  assert.equal(f.secrets.size, 0); assert.ok(!f.files.has(`${protectedFolder}/voice-${record.id}.bin`));
  assert.ok(f.files.has(unrelated)); assert.ok(f.files.has(elsewhere));
});

test('SecureStore replacement failure preserves the previous native protected copy', async () => {
  const f = fixture(); await f.save(); const before = [...f.secrets.values()];
  globalThis.__playbackWriteFailure = true; await assert.rejects(f.save());
  assert.deepEqual([...f.secrets.values()], before);
  assert.deepEqual(Buffer.from(f.files.get((await f.get()).playbackUri)), f.bytes);
  globalThis.__playbackWriteFailure = false;
});

test('native key unavailability fails without exposing the underlying key or producing a preview', async () => {
  const f = fixture(); await f.save(); globalThis.__playbackUnavailable = true;
  await assert.rejects(f.get(), error => !error.message.includes('secret-key-material') && error.message.includes('недоступно'));
  assert.equal([...f.files.keys()].filter(uri => uri.startsWith(playerFolder + '/')).length, 1);
  globalThis.__playbackUnavailable = false;
});

test('native damaged ciphertext is never passed to the audio player', async () => {
  const f = fixture(); await f.save(); const record = JSON.parse([...f.secrets.values()][0]);
  f.files.get(`${protectedFolder}/voice-${record.id}.bin`)[40] ^= 1;
  assert.equal(await f.get(), null);
  assert.equal([...f.files.keys()].filter(uri => uri.startsWith(playerFolder + '/')).length, 1);
});

test('startup removes stale owned player files while preserving SDK files, unknown names and protected ciphertext', async () => {
  const f = fixture(); await f.save();
  const ownedOgg = `${playerFolder}/ipad-voice-${'cc'.repeat(16)}.ogg`, ordinary = `${playerFolder}/keep.m4a`;
  const nested = `${playerFolder}/nested/ipad-voice-${'dd'.repeat(16)}.m4a`, sdk = 'file:///cache/expo/sdk-download.m4a';
  for (const uri of [ownedOgg, ordinary, nested, sdk]) f.files.set(uri, Buffer.from('data'));
  cleanIncomingAudioPreviews();
  assert.ok(!f.files.has(f.uri)); assert.ok(!f.files.has(ownedOgg));
  assert.ok(f.files.has(ordinary)); assert.ok(f.files.has(nested)); assert.ok(f.files.has(sdk));
  assert.ok([...f.files.keys()].some(uri => uri.startsWith(protectedFolder + '/voice-')));
});
