// SPDX-License-Identifier: Apache-2.0
/**
 * Download progress for the map-layer Preview tab and its tab trigger.
 */

import {
  mapAssetPreviewPercent,
  type MapAssetPreviewState,
} from '@/lib/map-asset-preview-cache';
import {formatFileSize} from '@faims3/data-model';

/** Compact percent on the Preview tab trigger while bytes are arriving. */
export function MapLayerPreviewTabProgress({
  download,
}: {
  download: MapAssetPreviewState;
}) {
  if (download.status !== 'downloading') {
    return null;
  }
  const percent = mapAssetPreviewPercent(download);
  return (
    <span
      className="text-xs font-normal text-muted-foreground"
      data-testid="web-map-layer-preview-tab-progress"
    >
      {percent === undefined ? '…' : `${percent}%`}
    </span>
  );
}

/** Size, bar, and transferred bytes so the wait is not a blank spinner. */
export function MapLayerPreviewProgress({
  download,
}: {
  download: MapAssetPreviewState;
}) {
  const percent = mapAssetPreviewPercent(download) ?? 0;
  const totalLabel =
    download.totalBytes > 0 ? formatFileSize(download.totalBytes) : undefined;
  const receivedLabel = formatFileSize(download.receivedBytes);
  const heading =
    download.status === 'ready' || download.fromCache
      ? 'Opening preview'
      : download.receivedBytes > 0
        ? 'Downloading preview'
        : 'Preparing preview';
  const detail = download.fromCache
    ? totalLabel
      ? `Using the ${totalLabel} copy already stored in this browser.`
      : 'Using the copy already stored in this browser.'
    : totalLabel
      ? `This layer is ${totalLabel}. The file is downloaded once and reused when you return to this tab.`
      : 'The layer file is downloaded once and reused when you return to this tab.';

  return (
    <div
      className="flex flex-col gap-3 rounded-md border p-4"
      data-testid="web-map-layer-preview-progress"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">{heading}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      {download.fromCache ? null : (
        <div className="flex flex-col gap-1.5">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Preview download"
          >
            {percent === 0 && download.status !== 'ready' ? (
              <div className="h-full w-1/3 animate-pulse bg-primary" />
            ) : (
              <div
                className="h-full bg-primary transition-[width]"
                style={{width: `${percent}%`}}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {totalLabel
              ? `${receivedLabel} of ${totalLabel} (${percent}%)`
              : download.receivedBytes > 0
                ? `${receivedLabel} downloaded`
                : 'Starting download…'}
          </p>
        </div>
      )}
    </div>
  );
}
