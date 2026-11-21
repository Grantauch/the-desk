#!/usr/bin/env bash
# SW-172: read-only integrity/freshness audit of root-only ON-HOST backups.
# Runs after synthetic DB dump at 02:05 and /srv host archive at 02:15.
# Does not upload or copy any production record off this VPS.
set -Eeuo pipefail
umask 077
shopt -s nullglob

[[ "${EUID}" == 0 ]] || { echo 'BACKUP_AUDIT_FAIL: requires root' >&2; exit 2; }
for command in stat tar pg_restore cmp sqlite3 curl systemctl mktemp readlink; do
  command -v "$command" >/dev/null || { echo "BACKUP_AUDIT_FAIL: missing $command" >&2; exit 2; }
done

backup_root=/var/backups/srv
stage_root=/srv/schoolwide/data
max_age_seconds=108000  # <= 30 hours; fails after missed nightly backup.
now=$(date +%s)

check_protected() {
  local file="$1" expected="$2"
  [[ -f "$file" && ! -L "$file" ]] || { echo "BACKUP_AUDIT_FAIL: file missing/not regular: $file" >&2; exit 1; }
  [[ "$(stat -c '%U:%G' -- "$file")" == 'root:root' ]] || { echo "BACKUP_AUDIT_FAIL: owner: $file" >&2; exit 1; }
  [[ "$(stat -c '%a' -- "$file")" == "$expected" ]] || { echo "BACKUP_AUDIT_FAIL: permissions: $file" >&2; exit 1; }
  local modified age
  modified=$(stat -c '%Y' -- "$file")
  age=$((now - modified))
  (( age >= -60 && age <= max_age_seconds )) || {
    echo "BACKUP_AUDIT_FAIL: stale or future-dated file: $file; age_seconds=$age" >&2
    exit 1
  }
}

newest_file() {
  local pattern="$1" latest='' candidate
  local newest=0 changed
  for candidate in $pattern; do
    [[ -f "$candidate" && ! -L "$candidate" ]] || continue
    changed=$(stat -c '%Y' -- "$candidate")
    if (( changed >= newest )); then
      newest=$changed
      latest=$candidate
    fi
  done
  [[ -n "$latest" ]] || { echo "BACKUP_AUDIT_FAIL: no files for $pattern" >&2; exit 1; }
  printf '%s' "$latest"
}

[[ "$(stat -c '%a:%U:%G' "$backup_root")" == '700:root:root' ]] || {
  echo 'BACKUP_AUDIT_FAIL: host backup root is not restricted' >&2; exit 1;
}
[[ "$(stat -c '%a:%U:%G' "$stage_root")" == '700:root:root' ]] || {
  echo 'BACKUP_AUDIT_FAIL: staging dump root is not restricted' >&2; exit 1;
}

stage_dump=$(newest_file "$stage_root/schoolwide-synthetic-*.pgcustom")
schoolwide_archive=$(newest_file "$backup_root/schoolwide-????-??-??.tar.gz")
margin_archive=$(newest_file "$backup_root/margin-????-??-??.tar.gz")
checkaverse_archive=$(newest_file "$backup_root/checkaverse-????-??-??.tar.gz")

for file in "$stage_dump" "$schoolwide_archive" "$margin_archive" "$checkaverse_archive"; do
  check_protected "$file" 600
done

release=$(basename -- "$(readlink -f /srv/schoolwide/current)")
[[ "$release" =~ ^[a-f0-9]{40}$ ]] || { echo 'BACKUP_AUDIT_FAIL: staging release is not pinned' >&2; exit 1; }
for unit in grantdesk-schoolwide-staging.service margin.service checkaverse.service caddy.service; do
  [[ "$(systemctl is-active "$unit")" == active ]] || {
    echo "BACKUP_AUDIT_FAIL: service not active: $unit" >&2; exit 1;
  }
done
ready=$(curl --max-time 8 -fsS http://127.0.0.1:18787/health/ready)
[[ "$ready" == *'"status":"ready"'* && "$ready" == *'"deploymentTier":"staging"'* && "$ready" == *"\"releaseSha\":\"$release\""* ]] || {
  echo 'BACKUP_AUDIT_FAIL: Schoolwide staging readiness/SHA mismatch' >&2; exit 1;
}

temp_dir=$(mktemp -d)
trap 'rm -rf -- "$temp_dir"' EXIT

# Verify that the latest staged DB dump really made it into the host backup.
# The comparison is byte-for-byte, not simply checking a similar filename.
dump_path="data/$(basename -- "$stage_dump")"
tar -xOzf "$schoolwide_archive" "$dump_path" > "$temp_dir/schoolwide.pgcustom"
cmp -s -- "$stage_dump" "$temp_dir/schoolwide.pgcustom" || {
  echo 'BACKUP_AUDIT_FAIL: latest Schoolwide dump not identical in host archive' >&2; exit 1;
}
pg_restore --list "$temp_dir/schoolwide.pgcustom" >/dev/null || {
  echo 'BACKUP_AUDIT_FAIL: archived Schoolwide dump cannot be listed' >&2; exit 1;
}

# Verify production application archives without logging or uploading their data.
tar -xOzf "$margin_archive" data/margin-rooms.pgcustom > "$temp_dir/margin.pgcustom"
pg_restore --list "$temp_dir/margin.pgcustom" >/dev/null || {
  echo 'BACKUP_AUDIT_FAIL: Margin PostgreSQL dump cannot be listed' >&2; exit 1;
}
tar -xOzf "$checkaverse_archive" data/checkaverse.db > "$temp_dir/checkaverse.db"
[[ "$(sqlite3 "$temp_dir/checkaverse.db" 'PRAGMA quick_check;')" == ok ]] || {
  echo 'BACKUP_AUDIT_FAIL: Checkaverse SQLite backup failed integrity check' >&2; exit 1;
}

echo "BACKUP_AUDIT_PASS: release=$release, stage_dump=$(basename -- "$stage_dump"), host_archive=$(basename -- "$schoolwide_archive"), margin_pgcustom=valid, checkaverse_sqlite=ok, all_files_fresh_within_30h, mode_600_root_only"
echo 'LIMITATION: validates on-host archives; NOT an off-server encrypted restore or a real student-data migration.'
