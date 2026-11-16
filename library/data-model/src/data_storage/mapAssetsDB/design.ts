// SPDX-License-Identifier: Apache-2.0
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {convertToCouchDBString} from '../utils';
import {
  listingSearchMap,
  listingSearchPrefix,
} from '../../listing/listingSearch';

const INDEX_DOCUMENT_NAME = 'indexes';

const ASSETS_BY_TEAM = 'assetsByTeam';
const ASSETS_BY_CREATOR = 'assetsByCreator';
const ASSETS_BY_STATUS = 'assetsByStatus';
const LINKS_BY_PROJECT = 'linksByProject';
const LINKS_BY_ASSET = 'linksByAsset';
const ASSETS_LISTING = 'assetsListing';
const LINKS_LISTING_BY_PROJECT = 'linksListingByProject';
const ASSETS_SEARCH = 'assetsSearch';

/**
 * Team-owned asset documents keyed `[ownedByTeamId, updatedAtMs, _id]`, so a
 * team's layers page newest first. A whole-team read ranges over `[teamId]`.
 * Processing stage/progress writes do not bump `updatedAt`, so a cursor stays
 * valid while a layer is processing.
 */
export const MAP_ASSETS_BY_TEAM = `${INDEX_DOCUMENT_NAME}/${ASSETS_BY_TEAM}`;
/** Every asset document keyed `[updatedAtMs, _id]` (library listing). */
export const MAP_ASSETS_LISTING = `${INDEX_DOCUMENT_NAME}/${ASSETS_LISTING}`;
/**
 * Survey links keyed `[projectId, linkCreatedAtMs, linkId]` with the asset id
 * as value, so a survey's linked layers page newest link first.
 */
export const MAP_ASSET_LINKS_LISTING_BY_PROJECT = `${INDEX_DOCUMENT_NAME}/${LINKS_LISTING_BY_PROJECT}`;
/**
 * Name search over asset documents, keyed `[scopeKind, scopeId, word, _id]`
 * for the whole library and the owning team. See `listingSearch.ts`.
 */
export const MAP_ASSETS_SEARCH = `${INDEX_DOCUMENT_NAME}/${ASSETS_SEARCH}`;
export const MAP_ASSETS_BY_CREATOR = `${INDEX_DOCUMENT_NAME}/${ASSETS_BY_CREATOR}`;
export const MAP_ASSETS_BY_STATUS = `${INDEX_DOCUMENT_NAME}/${ASSETS_BY_STATUS}`;
export const MAP_ASSET_LINKS_BY_PROJECT = `${INDEX_DOCUMENT_NAME}/${LINKS_BY_PROJECT}`;
export const MAP_ASSET_LINKS_BY_ASSET = `${INDEX_DOCUMENT_NAME}/${LINKS_BY_ASSET}`;

/**
 * Listing view and key prefix for one map-layer page; spread into
 * `queryListingPage`. Pages are newest `updatedAt` first. Processing
 * stage/progress writes do not bump `updatedAt`, so a cursor stays valid
 * while a layer is processing. With `teamId` the cursor is
 * `[updatedAtMs, assetId]` inside that team; otherwise it walks the whole
 * library.
 */
export function mapAssetListingViewAndPrefix({teamId}: {teamId?: string}): {
  view: string;
  prefix: unknown[];
} {
  return teamId
    ? {view: MAP_ASSETS_BY_TEAM, prefix: [teamId]}
    : {view: MAP_ASSETS_LISTING, prefix: []};
}

/**
 * Search view, key prefix and listing view for one map-layer search page;
 * spread into `queryListingSearchPage` with `loadRows` reading
 * `listingView`.
 */
export function mapAssetSearchViewAndPrefix({teamId}: {teamId?: string}): {
  view: string;
  prefix: unknown[];
  listingView: string;
} {
  return {
    view: MAP_ASSETS_SEARCH,
    prefix: listingSearchPrefix(
      teamId ? {kind: 'team', id: teamId} : undefined
    ),
    listingView: MAP_ASSETS_LISTING,
  };
}

/** Listing view and key prefix for the layers linked to one survey. */
export function mapAssetLinkListingViewAndPrefix({
  projectId,
}: {
  projectId: string;
}): {view: string; prefix: unknown[]} {
  return {view: MAP_ASSET_LINKS_LISTING_BY_PROJECT, prefix: [projectId]};
}

const indexDocument = {
  _id: `_design/${INDEX_DOCUMENT_NAME}`,
  views: {
    // Team tab and GET /api/teams/:id/map-assets list by this key.
    [ASSETS_BY_TEAM]: {
      map: convertToCouchDBString(doc => {
        if (!doc || doc.docType !== 'asset' || !doc.ownedByTeamId) {
          return;
        }
        var row = {...doc};
        delete row._attachments;
        var updatedMs = doc.updatedAt;
        if (!(updatedMs > 0)) {
          updatedMs = doc.createdAt;
        }
        if (!(updatedMs > 0)) {
          updatedMs = 0;
        }
        emit([doc.ownedByTeamId, updatedMs, doc._id], row);
      }),
    },
    // Library listing (GET /api/map-assets).
    [ASSETS_LISTING]: {
      map: convertToCouchDBString(doc => {
        if (!doc || doc.docType !== 'asset') {
          return;
        }
        var row = {...doc};
        delete row._attachments;
        var updatedMs = doc.updatedAt;
        if (!(updatedMs > 0)) {
          updatedMs = doc.createdAt;
        }
        if (!(updatedMs > 0)) {
          updatedMs = 0;
        }
        emit([updatedMs, doc._id], row);
      }),
    },
    // GET /api/map-assets?q=. Rows point at the `assetsListing` row.
    [ASSETS_SEARCH]: {
      map: listingSearchMap((doc, tokenize) => {
        if (!doc || doc.docType !== 'asset') {
          return;
        }
        var updatedMs = doc.updatedAt;
        if (!(updatedMs > 0)) {
          updatedMs = doc.createdAt;
        }
        if (!(updatedMs > 0)) {
          updatedMs = 0;
        }
        var tokens = tokenize(doc.name);
        var value = {tokens: tokens, key: [updatedMs, doc._id]};
        for (var i = 0; i < tokens.length; i++) {
          emit(['all', '', tokens[i], doc._id], value);
          if (doc.ownedByTeamId) {
            emit(['team', doc.ownedByTeamId, tokens[i], doc._id], value);
          }
        }
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
    // Survey Map layers tab (GET /api/map-assets?projectId=).
    [LINKS_LISTING_BY_PROJECT]: {
      map: convertToCouchDBString(doc => {
        if (!doc || doc.docType !== 'link' || !doc.projectId || !doc.assetId) {
          return;
        }
        var createdMs = doc.createdAt;
        if (!(createdMs > 0)) {
          createdMs = 0;
        }
        emit([doc.projectId, createdMs, doc._id], doc.assetId);
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
