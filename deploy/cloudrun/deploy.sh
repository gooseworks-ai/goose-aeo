#!/usr/bin/env bash
set -euo pipefail

# Required inputs
: "${PROJECT_ID:?Set PROJECT_ID}"
: "${REGION:=us-central1}"
: "${REPO_NAME:=goose-aeo}"
: "${SERVICE_NAME:=goose-aeo-dashboard}"
: "${JOB_NAME:=goose-aeo-weekly}"
: "${SERVICE_ACCOUNT:=goose-aeo-runtime@${PROJECT_ID}.iam.gserviceaccount.com}"
: "${BUCKET_NAME:=goose-aeo-data-${PROJECT_ID}}"
: "${DATA_MOUNT_PATH:=/var/lib/goose-aeo}"

# Secret names (create in Secret Manager before deploy)
: "${OPENAI_SECRET:=GOOSE_AEO_OPENAI_API_KEY}"
: "${PERPLEXITY_SECRET:=GOOSE_AEO_PERPLEXITY_API_KEY}"
: "${CLAUDE_SECRET:=GOOSE_AEO_CLAUDE_API_KEY}"
: "${GEMINI_SECRET:=GOOSE_AEO_GEMINI_API_KEY}"
: "${GROK_SECRET:=GOOSE_AEO_GROK_API_KEY}"
: "${BASIC_AUTH_USER_SECRET:=GOOSE_AEO_DASHBOARD_BASIC_AUTH_USER}"
: "${BASIC_AUTH_PASSWORD_SECRET:=GOOSE_AEO_DASHBOARD_BASIC_AUTH_PASSWORD}"
: "${ALLOWED_EMAIL_DOMAIN_SECRET:=GOOSE_AEO_DASHBOARD_ALLOWED_EMAIL_DOMAIN}"
: "${SHARED_PASSWORD_SECRET:=GOOSE_AEO_DASHBOARD_SHARED_PASSWORD}"

DASHBOARD_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/dashboard:latest"
RUNNER_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/runner:latest"

echo "Enabling required APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com storage.googleapis.com --project "${PROJECT_ID}"

echo "Ensuring Artifact Registry repository exists..."
if ! gcloud artifacts repositories describe "${REPO_NAME}" \
  --location "${REGION}" \
  --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO_NAME}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project "${PROJECT_ID}"
fi

echo "Ensuring storage bucket exists..."
if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET_NAME}" --location="${REGION}" --project "${PROJECT_ID}"
fi

echo "Building dashboard image..."
gcloud builds submit --project "${PROJECT_ID}" --tag "${DASHBOARD_IMAGE}" --file deploy/cloudrun/dashboard.Dockerfile .

echo "Building weekly runner image..."
gcloud builds submit --project "${PROJECT_ID}" --tag "${RUNNER_IMAGE}" --file deploy/cloudrun/runner.Dockerfile .

COMMON_SECRETS=(
  "GOOSE_AEO_OPENAI_API_KEY=${OPENAI_SECRET}:latest"
)

for optional_secret in \
  "GOOSE_AEO_PERPLEXITY_API_KEY=${PERPLEXITY_SECRET}:latest" \
  "GOOSE_AEO_CLAUDE_API_KEY=${CLAUDE_SECRET}:latest" \
  "GOOSE_AEO_GEMINI_API_KEY=${GEMINI_SECRET}:latest" \
  "GOOSE_AEO_GROK_API_KEY=${GROK_SECRET}:latest"; do
  secret_name="${optional_secret%%=*}"
  if gcloud secrets describe "${secret_name}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    COMMON_SECRETS+=("${optional_secret}")
  else
    echo "Skipping optional missing secret mapping: ${secret_name}"
  fi
done

DASHBOARD_SECRETS=(
  "${COMMON_SECRETS[@]}"
  "GOOSE_AEO_DASHBOARD_ALLOWED_EMAIL_DOMAIN=${ALLOWED_EMAIL_DOMAIN_SECRET}:latest"
  "GOOSE_AEO_DASHBOARD_SHARED_PASSWORD=${SHARED_PASSWORD_SECRET}:latest"
)

if gcloud secrets describe "${BASIC_AUTH_USER_SECRET}" --project "${PROJECT_ID}" >/dev/null 2>&1 && \
  gcloud secrets describe "${BASIC_AUTH_PASSWORD_SECRET}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  DASHBOARD_SECRETS+=(
    "GOOSE_AEO_DASHBOARD_BASIC_AUTH_USER=${BASIC_AUTH_USER_SECRET}:latest"
    "GOOSE_AEO_DASHBOARD_BASIC_AUTH_PASSWORD=${BASIC_AUTH_PASSWORD_SECRET}:latest"
  )
else
  echo "Fixed-user basic auth secrets not both present; leaving those mappings unset."
fi

echo "Deploying public dashboard service with basic auth..."
gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${DASHBOARD_IMAGE}" \
  --allow-unauthenticated \
  --service-account "${SERVICE_ACCOUNT}" \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 2 \
  --port 8080 \
  --set-env-vars "GOOSE_AEO_DATA_CWD=${DATA_MOUNT_PATH}" \
  --set-secrets "$(IFS=,; echo "${DASHBOARD_SECRETS[*]}")" \
  --clear-volumes \
  --add-volume "name=aeodata,type=cloud-storage,bucket=${BUCKET_NAME}" \
  --clear-volume-mounts \
  --add-volume-mount "volume=aeodata,mount-path=${DATA_MOUNT_PATH}"

echo "Deploying weekly Cloud Run Job..."
gcloud run jobs deploy "${JOB_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${RUNNER_IMAGE}" \
  --service-account "${SERVICE_ACCOUNT}" \
  --cpu 1 \
  --memory 1Gi \
  --max-retries 1 \
  --task-timeout 3600 \
  --set-env-vars "GOOSE_AEO_DATA_CWD=${DATA_MOUNT_PATH},GOOSE_AEO_QUERY_LIMIT=25,GOOSE_AEO_RUN_CONCURRENCY=1,GOOSE_AEO_BUDGET_LIMIT_USD=20,GOOSE_AEO_AUDIT_PAGES=25,GOOSE_AEO_CONFIG_PATH=${DATA_MOUNT_PATH}/.goose-aeo.yml" \
  --set-secrets "$(IFS=,; echo "${COMMON_SECRETS[*]}")" \
  --clear-volumes \
  --add-volume "name=aeodata,type=cloud-storage,bucket=${BUCKET_NAME}" \
  --clear-volume-mounts \
  --add-volume-mount "volume=aeodata,mount-path=${DATA_MOUNT_PATH}"

echo "Legacy fallback only: this script no longer creates or updates Cloud Scheduler jobs."
echo "Weekly execution should be driven by .github/workflows/weekly-aeo-run.yml only."
echo "Done. Trigger once manually:"
echo "gcloud run jobs execute ${JOB_NAME} --region ${REGION} --project ${PROJECT_ID}"
