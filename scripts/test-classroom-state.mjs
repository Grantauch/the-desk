import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classroomState, currentUnitFor, calendarHighlightsFor } from '../src/data/classroom-state.ts';

test('changing the selected unit changes its calendar title with no second edit', () => {
  const state = structuredClone(classroomState);
  state['US History'].currentUnit = 'The Progressive Era';
  const available = ['The Gilded Age', 'The Progressive Era'];
  assert.equal(currentUnitFor('US History', available, state), 'The Progressive Era');
  assert.equal(calendarHighlightsFor(state).find(item => item.course === 'history').title, 'The Progressive Era');
  assert.equal(classroomState['US History'].currentUnit, 'The Gilded Age');
});
test('missing or duplicate course units fail clearly instead of hiding the current unit', () => {
  assert.throws(() => currentUnitFor('US History', ['Reconstruction']), /exactly once/);
  assert.throws(() => currentUnitFor('US History', ['The Gilded Age', 'The Gilded Age']), /exactly once/);
  const state = structuredClone(classroomState);
  state['US History'].currentUnit = '';
  assert.throws(() => calendarHighlightsFor(state), /missing a current unit/);
});
test('a later teaching month is supported and a misspelled month fails', () => {
  const state = structuredClone(classroomState);
  state['US History'].calendarHighlights[0].month = 'february';
  assert.equal(calendarHighlightsFor(state).find(item => item.course === 'history').month, 'february');
  state['US History'].calendarHighlights[0].month = 'febuary';
  assert.throws(() => calendarHighlightsFor(state), /invalid calendar/);
});
