#!/usr/bin/env bash
# Synthetic-only SW-172 backup. It does NOT back up the existing Margin database.
# Usage: run from the reviewed source checkout on the VPS before the 02:15 /srv backup.
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="$ROOT/deploy/vps-staging.compose.yml"
ENV_FILE="${SCHOOLWIDE_ENV_FILE:-$ROOT/deploy/.env.vps-stage}"
BACKUP_DIR="${SCHOOLWIDE_BACKUP_DIR:-/srv/schoolwide/data/backups}"

if [[ ! -f "$ENV_FILE" || ! -f "$COMPOSE" ]]; then
  printf 'Missing private staging environment file or Compose definition.\n' >&2
  exit 2
fi
if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is required to dump the staging database.\n' >&2
  exit 2
fi

install -d -m 0700 "$BACKUP_DIR"
TEMP="$(mktemp "$BACKUP_DIR/.stage-backup.XXXXXX")"
trap 'rm -f "$TEMP"' EXIT

# Password stays inside the running container; never print it or expose it as an argument.
docker compose --env-file "$ENV_FILE" -f "$COMPOSE" exec -T postgres sh -c \
  'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl' > "$TEMP"
if [[ ! -s "$TEMP" ]]; then
  printf 'Backup unexpectedly empty; refusing to certify.\n' >&2
  exit 1
fi

# Archive listing checks readability, not a full restore. A restore rehearsal is mandatory.
docker compose --env-file "$ENV_FILE" -f "$COMPOSE" exec -T postgres pg_restore -l < "$TEMP" >/dev/null
DEST="$BACKUP_DIR/schoolwide-staging-$(date -u +%Y%m%dT%H%M%SZ).dump"
if [[ -e "$DEST" ]]; then
  printf 'Refusing to overwrite an existing backup.\n' >&2
  exit 1
fi
mv -- "$TEMP" "$DEST"
chmod 0600 "$DEST"
printf 'Synthetic staging PostgreSQL dump archived and format-checked: %s\n' "$DEST"
printf 'IMPORTANT: format verification is NOT a restore test, and local dumps alone are NOT offsite backups.\n'
