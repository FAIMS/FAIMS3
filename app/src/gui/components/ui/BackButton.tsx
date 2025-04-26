import {IconButton, Typography, Box} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {useNavigate} from 'react-router';

const BackButton = ({
  label,
  link,
  singleLine = false, // control layout for new record / draft record vieww
}: {
  label?: string;
  link?: string;
  singleLine?: boolean;
}) => {
  const navigate = useNavigate();
  const goBack = () => {
    if (link) navigate(link);
    else history.back();
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: singleLine ? 'center' : 'flex-start',
        flexDirection: singleLine ? 'row' : 'column',
        gap: singleLine ? 2 : 0,
        cursor: 'pointer',
      }}
      onClick={goBack}
    >
      <IconButton color="primary" aria-label={label} sx={{p: 0}}>
        <ArrowBackIcon sx={{fontSize: 28}} />
      </IconButton>
      {label && (
        <Typography
          variant="h5"
          fontWeight="bold"
          sx={{
            color: 'primary.main',
            textAlign: singleLine ? 'left' : 'center',
          }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );
};

export default BackButton;
