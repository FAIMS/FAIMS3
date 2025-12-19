import {IconButton, Typography, Box} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {useState} from 'react';

const BackButton = ({}: {
  link: string;
  backIsParent?: boolean;
  confirm?: boolean;
}) => {
  const goBack = () => {
    history.back();
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
          fontWeight="bold"
          sx={{
            color: 'primary.main',
            textAlign: 'center',
          }}
        >
          Back
        </Typography>
      </Box>
    </>
  );
};

export default BackButton;
