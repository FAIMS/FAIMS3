// SPDX-License-Identifier: Apache-2.0
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {convertToCouchDBString} from '../utils';

const INDEX_DOCUMENT_NAME = 'indexes';

const ASSETS_BY_TEAM = 'assetsByTeam';
const ASSETS_BY_CREATOR = 'assetsByCreator';
const ASSETS_BY_STATUS = 'assetsByStatus';
const LINKS_BY_PROJECT = 'linksByProject';
const LINKS_BY_ASSET = 'linksByAsset';

export const MAP_ASSETS_BY_TEAM = `${INDEX_DOCUMENT_NAME}/${ASSETS_BY_TEAM}`;
export const MAP_ASSETS_BY_CREATOR = `${INDEX_DOCUMENT_NAME}/${ASSETS_BY_CREATOR}`;
export const MAP_ASSETS_BY_STATUS = `${INDEX_DOCUMENT_NAME}/${ASSETS_BY_STATUS}`;
export const MAP_ASSET_LINKS_BY_PROJECT = `${INDEX_DOCUMENT_NAME}/${LINKS_BY_PROJECT}`;
export const MAP_ASSET_LINKS_BY_ASSET = `${INDEX_DOCUMENT_NAME}/${LINKS_BY_ASSET}`;

const indexDocument = {
  _id: `_design/${INDEX_DOCUMENT_NAME}`,
  views: {
    // Team tab and GET /api/teams/:id/map-assets list by this key.
    [ASSETS_BY_TEAM]: {
      map: convertToCouchDBString(doc => {
        if (!doc || doc.docType !== 'asset' || !doc.ownedByTeamId) {
          return;
        }
        emit(doc.ownedByTeamId, 1);
      }),
    },
    [ASSETS_BY_CREATOR]: {
      map: convertToCouchDBString(doc => {
        if (!doc || doc.docType !== 'asset' || !doc.createdBy) {
          return;
        }
        emit(doc.createdBy, 1);
      }),
    },
    [ASSETS_BY_STATUS]: {
      map: convertToCouchDBString(doc => {
        if (!doc || doc.docType !== 'asset' || !doc.status) {
          return;
        }
        emit(doc.status, 1);
      }),
    },
    [LINKS_BY_PROJECT]: {
      map: convertToCouchDBString(doc => {
        if (!doc || doc.docType !== 'link') {
          return;
        }
        emit(doc.projectId, doc.assetId);
      }),
    },
    [LINKS_BY_ASSET]: {
      map: convertToCouchDBString(doc => {
        if (!doc || doc.docType !== 'link') {
          return;
        }
        emit(doc.assetId, doc.projectId);
      }),
    },
  },
};

export const mapAssetsDesignDocuments = {indexDocument};
