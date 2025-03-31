// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import {convertToCouchDBString} from '../utils';

/**
 * Design document for indexing people
 */
const designDoc = {
  _id: '_design/indexes',
  views: {
    todo: {
      map: convertToCouchDBString(doc => {
        if (doc.user_id) {
          emit(doc.user_id, 1);
        }
      }),
    },
  },
};

export const teamsDesignDocuments = {designDoc};
