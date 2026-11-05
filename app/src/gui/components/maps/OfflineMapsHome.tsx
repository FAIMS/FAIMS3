// SPDX-License-Identifier: Apache-2.0
/**
 * Chooser for offline map regions and contextual layer files.
 */

import {ArrowForwardIos} from '@mui/icons-material';
import {Stack, Typography} from '@mui/material';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {ListingPage} from '../ui/listing-page';
import {OutlinedListingCard} from '../ui/outlined-listing-card';

/** Landing page linking to offline map regions and contextual layers. */
export function OfflineMapsHome() {
  const navigate = useNavigate();

  return (
    <ListingPage data-testid="offline-maps-home">
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h4">Manage offline maps and layers</Typography>
          <Typography variant="body2" color="text.secondary">
            Download map layers linked to surveys, and base maps for offline
            use.
          </Typography>
        </Stack>

        <Stack spacing={1}>
          <OutlinedListingCard
            onClick={() => navigate(ROUTES.OFFLINE_MAP_REGIONS)}
            trailing={<ArrowForwardIos color="action" />}
          >
            <Typography variant="h5" sx={{fontWeight: 'bold'}}>
              Map regions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Prepare to work offline by downloading selected base map regions.
            </Typography>
          </OutlinedListingCard>
          <OutlinedListingCard
            onClick={() => navigate(ROUTES.OFFLINE_MAP_LAYERS)}
            trailing={<ArrowForwardIos color="action" />}
          >
            <Typography
              variant="h5"
              sx={{fontWeight: 'bold'}}
              data-testid="offline-maps-layers-link"
            >
              Map layers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage map layers linked to surveys. Download maps work offline.
            </Typography>
          </OutlinedListingCard>
        </Stack>
      </Stack>
    </ListingPage>
  );
}
