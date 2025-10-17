# Base including npm cache
FROM node:22 AS base
WORKDIR /usr/src
COPY package*.json ./

# Turbo config
COPY turbo.json .

# monorepo package* which are relevant here
COPY api/package.json api/package-lock.json ./api/
COPY app/package.json ./app/
COPY web/package.json web/package-lock.json ./web/
COPY library/data-model/package.json library/data-model/package-lock.json ./library/data-model/

RUN --mount=type=cache,target=/usr/src/.npm \
  npm set cache /usr/src/.npm && \
  npm i

# Build stage
FROM base AS builder
COPY . .

# build the app and api
RUN npx turbo build --filter=@faims3/api --filter=@faims3/app --filter=web

# API service
FROM node:20 AS api
WORKDIR /usr/src
COPY --from=builder /usr/src .
EXPOSE 8000
CMD ["npm", "run", "watch-api"]

# App service
FROM node:20 AS app
WORKDIR /usr/src
COPY --from=builder /usr/src .
EXPOSE 3000
CMD ["npm", "run", "force-start-app"]

# Web service
FROM node:20 AS web
WORKDIR /usr/src
COPY --from=builder /usr/src .
EXPOSE 3001
CMD ["npm", "run", "web-dev"]
