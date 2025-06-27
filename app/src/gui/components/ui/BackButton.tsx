import {IconButton, Typography, Box} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {useNavigate} from 'react-router';
import {ConfirmExitDialog} from '../record/confirmExitDialog';
import {useState} from 'react';
import {useAppSelector} from '../../../context/store';
import {useParentLink} from '../../../utils/useParentLink';

const BackButton = ({
  link,
  backIsParent = false,
  confirm = true,
}: {
  link: string;
  backIsParent?: boolean;
  confirm?: boolean;
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const formIsEdited = useAppSelector(state => state.records.edited);

  const navigate = useNavigate();

  const goBack = () => {
    if (backlink?.parent_link) navigate(backlink.parent_link);
    else history.back();
  };

  const backlink = useParentLink();

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
