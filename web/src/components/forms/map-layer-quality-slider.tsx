// SPDX-License-Identifier: Apache-2.0
import {useRequiredUser} from '@/hooks/auth-hooks';
import {estimateMapAsset} from '@/hooks/map-asset-hooks';
import {
  mapLayerEstimateSource,
  primaryMapLayerFile,
} from '@/lib/map-layer-files';
import {
  MAP_ASSET_QUALITY_MAX,
  MAP_ASSET_QUALITY_MIN,
  mapAssetNormalizeOptionsFromQuality,
  type PostMapAssetEstimateResponse,
} from '@faims3/data-model';
import {useEffect, useState} from 'react';

function imageLimitPhrase(quality: number, edgePx: number): string {
  if (quality >= MAP_ASSET_QUALITY_MAX) {
    return 'Original resolution';
  }
  return `Image tiles up to ${edgePx} px`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MapLayerQualitySlider({
  quality,
  onQualityChange,
  files,
}: {
  quality: number;
  onQualityChange: (quality: number) => void;
  files: File[];
}) {
  const user = useRequiredUser();
  const [estimate, setEstimate] = useState<PostMapAssetEstimateResponse | null>(
    null
  );
  const [estimateError, setEstimateError] = useState<string | undefined>();
  const fallback = mapAssetNormalizeOptionsFromQuality(quality);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        const source = await mapLayerEstimateSource(files);
        if (!source) {
          if (!cancelled) {
            setEstimate(null);
            setEstimateError(undefined);
          }
          return;
        }
        try {
          const next = await estimateMapAsset({
            user,
            input: {source, quality},
          });
          if (!cancelled) {
            setEstimate(next);
            setEstimateError(undefined);
          }
        } catch (error) {
          if (!cancelled) {
            setEstimate(null);
            setEstimateError(
              error instanceof Error
                ? error.message
                : 'Could not estimate the device size.'
            );
          }
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [files, quality, user]);

  const options = estimate?.options ?? fallback;

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor="map-layer-quality"
          className="text-sm font-medium leading-none"
        >
          Device quality
        </label>
        <span className="text-xs text-muted-foreground">{quality}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Lower quality settings require less storage space on devices, and may
        reduce the device load.
      </p>
      <input
        id="map-layer-quality"
        type="range"
        min={MAP_ASSET_QUALITY_MIN}
        max={MAP_ASSET_QUALITY_MAX}
        step={1}
        value={quality}
        onChange={event => onQualityChange(Number(event.target.value))}
        className="w-full accent-primary"
        data-testid="web-map-layers-quality"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Smaller / faster</span>
        <span>More detail</span>
      </div>
      <p className="text-sm" data-testid="web-map-layers-quality-preview">
        {estimate
          ? estimate.summary
          : !primaryMapLayerFile(files)
            ? `${imageLimitPhrase(quality, options.maxRasterEdgePx)} · vector tiles`
            : estimateError
              ? estimateError
              : `Estimating… · ${imageLimitPhrase(quality, options.maxRasterEdgePx)} · vector tiles`}
      </p>
      {estimate ? (
        <p className="text-xs text-muted-foreground">
          {estimate.summary.startsWith('Original resolution')
            ? `Keeps the original pixels. About ${formatBytes(estimate.estimatedByteSize)} on devices, from a ${formatBytes(estimate.originalByteSize)} upload.`
            : `Original upload ${formatBytes(estimate.originalByteSize)} → about ${formatBytes(estimate.estimatedByteSize)} after processing.`}
        </p>
      ) : null}
    </div>
  );
}
