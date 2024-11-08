import DescriptionIcon from '@mui/icons-material/Description';
import {
  Box,
  Grid,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React from 'react';
import {NOTEBOOK_NAME} from '../../../buildconfig';
import {
  CREATE_NOTEBOOK_ROLES,
  userHasRoleInSpecificListing,
} from '../../../users';
import useGetListings from '../../../utils/custom_hooks';
import {useGetAllUserInfo} from '../../../utils/useGetCurrentUser';
import NewNotebookForListing from '../notebook/NewNotebookForListing';
import CircularLoading from '../ui/circular_loading';

export interface CreateNewSurveyProps {}
const CreateNewSurvey: React.FC<CreateNewSurveyProps> = () => {
  // TODO replace with context management @luke-mcfarlane-rocketlab
  const listings = useGetListings();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Get all user info from local auth DB
  const allUserInfo = useGetAllUserInfo();

  // Loading or error states from either fetch
  const loading = listings.isLoading || allUserInfo.isLoading;
  const error = listings.isError || allUserInfo.isError;
  const errorMessage = listings.error?.message ?? allUserInfo.error?.message;

  // Only show listings for which the current active user has create permissions
  const allowedListings = allUserInfo.data
    ? (listings.data ?? []).filter(listing => {
        return userHasRoleInSpecificListing(
          allUserInfo.data,
          listing.id,
          CREATE_NOTEBOOK_ROLES
        );
      })
    : [];

  return (
    <>
      <Box
        sx={{
          width: '100%',
          backgroundColor: theme.palette.background.lightBackground,
          padding: isMobile ? '14px' : '15px',
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
                color: theme.palette.icon.main,
              }}
            />
          </Grid>

          <Grid item>
            <Typography
              variant={isMobile ? 'h4' : 'h3'}
              component="div"
              sx={{
                fontWeight: 'bold',
                fontSize: isMobile ? '20px' : '24px',
                marginBottom: '5px',
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
        {loading ? (
          <CircularLoading label="Loading servers..." />
        ) : error ? (
          <p>
            An error occurred: {errorMessage || 'Unknown error'}. Please contact
            a system administrator.
          </p>
        ) : allowedListings.length !== 0 ? (
          allowedListings.map(listing => (
            <NewNotebookForListing listingObject={listing} key={listing.id} />
          ))
        ) : (
          // The user should not get here
          <p>
            You do not have permission to create notebooks in any active server.
          </p>
        )}
      </Stack>
    </>
  );
};

export default CreateNewSurvey;
