import assert from 'node:assert/strict';
import test from 'node:test';
import { adminConsoleHtml } from '../admin-console/ui.js';
import { securityConsoleHtml } from '../security-console/ui.js';
import { teacherAppHtml } from '../teacher-app/ui.js';
import { injectRealtimeAcceleration } from './browser-acceleration.js';
import { AuthorizationError, type StaffPrincipal } from '../auth/types.js';
import { singleSchoolForCapability } from './routes.js';

const principal = (roles: StaffPrincipal['roleGrants']): StaffPrincipal => ({
  sessionId: 's', userId: 'u', organizationId: 'o', identityProvider: 'SYNTHETIC', identitySubject: 'sub', roleGrants: roles,
});

test('SW-130 browser realtime acceleration', async (t) => {
  await t.test('teacher uses authenticated fetch streaming while bounded polling remains authoritative fallback', () => {
    const html = injectRealtimeAcceleration('/teacher', teacherAppHtml());
    assert.match(html, /data-sw130-realtime/);
    assert.match(html, /authorization:'Bearer '\+auth/);
    assert.match(html, /\/api\/v1\/realtime\/teacher\/sections\//);
    assert.match(html, /schedulePoll/);
    assert.match(html, /bounded polling remains the authoritative fallback/);
    assert.match(html, /grantDeskRealtimeRefresh/);
    assert.match(html, /grantDeskRealtimeSection/);
    assert.doesNotMatch(html, /EventSource/);
  });

  await t.test('Security keeps five-second polling and gains server-resolved school stream', () => {
    const html = injectRealtimeAcceleration('/security', securityConsoleHtml());
    assert.match(html, /\/api\/v1\/realtime\/security\/events/);
    assert.match(html, /pollAfterMs=5000/);
    assert.match(html, /setTimeout\(refresh,pollAfterMs\)/);
    assert.match(html, /grantDeskRealtimeRefresh/);
    assert.doesNotMatch(html, /EventSource/);
  });

  await t.test('Admin refresh is focus-safe and uses server-resolved school stream', () => {
    const html = injectRealtimeAcceleration('/admin', adminConsoleHtml());
    assert.match(html, /\/api\/v1\/realtime\/admin\/events/);
    assert.match(html, /focusBusy/);
    assert.match(html, /dialog\[open\]/);
    assert.match(html, /grantDeskRealtimeRefresh/);
    assert.doesNotMatch(html, /EventSource/);
  });

  await t.test('unrelated HTML is unchanged', () => {
    assert.equal(injectRealtimeAcceleration('/unrelated', '<html><body>x</body></html>'), '<html><body>x</body></html>');
  });

  await t.test('single-school resolver fails closed for zero or multiple eligible schools', () => {
    assert.equal(singleSchoolForCapability(principal([{ schoolId: 'a', role: 'SECURITY' }]), 'security.live.read'), 'a');
    assert.throws(() => singleSchoolForCapability(principal([],), 'security.live.read'), AuthorizationError);
    assert.throws(() => singleSchoolForCapability(principal([{ schoolId: 'a', role: 'SECURITY' }, { schoolId: 'b', role: 'SECURITY' }]), 'security.live.read'), AuthorizationError);
  });
});
