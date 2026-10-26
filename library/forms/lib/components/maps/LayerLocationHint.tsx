// SPDX-License-Identifier: Apache-2.0
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import {Box, Typography} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {layerLocationRelation, type Extent4326} from './layerLocationProximity';
import {defaultMapControlPalette} from './mapTheme';

/** Same fill as the live GPS cursor and active map-control accent. */
function locationAccent(theme: Theme): string {
  return (
    theme.palette.mapControl?.buttonActiveBackground ??
    defaultMapControlPalette.buttonActiveBackground
  );
}

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
        flexShrink: 0,
        gap: 0.5,
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
              bgcolor: locationAccent,
              border: '2px solid',
              borderColor: theme =>
                theme.palette.mapControl?.locationRing ??
                theme.palette.background.paper,
              boxShadow: theme => `0 0 0 1px ${locationAccent(theme)}`,
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
              fontSize: theme => theme.typography.caption.fontSize,
              color: locationAccent,
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
