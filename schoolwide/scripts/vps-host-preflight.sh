#!/usr/bin/env bash
# Read-only VPS host readiness check. Does not read environment files or credentials.
set -Eeuo pipefail

errors=0
warn() { printf 'WARN: %s\n' "$*"; }
fail() { printf 'BLOCK: %s\n' "$*"; errors=$((errors + 1)); }
ok() { printf 'OK: %s\n' "$*"; }

echo 'GrantDesk Schoolwide SW-172 read-only VPS preflight (no changes performed)'
echo 'Expected host: isolated OVH VPS; existing Margin service must remain running.'
echo

if [[ -r /proc/meminfo ]]; then
  mem_total_kib="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
  mem_available_kib="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
  printf 'RAM: %s MiB total, %s MiB currently available\n' "$((mem_total_kib/1024))" "$((mem_available_kib/1024))"
  if (( mem_available_kib < 2 * 1024 * 1024 )); then
    fail 'Under 2 GiB RAM available; investigate Margin and other workloads before adding staging.'
  fi
else
  warn 'Unable to inspect host memory.'
fi

if command -v nproc >/dev/null 2>&1; then
  printf 'Logical CPUs: %s\n' "$(nproc)"
fi
if command -v df >/dev/null 2>&1; then
  free_kib="$(df -Pk /srv | awk 'NR==2 {print $4}')"
  printf 'Available space on /srv filesystem: %s GiB\n' "$((free_kib/1024/1024))"
  if (( free_kib < 12 * 1024 * 1024 )); then
    fail 'Under 12 GiB free on /srv filesystem; no VPS staging deployment.'
  fi
fi

if command -v systemctl >/dev/null 2>&1; then
  for service in margin.service caddy.service; do
    if systemctl is-active --quiet "$service"; then
      ok "$service active"
    else
      fail "$service not active; protect the existing Margin app before deploying."
    fi
  done
  for service in postgresql.service margin-deploy.timer; do
    state="$(systemctl is-active "$service" 2>/dev/null || true)"
    printf 'INFO: %s is %s\n' "$service" "${state:-unknown}"
  done
else
  warn 'systemctl not available; cannot verify service state.'
fi

if [[ "${SCHOOLWIDE_STAGING_MODE:-docker}" == "vps-host" ]]; then
  for binary in pg_createcluster pg_lsclusters systemctl node npm; do
    if command -v "$binary" >/dev/null 2>&1; then
      ok "$binary available for systemd host staging"
    else
      fail "$binary unavailable for systemd host staging."
    fi
  done
  if [[ -n "$(ss -ltnH '( sport = :55432 )' 2>/dev/null)" ]]; then
    warn 'Dedicated PostgreSQL 55432 already listening; confirm it is the Schoolwide staging cluster.'
  else
    ok 'Dedicated PostgreSQL staging port 55432 is free'
  fi
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  ok 'Docker Compose available'
else
  fail 'Docker Compose unavailable; choose vps-host mode or install Docker separately.'
fi

if command -v ss >/dev/null 2>&1; then
  if [[ -n "$(ss -ltnH '( sport = :18787 )')" ]]; then
    fail 'Port 18787 already has a TCP listener; check collision without stopping any service.'
  else
    ok 'Loopback staging port 18787 has no listening process'
  fi
else
  warn 'Cannot verify port 18787 because ss is unavailable.'
fi

if [[ -d /srv/margin ]]; then
  ok 'Margin installation directory exists'
else
  fail 'Expected /srv/margin directory missing.'
fi

if [[ -d /srv/schoolwide/data ]]; then
  ok '/srv/schoolwide/data exists (confirm backup coverage separately)'
else
  warn '/srv/schoolwide/data absent; the backup job must be provisioned before staging.'
fi

echo
if (( errors > 0 )); then
  printf 'RESULT: BLOCKED (%s blocking condition(s)). No changes performed.\n' "$errors"
  exit 2
fi
echo 'RESULT: preliminary host checks passed. No changes performed.'
echo 'This is NOT evidence of restored backups, TLS/authorization, classroom load or student-data readiness.'
