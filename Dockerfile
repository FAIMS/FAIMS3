# Base including pnpm setup
FROM node:24 AS base

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
COPY library/forms/package.json ./library/forms/

# Install dependencies with cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile


# Source stage. Nothing is built here: compose bind-mounts the workspace libraries
# over this image, so anything built here is hidden anyway (localdev.sh builds them).
FROM base AS source

# Copy source code
COPY . .

# Shared runtime for the three dev services. Compose sets command and ports per
# service, so one stage serves all three.
FROM node:24-slim AS runtime

# ogr2ogr for GeoPackage export (see api/src/couchdb/export/gdal.ts), and curl for
# the api healthcheck.
RUN apt-get update \
  && apt-get install -y --no-install-recommends gdal-bin curl \
  && rm -rf /var/lib/apt/lists/*

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /usr/src

# Copy installed dependencies and source
COPY --from=source /usr/src .
