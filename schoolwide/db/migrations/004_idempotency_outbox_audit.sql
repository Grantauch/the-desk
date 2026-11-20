ALTER TABLE audit_events
  ADD COLUMN organization_id uuid NOT NULL,
  ADD COLUMN actor_student_id uuid,
  ADD COLUMN correlation_id uuid,
  ADD COLUMN source text NOT NULL DEFAULT 'APPLICATION'
    CHECK (source IN ('APPLICATION', 'SYSTEM', 'MIGRATION', 'INTEGRATION')),
  ADD CONSTRAINT audit_events_org_school_fk
    FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT audit_events_org_actor_user_fk
    FOREIGN KEY (organization_id, actor_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT audit_events_school_actor_student_fk
    FOREIGN KEY (school_id, actor_student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT audit_events_actor_shape_check
    CHECK (
      (actor_kind = 'USER' AND actor_user_id IS NOT NULL AND actor_student_id IS NULL)
      OR (actor_kind = 'STUDENT' AND actor_user_id IS NULL AND actor_student_id IS NOT NULL)
      OR (actor_kind IN ('SYSTEM', 'MIGRATION') AND actor_user_id IS NULL AND actor_student_id IS NULL)
    );
CREATE INDEX audit_events_school_correlation_idx
  ON audit_events (school_id, correlation_id, occurred_at)
  WHERE correlation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION grantdesk_prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION grantdesk_prevent_audit_mutation();

CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  key text NOT NULL CHECK (length(trim(key)) > 0),
  operation text NOT NULL CHECK (length(trim(operation)) > 0),
  request_fingerprint text NOT NULL CHECK (length(trim(request_fingerprint)) > 0),
  status text NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
  response_status integer,
  response_json_sanitized jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  correlation_id uuid NOT NULL,
  CHECK (expires_at > created_at),
  CHECK ((status = 'COMPLETED' AND completed_at IS NOT NULL) OR status <> 'COMPLETED'),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, key)
);
CREATE INDEX idempotency_keys_school_status_expiry_idx
  ON idempotency_keys (school_id, status, expires_at);
CREATE INDEX idempotency_keys_correlation_idx
  ON idempotency_keys (school_id, correlation_id);

CREATE TABLE transactional_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  topic text NOT NULL CHECK (length(trim(topic)) > 0),
  event_type text NOT NULL CHECK (length(trim(event_type)) > 0),
  aggregate_type text NOT NULL CHECK (length(trim(aggregate_type)) > 0),
  aggregate_id uuid,
  correlation_id uuid NOT NULL,
  payload_json_sanitized jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  published_at timestamptz,
  last_error_sanitized text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  CHECK ((status = 'PUBLISHED' AND published_at IS NOT NULL) OR status <> 'PUBLISHED')
);
CREATE INDEX transactional_outbox_pending_idx
  ON transactional_outbox (available_at, created_at)
  WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX transactional_outbox_school_correlation_idx
  ON transactional_outbox (school_id, correlation_id);
