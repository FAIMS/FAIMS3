// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod';

/**
 * Central, sensible upper bounds for user-supplied input.
 *
 * These are shared across the API (zod request schemas), the Control Centre
 * (web form schemas + HTML maxLength) and the data collection app / forms
 * library. They exist to stop maliciously long inputs from being accepted,
 * not to constrain legitimate use — so each is deliberately generous.
 *
 * Server-side JSON and restore upload sizes are configured via environment
 * variables in `api/src/buildconfig.ts`. Map-layer upload size is a shared
 * constant here so the Control Centre and API stay aligned. Other browser
 * file-size limits live in `web/src/constants.ts`. The character limits here
 * are the shared contract between client and server validation.
 */
export const INPUT_LIMITS = {
  /** Email addresses (RFC 5321 caps the path at 254 octets). */
  EMAIL_MAX_LENGTH: 254,
  /** Passwords — bounded so hashing/zxcvbn cannot be fed megabyte strings. */
  PASSWORD_MAX_LENGTH: 128,
  /** Human display names (people). */
  PERSON_NAME_MAX_LENGTH: 100,
  /** Names of projects/notebooks, templates, teams and map layers. */
  RESOURCE_NAME_MIN_LENGTH: 5,
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
  /**
   * Combined size of a map-layer upload (primary file plus companions).
   * Bytes go to object storage, not CouchDB attachments.
   */
  MAP_ASSET_UPLOAD_MAX_BYTES: 2 * 1024 * 1024 * 1024, // 2 GiB
  /**
   * Combined uncompressed size of a map-layer zip on the spatial worker.
   * Four times the compressed upload cap leaves room for a File Geodatabase
   * while blocking zip bombs.
   */
  MAP_ASSET_EXTRACT_MAX_BYTES: 8 * 1024 * 1024 * 1024, // 8 GiB
  /** Maximum files in one map-layer upload (primary plus companions). */
  MAP_ASSET_UPLOAD_MAX_FILES: 8,
  /** Maximum entries accepted in the record sync-status map. */
  RECORD_MAP_MAX_ENTRIES: 10000,
} as const;

/** User-facing size for {@link INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_BYTES}. */
export function mapAssetUploadMaxLabel(): string {
  const gb = INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_BYTES / (1024 * 1024 * 1024);
  return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
}

/** Validation message when a map-layer upload exceeds the shared size cap. */
export function mapAssetUploadTooLargeMessage(): string {
  return `Files must be at most ${mapAssetUploadMaxLabel()}.`;
}

/** User-facing size for {@link INPUT_LIMITS.MAP_ASSET_EXTRACT_MAX_BYTES}. */
export function mapAssetExtractMaxLabel(): string {
  const gb = INPUT_LIMITS.MAP_ASSET_EXTRACT_MAX_BYTES / (1024 * 1024 * 1024);
  return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
}

/** Validation message when a zip would unpack larger than the extract cap. */
export function mapAssetExtractTooLargeMessage(): string {
  return `Unzipped map layer must be at most ${mapAssetExtractMaxLabel()}.`;
}

/**
 * Shown when the API rejects a map-layer upload because this node does not
 * have enough free disk for the original plus a copy while it uploads to
 * object storage. GDAL scratch lives on the spatial worker.
 */
export const MAP_ASSET_UPLOAD_BUSY_MESSAGE =
  'The server is busy right now, please try again later. If this continues, please seek support via your system administrator.';

/**
 * Free bytes that must remain on the upload filesystem before a stream is
 * accepted. Three times the upload cap covers the original plus a copy
 * while it streams to object storage. GDAL scratch lives on the spatial worker.
 */
export const MAP_ASSET_UPLOAD_FREE_DISK_BYTES =
  INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_BYTES * 3;

/** Bounded trimmed string builder for zod request schemas. */
export const boundedString = (max: number, label = 'Value') =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`);

/**
 * Name of a project/notebook, template, team or map layer. Bounded at both
 * ends so the same min/max applies on every route that creates or edits a
 * resource name.
 */
export const resourceNameString = (label = 'Name') =>
  z
    .string()
    .trim()
    .min(
      INPUT_LIMITS.RESOURCE_NAME_MIN_LENGTH,
      `${label} must be at least ${INPUT_LIMITS.RESOURCE_NAME_MIN_LENGTH} characters`
    )
    .max(
      INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH,
      `${label} must be at most ${INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH} characters`
    );

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
