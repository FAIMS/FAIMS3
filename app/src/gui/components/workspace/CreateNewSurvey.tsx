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
import {NOTEBOOK_NAME} from '../../../buildconfig';

export interface CreateNewSurveyProps {}
const CreateNewSurvey: React.FC<CreateNewSurveyProps> = () => {
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
          padding: isMobile ? '14px' : '15px', // Increase padding for better spacing
          textAlign: 'center',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Grid container direction="column" alignItems="center">
          <Grid item>
            <DescriptionIcon
              color={'secondary'}
              fontSize={isMobile ? 'large' : 'inherit'}
              sx={{
                fontSize: isMobile ? '2.1875rem' : '2.1975rem', // Increase size for both mobile and desktop
                marginBottom: '2px', //  Space between icon and title
                color: '#E18200',
              }}
            />
          </Grid>

          <Grid item>
            <Typography
              variant={isMobile ? 'h4' : 'h3'} // Make title larger
              component="div"
              sx={{
                fontWeight: 'bold',
                fontSize: isMobile ? '20px' : '24px', // Font size for both mobile and desktop
                marginBottom: '5px',
                color: '#263238', // Darker text for better contrast
              }}
            >
              Create New {NOTEBOOK_NAME}
            </Typography>
          </Grid>
        </Grid>
      </Box>

      <Stack
        direction="column"
        spacing={theme.spacing(2)}
        padding={theme.spacing(3)}
      >
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
