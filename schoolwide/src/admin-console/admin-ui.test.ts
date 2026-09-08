import assert from 'node:assert/strict';
import test from 'node:test';
import { adminConsoleHtml } from './ui.js';

test('SW-120 Admin browser exposes the specified school control-plane areas without destructive controls', () => {
  const html = adminConsoleHtml();
  for (const label of ['Staff & roles','Sections','Enrollments','Schedules','Calendar','Policies','Destinations','Student access','Sync review','Corrections & audit']) {
    assert.match(html, new RegExp(label.replace('&','&amp;|&')));
  }
  for (const route of [
    '/api/v1/admin/enrollments?limit=100',
    '/api/v1/admin/schedules',
    '/api/v1/admin/calendar/day',
    '/api/v1/admin/policies/',
    '/api/v1/admin/student-access',
    '/api/v1/admin/integrations/reviews/',
  ]) assert.ok(html.includes(route), `Missing Admin UI route ${route}`);
  assert.match(html,/private administrative reason/i);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/focus-visible/);
  assert.doesNotMatch(html,/method\s*:\s*['"]DELETE['"]/i);
  assert.doesNotMatch(html,/show\s+pin|credential\s+secret|unrestricted\s+lifetime/i);

  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'Admin shell must contain its browser script.');
  assert.doesNotThrow(() => new Function(script), 'Admin shell browser JavaScript must parse successfully.');
});
