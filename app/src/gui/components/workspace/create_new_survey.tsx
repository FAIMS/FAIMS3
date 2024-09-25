import React, {useEffect, useState} from 'react';
import {
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {useNavigate} from 'react-router-dom';
import {TemplateDocument} from '@faims3/data-model';
import {SelectChangeEvent} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import InfoIcon from '@mui/icons-material/Info';
import {fetchTemplates} from '../../../sync/templates';
import {directory_db, ListingsObject} from '../../../sync/databases';
import {createNotebookFromTemplate} from '../../../sync/create_notebook';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import AddCircleSharpIcon from '@mui/icons-material/AddCircleSharp';

const CreateNewSurvey: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateDocument[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [openDialog, setOpenDialog] = useState(false);
  const [surveyName, setSurveyName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [listings, setListings] = useState<ListingsObject[]>([]); // State for multiple listings
  const [selectedListing, setSelectedListing] = useState<string>(''); // New state for selected listing

  /**
   * Fetch all listings from the local database.
   * @returns An array of ListingsObject if listings exist, otherwise undefined.
   */
  const getListingFromDB = async (): Promise<ListingsObject[] | undefined> => {
    try {
      const allListings = await directory_db.local.allDocs({
        include_docs: true,
      });

      if (allListings.rows.length > 0) {
        // Filter out any rows that don't meet the ListingsObject type requirement
        const validListings = allListings.rows
          .filter(
            row => row.doc && row.doc._id && row.doc.name && row.doc.description
          ) // Ensure required fields are present
          .map(row => row.doc as ListingsObject); // Safely cast the row.doc to ListingsObject

        return validListings;
      }
    } catch (err) {
      console.error('Error fetching listing from the database', err);
    }
    return undefined;
  };

  /**
   * Load available templates for the selected listing.
   * Sets templates state if successful, otherwise sets an error message.
   */
  const loadTemplates = async () => {
    try {
      const fetchedListings = await getListingFromDB();
      if (fetchedListings && fetchedListings.length > 0) {
        setListings(fetchedListings); // Set multiple listings
        setSelectedListing(fetchedListings[0]._id); // Automatically select the first listing for now

        const response = await fetchTemplates(fetchedListings[0]); // Fetch templates for the first listing
        if (response && response.templates) {
          setTemplates(response.templates);
        } else {
          setError('No templates found or error occurred.');
        }
      } else {
        setError('No listing found.');
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError('Failed to load templates.');
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).paddingRight;

    if (openDialog) {
      document.body.style.paddingRight = '0px';
    }

    return () => {
      document.body.style.paddingRight = originalStyle;
    };
  }, [openDialog]);

  const handleTemplateChange = (event: SelectChangeEvent<string>) => {
    const templateId = event.target.value;
    setSelectedTemplate(templateId);
  };

  const handleInstantiateSurvey = () => {
    if (!selectedTemplate) {
      setError('Please select a template before creating a survey');
      return;
    }
    setError(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // Handle survey creation
  const handleSubmitSurvey = async () => {
    if (!surveyName) {
      setError('Survey Name is required');
      return;
    }
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const listings = await getListingFromDB(); // fetch all listings
      if (!listings || listings.length === 0) {
        setError('Listing not found');
        console.error('No listing found during survey creation');
        setLoading(false);
        return;
      }

      // Find the selected listing based on selectedListing state
      const listing = listings.find(list => list._id === selectedListing);

      if (!listing) {
        setError('Selected listing not found');
        console.error('Selected listing not found during survey creation');
        setLoading(false);
        return;
      }

      const createdNotebook = await createNotebookFromTemplate(
        listing, // Pass the selected listing
        selectedTemplate,
        surveyName
      );
      console.log('Notebook created successfully:', createdNotebook);

      navigate('/');

      setOpenDialog(false);
    } catch (error) {
      setError('Failed to create survey');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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
        <Grid container direction="column" alignItems="center">
          <Grid item>
            <DescriptionIcon
              color={'secondary'}
              fontSize={isMobile ? 'large' : 'inherit'}
            />
          </Grid>
          <Grid item>
            <Typography
              variant={isMobile ? 'h5' : 'h4'}
              component="div"
              sx={{fontWeight: 'bold', fontSize: '20px', marginBottom: '18px'}}
            >
              Create New Survey
            </Typography>
          </Grid>
        </Grid>
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
        <Select
          labelId="template-select-label"
          value={selectedTemplate}
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
          {templates.length > 0 ? (
            templates.map(template => (
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
      </FormControl>
      {error && <Typography color="error">{error}</Typography>}{' '}
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
        disabled={loading || !selectedTemplate}
      >
        {loading ? 'Creating Survey...' : 'Create survey'}
      </Button>
      {error && (
        <Typography color="error" variant="body2" sx={{mt: 1}}>
          {error}
        </Typography>
      )}
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
            value={surveyName}
            onChange={e => setSurveyName(e.target.value)}
            sx={{marginTop: '16px'}}
            required
            disabled={loading}
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
            disabled={loading || !surveyName}
          >
            {loading ? 'Creating...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CreateNewSurvey;
