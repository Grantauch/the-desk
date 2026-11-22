#!/usr/bin/env bash
# SW-180: CI-ONLY synthetic encrypted backup / clean-container restore.
# NEVER use this script against the VPS, student information or production.
set -Ee -o pipefail
umask 077

# Fail closed BEFORE accessing Docker, databases, GPG or any filesystem.
if [[ "$GITHUB_ACTIONS" != "true" || "$CI" != "true" \
  || "$RUNNER_OS" != "Linux" || "$NODE_ENV" != "test" \
  || "$SCHOOLWIDE_SYNTHETIC_RECOVERY" != "true" \
  || "$LEGACY_PRODUCTION_WRITES" != "forbidden" \
  || "$DATABASE_URL" != "postgresql://grantdesk:grantdesk@127.0.0.1:5432/grantdesk_schoolwide" ]]; then
  echo "SW180_CI_ONLY_DENIED: requires the exact isolated GitHub Actions test database and explicit synthetic consent." >&2
  exit 3
fi
set -u

for binary in docker gpg openssl sha256sum mktemp python3 npm; do
  command -v "$binary" >/dev/null || { echo "SW180_MISSING_TOOL: $binary" >&2; exit 2; }
done

# Only ephemeral CI-created databases; never enumerate or copy other databases.
source_db="sw180_ci_source"
restore_db="sw180_ci_restored"
container="sw180-restore-$GITHUB_RUN_ID"
scratch="$(mktemp -d)"
created_source=0
cleanup() {
  local status="$?"
  trap - EXIT
  set +e
  docker rm -fv "$container" >/dev/null 2>&1
  if [[ "$created_source" == "1" ]]; then
    source_pg psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U grantdesk \
      -d postgres -c "DROP DATABASE $source_db WITH (FORCE)" >/dev/null 2>&1
  fi
  rm -rf -- "$scratch"
  exit "$status"
}
trap cleanup EXIT

# Use the same PostgreSQL 18 client version as the CI service. The source
# service is mapped to *the GitHub runner* on localhost, never a real host.
source_pg() {
  docker run --rm -i --network host -e PGPASSWORD=grantdesk postgres:18-alpine "$@"
}
source_psql() {
  source_pg psql -X -A -t -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -U grantdesk \
    -d "$source_db" "$@"
}
restore_psql() {
  docker exec "$container" psql -X -A -t -q -v ON_ERROR_STOP=1 \
    -U sw180_restore -d "$restore_db" "$@"
}

source_pg psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U grantdesk \
  -d postgres -c "CREATE DATABASE $source_db" >/dev/null
created_source=1

# Run all Schoolwide migrations inside this throwaway DB, rather than using
# a handwritten stand-in schema. The temporary canary is fictional only.
DATABASE_URL="postgresql://grantdesk:grantdesk@127.0.0.1:5432/$source_db" \
  npm run db:migrate >/dev/null
source_psql -c "
CREATE TABLE sw180_synthetic_canary (
  line_id integer PRIMARY KEY,
  fictional_value text NOT NULL
);
INSERT INTO sw180_synthetic_canary(line_id,fictional_value) VALUES
  (1,'synthetic-classroom-a'),
  (2,'synthetic-classroom-b'),
  (3,'synthetic-classroom-c');" >/dev/null

expected_tables="$(source_psql -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'")"
expected_migrations="$(source_psql -c "SELECT count(*) FROM grantdesk_schema_migrations")"
expected_count="$(source_psql -c "SELECT count(*) FROM sw180_synthetic_canary")"
expected_digest="$(source_psql -c "SELECT line_id||':'||fictional_value FROM sw180_synthetic_canary ORDER BY line_id" | sha256sum | cut -d' ' -f1)"
[[ "$expected_tables" -ge 50 && "$expected_migrations" -ge 20 && "$expected_count" == 3 ]] || {
  echo 'SW180_SOURCE_NOT_READY: expected complete Schoolwide migrations and three fake canary records.' >&2
  exit 1
}

# The cleartext dump is transient and scoped to this isolated fake DB.
dump="$scratch/synthetic.pgcustom"
encrypted="$scratch/synthetic.pgcustom.gpg"
source_pg pg_dump -h 127.0.0.1 -U grantdesk -d "$source_db" \
  -Fc --no-owner --no-acl > "$dump"
[[ -s "$dump" ]] || { echo 'SW180_EMPTY_DUMP' >&2; exit 1; }
source_pg pg_restore --list < "$dump" >/dev/null

