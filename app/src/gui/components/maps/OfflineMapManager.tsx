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
 *   Manage downloaded offline maps.
 */

import {
  formatOfflineMapSizeBytes,
  ProgressBar,
  tileSetDisplayName,
  tileSetDownloadProgress,
  VectorTileStore,
  type StoredTileSet,
} from '@faims3/forms';
import {ArrowForwardIos} from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {getMapConfig} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';

/**
 * Offline map management screen.
 *
 * Displays all downloaded offline maps and provides navigation for creating
 * a new download or managing an existing map.
 *
 * The empty and populated designs are two states of this same page.
 */
export const OfflineMapManager = () => {
  const navigate = useNavigate();

  const [tileSets, setTileSets] = useState<StoredTileSet[]>([]);
  // Error message shown on the page.
  const [message, setMessage] = useState('');

  // Offline downloads are vector-only, matching the existing download flow.
  const mapConfig = useMemo(() => {
    const {satelliteSource: _satellite, ...vectorOnly} = getMapConfig();
    return vectorOnly;
  }, []);

  const tileStore = useMemo(() => new VectorTileStore(mapConfig), [mapConfig]);

  // Refresh the downloaded map list from IndexedDB.
  const updateTileSets = useCallback(async () => {
    const sets = await tileStore.getTileSets();
    setTileSets(sets ?? []);
  }, [tileStore]);

  /**
   * Initialise the tile database and keep the list in sync with download
   * progress/completion events.
   */
  useEffect(() => {
    let active = true;

    const initialise = async () => {
      try {
        await tileStore.tileStore.initDB();
        await tileStore.createBaselineTileSet();

        if (active) {
          await updateTileSets();
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not load downloaded maps'
          );
        }
      }
    };

    void initialise();

    const handleOfflineMapUpdate = () => {
      void updateTileSets();
    };

    // when something happens, get the new tileSets
    addEventListener('offline-map-download', handleOfflineMapUpdate);
    // clean up when we go
    return () => {
      active = false;
      removeEventListener('offline-map-download', handleOfflineMapUpdate);
    };
  }, [tileStore, updateTileSets]);

  // Open the edit/details page for an existing map.
  // `setName` is used as the internal offline map id
  const openMap = (offlineMapId: string) => {
    navigate(ROUTES.getOfflineMapEditRoute({offlineMapId}));
  };

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
      <Stack direction="column" spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h4" sx={{flex: 1, minWidth: 0}}>
            Manage Offline maps
          </Typography>

          <Typography variant="body2" color="text.secondary">
            All maps you have downloaded for offline use will appear here.
          </Typography>
        </Stack>

        {/* Show loading error. */}
        {message && <Alert severity="error">{message}</Alert>}

        <Stack direction="column">
          {tileSets.length === 0 ? (
            <Stack spacing={1}>
              <Typography variant="h5">Downloaded maps</Typography>

              <Typography variant="body2" color="text.secondary">
                You currently have no maps downloaded.
              </Typography>

              <Button
                fullWidth
                variant="contained"
                endIcon={<AddIcon />}
                onClick={() => navigate(ROUTES.OFFLINE_MAP_NEW)}
              >
                Download new map region
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1}>
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography variant="h5">Downloaded maps</Typography>

                <Button
                  variant="contained"
                  endIcon={<AddIcon />}
                  onClick={() => navigate(ROUTES.OFFLINE_MAP_NEW)}
                >
                  New download
                </Button>
              </Stack>

              <Stack spacing={1}>
                {tileSets.map(tileSet => {
                  const progress = tileSetDownloadProgress(tileSet);
                  const isDownloading = progress !== null && progress < 1;

                  return (
                    <Card key={tileSet.setName} variant="outlined">
                      <CardActionArea onClick={() => openMap(tileSet.setName)}>
                        <CardContent sx={{py: 1}}>
                          <Stack
                            direction="row"
                            spacing={1.5}
                            sx={{
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Stack spacing={0.5} sx={{flex: 1, minWidth: 0}}>
                              <Typography
                                variant="h5"
                                sx={{
                                  overflowWrap: 'anywhere',
                                  whiteSpace: 'normal',
                                  fontWeight: 'bold',
                                }}
                              >
                                {tileSetDisplayName(tileSet)}
                              </Typography>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Size: {formatOfflineMapSizeBytes(tileSet.size)}
                              </Typography>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Downloaded on:{' '}
                                {tileSet.created.toLocaleDateString()}
                              </Typography>

                              {isDownloading && (
                                <Box sx={{mt: 1}}>
                                  <ProgressBar completion={progress} />
                                </Box>
                              )}
                            </Stack>

                            <ArrowForwardIos color="action" />
                          </Stack>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Stack>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};
