-- Additive: never change the checksummed foundation or legacy creature records.
CREATE TABLE ck_launch_flows (
  flow_id text PRIMARY KEY,
  issuer text NOT NULL,
  audience text NOT NULL,
  cookie_hash text NOT NULL CHECK (cookie_hash ~ '^[0-9a-f]{64}$'),
  state_hash text NOT NULL CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  challenge text NOT NULL,
  expires_ms bigint NOT NULL,
  tenant_id text,
  member_id text,
  class_id text,
  auth_epoch integer,
  code_hash text UNIQUE CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  code_expires_ms bigint,
  consumed_ms bigint,
  FOREIGN KEY (tenant_id,member_id) REFERENCES ck_memberships(tenant_id,member_id),
  CHECK ((tenant_id IS NULL AND member_id IS NULL AND class_id IS NULL AND auth_epoch IS NULL AND code_hash IS NULL AND code_expires_ms IS NULL AND consumed_ms IS NULL)
    OR (tenant_id IS NOT NULL AND member_id IS NOT NULL AND class_id IS NOT NULL AND auth_epoch IS NOT NULL AND auth_epoch>=0 AND code_hash IS NOT NULL AND code_expires_ms IS NOT NULL))
);
CREATE TABLE ck_launch_assertions (
  issuer text NOT NULL,
  assertion_id text NOT NULL,
  flow_id text NOT NULL UNIQUE REFERENCES ck_launch_flows(flow_id),
  expires_ms bigint NOT NULL,
  PRIMARY KEY (issuer,assertion_id)
);
CREATE INDEX ck_launch_flows_owner ON ck_launch_flows(tenant_id,member_id);
CREATE TABLE ck_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  issuer text NOT NULL,
  audience text NOT NULL,
  tenant_id text NOT NULL,
  member_id text NOT NULL,
  class_id text NOT NULL,
  auth_epoch integer NOT NULL CHECK (auth_epoch>=0),
  created_ms bigint NOT NULL,
  idle_expires_ms bigint NOT NULL,
  absolute_expires_ms bigint NOT NULL,
  revoked_ms bigint,
  FOREIGN KEY (tenant_id,member_id) REFERENCES ck_memberships(tenant_id,member_id),
  CHECK (idle_expires_ms<=absolute_expires_ms AND created_ms<idle_expires_ms)
);
CREATE INDEX ck_sessions_owner ON ck_sessions(tenant_id,member_id);
-- Cleanup is an operator task: retain assertion IDs until after assertion expiry;
-- remove expired flows only after their assertion rows. Never delete game history.
