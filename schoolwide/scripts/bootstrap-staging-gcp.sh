#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-grantdesk-deployment}"
REGION="${REGION:-us-central1}"
GITHUB_REPO="${GITHUB_REPO:-Grantauch/the-desk}"
ARTIFACT_REPO="${ARTIFACT_REPO:-grantdesk-schoolwide}"
SQL_INSTANCE="${SQL_INSTANCE:-grantdesk-schoolwide-staging}"
DB_NAME="${DB_NAME:-grantdesk_schoolwide}"
DB_USER="${DB_USER:-grantdesk_app}"
DB_SECRET="${DB_SECRET:-grantdesk-schoolwide-staging-db-url}"
RUNTIME_SA_ID="${RUNTIME_SA_ID:-grantdesk-sw-runtime}"
DEPLOY_SA_ID="${DEPLOY_SA_ID:-grantdesk-sw-deploy}"
WIF_POOL_ID="${WIF_POOL_ID:-github-actions}"
WIF_PROVIDER_ID="${WIF_PROVIDER_ID:-grantdesk-the-desk}"
CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-grantdesk-schoolwide-staging}"
MIGRATION_JOB="${MIGRATION_JOB:-grantdesk-schoolwide-staging-migrate}"

say() { printf '\n==> %s\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

cat <<EOF
GrantDesk Schoolwide — SW-170 staging bootstrap

Project:      ${PROJECT_ID}
Region:       ${REGION}
GitHub repo:  ${GITHUB_REPO}

This creates ONLY isolated staging infrastructure.
It does NOT deploy to the live Hall Pass, change the Apps Script workbook,
load real student/staff data, or make Schoolwide authoritative.

Expected standing cost is primarily the small Cloud SQL staging database.
EOF

if [[ "${SKIP_CONFIRMATION:-false}" != "true" ]]; then
  printf '\nType CREATE-STAGING to continue: '
  read -r confirmation
  [[ "$confirmation" == "CREATE-STAGING" ]] || { echo 'Cancelled.'; exit 1; }
fi

say 'Selecting Google Cloud project'
gcloud config set project "$PROJECT_ID" >/dev/null

say 'Checking that billing is enabled'
BILLING_ENABLED="$(gcloud beta billing projects describe "$PROJECT_ID" --format='value(billingEnabled)' 2>/dev/null || true)"
if [[ "$BILLING_ENABLED" != "True" && "$BILLING_ENABLED" != "true" ]]; then
  echo "Billing is not reported as enabled for ${PROJECT_ID}. Stop here and link the paid billing account first." >&2
  exit 1
fi

say 'Enabling only the APIs SW-170 staging needs'
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project "$PROJECT_ID"

say 'Creating Artifact Registry repository if needed'
if ! exists gcloud artifacts repositories describe "$ARTIFACT_REPO" --location "$REGION" --project "$PROJECT_ID"; then
  gcloud artifacts repositories create "$ARTIFACT_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description='GrantDesk Schoolwide staging images' \
    --project "$PROJECT_ID"
fi

say 'Creating small protected Cloud SQL PostgreSQL 18 staging instance if needed'
if ! exists gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID"; then
  gcloud sql instances create "$SQL_INSTANCE" \
    --project "$PROJECT_ID" \
    --database-version=POSTGRES_18 \
    --edition=enterprise \
    --tier=db-f1-micro \
    --region="$REGION" \
    --availability-type=ZONAL \
    --storage-type=SSD \
    --storage-size=10 \
    --storage-auto-increase \
    --backup-start-time=07:00 \
    --retained-backups-count=7 \
    --enable-point-in-time-recovery \
    --retained-transaction-log-days=7 \
    --deletion-protection
fi

say 'Verifying Cloud SQL data-protection settings'
gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --format=json > /tmp/grantdesk-sw170-sql.json
python3 - /tmp/grantdesk-sw170-sql.json <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as handle:
    instance = json.load(handle)
settings = instance.get('settings') or {}
backup = settings.get('backupConfiguration') or {}
failures = []
if backup.get('enabled') is not True:
    failures.append('automated backups are not enabled')
if backup.get('pointInTimeRecoveryEnabled') is not True:
    failures.append('point-in-time recovery is not enabled')
if settings.get('deletionProtectionEnabled') is not True:
    failures.append('deletion protection is not enabled')
if failures:
    raise SystemExit('Cloud SQL protection gate failed: ' + '; '.join(failures))
print('Cloud SQL data-protection gate PASS')
PY
rm -f /tmp/grantdesk-sw170-sql.json

say 'Creating Schoolwide staging database if needed'
if ! gcloud sql databases list --instance "$SQL_INSTANCE" --project "$PROJECT_ID" --format='value(name)' | grep -Fxq "$DB_NAME"; then
  gcloud sql databases create "$DB_NAME" --instance "$SQL_INSTANCE" --project "$PROJECT_ID"
fi

say 'Creating or preserving the bounded Schoolwide database user and Secret Manager value'
if ! exists gcloud secrets describe "$DB_SECRET" --project "$PROJECT_ID"; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  if gcloud sql users list --instance "$SQL_INSTANCE" --project "$PROJECT_ID" --format='value(name)' | grep -Fxq "$DB_USER"; then
    gcloud sql users set-password "$DB_USER" --instance "$SQL_INSTANCE" --password "$DB_PASSWORD" --project "$PROJECT_ID"
  else
    gcloud sql users create "$DB_USER" --instance "$SQL_INSTANCE" --password "$DB_PASSWORD" --project "$PROJECT_ID"
  fi
  gcloud secrets create "$DB_SECRET" --replication-policy=automatic --project "$PROJECT_ID"
  printf 'postgresql://%s:%s@localhost/%s' "$DB_USER" "$DB_PASSWORD" "$DB_NAME" | \
    gcloud secrets versions add "$DB_SECRET" --data-file=- --project "$PROJECT_ID"
  unset DB_PASSWORD
else
  echo "Secret ${DB_SECRET} already exists; database credentials were not rotated."
fi

RUNTIME_SA_EMAIL="${RUNTIME_SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOY_SA_EMAIL="${DEPLOY_SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

say 'Creating limited runtime and deployment service accounts if needed'
if ! exists gcloud iam service-accounts describe "$RUNTIME_SA_EMAIL" --project "$PROJECT_ID"; then
  gcloud iam service-accounts create "$RUNTIME_SA_ID" --display-name='GrantDesk Schoolwide staging runtime' --project "$PROJECT_ID"
fi
if ! exists gcloud iam service-accounts describe "$DEPLOY_SA_EMAIL" --project "$PROJECT_ID"; then
  gcloud iam service-accounts create "$DEPLOY_SA_ID" --display-name='GrantDesk Schoolwide staging deployer' --project "$PROJECT_ID"
fi

say 'Granting the runtime account only database + staging secret access'
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role='roles/cloudsql.client' \
  --condition=None >/dev/null

gcloud secrets add-iam-policy-binding "$DB_SECRET" \
  --project "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role='roles/secretmanager.secretAccessor' >/dev/null

say 'Granting the deployment account bounded staging-release permissions'
for role in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/cloudsql.viewer \
  roles/secretmanager.viewer \
  roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
    --role="$role" \
    --condition=None >/dev/null
done

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA_EMAIL" \
  --project "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role='roles/iam.serviceAccountUser' >/dev/null

say 'Creating GitHub Workload Identity Federation pool/provider if needed'
if ! exists gcloud iam workload-identity-pools describe "$WIF_POOL_ID" --location=global --project "$PROJECT_ID"; then
  gcloud iam workload-identity-pools create "$WIF_POOL_ID" \
    --project "$PROJECT_ID" \
    --location=global \
    --display-name='GitHub Actions'
fi

if ! exists gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER_ID" --workload-identity-pool "$WIF_POOL_ID" --location=global --project "$PROJECT_ID"; then
  gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER_ID" \
    --project "$PROJECT_ID" \
    --location=global \
    --workload-identity-pool="$WIF_POOL_ID" \
    --display-name='GrantDesk the-desk GitHub' \
    --issuer-uri='https://token.actions.githubusercontent.com/' \
    --attribute-mapping='google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner' \
    --attribute-condition="assertion.repository == '${GITHUB_REPO}'"
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
POOL_NAME="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}"
PROVIDER_NAME="$(gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER_ID" \
  --project "$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$WIF_POOL_ID" \
  --format='value(name)')"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
  --project "$PROJECT_ID" \
  --role='roles/iam.workloadIdentityUser' \
  --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/${GITHUB_REPO}" >/dev/null

SQL_CONNECTION="$(gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --format='value(connectionName)')"

say 'SW-170 cloud foundation created successfully'
cat <<EOF

COPY THE BLOCK BELOW BACK INTO CHATGPT:

SW170_CLOUD_READY
GCP_PROJECT_ID=${PROJECT_ID}
GCP_REGION=${REGION}
GCP_WORKLOAD_IDENTITY_PROVIDER=${PROVIDER_NAME}
GCP_DEPLOY_SERVICE_ACCOUNT=${DEPLOY_SA_EMAIL}
GCP_ARTIFACT_REPOSITORY=${ARTIFACT_REPO}
GCP_CLOUD_RUN_SERVICE=${CLOUD_RUN_SERVICE}
GCP_CLOUD_RUN_MIGRATION_JOB=${MIGRATION_JOB}
GCP_CLOUD_SQL_CONNECTION=${SQL_CONNECTION}
GCP_RUNTIME_SERVICE_ACCOUNT=${RUNTIME_SA_EMAIL}
GCP_DATABASE_URL_SECRET=${DB_SECRET}

No credential secret is printed in this block.
EOF
