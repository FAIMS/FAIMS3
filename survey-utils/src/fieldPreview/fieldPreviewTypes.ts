import type { FieldPreviewCapture } from './captureFieldPreview';

export type FieldPreviewResult =
  | { status: 'image'; capture: FieldPreviewCapture }
  | { status: 'unavailable' };
