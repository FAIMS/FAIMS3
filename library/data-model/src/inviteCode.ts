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
