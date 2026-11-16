// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: listSearch.ts
 * Description:
 *   Reads the `q` search parameter of a list GET.
 */

import {ListingSearch, parseListingSearch} from '@faims3/data-model';
import * as Exceptions from '../exceptions';

/**
 * The search a list request asks for, or `undefined` when `q` holds no word
 * and the plain list applies.
 *
 * `unavailable` is set when this request's other filters select a list that
 * has no search index (e.g. archived items); a search is then refused with a
 * 400 rather than answered with unfiltered rows.
 */
export function resolveListSearch(
  q: string | undefined,
  {unavailable}: {unavailable?: string} = {}
): ListingSearch | undefined {
  const search = parseListingSearch(q);
  if (search && unavailable) {
    throw new Exceptions.InvalidRequestException(unavailable);
  }
  return search;
}
