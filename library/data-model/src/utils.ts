// SPDX-License-Identifier: Apache-2.0
/** RFC 4122 v4 UUID via the Web Crypto API (Node and browsers). */
export function randomUuid(): string {
  return crypto.randomUUID();
}

/**
 * Slugify a string, replacing special characters with less special ones
 * @param str input string
 * @returns url safe version of the string
 * https://ourcodeworld.com/articles/read/255/creating-url-slugs-properly-in-javascript-including-transliteration-for-utf-8
 */
export const slugify = (str: string) => {
  str = str.trim();
  str = str.toLowerCase();

  // remove accents, swap ñ for n, etc
  const from = 'ãàáäâáº½èéëêìíïîõòóöôùúüûñç·/_,:;';
  const to = 'aaaaaeeeeeiiiiooooouuuunc------';
  for (let i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  str = str
    .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes

  return str;
};

/**
 * Max length of a CSV / GIS column name derived from `exportName`.
 *
 * Notebooks are not always authored in designer, so this is applied at
 * export time rather than assumed from stored field values.
 */
export const MAX_EXPORT_COLUMN_NAME_LENGTH = 100;

/** Used when `exportName` sanitises to empty (e.g. only quotes / controls). */
export const EMPTY_EXPORT_COLUMN_FALLBACK = 'field';

/**
 * Make a stored `exportName` safe as a CSV / GIS column (and as a KML
 * `Data` name). Does not assume designer slugify ran.
 *
 * Strips ASCII controls (CR/LF/NUL — header and CSV-row injection), path
 * separators, quotes, and other characters outside `[A-Za-z0-9._-]`. Leading
 * formula / hidden-file prefixes (`=`, `+`, `-`, `@`, `.`) are removed.
 * Designer-produced names such as `Site-Name` are unchanged.
 *
 * Not a download filename: ZIP paths and Content-Disposition still use
 * storage ids / download-filename sanitizers, not `exportName`.
 */
export function sanitizeExportColumnName(
  raw: string,
  fallback = EMPTY_EXPORT_COLUMN_FALLBACK
): string {
  const withoutControls = Array.from(raw ?? '')
    .filter(ch => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');

  let cleaned = withoutControls
    .replace(/[/\\]/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._=+\-@_]+/, '')
    .replace(/[._]+$/, '');

  if (cleaned.length > MAX_EXPORT_COLUMN_NAME_LENGTH) {
    cleaned = cleaned
      .slice(0, MAX_EXPORT_COLUMN_NAME_LENGTH)
      .replace(/[._]+$/, '');
  }

  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * {@link sanitizeExportColumnName} plus a numeric suffix when the result
 * collides with an already-used column name in this export.
 */
export function uniqueExportColumnName(
  raw: string,
  used: Set<string>,
  fallback = EMPTY_EXPORT_COLUMN_FALLBACK
): string {
  const base = sanitizeExportColumnName(raw, fallback);
  let candidate = base;
  let n = 1;
  while (used.has(candidate)) {
    const suffix = `_${n}`;
    const truncated =
      base.length + suffix.length > MAX_EXPORT_COLUMN_NAME_LENGTH
        ? base.slice(0, MAX_EXPORT_COLUMN_NAME_LENGTH - suffix.length)
        : base;
    candidate = `${truncated}${suffix}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0) return 'Invalid size';
  if (!isFinite(bytes)) return 'Invalid size';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.min(
    sizes.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k))
  );
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Finds the difference between sets A and B, i.e. the elements which are in A,
 * but not in B.
 */
export function differenceSets<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const element of setA) {
    if (!setB.has(element)) {
      result.add(element);
    }
  }
  return result;
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
