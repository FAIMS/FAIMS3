// SPDX-License-Identifier: Apache-2.0
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import {Action, necessaryActionToCouchRoleList} from '../../permission';
import {convertToCouchDBString} from '../utils';

/**
 * Design document for filtering attachments
 */
export const attachmentFilterDocument = {
  _id: '_design/attachment_filter',
  views: {
    attachment_filter: {
      map: convertToCouchDBString(doc => {
        if (doc.attach_format_version === undefined) {
          emit(doc._id);
        }
      }),
    },
  },
};

/**
 * Design document for permissions validation (is built from project Id)
 *
 * The `validate_doc_update` function is `toString()`-ed and shipped to
 * CouchDB, so everything it needs must live inside its body; it cannot
 * reference imports or module constants. It runs on EVERY write to every
 * project data DB (records, revisions, AVPs, attachments, deletes).
 *
 * Attachment content-type gate (stored XSS via uploaded SVG mitigation):
 *
 * - Gate first on the attachment-doc identity (`attach_format_version === 1`,
 *   the same test the `attachments` index view uses) and `!_deleted`. For
 *   every non-attachment document the added cost is one property lookup and
 *   one comparison; `_attachments` is never touched. Deletes always pass so
 *   a legacy hostile attachment can still be removed.
 * - Inside the gate, only each stub's `content_type` string is read
 *   (normalised: cut at `;`, trimmed, lower-cased). No `data`/`digest`/
 *   `length`, no serialisation, no regular expressions. Fails fast on the
 *   first blocked stub. A missing/empty `content_type` on an attachment stub
 *   fails closed.
 * - Blocklist (not allowlist) so generic files (PDF, CSV, ZIP, audio,
 *   `application/octet-stream`) keep syncing. The list MUST stay identical to
 *   `BLOCKED_ATTACHMENT_CONTENT_TYPES` in `library/forms/lib/utils.ts`;
 *   there is no shared runtime, so the two are kept in sync by hand.
 * - Throws `{forbidden}` (403, per-document rejection) rather than
 *   `{unauthorized}` so replication reports a per-doc error instead of
 *   treating it as an auth failure.
 *
 * Propagation: `initDataDB` -> `couchInitialiser` with `forceWrite: true`
 * from API startup (`initialiseAndMigrateDBs({force: true})` and
 * `validateDatabases` -> `initialiseDataDb({force: true})`) and from the app
 * on project activation, so existing databases pick up the new validator on
 * the next API boot / activation without a migration step.
 */
export const permissionsDocument = (projectId: string) => ({
  _id: '_design/permissions',
  validate_doc_update: convertToCouchDBString(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (newDoc, oldDoc, userCtx, _secObj) => {
      if (userCtx === null || userCtx === undefined) {
        throw {
          unauthorized: 'You must be logged in. No token given.',
        };
      }
      if (userCtx.name === null || userCtx.name === undefined) {
        throw {
          unauthorized: 'You must be logged in. No username given.',
        };
      }

      // Attachment content-type gate: see the permissionsDocument JSDoc.
      // Gate first on attachment-doc identity; deletes always pass.
      if (newDoc.attach_format_version === 1 && !newDoc._deleted) {
        var atts = newDoc._attachments;
        if (atts) {
          for (var attName in atts) {
            var rawType = atts[attName] && atts[attName].content_type;
            var contentType = '';
            if (typeof rawType === 'string') {
              var semi = rawType.indexOf(';');
              contentType = (semi === -1 ? rawType : rawType.substring(0, semi))
                .trim()
                .toLowerCase();
            }
            if (
              contentType === 'image/svg+xml' ||
              contentType === 'image/svg' ||
              contentType === 'text/html' ||
              contentType === 'application/xhtml+xml' ||
              contentType === 'application/x-html' ||
              contentType === 'text/xhtml' ||
              // Missing/empty type on an attachment stub fails closed.
              contentType === ''
            ) {
              throw {
                forbidden:
                  'Attachments of type ' +
                  (contentType || '(missing)') +
                  ' are not allowed.',
              };
            }
          }
        }
      }

      // Never allow 'changing' authors - noting this will only catch rec -
      // since this is the only document we ever actually update
      if (
        oldDoc &&
        oldDoc.created_by &&
        newDoc &&
        newDoc.created_by &&
        oldDoc.created_by !== newDoc.created_by
      ) {
        throw {
          unauthorized: 'You cannot change the author of an existing record!',
        };
      }

      // Check both _deleted and deleted flags in both documents NOTE this
      // doesn't actually work atm because deletion is just a change of deleted
      // to the latest rev (which is a new object!)
      const isDeleting =
        oldDoc &&
        !(oldDoc._deleted || oldDoc.deleted) &&
        (newDoc._deleted || newDoc.deleted);

      // if old doc - refer to that to avoid ability to override created by - otherwise use new doc
      const isMine = oldDoc
        ? oldDoc.created_by && oldDoc.created_by === userCtx.name
        : newDoc.created_by && newDoc.created_by === userCtx.name;

      // User context roles is the _couchdb.roles which are
      // <projectId>||<permission> or <permission>

      // These are acceptable roles granting edit anyones
      const acceptableEditAnyRoles = [
        // Do not remove - this is templated
        _ACCEPTABLE_EDIT_ANY_ROLES,
      ];
      // These are acceptable roles granting edit mine
      const acceptableEditMyRoles = [
        // Do not remove - this is templated
        _ACCEPTABLE_EDIT_MY_ROLES,
      ];
      // These are acceptable roles granting delete anyones
      const acceptableDeleteAnyRoles = [
        // Do not remove - this is templated
        _ACCEPTABLE_DELETE_ANY_ROLES,
      ];
      // These are acceptable roles granting delete mine
      const acceptableDeleteMyRoles = [
        // Do not remove - this is templated
        _ACCEPTABLE_DELETE_MY_ROLES,
      ];

      // Are we deleting?
      if (isDeleting) {
        if (isMine) {
          // Deleting my record!
          for (const acceptable of acceptableDeleteMyRoles) {
            if (userCtx.roles && userCtx.roles.indexOf(acceptable) !== -1) {
              // allowed to perform this action
              return;
            }
          }
          throw {unauthorized: 'You cannot delete your record.'};
        } else {
          // Deleting other's record!
          for (const acceptable of acceptableDeleteAnyRoles) {
            if (userCtx.roles && userCtx.roles.indexOf(acceptable) !== -1) {
              // allowed to perform this action
              return;
            }
          }
          throw {unauthorized: "You cannot delete another user's record."};
        }
      } else {
        if (isMine) {
          // Editing my record!
          for (const acceptable of acceptableEditMyRoles) {
            if (userCtx.roles && userCtx.roles.indexOf(acceptable) !== -1) {
              // allowed to perform this action
              return;
            }
          }
          throw {unauthorized: 'You cannot edit your record.'};
        } else {
          // Deleting other's record!
          for (const acceptable of acceptableEditAnyRoles) {
            if (userCtx.roles && userCtx.roles.indexOf(acceptable) !== -1) {
              // allowed to perform this action
              return;
            }
          }
          throw {unauthorized: "You cannot edit another user's record."};
        }
      }
    }
  )
    .replace(
      '_ACCEPTABLE_EDIT_ANY_ROLES',
      necessaryActionToCouchRoleList({
        action: Action.EDIT_ALL_PROJECT_RECORDS,
        resourceId: projectId,
      })
        .map(s => `'${s}'`)
        .join(',')
    )
    .replace(
      '_ACCEPTABLE_EDIT_MY_ROLES',
      necessaryActionToCouchRoleList({
        action: Action.EDIT_MY_PROJECT_RECORDS,
        resourceId: projectId,
      })
        .map(s => `'${s}'`)
        .join(',')
    )
    .replace(
      '_ACCEPTABLE_DELETE_ANY_ROLES',
      necessaryActionToCouchRoleList({
        action: Action.DELETE_ALL_PROJECT_RECORDS,
        resourceId: projectId,
      })
        .map(s => `'${s}'`)
        .join(',')
    )
    .replace(
      '_ACCEPTABLE_DELETE_MY_ROLES',
      necessaryActionToCouchRoleList({
        action: Action.DELETE_MY_PROJECT_RECORDS,
        resourceId: projectId,
      })
        .map(s => `'${s}'`)
        .join(',')
    ),
});

