// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: core.ts
 * Description:
 *   Core types/interfaces that are used throughout the codebase.
 *   Types/interfaces that are only used within the GUI, or are what the GUI
 *   sees should go in the gui file, whilst those types only used within the
 *   databases should go in the database file.
 */

import {FullyResolvedRecordID, SplitRecordID} from '../types';

export const HRID_STRING = 'hrid';

export const DEFAULT_RELATION_LINK_VOCABULARY = 'is related to';

/**
 * Generate a {FullyResolvedRecordID} from a {SplitRecordID}
 * @param {SplitRecordID} split_id the Split record identifier
 * @returns {FullyResolvedRecordID}
 */
export function resolve_record_id(
  split_id: SplitRecordID
): FullyResolvedRecordID {
  const cleaned_project_id = split_id.project_id.replace('||', '\\|\\|');
  return cleaned_project_id + '||' + split_id.record_id;
}

export function split_full_record_id(
  full_record_id: FullyResolvedRecordID
): SplitRecordID {
  const splitId = full_record_id.split('||');
  if (
    splitId.length !== 2 ||
    splitId[0].trim() === '' ||
    splitId[1].trim() === ''
  ) {
    throw Error('Not a valid full record id');
  }
  const cleaned_project_id = splitId[0].replace('\\|\\|', '||');
  return {
    project_id: cleaned_project_id,
    record_id: splitId[1],
  };
}
