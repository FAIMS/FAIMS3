// SPDX-License-Identifier: Apache-2.0
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import {convertToCouchDBString} from '../utils';
import {
  listingSearchMap,
  listingSearchPrefix,
} from '../../listing/listingSearch';

const INDEX_DOCUMENT_NAME = 'indexes';
const PEOPLE_LISTING_BY_NAME_POSTFIX = 'listingByName';
const PEOPLE_LISTING_BY_RESOURCE_POSTFIX = 'listingByResource';
const PEOPLE_SEARCH_POSTFIX = 'search';

/**
 * User list rows keyed `[disabledFlag, nameLower, _id]`. People documents
 * carry no timestamp, so GET /api/users pages in name order.
 */
export const PEOPLE_LISTING_BY_NAME = `${INDEX_DOCUMENT_NAME}/${PEOPLE_LISTING_BY_NAME_POSTFIX}`;
/**
 * Member rows keyed `[resourceId, disabledFlag, nameLower, _id]`, one per
 * user per team / survey / template they hold a role on.
 */
export const PEOPLE_LISTING_BY_RESOURCE = `${INDEX_DOCUMENT_NAME}/${PEOPLE_LISTING_BY_RESOURCE_POSTFIX}`;

/**
 * Search over enabled accounts by the words of the name and of every email
 * address, keyed `['all', '', word, _id]`. See `listingSearch.ts`.
 */
export const PEOPLE_SEARCH = `${INDEX_DOCUMENT_NAME}/${PEOPLE_SEARCH_POSTFIX}`;

/** Key component for enabled accounts. */
export const PEOPLE_LIST_ACTIVE_FLAG = 0;
/** Key component for disabled accounts. */
export const PEOPLE_LIST_DISABLED_FLAG = 1;

/** Cursor after the prefix in both people listing views: `[nameLower, _id]`. */
const PEOPLE_LIST_CURSOR_SHAPE = ['string', 'string'];

/** View value of {@link PEOPLE_LISTING_BY_RESOURCE}. */
export type PeopleResourceMemberRow = {
  _id: string;
  user_id: string;
  name: string;
  /** Roles this user holds on the resource, by role scope. */
  projectRoles: string[];
  teamRoles: string[];
  templateRoles: string[];
};

/**
 * Listing spec for one GET /api/users page; spread into `queryListingPage`.
 * `includeArchived` is XOR: true lists disabled accounts only.
 */
export function peopleListingViewAndPrefix({
  includeArchived,
}: {
  includeArchived: boolean;
}): {
  view: string;
  prefix: unknown[];
  descending: boolean;
  cursorShape: ('string' | 'number')[];
} {
  return {
    view: PEOPLE_LISTING_BY_NAME,
    prefix: [
      includeArchived ? PEOPLE_LIST_DISABLED_FLAG : PEOPLE_LIST_ACTIVE_FLAG,
    ],
    descending: false,
    cursorShape: PEOPLE_LIST_CURSOR_SHAPE,
  };
}

/**
 * Search view, key prefix and listing view for one GET /api/users?q= page;
 * spread into `queryListingSearchPage` with `loadRows` reading
 * `listingView`. Enabled accounts only.
 */
export function peopleSearchViewAndPrefix(): {
  view: string;
  prefix: unknown[];
  listingView: string;
} {
  return {
    view: PEOPLE_SEARCH,
    prefix: listingSearchPrefix(),
    listingView: PEOPLE_LISTING_BY_NAME,
  };
}

/**
 * Listing spec for the enabled members of one resource, in name order;
 * spread into `queryListingPage`.
 */
export function peopleResourceListingViewAndPrefix({
  resourceId,
}: {
  resourceId: string;
}): {
  view: string;
  prefix: unknown[];
  descending: boolean;
  cursorShape: ('string' | 'number')[];
} {
  return {
    view: PEOPLE_LISTING_BY_RESOURCE,
    prefix: [resourceId, PEOPLE_LIST_ACTIVE_FLAG],
    descending: false,
    cursorShape: PEOPLE_LIST_CURSOR_SHAPE,
  };
}

/**
 * Design document for indexing people
 */
