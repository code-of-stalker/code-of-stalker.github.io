import assert from 'node:assert/strict';
import test from 'node:test';
import { createDecipheriv, randomBytes } from 'node:crypto';
import { registerHooks } from 'node:module';

// Exercise the real storage adapter against independent Node AES-GCM and
// in-memory Expo ports. Native AES/SecureStore/kill/reopen need a Tecno check.
const cryptoMock = `
  import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
  export async function getRandomBytesAsync(n) { return new Uint8Array(randomBytes(n)); }
  export class AESEncryptionKey {
    constructor(bytes) { this.value = Buffer.from(bytes); }
    static async generate(size = 256) { if (size !== 256) throw Error('wrong size'); return new AESEncryptionKey(randomBytes(32)); }
    static async import(key, encoding) { if (encoding !== 'hex') throw Error('wrong encoding'); return new AESEncryptionKey(Buffer.from(key, encoding)); }
    async encoded(encoding) { return this.value.toString(encoding); }
  }
  export class AESSealedData {
    constructor(bytes) { this.value = new Uint8Array(bytes); }
    static fromCombined(bytes, config) { if (config.ivLength !== 12 || config.tagLength !== 16) throw Error('wrong format'); return new AESSealedData(bytes); }
    async combined() { return this.value; }
  }
  export async function aesEncryptAsync(bytes, key, options) {
    if (options.nonce.length !== 12 || options.tagLength !== 16) throw Error('wrong GCM parameters');
    const f = globalThis.__draftFixture; f.trace.push('encrypt');
    if (f.encryptGate) await f.encryptGate.promise;
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key.value, iv);
    cipher.setAAD(options.additionalData);
    const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return new AESSealedData(Buffer.concat([iv, encrypted, cipher.getAuthTag()]));
  }
  export async function aesDecryptAsync(sealed, key, options) {
    if (options.output !== 'bytes') throw Error('wrong output');
    const f = globalThis.__draftFixture; f.trace.push('decrypt');
    const data = Buffer.from(sealed.value), decipher = createDecipheriv('aes-256-gcm', key.value, data.subarray(0,12));
    decipher.setAAD(options.additionalData); decipher.setAuthTag(data.subarray(-16));
    const bytes = Buffer.concat([decipher.update(data.subarray(12,-16)), decipher.final()]);
    if (f.wrongDecryption) bytes[0] ^= 1;
    return new Uint8Array(bytes);
  }
`;
const filesMock = String.raw`
  export const Paths = { cache: { uri: 'file:///cache/app/' }, document: { uri: 'file:///document/app/' } };
  const fixture = () => globalThis.__draftFixture;
  export class File {
    constructor(...parts) { this.uri = parts.map(p => typeof p === 'string' ? p : p.uri).reduce((a,b) => a ? a.replace(/\/$/,'') + '/' + b : b, ''); }
    get name() { return this.uri.split('/').at(-1); }
    get exists() { return fixture().files.has(this.uri); }
    get size() { return fixture().sizes.get(this.uri) ?? fixture().files.get(this.uri)?.length; }
    async bytes() { const f = fixture(); f.trace.push('read:' + this.name); const bytes = new Uint8Array(f.files.get(this.uri)); if (f.corruptRead && this.name.endsWith('.bin')) bytes[20] ^= 1; return bytes; }
    create() { if (this.exists) throw Error('exists'); fixture().files.set(this.uri,new Uint8Array()); }
    write(bytes) { if (fixture().failFileWrite) throw Error('file write rejected'); fixture().files.set(this.uri,new Uint8Array(bytes)); fixture().trace.push('write:' + this.name); }
    delete() { const f = fixture(); if (f.failFileDelete) throw Error('delete rejected'); f.files.delete(this.uri); f.trace.push('delete:' + this.name); }
  }
  export class Directory extends File {
    get exists() { return fixture().directories.has(this.uri); }
    create() { fixture().directories.add(this.uri); }
    list() { const root = this.uri + '/'; return [...fixture().files.keys()].filter(p => p.startsWith(root) && !p.slice(root.length).includes('/')).map(p => new File(p)); }
  }
`;
const secureMock = `
  export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 4;
  export async function isAvailableAsync() { return !globalThis.__draftFixture.unavailable; }
  export async function getItemAsync(name) { if (name !== 'matrix.voice-draft.v1') throw Error('wrong key'); return globalThis.__draftFixture.secret; }
  export async function setItemAsync(name, text, options) {
    const f = globalThis.__draftFixture; if (name !== 'matrix.voice-draft.v1' || options.keychainAccessible !== 4) throw Error('wrong key options');
    if (Buffer.byteLength(text) > 1900) throw Error('oversized'); f.trace.push('secure-write');
    if (f.commitThenReject) { f.secret = text; throw Error('commit acknowledgement failed'); }
    if (f.failSecretWrite) throw Error('key write rejected'); f.secret = text;
  }
  export async function deleteItemAsync(name) { const f = globalThis.__draftFixture; if (name !== 'matrix.voice-draft.v1') throw Error('wrong key'); if (f.failSecretDelete) throw Error('key delete rejected'); f.secret = null; f.trace.push('secure-delete'); }
`;
registerHooks({ resolve(specifier, context, nextResolve) {
  const source = { 'expo-crypto': cryptoMock, 'expo-file-system': filesMock, 'expo-secure-store': secureMock }[specifier];
  if (source) return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
  if (specifier.startsWith('.') && !/\.(ts|mjs|js)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
} });
const { voiceDraftStorage } = await import('../src/matrix/voice-draft-storage.native.ts');
const { draftErrorText } = await import('../src/matrix/voice-draft-store.ts');
const { VoiceDraftController } = await import('../src/matrix/voice-draft-controller.ts');
const { VoiceCapture } = await import('../src/matrix/voice-capture.ts');
const { checkVoiceConnection } = await import('../src/matrix/voice-send-connection.ts');
const scope = { userId: '@tecno:example.org', serverUrl: 'https://example.org', deviceId: 'TECNO', roomId: '!voice:example.org', peerUserId: '@ipad:example.org' };
const draft = { uri: 'file:///cache/app/recording.m4a', durationMs: 3100, waveform: [0.02, 0.9, 0.45] };
const root = 'file:///document/app/matrix-voice-drafts/';
const previews = 'file:///cache/app/matrix-voice-drafts/';
function fixture() {
  const bytes = new Uint8Array(4096); bytes.set([102,116,121,112],4); bytes.set([71,72,73,74],20);
  const f = { bytes, files: new Map([[draft.uri,bytes]]), directories: new Set(), sizes: new Map(), secret: null, trace: [] };
  globalThis.__draftFixture = f; return f;
}
function deferred() { let resolve; const promise = new Promise(ok => { resolve = ok; }); return { promise, resolve }; }
const tick = () => new Promise(resolve => setImmediate(resolve));
const record = f => JSON.parse(f.secret);
const cipherPath = f => root + 'draft-' + record(f).id + '.bin';

test('native adapter commits only after independent AES disk readback and roundtrip', async () => {
  const f = fixture(), saved = await voiceDraftStorage.save(scope,draft);
  assert.equal(saved.state,'draft'); assert.equal(saved.id,record(f).id);
  const ciphertext = f.files.get(cipherPath(f)); assert.equal(ciphertext.length,f.bytes.length+28);
  assert.notDeepEqual(ciphertext.subarray(12,-16),f.bytes);
  assert.ok(f.trace.indexOf('decrypt') < f.trace.indexOf('secure-write'));
  assert.ok(f.trace.findIndex(x=>x.startsWith('read:draft-')) < f.trace.indexOf('decrypt'));
  const r = record(f), decrypt = createDecipheriv('aes-256-gcm',Buffer.from(r.key,'hex'),ciphertext.subarray(0,12));
  const s = r.scope;
  decrypt.setAAD(Buffer.from(JSON.stringify([1,r.id,s.userId,s.serverUrl,s.deviceId,s.roomId,s.peerUserId,r.createdAt,r.byteLength,r.durationMs,r.waveform])));
  decrypt.setAuthTag(ciphertext.subarray(-16));
  assert.deepEqual(new Uint8Array(Buffer.concat([decrypt.update(ciphertext.subarray(12,-16)),decrypt.final()])), f.bytes);
  assert.equal(f.secret.includes('file:///'),false); assert.equal(f.secret.includes('access_token'),false);
});

test('restore succeeds from persistent cipher after all recording cache files are lost', async () => {
  const f = fixture(); await voiceDraftStorage.save(scope,draft); f.files.delete(draft.uri);
  const restored = await voiceDraftStorage.restore(scope);
  assert.ok(restored.draft.uri.startsWith(previews)); assert.equal(restored.state,'draft');
  assert.deepEqual(f.files.get(restored.draft.uri),f.bytes); assert.equal(restored.draft.durationMs,3100);
});

test('second draft cannot overwrite the only protected recording', async () => {
  const f = fixture(); await voiceDraftStorage.save(scope,draft); const secret = f.secret, cipher = f.files.get(cipherPath(f));
  await assert.rejects(voiceDraftStorage.save(scope,draft),/Уже есть/);
  assert.equal(f.secret,secret); assert.deepEqual(f.files.get(cipherPath(f)),cipher);
});

for (const [name,patch] of Object.entries({ account:{userId:'@other:example.org'}, server:{serverUrl:'https://other.example.org'},
  device:{deviceId:'NEWDEVICE'}, room:{roomId:'!other:example.org'}, recipient:{peerUserId:'@other:example.org'} })) {
  test(`draft bound to ${name} is rejected before decryption or transmission`,async()=>{
    const f=fixture(),saved=await voiceDraftStorage.save(scope,draft),secret=f.secret;f.trace=[];
    await assert.rejects(voiceDraftStorage.restore({...scope,...patch}),/другой сессии/);
    await assert.rejects(voiceDraftStorage.markSending({...scope,...patch},saved.id),/другой сессии/);
    await assert.rejects(voiceDraftStorage.clear({...scope,...patch},saved.id),/другой сессии/);
    assert.equal(f.secret,secret);assert.ok(!f.trace.includes('decrypt'));
  });
}

for (const [name,mutate] of Object.entries({ ciphertext:f=>{f.files.get(cipherPath(f))[20]^=1;},
  key:f=>{const r=record(f);r.key=randomBytes(32).toString('hex');f.secret=JSON.stringify(r);},
  duration:f=>{const r=record(f);r.durationMs+=1;f.secret=JSON.stringify(r);},
  waveform:f=>{const r=record(f);r.waveform[0]=0.5;f.secret=JSON.stringify(r);},
  room:f=>{const r=record(f);r.scope.roomId='!other:example.org';f.secret=JSON.stringify(r);},
  tag:f=>{const b=f.files.get(cipherPath(f));b[b.length-1]^=1;},
  missing:f=>f.files.delete(cipherPath(f)), size:f=>f.sizes.set(cipherPath(f),2*1024*1024) })) {
  test(`damaged ${name} cannot publish a plaintext preview`,async()=>{
    const f=fixture();await voiceDraftStorage.save(scope,draft);mutate(f);
    const context=name==='room'?{...scope,roomId:'!other:example.org'}:scope;
    await assert.rejects(voiceDraftStorage.restore(context));
    assert.ok(![...f.files.keys()].some(path=>path.startsWith(previews)));
  });
}

test('bad disk readback or incorrect native decryption never commits a key',async()=>{
  for(const flag of ['corruptRead','wrongDecryption']) {
    const f=fixture();f[flag]=true;await assert.rejects(voiceDraftStorage.save(scope,draft));assert.equal(f.secret,null);
  }
});

test('failed key write leaves no acknowledged draft; later load removes only the unreferenced cipher',async()=>{
  const f=fixture();f.failSecretWrite=true;await assert.rejects(voiceDraftStorage.save(scope,draft));assert.equal(f.secret,null);
  const unrelated=root+'keep.txt';f.files.set(unrelated,new Uint8Array([8]));
  f.failSecretWrite=false;assert.equal(await voiceDraftStorage.restore(scope),null);
  assert.deepEqual([...f.files.keys()].filter(p=>p.startsWith(root)),[unrelated]);
});

test('rejected write acknowledgement that actually committed preserves a recoverable cipher',async()=>{
  const f=fixture();f.commitThenReject=true;await assert.rejects(voiceDraftStorage.save(scope,draft));
  assert.ok(f.secret);const path=cipherPath(f);assert.ok(f.files.has(path));f.commitThenReject=false;
  const restored=await voiceDraftStorage.restore(scope);assert.deepEqual(f.files.get(restored.draft.uri),f.bytes);
});

test('serialized logout waits for encryption and deletes its subsequently committed key',async()=>{
  const f=fixture(),gate=deferred();f.encryptGate=gate;
  const saving=voiceDraftStorage.save(scope,draft);await tick();assert.ok(f.trace.includes('encrypt'));
  const logout=voiceDraftStorage.eraseAll();assert.equal(f.trace.includes('secure-delete'),false);
  gate.resolve();await Promise.all([saving,logout]);assert.equal(f.secret,null);
  assert.ok(![...f.files.keys()].some(path=>path.startsWith(root)));
  assert.ok(f.trace.indexOf('secure-write')<f.trace.indexOf('secure-delete'));
});

test('failure to delete the protected key keeps the draft recoverable',async()=>{
  const f=fixture(),saved=await voiceDraftStorage.save(scope,draft),secret=f.secret,path=cipherPath(f);
  f.failSecretDelete=true;await assert.rejects(voiceDraftStorage.clear(scope,saved.id));
  assert.equal(f.secret,secret);assert.ok(f.files.has(path));f.failSecretDelete=false;
  assert.ok(await voiceDraftStorage.restore(scope));
});

test('sending marker survives reopening and rejects a second send',async()=>{
  const f=fixture(),saved=await voiceDraftStorage.save(scope,draft);
  await voiceDraftStorage.markSending(scope,saved.id);const reopened=await voiceDraftStorage.restore(scope);
  assert.equal(reopened.state,'sending');assert.deepEqual(f.files.get(reopened.draft.uri),f.bytes);
  await assert.rejects(voiceDraftStorage.markSending(scope,saved.id),/могла уже/);
});

test('stale draft id cannot mark or delete a newer protected recording',async()=>{
  const f=fixture(),saved=await voiceDraftStorage.save(scope,draft);
  await voiceDraftStorage.clear(scope,saved.id);const next=await voiceDraftStorage.save(scope,draft);
  assert.notEqual(next.id,saved.id);const secret=f.secret;
  await assert.rejects(voiceDraftStorage.markSending(scope,saved.id),/изменился/);
  await assert.rejects(voiceDraftStorage.clear(scope,saved.id),/изменился/);assert.equal(f.secret,secret);
});

test('only generated owned files are cleaned, with fresh preview names after each reopen',async()=>{
  const f=fixture();await voiceDraftStorage.save(scope,draft);
  f.files.set(root+'session.sqlite',new Uint8Array([9]));f.files.set(previews+'user.m4a',new Uint8Array([9]));
  f.files.set(previews+'nested/preview-'+ 'ab'.repeat(16)+'.m4a',new Uint8Array([9]));
  const first=await voiceDraftStorage.restore(scope),second=await voiceDraftStorage.restore(scope);
  assert.notEqual(first.draft.uri,second.draft.uri);assert.equal(f.files.has(first.draft.uri),false);
  await voiceDraftStorage.eraseAll();assert.ok(f.files.has(root+'session.sqlite'));assert.ok(f.files.has(previews+'user.m4a'));
  assert.ok([...f.files.keys()].some(p=>p.includes('/nested/')));assert.ok(f.files.has(draft.uri));
});

test('unsafe cache paths, invalid container and oversized capture never write persistent audio',async()=>{
  for(const path of ['https://example.org/a.m4a','file:///document/app/a.m4a','file:///cache/app/%2e%2e/out.m4a']){
    const f=fixture();await assert.rejects(voiceDraftStorage.save(scope,{...draft,uri:path}));assert.equal(f.secret,null);
    assert.ok(!f.trace.includes('encrypt'));
  }
  for(const bytes of [new Uint8Array(4096),new Uint8Array(2*1024*1024)]){
    const f=fixture();f.files.set(draft.uri,bytes);await assert.rejects(voiceDraftStorage.save(scope,draft));assert.equal(f.secret,null);
  }
});

test('waveform is bounded to keep the key record compact',async()=>{
  const f=fixture();await voiceDraftStorage.save(scope,{...draft,waveform:Array(120).fill(0.123456789)});
  assert.ok(record(f).waveform.length<=32);assert.ok(Buffer.byteLength(f.secret)<1900);
  assert.ok(record(f).waveform.every(x=>x===0.123));
});

test('malformed metadata cannot choose arbitrary files; explicit erase still removes only owned files',async()=>{
  const f=fixture();f.secret=JSON.stringify({version:1,id:'../../private',key:'x'});
  const other='file:///document/app/private';f.files.set(other,new Uint8Array([8]));
  await assert.rejects(voiceDraftStorage.restore(scope),/повреждён/);await voiceDraftStorage.eraseAll();
  assert.ok(f.files.has(other));assert.equal(f.secret,null);
});

test('technical failures never expose paths or key material through the UI error text',()=>{
  assert.ok(!draftErrorText(new Error('secret key = abcdef private path')).includes('abcdef'));
});

function ui(store=voiceDraftStorage){
  const states=[],restored=[],deleted=[];
  const controller=new VoiceDraftController(store,scope,{changed:s=>states.push({...s}),restored:d=>{restored.push(d);return true;},discard:u=>deleted.push(u)});
  return {controller,states,restored,deleted,get state(){return states.at(-1);}};
}
test('UI restores a ready draft without microphone or Matrix operations and never resaves it',async()=>{
  fixture();await voiceDraftStorage.save(scope,draft);const f=ui();await f.controller.restore();
  assert.equal(f.state.phase,'ready');assert.equal(f.restored.length,1);assert.equal(await f.controller.save(f.restored[0]),false);
});

test('UI disposal waits for save while protecting the source and never publishes a late badge',async()=>{
  const storage=fixture(),gate=deferred();storage.encryptGate=gate;const f=ui();await f.controller.restore();
  const saving=f.controller.save(draft);await tick();const count=f.states.length;let ended=false;
  const disposed=f.controller.dispose().then(()=>{ended=true;});await tick();assert.equal(ended,false);
  gate.resolve();await Promise.all([saving,disposed]);assert.equal(f.states.length,count);assert.ok(storage.secret);
});

test('late restoration after unmount cleans its own preview without restoring an old screen',async()=>{
  const loaded=deferred(),f=ui({restore:()=>loaded.promise});const restoring=f.controller.restore(),disposed=f.controller.dispose();
  loaded.resolve({id:'ab'.repeat(16),state:'draft',createdAt:1,draft});await Promise.all([restoring,disposed]);
  assert.deepEqual(f.deleted,[draft.uri]);assert.equal(f.restored.length,0);
});

test('UI only acknowledges saved data after key commit and allows a failed save retry',async()=>{
  const storage=fixture(),f=ui();await f.controller.restore();storage.failSecretWrite=true;
  assert.equal(await f.controller.save(draft),false);assert.equal(f.state.saved,null);assert.equal(f.state.phase,'error');
  storage.failSecretWrite=false;assert.equal(await f.controller.save(draft),true);assert.equal(f.state.phase,'ready');
});

test('failed sending-marker write prevents a simulated Matrix send; second click is serialized',async()=>{
  const storage=fixture(),f=ui();await f.controller.restore();await f.controller.save(draft);let sends=0;
  await f.controller.beforeSend();storage.failSecretWrite=true;
  await assert.rejects(f.controller.beforeUpload(new AbortController().signal,async()=>{}).then(()=>{sends++;}));assert.equal(sends,0);
  storage.failSecretWrite=false;const first=f.controller.beforeUpload(new AbortController().signal,async()=>{}).then(()=>{sends++;});
  const second=f.controller.beforeUpload(new AbortController().signal,async()=>{}).then(()=>{sends++;});
  await assert.rejects(second);await first;assert.equal(sends,1);assert.equal(f.state.saved.state,'sending');
  await assert.rejects(f.controller.beforeSend());
});

test('acknowledged send clears the local key; rejected cleanup keeps resend disabled',async()=>{
  const storage=fixture(),f=ui();await f.controller.restore();await f.controller.save(draft);await f.controller.beforeSend();
  await f.controller.beforeUpload(new AbortController().signal,async()=>{});
  storage.failSecretDelete=true;assert.equal(await f.controller.sent(),false);assert.equal(f.state.saved.state,'sending');
  await assert.rejects(f.controller.beforeSend());storage.failSecretDelete=false;assert.equal(await f.controller.remove(),true);
  assert.equal(f.state.saved,null);assert.equal(storage.secret,null);
});

test('capture and storage handoff saves once, deletes the recorder source and restores after disposal',async()=>{
  const storage=fixture(),states=[];let nativeRecording=false,local;
  const recorder={uri:draft.uri,async prepareToRecordAsync(){},record(){nativeRecording=true;},async stop(){nativeRecording=false;},
    getStatus(){return {isRecording:nativeRecording,canRecord:true,durationMillis:3100};}};
  const capture=new VoiceCapture({recorder,async permission(){return {granted:true,canAskAgain:true};},async mode(){},foreground:()=>true,
    discard:uri=>storage.files.delete(uri),changed:s=>{states.push(s);if(s.phase==='ready')void local.save(s.draft);}});
  local=new VoiceDraftController(voiceDraftStorage,scope,{changed(){},restored:(d,replace)=>replace?capture.replaceReadyDraft(d):capture.restoreDraft(d),
    discard:uri=>storage.files.delete(uri)});
  await local.restore();await capture.start();await capture.stop();await tick();
  assert.ok(storage.secret);assert.equal(storage.trace.filter(x=>x==='encrypt').length,1);
  assert.equal(storage.files.has(draft.uri),false);assert.ok(states.at(-1).draft.uri.startsWith(previews));
  await local.dispose();await capture.dispose();const restored=await voiceDraftStorage.restore(scope);
  assert.deepEqual(storage.files.get(restored.draft.uri),storage.bytes);
});

test('offline check preserves the actual encrypted file and key, then explicit retry sends the same draft once',async()=>{
  const storage=fixture(),f=ui();await f.controller.restore();await f.controller.save(draft);
  const secret=storage.secret,path=cipherPath(storage),cipher=new Uint8Array(storage.files.get(path)),id=f.state.saved.id;
  storage.trace=[];let sends=0;
  await assert.rejects(f.controller.beforeSend(()=>checkVoiceConnection(scope.serverUrl,new AbortController().signal,
    async()=>{throw Error('offline');})).then(()=>{sends++;}));
  assert.equal(sends,0);assert.equal(storage.secret,secret);assert.deepEqual(storage.files.get(path),cipher);
  assert.ok(!storage.trace.includes('secure-write'));assert.equal(f.state.saved.state,'draft');
  const reopened=await voiceDraftStorage.restore(scope);assert.equal(reopened.id,id);
  assert.deepEqual(storage.files.get(reopened.draft.uri),storage.bytes);
  await f.controller.beforeSend(()=>checkVoiceConnection(scope.serverUrl,new AbortController().signal,
    async()=>new Response(JSON.stringify({versions:['v1.18']}))));
  assert.equal(record(storage).state,'draft');assert.equal(storage.secret,secret);
  await f.controller.beforeUpload(new AbortController().signal,async()=>{});
  assert.equal(record(storage).state,'sending');assert.equal(record(storage).id,id);sends++;
  assert.equal(sends,1);assert.equal(await f.controller.sent(),true);assert.equal(storage.secret,null);assert.equal(storage.files.has(path),false);
});

test('cancelled connection with late success cannot change the actual secure record or encrypted audio',async()=>{
  const storage=fixture(),f=ui(),pending=deferred(),abort=new AbortController();await f.controller.restore();await f.controller.save(draft);
  const secret=storage.secret,path=cipherPath(storage),cipher=new Uint8Array(storage.files.get(path));storage.trace=[];
  const operation=f.controller.beforeSend(()=>checkVoiceConnection(scope.serverUrl,abort.signal,()=>pending.promise));
  await tick();const rejected=assert.rejects(operation,/остановлена/);abort.abort();await rejected;
  pending.resolve(new Response(JSON.stringify({versions:['v1.18']})));await tick();
  assert.equal(storage.secret,secret);assert.deepEqual(storage.files.get(path),cipher);assert.ok(!storage.trace.includes('secure-write'));
  assert.equal((await voiceDraftStorage.restore(scope)).state,'draft');
});

test('connection lost after SDK handoff keeps the actual persistent sending marker after reopening',async()=>{
  const storage=fixture(),f=ui();await f.controller.restore();await f.controller.save(draft);
  await f.controller.beforeSend();
  await assert.rejects(f.controller.beforeUpload(new AbortController().signal,()=>checkVoiceConnection(scope.serverUrl,new AbortController().signal,
    async()=>new Response(JSON.stringify({versions:['v1.18']})))).then(()=>{throw Error('SDK connection lost');}));
  await f.controller.dispose();const reopened=ui();await reopened.controller.restore();
  assert.equal(record(storage).state,'sending');assert.equal(reopened.state.saved.state,'sending');let requests=0;
  await assert.rejects(reopened.controller.beforeSend(async()=>{requests++;}));assert.equal(requests,0);
  assert.deepEqual(storage.files.get(reopened.restored[0].uri),storage.bytes);
});

test('offline error followed by reconnect and Reload restores the exact secure record as a draft',async()=>{
  const storage=fixture(),f=ui();await f.controller.restore();await f.controller.save(draft);const secret=storage.secret,id=record(storage).id;
  await assert.rejects(f.controller.beforeSend(()=>checkVoiceConnection(scope.serverUrl,new AbortController().signal,
    async()=>{throw Error('offline');})));
  await f.controller.dispose();const reopened=ui();await reopened.controller.restore();
  assert.equal(storage.secret,secret);assert.equal(reopened.state.saved.id,id);assert.equal(reopened.state.saved.state,'draft');
  assert.deepEqual(storage.files.get(reopened.restored[0].uri),storage.bytes);
});

test('SDK preparation and Reload after a successful first GET cannot mutate the persistent draft',async()=>{
  const storage=fixture(),f=ui();await f.controller.restore();await f.controller.save(draft);const secret=storage.secret;
  await f.controller.beforeSend(async()=>{});assert.equal(storage.secret,secret);await f.controller.dispose();
  await assert.rejects(f.controller.beforeUpload(new AbortController().signal,async()=>{}));assert.equal(storage.secret,secret);
  const reopened=ui();await reopened.controller.restore();assert.equal(reopened.state.saved.state,'draft');
});

test('uncertain acknowledgement of the boundary marker still prevents an unsafe retry after reopening',async()=>{
  const storage=fixture(),f=ui();await f.controller.restore();await f.controller.save(draft);await f.controller.beforeSend();
  storage.commitThenReject=true;await assert.rejects(f.controller.beforeUpload(new AbortController().signal,async()=>{}));
  assert.equal(record(storage).state,'sending');storage.commitThenReject=false;await f.controller.dispose();
  const reopened=ui();await reopened.controller.restore();assert.equal(reopened.state.saved.state,'sending');
  await assert.rejects(reopened.controller.beforeSend());
});
