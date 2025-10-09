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
 * Description:
 *  A component supporting downloading of offline maps
 */

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Map from 'ol/Map';
import {useEffect, useMemo, useState} from 'react';
import ProgressBar from '../progress-bar';
import {MapComponent} from './map-component';
import {StoredTileSet, VectorTileStore} from './tile-source';

/**
 * Map download component presents the UI for downloading offline maps.
 *
 */
export const MapDownloadComponent = () => {
  const [map, setMap] = useState<Map | undefined>(undefined);
  const [cacheSize, setCacheSize] = useState('');
  const [downloadSetName, setDownloadSetName] = useState('Default');
  const [message, setMessage] = useState('');
  const [tileSets, setTileSets] = useState<StoredTileSet[]>([]);
  const [downloadListOpen, setDownloadListOpen] = useState(false);

  const tileStore = useMemo(() => new VectorTileStore(), []);

  // ensure we have a baseline tile set for this map
  tileStore.createBaselineTileSet();

  // Call updateTileSets on startup and arrange for it to be called
  // whenever there is an update to offline maps (new tiles downloaded)
  useEffect(() => {
    const fn = async () => {
      // force an await on the tile store database init
      // to make sure the database is ready on page refresh
      // (this is only an issue if we get a refresh on this page
      // since the init called on startup should be finished in any
      // other situation)
      await tileStore.tileStore.initDB();

      await updateTileSets();
    };
    fn();

    // when something happens, get the new tileSets
    addEventListener('offline-map-download', updateTileSets);
    // clean up when we go
    return () => {
      removeEventListener('offline-map-download', updateTileSets);
    };
  }, []);

  // Set up an event handler on map movement
  useEffect(() => {
    if (map) {
      // invalidate calculation if the map moves and keep track of zoom level
      map.on('movestart', () => {
        setCacheSize('');
      });
    }
  }, [map]);

  // Update the list of tile-sets for display
  const updateTileSets = async () => {
    const sets = await tileStore.getTileSets();
    if (sets) setTileSets(sets);
  };

  // Estimate the size of the current region for display
  const handleCacheMapExtent = () => {
    if (map) {
      const extent = map.getView().calculateExtent();
      let sizeStr = '';
      tileStore.estimateSizeForRegion(extent).then(size => {
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

  // Start the actual download of map tiles
  const confirmCacheMapExtent = async () => {
    if (map) {
      const extent = map.getView().calculateExtent();
      setMessage('');
      setDownloadListOpen(true);
      console.log('set downloadListOpen true');
      try {
        await tileStore.createTileSet(extent, downloadSetName);
        tileStore.downloadTileSet(downloadSetName);
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
    <Grid container spacing={2}>
      <Grid item xs={12} sx={{marginBottom: 2}}>
        <Alert severity="info">
          Offline maps is an experimental feature. Please report any unexpected
          behaviour.
        </Alert>

        <Typography variant="body1" sx={{marginBottom: 2}}>
          Download the current region for offline use. Note that download size
          estimates are approximate for metro areas, rural areas may be much
          smaller.
        </Typography>

        <Stack
          direction={{xs: 'column', sm: 'row'}}
          spacing={{xs: 1, sm: 2, md: 4}}
        >
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
          {message && <Alert severity="error">{message}</Alert>}
        </Stack>
      </Grid>

      <Grid item xs={12} sm={4} md={3}>
        <Accordion
          sx={{width: '100%'}}
          expanded={downloadListOpen}
          onClick={() => setDownloadListOpen(!downloadListOpen)}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{height: '2em'}}
          >
            <h3>Maps Downloaded</h3>
          </AccordionSummary>
          <AccordionDetails>
            {tileSets.length === 0 && <p>No maps downloaded.</p>}
            {tileSets.map((mapSet: StoredTileSet, idx: number) => (
              <Card variant="outlined" key={idx}>
                <CardContent>
                  <Typography variant="h5" component="div">
                    {mapSet.setName}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Size: {Math.round((100 * mapSet.size) / 1024 / 1024) / 100}{' '}
                    MB
                  </Typography>

                  {mapSet.tileKeys.length !== mapSet.expectedTileCount && (
                    <ProgressBar
                      percentage={
                        mapSet.tileKeys.length / mapSet.expectedTileCount
                      }
                    />
                  )}
                  <Typography variant="body2" color="text.secondary">
                    Downloaded on: {mapSet.created.toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    variant="outlined"
                    onClick={() => handleDeleteTileSet(mapSet.setName)}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => handleShowExtent(mapSet)}
                  >
                    Show
                  </Button>
                </CardActions>
              </Card>
            ))}
          </AccordionDetails>
        </Accordion>
      </Grid>

      <Grid
        item
        xs={12}
        md={9}
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
    </Grid>
  );
};
