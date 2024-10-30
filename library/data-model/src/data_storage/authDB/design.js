/**
 * Converts a JavaScript function to a CouchDB-compatible string representation.
 */
function convertToCouchDBString(func) {
  if (typeof func !== 'function') {
    throw new Error('Input must be a function');
  }

  return func.toString();
}

/**
 * exports the design document to be used for the auth database.
 */
export const viewsDocument = {
  _id: '_design/viewsDocument',
  views: {
    // All refresh tokens by _id
    refreshTokens: {
      map: convertToCouchDBString(function (doc) {
        var DOCUMENT_TYPE = 'refresh';
        var ID_PREFIX = 'refresh_';

        // Check that document type is defined and that the type is refresh and the prefix is correct
        if (
          doc.documentType &&
          doc.documentType === DOCUMENT_TYPE &&
          doc._id.indexOf(ID_PREFIX) === 0
        ) {
          // Emit the whole refresh object indexed by the _id
          emit(doc._id, doc);
        }
      }),
    },
    // Refresh tokens for a specific user (by user id)
    refreshTokensByUserId: {
      map: convertToCouchDBString(function (doc) {
        var DOCUMENT_TYPE = 'refresh';
        var ID_PREFIX = 'refresh_';

        // Check that document type is defined and that the type is refresh and
        // the prefix is correct
        if (
          doc.documentType &&
          doc.documentType === DOCUMENT_TYPE &&
          doc._id.indexOf(ID_PREFIX) === 0 &&
          doc.userId
        ) {
          // Emit the record by userId
          emit(doc.userId, doc);
        }
      }),
    },
    // Refresh tokens by token
    refreshTokensByToken: {
      map: convertToCouchDBString(function (doc) {
        var DOCUMENT_TYPE = 'refresh';
        var ID_PREFIX = 'refresh_';

        // Check that document type is defined and that the type is refresh and the prefix is correct
        if (
          doc.documentType &&
          doc.documentType === DOCUMENT_TYPE &&
          doc._id.indexOf(ID_PREFIX) === 0 &&
          doc.token
        ) {
          // Emit the record by token
          emit(doc.token, doc);
        }
      }),
    },
  },
};

export const permissionDocument = {
  _id: '_design/permissionDocument',
  validate_doc_update: convertToCouchDBString(
    function (newDoc, oldDoc, userCtx) {
      var ADMIN_ROLE = '_admin';
      // Reject update if user does not have an _admin role
      if (userCtx.roles.indexOf(ADMIN_ROLE) < 0) {
        throw {
          unauthorized: `Access denied for ${userCtx.roles}. Only the Fieldmark server may interact with the Authorisation database.`,
        };
      }
    }
  ),
};
