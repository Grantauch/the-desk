CREATE TABLE pass_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  event_type text NOT NULL CHECK (length(trim(event_type)) > 0),
  resource_type text NOT NULL CHECK (length(trim(resource_type)) > 0),
  resource_id uuid NOT NULL,
  student_id uuid,
  actor_kind text NOT NULL CHECK (actor_kind IN ('USER', 'STUDENT', 'SYSTEM')),
  actor_user_id uuid,
  actor_student_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  correlation_id uuid NOT NULL,
  metadata_json_sanitized jsonb NOT NULL DEFAULT '{}'::jsonb,
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, actor_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, actor_student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  CHECK (
    (actor_kind = 'USER' AND actor_user_id IS NOT NULL AND actor_student_id IS NULL)
    OR (actor_kind = 'STUDENT' AND actor_user_id IS NULL AND actor_student_id IS NOT NULL)
    OR (actor_kind = 'SYSTEM' AND actor_user_id IS NULL AND actor_student_id IS NULL)
  )
);

CREATE INDEX pass_events_school_time_idx
  ON pass_events (school_id, occurred_at DESC, id DESC);
CREATE INDEX pass_events_resource_idx
  ON pass_events (school_id, resource_type, resource_id, occurred_at DESC);
CREATE INDEX pass_events_correlation_idx
  ON pass_events (school_id, correlation_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION grantdesk_prevent_pass_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'pass_events is append-only';
END;
$$;

CREATE TRIGGER pass_events_append_only
BEFORE UPDATE OR DELETE ON pass_events
FOR EACH ROW EXECUTE FUNCTION grantdesk_prevent_pass_event_mutation();

CREATE TABLE pass_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  pass_id uuid NOT NULL,
  correction_type text NOT NULL
    CHECK (correction_type IN ('VOID_COUNTABILITY', 'RESTORE_COUNTABILITY', 'IDENTITY_LINK_CORRECTION')),
  actor_user_id uuid NOT NULL,
  reason_private text NOT NULL CHECK (length(trim(reason_private)) > 0 AND length(reason_private) <= 1000),
  prior_countability text NOT NULL
    CHECK (prior_countability IN ('COUNTABLE', 'NON_COUNTABLE', 'UNKNOWN_REVIEW')),
  resulting_countability text NOT NULL
    CHECK (resulting_countability IN ('COUNTABLE', 'NON_COUNTABLE', 'UNKNOWN_REVIEW')),
  created_at timestamptz NOT NULL DEFAULT now(),
  correlation_id uuid NOT NULL,
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, actor_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, pass_id)
    REFERENCES passes(school_id, id) ON DELETE RESTRICT
);

CREATE INDEX pass_corrections_pass_time_idx
  ON pass_corrections (school_id, pass_id, created_at DESC, id DESC);
CREATE INDEX pass_corrections_school_time_idx
  ON pass_corrections (school_id, created_at DESC, id DESC);
CREATE INDEX pass_corrections_correlation_idx
  ON pass_corrections (school_id, correlation_id);

CREATE OR REPLACE FUNCTION grantdesk_prevent_pass_correction_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'pass_corrections is append-only';
END;
$$;

CREATE TRIGGER pass_corrections_append_only
BEFORE UPDATE OR DELETE ON pass_corrections
FOR EACH ROW EXECUTE FUNCTION grantdesk_prevent_pass_correction_mutation();

ALTER TABLE checkins
  ADD CONSTRAINT checkins_school_id_id_unique UNIQUE (school_id, id);

CREATE TABLE staff_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  action_type text NOT NULL CHECK (length(trim(action_type)) > 0),
  student_id uuid,
  section_id uuid,
  pass_id uuid,
  request_id uuid,
  checkin_id uuid,
  restrictions_bypassed_json jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(restrictions_bypassed_json) = 'array'),
  reason_private text NOT NULL CHECK (length(trim(reason_private)) > 0 AND length(reason_private) <= 1000),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  correlation_id uuid NOT NULL,
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, actor_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, section_id)
    REFERENCES sections(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, pass_id)
    REFERENCES passes(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, request_id)
    REFERENCES pass_requests(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, checkin_id)
    REFERENCES checkins(school_id, id) ON DELETE RESTRICT
);

CREATE INDEX staff_actions_school_time_idx
  ON staff_actions (school_id, occurred_at DESC, id DESC);
CREATE INDEX staff_actions_actor_time_idx
  ON staff_actions (school_id, actor_user_id, occurred_at DESC);
CREATE INDEX staff_actions_pass_time_idx
  ON staff_actions (school_id, pass_id, occurred_at DESC)
  WHERE pass_id IS NOT NULL;
CREATE INDEX staff_actions_correlation_idx
  ON staff_actions (school_id, correlation_id);

CREATE OR REPLACE FUNCTION grantdesk_prevent_staff_action_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'staff_actions is append-only';
END;
$$;

CREATE TRIGGER staff_actions_append_only
BEFORE UPDATE OR DELETE ON staff_actions
FOR EACH ROW EXECUTE FUNCTION grantdesk_prevent_staff_action_mutation();
