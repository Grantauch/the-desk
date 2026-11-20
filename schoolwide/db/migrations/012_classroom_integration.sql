CREATE TABLE classroom_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  state_hash text NOT NULL UNIQUE CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  provider_pending_ref text NOT NULL CHECK (length(trim(provider_pending_ref)) > 0),
  requested_scopes text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX classroom_oauth_states_expiry_idx
  ON classroom_oauth_states (expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE classroom_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  google_account_subject text NOT NULL CHECK (length(trim(google_account_subject)) > 0),
  scopes_granted text[] NOT NULL,
  provider_connection_ref text NOT NULL CHECK (length(trim(provider_connection_ref)) > 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'ERROR')),
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  revoked_at timestamptz,
  error_category text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, school_id, id),
  CHECK ((status = 'REVOKED' AND revoked_at IS NOT NULL) OR status <> 'REVOKED')
);
CREATE UNIQUE INDEX classroom_connections_one_active_user_school
  ON classroom_connections (school_id, user_id)
  WHERE status = 'ACTIVE';
CREATE INDEX classroom_connections_health_idx
  ON classroom_connections (school_id, status, last_success_at DESC);

CREATE TABLE classroom_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  classroom_connection_id uuid NOT NULL,
  google_course_id text NOT NULL CHECK (length(trim(google_course_id)) > 0),
  google_owner_id text,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  section_text text,
  room_text text,
  course_state text NOT NULL,
  imported_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  raw_version_hash text,
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, school_id, classroom_connection_id)
    REFERENCES classroom_connections(organization_id, school_id, id) ON DELETE RESTRICT,
  UNIQUE (classroom_connection_id, google_course_id),
  UNIQUE (organization_id, school_id, id)
);
CREATE INDEX classroom_courses_connection_state_idx
  ON classroom_courses (classroom_connection_id, course_state, last_seen_at DESC);

CREATE TABLE section_external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  section_id uuid NOT NULL,
  classroom_connection_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'GOOGLE_CLASSROOM' CHECK (provider = 'GOOGLE_CLASSROOM'),
  external_course_id text NOT NULL CHECK (length(trim(external_course_id)) > 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  linked_at timestamptz NOT NULL DEFAULT now(),
  unlinked_at timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_sync_after timestamptz,
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, section_id)
    REFERENCES sections(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, school_id, classroom_connection_id)
    REFERENCES classroom_connections(organization_id, school_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, school_id, id),
  CHECK ((status = 'INACTIVE' AND unlinked_at IS NOT NULL) OR status <> 'INACTIVE')
);
CREATE UNIQUE INDEX section_external_links_active_course_unique
  ON section_external_links (classroom_connection_id, external_course_id)
  WHERE status = 'ACTIVE';
CREATE INDEX section_external_links_due_idx
  ON section_external_links (next_sync_after, id)
  WHERE status = 'ACTIVE';
CREATE INDEX section_external_links_section_idx
  ON section_external_links (school_id, section_id, status);

CREATE TABLE classroom_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  classroom_connection_id uuid NOT NULL,
  section_external_link_id uuid,
  trigger_type text NOT NULL CHECK (trigger_type IN ('IMPORT', 'MANUAL', 'SCHEDULED')),
  status text NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED', 'SUCCESS', 'PARTIAL', 'FAILED')),
  snapshot_complete boolean NOT NULL DEFAULT false,
  courses_seen integer NOT NULL DEFAULT 0 CHECK (courses_seen >= 0),
  students_seen integer NOT NULL DEFAULT 0 CHECK (students_seen >= 0),
  teachers_seen integer NOT NULL DEFAULT 0 CHECK (teachers_seen >= 0),
  adds integer NOT NULL DEFAULT 0 CHECK (adds >= 0),
  reactivations integer NOT NULL DEFAULT 0 CHECK (reactivations >= 0),
  deactivations integer NOT NULL DEFAULT 0 CHECK (deactivations >= 0),
  pending_removals integer NOT NULL DEFAULT 0 CHECK (pending_removals >= 0),
  reviews_required integer NOT NULL DEFAULT 0 CHECK (reviews_required >= 0),
  errors_count integer NOT NULL DEFAULT 0 CHECK (errors_count >= 0),
  error_category text,
  error_summary_sanitized text,
  roster_fingerprint text,
  correlation_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, school_id, classroom_connection_id)
    REFERENCES classroom_connections(organization_id, school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, school_id, section_external_link_id)
    REFERENCES section_external_links(organization_id, school_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, school_id, id),
  CHECK ((status = 'STARTED' AND finished_at IS NULL) OR (status <> 'STARTED' AND finished_at IS NOT NULL)),
  CHECK (status <> 'SUCCESS' OR snapshot_complete = true)
);
CREATE INDEX classroom_sync_runs_link_time_idx
  ON classroom_sync_runs (section_external_link_id, started_at DESC)
  WHERE section_external_link_id IS NOT NULL;
CREATE INDEX classroom_sync_runs_connection_time_idx
  ON classroom_sync_runs (classroom_connection_id, started_at DESC);

CREATE TABLE classroom_roster_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  classroom_sync_run_id uuid NOT NULL,
  section_external_link_id uuid NOT NULL,
  google_user_id text NOT NULL CHECK (length(trim(google_user_id)) > 0),
  email_normalized text,
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  role text NOT NULL CHECK (role IN ('STUDENT', 'TEACHER')),
  observed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, school_id, classroom_sync_run_id)
    REFERENCES classroom_sync_runs(organization_id, school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, school_id, section_external_link_id)
    REFERENCES section_external_links(organization_id, school_id, id) ON DELETE RESTRICT,
  UNIQUE (classroom_sync_run_id, section_external_link_id, google_user_id, role)
);
CREATE INDEX classroom_roster_members_link_user_idx
  ON classroom_roster_members (section_external_link_id, google_user_id, observed_at DESC);

CREATE TABLE integration_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  school_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'GOOGLE_CLASSROOM' CHECK (source = 'GOOGLE_CLASSROOM'),
  review_type text NOT NULL CHECK (length(trim(review_type)) > 0),
  external_key text NOT NULL CHECK (length(trim(external_key)) > 0),
  section_external_link_id uuid,
  classroom_sync_run_id uuid,
  candidate_student_id uuid,
  candidate_section_id uuid,
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED_MATCH', 'RESOLVED_NEW', 'DISMISSED')),
  resolved_by_user_id uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, school_id, section_external_link_id)
    REFERENCES section_external_links(organization_id, school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, school_id, classroom_sync_run_id)
    REFERENCES classroom_sync_runs(organization_id, school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, candidate_student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, candidate_section_id)
    REFERENCES sections(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, resolved_by_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT,
  CHECK ((status = 'OPEN' AND resolved_at IS NULL AND resolved_by_user_id IS NULL)
      OR (status <> 'OPEN' AND resolved_at IS NOT NULL AND resolved_by_user_id IS NOT NULL))
);
CREATE INDEX integration_review_items_open_idx
  ON integration_review_items (school_id, created_at DESC)
  WHERE status = 'OPEN';
