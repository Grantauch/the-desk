ALTER TABLE passes
  ADD COLUMN return_actor_user_id uuid;

ALTER TABLE passes
  ADD CONSTRAINT passes_org_return_actor_fk
    FOREIGN KEY (organization_id, return_actor_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT;

DO $$
DECLARE
  target_constraint text;
BEGIN
  SELECT c.conname
    INTO target_constraint
    FROM pg_constraint c
   WHERE c.conrelid = 'passes'::regclass
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%authorization_method_return%'
     AND pg_get_constraintdef(c.oid) LIKE '%return_action_proof_id%'
     AND pg_get_constraintdef(c.oid) LIKE '%status%'
   ORDER BY c.conname
   LIMIT 1;

  IF target_constraint IS NULL THEN
    RAISE EXCEPTION 'Could not locate the existing passes return-state check constraint';
  END IF;

  EXECUTE format('ALTER TABLE passes DROP CONSTRAINT %I', target_constraint);
END;
$$;

ALTER TABLE passes
  ADD CONSTRAINT passes_return_state_check CHECK (
    (
      status = 'OUT'
      AND returned_at IS NULL
      AND countability = 'PROVISIONAL'
      AND classified_at IS NULL
      AND duration_ms IS NULL
      AND authorization_method_return IS NULL
      AND return_action_proof_id IS NULL
      AND return_actor_user_id IS NULL
    )
    OR
    (
      status = 'RETURNED'
      AND returned_at IS NOT NULL
      AND countability IN ('COUNTABLE', 'NON_COUNTABLE')
      AND classified_at IS NOT NULL
      AND duration_ms IS NOT NULL
      AND (
        (
          authorization_method_return = 'STUDENT_PIN_PROOF'
          AND return_action_proof_id IS NOT NULL
          AND return_actor_user_id IS NULL
        )
        OR
        (
          authorization_method_return = 'TEACHER_STAFF_ACTION'
          AND return_action_proof_id IS NULL
          AND return_actor_user_id IS NOT NULL
        )
      )
    )
    OR
    (
      status = 'ROLLED_OVER'
      AND returned_at IS NOT NULL
      AND countability IN ('COUNTABLE', 'NON_COUNTABLE')
      AND classified_at IS NOT NULL
      AND duration_ms IS NOT NULL
      AND authorization_method_return = 'SYSTEM_ROLLOVER'
      AND return_action_proof_id IS NULL
      AND return_actor_user_id IS NULL
    )
  );