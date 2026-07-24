# Deploying couch-auth-proxy (operator cutover)

Practical runbook for enabling per-document sync ACL via
[`couch-auth-proxy`](https://github.com/PeterBaker0/couch-auth-proxy). For design
background see [CouchAuthProxyHandover](CouchAuthProxyHandover.md) and
[PermissionModel — Sync enforcement](../PermissionModel.md).

**Order is mandatory.** Pointing `COUCHDB_PUBLIC_URL` at the proxy before every
`data-*` DB has `_design/acl` and stamped docs leaves unstamped documents
world-readable to DB members (`r-*`).

---

## What changes at cutover

| Concern                             | Before                       | After                                        |
| ----------------------------------- | ---------------------------- | -------------------------------------------- |
| App sync URL (`COUCHDB_PUBLIC_URL`) | Direct Couch                 | couch-auth-proxy                             |
| Conductor (`COUCHDB_INTERNAL_URL`)  | Direct Couch (admin)         | Unchanged — still direct Couch               |
| Guest sync reads                    | Entire project data DB       | Own record graph only (`creator` / `parent`) |
| Contributor+ sync reads             | Entire DB                    | Entire DB via `_design/acl` `dbacl`          |
| Client IndexedDB                    | May hold leaked guest corpus | Rebuilt when public URL / ACL marker changes |

---

## Environments

### Local compose (dev)

Already wired in `docker-compose.yml`:

1. `couchdb` on host port `COUCHDB_EXTERNAL_PORT` (default **5984**)
2. `couch-auth-proxy` on `COUCH_AUTH_PROXY_EXTERNAL_PORT` (default **5985**)
3. `api/.env`: `COUCHDB_INTERNAL_URL=http://localhost:5984`,
   `COUCHDB_PUBLIC_URL=http://localhost:5985`

`./localdev.sh` starts Couch + proxy and waits on
`/_couch-auth-proxy/health` before migrate/dev.

### Production (AWS CDK / DigitalOcean / custom)

Today’s CDK/DO stacks may still set `COUCHDB_PUBLIC_URL` to raw Couch — treat
proxy wiring as a **required follow-up** for this feature. You need:

1. Run `ghcr.io/peterbaker0/couch-auth-proxy` (pin the image tag that matches
   vendored ddoc **2.3.0** — see `docker-compose.yml`).
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

---

## Recommended production sequence

### Phase 0 — Preconditions

- [ ] Deploy FAIMS build that includes stamp-on-write, DATA v1→v2 migration,
      `repair-data-db-acl`, and client cutover (`openLocalDataDbWithAclCutover`).
- [ ] Keep `COUCHDB_PUBLIC_URL` on **direct Couch** for this phase (or accept
      that sync is still DB-wide until Phase 3).
- [ ] Proxy container can be deployed idle / not yet advertised.

### Phase 1 — Backfill ACL on every data DB

Conductor migrate (startup or explicit):

```bash
pnpm run migrate-with-keys
# or, inside the api container / process you already use for migrate
```

This runs DATA **v1→v2** for each project data DB:

- Stamps `creator` / `parent` on legacy docs (orphan docs without `created_by`
  get synthetic creator `__faims_acl_orphan__` — fail-closed for guests).
- Ensures `_design/acl` + project-scoped `dbacl`.

Then **verify / repair** control-plane ddocs (idempotent; safe anytime):

```bash
pnpm --filter=@faims3/api run repair-data-db-acl -- --dry-run
pnpm --filter=@faims3/api run repair-data-db-acl
```

Dry-run should show every `data-*` DB with `_design/acl` present and
`dbacl._r` counts matching the permission model. Fix any `MISSING` / failed
rows before continuing.

### Phase 2 — Confirm migration inventory

In the Couch `migrations` database, each DATA entry keyed by logical name
`data-{projectId}` should be at **version 2** with `status: healthy`.

Quick checks (admin against **internal** Couch):

```bash
# List data DBs
curl -s -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \
  "$COUCHDB_INTERNAL_URL/_all_dbs" | jq '.[] | select(startswith("data-"))'

# Spot-check one design doc
curl -s -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \
  "$COUCHDB_INTERNAL_URL/data-<projectId>/_design/acl" | jq '{version, dbacl}'
```

Do **not** flip the public URL until every project you care about is green.

### Phase 3 — Flip public URL to the proxy

1. Ensure proxy health: `GET {proxy}/_couch-auth-proxy/health` → 200.
2. Set `COUCHDB_PUBLIC_URL` to the proxy base URL (no trailing slash).
3. Restart Conductor so notebook listings advertise the new `dataDb.base_url`.
4. Leave `COUCHDB_INTERNAL_URL` on Couch.

After this, new app sessions sync through the proxy. Guests only receive their
own record graphs.

### Phase 4 — Client hygiene

The field app rebuilds local project data IndexedDB databases when:

- the local ACL marker is missing on a non-empty DB, or
- the marker version is behind, or
- the marker was sealed against a **different** public base URL than Conductor
  now advertises (this covers “app opened while URL still pointed at open
  Couch, then proxy flipped”).

Operators do not need a manual “wipe local data” step for normal cutover.
Users may see a one-time re-sync after the flip.

Ship / enable the app build that contains `openLocalDataDbWithAclCutover`
**with or after** Phase 3. Shipping the cutover-aware app _before_ Phase 1 is
fine; shipping it long before Phase 3 is also fine because the marker records
the remote URL and will invalidate on flip.

### Phase 5 — Validate

Local / staging (stack with Couch + proxy):

```bash
pnpm --filter=@faims3/api run test:couch-auth-proxy
```

Manual probe:

1. Invite Guest A + Guest B + Contributor on one notebook.
2. Guest A creates a record (ideally with an attachment); sync.
3. Guest B syncs — must not see A’s record in UI **and** must not hold A’s
   `rec-*` in the local data DB.
4. Contributor syncs — sees A’s record; can edit; Guest A still sees the
   updated graph.

---

## Rollback

| Situation                                 | Action                                                                                                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proxy misconfigured / outage              | Point `COUCHDB_PUBLIC_URL` back to Couch and restart Conductor. Sync reads become DB-wide again (old behaviour). ACL fields / `_design/acl` can remain — they are harmless for direct Couch. |
| Bad `dbacl` after permission-model change | `pnpm --filter=@faims3/api run repair-data-db-acl`                                                                                                                                           |
| One DB missing stamps                     | Re-run migrate (idempotent) and/or repair; do not flip public URL for that environment until fixed                                                                                           |

Rolling back the public URL does **not** remove stamped `creator`/`parent`
fields. Re-enabling the proxy later is safe if ddocs are still present.

---

## Ops cheat sheet

| Task                 | Command / check                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Migrate all DBs      | `pnpm run migrate-with-keys`                                                              |
| Repair `_design/acl` | `pnpm --filter=@faims3/api run repair-data-db-acl`                                        |
| Dry-run repair       | `pnpm --filter=@faims3/api run repair-data-db-acl -- --dry-run`                           |
| Proxy health         | `curl -f "$COUCHDB_PUBLIC_URL/_couch-auth-proxy/health"`                                  |
| Integration proof    | `pnpm --filter=@faims3/api run test:couch-auth-proxy`                                     |
| Image / ddoc pin     | compose image tag ↔ `COUCH_AUTH_PROXY_ACL_DDOC_VERSION` (`2.3.0`) in `@faims3/data-model` |

---

## Common failure modes

1. **Public URL flipped before migrate/repair** — guests (and all members) can
   read unstamped legacy docs. Fix: restore public URL to Couch, migrate +
   repair, then flip again.
2. **Couch still published on the internet** — proxy is bypassable. Lock Couch
   to internal networks only.
3. **CORS missing app origin** — sync fails in the browser; add origins to
   proxy `CORS_ORIGINS`.
4. **Wrong logical migrations `dbName`** — migrations docs must be keyed by
   `data-{projectId}`, not a full Couch URL. Current Conductor enqueue does
   this; if you see URL-shaped keys in `migrations`, treat as a bug / re-run
   with a fixed build.
5. **Orphan docs** (`creator === __faims_acl_orphan__`) — invisible to guests;
   visible to ALL roles via `dbacl`. Investigate source docs missing
   `created_by` if that is unexpected.
