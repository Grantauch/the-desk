import { AuthenticationError, type StaffIdentityProvider, type VerifiedStaffIdentity } from './types.js';

export class DisabledStaffIdentityProvider implements StaffIdentityProvider {
  async verify(_assertion: string): Promise<VerifiedStaffIdentity> {
    throw new AuthenticationError('Staff identity provider is not configured.');
  }
}