/**
 * Design document for indexing different document types
 */
export const indexDocument = {
  _id: '_design/index',
  views: {
    record: {
      map: convertToCouchDBString(doc => {
        if (doc.record_format_version === 1) emit(doc._id, 1);
      }),
    },
    recordRevisions: {
      map: convertToCouchDBString(doc => {
        if (doc.record_format_version === 1)
          if (doc.heads.length > 0) {
            const conflict = doc.heads.length > 1;
            const created = doc.created;
            const created_by = doc.created_by;
            const updatedAt = doc.updatedAt;
            const type = doc.type;
            emit(doc._id, {
              _id: doc.heads[0],
              conflict,
              created,
              created_by,
              updatedAt,
              type,
            });
          }
      }),
    },
    // One row per record HEAD, keyed by parsed updatedAt then record id.
    recordByUpdated: {
      map: convertToCouchDBString(doc => {
        if (doc.record_format_version === 1 && doc.updatedAt) {
          const ts = Date.parse(doc.updatedAt);
          if (!Number.isNaN(ts)) {
            emit([ts, doc._id], 1);
          }
        }
      }),
    },
    revision: {
      map: convertToCouchDBString(doc => {
        if (doc.revision_format_version === 1) emit(doc._id, 1);
      }),
    },
    revisionMetadata: {
      map: convertToCouchDBString(doc => {
        if (doc.revision_format_version === 1) {
          emit(doc._id, {
            _id: doc._id,
            created: doc.created,
            created_by: doc.created_by,
            deleted: doc.deleted,
            relationship: doc.relationship,
          });
        }
      }),
    },
    attachments: {
      map: convertToCouchDBString(doc => {
        if (doc.attach_format_version === 1) emit(doc._id, 1);
      }),
    },
    avp: {
      map: convertToCouchDBString(doc => {
        if (doc.avp_format_version === 1) emit(doc._id, 1);
      }),
    },
    recordCount: {
      map: convertToCouchDBString(doc => {
        if (doc.record_format_version === 1) emit(doc._id, 1);
      }),
      reduce: '_count',
    },
  },
};

/**
 * Design document for record audit optimization
 */
export const recordAuditDocument = {
  _id: '_design/record_audit',
  views: {
    by_record_id: {
      map: convertToCouchDBString(doc => {
        // Only emit documents that have record_id and are not attachments
        if (doc.record_id && doc.attach_format_version === undefined) {
          emit(doc.record_id, {
            _id: doc._id,
            _rev: doc._rev,
          });
        }
      }),
    },
  },
};

/**
 * Exports all design documents for the notebook database
 */
export const dataDbDesignDocuments = {
  attachmentFilterDocument,
  permissionsDocument,
  indexDocument,
  recordAuditDocument,
};
