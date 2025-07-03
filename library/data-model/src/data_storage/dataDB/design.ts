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
            const type = doc.type;
            emit(doc._id, {
              _id: doc.heads[0],
              conflict,
              created,
              created_by,
              type,
            });
          }
      }),
    },
    revision: {
      map: convertToCouchDBString(doc => {
        if (doc.revision_format_version === 1) emit(doc._id, 1);
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
