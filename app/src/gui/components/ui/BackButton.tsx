import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {Box, IconButton, Typography} from '@mui/material';
import {useNavigate} from 'react-router';

const BackButton = ({link}: {link: string}) => {
  const nav = useNavigate();
  const goBack = () => {
    nav(link);
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          flexDirection: 'column',
          gap: 0,
          cursor: 'pointer',
        }}
        onClick={goBack}
      >
        <IconButton color="primary" aria-label="Back" sx={{p: 0}}>
          <ArrowBackIcon sx={{fontSize: 28}} />
        </IconButton>
        <Typography
          variant="h5"
          sx={{
            color: 'primary.main',
            textAlign: 'center',
            fontWeight: 'bold',
          }}
        >
          Back
        </Typography>
      </Box>
    </>
  );
};

export default BackButton;
