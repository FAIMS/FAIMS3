import {FaimsFormData} from './formModule/types';

/** Pulls data out of faims form data */
export function formDataExtractor({
  fullData,
}: {
  fullData: FaimsFormData;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fullData ?? {})) {
    out[k] = v.data;
  }
  return out;
}

export const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/bmp',
];
