ALTER TABLE classroom_oauth_states
  ADD COLUMN redirect_uri text NOT NULL
    CHECK (redirect_uri ~ '^https?://');
