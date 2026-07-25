# ACL validation layering

Map of how FAIMS permissions and
[couch-auth-proxy](https://github.com/PeterBaker0/couch-auth-proxy) share
responsibility for project **data** DBs (`data-{projectId}`). Prefer this over
chat history when deciding where a rule belongs.

Related: [PermissionModel](../PermissionModel.md) (RBAC),
[CouchAuthProxyHandover](CouchAuthProxyHandover.md) (integration brief),
[CouchAuthProxyCutover](CouchAuthProxyCutover.md) (ops),
[CouchAuthProxyAclInstallBrief](CouchAuthProxyAclInstallBrief.md) (when the
proxy writes `_design/acl`).

## Share of responsibility

| Concern                                                   | Owner                               | Mechanism                                                                                                           |
| --------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Policy vocabulary (roles/actions)                         | **FAIMS** `@faims3/data-model`      | `Action` / `Role` / `necessaryActionToCouchRoleList`                                                                |
| “May talk to this DB?”                                    | **FAIMS** + Couch                   | `_security.members` = roles with `READ_MY_PROJECT_RECORDS`                                                          |
| “Which docs may this member read/write/delete over sync?” | **couch-auth-proxy**                | Filters `_changes`, `_bulk_get`, docs, attachments using doc `creator` / `owners` / `acl` / `parent` + ddoc `dbacl` |
| Project-wide ALL grants on sync                           | **FAIMS** (lists) on **proxy** ddoc | `dbacl.{_r,_w,_d}` from `*_ALL_PROJECT_RECORDS` — patched after warm                                                |
| Protocol integrity of ACL fields                          | **couch-auth-proxy**                | `_design/acl` VDU (forge/immutable `creator`, `owners`, `acl`, `parent`; optional require-creator)                  |
| FAIMS stamp shape (`record_id` ↔ `parent`)                | **FAIMS**                           | `_design/faims_acl_shape` VDU                                                                                       |
| Write my/all on `created_by`                              | **FAIMS**                           | `_design/permissions` VDU                                                                                           |
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

| Design doc                | Owner                | Owns                                                                                                                                                                                             |
| ------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_design/acl`             | **couch-auth-proxy** | Protocol map (`views.acl`) + creator/owners/acl/parent mutation VDU. With `ACL_REQUIRE_CREATOR=true`, also rejects creates that omit `creator`. Installed/migrated when `ACL_AUTO_INSTALL=true`. |
| `_design/acl` → `dbacl`   | **FAIMS**            | Project-scoped ALL-role overlays from `necessaryActionToCouchRoleList`. Patched onto the proxy ddoc after warm — never vendors map/VDU.                                                          |
| `_design/faims_acl_shape` | **FAIMS**            | If `record_id` is set, ACL `parent` must equal `record_id`.                                                                                                                                      |
| `_design/permissions`     | **FAIMS**            | my/all write/delete on `created_by` + project roles.                                                                                                                                             |

**Do not** put `record_id` ↔ `parent` (or other FAIMS field names) into the
proxy VDU. The proxy’s generic `parent` means “inherit grants from this doc id”.

**Do not** copy proxy map/VDU source into `@faims3/data-model`. Pin the proxy
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
| `created_by`          | FAIMS audit / permissions VDU “mine”                                    |
| `creator`             | Proxy ACL owner (r/w/d). Set with `created_by` on clean `rec-*` creates |
| `parent` (string)     | Proxy inherit-from doc id — always the `rec-*` id for children          |
| `parents`             | Revision DAG ids (unrelated)                                            |
| `relationship.parent` | Form linked-record relation (unrelated)                                 |

Unstamped docs (no `creator` / `owners` / `acl`) are readable to authenticated
DB members (`r-*`) until DATA migrate stamps them — same effective access as
pre-proxy public Couch. FAIMS compose/CDK set `ACL_REQUIRE_CREATOR=true` so new
non-admin creates cannot omit `creator` (upstream **1.5.0+**).

## Who writes what, when

| Actor                                                 | Action                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| couch-auth-proxy                                      | On first ACL-scoped access to a matching DB (`ensureDb`), auto-PUTs `_design/acl` if missing; may migrate generated map/VDU (including require-creator flag flips) while preserving `dbacl` / `restrict`. Optional boot preload via `COUCH_PRELOAD_DBS` and/or `COUCH_PRELOAD_DB_INCLUDE` (regex; **1.6.0+**). See [CouchAuthProxyAclInstallBrief](CouchAuthProxyAclInstallBrief.md). |
| Conductor (`initialiseDataDb` / `repair-data-db-acl`) | Warms the proxy (`GET` via `COUCHDB_PUBLIC_URL`), then patches `dbacl` + ensures `_design/faims_acl_shape`.                                                                                                                                                                                                                     |
| `initDataDB`                                          | Installs FAIMS design docs only (`permissions`, indexes, `faims_acl_shape`) — **not** `_design/acl`.                                                                                                                                                                                                                            |
| Clean write path (engine / attachments)               | Always stamps `creator` / `parent` via `stampRecordAcl` / `stampChildAcl`.                                                                                                                                                                                                                                                      |
| DATA migrations (target **v3**)                       | Stamp `creator`/`parent` on legacy docs (v1→v2); patch `dbacl` when the proxy ddoc already exists; always ensure `faims_acl_shape` (v2→v3 for DBs that missed it).                                                                                                                                                              |

If the proxy ddoc is still missing after warm, FAIMS returns
`missing_proxy_ddoc` and does **not** invent a vendored map.

## Doc map

| Doc                                                                             | Role                                    |
| ------------------------------------------------------------------------------- | --------------------------------------- |
| **This page**                                                                   | Ownership + VDU layering (start here)   |
| [PermissionModel](../PermissionModel.md)                                        | RBAC + short sync-enforcement summary   |
| [CouchAuthProxyAclInstallBrief](CouchAuthProxyAclInstallBrief.md)               | Lazy `_design/acl` install timing       |
| [CouchAuthProxyRequireCreatorHandover](CouchAuthProxyRequireCreatorHandover.md) | Upstream `ACL_REQUIRE_CREATOR` (landed) |
| [CouchAuthProxyHandover](CouchAuthProxyHandover.md)                             | Full integration brief / history        |
| [CouchAuthProxyCutover](CouchAuthProxyCutover.md)                               | Deploy-then-migrate runbook             |
| [CouchAuthProxyAwsCdk](CouchAuthProxyAwsCdk.md)                                 | AWS topology                            |
| [CouchMigrations](../CouchMigrations.md)                                        | DATA v1→v3 notes                        |
