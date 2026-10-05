import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { sasData } from '../src/matrix/sas-data.ts';
import { SerializedSessionStorage, SessionVaultCore } from '../src/matrix/saved-session.ts';
import { observeOperation } from '../src/matrix/operation-wait.ts';
import { trustConfirmed } from '../src/matrix/trust-status.ts';

const mockSdk = `export const VerificationState = { Unknown: 0, Verified: 1, Unverified: 2 };
export const SyncServiceState = { Error: 3, Offline: 4, Terminated: 2 };`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@unomed/react-native-matrix-sdk') return { url: 'data:text/javascript,' + encodeURIComponent(mockSdk), shortCircuit: true };
  if (specifier.startsWith('.') && !/\.(ts|tsx|mjs|cjs|js|json)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
} });
const { NativeTrustTest } = await import('../src/matrix/trust-test.native.ts');
const own = '@first:example.org', peer = '@second:example.org';
const peerRoom = { roomId: '!test-peer', peerUserId: peer };
const checkpoint = { roomId: '!self', eventId: '$self', deviceId: 'TECNO', bodySha256: 'c'.repeat(64), createdAt: 1 };
const saved = {
  version: 1, id: 'a'.repeat(32), passphrase: 'b'.repeat(64), roomIds: { encrypted: '!self' },
  session: { accessToken: 'test-only-token', userId: own, deviceId: 'TECNO', homeserverUrl: 'https://example.org', slidingSyncVersion: 1 },
  encryptedCheckpoint: checkpoint, peerRoom,
  peerReplyCheckpoint: { ...checkpoint, roomId: peerRoom.roomId, eventId: '$reply', senderUserId: peer },
};

