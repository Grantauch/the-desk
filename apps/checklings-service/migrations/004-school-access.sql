-- Additive school authorization lease. No classroom database connection.
CREATE TABLE ck_school_classes (
  tenant_id text NOT NULL,
  class_id text NOT NULL,
  issuer text NOT NULL,
  audience text NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  enabled boolean NOT NULL DEFAULT false,
  valid_until_ms bigint NOT NULL,
  content_hash text NOT NULL,
  PRIMARY KEY (tenant_id,class_id)
);
ALTER TABLE ck_memberships ADD COLUMN bridge_credential_version text;
CREATE INDEX ck_memberships_class ON ck_memberships (tenant_id,class_id,member_id);
CREATE TABLE ck_school_access_events (
  tenant_id text NOT NULL,
  class_id text NOT NULL,
  revision bigint NOT NULL,
  issuer text NOT NULL,
  enabled boolean NOT NULL,
  changed_members integer NOT NULL CHECK (changed_members >= 0),
  content_hash text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,class_id,revision)
);
CREATE TRIGGER ck_school_access_append_only BEFORE UPDATE OR DELETE ON ck_school_access_events
  FOR EACH ROW EXECUTE FUNCTION ck_reject_history_change();
CREATE TRIGGER ck_school_access_no_truncate BEFORE TRUNCATE ON ck_school_access_events
  FOR EACH STATEMENT EXECUTE FUNCTION ck_reject_history_change();
