import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import type { FieldSpec } from '../types';
import { FieldPreviewHost } from './FieldPreviewHost';
import { buildSingleFieldUiSpec } from './singleFieldSpec';

const CAPTURE_WIDTH = 560;
const RENDER_SETTLE_MS = 400;
const MAP_SETTLE_MS = 1500;

export type FieldPreviewCapture = {
  data: Uint8Array;
  width: number;
  height: number;
};

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load preview image'));
    img.src = dataUrl;
  });
}

/** Render one field off-screen and return a PNG suitable for embedding in Word. */
export async function captureFieldPreview(
  fieldName: string,
  field: FieldSpec
): Promise<FieldPreviewCapture | null> {
  const container = document.createElement('div');
  container.style.cssText = `position:fixed;left:-12000px;top:0;width:${CAPTURE_WIDTH}px;pointer-events:none;opacity:1;`;
  document.body.appendChild(container);

  const root = createRoot(container);
  const uiSpec = buildSingleFieldUiSpec(fieldName, field);
  const isMap = field['component-name'] === 'MapFormField';

  try {
    await new Promise<void>(resolve => {
      root.render(<FieldPreviewHost uiSpec={uiSpec} onReady={() => resolve()} />);
    });
    await new Promise(r => setTimeout(r, isMap ? MAP_SETTLE_MS : RENDER_SETTLE_MS));

    const fieldElement = container.querySelector(
      `#${CSS.escape(`field-${fieldName}`)}`
    ) as HTMLElement | null;
    const target = fieldElement ?? (container.querySelector('[data-field-preview-root]') as HTMLElement | null);
    if (!target) return null;

    const dataUrl = await toPng(target, {
      pixelRatio: 1,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });
    const { width, height } = await loadImageDimensions(dataUrl);
    return { data: dataUrlToUint8Array(dataUrl), width, height };
  } catch {
    return null;
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
