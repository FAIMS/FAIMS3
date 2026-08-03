# ACL validation layering

Map of how FAIMS permissions and
[couch-auth-proxy](https://github.com/PeterBaker0/couch-auth-proxy) share
responsibility for project **data** DBs (`data-{projectId}`).

Related: [PermissionModel](../PermissionModel.md) (RBAC),
[CouchAuthProxyCutover](CouchAuthProxyCutover.md) (ops),
[CouchAuthProxyAclInstallBrief](CouchAuthProxyAclInstallBrief.md) (when the
proxy writes `_design/acl`),
[infrastructure/aws-cdk/README.md](../../../../../infrastructure/aws-cdk/README.md)
(AWS topology).

## Share of responsibility

| Concern                                                   | Owner                               | Mechanism                                                                                                           |
| --------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Policy vocabulary (roles/actions)                         | **FAIMS** `@faims3/data-model`      | `Action` / `Role` / `necessaryActionToCouchRoleList`                                                                |
| “May talk to this DB?”                                    | **FAIMS** + Couch                   | `_security.members` = roles with `READ_MY_PROJECT_RECORDS`                                                          |
| “Which docs may this member read/write/delete over sync?” | **couch-auth-proxy**                | Filters `_changes`, `_bulk_get`, docs, attachments using doc `creator` / `owners` / `acl` / `parent` + ddoc `dbacl` |
| Project-wide ALL grants on sync                           | **FAIMS** (lists) on **proxy** ddoc | `dbacl.{_r,_w,_d}` from `*_ALL_PROJECT_RECORDS` — patched after **warm** (proxy ping; see below)                    |
| Protocol integrity of ACL fields                          | **couch-auth-proxy**                | `_design/acl` validate_doc_update (forge/immutable `creator`, `owners`, `acl`, `parent`; optional require-creator)  |
| FAIMS stamp shape (`record_id` ↔ `parent`)                | **FAIMS**                           | `_design/faims_acl_shape` validate_doc_update                                                                       |
| Write my/all on `created_by`                              | **FAIMS**                           | `_design/permissions` validate_doc_update                                                                           |
| Online API my/all                                         | **FAIMS** Conductor                 | `canReadRecord` / Records CRUD (admin Couch, bypasses proxy)                                                        |
| UI filter                                                 | **FAIMS** app                       | `shouldDisplayRecord` — UX only, not security                                                                       |

Couch `_security` alone cannot filter reads per document. Guests remain DB
members so they can sync their own graph; the proxy is the sync read boundary.
Conductor keeps `COUCHDB_INTERNAL_URL` (admin Basic) and never relies on the
proxy for admin paths.

```text
App (Pouch + JWT) ──COUCHDB_PUBLIC_URL──► couch-auth-proxy ──► CouchDB
Conductor (admin) ─COUCHDB_INTERNAL_URL─────────────────────► CouchDB
```

### Mapping FAIMS actions → enforcement

| FAIMS capability             | Sync / Couch enforcement                                    |
| ---------------------------- | ----------------------------------------------------------- |
| `READ_MY_PROJECT_RECORDS`    | Doc `creator` / `parent` on the record graph (proxy filter) |
| `READ_ALL_PROJECT_RECORDS`   | `dbacl._r` (FAIMS-patched)                                  |
| `EDIT_MY_PROJECT_RECORDS`    | `creator` write + `_design/permissions`                     |
| `EDIT_ALL_PROJECT_RECORDS`   | `dbacl._w` + `_design/permissions`                          |
| `DELETE_MY_PROJECT_RECORDS`  | `creator` delete + `_design/permissions`                    |
| `DELETE_ALL_PROJECT_RECORDS` | `dbacl._d` + `_design/permissions`                          |
| Design-doc pull for sync     | Default design-doc read for authenticated members (`r-*`)   |

`GENERAL_ADMIN` is a JWT/DB role, not Couch `_admin`. It gets corpus access via
`dbacl` tokens from `necessaryActionToCouchRoleList`, not via proxy admin bypass.

## Design-doc layering (writes)

CouchDB runs **every** design doc’s `validate_doc_update` on a write; if any
throws, the write fails. Split ACL-related rules so the standalone proxy product
owns its protocol ddoc, and FAIMS owns application policy only.

| Design doc                | Owner                | Owns                                                                                                                                                                                                             |
| ------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_design/acl`             | **couch-auth-proxy** | Protocol map (`views.acl`) + creator/owners/acl/parent mutation validate_doc_update. With `ACL_REQUIRE_CREATOR=true`, also rejects creates that omit `creator`. Installed/migrated when `ACL_AUTO_INSTALL=true`. |
| `_design/acl` → `dbacl`   | **FAIMS**            | Project-scoped ALL-role overlays from `necessaryActionToCouchRoleList`. Patched onto the proxy ddoc after **warm** — never vendors map/validate_doc_update.                                                      |
| `_design/faims_acl_shape` | **FAIMS**            | If `record_id` is set, ACL `parent` must equal `record_id`.                                                                                                                                                      |
| `_design/permissions`     | **FAIMS**            | my/all write/delete on `created_by` + project roles.                                                                                                                                                             |

**Do not** put `record_id` ↔ `parent` (or other FAIMS field names) into the
proxy validate_doc_update. The proxy’s generic `parent` means “inherit grants from this doc id”.

**Do not** copy proxy map/validate_doc_update source into `@faims3/data-model`. Pin the proxy
**image** in compose/CDK; the image is the source of truth for protocol ddocs.

```text
Write to data-* doc
  ├─ _design/acl              (proxy)   ACL field protocol ± require-creator
  ├─ _design/faims_acl_shape  (FAIMS)   record_id ⇒ parent == record_id
  └─ _design/permissions      (FAIMS)   my/all edit/delete on created_by
```

### Field names (no collisions)

| Field                 | Meaning                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `created_by`          | FAIMS audit / permissions validate_doc_update “mine”                    |
| `creator`             | Proxy ACL owner (r/w/d). Set with `created_by` on clean `rec-*` creates |
| `parent` (string)     | Proxy inherit-from doc id — always the `rec-*` id for children          |
| `parents`             | Revision DAG ids (unrelated)                                            |
| `relationship.parent` | Form linked-record relation (unrelated)                                 |

Unstamped docs (no `creator` / `owners` / `acl`) are readable to authenticated
DB members (`r-*`) until DATA migrate stamps them — same effective access as
pre-proxy public Couch. FAIMS compose/CDK set `ACL_REQUIRE_CREATOR=true` so new
non-admin creates cannot omit `creator` (upstream **1.5.0+**).

## What “warm” means

**Warm** (verb) = ping a data DB through the proxy so couch-auth-proxy has a
chance to install (or migrate) `_design/acl`.

Concretely: Conductor issues an admin `GET {COUCHDB_PUBLIC_URL}/data-{projectId}`.
That hits couch-auth-proxy’s `ensureDb` → `ensureAclDdoc` path. With
`ACL_AUTO_INSTALL=true`, the proxy PUTs `_design/acl` if it is missing (and may
migrate the map / `validate_doc_update` stamp while preserving FAIMS `dbacl`).

Why this exists: Conductor’s normal admin traffic uses `COUCHDB_INTERNAL_URL`
and **bypasses** the proxy, so it never triggers auto-install. Idle `data-*`
DBs created after proxy boot also need a proxy touch (Conductor warm, first
client sync via the public URL, or boot preload —
`COUCH_PRELOAD_DB_INCLUDE` / `COUCH_PRELOAD_DBS`). Implementation:
`warmCouchAuthProxyAclDesignDoc` in `api/src/couchdb/couchAuthProxyAcl.ts`.
Warm is skipped when `COUCH_AUTH_PROXY_ENABLED=false` (proxy not deployed) —
FAIMS still stamps `creator`/`parent`, runs DATA migrations, and may patch
`dbacl` if `_design/acl` already exists. Details and timing table:
[CouchAuthProxyAclInstallBrief](CouchAuthProxyAclInstallBrief.md).

In these docs, phrases like “after warm”, “warm the proxy”, or “boot-warm”
all mean that proxy ping / preload — not a FAIMS-side install of the ACL map.

## Who writes what, when

| Actor                                                               | Action                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| couch-auth-proxy                                                    | On first ACL-scoped access to a matching DB (`ensureDb`), auto-PUTs `_design/acl` if missing; may migrate generated map/validate_doc_update (including require-creator flag flips) while preserving `dbacl` / `restrict`. Optional boot preload via `COUCH_PRELOAD_DBS` and/or `COUCH_PRELOAD_DB_INCLUDE` (regex; **1.6.0+**). See [CouchAuthProxyAclInstallBrief](CouchAuthProxyAclInstallBrief.md). |
| Conductor (`initialiseDataDb`; ops `repair-data-db-acl -- --write`) | **Warms** the proxy (admin `GET` via `COUCHDB_PUBLIC_URL` so `_design/acl` is installed), then patches `dbacl` + ensures `_design/faims_acl_shape`. Prefer `repair-data-db-acl -- --check` first — init already does this on migrate/startup; `--write` only when check reports drift.                                                                                                                |
| `initDataDB`                                                        | Installs FAIMS design docs only (`permissions`, indexes, `faims_acl_shape`) — **not** `_design/acl`.                                                                                                                                                                                                                                                                                                  |
| Clean write path (engine / attachments)                             | Always stamps `creator` / `parent` via `stampRecordAcl` / `stampChildAcl`.                                                                                                                                                                                                                                                                                                                            |
| DATA migrations (target **v2**)                                     | Stamp `creator`/`parent` on legacy docs; patch `dbacl` when the proxy ddoc already exists; ensure `faims_acl_shape`.                                                                                                                                                                                                                                                                                  |

If the proxy ddoc is still missing after warm, FAIMS returns
`missing_proxy_ddoc` and does **not** invent a vendored map.

## Doc map

| Doc                                                               | Role                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **This page**                                                     | Ownership + validate_doc_update layering (start here)                      |
| [PermissionModel](../PermissionModel.md)                          | RBAC + short sync-enforcement summary                                      |
| [CouchAuthProxyAclInstallBrief](CouchAuthProxyAclInstallBrief.md) | Lazy `_design/acl` install timing                                          |
| [CouchAuthProxyCutover](CouchAuthProxyCutover.md)                 | Deploy-then-migrate + ACL check runbook                                    |
| [aws-cdk README](../../../../../infrastructure/aws-cdk/README.md) | AWS topology / `couchAuthProxy.enabled`                                    |
| DATA v1→v2 migrator                                               | `dataV1toV2Migration` in `library/data-model/.../migrations/migrations.ts` |
