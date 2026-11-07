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
const { IntensiveSession, hasDevice, shortCode } = load('session');

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
  await session.createProfile('  Лея  ');
  assert.equal(session.status.name, 'Лея');
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

test('members read the seeded chat; the main admin assigns a guide and the key reaches everyone', async () => {
  const personas = await demoBackend.personas();
  const as = async name => IntensiveSession.restore(demoBackend, personas.find(p => p.name === name).entropy);

  const alex = await as('Алекс');
  const [chat] = await alex.myChats();
  assert.equal(chat.guideName, 'Мира');
  assert.equal(chat.adminName, 'Олег');
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
  assert.equal(miraChats.length, 1);
  await mira.chatCipher(miraChats[0].chatId);
  assert.equal((await mira.messages(miraChats[0].chatId)).find(m => m.id === sent.id).text, 'Сегодня слушал дождь.');

  const yana = await as('Яна');
  await assert.rejects(yana.directory(), /totp/);
  await yana.verifyTotp('654321');
  const directory = await yana.directory();
  const nika = directory.find(entry => entry.name === 'Ника');
  assert.equal(nika.chatId, null);
  const miraEntry = directory.find(entry => entry.name === 'Мира');
  const chatId = await yana.assignGuide(nika.userId, miraEntry.userId);

  const nikaSession = await as('Ника');
  const [nikaChat] = await nikaSession.myChats();
  assert.equal(nikaChat.chatId, chatId);
  await nikaSession.chatCipher(chatId);
  const hello = await nikaSession.send(chatId, 'Здравствуйте.');
  const miraNow = await as('Мира');
  await miraNow.verifyTotp('111111');
  assert.equal((await miraNow.myChats()).length, 2);
  await miraNow.chatCipher(chatId);
  assert.equal((await miraNow.messages(chatId)).find(m => m.id === hello.id).text, 'Здравствуйте.');

  // A stranger never sees the chat.
  const stranger = await IntensiveSession.create(demoBackend, phrase.newPhrase().entropy);
  await stranger.createProfile('Чужой');
  assert.deepEqual(await stranger.myChats(), []);
  await assert.rejects(stranger.messages(chatId), /member/);
});
