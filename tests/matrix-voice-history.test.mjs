import assert from 'node:assert/strict';
import test from 'node:test';
import { voiceHistory } from '../src/matrix/voice-history.ts';

test('incoming and outgoing audio form a deterministic newest-first list without altering source histories', () => {
  const incoming = [{ eventId: '$i1', receivedAt: 3, durationMs: 3000 }, { eventId: '$i2', receivedAt: 1, durationMs: 4000 }];
  const outgoing = [{ eventId: '$o1', receivedAt: 4, durationMs: 2000 }, { eventId: '$o2', receivedAt: 3, durationMs: 1000 }];
  const combined = voiceHistory(incoming, outgoing);
  assert.deepEqual(combined.map(item => [item.eventId, item.direction]), [['$o1', 'outgoing'], ['$i1', 'incoming'], ['$o2', 'outgoing'], ['$i2', 'incoming']]);
  combined[0].eventId = '$changed'; assert.equal(outgoing[0].eventId, '$o1');
  assert.equal(voiceHistory(incoming, []).length, 2); assert.equal(voiceHistory([], outgoing).length, 2);
});
