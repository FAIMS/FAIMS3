import {z} from 'zod';

/**
 * Central, sensible upper bounds for user-supplied input.
 *
 * These are shared across the API (zod request schemas), the Control Centre
 * (web form schemas + HTML maxLength) and the data collection app / forms
 * library. They exist to stop maliciously long inputs from being accepted,
 * not to constrain legitimate use — so each is deliberately generous.
 *
 * Server-side byte limits (JSON body size, upload size) are configured via
 * environment variables in `api/src/buildconfig.ts`; browser-side file size
 * limits are configured in `web/src/constants.ts`. The character limits here
 * are the shared contract between client and server validation.
 */
export const INPUT_LIMITS = {
  /** Email addresses (RFC 5321 caps the path at 254 octets). */
  EMAIL_MAX_LENGTH: 254,
  /** Passwords — bounded so hashing/zxcvbn cannot be fed megabyte strings. */
  PASSWORD_MAX_LENGTH: 128,
  /** Human display names (people). */
  PERSON_NAME_MAX_LENGTH: 100,
  /** Names of projects/notebooks, templates and teams. */
  RESOURCE_NAME_MAX_LENGTH: 100,
  /** Team descriptions (root project/template descriptions are capped separately at 250). */
  TEAM_DESCRIPTION_MAX_LENGTH: 500,
  /** Invite display names. */
  INVITE_NAME_MAX_LENGTH: 100,
  /** Maximum number of uses for a single invite. */
  INVITE_MAX_USES: 10000,
  /** Identifiers (usernames, project/template/team ids, record ids, form ids...). */
  ID_MAX_LENGTH: 256,
  /** Opaque tokens (JWTs, refresh/exchange tokens). JWTs with roles can be large. */
  TOKEN_MAX_LENGTH: 16384,
  /** One-time codes (email verification, password reset). Server generates 10 chars. */
  CODE_MAX_LENGTH: 256,
  /** Post-auth redirect URLs (practical browser URL limit). */
  REDIRECT_URL_MAX_LENGTH: 2048,
  /** Generic short free-text (e.g. confirm-name fields, search inputs). */
  SHORT_TEXT_MAX_LENGTH: 1000,
  /** Generic long free-text (annotations, UGC reports, record text fields). */
  LONG_TEXT_MAX_LENGTH: 10000,
  /** Serialized size cap for a notebook/template ui-specification (design file). */
  UI_SPEC_MAX_BYTES: 10 * 1024 * 1024, // 10 MiB
  /** Maximum entries accepted in the record sync-status map. */
  RECORD_MAP_MAX_ENTRIES: 10000,
} as const;

/** Bounded trimmed string builder for zod request schemas. */
export const boundedString = (max: number, label = 'Value') =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`);

/** Email input: valid format and bounded length. */
export const EmailInputSchema = z
  .string()
  .trim()
  .max(INPUT_LIMITS.EMAIL_MAX_LENGTH, 'Email address is too long')
  .email('Must be a valid email address');

/** Password input: bounded only (strength/min-length policies applied separately). */
export const PasswordInputSchema = z
  .string()
  .trim()
  .max(INPUT_LIMITS.PASSWORD_MAX_LENGTH, 'Password is too long');

/** Redirect URL input (whitelisting is enforced server-side separately). */
export const RedirectInputSchema = boundedString(
  INPUT_LIMITS.REDIRECT_URL_MAX_LENGTH,
  'Redirect URL'
);

/** Opaque token input (JWTs, refresh/exchange/long-lived tokens). */
export const TokenInputSchema = z
  .string()
  .max(INPUT_LIMITS.TOKEN_MAX_LENGTH, 'Token is too long');

/** One-time code input (verification / password reset codes). */
export const CodeInputSchema = boundedString(
  INPUT_LIMITS.CODE_MAX_LENGTH,
  'Code'
);

/** Identifier input (usernames, resource ids). */
export const IdInputSchema = boundedString(
  INPUT_LIMITS.ID_MAX_LENGTH,
  'Identifier'
);

/**
 * Estimate the serialized JSON size of a value in bytes. Used to reject
 * oversized design files (ui-specifications) at the API boundary.
 *
 * Fail-closed: if the value cannot be serialized, returns a size larger than
 * {@link INPUT_LIMITS.UI_SPEC_MAX_BYTES} so callers that compare against the
 * cap will reject rather than accept.
 */
export function estimateJsonBytes(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return 0;
    // Buffer is not available in the browser; use TextEncoder-compatible
    // approximation. String.length undercounts multibyte characters, so use
    // encodeURIComponent-based byte counting only when needed for accuracy.
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(serialized).length;
    }
    return Buffer.byteLength(serialized, 'utf8');
  } catch {
    // Fail closed — treat non-serializable input as oversized
    return INPUT_LIMITS.UI_SPEC_MAX_BYTES + 1;
  }
}
