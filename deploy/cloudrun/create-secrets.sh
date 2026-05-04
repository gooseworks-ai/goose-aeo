#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"

ensure_secret() {
  local secret_name="$1"
  local secret_value="$2"

  if [[ -z "${secret_value}" ]]; then
    echo "Skipping ${secret_name} (empty value)."
    return
  fi

  gcloud secrets create "${secret_name}" --replication-policy=automatic --project "${PROJECT_ID}" 2>/dev/null || true
  printf "%s" "${secret_value}" | gcloud secrets versions add "${secret_name}" --data-file=- --project "${PROJECT_ID}"
}

ensure_secret "GOOSE_AEO_OPENAI_API_KEY" "${GOOSE_AEO_OPENAI_API_KEY:-}"
ensure_secret "GOOSE_AEO_PERPLEXITY_API_KEY" "${GOOSE_AEO_PERPLEXITY_API_KEY:-}"
ensure_secret "GOOSE_AEO_CLAUDE_API_KEY" "${GOOSE_AEO_CLAUDE_API_KEY:-}"
ensure_secret "GOOSE_AEO_GEMINI_API_KEY" "${GOOSE_AEO_GEMINI_API_KEY:-}"
ensure_secret "GOOSE_AEO_GROK_API_KEY" "${GOOSE_AEO_GROK_API_KEY:-}"
ensure_secret "GOOSE_AEO_DASHBOARD_BASIC_AUTH_USER" "${GOOSE_AEO_DASHBOARD_BASIC_AUTH_USER:-}"
ensure_secret "GOOSE_AEO_DASHBOARD_BASIC_AUTH_PASSWORD" "${GOOSE_AEO_DASHBOARD_BASIC_AUTH_PASSWORD:-}"
ensure_secret "GOOSE_AEO_DASHBOARD_ALLOWED_EMAIL_DOMAIN" "${GOOSE_AEO_DASHBOARD_ALLOWED_EMAIL_DOMAIN:-}"
ensure_secret "GOOSE_AEO_DASHBOARD_SHARED_PASSWORD" "${GOOSE_AEO_DASHBOARD_SHARED_PASSWORD:-}"

echo "Secrets setup complete."
