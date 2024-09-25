import DescriptionIcon from '@mui/icons-material/Description';
import {
  Grid,
  useMediaQuery,
  Typography,
  useTheme,
  Box,
  Stack,
} from '@mui/material';
import React from 'react';
import useGetListings from '../../../utils/custom_hooks';
import NewNotebookForListing from '../notebook/NewNotebookForListing';
import CircularLoading from '../ui/circular_loading';

export interface CreateNewSurveyProps {}
const CreateNewSurvey: React.FC<CreateNewSurveyProps> = props => {
  // TODO replace with context management @luke-mcfarlane-rocketlab
  const listings = useGetListings();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <>
      <Box
        sx={{
          width: '100%',
          backgroundColor: '#f5f5f5',
          padding: isMobile ? '8px' : '8px',
          textAlign: 'center',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: '12px',
        }}
      >
        <Grid container direction="column" alignItems="center">
          <Grid item>
            <DescriptionIcon
              color={'secondary'}
              fontSize={isMobile ? 'large' : 'inherit'}
            />
          </Grid>

          <Grid item>
            <Typography
              variant={isMobile ? 'h5' : 'h4'}
              component="div"
              sx={{fontWeight: 'bold', fontSize: '20px', marginBottom: '18px'}}
            >
              Create New Survey
            </Typography>
          </Grid>
        </Grid>
      </Box>

      <Stack direction="column" spacing={theme.spacing(2)} padding={theme.spacing(3)}>
        {listings.isLoading ? (
          <CircularLoading label={'Loading servers...'}></CircularLoading>
        ) : (
          listings.data?.map(listing => {
            return (
              <NewNotebookForListing
                listingObject={listing}
                key={listing._id}
              />
            );
          })
        )}
      </Stack>
    </>
  );
};

export default CreateNewSurvey;
