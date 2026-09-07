CREATE TABLE staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  identity_provider text NOT NULL CHECK (identity_provider IN ('GOOGLE', 'SYNTHETIC')),
  identity_subject text NOT NULL CHECK (length(trim(identity_subject)) > 0),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  rotated_from_session_id uuid,
  correlation_id uuid NOT NULL,
  FOREIGN KEY (organization_id, user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (rotated_from_session_id)
    REFERENCES staff_sessions(id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX staff_sessions_active_token_idx
  ON staff_sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX staff_sessions_user_active_idx
  ON staff_sessions (organization_id, user_id, expires_at DESC)
  WHERE revoked_at IS NULL;
