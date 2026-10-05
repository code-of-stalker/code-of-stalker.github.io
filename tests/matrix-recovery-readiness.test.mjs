import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.(ts|tsx|mjs|cjs|js|json)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
} });

const { recoveryReadiness } = await import('../src/matrix/recovery-readiness-model.ts');
const { enableDiaryRecovery, inspectRecoveryReadiness } = await import('../src/matrix/recovery-readiness.native.ts');

test('an unknown local backup state does not erase evidence of a server backup', () => {
  assert.deepEqual(recoveryReadiness(true, 0, 2), {
    serverBackupExists: true, backupState: 'unknown', recoveryState: 'disabled',
  });
  assert.deepEqual(recoveryReadiness(false, 4, 1), {
    serverBackupExists: false, backupState: 'ready', recoveryState: 'ready',
  });
});

test('preflight calls only read-only native methods and releases the handle', async () => {
  const calls = [];
  const encryption = {
    async waitForE2eeInitializationTasks() { calls.push('initialize'); },
    backupState() { calls.push('backupState'); return 4; },
    recoveryState() { calls.push('recoveryState'); return 1; },
    async backupExistsOnServer() { calls.push('server'); return true; },
    uniffiDestroy() { calls.push('destroy'); },
    enableRecovery() { throw new Error('must not change keys'); },
  };
  const client = { encryption() { calls.push('encryption'); return encryption; } };
  const stages = [];
  assert.deepEqual(await inspectRecoveryReadiness(client, new AbortController().signal, stage => stages.push(stage)), {
    serverBackupExists: true, backupState: 'ready', recoveryState: 'ready',
  });
  assert.deepEqual(calls, ['encryption', 'initialize', 'backupState', 'recoveryState', 'server', 'destroy']);
  assert.equal(stages.length, 2);
});

test('a native error is hidden and the native handle is released', async () => {
  let destroyed = false;
  const client = { encryption() { return {
    async waitForE2eeInitializationTasks() {},
    backupState() { return 0; }, recoveryState() { return 0; },
    async backupExistsOnServer() { throw new Error('sensitive native detail'); },
    uniffiDestroy() { destroyed = true; },
  }; } };
  await assert.rejects(inspectRecoveryReadiness(client, new AbortController().signal, () => {}),
    error => !String(error).includes('sensitive native detail') && /Не удалось прочитать/.test(String(error)));
  assert.equal(destroyed, true);
});

test('enabling recovery rechecks the connected backup and never exposes the SDK key in stages', async () => {
  const calls = [], stages = [], code = 'a'.repeat(48);
  const encryption = {
    async waitForE2eeInitializationTasks() { calls.push('initialize'); },
    async backupExistsOnServer() { calls.push('server'); return true; },
    backupState() { calls.push('backupState'); return 4; },
    recoveryState() { calls.push('recoveryState'); return calls.includes('enable') ? 1 : 2; },
    async enableRecovery(wait, passphrase, listener) {
      calls.push('enable');
      assert.equal(wait, true);
      assert.equal(passphrase, code);
      listener.onUpdate({ tag: 'Done', inner: { recoveryKey: 'native-secret' } });
      return 'native-secret';
    },
    uniffiDestroy() { calls.push('destroy'); },
    enableBackups() { throw new Error('must not create a replacement backup'); },
    resetIdentity() { throw new Error('must not reset identity'); },
  };
  const client = { encryption() { return encryption; } };
  assert.deepEqual(await enableDiaryRecovery(client, code, new AbortController().signal, stage => stages.push(stage)), {
    serverBackupExists: true, backupState: 'ready', recoveryState: 'ready',
  });
  assert.ok(calls.indexOf('server') < calls.indexOf('enable'));
  assert.equal(calls.at(-1), 'destroy');
  assert.ok(stages.every(stage => !stage.includes('native-secret') && !stage.includes(code)));
});

test('recovery stays untouched when the connected backup cannot be confirmed', async () => {
  let enabled = false, destroyed = false;
  const client = { encryption() { return {
    async waitForE2eeInitializationTasks() {},
    async backupExistsOnServer() { return true; },
    backupState() { return 0; }, recoveryState() { return 2; },
    async enableRecovery() { enabled = true; },
    uniffiDestroy() { destroyed = true; },
  }; } };
  await assert.rejects(enableDiaryRecovery(client, 'b'.repeat(48), new AbortController().signal, () => {}), /Состояние ключей изменилось/);
  assert.equal(enabled, false);
  assert.equal(destroyed, true);
});
