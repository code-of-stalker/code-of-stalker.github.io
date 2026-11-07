// Run: node --test src/features/intensive/intensive.test.mjs
// Phrase, cryptography and the session flow against the in-memory demo server.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const source = readFileSync(new URL(`./${name}.ts`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  modules.set(name, module);
  new Function('exports', 'require', 'module', '__DEV__', js)(
    module.exports, spec => spec.startsWith('./') ? load(spec.slice(2)) : nodeRequire(spec), module, true);
  return module.exports;
}

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => { storage.set(key, String(value)); },
  removeItem: key => { storage.delete(key); },
};

const c = load('crypto');
const phrase = load('phrase');
const { demoBackend } = load('demoBackend');
const { IntensiveSession, hasDevice, shortCode, cleanName, joinName, isFullName, firstName } = load('session');

test('12 words and the key line encode the same secret', () => {
  const { words, entropy } = phrase.newPhrase();
  assert.equal(words.length, 12);
  assert.deepEqual(phrase.phraseWords(entropy), words);
  assert.deepEqual(phrase.parseSecret(`  ${words.join('   ').toUpperCase()} `), entropy);
  const key = phrase.phraseKey(entropy);
  assert.match(key, /^([0-9A-F]{4}-){7}[0-9A-F]{4}$/);
  assert.deepEqual(phrase.parseSecret(key.toLowerCase()), entropy);
  assert.equal(phrase.parseSecret('one two three'), null);
  assert.equal(phrase.parseSecret(Array(12).fill('abandon').join(' ')), null);
  const positions = phrase.confirmationPositions();
  assert.equal(new Set(positions).size, 3);
  assert.ok(positions.every(p => p >= 0 && p < 12));
});

test('credentials are stable per phrase and differ between phrases', async () => {
  const a = phrase.newPhrase().entropy, b = phrase.newPhrase().entropy;
  const first = await c.accountCredentials(a);
  assert.deepEqual(await c.accountCredentials(a), first);
  assert.notEqual((await c.accountCredentials(b)).email, first.email);
  assert.match(first.email, /^walker-[0-9a-f]{32}@code-of-stalker\.github\.io$/);
  assert.ok(first.password.length >= 40);
});

test('identity opens only with its phrase; chat keys open only for their member and chat', async () => {
  const alice = phrase.newPhrase().entropy, bob = phrase.newPhrase().entropy;
  const identity = await c.createIdentity(alice);
  const reopened = await c.openIdentity(alice, identity.wrapped);
  await assert.rejects(c.openIdentity(bob, identity.wrapped));

  const chatKey = c.newChatKey();
  const context = { chatId: 'chat-1', version: 1, memberId: 'alice' };
  const wrapped = await c.wrapChatKey(chatKey, identity.publicKey, context);
  assert.deepEqual(await c.unwrapChatKey(wrapped, reopened, context), chatKey);
  await assert.rejects(c.unwrapChatKey(wrapped, reopened, { ...context, memberId: 'bob' }));
  const other = await c.createIdentity(bob);
  await assert.rejects(c.unwrapChatKey(wrapped, other.privateKey, context));

  const cipher = await c.chatCipher(chatKey);
  const sealed = await c.encryptMessage(cipher, 'chat-1', 'Тишина у реки');
  assert.ok(!sealed.body.includes('Тишина'));
  assert.equal(await c.decryptMessage(cipher, 'chat-1', sealed.iv, sealed.body), 'Тишина у реки');
  await assert.rejects(c.decryptMessage(cipher, 'chat-2', sealed.iv, sealed.body));
});

