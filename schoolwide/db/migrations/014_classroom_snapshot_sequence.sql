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

CREATE UNIQUE INDEX classroom_sync_runs_link_complete_sequence_unique
  ON classroom_sync_runs (section_external_link_id, complete_snapshot_sequence)
  WHERE section_external_link_id IS NOT NULL
    AND complete_snapshot_sequence IS NOT NULL;

CREATE INDEX classroom_sync_runs_link_complete_sequence_idx
  ON classroom_sync_runs (section_external_link_id, complete_snapshot_sequence DESC)
  WHERE section_external_link_id IS NOT NULL
    AND complete_snapshot_sequence IS NOT NULL;
