// recordUtils.ts

import {RecordMetadata} from '@faims3/data-model';

/**
 * Get the total number of records.
 * @param {RecordMetadata[]} rows - Array of records metadata.
 * @returns {number} The total count of records.
 */
export const getTotalRecordCount = (rows: RecordMetadata[]): number => {
  return rows.length;
};

/**
 * Get the number of records created by a specific user.
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

/**
 * Get the number of records not created by a specific user.
 * @param {RecordMetadata[]} rows - Array of records metadata.
 * @param {string} username - The username to exclude from the count.
 * @returns {number} The count of records not created by the user.
 */
export const getOtherRecordCount = (
  rows: RecordMetadata[],
  username: string
): number => {
  return rows.filter(record => record.created_by !== username).length;
};
