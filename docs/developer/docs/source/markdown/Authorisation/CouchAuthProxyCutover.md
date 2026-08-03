# Deploying couch-auth-proxy (operator cutover)

Practical runbook for enabling per-document sync ACL via
[`couch-auth-proxy`](https://github.com/PeterBaker0/couch-auth-proxy).

- Ownership / validate_doc_update layering: [AclValidationLayering](AclValidationLayering.md)
- Permission model summary: [PermissionModel — Sync enforcement](../PermissionModel.md)
- AWS CDK: [infrastructure/aws-cdk/README.md](../../../../../infrastructure/aws-cdk/README.md)

## Immediate cutover (intentional)

This is a **deploy-then-migrate** cutover, not a staged “proxy idle then flip”
sequence.

Production deployments today already expose project data DBs as member-readable
on the public Couch hostname (the gap this change closes). Putting the proxy in
front immediately is therefore not a privacy regression for unstamped legacy
docs: until DATA migrate stamps them (v1→v2), those docs still map to `r-*`
(world-readable to DB members) — the same effective access as direct Couch. As
migrate completes (target version **2**), guests lose access to other
users’ graphs.

Prefer a simple cutover over a multi-phase flip so code and ops stay clear.

**Recommended order**

1. **Prepare** with proxy still off if needed: deploy FAIMS that stamps
   `creator`/`parent` and runs DATA v2 migrations while
   `COUCH_AUTH_PROXY_ENABLED=false` / CDK `couchAuthProxy.enabled=false`
   (no proxy HTTP; ALB → Couch).
2. **Enable** the proxy: compose already runs it locally with
   `COUCH_AUTH_PROXY_ENABLED=true`; on AWS set `couchAuthProxy.enabled=true`
   and deploy (ALB `couch.*` → proxy; Couch VPC-only).
3. **Migrate** every `data-*` DB as soon as Conductor is up
   (`migrate-with-keys` and/or Conductor startup init). Init already warms
   the proxy and patches `dbacl`; then **check** ACL health with
   `repair-data-db-acl -- --check` (use `--write` only if check reports drift).
4. **Validate** guest isolation once migrations are healthy.

---

## What changes at cutover

| Concern                             | Before                    | After                                                       |
| ----------------------------------- | ------------------------- | ----------------------------------------------------------- |
| App sync URL (`COUCHDB_PUBLIC_URL`) | Direct Couch              | couch-auth-proxy                                            |
| Conductor (`COUCHDB_INTERNAL_URL`)  | Direct Couch (admin)      | Unchanged — still direct Couch                              |
| Guest sync reads                    | Entire project data DB    | Own record graph only (`creator` / `parent`), after migrate |
| Contributor+ sync reads             | Entire DB                 | Entire DB via `_design/acl` `dbacl`                         |
| Client IndexedDB                    | May hold pre-proxy corpus | Not wiped — see [Local leftovers](#local-leftovers)         |

---

## Environments

### Local compose (dev)

Wired in `docker-compose.yml` + `api/.env`:

1. `couchdb` on host port `COUCHDB_EXTERNAL_PORT` (default **5984**)
2. `couch-auth-proxy` on `COUCH_AUTH_PROXY_EXTERNAL_PORT` (default **5985**),
   image **`ghcr.io/peterbaker0/couch-auth-proxy:1.7.0`** (same pin as CDK)
3. `api/.env`: `COUCH_AUTH_PROXY_ENABLED=true`,
   `COUCHDB_INTERNAL_URL=http://localhost:5984`,
   `COUCHDB_PUBLIC_URL=http://localhost:5985`

To run **without** the proxy locally: stop the `couch-auth-proxy` service,
set `COUCH_AUTH_PROXY_ENABLED=false` and
`COUCHDB_PUBLIC_URL=http://localhost:5984`. Creator stamps and migrations
still run; Conductor will not call the proxy.

`./localdev.sh` starts Couch + proxy and waits on
`/_couch-auth-proxy/health` before migrate/dev.

### Production (AWS CDK)

AWS CDK deploys couch-auth-proxy only when
`couchAuthProxy.enabled` is **`true`** in the stack JSON (default **`false`**
keeps legacy ALB → Couch). See
[infrastructure/aws-cdk/README.md](../../../../../infrastructure/aws-cdk/README.md).

| `couchAuthProxy.enabled` | ALB `couch.*` | Conductor env                                                                                                |
| ------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------ |
| `false` (default)        | → Couch EC2   | `COUCH_AUTH_PROXY_ENABLED=false`, `PUBLIC` = `https://couch.<base>`, `INTERNAL` = `http://<private-ip>:5984` |
| `true`                   | → proxy       | `COUCH_AUTH_PROXY_ENABLED=true`, `PUBLIC` → proxy, `INTERNAL` → VPC Couch                                    |

After enabling, migrate DATA DBs to version **2** promptly, then
**check** ACL overlays (`repair-data-db-acl -- --check`). Normal migrate /
Conductor startup init already warms + patches `dbacl`; `--write` is only
needed if check reports missing/mismatched overlays.

### Production (DigitalOcean / custom)

DigitalOcean still sketches a raw Couch target — treat proxy wiring as a
**required follow-up**. You need:

1. Run `ghcr.io/peterbaker0/couch-auth-proxy:1.7.0` (match compose / CDK pin;
   image owns `_design/acl` map/validate_doc_update).
2. Proxy env (minimum):

   ```bash
   COUCH_URL=<internal Couch URL>
   COUCH_ADMIN_USER=...
   COUCH_ADMIN_PASSWORD=...
   ACL_DB_INCLUDE=/^data-/
   ACL_ROUTE_INCLUDE=pouch-sync,session,root
   ACL_AUTO_INSTALL=true
   ACL_REQUIRE_CREATOR=true
   COUCH_PRELOAD_DB_INCLUDE=/^data-/
   AUTH_RESOLVE_VIA_COUCH_SESSION=true
   CORS_ORIGINS=<app origin(s)>
   ```

3. Public hostname / load balancer → **proxy** only (not Couch).
4. Couch security group / firewall: reachable from Conductor + proxy only.
5. Conductor env:
   - `COUCHDB_INTERNAL_URL` → Couch (admin Basic)
   - `COUCHDB_PUBLIC_URL` → proxy base URL (**no trailing slash**)
6. Migrate immediately after the public URL points at the proxy, then
   **check** ACL health (`--check`; `--write` only if needed).

---

## Production sequence

### 1 — Deploy

Deploy the FAIMS application build (stamp-on-write, DATA migrations to v2,
ACL check/write script) and infra so public sync already hits the proxy.

- AWS: set `couchAuthProxy.enabled: true` and `cdk deploy`.
- Confirm proxy health: `GET {proxy}/_couch-auth-proxy/health` → 200.
- Confirm Conductor `COUCH_AUTH_PROXY_ENABLED=true`,
  `COUCHDB_PUBLIC_URL` is the proxy, and `COUCHDB_INTERNAL_URL` is VPC Couch.

### 2 — Migrate, then check ACL health

```bash
pnpm run migrate-with-keys
# or rely on Conductor startup init (warms + patches dbacl per project), then:

# Validate first (no writes). Expect every data-* DB: OK
pnpm --filter=@faims3/api run repair-data-db-acl -- --check

# Only if check reports MISSING / DBACL_MISMATCH:
pnpm --filter=@faims3/api run repair-data-db-acl -- --write
pnpm --filter=@faims3/api run repair-data-db-acl -- --check   # confirm clean
```

DATA **v1→v2** for each project data DB:

- Stamps `creator` / `parent` on legacy docs (orphan docs without `created_by`
  get synthetic creator `__faims_acl_orphan__` — fail-closed for guests)
- Patches `dbacl` when proxy `_design/acl` is present
- Ensures `_design/faims_acl_shape`

`repair-data-db-acl` is an ops **validation** tool (despite the script name).
On a normal clean migrate with the proxy already enabled, init already warms
the proxy and patches `dbacl` — `--check` should pass with nothing to write.
Use `--write` to warm (admin `GET` via `COUCHDB_PUBLIC_URL` so `_design/acl`
is installed if needed), patch project-scoped `dbacl`, and ensure the FAIMS
shape ddoc when check reports drift. See
[AclValidationLayering](AclValidationLayering.md) for what “warm” means.

`--check` should show every `data-*` DB as `OK` (`_design/acl` present and
`dbacl` lists matching the permission model). Exit code is non-zero on
`MISSING` / `DBACL_MISMATCH` while the proxy is enabled.

### 3 — Confirm migration inventory

In the Couch `migrations` database, each DATA entry keyed by logical name
`data-{projectId}` should be at **version 2** with `status: healthy`.

Quick checks (admin against **internal** Couch):

```bash
curl -s -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \
  "$COUCHDB_INTERNAL_URL/_all_dbs" | jq '.[] | select(startswith("data-"))'

curl -s -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \
  "$COUCHDB_INTERNAL_URL/data-<projectId>/_design/acl" | jq '{version, dbacl}'
```

### 4 — Validate

```bash
pnpm --filter=@faims3/api run test:couch-auth-proxy
```

Manual probe (clean clients after migrate):

1. Invite Guest A + Guest B + Contributor on one notebook.
2. Guest A creates a record (ideally with an attachment); sync.
3. Guest B syncs — must not receive A’s record on the wire / in a fresh local DB.
4. Contributor syncs — sees A’s record; can edit; Guest A still sees the
   updated graph.

---

## Local leftovers (known limitation)

Cutover re-points remotes at the proxy; it does **not** wipe local IndexedDB.

**What is guaranteed:** after migrate, the proxy filters the wire. A _fresh_
client (or a project re-activated after clearing local data) only syncs docs
the user is allowed to see.

**What is not guaranteed on already-activated devices:** a guest who synced
before cutover may still have other users’ docs sitting in local storage until
they refresh, re-activate the notebook, or clear site data. On AWS, the public
hostname often stays the same, so this is especially likely — the app may only
swap the remote handle, not rebuild the local DB.

Read schemas keep `creator` / `parent` optional so those leftover docs do not
crash Zod parse. Do not treat “app still shows an old local record” as a proxy
ACL failure; confirm isolation with a clean client or the integration suite.

---

## Rollback

| Situation                                 | Action                                                                                                                                                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proxy misconfigured / outage (AWS)        | Set `couchAuthProxy.enabled: false` and redeploy (ALB → Couch again; Conductor gets `COUCH_AUTH_PROXY_ENABLED=false`). This **re-opens** the pre-proxy read gap. ACL fields / `_design/acl` can remain — harmless for direct Couch. |
| Proxy misconfigured (compose / custom)    | Set `COUCH_AUTH_PROXY_ENABLED=false`, point `COUCHDB_PUBLIC_URL` at Couch, stop the proxy service, restart Conductor. Same read-gap regression.                                                                                     |
| Bad `dbacl` after permission-model change | `pnpm --filter=@faims3/api run repair-data-db-acl -- --check`, then `--write` if mismatched                                                                                                                                         |
| One DB missing stamps                     | Re-run migrate (idempotent); ACL overlay check/write if needed. Until fixed, that DB’s unstamped docs stay member-readable (`r-*`) — same as today’s public Couch.                                                                  |

Rolling back does **not** remove stamped `creator`/`parent` fields. Returning
to the proxy later is safe if ddocs are still present.

---

## Ops cheat sheet

| Task                    | Command / check                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migrate all DBs         | `pnpm run migrate-with-keys`                                                                                                                     |
| Check ACL overlays      | `pnpm --filter=@faims3/api run repair-data-db-acl -- --check`                                                                                    |
| Write/fix ACL overlays  | `pnpm --filter=@faims3/api run repair-data-db-acl -- --write` (only if check fails)                                                              |
| Proxy health            | `curl -f "$COUCHDB_PUBLIC_URL/_couch-auth-proxy/health"`                                                                                         |
| Integration proof       | `pnpm --filter=@faims3/api run test:couch-auth-proxy`                                                                                            |
| Image pin               | compose + CDK `1.7.0` + `ACL_REQUIRE_CREATOR=true` + `COUCH_PRELOAD_DB_INCLUDE=/^data-/` (see [AclValidationLayering](AclValidationLayering.md)) |
| When proxy writes ddocs | [CouchAuthProxyAclInstallBrief](CouchAuthProxyAclInstallBrief.md)                                                                                |

---

## Common failure modes

1. **Migrate never run after deploy** — unstamped legacy docs stay `r-*`
   (member-readable). Same as pre-proxy public Couch; fix by running migrate,
   then `--check` (and `--write` only if overlays are missing/mismatched).
2. **Couch still published on the internet** — proxy is bypassable. Lock Couch
   to internal networks only (AWS CDK does this; DO/custom must match).
3. **CORS missing app origin** — browser / Capacitor WebView sync fails; add
   origins to proxy `CORS_ORIGINS` (PWA host, Control Centre, and typically
   `https://localhost` / `capacitor://localhost` / `{appId}://localhost` for
   native — FAIMS sets Capacitor `iosScheme` to `appId`).
4. **Wrong logical migrations `dbName`** — migrations docs must be keyed by
   `data-{projectId}`, not a full Couch URL. Current Conductor enqueue does
   this; if you see URL-shaped keys in `migrations`, treat as a bug / re-run
   with a fixed build.
5. **Orphan docs** (`creator === __faims_acl_orphan__`) — invisible to guests;
   visible to ALL roles via `dbacl`. Investigate source docs missing
   `created_by` if that is unexpected.
6. **Compose vs CDK image drift** — both must pin **`1.7.0`** (or the same
   digest/tag); the image is the source of truth for `_design/acl` map/validate_doc_update.
7. **Couch version** — proxy CI/docs target CouchDB **3.5**; local FAIMS
   compose still runs **3.2.2**. Behaviour matches for ACL sync. Upstream
   **1.4.1+** fixed intermittent PUT/COPY 500s from Location double-wrap
   (`Response body … disturbed or locked`); the FAIMS integration suite still
   retries transient 5xx / ACL-cache misses as a belt-and-braces measure.
