CREATE OR REPLACE FUNCTION grantdesk_known_policy_value_valid(policy_key_input text, value_input jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  numeric_value numeric;
BEGIN
  IF policy_key_input NOT IN (
    'MAX_ACTIVE_PER_SECTION',
    'MARKING_PERIOD_LIMIT',
    'DAILY_LIMIT',
    'COOLDOWN_MINUTES',
    'PROTECTED_FIRST_MINUTES',
    'PROTECTED_LAST_MINUTES',
    'QUEUE_MAX_WAIT_MINUTES',
    'SECURITY_LATE_WARNING_MINUTES',
    'SECURITY_STALE_WARNING_MINUTES'
  ) THEN
    RETURN true;
  END IF;

  IF jsonb_typeof(value_input) <> 'number' THEN
    RETURN false;
  END IF;

  BEGIN
    numeric_value := (value_input #>> '{}')::numeric;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF numeric_value <> trunc(numeric_value) THEN
    RETURN false;
  END IF;

  IF policy_key_input = 'MAX_ACTIVE_PER_SECTION' THEN
    RETURN numeric_value BETWEEN 1 AND 100;
  ELSIF policy_key_input IN ('SECURITY_LATE_WARNING_MINUTES','SECURITY_STALE_WARNING_MINUTES') THEN
    RETURN numeric_value BETWEEN 1 AND 1440;
  ELSE
    RETURN numeric_value BETWEEN 0 AND 1440;
  END IF;
END;
$$;

ALTER TABLE policy_values
  ADD CONSTRAINT policy_values_known_runtime_value_check
  CHECK (grantdesk_known_policy_value_valid(policy_key, typed_value_json));
