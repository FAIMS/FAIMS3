import {IconButton, Typography, Box} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {useNavigate} from 'react-router';
import {ConfirmExitDialog} from '../record/confirmExitDialog';
import {useState} from 'react';

const BackButton = ({
  link,
  edited = false,
  backIsParent = false,
  confirm = true,
}: {
  link: string;
  edited?: boolean;
  backIsParent?: boolean;
  confirm?: boolean;
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const goBack = () => {
    console.log('edited state', edited);
    if (confirm) {
      setDialogOpen(true);
    } else if (link) navigate(link);
    else history.back();
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
      <ConfirmExitDialog
        open={dialogOpen}
        setOpen={setDialogOpen}
        backLink={link}
        backIsParent={backIsParent}
      />
    </>
  );
};

export default BackButton;
