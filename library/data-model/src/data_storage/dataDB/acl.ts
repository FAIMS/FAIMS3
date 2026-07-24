/**
 * Couch-auth-proxy ACL helpers for project data DBs.
 *
 * Clean write path always stamps `creator` / `parent`. Bucket overlays (`dbacl`)
 * are derived from {@link necessaryActionToCouchRoleList} so sync enforcement
 * tracks the FAIMS permission model.
 *
 * Vendored map + VDU source must stay aligned with the deployed
 * `ghcr.io/peterbaker0/couch-auth-proxy` image. Upstream pin:
 * couch-auth-proxy `src/acl/ddoc.ts` version **2.3.0** (package release v1.2.1).
 */

import {Action, necessaryActionToCouchRoleList} from '../../permission';

/** Upstream `_design/acl` `version` field from couch-auth-proxy ddoc.ts. */
export const COUCH_AUTH_PROXY_ACL_DDOC_VERSION = '2.3.0';

/**
 * Synthetic ACL creator stamped by DATA v1→v2 when a legacy doc has no
 * `created_by`. Ensures the document is not left open (`r-*`) after cutover;
 * ALL-capable roles still reach it via `dbacl`.
 */
export const ACL_ORPHAN_CREATOR = '__faims_acl_orphan__';

/**
 * Couch map function source from couch-auth-proxy 2.3.0.
 * Emits `{ s, p, _r, _w, _d }` per document keyed by doc id.
 */
export const ACL_MAP_SOURCE = `function (doc) {
  var r = { s: doc._rev || "", p: "", _r: {}, _w: {}, _d: {} };
  var tmp = "", i, ctr = 0;
  var cr = doc.creator, acl = doc.acl, ow = doc.owners;
  var S = "string", O = "object", F = "function";
  var rr = /^r-/, ru = /^u-/;

  if (typeof cr == S && cr) {
    tmp = cr;
    if (!ru.test(tmp)) tmp = "u-" + tmp;
    r._r[tmp] = r._w[tmp] = r._d[tmp] = 1;
    ctr += 1;
  }

  if (acl != null && typeof acl == O && typeof acl.slice == F) {
    for (i = 0; i < acl.length; i++) {
      tmp = acl[i];
      if (typeof tmp == S) {
        if (rr.test(tmp) || ru.test(tmp)) r._r[tmp] = 1;
        else r._r["u-" + tmp] = 1;
      }
    }
    ctr += 1;
  }

  if (ow != null && typeof ow == O && typeof ow.slice == F) {
    for (i = 0; i < ow.length; i++) {
      tmp = ow[i];
      if (typeof tmp == S) {
        if (!rr.test(tmp) && !ru.test(tmp)) tmp = "u-" + tmp;
        r._r[tmp] = r._w[tmp] = 1;
      }
    }
    ctr += 1;
  }

  if (!ctr) {
    tmp = "r-*";
    if (/^_design/.test(doc._id)) r._r[tmp] = 1;
    else r._r[tmp] = r._w[tmp] = r._d[tmp] = 1;
  }

  if (typeof doc.parent == S) r.p = doc.parent;
  emit(doc._id, r);
}`;

/**
 * Couch `validate_doc_update` from couch-auth-proxy 2.3.0.
 * Non-admins cannot forge creator or illegally mutate owners/acl/parent.
 */
export const ACL_VALIDATE_DOC_UPDATE_SOURCE = `function (nd, od, userCtx, secObj) {
  var roles = userCtx.roles || [];
  var adm = !!(roles.indexOf("_admin") >= 0);
  var u = userCtx.name;
  var uu = "u-" + u;
  var O = "object";
  var F = "function";
  var S = "string";
  var rr = /^r-/;
  var isA = function (o) {
    return typeof o == O && typeof o.slice == F;
  };

  if (!adm) {
    if (!od) {
      if (nd.creator && nd.creator != u && nd.creator != uu)
        throw { forbidden: "Can't create doc on behalf of other user." };
    } else {
      var odc = od.creator;
      var odw = (isA(od.owners) ? od.owners : []).sort();
      var oda = isA(od.acl) ? od.acl.sort() + "" : "";
      var ndc = nd.creator;
      var ndw = (isA(nd.owners) ? nd.owners : []).sort();
      var nda = isA(nd.acl) ? nd.acl.sort() + "" : "";
      var notCreator = odc != u && odc != uu;
      var notOwner = notCreator && odw.indexOf(u) == -1 && odw.indexOf(uu) == -1;
      var i, roleToken;
      for (i = 0; notOwner && i < roles.length; i++) {
        if (typeof roles[i] == S) {
          roleToken = rr.test(roles[i]) ? roles[i] : "r-" + roles[i];
          if (odw.indexOf(roleToken) >= 0) notOwner = false;
        }
      }
      var odp = typeof od.parent == S ? od.parent : "";
      var ndp = typeof nd.parent == S ? nd.parent : "";

      if (!nd._deleted) {
        if (odc != ndc) throw { forbidden: "Creator can not be changed." };
        if (notCreator && odw + "" != ndw + "")
          throw { forbidden: "Owners list can not be changed." };
        if (notOwner && oda != nda)
          throw { forbidden: "Readers list can not be changed." };
        if (notCreator && odp != ndp)
          throw { forbidden: "Parent can not be changed." };
      }
    }
  }
}`;

