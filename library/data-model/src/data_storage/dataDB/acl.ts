/**
 * FAIMS ↔ couch-auth-proxy ACL helpers for project data DBs (`data-{projectId}`).
 *
 * ## Ownership (do not blur)
 *
 * | Piece | Owner | Role |
 * | ----- | ----- | ---- |
 * | `_design/acl` map + protocol `validate_doc_update` | **couch-auth-proxy** | Sync filter + ACL-field protocol (`creator`/`owners`/`acl`/`parent`; optional require-creator). Auto-install/migrate when `ACL_AUTO_INSTALL=true`. |
 * | `_design/acl` → `dbacl` | **FAIMS** (this module) | Project-wide ALL-role grants (`_r`/`_w`/`_d`). Patched after warm; never vendors the map/VDU. |
 * | Doc stamps `creator` / `parent` | **FAIMS** | Per-doc ownership / inheritance for the proxy filter. |
 * | `_design/faims_acl_shape` | **FAIMS** | `record_id` ⇒ `parent === record_id`. |
 * | `_design/permissions` | **FAIMS** | my/all write/delete on `created_by` (not this file). |
 *
 * Pin the proxy **image** in compose/CDK — it is the source of truth for the
 * protocol ddoc. Do not copy map / validate_doc_update source here.
 *
 * Callers that need `_design/acl` must **warm** the proxy first (admin GET via
 * `COUCHDB_PUBLIC_URL`) — internal Couch traffic bypasses the proxy and never
 * triggers install. See `warmCouchAuthProxyAclDesignDoc` in the API.
 *
 * ## `dbacl.{_r,_w,_d}` — what each list does
 *
 * Defined by couch-auth-proxy on `_design/acl.dbacl`; FAIMS fills the values.
 * Each list is grant tokens (`r-{role}` / `u-{user}`) that may act on **any**
 * doc in the DB during sync (not just docs they created):
 *
 * | Key | Sync capability | Built from FAIMS `Action` |
 * | --- | --------------- | ------------------------- |
 * | `_r` | read all docs / attachments / changes | `READ_ALL_PROJECT_RECORDS` |
 * | `_w` | write/update any doc | `EDIT_ALL_PROJECT_RECORDS` |
 * | `_d` | delete any doc | `DELETE_ALL_PROJECT_RECORDS` |
 *
 * Built via `necessaryActionToCouchRoleList` → `toProxyRoleGrant` (proxy treats
 * bare strings as `u-…`, so roles must be `r-…`). Guest/my-only access is
 * **not** in `dbacl` — those users sync via doc `creator` / `parent` only.
 *
 * ## Docs
 *
 * - Ownership + VDU layering: `docs/.../Authorisation/AclValidationLayering.md`
 * - RBAC actions/roles: `docs/.../PermissionModel.md`
 * - Ops / warm / cutover: `docs/.../Authorisation/CouchAuthProxyCutover.md`
 * - Install timing: `docs/.../Authorisation/CouchAuthProxyAclInstallBrief.md`
 */

import {Action, necessaryActionToCouchRoleList} from '../../permission';
import {isConflictError, isNotFoundError} from '../utils';
import {ensureFaimsAclShapeDesignDoc} from './faimsAclShape';

/**
 * Synthetic ACL creator stamped by DATA v1→v2 when a legacy doc has no
 * `created_by`. Ensures the document is not left open (`r-*`) after cutover;
 * ALL-capable roles still reach it via `dbacl`.
 */
export const ACL_ORPHAN_CREATOR = '__faims_acl_orphan__';

/** Prefix for project data Couch databases (`data-{projectId}`). */
export const DATA_DB_NAME_PREFIX = 'data-';

/**
 * Project-scoped overlay written to `_design/acl.dbacl`.
 * Grant tokens only — the proxy interprets them during sync.
 * @see module header for `_r` / `_w` / `_d` semantics
 */