function fixture(options = {}) {
  let stored = JSON.stringify(saved);
  const counts = { started: 0, stopped: 0, ownRequests: 0, peerRequests: 0, sasStarts: 0,
    approvals: 0, mismatches: 0, cancellations: 0, deleted: 0, writes: 0, emojiDestroyed: 0,
    subscriptions: [], timelines: [], members: [], releasedRooms: 0, verificationDestroyed: 0 };
  const backend = new SerializedSessionStorage({ async read() { return stored; },
    async write(value) { counts.writes++; if (options.writeError) throw new Error('test-only-token write failure'); stored = value; },
    async erase() { counts.deleted++; stored = null; } });
  const vault = new SessionVaultCore(saved, structuredClone(saved), backend, async () => { counts.deleted++; });
  const state = { ownVerified: !!options.ownVerified, peerVerified: !!options.peerVerified };
  let delegate;
  let syncObserver;
  let currentPeer = options.noPeerRoom ? null : peerRoom;
  const nativeData = options.data ?? { tag: 'Emojis', inner: { indices: new ArrayBuffer(7),
    emojis: ['🐶', '🐱', '🦁', '🐴', '🐷', '🐘', '🐰'].map((symbol, index) => ({
      symbol: () => symbol, description: () => `fixture emoji ${index + 1}`,
      uniffiDestroy() { counts.emojiDestroyed++; },
    })) } };
  function publishSas() {
    if (!delegate) return;
    if (options.finishWithoutComparison) { delegate.didFinish(); return; }
    delegate.didStartSasVerification();
    delegate.didReceiveVerificationData(nativeData);
  }
  function acceptRequest() {
    if (options.requestError) throw new Error('native request failed');
    if (options.remoteStarts) publishSas();
    delegate.didAcceptVerificationRequest();
    // Element X starts SAS after accepting our outgoing user request. Model
    // that later incoming native callback, not a JS start on the requester.
    if (counts.peerRequests && !options.remoteStarts && options.peerStarts !== false) setTimeout(publishSas, 0);
  }
  const verification = {
    setDelegate(next) { delegate = next; },
    async requestDeviceVerification() { counts.ownRequests++; acceptRequest(); },
    async requestUserVerification(id) { assert.equal(id, peer); counts.peerRequests++; acceptRequest(); },
    async startSasVerification() { counts.sasStarts++; publishSas(); },
    async approveVerification() {
      counts.approvals++;
      if (options.finishBeforeApprovalError) delegate.didFinish();
      if (options.approvalError) throw new Error('native approval failed');
      if (!options.untrustedAfterDone) { state.ownVerified = true; if (counts.peerRequests) state.peerVerified = true; }
      if (options.saveToken) {
        vault.saveSessionInKeychain({ ...saved.session, accessToken: 'refreshed-test-token' });
      }
      // The native done callback can arrive before the approval RPC resolves.
      const dmRoomId = options.dmRoomId ?? peerRoom.roomId;
      const roomEventsAvailable = !options.requireRoomEvents ||
        (counts.subscriptions.at(-1)?.includes(dmRoomId) && counts.timelines.includes(dmRoomId));
      if (!options.noDone && roomEventsAvailable) delegate.didFinish();
      if (options.doubleDone) delegate.didFinish();
    },
    async declineVerification() { counts.mismatches++; delegate.didCancel(); },
    async cancelVerification({ signal }) { assert.equal(signal.aborted, false); counts.cancellations++; },
    uniffiDestroy() { counts.verificationDestroyed++; },
  };
  const encryption = {
    async waitForE2eeInitializationTasks() {},
    async userIdentity(userId, fallback) {
      assert.equal(fallback, true);
      const isOwn = userId === own;
      if (isOwn ? options.missingOwnIdentity : options.missingPeerIdentity) return undefined;
      return { isVerified: () => isOwn ? state.ownVerified : state.peerVerified,
        hasVerificationViolation: () => !!(isOwn ? options.ownViolation : options.peerViolation), uniffiDestroy() {} };
    },
    async hasDevicesToVerifyAgainst() { return !options.noOtherDevice; },
    verificationState() { return options.unknownState ? 0 : state.ownVerified ? 1 : 2; },
    uniffiDestroy() {},
  };
  const sync = {
    roomListService() { return {
      async subscribeToRooms(ids) { if (options.subscriptionError) throw new Error('room subscription failed'); counts.subscriptions.push(ids); },
      uniffiDestroy() {},
    }; },
    state(observer) { syncObserver = observer; return { cancel() {}, uniffiDestroy() {} }; },
    async start() { counts.started++; },
    async stop() { counts.stopped++; options.afterStop?.(); if (options.stopError) throw new Error('native stop failed'); },
    uniffiDestroy() {},
  };
  const room = (id) => ({ id: () => id, uniffiDestroy() { counts.releasedRooms++; },
    async timeline() {
      counts.timelines.push(id);
      return { async fetchMembers() { counts.members.push(id); }, uniffiDestroy() {} };
    },
  });
  const builder = { withRoomListTimelineLimit() { return this; }, async finish() { return sync; }, uniffiDestroy() {} };
  const client = { userId: () => own, session: () => saved.session, encryption: () => encryption,
    async getProfile(id) { assert.equal(id, own); if (options.connectionError) throw new Error('secret-token: network failed'); return { userId: own }; },
    getDmRoom(id) { assert.equal(id, peer); return options.newDm && !counts.peerRequests ? undefined : room(options.dmRoomId ?? peerRoom.roomId); },
    async awaitRoomRemoteEcho(id) { return room(id); },
    syncService: () => builder, async getSessionVerificationController() { return verification; } };
  const probe = new NativeTrustTest(client, !options.noSync, vault, () => currentPeer,
    options.realStatusWait ? undefined : options.statusWait ?? { timeoutMs: 150, intervalMs: 5 });
  return { probe, counts, state, backend, vault, nativeData, verification, encryption, sync, publishSas,
    get delegate() { return delegate; },
    changePeer(value) { currentPeer = value; },
    disconnect() { syncObserver.onUpdate(4); } };
}

async function verifyWithDecision(f, target = 'own', matches = true, signal = new AbortController().signal) {
  let displayed;
  let response;
  const result = await f.probe.verify(target, signal, () => {}, (data) => {
    if (!data) return;
    displayed = data;
    response = f.probe.respond(matches);
    void response.catch(() => {});
  });
  await response;
  return { result, displayed };
}

