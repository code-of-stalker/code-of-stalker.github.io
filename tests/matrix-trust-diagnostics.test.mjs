import assert from 'node:assert/strict';
import test from 'node:test';
import { TrustDiagnosticsTracker, connectionSummary, formatTrustDiagnostics } from '../src/matrix/trust-diagnostics.ts';

const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

test('pending trust diagnostics contain separate SDK flags, without IDs or native data', () => {
  const reports = [];
  const tracker = new TrustDiagnosticsTracker('peer', async () => {}, (r) => reports.push(r));
  tracker.recordTrust({ deviceId: 'PRIVATE-DEVICE', deviceState: 'verified',
    ownIdentity: { userId: '@private-own:example.org', present: true, verified: true, violation: false },
    peerIdentity: { userId: '@private-peer:example.org', present: true, verified: false, violation: false } });
  reports.at(-1).trust.peer = 'verified';
  tracker.record('trust_pending');
  tracker.finish('pending');
  const report = reports.at(-1);
  assert.equal(report.trust.peer, 'unverified'); assert.equal(report.outcome, 'pending');
  assert.match(formatTrustDiagnostics(report), /Tecno — подтверждён; первый аккаунт — подтверждён; iPad — не подтверждён/);
  assert.doesNotMatch(JSON.stringify(reports), /PRIVATE-DEVICE|@private/);
});

test('records native events separately from a successful server response, without profile or secrets', async () => {
  const reports = [];
  const tracker = new TrustDiagnosticsTracker('peer', async () => ({ password: 'never-display', userId: '@private:example.org' }), (r) => reports.push(r));
  tracker.record('approval_started');
  tracker.record('approval_returned');
  tracker.startConnectionChecks();
  await tick();
  tracker.finish('interrupted');
  const report = reports.at(-1);
  assert.equal(report.connection.state, 'answered');
  assert.equal(report.outcome, 'interrupted');
  assert.equal(report.events.some((item) => item.event === 'sdk_done'), false);
  const text = formatTrustDiagnostics(report);
  assert.match(text, /Tecno и iPad/);
  assert.match(text, /не доказывает доставку/);
  assert.doesNotMatch(JSON.stringify(reports), /never-display|@private|password/);
});

test('network exceptions become a fixed diagnostic state without publishing native error payloads', async () => {
  let latest;
  const tracker = new TrustDiagnosticsTracker('own', async () => { throw new Error('access_token=VERY_SECRET'); }, (r) => { latest = r; });
  tracker.startConnectionChecks();
  await tick();
  tracker.finish('failed');
  assert.equal(latest.connection.state, 'error');
  assert.doesNotMatch(JSON.stringify(latest), /VERY_SECRET|access_token/);
  assert.match(connectionSummary(latest), /ошибкой/);
});

test('an unresponsive native probe times out and its late result cannot become an answer', async () => {
  let complete;
  let signal;
  const reports = [];
  const tracker = new TrustDiagnosticsTracker('peer', async (s) => {
    signal = s;
    await new Promise((resolve) => { complete = resolve; });
  }, (r) => reports.push(r), { timeoutMs: 5, intervalMs: 1000 });
  tracker.startConnectionChecks();
  await tick(20);
  assert.equal(signal.aborted, true);
  assert.equal(reports.at(-1).connection.state, 'timeout');
  complete();
  await tick();
  assert.equal(reports.at(-1).connection.state, 'timeout');
  tracker.finish('failed');
});

test('finishing verification aborts a pending probe, cancels polling and ignores its late rejection', async () => {
  let reject;
  let signal;
  let calls = 0;
  const reports = [];
  const tracker = new TrustDiagnosticsTracker('peer', async (s) => {
    signal = s; calls++;
    await new Promise((_, no) => { reject = no; });
  }, (r) => reports.push(r), { timeoutMs: 100, intervalMs: 5 });
  tracker.startConnectionChecks(); tracker.startConnectionChecks();
  await tick(); tracker.finish('interrupted');
  const count = reports.length;
  assert.equal(signal.aborted, true);
  reject(new Error('late secret error'));
  await tick(20);
  tracker.record('sdk_done'); tracker.startConnectionChecks();
  assert.equal(calls, 1); assert.equal(reports.length, count);
  assert.equal(reports.at(-1).connection, null);
});

test('polling is sequential and snapshots cannot mutate the bounded journal', async () => {
  const reports = [];
  let calls = 0;
  let concurrent = 0;
  let maximum = 0;
  const tracker = new TrustDiagnosticsTracker('peer', async () => {
    calls++; concurrent++; maximum = Math.max(maximum, concurrent);
    await tick(6); concurrent--;
  }, (r) => reports.push(r), { timeoutMs: 100, intervalMs: 5 });
  reports[0].events[0].event = 'sdk_done';
  tracker.record('request_sent');
  assert.equal(reports.at(-1).events[0].event, 'started');
  for (let i = 0; i < 60; i++) tracker.record('sync_running');
  assert.equal(reports.at(-1).events.length, 40);
  tracker.startConnectionChecks();
  await tick(40); tracker.finish('failed');
  assert.ok(calls >= 2); assert.equal(maximum, 1);
});
