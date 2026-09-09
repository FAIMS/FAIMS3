/**
 * Shared invite-code format constants.
 *
 * Invite document IDs are `{prefix}-{code}` where `code` is generated with
 * nanoid (`customAlphabet`) on the API. Links/QR codes are the primary share
 * path; the code itself is an advanced/manual-entry fallback.
 *
 * Alphabet excludes `-` and `_` so the prefix separator remains unambiguous.
 * Length 16 from a 62-char alphabet yields ~95 bits of entropy — not practical
 * to brute-force. Legacy invites used 6 characters from a smaller alphabet and
 * remain valid when redeemed.
 */

/** Characters used when generating new invite codes (URL-safe, no dash). */
export const INVITE_CODE_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Length of the random body (excluding `{prefix}-`). */
export const INVITE_CODE_LENGTH = 16;

/**
 * Minimum accepted body length when a user types/pastes a code.
 * Allows redeeming legacy 6-character invites.
 */
export const INVITE_CODE_MIN_LENGTH = 6;

/** Maximum accepted body length when a user types/pastes a code. */
export const INVITE_CODE_MAX_LENGTH = 64;

/** Regex matching a valid invite-code body (no prefix). */
export const INVITE_CODE_BODY_PATTERN = new RegExp(
  `^[${INVITE_CODE_ALPHABET}]+$`
);

/** Milliseconds in one day. */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Default lifetime for newly created invites. */
export const DEFAULT_INVITE_EXPIRY_DAYS = 5;

/** Hard cap on invite lifetime (API + UI). */
export const MAX_INVITE_EXPIRY_DAYS = 90;

/** Quick-select chips for the invite expiry UI (all ≤ max). */
export const INVITE_EXPIRY_HINT_DAYS = [1, 5, 10, 30, 90] as const;

export const DEFAULT_INVITE_EXPIRY_MS = DEFAULT_INVITE_EXPIRY_DAYS * MS_PER_DAY;

export const MAX_INVITE_EXPIRY_MS = MAX_INVITE_EXPIRY_DAYS * MS_PER_DAY;

/**
 * Client/server clock skew allowed when checking the max lifetime, so a
 * client sending "exactly 90 days from now" is not rejected.
 */
export const INVITE_EXPIRY_CLOCK_SKEW_MS = 2 * 60 * 1000;

/** True when {@link expiryMs} is no further than the max invite lifetime. */
export function isInviteExpiryWithinMax(
  expiryMs: number,
  nowMs = Date.now()
): boolean {
  return expiryMs <= nowMs + MAX_INVITE_EXPIRY_MS + INVITE_EXPIRY_CLOCK_SKEW_MS;
}

/**
 * True when {@link expiryMs} is a valid create-time expiry: in the future and
 * within the max lifetime.
 */
export function isInviteExpiryValidForCreate(
  expiryMs: number,
  nowMs = Date.now()
): boolean {
  return expiryMs > nowMs && isInviteExpiryWithinMax(expiryMs, nowMs);
}
