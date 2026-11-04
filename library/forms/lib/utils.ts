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
