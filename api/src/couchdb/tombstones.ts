import {
  ExistingTombstoneDBDocument,
  TombstoneDBDocument,
  TombstoneDBFields,
} from '@faims3/data-model';
import {getTombstoneDB} from '.';
import * as Exceptions from '../exceptions';

/**
 * Fetches a survey tombstone by deleted project / survey ID.
 * @param id The deleted project ID (document `_id`)
 * @returns The tombstone document if present
 */
export const getTombstoneById = async (
  id: string
): Promise<ExistingTombstoneDBDocument> => {
  const tombstoneDb = getTombstoneDB();
  try {
    return await tombstoneDb.get(id);
  } catch (error) {
    throw new Exceptions.ItemNotFoundException(
      'No tombstone found for this survey ID. It may never have been deleted.'
    );
  }
};

/**
 * Creates a tombstone record for a permanently deleted survey.
 * Document `_id` is the deleted project ID.
 * @param projectId The deleted survey / project ID
 * @param payload Tombstone metadata (who, when, name, etc.)
 * @returns The created tombstone document
 */
export const createTombstoneDocument = async (
  projectId: string,
  payload: TombstoneDBFields
): Promise<ExistingTombstoneDBDocument> => {
  const tombstoneDb = getTombstoneDB();

  const tombstoneDoc: TombstoneDBDocument = {
    _id: projectId,
    ...payload,
  };

  try {
    await tombstoneDb.put(tombstoneDoc);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to PUT the new tombstone document into the tombstone DB. Exception ' +
        e
    );
  }

  try {
    return await getTombstoneById(tombstoneDoc._id);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to GET the new tombstone document from the tombstone DB.'
    );
  }
};
