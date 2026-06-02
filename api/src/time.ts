/**
 * Shared timestamp helpers for the API.
 *
 * Use {@link nowIso} for ISO-8601 document fields (e.g. template/notebook `updatedAt`).
 * Use {@link nowMs} and {@link expiryMsFromNow} for Unix epoch milliseconds (tokens, teams).
 */

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

/** Calendar date (YYYY-MM-DD) in UTC derived from {@link nowIso}. */
export function isoDateOnly(iso = nowIso()): string {
  return iso.split('T')[0];
}
