-- Dedicated game database only. This migration never reads classroom storage.
CREATE TABLE ck_memberships (
  tenant_id text NOT NULL,
  member_id text NOT NULL,
  class_id text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  auth_epoch integer NOT NULL DEFAULT 0 CHECK (auth_epoch >= 0),
  PRIMARY KEY (tenant_id, member_id)
);
CREATE TABLE ck_creatures (
  tenant_id text NOT NULL,
  creature_id text NOT NULL,
  member_id text NOT NULL,
  source_slot text NOT NULL,
  source_fingerprint text NOT NULL,
  revision integer NOT NULL CHECK (revision >= 0),
  lifecycle text NOT NULL CHECK (lifecycle IN ('alive','critical','dead')),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  PRIMARY KEY (tenant_id, creature_id),
  UNIQUE (tenant_id, source_slot),
  FOREIGN KEY (tenant_id, member_id) REFERENCES ck_memberships,
  CHECK ((state->>'schemaVersion') IS NOT DISTINCT FROM '2'),
  CHECK ((state->>'id') IS NOT DISTINCT FROM creature_id),
  CHECK ((state->>'ownerMembershipId') IS NOT DISTINCT FROM member_id),
  CHECK ((state->'legacy'->>'sourceSlot') IS NOT DISTINCT FROM source_slot),
  CHECK ((state->'legacy'->>'sourceFingerprint') IS NOT DISTINCT FROM source_fingerprint),
  CHECK ((state->>'revision') IS NOT DISTINCT FROM revision::text),
  CHECK ((state->>'lifecycle') IS NOT DISTINCT FROM lifecycle)
);
CREATE TABLE ck_command_receipts (
  tenant_id text NOT NULL,
  member_id text NOT NULL,
  command_id text NOT NULL,
  payload_hash text NOT NULL,
  response jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, member_id, command_id),
  FOREIGN KEY (tenant_id, member_id) REFERENCES ck_memberships
);
CREATE TABLE ck_events (
  event_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  member_id text NOT NULL,
  command_id text NOT NULL,
  creature_id text NOT NULL,
  previous_revision integer,
  next_revision integer NOT NULL,
  kind text NOT NULL,
  rules_version text NOT NULL,
  details jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, creature_id, next_revision),
  UNIQUE (tenant_id, member_id, command_id),
  FOREIGN KEY (tenant_id, creature_id) REFERENCES ck_creatures,
  FOREIGN KEY (tenant_id, member_id, command_id) REFERENCES ck_command_receipts DEFERRABLE INITIALLY DEFERRED
);
CREATE FUNCTION ck_reject_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Checklings history is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER ck_events_append_only BEFORE UPDATE OR DELETE ON ck_events
  FOR EACH ROW EXECUTE FUNCTION ck_reject_history_change();
CREATE TRIGGER ck_receipts_append_only BEFORE UPDATE OR DELETE ON ck_command_receipts
  FOR EACH ROW EXECUTE FUNCTION ck_reject_history_change();
CREATE TRIGGER ck_events_no_truncate BEFORE TRUNCATE ON ck_events
  FOR EACH STATEMENT EXECUTE FUNCTION ck_reject_history_change();
CREATE TRIGGER ck_receipts_no_truncate BEFORE TRUNCATE ON ck_command_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION ck_reject_history_change();
CREATE INDEX ck_creatures_owner ON ck_creatures (tenant_id, member_id);
CREATE UNIQUE INDEX ck_one_legacy_import_per_member ON ck_creatures (tenant_id, member_id)
  WHERE source_slot IS NOT NULL;
