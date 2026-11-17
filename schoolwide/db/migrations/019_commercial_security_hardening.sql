-- SW-171 commercial hardening.
-- Keep staff-session rotation ancestry inside the same organization even if
-- future application code regresses.

ALTER TABLE staff_sessions
  ADD CONSTRAINT staff_sessions_organization_id_id_unique
    UNIQUE (organization_id, id);

ALTER TABLE staff_sessions
  DROP CONSTRAINT staff_sessions_rotated_from_session_id_fkey;

ALTER TABLE staff_sessions
  ADD CONSTRAINT staff_sessions_same_org_rotation_fk
    FOREIGN KEY (organization_id, rotated_from_session_id)
    REFERENCES staff_sessions(organization_id, id)
    ON DELETE RESTRICT;
