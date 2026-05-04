# Deploy Goose AEO on Cloud Run (Weekly Thursday)

This runbook deploys:
- a public Goose AEO dashboard on Cloud Run (protected with Basic Auth),
- a weekly Cloud Run Job that runs every Thursday,
- shared persistent data so the dashboard shows historical runs/audits,
- GitHub Actions based deploy + weekly execution for long-term maintenance.

Production sync target for Clinikally:
- deploys are driven by GitHub Actions,
- the weekly run is driven by GitHub Actions executing the Cloud Run Job,
- Cloud Scheduler is not used for weekly execution.

## 1) Prerequisites

- Google Cloud project with billing enabled.
- `gcloud` CLI authenticated (`gcloud auth login`).
- Docker/Cloud Build access.
- Existing local Goose AEO setup files:
  - `.goose-aeo.yml`
  - `goose-aeo.db`
- GitHub CLI authenticated if you want to set repo Actions vars/secrets from the command line.

## 2) Recommended runtime settings (cost-safe defaults)

These defaults are baked into the runner:
- query generation limit: `25`
- run concurrency: `1`
- run budget cap: `$20`
- audit pages: `25`
- GitHub Actions schedule: Thursday at `09:00 UTC`

You can override via Cloud Run Job env vars later.

## 3) Set environment variables locally

```bash
export PROJECT_ID="goose-aeo-clinikally-20260504"
export REGION="us-central1"
export SERVICE_ACCOUNT="goose-aeo-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
export GOOSE_AEO_DASHBOARD_ALLOWED_EMAIL_DOMAIN="clinikally.com"
export GOOSE_AEO_DASHBOARD_SHARED_PASSWORD="replace-with-team-shared-password"
```

Optional legacy fixed-user auth mode is still supported by the dashboard server:

```bash
export GOOSE_AEO_DASHBOARD_BASIC_AUTH_USER="admin"
export GOOSE_AEO_DASHBOARD_BASIC_AUTH_PASSWORD="replace-with-strong-password"
```

For Clinikally production, use domain-based auth with `@clinikally.com` plus the shared password.

## 4) Create service account and minimum IAM roles

```bash
gcloud iam service-accounts create goose-aeo-runtime --project "${PROJECT_ID}"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member "serviceAccount:${SERVICE_ACCOUNT}" --role "roles/secretmanager.secretAccessor"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member "serviceAccount:${SERVICE_ACCOUNT}" --role "roles/storage.objectAdmin"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member "serviceAccount:${SERVICE_ACCOUNT}" --role "roles/run.invoker"
```

## 5) Create secrets in Secret Manager

Populate your shell env vars first, then run:

```bash
chmod +x deploy/cloudrun/create-secrets.sh
./deploy/cloudrun/create-secrets.sh
```

Required for deploy:
- `GOOSE_AEO_OPENAI_API_KEY`
- `GOOSE_AEO_DASHBOARD_ALLOWED_EMAIL_DOMAIN`
- `GOOSE_AEO_DASHBOARD_SHARED_PASSWORD`

Optional provider secrets:
- `GOOSE_AEO_PERPLEXITY_API_KEY`
- `GOOSE_AEO_CLAUDE_API_KEY`
- `GOOSE_AEO_GEMINI_API_KEY`
- `GOOSE_AEO_GROK_API_KEY`

Optional legacy fixed-user auth secrets:
- `GOOSE_AEO_DASHBOARD_BASIC_AUTH_USER`
- `GOOSE_AEO_DASHBOARD_BASIC_AUTH_PASSWORD`

Auth modes supported:
- fixed user/password (`GOOSE_AEO_DASHBOARD_BASIC_AUTH_USER` + `GOOSE_AEO_DASHBOARD_BASIC_AUTH_PASSWORD`)
- email-domain mode (`GOOSE_AEO_DASHBOARD_ALLOWED_EMAIL_DOMAIN` + `GOOSE_AEO_DASHBOARD_SHARED_PASSWORD`)

For Clinikally production, use email-domain mode with `GOOSE_AEO_DASHBOARD_ALLOWED_EMAIL_DOMAIN=clinikally.com`.

## 6) Bootstrap persistent data

Upload your current config and DB:

```bash
chmod +x deploy/cloudrun/bootstrap-data.sh
./deploy/cloudrun/bootstrap-data.sh
```

This uploads data to `gs://goose-aeo-data-${PROJECT_ID}`.

## 7) Configure GitHub Actions OIDC (one-time)

```bash
export GITHUB_OWNER="gooseworks-ai"
export GITHUB_REPO="goose-aeo"
chmod +x deploy/cloudrun/setup-github-oidc.sh
./deploy/cloudrun/setup-github-oidc.sh
```

Expected GitHub Actions settings for `gooseworks-ai/goose-aeo`:

