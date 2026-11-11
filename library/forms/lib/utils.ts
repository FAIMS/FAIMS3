// SPDX-License-Identifier: Apache-2.0
import {ExprValue, formDataToValues} from '@faims3/data-model';
import {FaimsForm, FaimsFormData} from './formModule/types';

/** Pulls data out of faims form data */
export function formDataExtractor({
  fullData,
}: {
  fullData: FaimsFormData;
}): Record<string, unknown> {
  return formDataToValues(fullData);
}

/**
 * Writes a derived-field pass's results into form state, keeping the entry it
 * overwrites so an annotation or attachment survives.
 *
 * @param form The tanstack form
 * @param updates New values keyed by field name, as a recompute returns them
 * @param runListeners Whether tanstack should fire listeners for the update
 */
export function writeFieldUpdates({
  form,
  updates,
  runListeners,
}: {
  form: FaimsForm;
  updates: Record<string, ExprValue | null>;
  runListeners: boolean;
}): void {
  for (const [field, value] of Object.entries(updates)) {
    form.setFieldValue(
      field,
      {...(form.state.values[field] ?? {}), data: value},
      {dontRunListeners: !runListeners}
    );
  }
}

/**
 * Raster image content types the app is willing to render as an `<img>`.
 *
 * Deliberately excludes `image/svg+xml`: SVG can carry script and event
 * handlers, so a stored SVG attachment must never be rendered as an image.
 * Anything not in this list is shown as a generic file (icon + filename).
 */
export const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/bmp',
];

/**
 * Normalises a declared content type for comparison: lower-case, trimmed,
 * with any `;charset=…` style parameters removed. Non-string input becomes
 * the empty string so callers fail closed.
 */
export function normaliseContentType(
  contentType: string | null | undefined
): string {
  if (typeof contentType !== 'string') return '';
  const semicolon = contentType.indexOf(';');
  const bare = semicolon === -1 ? contentType : contentType.slice(0, semicolon);
  return bare.trim().toLowerCase();
}

/**
 * Whether an attachment with this declared content type may be rendered as an
 * image (`<img>`, thumbnail, lightbox). This is the single classifier for all
 * attachment display decisions; it is an exact match against
 * {@link IMAGE_TYPES} after normalisation and fails closed for anything else
 * (SVG, HTML, missing or malformed types).
 */
export function isDisplayableImageType(
  contentType: string | null | undefined
): boolean {
  return IMAGE_TYPES.includes(normaliseContentType(contentType));
}

// ============================================================================
// Attachment upload blocking (active content: SVG / HTML)
// ============================================================================

/**
 * Declared content types that may never be stored as record attachments.
 *
 * These are "active" document types a browser will execute script from when
 * served or rendered. Blocklist (not allowlist) on purpose: FileUploader is a
 * generic file field and PDFs, CSVs, ZIPs, audio etc. remain legitimate.
 *
 * KEEP IN SYNC with the CouchDB-side list in the `validate_doc_update`
 * function of `permissionsDocument` in
 * `library/data-model/src/data_storage/dataDB/design.ts`. That function is
 * `toString()`-ed and shipped to CouchDB, so it cannot import this constant;
 * the two lists are maintained by hand.
 */
export const BLOCKED_ATTACHMENT_CONTENT_TYPES = [
  'image/svg+xml',
  'image/svg',
  'text/html',
  'application/xhtml+xml',
  'application/x-html',
  'text/xhtml',
];

/**
 * Whether a declared content type is blocked for attachment storage. The type
 * is normalised first (case, whitespace, `;parameters`).
 */
export function isBlockedAttachmentContentType(
  contentType: string | null | undefined
): boolean {
  return BLOCKED_ATTACHMENT_CONTENT_TYPES.includes(
    normaliseContentType(contentType)
  );
}

/**
 * File extensions (lower-case, no dot) blocked regardless of declared type.
 * Covers pickers that report an empty or `application/octet-stream` type.
 */
export const BLOCKED_ATTACHMENT_EXTENSIONS = [
  'svg',
  'svgz',
  'html',
  'htm',
  'xhtml',
  'shtml',
];

/** Whether a file name carries a blocked extension (case-insensitive). */
export function isBlockedAttachmentFilename(
  filename: string | null | undefined
): boolean {
  if (typeof filename !== 'string') return false;
  const dot = filename.lastIndexOf('.');
  if (dot === -1 || dot === filename.length - 1) return false;
  return BLOCKED_ATTACHMENT_EXTENSIONS.includes(
    filename
      .slice(dot + 1)
      .trim()
      .toLowerCase()
  );
}

/**
 * Number of leading bytes inspected by {@link isActiveContentBytes}. This is
 * a hard cap: the sniff never reads more of a file than this.
 */
export const ACTIVE_CONTENT_SNIFF_BYTES = 512;

