CREATE TABLE migration_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'LEGACY_GRANT_CLASSROOM'
    CHECK (source_type IN ('LEGACY_GRANT_CLASSROOM')),
  source_snapshot_fingerprint text NOT NULL
    CHECK (source_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  source_alias text NOT NULL CHECK (length(trim(source_alias)) BETWEEN 1 AND 200),
  source_schema_version text NOT NULL CHECK (length(trim(source_schema_version)) BETWEEN 1 AND 100),
  source_exported_at timestamptz NOT NULL,
  source_high_water_mark text,
  mode text NOT NULL
    CHECK (mode IN ('VALIDATE','DRY_RUN','IMPORT_SHADOW','IMPORT_PROD_PREP','FINAL_DELTA')),
  status text NOT NULL
    CHECK (status IN ('STARTED','PASS','FAIL','PARTIAL')),
  counts_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  discrepancy_count integer NOT NULL DEFAULT 0 CHECK (discrepancy_count >= 0),
  artifact_reference text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK ((status = 'STARTED' AND finished_at IS NULL) OR (status <> 'STARTED' AND finished_at IS NOT NULL)),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, source_type, source_snapshot_fingerprint, mode)
);

CREATE INDEX migration_import_runs_school_time_idx
  ON migration_import_runs (school_id, started_at DESC, id);
CREATE INDEX migration_import_runs_fingerprint_idx
  ON migration_import_runs (school_id, source_snapshot_fingerprint, mode);

CREATE TABLE legacy_id_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'LEGACY_GRANT_CLASSROOM'
    CHECK (source_type IN ('LEGACY_GRANT_CLASSROOM')),
  legacy_entity_type text NOT NULL CHECK (length(trim(legacy_entity_type)) BETWEEN 1 AND 100),
  legacy_id_or_key text NOT NULL CHECK (length(trim(legacy_id_or_key)) BETWEEN 1 AND 500),
  schoolwide_entity_type text NOT NULL CHECK (length(trim(schoolwide_entity_type)) BETWEEN 1 AND 100),
  schoolwide_id uuid NOT NULL,
  first_import_run_id uuid NOT NULL REFERENCES migration_import_runs(id) ON DELETE RESTRICT,
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, source_type, legacy_entity_type, legacy_id_or_key),
  UNIQUE (school_id, schoolwide_entity_type, schoolwide_id, legacy_entity_type)
);

CREATE INDEX legacy_id_mappings_schoolwide_idx
  ON legacy_id_mappings (school_id, schoolwide_entity_type, schoolwide_id);

CREATE TABLE migration_reconciliation_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  import_run_id uuid NOT NULL REFERENCES migration_import_runs(id) ON DELETE RESTRICT,
  invariant_code text NOT NULL CHECK (length(trim(invariant_code)) BETWEEN 1 AND 100),
  status text NOT NULL CHECK (status IN ('PASS','FAIL','REVIEW')),
  category text NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 100),
  count_value integer CHECK (count_value IS NULL OR count_value >= 0),
  detail_sanitized text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX migration_reconciliation_findings_run_idx
  ON migration_reconciliation_findings (import_run_id, status, invariant_code);

COMMENT ON TABLE migration_import_runs IS
  'Migration evidence only. SW-140 VALIDATE/DRY_RUN runtime does not persist runs or mutate operational Schoolwide data; commit modes remain future work.';
COMMENT ON TABLE legacy_id_mappings IS
  'Durable legacy-to-Schoolwide mappings for future approved import commits. No legacy write-back capability exists.';
