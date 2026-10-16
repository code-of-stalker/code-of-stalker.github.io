import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { registerHooks } from 'node:module';

const mocks = {
  'expo-crypto': `
    import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
    export async function getRandomBytesAsync(size) { return new Uint8Array(randomBytes(size)); }
    export class AESEncryptionKey {
      constructor(value) { this.value = value; }
      static async generate() { return new AESEncryptionKey(randomBytes(32)); }
      static async import(value, encoding) { return new AESEncryptionKey(Buffer.from(value, encoding)); }
      async encoded(encoding) { return this.value.toString(encoding); }
    }
    export class AESSealedData {
      static fromCombined(value) { return value; }
    }
    export async function aesEncryptAsync(value, key, options) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm',key.value,iv);
      cipher.setAAD(options.additionalData);
      const bytes = Buffer.concat([iv,cipher.update(value),cipher.final(),cipher.getAuthTag()]);
      return { combined: async () => new Uint8Array(bytes) };
    }
    export async function aesDecryptAsync(value, key, options) {
      const bytes = Buffer.from(value), cipher = createDecipheriv('aes-256-gcm',key.value,bytes.subarray(0,12));
      cipher.setAAD(options.additionalData); cipher.setAuthTag(bytes.subarray(-16));
      return new Uint8Array(Buffer.concat([cipher.update(bytes.subarray(12,-16)),cipher.final()]));
    }
  `,
  'expo-secure-store': `
    export const WHEN_UNLOCKED_THIS_DEVICE_ONLY=4;
    export async function isAvailableAsync(){return true;}
    export async function getItemAsync(name){return globalThis.__productTest.secrets.get(name)??null;}
    export async function setItemAsync(name,text){
      if(globalThis.__productTest.failCommit && JSON.parse(text).stateId)throw Error('commit rejected');
      globalThis.__productTest.secrets.set(name,text);
    }
    export async function deleteItemAsync(name){globalThis.__productTest.secrets.delete(name);}
  `,
  'expo-file-system': String.raw`
    export const Paths={document:{uri:'file:///document/'},cache:{uri:'file:///cache/'}};
    export class File{
      constructor(...parts){this.uri=parts.map(x=>typeof x==='string'?x:x.uri).reduce((a,b)=>a?a.replace(/\/$/,'')+'/'+b:b,'');}
      get name(){return this.uri.split('/').at(-1);}
      get exists(){return globalThis.__productTest.files.has(this.uri);}
      get size(){return globalThis.__productTest.files.get(this.uri)?.length;}
      create(){if(this.exists)throw Error('exists');globalThis.__productTest.files.set(this.uri,new Uint8Array());}
      write(bytes){globalThis.__productTest.files.set(this.uri,new Uint8Array(bytes));}
      async bytes(){return new Uint8Array(globalThis.__productTest.files.get(this.uri));}
      delete(){globalThis.__productTest.files.delete(this.uri);}
    }
    export class Directory extends File{
      get exists(){return globalThis.__productTest.directories.has(this.uri);}
      create(){globalThis.__productTest.directories.add(this.uri);}
      list(){return [...globalThis.__productTest.files.keys()].filter(x=>x.startsWith(this.uri+'/')).map(x=>new File(x));}
      delete(){
        if(globalThis.__productTest.failReset)throw Error('reset rejected');
        for(const path of globalThis.__productTest.files.keys())if(path.startsWith(this.uri+'/'))globalThis.__productTest.files.delete(path);
        for(const path of globalThis.__productTest.directories)if(path===this.uri||path.startsWith(this.uri+'/'))globalThis.__productTest.directories.delete(path);
      }
    }
  `,
};
registerHooks({resolve(specifier,context,next){
  if(mocks[specifier])return {url:'data:text/javascript,'+encodeURIComponent(mocks[specifier]),shortCircuit:true};
  if(specifier.startsWith('.')&&!/\.(ts|mjs|js)(\?|$)/.test(specifier))return next(specifier+'.ts',context);
  return next(specifier,context);
}});
let sequence=0;
const fresh=async()=> (await import(`./storage.native.ts?instance=${sequence++}`)).productStorage;
const meta={level:'basic',step:1,questionIndex:0};
const draft={uri:'file:///cache/capture.m4a',durationMs:2100,waveform:[0.1,0.7]};

test('native storage saves and reopens a three-minute assignment above the old byte limit', async () => {
  const fixture = setup(), repo = await fresh();
  const bytes = new Uint8Array(2 * 1024 * 1024); bytes.set([102,116,121,112], 4); fixture.files.set(draft.uri, bytes);
  const { observation } = await repo.save({ ...draft, durationMs: 180000 }, meta);
  const reopened = await fresh(), uri = await reopened.loadPlayback(observation.id);
  assert.deepEqual(fixture.files.get(uri), bytes);
});

