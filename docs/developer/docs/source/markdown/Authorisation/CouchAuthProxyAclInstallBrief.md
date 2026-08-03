# Brief: when couch-auth-proxy writes `_design/acl`

Companion to [AclValidationLayering](AclValidationLayering.md) (ownership /
who patches `dbacl` afterward). That page defines **warm** in the ACL sense;
this brief is the install timing detail.

## Short answer

The proxy does **not** install ACL design docs for every database at process
startup by default. It writes (or upgrades) `_design/acl` **lazily**, the first
time it loads ACL state for a given application database — plus optionally for
DBs selected at boot via preload env vars.

FAIMS sets `ACL_AUTO_INSTALL=true`, `ACL_REQUIRE_CREATOR=true`,
`ACL_DB_INCLUDE=/^data-/`, and `COUCH_PRELOAD_DB_INCLUDE=/^data-/` (image
**1.6.0+**).

## What “warm” means here

**Warm** = ping the data DB through couch-auth-proxy so the library’s lazy
install path runs and `_design/acl` exists before FAIMS patches `dbacl`.

Conductor does this with an admin `GET {COUCHDB_PUBLIC_URL}/data-{projectId}`
(`warmCouchAuthProxyAclDesignDoc`). That is not a FAIMS PUT of the ACL map —
it is a deliberate request that forces the proxy’s `ensureDb` →
`ensureAclDdoc` path. Admin traffic on `COUCHDB_INTERNAL_URL` bypasses the
proxy and never installs the ddoc.

## Trigger path

```text
HTTP request to proxy for /{db}/…  (or boot preload of {db})
  → AclCache.ensureDb(db)
    → loadDb → ensureAclDdoc(db)
         ├─ GET /{db}/_design/acl
         ├─ 200 → maybeMigrateStamp (upgrade generated map/validate_doc_update; keep dbacl)
         └─ 404 + ACL_AUTO_INSTALL + not a system DB
              → PUT buildAclDesignDoc()   // map + protocol validate_doc_update; no FAIMS dbacl
```

Boot preload (**1.6.0+**):

```text
proxy start
  → names = COUCH_PRELOAD_DBS ∪ match(COUCH_PRELOAD_DB_INCLUDE against /_all_dbs)
  → filter: drop system DBs; apply ACL_DB_INCLUDE / ACL_DB_EXCLUDE
  → for each name: ensureDb (same path as above)
```

`/_all_dbs` metadata inspection outside that preload path uses
`inspectAccessPolicy`, which **never** installs a ddoc.

## Timing details

| Event                                                              | Writes `_design/acl`?                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Proxy process start (no preload env)                               | No                                                                  |
| `COUCH_PRELOAD_DBS=db1,db2` at boot                                | Yes for those names (ensure + follower)                             |
| `COUCH_PRELOAD_DB_INCLUDE=/^data-/` at boot                        | Yes for matching `/_all_dbs` names (union with `COUCH_PRELOAD_DBS`) |
| First app/Conductor request that hits that DB through the proxy    | Yes if missing                                                      |
| Later requests                                                     | No (cache hit); migrate only if stamp/version rules say so          |
| Conductor admin traffic on `COUCHDB_INTERNAL_URL` (bypasses proxy) | **Never** — proxy never sees it                                     |
| System DBs (`_users`, `_replicator`, `_global_changes`)            | Never auto-mutated                                                  |

Idle `data-*` DBs created **after** proxy boot still need a proxy touch
(Conductor **warm** / first sync through the public URL) or a proxy restart
with preload to pick them up.

## What FAIMS does after that

1. **Warm** (optional if preload already ran): `GET {COUCHDB_PUBLIC_URL}/data-{projectId}` as Couch admin — ping so the proxy installs `_design/acl`.
2. Patch: write project `dbacl` onto the existing `_design/acl` only
   (`ensureDataDbAclOverlay`) — does not replace map/validate_doc_update/`version`.
3. Ensure: `_design/faims_acl_shape` + existing `_design/permissions`.

If the proxy ddoc is still missing after warm, FAIMS reports
`missing_proxy_ddoc` and does **not** invent a vendored map.