export type DbAclOverlay = {
  /** Roles/users that may read any doc (from `READ_ALL_PROJECT_RECORDS`). */
  _r: string[];
  /** Roles/users that may write any doc (from `EDIT_ALL_PROJECT_RECORDS`). */
  _w: string[];
  /** Roles/users that may delete any doc (from `DELETE_ALL_PROJECT_RECORDS`). */
  _d: string[];
};

/** Proxy ACL owner on a `rec-*` doc (`creator` ≠ FAIMS `created_by`). */
export type RecordAclStamp = {creator: string};
/**
 * Child-graph stamp: `parent` is the `rec-*` id the proxy inherits grants from
 * (not FAIMS `relationship.parent` / revision `parents[]`).
 */
export type ChildAclStamp = {creator: string; parent: string};

export type EnsureDataDbAclOverlayResult =
  | {status: 'unchanged'}
  | {status: 'updated'}
  | {
      /** Proxy has not installed `_design/acl` yet — FAIMS will not invent it. */
      status: 'missing_proxy_ddoc';
    };

/**
 * couch-auth-proxy normalizes bare grant strings to `u-…` unless they already
 * carry a `u-` / `r-` prefix. Role grants therefore must use `r-`.
 */
export function toProxyRoleGrant(role: string): string {
  if (role.startsWith('r-') || role.startsWith('u-')) {
    return role;
  }
  return `r-${role}`;
}

/**
 * Derive `dbacl.{_r,_w,_d}` from FAIMS RBAC for one project.
 * Only `*_ALL_PROJECT_RECORDS` roles; guests (my-only) are omitted on purpose.
 * @see {@link DbAclOverlay} and module header
 */
export function buildDbAclOverlay(projectId: string): DbAclOverlay {
  return {
    _r: necessaryActionToCouchRoleList({
      action: Action.READ_ALL_PROJECT_RECORDS,
      resourceId: projectId,
    }).map(toProxyRoleGrant),
    _w: necessaryActionToCouchRoleList({
      action: Action.EDIT_ALL_PROJECT_RECORDS,
      resourceId: projectId,
    }).map(toProxyRoleGrant),
    _d: necessaryActionToCouchRoleList({
      action: Action.DELETE_ALL_PROJECT_RECORDS,
      resourceId: projectId,
    }).map(toProxyRoleGrant),
  };
}

/** ACL stamp for a `rec-*` document (record owner lifecycle). */
export function stampRecordAcl(createdBy: string): RecordAclStamp {
  return {creator: createdBy};
}

/**
 * ACL stamp for child docs in the record graph (`frev-*`, `avp-*`, attachments).
 * `parent` is the record document id (proxy inheritance), not FAIMS
 * `relationship.parent` / revision `parents[]`.
 */
export function stampChildAcl(args: {
  createdBy: string;
  recordId: string;
}): ChildAclStamp {
  return {creator: args.createdBy, parent: args.recordId};
}

/**
 * Normalise a Pouch/Couch database name to the bare Couch id.
 *
 * Remote Pouch handles expose `db.name` as a full URL
 * (`http://host:5984/data-{id}`); migrations and ACL helpers need the logical
 * name (`data-{id}`).
 */
export function logicalCouchDbName(dbName: string): string {
  const trimmed = dbName.replace(/\/+$/, '');
  const slash = trimmed.lastIndexOf('/');
  const bare =
    slash >= 0 ? decodeURIComponent(trimmed.slice(slash + 1)) : trimmed;
  const query = bare.indexOf('?');
  return query >= 0 ? bare.slice(0, query) : bare;
}

/**
 * Extract project id from a data DB name (`data-{projectId}`).
 * Accepts bare names or remote Pouch URLs ending in `/data-{projectId}`.
 * Returns undefined when the name does not match.
 */
export function projectIdFromDataDbName(dbName: string): string | undefined {
  const name = logicalCouchDbName(dbName);
  if (!name.startsWith(DATA_DB_NAME_PREFIX)) {
    return undefined;
  }
  const projectId = name.slice(DATA_DB_NAME_PREFIX.length);
  return projectId.length > 0 ? projectId : undefined;
}