test('projects seven real native emojis or three valid decimals, never arbitrary SDK fields', () => {
  const f = fixture();
  const value = sasData(f.nativeData, own);
  assert.equal(value.kind, 'emojis'); assert.equal(value.values.length, 7); assert.equal(value.userId, own);
  assert.deepEqual(value.values[0], { symbol: '🐶', description: 'fixture emoji 1' });
  assert.equal('indices' in value, false);
  assert.deepEqual(sasData({ tag: 'Decimals', inner: { values: [1000, 4321, 9191] } }, peer),
    { userId: peer, kind: 'decimals', values: [1000, 4321, 9191] });
  for (const data of [
    { tag: 'Emojis', inner: { emojis: f.nativeData.inner.emojis.slice(1) } },
    { tag: 'Decimals', inner: { values: [1000, 2000] } },
    { tag: 'Decimals', inner: { values: [999, 2000, 3000] } },
    { tag: 'Decimals', inner: { values: [1000, 9192, 3000] } },
    { tag: 'Decimals', inner: { values: [1000, 2000.5, 3000] } }, { tag: 'unsupported' },
  ]) assert.throws(() => sasData(data, own));
});

test('status inspection reads SDK flags without approving, sending verification or writing trust into saved session', async () => {
  const f = fixture();
  const before = await f.backend.read();
  const status = await f.probe.inspect(new AbortController().signal, () => {});
  assert.equal(status.deviceState, 'unverified'); assert.equal(status.ownIdentity.verified, false);
  assert.equal(status.peerIdentity.verified, false);
  assert.equal(f.counts.approvals, 0); assert.equal(f.counts.ownRequests, 0); assert.equal(f.counts.writes, 0);
  assert.equal(f.counts.stopped, 1); assert.equal(await f.backend.read(), before);
});

test('own SAS success requires human comparison, successful native approval, native done and verified SDK keys', async () => {
  const f = fixture({ doubleDone: true });
  const before = await f.backend.read();
  const { result, displayed } = await verifyWithDecision(f);
  assert.equal(result.target, 'own'); assert.equal(result.userId, own); assert.equal(result.sasCompared, true);
  assert.equal(result.status.deviceState, 'verified'); assert.equal(result.status.ownIdentity.verified, true);
  assert.equal(result.status.peerIdentity.verified, false);
  assert.equal(displayed.values.length, 7); assert.equal(f.counts.ownRequests, 1);
  assert.equal(f.counts.sasStarts, 1); assert.equal(f.counts.approvals, 1);
  assert.equal(f.counts.emojiDestroyed, 7); assert.equal(f.counts.stopped, 1);
  assert.equal(f.delegate, undefined); assert.equal(f.counts.deleted, 0); assert.equal(await f.backend.read(), before);
});

test('peer verification targets only the chosen distinct account after own device trust is established', async () => {
  const f = fixture({ ownVerified: true });
  const { result, displayed } = await verifyWithDecision(f, 'peer');
  assert.equal(result.userId, peer); assert.equal(displayed.userId, peer);
  assert.equal(result.status.peerIdentity.verified, true);
  assert.equal(f.counts.peerRequests, 1); assert.equal(f.counts.ownRequests, 0);
});

test('iPad completion needs the actual SDK DM subscription and a live decryption timeline', async () => {
  const f = fixture({ ownVerified: true, requireRoomEvents: true, dmRoomId: '!verification-dm' });
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 200);
  try {
    const { result } = await verifyWithDecision(f, 'peer', true, abort.signal);
    assert.equal(result.status.peerIdentity.verified, true);
    assert.ok(f.counts.subscriptions.at(-1).includes('!verification-dm'));
    assert.ok(f.counts.members.includes('!verification-dm'));
    assert.ok(f.counts.releasedRooms > 0);
  } finally { clearTimeout(timeout); }
});

test('a DM created by requestUserVerification is subscribed before final iPad confirmation', async () => {
  const f = fixture({ ownVerified: true, requireRoomEvents: true, newDm: true, dmRoomId: '!new-verification-dm' });
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 200);
  try {
    const pending = f.probe.verify('peer', abort.signal, () => {}, () => {});
    await new Promise((resolve) => setTimeout(resolve, 10));
    await f.probe.respond(true);
    const result = await pending;
    assert.equal(result.status.peerIdentity.verified, true);
    assert.ok(f.counts.subscriptions.at(-1).includes('!new-verification-dm'));
    assert.equal(f.counts.peerRequests, 1);
  } finally { clearTimeout(timeout); }
});

test('failed room subscription cannot send a verification request or lose saved keys', async () => {
  const f = fixture({ ownVerified: true, subscriptionError: true });
  const before = await f.backend.read();
  await assert.rejects(verifyWithDecision(f, 'peer'), /room subscription failed/);
  assert.equal(f.counts.peerRequests, 0); assert.equal(f.counts.approvals, 0);
  assert.equal(await f.backend.read(), before); assert.equal(f.counts.stopped, 1);
});

