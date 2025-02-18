import {IconButton, Typography, Box} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const BackButton = ({
  label,
  onClick,
}: {
  label?: string;
  onClick: () => void;
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        maxWidth: 60,
        '&:hover': {
          cursor: 'pointer',
        },
      }}
      onClick={onClick}
    >
      <IconButton color="primary" aria-label={label}>
        <ArrowBackIcon />
      </IconButton>
      {label && (
        <Typography variant="caption" sx={{mt: 0.5}}>
          {label}
        </Typography>
      )}
    </Box>
  );
};

export default BackButton;