function dbAclListsEqual(a: unknown, b: DbAclOverlay): boolean {
  if (!a || typeof a !== 'object') return false;
  const overlay = a as Partial<DbAclOverlay>;
  const same = (left: unknown, right: string[]) =>
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((v, i) => v === right[i]);
  return (
    same(overlay._r, b._r) && same(overlay._w, b._w) && same(overlay._d, b._d)
  );
}

/**
 * Apply DATA ACL stamp fields to a document (pure).
 *
 * Used by DATA v1→v2 (`dataV1toV2Migration`) and backup restore so unstamped
 * corpus cannot re-enter after couch-auth-proxy cutover:
 * - record docs (`rec-*` / `record_format_version`): set `creator` from
 *   `created_by`, else {@link ACL_ORPHAN_CREATOR}
 * - child graph docs with `record_id`: set `creator` the same way and
 *   `parent = record_id` (proxy inheritance; not FAIMS relationship.parent)
 * - `_design/*` and already-correct docs: no-op (`null`)
 *
 * Returns a shallow-cloned updated doc, or `null` when already correct.
 */
export function stampDataDocumentAclFields(
  doc: Record<string, unknown>
): Record<string, unknown> | null {
  if (typeof doc._id === 'string' && doc._id.startsWith('_design/')) {
    return null;
  }

  let needsUpdate = false;
  const updated: Record<string, unknown> = {...doc};

  const isRecord =
    typeof doc._id === 'string' &&
    (doc._id.startsWith('rec-') || doc.record_format_version !== undefined);

  const resolveCreator = (): string => {
    if (typeof doc.created_by === 'string' && doc.created_by.length > 0) {
      return doc.created_by;
    }
    return ACL_ORPHAN_CREATOR;
  };

  if (isRecord) {
    if (typeof doc.creator !== 'string' || doc.creator.length === 0) {
      updated.creator = resolveCreator();
      needsUpdate = true;
    }
  } else if (typeof doc.record_id === 'string' && doc.record_id.length > 0) {
    if (typeof doc.creator !== 'string' || doc.creator.length === 0) {
      updated.creator = resolveCreator();
      needsUpdate = true;
    }
    if (typeof doc.parent !== 'string' || doc.parent !== doc.record_id) {
      updated.parent = doc.record_id;
      needsUpdate = true;
    }
  }

  return needsUpdate ? updated : null;
}

/**
 * Patch project-scoped `dbacl` onto an existing proxy-managed `_design/acl`,
 * then ensure FAIMS `_design/faims_acl_shape`.
 *
 * Never installs or rewrites the proxy map / protocol validate_doc_update /
 * `version`. If the ddoc is absent, returns `missing_proxy_ddoc` after still
 * ensuring the FAIMS shape doc — callers that need the proxy ddoc must **warm**
 * couch-auth-proxy first: ping the DB via the public (proxy) URL so
 * `ACL_AUTO_INSTALL` can create `_design/acl`. Admin traffic on the internal
 * Couch URL bypasses the proxy and never triggers that install.
 */
export async function ensureDataDbAclOverlay({
  db,
  projectId,
}: {
  db: {
    get: (id: string) => Promise<Record<string, unknown>>;
    put: (doc: Record<string, unknown>) => Promise<unknown>;
  };
  projectId: string;
}): Promise<EnsureDataDbAclOverlayResult> {
  const expected = buildDbAclOverlay(projectId);
  const maxAttempts = 3;
  let result: EnsureDataDbAclOverlayResult = {status: 'missing_proxy_ddoc'};

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const existing = await db.get('_design/acl');
      if (dbAclListsEqual(existing.dbacl, expected)) {
        result = {status: 'unchanged'};
        break;
      }
      await db.put({
        ...existing,
        dbacl: expected,
      });
      result = {status: 'updated'};
      break;
    } catch (err: unknown) {
      if (isNotFoundError(err)) {
        result = {status: 'missing_proxy_ddoc'};
        break;
      }
      if (isConflictError(err) && attempt < maxAttempts - 1) {
        continue;
      }
      throw err;
    }
  }

  await ensureFaimsAclShapeDesignDoc({db});
  return result;
}
