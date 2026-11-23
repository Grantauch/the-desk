-- SW-188: additive index for bounded fictional nonce replay cleanup.
-- Keep migration 020 immutable; no students, PINs, secrets or new data here.
-- Scoped expiry queries use a trusted school UUID, issuer and expiration.
-- Source-only review: do not apply to live Hall Pass or production databases.
CREATE INDEX IF NOT EXISTS legacy_pin_handoff_replays_school_issuer_expiry_idx
  ON legacy_pin_handoff_replays (school_id, issuer, expires_at);
