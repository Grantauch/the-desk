ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_school_id_id_section_student_unique
    UNIQUE (school_id, id, section_id, student_id);

ALTER TABLE action_proofs
  ADD CONSTRAINT action_proofs_school_id_id_unique UNIQUE (school_id, id);

CREATE TABLE checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  section_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  academic_date date NOT NULL,
  checked_in_at timestamptz NOT NULL,
  authorization_method text NOT NULL
    CHECK (authorization_method IN ('STUDENT_PIN_PROOF', 'TEACHER_BACKUP')),
  identity_method text NOT NULL
    CHECK (identity_method IN ('STUDENT_IDENTITY_PROVIDER', 'STAFF_SESSION')),
  status text NOT NULL DEFAULT 'CHECKED_IN'
    CHECK (status = 'CHECKED_IN'),
  point_value integer NOT NULL DEFAULT 1 CHECK (point_value >= 0),
  actor_user_id uuid,
  action_proof_id uuid,
  note_private text,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, section_id)
    REFERENCES sections(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, enrollment_id, section_id, student_id)
    REFERENCES enrollments(school_id, id, section_id, student_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, actor_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, action_proof_id)
    REFERENCES action_proofs(school_id, id) ON DELETE RESTRICT,
  CHECK (
    (authorization_method = 'STUDENT_PIN_PROOF'
      AND identity_method = 'STUDENT_IDENTITY_PROVIDER'
      AND actor_user_id IS NULL
      AND action_proof_id IS NOT NULL)
    OR
    (authorization_method = 'TEACHER_BACKUP'
      AND identity_method = 'STAFF_SESSION'
      AND actor_user_id IS NOT NULL
      AND action_proof_id IS NULL)
  ),
  CHECK (note_private IS NULL OR length(note_private) <= 1000),
  UNIQUE (enrollment_id, academic_date)
);

CREATE INDEX checkins_section_date_idx
  ON checkins (school_id, section_id, academic_date, checked_in_at);
CREATE INDEX checkins_student_date_idx
  ON checkins (school_id, student_id, academic_date DESC);
CREATE INDEX checkins_request_idx
  ON checkins (school_id, request_id);

CREATE OR REPLACE FUNCTION grantdesk_prevent_checkin_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'checkins is append-only';
END;
$$;

CREATE TRIGGER checkins_append_only
BEFORE UPDATE OR DELETE ON checkins
FOR EACH ROW EXECUTE FUNCTION grantdesk_prevent_checkin_mutation();
