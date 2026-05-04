#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
: "${BUCKET_NAME:=goose-aeo-data-${PROJECT_ID}}"
: "${LOCAL_DATA_DIR:=.}"

if [[ ! -f "${LOCAL_DATA_DIR}/.goose-aeo.yml" ]]; then
  echo "Missing ${LOCAL_DATA_DIR}/.goose-aeo.yml"
  exit 1
fi

if [[ ! -f "${LOCAL_DATA_DIR}/goose-aeo.db" ]]; then
  echo "Missing ${LOCAL_DATA_DIR}/goose-aeo.db"
  exit 1
fi

echo "Uploading config and database to gs://${BUCKET_NAME}/"
gcloud storage cp "${LOCAL_DATA_DIR}/.goose-aeo.yml" "gs://${BUCKET_NAME}/.goose-aeo.yml"
gcloud storage cp "${LOCAL_DATA_DIR}/goose-aeo.db" "gs://${BUCKET_NAME}/goose-aeo.db"

echo "Bootstrap upload complete."