test('a new account seals on the device, opens with the PIN and is wiped after five wrong PINs', async () => {
  storage.clear();
  const { entropy } = phrase.newPhrase();
  const session = await IntensiveSession.create(demoBackend, entropy);
  assert.equal(session.status.hasProfile, false);
  await session.createProfile('  Лея   Гурова ');
  assert.equal(session.status.name, 'Лея Гурова');
  assert.equal(session.needsTotpStep, false);
  await session.sealDevice('482915');
  assert.ok(hasDevice());
  assert.ok(!storage.get('intensive.device.v1').includes(c.toBase64(entropy)));
  const id = session.id;
  session.lock();

  const opened = await IntensiveSession.unlock(demoBackend, '482915');
  assert.equal(opened.status, 'ok');
  assert.equal(opened.session.id, id);
  assert.deepEqual(opened.session.secret(), entropy);
  opened.session.lock();

  for (let left = 4; left >= 1; left--) assert.deepEqual(await IntensiveSession.unlock(demoBackend, '000000'), { status: 'wrong', left });
  assert.deepEqual(await IntensiveSession.unlock(demoBackend, '000000'), { status: 'wiped' });
  assert.equal(hasDevice(), false);

  const restored = await IntensiveSession.restore(demoBackend, entropy);
  assert.equal(restored.id, id);
  assert.equal(await IntensiveSession.restore(demoBackend, phrase.newPhrase().entropy), null);
  assert.match(shortCode(id), /^[0-9A-F]{4}-[0-9A-F]{4}$/);
});

test('names are a first name and a surname; an older one-word name gets its surname later', async () => {
  assert.equal(cleanName('  Алекс \n  Морозов '), 'Алекс Морозов');
  assert.equal(joinName(' Анна  Мария ', ' Иванова '), 'Анна Мария Иванова');
  assert.equal(isFullName('Алекс Морозов'), true);
  assert.equal(isFullName(' Алекс  '), false);
  assert.equal(isFullName(null), false);
  assert.equal(isFullName('А'.repeat(30) + ' ' + 'Б'.repeat(10)), false);
  assert.equal(firstName(' Алекс  Морозов'), 'Алекс');

  storage.clear();
  const walker = await IntensiveSession.create(demoBackend, phrase.newPhrase().entropy);
  await assert.rejects(walker.rename('Лея Гурова'), error => error.code === 'denied');
  await walker.createProfile('Лея');
  assert.equal(isFullName(walker.status.name), false);
  await walker.rename('  Лея  Гурова ');
  assert.equal(walker.status.name, 'Лея Гурова');
  walker.lock();

  const personas = await demoBackend.personas();
  const mira = await IntensiveSession.restore(demoBackend, personas.find(p => firstName(p.name) === 'Мира').entropy);
  await assert.rejects(mira.rename('Мира Новая'), error => error.code === 'denied');
  await mira.verifyTotp('123456');
  await mira.rename('Мира Новая');
  assert.equal(mira.status.name, 'Мира Новая');
  await mira.rename(personas.find(p => firstName(p.name) === 'Мира').name);
  mira.lock();
});

test('members read the seeded chat; the main admin assigns a guide and the key reaches everyone', async () => {
  const personas = await demoBackend.personas();
  const as = async name => IntensiveSession.restore(demoBackend, personas.find(p => firstName(p.name) === name).entropy);

  const alex = await as('Алекс');
  const [chat] = await alex.myChats();
  assert.equal(chat.guideName, 'Мира Соколова');
  assert.equal(chat.adminName, 'Олег Ветров');
  await alex.chatCipher(chat.chatId);
  const history = await alex.messages(chat.chatId);
  assert.ok(history.length >= 4);
  assert.ok(history.every(m => typeof m.text === 'string'));
  assert.deepEqual(history.slice(0, 3).map(m => m.senderRole), ['walker', 'guide', 'admin']);
  const sent = await alex.send(chat.chatId, 'Сегодня слушал дождь.');
  assert.equal(sent.text, 'Сегодня слушал дождь.');

  const mira = await as('Мира');
  assert.equal(mira.needsTotpStep, true);
  assert.deepEqual(await mira.myChats(), []);
  await mira.verifyTotp('123456');
  const miraChats = await mira.myChats();
  assert.deepEqual(miraChats.map(row => row.walkerName).sort(), ['Алекс Морозов', 'Дина Лебедева']);
  await mira.chatCipher(chat.chatId);
  assert.equal((await mira.messages(chat.chatId)).find(m => m.id === sent.id).text, 'Сегодня слушал дождь.');

  const yana = await as('Яна');
  await assert.rejects(yana.directory(), /totp/);
  await yana.verifyTotp('654321');
  const directory = await yana.directory();
  const nika = directory.find(entry => firstName(entry.name) === 'Ника');
  assert.equal(nika.chatId, null);
  const miraEntry = directory.find(entry => firstName(entry.name) === 'Мира');
  const chatId = await yana.assignGuide(nika.userId, miraEntry.userId);

  const nikaSession = await as('Ника');
  const [nikaChat] = await nikaSession.myChats();
  assert.equal(nikaChat.chatId, chatId);
  await nikaSession.chatCipher(chatId);
  const hello = await nikaSession.send(chatId, 'Здравствуйте.');
  const miraNow = await as('Мира');
  await miraNow.verifyTotp('111111');
  assert.equal((await miraNow.myChats()).length, 3);
  await miraNow.chatCipher(chatId);
  assert.equal((await miraNow.messages(chatId)).find(m => m.id === hello.id).text, 'Здравствуйте.');

  // A stranger never sees the chat.
  const stranger = await IntensiveSession.create(demoBackend, phrase.newPhrase().entropy);
  await stranger.createProfile('Чужой');
  assert.deepEqual(await stranger.myChats(), []);
  await assert.rejects(stranger.messages(chatId), /member/);
});

