// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {convertToCouchDBString} from '../utils';

// Index constants
const INDEX_DOCUMENT_NAME = 'index';
const TEMPLATES_BY_TEAM_ID_POSTFIX = 'byTeamId';
const TEMPLATES_LISTING_BY_TEMPLATE_ID_POSTFIX = 'listingByTemplateId';
const TEMPLATES_LISTING_BY_TEAM_ID_POSTFIX = 'listingByTeam';

export const TEMPLATES_BY_TEAM_ID = `${INDEX_DOCUMENT_NAME}/${TEMPLATES_BY_TEAM_ID_POSTFIX}`;
/** View value: template list metadata only (no ui-specification / form payload). */
export const TEMPLATES_LISTING_BY_TEMPLATE_ID = `${INDEX_DOCUMENT_NAME}/${TEMPLATES_LISTING_BY_TEMPLATE_ID_POSTFIX}`;
/** Same list shape as {@link TEMPLATES_LISTING_BY_TEMPLATE_ID}, keyed by ownedByTeamId. */
export const TEMPLATES_LISTING_BY_TEAM_ID = `${INDEX_DOCUMENT_NAME}/${TEMPLATES_LISTING_BY_TEAM_ID_POSTFIX}`;

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
    [TEMPLATES_LISTING_BY_TEMPLATE_ID_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (!doc) {
          return;
        }
        if (!doc._id || doc._id[0] === '_') {
          return;
        }
        var row = {...doc};
        delete row['ui-specification'];
        emit(doc._id, row);
      }),
    },
    [TEMPLATES_LISTING_BY_TEAM_ID_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (!doc) {
          return;
        }
        if (!doc._id || doc._id[0] === '_') {
          return;
        }
        if (!doc.ownedByTeamId) {
          return;
        }
        var row = {...doc};
        delete row['ui-specification'];
        emit(doc.ownedByTeamId, row);
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
