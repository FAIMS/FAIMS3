import AddCircleSharpIcon from '@mui/icons-material/AddCircleSharp';
import InfoIcon from '@mui/icons-material/Info';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ListingsObject} from '../../../sync/databases';
import {useCreateNotebookFromTemplate} from '../../../utils/apiHooks/notebooks';
import {useGetTemplates} from '../../../utils/apiHooks/templates';
import CircularLoading from '../ui/circular_loading';
import useErrorPopup from '../ui/errorPopup';

export interface NewNotebookForListingProps {
  listingObject: ListingsObject;
}
const NewNotebookForListing: React.FC<NewNotebookForListingProps> = props => {
  // Popup manager
  const errorPopup = useErrorPopup();

  // Use custom hook to get template list
  const templates = useGetTemplates({listingId: props.listingObject._id});

  // What template has the user selected - if any
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(
    undefined
  );

  // What survey name has user inputted, if any
  const [surveyName, setSurveyName] = useState<string | undefined>(undefined);

  // Mutation to create new survey
  const createNotebook = useCreateNotebookFromTemplate({
    listingId: props.listingObject._id,
    name: surveyName,
    templateId: selectedTemplate,
    // When we succeed, navigate back to home page
    options: {
      onSuccess: () => {
        navigate('/');
        window.location.reload();
      },
      // If error occurs then display popup
      onError: e => {
        console.error(e);
        errorPopup.showError(
          'An error occurred while creating the notebook. ' + e
        );
      },
    },
  });

  // Dialog management
  const [openDialog, setOpenDialog] = useState(false);

  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // --------
  // HANDLERS
  // --------

  // Handles when the template is selected from the list
  const handleTemplateChange = (event: SelectChangeEvent<string>) => {
    const templateId = event.target.value;
    setSelectedTemplate(templateId);
  };

  // Handles when the user confirms selection
  const handleInstantiateSurvey = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // Handle survey creation
  const handleSubmitSurvey = async () => {
    if (!surveyName) {
      errorPopup.showError(
        'You cannot create a survey without providing a survey name!'
      );
      return;
    }
    if (!selectedTemplate) {
      errorPopup.showError(
        'You cannot create a survey without selecting a template!'
      );
      return;
    }

    if (!createNotebook.ready) {
      console.error(
        'Unexpected state where all values are present yet mutation is not ready!'
      );
      errorPopup.showError('You cannot create a survey yet.');
      return;
    }

    // Perform operation
    createNotebook.mutation!.mutate();
  };

  return (
    <>
      {errorPopup.ErrorPopupRenderer()}
      <Box
        sx={{
          width: '100%',
          backgroundColor: '#f5f5f5',
          padding: isMobile ? '8px' : '8px',
          textAlign: 'center',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: '12px',
        }}
      >
        <Typography
          variant={'subtitle2'}
          component="div"
          sx={{fontWeight: 'bold', fontSize: '18px', padding: theme.spacing(2)}}
        >
          {props.listingObject.name}
        </Typography>
      </Box>
      <FormControl
        fullWidth
        sx={{
          maxWidth: 400,
          marginTop: '28px',
        }}
      >
        <InputLabel
          id="template-select-label"
          shrink={false}
          sx={{
            position: 'static',
            transform: 'none',
            fontSize: '1.125rem',
            fontWeight: 'bold',
            marginBottom: '18px',
            color: '#263238',
          }}
        >
          Using existing template
        </InputLabel>
        {templates.isLoading ? (
          <CircularLoading label={'Loading Templates'} />
        ) : templates.isError ? (
          <Typography color="error">
            {'An error occurred while fetching templates, error: ' +
              templates.error}
          </Typography>
        ) : (
          <Select
            labelId="template-select-label"
            value={selectedTemplate ?? ''}
            onChange={handleTemplateChange}
            displayEmpty
            sx={{
              height: '48px',
              justifyContent: 'center',
            }}
            MenuProps={{
              disableScrollLock: true,
              anchorOrigin: {
                vertical: 'bottom',
                horizontal: 'left',
              },
              transformOrigin: {
                vertical: 'top',
                horizontal: 'left',
              },
            }}
          >
            <MenuItem disabled value="">
              Choose survey template
            </MenuItem>
            {templates.data && templates.data.templates.length > 0 ? (
              templates.data.templates.map(template => (
                <MenuItem key={template._id} value={template._id}>
                  {template.template_name}
                </MenuItem>
              ))
            ) : (
              <MenuItem disabled value="">
                No templates available
              </MenuItem>
            )}
          </Select>
        )}
      </FormControl>
      {/* Show error if any */}
      <Box
        sx={{
          fontSize: '1.1rem',
          color: '#00A9CE',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          marginTop: '16px',
          padding: '6px',
          textDecoration: 'underline',
        }}
      >
        View / Edit survey templates
        <OpenInNewIcon
          sx={{
            fontSize: '1.2rem',
            margin: '8px 6px',
            fontWeight: 'bold',
          }}
        />
      </Box>
      <Box
        sx={{
          fontSize: '1.125rem',
          fontWeight: 'bold',
          marginTop: '2.3em',
          alignSelf: 'flex-start',
        }}
      >
        Create new template
      </Box>
      <Box
        sx={{
          fontSize: '1.23em',
          color: '#9d8a8a',
          display: 'flex',
          alignItems: 'left',
          gap: 1,
          textAlign: 'left',
          marginTop: '18px',
        }}
      >
        Please log in with browser app on your computer to create a new survey
        template
        <OpenInBrowserIcon
          sx={{
            fontSize: '2rem',
            color: '#00A9CE',
            cursor: 'pointer',
          }}
          onClick={() => {
            window.open('/', '_blank');
          }}
        />
      </Box>
      <Button
        variant="contained"
        color="primary"
        startIcon={<AddCircleSharpIcon />} // Add icon to button
        sx={{
          width: '100%',
          maxWidth: 400,
          alignSelf: 'center',
          mt: '90px',
          textTransform: 'none',
          '&:hover': {
            backgroundColor: '#1976d2',
          },
        }}
        onClick={handleInstantiateSurvey}
        disabled={createNotebook.mutation?.isPending || !selectedTemplate}
      >
        {createNotebook.mutation?.isPending
          ? 'Creating Survey...'
          : 'Create survey'}
      </Button>
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth={isMobile ? 'xs' : 'sm'}
        disableScrollLock={true}
        sx={{
          '& .MuiDialog-paper': {
            width: isMobile ? '47%' : '100%',
            margin: 'auto',
            position: 'absolute',
            bottom: '60%',
            left: '1%',
          },
        }}
      >
        <DialogTitle>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <InfoIcon
              sx={{
                color: '#1976d2',
                fontSize: '1.5em',
                verticalAlign: 'middle',
                marginTop: '4px',
              }}
            />
            &nbsp;&nbsp;
            <Typography
              variant="h6"
              component="span"
              sx={{
                fontSize: '1.4em',
                fontWeight: 'bold',
                textAlign: 'center',
              }}
            >
              Instantiate Survey
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Typography
            variant="body2"
            paragraph
            sx={{
              color: 'grey',
              fontSize: '0.875rem',
            }}
          >
            <i>
              You are about to create a new survey based on the selected
              template. Please ensure you have chosen the correct template.
            </i>
          </Typography>
          <Typography
            variant="body2"
            paragraph
            sx={{
              color: 'grey',
              fontSize: '0.875rem',
            }}
          >
            <i>
              After the survey is created, it will be listed in survey list.
            </i>
          </Typography>
          <TextField
            fullWidth
            label="Survey Name"
            value={surveyName ?? ''}
            onChange={e => setSurveyName(e.target.value)}
            sx={{marginTop: '16px'}}
            required
            disabled={createNotebook.mutation?.isPending}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseDialog}
            color="primary"
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmitSurvey}
            color="primary"
            variant="contained"
            disabled={createNotebook.mutation?.isPending || !surveyName}
          >
            {createNotebook.mutation?.isPending ? 'Creating...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NewNotebookForListing;
