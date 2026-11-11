import assert from 'node:assert/strict';
import test from 'node:test';
import { claimsReportFold, flipsReportFold } from './report-fold-gesture.ts';

test('open plate folds only on an upward drag', () => {
  assert.equal(claimsReportFold(false, 0, -12), true);
  assert.equal(claimsReportFold(false, 0, 12), false);
  assert.equal(claimsReportFold(false, 0, -4), false);
  assert.equal(flipsReportFold(false, 2, -30), true);
  assert.equal(flipsReportFold(false, 0, -20), false);
});

test('folded strip unfolds only on a downward drag', () => {
  assert.equal(claimsReportFold(true, 0, 12), true);
  assert.equal(claimsReportFold(true, 0, -12), false);
  assert.equal(flipsReportFold(true, 0, 30), true);
  assert.equal(flipsReportFold(true, 0, -30), false);
});

test('a sideways drag never flips the plate', () => {
  assert.equal(claimsReportFold(false, -40, -20), false);
  assert.equal(flipsReportFold(true, 50, 30), false);
});
