import {useIsOnline} from '../../../utils/customHooks';
import {Typography, Button, Box} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

const ExampleOnlineComponent = () => {
  /**
   * Component: ExampleOnlineComponent
   * Debugging example component which can be used to test areas of the app
   * sensitive to being online. Utilizes the useIsOnline hook which provides a
   * fallback component.
   */
  const {isOnline, fallback, checkIsOnline} = useIsOnline();

  if (!isOnline) {
    return fallback;
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
    >
      <Typography variant="h4" gutterBottom>
        You're online!
      </Typography>
      <Typography variant="body1" gutterBottom>
        This component is visible because you have an active internet
        connection.
      </Typography>
      <Button
        variant="contained"
        color="primary"
        startIcon={<RefreshIcon />}
        onClick={checkIsOnline}
        style={{marginTop: '16px'}}
      >
        Check Connection
      </Button>
    </Box>
  );
};

export default ExampleOnlineComponent;
