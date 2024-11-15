import {RecordMetadata} from '@faims3/data-model';

/**
 * Get the total number of records from an array of record metadata.
 *
 * This function takes in an array of record metadata and returns the total
 * number of records present. It simply calculates the length of the array
 * to determine the count.
 *
 * @param {RecordMetadata[]} rows - Array of records metadata.
 * @returns {number} The total count of records.
 */
export const getTotalRecordCount = (rows: RecordMetadata[]): number => {
  return rows.length;
};

/**
 * Get the number of records created by a specific user from an array of record metadata.
 *
 * This function filters the records array based on the username provided
 * and returns the count of records created by that specific user. It looks
 * for the `created_by` field in each record to match it with the provided username.
 *
 * @param {RecordMetadata[]} rows - Array of records metadata.
 * @param {string} username - The username to filter the records by.
 * @returns {number} The count of records created by the user.
 */
export const getRecordCountByUser = (
  rows: RecordMetadata[],
  username: string
): number => {
  return rows.filter(record => record.created_by === username).length;
};
