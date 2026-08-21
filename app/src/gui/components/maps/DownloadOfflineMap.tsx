/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Description:
 *   Create a named offline map download by drawing a rectangular area.
 */

import type {OfflineMapRegion} from '@faims3/data-model';
import {INPUT_LIMITS} from '@faims3/data-model';
import {
  createOfflineMapId,
  estimateOfflineMapRegionSizeMb,
  formatOfflineMapSizeMb,
  OfflineMapRegionEditor,
  offlineMapRegionToExtent3857,
  VectorTileStore,
} from '@faims3/forms';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useBlocker, useNavigate} from 'react-router-dom';
import {getMapConfig} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import BackButton from '../ui/BackButton';
import {
  DownloadOfflineMapBanner,
  DownloadOfflineMapStatus,
} from './DownloadOfflineMapBanner';

// create/download a new offline map
export function DownloadOfflineMap() {
  const navigate = useNavigate();

  // user-visible map name, multiple offline maps may use the same name.
  const [mapName, setMapName] = useState('');
  // The rectangle area the user selected on the map
  const [region, setRegion] = useState<OfflineMapRegion | null>(null);
  // Whether the selected map area has been confirmed.
  const [selectionConfirmed, setSelectionConfirmed] = useState(false);
  // Whether map drawing mode is currently active.
  const [drawingActive, setDrawingActive] = useState(true);
  // Whether the first rectangle point has been placed, used by the midway banner.
  const [hasPlacedFirstPoint, setHasPlacedFirstPoint] = useState(false);
  // Incremented to request clearing an in-progress or completed selection.
  const [clearDrawingRequestId, setClearDrawingRequestId] = useState(0);
  const [estimatedSizeMb, setEstimatedSizeMb] = useState<number | null>(null);
  const [estimatingSize, setEstimatingSize] = useState(false);
  // Whether the offline map is currently being saved.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Temporarily bypass the navigation blocker after a successful save.
  const allowNavigationRef = useRef(false);

  // Offline downloads are vector-only — omit satellite so the layer toggle is hidden
  const mapConfig = useMemo(() => {
    const {satelliteSource: _satellite, ...vectorOnly} = getMapConfig();
    return vectorOnly;
  }, []);

  const tileStore = useMemo(() => new VectorTileStore(mapConfig), [mapConfig]);

  // Warning on back unsaved progress
  const hasUnsavedProgress = Boolean(mapName.trim() || region);
  const blocker = useBlocker(
    () => hasUnsavedProgress && !allowNavigationRef.current
  );

  useEffect(() => {
    if (!region) {
      setEstimatedSizeMb(null);
      setEstimatingSize(false);
      return;
    }

    let cancelled = false;
    setEstimatingSize(true);

    estimateOfflineMapRegionSizeMb(region, mapConfig)
      .then(sizeMb => {
        if (!cancelled) {
          setEstimatedSizeMb(sizeMb);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEstimatedSizeMb(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setEstimatingSize(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mapConfig, region]);

  const handleRegionChange = (nextRegion: OfflineMapRegion | null) => {
    setRegion(nextRegion);
    setSelectionConfirmed(false);
  };

  const handleClear = () => {
    setRegion(null);
    setSelectionConfirmed(false);
    setDrawingActive(true);
    setClearDrawingRequestId(prev => prev + 1);
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }

    setError('');

    if (!mapName.trim()) {
      setError('Please enter a name for your offline map.');
      return;
    }

    if (!region) {
      setError('Please select an area on the map.');
      return;
    }

    if (!selectionConfirmed) {
      setError('Please confirm the selected area before saving.');
      return;
    }

    setSaving(true);

    try {
      // ensure the tile database is ready before saving
      await tileStore.tileStore.initDB();

      // Keep the user-visible label separate from the unique offline map id.
      // TileStore uses this unique id internally as `setName`.
      const offlineMapId = createOfflineMapId();
      const extent3857 = offlineMapRegionToExtent3857(region);

      await tileStore.createTileSet(
        extent3857,
        offlineMapId,
        undefined,
        undefined,
        {
          label: mapName.trim(),
          offlineMapRegion: region,
        }
      );

      // start the download and return to the management screen
      // while progress continues in the background.
      void tileStore.downloadTileSet(offlineMapId).catch(downloadError => {
        console.error('Offline map download failed', downloadError);
      });

      allowNavigationRef.current = true;
      navigate(ROUTES.OFFLINE_MAPS);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Could not save map'
      );
    } finally {
      setSaving(false);
    }
  };

  const sizeLabel = !region
    ? '0 MB'
    : estimatingSize
      ? 'Estimating…'
      : estimatedSizeMb !== null
        ? formatOfflineMapSizeMb(estimatedSizeMb)
        : 'Unavailable';

  const selectionStatus: DownloadOfflineMapStatus = !region
    ? hasPlacedFirstPoint
      ? 'drawing-started'
      : 'drawing'
    : selectionConfirmed
      ? 'confirmed'
      : 'pending';

  return (
    <Box
      sx={{
        mx: 'auto',
        width: '100%',
        height: '100%',
        px: 2,
        pt: 3,
      }}
    >
      <Stack direction="column" spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <BackButton link={ROUTES.OFFLINE_MAPS} />
          <Typography
            variant="h4"
            sx={{flex: 1, minWidth: 0, textAlign: 'center'}}
          >
            Download new offline map
          </Typography>
          <Button variant="contained" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        <Box>
          <Typography variant="body2">Name</Typography>
          <TextField
            fullWidth
            size="small"
            value={mapName}
            onChange={event => {
              setError('');
              setMapName(event.target.value);
            }}
            placeholder="Enter a name for your offline map..."
            slotProps={{
              htmlInput: {maxLength: INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH},
            }}
          />
        </Box>

        <Stack
          direction="row"
          spacing={1}
          sx={{justifyContent: 'space-between', alignItems: 'center'}}
        >
          <Typography variant="body2">
            {region ? 'Area selected' : 'No area selected'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Estimated size: {sizeLabel}
          </Typography>
        </Stack>

        <Stack direction="column" spacing={1}>
          {/* Banner */}
          <DownloadOfflineMapBanner
            status={selectionStatus}
            onClear={handleClear}
            onConfirm={() => {
              setError('');
              setSelectionConfirmed(true);
            }}
          />

          <OfflineMapRegionEditor
            config={mapConfig}
            region={region ?? undefined}
            onRegionChange={handleRegionChange}
            showControls={false}
            showRegionStatus={false}
            drawingActive={drawingActive}
            onDrawingActiveChange={setDrawingActive}
            onFirstPointPlacedChange={setHasPlacedFirstPoint}
            clearDrawingRequestId={clearDrawingRequestId}
            drawingInstruction=""
            // TODO: may need to fix the main layout first to make this look nicer
            mapHeight="clamp(360px, 55dvh, 620px)"
          />
        </Stack>
      </Stack>

      {/* Warning on back unsaved progress */}
      <Dialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.state === 'blocked' && blocker.reset()}
      >
        <DialogTitle>Discard offline map?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            You have unsaved progress. Leave this page without saving?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => blocker.state === 'blocked' && blocker.reset()}
          >
            Stay
          </Button>
          <Button
            color="error"
            onClick={() => blocker.state === 'blocked' && blocker.proceed()}
          >
            Leave without saving
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
