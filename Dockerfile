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

# Shared runtime for the three dev services. The monorepo is copied once here so
# all three images reuse the layer instead of each carrying its own copy.
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

# API service
FROM runtime AS api
EXPOSE 8000
CMD ["pnpm", "run", "watch-api"]

# App service
FROM runtime AS app
EXPOSE 3000
CMD ["pnpm", "run", "force-start-app"]

# Web service
FROM runtime AS web
EXPOSE 3001
CMD ["pnpm", "run", "web-dev"]
