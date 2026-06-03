# Base including pnpm setup
FROM node:22 AS base

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /usr/src

# Copy pnpm workspace configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy monorepo package.json files
COPY api/package.json ./api/
COPY app/package.json ./app/
COPY web/package.json ./web/
COPY library/data-model/package.json ./library/data-model/
COPY library/instrumentation/package.json ./library/instrumentation/
COPY load-testing/shared/package.json ./load-testing/shared/
COPY load-testing/coordinator/package.json ./load-testing/coordinator/
COPY load-testing/agents/package.json ./load-testing/agents/

# Turbo config
COPY turbo.json ./

# Install dependencies with cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile


# Build stage (FAIMS app/api/web)
FROM base AS builder

# Copy source code
COPY . .

RUN pnpm turbo build --filter=@faims3/api --filter=@faims3/app --filter=@faims3/web

# API service
FROM node:22-slim AS api

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /usr/src

# Copy built artifacts and dependencies
COPY --from=builder /usr/src .

EXPOSE 8000
CMD ["pnpm", "run", "watch-api"]

# App service
FROM node:22-slim AS app

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /usr/src

# Copy built artifacts and dependencies
COPY --from=builder /usr/src .

EXPOSE 3000
CMD ["pnpm", "run", "force-start-app"]

# Web service
FROM node:22-slim AS web

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable


WORKDIR /usr/src
COPY --from=builder /usr/src .
EXPOSE 3001
CMD ["pnpm", "run", "web-dev"]