/**
 * Pure leading-byte sniff for SVG / HTML documents. Operates on at most
 * {@link ACTIVE_CONTENT_SNIFF_BYTES} bytes, does no XML/DOM parsing and never
 * decodes an image.
 *
 * After stripping a UTF-8 BOM, leading whitespace and leading comments, and
 * lower-casing, the sample is treated as active content when it:
 * - starts with `<svg`, `<html`, `<!doctype html` or `<!doctype svg`, or
 * - starts with `<?xml` / `<!doctype` and contains `<svg` or `<html` within
 *   the sample.
 *
 * A bare `<?xml …?>` prolog (GPX, KML, plain XML data) is NOT active content.
 *
 * Known limit (by design): polyglots (valid JPEG with script appended) and
 * markup that only appears after the sample window are not detected here.
 * Those are covered by the rendering strip (never rendered as an image) and,
 * for honestly-labelled types, by the CouchDB validator.
 */
export function isActiveContentBytes(bytes: Uint8Array): boolean {
  const sample =
    bytes.length > ACTIVE_CONTENT_SNIFF_BYTES
      ? bytes.subarray(0, ACTIVE_CONTENT_SNIFF_BYTES)
      : bytes;
  // Lossy decode is fine: we only look for ASCII markup tokens.
  let text = new TextDecoder('utf-8').decode(sample);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = text.replace(/^\s+/, '').toLowerCase();

  // Skip leading comments (`<!-- … -->`) that could hide the root element.
  while (text.startsWith('<!--')) {
    const end = text.indexOf('-->');
    if (end === -1) return false;
    text = text.slice(end + 3).replace(/^\s+/, '');
  }

  if (
    text.startsWith('<svg') ||
    text.startsWith('<html') ||
    text.startsWith('<!doctype html') ||
    text.startsWith('<!doctype svg')
  ) {
    return true;
  }

  if (text.startsWith('<?xml') || text.startsWith('<!doctype')) {
    return text.includes('<svg') || text.includes('<html');
  }

  return false;
}

/**
 * Reads at most the first {@link ACTIVE_CONTENT_SNIFF_BYTES} bytes of a blob.
 * Exactly one slice read per call; the full file is never loaded.
 */
async function readLeadingBytes(blob: Blob): Promise<Uint8Array> {
  const head = blob.slice(0, ACTIVE_CONTENT_SNIFF_BYTES);
  if (typeof head.arrayBuffer === 'function') {
    return new Uint8Array(await head.arrayBuffer());
  }
  // Older WebViews: FileReader over the (tiny) slice only.
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(head);
  });
}

/**
 * Async wrapper over {@link isActiveContentBytes} for a `File`/`Blob`.
 */
export async function fileHasActiveContent(blob: Blob): Promise<boolean> {
  return isActiveContentBytes(await readLeadingBytes(blob));
}

/**
 * Synchronous half of the upload check: declared MIME type and filename
 * extension. Used to reject a batch before any bytes are read.
 */
export function hasBlockedAttachmentMetadata(file: {
  type?: string;
  name?: string;
}): boolean {
  return (
    isBlockedAttachmentContentType(file.type) ||
    isBlockedAttachmentFilename(file.name)
  );
}

/**
 * Whether a Capacitor-style format string (`jpeg`, `png`, `svg+xml`) or a
 * full MIME type names a blocked attachment. Covers gallery picks that
 * report a format instead of a filename.
 */
export function isBlockedAttachmentFormat(
  format: string | null | undefined
): boolean {
  if (typeof format !== 'string') return false;
  const normalised = format.trim().toLowerCase();
  if (!normalised) return false;
  return (
    isBlockedAttachmentContentType(normalised) ||
    isBlockedAttachmentContentType(`image/${normalised}`) ||
    isBlockedAttachmentFilename(`file.${normalised}`)
  );
}

/**
 * Full client-side upload check for a blob that may not be a `File`
 * (camera / gallery picks). Same three signals as
 * {@link isBlockedAttachmentFile}: declared type, filename/format, and
 * leading-byte sniff.
 *
 * Sniff **before** any canvas re-encode: browsers can decode SVG into a
 * bitmap, which would turn a blocked file into a JPEG and sneak it through.
 */
export async function isBlockedAttachmentSource({
  blob,
  filename,
  format,
}: {
  blob: Blob;
  filename?: string | null;
  format?: string | null;
}): Promise<boolean> {
  return (
    isBlockedAttachmentContentType(blob.type) ||
    isBlockedAttachmentFilename(filename) ||
    isBlockedAttachmentFormat(format) ||
    (await fileHasActiveContent(blob))
  );
}

/**
 * Full client-side upload check for one file: declared type, extension and
 * leading-byte sniff. Returns true if the file must be rejected.
 */
export async function isBlockedAttachmentFile(file: File): Promise<boolean> {
  return isBlockedAttachmentSource({blob: file, filename: file.name});
}

/** User-facing message for a rejected upload batch. */
export function blockedAttachmentMessage(filename: string): string {
  return `"${filename}": SVG and HTML files cannot be uploaded.`;
}
