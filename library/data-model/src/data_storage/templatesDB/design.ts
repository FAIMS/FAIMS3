// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {convertToCouchDBString} from '../utils';

// Index constants
const INDEX_DOCUMENT_NAME = 'index';
const TEMPLATES_BY_TEAM_ID_POSTFIX = 'byTeamId';

export const TEMPLATES_BY_TEAM_ID = `${INDEX_DOCUMENT_NAME}/${TEMPLATES_BY_TEAM_ID_POSTFIX}`;

/**
 * Design document for indexing by key fields
 */
const indexDocument = {
  _id: `_design/${INDEX_DOCUMENT_NAME}`,
  views: {
    [TEMPLATES_BY_TEAM_ID_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (
          doc &&
          doc.ownedByTeamId !== undefined &&
          doc.ownedByTeamId.length > 0
        ) {
          emit(doc.ownedByTeamId, 1);
        }
      }),
    },
  },
};

/**
 * Exports all design documents for the templates database
 */
export const templatesDbDesignDocuments = {
  indexDocument,
};
