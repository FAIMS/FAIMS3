import {IconButton, Typography, Box} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {useLocation, useNavigate} from 'react-router';
import {ConfirmExitDialog} from '../record/confirmExitDialog';
import {useState} from 'react';
import {useAppSelector} from '../../../context/store';

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
  const location = useLocation();
  // our “step” field_id comes from RelatedRecordSelector → AddNewRecordButton → navigate(...)
  const fieldId = (location.state as any)?.field_id as string | undefined;
  console.log('fieldid for reference: ', fieldId);
  const stepAnchor = (location.state as any)?.step_anchor as string | undefined;

  const navigate = useNavigate();

  const goBack = () => {
    if (confirm && formIsEdited) {
      setDialogOpen(true);
    } else if (link) {
      // the link already includes "#step-..." if stepAnchor was set,
      // so navigating to it will scroll you back to the correct step
      navigate(link, {replace: true});
    } else {
      history.back();
    }
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
          RABackRNIA
        </Typography>
      </Box>
      <ConfirmExitDialog
        open={dialogOpen}
        setOpen={setDialogOpen}
        backLink={link}
        backIsParent={backIsParent}
        fieldId={(location.state as any)?.step_anchor as string}
      />
    </>
  );
};

export default BackButton;