test('the screen only reports confirmation sent after the native approval resolves', async () => {
  const f = fixture({ ownVerified: true });
  const stages = [];
  let release;
  const approve = f.verification.approveVerification;
  f.verification.approveVerification = async () => {
    await new Promise((resolve) => { release = resolve; });
    return approve();
  };
  const pending = f.probe.verify('peer', new AbortController().signal, (text) => stages.push(text), () => {});
  await new Promise((resolve) => setTimeout(resolve, 10));
  const response = f.probe.respond(true);
  await Promise.resolve();
  assert.match(stages.at(-1), /Отправляем подтверждение Tecno/);
  release(); await response; await pending;
});

test('already verified peer is reported from SDK without claiming a new SAS comparison', async () => {
  const f = fixture({ ownVerified: true, peerVerified: true });
  const result = await f.probe.verify('peer', new AbortController().signal, () => {}, (data) => { if (data) throw new Error('unexpected comparison'); });
  assert.equal(result.sasCompared, false); assert.equal(result.status.peerIdentity.verified, true);
  assert.equal(f.counts.peerRequests, 0); assert.equal(f.counts.approvals, 0);
});

for (const scenario of [
  { name: 'missing own identity', options: { missingOwnIdentity: true }, target: 'own', error: /нет ключей подтверждения/ },
  { name: 'missing verified counterpart session', options: { noOtherDevice: true }, target: 'own', error: /Нет другой подтверждённой/ },
  { name: 'unverified own device before peer verification', options: {}, target: 'peer', error: /Сначала подтвердите сессию Tecno/ },
  { name: 'missing peer identity', options: { ownVerified: true, missingPeerIdentity: true }, target: 'peer', error: /не нашёл ключей/ },
  { name: 'changed own identity keys', options: { ownViolation: true }, target: 'own', error: /ключи аккаунта изменились/ },
  { name: 'changed peer identity keys', options: { ownVerified: true, peerViolation: true }, target: 'peer', error: /ключи аккаунта изменились/ },
  { name: 'missing peer room', options: { noPeerRoom: true }, target: 'peer', error: /создайте комнату/ },
  { name: 'no native sync', options: { noSync: true }, target: 'own', error: /native sliding sync/ },
]) test(`blocks unsafe or unprepared verification: ${scenario.name}`, async () => {
  const f = fixture(scenario.options);
  await assert.rejects(verifyWithDecision(f, scenario.target), scenario.error);
  assert.equal(f.counts.ownRequests, 0); assert.equal(f.counts.peerRequests, 0);
  assert.equal(f.counts.approvals, 0); assert.equal(f.counts.deleted, 0); assert.equal(f.counts.writes, 0);
});

test('mismatch calls native decline and never sets or persists verification success', async () => {
  const f = fixture();
  const before = await f.backend.read();
  await assert.rejects(verifyWithDecision(f, 'own', false), /не совпали/);
  assert.equal(f.counts.mismatches, 1); assert.equal(f.counts.approvals, 0);
  assert.equal(f.state.ownVerified, false); assert.equal(f.counts.cancellations, 1);
  assert.equal(f.counts.deleted, 0); assert.equal(await f.backend.read(), before);
});

test('native done without an explicit comparison cannot masquerade as human verification', async () => {
  const f = fixture({ finishWithoutComparison: true });
  await assert.rejects(verifyWithDecision(f), /без вашего сравнения/);
  assert.equal(f.counts.approvals, 0); assert.equal(f.counts.cancellations, 1);
});

test('a done callback before a failed approval RPC cannot produce success', async () => {
  const f = fixture({ approvalError: true, finishBeforeApprovalError: true });
  await assert.rejects(verifyWithDecision(f), /native approval failed/);
  assert.equal(f.counts.cancellations, 1); assert.equal(f.delegate, undefined);
});

test('a local confirmation alone cannot finish while remote done is missing', async () => {
  const f = fixture({ noDone: true });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20);
  try { await assert.rejects(verifyWithDecision(f, 'own', true, controller.signal), /Aborted/); }
  finally { clearTimeout(timer); }
  assert.equal(f.counts.approvals, 1); assert.equal(f.counts.cancellations, 1);
  assert.equal(f.counts.deleted, 0);
});

