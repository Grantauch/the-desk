import { StudentCredentialError, type StudentIdentityProvider, type VerifiedStudentIdentity } from './types.js';

export class DisabledStudentIdentityProvider implements StudentIdentityProvider {
  async verify(_assertion: string): Promise<VerifiedStudentIdentity> {
    throw new StudentCredentialError(
      'STUDENT_AUTH_REQUIRED',
      'Student identity provider is not configured.',
      401,
    );
  }
}
