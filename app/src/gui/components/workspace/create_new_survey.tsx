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
import UploadIcon from '@mui/icons-material/Upload';
import BrowserNotSupportedIcon from '@mui/icons-material/BrowserNotSupported';
import InfoIcon from '@mui/icons-material/Info';
import {fetchTemplates} from '../sync/templates';
import {directory_db, ListingsObject} from '../../../sync/databases';

const CreateNewSurvey: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateDocument[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [openDialog, setOpenDialog] = useState(false);
  const [surveyName, setSurveyName] = useState<string>('');
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const getListingFromDB = async (): Promise<ListingsObject | undefined> => {
    try {
      const allListings = await directory_db.local.allDocs({
        include_docs: true,
      });
      if (allListings.rows.length > 0) {
        return allListings.rows[0].doc as ListingsObject;
      }
    } catch (err) {
      console.error('Error fetching listing from the database', err);
    }
    return undefined;
  };

  const loadTemplates = async () => {
    try {
      const listing = await getListingFromDB();
      console.log('listing in loadTemp;ates', listing);
      if (listing) {
        const response = await fetchTemplates(listing);
        if (response && response.templates) {
          console.log('response for templates', response.templates);
          setTemplates(response.templates);
        } else {
          console.error('No templates found or error occurred.');
        }
      } else {
        console.error('No listing found.');
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
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
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSubmitSurvey = () => {
    if (!surveyName) {
      console.error('Survey Name is required');
      return;
    }
    console.log('Creating survey with name:', surveyName);
    setOpenDialog(false);
    navigate('/');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '80vh',
        maxWidth: '600px',
        width: '100%',
        margin: 'auto',
        padding: '20px',
        gap: '16px',
      }}
    >
      <Box>
        <Box
          sx={{
            textAlign: 'center',
            padding: '8px 0',
            backgroundColor: '#f5f5f5',
          }}
        >
          <Grid container direction="column" alignItems="center">
            <Grid item>
              <DescriptionIcon
                color={'secondary'}
                fontSize={isMobile ? 'medium' : 'large'}
              />
            </Grid>
            <Grid item>
              <Typography
                variant={isMobile ? 'h5' : 'h4'}
                component={'div'}
                sx={{fontWeight: 'bold', fontSize: '1.28rem'}}
              >
                Create New Survey
              </Typography>
            </Grid>
          </Grid>
        </Box>
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
            marginBottom: '15px',
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

      <Box
        sx={{
          fontSize: '0.875rem',
          color: 'green',
          mt: 1,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        View / Edit survey templates
      </Box>

      <Box
        sx={{
          fontSize: '1.125rem',
          fontWeight: 'bold',
          mt: 2,
          mb: 1,
          alignSelf: 'flex-start',
        }}
      >
        Upload template
      </Box>
      <Button
        variant="contained"
        component="label"
        startIcon={<UploadIcon />}
        sx={{maxWidth: 400, width: '100%'}}
      >
        Browse
        <input type="file" hidden />
      </Button>

      <Box
        sx={{
          fontSize: '1.125rem',
          fontWeight: 'bold',
          mt: 2,
          alignSelf: 'flex-start',
        }}
      >
        Create new template
      </Box>
      <Box
        sx={{
          fontSize: '0.875rem',
          color: 'red',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          textAlign: 'center',
          marginBottom: 2,
        }}
      >
        <BrowserNotSupportedIcon color="error" />
        Please log in with browser app on your computer to create a new survey
        template
      </Box>

      <Button
        variant="contained"
        color="primary"
        sx={{
          width: '100%',
          maxWidth: 400,
          alignSelf: 'center',
          mt: '10px',
        }}
        onClick={handleInstantiateSurvey}
      >
        Instantiate Survey
      </Button>

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth={isMobile ? 'xs' : 'sm'}
        disableScrollLock={true}
        sx={{
          '& .MuiDialog-paper': {
            width: isMobile ? '95%' : '100%',
            margin: isMobile ? '10px' : 'auto',
          },
        }}
      >
        <DialogTitle>
          <InfoIcon
            sx={{color: '#1976d2', fontSize: 40, verticalAlign: 'middle'}}
          />
          &nbsp;Instantiate Survey
        </DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" fontWeight="bold">
            Survey Information:
          </Typography>
          <Typography variant="body2" paragraph>
            • You are about to create a new survey based on the selected
            template. Please ensure you have chosen the correct template.
          </Typography>
          <Typography variant="body2" paragraph>
            • After the survey is created, it will be listed in your active
            surveys, and you can begin adding records.
          </Typography>
          <TextField
            fullWidth
            label="Survey Name *"
            value={surveyName}
            onChange={e => setSurveyName(e.target.value)}
            sx={{marginTop: '16px'}}
            required
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
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CreateNewSurvey;
