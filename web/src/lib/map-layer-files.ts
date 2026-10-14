// SPDX-License-Identifier: Apache-2.0
import {
  INPUT_LIMITS,
  MAP_ASSET_PRIMARY_FORMATS,
  mapAssetUploadTooLargeMessage,
  readGeoreferencedPdfRaster,
  type PdfRasterSize,
} from '@faims3/data-model';
import {z} from 'zod';

const PRIMARY_EXTENSIONS = new Set([
  '.geojson',
  '.json',
  '.gpkg',
  '.zip',
  '.kml',
  '.tif',
  '.tiff',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
]);

const WORLD_FILE_EXTENSIONS = new Set([
  '.pgw',
  '.gfw',
  '.jgw',
  '.wld',
  '.tfw',
  '.j2w',
]);

const ALLOWED_EXTENSIONS = new Set([
  ...PRIMARY_EXTENSIONS,
  ...WORLD_FILE_EXTENSIONS,
  '.prj',
]);

export const MAP_LAYER_FILE_ACCEPT = [...ALLOWED_EXTENSIONS].join(',');

export function primaryMapLayerFile(files: File[]): File | undefined {
  return files.find(file => PRIMARY_EXTENSIONS.has(extensionOf(file.name)));
}

const pdfRasterCache = new WeakMap<File, Promise<PdfRasterSize | undefined>>();

function pdfRasterSize(file: File): Promise<PdfRasterSize | undefined> {
  const cached = pdfRasterCache.get(file);
  if (cached) {
    return cached;
  }
  const pending = file
    .arrayBuffer()
    .then(buffer => readGeoreferencedPdfRaster(new Uint8Array(buffer)))
    .catch(() => undefined);
  pdfRasterCache.set(file, pending);
  return pending;
}

export async function mapLayerEstimateSource(
  files: File[]
): Promise<
  | {filename: string; byteSize: number; widthPx?: number; heightPx?: number}
  | undefined
> {
  const primary = primaryMapLayerFile(files);
  if (!primary) {
    return undefined;
  }
  const source: {
    filename: string;
    byteSize: number;
    widthPx?: number;
    heightPx?: number;
  } = {
    filename: primary.name,
    byteSize: primary.size,
  };
  const ext = extensionOf(primary.name);
  if (ext === '.pdf') {
    const raster = await pdfRasterSize(primary);
    if (raster) {
      source.widthPx = raster.widthPx;
      source.heightPx = raster.heightPx;
    }
  } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    try {
      const bitmap = await createImageBitmap(primary);
      source.widthPx = bitmap.width;
      source.heightPx = bitmap.height;
      bitmap.close();
    } catch {
      // Geo-placement still works; the estimate just lacks pixel size.
    }
  }
  return source;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

/**
 * One or more upload files. PNG and JPEG must include a world file and a
 * `.prj`. Other primaries carry their CRS inside the file.
 */
export function mapLayerFilesSchema() {
  return z.array(z.instanceof(File)).superRefine((files, ctx) => {
    if (files.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a map file.',
      });
      return;
    }
    if (files.length > INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES) {
      ctx.addIssue({
        code: 'custom',
        message: `Choose at most ${INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES} files.`,
      });
      return;
    }
    const extensions = files.map(file => extensionOf(file.name));
    const unsupported = extensions.find(ext => !ALLOWED_EXTENSIONS.has(ext));
    if (unsupported) {
      ctx.addIssue({
        code: 'custom',
        message: `Unsupported file type ${unsupported || '(none)'}.`,
      });
      return;
    }
    const primary = extensions.find(ext => PRIMARY_EXTENSIONS.has(ext));
    if (!primary) {
      ctx.addIssue({
        code: 'custom',
        message: `Include ${MAP_ASSET_PRIMARY_FORMATS}.`,
      });
      return;
    }
    if (primary === '.png' || primary === '.jpg' || primary === '.jpeg') {
      const hasWorld = extensions.some(ext => WORLD_FILE_EXTENSIONS.has(ext));
      if (!hasWorld || !extensions.includes('.prj')) {
        ctx.addIssue({
          code: 'custom',
          message: 'PNG and JPEG need a world file and a .prj.',
        });
      }
    }
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_BYTES) {
      ctx.addIssue({
        code: 'custom',
        message: mapAssetUploadTooLargeMessage(),
      });
    }
  });
}
