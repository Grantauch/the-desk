-- SW-176 experimental replay protection for the disabled existing-PIN handoff.
-- This schema contains NO PIN, student alias, student identifier, hash, or salt.
-- No production route or Apps Script bridge consumes this table.

CREATE TABLE legacy_pin_handoff_replays (
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  issuer text NOT NULL
    CHECK (length(issuer) BETWEEN 1 AND 192 AND issuer ~ '^[A-Za-z0-9][A-Za-z0-9_.:@-]*$'),
  nonce_digest text NOT NULL
    CHECK (nonce_digest ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  PRIMARY KEY (school_id, issuer, nonce_digest),
  CHECK (expires_at > consumed_at)
);
CREATE INDEX legacy_pin_handoff_replays_cleanup_idx
  ON legacy_pin_handoff_replays (expires_at);
COMMENT ON TABLE legacy_pin_handoff_replays IS
  'SW-176 DISABLED synthetic PIN handoff replay prevention only. Contains issuer/school and one-way nonce digest; never store PIN, alias, raw token, source hash or secret. No live integration.';
