import type { UiSpecification } from '../types';
import { captureFieldPreview } from './captureFieldPreview';
import { collectFieldsInOrder } from './collectFieldsInOrder';
import { isFieldPreviewSupported } from './fieldPreviewSupport';
import type { FieldPreviewResult } from './fieldPreviewTypes';

export type FieldPreviewProgress = (completed: number, total: number) => void;

/** Capture preview screenshots for every field in survey order. */
export async function captureAllFieldPreviews(
  spec: UiSpecification,
  onProgress?: FieldPreviewProgress
): Promise<Map<string, FieldPreviewResult>> {
  const fields = collectFieldsInOrder(spec);
  const previews = new Map<string, FieldPreviewResult>();
  const total = fields.length;

  for (let i = 0; i < fields.length; i++) {
    const { fieldName, field } = fields[i];

    if (!isFieldPreviewSupported(field)) {
      previews.set(fieldName, { status: 'unavailable' });
    } else {
      const capture = await captureFieldPreview(fieldName, field);
      previews.set(
        fieldName,
        capture ? { status: 'image', capture } : { status: 'unavailable' }
      );
    }

    onProgress?.(i + 1, total);
  }

  return previews;
}
