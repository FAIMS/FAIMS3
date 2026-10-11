// SPDX-License-Identifier: Apache-2.0
/**
 * Chooser for offline map regions and contextual layer files.
 */

import {ArrowForwardIos} from '@mui/icons-material';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';

export function OfflineMapsHome() {
  const navigate = useNavigate();

  return (
    <Box sx={{mx: 'auto', width: '100%', height: '100%', px: 2, pt: 3}}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h4">Manage Offline maps</Typography>
          <Typography variant="body2" color="text.secondary">
            Download map regions and contextual layers for offline use.
          </Typography>
        </Stack>

        <Stack spacing={1}>
          <HomeCard
            title="Map regions"
            detail="Base map areas downloaded for offline use."
            onClick={() => navigate(ROUTES.OFFLINE_MAP_REGIONS)}
          />
          <HomeCard
            title="Map layers"
            detail="Contextual layers linked to activated surveys."
            onClick={() => navigate(ROUTES.OFFLINE_MAP_LAYERS)}
          />
        </Stack>
      </Stack>
    </Box>
  );
}

function HomeCard({
  title,
  detail,
  onClick,
}: {
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <Card variant="outlined">
      <CardActionArea onClick={onClick}>
        <CardContent sx={{py: 1.5}}>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{justifyContent: 'space-between', alignItems: 'center'}}
          >
            <Stack spacing={0.5} sx={{flex: 1, minWidth: 0}}>
              <Typography variant="h5" sx={{fontWeight: 'bold'}}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {detail}
              </Typography>
            </Stack>
            <ArrowForwardIos color="action" />
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
