FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/cli/package.json packages/cli/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json

RUN npm ci

COPY packages packages
COPY apps apps
COPY pricing.json pricing.json

RUN npm run build --workspace goose-aeo-dashboard

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV GOOSE_AEO_DATA_CWD=/var/lib/goose-aeo

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/dashboard/dist /app/apps/dashboard/dist
COPY --from=builder /app/apps/dashboard/package.json /app/apps/dashboard/package.json
COPY --from=builder /app/packages /app/packages
COPY --from=builder /app/pricing.json /app/pricing.json

RUN mkdir -p /var/lib/goose-aeo

EXPOSE 8080

CMD ["node", "apps/dashboard/dist/server.js", "--port", "8080", "--data-cwd", "/var/lib/goose-aeo", "--pricing-config", "/app/pricing.json"]
