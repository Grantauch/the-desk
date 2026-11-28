ALTER TABLE migration_import_runs
  ADD CONSTRAINT migration_import_runs_org_school_id_unique
  UNIQUE (organization_id, school_id, id);

CREATE TABLE migration_credential_continuity_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  shadow_import_run_id uuid NOT NULL,
  source_snapshot_fingerprint text NOT NULL
    CHECK (source_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('PASS','REVIEW','FAIL')),
  preserve_count integer NOT NULL DEFAULT 0 CHECK (preserve_count >= 0),
  provision_required_count integer NOT NULL DEFAULT 0 CHECK (provision_required_count >= 0),
  blocked_count integer NOT NULL DEFAULT 0 CHECK (blocked_count >= 0),
  artifact_digest text NOT NULL CHECK (artifact_digest ~ '^[0-9a-f]{64}$'),
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, created_by_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, school_id, shadow_import_run_id)
    REFERENCES migration_import_runs(organization_id, school_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, shadow_import_run_id),
  UNIQUE (school_id, artifact_digest)
);

CREATE TABLE migration_credential_continuity_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  continuity_run_id uuid NOT NULL REFERENCES migration_credential_continuity_runs(id) ON DELETE RESTRICT,
  identity_key_hash text NOT NULL CHECK (identity_key_hash ~ '^[0-9a-f]{64}$'),
  student_id uuid,
  legacy_credential_present boolean,
  schoolwide_credential_present boolean NOT NULL,
  schoolwide_credential_version integer CHECK (schoolwide_credential_version IS NULL OR schoolwide_credential_version > 0),
  schoolwide_verifier_scheme text CHECK (schoolwide_verifier_scheme IS NULL OR schoolwide_verifier_scheme IN ('SCRYPT_PEPPER_V1','LEGACY_SHA256_SALT_V1')),
  continuity_action text NOT NULL CHECK (continuity_action IN ('PRESERVE','PROVISION_REQUIRED','BLOCKED')),
  rollback_action text NOT NULL CHECK (rollback_action IN ('RECONCILE_LEGACY_AUTHORITY','NO_LEGACY_CREDENTIAL_OBSERVED','REVIEW_REQUIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  UNIQUE (continuity_run_id, identity_key_hash),
  CHECK (
    (schoolwide_credential_present = true AND student_id IS NOT NULL AND schoolwide_credential_version IS NOT NULL AND schoolwide_verifier_scheme IS NOT NULL)
    OR
    (schoolwide_credential_present = false AND schoolwide_credential_version IS NULL AND schoolwide_verifier_scheme IS NULL)
  ),
  CHECK ((continuity_action = 'BLOCKED') OR student_id IS NOT NULL)
);

CREATE TABLE migration_recovery_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  continuity_run_id uuid NOT NULL UNIQUE REFERENCES migration_credential_continuity_runs(id) ON DELETE RESTRICT,
  source_snapshot_fingerprint text NOT NULL CHECK (source_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  artifact_digest text NOT NULL CHECK (artifact_digest ~ '^[0-9a-f]{64}$'),
  artifact_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, artifact_digest)
);

CREATE INDEX migration_credential_continuity_school_time_idx
  ON migration_credential_continuity_runs (school_id, created_at DESC, id);
CREATE INDEX migration_credential_continuity_records_run_idx
  ON migration_credential_continuity_records (continuity_run_id, continuity_action, identity_key_hash);
CREATE INDEX migration_credential_continuity_records_student_idx
  ON migration_credential_continuity_records (school_id, student_id, continuity_run_id)
  WHERE student_id IS NOT NULL;
CREATE INDEX migration_recovery_artifacts_digest_idx
  ON migration_recovery_artifacts (school_id, artifact_digest);

COMMENT ON TABLE migration_credential_continuity_runs IS
  'SW-160 credential continuity evidence only. A run plans preserve/re-provision/review actions from a certified SW-150 shadow run and is not credential material.';
COMMENT ON TABLE migration_credential_continuity_records IS
  'SW-160 per-student continuity metadata. PINs, credential hashes, salts, peppers, raw legacy identity keys, and action proofs are prohibited from this table.';
COMMENT ON TABLE migration_recovery_artifacts IS
  'Schoolwide-to-legacy rollback reconciliation instructions only. Artifacts contain no credential secrets and provide no legacy write executor.';
