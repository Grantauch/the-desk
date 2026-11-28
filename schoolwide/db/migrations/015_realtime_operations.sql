ALTER TABLE transactional_outbox
  ADD COLUMN lease_owner text,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN next_attempt_at timestamptz;

UPDATE transactional_outbox
   SET next_attempt_at = available_at
 WHERE next_attempt_at IS NULL;

ALTER TABLE transactional_outbox
  ALTER COLUMN next_attempt_at SET DEFAULT now(),
  ALTER COLUMN next_attempt_at SET NOT NULL,
  ADD CONSTRAINT transactional_outbox_lease_shape_check
    CHECK (
      (status = 'PROCESSING' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
      OR (status <> 'PROCESSING' AND lease_owner IS NULL AND lease_expires_at IS NULL)
    );

CREATE INDEX transactional_outbox_delivery_ready_idx
  ON transactional_outbox (next_attempt_at, created_at, id)
  WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX transactional_outbox_processing_lease_idx
  ON transactional_outbox (lease_expires_at, id)
  WHERE status = 'PROCESSING';

CREATE TABLE operations_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  school_id uuid,
  job_type text NOT NULL CHECK (job_type IN ('OUTBOX_DELIVERY', 'CLASSROOM_SCHEDULED_SYNC')),
  worker_instance_id text NOT NULL CHECK (length(trim(worker_instance_id)) > 0),
  status text NOT NULL CHECK (status IN ('STARTED', 'SUCCESS', 'PARTIAL', 'FAILED')),
  items_claimed integer NOT NULL DEFAULT 0 CHECK (items_claimed >= 0),
  items_succeeded integer NOT NULL DEFAULT 0 CHECK (items_succeeded >= 0),
  items_failed integer NOT NULL DEFAULT 0 CHECK (items_failed >= 0),
  error_category text,
  error_summary_sanitized text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK ((status = 'STARTED' AND finished_at IS NULL) OR (status <> 'STARTED' AND finished_at IS NOT NULL)),
  CHECK (organization_id IS NOT NULL OR school_id IS NULL),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX operations_job_runs_type_time_idx
  ON operations_job_runs (job_type, started_at DESC, id);
CREATE INDEX operations_job_runs_school_time_idx
  ON operations_job_runs (school_id, started_at DESC, id)
  WHERE school_id IS NOT NULL;
