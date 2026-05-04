#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
: "${PROJECT_NUMBER:=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')}"
: "${GITHUB_OWNER:?Set GITHUB_OWNER}"
: "${GITHUB_REPO:?Set GITHUB_REPO}"
: "${POOL_ID:=github-pool}"
: "${PROVIDER_ID:=github-provider}"
: "${DEPLOY_SA:=goose-aeo-deploy@${PROJECT_ID}.iam.gserviceaccount.com}"

gcloud iam workload-identity-pools create "${POOL_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions Pool" 2>/dev/null || true

gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" \
  --display-name="GitHub OIDC Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository=='${GITHUB_OWNER}/${GITHUB_REPO}'" 2>/dev/null || true

gcloud iam service-accounts create goose-aeo-deploy \
  --project "${PROJECT_ID}" \
  --display-name "Goose AEO GitHub Deployer" 2>/dev/null || true

for role in roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.writer roles/storage.admin roles/secretmanager.admin; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${DEPLOY_SA}" \
    --role="${role}" >/dev/null
done

WIP_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

gcloud iam service-accounts add-iam-policy-binding "${DEPLOY_SA}" \
  --project "${PROJECT_ID}" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_OWNER}/${GITHUB_REPO}" >/dev/null

echo "Set these in GitHub repo secrets:"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=${WIP_RESOURCE}"
echo "GCP_DEPLOY_SERVICE_ACCOUNT=${DEPLOY_SA}"
echo "GCP_RUNTIME_SERVICE_ACCOUNT=goose-aeo-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
echo "Set this in GitHub repo variables:"
echo "GCP_PROJECT_ID=${PROJECT_ID}"
