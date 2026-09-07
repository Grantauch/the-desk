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
