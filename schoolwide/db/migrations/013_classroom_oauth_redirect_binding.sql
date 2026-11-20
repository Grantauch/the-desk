ALTER TABLE classroom_oauth_states
  ADD COLUMN redirect_uri text NOT NULL
    CHECK (redirect_uri ~ '^https?://');

-- Complete Classroom roster snapshots need an ordering primitive that does not
-- depend on wall-clock timestamp uniqueness. A per-link sequence is allocated
-- under a row lock so concurrent/fast syncs have one unambiguous predecessor.
ALTER TABLE section_external_links
  ADD COLUMN complete_snapshot_sequence bigint NOT NULL DEFAULT 0
    CHECK (complete_snapshot_sequence >= 0);

ALTER TABLE classroom_sync_runs
  ADD COLUMN complete_snapshot_sequence bigint
    CHECK (complete_snapshot_sequence IS NULL OR complete_snapshot_sequence > 0),
  ADD CONSTRAINT classroom_sync_runs_complete_sequence_shape_check
    CHECK (
      (status = 'SUCCESS' AND snapshot_complete = true AND complete_snapshot_sequence IS NOT NULL)
      OR (NOT (status = 'SUCCESS' AND snapshot_complete = true) AND complete_snapshot_sequence IS NULL)
    );

CREATE OR REPLACE FUNCTION grantdesk_assign_classroom_complete_snapshot_sequence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_sequence bigint;
  prior_started_at timestamptz;
BEGIN
  IF NEW.status = 'SUCCESS' AND NEW.snapshot_complete = true THEN
    IF NEW.section_external_link_id IS NULL THEN
      RAISE EXCEPTION 'complete Classroom snapshot requires a section external link';
    END IF;

    UPDATE section_external_links
       SET complete_snapshot_sequence = complete_snapshot_sequence + 1
     WHERE id = NEW.section_external_link_id
     RETURNING complete_snapshot_sequence INTO next_sequence;

    IF next_sequence IS NULL THEN
      RAISE EXCEPTION 'Classroom section external link is unavailable for complete snapshot sequencing';
    END IF;

    SELECT max(started_at)
      INTO prior_started_at
      FROM classroom_sync_runs
     WHERE section_external_link_id = NEW.section_external_link_id
       AND status = 'SUCCESS'
       AND snapshot_complete = true;

    -- Keep the existing started_at ordering query deterministic even when the
    -- application clock has identical (or regressed) timestamps. This changes
    -- tied logical sync order by only one microsecond while preserving the
    -- original wall-clock value whenever it is already later.
    IF prior_started_at IS NOT NULL AND NEW.started_at <= prior_started_at THEN
      NEW.started_at := prior_started_at + interval '1 microsecond';
      IF NEW.finished_at IS NOT NULL AND NEW.finished_at < NEW.started_at THEN
        NEW.finished_at := NEW.started_at;
      END IF;
    END IF;

    NEW.complete_snapshot_sequence := next_sequence;
  ELSE
    NEW.complete_snapshot_sequence := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER classroom_sync_runs_assign_complete_snapshot_sequence
BEFORE INSERT ON classroom_sync_runs
FOR EACH ROW EXECUTE FUNCTION grantdesk_assign_classroom_complete_snapshot_sequence();

CREATE UNIQUE INDEX classroom_sync_runs_link_complete_sequence_unique
  ON classroom_sync_runs (section_external_link_id, complete_snapshot_sequence)
  WHERE section_external_link_id IS NOT NULL
    AND complete_snapshot_sequence IS NOT NULL;

CREATE INDEX classroom_sync_runs_link_complete_sequence_idx
  ON classroom_sync_runs (section_external_link_id, complete_snapshot_sequence DESC)
  WHERE section_external_link_id IS NOT NULL
    AND complete_snapshot_sequence IS NOT NULL;
