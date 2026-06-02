// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {convertToCouchDBString} from '../utils';

// Index constants
const INDEX_DOCUMENT_NAME = 'index';
const PROJECTS_BY_TEAM_ID_POSTFIX = 'byTeamId';
const PROJECTS_LISTING_BY_PROJECT_ID_POSTFIX = 'listingByProjectId';
const PROJECTS_LISTING_BY_TEAM_ID_POSTFIX = 'listingByTeam';

export const PROJECTS_BY_TEAM_ID = `${INDEX_DOCUMENT_NAME}/${PROJECTS_BY_TEAM_ID_POSTFIX}`;
/** View value: project list metadata only (no ui-specification / form payload). */
export const PROJECTS_LISTING_BY_PROJECT_ID = `${INDEX_DOCUMENT_NAME}/${PROJECTS_LISTING_BY_PROJECT_ID_POSTFIX}`;
/** Same list shape as {@link PROJECTS_LISTING_BY_PROJECT_ID}, keyed by ownedByTeamId. */
export const PROJECTS_LISTING_BY_TEAM_ID = `${INDEX_DOCUMENT_NAME}/${PROJECTS_LISTING_BY_TEAM_ID_POSTFIX}`;

/**
 * Design document for indexing by key fields
 */
const indexDocument = {
  _id: `_design/${INDEX_DOCUMENT_NAME}`,
  views: {
    [PROJECTS_BY_TEAM_ID_POSTFIX]: {
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
    [PROJECTS_LISTING_BY_PROJECT_ID_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (!doc) {
          return;
        }
        if (!doc._id || doc._id[0] === '_') {
          return;
        }
        var row = {...doc};
        delete row.uiSpecification;
        emit(doc._id, row);
      }),
    },
    [PROJECTS_LISTING_BY_TEAM_ID_POSTFIX]: {
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
        delete row.uiSpecification;
        emit(doc.ownedByTeamId, row);
      }),
    },
  },
};

/**
 * Exports all design documents for the projects database
 */
export const projectsDbDesignDocuments = {
  indexDocument,
};
