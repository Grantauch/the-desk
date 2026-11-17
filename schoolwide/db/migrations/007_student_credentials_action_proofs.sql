CREATE TABLE student_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  credential_type text NOT NULL DEFAULT 'PIN' CHECK (credential_type = 'PIN'),
  verifier_scheme text NOT NULL CHECK (verifier_scheme IN ('SCRYPT_PEPPER_V1', 'LEGACY_SHA256_SALT_V1')),
  secret_hash text NOT NULL CHECK (length(secret_hash) >= 32),
  secret_salt text,
  verifier_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  delivery_state text NOT NULL DEFAULT 'UNKNOWN' CHECK (delivery_state IN ('UNKNOWN', 'PENDING', 'DELIVERED')),
  delivery_destination_masked text,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  revoked_at timestamptz,
  FOREIGN KEY (school_id, student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, id),
  CHECK (
    (verifier_scheme = 'SCRYPT_PEPPER_V1' AND secret_salt IS NOT NULL AND length(secret_salt) >= 16)
    OR (verifier_scheme = 'LEGACY_SHA256_SALT_V1' AND secret_salt IS NULL)
  ),
  CHECK (
    (status = 'ACTIVE' AND revoked_at IS NULL)
    OR (status = 'REVOKED' AND revoked_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX student_credentials_one_active_pin_idx
  ON student_credentials (school_id, student_id, credential_type)
  WHERE status = 'ACTIVE';
CREATE INDEX student_credentials_student_version_idx
  ON student_credentials (school_id, student_id, credential_version DESC);

CREATE TABLE student_credential_attempt_state (
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  window_started_at timestamptz NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, student_id),
  FOREIGN KEY (school_id, student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT
);

CREATE TABLE student_credential_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE', 'THROTTLED')),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid,
  client_attempt_nonce_hash text CHECK (client_attempt_nonce_hash IS NULL OR length(client_attempt_nonce_hash) = 64),
  FOREIGN KEY (school_id, student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT
);
CREATE INDEX student_credential_attempts_recent_idx
  ON student_credential_attempts (school_id, student_id, attempted_at DESC);
CREATE INDEX student_credential_attempts_request_idx
  ON student_credential_attempts (request_id)
  WHERE request_id IS NOT NULL;

CREATE TABLE action_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('CHECKIN', 'PASS_REQUEST', 'RETURN')),
  context_section_id uuid,
  credential_id uuid NOT NULL,
  credential_version integer NOT NULL CHECK (credential_version > 0),
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  request_id uuid NOT NULL,
  FOREIGN KEY (school_id, student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, context_section_id)
    REFERENCES sections(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, credential_id)
    REFERENCES student_credentials(school_id, id) ON DELETE RESTRICT,
  CHECK (expires_at > issued_at),
  CHECK (consumed_at IS NULL OR consumed_at >= issued_at)
);
CREATE INDEX action_proofs_student_live_idx
  ON action_proofs (school_id, student_id, expires_at)
  WHERE consumed_at IS NULL;
CREATE INDEX action_proofs_request_idx ON action_proofs (request_id);