test('the main admin sees who waits, blocks a walker and opens access again', async () => {
  const personas = await demoBackend.personas();
  const as = async name => IntensiveSession.restore(demoBackend, personas.find(p => firstName(p.name) === name).entropy);
  const yana = await as('Яна');
  await yana.verifyTotp('123456');
  let directory = await yana.directory();
  const dina = directory.find(entry => firstName(entry.name) === 'Дина');
  assert.equal(dina.waitingSince, null);
  assert.ok(dina.lastMessageAt);
  assert.equal(directory.find(entry => firstName(entry.name) === 'Тимур').blocked, true);

  const walker = await as('Дина');
  const [chat] = await walker.myChats();
  await walker.chatCipher(chat.chatId);
  const first = await walker.send(chat.chatId, 'Сравнила. На закате тени втрое длиннее.');
  await walker.send(chat.chatId, 'И синее.');
  directory = await yana.directory();
  assert.equal(directory.find(entry => firstName(entry.name) === 'Дина').waitingSince, first.createdAt);

  await yana.setBlocked(dina.userId, true);
  const blocked = await as('Дина');
  assert.equal(blocked.status.blocked, true);
  assert.deepEqual(await blocked.myChats(), []);
  await assert.rejects(blocked.messages(chat.chatId), /member/);
  await assert.rejects(yana.setBlocked(yana.id, true), /main admin/);

  await yana.setBlocked(dina.userId, false);
  const open = await as('Дина');
  assert.equal(open.status.blocked, false);
  assert.equal((await open.myChats()).length, 1);
});

test('a sender edits and deletes own messages; others see the change and nobody else can make it', async () => {
  const personas = await demoBackend.personas();
  const as = async name => IntensiveSession.restore(demoBackend, personas.find(p => firstName(p.name) === name).entropy);
  const alex = await as('Алекс');
  const [chat] = await alex.myChats();
  await alex.chatCipher(chat.chatId);
  const sent = await alex.send(chat.chatId, 'Слышал дождь');
  const before = new Date(Date.parse(sent.createdAt) - 1000).toISOString();

  const edited = await alex.edit(chat.chatId, sent.id, 'Слышал дождь и гром.');
  assert.equal(edited.text, 'Слышал дождь и гром.');
  assert.ok(edited.editedAt);
  assert.equal(edited.createdAt, sent.createdAt);

  const mira = await as('Мира');
  await mira.verifyTotp('123456');
  await mira.chatCipher(chat.chatId);
  const seen = (await mira.messages(chat.chatId)).find(m => m.id === sent.id);
  assert.equal(seen.text, 'Слышал дождь и гром.');
  assert.equal(seen.editedAt, edited.editedAt);
  await assert.rejects(mira.edit(chat.chatId, sent.id, 'Чужая правка'), /not your message/);
  await assert.rejects(mira.remove(chat.chatId, sent.id), /not your message/);

  const removed = await alex.remove(chat.chatId, sent.id);
  assert.ok(removed.deletedAt);
  assert.equal(removed.text, null);
  assert.equal((await mira.messages(chat.chatId)).some(m => m.id === sent.id), false);
  const changes = await mira.changes(chat.chatId, before);
  const tomb = changes.find(m => m.id === sent.id);
  assert.ok(tomb.deletedAt);
  assert.equal(tomb.text, null);
  await assert.rejects(alex.edit(chat.chatId, sent.id, 'Поздно'), /not your message/);
});

