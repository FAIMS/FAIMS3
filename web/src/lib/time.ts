/**
 * Shared timestamp helpers for the web app.
 *
 * Use {@link nowIso} / {@link dateToIso} for ISO-8601 strings (e.g. expiry selector state).
 * Use {@link nowMs} and {@link expiryMsFromNow} for Unix epoch milliseconds (tokens, invites).
 * Use {@link displayIsoTimestamp} / {@link displayUnixTimestampMs} for UI formatting.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Current time as an ISO-8601 string (UTC). */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Current time as Unix epoch milliseconds. */
export function nowMs(): number {
  return Date.now();
}

/** Unix epoch milliseconds at {@link offsetMs} from now. */
export function expiryMsFromNow(offsetMs: number): number {
  return nowMs() + offsetMs;
}

/** Calendar date (YYYY-MM-DD) in UTC derived from an ISO string. */
export function isoDateOnly(iso = nowIso()): string {
  return iso.split('T')[0];
}

/** ISO-8601 string (UTC) for a given instant. */
export function dateToIso(date: Date): string {
  return date.toISOString();
}

/** Format an ISO-8601 timestamp string for display in detail panels. */
export function displayIsoTimestamp(timestamp: string): string {
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) {
    return timestamp;
  }
  return displayUnixTimestampMs({timestamp: ms});
}

export function displayUnixTimestampMs({
  timestamp,
}: {
  timestamp: number;
}): string {
  const date = new Date(timestamp);
  // Format: Apr 2, 2025, 3:30 PM
  return (
    date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }) +
    ', ' +
    date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  );
}

/** Format dates for datetime-local input (YYYY-MM-DDTHH:MM). */
export const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/** Format date for display (DD/MM/YY HH:MM). */
export const formatDisplayDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} on ${day}/${month}/${year}`;
};

/** Whole days from now until {@link date} (ceil). */
export const getDaysDifference = (date: Date): number => {
  const diffMs = date.getTime() - nowMs();
  return Math.ceil(diffMs / DAY_MS);
};

/** {@link Date} at {@link days} whole days from now. */
export function dateDaysFromNow(days: number, from = new Date()): Date {
  return new Date(from.getTime() + days * DAY_MS);
}
