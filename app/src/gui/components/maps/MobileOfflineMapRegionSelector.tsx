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
 *   Mobile offline map selector using a fixed selection frame.
 *
 *   The map can be panned and zoomed beneath the frame, and the area inside
 *   the frame is converted to an offline map region.
 */

import type {OfflineMapRegion} from '@faims3/data-model';
import {
  extent4326ToOfflineMapRegion,
  MapComponent,
  type MapConfig,
} from '@faims3/forms';
import {Box} from '@mui/material';
import type Map from 'ol/Map';
import {transformExtent} from 'ol/proj';
import {useEffect, useState} from 'react';

type MobileOfflineMapRegionSelectorProps = {
  config: MapConfig;
  /** Called when the region inside the fixed selection frame changes. */
  onRegionChange: (region: OfflineMapRegion) => void;
  /** Whether map pan and zoom interactions are disabled. */
  locked?: boolean;
  /** Height of the map container. */
  mapHeight?: number | string;
};

// Mobile selection padding in px
const SELECTION_PADDING = 32;

/** Mobile map selector using a fixed area while the map is panned or zoomed. */
export const MobileOfflineMapRegionSelector = ({
  config,
  onRegionChange,
  locked = false,
  mapHeight = 480,
}: MobileOfflineMapRegionSelectorProps) => {
  const [map, setMap] = useState<Map>();

  useEffect(() => {
    if (!map) {
      return;
    }

    const updateRegion = () => {
      const size = map.getSize();

      if (!size) {
        return;
      }

      const [width, height] = size;

      // Convert the fixed selection frame from screen pixels to map coordinates.
      const topLeft = map.getCoordinateFromPixel([
        SELECTION_PADDING,
        SELECTION_PADDING,
      ]);
      const bottomRight = map.getCoordinateFromPixel([
        width - SELECTION_PADDING,
        height - SELECTION_PADDING,
      ]);

      if (!topLeft || !bottomRight) {
        return;
      }

      const extent = [topLeft[0], bottomRight[1], bottomRight[0], topLeft[1]];

      const extent4326 = transformExtent(
        extent,
        map.getView().getProjection(),
        'EPSG:4326'
      );
      console.debug('changegeddddddd');
      onRegionChange(extent4326ToOfflineMapRegion(extent4326));
    };

    // Update the selected region after the user pans or zooms the map.
    map.on('moveend', updateRegion);
    map.on('change:size', updateRegion);

    // Set the initial region once the map is ready.
    updateRegion();

    return () => {
      map.un('moveend', updateRegion);
      map.un('change:size', updateRegion);
    };
  }, [map, onRegionChange]);

  useEffect(() => {
    if (!map) {
      return;
    }

    // Lock map interaction after the selection is confirmed.
    map.getInteractions().forEach(interaction => {
      interaction.setActive(!locked);
    });
  }, [locked, map]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: mapHeight,
        overflow: 'hidden',
      }}
    >
      <MapComponent
        parentSetMap={setMap}
        config={config}
        showControls={false}
      />

      {/* Keep the selected area visible and dim everything outside it. */}
      <Box
        sx={{
          position: 'absolute',
          inset: `${SELECTION_PADDING}px`,
          border: '3px solid #1a73e8aa',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
          pointerEvents: 'none',
          zIndex: 997,
        }}
      />
    </Box>
  );
};
