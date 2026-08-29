# Base stage with Alpine & PNPM setup
FROM node:24-alpine AS base

# Install bash, pnpm and turbo globally and configure store location
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN apk add --no-cache bash && \
    npm install -g pnpm@11.6.0 turbo@2.9.14 && \
    pnpm config set store-dir /pnpm/store

WORKDIR /usr/src

# Copy monorepo configurations & package declarations
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY api/package.json ./api/
COPY app/package.json ./app/
COPY web/package.json ./web/
COPY library/data-model/package.json ./library/data-model/
COPY library/forms/package.json ./library/forms/

# Install dependencies using persistent build cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --prefer-offline --config.minimumReleaseAge=0

# API Builder stage (only builds API and its workspace dependencies)
FROM base AS api-builder
COPY . .
RUN --mount=type=cache,id=turbo,target=/usr/src/.turbo \
  turbo build --filter=@faims3/api...

# App Builder stage (only builds App and its workspace dependencies)
FROM base AS app-builder
COPY . .
RUN --mount=type=cache,id=turbo,target=/usr/src/.turbo \
  turbo build --filter=@faims3/app...

# Web Builder stage (only builds Web and its workspace dependencies)
FROM base AS web-builder
COPY . .
RUN --mount=type=cache,id=turbo,target=/usr/src/.turbo \
  turbo build --filter=@faims3/web...

# API runtime service
FROM node:24-alpine AS api

# ogr2ogr for GeoPackage export (see api/src/couchdb/export/gdal.ts)
RUN apk add --no-cache gdal curl bash && \
    deluser www-data 2>/dev/null || true && \
    delgroup www-data 2>/dev/null || true && \
    addgroup -g 33 -S faims && \
    adduser -u 33 -D -S -G faims faims

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm install -g pnpm@11.6.0 && \
    mkdir -p /pnpm /usr/src && \
    chown -R 33:33 /pnpm /usr/src

WORKDIR /usr/src
COPY --chown=33:33 --from=api-builder /usr/src /usr/src

USER 33:33

EXPOSE 8000
CMD ["node", "--expose-gc", "--max-old-space-size=4096", "api/build/src/index.js"]

# App runtime service
FROM node:24-alpine AS app

RUN apk add --no-cache bash && \
    deluser www-data 2>/dev/null || true && \
    delgroup www-data 2>/dev/null || true && \
    addgroup -g 33 -S faims && \
    adduser -u 33 -D -S -G faims faims

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@11.6.0 serve@14.2.4 && \
    mkdir -p /pnpm /usr/src && \
    chown -R 33:33 /pnpm /usr/src

WORKDIR /usr/src
COPY --chown=33:33 --from=app-builder /usr/src /usr/src

USER 33:33

EXPOSE 3000
CMD ["sh", "-c", "if [ -f scripts/generate-env-config.sh ]; then ./scripts/generate-env-config.sh app/dist; ./scripts/generate-env-config.sh app/build; fi; if [ -d app/dist ]; then serve -s app/dist -l 3000; elif [ -d app/build ]; then serve -s app/build -l 3000; else pnpm --filter=@faims3/app run serve -- --host --port 3000; fi"]

# Web runtime service
FROM node:24-alpine AS web

RUN apk add --no-cache bash && \
    deluser www-data 2>/dev/null || true && \
    delgroup www-data 2>/dev/null || true && \
    addgroup -g 33 -S faims && \
    adduser -u 33 -D -S -G faims faims

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@11.6.0 serve@14.2.4 && \
    mkdir -p /pnpm /usr/src && \
    chown -R 33:33 /pnpm /usr/src

WORKDIR /usr/src
COPY --chown=33:33 --from=web-builder /usr/src /usr/src

USER 33:33

EXPOSE 3001
CMD ["sh", "-c", "if [ -f scripts/generate-env-config.sh ]; then ./scripts/generate-env-config.sh web/dist; ./scripts/generate-env-config.sh web/build; fi; if [ -d web/dist ]; then serve -s web/dist -l 3001; elif [ -d web/build ]; then serve -s web/build -l 3001; else pnpm --filter=@faims3/web run serve -- --host --port 3001; fi"]

