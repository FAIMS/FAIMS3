/*
 * Copyright 2026 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: recordContext.ts
 * Description:
 *   Record context injected into derived-value evaluation (templated strings
 *   and computed fields): creator, created time, and resolved parent values.
 *   Hoisted from @faims3/forms so the API's refresh pass (#2245) shares the
 *   exact evaluation the form runs on view.
 */

import {HydratedRecordDocument} from '../databaseEngine/types';
import {ValuesObject} from '../uiSpecification';
import {logWarn} from './logging';

export interface RecordContext {
  // timestamp ms created
  createdTime?: number;
  // First Last name of creator - if any
  createdBy?: string;
  // Raw field values of the parent record, if any (see resolveParentValues)
  parentValues?: ValuesObject;
}

/**
 * Converts a record into record context used in the form
 */
export function getRecordContextFromRecord({
  record,
}: {
  record: HydratedRecordDocument;
}): RecordContext {
  let time = Date.now();
  try {
    time = new Date(record.created).getTime();
  } catch (e) {
    logWarn(
      'Failed to parse time from record. Falling back to current time. Err: ',
      e
    );
  }
  return {
    createdBy: record.createdBy,
    createdTime: time,
  };
}

/**
 * Formats a timestamp into a date-time string in the format "DD-MM-YY H:MMam/pm"
 *
 * @param timestamp - Unix timestamp in milliseconds (e.g., from Date.now())
 * @param timezone - Optional IANA timezone; defaults to the system timezone.
 *   Note the default makes output environment-dependent: two devices (or a
 *   server) in different timezones render different strings.
 * @returns Formatted date-time string or empty string if input is invalid
 *
 * @throws Never - Returns empty string for all error cases
 */
export function formatTimestamp(
  timestamp: string | number | null | undefined,
  timezone: string | undefined = undefined
): string {
  if (timestamp === null || timestamp === undefined) {
    return '';
  }

  const timestampNum =
    typeof timestamp === 'string' ? Number(timestamp) : timestamp;

  if (isNaN(timestampNum) || !isFinite(timestampNum)) {
    return '';
  }

  try {
    const date = new Date(timestampNum);

    if (timezone) {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      };

      const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(
        date
      );
      const dateParts = parts.reduce(
        (acc, part) => {
          acc[part.type] = part.value;
          return acc;
        },
        {} as {[key: string]: string}
      );

      const day = dateParts.day.padStart(2, '0');
      const month = dateParts.month.padStart(2, '0');
      const year = dateParts.year.slice(-2);

      let hours = parseInt(dateParts.hour);
      if (dateParts.dayPeriod === 'PM' && hours !== 12) hours += 12;
      if (dateParts.dayPeriod === 'AM' && hours === 12) hours = 0;

      hours = hours % 12 || 12;
      const minutes = dateParts.minute.padStart(2, '0');
      const ampm = dateParts.dayPeriod.toLowerCase();

      return `${day}-${month}-${year} ${hours}:${minutes}${ampm}`;
    }

    // Default behaviour using local timezone
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';

    hours = hours % 12;
    hours = hours || 12;

    return `${day}-${month}-${year} ${hours}:${minutes}${ampm}`;
  } catch (error) {
    return '';
  }
}

// System variables injectable into templates.
export const CREATOR_NAME_ID = '_CREATOR_NAME';
export const CREATED_TIME_ID = '_CREATED_TIME';

/**
 * Converts the RecordContext into an object mapping from key -> value for use
 * in template replacement
 */
export function contextToTemplate(context: RecordContext): ValuesObject {
  const vals: ValuesObject = {};
  vals[CREATOR_NAME_ID] = context.createdBy ?? 'Unknown User';
  vals[CREATED_TIME_ID] = context.createdTime
    ? formatTimestamp(context.createdTime)
    : 'Unknown Time';
  return vals;
}