test('SAS done with unverified or unknown SDK trust cannot immediately report success', async () => {
  for (const unknownState of [false, true]) {
    const f = fixture({ untrustedAfterDone: true, unknownState });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20);
    try { await assert.rejects(verifyWithDecision(f, 'own', true, controller.signal), /Aborted/); }
    finally { clearTimeout(timer); }
    assert.equal(f.counts.cancellations, 0); assert.equal(f.counts.deleted, 0);
  }
});

test('SAS completion keeps sync alive until the later peer signature becomes trusted', async () => {
  const f = fixture({ ownVerified: true, untrustedAfterDone: true });
  const read = f.encryption.userIdentity;
  let readsAfterDone = 0;
  f.encryption.userIdentity = async (id, fallback) => {
    if (id === peer && f.counts.approvals) {
      assert.equal(f.counts.stopped, 0);
      if (++readsAfterDone === 4) f.state.peerVerified = true;
    }
    return read(id, fallback);
  };
  const { result } = await verifyWithDecision(f, 'peer');
  assert.equal(result.outcome, 'verified'); assert.equal(result.status.peerIdentity.verified, true);
  assert.equal(readsAfterDone, 4); assert.equal(f.counts.approvals, 1);
  assert.equal(f.counts.cancellations, 0); assert.equal(f.counts.stopped, 1);
});

test('production wait survives a 30-second sync poll and accepts trust arriving after 35 seconds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture({ ownVerified: true, untrustedAfterDone: true, realStatusWait: true });
  const abort = new AbortController();
  let outcome;
  const pending = verifyWithDecision(f, 'peer', true, abort.signal).then(
    (value) => { outcome = value; }, (error) => { outcome = error; });
  const advance = async (ms) => {
    t.mock.timers.tick(ms);
    await new Promise((resolve) => setImmediate(resolve));
  };
  try {
    await advance(0); await advance(0); await advance(0);
    assert.equal(f.counts.approvals, 1);
    for (let i = 0; i < 35; i++) await advance(1000);
    assert.equal(outcome, undefined); assert.equal(f.counts.stopped, 0);
    f.state.peerVerified = true;
    await advance(1000); await advance(0);
    await pending;
    assert.equal(outcome.result.outcome, 'verified');
    assert.equal(f.counts.peerRequests, 1); assert.equal(f.counts.stopped, 1);
  } finally {
    abort.abort(); await advance(0); await advance(0); await pending;
    t.mock.timers.reset();
  }
});

test('completed SAS without peer trust returns a pending snapshot, never success or a new cancellation', async () => {
  const f = fixture({ ownVerified: true, untrustedAfterDone: true });
  const reports = [];
  const before = await f.backend.read();
  const result = await f.probe.verify('peer', new AbortController().signal, () => {}, (data) => {
    if (data) void f.probe.respond(true);
  }, (report) => reports.push(report));
  assert.equal(result.outcome, 'pending'); assert.equal(result.sasCompared, true);
  assert.equal(result.status.ownIdentity.verified, true); assert.equal(result.status.peerIdentity.verified, false);
  assert.equal(reports.at(-1).outcome, 'pending');
  assert.equal(reports.at(-1).trust.peer, 'unverified');
  assert.equal(reports.at(-1).events.some(({ event }) => event === 'trust_confirmed'), false);
  assert.equal(f.counts.cancellations, 0); assert.equal(f.counts.stopped, 1);
  assert.equal(await f.backend.read(), before);
});

test('status recheck receives delayed peer trust without sending a second verification request', async () => {
  const f = fixture({ ownVerified: true });
  const read = f.encryption.userIdentity;
  let reads = 0;
  f.encryption.userIdentity = async (id, fallback) => {
    if (id === peer && ++reads === 4) f.state.peerVerified = true;
    return read(id, fallback);
  };
  const status = await f.probe.inspect(new AbortController().signal, () => {});
  assert.equal(status.peerIdentity.verified, true); assert.equal(reads, 4);
  assert.equal(f.counts.peerRequests, 0); assert.equal(f.counts.approvals, 0);
  assert.equal(f.counts.cancellations, 0); assert.equal(f.counts.writes, 0);
});

