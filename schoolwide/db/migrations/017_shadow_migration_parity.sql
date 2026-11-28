CREATE TABLE migration_shadow_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  import_run_id uuid NOT NULL REFERENCES migration_import_runs(id) ON DELETE RESTRICT,
  source_surface text NOT NULL CHECK (length(trim(source_surface)) BETWEEN 1 AND 100),
  source_ordinal integer NOT NULL CHECK (source_ordinal >= 0),
  record_type text NOT NULL CHECK (length(trim(record_type)) BETWEEN 1 AND 100),
  legacy_key text,
  identity_key_hash text CHECK (identity_key_hash IS NULL OR identity_key_hash ~ '^[0-9a-f]{64}$'),
  section_key text,
  source_row_hash text NOT NULL CHECK (source_row_hash ~ '^[0-9a-f]{64}$'),
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (import_run_id, source_surface, source_ordinal)
);

CREATE INDEX migration_shadow_records_run_surface_idx
  ON migration_shadow_records (import_run_id, source_surface, source_ordinal);
CREATE INDEX migration_shadow_records_school_type_idx
  ON migration_shadow_records (school_id, record_type, import_run_id);
CREATE INDEX migration_shadow_records_identity_idx
  ON migration_shadow_records (school_id, identity_key_hash, record_type)
  WHERE identity_key_hash IS NOT NULL;

CREATE TABLE migration_shadow_parity_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  import_run_id uuid NOT NULL UNIQUE REFERENCES migration_import_runs(id) ON DELETE RESTRICT,
  source_snapshot_fingerprint text NOT NULL CHECK (source_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  overall_status text NOT NULL CHECK (overall_status IN ('PASS','FAIL','REVIEW')),
  source_counts_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  shadow_counts_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  discrepancy_count integer NOT NULL DEFAULT 0 CHECK (discrepancy_count >= 0),
  report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX migration_shadow_parity_school_time_idx
  ON migration_shadow_parity_reports (school_id, created_at DESC, import_run_id);

COMMENT ON TABLE migration_shadow_records IS
  'Isolated SW-150 shadow migration projection only. These rows are not authoritative Schoolwide operational state and cannot drive student/staff actions.';
COMMENT ON TABLE migration_shadow_parity_reports IS
  'Read-only parity evidence comparing an approved legacy snapshot with its isolated shadow projection. No legacy write-back capability exists.';
