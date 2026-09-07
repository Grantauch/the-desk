CREATE TABLE pass_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  section_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  destination_id uuid NOT NULL,
  action_proof_id uuid NOT NULL,
  requested_at timestamptz NOT NULL,
  class_end_at timestamptz NOT NULL,
  queue_expires_at timestamptz NOT NULL,
  authorization_method text NOT NULL DEFAULT 'STUDENT_PIN_PROOF'
    CHECK (authorization_method = 'STUDENT_PIN_PROOF'),
  status text NOT NULL
    CHECK (status IN ('STARTED', 'QUEUED', 'CANCELLED', 'EXPIRED', 'REJECTED')),
  resolved_at timestamptz,
  resolution_code text,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (class_end_at > requested_at),
  CHECK (queue_expires_at > requested_at),
  CHECK ((status IN ('STARTED', 'CANCELLED', 'EXPIRED', 'REJECTED') AND resolved_at IS NOT NULL) OR status = 'QUEUED'),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, section_id)
    REFERENCES sections(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, enrollment_id, section_id, student_id)
    REFERENCES enrollments(school_id, id, section_id, student_id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, destination_id)
    REFERENCES destinations(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, action_proof_id)
    REFERENCES action_proofs(school_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, id),
  UNIQUE (school_id, request_id)
);

CREATE INDEX pass_requests_student_recent_idx
  ON pass_requests (school_id, student_id, requested_at DESC);
CREATE INDEX pass_requests_section_status_idx
  ON pass_requests (school_id, section_id, status, requested_at);
CREATE UNIQUE INDEX pass_requests_one_live_request_per_student
  ON pass_requests (school_id, student_id)
  WHERE status = 'QUEUED';

CREATE TABLE queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  pass_request_id uuid NOT NULL,
  student_id uuid NOT NULL,
  section_id uuid NOT NULL,
  joined_at timestamptz NOT NULL,
  order_token bigint GENERATED ALWAYS AS IDENTITY,
  status text NOT NULL DEFAULT 'WAITING'
    CHECK (status IN ('WAITING', 'STARTED', 'CANCELLED', 'EXPIRED', 'INELIGIBLE')),
  resolved_at timestamptz,
  resolution_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'WAITING' AND resolved_at IS NULL) OR (status <> 'WAITING' AND resolved_at IS NOT NULL)),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, pass_request_id)
    REFERENCES pass_requests(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, section_id)
    REFERENCES sections(school_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, id),
  UNIQUE (school_id, pass_request_id)
);

CREATE INDEX queue_entries_fifo_idx
  ON queue_entries (school_id, section_id, status, order_token)
  WHERE status = 'WAITING';
CREATE INDEX queue_entries_student_waiting_idx
  ON queue_entries (school_id, student_id, status)
  WHERE status = 'WAITING';

CREATE TABLE passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  pass_request_id uuid NOT NULL,
  student_id uuid NOT NULL,
  section_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  destination_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  returned_at timestamptz,
  status text NOT NULL DEFAULT 'OUT'
    CHECK (status IN ('OUT', 'RETURNED', 'ROLLED_OVER')),
  countability text NOT NULL DEFAULT 'PROVISIONAL'
    CHECK (countability IN ('PROVISIONAL', 'COUNTABLE', 'NON_COUNTABLE', 'UNKNOWN_REVIEW')),
  countability_reason text,
  classified_at timestamptz,
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms >= 0),
  authorization_method_start text NOT NULL DEFAULT 'STUDENT_PIN_PROOF'
    CHECK (authorization_method_start = 'STUDENT_PIN_PROOF'),
  authorization_method_return text,
  start_action_proof_id uuid NOT NULL,
  return_action_proof_id uuid,
  return_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'OUT' AND returned_at IS NULL AND countability = 'PROVISIONAL' AND classified_at IS NULL AND duration_ms IS NULL AND authorization_method_return IS NULL AND return_action_proof_id IS NULL)
    OR
    (status = 'RETURNED' AND returned_at IS NOT NULL AND countability IN ('COUNTABLE', 'NON_COUNTABLE') AND classified_at IS NOT NULL AND duration_ms IS NOT NULL AND authorization_method_return = 'STUDENT_PIN_PROOF' AND return_action_proof_id IS NOT NULL)
    OR
    (status = 'ROLLED_OVER' AND returned_at IS NOT NULL AND countability IN ('COUNTABLE', 'NON_COUNTABLE') AND classified_at IS NOT NULL AND duration_ms IS NOT NULL AND authorization_method_return = 'SYSTEM_ROLLOVER' AND return_action_proof_id IS NULL)
  ),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, pass_request_id)
    REFERENCES pass_requests(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, section_id)
    REFERENCES sections(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, enrollment_id, section_id, student_id)
    REFERENCES enrollments(school_id, id, section_id, student_id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, destination_id)
    REFERENCES destinations(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, start_action_proof_id)
    REFERENCES action_proofs(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, return_action_proof_id)
    REFERENCES action_proofs(school_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, id),
  UNIQUE (school_id, pass_request_id)
);

CREATE UNIQUE INDEX passes_one_active_per_student
  ON passes (school_id, student_id)
  WHERE status = 'OUT';
CREATE INDEX passes_school_status_started_idx
  ON passes (school_id, status, started_at DESC);
CREATE INDEX passes_section_status_idx
  ON passes (school_id, section_id, status, started_at);
CREATE INDEX passes_student_started_idx
  ON passes (school_id, student_id, started_at DESC);
CREATE INDEX passes_destination_status_idx
  ON passes (school_id, destination_id, status, started_at);
CREATE INDEX passes_returned_policy_idx
  ON passes (school_id, student_id, returned_at DESC)
  WHERE status IN ('RETURNED', 'ROLLED_OVER') AND countability = 'COUNTABLE';
