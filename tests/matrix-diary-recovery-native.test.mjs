import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.(ts|tsx|mjs|cjs|js|json)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
} });

const { restoreDiaryKeys } = await import('../src/matrix/diary-recovery-keys.ts');
const code = 'a'.repeat(48);

test('fresh SDK imports secrets with the saved code before room sync', async () => {
  const calls = [], stages = [];
  const encryption = {
    async backupExistsOnServer() { calls.push('backup'); return true; },
    recoveryState() { calls.push('state'); return calls.includes('recover') ? 1 : 2; },
    async recover(value) { calls.push('recover'); assert.equal(value, code); },
    async waitForE2eeInitializationTasks() { calls.push('init'); },
    uniffiDestroy() { calls.push('destroy'); },
    resetIdentity() { throw new Error('must not reset old identity'); },
    recoverAndFixBackup() { throw new Error('must not replace backup'); },
  };
  const client = { encryption() { calls.push('encryption'); return encryption; },
    syncService() { throw new Error('sync must not start before secret import'); } };
  await restoreDiaryKeys(client, code.match(/.{8}/g).join('-'), new AbortController().signal, stage => stages.push(stage));
  assert.deepEqual(calls, ['encryption', 'backup', 'state', 'recover', 'init', 'state', 'destroy']);
  assert.ok(stages.every(stage => !stage.includes(code)));
});

test('missing server backup blocks secret import without mutating identity', async () => {
  let recovered = false, destroyed = false;
  const client = { encryption() { return {
    async backupExistsOnServer() { return false; },
    async recover() { recovered = true; },
    uniffiDestroy() { destroyed = true; },
  }; } };
  await assert.rejects(restoreDiaryKeys(client, code, new AbortController().signal, () => {}), /копия ключей не найдена/);
  assert.equal(recovered, false);
  assert.equal(destroyed, true);
});
