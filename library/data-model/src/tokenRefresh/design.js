import {emit} from 'process';
import {AuthRecordIdPrefixMap} from './document';

// What is the DB role for admin?
export const ADMIN_ROLE = '_admin';

/**
 * Converts a JavaScript function to a CouchDB-compatible string representation.
 *
 * This function takes a JavaScript function as input and returns a string
 * that can be used as a map or reduce function in a CouchDB design document.
 * It performs the following transformations:
 * 1. Converts the function to a string.
 * 2. Normalizes line endings to \n.
 * 3. Escapes newlines with \\n.
 * 4. Escapes double quotes with \".
 *
 * @param {Function} func - The function to be converted.
 * @returns {string} A string representation of the function, compatible with CouchDB.
 * @throws {Error} If the input is not a function.
 *
 * @example
 * const myFunc = function(doc) {
 *   if (doc.type === "user") {
 *     emit(doc._id, { name: doc.name });
 *   }
 * };
 * const couchDBString = convertToCouchDBString(myFunc);
 * console.log(couchDBString);
 * // Output: "function(doc) {\n  if (doc.type === \"user\") {\n    emit(doc._id, { name: doc.name });\n  }\n}"
 */
function convertToCouchDBString(func) {
  if (typeof func !== 'function') {
    throw new Error('Input must be a function');
  }

  return func
    .toString()
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n/g, '\\n') // Escape newlines
    .replace(/"/g, '\\"'); // Escape double quotes
}

/**
 * This module exports the design document to be used for the auth database.
 */
export const viewsDocument = {
  _id: '_design/viewsDocument',
  views: {
    // All refresh tokens by _id
    refreshTokens: {
      map: convertToCouchDBString(function (doc) {
        // Check that document type is defined and that the type is refresh and the prefix is correct
        if (
          doc.documentType &&
          doc.documentType === 'refresh' &&
          doc._id.startsWith(AuthRecordIdPrefixMap.get('refresh'))
        ) {
          // Emit the whole refresh object indexed by the _id
          emit(doc._id, doc);
        }
      }),
    },
    // Refresh tokens for a specific user (by user id)
    refreshTokensByUserId: {
      map: convertToCouchDBString(function (doc) {
        // Check that document type is defined and that the type is refresh and the prefix is correct
        if (
          doc.documentType &&
          doc.documentType === 'refresh' &&
          doc._id.startsWith(AuthRecordIdPrefixMap.get('refresh'))
        ) {
          // Emit the record by userId
          emit(doc.userId, doc);
        }
      }),
    },
    // Refresh tokens by token
    refreshTokensByToken: {
      map: convertToCouchDBString(function (doc) {
        // Check that document type is defined and that the type is refresh and the prefix is correct
        if (
          doc.documentType &&
          doc.documentType === 'refresh' &&
          doc._id.startsWith(AuthRecordIdPrefixMap.get('refresh'))
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
      // Reject update if user does not have an _admin role
      if (userCtx.roles.indexOf(ADMIN_ROLE) < 0) {
        throw {
          unauthorized: `Access denied for ${userCtx.roles}. Only the Fieldmark server may interact with the Authorisation database.`,
        };
      }
    }
  ),
};
