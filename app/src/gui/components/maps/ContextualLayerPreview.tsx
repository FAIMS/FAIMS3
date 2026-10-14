// SPDX-License-Identifier: Apache-2.0
/**
 * Static preview of one downloaded contextual layer, fitted to its extent.
 */

import type {ContextualMapLayer} from '@faims3/forms';
import {createContextualMapLayer, VectorTileStore} from '@faims3/forms';
import {Alert, Box, Stack, Typography} from '@mui/material';
import {Extent} from 'ol/extent';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import 'ol/ol.css';
import {transformExtent} from 'ol/proj';
import View from 'ol/View';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useParams} from 'react-router-dom';
import {getMapConfig} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import BackButton from '../ui/BackButton';
import {loadStoredContextualLayer} from './contextualLayerStore';

const MAP_PROJECTION = 'EPSG:3857';

/** Expand an extent so the layer sits inside the map with space around it. */
function bufferExtent(extent: Extent): Extent {
  const [minX, minY, maxX, maxY] = extent;
  const width = maxX - minX;
  const height = maxY - minY;
  const minSpan = 800;
  const padX = Math.max(width * 0.15, (minSpan - width) / 2);
  const padY = Math.max(height * 0.15, (minSpan - height) / 2);
  return [minX - padX, minY - padY, maxX + padX, maxY + padY];
}

function LayerPreviewMap({layer}: {layer: ContextualMapLayer}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const mapConfig = useMemo(() => {
    const {satelliteSource: _satellite, ...vectorOnly} = getMapConfig();
    return vectorOnly;
  }, []);
  const tileStore = useMemo(() => new VectorTileStore(mapConfig), [mapConfig]);

  useEffect(() => {
    const target = container.current;
    if (!target) {
      return;
    }
    let cancelled = false;
    const map = new Map({
      target,
      layers: [tileStore.getTileLayer()],
      controls: [],
      interactions: [],
      view: new View({center: [0, 0], zoom: 2}),
    });

    const show = async () => {
      const overlay = await createContextualMapLayer(layer);
      map.addLayer(overlay);
      let extent: Extent | undefined = layer.extent3857
        ? [...layer.extent3857]
        : transformExtent(layer.extent4326, 'EPSG:4326', MAP_PROJECTION);
      if (overlay instanceof VectorLayer) {
        const featureExtent = overlay.getSource()?.getExtent();
        if (
          featureExtent &&
          featureExtent.every((value: number) => Number.isFinite(value))
        ) {
          extent = featureExtent;
        }
      }
      if (cancelled || !extent) {
        return;
      }
      map.updateSize();
      map.getView().fit(bufferExtent(extent), {
        padding: [48, 48, 48, 48],
        maxZoom: 18,
      });
    };

    void show().catch(loadError => {
      if (!cancelled) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not draw this layer.'
        );
      }
    });

    return () => {
      cancelled = true;
      map.setTarget(undefined);
    };
  }, [layer, tileStore]);

  return (
    <Stack spacing={1}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Box
        ref={container}
        sx={{
          width: '100%',
          height: 'clamp(380px, 55dvh, 650px)',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      />
    </Stack>
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
    <Box sx={{mx: 'auto', width: '100%', height: '100%', px: 2, pt: 3}}>
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
        {loading ? <Typography>Loading layer…</Typography> : null}
        {message ? <Alert severity="error">{message}</Alert> : null}
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
    </Box>
  );
}
