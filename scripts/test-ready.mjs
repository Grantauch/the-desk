import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleReadySnapshot, summarizeReadySnapshot, validateReadySnapshot } from '../src/lib/ready-engine.ts';

test('a blocking check makes the whole snapshot BLOCKED', () => {
  const snapshot = validateReadySnapshot(sampleReadySnapshot);
  const summary = summarizeReadySnapshot(snapshot);
  assert.equal(summary.status, 'BLOCKED');
  assert.equal(summary.block, 1);
  assert.equal(summary.warning, 1);
});

test('warnings without blocks produce NEEDS_ATTENTION', () => {
  const snapshot = structuredClone(sampleReadySnapshot);
  snapshot.courses[0].checks[1].status = 'pass';
  const summary = summarizeReadySnapshot(validateReadySnapshot(snapshot));
  assert.equal(summary.status, 'NEEDS_ATTENTION');
});

test('all passing checks produce READY', () => {
  const snapshot = structuredClone(sampleReadySnapshot);
  for (const course of snapshot.courses) {
    for (const check of course.checks) check.status = 'pass';
  }
  const summary = summarizeReadySnapshot(validateReadySnapshot(snapshot));
  assert.equal(summary.status, 'READY');
});

test('invalid or duplicate check data fails closed', () => {
  const invalid = structuredClone(sampleReadySnapshot);
  invalid.courses[0].checks[1].id = invalid.courses[0].checks[0].id;
  assert.throws(() => validateReadySnapshot(invalid), /duplicate check IDs/);

  const wrongSchema = { ...sampleReadySnapshot, schemaVersion: 2 };
  assert.throws(() => validateReadySnapshot(wrongSchema), /schemaVersion must be 1/);
});
