// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {convertToCouchDBString} from '../utils';

/**
 * exports the design document to be used for the auth database.
 */
export const viewsDocument = {
  _id: '_design/viewsDocument',
  views: {
    // REFRESH TOKENS
    // ==============

    // All refresh tokens by _id
    refreshTokens: {
      map: convertToCouchDBString(doc => {
        const DOCUMENT_TYPE = 'refresh';
        const ID_PREFIX = 'refresh_';

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
      map: convertToCouchDBString(doc => {
        const DOCUMENT_TYPE = 'refresh';
        const ID_PREFIX = 'refresh_';

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
      map: convertToCouchDBString(doc => {
        const DOCUMENT_TYPE = 'refresh';
        const ID_PREFIX = 'refresh_';

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

    // All refresh tokens by hash of exchange token
    refreshTokensByExchangeTokenHash: {
      map: convertToCouchDBString(doc => {
        const DOCUMENT_TYPE = 'refresh';
        const ID_PREFIX = 'refresh_';

        // Check that document type is defined and that the type is refresh and the prefix is correct
        if (
          doc.documentType &&
          doc.documentType === DOCUMENT_TYPE &&
          doc._id.indexOf(ID_PREFIX) === 0 &&
          doc.exchangeTokenHash &&
          !doc.exchangeTokenUsed
        ) {
          // Emit the whole refresh object indexed by the hash of the exchange
          // token
          emit(doc.exchangeTokenHash, doc);
        }
      }),
    },

    // EMAIL RESETS
    // ==============

    // All email resets by _id
    emailCodes: {
      map: convertToCouchDBString(doc => {
        const DOCUMENT_TYPE = 'emailcode';
        const ID_PREFIX = 'emailcode_';

        // Check that document type is defined and that the type is refresh and
        // the prefix is correct
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
    emailCodesByUserId: {
      map: convertToCouchDBString(doc => {
        const DOCUMENT_TYPE = 'emailcode';
        const ID_PREFIX = 'emailcode_';

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
    emailCodesByCode: {
      map: convertToCouchDBString(doc => {
        const DOCUMENT_TYPE = 'emailcode';
        const ID_PREFIX = 'emailcode_';

        // Check that document type is defined and that the type is refresh and the prefix is correct
        if (
          doc.documentType &&
          doc.documentType === DOCUMENT_TYPE &&
          doc._id.indexOf(ID_PREFIX) === 0 &&
          doc.code
        ) {
          // Emit the record by token
          emit(doc.code, doc);
        }
      }),
    },

    // VERIFICATION CHALLENGES
    // =======================

    // All verification challenges by _id
    verificationChallenges: {
      map: convertToCouchDBString(doc => {
        const DOCUMENT_TYPE = 'verification';
        const ID_PREFIX = 'verification_';

        // Check that document type is defined and that the type is verification and
        // the prefix is correct
        if (
          doc.documentType &&
          doc.documentType === DOCUMENT_TYPE &&
          doc._id.indexOf(ID_PREFIX) === 0
        ) {
          // Emit the whole verification challenge object indexed by the _id
          emit(doc._id, doc);
        }
      }),
    },
    // Verification challenges for a specific user (by user id)
    verificationChallengesByUserId: {
      map: convertToCouchDBString(doc => {
        const DOCUMENT_TYPE = 'verification';
        const ID_PREFIX = 'verification_';

        // Check that document type is defined and that the type is verification and
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
    // Verification challenges by code
    verificationChallengesByCode: {
      map: convertToCouchDBString(doc => {
        const DOCUMENT_TYPE = 'verification';
        const ID_PREFIX = 'verification_';

        // Check that document type is defined and that the type is verification and the prefix is correct
        if (
          doc.documentType &&
          doc.documentType === DOCUMENT_TYPE &&
          doc._id.indexOf(ID_PREFIX) === 0 &&
          doc.code
        ) {
          // Emit the record by code
          emit(doc.code, doc);
        }
      }),
    },
    // Verification challenges by email
    verificationChallengesByEmail: {
      map: convertToCouchDBString(doc => {
        const DOCUMENT_TYPE = 'verification';
        const ID_PREFIX = 'verification_';

        // Check that document type is defined and that the type is verification and the prefix is correct
        if (
          doc.documentType &&
          doc.documentType === DOCUMENT_TYPE &&
          doc._id.indexOf(ID_PREFIX) === 0 &&
          doc.email
        ) {
          // Emit the record by email
          emit(doc.email, doc);
        }
      }),
    },
  },
};

export const permissionDocument = {
  _id: '_design/permissionDocument',
  validate_doc_update: convertToCouchDBString((newDoc, oldDoc, userCtx) => {
    const ADMIN_ROLE = '_admin';
    // Reject update if user does not have an _admin role
    if (userCtx.roles.indexOf(ADMIN_ROLE) < 0) {
      throw {
        unauthorized: `Access denied for ${userCtx.roles}. Only the Fieldmark server may interact with the Authorisation database.`,
      };
    }
  }),
};
