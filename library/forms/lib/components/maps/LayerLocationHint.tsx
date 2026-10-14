// SPDX-License-Identifier: Apache-2.0
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import {Box, Typography} from '@mui/material';
import {layerLocationRelation, type Extent4326} from './layerLocationProximity';

/** Same fill as the live GPS cursor on the map. */
const LOCATION_DOT_COLOR = '#1a73e8';

/**
 * Blue current-location dot plus "On map" when the device is on this asset.
 * Otherwise a bearing arrow toward the extent and a coarse distance.
 * Hidden when location or extent is unknown.
 */
export function LayerLocationHint({
  extent,
  location,
}: {
  extent?: Extent4326;
  location?: readonly [number, number];
}) {
  if (!extent || !location) {
    return null;
  }
  const relation = layerLocationRelation(location[0], location[1], extent);
  const label =
    relation.kind === 'inside'
      ? 'Current location is on this layer'
      : `About ${relation.label} ${relation.cardinal} of this layer`;
  return (
    <Box
      component="span"
      role="img"
      aria-label={label}
      title={
        relation.kind === 'inside'
          ? 'You are on this layer'
          : `${relation.label} ${relation.cardinal}`
      }
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        ml: 0.5,
        minWidth: 0,
      }}
    >
      <Box component="span" aria-hidden sx={{color: 'text.secondary'}}>
        ·
      </Box>
      {relation.kind === 'inside' ? (
        <>
          <Box
            component="span"
            aria-hidden
            sx={{
              width: 10,
              height: 10,
              flexShrink: 0,
              borderRadius: '50%',
              bgcolor: LOCATION_DOT_COLOR,
              border: '2px solid #fff',
              boxShadow: `0 0 0 1px ${LOCATION_DOT_COLOR}`,
            }}
          />
          <Typography
            component="span"
            variant="caption"
            color="text.secondary"
            sx={{lineHeight: 1.2, whiteSpace: 'nowrap'}}
          >
            On map
          </Typography>
        </>
      ) : (
        <>
          <ArrowUpwardIcon
            aria-hidden
            sx={{
              fontSize: 14,
              color: LOCATION_DOT_COLOR,
              transform: `rotate(${relation.bearingDegrees}deg)`,
            }}
          />
          <Typography
            component="span"
            variant="caption"
            color="text.secondary"
            sx={{lineHeight: 1.2, whiteSpace: 'nowrap'}}
          >
            {relation.label}
          </Typography>
        </>
      )}
    </Box>
  );
}