test('changed trusted keys after SAS remain an error, not a pending or verified report', async () => {
  const options = { ownVerified: true, untrustedAfterDone: true };
  const f = fixture(options);
  const read = f.encryption.userIdentity;
  f.encryption.userIdentity = async (id, fallback) => {
    if (id === peer && f.counts.approvals) options.peerViolation = true;
    return read(id, fallback);
  };
  await assert.rejects(verifyWithDecision(f, 'peer'), /изменении ранее подтверждённых ключей/);
  assert.equal(f.counts.cancellations, 0); assert.equal(f.counts.stopped, 1);
});

test('trust criteria reject missing identities, wrong targets and violations even if verified is true', () => {
  const identity = (userId) => ({ userId, present: true, verified: true, violation: false });
  const valid = { deviceId: 'TECNO', deviceState: 'verified', ownIdentity: identity(own), peerIdentity: identity(peer) };
  assert.equal(trustConfirmed(valid, 'peer', peer), true);
  assert.equal(trustConfirmed(valid, 'peer', own), false);
  assert.equal(trustConfirmed(valid, 'own', peer), false);
  for (const field of ['ownIdentity', 'peerIdentity']) {
    for (const change of [{ present: false }, { verified: false }, { violation: true }]) {
      assert.equal(trustConfirmed({ ...valid, [field]: { ...valid[field], ...change } }, 'peer', peer), false);
    }
  }
});

test('malformed comparison data fails before approval and frees native emoji handles', async () => {
  const f = fixture();
  f.nativeData.inner.emojis.pop();
  await assert.rejects(verifyWithDecision(f), /неполный набор/);
  assert.equal(f.counts.approvals, 0); assert.equal(f.counts.emojiDestroyed, 6);
});

test('cancellation and disconnection reject outstanding SAS, detach callbacks and preserve saved keys', async () => {
  for (const disconnected of [false, true]) {
    const f = fixture();
    const controller = new AbortController();
    const before = await f.backend.read();
    await assert.rejects(f.probe.verify('own', controller.signal, () => {}, (data) => {
      if (data) queueMicrotask(() => disconnected ? f.disconnect() : controller.abort());
    }), disconnected ? /Связь с Matrix/ : /Aborted/);
    assert.equal(f.delegate, undefined); assert.equal(f.counts.stopped, 1);
    assert.equal(f.counts.approvals, 0); assert.equal(f.counts.deleted, 0);
    assert.equal(await f.backend.read(), before);
  }
});

test('token refresh during verification preserves both old encrypted checkpoints and store identity', async () => {
  const f = fixture({ saveToken: true });
  await verifyWithDecision(f);
  const after = JSON.parse(await f.backend.read());
  assert.equal(after.session.accessToken, 'refreshed-test-token');
  assert.deepEqual(after.encryptedCheckpoint, saved.encryptedCheckpoint);
  assert.deepEqual(after.peerReplyCheckpoint, saved.peerReplyCheckpoint);
  assert.equal(after.passphrase, saved.passphrase); assert.equal(after.id, saved.id);
  assert.equal('verified' in after, false); assert.equal(f.counts.deleted, 0);
});

test('failed token persistence after SAS preserves old login and cannot produce a successful report', async () => {
  const f = fixture({ saveToken: true, writeError: true });
  const before = await f.backend.read();
  await assert.rejects(verifyWithDecision(f), /Не удалось сохранить/);
  assert.equal(await f.backend.read(), before); assert.equal(f.counts.deleted, 0);
});

test('a failed request retains its error if stopping sync also fails', async () => {
  const f = fixture({ requestError: true, stopError: true });
  await assert.rejects(verifyWithDecision(f), /native request failed/);
  assert.equal(f.counts.stopped, 1); assert.equal(f.delegate, undefined);
});

test('no comparison or duplicate tap can call native approve, and late callbacks after completion are ignored', async () => {
  const f = fixture();
  await assert.rejects(f.probe.respond(true), /Нет активного/);
  let duplicate;
  let oldDelegate;
  const result = await f.probe.verify('own', new AbortController().signal, () => {}, (data) => {
    if (data) {
      oldDelegate = f.delegate;
      void f.probe.respond(true).catch(() => {});
      duplicate = assert.rejects(f.probe.respond(true), /Нет активного/);
    }
  });
  await duplicate;
  oldDelegate.didFinish();
  assert.equal(result.sasCompared, true); assert.equal(f.counts.approvals, 1);
  await assert.rejects(f.probe.respond(true), /Нет активного/);
});