test('native diary preserves encrypted text and fifteen-minute audio across reopening and bookmarking', async () => {
  const fixture = setup(), repo = await fresh();
  const bytes = new Uint8Array(9 * 1024 * 1024); bytes.set([102,116,121,112], 4); fixture.files.set(draft.uri, bytes);
  await repo.saveDiaryText('private daily dynamics', 'dynamics');
  const { entry } = await repo.saveDiaryVoice({ ...draft, durationMs: 900000 }, 'dynamics');
  await repo.setListenLater(entry.id, true);
  const reopened = await fresh(), state = await reopened.read();
  assert.equal(state.diaryEntries.length, 2); assert.deepEqual(state.listenLater, [entry.id]);
  const uri = await reopened.loadPlayback(entry.id); assert.deepEqual(fixture.files.get(uri), bytes);
  for (const [path, encrypted] of fixture.files) if (path.startsWith('file:///document/')) assert.equal(Buffer.from(encrypted).includes(Buffer.from('private daily dynamics')), false);
  await assert.rejects(repo.save({ ...draft, durationMs: 300000 }, meta));
  await reopened.delete(entry.id); assert.deepEqual((await (await fresh()).read()).listenLater, []);
});
function setup(){
  const bytes=new Uint8Array(128);bytes.set([102,116,121,112],4);bytes.set(new TextEncoder().encode('private-observation'),32);
  globalThis.__productTest={files:new Map([[draft.uri,bytes]]),directories:new Set(),secrets:new Map()};
  return globalThis.__productTest;
}
test('native audio and metadata remain encrypted, reopen using a distinct secure-store namespace',async()=>{
  const fixture=setup(),repository=await fresh();
  const result=await repository.save(draft,meta);
  assert.equal(result.snapshot.observations.length,1);
  assert.deepEqual([...fixture.secrets.keys()],['watcher.product.v1']);
  for(const [path,bytes] of fixture.files)if(path.startsWith('file:///document/')){
    assert.equal(path.endsWith('.bin'),true);
    assert.equal(Buffer.from(bytes).includes(Buffer.from('private-observation')),false);
    assert.equal(Buffer.from(bytes).includes(Buffer.from('questionIndex')),false);
  }
  const reopened=await fresh();assert.deepEqual((await reopened.read()).observations,result.snapshot.observations);
  const uri=await reopened.loadPlayback(result.observation.id);
  assert.deepEqual(fixture.files.get(uri),fixture.files.get(draft.uri));
  reopened.discardPlayback(uri);await new Promise(resolve=>setImmediate(resolve));assert.equal(fixture.files.has(uri),false);
});
test('modified encrypted audio fails authentication without deleting the record',async()=>{
  const fixture=setup(),repository=await fresh(),result=await repository.save(draft,meta);
  const path=`file:///document/watcher-product/audio-${result.observation.id}.bin`;fixture.files.get(path)[31]^=1;
  await assert.rejects(repository.loadPlayback(result.observation.id));
  assert.equal((await repository.read()).observations.length,1);
});
test('metadata commit failure preserves old state and its audio',async()=>{
  const fixture=setup(),repository=await fresh(),first=await repository.save(draft,meta);
  fixture.failCommit=true;
  await assert.rejects(repository.delete(first.observation.id),/commit rejected/);
  fixture.failCommit=false;
  assert.equal((await repository.read()).observations.length,1);
  assert.equal(fixture.files.has(`file:///document/watcher-product/audio-${first.observation.id}.bin`),true);
});
test('queued settings updates retain both changes and delete removes only referenced audio',async()=>{
  const fixture=setup(),repository=await fresh();
  await Promise.all([repository.updateSettings({theme:'light'}),repository.updateSettings({reducedMotion:true})]);
  const result=await repository.save(draft,meta);
  const state=await repository.read();assert.equal(state.settings.theme,'light');assert.equal(state.settings.reducedMotion,true);
  await repository.delete(result.observation.id);
  assert.equal((await repository.read()).observations.length,0);
  assert.equal(fixture.files.has(draft.uri),true);
});
test('completion checks the committed four answers and starts exactly one 24 hour gate',async()=>{
  setup();const repository=await fresh();
  await repository.save(draft,meta);
  await assert.rejects(repository.completeFirstStep(),/2, 3, 4/);
  assert.equal((await repository.read()).progress.completedAt,null);
  await repository.save(draft,{...meta,questionIndex:1});
  await repository.save(draft,{...meta,questionIndex:2});
  // Queue completion before the last write resolves, like a UI whose state is
  // still one render behind. The repository must observe the committed answer.
  const finalSave=repository.save(draft,{...meta,questionIndex:3});
  const completion=repository.completeFirstStep();
  await finalSave;const completed=await completion;
  assert.equal(completed.progress.availableAt-completed.progress.completedAt,24*60*60*1000);
  await repository.save(draft,{...meta,questionIndex:3});
  const again=await repository.completeFirstStep();
  assert.equal(again.progress.completedAt,completed.progress.completedAt);
  assert.equal(again.progress.availableAt,completed.progress.availableAt);
  const reopened=await fresh();assert.deepEqual((await reopened.read()).progress,completed.progress);
});
test('answers from another level do not unlock the selected level',async()=>{
  setup();const repository=await fresh();
  await repository.updateProgress({selectedLevel:'guidance'});
  for(let questionIndex=0;questionIndex<4;questionIndex++)await repository.save(draft,{...meta,questionIndex});
  await assert.rejects(repository.completeFirstStep(),/1, 2, 3, 4/);
});

