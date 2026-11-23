#!/usr/bin/env bash
# SW-183: separate GitHub-hosted runners, fictional DB only.
# The PUBLIC static test password is NOT a secret and proves no key custody.
set -Eeuo pipefail
umask 077
mode="${1:-}"
if [[ "$mode" != export && "$mode" != restore ]]; then
  echo "SW183_USAGE: export or restore" >&2; exit 2
fi
# Deny before filesystem, process, or database access.
if [[ "${GITHUB_ACTIONS:-}" != true || "${CI:-}" != true \
  || "${RUNNER_OS:-}" != Linux || "${RUNNER_ENVIRONMENT:-}" != github-hosted \
  || "${NODE_ENV:-}" != test || "${SCHOOLWIDE_CROSS_RUNNER_SYNTHETIC:-}" != true \
  || "${LEGACY_PRODUCTION_WRITES:-}" != forbidden \
  || ! "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ || ! "${GITHUB_SHA:-}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "SW183_CI_ONLY_DENIED" >&2; exit 3
fi
readonly SRC='postgresql://grantdesk:grantdesk@127.0.0.1:5432/grantdesk_schoolwide_export_ci'
readonly DEST='postgresql://grantdesk:grantdesk@127.0.0.1:5432/grantdesk_schoolwide_restore_ci'
if [[ "$mode" == export ]]; then
  if [[ "${GITHUB_JOB:-}" != package_synthetic || "${DATABASE_URL:-}" != "$SRC" ]]; then
    echo "SW183_WRONG_SOURCE_SCOPE" >&2; exit 3
  fi
  db=grantdesk_schoolwide_export_ci
else
  if [[ "${GITHUB_JOB:-}" != restore_synthetic || "${DATABASE_URL:-}" != "$DEST" ]]; then
    echo "SW183_WRONG_RESTORE_SCOPE" >&2; exit 3
  fi
  db=grantdesk_schoolwide_restore_ci
fi
for binary in docker gpg sha256sum python3 mktemp; do
  command -v "$binary" >/dev/null || { echo "SW183_MISSING_TOOL: $binary" >&2; exit 2; }
done
readonly TEST_KEY='SW183_PUBLIC_FICTIONAL_CI_PASSPHRASE_NOT_A_REAL_SECRET_2026'
readonly bundle='out/sw183-cross-runner'
readonly ciphertext="$bundle/synthetic.pgcustom.gpg"
readonly manifest="$bundle/manifest.json"
mkdir -p "$bundle"
scratch="$(mktemp -d)"
cleanup() { rc="$?"; trap - EXIT; rm -rf -- "$scratch"; exit "$rc"; }
trap cleanup EXIT
printf '%s' "$TEST_KEY" > "$scratch/public-key"
chmod 600 "$scratch/public-key"
pg_client() { docker run --rm -i --network host -e PGPASSWORD=grantdesk postgres:18-alpine "$@"; }
psql_ci() { pg_client psql -X -A -t -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -U grantdesk -d "$db" "$@"; }
table_count() { psql_ci -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'"; }
migration_count() { psql_ci -c "SELECT count(*) FROM grantdesk_schema_migrations"; }
canary_count() { psql_ci -c "SELECT count(*) FROM sw183_cross_runner_canary"; }
canary_hash() {
  psql_ci -c "SELECT item_id||':'||fictional_value FROM sw183_cross_runner_canary ORDER BY item_id" |
    sha256sum | cut -d' ' -f1
}
assert_no_school_records() {
  total="$(psql_ci -c "SELECT
    (SELECT count(*) FROM students) + (SELECT count(*) FROM student_credentials) +
    (SELECT count(*) FROM organizations) + (SELECT count(*) FROM checkins) +
    (SELECT count(*) FROM pass_events)")"
  [[ "$total" == 0 ]] || { echo "SW183_NONFICTIONAL_RECORDS_DENIED" >&2; exit 4; }
}
if [[ "$mode" == export ]]; then
  [[ ! -e "$ciphertext" && ! -e "$manifest" ]] || { echo "SW183_EXPORT_EXISTS" >&2; exit 4; }
  [[ "$(migration_count)" -ge 20 ]] || { echo "SW183_MIGRATIONS_MISSING" >&2; exit 4; }
  assert_no_school_records
  psql_ci -c "CREATE TABLE sw183_cross_runner_canary (
      item_id integer PRIMARY KEY, fictional_value text NOT NULL
    );
    INSERT INTO sw183_cross_runner_canary(item_id,fictional_value) VALUES
      (1,'fictional-alpha'),(2,'fictional-beta'),(3,'fictional-gamma');" >/dev/null
  tables="$(table_count)"; migrations="$(migration_count)"
  records="$(canary_count)"; fingerprint="$(canary_hash)"
  [[ "$tables" -ge 54 && "$migrations" -ge 20 && "$records" == 3 ]] || {
    echo "SW183_SOURCE_INCOMPLETE" >&2; exit 4
  }
  pg_client pg_dump -Fc --no-owner --no-acl -h 127.0.0.1 -U grantdesk -d "$db" > "$scratch/clear.pgcustom"
  [[ -s "$scratch/clear.pgcustom" ]] || { echo "SW183_EMPTY_DUMP" >&2; exit 4; }
  pg_client pg_restore --list < "$scratch/clear.pgcustom" >/dev/null
  gpg --batch --yes --no-tty --pinentry-mode loopback --passphrase-file "$scratch/public-key" \
    --symmetric --cipher-algo AES256 --s2k-mode 3 --s2k-digest-algo SHA512 \
    --s2k-count 65011712 --output "$ciphertext" "$scratch/clear.pgcustom"
  [[ -s "$ciphertext" ]] || { echo "SW183_ENCRYPT_FAILED" >&2; exit 4; }
  if grep -aFq fictional-alpha "$ciphertext"; then echo "SW183_PLAINTEXT_LEAK" >&2; exit 4; fi
  digest="$(sha256sum "$ciphertext" | cut -d' ' -f1)"
  python3 - "$manifest" "$digest" "$tables" "$migrations" "$records" "$fingerprint" "$GITHUB_SHA" "$GITHUB_RUN_ID" <<'PY'
import json, sys
from pathlib import Path
p, digest, tables, migrations, records, fingerprint, sha, run = sys.argv[1:]
m = dict(type="SW183_PUBLIC_FICTIONAL_TEST_ONLY", producer_job="package_synthetic",
         run_id=run, commit=sha, ciphertext_sha256=digest, table_count=int(tables),
         migration_count=int(migrations), canary_count=int(records), canary_sha256=fingerprint)
Path(p).write_text(json.dumps(m, sort_keys=True, indent=2) + "\n")
PY
  echo "SW183_SYNTHETIC_EXPORT_PASS: ciphertext_artifact_only=true tables=$tables migrations=$migrations fictional_records=$records"
  echo "LIMITATION: encryption uses a public test key; zero production confidentiality evidence."
  exit 0
fi
[[ -s "$ciphertext" && -s "$manifest" ]] || { echo "SW183_ARTIFACT_MISSING" >&2; exit 4; }
python3 - "$manifest" "$ciphertext" "$GITHUB_SHA" "$GITHUB_RUN_ID" "$scratch/expect" <<'PY'
import hashlib, json, re, sys
from pathlib import Path
m = json.loads(Path(sys.argv[1]).read_text())
expected = {"type", "producer_job", "run_id", "commit", "ciphertext_sha256",
            "table_count", "migration_count", "canary_count", "canary_sha256"}
if set(m) != expected or m["type"] != "SW183_PUBLIC_FICTIONAL_TEST_ONLY" or m["producer_job"] != "package_synthetic":
    raise SystemExit("SW183_ARTIFACT_KIND_DENIED")
if m["run_id"] != sys.argv[4] or m["commit"] != sys.argv[3]:
    raise SystemExit("SW183_ARTIFACT_RUN_MISMATCH")
for key in ("ciphertext_sha256", "canary_sha256"):
    if not isinstance(m[key], str) or not re.fullmatch("[0-9a-f]{64}", m[key]):
        raise SystemExit("SW183_ARTIFACT_DIGEST_INVALID")
if hashlib.sha256(Path(sys.argv[2]).read_bytes()).hexdigest() != m["ciphertext_sha256"]:
    raise SystemExit("SW183_ARTIFACT_HASH_MISMATCH")
if not (type(m["table_count"]) is int and m["table_count"] >= 54
        and type(m["migration_count"]) is int and m["migration_count"] >= 20
        and type(m["canary_count"]) is int and m["canary_count"] == 3):
    raise SystemExit("SW183_ARTIFACT_SCHEMA_INVALID")
Path(sys.argv[5]).write_text("\n".join(map(str, [m["table_count"],m["migration_count"],
                      m["canary_count"],m["canary_sha256"]])) + "\n")
PY
mapfile -t expect < "$scratch/expect"
[[ "$(table_count)" == 0 ]] || { echo "SW183_DESTINATION_NOT_EMPTY" >&2; exit 4; }
gpg --batch --yes --no-tty --pinentry-mode loopback --passphrase-file "$scratch/public-key" \
  --output "$scratch/recovered.pgcustom" --decrypt "$ciphertext" >/dev/null 2>&1
printf 'SW183_WRONG_PUBLIC_KEY' > "$scratch/wrong-key"
if gpg --batch --yes --no-tty --pinentry-mode loopback --passphrase-file "$scratch/wrong-key" \
  --output "$scratch/invalid" --decrypt "$ciphertext" >/dev/null 2>&1; then
  echo "SW183_WRONG_KEY_ACCEPTED" >&2; exit 4
fi
rm -f -- "$scratch/invalid"
python3 - "$ciphertext" "$scratch/tampered.gpg" <<'PY'
from pathlib import Path
import sys
b = bytearray(Path(sys.argv[1]).read_bytes())
assert len(b) > 64
b[-3] ^= 1
Path(sys.argv[2]).write_bytes(b)
PY
if gpg --batch --yes --no-tty --pinentry-mode loopback --passphrase-file "$scratch/public-key" \
  --output "$scratch/invalid" --decrypt "$scratch/tampered.gpg" >/dev/null 2>&1; then
  echo "SW183_TAMPER_ACCEPTED" >&2; exit 4
fi
rm -f -- "$scratch/invalid"
pg_client pg_restore -h 127.0.0.1 -U grantdesk -d "$db" \
  --exit-on-error --no-owner --no-privileges < "$scratch/recovered.pgcustom" >/dev/null
assert_no_school_records
tables="$(table_count)"; migrations="$(migration_count)"
records="$(canary_count)"; fingerprint="$(canary_hash)"
[[ "$tables" == "${expect[0]}" && "$migrations" == "${expect[1]}" \
  && "$records" == "${expect[2]}" && "$fingerprint" == "${expect[3]}" ]] || {
  echo "SW183_RESTORE_CONTENT_MISMATCH" >&2; exit 4
}
echo "SW183_CROSS_RUNNER_RESTORE_PASS: independent_job=true artifact_verified=true tables=$tables migrations=$migrations fictional_records=$records wrong_key_rejected=true tamper_rejected=true school_records=0"
echo "LIMITATION: not a production encrypted offsite backup, key custody, or a separate-machine disaster recovery certification."
