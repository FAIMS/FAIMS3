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
import BackButton from '../ui/BackButton';
import {ListingPage} from '../ui/listing-page';
import {loadStoredContextualLayer} from './contextualLayerStore';

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
          labelField: layer.labelField,
        }}
        mapConfig={mapConfig}
        baseLayer={tileStore.getTileLayer()}
      />
    </Box>
  );
}

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
        <Stack
          direction="row"
          spacing={1}
          sx={{justifyContent: 'space-between', alignItems: 'center'}}
        >
          <BackButton link={ROUTES.OFFLINE_MAP_LAYERS} />
          <Typography
            variant="h4"
            sx={{flex: 1, minWidth: 0, textAlign: 'center'}}
          >
            Layer preview
          </Typography>
        </Stack>
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
            <Typography
              variant="h5"
              sx={{fontWeight: 'bold', overflowWrap: 'anywhere'}}
            >
              {layer.name}
            </Typography>
            <LayerPreviewMap layer={layer} />
          </>
        ) : null}
      </Stack>
    </ListingPage>
  );
}
