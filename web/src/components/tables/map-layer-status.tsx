// SPDX-License-Identifier: Apache-2.0
import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {
  isMapAssetInProgress,
  isMapAssetReadyToLink,
  mapAssetProcessingStatusText,
  type MapAssetWithLinkCount,
} from '@faims3/data-model';
import {Link} from '@tanstack/react-router';
import {CheckCircle2, Link2} from 'lucide-react';
import type {ReactNode} from 'react';

/** Title-case status for the listing column and chip label. */
export function mapLayerStatusLabel(
  asset: Pick<MapAssetWithLinkCount, 'status' | 'linkCount'>
): string {
  switch (asset.status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'failed':
      return 'Failed';
    case 'ready':
      return isMapAssetReadyToLink(asset) ? 'Ready to link' : 'Ready';
  }
}

function StatusChip({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <Badge
      variant="outline"
      className={cn('w-fit gap-1.5 font-medium', className)}
    >
      {children}
    </Badge>
  );
}

/**
 * Listing/detail status chip. A finished layer with no survey links is an
 * orange “Ready to link” control that opens the asset’s linking tab.
 */
export function MapLayerStatusBadge({
  asset,
  linkToLinkingTab = false,
}: {
  asset: Pick<MapAssetWithLinkCount, '_id' | 'status' | 'linkCount'>;
  linkToLinkingTab?: boolean;
}) {
  const label = mapLayerStatusLabel(asset);

  if (asset.status === 'ready' && isMapAssetReadyToLink(asset)) {
    const chip = (
      <StatusChip className="cursor-pointer border-notice/40 bg-notice/10 text-notice hover:bg-notice/15">
        <Link2 className="h-3.5 w-3.5" aria-hidden />
        {label}
      </StatusChip>
    );
    if (!linkToLinkingTab) {
      return chip;
    }
    return (
      <Link
        to="/map-layers/$assetId"
        params={{assetId: asset._id}}
        search={{tab: 'links'}}
        aria-label="Ready to link — open linked surveys"
        data-testid="web-map-layer-status-ready-to-link"
        className="inline-flex w-fit rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => event.stopPropagation()}
      >
        {chip}
      </Link>
    );
  }

  if (asset.status === 'ready') {
    return (
      <StatusChip className="border-success/40 bg-success/10 text-success">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        {label}
      </StatusChip>
    );
  }

  return (
    <Badge
      variant={asset.status === 'failed' ? 'destructive' : 'outline'}
      className="w-fit"
    >
      {label}
    </Badge>
  );
}

/** Status chip plus in-progress copy for the listing column. */
export function MapLayerStatusCell({
  asset,
}: {
  asset: Pick<
    MapAssetWithLinkCount,
    '_id' | 'status' | 'linkCount' | 'processingStage' | 'processingProgress'
  >;
}) {
  const progress = isMapAssetInProgress(asset.status)
    ? mapAssetProcessingStatusText(asset)
    : undefined;
  return (
    <div className="flex flex-col gap-0.5">
      <MapLayerStatusBadge asset={asset} linkToLinkingTab />
      {progress ? (
        <span className="text-xs text-muted-foreground">{progress}</span>
      ) : null}
    </div>
  );
}
