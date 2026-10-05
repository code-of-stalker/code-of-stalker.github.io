import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.(ts|tsx|mjs|cjs|js|json)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
} });

const { assertGroupMembers, groupParticipants } = await import('../src/matrix/group-boundary.ts');
const { parseSavedSession, SerializedSessionStorage, SessionVaultCore } = await import('../src/matrix/saved-session.ts');
const own = '@tecno:example.org', ipad = '@ipad:example.org', computer = '@computer:example.org';
const room = { roomId: '!group:example.org', ipadUserId: ipad, computerUserId: computer };
const member = (id, membership) => ({ type: 'm.room.member', state_key: id, content: { membership } });

test('group requires three distinct accounts and exactly their joined membership', () => {
  assert.deepEqual(groupParticipants(own, ipad, computer), { ipadUserId: ipad, computerUserId: computer });
  assert.throws(() => groupParticipants(own, ipad, ipad), /третий отдельный/);
  assert.throws(() => groupParticipants(own, ipad, own), /отдельный аккаунт/);
  assert.doesNotThrow(() => assertGroupMembers({ chunk: [member(own, 'join'), member(ipad, 'join'), member(computer, 'join')] }, own, room));
});

test('group stops before audio on missing participant or extra invite/member', () => {
  assert.throws(() => assertGroupMembers({ chunk: [member(own, 'join'), member(ipad, 'join'), member(computer, 'invite')] }, own, room), /Ожидаем/);
  assert.throws(() => assertGroupMembers({ chunk: [member(own, 'join'), member(ipad, 'join'), member(computer, 'join'), member('@extra:example.org', 'invite')] }, own, room), /постороннее приглашение/);
  assert.throws(() => assertGroupMembers({ chunk: [member(own, 'join'), member(ipad, 'join'), member(computer, 'join'), member('@extra:example.org', 'join')] }, own, room), /посторонний аккаунт/);
  assert.throws(() => assertGroupMembers({ chunk: [member(own, 'join'), member(ipad, 'join'), member(computer, 'join'), member('@extra:example.org', 'leave')] }, own, room), /посторонний аккаунт/);
});

test('group room survives saved-session updates but rejects changed accounts or scope', async () => {
  const session = { version: 1, id: 'a'.repeat(32), passphrase: 'b'.repeat(64), roomIds: {},
    session: { accessToken: 'test', userId: own, deviceId: 'TECNO', homeserverUrl: 'https://example.org', slidingSyncVersion: 1 },
    peerRoom: { roomId: '!peer:example.org', peerUserId: ipad } };
  let saved = '';
  const storage = new SerializedSessionStorage({ async read() { return saved; }, async write(value) { saved = value; }, async erase() { saved = ''; } });
  const vault = new SessionVaultCore(session, structuredClone(session), storage, async () => {});
  vault.saveGroupRoom(room);
  await vault.flush();
  vault.saveSessionInKeychain(session.session);
  await vault.flush();
  assert.deepEqual(parseSavedSession(saved).groupRoom, room);
  for (const changed of [{ ...room, ipadUserId: computer }, { ...room, computerUserId: own },
    { ...room, roomId: '!peer:example.org' }]) {
    assert.throws(() => parseSavedSession(JSON.stringify({ ...session, groupRoom: changed })));
  }
  vault.savePeerRoom({ roomId: '!new-peer:example.org', peerUserId: '@other-ipad:example.org' });
  await vault.flush();
  assert.equal(parseSavedSession(saved).groupRoom, undefined);
});
