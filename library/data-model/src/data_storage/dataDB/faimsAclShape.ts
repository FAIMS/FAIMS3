/**
 * FAIMS-specific ACL stamp invariants enforced via a dedicated design-doc validate_doc_update.
 *
 * Couch runs `validate_doc_update` from **every** design doc; this one is
 * intentionally separate from `_design/acl` (couch-auth-proxy) so FAIMS field
 * semantics stay out of the standalone proxy product.
 *
 * Owns: when `record_id` is set, ACL `parent` must equal `record_id`.
 *
 * Require-creator is owned by couch-auth-proxy via `ACL_REQUIRE_CREATOR`
 * (baked into `_design/acl` validate_doc_update). See Authorisation/AclValidationLayering.md.
 */

/** Design doc id installed on every project data DB. */
export const FAIMS_ACL_SHAPE_DDOC_ID = '_design/faims_acl_shape';

/**
 * Bump when the validate_doc_update body changes so ensure/repair rewrites existing ddocs.
 * 1.2.0 drops the temporary require-creator check (now proxy env).
 */
export const FAIMS_ACL_SHAPE_DDOC_VERSION = '1.2.0';

/**
 * Rejects non-admin writes where a child-shaped doc (`record_id` set) does not
 * point ACL `parent` at that record. Design docs and `_admin` are exempt.
 */
export const FAIMS_ACL_SHAPE_VALIDATE_DOC_UPDATE_SOURCE = `function (nd, od, userCtx, secObj) {
  var roles = userCtx.roles || [];
  if (roles.indexOf("_admin") >= 0) return;
  if (/^_design/.test(nd._id || "")) return;
  var S = "string";
  if (typeof nd.record_id == S && nd.record_id) {
    if (typeof nd.parent != S || nd.parent != nd.record_id)
      throw { forbidden: "Child document parent must equal record_id." };
  }
}`;

export function buildFaimsAclShapeDesignDoc(): {
  _id: typeof FAIMS_ACL_SHAPE_DDOC_ID;
  language: 'javascript';
  version: string;
  validate_doc_update: string;
} {
  return {
    _id: FAIMS_ACL_SHAPE_DDOC_ID,
    language: 'javascript',
    version: FAIMS_ACL_SHAPE_DDOC_VERSION,
    validate_doc_update: FAIMS_ACL_SHAPE_VALIDATE_DOC_UPDATE_SOURCE,
  };
}

function isNotFoundError(err: unknown): boolean {
  const status =
    err && typeof err === 'object' && 'status' in err
      ? (err as {status?: number}).status
      : undefined;
  const name =
    err && typeof err === 'object' && 'name' in err
      ? (err as {name?: string}).name
      : undefined;
  return status === 404 || name === 'not_found';
}

function isConflictError(err: unknown): boolean {
  const status =
    err && typeof err === 'object' && 'status' in err
      ? (err as {status?: number}).status
      : undefined;
  const name =
    err && typeof err === 'object' && 'name' in err
      ? (err as {name?: string}).name
      : undefined;
  return status === 409 || name === 'conflict';
}

/**
 * Ensure `_design/faims_acl_shape` exists with the current validate_doc_update. Idempotent.
 */
export async function ensureFaimsAclShapeDesignDoc({
  db,
}: {
  db: {
    get: (id: string) => Promise<Record<string, unknown>>;
    put: (doc: Record<string, unknown>) => Promise<unknown>;
  };
}): Promise<void> {
  const fresh = buildFaimsAclShapeDesignDoc();
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const existing = await db.get(FAIMS_ACL_SHAPE_DDOC_ID);
      if (
        existing.version === fresh.version &&
        existing.validate_doc_update === fresh.validate_doc_update
      ) {
        return;
      }
      await db.put({
        ...fresh,
        _rev: existing._rev,
      });
      return;
    } catch (err: unknown) {
      if (isNotFoundError(err)) {
        try {
          await db.put(fresh);
          return;
        } catch (putErr: unknown) {
          if (isConflictError(putErr) && attempt < maxAttempts - 1) {
            continue;
          }
          throw putErr;
        }
      }
      if (isConflictError(err) && attempt < maxAttempts - 1) {
        continue;
      }
      throw err;
    }
  }
}