test('remote SAS start before ready does not start a second native flow', async () => {
  const f = fixture({ remoteStarts: true });
  const { result } = await verifyWithDecision(f);
  assert.equal(result.sasCompared, true); assert.equal(f.counts.sasStarts, 0); assert.equal(f.counts.approvals, 1);
});

test('own verification works independently of the second-account room', async () => {
  const f = fixture({ noPeerRoom: true });
  const { result } = await verifyWithDecision(f);
  assert.equal(result.status.peerIdentity, null); assert.equal(result.status.deviceState, 'verified');
});

test('cancellation during sync cleanup cannot publish a successful verification report', async () => {
  const controller = new AbortController();
  const f = fixture({ afterStop: () => controller.abort() });
  await assert.rejects(verifyWithDecision(f, 'own', true, controller.signal), /Aborted/);
  assert.equal(f.counts.stopped, 1); assert.equal(f.counts.deleted, 0);
});

test('a reachable server cannot turn a stalled peer handshake into verification success', async () => {
  const f = fixture({ ownVerified: true, noDone: true });
  const abort = new AbortController();
  const reports = [];
  const timer = setTimeout(() => abort.abort(), 30);
  try {
    await assert.rejects(f.probe.verify('peer', abort.signal, () => {}, (data) => {
      if (data) void f.probe.respond(true).catch(() => {});
    }, (report) => reports.push(report)), /Aborted/);
    assert.ok(reports.some((report) => report.connection?.state === 'answered'));
    const last = reports.at(-1);
    assert.equal(last.outcome, 'interrupted');
    assert.ok(last.events.some((item) => item.event === 'approval_returned'));
    assert.equal(last.events.some((item) => item.event === 'sdk_done'), false);
    assert.equal(JSON.stringify(last).includes('test-only-token'), false);
    assert.equal(f.counts.deleted, 0);
  } finally { clearTimeout(timer); }
});

test('a failed connectivity sample does not fail a valid SAS exchange or expose errors', async () => {
  const f = fixture({ ownVerified: true, connectionError: true });
  const reports = [];
  const result = await f.probe.verify('peer', new AbortController().signal, () => {}, (data) => {
    if (data) void f.probe.respond(true).catch(() => {});
  }, (report) => reports.push(report));
  assert.equal(result.sasCompared, true);
  assert.equal(reports.at(-1).outcome, 'success');
  assert.equal(JSON.stringify(reports).includes('secret-token'), false);
});

