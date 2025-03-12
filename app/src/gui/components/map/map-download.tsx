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
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: overview_map.tsx
 * Description:
 *   Display an overview map of the records in the notebook.
 */

import {Alert, Button, FormGroup, Grid, Paper, TextField} from '@mui/material';
import Map from 'ol/Map';
import {useEffect, useMemo, useState} from 'react';
import {MapComponent} from './map-component';
import {StoredTileSet, VectorTileStore} from './tile-source';

const TILE_MAX_ZOOM = 14; // for vector tiles...need a better way to handle this
const MIN_ZOOM = 12;

/**
 * Create an overview map of the records in the notebook.
 *
 * @param props {uiSpec, project_id}
 */
export const MapDownloadComponent = () => {
  const [map, setMap] = useState<Map | undefined>(undefined);
  const [cacheSize, setCacheSize] = useState('');
  const [zoomLevel, setZoomLevel] = useState(MIN_ZOOM); // Default zoom level
  const [downloadSetName, setDownloadSetName] = useState('Default');
  const [message, setMessage] = useState('');
  const [tileSets, setTileSets] = useState<StoredTileSet[]>([]);

  const tileStore = useMemo(() => new VectorTileStore(), []);

  useEffect(() => {
    const fn = async () => {
      await tileStore.initDB();
      await updateTileSets();
    };
    fn();
  }, []);

  useEffect(() => {
    if (map) {
      // invalidate calculation if the map moves and keep track of zoom level
      map.on('movestart', () => {
        setCacheSize('');
        const zoom = map.getView().getZoom();
        if (zoom) setZoomLevel(zoom);
      });
    }
  }, [map]);

  // Update the list of tilesets for display, called on init and when we remove
  // a tileset
  const updateTileSets = async () => {
    const sets = await tileStore.getTileSets();
    if (sets) setTileSets(sets);
  };

  const handleCacheMapExtent = () => {
    if (map) {
      const extent = map.getView().calculateExtent();
      let sizeStr = '';
      tileStore
        .estimateSizeForRegion(extent, zoomLevel, TILE_MAX_ZOOM)
        .then(size => {
          if (size > 1024 * 1024) {
            sizeStr = (size / 1024 / 1024).toFixed(2) + ' TB';
          } else if (size > 1024) {
            sizeStr = (size / 1024).toFixed(2) + ' GB';
          } else {
            sizeStr = size + ' MB';
          }
          setCacheSize(sizeStr);
        });
    }
  };

  const confirmCacheMapExtent = async () => {
    if (map) {
      const extent = map.getView().calculateExtent();
      setMessage('');
      try {
        await tileStore.createTileSet(
          extent,
          zoomLevel,
          TILE_MAX_ZOOM,
          downloadSetName
        );
        // when something happens, get the new tileSets
        addEventListener('offline-map-download', updateTileSets);
        tileStore.downloadTileSet(downloadSetName);
        updateTileSets();
      } catch (e: any) {
        console.error(e);
        setMessage(e.message);
      }
    }
  };

  const handleDeleteTileSet = async (setName: string) => {
    await tileStore.removeTileSet(setName);
    await updateTileSets();
  };

  const handleShowExtent = (tileSet: StoredTileSet) => {
    if (map) map.getView().fit(tileSet.extent);
  };

  return (
    <Grid
      container
      spacing={2}
      sx={{
        height: '90vh',
        position: 'relative',
      }}
    >
      <Grid item xs={12}>
        <p>Download the current region for offline use.</p>
        <FormGroup row>
          <TextField
            label="Name for Downloaded Map"
            value={downloadSetName}
            onChange={e => setDownloadSetName(e.target.value)}
          />
          <Button variant="outlined" onClick={confirmCacheMapExtent}>
            Download
          </Button>
          {cacheSize ? (
            <Alert>Estimated Download Size: {cacheSize}</Alert>
          ) : (
            <Button variant="outlined" onClick={handleCacheMapExtent}>
              Estimate Download Size
            </Button>
          )}
        </FormGroup>
      </Grid>

      <Grid
        item
        xs={12}
        sm={8}
        sx={{
          '& > div': {
            // Target MapComponent's container
            height: '100%',
          },
        }}
      >
        <MapComponent parentSetMap={setMap} />
      </Grid>

      <Grid item xs={4} sm={4} md={4}>
        <h3>Offline Maps</h3>

        {message && <Alert severity="error">{message}</Alert>}

        <h4>Maps Downloaded</h4>
        {tileSets.length === 0 && <p>No maps downloaded.</p>}
        {tileSets.map((mapSet: StoredTileSet, idx: number) => (
          <Paper key={idx}>
            <h4>{mapSet.setName}</h4>
            <p>
              Size: {Math.round((100 * mapSet.size) / 1024 / 1024) / 100} MB
            </p>
            <p>
              Tiles: {mapSet.tileKeys.length}/{mapSet.expectedTileCount} (avg.{' '}
              {Math.round((100 * mapSet.size) / mapSet.tileKeys.length / 1024) /
                100}{' '}
              Kb)
            </p>
            <p>Downloaded on: {mapSet.created.toLocaleDateString()}</p>
            <Button
              variant="outlined"
              onClick={() => handleDeleteTileSet(mapSet.setName)}
            >
              Delete
            </Button>
            <Button variant="outlined" onClick={() => handleShowExtent(mapSet)}>
              Show Download Area
            </Button>
          </Paper>
        ))}
      </Grid>
    </Grid>
  );
};
