import assert from 'node:assert/strict';
import test from 'node:test';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.(ts|tsx|mjs|js|json)$/.test(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { VoicePlaybackCache } = await import('../src/matrix/voice-playback-cache.ts');
const { AudioProbeError } = await import('../src/matrix/audio-probe.ts');
const context = { userId: '@tecno:example.org', peerUserId: '@ipad:example.org', deviceId: 'TECNO',
  roomId: '!room:example.org', serverUrl: 'https://example.org' };
const proof = { eventType: 'm.room.encrypted', algorithm: 'm.megolm.v1.aes-sha2', ciphertextLength: 256 };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function audio(extension = 'm4a', marker = 3) {
  const bytes = Buffer.alloc(4096, marker);
  if (extension === 'm4a') bytes.write('ftyp', 4);
  else { bytes.write('OggS', 0); bytes[4] = 0; bytes[26] = 1; bytes[27] = 19; bytes.write('OpusHead', 28); }
  return bytes;
}
function fixture() {
  const secrets = Array(10).fill(null), ciphers = new Map(), previews = new Map(), source = new Map();
  const faults = {};
  let id = 0, reads = 0, cipherWrites = 0;
  const ports = {
    async readSecret(slot) { reads++; if (faults.readSecret) throw Error('secret-key-material'); return secrets[slot]; },
    async writeSecret(slot, text) { if (faults.writeBefore) throw Error('secret-key-material'); secrets[slot] = text; if (faults.writeAfter) throw Error('secret-key-material'); },
    async eraseSecret(slot) { if (faults.erase) throw Error('key deletion failed'); secrets[slot] = null; },
    async randomId() { return (++id).toString(16).padStart(32, '0'); },
    async newKey() { return randomBytes(32).toString('hex'); },
    async readPlayback(uri) { return source.get(uri); },
    async digest(bytes) { return digest(bytes); },
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
    async writeCipher(id, bytes) {
      cipherWrites++; ciphers.set(id, new Uint8Array(bytes)); await faults.waitCipher?.();
      faults.onCipher?.(); if (faults.cipher) throw Error('file write failed');
    },
    async readCipher(id, size) { const bytes = ciphers.get(id); if (!bytes || bytes.length !== size) throw Error('file missing'); return bytes; },
    async cleanCiphers(keep) { for (const id of ciphers.keys()) if (!keep.includes(id)) ciphers.delete(id); },
    async writePreview(bytes, extension) {
      const uri = `file:///cache/player-${++id}.${extension}`; previews.set(uri, new Uint8Array(bytes)); faults.onPreview?.(); return uri;
    },
    discardPreview(uri) { previews.delete(uri); },
  };
  const store = new VoicePlaybackCache(ports);
  const make = (eventId = '$own', extension = 'm4a', sender = context.userId, marker = 3) => {
    const bytes = audio(extension, marker), uri = `file:///checked/${eventId.slice(1)}.${extension}`;
    source.set(uri, { bytes, extension });
    return { uri, bytes, checkpoint: { roomId: context.roomId, eventId, deviceId: context.deviceId, senderUserId: sender,
      audioSha256: digest(bytes), byteLength: bytes.length, durationMs: 3000, createdAt: 1 } };
  };
  const signal = () => new AbortController().signal;
  const save = (item, eligible = [item.checkpoint.eventId], selected = context, abort = signal()) => store.save(selected, item.checkpoint, proof, item.uri, eligible, abort);
  const get = (item, selected = context, abort = signal()) => store.get(selected, item.checkpoint, abort);
  return { store, ports, source, secrets, ciphers, previews, faults, make, save, get, signal, counters: () => ({ reads, cipherWrites }) };
}

for (const extension of ['m4a', 'ogg']) test(`verified ${extension} survives store recreation and creates a new player file without network`, async () => {
  const f = fixture(), item = f.make('$voice', extension, extension === 'ogg' ? context.peerUserId : context.userId);
  await f.save(item);
  assert.equal(f.ciphers.size, 1);
  assert.equal(f.previews.size, 0);
  assert.ok([...f.ciphers.values()].every(bytes => !Buffer.from(bytes).equals(item.bytes)));
  assert.ok(f.secrets.filter(Boolean).every(text => text.length < 2048 && !text.includes('playbackUri') && !text.includes(item.uri)));
  f.source.clear(); // No original plaintext file remains.
  const recreated = new VoicePlaybackCache(f.ports);
  const result = await recreated.get(context, item.checkpoint, f.signal());
  assert.equal(result.playbackSource, 'tecno'); assert.equal(result.offlineCopy, 'saved');
  assert.deepEqual(Buffer.from(f.previews.get(result.playbackUri)), item.bytes);
  assert.equal(result.encryption.algorithm, 'm.megolm.v1.aes-sha2');
});

test('unopened voice is a cache miss with no player or ciphertext', async () => {
  const f = fixture(); assert.equal(await f.get(f.make()), null);
  assert.equal(f.previews.size, 0); assert.equal(f.ciphers.size, 0);
});

test('another account, peer, server, room or device cannot open the previous cache', async () => {
  const f = fixture(), item = f.make(); await f.save(item);
  for (const patch of [{ userId: '@other:example.org' }, { peerUserId: '@other:example.org' },
    { serverUrl: 'https://elsewhere.example.org' }, { deviceId: 'OTHER' }, { roomId: '!elsewhere:example.org' }]) {
    const changed = { ...context, ...patch };
    const cp = { ...item.checkpoint, roomId: changed.roomId, deviceId: changed.deviceId, senderUserId: changed.userId };
    assert.equal(await f.store.get(changed, cp, f.signal()), null);
  }
  assert.equal(f.previews.size, 0);
});

test('changed checkpoint hash, sender, size, duration, time or event cannot reuse an old file', async () => {
  const f = fixture(), item = f.make(); await f.save(item);
  for (const patch of [{ audioSha256: 'f'.repeat(64) }, { senderUserId: context.peerUserId }, { byteLength: 4097 },
    { durationMs: 4000 }, { createdAt: 2 }, { eventId: '$other' }]) {
    assert.equal(await f.store.get(context, { ...item.checkpoint, ...patch }, f.signal()), null);
  }
  assert.equal(f.previews.size, 0);
});

for (const damage of ['ciphertext', 'key', 'metadata', 'missing']) test(`${damage} damage never produces playable plaintext`, async () => {
  const f = fixture(), item = f.make(); await f.save(item);
  const slot = f.secrets.findIndex(Boolean), record = JSON.parse(f.secrets[slot]);
  if (damage === 'ciphertext') f.ciphers.get(record.id)[32] ^= 1;
  if (damage === 'missing') f.ciphers.delete(record.id);
  if (damage === 'key') record.key = 'f'.repeat(64);
  if (damage === 'metadata') record.encryption.ciphertextLength++;
  f.secrets[slot] = JSON.stringify(record);
  assert.equal(await f.get(item), null); assert.equal(f.previews.size, 0);
});

test('tampered protected metadata plus matching caller checkpoint still fails AES authentication', async () => {
  const f = fixture(), item = f.make(); await f.save(item);
  const slot = f.secrets.findIndex(Boolean), record = JSON.parse(f.secrets[slot]);
  record.checkpoint.createdAt = 2; f.secrets[slot] = JSON.stringify(record);
  assert.equal(await f.store.get(context, record.checkpoint, f.signal()), null);
  assert.equal(f.previews.size, 0);
});

test('invalid and oversized secret records are misses without file access or raw errors', async () => {
  for (const text of ['{bad', 'x'.repeat(2049), 'null', JSON.stringify({ version: 2 })]) {
    const f = fixture(); f.secrets[0] = text;
    assert.equal(await f.get(f.make()), null); assert.equal(f.previews.size, 0);
  }
});

test('plaintext format, digest and size must agree with the native checkpoint before saving', async () => {
  for (const change of ['format', 'hash', 'size', 'oversize']) {
    const f = fixture(), item = f.make();
    if (change === 'format') item.bytes.write('junk', 4);
    if (change === 'hash') item.checkpoint.audioSha256 = 'f'.repeat(64);
    if (change === 'size') item.checkpoint.byteLength++;
    if (change === 'oversize') f.source.set(item.uri, { bytes: Buffer.alloc(2 * 1024 * 1024 + 1), extension: 'm4a' });
    await assert.rejects(f.save(item), AudioProbeError);
    assert.equal(f.counters().cipherWrites, 0);
    assert.ok(f.secrets.every(value => value === null));
  }
});

test('cache holds at most the ten eligible history records and removes expired protected files', async () => {
  const f = fixture(), items = Array.from({ length: 11 }, (_, i) => f.make(`$${i}`, 'm4a', i % 2 ? context.peerUserId : context.userId, i + 1));
  let eligible = [];
  for (const item of items) { eligible = [...eligible, item.checkpoint.eventId].slice(-10); await f.save(item, eligible); }
  assert.equal(f.secrets.filter(Boolean).length, 10); assert.equal(f.ciphers.size, 10);
  assert.equal(await f.get(items[0]), null);
  assert.equal((await f.get(items[10])).playbackSource, 'tecno');
  assert.equal((await f.get(items[1])).playbackSource, 'tecno');
});

test('ineligible, duplicated and oversized history sets cannot commit a key', async () => {
  const f = fixture(), item = f.make();
  for (const eligible of [[], ['$own', '$own'], Array.from({ length: 11 }, (_, i) => i ? `$${i}` : '$own')]) {
    await assert.rejects(f.save(item, eligible), AudioProbeError);
    assert.ok(f.secrets.every(value => value === null));
  }
});

test('failed key replacement keeps the previous voice readable; uncommitted orphan is later cleaned', async () => {
  const f = fixture(), item = f.make(); await f.save(item);
  const before = [...f.secrets]; f.faults.writeBefore = true;
  await assert.rejects(f.save(item)); assert.deepEqual(f.secrets, before);
  assert.equal((await f.get(item)).playbackSource, 'tecno');
  assert.equal(f.ciphers.size, 2);
  f.faults.writeBefore = false; await f.save(item); assert.equal(f.ciphers.size, 1);
});

test('key write that commits and then rejects does not delete its only ciphertext', async () => {
  const f = fixture(), item = f.make(); f.faults.writeAfter = true;
  await assert.rejects(f.save(item));
  assert.equal(f.ciphers.size, 1); assert.equal((await f.get(item)).playbackSource, 'tecno');
});

test('abort before commit leaves no usable key and a late preview is deleted', async () => {
  const f = fixture(), item = f.make(), abort = new AbortController();
  f.faults.onCipher = () => abort.abort();
  await assert.rejects(f.save(item, ['$own'], context, abort.signal), /отменено/);
  assert.ok(f.secrets.every(value => value === null));
  delete f.faults.onCipher; await f.save(item);
  const second = new AbortController(); f.faults.onPreview = () => second.abort();
  await assert.rejects(f.get(item, context, second.signal), /отменено/);
  assert.equal(f.previews.size, 0);
});

test('logout queues behind an in-flight save and removes every protected key and ciphertext', async () => {
  const f = fixture(), item = f.make(); let release, arrived;
  const waiting = new Promise(resolve => { arrived = resolve; });
  f.faults.waitCipher = () => { arrived(); return new Promise(resolve => { release = resolve; }); };
  const save = f.save(item); await waiting;
  const logout = f.store.eraseAll(); release(); await save; await logout;
  assert.ok(f.secrets.every(value => value === null)); assert.equal(f.ciphers.size, 0);
  assert.equal(await f.get(item), null);
});

test('failed key deletion preserves referenced ciphertext for a later logout retry', async () => {
  const f = fixture(), item = f.make(); await f.save(item); f.faults.erase = true;
  await assert.rejects(f.store.eraseAll()); assert.equal(f.ciphers.size, 1);
  assert.equal((await f.get(item)).playbackSource, 'tecno');
  f.faults.erase = false; await f.store.eraseAll(); assert.equal(f.ciphers.size, 0);
});

test('new room/account persistence never retains the former room cache keys', async () => {
  const f = fixture(), first = f.make(); await f.save(first);
  const changed = { ...context, roomId: '!second:example.org' }, second = f.make('$second'); second.checkpoint.roomId = changed.roomId;
  await f.save(second, ['$second'], changed);
  assert.equal(f.secrets.filter(Boolean).length, 1); assert.equal(f.ciphers.size, 1);
  assert.equal(await f.get(first), null); assert.equal((await f.get(second, changed)).playbackSource, 'tecno');
});
