import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.(ts|tsx|mjs|cjs|js|json)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
} });

const { discoverDiaryRoom } = await import('../src/matrix/diary-recovery-discovery.ts');
const own = '@tecno:example.org', diaryId = '!diary:example.org';
const state = (extra = []) => [
  { type: 'm.room.name', state_key: '', content: { name: 'Watcher · личный тестовый дневник' } },
  { type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } },
  { type: 'm.room.member', state_key: own, content: { membership: 'join' } },
  ...extra,
];

test('fresh device locates the owner-only encrypted diary from server state', async () => {
  const calls = [];
  const read = async path => {
    calls.push(path);
    if (path === 'joined_rooms') return { joined_rooms: ['!other:example.org', diaryId] };
    if (path.includes('other')) return [{ type: 'm.room.name', state_key: '', content: { name: 'Unrelated' } }];
    return state();
  };
  assert.equal(await discoverDiaryRoom(read, own, new AbortController().signal, () => {}), diaryId);
  assert.deepEqual(calls, ['joined_rooms', 'rooms/!other%3Aexample.org/state', 'rooms/!diary%3Aexample.org/state']);
});

test('an invitation or other member invalidates a claimed diary', async () => {
  const read = async path => path === 'joined_rooms' ? { joined_rooms: [diaryId] } :
    state([{ type: 'm.room.member', state_key: '@ipad:example.org', content: { membership: 'invite' } }]);
  await assert.rejects(discoverDiaryRoom(read, own, new AbortController().signal, () => {}), /посторонний/);
});

test('multiple candidate diaries are not selected by guesswork', async () => {
  const read = async path => path === 'joined_rooms' ? { joined_rooms: [diaryId, '!second:example.org'] } : state();
  await assert.rejects(discoverDiaryRoom(read, own, new AbortController().signal, () => {}), /несколько/);
});