test('a voice message is sealed apart from its description and plays for every member', async () => {
  const personas = await demoBackend.personas();
  const as = async name => IntensiveSession.restore(demoBackend, personas.find(p => firstName(p.name) === name).entropy);
  const alex = await as('Алекс');
  const [chat] = await alex.myChats();
  await alex.chatCipher(chat.chatId);
  const audio = c.randomBytes(2048);
  const original = audio.slice();
  const voice = await alex.sendVoice(chat.chatId, { audio, durationMs: 4200, waveform: [0, .25, 1.4, -1, .5], mimeType: 'audio/webm;codecs=opus' });
  assert.equal(voice.kind, 'voice');
  assert.equal(voice.text, null);
  assert.equal(voice.voice.durationMs, 4200);
  assert.deepEqual(voice.voice.waveform, [0, .25, 1, 0, .5]);
  // The row itself never holds the audio.
  const row = (await alex.backend.messages(chat.chatId)).find(m => m.id === voice.id);
  assert.ok(row.body.length < 400);

  const mira = await as('Мира');
  await mira.verifyTotp('123456');
  await mira.chatCipher(chat.chatId);
  const heard = (await mira.messages(chat.chatId)).find(m => m.id === voice.id);
  assert.equal(heard.voice.mimeType, 'audio/webm;codecs=opus');
  assert.deepEqual(await mira.voiceAudio(chat.chatId, heard), original);
  await assert.rejects(mira.edit(chat.chatId, voice.id, 'текст'), /not your message/);
  await assert.rejects(alex.edit(chat.chatId, voice.id, 'текст'), /only text/);

  await alex.remove(chat.chatId, voice.id);
  const fresh = await as('Мира');
  await fresh.verifyTotp('123456');
  await fresh.chatCipher(chat.chatId);
  await assert.rejects(fresh.voiceAudio(chat.chatId, heard), /gone/);
});

test('a voice description that does not match the format is refused', async () => {
  const key = await c.chatCipher(c.newChatKey());
  const sealed = await c.encryptVoice(key, 'chat-a', { durationMs: 1000, waveform: [.5], mimeType: 'audio/ogg' }, c.randomBytes(16));
  assert.deepEqual(await c.decryptVoice(key, 'chat-a', sealed.iv, sealed.body), { durationMs: 1000, waveform: [.5], mimeType: 'audio/ogg' });
  await assert.rejects(c.decryptVoice(key, 'chat-b', sealed.iv, sealed.body));
  const bad = await c.encryptVoice(key, 'chat-a', { durationMs: 1000, waveform: [.5], mimeType: 'text/html' }, c.randomBytes(16));
  await assert.rejects(c.decryptVoice(key, 'chat-a', bad.iv, bad.body), /Malformed/);
  const text = await c.encryptMessage(key, 'chat-a', 'привет');
  await assert.rejects(c.decryptVoice(key, 'chat-a', text.iv, text.body), /Malformed/);
  // Audio and description are bound to different contexts.
  await assert.rejects(c.decryptAudio(key, 'chat-a', sealed.iv, sealed.body));
  assert.equal((await c.decryptAudio(key, 'chat-a', sealed.mediaIv, sealed.mediaBody)).length, 16);
});

test('a fresh unlock signs in anew and leaves the device session untouched', async () => {
  storage.clear();
  const { entropy } = phrase.newPhrase();
  const session = await IntensiveSession.create(demoBackend, entropy);
  await session.createProfile('Ева');
  await session.sealDevice('482915');
  session.lock();
  const sealed = storage.get('intensive.device.v1');
  const opened = await IntensiveSession.unlock(demoBackend, '482915', { fresh: true });
  assert.equal(opened.status, 'ok');
  assert.equal(opened.session.status.name, 'Ева');
  assert.equal(storage.get('intensive.device.v1'), sealed);
  opened.session.lock();
});
