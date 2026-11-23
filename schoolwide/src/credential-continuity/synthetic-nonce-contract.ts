/**
 * SW-182: compile-time-only nonce consumption contract for disconnected
 * experimental modules. Do not add executable code, imports, secret logic,
 * network access, or identity decisions to this shared definition.
 *
 * Never imported by production app or student-facing endpoints.
 */
export type SyntheticNonceConsumption = Readonly<{
  nonceDigest: string;
  expiresAtEpochSeconds: number;
  issuer: string;
  schoolId: string;
}>;
