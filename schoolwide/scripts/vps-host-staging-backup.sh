#!/usr/bin/env bash
# Root-only, synthetic-only PostgreSQL dump for SW-172 host-native staging.
# Run before the host's existing 02:15 /srv/*/data backup. No live school data.
set -Eeuo pipefail
umask 077

if (( EUID != 0 )); then
  echo 'Requires root for protected staging backup.' >&2
  exit 2
fi
command -v runuser >/dev/null || { echo 'runuser missing.' >&2; exit 2; }
command -v pg_restore >/dev/null || { echo 'pg_restore missing.' >&2; exit 2; }

if ! pg_lsclusters --no-header | awk '$1 == "18" && $2 == "schoolwide_stage" && $4 == "online" { found=1 } END { exit !found }'; then
  echo 'Isolated staging PostgreSQL cluster is not online.' >&2
  exit 2
fi

dest=/srv/schoolwide/data
install -d -o root -g root -m 0700 "$dest"
temp="$(mktemp "$dest/.schoolwide-dump.XXXXXXXX")"
trap 'rm -f -- "$temp"' EXIT

# Peer authenticated postgres user, fixed isolated port and database.
# No production Margin credentials or database are referenced.
runuser -u postgres -- pg_dump -h /var/run/postgresql -p 55432 \
  -d grantdesk_schoolwide_stage -Fc --no-owner --no-acl > "$temp"
test -s "$temp" || { echo 'PostgreSQL dump was empty.' >&2; exit 1; }
pg_restore --list "$temp" >/dev/null

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$dest/schoolwide-synthetic-$stamp.pgcustom"
test ! -e "$file" || { echo 'Refusing to overwrite an existing archive.' >&2; exit 1; }
chmod 0600 "$temp"
mv -- "$temp" "$file"
trap - EXIT

# Retain 14 days of local staging dumps; the 02:15 archive has its
# own 14-day rotation. Never delete the last validated dump on failure.
find "$dest" -maxdepth 1 -type f -name 'schoolwide-synthetic-*.pgcustom' -mtime +14 -delete

echo "Stage database dump format validated and archived: $file"
echo 'Archive list validation is NOT a restore test; the 02:15 host backup is separately required.'