const designDoc = {
  _id: `_design/${INDEX_DOCUMENT_NAME}`,
  views: {
    byUserId: {
      map: convertToCouchDBString(doc => {
        if (doc.user_id) {
          emit(doc.user_id, 1);
        }
      }),
    },
    byEmail: {
      map: convertToCouchDBString(doc => {
        if (doc.emails) {
          for (const email of doc.emails) {
            emit(email.email, 1);
          }
        }
      }),
    },
    byGlobalRoles: {
      map: convertToCouchDBString(doc => {
        if (doc.globalRoles) {
          for (const role of doc.globalRoles) {
            emit(role, 1);
          }
        }
      }),
    },
    byProjectRoles: {
      map: convertToCouchDBString(doc => {
        if (doc.projectRoles) {
          for (const {role, resourceId} of doc.projectRoles) {
            emit([role, resourceId], 1);
          }
        }
      }),
    },
    byTemplateRoles: {
      map: convertToCouchDBString(doc => {
        if (doc.templateRoles) {
          for (const {role, resourceId} of doc.templateRoles) {
            emit([role, resourceId], 1);
          }
        }
      }),
    },
    byTeamRoles: {
      map: convertToCouchDBString(doc => {
        if (doc.teamRoles) {
          for (const {role, resourceId} of doc.teamRoles) {
            emit([role, resourceId], 1);
          }
        }
      }),
    },
    byResource: {
      map: convertToCouchDBString(doc => {
        // only emit once per resource Id !
        const emitted = [];
        if (doc.projectRoles) {
          for (const {resourceId} of doc.projectRoles) {
            if (emitted.indexOf(resourceId) === -1) {
              emit(resourceId, 1);
              emitted.push(resourceId);
            }
          }
        }
        if (doc.teamRoles) {
          for (const {resourceId} of doc.teamRoles) {
            if (emitted.indexOf(resourceId) === -1) {
              emit(resourceId, 1);
              emitted.push(resourceId);
            }
          }
        }
        if (doc.templateRoles) {
          for (const {resourceId} of doc.templateRoles) {
            if (emitted.indexOf(resourceId) === -1) {
              emit(resourceId, 1);
              emitted.push(resourceId);
            }
          }
        }
      }),
    },
    // GET /api/users pages. The value is the list row: role and contact
    // fields only, with each login profile reduced to `true` so password
    // hashes never enter the index.
    [PEOPLE_LISTING_BY_NAME_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (!doc || !doc._id || doc._id[0] === '_' || !doc.user_id) {
          return;
        }
        var profiles = {};
        if (doc.profiles) {
          for (var key in doc.profiles) {
            profiles[key] = !!doc.profiles[key];
          }
        }
        var name = typeof doc.name === 'string' ? doc.name : '';
        emit([doc.disabled === true ? 1 : 0, name.toLowerCase(), doc._id], {
          _id: doc._id,
          user_id: doc.user_id,
          name: name,
          emails: doc.emails || [],
          globalRoles: doc.globalRoles || [],
          projectRoles: doc.projectRoles || [],
          teamRoles: doc.teamRoles || [],
          templateRoles: doc.templateRoles || [],
          profiles: profiles,
          disabled: doc.disabled === true,
        });
      }),
    },
    // GET /api/users?q=. Rows point at the `listingByName` row.
    [PEOPLE_SEARCH_POSTFIX]: {
      map: listingSearchMap((doc, tokenize) => {
        if (!doc || !doc._id || doc._id[0] === '_' || !doc.user_id) {
          return;
        }
        if (doc.disabled === true) {
          return;
        }
        var name = typeof doc.name === 'string' ? doc.name : '';
        var text = name;
        if (doc.emails) {
          for (var e = 0; e < doc.emails.length; e++) {
            if (doc.emails[e] && typeof doc.emails[e].email === 'string') {
              text += ' ' + doc.emails[e].email;
            }
          }
        }
        var tokens = tokenize(text);
        var value = {tokens: tokens, key: [0, name.toLowerCase(), doc._id]};
        for (var i = 0; i < tokens.length; i++) {
          emit(['all', '', tokens[i], doc._id], value);
        }
      }),
    },
    // Members of one resource (team, survey or template). One row per user
    // per resource, carrying only that user's roles on that resource.
    [PEOPLE_LISTING_BY_RESOURCE_POSTFIX]: {
      map: convertToCouchDBString(doc => {
        if (!doc || !doc._id || doc._id[0] === '_' || !doc.user_id) {
          return;
        }
        var byResource = {};
        var order = [];
        var collect = function (roles, field) {
          if (!roles) {
            return;
          }
          for (var i = 0; i < roles.length; i++) {
            var resourceId = roles[i].resourceId;
            if (!resourceId) {
              continue;
            }
            if (!byResource[resourceId]) {
              byResource[resourceId] = {
                projectRoles: [],
                teamRoles: [],
                templateRoles: [],
              };
              order.push(resourceId);
            }
            byResource[resourceId][field].push(roles[i].role);
          }
        };
        collect(doc.projectRoles, 'projectRoles');
        collect(doc.teamRoles, 'teamRoles');
        collect(doc.templateRoles, 'templateRoles');
        var name = typeof doc.name === 'string' ? doc.name : '';
        var disabled = doc.disabled === true ? 1 : 0;
        for (var j = 0; j < order.length; j++) {
          var roles = byResource[order[j]];
          emit([order[j], disabled, name.toLowerCase(), doc._id], {
            _id: doc._id,
            user_id: doc.user_id,
            name: name,
            projectRoles: roles.projectRoles,
            teamRoles: roles.teamRoles,
            templateRoles: roles.templateRoles,
          });
        }
      }),
    },
  },
};

export const peopleDesignDocuments = {designDoc};
