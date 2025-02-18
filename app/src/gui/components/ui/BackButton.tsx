import {IconButton, Typography, Box} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const BackButton = ({
  label,
  onClick,
  singleLine = false, // control layout for new record / draft record vieww
}: {
  label?: string;
  onClick: () => void;
  singleLine?: boolean;
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: singleLine ? 'center' : 'flex-start',
        flexDirection: singleLine ? 'row' : 'column',
        gap: singleLine ? 2 : 0,
        cursor: 'pointer',
      }}
      onClick={onClick}
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
