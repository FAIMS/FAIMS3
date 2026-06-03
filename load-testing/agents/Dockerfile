# Build from the monorepo root:
#   docker build -f load-testing/agents/Dockerfile -t load-test-agent .
#
# Run:
#   docker run --env-file load-testing/agents/.env \
#     --shm-size=2g --add-host=host.docker.internal:host-gateway \
#     load-test-agent

FROM node:22 AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /usr/src

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY library/instrumentation/package.json ./library/instrumentation/
COPY load-testing/shared/package.json ./load-testing/shared/
COPY load-testing/agents/package.json ./load-testing/agents/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

FROM base AS builder

COPY library/instrumentation ./library/instrumentation/
COPY load-testing/shared ./load-testing/shared/
COPY load-testing/agents ./load-testing/agents/

RUN pnpm turbo build --filter=@faims3/load-testing-agents

FROM node:22 AS runtime

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /usr/src

COPY --from=builder /usr/src .

RUN pnpm --filter=@faims3/load-testing-agents exec playwright install chromium --with-deps

CMD ["node", "load-testing/agents/build/src/worker.js"]
