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

export function OfflineMapsHome() {
  const navigate = useNavigate();

  return (
    <ListingPage data-testid="offline-maps-home">
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h4">Manage Offline maps</Typography>
          <Typography variant="body2" color="text.secondary">
            Download map regions and contextual layers for offline use.
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
              Base map areas downloaded for offline use.
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
              Contextual layers linked to activated surveys.
            </Typography>
          </OutlinedListingCard>
        </Stack>
      </Stack>
    </ListingPage>
  );
}
