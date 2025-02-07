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

import {Geolocation} from '@capacitor/geolocation';
import {
  Alert,
  Box,
  Button,
  FormGroup,
  Grid,
  Paper,
  TextField,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {View} from 'ol';
import {Zoom} from 'ol/control';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transform} from 'ol/proj';
import {Attribution} from 'ol/source/Source';
import VectorSource from 'ol/source/Vector';
import {RegularShape, Stroke, Style} from 'ol/style';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createCenterControl} from '../map/center-control';
import {ImageTileStore, StoredTileSet} from './tile-source';

const defaultMapProjection = 'EPSG:3857';
const MAX_ZOOM = 20;
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
  const [attribution, setAttribution] = useState<Attribution | null>(null);
  const [downloadSetName, setDownloadSetName] = useState('Default');
  const [message, setMessage] = useState('');
  const [tileSets, setTileSets] = useState<StoredTileSet[]>([]);

  // create state ref that can be accessed in OpenLayers onclick callback function
  //  https://stackoverflow.com/a/60643670
  const mapRef = useRef<Map | undefined>();
  mapRef.current = map;

  // alternately use VectorTileStore for vector tiles (in progress)
  const tileStore = useMemo(() => new ImageTileStore(), []);

  const {data: map_center, isLoading: loadingLocation} = useQuery({
    queryKey: ['current_location'],
    queryFn: async (): Promise<[number, number]> => {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
      return [position.coords.longitude, position.coords.latitude];
    },
  });

  useEffect(() => {
    const fn = async () => {
      await tileStore.initDB();
      await updateTileSets();
    };
    fn();
  }, []);

  // Update the list of tilesets for display, called on init and when we remove
  // a tileset
  const updateTileSets = async () => {
    const sets = await tileStore.getTileSets();
    if (sets) setTileSets(sets);
  };

  /**
   * Create the OpenLayers map element
   */
  const createMap = useCallback(async (element: HTMLElement): Promise<Map> => {
    setAttribution(tileStore.getAttribution());
    const tileLayer = tileStore.getTileLayer();
    const view = new View({
      projection: defaultMapProjection,
      zoom: zoomLevel,
      maxZoom: MAX_ZOOM,
    });

    const theMap = new Map({
      target: element,
      layers: [tileLayer],
      view: view,
      controls: [new Zoom()],
    });

    // Add this in the createMap function after creating theMap
    theMap.getView().on('change:resolution', () => {
      const z = theMap.getView().getZoom();
      if (z) setZoomLevel(z);
    });

    return theMap;
  }, []);

  const handleCacheMapExtent = () => {
    if (map) {
      const extent = map.getView().calculateExtent();
      let sizeStr = '';
      tileStore.estimateSizeForRegion(extent, MIN_ZOOM, MAX_ZOOM).then(size => {
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
          MIN_ZOOM,
          MAX_ZOOM,
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

  /**
   * Add a marker to the map at the current location
   *
   * @param map the map element
   */
  const addCurrentLocationMarker = (map: Map) => {
    const source = new VectorSource();
    const geoJson = new GeoJSON();

    const stroke = new Stroke({color: 'black', width: 2});
    const layer = new VectorLayer({
      source: source,
      style: new Style({
        image: new RegularShape({
          stroke: stroke,
          points: 4,
          radius: 10,
          radius2: 0,
          angle: 0,
        }),
      }),
    });

    // only do this if we have a real map_center
    if (map_center) {
      const centerFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: map_center,
        },
      };

      // there is only one feature but readFeature return type is odd and readFeatures works for singletons
      const theFeatures = geoJson.readFeatures(centerFeature, {
        dataProjection: 'EPSG:4326',
        featureProjection: map.getView().getProjection(),
      });
      source.addFeature(theFeatures[0]);
      map.addLayer(layer);
    }
  };

  // when we have a location and a map, add the 'here' marker to the map
  useEffect(() => {
    if (!loadingLocation && map) {
      addCurrentLocationMarker(map);
      if (map_center) {
        const center = transform(map_center, 'EPSG:4326', defaultMapProjection);
        // add the 'here' button to go to the current location
        map.addControl(createCenterControl(map.getView(), center));
        map.getView().setCenter(center);
      }
    }
  }, [map, map_center, loadingLocation]);

  // callback to add the map to the DOM
  const refCallback = useCallback(
    (element: HTMLElement | null) => {
      if (element === null) return;

      if (!map) {
        // First render - create new map
        console.log('creating map');
        createMap(element).then((theMap: Map) => {
          setMap(theMap);
        });
      } else if (element !== map.getTarget()) {
        // Subsequent renders - only set target if it has changed
        console.log('setting target');
        map.setTarget(element);
      }
    },
    [map, createMap]
  );

  const handleDeleteTileSet = async (setName: string) => {
    await tileStore.removeTileSet(setName);
    await updateTileSets();
  };

  const handleShowExtent = (tileSet: StoredTileSet) => {
    console.log('extent', tileSet.extent);
    if (map) map.getView().fit(tileSet.extent);
  };

  return (
    <>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={8} md={8}>
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
            <Button variant="outlined" onClick={handleCacheMapExtent}>
              Estimate Size
            </Button>
            {cacheSize && <Box>Estimated Download Size: {cacheSize}</Box>}
          </FormGroup>

          {loadingLocation ? (
            <div>Loading location...</div>
          ) : (
            <>
              <Box
                ref={refCallback}
                sx={{
                  height: 600,
                  width: '100%',
                }}
              />
              <Box>
                {attribution && (
                  <p dangerouslySetInnerHTML={{__html: attribution}} />
                )}
              </Box>
            </>
          )}
        </Grid>
        <Grid item xs={12} sm={4} md={4}>
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
                {Math.round(
                  (100 * mapSet.size) / mapSet.tileKeys.length / 1024
                ) / 100}{' '}
                Kb)
              </p>
              <p>Downloaded on: {mapSet.created.toLocaleDateString()}</p>
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
                Show Download Area
              </Button>
            </Paper>
          ))}
        </Grid>
      </Grid>
    </>
  );
};
