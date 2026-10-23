ALTER TABLE ck_launch_flows ADD COLUMN cancelled_ms bigint;
CREATE UNIQUE INDEX ck_launch_cookie ON ck_launch_flows(cookie_hash);
ALTER TABLE ck_sessions ADD COLUMN launch_flow_id text UNIQUE REFERENCES ck_launch_flows(flow_id);
-- Preexisting sessions keep NULL provenance; no token or pet is replaced.
CREATE TABLE ck_request_limits (
  bucket_hash text NOT NULL CHECK (bucket_hash ~ '^[0-9a-f]{64}$'),
  window_ms bigint NOT NULL,
  hits integer NOT NULL CHECK (hits>0),
  PRIMARY KEY (bucket_hash,window_ms)
);
CREATE INDEX ck_request_limits_expiry ON ck_request_limits(window_ms);
-- An operator expires old counter windows; student requests never run cleanup.
