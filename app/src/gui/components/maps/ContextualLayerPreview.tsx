// SPDX-License-Identifier: Apache-2.0
/**
 * Static preview of one downloaded contextual layer, fitted to its extent.
 */

import type {ContextualMapLayer} from '@faims3/forms';
import {StaticMapLayerPreview, VectorTileStore} from '@faims3/forms';
import {Alert, Box, Stack, Typography} from '@mui/material';
import {useEffect, useMemo, useState} from 'react';
import {useParams} from 'react-router-dom';
import {getMapConfig} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import {ListingPage, ListingPageHeader} from '../ui/listing-page';
import {listingTitleSx} from '../ui/outlined-listing-card';
import {loadStoredContextualLayer} from './contextualLayerStore';

/** Fitted static map of one stored layer (vector basemap only). */
function LayerPreviewMap({layer}: {layer: ContextualMapLayer}) {
  const mapConfig = useMemo(() => {
    const {satelliteSource: _satellite, ...vectorOnly} = getMapConfig();
    return vectorOnly;
  }, []);
  const tileStore = useMemo(() => new VectorTileStore(mapConfig), [mapConfig]);

  return (
    <Box
      sx={{
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <StaticMapLayerPreview
        url={layer.url}
        kind={layer.kind}
        extent4326={layer.extent4326}
        extent3857={layer.extent3857}
        readTileBytes={layer.readTileBytes}
        minZoom={layer.minZoom}
        maxZoom={layer.maxZoom}
        style={{
          stroke: layer.stroke,
          fill: layer.fill,
          lineWidth: layer.lineWidth,
          pointSize: layer.pointSize,
          opacity: layer.opacity,
        }}
        mapConfig={mapConfig}
        baseLayer={tileStore.getTileLayer()}
      />
    </Box>
  );
}

/** Route page: load a stored layer by `assetId` and show a static preview. */
export function ContextualLayerPreview() {
  const {assetId} = useParams<{assetId: string}>();
  const [layer, setLayer] = useState<ContextualMapLayer | undefined>();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setMessage('');
      if (!assetId) {
        setMessage('Map layer could not be identified.');
        setLoading(false);
        return;
      }
      try {
        const stored = await loadStoredContextualLayer(assetId);
        if (!active) {
          return;
        }
        if (!stored) {
          setMessage('This map layer is not on the device.');
          return;
        }
        setLayer(stored);
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error ? error.message : 'Could not open the layer.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [assetId]);

  return (
    <ListingPage data-testid="map-layer-preview">
      <Stack spacing={2}>
        <ListingPageHeader
          backLink={ROUTES.OFFLINE_MAP_LAYERS}
          title="Layer preview"
        />
        {loading ? (
          <Typography data-testid="map-layer-preview-loading">
            Loading layer…
          </Typography>
        ) : null}
        {message ? (
          <Alert severity="error" data-testid="map-layer-preview-error">
            {message}
          </Alert>
        ) : null}
        {layer ? (
          <>
            <Typography variant="h5" sx={listingTitleSx}>
              {layer.name}
            </Typography>
            <LayerPreviewMap layer={layer} />
          </>
        ) : null}
      </Stack>
    </ListingPage>
  );
}
