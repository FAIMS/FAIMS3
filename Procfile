# CouchDB runs in Docker, not normally enabled here as it
# generally doesn't need to restart. Uncomment the following line to start CouchDB in Docker.
#couchdb: docker compose up couchdb

# Library watch builds
data-model: cd library/data-model && pnpm watch
forms: cd library/forms && pnpm watch

# API server
api: cd api && pnpm local

# Web app
web: cd web && pnpm dev

# Mobile app
app: cd app && pnpm dev