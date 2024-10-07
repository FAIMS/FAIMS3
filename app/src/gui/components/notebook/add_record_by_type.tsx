import {useEffect, useState} from 'react';
import {Link as RouterLink, Navigate} from 'react-router-dom';

import {Box, Button, ButtonGroup, CircularProgress} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';

import {useTheme} from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';

import * as ROUTES from '../../../constants/routes';
import {getUiSpecForProject} from '../../../uiSpecification';
import {QRCodeButton} from '../../fields/qrcode/QRCodeFormField';
import {
  ProjectInformation,
  getRecordsWithRegex,
  RecordMetadata,
  ProjectUIModel,
} from '@faims3/data-model';
import {getMetadataValue} from '../../../sync/metadata';
import {RECORD_LABEL} from '../../../buildconfig';

type AddRecordButtonsProps = {
  project: ProjectInformation;
};

export default function AddRecordButtons(props: AddRecordButtonsProps) {
  const {project} = props;
  const project_id = project.project_id;
  const muiTheme = useTheme();
  const mq_above_md = useMediaQuery(muiTheme.breakpoints.up('md'));
  const mq_above_sm = useMediaQuery(muiTheme.breakpoints.up('sm'));
  const [uiSpec, setUiSpec] = useState<ProjectUIModel | undefined>(undefined);
  const [showQRButton, setShowQRButton] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<
    RecordMetadata | undefined
  >(undefined);

  const envTheme = import.meta.env.VITE_THEME;

  // Determine 'add new record' button label based on the environment theme
  const buttonLabel =
    envTheme === 'bubble' ? `Survey New ${RECORD_LABEL}` : 'New Record';

  getMetadataValue(project_id, 'showQRCodeButton').then(value => {
    setShowQRButton(value === true || value === 'true');
  });

  useEffect(() => {
    getUiSpecForProject(project_id).then(u => setUiSpec(u));
  }, []);

  if (uiSpec === undefined) {
    return <CircularProgress thickness={2} size={12} />;
  }
  const viewsets = uiSpec.viewsets;
  const visible_types = uiSpec.visible_types;

  const handleScanResult = (value: string) => {
    // find a record with this field value
    getRecordsWithRegex(project_id, value, true).then(records => {
      // navigate to it
      // what should happen if there are more than one?
      for (const key in records) {
        setSelectedRecord(records[key]);
      }
    });
  };
  if (selectedRecord) {
    /*  if we have selected a record (via QR scanning) then redirect to it here */
    return (
      <Navigate
        to={ROUTES.getRecordRoute(
          project_id || 'dummy',
          (selectedRecord.record_id || '').toString(),
          (selectedRecord.revision_id || '').toString()
        )}
      />
    );
  } else {
    return (
      <Box>
        <ButtonGroup
          fullWidth={mq_above_md ? false : true}
          orientation={mq_above_sm ? 'horizontal' : 'vertical'}
          sx={{
            maxHeight: '400px',
            justifyContent: mq_above_sm ? 'flex-start' : 'center',
          }}
        >
          {/*If the list of views hasn't loaded yet*/}
          {/*we can still show this button, except it will*/}
          {/*redirect to the Record creation without known type*/}
          {visible_types.length === 1 ? (
            <Button
              variant="contained"
              color="success"
              component={RouterLink}
              key="newRecord"
              to={
                ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                project_id +
                ROUTES.RECORD_CREATE +
                visible_types
              }
              sx={{
                backgroundColor: 'green',
                color: 'white',
                borderRadius: '8px',
                padding: '10px 15px',
                fontSize: '14px',
                fontWeight: 'bold',
                width: mq_above_sm ? 'auto' : '50%',
                '&:hover': {
                  backgroundColor: 'darkgreen',
                },
              }}
            >
              <Box
                sx={{
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: 24,
                  height: 24,
                  marginRight: 1,
                }}
              >
                <AddIcon sx={{fontSize: '1.2rem', color: 'green'}} />
              </Box>
              {buttonLabel}
            </Button>
          ) : (
            visible_types.map(
              (viewset_name: string) =>
                viewsets[viewset_name].is_visible !== false && (
                  <Button
                    component={RouterLink}
                    to={
                      ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                      project.project_id +
                      ROUTES.RECORD_CREATE +
                      viewset_name
                    }
                    key={viewset_name}
                    startIcon={<AddIcon />}
                    sx={{
                      backgroundColor: 'green',
                      color: 'white',
                      borderRadius: '8px',
                      padding: '10px 15px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      width: mq_above_sm ? 'auto' : '50%',
                      '&:hover': {
                        backgroundColor: 'darkgreen',
                      },
                    }}
                  >
                    {viewsets[viewset_name].label || viewset_name}
                  </Button>
                )
            )
          )}
          {/* Show the QR code button if configured for this project */}
          {showQRButton ? (
            <QRCodeButton
              key="scan-qr"
              label="Scan QR"
              onScanResult={handleScanResult}
            />
          ) : (
            <span />
          )}
        </ButtonGroup>
      </Box>
    );
  }
}
