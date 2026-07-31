// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
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
import {
  convertToCouchDBString,
  isConflictError,
  isNotFoundError,
} from '../utils';

/** Design doc id installed on every project data DB. */
export const FAIMS_ACL_SHAPE_DDOC_ID = '_design/faims_acl_shape';

/**
 * Bump when the validate_doc_update body changes so ensure/repair rewrites existing ddocs.
 * 1.3.0: typed `convertToCouchDBString` validate (same semantics as 1.2.0).
 */
export const FAIMS_ACL_SHAPE_DDOC_VERSION = '1.3.0';

/**
 * Rejects non-admin writes where a child-shaped doc (`record_id` set) does not
 * point ACL `parent` at that record. Design docs and `_admin` are exempt.
 *
 * Written as a JS function and stringified via {@link convertToCouchDBString}
 * (same pattern as authDB / dataDB design docs). Body must stay Couch-safe:
 * no imports, closures, or TypeScript-only syntax.
 */
export const FAIMS_ACL_SHAPE_VALIDATE_DOC_UPDATE_SOURCE =
  convertToCouchDBString(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (newDoc, oldDoc, userCtx, _secObj) => {
      const roles = userCtx.roles || [];
      if (roles.indexOf('_admin') >= 0) return;
      if (/^_design/.test(newDoc._id || '')) return;
      if (typeof newDoc.record_id === 'string' && newDoc.record_id) {
        if (
          typeof newDoc.parent !== 'string' ||
          newDoc.parent !== newDoc.record_id
        ) {
          throw {forbidden: 'Child document parent must equal record_id.'};
        }
      }
    }
  );

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
