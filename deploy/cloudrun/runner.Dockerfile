FROM node:20-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV GOOSE_AEO_DATA_CWD=/var/lib/goose-aeo
ENV GOOSE_AEO_QUERY_LIMIT=25
ENV GOOSE_AEO_RUN_CONCURRENCY=1
ENV GOOSE_AEO_BUDGET_LIMIT_USD=20
ENV GOOSE_AEO_AUDIT_PAGES=25
ENV GOOSE_AEO_CONFIG_PATH=/var/lib/goose-aeo/.goose-aeo.yml

RUN npm install -g goose-aeo@latest
RUN mkdir -p /var/lib/goose-aeo

COPY deploy/cloudrun/run-weekly.sh /app/run-weekly.sh
RUN chmod +x /app/run-weekly.sh

ENTRYPOINT ["/app/run-weekly.sh"]
