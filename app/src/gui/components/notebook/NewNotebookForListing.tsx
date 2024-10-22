import AddCircleSharpIcon from '@mui/icons-material/AddCircleSharp';
import InfoIcon from '@mui/icons-material/Info';
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
import {ListingsObject} from '@faims3/data-model/src/types';
import {useCreateNotebookFromTemplate} from '../../../utils/apiHooks/notebooks';
import {useGetTemplates} from '../../../utils/apiHooks/templates';
import CircularLoading from '../ui/circular_loading';
import useErrorPopup from '../ui/errorPopup';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../../buildconfig';
import {useRefreshToken} from '../../../utils/tokenHooks';
import {parseToken, setTokenForCluster} from '../../../users';

export interface NewNotebookForListingProps {
  listingObject: ListingsObject;
}
const NewNotebookForListing: React.FC<NewNotebookForListingProps> = props => {
  // Popup manager
  const errorPopup = useErrorPopup();

  // Use custom hook to get template list
  const templates = useGetTemplates({listingId: props.listingObject.id});
  // What template has the user selected - if any
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(
    undefined
  );

  // What survey name has user inputted, if any
  const [surveyName, setSurveyName] = useState<string | undefined>(undefined);

  // Token refresh mutation using default active username for current listing
  const refreshTokenMutation = useRefreshToken({
    listingId: props.listingObject.id,
  });

  // Mutation to create new survey
  const createNotebook = useCreateNotebookFromTemplate({
    listingId: props.listingObject.id,
    name: surveyName,
    templateId: selectedTemplate,
    // When we succeed, navigate back to home page
    options: {
      onSuccess: async () => {
        await refreshTokenMutation
          .mutateAsync()
          .then(async t => {
            // parse the new token
            const parsedToken = await parseToken(t);

            // and update
            await setTokenForCluster(
              t,
              parsedToken,
              // use existing refresh token
              undefined,
              props.listingObject.id
            );
          })
          .catch(e => {
            console.error(
              'Token refresh failed! User may not be able to see new survey.'
            );
            console.error(e);
            return undefined;
          });

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
          marginTop: '28px',
          width: 'auto',
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
          Select {NOTEBOOK_NAME_CAPITALIZED} template
        </InputLabel>
        {/* Information blurb below the title */}
        <Box
          sx={{
            backgroundColor: '#e0f7fa',
            padding: '12px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <InfoIcon sx={{color: '#0288d1', marginRight: '8px'}} />
          <Typography variant="body2" sx={{color: '#616161'}}>
            Get started by selecting a <strong>Survey template</strong> from the
            list below. Survey templates define a standardised set of questions
            which users will need to answer to complete your Survey. <br></br>
            If you would like to create, edit or update Survey templates, we
            recommend using a browser, you can do so by{' '}
            <Typography
              component="span"
              sx={{
                fontWeight: 'bold',
                color: '#00796b',
                marginLeft: '4px',
                fontStyle: 'italic',
                textDecoration: 'underline',
              }}
              onClick={() => {
                window.open('/', '_blank');
              }}
            >
              visiting this link
              <OpenInNewIcon
                sx={{
                  fontSize: '14px',
                  marginLeft: '4px',
                }}
              />
            </Typography>
          </Typography>
        </Box>

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
              width: '100%',
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
              Choose {NOTEBOOK_NAME} template
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

      {/* <Box
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
        If you would like to create, edit or update Survey templates, we
        recommend using a browser, you can do so by{' '}
        <Typography
          component="span"
          sx={{
            fontWeight: 'bold',
            color: '#00796b',
            marginLeft: '4px',
            fontStyle: 'italic',
          }}
          onClick={() => {
            window.open('/', '_blank');
          }}
        >
          visiting this link
          <OpenInNewIcon
            sx={{
              fontSize: '1.2rem',
              marginLeft: '4px',
            }}
          />
        </Typography>
      </Box> */}

      <Box>
        {/* <Box
          sx={{
            fontSize: '1.125rem',
            fontWeight: 'bold',
            marginTop: '40px',
            alignSelf: 'flex-start',
          }}
        >
          Create new template
        </Box> */}
        {/* <Box
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
        </Box> */}
      </Box>

      <Button
        variant="contained"
        startIcon={
          <AddCircleSharpIcon sx={{fontSize: '1.6em', color: 'orange'}} />
        }
        sx={{
          width: '40%',
          alignSelf: 'left',
          mt: '120px',
          textTransform: 'none',
          fontSize: '1.2em',
          backgroundColor:
            !createNotebook.mutation?.isPending && selectedTemplate
              ? '#669911'
              : '#d2e2b9', // Enabled and disabled color
          color:
            !createNotebook.mutation?.isPending && selectedTemplate
              ? '#fff'
              : 'darkgrey', // Enabled and disabled text color
          '&:hover': {
            backgroundColor:
              !createNotebook.mutation?.isPending && selectedTemplate
                ? '#1976d2'
                : '#d2e2b9', // Adjust hover color
          },
          '&.Mui-disabled': {
            backgroundColor: '#d2e2b9', // Override the default disabled color
            color: 'darkgrey', // Override the default disabled text color
          },
        }}
        onClick={handleInstantiateSurvey}
        disabled={createNotebook.mutation?.isPending || !selectedTemplate}
      >
        {createNotebook.mutation?.isPending
          ? `Creating ${NOTEBOOK_NAME}...`
          : `Create ${NOTEBOOK_NAME}`}
      </Button>

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth={isMobile ? 'xs' : 'sm'}
        disableScrollLock={true}
        sx={{
          '& .MuiDialog-paper': {
            width: isMobile ? '90%' : '60%', // Adjust width for mobile and desktop
            margin: 'auto', // Center the dialog
            fontStyle: 'bold',
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
              Instantiate {NOTEBOOK_NAME}
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
              You are about to create a new {NOTEBOOK_NAME} based on the
              selected template. Please ensure you have chosen the correct
              template.
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
              After the {NOTEBOOK_NAME} is created, it will be listed in the{' '}
              {NOTEBOOK_NAME} list.
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
