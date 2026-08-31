import {
  InvalidUpdatedMsQueryError,
  parseUpdatedMsQuery,
  updatedBoundsAreOrdered,
  UpdatedTimeFilter,
} from '@faims3/data-model';
import * as Exceptions from '../exceptions';

export function parseUpdatedTimeFilterFromQuery(query: {
  updatedAfter?: string;
  updatedBefore?: string;
}): UpdatedTimeFilter {
  try {
    const updatedAfter = parseUpdatedMsQuery(query.updatedAfter);
    const updatedBefore = parseUpdatedMsQuery(query.updatedBefore);
    if (!updatedBoundsAreOrdered(updatedAfter, updatedBefore)) {
      throw new Exceptions.InvalidRequestException(
        'updatedAfter must be less than updatedBefore'
      );
    }
    return {
      ...(updatedAfter !== undefined ? {updatedAfter} : {}),
      ...(updatedBefore !== undefined ? {updatedBefore} : {}),
    };
  } catch (err) {
    if (err instanceof Exceptions.InvalidRequestException) throw err;
    if (err instanceof InvalidUpdatedMsQueryError) {
      throw new Exceptions.InvalidRequestException(err.message);
    }
    throw new Exceptions.InvalidRequestException(
      'updatedAfter/updatedBefore must be an integer millisecond timestamp'
    );
  }
}
