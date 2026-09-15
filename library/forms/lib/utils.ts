import {formDataToValues} from '@faims3/data-model';
import {FaimsFormData} from './formModule/types';

/** Pulls data out of faims form data */
export function formDataExtractor({
  fullData,
}: {
  fullData: FaimsFormData;
}): Record<string, unknown> {
  return formDataToValues(fullData);
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
