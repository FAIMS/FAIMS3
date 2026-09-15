// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

/**
 * Design document for the tombstone database.
 * Lookup is by document `_id` (deleted project id); no views required yet.
 */
const designDoc = {
  _id: '_design/indexes',
  views: {},
};

export const tombstoneDesignDocuments = {designDoc};