/** Prefix for project data Couch databases (`data-{projectId}`). */
export const DATA_DB_NAME_PREFIX = 'data-';

export type DbAclOverlay = {
  _r: string[];
  _w: string[];
  _d: string[];
};

export type RecordAclStamp = {creator: string};
export type ChildAclStamp = {creator: string; parent: string};

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
 * Derive `dbacl` role-token lists for a project data DB from the FAIMS
 * permission model (READ/EDIT/DELETE ALL). Guest (my-only) tokens are absent.
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
 * Build a fresh `_design/acl` document for a project data DB (no `_rev`).
 * Leaves `acl: []` so non-admins cannot read the control-plane body.
 */
export function buildDataDbAclDesignDoc(projectId: string): {
  _id: '_design/acl';
  language: 'javascript';
  options: {
    local_seq: true;
    include_design: true;
    partitioned: false;
  };
  type: 'ddoc';
  version: string;
  stamp: number;
  acl: string[];
  dbacl: DbAclOverlay;
  views: {acl: {map: string}};
  validate_doc_update: string;
} {
  return {
    _id: '_design/acl',
    language: 'javascript',
    options: {
      local_seq: true,
      include_design: true,
      partitioned: false,
    },
    type: 'ddoc',
    version: COUCH_AUTH_PROXY_ACL_DDOC_VERSION,
    stamp: Date.now(),
    acl: [],
    dbacl: buildDbAclOverlay(projectId),
    views: {
      acl: {
        map: ACL_MAP_SOURCE,
      },
    },
    validate_doc_update: ACL_VALIDATE_DOC_UPDATE_SOURCE,
  };
}

/**
 * Extract project id from a data DB name (`data-{projectId}`).
 * Returns undefined when the name does not match.
 */
export function projectIdFromDataDbName(dbName: string): string | undefined {
  if (!dbName.startsWith(DATA_DB_NAME_PREFIX)) {
    return undefined;
  }
  const projectId = dbName.slice(DATA_DB_NAME_PREFIX.length);
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
 * Ensure `_design/acl` exists (or is repaired) on a database with the correct
 * `dbacl` for `projectId`. Idempotent: skips rewrite when version + `dbacl`
 * already match (avoids stamp churn).
 */
export async function ensureDataDbAclDesignDoc({
  db,
  projectId,
}: {
  db: {
    get: (id: string) => Promise<Record<string, unknown>>;
    put: (doc: Record<string, unknown>) => Promise<unknown>;
  };
  projectId: string;
}): Promise<void> {
  const fresh = buildDataDbAclDesignDoc(projectId);
  try {
    const existing = await db.get('_design/acl');
    if (
      existing.version === fresh.version &&
      dbAclListsEqual(existing.dbacl, fresh.dbacl) &&
      existing.validate_doc_update === fresh.validate_doc_update &&
      (existing.views as {acl?: {map?: string}} | undefined)?.acl?.map ===
        fresh.views.acl.map
    ) {
      return;
    }
    await db.put({
      ...fresh,
      _rev: existing._rev,
    });
  } catch (err: unknown) {
    const status =
      err && typeof err === 'object' && 'status' in err
        ? (err as {status?: number}).status
        : undefined;
    const name =
      err && typeof err === 'object' && 'name' in err
        ? (err as {name?: string}).name
        : undefined;
    if (status === 404 || name === 'not_found') {
      await db.put(fresh);
      return;
    }
    throw err;
  }
}