test('step two uses its own four answers and completes only after entering the closing block', async () => {
  setup(); const repository = await fresh();
  for (let questionIndex = 0; questionIndex < 4; questionIndex++) await repository.save(draft, { ...meta, questionIndex });
  const first = await repository.completeFirstStep();
  await repository.updateProgress({ step: 2, practiceStage: 3 });
  await assert.rejects(repository.completeSecondStep(), /Сначала пройди/);
  await repository.updateProgress({ practiceStage: 4 });
  await assert.rejects(repository.completeSecondStep(), /1, 2, 3, 4/);
  for (let questionIndex = 0; questionIndex < 3; questionIndex++) await repository.save(draft, { ...meta, step: 2, questionIndex });
  await assert.rejects(repository.completeSecondStep(), /4/);
  const pending = repository.save(draft, { ...meta, step: 2, questionIndex: 3, questionText: 'Вопрос второго шага' });
  const completion = repository.completeSecondStep(); await pending;
  const completed = await completion;
  assert.ok(completed.progress.secondStepCompletedAt > 0);
  assert.equal(completed.progress.step, 3);
  assert.equal(completed.progress.practiceStage, 0);
  assert.equal(completed.progress.questionIndex, 0);
  assert.equal(completed.progress.availableAt, first.progress.availableAt);
  assert.equal(completed.progress.completedAt, first.progress.completedAt);
  assert.equal((await repository.completeSecondStep()).progress.secondStepCompletedAt, completed.progress.secondStepCompletedAt);
  const reopened = await fresh(); assert.deepEqual((await reopened.read()).progress, completed.progress);
});
test('reset removes audio, previews, orphaned files, key and progress, then reopens as first launch',async()=>{
  const fixture=setup(),repository=await fresh();
  await repository.updateSettings({startAt:'diary',reducedMotion:true,microphoneCheck:false});
  await repository.updateProgress({selectedLevel:'basic',questionIndex:3});
  const saved=await repository.save(draft,meta),preview=await repository.loadPlayback(saved.observation.id);
  fixture.files.set('file:///document/watcher-product/orphan.bin',new Uint8Array([1]));
  fixture.files.set('file:///document/matrix-store/session.bin',new Uint8Array([2]));
  fixture.secrets.set('watcher.matrix.test-session','unrelated-session');
  const {emptyProduct}=await import('./model.ts');
  assert.deepEqual(await repository.reset(),emptyProduct());
  assert.equal(fixture.files.has(preview),false);
  assert.equal([...fixture.files.keys()].some(path=>/\/watcher-product\//.test(path)),false);
  assert.equal(fixture.secrets.has('watcher.product.v1'),false);
  assert.equal(fixture.files.has('file:///document/matrix-store/session.bin'),true);
  assert.equal(fixture.secrets.get('watcher.matrix.test-session'),'unrelated-session');
  assert.deepEqual(await (await fresh()).read(),emptyProduct());
  const newSave=await repository.save(draft,meta);
  assert.equal(newSave.snapshot.observations.length,1);
  assert.deepEqual((await (await fresh()).read()).observations,newSave.snapshot.observations);
});
test('reset runs after an already queued save and removes its committed audio too',async()=>{
  const fixture=setup(),repository=await fresh();
  const save=repository.save(draft,meta),reset=repository.reset();
  await save;await reset;
  assert.equal((await repository.read()).observations.length,0);
  assert.equal([...fixture.files.keys()].some(path=>path.startsWith('file:///document/watcher-product/')),false);
});
test('reset also works with unreadable previous state and reports a failed deletion',async()=>{
  const fixture=setup(),repository=await fresh();
  await repository.save(draft,meta);
  fixture.failReset=true;
  await assert.rejects(repository.reset(),/reset rejected/);
  assert.equal((await repository.read()).observations.length,1);
  fixture.failReset=false;
  fixture.secrets.set('watcher.product.v1','broken secret');
  const broken=await fresh();
  await assert.rejects(broken.read());
  assert.deepEqual((await broken.reset()).observations,[]);
  assert.equal(fixture.secrets.has('watcher.product.v1'),false);
});