# GPG/OpenPGP standard AES-256 symmetric encryption, with an ephemeral random
# 384-bit test passphrase. No production key or secrets store is touched.
mkdir -m 700 "$scratch/gnupg"
export GNUPGHOME="$scratch/gnupg"
openssl rand -hex 48 > "$scratch/passphrase"
openssl rand -hex 48 > "$scratch/wrong-passphrase"
chmod 600 "$scratch/passphrase" "$scratch/wrong-passphrase"
gpg --batch --yes --no-tty --pinentry-mode loopback \
  --passphrase-file "$scratch/passphrase" \
  --symmetric --cipher-algo AES256 --s2k-mode 3 --s2k-digest-algo SHA512 \
  --s2k-count 65011712 --output "$encrypted" "$dump"
[[ -s "$encrypted" ]] || { echo 'SW180_ENCRYPTION_FAILED' >&2; exit 1; }
! cmp -s -- "$dump" "$encrypted" || { echo 'SW180_NOT_ENCRYPTED' >&2; exit 1; }
if grep -aF -q 'synthetic-classroom-a' "$encrypted"; then
  echo 'SW180_CLEAR_CANARY_LEAKED' >&2; exit 1
fi

# Wrong test key must never recover the dump.
if gpg --batch --yes --no-tty --pinentry-mode loopback \
   --passphrase-file "$scratch/wrong-passphrase" --output "$scratch/invalid.dump" \
   --decrypt "$encrypted" >/dev/null 2>&1; then
  echo 'SW180_WRONG_KEY_ACCEPTED' >&2; exit 1
fi
rm -f "$scratch/invalid.dump"

# Change an actual encrypted byte near the tail, guaranteeing a changed file.
python3 - "$encrypted" "$scratch/tampered.gpg" <<'PY'
from pathlib import Path
import sys
p = bytearray(Path(sys.argv[1]).read_bytes())
assert len(p) > 64
p[-3] ^= 1
Path(sys.argv[2]).write_bytes(p)
PY
if gpg --batch --yes --no-tty --pinentry-mode loopback \
   --passphrase-file "$scratch/passphrase" --output "$scratch/invalid.dump" \
   --decrypt "$scratch/tampered.gpg" >/dev/null 2>&1; then
  echo 'SW180_TAMPER_ACCEPTED' >&2; exit 1
fi
rm -f "$scratch/invalid.dump"

# Simulate the separate recovery destination with a newly initialized Postgres
# 18 container, zero published ports and no network access, not a second DB on
# the same running source cluster. Docker volume is destroyed at the end.
docker run -d --name "$container" --network none \
  -e POSTGRES_USER=sw180_restore \
  -e POSTGRES_PASSWORD=synthetic_ci_only_not_a_real_secret \
  -e POSTGRES_DB="$restore_db" postgres:18-alpine >/dev/null
ready=0
for attempt in $(seq 1 60); do
  if docker exec "$container" pg_isready -U sw180_restore -d "$restore_db" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.5
done
[[ "$ready" == 1 ]] || { echo 'SW180_CLEAN_RESTORE_DB_NOT_READY' >&2; exit 1; }
pre_tables="$(restore_psql -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'")"
[[ "$pre_tables" == 0 ]] || { echo 'SW180_RESTORE_DB_NOT_CLEAN' >&2; exit 1; }

gpg --batch --yes --no-tty --pinentry-mode loopback \
  --passphrase-file "$scratch/passphrase" \
  --output "$scratch/recovered.pgcustom" --decrypt "$encrypted" >/dev/null 2>&1
cmp -s "$dump" "$scratch/recovered.pgcustom" || {
  echo 'SW180_DECRYPTED_DUMP_HASH_MISMATCH' >&2
  exit 1
}
docker exec -i "$container" pg_restore -U sw180_restore -d "$restore_db" \
  --exit-on-error --no-owner --no-privileges < "$scratch/recovered.pgcustom" >/dev/null

actual_tables="$(restore_psql -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'")"
actual_migrations="$(restore_psql -c "SELECT count(*) FROM grantdesk_schema_migrations")"
actual_count="$(restore_psql -c "SELECT count(*) FROM sw180_synthetic_canary")"
actual_digest="$(restore_psql -c "SELECT line_id||':'||fictional_value FROM sw180_synthetic_canary ORDER BY line_id" | sha256sum | cut -d' ' -f1)"
[[ "$expected_tables" == "$actual_tables" \
  && "$expected_migrations" == "$actual_migrations" \
  && "$expected_count" == "$actual_count" \
  && "$expected_digest" == "$actual_digest" ]] || {
  echo 'SW180_RESTORE_MISMATCH: synthetic schema/migrations/canary did not match.' >&2
  exit 1
}
echo "SW180_CI_SYNTHETIC_ENCRYPTED_RESTORE_PASS: fresh_container=true network_none=true source_tables=$expected_tables migration_count=$expected_migrations fictional_records=$expected_count wrong_key_rejected=true tamper_rejected=true"
echo 'LIMITATION: CI synthetic restore only; does NOT prove actual off-server encryption, backup retention, clean-machine disaster recovery, key escrow or district authorization.'