async function eventually(check) {
  const deadline = Date.now() + 1000;
  while (!check()) {
    if (Date.now() > deadline) assert.fail('Expected native stage was not reached');
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

for (const blockedStage of ['approval', 'cancel', 'sync-stop']) {
  test(`screen cancellation remains responsive while native ${blockedStage} ignores abort`, async () => {
    const f = fixture({ ownVerified: true, noDone: true });
    const before = await f.backend.read();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let entered = false;
    const hold = async () => { entered = true; await gate; };
    if (blockedStage === 'approval') f.verification.approveVerification = hold;
    if (blockedStage === 'cancel') f.verification.cancelVerification = hold;
    if (blockedStage === 'sync-stop') f.sync.stop = hold;
    const abort = new AbortController();
    const reports = [];
    let shown = false;
    const raw = f.probe.verify('peer', abort.signal, () => {}, (data) => { shown ||= !!data; }, (r) => reports.push(r));
    const watched = observeOperation(raw, abort.signal);
    try {
      await eventually(() => shown);
      if (blockedStage === 'approval') {
        void f.probe.respond(true).catch(() => {});
        await eventually(() => entered);
      }
      abort.abort();
      await assert.rejects(watched.result, /Aborted/);
      await eventually(() => entered);
      assert.equal(watched.isPending(), true, 'native task must retain ownership while cleanup is pending');
      assert.equal(f.counts.releasedRooms, 0, 'live room handles must not be destroyed early');
      if (blockedStage !== 'sync-stop') assert.equal(f.counts.verificationDestroyed, 0);
      assert.ok(reports.some((r) => r.events.some((e) => e.event === 'wait_stopped')));
      await assert.rejects(f.probe.inspect(new AbortController().signal, () => {}), /Другая проверка/);
      assert.equal(f.counts.deleted, 0); assert.equal(await f.backend.read(), before);
    } finally {
      abort.abort(); release(); await watched.settled;
    }
    assert.equal(watched.isPending(), false);
    assert.equal(f.counts.verificationDestroyed, 1);
    assert.ok(f.counts.releasedRooms > 0);
    assert.equal(reports.at(-1).outcome, 'interrupted');
    assert.equal(reports.at(-1).events.some((e) => e.event === 'sdk_done'), false);
    await f.probe.inspect(new AbortController().signal, () => {});
  });
}

test('native delegate is detached in a later JS turn, outside the cancellation callback lock', async () => {
  const f = fixture({ noDone: true });
  let callbackLockHeld = false;
  const setDelegate = f.verification.setDelegate;
  f.verification.setDelegate = (delegate) => {
    if (!delegate) assert.equal(callbackLockHeld, false, 'setDelegate must not take a write lock inside the native read callback');
    setDelegate(delegate);
  };
  const abort = new AbortController();
  const result = f.probe.verify('own', abort.signal, () => {}, () => {});
  await eventually(() => f.delegate && f.counts.sasStarts === 1);
  callbackLockHeld = true;
  f.delegate.didCancel();
  setTimeout(() => { callbackLockHeld = false; }, 0);
  await assert.rejects(result, /SDK сообщил об отмене/);
  assert.equal(f.delegate, undefined);
  assert.equal(f.counts.verificationDestroyed, 1);
});

test('outgoing iPad verification lets Element X start SAS without a competing local start', async () => {
  const f = fixture({ ownVerified: true });
  const { result } = await verifyWithDecision(f, 'peer');
  assert.equal(result.sasCompared, true);
  assert.equal(f.counts.peerRequests, 1);
  assert.equal(f.counts.sasStarts, 0, 'the outgoing request must not also start SAS on Tecno');
  assert.equal(f.counts.approvals, 1);
});

test('repeated ready callbacks wait for iPad; only its later SAS data can be compared', async () => {
  const f = fixture({ ownVerified: true, peerStarts: false });
  const abort = new AbortController();
  const displayed = [];
  const reports = [];
  const pending = f.probe.verify('peer', abort.signal, () => {}, (data) => { if (data) displayed.push(data); }, (r) => reports.push(r));
  void pending.catch(() => {});
  try {
    await eventually(() => f.counts.peerRequests === 1);
    f.delegate.didAcceptVerificationRequest(); f.delegate.didAcceptVerificationRequest();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(f.counts.sasStarts, 0);
    assert.equal(displayed.length, 0);
    await assert.rejects(f.probe.respond(true), /Нет активного сравнения/);
    f.publishSas();
    assert.equal(displayed.length, 1);
    await f.probe.respond(true);
    assert.equal((await pending).status.peerIdentity.verified, true);
    assert.equal(reports.at(-1).events.filter((e) => e.event === 'sas_waiting_peer').length, 1);
    assert.equal(reports.at(-1).events.some((e) => e.event === 'sas_requested'), false);
  } finally { abort.abort(); await pending.catch(() => {}); }
});

test('if iPad never starts SAS, cancellation sends no fallback start and preserves saved trust/session', async () => {
  const f = fixture({ ownVerified: true, peerStarts: false });
  const before = await f.backend.read();
  const abort = new AbortController();
  let displayed = false;
  const pending = f.probe.verify('peer', abort.signal, () => {}, (data) => { displayed ||= !!data; });
  void pending.catch(() => {});
  try {
    await eventually(() => f.counts.peerRequests === 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(displayed, false);
    assert.equal(f.counts.sasStarts, 0);
  } finally { abort.abort(); await assert.rejects(pending, /Aborted/); }
  assert.equal(f.counts.approvals, 0);
  assert.equal(f.state.peerVerified, false);
  assert.equal(f.counts.deleted, 0); assert.equal(await f.backend.read(), before);
});

test('an iPad SAS start arriving before ready is accepted without a second local start', async () => {
  const f = fixture({ ownVerified: true, remoteStarts: true });
  const { result } = await verifyWithDecision(f, 'peer');
  assert.equal(result.status.peerIdentity.verified, true);
  assert.equal(f.counts.sasStarts, 0);
});
