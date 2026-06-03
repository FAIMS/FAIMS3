# Build from the monorepo root:
#   docker build -f load-testing/coordinator/Dockerfile -t load-test-coordinator .
#
# Run:
#   docker run --env-file load-testing/coordinator/.env -p 4000:4000 \
#     -e PROMETHEUS_PUSHGATEWAY_URL=http://host.docker.internal:9091 \
#     --add-host=host.docker.internal:host-gateway \
#     load-test-coordinator

FROM node:22 AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /usr/src

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY library/instrumentation/package.json ./library/instrumentation/
COPY load-testing/shared/package.json ./load-testing/shared/
COPY load-testing/coordinator/package.json ./load-testing/coordinator/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

FROM base AS builder

COPY library/instrumentation ./library/instrumentation/
COPY load-testing/shared ./load-testing/shared/
COPY load-testing/coordinator ./load-testing/coordinator/

RUN pnpm turbo build --filter=@faims3/load-testing-coordinator

FROM node:22-slim AS runtime

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /usr/src

COPY --from=builder /usr/src .

EXPOSE 4000
CMD ["node", "load-testing/coordinator/build/src/server.js"]
