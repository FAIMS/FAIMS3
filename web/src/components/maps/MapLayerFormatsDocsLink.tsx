// SPDX-License-Identifier: Apache-2.0
import {mapLayerFormatsDocsUrl} from '@/lib/map-layer-docs';
import {ExternalLink} from 'lucide-react';

export const MAP_LAYER_FORMATS_DOCS_LINK_CLASS =
  'inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-primary';

/** Formats/CRS docs link used on map-layer upload dialogs. */
export function MapLayerFormatsDocsLink({
  docsUrl,
  testId,
}: {
  docsUrl: string;
  testId?: string;
}) {
  return (
    <a
      href={mapLayerFormatsDocsUrl(docsUrl)}
      target="_blank"
      rel="noopener noreferrer"
      className={MAP_LAYER_FORMATS_DOCS_LINK_CLASS}
      data-testid={testId}
    >
      Learn more about supported formats and CRS
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}
