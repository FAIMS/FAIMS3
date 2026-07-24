# Deploying couch-auth-proxy (operator cutover)

Practical runbook for enabling per-document sync ACL via
[`couch-auth-proxy`](https://github.com/PeterBaker0/couch-auth-proxy). For design
background see [CouchAuthProxyHandover](CouchAuthProxyHandover.md) and
[PermissionModel — Sync enforcement](../PermissionModel.md).

## Immediate cutover (intentional)

This is a **deploy-then-migrate** cutover, not a staged “proxy idle then flip”
sequence.

Production deployments today already expose project data DBs as member-readable
on the public Couch hostname (the gap this change closes). Putting the proxy in
front immediately is therefore not a privacy regression for unstamped legacy
docs: until DATA v1→v2 finishes, those docs still map to `r-*` (world-readable
to DB members) — the same effective access as direct Couch. As migrate/repair
completes, guests lose access to other users’ graphs.

Prefer a simple cutover over a multi-phase flip so code and ops stay clear.

**Recommended order**

1. **Deploy** the FAIMS build + infra that always routes public sync through
   couch-auth-proxy (compose already does; AWS CDK always-on).
2. **Migrate / repair** every `data-*` DB as soon as Conductor is up
   (`migrate-with-keys`, startup migrate, then `repair-data-db-acl`).
3. **Validate** guest isolation once migrations are healthy.

---

## What changes at cutover

| Concern                             | Before                    | After                                                            |
| ----------------------------------- | ------------------------- | ---------------------------------------------------------------- |
| App sync URL (`COUCHDB_PUBLIC_URL`) | Direct Couch              | couch-auth-proxy                                                 |
| Conductor (`COUCHDB_INTERNAL_URL`)  | Direct Couch (admin)      | Unchanged — still direct Couch                                   |
| Guest sync reads                    | Entire project data DB    | Own record graph only (`creator` / `parent`), after migrate      |
| Contributor+ sync reads             | Entire DB                 | Entire DB via `_design/acl` `dbacl`                              |
| Client IndexedDB                    | May hold pre-proxy corpus | Left as-is (accepted — see [Local leftovers](#local-leftovers))  |

---

## Environments

### Local compose (dev)

Already wired in `docker-compose.yml`:

1. `couchdb` on host port `COUCHDB_EXTERNAL_PORT` (default **5984**)
2. `couch-auth-proxy` on `COUCH_AUTH_PROXY_EXTERNAL_PORT` (default **5985**),
   image **`ghcr.io/peterbaker0/couch-auth-proxy:1.4.0`** (same pin as CDK)
3. `api/.env`: `COUCHDB_INTERNAL_URL=http://localhost:5984`,
   `COUCHDB_PUBLIC_URL=http://localhost:5985`

`./localdev.sh` starts Couch + proxy and waits on
`/_couch-auth-proxy/health` before migrate/dev.

### Production (AWS CDK)

AWS CDK **always** deploys couch-auth-proxy on the shared ALB
(`couch.*` / `db.*` → proxy; Couch VPC-only). There is no `enabled` flag and no
idle proxy mode — deploy **is** the cutover. See
[CouchAuthProxyAwsCdk](CouchAuthProxyAwsCdk.md).

Conductor env set by CDK:

- `COUCHDB_PUBLIC_URL` → `https://couch.<base>` (proxy)
- `COUCHDB_INTERNAL_URL` → `http://<couch-private-ip>:5984`

After deploy, run DATA v1→v2 + `repair-data-db-acl` promptly (Conductor startup
migrate may already cover most of this).

### Production (DigitalOcean / custom)

DigitalOcean still sketches a raw Couch target — treat proxy wiring as a
**required follow-up**. You need:

1. Run `ghcr.io/peterbaker0/couch-auth-proxy:1.4.0` (match compose / CDK pin;
   vendored ddoc map **2.3.0**).
2. Proxy env (minimum):

   ```bash
   COUCH_URL=<internal Couch URL>
   COUCH_ADMIN_USER=...
   COUCH_ADMIN_PASSWORD=...
   ACL_DB_INCLUDE=/^data-/
   ACL_ROUTE_INCLUDE=pouch-sync,session
   ACL_AUTO_INSTALL=false
   AUTH_RESOLVE_VIA_COUCH_SESSION=true
   CORS_ORIGINS=<app origin(s)>
   ```

3. Public hostname / load balancer → **proxy** only (not Couch).
4. Couch security group / firewall: reachable from Conductor + proxy only.
5. Conductor env:
   - `COUCHDB_INTERNAL_URL` → Couch (admin Basic)
   - `COUCHDB_PUBLIC_URL` → proxy base URL (**no trailing slash**)
6. Migrate + repair immediately after the public URL points at the proxy.

---

## Production sequence

### 1 — Deploy

Deploy the FAIMS application build (stamp-on-write, DATA v1→v2, repair script)
and infra so public sync already hits the proxy.

- AWS: `cdk deploy` with always-on proxy (this stack).
- Confirm proxy health: `GET {proxy}/_couch-auth-proxy/health` → 200.
- Confirm Conductor `COUCHDB_PUBLIC_URL` is the proxy and
  `COUCHDB_INTERNAL_URL` is VPC Couch.

### 2 — Migrate and repair

```bash
pnpm run migrate-with-keys
# or rely on Conductor startup migrate, then:

pnpm --filter=@faims3/api run repair-data-db-acl -- --dry-run
pnpm --filter=@faims3/api run repair-data-db-acl
```

DATA **v1→v2** for each project data DB:

- Stamps `creator` / `parent` on legacy docs (orphan docs without `created_by`
  get synthetic creator `__faims_acl_orphan__` — fail-closed for guests).
- Ensures `_design/acl` + project-scoped `dbacl`.

Dry-run should show every `data-*` DB with `_design/acl` present and
`dbacl._r` counts matching the permission model. Fix any `MISSING` / failed
rows.

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

## Local leftovers

Pre-proxy sync may leave other users’ docs in a guest’s local project DB.
There is **no** automatic local wipe / schema-generation bump. Isolation is
enforced on the wire by the proxy; leftover local records may linger until the
user refreshes, reactivates the notebook, or clears local data.

That trade-off is intentional: it keeps client cutover simple (re-point remotes
only) and avoids IndexedDB rebuild complexity. On AWS same-hostname flips the
advertised URL string may not change, so leftovers are especially expected on
already-activated devices.

---

## Rollback

| Situation                                 | Action                                                                                                                                                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proxy misconfigured / outage (AWS)        | Redeploy / code-change to re-attach ALB `couch.*` to Couch (or bypass proxy). There is no `enabled: false` flag. This **re-opens** the pre-proxy read gap. ACL fields / `_design/acl` can remain — harmless for direct Couch.       |
| Proxy misconfigured (compose / custom)    | Point `COUCHDB_PUBLIC_URL` back at a reachable Couch URL and restart Conductor. Same read-gap regression.                                                                                                                           |
| Bad `dbacl` after permission-model change | `pnpm --filter=@faims3/api run repair-data-db-acl`                                                                                                                                                                                  |
| One DB missing stamps                     | Re-run migrate (idempotent) and/or repair. Until fixed, that DB’s unstamped docs stay member-readable (`r-*`) — same as today’s public Couch.                                                                                       |

Rolling back does **not** remove stamped `creator`/`parent` fields. Returning
to the proxy later is safe if ddocs are still present.

---

## Ops cheat sheet

| Task                 | Command / check                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Migrate all DBs      | `pnpm run migrate-with-keys`                                                              |
| Repair `_design/acl` | `pnpm --filter=@faims3/api run repair-data-db-acl`                                        |
| Dry-run repair       | `pnpm --filter=@faims3/api run repair-data-db-acl -- --dry-run`                           |
| Proxy health         | `curl -f "$COUCHDB_PUBLIC_URL/_couch-auth-proxy/health"`                                  |
| Integration proof    | `pnpm --filter=@faims3/api run test:couch-auth-proxy`                                     |
| Image / ddoc pin     | compose + CDK `1.4.0` ↔ vendored map `2.3.0` (`COUCH_AUTH_PROXY_ACL_DDOC_VERSION`)        |

---

## Common failure modes

1. **Migrate never run after deploy** — unstamped legacy docs stay `r-*`
   (member-readable). Same as pre-proxy public Couch; fix by running migrate +
   repair.
2. **Couch still published on the internet** — proxy is bypassable. Lock Couch
   to internal networks only (AWS CDK does this; DO/custom must match).
3. **CORS missing app origin** — browser / Capacitor WebView sync fails; add
   origins to proxy `CORS_ORIGINS` (PWA host, Control Centre, and typically
   `https://localhost` / `capacitor://localhost` for native).
4. **Wrong logical migrations `dbName`** — migrations docs must be keyed by
   `data-{projectId}`, not a full Couch URL. Current Conductor enqueue does
   this; if you see URL-shaped keys in `migrations`, treat as a bug / re-run
   with a fixed build.
5. **Orphan docs** (`creator === __faims_acl_orphan__`) — invisible to guests;
   visible to ALL roles via `dbacl`. Investigate source docs missing
   `created_by` if that is unexpected.
6. **Compose vs CDK image drift** — both must pin **`1.4.0`** (or the same
   replacement tag) so the vendored `_design/acl` map stays aligned.
