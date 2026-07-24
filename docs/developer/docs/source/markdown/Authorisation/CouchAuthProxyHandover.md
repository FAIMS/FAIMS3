# Agent handover: couch-auth-proxy integration

This document is the implementation brief for closing FAIMS’s **per-document read
gap** on CouchDB sync by integrating
[`PeterBaker0/couch-auth-proxy`](https://github.com/PeterBaker0/couch-auth-proxy).

It is written for a follow-on coding agent. Prefer this document over chat
history. Do not invent a second permission language — extend the existing
`@faims3/data-model` RBAC so sync enforcement matches API/UI semantics.

---

## 0. Mission

**Goal.** A `PROJECT_GUEST` (and any principal with only `READ_MY_PROJECT_RECORDS`)
must be unable to pull other users’ records, revisions, AVPs, or attachments
over Pouch↔Couch sync. Contributors and above with `READ_ALL_PROJECT_RECORDS`
must still sync the full project corpus. Writes must remain consistent with
today’s my/all rules.

**Non-goals (v1).**

- Replacing Conductor JWT auth or the people/roles store.
- Moving Control Centre / API traffic through the proxy.
- Field-level ACL, sharing individual records with arbitrary users, or changing
  the public role names (`PROJECT_GUEST`, etc.).
- Publishing couch-auth-proxy as an npm dependency inside this monorepo (it is a
  Docker/GHCR **service**).

**Success.** End-to-end, with the proxy in front of Couch:

1. Guest A creates records; Guest B cannot see them via sync, `_all_docs`,
   `_changes`, or attachment GET.
2. Contributor C can see and edit A’s records.
3. Guest A can still see their own record graph after C edits it.
4. New code paths always stamp ACL fields; only migrations touch unstamped
   legacy docs.

---

## 1. Background (read this once)

### 1.1 The gap

| Layer                                                | My vs all enforced?   |
| ---------------------------------------------------- | --------------------- |
| Permission model (`Action.READ_MY_*` / `READ_ALL_*`) | Intended policy       |
| API `canReadRecord` / Records CRUD                   | Yes                   |
| App `shouldDisplayRecord`                            | UI filter only        |
| Couch `_design/permissions` `validate_doc_update`    | Writes yes            |
| Couch `_security` + Pouch sync                       | **No — DB-wide read** |

Today `data-{projectId}` `_security.members` includes every role that grants
`READ_MY_PROJECT_RECORDS` (including guests). CouchDB cannot filter reads
per-document, so a guest JWT can replicate the entire DB. The comment in
`library/data-model/src/data_storage/dataDB/security.ts` states this explicitly.

### 1.2 What couch-auth-proxy does

Clone/reference: `https://github.com/PeterBaker0/couch-auth-proxy` (read
`README.md` + `USER-GUIDE.md`).

- Reverse proxy in front of CouchDB 3.5+.
- Auth is Couch-native: forward `Authorization` / `Cookie`, resolve via
  `GET /_session`. FAIMS RSA JWT validation stays in Couch (`jwt_keys`).
- Per-doc grants: `creator` (r/w/d), `owners` (r/w), `acl` (read), `parent`
  (inherit parent ACL, union).
- Bucket overlay on `_design/acl`: `dbacl.{_r,_w,_d}` and optional `restrict`.
- Filters `_changes`, `_bulk_get`, `_all_docs`, views, `_find`, attachments, etc.
- Missing `creator` / `owners` / `acl` ⇒ open to authenticated members (`r-*`).
  **Unstamped docs are world-readable to DB members.**
- Published as `ghcr.io/peterbaker0/couch-auth-proxy` (not an npm library;
  `package.json` is `"private": true`).

### 1.3 FAIMS document graph (data DB)

| Doc        | Id prefix              | Ownership / linkage                               |
| ---------- | ---------------------- | ------------------------------------------------- |
| Record     | `rec-`                 | `created_by` = record owner (product “my record”) |
| Revision   | `frev-`                | `record_id`; `created_by` often = **editor**      |
| AVP        | `avp-`                 | `record_id`; `created_by` often = editor          |
| Attachment | `att-` / attach format | `record_id`; `created_by` from record context     |

Product rule is **record-level** my/all (`canReadProjectRecord` compares
record `created_by` to acting user). Revision/AVP `created_by` is audit of who
wrote that node — **not** sufficient alone for ACL. Children must inherit from
the `rec-*` document via proxy `parent`.

Field-name notes (no collisions):

- Proxy `parent` is a **string doc id**. FAIMS uses `parents: RevisionID[]` and
  nested `relationship.parent` — top-level string `parent` is free for ACL.
- Proxy `creator` is distinct from FAIMS `created_by`. Keep both: `created_by`
  remains FAIMS audit; `creator` is the ACL grant field. On the clean path they
  are set together from the same user id at create time for `rec-*`.

### 1.4 Existing permission helpers to reuse

Do **not** hardcode role name lists. Use:

- `necessaryActionToCouchRoleList({ action, resourceId })` —
  `library/data-model/src/permission/functions.ts`
- `canReadProjectRecord` / `canEditProjectRecord` / `canDeleteProjectRecord`
- JWT `_couchdb.roles` encoding (`projectId||ROLE` via `ENCODING_SEPARATOR`)
- `COUCHDB_PUBLIC_URL` vs internal Couch URL (`api/src/buildconfig.ts`,
  `api/src/couchdb/notebooks.ts` sets `dataDb.base_url` from public URL)

Proxy admin bypass is Couch server role `_admin` only. FAIMS `GENERAL_ADMIN` is
a JWT/DB role and must receive access via `dbacl` tokens (already included in
`necessaryActionToCouchRoleList` expansion + role inheritance), not via proxy
admin bypass.

---

## 2. Design principles (non-negotiable)

1. **One clean write path.** Every new data-DB document produced by the engine /
   attachment service / API mutations always includes the correct ACL fields.
   No feature flags that skip stamping in “legacy mode” on the hot path.
2. **Legacy only in migrations.** Code that understands “doc has no `creator`”
   lives under the Couch migration framework (and one-shot backfill helpers),
   not in sync helpers or the database engine.
3. **Idiomatic proxy usage.** Prefer:
   - `creator` on `rec-*` for ownership lifecycle
   - `parent: <recordId>` on all child docs in the record graph
   - `dbacl` for role-wide ALL grants  
     Do **not** stamp every doc with huge `acl`/`owners` role arrays that must be
     rewritten when roles change.
4. **Single policy source.** `dbacl` role token lists are generated from
   `necessaryActionToCouchRoleList` for `READ_ALL` / `EDIT_ALL` / `DELETE_ALL`.
   If the permission model changes, `dbacl` generation follows automatically.
5. **API keeps admin Couch.** Conductor continues to use
   `COUCHDB_INTERNAL_URL` with admin credentials. Apps use
   `COUCHDB_PUBLIC_URL` → proxy only.
6. **Defense in depth stays.** Keep `_design/permissions` VDU, API
   `canReadRecord`, and app `shouldDisplayRecord`. The proxy becomes the sync
   read boundary; do not delete the others in v1.
7. **Fail closed.** Never expose public Couch without the proxy once ACL is
   required. Unstamped DBs must not be pointed at the proxy for non-admin
   traffic.

---

## 3. Target ACL model (canonical)

### 3.1 Per-document fields (clean path)

```text
rec-{id}
  created_by: <recordOwner>          # FAIMS audit (unchanged meaning)
  creator:    <recordOwner>          # ACL — r/w/d for owner

frev-*, avp-*, attachment docs
  created_by: <writer>               # who wrote this node
  creator:    <writer>               # ACL creator for that node
  parent:     "rec-{id}"             # inherit record ACL (union)
```

Effects:

- Guest owner: `creator` on `rec-*` (+ parent inheritance on children) ⇒ full
  control of own graph.
- Guest stranger: no `creator` match, not in `dbacl._r` ⇒ docs invisible
  (404 / filtered from `_changes`).
- Contributor edits guest record: new frev/avp get `creator: contributor` but
  `parent: rec-…` so the guest still reads them; contributor writes via
  `dbacl._w`.

### 3.2 `_design/acl` bucket policy (per project data DB)

Provisioned at DB init (and by migration for existing DBs):

```json
{
  "_id": "_design/acl",
  "dbacl": {
    "_r": ["/* roles from READ_ALL_PROJECT_RECORDS */"],
    "_w": ["/* roles from EDIT_ALL_PROJECT_RECORDS */"],
    "_d": ["/* roles from DELETE_ALL_PROJECT_RECORDS */"]
  },
  "acl": [],
  "views": {"acl": {"map": "…"}},
  "validate_doc_update": "…"
}
```

Implementation guidance:

- Prefer **reusing** the map + VDU source from couch-auth-proxy
  (`src/acl/ddoc.ts` — currently versioned ~`2.3.0`) rather than rewriting it.
  FAIMS vendors the map as-is and ships a **fail-closed VDU extension**
  (`2.3.0-faims1`): non-admin creates must include `creator`, and children with
  `record_id` must set `parent === record_id` (upstream alone allows omitting
  `creator`, which grants `r-*`). Keep the map in sync with the proxy image.
- Set `dbacl` lists via `necessaryActionToCouchRoleList` (include `_admin` as
  that helper already does).
- Leave other design docs readable by default (`r-*` read-only) so clients can
  pull `attachment_filter` / index views. Keep `_design/acl` itself `acl: []`.

### 3.3 Couch `_security` (unchanged membership semantics)

Keep members = roles granting `READ_MY_PROJECT_RECORDS`. Membership answers
“may talk to this DB?”; the proxy answers “which docs?”.

### 3.4 Dual `validate_doc_update`

Couch runs VDUs from **all** design docs:

| Design doc            | Responsibility                                                            |
| --------------------- | ------------------------------------------------------------------------- |
| `_design/permissions` | Existing my/all write rules on `created_by`; forbid changing `created_by` |
| `_design/acl`         | Forbid forging `creator`; owners/acl mutation rules                       |

On create of `rec-*`, set `created_by` and `creator` to the **authenticated**
user (proxy VDU rejects spoofed `creator`). Do not invent a third VDU.

### 3.5 Mapping cheat sheet

| FAIMS capability             | Enforcement after integration          |
| ---------------------------- | -------------------------------------- |
| `READ_MY_PROJECT_RECORDS`    | `creator` / `parent` on record graph   |
| `READ_ALL_PROJECT_RECORDS`   | `dbacl._r`                             |
| `EDIT_MY_PROJECT_RECORDS`    | `creator` (+ existing permissions VDU) |
| `EDIT_ALL_PROJECT_RECORDS`   | `dbacl._w` + permissions VDU           |
| `DELETE_MY_PROJECT_RECORDS`  | `creator` `_d` + permissions VDU       |
| `DELETE_ALL_PROJECT_RECORDS` | `dbacl._d` + permissions VDU           |
| Design doc pull for sync     | Default design-doc read for `r-*`      |

---

## 4. Target runtime architecture

```text
Browser app (Pouch) -- Bearer JWT --> couch-auth-proxy --> CouchDB
Conductor API (admin Basic) ------------------------------> CouchDB
Web Control Centre --> Conductor API only (no direct data sync)
```

| Config                                 | Points at                                                       |
| -------------------------------------- | --------------------------------------------------------------- |
| `COUCHDB_PUBLIC_URL`                   | Proxy base URL (no trailing slash) — used for `dataDb.base_url` |
| `COUCHDB_INTERNAL_URL` (or equivalent) | Couch directly — Conductor only                                 |

Suggested proxy env (FAIMS):

```bash
COUCH_URL=http://couchdb:5984
COUCH_ADMIN_USER=...
COUCH_ADMIN_PASSWORD=...
ACL_DB_INCLUDE=/^data-/
ACL_ROUTE_INCLUDE=pouch-sync,session
ACL_AUTO_INSTALL=false          # FAIMS provisions _design/acl
AUTH_RESOLVE_VIA_COUCH_SESSION=true
CORS_ORIGINS=http://localhost:3000,...
COUCH_PRELOAD_DBS=              # optional; warm known data-* DBs
```

Local compose: add a `couch-auth-proxy` service; publish proxy port to the host;
do **not** publish Couch to the host in the “app-like” profile (dev overlay may
still expose Couch for admin debugging).

---

## 5. Clean-code inventory (what to change)

### 5.1 `@faims3/data-model` — first-class ACL

| Area                                                                                    | Change                                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types (`types.ts`, Zod engine schemas)                                                  | Add required `creator: string` on data-DB docs for the clean schema; add optional/required `parent?: string` on non-record docs. Do **not** overload FAIMS `relationship.parent`. |
| ACL helpers (new module, e.g. `permission/couchAcl.ts` or `data_storage/dataDB/acl.ts`) | `buildDataDbAclDesignDoc(projectId)`, `stampRecordAcl({createdBy})`, `stampChildAcl({createdBy, recordId})`, `buildDbAclOverlay(projectId)`. Pure functions; unit-tested.         |
| `initDataDB` / `dataDbDesignDocuments`                                                  | Install `_design/acl` with map/VDU + `dbacl` for the project.                                                                                                                     |
| Database engine create paths                                                            | Every `createRecord` / `createRevision` / AVP write / attachment create calls stamp helpers. **No** “if missing creator” branches here.                                           |
| Attachment service                                                                      | Stamp `creator` + `parent: recordId` on all attachment document constructors.                                                                                                     |
| Permission docs                                                                         | Update `PermissionModel.md` with a short “Sync enforcement” section pointing here.                                                                                                |

Recommended helper shapes (illustrative):

```ts
export function stampRecordAcl(createdBy: string): {creator: string} {
  return {creator: createdBy};
}

export function stampChildAcl(args: {createdBy: string; recordId: string}): {
  creator: string;
  parent: string;
} {
  return {creator: args.createdBy, parent: args.recordId};
}

export function buildDbAclOverlay(projectId: string): DbAclOverlay {
  return {
    _r: necessaryActionToCouchRoleList({
      action: Action.READ_ALL_PROJECT_RECORDS,
      resourceId: projectId,
    }),
    _w: necessaryActionToCouchRoleList({
      action: Action.EDIT_ALL_PROJECT_RECORDS,
      resourceId: projectId,
    }),
    _d: necessaryActionToCouchRoleList({
      action: Action.DELETE_ALL_PROJECT_RECORDS,
      resourceId: projectId,
    }),
  };
}
```

### 5.2 `api` — provisioning + public URL

| Area                      | Change                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Notebook/data DB creation | Ensure init installs `_design/acl` (via data-model init).                                                  |
| `.env.dist` / compose     | Document `COUCHDB_PUBLIC_URL` → proxy; internal URL → Couch.                                               |
| Optional readiness        | Health check that proxy `/_couch-auth-proxy/health` is up in dev scripts.                                  |
| Records CRUD / export     | Keep using admin internal Couch (bypass proxy). No ACL stamping duplication if they go through the engine. |

### 5.3 `app` — sync client

| Area                  | Change                                                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote Pouch URL      | Already uses `dataDb.base_url` from Conductor — should “just work” when public URL is the proxy.                                                                                                                            |
| Token fetch           | Keep Bearer JWT; ensure CORS allows app origin on proxy.                                                                                                                                                                    |
| Post-cutover hygiene  | No automatic local wipe. Accept that pre-proxy leftover docs may linger in IndexedDB until the user refreshes / reactivates; wire isolation is enforced by the proxy. Optional manual “wipe local data” remains a developer affordance. |
| `shouldDisplayRecord` | Keep as UX; do not treat it as security.                                                                                                                                                                                    |

### 5.4 Infra

| Area                              | Change                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `docker-compose.yml` (+ overlays) | Add proxy service; wire public URL; optional hide Couch port.                                         |
| AWS CDK / DigitalOcean            | Public hostname → proxy; Couch SG/internal only. See [CouchAuthProxyAwsCdk](CouchAuthProxyAwsCdk.md). |
| Pin proxy image version           | Match vendored `_design/acl` map/VDU version.                                                         |

### 5.5 Migrations only (legacy)

DATA DB is `defaultVersion: 1, targetVersion: 2`
(`library/data-model/src/data_storage/migrations/migrations.ts`). Keeping
`defaultVersion` at **1** (not 2) is intentional: data DBs that never received
a migrations document still run the idempotent 1→2 backfill.

**DATA v1 → v2** (implemented):

1. Ensures `_design/acl` exists with correct `dbacl` for `projectId`
   (derive project id from logical DB name `data-{projectId}`; parsers also
   accept remote Pouch URL forms of `db.name`).
2. For each `rec-*`: if `creator` missing, set `creator = created_by` (or
   `__faims_acl_orphan__` when `created_by` is missing — fail-closed).
3. For each doc with `record_id` (frev/avp/attachment): set
   `creator = created_by` if missing; set `parent = record_id` if missing.
4. Never strip FAIMS fields; never rewrite role arrays onto every doc.
5. Idempotent: already-stamped docs ⇒ `action: 'none'`.

Conductor must enqueue DATA migrations with the **logical** Couch name
(`data-{projectId}`), not `pouchDb.name` (a URL for remote handles).

No production reader/writer should branch on “pre-ACL doc” outside this
migration (+ tests for it).

---

## 6. Phased delivery

### Phase A — Prove the idea (code + ACL validation)

**Objective.** New projects on a local stack with the proxy enforce my/all on
sync. No production migration yet; greenfield data DBs only.

**Work order.**

1. **Vendor ACL design doc builder** in data-model + `buildDbAclOverlay`.
2. **Stamp helpers** + wire into engine + attachment creates (clean path only).
3. **`initDataDB`** installs `_design/acl` for new data DBs.
4. **Compose**: run couch-auth-proxy; point `COUCHDB_PUBLIC_URL` at it for app
   sync; API keeps internal Couch.
5. **Validation suite (required before Phase B):**
   - Unit tests for stamp helpers + `dbacl` role lists (guest not in `_r`,
     contributor/manager/admin tokens present as expected).
   - Integration test (API or data-model test harness) against real Couch +
     proxy:
     - Create project/data DB through normal init.
     - As user A (guest JWT): put record graph; pull as user B (guest) ⇒ B does
       not receive A’s docs.
     - As contributor JWT: pull ⇒ sees A’s docs; can write new revision;
       guest A can still pull the new frevs/avps via `parent`.
     - Direct attachment GET as B ⇒ 404.
     - B cannot `_bulk_get` A’s ids (not_found / filtered — match proxy
       semantics; keyed lists may return placeholders — assert no body leak).
   - Optional thin app-level sync test if feasible; otherwise proxy+Pouch memory
     adapter test patterned on couch-auth-proxy’s
     `test/integration/pouch-sync.test.ts`.

**Phase A exit criteria.**

- [x] New data DB init includes `_design/acl` with project-scoped `dbacl`.
- [x] Every new rec/frev/avp/att from the engine has correct ACL fields.
- [x] Integration test proves guest isolation + contributor access + parent
      inheritance after third-party edit (`api/test/couchAuthProxy.integration.test.ts`).
- [x] Conductor admin paths still work on internal URL.
- [x] No migration code required for the proof (empty/new DB).

**Do not** start large backfills until Phase A is green.

### Phase B — Migrations, hardening, full tests

**Objective.** Existing deployments can upgrade safely; CI and e2e cover the
matrix; public Couch is locked down.

**Work order.**

1. **DATA DB migration v1→v2** (backfill `creator`/`parent` + install/repair
   `_design/acl` / `dbacl`).
2. **Idempotent repair tool** (optional ops script) to re-apply `dbacl` if
   permission model tokens change.
3. **Hardening**
   - `ACL_DB_INCLUDE=/^data-/`, `ACL_ROUTE_INCLUDE=pouch-sync,session`
   - `ACL_AUTO_INSTALL=false` in prod
   - CORS allowlist
   - Do not publish Couch publicly
   - Proxy readiness in deploy checks
4. **Client changeover** after public URL flip: re-point remotes at the new
   `dataDb.base_url`; do **not** auto-wipe local IndexedDB (leftover pre-proxy
   docs are an accepted trade-off until refresh / re-activate).
5. **Test pyramid expansion** (below).
6. **Docs**: `PermissionModel.md`, user sync/permissions notes, compose/README
   startup steps, this handover marked “implemented” sections as you go.
7. **Infra** CDK/DO follow-up if out of band — at least leave compose reference
   shape complete. AWS design:
   [CouchAuthProxyAwsCdk](CouchAuthProxyAwsCdk.md).

**Phase B exit criteria.**

- [x] Migration upgrades a fixture DB of unstamped docs to enforced ACL (DATA v1→v2).
- [x] Unit + integration coverage for guest/contributor matrix (e2e focused spec optional follow-up).
- [x] Cutover runbook: backfill → flip public URL → re-point client remotes (see §13).
- [x] Ops repair script for `_design/acl` / `dbacl` (`pnpm --filter=@faims3/api run repair-data-db-acl`).
- [x] Client remote re-point on public URL changeover (`reconcileRemoteCouchUrlAfterListing`); no local wipe.
- [ ] Focused e2e guest isolation spec (optional follow-up).
- [x] Infra AWS CDK: public hostname → proxy; Couch internal-only
      ([CouchAuthProxyAwsCdk](CouchAuthProxyAwsCdk.md); always-on on shared ALB).
- [ ] Infra DigitalOcean implementation (still open; compose reference complete).

---

## 7. Testing plan

### 7.1 Unit (`@faims3/data-model`, fast)

| Case                               | Assert                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `stampRecordAcl` / `stampChildAcl` | Field shapes; parent is record id                                                    |
| `buildDbAclOverlay`                | Guest role tokens **absent** from `_r/_w/_d`; contributor+ present; `_admin` present |
| Engine create record               | Output doc includes `creator === created_by`                                         |
| Engine create revision / AVP       | `creator` set; `parent === record_id`                                                |
| Attachment document builders       | Same child stamping                                                                  |
| Migration function                 | Unstamped → update; stamped → none; wrong parent repaired                            |

### 7.2 Integration (Couch + proxy)

Preferred location: new suite under `api/test/` or `library/data-model` with an
explicit “needs docker proxy” script, mirroring couch-auth-proxy integration
tests. Minimum scenarios:

1. **Guest isolation** — two guests, same project; B’s `_changes` /
   `allDocs` / Pouch replicate does not include A’s `rec/frev/avp/att`.
2. **Contributor read-all** — contributor replicate receives A’s docs.
3. **Contributor edit + owner read** — contributor adds revision; guest A pull
   receives new nodes (parent inheritance).
4. **Guest write denial** — guest cannot update/delete A’s record when not
   owner (proxy 403 + permissions VDU).
5. **Design docs** — guest can read `_design/attachment_filter` (sync filter
   still works).
6. **API bypass** — Conductor list/get with admin still sees all records for
   export paths that require it; Records CRUD still filters by `canReadRecord`.

Use real JWTs minted the FAIMS way (`_couchdb.roles` claim) so session
resolution matches production.

### 7.3 App unit / component

- Where tests mock remote DB, ensure fixtures include ACL fields so we do not
  reintroduce unstamped fixtures on the clean path.
- Sync helper tests: remote URL host is public/proxy URL from server config.

### 7.4 E2E (`@faims3/e2e`)

Add specs (app and/or web as appropriate), e.g.:

- `e2e/test/specs/app/guest-record-isolation.e2e.ts`
  - Seed/invite Guest A + Guest B + Contributor on one notebook.
  - A creates a record with distinctive field data (and ideally an attachment).
  - Sync A; sync B; B’s UI must not show A’s record (existing UI filter) **and**
    a debug/probe step (or local DB assertion via browser tools / exposed test
    hook) confirms B’s local data DB does not contain A’s `rec-*` id.
  - Contributor sync sees A’s record; can open it.
- Extend `permissions-matrix.e2e.ts` only if it stays readable; prefer a focused
  sync isolation spec over bloating the matrix.

E2E requires stack with proxy + `COUCHDB_PUBLIC_URL` pointing at it + seeded
users. Document env in `e2e/.env.dist`.

### 7.5 Regression checklist

- Attachment sync filter (`attachment_filter`) still works through proxy.
- Push-only sync mode still pushes guest’s own docs.
- Soft delete / conflict paths still replicate for authorized users.
- Team virtual roles (team member ⇒ contributor) still get `dbacl` access via
  JWT role expansion.
- Impersonation (if applicable) still authorized correctly end-to-end.

---

## 8. Implementation notes and pitfalls

1. **Cutover order:** stamp-on-write → backfill migration → point
   `COUCHDB_PUBLIC_URL` at proxy. Reversing this opens `r-*` on legacy docs.
2. **Local leftover data:** clients that synced before ACL may retain other
   users’ docs offline until refresh / re-activate. Isolation is enforced on
   the wire; automatic local wipe was deliberately not implemented.
3. **Do not use doc `acl`/`owners` arrays for project roles** on every record —
   role changes would require rewriting the corpus. `dbacl` is the idiomatic
   FAIMS mapping.
4. **Multipart:** proxy rejects non-admin multipart document writes (415).
   FAIMS attachment flow uses JSON doc + `putAttachment` — keep it that way.
5. **View reduce/group:** proxy returns 501 for non-admins. Ensure app sync
   does not depend on reduce queries through the proxy.
6. **Keyed list placeholders:** proxy may return `not_found` placeholders for
   denied ids on keyed `_all_docs` to preserve alignment — tests must assert
   **no document body**, not merely “row absent”.
7. **Two VDUs:** test creates with mismatched `creator` vs session user (must
   fail) and `created_by` changes on update (must fail).
8. **Proxy version pin:** vendored map/VDU must match image; note the upstream
   version in a code comment.
9. **System DBs:** never ACL-enable `people` / `projects` / `auth` for app
   users; `ACL_DB_INCLUDE=/^data-/` is mandatory for defense in depth.
10. **Records CRUD** already enforces my/all — keep it as the online API path;
    do not force it through the proxy.

---

## 9. Suggested PR breakdown

Keep PRs reviewable; each should leave main green.

| PR  | Scope                                                                                      | Phase |
| --- | ------------------------------------------------------------------------------------------ | ----- |
| 1   | ACL helpers + types + engine/attachment stamping + unit tests; init installs `_design/acl` | A     |
| 2   | Compose proxy service + env wiring + integration tests (guest/contributor)                 | A     |
| 3   | DATA migration v1→v2 + migration tests                                                     | B     |
| 4   | E2E guest isolation + docs (`PermissionModel`, sync, README/compose)                       | B     |
| 5   | Infra hardening (CDK/DO), client local DB reset UX if needed                               | B     |

---

## 10. Day-one agent checklist

```text
[x] Read this handover + couch-auth-proxy USER-GUIDE.md (ACL sections)
[x] Read PermissionModel.md + dataDB security.ts + permissions VDU
[x] Skim database engine create/update/delete + attachment service
[x] Phase A: helpers → stamp writes → initDataDB → compose proxy
[x] Phase A: run unit + integration ACL proof (guest/contributor/parent)
[x] Commit/push; Phase B migration included once proof helpers landed
[x] Phase B: DATA migration; hardening env; docs; repair script; client cutover
[x] AWS CDK always-on proxy (CouchAuthProxyAwsCdk) — DigitalOcean still open
[ ] Optional: focused e2e guest isolation + DigitalOcean proxy coding
```

### Commands (FAIMS repo)

```bash
# after implementing
pnpm --filter=@faims3/data-model test
pnpm --filter=@faims3/api test
pnpm --filter=@faims3/app test
# integration (stack: couchdb + couch-auth-proxy)
pnpm --filter=@faims3/api run test:couch-auth-proxy
# repair dbacl on existing data DBs
pnpm --filter=@faims3/api run repair-data-db-acl
# e2e (stack up + proxy + seed)
pnpm --filter=@faims3/e2e test:e2e:headless:ci
```

### Commands (proxy upstream, for learning / comparison)

```bash
git clone https://github.com/PeterBaker0/couch-auth-proxy.git
cd couch-auth-proxy && pnpm install
docker compose up -d --build
pnpm test && pnpm test:integration
```

---

## 11. Definition of done (whole project)

- Guests cannot obtain other users’ project data via sync or Couch HTTP through
  the public endpoint.
- Contributors/managers/admins retain full corpus sync per existing roles.
- Clean write path always stamps ACL; legacy handling exists only in DATA
  migrations.
- `dbacl` is derived from `necessaryActionToCouchRoleList`, not hand-maintained
  role literals scattered in compose.
- Unit, integration, and e2e coverage exist for the guest/contributor matrix
  and parent-inheritance case.
- Developer docs describe sync enforcement; compose/dev startup brings proxy up
  with the stack.

---

## 12. References (in-repo)

| Path                                                                  | Why                                                      |
| --------------------------------------------------------------------- | -------------------------------------------------------- |
| `library/data-model/src/data_storage/dataDB/security.ts`              | Current read gap comment                                 |
| `library/data-model/src/data_storage/dataDB/design.ts`                | Permissions VDU + design docs                            |
| `library/data-model/src/data_storage/dataDB/init.ts`                  | Data DB init hook                                        |
| `library/data-model/src/permission/model.ts`                          | Roles/actions                                            |
| `library/data-model/src/permission/functions.ts`                      | `canReadProjectRecord`, `necessaryActionToCouchRoleList` |
| `library/data-model/src/databaseEngine/engine.ts`                     | Record/revision/AVP writes                               |
| `library/data-model/src/databaseEngine/services/attachments/couch.ts` | Attachment docs                                          |
| `api/src/recordAuth.ts`                                               | API record auth mirror                                   |
| `api/src/couchdb/notebooks.ts`                                        | `dataDb.base_url = couchdbPublicUrl`                     |
| `app/src/users.ts`                                                    | UI `shouldDisplayRecord` (not security)                  |
| `app/src/context/slices/helpers/databaseHelpers.ts`                   | Remote Pouch + JWT                                       |
| `docs/developer/docs/source/markdown/PermissionModel.md`              | Policy docs                                              |
| `docs/developer/docs/source/markdown/RecordsCRUDApi.md`               | Online API already correct                               |
| `docs/developer/docs/source/markdown/CouchMigrations.md`              | Migration framework                                      |
| `api/doc/DATABASE.md`                                                 | rec/frev/avp layout                                      |
| `docs/user/core/permissions.md`                                       | User-facing role table                                   |

External: [PeterBaker0/couch-auth-proxy](https://github.com/PeterBaker0/couch-auth-proxy)
(`README.md`, `USER-GUIDE.md`, `src/acl/ddoc.ts`,
`test/integration/pouch-sync.test.ts`).

---

## 13. Cutover runbook (production / existing deployments)

**Operator-facing guide (preferred):**
[CouchAuthProxyCutover.md](CouchAuthProxyCutover.md) — phased deploy, verify
commands, rollback, and failure modes.

**Order is mandatory.** Reversing steps leaves unstamped docs world-readable to
DB members (`r-*`).

1. **Deploy stamp-on-write + init + DATA v1→v2 migration** while
   `COUCHDB_PUBLIC_URL` still points at Couch (or at least before relying on
   proxy isolation).
2. **Migrate all data DBs** (`pnpm run migrate-with-keys` / normal Conductor
   startup migration). Confirm every DATA migrations doc is keyed by
   `data-{projectId}` at version **2**.
3. **Repair / verify `_design/acl`** (mandatory before first proxy flip;
   afterward use for permission-model token drift):
   `pnpm --filter=@faims3/api run repair-data-db-acl` (`--dry-run` supported).
4. **Point `COUCHDB_PUBLIC_URL` at couch-auth-proxy**; keep
   `COUCHDB_INTERNAL_URL` on Couch for Conductor admin. Do not publish Couch
   publicly.
5. **Clients re-point remotes** when Conductor advertises a new
   `dataDb.base_url` (`reconcileRemoteCouchUrlAfterListing`). Local IndexedDB
   is not wiped — leftover pre-proxy docs may linger until refresh /
   re-activate (accepted). Same-hostname AWS ALB flips need no schema bump.
6. **Validate**: guest A/B isolation + contributor read-all
   (`pnpm --filter=@faims3/api run test:couch-auth-proxy` locally, or manual
   sync probe).

### Migration path notes

- DATA `defaultVersion` is **1** (not 2) so databases that never received a
  migrations document still run the idempotent 1→2 backfill. New DBs already
  stamp on write; the migrator is a no-op on stamped docs and still ensures
  `_design/acl`.
- Docs missing `created_by` are stamped with synthetic creator
  `__faims_acl_orphan__` (fail-closed for guests; ALL roles retain access via
  `dbacl`).
- Backup restore stamps missing ACL fields on data-DB corpus so pre-ACL
  backups cannot reintroduce `r-*` docs after migrations are already at v2.
- Proxy health endpoint: `/_couch-auth-proxy/health` (compose +
  `localdev.sh` wait on this). Prefer this over any `/ready` alias.
- AWS CDK always-on proxy is implemented; DigitalOcean still needs the public
  → proxy / Couch internal split.