- **Repository Variable**
  - `GCP_PROJECT_ID=goose-aeo-clinikally-20260504`
- **Repository Secrets**
  - `GCP_WORKLOAD_IDENTITY_PROVIDER=projects/475372317889/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
  - `GCP_DEPLOY_SERVICE_ACCOUNT=goose-aeo-deploy@goose-aeo-clinikally-20260504.iam.gserviceaccount.com`
  - `GCP_RUNTIME_SERVICE_ACCOUNT=goose-aeo-runtime@goose-aeo-clinikally-20260504.iam.gserviceaccount.com`

Set them with GitHub CLI:

```bash
gh variable set GCP_PROJECT_ID --repo gooseworks-ai/goose-aeo --body "goose-aeo-clinikally-20260504"

gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo gooseworks-ai/goose-aeo --body "projects/475372317889/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
gh secret set GCP_DEPLOY_SERVICE_ACCOUNT --repo gooseworks-ai/goose-aeo --body "goose-aeo-deploy@goose-aeo-clinikally-20260504.iam.gserviceaccount.com"
gh secret set GCP_RUNTIME_SERVICE_ACCOUNT --repo gooseworks-ai/goose-aeo --body "goose-aeo-runtime@goose-aeo-clinikally-20260504.iam.gserviceaccount.com"
```

## 8) Trigger first deploy from GitHub

- Push changes to `main` or run the workflow manually from the Actions tab.
- Workflow file: `.github/workflows/deploy-cloud-run.yml`
- This workflow safely bootstraps lightweight prerequisites:
  - required APIs,
  - Artifact Registry repository,
  - Cloud Storage bucket.
- It assumes Secret Manager secrets already exist.
- It deploys:
  - Cloud Run service `goose-aeo-dashboard`
  - Cloud Run job `goose-aeo-weekly`

## 9) Weekly Thursday automation via GitHub Actions

- Workflow file: `.github/workflows/weekly-aeo-run.yml`
- Runs every Thursday at `09:00 UTC` and executes the Cloud Run Job.
- You can manually trigger it with **Run workflow** in GitHub Actions.
- Do not create a Cloud Scheduler job for the weekly run unless you intentionally want a second trigger.

## 10) Local manual deploy fallback

`deploy/cloudrun/deploy.sh` is kept as a legacy/manual fallback only.

It:
- builds and deploys the Cloud Run service and job,
- bootstraps lightweight prerequisites,
- does **not** create or update Cloud Scheduler.

Primary production sync should remain GitHub-driven.

## 11) Verify deployment

Get dashboard URL:

```bash
gcloud run services describe goose-aeo-dashboard --region "${REGION}" --project "${PROJECT_ID}" --format="value(status.url)"
```

Manual weekly-run test:

```bash
gcloud run jobs execute goose-aeo-weekly --region "${REGION}" --project "${PROJECT_ID}" --wait
```

Check latest executions:

```bash
gcloud run jobs executions list --job goose-aeo-weekly --region "${REGION}" --project "${PROJECT_ID}"
```

Verify dashboard auth behavior:
- open the dashboard URL,
- sign in with any username ending in `@clinikally.com`,
- use the shared password from `GOOSE_AEO_DASHBOARD_SHARED_PASSWORD`,
- confirm `/healthz` responds without auth if needed for health checks.

## 12) Troubleshooting

- `Missing required Secret Manager secret` during deploy:
  - create the missing secret and rerun the deploy workflow.
- `Missing config at /var/lib/goose-aeo/.goose-aeo.yml`:
  - run `./deploy/cloudrun/bootstrap-data.sh` again.
- 401 in dashboard:
  - verify `GOOSE_AEO_DASHBOARD_ALLOWED_EMAIL_DOMAIN` and `GOOSE_AEO_DASHBOARD_SHARED_PASSWORD` are present and mapped.
- weekly workflow not triggering:
  - check GitHub Actions schedule and repository Actions permissions.
- deployment workflow auth errors:
  - re-check OIDC provider, repository match condition, and GitHub Actions secrets.
- higher-than-expected spend:
  - lower `GOOSE_AEO_QUERY_LIMIT`,
  - reduce providers in `.goose-aeo.yml`,
  - keep `GOOSE_AEO_RUN_CONCURRENCY=1`.

## 13) Rollback / safe pause

Disable weekly automation:

```bash
gh workflow disable "Weekly AEO Run" --repo gooseworks-ai/goose-aeo
```

Re-enable later:

```bash
gh workflow enable "Weekly AEO Run" --repo gooseworks-ai/goose-aeo
```

Redeploy the previous known-good revision if needed:

```bash
gcloud run services update-traffic goose-aeo-dashboard \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --to-revisions REVISION_NAME=100
```

To pause the weekly run immediately without changing deploy wiring, disable the GitHub workflow rather than adding Cloud Scheduler.
