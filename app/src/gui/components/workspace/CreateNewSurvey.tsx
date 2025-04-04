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
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../../buildconfig';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {useAppSelector} from '../../../context/store';
import {userCanCreateNotebooks} from '../../../users';
import NewNotebookForListing from '../notebook/NewNotebookForListing';

export interface CreateNewSurveyProps {}
const CreateNewSurvey: React.FC<CreateNewSurveyProps> = () => {
  const activeUser = useAppSelector(selectActiveUser);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // TODO guard this component with active user check
  if (!activeUser) {
    return <p>An error occurred - no user is currently active!</p>;
  }

  const tokenInfo = activeUser.parsedToken;

  // Check user has the right role
  const allowed = userCanCreateNotebooks(tokenInfo);

  // TODO guard this component with specific role - button should never appear.
  if (!allowed) {
    return (
      <p>
        You are not allowed to create {NOTEBOOK_NAME_CAPITALIZED}s as this user.
      </p>
    );
  }

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
                color: theme.palette.icon?.main,
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
        <NewNotebookForListing
          serverId={activeUser.serverId}
          username={activeUser.username}
        />
      </Stack>
    </>
  );
};

export default CreateNewSurvey;
