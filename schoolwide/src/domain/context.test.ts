import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthorizationError, assertSchoolScope, requireAnyRole, type SchoolPrincipal } from './context.js';

const principal: SchoolPrincipal = {
  principalId: 'staff-fixture',
  schoolId: '11111111-1111-4111-8111-111111111111',
  roles: ['TEACHER'],
};

test('teacher principal may remain inside its school scope', () => {
  assert.doesNotThrow(() => assertSchoolScope(principal, principal.schoolId));
});

test('teacher principal cannot cross school scope by changing an id', () => {
  assert.throws(
    () => assertSchoolScope(principal, '22222222-2222-4222-8222-222222222222'),
    AuthorizationError,
  );
});

test('role gate denies capabilities the principal does not have', () => {
  assert.throws(() => requireAnyRole(principal, ['ADMIN', 'SECURITY']), AuthorizationError);
});
